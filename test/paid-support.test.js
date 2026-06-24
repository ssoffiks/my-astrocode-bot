import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getUserConsent,
  hasPurchase,
  initDb,
  recordPurchase,
  recordUserConsent,
  upsertUser
} from '../src/db.js';
import { paymentConsentKeyboard, productKeyboard } from '../src/keyboards.js';
import { buildStarsInvoice, parsePaymentPayload } from '../src/payments.js';
import {
  buildFullAstroPortrait,
  buildFullCompatibilityReport,
  buildPersonalMeditation,
  paymentSuccessText
} from '../src/paidContent.js';
import { PRODUCTS } from '../src/products.js';
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  helpText,
  paySupportText,
  paymentConsentText,
  paymentInfoText,
  privacyText,
  termsText
} from '../src/texts.js';

const USER = {
  id: 1001,
  first_name: 'Луна',
  username: 'moon_user'
};

const TAURUS_PROFILE = {
  birth_date: '1992-05-05',
  birth_date_display: '05.05.1992',
  birth_time: null,
  birth_time_unknown: true,
  birth_city: 'Москва',
  zodiac: 'Телец',
  is_cusp: false
};

const TAURUS_AQUARIUS_DRAFT = {
  first_birth_date: '1992-05-05',
  second_birth_date: '1993-02-01',
  first_sign: 'Телец',
  second_sign: 'Водолей'
};

test('service texts include terms, privacy, support and help commands', () => {
  const terms = termsText('@support');
  assert.match(terms, /Условия использования/);
  assert.match(terms, /Полный астропортрет — 99 Stars/);
  assert.match(terms, /Полная совместимость — 149 Stars/);
  assert.match(terms, /Персональная медитация — 49 Stars/);
  assert.match(terms, /Версия условий: 1\.0/);

  const privacy = privacyText();
  assert.match(privacy, /Политика приватности/);
  assert.match(privacy, /telegram_payment_charge_id/);
  assert.match(privacy, /Версия политики: 1\.0/);

  const support = paySupportText('@support');
  assert.match(support, /Поддержка по оплатам/);
  assert.match(support, /@support/);
  assert.match(support, /\/terms/);
  assert.match(support, /\/privacy/);

  assert.match(paySupportText(), /контакт поддержки скоро будет указан/);
  assert.match(helpText(), /\/terms/);
  assert.match(helpText(), /\/privacy/);
  assert.match(helpText(), /\/paysupport/);
});

test('payment info text lists service commands and current prices', () => {
  const text = paymentInfoText('@support');

  assert.match(text, /Полный астропортрет — 99 Stars/);
  assert.match(text, /Полная совместимость — 149 Stars/);
  assert.match(text, /Персональная медитация — 49 Stars/);
  assert.match(text, /\/terms/);
  assert.match(text, /\/privacy/);
  assert.match(text, /\/paysupport/);
});

test('paid product button leads to terms confirmation before invoice', () => {
  const product = productKeyboard('astro_full');
  assert.equal(product.reply_markup.inline_keyboard[0][0].callback_data, 'buy:astro_full');

  const consent = paymentConsentKeyboard('astro_full');
  assert.equal(consent.reply_markup.inline_keyboard[0][0].callback_data, 'confirm_buy:astro_full');
  assert.equal(consent.reply_markup.inline_keyboard[1][0].callback_data, 'terms_info');
  assert.equal(consent.reply_markup.inline_keyboard[1][1].callback_data, 'privacy_info');
  assert.equal(consent.reply_markup.inline_keyboard[2][0].callback_data, 'main_menu');

  assert.match(paymentConsentText(), /Перед оплатой маленькое уточнение/);
  assert.match(paymentConsentText(), /Согласна, перейти к оплате/);
  assert.match(paymentConsentText(), /\/terms/);
  assert.match(paymentConsentText(), /\/privacy/);
});

test('Stars invoice payload and prices stay correct after confirmation', () => {
  const invoice = buildStarsInvoice({
    chatId: 1001,
    product: PRODUCTS.astro_full,
    telegramId: USER.id,
    timestamp: 123456
  });

  assert.equal(invoice.currency, 'XTR');
  assert.equal(invoice.provider_token, '');
  assert.equal(invoice.prices[0].label, '99 Stars');
  assert.equal(invoice.prices[0].amount, 99);

  const payload = parsePaymentPayload(invoice.payload);
  assert.deepEqual(payload, {
    p: 'astro_full',
    u: USER.id,
    t: 123456,
    terms: TERMS_VERSION,
    privacy: PRIVACY_VERSION
  });
});

test('product prices stay 99 / 149 / 49 Stars', () => {
  assert.equal(PRODUCTS.astro_full.stars, 99);
  assert.equal(PRODUCTS.compatibility_full.stars, 149);
  assert.equal(PRODUCTS.meditation_personal.stars, 49);
});

test('user consent can be stored with terms and privacy versions', () => {
  initTestDb();
  upsertUser(USER);

  const consent = recordUserConsent(USER.id, TERMS_VERSION, PRIVACY_VERSION);
  assert.equal(consent.telegram_id, USER.id);
  assert.equal(consent.terms_version, TERMS_VERSION);
  assert.equal(consent.privacy_version, PRIVACY_VERSION);
  assert.ok(consent.accepted_at);

  const saved = getUserConsent(USER.id, TERMS_VERSION, PRIVACY_VERSION);
  assert.equal(saved.telegram_id, USER.id);
});

test('successful payment records purchase and existing purchase can be detected', () => {
  initTestDb();
  upsertUser(USER);

  assert.equal(hasPurchase(USER.id, 'astro_full'), false);
  recordPurchase(USER.id, {
    invoice_payload: JSON.stringify({ p: 'astro_full', u: USER.id, t: Date.now() }),
    telegram_payment_charge_id: 'charge-success',
    total_amount: PRODUCTS.astro_full.stars,
    currency: 'XTR'
  }, 'astro_full');

  assert.equal(hasPurchase(USER.id, 'astro_full'), true);
});

test('paid astro portrait contains full paid sections and no placeholder', () => {
  const messages = buildFullAstroPortrait(TAURUS_PROFILE);
  const text = messages.join('\n\n');

  assert.ok(messages.length > 1);
  assert.match(text, /Твой полный астропортрет/);
  assert.match(text, /Твой внутренний ритм/);
  assert.match(text, /Как ты чувствуешь и реагируешь/);
  assert.match(text, /Любовь и близость/);
  assert.match(text, /Деньги, цели и реализация/);
  assert.match(text, /Один вопрос для заметок/);
  assert.doesNotMatch(text, /скоро будет доступно|пока оплата готовится|полный разбор будет выглядеть/i);
});

test('paid compatibility contains full paid sections for both signs', () => {
  const messages = buildFullCompatibilityReport(TAURUS_AQUARIUS_DRAFT);
  const text = messages.join('\n\n');

  assert.ok(messages.length > 1);
  assert.match(text, /Полная совместимость/);
  assert.match(text, /Телец/);
  assert.match(text, /Водолей/);
  assert.match(text, /Общая атмосфера пары/);
  assert.match(text, /Что может притягивать/);
  assert.match(text, /Как каждый проявляет близость/);
  assert.match(text, /Вопрос для честного разговора/);
  assert.doesNotMatch(text, /скоро будет доступно|пока оплата готовится|полный разбор будет выглядеть/i);
});

test('paid meditation contains a complete 5-7 minute practice adapted by element', () => {
  const messages = buildPersonalMeditation(TAURUS_PROFILE);
  const text = messages.join('\n\n');

  assert.ok(messages.length > 1);
  assert.match(text, /Персональная медитация/);
  assert.match(text, /зем/i);
  assert.match(text, /Настрой перед практикой/);
  assert.match(text, /Дыхание/);
  assert.match(text, /Расслабление тела/);
  assert.match(text, /Вопрос для дневника/);
  assert.match(text, /Маленькое действие на день/);
  assert.doesNotMatch(text, /скоро будет доступно|пока оплата готовится|полный разбор будет выглядеть/i);
});

test('successful payment message opens real paid material tone', () => {
  const text = paymentSuccessText(PRODUCTS.astro_full);

  assert.match(text, /Оплата прошла/);
  assert.match(text, /Полный астропортрет/);
  assert.match(text, /спокойное знакомство с собой/);
});

function initTestDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocode-bot-test-'));
  initDb(path.join(tmpDir, 'astrocode.sqlite'));
}
