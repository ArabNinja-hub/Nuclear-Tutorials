#!/usr/bin/env node
/* Structural, flow, accessibility, CSS and optional HTTP checks. */
"use strict";

var fs = require("fs");
var path = require("path");
var http = require("http");
var https = require("https");
var childProcess = require("child_process");
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
  "index.html", "universities.html", "university.html", "courses.html", "course.html", "video.html",
  "library.html", "search.html", "dashboard.html", "profile.html", "pricing.html", "access.html",
  "checkout.html", "lesson.html", "announcements.html"
];
var ADMIN_PAGES = [
  "admin/index.html", "admin/universities.html", "admin/courses.html", "admin/videos.html",
  "admin/lessons.html", "admin/announcements.html", "admin/packages.html", "admin/codes.html",
  "admin/settings.html", "admin/login.html"
];
var ASSETS = [
  "assets/css/main.css", "assets/css/admin.css", "assets/js/icons.js", "assets/js/data.js",
  "assets/js/store.js", "assets/js/api.js", "assets/js/ui.js", "assets/js/video.js",
  "assets/js/app.js", "assets/js/admin.js", "assets/img/logo.jpg",
  "server/index.js", "server/db.js", "server/api.js", "server/auth.js", "server/static.js", "server/util.js"
];

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

group("Files and page shells");
ASSETS.forEach(function (file) { check(exists(file), file + " exists"); });
PUBLIC_PAGES.concat(ADMIN_PAGES).forEach(function (file) {
  check(exists(file), file + " exists");
  if (!exists(file)) return;
  var html = read(file);
  check(/<html lang="en">/.test(html), file + " declares its document language");
  check(/name="viewport"/.test(html), file + " has a responsive viewport");
  check(html.indexOf("main.css") !== -1, file + " loads the public design system");
  if (file.indexOf("admin/") === 0) {
    check(html.indexOf("admin.css") !== -1 && html.indexOf("admin.js") !== -1, file + " loads preview settings assets");
  } else {
    check(html.indexOf("assets/js/app.js") !== -1, file + " loads public behavior");
  }
});

var htmlPages = PUBLIC_PAGES.concat(ADMIN_PAGES);
var brokenLinks = [];
htmlPages.forEach(function (file) {
  var source = read(file);
  var match;
  var refs = /\b(?:href|src)="([^"]+)"/g;
  while ((match = refs.exec(source))) {
    var ref = match[1];
    if (!ref || /^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
    var target = ref.split(/[?#]/)[0];
    if (!target) continue;
    var resolved = path.resolve(ROOT, path.dirname(file), target);
    if (!fs.existsSync(resolved)) brokenLinks.push(file + " → " + ref);
  }
});
check(brokenLinks.length === 0, "static page and asset links resolve" + (brokenLinks.length ? ": " + brokenLinks.join(", ") : ""));

var syntaxFiles = [
  "assets/js/icons.js", "assets/js/data.js", "assets/js/store.js", "assets/js/api.js",
  "assets/js/ui.js", "assets/js/video.js", "assets/js/app.js", "assets/js/admin.js",
  "server/index.js", "server/db.js", "server/api.js", "server/auth.js", "server/static.js", "server/util.js",
  "scripts/check-platform.js", "scripts/smoke-render.js", "scripts/test-flows.js"
];
syntaxFiles.forEach(function (file) {
  var result = childProcess.spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
  check(result.status === 0, file + " parses" + (result.status === 0 ? "" : ": " + (result.stderr || result.stdout).trim()));
});

var iconSource = read("assets/js/icons.js");
var iconKeys = (iconSource.match(/^\s*"([^"]+)":/gm) || []).map(function (entry) { return entry.match(/"([^"]+)"/)[1]; });
var iconReferences = [];
["assets/js/app.js", "assets/js/ui.js", "assets/js/admin.js", "assets/js/data.js",
 "assets/js/video.js", "assets/js/api.js", "assets/js/store.js"].forEach(function (file) {
  var source = read(file), match;
  var direct = /NT\.icon\(\s*["']([^"']+)["']/g;
  while ((match = direct.exec(source))) iconReferences.push(match[1]);
  var properties = /\bicon\s*:\s*["']([^"']+)["']/g;
  while ((match = properties.exec(source))) iconReferences.push(match[1]);
  var sheetLinks = /sheetLink\(\s*["'][^"']*["']\s*,\s*["']([^"']+)["']/g;
  while ((match = sheetLinks.exec(source))) iconReferences.push(match[1]);
  var badgeIcons = source.match(/var icons\s*=\s*\{([^}]+)\}/);
  if (badgeIcons) iconReferences = iconReferences.concat((badgeIcons[1].match(/"([^"]+)"/g) || []).map(function (entry) { return entry.slice(1, -1); }));
});
iconReferences = iconReferences.concat(["check-circle", "circle-alert", "info", "lock", "unlock", "shield", "graduation-cap", "book-open"]);
var missingIcons = iconReferences.filter(function (name, index) { return iconKeys.indexOf(name) === -1 && iconReferences.indexOf(name) === index; });
/* Icons are also chosen through ternaries and provider maps, so a name that
   appears as a plain string literal anywhere in the client counts as used. */
var literalReferences = [];
["assets/js/app.js", "assets/js/ui.js", "assets/js/admin.js", "assets/js/data.js",
 "assets/js/video.js", "assets/js/api.js", "assets/js/store.js"].forEach(function (file) {
  var source = read(file), literal;
  var quoted = /["']([a-z0-9-]+)["']/g;
  while ((literal = quoted.exec(source))) literalReferences.push(literal[1]);
});
var unusedIcons = iconKeys.filter(function (name) {
  return iconReferences.indexOf(name) === -1 && literalReferences.indexOf(name) === -1;
});
check(missingIcons.length === 0 && unusedIcons.length === 0, "icon library contains only referenced icons" + (missingIcons.length ? "; missing: " + missingIcons.join(", ") : "") + (unusedIcons.length ? "; unused: " + unusedIcons.join(", ") : ""));

var css = read("assets/css/main.css");
var adminCss = read("assets/css/admin.css");
check(balancedCss(css), "public CSS braces, strings and comments are balanced");
check(balancedCss(adminCss), "admin CSS braces, strings and comments are balanced");
check(css.indexOf(".hero-home") !== -1 && css.indexOf(".hero-preview") === -1, "hero styles do not include a floating preview card");
check(css.indexOf(".level-choice") !== -1 && css.indexOf(":focus-visible") !== -1, "level options and visible keyboard focus are styled");
check(css.indexOf("@media (max-width: 640px)") !== -1 && css.indexOf(".tier-strip { grid-template-columns: 1fr; }") !== -1, "course access breakdown adapts to small screens");
check(css.indexOf("@media (prefers-reduced-motion: reduce)") !== -1, "reduced-motion preference is respected");
check(css.indexOf(".course-card-media") === -1 && css.indexOf(".popular-tag") === -1, "removed course artwork and popularity treatment have no styles");
check(adminCss.indexOf(".adm-stats") === -1 && adminCss.indexOf(".rev-bars") === -1 && adminCss.indexOf(".upload-zone") === -1, "admin styles exclude fake metrics and upload UI");

var home = read("index.html");
check((home.match(/<section\b/g) || []).length === 4, "home has only the hero, university preview, course outlines and access steps");
check(home.indexOf("hero-preview") === -1 && home.indexOf("testimonial") === -1 && home.indexOf("students enrolled") === -1, "home has no floating card or invented social proof");
check(home.indexOf("Universities and semesters") !== -1 && home.indexOf("universities.html") !== -1, "home sends students to their university and semester first");
check(home.indexOf("Browse video lessons") !== -1 && home.indexOf("hero-path") !== -1, "home shows the university → semester → course → video path");

var accessHtml = read("access.html");
check(/<fieldset[^>]*>[\s\S]*?<legend>Choose your level<\/legend>/.test(accessHtml), "access level choices use a labelled fieldset");
check((accessHtml.match(/type="radio" name="educationLevel"/g) || []).length === 2, "access form offers exactly two education levels");
check(accessHtml.indexOf("value=\"high-school\"") !== -1 && accessHtml.indexOf("value=\"university\"") !== -1, "High School and University choices are present");
check(accessHtml.indexOf("id=\"codeInput\"") > accessHtml.indexOf("Choose your level") && accessHtml.indexOf("type=\"submit\">Continue") > accessHtml.indexOf("id=\"codeInput\""), "level selection comes before code entry and Continue");

var app = read("assets/js/app.js");
var data = read("assets/js/data.js");
var store = read("assets/js/store.js");
check(app.indexOf("state.profile.educationLevel = choice.value") !== -1, "access flow saves the selected level in the existing profile");
check(app.indexOf("NT.store.setAccess(record.pkg") !== -1, "access flow preserves package redemption");
check(app.indexOf("courses.html?level=") !== -1 && app.indexOf("profile.educationLevel") !== -1, "selected level determines the course view");
check(data.indexOf("educationLevel: level.id") !== -1 && data.indexOf("lessonLevels") !== -1, "course pathways and lesson access use shared catalogue data");
check(store.indexOf("educationLevel: \"\"") !== -1 && store.indexOf("delete cache.payments") !== -1, "local profile is canonical and legacy simulated records are removed");
check(/email:\s*""/.test(store) && /cache\.settings\.email === "support@nucleartutorials\.zm"/.test(store) && /supportEmail\s*\?/.test(read("assets/js/ui.js")), "no fabricated default support contact is shown; legacy contact is cleared");
check(read("checkout.html").indexOf("No payment is processed") !== -1 && app.indexOf("Generate preview access code") !== -1, "checkout is explicitly a local preview, not a payment flow");
check(read("lesson.html").indexOf("Watch your Nuclear Tutorials lesson") === -1 && app.indexOf("Lesson materials are not hosted in this preview") !== -1, "lesson pages do not promise unavailable video content");

var adminJs = read("assets/js/admin.js");
ADMIN_PAGES.forEach(function (file) {
  var source = read(file);
  var route = (source.match(/data-admin="([^"]+)"/) || [])[1];
  check(route && adminJs.indexOf(route + ": page") !== -1, file + " maps to an implemented admin route");
});
check(adminJs.indexOf("lessonLevels[id]") !== -1 && adminJs.indexOf("payment processor") !== -1, "admin controls are local and describe their preview scope");
check(read("README.md").indexOf("lesson materials are not hosted") !== -1 && read("README.md").indexOf("does not contact a payment provider") !== -1, "README states the preview limitations");

group("Video catalogue platform");
var serverDb = read("server/db.js");
var serverApi = read("server/api.js");
var serverUtil = read("server/util.js");
var apiJs = read("assets/js/api.js");
var videoJs = read("assets/js/video.js");
var uiJs = read("assets/js/ui.js");

check(serverDb.indexOf("semester INTEGER NOT NULL CHECK (semester IN (1, 2))") !== -1, "every course is stored in Semester 1 or Semester 2");
check(serverDb.indexOf("course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE") !== -1, "every video lesson belongs to a course");
check(serverDb.indexOf("university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE") !== -1, "every course belongs to a university");
check(serverDb.indexOf("CHECK (level IN ('basic', 'standard', 'premium'))") !== -1, "video access reuses the existing package tiers");
check(serverDb.indexOf("status TEXT NOT NULL DEFAULT 'published'") !== -1, "video lessons can be published or kept as drafts");
check(serverDb.indexOf("position INTEGER NOT NULL DEFAULT 0") !== -1, "video order is stored, so administrators can reorder lessons");
check(serverApi.indexOf("api/admin/videos") !== -1 && serverApi.indexOf("api/admin/login") !== -1, "the administrator API manages video lessons behind a session");
check(serverApi.indexOf("/api/videos/") !== -1 && serverApi.indexOf("/api/library") !== -1, "students read the catalogue from the server API");
check(serverUtil.indexOf("youtube-nocookie.com/embed") !== -1 && serverUtil.indexOf("function analyzeVideoUrl") !== -1, "video sources are analysed once on the server");

/* The platform is video-only: no document, PDF or notes upload system exists. */
var allClient = PUBLIC_PAGES.concat(ADMIN_PAGES).map(read).join("\n") + app + adminJs + apiJs + videoJs + uiJs;
check(allClient.indexOf('type="file"') === -1, "no page offers a file picker");
check(allClient.toLowerCase().indexOf("multipart/form-data") === -1, "no page posts file uploads");
check(serverApi.toLowerCase().indexOf("upload") === -1 && apiJs.toLowerCase().indexOf("upload") === -1, "the API has no upload endpoint — video lessons only");
check(!/\b(pdf|handout|worksheet|docx|slides|dropzone)\b/i.test(allClient), "no PDF, notes or document material appears anywhere in the interface");

/* Global content lives in the database, never in a browser. */
check(!/localStorage\.(?:get|set|remove)Item/.test(app + videoJs + apiJs + uiJs), "catalogue content is never read from or written to localStorage");
check(store.indexOf("videos:") === -1 && store.indexOf("universities:") === -1 && store.indexOf("courses:") === -1, "the local store keeps only device-level access and progress");
check(/NT\.api\.load\("api\/(universities|library|videos|courses)/.test(app), "student pages load catalogue content from the server");
check(adminJs.indexOf('NT.api.post("api/admin/videos"') !== -1 && adminJs.indexOf('NT.api.remove("api/admin/videos/') !== -1, "administrators add and delete video lessons through the API");
check(adminJs.indexOf("NT.api.move(") !== -1 && adminJs.indexOf("{ status: next }") !== -1, "administrators can reorder and publish or unpublish lessons");

/* Structure stays visible to students, and admin stays hidden from them. */
check(videoJs.indexOf("NT.videoContext") !== -1, "video cards always name their university, semester and course");
check(uiJs.indexOf("NT.semesterSwitcher") !== -1 && app.indexOf("semesterSwitcher") !== -1, "semester selection is a first-class control on student pages");
check(read("university.html").indexOf("semesterSwitch") !== -1 && read("library.html").indexOf("videoSemester") !== -1, "the university page and library both filter by semester");
check(PUBLIC_PAGES.every(function (file) { return read(file).indexOf("admin/") === -1; }), "student pages never link into the administrator area");
check(adminJs.indexOf("requireAdmin") !== -1 && exists("admin/login.html"), "administrator screens require a server session");

/* Typography and touch. */
var fonts = htmlPages.map(read).join("\n");
check(/family=Manrope/.test(fonts) && /family=Inter/.test(fonts), "pages load Manrope for headings and Inter for body copy");
check(!/family=(?!Manrope|Inter)[A-Za-z+]/.test(fonts), "no additional font families are loaded");
check(css.indexOf('--font-display: "Manrope"') !== -1 && css.indexOf('--font: "Inter"') !== -1, "the design system declares exactly two typefaces");
check(css.indexOf("@media (hover: none)") !== -1, "touch devices keep the play affordance visible");
check(css.indexOf("@media (max-width: 720px)") !== -1 && css.indexOf(".semester-switch-options { grid-template-columns: 1fr; }") !== -1, "semester choices become full-width tap targets on phones");

function fetchHttp(url) {
  return new Promise(function (resolve, reject) {
    var parsed = new URL(url);
    var client = parsed.protocol === "https:" ? https : http;
    var req = client.get(parsed, function (res) {
      res.resume();
      res.on("end", function () { resolve({ status: res.statusCode, location: res.headers.location || "" }); });
    });
    req.on("error", reject);
    req.setTimeout(5000, function () { req.destroy(new Error("timeout")); });
  });
}

function runHttp(base) {
  group("HTTP smoke (" + base + ")");
  var paths = htmlPages.concat(ASSETS);
  return paths.reduce(function (chain, rel) {
    return chain.then(function () {
      return fetchHttp(base.replace(/\/$/, "") + "/" + rel).then(function (result) {
        if (rel.indexOf("admin/") === 0 && rel !== "admin/login.html") {
          /* Without a session the server must send administrators to sign-in
             instead of serving the page. */
          check(result.status === 302 && /\/admin\/login\.html\?next=/.test(result.location),
            result.status + " " + rel + " redirects to administrator sign-in" +
            (result.status === 302 ? "" : " (got " + result.location + ")"));
          return;
        }
        check(result.status === 200, result.status + " " + rel);
      }).catch(function (error) {
        check(false, rel + " fetch failed: " + error.message);
      });
    });
  }, Promise.resolve());
}

var base = process.env.BASE || "";
var done = base ? runHttp(base) : Promise.resolve();
done.then(function () {
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
