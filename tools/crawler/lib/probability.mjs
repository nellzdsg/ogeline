// Задания на вероятность и статистику (номер 10 ОГЭ).
//
// Сюжеты банка повторяются: билеты, чашки, такси, фонарики, монеты, карандаши.
// Вероятность в каждом сюжете — отношение числа подходящих исходов к общему,
// поэтому ответ считается точно, а подтверждает его оракул ФИПИ.

const RU_NUM = [
  ['девятнадцать', 19],
  ['восемнадцать', 18],
  ['семнадцать', 17],
  ['шестнадцать', 16],
  ['пятнадцать', 15],
  ['четырнадцать', 14],
  ['тринадцать', 13],
  ['двенадцать', 12],
  ['одиннадцать', 11],
  ['девятьсот', 900],
  ['восемьсот', 800],
  ['семьсот', 700],
  ['шестьсот', 600],
  ['пятьсот', 500],
  ['четыреста', 400],
  ['девяносто', 90],
  ['восемьдесят', 80],
  ['семьдесят', 70],
  ['шестьдесят', 60],
  ['пятьдесят', 50],
  ['двадцать', 20],
  ['тридцать', 30],
  ['четырнадцать', 14],
  ['десять', 10],
  ['девять', 9],
  ['восемь', 8],
  ['четыре', 4],
  ['двести', 200],
  ['триста', 300],
  ['первый', 1],
  ['сорок', 40],
  ['шесть', 6],
  ['семь', 7],
  ['пять', 5],
  ['один', 1],
  ['одна', 1],
  ['одно', 1],
  ['два', 2],
  ['две', 2],
  ['три', 3],
  ['сто', 100],
  ['ноль', 0],
].sort((a, b) => b[0].length - a[0].length);

/** Русское числительное словами или цифрами. */
export function ruNum(text) {
  const raw = String(text).trim().toLowerCase().replace(/ё/g, 'е');
  if (/^\d+$/.test(raw)) return Number(raw);
  let total = 0;
  let seen = false;
  for (const part of raw.split(/[\s-]+/).filter(Boolean)) {
    for (const [stem, value] of RU_NUM) {
      if (part.startsWith(stem)) {
        total += value;
        seen = true;
        break;
      }
    }
  }
  return seen ? total : null;
}

/** Число: «25», «2,5», «0.08» или слово («четыре»). */
const num = (s) => {
  const raw = String(s).trim().replace(/\s+/g, '').replace(',', '.');
  const clean = raw.replace(/[^0-9.-]/g, '').replace(/\.$/, '');
  if (/^-?\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
  return ruNum(s);
};

const round = (v, digits = 6) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Вероятность как отношение двух счётных величин. */
const ratio = (favourable, total) => (total > 0 ? round(favourable / total) : null);

const COLORS = [
  ['красн', 'красных'],
  ['зелён', 'зелёных'],
  ['зелен', 'зелёных'],
  ['фиолетов', 'фиолетовых'],
  ['син', 'синих'],
  ['чёрн', 'чёрных'],
  ['черн', 'чёрных'],
  ['жёлт', 'жёлтых'],
  ['желт', 'жёлтых'],
  ['зелен', 'зелёных'],
];

/** Цвета, названные в вопросе («ручка будет синей или чёрной»). */
function colorsIn(question) {
  const q = String(question).toLowerCase().replace(/ё/g, 'е');
  const found = [];
  for (const [stem, name] of COLORS) {
    if (new RegExp(stem).test(q) && !found.includes(name)) found.push(name);
  }
  return found;
}

/**
 * @returns {null | {type: string, values: number[], details: object}}
 */
export function solveProbability(text) {
  const t = String(text).replace(/\s+/g, ' ').trim();

  // --- Пазлы: «закупил 25 пазлов, из них 21 с машинами и 4 с видами городов…» ----
  const puzzles = t.match(
    /закупил[а-яё]*\s+(\d+)\s+пазл[а-яё]*[\s\S]*?из них\s+(\d+)\s+с машинами и\s+(\d+)\s+с вид[а-яё]* город[а-яё]*/i,
  );
  if (puzzles) {
    const total = Number(puzzles[1]);
    const cars = Number(puzzles[2]);
    const cities = Number(puzzles[3]);
    const tail = t.slice(t.indexOf('Найдите'));
    const wantCities = /вид[а-яё]* город/i.test(tail);
    const value = ratio(wantCities ? cities : cars, total);
    if (wantCities) {
      return {
        type: 'prob-puzzles',
        values: [value, ratio(cars, total)],
        details: { total, cars, cities, favourable: cities, kind: 'с видами городов' },
      };
    }
    return {
      type: 'prob-puzzles',
      values: [value, ratio(cities, total)],
      details: { total, cars, cities, favourable: cars, kind: 'с машинами' },
    };
  }

  // --- Ручка: «вероятность того, что ручка пишет плохо, равна 0,08» ------------
  const pen = t.match(
    /Вероятность того, что новая шариковая ручка пишет плохо[^,]*,\s*равна\s*([\d.,]+)/i,
  );
  if (pen) {
    const bad = num(pen[1]);
    if (bad != null) {
      const good = round(1 - bad);
      return {
        type: 'prob-pen',
        values: [good, bad],
        details: { bad, good },
      };
    }
  }

  // --- Билеты: «На экзамене 25 билетов, Стас не выучил 5 из них» ---------------
  const tickets = t.match(/На экзамене\s+(\d+)\s+билет[а-яё]*,\s*([А-ЯЁ][а-яё]+)\s+не выучил\s+(\d+)/);
  if (tickets) {
    const total = Number(tickets[1]);
    const missed = Number(tickets[3]);
    const chosen = ratio(total - missed, total);
    const unlucky = ratio(missed, total);
    const wantBad = /невыученн/i.test(t);
    return {
      type: 'prob-tickets',
      values: wantBad ? [unlucky, chosen] : [chosen, unlucky],
      details: { total, missed, chosen, unlucky, name: tickets[2] },
    };
  }

  // --- Лыжные гонки: «11 спортсменов из России, 6 из Норвегии и 3 из Швеции» ---
  const ski = t.match(
    /(\d+)\s+спортсмен[а-яё]* из России,\s*(\d+)\s+спортсмен[а-яё]* из Норвегии и\s*(\d+)\s+спортсмен[а-яё]* из Швеции/i,
  );
  if (ski) {
    const counts = { России: Number(ski[1]), Норвегии: Number(ski[2]), Швеции: Number(ski[3]) };
    const total = counts['России'] + counts['Норвегии'] + counts['Швеции'];
    const asked = /стартовать спортсмен(?:ка)? из (\S+)/i.exec(t);
    const country = asked && counts[asked[1]] != null ? asked[1] : 'России';
    return {
      type: 'prob-ski',
      values: [ratio(counts[country], total)],
      details: { counts, total, country },
    };
  }

  // --- Чашки: «У бабушки 20 чашек: 12 с красными цветами, остальные с синими» --
  const cups = t.match(
    /У бабушки\s+(\d+)\s+чаш[а-яё]*:\s*(\d+)\s+с красными цветами,\s*остальные с синими/i,
  );
  if (cups) {
    const total = Number(cups[1]);
    const red = Number(cups[2]);
    const blue = total - red;
    const wantRed = /с красными цветами\s*\.?\s*$/i.test(t) || /чашку с красными/i.test(t);
    return {
      type: 'prob-cups',
      values: [ratio(wantRed ? red : blue, total), ratio(wantRed ? blue : red, total)],
      details: { total, red, blue, wantRed },
    };
  }

  // --- Такси: «свободно 30 машин: 3 чёрных, 9 жёлтых и 18 зелёных» -------------
  const taxi = t.match(
    /свободно\s+(\d+)\s+машин[а-яё]*:\s*(\d+)\s+ч[её]рн[а-яё]*,\s*(\d+)\s+ж[её]лт[а-яё]* и\s*(\d+)\s+зел[её]н[а-яё]*/i,
  );
  if (taxi) {
    const total = Number(taxi[1]);
    const counts = { чёрных: Number(taxi[2]), жёлтых: Number(taxi[3]), зелёных: Number(taxi[4]) };
    const asked = /приедет\s+(\S+)\s+такси/i.exec(t);
    const color = asked ? asked[1].toLowerCase().replace(/ё/g, 'е') : 'жёлтых';
    const key = Object.keys(counts).find((k) => k.replace(/ё/g, 'е').startsWith(color.slice(0, 4)));
    const chosen = key || 'жёлтых';
    return {
      type: 'prob-taxi',
      values: [ratio(counts[chosen], total)],
      details: { counts, total, color: chosen },
    };
  }

  // --- Канцтовары: «165 ручек: 37 красных, 16 зелёных, 46 фиолетовых, остальные
  //     синие и чёрные, их поровну» -------------------------------------------------
  const pens = t.match(
    /прода[её]тся\s+(\d+)\s+руч[а-яё]*:\s*(\d+)\s+красн[а-яё]*,\s*(\d+)\s+зел[её]н[а-яё]*,\s*(\d+)\s+фиолетов[а-яё]*,?\s*остальные синие и ч[её]рные,?\s*их поровну/i,
  );
  if (pens) {
    const total = Number(pens[1]);
    const red = Number(pens[2]);
    const green = Number(pens[3]);
    const violet = Number(pens[4]);
    const rest = total - red - green - violet;
    const counts = new Map([
      ['красных', red],
      ['зелёных', green],
      ['фиолетовых', violet],
      ['синих', rest / 2],
      ['чёрных', rest / 2],
    ]);
    const asked = colorsIn(t.slice(t.indexOf('ручка будет')));
    const names = asked.length ? asked : ['синих', 'чёрных'];
    let sum = 0;
    for (const name of names) sum += counts.get(name) ?? 0;
    return {
      type: 'prob-pens',
      values: [ratio(sum, total)],
      details: { total, red, green, violet, rest, names, sum },
    };
  }

  // --- Фонарики: «В среднем из 100 фонариков четыре неисправных» ---------------
  const bulbs = t.match(
    /В среднем из\s+(\d+)\s+карманных фонарик[а-яё]*,\s*поступивших в продажу,?\s*([а-яё]+|\d+)\s+неисправн/i,
  );
  if (bulbs) {
    const total = Number(bulbs[1]);
    const broken = num(bulbs[2]);
    if (broken != null) {
      const wantBroken = /окажется неисправен/i.test(t);
      return {
        type: 'prob-bulbs',
        values: [ratio(wantBroken ? broken : total - broken, total)],
        details: { total, broken, wantBroken },
      };
    }
  }

  // --- Кубик: «кубик бросают два раза… сумма выпавших очков равна 3, 4 или 5» --
  const dice = t.match(/игральный кубик бросают\s+(два|три|\d+)\s+раза?/i);
  if (dice) {
    const times = ruNum(dice[1]);
    const condition = /«([^»]+)»/.exec(t);
    const outcomes = [];
    const roll = (prefix) => {
      if (prefix.length === times) {
        outcomes.push(prefix);
        return;
      }
      for (let face = 1; face <= 6; face++) roll([...prefix, face]);
    };
    if (times && times <= 3) {
      roll([]);
      const sums = condition ? (condition[1].match(/\d+/g) || []).map(Number) : [];
      const wants = /равна\s+([\d,\sиили]+)/i.exec(condition ? condition[1] : '');
      const set = new Set(sums);
      if (set.size && wants && /сумм/i.test(condition[1])) {
        const favourable = outcomes.filter((o) => set.has(o.reduce((a, b) => a + b, 0))).length;
        return {
          type: 'prob-dice',
          values: [ratio(favourable, outcomes.length)],
          details: { times, set: [...set], favourable, total: outcomes.length },
        };
      }
    }
  }

  // --- Монета: «бросили 20 раз, орёл выпал 9 раз… при десятом броске решка» ----
  const coin = t.match(
    /Монету бросили\s+(\d+)\s+раз[а-яё]*\.\s*Известно, что орёл выпал\s+(\d+)\s+раз[а-яё]*\.\s*Найдите вероятность того, что при\s+(\S+?)[\s-]*м?\s+по сч[её]ту броске выпала\s+(решка|орёл|орел)/i,
  );
  if (coin) {
    const total = Number(coin[1]);
    const heads = Number(coin[2]);
    const wantTails = /решк/i.test(coin[4]);
    const value = ratio(wantTails ? total - heads : heads, total);
    return {
      type: 'prob-coin',
      values: [value],
      details: { total, heads, wantTails, value },
    };
  }

  // --- Карандаши: «7 жёлтых и 14 зелёных, первый оказался зелёным…» ------------
  const pencils = t.match(
    /где хранятся\s+(\d+)\s+ж[её]лт[а-яё]* и\s+(\d+)\s+зел[её]н[а-яё]* карандашей,\s*не глядя достали два карандаша\.\s*Известно, что первый карандаш оказался\s+([а-яё]+)\.\s*Найдите вероятность того, что второй карандаш тоже оказался\s+([а-яё]+)/i,
  );
  if (pencils) {
    const yellow = Number(pencils[1]);
    const green = Number(pencils[2]);
    const total = yellow + green;
    const firstGreen = /зел/i.test(pencils[3]);
    const secondGreen = /зел/i.test(pencils[4]);
    const left = firstGreen ? green - 1 : yellow - 1;
    const other = firstGreen ? yellow : green;
    const favourable = secondGreen === firstGreen ? left : other;
    return {
      type: 'prob-pencils',
      values: [ratio(favourable, total - 1)],
      details: { yellow, green, total, firstGreen, secondGreen, favourable },
    };
  }

  // --- Маркеры: «18 чёрных и 22 синих маркера… берут случайный маркер» ---------
  const markers = t.match(
    /лежат\s+(\d+)\s+ч[её]рных и\s+(\d+)\s+синих маркер[а-яё]* для доски[\s\S]*?Найдите вероятность того, что он окажется\s+([а-яё]+)/i,
  );
  if (markers) {
    const black = Number(markers[1]);
    const blue = Number(markers[2]);
    const wantBlack = /ч[её]рн/i.test(markers[3]);
    return {
      type: 'prob-markers',
      values: [ratio(wantBlack ? black : blue, black + blue)],
      details: { black, blue, wantBlack },
    };
  }

  return null;
}
