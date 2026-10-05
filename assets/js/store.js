/* ============================================================
   NUCLEAR TUTORIALS — Local preview state
   ------------------------------------------------------------
   This file holds *per-student, per-device* state only: access
   codes, learning preferences and which video lessons this
   browser has watched. The catalogue itself — universities,
   semesters, courses and video lessons — lives in the server
   database and is read through assets/js/api.js, so no shared
   content is ever stored here.
   ============================================================ */
(function () {
  window.NT = window.NT || {};
  var KEY = "nt_demo_state_v1";

  var RECENT_LIMIT = 12;

  function defaultProgress() {
    return {
      /* Video lessons finished in this browser: { videoId: { courseId, at } } */
      watched: {},
      /* Most recently opened video lessons, newest first. */
      recent: [],
      /* Last university / semester / course the student browsed, so
         "continue learning" can be rebuilt from real activity. */
      context: { universityId: "", semester: null, courseId: "" }
    };
  }

  function defaults() {
    return {
      access: null,
      accessMeta: null,
      codes: [],
      lessonLevels: {},
      announcements: [],
      progress: defaultProgress(),
      profile: { name: "", educationLevel: "", subjectId: "", universityId: "", semester: null },
      packages: { basic: 50, standard: 100, premium: 200 },
      packageDetails: {},
      settings: {
        email: "",
        days: 30
      }
    };
  }

  var cache = null;

  function load() {
    if (cache) return cache;
    var base = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw) || {};
        cache = Object.assign(base, parsed);
        cache.settings = Object.assign({}, base.settings, parsed.settings || {});
        if (cache.settings.email === "support@nucleartutorials.zm") cache.settings.email = "";
        delete cache.settings.name;
        delete cache.settings.currency;
        cache.packages = Object.assign({}, base.packages, parsed.packages || {});
        cache.packageDetails = Object.assign({}, parsed.packageDetails || {});
        cache.profile = {
          name: String((parsed.profile && parsed.profile.name) || ""),
          educationLevel: String((parsed.profile && parsed.profile.educationLevel) || ""),
          subjectId: String((parsed.profile && parsed.profile.subjectId) || ""),
          /* Preferred university and semester, chosen by the student. */
          universityId: String((parsed.profile && parsed.profile.universityId) || ""),
          semester: [1, 2].indexOf(Number(parsed.profile && parsed.profile.semester)) !== -1
            ? Number(parsed.profile.semester)
            : null
        };
        var storedProgress = parsed.progress && typeof parsed.progress === "object" ? parsed.progress : {};
        var storedWatched = storedProgress.watched && typeof storedProgress.watched === "object" ? storedProgress.watched : {};
        var watched = {};
        Object.keys(storedWatched).forEach(function (videoId) {
          var entry = storedWatched[videoId];
          if (!entry) return;
          watched[videoId] = typeof entry === "string"
            ? { courseId: "", at: entry }
            : { courseId: String(entry.courseId || ""), at: String(entry.at || "") };
        });
        cache.progress = {
          watched: watched,
          recent: Array.isArray(storedProgress.recent)
            ? storedProgress.recent.filter(function (item) { return item && item.id; }).slice(0, RECENT_LIMIT)
            : [],
          context: {
            universityId: String((storedProgress.context && storedProgress.context.universityId) || ""),
            semester: [1, 2].indexOf(Number(storedProgress.context && storedProgress.context.semester)) !== -1
              ? Number(storedProgress.context.semester)
              : null,
            courseId: String((storedProgress.context && storedProgress.context.courseId) || "")
          }
        };
        var oldAccessMeta = parsed.accessMeta && typeof parsed.accessMeta === "object" ? parsed.accessMeta : null;
        var oldCode = oldAccessMeta && String(oldAccessMeta.code || "").trim().toUpperCase();
        var seededCode = /^NT-(BASIC|STANDARD|PREMIUM)-2026$/.test(oldCode || "");
        var simulatedAccess = oldAccessMeta && (oldAccessMeta.source === "payment" || oldAccessMeta.source === "persona" || oldAccessMeta.method || oldAccessMeta.ref);
        var discardedCode = seededCode || simulatedAccess ? oldCode : "";
        if (seededCode || simulatedAccess) {
          cache.access = null;
          cache.accessMeta = null;
        } else if (oldAccessMeta) {
          cache.accessMeta = {};
          ["code", "source", "since", "educationLevel"].forEach(function (key) {
            if (oldAccessMeta[key] != null) cache.accessMeta[key] = String(oldAccessMeta[key]);
          });
        } else {
          cache.accessMeta = null;
        }
        cache.codes = (Array.isArray(parsed.codes) ? parsed.codes : []).filter(function (record) {
          return record && record.code && !record.seeded && String(record.code).toUpperCase() !== discardedCode;
        });
        cache.announcements = Array.isArray(parsed.announcements) ? parsed.announcements : [];
        cache.lessonLevels = parsed.lessonLevels && typeof parsed.lessonLevels === "object"
          ? parsed.lessonLevels
          : (parsed.videoLevels && typeof parsed.videoLevels === "object" ? parsed.videoLevels : {});
        /* Migrate old lesson-access overrides and discard obsolete simulated records. */
        delete cache.videoLevels;
        delete cache.payments;
        delete cache.students;
        delete cache.completed;
        delete cache.recentLessons;
        delete cache.extraLessons;
        delete cache.extraCourses;
        delete cache.extraPackages;
      } else {
        cache = base;
      }
    } catch (e) {
      cache = base;
    }
    return cache;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* private browsing */ }
  }

  NT.store = {
    get: function () { return load(); },
    save: save,
    mutate: function (fn) { var state = load(); fn(state); save(); return state; },
    reset: function () { cache = defaults(); save(); },

    setAccess: function (level, meta) {
      NT.store.mutate(function (state) {
        state.access = level;
        state.accessMeta = Object.assign({ since: new Date().toISOString() }, meta || {});
      });
    },
    findCode: function (code) {
      var normalized = String(code || "").trim().toUpperCase();
      return load().codes.filter(function (record) {
        return String(record.code || "").toUpperCase() === normalized;
      })[0] || null;
    },
    addCode: function (code, pkg, status) {
      NT.store.mutate(function (state) {
        state.codes.unshift({
          code: String(code).toUpperCase(),
          pkg: pkg,
          status: status || "unused",
          created: new Date().toISOString().slice(0, 10)
        });
      });
    },
    redeemCode: function (code) {
      NT.store.mutate(function (state) {
        var record = state.codes.filter(function (item) {
          return String(item.code || "").toUpperCase() === String(code || "").toUpperCase();
        })[0];
        if (record) record.status = "redeemed";
      });
    },
    addAnnouncement: function (announcement) {
      NT.store.mutate(function (state) {
        state.announcements.unshift(Object.assign({
          id: "notice-" + Date.now(),
          status: "draft",
          created: new Date().toISOString()
        }, announcement));
      });
    },
    updateAnnouncement: function (id, updates) {
      NT.store.mutate(function (state) {
        var item = state.announcements.filter(function (notice) { return notice.id === id; })[0];
        if (item) Object.assign(item, updates || {});
      });
    },
    removeAnnouncement: function (id) {
      NT.store.mutate(function (state) {
        state.announcements = state.announcements.filter(function (notice) { return notice.id !== id; });
      });
    },
    genCode: function (pkg) {
      var number = Math.floor(1000 + Math.random() * 9000);
      return "NT-" + String(pkg || "").toUpperCase() + "-" + number;
    }
  };

  /* ---------- video-lesson progress (this device only) ----------
     A truthful record of what this browser actually watched. Every progress
     number shown in the interface is derived from these entries plus the
     catalogue returned by the server — never invented. */
  NT.progress = {
    watched: function (videoId) {
      return !!NT.store.get().progress.watched[String(videoId || "")];
    },
    watchedAt: function (videoId) {
      var entry = NT.store.get().progress.watched[String(videoId || "")];
      return entry ? entry.at : "";
    },
    watchedIds: function () {
      return Object.keys(NT.store.get().progress.watched);
    },
    watchedCount: function () {
      return NT.progress.watchedIds().length;
    },
    watchedInCourse: function (courseId) {
      var watched = NT.store.get().progress.watched;
      var id = String(courseId || "");
      return Object.keys(watched).filter(function (videoId) {
        return watched[videoId].courseId === id;
      }).length;
    },
    /* Pass the whole video record so the course link is stored with it. */
    setWatched: function (video, watched) {
      var id = String((video && video.id) || "");
      if (!id) return false;
      var next = watched === undefined ? !NT.progress.watched(id) : !!watched;
      NT.store.mutate(function (state) {
        if (next) {
          state.progress.watched[id] = { courseId: String(video.courseId || ""), at: new Date().toISOString() };
        } else {
          delete state.progress.watched[id];
        }
      });
      return next;
    },
    /* Remember an opened lesson so "continue learning" stays accurate. */
    recordView: function (video) {
      if (!video || !video.id) return;
      NT.store.mutate(function (state) {
        var entry = {
          id: String(video.id),
          title: String(video.title || ""),
          topic: String(video.topic || ""),
          courseId: String(video.courseId || ""),
          courseTitle: String(video.courseTitle || ""),
          semester: video.semester == null ? null : Number(video.semester),
          universityId: String(video.universityId || ""),
          universityName: String(video.universityName || ""),
          thumbnail: String(video.thumbnail || ""),
          durationSeconds: video.durationSeconds == null ? null : Number(video.durationSeconds),
          level: String(video.level || "basic"),
          at: new Date().toISOString()
        };
        state.progress.recent = [entry].concat(state.progress.recent.filter(function (item) {
          return item.id !== entry.id;
        })).slice(0, RECENT_LIMIT);
        state.progress.context = {
          universityId: entry.universityId,
          semester: entry.semester,
          courseId: entry.courseId
        };
      });
    },
    recent: function (limit) {
      return NT.store.get().progress.recent.slice(0, limit || RECENT_LIMIT);
    },
    last: function () {
      return NT.store.get().progress.recent[0] || null;
    },
    setContext: function (context) {
      NT.store.mutate(function (state) {
        state.progress.context = Object.assign({}, state.progress.context, context || {});
      });
    },
    context: function () {
      return NT.store.get().progress.context;
    },
    reset: function () {
      NT.store.mutate(function (state) {
        state.progress = defaultProgress();
      });
    }
  };
})();
