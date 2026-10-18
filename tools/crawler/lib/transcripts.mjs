// Формулы, которые банк отдаёт картинкой.
//
// В открытом банке часть условий нарисована растровой картинкой: в HTML нет ни
// MathML, ни текста формулы. Такие формулы распознаны вручную и лежат в
// data/<предмет>/transcripts.json (id задания → выражение).
//
// Ошибка распознавания безопасна: ответ всё равно подтверждается у ФИПИ, и
// неверно прочитанная формула просто не пройдёт проверку.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const cache = new Map();

/** Распознанная формула для задания или null. */
export function transcribedFormula(task) {
  const subject = task?.subject || 'math';
  if (!cache.has(subject)) {
    try {
      const raw = readFileSync(path.join(ROOT, 'data', subject, 'transcripts.json'), 'utf8');
      cache.set(subject, JSON.parse(raw));
    } catch {
      cache.set(subject, {});
    }
  }
  return cache.get(subject)[task?.id] ?? null;
}

/** Все расшифровки предмета — для проверок при сборке. */
export function allTranscriptions(subject = 'math') {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, 'data', subject, 'transcripts.json'), 'utf8'));
  } catch {
    return {};
  }
}
