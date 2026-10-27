// Геометрия ОГЭ (номера 15–19).
//
// Задания банка по геометрии — это около сотни повторяющихся сюжетов: углы
// треугольника, вписанные углы, площади, трапеция, ромб, квадрат, окружность.
// Каждый сюжет — одна формула из школьного курса, поэтому решение строится
// по условию, а ответ потом подтверждает оракул ФИПИ.
//
// Функция возвращает не только числа: подсказки и шаги пишутся здесь же, потому
// что в геометрии рассуждение неотделимо от формулы.

/** Число: «16», «6,5», «18 √(3)». */
const NUM = String.raw`-?\d+(?:[.,]\d+)?(?:\s*√\(\d+\))?`;

const toNum = (raw) => {
  const s = String(raw).replace(/\s+/g, '').replace(',', '.');
  const m = /^(-?\d+(?:\.\d+)?)(?:√\((\d+)\))?$/.exec(s);
  if (!m) return null;
  const k = Number(m[1]);
  return m[2] ? k * Math.sqrt(Number(m[2])) : k;
};

/** Обыкновенная дробь «7/12» или число. */
const toFrac = (raw) => {
  const s = String(raw).replace(/\s+/g, '').replace(',', '.');
  const m = /^(-?\d+)\/(\d+)$/.exec(s);
  return m ? Number(m[1]) / Number(m[2]) : toNum(s);
};

const round = (v, digits = 6) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Ответ в формате ОГЭ: целое или десятичная дробь с запятой. */
const fmt = (v) => {
  if (!Number.isFinite(v)) return '?';
  const r = round(v, 6);
  return String(r).replace('.', ',');
};

/** Текст без лишних пробелов; «A B C» → «ABC», минус — обычный дефис. */
function norm(text) {
  return String(text)
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\b([A-Z])(?:\s+([A-Z]))+\b/g, (m) => m.replace(/\s+/g, ''))
    .trim();
}

/** Все названные в условии углы: «∠ABC = 48», «угол C равен 120». */
function anglesOf(text) {
  const map = new Map();
  for (const m of text.matchAll(/∠\s*([A-Z]{1,4})\s*=\s*(\d+(?:[.,]\d+)?)/g)) map.set(m[1], toNum(m[2]));
  for (const m of text.matchAll(/угол\s+([A-Z]{1,4})\s+равен\s+(\d+(?:[.,]\d+)?)/g)) {
    if (!map.has(m[1])) map.set(m[1], toNum(m[2]));
  }
  return map;
}

const angle = (map, ...names) => {
  for (const name of names) if (map.has(name)) return map.get(name);
  return null;
};

/** Ответ с формулой: тип, значение, подсказки и шаги. */
const simple = (type, value, hints, steps) => ({ type, values: [value], hints, steps });

export function solveGeometry(rawText) {
  const text = norm(rawText);
  const a = anglesOf(text);

  // --- окружность: радиус описанной окружности через сторону и угол ----------
  if (/радиус окружности, описанной/i.test(text) && /угол C равен/i.test(text)) {
    const c = /AB = (\d+(?:[.,]\d+)?\s*√\(\d+\)|\d+(?:[.,]\d+)?)/.exec(text);
    const angleC = a.get('C');
    if (c && angleC) {
      const side = toNum(c[1]);
      const R = side / (2 * Math.sin((angleC * Math.PI) / 180));
      return simple(
        'circumradius-angle',
        R,
        [
          'Радиус описанной окружности связан со стороной треугольника и противолежащим углом: R = a / (2 sin α).',
          `Сторона AB = ${fmt(side)} лежит против угла C = ${fmt(angleC)}°.`,
          `R = ${fmt(side)} / (2 · sin ${fmt(angleC)}°) = ${fmt(R)}.`,
        ],
        [
          `По теореме синусов: AB / sin C = 2R.`,
          `R = AB / (2 sin C) = ${fmt(side)} / (2 · sin ${fmt(angleC)}°) = ${fmt(R)}.`,
          `Ответ: ${fmt(R)}.`,
        ],
      );
    }
  }

  // --- окружность: прямоугольный треугольник, R = гипотенуза / 2 --------------
  if (/радиус описанной около этого треугольника окружности/i.test(text) && a.get('C') === 90) {
    const legs = [...text.matchAll(/(?:AC|BC) = (\d+(?:[.,]\d+)?)/g)].map((m) => toNum(m[1]));
    if (legs.length === 2) {
      const hyp = Math.hypot(legs[0], legs[1]);
      const R = hyp / 2;
      return simple(
        'circumradius-right',
        R,
        [
          'В прямоугольном треугольнике центр описанной окружности лежит на середине гипотенузы.',
          `Катеты ${fmt(legs[0])} и ${fmt(legs[1])}: гипотенуза по теореме Пифагора равна ${fmt(round(hyp))}.`,
          `R = гипотенуза / 2 = ${fmt(R)}.`,
        ],
        [
          `Гипотенуза: √(${fmt(legs[0])}² + ${fmt(legs[1])}²) = ${fmt(round(hyp))}.`,
          `Радиус описанной окружности равен половине гипотенузы: R = ${fmt(round(hyp))} / 2 = ${fmt(R)}.`,
          `Ответ: ${fmt(R)}.`,
        ],
      );
    }
  }

  // --- средняя линия треугольника -------------------------------------------
  if (/M и N являются серединами сторон AB и BC/i.test(text)) {
    const ac = /AC равна (\d+(?:[.,]\d+)?)/.exec(text) || /AC = (\d+(?:[.,]\d+)?)/.exec(text);
    if (ac) {
      const value = toNum(ac[1]) / 2;
      return simple(
        'tri-midline',
        value,
        [
          'Отрезок, соединяющий середины двух сторон треугольника, — средняя линия.',
          'Средняя линия параллельна третьей стороне и равна её половине.',
          `MN = AC / 2 = ${fmt(toNum(ac[1]))} / 2 = ${fmt(value)}.`,
        ],
        [
          `M и N — середины сторон AB и BC, значит MN — средняя линия треугольника ABC.`,
          `MN = AC / 2 = ${fmt(toNum(ac[1]))} / 2 = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- медиана треугольника ---------------------------------------------------
  if (/BM - медиана/i.test(text)) {
    const ac = /AC = (\d+(?:[.,]\d+)?)/.exec(text);
    if (ac) {
      const value = toNum(ac[1]) / 2;
      return simple(
        'tri-median',
        value,
        [
          'Медиана соединяет вершину с серединой противолежащей стороны.',
          `BM проведена к стороне AC, значит M — середина AC, а AC = ${fmt(toNum(ac[1]))}.`,
          `AM = AC / 2 = ${fmt(value)}.`,
        ],
        [
          `BM — медиана к стороне AC, поэтому AM = MC = AC / 2.`,
          `AM = ${fmt(toNum(ac[1]))} / 2 = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- окружность: два диаметра ---------------------------------------------
  if (/(AC и BD|BD и AC) - диаметры/i.test(text) || /(AC и BD|BD и AC) - диаметры/i.test(text)) {
    const acb = a.get('ACB');
    const aod = a.get('AOD');
    if (aod != null) {
      const value = (180 - aod) / 2;
      return simple(
        'circle-diameters-aod',
        value,
        [
          'Диаметры точкой пересечения делятся пополам, поэтому OA = OB = OC = OD — это радиусы.',
          `Развёрнутый угол AOD и AOB вместе дают 180°, значит ∠AOB = 180° − ${fmt(aod)}° = ${fmt(180 - aod)}°.`,
          `Вписанный угол ACB опирается на ту же дугу AB, что и центральный AOB: ∠ACB = ${fmt(180 - aod)}° / 2 = ${fmt(value)}°.`,
        ],
        [
          `BD — диаметр, поэтому ∠AOB = 180° − ∠AOD = 180° − ${fmt(aod)}° = ${fmt(180 - aod)}°.`,
          `∠ACB — вписанный угол, опирающийся на дугу AB: ∠ACB = ∠AOB / 2 = ${fmt(value)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
    if (acb != null) {
      const value = 180 - 2 * acb;
      return simple(
        'circle-diameters-acb',
        value,
        [
          'AC и BD — диаметры, поэтому их точка пересечения — центр окружности.',
          `Вписанный угол ACB опирается на дугу AB, значит центральный угол AOB = 2 · ${fmt(acb)}° = ${fmt(2 * acb)}°.`,
          `∠AOD и ∠AOB — смежные: ∠AOD = 180° − ${fmt(2 * acb)}° = ${fmt(value)}°.`,
        ],
        [
          `∠AOB = 2∠ACB = ${fmt(2 * acb)}° (центральный угол вдвое больше вписанного).`,
          `∠AOD = 180° − ∠AOB = ${fmt(value)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- окружность: центр O и точка C в одной полуплоскости -------------------
  if (/в одной полуплоскости/i.test(text) && a.get('AOB') != null) {
    const aob = a.get('AOB');
    const value = 180 - aob / 2;
    return simple(
      'circle-halfplane',
      value,
      [
        'Центральный угол AOB и вписанный угол ACB опираются на одну и ту же хорду AB.',
        'Если точки O и C лежат по одну сторону от AB, вписанный угол опирается на большую дугу.',
        `∠ACB = 180° − ∠AOB / 2 = 180° − ${fmt(aob / 2)}° = ${fmt(value)}°.`,
      ],
      [
        `∠AOB = ${fmt(aob)}° — центральный угол.`,
        `Вписанный угол, опирающийся на большую дугу: ∠ACB = 180° − ${fmt(aob)}° / 2 = ${fmt(value)}°.`,
        `Ответ: ${fmt(value)}.`,
      ],
    );
  }

  // --- окружность: AB — диаметр (центр на стороне AB) ------------------------
  if (/Центр окружности, описанной около треугольника ABC, лежит на стороне AB/i.test(text)) {
    const r = /радиус окружности равен (\d+(?:[.,]\d+)?)/i.exec(text);
    const bac = a.get('BAC');
    if (r) {
      const radius = toNum(r[1]);
      const ac = /AC = (\d+(?:[.,]\d+)?)/.exec(text);
      const bc = /BC = (\d+(?:[.,]\d+)?)/.exec(text);
      const diam = 2 * radius;
      if (ac || bc) {
        const known = toNum((ac || bc)[1]);
        const value = Math.sqrt(diam ** 2 - known ** 2);
        return simple(
          'circle-thales-side',
          value,
          [
            'Если центр описанной окружности лежит на стороне AB, то AB — диаметр, а угол C прямой.',
            `AB = 2R = ${fmt(diam)} — гипотенуза прямоугольного треугольника ABC.`,
            `Неизвестный катет: √(${fmt(diam)}² − ${fmt(known)}²) = ${fmt(round(value))}.`,
          ],
          [
            `AB = 2R = ${fmt(diam)}.`,
            `Угол C опирается на диаметр, значит ∠C = 90°.`,
            `По теореме Пифагора: ${ac ? 'AC' : 'BC'} = √(${fmt(diam)}² − ${fmt(known)}²) = ${fmt(round(value))}.`,
            `Ответ: ${fmt(round(value))}.`,
          ],
        );
      }
    }
    if (bac != null) {
      const value = 90 - bac;
      return simple(
        'circle-thales-angle',
        value,
        [
          'Центр описанной окружности на стороне AB означает, что AB — диаметр.',
          'Угол, опирающийся на диаметр, прямой: ∠ACB = 90°.',
          `Сумма острых углов прямоугольного треугольника 90°: ∠ABC = 90° − ${fmt(bac)}° = ${fmt(value)}°.`,
        ],
        [
          `AB — диаметр, поэтому ∠ACB = 90°.`,
          `∠ABC = 180° − 90° − ${fmt(bac)}° = ${fmt(value)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- окружность: точки по разные стороны от диаметра ----------------------
  if (/по разные стороны от диаметра AB/i.test(text) && a.get('NBA') != null) {
    const nba = a.get('NBA');
    const value = 90 - nba;
    return simple(
      'circle-diameter-sides',
      value,
      [
        'Угол, опирающийся на диаметр, прямой: ∠ANB = 90°.',
        `В треугольнике ABN: ∠NAB = 90° − ${fmt(nba)}° = ${fmt(value)}°.`,
        `Углы NAB и NMB опираются на одну дугу NB, значит они равны: ${fmt(value)}°.`,
      ],
      [
        `AB — диаметр, поэтому ∠ANB = 90°.`,
        `∠NAB = 180° − 90° − ${fmt(nba)}° = ${fmt(value)}°.`,
        `∠NMB = ∠NAB = ${fmt(value)}° (вписанные углы на одну дугу).`,
        `Ответ: ${fmt(value)}.`,
      ],
    );
  }

  // --- вписанный четырёхугольник: диагональ и угол ---------------------------
  if (/ABCD вписан в окружность/i.test(text) && a.get('CAD') != null) {
    const abd = a.get('ABD');
    const abc = a.get('ABC');
    if (abd != null) {
      const value = abd + a.get('CAD');
      return simple(
        'quad-inscribed-sum',
        value,
        [
          'Вписанные углы, опирающиеся на одну дугу, равны: ∠DBC = ∠DAC.',
          `∠DBC = ∠CAD = ${fmt(a.get('CAD'))}°, а ∠ABD = ${fmt(abd)}°.`,
          `∠ABC = ∠ABD + ∠DBC = ${fmt(abd)}° + ${fmt(a.get('CAD'))}° = ${fmt(value)}°.`,
        ],
        [
          `∠DBC = ∠CAD = ${fmt(a.get('CAD'))}° — оба опираются на дугу DC.`,
          `∠ABC = ∠ABD + ∠DBC = ${fmt(abd)}° + ${fmt(a.get('CAD'))}° = ${fmt(value)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
    if (abc != null) {
      const value = abc - a.get('CAD');
      return simple(
        'quad-inscribed-diff',
        value,
        [
          'Диагональ AC делит угол ABC на две части: ∠ABD и ∠DBC.',
          `∠DBC = ∠CAD = ${fmt(a.get('CAD'))}° — вписанные углы на дугу DC.`,
          `∠ABD = ∠ABC − ∠DBC = ${fmt(abc)}° − ${fmt(a.get('CAD'))}° = ${fmt(value)}°.`,
        ],
        [
          `∠DBC = ∠CAD = ${fmt(a.get('CAD'))}° (одна дуга DC).`,
          `∠ABD = ∠ABC − ∠DBC = ${fmt(value)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- вписанный четырёхугольник: противоположные углы ----------------------
  if (/вписанного в окружность/i.test(text) && /Найдите угол (C|A)/i.test(text)) {
    const known = angle(a, 'A', 'C');
    if (known != null) {
      const value = 180 - known;
      return simple(
        'quad-inscribed-opposite',
        value,
        [
          'У вписанного четырёхугольника сумма противоположных углов равна 180°.',
          known === a.get('A') ? `∠A = ${fmt(known)}°.` : `∠C = ${fmt(known)}°.`,
          `Искомый угол: 180° − ${fmt(known)}° = ${fmt(value)}°.`,
        ],
        [
          `Противоположные углы вписанного четырёхугольника в сумме дают 180°.`,
          `180° − ${fmt(known)}° = ${fmt(value)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- трапеция, вписанная в окружность -------------------------------------
  if (/трапеции ABCD с основаниями AD и BC, вписанной в окружность/i.test(text)) {
    const known = angle(a, 'A', 'B', 'C', 'D');
    if (known != null) {
      const value = 180 - known;
      return simple(
        'trapezoid-inscribed',
        value,
        [
          'Трапеция, вписанная в окружность, равнобедренная.',
          'Углы, прилежащие к боковой стороне, в сумме дают 180°.',
          `Искомый угол: 180° − ${fmt(known)}° = ${fmt(value)}°.`,
        ],
        [
          `Сумма углов при боковой стороне трапеции равна 180°.`,
          `180° − ${fmt(known)}° = ${fmt(value)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- параллелограмм: биссектриса угла -------------------------------------
  if (/биссектриса угла A образует со стороной BC угол/i.test(text)) {
    const given = /образует со стороной BC угол, равный (\d+(?:[.,]\d+)?)/i.exec(text);
    if (given) {
      const half = toNum(given[1]);
      const value = 2 * half;
      return simple(
        'parallelogram-bisector',
        value,
        [
          'Биссектриса делит угол A пополам.',
          'Стороны BC и AD параллельны, поэтому угол между биссектрисой и BC равен половине угла A.',
          `∠A = 2 · ${fmt(half)}° = ${fmt(value)}°.`,
        ],
        [
          `Биссектриса образует с BC угол ${fmt(half)}°; BC ∥ AD, значит с AD она тоже образует ${fmt(half)}°.`,
          `Этот угол равен половине угла A: ∠A = 2 · ${fmt(half)}° = ${fmt(value)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- параллелограмм: диагональ и углы со сторонами ------------------------
  if (/Диагональ (BD|AC) параллелограмма/i.test(text)) {
    const pair = /углы, равные (\d+(?:[.,]\d+)?)°? и (\d+(?:[.,]\d+)?)/i.exec(text);
    if (pair) {
      const [x, y] = [toNum(pair[1]), toNum(pair[2])];
      const sum = x + y;
      const smaller = sum <= 90 ? sum : 180 - sum;
      const bigger = 180 - smaller;
      const wantBigger = /больший угол/i.test(text);
      const value = wantBigger ? bigger : smaller;
      return simple(
        'parallelogram-diagonal',
        value,
        [
          'Диагональ делит угол параллелограмма на два угла, которые даны в условии.',
          `Значит один угол параллелограмма равен ${fmt(x)}° + ${fmt(y)}° = ${fmt(sum)}°.`,
          'Соседний угол дополняет его до 180°.',
        ],
        [
          `Угол параллелограмма: ${fmt(x)}° + ${fmt(y)}° = ${fmt(sum)}°.`,
          `Второй угол: 180° − ${fmt(sum)}° = ${fmt(180 - sum)}°.`,
          `Нужен ${wantBigger ? 'больший' : 'меньший'}: ${fmt(value)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- параллелограмм: один угол --------------------------------------------
  if (/Один из углов параллелограмма равен/i.test(text)) {
    const given = /Один из углов параллелограмма равен (\d+(?:[.,]\d+)?)/i.exec(text);
    if (given) {
      const x = toNum(given[1]);
      const wantBigger = /больший/i.test(text);
      const value = wantBigger ? 180 - x : Math.min(x, 180 - x);
      return simple(
        'parallelogram-angle',
        value,
        [
          'Сумма соседних углов параллелограмма равна 180°.',
          `Один угол ${fmt(x)}°, значит соседний ${fmt(180 - x)}°.`,
          `Нужен ${wantBigger ? 'больший' : 'меньший'} угол: ${fmt(value)}°.`,
        ],
        [
          `Соседние углы параллелограмма в сумме дают 180°: ${fmt(x)}° и ${fmt(180 - x)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- параллелограмм: высоты по площади и сторонам -------------------------
  if (/Площадь параллелограмма равна/i.test(text) && /высот/i.test(text)) {
    const area = /Площадь параллелограмма равна (\d+(?:[.,]\d+)?)/i.exec(text);
    const sides = /стороны равны (\d+(?:[.,]\d+)?) и (\d+(?:[.,]\d+)?)/i.exec(text);
    if (area && sides) {
      const S = toNum(area[1]);
      const [p, q] = [toNum(sides[1]), toNum(sides[2])];
      const h1 = S / p;
      const h2 = S / q;
      const value = Math.max(h1, h2);
      return simple(
        'parallelogram-heights',
        value,
        [
          'Площадь параллелограмма равна произведению стороны на проведённую к ней высоту: S = a · h.',
          `Высоты: ${fmt(S)} / ${fmt(p)} = ${fmt(round(h1))} и ${fmt(S)} / ${fmt(q)} = ${fmt(round(h2))}.`,
          `Большая высота проведена к меньшей стороне: ${fmt(round(value))}.`,
        ],
        [
          `h₁ = S / ${fmt(p)} = ${fmt(round(h1))}, h₂ = S / ${fmt(q)} = ${fmt(round(h2))}.`,
          `Большая высота — ${fmt(round(value))}.`,
          `Ответ: ${fmt(round(value))}.`,
        ],
      );
    }
  }

  // --- ромб: площадь через периметр и угол 30° ------------------------------
  if (/Периметр ромба равен/i.test(text) && /Найдите площадь/i.test(text)) {
    const p = /Периметр ромба равен (\d+(?:[.,]\d+)?)/i.exec(text);
    const ang = /один из углов равен (\d+(?:[.,]\d+)?)/i.exec(text);
    if (p && ang) {
      const side = toNum(p[1]) / 4;
      const value = side ** 2 * Math.sin((toNum(ang[1]) * Math.PI) / 180);
      return simple(
        'rhombus-area',
        value,
        [
          `Периметр ромба ${fmt(toNum(p[1]))}, значит сторона ${fmt(toNum(p[1]))} / 4 = ${fmt(side)}.`,
          `Площадь ромба: S = a² · sin α = ${fmt(side)}² · sin ${fmt(toNum(ang[1]))}°.`,
          `S = ${fmt(side ** 2)} · ${fmt(round(Math.sin((toNum(ang[1]) * Math.PI) / 180), 4))} = ${fmt(round(value))}.`,
        ],
        [
          `Сторона ромба: a = ${fmt(toNum(p[1]))} / 4 = ${fmt(side)}.`,
          `S = a² sin α = ${fmt(side ** 2)} · ${fmt(round(Math.sin((toNum(ang[1]) * Math.PI) / 180), 4))} = ${fmt(round(value))}.`,
          `Ответ: ${fmt(round(value))}.`,
        ],
      );
    }
  }

  // --- ромб: высота через сторону и угол ------------------------------------
  if (/Сторона ромба равна/i.test(text) && /Найдите высоту/i.test(text)) {
    const side = /Сторона ромба равна (\d+(?:[.,]\d+)?)/i.exec(text);
    const ang = /один из углов этого ромба равен (\d+(?:[.,]\d+)?)/i.exec(text);
    if (side && ang) {
      const s = toNum(side[1]);
      const value = s * Math.sin((toNum(ang[1]) * Math.PI) / 180);
      return simple(
        'rhombus-height',
        value,
        [
          'Высота ромба равна произведению стороны на синус угла: h = a · sin α.',
          `a = ${fmt(s)}, α = ${fmt(toNum(ang[1]))}°.`,
          `h = ${fmt(s)} · ${fmt(round(Math.sin((toNum(ang[1]) * Math.PI) / 180), 4))} = ${fmt(round(value))}.`,
        ],
        [
          `h = a sin α = ${fmt(s)} · sin ${fmt(toNum(ang[1]))}° = ${fmt(round(value))}.`,
          `Ответ: ${fmt(round(value))}.`,
        ],
      );
    }
  }

  // --- ромб: больший угол ---------------------------------------------------
  if (/Один из углов ромба равен/i.test(text)) {
    const given = /Один из углов ромба равен (\d+(?:[.,]\d+)?)/i.exec(text);
    if (given) {
      const x = toNum(given[1]);
      const wantBigger = /больший/i.test(text);
      const value = wantBigger ? 180 - x : Math.min(x, 180 - x);
      return simple(
        'rhombus-angle',
        value,
        [
          'Соседние углы ромба в сумме дают 180°.',
          `Один угол ${fmt(x)}°, соседний — ${fmt(180 - x)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
        [
          `Сумма соседних углов ромба 180°: ${fmt(x)}° + ${fmt(180 - x)}° = 180°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- ромб: угол между диагональю и стороной -------------------------------
  if (/В ромбе ABCD угол ABC равен/i.test(text)) {
    const abc = a.get('ABC');
    if (abc != null) {
      const value = (180 - abc) / 2;
      return simple(
        'rhombus-diagonal-angle',
        value,
        [
          'В ромбе соседние углы в сумме дают 180°, а диагональ делит угол пополам.',
          `∠ABC = ${fmt(abc)}°, значит ∠BCD = ${fmt(180 - abc)}°.`,
          `Диагональ AC делит угол C пополам: ∠ACD = ${fmt(180 - abc)}° / 2 = ${fmt(value)}°.`,
        ],
        [
          `∠BCD = 180° − ∠ABC = ${fmt(180 - abc)}°.`,
          `Диагональ AC — биссектриса угла C: ∠ACD = ${fmt(180 - abc)}° / 2 = ${fmt(value)}°.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- квадрат: вписанная окружность ---------------------------------------
  if (/Сторона квадрата равна/i.test(text) && /вписанной/i.test(text)) {
    const side = /Сторона квадрата равна (\d+(?:[.,]\d+)?)/i.exec(text);
    if (side) {
      const s = toNum(side[1]);
      const value = s / 2;
      return simple(
        'square-inradius',
        value,
        [
          'Диаметр вписанной в квадрат окружности равен стороне квадрата.',
          `Сторона ${fmt(s)}, значит радиус ${fmt(s)} / 2 = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
        [
          `d = a = ${fmt(s)}, значит r = a / 2 = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- квадрат, описанный около окружности ---------------------------------
  if (/площадь квадрата, описанного около окружности радиуса/i.test(text)) {
    const r = /радиуса (\d+(?:[.,]\d+)?)/i.exec(text);
    if (r) {
      const radius = toNum(r[1]);
      const value = (2 * radius) ** 2;
      return simple(
        'square-circumscribed-area',
        value,
        [
          'Сторона квадрата, описанного около окружности, равна её диаметру.',
          `Диаметр ${fmt(2 * radius)}, значит сторона ${fmt(2 * radius)}.`,
          `Площадь: ${fmt(2 * radius)}² = ${fmt(value)}.`,
        ],
        [
          `a = 2r = ${fmt(2 * radius)}.`,
          `S = a² = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- трапеция: площадь, средняя линия ------------------------------------
  if (/Основания трапеции равны/i.test(text)) {
    const bases = /Основания трапеции равны (\d+(?:[.,]\d+)?) и (\d+(?:[.,]\d+)?)/i.exec(text);
    const height = /высота равна (\d+(?:[.,]\d+)?)/i.exec(text);
    if (bases && /Найдите площадь/i.test(text)) {
      const [p, q] = [toNum(bases[1]), toNum(bases[2])];
      const h = toNum(height ? height[1] : 0);
      const value = ((p + q) / 2) * h;
      return simple(
        'trapezoid-area',
        value,
        [
          'Площадь трапеции: S = (a + b) / 2 · h.',
          `Основания ${fmt(p)} и ${fmt(q)}, высота ${fmt(h)}.`,
          `S = (${fmt(p)} + ${fmt(q)}) / 2 · ${fmt(h)} = ${fmt(value)}.`,
        ],
        [
          `S = (a + b) / 2 · h = (${fmt(p)} + ${fmt(q)}) / 2 · ${fmt(h)} = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
    if (bases && /больший из отрезков/i.test(text)) {
      const [p, q] = [toNum(bases[1]), toNum(bases[2])];
      const value = Math.max(p, q) / 2;
      return simple(
        'trapezoid-midline-diagonal',
        value,
        [
          'Диагональ делит среднюю линию на два отрезка — средние линии треугольников.',
          'Больший отрезок равен половине большего основания.',
          `m = ${fmt(Math.max(p, q))} / 2 = ${fmt(value)}.`,
        ],
        [
          `Средняя линия проходит через середины боковых сторон; диагональ делит её на отрезки, равные половинам оснований.`,
          `Больший отрезок: ${fmt(Math.max(p, q))} / 2 = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
    if (bases && /Найдите среднюю линию/i.test(text)) {
      const [p, q] = [toNum(bases[1]), toNum(bases[2])];
      const value = (p + q) / 2;
      return simple(
        'trapezoid-midline',
        value,
        [
          'Средняя линия трапеции равна полусумме оснований.',
          `Основания ${fmt(p)} и ${fmt(q)}.`,
          `m = (${fmt(p)} + ${fmt(q)}) / 2 = ${fmt(value)}.`,
        ],
        [
          `m = (a + b) / 2 = (${fmt(p)} + ${fmt(q)}) / 2 = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- трапеция: вписанная окружность и высота ------------------------------
  if (/вписанной в .{0,25}трапецию, равен/i.test(text) && /Найдите высоту/i.test(text)) {
    const r = /равен (\d+(?:[.,]\d+)?)/i.exec(text);
    if (r) {
      const radius = toNum(r[1]);
      const value = 2 * radius;
      return simple(
        'trapezoid-inradius',
        value,
        [
          'Высота трапеции равна диаметру вписанной окружности.',
          `Радиус ${fmt(radius)}, значит диаметр ${fmt(value)}.`,
          `Высота трапеции: ${fmt(value)}.`,
        ],
        [`h = 2r = ${fmt(value)}.`, `Ответ: ${fmt(value)}.`],
      );
    }
  }

  // --- трапеция: углы -------------------------------------------------------
  if (/Один из углов равнобедренной трапеции равен/i.test(text)) {
    const x = toNum(/равен (\d+(?:[.,]\d+)?)/i.exec(text)[1]);
    const wantBigger = /больший/i.test(text);
    const value = wantBigger ? 180 - x : Math.min(x, 180 - x);
    return simple(
      'trapezoid-isosceles-angle',
      value,
      [
        'В равнобедренной трапеции углы при каждом основании равны, а соседние углы в сумме дают 180°.',
        `Один угол ${fmt(x)}°, соседний ${fmt(180 - x)}°.`,
        `Ответ: ${fmt(value)}.`,
      ],
      [
        `Сумма углов при боковой стороне 180°: ${fmt(x)}° + ${fmt(180 - x)}° = 180°.`,
        `Ответ: ${fmt(value)}.`,
      ],
    );
  }

  if (/Сумма двух углов равнобедренной трапеции равна/i.test(text)) {
    const sum = toNum(/равна (\d+(?:[.,]\d+)?)/i.exec(text)[1]);
    const wantBigger = /больший/i.test(text);
    // Равные углы трапеции — либо оба острые, либо оба тупые; вторая пара
    // дополняет их до 180°.
    const given = sum / 2;
    const other = 180 - given;
    const value = wantBigger ? Math.max(given, other) : Math.min(given, other);
    return simple(
      'trapezoid-angle-sum',
      value,
      [
        'В равнобедренной трапеции две пары равных углов, и каждая пара — это либо острые, либо тупые углы.',
        `Сумма двух равных углов ${fmt(sum)}°, значит каждый из них ${fmt(given)}°.`,
        `Ответ: ${fmt(value)}°.`,
      ],
      [
        `Данные углы равны: ${fmt(sum)}° / 2 = ${fmt(given)}°.`,
        `Соседний угол: 180° − ${fmt(given)}° = ${fmt(other)}°.`,
        `Ответ: ${fmt(value)}.`,
      ],
    );
  }

  if (/Один из углов прямоугольной трапеции равен/i.test(text)) {
    const x = toNum(/равен (\d+(?:[.,]\d+)?)/i.exec(text)[1]);
    const wantBigger = /больший/i.test(text);
    const value = wantBigger ? 180 - x : Math.min(x, 180 - x);
    return simple(
      'trapezoid-right-angle',
      value,
      [
        'В прямоугольной трапеции два угла прямые, а сумма двух других 180°.',
        `Данный угол ${fmt(x)}°, второй — ${fmt(180 - x)}°.`,
        `Ответ: ${fmt(value)}.`,
      ],
      [
        `Сумма углов при боковой стороне 180°: ${fmt(x)}° + ${fmt(180 - x)}° = 180°.`,
        `Ответ: ${fmt(value)}.`,
      ],
    );
  }

  // --- равнобедренная трапеция: высота делит основание ---------------------
  if (/делит основание AD на отрезки длиной/i.test(text)) {
    const parts = /отрезки длиной (\d+(?:[.,]\d+)?) и (\d+(?:[.,]\d+)?)/i.exec(text);
    if (parts) {
      const [p, q] = [toNum(parts[1]), toNum(parts[2])];
      const value = Math.abs(q - p);
      return simple(
        'trapezoid-height-parts',
        value,
        [
          'Высота равнобедренной трапеции отсекает от большего основания два равных отрезка.',
          `Меньшее основание равно разности отрезков: ${fmt(Math.max(p, q))} − ${fmt(Math.min(p, q))} = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
        [
          'Высота из вершины C делит AD на отрезок, равный BC, и отрезок-«выступ».',
          `BC = AD − 2 · меньший отрезок = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- прямоугольник: угол между диагоналями -------------------------------
  if (/Диагональ прямоугольника образует угол/i.test(text)) {
    const x = toNum(/угол (\d+(?:[.,]\d+)?)/i.exec(text)[1]);
    const doubled = 2 * x;
    const value = doubled <= 90 ? doubled : 180 - doubled;
    return simple(
      'rectangle-diagonal-angle',
      value,
      [
        'Диагонали прямоугольника равны и точкой пересечения делятся пополам, значит образуют равнобедренные треугольники.',
        `Угол между диагоналями вдвое больше угла диагонали со стороной: 2 · ${fmt(x)}° = ${fmt(doubled)}°.`,
        `Острый угол между диагоналями: ${fmt(value)}°.`,
      ],
      [
        `Диагонали делятся пополам, поэтому треугольник с вершиной в точке пересечения равнобедренный.`,
        `Угол между диагоналями: 2 · ${fmt(x)}° = ${fmt(doubled)}°.`,
        `Острый из смежных углов: ${fmt(value)}°.`,
        `Ответ: ${fmt(value)}.`,
      ],
    );
  }

  // --- треугольник: два угла ------------------------------------------------
  if (/В треугольнике два угла равны/i.test(text)) {
    const m = /два угла равны (\d+(?:[.,]\d+)?)°? и (\d+(?:[.,]\d+)?)/i.exec(text);
    if (m) {
      const [p, q] = [toNum(m[1]), toNum(m[2])];
      const value = 180 - p - q;
      return simple(
        'tri-angle-sum',
        value,
        [
          'Сумма углов треугольника равна 180°.',
          `Два угла известны: ${fmt(p)}° и ${fmt(q)}°.`,
          `Третий угол: 180° − ${fmt(p)}° − ${fmt(q)}° = ${fmt(value)}°.`,
        ],
        [`180° − ${fmt(p)}° − ${fmt(q)}° = ${fmt(value)}°.`, `Ответ: ${fmt(value)}.`],
      );
    }
  }

  // --- треугольник: внешний угол -------------------------------------------
  if (/внешний угол при вершине C/i.test(text)) {
    const c = a.get('C');
    if (c != null) {
      const value = 180 - c;
      return simple(
        'tri-external-angle',
        value,
        [
          'Внутренний и внешний углы при одной вершине смежные.',
          `∠C = ${fmt(c)}°.`,
          `Внешний угол: 180° − ${fmt(c)}° = ${fmt(value)}°.`,
        ],
        [`180° − ${fmt(c)}° = ${fmt(value)}°.`, `Ответ: ${fmt(value)}.`],
      );
    }
  }

  // --- треугольник: биссектриса --------------------------------------------
  if (/AD - биссектриса/i.test(text)) {
    const bac = a.get('BAC');
    if (bac != null) {
      const value = bac / 2;
      return simple(
        'tri-bisector',
        value,
        [
          'Биссектриса делит угол пополам.',
          `∠BAC = ${fmt(bac)}°.`,
          `∠BAD = ${fmt(bac)}° / 2 = ${fmt(value)}°.`,
        ],
        [`∠BAD = ∠BAC / 2 = ${fmt(value)}°.`, `Ответ: ${fmt(value)}.`],
      );
    }
  }

  // --- треугольник: углы при основании равнобедренного ---------------------
  if (/AB = BC/.test(text) && a.get('ABC') != null) {
    const vertex = a.get('ABC');
    const value = (180 - vertex) / 2;
    return simple(
      'tri-isosceles',
      value,
      [
        'В равнобедренном треугольнике углы при основании равны.',
        `∠ABC = ${fmt(vertex)}° — угол при вершине.`,
        `Угол при основании: (180° − ${fmt(vertex)}°) / 2 = ${fmt(value)}°.`,
      ],
      [
        `AB = BC, значит углы A и C равны.`,
        `(180° − ${fmt(vertex)}°) / 2 = ${fmt(value)}°.`,
        `Ответ: ${fmt(value)}.`,
      ],
    );
  }

  // --- треугольник: высота в остроугольном треугольнике --------------------
  if (/проведена высота BH/i.test(text) && a.get('BAC') != null) {
    const bac = a.get('BAC');
    const value = 90 - bac;
    return simple(
      'tri-height-angle',
      value,
      [
        'Высота BH перпендикулярна AC, значит треугольник ABH прямоугольный.',
        `∠BAH = ∠BAC = ${fmt(bac)}°.`,
        `∠ABH = 90° − ${fmt(bac)}° = ${fmt(value)}°.`,
      ],
      [
        `В прямоугольном треугольнике ABH: ∠ABH = 90° − ∠BAH.`,
        `∠ABH = 90° − ${fmt(bac)}° = ${fmt(value)}°.`,
        `Ответ: ${fmt(value)}.`,
      ],
    );
  }

  // --- прямоугольный треугольник: острые углы ------------------------------
  if (/Один из острых углов прямоугольного треугольника равен/i.test(text)) {
    const x = toNum(/равен (\d+(?:[.,]\d+)?)/i.exec(text)[1]);
    const value = 90 - x;
    return simple(
      'tri-right-acute',
      value,
      [
        'Сумма острых углов прямоугольного треугольника равна 90°.',
        `Один острый угол ${fmt(x)}°.`,
        `Второй: 90° − ${fmt(x)}° = ${fmt(value)}°.`,
      ],
      [`90° − ${fmt(x)}° = ${fmt(value)}°.`, `Ответ: ${fmt(value)}.`],
    );
  }

  // --- прямоугольный треугольник: sin, cos, tg -----------------------------
  const rightTriangle = /угол C равен 90/i.test(text);

  if (rightTriangle && /Найдите sin B/i.test(text)) {
    const ratio = /sin B = (\d+\/\d+)/i.exec(text);
    const ab = /AB = (\d+(?:[.,]\d+)?)/.exec(text);
    const ac = /AC = (\d+(?:[.,]\d+)?)/.exec(text);
    if (ratio && ab) {
      const value = toFrac(ratio[1]) * toNum(ab[1]);
      return simple(
        'tri-right-sin',
        value,
        [
          'sin B = противолежащий катет / гипотенуза = AC / AB.',
          `sin B = ${ratio[1]}, AB = ${fmt(toNum(ab[1]))}.`,
          `AC = AB · sin B = ${fmt(toNum(ab[1]))} · ${ratio[1]} = ${fmt(round(value))}.`,
        ],
        [
          `AC = AB · sin B = ${fmt(toNum(ab[1]))} · ${ratio[1]} = ${fmt(round(value))}.`,
          `Ответ: ${fmt(round(value))}.`,
        ],
      );
    }
    if (ac && ab) {
      const value = toNum(ac[1]) / toNum(ab[1]);
      return simple(
        'tri-right-sin-sides',
        value,
        [
          'sin B = AC / AB.',
          `AC = ${fmt(toNum(ac[1]))}, AB = ${fmt(toNum(ab[1]))}.`,
          `sin B = ${fmt(toNum(ac[1]))} / ${fmt(toNum(ab[1]))} = ${fmt(round(value))}.`,
        ],
        [`sin B = AC / AB = ${fmt(toNum(ac[1]))} / ${fmt(toNum(ab[1]))} = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
  }

  if (rightTriangle && /Найдите cos B/i.test(text)) {
    const ratio = /cos B = (\d+\/\d+)/i.exec(text);
    const ab = /AB = (\d+(?:[.,]\d+)?)/.exec(text);
    const bc = /BC = (\d+(?:[.,]\d+)?)/.exec(text);
    if (ratio && ab) {
      const value = toFrac(ratio[1]) * toNum(ab[1]);
      return simple(
        'tri-right-cos',
        value,
        [
          'cos B = прилежащий катет / гипотенуза = BC / AB.',
          `cos B = ${ratio[1]}, AB = ${fmt(toNum(ab[1]))}.`,
          `BC = AB · cos B = ${fmt(toNum(ab[1]))} · ${ratio[1]} = ${fmt(round(value))}.`,
        ],
        [`BC = AB · cos B = ${fmt(toNum(ab[1]))} · ${ratio[1]} = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (bc && ab) {
      const value = toNum(bc[1]) / toNum(ab[1]);
      return simple(
        'tri-right-cos-sides',
        value,
        [
          'cos B = BC / AB.',
          `BC = ${fmt(toNum(bc[1]))}, AB = ${fmt(toNum(ab[1]))}.`,
          `cos B = ${fmt(toNum(bc[1]))} / ${fmt(toNum(ab[1]))} = ${fmt(round(value))}.`,
        ],
        [`cos B = BC / AB = ${fmt(toNum(bc[1]))} / ${fmt(toNum(ab[1]))} = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
  }

  if (rightTriangle && /Найдите tg B/i.test(text)) {
    const ratio = /tg B = (\d+\/\d+)/i.exec(text);
    const bc = /BC = (\d+(?:[.,]\d+)?)/.exec(text);
    const ac = /AC = (\d+(?:[.,]\d+)?)/.exec(text);
    if (ratio && bc) {
      const value = toFrac(ratio[1]) * toNum(bc[1]);
      return simple(
        'tri-right-tg',
        value,
        [
          'tg B = противолежащий катет / прилежащий = AC / BC.',
          `tg B = ${ratio[1]}, BC = ${fmt(toNum(bc[1]))}.`,
          `AC = BC · tg B = ${fmt(toNum(bc[1]))} · ${ratio[1]} = ${fmt(round(value))}.`,
        ],
        [`AC = BC · tg B = ${fmt(toNum(bc[1]))} · ${ratio[1]} = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (bc && ac) {
      const value = toNum(ac[1]) / toNum(bc[1]);
      return simple(
        'tri-right-tg-sides',
        value,
        [
          'tg B = AC / BC.',
          `AC = ${fmt(toNum(ac[1]))}, BC = ${fmt(toNum(bc[1]))}.`,
          `tg B = ${fmt(toNum(ac[1]))} / ${fmt(toNum(bc[1]))} = ${fmt(round(value))}.`,
        ],
        [`tg B = AC / BC = ${fmt(toNum(ac[1]))} / ${fmt(toNum(bc[1]))} = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
  }

  // --- прямоугольный треугольник: гипотенуза и катет -----------------------
  if (/Катеты прямоугольного треугольника равны/i.test(text)) {
    const m = /равны (\d+(?:[.,]\d+)?) и (\d+(?:[.,]\d+)?)/i.exec(text);
    if (m) {
      const [p, q] = [toNum(m[1]), toNum(m[2])];
      const value = Math.hypot(p, q);
      return simple(
        'tri-right-hyp',
        value,
        [
          'Теорема Пифагора: квадрат гипотенузы равен сумме квадратов катетов.',
          `Катеты ${fmt(p)} и ${fmt(q)}.`,
          `Гипотенуза: √(${fmt(p)}² + ${fmt(q)}²) = ${fmt(round(value))}.`,
        ],
        [`√(${fmt(p)}² + ${fmt(q)}²) = √${fmt(round(p ** 2 + q ** 2))} = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
  }

  if (/катет и гипотенуза равны/i.test(text)) {
    const m = /равны (\d+(?:[.,]\d+)?) и (\d+(?:[.,]\d+)?)/i.exec(text);
    if (m) {
      const [leg, hyp] = [toNum(m[1]), toNum(m[2])];
      const value = Math.sqrt(hyp ** 2 - leg ** 2);
      return simple(
        'tri-right-leg',
        value,
        [
          'Катет находится из теоремы Пифагора: a = √(c² − b²).',
          `Гипотенуза ${fmt(hyp)}, известный катет ${fmt(leg)}.`,
          `Другой катет: √(${fmt(hyp)}² − ${fmt(leg)}²) = ${fmt(round(value))}.`,
        ],
        [`√(${fmt(hyp)}² − ${fmt(leg)}²) = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
  }

  // --- площади треугольника ------------------------------------------------
  if (/Два катета прямоугольного треугольника равны/i.test(text)) {
    const m = /равны (\d+(?:[.,]\d+)?) и (\d+(?:[.,]\d+)?)/i.exec(text);
    if (m) {
      const [p, q] = [toNum(m[1]), toNum(m[2])];
      const value = (p * q) / 2;
      return simple(
        'tri-area-legs',
        value,
        [
          'Площадь прямоугольного треугольника — половина произведения катетов.',
          `Катеты ${fmt(p)} и ${fmt(q)}.`,
          `S = ${fmt(p)} · ${fmt(q)} / 2 = ${fmt(value)}.`,
        ],
        [`S = ½ · ${fmt(p)} · ${fmt(q)} = ${fmt(value)}.`, `Ответ: ${fmt(value)}.`],
      );
    }
  }

  if (/Сторона треугольника равна .*высота, проведённая к этой стороне/i.test(text)) {
    const side = /Сторона треугольника равна (\d+(?:[.,]\d+)?)/i.exec(text);
    const h = /высота, проведённая к этой стороне, равна (\d+(?:[.,]\d+)?)/i.exec(text);
    if (side && h) {
      const value = (toNum(side[1]) * toNum(h[1])) / 2;
      return simple(
        'tri-area-side-height',
        value,
        [
          'Площадь треугольника: S = ½ · a · h.',
          `Сторона ${fmt(toNum(side[1]))}, высота к ней ${fmt(toNum(h[1]))}.`,
          `S = ${fmt(toNum(side[1]))} · ${fmt(toNum(h[1]))} / 2 = ${fmt(value)}.`,
        ],
        [`S = ½ · ${fmt(toNum(side[1]))} · ${fmt(toNum(h[1]))} = ${fmt(value)}.`, `Ответ: ${fmt(value)}.`],
      );
    }
  }

  if (/sin ∠ABC/i.test(text) && /Найдите площадь треугольника/i.test(text)) {
    const ab = /AB = (\d+(?:[.,]\d+)?)/.exec(text);
    const bc = /BC = (\d+(?:[.,]\d+)?)/.exec(text);
    const sin = /sin ∠ABC = (\d+\/\d+)/i.exec(text);
    if (ab && bc && sin) {
      const value = 0.5 * toNum(ab[1]) * toNum(bc[1]) * toFrac(sin[1]);
      return simple(
        'tri-area-sin',
        value,
        [
          'Площадь треугольника через две стороны и угол между ними: S = ½ · a · b · sin γ.',
          `Стороны ${fmt(toNum(ab[1]))} и ${fmt(toNum(bc[1]))}, sin ∠ABC = ${sin[1]}.`,
          `S = ½ · ${fmt(toNum(ab[1]))} · ${fmt(toNum(bc[1]))} · ${sin[1]} = ${fmt(round(value))}.`,
        ],
        [`S = ½ · ${fmt(toNum(ab[1]))} · ${fmt(toNum(bc[1]))} · ${sin[1]} = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
  }

  if (/Периметр треугольника равен/i.test(text) && /вписанной в него окружности/i.test(text)) {
    const p = /Периметр треугольника равен (\d+(?:[.,]\d+)?)/i.exec(text);
    const r = /окружности равен (\d+(?:[.,]\d+)?)/i.exec(text);
    if (p && r) {
      const value = (toNum(p[1]) * toNum(r[1])) / 2;
      return simple(
        'tri-area-inradius',
        value,
        [
          'Площадь треугольника через периметр и радиус вписанной окружности: S = P · r / 2.',
          `P = ${fmt(toNum(p[1]))}, r = ${fmt(toNum(r[1]))}.`,
          `S = ${fmt(toNum(p[1]))} · ${fmt(toNum(r[1]))} / 2 = ${fmt(value)}.`,
        ],
        [`S = P · r / 2 = ${fmt(toNum(p[1]))} · ${fmt(toNum(r[1]))} / 2 = ${fmt(value)}.`, `Ответ: ${fmt(value)}.`],
      );
    }
  }

  // --- прямоугольный треугольник: сторона через sin, cos, tg ----------------
  if (rightTriangle) {
    const asked = /Найдите (AC|BC|AB)/.exec(text);
    const sin = /sin B = (\d+\/\d+)/i.exec(text);
    const cos = /cos B = (\d+\/\d+)/i.exec(text);
    const tg = /tg B = (\d+\/\d+)/i.exec(text);
    const ab = /AB = (\d+(?:[.,]\d+)?)/.exec(text);
    const bc = /BC = (\d+(?:[.,]\d+)?)/.exec(text);
    const ac = /AC = (\d+(?:[.,]\d+)?)/.exec(text);

    if (asked && sin && ab && asked[1] === 'AC') {
      const value = toNum(ab[1]) * toFrac(sin[1]);
      return simple(
        'tri-right-side-sin',
        value,
        [
          'sin B = AC / AB, значит AC = AB · sin B.',
          `AB = ${fmt(toNum(ab[1]))}, sin B = ${sin[1]}.`,
          `AC = ${fmt(toNum(ab[1]))} · ${sin[1]} = ${fmt(round(value))}.`,
        ],
        [`AC = AB · sin B = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (asked && sin && ac && asked[1] === 'AB') {
      const value = toNum(ac[1]) / toFrac(sin[1]);
      return simple(
        'tri-right-hyp-sin',
        value,
        [
          'sin B = AC / AB, значит AB = AC / sin B.',
          `AC = ${fmt(toNum(ac[1]))}, sin B = ${sin[1]}.`,
          `AB = ${fmt(toNum(ac[1]))} / ${sin[1]} = ${fmt(round(value))}.`,
        ],
        [`AB = AC / sin B = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (asked && cos && ab && asked[1] === 'BC') {
      const value = toNum(ab[1]) * toFrac(cos[1]);
      return simple(
        'tri-right-side-cos',
        value,
        [
          'cos B = BC / AB, значит BC = AB · cos B.',
          `AB = ${fmt(toNum(ab[1]))}, cos B = ${cos[1]}.`,
          `BC = ${fmt(toNum(ab[1]))} · ${cos[1]} = ${fmt(round(value))}.`,
        ],
        [`BC = AB · cos B = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (asked && cos && bc && asked[1] === 'AB') {
      const value = toNum(bc[1]) / toFrac(cos[1]);
      return simple(
        'tri-right-hyp-cos',
        value,
        [
          'cos B = BC / AB, значит AB = BC / cos B.',
          `BC = ${fmt(toNum(bc[1]))}, cos B = ${cos[1]}.`,
          `AB = ${fmt(toNum(bc[1]))} / ${cos[1]} = ${fmt(round(value))}.`,
        ],
        [`AB = BC / cos B = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (asked && tg && bc && asked[1] === 'AC') {
      const value = toNum(bc[1]) * toFrac(tg[1]);
      return simple(
        'tri-right-side-tg',
        value,
        [
          'tg B = AC / BC, значит AC = BC · tg B.',
          `BC = ${fmt(toNum(bc[1]))}, tg B = ${tg[1]}.`,
          `AC = ${fmt(toNum(bc[1]))} · ${tg[1]} = ${fmt(round(value))}.`,
        ],
        [`AC = BC · tg B = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (asked && tg && ac && asked[1] === 'BC') {
      const value = toNum(ac[1]) / toFrac(tg[1]);
      return simple(
        'tri-right-leg-tg',
        value,
        [
          'tg B = AC / BC, значит BC = AC / tg B.',
          `AC = ${fmt(toNum(ac[1]))}, tg B = ${tg[1]}.`,
          `BC = ${fmt(toNum(ac[1]))} / ${tg[1]} = ${fmt(round(value))}.`,
        ],
        [`BC = AC / tg B = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
  }

  // --- четырёхугольник, описанный около окружности --------------------------
  if (/описан около окружности/i.test(text) && /Найдите AD/i.test(text)) {
    const sides = new Map([...text.matchAll(/\b(AB|BC|CD|AD) = (\d+(?:[.,]\d+)?)/g)].map((m) => [m[1], toNum(m[2])]));
    if (sides.size === 3 && !sides.has('AD')) {
      const value = sides.get('AB') + sides.get('CD') - sides.get('BC');
      return simple(
        'quad-tangential-fourth-side',
        value,
        [
          'В четырёхугольнике, описанном около окружности, суммы противоположных сторон равны: AB + CD = BC + AD.',
          `AB = ${fmt(sides.get('AB'))}, BC = ${fmt(sides.get('BC'))}, CD = ${fmt(sides.get('CD'))}.`,
          `AD = ${fmt(sides.get('AB'))} + ${fmt(sides.get('CD'))} − ${fmt(sides.get('BC'))} = ${fmt(value)}.`,
        ],
        [
          `AB + CD = BC + AD.`,
          `AD = ${fmt(sides.get('AB'))} + ${fmt(sides.get('CD'))} − ${fmt(sides.get('BC'))} = ${fmt(value)}.`,
          `Ответ: ${fmt(value)}.`,
        ],
      );
    }
  }

  // --- квадрат: диагональ, радиус описанной окружности ----------------------
  const squareSide = /Сторона квадрата равна (\d+(?:[.,]\d+)?(?:\s*√\(\d+\))?)/i.exec(text);
  if (squareSide) {
    const side = toNum(squareSide[1]);
    if (/Найдите диагональ/i.test(text)) {
      const value = side * Math.SQRT2;
      return simple(
        'square-diagonal',
        value,
        [
          'Диагональ квадрата: d = a√2.',
          `Сторона ${fmt(side)}.`,
          `d = ${fmt(side)} · √2 = ${fmt(round(value))}.`,
        ],
        [`d = a√2 = ${fmt(side)}√2 = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (/радиус окружности, описанной около этого квадрата/i.test(text)) {
      const value = side / Math.SQRT2;
      return simple(
        'square-circumradius',
        value,
        [
          'Радиус описанной около квадрата окружности равен половине диагонали: R = a√2 / 2.',
          `Сторона ${fmt(side)}.`,
          `R = ${fmt(side)} · √2 / 2 = ${fmt(round(value))}.`,
        ],
        [`R = a√2 / 2 = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
  }

  if (/радиус окружности, описанной около квадрата, равен/i.test(text)) {
    const r = /равен (\d+(?:[.,]\d+)?(?:\s*√\(\d+\))?)/i.exec(text);
    if (r) {
      const radius = toNum(r[1]);
      const value = radius * Math.SQRT2;
      return simple(
        'square-side-from-circumradius',
        value,
        [
          'Диагональ квадрата равна диаметру описанной окружности: d = 2R.',
          `R = ${fmt(radius)}, значит d = ${fmt(2 * radius)}.`,
          `Сторона: a = d / √2 = ${fmt(round(value))}.`,
        ],
        [
          `d = 2R = ${fmt(2 * radius)}.`,
          `a = d / √2 = ${fmt(round(value))}.`,
          `Ответ: ${fmt(round(value))}.`,
        ],
      );
    }
  }

  // --- равносторонний треугольник ------------------------------------------
  if (/равностороннего треугольника/i.test(text)) {
    const sideGiven = /Сторона равностороннего треугольника равна (\d+(?:[.,]\d+)?(?:\s*√\(\d+\))?)/i.exec(text);
    const rGiven = /Радиус окружности, (?:описанной|вписанной)[^.]*?равен (\d+(?:[.,]\d+)?(?:\s*√\(\d+\))?)/i.exec(text);
    const hGiven = /Высота равностороннего треугольника равна (\d+(?:[.,]\d+)?(?:\s*√\(\d+\))?)/i.exec(text);

    if (sideGiven && /радиус окружности, описанной/i.test(text)) {
      const side = toNum(sideGiven[1]);
      const value = side / Math.sqrt(3);
      return simple(
        'equilateral-circumradius',
        value,
        [
          'У равностороннего треугольника R = a / √3.',
          `Сторона ${fmt(side)}.`,
          `R = ${fmt(side)} / √3 = ${fmt(round(value))}.`,
        ],
        [`R = a / √3 = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (sideGiven && /радиус окружности, вписанной/i.test(text)) {
      const side = toNum(sideGiven[1]);
      const value = side / (2 * Math.sqrt(3));
      return simple(
        'equilateral-inradius',
        value,
        [
          'У равностороннего треугольника r = a / (2√3).',
          `Сторона ${fmt(side)}.`,
          `r = ${fmt(side)} / (2√3) = ${fmt(round(value))}.`,
        ],
        [`r = a / (2√3) = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (rGiven && /Найдите длину стороны/i.test(text)) {
      const radius = toNum(rGiven[1]);
      const value = radius * Math.sqrt(3);
      return simple(
        'equilateral-side-from-circumradius',
        value,
        [
          'У равностороннего треугольника R = a / √3, значит a = R√3.',
          `R = ${fmt(radius)}.`,
          `a = ${fmt(radius)} · √3 = ${fmt(round(value))}.`,
        ],
        [`a = R√3 = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
    if (hGiven && /Найдите сторону/i.test(text)) {
      const h = toNum(hGiven[1]);
      const value = (2 * h) / Math.sqrt(3);
      return simple(
        'equilateral-side-from-height',
        value,
        [
          'Высота равностороннего треугольника: h = a√3 / 2, значит a = 2h / √3.',
          `h = ${fmt(h)}.`,
          `a = 2 · ${fmt(h)} / √3 = ${fmt(round(value))}.`,
        ],
        [`a = 2h / √3 = ${fmt(round(value))}.`, `Ответ: ${fmt(round(value))}.`],
      );
    }
  }

  // --- параллелограмм: диагонали точкой пересечения делятся пополам --------
  if (/параллелограмма ABCD пересекаются в точке O/i.test(text)) {
    const ac = /AC = (\d+(?:[.,]\d+)?)/.exec(text);
    const bd = /BD = (\d+(?:[.,]\d+)?)/.exec(text);
    const asked = /Найдите (DO|OD|AO|OA|BO|OB|CO|OC)/.exec(text);
    if (asked) {
      const half = asked[1][0] === 'D' || asked[1][0] === 'B' ? bd : ac;
      if (half) {
        const full = toNum(half[1]);
        const value = full / 2;
        return simple(
          'parallelogram-diagonal-half',
          value,
          [
            'Диагонали параллелограмма точкой пересечения делятся пополам.',
            `Отрезок равен половине диагонали ${asked[1][0] === 'D' || asked[1][0] === 'B' ? 'BD' : 'AC'} = ${fmt(full)}.`,
            `${asked[1]} = ${fmt(full)} / 2 = ${fmt(value)}.`,
          ],
          [`${asked[1]} = ${fmt(full)} / 2 = ${fmt(value)}.`, `Ответ: ${fmt(value)}.`],
        );
      }
    }
  }

  // --- равнобедренная трапеция: диагональ под углом к основанию ------------
  if (/Диагональ равнобедренной трапеции образует с её основанием угол/i.test(text)) {
    const angleDeg = toNum(/угол (\d+(?:[.,]\d+)?)/i.exec(text)[1]);
    const bases = /основания равны (\d+(?:[.,]\d+)?) и (\d+(?:[.,]\d+)?)/i.exec(text);
    if (bases && /Найдите высоту/i.test(text)) {
      const [p, q] = [toNum(bases[1]), toNum(bases[2])];
      const diff = (Math.max(p, q) - Math.min(p, q)) / 2;
      const value = diff * Math.tan((angleDeg * Math.PI) / 180);
      return simple(
        'trapezoid-diagonal-height',
        value,
        [
          'В равнобедренной трапеции высота и отрезок между проекциями вершин образуют прямоугольный треугольник с диагональю.',
          `Разность оснований ${fmt(Math.max(p, q))} − ${fmt(Math.min(p, q))} = ${fmt(2 * diff)}, её половина ${fmt(diff)}.`,
          `h = ${fmt(diff)} · tg ${fmt(angleDeg)}° = ${fmt(round(value))}.`,
        ],
        [
          `Половина разности оснований: (${fmt(Math.max(p, q))} − ${fmt(Math.min(p, q))}) / 2 = ${fmt(diff)}.`,
          `h = ${fmt(diff)} · tg ${fmt(angleDeg)}° = ${fmt(round(value))}.`,
          `Ответ: ${fmt(round(value))}.`,
        ],
      );
    }
  }

  return null;
}
