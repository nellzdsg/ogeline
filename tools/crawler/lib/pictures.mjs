// Расшифровка картинок, которые банк вставляет прямо в текст условия.
//
// Числа вроде «–6 °C» или «8 °C» ФИПИ отдаёт растровой картинкой: ни MathML, ни
// текста нет. Такие картинки распознаны вручную и лежат в
// data/<предмет>/pictures.json (имя файла → текст на картинке).
//
// Ошибка распознавания безопасна: ответ всё равно подтверждается у ФИПИ.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const cache = new Map();

function table(subject) {
  if (!cache.has(subject)) {
    try {
      cache.set(subject, JSON.parse(readFileSync(path.join(ROOT, 'data', subject, 'pictures.json'), 'utf8')));
    } catch {
      cache.set(subject, {});
    }
  }
  return cache.get(subject);
}

/** Текст картинки или null, если он не распознан. */
export function pictureText(name, subject = 'math') {
  return table(subject)[name] ?? null;
}

/** Заменяет в HTML картинки условия на распознанный текст. */
export function inlinePictureText(html, subject = 'math') {
  return String(html).replace(/<img\b[^>]*>/gi, (tag) => {
    const src = (tag.match(/src="([^"]+)"/i) || [])[1];
    if (!src) return ' ';
    const name = src.split('/').pop();
    const text = pictureText(name, subject);
    return text ? ` ${text} ` : ' ';
  });
}
