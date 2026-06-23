export function parseBirthDate(input) {
  const text = String(input || '').trim();
  const match = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);

  if (!match) {
    return { ok: false, error: 'Введи дату, пожалуйста, в формате ДД.ММ.ГГГГ. Например: 14.08.1997' };
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (year < 1900 || year > new Date().getFullYear()) {
    return { ok: false, error: 'Кажется, с годом что-то не так. Проверь, пожалуйста: он должен быть в формате ГГГГ.' };
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValid) {
    return { ok: false, error: 'Кажется, такой даты нет. Попробуй ещё раз в формате ДД.ММ.ГГГГ.' };
  }

  return {
    ok: true,
    value: {
      day,
      month,
      year,
      iso: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
      display: `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`
    }
  };
}

export function parseBirthTime(input) {
  const text = String(input || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return { ok: false, error: 'Введи время, пожалуйста, в формате ЧЧ:ММ. Например: 08:45' };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { ok: false, error: 'Проверь время: часы — от 00 до 23, минуты — от 00 до 59.' };
  }

  return {
    ok: true,
    value: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  };
}

export function formatDateFromIso(isoDate) {
  if (!isoDate) return 'не указано';
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

export function normalizeText(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}
