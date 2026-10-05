/* Minimal-DOM render smoke for every public and administrator route.
   ------------------------------------------------------------
   The content service is replaced by a fixture-backed fetch stub and the
   NT.api cache is primed, so each route paints synchronously — the same
   thing a browser does on a warm connection. Nothing here touches the real
   database: the fixtures are the shape the server returns. */
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
var selectorCount = 0;
var created = [];

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
    reset: function () {},
    contains: function () { return false; },
    setAttribute: function (name, value) { this.attributes[name] = String(value); },
    getAttribute: function (name) { return this.attributes[name] == null ? null : this.attributes[name]; },
    hasAttribute: function (name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); },
    removeAttribute: function (name) { delete this.attributes[name]; },
    querySelector: function (selector) {
      if (!this._queries) this._queries = {};
      if (!this._queries[selector]) {
        /* Pages that render into a queried host (admin lists, library panes)
           are only visible to the assertions if the host is collected too. */
        this._queries[selector] = makeEl("div");
        registry["selector-" + (selectorCount++) + "-" + selector] = this._queries[selector];
      }
      return this._queries[selector];
    },
    querySelectorAll: function (selector) {
      if (selector === 'input[name="educationLevel"]') return educationRadios;
      return [];
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
  selectorCount = 0;
  created = [];
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
  (documentListeners.DOMContentLoaded || []).forEach(function (listener) { listener(); });
}
function clearStore() {
  storage = {};
  global.localStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem: function (key, value) { storage[key] = String(value); },
    removeItem: function (key) { delete storage[key]; }
  };
  global.NT.store.reset();
}
function evaluate(rel) { new Function(read(rel))(); }

/* ---------------- DOM and browser APIs used by the static pages ---------------- */
global.document = {
  body: makeEl("body"),
  documentElement: makeEl("html"),
  title: "",
  createElement: function (tag) {
    var element = makeEl(tag);
    created.push(element);
    return element;
  },
  addEventListener: function (name, fn) { (documentListeners[name] = documentListeners[name] || []).push(fn); },
  removeEventListener: function () {},
  querySelector: function (selector) {
    if (!documentQueries[selector]) {
      documentQueries[selector] = makeEl("div");
      registry["document-selector-" + (selectorCount++) + "-" + selector] = documentQueries[selector];
    }
    return documentQueries[selector];
  },
  querySelectorAll: function () { return []; },
  getElementById: byId,
  execCommand: function () { return true; }
};
global.window = global;
global.location = { pathname: "/index.html", search: "", hash: "", href: "http://preview.test/index.html" };
global.history = { replaceState: function () {} };
global.IntersectionObserver = function () { this.observe = function () {}; this.unobserve = function () {}; };
global.matchMedia = function () { return { matches: false, addListener: function () {} }; };
global.requestAnimationFrame = function () { return 0; };
global.URLSearchParams = URLSearchParams;
global.URL = URL;
global.addEventListener = function () {};
global.removeEventListener = function () {};
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;
global.setInterval = setInterval;
global.clearInterval = clearInterval;

/* ---------------- Content-service fixtures ----------------
   One published university with a Semester 1 and a Semester 2 course, three
   published video lessons and one draft, plus a draft university. Field names
   match server/api.js exactly, so a serializer change breaks this smoke run. */
var NOW = "2026-02-14T08:30:00.000Z";

function university(overrides) {
  return Object.assign({
    id: "uni_demo", name: "University of Zambia", shortName: "UNZA", city: "Lusaka", country: "Zambia",
    description: "First-year engineering video lessons, organised by semester.",
    accent: "#0d7ea4", logoUrl: "", position: 0, status: "published", createdAt: NOW, updatedAt: NOW,
    semesters: [
      { semester: 1, courses: 1, videos: 2, durationSeconds: 1620 },
      { semester: 2, courses: 1, videos: 1, durationSeconds: 900 }
    ],
    availableSemesters: [1, 2], courseCount: 2, videoCount: 3, durationSeconds: 2520
  }, overrides || {});
}
function course(overrides) {
  return Object.assign({
    id: "crs_s1", universityId: "uni_demo", universityName: "University of Zambia", universityShortName: "UNZA",
    semester: 1, semesterLabel: "Semester 1", title: "Engineering Mathematics I", code: "EM101",
    subjectId: "mathematics", instructor: "Dr. Banda", description: "Limits, derivatives and integration.",
    position: 0, status: "published", createdAt: NOW, updatedAt: NOW, videoCount: 2, durationSeconds: 1620
  }, overrides || {});
}
function video(overrides) {
  return Object.assign({
    id: "vid_s1_1", courseId: "crs_s1", courseTitle: "Engineering Mathematics I", courseCode: "EM101",
    semester: 1, semesterLabel: "Semester 1", universityId: "uni_demo", universityName: "University of Zambia",
    title: "Limits and continuity", topic: "Calculus", description: "What a limit is and how to evaluate one.",
    url: "https://www.youtube.com/watch?v=ntsample01", provider: "youtube", externalId: "ntsample01",
    embedUrl: "https://www.youtube-nocookie.com/embed/ntsample01?rel=0&modestbranding=1",
    thumbnail: "https://img.youtube.com/vi/ntsample01/hqdefault.jpg", thumbnailUrl: "",
    thumbnailAuto: "https://img.youtube.com/vi/ntsample01/hqdefault.jpg",
    durationSeconds: 754, level: "basic", position: 0, status: "published", createdAt: NOW, updatedAt: NOW
  }, overrides || {});
}

var UNI = university();
var UNI_DRAFT = university({
  id: "uni_draft", name: "Copperbelt University", shortName: "CBU", city: "Kitwe", status: "draft",
  description: "", semesters: [], availableSemesters: [], courseCount: 1, videoCount: 1, durationSeconds: 600, position: 1
});
var CR_S1 = course();
var CR_S2 = course({
  id: "crs_s2", semester: 2, semesterLabel: "Semester 2", title: "Engineering Mathematics II", code: "EM102",
  description: "Series, differential equations and transforms.", position: 1, videoCount: 1, durationSeconds: 900
});
var CR_DRAFT = course({
  id: "crs_draft", universityId: "uni_draft", universityName: "Copperbelt University", universityShortName: "CBU",
  semester: 2, semesterLabel: "Semester 2", title: "Thermodynamics", code: "TH210", subjectId: "physics",
  status: "draft", position: 2, videoCount: 1, durationSeconds: 600
});
var VID_1 = video();
var VID_2 = video({
  id: "vid_s1_2", title: "Differentiation from first principles", topic: "Calculus",
  description: "", url: "https://vimeo.com/900000002", provider: "vimeo", externalId: "900000002",
  embedUrl: "https://player.vimeo.com/video/900000002", thumbnail: "", thumbnailUrl: "", thumbnailAuto: "",
  durationSeconds: 866, level: "premium", position: 1
});
var VID_3 = video({
  id: "vid_s2_1", courseId: "crs_s2", courseTitle: "Engineering Mathematics II", courseCode: "EM102",
  semester: 2, semesterLabel: "Semester 2", title: "Power series", topic: "Series",
  url: "https://example.edu/lectures/power-series.mp4", provider: "file", externalId: "", embedUrl: "",
  thumbnail: "", thumbnailUrl: "", thumbnailAuto: "", durationSeconds: 900, level: "standard", position: 0
});
var VID_DRAFT = video({
  id: "vid_draft", courseId: "crs_draft", courseTitle: "Thermodynamics", courseCode: "TH210",
  universityId: "uni_draft", universityName: "Copperbelt University", title: "First law of thermodynamics",
  status: "draft", level: "basic", durationSeconds: 600, position: 0
});
var ADMIN = { id: "adm_demo", email: "admin@nucleartutorials.local", name: "", role: "admin", createdAt: NOW, lastLoginAt: NOW };

var FIXTURES = {
  "api/health": { ok: true, service: "nuclear-tutorials-content", schemaVersion: 1, time: NOW },
  "api/stats": { universities: 1, courses: 2, videos: 3, durationSeconds: 2520 },
  "api/universities": { universities: [UNI], query: "" },
  "api/universities/uni_demo": {
    university: UNI,
    semesters: [
      { semester: 1, label: "Semester 1", courses: 1, videos: 2, durationSeconds: 1620 },
      { semester: 2, label: "Semester 2", courses: 1, videos: 1, durationSeconds: 900 }
    ],
    courses: [CR_S1, CR_S2]
  },
  "api/courses/crs_s1": { course: CR_S1, university: UNI, videos: [VID_1, VID_2] },
  "api/courses/crs_s2": { course: CR_S2, university: UNI, videos: [VID_3] },
  "api/videos/vid_s1_1": {
    video: VID_1, course: CR_S1, university: UNI, previous: null, next: VID_2,
    playlist: [VID_1, VID_2], position: 1, total: 2
  },
  "api/videos/vid_s2_1": {
    video: VID_3, course: CR_S2, university: UNI, previous: null, next: null,
    playlist: [VID_3], position: 1, total: 1
  },
  "api/library": { universities: [UNI], courses: [CR_S1, CR_S2], videos: [VID_1, VID_2, VID_3] },
  "api/search?q=algebra": { query: "algebra", universities: [UNI], courses: [CR_S1], videos: [VID_1] },
  "api/admin/session": { admin: ADMIN, sessionDays: 14, activeSessions: 1, time: NOW },
  "api/admin/overview": {
    universities: 2, publishedUniversities: 1, courses: 3, publishedCourses: 2,
    semester1Courses: 1, semester2Courses: 2, videos: 4, publishedVideos: 3, draftVideos: 1,
    durationSeconds: 2520, admins: 1, activeSessions: 1,
    byLevel: [
      { level: "basic", count: 1 }, { level: "standard", count: 1 }, { level: "premium", count: 1 }
    ],
    byUniversity: [
      { id: "uni_demo", name: "University of Zambia", status: "published", courses: 2, videos: 3 },
      { id: "uni_draft", name: "Copperbelt University", status: "draft", courses: 1, videos: 1 }
    ],
    recentVideos: [VID_3, VID_2, VID_1],
    checklist: [
      { id: "university", label: "Add a university", done: true, href: "/admin/universities.html" },
      { id: "course", label: "Create a Semester 1 or Semester 2 course", done: true, href: "/admin/courses.html" },
      { id: "video", label: "Add and publish a video lesson", done: true, href: "/admin/videos.html" }
    ]
  },
  "api/admin/universities": { universities: [UNI, UNI_DRAFT] },
  "api/admin/courses": { courses: [CR_S1, CR_S2, CR_DRAFT] },
  "api/admin/videos": { videos: [VID_1, VID_2, VID_3, VID_DRAFT] }
};

function fixtureFor(url) {
  var target = String(url || "")
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/^(\.\.\/)+/, "")
    .replace(/^\//, "");
  if (Object.prototype.hasOwnProperty.call(FIXTURES, target)) return FIXTURES[target];
  var base = target.split("?")[0];
  if (base === "api/search") return FIXTURES["api/search?q=algebra"];
  if (base === "api/universities" || base === "api/library") return FIXTURES[base];
  return null;
}

var fixtureFetch = function (url) {
  var payload = fixtureFor(url);
  return Promise.resolve({
    ok: !!payload,
    status: payload ? 200 : 404,
    headers: { get: function () { return "application/json"; } },
    json: function () { return Promise.resolve(payload || { error: "not-found", message: "That record no longer exists." }); },
    text: function () { return Promise.resolve(""); }
  });
};
global.fetch = fixtureFetch;

function primeCatalogue() {
  global.NT.api.flush();
  Object.keys(FIXTURES).forEach(function (key) { global.NT.api.prime(key, FIXTURES[key]); });
}

["assets/js/icons.js", "assets/js/data.js", "assets/js/store.js", "assets/js/api.js",
 "assets/js/ui.js", "assets/js/video.js", "assets/js/app.js"].forEach(evaluate);

/* ---------------- Public routes ---------------- */
/* Expectations may differ between a visitor and a student with a package. */
function needlesFor(entry, hasAccess) {
  var spec = entry[3] || [];
  if (Array.isArray(spec)) return spec;
  return (spec.all || []).concat(hasAccess ? (spec.package || []) : (spec.visitor || []));
}

var PUBLIC = [
  ["home", "index.html", "", { all: ["stat-strip"], package: ["uni-card", "University of Zambia"] }],
  ["universities", "universities.html", "", ["University of Zambia", "uni-card", "Choose semester"]],
  ["universities", "universities.html", "?q=lusaka", ["uni-card"]],
  ["university", "university.html", "?id=uni_demo", ["University of Zambia", "semester-option", "Engineering Mathematics I"]],
  ["university", "university.html", "?id=uni_demo&semester=2", ["Semester 2", "Engineering Mathematics II"]],
  ["university", "university.html", "?id=not-a-university", ["skeleton"]],
  ["university", "university.html", "", ["Choose a university"]],
  ["courses", "courses.html", "", ["course-"]],
  ["course", "course.html", "?id=math", ["course-hero"]],
  ["course", "course.html", "?id=crs_s1", ["Engineering Mathematics I", "Limits and continuity"]],
  ["course", "course.html", "?id=not-a-course", []],
  ["video", "video.html", "?id=vid_s1_1", ["Limits and continuity", "player", "In this course"]],
  ["video", "video.html", "?id=vid_s2_1", ["Power series", "Semester 2"]],
  ["video", "video.html", "?id=not-a-video", ["skeleton"]],
  ["video", "video.html", "", ["Video lesson not found"]],
  ["library", "library.html", "", ["lib-"]],
  ["library", "library.html", "?tab=videos", ["Limits and continuity"]],
  ["library", "library.html", "?tab=outlines", ["lib-"]],
  ["lesson", "lesson.html", "?id=math-1", []],
  ["lesson", "lesson.html", "?id=not-a-lesson", []],
  ["search", "search.html", "?q=algebra", ["Searching", "result"]],
  ["search", "search.html", "", ["search-start"]],
  ["dashboard", "dashboard.html", "", {
    visitor: ["dashboard-empty", "Log in to continue."],
    package: ["dash-metrics", "dash-continue", "dash-columns", "video lessons watched"]
  }],
  ["profile", "profile.html", "", ["No semester selected", "University of Zambia", "profile-summary-identity"]],
  ["pricing", "pricing.html", "", ["price-card"]],
  ["access", "access.html", "", { visitor: ["access-"], package: ["access-"] }],
  ["checkout", "checkout.html", "?pkg=standard", ["checkout-"]],
  ["checkout", "checkout.html", "?pkg=unknown", []],
  ["announcements", "announcements.html", "", []]
];
console.log("== Public render smoke ==");
PUBLIC.forEach(function (entry) {
  [false, true].forEach(function (hasAccess) {
    try {
      clearStore();
      primeCatalogue();
      if (hasAccess) {
        global.NT.store.mutate(function (state) {
          state.profile.educationLevel = "university";
          state.access = "standard";
          state.accessMeta = { source: "access-code", code: "NT-STANDARD-4826", since: NOW };
        });
      }
      resetDom(entry[0]);
      global.location = { pathname: "/" + entry[1], search: entry[2], hash: "", href: "http://preview.test/" + entry[1] + entry[2] };
      runDomReady();
      var html = collectHtml();
      var label = entry[1] + entry[2] + (hasAccess ? " [package]" : " [visitor]");
      ok(html.length > 80, label + " renders markup");
      ok(html.indexOf("undefined") === -1, label + " contains no undefined values");
      ok(html.indexOf("NaN") === -1, label + " contains no invalid numbers");
      needlesFor(entry, hasAccess).forEach(function (needle) {
        ok(html.indexOf(needle) !== -1, label + " shows " + needle);
      });
    } catch (error) {
      ok(false, entry[1] + entry[2] + (hasAccess ? " [package]" : " [visitor]") + " throws: " + error.stack);
    }
  });
});

/* The catalogue must never come from a browser: with an empty store and no
   fixture cache the pages still render honest loading and error states. */
console.log("\n== Offline catalogue smoke ==");
[["universities", "universities.html"], ["library", "library.html"], ["dashboard", "dashboard.html"]].forEach(function (entry) {
  try {
    clearStore();
    global.NT.api.flush();
    var offlineFetch = global.fetch;
    global.fetch = function () { return Promise.reject(new Error("offline")); };
    resetDom(entry[0]);
    global.location = { pathname: "/" + entry[1], search: "", hash: "", href: "http://preview.test/" + entry[1] };
    runDomReady();
    var html = collectHtml();
    ok(html.length > 40 && html.indexOf("undefined") === -1, entry[1] + " paints a state without the content service");
    global.fetch = offlineFetch;
  } catch (error) {
    global.fetch = fixtureFetch;
    ok(false, entry[1] + " throws offline: " + error.stack);
  }
});

/* Ensure old simulated purchases and player records are discarded without
   dropping locally generated preview codes or lesson-level overrides. */
console.log("\n== Local-state migration smoke ==");
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
  var migrated = global.NT.store.get();
  ok(migrated.access === null && migrated.accessMeta === null, "simulated payment access is not carried forward");
  ok(!migrated.payments && !migrated.students && !migrated.completed && !migrated.extraLessons, "obsolete simulated records are removed");
  ok(migrated.codes.length === 1 && migrated.codes[0].code === "NT-BASIC-9371", "locally generated preview codes are preserved");
  ok(migrated.lessonLevels["math-1"] === "premium" && !migrated.videoLevels, "old lesson overrides migrate to the lesson-level field");
  ok(migrated.profile.educationLevel === "university" && !migrated.profile.levelId && !migrated.profile.university, "education level remains while obsolete profile fields are removed");
  ok(migrated.settings.email === "" && !migrated.settings.name && !migrated.settings.currency, "fabricated contact and unused settings are removed");
  ok(!migrated.universities && !migrated.courses && !migrated.videos, "no catalogue content is stored in the browser");
} catch (error) {
  ok(false, "local-state migration throws: " + error.stack);
}

/* Exercise the real education-level + access-code submit handler. */
console.log("\n== Access flow smoke ==");
try {
  clearStore();
  primeCatalogue();
  global.NT.store.addCode("NT-STANDARD-4826", "standard", "unused");
  educationRadios = [
    Object.assign(makeEl("input"), { value: "high-school", checked: false }),
    Object.assign(makeEl("input"), { value: "university", checked: false })
  ];
  documentListeners = {};
  resetDom("access");
  global.location = { pathname: "/access.html", search: "", hash: "", href: "http://preview.test/access.html" };
  evaluate("assets/js/app.js");
  runDomReady();
  var form = byId("codeForm");
  var codeInput = byId("codeInput");
  codeInput.value = "NT-STANDARD-4826";
  form.dispatch("submit", { preventDefault: function () {} });
  ok(byId("codeMsg").innerHTML.indexOf("Choose your level") !== -1, "submitting without a level is rejected accessibly");
  ok(global.NT.store.get().access === null, "missing level does not grant package access");

  educationRadios[1].checked = true;
  form.dispatch("submit", { preventDefault: function () {} });
  var state = global.NT.store.get();
  ok(state.profile.educationLevel === "university", "selected education level persists in profile state");
  ok(state.access === "standard", "valid code retains existing package access behavior");
  ok(global.NT.store.findCode("NT-STANDARD-4826").status === "redeemed", "code redemption is recorded locally");
  ok(byId("codeResult").innerHTML.indexOf("courses.html?level=university") !== -1, "success route uses the selected education level");
} catch (error) {
  ok(false, "access-code flow throws: " + error.stack);
}

/* ---------------- Administrator routes ----------------
   api/admin/session is primed so the sign-in gate resolves immediately, which
   is what a signed-in administrator experiences. */
console.log("\n== Administrator render smoke ==");
var ADMIN_ROUTES = [
  ["home", "", ["Server database", "adm-metrics", "Getting started"]],
  ["universities", "", ["University of Zambia", "Copperbelt University", "Add university"]],
  ["courses", "", ["Engineering Mathematics I", "Semester 2", "Add course"]],
  ["videos", "", ["Where does this video lesson belong?", "All video lessons", "Limits and continuity"]],
  ["videos", "?university=uni_demo&semester=1&course=crs_s1", ["Adding to:", "Add a video lesson", "Differentiation from first principles"]],
  ["videos", "?university=uni_demo&semester=2&course=crs_s2", ["Semester 2", "Power series"]],
  ["lessons", "", ["Lesson access"]],
  ["announcements", "", []],
  ["packages", "", []],
  ["codes", "", []],
  ["settings", "", ["Admin sign-in", "Content service", "Connected"]],
  ["login", "", ["First run?", "data/first-run-admin.txt"]]
];
ADMIN_ROUTES.forEach(function (entry) {
  var page = entry[0];
  var search = entry[1] || "";
  try {
    clearStore();
    primeCatalogue();
    documentListeners = {};
    resetDom(page);
    var file = page === "home" ? "index.html" : page + ".html";
    global.location = {
      pathname: "/admin/" + file, search: search, hash: "",
      href: "http://preview.test/admin/" + file + search
    };
    evaluate("assets/js/admin.js");
    runDomReady();
    var html = collectHtml();
    var label = "admin/" + file + search;
    ok(html.length > 80, label + " renders markup");
    ok(html.indexOf("undefined") === -1, label + " contains no undefined values");
    ok(html.indexOf("NaN") === -1, label + " contains no invalid numbers");
    (entry[2] || []).forEach(function (needle) {
      ok(html.indexOf(needle) !== -1, label + " shows " + needle);
    });
  } catch (error) {
    ok(false, "admin/" + page + search + " throws: " + error.stack);
  }
});

/* Without a session every administrator route must show the sign-in notice
   instead of content — this is what keeps admin controls away from students. */
console.log("\n== Administrator gate smoke ==");
["home", "universities", "courses", "videos", "settings"].forEach(function (page) {
  try {
    clearStore();
    global.NT.api.flush();
    global.NT.api.prime("api/admin/session", { admin: null, sessionDays: 14, activeSessions: 0, time: NOW });
    documentListeners = {};
    resetDom(page);
    var file = page === "home" ? "index.html" : page + ".html";
    global.location = { pathname: "/admin/" + file, search: "", hash: "", href: "http://preview.test/admin/" + file };
    evaluate("assets/js/admin.js");
    runDomReady();
    var html = collectHtml();
    ok(html.indexOf("Administrator sign-in required") !== -1, "admin/" + file + " asks for a session");
    ok(html.indexOf("login.html?next=") !== -1, "admin/" + file + " links to the sign-in page");
  } catch (error) {
    ok(false, "admin/" + page + " gate throws: " + error.stack);
  }
});

/* The server sends unauthenticated administrators to login.html?next=/admin/….
   The sign-in page must honour that target and refuse anything external. */
console.log("\n== Sign-in redirect smoke ==");
[["", "index.html"],
 ["?next=%2Fadmin%2Fvideos.html", "videos.html"],
 ["?next=%2Fadmin%2Fcourses.html%3Funiversity%3Duni_1", "courses.html?university=uni_1"],
 ["?next=videos.html%3Fcourse%3Dcrs_s1", "videos.html?course=crs_s1"],
 ["?next=//evil.example/x.html", "index.html"],
 ["?next=https%3A%2F%2Fevil.example%2Fa.html", "index.html"]].forEach(function (entry) {
  try {
    clearStore();
    primeCatalogue();
    documentListeners = {};
    resetDom("login");
    global.location = {
      pathname: "/admin/login.html", search: entry[0], hash: "",
      href: "http://preview.test/admin/login.html" + entry[0]
    };
    evaluate("assets/js/admin.js");
    runDomReady();
    var links = created.filter(function (element) {
      return String(element.className).indexOf("btn-block") !== -1;
    });
    var href = links.length ? links[links.length - 1].href : "";
    ok(href === entry[1], "sign-in continues to " + entry[1] +
      (entry[0] ? " for next=" + entry[0] : " by default") + (href === entry[1] ? "" : " (got " + href + ")"));
  } catch (error) {
    ok(false, "sign-in redirect throws: " + error.stack);
  }
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
