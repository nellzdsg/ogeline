// Задания про шины (ОГЭ, блок 1–5).
//
// Маркировка шины «205/55 R16» означает: ширина 205 мм, профиль 55 % от ширины,
// посадочный диаметр диска 16 дюймов. Отсюда:
//   высота боковины = ширина · профиль / 100;
//   диаметр колеса  = диаметр диска · 25,4 + 2 · высота боковины.
//
// Часть заданий набора не содержит заводской маркировки (она в общем описании,
// которого в банке нет). Такие задания мы восстанавливаем по подтверждённому
// ответу: подбираем маркировку, которая даёт ровно тот же ответ.

import { decodeEntities, stripTags } from './parse.mjs';

/** «275/70 R16» → { w: 275, p: 70, d: 16 }. */
export function parseMarking(text) {
  const m = String(text).match(/(\d{3})\s*\/\s*(\d{2})\s*R\s*(\d{1,2})(?!\d)/i);
  if (!m) return null;
  return { w: Number(m[1]), p: Number(m[2]), d: Number(m[3]) };
}

export function markingText(m) {
  return `${m.w}/${m.p} R${m.d}`;
}

/** Округление до сотых — чтобы не ловить хвосты плавающей точки. */
export const round2 = (v) => Math.round(v * 100) / 100;

/** Высота боковины в миллиметрах. */
export function sidewallHeight(m) {
  return (m.w * m.p) / 100;
}

/** Диаметр колеса в миллиметрах. */
export function wheelDiameter(m) {
  return m.d * 25.4 + 2 * sidewallHeight(m);
}

/** Разбирает таблицу разрешённых размеров шин. */
export function tireTable(html) {
  const table = (String(html).match(/<table[\s\S]*?<\/table>/i) || [])[0];
  if (!table) return null;

  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      decodeEntities(stripTags(c[1]))
        .replace(/[\u200a\u00a0]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    ),
  );

  const headAt = rows.findIndex((r) => r.some((c) => /диаметр диска/i.test(c)));
  if (headAt < 0 || !rows[headAt + 1]) return null;

  const diameters = rows[headAt + 1].map((c) => Number(c)).filter((n) => Number.isFinite(n));
  if (!diameters.length) return null;

  const data = rows
    .slice(headAt + 2)
    .filter((r) => r.length > 1 && Number.isFinite(Number(r[0])))
    .map((r) => ({ width: Number(r[0]), cells: r.slice(1) }));

  return { diameters, data };
}

const isDash = (s) => /^[—–-]$/.test(String(s).trim());

/**
 * Определяет тип задания про шины.
 * @returns {null | {type: string, value?: number, marking?: object, direction?: 'up'|'down'}}
 */
export function solveTire(text, html = '') {
  const t = String(text);

  // «Сколько миллиметров составляет высота боковины шины … 275/70 R16?»
  if (/высот[аы]\s+боковин/i.test(t)) {
    const marking = parseMarking(t);
    if (marking) return { type: 'sidewall', marking, value: sidewallHeight(marking) };
  }

  // «Шины какой наибольшей (наименьшей) ширины можно устанавливать …»
  if (/какой\s+(наибольшей|наименьшей)\s+ширины/i.test(t)) {
    const table = tireTable(html || t);
    const dm = t.match(/диаметр\w*\s+диска\s+(?:равен|равняется)\s+(\d+)/i);
    if (table && dm) {
      const idx = table.diameters.indexOf(Number(dm[1]));
      if (idx >= 0) {
        const widths = table.data
          .filter((r) => r.cells[idx] && !isDash(r.cells[idx]))
          .map((r) => r.width);
        if (widths.length) {
          return {
            type: 'table',
            value: /наибольшей/i.test(t) ? Math.max(...widths) : Math.min(...widths),
          };
        }
      }
    }
  }

  // «Найдите диаметр колеса автомобиля, выходящего с завода» — нужна заводская маркировка.
  if (/диаметр\w*\s+колеса\s+автомобиля,\s+выходящего\s+с\s+завода/i.test(t)) {
    return { type: 'factory' };
  }

  // «На сколько миллиметров увеличится/уменьшится диаметр колеса … шинами 235/50 R18?»
  const diff = t.match(
    /на\s+сколько\s+миллиметров\s+(увеличится|уменьшится)\s+диаметр\w*\s+колеса[\s\S]*?(\d{3}\s*\/\s*\d{2}\s*R\s*\d{1,2})/i,
  );
  if (diff) {
    const marking = parseMarking(diff[2]);
    if (marking) return { type: 'diameter', direction: diff[1].toLowerCase() === 'увеличится' ? 'up' : 'down', marking };
  }

  // «На сколько процентов увеличится/уменьшится пробег …»
  const pct = t.match(
    /на\s+сколько\s+процентов\s+(увеличится|уменьшится)\s+пробег[\s\S]*?(\d{3}\s*\/\s*\d{2}\s*R\s*\d{1,2})/i,
  );
  if (pct) {
    const marking = parseMarking(pct[2]);
    if (marking) return { type: 'percent', direction: pct[1].toLowerCase() === 'увеличится' ? 'up' : 'down', marking };
  }

  return null;
}

/** Все маркировки, которые встречаются в наборе заданий (для подбора заводской). */
export function collectMarkings(tasks) {
  const freq = new Map();
  const add = (m, inTable) => {
    if (!m) return;
    const key = `${m.w}/${m.p} R${m.d}`;
    const item = freq.get(key) || { m: { w: m.w, p: m.p, d: m.d }, count: 0, inTable: false };
    item.count++;
    item.inTable = item.inTable || inTable;
    freq.set(key, item);
  };

  for (const task of tasks) {
    const text = decodeEntities(stripTags(String(task.stem))).replace(/\s+/g, ' ');
    if (!/шин|колес|маркировк/i.test(text)) continue;

    const table = tireTable(task.stem);
    if (table) {
      for (const row of table.data) {
        row.cells.forEach((cell, i) => {
          const diameter = table.diameters[i];
          if (!diameter || isDash(cell)) return;
          for (const part of String(cell).split(';')) {
            const m = parseMarking(`${part} R${diameter}`);
            if (m) add({ w: row.width, p: m.p, d: diameter }, true);
          }
        });
      }
    }
    for (const m of text.matchAll(/(\d{3})\s*\/\s*(\d{2})\s*R\s*(\d{1,2})(?!\d)/gi)) {
      add({ w: Number(m[1]), p: Number(m[2]), d: Number(m[3]) }, false);
    }
  }

  // Сначала маркировки из таблиц завода: заводская почти наверняка среди них.
  return [...freq.values()]
    .sort((a, b) => Number(b.inTable) - Number(a.inTable) || b.count - a.count)
    .map((item) => item.m);
}

/** Все таблицы разрешённых размеров из набора заданий. */
export function collectTables(tasks) {
  const tables = [];
  for (const task of tasks) {
    const table = tireTable(task.stem);
    if (!table) continue;
    const list = [];
    for (const row of table.data) {
      row.cells.forEach((cell, i) => {
        const diameter = table.diameters[i];
        if (!diameter || isDash(cell)) return;
        for (const part of String(cell).split(';')) {
          const m = parseMarking(`${part} R${diameter}`);
          if (m) list.push({ w: row.width, p: m.p, d: diameter });
        }
      });
    }
    if (list.length) tables.push(list);
  }
  return tables;
}

/** Возможные ответы для заданий, где нужна заводская маркировка. */
export function tireCandidates(tire, markings, tables = []) {
  const dNew = tire.marking ? wheelDiameter(tire.marking) : null;
  const out = [];
  const seen = new Set();

  for (const m of factoryPool(tire, markings, tables)) {
    const dOld = wheelDiameter(m);
    let value = null;

    if (tire.type === 'factory') {
      value = round2(dOld);
    } else if (tire.type === 'diameter') {
      if (tire.direction === 'up' && dNew <= dOld) continue;
      if (tire.direction === 'down' && dNew >= dOld) continue;
      value = round2(Math.abs(dNew - dOld));
    } else if (tire.type === 'percent') {
      if (tire.direction === 'up' && dNew <= dOld) continue;
      if (tire.direction === 'down' && dNew >= dOld) continue;
      value = Math.round(Math.abs(dNew / dOld - 1) * 1000) / 10;
    }

    if (value == null || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

/**
 * Круг маркировок, среди которых ищем заводскую.
 * Если известно новое колесо, подходят только таблицы, где такая маркировка разрешена:
 * заводская шина должна быть из той же таблицы.
 */
export function factoryPool(tire, markings, tables = []) {
  // Заводская маркировка почти всегда стоит первой в таблице разрешённых размеров,
  // поэтому её варианты проверяем раньше остальных.
  if (tire.type === 'factory' && tables.length) {
    const seen = new Set();
    const ordered = [];
    const push = (m) => {
      const key = markingText(m);
      if (seen.has(key)) return;
      seen.add(key);
      ordered.push(m);
    };
    for (const table of tables) push(table[0]);
    for (const table of tables) for (const m of table) push(m);
    for (const m of markings) push(m);
    return ordered;
  }

  if (!tire.marking || !tables.length || !['diameter', 'percent'].includes(tire.type)) return markings;

  const key = markingText(tire.marking);
  const matching = tables.filter((table) => table.some((m) => markingText(m) === key));
  if (!matching.length) return markings;

  const seen = new Set();
  const pool = [];
  for (const table of matching) {
    for (const m of table) {
      const k = markingText(m);
      if (seen.has(k)) continue;
      seen.add(k);
      pool.push(m);
    }
  }
  return pool.length ? pool : markings;
}

/**
 * Подбирает заводскую маркировку по подтверждённому ответу.
 * Возвращает маркировку, при которой получается ровно тот же ответ, или null.
 */
export function reconstructFactory(tire, answer, markings, tables = []) {
  const target = Number(String(answer).replace(',', '.'));
  if (!Number.isFinite(target)) return null;

  const dNew = tire.marking ? wheelDiameter(tire.marking) : null;
  let best = null;

  for (const m of factoryPool(tire, markings, tables)) {
    const dOld = wheelDiameter(m);
    let value = null;
    let error = 0;

    if (tire.type === 'factory') {
      value = round2(dOld);
      error = Math.abs(dOld - target);
    } else if (tire.type === 'diameter') {
      if (tire.direction === 'up' && dNew <= dOld) continue;
      if (tire.direction === 'down' && dNew >= dOld) continue;
      value = round2(Math.abs(dNew - dOld));
      error = Math.abs(value - target);
    } else if (tire.type === 'percent') {
      if (tire.direction === 'up' && dNew <= dOld) continue;
      if (tire.direction === 'down' && dNew >= dOld) continue;
      value = Math.round(Math.abs(dNew / dOld - 1) * 1000) / 10;
      error = Math.abs(Math.abs(dNew / dOld - 1) * 100 - target);
    }

    if (value == null) continue;
    if (Math.abs(value - target) > 1e-6) continue;

    if (!best || error < best.error) best = { marking: m, error };
  }

  return best ? best.marking : null;
}
