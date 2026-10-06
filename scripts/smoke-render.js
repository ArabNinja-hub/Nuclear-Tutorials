#!/usr/bin/env node
/* ============================================================
   Render smoke test

   Runs the real front-end scripts (icons → data → store → api →
   ui → app/admin) against a minimal DOM and a stubbed fetch that
   serves fixtures shaped exactly like the Nuclear Tutorials API.
   Every public page and every admin route is rendered as a
   visitor and as a signed-in student, checking for broken markup.
   ============================================================ */
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
var learnerRadios = [];
var fetchLog = [];
var redirected = "";
var fakeAccount = null;
var lastAuthBody = null;
var loginLearnerType = "university";
process.on("unhandledRejection", function (error) { console.error("  UNHANDLED  " + ((error && error.stack) || error)); });

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function ok(condition, label) {
  if (condition) { passed++; }
  else { failed++; console.error("  FAIL  " + label); }
}
function group(label) { console.log("\n== " + label + " =="); }

/* ---------------- minimal DOM ---------------- */

function makeEl(tag) {
  var el = {
    tagName: String(tag || "div").toUpperCase(),
    children: [], innerHTML: "", textContent: "", value: "", className: "", id: "", href: "",
    dataset: {}, style: {}, attributes: {}, listeners: {}, checked: false, disabled: false, hidden: false,
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
    contains: function () { return false; },
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
      if (selector === 'input[name="learnerType"]') return learnerRadios;
      return [];
    }
  };
  return el;
}

function byId(id) {
  if (!registry[id]) registry[id] = makeEl("div");
  return registry[id];
}

function resetDom(page, kind) {
  registry = {};
  documentQueries = {};
  global.document.body = makeEl("body");
  global.document.body.dataset.page = kind === "admin" ? "" : (page || "");
  global.document.body.dataset.admin = kind === "admin" ? page : "";
  global.document.title = "";
}

function collectHtml(pageFile) {
  var output = [];
  if (pageFile) {
    try { output.push(read(pageFile)); } catch (error) { /* page shell is optional */ }
  }
  Object.keys(registry).forEach(function (key) { output.push(registry[key].innerHTML || ""); });
  (global.document.body.children || []).forEach(function (child) { output.push(child.innerHTML || ""); });
  return output.join("\n");
}

function runDomReady() { (documentListeners.DOMContentLoaded || []).forEach(function (fn) { fn(); }); }
function evaluate(rel) { new Function(read(rel))(); }

function installStorage() {
  storage = {};
  global.localStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem: function (key, value) { storage[key] = String(value); },
    removeItem: function (key) { delete storage[key]; }
  };
}

/* ---------------- fixtures shaped like the API ---------------- */

var UNZA = {
  id: "unza", slug: "unza", name: "University of Zambia", shortName: "UNZA", city: "Lusaka",
  level: "university", summary: "Engineering and natural sciences.", accent: "#0d7ea4",
  position: 10, courseCount: 2, videoCount: 3
};
var SCHOOL = {
  id: "secondary", slug: "secondary", name: "Secondary School Programme", shortName: "Secondary",
  city: "Zambia", level: "high-school", summary: "Grades 10 to 12.", accent: "#4c5fa8",
  position: 40, courseCount: 0, videoCount: 0
};
var MTH101 = {
  id: "unza-mth1010", universityId: "unza", universityName: "University of Zambia", universityShort: "UNZA",
  universityLevel: "university", semester: 1, code: "MTH 1010", title: "Mathematics I",
  description: "Single variable calculus for engineers.", icon: "calculator", tint: "#e8f6fb", tintFg: "#0a6788",
  position: 10, videoCount: 3, publishedCount: 3
};
var PHY102 = {
  id: "unza-phy1020", universityId: "unza", universityName: "University of Zambia", universityShort: "UNZA",
  universityLevel: "university", semester: 2, code: "PHY 1020", title: "Electricity and Magnetism",
  description: "Fields, circuits and electromagnetic waves.", icon: "atom", tint: "#eceefb", tintFg: "#4c5fa8",
  position: 10, videoCount: 1, publishedCount: 1
};
function makeVideo(overrides) {
  return Object.assign({
    id: "unza-mth1010-v1", courseId: "unza-mth1010", courseTitle: "Mathematics I", courseCode: "MTH 1010",
    universityId: "unza", universityName: "University of Zambia", universityShort: "UNZA",
    universityLevel: "university", semester: 1, title: "Limits and continuity",
    topic: "MIT 18.01 · Lecture 2", description: "How limits define derivatives.",
    sourceUrl: "https://www.youtube.com/watch?v=ryLdyDrBfvI", provider: "youtube",
    thumbnailUrl: "https://i.ytimg.com/vi/ryLdyDrBfvI/hqdefault.jpg", durationSeconds: 2892,
    level: "basic", position: 10, published: true,
    createdAt: "2026-09-01T08:00:00.000Z", updatedAt: "2026-09-01T08:00:00.000Z"
  }, overrides || {});
}
var VIDEOS = [
  makeVideo({}),
  makeVideo({ id: "unza-mth1010-v2", title: "The derivative as a function", topic: "MIT 18.01 · Lecture 3", level: "standard", position: 20, durationSeconds: 2900 }),
  makeVideo({ id: "unza-mth1010-v3", title: "Applying differentiation", topic: "MIT 18.01 · Lecture 4", level: "premium", position: 30, durationSeconds: 3010 }),
  makeVideo({ id: "unza-phy1020-v1", courseId: "unza-phy1020", courseTitle: "Electricity and Magnetism", courseCode: "PHY 1020", semester: 2, title: "Electric charge and fields", topic: "MIT 8.02 · Lecture 1" })
];
var CATALOGUE = {
  universities: [UNZA], schools: [SCHOOL], courses: [MTH101, PHY102], videos: VIDEOS,
  totals: { universities: 1, schools: 1, courses: 2, videos: 4, levels: { basic: 2, standard: 1, premium: 1 } },
  generatedAt: "2026-10-01T00:00:00.000Z"
};
var SETTINGS = {
  supportEmail: "support@nucleartutorials.zm", accessDays: 180,
  packages: { basic: { name: "Basic", price: 150, tagline: "Start watching.", features: ["Introductory lessons"] } }
};
var ANNOUNCEMENTS = [{ id: "notice-1", title: "Semester 2 lessons published", body: "New lectures are live.", status: "published", createdAt: "2026-09-20T08:00:00.000Z", updatedAt: "2026-09-20T08:00:00.000Z" }];
var PROGRESS = [{ videoId: "unza-mth1010-v1", completed: true, seconds: 2892, updatedAt: "2026-09-25T10:00:00.000Z" }];

var ADMIN_PAYLOADS = {
  "/api/admin/overview": {
    totals: { universities: 1, schools: 1, courses: 2, videos: 4, published: 4, drafts: 0, codes: 3, codesRedeemed: 1, students: 1, views: 1 },
    semesters: [{ semester: 1, courses: 1, videos: 3 }, { semester: 2, courses: 1, videos: 1 }],
    recentVideos: VIDEOS.slice(0, 2), universities: [UNZA, SCHOOL]
  },
  "/api/admin/universities": { universities: [UNZA, SCHOOL] },
  "/api/admin/courses": { courses: [MTH101, PHY102] },
  "/api/admin/videos": { videos: VIDEOS },
  "/api/admin/codes": { codes: [{ code: "NT-STANDARD-4826", package: "standard", status: "redeemed", issuedAt: "2026-09-01T08:00:00.000Z", redeemedAt: "2026-09-02T08:00:00.000Z" }] },
  "/api/admin/announcements": { announcements: ANNOUNCEMENTS },
  "/api/admin/settings": { settings: SETTINGS },
  "/api/admin/session": { authenticated: true }
};
var ADMIN_UNIVERSITY = Object.assign({}, UNZA);
var ADMIN_COURSE = Object.assign({}, MTH101);
var ADMIN_VIDEO = Object.assign({}, VIDEOS[0]);

/* Package tiers exactly like the server: a code's package limits which
   lessons are returned with their source URL. */
var TIER = { basic: 1, standard: 2, premium: 3 };
/* Only the code this fixture server actually issued counts — exactly like the
   real server, which looks the code up in the database. */
var ISSUED_CODE = "NT-STANDARD-4826";
function codeLevel(init) {
  var header = ((init && init.headers) || {})["X-NT-Code"] || "";
  return String(header).toUpperCase() === ISSUED_CODE ? TIER.standard : 0;
}
function protect(video, level) {
  var allowed = level >= (TIER[video.level] || 1);
  return Object.assign({}, video, {
    locked: !allowed,
    sourceUrl: allowed ? video.sourceUrl : null,
    provider: allowed ? video.provider : null,
    thumbnailUrl: allowed ? video.thumbnailUrl : null
  });
}
function protectAll(videos, level) { return videos.map(function (video) { return protect(video, level); }); }

function jsonResponse(payload, status) {
  return {
    ok: (status || 200) < 400,
    status: status || 200,
    text: function () { return Promise.resolve(JSON.stringify(payload)); }
  };
}

function requestBody(init) {
  try { return JSON.parse(init && init.body || "{}"); } catch (error) { return {}; }
}
function fakeAuthPayload() {
  return {
    ok: true,
    authenticated: !!fakeAccount,
    user: fakeAccount ? Object.assign({}, fakeAccount) : null,
    access: fakeAccount && fakeAccount.access ? Object.assign({}, fakeAccount.access) : { active: false, package: null, level: 0 }
  };
}
function fakeLearner(learnerType, access) {
  return {
    id: "smoke-learner",
    email: "learner@example.test",
    displayName: "Test Learner",
    learnerType: learnerType || null,
    profile: { institutionId: learnerType === "university" ? "unza" : "", semester: learnerType === "university" ? 1 : 0 },
    access: access || null
  };
}

global.fetch = function (url, init) {
  var method = (init && init.method) || "GET";
  var resolved = new URL(String(url), global.location.href);
  var target = resolved.pathname;
  fetchLog.push(method + " " + target + resolved.search);

  if (target === "/api/auth/me") return Promise.resolve(jsonResponse(fakeAuthPayload()));
  if (target === "/api/auth/register") {
    lastAuthBody = requestBody(init);
    var linkedAccess = lastAuthBody.accessCode === "NT-STANDARD-4826"
      ? { active: true, code: "NT-STANDARD-4826", package: "standard", level: 2, since: "2026-10-01T00:00:00.000Z", expiresAt: "2027-03-30T00:00:00.000Z" }
      : null;
    fakeAccount = fakeLearner(null, linkedAccess);
    return Promise.resolve(jsonResponse(fakeAuthPayload(), 201));
  }
  if (target === "/api/auth/login") {
    lastAuthBody = requestBody(init);
    fakeAccount = fakeLearner(loginLearnerType, { active: true, code: "NT-STANDARD-4826", package: "standard", level: 2, since: "2026-10-01T00:00:00.000Z", expiresAt: "2027-03-30T00:00:00.000Z" });
    return Promise.resolve(jsonResponse(fakeAuthPayload()));
  }
  if (target === "/api/auth/learner-type") {
    lastAuthBody = requestBody(init);
    if (fakeAccount) fakeAccount.learnerType = lastAuthBody.learnerType || null;
    return Promise.resolve(jsonResponse({ ok: true, user: fakeAccount }));
  }
  if (target === "/api/auth/profile") {
    lastAuthBody = requestBody(init);
    if (fakeAccount) {
      if (lastAuthBody.displayName != null) fakeAccount.displayName = lastAuthBody.displayName;
      fakeAccount.profile = Object.assign({}, fakeAccount.profile, {
        institutionId: lastAuthBody.institutionId || "",
        semester: Number(lastAuthBody.semester) || 0
      });
    }
    return Promise.resolve(jsonResponse({ ok: true, user: fakeAccount }));
  }
  if (target === "/api/auth/logout") {
    fakeAccount = null;
    return Promise.resolve(jsonResponse({ ok: true, authenticated: false, user: null }));
  }
  if (target === "/api/catalogue") {
    var level = codeLevel(init);
    var currentUser = global.NT && global.NT.auth ? global.NT.auth.user() : null;
    var learnerType = currentUser && currentUser.learnerType;
    var scopedCatalogue = learnerType === "high_school"
      ? Object.assign({}, CATALOGUE, { universities: [], schools: [SCHOOL], courses: [], videos: [], totals: { universities: 0, schools: 1, courses: 0, videos: 0, levels: { basic: 0, standard: 0, premium: 0 } } })
      : (learnerType === "university"
        ? Object.assign({}, CATALOGUE, { schools: [], videos: protectAll(VIDEOS.filter(function (video) { return video.universityLevel === "university"; }), level) })
        : Object.assign({}, CATALOGUE, { videos: protectAll(CATALOGUE.videos, level) }));
    return Promise.resolve(jsonResponse({
      ok: true,
      catalogue: scopedCatalogue,
      settings: SETTINGS,
      access: level ? { active: true, package: ["", "basic", "standard", "premium"][level], level: level, code: "NT-STANDARD-4826" } : { active: false, package: null, level: 0 },
      learnerType: learnerType || null
    }));
  }
  if (/^\/api\/videos\/[^/]+$/.test(target)) {
    var currentLearner = global.NT && global.NT.auth ? global.NT.auth.user() : null;
    var wanted = decodeURIComponent(target.split("/").pop());
    var found = VIDEOS.filter(function (video) { return video.id === wanted; })[0];
    if (currentLearner && currentLearner.learnerType === "high_school") found = null;
    if (!found) return Promise.resolve(jsonResponse({ ok: false, error: "That video lesson could not be found." }, 404));
    var tier = codeLevel(init);
    if (tier < (TIER[found.level] || 1)) {
      return Promise.resolve(jsonResponse({
        ok: false,
        error: "This lesson is included with the " + found.level + " package.",
        details: { locked: true, video: { id: found.id, title: found.title, level: found.level, courseId: found.courseId, semester: found.semester } }
      }, 403));
    }
    var siblings = VIDEOS.filter(function (video) { return video.courseId === found.courseId; });
    var position = siblings.map(function (video) { return video.id; }).indexOf(found.id);
    return Promise.resolve(jsonResponse({
      ok: true,
      video: protect(found, tier),
      access: { active: true, package: ["", "basic", "standard", "premium"][tier], level: tier },
      course: MTH101.id === found.courseId ? MTH101 : PHY102,
      university: UNZA,
      lessons: protectAll(siblings, tier),
      previous: position > 0 ? protect(siblings[position - 1], tier) : null,
      next: position < siblings.length - 1 ? protect(siblings[position + 1], tier) : null
    }));
  }
  if (target === "/api/announcements") return Promise.resolve(jsonResponse({ ok: true, announcements: ANNOUNCEMENTS }));
  if (target === "/api/search") {
    var searchUser = global.NT && global.NT.auth ? global.NT.auth.user() : null;
    return Promise.resolve(jsonResponse(searchUser && searchUser.learnerType === "high_school"
      ? { ok: true, universities: [], courses: [], videos: [], announcements: [] }
      : { ok: true, universities: [UNZA], courses: [MTH101], videos: [VIDEOS[0]], announcements: [] }));
  }
  if (target === "/api/codes/issue") return Promise.resolve(jsonResponse({ ok: true, code: "NT-STANDARD-4826", package: "standard" }, 201));
  if (target === "/api/access/redeem") {
    return Promise.resolve(jsonResponse({
      ok: true,
      access: { code: "NT-STANDARD-4826", package: "standard", educationLevel: "university", since: "2026-10-01T00:00:00.000Z", expiresAt: "2027-03-30T00:00:00.000Z", accessDays: 180 }
    }));
  }
  if (target === "/api/progress" && method === "GET") return Promise.resolve(jsonResponse({ ok: true, progress: PROGRESS }));
  if (target === "/api/progress" && method === "POST") return Promise.resolve(jsonResponse({ ok: true, progress: PROGRESS }));
  if (target === "/api/settings") return Promise.resolve(jsonResponse({ ok: true, settings: SETTINGS }));

  if (target === "/api/admin/session" && process.env.SMOKE_SIGNED_OUT === "1") {
    return Promise.resolve(jsonResponse({ ok: true, authenticated: false }));
  }
  if (ADMIN_PAYLOADS[target] && method === "GET") return Promise.resolve(jsonResponse(ADMIN_PAYLOADS[target]));
  if (target === "/api/admin/login") return Promise.resolve(jsonResponse({ ok: true, session: { authenticated: true } }));
  if (target === "/api/admin/logout") return Promise.resolve(jsonResponse({ ok: true }));
  if (target === "/api/admin/session") {
    if (process.env.SMOKE_SIGNED_OUT === "1") return Promise.resolve(jsonResponse({ ok: true, authenticated: false }));
    return Promise.resolve(jsonResponse(ADMIN_PAYLOADS[target]));
  }
  if (target === "/api/admin/universities") {
    if (method === "POST") return Promise.resolve(jsonResponse({ ok: true, university: ADMIN_UNIVERSITY }, 201));
    return Promise.resolve(jsonResponse(ADMIN_PAYLOADS[target]));
  }
  if (/^\/api\/admin\/universities\//.test(target)) return Promise.resolve(jsonResponse({ ok: true, university: ADMIN_UNIVERSITY }));
  if (target === "/api/admin/courses") {
    if (method === "POST") return Promise.resolve(jsonResponse({ ok: true, course: ADMIN_COURSE }, 201));
    return Promise.resolve(jsonResponse(ADMIN_PAYLOADS[target]));
  }
  if (/^\/api\/admin\/courses\//.test(target)) return Promise.resolve(jsonResponse({ ok: true, course: ADMIN_COURSE }));
  if (target === "/api/admin/videos") {
    if (method === "POST") return Promise.resolve(jsonResponse({ ok: true, video: ADMIN_VIDEO }, 201));
    return Promise.resolve(jsonResponse(ADMIN_PAYLOADS[target]));
  }
  if (/^\/api\/admin\/videos\/[^/]+\/move$/.test(target)) return Promise.resolve(jsonResponse({ ok: true, videos: VIDEOS }));
  if (/^\/api\/admin\/videos\//.test(target)) return Promise.resolve(jsonResponse({ ok: true, video: ADMIN_VIDEO }));
  if (target === "/api/admin/codes") return Promise.resolve(jsonResponse(ADMIN_PAYLOADS[target]));
  if (/^\/api\/admin\/codes\//.test(target)) return Promise.resolve(jsonResponse({ ok: true, deleted: true }));
  if (target === "/api/admin/announcements") return Promise.resolve(jsonResponse(ADMIN_PAYLOADS[target]));
  if (/^\/api\/admin\/announcements\//.test(target)) return Promise.resolve(jsonResponse({ ok: true, id: "notice-1" }));
  if (target === "/api/admin/settings") return Promise.resolve(jsonResponse(ADMIN_PAYLOADS[target]));
  if (target === "/api/admin/password") return Promise.resolve(jsonResponse({ ok: true, changed: true }));
  return Promise.resolve(jsonResponse({ ok: false, error: "Unknown route: " + target }, 404));
};

/* ------------------------------------------------------------
   Live mode: SMOKE_BASE=http://host:port renders the same pages
   against the running server instead of the fixtures.
   ------------------------------------------------------------ */
var LIVE = process.env.SMOKE_BASE ? process.env.SMOKE_BASE.replace(/\/$/, "") : "";

if (LIVE) {
  var httpModule = require("http");
  global.fetch = function (url, init) {
    var resolved = new URL(String(url), global.location.href);
    var target = resolved.pathname + resolved.search;
    fetchLog.push(((init && init.method) || "GET") + " " + target);
    return new Promise(function (resolve, reject) {
      var req = httpModule.request(LIVE + target, {
        method: (init && init.method) || "GET",
        headers: (init && init.headers) || {}
      }, function (res) {
        var chunks = [];
        res.on("data", function (chunk) { chunks.push(chunk); });
        res.on("end", function () {
          var raw = Buffer.concat(chunks).toString("utf8");
          resolve({ ok: res.statusCode < 400, status: res.statusCode, text: function () { return Promise.resolve(raw); } });
        });
      });
      req.on("error", function (error) { reject(error); });
      req.setTimeout(8000, function () { req.destroy(new Error("timeout")); });
      if (init && init.body) req.write(init.body);
      req.end();
    });
  };
}

/* ---------------- browser globals ---------------- */

global.document = {
  body: makeEl("body"),
  documentElement: makeEl("html"),
  title: "",
  createElement: makeEl,
  addEventListener: function (name, fn) { (documentListeners[name] = documentListeners[name] || []).push(fn); },
  removeEventListener: function () {},
  querySelector: function (selector) {
    if (!documentQueries[selector]) documentQueries[selector] = makeEl("div");
    return documentQueries[selector];
  },
  querySelectorAll: function () { return []; },
  getElementById: byId,
  execCommand: function () { return true; }
};
global.window = global;
global.location = {
  pathname: "/index.html", search: "", hash: "", href: "http://preview.test/index.html",
  replace: function (href) { redirected = href; }
};
global.history = { replaceState: function () {} };
try { Object.defineProperty(global, "navigator", { value: { clipboard: null }, configurable: true }); } catch (error) { /* readonly in newer Node */ }
global.IntersectionObserver = function () { this.observe = function () {}; this.unobserve = function () {}; };
global.matchMedia = function () { return { matches: false, addListener: function () {} }; };
global.requestAnimationFrame = function () { return 0; };
global.URLSearchParams = URLSearchParams;
global.URL = URL;
global.addEventListener = function () {};
global.removeEventListener = function () {};
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;

installStorage();

["assets/js/icons.js", "assets/js/data.js", "assets/js/store.js", "assets/js/api.js", "assets/js/ui.js", "assets/js/app.js"].forEach(evaluate);

function signIn(learnerType) {
  if (learnerType === undefined) learnerType = "university";
  var access = {
    active: true,
    code: "NT-STANDARD-4826",
    package: "standard",
    level: 2,
    since: "2026-10-01T00:00:00.000Z",
    expiresAt: "2027-03-30T00:00:00.000Z"
  };
  fakeAccount = fakeLearner(learnerType, access);
  global.NT.auth.set({ authenticated: true, user: fakeAccount, access: access });
}

function signOut() {
  fakeAccount = null;
  global.NT.store.reset();
  global.NT.auth.set({ authenticated: false, user: null, access: null });
}

/* ---------------- public and authenticated routes ---------------- */

group("Public and learner render smoke");
var PUBLIC = [
  { page: "home", file: "index.html", needles: ["Learn smarter.", "Get Started", "Log In", "Structured lessons"] },
  { page: "about", file: "about.html", needles: ["Learning should feel clear", "organized courses", "Get Started"] },
  { page: "signup", file: "signup.html", needles: ["Create an account", "Existing access code"] },
  { page: "login", file: "login.html", needles: ["Continue your learning", "Email address"] },
  { page: "onboarding", file: "learner-type.html", protected: true, untypedNeedles: ["What are you studying?", "University", "High School"] },
  { page: "pricing", file: "pricing.html", needles: ["Access packages", "Basic", "Standard", "Premium"], signedNeedles: ["Current package"] },
  { page: "courses", file: "courses.html", query: "", protected: true, signedNeedles: ["Mathematics I", "Semester 1"] },
  { page: "courses", file: "courses.html", query: "?university=unza&semester=2", protected: true, signedNeedles: ["Electricity and Magnetism", "Semester 2"] },
  { page: "course", file: "course.html", query: "?id=unza-mth1010", protected: true, signedNeedles: ["Limits and continuity", "Video lessons", "Continue this course"] },
  { page: "course", file: "course.html", query: "?id=not-a-course", protected: true, signedNeedles: ["Course not found"] },
  { page: "lesson", file: "lesson.html", query: "?id=unza-mth1010-v1", protected: true, signedNeedles: ["About this lesson", "Watched"] },
  { page: "lesson", file: "lesson.html", query: "?id=not-a-lesson", protected: true, signedNeedles: ["Lesson not found"] },
  { page: "library", file: "library.html", protected: true, signedNeedles: ["Limits and continuity"] },
  { page: "dashboard", file: "dashboard.html", protected: true, signedNeedles: ["Welcome back", "Learning profile"] },
  { page: "checkout", file: "checkout.html", query: "?pkg=standard", protected: true, signedNeedles: ["Standard package", "Generate access code"] },
  { page: "checkout", file: "checkout.html", query: "?pkg=unknown", protected: true, signedNeedles: ["Choose a package first"] },
  { page: "access", file: "access.html", protected: true, signedNeedles: ["Redeem an access code", "Access code"] },
  { page: "profile", file: "profile.html", protected: true, signedNeedles: ["What are you studying?", "University", "Standard"] },
  { page: "search", file: "search.html", query: "?q=Mathematics", protected: true, signedNeedles: ["Mathematics I"] },
  { page: "announcements", file: "announcements.html", protected: true, signedNeedles: ["Semester 2 lessons published"] }
];

var chain = Promise.resolve();

function renderScenario(entry, mode, expectedNeedles, expectedRedirect) {
  var stateLabel = mode === "visitor" ? "visitor" : (mode === "untyped" ? "untyped account" : mode);
  var label = entry.file + (entry.query || "") + " [" + stateLabel + "]";
  installStorage();
  signOut();
  if (mode === "learner" || mode === "high_school") signIn(mode === "high_school" ? "high_school" : "university");
  if (mode === "untyped") signIn(null);
  fetchLog = [];
  redirected = "";
  resetDom(entry.page, "public");
  global.location.pathname = "/" + entry.file;
  global.location.search = entry.query || "";
  global.location.href = "http://preview.test/" + entry.file + (entry.query || "");

  var refreshed = LIVE ? Promise.resolve() : global.NT.content.reload();
  return refreshed.then(function () {
    runDomReady();
    return drain(45).then(function () {
      var html = collectHtml(entry.file);
      ok(html.length > 400, label + " renders a page shell");
      ok(html.indexOf("undefined") === -1, label + " contains no undefined values");
      ok(html.indexOf("NaN") === -1, label + " contains no invalid numbers");
      (expectedNeedles || []).forEach(function (needle) {
        ok(html.indexOf(needle) !== -1, label + " shows " + JSON.stringify(needle));
      });
      if (expectedRedirect) {
        ok(redirected.indexOf(expectedRedirect) !== -1,
          label + " redirects to " + expectedRedirect + (redirected ? " (" + redirected + ")" : ""));
      }
      if (mode === "high_school") {
        ok(html.indexOf("University of Zambia") === -1 && html.indexOf("Mathematics I") === -1,
          label + " excludes university catalogue content");
      }
    });
  });
}

function renderPublicRoutes() {
  var steps = Promise.resolve();
  PUBLIC.forEach(function (entry) {
    if (LIVE) {
      steps = steps.then(function () {
        var visitorNeedles = entry.protected ? [] : entry.needles;
        return renderScenario(entry, "visitor", visitorNeedles, entry.protected ? "login.html" : "");
      });
      return;
    }

    if (entry.protected) {
      steps = steps.then(function () { return renderScenario(entry, "visitor", [], "login.html"); });
      if (entry.page === "onboarding") {
        steps = steps.then(function () { return renderScenario(entry, "untyped", entry.untypedNeedles, ""); });
      } else {
        steps = steps.then(function () { return renderScenario(entry, "learner", entry.signedNeedles, ""); });
      }
      if (entry.page === "courses" && entry.query === "") {
        steps = steps.then(function () {
          return renderScenario(entry, "high_school", [], "").then(function () {
            var html = collectHtml(entry.file);
            ok(html.indexOf("University of Zambia") === -1 && html.indexOf("Mathematics I") === -1,
              "courses.html [high-school learner] excludes university catalogue content");
          });
        });
      }
    } else {
      steps = steps.then(function () { return renderScenario(entry, "visitor", entry.needles, ""); });
      if (entry.signedNeedles) {
        steps = steps.then(function () { return renderScenario(entry, "learner", entry.signedNeedles, ""); });
      }
      if (entry.page === "signup" || entry.page === "login") {
        steps = steps.then(function () {
          return renderScenario(entry, "untyped", [], entry.page === "signup" ? "learner-type.html" : "learner-type.html");
        });
      }
    }
  });
  return steps;
}

chain = chain.then(renderPublicRoutes);

chain = chain.then(function () {
  if (LIVE) { console.log("\n== Account onboarding ==\n  SKIP  exercised by the live API flow checks"); return; }
  group("Account signup, login and learner onboarding");

  function openPage(page, file, search) {
    redirected = "";
    resetDom(page, "public");
    global.location.pathname = "/" + file;
    global.location.search = search || "";
    global.location.href = "http://preview.test/" + file + (search || "");
    runDomReady();
    return drain(20);
  }

  installStorage();
  signOut();
  global.NT.store.setAccess("standard", {
    code: "NT-STANDARD-4826",
    since: "2026-10-01T00:00:00.000Z",
    expiresAt: "2027-03-30T00:00:00.000Z"
  });
  fetchLog = [];
  return openPage("signup", "signup.html", "").then(function () {
    ok(byId("signupAccessCode").value === "NT-STANDARD-4826", "signup offers to carry forward a redeemed access code");
    byId("signupName").value = "Test Learner";
    byId("signupEmail").value = "learner@example.test";
    byId("signupPassword").value = "long-smoke-password";
    byId("signupConfirmPassword").value = "long-smoke-password";
    byId("signupForm").dispatch("submit", { preventDefault: function () {}, currentTarget: byId("signupForm") });
    return drain(25);
  }).then(function () {
    ok(fetchLog.indexOf("POST /api/auth/register") !== -1, "signup creates the account through the API");
    ok(lastAuthBody && lastAuthBody.accessCode === "NT-STANDARD-4826", "signup submits the optional existing code for account linking");
    ok(global.NT.auth.user() && global.NT.auth.user().learnerType === null,
      "creating an account does not select an education level");
    ok(global.NT.store.get().access === "standard", "a linked legacy package is retained after registration");
    ok(global.location.href.indexOf("learner-type.html") !== -1, "signup continues to learner-profile onboarding");

    learnerRadios = [
      Object.assign(makeEl("input"), { value: "university", checked: false }),
      Object.assign(makeEl("input"), { value: "high_school", checked: true })
    ];
    return openPage("onboarding", "learner-type.html", "?next=dashboard.html");
  }).then(function () {
    byId("learnerTypeForm").dispatch("submit", { preventDefault: function () {}, currentTarget: byId("learnerTypeForm") });
    return drain(25);
  }).then(function () {
    ok(fetchLog.indexOf("POST /api/auth/learner-type") !== -1, "onboarding saves the selected learner type through the API");
    ok(global.NT.auth.user() && global.NT.auth.user().learnerType === "high_school", "the selected learner type is persisted in the signed-in profile");
    ok(global.location.href.indexOf("dashboard.html") !== -1, "onboarding continues to the personalized dashboard");

    signOut();
    loginLearnerType = null;
    return openPage("login", "login.html", "");
  }).then(function () {
    byId("loginEmail").value = "learner@example.test";
    byId("loginPassword").value = "long-smoke-password";
    byId("loginForm").dispatch("submit", { preventDefault: function () {}, currentTarget: byId("loginForm") });
    return drain(25);
  }).then(function () {
    ok(fetchLog.indexOf("POST /api/auth/login") !== -1, "existing users can authenticate with their saved account credentials");
    ok(global.location.href.indexOf("learner-type.html") !== -1,
      "an existing account without a saved learner type is routed through onboarding");

    signOut();
    loginLearnerType = "university";
    return openPage("login", "login.html", "");
  }).then(function () {
    byId("loginEmail").value = "learner@example.test";
    byId("loginPassword").value = "long-smoke-password";
    byId("loginForm").dispatch("submit", { preventDefault: function () {}, currentTarget: byId("loginForm") });
    return drain(25);
  }).then(function () {
    ok(global.NT.auth.user() && global.NT.auth.user().learnerType === "university", "login restores the learner type saved on the account");
    ok(global.location.href.indexOf("dashboard.html") !== -1, "a returning learner with a saved type goes to the dashboard");
  });
}).catch(function (error) {
  if (!LIVE) ok(false, "account flow throws: " + (error && error.stack));
});

/* ---------------- access and checkout flows ---------------- */

/* ---------------- access and checkout flows ---------------- */

function drain(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms || 30); }); }

chain = chain.then(function () {
  if (LIVE) { console.log("\n== Access code flow ==\n  SKIP  covered by scripts/check-flows.js against the live server"); return; }
  group("Access code flow — signed-in learner");
  installStorage();
  global.NT.store.reset();
  fakeAccount = fakeLearner("university", null);
  global.NT.auth.set({ authenticated: true, user: fakeAccount, access: null });
  fetchLog = [];
  documentListeners = {};
  resetDom("access", "public");
  global.document.body.dataset.page = "access";
  global.location.pathname = "/access.html";
  global.location.search = "";
  global.location.href = "http://preview.test/access.html";
  evaluate("assets/js/app.js");
  runDomReady();
  return drain(20).then(function () {
    var form = byId("codeForm");
    var codeInput = byId("codeInput");
    codeInput.value = "NT-STANDARD-4826";
    form.dispatch("submit", { preventDefault: function () {}, currentTarget: form });
    return drain(60);
  });
}).then(function () {
  if (LIVE) return;
  var state = global.NT.store.get();
  ok(state.access === "standard", "redeemed code grants the package returned by the server");
  ok(state.profile.educationLevel === "university", "the account's learner type supplies the access catalogue");
  ok(fetchLog.indexOf("POST /api/access/redeem") !== -1, "redemption is validated by the server, not localStorage");
  ok(byId("codeResult").innerHTML.indexOf("Continue to your learning") !== -1, "success state offers the next learning step");
  ok(byId("codeResult").innerHTML.indexOf("courses.html") !== -1, "success state returns the learner to their catalogue");
}).catch(function (error) {
  if (!LIVE) ok(false, "access-code flow throws: " + (error && error.stack));
});

/* A student can type anything into localStorage; the server's verdict has to
   win. This mirrors scripts/check-access.js, at the front-end level. */
chain = chain.then(function () {
  if (LIVE) { console.log("\n== Fabricated local grant ==\n  SKIP  covered by scripts/check-access.js against the live server"); return; }
  group("Fabricated local grant");
  installStorage();
  global.NT.store.reset();
  global.NT.store.mutate(function (state) {
    state.access = "premium";
    state.accessMeta = {
      source: "access-code", code: "NT-PREMIUM-9999",
      since: new Date().toISOString(), expiresAt: "2030-01-01T00:00:00.000Z"
    };
  });
  ok(global.NT.store.get().access === "premium", "a fabricated premium grant can be written into localStorage");
  fetchLog = [];
  return global.NT.content.reload().then(function () {
    var premium = global.NT.content.data().videos.filter(function (video) { return video.level === "premium"; })[0];
    ok(!!premium, "the catalogue still lists premium lessons so students can see what a package adds");
    ok(premium.locked === true && premium.sourceUrl === null,
      "the server keeps the premium lesson locked and withholds its source URL");
    ok(global.NT.isUnlocked(premium) === false, "the front end cannot unlock the lesson from localStorage");
    ok(global.NT.store.get().access === null && global.NT.store.get().accessMeta === null,
      "the fabricated grant is dropped once the server denies it");
    return drain(20);
  });
}).catch(function (error) {
  if (!LIVE) ok(false, "fabricated-grant check throws: " + (error && error.stack));
});

chain = chain.then(function () {
  if (LIVE) { console.log("\n== Checkout code issue ==\n  SKIP  covered by scripts/check-flows.js against the live server"); return; }
  group("Checkout code issue");
  installStorage();
  global.NT.store.reset();
  documentListeners = {};
  resetDom("checkout", "public");
  global.location.pathname = "/checkout.html";
  global.location.search = "?pkg=standard";
  global.location.href = "http://preview.test/checkout.html?pkg=standard";
  evaluate("assets/js/app.js");
  runDomReady();
  return drain(20).then(function () {
    byId("generateCode").dispatch("click", { currentTarget: byId("generateCode") });
    return drain(40);
  });
}).then(function () {
  if (LIVE) return;
  ok(byId("checkoutResult").innerHTML.indexOf("NT-STANDARD-4826") !== -1, "checkout shows the server-issued access code");
  ok(fetchLog.indexOf("POST /api/codes/issue") !== -1, "checkout issues codes through the API, not localStorage");
}).catch(function (error) {
  if (!LIVE) ok(false, "checkout flow throws: " + (error && error.stack));
});

/* ---------------- admin routes ---------------- */

chain = chain.then(function () {
  group("Admin render smoke");
  var ADMIN = LIVE ? [] : ["home", "courses", "lessons", "codes", "announcements", "packages", "settings", "login"];
  if (LIVE) console.log("  SKIP  admin pages need an administrator session (see check-flows.js)");
  var steps = Promise.resolve();
  ADMIN.forEach(function (page) {
    steps = steps.then(function () {
      try {
        installStorage();
        fetchLog = [];
        redirected = "";
        documentListeners = {};
        resetDom(page, "admin");
        global.location.pathname = "/admin/" + (page === "home" ? "index" : page) + ".html";
        global.location.search = "";
        global.location.href = "http://preview.test/admin/" + page + ".html";
        evaluate("assets/js/admin.js");
        runDomReady();
        return drain(40).then(function () {
          var html = collectHtml();
          ok(html.length > 80, "admin/" + page + " renders markup");
          ok(html.indexOf("undefined") === -1, "admin/" + page + " contains no undefined values");
          if (page === "lessons") ok(html.indexOf("Add video lesson") !== -1, "admin/lessons shows the add-lesson control");
          if (page === "courses") ok(html.indexOf("Semester 1") !== -1, "admin/courses shows the semester context");
          if (page === "home") ok(html.indexOf("Video lessons") !== -1, "admin/home shows real catalogue counts");
          if (page === "packages") ok(html.indexOf("Access period") !== -1, "admin/packages edits package settings");
          if (page === "settings") ok(html.indexOf("Administrator password") !== -1, "admin/settings changes the admin password");
        });
      } catch (error) {
        ok(false, "admin/" + page + " throws: " + (error && error.stack));
        return Promise.resolve();
      }
    });
  });
  return steps;
});

/* ------------------------------------------------------------
   Signed-out admin visits must not render management controls.
   ------------------------------------------------------------ */
chain = chain.then(function () {
  group("Admin gate");
  process.env.SMOKE_SIGNED_OUT = "1";
  installStorage();
  redirected = "";
  documentListeners = {};
  resetDom("home", "admin");
  global.location.pathname = "/admin/index.html";
  global.location.search = "";
  evaluate("assets/js/admin.js");
  runDomReady();
  return drain(40).then(function () {
    var html = collectHtml("admin/index.html");
    ok(redirected.indexOf("login.html") !== -1, "signed-out admin visit redirects to the sign-in page");
    ok(html.indexOf("adm-nav-link") === -1, "signed-out admin visit renders no management controls");
    delete process.env.SMOKE_SIGNED_OUT;
  });
});

chain = chain.then(function () {
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
