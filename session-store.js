// session-store.js

const session = require('express-session');
const { db } = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid        TEXT PRIMARY KEY,
    sess       TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

class SqliteSessionStore extends session.Store {
  constructor() {
    super();

    this._cleanupTimer = setInterval(() => {
      try {
        db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
      } catch (e) {
        console.error('[session-store] cleanup failed:', e.message);
      }
    }, 15 * 60 * 1000);
    this._cleanupTimer.unref();
  }

  get(sid, cb) {
    try {
      const row = db.prepare('SELECT sess, expires_at FROM sessions WHERE sid = ?').get(sid);
      if (!row || row.expires_at < Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.sess));
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sessionData, cb) {
    try {
      const maxAge =
        sessionData.cookie && sessionData.cookie.maxAge ? sessionData.cookie.maxAge : DEFAULT_MAX_AGE_MS;
      const expiresAt = Date.now() + maxAge;
      db.prepare(
        `INSERT INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at`
      ).run(sid, JSON.stringify(sessionData), expiresAt);
      cb && cb(null);
    } catch (err) {
      cb && cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb && cb(null);
    } catch (err) {
      cb && cb(err);
    }
  }

  touch(sid, sessionData, cb) {
    this.set(sid, sessionData, cb);
  }
}

module.exports = SqliteSessionStore;
