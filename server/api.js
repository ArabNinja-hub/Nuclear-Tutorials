/* ============================================================
   NUCLEAR TUTORIALS — JSON API

   Public reads (catalogue, search, announcements, settings),
   the student access-code + progress flow, and session-guarded
   administration for universities, courses and video lessons.
   ============================================================ */
"use strict";

var crypto = require("crypto");
var db = require("./db");

var SEMESTERS = [1, 2];
var LEVELS = ["basic", "standard", "premium"];
var LEVEL_RANK = { basic: 1, standard: 2, premium: 3 };
var LEVEL_LABEL = { basic: "Basic", standard: "Standard", premium: "Premium" };
var EDUCATION_LEVELS = ["high-school", "university"];
var PROVIDERS = ["youtube", "vimeo", "direct", "other"];
var ADMIN_COOKIE = "nt_admin";
/* The password shipped with earlier releases. It is never created by this
   version and is refused even if an old database still carries it. */
var DEFAULT_FIRST_RUN_PASSWORD = "nuclear-admin";

/* ------------------------------------------------------------
   Small utilities
   ------------------------------------------------------------ */

function text(value, max) {
  if (value == null) return "";
  var out = String(value).replace(/\s+/g, " ").trim();
  if (max && out.length > max) out = out.slice(0, max);
  return out;
}

function block(value, max) {
  if (value == null) return "";
  var out = String(value).replace(/\r\n/g, "\n").trim();
  if (max && out.length > max) out = out.slice(0, max);
  return out;
}

function int(value, fallback) {
  var n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function isUrl(value) {
  try {
    var url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

/* Video sources are stored as links. YouTube links also give us a
   thumbnail without the administrator having to upload one. */
function mediaInfo(sourceUrl, declaredProvider) {
  var url = String(sourceUrl || "").trim();
  var youtubeId = "";
  var provider = PROVIDERS.indexOf(declaredProvider) !== -1 ? declaredProvider : "";
  try {
    var parsed = new URL(url);
    var host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") youtubeId = parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (host.endsWith("youtube.com")) {
      if (parsed.searchParams.get("v")) youtubeId = parsed.searchParams.get("v");
      else if (/\/(embed|shorts|live)\//.test(parsed.pathname)) youtubeId = parsed.pathname.split("/").filter(Boolean)[1] || "";
      if (youtubeId) provider = "youtube";
    }
    if (host.endsWith("vimeo.com")) provider = "vimeo";
    if (!provider) provider = /\.(mp4|webm|m3u8|ogg)(\?|$)/i.test(url) ? "direct" : (host ? "other" : "other");
  } catch (error) {
    if (!provider) provider = "other";
  }
  var thumbnail = youtubeId ? "https://i.ytimg.com/vi/" + youtubeId + "/hqdefault.jpg" : "";
  return { provider: provider || "other", youtubeId: youtubeId, thumbnail: thumbnail };
}

/* "18:24" or "1:02:33" or "1124" → seconds */
function durationToSeconds(value) {
  if (value == null || value === "") return null;
  var raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    var seconds = parseInt(raw, 10);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }
  var parts = raw.split(":").map(function (part) { return parseInt(part, 10); });
  if (parts.some(function (part) { return !Number.isFinite(part) || part < 0; })) return null;
  var total = 0;
  parts.forEach(function (part) { total = total * 60 + part; });
  return total > 0 ? total : null;
}

function round(value) { return value ? Number(value) : null; }

/* ------------------------------------------------------------
   Row mappers
   ------------------------------------------------------------ */

function university(row, counts) {
  var stats = counts || { courses: 0, videos: 0 };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name || row.name,
    city: row.city || "",
    level: row.level,
    summary: row.summary || "",
    accent: row.accent || "",
    position: row.position,
    courseCount: Number(stats.courses) || 0,
    videoCount: Number(stats.videos) || 0
  };
}

function course(row, counts) {
  var stats = counts || { videos: 0, published: 0 };
  return {
    id: row.id,
    universityId: row.university_id,
    universityName: row.university_name || "",
    universityShort: row.university_short || row.university_name || "",
    universityLevel: row.university_level || "university",
    semester: row.semester,
    code: row.code || "",
    title: row.title,
    description: row.description || "",
    icon: row.icon || "book-open",
    tint: row.tint || "",
    tintFg: row.tint_fg || "",
    position: row.position,
    videoCount: Number(stats.videos) || 0,
    publishedCount: Number(stats.published) || 0
  };
}

function video(row) {
  var published = row.published === 1 || row.published === true;
  return {
    id: row.id,
    courseId: row.course_id,
    courseTitle: row.course_title || "",
    courseCode: row.course_code || "",
    universityId: row.university_id || "",
    universityName: row.university_name || "",
    universityShort: row.university_short || "",
    universityLevel: row.university_level || "university",
    semester: row.semester,
    title: row.title,
    topic: row.topic || "",
    description: row.description || "",
    sourceUrl: row.source_url,
    provider: row.provider || "other",
    thumbnailUrl: row.thumbnail_url || "",
    durationSeconds: round(row.duration_seconds),
    level: LEVELS.indexOf(row.level) !== -1 ? row.level : "standard",
    position: row.position,
    published: published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

var VIDEO_SELECT = `
  SELECT v.*, c.title AS course_title, c.code AS course_code, c.semester AS semester,
         u.id AS university_id, u.name AS university_name, u.short_name AS university_short,
         u.level AS university_level
  FROM videos v
  JOIN courses c ON c.id = v.course_id
  JOIN universities u ON u.id = c.university_id`;

var COURSE_SELECT = `
  SELECT c.*, u.name AS university_name, u.short_name AS university_short, u.level AS university_level
  FROM courses c
  JOIN universities u ON u.id = c.university_id`;

function allUniversities() {
  return db.db().prepare("SELECT * FROM universities ORDER BY position, name").all().map(function (row) {
    var counts = db.db().prepare(`
      SELECT (SELECT COUNT(*) FROM courses WHERE university_id = ?) AS courses,
             (SELECT COUNT(*) FROM videos WHERE published = 1 AND course_id IN (SELECT id FROM courses WHERE university_id = ?)) AS videos`)
      .get(row.id, row.id);
    return university(row, counts);
  });
}

function allCourses(filter) {
  var where = [];
  var params = [];
  if (filter && filter.universityId) { where.push("c.university_id = ?"); params.push(filter.universityId); }
  if (filter && filter.semester) { where.push("c.semester = ?"); params.push(filter.semester); }
  var sql = COURSE_SELECT + (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY u.position, c.semester, c.position, c.title";
  return db.db().prepare(sql).all(...params).map(function (row) {
    var counts = db.db().prepare(`
      SELECT (SELECT COUNT(*) FROM videos WHERE course_id = ?) AS videos,
             (SELECT COUNT(*) FROM videos WHERE course_id = ? AND published = 1) AS published`)
      .get(row.id, row.id);
    return course(row, counts);
  });
}

function allVideos(filter) {
  var where = [];
  var params = [];
  if (filter && filter.universityId) { where.push("u.id = ?"); params.push(filter.universityId); }
  if (filter && filter.semester) { where.push("c.semester = ?"); params.push(filter.semester); }
  if (filter && filter.courseId) { where.push("v.course_id = ?"); params.push(filter.courseId); }
  if (filter && filter.publishedOnly) where.push("v.published = 1");
  if (filter && filter.unpublishedOnly) where.push("v.published = 0");
  if (filter && filter.q) {
    where.push("(v.title LIKE ? OR v.topic LIKE ? OR v.description LIKE ? OR c.title LIKE ?)");
    var like = "%" + filter.q + "%";
    params.push(like, like, like, like);
  }
  var sql = VIDEO_SELECT + (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY u.position, c.semester, c.position, v.position, v.created_at";
  return db.db().prepare(sql).all(...params).map(video);
}

function videoById(id) {
  var row = db.db().prepare(VIDEO_SELECT + " WHERE v.id = ?").get(String(id || ""));
  return row ? video(row) : null;
}

function universityById(id) {
  var row = db.db().prepare("SELECT * FROM universities WHERE id = ?").get(String(id || ""));
  return row ? university(row) : null;
}

function courseById(id) {
  var row = db.db().prepare(COURSE_SELECT + " WHERE c.id = ?").get(String(id || ""));
  return row ? course(row) : null;
}

function publishedAnnouncements() {
  return db.db().prepare("SELECT * FROM announcements WHERE status = 'published' ORDER BY updated_at DESC").all()
    .map(function (row) {
      return { id: row.id, title: row.title, body: row.body, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
    });
}

function catalogue() {
  var universities = allUniversities();
  var courses = allCourses();
  var videos = allVideos({ publishedOnly: true });
  var byLevel = { basic: 0, standard: 0, premium: 0 };
  videos.forEach(function (item) { byLevel[item.level] = (byLevel[item.level] || 0) + 1; });
  return {
    universities: universities.filter(function (item) { return item.level === "university"; }),
    schools: universities.filter(function (item) { return item.level === "high-school"; }),
    courses: courses,
    videos: videos,
    totals: {
      universities: universities.filter(function (item) { return item.level === "university"; }).length,
      schools: universities.filter(function (item) { return item.level === "high-school"; }).length,
      courses: courses.length,
      videos: videos.length,
      levels: byLevel
    },
    generatedAt: new Date().toISOString()
  };
}

/* ------------------------------------------------------------
   Progress helpers — identity is the student's access code
   ------------------------------------------------------------ */

function validCode(code) {
  var row = db.db().prepare("SELECT * FROM codes WHERE code = ?").get(String(code || "").toUpperCase().trim());
  return row || null;
}

function progressFor(code) {
  return db.db().prepare("SELECT * FROM progress WHERE code = ? ORDER BY updated_at DESC").all(String(code || ""))
    .map(function (row) {
      return { videoId: row.video_id, completed: row.completed === 1, seconds: round(row.seconds), updatedAt: row.updated_at };
    });
}

/* ------------------------------------------------------------
   Response helpers
   ------------------------------------------------------------ */

function send(res, status, payload) {
  var body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Vary": "X-NT-Code, Cookie"
  });
  res.end(body);
}

function fail(res, status, message, details) {
  send(res, status, { ok: false, error: message, details: details || undefined });
}

function ok(res, payload, status) {
  send(res, status || 200, Object.assign({ ok: true }, payload || {}));
}

function readBody(req) {
  return new Promise(function (resolve) {
    var chunks = [];
    var size = 0;
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > 512 * 1024) { req.destroy(); resolve(null); return; }
      chunks.push(chunk);
    });
    req.on("end", function () {
      if (!chunks.length) return resolve({});
      try {
        var parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(parsed && typeof parsed === "object" ? parsed : {});
      } catch (error) {
        resolve(null);
      }
    });
    req.on("error", function () { resolve(null); });
  });
}

function parseCookies(header) {
  var out = {};
  String(header || "").split(";").forEach(function (part) {
    var index = part.indexOf("=");
    if (index === -1) return;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return out;
}

function adminSession(req) {
  var cookies = parseCookies(req.headers.cookie);
  return db.readSession(cookies[ADMIN_COOKIE]);
}

function studentCode(req, body) {
  var header = text(req.headers["x-nt-code"], 64).toUpperCase();
  var candidate = header || text(body && body.code, 64).toUpperCase();
  return candidate;
}

/* ------------------------------------------------------------
   Package access

   The server is the only authority on which lessons a student may
   watch. The browser sends its access code with every request; the
   code's package, its status and its expiry are read from the
   database, so editing localStorage or calling the API directly
   cannot unlock a higher tier.

     basic    → basic
     standard → basic + standard
     premium  → basic + standard + premium
   ------------------------------------------------------------ */

function codeRow(code) {
  if (!code) return null;
  return db.db().prepare("SELECT * FROM codes WHERE code = ?").get(String(code).toUpperCase().trim()) || null;
}

function accessFor(row) {
  if (!row || LEVELS.indexOf(row.package) === -1) return null;
  if (row.status !== "redeemed") return null;
  var settings = db.getSettings();
  var since = row.redeemed_at ? new Date(row.redeemed_at) : null;
  var expires = since ? new Date(since.getTime() + settings.accessDays * 86400000) : null;
  var active = !!expires && expires.getTime() > Date.now();
  return {
    code: row.code,
    package: row.package,
    level: LEVEL_RANK[row.package] || 0,
    status: row.status,
    since: row.redeemed_at || null,
    expiresAt: expires ? expires.toISOString() : null,
    active: active
  };
}

/* Resolve the access grant behind a request: a valid code that has been
   redeemed and has not expired. Anything else is a visitor. */
function requestAccess(req, body) {
  return accessFor(codeRow(studentCode(req, body)));
}

function tierOf(level) { return LEVEL_RANK[level] || 0; }

/* Admins reviewing the public pages see every lesson. */
var FULL_ACCESS = { active: true, level: 99, package: "premium", code: null, expiresAt: null, since: null };

function canWatch(video, access) {
  if (!video || !video.published) return false;
  var rank = access && access.active ? access.level : 0;
  return rank >= tierOf(video.level);
}

/* A lesson is only sent to a client that is allowed to watch it: the
   source URL and the provider thumbnail are removed for everyone else,
   so a protected video cannot be scraped from a catalogue response. */
function protectVideo(video, access) {
  if (!video) return video;
  var allowed = canWatch(video, access);
  return Object.assign({}, video, {
    locked: !allowed,
    sourceUrl: allowed ? video.sourceUrl : null,
    provider: allowed ? video.provider : null,
    thumbnailUrl: allowed ? video.thumbnailUrl : null
  });
}

function protectVideos(videos, access) {
  return videos.map(function (video) { return protectVideo(video, access); });
}

function protectCatalogue(data, access) {
  return Object.assign({}, data, { videos: protectVideos(data.videos, access) });
}

function publicAccess(access) {
  if (!access) return { active: false, package: null, level: 0, code: null, expiresAt: null };
  return {
    active: access.active,
    package: access.package,
    level: access.level,
    code: access.code,
    expiresAt: access.expiresAt,
    since: access.since
  };
}

/* ------------------------------------------------------------
   Validation shared by admin writes
   ------------------------------------------------------------ */

function validateUniversityInput(body, options) {
  var partial = options && options.partial;
  var out = {};
  var errors = [];
  if (body.name != null || !partial) {
    var name = text(body.name, 120);
    if (name.length < 3) errors.push("Enter the university or school name.");
    out.name = name;
  }
  if (body.shortName != null) out.short_name = text(body.shortName, 40);
  if (body.city != null) out.city = text(body.city, 60);
  if (body.summary != null) out.summary = block(body.summary, 400);
  if (body.accent != null) out.accent = text(body.accent, 20);
  if (body.level != null) {
    var level = text(body.level, 20);
    if (EDUCATION_LEVELS.indexOf(level) === -1) errors.push("Choose University or High School.");
    out.level = level;
  } else if (!partial) {
    out.level = "university";
  }
  if (body.position != null) out.position = int(body.position, 0);
  return { values: out, errors: errors };
}

function validateCourseInput(body, options) {
  var partial = options && options.partial;
  var out = {};
  var errors = [];
  if (body.title != null || !partial) {
    var title = text(body.title, 120);
    if (title.length < 3) errors.push("Enter a course title.");
    out.title = title;
  }
  if (body.universityId != null || !partial) {
    var universityId = text(body.universityId, 60);
    if (!universityById(universityId)) errors.push("Choose the university this course belongs to.");
    out.university_id = universityId;
  }
  if (body.semester != null || !partial) {
    var semester = int(body.semester, 0);
    if (SEMESTERS.indexOf(semester) === -1) errors.push("Choose Semester 1 or Semester 2.");
    out.semester = semester;
  }
  if (body.code != null) out.code = text(body.code, 20);
  if (body.description != null) out.description = block(body.description, 500);
  if (body.icon != null) out.icon = text(body.icon, 40) || "book-open";
  if (body.tint != null) out.tint = text(body.tint, 20);
  if (body.tintFg != null) out.tint_fg = text(body.tintFg, 20);
  if (body.position != null) out.position = int(body.position, 0);
  return { values: out, errors: errors };
}

function validateVideoInput(body, options) {
  var partial = options && options.partial;
  var out = {};
  var errors = [];
  if (body.title != null || !partial) {
    var title = text(body.title, 160);
    if (title.length < 3) errors.push("Enter a video title.");
    out.title = title;
  }
  if (body.courseId != null || !partial) {
    var courseId = text(body.courseId, 80);
    if (!courseById(courseId)) errors.push("Choose the university, semester and course for this video.");
    out.course_id = courseId;
  }
  if (body.sourceUrl != null || !partial) {
    var sourceUrl = text(body.sourceUrl, 500);
    if (!isUrl(sourceUrl)) errors.push("Enter a valid video URL (starting with http:// or https://).");
    out.source_url = sourceUrl;
  }
  if (body.topic != null) out.topic = text(body.topic, 120);
  if (body.description != null) out.description = block(body.description, 1200);
  if (body.thumbnailUrl != null) {
    var thumb = text(body.thumbnailUrl, 500);
    if (thumb && !isUrl(thumb)) errors.push("The thumbnail must be a valid image URL.");
    out.thumbnail_url = thumb;
  }
  if (body.duration != null) {
    if (String(body.duration).trim() === "") out.duration_seconds = null;
    else {
      var seconds = durationToSeconds(body.duration);
      if (seconds == null) errors.push("Enter the duration as minutes:seconds, for example 12:30.");
      out.duration_seconds = seconds;
    }
  }
  if (body.level != null) {
    var level = text(body.level, 20);
    if (LEVELS.indexOf(level) === -1) errors.push("Choose an access level (Basic, Standard or Premium).");
    out.level = level;
  } else if (!partial) {
    out.level = "standard";
  }
  if (body.published != null) out.published = body.published ? 1 : 0;
  if (body.position != null) out.position = int(body.position, 0);
  return { values: out, errors: errors };
}

/* ------------------------------------------------------------
   Route handlers — public
   ------------------------------------------------------------ */

var routes = [];
function route(method, pattern, handler, options) {
  var keys = [];
  var regex = new RegExp("^" + pattern.replace(/:[A-Za-z]+/g, function (token) {
    keys.push(token.slice(1));
    return "([^/]+)";
  }) + "$");
  routes.push({ method: method, regex: regex, keys: keys, handler: handler, admin: !!(options && options.admin) });
}

route("GET", "/api/health", function (req, res) {
  ok(res, { service: "nuclear-tutorials", database: db.DB_FILE, time: new Date().toISOString() });
});

route("GET", "/api/catalogue", function (req, res) {
  var access = requestAccess(req, null);
  ok(res, {
    catalogue: protectCatalogue(catalogue(), access),
    settings: publicSettings(),
    access: publicAccess(access)
  });
});

route("GET", "/api/universities", function (req, res) {
  ok(res, { universities: allUniversities() });
});

route("GET", "/api/courses", function (req, res, params, ctx) {
  ok(res, {
    courses: allCourses({ universityId: ctx.query.get("university") || "", semester: int(ctx.query.get("semester"), 0) || 0 })
  });
});

route("GET", "/api/videos", function (req, res, params, ctx) {
  /* Draft lessons are for administrators only; a student asking for
     status=all still receives published lessons. */
  var admin = !!ctxAdmin(req);
  var filter = {
    universityId: ctx.query.get("university") || "",
    semester: int(ctx.query.get("semester"), 0) || 0,
    courseId: ctx.query.get("course") || "",
    q: text(ctx.query.get("q"), 80),
    publishedOnly: !(admin && ctx.query.get("status") === "all")
  };
  var access = admin ? FULL_ACCESS : requestAccess(req, null);
  ok(res, { videos: protectVideos(allVideos(filter), access) });
});

route("GET", "/api/videos/:id", function (req, res, params) {
  var admin = !!ctxAdmin(req);
  var access = admin ? FULL_ACCESS : requestAccess(req, null);
  var found = videoById(params.id);
  if (!found || (!found.published && !admin)) return fail(res, 404, "That video lesson could not be found.");
  /* Requesting a protected lesson directly does not return its source URL. */
  if (!admin && !canWatch(found, access)) {
    return fail(res, 403, "This lesson is included with the " + (LEVEL_LABEL[found.level] || found.level) +
      " package. Redeem a matching access code to watch it.", {
      locked: true,
      video: { id: found.id, title: found.title, level: found.level, courseId: found.courseId, semester: found.semester }
    });
  }
  var siblings = allVideos({ courseId: found.courseId, publishedOnly: !admin });
  var index = siblings.map(function (item) { return item.id; }).indexOf(found.id);
  ok(res, {
    video: protectVideo(found, access),
    access: publicAccess(access),
    course: courseById(found.courseId),
    university: universityById(found.universityId),
    lessons: protectVideos(siblings, access),
    previous: index > 0 ? protectVideo(siblings[index - 1], access) : null,
    next: index >= 0 && index < siblings.length - 1 ? protectVideo(siblings[index + 1], access) : null
  });
});

function ctxAdmin(req) { return !!adminSession(req); }

route("GET", "/api/search", function (req, res, params, ctx) {
  var access = requestAccess(req, null);
  var query = text(ctx.query.get("q"), 80).toLowerCase();
  if (!query) return ok(res, { query: "", universities: [], courses: [], videos: [], announcements: [] });
  var universities = allUniversities().filter(function (item) {
    return (item.name + " " + item.shortName + " " + item.city + " " + item.summary).toLowerCase().indexOf(query) !== -1;
  });
  var courses = allCourses().filter(function (item) {
    return (item.title + " " + item.code + " " + item.description + " " + item.universityName).toLowerCase().indexOf(query) !== -1;
  });
  var videos = allVideos({ publishedOnly: true, q: query });
  var announcements = publishedAnnouncements().filter(function (item) {
    return (item.title + " " + item.body).toLowerCase().indexOf(query) !== -1;
  });
  ok(res, { query: query, universities: universities, courses: courses, videos: protectVideos(videos, access), announcements: announcements });
});

route("GET", "/api/announcements", function (req, res) {
  ok(res, { announcements: publishedAnnouncements() });
});

function publicSettings() {
  var settings = db.getSettings();
  return {
    supportEmail: settings.supportEmail,
    accessDays: settings.accessDays,
    packages: settings.packages
  };
}

route("GET", "/api/settings", function (req, res) {
  ok(res, { settings: publicSettings() });
});

/* ---------- student access flow ---------- */

route("POST", "/api/codes/issue", async function (req, res, params, ctx) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var pkg = text(body.package, 20);
  if (LEVELS.indexOf(pkg) === -1) return fail(res, 400, "Choose a package (basic, standard or premium).");
  var code = "";
  for (var attempt = 0; attempt < 12; attempt++) {
    code = "NT-" + pkg.toUpperCase() + "-" + crypto.randomInt(1000, 9999);
    if (!validCode(code)) break;
  }
  db.db().prepare("INSERT INTO codes (code, package, status, issued_at) VALUES (?, ?, 'unused', ?)")
    .run(code, pkg, db.now());
  ok(res, { code: code, package: pkg }, 201);
});

route("POST", "/api/access/redeem", async function (req, res) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var code = text(body.code, 40).toUpperCase();
  var educationLevel = text(body.educationLevel, 20);
  if (EDUCATION_LEVELS.indexOf(educationLevel) === -1) {
    return fail(res, 400, "Choose High School or University before continuing.", { field: "educationLevel" });
  }
  if (!code) return fail(res, 400, "Enter your access code.", { field: "code" });
  var record = validCode(code);
  if (!record || LEVELS.indexOf(record.package) === -1) {
    return fail(res, 404, "That code could not be found. Check the code or generate one from Access packages.", { field: "code" });
  }
  if (record.status === "redeemed") {
    return fail(res, 409, "This code has already been used. Each code can be redeemed once.", { field: "code" });
  }
  var redeemedAt = db.now();
  db.db().prepare("UPDATE codes SET status = 'redeemed', redeemed_at = ? WHERE code = ?").run(redeemedAt, code);
  var settings = db.getSettings();
  var expires = new Date(new Date(redeemedAt).getTime() + settings.accessDays * 86400000).toISOString();
  ok(res, {
    access: {
      code: code,
      package: record.package,
      educationLevel: educationLevel,
      since: redeemedAt,
      expiresAt: expires,
      accessDays: settings.accessDays
    }
  });
});

route("GET", "/api/progress", function (req, res, params, ctx) {
  var access = requestAccess(req, { code: ctx.query.get("code") });
  if (!access || !access.active) return fail(res, 401, "An active access code is required to load progress.");
  ok(res, { progress: progressFor(access.code), access: publicAccess(access) });
});

route("POST", "/api/progress", async function (req, res) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var access = requestAccess(req, body);
  if (!access || !access.active) return fail(res, 401, "An active access code is required to save progress.");
  var code = access.code;
  var found = videoById(text(body.videoId, 80));
  if (!found) return fail(res, 404, "That video lesson could not be found.");
  var seconds = body.seconds == null ? null : int(body.seconds, 0);
  db.db().prepare(`
    INSERT INTO progress (code, video_id, completed, seconds, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(code, video_id) DO UPDATE SET completed = excluded.completed, seconds = excluded.seconds, updated_at = excluded.updated_at`)
    .run(code, found.id, body.completed === false ? 0 : 1, seconds, db.now());
  ok(res, { progress: progressFor(code) });
});

route("DELETE", "/api/progress", async function (req, res) {
  var body = await readBody(req);
  var access = requestAccess(req, body || {});
  if (!access || !access.active) return fail(res, 401, "An active access code is required.");
  var code = access.code;
  if (body && body.videoId) {
    db.db().prepare("DELETE FROM progress WHERE code = ? AND video_id = ?").run(code, text(body.videoId, 80));
  } else {
    db.db().prepare("DELETE FROM progress WHERE code = ?").run(code);
  }
  ok(res, { progress: progressFor(code) });
});

/* ------------------------------------------------------------
   Admin — sessions
   ------------------------------------------------------------ */

route("POST", "/api/admin/login", async function (req, res) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var password = String(body.password || "");
  if (!password) return fail(res, 400, "Enter the administrator password.");
  if (!db.verifyAdminPassword(password)) return fail(res, 401, "That password is not correct.");
  if (db.adminMustChangePassword() && password === DEFAULT_FIRST_RUN_PASSWORD) {
    return fail(res, 403, "The first-run administrator password cannot be used for normal use. Sign in with the password you chose and change it in Settings.");
  }
  var session = db.createSession();
  res.setHeader("Set-Cookie", ADMIN_COOKIE + "=" + session.token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + (db.SESSION_DAYS * 86400));
  ok(res, { authenticated: true, expiresAt: session.expiresAt, mustChangePassword: db.adminMustChangePassword() });
});

route("POST", "/api/admin/logout", async function (req, res) {
  var cookies = parseCookies(req.headers.cookie);
  db.destroySession(cookies[ADMIN_COOKIE]);
  res.setHeader("Set-Cookie", ADMIN_COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  ok(res, { authenticated: false });
});

route("GET", "/api/admin/session", function (req, res) {
  var session = adminSession(req);
  ok(res, {
    authenticated: !!session,
    expiresAt: session ? session.expires_at : null,
    mustChangePassword: !!session && db.adminMustChangePassword()
  });
});

/* ------------------------------------------------------------
   Admin — overview
   ------------------------------------------------------------ */

route("GET", "/api/admin/overview", function (req, res) {
  var database = db.db();
  var videos = allVideos({});
  var published = videos.filter(function (item) { return item.published; });
  var courses = allCourses();
  var universities = allUniversities();
  var codes = database.prepare("SELECT * FROM codes ORDER BY issued_at DESC").all();
  var watched = database.prepare("SELECT COUNT(DISTINCT code) AS students, COUNT(*) AS views FROM progress").get();
  var semesterCounts = SEMESTERS.map(function (semester) {
    return {
      semester: semester,
      courses: courses.filter(function (item) { return item.semester === semester; }).length,
      videos: videos.filter(function (item) { return item.semester === semester; }).length
    };
  });
  ok(res, {
    totals: {
      universities: universities.filter(function (item) { return item.level === "university"; }).length,
      schools: universities.filter(function (item) { return item.level === "high-school"; }).length,
      courses: courses.length,
      videos: videos.length,
      published: published.length,
      drafts: videos.length - published.length,
      codes: codes.length,
      codesRedeemed: codes.filter(function (item) { return item.status === "redeemed"; }).length,
      students: Number(watched.students) || 0,
      views: Number(watched.views) || 0
    },
    semesters: semesterCounts,
    recentVideos: videos.slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }).slice(0, 5),
    universities: universities
  });
});

/* ------------------------------------------------------------
   Admin — universities
   ------------------------------------------------------------ */

route("GET", "/api/admin/universities", function (req, res) {
  ok(res, { universities: allUniversities() });
});

route("POST", "/api/admin/universities", async function (req, res) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var check = validateUniversityInput(body, {});
  if (check.errors.length) return fail(res, 400, check.errors[0], { errors: check.errors });
  var values = check.values;
  var id = db.uniqueId(values.name, function (candidate) { return !!universityById(candidate); });
  var stamp = db.now();
  db.db().prepare(`
    INSERT INTO universities (id, slug, name, short_name, city, level, summary, accent, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id, id, values.name, values.short_name || values.name, values.city || "",
      values.level || "university", values.summary || "", values.accent || "",
      values.position == null ? (allUniversities().length + 1) * 10 : values.position, stamp, stamp
    );
  ok(res, { university: universityById(id) }, 201);
});

route("PATCH", "/api/admin/universities/:id", async function (req, res, params) {
  var existing = universityById(params.id);
  if (!existing) return fail(res, 404, "That university could not be found.");
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var check = validateUniversityInput(body, { partial: true });
  if (check.errors.length) return fail(res, 400, check.errors[0], { errors: check.errors });
  var values = check.values;
  if (!Object.keys(values).length) return fail(res, 400, "Nothing to update.");
  var assignments = Object.keys(values).map(function (key) { return key + " = ?"; });
  var paramsList = Object.keys(values).map(function (key) { return values[key]; });
  paramsList.push(db.now(), params.id);
  db.db().prepare("UPDATE universities SET " + assignments.join(", ") + ", updated_at = ? WHERE id = ?")
    .run(...paramsList);
  ok(res, { university: universityById(params.id) });
});

route("DELETE", "/api/admin/universities/:id", async function (req, res, params) {
  var existing = universityById(params.id);
  if (!existing) return fail(res, 404, "That university could not be found.");
  db.db().prepare("DELETE FROM universities WHERE id = ?").run(params.id);
  ok(res, { deleted: params.id });
});

/* ------------------------------------------------------------
   Admin — courses
   ------------------------------------------------------------ */

route("GET", "/api/admin/courses", function (req, res, params, ctx) {
  ok(res, {
    courses: allCourses({
      universityId: ctx.query.get("university") || "",
      semester: int(ctx.query.get("semester"), 0) || 0
    })
  });
});

route("POST", "/api/admin/courses", async function (req, res) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var check = validateCourseInput(body, {});
  if (check.errors.length) return fail(res, 400, check.errors[0], { errors: check.errors });
  var values = check.values;
  var id = db.uniqueId((values.code ? values.code + " " : "") + values.title, function (candidate) { return !!courseById(candidate); });
  var stamp = db.now();
  var siblingCount = allCourses({ universityId: values.university_id, semester: values.semester }).length;
  db.db().prepare(`
    INSERT INTO courses (id, university_id, semester, code, title, description, icon, tint, tint_fg, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id, values.university_id, values.semester, values.code || "", values.title, values.description || "",
      values.icon || "book-open", values.tint || "", values.tint_fg || "",
      values.position == null ? (siblingCount + 1) * 10 : values.position, stamp, stamp
    );
  ok(res, { course: courseById(id) }, 201);
});

route("PATCH", "/api/admin/courses/:id", async function (req, res, params) {
  var existing = courseById(params.id);
  if (!existing) return fail(res, 404, "That course could not be found.");
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var check = validateCourseInput(body, { partial: true });
  if (check.errors.length) return fail(res, 400, check.errors[0], { errors: check.errors });
  var values = check.values;
  if (!Object.keys(values).length) return fail(res, 400, "Nothing to update.");
  var assignments = Object.keys(values).map(function (key) { return key + " = ?"; });
  var paramsList = Object.keys(values).map(function (key) { return values[key]; });
  paramsList.push(db.now(), params.id);
  db.db().prepare("UPDATE courses SET " + assignments.join(", ") + ", updated_at = ? WHERE id = ?").run(...paramsList);
  ok(res, { course: courseById(params.id) });
});

route("DELETE", "/api/admin/courses/:id", async function (req, res, params) {
  var existing = courseById(params.id);
  if (!existing) return fail(res, 404, "That course could not be found.");
  db.db().prepare("DELETE FROM courses WHERE id = ?").run(params.id);
  ok(res, { deleted: params.id });
});

/* ------------------------------------------------------------
   Admin — video lessons
   ------------------------------------------------------------ */

route("GET", "/api/admin/videos", function (req, res, params, ctx) {
  var status = ctx.query.get("status") || "all";
  ok(res, {
    videos: allVideos({
      universityId: ctx.query.get("university") || "",
      semester: int(ctx.query.get("semester"), 0) || 0,
      courseId: ctx.query.get("course") || "",
      q: text(ctx.query.get("q"), 80),
      publishedOnly: status === "published",
      unpublishedOnly: status === "draft"
    })
  });
});

route("POST", "/api/admin/videos", async function (req, res) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var check = validateVideoInput(body, {});
  if (check.errors.length) return fail(res, 400, check.errors[0], { errors: check.errors });
  var values = check.values;
  var media = mediaInfo(values.source_url);
  var id = db.uniqueId(values.title, function (candidate) { return !!videoById(candidate); });
  var stamp = db.now();
  var siblingCount = allVideos({ courseId: values.course_id }).length;
  db.db().prepare(`
    INSERT INTO videos (id, course_id, title, topic, description, source_url, provider, thumbnail_url,
                        duration_seconds, level, position, published, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id, values.course_id, values.title, values.topic || "", values.description || "", values.source_url,
      media.provider, values.thumbnail_url || media.thumbnail, values.duration_seconds || null,
      values.level || "standard",
      values.position == null ? (siblingCount + 1) * 10 : values.position,
      values.published == null ? 1 : values.published, stamp, stamp
    );
  ok(res, { video: videoById(id) }, 201);
});

route("PATCH", "/api/admin/videos/:id", async function (req, res, params) {
  var existing = videoById(params.id);
  if (!existing) return fail(res, 404, "That video lesson could not be found.");
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var check = validateVideoInput(body, { partial: true });
  if (check.errors.length) return fail(res, 400, check.errors[0], { errors: check.errors });
  var values = check.values;
  if (values.source_url) {
    var media = mediaInfo(values.source_url);
    values.provider = media.provider;
    if (!values.thumbnail_url && media.thumbnail) values.thumbnail_url = media.thumbnail;
  }
  if (!Object.keys(values).length) return fail(res, 400, "Nothing to update.");
  var assignments = Object.keys(values).map(function (key) { return key + " = ?"; });
  var paramsList = Object.keys(values).map(function (key) { return values[key]; });
  paramsList.push(db.now(), params.id);
  db.db().prepare("UPDATE videos SET " + assignments.join(", ") + ", updated_at = ? WHERE id = ?").run(...paramsList);
  ok(res, { video: videoById(params.id) });
});

route("DELETE", "/api/admin/videos/:id", async function (req, res, params) {
  var existing = videoById(params.id);
  if (!existing) return fail(res, 404, "That video lesson could not be found.");
  db.db().prepare("DELETE FROM videos WHERE id = ?").run(params.id);
  db.db().prepare("DELETE FROM progress WHERE video_id = ?").run(params.id);
  ok(res, { deleted: params.id });
});

/* Reordering keeps the lesson sequence stable inside a course. */
route("POST", "/api/admin/videos/:id/move", async function (req, res, params) {
  var existing = videoById(params.id);
  if (!existing) return fail(res, 404, "That video lesson could not be found.");
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var direction = text(body.direction, 10);
  if (["up", "down", "top", "bottom"].indexOf(direction) === -1) {
    return fail(res, 400, "Choose a valid direction (up, down, top or bottom).");
  }
  var lessons = allVideos({ courseId: existing.courseId });
  var index = lessons.map(function (item) { return item.id; }).indexOf(existing.id);
  if (index === -1) return fail(res, 404, "That video lesson is no longer in this course.");
  var target = index;
  if (direction === "up") target = Math.max(0, index - 1);
  if (direction === "down") target = Math.min(lessons.length - 1, index + 1);
  if (direction === "top") target = 0;
  if (direction === "bottom") target = lessons.length - 1;
  if (target !== index) {
    lessons.splice(index, 1);
    lessons.splice(target, 0, existing);
  }
  var statement = db.db().prepare("UPDATE videos SET position = ?, updated_at = ? WHERE id = ?");
  var stamp = db.now();
  lessons.forEach(function (item, position) { statement.run((position + 1) * 10, stamp, item.id); });
  ok(res, { videos: allVideos({ courseId: existing.courseId }) });
});

/* ------------------------------------------------------------
   Admin — access codes
   ------------------------------------------------------------ */

route("GET", "/api/admin/codes", function (req, res) {
  var codes = db.db().prepare("SELECT * FROM codes ORDER BY issued_at DESC").all().map(function (row) {
    return {
      code: row.code, package: row.package, status: row.status,
      issuedAt: row.issued_at, redeemedAt: row.redeemed_at
    };
  });
  ok(res, { codes: codes });
});

route("POST", "/api/admin/codes", async function (req, res) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var pkg = text(body.package, 20);
  if (LEVELS.indexOf(pkg) === -1) return fail(res, 400, "Choose a package (basic, standard or premium).");
  var count = Math.min(Math.max(int(body.count, 1), 1), 25);
  var created = [];
  for (var index = 0; index < count; index++) {
    var code = "";
    for (var attempt = 0; attempt < 12; attempt++) {
      code = "NT-" + pkg.toUpperCase() + "-" + crypto.randomInt(1000, 9999);
      if (!validCode(code)) break;
    }
    db.db().prepare("INSERT INTO codes (code, package, status, issued_at) VALUES (?, ?, 'unused', ?)").run(code, pkg, db.now());
    created.push(code);
  }
  ok(res, { codes: created }, 201);
});

route("DELETE", "/api/admin/codes/:id", function (req, res, params) {
  db.db().prepare("DELETE FROM codes WHERE code = ?").run(String(params.id).toUpperCase());
  ok(res, { deleted: params.id });
});

/* ------------------------------------------------------------
   Admin — announcements
   ------------------------------------------------------------ */

route("GET", "/api/admin/announcements", function (req, res) {
  var items = db.db().prepare("SELECT * FROM announcements ORDER BY updated_at DESC").all().map(function (row) {
    return { id: row.id, title: row.title, body: row.body, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
  });
  ok(res, { announcements: items });
});

route("POST", "/api/admin/announcements", async function (req, res) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var title = text(body.title, 140);
  var message = block(body.body, 2000);
  var status = text(body.status, 20) === "published" ? "published" : "draft";
  if (title.length < 3 || message.length < 3) return fail(res, 400, "Add an announcement title and message.");
  var id = "notice-" + Date.now().toString(36);
  var stamp = db.now();
  db.db().prepare("INSERT INTO announcements (id, title, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, title, message, status, stamp, stamp);
  ok(res, { id: id }, 201);
});

route("PATCH", "/api/admin/announcements/:id", async function (req, res, params) {
  var existing = db.db().prepare("SELECT * FROM announcements WHERE id = ?").get(params.id);
  if (!existing) return fail(res, 404, "That announcement could not be found.");
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var updates = [];
  var values = [];
  if (body.title != null) { updates.push("title = ?"); values.push(text(body.title, 140)); }
  if (body.body != null) { updates.push("body = ?"); values.push(block(body.body, 2000)); }
  if (body.status != null) { updates.push("status = ?"); values.push(text(body.status, 20) === "published" ? "published" : "draft"); }
  if (!updates.length) return fail(res, 400, "Nothing to update.");
  values.push(db.now(), params.id);
  db.db().prepare("UPDATE announcements SET " + updates.join(", ") + ", updated_at = ? WHERE id = ?").run(...values);
  ok(res, { id: params.id });
});

route("DELETE", "/api/admin/announcements/:id", function (req, res, params) {
  db.db().prepare("DELETE FROM announcements WHERE id = ?").run(params.id);
  ok(res, { deleted: params.id });
});

/* ------------------------------------------------------------
   Admin — settings and password
   ------------------------------------------------------------ */

route("GET", "/api/admin/settings", function (req, res) {
  ok(res, { settings: db.getSettings() });
});

route("PATCH", "/api/admin/settings", async function (req, res) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var errors = [];
  if (body.supportEmail != null) {
    var email = text(body.supportEmail, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter a valid support email address or leave it blank.");
    if (!errors.length) db.writeSetting("support_email", email);
  }
  if (body.accessDays != null) {
    var days = int(body.accessDays, 0);
    if (!Number.isFinite(days) || days < 1 || days > 3650) errors.push("Set an access period between 1 and 3650 days.");
    if (!errors.length) db.writeSetting("access_days", days);
  }
  if (body.packages != null && typeof body.packages === "object") {
    var current = db.getSettings().packages;
    LEVELS.forEach(function (level) {
      var incoming = body.packages[level];
      if (!incoming) return;
      var currentLevel = current[level] || {};
      var name = incoming.name != null ? text(incoming.name, 40) : currentLevel.name;
      var price = incoming.price != null ? int(incoming.price, -1) : currentLevel.price;
      var tagline = incoming.tagline != null ? text(incoming.tagline, 160) : currentLevel.tagline;
      var features = Array.isArray(incoming.features)
        ? incoming.features.map(function (item) { return text(item, 120); }).filter(Boolean).slice(0, 8)
        : currentLevel.features;
      if (!name) errors.push("Give the " + level + " package a name.");
      if (!Number.isFinite(price) || price < 0) errors.push("Enter a valid price for the " + level + " package.");
      if (!errors.length) current[level] = { name: name, price: price, tagline: tagline || "", features: features || [] };
    });
    if (!errors.length) db.writeSetting("packages", current);
  }
  if (errors.length) return fail(res, 400, errors[0], { errors: errors });
  ok(res, { settings: db.getSettings() });
});

route("POST", "/api/admin/password", async function (req, res) {
  var body = await readBody(req);
  if (!body) return fail(res, 400, "Could not read the request.");
  var current = String(body.currentPassword || "");
  var next = String(body.newPassword || "");
  if (!db.verifyAdminPassword(current)) return fail(res, 401, "The current password is not correct.");
  if (next.length < 8) return fail(res, 400, "Choose a password with at least 8 characters.");
  if (next === DEFAULT_FIRST_RUN_PASSWORD) return fail(res, 400, "Choose a password other than the shipped default.");
  db.setAdminPassword(next, { mustChange: false });
  db.db().prepare("DELETE FROM sessions").run();
  ok(res, { changed: true });
});

/* ------------------------------------------------------------
   Router
   ------------------------------------------------------------ */

function handle(req, res, pathname, query) {
  return new Promise(function (resolve) {
    /* Everything under /api/admin except sign-in helpers needs a session,
       so student pages can never reach administration endpoints. */
    var openAdminPaths = ["/api/admin/login", "/api/admin/logout", "/api/admin/session"];
    if (pathname.indexOf("/api/admin/") === 0 && openAdminPaths.indexOf(pathname) === -1) {
      if (!adminSession(req)) {
        fail(res, 401, "Administrator sign-in required.");
        return resolve(true);
      }
      /* Until the first-run password is replaced, only the session probe and
         the password change are served — no catalogue management. */
      if (db.adminMustChangePassword() && pathname !== "/api/admin/password") {
        fail(res, 403, "Change the first-run administrator password before managing the catalogue. Open Admin → Settings.");
        return resolve(true);
      }
    }
    for (var index = 0; index < routes.length; index++) {
      var entry = routes[index];
      if (entry.method !== req.method) continue;
      var match = entry.regex.exec(pathname);
      if (!match) continue;
      var params = {};
      entry.keys.forEach(function (key, position) { params[key] = decodeURIComponent(match[position + 1]); });
      if (entry.admin && !adminSession(req)) {
        fail(res, 401, "Administrator sign-in required.");
        return resolve(true);
      }
      try {
        Promise.resolve(entry.handler(req, res, params, { query: query })).then(function () { resolve(true); })
          .catch(function (error) {
            console.error("[api]", req.method, pathname, error);
            fail(res, 500, "The server could not complete that request.");
            resolve(true);
          });
      } catch (error) {
        console.error("[api]", req.method, pathname, error);
        fail(res, 500, "The server could not complete that request.");
        resolve(true);
      }
      return undefined;
    }
    resolve(false);
  });
}

module.exports = {
  handle: handle,
  catalogue: catalogue,
  allVideos: allVideos,
  allCourses: allCourses,
  allUniversities: allUniversities,
  video: videoById,
  course: courseById,
  university: universityById,
  mediaInfo: mediaInfo,
  durationToSeconds: durationToSeconds,
  LEVELS: LEVELS,
  SEMESTERS: SEMESTERS,
  ADMIN_COOKIE: ADMIN_COOKIE,
  publicSettings: publicSettings
};
