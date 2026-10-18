// Разбор формул MathML из банка ФИПИ.
//
// Зачем: условия заданий содержат формулы в виде MathML. Чтобы программа могла
// «прочитать» выражение (например, 1/5 + 53/50) и посчитать ответ, нужен перевод
// MathML в обычную запись.

const OP_MAP = {
  '−': '-',
  '–': '-',
  '—': '-',
  '·': '*',
  '⋅': '*',
  '×': '*',
  ':': '/',
  '≤': '<=',
  '≥': '>=',
};

function decode(text) {
  return String(text)
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/** Разбирает фрагмент XML/HTML в дерево. */
export function parseFragment(xml) {
  const source = decode(xml);
  const root = { tag: '#root', children: [] };
  const stack = [root];
  const re = /<\/?([a-zA-Z][\w:-]*)((?:\s[^>]*?)?)\/?>/g;

  let last = 0;
  let m;
  while ((m = re.exec(source))) {
    const text = source.slice(last, m.index);
    if (text) stack[stack.length - 1].children.push({ text });
    last = re.lastIndex;

    const full = m[0];
    const tag = m[1];
    if (full.startsWith('</')) {
      if (stack.length > 1) stack.pop();
    } else if (full.endsWith('/>')) {
      stack[stack.length - 1].children.push({ tag, children: [] });
    } else {
      const node = { tag, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
  }

  const tail = source.slice(last);
  if (tail) root.children.push({ text: tail });
  return root;
}

function textOf(node) {
  if (node.text != null) return node.text;
  return (node.children || []).map(textOf).join('');
}

function kids(node) {
  return (node.children || []).filter((c) => c.tag);
}

const INVISIBLE = /[\u2000-\u200f\u2028\u2029\u00a0]/g;

function cleanText(text) {
  return String(text).replace(INVISIBLE, '').trim();
}

/**
 * В mtext банк кладёт и единицы измерения (в, м, с), и переменные (ω), и числа.
 * Признак единицы измерения — кириллица; всё остальное оставляем.
 */
function textAsSymbol(node) {
  const t = cleanText(textOf(node));
  if (!t) return '';
  if (/[А-Яа-яЁё]/.test(t)) return '';
  return t;
}

/**
 * Нижний индекс («t_F», «d_1») сохраняем как часть имени переменной: без него
 * «d_1 d_2» превращается в «d d», и задачу уже не решить.
 */
function subExpr(base, sub) {
  const b = String(base).trim();
  const s = String(sub).trim();
  const simpleBase = new RegExp(`^[A-Za-z\\u03b1-\\u03c9][A-Za-z0-9\\u03b1-\\u03c9_]*$`).test(b);
  const simpleSub = /^[A-Za-z0-9\u03b1-\u03c9_]+$/.test(s);
  if (simpleBase && simpleSub) return `(${b}_${s})`;
  return `(${b})`;
}

/**
 * Переводит узел MathML в выражение, пригодное для вычисления.
 * @returns {string}
 */
export function toExpr(node) {
  if (node.text != null) return '';
  const tag = node.tag;
  const children = kids(node);

  switch (tag) {
    case 'math':
    case 'mrow':
    case 'mstyle':
    case 'semantics':
    case 'mpadded':
    case 'mphantom':
    case 'mtd':
    case 'mtr':
    case 'mtable':
      return children.map(toExpr).join(' ');

    case 'mn':
    case 'mi':
      return textOf(node).trim();

    case 'mtext':
      return textAsSymbol(node);

    case 'mo': {
      const raw = textOf(node).trim();
      const op = OP_MAP[raw] ?? raw;
      return /^[+\-*/^()<>=$|,]$/.test(op) ? op : '';
    }

    case 'mfrac':
      return `((${toExpr(children[0])})/(${toExpr(children[1])}))`;

    case 'msup':
      return `((${toExpr(children[0])})^(${toExpr(children[1])}))`;

    case 'mfenced':
      // Скобки группы. Без них теряется смысл: t_C = 5/9 (t_F − 32).
      return `(${children.map(toExpr).join(' ')})`;

    case 'msub':
      return subExpr(toExpr(children[0]), toExpr(children[1]));

    case 'msubsup':
      return `((${subExpr(toExpr(children[0]), toExpr(children[1]))})^(${toExpr(children[2])}))`;

    case 'msqrt':
      return `sqrt(${children.map(toExpr).join(' ')})`;

    case 'mroot':
      return `((${toExpr(children[0])})^(1/(${toExpr(children[1])})))`;

    default:
      return children.map(toExpr).join(' ');
  }
}

/**
 * Линейная запись формулы для чтения программой: «C=6000+4100n», «ω», «1/5+53/50».
 * Единицы измерения (кириллица) отбрасываются.
 */
export function toInlineText(node) {
  if (node.text != null) return cleanText(node.text);
  const children = kids(node);

  switch (node.tag) {
    case 'mn':
    case 'mi':
      return cleanText(textOf(node));
    case 'mtext':
      return textAsSymbol(node);
    case 'mo': {
      const raw = cleanText(textOf(node));
      return OP_MAP[raw] ?? raw;
    }
    case 'mfrac':
      return `${toInlineText(children[0])}/${toInlineText(children[1])}`;
    case 'msup':
      return `${toInlineText(children[0])}^${toInlineText(children[1])}`;
    case 'msub':
      return `${toInlineText(children[0])}_${toInlineText(children[1])}`;
    case 'msubsup':
      return `${toInlineText(children[0])}_${toInlineText(children[1])}^${toInlineText(children[2])}`;
    case 'msqrt':
      return `√(${children.map(toInlineText).join('')})`;
    case 'semantics':
    case 'mstyle':
      return children.map(toInlineText).join('');
    default:
      return children.map(toInlineText).join(' ');
  }
}

/**
 * Читаемая запись формулы (для логов и ручной проверки).
 * @returns {string}
 */
export function toPretty(node) {
  if (node.text != null) return node.text;
  const tag = node.tag;
  const children = kids(node);

  switch (tag) {
    case 'mn':
    case 'mi':
      return textOf(node).trim();
    case 'mtext':
      return textAsSymbol(node);
    case 'mo': {
      const raw = cleanText(textOf(node));
      return OP_MAP[raw] ?? raw;
    }
    case 'mfrac':
      return `${wrap(toPretty(children[0]))}/${wrap(toPretty(children[1]))}`;
    case 'msup':
      return `${wrap(toPretty(children[0]))}^${wrap(toPretty(children[1]))}`;
    case 'msub':
      return `${wrap(toPretty(children[0]))}_${wrap(toPretty(children[1]))}`;
    case 'msubsup':
      return `${wrap(toPretty(children[0]))}_${wrap(toPretty(children[1]))}^${wrap(toPretty(children[2]))}`;
    case 'msqrt':
      return `√(${children.map(toPretty).join(' ')})`;
    case 'mstyle':
    case 'semantics':
    case 'math':
    case 'mtable':
    case 'mtr':
      return children.map(toPretty).join('');
    default:
      return children.map(toPretty).join('');
  }
}

function wrap(text) {
  const t = text.trim();
  return /^[0-9.,]+$/.test(t) ? t : `(${t})`;
}

/** Все формулы <math>…</math> в заданном HTML. */
export function extractMathBlocks(html) {
  return [...String(html).matchAll(/<math\b[\s\S]*?<\/math>/g)].map((m) => m[0]);
}

const ALLOWED_EXPR = /^[0-9a-zA-Z+\-*/^().,\s]*$/;

/**
 * Вычисляет выражение, полученное из toExpr.
 * @returns {number|null}
 */
export function evaluate(expr) {
  const prepared = String(expr).replace(/\^/g, '**').replace(/(\d),(\d)/g, '$1.$2');
  if (!ALLOWED_EXPR.test(String(expr).replace(/\^/g, '*'))) return null;
  if (!/^[0-9+\-*/().\s*a-zA-Z]*$/.test(prepared)) return null;
  if (/\b(?!sqrt|Math)\w+\b/.test(prepared.replace(/sqrt/g, ''))) return null;

  try {
    // eslint-disable-next-line no-new-func
    const value = new Function('sqrt', 'return (' + prepared + ')')(Math.sqrt);
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Возвращает true, если выражение содержит буквенные переменные. */
export function hasVariables(expr) {
  return /[a-zA-Z]/.test(String(expr).replace(/sqrt/g, ''));
}
