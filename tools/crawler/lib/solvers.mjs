// Вычисление ответов для заданий с кратким ответом.
//
// Принцип: программа НЕ доверяет себе. Она выдаёт список возможных ответов,
// а подтверждает их «оракул» ФИПИ. Если ни один вариант не подтвердился —
// задание остаётся без ответа и разбирается вручную.

import { parseFragment, toExpr, toInlineText, extractMathBlocks } from './mathml.mjs';
import { decodeEntities, stripTags } from './parse.mjs';

const MAX_CANDIDATES = 8;
const LETTER = 'A-Za-z\\u03b1-\\u03c9';
/** Имя переменной: буква, дальше буквы, цифры и подчёркивания (t_C, d_1). */
const IDENT = `[${LETTER}][${LETTER}0-9_]*`;
const IDENT_RE = new RegExp(`(?<![${LETTER}0-9_.])(${IDENT})(?![${LETTER}0-9_])`, 'g');
/** Имена функций, которые встречаются в формулах банка. */
const FUNC_NAMES = ['sqrt', 'sin', 'cos', 'tg', 'ctg', 'tan', 'log', 'ln'];
const FUNC_RE = new RegExp(`\\b(${FUNC_NAMES.join('|')})\\b`, 'g');

/**
 * Приводим «числовой» текст банка к обычному виду: «8 ,5» → «8,5»,
 * тире и минус разных начертаний — к обычному дефису.
 */
export const fixNumberText = (s) =>
  String(s)
    .replace(/(\d)\s*,\s*(\d)/g, '$1,$2')
    .replace(/[−–—]/g, '-');

/** Запись числа в условии: «16», «8,5», «5/8», «7 2/5». */
const NUM_PAT =
  '[-−–—]?\\s*\\d+(?:[.,]\\d+)?(?:\\s+\\d+(?:[.,]\\d+)?\\s*/\\s*\\d+)?(?:\\s*/\\s*\\d+(?:[.,]\\d+)?)?';

/**
 * Читаемый текст условия. Формулы заменяются линейной записью, чтобы переменные
 * (ω, n, R) не терялись — иначе по условию нельзя понять, о какой величине речь.
 */
export function plainText(html) {
  let text = String(html);
  for (const block of extractMathBlocks(text)) {
    const inline = parseFragment(block).children.map(toInlineText).join('');
    text = text.replace(block, () => ` ${inline} `);
  }
  return decodeEntities(stripTags(text)).replace(/\s+/g, ' ').trim();
}

/** Все формулы задания как выражения. */
export function formulaExpressions(html) {
  return extractMathBlocks(html).map((block) =>
    parseFragment(block)
      .children.map(toExpr)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/** Имена функций прячем за плейсхолдеры, чтобы они не мешали разбору. */
function maskFunctions(s) {
  return String(s).replace(FUNC_RE, (f) => `@${f.toUpperCase()}@`);
}

const unmaskFunctions = (s) => String(s).replace(/@([A-Z]+)@/g, (_, f) => f.toLowerCase());

/** Расставляет знаки умножения: «ω²R», «4 √17», «(a+b)(a−b)», «2 t_C». */
function insertProducts(s) {
  let t = s.replace(new RegExp(`@([A-Z]+)@\\s*(${IDENT})`, 'g'), '@$1@($2)');
  t = t.replace(new RegExp(`\\)\\s*(?=[\\d${LETTER}@(])`, 'g'), ')*');
  t = t.replace(new RegExp(`([\\d${LETTER}@])\\s+(?=[${LETTER}@(])`, 'g'), '$1*');
  return t;
}

/**
 * Готовит формулу к вычислению: превращает запись «sin α» в вызов функции и
 * расставляет неявное умножение. Запись остаётся читаемой (sqrt, sin).
 */
export function insertImplicitProducts(expr) {
  return unmaskFunctions(insertProducts(maskFunctions(expr)));
}

/** Имена переменных в формуле (имена функций переменными не считаются). */
export function variablesIn(expr) {
  const found = [];
  for (const m of String(expr).matchAll(IDENT_RE)) {
    const name = m[1];
    if (FUNC_NAMES.includes(name)) continue;
    if (!found.includes(name)) found.push(name);
  }
  return found;
}

/**
 * Вычисляет формулу.
 * @param {string} expr
 * @param {Record<string, number>} knowns значения переменных
 * @param {{from: string, re: RegExp, value: number}[]} literals замены целых кусков
 *   формулы («sin α» = 0,625), которые нельзя записать одной переменной
 */
export function evalExpr(expr, knowns = {}, literals = []) {
  let s = fixNumberText(String(expr));
  for (const lit of literals) s = s.replace(lit.re, `(${lit.value})`);

  // Имена функций остаются плейсхолдерами, чтобы «sin» не приняли за переменную.
  let prepared = insertProducts(maskFunctions(s));
  prepared = prepared.replace(/\^/g, '**').replace(/(\d),(\d)/g, '$1.$2');
  prepared = prepared.replace(IDENT_RE, (name) => (name in knowns ? `(${knowns[name]})` : name));
  prepared = prepared.replace(/@([A-Z]+)@/g, (_, f) => `Math.${f.toLowerCase()}`);

  const left = prepared.replace(/Math\.[a-z]+/g, '').replace(/\*\*/g, '');
  if (new RegExp(IDENT).test(left)) return null;

  try {
    // eslint-disable-next-line no-new-func
    const value = new Function(`return (${prepared})`)();
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Число в записи ОГЭ: «2», «2,5», «-0,625» (минус — типографский). */
export function fmtValue(v) {
  const r = Math.round(v * 1e6) / 1e6;
  return String(r).replace('.', ',').replace('-', '−');
}

/** Формула с подставленными значениями — для показа в решении. */
export function substitutedText(expr, knowns = {}, literals = []) {
  let s = String(expr);
  for (const lit of literals) s = s.replace(lit.re, `(${fmtValue(lit.value)})`);
  s = insertImplicitProducts(s).replace(
    IDENT_RE,
    (name) => (name in knowns ? fmtValue(knowns[name]) : name),
  );
  return s
    .replace(/\s+/g, ' ')
    .replace(/\(\s*([A-Za-z\u03b1-\u03c9][A-Za-z0-9_\u03b1-\u03c9]*)\s*\)/g, '$1')
    .trim();
}

/**
 * Значения величин из условия: из блоков-равенств («d_2 = 16», «sin α = 5/8»)
 * и из текста («при a = 7 2/5»). Возвращает значения переменных и замены целых
 * кусков формулы.
 */
export function taskValues(task, text = '') {
  const knowns = {};
  const literals = [];
  const add = (name, value) => {
    const key = String(name).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!key || value == null) return;
    if (new RegExp(`^${IDENT}$`).test(key)) {
      if (!(key in knowns)) knowns[key] = value;
    } else if (!literals.some((l) => l.from === key)) {
      literals.push({ from: key, re: literalRe(key), value });
    }
  };

  for (const block of formulaExpressions(task.stem)) {
    const parts = block.split('=');
    if (parts.length !== 2) continue;
    const value = numberFrom(parts[1]);
    if (value != null) add(parts[0], value);
  }

  const re = new RegExp(
    `(${IDENT}(?:\\s+${IDENT})?)\\s*=\\s*(${NUM_PAT})(?![\\d.,])(?!\\s*[+\\-*/^])`,
    'g',
  );
  for (const m of fixNumberText(text).matchAll(re)) add(m[1], numberFrom(m[2]));

  return { knowns, literals };
}

/** Числа в формате ОГЭ: «2», «2,5», «-0,62». */
function numberCandidates(value) {
  const out = [];
  const add = (s) => {
    if (s && !out.includes(s)) out.push(s);
  };

  const v = Math.round(value * 1e6) / 1e6;
  if (Number.isInteger(v)) {
    add(String(v));
    return out;
  }

  // Сначала — точное значение с минимальным числом знаков, затем округления на случай,
  // если ФИПИ ожидает округлённый ответ.
  for (let digits = 0; digits <= 6; digits++) {
    const fixed = v.toFixed(digits);
    if (Number.parseFloat(fixed) === v) {
      add(fixed.replace('.', ','));
      add(fixed);
      break;
    }
  }

  for (let digits = 0; digits <= 3; digits++) {
    const fixed = v.toFixed(digits);
    if (Number.parseFloat(fixed) !== v) add(fixed.replace('.', ','));
  }

  return out.slice(0, 5);
}

/** Решает линейное уравнение expr(unknown) = target при известных остальных величинах. */
function solveLinear(expr, unknown, target, knowns = {}, literals = []) {
  if (!Number.isFinite(target)) return null;
  const at0 = evalExpr(expr, { ...knowns, [unknown]: 0 }, literals);
  const at1 = evalExpr(expr, { ...knowns, [unknown]: 1 }, literals);
  if (at0 == null || at1 == null) return null;
  const k = at1 - at0;
  if (Math.abs(k) < 1e-12) return null;
  return (target - at0) / k;
}

function normalizeWords(text) {
  return String(text)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Сопоставляет словесное описание («угловая скорость») с переменной формулы,
 * пользуясь расшифровками из условия («где ω — угловая скорость»).
 */
function matchByDescription(phrase, descriptions) {
  const words = normalizeWords(phrase)
    .split(' ')
    .filter((w) => w.length >= 4);
  if (!words.length) return null;

  let best = null;
  let bestScore = 0;
  for (const [variable, description] of Object.entries(descriptions)) {
    const desc = normalizeWords(description);
    if (desc.length < 3) continue;
    const score = words.filter((w) => desc.split(' ').some((d) => d.startsWith(w.slice(0, 5)))).length;
    if (score > bestScore) {
      bestScore = score;
      best = variable;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Расшифровки переменных: «где ω — угловая скорость» и название величины перед формулой. */
function variableDescriptions(text, variables) {
  const descriptions = {};
  for (const v of variables) {
    const m = new RegExp(`(?:^|[^${LETTER}])${v}\\s*[—–-]\\s*([^,.]+)`).exec(text);
    if (m) descriptions[v] = m[1].replace(/\([^)]*\)/g, ' ');
  }

  const lead = /^([\s\S]{0,140}?)(?:вычисляется|рассчитывается|находится|определяется)\s+по\s+формуле/i.exec(text);
  if (lead) {
    let chunk = lead[1].replace(/^[\s\S]*?[»"”]\s*/, '').replace(/\([^)]*\)/g, ' ');
    chunk = chunk.trim();
    if (chunk) {
      const left = variables[0];
      if (left && !descriptions[left]) descriptions[left] = chunk;
    }
  }
  return descriptions;
}

/**
 * Значение из короткой записи: «5/8», «1,8», «7 2/5», «1000 (()/((()^(3))))».
 * Смешанное число проверяем раньше вычисления: «7 2/5» — это 7 + 2/5, а не 7·2/5.
 */
function numberFrom(raw) {
  const text = fixNumberText(raw).trim();
  const flat = text.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();

  const mixed = /^([-−–—]?\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(flat);
  if (mixed) {
    const whole = Number.parseFloat(mixed[1].replace('−', '-'));
    return Math.sign(whole) * (Math.abs(whole) + Number(mixed[2]) / Number(mixed[3]));
  }

  const value = evalExpr(text);
  if (value != null) return value;

  // «1000 (()/((()^(3))))» — единицы измерения банк рисует пустой дробью.
  const leftover = flat.replace(FUNC_RE, '').replace(/[^A-Za-z\u03b1-\u03c9]/g, '');
  if (leftover) return null;
  const m = /(-?\d+(?:[.,]\d+)?)/.exec(flat);
  return m ? Number.parseFloat(m[1].replace(',', '.')) : null;
}

/** Регулярное выражение для целого куска формулы («sin α»). */
function literalRe(phrase) {
  const parts = String(phrase)
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(parts.join('\\s*'), 'g');
}

const deaccent = (s) => String(s).toLowerCase().replace(/ё/g, 'е');

/** «тело объёмом 0,05» — число рядом со словом из описания величины. */
function describedNumber(text, description) {
  const hay = deaccent(text);
  const words = deaccent(description)
    .split(/[^a-zа-я0-9]+/)
    .filter((w) => w.length >= 4);
  for (const w of words) {
    const stem = w.slice(0, Math.max(4, w.length - 2));
    const re = new RegExp(`${stem}[а-я]*\\s+(?:равн[аоы]|составляет\\s+)?(-?\\d+(?:[.,]\\d+)?)`);
    const m = re.exec(hay);
    if (m) return Number.parseFloat(m[1].replace(',', '.'));
  }
  return null;
}

/**
 * Значения, которые условие сообщает прямо: «d_2 = 16», «sin α = 5/8», «ρ = 1000».
 * Часть левых частей окажется обычными переменными, часть — целыми кусками
 * формулы («sin α»), поэтому возвращаем их как есть.
 */
function collectEquations(task, text, mainExpr) {
  const result = [];
  const push = (lhs, value) => {
    const name = String(lhs).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name || !Number.isFinite(value)) return;
    if (result.some((e) => e.lhs === name)) return;
    result.push({ lhs: name, value });
  };

  for (const block of formulaExpressions(task.stem)) {
    if (block === mainExpr) continue;
    const parts = block.split('=');
    if (parts.length !== 2) continue;
    const value = numberFrom(parts[1]);
    if (value != null) push(parts[0], value);
  }

  // Из текста: «sin α = 5/8», «d_2 = 16». Значения, за которыми сразу идёт знак
  // действия, — это сама формула («C = 6000 + 4100 n»), их пропускаем.
  const re = new RegExp(
    `(${IDENT}(?:\\s+${IDENT})?)\\s*=\\s*(${NUM_PAT})(?![\\d.,])(?!\\s*[+\\-*/^])`,
    'g',
  );
  for (const m of text.matchAll(re)) {
    const value = numberFrom(m[2]);
    if (value != null) push(m[1], value);
  }
  return result;
}

/**
 * Задания вида «Пользуясь этой формулой, найдите X, если …»,
 * «сила … вычисляется по формуле …», «… рассчитайте стоимость … из N …».
 * Возвращает не только ответ, но и всё, из чего он получен, — это нужно
 * генератору решения.
 */
export function analyzeFormula(task, text) {
  const expr = formulaExpressions(task.stem).find((e) => e.includes('='));
  if (!expr) return null;

  const eqAt = expr.indexOf('=');
  const leftRaw = expr.slice(0, eqAt);
  const right = expr.slice(eqAt + 1);
  const leftVar = variablesIn(leftRaw)[0] ?? null;

  const knowns = {};
  const literals = [];
  for (const { lhs, value } of collectEquations(task, text, expr)) {
    if (new RegExp(`^${IDENT}$`).test(lhs)) {
      if (!(lhs in knowns)) knowns[lhs] = value;
    } else {
      literals.push({ from: lhs, re: literalRe(lhs), value });
    }
  }

  // Переменные правой части: то, что скрыто в кусках вроде «sin α», переменной не является.
  let rightClean = right;
  for (const lit of literals) rightClean = rightClean.replace(lit.re, ' ');
  const rightVars = variablesIn(rightClean);
  const allVars = [...new Set([leftVar, ...rightVars].filter(Boolean))];
  if (!allVars.length) return null;

  const descriptions = variableDescriptions(text, allVars);

  // «… мощность составляет 150 …», «… сила тока равна 5 …»
  const valueRe = new RegExp(
    `([А-Яа-яЁё][А-Яа-яЁё\\s-]{2,80}?)\\s*(?:равн[аоы]|равен|составляет)\\s+(${NUM_PAT})`,
    'gi',
  );
  for (const m of text.matchAll(valueRe)) {
    const variable = matchByDescription(m[1], descriptions);
    const value = numberFrom(m[2]);
    if (variable && value != null && !(variable in knowns)) knowns[variable] = value;
  }

  // «тело объёмом 0,05», «массой 2000 кг»
  for (const v of allVars) {
    if (v in knowns || !descriptions[v]) continue;
    const value = describedNumber(text, descriptions[v]);
    if (value != null) knowns[v] = value;
  }

  // Что именно просят найти.
  let unknown = null;
  const askedVar = new RegExp(`найдите[^,.;]{0,80}?(${IDENT})(?![${LETTER}0-9_])`).exec(text);
  if (askedVar && allVars.includes(askedVar[1])) unknown = askedVar[1];
  if (!unknown) {
    const phrase = /найдите\s+([^,.;]{2,70})/i.exec(text);
    if (phrase) {
      const byDescription = matchByDescription(phrase[1], descriptions);
      if (byDescription && allVars.includes(byDescription)) unknown = byDescription;
    }
  }
  if (!unknown) {
    const free = allVars.filter((v) => !(v in knowns));
    if (free.length === 1) [unknown] = free;
  }

  if (process.env.DEBUG_SOLVER) {
    console.error(
      JSON.stringify({ text, expr, leftVar, rightVars, allVars, knowns, literals: literals.map((l) => l.from), descriptions, unknown }, null, 1),
    );
  }

  let value = null;

  // (1) Ищем величину из левой части: всё остальное известно, просто считаем.
  if (unknown && unknown === leftVar) {
    value = evalExpr(right, knowns, literals);
  }

  // (2) Ищем величину в правой части, а слева задано её значение.
  if (value == null && unknown && unknown !== leftVar && Number.isFinite(knowns[leftVar])) {
    const freeRight = rightVars.filter((v) => v !== unknown && !(v in knowns));
    if (!freeRight.length) {
      const knownsForSolve = { ...knowns };
      delete knownsForSolve[unknown];
      value = solveLinear(right, unknown, knowns[leftVar], knownsForSolve, literals);
    }
  }

  // (3) «… рассчитайте <величину> из N <чего-то> …»
  if (value == null) {
    const fromCount = /(?:из|через|для)\s+(\d+(?:[.,]\d+)?)\s*([А-Яа-яЁё]{3,20})/i.exec(text);
    if (fromCount) {
      const input = Number.parseFloat(fromCount[1].replace(',', '.'));
      const inputDescriptions = {};
      for (const v of rightVars) if (descriptions[v]) inputDescriptions[v] = descriptions[v];
      const variable =
        matchByDescription(fromCount[2], inputDescriptions) ?? rightVars.find((v) => !(v in knowns));
      if (variable) value = evalExpr(right, { ...knowns, [variable]: input }, literals);
    }
  }

  if (value == null) return null;
  return { expr, leftVar, right, rightVars, allVars, knowns, literals, unknown, value };
}

/** Ответ задания «Пользуясь этой формулой…». */
export function solveFormula(task, text) {
  const info = analyzeFormula(task, text);
  return info ? info.value : null;
}

/** Число из строки: «-3,5», «−3,5», «9,8». */
function num(s) {
  const t = String(s).replace(/\s+/g, '').replace(/[−–—]/g, '-').replace(',', '.');
  const v = Number.parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

/** «стоимость», «тысяч» → множитель: 289 тысяч → 289000. */
function multiplier(word) {
  if (!word) return 1;
  if (/миллион/i.test(word)) return 1e6;
  if (/тысяч|тыс\b/i.test(word)) return 1e3;
  return 1;
}

/** Значения переменных из блоков-равенств («a = 7», «b = √6», «a = 7 2/5»). */
function assignmentsFrom(expressions) {
  const subs = {};
  for (const e of expressions) {
    const m = new RegExp(`^\\s*(${IDENT})\\s*=\\s*(.+?)\\s*$`).exec(e);
    if (!m) continue;
    const value = numberFrom(m[2]);
    if (value != null) subs[m[1]] = value;
  }
  return subs;
}

/** Значения переменных из текста условия: «при a = 7 и b = 6,5». */
function assignmentsFromText(text, subs = {}) {
  const re = new RegExp(`(${IDENT})\\s*=\\s*(${NUM_PAT})`, 'g');
  for (const m of text.matchAll(/при\s+([^.;]{0,90})/gi)) {
    for (const pair of m[1].matchAll(re)) {
      const value = numberFrom(pair[2]);
      if (value != null && !(pair[1] in subs)) subs[pair[1]] = value;
    }
  }
  return subs;
}

/**
 * «Скольким градусам по шкале Фаренгейта соответствует 85 градусов по шкале
 * Цельсия?» — данное число подставляется в правую часть формулы.
 */
export function formulaInputInfo(expressions, text) {
  const formula = expressions.find((e) => e.includes('='));
  if (!formula) return null;
  const rhs = formula.slice(formula.indexOf('=') + 1);
  const m = new RegExp(`соответствует\\s*(${NUM_PAT})`, 'i').exec(fixNumberText(text));
  if (!m) return null;

  const input = numberFrom(m[1]);
  if (input == null) return null;
  const vars = variablesIn(rhs);
  if (!vars.length) return null;
  return { formula, rhs, leftVar: variablesIn(formula.slice(0, formula.indexOf('=')))[0] ?? null, variables: vars, input };
}

function solveByFormulaInput(expressions, text) {
  const info = formulaInputInfo(expressions, text);
  if (!info) return null;
  const subs = {};
  for (const v of info.variables) subs[v] = info.input;
  return evalExpr(info.rhs, subs);
}

/**
 * Задания, где формула нарисована картинкой (в MathML её нет), а величины
 * стандартные: кинетическая энергия E = mv²/2 и потенциальная E = mgh.
 * Расчёт всё равно подтверждается у ФИПИ, поэтому ошибка невозможна.
 */
export function kineticData(text) {
  if (!/кинетическ/i.test(text)) return null;
  const mass = /массой\s+(\d+(?:[.,]\d+)?)\s*кг/i.exec(text);
  const energy = /энергией\s+(\d+(?:[.,]\d+)?)\s*(тысяч[а-я]*|миллион[а-я]*)?\s*джоул/i.exec(text);
  const speed = /скоростью\s+(\d+(?:[.,]\d+)?)/i.exec(text);
  const m = mass ? num(mass[1]) : null;
  const e = energy ? num(energy[1]) * multiplier(energy[2]) : null;
  const v = speed ? num(speed[1]) : null;

  if (/найдите\s+скорост/i.test(text) && m && e) return { find: 'v', m, e };
  if (/найдите\s+масс/i.test(text) && v && e) return { find: 'm', v, e };
  if (/найдите\s+кинетическ/i.test(text) && m && v) return { find: 'E', m, v };
  return null;
}

function solveKineticEnergy(text) {
  const d = kineticData(text);
  if (!d) return null;
  if (d.find === 'v') return Math.sqrt((2 * d.e) / d.m);
  if (d.find === 'm') return (2 * d.e) / (d.v * d.v);
  return (d.m * d.v * d.v) / 2;
}

export function potentialData(text) {
  if (!/потенциальн/i.test(text)) return null;
  const height = /на\s+высоте\s+(\d+(?:[.,]\d+)?)\s*м/i.exec(text);
  const energy = /энергия\s+равна\s+(\d+(?:[.,]\d+)?)\s*(тысяч[а-я]*|миллион[а-я]*)?\s*джоул/i.exec(text);
  const mass = /массой\s+(\d+(?:[.,]\d+)?)\s*кг/i.exec(text);
  const h = height ? num(height[1]) : null;
  const e = energy ? num(energy[1]) * multiplier(energy[2]) : null;
  const m = mass ? num(mass[1]) : null;

  if (/найдите\s+масс/i.test(text) && e && h) return { find: 'm', e, h };
  if (/найдите\s+высот/i.test(text) && e && m) return { find: 'h', e, m };
  if (/найдите\s+потенциальн/i.test(text) && m && h) return { find: 'E', m, h };
  return null;
}

function solvePotentialEnergy(text) {
  const d = potentialData(text);
  if (!d) return null;
  const g = 9.8;
  if (d.find === 'm') return d.e / (g * d.h);
  if (d.find === 'h') return d.e / (g * d.m);
  return d.m * g * d.h;
}

/** Главная точка входа: возможные ответы для задания с кратким ответом. */
export function candidatesFor(task) {
  const text = fixNumberText(plainText(task.stem).replace(/\s+/g, ' '));
  const expressions = formulaExpressions(task.stem);
  const values = [];

  // «Найдите значение выражения …» — арифметика, при необходимости с подстановкой
  // значений переменных: «… при a = 7», «… при a = 6 и b = √6».
  if (/найдите значение выражения/i.test(text)) {
    const main = expressions.find((e) => !e.includes('='));
    if (main) {
      const subs = assignmentsFromText(text, assignmentsFrom(expressions));
      const value = evalExpr(main, subs);
      if (value != null) values.push(value);
    }
  }

  // «Скольким … соответствует …» — подстановка данного числа в формулу
  {
    const value = solveByFormulaInput(expressions, text);
    if (value != null) values.push(value);
  }

  // «… вычисляется по формуле …», «Пользуясь этой формулой, найдите …»
  // («соответствует» — это уже разобранный выше случай подстановки)
  if (/формул/i.test(text) && !/соответствует/i.test(text)) {
    const value = solveFormula(task, text);
    if (value != null) values.push(value);
  }

  // Формула нарисована картинкой — считаем по стандартным формулам физики.
  for (const solver of [solveKineticEnergy, solvePotentialEnergy]) {
    const value = solver(text);
    if (value != null) values.push(value);
  }

  const out = [];
  for (const value of values) {
    for (const candidate of numberCandidates(value)) {
      if (!out.includes(candidate)) out.push(candidate);
      if (out.length >= MAX_CANDIDATES) return out;
    }
  }
  return out;
}
