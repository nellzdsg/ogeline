// Разбор HTML, который отдаёт банк ФИПИ.
// Формат не документирован, поэтому парсер написан «по факту» и проверен на реальных страницах.

export const KIND_TITLES = {
  'Выбор ответа из предложенных вариантов': 'choice',
  'Выбор ответов из предложенных вариантов': 'multi',
  'Краткий ответ': 'short',
  'Развернутый ответ': 'full',
  'Установление соответствия': 'accord',
};

export const KIND_LABELS = {
  choice: 'Выбор ответа',
  multi: 'Выбор нескольких ответов',
  short: 'Краткий ответ',
  full: 'Развёрнутый ответ',
  accord: 'Установление соответствия',
};

/** Общее количество заданий в текущей выборке (банк сообщает его в скрипте). */
export function parseTotal(html) {
  const m = html.match(/setQCount\((\d+)/);
  return m ? Number(m[1]) : 0;
}

/**
 * Список тем и подтем со страницы банка.
 * @returns {{code: string, title: string, level: number}[]}
 */
export function parseThemes(html) {
  const themes = [];
  const seen = new Set();
  const re = /<label><input type='checkbox' name='theme' value='([^']*)'>([^<]*)<\/label>/g;
  for (const m of html.matchAll(re)) {
    const code = m[1].trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const rawTitle = m[2].replace(/&nbsp;/g, ' ').trim();
    // У подтем банк пишет заголовок с кодом в начале: «1.1 Натуральные и целые числа…»
    const title = rawTitle.replace(new RegExp(`^${code.replace(/\./g, '\\.')}\\s*`), '').trim();
    themes.push({ code, title: title || rawTitle, level: code.includes('.') ? 2 : 1 });
  }
  return themes.sort((a, b) => a.code.localeCompare(b.code, 'ru', { numeric: true }));
}

/** Разбирает страницу со списком заданий в набор «сырых» заданий. */
export function parseTaskList(html) {
  const tasks = [];
  const re = /<div class="qblock" id='q([0-9A-F]+)'>([\s\S]*?)(?=<div class="qblock" id='q|<\/body>)/g;

  for (const m of html.matchAll(re)) {
    const id = m[1];
    const block = m[2];

    const guid = (block.match(/name="guid" value="([0-9A-F]+)"/) || [])[1];
    if (!guid) continue;

    const hint = decodeEntities((block.match(/<div id="hint" class="hint" name="hint">([\s\S]*?)<\/div>/) || [])[1] || '');
    const stemHtml = (block.match(/<TD[^>]*class='cell_0'>([\s\S]*?)<\/TD>/) || [])[1] || '';

    const info = block.slice(block.indexOf(`<div id='i${id}'>`));
    const kesRaw = (info.match(/<td class="param-name">КЭС:<\/td><td class="param-row">([\s\S]*?)<\/td>/) || [])[1] || '';
    const kes = [...kesRaw.matchAll(/<div>([\s\S]*?)<\/div>/g)].map((x) => decodeEntities(stripTags(x[1])).trim()).filter(Boolean);

    const kindTitle = decodeEntities((info.match(/Тип ответа:<\/td><td>([^<]*)</) || [])[1] || '').trim();
    const kind = KIND_TITLES[kindTitle] || 'unknown';

    const options = parseOptions(block);

    tasks.push({ id, guid, hint, stemHtml, options, kes, kind, kindTitle });
  }

  return tasks;
}

function parseOptions(block) {
  const dtMatch = block.match(/<table[^>]*class="distractors-table"[^>]*>([\s\S]*?)<\/table>/);
  if (!dtMatch) return null;

  const options = [];
  const parts = dtMatch[1].split(/(?=<tr[^>]*class='active-distractor')/);
  for (const part of parts) {
    const m = part.match(/selectVariant\w+\((\d+)\)/);
    if (!m) continue;

    const afterMarker = part.indexOf('</b>');
    if (afterMarker === -1) continue;

    const trEnd = part.indexOf('</tr>');
    const body = trEnd === -1 ? part : part.slice(0, trEnd);

    // после «1)» идёт <td ...> с текстом варианта — берём содержимое этого td
    const tdOpen = body.indexOf('<td', afterMarker);
    const start = tdOpen === -1 ? -1 : body.indexOf('>', tdOpen) + 1;
    const end = body.lastIndexOf('</td>');
    if (start <= 0 || end <= start) continue;

    options.push({ n: Number(m[1]), html: body.slice(start, end).trim() });
  }

  return options.length ? options : null;
}

export function stripTags(html) {
  return String(html).replace(/<[^>]*>/g, ' ');
}

export function decodeEntities(text) {
  return String(text)
    .replace(/&nbsp;/g, ' ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
