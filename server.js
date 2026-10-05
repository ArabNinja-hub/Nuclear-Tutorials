/* ============================================================
   NUCLEAR TUTORIALS — Backend server
   Zero-dependency Node HTTP server. Serves static files and
   persists shared platform state to data/db.json.

   Run:  node server.js
   Env:  PORT (default 8765)   ADMIN_PASSWORD (default "admin")
   ============================================================ */
var http = require("http");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var url = require("url");

var ROOT = __dirname;
var DATA_DIR = path.join(ROOT, "data");
var DB_FILE = path.join(DATA_DIR, "db.json");
var PORT = Number(process.env.PORT) || 8765;
var ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
var SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

/* ---------- Shared persistent state ---------- */
function defaultDb() {
  return {
    tokens: {}, // token -> { createdAt }
    lessonLevels: {},
    announcements: [],
    packages: { basic: 50, standard: 100, premium: 200 },
    packageDetails: {},
    settings: { email: "", days: 30 },
    codes: []
    // code record shape: { code, pkg, status: "unused"|"redeemed", created, redeemedAt }
  };
}

function loadDb() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
  try {
    var raw = fs.readFileSync(DB_FILE, "utf8");
    var parsed = JSON.parse(raw);
    var base = defaultDb();
    var db = Object.assign({}, base, parsed);
    db.packages = Object.assign({}, base.packages, parsed.packages || {});
    db.packageDetails = parsed.packageDetails && typeof parsed.packageDetails === "object" ? parsed.packageDetails : {};
    db.settings = Object.assign({}, base.settings, parsed.settings || {});
    db.codes = Array.isArray(parsed.codes) ? parsed.codes : [];
    db.announcements = Array.isArray(parsed.announcements) ? parsed.announcements : [];
    db.lessonLevels = parsed.lessonLevels && typeof parsed.lessonLevels === "object" ? parsed.lessonLevels : {};
    db.tokens = {}; // never persist sessions
    return db;
  } catch (e) {
    return defaultDb();
  }
}

var db = loadDb();
var dbSaveTimer = null;
function saveDb() {
  if (dbSaveTimer) return;
  dbSaveTimer = setTimeout(function () {
    dbSaveTimer = null;
    try {
      var toSave = Object.assign({}, db);
      toSave.tokens = {};
      fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2));
    } catch (e) { console.error("DB save error:", e.message); }
  }, 50);
}

/* ---------- HTTP helpers ---------- */
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function send(res, status, body, headers) {
  var isString = typeof body === "string";
  var buf = isString ? Buffer.from(body) :
            Buffer.isBuffer(body) ? body :
            Buffer.from(JSON.stringify(body));
  var heads = { "Content-Length": buf.length };
  if (!isString || (isString && !headers) || (headers && !headers["Content-Type"])) {
    heads["Content-Type"] = "application/json; charset=utf-8";
  }
  if (headers) Object.keys(headers).forEach(function (k) { heads[k] = headers[k]; });
  res.writeHead(status, heads);
  res.end(buf);
}

function sendJson(res, status, obj) { send(res, status, obj); }

function readBody(req, limit) {
  limit = limit || 64 * 1024;
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var total = 0;
    req.on("data", function (c) { total += c.length; if (total > limit) { reject(new Error("body too large")); req.destroy(); return; } chunks.push(c); });
    req.on("end", function () {
      var raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error("invalid json")); }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  // Prevent path traversal
  var safe = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  if (safe === "/" || safe === "\\") safe = "/index.html";
  var filePath = path.join(ROOT, safe);
  if (!filePath.startsWith(ROOT)) { sendJson(res, 403, { error: "forbidden" }); return; }
  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) { sendJson(res, 404, { error: "not found" }); return; }
    var ext = path.extname(filePath).toLowerCase();
    var type = MIME[ext] || "application/octet-stream";
    fs.readFile(filePath, function (e, data) {
      if (e) { sendJson(res, 500, { error: "read error" }); return; }
      send(res, 200, data, { "Content-Type": type, "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=60" });
    });
  });
}

/* ---------- Auth ---------- */
function newToken() { return crypto.randomBytes(24).toString("hex"); }
function requireAuth(req) {
  var auth = req.headers["authorization"] || "";
  var m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  var t = m[1];
  var s = db.tokens[t];
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) { delete db.tokens[t]; saveDb(); return null; }
  return t;
}

function publicState() {
  // Strip code list entirely — clients must redeem by submitting the code.
  // Clients only need counts + whether their specific code is valid.
  return {
    lessonLevels: db.lessonLevels,
    announcements: db.announcements.filter(function (a) { return a.status === "published"; }),
    packages: db.packages,
    packageDetails: db.packageDetails,
    settings: db.settings,
    codesLen: db.codes.length,
    serverTime: new Date().toISOString()
  };
}

/* ---------- Routes ---------- */
function handleApi(req, res, pathname, query) {
  if (pathname === "/api/public" && req.method === "GET") {
    sendJson(res, 200, publicState());
    return;
  }

  if (pathname === "/api/redeem" && req.method === "POST") {
    readBody(req).then(function (body) {
      var code = String(body.code || "").trim().toUpperCase();
      var level = String(body.educationLevel || "").trim();
      var rec = db.codes.filter(function (r) { return String(r.code).toUpperCase() === code; })[0];
      if (!rec) { sendJson(res, 404, { error: "not_found", message: "That code could not be found." }); return; }
      if (rec.status === "redeemed") { sendJson(res, 409, { error: "redeemed", message: "This code has already been used." }); return; }
      rec.status = "redeemed";
      rec.redeemedAt = new Date().toISOString();
      rec.redeemedLevel = level;
      saveDb();
      sendJson(res, 200, { ok: true, pkg: rec.pkg, code: rec.code, redeemedAt: rec.redeemedAt });
    }).catch(function (e) { sendJson(res, 400, { error: "bad_request", message: e.message }); });
    return;
  }

  if (pathname === "/api/admin/login" && req.method === "POST") {
    readBody(req).then(function (body) {
      if (!crypto.timingSafeEqual || body.password !== ADMIN_PASSWORD) {
        // constant-time compare when available, else fallback
        var a = Buffer.from(String(body.password || "")), b = Buffer.from(ADMIN_PASSWORD);
        if (a.length !== b.length || !crypto.timingSafeEqual(a.length === b.length ? a : Buffer.alloc(b.length), b)) {
          sendJson(res, 401, { error: "unauthorized" }); return;
        }
      }
      var t = newToken();
      db.tokens[t] = { createdAt: Date.now() };
      saveDb();
      sendJson(res, 200, { token: t });
    }).catch(function (e) { sendJson(res, 400, { error: "bad_request" }); });
    return;
  }

  /* Everything below requires admin auth */
  var token = requireAuth(req);
  if (!token) { sendJson(res, 401, { error: "unauthorized" }); return; }

  if (pathname === "/api/admin/state" && req.method === "GET") {
    sendJson(res, 200, {
      lessonLevels: db.lessonLevels,
      announcements: db.announcements,
      packages: db.packages,
      packageDetails: db.packageDetails,
      settings: db.settings,
      codes: db.codes.map(function (c) { return Object.assign({}, c); })
    });
    return;
  }

  if (pathname === "/api/admin/state" && req.method === "POST") {
    readBody(req).then(function (body) {
      var changed = false;
      if (body.lessonLevels && typeof body.lessonLevels === "object") { db.lessonLevels = body.lessonLevels; changed = true; }
      if (Array.isArray(body.announcements)) { db.announcements = body.announcements; changed = true; }
      if (body.packages && typeof body.packages === "object") {
        Object.keys(body.packages).forEach(function (k) {
          var v = Number(body.packages[k]);
          if (Number.isFinite(v) && v >= 0) db.packages[k] = v;
        });
        changed = true;
      }
      if (body.packageDetails && typeof body.packageDetails === "object") { db.packageDetails = body.packageDetails; changed = true; }
      if (body.settings && typeof body.settings === "object") {
        if (typeof body.settings.email === "string") db.settings.email = body.settings.email;
        var days = Number(body.settings.days);
        if (Number.isFinite(days) && days >= 1) db.settings.days = days;
        changed = true;
      }
      if (changed) saveDb();
      sendJson(res, 200, { ok: true });
    }).catch(function (e) { sendJson(res, 400, { error: "bad_request", message: e.message }); });
    return;
  }

  if (pathname === "/api/admin/codes" && req.method === "POST") {
    readBody(req).then(function (body) {
      var pkg = String(body.pkg || "");
      if (["basic", "standard", "premium"].indexOf(pkg) === -1) { sendJson(res, 400, { error: "bad_package" }); return; }
      var code;
      for (var attempt = 0; attempt < 10; attempt++) {
        var num = Math.floor(1000 + Math.random() * 9000);
        code = "NT-" + pkg.toUpperCase() + "-" + num;
        if (!db.codes.some(function (r) { return String(r.code).toUpperCase() === code; })) break;
      }
      var rec = { code: code, pkg: pkg, status: "unused", created: new Date().toISOString().slice(0, 10) };
      db.codes.unshift(rec);
      saveDb();
      sendJson(res, 200, rec);
    }).catch(function (e) { sendJson(res, 400, { error: "bad_request" }); });
    return;
  }

  var codeDelMatch = pathname.match(/^\/api\/admin\/codes\/([A-Z0-9-]+)$/);
  if (codeDelMatch && req.method === "DELETE") {
    var codeToDel = decodeURIComponent(codeDelMatch[1]).toUpperCase();
    var before = db.codes.length;
    db.codes = db.codes.filter(function (r) { return String(r.code).toUpperCase() !== codeToDel; });
    if (db.codes.length !== before) saveDb();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/admin/announcements" && req.method === "POST") {
    readBody(req).then(function (body) {
      if (!body.title || !body.body) { sendJson(res, 400, { error: "missing_fields" }); return; }
      var notice = {
        id: "notice-" + Date.now(),
        title: String(body.title).slice(0, 120),
        body: String(body.body).slice(0, 2000),
        status: body.status === "published" ? "published" : "draft",
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };
      db.announcements.unshift(notice);
      saveDb();
      sendJson(res, 200, notice);
    }).catch(function (e) { sendJson(res, 400, { error: "bad_request" }); });
    return;
  }

  var annMatch = pathname.match(/^\/api\/admin\/announcements\/([^/]+)$/);
  if (annMatch && req.method === "PATCH") {
    var aid = decodeURIComponent(annMatch[1]);
    readBody(req).then(function (body) {
      var item = db.announcements.filter(function (n) { return n.id === aid; })[0];
      if (!item) { sendJson(res, 404, { error: "not_found" }); return; }
      if (typeof body.title === "string") item.title = body.title.slice(0, 120);
      if (typeof body.body === "string") item.body = body.body.slice(0, 2000);
      if (body.status === "published" || body.status === "draft") item.status = body.status;
      item.updated = new Date().toISOString();
      saveDb();
      sendJson(res, 200, item);
    }).catch(function (e) { sendJson(res, 400, { error: "bad_request" }); });
    return;
  }
  if (annMatch && req.method === "DELETE") {
    var aid2 = decodeURIComponent(annMatch[1]);
    db.announcements = db.announcements.filter(function (n) { return n.id !== aid2; });
    saveDb();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/admin/reset" && req.method === "POST") {
    db = defaultDb();
    db.tokens[token] = { createdAt: Date.now() }; // keep current session
    saveDb();
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

/* ---------- Server ---------- */
var server = http.createServer(function (req, res) {
  var parsed = url.parse(req.url, true);
  var pathname = decodeURIComponent(parsed.pathname);

  // CORS (same-origin, but safe)
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");

  if (pathname.indexOf("/api/") === 0) {
    handleApi(req, res, pathname, parsed.query);
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, "0.0.0.0", function () {
  console.log("Nuclear Tutorials server running on http://0.0.0.0:" + PORT);
  console.log("Admin password:", ADMIN_PASSWORD + (process.env.ADMIN_PASSWORD ? " (from env)" : " (default — change via ADMIN_PASSWORD env var)"));
  console.log("Database:", DB_FILE);
});
