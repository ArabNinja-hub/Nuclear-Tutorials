#!/usr/bin/env node
/* ============================================================
   Live flow checks

   Exercises the exact journeys the platform promises against a
   running server (npm start):

     Learner   sign up → choose learner type → scoped catalogue/profile
     Learner   University → Semester 1/2 → Course → Video → Watch
     Learner   High School catalogue and progress stay isolated
     Admin     sign in → University → Semester → Course → add video
               → publish → the student catalogue shows it

   Usage:  node scripts/check-flows.js            (http://127.0.0.1:8080)
           BASE=http://127.0.0.1:8080 node scripts/check-flows.js
           NT_ADMIN_PASSWORD=secret node scripts/check-flows.js
   ============================================================ */
"use strict";

var http = require("http");
var https = require("https");

var BASE = (process.env.BASE || "http://127.0.0.1:" + (process.env.PORT || 8080)).replace(/\/$/, "");
var PASSWORD = process.env.NT_ADMIN_PASSWORD || "nuclear-admin";
/* The shipped default is never a valid credential; a fresh install must be
   given one through NT_ADMIN_PASSWORD, then rotated once by this script. */
var ROTATED = "Flow-check-Password-2026";
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
}).then(function (visitorResponse) {
  check(visitorResponse.status === 200, "GET /api/catalogue responds");
  /* No access code means no video sources at all: the tier rules are the
     server's, not the browser's. */
  state.visitorCatalogue = visitorResponse.json.catalogue;
  var visitorVideos = state.visitorCatalogue.videos;
  check(visitorVideos.length > 0 && visitorVideos.every(function (video) {
    return video.locked === true && video.sourceUrl === null;
  }), "a visitor receives every lesson locked and without a source URL");
  check(!/"sourceUrl"\s*:\s*"https?:/.test(visitorResponse.raw), "a visitor response contains no video source URL");

  /* Issue and redeem a premium code so the student flow below is signed in. */
  return request("POST", "/api/codes/issue", { package: "premium" });
}).then(function (response) {
  check(response.status === 201 && response.json.code, "a code can be issued for the student flow");
  state.flowCode = response.json.code;
  return request("POST", "/api/access/redeem", { code: state.flowCode, educationLevel: "university" });
}).then(function (response) {
  check(response.status === 200 && response.json.access, "the student flow code redeems");
  return request("GET", "/api/catalogue", null, { code: state.flowCode });
}).then(function (response) {
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
  check(catalogue.videos.every(function (video) { return /^https?:\/\//.test(video.sourceUrl) && video.locked === false; }),
    "a premium student receives every lesson unlocked with its source URL");
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
  return request("GET", "/api/videos/" + encodeURIComponent(state.lessonOne.id), null, { code: state.flowCode });
}).then(function (response) {
  check(response.status === 200, "GET /api/videos/:id responds for the chosen lesson");
  var video = response.json.video;
  check(video && video.courseId === state.semesterOneCourse.id && Number(video.semester) === 1,
    "lesson detail keeps university, semester and course context");
  check(!!video.sourceUrl && video.locked === false, "the lesson detail carries the playable source for its package");
  check(Array.isArray(response.json.lessons) && response.json.lessons.length > 0,
    "the lesson detail lists the other lessons of the course");

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

  group("Learner accounts, onboarding and catalogue scope");
  var schoolVideo = (state.visitorCatalogue.videos || []).filter(function (video) {
    return video.universityLevel === "high-school";
  })[0];
  check(!!schoolVideo, "the demo catalogue provides a high-school lesson for the scope check");
  if (!schoolVideo) throw new Error("The demo catalogue has no high-school lesson for the account-scope flow.");
  state.schoolVideo = schoolVideo;
  state.learnerEmail = "flow-" + Date.now() + "@example.test";
  state.learnerPassword = "Flow-Learner-Password-2026";
  return request("POST", "/api/auth/register", {
    displayName: "Flow Learner",
    email: state.learnerEmail,
    password: state.learnerPassword,
    accessCode: state.code
  });
}).then(function (response) {
  check(response.status === 201 && response.json.user, "a learner account is created through the API");
  state.learnerCookie = cookieFrom(response);
  check(!!state.learnerCookie, "learner registration establishes a session cookie");
  check(response.json.user && response.json.user.learnerType === null,
    "registration leaves learner type unset until onboarding");
  check(response.json.access && response.json.access.code === state.code,
    "an existing redeemed code and its package are linked to the new account");
  return request("GET", "/api/auth/me", null, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.user && response.json.user.learnerType === null,
    "an existing or newly created account with no learner type remains a valid signed-in session");
  return request("GET", "/api/catalogue", null, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 409 && response.json.details && response.json.details.learnerTypeRequired,
    "a missing learner type is handled with an onboarding response, not an account failure");
  return request("GET", "/api/progress", null, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 409 && response.json.details && response.json.details.learnerTypeRequired,
    "an unconfigured account cannot read mixed-catalogue progress before onboarding");
  return request("POST", "/api/auth/learner-type", { learnerType: "university" }, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.user.learnerType === "university",
    "onboarding persists the university learner type");
  return request("GET", "/api/catalogue", null, { cookie: state.learnerCookie });
}).then(function (response) {
  var catalogue = response.json.catalogue;
  state.universityCatalogue = catalogue;
  check(response.status === 200 && catalogue.universities.length > 0 && catalogue.schools.length === 0,
    "university learners receive universities and no high-school institutions");
  check(catalogue.courses.length > 0 && catalogue.courses.every(function (course) { return course.universityLevel === "university"; }) &&
    catalogue.videos.every(function (video) { return video.universityLevel === "university"; }),
    "the university course and lesson catalogues contain no high-school content");
  var chosenInstitution = catalogue.universities.filter(function (institution) {
    return institution.id !== catalogue.universities[0].id;
  })[0] || catalogue.universities[0];
  state.chosenInstitution = chosenInstitution;
  return request("PATCH", "/api/auth/profile", { institutionId: chosenInstitution.id, semester: 2 }, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.user.profile.institutionId === state.chosenInstitution.id,
    "a learner can choose an institution from the returned catalogue rather than a hard-coded school");
  return request("GET", "/api/auth/me", null, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.json.user.profile.institutionId === state.chosenInstitution.id && response.json.user.profile.semester === 2,
    "institution and term preferences persist on the learner profile");
  return request("GET", "/api/search?q=" + encodeURIComponent("Secondary School Programme"), null, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.universities.length === 0 && response.json.courses.length === 0 && response.json.videos.length === 0,
    "university search results do not expose high-school institutions, courses or lessons");
  return request("GET", "/api/videos/" + encodeURIComponent(state.schoolVideo.id), null, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 404, "a university learner cannot open a high-school lesson directly");
  return request("POST", "/api/progress", { videoId: state.schoolVideo.id, completed: true, seconds: 45 }, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 404, "a university learner cannot write progress for a high-school lesson");
  return request("GET", "/api/progress", null, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.progress.length === 1 &&
    response.json.progress[0].videoId === state.lessonOne.id,
    "linked access-code progress is visible in the matching university catalogue");
  return request("POST", "/api/auth/learner-type", { learnerType: "high_school" }, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.user.learnerType === "high_school",
    "learners can change their learner type from the profile");
  check(response.json.user.profile.institutionId === "" && response.json.user.profile.semester === 0,
    "changing learner type clears institution and term preferences that no longer apply");
  return request("GET", "/api/catalogue", null, { cookie: state.learnerCookie });
}).then(function (response) {
  var catalogue = response.json.catalogue;
  check(response.status === 200 && catalogue.universities.length === 0 && catalogue.schools.length > 0,
    "high-school learners receive schools and no university institutions");
  check(catalogue.courses.length > 0 && catalogue.courses.every(function (course) { return course.universityLevel === "high-school"; }) &&
    catalogue.videos.length > 0 && catalogue.videos.every(function (video) { return video.universityLevel === "high-school"; }),
    "the high-school course and lesson catalogues contain no university content");
  return request("GET", "/api/progress", null, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.progress.length === 0,
    "university progress is not mixed into the high-school dashboard");
  return request("POST", "/api/progress", { videoId: state.schoolVideo.id, completed: true, seconds: 45 }, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.progress.some(function (item) { return item.videoId === state.schoolVideo.id; }),
    "high-school learners can save progress for lessons in their catalogue");
  return request("DELETE", "/api/progress", {}, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.progress.length === 0,
    "clearing progress only removes entries in the current learner catalogue");
  return request("POST", "/api/auth/learner-type", { learnerType: "university" }, { cookie: state.learnerCookie });
}).then(function () {
  return request("GET", "/api/progress", null, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.progress.length === 1 &&
    response.json.progress[0].videoId === state.lessonOne.id,
    "switching back restores only progress relevant to the selected catalogue");
  return request("POST", "/api/auth/logout", {}, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200, "a learner can sign out of the account session");
  return request("POST", "/api/auth/login", { email: state.learnerEmail, password: state.learnerPassword });
}).then(function (response) {
  check(response.status === 200 && response.json.user.learnerType === "university",
    "an existing account logs back in with its saved learner type");
  state.learnerCookie = cookieFrom(response);
  return request("GET", "/api/auth/me", null, { cookie: state.learnerCookie });
}).then(function (response) {
  check(response.status === 200 && response.json.user.learnerType === "university",
    "the learner session and type persist after a fresh login");
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
  if (response.json && response.json.mustChangePassword) {
    /* First run: the platform requires the password to be replaced before
       the admin API serves anything else. */
    return request("GET", "/api/admin/overview", null, { cookie: state.cookie }).then(function (blocked) {
      check(blocked.status === 403, "catalogue management is locked until the first-run password is changed");
      var replacement = PASSWORD === "nuclear-admin" ? ROTATED : PASSWORD;
      return request("POST", "/api/admin/password", { currentPassword: PASSWORD, newPassword: replacement },
        { cookie: state.cookie }).then(function (changed) {
        check(changed.status === 200, "the first-run password can be replaced");
        return request("POST", "/api/admin/login", { password: replacement });
      }).then(function (relogin) {
        check(relogin.status === 200 && relogin.json.mustChangePassword === false,
          "the replaced password signs in and unlocks administration");
        state.cookie = cookieFrom(relogin);
      });
    });
  }
}).then(function () {
  /* A normal student (valid access code, no admin session) must not reach
     any administration endpoint. */
  var attempts = [["GET", "/api/admin/overview"], ["POST", "/api/admin/videos"], ["DELETE", "/api/admin/codes/NT-X-0000"]];
  return attempts.reduce(function (chain, entry) {
    return chain.then(function () {
      return request(entry[0], entry[1], entry[0] === "GET" ? null : {}, { code: state.code }).then(function (blocked) {
        check(blocked.status === 401 || blocked.status === 403,
          "a student calling " + entry[0] + " " + entry[1] + " is refused (" + blocked.status + ")");
      });
    });
  }, Promise.resolve());
}).then(function () {
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
