/* ============================================================
   NUCLEAR TUTORIALS — Application server

   Serves the static front end and the JSON API from one origin,
   and creates + migrates the SQLite database on first start. The
   catalogue starts empty: administrators add universities, courses
   and video lessons through the admin area, or load the development
   sample with `npm run seed:demo`.

     node server/index.js        →  http://localhost:8080

   Production (Railway, Render and similar):
     • PORT is the port the platform assigns; HOST defaults to 0.0.0.0
       so the platform's proxy can reach the server.
     • The database must sit on a persistent volume. On Railway a volume
       mounted at /var/data is used automatically through
       RAILWAY_VOLUME_MOUNT_PATH, or explicitly with NT_DATA_DIR=/var/data
       (see railway.json and render.yaml).

   Configuration (environment variables):
     PORT                port to listen on (default 8080)
     HOST                interface to bind (default 0.0.0.0)
     NT_DATA_DIR         persistent folder for the database (required in
                         production — see railway.json / render.yaml)
     NT_DB_FILE          full path to the database file (overrides NT_DATA_DIR)
     NT_ADMIN_PASSWORD   first-run administrator password (a random one is
                         printed once if this is not set)
     NT_SESSION_DAYS     administrator session lifetime (default 7)
     NT_COOKIE_SECURE    force the Secure cookie flag: 1 always, 0 never,
                         unset follows the request/proxy protocol
     NT_ALLOWED_ORIGINS  comma-separated origins allowed to call the API
                         cross-origin (same-origin by default)
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
var platform = require("./platform");

var ROOT = path.resolve(__dirname, "..");
var PORT = parseInt(process.env.PORT, 10) || 8080;
var DEFAULT_HOST = "0.0.0.0";
var HOST = process.env.HOST || DEFAULT_HOST;

/* Platforms such as Railway do not always set NODE_ENV. Leaving it out must
   never leave a deployment running with development behaviour (development
   files on the website, sample content, relaxed storage rules), so a
   deployed host without NODE_ENV is treated as production. */
if (!process.env.NODE_ENV && platform.isDeployed()) {
  process.env.NODE_ENV = "production";
  console.log("[config] NODE_ENV was not set on " + platform.deployedPlatform() +
    " — running with NODE_ENV=production.");
}

var IS_PRODUCTION = platform.isProduction();

/* A production listener must accept connections from the platform's proxy.
   HOST stays configurable, but a loopback-only bind on a deployed host would
   be unreachable, so it is corrected with a warning. */
if (platform.isLoopback(HOST) && (IS_PRODUCTION || platform.isDeployed())) {
  console.warn("[http] HOST=" + HOST + " only accepts connections from inside this container, so " +
    platform.deployedPlatform() + " could not reach the server. Binding to " + DEFAULT_HOST + " instead.");
  HOST = DEFAULT_HOST;
}

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
var BLOCKED_IN_PRODUCTION = [
  "/README.md", "/render.yaml", "/railway.json", "/.env.example", "/.env.production"
];

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
   platform refuses to start in that situation when asked to be strict.
   A configured path (NT_DATA_DIR, NT_DB_FILE) or a mounted Railway volume
   (RAILWAY_VOLUME_MOUNT_PATH) satisfies the requirement. */
function storageWarning() {
  if (db.PERSISTENT_STORAGE_CONFIGURED) return null;
  if (!platform.isDeployed()) return null;
  var message = "The database is inside the deploy directory (" + db.DB_FILE + "), so it is erased on every " +
    "redeploy. Mount a persistent disk and set NT_DATA_DIR to its mount path (Railway: mount a volume at " +
    "/var/data and set NT_DATA_DIR=/var/data; see railway.json and render.yaml).";
  if (process.env.NT_REQUIRE_PERSISTENT_STORAGE === "1") return message;
  return "warning: " + message;
}

/* SIGTERM (Railway, Render and friends send it on every redeploy) and
   Ctrl+C close the listener first and then checkpoint + close SQLite, so
   the volume holds one consistent database file. */
var shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[http] " + signal + " received — stopping the server and closing the database.");
  var finished = function () {
    db.close();
    process.exit(0);
  };
  server.close(finished);
  /* Keep-alive connections must not hold a redeploy open. */
  if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
  var force = setTimeout(function () {
    db.close();
    process.exit(0);
  }, 5000);
  force.unref();
}
process.on("SIGTERM", function () { shutdown("SIGTERM"); });
process.on("SIGINT", function () { shutdown("SIGINT"); });

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
    if (IS_PRODUCTION) {
      console.warn("[catalogue] WARNING: production is serving development sample content. Empty it with " +
        "`npm run seed:clear` and add the real catalogue in the admin area.");
    } else {
      console.log(message);
    }
  }

  server.listen(PORT, HOST, function () {
    console.log("Nuclear Tutorials running at http://localhost:" + PORT);
    console.log("[http] Listening on " + HOST + ":" + PORT +
      (process.env.PORT ? " (PORT from the platform)" : " (default port)") +
      " · " + (IS_PRODUCTION ? "NODE_ENV=production" : "development mode"));
    console.log("Database: " + db.DB_FILE +
      (db.PERSISTENT_STORAGE_CONFIGURED ? " (persistent)" : " (local development folder)"));
    console.log("Admin: http://localhost:" + PORT + "/admin/login.html");
  });

  /* A port that is already taken must fail loudly: the platform then shows
     the real reason instead of a container that never becomes healthy. */
  server.on("error", function (error) {
    console.error("[http] Could not listen on " + HOST + ":" + PORT + " — " + error.message);
    process.exit(1);
  });
}

if (require.main === module) start();

module.exports = { server: server, start: start };
