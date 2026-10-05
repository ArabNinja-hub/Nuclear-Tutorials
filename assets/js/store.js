/* ============================================================
   NUCLEAR TUTORIALS — State store
   Hybrid: talks to the backend (/api) when available so admin
   changes propagate to all students; falls back to localStorage
   when served statically (file:// or plain static hosting).

   Per-device state (student profile, redeemed access token) always
   stays in localStorage and is never synced to other browsers.
   ============================================================ */
(function () {
  window.NT = window.NT || {};
  var KEY = "nt_demo_state_v2";
  var API_BASE = ""; // same origin

  /* ---------- local per-device state (never synced) ---------- */
  function localDefaults() {
    return {
      access: null,
      accessMeta: null,
      adminToken: null,
      profile: { name: "", educationLevel: "", subjectId: "" },
      server: null,
      serverError: null,
      serverLoadedAt: 0
    };
  }

  /* ---------- server defaults (what admin manages) ---------- */
  function serverDefaults() {
    return {
      lessonLevels: {},
      announcements: [],
      packages: { basic: 50, standard: 100, premium: 200 },
      packageDetails: {},
      settings: { email: "", days: 30 },
      codes: []
    };
  }

  var cache = null;
  var pendingSync = Promise.resolve();

  function readLocal() {
    var base = localDefaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw) || {};
        // Strip obsolete fields from older versions
        delete parsed.videoLevels; delete parsed.payments; delete parsed.students;
        delete parsed.completed; delete parsed.recentLessons; delete parsed.extraLessons;
        delete parsed.extraCourses; delete parsed.extraPackages;
        // Migrate old accessMeta with fabricated payment records
        if (parsed.accessMeta) {
          var am = parsed.accessMeta;
          if (am.source === "payment" || am.method || am.ref) {
            parsed.access = null; parsed.accessMeta = null;
          } else {
            var m = {};
            ["code", "source", "since", "educationLevel"].forEach(function (k) {
              if (am[k] != null) m[k] = String(am[k]);
            });
            parsed.accessMeta = m;
          }
        }
        if (parsed.profile) {
          parsed.profile = {
            name: String(parsed.profile.name || ""),
            educationLevel: String(parsed.profile.educationLevel || ""),
            subjectId: String(parsed.profile.subjectId || "")
          };
        }
        cache = Object.assign(base, parsed);
      } else {
        cache = base;
      }
    } catch (e) { cache = base; }
    return cache;
  }

  function writeLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {}
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = { "Content-Type": "application/json" };
    if (cache && cache.adminToken) headers["Authorization"] = "Bearer " + cache.adminToken;
    var ac = new AbortController();
    var to = setTimeout(function () { ac.abort(); }, 4000);
    return fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ac.signal,
      credentials: "same-origin"
    }).then(function (res) {
      clearTimeout(to);
      if (res.status === 401 && cache && cache.adminToken) {
        cache.adminToken = null; writeLocal();
      }
      return res.json().then(function (data) {
        if (!res.ok) {
          var e = new Error(data.message || ("HTTP " + res.status));
          e.status = res.status; e.data = data; throw e;
        }
        return data;
      });
    });
  }

  function haveServer() { return !!(cache && cache.server && cache.serverError !== "offline"); }

  function mergeServer(data) {
    cache.server = Object.assign(serverDefaults(), data || {});
    // Server doesn't expose codes to public clients; preserve the empty array
    if (!Array.isArray(cache.server.codes)) cache.server.codes = [];
    cache.serverLoadedAt = Date.now();
    cache.serverError = null;
    writeLocal();
  }

  /* ---------- Public API ---------- */
  function load() {
    if (!cache) readLocal();
    if (!cache.server) cache.server = serverDefaults();
    return cache;
  }

  function bootstrap() {
    load();
    return api("/api/public").then(function (data) {
      // Codes list not exposed publicly — fetch full admin state if we have a token
      mergeServer(data);
      if (cache.adminToken) {
        return api("/api/admin/state").then(function (full) {
          cache.server = Object.assign(serverDefaults(), full || {});
          cache.serverLoadedAt = Date.now();
          cache.serverError = null;
          writeLocal();
          return cache;
        }).catch(function () { writeLocal(); return cache; });
      }
      writeLocal();
      return cache;
    }).catch(function () {
      // Static/offline mode — seed from legacy localStorage if present.
      // If we already have a populated server state from a previous run (e.g.
      // codes added in a prior session or during this page's lifetime), keep it.
      try {
        var alreadyHasServer = !!(cache.server && (
          cache.server.codes.length ||
          cache.server.announcements.length ||
          Object.keys(cache.server.lessonLevels).length ||
          Object.keys(cache.server.packageDetails).length ||
          (cache.server.settings && cache.server.settings.email)
        ));
        if (alreadyHasServer) {
          cache.serverError = "offline";
          cache.serverLoadedAt = Date.now();
          writeLocal();
          return cache;
        }
        var legacy = localStorage.getItem("nt_demo_state_v1");
        if (legacy) {
          var p = JSON.parse(legacy);
          var droppedPaymentCode = (p.accessMeta && (p.accessMeta.source === "payment" || p.accessMeta.method))
            ? String(p.accessMeta.code || "").toUpperCase()
            : "";
          var keptCodes = Array.isArray(p.codes) ? p.codes.filter(function (r) {
            if (!r || !r.code || r.seeded) return false;
            // Drop fabricated payment records and "active" seeded codes.
            if (r.status === "active") return false;
            // Drop the code tied to a simulated payment record (no real redemption).
            if (droppedPaymentCode && String(r.code).toUpperCase() === droppedPaymentCode) return false;
            return true;
          }) : [];
          cache.server = Object.assign(serverDefaults(), {
            lessonLevels: p.lessonLevels || (p.videoLevels || {}),
            announcements: Array.isArray(p.announcements) ? p.announcements : [],
            packages: Object.assign({ basic: 50, standard: 100, premium: 200 }, p.packages || {}),
            packageDetails: p.packageDetails || {},
            settings: { email: "", days: (p.settings && Number(p.settings.days)) || 30 },
            codes: keptCodes
          });
          // Always migrate profile (education level etc.) from legacy state
          if (p.profile) {
            cache.profile.name = String(p.profile.name || "");
            cache.profile.educationLevel = String(p.profile.educationLevel || "");
            cache.profile.subjectId = String(p.profile.subjectId || "");
          }
          // Only carry forward access if it came from a legitimate code, not a simulated payment
          if (p.access && p.accessMeta && p.accessMeta.code &&
              p.accessMeta.source !== "payment" && !p.accessMeta.method) {
            cache.access = p.access;
            cache.accessMeta = {
              code: String(p.accessMeta.code),
              source: String(p.accessMeta.source || "access-code"),
              since: p.accessMeta.since,
              educationLevel: String(p.accessMeta.educationLevel || "")
            };
          }
        } else {
          cache.server = serverDefaults();
        }
        cache.serverError = "offline";
      } catch (e) { cache.server = serverDefaults(); cache.serverError = "offline"; }
      cache.serverLoadedAt = Date.now();
      writeLocal();
      return cache;
    });
  }

  function getServer() {
    if (!cache || !cache.server) return serverDefaults();
    return cache.server;
  }

  NT.store = {
    bootstrap: bootstrap,
    get: function () {
      var s = load();
      return Object.assign({
        access: s.access,
        accessMeta: s.accessMeta,
        profile: s.profile,
        adminToken: s.adminToken,
        serverLoaded: !!s.server && s.serverError !== "offline",
        serverError: s.serverError
      }, s.server);
    },
    save: function () { writeLocal(); },
    mutate: function (fn) {
      var view = NT.store.get();
      var result = fn(view);
      cache.access = view.access;
      cache.accessMeta = view.accessMeta;
      cache.profile = view.profile;
      // Offline mode: allow local edits to server fields
      if (!haveServer() && cache.server) {
        ["lessonLevels", "announcements", "packages", "packageDetails", "settings", "codes"].forEach(function (k) {
          if (view[k] !== undefined) cache.server[k] = view[k];
        });
      }
      writeLocal();
      return result;
    },
    reset: function () {
      cache = localDefaults();
      cache.server = serverDefaults();
      writeLocal();
      if (haveServer()) {
        pendingSync = pendingSync.then(function () {
          return api("/api/admin/reset", { method: "POST" }).catch(function () {});
        });
      }
    },

    /* ---------- access (per-device) ---------- */
    setAccess: function (level, meta) {
      NT.store.mutate(function (state) {
        state.access = level;
        state.accessMeta = Object.assign({ since: new Date().toISOString() }, meta || {});
      });
    },
    redeemRemote: function (code, level) {
      return api("/api/redeem", { method: "POST", body: { code: code, educationLevel: level } });
    },

    /* ---------- codes ---------- */
    findCode: function (code) {
      var normalized = String(code || "").trim().toUpperCase();
      var list;
      if (haveServer()) {
        // In online mode the server validates; we only need a local lookup for
        // offline preview flows. Always return null so the API is the source of truth.
        return null;
      }
      list = (cache.server && cache.server.codes) || [];
      return list.filter(function (r) {
        return String(r.code || "").toUpperCase() === normalized;
      })[0] || null;
    },
    addCode: function (code, pkg, status) {
      NT.store.mutate(function (state) {
        if (!state.codes) state.codes = [];
        state.codes.unshift({
          code: String(code).toUpperCase(),
          pkg: pkg,
          status: status || "unused",
          created: new Date().toISOString().slice(0, 10)
        });
      });
    },
    redeemCode: function (code) {
      if (haveServer()) return;
      NT.store.mutate(function (state) {
        var list = state.codes || [];
        var rec = list.filter(function (r) { return String(r.code).toUpperCase() === String(code).toUpperCase(); })[0];
        if (rec) rec.status = "redeemed";
      });
    },

    /* ---------- admin auth ---------- */
    adminLogin: function (password) {
      return api("/api/admin/login", { method: "POST", body: { password: password } }).then(function (res) {
        cache.adminToken = res.token;
        writeLocal();
        return bootstrap();
      });
    },
    adminLogout: function () { cache.adminToken = null; writeLocal(); },
    adminIsAuthed: function () { return !!(cache && cache.adminToken); },
    adminRefresh: function () { return bootstrap(); },

    /* ---------- admin mutations (server-first, offline fallback) ---------- */
    adminCommit: function (patch) {
      if (haveServer()) {
        return pendingSync = pendingSync.then(function () {
          return api("/api/admin/state", { method: "POST", body: patch }).then(function () { return bootstrap(); });
        });
      }
      NT.store.mutate(function (state) {
        Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
      });
      return Promise.resolve(cache);
    },
    adminAddCode: function (pkg) {
      if (haveServer()) {
        return pendingSync = pendingSync.then(function () {
          return api("/api/admin/codes", { method: "POST", body: { pkg: pkg } }).then(function (rec) {
            return bootstrap().then(function () { return rec; });
          });
        });
      }
      var number = Math.floor(1000 + Math.random() * 9000);
      var code = "NT-" + String(pkg || "").toUpperCase() + "-" + number;
      NT.store.addCode(code, pkg, "unused");
      return Promise.resolve({ code: code, pkg: pkg, status: "unused", created: new Date().toISOString().slice(0, 10) });
    },
    adminDeleteCode: function (code) {
      if (haveServer()) {
        return pendingSync = pendingSync.then(function () {
          return api("/api/admin/codes/" + encodeURIComponent(String(code).toUpperCase()), { method: "DELETE" }).then(function () {
            return bootstrap();
          });
        });
      }
      NT.store.mutate(function (state) {
        state.codes = (state.codes || []).filter(function (r) {
          return String(r.code).toUpperCase() !== String(code).toUpperCase();
        });
      });
      return Promise.resolve();
    },
    adminAddAnnouncement: function (announcement) {
      if (haveServer()) {
        return pendingSync = pendingSync.then(function () {
          return api("/api/admin/announcements", { method: "POST", body: announcement }).then(function () {
            return bootstrap();
          });
        });
      }
      return Promise.resolve(NT.store.addAnnouncement(announcement));
    },
    adminUpdateAnnouncement: function (id, updates) {
      if (haveServer()) {
        return pendingSync = pendingSync.then(function () {
          return api("/api/admin/announcements/" + encodeURIComponent(id), { method: "PATCH", body: updates }).then(function () {
            return bootstrap();
          });
        });
      }
      return Promise.resolve(NT.store.updateAnnouncement(id, updates));
    },
    adminDeleteAnnouncement: function (id) {
      if (haveServer()) {
        return pendingSync = pendingSync.then(function () {
          return api("/api/admin/announcements/" + encodeURIComponent(id), { method: "DELETE" }).then(function () {
            return bootstrap();
          });
        });
      }
      return Promise.resolve(NT.store.removeAnnouncement(id));
    },

    /* ---------- local announcement helpers (offline mode) ---------- */
    addAnnouncement: function (announcement) {
      NT.store.mutate(function (state) {
        if (!state.announcements) state.announcements = [];
        state.announcements.unshift(Object.assign({
          id: "notice-" + Date.now(),
          status: "draft",
          created: new Date().toISOString()
        }, announcement));
      });
    },
    updateAnnouncement: function (id, updates) {
      NT.store.mutate(function (state) {
        var list = state.announcements || [];
        var item = list.filter(function (n) { return n.id === id; })[0];
        if (item) Object.assign(item, updates || {});
      });
    },
    removeAnnouncement: function (id) {
      NT.store.mutate(function (state) {
        state.announcements = (state.announcements || []).filter(function (n) { return n.id !== id; });
      });
    },

    genCode: function (pkg) {
      var number = Math.floor(1000 + Math.random() * 9000);
      return "NT-" + String(pkg || "").toUpperCase() + "-" + number;
    }
  };
})();
