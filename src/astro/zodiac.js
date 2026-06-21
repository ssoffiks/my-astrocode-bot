export const ZODIAC = [
  { name: 'Козерог', element: 'earth', from: [12, 22], to: [1, 19] },
  { name: 'Водолей', element: 'air', from: [1, 20], to: [2, 18] },
  { name: 'Рыбы', element: 'water', from: [2, 19], to: [3, 20] },
  { name: 'Овен', element: 'fire', from: [3, 21], to: [4, 19] },
  { name: 'Телец', element: 'earth', from: [4, 20], to: [5, 20] },
  { name: 'Близнецы', element: 'air', from: [5, 21], to: [6, 20] },
  { name: 'Рак', element: 'water', from: [6, 21], to: [7, 22] },
  { name: 'Лев', element: 'fire', from: [7, 23], to: [8, 22] },
  { name: 'Дева', element: 'earth', from: [8, 23], to: [9, 22] },
  { name: 'Весы', element: 'air', from: [9, 23], to: [10, 22] },
  { name: 'Скорпион', element: 'water', from: [10, 23], to: [11, 21] },
  { name: 'Стрелец', element: 'fire', from: [11, 22], to: [12, 21] }
];

const SIGN_BY_DATE = [
  [[1, 1], 'Козерог'], [[1, 20], 'Водолей'],
  [[2, 19], 'Рыбы'], [[3, 21], 'Овен'],
  [[4, 20], 'Телец'], [[5, 21], 'Близнецы'],
  [[6, 21], 'Рак'], [[7, 23], 'Лев'],
  [[8, 23], 'Дева'], [[9, 23], 'Весы'],
  [[10, 23], 'Скорпион'], [[11, 22], 'Стрелец'],
  [[12, 22], 'Козерог']
];

export function getZodiacByDate(month, day) {
  let sign = 'Козерог';
  for (const [[fromMonth, fromDay], name] of SIGN_BY_DATE) {
    if (month > fromMonth || (month === fromMonth && day >= fromDay)) {
      sign = name;
    }
  }
  return sign;
}

export function getZodiacFromIso(isoDate) {
  const [, month, day] = isoDate.split('-').map(Number);
  return getZodiacByDate(month, day);
}

export function getElement(signName) {
  return ZODIAC.find((item) => item.name === signName)?.element || 'unknown';
}

export function isCuspDate(month, day) {
  return SIGN_BY_DATE.some(([[m, d]]) => {
    const diff = dateNumber(month, day) - dateNumber(m, d);
    return Math.abs(diff) <= 1;
  });
}

function dateNumber(month, day) {
  return month * 100 + day;
}

export const ELEMENT_LABELS = {
  fire: 'огонь',
  earth: 'земля',
  air: 'воздух',
  water: 'вода',
  unknown: 'энергия'
};
