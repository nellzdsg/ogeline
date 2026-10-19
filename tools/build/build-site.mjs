// Сборка данных сайта из результатов обхода банка.
//
//   data/math/tasks.ndjson  +  prototype-разбор  ->  web/data/math.json
//
// Заодно копирует картинки заданий в web/media, чтобы сайт был полностью
// статическим и работал без обращения к ФИПИ.

import { mkdir, readFile, writeFile, readdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe } from './prototypes.mjs';
import { groupsFor, groupOf, variationOf } from './numbers.mjs';
import { SUBJECTS, getSubject } from '../crawler/subjects.mjs';
import { allTranscriptions } from '../crawler/lib/transcripts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function fileExists(p) {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Пишем список предметов для стартового меню: показываем все предметы ОГЭ,
 * но задания есть только у тех, для которых уже собирали данные.
 */
async function writeSubjectsIndex(webDir, current) {
  const file = path.join(webDir, 'data', 'subjects.json');
  let previous = { subjects: [] };
  try {
    previous = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    /* файла ещё нет */
  }
  const known = new Map((previous.subjects || []).map((s) => [s.key, s]));

  const subjects = [];
  for (const [key, info] of Object.entries(SUBJECTS)) {
    const ready = await fileExists(path.join(webDir, 'data', `${key}.json`));
    const old = known.get(key) || {};
    subjects.push({
      key,
      title: info.title,
      ready,
      tasks: key === current.subject ? current.tasks : ready ? (old.tasks ?? 0) : 0,
    });
  }

  await writeFile(file, JSON.stringify({ builtAt: new Date().toISOString(), subjects }), 'utf8');
  return subjects;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[i + 1]?.startsWith('--') ? 'true' : argv[++i];
  }
  return args;
}

const normalize = (s) => (s == null ? s : String(s).replace(/\./g, ',').trim());

async function copyMedia(srcDir, destDir) {
  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });
  let names = [];
  try {
    names = await readdir(srcDir);
  } catch {
    return 0;
  }
  let n = 0;
  for (const name of names) {
    await copyFile(path.join(srcDir, name), path.join(destDir, name));
    n++;
  }
  return n;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const subject = getSubject(args.subject || 'math');
  const dataDir = path.join(ROOT, 'data', subject.key);
  const webDir = path.join(ROOT, 'web');

  const meta = JSON.parse(await readFile(path.join(dataDir, 'meta.json'), 'utf8'));

  const raw = await readFile(path.join(dataDir, 'tasks.ndjson'), 'utf8');
  const tasks = raw
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  if (!tasks.length) throw new Error('Нет заданий — сначала запустите обход банка (npm run crawl).');

  // Расшифровки картинок-формул должны указывать на реальные задания: опечатка
  // в id иначе молча оставит задание без разбора.
  const transcripts = allTranscriptions(subject.key);
  const knownIds = new Set(tasks.map((t) => t.id));
  const unknownIds = Object.keys(transcripts).filter((id) => !knownIds.has(id));
  if (unknownIds.length) {
    throw new Error(
      `В transcripts.json есть неизвестные задания: ${unknownIds.join(', ')}. Поправьте id или удалите строку.`,
    );
  }
  const usedTranscripts = tasks.filter((t) => transcripts[t.id]).length;
  console.log(`  расшифровок картинок-формул: ${Object.keys(transcripts).length} (использовано ${usedTranscripts})`);

  let mismatches = 0;
  let noAnswer = 0;
  let noPrototype = 0;
  const byPrototype = {};
  const prepared = [];
  const seen = new Set();
  const groupCounts = new Map();
  const variationCounts = new Map();
  const unmapped = [];

  // На сайт попадает только задание, которое можно проверить и объяснить:
  // есть подтверждённый у ФИПИ ответ и разбор не «заглушка».
  const progress = new Map();
  const count = (code, field) => {
    if (!progress.has(code)) progress.set(code, { total: 0, published: 0, noAnswer: 0, noPrototype: 0 });
    progress.get(code)[field]++;
  };
  for (const t of tasks) count(t.theme, 'total');

  for (const t of tasks) {
    if (!t.answer) {
      noAnswer++;
      count(t.theme, 'noAnswer');
      continue;
    }

    let analysis;
    try {
      analysis = describe(t);
    } catch (err) {
      analysis = { prototype: 'error', hints: [], steps: [`Ошибка разбора: ${err.message}`], answer: null };
    }
    if (analysis.prototype === 'generic') {
      noPrototype++;
      count(t.theme, 'noPrototype');
      continue;
    }
    byPrototype[analysis.prototype] = (byPrototype[analysis.prototype] || 0) + 1;

    if (analysis.answer && t.answer && normalize(analysis.answer) !== normalize(t.answer)) {
      mismatches++;
      console.warn(`  ! ${t.id}: программа даёт ${analysis.answer}, а подтверждённый ответ ${t.answer}`);
    }

    count(t.theme, 'published');
    seen.add(t.theme);

    // Номер задания ОГЭ (позиция в экзаменационной работе), а не код КЭС.
    const number = groupOf(subject.key, t);
    if (!number) {
      unmapped.push(t.id);
    } else {
      groupCounts.set(number, (groupCounts.get(number) || 0) + 1);
    }
    const variation = variationOf(subject.key, t, number, analysis.prototype);
    if (variation) variationCounts.set(variation, (variationCounts.get(variation) || 0) + 1);

    prepared.push({
      id: t.id,
      theme: t.theme,
      number,
      variation,
      kind: t.kind,
      stem: t.stem,
      added: t.addedCondition || null,
      options: t.options,
      answer: t.answer ?? null,
      answerDigits: t.answer != null ? String(t.answer) : null,
      prototype: analysis.prototype,
      hints: analysis.hints,
      solution: analysis.steps,
    });
  }

  if (unmapped.length) {
    console.warn(`  ! заданий без номера ОГЭ: ${unmapped.length} (${unmapped.slice(0, 5).join(', ')}…)`);
  }

  for (const [code, info] of progress) {
    if (info.noAnswer || info.noPrototype) {
      console.log(
        `  ~ тема ${code}: готово ${info.published} из ${info.total}` +
          (info.noAnswer ? `, без ответа ${info.noAnswer}` : '') +
          (info.noPrototype ? `, без разбора ${info.noPrototype}` : ''),
      );
    }
  }

  // Стабильный порядок заданий: по id.
  prepared.sort((a, b) => a.id.localeCompare(b.id));

  // Карточки номеров: показываем всю структуру работы, даже если заданий по
  // номеру ещё нет — так видно, что будет дальше.
  const numbers = groupsFor(subject.key).map((g) => ({
    ...g,
    count: groupCounts.get(g.id) || 0,
  }));

  // Сюжеты практических задач (номера 1–5).
  const variations = [...variationCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const out = {
    subject: meta.subject,
    title: meta.title,
    builtAt: new Date().toISOString(),
    source: 'Открытый банк заданий ОГЭ (ФИПИ)',
    numbers,
    variations,
    tasks: prepared,
  };

  await mkdir(path.join(webDir, 'data'), { recursive: true });
  await writeFile(path.join(webDir, 'data', `${subject.key}.json`), JSON.stringify(out), 'utf8');
  const mediaCount = await copyMedia(
    path.join(dataDir, 'media'),
    path.join(webDir, 'media'),
  );
  await writeSubjectsIndex(webDir, { subject: subject.key, tasks: prepared.length });

  console.log(`[${subject.key}] Собрано заданий: ${prepared.length}`);
  console.log(`  картинок: ${mediaCount}`);
  console.log('  по номерам ОГЭ:');
  for (const g of numbers) console.log(`    ${g.label.padEnd(10)} ${String(g.count).padStart(4)}  ${g.title}`);
  if (variations.length) {
    console.log('  подписи внутри карточек:');
    for (const v of variations) console.log(`    ${v.label.padEnd(24)} ${v.count}`);
  }
  console.log(`  без подтверждённого ответа: ${noAnswer}`);
  console.log(`  без разбора: ${noPrototype}`);
  console.log(`  расхождений с подтверждённым ответом: ${mismatches}`);
  console.log('  по прототипам:');
  for (const [proto, n] of Object.entries(byPrototype).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${proto.padEnd(24)} ${n}`);
  }
}

main().catch((err) => {
  console.error('\nОшибка:', err.message);
  process.exit(1);
});
