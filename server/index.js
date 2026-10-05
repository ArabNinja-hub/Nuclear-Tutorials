/* ============================================================
   NUCLEAR TUTORIALS — Application server

   Serves the static front end and the JSON API from one origin,
   and creates + seeds the SQLite database on first start.

     node server/index.js        →  http://localhost:8000

   Configuration (environment variables):
     PORT                port to listen on (default 8000)
     HOST                interface to bind (default 0.0.0.0)
     NT_ADMIN_PASSWORD   first-run administrator password
     NT_DATA_DIR         folder for the database file
     NT_SEED             "off" to skip first-run content seeding
   ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");
var http = require("http");
var url = require("url");
var api = require("./api");
var db = require("./db");
var seed = require("./seed");

var ROOT = path.resolve(__dirname, "..");
var PORT = parseInt(process.env.PORT, 10) || 8000;
var HOST = process.env.HOST || "0.0.0.0";

var MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

var CACHEABLE = [".css", ".js", ".woff2", ".woff", ".jpg", ".jpeg", ".png", ".webp", ".svg", ".ico"];

/* Files that must never be served, even if they are inside the project. */
var BLOCKED = ["/server", "/.git", "/package.json", "/package-lock.json", "/node_modules", "/.gitignore"];

function isBlocked(pathname) {
  return BLOCKED.some(function (prefix) {
    return pathname === prefix || pathname.indexOf(prefix + "/") === 0;
  });
}

function sendFile(res, filePath, stat) {
  var extension = path.extname(filePath).toLowerCase();
  var headers = {
    "Content-Type": MIME[extension] || "application/octet-stream",
    "Content-Length": stat.size,
    "X-Content-Type-Options": "nosniff"
  };
  if (CACHEABLE.indexOf(extension) !== -1) headers["Cache-Control"] = "public, max-age=3600";
  else headers["Cache-Control"] = "no-cache";
  res.writeHead(200, headers);
  if (res.req && res.req.method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
}

function serveStatic(req, res, pathname) {
  if (isBlocked(pathname)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  var decoded;
  try { decoded = decodeURIComponent(pathname); } catch (error) { decoded = pathname; }
  var target = decoded === "/" ? "/index.html" : decoded;
  if (target.endsWith("/")) target += "index.html";
  var filePath = path.join(ROOT, target);
  if (filePath.indexOf(ROOT) !== 0) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Forbidden");
  }
  fs.stat(filePath, function (error, stat) {
    if (!error && stat.isDirectory()) {
      var indexFile = path.join(filePath, "index.html");
      return fs.stat(indexFile, function (innerError, innerStat) {
        if (innerError) return notFound(req, res, target);
        sendFile(res, indexFile, innerStat);
      });
    }
    if (error || !stat.isFile()) {
      /* Friendly fallback: serve a matching .html file without the extension. */
      if (!path.extname(filePath) && fs.existsSync(filePath + ".html")) {
        return sendFile(res, filePath + ".html", fs.statSync(filePath + ".html"));
      }
      return notFound(req, res, target);
    }
    sendFile(res, filePath, stat);
  });
}

function notFound(req, res, target) {
  var page = fs.existsSync(path.join(ROOT, "404.html")) ? path.join(ROOT, "404.html") : null;
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
  if (page && req.method !== "HEAD") {
    res.end(fs.readFileSync(page, "utf8").replace("{{path}}", target));
    return;
  }
  res.end("<h1>404</h1><p>That page does not exist on Nuclear Tutorials.</p>");
}

var server = http.createServer(function (req, res) {
  var parsed = url.parse(req.url, true);
  var pathname = parsed.pathname || "/";

  if (pathname.indexOf("/api/") === 0 || pathname === "/api") {
    api.handle(req, res, pathname, new URLSearchParams(parsed.query)).then(function (handled) {
      if (!handled) {
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "Unknown API endpoint: " + pathname }));
      }
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  serveStatic(req, res, pathname);
});

function start() {
  db.connect();
  db.ensureDefaultSettings();
  var admin = db.ensureAdmin();
  if (admin.created) {
    console.log("[setup] Administrator account created. Password: " + admin.password);
    console.log("[setup] Change it from Admin → Settings, or set NT_ADMIN_PASSWORD before first start.");
  }
  if (process.env.NT_SEED !== "off") {
    var result = seed.seed();
    if (result.seeded) {
      console.log("[seed] Added " + result.universities + " institutions, " + result.courses + " courses and " + result.videos + " video lessons.");
    }
  }
  server.listen(PORT, HOST, function () {
    console.log("Nuclear Tutorials running at http://localhost:" + PORT);
    console.log("Database: " + db.DB_FILE);
    console.log("Admin: http://localhost:" + PORT + "/admin/login.html");
  });
}

if (require.main === module) start();

module.exports = { server: server, start: start };
