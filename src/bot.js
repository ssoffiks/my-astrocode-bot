import { Telegraf } from 'telegraf';
import {
  clearState,
  deleteProfile,
  getCompatibilityDraft,
  getProfile,
  getState,
  hasPurchase,
  listPurchases,
  recordUserConsent,
  recordPurchase,
  saveCompatibilityDraft,
  saveProfile,
  setState,
  upsertUser
} from './db.js';
import { PRODUCTS, getProduct } from './products.js';
import { buildStarsInvoice, parsePaymentPayload } from './payments.js';
import {
  editProfileKeyboard,
  mainMenuKeyboard,
  paymentConsentKeyboard,
  productKeyboard,
  profileActionsKeyboard,
  timeKnowledgeKeyboard
} from './keyboards.js';
import {
  FIRST_MESSAGE,
  MAIN_MENU,
  PRIVACY_VERSION,
  TERMS_VERSION,
  fullAstroSaleText,
  fullCompatibilitySaleText,
  helpText,
  meditationOfDayText,
  paymentConsentText,
  paymentInfoText,
  paySupportText,
  personalMeditationSaleText,
  privacyText,
  starsHelpText,
  termsText
} from './texts.js';
import { parseBirthDate, parseBirthTime, normalizeText } from './utils/dates.js';
import { getZodiacFromIso, isCuspDate } from './astro/zodiac.js';
import {
  generateMiniCompatibility,
  generateMiniProfile,
  generateSavedProfile
} from './astro/generators.js';
import {
  buildFullAstroPortrait,
  buildFullCompatibilityReport,
  buildPersonalMeditation,
  paymentSuccessText
} from './paidContent.js';

const STATES = {
  AWAIT_BIRTH_DATE: 'await_birth_date',
  AWAIT_TIME_KNOWLEDGE: 'await_time_knowledge',
  AWAIT_BIRTH_TIME: 'await_birth_time',
  AWAIT_CITY: 'await_city',
  AWAIT_PROFILE_ACTION: 'await_profile_action',
  AWAIT_EDIT_CHOICE: 'await_edit_choice',
  AWAIT_EDIT_BIRTH_DATE: 'await_edit_birth_date',
  AWAIT_EDIT_TIME_KNOWLEDGE: 'await_edit_time_knowledge',
  AWAIT_EDIT_BIRTH_TIME: 'await_edit_birth_time',
  AWAIT_EDIT_CITY: 'await_edit_city',
  COMPAT_AWAIT_FIRST_DATE: 'compat_await_first_date',
  COMPAT_AWAIT_SECOND_DATE: 'compat_await_second_date'
};

export function createBot(config) {
  const bot = new Telegraf(config.botToken);

  bot.use(async (ctx, next) => {
    if (ctx.from?.id) {
      upsertUser(ctx.from);
    }
    return next();
  });

  bot.start((ctx) => startProfileFlow(ctx));
  bot.command('profile', (ctx) => openProfile(ctx));
  bot.command('compatibility', (ctx) => startCompatibilityFlow(ctx));
  bot.command('meditation', (ctx) => openMeditation(ctx));
  bot.command('help', (ctx) => showHelp(ctx));
  bot.command('paysupport', (ctx) => ctx.reply(paySupportText(config.supportUsername), mainMenuKeyboard()));
  bot.command('support', (ctx) => ctx.reply(paySupportText(config.supportUsername), mainMenuKeyboard()));
  bot.command('suppport', (ctx) => ctx.reply(paySupportText(config.supportUsername), mainMenuKeyboard()));
  bot.command('terms', (ctx) => ctx.reply(termsText(config.supportUsername), mainMenuKeyboard()));
  bot.command('privacy', (ctx) => ctx.reply(privacyText(), mainMenuKeyboard()));

  bot.action('stars_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(starsHelpText());
  });

  bot.action('terms_info', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(termsText(config.supportUsername), mainMenuKeyboard());
  });

  bot.action('privacy_info', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(privacyText(), mainMenuKeyboard());
  });

  bot.action('main_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(MAIN_MENU, mainMenuKeyboard());
  });

  bot.action(/^buy:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const productId = ctx.match[1];
    await buyProduct(ctx, productId);
  });

  bot.action(/^confirm_buy:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const productId = ctx.match[1];
    await confirmProductPayment(ctx, productId);
  });

  bot.on('pre_checkout_query', async (ctx) => {
    await ctx.telegram.answerPreCheckoutQuery(ctx.preCheckoutQuery.id, true);
  });

  bot.on('successful_payment', async (ctx) => {
    await handleSuccessfulPayment(ctx);
  });

  bot.on('text', async (ctx) => {
    await handleText(ctx, config);
  });

  bot.catch((error, ctx) => {
    console.error('Bot error', error);
    return ctx.reply('Ой, что-то пошло не так. Попробуй ещё раз через минутку или напиши /help — я помогу вернуться в меню 🌙').catch(() => undefined);
  });

  return bot;
}

async function handleText(ctx, config) {
  const text = ctx.message.text;
  const normalized = normalizeText(text);

  if (isStartText(normalized)) return startProfileFlow(ctx);
  if (normalized === '/terms') return ctx.reply(termsText(config.supportUsername), mainMenuKeyboard());
  if (normalized === '/privacy') return ctx.reply(privacyText(), mainMenuKeyboard());
  if (normalized === '/paysupport' || normalized === '/support' || normalized === '/suppport') {
    return ctx.reply(paySupportText(config.supportUsername), mainMenuKeyboard());
  }
  if (normalized === '/help') return showHelp(ctx);

  const state = getState(ctx.from.id);
  if (state) {
    return handleStatefulText(ctx, state, normalized);
  }

  if (isFullCompatibilityText(normalized)) return openFullCompatibility(ctx);
  if (isPersonalMeditationText(normalized)) return openPersonalMeditation(ctx);
  if (isFullAstroText(normalized)) return openFullAstro(ctx);
  if (isProfileText(normalized)) return openProfile(ctx);
  if (isCompatibilityText(normalized)) return startCompatibilityFlow(ctx);
  if (isMeditationText(normalized)) return openMeditation(ctx);
  if (isPaymentText(normalized)) return ctx.reply(paymentInfoText(config.supportUsername), mainMenuKeyboard());
  if (isHelpText(normalized)) return showHelp(ctx);

  return ctx.reply(`Я рядом 🌙

Напиши номер раздела или выбери кнопку в меню — и спокойно продолжим.`, mainMenuKeyboard());
}

async function handleStatefulText(ctx, currentState, normalized) {
  switch (currentState.state) {
    case STATES.AWAIT_BIRTH_DATE:
      return handleBirthDate(ctx, currentState.data);
    case STATES.AWAIT_TIME_KNOWLEDGE:
      return handleTimeKnowledge(ctx, currentState.data, normalized);
    case STATES.AWAIT_BIRTH_TIME:
      return handleBirthTime(ctx, currentState.data);
    case STATES.AWAIT_CITY:
      return handleBirthCity(ctx, currentState.data);
    case STATES.AWAIT_PROFILE_ACTION:
      return handleProfileAction(ctx, normalized);
    case STATES.AWAIT_EDIT_CHOICE:
      return handleEditChoice(ctx, normalized);
    case STATES.AWAIT_EDIT_BIRTH_DATE:
      return handleEditBirthDate(ctx);
    case STATES.AWAIT_EDIT_TIME_KNOWLEDGE:
      return handleEditTimeKnowledge(ctx, normalized);
    case STATES.AWAIT_EDIT_BIRTH_TIME:
      return handleEditBirthTime(ctx);
    case STATES.AWAIT_EDIT_CITY:
      return handleEditCity(ctx);
    case STATES.COMPAT_AWAIT_FIRST_DATE:
      return handleCompatibilityFirstDate(ctx);
    case STATES.COMPAT_AWAIT_SECOND_DATE:
      return handleCompatibilitySecondDate(ctx, currentState.data);
    default:
      clearState(ctx.from.id);
      return ctx.reply(MAIN_MENU, mainMenuKeyboard());
  }
}

async function startProfileFlow(ctx) {
  setState(ctx.from.id, STATES.AWAIT_BIRTH_DATE, {});
  await ctx.reply(FIRST_MESSAGE, { reply_markup: { remove_keyboard: true } });
}

async function handleBirthDate(ctx, data) {
  const parsed = parseBirthDate(ctx.message.text);
  if (!parsed.ok) return ctx.reply(parsed.error);

  setState(ctx.from.id, STATES.AWAIT_TIME_KNOWLEDGE, {
    ...data,
    birth_date: parsed.value.iso,
    birth_date_display: parsed.value.display
  });

  return ctx.reply(`Знаешь своё точное время рождения? 🌙

Ответь одним из вариантов:
Да, знаю время
Не знаю время`, timeKnowledgeKeyboard());
}

async function handleTimeKnowledge(ctx, data, normalized) {
  if (isYes(normalized)) {
    setState(ctx.from.id, STATES.AWAIT_BIRTH_TIME, data);
    return ctx.reply(`Отлично. Введи время рождения в формате ЧЧ:ММ.

Например: 08:45`, { reply_markup: { remove_keyboard: true } });
  }

  if (isNo(normalized)) {
    setState(ctx.from.id, STATES.AWAIT_CITY, {
      ...data,
      birth_time: null,
      birth_time_unknown: true
    });

    await ctx.reply(`Ничего страшного 🌙

Я соберу базовый мини-профиль по дате рождения. Без точного времени он будет чуть проще, но всё равно сможет показать общий ритм и пару мягких подсказок.`);
    return ctx.reply(`Введи город рождения.

Например: Москва`, { reply_markup: { remove_keyboard: true } });
  }

  return ctx.reply('Ответь, пожалуйста, одним из вариантов: «Да, знаю время» или «Не знаю время».', timeKnowledgeKeyboard());
}

async function handleBirthTime(ctx, data) {
  const parsed = parseBirthTime(ctx.message.text);
  if (!parsed.ok) return ctx.reply(parsed.error);

  setState(ctx.from.id, STATES.AWAIT_CITY, {
    ...data,
    birth_time: parsed.value,
    birth_time_unknown: false
  });

  return ctx.reply(`Введи город рождения.

Например: Москва`);
}

async function handleBirthCity(ctx, data) {
  const city = String(ctx.message.text || '').trim();
  if (city.length < 2 || /^\d+$/.test(city)) {
    return ctx.reply('Введи город рождения текстом, пожалуйста. Например: Москва');
  }

  const [year, month, day] = data.birth_date.split('-').map(Number);
  const profile = saveProfile(ctx.from.id, {
    birth_date: data.birth_date,
    birth_time: data.birth_time || null,
    birth_time_unknown: Boolean(data.birth_time_unknown),
    birth_city: city,
    zodiac: getZodiacFromIso(data.birth_date),
    is_cusp: isCuspDate(month, day)
  });

  clearState(ctx.from.id);

  await ctx.reply(generateMiniProfile(profile));
  await ctx.reply(miniProfileUpsellText(), productKeyboard(PRODUCTS.astro_full.id));
  return ctx.reply(MAIN_MENU, mainMenuKeyboard());
}

async function openProfile(ctx) {
  const profile = getProfile(ctx.from.id);
  if (!profile) return startProfileFlow(ctx);

  setState(ctx.from.id, STATES.AWAIT_PROFILE_ACTION, {});
  const purchases = listPurchases(ctx.from.id);
  const purchaseBlock = purchases.length
    ? `\n\nОткрытые покупки:\n${purchases.map((item) => `— ${getProduct(item.product_id)?.title || item.product_id}`).join('\n')}`
    : '';

  return ctx.reply(`${generateSavedProfile(profile)}${purchaseBlock}`, profileActionsKeyboard());
}

async function handleProfileAction(ctx, normalized) {
  if (normalized === '1' || normalized.includes('исправ') || normalized.includes('измен')) {
    setState(ctx.from.id, STATES.AWAIT_EDIT_CHOICE, {});
    return ctx.reply(`Что хочешь исправить?

1. Дату рождения
2. Время рождения
3. Город рождения`, editProfileKeyboard());
  }

  if (normalized === '2' || normalized.includes('заново') || normalized.includes('пройти')) {
    return startProfileFlow(ctx);
  }

  if (normalized === '3' || normalized.includes('удал') || normalized.includes('сброс') || normalized.includes('очист')) {
    deleteProfile(ctx.from.id);
    clearState(ctx.from.id);
    await ctx.reply(`Готово 🌙

Я больше не буду использовать эти данные.

Если захочешь собрать профиль заново, нажми /start или выбери «Мой мини-профиль». Всё можно начать спокойно с начала.`);
    return ctx.reply(MAIN_MENU, mainMenuKeyboard());
  }

  if (normalized === '4' || normalized.includes('меню') || normalized.includes('вернуться')) {
    clearState(ctx.from.id);
    return ctx.reply(MAIN_MENU, mainMenuKeyboard());
  }

  return ctx.reply('Выбери, пожалуйста, действие: 1, 2, 3 или 4.', profileActionsKeyboard());
}

async function handleEditChoice(ctx, normalized) {
  if (normalized === '1' || normalized.includes('дат')) {
    setState(ctx.from.id, STATES.AWAIT_EDIT_BIRTH_DATE, {});
    return ctx.reply('Введи новую дату рождения в формате ДД.ММ.ГГГГ.', { reply_markup: { remove_keyboard: true } });
  }

  if (normalized === '2' || normalized.includes('врем')) {
    setState(ctx.from.id, STATES.AWAIT_EDIT_TIME_KNOWLEDGE, {});
    return ctx.reply('Знаешь точное время рождения?', timeKnowledgeKeyboard());
  }

  if (normalized === '3' || normalized.includes('город')) {
    setState(ctx.from.id, STATES.AWAIT_EDIT_CITY, {});
    return ctx.reply('Введи новый город рождения.', { reply_markup: { remove_keyboard: true } });
  }

  if (normalized.includes('меню')) {
    clearState(ctx.from.id);
    return ctx.reply(MAIN_MENU, mainMenuKeyboard());
  }

  return ctx.reply('Выбери, пожалуйста, что исправить: 1, 2 или 3.', editProfileKeyboard());
}

async function handleEditBirthDate(ctx) {
  const profile = getProfile(ctx.from.id);
  if (!profile) return startProfileFlow(ctx);

  const parsed = parseBirthDate(ctx.message.text);
  if (!parsed.ok) return ctx.reply(parsed.error);

  const [, month, day] = parsed.value.iso.split('-').map(Number);
  const updated = saveProfile(ctx.from.id, {
    ...profile,
    birth_date: parsed.value.iso,
    zodiac: getZodiacFromIso(parsed.value.iso),
    is_cusp: isCuspDate(month, day)
  });

  clearState(ctx.from.id);
  await ctx.reply('Готово, обновила дату 🌙');
  return openProfile(ctxWithFrom(ctx, updated));
}

async function handleEditTimeKnowledge(ctx, normalized) {
  const profile = getProfile(ctx.from.id);
  if (!profile) return startProfileFlow(ctx);

  if (isYes(normalized)) {
    setState(ctx.from.id, STATES.AWAIT_EDIT_BIRTH_TIME, {});
    return ctx.reply('Введи новое время рождения в формате ЧЧ:ММ.', { reply_markup: { remove_keyboard: true } });
  }

  if (isNo(normalized)) {
    saveProfile(ctx.from.id, {
      ...profile,
      birth_time: null,
      birth_time_unknown: true
    });

    clearState(ctx.from.id);
    await ctx.reply('Готово, отметила время как «не указано» 🌙');
    return openProfile(ctx);
  }

  return ctx.reply('Ответь, пожалуйста, одним из вариантов: «Да, знаю время» или «Не знаю время».', timeKnowledgeKeyboard());
}

async function handleEditBirthTime(ctx) {
  const profile = getProfile(ctx.from.id);
  if (!profile) return startProfileFlow(ctx);

  const parsed = parseBirthTime(ctx.message.text);
  if (!parsed.ok) return ctx.reply(parsed.error);

  saveProfile(ctx.from.id, {
    ...profile,
    birth_time: parsed.value,
    birth_time_unknown: false
  });

  clearState(ctx.from.id);
  await ctx.reply('Готово, обновила время 🌙');
  return openProfile(ctx);
}

async function handleEditCity(ctx) {
  const profile = getProfile(ctx.from.id);
  if (!profile) return startProfileFlow(ctx);

  const city = String(ctx.message.text || '').trim();
  if (city.length < 2 || /^\d+$/.test(city)) {
    return ctx.reply('Введи город рождения текстом, пожалуйста. Например: Москва');
  }

  saveProfile(ctx.from.id, {
    ...profile,
    birth_city: city
  });

  clearState(ctx.from.id);
  await ctx.reply('Готово, обновила город 🌙');
  return openProfile(ctx);
}

async function startCompatibilityFlow(ctx) {
  setState(ctx.from.id, STATES.COMPAT_AWAIT_FIRST_DATE, {});
  return ctx.reply(`❤️ Давай посмотрим совместимость спокойно и без драматичных прогнозов.

Введи дату рождения первого человека в формате ДД.ММ.ГГГГ.

Например: 14.08.1997`, { reply_markup: { remove_keyboard: true } });
}

async function handleCompatibilityFirstDate(ctx) {
  const parsed = parseBirthDate(ctx.message.text);
  if (!parsed.ok) return ctx.reply(parsed.error);

  setState(ctx.from.id, STATES.COMPAT_AWAIT_SECOND_DATE, {
    first_birth_date: parsed.value.iso,
    first_sign: getZodiacFromIso(parsed.value.iso)
  });

  return ctx.reply(`Теперь введи дату рождения второго человека в формате ДД.ММ.ГГГГ.

Например: 03.02.1995`);
}

async function handleCompatibilitySecondDate(ctx, data) {
  const parsed = parseBirthDate(ctx.message.text);
  if (!parsed.ok) return ctx.reply(parsed.error);

  const secondSign = getZodiacFromIso(parsed.value.iso);
  saveCompatibilityDraft(ctx.from.id, {
    first_birth_date: data.first_birth_date,
    second_birth_date: parsed.value.iso,
    first_sign: data.first_sign,
    second_sign: secondSign
  });

  clearState(ctx.from.id);

  await ctx.reply(generateMiniCompatibility(data.first_sign, secondSign));
  await ctx.reply(`Если хочется посмотреть на пару чуть глубже, можно открыть полный разбор совместимости 🌙

В мини-разборе я показала только общий ритм пары. Полная совместимость мягче раскрывает, как вы сближаетесь, где можете не слышать друг друга и что помогает отношениям становиться спокойнее.

⭐ Полная совместимость — ${PRODUCTS.compatibility_full.stars} Stars`, productKeyboard(PRODUCTS.compatibility_full.id));
  return ctx.reply(MAIN_MENU, mainMenuKeyboard());
}

async function openMeditation(ctx) {
  await ctx.reply(meditationOfDayText());
  await ctx.reply(personalMeditationSaleText(), productKeyboard(PRODUCTS.meditation_personal.id));
  return ctx.reply(MAIN_MENU, mainMenuKeyboard());
}

async function openFullAstro(ctx) {
  if (hasPurchase(ctx.from.id, PRODUCTS.astro_full.id)) {
    return deliverProduct(ctx, PRODUCTS.astro_full.id);
  }

  await ctx.reply(fullAstroSaleText(), productKeyboard(PRODUCTS.astro_full.id));
  return ctx.reply(MAIN_MENU, mainMenuKeyboard());
}

async function openFullCompatibility(ctx) {
  if (hasPurchase(ctx.from.id, PRODUCTS.compatibility_full.id)) {
    return deliverProduct(ctx, PRODUCTS.compatibility_full.id);
  }

  await ctx.reply(fullCompatibilitySaleText(), productKeyboard(PRODUCTS.compatibility_full.id));
  return ctx.reply(MAIN_MENU, mainMenuKeyboard());
}

async function openPersonalMeditation(ctx) {
  if (hasPurchase(ctx.from.id, PRODUCTS.meditation_personal.id)) {
    return deliverProduct(ctx, PRODUCTS.meditation_personal.id);
  }

  await ctx.reply(personalMeditationSaleText(), productKeyboard(PRODUCTS.meditation_personal.id));
  return ctx.reply(MAIN_MENU, mainMenuKeyboard());
}

async function buyProduct(ctx, productId) {
  const product = getProduct(productId);
  if (!product) return ctx.reply('Не нашла такой раздел. Давай вернёмся в меню 🌙', mainMenuKeyboard());

  if (hasPurchase(ctx.from.id, productId)) {
    await ctx.reply('Этот раздел уже открыт для тебя 🌙');
    return deliverProduct(ctx, productId);
  }

  if (requiresProfile(productId) && !getProfile(ctx.from.id)) {
    await ctx.reply('Чтобы открыть этот раздел, сначала соберём твой мини-профиль 🌙');
    return startProfileFlow(ctx);
  }

  if (productId === PRODUCTS.compatibility_full.id && !getCompatibilityDraft(ctx.from.id)) {
    await ctx.reply('Для полной совместимости сначала нужны две даты рождения. Начнём с короткой анкеты ❤️');
    return startCompatibilityFlow(ctx);
  }

  return ctx.reply(paymentConsentText(), paymentConsentKeyboard(productId));
}

async function confirmProductPayment(ctx, productId) {
  const product = getProduct(productId);
  if (!product) return ctx.reply('Не нашла такой раздел. Давай вернёмся в меню 🌙', mainMenuKeyboard());

  if (hasPurchase(ctx.from.id, productId)) {
    await ctx.reply('Этот раздел уже открыт для тебя 🌙');
    return deliverProduct(ctx, productId);
  }

  if (requiresProfile(productId) && !getProfile(ctx.from.id)) {
    await ctx.reply('Чтобы открыть этот раздел, сначала соберём твой мини-профиль 🌙');
    return startProfileFlow(ctx);
  }

  if (productId === PRODUCTS.compatibility_full.id && !getCompatibilityDraft(ctx.from.id)) {
    await ctx.reply('Для полной совместимости сначала нужны две даты рождения. Начнём с короткой анкеты ❤️');
    return startCompatibilityFlow(ctx);
  }

  recordUserConsent(ctx.from.id, TERMS_VERSION, PRIVACY_VERSION);

  return ctx.telegram.callApi('sendInvoice', buildStarsInvoice({
    chatId: ctx.chat.id,
    product,
    telegramId: ctx.from.id
  }));
}

async function handleSuccessfulPayment(ctx) {
  const payment = ctx.message.successful_payment;
  const payload = parsePaymentPayload(payment.invoice_payload);
  const product = getProduct(payload?.p);

  if (!product) {
    await ctx.reply('Платёж прошёл, но я не смогла определить, какой раздел открыть. Напиши, пожалуйста, в /paysupport — спокойно разберёмся.');
    return;
  }

  if (payment.currency !== 'XTR' || payment.total_amount !== product.stars) {
    await ctx.reply('Платёж получен, но сумма выглядит необычно. Напиши, пожалуйста, в /paysupport — я помогу проверить покупку.');
    return;
  }

  recordPurchase(ctx.from.id, payment, product.id);
  await ctx.reply(paymentSuccessText(product));
  await deliverProduct(ctx, product.id);
  return ctx.reply(MAIN_MENU, mainMenuKeyboard());
}

async function deliverProduct(ctx, productId) {
  if (productId === PRODUCTS.astro_full.id) {
    const profile = getProfile(ctx.from.id);
    if (!profile) return startProfileFlow(ctx);
    return replyMessages(ctx, buildFullAstroPortrait(profile));
  }

  if (productId === PRODUCTS.compatibility_full.id) {
    const draft = getCompatibilityDraft(ctx.from.id);
    if (!draft) {
      await ctx.reply('Для полной совместимости сначала нужны две даты рождения. Давай введём их заново — так я смогу открыть не пустой шаблон, а материал именно для вашей пары ❤️');
      return startCompatibilityFlow(ctx);
    }
    return replyMessages(ctx, buildFullCompatibilityReport(draft));
  }

  if (productId === PRODUCTS.meditation_personal.id) {
    const profile = getProfile(ctx.from.id);
    if (!profile) return startProfileFlow(ctx);
    return replyMessages(ctx, buildPersonalMeditation(profile));
  }

  return ctx.reply('Не нашла этот раздел. Напиши /help — вернёмся в меню 🌙');
}

async function replyMessages(ctx, messages) {
  for (const message of messages) {
    await ctx.reply(message);
  }
}

function showHelp(ctx) {
  clearState(ctx.from.id);
  return ctx.reply(helpText(), mainMenuKeyboard());
}

function requiresProfile(productId) {
  return productId === PRODUCTS.astro_full.id || productId === PRODUCTS.meditation_personal.id;
}

function miniProfileUpsellText() {
  return `Если мини-профиль откликнулся, можно открыть полный астропортрет 🌌

Сейчас я показала только первый слой — общий ритм по дате рождения.

В полном астропортрете можно посмотреть чуть подробнее: как ты чувствуешь, любишь, устаёшь, восстанавливаешься и где иногда теряешь контакт с собой.

Внутри полного астропортрета:
— эмоциональный профиль
— любовь и близость
— сильные стороны
— реализация и деньги
— где может копиться напряжение
— привычные реакции, которые забирают силы
— мягкая практика на ближайшие дни

⭐ Полный астропортрет — ${PRODUCTS.astro_full.stars} Stars`;
}

function isStartText(text) {
  return text === '/start' || ['старт', 'начать', 'запуск'].includes(text);
}

function isProfileText(text) {
  return text === '1' || text.includes('мини-профиль') || text.includes('мой профиль') || text.includes('профиль');
}

function isCompatibilityText(text) {
  return text === '2' || text.includes('совместимость');
}

function isMeditationText(text) {
  return text === '3' || text.includes('медитац') || text.includes('практик');
}

function isFullAstroText(text) {
  return text === '4' || text.includes('полный астропортрет') || text.includes('полный разбор') || text.includes('хочу полный') || text.includes('открыть полный');
}

function isFullCompatibilityText(text) {
  return text.includes('полная совместимость') || text.includes('полный разбор совместимости');
}

function isPersonalMeditationText(text) {
  return text.includes('персональная медитация') || text.includes('медитация под меня') || text.includes('хочу медитацию');
}

function isPaymentText(text) {
  return text === '5' || text.includes('оплат') || text.includes('поддерж') || text.includes('paysupport');
}

function isHelpText(text) {
  return text === '/help' || text.includes('помощ');
}

function isYes(text) {
  return text === '1' || ['да', 'знаю', 'да знаю', 'да, знаю время', 'да знаю время'].includes(text) || text.includes('знаю время');
}

function isNo(text) {
  return text === '2' || ['нет', 'не знаю', 'не знаю время', 'нет не знаю'].includes(text) || text.includes('не знаю');
}

function ctxWithFrom(ctx) {
  return ctx;
}
