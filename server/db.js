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

var DATA_DIR = process.env.NT_DATA_DIR
  ? path.resolve(process.env.NT_DATA_DIR)
  : path.join(__dirname, "data");
var DB_FILE = process.env.NT_DB_FILE
  ? path.resolve(process.env.NT_DB_FILE)
  : path.join(DATA_DIR, "nuclear-tutorials.db");

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
     updated_at    TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token      TEXT PRIMARY KEY,
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL
   )`
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
  return db;
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

function ensureAdmin() {
  var existing = getDatabase().prepare("SELECT id FROM admins WHERE id = 1").get();
  var password = process.env.NT_ADMIN_PASSWORD || "nuclear-admin";
  if (existing) return { created: false, password: null };
  var salt = crypto.randomBytes(16).toString("hex");
  getDatabase()
    .prepare("INSERT INTO admins (id, password_hash, salt, updated_at) VALUES (1, ?, ?, ?)")
    .run(hashPassword(password, salt), salt, now());
  return { created: true, password: password };
}

function verifyAdminPassword(password) {
  var row = getDatabase().prepare("SELECT password_hash, salt FROM admins WHERE id = 1").get();
  if (!row) return false;
  return safeEqual(hashPassword(password, row.salt), row.password_hash);
}

function setAdminPassword(password, saltOverride) {
  var salt = saltOverride || crypto.randomBytes(16).toString("hex");
  var hash = hashPassword(password, salt);
  getDatabase()
    .prepare(`INSERT INTO admins (id, password_hash, salt, updated_at) VALUES (1, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt, updated_at = excluded.updated_at`)
    .run(hash, salt, now());
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

var SESSION_DAYS = 7;

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

module.exports = {
  DB_FILE: DB_FILE,
  DATA_DIR: DATA_DIR,
  connect: connect,
  db: getDatabase,
  now: now,
  slugify: slugify,
  uniqueId: uniqueId,
  hashPassword: hashPassword,
  safeEqual: safeEqual,
  ensureAdmin: ensureAdmin,
  verifyAdminPassword: verifyAdminPassword,
  setAdminPassword: setAdminPassword,
  ensureDefaultSettings: ensureDefaultSettings,
  getSettings: getSettings,
  readSetting: readSetting,
  writeSetting: writeSetting,
  createSession: createSession,
  readSession: readSession,
  destroySession: destroySession,
  SESSION_DAYS: SESSION_DAYS,
  DEFAULT_PACKAGES: DEFAULT_PACKAGES,
  DEFAULT_SETTINGS: DEFAULT_SETTINGS
};
