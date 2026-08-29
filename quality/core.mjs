import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const QA_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  NOT_RUN: 'NOT_RUN',
});

export function mapExitCodeToStatus(exitCode) {
  if (exitCode === 0) return QA_STATUS.VERIFIED;
  if (exitCode === 77) return QA_STATUS.SKIPPED;
  if (exitCode === 78) return QA_STATUS.NOT_CONFIGURED;
  return QA_STATUS.FAILED;
}

export function requiredStagePassed(stage, status) {
  return !stage.required || status === QA_STATUS.VERIFIED;
}

export function evaluateCondition(condition, env = process.env) {
  if (!condition || condition.kind === 'always') return { runnable: true };
  if (condition.kind === 'env') {
    const runnable = env[condition.name] === condition.equals;
    return { runnable, reason: runnable ? undefined : condition.reason };
  }
  return { runnable: false, reason: `Condicion desconocida: ${condition.kind}` };
}

export function compareDebt(current = {}, baseline = {}) {
  const regressions = [];
  const improvements = [];
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);

  for (const identity of [...keys].sort()) {
    const currentCount = current[identity] || 0;
    const allowedCount = baseline[identity] || 0;
    if (currentCount > allowedCount) {
      regressions.push({ identity, current: currentCount, baseline: allowedCount });
    } else if (currentCount < allowedCount) {
      improvements.push({ identity, current: currentCount, baseline: allowedCount });
    }
  }

  return { regressions, improvements };
}

export function validateTestCount(totalTests) {
  return Number.isInteger(totalTests) && totalTests > 0;
}

export function missingConfiguration(requiredNames, env = process.env) {
  return requiredNames.filter((name) => !env[name]);
}

export function stageOutcome(stage, result) {
  const status = result.status || mapExitCodeToStatus(result.exitCode);
  return {
    id: stage.id,
    description: stage.description,
    required: stage.required,
    status,
    durationMs: result.durationMs ?? 0,
    exitCode: result.exitCode ?? null,
    reason: result.reason,
    artifacts: stage.artifacts || [],
  };
}

function quoteForShell(value) {
  if (/^[A-Za-z0-9_./:\\-]+$/.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}

export function commandWithArgs(baseCommand, args = []) {
  return [baseCommand, ...args.map(quoteForShell)].join(' ');
}

export async function executeCommand(command, { cwd, timeoutMs, logFile }) {
  const startedAt = Date.now();
  let stdout = '';
  let stderr = '';
  let timedOut = false;

  const child = spawn(command, {
    cwd,
    env: process.env,
    shell: true,
    windowsHide: true,
    detached: process.platform !== 'win32',
  });

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    process.stdout.write(text);
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(text);
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }
  }, timeoutMs);

  const exitCode = await new Promise((resolve) => {
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(timedOut ? 124 : (code ?? 1)));
  });
  clearTimeout(timeout);

  const durationMs = Date.now() - startedAt;
  await mkdir(path.dirname(logFile), { recursive: true });
  await writeFile(
    logFile,
    `COMMAND: ${command}\nEXIT_CODE: ${exitCode}\nDURATION_MS: ${durationMs}\nTIMED_OUT: ${timedOut}\n\nSTDOUT\n${stdout}\n\nSTDERR\n${stderr}`,
    'utf8',
  );

  return {
    exitCode,
    durationMs,
    reason: timedOut ? `Timeout despues de ${timeoutMs} ms` : undefined,
  };
}

export async function runStagePlan(stages, { cwd, artifactDir }) {
  const results = [];
  const byId = new Map();

  for (const stage of stages) {
    const unmet = stage.dependencies.filter((id) => byId.get(id)?.status !== QA_STATUS.VERIFIED);
    if (unmet.length > 0) {
      const outcome = stageOutcome(stage, {
        status: QA_STATUS.NOT_RUN,
        reason: `Dependencias no verificadas: ${unmet.join(', ')}`,
      });
      results.push(outcome);
      byId.set(stage.id, outcome);
      continue;
    }

    const condition = evaluateCondition(stage.condition);
    if (!condition.runnable) {
      const outcome = stageOutcome(stage, {
        status: stage.condition?.missingStatus || QA_STATUS.NOT_CONFIGURED,
        reason: condition.reason || stage.skipReason,
      });
      results.push(outcome);
      byId.set(stage.id, outcome);
      continue;
    }

    const result = await executeCommand(stage.command, {
      cwd,
      timeoutMs: stage.timeoutMs,
      logFile: path.join(artifactDir, `${stage.id}.log`),
    });
    const outcome = stageOutcome(stage, result);
    results.push(outcome);
    byId.set(stage.id, outcome);
  }

  const success = results.every((result) => requiredStagePassed(
    stages.find((stage) => stage.id === result.id),
    result.status,
  ));
  return { success, results };
}
