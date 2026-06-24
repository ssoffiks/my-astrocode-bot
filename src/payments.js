import { PRIVACY_VERSION, TERMS_VERSION } from './texts.js';

export function buildPaymentPayload(productId, telegramId, timestamp = Date.now()) {
  return JSON.stringify({
    p: productId,
    u: telegramId,
    t: timestamp,
    terms: TERMS_VERSION,
    privacy: PRIVACY_VERSION
  });
}

export function buildStarsInvoice({ chatId, product, telegramId, timestamp = Date.now() }) {
  return {
    chat_id: chatId,
    title: product.title,
    description: product.description,
    payload: buildPaymentPayload(product.id, telegramId, timestamp),
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: `${product.stars} Stars`, amount: product.stars }],
    start_parameter: `pay_${product.id}`
  };
}

export function parsePaymentPayload(payload) {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
