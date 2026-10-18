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
import {
  solveArithmetic,
  parseExpr,
  parseAlgebra,
  evalNode,
  fmt,
  fmtApprox,
  plural,
  powerForm,
  powerValue,
} from './expr.mjs';
import {
  analyzeFormula,
  evalExpr,
  fixNumberText,
  formulaInputInfo,
  insertImplicitProducts,
  substitutedText,
  taskValues,
  variablesIn,
  fmtValue,
  kineticData,
  potentialData,
} from '../crawler/lib/solvers.mjs';

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

// --- тема «Алгебраические выражения» -----------------------------------------

const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const SUB_DIGITS = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };

/** «d_1» → «d₁». */
function varName(name) {
  return String(name).replace(/_(\d)/g, (_, d) => SUB_DIGITS[d]);
}

/** Знак минус в читаемом виде. */
const minus = (s) => String(s).replace(/-/g, '−');

/** Убирает внешние скобки, если они охватывают всё выражение. */
function stripOuter(s) {
  let t = String(s).trim();
  for (;;) {
    if (!t.startsWith('(') || !t.endsWith(')')) return t;
    let depth = 0;
    let inner = false;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')') {
        depth--;
        if (depth === 0 && i < t.length - 1) {
          inner = true;
          break;
        }
      }
    }
    if (inner) return t;
    t = t.slice(1, -1).trim();
  }
}

/** Читаемая запись выражения: «(a^3)^8·a^7/a^29». */
function tidy(expr) {
  const s = insertImplicitProducts(String(expr))
    .replace(/\^\(([^()]+)\)/g, '^$1')
    .replace(/\(\(([^()]+)\)\^([^()]+)\)/g, '($1^$2)')
    .replace(/\(\(([^()]*)\)\)/g, '($1)')
    .replace(/\bsqrt\b/g, '√')
    .replace(/\*/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
  return stripOuter(s)
    .replace(/(?<![A-Za-z\u03b1-\u03c9])\(([A-Za-z\u03b1-\u03c9][A-Za-z0-9_\u03b1-\u03c9]*)\)/g, '$1')
    .replace(/\((\d+(?:,\d+)?)\)/g, '$1')
    .replace(/_(\d)/g, (_, d) => SUB_DIGITS[d])
    .replace(/\(-/g, '(−')
    .replace(/(?<=[\d)])-/g, '−')
    .trim();
}

/** Степень в читаемом виде: (a, 3) → «a³»; base уже готов к показу. */
function powerText(base, exp) {
  if (exp === 0) return '1';
  if (exp === 1) return base;
  if (exp === 0.5) return `√${base}`;
  if (exp === -0.5) return `1/√${base}`;
  if (Number.isInteger(exp)) {
    const digits = String(Math.abs(exp))
      .split('')
      .map((d) => SUP[Number(d)] ?? d)
      .join('');
    return `${base}${exp < 0 ? '⁻' : ''}${digits}`;
  }
  return `${base}^${fmtValue(exp)}`;
}

/** Как показать основание степени: «a», «36». */
function baseText(base) {
  return /^\d/.test(base) ? fmtValue(Number(base)) : varName(base);
}

/** «a = 7, b = 6» для подсказки. */
function valuesText(knowns, bases) {
  return bases.map((b) => `${varName(b)} = ${fmtValue(knowns[b])}`).join(', ');
}

/** Ответ прототипа. */
function pack(prototype, hints, steps, value) {
  return { prototype, hints, steps, answer: fmt(value) };
}

/** Цепочка умножений с промежуточными результатами. */
function chainSteps(factors) {
  const out = [];
  let acc = factors[0];
  for (let i = 1; i < factors.length; i++) {
    out.push(`${fmtValue(acc)}·${fmtValue(factors[i])} = ${fmtValue(acc * factors[i])}`);
    acc *= factors[i];
  }
  return out;
}

/** Ищет представление target = Π (bases[i]^e[i]) с небольшими e[i]. */
function findProduct(target, bases) {
  if (!bases.length || target <= 1) return null;
  const idx = bases.map(() => 0);
  const rec = (i, prod) => {
    if (i === bases.length) return Math.abs(prod - target) < 1e-9 ? [...idx] : null;
    for (let e = 0; e <= 6; e++) {
      idx[i] = e;
      const r = rec(i + 1, prod * bases[i] ** e);
      if (r) return r;
    }
    return null;
  };
  const result = rec(0, 1);
  if (!result) return null;
  const terms = bases.map((b, i) => ({ base: b, mul: result[i] })).filter((t) => t.mul > 0);
  return terms.length ? terms : null;
}

/** «Найдите значение выражения» — упрощение степеней. */
function solveDegree(expr, knowns, literals) {
  const powers = powerForm(insertImplicitProducts(expr));
  if (!powers || !powers.length) return null;
  if (powers.some((p) => !Number.isInteger(p.exp))) return null;

  // Основание 1 ничего не меняет.
  const used = powers.filter((p) => !(/^\d/.test(p.base) && Math.abs(Number(p.base) - 1) < 1e-12));
  if (!used.length) return null;

  // Составные основания выражаем через остальные: 66 = 6·11, 4 = 2².
  const numeric = [...new Set(used.filter((p) => /^\d/.test(p.base)).map((p) => Number(p.base)))];
  const notes = [];
  const contributions = new Map();
  const push = (base, exp, text) => {
    const current = contributions.get(base) ?? { value: 0, texts: [] };
    current.value += exp;
    current.texts.push(text);
    contributions.set(base, current);
  };

  for (const p of used) {
    const value = Number(p.base);
    const terms =
      /^\d/.test(p.base) && numeric.length > 1
        ? findProduct(
            value,
            numeric.filter((b) => b !== value),
          )
        : null;
    if (terms) {
      const pretty = terms.map((t) => powerText(String(t.base), t.mul)).join('·');
      const rebuilt = terms.map((t) => powerText(String(t.base), t.mul * p.exp)).join('·');
      notes.push(
        p.exp === 1
          ? `${powerText(fmtValue(value), 1)} = ${pretty}`
          : `${powerText(fmtValue(value), 1)} = ${pretty}, поэтому ${powerText(fmtValue(value), p.exp)} = ${rebuilt}`,
      );
      for (const t of terms) push(String(t.base), t.mul * p.exp, expandText(p.text, t.mul));
      continue;
    }
    push(p.base, p.exp, p.text);
  }

  // Если какое-то основание всё ещё выражается через остальные, объяснение будет неполным.
  const numericRest = [...contributions.keys()].filter((b) => /^\d/.test(b)).map(Number);
  for (const b of numericRest) {
    const others = numericRest.filter((x) => x !== b);
    if (others.length && findProduct(b, others)) return null;
  }

  let value = 1;
  for (const [base, c] of contributions) {
    const b = /^\d/.test(base) ? Number(base) : knowns[base];
    if (b == null) return null;
    value *= b ** c.value;
  }
  const check = evalExpr(expr, knowns, literals);
  if (check == null || Math.abs(value - check) > 1e-9) return null;

  const shown = [...contributions.entries()].filter(([, c]) => Math.abs(c.value) > 1e-12);
  if (!shown.length || shown.length > 4) return null;

  const display = shown.map(([base, c]) => powerText(baseText(base), c.value)).join('·') || '1';
  const substituted = shown
    .map(([base]) => {
      const v = /^\d/.test(base) ? Number(base) : knowns[base];
      return v == null ? baseText(base) : powerText(fmtValue(v), contributions.get(base).value);
    })
    .join('·');
  const variables = shown.filter(([base]) => !/^\d/.test(base)).map(([base]) => base);
  const evaluated = shown.map(([base, c]) => fmt(Number(base) ** c.value)).join('·');
  const noteText = [...contributions.entries()].map(([base, c]) =>
    `${baseText(base)}: ${minus(c.texts.join(' + '))} = ${minus(fmt(c.value))}`.replace(/ \+ −/g, ' − '),
  );

  const hasPowerOfPower = used.some((p) => p.text.includes('·'));
  const hints = [
    'Это задание на свойства степени с одинаковым основанием.',
    notes.length
      ? 'Сначала разложите составные основания на множители, а потом пользуйтесь свойствами степени.'
      : hasPowerOfPower
        ? 'Сначала возведение степени в степень: показатели перемножаются. Затем умножение и деление: показатели складываются и вычитаются.'
        : 'При умножении степеней с одинаковым основанием показатели складываются, при делении — вычитаются.',
    `После упрощения получится ${display}. ${
      variables.length ? `Подставьте значения: ${valuesText(knowns, variables)}.` : 'Вычислите это значение.'
    }`,
  ];

  const steps = ['Свойства степени: при возведении степени в степень показатели перемножаются, при умножении складываются, при делении вычитаются.'];
  steps.push(...notes.map((n) => `${n}.`));
  steps.push(`Соберём показатели по основаниям: ${noteText.join('; ')}.`);
  steps.push(`Получим ${display}.`);
  if (variables.length) steps.push(`Подставим значения: ${display} = ${substituted} = ${fmt(value)}.`);
  else if (display !== fmt(value))
    steps.push(
      shown.length > 1
        ? `Вычислим: ${display} = ${evaluated} = ${fmt(value)}.`
        : `Вычислим: ${display} = ${fmt(value)}.`,
    );
  steps.push(`Ответ: ${fmt(value)}.`);

  return pack('expr-degree', hints, steps, value);
}

/** Показатель при разложении основания: «-1» с множителем −2 → «2». */
function expandText(text, mul) {
  if (mul === 1) return text;
  if (/^-?\d+$/.test(text)) return String(Number(text) * mul);
  return `(${text})·${mul}`;
}

/** Ищет парную скобку к s[open]. */
function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (!depth) return i;
    }
  }
  return -1;
}

/**
 * Разбирает выражение из множителей и знаков умножения/деления на список
 * множителей. Скобки разбираются рекурсивно: «(A·B)/(C)» → A, B со знаком «+»
 * и C со знаком «−».
 */
function collectFactors(s) {
  const out = [];
  let i = 0;
  let sign = 1;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '*') {
      sign = 1;
      i++;
      continue;
    }
    if (ch === '/') {
      sign = -1;
      i++;
      continue;
    }
    if (ch === ' ') {
      i++;
      continue;
    }
    if (s.startsWith('sqrt', i)) {
      const open = s.indexOf('(', i);
      if (open < 0) return null;
      const close = matchParen(s, open);
      if (close < 0) return null;
      const text = s.slice(open + 1, close);
      const radicand = evalExpr(text);
      if (radicand == null || radicand < 0) return null;
      out.push({ kind: 'sqrt', text, radicand, sign });
      i = close + 1;
      continue;
    }
    if (ch === '(') {
      const close = matchParen(s, i);
      if (close < 0) return null;
      const inner = collectFactors(s.slice(i + 1, close));
      if (!inner) return null;
      for (const f of inner) out.push({ ...f, sign: sign * f.sign });
      i = close + 1;
      continue;
    }
    const m = /^\d+(?:[.,]\d+)?/.exec(s.slice(i));
    if (!m) return null;
    out.push({ kind: 'num', text: m[0], value: Number(m[0].replace(',', '.')), sign });
    i += m[0].length;
  }
  return out;
}

/** (√a − b)(√a + b) — разность квадратов. */
function radicalDifferenceOfSquares(E, value) {
  const plain = /^\(sqrt\((\d+)\)([-+])(\d+)\)\*\(sqrt\(\1\)([-+])(\d+)\)$/.exec(E);
  const roots = /^\(sqrt\((\d+)\)([-+])\s*sqrt\((\d+)\)\)\*\(sqrt\(\1\)([-+])sqrt\((\d+)\)\)$/.exec(E);
  const m = plain || roots;
  if (!m || m[3] !== m[5] || m[2] === m[4]) return null;

  const a = Number(m[1]);
  const b = Number(m[3]);
  const isRoot = !!roots;
  const y = isRoot ? `√${b}` : `${b}`;
  const first = `(√${a} − ${y})`;
  const second = `(√${a} + ${y})`;
  const subtrahend = isRoot ? `(√${b})²` : `${b}²`;
  const subtrahendValue = isRoot ? b : b * b;

  return pack(
    'expr-radical',
    [
      'Произведение скобок вида (x − y)(x + y) — это формула разности квадратов.',
      `Здесь x = √${a}, y = ${y}. Примените (x − y)(x + y) = x² − y².`,
      `Получится (√${a})² − ${subtrahend} = ${a} − ${subtrahendValue}. Посчитайте.`,
    ],
    [
      `Множители — это ${first} и ${second}. Это разность квадратов.`,
      `${first}${second} = (√${a})² − ${subtrahend} = ${a} − ${subtrahendValue}.`,
      `Значение выражения равно ${a} − ${subtrahendValue} = ${fmt(value)}.`,
      `Ответ: ${fmt(value)}.`,
    ],
    value,
  );
}

/** (√a ± √b)·√c — раскрытие скобок. */
function radicalDistribute(E, value) {
  const m = /^\(sqrt\((\d+)\)([-+])sqrt\((\d+)\)\)\*sqrt\((\d+)\)$/.exec(E);
  if (!m) return null;
  const A = Number(m[1]);
  const B = Number(m[3]);
  const C = Number(m[4]);
  const r1 = Math.sqrt(A * C);
  const r2 = Math.sqrt(B * C);
  const whole = (x) => Math.abs(x - Math.round(x)) < 1e-9;
  if (!whole(r1) || !whole(r2)) return null;

  const op = m[2] === '+' ? '+' : '−';
  const [k1, k2] = [Math.round(r1), Math.round(r2)];  return pack(
    'expr-radical',
    [
      'Раскройте скобки: каждое слагаемое умножьте на корень за скобкой.',
      `Воспользуйтесь свойством √p·√q = √(p·q): √${A}·√${C} = √${A * C}, √${B}·√${C} = √${B * C}.`,
      `Получится ${k1} ${op} ${k2}. Посчитайте.`,
    ],
    [
      `Раскроем скобки: (√${A} ${op} √${B})·√${C} = √${A}·√${C} ${op} √${B}·√${C}.`,
      `√${A}·√${C} = √${A * C} = ${k1}, √${B}·√${C} = √${B * C} = ${k2}.`,
      `Значение равно ${k1} ${op} ${k2} = ${fmt(value)}.`,
      `Ответ: ${fmt(value)}.`,
    ],
    value,
  );
}

/** (√a ± b)² ∓ 2b√a — полный квадрат минус то же слагаемое. */
function radicalSquareSum(E, value) {
  const m = /^\(*sqrt\((\d+)\)([-+])(\d+)\)*\^\(2\)\)*([-+])(\d+)\*sqrt\((\d+)\)$/.exec(E);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  const k = Number(m[5]);
  const radicand = Number(m[6]);
  if (b * 2 !== k || radicand !== a || m[2] === m[4]) return null;

  const sign = m[2] === '+' ? '+' : '−';
  const rest = m[4] === '+' ? '+' : '−';
  const square = `(√${a} ${sign} ${b})² = ${a} ${sign} ${2 * b}√${a} + ${b * b}`;

  return pack(
    'expr-radical',
    [
      'Здесь квадрат суммы (или разности) и ещё одно слагаемое с корнем.',
      `Раскройте квадрат: ${square}.`,
      `Слагаемые с корнем взаимно уничтожаются, останется ${a} + ${b * b}. Посчитайте.`,
    ],
    [
      `Раскроем квадрат по формуле (x ± y)² = x² ± 2xy + y²: ${square}.`,
      `Второе слагаемое — это ${rest}${k}√${a}.`,
      `Слагаемые с корнем уничтожаются: ${a} + ${b * b} = ${fmt(value)}.`,
      `Ответ: ${fmt(value)}.`,
    ],
    value,
  );
}

const BIN_OP = { '*': '*', '/': '/', '-': '-', '+': '+' };

/** Запись узла дерева (в виде, понятном разборщику: sqrt, *, /). */
function nodeText(node) {
  if (!node) return '?';
  switch (node.type) {
    case 'num':
      return fmtValue(node.value);
    case 'unknown':
      return node.raw;
    case 'neg':
      return `-${nodeText(node.arg)}`;
    case 'sqrt':
      return `sqrt(${nodeText(node.arg)})`;
    case 'pow':
      return `${wrapNode(node.base)}^${wrapNode(node.exp)}`;
    case 'bin':
      return `${wrapNode(node.l)} ${BIN_OP[node.op]} ${wrapNode(node.r)}`;
    default:
      return '?';
  }
}

const wrapNode = (node) => (node.type === 'bin' ? `(${nodeText(node)})` : nodeText(node));

/** Читаемая запись узла. */
const nodeDisplay = (node) =>
  nodeText(node)
    .replace(/sqrt\(/g, '√(')
    .replace(/\*/g, '·')
    .replace(/\//g, ':');

/** Основание степени вида k√a: (5√2) → {k: 5, a: 2}. */
function squaredParts(node) {
  if (!node || node.type === 'num') return null;
  const powers = powerForm(nodeText(node));
  if (!powers || !powers.length) return null;
  if (powers.some((p) => !/^\d/.test(p.base))) return null;
  if (powers.some((p) => p.exp !== 1 && p.exp !== 0.5)) return null;
  const halves = powers.filter((p) => p.exp === 0.5);
  const wholes = powers.filter((p) => p.exp === 1);
  if (halves.length !== 1 || wholes.length > 1) return null;
  const a = Number(halves[0].base);
  const k = wholes.length ? Number(wholes[0].base) : 1;
  if (!Number.isInteger(a) || !Number.isInteger(k)) return null;
  return { k, a };
}

/** Квадрат корня: (k√a)² = k²·a. */
function radicalSquaredRadical(expr, knowns, literals, value) {
  const root = parseAlgebra(insertImplicitProducts(expr).replace(/\s+/g, ''));
  if (!root) return null;

  // Квадрат корня — либо всё выражение, либо один из множителей верхнего уровня.
  const candidates = [[root, null, null]];
  if (root.type === 'bin') candidates.push([root.l, root, 'l'], [root.r, root, 'r']);

  for (const [node, parent, side] of candidates) {
    if (node.type !== 'pow') continue;
    if (Math.abs(evalNode(node.exp) - 2) > 1e-12) continue;
    const parts = squaredParts(node.base);
    if (!parts) continue;

    const { k, a } = parts;
    const square = k * k * a;
    const squareLine =
      k === 1
        ? `(√${a})² = ${a}`
        : `(${k}√${a})² = ${k}²·(√${a})² = ${k * k}·${a} = ${fmt(square)}`;

    let arithmetic = null;
    if (parent && parent.type === 'bin') {
      const sibling = side === 'l' ? parent.r : parent.l;
      const opText = parent.op === '*' ? '·' : parent.op === '/' ? ':' : parent.op === '-' ? '−' : '+';
      arithmetic =
        side === 'r'
          ? `${nodeDisplay(sibling)} ${opText} ${fmt(square)} = ${fmt(value)}`
          : `${fmt(square)} ${opText} ${nodeDisplay(sibling)} = ${fmt(value)}`;
    }

    return pack(
      'expr-radical',
      [
        'В выражении есть квадрат корня.',
        `Примените (k√a)² = k²·a: сначала возведите в квадрат множитель перед корнем, затем учтите, что (√a)² = a.`,
        `Квадрат равен ${fmt(square)}. ${arithmetic ? 'Осталось выполнить действия с числом.' : 'Запишите ответ.'}`,
      ],
      [
        'Избавимся от квадрата корня, воспользовавшись свойством степени (m·n)² = m²·n².',
        `${squareLine}.`,
        arithmetic ? `Вычислим значение выражения: ${arithmetic}.` : `Значит, значение выражения равно ${fmt(value)}.`,
        `Ответ: ${fmt(value)}.`,
      ],
      value,
    );
  }
  return null;
}

/** Произведение и частное корней: √p·√q = √(p·q). */
function radicalProduct(E, value) {
  const factors = collectFactors(E);
  if (!factors || factors.length < 2) return null;
  if (!factors.some((f) => f.kind === 'sqrt')) return null;

  let radicand = 1;
  let coefficient = 1;
  for (const f of factors) {
    const power = f.sign > 0 ? 1 : -1;
    if (f.kind === 'sqrt') radicand *= f.radicand ** power;
    else coefficient *= f.value ** power;
  }
  if (!Number.isFinite(radicand) || radicand < 0) return null;
  const root = Math.sqrt(radicand);
  if (Math.abs(root - Math.round(root)) > 1e-9) return null;
  const wholeRoot = Math.round(root);

  const show = (f) => (f.kind === 'sqrt' ? `√(${f.text.replace(/\*/g, '·')})` : f.text);
  const draft = factors
    .filter((f) => f.kind === 'sqrt')
    .map((f, i) => `${i ? (f.sign > 0 ? '·' : ' : ') : ''}${show(f)}`)
    .join('');
  const numerator = factors.filter((f) => f.kind === 'sqrt' && f.sign > 0).map((f) => f.text);
  const denominator = factors.filter((f) => f.kind === 'sqrt' && f.sign < 0).map((f) => f.text);
  const insideText = `${numerator.join('·')}${denominator.length ? `/${denominator.join('·')}` : ''}`;
  const coefficientText = Math.abs(coefficient - 1) < 1e-12 ? '' : `${fmtValue(coefficient)}·`;

  const steps = [
    'Воспользуемся свойством корня: √p·√q = √(p·q), а при делении √p:√q = √(p:q).',
    `Соберём корни под один знак корня: ${draft} = √(${insideText.replace(/\*/g, '·')}) = √${fmtValue(radicand)}.`,
    `√${fmtValue(radicand)} = ${wholeRoot}.`,
  ];
  if (coefficientText) steps.push(`Учтём числовой множитель: ${fmtValue(coefficient)}·${wholeRoot} = ${fmt(value)}.`);
  steps.push(`Ответ: ${fmt(value)}.`);

  return pack(
    'expr-radical',
    [
      'Все множители — квадратные корни и числа.',
      'Соберём корни под один знак корня: √p·√q = √(p·q).',
      `Получится ${coefficientText}√${fmtValue(radicand)}. Вычислите.`,
    ],
    steps,
    value,
  );
}

/** √(a² + 2ab + b²) = |a + b| — полный квадрат под корнем. */
function radicalPerfectSquare(expr, knowns, literals, value) {
  const m = /^sqrt\((.+)\)$/.exec(insertImplicitProducts(expr).replace(/\s+/g, ''));
  if (!m) return null;
  const inside = m[1];
  const vars = variablesIn(inside);
  if (vars.length !== 2) return null;

  const probe = (x, y) => evalExpr(inside, { ...knowns, [vars[0]]: x, [vars[1]]: y }, literals);
  const [c0, at1, bt1, both1] = [probe(0, 0), probe(1, 0), probe(0, 1), probe(1, 1)];
  if ([c0, at1, bt1, both1].some((v) => v == null)) return null;

  const P = at1 - c0;
  const R = bt1 - c0;
  const Q = both1 - c0 - P - R;
  if (Math.abs(c0) > 1e-9 || P <= 0 || R <= 0) return null;

  const k1 = Math.sqrt(P);
  const k2 = Math.sqrt(R);
  const plus = Math.abs(Q - 2 * k1 * k2) < 1e-6;
  const minus = Math.abs(Q + 2 * k1 * k2) < 1e-6;
  if (!plus && !minus) return null;

  const op = plus ? '+' : '−';
  const [x, y] = vars.map(varName);
  const withCoef = (k, text) => (Math.abs(k - 1) < 1e-9 ? text : `${fmtValue(k)}${text}`);
  const withCoefNum = (k, text) => (Math.abs(k - 1) < 1e-9 ? text : `${fmtValue(k)}·${text}`);
  const inner = `${withCoef(k1, x)} ${op} ${withCoef(k2, y)}`;
  const [xv, yv] = [fmtValue(knowns[vars[0]]), fmtValue(knowns[vars[1]])];
  const substituted = `${withCoefNum(k1, xv)} ${op} ${withCoefNum(k2, yv)}`;

  return pack(
    'expr-radical',
    [
      'Присмотритесь к выражению под корнем — это полный квадрат.',
      `Вспомните формулу (m + n)² = m² + 2mn + n² и подберите m и n: здесь m = ${withCoef(k1, x)}, n = ${withCoef(k2, y)}.`,
      `Получится √((${inner})²) = |${inner}|. Осталось подставить значения.`,
    ],
    [
      `Выражение под корнем — полный квадрат: ${withCoef(P, `${x}²`)} ${op} ${fmtValue(Math.abs(Q))}${x}${y} + ${withCoef(R, `${y}²`)} = (${inner})².`,
      `Значит, √((${inner})²) = |${inner}|.`,
      `Подставим ${x} = ${xv} и ${y} = ${yv}: |${substituted}| = ${fmt(value)}.`,
      `Ответ: ${fmt(value)}.`,
    ],
    value,
  );
}

/** √(одночлен): выносим множители из-под корня. */
function radicalUnderRoot(expr, knowns, literals, value) {
  const m = /^sqrt\((.+)\)$/.exec(insertImplicitProducts(expr).replace(/\s+/g, ''));
  if (!m) return null;
  const inside = m[1];
  const powers = powerForm(inside);
  if (!powers) return null;

  const insideValue = evalExpr(inside, knowns, literals);
  const vars = variablesIn(inside);

  if (!vars.length) {
    if (insideValue == null || insideValue < 0) return null;
    return pack(
      'expr-radical',
      [
        'Сначала посчитайте значение выражения под корнем, а потом извлеките корень.',
        `Значение под корнем: ${tidy(inside)} = ${fmt(insideValue)}.`,
        `Осталось найти ${fmtValue(insideValue)} под корнем.`,
      ],
      [
        `Найдём значение выражения под корнем: ${tidy(inside)} = ${fmt(insideValue)}.`,
        `Извлечём корень: √${fmtValue(insideValue)} = ${fmt(value)}.`,
        `Ответ: ${fmt(value)}.`,
      ],
      value,
    );
  }

  let numeric = 1;
  const others = [];
  for (const p of powers) {
    const half = p.exp / 2;
    if (/^\d/.test(p.base)) numeric *= Number(p.base) ** half;
    else others.push({ ...p, exp: half });
  }

  const parts = [];
  if (Math.abs(numeric - 1) > 1e-12) parts.push(fmtValue(numeric));
  for (const p of others) parts.push(powerText(varName(p.base), p.exp));
  const simplified = parts.join('·') || '1';

  const substitutedParts = [];
  if (Math.abs(numeric - 1) > 1e-12) substitutedParts.push(fmtValue(numeric));
  for (const p of others) substitutedParts.push(powerText(fmtValue(knowns[p.base]), p.exp));
  const substituted = substitutedParts.join('·');

  const steps = [
    'Применим свойства корня: √(x·y) = √x·√y и √(x^(2k)) = x^k — множитель выходит из-под корня с половинным показателем.',
    `√(${tidy(inside)}) = ${simplified}.`,
    `Подставим значения: ${simplified} = ${substituted} = ${fmt(value)}.`,
    `Ответ: ${fmt(value)}.`,
  ];

  return pack(
    'expr-radical',
    [
      'Корень из произведения равен произведению корней.',
      'Разделите показатель каждой степени под корнем на 2 — так множитель выходит из-под корня.',
      `После упрощения получится ${simplified}. Подставьте значения переменных.`,
    ],
    steps,
    value,
  );
}

/** «Найдите значение выражения» с корнями. */
function solveRadical(expr, knowns, literals) {
  const value = evalExpr(expr, knowns, literals);
  if (value == null) return null;
  const E = insertImplicitProducts(expr).replace(/\s+/g, '');

  return (
    radicalDifferenceOfSquares(E, value) ||
    radicalDistribute(E, value) ||
    radicalSquareSum(E, value) ||
    radicalSquaredRadical(expr, knowns, literals, value) ||
    radicalProduct(E, value) ||
    radicalPerfectSquare(expr, knowns, literals, value) ||
    radicalUnderRoot(expr, knowns, literals, value)
  );
}

/** Общий случай: подставить значения и вычислить. */
function solveCompute(expr, knowns, literals) {
  const value = evalExpr(expr, knowns, literals);
  if (value == null) return null;

  const substituted = tidy(substitutedText(expr, knowns, literals));
  const names = Object.keys(knowns).map((k) => `${varName(k)} = ${fmtValue(knowns[k])}`);

  const hints = names.length
    ? [
        'Подставьте данные значения переменных в выражение.',
        'Порядок действий: сначала степень и корень, затем умножение и деление, потом сложение и вычитание.',
        `После подстановки получится ${substituted}.`,
      ]
    : [
        'Вычислите значение выражения, соблюдая порядок действий.',
        'Сначала степень и корень, затем умножение и деление, потом сложение и вычитание.',
        `Удобно считать по частям: ${substituted}.`,
      ];

  const steps = [];
  if (names.length) steps.push(`Подставим значения: ${names.join(', ')}.`);
  steps.push(`Вычислим значение выражения: ${substituted} = ${fmt(value)}.`);
  steps.push(`Ответ: ${fmt(value)}.`);
  return { prototype: 'expr-compute', hints, steps, answer: fmt(value) };
}

/** Данные для подсказок о кинетической энергии. */
function solveKineticExplain(text) {
  const d = kineticData(text);
  if (!d) return null;

  if (d.find === 'v') {
    const { m, e } = d;
    const v2 = (2 * e) / m;
    const value = Math.sqrt(v2);
    return pack(
      'physics-kinetic',
      [
        'Кинетическая энергия вычисляется по формуле E = mv²/2, где m — масса, v — скорость.',
        `Подставьте E = ${fmtValue(e)} Дж и m = ${fmtValue(m)} кг: ${fmtValue(e)} = ${fmtValue(m)}·v²/2.`,
        `Из уравнения получится v² = ${fmtValue(v2)}. Осталось извлечь корень.`,
      ],
      [
        'Формула кинетической энергии: E = mv²/2, где m — масса, v — скорость.',
        `Подставим E = ${fmtValue(e)} Дж и m = ${fmtValue(m)} кг: ${fmtValue(e)} = ${fmtValue(m)}·v²/2.`,
        `Упростим правую часть: ${fmtValue(m)}/2 = ${fmtValue(m / 2)}, значит ${fmtValue(e)} = ${fmtValue(m / 2)}·v².`,
        `Отсюда v² = ${fmtValue(e)} : ${fmtValue(m / 2)} = ${fmtValue(v2)}.`,
        `v = √${fmtValue(v2)} = ${fmt(value)}.`,
        `Ответ: ${fmt(value)}.`,
      ],
      value,
    );
  }

  if (d.find === 'm') {
    const { v, e } = d;
    const v2 = v * v;
    const value = (2 * e) / v2;
    return pack(
      'physics-kinetic',
      [
        'Кинетическая энергия вычисляется по формуле E = mv²/2.',
        `Сначала найдите v² = ${fmtValue(v)}² = ${fmtValue(v2)}.`,
        `Из формулы 2E = mv² получится m = 2E/v². Посчитайте.`,
      ],
      [
        'Формула кинетической энергии: E = mv²/2, где m — масса, v — скорость.',
        `Подставим E = ${fmtValue(e)} Дж и v = ${fmtValue(v)} м/с: ${fmtValue(e)} = m·${fmtValue(v)}²/2.`,
        `Так как ${fmtValue(v)}² = ${fmtValue(v2)}, получаем ${fmtValue(e)} = m·${fmtValue(v2)}/2, то есть 2·${fmtValue(e)} = m·${fmtValue(v2)}.`,
        `m = ${fmtValue(2 * e)} : ${fmtValue(v2)} = ${fmt(value)}.`,
        `Ответ: ${fmt(value)}.`,
      ],
      value,
    );
  }

  const { m, v } = d;
  const v2 = v * v;
  const value = (m * v2) / 2;
  return pack(
    'physics-kinetic',
    [
      'Кинетическая энергия вычисляется по формуле E = mv²/2.',
      `Подставьте массу и скорость: E = ${fmtValue(m)}·${fmtValue(v)}²/2.`,
      `Сначала посчитайте ${fmtValue(v)}² = ${fmtValue(v2)}, затем умножьте на массу и разделите на 2.`,
    ],
    [
      'Формула кинетической энергии: E = mv²/2, где m — масса, v — скорость.',
      `Подставим m = ${fmtValue(m)} кг и v = ${fmtValue(v)} м/с: E = ${fmtValue(m)}·${fmtValue(v)}²/2.`,
      `${fmtValue(v)}² = ${fmtValue(v2)}, поэтому E = ${fmtValue(m)}·${fmtValue(v2)}/2.`,
      `E = ${fmtValue(m * v2)} : 2 = ${fmt(value)}.`,
      `Ответ: ${fmt(value)}.`,
    ],
    value,
  );
}

/** Данные для подсказок о потенциальной энергии (g = 9,8 м/с²). */
function solvePotentialExplain(text) {
  const d = potentialData(text);
  if (!d) return null;
  const g = 9.8;

  if (d.find === 'm') {
    const { e, h } = d;
    const gh = g * h;
    const value = e / gh;
    return pack(
      'physics-potential',
      [
        'Потенциальная энергия вычисляется по формуле E = mgh, где g = 9,8 м/с².',
        `Подставьте E = ${fmtValue(e)} Дж и h = ${fmtValue(h)} м: ${fmtValue(e)} = m·9,8·${fmtValue(h)}.`,
        `Сначала посчитайте 9,8·${fmtValue(h)} = ${fmtValue(gh)}. Потом разделите энергию на это число.`,
      ],
      [
        'Формула потенциальной энергии: E = mgh, где g = 9,8 м/с², h — высота.',
        `Подставим E = ${fmtValue(e)} Дж и h = ${fmtValue(h)} м: ${fmtValue(e)} = m·9,8·${fmtValue(h)}.`,
        `9,8·${fmtValue(h)} = ${fmtValue(gh)}, значит ${fmtValue(e)} = m·${fmtValue(gh)}.`,
        `m = ${fmtValue(e)} : ${fmtValue(gh)} = ${fmt(value)}.`,
        `Ответ: ${fmt(value)}.`,
      ],
      value,
    );
  }

  if (d.find === 'h') {
    const { e, m } = d;
    const gm = g * m;
    const value = e / gm;
    return pack(
      'physics-potential',
      [
        'Потенциальная энергия вычисляется по формуле E = mgh, где g = 9,8 м/с².',
        `Подставьте E = ${fmtValue(e)} Дж и m = ${fmtValue(m)} кг: ${fmtValue(e)} = ${fmtValue(m)}·9,8·h.`,
        `Сначала посчитайте ${fmtValue(m)}·9,8 = ${fmtValue(gm)}. Потом разделите энергию на это число.`,
      ],
      [
        'Формула потенциальной энергии: E = mgh, где g = 9,8 м/с², h — высота.',
        `Подставим E = ${fmtValue(e)} Дж и m = ${fmtValue(m)} кг: ${fmtValue(e)} = ${fmtValue(m)}·9,8·h.`,
        `${fmtValue(m)}·9,8 = ${fmtValue(gm)}, значит ${fmtValue(e)} = ${fmtValue(gm)}·h.`,
        `h = ${fmtValue(e)} : ${fmtValue(gm)} = ${fmt(value)}.`,
        `Ответ: ${fmt(value)}.`,
      ],
      value,
    );
  }

  const { m, h } = d;
  const value = m * g * h;
  return pack(
    'physics-potential',
    [
      'Потенциальная энергия вычисляется по формуле E = mgh, где g = 9,8 м/с².',
      `Подставьте m = ${fmtValue(m)} кг и h = ${fmtValue(h)} м: E = ${fmtValue(m)}·9,8·${fmtValue(h)}.`,
      `Посчитайте: ${fmtValue(m)}·9,8 = ${fmtValue(m * g)}, затем умножьте на ${fmtValue(h)}.`,
    ],
    [
      'Формула потенциальной энергии: E = mgh, где g = 9,8 м/с².',
      `Подставим m = ${fmtValue(m)} кг и h = ${fmtValue(h)} м: E = ${fmtValue(m)}·9,8·${fmtValue(h)}.`,
      `${fmtValue(m)}·9,8 = ${fmtValue(m * g)}.`,
      `E = ${fmtValue(m * g)}·${fmtValue(h)} = ${fmt(value)}.`,
      `Ответ: ${fmt(value)}.`,
    ],
    value,
  );
}

/** Перевод величины по формуле: «скольким … соответствует N …». */
function solveInputExplain(task, text) {
  const info = formulaInputInfo(formulas(task.stem), text);
  if (!info) return null;
  const { formula, rhs, variables: vars, input, leftVar } = info;

  const knowns = {};
  for (const v of vars) knowns[v] = input;
  const value = evalExpr(rhs, knowns);
  if (value == null) return null;

  const substituted = tidy(substitutedText(rhs, knowns));
  const names = vars.map((v) => `${varName(v)} = ${fmtValue(input)}`);
  const left = leftVar ? `${varName(leftVar)} = ` : '';

  return pack(
    'formula-input',
    [
      'Здесь нужно перевести одно значение в другую величину по формуле.',
      `Подставьте данное число вместо ${vars.map(varName).join(' и ')} — получится ${substituted}.`,
      `Осталось посчитать: ${left}${substituted}.`,
    ],
    [
      `Запишем формулу: ${tidy(formula)}.`,
      `По условию ${names.join(', ')}. Подставим это значение в формулу.`,
      `Получим ${left}${substituted}.`,
      `${left}${fmt(value)}.`,
      `Ответ: ${fmt(value)}.`,
    ],
    value,
  );
}

/** «Пользуясь этой формулой…» — подстановка или нахождение величины. */
function solveFormulaExplain(task, text) {
  const info = analyzeFormula(task, text);
  if (!info || info.value == null) return null;
  const { expr, leftVar, right, knowns, literals, unknown, value } = info;
  const formulaLine = `Запишем формулу: ${tidy(expr)}.`;

  // (1) Ищем величину из левой части — просто подставляем значения в правую часть.
  if (unknown === leftVar) {
    const substituted = tidy(substitutedText(right, knowns));
    const given = Object.keys(knowns).map((k) => `${varName(k)} = ${fmtValue(knowns[k])}`);

    const steps = [formulaLine, `Подставим значения: ${leftVar ? `${varName(leftVar)} = ` : ''}${substituted}.`];
    const factors = substituted.split('·').map((p) => Number(p.replace(',', '.').replace('−', '-')));
    if (factors.length > 1 && factors.every((f) => Number.isFinite(f))) steps.push(...chainSteps(factors).map((s) => `${s}.`));
    steps.push(`Получим ${leftVar ? `${varName(leftVar)} = ` : ''}${fmt(value)}.`, `Ответ: ${fmt(value)}.`);

    return {
      prototype: 'formula-substitute',
      hints: [
        'Это задание на подстановку значений в формулу.',
        `Подставьте данные числа вместо букв в формулу: ${given.join(', ')}.`,
        `Получится ${substituted}. Вычислите значение.`,
      ],
      steps,
      answer: fmt(value),
    };
  }

  // (2) Искомая величина в правой части, а слева задано её значение.
  const other = Object.fromEntries(Object.entries(knowns).filter(([k]) => k !== unknown));
  const target = knowns[leftVar];
  const equation = tidy(substitutedText(right, other, literals));
  const full = { ...knowns, [unknown]: value };
  const check = tidy(substitutedText(right, full, literals));
  const checkValue = evalExpr(right, full, literals);
  const rest = evalExpr(right, { ...other, [unknown]: 0 }, literals);
  const step = evalExpr(right, { ...other, [unknown]: 1 }, literals);
  const coefficient = rest == null || step == null ? null : step - rest;
  const given = Object.entries(other).map(([k, v]) => `${varName(k)} = ${fmtValue(v)}`);

  const line =
    rest != null && coefficient && Math.abs(rest) < 1e-9 && Math.abs(coefficient) > 1e-12
      ? `Отсюда ${varName(unknown)} = ${fmtValue(target)} : ${fmtValue(coefficient)} = ${fmt(value)}.`
      : `Отсюда ${varName(unknown)} = ${fmt(value)}.`;

  return {
    prototype: 'formula-inverse',
    hints: [
      'Величину нужно найти из формулы, а не просто подставить в неё.',
      `В условии дано ${given.join(', ')}. Искомая величина — ${varName(unknown)}.`,
      `Подставьте известные значения: получится уравнение ${fmtValue(target)} = ${equation}. Решите его относительно ${varName(unknown)}.`,
    ],
    steps: [
      formulaLine,
      `В условии ${given.join(', ')}. Искомая величина — ${varName(unknown)}.`,
      `Подставим известные значения: ${fmtValue(target)} = ${equation}.`,
      line,
      `Проверим: ${check} = ${fmtValue(checkValue)} — верно.`,
      `Ответ: ${fmt(value)}.`,
    ],
    answer: fmt(value),
  };
}

// --- точка входа -------------------------------------------------------------

/**
 * @param {object} task задание из tasks.ndjson
 * @returns {{prototype: string, hints: string[], steps: string[], answer: string|null}}
 */
export function describe(task) {
  const text = fixNumberText(plainText(task.stem));
  const kind = task.kind;

  if (kind === 'short') {
    const { knowns, literals } = taskValues(task, text);
    const expr = formulas(task.stem).find((e) => !e.includes('='));

    // «Найдите значение выражения …»
    if (expr && /найдите значение выражения/i.test(text)) {
      // Тема «Числа и вычисления»: только числа и знаки действий.
      const arithmetic = /[A-Za-z^]/.test(expr) ? null : solveArithmetic(expr);
      if (arithmetic) {
        return {
          prototype: 'arithmetic',
          hints: arithmetic.hints,
          steps: arithmetic.steps,
          answer: arithmetic.answer,
        };
      }
      const solved =
        solveRadical(expr, knowns, literals) || solveDegree(expr, knowns, literals) || solveCompute(expr, knowns, literals);
      if (solved) return solved;
    }

    // Формула нарисована картинкой: кинетическая и потенциальная энергия.
    const physics = solveKineticExplain(text) || solvePotentialExplain(text);
    if (physics) return physics;

    // «… вычисляется по формуле …», «Пользуясь этой формулой…»
    if (/формул/i.test(text) || /соответствует/i.test(text)) {
      const formulaExpr = formulas(task.stem).find((e) => e.includes('='));
      if (formulaExpr) {
        const legacy =
          (/(\d+)\s*\+\s*(\d+)\s*[·*]?\s*n/i.test(formulaExpr) && solveWell(text, formulaExpr)) ||
          (/ω/i.test(formulaExpr) && solveCentripetal(text)) ||
          (/I/i.test(formulaExpr) && solvePower(text));
        if (legacy) return legacy;
      }
      const formula = solveInputExplain(task, text) || solveFormulaExplain(task, text);
      if (formula) return formula;
    }

    if (expr) {
      const solved =
        solveRadical(expr, knowns, literals) || solveDegree(expr, knowns, literals) || solveCompute(expr, knowns, literals);
      if (solved) return solved;
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
