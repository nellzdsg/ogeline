// Отчёт по заданиям: читаемое условие + формулы.
// Нужен, чтобы глазами оценивать классы заданий и проверять работу конвертера формул.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFragment, toPretty, extractMathBlocks } from './lib/mathml.mjs';
import { decodeEntities, stripTags } from './lib/parse.mjs';
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

/** Читаемое представление условия: формулы заменяются на линейную запись. */
export function readableStem(html) {
  let text = String(html);
  for (const block of extractMathBlocks(text)) {
    const pretty = parseFragment(block).children.map(toPretty).join('');
    text = text.replace(block, `«${pretty.trim()}»`);
  }
  text = text.replace(/<img\b[^>]*>/gi, '[РИСУНОК]');
  return decodeEntities(stripTags(text));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const subject = getSubject(args.subject || 'math');
  const file = path.join(ROOT, 'data', subject.key, 'tasks.ndjson');

  const tasks = (await readFile(file, 'utf8'))
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

  const kind = args.kind || 'short';
  const onlyTheme = args.theme && args.theme !== 'all' ? String(args.theme) : null;
  const list = tasks.filter((t) => t.kind === kind && (!onlyTheme || t.theme === onlyTheme));

  const out = [`Всего заданий «${kind}»: ${list.length}`, ''];
  for (const t of list) {
    out.push(`--- ${t.id} | КЭС: ${t.kes.map((k) => k.split(' ')[0]).join(', ')}`);
    out.push(readableStem(t.stem));
    out.push('');
  }

  const dest = path.join(ROOT, 'data', subject.key, `report-${kind}.txt`);
  await writeFile(dest, out.join('\n'), 'utf8');
  console.log(`Отчёт: ${dest} (${list.length} заданий)`);
}

main().catch((err) => {
  console.error('Ошибка:', err.message);
  process.exit(1);
});
