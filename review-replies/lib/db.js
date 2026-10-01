// SQLite storage (Node's built-in node:sqlite, no extra install).

const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS businesses (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'warm',
  signoff TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL,
  body TEXT NOT NULL,
  reply TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_user ON reviews(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
`;

function open(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

const monthKey = (now = new Date()) => now.toISOString().slice(0, 7);

function makeStore(db) {
  const q = (sql) => db.prepare(sql);
  return {
    createUser(email, passwordHash) {
      const r = q("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)").run(email, passwordHash, Date.now());
      const id = Number(r.lastInsertRowid);
      q("INSERT INTO businesses (user_id) VALUES (?)").run(id);
      return id;
    },
    userByEmail: (email) => q("SELECT * FROM users WHERE email = ?").get(email),
    userById: (id) => q("SELECT * FROM users WHERE id = ?").get(id),
    userByCustomer: (cid) => q("SELECT * FROM users WHERE stripe_customer_id = ?").get(cid),
    setPlan: (id, plan) => q("UPDATE users SET plan = ? WHERE id = ?").run(plan, id),
    setCustomer: (id, cid) => q("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(cid, id),

    createSession(token, userId, ttlMs) {
      q("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
      q("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, Date.now() + ttlMs);
    },
    sessionUser(token) {
      return q(`SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
                WHERE sessions.token = ? AND sessions.expires_at > ?`).get(token, Date.now());
    },
    deleteSession: (token) => q("DELETE FROM sessions WHERE token = ?").run(token),

    business: (userId) => q("SELECT name, kind, tone, signoff, notes FROM businesses WHERE user_id = ?").get(userId),
    saveBusiness(userId, b) {
      q("UPDATE businesses SET name = ?, kind = ?, tone = ?, signoff = ?, notes = ? WHERE user_id = ?")
        .run(b.name, b.kind, b.tone, b.signoff, b.notes, userId);
    },

    addReview(userId, r) {
      const res = q("INSERT INTO reviews (user_id, reviewer, rating, body, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(userId, r.reviewer, r.rating, r.body, Date.now());
      return Number(res.lastInsertRowid);
    },
    reviews: (userId) => q("SELECT id, reviewer, rating, body, reply, status, created_at FROM reviews WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 500").all(userId),
    review: (userId, id) => q("SELECT * FROM reviews WHERE user_id = ? AND id = ?").get(userId, id),
    updateReview(userId, id, fields) {
      const cur = q("SELECT reply, status FROM reviews WHERE user_id = ? AND id = ?").get(userId, id);
      if (!cur) return false;
      q("UPDATE reviews SET reply = ?, status = ? WHERE user_id = ? AND id = ?")
        .run(fields.reply ?? cur.reply, fields.status ?? cur.status, userId, id);
      return true;
    },
    deleteReview: (userId, id) => q("DELETE FROM reviews WHERE user_id = ? AND id = ?").run(userId, id),

    usage: (userId, month = monthKey()) => q("SELECT count FROM usage WHERE user_id = ? AND month = ?").get(userId, month)?.count ?? 0,
    addUsage(userId, month = monthKey()) {
      q(`INSERT INTO usage (user_id, month, count) VALUES (?, ?, 1)
         ON CONFLICT(user_id, month) DO UPDATE SET count = count + 1`).run(userId, month);
    },
  };
}

module.exports = { open, makeStore, monthKey };
