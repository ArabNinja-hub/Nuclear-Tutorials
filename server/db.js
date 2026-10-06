/* ============================================================
   NUCLEAR TUTORIALS — Database (SQLite via node:sqlite)

   The catalogue hierarchy is stored in the database, never in the browser:

     universities  →  courses (semester 1 | 2)  →  video lessons

   Student access codes, learning progress, announcements and platform
   settings also live here so that every device sees the same content.
   ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var { DatabaseSync } = require("node:sqlite");
var platform = require("./platform");

/* Where the database lives. In production this must be a persistent,
   mounted volume (Railway: /var/data), never the deploy directory:

     NT_DB_FILE                    full path to the database file
     NT_DATA_DIR                   folder that holds nuclear-tutorials.db
     RAILWAY_VOLUME_MOUNT_PATH     set by Railway when a volume is attached,
                                   so a mounted volume is used even when
                                   NT_DATA_DIR has not been set
     otherwise                     server/data, for local development
   ============================================================ */

var RAILWAY_VOLUME = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || "").trim();
var CONFIGURED_DATA_DIR = RAILWAY_VOLUME
  ? path.resolve(RAILWAY_VOLUME)
  : (process.env.NT_DATA_DIR
    ? path.resolve(process.env.NT_DATA_DIR)
    : (platform.isDeployed() && fs.existsSync("/var/data") ? "/var/data" : ""));
var DATA_DIR = CONFIGURED_DATA_DIR || path.join(__dirname, "data");
var DB_FILE = process.env.NT_DB_FILE
  ? path.resolve(process.env.NT_DB_FILE)
  : path.join(DATA_DIR, "nuclear-tutorials.db");
/* True when the database path comes from configuration (a mounted volume or
   an explicit path) instead of the disposable folder inside the deploy
   directory. The start-up guard in server/index.js uses this. */
var PERSISTENT_STORAGE_CONFIGURED = !!(String(process.env.NT_DB_FILE || "").trim() || CONFIGURED_DATA_DIR);

var SCHEMA = [
  `PRAGMA journal_mode = WAL`,
  `PRAGMA foreign_keys = ON`,
  `CREATE TABLE IF NOT EXISTS universities (
     id            TEXT PRIMARY KEY,
     slug          TEXT UNIQUE,
     name          TEXT NOT NULL,
     short_name    TEXT,
     city          TEXT,
     level         TEXT NOT NULL DEFAULT 'university',
     summary       TEXT,
     accent        TEXT,
     position      INTEGER NOT NULL DEFAULT 0,
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS courses (
     id            TEXT PRIMARY KEY,
     university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
     semester      INTEGER NOT NULL CHECK (semester IN (1, 2)),
     code          TEXT,
     title         TEXT NOT NULL,
     description   TEXT,
     icon          TEXT NOT NULL DEFAULT 'book-open',
     tint          TEXT,
     tint_fg       TEXT,
     position      INTEGER NOT NULL DEFAULT 0,
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_courses_scope ON courses (university_id, semester, position)`,
  `CREATE TABLE IF NOT EXISTS videos (
     id               TEXT PRIMARY KEY,
     course_id        TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
     title            TEXT NOT NULL,
     topic            TEXT,
     description      TEXT,
     source_url       TEXT NOT NULL,
     provider         TEXT,
     thumbnail_url    TEXT,
     duration_seconds INTEGER,
     level            TEXT NOT NULL DEFAULT 'standard',
     position         INTEGER NOT NULL DEFAULT 0,
     published        INTEGER NOT NULL DEFAULT 1,
     created_at       TEXT NOT NULL,
     updated_at       TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_videos_course ON videos (course_id, position)`,
  `CREATE TABLE IF NOT EXISTS progress (
     code        TEXT NOT NULL,
     video_id    TEXT NOT NULL,
     completed   INTEGER NOT NULL DEFAULT 1,
     seconds     INTEGER,
     updated_at  TEXT NOT NULL,
     PRIMARY KEY (code, video_id)
   )`,
  `CREATE TABLE IF NOT EXISTS codes (
     code        TEXT PRIMARY KEY,
     package     TEXT NOT NULL,
     status      TEXT NOT NULL DEFAULT 'unused',
     issued_at   TEXT NOT NULL,
     redeemed_at TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS announcements (
     id         TEXT PRIMARY KEY,
     title      TEXT NOT NULL,
     body       TEXT NOT NULL,
     status     TEXT NOT NULL DEFAULT 'draft',
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS admins (
     id            INTEGER PRIMARY KEY CHECK (id = 1),
     password_hash TEXT NOT NULL,
     salt          TEXT NOT NULL,
     must_change   INTEGER NOT NULL DEFAULT 0,
     updated_at    TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token      TEXT PRIMARY KEY,
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS learner_accounts (
     id             TEXT PRIMARY KEY,
     email          TEXT NOT NULL COLLATE NOCASE UNIQUE,
     password_hash  TEXT NOT NULL,
     salt           TEXT NOT NULL,
     display_name   TEXT NOT NULL DEFAULT '',
     learner_type   TEXT CHECK (learner_type IS NULL OR learner_type IN ('university', 'high_school')),
     institution_id TEXT,
     semester       INTEGER NOT NULL DEFAULT 0 CHECK (semester IN (0, 1, 2)),
     created_at     TEXT NOT NULL,
     updated_at     TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_learner_accounts_email ON learner_accounts (email)`,
  `CREATE TABLE IF NOT EXISTS learner_sessions (
     token      TEXT PRIMARY KEY,
     account_id TEXT NOT NULL REFERENCES learner_accounts(id) ON DELETE CASCADE,
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_learner_sessions_account ON learner_sessions (account_id, expires_at)`
];

var DEFAULT_PACKAGES = {
  basic: {
    name: "Basic",
    price: 50,
    tagline: "Basic video lessons across the catalogue.",
    features: ["Basic video lessons in every course"]
  },
  standard: {
    name: "Standard",
    price: 100,
    tagline: "Basic and Standard video lessons across the catalogue.",
    features: ["Basic and Standard video lessons in every course"]
  },
  premium: {
    name: "Premium",
    price: 200,
    tagline: "Every published video lesson across the catalogue.",
    features: ["All video lessons in every course"]
  }
};

var DEFAULT_SETTINGS = {
  support_email: "",
  access_days: 180,
  packages: DEFAULT_PACKAGES
};

var db = null;

function now() { return new Date().toISOString(); }

function connect() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  db = new DatabaseSync(DB_FILE);
  SCHEMA.forEach(function (statement) { db.exec(statement); });
  migrate();
  return db;
}

/* Adds columns introduced after the first release. An existing installation
   may still be using a first-run password, so it must be rotated too. */
function migrate() {
  var columns = db.prepare("PRAGMA table_info(admins)").all().map(function (row) { return row.name; });
  if (columns.indexOf("must_change") === -1) {
    db.exec("ALTER TABLE admins ADD COLUMN must_change INTEGER NOT NULL DEFAULT 1");
  }
  var codeColumns = db.prepare("PRAGMA table_info(codes)").all().map(function (row) { return row.name; });
  if (codeColumns.indexOf("account_id") === -1) {
    db.exec("ALTER TABLE codes ADD COLUMN account_id TEXT REFERENCES learner_accounts(id) ON DELETE SET NULL");
  }
}

function getDatabase() { return db || connect(); }

/* ---------- helpers ---------- */

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

function safeEqual(a, b) {
  var left = Buffer.from(String(a));
  var right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function slugify(value, fallback) {
  var slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback || "item";
}

function uniqueId(prefix, taken) {
  var base = slugify(prefix, "item");
  var candidate = base;
  var counter = 2;
  while (taken(candidate)) {
    candidate = base + "-" + counter;
    counter += 1;
  }
  return candidate;
}

/* ---------- settings ---------- */

function readSetting(key, fallback) {
  var row = getDatabase().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch (error) { return fallback; }
}

function writeSetting(key, value) {
  getDatabase()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value));
}

function getSettings() {
  var days = readSetting("access_days", DEFAULT_SETTINGS.access_days);
  return {
    supportEmail: readSetting("support_email", DEFAULT_SETTINGS.support_email),
    accessDays: Number.isFinite(Number(days)) && Number(days) > 0 ? Number(days) : DEFAULT_SETTINGS.access_days,
    packages: Object.assign({}, DEFAULT_PACKAGES, readSetting("packages", {}) || {})
  };
}

/* ---------- first-run setup ---------- */

/* The first-run password comes from NT_ADMIN_PASSWORD, or a random value that
   is printed once in the server log. It must be changed before the admin API
   accepts any other request. */
function ensureAdmin() {
  var existing = getDatabase().prepare("SELECT id FROM admins WHERE id = 1").get();
  if (existing) return { created: false, password: null, generated: false };
  var generated = !process.env.NT_ADMIN_PASSWORD;
  var password = process.env.NT_ADMIN_PASSWORD || crypto.randomBytes(18).toString("base64url");
  var salt = crypto.randomBytes(16).toString("hex");
  getDatabase()
    .prepare("INSERT INTO admins (id, password_hash, salt, must_change, updated_at) VALUES (1, ?, ?, 1, ?)")
    .run(hashPassword(password, salt), salt, now());
  return { created: true, password: password, generated: generated };
}

function adminMustChangePassword() {
  var row = getDatabase().prepare("SELECT must_change FROM admins WHERE id = 1").get();
  return !row || row.must_change === 1;
}

function verifyAdminPassword(password) {
  var row = getDatabase().prepare("SELECT password_hash, salt FROM admins WHERE id = 1").get();
  if (!row) return false;
  return safeEqual(hashPassword(password, row.salt), row.password_hash);
}

function setAdminPassword(password, options) {
  var opts = options || {};
  var salt = opts.salt || crypto.randomBytes(16).toString("hex");
  var mustChange = opts.mustChange ? 1 : 0;
  var hash = hashPassword(password, salt);
  getDatabase()
    .prepare(`INSERT INTO admins (id, password_hash, salt, must_change, updated_at) VALUES (1, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt,
                                            must_change = excluded.must_change, updated_at = excluded.updated_at`)
    .run(hash, salt, mustChange, now());
}

function ensureDefaultSettings() {
  if (!getDatabase().prepare("SELECT key FROM settings WHERE key = 'access_days'").get()) {
    writeSetting("access_days", DEFAULT_SETTINGS.access_days);
  }
  if (!getDatabase().prepare("SELECT key FROM settings WHERE key = 'support_email'").get()) {
    writeSetting("support_email", DEFAULT_SETTINGS.support_email);
  }
  if (!getDatabase().prepare("SELECT key FROM settings WHERE key = 'packages'").get()) {
    writeSetting("packages", DEFAULT_PACKAGES);
  }
}

/* ---------- sessions ---------- */

/* Session lifetime is configurable (NT_SESSION_DAYS, default 7) and capped
   at a year so a mis-set value cannot create effectively eternal sessions. */
var SESSION_DAYS = (function () {
  var days = parseInt(process.env.NT_SESSION_DAYS, 10);
  if (!Number.isFinite(days) || days < 1) return 7;
  return Math.min(days, 365);
})();

function createSession() {
  var token = crypto.randomBytes(32).toString("hex");
  var created = new Date();
  var expires = new Date(created.getTime() + SESSION_DAYS * 86400000);
  getDatabase().prepare("INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)")
    .run(token, created.toISOString(), expires.toISOString());
  getDatabase().prepare("DELETE FROM sessions WHERE expires_at < ?").run(created.toISOString());
  return { token: token, expiresAt: expires.toISOString() };
}

function readSession(token) {
  if (!token) return null;
  var row = getDatabase().prepare("SELECT token, expires_at FROM sessions WHERE token = ?").get(String(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    getDatabase().prepare("DELETE FROM sessions WHERE token = ?").run(row.token);
    return null;
  }
  return row;
}

function destroySession(token) {
  if (!token) return;
  getDatabase().prepare("DELETE FROM sessions WHERE token = ?").run(String(token));
}

/* ---------- learner accounts ---------- */

function learnerAccountById(id) {
  if (!id) return null;
  return getDatabase().prepare("SELECT * FROM learner_accounts WHERE id = ?").get(String(id)) || null;
}

function learnerAccountByEmail(email) {
  if (!email) return null;
  return getDatabase().prepare("SELECT * FROM learner_accounts WHERE email = ? COLLATE NOCASE").get(String(email).trim()) || null;
}

function createLearnerAccount(email, password, displayName) {
  var salt = crypto.randomBytes(16).toString("hex");
  var id = crypto.randomUUID();
  var timestamp = now();
  getDatabase().prepare(`
    INSERT INTO learner_accounts (id, email, password_hash, salt, display_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, String(email).trim().toLowerCase(), hashPassword(password, salt), salt,
      String(displayName || "").trim().slice(0, 60), timestamp, timestamp);
  return learnerAccountById(id);
}

function verifyLearnerPassword(email, password) {
  var account = learnerAccountByEmail(email);
  if (!account) {
    /* Spend comparable time on unknown email addresses to reduce account
       enumeration through obvious response-time differences. */
    hashPassword(password, "nuclear-tutorials-account-check");
    return null;
  }
  if (!safeEqual(hashPassword(password, account.salt), account.password_hash)) return null;
  return account;
}

function setLearnerType(id, learnerType) {
  var existing = learnerAccountById(id);
  if (!existing) return null;
  var changed = existing.learner_type !== learnerType;
  getDatabase().prepare(`
    UPDATE learner_accounts
    SET learner_type = ?, institution_id = ?, semester = ?, updated_at = ?
    WHERE id = ?`)
    .run(learnerType, changed ? null : existing.institution_id,
      changed ? 0 : existing.semester, now(), id);
  return learnerAccountById(id);
}

function updateLearnerProfile(id, profile) {
  var current = learnerAccountById(id);
  if (!current) return null;
  getDatabase().prepare(`
    UPDATE learner_accounts
    SET display_name = ?, institution_id = ?, semester = ?, updated_at = ?
    WHERE id = ?`)
    .run(profile.displayName == null ? current.display_name : String(profile.displayName).slice(0, 60),
      profile.institutionId == null ? current.institution_id : (profile.institutionId || null),
      profile.semester == null ? current.semester : Number(profile.semester), now(), id);
  return learnerAccountById(id);
}

function createLearnerSession(accountId) {
  var token = crypto.randomBytes(32).toString("hex");
  var created = new Date();
  var expires = new Date(created.getTime() + SESSION_DAYS * 86400000);
  getDatabase().prepare("INSERT INTO learner_sessions (token, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(token, accountId, created.toISOString(), expires.toISOString());
  getDatabase().prepare("DELETE FROM learner_sessions WHERE expires_at < ?").run(created.toISOString());
  return { token: token, expiresAt: expires.toISOString() };
}

function readLearnerSession(token) {
  if (!token) return null;
  var row = getDatabase().prepare("SELECT token, account_id, expires_at FROM learner_sessions WHERE token = ?").get(String(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    getDatabase().prepare("DELETE FROM learner_sessions WHERE token = ?").run(row.token);
    return null;
  }
  return row;
}

function destroyLearnerSession(token) {
  if (!token) return;
  getDatabase().prepare("DELETE FROM learner_sessions WHERE token = ?").run(String(token));
}

function linkCodeToLearner(code, accountId) {
  if (!code || !accountId) return;
  getDatabase().prepare("UPDATE codes SET account_id = ? WHERE code = ? AND status = 'redeemed'")
    .run(String(accountId), String(code).toUpperCase().trim());
}

function linkExistingRedeemedCode(code, accountId) {
  if (!code || !accountId) return false;
  var result = getDatabase().prepare(`
    UPDATE codes SET account_id = ?
    WHERE code = ? AND status = 'redeemed' AND (account_id IS NULL OR account_id = ?)`)
    .run(String(accountId), String(code).toUpperCase().trim(), String(accountId));
  return result.changes > 0;
}

function learnerCodes(accountId) {
  if (!accountId) return [];
  return getDatabase().prepare("SELECT * FROM codes WHERE account_id = ? AND status = 'redeemed' ORDER BY redeemed_at DESC")
    .all(String(accountId));
}

/* ---------- shutdown ---------- */

/* Flush the write-ahead log into the database file and close the handle.
   Called on SIGTERM/SIGINT so a redeploy never leaves a half-written WAL
   on the volume. Nothing here deletes or recreates data. */
function close() {
  if (!db) return;
  try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch (error) { /* best effort */ }
  try { db.close(); } catch (error) { /* best effort */ }
  db = null;
}

module.exports = {
  DB_FILE: DB_FILE,
  DATA_DIR: DATA_DIR,
  PERSISTENT_STORAGE_CONFIGURED: PERSISTENT_STORAGE_CONFIGURED,
  connect: connect,
  close: close,
  db: getDatabase,
  now: now,
  slugify: slugify,
  uniqueId: uniqueId,
  hashPassword: hashPassword,
  safeEqual: safeEqual,
  ensureAdmin: ensureAdmin,
  adminMustChangePassword: adminMustChangePassword,
  verifyAdminPassword: verifyAdminPassword,
  setAdminPassword: setAdminPassword,
  ensureDefaultSettings: ensureDefaultSettings,
  getSettings: getSettings,
  readSetting: readSetting,
  writeSetting: writeSetting,
  createSession: createSession,
  readSession: readSession,
  destroySession: destroySession,
  learnerAccountById: learnerAccountById,
  learnerAccountByEmail: learnerAccountByEmail,
  createLearnerAccount: createLearnerAccount,
  verifyLearnerPassword: verifyLearnerPassword,
  setLearnerType: setLearnerType,
  updateLearnerProfile: updateLearnerProfile,
  createLearnerSession: createLearnerSession,
  readLearnerSession: readLearnerSession,
  destroyLearnerSession: destroyLearnerSession,
  linkCodeToLearner: linkCodeToLearner,
  linkExistingRedeemedCode: linkExistingRedeemedCode,
  learnerCodes: learnerCodes,
  SESSION_DAYS: SESSION_DAYS,
  DEFAULT_PACKAGES: DEFAULT_PACKAGES,
  DEFAULT_SETTINGS: DEFAULT_SETTINGS
};
