import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getAdminStats,
  initDb,
  recordPurchase,
  recordUserConsent,
  saveProfile,
  upsertUser
} from '../src/db.js';
import { PRODUCTS } from '../src/products.js';
import { PRIVACY_VERSION, TERMS_VERSION } from '../src/texts.js';
import {
  adminRecentText,
  adminStatsText,
  handleAdmin,
  handleAdminRecent,
  handleAdminStats,
  handleAdminUser,
  handleMyId,
  isAdmin,
  maskChargeId
} from '../src/admin.js';

const ADMIN_ID = 42;
const USER = {
  id: 1001,
  first_name: 'Луна',
  username: 'moon_user'
};

const SECOND_USER = {
  id: 1002,
  first_name: 'Солнце',
  username: null
};

const PROFILE = {
  birth_date: '1992-05-05',
  birth_time: null,
  birth_time_unknown: true,
  birth_city: 'Москва',
  zodiac: 'Телец',
  is_cusp: false
};

test('/myid returns telegram id and setup hint', async () => {
  const ctx = createCtx({ id: 123456789, text: '/myid' });

  await handleMyId(ctx);

  assert.match(ctx.replies[0].text, /Твой Telegram ID: 123456789/);
  assert.match(ctx.replies[0].text, /настройки доступа к админке/);
});

test('non-admin cannot access /admin', async () => {
  const ctx = createCtx({ id: 1001, text: '/admin' });

  await handleAdmin(ctx, { adminIds: String(ADMIN_ID) });

  assert.equal(ctx.replies[0].text, 'Эта команда доступна только администратору 🌙');
});

test('admin can access /admin and spaces around ADMIN_IDS are ignored', async () => {
  const ctx = createCtx({ id: ADMIN_ID, text: '/admin' });

  assert.equal(isAdmin(ctx, ` 123, ${ADMIN_ID} , 987 `), true);
  await handleAdmin(ctx, { adminIds: ` 123, ${ADMIN_ID} , 987 ` });

  assert.match(ctx.replies[0].text, /🛠 Админка “Мой Астрокод”/);
  assert.match(ctx.replies[0].text, /\/admin_stats/);
  assert.match(ctx.replies[0].text, /\/admin_recent/);
  assert.match(ctx.replies[0].text, /\/admin_user <telegram_id>/);
  assert.match(ctx.replies[0].text, /\/admin_help/);
});

test('/admin_stats works and formats users, purchases and Stars', async () => {
  initFilledTestDb();
  const ctx = createCtx({ id: ADMIN_ID, text: '/admin_stats' });

  await handleAdminStats(ctx, { adminIds: String(ADMIN_ID) });

  assert.match(ctx.replies[0].text, /📊 Статистика/);
  assert.match(ctx.replies[0].text, /— всего: 2/);
  assert.match(ctx.replies[0].text, /— с профилем: 1/);
  assert.match(ctx.replies[0].text, /— сумма: 148 Stars/);
  assert.match(ctx.replies[0].text, /🌌 Полный астропортрет: 1 покупок \/ 99 Stars/);
  assert.match(ctx.replies[0].text, /🧘 Персональная медитация: 1 покупок \/ 49 Stars/);
  assert.match(ctx.replies[0].text, /покупок за последние 7 дней/);
});

test('/admin_recent works with a custom limit and masks charge id', async () => {
  initFilledTestDb();
  const ctx = createCtx({ id: ADMIN_ID, text: '/admin_recent 20' });

  await handleAdminRecent(ctx, { adminIds: String(ADMIN_ID) });

  assert.match(ctx.replies[0].text, /🧾 Последние покупки/);
  assert.match(ctx.replies[0].text, /user_id: 1001/);
  assert.match(ctx.replies[0].text, /@moon_user/);
  assert.match(ctx.replies[0].text, /charge_id: …abcdef12/);
  assert.doesNotMatch(ctx.replies[0].text, /tg_charge_abcdef12/);
});

test('/admin_user without id shows hint', async () => {
  const ctx = createCtx({ id: ADMIN_ID, text: '/admin_user' });

  await handleAdminUser(ctx, { adminIds: String(ADMIN_ID) });

  assert.equal(ctx.replies[0].text, 'Напиши так: /admin_user 123456789');
});

test('/admin_user with id shows profile and purchases, or not found', async () => {
  initFilledTestDb();

  const existing = createCtx({ id: ADMIN_ID, text: '/admin_user 1001' });
  await handleAdminUser(existing, { adminIds: String(ADMIN_ID) });

  assert.match(existing.replies[0].text, /👤 Пользователь 1001/);
  assert.match(existing.replies[0].text, /@moon_user/);
  assert.match(existing.replies[0].text, /Луна/);
  assert.match(existing.replies[0].text, /05\.05\.1992/);
  assert.match(existing.replies[0].text, /время рождения: не указано/);
  assert.match(existing.replies[0].text, /город рождения: Москва/);
  assert.match(existing.replies[0].text, /знак: Телец/);
  assert.match(existing.replies[0].text, /согласие terms\/privacy: да/);
  assert.match(existing.replies[0].text, /🌌 Полный астропортрет/);
  assert.match(existing.replies[0].text, /charge_id: …abcdef12/);

  const missing = createCtx({ id: ADMIN_ID, text: '/admin_user 999999' });
  await handleAdminUser(missing, { adminIds: String(ADMIN_ID) });

  assert.equal(missing.replies[0].text, 'Пользователь не найден в базе.');
});

test('with empty ADMIN_IDS nobody is admin', async () => {
  const ctx = createCtx({ id: ADMIN_ID, text: '/admin' });

  assert.equal(isAdmin(ctx, ''), false);
  await handleAdmin(ctx, { adminIds: '' });

  assert.equal(ctx.replies[0].text, 'Эта команда доступна только администратору 🌙');
});

test('admin text helpers handle empty data safely', () => {
  const text = adminStatsText({
    users: { total: 0, withProfile: 0 },
    purchases: { total: 0, stars: 0, byProduct: [] },
    dateStats: null
  });

  assert.match(text, /🌌 Полный астропортрет: 0 покупок \/ 0 Stars/);
  assert.match(adminRecentText([]), /Покупок пока нет/);
  assert.equal(maskChargeId('short'), 'есть');
});

function initFilledTestDb() {
  initTestDb();
  upsertUser(USER);
  upsertUser(SECOND_USER);
  saveProfile(USER.id, PROFILE);
  recordUserConsent(USER.id, TERMS_VERSION, PRIVACY_VERSION);
  recordPurchase(USER.id, payment('astro_full', 'tg_charge_abcdef12'), PRODUCTS.astro_full.id);
  recordPurchase(USER.id, payment('meditation_personal', 'tg_charge_12345678'), PRODUCTS.meditation_personal.id);

  return getAdminStats();
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

function createCtx({ id, text }) {
  const replies = [];

  return {
    from: {
      id,
      first_name: 'Админ',
      username: 'admin_user'
    },
    message: { text },
    replies,
    reply: async (replyText, extra) => {
      replies.push({ text: replyText, extra });
      return { text: replyText, extra };
    }
  };
}

function initTestDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astrocode-admin-test-'));
  initDb(path.join(tmpDir, 'astrocode.sqlite'));
}
