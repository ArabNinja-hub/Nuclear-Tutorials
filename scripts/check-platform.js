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
  "index.html", "courses.html", "course.html", "lesson.html", "library.html", "dashboard.html",
  "search.html", "profile.html", "pricing.html", "checkout.html", "access.html", "announcements.html"
];
var ADMIN_PAGES = [
  "admin/login.html", "admin/index.html", "admin/courses.html", "admin/lessons.html",
  "admin/codes.html", "admin/announcements.html", "admin/packages.html", "admin/settings.html"
];
var SCRIPT_FILES = [
  "assets/js/icons.js", "assets/js/data.js", "assets/js/store.js", "assets/js/api.js",
  "assets/js/ui.js", "assets/js/app.js", "assets/js/admin.js",
  "server/index.js", "server/db.js", "server/api.js", "server/seed.js",
  "scripts/check-platform.js", "scripts/smoke-render.js", "scripts/check-flows.js"
];
var ASSETS = [
  "assets/css/fonts.css", "assets/css/main.css", "assets/css/admin.css", "assets/img/logo.jpg",
  "assets/fonts/inter-latin-400.woff2", "assets/fonts/manrope-latin-800.woff2"
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

/* ---------------- files and page shells ---------------- */

group("Files and page shells");
ASSETS.concat(SCRIPT_FILES).forEach(function (file) { check(exists(file), file + " exists"); });
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
["check-circle", "circle-alert", "info", "lock", "unlock", "shield", "graduation-cap", "book-open", "calendar"].forEach(function (name) {
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

/* ---------------- content rules ---------------- */

group("Content and access model");
var app = read("assets/js/app.js");
var api = read("assets/js/api.js");
var store = read("assets/js/store.js");
var data = read("assets/js/data.js");
var adminJs = read("assets/js/admin.js");
var serverApi = read("server/api.js");
var home = read("index.html");

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
check(/site-header/.test(read("assets/js/ui.js")) && read("assets/js/ui.js").indexOf("dashboard.html") !== -1,
  "public navigation links to the student dashboard");
check(app.indexOf("NT.content") !== -1 && api.indexOf("/api/catalogue") !== -1,
  "public pages read universities, semesters, courses and lessons from the API");
check(/registration|sign up|create account/i.test(home) === false, "no account system beyond the access code is advertised");

var uploadSurfaces = [];
PUBLIC_PAGES.concat(ADMIN_PAGES).concat(["assets/js/app.js", "assets/js/admin.js", "assets/js/ui.js", "server/api.js"])
  .forEach(function (file) {
    var source = read(file);
    if (/type="file"|multipart\/form-data|upload-zone|PDF upload/i.test(source)) uploadSurfaces.push(file);
  });
check(uploadSurfaces.length === 0, "the platform stays video-only (no document or material uploads)");

var accessHtml = read("access.html");
check(/<fieldset[^>]*>[\s\S]*?<legend>Choose your level<\/legend>/.test(accessHtml), "access level choices use a labelled fieldset");
check((accessHtml.match(/type="radio" name="educationLevel"/g) || []).length === 2, "the access form offers exactly two education levels");
check(accessHtml.indexOf("id=\"codeInput\"") > accessHtml.indexOf("Choose your level") && accessHtml.indexOf("type=\"submit\">Continue") > accessHtml.indexOf("id=\"codeInput\""),
  "level selection comes before code entry and Continue");
check(app.indexOf("NT.api.redeem") !== -1 && app.indexOf("NT.store.setAccess(access.package") !== -1,
  "the access flow redeems codes through the server and keeps the existing package behaviour");
check(data.indexOf("LEVEL_RANK") !== -1 && data.indexOf("NT.isUnlocked") !== -1, "package levels still control lesson access");

check(home.indexOf("hero-preview") === -1 && home.indexOf("testimonial") === -1 && home.indexOf("students enrolled") === -1,
  "home has no floating card or invented social proof");
check(home.indexOf("Course outlines for") !== -1 && home.indexOf("Browse courses") !== -1, "home describes the catalogue and offers one primary path");
check(read("index.html").indexOf("id=\"homeStats\"") !== -1 && app.indexOf("NT.content.totals()") !== -1,
  "home statistics come from the live catalogue, not invented numbers");
check(read("lesson.html").indexOf("Watch your Nuclear Tutorials lesson") === -1 && app.indexOf("NT.embedUrl") !== -1,
  "lesson pages play the lesson instead of promising unavailable material");
check(read("checkout.html").indexOf("No payment is processed") !== -1 && app.indexOf("Generate access code") !== -1,
  "checkout issues an access code and states that it processes no payment");

var adminRoutes = ["login: pageLogin", "home: pageHome", "courses: pageCourses", "lessons: pageLessons",
  "codes: pageCodes", "announcements: pageAnnouncements", "packages: pagePackages", "settings: pageSettings"];
var missingRoutes = adminRoutes.filter(function (entry) { return adminJs.indexOf(entry) === -1; });
check(missingRoutes.length === 0, "every admin page maps to an implemented route" + (missingRoutes.length ? ": " + missingRoutes.join(", ") : ""));

var pkg = JSON.parse(read("package.json"));
check(pkg.scripts && pkg.scripts.start && pkg.scripts.check && pkg.scripts["check:flows"], "package scripts cover start, check and flow checks");
check(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, "the platform runs without third-party dependencies");

var readme = read("README.md").replace(/\s+/g, " ").toLowerCase();
["npm start", "university", "semester", "video lesson", "does not process a payment", "nuclear-admin",
  "no document or material uploads", "does not re-host video files"]
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
  var paths = PUBLIC_PAGES.concat(ADMIN_PAGES).concat(ASSETS);
  return paths.reduce(function (chain, rel) {
    return chain.then(function () {
      return fetchHttp(root + "/" + rel).then(function (response) {
        check(response.status === 200, response.status + " " + rel);
      }).catch(function (error) {
        check(false, rel + " fetch failed: " + error.message);
      });
    });
  }, Promise.resolve()).then(function () {
    return fetchJson(root + "/api/catalogue");
  }).then(function (response) {
    var catalogue = response.json && response.json.catalogue;
    check(response.status === 200 && !!catalogue, "GET /api/catalogue returns the catalogue");
    check(catalogue && catalogue.universities.length > 0 && catalogue.courses.length > 0 && catalogue.videos.length > 0,
      "the catalogue holds universities, courses and video lessons");
    check(catalogue && catalogue.videos.every(function (video) {
      return video.universityId && video.semester && video.courseTitle && video.sourceUrl;
    }), "every lesson is linked to a university, semester and course and has a video source");
    return fetchJson(root + "/api/admin/overview");
  }).then(function (response) {
    check(response.status === 401, "admin endpoints reject unauthenticated requests");
    return fetchHttp(root + "/server/db.js");
  }).then(function (response) {
    check(response.status === 404, "server source files are not published");
    return fetchHttp(root + "/admin/index.html");
  }).then(function (response) {
    check(response.status === 200, "admin pages are served");
    group("Live flow checks (scripts/check-flows.js)");
    var result = childProcess.spawnSync(process.execPath, [path.join(ROOT, "scripts/check-flows.js")], {
      encoding: "utf8",
      env: Object.assign({}, process.env, { BASE: root })
    });
    var output = (result.stdout || "").trim().split("\n");
    output.slice(-1).forEach(function (line) { console.log("  " + line.trim()); });
    check(result.status === 0, "student and admin journeys pass against the running server");
  });
}

var base = process.env.BASE || "";
var done = base ? runHttp(base) : Promise.resolve();

done.then(function () {
  if (!base) {
    console.log("\n(Set BASE=http://127.0.0.1:8000 to also check HTTP, the API and the live flows.)");
  }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
