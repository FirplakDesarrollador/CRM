import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const id = value('id');
const flow = value('flow');
const summary = value('summary');
if (!id || !flow || !summary) {
  console.error('NOT_CONFIGURED: uso npm run qa:incident -- --id INC-YYYY-NNN --flow Rn --summary "resumen"');
  process.exit(78);
}
if (!/^R\d+$/.test(flow)) {
  console.error('FAILED: --flow debe ser un ID R1, R2, ... de docs/quality/critical-flows.md');
  process.exit(1);
}

const safeId = id.replace(/[^A-Za-z0-9_-]/g, '-');
const date = new Date().toISOString().slice(0, 10);
const targetDir = path.join(root, 'docs', 'failures');
const target = path.join(targetDir, `${date}-${safeId}.md`);
if (existsSync(target)) {
  console.error(`FAILED: ya existe ${path.relative(root, target)}`);
  process.exit(1);
}

const template = readFileSync(path.join(targetDir, 'TEMPLATE.md'), 'utf8')
  .replaceAll('{{INCIDENT_ID}}', id)
  .replaceAll('{{DATE}}', date)
  .replaceAll('{{SUMMARY}}', summary)
  .replaceAll('{{CRITICAL_FLOW}}', flow);
mkdirSync(targetDir, { recursive: true });
writeFileSync(target, template, 'utf8');
console.log(`Incidente creado: ${path.relative(root, target)}`);
console.log('Complete causa raiz, prevencion, deteccion y evidencia antes de integrar.');
