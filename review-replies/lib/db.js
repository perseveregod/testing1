// Storage on libSQL (SQLite-compatible).
// - With TURSO_DATABASE_URL set, data lives in a hosted Turso database, so it
//   survives restarts and redeploys even on hosts with no persistent disk.
// - Otherwise it's a local SQLite file (DB_FILE), as before; tests use this.

const { createClient } = require("@libsql/client");
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
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, source)
);
`;

async function init(client) {
  await client.executeMultiple(SCHEMA);
  // Migration: record when each user accepted which version of the terms.
  const cols = (await client.execute("PRAGMA table_info(users)")).rows.map((c) => c.name);
  if (!cols.includes("terms_accepted_at")) await client.execute("ALTER TABLE users ADD COLUMN terms_accepted_at INTEGER");
  if (!cols.includes("terms_version")) await client.execute("ALTER TABLE users ADD COLUMN terms_version TEXT");
  // Migration: which link or site a new account came from (see lib/stats.js).
  if (!cols.includes("source")) await client.execute("ALTER TABLE users ADD COLUMN source TEXT");
}

// Returns a client right away; schema setup runs in the background and every
// store call waits for it.
function open(file) {
  let client;
  if (file !== ":memory:" && process.env.TURSO_DATABASE_URL) {
    client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  } else {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    client = createClient({ url: file === ":memory:" ? ":memory:" : "file:" + file });
  }
  client.ready = init(client);
  client.ready.catch(() => {}); // surfaced on the first query instead
  return client;
}

const monthKey = (now = new Date()) => now.toISOString().slice(0, 7);
const plain = (rs, row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]]));

function makeStore(db) {
  const run = async (sql, ...args) => { await db.ready; return db.execute({ sql, args }); };
  const get = async (sql, ...args) => { const rs = await run(sql, ...args); return rs.rows.length ? plain(rs, rs.rows[0]) : undefined; };
  const all = async (sql, ...args) => { const rs = await run(sql, ...args); return rs.rows.map((r) => plain(rs, r)); };
  const batch = async (stmts) => { await db.ready; return db.batch(stmts.map(([sql, ...args]) => ({ sql, args })), "write"); };

  return {
    async createUser(email, passwordHash, termsVersion = null, source = null) {
      const now = Date.now();
      const [r] = await batch([
        ["INSERT INTO users (email, password_hash, created_at, terms_accepted_at, terms_version, source) VALUES (?, ?, ?, ?, ?, ?)",
          email, passwordHash, now, termsVersion ? now : null, termsVersion, source],
        ["INSERT INTO businesses (user_id) VALUES (last_insert_rowid())"],
      ]);
      return Number(r.lastInsertRowid);
    },
    userByEmail: (email) => get("SELECT * FROM users WHERE email = ?", email),
    userById: (id) => get("SELECT * FROM users WHERE id = ?", id),
    userByCustomer: (cid) => get("SELECT * FROM users WHERE stripe_customer_id = ?", cid),
    setPlan: (id, plan) => run("UPDATE users SET plan = ? WHERE id = ?", plan, id),
    setCustomer: (id, cid) => run("UPDATE users SET stripe_customer_id = ? WHERE id = ?", cid, id),

    async createSession(token, userId, ttlMs) {
      await batch([
        ["DELETE FROM sessions WHERE expires_at < ?", Date.now()],
        ["INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, userId, Date.now() + ttlMs],
      ]);
    },
    sessionUser: (token) => get(`SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
                WHERE sessions.token = ? AND sessions.expires_at > ?`, token, Date.now()),
    deleteSession: (token) => run("DELETE FROM sessions WHERE token = ?", token),

    // One-time password reset links. A new link for a user replaces any older one.
    async createReset(tokenHash, userId, ttlMs) {
      await batch([
        ["DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?", userId, Date.now()],
        ["INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)", tokenHash, userId, Date.now() + ttlMs],
      ]);
    },
    resetUser: (tokenHash) => get(`SELECT users.* FROM password_resets JOIN users ON users.id = password_resets.user_id
                WHERE password_resets.token_hash = ? AND password_resets.expires_at > ?`, tokenHash, Date.now()),
    // Sets the new password, uses up the link, and logs the account out everywhere.
    async setPassword(userId, passwordHash) {
      await batch([
        ["UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, userId],
        ["DELETE FROM password_resets WHERE user_id = ?", userId],
        ["DELETE FROM sessions WHERE user_id = ?", userId],
      ]);
    },

    // Permanently removes the user and everything they own. Child rows are
    // deleted explicitly because a hosted database may not enforce cascades.
    async deleteUser(id) {
      await batch([
        ["DELETE FROM sessions WHERE user_id = ?", id],
        ["DELETE FROM password_resets WHERE user_id = ?", id],
        ["DELETE FROM businesses WHERE user_id = ?", id],
        ["DELETE FROM reviews WHERE user_id = ?", id],
        ["DELETE FROM usage WHERE user_id = ?", id],
        ["DELETE FROM users WHERE id = ?", id],
      ]);
    },
    async exportData(userId) {
      return {
        account: await get("SELECT email, plan, created_at, terms_accepted_at, terms_version, source FROM users WHERE id = ?", userId),
        business: await get("SELECT name, kind, tone, signoff, notes FROM businesses WHERE user_id = ?", userId),
        reviews: await all("SELECT reviewer, rating, body, reply, status, created_at FROM reviews WHERE user_id = ? ORDER BY created_at", userId),
        usage: await all("SELECT month, count FROM usage WHERE user_id = ? ORDER BY month", userId),
      };
    },

    business: (userId) => get("SELECT name, kind, tone, signoff, notes FROM businesses WHERE user_id = ?", userId),
    saveBusiness: (userId, b) => run("UPDATE businesses SET name = ?, kind = ?, tone = ?, signoff = ?, notes = ? WHERE user_id = ?",
      b.name, b.kind, b.tone, b.signoff, b.notes, userId),

    async addReview(userId, r) {
      const res = await run("INSERT INTO reviews (user_id, reviewer, rating, body, created_at) VALUES (?, ?, ?, ?, ?)",
        userId, r.reviewer, r.rating, r.body, Date.now());
      return Number(res.lastInsertRowid);
    },
    reviews: (userId) => all("SELECT id, reviewer, rating, body, reply, status, created_at FROM reviews WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 500", userId),
    review: (userId, id) => get("SELECT * FROM reviews WHERE user_id = ? AND id = ?", userId, id),
    async updateReview(userId, id, fields) {
      const cur = await get("SELECT reply, status FROM reviews WHERE user_id = ? AND id = ?", userId, id);
      if (!cur) return false;
      await run("UPDATE reviews SET reply = ?, status = ? WHERE user_id = ? AND id = ?",
        fields.reply ?? cur.reply, fields.status ?? cur.status, userId, id);
      return true;
    },
    deleteReview: (userId, id) => run("DELETE FROM reviews WHERE user_id = ? AND id = ?", userId, id),

    usage: async (userId, month = monthKey()) => (await get("SELECT count FROM usage WHERE user_id = ? AND month = ?", userId, month))?.count ?? 0,
    addUsage: (userId, month = monthKey()) => run(`INSERT INTO usage (user_id, month, count) VALUES (?, ?, 1)
         ON CONFLICT(user_id, month) DO UPDATE SET count = count + 1`, userId, month),

    // Anonymous totals for the owner page: one counter per day, kind and source.
    countEvent: (day, kind, source) => run(`INSERT INTO events (day, kind, source, count) VALUES (?, ?, ?, 1)
         ON CONFLICT(day, kind, source) DO UPDATE SET count = count + 1`, day, kind, source),
    eventsSince: (day) => all("SELECT day, kind, source, count FROM events WHERE day >= ? ORDER BY day", day),
    accounts: (month = monthKey()) => all(`SELECT users.email, users.plan, users.created_at, users.source,
         (SELECT count FROM usage WHERE usage.user_id = users.id AND usage.month = ?) AS replies_this_month,
         (SELECT COUNT(*) FROM reviews WHERE reviews.user_id = users.id) AS reviews
       FROM users ORDER BY users.created_at DESC LIMIT 500`, month),
  };
}

module.exports = { open, makeStore, monthKey };
