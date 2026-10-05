"use strict";
/* ============================================================
   NUCLEAR TUTORIALS — JSON API
   ------------------------------------------------------------
   Public read endpoints expose published content only:
     university → semester → course → video lesson
   Admin endpoints require a valid session cookie and are the only
   way to create, edit, reorder, publish or delete content.
   ============================================================ */

var crypto = require("node:crypto");
var db = require("./db");
var auth = require("./auth");
var util = require("./util");

var LEVELS = ["basic", "standard", "premium"];
var STATUSES = ["published", "draft"];
var SEMESTERS = [1, 2];
var SEARCH_LIMIT = 8;

/* ============================ router ============================ */

var routes = [];

function route(method, pattern, handler, options) {
  routes.push({
    method: method,
    segments: pattern.split("/").filter(Boolean),
    handler: handler,
    protectedRoute: !!(options && options.admin)
  });
}

function matchRoute(method, pathname) {
  var parts = pathname.split("/").filter(Boolean);
  for (var i = 0; i < routes.length; i++) {
    var candidate = routes[i];
    if (candidate.method !== method) continue;
    if (candidate.segments.length !== parts.length) continue;
    var params = {};
    var matched = candidate.segments.every(function (segment, index) {
      if (segment.charAt(0) === ":") {
        params[segment.slice(1)] = decodeURIComponent(parts[index]);
        return true;
      }
      return segment === parts[index];
    });
    if (matched) return { route: candidate, params: params };
  }
  return null;
}

function clientIp(req) {
  var forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "";
}

function isSecure(req) {
  return !!(req.socket && req.socket.encrypted) || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

async function handle(req, res, url) {
  var found = matchRoute(req.method, url.pathname);
  if (!found) {
    util.send(res, req.method === "OPTIONS" ? 204 : 404, { error: "not-found", message: "Unknown API endpoint." });
    return;
  }
  var definition = found.route;
  var token = auth.parseCookies(req)[auth.cookieName()] || "";
  var admin = auth.sessionAdmin(token);

  if (definition.protectedRoute && !admin) {
    util.send(res, 401, {
      error: "auth-required",
      message: "Administrator sign-in required.",
      loginUrl: "/admin/login.html"
    });
    return;
  }

  var ctx = {
    req: req,
    res: res,
    url: url,
    query: url.searchParams,
    params: found.params,
    admin: admin,
    token: token,
    ip: clientIp(req),
    secure: isSecure(req),
    body: {}
  };

  if (req.method !== "GET" && req.method !== "DELETE") {
    try {
      ctx.body = await util.readJson(req);
    } catch (error) {
      util.send(res, error.status || 400, { error: "bad-request", message: error.message });
      return;
    }
  }

  try {
    await definition.handler(ctx);
  } catch (error) {
    var status = error.status || 500;
    if (status >= 500) console.error("[api] " + req.method + " " + url.pathname + " → " + (error && error.stack || error));
    util.send(res, status, {
      error: status === 400 ? "validation" : status === 401 ? "auth-required" : "server-error",
      message: status >= 500 ? "The content service could not complete that request." : error.message,
      fields: error.fields || undefined
    });
  }
}

/* ============================ shared queries ============================ */

var UNIVERSITY_COLUMNS = "u.id, u.name, u.short_name, u.city, u.country, u.description, u.accent, u.logo_url, u.position, u.status, u.created_at, u.updated_at";
var COURSE_COLUMNS = "c.id, c.university_id, c.semester, c.title, c.code, c.subject_id, c.instructor, c.description, c.position, c.status, c.created_at, c.updated_at";
var VIDEO_COLUMNS = "v.id, v.course_id, v.title, v.topic, v.description, v.url, v.provider, v.external_id, v.embed_url, v.thumbnail_url, v.thumbnail_auto, v.duration_seconds, v.level, v.position, v.status, v.created_at, v.updated_at";

function countCourses(whereSql, params) {
  var row = db.get("SELECT COUNT(*) AS count FROM courses c" + (whereSql ? " WHERE " + whereSql : ""), params);
  return row ? Number(row.count) : 0;
}

function universityStats(universityId, publishedOnly) {
  var courseFilter = "c.university_id = ?" + (publishedOnly ? " AND c.status = 'published'" : "");
  var videoFilter = "c.university_id = ?" + (publishedOnly ? " AND c.status = 'published' AND v.status = 'published'" : "");
  var semesters = db.all(
    "SELECT c.semester AS semester, COUNT(DISTINCT c.id) AS courses, COUNT(v.id) AS videos, COALESCE(SUM(v.duration_seconds), 0) AS duration " +
    "FROM courses c LEFT JOIN videos v ON v.course_id = c.id" + (publishedOnly ? " AND v.status = 'published'" : "") + " " +
    "WHERE c.university_id = ?" + (publishedOnly ? " AND c.status = 'published'" : "") + " " +
    "GROUP BY c.semester ORDER BY c.semester",
    [universityId]
  ).map(function (row) {
    return {
      semester: Number(row.semester),
      courses: Number(row.courses),
      videos: Number(row.videos),
      durationSeconds: Number(row.duration)
    };
  });
  var totals = semesters.reduce(function (acc, item) {
    acc.courses += item.courses;
    acc.videos += item.videos;
    acc.durationSeconds += item.duration;
    return acc;
  }, { courses: 0, videos: 0, durationSeconds: 0 });
  return {
    semesters: semesters,
    semesterList: SEMESTERS.filter(function (semester) {
      return semesters.some(function (item) { return item.semester === semester && item.courses > 0; });
    }),
    courseCount: totals.courses,
    videoCount: totals.videos,
    durationSeconds: totals.durationSeconds
  };
}

function serializeUniversity(row, publishedOnly) {
  var stats = universityStats(row.id, publishedOnly);
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name || "",
    city: row.city || "",
    country: row.country || "",
    description: row.description || "",
    accent: row.accent || "",
    logoUrl: row.logo_url || "",
    position: Number(row.position),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    semesters: stats.semesters,
    availableSemesters: stats.semesterList,
    courseCount: stats.courseCount,
    videoCount: stats.videoCount,
    durationSeconds: stats.durationSeconds
  };
}

function serializeCourse(row) {
  var videoCount = Number(row.video_count || 0);
  return {
    id: row.id,
    universityId: row.university_id,
    universityName: row.university_name || "",
    universityShortName: row.university_short_name || "",
    semester: Number(row.semester),
    semesterLabel: "Semester " + Number(row.semester),
    title: row.title,
    code: row.code || "",
    subjectId: row.subject_id || "",
    instructor: row.instructor || "",
    description: row.description || "",
    position: Number(row.position),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    videoCount: videoCount,
    durationSeconds: Number(row.duration_seconds || 0)
  };
}

function serializeVideo(row) {
  var thumbnailCustom = row.thumbnail_url || "";
  var thumbnailAuto = row.thumbnail_auto || "";
  return {
    id: row.id,
    courseId: row.course_id,
    courseTitle: row.course_title || "",
    courseCode: row.course_code || "",
    semester: row.semester == null ? null : Number(row.semester),
    semesterLabel: row.semester == null ? "" : "Semester " + Number(row.semester),
    universityId: row.university_id || "",
    universityName: row.university_name || "",
    title: row.title,
    topic: row.topic || "",
    description: row.description || "",
    url: row.url,
    provider: row.provider || "",
    externalId: row.external_id || "",
    embedUrl: row.embed_url || "",
    thumbnail: thumbnailCustom || thumbnailAuto || "",
    thumbnailUrl: thumbnailCustom,
    thumbnailAuto: thumbnailAuto,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    level: row.level || "basic",
    position: Number(row.position),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function findUniversity(id) {
  return db.get("SELECT " + UNIVERSITY_COLUMNS + " FROM universities u WHERE u.id = ?", [id]);
}

function findCourse(id) {
  return db.get(
    "SELECT " + COURSE_COLUMNS + ", u.name AS university_name, u.short_name AS university_short_name, " +
    "(SELECT COUNT(*) FROM videos v WHERE v.course_id = c.id) AS video_count, " +
    "(SELECT COALESCE(SUM(v.duration_seconds), 0) FROM videos v WHERE v.course_id = c.id) AS duration_seconds " +
    "FROM courses c JOIN universities u ON u.id = c.university_id WHERE c.id = ?",
    [id]
  );
}

function findVideo(id) {
  return db.get(
    "SELECT " + VIDEO_COLUMNS + ", c.title AS course_title, c.code AS course_code, c.semester AS semester, " +
    "c.university_id AS university_id, u.name AS university_name " +
    "FROM videos v JOIN courses c ON c.id = v.course_id JOIN universities u ON u.id = c.university_id WHERE v.id = ?",
    [id]
  );
}

function listCourses(filters) {
  var where = [];
  var params = [];
  if (filters.publishedOnly) {
    where.push("c.status = 'published'", "u.status = 'published'");
  }
  if (filters.universityId) { where.push("c.university_id = ?"); params.push(filters.universityId); }
  if (filters.semester) { where.push("c.semester = ?"); params.push(Number(filters.semester)); }
  if (filters.status) { where.push("c.status = ?"); params.push(filters.status); }
  if (filters.q) {
    where.push("(lower(c.title) LIKE ? OR lower(c.code) LIKE ? OR lower(c.instructor) LIKE ? OR lower(c.description) LIKE ? OR lower(u.name) LIKE ?)");
    var like = "%" + filters.q.toLowerCase() + "%";
    params.push(like, like, like, like, like);
  }
  var sql =
    "SELECT " + COURSE_COLUMNS + ", u.name AS university_name, u.short_name AS university_short_name, " +
    "(SELECT COUNT(*) FROM videos v WHERE v.course_id = c.id" + (filters.publishedOnly ? " AND v.status = 'published'" : "") + ") AS video_count, " +
    "(SELECT COALESCE(SUM(v.duration_seconds), 0) FROM videos v WHERE v.course_id = c.id" + (filters.publishedOnly ? " AND v.status = 'published'" : "") + ") AS duration_seconds " +
    "FROM courses c JOIN universities u ON u.id = c.university_id" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY c.position, c.created_at LIMIT 500";
  return db.all(sql, params).map(serializeCourse);
}

function listVideos(filters) {
  var where = [];
  var params = [];
  if (filters.publishedOnly) {
    where.push("v.status = 'published'", "c.status = 'published'", "u.status = 'published'");
  }
  if (filters.courseId) { where.push("v.course_id = ?"); params.push(filters.courseId); }
  if (filters.universityId) { where.push("c.university_id = ?"); params.push(filters.universityId); }
  if (filters.semester) { where.push("c.semester = ?"); params.push(Number(filters.semester)); }
  if (filters.status) { where.push("v.status = ?"); params.push(filters.status); }
  if (filters.level) { where.push("v.level = ?"); params.push(filters.level); }
  if (filters.q) {
    where.push("(lower(v.title) LIKE ? OR lower(v.topic) LIKE ? OR lower(v.description) LIKE ? OR lower(c.title) LIKE ? OR lower(u.name) LIKE ?)");
    var like = "%" + filters.q.toLowerCase() + "%";
    params.push(like, like, like, like, like);
  }
  var sql =
    "SELECT " + VIDEO_COLUMNS + ", c.title AS course_title, c.code AS course_code, c.semester AS semester, " +
    "c.university_id AS university_id, u.name AS university_name " +
    "FROM videos v JOIN courses c ON c.id = v.course_id JOIN universities u ON u.id = c.university_id" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY c.university_id, c.semester, c.position, v.position, v.created_at LIMIT 1000";
  return db.all(sql, params).map(serializeVideo);
}

/* ============================ validation ============================ */

function validateUniversity(body, existing) {
  var fields = {};
  var name = util.text(body.name, 120);
  if (!name) fields.name = "Enter the university name.";
  var accent = util.text(body.accent, 32);
  if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) fields.accent = "Use a six-digit hex colour, e.g. #0d7ea4.";
  var logoUrl = util.text(body.logoUrl || body.logo_url, 600);
  if (logoUrl && !util.isHttpUrl(logoUrl)) fields.logoUrl = "Use a full https:// image URL, or leave it blank.";
  if (Object.keys(fields).length) throw util.validationError("Check the highlighted fields.", fields);
  return {
    name: name,
    short_name: util.text(body.shortName || body.short_name, 24),
    city: util.text(body.city, 80),
    country: util.text(body.country, 80),
    description: util.text(body.description, 600),
    accent: accent,
    logo_url: logoUrl,
    status: util.oneOf(util.text(body.status, 12), STATUSES, existing ? existing.status : "published")
  };
}

function validateCourse(body, existing) {
  var fields = {};
  var title = util.text(body.title, 140);
  if (!title) fields.title = "Enter the course title.";
  var universityId = util.text(body.universityId || body.university_id, 64) || (existing ? existing.university_id : "");
  if (!findUniversity(universityId)) fields.universityId = "Choose the university this course belongs to.";
  var semester = Number(body.semester != null && body.semester !== "" ? body.semester : (existing ? existing.semester : 0));
  if (SEMESTERS.indexOf(semester) === -1) fields.semester = "Choose Semester 1 or Semester 2.";
  var subjectId = util.text(body.subjectId || body.subject_id, 32);
  if (Object.keys(fields).length) throw util.validationError("Check the highlighted fields.", fields);
  return {
    university_id: universityId,
    semester: semester,
    title: title,
    code: util.text(body.code, 24),
    subject_id: subjectId,
    instructor: util.text(body.instructor, 120),
    description: util.text(body.description, 600),
    status: util.oneOf(util.text(body.status, 12), STATUSES, existing ? existing.status : "published")
  };
}

function validateVideo(body, existing) {
  var fields = {};
  var title = util.text(body.title, 160);
  if (!title) fields.title = "Enter the video lesson title.";
  var courseId = util.text(body.courseId || body.course_id, 64) || (existing ? existing.course_id : "");
  var course = findCourse(courseId);
  if (!course) fields.courseId = "Choose the university, semester and course this video belongs to.";
  var url = util.text(body.url, 2000);
  var analysis = util.analyzeVideoUrl(url);
  if (!analysis.ok) fields.url = analysis.reason || "Enter a valid video URL.";
  var level = util.oneOf(util.text(body.level, 12), LEVELS, existing ? existing.level : "basic");
  if (Object.keys(fields).length) throw util.validationError("Check the highlighted fields.", fields);
  return {
    course_id: courseId,
    title: title,
    topic: util.text(body.topic, 120),
    description: util.text(body.description, 2000),
    url: analysis.provider === "youtube" || analysis.provider === "vimeo" ? url : analysis.embedUrl || url,
    provider: analysis.provider,
    external_id: analysis.externalId,
    embed_url: analysis.embedUrl,
    thumbnail_url: util.text(body.thumbnailUrl || body.thumbnail_url, 600),
    thumbnail_auto: analysis.autoThumbnail,
    duration_seconds: util.duration(body.durationSeconds != null ? body.durationSeconds : body.duration_seconds),
    level: level,
    status: util.oneOf(util.text(body.status, 12), STATUSES, existing ? existing.status : "published")
  };
}

/* ============================ reordering ============================ */

function scopeOf(entity, row) {
  if (entity === "universities") return { table: "universities", where: "", params: [] };
  if (entity === "courses") return { table: "courses", where: "WHERE university_id = ? AND semester = ?", params: [row.university_id, row.semester] };
  return { table: "videos", where: "WHERE course_id = ?", params: [row.course_id] };
}

function move(entity, id, direction) {
  var table = entity;
  var row = db.get("SELECT * FROM " + table + " WHERE id = ?", [id]);
  if (!row) return null;
  var scope = scopeOf(entity, row);
  var sql = "SELECT id, position FROM " + scope.table + " " + scope.where + (scope.where ? " AND " : "WHERE ") + "1=1 ORDER BY position, created_at";
  var ordered = db.all(sql, scope.params);
  var index = ordered.findIndex(function (item) { return item.id === id; });
  var target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ordered.length) return ordered.map(function (item) { return item.id; });
  /* Re-index the whole scope, then swap the two neighbours. Keeps positions
     gap-free even after deletions. */
  var ids = ordered.map(function (item) { return item.id; });
  var tmp = ids[index];
  ids[index] = ids[target];
  ids[target] = tmp;
  ids.forEach(function (itemId, position) {
    db.run("UPDATE " + scope.table + " SET position = ?, updated_at = ? WHERE id = ?", [position, db.nowIso(), itemId]);
  });
  return ids;
}

/* ============================ public endpoints ============================ */

route("GET", "/api/health", function (ctx) {
  util.send(ctx.res, 200, {
    ok: true,
    service: "nuclear-tutorials-content",
    schemaVersion: db.SCHEMA_VERSION,
    time: db.nowIso()
  });
});

route("GET", "/api/stats", function (ctx) {
  var universities = db.get("SELECT COUNT(*) AS count FROM universities WHERE status = 'published'");
  var courses = db.get("SELECT COUNT(*) AS count FROM courses c JOIN universities u ON u.id = c.university_id WHERE c.status = 'published' AND u.status = 'published'");
  var videos = db.get(
    "SELECT COUNT(*) AS count, COALESCE(SUM(v.duration_seconds), 0) AS duration FROM videos v " +
    "JOIN courses c ON c.id = v.course_id JOIN universities u ON u.id = c.university_id " +
    "WHERE v.status = 'published' AND c.status = 'published' AND u.status = 'published'"
  );
  util.send(ctx.res, 200, {
    universities: Number(universities.count),
    courses: Number(courses.count),
    videos: Number(videos.count),
    durationSeconds: Number(videos.duration)
  });
});

route("GET", "/api/universities", function (ctx) {
  var q = util.text(ctx.query.get("q"), 80).toLowerCase();
  var where = ["u.status = 'published'"];
  var params = [];
  if (q) {
    where.push("(lower(u.name) LIKE ? OR lower(u.short_name) LIKE ? OR lower(u.city) LIKE ? OR lower(u.description) LIKE ?)");
    var like = "%" + q + "%";
    params.push(like, like, like, like);
  }
  var rows = db.all(
    "SELECT " + UNIVERSITY_COLUMNS + " FROM universities u WHERE " + where.join(" AND ") + " ORDER BY u.position, u.name LIMIT 200",
    params
  );
  util.send(ctx.res, 200, {
    universities: rows.map(function (row) { return serializeUniversity(row, true); }),
    query: q
  });
});

route("GET", "/api/universities/:id", function (ctx) {
  var row = findUniversity(ctx.params.id);
  if (!row || row.status !== "published") {
    util.send(ctx.res, 404, { error: "not-found", message: "That university is not available." });
    return;
  }
  var stats = universityStats(row.id, true);
  util.send(ctx.res, 200, {
    university: serializeUniversity(row, true),
    semesters: SEMESTERS.map(function (semester) {
      var found = stats.semesters.filter(function (item) { return item.semester === semester; })[0];
      return {
        semester: semester,
        label: "Semester " + semester,
        courses: found ? found.courses : 0,
        videos: found ? found.videos : 0,
        durationSeconds: found ? found.durationSeconds : 0
      };
    }),
    courses: listCourses({ publishedOnly: true, universityId: row.id })
  });
});

route("GET", "/api/courses", function (ctx) {
  var universityId = util.text(ctx.query.get("university"), 64);
  var semester = Number(ctx.query.get("semester") || 0);
  util.send(ctx.res, 200, {
    courses: listCourses({
      publishedOnly: true,
      universityId: universityId || "",
      semester: SEMESTERS.indexOf(semester) !== -1 ? semester : 0,
      q: util.text(ctx.query.get("q"), 80)
    })
  });
});

route("GET", "/api/courses/:id", function (ctx) {
  var row = findCourse(ctx.params.id);
  if (!row || row.status !== "published") {
    util.send(ctx.res, 404, { error: "not-found", message: "That course is not available." });
    return;
  }
  var university = findUniversity(row.university_id);
  if (!university || university.status !== "published") {
    util.send(ctx.res, 404, { error: "not-found", message: "That course is not available." });
    return;
  }
  util.send(ctx.res, 200, {
    course: serializeCourse(row),
    university: serializeUniversity(university, true),
    videos: listVideos({ publishedOnly: true, courseId: row.id })
  });
});

route("GET", "/api/videos/:id", function (ctx) {
  var row = findVideo(ctx.params.id);
  if (!row || row.status !== "published") {
    util.send(ctx.res, 404, { error: "not-found", message: "That video lesson is not available." });
    return;
  }
  var course = findCourse(row.course_id);
  var university = findUniversity(course.university_id);
  if (course.status !== "published" || university.status !== "published") {
    util.send(ctx.res, 404, { error: "not-found", message: "That video lesson is not available." });
    return;
  }
  var siblings = listVideos({ publishedOnly: true, courseId: course.id });
  var index = siblings.findIndex(function (item) { return item.id === row.id; });
  util.send(ctx.res, 200, {
    video: serializeVideo(row),
    course: serializeCourse(course),
    university: serializeUniversity(university, true),
    previous: index > 0 ? siblings[index - 1] : null,
    next: index !== -1 && index < siblings.length - 1 ? siblings[index + 1] : null,
    playlist: siblings,
    position: index + 1,
    total: siblings.length
  });
});

/* Full published catalogue in one request: used by the video library and the
   student dashboard, which filter it locally for instant semester switches. */
route("GET", "/api/library", function (ctx) {
  var universityId = util.text(ctx.query.get("university"), 64);
  var semester = Number(ctx.query.get("semester") || 0);
  var rows = db.all("SELECT " + UNIVERSITY_COLUMNS + " FROM universities u WHERE u.status = 'published' ORDER BY u.position, u.name LIMIT 200");
  util.send(ctx.res, 200, {
    universities: rows.map(function (row) { return serializeUniversity(row, true); }),
    courses: listCourses({
      publishedOnly: true,
      universityId: universityId,
      semester: SEMESTERS.indexOf(semester) !== -1 ? semester : 0
    }),
    videos: listVideos({
      publishedOnly: true,
      universityId: universityId,
      semester: SEMESTERS.indexOf(semester) !== -1 ? semester : 0
    })
  });
});

/* Published video lessons across the whole catalogue, filterable. */
route("GET", "/api/videos", function (ctx) {
  util.send(ctx.res, 200, {
    videos: listVideos({
      publishedOnly: true,
      universityId: util.text(ctx.query.get("university"), 64),
      semester: Number(ctx.query.get("semester") || 0),
      courseId: util.text(ctx.query.get("course"), 64),
      level: util.oneOf(util.text(ctx.query.get("level"), 12), LEVELS, ""),
      q: util.text(ctx.query.get("q"), 80)
    })
  });
});

route("GET", "/api/search", function (ctx) {
  var q = util.text(ctx.query.get("q"), 80);
  if (!q) {
    util.send(ctx.res, 200, { query: "", universities: [], courses: [], videos: [] });
    return;
  }
  var like = "%" + q.toLowerCase() + "%";
  var universities = db.all(
    "SELECT " + UNIVERSITY_COLUMNS + " FROM universities u WHERE u.status = 'published' AND " +
    "(lower(u.name) LIKE ? OR lower(u.short_name) LIKE ? OR lower(u.city) LIKE ? OR lower(u.description) LIKE ?) ORDER BY u.position, u.name LIMIT ?",
    [like, like, like, like, SEARCH_LIMIT]
  ).map(function (row) { return serializeUniversity(row, true); });
  var courses = listCourses({ publishedOnly: true, q: q }).slice(0, SEARCH_LIMIT);
  var videos = listVideos({ publishedOnly: true, q: q }).slice(0, SEARCH_LIMIT);
  util.send(ctx.res, 200, { query: q, universities: universities, courses: courses, videos: videos });
});

/* ============================ admin endpoints ============================ */

route("POST", "/api/admin/login", async function (ctx) {
  var email = util.text(ctx.body.email, 200);
  var password = String(ctx.body.password || "");
  if (!email || !password) {
    util.send(ctx.res, 400, { error: "validation", message: "Enter your admin email and password.", fields: { email: "Required." } });
    return;
  }
  var result = auth.login(email, password, { ip: ctx.ip, userAgent: ctx.req.headers["user-agent"] });
  if (result.error === "too-many-attempts") {
    util.send(ctx.res, 429, { error: "too-many-attempts", message: "Too many failed attempts. Try again in a few minutes.", retryAfter: result.retryAfter });
    return;
  }
  if (result.error) {
    util.send(ctx.res, 401, { error: "invalid-credentials", message: "That email and password combination is not recognised." });
    return;
  }
  util.send(ctx.res, 200, { admin: result.admin, expiresAt: result.expiresAt }, {
    "Set-Cookie": auth.cookieHeader(result.token, { secure: ctx.secure })
  });
});

route("POST", "/api/admin/logout", function (ctx) {
  auth.logout(ctx.token);
  util.send(ctx.res, 200, { ok: true }, { "Set-Cookie": auth.cookieHeader("", { clear: true, secure: ctx.secure }) });
});

route("GET", "/api/admin/session", function (ctx) {
  util.send(ctx.res, 200, {
    admin: ctx.admin,
    sessionDays: auth.SESSION_DAYS,
    activeSessions: auth.sessionCount(),
    time: db.nowIso()
  });
}, { admin: true });

route("GET", "/api/admin/overview", function (ctx) {
  var counts = {
    universities: countAll("universities"),
    publishedUniversities: countWhere("universities", "status = 'published'"),
    courses: countAll("courses"),
    publishedCourses: countWhere("courses", "status = 'published'"),
    semester1Courses: countWhere("courses", "semester = 1"),
    semester2Courses: countWhere("courses", "semester = 2"),
    videos: countAll("videos"),
    publishedVideos: countWhere("videos", "status = 'published'"),
    draftVideos: countWhere("videos", "status = 'draft'"),
    durationSeconds: Number((db.get("SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM videos WHERE status = 'published'") || {}).total || 0),
    admins: auth.adminCount(),
    activeSessions: auth.sessionCount()
  };
  counts.byLevel = LEVELS.map(function (level) {
    return { level: level, count: countWhere("videos", "status = 'published' AND level = '" + level + "'") };
  });
  counts.byUniversity = db.all(
    "SELECT u.id, u.name, u.status, COUNT(DISTINCT c.id) AS courses, COUNT(v.id) AS videos " +
    "FROM universities u LEFT JOIN courses c ON c.university_id = u.id LEFT JOIN videos v ON v.course_id = c.id " +
    "GROUP BY u.id ORDER BY u.position, u.name LIMIT 50"
  ).map(function (row) {
    return { id: row.id, name: row.name, status: row.status, courses: Number(row.courses), videos: Number(row.videos) };
  });
  counts.recentVideos = db.all(
    "SELECT " + VIDEO_COLUMNS + ", c.title AS course_title, c.code AS course_code, c.semester AS semester, " +
    "c.university_id AS university_id, u.name AS university_name FROM videos v " +
    "JOIN courses c ON c.id = v.course_id JOIN universities u ON u.id = c.university_id " +
    "ORDER BY v.updated_at DESC LIMIT 6"
  ).map(serializeVideo);
  counts.checklist = [
    { id: "university", label: "Add a university", done: counts.universities > 0, href: "/admin/universities.html" },
    { id: "course", label: "Create a Semester 1 or Semester 2 course", done: counts.courses > 0, href: "/admin/courses.html" },
    { id: "video", label: "Add and publish a video lesson", done: counts.publishedVideos > 0, href: "/admin/videos.html" }
  ];
  util.send(ctx.res, 200, counts);
}, { admin: true });

function countAll(table) {
  return Number((db.get("SELECT COUNT(*) AS count FROM " + table) || {}).count || 0);
}

function countWhere(table, whereSql, params) {
  return Number((db.get("SELECT COUNT(*) AS count FROM " + table + " WHERE " + whereSql, params || []) || {}).count || 0);
}

/* ---------- universities ---------- */

route("GET", "/api/admin/universities", function (ctx) {
  var rows = db.all("SELECT " + UNIVERSITY_COLUMNS + " FROM universities u ORDER BY u.position, u.name LIMIT 200");
  util.send(ctx.res, 200, { universities: rows.map(function (row) { return serializeUniversity(row, false); }) });
}, { admin: true });

route("POST", "/api/admin/universities", function (ctx) {
  var values = validateUniversity(ctx.body, null);
  var id = db.newId("uni");
  var position = db.nextPosition("universities", "", []);
  var now = db.nowIso();
  db.run(
    "INSERT INTO universities (id, name, short_name, city, country, description, accent, logo_url, position, status, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, values.name, values.short_name, values.city, values.country, values.description, values.accent, values.logo_url, position, values.status, now, now]
  );
  var row = findUniversity(id);
  util.send(ctx.res, 201, { university: serializeUniversity(row, false) });
}, { admin: true });

route("PATCH", "/api/admin/universities/:id", function (ctx) {
  var existing = findUniversity(ctx.params.id);
  if (!existing) { util.send(ctx.res, 404, { error: "not-found", message: "University not found." }); return; }
  var values = validateUniversity(Object.assign({
    name: existing.name,
    shortName: existing.short_name,
    city: existing.city,
    country: existing.country,
    description: existing.description,
    accent: existing.accent,
    logoUrl: existing.logo_url,
    status: existing.status
  }, ctx.body), existing);
  db.run(
    "UPDATE universities SET name = ?, short_name = ?, city = ?, country = ?, description = ?, accent = ?, logo_url = ?, status = ?, updated_at = ? WHERE id = ?",
    [values.name, values.short_name, values.city, values.country, values.description, values.accent, values.logo_url, values.status, db.nowIso(), existing.id]
  );
  util.send(ctx.res, 200, { university: serializeUniversity(findUniversity(existing.id), false) });
}, { admin: true });

route("DELETE", "/api/admin/universities/:id", function (ctx) {
  var existing = findUniversity(ctx.params.id);
  if (!existing) { util.send(ctx.res, 404, { error: "not-found", message: "University not found." }); return; }
  var affected = {
    courses: countWhere("courses", "university_id = ?", [existing.id]),
    videos: Number((db.get("SELECT COUNT(*) AS count FROM videos v JOIN courses c ON c.id = v.course_id WHERE c.university_id = ?", [existing.id]) || {}).count || 0)
  };
  db.run("DELETE FROM universities WHERE id = ?", [existing.id]);
  util.send(ctx.res, 200, { ok: true, removed: { university: existing.name, courses: affected.courses, videos: affected.videos } });
}, { admin: true });

route("POST", "/api/admin/universities/:id/move", function (ctx) {
  var order = move("universities", ctx.params.id, util.text(ctx.body.direction, 8) === "up" ? "up" : "down");
  if (!order) { util.send(ctx.res, 404, { error: "not-found", message: "University not found." }); return; }
  util.send(ctx.res, 200, { ok: true, order: order });
}, { admin: true });

/* ---------- courses ---------- */

route("GET", "/api/admin/courses", function (ctx) {
  util.send(ctx.res, 200, {
    courses: listCourses({
      universityId: util.text(ctx.query.get("university"), 64),
      semester: Number(ctx.query.get("semester") || 0),
      status: util.oneOf(util.text(ctx.query.get("status"), 12), STATUSES, ""),
      q: util.text(ctx.query.get("q"), 80)
    })
  });
}, { admin: true });

route("POST", "/api/admin/courses", function (ctx) {
  var values = validateCourse(ctx.body, null);
  var id = db.newId("crs");
  var position = db.nextPosition("courses", "university_id = ? AND semester = ?", [values.university_id, values.semester]);
  var now = db.nowIso();
  db.run(
    "INSERT INTO courses (id, university_id, semester, title, code, subject_id, instructor, description, position, status, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, values.university_id, values.semester, values.title, values.code, values.subject_id, values.instructor, values.description, position, values.status, now, now]
  );
  util.send(ctx.res, 201, { course: serializeCourse(findCourse(id)) });
}, { admin: true });

route("PATCH", "/api/admin/courses/:id", function (ctx) {
  var existing = db.get("SELECT * FROM courses WHERE id = ?", [ctx.params.id]);
  if (!existing) { util.send(ctx.res, 404, { error: "not-found", message: "Course not found." }); return; }
  var values = validateCourse(Object.assign({
    universityId: existing.university_id,
    semester: existing.semester,
    title: existing.title,
    code: existing.code,
    subjectId: existing.subject_id,
    instructor: existing.instructor,
    description: existing.description,
    status: existing.status
  }, ctx.body), existing);
  var movedScope = values.university_id !== existing.university_id || Number(values.semester) !== Number(existing.semester);
  var position = movedScope
    ? db.nextPosition("courses", "university_id = ? AND semester = ?", [values.university_id, values.semester])
    : Number(existing.position);
  db.run(
    "UPDATE courses SET university_id = ?, semester = ?, title = ?, code = ?, subject_id = ?, instructor = ?, description = ?, status = ?, position = ?, updated_at = ? WHERE id = ?",
    [values.university_id, values.semester, values.title, values.code, values.subject_id, values.instructor, values.description, values.status, position, db.nowIso(), existing.id]
  );
  util.send(ctx.res, 200, { course: serializeCourse(findCourse(existing.id)) });
}, { admin: true });

route("DELETE", "/api/admin/courses/:id", function (ctx) {
  var existing = db.get("SELECT * FROM courses WHERE id = ?", [ctx.params.id]);
  if (!existing) { util.send(ctx.res, 404, { error: "not-found", message: "Course not found." }); return; }
  var videos = countWhere("videos", "course_id = ?", [existing.id]);
  db.run("DELETE FROM courses WHERE id = ?", [existing.id]);
  util.send(ctx.res, 200, { ok: true, removed: { course: existing.title, videos: videos } });
}, { admin: true });

route("POST", "/api/admin/courses/:id/move", function (ctx) {
  var order = move("courses", ctx.params.id, util.text(ctx.body.direction, 8) === "up" ? "up" : "down");
  if (!order) { util.send(ctx.res, 404, { error: "not-found", message: "Course not found." }); return; }
  util.send(ctx.res, 200, { ok: true, order: order });
}, { admin: true });

/* ---------- videos ---------- */

route("GET", "/api/admin/videos", function (ctx) {
  util.send(ctx.res, 200, {
    videos: listVideos({
      courseId: util.text(ctx.query.get("course"), 64),
      universityId: util.text(ctx.query.get("university"), 64),
      semester: Number(ctx.query.get("semester") || 0),
      status: util.oneOf(util.text(ctx.query.get("status"), 12), STATUSES, ""),
      level: util.oneOf(util.text(ctx.query.get("level"), 12), LEVELS, ""),
      q: util.text(ctx.query.get("q"), 80)
    })
  });
}, { admin: true });

route("POST", "/api/admin/videos", function (ctx) {
  var values = validateVideo(ctx.body, null);
  var id = db.newId("vid");
  var position = db.nextPosition("videos", "course_id = ?", [values.course_id]);
  var now = db.nowIso();
  db.run(
    "INSERT INTO videos (id, course_id, title, topic, description, url, provider, external_id, embed_url, thumbnail_url, thumbnail_auto, duration_seconds, level, position, status, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, values.course_id, values.title, values.topic, values.description, values.url, values.provider, values.external_id, values.embed_url,
      values.thumbnail_url, values.thumbnail_auto, values.duration_seconds, values.level, position, values.status, now, now]
  );
  util.send(ctx.res, 201, { video: serializeVideo(findVideo(id)) });
}, { admin: true });

route("PATCH", "/api/admin/videos/:id", function (ctx) {
  var existing = db.get("SELECT * FROM videos WHERE id = ?", [ctx.params.id]);
  if (!existing) { util.send(ctx.res, 404, { error: "not-found", message: "Video lesson not found." }); return; }
  var values = validateVideo(Object.assign({
    courseId: existing.course_id,
    title: existing.title,
    topic: existing.topic,
    description: existing.description,
    url: existing.url,
    thumbnailUrl: existing.thumbnail_url,
    durationSeconds: existing.duration_seconds,
    level: existing.level,
    status: existing.status
  }, ctx.body), existing);
  var movedCourse = values.course_id !== existing.course_id;
  var position = movedCourse ? db.nextPosition("videos", "course_id = ?", [values.course_id]) : Number(existing.position);
  db.run(
    "UPDATE videos SET course_id = ?, title = ?, topic = ?, description = ?, url = ?, provider = ?, external_id = ?, embed_url = ?, " +
    "thumbnail_url = ?, thumbnail_auto = ?, duration_seconds = ?, level = ?, status = ?, position = ?, updated_at = ? WHERE id = ?",
    [values.course_id, values.title, values.topic, values.description, values.url, values.provider, values.external_id, values.embed_url,
      values.thumbnail_url, values.thumbnail_auto, values.duration_seconds, values.level, values.status, position, db.nowIso(), existing.id]
  );
  util.send(ctx.res, 200, { video: serializeVideo(findVideo(existing.id)) });
}, { admin: true });

route("DELETE", "/api/admin/videos/:id", function (ctx) {
  var existing = db.get("SELECT * FROM videos WHERE id = ?", [ctx.params.id]);
  if (!existing) { util.send(ctx.res, 404, { error: "not-found", message: "Video lesson not found." }); return; }
  db.run("DELETE FROM videos WHERE id = ?", [existing.id]);
  util.send(ctx.res, 200, { ok: true, removed: { video: existing.title } });
}, { admin: true });

route("POST", "/api/admin/videos/:id/move", function (ctx) {
  var order = move("videos", ctx.params.id, util.text(ctx.body.direction, 8) === "up" ? "up" : "down");
  if (!order) { util.send(ctx.res, 404, { error: "not-found", message: "Video lesson not found." }); return; }
  util.send(ctx.res, 200, { ok: true, order: order });
}, { admin: true });

route("POST", "/api/admin/analyze-url", function (ctx) {
  var analysis = util.analyzeVideoUrl(util.text(ctx.body.url, 2000));
  util.send(ctx.res, 200, {
    ok: analysis.ok,
    provider: analysis.provider,
    externalId: analysis.externalId,
    embedUrl: analysis.embedUrl,
    autoThumbnail: analysis.autoThumbnail,
    reason: analysis.reason
  });
}, { admin: true });

route("PUT", "/api/admin/password", function (ctx) {
  var current = String(ctx.body.currentPassword || "");
  var next = String(ctx.body.newPassword || "");
  if (!current || !next) {
    util.send(ctx.res, 400, { error: "validation", message: "Enter your current password and a new one.", fields: { currentPassword: "Required." } });
    return;
  }
  if (next.length < 10) {
    util.send(ctx.res, 400, { error: "validation", message: "Use at least 10 characters for the new password.", fields: { newPassword: "At least 10 characters." } });
    return;
  }
  if (current === next) {
    util.send(ctx.res, 400, { error: "validation", message: "Choose a password you have not used here before.", fields: { newPassword: "Must differ from the current password." } });
    return;
  }
  var result = auth.changePassword(ctx.admin.id, current, next);
  if (result.error === "invalid-current") {
    util.send(ctx.res, 401, { error: "invalid-credentials", message: "Your current password is not correct.", fields: { currentPassword: "Incorrect." } });
    return;
  }
  if (result.error) {
    util.send(ctx.res, 400, { error: "validation", message: "That password change could not be completed." });
    return;
  }
  /* changePassword clears sessions, so issue a fresh one for this device. */
  auth.logout(ctx.token);
  var fresh = crypto.randomBytes(32).toString("hex");
  db.run(
    "INSERT INTO sessions (token_hash, admin_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)",
    [crypto.createHash("sha256").update(fresh).digest("hex"), ctx.admin.id, db.nowIso(),
      new Date(Date.now() + auth.SESSION_DAYS * 86400000).toISOString(), String(ctx.req.headers["user-agent"] || "").slice(0, 200)]
  );
  util.send(ctx.res, 200, { ok: true, admin: ctx.admin }, { "Set-Cookie": auth.cookieHeader(fresh, { secure: ctx.secure }) });
}, { admin: true });

module.exports = {
  handle: handle,
  routes: routes,
  LEVELS: LEVELS,
  STATUSES: STATUSES,
  SEMESTERS: SEMESTERS,
  /* exported for the flow tests */
  _internal: {
    serializeUniversity: serializeUniversity,
    serializeCourse: serializeCourse,
    serializeVideo: serializeVideo,
    listCourses: listCourses,
    listVideos: listVideos
  }
};
