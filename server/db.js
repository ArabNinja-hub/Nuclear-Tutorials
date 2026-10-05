"use strict";
/* ============================================================
   NUCLEAR TUTORIALS — Content database (SQLite)
   ------------------------------------------------------------
   Single source of truth for the video-learning catalogue:

     universities ──< courses (semester 1 | 2) ──< videos

   Everything a student browses (universities, semesters, courses
   and video lessons) lives here, so an admin change on one device
   is immediately visible to students on every other device.
   No dependencies: Node's built-in node:sqlite module.
   ============================================================ */

var fs = require("node:fs");
var path = require("node:path");
var crypto = require("node:crypto");
var DatabaseSync = require("node:sqlite").DatabaseSync;

var DATA_DIR = process.env.NT_DATA_DIR || path.join(__dirname, "..", "data");
var DB_FILE = process.env.NT_DB_FILE || path.join(DATA_DIR, "content.sqlite");
var SCHEMA_VERSION = 1;

var SCHEMA = [
  "CREATE TABLE IF NOT EXISTS meta (" +
    "key TEXT PRIMARY KEY," +
    "value TEXT NOT NULL" +
  ")",

  /* One row per institution, e.g. "University of Zambia". */
  "CREATE TABLE IF NOT EXISTS universities (" +
    "id TEXT PRIMARY KEY," +
    "name TEXT NOT NULL," +
    "short_name TEXT NOT NULL DEFAULT ''," +
    "city TEXT NOT NULL DEFAULT ''," +
    "country TEXT NOT NULL DEFAULT ''," +
    "description TEXT NOT NULL DEFAULT ''," +
    "accent TEXT NOT NULL DEFAULT ''," +
    "logo_url TEXT NOT NULL DEFAULT ''," +
    "position INTEGER NOT NULL DEFAULT 0," +
    "status TEXT NOT NULL DEFAULT 'published'," +
    "created_at TEXT NOT NULL," +
    "updated_at TEXT NOT NULL" +
  ")",

  /* A course always belongs to one university AND one semester (1 or 2). */
  "CREATE TABLE IF NOT EXISTS courses (" +
    "id TEXT PRIMARY KEY," +
    "university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE," +
    "semester INTEGER NOT NULL CHECK (semester IN (1, 2))," +
    "title TEXT NOT NULL," +
    "code TEXT NOT NULL DEFAULT ''," +
    "subject_id TEXT NOT NULL DEFAULT ''," +
    "instructor TEXT NOT NULL DEFAULT ''," +
    "description TEXT NOT NULL DEFAULT ''," +
    "position INTEGER NOT NULL DEFAULT 0," +
    "status TEXT NOT NULL DEFAULT 'published'," +
    "created_at TEXT NOT NULL," +
    "updated_at TEXT NOT NULL" +
  ")",

  /* A video lesson always belongs to exactly one course. The access level
     reuses the existing Basic / Standard / Premium package tiers, so the
     current access-code flow keeps governing what a student can watch. */
  "CREATE TABLE IF NOT EXISTS videos (" +
    "id TEXT PRIMARY KEY," +
    "course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE," +
    "title TEXT NOT NULL," +
    "topic TEXT NOT NULL DEFAULT ''," +
    "description TEXT NOT NULL DEFAULT ''," +
    "url TEXT NOT NULL," +
    /* Source analysis is done once on the server (see server/util.js) so the
       student pages always receive a ready-to-use embed URL and thumbnail. */
    "provider TEXT NOT NULL DEFAULT ''," +
    "external_id TEXT NOT NULL DEFAULT ''," +
    "embed_url TEXT NOT NULL DEFAULT ''," +
    "thumbnail_url TEXT NOT NULL DEFAULT ''," +
    "thumbnail_auto TEXT NOT NULL DEFAULT ''," +
    "duration_seconds INTEGER," +
    "level TEXT NOT NULL DEFAULT 'basic' CHECK (level IN ('basic', 'standard', 'premium'))," +
    "position INTEGER NOT NULL DEFAULT 0," +
    "status TEXT NOT NULL DEFAULT 'published'," +
    "created_at TEXT NOT NULL," +
    "updated_at TEXT NOT NULL" +
  ")",

  /* Administrator accounts (scrypt-hashed passwords) and their sessions. */
  "CREATE TABLE IF NOT EXISTS admins (" +
    "id TEXT PRIMARY KEY," +
    "email TEXT NOT NULL UNIQUE," +
    "name TEXT NOT NULL DEFAULT ''," +
    "password_hash TEXT NOT NULL," +
    "password_salt TEXT NOT NULL," +
    "role TEXT NOT NULL DEFAULT 'admin'," +
    "created_at TEXT NOT NULL," +
    "updated_at TEXT NOT NULL," +
    "last_login_at TEXT" +
  ")",
  "CREATE TABLE IF NOT EXISTS sessions (" +
    "token_hash TEXT PRIMARY KEY," +
    "admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE," +
    "created_at TEXT NOT NULL," +
    "expires_at TEXT NOT NULL," +
    "user_agent TEXT NOT NULL DEFAULT ''" +
  ")",

  "CREATE INDEX IF NOT EXISTS idx_courses_university ON courses (university_id, semester, position)",
  "CREATE INDEX IF NOT EXISTS idx_videos_course ON videos (course_id, position)",
  "CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions (admin_id)",
  "CREATE INDEX IF NOT EXISTS idx_universities_position ON universities (position)"
].join(";\n") + ";";

var db = null;

function newId(prefix) {
  return prefix + "_" + crypto.randomBytes(6).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function connect() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  var row = get("SELECT value FROM meta WHERE key = ?", ["schema_version"]);
  if (!row) {
    run("INSERT INTO meta (key, value) VALUES (?, ?)", ["schema_version", String(SCHEMA_VERSION)]);
  }
  return db;
}

/* node:sqlite binds anonymous parameters positionally, so the array is spread
   into the prepared statement rather than passed as one argument. */
function values(params) {
  return Array.isArray(params) ? params.slice() : (params ? [params] : []);
}

function all(sql, params) {
  var statement = connect().prepare(sql);
  return statement.all.apply(statement, values(params)).map(function (row) {
    return Object.assign({}, row);
  });
}

function get(sql, params) {
  var statement = connect().prepare(sql);
  var row = statement.get.apply(statement, values(params));
  return row ? Object.assign({}, row) : null;
}

function run(sql, params) {
  var statement = connect().prepare(sql);
  return statement.run.apply(statement, values(params));
}

function meta(key, fallback) {
  var row = get("SELECT value FROM meta WHERE key = ?", [key]);
  return row ? row.value : fallback;
}

function setMeta(key, value) {
  run(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, String(value)]
  );
}

/* Next position inside a scope, so new records append to the end of a list. */
function nextPosition(table, whereSql, params) {
  var row = get("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM " + table + (whereSql ? " WHERE " + whereSql : ""), params || []);
  return row ? Number(row.next) : 0;
}

module.exports = {
  DATA_DIR: DATA_DIR,
  DB_FILE: DB_FILE,
  SCHEMA_VERSION: SCHEMA_VERSION,
  connect: connect,
  all: all,
  get: get,
  run: run,
  meta: meta,
  setMeta: setMeta,
  nextPosition: nextPosition,
  newId: newId,
  nowIso: nowIso,
  close: function () {
    if (db) { db.close(); db = null; }
  }
};
