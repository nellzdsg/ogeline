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

export { gcd, lcm, plural };
