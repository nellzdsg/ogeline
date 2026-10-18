// Разбор арифметических выражений и пошаговое решение.
//
// Все задания темы «Числа и вычисления» вида «Найдите значение выражения»
// устроены одинаково: это одна операция над двумя числами, где каждое число —
// либо обыкновенная дробь, либо десятичная дробь. Поэтому вместо «универсальной»
// математики достаточно аккуратно разобрать выражение и объяснить шаги так, как
// это делают в школе.

/** Число в формате ОГЭ: целое или десятичная дробь с запятой. */
export function fmt(v) {
  if (!Number.isFinite(v)) return '?';
  const r = Math.round(v * 1e12) / 1e12;
  if (Number.isInteger(r)) return String(r);
  let s = String(r);
  if (s.includes('e') || s.includes('E')) s = r.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}

/** Приближённое значение для показа с «≈»: не больше трёх знаков после запятой. */
export function fmtApprox(v) {
  if (!Number.isFinite(v)) return '?';
  if (Number.isInteger(v)) return String(v);
  return fmt(Math.round(v * 1000) / 1000);
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

// --- разбор выражения --------------------------------------------------------

function tokenize(src) {
  const tokens = [];
  const re = /(sqrt|\d+(?:[.,]\d+)?|[()+\-*/^])/g;
  let m;
  while ((m = re.exec(src))) tokens.push(m[1]);
  return tokens;
}

export function parseExpr(src) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function parseAdd() {
    let node = parseMul();
    while (peek() === '+' || peek() === '-') {
      const op = take();
      node = { type: 'bin', op, l: node, r: parseMul() };
    }
    return node;
  }
  function parseMul() {
    let node = parseUnary();
    while (peek() === '*' || peek() === '/') {
      const op = take();
      node = { type: 'bin', op, l: node, r: parseUnary() };
    }
    return node;
  }
  function parseUnary() {
    if (peek() === '-') {
      take();
      return { type: 'neg', arg: parseUnary() };
    }
    if (peek() === '+') {
      take();
      return parseUnary();
    }
    return parsePow();
  }
  function parsePow() {
    const base = parsePrimary();
    if (peek() === '^') {
      take();
      return { type: 'pow', base, exp: parseUnary() };
    }
    return base;
  }
  function parsePrimary() {
    const t = take();
    if (t === '(') {
      const e = parseAdd();
      if (peek() === ')') take();
      return e;
    }
    if (t === 'sqrt') {
      if (peek() === '(') {
        take();
        const e = parseAdd();
        if (peek() === ')') take();
        return { type: 'sqrt', arg: e };
      }
      return { type: 'sqrt', arg: parsePrimary() };
    }
    if (t != null && /^\d/.test(t)) return { type: 'num', raw: t, value: Number(t.replace(',', '.')) };
    return { type: 'unknown', raw: String(t) };
  }

  return parseAdd();
}

export function evalNode(node) {
  if (!node) return null;
  switch (node.type) {
    case 'num':
      return node.value;
    case 'neg': {
      const v = evalNode(node.arg);
      return v == null ? null : -v;
    }
    case 'sqrt': {
      const v = evalNode(node.arg);
      return v == null ? null : Math.sqrt(v);
    }
    case 'pow': {
      const a = evalNode(node.base);
      const b = evalNode(node.exp);
      return a == null || b == null ? null : a ** b;
    }
    case 'bin': {
      const a = evalNode(node.l);
      const b = evalNode(node.r);
      if (a == null || b == null) return null;
      if (node.op === '+') return a + b;
      if (node.op === '-') return a - b;
      if (node.op === '*') return a * b;
      if (node.op === '/') return b === 0 ? null : a / b;
      return null;
    }
    default:
      return null;
  }
}

/** Целое значение узла, если он целый. */
function intValue(node) {
  if (!node) return null;
  if (node.type === 'num' && Number.isInteger(node.value)) return node.value;
  if (node.type === 'neg') {
    const v = intValue(node.arg);
    return v == null ? null : -v;
  }
  return null;
}

/** Обыкновенная дробь a/b, если узел — деление двух целых. */
function asFraction(node) {
  if (node && node.type === 'bin' && node.op === '/') {
    const a = intValue(node.l);
    const b = intValue(node.r);
    if (a != null && b != null && b !== 0) return { a, b };
  }
  return null;
}

function isDecimal(node) {
  return node && node.type === 'num' && /[.,]/.test(node.raw);
}

function decimalsCount(node) {
  const m = node.raw.match(/[.,](\d+)$/);
  return m ? m[1].length : 0;
}

function nodeText(node) {
  switch (node.type) {
    case 'num':
      return node.raw.replace('.', ',');
    case 'neg':
      return `−${nodeText(node.arg)}`;
    case 'sqrt':
      return `√(${nodeText(node.arg)})`;
    case 'pow':
      return `${nodeText(node.base)}^${nodeText(node.exp)}`;
    case 'bin':
      return `${nodeText(node.l)} ${node.op} ${nodeText(node.r)}`;
    default:
      return node.raw ?? '?';
  }
}

/** Десятичная запись дроби, если она конечная. */
function fractionToDecimal(a, b) {
  let d = b;
  if (d < 0) d = -d;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  if (d !== 1) return null;
  return fmt(a / b);
}

/**
 * Пошаговое решение задания «Найдите значение выражения».
 * @param {string} expr выражение в записи toExpr, например «((1)/(5)) + ((53)/(50))»
 * @returns {{steps: string[], answer: string, hints: string[]} | null}
 */
export function solveArithmetic(expr) {
  const node = parseExpr(expr);
  if (!node || node.type !== 'bin') return null;
  const op = node.op;
  if (!['+', '-', '*', '/'].includes(op)) return null;

  const lf = asFraction(node.l);
  const rf = asFraction(node.r);
  const value = evalNode(node);

  // Обе дроби — обыкновенные.
  if (lf && rf) return solveFractions(op, lf, rf, value);

  // Обе — десятичные/целые числа.
  if ((isDecimal(node.l) || node.l.type === 'num') && (isDecimal(node.r) || node.r.type === 'num')) {
    return solveDecimals(op, node.l, node.r, value);
  }

  return null;
}

function solveFractions(op, L, R, value) {
  const { a, b } = L;
  const { a: c, b: d } = R;
  const steps = [];
  const hints = [];

  if (op === '+' || op === '-') {
    const common = lcm(b, d);
    const A = a * (common / b);
    const C = c * (common / d);
    const sign = op;

    hints.push('Обыкновенные дроби можно складывать и вычитать только с одинаковыми знаменателями — значит, их нужно привести к общему знаменателю.');
    hints.push(`Наименьший общий знаменатель для ${b} и ${d} — это ${common}. Умножьте числитель и знаменатель каждой дроби так, чтобы знаменатель стал ${common}.`);
    hints.push(`После приведения получатся дроби ${A}/${common} и ${C}/${common}. Осталось выполнить действие: ${A} ${showOp(op)} ${C} = ?`);

    steps.push(`Приведём дроби к общему знаменателю. Для ${b} и ${d} наименьший общий знаменатель равен ${common}.`);
    if (b !== common) steps.push(`Умножим числитель и знаменатель первой дроби на ${common / b}: ${a}/${b} = ${A}/${common}.`);
    if (d !== common) steps.push(`Умножим числитель и знаменатель второй дроби на ${common / d}: ${c}/${d} = ${C}/${common}.`);
    steps.push(`Теперь знаменатели одинаковы: ${A}/${common} ${showOp(op)} ${C}/${common} = (${A} ${showOp(op)} ${C})/${common} = ${A + (op === '+' ? C : -C)}/${common}.`);

    const resNum = A + (op === '+' ? C : -C);
    const reduced = reduce(resNum, common);
    if (reduced.changed) steps.push(`Сократим дробь: ${resNum}/${common} = ${reduced.num}/${reduced.den}.`);
    const dec = reduced.den === 1 ? String(reduced.num) : fractionToDecimal(reduced.num, reduced.den);
    if (dec != null && reduced.den !== 1) {
      steps.push(`Переведём обыкновенную дробь в десятичную: ${reduced.num}/${reduced.den} = ${dec}.`);
    }
    const answer = dec != null ? dec : `${reduced.num}/${reduced.den}`;
    steps.push(`Ответ: ${answer}.`);
    return { steps, answer, hints };
  }

  if (op === '*') {
    const num = a * c;
    const den = b * d;
    hints.push('Чтобы умножить обыкновенные дроби, перемножьте числители и перемножьте знаменатели.');
    hints.push(`Числители: ${a}·${c} = ${num}. Знаменатели: ${b}·${d} = ${den}. Получаем дробь ${num}/${den}.`);
    hints.push(`Дробь ${num}/${den} ещё можно сократить — найдите общий делитель ${num} и ${den}.`);

    steps.push(`Умножим числители и знаменатели: ${a}/${b} · ${c}/${d} = (${a}·${c})/(${b}·${d}) = ${num}/${den}.`);
    const reduced = reduce(num, den);
    if (reduced.changed) steps.push(`Сократим дробь: ${num}/${den} = ${reduced.num}/${reduced.den}.`);
    const dec = reduced.den === 1 ? String(reduced.num) : fractionToDecimal(reduced.num, reduced.den);
    if (dec != null && reduced.den !== 1) steps.push(`Переведём в десятичную дробь: ${reduced.num}/${reduced.den} = ${dec}.`);
    const answer = dec != null ? dec : `${reduced.num}/${reduced.den}`;
    steps.push(`Ответ: ${answer}.`);
    return { steps, answer, hints };
  }

  // Деление: умножаем на обратную дробь.
  const num = a * d;
  const den = b * c;
  hints.push('Деление на дробь заменяется умножением на «перевёрнутую» дробь.');
  hints.push(`Дробь, обратная к ${c}/${d}, — это ${d}/${c}. Значит, ${a}/${b} : ${c}/${d} = ${a}/${b} · ${d}/${c}.`);
  hints.push(`Перемножьте: числители ${a}·${d} = ${num}, знаменатели ${b}·${c} = ${den}. Получается ${num}/${den}.`);

  steps.push(`Деление заменим умножением на обратную дробь: ${a}/${b} : ${c}/${d} = ${a}/${b} · ${d}/${c}.`);
  steps.push(`Умножим: (${a}·${d})/(${b}·${c}) = ${num}/${den}.`);
  const reduced = reduce(num, den);
  if (reduced.changed) steps.push(`Сократим дробь: ${num}/${den} = ${reduced.num}/${reduced.den}.`);
  const dec = reduced.den === 1 ? String(reduced.num) : fractionToDecimal(reduced.num, reduced.den);
  if (dec != null && reduced.den !== 1) steps.push(`Переведём в десятичную дробь: ${reduced.num}/${reduced.den} = ${dec}.`);
  const answer = dec != null ? dec : `${reduced.num}/${reduced.den}`;
  steps.push(`Ответ: ${answer}.`);
  return { steps, answer, hints };
}

function reduce(num, den) {
  const g = gcd(num, den) || 1;
  return { num: num / g, den: den / g, changed: g > 1 };
}

function showOp(op) {
  if (op === '*') return '·';
  if (op === '/') return ':';
  if (op === '-') return '−';
  return '+';
}

function solveDecimals(op, ln, rn, value) {
  const left = ln.raw.replace('.', ',');
  const right = rn.raw.replace('.', ',');
  const steps = [];
  const hints = [];

  if (op === '+' || op === '-') {
    hints.push('Запишите десятичные дроби друг под другом так, чтобы запятая стояла под запятой, и выполните действие.');
    hints.push(`Уравняйте число знаков после запятой и выполните ${op === '+' ? 'сложение' : 'вычитание'} поразрядно, не забывая про запятую в результате.`);
    hints.push(`Почти у цели: ${left} ${showOp(op)} ${right} = ?`);
    steps.push(`Запишем числа в столбик с выравниванием по запятой и выполним ${op === '+' ? 'сложение' : 'вычитание'}: ${left} ${showOp(op)} ${right} = ${fmt(value)}.`);
    steps.push(`Ответ: ${fmt(value)}.`);
    return { steps, answer: fmt(value), hints };
  }

  if (op === '*') {
    const sh = decimalsCount(ln) + decimalsCount(rn);
    const li = Math.round(ln.value * 10 ** decimalsCount(ln));
    const ri = Math.round(rn.value * 10 ** decimalsCount(rn));
    hints.push('Умножьте десятичные дроби как целые числа, а затем в результате отделите запятой столько знаков, сколько их было после запятой в обоих множителях.');
    hints.push(`Перемножим без запятых: ${li} · ${ri} = ${li * ri}. После запятой в множителях вместе ${sh} ${plural(sh, 'знак', 'знака', 'знаков')}.`);
    hints.push(`Осталось поставить запятую: отделите справа ${sh} ${plural(sh, 'цифру', 'цифры', 'цифр')}.`);
    steps.push(`Умножим, не обращая внимания на запятые: ${li} · ${ri} = ${li * ri}.`);
    steps.push(`В множителях после запятой вместе ${sh} ${plural(sh, 'знак', 'знака', 'знаков')}, поэтому в результате отделяем справа ${sh}: ${fmt(value)}.`);
    steps.push(`Ответ: ${fmt(value)}.`);
    return { steps, answer: fmt(value), hints };
  }

  // Деление десятичных дробей.
  const sh = Math.max(decimalsCount(ln), decimalsCount(rn));
  const li = Math.round(ln.value * 10 ** sh);
  const ri = Math.round(rn.value * 10 ** sh);
  hints.push('Чтобы делить на десятичную дробь, перенесите запятую в делимом и делителе на столько знаков вправо, чтобы делитель стал целым числом.');
  hints.push(`Перенесём запятую на ${sh} ${plural(sh, 'знак', 'знака', 'знаков')}: ${left} : ${right} = ${li} : ${ri}.`);
  hints.push(`Осталось выполнить деление: ${li} : ${ri} = ?`);
  steps.push(`Перенесём запятую в делимом и делителе на ${sh} ${plural(sh, 'знак', 'знака', 'знаков')} вправо, чтобы делитель стал целым: ${left} : ${right} = ${li} : ${ri}.`);
  steps.push(`Выполним деление: ${li} : ${ri} = ${fmt(value)}.`);
  steps.push(`Ответ: ${fmt(value)}.`);
  return { steps, answer: fmt(value), hints };
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// --- упрощение степеней ------------------------------------------------------

/** Токенизация выражения с переменными; null, если есть непонятный текст. */
function tokenizeAlgebra(src) {
  const re = /(sqrt|[A-Za-z\u03b1-\u03c9][A-Za-z0-9_\u03b1-\u03c9]*|\d+(?:[.,]\d+)?|[()+\-*/^])/g;
  const tokens = [];
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (src.slice(last, m.index).trim()) return null;
    tokens.push(m[1]);
    last = re.lastIndex;
  }
  if (src.slice(last).trim()) return null;
  return tokens;
}

/** Разбор выражения со степенями, корнями и переменными (для упрощения). */
export function parseAlgebra(src) {
  const tokens = tokenizeAlgebra(src);
  if (!tokens || !tokens.length) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function parseAdd() {
    let node = parseMul();
    while (peek() === '+' || peek() === '-') {
      const op = take();
      node = { type: 'bin', op, l: node, r: parseMul() };
    }
    return node;
  }
  function parseMul() {
    let node = parseUnary();
    while (peek() === '*' || peek() === '/') {
      const op = take();
      node = { type: 'bin', op, l: node, r: parseUnary() };
    }
    return node;
  }
  function parseUnary() {
    if (peek() === '-') {
      take();
      return { type: 'neg', arg: parseUnary() };
    }
    if (peek() === '+') {
      take();
      return parseUnary();
    }
    return parsePow();
  }
  function parsePow() {
    const base = parsePrimary();
    if (peek() === '^') {
      take();
      return { type: 'pow', base, exp: parseUnary() };
    }
    return base;
  }
  function parsePrimary() {
    const t = take();
    if (t === '(') {
      const e = parseAdd();
      if (peek() !== ')') throw new Error('скобка');
      take();
      return e;
    }
    if (t === ')') throw new Error('скобка');
    if (t === 'sqrt') {
      if (peek() === '(') {
        take();
        const e = parseAdd();
        if (peek() !== ')') throw new Error('корень');
        take();
        return { type: 'sqrt', arg: e };
      }
      return { type: 'sqrt', arg: parsePrimary() };
    }
    if (t != null && /^\d/.test(t)) return { type: 'num', raw: t, value: Number(t.replace(',', '.')) };
    if (t != null && /^[A-Za-z\u03b1-\u03c9]/.test(t)) return { type: 'unknown', raw: t };
    throw new Error('токен');
  }

  try {
    const node = parseAdd();
    if (pos !== tokens.length) return null;
    return node;
  } catch {
    return null;
  }
}

/** Степень или половинная степень, если показатель именно такой. */
function powerExponent(node) {
  const v = evalNode(node);
  if (!Number.isFinite(v)) return null;
  if (Number.isInteger(v)) return v;
  if (Math.abs(v * 2 - Math.round(v * 2)) < 1e-9) return v;
  return null;
}

const mulText = (t, e) => {
  if (t === '1') return String(e);
  return e < 0 ? `${t}·(${e})` : `${t}·${e}`;
};
const divText = (t, n) => (/[+\-]/.test(t) ? `(${t})/${n}` : `${t}/${n}`);

/** Показатель как знаковое число: «1» со знаком −1 → «-1». */
const signedText = (text, value) => (/^-?\d+$/.test(text) ? String(value) : text);

function mergePowers(left, right, sign) {
  const out = new Map(left);
  for (const [base, item] of right) {
    const value = sign * item.value;
    const prev = out.get(base);
    if (!prev) {
      out.set(base, { value, text: signedText(item.text, value) });
      continue;
    }
    out.set(base, { value: prev.value + value, text: `${prev.text} + ${signedText(item.text, value)}` });
  }
  return out;
}

/** Произведение степеней: Map<основание, {value: показатель, text: откуда он взялся}>. */
function powerWalk(node) {
  if (!node) return null;
  switch (node.type) {
    case 'num':
      return new Map([[String(node.value), { value: 1, text: '1' }]]);
    case 'unknown':
      return new Map([[node.raw, { value: 1, text: '1' }]]);
    case 'neg':
      return powerWalk(node.arg);
    case 'pow': {
      const e = powerExponent(node.exp);
      if (e == null) return null;
      const base = node.base ?? {};
      // (−a)^n: знак исчезает только при чётном целом показателе.
      if (base.type === 'neg' && (!Number.isInteger(e) || Math.abs(e) % 2 !== 0)) return null;
      const inner = powerWalk(base);
      if (!inner) return null;
      const out = new Map();
      for (const [key, item] of inner) {
        out.set(key, { value: item.value * e, text: mulText(item.text, e) });
      }
      return out;
    }
    case 'sqrt': {
      const inner = powerWalk(node.arg);
      if (!inner) return null;
      const out = new Map();
      for (const [key, item] of inner) {
        out.set(key, { value: item.value / 2, text: divText(item.text, 2) });
      }
      return out;
    }
    case 'bin': {
      if (node.op !== '*' && node.op !== '/') return null;
      const l = powerWalk(node.l);
      const r = powerWalk(node.r);
      if (!l || !r) return null;
      return mergePowers(l, r, node.op === '*' ? 1 : -1);
    }
    default:
      return null;
  }
}

/**
 * Приводит выражение к произведению степеней: (a³)⁸·a⁷/a²⁹ → a².
 * Возвращает список {base, exp, text} или null, если выражение не сводится
 * к произведению и частному степеней (например, содержит сумму).
 */
export function powerForm(expr) {
  const node = parseAlgebra(expr);
  if (!node) return null;
  const map = powerWalk(node);
  if (!map || !map.size) return null;
  const powers = [...map.entries()].map(([base, e]) => ({ base, exp: e.value, text: e.text }));
  if (powers.some((p) => !Number.isFinite(p.exp))) return null;
  return powers;
}

/** Значение произведения степеней при данных значениях переменных. */
export function powerValue(powers, knowns = {}) {
  let value = 1;
  for (const { base, exp } of powers) {
    const b = /^\d/.test(base) ? Number(base) : knowns[base];
    if (b == null) return null;
    value *= b ** exp;
  }
  return Number.isFinite(value) ? value : null;
}

/** Основание для показа: «a», «2» или «(a + b)». */
export function powerBase(base) {
  return /^\d/.test(base) ? String(Number(base)) : base;
}

// --- многочлены от одной переменной (уравнения и неравенства) ----------------

const ZERO_POLY = [0, 0, 0];

/** Убирает вычислительный шум: 1e-17 → 0. */
function snap(c) {
  if (Math.abs(c) < 1e-12) return 0;
  return c;
}

function polyAdd(l, r, sign) {
  return l.map((c, i) => snap(c + sign * r[i]));
}

/**
 * Произведение. Коэффициенты хранятся от старшей степени к младшей, поэтому
 * индексы складываются «наоборот»: степень слагаемого = 2 − индекс.
 */
function polyMul(l, r) {
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (!l[i]) continue;
    for (let j = 0; j < 3; j++) {
      if (!r[j]) continue;
      const k = i + j - 2;
      if (k < 0) return null;
      out[k] += l[i] * r[j];
    }
  }
  return out.map(snap);
}

/**
 * Многочлен степени не выше второй: [старший, средний, свободный] по степеням
 * переменной name. null, если выражение не многочлен (корни, дроби с x,
 * неизвестные буквы, степени больше второй).
 */
export function polyOf(node, name = 'x') {
  if (!node) return null;
  switch (node.type) {
    case 'num':
      return [0, 0, snap(node.value)];
    case 'unknown':
      return node.raw === name ? [0, 1, 0] : null;
    case 'neg': {
      const p = polyOf(node.arg, name);
      return p && p.map((c) => snap(-c));
    }
    case 'pow': {
      const base = polyOf(node.base, name);
      const exp = evalNode(node.exp);
      if (!base || !Number.isInteger(exp) || exp < 0 || exp > 2) return null;
      let out = [0, 0, 1];
      for (let i = 0; i < exp; i++) {
        out = polyMul(out, base);
        if (!out) return null;
      }
      return out;
    }
    case 'bin': {
      const l = polyOf(node.l, name);
      const r = polyOf(node.r, name);
      if (!l || !r) return null;
      if (node.op === '+') return polyAdd(l, r, 1);
      if (node.op === '-') return polyAdd(l, r, -1);
      if (node.op === '*') return polyMul(l, r);
      if (node.op === '/') {
        if (r[0] || r[1] || !r[2]) return null;
        return l.map((c) => snap(c / r[2]));
      }
      return null;
    }
    default:
      return null;
  }
}

/** Многочлен из уравнения «левая = правая». */
export function equationPoly(equation, name = 'x') {
  const m = /^([^=]+)=([^=]+)$/.exec(String(equation).trim());
  if (!m) return null;
  const left = polyOf(parseAlgebra(m[1]), name);
  const right = polyOf(parseAlgebra(m[2]), name);
  if (!left || !right) return null;
  return polyAdd(left, right, -1);
}

/** Многочлен из выражения (приводим к виду «… = 0»). */
export function polyFromExpression(expr, name = 'x') {
  return polyOf(parseAlgebra(expr), name);
}

/** Запись многочлена: «2x² − 5x + 3». Нулевые слагаемые опускаются. */
export function polyText(coeffs, name = 'x') {
  const symbols = [`${name}²`, name, ''];
  const parts = [];
  coeffs.forEach((c, i) => {
    if (!c) return;
    const abs = Math.abs(c);
    const body = symbols[i] && Math.abs(abs - 1) < 1e-12 ? symbols[i] : `${fmt(abs)}${symbols[i]}`;
    if (!parts.length) parts.push(`${c < 0 ? '−' : ''}${body}`);
    else parts.push(`${c < 0 ? '−' : '+'} ${body}`);
  });
  return parts.join(' ') || '0';
}

/** Степень многочлена. */
export function polyDegree(coeffs) {
  if (coeffs[0]) return 2;
  if (coeffs[1]) return 1;
  return coeffs[2] ? 0 : -1;
}

/** Корни многочлена: [] — нет корней, null — корней бесконечно много. */
export function polyRoots(coeffs) {
  const [c2, c1, c0] = coeffs;
  if (!c2) {
    if (!c1) return null;
    return [-c0 / c1];
  }
  const d = c1 * c1 - 4 * c2 * c0;
  if (d < -1e-9) return [];
  if (Math.abs(d) < 1e-9) return [-c1 / (2 * c2)];
  const s = Math.sqrt(d);
  return [(-c1 - s) / (2 * c2), (-c1 + s) / (2 * c2)].sort((a, b) => a - b);
}

export { gcd, lcm, plural, ZERO_POLY };

// --- множества решений неравенств --------------------------------------------

/**
 * Множество решений — список промежутков {lo, hi, loOpen, hiOpen}.
 * Пустой список означает «нет решений», единственный промежуток
 * (−∞; +∞) — «все числа».
 */
export function intervalAll() {
  return [{ lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true }];
}

const FLIP = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };

/** Решение неравенства P(x) ⋈ 0, где P задан коэффициентами. */
export function polyInequality(coeffs, op) {
  let [a2, a1, a0] = coeffs;
  let sign = op;
  // Приводим к случаю «старший коэффициент положительный», переворачивая знак.
  if (a2 < -1e-12 || (Math.abs(a2) < 1e-12 && a1 < -1e-12)) {
    [a2, a1, a0] = [-a2, -a1, -a0];
    sign = FLIP[op];
  }

  if (Math.abs(a2) < 1e-12) {
    if (Math.abs(a1) < 1e-12) {
      const holds = sign === '>' ? a0 > 0 : sign === '>=' ? a0 >= 0 : sign === '<' ? a0 < 0 : a0 <= 0;
      return holds ? intervalAll() : [];
    }
    const r = -a0 / a1;
    if (sign === '>') return [{ lo: r, hi: Infinity, loOpen: true, hiOpen: true }];
    if (sign === '>=') return [{ lo: r, hi: Infinity, loOpen: false, hiOpen: true }];
    if (sign === '<') return [{ lo: -Infinity, hi: r, loOpen: true, hiOpen: true }];
    return [{ lo: -Infinity, hi: r, loOpen: true, hiOpen: false }];
  }

  const roots = polyRoots([a2, a1, a0]);
  if (!roots.length) {
    // Ветви вверх, корней нет: P(x) > 0 при любом x.
    return sign === '>' || sign === '>=' ? intervalAll() : [];
  }
  if (roots.length === 1) {
    const r = roots[0];
    if (sign === '>') {
      return [
        { lo: -Infinity, hi: r, loOpen: true, hiOpen: true },
        { lo: r, hi: Infinity, loOpen: true, hiOpen: true },
      ];
    }
    if (sign === '>=') return intervalAll();
    if (sign === '<') return [];
    return [{ lo: r, hi: r, loOpen: false, hiOpen: false }];
  }

  const [r1, r2] = roots;
  if (sign === '>') {
    return [
      { lo: -Infinity, hi: r1, loOpen: true, hiOpen: true },
      { lo: r2, hi: Infinity, loOpen: true, hiOpen: true },
    ];
  }
  if (sign === '>=') {
    return [
      { lo: -Infinity, hi: r1, loOpen: true, hiOpen: false },
      { lo: r2, hi: Infinity, loOpen: false, hiOpen: true },
    ];
  }
  if (sign === '<') return [{ lo: r1, hi: r2, loOpen: true, hiOpen: true }];
  return [{ lo: r1, hi: r2, loOpen: false, hiOpen: false }];
}

/** Пересечение двух множеств — решение системы. */
export function intervalIntersect(a, b) {
  const out = [];
  for (const x of a) {
    for (const y of b) {
      const lo = Math.max(x.lo, y.lo);
      const hi = Math.min(x.hi, y.hi);
      if (lo > hi) continue;
      const loOpen = (lo === x.lo && x.loOpen) || (lo === y.lo && y.loOpen);
      const hiOpen = (hi === x.hi && x.hiOpen) || (hi === y.hi && y.hiOpen);
      if (lo === hi && (loOpen || hiOpen)) continue;
      out.push({ lo, hi, loOpen, hiOpen });
    }
  }
  return out.sort((p, q) => p.lo - q.lo);
}

/** Совпадают ли два множества (с точностью до порядка промежутков). */
export function intervalEqual(a, b, eps = 1e-9) {
  const same = (p, q) =>
    ((p.lo === q.lo) || (Number.isFinite(p.lo) && Number.isFinite(q.lo) && Math.abs(p.lo - q.lo) < eps)) &&
    ((p.hi === q.hi) || (Number.isFinite(p.hi) && Number.isFinite(q.hi) && Math.abs(p.hi - q.hi) < eps)) &&
    p.loOpen === q.loOpen &&
    p.hiOpen === q.hiOpen;
  return a.length === b.length && a.every((iv, i) => same(iv, b[i]));
}

/** Запись множества: «(−∞; −7) ∪ (7; +∞)», «нет решений». */
export function intervalText(set) {
  if (!set.length) return 'нет решений';
  if (set.length === 1 && set[0].lo === -Infinity && set[0].hi === Infinity) return '(−∞; +∞)';
  const num = (v) => fmt(v).replace('-', '−');
  const bounds = set.map((iv) => {
    if (iv.lo === iv.hi) return `{${num(iv.lo)}}`;
    const left = iv.lo === -Infinity ? '−∞' : num(iv.lo);
    const right = iv.hi === Infinity ? '+∞' : num(iv.hi);
    return `${iv.loOpen ? '(' : '['}${left}; ${right}${iv.hiOpen ? ')' : ']'}`;
  });
  return bounds.join(' ∪ ');
}

function parseBound(text) {
  const t = text.replace(/\s+/g, '').replace(/−/g, '-');
  if (/^\+?∞$/.test(t)) return Infinity;
  if (/^-∞$/.test(t)) return -Infinity;
  const v = Number(t.replace(',', '.').replace(/^\+/, ''));
  return Number.isFinite(v) ? v : null;
}

/** Разбор записи промежутка из варианта ответа; null — если это не промежуток. */
export function parseIntervalSet(text) {
  const s = String(text).replace(/\s+/g, '').replace(/−/g, '-');
  if (!s) return null;
  if (/^нетрешений\.?$/i.test(s)) return [];
  if (/^бесконечномножестворешений\.?$/i.test(s)) return intervalAll();
  const out = [];
  for (const part of s.split('∪')) {
    const m = /^([[(])([^;]*);([^)\]]*)([)\]])$/.exec(part);
    if (!m) return null;
    const lo = parseBound(m[2]);
    const hi = parseBound(m[3]);
    if (lo == null || hi == null) return null;
    out.push({ lo, hi, loOpen: m[1] === '(', hiOpen: m[4] === ')' });
  }
  return out;
}
