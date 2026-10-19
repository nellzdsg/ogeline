// Задания про покупку продуктов (ОГЭ, номера 1–5).
//
// В таблице — цены одного и того же набора продуктов в четырёх магазинах.
// Нужно посчитать стоимость набора в каждом магазине и выбрать наименьшую.

import { tableRows } from './paper.mjs';

const PRODUCTS = [
  [/молок/i, 'молоко'],
  [/хлеб/i, 'хлеб'],
  [/сыр/i, 'сыр'],
  [/говядин/i, 'говядина'],
  [/картофел/i, 'картофель'],
];

const keyOf = (word) => {
  for (const [re, key] of PRODUCTS) if (re.test(word)) return key;
  return null;
};

/**
 * @returns {null | {value: number, totals: number[], stores: string[], items: {key: string, qty: number}[]}}
 */
export function solveProducts(text, html) {
  const t = String(text);
  if (!/В таблице указана стоимость/i.test(t)) return null;

  const rows = tableRows(html);
  if (rows.length < 2) return null;

  const stores = rows[0].slice(1).filter(Boolean);
  if (!stores.length) return null;

  const prices = new Map();
  for (const row of rows.slice(1)) {
    if (row.length < 2) continue;
    const key = keyOf(row[0]);
    if (!key) continue;
    const values = row
      .slice(1)
      .map((cell) => Number(String(cell).replace(/\s+/g, '').replace(',', '.')));
    if (values.length === stores.length && values.every(Number.isFinite)) prices.set(key, values);
  }
  if (!prices.size) return null;

  const listText = (t.match(/хотят купить ([\s\S]*?)\.\s*В каком магазине/i) || [])[1] || '';
  const items = [];
  for (const m of listText.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:л|кг|батон[а-яё]*)?\s*([а-яё]+)/gi)) {
    const key = keyOf(m[2]);
    if (key && prices.has(key)) items.push({ key, qty: Number(m[1].replace(',', '.')) });
  }
  // «купить батон хлеба» — количество не указано, значит один.
  if (!items.some((item) => item.key === 'хлеб') && /батон[а-яё]*\s+хлеба/i.test(listText)) {
    items.push({ key: 'хлеб', qty: 1 });
  }
  if (!items.length) return null;

  const totals = stores.map((_, i) => items.reduce((sum, item) => sum + item.qty * prices.get(item.key)[i], 0));
  if (totals.some((v) => !Number.isFinite(v))) return null;

  return { value: Math.min(...totals), totals, stores, items, prices };
}
