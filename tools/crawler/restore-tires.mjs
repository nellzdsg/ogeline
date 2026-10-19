// Восстановление заводской маркировки шин.
//
// В карточках банка у заданий набора нет общего описания, где указана маркировка
// шин, установленных на заводе. Мы подбираем маркировку, при которой получается
// ровно тот же ответ, что подтвердил ФИПИ, и дописываем её в условие с пометкой
// «условие дополнено».

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { plainText } from './lib/solvers.mjs';
import { collectMarkings, collectTables, markingText, solveTire, reconstructFactory, wheelDiameter } from './lib/tires.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = path.join(ROOT, 'data', 'math', 'tasks.ndjson');

const tasks = (await readFile(file, 'utf8'))
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const markings = collectMarkings(tasks);
const tables = collectTables(tasks);
console.log(`маркировок для подбора: ${markings.length}, таблиц: ${tables.length}`);

let restored = 0;
const failed = [];

for (const task of tasks) {
  if (!task.answer) continue;
  const text = plainText(task.stem);
  const tire = solveTire(text, task.stem);
  if (!tire || !['factory', 'diameter', 'percent'].includes(tire.type)) continue;
  if (task.tireFactory) continue;

  const marking = reconstructFactory(tire, task.answer, markings, tables);
  if (!marking) {
    failed.push({ id: task.id, type: tire.type, answer: task.answer });
    continue;
  }

  // Проверяем, что восстановленная маркировка даёт ровно подтверждённый ответ.
  const dOld = wheelDiameter(marking);
  const dNew = tire.marking ? wheelDiameter(tire.marking) : null;
  let value = null;
  if (tire.type === 'factory') value = dOld;
  if (tire.type === 'diameter') value = Math.abs(dNew - dOld);
  if (tire.type === 'percent') value = Math.round(Math.abs(dNew / dOld - 1) * 1000) / 10;

  if (Math.abs(value - Number(String(task.answer).replace(',', '.'))) > 1e-6) {
    failed.push({ id: task.id, type: tire.type, answer: task.answer, value });
    continue;
  }

  task.tireFactory = markingText(marking);
  task.addedCondition = `Заводская маркировка шин — ${markingText(marking)}.`;
  restored++;
}

await writeFile(file, tasks.map((t) => JSON.stringify(t)).join('\n') + '\n', 'utf8');

console.log(`\nвосстановлено маркировок: ${restored}`);
if (failed.length) {
  console.log(`не удалось восстановить: ${failed.length}`);
  for (const f of failed) console.log(`  ? ${f.id} (${f.type}), ответ ${f.answer}${f.value != null ? `, получилось ${f.value}` : ''}`);
}
