// Вычисление ответов для заданий с кратким ответом.
//
// Принцип: программа НЕ доверяет себе. Она выдаёт список возможных ответов,
// а подтверждает их «оракул» ФИПИ. Если ни один вариант не подтвердился —
// задание остаётся без ответа и разбирается вручную.

import { parseFragment, toExpr, toInlineText, extractMathBlocks } from './mathml.mjs';
import { decodeEntities, stripTags } from './parse.mjs';

const MAX_CANDIDATES = 8;
const LETTER = 'A-Za-z\\u03b1-\\u03c9';

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

/**
 * В MathML умножение часто записано «вплотную» (ω²R). Добавляем знак умножения.
 */
export function insertImplicitProducts(expr) {
  let s = String(expr).replace(/\bsqrt\b/g, '@SQRT@');
  s = s.replace(new RegExp(`\\)\\s*(?=[\\d${LETTER}@(])`, 'g'), ')*');
  s = s.replace(new RegExp(`([\\d${LETTER}])\\s+(?=[${LETTER}(])`, 'g'), '$1*');
  return s.replace(/@SQRT@/g, 'sqrt');
}

export function variablesIn(expr) {
  const re = new RegExp(`(?<![${LETTER}0-9_])([${LETTER}])(?![${LETTER}0-9_])`, 'g');
  return [...new Set([...String(expr).matchAll(re)].map((m) => m[1]))];
}

function evalExpr(expr, subs = {}) {
  let prepared = insertImplicitProducts(expr);
  prepared = prepared.replace(/\^/g, '**').replace(/(\d),(\d)/g, '$1.$2');
  prepared = prepared.replace(
    new RegExp(`(?<![${LETTER}0-9_])([${LETTER}])(?![${LETTER}0-9_])`, 'g'),
    (v) => (v in subs ? `(${subs[v]})` : v),
  );

  const left = prepared.replace(/\*\*/g, '').replace(/sqrt/g, '');
  if (new RegExp(`[${LETTER}]`).test(left)) return null;

  try {
    // eslint-disable-next-line no-new-func
    const value = new Function('sqrt', `return (${prepared})`)(Math.sqrt);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
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
function solveLinear(expr, unknown, target, knowns = {}) {
  if (!Number.isFinite(target)) return null;
  const at0 = evalExpr(expr, { ...knowns, [unknown]: 0 });
  const at1 = evalExpr(expr, { ...knowns, [unknown]: 1 });
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
 * Задания вида «Пользуясь этой формулой, найдите X, если …» и
 * «… рассчитайте стоимость … из N …».
 */
export function solveFormula(task, text) {
  const expr = formulaExpressions(task.stem).find((e) => e.includes('='));
  if (!expr) return null;

  const [leftRaw, ...rest] = expr.split('=');
  const right = rest.join('=');
  const leftVar = (leftRaw.match(new RegExp(`[${LETTER}]`)) ?? [])[0] ?? null;
  const rightVars = variablesIn(right);
  const allVars = [...new Set([leftVar, ...rightVars].filter(Boolean))];
  if (!allVars.length) return null;

  const descriptions = variableDescriptions(text, allVars);

  // «… мощность составляет 150 …», «… сила тока равна 5 …»
  const assignments = {};
  for (const m of text.matchAll(/([А-Яа-яЁё][А-Яа-яЁё\s-]{2,80}?)\s*(?:равн[аоы]|равен|составляет)\s+(-?\d+(?:[.,]\d+)?)/gi)) {
    const value = Number.parseFloat(m[2].replace(',', '.'));
    const variable = matchByDescription(m[1], descriptions);
    if (variable && !(variable in assignments)) assignments[variable] = value;
  }

  // (1) «найдите <величину> X, если …»
  const asked = /найдите[^,.;]{0,80}?([A-Za-z\u03b1-\u03c9])(?![A-Za-z\u03b1-\u03c9])/.exec(text);

  if (process.env.DEBUG_SOLVER) {
    console.error(
      JSON.stringify(
        { text, expr, leftVar, rightVars, allVars, descriptions, assignments, asked: asked?.[1] ?? null },
        null,
        1,
      ),
    );
  }

  if (asked && allVars.includes(asked[1])) {
    const unknown = asked[1];
    const knowns = { ...assignments };
    delete knowns[unknown];

    const free = rightVars.filter((v) => !(v in knowns) && v !== unknown);
    if (!free.length) {
      const target = leftVar && leftVar !== unknown ? knowns[leftVar] ?? assignments[leftVar] : undefined;
      if (target != null) {
        const solved = solveLinear(right, unknown, target, knowns);
        if (solved != null) return solved;
      }
    }
    return null;
  }

  // (2) «… рассчитайте <величину> из N <чего-то> …»
  const fromCount = /(?:из|через|для)\s+(\d+(?:[.,]\d+)?)\s*([А-Яа-яЁё]{3,20})/i.exec(text);
  if (fromCount) {
    const value = Number.parseFloat(fromCount[1].replace(',', '.'));
    const inputDescriptions = {};
    for (const v of rightVars) if (descriptions[v]) inputDescriptions[v] = descriptions[v];
    const variable =
      matchByDescription(fromCount[2], inputDescriptions) ?? rightVars.find((v) => !(v in assignments));
    if (variable) {
      const result = evalExpr(right, { ...assignments, [variable]: value });
      if (result != null) return result;
    }
  }

  return null;
}

/** Главная точка входа: возможные ответы для задания с кратким ответом. */
export function candidatesFor(task) {
  const text = plainText(task.stem).replace(/\s+/g, ' ');
  const expressions = formulaExpressions(task.stem);
  const values = [];

  // «Найдите значение выражения …» — чистая арифметика
  if (/найдите значение выражения/i.test(text) && expressions.length === 1 && !expressions[0].includes('=')) {
    const value = evalExpr(expressions[0]);
    if (value != null) values.push(value);
  }

  // «Пользуясь этой формулой, …»
  if (/пользуясь этой формулой/i.test(text)) {
    const value = solveFormula(task, text);
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
