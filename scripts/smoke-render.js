/* ============================================================
   Nuclear Tutorials — headless render smoke test (no browser).
   Executes every public + admin route against a minimal DOM stub
   and fails on thrown errors or "undefined"/"NaN" leaking into
   rendered markup. Run:  node scripts/smoke-render.js
   ============================================================ */
"use strict";
var fs = require("fs");
var path = require("path");
var ROOT = path.join(__dirname, "..");

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }

var passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.log("  FAIL  " + label); }
}

/* ---------------- minimal DOM ---------------- */
function makeEl(tag) {
  var el = {
    tagName: String(tag || "div").toUpperCase(),
    children: [], innerHTML: "", textContent: "", value: "",
    className: "", id: "", href: "",
    dataset: {}, style: {},
    attributes: {},
    classList: {
      _s: {},
      add: function (c) { this._s[c] = 1; },
      remove: function (c) { delete this._s[c]; },
      toggle: function (c, on) { if (on === undefined) { if (this._s[c]) delete this._s[c]; else this._s[c] = 1; } else if (on) this._s[c] = 1; else delete this._s[c]; },
      contains: function (c) { return !!this._s[c]; }
    },
    hasAttribute: function (k) { return k in el.attributes; },
    setAttribute: function (k, v) { el.attributes[k] = v; },
    getAttribute: function (k) { return k in el.attributes ? el.attributes[k] : null; },
    removeAttribute: function (k) { delete el.attributes[k]; },
    addEventListener: function () {},
    removeEventListener: function () {},
    appendChild: function (c) { el.children.push(c); return c; },
    prepend: function (c) { el.children.unshift(c); return c; },
    remove: function () {},
    focus: function () {},
    contains: function () { return false; },
    querySelector: function (sel) { if (!el._q) el._q = {}; if (!el._q[sel]) el._q[sel] = makeEl("div"); return el._q[sel]; },
    querySelectorAll: function () { return []; },
    getContext: function () { return null; },
    getBoundingClientRect: function () { return { width: 800, height: 450 }; }
  };
  return el;
}

var registry = {};
var docQ = {};
function byId(id) { if (!registry[id]) { registry[id] = makeEl("div"); registry[id].id = id; } return registry[id]; }

var domListeners = {};
global.document = {
  body: makeEl("body"),
  documentElement: makeEl("html"),
  createElement: makeEl,
  createTextNode: function (t) { return { text: t }; },
  addEventListener: function (type, fn) { (domListeners[type] = domListeners[type] || []).push(fn); },
  removeEventListener: function () {},
  querySelector: function (sel) { if (!docQ[sel]) docQ[sel] = makeEl("div"); return docQ[sel]; },
  querySelectorAll: function () { return []; },
  getElementById: function (id) { return byId(id); },
  execCommand: function () { return true; }
};
global.window = global;
global.location = { pathname: "/index.html", search: "", hash: "" };
var memStore = {};
global.localStorage = {
  getItem: function (k) { return k in memStore ? memStore[k] : null; },
  setItem: function (k, v) { memStore[k] = String(v); },
  removeItem: function (k) { delete memStore[k]; }
};
global.IntersectionObserver = function (cb) { this.observe = function () {}; this.unobserve = function () {}; };
global.matchMedia = function () { return { matches: false, addListener: function () {} }; };
global.requestAnimationFrame = function () { return 0; };
global.addEventListener = function () {};
global.removeEventListener = function () {};
global.URLSearchParams = URLSearchParams;
global.history = { replaceState: function () {} };
global.setTimeout = setTimeout; global.setInterval = setInterval; global.clearInterval = clearInterval;

function load(rel) {
  var code = read(rel);
  /* eslint-disable no-new-func */
  new Function(code)();
}

/* ---------------- run ---------------- */
["assets/js/icons.js", "assets/js/data.js", "assets/js/store.js", "assets/js/ui.js", "assets/js/app.js"].forEach(load);

var PUBLIC = {
  home: ["index.html", ""],
  courses: ["courses.html", ""],
  course: ["course.html", "?id=math"],
  courseLocked: ["course.html", "?id=phys"],
  pricing: ["pricing.html", ""],
  access: ["access.html", ""],
  checkout: ["checkout.html", "?pkg=premium"],
  dashboard: ["dashboard.html", ""],
  library: ["library.html", ""],
  lesson: ["lesson.html", "?id=math-1"],
  control: ["control.html", ""],
  profile: ["profile.html", ""],
  resources: ["resources.html", ""],
  search: ["search.html", "?q=algebra"],
  announcements: ["announcements.html", ""]
};

function renderPage(page, file, search, accessLevel) {
  registry = {};
  memStore = {};
  if (accessLevel) {
    // seed an access state so authenticated branches execute too
    memStore["nt_demo_state_v1"] = JSON.stringify({ access: accessLevel, accessMeta: { source: "code", code: "NT-" + accessLevel.toUpperCase() + "-2026", since: new Date().toISOString() }, completed: ["math-1", "math-2"], recentLessons: ["math-3"] });
  }
  global.location = { pathname: "/" + file, search: search, hash: "" };
  global.document.body = makeEl("body");
  global.document.body.dataset.page = page === "courseLocked" ? "course" : page;
  domListeners = {};
  // reset module-level singletons by re-evaluating is expensive; NT.store caches, so clear:
  (domListeners["DOMContentLoaded"] || []).forEach(function (fn) { fn(); });
}

/* app.js registered its DOMContentLoaded handler on load; re-fire per page */
function fireDom() { (domListeners["DOMContentLoaded"] || []).forEach(function (fn) { fn(); }); }

function collectHtml() {
  var out = [];
  Object.keys(registry).forEach(function (k) { out.push(registry[k].innerHTML); });
  out.push(global.document.body.innerHTML || "");
  global.document.body.children.forEach(function (c) { out.push(c.innerHTML || ""); });
  return out.join("\n");
}

console.log("== Public render smoke ==");
Object.keys(PUBLIC).forEach(function (key) {
  var entry = PUBLIC[key];
  [null, "standard"].forEach(function (accessLevel) {
    try {
      registry = {};
      memStore = {};
      if (accessLevel) {
        memStore["nt_demo_state_v1"] = JSON.stringify({
          access: accessLevel,
          accessMeta: { source: "code", code: "NT-STANDARD-2026", since: new Date().toISOString() },
          completed: ["math-1", "math-2"], recentLessons: ["math-3"]
        });
      }
      // force store cache reload
      global.NT.store.reset && global.NT.store.reset();
      if (accessLevel) global.NT.store.setAccess(accessLevel, { source: "code", code: "NT-STANDARD-2026" });
      global.NT.store.toggleComplete("math-1", true);
      global.NT.store.recordLessonVisit("math-3");
      global.location = { pathname: "/" + entry[0], search: entry[1], hash: "" };
      global.document.body = makeEl("body");
      global.document.body.dataset.page = key === "courseLocked" ? "course" : key;
      fireDom();
      var html = collectHtml();
      ok(html.length > 200, key + (accessLevel ? " [access]" : " [visitor]") + " rendered markup");
      ok(html.indexOf("undefined") === -1, key + (accessLevel ? " [access]" : " [visitor]") + " has no 'undefined' in markup");
      ok(html.indexOf("NaN") === -1, key + (accessLevel ? " [access]" : " [visitor]") + " has no 'NaN' in markup");
    } catch (e) {
      ok(false, key + (accessLevel ? " [access]" : " [visitor]") + " threw: " + e.message);
    }
  });
});

console.log("\n== Admin render smoke ==");
var ADMIN = ["home", "videos", "courses", "announcements", "packages", "codes", "students", "payments", "settings"];
ADMIN.forEach(function (page) {
  try {
    registry = {};
    domListeners = {};
    global.location = { pathname: "/admin/" + page + ".html", search: "", hash: "" };
    global.document.body = makeEl("body");
    global.document.body.className = "admin";
    global.document.body.dataset.admin = page;
    new Function(read("assets/js/admin.js"))();
    fireDom();
    var html = collectHtml();
    ok(html.length > 200, "admin/" + page + " rendered markup");
    ok(html.indexOf("undefined") === -1, "admin/" + page + " has no 'undefined' in markup");
  } catch (e) {
    ok(false, "admin/" + page + " threw: " + e.message);
  }
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
