import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  QA_STATUS,
  compareDebt,
  evaluateCondition,
  executeCommand,
  mapExitCodeToStatus,
  missingConfiguration,
  requiredStagePassed,
  stageOutcome,
  validateTestCount,
} from './core.mjs';
import { renderRegistryMarkdown, stages } from './stages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('mapea exit codes a estados sin falsos verdes', () => {
  assert.equal(mapExitCodeToStatus(0), QA_STATUS.VERIFIED);
  assert.equal(mapExitCodeToStatus(77), QA_STATUS.SKIPPED);
  assert.equal(mapExitCodeToStatus(78), QA_STATUS.NOT_CONFIGURED);
  assert.equal(mapExitCodeToStatus(1), QA_STATUS.FAILED);
  assert.equal(mapExitCodeToStatus(124), QA_STATUS.FAILED);
});

test('SKIPPED y NOT_CONFIGURED bloquean una etapa requerida', () => {
  const required = { required: true };
  assert.equal(requiredStagePassed(required, QA_STATUS.SKIPPED), false);
  assert.equal(requiredStagePassed(required, QA_STATUS.NOT_CONFIGURED), false);
  assert.equal(requiredStagePassed(required, QA_STATUS.VERIFIED), true);
});

test('una etapa opcional no configurada queda declarada sin bloquear', () => {
  const optional = { id: 'optional', description: 'x', required: false, artifacts: [] };
  const result = stageOutcome(optional, { status: QA_STATUS.NOT_CONFIGURED, reason: 'falta sandbox' });
  assert.equal(result.status, QA_STATUS.NOT_CONFIGURED);
  assert.equal(result.reason, 'falta sandbox');
  assert.equal(requiredStagePassed(optional, result.status), true);
});

test('cero pruebas ejecutadas falla', () => {
  assert.equal(validateTestCount(0), false);
  assert.equal(validateTestCount(1), true);
});

test('el trinquete detecta deuda nueva o aumentada por identidad', () => {
  const comparison = compareDebt(
    { 'a.ts::TS1': 2, 'b.ts::TS2': 1 },
    { 'a.ts::TS1': 1, 'c.ts::TS3': 1 },
  );
  assert.deepEqual(comparison.regressions, [
    { identity: 'a.ts::TS1', current: 2, baseline: 1 },
    { identity: 'b.ts::TS2', current: 1, baseline: 0 },
  ]);
  assert.deepEqual(comparison.improvements, [
    { identity: 'c.ts::TS3', current: 0, baseline: 1 },
  ]);
});

test('los preflights enumeran toda la configuracion faltante', () => {
  assert.deepEqual(missingConfiguration(['A', 'B', 'C'], { B: 'ok' }), ['A', 'C']);
  const condition = evaluateCondition(
    { kind: 'env', name: 'QA_SANDBOX', equals: '1', reason: 'falta QA_SANDBOX' },
    {},
  );
  assert.deepEqual(condition, { runnable: false, reason: 'falta QA_SANDBOX' });
});

test('un fallo conserva diagnostico en su log de artefacto', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'crm-qa-'));
  const log = path.join(dir, 'failed.log');
  try {
    const result = await executeCommand(
      'node -e "console.error(\'diagnostico-e2e\'); process.exit(2)"',
      { cwd: root, timeoutMs: 10000, logFile: log },
    );
    assert.equal(result.exitCode, 2);
    assert.match(await readFile(log, 'utf8'), /diagnostico-e2e/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('un timeout termina el arbol de procesos y se reporta como FAILED', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'crm-qa-timeout-'));
  const log = path.join(dir, 'timeout.log');
  try {
    const result = await executeCommand(
      'node -e "setInterval(() => {}, 1000)"',
      { cwd: root, timeoutMs: 150, logFile: log },
    );
    assert.equal(result.exitCode, 124);
    assert.match(result.reason, /Timeout/);
    assert.equal(mapExitCodeToStatus(result.exitCode), QA_STATUS.FAILED);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('la etapa E2E declara trazas, reportes y resultados como artefactos', () => {
  const e2e = stages.find((stage) => stage.id === 'e2e-chromium');
  assert.ok(e2e);
  assert.deepEqual(e2e.artifacts.slice(0, 2), ['playwright-report/', 'test-results/']);
});

test('el gate prueba la PWA de produccion despues de construirla', () => {
  const pwa = stages.find((stage) => stage.id === 'pwa-offline-e2e');
  assert.ok(pwa);
  assert.ok(pwa.required);
  assert.ok(pwa.levels.includes('gate'));
  assert.ok(pwa.dependencies.includes('production-build'));
  assert.match(pwa.command, /playwright\.pwa\.config\.ts/);
  assert.deepEqual(pwa.artifacts.slice(0, 2), ['playwright-report-pwa/', 'test-results-pwa/']);
});

test('CI invoca el mismo gate local', async () => {
  const ci = await readFile(path.join(root, '.github', 'workflows', 'quality-gate.yml'), 'utf8');
  assert.match(ci, /run:\s*npm run qa:gate/);
});

test('documentacion y registro de etapas no divergen', async () => {
  const docs = (await readFile(path.join(root, 'docs', 'quality', 'procedure-registry.md'), 'utf8')).replaceAll('\r\n', '\n');
  assert.ok(docs.includes(renderRegistryMarkdown()));
});

test('la politica verificable protege supresiones y debilitamiento de pruebas', () => {
  const policy = stages.find((stage) => stage.id === 'safe-change-policy');
  assert.ok(policy?.required);
  assert.match(policy.command, /checks\.mjs policy/);
});

test('la politica safe-change incluye auditoria estricta de react-hooks/rules-of-hooks', async () => {
  const checksContent = await readFile(path.join(root, 'quality', 'checks.mjs'), 'utf8');
  assert.match(checksContent, /react-hooks\/rules-of-hooks/);
});

