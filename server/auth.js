"use strict";
/* ============================================================
   NUCLEAR TUTORIALS — Administrator authentication
   ------------------------------------------------------------
   scrypt-hashed passwords, random session tokens stored as
   SHA-256 hashes, HttpOnly session cookies and a small in-memory
   throttle on failed sign-in attempts. The admin area is not
   reachable by students: every write endpoint requires a session
   and /admin/* is redirected to the sign-in page server-side.
   ============================================================ */

var fs = require("node:fs");
var path = require("node:path");
var crypto = require("node:crypto");
var db = require("./db");

var COOKIE_NAME = "nt_admin";
var SESSION_DAYS = Number(process.env.NT_SESSION_DAYS || 7);
var SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
var MAX_ATTEMPTS = 8;
var ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
var attempts = new Map();

/* Unambiguous alphabet: no 0/O, 1/l/I. */
var PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPassword() {
  var group = function () {
    var out = "";
    var bytes = crypto.randomBytes(4);
    for (var i = 0; i < 4; i++) out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
    return out;
  };
  return group() + "-" + group() + "-" + group();
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

function safeEqual(a, b) {
  var bufA = Buffer.from(String(a), "utf8");
  var bufB = Buffer.from(String(b), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function publicAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name || "",
    role: row.role || "admin",
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at || ""
  };
}

/* Creates the first administrator on a fresh database. Credentials are
   printed to the server log and written inside the gitignored data folder
   so a restart never loses access to the admin area. */
function ensureFirstAdmin() {
  var existing = db.get("SELECT id FROM admins LIMIT 1");
  if (existing) return null;
  var email = String(process.env.NT_ADMIN_EMAIL || "admin@nucleartutorials.local").trim().toLowerCase();
  var password = process.env.NT_ADMIN_PASSWORD || randomPassword();
  var salt = crypto.randomBytes(16).toString("hex");
  var id = db.newId("adm");
  db.run(
    "INSERT INTO admins (id, email, name, password_hash, password_salt, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, email, "Administrator", hashPassword(password, salt), salt, "admin", db.nowIso(), db.nowIso()]
  );
  var record = { email: email, password: password, created: db.nowIso() };
  try {
    fs.mkdirSync(db.DATA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(db.DATA_DIR, "first-run-admin.txt"),
      "Nuclear Tutorials — first administrator account\n" +
      "Email:    " + email + "\n" +
      "Password: " + password + "\n\n" +
      "Sign in at /admin/login.html, then change this password in Admin → Settings.\n" +
      "This file lives in the gitignored data folder. Delete it once you have signed in.\n",
      { mode: 0o600 }
    );
  } catch (error) {
    record.fileError = error.message;
  }
  return record;
}

function throttled(ip) {
  var entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) { attempts.delete(ip); return false; }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(ip) {
  var entry = attempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) entry = { count: 0, resetAt: Date.now() + ATTEMPT_WINDOW_MS };
  entry.count += 1;
  attempts.set(ip, entry);
  return Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 1000));
}

function clearFailures(ip) {
  attempts.delete(ip);
}

function login(email, password, meta) {
  var ip = (meta && meta.ip) || "";
  if (throttled(ip)) {
    return { error: "too-many-attempts", retryAfter: Math.ceil(ATTEMPT_WINDOW_MS / 1000) };
  }
  var row = db.get("SELECT * FROM admins WHERE lower(email) = lower(?)", [String(email || "").trim()]);
  var ok = row && safeEqual(hashPassword(password, row.password_salt), row.password_hash);
  if (!ok) {
    return { error: "invalid-credentials", retryAfter: registerFailure(ip) };
  }
  clearFailures(ip);
  var token = crypto.randomBytes(32).toString("hex");
  var now = db.nowIso();
  db.run(
    "INSERT INTO sessions (token_hash, admin_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)",
    [
      crypto.createHash("sha256").update(token).digest("hex"),
      row.id,
      now,
      new Date(Date.now() + SESSION_MS).toISOString(),
      String((meta && meta.userAgent) || "").slice(0, 200)
    ]
  );
  db.run("UPDATE admins SET last_login_at = ? WHERE id = ?", [now, row.id]);
  return { token: token, admin: publicAdmin(row), expiresAt: new Date(Date.now() + SESSION_MS).toISOString() };
}

function logout(token) {
  if (!token) return;
  db.run("DELETE FROM sessions WHERE token_hash = ?", [crypto.createHash("sha256").update(token).digest("hex")]);
}

/* Sliding sessions: a valid sign-in is extended on use. */
function sessionAdmin(token) {
  if (!token) return null;
  var hash = crypto.createHash("sha256").update(token).digest("hex");
  var row = db.get(
    "SELECT s.token_hash, s.expires_at, a.* FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?",
    [hash]
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.run("DELETE FROM sessions WHERE token_hash = ?", [hash]);
    return null;
  }
  db.run("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", [new Date(Date.now() + SESSION_MS).toISOString(), hash]);
  return publicAdmin(row);
}

function purgeExpiredSessions() {
  db.run("DELETE FROM sessions WHERE expires_at < ?", [db.nowIso()]);
}

function changePassword(adminId, currentPassword, nextPassword) {
  var row = db.get("SELECT * FROM admins WHERE id = ?", [adminId]);
  if (!row) return { error: "not-found" };
  if (!safeEqual(hashPassword(currentPassword, row.password_salt), row.password_hash)) {
    return { error: "invalid-current" };
  }
  if (String(nextPassword || "").length < 10) return { error: "too-short" };
  var salt = crypto.randomBytes(16).toString("hex");
  db.run("UPDATE admins SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
    [hashPassword(nextPassword, salt), salt, db.nowIso(), adminId]);
  /* Other devices are signed out; the current session stays valid. */
  db.run("DELETE FROM sessions WHERE admin_id = ?", [adminId]);
  return { ok: true };
}

function parseCookies(req) {
  var header = req.headers && req.headers.cookie;
  var out = {};
  if (!header) return out;
  String(header).split(";").forEach(function (part) {
    var index = part.indexOf("=");
    if (index === -1) return;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return out;
}

function cookieName() {
  return COOKIE_NAME;
}

function cookieHeader(token, options) {
  var opts = options || {};
  var parts = [COOKIE_NAME + "=" + token, "Path=/", "HttpOnly", "SameSite=Lax"];
  parts.push(opts.clear ? "Max-Age=0" : "Max-Age=" + Math.floor(SESSION_MS / 1000));
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

function adminCount() {
  var row = db.get("SELECT COUNT(*) AS count FROM admins");
  return row ? Number(row.count) : 0;
}

function sessionCount() {
  purgeExpiredSessions();
  var row = db.get("SELECT COUNT(*) AS count FROM sessions");
  return row ? Number(row.count) : 0;
}

module.exports = {
  COOKIE_NAME: COOKIE_NAME,
  SESSION_DAYS: SESSION_DAYS,
  MAX_ATTEMPTS: MAX_ATTEMPTS,
  ensureFirstAdmin: ensureFirstAdmin,
  login: login,
  logout: logout,
  sessionAdmin: sessionAdmin,
  changePassword: changePassword,
  parseCookies: parseCookies,
  cookieName: cookieName,
  cookieHeader: cookieHeader,
  publicAdmin: publicAdmin,
  adminCount: adminCount,
  sessionCount: sessionCount,
  purgeExpiredSessions: purgeExpiredSessions
};
