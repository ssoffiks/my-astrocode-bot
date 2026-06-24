import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { formatDateFromIso } from './utils/dates.js';

let db;

export function initDb(databasePath) {
  const resolvedPath = path.resolve(databasePath || './data/astrocode.sqlite');
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  db = new DatabaseSync(resolvedPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      first_name TEXT,
      username TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      telegram_id INTEGER PRIMARY KEY,
      birth_date TEXT NOT NULL,
      birth_time TEXT,
      birth_time_unknown INTEGER NOT NULL DEFAULT 0,
      birth_city TEXT NOT NULL,
      zodiac TEXT NOT NULL,
      is_cusp INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS states (
      telegram_id INTEGER PRIMARY KEY,
      state TEXT NOT NULL,
      data_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS compatibility_drafts (
      telegram_id INTEGER PRIMARY KEY,
      first_birth_date TEXT NOT NULL,
      second_birth_date TEXT NOT NULL,
      first_sign TEXT NOT NULL,
      second_sign TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      telegram_payment_charge_id TEXT NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_consents (
      telegram_id INTEGER NOT NULL,
      terms_version TEXT NOT NULL,
      privacy_version TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      PRIMARY KEY (telegram_id, terms_version, privacy_version),
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_purchases_user_product
      ON purchases(telegram_id, product_id);
  `);

  return db;
}

export function getDb() {
  if (!db) throw new Error('Database is not initialized. Call initDb() first.');
  return db;
}

export function upsertUser(user) {
  const now = nowIso();
  getDb().prepare(`
    INSERT INTO users (telegram_id, first_name, username, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      first_name = excluded.first_name,
      username = excluded.username,
      updated_at = excluded.updated_at
  `).run(user.id, user.first_name || null, user.username || null, now, now);
}

export function getProfile(telegramId) {
  const row = getDb().prepare('SELECT * FROM profiles WHERE telegram_id = ?').get(telegramId);
  return row ? decorateProfile(row) : null;
}

export function saveProfile(telegramId, profile) {
  const now = nowIso();
  getDb().prepare(`
    INSERT INTO profiles (
      telegram_id, birth_date, birth_time, birth_time_unknown, birth_city, zodiac, is_cusp, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      birth_date = excluded.birth_date,
      birth_time = excluded.birth_time,
      birth_time_unknown = excluded.birth_time_unknown,
      birth_city = excluded.birth_city,
      zodiac = excluded.zodiac,
      is_cusp = excluded.is_cusp,
      updated_at = excluded.updated_at
  `).run(
    telegramId,
    profile.birth_date,
    profile.birth_time || null,
    profile.birth_time_unknown ? 1 : 0,
    profile.birth_city,
    profile.zodiac,
    profile.is_cusp ? 1 : 0,
    now
  );

  return getProfile(telegramId);
}

export function deleteProfile(telegramId) {
  getDb().prepare('DELETE FROM profiles WHERE telegram_id = ?').run(telegramId);
}

export function setState(telegramId, state, data = {}) {
  const now = nowIso();
  getDb().prepare(`
    INSERT INTO states (telegram_id, state, data_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      state = excluded.state,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `).run(telegramId, state, JSON.stringify(data), now);
}

export function getState(telegramId) {
  const row = getDb().prepare('SELECT * FROM states WHERE telegram_id = ?').get(telegramId);
  if (!row) return null;

  return {
    state: row.state,
    data: safeJson(row.data_json)
  };
}

export function clearState(telegramId) {
  getDb().prepare('DELETE FROM states WHERE telegram_id = ?').run(telegramId);
}

export function saveCompatibilityDraft(telegramId, draft) {
  const now = nowIso();
  getDb().prepare(`
    INSERT INTO compatibility_drafts (
      telegram_id, first_birth_date, second_birth_date, first_sign, second_sign, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      first_birth_date = excluded.first_birth_date,
      second_birth_date = excluded.second_birth_date,
      first_sign = excluded.first_sign,
      second_sign = excluded.second_sign,
      updated_at = excluded.updated_at
  `).run(
    telegramId,
    draft.first_birth_date,
    draft.second_birth_date,
    draft.first_sign,
    draft.second_sign,
    now
  );
}

export function getCompatibilityDraft(telegramId) {
  return getDb().prepare('SELECT * FROM compatibility_drafts WHERE telegram_id = ?').get(telegramId) || null;
}

export function recordPurchase(telegramId, payment, productId) {
  const now = nowIso();
  getDb().prepare(`
    INSERT OR IGNORE INTO purchases (
      telegram_id, product_id, payload, telegram_payment_charge_id, amount, currency, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    telegramId,
    productId,
    payment.invoice_payload,
    payment.telegram_payment_charge_id,
    payment.total_amount,
    payment.currency,
    now
  );
}

export function hasPurchase(telegramId, productId) {
  const row = getDb().prepare(`
    SELECT 1 FROM purchases WHERE telegram_id = ? AND product_id = ? LIMIT 1
  `).get(telegramId, productId);
  return Boolean(row);
}

export function listPurchases(telegramId) {
  return getDb().prepare(`
    SELECT product_id, amount, currency, created_at
    FROM purchases
    WHERE telegram_id = ?
    ORDER BY created_at DESC
  `).all(telegramId);
}

export function recordUserConsent(telegramId, termsVersion, privacyVersion) {
  const now = nowIso();
  getDb().prepare(`
    INSERT INTO user_consents (telegram_id, terms_version, privacy_version, accepted_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(telegram_id, terms_version, privacy_version) DO UPDATE SET
      accepted_at = excluded.accepted_at
  `).run(telegramId, termsVersion, privacyVersion, now);

  return getUserConsent(telegramId, termsVersion, privacyVersion);
}

export function getUserConsent(telegramId, termsVersion, privacyVersion) {
  return getDb().prepare(`
    SELECT telegram_id, terms_version, privacy_version, accepted_at
    FROM user_consents
    WHERE telegram_id = ? AND terms_version = ? AND privacy_version = ?
  `).get(telegramId, termsVersion, privacyVersion) || null;
}

function decorateProfile(row) {
  return {
    ...row,
    birth_time_unknown: Boolean(row.birth_time_unknown),
    is_cusp: Boolean(row.is_cusp),
    birth_date_display: formatDateFromIso(row.birth_date)
  };
}

function safeJson(value) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

function nowIso() {
  return new Date().toISOString();
}
