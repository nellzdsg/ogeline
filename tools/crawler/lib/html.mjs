// Подготовка HTML задания к показу на сайте.
//
// Что делает:
//  1) находит картинки, которые банк вставляет скриптом ShowPictureQ(...), и превращает их
//     в обычные <img>, скачивая файлы к себе;
//  2) снимает префикс m: с тегов MathML (<m:math> -> <math>), чтобы формулы рисовались
//     браузером нативно, без внешних библиотек;
//  3) выкидывает скрипты и обработчики событий.

const MEDIA_RE = /\.(png|jpe?g|gif|svg|webp)$/i;

// Банк кладёт картинки задания в папку .../questions/<guid>/, но имя файла внутри
// папки бывает одно и то же у разных заданий (innerimg0.gif). Поэтому в локальное
// имя добавляем владельца картинки, иначе разные рисунки схлопнутся в один файл.
const QUESTION_RE = /\/questions\/([A-Za-z0-9]+)\//;

/** Короткая устойчивая метка строки (FNV-1a) — когда папки задания в пути нет. */
function shortHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function localMediaName(src) {
  const clean = src.split('?')[0];
  const base = clean.slice(clean.lastIndexOf('/') + 1).replace(/[^A-Za-z0-9_.-]/g, '_');
  const owner = (QUESTION_RE.exec(clean) || [])[1];
  const tag = owner ? owner.toUpperCase() : shortHash(clean);
  return `${tag}_${base}`;
}

/**
 * @param {string} html
 * @returns {{html: string, media: {src: string, name: string}[]}}
 */
export function extractMedia(html) {
  const media = [];
  const push = (src) => {
    const name = localMediaName(src);
    media.push({ src, name });
    return `<img class="q-img" src="media/${name}" alt="">`;
  };

  let out = String(html).replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_all, code) => {
    const calls = [...code.matchAll(/ShowPictureQ[A-Za-z0-9]*\s*\(([^)]*)\)/g)];
    if (!calls.length) return '';
    const imgs = [];
    for (const call of calls) {
      // Аргументы банк пишет и в одинарных, и в двойных кавычках.
      for (const arg of call[1].matchAll(/'([^']*)'|"([^"]*)"/g)) {
        const src = arg[1] || arg[2];
        if (src && MEDIA_RE.test(src)) imgs.push(push(src));
      }
    }
    return imgs.join('');
  });

  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = (tag.match(/src=["']([^"']+)["']/i) || [])[1];
    if (!src) return tag;
    if (/^(https?:|data:|media\/|\/)/i.test(src)) return tag;
    if (!MEDIA_RE.test(src)) return tag;
    return push(src);
  });

  return { html: out, media };
}

/** Убирает префикс m:, скрипты и обработчики событий. */
export function sanitize(html) {
  return String(html)
    .replace(/<(\/?)m:/g, '<$1')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<a\b[^>]*name=["'][^"']*["'][^>]*>\s*<\/a>/gi, '')
    .replace(/\s+on(?:click|load|error|mouseover|mouseout)\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+class=["']MsoNormal["']/gi, '')
    .replace(/\s+style=["']position:relative;[^"']*["']/gi, '')
    .trim();
}

/**
 * Полный цикл подготовки фрагмента задания.
 * @returns {{html: string, media: {src: string, name: string}[]}}
 */
export function prepareFragment(html) {
  const { html: withImgs, media } = extractMedia(html);
  return { html: sanitize(withImgs), media };
}
