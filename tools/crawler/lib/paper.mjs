// Задания про листы бумаги (ОГЭ, номера 1–5).
//
// Форматы А0…А6: каждый следующий лист получается складыванием предыдущего
// пополам, поэтому площадь уменьшается вдвое, а линейные размеры — в √2 раз.

/** Длинная и короткая стороны листа в миллиметрах. */
const FORMATS = {
  0: [1189, 841],
  1: [841, 594],
  2: [594, 420],
  3: [420, 297],
  4: [297, 210],
  5: [210, 148],
  6: [148, 105],
};

export const formatSize = (n) => FORMATS[n] || null;

export function tableRows(html) {
  const table = (String(html).match(/<table[\s\S]*?<\/table>/i) || [])[0];
  if (!table) return [];
  return [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      cell[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    ),
  );
}

/**
 * Разбирает задание про листы бумаги.
 * @returns {null | {type: string, text?: string, values?: number[], details?: object}}
 */
export function solvePaper(text) {
  const t = String(text);

  // «Установите соответствие между форматами и номерами листов…»
  if (/установите соответствие/i.test(t) && /формат/i.test(t)) {
    return { type: 'match', details: { formats: requestedFormats(t) } };
  }

  // «Сколько листов формата А5 получится из одного листа формата А3?»
  const count = t.match(/сколько листов формата\s*А\s*(\d)\s*получится из одного листа формата\s*А\s*(\d)/i);
  if (count) {
    const to = Number(count[1]);
    const from = Number(count[2]);
    if (FORMATS[to] && FORMATS[from] && to > from) {
      return { type: 'count', values: [2 ** (to - from)], details: { to, from } };
    }
  }

  // «Найдите площадь листа формата А3…»
  const area = t.match(/площадь листа формата\s*А\s*(\d)/i);
  if (area && FORMATS[Number(area[1])]) {
    const [long, short] = FORMATS[Number(area[1])];
    return { type: 'area', values: [(long * short) / 100], details: { format: Number(area[1]), long, short } };
  }

  // «Найдите ширину (длину) листа бумаги формата А0…»
  const side = t.match(/(ширину|длину) листа бумаги формата\s*А\s*(\d)/i);
  if (side && FORMATS[Number(side[2])]) {
    const format = Number(side[2]);
    const [long, short] = FORMATS[format];
    const value = /ширин/i.test(side[1]) ? short : long;
    return {
      type: 'side',
      values: [Math.round(value / 10) * 10],
      details: { format, side: /ширин/i.test(side[1]) ? 'width' : 'length', value },
    };
  }

  // «Найдите отношение длины меньшей стороны листа формата А4 к большей…»
  const ratio = t.match(/отношение длины (меньшей|большей) стороны листа формата\s*А\s*(\d) к (меньшей|большей)/i);
  if (ratio && FORMATS[Number(ratio[2])]) {
    const [long, short] = FORMATS[Number(ratio[2])];
    const value = /меньшей/i.test(ratio[1]) ? short / long : long / short;
    return {
      type: 'ratio',
      values: [Math.round(value * 10) / 10],
      details: { format: Number(ratio[2]), kind: /меньшей/i.test(ratio[1]) ? 'short-long' : 'long-short', value },
    };
  }

  // «Бумагу формата А5 упаковали в пачки по 500 листов… масса 1 кв. м равна 80 г…»
  const mass = t.match(
    /формата\s*А\s*(\d)[\s\S]*?по\s*(\d+)\s*листов[\s\S]*?1\s*кв\.?\s*м равна\s*(\d+)\s*г/i,
  );
  if (mass && FORMATS[Number(mass[1])]) {
    const format = Number(mass[1]);
    const count = Number(mass[2]);
    const grams = Number(mass[3]);
    const [long, short] = FORMATS[format];
    const value = (long / 1000) * (short / 1000) * count * grams;
    return { type: 'mass', values: [Math.round(value * 100) / 100], details: { format, count, grams, long, short } };
  }

  // «Какой высоты нужен шрифт… на листе формата А3 так же, как … шрифтом 15 пунктов на листе формата А4?»
  const font = t.match(
    /листе формата\s*А\s*(\d)[\s\S]*?шрифтом высотой\s*(\d+)\s*пунктов на листе формата\s*А\s*(\d)/i,
  );
  if (font) {
    const target = Number(font[1]);
    const size = Number(font[2]);
    const base = Number(font[3]);
    if (FORMATS[target] && FORMATS[base]) {
      const value = size * 2 ** ((base - target) / 2);
      return { type: 'font', values: [Math.round(value)], details: { target, base, size, value } };
    }
  }

  return null;
}

/** Форматы из последней строки задания — той, что заполняет ученик. */
function requestedFormats(text) {
  const all = [...String(text).matchAll(/А\s*(\d)/g)].map((m) => Number(m[1]));
  return all.slice(-4);
}

/** Ответ для задания «установите соответствие» по разобранной таблице. */
export function matchAnswer(html, formats) {
  const rows = tableRows(html)
    .map((cells) => ({
      number: Number(cells[0]),
      long: Number(cells[1]),
      short: Number(cells[2]),
    }))
    .filter((r) => Number.isFinite(r.number) && Number.isFinite(r.long) && Number.isFinite(r.short));

  const digits = formats.map((format) => {
    const size = FORMATS[format];
    if (!size) return null;
    const row = rows.find(
      (r) => (r.long === size[0] && r.short === size[1]) || (r.long === size[1] && r.short === size[0]),
    );
    return row ? String(row.number) : null;
  });

  return digits.every(Boolean) ? digits.join('') : null;
}
