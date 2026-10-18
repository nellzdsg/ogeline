// Диагностика решателя по одному заданию: что программа «поняла» из условия.
// node tools/crawler/debug-task.mjs --subject math --id FD331C

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formulaExpressions, plainText, variablesIn, insertImplicitProducts } from './lib/solvers.mjs';
import { getSubject } from './subjects.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      args[a.slice(2)] = next === undefined || next.startsWith('--') ? 'true' : argv[++i];
    }
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

const task = args.id ? tasks.find((t) => t.id === args.id) : tasks.find((t) => t.kind === 'short');
if (!task) throw new Error('Задание не найдено');

const text = plainText(task.stem).replace(/\s+/g, ' ');
console.log('id:', task.id, '| тип:', task.kind);
console.log('текст:', text);
console.log('формулы:', formulaExpressions(task.stem));
console.log('переменные:', variablesIn(formulaExpressions(task.stem).find((e) => e.includes('='))?.split('=').slice(1).join('=') ?? ''));
console.log('неявное умножение:', insertImplicitProducts(formulaExpressions(task.stem).find((e) => e.includes('=')) ?? ''));
if (args.raw) {
  const { writeFile } = await import('node:fs/promises');
  const dest = path.join(ROOT, 'data', subject.key, 'debug-raw.html');
  await writeFile(dest, task.stem, 'utf8');
  console.log('\nсырое условие записано в', dest);
}
