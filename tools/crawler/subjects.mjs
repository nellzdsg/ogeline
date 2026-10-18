// Предметы ОГЭ в открытом банке ФИПИ.
// GUID проекта взят с официальной страницы банка (oge.fipi.ru/bank/).

export const SUBJECTS = {
  math: { proj: 'DE0E276E497AB3784C3FC4CC20248DC0', title: 'Математика' },
  rus: { proj: '2F5EE3B12FE2A0EA40B06BF61A015416', title: 'Русский язык' },
  phy: { proj: 'B24AFED7DE6AB5BC461219556CCA4F9B', title: 'Физика' },
  inf: { proj: '74676951F093A0754D74F2D6E7955F06', title: 'Информатика' },
  soc: { proj: 'AE63AB28A2D28E194A286FA5A8EB9A78', title: 'Обществознание' },
  bio: { proj: '0E1FA4229923A5CE4FC368155127ED90', title: 'Биология' },
  him: { proj: '33B3A93C5A6599124B04FB95616C835B', title: 'Химия' },
  his: { proj: '3CBBE97571208D9140697A6C2ABE91A0', title: 'История' },
  lit: { proj: '6B2CD4C77304B2A3478E5A5B61F6899A', title: 'Литература' },
  geo: { proj: '0FA4DA9E3AE2BA1547B75F0B08EF6445', title: 'География' },
  eng: { proj: '8BBD5C99F37898B6402964AB11955663', title: 'Английский язык' },
  ger: { proj: 'A2AC67AE354EBC5242C49482CBC13451', title: 'Немецкий язык' },
  fra: { proj: '2A4C52ED5AC1ADA644B8BBF169FEC0FC', title: 'Французский язык' },
  esp: { proj: '7FF0B02E53DFBCDE4F56B0148BE9A236', title: 'Испанский язык' },
};

export function getSubject(key) {
  const s = SUBJECTS[key];
  if (!s) throw new Error(`Неизвестный предмет: ${key}. Доступные: ${Object.keys(SUBJECTS).join(', ')}`);
  return { key, ...s };
}
