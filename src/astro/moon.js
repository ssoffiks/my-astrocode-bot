import { EclipticGeoMoon } from 'astronomy-engine';

export const MOON_SIGNS = [
  'Овен',
  'Телец',
  'Близнецы',
  'Рак',
  'Лев',
  'Дева',
  'Весы',
  'Скорпион',
  'Стрелец',
  'Козерог',
  'Водолей',
  'Рыбы'
];

const DATE_ERROR = 'Кажется, дата указана не совсем корректно. Попробуй ещё раз в формате ДД.ММ.ГГГГ — например, 14.08.1998';
const TIME_ERROR = 'Кажется, время указано не совсем корректно. Попробуй ещё раз в формате ЧЧ:ММ — например, 08:35';
const UTC_OFFSET_ERROR = 'Введи UTC-смещение в формате +3, +03, +03:00, -5 или -05:00.';

const CITY_TIME_ZONES = new Map([
  ['москва', 'Europe/Moscow'],
  ['moscow', 'Europe/Moscow'],
  ['санкт-петербург', 'Europe/Moscow'],
  ['санкт петербург', 'Europe/Moscow'],
  ['питер', 'Europe/Moscow'],
  ['spb', 'Europe/Moscow'],
  ['saint petersburg', 'Europe/Moscow'],
  ['алматы', 'Asia/Almaty'],
  ['алма-ата', 'Asia/Almaty'],
  ['almaty', 'Asia/Almaty'],
  ['астана', 'Asia/Almaty'],
  ['нур-султан', 'Asia/Almaty'],
  ['берлин', 'Europe/Berlin'],
  ['berlin', 'Europe/Berlin'],
  ['минск', 'Europe/Minsk'],
  ['minsk', 'Europe/Minsk'],
  ['киев', 'Europe/Kyiv'],
  ['київ', 'Europe/Kyiv'],
  ['kiev', 'Europe/Kyiv'],
  ['kyiv', 'Europe/Kyiv'],
  ['тбилиси', 'Asia/Tbilisi'],
  ['tbilisi', 'Asia/Tbilisi'],
  ['ереван', 'Asia/Yerevan'],
  ['yerevan', 'Asia/Yerevan'],
  ['баку', 'Asia/Baku'],
  ['baku', 'Asia/Baku'],
  ['ташкент', 'Asia/Tashkent'],
  ['tashkent', 'Asia/Tashkent'],
  ['бишкек', 'Asia/Bishkek'],
  ['bishkek', 'Asia/Bishkek'],
  ['дубай', 'Asia/Dubai'],
  ['dubai', 'Asia/Dubai'],
  ['лондон', 'Europe/London'],
  ['london', 'Europe/London'],
  ['париж', 'Europe/Paris'],
  ['paris', 'Europe/Paris'],
  ['рим', 'Europe/Rome'],
  ['rome', 'Europe/Rome'],
  ['нью-йорк', 'America/New_York'],
  ['нью йорк', 'America/New_York'],
  ['new york', 'America/New_York'],
  ['лос-анджелес', 'America/Los_Angeles'],
  ['лос анджелес', 'America/Los_Angeles'],
  ['los angeles', 'America/Los_Angeles']
]);

export function parseMoonBirthDate(input, now = new Date()) {
  const text = String(input || '').trim();
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) return { ok: false, error: DATE_ERROR };

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValid || year < 1900 || isFutureDate(date, now)) {
    return { ok: false, error: DATE_ERROR };
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

export function parseMoonBirthTime(input) {
  const text = String(input || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return { ok: false, error: TIME_ERROR };

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { ok: false, error: TIME_ERROR };
  }

  return {
    ok: true,
    value: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  };
}

export function parseUtcOffset(input) {
  const text = String(input || '').trim();
  const match = text.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);

  if (!match) return { ok: false, error: UTC_OFFSET_ERROR };

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || '0');

  if (hours > 14 || minutes > 59 || (hours === 14 && minutes > 0)) {
    return { ok: false, error: UTC_OFFSET_ERROR };
  }

  return {
    ok: true,
    value: sign * (hours * 60 + minutes),
    label: formatUtcOffset(sign * (hours * 60 + minutes))
  };
}

export function resolveCityTimeZone(city) {
  const normalized = normalizeCity(city);
  const timeZone = CITY_TIME_ZONES.get(normalized);
  return timeZone ? { timeZone, source: 'city' } : null;
}

export function calculateMoon({ birthDate, birthTime, timeUnknown = false, timeZone = null, utcOffsetMinutes = null }) {
  const calculationTime = birthTime || '12:00';
  const exact = localDateTimeToUtc({ birthDate, birthTime: calculationTime, timeZone, utcOffsetMinutes });
  const longitude = moonLongitude(exact.date);
  const sign = signFromLongitude(longitude);

  let dayRange = null;
  if (timeUnknown) {
    const start = localDateTimeToUtc({ birthDate, birthTime: '00:00', timeZone, utcOffsetMinutes });
    const end = localDateTimeToUtc({ birthDate, birthTime: '23:59', timeZone, utcOffsetMinutes });
    const startLongitude = moonLongitude(start.date);
    const endLongitude = moonLongitude(end.date);
    const startSign = signFromLongitude(startLongitude);
    const endSign = signFromLongitude(endLongitude);

    dayRange = {
      startSign,
      endSign,
      changedSign: startSign !== endSign
    };
  }

  return {
    sign,
    longitude,
    utcDate: exact.date,
    utcOffsetMinutes: exact.utcOffsetMinutes,
    utcOffsetLabel: formatUtcOffset(exact.utcOffsetMinutes),
    timeZone,
    timeUnknown: Boolean(timeUnknown),
    dayRange
  };
}

export function signFromLongitude(longitude) {
  const normalized = normalizeLongitude(longitude);
  return MOON_SIGNS[Math.floor(normalized / 30)] || MOON_SIGNS[0];
}

export function formatUtcOffset(offsetMinutes) {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60).toString().padStart(2, '0');
  const minutes = (abs % 60).toString().padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}

function moonLongitude(date) {
  return normalizeLongitude(EclipticGeoMoon(date).lon);
}

function localDateTimeToUtc({ birthDate, birthTime, timeZone, utcOffsetMinutes }) {
  const { year, month, day } = parseIsoDate(birthDate);
  const { hour, minute } = parseTimeParts(birthTime);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);

  if (timeZone) {
    let offset = getTimeZoneOffsetMinutes(timeZone, new Date(utcGuess));
    let corrected = new Date(utcGuess - offset * 60_000);
    const refinedOffset = getTimeZoneOffsetMinutes(timeZone, corrected);

    if (refinedOffset !== offset) {
      offset = refinedOffset;
      corrected = new Date(utcGuess - offset * 60_000);
    }

    return { date: corrected, utcOffsetMinutes: offset };
  }

  if (Number.isFinite(utcOffsetMinutes)) {
    return {
      date: new Date(utcGuess - utcOffsetMinutes * 60_000),
      utcOffsetMinutes
    };
  }

  throw new Error('Time zone or UTC offset is required for Moon calculation.');
}

function getTimeZoneOffsetMinutes(timeZone, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset'
  }).formatToParts(date);

  const value = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT';
  const match = value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);

  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || '0');
  return sign * (hours * 60 + minutes);
}

function parseIsoDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  return { year, month, day };
}

function parseTimeParts(time) {
  const [hour, minute] = String(time).split(':').map(Number);
  return { hour, minute };
}

function normalizeLongitude(longitude) {
  return ((longitude % 360) + 360) % 360;
}

function normalizeCity(city) {
  return String(city || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
}

function isFutureDate(date, now) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return date.getTime() > today.getTime();
}
