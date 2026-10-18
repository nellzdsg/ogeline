// Разбор заданий по «прототипам»: один тип задания — одно объяснение.
//
// Для каждого задания определяется прототип, а затем генерируются:
//   • три подсказки по возрастанию подробности (после третьей ошибки показывается решение);
//   • пошаговое решение.
//
// ФИПИ не публикует решения, поэтому шаги строит наша программа: для заданий вида
// «Найдите значение выражения» и «Пользуясь этой формулой…» это честный расчёт,
// для заданий с рисунком — разбор идеи, по которой выбирается ответ.

import { parseFragment, toExpr, toInlineText, extractMathBlocks } from '../crawler/lib/mathml.mjs';
import { decodeEntities, stripTags } from '../crawler/lib/parse.mjs';
import { solveArithmetic, parseExpr, evalNode, fmt, fmtApprox, plural } from './expr.mjs';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Линейная запись всех формул задания. */
function formulas(html) {
  return extractMathBlocks(html).map((b) =>
    parseFragment(b).children.map(toExpr).join(' ').replace(/\s+/g, ' ').trim(),
  );
}

/** Читаемый текст условия (MathML заменяется линейной записью). */
export function plainText(html) {
  let text = String(html);
  for (const block of extractMathBlocks(text)) {
    const inline = parseFragment(block).children.map(toInlineText).join('');
    text = text.replace(block, () => ` ${inline} `);
  }
  return decodeEntities(stripTags(text)).replace(/\s+/g, ' ').trim();
}

function mathOf(html) {
  const blocks = extractMathBlocks(html);
  return blocks.map((b) => parseFragment(b).children.map(toExpr).join(' ').trim()).join(' ');
}

/** Значение числа, записанного текстом или формулой (√, дробь, десятичная). */
export function valueOf(html) {
  const expr = mathOf(html);
  if (expr) {
    const v = evalNode(parseExpr(expr));
    if (isNum(v)) return v;
  }
  let t = decodeEntities(stripTags(html)).replace(/\s+/g, '').trim();
  if (!t) return null;
  t = t
    .replace(/[−–—]/g, '-')
    .replace(/:/g, '/')
    .replace(/√/g, 'sqrt')
    .replace(/,/g, '.');
  const v = evalNode(parseExpr(t));
  return isNum(v) ? v : null;
}

// --- задания с кратким ответом ----------------------------------------------

function solveWell(text, expr) {
  const m = expr.match(/(\d+(?:[.,]\d+)?)\s*\+\s*(\d+(?:[.,]\d+)?)\s*[·*]?\s*n/);
  const count = text.match(/из\s+(\d+)\s+колец/);
  if (!m || !count) return null;

  const A = Number(m[1].replace(',', '.'));
  const B = Number(m[2].replace(',', '.'));
  const n = Number(count[1]);
  const value = A + B * n;

  return {
    prototype: 'formula-well',
    hints: [
      'В условии дана формула стоимости. Чтобы найти стоимость, подставьте в неё заданное число колец вместо n.',
      `В формулу C = ${fmt(A)} + ${fmt(B)}·n вместо n подставьте ${n}.`,
      `Осталось посчитать: C = ${fmt(A)} + ${fmt(B)}·${n} = ${fmt(A)} + ${fmt(B * n)} = ?`,
    ],
    steps: [
      `Формула стоимости колодца: C = ${fmt(A)} + ${fmt(B)}·n, где n — число колец.`,
      `По условию n = ${n}. Подставим это значение в формулу.`,
      `C = ${fmt(A)} + ${fmt(B)}·${n}.`,
      `Сначала умножение: ${fmt(B)}·${n} = ${fmt(B * n)}.`,
      `Теперь сложение: C = ${fmt(A)} + ${fmt(B * n)} = ${fmt(value)}.`,
      `Ответ: ${fmt(value)}.`,
    ],
    answer: fmt(value),
  };
}

function solveCentripetal(text) {
  const a = text.match(/ускорение равно\s+(\d+(?:[.,]\d+)?)/i);
  const w = text.match(/угловая скорость равна\s+(\d+(?:[.,]\d+)?)/i);
  if (!a || !w) return null;
  const A = Number(a[1].replace(',', '.'));
  const W = Number(w[1].replace(',', '.'));
  const r = A / (W * W);
  return {
    prototype: 'formula-centripetal',
    hints: [
      'Формула связывает ускорение, угловую скорость и радиус. Радиус — неизвестное, значит формулу надо «развернуть» относительно R.',
      `Из формулы a = ω²R выразите R: R = a : ω². Подставьте a = ${fmt(A)} и ω = ${fmt(W)}.`,
      `Считайте по шагам: сначала ω² = ${fmt(W * W)}, затем R = ${fmt(A)} : ${fmt(W * W)} = ?`,
    ],
    steps: [
      'Запишем формулу центростремительного ускорения: a = ω²R.',
      'Выразим из неё радиус: R = a : ω².',
      `Подставим известные значения: a = ${fmt(A)} м/с², ω = ${fmt(W)} с⁻¹.`,
      `Найдём квадрат угловой скорости: ω² = ${fmt(W)}² = ${fmt(W * W)}.`,
      `R = ${fmt(A)} : ${fmt(W * W)} = ${fmt(r)}.`,
      `Ответ: ${fmt(r)}.`,
    ],
    answer: fmt(r),
  };
}

function solvePower(text) {
  const p = text.match(/мощность (?:составляет|равна)\s+(\d+(?:[.,]\d+)?)/i);
  const i = text.match(/сила тока равна\s+(\d+(?:[.,]\d+)?)/i);
  if (!p || !i) return null;
  const P = Number(p[1].replace(',', '.'));
  const I = Number(i[1].replace(',', '.'));
  const r = P / (I * I);
  return {
    prototype: 'formula-power',
    hints: [
      'Формула связывает мощность, силу тока и сопротивление. Сопротивление — неизвестное, выразите его из формулы.',
      `Из формулы P = I²R выразите R: R = P : I². Подставьте P = ${fmt(P)} и I = ${fmt(I)}.`,
      `Сначала I² = ${fmt(I * I)}, затем R = ${fmt(P)} : ${fmt(I * I)} = ?`,
    ],
    steps: [
      'Запишем формулу мощности постоянного тока: P = I²R.',
      'Выразим сопротивление: R = P : I².',
      `Подставим значения: P = ${fmt(P)} Вт, I = ${fmt(I)} А.`,
      `Найдём квадрат силы тока: I² = ${fmt(I)}² = ${fmt(I * I)}.`,
      `R = ${fmt(P)} : ${fmt(I * I)} = ${fmt(r)}.`,
      `Ответ: ${fmt(r)}.`,
    ],
    answer: fmt(r),
  };
}

// --- задания с выбором ответа ------------------------------------------------

function optionValues(task) {
  if (!task.options) return [];
  return task.options.map((o) => ({ n: o.n, value: valueOf(o.html), text: plainText(o.html) }));
}

/** Из подходящих вариантов выбираем тот, что совпадает с подтверждённым ответом. */
function pickCorrect(matches, answer) {
  if (!matches.length) return null;
  const byAnswer = matches.find((o) => String(o.n) === String(answer));
  return byAnswer || matches[0];
}

/** «Между какими (целыми) числами заключено число X?» */
function solveBetweenIntegers(text) {
  const m = /заключено число\s*[«"]?([^«»"?]+)[»"]?/i.exec(text);
  const raw = m ? m[1].trim() : '';
  const v = valueOf(raw);
  if (!isNum(v)) return null;

  const isSqrt = /[√]|sqrt/i.test(raw);
  const k = Math.floor(v);
  const hints = [];
  const steps = [];

  if (isSqrt) {
    hints.push('Корень удобно «зажать» между двумя соседними целыми: найдите, квадраты каких целых чисел окружают подкоренное число.');
    hints.push(`Найдите такое целое n, что n² меньше подкоренного числа, а (n+1)² — больше. Это и будут границы.`);
    hints.push(`Похожие квадраты: ${k}² = ${k * k}, ${k + 1}² = ${(k + 1) * (k + 1)}.`);
    steps.push(`Оценим значение корня. Найдём два соседних целых числа, между квадратами которых лежит подкоренное число.`);
    steps.push(`${k}² = ${k * k} < подкоренное число < ${(k + 1) * (k + 1)} = ${k + 1}².`);
    steps.push(`Значит, ${k} < √… < ${k + 1}, то есть число заключено между ${k} и ${k + 1}.`);
  } else {
    const [a, b] = raw.split(/[/:]/).map((s) => Number(s.replace(',', '.')));
    hints.push('Неправильную дробь удобно превратить в смешанное число: выделите целую часть.');
    hints.push(`Разделите числитель на знаменатель: ${fmt(a)} : ${fmt(b)} ≈ ${fmtApprox(v)}.`);
    hints.push(`Значение ${fmtApprox(v)} лежит между ${k} и ${k + 1}.`);
    steps.push(`Найдём значение дроби: ${raw.replace(':', '/')} ≈ ${fmtApprox(v)}.`);
    steps.push(`Это число больше ${k} и меньше ${k + 1}, значит заключено между ${k} и ${k + 1}.`);
  }
  return { prototype: isSqrt ? 'sqrt-between' : 'frac-between-integers', hints, steps, answer: null };
}

/** «Какое из следующих чисел заключено между числами A и B?» */
function solveBetweenTwo(text, task) {
  const m = /между числами\s*[«"]?([^«»"?]+?)[»"]?\s*и\s*[«"]?([^«»"?]+?)[»"]?\s*\?/i.exec(text);
  if (!m) return null;
  const lo = valueOfText(m[1]);
  const hi = valueOfText(m[2]);
  if (!isNum(lo) || !isNum(hi)) return null;

  const opts = optionValues(task);
  const correct = pickCorrect(
    opts.filter((o) => isNum(o.value) && o.value > lo && o.value < hi),
    task.answer,
  );

  const hints = [
    'Сравнивать обыкновенные дроби удобно, приведя их к десятичному виду.',
    `Первое число ≈ ${fmtApprox(lo)}, второе ≈ ${fmtApprox(hi)}. Ищите вариант, который находится строго между ними.`,
    correct
      ? `Подходящее число — то, что больше ${fmtApprox(lo)} и меньше ${fmtApprox(hi)}. Его значение ≈ ${fmtApprox(correct.value)}.`
      : `Нужное число должно быть больше ${fmtApprox(lo)} и меньше ${fmtApprox(hi)}.`,
  ];
  const steps = [
    `Переведём границы в десятичные дроби: ${m[1].trim()} ≈ ${fmtApprox(lo)}, ${m[2].trim()} ≈ ${fmtApprox(hi)}.`,
    'Тогда ответ должен быть числом, которое больше первого и меньше второго.',
  ];
  if (correct) {
    steps.push(`Этому условию удовлетворяет вариант ${correct.text} (≈ ${fmtApprox(correct.value)}).`);
  } else {
    steps.push('Сравните каждый вариант с полученными границами.');
  }
  return { prototype: 'frac-between-two', hints, steps, answer: null };
}

/** «Какое из чисел … принадлежит отрезку [a; b]?» */
function solveSegment(text, task) {
  const m = /отрезку\s*[«"]?\[?\s*(\d+(?:[.,]\d+)?)\s*;\s*(\d+(?:[.,]\d+)?)\s*\]?[»"]?/i.exec(text);
  if (!m) return null;
  const a = Number(m[1].replace(',', '.'));
  const b = Number(m[2].replace(',', '.'));
  const opts = optionValues(task);
  const inside = (o) => isNum(o.value) && o.value > Math.min(a, b) && o.value < Math.max(a, b);
  const correct = pickCorrect(opts.filter(inside), task.answer) || pickCorrect(
    opts.filter((o) => isNum(o.value) && o.value >= Math.min(a, b) && o.value <= Math.max(a, b)),
    task.answer,
  );

  const hints = [
    'Отрезок — это все числа от левой границы до правой включительно. Проверьте каждый вариант на попадание в этот промежуток.',
    `Переведите каждую дробь в десятичную и сравните с границами ${fmt(a)} и ${fmt(b)}.`,
    correct ? `Подходит число со значением ≈ ${fmtApprox(correct.value)}.` : 'Найдите вариант, лежащий между границами отрезка.',
  ];
  const steps = [
    `Отрезок задан от ${fmt(a)} до ${fmt(b)}. Значит, нужно найти число x, для которого ${fmt(a)} ⩽ x ⩽ ${fmt(b)}.`,
    'Переведём варианты в десятичные дроби и сравним с границами.',
  ];
  if (correct) steps.push(`Подходит вариант ${correct.text} (≈ ${fmtApprox(correct.value)}).`);
  return { prototype: 'frac-segment', hints, steps, answer: null };
}

/** «Какому из данных промежутков принадлежит число X?» */
function solveInterval(text, task) {
  const m = /принадлежит число\s*[«"]?([^«»"?]+?)[»"]?\s*\?/i.exec(text);
  if (!m) return null;
  const v = valueOfText(m[1]);
  if (!isNum(v)) return null;

  const opts = optionValues(task);
  const parsed = opts.map((o) => ({ ...o, range: parseInterval(o.text) }));
  const correct = pickCorrect(
    parsed.filter((o) => o.range && v > o.range[0] && v < o.range[1]),
    task.answer,
  );

  const hints = [
    'Промежуток — это числа между двумя границами. Переведите данное число в десятичную дробь и посмотрите, между какими границами оно оказалось.',
    `Значение числа ≈ ${fmtApprox(v)}. Найдите вариант, у которого левая граница меньше ${fmtApprox(v)}, а правая — больше.`,
    correct ? `Ответ — промежуток от ${fmtApprox(correct.range[0])} до ${fmtApprox(correct.range[1])}.` : 'Сравните значение с границами вариантов.',
  ];
  const steps = [
    `Переведём число ${m[1].trim()} в десятичную дробь: ≈ ${fmtApprox(v)}.`,
    'Теперь сравним это значение с границами предложенных промежутков.',
  ];
  if (correct) steps.push(`Подходит промежуток от ${fmtApprox(correct.range[0])} до ${fmtApprox(correct.range[1])}.`);
  return { prototype: 'interval', hints, steps, answer: null };
}

function parseInterval(text) {
  const m = /(-?\d+(?:[.,]\d+)?)\s*[;:]\s*(-?\d+(?:[.,]\d+)?)/.exec(text);
  if (!m) return null;
  const a = Number(m[1].replace(',', '.'));
  const b = Number(m[2].replace(',', '.'));
  return a < b ? [a, b] : [b, a];
}

/** Задания, где нужно указать точку на координатной прямой (в основе — рисунок). */
function solvePointOnLine(text) {
  // Число может быть корнем, дробью или десятичной дробью.
  const num = /соответствует числу\s*[«"]?([^«»"?]+?)[»"]?\s*[.?]/i.exec(text) ||
    /Одна из них соответствует числу\s*[«"]?([^«»"?]+?)[»"]?\s*[.?]/i.exec(text);
  if (!num) return null;
  const value = valueOfText(num[1]);

  const hints = [
    'Определите, между какими целыми (или десятыми) находится число, и найдите соответствующую точку на прямой.',
    value != null
      ? `Значение числа ≈ ${fmtApprox(value)}. Оно лежит между ${Math.floor(value)} и ${Math.floor(value) + 1}.`
      : 'Оцените положение числа на прямой по его величине.',
    'Сравните положение точки с соседними делениями и выберите ту, что ближе к найденному значению.',
  ];
  const steps = [];
  if (value != null && num) {
    const isSqrt = /[√]|sqrt/i.test(num[1]);
    if (isSqrt) {
      const k = Math.floor(value);
      steps.push(`Оценим значение корня: ${k}² = ${k * k} и ${k + 1}² = ${(k + 1) * (k + 1)}, значит ${k} < √… < ${k + 1}.`);
    } else {
      steps.push(`Значение числа ≈ ${fmtApprox(value)}.`);
    }
    steps.push(`Число находится между ${Math.floor(value)} и ${Math.floor(value) + 1}.`);
  }
  steps.push('По рисунку находим точку, расположенную в этом месте прямой.');
  return { prototype: 'point-on-line', hints, steps, answer: null };
}

/** Точки A, B, C, D соответствуют числам … (нужен рисунок). */
function solveDecimalLine(text, task) {
  if (!/точк(?:и|ами)?\s*[«"]?[ABCD]/i.test(text) || !/соответству/i.test(text)) return null;

  // В условии числа могут быть разорваны пробелом («0,0 58», «0 , 502»), а минус — отделён.
  const clean = text
    .replace(/(\d)\s*,\s*(\d)/g, '$1,$2')
    .replace(/(\d)\s+(?=\d)/g, '$1')
    .replace(/[−–—]\s*/g, '-')
    .replace(/-\s+(?=\d)/g, '-');

  const askedM = /соответствует число\s*(-?\d+(?:[.,]\d+)?)/i.exec(clean);
  const head = clean.split(/Какой точке/i)[0];
  const values = [...new Set([...head.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((x) => Number(x[0].replace(',', '.'))))];
  const sorted = [...values].sort((a, b) => a - b);

  const asked = askedM ? Number(askedM[1].replace(',', '.')) : null;
  const rank = asked != null ? sorted.indexOf(asked) + 1 : 0;
  const correctOpt = task.options ? task.options.find((o) => String(o.n) === String(task.answer)) : null;
  const letter = correctOpt ? plainText(correctOpt.html).trim() : null;

  const hints = [
    'Числа, подписанные под прямой, расположите в порядке возрастания: слева направо точки A, B, C, D идут именно в этом порядке.',
    sorted.length ? `По возрастанию: ${sorted.map(fmtApprox).join(' < ')}.` : 'Расположите числа по возрастанию.',
    letter && rank
      ? `Искомое число ${askedM[1]} стоит на ${rank}-м месте в этом ряду, значит ему соответствует точка ${letter}.`
      : 'Сравните положение нужного числа с числами соседних точек.',
  ];
  const steps = ['Расположим числа задания в порядке возрастания.'];
  if (sorted.length) steps.push(`Получаем: ${sorted.map(fmtApprox).join(' < ')}.`);
  steps.push('Точки на координатной прямой слева направо идут в этом же порядке: A, B, C, D.');
  if (letter && rank) {
    steps.push(`Число ${askedM[1]} занимает ${rank}-е место, значит ему соответствует точка ${letter}.`);
  }
  return { prototype: 'decimal-line', hints, steps, answer: null };
}

/** Задания с неравенствами/утверждениями о числе a, отмеченном на прямой. */
function solveLineReasoning(text) {
  if (/неравенств/i.test(text)) {
    return {
      prototype: 'line-inequality',
      hints: [
        'По рисунку сравните числа a и b: какое из них левее (меньше), какое правее (больше), какие у них знаки.',
        'Подставьте вместо a и b подходящие числа (например, a ≈ −1,4 и b ≈ 0,6) и проверьте каждое неравенство.',
        'Помните: при умножении или делении неравенства на отрицательное число знак неравенства меняется на противоположный.',
      ],
      steps: [
        'По рисунку определим, как расположены числа a и b: какое левее, какое правее, положительные они или отрицательные.',
        'Подставим вместо a и b удобные значения из их промежутков и проверим каждое неравенство на истинность.',
        'Выбираем неравенство, которое действительно выполняется.',
      ],
      answer: null,
    };
  }
  return {
    prototype: 'line-assertion',
    hints: [
      'Сначала определите по рисунку, между какими целыми числами находится отмеченное число (например, между −2 и −1).',
      'Возьмите удобное значение из этого промежутка и проверьте каждое утверждение арифметикой.',
      'Помните про знаки: у отрицательного числа модуль тем больше, чем дальше оно от нуля.',
    ],
    steps: [
      'По рисунку определим, в каком промежутке лежит отмеченное число (между какими целыми).',
      'Подставим удобное значение из этого промежутка в каждое утверждение и проверим его.',
      'Выбираем то утверждение, которое выполняется.',
    ],
    answer: null,
  };
}

function valueOfText(text) {
  let t = String(text).replace(/\s+/g, '').trim();
  if (!t) return null;
  t = t.replace(/[−–—]/g, '-').replace(/:/g, '/').replace(/√/g, 'sqrt').replace(/,/g, '.');
  const v = evalNode(parseExpr(t));
  return isNum(v) ? v : null;
}

/** «Одно из чисел …, …, … и … отмечено на прямой точкой A» — нужен рисунок. */
function solveNumberSetLine(text, task) {
  if (!/одно из чисел/i.test(text) || !/точк(?:ой|е)\s*[«"]?[AАA][»"]?/i.test(text)) return null;

  const fromText = (text.match(/-?\d+(?:[.,]\d+)?(?:\/\d+)?|√\(?\d+\)?/g) || [])
    .map((s) => valueOfText(s))
    .filter(isNum);
  const opts = optionValues(task);
  const values = [...new Set([...fromText, ...opts.map((o) => o.value).filter(isNum)])];
  const correct = pickCorrect(opts.filter((o) => isNum(o.value)), task.answer);
  const sorted = [...values].sort((a, b) => a - b);

  const displayed = sorted.length ? sorted.map(fmtApprox).join(' < ') : null;
  const hints = [
    'Переведите каждую дробь в десятичную и сравните числа между собой.',
    displayed
      ? `Если расположить числа по возрастанию, получится: ${displayed}.`
      : 'Расположите числа по возрастанию.',
    correct
      ? `Точке A на рисунке соответствует число со значением ≈ ${fmtApprox(correct.value)}.`
      : 'Сравните положение точки A с соседними делениями прямой.',
  ];
  const steps = ['Переведём числа задания в десятичные дроби, чтобы их было удобно сравнивать.'];
  if (values.length) steps.push(`Значения: ${values.map(fmtApprox).join(', ')}.`);
  if (sorted.length) steps.push(`По возрастанию: ${displayed}.`);
  if (correct) steps.push(`На рисунке точка A стоит в том месте, где находится число ${correct.text} (≈ ${fmtApprox(correct.value)}).`);
  else steps.push('По рисунку определим, какое из чисел расположено в положении точки A.');
  return { prototype: 'number-set-line', hints, steps, answer: null };
}

// --- точка входа -------------------------------------------------------------

/**
 * @param {object} task задание из tasks.ndjson
 * @returns {{prototype: string, hints: string[], steps: string[], answer: string|null}}
 */
export function describe(task) {
  const text = plainText(task.stem);
  const kind = task.kind;

  if (kind === 'short') {
    if (/найдите значение выражения/i.test(text)) {
      const expr = formulas(task.stem).find((e) => !e.includes('='));
      if (expr) {
        const solved = solveArithmetic(expr);
        if (solved) {
          return {
            prototype: 'arithmetic',
            hints: solved.hints,
            steps: solved.steps,
            answer: solved.answer,
          };
        }
      }
    }
    if (/пользуясь этой формулой/i.test(text)) {
      const expr = formulas(task.stem).find((e) => e.includes('='));
      if (expr) {
        const solved =
          (/(\d+)\s*\+\s*(\d+)\s*[·*]?\s*n/i.test(expr) && solveWell(text, expr)) ||
          /ω/i.test(expr) && solveCentripetal(text) ||
          /I/i.test(expr) && solvePower(text);
        if (solved) return solved;
      }
    }
  }

  if (kind === 'choice') {
    const solved =
      solveBetweenTwo(text, task) ||
      solveSegment(text, task) ||
      solveInterval(text, task) ||
      solveBetweenIntegers(text) ||
      solveNumberSetLine(text, task) ||
      solvePointOnLine(text) ||
      solveDecimalLine(text, task) ||
      solveLineReasoning(text);
    if (solved) return solved;
  }

  return {
    prototype: 'generic',
    hints: [
      task.hint || 'Внимательно прочитайте условие и определите, что именно требуется найти.',
      'Попробуйте разобрать условие по частям: что дано и что нужно найти.',
      'Сравните свой ход решения с разбором — возможно, ошибка в вычислениях.',
    ],
    steps: ['Для этого задания разбор ещё готовится. Решение можно обсудить с учителем.'],
    answer: null,
  };
}
