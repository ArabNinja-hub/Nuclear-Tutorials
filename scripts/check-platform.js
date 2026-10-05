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
  "index.html", "courses.html", "course.html", "pricing.html", "access.html", "checkout.html",
  "dashboard.html", "library.html", "lesson.html", "profile.html", "search.html", "announcements.html"
];
var ADMIN_PAGES = [
  "admin/index.html", "admin/courses.html", "admin/lessons.html", "admin/announcements.html",
  "admin/packages.html", "admin/codes.html", "admin/settings.html"
];
var ASSETS = [
  "assets/css/main.css", "assets/css/admin.css", "assets/js/icons.js", "assets/js/data.js",
  "assets/js/store.js", "assets/js/ui.js", "assets/js/app.js", "assets/js/admin.js", "assets/img/logo.jpg"
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

var syntaxFiles = ["assets/js/icons.js", "assets/js/data.js", "assets/js/store.js", "assets/js/ui.js", "assets/js/app.js", "assets/js/admin.js", "scripts/check-platform.js", "scripts/smoke-render.js"];
syntaxFiles.forEach(function (file) {
  var result = childProcess.spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
  check(result.status === 0, file + " parses" + (result.status === 0 ? "" : ": " + (result.stderr || result.stdout).trim()));
});

var iconSource = read("assets/js/icons.js");
var iconKeys = (iconSource.match(/^\s*"([^"]+)":/gm) || []).map(function (entry) { return entry.match(/"([^"]+)"/)[1]; });
var iconReferences = [];
["assets/js/app.js", "assets/js/ui.js", "assets/js/admin.js", "assets/js/data.js"].forEach(function (file) {
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
var unusedIcons = iconKeys.filter(function (name) { return iconReferences.indexOf(name) === -1; });
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
check((home.match(/<section\b/g) || []).length === 3, "home has only the hero, course preview and access steps");
check(home.indexOf("hero-preview") === -1 && home.indexOf("testimonial") === -1 && home.indexOf("students enrolled") === -1, "home has no floating card or invented social proof");
check(home.indexOf("Course outlines for") !== -1 && home.indexOf("Browse courses") !== -1, "home copy describes the catalogue and offers one primary path");

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

function fetchHttp(url) {
  return new Promise(function (resolve, reject) {
    var parsed = new URL(url);
    var client = parsed.protocol === "https:" ? https : http;
    var req = client.get(parsed, function (res) {
      res.resume();
      res.on("end", function () { resolve(res.statusCode); });
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
      return fetchHttp(base.replace(/\/$/, "") + "/" + rel).then(function (status) {
        check(status === 200, status + " " + rel);
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
