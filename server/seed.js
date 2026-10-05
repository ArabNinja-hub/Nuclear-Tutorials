/* ============================================================
   NUCLEAR TUTORIALS — Content seeding

   Reads server/seed/content.json and writes the catalogue into the
   database:

     universities (and schools) → courses (semester 1 | 2) → videos

   Seeding runs only when the database has no universities yet, unless
   it is called with { force: true }, which replaces the catalogue
   (administrator edits to the catalogue are overwritten, access codes
   and student progress are kept).

     node server/seed.js           seed if empty
     node server/seed.js --force   replace the catalogue
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

function seed(options) {
  var options = options || {};
  var content = readContent();
  if (!content) {
    return { seeded: false, reason: "no content file", universities: 0, courses: 0, videos: 0 };
  }
  db.connect();
  var existing = db.db().prepare("SELECT COUNT(*) AS count FROM universities").get();
  if (Number(existing.count) > 0 && !options.force) {
    return { seeded: false, reason: "database already has content", universities: 0, courses: 0, videos: 0 };
  }
  var stamp = db.now();
  if (options.force) {
    db.db().exec("DELETE FROM videos; DELETE FROM courses; DELETE FROM universities;");
  }
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
  return Object.assign({ seeded: true }, counts);
}

if (require.main === module) {
  var result = seed({ force: process.argv.indexOf("--force") !== -1 });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { seed: seed, CONTENT_FILE: CONTENT_FILE };
