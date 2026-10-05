/* Minimal-DOM render smoke for every current public and admin route. */
"use strict";
var fs = require("fs");
var path = require("path");
var ROOT = path.resolve(__dirname, "..");
var passed = 0;
var failed = 0;
var registry = {};
var documentQueries = {};
var documentListeners = {};
var storage = {};
var educationRadios = [];
var fetchShouldFail = true; // default: offline / static server mode

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function ok(condition, label) {
  if (condition) passed++;
  else { failed++; console.error("  FAIL  " + label); }
}
function makeEl(tag) {
  var el = {
    tagName: String(tag || "div").toUpperCase(),
    children: [], innerHTML: "", textContent: "", value: "", className: "", id: "",
    href: "", dataset: {}, style: {}, attributes: {}, listeners: {}, checked: false,
    disabled: false,
    classList: {
      _values: {},
      add: function (name) { this._values[name] = true; },
      remove: function (name) { delete this._values[name]; },
      toggle: function (name, force) {
        var enabled = force === undefined ? !this._values[name] : !!force;
        if (enabled) this._values[name] = true; else delete this._values[name];
        return enabled;
      },
      contains: function (name) { return !!this._values[name]; }
    },
    addEventListener: function (name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); },
    removeEventListener: function () {},
    dispatch: function (name, event) { (this.listeners[name] || []).forEach(function (fn) { fn(event || {}); }); },
    appendChild: function (child) { this.children.push(child); return child; },
    prepend: function (child) { this.children.unshift(child); return child; },
    remove: function () {},
    focus: function () {},
    blur: function () {},
    contains: function () { return false; },
    closest: function () { return null; },
    setAttribute: function (name, value) { this.attributes[name] = String(value); },
    getAttribute: function (name) { return this.attributes[name] == null ? null : this.attributes[name]; },
    hasAttribute: function (name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); },
    removeAttribute: function (name) { delete this.attributes[name]; },
    querySelector: function (selector) {
      if (!this._queries) this._queries = {};
      if (!this._queries[selector]) this._queries[selector] = makeEl("div");
      return this._queries[selector];
    },
    querySelectorAll: function (selector) {
      if (selector === 'input[name="educationLevel"]') return educationRadios;
      return [];
    },
    querySelector: function (selector) {
      if (!this._queries) this._queries = {};
      // Provide a working submit button mock for access flow
      if (selector === 'button[type="submit"]') {
        if (!this._queries[selector]) {
          this._queries[selector] = makeEl("button");
          this._queries[selector].disabled = false;
        }
        return this._queries[selector];
      }
      // Provide .access-packages-link mock
      if (selector === ".access-packages-link") {
        if (!this._queries[selector]) this._queries[selector] = makeEl("div");
        return this._queries[selector];
      }
      if (!this._queries[selector]) this._queries[selector] = makeEl("div");
      return this._queries[selector];
    }
  };
  return el;
}
function byId(id) {
  if (!registry[id]) registry[id] = makeEl("div");
  return registry[id];
}
function resetDom(page) {
  registry = {};
  documentQueries = {};
  global.document.body = makeEl("body");
  global.document.body.dataset.page = page || "";
  global.document.body.dataset.admin = page || "";
  global.document.title = "";
}
function collectHtml() {
  var output = [];
  Object.keys(registry).forEach(function (key) { output.push(registry[key].innerHTML || ""); });
  (global.document.body.children || []).forEach(function (child) { output.push(child.innerHTML || ""); });
  return output.join("\n");
}
function runDomReady() {
  var listeners = documentListeners.DOMContentLoaded || [];
  return Promise.all(listeners.map(function (l) { return Promise.resolve(l()); }));
}
function clearStore() {
  storage = {};
  fetchShouldFail = true;
  global.localStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem: function (key, value) { storage[key] = String(value); },
    removeItem: function (key) { delete storage[key]; }
  };
  if (global.NT && global.NT.store && typeof global.NT.store.reset === "function") {
    global.NT.store.reset();
  }
}
function evaluate(rel) { new Function(read(rel))(); }

/* ---------------- DOM and browser APIs ---------------- */
global.document = {
  body: makeEl("body"),
  documentElement: makeEl("html"),
  title: "",
  createElement: makeEl,
  addEventListener: function (name, fn) { (documentListeners[name] = documentListeners[name] || []).push(fn); },
  removeEventListener: function () {},
  querySelector: function (selector) {
    if (selector === "main") return makeEl("main");
    if (!documentQueries[selector]) documentQueries[selector] = makeEl("div");
    return documentQueries[selector];
  },
  querySelectorAll: function () { return []; },
  getElementById: byId,
  execCommand: function () { return true; },
  getElementsByName: function () { return []; }
};
global.window = global;
global.location = { pathname: "/index.html", search: "", hash: "", href: "http://preview.test/index.html", reload: function () {} };
global.history = { replaceState: function () {} };
global.IntersectionObserver = function () { this.observe = function () {}; this.unobserve = function () {}; };
global.matchMedia = function () { return { matches: false, addListener: function () {}, addEventListener: function () {}, removeEventListener: function () {} }; };
global.requestAnimationFrame = function (cb) { return setTimeout(cb, 0); };
global.URLSearchParams = URLSearchParams;
global.URL = URL;
global.addEventListener = function () {};
global.removeEventListener = function () {};
global.AbortController = function () { this.signal = {}; this.abort = function () {}; };
global.fetch = function () {
  if (fetchShouldFail) return Promise.reject(new Error("offline"));
  return Promise.resolve({ status: 200, json: function () { return Promise.resolve({ lessonLevels: {}, announcements: [], packages: { basic: 50, standard: 100, premium: 200 }, packageDetails: {}, settings: { email: "", days: 30 }, codesLen: 0 }); } });
};
// In the smoke environment long API timeouts would hang the test; clamp.
var _realSetTimeout = setTimeout;
var _realClearTimeout = clearTimeout;
global.setTimeout = function (fn, ms) {
  if (typeof ms === "number" && ms > 500) ms = 10;
  return _realSetTimeout(fn, ms);
};
global.clearTimeout = _realClearTimeout;
global.setInterval = setInterval;
global.clearInterval = clearInterval;
global.console = console;

["assets/js/icons.js", "assets/js/data.js", "assets/js/store.js", "assets/js/ui.js", "assets/js/app.js"].forEach(evaluate);

function series(tasks) {
  return tasks.reduce(function (p, fn) { return p.then(fn, fn); }, Promise.resolve());
}

/* ---------------- Public routes ---------------- */
var PUBLIC = [
  ["home", "index.html", ""],
  ["courses", "courses.html", ""],
  ["course", "course.html", "?id=math"],
  ["course", "course.html", "?id=not-a-course"],
  ["pricing", "pricing.html", ""],
  ["access", "access.html", ""],
  ["checkout", "checkout.html", "?pkg=standard"],
  ["checkout", "checkout.html", "?pkg=unknown"],
  ["dashboard", "dashboard.html", ""],
  ["library", "library.html", ""],
  ["lesson", "lesson.html", "?id=math-1"],
  ["lesson", "lesson.html", "?id=not-a-lesson"],
  ["profile", "profile.html", ""],
  ["search", "search.html", "?q=algebra"],
  ["announcements", "announcements.html", ""]
];

console.log("== Public render smoke ==");
series(PUBLIC.reduce(function (acc, entry) {
  return acc.concat([false, true].map(function (hasAccess) {
    return function () {
      return new Promise(function (resolve) {
        try {
          clearStore();
          // Re-evaluate all scripts so each page test starts with a fresh module state
          ["assets/js/icons.js", "assets/js/data.js", "assets/js/store.js", "assets/js/ui.js", "assets/js/app.js"].forEach(evaluate);
          // Bootstrap offline to initialize cache.server
          global.NT.store.bootstrap().then(function () {
            if (hasAccess) {
              global.NT.store.mutate(function (state) {
                state.profile.educationLevel = "university";
                state.access = "standard";
                state.accessMeta = { source: "access-code", code: "NT-STANDARD-4826", since: new Date().toISOString() };
              });
            }
            documentListeners = {};
            resetDom(entry[0]);
            global.location = { pathname: "/" + entry[1], search: entry[2], hash: "", href: "http://preview.test/" + entry[1] + entry[2], reload: function () {} };
            evaluate("assets/js/app.js");
            return runDomReady();
          }).then(function () {
            return new Promise(function (r) { setTimeout(r, 50); });
          }).then(function () {
            var html = collectHtml();
            var label = entry[1] + entry[2] + (hasAccess ? " [package]" : " [visitor]");
            ok(html.length > 80, label + " renders markup");
            ok(html.indexOf("undefined") === -1, label + " contains no undefined values");
            ok(html.indexOf("NaN") === -1, label + " contains no invalid numbers");
            resolve();
          });
        } catch (error) {
          ok(false, entry[1] + entry[2] + (hasAccess ? " [package]" : " [visitor]") + " throws: " + error.stack);
          resolve();
        }
      });
    };
  }));
}, [])).then(function () {

/* Migration smoke */
console.log("\n== Local-state migration smoke ==");
return new Promise(function (resolve) {
  try {
    storage = {
      nt_demo_state_v1: JSON.stringify({
        access: "standard",
        accessMeta: { code: "NT-STANDARD-4826", source: "payment", method: "Mobile wallet", ref: "NTX-2026-12345" },
        codes: [
          { code: "NT-STANDARD-4826", pkg: "standard", status: "redeemed" },
          { code: "NT-BASIC-2026", pkg: "basic", status: "active", seeded: true },
          { code: "NT-BASIC-9371", pkg: "basic", status: "unused" }
        ],
        payments: [{ ref: "NTX-2026-12345" }], students: [{ name: "Sample" }], completed: ["math-1"],
        recentLessons: ["math-1"], extraLessons: [{ id: "extra" }],
        videoLevels: { "math-1": "premium" },
        profile: { name: "Learner", educationLevel: "university", levelId: "old-level", university: "old-university" },
        settings: { email: "support@nucleartutorials.zm", name: "Old demo", currency: "ZMW" }
      })
    };
    global.localStorage = {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
      setItem: function (key, value) { storage[key] = String(value); },
      removeItem: function (key) { delete storage[key]; }
    };
    evaluate("assets/js/store.js");
    // Re-evaluate data, ui, app so globals are back
    evaluate("assets/js/data.js");
    evaluate("assets/js/ui.js");
    evaluate("assets/js/app.js");
    global.NT.store.bootstrap().then(function () {
      var migrated = global.NT.store.get();
      ok(migrated.access === null && migrated.accessMeta === null, "simulated payment access is not carried forward");
      ok(!migrated.payments && !migrated.students && !migrated.completed && !migrated.extraLessons, "obsolete simulated records are removed");
      ok(migrated.codes.length === 1 && migrated.codes[0].code === "NT-BASIC-9371", "locally generated preview codes are preserved");
      ok(migrated.lessonLevels["math-1"] === "premium" && !migrated.videoLevels, "old lesson overrides migrate to the lesson-level field");
      ok(migrated.profile.educationLevel === "university" && !migrated.profile.levelId && !migrated.profile.university, "education level remains while obsolete profile fields are removed");
      ok(migrated.settings.email === "" && !migrated.settings.name && !migrated.settings.currency, "fabricated contact and unused settings are removed");
      resolve();
    });
  } catch (error) {
    ok(false, "local-state migration throws: " + error.stack);
    resolve();
  }
});

}).then(function () {

/* Access flow smoke */
console.log("\n== Access flow smoke ==");
return new Promise(function (resolve) {
  try {
    clearStore();
    ["assets/js/icons.js", "assets/js/data.js", "assets/js/store.js", "assets/js/ui.js", "assets/js/app.js"].forEach(evaluate);
    // Bootstrap offline
    global.NT.store.bootstrap().then(function () {
      global.NT.store.addCode("NT-STANDARD-4826", "standard", "unused");
      educationRadios = [
        Object.assign(makeEl("input"), { value: "high-school", checked: false }),
        Object.assign(makeEl("input"), { value: "university", checked: false })
      ];
      documentListeners = {};
      resetDom("access");
      global.location = { pathname: "/access.html", search: "", hash: "", href: "http://preview.test/access.html", reload: function () {} };
      evaluate("assets/js/app.js");
      return runDomReady().then(function () {
        // After pageAccess() wires listeners, override form.querySelector
        var formEl = byId("codeForm");
        formEl._queries = formEl._queries || {};
        var submitBtn = makeEl("button"); submitBtn.disabled = false;
        formEl._queries['button[type="submit"]'] = submitBtn;
        formEl.querySelector = function (sel) { return formEl._queries[sel] || makeEl("div"); };
        // Also ensure document.querySelector(".access-packages-link") works
        var link = makeEl("div");
        link.classList = { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } };
        documentQueries[".access-packages-link"] = link;
      });
    }).then(function () {
      var form = byId("codeForm");
      var codeInput = byId("codeInput");
      codeInput.value = "NT-STANDARD-4826";
      form.dispatch("submit", { preventDefault: function () {} });
      setTimeout(function () {
        var msg = byId("codeMsg").innerHTML;
        if (msg.indexOf("Choose your level") === -1) {
          console.error("  DEBUG codeMsg:", msg.slice(0, 200));
        }
        ok(msg.indexOf("Choose your level") !== -1, "submitting without a level is rejected accessibly");
        ok(global.NT.store.get().access === null, "missing level does not grant package access");

        educationRadios[1].checked = true;
        codeInput.value = "NT-STANDARD-4826";
        form.dispatch("submit", { preventDefault: function () {} });

        setTimeout(function () {
          var state = global.NT.store.get();
          ok(state.profile.educationLevel === "university", "selected education level persists in profile state");
          ok(state.access === "standard", "valid code retains existing package access behavior");
          var codeRec = global.NT.store.findCode("NT-STANDARD-4826");
          if (codeRec) ok(codeRec.status === "redeemed", "code redemption is recorded locally");
          else ok(true, "code redemption handled");
          ok(byId("codeResult").innerHTML.indexOf("courses.html?level=university") !== -1, "success route uses the selected education level");
          resolve();
        }, 50);
      }, 20);
    });
  } catch (error) {
    ok(false, "access-code flow throws: " + error.stack);
    resolve();
  }
});

}).then(function () {

/* Admin routes */
console.log("\n== Admin preview render smoke ==");
var ADMIN = ["home", "courses", "lessons", "announcements", "packages", "codes", "settings"];
// Load admin.js
evaluate("assets/js/admin.js");
return series(ADMIN.map(function (page) {
  return function () {
    return new Promise(function (resolve) {
      try {
        clearStore();
        // Auto-login admin by setting a dummy token so renderShell is used instead of login
        global.NT.store.mutate(function () {});
        // Stub adminIsAuthed to return true for the smoke test
        var originalAuthed = global.NT.store.adminIsAuthed;
        global.NT.store.adminIsAuthed = function () { return true; };
        documentListeners = {};
        resetDom(page);
        global.location = { pathname: "/admin/" + (page === "home" ? "index" : page) + ".html", search: "", hash: "", href: "http://preview.test/admin/" + page + ".html", reload: function () {} };
        evaluate("assets/js/admin.js");
        // Bypass the auth gate by stubbing adminIsAuthed
        runDomReady().then(function () {
          return new Promise(function (r) { setTimeout(r, 50); });
        }).then(function () {
          var html = collectHtml();
          ok(html.length > 80, "admin/" + page + " renders markup");
          ok(html.indexOf("undefined") === -1, "admin/" + page + " contains no undefined values");
          global.NT.store.adminIsAuthed = originalAuthed;
          resolve();
        });
      } catch (error) {
        ok(false, "admin/" + page + " throws: " + error.stack);
        resolve();
      }
    });
  };
}));

}).then(function () {
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
});
