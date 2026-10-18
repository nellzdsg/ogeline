// Предпросмотр: что программа собирается предложить как ответ (без обращения к ФИПИ).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { candidatesFor, plainText, formulaExpressions } from './lib/solvers.mjs';
import { getSubject } from './subjects.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[i + 1]?.startsWith('--') ? 'true' : argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const subject = getSubject(args.subject || 'math');
const file = path.join(ROOT, 'data', subject.key, 'tasks.ndjson');

const tasks = (await readFile(file, 'utf8'))
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const kind = args.kind || 'short';
const list = tasks.filter((t) => t.kind === kind && !t.answer);

const lines = [];
let solved = 0;
for (const t of list) {
  const candidates = candidatesFor(t);
  if (candidates.length) solved++;
  const text = plainText(t.stem).replace(/\s+/g, ' ').slice(0, 70);
  const formulas = formulaExpressions(t.stem).join(' ');
  lines.push(
    `${candidates.length ? '✓' : '·'} ${t.id} | ${formulas.slice(0, 45)} | ${text} | => ${candidates.join(' / ') || '—'}`,
  );
}

lines.unshift(`Заданий: ${list.length}, программа предлагает ответ для ${solved}`, '');
const dest = path.join(ROOT, 'data', subject.key, `preview-${kind}.txt`);
await writeFile(dest, lines.join('\n'), 'utf8');
console.log(lines.slice(0, 3).join('\n'));
console.log(`\nОтчёт: ${dest}`);
