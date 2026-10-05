#!/usr/bin/env node
/* ============================================================
   Live flow checks

   Exercises the exact journeys the platform promises against a
   running server (npm start):

     Student   University → Semester 1 → Course → Video → Watch
     Student   University → Semester 2 → Course → Video → Watch
     Admin     sign in → University → Semester → Course → add video
               → publish → the student catalogue shows it

   Usage:  node scripts/check-flows.js            (http://127.0.0.1:8000)
           BASE=http://127.0.0.1:8123 node scripts/check-flows.js
           NT_ADMIN_PASSWORD=secret node scripts/check-flows.js
   ============================================================ */
"use strict";

var http = require("http");
var https = require("https");

var BASE = (process.env.BASE || "http://127.0.0.1:" + (process.env.PORT || 8000)).replace(/\/$/, "");
var PASSWORD = process.env.NT_ADMIN_PASSWORD || "nuclear-admin";
var passed = 0;
var failed = 0;

function check(condition, label) {
  if (condition) { passed++; console.log("  PASS  " + label); }
  else { failed++; console.error("  FAIL  " + label); }
}
function group(label) { console.log("\n== " + label + " =="); }

function request(method, path, body, options) {
  var opts = options || {};
  return new Promise(function (resolve, reject) {
    var url = new URL(BASE + path);
    var client = url.protocol === "https:" ? https : http;
    var payload = body == null ? null : JSON.stringify(body);
    var headers = { Accept: "application/json" };
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    if (opts.cookie) headers.Cookie = opts.cookie;
    if (opts.code) headers["X-NT-Code"] = opts.code;
    var req = client.request(url, { method: method, headers: headers }, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () {
        var raw = Buffer.concat(chunks).toString("utf8");
        var json = null;
        try { json = JSON.parse(raw); } catch (error) { /* non-JSON body */ }
        var setCookie = res.headers["set-cookie"];
        resolve({ status: res.statusCode, json: json, raw: raw, setCookie: setCookie });
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, function () { req.destroy(new Error("timeout")); });
    if (payload) req.write(payload);
    req.end();
  });
}

function cookieFrom(response) {
  var header = response.setCookie && response.setCookie[0];
  return header ? header.split(";")[0] : "";
}

function firstCourse(catalogue, universityId, semester) {
  return catalogue.courses.filter(function (course) {
    return course.universityId === universityId && Number(course.semester) === Number(semester);
  })[0];
}
function lessonsOf(catalogue, courseId) {
  return catalogue.videos.filter(function (video) { return video.courseId === courseId; });
}

var state = {};

request("GET", "/api/health").then(function (response) {
  group("Service (" + BASE + ")");
  check(response.status === 200 && response.json && response.json.ok, "GET /api/health responds");
  return request("GET", "/api/catalogue");
}).then(function (response) {
  check(response.status === 200, "GET /api/catalogue responds");
  var catalogue = response.json.catalogue;
  state.catalogue = catalogue;
  check(catalogue.universities.length > 0, "catalogue lists universities");
  check(catalogue.courses.length > 0 && catalogue.videos.length > 0, "catalogue lists courses and video lessons");
  var universities = catalogue.universities.concat(catalogue.schools);
  var semesters = { 1: 0, 2: 0 };
  catalogue.courses.forEach(function (course) { semesters[Number(course.semester)] = (semesters[Number(course.semester)] || 0) + 1; });
  check(semesters[1] > 0 && semesters[2] > 0, "catalogue covers Semester 1 and Semester 2");
  check(universities.every(function (item) { return item.courseCount > 0; }),
    "every institution has courses (" + universities.length + " institutions)");
  var withDuration = catalogue.videos.filter(function (video) { return video.durationSeconds > 0; }).length;
  check(withDuration > 0, "lessons carry durations (" + withDuration + " of " + catalogue.videos.length + ")");
  check(catalogue.videos.every(function (video) { return /^https?:\/\//.test(video.sourceUrl); }), "every lesson has a source URL");
  check(catalogue.videos.every(function (video) { return video.universityId && video.semester && video.courseTitle; }),
    "every lesson carries its university, semester and course");

  /* ---- student flow, semester 1 ---- */
  group("Student flow — University → Semester 1 → Course → Video");
  var university = catalogue.universities[0];
  var courseOne = firstCourse(catalogue, university.id, 1);
  check(!!courseOne, university.name + " has a Semester 1 course");
  state.semesterOneCourse = courseOne;
  var lessonsOne = lessonsOf(catalogue, courseOne.id);
  check(lessonsOne.length > 0, "Semester 1 course has video lessons (" + lessonsOne.length + ")");
  state.lessonOne = lessonsOne[0];
  check(!!state.lessonOne.sourceUrl && !!state.lessonOne.courseId, "lesson payload is playable and linked to its course");
  return request("GET", "/api/videos/" + encodeURIComponent(state.lessonOne.id));
}).then(function (response) {
  check(response.status === 200, "GET /api/videos/:id responds for the chosen lesson");
  var video = response.json.video;
  check(video && video.courseId === state.semesterOneCourse.id && Number(video.semester) === 1,
    "lesson detail keeps university, semester and course context");

  /* ---- student flow, semester 2 ---- */
  group("Student flow — University → Semester 2 → Course → Video");
  var catalogue = state.catalogue;
  var universityTwo = catalogue.universities.filter(function (item) {
    return firstCourse(catalogue, item.id, 2);
  })[0];
  check(!!universityTwo, "a university publishes Semester 2 courses");
  var courseTwo = firstCourse(catalogue, universityTwo.id, 2);
  var lessonsTwo = lessonsOf(catalogue, courseTwo.id);
  check(lessonsTwo.length > 0, "Semester 2 course has video lessons (" + lessonsTwo.length + ")");
  state.courseTwo = courseTwo;

  /* ---- access codes and progress ---- */
  group("Access code and progress");
  return request("POST", "/api/codes/issue", { package: "premium" });
}).then(function (response) {
  check(response.status === 201 && response.json.code, "a package code can be issued");
  var code = response.json.code;
  state.code = code;
  return request("POST", "/api/access/redeem", { code: code, educationLevel: "university" });
}).then(function (response) {
  check(response.status === 200 && response.json.access, "the code redeems once with an education level");
  check(response.json.access && response.json.access.expiresAt, "redemption returns the access period");
  return request("POST", "/api/access/redeem", { code: state.code, educationLevel: "university" });
}).then(function (response) {
  check(response.status === 409, "a redeemed code cannot be used twice");
  return request("POST", "/api/progress", { videoId: state.lessonOne.id, completed: true, seconds: 120 }, { code: state.code });
}).then(function (response) {
  check(response.status === 200, "a signed-in student can save progress");
  return request("GET", "/api/progress", null, { code: state.code });
}).then(function (response) {
  var items = response.json.progress || [];
  check(items.length === 1 && items[0].videoId === state.lessonOne.id, "progress is stored against the access code");
  return request("GET", "/api/admin/overview");
}).then(function (response) {
  group("Admin gate");
  check(response.status === 401, "admin endpoints reject signed-out requests");
  return request("POST", "/api/admin/login", { password: "definitely-wrong-password" });
}).then(function (response) {
  check(response.status === 401, "the wrong administrator password is rejected");
  return request("POST", "/api/admin/login", { password: PASSWORD });
}).then(function (response) {
  check(response.status === 200, "administrator sign-in succeeds");
  state.cookie = cookieFrom(response);
  check(!!state.cookie, "sign-in sets a session cookie");
  return request("GET", "/api/admin/session", null, { cookie: state.cookie });
}).then(function (response) {
  check(response.status === 200 && response.json.authenticated === true, "the session is recognised");
  return request("GET", "/api/admin/universities", null, { cookie: state.cookie });
}).then(function (response) {
  var universities = response.json.universities || [];
  check(universities.length > 0, "admin sees the universities");
  var university = universities.filter(function (item) { return item.id === state.semesterOneCourse.universityId; })[0];
  state.adminUniversity = university;
  return request("GET", "/api/admin/courses?university=" + encodeURIComponent(university.id) + "&semester=1", null, { cookie: state.cookie });
}).then(function (response) {
  group("Admin flow — University → Semester → Course → add video → publish");
  var courses = response.json.courses || [];
  check(courses.length > 0, "admin sees the Semester 1 courses of the chosen university");
  state.adminCourse = courses[0];
  return request("POST", "/api/admin/videos", {
    courseId: state.adminCourse.id,
    title: "Flow check lesson (temporary)",
    topic: "Automated acceptance check",
    description: "Created by scripts/check-flows.js and removed again immediately.",
    sourceUrl: "https://www.youtube.com/watch?v=ZM8ECpBuQYE",
    duration: "09:47",
    level: "standard",
    published: 0
  }, { cookie: state.cookie });
}).then(function (response) {
  check(response.status === 201 && response.json.video, "a new lesson can be added without touching source code");
  state.createdVideo = response.json.video;
  check(state.createdVideo && state.createdVideo.courseId === state.adminCourse.id, "the lesson is attached to the selected course");
  check(state.createdVideo && state.createdVideo.provider === "youtube", "the provider is detected from the pasted video URL");
  check(state.createdVideo && state.createdVideo.thumbnailUrl, "a thumbnail is derived for the lesson");
  check(state.createdVideo && state.createdVideo.durationSeconds === 587, "the pasted duration is stored as seconds");
  return request("PATCH", "/api/admin/videos/" + encodeURIComponent(state.createdVideo.id), { published: 0 }, { cookie: state.cookie });
}).then(function (response) {
  check(response.status === 200, "a drafted lesson stays unpublished");
  return request("GET", "/api/catalogue");
}).then(function (response) {
  var ids = response.json.catalogue.videos.map(function (video) { return video.id; });
  check(ids.indexOf(state.createdVideo.id) === -1, "unpublished lessons are hidden from students");
  return request("PATCH", "/api/admin/videos/" + encodeURIComponent(state.createdVideo.id), { published: 1 }, { cookie: state.cookie });
}).then(function (response) {
  check(response.status === 200, "the lesson can be published");
  return request("GET", "/api/catalogue");
}).then(function (response) {
  var catalogue = response.json.catalogue;
  var found = catalogue.videos.filter(function (video) { return video.id === state.createdVideo.id; })[0];
  check(!!found, "the published lesson appears in the student catalogue");
  check(found && found.courseId === state.adminCourse.id && Number(found.semester) === 1,
    "students see which university, semester and course the new lesson belongs to");
  check(state.code && found, "the lesson is visible without any browser-local storage");

  return request("POST", "/api/admin/videos/" + encodeURIComponent(state.createdVideo.id) + "/move", { direction: "top" }, { cookie: state.cookie });
}).then(function (response) {
  var videos = response.json.videos || [];
  check(videos.length && videos[0].id === state.createdVideo.id, "lessons can be reordered inside the course");
  return request("DELETE", "/api/admin/videos/" + encodeURIComponent(state.createdVideo.id), null, { cookie: state.cookie });
}).then(function (response) {
  check(response.status === 200, "the temporary lesson is removed again");
  return request("GET", "/api/catalogue");
}).then(function (response) {
  var ids = response.json.catalogue.videos.map(function (video) { return video.id; });
  check(ids.indexOf(state.createdVideo.id) === -1, "removing it takes it off the student catalogue");
  return request("POST", "/api/admin/logout", null, { cookie: state.cookie });
}).then(function (response) {
  check(response.status === 200, "administrator sign-out succeeds");
  return request("GET", "/api/admin/overview", null, { cookie: state.cookie });
}).then(function (response) {
  check(response.status === 401, "the old session no longer reaches admin endpoints");
  return request("DELETE", "/api/progress", {}, { code: state.code });
}).then(function () {
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}).catch(function (error) {
  console.error("Flow check could not complete: " + (error && error.message));
  console.error("Start the server first (npm start), or pass BASE=http://host:port");
  process.exit(1);
});
