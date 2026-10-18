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
import { getSubject } from '../crawler/subjects.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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

  let mismatches = 0;
  let withoutAnswer = 0;
  const byPrototype = {};
  const prepared = [];
  const seen = new Set();

  for (const t of tasks) {
    if (!t.answer) withoutAnswer++;

    let analysis;
    try {
      analysis = describe(t);
    } catch (err) {
      analysis = { prototype: 'error', hints: [], steps: [`Ошибка разбора: ${err.message}`], answer: null };
    }
    byPrototype[analysis.prototype] = (byPrototype[analysis.prototype] || 0) + 1;

    if (analysis.answer && t.answer && normalize(analysis.answer) !== normalize(t.answer)) {
      mismatches++;
      console.warn(`  ! ${t.id}: программа даёт ${analysis.answer}, а подтверждённый ответ ${t.answer}`);
    }

    seen.add(t.theme);
    prepared.push({
      id: t.id,
      theme: t.theme,
      kes: t.kes.map((k) => k.split(' ')[0]),
      kind: t.kind,
      stem: t.stem,
      options: t.options,
      answer: t.answer ?? null,
      answerDigits: t.answer != null ? String(t.answer) : null,
      prototype: analysis.prototype,
      hints: analysis.hints,
      solution: analysis.steps,
    });
  }

  // Оставляем только темы, для которых есть задания, сохраняя структуру дерева.
  const themeInfo = new Map(meta.themes.map((th) => [th.code, th]));
  const counts = new Map();
  for (const t of prepared) counts.set(t.theme, (counts.get(t.theme) || 0) + 1);

  const themes = meta.themes
    .filter((th) => counts.has(th.code))
    .map((th) => ({
      code: th.code,
      title: th.title,
      level: th.level,
      count: counts.get(th.code) || 0,
    }));

  prepared.sort((a, b) => a.id.localeCompare(b.id));

  // Названия подтем (КЭС) — для подсказок в фильтрах.
  const usedKes = new Set(prepared.flatMap((t) => t.kes));
  const kesTitles = {};
  for (const th of meta.themes) if (usedKes.has(th.code)) kesTitles[th.code] = th.title;

  const out = {
    subject: meta.subject,
    title: meta.title,
    builtAt: new Date().toISOString(),
    source: 'Открытый банк заданий ОГЭ (ФИПИ)',
    themes,
    kesTitles,
    tasks: prepared,
  };

  await mkdir(path.join(webDir, 'data'), { recursive: true });
  await writeFile(path.join(webDir, 'data', `${subject.key}.json`), JSON.stringify(out), 'utf8');
  const mediaCount = await copyMedia(
    path.join(dataDir, 'media'),
    path.join(webDir, 'media'),
  );

  console.log(`[${subject.key}] Собрано заданий: ${prepared.length}`);
  console.log(`  тем: ${themes.length}, картинок: ${mediaCount}`);
  console.log(`  без подтверждённого ответа: ${withoutAnswer}`);
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
