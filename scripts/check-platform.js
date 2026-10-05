#!/usr/bin/env node
/* Nuclear Tutorials — smoke, flow, journey, admin, accessibility and CSS checks.
   Run: node scripts/check-platform.js
   Optional: BASE=http://127.0.0.1:8000 node scripts/check-platform.js
*/
"use strict";

var fs = require("fs");
var path = require("path");
var http = require("http");
var { URL } = require("url");

var ROOT = path.resolve(__dirname, "..");
var failed = 0;
var passed = 0;
var section = "";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}
function group(name) {
  section = name;
  console.log("\n== " + name + " ==");
}
function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log("  PASS  " + msg);
  } else {
    failed++;
    console.log("  FAIL  " + msg);
  }
}

var PUBLIC_PAGES = [
  "index.html", "courses.html", "pricing.html", "access.html", "checkout.html",
  "dashboard.html", "library.html", "lesson.html", "control.html", "profile.html",
  "resources.html", "search.html", "announcements.html"
];
var ADMIN_PAGES = [
  "admin/index.html", "admin/videos.html", "admin/courses.html", "admin/announcements.html",
  "admin/packages.html", "admin/codes.html", "admin/students.html", "admin/payments.html",
  "admin/settings.html"
];
var ASSETS = [
  "assets/css/main.css", "assets/css/admin.css",
  "assets/js/icons.js", "assets/js/data.js", "assets/js/store.js",
  "assets/js/ui.js", "assets/js/app.js", "assets/js/admin.js",
  "assets/img/logo.jpg"
];

group("CSS");
ASSETS.forEach(function (file) { ok(exists(file), "asset exists: " + file); });
var css = read("assets/css/main.css");
ok(css.indexOf("--brand:") !== -1 && css.indexOf("--navy:") !== -1, "brand and navy tokens");
ok(css.indexOf("--hs:") !== -1 && css.indexOf("--uni:") !== -1, "pathway colour tokens");
ok(/--bg:\s*#(?!ffffff|fff\b)/i.test(css), "page canvas is not pure white");
ok(css.indexOf(".hero-home") !== -1 && css.indexOf(".hero-preview") !== -1, "hero signature styles");
ok(css.indexOf(".pathway-hs") !== -1 && css.indexOf(".pathway-uni") !== -1, "distinct pathway panels");
ok(css.indexOf(".course-card-media") !== -1 && css.indexOf(".course-card-body") !== -1, "richer course cards");
ok(css.indexOf(".steps::before") !== -1 && css.indexOf(".step-num") !== -1, "how-it-works visual flow");
ok(css.indexOf(".price-premium") !== -1 && css.indexOf(".price-standard") !== -1, "tiered pricing chrome");
ok(css.indexOf(".dashboard-continue") !== -1 && css.indexOf(".lib-index") !== -1, "dashboard + library styles");
ok(css.indexOf("@media (prefers-reduced-motion: reduce)") !== -1, "reduced-motion override");
ok(css.indexOf(":focus-visible") !== -1, "focus-visible rings");
ok(css.indexOf("@keyframes rise") !== -1 && css.indexOf("@keyframes floaty") !== -1, "restrained motion keyframes");
ok(css.indexOf("backdrop-filter") !== -1, "header depth (not card glassmorphism)");
ok((css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length, "CSS braces balanced");

group("Smoke");
PUBLIC_PAGES.concat(ADMIN_PAGES).forEach(function (file) {
  ok(exists(file), "page exists: " + file);
  var html = read(file);
  ok(/<html lang="en">/.test(html), file + " has lang=en");
  ok(/name="viewport"/.test(html), file + " has viewport");
  ok(html.indexOf("assets/css/main.css") !== -1, file + " loads main.css");
});
var index = read("index.html");
ok(index.indexOf("data-page=\"home\"") !== -1, "home data-page");
ok(index.indexOf("Learn smarter.") !== -1 && index.indexOf("Go further.") !== -1, "home headline preserved");
ok(index.indexOf("Explore Courses") !== -1 && index.indexOf("How it works") !== -1, "home CTAs preserved");
ok((index.match(/<section/g) || []).length === 5, "home still has five sections");
ok(index.indexOf("id=\"learning-paths\"") !== -1, "learning paths section");
ok(index.indexOf("id=\"popular-courses\"") !== -1, "popular courses section");
ok(index.indexOf("id=\"how-it-works\"") !== -1, "how it works section");
ok(index.indexOf("id=\"access\"") !== -1, "access section");
ok(index.indexOf("id=\"courseGrid\"") !== -1 && index.indexOf("id=\"accessList\"") !== -1, "home mounts");
ok(index.indexOf("testimonial") === -1 && index.indexOf("students enrolled") === -1, "no invented social proof");

group("Flow");
var data = read("assets/js/data.js");
var store = read("assets/js/store.js");
var app = read("assets/js/app.js");
ok(data.indexOf("price: 50") !== -1 && data.indexOf("price: 100") !== -1 && data.indexOf("price: 200") !== -1, "Basic K50 / Standard K100 / Premium K200");
ok(data.indexOf('name: "Basic"') !== -1 && data.indexOf('name: "Standard"') !== -1 && data.indexOf('name: "Premium"') !== -1, "package names");
ok(/LEVELS = \["basic", "standard", "premium"\]/.test(data), "access hierarchy ids");
ok(data.indexOf("basic: 1") !== -1 && data.indexOf("standard: 2") !== -1 && data.indexOf("premium: 3") !== -1, "level ranks");
ok(store.indexOf("NT-BASIC-2026") !== -1 && store.indexOf("NT-STANDARD-2026") !== -1 && store.indexOf("NT-PREMIUM-2026") !== -1, "demo access codes");
ok(store.indexOf("nt_demo_state_v1") !== -1, "localStorage key");
ok(store.indexOf("packages: { basic: 50, standard: 100, premium: 200 }") !== -1, "store default prices");
ok(app.indexOf("pageCheckout") !== -1 && app.indexOf("pageAccess") !== -1 && app.indexOf("pageLesson") !== -1, "checkout / access / lesson flows");
ok(app.indexOf("NT.store.setAccess") !== -1 && app.indexOf("NT.isUnlocked") !== -1, "access unlock wiring");
ok((data.match(/id: "math"|id: "phys"|id: "chem"|id: "cs"|id: "bio"/g) || []).length >= 5, "five-course catalogue");
ok(data.indexOf('["Number Systems", "12:40"]') !== -1, "Mathematics lesson 1 unchanged");
ok(index.indexOf("Number Systems") !== -1 && index.indexOf("12:40") !== -1, "hero preview uses catalogue content");

group("Journey");
ok(index.indexOf("pathway-hs") !== -1 && index.indexOf("pathway-uni") !== -1, "two pathway panels");
ok(index.indexOf("Browse High School courses") !== -1 && index.indexOf("Browse University courses") !== -1, "pathway CTAs");
ok(index.indexOf("Choose a course") !== -1 && index.indexOf("Get access") !== -1 && index.indexOf("Start learning") !== -1, "three how-it-works steps");
var courses = read("courses.html");
ok(courses.indexOf("id=\"pathwayTabs\"") !== -1 && courses.indexOf("id=\"courseList\"") !== -1, "courses discovery surface");
var pricing = read("pricing.html");
ok(pricing.indexOf("id=\"pricingGrid\"") !== -1 && pricing.indexOf("id=\"cmpBody\"") !== -1, "pricing grid + comparison");
ok(pricing.indexOf("Basic K50") !== -1 && pricing.indexOf("Standard K100") !== -1 && pricing.indexOf("Premium K200") !== -1, "pricing meta still states amounts");
ok(read("dashboard.html").indexOf("id=\"dashRoot\"") !== -1, "dashboard mount");
ok(read("library.html").indexOf("id=\"libRoot\"") !== -1 && read("library.html").indexOf("id=\"libGate\"") !== -1, "library workspace mounts");
ok(read("lesson.html").indexOf("id=\"lessonRoot\"") !== -1, "lesson player mount");
ok(read("access.html").indexOf("NT-BASIC-2026") !== -1, "access page demo codes");
ok(app.indexOf("renderCourseCard") !== -1 && app.indexOf("course-card-media") !== -1, "course cards render media");
ok(app.indexOf("lib-index") !== -1 && app.indexOf("lib-course-progress") !== -1, "library numbers + progress");
ok(app.indexOf("price-card price-'") !== -1 || app.indexOf("price-card price-") !== -1, "pricing cards carry tier class");
ok(app.indexOf("Continue learning") !== -1 && app.indexOf("dashboard-continue") !== -1, "dashboard continue-learning block");

group("Admin");
ADMIN_PAGES.forEach(function (file) {
  var html = read(file);
  ok(html.indexOf("assets/css/admin.css") !== -1, file + " loads admin.css");
  ok(html.indexOf("assets/js/admin.js") !== -1, file + " loads admin.js");
});
var adminJs = read("assets/js/admin.js");
ok(adminJs.indexOf("data-admin") !== -1 || adminJs.length > 500, "admin behaviour present");
ok(read("assets/css/admin.css").indexOf("--adm-side") !== -1, "admin shell tokens");

group("Accessibility");
var ui = read("assets/js/ui.js");
ok(ui.indexOf("skip-link") !== -1 && ui.indexOf("Skip to main content") !== -1, "skip link");
ok(ui.indexOf("aria-label=\"Primary\"") !== -1, "primary nav label");
ok(ui.indexOf("NT.logoImg") !== -1 && ui.indexOf("alt=") !== -1, "logo alt text helper");
ok(css.indexOf("outline: 2px solid var(--brand-500)") !== -1, "visible focus outline");
ok(index.indexOf("aria-hidden=\"true\"") !== -1, "decorative hero is hidden from AT");
ok(read("courses.html").indexOf("aria-label=\"Browse courses by pathway\"") !== -1, "pathway tabs labelled");
ok(read("library.html").indexOf("aria-label=\"Filter lessons by availability\"") !== -1, "library filters labelled");
ok(read("search.html").indexOf("aria-live=\"polite\"") !== -1, "search live region");
ok(ui.indexOf("main.setAttribute(\"tabindex\", \"-1\")") !== -1, "main is a skip target");

group("No-rebuild invariants");
ok(data.indexOf("UNIVERSITIES = []") !== -1 && data.indexOf("PROGRAMMES = []") !== -1, "no invented universities");
ok(index.indexOf("1284") === -1 && index.indexOf("activeAccess") === -1, "home has no statistics strip");
ok(index.indexOf("Why") === -1 || index.indexOf("id=\"why\"") === -1, "no extra why-us section");
["testimonials", "as seen in", "trusted by"].forEach(function (phrase) {
  ok(index.toLowerCase().indexOf(phrase) === -1, "home does not contain “" + phrase + "”");
});

function fetchHttp(url) {
  return new Promise(function (resolve, reject) {
    var req = http.get(url, function (res) {
      var chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, function () { req.destroy(new Error("timeout " + url)); });
  });
}

function runHttp(base) {
  group("HTTP smoke (" + base + ")");
  var paths = PUBLIC_PAGES.concat(ADMIN_PAGES).concat(ASSETS);
  return paths.reduce(function (chain, rel) {
    return chain.then(function () {
      var url = base.replace(/\/$/, "") + "/" + rel;
      return fetchHttp(url).then(function (res) {
        ok(res.status === 200, res.status + " " + rel);
        if (rel.endsWith(".html") && res.status === 200) {
          ok(res.body.indexOf("<script") !== -1, rel + " served with scripts");
        }
      }).catch(function (err) {
        ok(false, rel + " fetch failed: " + err.message);
      });
    });
  }, Promise.resolve());
}

var base = process.env.BASE || "";
var done = base ? runHttp(base) : Promise.resolve();
done.then(function () {
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
