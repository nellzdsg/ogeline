// Отчёт «что готово к публикации»: для каждого задания считаем, предлагает ли
// программа ответ (candidatesFor) и даёт ли осмысленный разбор (describe), не
// обращаясь к ФИПИ. Нужен, чтобы видеть, сколько заданий ждёт только
// подтверждения ответа оракулом.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { candidatesFor, plainText } from './lib/solvers.mjs';
import { describe } from '../build/prototypes.mjs';
import { groupOf } from '../build/numbers.mjs';
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

const themes = args.theme ? String(args.theme).split(',').map((s) => s.trim()) : null;
const list = tasks.filter((t) => !t.answer && (!themes || themes.includes(String(t.theme))));

const rows = [];
const byTheme = new Map();
const byNumber = new Map();
const genericByTheme = new Map();

for (const t of list) {
  const candidates = candidatesFor(t);
  let prototype = 'error';
  try {
    prototype = describe(t).prototype;
  } catch {
    prototype = 'error';
  }
  const ready = Boolean(candidates.length) && prototype !== 'generic' && prototype !== 'error';

  const themeStat = byTheme.get(t.theme) || { total: 0, candidates: 0, explained: 0, ready: 0 };
  themeStat.total++;
  if (candidates.length) themeStat.candidates++;
  if (prototype !== 'generic' && prototype !== 'error') themeStat.explained++;
  if (ready) themeStat.ready++;
  byTheme.set(t.theme, themeStat);

  if (prototype === 'generic') {
    const g = genericByTheme.get(t.theme) || new Map();
    g.set(t.kind, (g.get(t.kind) || 0) + 1);
    genericByTheme.set(t.theme, g);
  }

  const number = groupOf(subject.key, t) || '—';
  const nStat = byNumber.get(number) || { total: 0, ready: 0 };
  nStat.total++;
  if (ready) nStat.ready++;
  byNumber.set(number, nStat);

  rows.push(
    `${ready ? '✓' : '·'} тема ${t.theme} | ${t.id} | ${t.kind} | №${number} | ${prototype} | ` +
      `${(candidates.join(' / ') || '—').slice(0, 30)} | ${plainText(t.stem).replace(/\s+/g, ' ').slice(0, 80)}`,
  );
}

console.log(`Заданий без ответа: ${list.length}`);
for (const [theme, s] of [...byTheme].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(
    `  тема ${theme}: ${s.total}, есть кандидат ${s.candidates}, есть разбор ${s.explained}, готово ${s.ready}`,
  );
  const g = genericByTheme.get(theme);
  if (g) console.log(`    без разбора: ${[...g].map(([k, v]) => `${k}=${v}`).join(', ')}`);
}

const dest = path.join(ROOT, 'data', subject.key, `readiness-${themes ? themes.join('_') : 'all'}.txt`);
await import('node:fs/promises').then((fs) => fs.writeFile(dest, rows.join('\n') + '\n', 'utf8'));
console.log(`\nОтчёт: ${dest}`);
