/* ============================================================
   NUCLEAR TUTORIALS — Local preview state
   Access codes and preferences persist in this browser only.
   ============================================================ */
(function () {
  window.NT = window.NT || {};
  var KEY = "nt_demo_state_v1";

  function defaults() {
    return {
      access: null,
      accessMeta: null,
      codes: [],
      lessonLevels: {},
      announcements: [],
      profile: { name: "", educationLevel: "", subjectId: "" },
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
          subjectId: String((parsed.profile && parsed.profile.subjectId) || "")
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
})();
