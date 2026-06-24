import { hasPurchase, recordPurchase } from './db.js';
import { mainMenuKeyboard, productKeyboard } from './keyboards.js';
import { buildStarsInvoice, parsePaymentPayload } from './payments.js';
import { getProduct, PRODUCTS } from './products.js';
import { paymentSuccessText } from './paidContent.js';
import { MAIN_MENU } from './texts.js';

export async function replyProductOfferOrPurchased(ctx, productId, offerText, deliverProduct) {
  if (hasPurchase(ctx.from.id, productId)) {
    return openAlreadyPurchasedProduct(ctx, productId, deliverProduct);
  }

  return ctx.reply(offerText, productKeyboard(productId));
}

export async function openAlreadyPurchasedProduct(ctx, productId, deliverProduct, options = {}) {
  if (options.removePaymentButton) {
    await removeInlineKeyboard(ctx);
  }

  await ctx.reply(alreadyPurchasedText(productId));
  return deliverProduct(ctx, productId);
}

export async function handlePreCheckoutQuery(ctx) {
  const query = ctx.preCheckoutQuery;
  const payload = parsePaymentPayload(query.invoice_payload);
  const productId = payload?.p;

  if (productId && hasPurchase(query.from.id, productId)) {
    return ctx.telegram.answerPreCheckoutQuery(query.id, false, {
      error_message: 'Этот материал уже открыт для тебя 🌙 Повторная оплата не нужна.'
    });
  }

  return ctx.telegram.answerPreCheckoutQuery(query.id, true);
}

export async function sendProductInvoice(ctx, product) {
  return ctx.telegram.callApi('sendInvoice', buildStarsInvoice({
    chatId: ctx.chat.id,
    product,
    telegramId: ctx.from.id
  }));
}

export async function handleSuccessfulPayment(ctx, deliverProduct) {
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

  const isNewPurchase = recordPurchase(ctx.from.id, payment, product.id);
  if (isNewPurchase) {
    await ctx.reply(paymentSuccessText(product));
  } else {
    await ctx.reply(alreadyPurchasedText(product.id));
  }

  await deliverProduct(ctx, product.id);
  return ctx.reply(MAIN_MENU, mainMenuKeyboard());
}

export function alreadyPurchasedText(productId) {
  if (productId === PRODUCTS.meditation_personal.id) {
    return 'Ты уже покупала персональную медитацию 🌙\nОткрываю её для тебя ещё раз.';
  }

  if (productId === PRODUCTS.astro_full.id) {
    return 'Твой полный астропортрет уже открыт 🌌\nМожно вернуться к нему в любой момент.';
  }

  if (productId === PRODUCTS.compatibility_full.id) {
    return 'Полная совместимость уже открыта ❤️\nПоказываю материал ещё раз.';
  }

  return 'Этот материал уже открыт для тебя 🌙\nПовторная оплата не нужна.';
}

async function removeInlineKeyboard(ctx) {
  try {
    if (typeof ctx.editMessageReplyMarkup === 'function') {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    }
  } catch {
    // Старое сообщение могло быть уже недоступно для редактирования.
  }
}
