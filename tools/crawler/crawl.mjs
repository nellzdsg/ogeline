// Краулер открытого банка ФИПИ.
//
// Примеры:
//   node tools/crawler/crawl.mjs --subject math --theme 1 --rounds 3
//   node tools/crawler/crawl.mjs --subject math --theme all --pages 8 --rounds 2
//
// Задания одного и того же «Номера» банк выдаёт разными вариантами при каждом обходе,
// поэтому повторные раунды увеличивают коллекцию. Дубли отсекаются по guid.

import { mkdir, readFile, appendFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { req, openSession, fetchTaskPage, fetchBinary, sleepMs, SITE } from './lib/http.mjs';
import { parseTaskList, parseThemes, parseTotal, KIND_LABELS } from './lib/parse.mjs';
import { prepareFragment } from './lib/html.mjs';
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

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadKnownGuids(file) {
  const known = new Map();
  if (!(await exists(file))) return known;
  const text = await readFile(file, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const t = JSON.parse(line);
      known.set(t.guid, t);
    } catch {
      /* битая строка — пропускаем */
    }
  }
  return known;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const subject = getSubject(args.subject || 'math');
  const rounds = Number(args.rounds || 1);
  const pages = Number(args.pages || 5);
  const pagesize = Number(args.pagesize || 50);
  const themeArg = args.theme || 'all';

  const outDir = path.join(ROOT, 'data', subject.key);
  const mediaDir = path.join(outDir, 'media');
  const tasksFile = path.join(outDir, 'tasks.ndjson');
  await mkdir(mediaDir, { recursive: true });

  const known = await loadKnownGuids(tasksFile);
  console.log(`[${subject.key}] Уже собрано заданий: ${known.size}`);

  console.log(`[${subject.key}] Открываю сессию…`);
  const indexHtml = await openSession(subject.proj);

  const themes = parseThemes(indexHtml);
  const allThemes = themeArg === 'all' ? themes.filter((t) => t.level === 1) : themes.filter((t) => t.code === themeArg);
  if (!allThemes.length) throw new Error(`Тема «${themeArg}» не найдена. Есть: ${themes.map((t) => t.code).join(', ')}`);

  const meta = {
    subject: subject.key,
    title: subject.title,
    proj: subject.proj,
    themes,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  let added = 0;
  let downloaded = 0;
  const startedAt = Date.now();

  for (const theme of allThemes) {
    for (let round = 1; round <= rounds; round++) {
      for (let page = 1; page <= pages; page++) {
        let html;
        try {
          html = await fetchTaskPage(subject.proj, { theme: theme.code, page, pagesize });
        } catch (err) {
          console.warn(`  ! тема ${theme.code}, стр. ${page}: ${err.message}`);
          continue;
        }

        const total = parseTotal(html);
        const tasks = parseTaskList(html);
        if (page === 1 && round === 1) {
          console.log(`\nТема ${theme.code} «${theme.title}» — всего заданий в банке: ${total}`);
        }

        for (const task of tasks) {
          if (known.has(task.guid)) continue;

          const stem = prepareFragment(task.stemHtml);
          const options = task.options
            ? task.options.map((o) => ({ n: o.n, html: prepareFragment(o.html).html }))
            : null;

          const allMedia = [...stem.media];
          if (task.options) {
            for (const o of task.options) {
              const frag = prepareFragment(o.html);
              allMedia.push(...frag.media);
            }
          }
          const uniqMedia = [...new Map(allMedia.map((m) => [m.name, m])).values()];

          for (const media of uniqMedia) {
            const dest = path.join(mediaDir, media.name);
            if (await exists(dest)) continue;
            try {
              const { status, buf } = await fetchBinary(`${SITE}/${media.src}`);
              if (status === 200) {
                await writeFile(dest, buf);
                downloaded++;
              } else {
                console.warn(`  ! картинка ${media.src}: HTTP ${status}`);
              }
            } catch (err) {
              console.warn(`  ! картинка ${media.src}: ${err.message}`);
            }
          }

          const record = {
            id: task.id,
            guid: task.guid,
            subject: subject.key,
            theme: theme.code,
            kes: task.kes,
            kind: task.kind,
            hint: task.hint,
            stem: stem.html,
            options,
            media: uniqMedia.map((m) => m.name),
            answer: null,
            answerChecked: false,
            addedAt: new Date().toISOString(),
          };

          await appendFile(tasksFile, JSON.stringify(record) + '\n', 'utf8');
          known.set(task.guid, record);
          added++;

          if (added % 25 === 0) {
            const sec = ((Date.now() - startedAt) / 1000).toFixed(0);
            console.log(`  + ${added} новых заданий, картинок ${downloaded} (${sec} с)`);
          }
        }

        await sleepMs(120);
      }
    }
  }

  const byKind = {};
  for (const t of known.values()) byKind[t.kind] = (byKind[t.kind] || 0) + 1;

  console.log(`\n[${subject.key}] Готово.`);
  console.log(`  всего заданий: ${known.size} (новых ${added})`);
  console.log(`  картинок скачано: ${downloaded}`);
  console.log('  по типам:');
  for (const [kind, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${(KIND_LABELS[kind] || kind).padEnd(28)} ${n}`);
  }
}

main().catch((err) => {
  console.error('\nОшибка:', err.message);
  process.exit(1);
});
