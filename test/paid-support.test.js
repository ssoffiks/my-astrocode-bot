import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getUserConsent,
  hasPurchase,
  initDb,
  listPurchases,
  recordPurchase,
  recordUserConsent,
  saveCompatibilityDraft,
  saveProfile,
  upsertUser
} from '../src/db.js';
import {
  alreadyPurchasedText,
  handlePreCheckoutQuery,
  handleSuccessfulPayment,
  openAlreadyPurchasedProduct,
  replyProductOfferOrPurchased
} from '../src/purchaseAccess.js';
import { paymentConsentKeyboard, productKeyboard } from '../src/keyboards.js';
import { buildPaymentPayload, buildStarsInvoice, parsePaymentPayload } from '../src/payments.js';
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
  fullAstroSaleText,
  fullCompatibilitySaleText,
  helpText,
  personalMeditationSaleText,
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

test('user without meditation purchase sees price and Stars payment button', async () => {
  initPaidFlowDb();
  const ctx = createPaidCtx();

  await replyProductOfferOrPurchased(
    ctx,
    PRODUCTS.meditation_personal.id,
    personalMeditationSaleText(),
    deliverTestProduct
  );

  assert.match(allRepliesText(ctx), /Стоимость: 49 Stars/);
  assert.equal(hasInlineCallback(ctx, 'buy:meditation_personal'), true);
  assert.equal(ctx.invoices.length, 0);
});

test('user with meditation purchase gets paid material without repeated payment offer', async () => {
  initPaidFlowDb();
  recordPurchase(USER.id, payment('meditation_personal', 'charge-meditation'), PRODUCTS.meditation_personal.id);
  const ctx = createPaidCtx();

  await replyProductOfferOrPurchased(
    ctx,
    PRODUCTS.meditation_personal.id,
    personalMeditationSaleText(),
    deliverTestProduct
  );

  assert.equal(ctx.replies[0].text, alreadyPurchasedText(PRODUCTS.meditation_personal.id));
  assert.match(allRepliesText(ctx), /Персональная медитация/);
  assert.equal(hasInlineCallback(ctx, 'buy:meditation_personal'), false);
  assert.doesNotMatch(allRepliesText(ctx), /Стоимость: 49 Stars/);
  assert.equal(ctx.invoices.length, 0);
});

test('user with astro_full purchase gets paid material without repeated payment offer', async () => {
  initPaidFlowDb();
  recordPurchase(USER.id, payment('astro_full', 'charge-astro'), PRODUCTS.astro_full.id);
  const ctx = createPaidCtx();

  await replyProductOfferOrPurchased(
    ctx,
    PRODUCTS.astro_full.id,
    fullAstroSaleText(),
    deliverTestProduct
  );

  assert.equal(ctx.replies[0].text, alreadyPurchasedText(PRODUCTS.astro_full.id));
  assert.match(allRepliesText(ctx), /Твой полный астропортрет/);
  assert.equal(hasInlineCallback(ctx, 'buy:astro_full'), false);
  assert.doesNotMatch(allRepliesText(ctx), /Стоимость: 99 Stars/);
  assert.equal(ctx.invoices.length, 0);
});

test('user with compatibility_full purchase gets paid material without repeated payment offer', async () => {
  initPaidFlowDb();
  recordPurchase(USER.id, payment('compatibility_full', 'charge-compatibility'), PRODUCTS.compatibility_full.id);
  const ctx = createPaidCtx();

  await replyProductOfferOrPurchased(
    ctx,
    PRODUCTS.compatibility_full.id,
    fullCompatibilitySaleText(),
    deliverTestProduct
  );

  assert.equal(ctx.replies[0].text, alreadyPurchasedText(PRODUCTS.compatibility_full.id));
  assert.match(allRepliesText(ctx), /Полная совместимость/);
  assert.equal(hasInlineCallback(ctx, 'buy:compatibility_full'), false);
  assert.doesNotMatch(allRepliesText(ctx), /Стоимость: 149 Stars/);
  assert.equal(ctx.invoices.length, 0);
});

test('old payment callback for purchased product does not create invoice and removes button when possible', async () => {
  initPaidFlowDb();
  recordPurchase(USER.id, payment('meditation_personal', 'charge-old-button'), PRODUCTS.meditation_personal.id);
  const ctx = createPaidCtx();

  await openAlreadyPurchasedProduct(
    ctx,
    PRODUCTS.meditation_personal.id,
    deliverTestProduct,
    { removePaymentButton: true }
  );

  assert.equal(ctx.invoices.length, 0);
  assert.deepEqual(ctx.editedReplyMarkups[0], { inline_keyboard: [] });
  assert.equal(ctx.replies[0].text, alreadyPurchasedText(PRODUCTS.meditation_personal.id));
  assert.match(allRepliesText(ctx), /Персональная медитация/);
});

test('pre_checkout_query for already purchased product is rejected', async () => {
  initPaidFlowDb();
  recordPurchase(USER.id, payment('meditation_personal', 'charge-precheckout'), PRODUCTS.meditation_personal.id);
  const ctx = createPaidCtx({
    preCheckoutPayload: buildPaymentPayload(PRODUCTS.meditation_personal.id, USER.id, 123)
  });

  await handlePreCheckoutQuery(ctx);

  assert.equal(ctx.preCheckoutAnswers.length, 1);
  assert.equal(ctx.preCheckoutAnswers[0].ok, false);
  assert.match(ctx.preCheckoutAnswers[0].extra.error_message, /Повторная оплата не нужна/);
});

test('duplicate successful_payment opens material without creating duplicate purchase', async () => {
  initPaidFlowDb();
  recordPurchase(USER.id, payment('meditation_personal', 'charge-original'), PRODUCTS.meditation_personal.id);
  const ctx = createPaidCtx({
    successfulPayment: payment('meditation_personal', 'charge-duplicate')
  });

  await handleSuccessfulPayment(ctx, deliverTestProduct);

  assert.equal(listPurchases(USER.id).length, 1);
  assert.equal(ctx.replies[0].text, alreadyPurchasedText(PRODUCTS.meditation_personal.id));
  assert.match(allRepliesText(ctx), /Персональная медитация/);
  assert.doesNotMatch(allRepliesText(ctx), /Оплата прошла/);
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

function initPaidFlowDb() {
  initTestDb();
  upsertUser(USER);
  saveProfile(USER.id, TAURUS_PROFILE);
  saveCompatibilityDraft(USER.id, TAURUS_AQUARIUS_DRAFT);
}

function payment(productId, chargeId) {
  const product = PRODUCTS[productId];

  return {
    invoice_payload: JSON.stringify({ p: productId, u: USER.id, t: Date.now() }),
    telegram_payment_charge_id: chargeId,
    total_amount: product.stars,
    currency: 'XTR'
  };
}

function createPaidCtx({ successfulPayment = null, preCheckoutPayload = null } = {}) {
  const replies = [];
  const invoices = [];
  const editedReplyMarkups = [];
  const preCheckoutAnswers = [];

  return {
    from: USER,
    chat: { id: USER.id },
    message: {
      text: '',
      successful_payment: successfulPayment
    },
    preCheckoutQuery: preCheckoutPayload
      ? {
          id: 'pre-checkout-1',
          from: USER,
          invoice_payload: preCheckoutPayload
        }
      : undefined,
    replies,
    invoices,
    editedReplyMarkups,
    preCheckoutAnswers,
    reply: async (text, extra) => {
      replies.push({ text, extra });
      return { text, extra };
    },
    editMessageReplyMarkup: async (markup) => {
      editedReplyMarkups.push(markup);
      return true;
    },
    telegram: {
      callApi: async (method, payload) => {
        if (method === 'sendInvoice') invoices.push(payload);
        return payload;
      },
      answerPreCheckoutQuery: async (id, ok, extra = {}) => {
        preCheckoutAnswers.push({ id, ok, extra });
        return true;
      }
    }
  };
}

async function deliverTestProduct(ctx, productId) {
  const messages = {
    [PRODUCTS.astro_full.id]: buildFullAstroPortrait(TAURUS_PROFILE),
    [PRODUCTS.compatibility_full.id]: buildFullCompatibilityReport(TAURUS_AQUARIUS_DRAFT),
    [PRODUCTS.meditation_personal.id]: buildPersonalMeditation(TAURUS_PROFILE)
  }[productId] || [];

  for (const message of messages) {
    await ctx.reply(message);
  }
}

function allRepliesText(ctx) {
  return ctx.replies.map((reply) => reply.text).join('\n\n');
}

function hasInlineCallback(ctx, callbackData) {
  return ctx.replies.some((reply) => {
    const rows = reply.extra?.reply_markup?.inline_keyboard || [];
    return rows.flat().some((button) => button.callback_data === callbackData);
  });
}
