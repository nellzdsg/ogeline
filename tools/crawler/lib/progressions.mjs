// Задания на последовательности и прогрессии (номер 14 ОГЭ).
//
// Все сюжеты банка — это либо арифметическая прогрессия (амфитеатр, торможение,
// разгон поезда, остывание), либо геометрическая (радиоактивный распад, рост
// бактерий, отскакивающий мячик). Формулы школьные, поэтому ответ считается
// точно, а подтверждает его оракул ФИПИ.

const WORD_NUM = {
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  полтора: 1.5,
};

const WORD_PAT = Object.keys(WORD_NUM).join('|');
/** Число: цифрами (возможно «4 800» и «4,5») или словом («два»). */
const NUM = String.raw`(?:\d[\d\s]*(?:[.,]\d+)?|${WORD_PAT})`;

const num = (s) => {
  const w = String(s).trim().toLowerCase();
  if (w in WORD_NUM) return WORD_NUM[w];
  const v = Number(w.replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};

const round = (v, digits = 6) => Math.round(v * 10 ** digits) / 10 ** digits;

const ORDINALS = {
  перв: 1,
  втор: 2,
  трет: 3,
  четвёрт: 4,
  четверт: 4,
  пят: 5,
  шест: 6,
  седьм: 7,
  восьм: 8,
  девят: 9,
  десят: 10,
  одиннадцат: 11,
  двенадцат: 12,
};

function ordinalOf(word) {
  const w = String(word).toLowerCase().replace(/[^а-яё\d]/g, '');
  if (/^\d+$/.test(w)) return Number(w);
  for (const [stem, n] of Object.entries(ORDINALS)) if (w.startsWith(stem)) return n;
  return null;
}

const termOf = (a1, d, n) => a1 + (n - 1) * d;
const sumOf = (a1, d, n) => (n * (2 * a1 + (n - 1) * d)) / 2;

/** Переводит время к минутам. */
const toMinutes = (value, unit) => {
  const u = String(unit).toLowerCase();
  if (u.startsWith('час')) return value * 60;
  if (u.startsWith('сут')) return value * 1440;
  return value;
};

/**
 * @returns {null | {type: string, values: number[], details: object}}
 */
export function solveProgressions(text) {
  const t = String(text).replace(/\s+/g, ' ').trim();

  // --- Арифметическая прогрессия -------------------------------------------------
  const rows = t.match(/(\d+)\s+ряд(?:ов|а|)(?![а-яё])/i);

  // «В амфитеатре 13 рядов. В первом ряду 18 мест, а в каждом следующем на 2 места больше…»
  const first = t.match(
    new RegExp(`В первом ряду\\s+(${NUM})\\s+мест[а-яё]*\\s*,?\\s*а в каждом следующем на\\s+(${NUM})\\s+мест`, 'i'),
  );

  if (first && rows) {
    const a1 = num(first[1]);
    const d = num(first[2]);
    const n = Number(rows[1]);
    const last = termOf(a1, d, n);
    const total = sumOf(a1, d, n);
    const wantTotal = /всего мест|всего\b/i.test(t) && !/в последнем ряду/i.test(t);
    return {
      type: 'arith-rows',
      values: wantTotal ? [total, last] : [last, total],
      details: { a1, d, n, last: round(last), total: round(total), wantTotal },
    };
  }

  // «…на одно и то же число мест больше… В шестом ряду 26 мест, а в восьмом ряду 30 мест…»
  const two = t.match(
    new RegExp(
      `в ([а-яё]+|\\d+)\\s*-?\\s*м?\\s*ряду\\s+(${NUM})\\s+мест[а-яё]*\\s*,?\\s*а в ([а-яё]+|\\d+)\\s*-?\\s*м?\\s*ряду\\s+(${NUM})\\s+мест`,
      'i',
    ),
  );

  if (two && rows && /одно и то же число мест|одинаков/i.test(t)) {
    const k1 = ordinalOf(two[1]);
    const v1 = num(two[2]);
    const k2 = ordinalOf(two[3]);
    const v2 = num(two[4]);
    const n = Number(rows[1]);
    if (k1 && k2 && k2 !== k1 && n) {
      const d = (v2 - v1) / (k2 - k1);
      const a1 = v1 - (k1 - 1) * d;
      const last = termOf(a1, d, n);
      const total = sumOf(a1, d, n);
      const wantTotal = /всего мест|всего\b/i.test(t) && !/в последнем ряду/i.test(t);
      return {
        type: 'arith-rows',
        values: wantTotal ? [total, last] : [last, total],
        details: { a1, d, n, last: round(last), total: round(total), wantTotal, known: [[k1, v1], [k2, v2]] },
      };
    }
  }

  // Торможение и разгон поезда: «За первую секунду 30 м, а за каждую следующую на 4 м меньше…»
  const motion = t.match(
    new RegExp(
      `За (?:первую секунду|секунду после начала [а-яё]+)[^.]*?(${NUM})\\s*м[^.]*?а за каждую следующую[^.]*?(${NUM})\\s*м\\s*(меньше|больше)`,
      'i',
    ),
  );
  const seconds = t.match(/за первые\s+(\d+)\s+секунд/i);

  if (motion && seconds) {
    const a1 = num(motion[1]);
    const delta = num(motion[2]);
    const d = /меньше/i.test(motion[3]) ? -delta : delta;
    const n = Number(seconds[1]);
    const total = sumOf(a1, d, n);
    const last = termOf(a1, d, n);
    const wantTotal = /за первые/i.test(t);
    return {
      type: 'arith-motion',
      values: wantTotal ? [total, last] : [last, total],
      details: { a1, d, n, last: round(last), total: round(total), wantTotal },
    };
  }

  // «…Сколько метров автомобиль прошёл до полной остановки?» — суммируем, пока
  // путь за очередную секунду остаётся положительным.
  if (motion && /до полной остановки/i.test(t)) {
    const a1 = num(motion[1]);
    const delta = num(motion[2]);
    const d = /меньше/i.test(motion[3]) ? -delta : delta;
    if (d < 0 && a1 > 0) {
      const n = Math.ceil(a1 / Math.abs(d));
      const total = sumOf(a1, d, n);
      return {
        type: 'arith-motion',
        values: [total],
        details: { a1, d, n, total: round(total), wantTotal: true, stop: true },
      };
    }
  }

  // --- Геометрическая прогрессия -------------------------------------------------
  const mass = t.match(
    new RegExp(`(?:составляла|равна|равнялась|была|массой)\\s*(${NUM})\\s*(мг|г|кг)`, 'i'),
  );
  const after = t.match(new RegExp(`через\\s+(${NUM})\\s*(минут[а-яё]*|час[а-яё]*|сут[а-яё]*)`, 'i'));

  // Радиоактивный распад: «уменьшается вдвое каждые 9 минут».
  const halving = t.match(new RegExp(`уменьшается вдвое (?:каждые|за каждые) (${NUM})\\s*минут`, 'i'));

  if (halving && mass && after) {
    const period = num(halving[1]);
    const start = num(mass[1]);
    const elapsed = toMinutes(num(after[1]), after[2]);
    const steps = elapsed / period;
    const value = round(start / 2 ** steps);
    return {
      type: 'geom-decay',
      values: [value],
      details: { start, period, elapsed, steps, value, unit: mass[2] },
    };
  }

  // Рост бактерий: «увеличивается в 3 раза каждые 20 минут» или наоборот.
  const grow1 = t.match(
    new RegExp(`(?:увеличивается|увеличилась) в\\s+(${NUM})\\s+раз[а-яё]*\\s*(?:каждые|за каждые)\\s+(${NUM})\\s*минут`, 'i'),
  );
  const grow2 = t.match(
    new RegExp(`(?:за\\s+)?каждые\\s+(${NUM})\\s*минут[а-яё]*[^.]*?(?:увеличивается|увеличилась) в\\s+(${NUM})\\s+раз`, 'i'),
  );

  if ((grow1 || grow2) && mass && after) {
    const factor = num(grow1 ? grow1[1] : grow2[2]);
    const period = num(grow1 ? grow1[2] : grow2[1]);
    const start = num(mass[1]);
    const elapsed = toMinutes(num(after[1]), after[2]);
    const steps = elapsed / period;
    const value = round(start * factor ** steps);
    return {
      type: 'geom-growth',
      values: [value],
      details: { start, factor, period, elapsed, steps, value, unit: mass[2] },
    };
  }

  // Отскакивающий мячик: при каком прыжке впервые ниже порога.
  const ball = t.match(
    new RegExp(
      `подпрыгнул на\\s+(${NUM})\\s*м[^.]*?каждом следующем прыжке[^.]*?в\\s+(${NUM})\\s+раз[а-яё]* меньше`,
      'i',
    ),
  );
  const limit = t.match(new RegExp(`не достигнет высоты\\s+(${NUM})\\s*(см|м)`, 'i'));

  if (ball && limit) {
    const h0 = num(ball[1]);
    const factor = num(ball[2]);
    const threshold = num(limit[1]) * (/см/i.test(limit[2]) ? 0.01 : 1);
    let height = h0;
    let jump = 1;
    while (height >= threshold && jump < 100) {
      height /= factor;
      jump++;
    }
    return {
      type: 'geom-ball',
      values: [jump],
      details: { h0, factor, threshold, jump, height: round(height, 6) },
    };
  }

  // Равномерное остывание: «каждую минуту температура уменьшалась на 3 градуса».
  const cooling = t.match(
    new RegExp(`каждую минуту[^\\d-]{0,60}температура (?:уменьшалась|понижалась|снижалась) на\\s+(${NUM})`, 'i'),
  );
  const tempStart = t.match(new RegExp(`(-?\\s*${NUM})\\s*(?:°\\s*C|градус[а-яё]*)`, 'i'));
  const span = t.match(/через\s+(\d+)\s+минут/i) || t.match(/(?:в течение|за)\s+(\d+)\s+минут/i);

  if (cooling && tempStart && span) {
    const drop = num(cooling[1]);
    const start = num(tempStart[1]);
    const n = Number(span[1]);
    return {
      type: 'arith-cooling',
      values: [round(start - drop * n), round(start - drop * (n - 1))],
      details: { start, drop, n },
    };
  }

  return null;
}
