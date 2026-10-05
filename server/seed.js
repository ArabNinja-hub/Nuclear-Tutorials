/* ============================================================
   NUCLEAR TUTORIALS — Demo content helper

   The MIT OpenCourseWare / Crash Course catalogue in
   server/seed/content.json is SAMPLE DATA. It is used only for
   local development and automated checks — the production database
   starts empty and is filled by administrators through the admin
   area.

   Commands:

     node server/seed.js --demo     load the sample catalogue into the
                                    database used by NT_DATA_DIR.
                                    Refused in production and on any
                                    deployed host — there is no override.

     node server/seed.js --clear    empty the catalogue (universities,
                                    courses and video lessons). Access
                                    codes, student progress, announcements
                                    and settings are kept.

   Nothing here runs automatically: the server never seeds on start.
   ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");
var db = require("./db");
var api = require("./api");

var CONTENT_FILE = path.join(__dirname, "seed", "content.json");

function readContent() {
  if (!fs.existsSync(CONTENT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));
  } catch (error) {
    console.error("[seed] content.json could not be parsed: " + error.message);
    return null;
  }
}

function insertUniversity(record, stamp, position) {
  var id = record.id || db.slugify(record.name);
  db.db().prepare(`
    INSERT INTO universities (id, slug, name, short_name, city, level, summary, accent, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, short_name = excluded.short_name, city = excluded.city, level = excluded.level,
      summary = excluded.summary, accent = excluded.accent, position = excluded.position, updated_at = excluded.updated_at`)
    .run(
      id, id, record.name, record.shortName || record.name, record.city || "",
      record.level === "high-school" ? "high-school" : "university",
      record.summary || "", record.accent || "", position, stamp, stamp
    );
  return id;
}

function insertCourse(record, universityId, stamp, position) {
  var id = record.id || db.slugify((record.code ? record.code + " " : "") + record.title);
  db.db().prepare(`
    INSERT INTO courses (id, university_id, semester, code, title, description, icon, tint, tint_fg, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      university_id = excluded.university_id, semester = excluded.semester, code = excluded.code,
      title = excluded.title, description = excluded.description, icon = excluded.icon,
      tint = excluded.tint, tint_fg = excluded.tint_fg, position = excluded.position, updated_at = excluded.updated_at`)
    .run(
      id, universityId, record.semester === 2 ? 2 : 1, record.code || "", record.title, record.description || "",
      record.icon || "book-open", record.tint || "", record.tintFg || "", position, stamp, stamp
    );
  return id;
}

function insertVideo(record, courseId, stamp, position) {
  var media = api.mediaInfo(record.sourceUrl || record.url);
  /* Lesson IDs are stable per course position so links keep working
     when an administrator edits or reorders later. */
  var id = record.id || courseId + "-v" + Math.round(position / 10);
  db.db().prepare(`
    INSERT INTO videos (id, course_id, title, topic, description, source_url, provider, thumbnail_url,
                        duration_seconds, level, position, published, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      course_id = excluded.course_id, title = excluded.title, topic = excluded.topic,
      description = excluded.description, source_url = excluded.source_url, provider = excluded.provider,
      thumbnail_url = excluded.thumbnail_url, duration_seconds = excluded.duration_seconds,
      level = excluded.level, position = excluded.position, published = excluded.published,
      updated_at = excluded.updated_at`)
    .run(
      id, courseId, record.title, record.topic || "", record.description || "", record.sourceUrl || record.url,
      media.provider, record.thumbnailUrl || media.thumbnail,
      record.durationSeconds || api.durationToSeconds(record.duration) || null,
      api.LEVELS.indexOf(record.level) !== -1 ? record.level : "standard",
      position, record.published === false ? 0 : 1, stamp, stamp
    );
  return id;
}

function isEmpty() {
  db.connect();
  return Number(db.db().prepare("SELECT COUNT(*) AS count FROM universities").get().count) === 0;
}

function clearCatalogue() {
  db.connect();
  var before = {
    universities: Number(db.db().prepare("SELECT COUNT(*) AS count FROM universities").get().count),
    courses: Number(db.db().prepare("SELECT COUNT(*) AS count FROM courses").get().count),
    videos: Number(db.db().prepare("SELECT COUNT(*) AS count FROM videos").get().count)
  };
  db.db().exec("DELETE FROM videos; DELETE FROM courses; DELETE FROM universities;");
  db.writeSetting("catalogue_source", "empty");
  db.db().prepare("DELETE FROM progress").run();
  return Object.assign({ cleared: true }, before);
}

/* Hosts set one of these when the process runs on a deployed platform. */
function deployedHost() {
  return !!(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL ||
    process.env.DYNO || process.env.FLY_APP_NAME || process.env.K_SERVICE ||
    process.env.WEBSITE_SITE_NAME || process.env.VERCEL || process.env.NETLIFY);
}

/* Sample content is a development tool. Production can never load it, and
   neither can a deployed host that forgot to set NODE_ENV. There is
   deliberately no environment flag that re-enables it. */
function demoAllowed() {
  if (String(process.env.NODE_ENV || "").toLowerCase() === "production") return false;
  if (deployedHost()) return false;
  return true;
}

function loadDemo(options) {
  var opts = options || {};
  var content = readContent();
  if (!content) return { seeded: false, reason: "no content file", universities: 0, courses: 0, videos: 0 };
  if (!opts.force && !isEmpty()) {
    return { seeded: false, reason: "the database already has a catalogue", universities: 0, courses: 0, videos: 0 };
  }
  if (!demoAllowed()) {
    return {
      seeded: false,
      reason: "sample content can only be loaded on a development machine: NODE_ENV=production and deployed hosts are refused with no override",
      universities: 0, courses: 0, videos: 0
    };
  }
  var stamp = db.now();
  if (opts.force) db.db().exec("DELETE FROM videos; DELETE FROM courses; DELETE FROM universities;");
  var counts = { universities: 0, courses: 0, videos: 0 };
  (content.institutions || []).forEach(function (institution, institutionIndex) {
    var universityId = insertUniversity(institution, stamp, (institutionIndex + 1) * 10);
    counts.universities += 1;
    (institution.courses || []).forEach(function (course, courseIndex) {
      var courseId = insertCourse(course, universityId, stamp, (courseIndex + 1) * 10);
      counts.courses += 1;
      (course.videos || []).forEach(function (video, videoIndex) {
        insertVideo(video, courseId, stamp, (videoIndex + 1) * 10);
        counts.videos += 1;
      });
    });
  });
  db.writeSetting("catalogue_source", "sample");
  return Object.assign({ seeded: true }, counts);
}

function summary() {
  db.connect();
  var source = db.readSetting("catalogue_source", null);
  return {
    database: db.DB_FILE,
    universities: Number(db.db().prepare("SELECT COUNT(*) AS count FROM universities").get().count),
    courses: Number(db.db().prepare("SELECT COUNT(*) AS count FROM courses").get().count),
    videos: Number(db.db().prepare("SELECT COUNT(*) AS count FROM videos").get().count),
    catalogueSource: source || (isEmpty() ? "empty" : "manual"),
    codes: Number(db.db().prepare("SELECT COUNT(*) AS count FROM codes").get().count)
  };
}

if (require.main === module) {
  var args = process.argv.slice(2);
  if (args.indexOf("--clear") !== -1) {
    console.log(JSON.stringify(clearCatalogue(), null, 2));
    console.log("The catalogue is empty. Add universities, courses and video lessons in the admin area.");
  } else if (args.indexOf("--demo") !== -1) {
    var loaded = loadDemo({ force: args.indexOf("--force") !== -1 });
    console.log(JSON.stringify(loaded, null, 2));
    if (loaded.seeded) console.log("Sample catalogue loaded for development. Do not ship this in production.");
    else console.log("Sample catalogue not loaded: " + loaded.reason);
  } else {
    console.log(JSON.stringify(summary(), null, 2));
    console.log("\nUsage: node server/seed.js --demo [--force] | --clear");
  }
}

module.exports = {
  loadDemo: loadDemo,
  clearCatalogue: clearCatalogue,
  summary: summary,
  isEmpty: isEmpty,
  demoAllowed: demoAllowed,
  CONTENT_FILE: CONTENT_FILE
};
