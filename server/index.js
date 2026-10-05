/* ============================================================
   NUCLEAR TUTORIALS — Application server

   Serves the static front end and the JSON API from one origin,
   and creates + seeds the SQLite database on first start.

     node server/index.js        →  http://localhost:8000

   The catalogue starts empty: administrators add universities, courses
   and video lessons through the admin area, or load the development
   sample with `npm run seed:demo`.

   Configuration (environment variables):
     PORT                port to listen on (default 8000)
     HOST                interface to bind (default 0.0.0.0)
     NT_DATA_DIR         persistent folder for the database (required in
                         production — see render.yaml)
     NT_ADMIN_PASSWORD   first-run administrator password (a random one is
                         printed once if this is not set)
     NT_REQUIRE_PERSISTENT_STORAGE  "1" to refuse to start when the database
                         would live inside the deploy directory
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
var BLOCKED = [
  "/server", "/scripts", "/.git", "/package.json", "/package-lock.json",
  "/node_modules", "/.gitignore", "/.env"
];

/* Deployment and documentation files that make no sense on a live site and
   expose the project layout: only served while developing locally. */
var BLOCKED_IN_PRODUCTION = ["/README.md", "/render.yaml", "/.env.example", "/.env.production"];

var IS_PRODUCTION = String(process.env.NODE_ENV || "").toLowerCase() === "production";

function isBlocked(pathname) {
  var list = IS_PRODUCTION ? BLOCKED.concat(BLOCKED_IN_PRODUCTION) : BLOCKED;
  return list.some(function (prefix) {
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

/* A database inside the deploy directory is wiped by redeploys, so the
   platform refuses to start in that situation when asked to be strict. */
function storageWarning() {
  if (process.env.NT_DATA_DIR || process.env.NT_DB_FILE) return null;
  var deployed = !!(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.DYNO || process.env.FLY_APP_NAME);
  if (!deployed) return null;
  var message = "The database is inside the deploy directory (" + db.DB_FILE + "), so it is erased on every " +
    "redeploy. Mount a persistent disk and set NT_DATA_DIR to its mount path (see render.yaml).";
  if (process.env.NT_REQUIRE_PERSISTENT_STORAGE === "1") return message;
  return "warning: " + message;
}

function start() {
  /* The storage guard runs before the database is opened, so a production
     process that is misconfigured can never touch (or migrate) a database
     that happens to sit inside the deploy directory. */
  var warning = storageWarning();
  if (warning) {
    if (warning.indexOf("warning:") === 0) {
      console.warn("[storage] " + warning.replace(/^warning:\s*/, ""));
    } else {
      console.error("[storage] " + warning);
      process.exit(1);
      return;
    }
  }

  db.connect();
  db.ensureDefaultSettings();

  var admin = db.ensureAdmin();
  if (admin.created) {
    console.log("[setup] Administrator account created. First-run password: " + admin.password);
    if (admin.generated) {
      console.log("[setup] This password is shown once and was not chosen by a human — it is stored in memory only.");
    }
    console.log("[setup] The administrator password must be changed in Admin → Settings before the admin " +
      "API accepts any other request.");
  } else if (db.adminMustChangePassword()) {
    console.log("[setup] The administrator password still has to be changed in Admin → Settings.");
  }

  var catalogue = seed.summary();
  if (catalogue.universities === 0) {
    console.log("[catalogue] The catalogue is empty. Add universities, courses and video lessons at /admin/login.html.");
  } else if (catalogue.catalogueSource === "sample") {
    var message = "[catalogue] Development sample content is loaded (" + catalogue.universities + " institutions, " +
      catalogue.courses + " courses, " + catalogue.videos + " lessons). Run `npm run seed:clear` before going live.";
    /* A production database should never hold sample content: say so loudly. */
    if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
      console.warn("[catalogue] WARNING: production is serving development sample content. Empty it with " +
        "`npm run seed:clear` and add the real catalogue in the admin area.");
    } else {
      console.log(message);
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
