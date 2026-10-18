// Сбор правильных ответов.
//
// Идея: ФИПИ не отдаёт правильный ответ, но отдаёт вердикт «верно/неверно».
// Значит ответ можно либо перебрать (задания с выбором ответа), либо вычислить
// и подтвердить через ФИПИ. Второго шанса на ошибку нет: если ответ не подтверждён,
// он в базу не попадает.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openSession, checkAnswer, sleepMs } from './lib/http.mjs';
import { candidatesFor } from './lib/solvers.mjs';
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

function combinations(items, size) {
  const result = [];
  const walk = (start, acc) => {
    if (acc.length === size) {
      result.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return result;
}

/** Подбирает ответ: перебором вариантов или вычислением + проверкой. */
async function harvestAnswer(proj, task) {
  if (task.kind === 'short') {
    const candidates = candidatesFor(task);
    for (const candidate of candidates) {
      if (await checkAnswer(proj, task.guid, candidate)) {
        return { answer: candidate, method: 'вычислено и проверено' };
      }
    }
    return null;
  }

  if (!task.options) return null;
  const numbers = task.options.map((o) => o.n);

  if (task.kind === 'choice') {
    for (const n of numbers) {
      if (await checkAnswer(proj, task.guid, String(n))) return { answer: String(n), method: 'перебор' };
    }
    return null;
  }

  if (task.kind === 'multi') {
    for (let size = 1; size <= numbers.length; size++) {
      for (const combo of combinations(numbers, size)) {
        const answer = combo.join('');
        if (await checkAnswer(proj, task.guid, answer)) return { answer, method: 'перебор' };
      }
    }
    return null;
  }

  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const subject = getSubject(args.subject || 'math');
  const file = path.join(ROOT, 'data', subject.key, 'tasks.ndjson');

  const raw = await readFile(file, 'utf8');
  const tasks = raw
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

  const onlyTheme = args.theme && args.theme !== 'all' ? String(args.theme) : null;
  const kinds = (args.kinds || 'choice,multi').split(',').map((s) => s.trim());

  const targets = tasks.filter(
    (t) => kinds.includes(t.kind) && !t.answer && (!onlyTheme || t.theme === onlyTheme),
  );

  console.log(`Заданий к обработке: ${targets.length} (предмет ${subject.key})`);
  if (!targets.length) return;

  await openSession(subject.proj);

  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (const task of targets) {
    let result = null;
    try {
      result = await harvestAnswer(subject.proj, task);
    } catch (err) {
      console.warn(`  ! ${task.id}: ${err.message}`);
    }

    task.answerChecked = true;
    if (result) {
      task.answer = result.answer;
      task.answerMethod = result.method;
      task.answerCheckedAt = new Date().toISOString();
      delete task.answerFailed;
    } else {
      task.answerChecked = false;
      task.answerFailed = true;
      failed++;
      console.warn(`  ? не удалось определить ответ: ${task.id} (${task.kind})`);
    }

    done++;
    if (done % 20 === 0) {
      const sec = ((Date.now() - startedAt) / 1000).toFixed(0);
      console.log(`  обработано ${done}/${targets.length}, без ответа ${failed} (${sec} с)`);
      await save(file, tasks);
    }
    await sleepMs(60);
  }

  await save(file, tasks);
  console.log(`\nГотово. Обработано ${done}, без ответа ${failed}.`);
}

async function save(file, tasks) {
  await writeFile(file, tasks.map((t) => JSON.stringify(t)).join('\n') + '\n', 'utf8');
}

main().catch((err) => {
  console.error('\nОшибка:', err.message);
  process.exit(1);
});
