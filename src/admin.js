import {
  getAdminStats,
  getRecentPurchases,
  getUserAdminInfo
} from './db.js';
import { PRODUCTS, getProduct } from './products.js';

const ADMIN_DENIED_TEXT = 'Эта команда доступна только администратору 🌙';

const PRODUCT_LABELS = {
  astro_full: '🌌 Полный астропортрет',
  compatibility_full: '❤️ Полная совместимость',
  meditation_personal: '🧘 Персональная медитация'
};

export function registerAdminCommands(bot, config) {
  bot.command('myid', (ctx) => handleMyId(ctx));
  bot.command('admin', (ctx) => handleAdmin(ctx, config));
  bot.command('admin_help', (ctx) => handleAdminHelp(ctx, config));
  bot.command('admin_stats', (ctx) => handleAdminStats(ctx, config));
  bot.command('admin_recent', (ctx) => handleAdminRecent(ctx, config));
  bot.command('admin_user', (ctx) => handleAdminUser(ctx, config));
}

export function parseAdminIds(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id))
  );
}

export function isAdmin(ctx, adminIds = '') {
  const telegramId = ctx?.from?.id;
  if (!telegramId) return false;
  return parseAdminIds(adminIds).has(String(telegramId));
}

export function myIdText(telegramId) {
  return `Твой Telegram ID: ${telegramId}

Этот ID можно использовать для настройки доступа к админке.`;
}

export function adminMenuText() {
  return `🛠 Админка “Мой Астрокод”

Доступные команды:
— /admin_stats — общая статистика
— /admin_recent — последние покупки
— /admin_user <telegram_id> — профиль и покупки пользователя
— /admin_help — помощь по админке`;
}

export function adminHelpText() {
  return `🛠 Помощь по админке

— /admin — меню админки
— /admin_stats — общая статистика по пользователям и покупкам
— /admin_recent — последние 10 покупок
— /admin_recent 20 — последние 20 покупок, максимум 50
— /admin_user 123456789 — профиль и покупки пользователя

Рассылки здесь пока нет: это отдельный опасный функционал, его лучше добавлять позже с предпросмотром и подтверждением.`;
}

export async function handleMyId(ctx) {
  return ctx.reply(myIdText(ctx.from.id));
}

export async function handleAdmin(ctx, config) {
  if (!isAdmin(ctx, config?.adminIds)) return ctx.reply(ADMIN_DENIED_TEXT);
  return ctx.reply(adminMenuText());
}

export async function handleAdminHelp(ctx, config) {
  if (!isAdmin(ctx, config?.adminIds)) return ctx.reply(ADMIN_DENIED_TEXT);
  return ctx.reply(adminHelpText());
}

export async function handleAdminStats(ctx, config) {
  if (!isAdmin(ctx, config?.adminIds)) return ctx.reply(ADMIN_DENIED_TEXT);
  return ctx.reply(adminStatsText(getAdminStats()));
}

export async function handleAdminRecent(ctx, config) {
  if (!isAdmin(ctx, config?.adminIds)) return ctx.reply(ADMIN_DENIED_TEXT);
  const limit = parseLimit(ctx.message?.text);
  return ctx.reply(adminRecentText(getRecentPurchases(limit)));
}

export async function handleAdminUser(ctx, config) {
  if (!isAdmin(ctx, config?.adminIds)) return ctx.reply(ADMIN_DENIED_TEXT);

  const userId = parseTelegramId(ctx.message?.text);
  if (!userId) return ctx.reply('Напиши так: /admin_user 123456789');

  return ctx.reply(adminUserText(getUserAdminInfo(userId)));
}

export function adminStatsText(stats) {
  const byProduct = new Map((stats.purchases.byProduct || []).map((row) => [row.product_id, row]));
  const productLines = Object.values(PRODUCTS)
    .map((product) => {
      const row = byProduct.get(product.id) || { purchases: 0, stars: 0 };
      return `— ${productLabel(product.id)}: ${Number(row.purchases || 0)} покупок / ${Number(row.stars || 0)} Stars`;
    })
    .join('\n');

  const dateBlock = stats.dateStats
    ? `

За период:
— покупок за сегодня: ${stats.dateStats.todayPurchases}
— покупок за последние 7 дней: ${stats.dateStats.last7DaysPurchases}
— Stars за последние 7 дней: ${stats.dateStats.last7DaysStars}`
    : '';

  return `📊 Статистика

Пользователи:
— всего: ${stats.users.total}
— с профилем: ${stats.users.withProfile}

Покупки:
— всего: ${stats.purchases.total}
— сумма: ${stats.purchases.stars} Stars

По продуктам:
${productLines}${dateBlock}`;
}

export function adminRecentText(purchases) {
  if (!purchases.length) {
    return `🧾 Последние покупки

Покупок пока нет.`;
  }

  const lines = purchases.map((purchase, index) => {
    const username = purchase.username ? `@${purchase.username}` : 'username не сохранён';
    const firstName = purchase.first_name ? ` · ${purchase.first_name}` : '';

    return `${index + 1}. ${formatAdminDate(purchase.created_at)}
${productLabel(purchase.product_id)} (${purchase.product_id}) — ${purchase.amount} Stars
user_id: ${purchase.user_id} · ${username}${firstName}
charge_id: ${maskChargeId(purchase.telegram_payment_charge_id)}`;
  });

  return `🧾 Последние покупки

${lines.join('\n\n')}`;
}

export function adminUserText(info) {
  if (!info) return 'Пользователь не найден в базе.';

  const { user, consent, consentAvailable, purchases } = info;
  const username = user.username ? `@${user.username}` : 'не сохранён';
  const firstName = user.first_name || 'не сохранено';
  const birthDate = user.birth_date_display || user.birth_date || 'не указана';
  const birthTime = user.birth_time_unknown || !user.birth_time ? 'не указано' : user.birth_time;
  const birthCity = user.birth_city || 'не указан';
  const zodiac = user.zodiac || 'не указан';
  const consentText = consentAvailable
    ? formatConsent(consent)
    : 'таблица согласий не найдена';

  const purchaseLines = purchases.length
    ? purchases.map((purchase) => `— ${productLabel(purchase.product_id)} (${purchase.product_id})
  дата: ${formatAdminDate(purchase.created_at)}
  сумма: ${purchase.amount} Stars
  charge_id: ${maskChargeId(purchase.telegram_payment_charge_id)}`).join('\n')
    : '— покупок нет';

  return `👤 Пользователь ${user.user_id}

Telegram:
— username: ${username}
— имя: ${firstName}

Профиль:
— дата рождения: ${birthDate}
— время рождения: ${birthTime}
— город рождения: ${birthCity}
— знак: ${zodiac}
— согласие terms/privacy: ${consentText}

Покупки:
${purchaseLines}`;
}

export function maskChargeId(chargeId) {
  if (!chargeId) return 'не указан';
  const value = String(chargeId);
  if (value.length <= 8) return 'есть';
  return `…${value.slice(-8)}`;
}

function parseLimit(text = '') {
  const [, rawLimit] = String(text).trim().split(/\s+/);
  const limit = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(limit)) return 10;
  return Math.min(Math.max(limit, 1), 50);
}

function parseTelegramId(text = '') {
  const [, rawUserId] = String(text).trim().split(/\s+/);
  if (!/^\d+$/.test(rawUserId || '')) return null;
  return Number(rawUserId);
}

function productLabel(productId) {
  return PRODUCT_LABELS[productId] || getProduct(productId)?.title || productId;
}

function formatAdminDate(value) {
  if (!value) return 'дата не указана';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function formatConsent(consent) {
  if (!consent) return 'нет';
  return `да (terms ${consent.terms_version}, privacy ${consent.privacy_version}, ${formatAdminDate(consent.accepted_at)})`;
}
