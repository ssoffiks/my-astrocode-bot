import test from 'node:test';
import assert from 'node:assert/strict';
import { mainMenuKeyboard } from '../src/keyboards.js';
import {
  CHANNEL_URL,
  channelKeyboard,
  channelText,
  compatibilityChannelCtaText,
  meditationChannelCtaText,
  miniProfileChannelCtaText,
  paidContentChannelCtaText
} from '../src/channel.js';

test('/channel text returns project channel link and button data', () => {
  const text = channelText();
  const keyboard = channelKeyboard();

  assert.match(text, /Канал проекта/);
  assert.match(text, /wellness/);
  assert.match(text, new RegExp(CHANNEL_URL));
  assert.equal(keyboard.reply_markup.inline_keyboard[0][0].text, 'Перейти в канал 🌙');
  assert.equal(keyboard.reply_markup.inline_keyboard[0][0].url, CHANNEL_URL);
});

test('main menu contains project channel item', () => {
  const rows = mainMenuKeyboard().reply_markup.keyboard;
  assert.equal(rows.flat().includes('🌙 Канал проекта'), true);
});

test('mini-profile CTA points to the project channel gently', () => {
  const text = miniProfileChannelCtaText();
  const keyboard = channelKeyboard('Канал проекта 🌙');

  assert.match(text, /Если откликнулось/);
  assert.match(text, /мягкими заметками/);
  assert.equal(keyboard.reply_markup.inline_keyboard[0][0].url, CHANNEL_URL);
});

test('meditation CTA points to the project channel gently', () => {
  const text = meditationChannelCtaText();
  const keyboard = channelKeyboard('Заглянуть в канал 🌙');

  assert.match(text, /Больше спокойных заметок и практик/);
  assert.equal(keyboard.reply_markup.inline_keyboard[0][0].text, 'Заглянуть в канал 🌙');
  assert.equal(keyboard.reply_markup.inline_keyboard[0][0].url, CHANNEL_URL);
});

test('compatibility and paid content CTA texts stay soft and non-promotional', () => {
  assert.match(compatibilityChannelCtaText(), /отношения, ресурс и самопонимание/);
  assert.match(paidContentChannelCtaText(), /Спасибо, что заглянула глубже/);
});
