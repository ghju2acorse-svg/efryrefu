// wallet.js

const { db, addXp } = require('./db');

const GAME_MIN_BETS = {
  mines: 0.01,
  upgrader: 0.05,
  coinflip: 0.05,
  roulette: 0.05,
  crash: 0.10,
  casebattles: 0.10,
  blackjack: 0.10,
};

class InsufficientFundsError extends Error {
  constructor() {
    super('Insufficient balance');
    this.status = 400;
  }
}
class InvalidBetError extends Error {
  constructor(msg) {
    super(msg || 'Invalid bet');
    this.status = 400;
  }
}

function getUserById(id) {
  return db
    .prepare('SELECT id, username, demo_balance, xp, level, roblox_user_id, roblox_username FROM users WHERE id = ?')
    .get(id);
}

function validateBet(bet, balance, game) {
  if (typeof bet !== 'number' || !Number.isFinite(bet) || bet <= 0) {
    throw new InvalidBetError('Bet must be a positive number');
  }
  const minBet = game && GAME_MIN_BETS[game] != null ? GAME_MIN_BETS[game] : 0.01;
  if (bet < minBet) {
    throw new InvalidBetError(`Minimum bet is ${minBet.toFixed(2)} SAB`);
  }
  if (bet > 1_000_000) throw new InvalidBetError('Bet is too large');
  if (bet > balance) throw new InsufficientFundsError();
}

const deductBet = db.transaction((userId, bet, game) => {
  const user = db.prepare('SELECT demo_balance FROM users WHERE id = ?').get(userId);
  if (!user) throw new InvalidBetError('User not found');
  validateBet(bet, user.demo_balance, game);
  db.prepare('UPDATE users SET demo_balance = demo_balance - ? WHERE id = ?').run(bet, userId);
});

const settleRound = db.transaction((userId, game, bet, payout, detail, deductNow) => {
  const user = db.prepare('SELECT demo_balance FROM users WHERE id = ?').get(userId);
  if (!user) throw new InvalidBetError('User not found');

  if (deductNow) {
    validateBet(bet, user.demo_balance, game);
    db.prepare('UPDATE users SET demo_balance = demo_balance - ? WHERE id = ?').run(bet, userId);
  }
  if (payout > 0) {
    db.prepare('UPDATE users SET demo_balance = demo_balance + ? WHERE id = ?').run(payout, userId);
  }

  db.prepare(
    `INSERT INTO game_rounds (user_id, game, bet, payout, net, detail_json) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, game, bet, payout, payout - bet, JSON.stringify(detail || {}));

  const xpResult = addXp(userId, bet);
  const balance = db.prepare('SELECT demo_balance FROM users WHERE id = ?').get(userId).demo_balance;
  return { balance, ...xpResult };
});

module.exports = {
  getUserById,
  validateBet,
  deductBet,
  settleRound,
  GAME_MIN_BETS,
  InsufficientFundsError,
  InvalidBetError,
};
