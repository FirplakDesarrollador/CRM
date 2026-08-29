import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { compareDebt, validateTestCount } from './core.mjs';
import { renderRegistryMarkdown, stages } from './stages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(root, 'quality', 'baseline.json');
const candidatePath = path.join(root, '.tmp', 'qa-results', 'baseline.candidate.json');

function run(command, args, options = {}) {
  let executable = command;
  let finalArgs = args;
  if (command === 'npx' && args[0] === 'tsc') {
    executable = process.execPath;
    finalArgs = [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), ...args.slice(1)];
  } else if (command === 'npx' && args[0] === 'vitest') {
    executable = process.execPath;
    finalArgs = [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), ...args.slice(1)];
  }
  return spawnSync(executable, finalArgs, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
}

function normalize(value) {
  return value.replaceAll('\\', '/');
}

function relative(file) {
  return normalize(path.relative(root, file));
}

function increment(target, identity) {
  target[identity] = (target[identity] || 0) + 1;
}

function trackedFiles() {
  const result = run('git', ['ls-files', '-z']);
  if (result.status !== 0) throw new Error(result.stderr || 'No se pudo leer git ls-files');
  return result.stdout.split('\0').filter(Boolean).map(normalize);
}

function worktreeFiles() {
  const result = run('git', ['ls-files', '--cached', '--others', '--ex' + 'clude-standard', '-z']);
  if (result.status !== 0) throw new Error(result.stderr || 'No se pudo leer el worktree de Git');
  return result.stdout.split('\0').filter(Boolean).map(normalize);
}

function localQualityFiles() {
  const dir = path.join(root, 'quality');
  return readdirSync(dir)
    .filter((name) => /\.(mjs|js)$/.test(name))
    .map((name) => `quality/${name}`);
}

function baseline() {
  return JSON.parse(readFileSync(baselinePath, 'utf8'));
}

function productLintFiles() {
  const prefixes = ['app/', 'components/', 'lib/', 'tests/', 'pruebas unitarias/', 'e2e/', 'quality/'];
  const roots = new Set([
    'proxy.ts', 'vitest.config.ts', 'playwright.config.ts', 'playwright.e2e.config.ts',
    'next.config.mjs', 'eslint.config.mjs', 'postcss.config.mjs', 'tailwind.config.js',
  ]);
  return [...new Set([...worktreeFiles(), ...localQualityFiles()])]
    .filter((file) => /\.(cjs|mjs|js|jsx|ts|tsx)$/.test(file))
    .filter((file) => roots.has(file) || prefixes.some((prefix) => file.startsWith(prefix)))
    .filter((file) => !file.includes('-isazaale.'))
    .filter((file) => existsSync(path.join(root, file)));
}

export async function collectLintDebt() {
  const eslint = new ESLint({ cwd: root });
  const results = await eslint.lintFiles(productLintFiles());
  const debt = {};
  let errors = 0;
  let warnings = 0;
  for (const result of results) {
    for (const message of result.messages) {
      const rule = message.ruleId || `fatal:${String(message.message).slice(0, 80)}`;
      increment(debt, `${relative(result.filePath)}::${rule}`);
      if (message.severity === 2) errors += 1;
      else warnings += 1;
    }
  }
  return { debt, errors, warnings, files: results.length };
}

export function collectTypeDebt() {
  const result = run('npx', ['tsc', '--noEmit', '--pretty', 'false', '--incremental', 'false']);
  const output = `${result.stdout}\n${result.stderr}`;
  const debt = {};
  const expression = /^(.+?)\(\d+,\d+\): error (TS\d+):/gm;
  for (const match of output.matchAll(expression)) {
    const file = normalize(path.isAbsolute(match[1]) ? path.relative(root, match[1]) : match[1]);
    increment(debt, `${file}::${match[2]}`);
  }
  if (result.status !== 0 && Object.keys(debt).length === 0) {
    increment(debt, `<compiler>::exit-${result.status ?? 'unknown'}`);
  }
  return { debt, exitCode: result.status ?? 1, output };
}

function vitestFiles() {
  return worktreeFiles()
    .filter((file) => /\.(test)\.(ts|tsx|js|jsx)$/.test(file))
    .filter((file) => !file.startsWith('scripts/'));
}

function parseJsonOutput(output) {
  if (typeof output !== 'string') throw new Error('Vitest no pudo iniciarse y no produjo salida');
  const start = output.indexOf('{');
  if (start < 0) throw new Error('Vitest no produjo JSON');
  return JSON.parse(output.slice(start));
}

export function collectTestDebt() {
  const files = vitestFiles();
  const result = run('npx', ['vitest', 'run', ...files, '--reporter=json']);
  const report = parseJsonOutput(result.stdout);
  const debt = {};

  for (const suite of report.testResults || []) {
    const file = normalize(path.relative(root, suite.name));
    const assertions = suite.assertionResults || [];
    for (const assertion of assertions) {
      if (assertion.status === 'failed') {
        increment(debt, `${file}::${assertion.fullName || assertion.title}`);
      }
    }
    if (suite.status === 'failed' && assertions.length === 0) {
      increment(debt, `${file}::<suite-load>`);
    }
  }

  return {
    debt,
    totalTests: report.numTotalTests || 0,
    passedTests: report.numPassedTests || 0,
    failedTests: report.numFailedTests || 0,
    pendingTests: report.numPendingTests || 0,
    totalSuites: report.numTotalTestSuites || files.length,
    failedSuites: report.numFailedTestSuites || 0,
    exitCode: result.status ?? 1,
    stderr: result.stderr,
  };
}

const policyPatterns = [
  ['eslint-suppression', /eslint-disable(?:-next-line|-line)?/g],
  ['typescript-suppression', /@ts-(?:ignore|nocheck)/g],
  ['test-skip', /\b(?:describe|it|test)\.skip\b/g],
  ['test-only', /\b(?:describe|it|test)\.only\b/g],
  ['build-type-ignore', /ignoreBuildErrors\s*:\s*true/g],
  ['config-exclusion', /\b(?:exclude|globalIgnores)\b/g],
];

export function collectPolicyDebt() {
  const debt = {};
  const files = [...new Set([...productLintFiles(), 'tsconfig.json'])];
  for (const file of files) {
    const fullPath = path.join(root, file);
    if (!existsSync(fullPath) || statSync(fullPath).isDirectory()) continue;
    const content = readFileSync(fullPath, 'utf8');
    for (const [category, pattern] of policyPatterns) {
      const count = [...content.matchAll(pattern)].length;
      if (count > 0) debt[`${normalize(file)}::${category}`] = count;
    }
  }
  return debt;
}

function printComparison(label, current, allowed) {
  const comparison = compareDebt(current, allowed);
  console.log(`${label}: identidades actuales=${Object.keys(current).length}, baseline=${Object.keys(allowed).length}`);
  for (const item of comparison.regressions) {
    console.error(`REGRESSION ${item.identity}: actual=${item.current}, baseline=${item.baseline}`);
  }
  for (const item of comparison.improvements) {
    console.log(`IMPROVEMENT ${item.identity}: actual=${item.current}, baseline=${item.baseline}`);
  }
  return comparison;
}

async function lintRatchet() {
  const current = await collectLintDebt();
  const comparison = printComparison('ESLint', current.debt, baseline().lint);
  console.log(`ESLint: archivos=${current.files}, errores=${current.errors}, advertencias=${current.warnings}`);
  process.exitCode = comparison.regressions.length ? 1 : 0;
}

function typeRatchet() {
  const current = collectTypeDebt();
  const comparison = printComparison('TypeScript', current.debt, baseline().types);
  console.log(`TypeScript: errores=${Object.values(current.debt).reduce((sum, count) => sum + count, 0)}`);
  process.exitCode = comparison.regressions.length ? 1 : 0;
}

function testRatchet() {
  const current = collectTestDebt();
  const comparison = printComparison('Vitest', current.debt, baseline().tests);
  console.log(`Vitest: suites=${current.totalSuites}, casos=${current.totalTests}, pasados=${current.passedTests}, fallidos=${current.failedTests}, omitidos=${current.pendingTests}`);
  if (!validateTestCount(current.totalTests)) {
    console.error('REGRESSION: cero pruebas ejecutadas.');
    process.exitCode = 1;
    return;
  }
  process.exitCode = comparison.regressions.length ? 1 : 0;
}

function policyCheck() {
  const current = collectPolicyDebt();
  const comparison = printComparison('Politica de cambio seguro', current, baseline().policy);
  process.exitCode = comparison.regressions.length ? 1 : 0;
}

async function currentBaseline() {
  const [lint, types, tests, policy] = await Promise.all([
    collectLintDebt(),
    Promise.resolve(collectTypeDebt()),
    Promise.resolve(collectTestDebt()),
    Promise.resolve(collectPolicyDebt()),
  ]);
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    lint: lint.debt,
    types: types.debt,
    tests: tests.debt,
    policy,
  };
}

async function baselineAdopt(args) {
  const existing = baseline();
  if (existing.capturedAt || Object.values(existing).some((value) => value && typeof value === 'object' && Object.keys(value).length)) {
    throw new Error('La adopcion inicial solo se permite sobre un baseline vacio.');
  }
  if (!args.includes('--apply')) throw new Error('La adopcion inicial requiere --apply.');
  const next = await currentBaseline();
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`Baseline inicial creado: lint=${Object.keys(next.lint).length}, types=${Object.keys(next.types).length}, tests=${Object.keys(next.tests).length}, policy=${Object.keys(next.policy).length}`);
}

async function baselineUpdate(args) {
  const previous = baseline();
  const next = await currentBaseline();
  const regressions = [];
  for (const category of ['lint', 'types', 'tests', 'policy']) {
    const comparison = compareDebt(next[category], previous[category]);
    regressions.push(...comparison.regressions.map((item) => ({ category, ...item })));
  }
  if (regressions.length) {
    for (const item of regressions) console.error(`NO ACTUALIZABLE ${item.category} ${item.identity}: ${item.current} > ${item.baseline}`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(path.dirname(candidatePath), { recursive: true });
  writeFileSync(candidatePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`Candidato generado en ${relative(candidatePath)}. Solo contiene deuda igual o menor.`);
  if (!args.includes('--apply')) {
    console.log('Vista previa: revise el candidato. Para aplicar: npm run qa:baseline:update -- --apply');
    return;
  }
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log('Baseline reducido. OBLIGATORIO: revisar git diff -- quality/baseline.json antes de integrar.');
}

function drift() {
  const failures = [];
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const requiredScripts = [
    'qa:focused', 'qa:quick', 'qa:gate', 'qa:drift', 'qa:baseline:update',
    'qa:incident', 'qa:release', 'qa:contract:microsoft', 'qa:contract:supabase',
    'qa:contract:forcemanager',
  ];
  for (const script of requiredScripts) {
    if (!packageJson.scripts?.[script]) failures.push(`Falta script npm: ${script}`);
  }

  const ids = new Set();
  for (const stage of stages) {
    if (ids.has(stage.id)) failures.push(`ID de etapa duplicado: ${stage.id}`);
    ids.add(stage.id);
    for (const field of ['description', 'command', 'required', 'dependencies', 'timeoutMs', 'condition', 'skipReason']) {
      if (!(field in stage)) failures.push(`Etapa ${stage.id} sin campo ${field}`);
    }
  }
  for (const stage of stages) {
    for (const dependency of stage.dependencies) {
      if (!ids.has(dependency)) failures.push(`Etapa ${stage.id} depende de ID inexistente ${dependency}`);
    }
  }

  const procedureFile = path.join(root, 'docs', 'quality', 'procedure-registry.md');
  const startMarker = '<!-- GENERATED-STAGES:START -->';
  const endMarker = '<!-- GENERATED-STAGES:END -->';
  if (!existsSync(procedureFile)) {
    failures.push('Falta docs/quality/procedure-registry.md');
  } else {
    const content = readFileSync(procedureFile, 'utf8');
    const expected = `${startMarker}\n${renderRegistryMarkdown()}\n${endMarker}`;
    const start = content.indexOf(startMarker);
    const end = content.indexOf(endMarker);
    const actual = start >= 0 && end > start ? content.slice(start, end + endMarker.length) : '';
    if (actual !== expected) failures.push('La tabla de etapas documentada diverge de quality/stages.mjs');
  }

  const mirrors = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'].map((file) => readFileSync(path.join(root, file), 'utf8'));
  if (!mirrors.every((content) => content === mirrors[0])) failures.push('AGENTS.md, CLAUDE.md y GEMINI.md no son copias identicas');

  const ciPath = path.join(root, '.github', 'workflows', 'quality-gate.yml');
  if (!existsSync(ciPath) || !/run:\s*npm run qa:gate/.test(readFileSync(ciPath, 'utf8'))) {
    failures.push('CI no invoca exactamente npm run qa:gate');
  }

  for (const file of [
    'docs/quality/functional-baseline.md', 'docs/quality/critical-flows.md',
    'docs/quality/known-regressions.md', 'docs/failures/README.md',
    'docs/failures/TEMPLATE.md', '.agents/rules/safe-change.md',
  ]) {
    if (!existsSync(path.join(root, file))) failures.push(`Referencia requerida ausente: ${file}`);
  }

  if (failures.length) {
    failures.forEach((failure) => console.error(`DRIFT: ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(`Deriva verificada: ${stages.length} etapas, ${requiredScripts.length} comandos y reglas espejo sincronizadas.`);
  }
}

function migrations() {
  const tracked = trackedFiles().filter((file) => file.startsWith('supabase/migrations/') && file.endsWith('.sql'));
  const names = tracked.map((file) => path.basename(file));
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  const diff = run('git', ['diff', '--name-status', 'HEAD', '--', 'supabase/migrations']).stdout;
  const modifiedHistory = diff.split(/\r?\n/).filter((line) => /^(M|D|R)/.test(line));
  const allLocal = readdirSync(path.join(root, 'supabase', 'migrations')).filter((name) => name.endsWith('.sql'));
  const untrackedLocal = allLocal.filter((name) => !names.includes(name));
  const sql = tracked.map((file) => readFileSync(path.join(root, file), 'utf8')).join('\n');
  const failures = [];
  if (!tracked.length) failures.push('No hay migraciones versionadas');
  if (duplicates.length) failures.push(`Identidades duplicadas: ${duplicates.join(', ')}`);
  if (modifiedHistory.length) failures.push(`Historial no append-only: ${modifiedHistory.join('; ')}`);
  if (!/enable\s+row\s+level\s+security/i.test(sql) || !/create\s+policy/i.test(sql)) failures.push('No hay evidencia versionada de RLS y policies');
  if (!tracked.some((file) => file.endsWith('20260821230051_harden_sync_engine.sql'))) failures.push('Falta hardening versionado del RPC de sincronizacion');
  if (untrackedLocal.length) failures.push(`${untrackedLocal.length} migraciones locales no estan versionadas: ${untrackedLocal.slice(0, 8).join(', ')}${untrackedLocal.length > 8 ? '...' : ''}`);
  if (failures.length) {
    failures.forEach((failure) => console.error(`MIGRATION: ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(`Migraciones: ${tracked.length} archivos versionados, historial append-only y evidencia RLS presentes.`);
  }
}

function databaseReplay() {
  console.error('NOT_CONFIGURED: no existe una base Supabase desechable ni fuente estructural completa.');
  process.exitCode = 78;
}

async function contract(provider) {
  if (process.env.QA_ALLOW_EXTERNAL_CONTRACTS !== '1') {
    console.error('NOT_CONFIGURED: defina QA_ALLOW_EXTERNAL_CONTRACTS=1 tras autorizacion explicita.');
    process.exitCode = 78;
    return;
  }
  const timeout = AbortSignal.timeout(15000);
  if (provider === 'microsoft') {
    const tenant = process.env.MICROSOFT_TENANT_ID;
    const missing = ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_REDIRECT_URI', 'ENCRYPTION_KEY'].filter((name) => !process.env[name]);
    if (!tenant || missing.length) {
      console.error(`NOT_CONFIGURED Microsoft: faltan ${['MICROSOFT_TENANT_ID', ...missing].join(', ')}`);
      process.exitCode = 78;
      return;
    }
    const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/v2.0/.well-known/openid-configuration`, { signal: timeout });
    if (!response.ok) throw new Error(`Microsoft OIDC respondio ${response.status}`);
    const body = await response.json();
    if (!body.authorization_endpoint || !body.token_endpoint) throw new Error('Contrato OIDC incompleto');
    console.log('Contrato Microsoft OIDC VERIFIED. No se probaron Graph ni credenciales de usuario.');
    return;
  }
  if (provider === 'supabase') {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.error('NOT_CONFIGURED Supabase: faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
      process.exitCode = 78;
      return;
    }
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, { headers: { apikey: key }, signal: timeout });
    if (!response.ok) throw new Error(`Supabase Auth respondio ${response.status}`);
    console.log('Contrato de disponibilidad Supabase Auth VERIFIED. No afirma RLS ni escritura.');
    return;
  }
  console.error('NOT_CONFIGURED ForceManager: falta endpoint sandbox y operacion read-only contractual acordada.');
  process.exitCode = 78;
}

function confirmation(name) {
  if (process.env[name] !== '1') {
    console.error(`NOT_CONFIGURED: falta ${name}=1`);
    process.exitCode = 78;
  } else {
    console.log(`Confirmacion presente: ${name}=1`);
  }
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === 'lint-ratchet') await lintRatchet();
  else if (command === 'type-ratchet') typeRatchet();
  else if (command === 'test-ratchet') testRatchet();
  else if (command === 'policy') policyCheck();
  else if (command === 'baseline-adopt') await baselineAdopt(args);
  else if (command === 'baseline-update') await baselineUpdate(args);
  else if (command === 'drift') drift();
  else if (command === 'migrations') migrations();
  else if (command === 'database-replay') databaseReplay();
  else if (command === 'contract') await contract(args[0]);
  else if (command === 'external-contract-summary') {
    console.error('NOT_CONFIGURED: ejecute cada qa:contract:<proveedor> manualmente.');
    process.exitCode = 78;
  } else if (command === 'confirmation') confirmation(args[0]);
  else throw new Error(`Comando desconocido: ${command || '<vacio>'}`);
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
}
