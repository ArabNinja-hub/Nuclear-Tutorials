#!/usr/bin/env node
/* ============================================================
   Platform checks

   Structural, accessibility, and architecture checks that are
   independent of the browser: files, page shells, script wiring,
   icon library, CSS, content rules and the video-only policy.

   With BASE=http://host:port it also checks the running server:
   every page and asset, the public API, the admin guard, and the
   live student/admin flows (scripts/check-flows.js).
   ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");
var http = require("http");
var https = require("https");
var childProcess = require("child_process");
var apiModule = require("../server/api");
var ROOT = path.resolve(__dirname, "..");
var passed = 0;
var failed = 0;

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function check(condition, label) {
  if (condition) { passed++; console.log("  PASS  " + label); }
  else { failed++; console.error("  FAIL  " + label); }
}
function group(label) { console.log("\n== " + label + " =="); }

var PUBLIC_PAGES = [
  "index.html", "about.html", "privacy-policy.html", "terms-and-conditions.html",
  "signup.html", "login.html", "learner-type.html",
  "courses.html", "course.html", "lesson.html", "library.html", "dashboard.html",
  "search.html", "profile.html", "pricing.html", "checkout.html", "access.html", "announcements.html"
];
var ADMIN_PAGES = [
  "admin/login.html", "admin/first-run.html", "admin/index.html", "admin/courses.html", "admin/lessons.html",
  "admin/codes.html", "admin/enquiries.html", "admin/announcements.html", "admin/packages.html", "admin/settings.html"
];
var SCRIPT_FILES = [
  "assets/js/icons.js", "assets/js/data.js", "assets/js/store.js", "assets/js/api.js",
  "assets/js/ui.js", "assets/js/app.js", "assets/js/hero-rotator.js", "assets/js/admin.js",
  "server/index.js", "server/db.js", "server/api.js", "server/seed.js", "server/platform.js",
  "scripts/check-platform.js", "scripts/smoke-render.js", "scripts/check-flows.js",
  "scripts/check-access.js", "scripts/test-db.js", "scripts/check-production.js",
  "scripts/version-assets.js"
];
var ASSETS = [
  "assets/css/fonts.css", "assets/css/main.css", "assets/css/admin.css", "assets/img/logo.jpg",
  "assets/fonts/inter-latin-400.woff2", "assets/fonts/manrope-latin-800.woff2"
];
var OPS_FILES = ["railway.json", "render.yaml", ".env.example", ".gitignore", "server/seed/content.json"];

function balancedCss(source) {
  var depth = 0;
  var quote = "";
  var comment = false;
  for (var i = 0; i < source.length; i++) {
    var c = source[i], next = source[i + 1];
    if (comment) {
      if (c === "*" && next === "/") { comment = false; i++; }
      continue;
    }
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === "/" && next === "*") { comment = true; i++; continue; }
    if (c === "\"" || c === "'") { quote = c; continue; }
    if (c === "{") depth++;
    if (c === "}" && --depth < 0) return false;
  }
  return depth === 0 && !quote && !comment;
}

/* ---------------- files and page shells ---------------- */

group("Files and page shells");
ASSETS.concat(SCRIPT_FILES).concat(OPS_FILES).forEach(function (file) { check(exists(file), file + " exists"); });
check(exists("package.json") && exists("README.md") && exists("server/seed/content.json"), "project metadata and content seed exist");

PUBLIC_PAGES.concat(ADMIN_PAGES).forEach(function (file) {
  if (!exists(file)) { check(false, file + " exists"); return; }
  var html = read(file);
  var inAdmin = file.indexOf("admin/") === 0;
  check(/<html lang="en">/.test(html), file + " declares its document language");
  check(/name="viewport"/.test(html), file + " has a responsive viewport");
  check(html.indexOf("main.css") !== -1 && html.indexOf("fonts.css") !== -1, file + " loads the typography and design system");
  check(/<main\b[^>]*id="main"/.test(html) || inAdmin, file + " exposes a skip-link target");
  if (inAdmin) {
    check(html.indexOf("admin.css") !== -1 && html.indexOf("admin.js") !== -1, file + " loads administration assets");
    check(html.indexOf('name="robots"') !== -1, file + " stays out of search engines");
  } else {
    check(html.indexOf("assets/js/api.js") !== -1, file + " loads the server API client");
    check(html.indexOf("assets/js/app.js") !== -1, file + " loads the public behaviour");
    check(html.indexOf("admin") === -1, file + " exposes no administration controls");
  }
});

var brokenLinks = [];
PUBLIC_PAGES.concat(ADMIN_PAGES).forEach(function (file) {
  var source = read(file);
  var refs = /\b(?:href|src)="([^"]+)"/g;
  var match;
  while ((match = refs.exec(source))) {
    var ref = match[1];
    if (!ref || /^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
    var target = ref.split(/[?#]/)[0];
    if (!target) continue;
    if (!fs.existsSync(path.resolve(ROOT, path.dirname(file), target))) brokenLinks.push(file + " → " + ref);
  }
});
check(brokenLinks.length === 0, "page and asset links resolve" + (brokenLinks.length ? ": " + brokenLinks.join(", ") : ""));

var cdnLinks = [];
PUBLIC_PAGES.concat(ADMIN_PAGES).forEach(function (file) {
  var source = read(file);
  if (/https?:\/\/(?:fonts\.|cdn\.|unpkg|cdnjs)/i.test(source)) cdnLinks.push(file);
});
check(cdnLinks.length === 0, "pages use self-hosted assets only" + (cdnLinks.length ? ": " + cdnLinks.join(", ") : ""));

SCRIPT_FILES.forEach(function (file) {
  var result = childProcess.spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
  check(result.status === 0, file + " parses" + (result.status === 0 ? "" : ": " + (result.stderr || result.stdout).trim()));
});

/* CSS and JavaScript are served with `max-age=3600`, so every page must ask for
   them with a current content hash (`assets/css/main.css?v=1f3c9a02`); otherwise
   a returning visitor keeps the old stylesheet for up to an hour after a fix.
   scripts/version-assets.js is the single source of truth and fixes the markers. */
var versionCheck = childProcess.spawnSync(process.execPath, [path.join(ROOT, "scripts/version-assets.js"), "--check"],
  { encoding: "utf8" });
check(versionCheck.status === 0, "every page requests its CSS and JavaScript with a current content-hash version" +
  (versionCheck.status === 0 ? "" : ": " + ((versionCheck.stderr || "") + (versionCheck.stdout || "")).trim().split("\n").slice(0, 3).join(" ")));

/* ---------------- icon library ---------------- */

group("Icon library");
var iconSource = read("assets/js/icons.js");
var iconKeys = (iconSource.match(/^\s*"([^"]+)":/gm) || []).map(function (entry) { return entry.match(/"([^"]+)"/)[1]; });
var iconReferences = [];
["assets/js/app.js", "assets/js/ui.js", "assets/js/admin.js", "assets/js/data.js"].forEach(function (file) {
  var source = read(file), match;
  var direct = /NT\.icon\(\s*["']([^"']+)[^)]*\)/g;
  while ((match = direct.exec(source))) iconReferences.push(match[1]);
  var properties = /\bicon\s*:\s*["']([^"']+)["']/g;
  while ((match = properties.exec(source))) iconReferences.push(match[1]);
  var choices = /ICON_CHOICES\s*=\s*\[([^\]]+)\]/.exec(source);
  if (choices) iconReferences = iconReferences.concat((choices[1].match(/"([^"]+)"/g) || []).map(function (entry) { return entry.slice(1, -1); }));
  var sheetLinks = /sheetLink\(\s*["'][^"']*["']\s*,\s*["']([^"']+)["']/g;
  while ((match = sheetLinks.exec(source))) iconReferences.push(match[1]);
  var dynamic = source.match(/icon:\s*NT\.pathwayIcon\([^)]*\)[^)]*\)/g);
  if (dynamic) iconReferences = iconReferences.concat(["graduation-cap", "book-open"]);
});
["check-circle", "circle-alert", "info", "lock", "unlock", "shield", "graduation-cap", "book-open", "calendar", "house"].forEach(function (name) {
  iconReferences.push(name);
});
var seedIcons = (read("server/seed/content.json").match(/"icon":\s*"([^"]+)"/g) || []).map(function (entry) {
  return entry.match(/"icon":\s*"([^"]+)"/)[1];
});
iconReferences = iconReferences.concat(seedIcons);
var missingIcons = iconReferences.filter(function (name, index) { return iconKeys.indexOf(name) === -1 && iconReferences.indexOf(name) === index; });
var unusedIcons = iconKeys.filter(function (name) { return iconReferences.indexOf(name) === -1; });
check(missingIcons.length === 0, "every referenced icon exists" + (missingIcons.length ? ": missing " + missingIcons.join(", ") : ""));
check(unusedIcons.length === 0, "the icon library has no dead entries" + (unusedIcons.length ? ": unused " + unusedIcons.join(", ") : ""));

/* ---------------- styles ---------------- */

group("Styles and typography");
var css = read("assets/css/main.css");
var adminCss = read("assets/css/admin.css");
var fontsCss = read("assets/css/fonts.css");
check(balancedCss(css), "public CSS braces, strings and comments are balanced");
check(balancedCss(adminCss), "admin CSS braces, strings and comments are balanced");
check(balancedCss(fontsCss), "font CSS is balanced");
check(/--font-display:\s*"Manrope"/.test(css), "headings use Manrope through a display token");
check(/--font:\s*"Inter"/.test(css), "body and UI copy use Inter");
check(fontsCss.indexOf("@font-face") !== -1 && fontsCss.indexOf("assets/fonts") === -1 && /\.\.\/fonts\/.*\.woff2/.test(fontsCss),
  "fonts.css serves self-hosted woff2 files");
var declaredFamilies = (css.match(/font-family:\s*([^;]+);/g) || []).map(function (entry) {
  return entry.replace(/font-family:\s*/, "").replace(/;\s*$/, "");
});
var namedFamilies = [];
declaredFamilies.forEach(function (entry) {
  (entry.match(/"([^"]+)"/g) || []).forEach(function (name) { namedFamilies.push(name.replace(/"/g, "")); });
});
check(namedFamilies.every(function (name) { return name === "Manrope" || name === "Inter"; }),
  "only Manrope (headings) and Inter (body) are named" + (namedFamilies.length ? ": " + Array.from(new Set(namedFamilies)).join(", ") : ""));
check(css.indexOf(".hero-home") !== -1 && css.indexOf(".university-card") !== -1 && css.indexOf(".video-card") !== -1 && css.indexOf(".semester-switch") !== -1,
  "hero, university, video and semester components are styled");
check(css.indexOf(".level-choice") !== -1 && css.indexOf(":focus-visible") !== -1, "level options and visible keyboard focus are styled");
check(css.indexOf("@media (max-width: 640px)") !== -1 && css.indexOf(".tier-strip { grid-template-columns: 1fr; }") !== -1,
  "the access breakdown adapts to small screens");
check(/@media \(max-width: 760px\)[\s\S]*?\.mobile-nav \{/.test(css), "a mobile navigation bar is provided below 760px");
check(css.indexOf("@media (prefers-reduced-motion: reduce)") !== -1, "reduced-motion preference is respected");
check(css.indexOf(".course-card-media") === -1 && css.indexOf(".popular-tag") === -1,
  "removed course artwork and popularity treatment have no styles");
check(adminCss.indexOf(".adm-stats") === -1 && adminCss.indexOf(".rev-bars") === -1 && adminCss.indexOf(".upload-zone") === -1,
  "admin styles exclude fake metrics and upload UI");
check(adminCss.indexOf(".adm-context") !== -1 && adminCss.indexOf(".adm-nav-link") !== -1,
  "the administration shell shows editing context and navigation");

/* ---------------- production readiness ---------------- */

group("Production readiness");
var serverIndex = read("server/index.js");
var serverSeed = read("server/seed.js");
var serverDb = read("server/db.js");
var serverApi = read("server/api.js");
var envExample = read(".env.example");
var gitignore = read(".gitignore");
var renderYaml = read("render.yaml");

check(serverIndex.indexOf("seed.loadDemo") === -1 && serverIndex.indexOf("seed.seed") === -1,
  "the server never loads sample content while starting");
check(serverSeed.indexOf("NT_ALLOW_DEMO_SEED") === -1 && /function deployedHost/.test(serverSeed) &&
  /if \(String\(process\.env\.NODE_ENV \|\| ""\)\.toLowerCase\(\) === "production"\) return false;/.test(serverSeed),
  "sample content is development-only: production and deployed hosts are refused with no override");
check(envExample.indexOf("NT_ALLOW_DEMO_SEED") === -1 && /development machine/i.test(envExample),
  "the environment example documents no way to load sample content in production");
check(read("README.md").indexOf("NT_ALLOW_DEMO_SEED") === -1,
  "the README documents no override for sample content in production");
check(serverSeed.indexOf("--clear") !== -1 && serverSeed.indexOf('catalogue_source') !== -1,
  "the catalogue can be emptied and its content source is recorded");
check(serverDb.indexOf("crypto.randomBytes(18)") !== -1 && serverDb.indexOf('"nuclear-admin"') === -1,
  "the first-run administrator password is randomly generated, never a shipped default");
check(/must_change/.test(serverDb) && /adminMustChangePassword/.test(serverDb),
  "the database stores whether the administrator password still has to be changed");
check((serverApi.match(/adminMustChangePassword/g) || []).length >= 3 && serverApi.indexOf("mustChangePassword") !== -1,
  "the API enforces the rotation flag and reports it to the admin UI");
check(serverApi.indexOf("DEFAULT_FIRST_RUN_PASSWORD") !== -1 && /cannot be used for normal use/.test(serverApi),
  "the shipped default password is refused as a production credential");
/* The bootstrap escape hatch: while the rotation is pending exactly one
   admin route (the password change) is served, and only to a signed-in
   administrator — never to the public. */
check(/FIRST_RUN_UNLOCK_PATH = "\/api\/admin\/password"/.test(serverApi),
  "the first-run lock exempts exactly one admin route: the authenticated password change");
check(serverApi.indexOf("body.confirmPassword") !== -1 && serverApi.indexOf("The two new passwords do not match.") !== -1,
  "the password change requires the current password, a new password and a confirmation");
check(serverApi.indexOf("mustChange: false") !== -1 && serverApi.indexOf("sessionCookie(req, session.token") !== -1,
  "a successful change clears the rotation flag and hands the browser a fresh session");

check(/localStorage/.test(gitignore) === false && /^\/\.env/m.test(gitignore) === false && /\.env\b/.test(gitignore),
  "local environment files are git-ignored");
check(gitignore.indexOf("server/data/") !== -1 && gitignore.indexOf("*.db") !== -1,
  "database files are git-ignored");
check(renderYaml.indexOf("NT_DATA_DIR") !== -1 && renderYaml.indexOf("/var/data") !== -1 && /disk:/.test(renderYaml) &&
  renderYaml.indexOf("mountPath: /var/data") !== -1,
  "render.yaml mounts a persistent disk and points the database at it");
check(renderYaml.indexOf("NT_REQUIRE_PERSISTENT_STORAGE") !== -1 && serverIndex.indexOf("NT_REQUIRE_PERSISTENT_STORAGE") !== -1 &&
  /process\.exit\(1\)/.test(serverIndex),
  "the server refuses to boot on a host without persistent storage");
check(envExample.indexOf("NT_DATA_DIR") !== -1 && envExample.indexOf("NT_ADMIN_PASSWORD") !== -1 &&
  envExample.indexOf("NT_REQUIRE_PERSISTENT_STORAGE") !== -1,
  ".env.example documents the production variables");
check(renderYaml.indexOf("sync: false") !== -1 && !/NT_ADMIN_PASSWORD\s*\n\s*value: \S/.test(renderYaml),
  "the administrator password is not stored in the deployment file");

/* Railway (railway.json) and the platform contract the app relies on. */
var railwayJson = read("railway.json");
check(railwayJson.indexOf('"startCommand": "npm start"') !== -1 &&
  railwayJson.indexOf('"healthcheckPath": "/health"') !== -1 &&
  railwayJson.indexOf('"restartPolicyType": "ON_FAILURE"') !== -1,
  "railway.json starts the production server, health-checks /health and keeps its restart policy");
check(!/"PORT"\s*:/.test(railwayJson) && railwayJson.indexOf("NT_PORT") === -1,
  "the deployment never pins PORT by hand — the platform assigns it");
/* /health must be answered before the API router and before the static file
   handler: that ordering is what keeps it free of SQLite, the administrator
   session, the catalogue and the front-end files. */
var healthAt = serverIndex.indexOf('pathname === "/health"');
check(healthAt !== -1 && serverIndex.indexOf('JSON.stringify({ ok: true })') !== -1 &&
  healthAt < serverIndex.indexOf("api.handle(") &&
  healthAt < serverIndex.lastIndexOf("serveStatic(req, res, pathname)"),
  'GET /health answers {"ok":true} ahead of the API router and the static files');
var staticStart = serverIndex.indexOf("function serveStatic");
var staticEnd = serverIndex.indexOf("function escapeHtml", staticStart);
var staticSource = serverIndex.slice(staticStart, staticEnd);
check(staticSource.indexOf("decodeURIComponent(pathname)") < staticSource.indexOf("isBlocked(decoded)") &&
  staticSource.indexOf("path.posix.normalize(decoded)") !== -1 &&
  serverIndex.indexOf("path.relative(root, filePath)") !== -1 && serverIndex.indexOf("fs.realpath(filePath") !== -1,
  "static paths are decoded before blocking and kept inside the real web root");
check(serverIndex.indexOf('segment.toLowerCase().indexOf(".env") === 0') !== -1,
  "environment files are blocked in every static-serving mode");

check((/process\.env\.PORT\s*\|\|\s*8080/.test(serverIndex) ||
  /parseInt\(process\.env\.PORT,\s*10\)\s*\|\|\s*8080/.test(serverIndex)) && /"0\.0\.0\.0"/.test(serverIndex),
  "the server listens on the platform's PORT (default 8080) and binds 0.0.0.0");
check(/function isLoopback/.test(read("server/platform.js")) && serverIndex.indexOf("platform.isLoopback(HOST)") !== -1,
  "a loopback-only bind on a deployed host is corrected instead of hiding the server");
check(serverDb.indexOf("RAILWAY_VOLUME_MOUNT_PATH") !== -1 && serverIndex.indexOf("db.PERSISTENT_STORAGE_CONFIGURED") !== -1,
  "the database follows a mounted Railway volume (RAILWAY_VOLUME_MOUNT_PATH)");
check(serverDb.indexOf('"nuclear-tutorials.db"') !== -1 && serverDb.indexOf("process.env.NT_DATA_DIR") !== -1 &&
  serverDb.indexOf("process.env.NT_DB_FILE") !== -1,
  "the database keeps the nuclear-tutorials.db name and takes its path from configuration");
check(serverApi.indexOf("x-forwarded-proto") !== -1 && serverApi.indexOf("; Secure") !== -1,
  "the administrator cookie is marked Secure behind the HTTPS proxy");
check(serverIndex.indexOf("SIGTERM") !== -1 && read("server/db.js").indexOf("function close") !== -1,
  "the server closes the database cleanly when the platform stops it (SIGTERM)");
check(serverApi.indexOf("NT_ALLOWED_ORIGINS") !== -1 && serverApi.indexOf('entry !== "*"') !== -1,
  "cross-origin API access is opt-in and never a wildcard");
check(envExample.indexOf("NT_ALLOWED_ORIGINS") !== -1 && envExample.indexOf("NT_COOKIE_SECURE") !== -1,
  ".env.example documents the cookie and origin settings");
check(serverIndex.indexOf('"/railway.json"') !== -1, "the deployment config is never served by production");

var readmeDeploy = read("README.md");
check(readmeDeploy.indexOf("railway.json") !== -1 && /Railway/.test(readmeDeploy) &&
  readmeDeploy.indexOf("RAILWAY_VOLUME_MOUNT_PATH") !== -1,
  "the README documents deploying on Railway with a persistent volume");

var secretLeaks = [];
PUBLIC_PAGES.concat(ADMIN_PAGES).concat(["assets/js/app.js", "assets/js/ui.js", "assets/js/admin.js", "assets/js/api.js"])
  .forEach(function (file) {
    var source = read(file);
    if (read(file).indexOf("nuclear-admin") !== -1) secretLeaks.push(file);
  });
check(serverIndex.indexOf("/scripts") !== -1 && /BLOCKED_IN_PRODUCTION/.test(serverIndex) &&
  serverIndex.indexOf("IS_PRODUCTION") !== -1,
  "test scripts and deployment files are never served by a production deployment");
check(secretLeaks.length === 0, "no page or script mentions the shipped default password" +
  (secretLeaks.length ? ": " + secretLeaks.join(", ") : ""));
check(read("README.md").indexOf("nuclear-admin") === -1, "the README does not publish an administrator password");
check(serverApi.indexOf("password_hash") === -1 && serverApi.indexOf("salt") === -1,
  "the API never returns password hashes or salts");
check(!/"password"\s*:/.test(serverApi.replace(/currentPassword|newPassword|body\.password|password\)/g, "")),
  "the API does not echo passwords back to callers");

/* ---------------- content rules ---------------- */

group("Content and access model");
var app = read("assets/js/app.js");
var api = read("assets/js/api.js");
var store = read("assets/js/store.js");
var data = read("assets/js/data.js");
var adminJs = read("assets/js/admin.js");
var home = read("index.html");
var shortYoutube = apiModule.mediaInfo("https://youtu.be/AbCdEf12345");
var playerVimeo = apiModule.mediaInfo("https://player.vimeo.com/video/123456");
var lookalikeProvider = apiModule.mediaInfo("https://notyoutube.com/watch?v=AbCdEf12345");
check(shortYoutube.provider === "youtube" && shortYoutube.youtubeId === "AbCdEf12345" && !!shortYoutube.thumbnail,
  "short YouTube links are correctly identified and receive a thumbnail");
check(playerVimeo.provider === "vimeo", "Vimeo player links are identified as Vimeo");
check(lookalikeProvider.provider === "other" && !lookalikeProvider.youtubeId,
  "lookalike hostnames are not misclassified as YouTube");

check(!/localStorage\s*\.\s*(get|set|remove)Item/.test(api), "the catalogue client never reads or writes localStorage");
check(/kept in memory|in memory/i.test(api), "catalogue content is cached in memory for the page view");
check(store.indexOf("accessMeta") !== -1 && store.indexOf("supportEmail") !== -1 && /state\.access/.test(store),
  "local storage is limited to access, profile and settings mirror");
check(serverApi.indexOf('pathname.indexOf("/api/admin/") === 0') !== -1, "the server gates every admin endpoint behind a session");
check(adminJs.indexOf('location.replace("login.html') !== -1, "the admin UI redirects signed-out visits to the sign-in page");
check(/ICON_CHOICES/.test(adminJs) && adminJs.indexOf("createVideo") !== -1 && adminJs.indexOf("moveVideo") !== -1,
  "admin forms offer a fixed icon list and use the video create/reorder API");
check(adminJs.indexOf("NT.api.admin.login") !== -1 && adminJs.indexOf("NT.api.admin.changePassword") !== -1,
  "the admin area signs in through the server and can rotate its password");
check(adminJs.indexOf("function pageFirstRun") !== -1 && /payload\.mustChangePassword && route !== "first-run"/.test(adminJs) &&
  api.indexOf("confirmPassword") !== -1,
  "the admin UI has a dedicated first-run screen, sends un-rotated sessions to it and confirms the new password");

var ui = read("assets/js/ui.js");
check(/site-header/.test(ui) && ui.indexOf("dashboard.html") !== -1, "authenticated navigation fits the learner dashboard");
check(ui.indexOf('href=\"/admin/login.html\"') !== -1 && ui.indexOf("footer-admin-link") !== -1 &&
  (ui.match(/href=\"\/admin\/login\.html\"/g) || []).length === 1,
  "the Admin Console is a single, footer-only link to /admin/login.html");
check(ui.indexOf('"/privacy-policy"') !== -1 && ui.indexOf('"/terms-and-conditions"') !== -1 &&
  (ui.match(/legalLink\(/g) || []).length >= 4,
  "the shared footer builds Privacy Policy and Terms & Conditions links to the canonical /privacy-policy and /terms-and-conditions routes");
/* Every rule that styles the footer legal links must stay readable on the navy
   footer: the light-theme muted/ink pair left them at ~2.9:1 against the footer
   and invisible (1:1) on hover, and nothing may hide them. */
var legalRules = [];
var legalRule = /\.footer-legal-links(?:\s+a[^\s{,]*)?\s*\{[^}]*\}/g;
var legalMatch;
while ((legalMatch = legalRule.exec(css))) legalRules.push(legalMatch[0]);
check(legalRules.length >= 2 && legalRules.every(function (rule) {
  return rule.indexOf("var(--muted)") === -1 && rule.indexOf("var(--ink)") === -1 &&
    rule.indexOf("display: none") === -1 && rule.indexOf("visibility: hidden") === -1 &&
    rule.indexOf("opacity: 0") === -1;
}), "no footer legal-link rule reuses the light-theme muted/ink colours or hides the links");
check(legalRules.some(function (rule) { return /color:\s*#c3d0d8/.test(rule); }),
  "the footer legal links carry an explicit footer-surface colour");
var legalHover = /\.footer-legal-links a:hover,[\s\S]*?color:\s*([^;]+);/.exec(css);
check(!!legalHover && legalHover[1].indexOf("var(--ink)") === -1 && legalHover[1].indexOf("#061723") === -1,
  "the footer legal links do not hover to the same colour as the navy footer background");
check(["Home", "How it works", "Access / Packages", "About", "Log in", "Get Started"].every(function (label) {
  return ui.indexOf(label) !== -1;
}), "public navigation provides the requested simple destinations and account actions");
check(app.indexOf("NT.content") !== -1 && api.indexOf("/api/catalogue") !== -1,
  "learner pages read the catalogue from the API");

var signup = read("signup.html");
var login = read("login.html");
var onboarding = read("learner-type.html");
check(/route\("POST", "\/api\/auth\/register"/.test(serverApi) &&
  /route\("POST", "\/api\/auth\/login"/.test(serverApi) &&
  /route\("GET", "\/api\/auth\/me"/.test(serverApi),
  "account registration, login and session lookup are server-backed");
check(serverDb.indexOf("learner_type") !== -1 && serverDb.indexOf("learner_accounts") !== -1 &&
  serverApi.indexOf("/api/auth/learner-type") !== -1,
  "learner type is persisted with the account and can be updated");
check(signup.indexOf('id="signupEmail"') !== -1 && signup.indexOf('id="signupPassword"') !== -1 &&
  signup.indexOf('id="signupAccessCode"') !== -1 && !/name="learnerType"/.test(signup),
  "signup captures account credentials and can preserve a redeemed legacy access code without choosing a level");
check(login.indexOf('id="loginEmail"') !== -1 && login.indexOf('id="loginPassword"') !== -1,
  "existing account holders can log in with their email and password");
check(onboarding.indexOf("What are you studying?") !== -1 &&
  (onboarding.match(/name="learnerType"/g) || []).length === 2 &&
  onboarding.indexOf(">University<") !== -1 && onboarding.indexOf(">High School<") !== -1,
  "post-auth onboarding asks what the learner is studying with the two requested choices");
check(app.indexOf('function authDestination(user)') !== -1 && app.indexOf('"learner-type.html"') !== -1 &&
  app.indexOf('"dashboard.html"') !== -1 && app.indexOf("AUTH_REQUIRED") !== -1,
  "saved learner types route to the dashboard and missing types are sent through onboarding");
check(serverDb.indexOf("linkExistingRedeemedCode") !== -1 && serverApi.indexOf("linkExistingRedeemedCode") !== -1,
  "redeemed legacy access codes can be linked during account creation");

check(/NT\.auth\.chooseType\(newType\)/.test(app) && /NT\.auth\.updateProfile/.test(app),
  "the learner type and profile remain editable after onboarding");
check(serverApi.indexOf("learnerLevel: scope.learnerLevel") !== -1 &&
  serverApi.indexOf('WHERE level = ?') !== -1 &&
  serverApi.indexOf("visibleToLearner(found, scope.account)") !== -1,
  "catalogue, search and direct lesson reads are scoped to the authenticated learner type");
check(serverApi.indexOf("progressFor(access.code, catalogueLevel(account), access.level)") !== -1 &&
  serverApi.indexOf("visibleToLearner(found, account)") !== -1 && serverApi.indexOf("canWatch(found, access)") !== -1,
  "progress reads and writes stay within the learner's catalogue and package tier");

var uploadSurfaces = [];
PUBLIC_PAGES.concat(ADMIN_PAGES).concat(["assets/js/app.js", "assets/js/admin.js", "assets/js/ui.js", "server/api.js"])
  .forEach(function (file) {
    var source = read(file);
    if (/type="file"|multipart\/form-data|upload-zone|PDF upload/i.test(source)) uploadSurfaces.push(file);
  });
check(uploadSurfaces.length === 0, "the platform stays video-only (no document or material uploads)");

var accessHtml = read("access.html");
check(accessHtml.indexOf('id="codeInput"') !== -1 && !/name="educationLevel"/.test(accessHtml),
  "code redemption stays code-only; learner type comes from the saved profile");
check(app.indexOf("NT.api.redeem") !== -1 && app.indexOf("NT.store.setAccess(access.package") !== -1,
  "the access flow redeems codes through the server and keeps the existing package behaviour");
check(data.indexOf("NT.isUnlocked") !== -1 && data.indexOf("video.locked") !== -1,
  "the browser mirrors the server's locked/unlocked verdict instead of deciding access");
check(data.indexOf("LEVEL_RANK[state.access] >= LEVEL_RANK[NT.levelOf(video)]") === -1,
  "local package ranks are no longer used to unlock lessons");
check(serverApi.indexOf("function requestAccess") !== -1 && serverApi.indexOf("protectVideos") !== -1 &&
  serverApi.indexOf("function canWatch") !== -1,
  "the server resolves the access code and redacts protected lesson sources");
check(/crypto\.randomBytes\(12\)/.test(serverApi) && serverApi.indexOf("function newAccessCode") !== -1,
  "access codes use a high-entropy random value instead of a guessable short numeric suffix");
check(serverApi.indexOf('route("POST", "/api/payment-enquiries"') !== -1 &&
  serverApi.indexOf("packageFor(pkg)") !== -1 && serverApi.indexOf("amount: pack.price") !== -1,
  "payment enquiries store the price and access level the server resolved, not the values a browser sent");
check(serverApi.indexOf("amount: pack.price") !== -1 &&
  !/body\.(price|amount|accessLevel)\b/.test(serverApi.slice(serverApi.indexOf("route(\"POST\", \"/api/payment-enquiries\""),
    serverApi.indexOf("route(\"POST\", \"/api/access/redeem\""))),
  "the public enquiry route ignores any price or level in the request body");
check(serverApi.indexOf("confirmPaymentEnquiry(row.id, code)") !== -1 &&
  serverDb.indexOf("WHERE id = ? AND status = 'pending'") !== -1,
  "a payment is claimed with a single conditional update, so a second confirm cannot mint another code");
check(serverApi.indexOf("if (row.status === \"confirmed\" && row.code)") !== -1 &&
  serverApi.indexOf("duplicate: true") !== -1,
  "confirming an already confirmed enquiry returns the existing access code");
check(/route\("GET", "\/api\/admin\/enquiries"/.test(serverApi) &&
  /route\("POST", "\/api\/admin\/enquiries\/:id\/confirm"/.test(serverApi) &&
  /route\("POST", "\/api\/admin\/enquiries\/:id\/reject"/.test(serverApi) &&
  /route\("POST", "\/api\/admin\/enquiries\/:id\/email"/.test(serverApi),
  "payment enquiries are listed, confirmed, rejected and re-emailed behind the administrator gate");
check(serverApi.indexOf("deliverEnquiryEmail") !== -1 && serverApi.indexOf("recordEnquiryEmail") !== -1 &&
  read("server/mailer.js").indexOf("function sendMail") !== -1,
  "the confirmation email is sent through the platform mailer and its result is recorded");
check(serverApi.indexOf("NT_WHATSAPP_NUMBER") !== -1 && serverApi.indexOf('260764599915') !== -1 &&
  read("assets/js/data.js").indexOf("NT.whatsappLink") !== -1,
  "the WhatsApp number is server configuration and the browser builds the prefilled message");
check(envExample.indexOf("NT_MAIL_FROM") !== -1 && envExample.indexOf("NT_SMTP_HOST") !== -1 &&
  envExample.indexOf("NT_WHATSAPP_NUMBER") !== -1,
  ".env.example documents the WhatsApp and email settings");
check(read("assets/js/admin.js").indexOf("function pageEnquiries") !== -1 &&
  adminJs.indexOf("confirmEnquiry") !== -1 && adminJs.indexOf("retryEnquiryEmail") !== -1,
  "the existing Admin Console gains a Payment enquiries page with confirm, reject and retry");
check(serverApi.indexOf("sourceUrl: allowed ? video.sourceUrl : null") !== -1,
  "protected video URLs are withheld from unauthorised responses");
check(/route\("GET", "\/api\/videos\/:id"/.test(serverApi) && /fail\(res, 403/.test(serverApi),
  "direct requests to a protected lesson are refused with 403");

var heroBlock = home.slice(home.indexOf('class="hero-home"'), home.indexOf("home-promise"));
check(heroBlock.indexOf("reveal") === -1 && heroBlock.indexOf("data-reveal") === -1,
  "the homepage hero keeps no scroll animation of its own");
var heroRotator = read("assets/js/hero-rotator.js");
check(/class="hero-rotator-slot"><span data-hero-rotator>Stay ahead\.<\/span><span class="hero-rotator-sizer" aria-hidden="true">Keep improving\.&nbsp;<\/span><\/span>/.test(home) &&
  css.indexOf(".hero-home h1 em .hero-rotator-slot { position: relative; display: inline-block;") !== -1 &&
  css.indexOf(".hero-home h1 em .hero-rotator-sizer { visibility: hidden; }") !== -1 &&
  heroRotator.indexOf("textNode.nodeValue = phrase.slice(0, position)") !== -1 &&
  heroRotator.indexOf("text.textContent") === -1,
  "the hero typewriter stays mounted in a fixed phrase-sized slot and updates its text node in place");
check(heroRotator.indexOf("pinToPhrase(phrase, true)") !== -1 &&
  heroRotator.indexOf("pinToPhrase(phrase, false)") !== -1 &&
  heroRotator.indexOf('text.style.transform = ""') !== -1,
  "the hero typewriter pins the running text to the completed phrase so it types in place");
check(/class="promise-item reveal" data-reveal="up" data-delay="1"/.test(home) &&
  home.indexOf('data-reveal="left"') !== -1 && home.indexOf('data-reveal="right"') !== -1 &&
  home.indexOf('data-reveal="scale"') !== -1 && home.indexOf('data-reveal="fade"') !== -1,
  "the homepage below the hero staggers upward, sideways, faded and scaled entrances");
check(css.indexOf('.reveal[data-reveal="left"]') !== -1 && css.indexOf('.reveal[data-reveal="scale"]') !== -1 &&
  css.indexOf('.reveal[data-delay="3"]') !== -1,
  "scroll entrance variants and stagger steps are styled");
check(home.indexOf("hero-preview") === -1 && home.indexOf("testimonial") === -1 && home.indexOf("students enrolled") === -1,
  "home has no invented social proof or student metrics");
check(home.indexOf("learning-preview") === -1 && home.indexOf("hero-visual") === -1 && home.indexOf("hero-orbit") === -1 &&
  home.indexOf("hero-path") === -1 && home.indexOf("hero-helper") === -1 && home.indexOf("hero-support") === -1 &&
  /* Dotted, so the course-page .course-hero-* rules never count as homepage leftovers. */
  css.indexOf(".learning-preview") === -1 && css.indexOf(".hero-visual") === -1 && css.indexOf(".hero-orbit") === -1 &&
  css.indexOf(".hero-path") === -1 && css.indexOf(".hero-helper") === -1 && css.indexOf(".hero-support") === -1,
  "the homepage hero is copy-only: no mock interface or preview card");
check(home.indexOf('class="hero-motif"') !== -1 && css.indexOf(".hero-motif") !== -1,
  "the homepage hero keeps the brand motif as pure decoration");
check(!/[\u25B6\u25A4\u25CE\u2022\u2197]/.test(home) && home.indexOf('viewBox="0 0 24 24"') !== -1,
  "homepage icons are inline SVG rather than typographic glyphs");
check(home.indexOf("Structured lessons") !== -1 && home.indexOf("Organized courses") !== -1 &&
  home.indexOf("Progress that stays with you") !== -1 && home.indexOf("term-based organization") !== -1 &&
  home.indexOf("Access packages") !== -1,
  "home markets structured courses, flexible term-based learning, progress and access packages");
check(home.indexOf('href="signup.html">Get Started</a>') !== -1 &&
  home.indexOf('href="login.html">Log In</a>') !== -1,
  "home presents clear Get Started and Log In calls to action");
check(!/university|high.school|school|institution/i.test(home),
  "the public homepage does not feature a specific education category or institution");
var levelNeutralPages = ["index.html", "pricing.html", "signup.html", "login.html", "access.html", "checkout.html"];
var nonNeutralPublicPages = levelNeutralPages.filter(function (file) { return /university|high.school|University of Zambia/i.test(read(file)); });
check(nonNeutralPublicPages.length === 0,
  "public marketing and account pages keep education-level-specific messaging out" +
  (nonNeutralPublicPages.length ? ": " + nonNeutralPublicPages.join(", ") : ""));
var aboutPage = read("about.html");
check(aboutPage.indexOf("tutorial group") !== -1 && aboutPage.indexOf("What We Do") !== -1 &&
  aboutPage.indexOf("What Students Get") !== -1 && aboutPage.indexOf("Our Approach") !== -1 &&
  aboutPage.indexOf("Why Nuclear Tutorials") !== -1,
  "about page explains the tutorial group, what it does, what students get, its approach and why Nuclear Tutorials");
var privacyPage = read("privacy-policy.html");
check(privacyPage.indexOf("Data Protection Act No. 3 of 2021") !== -1 &&
  privacyPage.indexOf("mandasteven23@gmail.com") !== -1 && privacyPage.indexOf("+260 764 599 915") !== -1 &&
  privacyPage.indexOf("Office of the Data Protection Commissioner") !== -1,
  "privacy policy references the Zambian Data Protection Act No. 3 of 2021 and official contact details");
var termsPage = read("terms-and-conditions.html");
check(termsPage.indexOf("Electronic Communications and Transactions Act No. 4 of 2021") !== -1 &&
  termsPage.indexOf("Cyber Security Act No. 3 of 2025") !== -1 &&
  termsPage.indexOf("mandasteven23@gmail.com") !== -1 && termsPage.indexOf("+260 764 599 915") !== -1,
  "terms and conditions reference the Electronic Communications and Transactions Act No. 4 of 2021, Cyber Security Act No. 3 of 2025 and official contact details");
var signupPage = read("signup.html");
check(signupPage.indexOf('id="signupConsent"') !== -1 &&
  !/id="signupConsent"[^>]*\bchecked\b/i.test(signupPage) &&
  signupPage.indexOf('href="terms-and-conditions.html"') !== -1 &&
  signupPage.indexOf('href="privacy-policy.html"') !== -1,
  "signup includes an unchecked consent checkbox linking to Terms & Conditions and Privacy Policy");
check(read("index.html").indexOf("homeStats") === -1 && app.indexOf("function pageHome()") !== -1 &&
  app.slice(app.indexOf("function pageHome()"), app.indexOf("/* ============================ COURSES")).indexOf("NT.content") === -1,
  "the public homepage does not load or feature the full catalogue");
check(read("lesson.html").indexOf("Watch your Nuclear Tutorials lesson") === -1 && app.indexOf("NT.embedUrl") !== -1,
  "lesson pages play the lesson instead of promising unavailable material");
check(read("checkout.html").indexOf("No payment is processed") !== -1 &&
  app.indexOf("Pay via WhatsApp") !== -1 && app.indexOf("createEnquiry") !== -1,
  "checkout raises a WhatsApp payment request and states that it processes no payment");
check(app.indexOf("issueCode") === -1 && app.indexOf("/api/codes/issue") === -1,
  "the checkout page can no longer mint an access code by itself");
check(!/route\("POST", "\/api\/codes\/issue"/.test(serverApi),
  "no anonymous endpoint issues access codes");
check(app.indexOf("loadFor(grid, function () {") !== -1 && app.indexOf("loadFor(root || grid") === -1,
  "the access packages page renders into its live grid instead of a detached node");

/* The first-run route key is quoted because of its hyphen, exactly as the
   rest of the admin routes are keyed. */
var adminRoutes = ["login: pageLogin", '"first-run": pageFirstRun', "home: pageHome", "courses: pageCourses",
  "lessons: pageLessons", "codes: pageCodes", "enquiries: pageEnquiries", "announcements: pageAnnouncements",
  "packages: pagePackages", "settings: pageSettings"];
var missingRoutes = adminRoutes.filter(function (entry) { return adminJs.indexOf(entry) === -1; });
check(missingRoutes.length === 0, "every admin page maps to an implemented route" + (missingRoutes.length ? ": " + missingRoutes.join(", ") : ""));

var pkg = JSON.parse(read("package.json"));
["start", "check", "check:flows", "check:access", "test:setup", "seed:demo", "seed:clear"].forEach(function (name) {
  check(pkg.scripts && !!pkg.scripts[name], "package script exists: " + name);
});
check(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, "the platform runs without third-party dependencies");

var readme = read("README.md").replace(/\s+/g, " ").toLowerCase();
["npm start", "university", "semester", "video lesson", "does not process a payment",
  "no document or material uploads", "does not re-host video files", "starts empty",
  "persistent disk", "must be changed", "npm run check:access", "npm run test:setup"]
  .forEach(function (phrase) {
    check(readme.indexOf(phrase.toLowerCase()) !== -1, "README documents: " + phrase);
  });

/* ---------------- optional HTTP checks ---------------- */

function fetchHttp(url) {
  return new Promise(function (resolve, reject) {
    var parsed = new URL(url);
    var client = parsed.protocol === "https:" ? https : http;
    var req = client.get(parsed, function (res) {
      res.resume();
      res.on("end", function () { resolve({ status: res.statusCode, headers: res.headers }); });
    });
    req.on("error", reject);
    req.setTimeout(5000, function () { req.destroy(new Error("timeout")); });
  });
}
function fetchJson(url) {
  return new Promise(function (resolve, reject) {
    var parsed = new URL(url);
    var client = parsed.protocol === "https:" ? https : http;
    var req = client.get(parsed, { headers: { Accept: "application/json" } }, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () {
        var raw = Buffer.concat(chunks).toString("utf8");
        var json = null;
        try { json = JSON.parse(raw); } catch (error) { /* ignore */ }
        resolve({ status: res.statusCode, json: json });
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, function () { req.destroy(new Error("timeout")); });
  });
}

function runHttp(base) {
  group("HTTP smoke (" + base + ")");
  var root = base.replace(/\/$/, "");
  var paths = PUBLIC_PAGES.concat(["privacy-policy", "terms-and-conditions"]).concat(ADMIN_PAGES).concat(ASSETS);
  /* The platform liveness probe comes first: if /health is not a plain 200
     JSON answer, Railway SIGTERMs the container and nothing below matters. */
  return fetchHttp(root + "/health").then(function (response) {
    check(response.status === 200, "GET /health returns HTTP 200 for the platform health check");
    check(String(response.headers["content-type"] || "").indexOf("application/json") === 0,
      "GET /health answers application/json");
    return fetchJson(root + "/health");
  }).then(function (response) {
    check(response.status === 200 && response.json && response.json.ok === true,
      "GET /health answers {\"ok\":true}");
    return paths.reduce(function (chain, rel) {
      return chain.then(function () {
        return fetchHttp(root + "/" + rel).then(function (response) {
          check(response.status === 200, response.status + " " + rel);
        }).catch(function (error) {
          check(false, rel + " fetch failed: " + error.message);
        });
      });
    }, Promise.resolve());
  }).then(function () {
    return fetchJson(root + "/api/catalogue");
  }).then(function (response) {
    var catalogue = response.json && response.json.catalogue;
    check(response.status === 200 && !!catalogue, "GET /api/catalogue returns the catalogue");
    check(catalogue && catalogue.universities.length > 0 && catalogue.courses.length > 0 && catalogue.videos.length > 0,
      "the catalogue holds universities, courses and video lessons");
    check(catalogue && catalogue.videos.every(function (video) {
      return video.universityId && video.semester && video.courseTitle;
    }), "every lesson is linked to a university, semester and course");
    check(catalogue && catalogue.videos.every(function (video) {
      return video.locked === true && video.sourceUrl === null;
    }), "a visitor to the running server receives no video source URLs");
    return fetchJson(root + "/api/videos/" + encodeURIComponent(catalogue.videos[0].id));
  }).then(function (response) {
    check(response.status === 403, "a protected lesson is refused when requested directly by a visitor");
    return fetchJson(root + "/api/admin/overview");
  }).then(function (response) {
    check(response.status === 401, "admin endpoints reject unauthenticated requests");
    return fetchHttp(root + "/server/db.js");
  }).then(function (response) {
    check(response.status === 404, "server source files are not published");
    return fetchHttp(root + "/%73erver/db.js");
  }).then(function (response) {
    check(response.status === 404, "percent-encoded source paths are blocked in development too");
    return fetchHttp(root + "/.env.example");
  }).then(function (response) {
    check(response.status === 404, "environment files are never published in development");
    return fetchHttp(root + "/admin/index.html");
  }).then(function (response) {
    check(response.status === 200, "admin pages are served");
    group("Live flow checks (scripts/check-flows.js)");
    var result = childProcess.spawnSync(process.execPath, [path.join(ROOT, "scripts/check-flows.js")], {
      encoding: "utf8",
      env: Object.assign({}, process.env, { BASE: root })
    });
    var output = (result.stdout || "").trim().split("\n");
    output.forEach(function (line) {
      if (/FAIL|passed,/.test(line)) console.log("  " + line.trim());
    });
    check(result.status === 0, "student and admin journeys pass against the running server");
  });
}

var base = process.env.BASE || "";
var done = base ? runHttp(base) : Promise.resolve();

done.then(function () {
  if (!base) {
    console.log("\n(Set BASE=http://127.0.0.1:8080 to also check HTTP, the API and the live flows.)");
  }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
