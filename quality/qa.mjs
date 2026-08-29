import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandWithArgs, runStagePlan } from './core.mjs';
import { stagesFor } from './stages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runId(level) {
  return `${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${level}`;
}

function focusedStage(files) {
  if (!files.length) return null;
  const isNode = files.every((file) => /\.test\.mjs$/.test(file));
  const isPlaywright = files.every((file) => /\.spec\.(ts|tsx|js)$/.test(file));
  const isPwaPlaywright = isPlaywright && files.every((file) => file.replaceAll('\\', '/').startsWith('e2e/pwa/'));
  const base = isNode
    ? 'node --test'
    : isPwaPlaywright
      ? 'npx playwright test --config=playwright.pwa.config.ts --project=chromium'
      : isPlaywright
      ? 'npx playwright test --config=playwright.e2e.config.ts --project=chromium'
      : 'npx vitest run';
  return {
    id: 'focused-tests',
    description: 'Ejecuta un conjunto explicito y no vacio de pruebas relacionadas con el cambio.',
    command: commandWithArgs(base, files),
    required: true,
    dependencies: [],
    timeoutMs: isPwaPlaywright ? 300000 : isPlaywright ? 180000 : 120000,
    condition: { kind: 'always' },
    skipReason: '',
    artifacts: isPlaywright ? ['playwright-report/', 'test-results/'] : [],
    levels: ['focused'],
  };
}

const [level, ...args] = process.argv.slice(2);
if (!['focused', 'quick', 'gate', 'release'].includes(level)) {
  console.error('Uso: node quality/qa.mjs <focused|quick|gate|release> [archivos de prueba]');
  process.exit(2);
}

const selected = level === 'focused' ? [focusedStage(args)].filter(Boolean) : stagesFor(level);
if (selected.length === 0) {
  console.error('FAILED: qa:focused requiere al menos un archivo de prueba; cero pruebas nunca es verde.');
  process.exit(1);
}

const id = runId(level);
const artifactDir = path.join(root, '.tmp', 'qa-results', id);
await mkdir(artifactDir, { recursive: true });
const summary = await runStagePlan(selected, { cwd: root, artifactDir });
await writeFile(path.join(artifactDir, 'summary.json'), `${JSON.stringify({ level, runId: id, ...summary }, null, 2)}\n`, 'utf8');

console.log('\nQA SUMMARY');
for (const result of summary.results) {
  console.log(`${result.status.padEnd(14)} ${result.required ? 'REQUIRED' : 'OPTIONAL'} ${result.id} duration=${result.durationMs}ms exit=${result.exitCode ?? '-'}${result.reason ? ` reason=${result.reason}` : ''}`);
}
console.log(`Artefactos: ${path.relative(root, artifactDir)}`);
process.exit(summary.success ? 0 : 1);
