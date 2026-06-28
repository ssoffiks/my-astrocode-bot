import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handleText } from '../src/bot.js';
import { initDb, getMoonProfile, getState, saveMoonProfile, setState, upsertUser } from '../src/db.js';
import { mainMenuKeyboard, moonResultKeyboard } from '../src/keyboards.js';
import {
  calculateMoon,
  parseMoonBirthDate,
  parseMoonBirthTime,
  parseUtcOffset,
  resolveCityTimeZone
} from '../src/astro/moon.js';
import {
  moonCityPromptText,
  moonDatePromptText,
  moonIntroText,
  moonMeaningText,
  moonResultText,
  moonTimePromptText,
  moonUtcOffsetPromptText
} from '../src/moonTexts.js';

const USER = {
  id: 4242,
  first_name: 'Луна',
  username: 'moon_child'
};

test('main menu contains Moon section and result actions', () => {
  const menuItems = mainMenuKeyboard().reply_markup.keyboard.flat();
  const resultItems = moonResultKeyboard().reply_markup.keyboard.flat();

  assert.equal(menuItems.includes('🌙 Узнать свою Луну'), true);
  assert.equal(resultItems.includes('🔁 Рассчитать заново'), true);
  assert.equal(resultItems.includes('🪐 Что значит Луна в карте?'), true);
  assert.equal(resultItems.includes('🏠 В главное меню'), true);
});

test('Moon intro and prompts match the expected soft scenario', () => {
  assert.match(moonIntroText(), /Луна в натальной карте показывает/);
  assert.match(moonIntroText(), /Если точное время неизвестно/);
  assert.match(moonDatePromptText(), /ДД\.ММ\.ГГГГ/);
  assert.match(moonTimePromptText(), /Не знаю время/);
  assert.match(moonCityPromptText(), /Москва, Санкт-Петербург, Алматы, Берлин/);
  assert.match(moonUtcOffsetPromptText(), /UTC-смещение/);
  assert.match(moonMeaningText(), /Солнце чаще показывает/);
});

test('Moon birth date validation rejects invalid, future and too old dates', () => {
  const now = new Date(Date.UTC(2026, 5, 28));

  assert.equal(parseMoonBirthDate('14.08.1998', now).ok, true);
  assert.equal(parseMoonBirthDate('31.02.1998', now).ok, false);
  assert.equal(parseMoonBirthDate('14/08/1998', now).ok, false);
  assert.equal(parseMoonBirthDate('01.01.1899', now).ok, false);
  assert.equal(parseMoonBirthDate('29.06.2026', now).ok, false);
});

test('Moon birth time validation accepts HH:MM and rejects impossible time', () => {
  const parsed = parseMoonBirthTime('8:35');

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value, '08:35');
  assert.equal(parseMoonBirthTime('24:00').ok, false);
  assert.equal(parseMoonBirthTime('08.35').ok, false);
});

test('city timezone can be resolved and unknown city falls back to manual UTC offset', () => {
  assert.deepEqual(resolveCityTimeZone('Москва'), { timeZone: 'Europe/Moscow', source: 'city' });
  assert.deepEqual(resolveCityTimeZone('Берлин'), { timeZone: 'Europe/Berlin', source: 'city' });
  assert.equal(resolveCityTimeZone('Город Лунных Котов'), null);

  assert.equal(parseUtcOffset('+3').value, 180);
  assert.equal(parseUtcOffset('+03').value, 180);
  assert.equal(parseUtcOffset('+03:00').value, 180);
  assert.equal(parseUtcOffset('-5').value, -300);
  assert.equal(parseUtcOffset('-05:00').value, -300);
  assert.equal(parseUtcOffset('3').ok, false);
});

test('Moon calculation uses astronomical longitude and returns sign for exact time', () => {
  const result = calculateMoon({
    birthDate: '1998-08-14',
    birthTime: '08:35',
    timeUnknown: false,
    timeZone: 'Europe/Moscow'
  });

  assert.equal(result.sign, 'Телец');
  assert.ok(result.longitude >= 30 && result.longitude < 60);
  assert.equal(result.utcOffsetLabel, 'UTC+04:00');
});

test('unknown birth time uses noon and warns if Moon changed sign during the day', () => {
  const result = calculateMoon({
    birthDate: '1998-01-02',
    birthTime: '12:00',
    timeUnknown: true,
    timeZone: 'Europe/Moscow'
  });
  const text = moonResultText(result);

  assert.equal(result.timeUnknown, true);
  assert.equal(result.dayRange.changedSign, true);
  assert.match(text, /расчёт примерный/);
  assert.match(text, /Луна могла перейти из одного знака в другой/);
});

test('Moon profile is saved and recalculation updates existing row', () => {
  initTestDb();
  upsertUser(USER);

  saveMoonProfile(USER.id, {
    birth_date: '1998-08-14',
    birth_time: '08:35',
    time_unknown: false,
    birth_city: 'Москва',
    time_zone: 'Europe/Moscow',
    utc_offset_minutes: 180,
    moon_sign: 'Телец',
    moon_longitude: 43.4
  });

  saveMoonProfile(USER.id, {
    birth_date: '1998-01-02',
    birth_time: null,
    time_unknown: true,
    birth_city: 'Берлин',
    time_zone: 'Europe/Berlin',
    utc_offset_minutes: 60,
    moon_sign: 'Водолей',
    moon_longitude: 329.9
  });

  const saved = getMoonProfile(USER.id);
  assert.equal(saved.birth_date_display, '02.01.1998');
  assert.equal(saved.time_unknown, true);
  assert.equal(saved.birth_city, 'Берлин');
  assert.equal(saved.moon_sign, 'Водолей');
});

test('Moon FSM completes exact-time flow and saves moon_profiles', async () => {
  initMoonFlowDb();

  await sendMoonText('/moon');
  await sendMoonText('Начать расчёт');
  const invalidDate = await sendMoonText('32.01.1998');
  assert.match(lastReplyText(invalidDate), /дата указана не совсем корректно/);
  assert.equal(getState(USER.id).state, 'moon_await_birth_date');

  await sendMoonText('14.08.1998');
  const invalidTime = await sendMoonText('25:99');
  assert.match(lastReplyText(invalidTime), /время указано не совсем корректно/);
  assert.equal(getState(USER.id).state, 'moon_await_birth_time');

  await sendMoonText('08:35');
  const result = await sendMoonText('Москва');
  const saved = getMoonProfile(USER.id);

  assert.equal(saved.moon_sign, 'Телец');
  assert.equal(saved.birth_time, '08:35');
  assert.equal(saved.time_unknown, false);
  assert.equal(saved.birth_city, 'Москва');
  assert.equal(getState(USER.id), null);
  assert.match(lastReplyText(result), /🌙 Твоя Луна: Луна в Тельце/);
});

test('Moon FSM supports unknown city, manual UTC offset and unknown birth time', async () => {
  initMoonFlowDb();

  await sendMoonText('/moon');
  await sendMoonText('Начать расчёт');
  await sendMoonText('02.01.1998');
  await sendMoonText('Не знаю время');
  const city = await sendMoonText('Город Лунных Котов');
  assert.match(lastReplyText(city), /UTC-смещение/);
  assert.equal(getState(USER.id).state, 'moon_await_utc_offset');

  const invalidOffset = await sendMoonText('мск');
  assert.match(lastReplyText(invalidOffset), /Введи UTC-смещение/);

  const result = await sendMoonText('+3');
  const saved = getMoonProfile(USER.id);

  assert.equal(saved.time_unknown, true);
  assert.equal(saved.birth_time, null);
  assert.equal(saved.utc_offset_minutes, 180);
  assert.match(lastReplyText(result), /расчёт примерный/);
  assert.equal(getState(USER.id), null);
});

test('Moon FSM handles restart, main menu return and stale state interruption', async () => {
  initMoonFlowDb();

  setState(USER.id, 'await_birth_date', {});
  const interrupted = await sendMoonText('🌙 Узнать свою Луну');
  assert.match(lastReplyText(interrupted), /Луна в натальной карте показывает/);
  assert.equal(getState(USER.id).state, 'moon_await_start');

  const restarted = await sendMoonText('🔁 Рассчитать заново');
  assert.match(lastReplyText(restarted), /Луна в натальной карте показывает/);
  assert.equal(getState(USER.id).state, 'moon_await_start');

  await sendMoonText('Начать расчёт');
  assert.equal(getState(USER.id).state, 'moon_await_birth_date');

  const menu = await sendMoonText('🏠 В главное меню');
  assert.match(lastReplyText(menu), /Что хочешь посмотреть дальше/);
  assert.equal(getState(USER.id), null);
});

function initTestDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocode-moon-test-'));
  initDb(path.join(tmpDir, 'astrocode.sqlite'));
}

function initMoonFlowDb() {
  initTestDb();
  upsertUser(USER);
}

async function sendMoonText(text) {
  const ctx = createTextCtx(text);
  await handleText(ctx, { supportUsername: '' });
  return ctx;
}

function createTextCtx(text) {
  const replies = [];

  return {
    from: USER,
    message: { text },
    replies,
    reply: async (replyText, extra) => {
      replies.push({ text: replyText, extra });
      return { text: replyText, extra };
    }
  };
}

function lastReplyText(ctx) {
  return ctx.replies.at(-1)?.text || '';
}
