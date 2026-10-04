/* ============================================================
   NUCLEAR TUTORIALS — Demo state store (localStorage)
   Keeps access level, completions, codes, payments and admin
   edits consistent across every page of the demo.
   ============================================================ */
(function () {
  window.NT = window.NT || {};
  var KEY = "nt_demo_state_v1";

  function defaults() {
    return {
      access: null,                 // 'basic' | 'standard' | 'premium'
      accessMeta: null,             // { code, source, method, ref, since }
      completed: [],                // lesson ids
      codes: [
        { code: "NT-BASIC-2026", pkg: "basic", status: "active", created: "2026-01-05", seeded: true },
        { code: "NT-STANDARD-2026", pkg: "standard", status: "active", created: "2026-01-05", seeded: true },
        { code: "NT-PREMIUM-2026", pkg: "premium", status: "active", created: "2026-01-05", seeded: true }
      ],
      payments: NT.data.SEED_PAYMENTS.slice(),
      students: NT.data.SEED_STUDENTS.slice(),
      videoLevels: {},              // lessonId -> level override (admin)
      extraLessons: [],             // lessons added via admin "Upload Video"
      extraCourses: [],             // draft courses created in admin
      packages: { basic: 50, standard: 100, premium: 200 },
      settings: {
        name: "Nuclear Tutorials",
        email: "support@nucleartutorials.zm",
        currency: "Zambian Kwacha (K)",
        days: 30
      }
    };
  }

  var cache = null;

  function load() {
    if (cache) return cache;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        cache = Object.assign(defaults(), parsed);
        cache.settings = Object.assign(defaults().settings, parsed.settings || {});
        cache.packages = Object.assign(defaults().packages, parsed.packages || {});
      } else {
        cache = defaults();
      }
    } catch (e) {
      cache = defaults();
    }
    return cache;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* private mode */ }
  }

  NT.store = {
    get: function () { return load(); },
    save: save,
    mutate: function (fn) { var s = load(); fn(s); save(); return s; },
    reset: function () { cache = defaults(); save(); },

    setAccess: function (level, meta) {
      NT.store.mutate(function (s) {
        s.access = level;
        s.accessMeta = Object.assign({ since: new Date().toISOString() }, meta || {});
      });
    },
    clearAccess: function () {
      NT.store.mutate(function (s) { s.access = null; s.accessMeta = null; });
    },
    toggleComplete: function (lessonId, done) {
      NT.store.mutate(function (s) {
        var i = s.completed.indexOf(lessonId);
        if (done && i === -1) s.completed.push(lessonId);
        if (!done && i !== -1) s.completed.splice(i, 1);
      });
    },
    isComplete: function (lessonId) { return load().completed.indexOf(lessonId) !== -1; },

    findCode: function (code) {
      var c = String(code || "").trim().toUpperCase();
      return load().codes.filter(function (x) { return x.code === c; })[0] || null;
    },
    addCode: function (code, pkg, status) {
      NT.store.mutate(function (s) {
        s.codes.unshift({ code: code, pkg: pkg, status: status || "unused", created: new Date().toISOString().slice(0, 10), seeded: false });
      });
    },
    redeemCode: function (code) {
      NT.store.mutate(function (s) {
        var c = s.codes.filter(function (x) { return x.code === code; })[0];
        if (c) c.status = "redeemed";
      });
    },
    addPayment: function (p) {
      NT.store.mutate(function (s) { s.payments.unshift(Object.assign({ seeded: false }, p)); });
    },
    addStudent: function (st) {
      NT.store.mutate(function (s) { s.students.unshift(Object.assign({ seeded: false }, st)); });
    },
    genCode: function (pkg) {
      var n = Math.floor(1000 + Math.random() * 9000);
      return "NT-" + pkg.toUpperCase() + "-" + n;
    },
    genRef: function () {
      var n = Math.floor(10000 + Math.random() * 90000);
      return "NTX-2026-" + n;
    }
  };
})();
