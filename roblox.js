// roblox.js

const crypto = require('crypto');
const { db } = require('./db');
const { safeCompare, sanitizeText } = require('./security');

const CODE_TTL_MS = 10 * 60 * 1000;

const WORD_BANK = [
  'sun', 'ocean', 'chair', 'pencil', 'chimney', 'river', 'garden', 'window',
  'candle', 'forest', 'anchor', 'ladder', 'pillow', 'rocket', 'basket', 'bridge',
  'cactus', 'dragon', 'ember', 'falcon', 'glacier', 'harbor', 'island', 'jungle',
  'kettle', 'lantern', 'meadow', 'nickel', 'orbit', 'pepper', 'quartz', 'ribbon',
  'saddle', 'temple', 'umbrella', 'velvet', 'walnut', 'yonder', 'zephyr', 'amber',
  'boulder', 'canyon', 'desert', 'eagle', 'feather', 'granite', 'hollow', 'ivory',
  'jasper', 'kernel', 'lighthouse', 'marble', 'nectar', 'oasis', 'prairie', 'quiver',
  'ranger', 'summit', 'thunder', 'urchin', 'valley', 'willow', 'copper', 'maple',
  'coral', 'dune', 'ember', 'frost', 'grove', 'hazel', 'indigo', 'juniper',
  'knight', 'lotus', 'moss', 'north', 'onyx', 'plume', 'quill', 'reed'
];

function generateCode() {
  const chosen = [];
  const pool = [...WORD_BANK];
  for (let i = 0; i < 5; i++) {
    const idx = crypto.randomInt(0, pool.length);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return `Flash-Ino | ${chosen.join(' ')}`;
}

const GAME_SERVER_SECRET = process.env.ROBLOX_GAME_SERVER_SECRET;
if (!GAME_SERVER_SECRET) {
  console.warn('[roblox] ROBLOX_GAME_SERVER_SECRET is not set — /api/roblox/link/complete will reject all requests.');
}

const ROBLOX_PLACE_ID = process.env.ROBLOX_PLACE_ID;

async function lookupRobloxUserId(username) {
  const resp = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
  });
  if (!resp.ok) {
    const err = new Error('Roblox lookup failed. Try again in a moment.');
    err.status = 502;
    throw err;
  }
  const data = await resp.json();
  const match = data.data && data.data[0];
  if (!match) {
    const err = new Error('No Roblox account found with that username.');
    err.status = 404;
    throw err;
  }
  return { userId: match.id, username: match.name };
}

async function startLink(websiteUserId, robloxUsername) {
  const cleaned = sanitizeText(robloxUsername, 20);
  if (!cleaned || !/^[A-Za-z0-9_]{3,20}$/.test(cleaned)) {
    const err = new Error('Invalid Roblox username.');
    err.status = 400;
    throw err;
  }
  const { userId: robloxUserId, username: resolvedUsername } = await lookupRobloxUserId(cleaned);

  db.prepare(`DELETE FROM roblox_links WHERE user_id = ? AND status = 'pending'`).run(websiteUserId);

  const code = generateCode();
  const expiresAt = Date.now() + CODE_TTL_MS;
  db.prepare(
    `INSERT INTO roblox_links (user_id, code, roblox_username, roblox_user_id, status, expires_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`
  ).run(websiteUserId, code, resolvedUsername, robloxUserId, expiresAt);

  const joinUrl = ROBLOX_PLACE_ID
    ? `https://www.roblox.com/games/${ROBLOX_PLACE_ID}?linkCode=${encodeURIComponent(code)}`
    : `https://www.roblox.com/games/`;

  return { code, joinUrl, robloxUsername: resolvedUsername };
}

function getStatus(websiteUserId) {
  const row = db
    .prepare(`SELECT * FROM roblox_links WHERE user_id = ? ORDER BY id DESC LIMIT 1`)
    .get(websiteUserId);
  if (!row) return { status: 'none' };

  if (row.status === 'pending' && Date.now() > row.expires_at) {
    db.prepare(`UPDATE roblox_links SET status = 'expired' WHERE id = ?`).run(row.id);
    return { status: 'expired' };
  }
  return { status: row.status, robloxUsername: row.roblox_username };
}

function completeLink({ secret, code, robloxUserId }) {
  if (!GAME_SERVER_SECRET || typeof secret !== 'string' || !safeCompare(secret, GAME_SERVER_SECRET)) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  if (typeof code !== 'string' || code.length > 120) {
    const err = new Error('Unknown code');
    err.status = 404;
    throw err;
  }
  const robloxId = Number(robloxUserId);
  if (!Number.isInteger(robloxId) || robloxId <= 0) {
    const err = new Error('Invalid Roblox user id');
    err.status = 400;
    throw err;
  }
  const row = db.prepare(`SELECT * FROM roblox_links WHERE code = ?`).get(code);
  if (!row) {
    const err = new Error('Unknown code');
    err.status = 404;
    throw err;
  }
  if (row.status !== 'pending') {
    const err = new Error(`Code already ${row.status}`);
    err.status = 409;
    throw err;
  }
  if (Date.now() > row.expires_at) {
    db.prepare(`UPDATE roblox_links SET status = 'expired' WHERE id = ?`).run(row.id);
    const err = new Error('Code expired');
    err.status = 410;
    throw err;
  }
  if (robloxId !== Number(row.roblox_user_id)) {

    const err = new Error('UserId mismatch');
    err.status = 409;
    throw err;
  }

  db.prepare(`UPDATE roblox_links SET status = 'verified', verified_at = datetime('now') WHERE id = ?`).run(row.id);
  db.prepare(`UPDATE users SET roblox_user_id = ?, roblox_username = ? WHERE id = ?`).run(
    row.roblox_user_id,
    row.roblox_username,
    row.user_id
  );
  return { ok: true, websiteUserId: row.user_id };
}

module.exports = { startLink, getStatus, completeLink };
