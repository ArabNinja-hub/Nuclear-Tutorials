/* ============================================================
   NUCLEAR TUTORIALS — Student state (this device only)

   Only student-owned preferences live here: the access grant redeemed
   with an access code, plus study preferences such as the level,
   university and semester the student last chose. Catalogue content
   and progress always come from the server.

   Access codes, packages, announcements and lesson data used to be
   stored in this browser; those records now live in the database.
   ============================================================ */
(function () {
  window.NT = window.NT || {};
  var KEY = "nt_student_state_v2";
  var LEGACY_KEY = "nt_demo_state_v1";

  function defaults() {
    return {
      access: null,
      accessMeta: null,
      profile: { accountId: "", name: "", learnerType: "", educationLevel: "", institutionId: "", universityId: "", semester: 0 },
      settings: { supportEmail: "", accessDays: 180, packages: null }
    };
  }

  function cleanProfile(raw) {
    var profile = raw && typeof raw === "object" ? raw : {};
    var semester = parseInt(profile.semester, 10);
    var institutionId = String(profile.institutionId || profile.universityId || "").slice(0, 60);
    return {
      accountId: String(profile.accountId || "").slice(0, 80),
      name: String(profile.name || "").slice(0, 60),
      learnerType: profile.learnerType === "university" || profile.learnerType === "high_school" ? profile.learnerType : "",
      educationLevel: profile.educationLevel === "high-school" || profile.educationLevel === "university"
        ? profile.educationLevel : (profile.learnerType === "high_school" ? "high-school" : ""),
      institutionId: institutionId,
      universityId: institutionId,
      semester: semester === 2 ? 2 : (semester === 1 ? 1 : 0)
    };
  }

  function cleanAccess(value, meta) {
    if (!value) return { access: null, accessMeta: null };
    var info = meta && typeof meta === "object" ? meta : {};
    return {
      access: String(value),
      accessMeta: {
        code: String(info.code || "").toUpperCase(),
        since: String(info.since || ""),
        expiresAt: String(info.expiresAt || ""),
        educationLevel: String(info.educationLevel || "")
      }
    };
  }

  var cache = null;

  function migrateLegacy(base) {
    var raw = null;
    try { raw = localStorage.getItem(LEGACY_KEY); } catch (error) { raw = null; }
    if (!raw) return base;
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (error) { parsed = null; }
    if (!parsed || typeof parsed !== "object") return base;
    /* Keep only what still belongs to the student, and drop the legacy
       browser-local catalogue data (packages, announcements, lessons). */
    var carried = cleanAccess(parsed.access, parsed.accessMeta);
    var profile = cleanProfile(parsed.profile);
    base.access = carried.access;
    base.accessMeta = carried.accessMeta;
    base.profile = profile;
    if (parsed.settings && typeof parsed.settings === "object") {
      if (parsed.settings.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.settings.email)) {
        base.settings.supportEmail = String(parsed.settings.email);
      }
      var days = parseInt(parsed.settings.days, 10);
      if (Number.isFinite(days) && days > 0) base.settings.accessDays = days;
    }
    try { localStorage.removeItem(LEGACY_KEY); } catch (error) { /* ignore */ }
    return base;
  }

  function load() {
    if (cache) return cache;
    var base = defaults();
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (error) { raw = null; }
    if (raw) {
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (error) { parsed = null; }
      if (parsed && typeof parsed === "object") {
        var carried = cleanAccess(parsed.access, parsed.accessMeta);
        base.access = carried.access;
        base.accessMeta = carried.accessMeta;
        base.profile = cleanProfile(parsed.profile);
        if (parsed.settings && typeof parsed.settings === "object") {
          base.settings.supportEmail = String(parsed.settings.supportEmail || "");
          var days = parseInt(parsed.settings.accessDays, 10);
          if (Number.isFinite(days) && days > 0) base.settings.accessDays = days;
          base.settings.packages = parsed.settings.packages || null;
        }
      }
    } else {
      base = migrateLegacy(base);
    }
    cache = base;
    return cache;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (error) { /* private browsing */ }
  }

  NT.store = {
    get: function () { return load(); },
    save: save,
    mutate: function (fn) { var state = load(); fn(state); save(); return state; },
    reset: function () {
      cache = defaults();
      save();
      NT.progress && NT.progress.reset();
    },

    accessCode: function () {
      var state = load();
      return state.accessMeta && state.accessMeta.code ? state.accessMeta.code : "";
    },
    isActive: function () {
      var state = load();
      if (!state.access) return false;
      var expires = state.accessMeta && state.accessMeta.expiresAt;
      if (!expires) return true;
      return new Date(expires).getTime() > Date.now();
    },

    setAccess: function (pkg, meta) {
      NT.store.mutate(function (state) {
        var carried = cleanAccess(pkg, Object.assign({ since: new Date().toISOString() }, meta || {}));
        state.access = carried.access;
        state.accessMeta = carried.accessMeta;
      });
      NT.progress && NT.progress.reset();
    },
    clearAccess: function () {
      NT.store.mutate(function (state) { state.access = null; state.accessMeta = null; });
      NT.progress && NT.progress.reset();
    },

    setProfile: function (patch) {
      NT.store.mutate(function (state) {
        state.profile = cleanProfile(Object.assign({}, state.profile || {}, patch || {}));
      });
      return load().profile;
    },

    /* Public platform settings mirror the server so the footer and the
       pricing copy match what an administrator saved. */
    applyServerSettings: function (settings) {
      if (!settings) return;
      NT.store.mutate(function (state) {
        state.settings.supportEmail = String(settings.supportEmail || "");
        var days = parseInt(settings.accessDays, 10);
        if (Number.isFinite(days) && days > 0) state.settings.accessDays = days;
        if (settings.packages) state.settings.packages = settings.packages;
      });
    },

    settings: function () {
      var state = load();
      return state.settings;
    }
  };
})();
