#!/usr/bin/env node
/* ============================================================
   NUCLEAR TUTORIALS — End-to-end flow tests
   ------------------------------------------------------------
   Boots the real server against a throwaway database and walks the
   exact flows the platform must support:

     Student: university → semester 1 → course → video → watch
     Student: university → semester 2 → course → video → watch
     Admin:   sign in → university → semester → course → add video
              → publish → student can see it

   Run with:  npm run flows
   ============================================================ */
"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");

var DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nt-flows-"));
process.env.NT_DATA_DIR = DATA_DIR;
process.env.NT_DB_FILE = path.join(DATA_DIR, "content.sqlite");
process.env.NT_QUIET = "1";
process.env.PORT = "0";
process.env.NT_HOST = "127.0.0.1";
process.env.NT_ADMIN_EMAIL = "admin@flowtest.local";
process.env.NT_ADMIN_PASSWORD = "Flow-Test-Password-1";

var app = require("../server/index.js");
var db = require("../server/db.js");

var passed = 0;
var failed = 0;
var failures = [];

function group(label) { console.log("\n== " + label + " =="); }
function check(condition, label, detail) {
  if (condition) { passed++; console.log("  PASS  " + label); }
  else {
    failed++;
    failures.push(label + (detail ? " → " + detail : ""));
    console.error("  FAIL  " + label + (detail ? " → " + detail : ""));
  }
}

/* ---------------- HTTP client with a cookie jar ---------------- */
function makeClient(base) {
  var cookie = "";
  function request(method, pathname, body, options) {
    var headers = { Accept: "application/json" };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(base + pathname, {
      method: method,
      headers: headers,
      redirect: (options && options.redirect) || "manual",
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(async function (res) {
      var setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      setCookie.forEach(function (entry) { cookie = entry.split(";")[0]; });
      var type = res.headers.get("content-type") || "";
      var payload = type.indexOf("application/json") !== -1 ? await res.json() : await res.text();
      return { status: res.status, headers: res.headers, body: payload, location: res.headers.get("location") };
    });
  }
  return {
    get: function (pathname, options) { return request("GET", pathname, undefined, options); },
    post: function (pathname, body) { return request("POST", pathname, body || {}); },
    patch: function (pathname, body) { return request("PATCH", pathname, body || {}); },
    put: function (pathname, body) { return request("PUT", pathname, body || {}); },
    del: function (pathname) { return request("DELETE", pathname, undefined); },
    cookie: function () { return cookie; }
  };
}

var YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLdemo";
var SHORT_URL = "https://youtu.be/9bZkp7q19f0";
var VIMEO_URL = "https://vimeo.com/76979871";
var FILE_URL = "https://cdn.example.com/lectures/semester-2-thermodynamics.mp4";

async function main() {
  var info = await app.start();
  var base = "http://127.0.0.1:" + info.port;
  console.log("Nuclear Tutorials flow tests against " + base);
  console.log("Throwaway database: " + DATA_DIR);

  var student = makeClient(base);
  var admin = makeClient(base);
  var stranger = makeClient(base);

  /* ---------------- 1. Empty catalogue (no invented content) ---------------- */
  group("Empty catalogue");
  var health = await student.get("/api/health");
  check(health.status === 200 && health.body.ok === true, "content service responds on /api/health");
  var emptyStats = await student.get("/api/stats");
  check(emptyStats.status === 200 && emptyStats.body.universities === 0 && emptyStats.body.videos === 0,
    "a fresh database reports zero universities and zero videos (no seeded fiction)");
  var emptyList = await student.get("/api/universities");
  check(emptyList.status === 200 && Array.isArray(emptyList.body.universities) && emptyList.body.universities.length === 0,
    "students receive an empty university list before any admin work");

  /* ---------------- 2. Admin area is not exposed to students ---------------- */
  group("Access control");
  var gate = await stranger.get("/admin/videos.html");
  check(gate.status === 302 && gate.location === "/admin/login.html?next=%2Fadmin%2Fvideos.html",
    "unauthenticated visitors are redirected away from admin pages", gate.location);
  var loginPage = await stranger.get("/admin/login.html");
  check(loginPage.status === 200, "the admin sign-in page itself stays reachable");
  var protectedApi = await stranger.get("/api/admin/overview");
  check(protectedApi.status === 401 && protectedApi.body.error === "auth-required",
    "admin API rejects anonymous requests");
  var badLogin = await stranger.post("/api/admin/login", { email: "admin@flowtest.local", password: "wrong-password" });
  check(badLogin.status === 401 && stranger.cookie() === "", "an incorrect password does not create a session");
  var noUploads = await stranger.post("/api/admin/uploads", { file: "notes.pdf" });
  check(noUploads.status === 404, "there is no document/PDF upload endpoint (video lessons only)");
  var unknownApi = await student.get("/api/nothing-here");
  check(unknownApi.status === 404, "unknown API paths return 404 JSON");

  /* ---------------- 3. Admin sign-in ---------------- */
  group("Admin sign-in");
  var login = await admin.post("/api/admin/login", { email: "ADMIN@flowtest.local", password: "Flow-Test-Password-1" });
  check(login.status === 200 && login.body.admin.email === "admin@flowtest.local", "the first-run administrator can sign in");
  check(/nt_admin=/.test(admin.cookie()), "sign-in issues an HttpOnly session cookie");
  check(/HttpOnly/i.test(login.headers.get("set-cookie") || ""), "the session cookie is HttpOnly");
  var session = await admin.get("/api/admin/session");
  check(session.status === 200 && session.body.admin.role === "admin", "the session endpoint confirms the signed-in admin");
  var adminPage = await admin.get("/admin/videos.html");
  check(adminPage.status === 200, "a signed-in admin can open the video manager");

  /* ---------------- 4. Admin builds the university → semester → course tree ---------------- */
  group("Admin: university → semester → course");
  var university = await admin.post("/api/admin/universities", {
    name: "Flow Test University",
    shortName: "FTU",
    city: "Lusaka",
    country: "Zambia",
    description: "Temporary institution used by the automated flow tests.",
    accent: "#0d7ea4"
  });
  check(university.status === 201 && university.body.university.id, "admin can add a university without editing source code");
  var universityId = university.body.university.id;

  var badUniversity = await admin.post("/api/admin/universities", { name: "   " });
  check(badUniversity.status === 400 && badUniversity.body.fields.name, "a university without a name is rejected with field errors");

  var s1 = await admin.post("/api/admin/courses", {
    universityId: universityId, semester: 1, title: "Programming Fundamentals",
    code: "CS101", subjectId: "cs", instructor: "Flow Test Lecturer",
    description: "Semester 1 introduction to programming."
  });
  check(s1.status === 201 && s1.body.course.semester === 1, "admin can create a Semester 1 course under that university");
  var s2 = await admin.post("/api/admin/courses", {
    universityId: universityId, semester: 2, title: "Thermodynamics",
    code: "PH202", subjectId: "phys", description: "Semester 2 heat and energy."
  });
  check(s2.status === 201 && s2.body.course.semester === 2, "admin can create a Semester 2 course under that university");
  var courseS1 = s1.body.course.id;
  var courseS2 = s2.body.course.id;

  var badSemester = await admin.post("/api/admin/courses", { universityId: universityId, semester: 3, title: "Invalid" });
  check(badSemester.status === 400 && badSemester.body.fields.semester, "semester values other than 1 or 2 are rejected");
  var badCourseUniversity = await admin.post("/api/admin/courses", { universityId: "uni_missing", semester: 1, title: "Orphan" });
  check(badCourseUniversity.status === 400 && badCourseUniversity.body.fields.universityId, "a course must point at an existing university");

  /* ---------------- 5. Admin adds and publishes video lessons ---------------- */
  group("Admin: video lessons");
  var analysis = await admin.post("/api/admin/analyze-url", { url: YOUTUBE_URL });
  check(analysis.status === 200 && analysis.body.provider === "youtube" &&
    /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(analysis.body.embedUrl) &&
    /img\.youtube\.com\/vi\/dQw4w9WgXcQ/.test(analysis.body.autoThumbnail),
    "a YouTube watch URL is analysed into an embed URL and automatic thumbnail");

  var draftVideo = await admin.post("/api/admin/videos", {
    courseId: courseS1, title: "Variables and Data Types", topic: "Variables",
    description: "How variables store values in a program.", url: YOUTUBE_URL,
    durationSeconds: "12:45", level: "basic", status: "draft"
  });
  check(draftVideo.status === 201 && draftVideo.body.video.provider === "youtube",
    "admin can add a video lesson to a specific university + semester + course");
  check(draftVideo.body.video.durationSeconds === 765, "mm:ss durations are stored as seconds", String(draftVideo.body.video.durationSeconds));
  check(draftVideo.body.video.semester === 1 && draftVideo.body.video.universityName === "Flow Test University",
    "the stored video keeps its full university / semester / course context");
  var videoId = draftVideo.body.video.id;

  var second = await admin.post("/api/admin/videos", {
    courseId: courseS1, title: "Control Flow", topic: "Loops", url: SHORT_URL, level: "standard", status: "published"
  });
  check(second.status === 201 && second.body.video.provider === "youtube" && second.body.video.externalId === "9bZkp7q19f0",
    "youtu.be short links are recognised");
  var secondId = second.body.video.id;

  var vimeo = await admin.post("/api/admin/videos", {
    courseId: courseS2, title: "Heat Engines", topic: "Carnot cycle", url: VIMEO_URL, level: "premium", status: "published"
  });
  check(vimeo.status === 201 && vimeo.body.video.provider === "vimeo" && /player\.vimeo\.com\/video\/76979871/.test(vimeo.body.video.embedUrl),
    "Vimeo links become embeddable players");
  var vimeoId = vimeo.body.video.id;

  var fileVideo = await admin.post("/api/admin/videos", {
    courseId: courseS2, title: "Entropy Walkthrough", topic: "Entropy", url: FILE_URL,
    thumbnailUrl: "https://cdn.example.com/thumbs/entropy.jpg", durationSeconds: 640, level: "standard", status: "published"
  });
  check(fileVideo.status === 201 && fileVideo.body.video.provider === "file" &&
    fileVideo.body.video.thumbnail === "https://cdn.example.com/thumbs/entropy.jpg",
    "direct media files are stored for native playback with a custom thumbnail");

  var badUrl = await admin.post("/api/admin/videos", { courseId: courseS1, title: "Broken", url: "not-a-url" });
  check(badUrl.status === 400 && badUrl.body.fields.url, "a video without a usable URL is rejected");
  var badTitle = await admin.post("/api/admin/videos", { courseId: courseS1, title: "", url: YOUTUBE_URL });
  check(badTitle.status === 400 && badTitle.body.fields.title, "a video without a title is rejected");
  var badContext = await admin.post("/api/admin/videos", { title: "Orphan video", url: YOUTUBE_URL });
  check(badContext.status === 400 && badContext.body.fields.courseId, "a video cannot exist without a university + semester + course");

  /* ---------------- 6. Drafts stay hidden, publishing reveals them ---------------- */
  group("Publishing");
  var beforePublish = await student.get("/api/courses/" + courseS1);
  check(beforePublish.status === 200 && beforePublish.body.videos.length === 1 &&
    beforePublish.body.videos[0].id === secondId, "students only see published video lessons");
  var hiddenDraft = await student.get("/api/videos/" + videoId);
  check(hiddenDraft.status === 404, "a draft video is not reachable by students");
  var published = await admin.patch("/api/admin/videos/" + videoId, { status: "published" });
  check(published.status === 200 && published.body.video.status === "published", "admin can publish a video lesson");
  var afterPublish = await student.get("/api/courses/" + courseS1);
  check(afterPublish.body.videos.length === 2, "publishing makes the video visible to students immediately");
  var unpub = await admin.patch("/api/admin/videos/" + secondId, { status: "draft" });
  check(unpub.status === 200 && (await student.get("/api/videos/" + secondId)).status === 404, "unpublishing hides the video from students again");
  await admin.patch("/api/admin/videos/" + secondId, { status: "published" });

  /* ---------------- 7. Student flow: university → semester → course → video ---------------- */
  group("Student: Semester 1 flow");
  var list = await student.get("/api/universities");
  check(list.status === 200 && list.body.universities.length === 1 && list.body.universities[0].name === "Flow Test University",
    "step 1 — the student picks a university");
  var card = list.body.universities[0];
  check(card.videoCount === 4 && card.courseCount === 2,
    "the university card carries real course and video counts",
    "videos=" + card.videoCount + " courses=" + card.courseCount);
  var term1 = card.semesters.filter(function (item) { return item.semester === 1; })[0] || {};
  var term2 = card.semesters.filter(function (item) { return item.semester === 2; })[0] || {};
  check(term1.courses === 1 && term1.videos === 2 && term2.courses === 1 && term2.videos === 2,
    "each semester reports its own published courses and video lessons",
    JSON.stringify(card.semesters));
  check(String(card.availableSemesters) === "1,2", "both semesters are offered for selection");
  var detail = await student.get("/api/universities/" + universityId);
  check(detail.status === 200 && detail.body.semesters.length === 2 &&
    detail.body.semesters[0].semester === 1 && detail.body.semesters[0].courses === 1 &&
    detail.body.semesters[1].semester === 2 && detail.body.semesters[1].courses === 1,
    "step 2 — the university reports Semester 1 and Semester 2 separately");
  var sem1Courses = detail.body.courses.filter(function (course) { return course.semester === 1; });
  check(sem1Courses.length === 1 && sem1Courses[0].id === courseS1 && sem1Courses[0].universityName === "Flow Test University",
    "step 3 — Semester 1 lists its own courses with university context");
  var sem1Course = await student.get("/api/courses/" + courseS1);
  check(sem1Course.status === 200 && sem1Course.body.videos.length === 2 &&
    sem1Course.body.course.semesterLabel === "Semester 1" && sem1Course.body.university.name === "Flow Test University",
    "step 4 — the course page shows its published video lessons in order");
  var firstVideo = sem1Course.body.videos[0];
  var watch = await student.get("/api/videos/" + firstVideo.id);
  check(watch.status === 200 && watch.body.video.embedUrl && watch.body.video.title &&
    watch.body.course.semester === 1 && watch.body.university.name === "Flow Test University" &&
    watch.body.total === 2 && watch.body.next && watch.body.previous === null,
    "step 5 — the watch payload carries the player URL plus semester context and playlist position");
  check(watch.body.video.level === "basic", "the video keeps its access tier for the existing package gating");

  group("Student: Semester 2 flow");
  var sem2Courses = detail.body.courses.filter(function (course) { return course.semester === 2; });
  check(sem2Courses.length === 1 && sem2Courses[0].id === courseS2, "step 3 — Semester 2 lists only its own courses");
  var sem2Course = await student.get("/api/courses/" + courseS2);
  check(sem2Course.status === 200 && sem2Course.body.videos.length === 2 &&
    sem2Course.body.course.semesterLabel === "Semester 2", "step 4 — Semester 2 course shows its video lessons");
  var sem2Watch = await student.get("/api/videos/" + vimeoId);
  check(sem2Watch.status === 200 && sem2Watch.body.video.provider === "vimeo" && sem2Watch.body.course.semester === 2,
    "step 5 — a Semester 2 video opens with its embeddable player");
  var semesterFilter = await student.get("/api/courses?university=" + universityId + "&semester=2");
  check(semesterFilter.body.courses.length === 1 && semesterFilter.body.courses[0].semester === 2,
    "the course endpoint can be filtered by university and semester");

  /* ---------------- 8. Search, reorder, edit, delete ---------------- */
  group("Discovery and management");
  var search = await student.get("/api/search?q=" + encodeURIComponent("heat engines"));
  check(search.status === 200 && search.body.videos.length === 1 && search.body.videos[0].title === "Heat Engines",
    "students can search video lessons");
  var searchUniversity = await student.get("/api/search?q=flow+test");
  check(searchUniversity.body.universities.length === 1 && searchUniversity.body.courses.length === 2,
    "search also matches universities and courses");
  var searchDraft = await student.get("/api/search?q=" + encodeURIComponent("nothing matches this"));
  check(searchDraft.status === 200 && searchDraft.body.videos.length === 0, "search returns an empty result set rather than an error");

  var orderBefore = (await student.get("/api/courses/" + courseS1)).body.videos.map(function (video) { return video.id; });
  var moved = await admin.post("/api/admin/videos/" + orderBefore[1] + "/move", { direction: "up" });
  check(moved.status === 200, "admin can reorder video lessons");
  var orderAfter = (await student.get("/api/courses/" + courseS1)).body.videos.map(function (video) { return video.id; });
  check(orderAfter[0] === orderBefore[1] && orderAfter[1] === orderBefore[0], "reordering changes the student-visible order");

  var edited = await admin.patch("/api/admin/videos/" + videoId, { title: "Variables, Types and Values", topic: "Variables", level: "premium" });
  check(edited.status === 200 && edited.body.video.title === "Variables, Types and Values" && edited.body.video.level === "premium",
    "admin can edit a video title, topic and access tier");
  var movedCourse = await admin.patch("/api/admin/videos/" + videoId, { courseId: courseS2 });
  check(movedCourse.status === 200 && movedCourse.body.video.semester === 2,
    "admin can move a video to another semester/course");
  await admin.patch("/api/admin/videos/" + videoId, { courseId: courseS1 });

  var overview = await admin.get("/api/admin/overview");
  check(overview.status === 200 && overview.body.universities === 1 && overview.body.courses === 2 &&
    overview.body.videos === 4 && overview.body.publishedVideos === 4 &&
    overview.body.semester1Courses === 1 && overview.body.semester2Courses === 1,
    "the admin overview reports real database counts, including per-semester totals");
  check(overview.body.checklist.every(function (item) { return item.done === true; }),
    "the getting-started checklist reflects real completion state");

  var deleted = await admin.del("/api/admin/videos/" + videoId);
  check(deleted.status === 200 && (await student.get("/api/videos/" + videoId)).status === 404,
    "admin can delete a video lesson and it disappears for students");
  var deleteCourse = await admin.del("/api/admin/courses/" + courseS2);
  check(deleteCourse.status === 200 && deleteCourse.body.removed.videos === 2 &&
    (await student.get("/api/courses/" + courseS2)).status === 404,
    "deleting a course removes its video lessons with it");
  var deleteMissing = await admin.del("/api/admin/videos/vid_missing");
  check(deleteMissing.status === 404, "deleting an unknown record reports not-found");

  /* ---------------- 9. Unpublished parents hide children ---------------- */
  group("Visibility rules");
  await admin.patch("/api/admin/universities/" + universityId, { status: "draft" });
  var hiddenUniversity = await student.get("/api/universities");
  check(hiddenUniversity.body.universities.length === 0, "an unpublished university is hidden from students");
  check((await student.get("/api/universities/" + universityId)).status === 404, "its detail page is hidden too");
  check((await student.get("/api/courses/" + courseS1)).status === 404, "and so are its courses");
  var adminStillSees = await admin.get("/api/admin/universities");
  check(adminStillSees.body.universities.length === 1 && adminStillSees.body.universities[0].status === "draft",
    "admins still see unpublished content");
  await admin.patch("/api/admin/universities/" + universityId, { status: "published" });
  check((await student.get("/api/universities")).body.universities.length === 1, "republishing restores student access");

  /* ---------------- 10. Static site keeps working ---------------- */
  group("Existing site integrity");
  var pages = ["index.html", "courses.html", "course.html?id=math", "universities.html", "university.html",
    "library.html", "dashboard.html", "lesson.html?id=math-1", "video.html", "search.html", "pricing.html",
    "access.html", "checkout.html?pkg=standard", "profile.html", "announcements.html",
    "assets/css/main.css", "assets/js/app.js", "assets/js/api.js", "assets/js/video.js", "assets/img/logo.jpg"];
  for (var i = 0; i < pages.length; i++) {
    var page = await student.get("/" + pages[i]);
    check(page.status === 200, "serves " + pages[i], "HTTP " + page.status);
  }
  var missingPage = await student.get("/definitely-missing.html");
  check(missingPage.status === 404, "unknown pages return a styled 404");

  /* ---------------- 11. Password change and sign-out ---------------- */
  group("Admin account");
  var changed = await admin.put("/api/admin/password", { currentPassword: "wrong", newPassword: "Another-Password-9" });
  check(changed.status === 401, "a wrong current password cannot change the admin password");
  var shortPassword = await admin.put("/api/admin/password", { currentPassword: "Flow-Test-Password-1", newPassword: "short" });
  check(shortPassword.status === 400, "weak new passwords are rejected");
  var changedOk = await admin.put("/api/admin/password", { currentPassword: "Flow-Test-Password-1", newPassword: "Another-Password-9" });
  check(changedOk.status === 200, "the admin can change their own password");
  var afterChange = await admin.get("/api/admin/session");
  check(afterChange.status === 200, "the current device stays signed in after the password change");
  var freshClient = makeClient(base);
  var oldPasswordLogin = await freshClient.post("/api/admin/login", { email: "admin@flowtest.local", password: "Flow-Test-Password-1" });
  check(oldPasswordLogin.status === 401, "the old password stops working");
  var newPasswordLogin = await freshClient.post("/api/admin/login", { email: "admin@flowtest.local", password: "Another-Password-9" });
  check(newPasswordLogin.status === 200, "the new password works");
  var signedOut = await admin.post("/api/admin/logout", {});
  check(signedOut.status === 200 && (await admin.get("/api/admin/overview")).status === 401,
    "signing out ends the session");

  /* ---------------- 12. Persistence across restarts ---------------- */
  group("Persistence");
  var beforeRestart = await freshClient.get("/api/stats");
  db.close();
  db.connect();
  var afterRestart = await freshClient.get("/api/stats");
  check(afterRestart.body.videos === beforeRestart.body.videos && afterRestart.body.universities === beforeRestart.body.universities,
    "content survives a database reconnect (stored on the server, not in a browser)");

  console.log("\n" + passed + " passed, " + failed + " failed");
  if (failures.length) {
    console.error("\nFailures:");
    failures.forEach(function (item) { console.error("  • " + item); });
  }
  return failed === 0;
}

main().then(function (ok) {
  try { app.server.close(); } catch (error) { /* already closed */ }
  try { db.close(); } catch (error) { /* already closed */ }
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (error) { /* best effort */ }
  process.exit(ok ? 0 : 1);
}).catch(function (error) {
  console.error(error);
  try { app.server.close(); } catch (e2) { /* ignore */ }
  process.exit(1);
});
