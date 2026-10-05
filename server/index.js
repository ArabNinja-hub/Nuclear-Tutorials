"use strict";
/* ============================================================
   NUCLEAR TUTORIALS — Application server
   ------------------------------------------------------------
   One process serves both halves of the platform:

     • the existing static site (HTML/CSS/JS, unchanged behaviour)
     • the JSON content API for universities, semesters, courses
       and video lessons (server/database backed, shared by every
       student device)
     • a session-protected /admin/ area

   Run with:  npm start        (or: node server/index.js)
   No npm packages are required — Node's built-in modules only.
   ============================================================ */

/* Keep the experimental node:sqlite notice out of the startup log. */
process.removeAllListeners("warning");
process.on("warning", function (warning) {
  if (warning.name !== "ExperimentalWarning") console.warn(warning);
});

var http = require("node:http");
var path = require("node:path");

var ROOT = path.resolve(__dirname, "..");
var HOST = process.env.NT_HOST || process.env.HOST || "0.0.0.0";
var PORT = Number(process.env.PORT || process.env.NT_PORT || 8000);

function requireSqlite() {
  try {
    require("node:sqlite");
    return true;
  } catch (error) {
    console.error("\nNuclear Tutorials needs Node.js 22.5 or newer for the built-in SQLite module.");
    console.error("Current version: " + process.version);
    console.error("Install a newer Node.js, then run `npm start` again.\n");
    return false;
  }
}

if (!requireSqlite()) process.exit(1);

var db = require("./db");
var auth = require("./auth");
var api = require("./api");
var staticServer = require("./static");

/* ---------------------------- admin gate ----------------------------
   Admin pages are protected twice: here at the HTTP layer and again by
   the session check inside every admin API request. The sign-in page
   itself stays reachable, otherwise nobody could log in. */
function isAdminPage(pathname) {
  return /^\/admin\/.*\.html?$/.test(pathname) && !/^\/admin\/login\.html?$/.test(pathname);
}

function redirect(res, location) {
  res.writeHead(302, Object.assign(staticServer.securityHeaders(), { Location: location, "Content-Length": 0 }));
  res.end();
}

function notFound(res, pathname) {
  var isApi = pathname.indexOf("/api/") === 0;
  if (isApi) {
    res.writeHead(404, Object.assign(staticServer.securityHeaders(), {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }));
    res.end(JSON.stringify({ error: "not-found", message: "Unknown endpoint." }));
    return;
  }
  var body = Buffer.from(
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Page not found — Nuclear Tutorials</title>' +
    '<link rel="icon" type="image/jpeg" href="/assets/img/logo.jpg">' +
    '<link rel="stylesheet" href="/assets/css/main.css"></head>' +
    '<body><main><section class="section-body"><div class="container">' +
    '<div class="card lesson-notice"><span class="eyebrow">Error 404</span>' +
    '<h1>That page does not exist.</h1>' +
    '<p>The link may be out of date. Start from the home page or browse universities to find your video lessons.</p>' +
    '<div class="lesson-notice-actions"><a class="btn btn-primary" href="/index.html">Go to home page</a>' +
    '<a class="btn btn-secondary" href="/universities.html">Browse universities</a></div></div>' +
    '</div></section></main></body></html>',
    "utf8"
  );
  res.writeHead(404, Object.assign(staticServer.securityHeaders(), {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-cache"
  }));
  res.end(body);
}

var server = http.createServer(function (req, res) {
  var url;
  try {
    url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  } catch (error) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }
  var pathname = url.pathname;

  if (pathname === "/api" || pathname.indexOf("/api/") === 0) {
    api.handle(req, res, url).catch(function (error) {
      console.error("[server] unhandled API error: " + (error && error.stack || error));
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "server-error", message: "The content service hit an unexpected error." }));
      }
    });
    return;
  }

  if (pathname === "/admin" || pathname === "/admin/") {
    redirect(res, "/admin/index.html");
    return;
  }

  if (isAdminPage(pathname)) {
    var token = auth.parseCookies(req)[auth.cookieName()] || "";
    if (!auth.sessionAdmin(token)) {
      redirect(res, "/admin/login.html?next=" + encodeURIComponent(pathname + url.search));
      return;
    }
  }

  if (staticServer.serve(req, res, url, ROOT)) return;
  notFound(res, pathname);
});

server.on("clientError", function (error, socket) {
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

/* ---------------------------- startup ---------------------------- */

function banner(firstAdmin, port) {
  if (process.env.NT_QUIET === "1") return;
  var line = "─".repeat(58);
  console.log("\n" + line);
  console.log("  Nuclear Tutorials — video learning platform");
  console.log(line);
  console.log("  Local     http://localhost:" + port);
  console.log("  Network   http://" + localAddress() + ":" + port);
  console.log("  Public    /  ·  Universities  /universities.html");
  console.log("  Admin     /admin/login.html");
  console.log("  Database  " + path.relative(ROOT, db.DB_FILE));
  console.log("  API       /api/universities · /api/courses · /api/videos");
  if (firstAdmin) {
    console.log(line);
    console.log("  First administrator account created");
    console.log("    email:    " + firstAdmin.email);
    console.log("    password: " + firstAdmin.password);
    console.log("  Change it after signing in: Admin → Settings → Admin sign-in.");
    if (firstAdmin.fileError) console.log("  (Could not write data/first-run-admin.txt: " + firstAdmin.fileError + ")");
  }
  console.log(line + "\n");
}

function localAddress() {
  try {
    var os = require("node:os");
    var interfaces = os.networkInterfaces();
    var names = Object.keys(interfaces);
    for (var i = 0; i < names.length; i++) {
      var entries = interfaces[names[i]] || [];
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].family === "IPv4" && !entries[j].internal) return entries[j].address;
      }
    }
  } catch (error) { /* fall through */ }
  return "127.0.0.1";
}

/* Resolves with the bound port, so PORT=0 (used by scripts/test-flows.js)
   works and the banner can show the real address. */
function start() {
  return new Promise(function (resolve, reject) {
    db.connect();
    auth.purgeExpiredSessions();
    var firstAdmin = auth.ensureFirstAdmin();
    server.once("error", function (error) {
      if (error.code === "EADDRINUSE") {
        console.error("\nPort " + PORT + " is already in use. Start with a different port, for example:");
        console.error("  PORT=8080 npm start\n");
      }
      reject(error);
    });
    server.listen(PORT, HOST, function () {
      var port = server.address().port;
      banner(firstAdmin, port);
      resolve({ port: port, host: HOST, firstAdmin: firstAdmin });
    });
  });
}

function shutdown(signal) {
  console.log("\n" + signal + " received — closing the content database.");
  server.close(function () {
    try { db.close(); } catch (error) { /* already closed */ }
    process.exit(0);
  });
  setTimeout(function () { process.exit(0); }, 3000).unref();
}

process.on("SIGINT", function () { shutdown("SIGINT"); });
process.on("SIGTERM", function () { shutdown("SIGTERM"); });

if (require.main === module) {
  start().catch(function () { process.exit(1); });
}

module.exports = { server: server, start: start, ROOT: ROOT };
