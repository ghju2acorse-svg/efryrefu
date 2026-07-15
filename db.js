// db.js

const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'flashino.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    demo_balance  REAL NOT NULL DEFAULT 1000,
    xp            INTEGER NOT NULL DEFAULT 0,
    level         INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS game_rounds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    game        TEXT NOT NULL,
    bet         REAL NOT NULL,
    payout      REAL NOT NULL,
    net         REAL NOT NULL,
    detail_json TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    username   TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mines_sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) UNIQUE,
    bet          REAL NOT NULL,
    mine_count   INTEGER NOT NULL,
    mine_indices TEXT NOT NULL,
    revealed     TEXT NOT NULL DEFAULT '[]',
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crash_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) UNIQUE,
    bet         REAL NOT NULL,
    crash_point REAL NOT NULL,
    started_at  INTEGER NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS blackjack_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) UNIQUE,
    bet         REAL NOT NULL,
    deck        TEXT NOT NULL,
    player_hand TEXT NOT NULL,
    dealer_hand TEXT NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1
  );

  -- Roblox account-linking codes. This table only ever proves "this
  -- website account and this Roblox UserId are controlled by the same
  -- person" — no Robux, items, or currency of any kind flow through
  -- it, and this codebase never reads roblox_user_id anywhere except
  -- to display it. One row per attempt; old/expired rows are cheap to
  -- keep around for audit purposes but can be pruned periodically.
  CREATE TABLE IF NOT EXISTS roblox_links (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    code             TEXT UNIQUE NOT NULL,
    roblox_username  TEXT NOT NULL,
    roblox_user_id   INTEGER NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending', -- pending | verified | expired
    expires_at       INTEGER NOT NULL,
    verified_at      TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_roblox_links_user ON roblox_links(user_id);
`);

try {
  db.exec('ALTER TABLE users ADD COLUMN roblox_user_id INTEGER');
} catch (e) {
  if (!/duplicate column/i.test(e.message)) throw e;
}
try {
  db.exec('ALTER TABLE chat_messages ADD COLUMN roblox_username TEXT');
} catch (e) {
  if (!/duplicate column/i.test(e.message)) throw e;
}

try {
  db.exec('ALTER TABLE users ADD COLUMN roblox_username TEXT');
} catch (e) {
  if (!/duplicate column/i.test(e.message)) throw e;
}

try {
  db.exec('ALTER TABLE users ADD COLUMN last_bonus_date TEXT');
} catch (e) {
  if (!/duplicate column/i.test(e.message)) throw e;
}

const XP_PER_UNIT_WAGERED = 2;
function levelForXp(xp) {

  let level = 1;
  while (xp >= level * 150) level++;
  return level;
}

function addXp(userId, bet) {
  const gained = Math.max(1, Math.round(bet * XP_PER_UNIT_WAGERED));
  const user = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId);
  const newXp = user.xp + gained;
  const newLevel = levelForXp(newXp);
  db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXp, newLevel, userId);
  return { xp: newXp, level: newLevel, gained };
}

const DAILY_RAKEBACK = 0.03;

function grantLoginBonus(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const user = db.prepare('SELECT last_bonus_date FROM users WHERE id = ?').get(userId);
  if (user && user.last_bonus_date === today) {
    return { granted: 0, balance: null };
  }
  db.prepare('UPDATE users SET demo_balance = demo_balance + ?, last_bonus_date = ? WHERE id = ?').run(
    DAILY_RAKEBACK,
    today,
    userId
  );
  const updated = db.prepare('SELECT demo_balance FROM users WHERE id = ?').get(userId);
  return { granted: DAILY_RAKEBACK, balance: updated.demo_balance };
}

module.exports = { db, addXp, levelForXp, grantLoginBonus };
