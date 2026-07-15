// security.js

const crypto = require('crypto');

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    const prev = { ...req.session };
    req.session.regenerate((err) => {
      if (err) return reject(err);
      Object.assign(req.session, prev);
      resolve();
    });
  });
}

function rateLimit({ windowMs = 60_000, max = 60, keyPrefix = '' } = {}) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of hits) {
      if (now - bucket.start >= windowMs) hits.delete(key);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = keyPrefix + ':' + ip;
    const now = Date.now();
    let bucket = hits.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      hits.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.start + windowMs - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  };
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  next();
}

function sanitizeText(input, maxLen) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

const VALID_GAMES = new Set([
  'coinflip',
  'roulette',
  'upgrader',
  'casebattles',
  'mines',
  'crash',
  'blackjack',
]);

module.exports = {
  safeCompare,
  regenerateSession,
  rateLimit,
  securityHeaders,
  sanitizeText,
  VALID_GAMES,
};
