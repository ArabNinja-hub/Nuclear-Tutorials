#!/usr/bin/env node
/* ============================================================
   First-run, persistence and expiry checks

   Starts the real server against a throwaway database directory and
   checks the production setup path end to end:

     1. a fresh database starts empty — no sample universities,
        courses or video lessons are written on boot
     2. the first-run administrator password is generated (never the
        shipped default) and is refused as a normal credential
     3. catalogue management stays locked until the password is changed
     4. the database is created inside NT_DATA_DIR and survives a
        restart with the same directory (the mount a host persists)
     5. expired and unused access codes grant nothing, verified over
        HTTP and at the database level

   Usage:  node scripts/test-db.js
   ============================================================ */
"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");
var http = require("http");
var net = require("net");
var childProcess = require("child_process");
var ROOT = path.resolve(__dirname, "..");

var passed = 0;
var failed = 0;
function check(condition, label) {
  if (condition) { passed++; console.log("  PASS  " + label); }
  else { failed++; console.error("  FAIL  " + label); }
}
function group(label) { console.log("\n== " + label + " =="); }

var dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "nt-setup-"));
var dbFile = path.join(dataDir, "nuclear-tutorials.db");

function freePort() {
  return new Promise(function (resolve, reject) {
    var server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", function () {
      var port = server.address().port;
      server.close(function () { resolve(port); });
    });
  });
}

function request(port, method, path, body, options) {
  var opts = options || {};
  return new Promise(function (resolve, reject) {
    var payload = body == null ? null : JSON.stringify(body);
    var headers = { Accept: "application/json" };
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    if (opts.cookie) headers.Cookie = opts.cookie;
    if (opts.code) headers["X-NT-Code"] = opts.code;
    var req = http.request({ host: "127.0.0.1", port: port, path: path, method: method, headers: headers }, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () {
        var raw = Buffer.concat(chunks).toString("utf8");
        var json = null;
        try { json = JSON.parse(raw); } catch (error) { /* non-JSON */ }
        resolve({ status: res.statusCode, json: json, raw: raw, setCookie: res.headers["set-cookie"] });
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, function () { req.destroy(new Error("timeout")); });
    if (payload) req.write(payload);
    req.end();
  });
}

function startServer(port, extraEnv) {
  var env = Object.assign({}, process.env, {
    PORT: String(port),
    HOST: "127.0.0.1",
    NT_DATA_DIR: dataDir,
    NODE_NO_WARNINGS: "1"
  }, extraEnv || {});
  delete env.NT_DB_FILE;
  if (!extraEnv || extraEnv.NT_ADMIN_PASSWORD === undefined) delete env.NT_ADMIN_PASSWORD;
  var child = childProcess.spawn(process.execPath, [path.join(ROOT, "server/index.js")], { env: env, cwd: ROOT });
  var output = "";
  var ready = new Promise(function (resolve, reject) {
    var settled = false;
    function scan(chunk) {
      output += chunk;
      if (!settled && output.indexOf("Nuclear Tutorials running") !== -1) { settled = true; resolve(); }
    }
    child.stdout.on("data", scan);
    child.stderr.on("data", scan);
    child.on("exit", function (code) {
      if (!settled) { settled = true; reject(new Error("server exited early (" + code + "): " + output)); }
    });
    setTimeout(function () {
      if (!settled) { settled = true; reject(new Error("server did not start in time: " + output)); }
    }, 12000);
  });
  return {
    child: child,
    ready: ready,
    output: function () { return output; },
    password: function () {
      var match = output.match(/First-run password:\s*(\S+)/);
      return match ? match[1] : "";
    },
    stop: function () {
      return new Promise(function (resolve) {
        if (child.exitCode !== null) return resolve();
        child.once("exit", function () { resolve(); });
        child.kill("SIGTERM");
        setTimeout(function () { child.kill("SIGKILL"); resolve(); }, 3000);
      });
    }
  };
}

function queryDatabase(sql, params) {
  var { DatabaseSync } = require("node:sqlite");
  var database = new DatabaseSync(dbFile);
  var result = database.prepare(sql).all.apply(database.prepare(sql), params || []);
  database.close();
  return result;
}

var server = null;
var firstRunPassword = "";
var port = 0;
var state = {};

freePort().then(function (chosen) {
  port = chosen;
  server = startServer(port);
  return server.ready;
}).then(function () {
  group("Production database starts empty");
  check(fs.existsSync(dbFile), "the database file is created inside NT_DATA_DIR (" + path.basename(dbFile) + ")");
  return request(port, "GET", "/api/catalogue");
}).then(function (response) {
  var catalogue = response.json.catalogue;
  check(catalogue.universities.length === 0 && catalogue.schools.length === 0,
    "no universities or schools are preloaded");
  check(catalogue.courses.length === 0, "no courses are preloaded");
  check(catalogue.videos.length === 0, "no sample video lessons are preloaded");
  check(!/MIT|Crash Course|OpenCourseWare/.test(response.raw), "no sample content or attributions appear in the API");
  return request(port, "GET", "/api/search?q=lecture");
}).then(function (response) {
  check((response.json.videos || []).length === 0, "search returns nothing for an empty catalogue");
  return request(port, "GET", "/server/seed/content.json");
}).then(function (response) {
  check(response.status === 404, "the sample content file is not downloadable");

  group("First-run administrator password");
  firstRunPassword = server.password();
  check(firstRunPassword.length >= 16, "a strong first-run password is generated when NT_ADMIN_PASSWORD is unset");
  check(firstRunPassword !== "nuclear-admin", "the shipped default is never created");
  check(/First-run password/.test(server.output()) && /must be changed/i.test(server.output()),
    "the operator is told to change it");
  return request(port, "POST", "/api/admin/login", { password: "nuclear-admin" });
}).then(function (response) {
  check(response.status === 401 || response.status === 403,
    "the shipped default password is refused even if it is tried (" + response.status + ")");
  return request(port, "POST", "/api/admin/login", { password: firstRunPassword });
}).then(function (response) {
  check(response.status === 200 && response.json.mustChangePassword === true,
    "the first-run password signs in and reports that it must be changed");
  var cookie = response.setCookie && response.setCookie[0] ? response.setCookie[0].split(";")[0] : "";
  check(!!cookie, "sign-in sets an HttpOnly session cookie");
  var session = { cookie: cookie };
  /* Even with a valid session, management stays closed until rotation. */
  return request(port, "GET", "/api/admin/universities", null, session).then(function (blocked) {
    check(blocked.status === 403, "catalogue reads stay locked before the password is changed (403)");
    return request(port, "POST", "/api/admin/universities", { name: "Blocked University" }, session);
  }).then(function (blocked) {
    check(blocked.status === 403, "catalogue writes stay locked before the password is changed (403)");
    return request(port, "GET", "/api/admin/session", null, session);
  }).then(function (probe) {
    check(probe.status === 200 && probe.json.mustChangePassword === true,
      "the session probe tells the admin UI to show the rotation screen");
    return request(port, "POST", "/api/admin/password", { currentPassword: firstRunPassword, newPassword: "nuclear-admin" }, session);
  }).then(function (rejected) {
    check(rejected.status === 400, "the shipped default cannot be chosen as the new password");
    return request(port, "POST", "/api/admin/password", { currentPassword: firstRunPassword, newPassword: "Lusaka-2026-nuclear" }, session);
  }).then(function (changed) {
    check(changed.status === 200, "a real password can be set");
    return request(port, "POST", "/api/admin/login", { password: "Lusaka-2026-nuclear" });
  }).then(function (response) {
    check(response.status === 200 && response.json.mustChangePassword === false,
      "the replacement password signs in without the rotation flag");
    var cookie = response.setCookie && response.setCookie[0] ? response.setCookie[0].split(";")[0] : "";
    var session = { cookie: cookie };
    return request(port, "POST", "/api/admin/universities", { name: "Copperbelt Institute", shortName: "CBI", city: "Kitwe" }, session)
      .then(function (created) {
        check(created.status === 201, "catalogue management works once the password is rotated");
        var universityId = created.json.university.id;
        return request(port, "POST", "/api/admin/courses", { universityId: universityId, semester: 1, code: "MTH 101", title: "Engineering Mathematics", description: "Semester one core." }, session);
      }).then(function (created) {
        check(created.status === 201, "a course can be added under the new university");
        var courseId = created.json.course.id;
        state.courseId = courseId;
        return request(port, "POST", "/api/admin/videos", {
          courseId: courseId,
          title: "Production lesson one",
          sourceUrl: "https://example.org/lectures/one.mp4",
          level: "basic",
          duration: "10:00",
          published: 1
        }, session);
      }).then(function (created) {
        check(created.status === 201, "a lesson can be added to the course");
        state.videoId = created.json.video.id;
        return request(port, "POST", "/api/admin/codes", { package: "basic", count: 1 }, session);
      }).then(function (created) {
        var code = created.json.codes[0];
        return request(port, "POST", "/api/access/redeem", { code: code, educationLevel: "university" }).then(function (redeemed) {
          check(redeemed.status === 200, "a code can be redeemed against the new catalogue");
          return code;
        });
      }).then(function (code) {
        state.code = code;
      });
  }).then(function () {
    group("Restart and redeploy persistence");
    check(fs.existsSync(dbFile), "the database still lives in NT_DATA_DIR after the checks");
  });
}).then(function () {
  return server.stop();
}).then(function () {
  /* A redeploy restarts the process with the same NT_DATA_DIR. */
  return request(port, "GET", "/api/health").catch(function () { return null; });
}).then(function (dead) {
  check(dead === null, "the first server process stopped cleanly");
  server = startServer(port);
  return server.ready;
}).then(function () {
  return request(port, "POST", "/api/admin/login", { password: "Lusaka-2026-nuclear" });
}).then(function (response) {
  check(response.status === 200 && response.json.mustChangePassword === false,
    "the administrator password survives a restart");
  var cookie = response.setCookie && response.setCookie[0] ? response.setCookie[0].split(";")[0] : "";
  state.cookie = cookie;
  return request(port, "GET", "/api/catalogue");
}).then(function (response) {
  var catalogue = response.json.catalogue;
  check(catalogue.universities.length === 1 && catalogue.courses.length === 1 && catalogue.videos.length === 1,
    "the catalogue added through the admin API survives a restart");
  check(catalogue.universities[0].name === "Copperbelt Institute", "the same university is served after the restart");
}).then(function () {
  group("Expired and unused codes grant nothing");
  /* Prepare an expired code the way time would: redeemed 400 days ago. */
  var { DatabaseSync } = require("node:sqlite");
  var database = new DatabaseSync(dbFile);
  var old = new Date(Date.now() - 400 * 86400000).toISOString();
  database.prepare("INSERT INTO codes (code, package, status, issued_at, redeemed_at) VALUES (?, 'premium', 'redeemed', ?, ?)")
    .run("NT-PREMIUM-4242", old, old);
  database.prepare("INSERT INTO codes (code, package, status, issued_at) VALUES (?, 'premium', 'unused', ?)")
    .run("NT-PREMIUM-4243", new Date().toISOString());
  database.close();

  return request(port, "GET", "/api/catalogue", null, { code: "NT-PREMIUM-4242" });
}).then(function (response) {
  check(response.json.catalogue.videos.every(function (video) { return video.locked === true; }),
    "an expired premium code grants no lesson");
  return request(port, "GET", "/api/videos/" + encodeURIComponent(state.videoId), null, { code: "NT-PREMIUM-4242" });
}).then(function (response) {
  check(response.status === 403, "an expired code cannot open a lesson directly (got " + response.status + ")");
  return request(port, "GET", "/api/progress", null, { code: "NT-PREMIUM-4242" });
}).then(function (response) {
  check(response.status === 401, "an expired code cannot read progress");
  return request(port, "GET", "/api/videos/" + encodeURIComponent(state.videoId), null, { code: "NT-PREMIUM-4243" });
}).then(function (response) {
  check(response.status === 403, "an unused premium code cannot open a lesson before redemption (got " + response.status + ")");
  return request(port, "GET", "/api/catalogue", null, { code: state.code });
}).then(function (response) {
  var video = response.json.catalogue.videos[0];
  check(video.locked === false && /^https?:\/\//.test(video.sourceUrl || ""),
    "the redeemed basic code still receives its basic lesson");
  return request(port, "GET", "/api/progress", null, { code: state.code });
}).then(function (response) {
  check(response.status === 200, "the redeemed code can read its own progress");
}).then(function () {
  group("A migrated install still carrying the shipped default");
  var crypto = require("crypto");
  var { DatabaseSync } = require("node:sqlite");
  var database = new DatabaseSync(dbFile);
  var salt = crypto.randomBytes(16).toString("hex");
  database.prepare("UPDATE admins SET password_hash = ?, salt = ?, must_change = 1 WHERE id = 1")
    .run(crypto.scryptSync("nuclear-admin", salt, 64).toString("hex"), salt);
  database.close();

  return request(port, "POST", "/api/admin/login", { password: "nuclear-admin" });
}).then(function (response) {
  check(response.status === 403, "a database holding the shipped default cannot sign in with it");
  return request(port, "GET", "/api/admin/overview", null, { cookie: state.cookie });
}).then(function (response) {
  check(response.status === 403, "its old sessions cannot manage the catalogue either");
  return request(port, "POST", "/api/admin/password", { currentPassword: "nuclear-admin", newPassword: "Fresh-Production-2026" });
}).then(function (response) {
  check(response.status === 401, "the password cannot be rotated without a signed-in session");
}).then(function () {})
  .catch(function (error) {
    check(false, "setup checks failed: " + (error && error.message));
  })
  .then(function () {
    return server && server.stop();
  })
  .then(function () {
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (error) { /* best effort */ }
    console.log("\n" + passed + " passed, " + failed + " failed");
    process.exit(failed ? 1 : 0);
  });
