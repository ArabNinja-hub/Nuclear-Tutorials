/* ============================================================
   NUCLEAR TUTORIALS — API client and content store

   All catalogue content (universities, semesters, courses and video
   lessons) is loaded from the server API and kept in memory for the
   current page view. Nothing about the catalogue is cached in
   localStorage, so every visitor sees what the administrator publishes.
   ============================================================ */
(function () {
  window.NT = window.NT || {};

  /* ------------------------------------------------------------
     Low level request helper
     ------------------------------------------------------------ */
  var offline = false;

  function Fail(status, message, details) {
    this.name = "NTApiError";
    this.status = status;
    this.message = message;
    this.details = details || null;
  }
  Fail.prototype = Object.create(Error.prototype);

  function studentCode() {
    try {
      var state = NT.store.get();
      return state.accessMeta && state.accessMeta.code ? state.accessMeta.code : "";
    } catch (error) {
      return "";
    }
  }

  function request(path, options) {
    options = options || {};
    var init = {
      method: options.method || "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin"
    };
    if (options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    if (options.withCode !== false) {
      var code = studentCode();
      if (code) init.headers["X-NT-Code"] = code;
    }

    return fetch(NT.base() + path.replace(/^\//, ""), init).then(function (response) {
      offline = false;
      return response.text().then(function (raw) {
        var payload = {};
        if (raw) {
          try { payload = JSON.parse(raw); } catch (error) { payload = {}; }
        }
        if (!response.ok) {
          throw new Fail(response.status, payload.error || "That request could not be completed.", payload.details);
        }
        return payload;
      });
    }, function (error) {
      offline = true;
      throw new Fail(0, "The content service is unreachable.", { cause: String((error && error.message) || error) });
    });
  }

  NT.api = {
    Fail: Fail,
    get: function (path) { return request(path); },
    post: function (path, body, options) { return request(path, Object.assign({ method: "POST", body: body || {} }, options || {})); },
    patch: function (path, body) { return request(path, { method: "PATCH", body: body || {} }); },
    del: function (path, body) { return request(path, { method: "DELETE", body: body || {} }); },
    isOffline: function () { return offline; },

    /* Student flow -------------------------------------------------- */
    issueCode: function (pkg) { return request("/api/codes/issue", { method: "POST", body: { package: pkg }, withCode: false }); },
    redeem: function (code, educationLevel) {
      return request("/api/access/redeem", { method: "POST", body: { code: code, educationLevel: educationLevel }, withCode: false });
    },
    progress: function () { return request("/api/progress"); },
    saveProgress: function (videoId, extra) {
      return request("/api/progress", { method: "POST", body: Object.assign({ videoId: videoId }, extra || {}) });
    },
    clearProgress: function (videoId) {
      return request("/api/progress", { method: "DELETE", body: videoId ? { videoId: videoId } : {} });
    },

    /* Admin flow ---------------------------------------------------- */
    admin: {
      session: function () { return request("/api/admin/session", { withCode: false }); },
      login: function (password) { return request("/api/admin/login", { method: "POST", body: { password: password }, withCode: false }); },
      logout: function () { return request("/api/admin/logout", { method: "POST", withCode: false }); },
      overview: function () { return request("/api/admin/overview"); },
      universities: function () { return request("/api/admin/universities"); },
      createUniversity: function (body) { return request("/api/admin/universities", { method: "POST", body: body }); },
      updateUniversity: function (id, body) { return request("/api/admin/universities/" + encodeURIComponent(id), { method: "PATCH", body: body }); },
      deleteUniversity: function (id) { return request("/api/admin/universities/" + encodeURIComponent(id), { method: "DELETE" }); },
      courses: function (filter) {
        var params = new URLSearchParams();
        if (filter && filter.university) params.set("university", filter.university);
        if (filter && filter.semester) params.set("semester", filter.semester);
        return request("/api/admin/courses" + (params.toString() ? "?" + params.toString() : ""));
      },
      createCourse: function (body) { return request("/api/admin/courses", { method: "POST", body: body }); },
      updateCourse: function (id, body) { return request("/api/admin/courses/" + encodeURIComponent(id), { method: "PATCH", body: body }); },
      deleteCourse: function (id) { return request("/api/admin/courses/" + encodeURIComponent(id), { method: "DELETE" }); },
      videos: function (filter) {
        var params = new URLSearchParams();
        if (filter && filter.university) params.set("university", filter.university);
        if (filter && filter.semester) params.set("semester", filter.semester);
        if (filter && filter.course) params.set("course", filter.course);
        if (filter && filter.status) params.set("status", filter.status);
        if (filter && filter.q) params.set("q", filter.q);
        return request("/api/admin/videos" + (params.toString() ? "?" + params.toString() : ""));
      },
      createVideo: function (body) { return request("/api/admin/videos", { method: "POST", body: body }); },
      updateVideo: function (id, body) { return request("/api/admin/videos/" + encodeURIComponent(id), { method: "PATCH", body: body }); },
      deleteVideo: function (id) { return request("/api/admin/videos/" + encodeURIComponent(id), { method: "DELETE" }); },
      moveVideo: function (id, direction) { return request("/api/admin/videos/" + encodeURIComponent(id) + "/move", { method: "POST", body: { direction: direction } }); },
      codes: function () { return request("/api/admin/codes"); },
      createCodes: function (pkg, count) { return request("/api/admin/codes", { method: "POST", body: { package: pkg, count: count } }); },
      deleteCode: function (code) { return request("/api/admin/codes/" + encodeURIComponent(code), { method: "DELETE" }); },
      announcements: function () { return request("/api/admin/announcements"); },
      createAnnouncement: function (body) { return request("/api/admin/announcements", { method: "POST", body: body }); },
      updateAnnouncement: function (id, body) { return request("/api/admin/announcements/" + encodeURIComponent(id), { method: "PATCH", body: body }); },
      deleteAnnouncement: function (id) { return request("/api/admin/announcements/" + encodeURIComponent(id), { method: "DELETE" }); },
      settings: function () { return request("/api/admin/settings"); },
      saveSettings: function (body) { return request("/api/admin/settings", { method: "PATCH", body: body }); },
      changePassword: function (currentPassword, newPassword) { return request("/api/admin/password", { method: "POST", body: { currentPassword: currentPassword, newPassword: newPassword } }); }
    }
  };

  /* ------------------------------------------------------------
     Catalogue store — one request per page view, shared by every
     renderer on that page.
     ------------------------------------------------------------ */
  var CATALOGUE = { status: "idle", error: null, data: null, promise: null };

  function applyCatalogue(payload) {
    CATALOGUE.data = payload.catalogue;
    CATALOGUE.status = "ready";
    CATALOGUE.error = null;
    NT.content.settings = payload.settings || null;
    if (payload.settings && NT.store.applyServerSettings) NT.store.applyServerSettings(payload.settings);
    return CATALOGUE.data;
  }

  NT.content = {
    settings: null,
    SEMESTERS: [
      { id: 1, label: "Semester 1", short: "S1" },
      { id: 2, label: "Semester 2", short: "S2" }
    ],

    status: function () { return CATALOGUE.status; },
    error: function () { return CATALOGUE.error; },
    data: function () { return CATALOGUE.data; },

    load: function (force) {
      if (CATALOGUE.promise && !force) return CATALOGUE.promise;
      CATALOGUE.status = "loading";
      CATALOGUE.promise = NT.api.get("/api/catalogue").then(applyCatalogue, function (error) {
        CATALOGUE.status = "error";
        CATALOGUE.error = error;
        throw error;
      });
      return CATALOGUE.promise;
    },

    ready: function (onReady, onError) {
      NT.content.load().then(function (data) { onReady(data); }, function (error) {
        if (onError) onError(error);
      });
    },

    reload: function () {
      CATALOGUE.promise = null;
      return NT.content.load(true);
    },

    /* ---------- readers ---------- */

    universities: function (options) {
      if (!CATALOGUE.data) return [];
      options = options || {};
      return CATALOGUE.data.universities.filter(function (item) {
        if (options.level && item.level !== options.level) return false;
        return true;
      });
    },

    schools: function () {
      return CATALOGUE.data ? CATALOGUE.data.schools : [];
    },

    /* Institutions of either kind, so the High School pathway keeps working. */
    institutions: function (level) {
      return level === "high-school" ? NT.content.schools() : NT.content.universities();
    },

    university: function (id) {
      if (!CATALOGUE.data || !id) return null;
      var all = CATALOGUE.data.universities.concat(CATALOGUE.data.schools);
      for (var index = 0; index < all.length; index++) {
        if (all[index].id === id) return all[index];
      }
      return null;
    },

    courses: function (filter) {
      if (!CATALOGUE.data) return [];
      filter = filter || {};
      return CATALOGUE.data.courses.filter(function (course) {
        if (filter.universityId && course.universityId !== filter.universityId) return false;
        if (filter.semester && Number(course.semester) !== Number(filter.semester)) return false;
        if (filter.level && course.universityLevel !== filter.level) return false;
        if (filter.ids && filter.ids.indexOf(course.id) === -1) return false;
        return true;
      });
    },

    course: function (id) {
      if (!CATALOGUE.data || !id) return null;
      var list = CATALOGUE.data.courses;
      for (var index = 0; index < list.length; index++) {
        if (list[index].id === id) return list[index];
      }
      return null;
    },

    videos: function (filter) {
      if (!CATALOGUE.data) return [];
      filter = filter || {};
      return CATALOGUE.data.videos.filter(function (video) {
        if (filter.courseId && video.courseId !== filter.courseId) return false;
        if (filter.universityId && video.universityId !== filter.universityId) return false;
        if (filter.semester && Number(video.semester) !== Number(filter.semester)) return false;
        if (filter.level && video.level !== filter.level) return false;
        if (filter.publishedOnly && !video.published) return false;
        return true;
      });
    },

    video: function (id) {
      if (!CATALOGUE.data || !id) return null;
      var list = CATALOGUE.data.videos;
      for (var index = 0; index < list.length; index++) {
        if (list[index].id === id) return list[index];
      }
      return null;
    },

    totals: function () {
      return CATALOGUE.data ? CATALOGUE.data.totals : { universities: 0, schools: 0, courses: 0, videos: 0, levels: {} };
    },

    /* Courses that belong to a university and semester, in catalogue order. */
    semesterCourses: function (universityId, semester) {
      return NT.content.courses({ universityId: universityId, semester: semester });
    },

    search: function (query) {
      var needle = String(query || "").trim().toLowerCase();
      if (!needle || !CATALOGUE.data) return { universities: [], courses: [], videos: [] };
      function hit(fields) {
        return fields.join(" ").toLowerCase().indexOf(needle) !== -1;
      }
      return {
        universities: NT.content.universities().concat(NT.content.schools()).filter(function (item) {
          return hit([item.name, item.shortName, item.city, item.summary]);
        }),
        courses: CATALOGUE.data.courses.filter(function (course) {
          return hit([course.title, course.code, course.description, course.universityName]);
        }),
        videos: CATALOGUE.data.videos.filter(function (video) {
          return hit([video.title, video.topic, video.description, video.courseTitle, video.universityName]);
        })
      };
    },

    /* Which course a lesson belongs to, for lesson-side navigation. */
    lessonsOf: function (courseId) {
      return NT.content.videos({ courseId: courseId });
    },

    upNext: function (video) {
      if (!video) return null;
      var lessons = NT.content.lessonsOf(video.courseId);
      var index = lessons.map(function (item) { return item.id; }).indexOf(video.id);
      return index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;
    }
  };

  /* ------------------------------------------------------------
     Learning progress — real records stored on the server and
     keyed by the student's access code.
     ------------------------------------------------------------ */
  var PROGRESS = { status: "idle", items: [], byId: {} };

  function indexProgress(items) {
    PROGRESS.items = items || [];
    PROGRESS.byId = {};
    PROGRESS.items.forEach(function (item) { PROGRESS.byId[item.videoId] = item; });
    PROGRESS.status = "ready";
    return PROGRESS.items;
  }

  NT.progress = {
    items: function () { return PROGRESS.items; },
    isReady: function () { return PROGRESS.status === "ready"; },
    watched: function (videoId) { return !!PROGRESS.byId[videoId]; },
    entry: function (videoId) { return PROGRESS.byId[videoId] || null; },
    count: function (courseId) {
      var lessons = courseId ? NT.content.lessonsOf(courseId) : null;
      return PROGRESS.items.filter(function (item) {
        if (!lessons) return true;
        return lessons.some(function (lesson) { return lesson.id === item.videoId; });
      }).length;
    },
    watchedIn: function (courseId) {
      return NT.content.lessonsOf(courseId).filter(function (lesson) { return !!PROGRESS.byId[lesson.id]; }).length;
    },
    mostRecent: function (limit) {
      return PROGRESS.items.slice(0, limit || PROGRESS.items.length).map(function (item) {
        return { entry: item, video: NT.content.video(item.videoId) };
      }).filter(function (row) { return !!row.video; });
    },
    load: function () {
      if (!studentCode()) {
        PROGRESS.status = "empty";
        return Promise.resolve([]);
      }
      return NT.api.progress().then(function (payload) {
        return indexProgress(payload.progress);
      }, function () {
        PROGRESS.status = "empty";
        return [];
      });
    },
    /* Called when a lesson page opens and when playback is confirmed. */
    mark: function (videoId, extra) {
      return NT.api.saveProgress(videoId, extra).then(function (payload) {
        return indexProgress(payload.progress);
      });
    },
    reset: function () { PROGRESS.items = []; PROGRESS.byId = {}; PROGRESS.status = "idle"; }
  };

  /* ------------------------------------------------------------
     Shared formatting used by every page
     ------------------------------------------------------------ */
  NT.duration = function (seconds) {
    var total = Number(seconds);
    if (!Number.isFinite(total) || total <= 0) return "";
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var secs = Math.floor(total % 60);
    if (hours) return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    return minutes + ":" + String(secs).padStart(2, "0");
  };

  NT.providerLabel = function (provider) {
    return { youtube: "YouTube", vimeo: "Vimeo", direct: "Direct video", other: "External link" }[provider] || "External link";
  };

  /* YouTube lessons play inside the page; other sources open in a new tab. */
  NT.embedUrl = function (video) {
    if (!video || !video.sourceUrl) return "";
    try {
      var url = new URL(video.sourceUrl);
      var host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") return "https://www.youtube.com/embed/" + url.pathname.split("/").filter(Boolean)[0];
      if (host.endsWith("youtube.com")) {
        var id = url.searchParams.get("v");
        if (!id && /\/(embed|shorts|live)\//.test(url.pathname)) id = url.pathname.split("/").filter(Boolean)[1];
        if (id) return "https://www.youtube.com/embed/" + id;
      }
      if (host.endsWith("vimeo.com")) {
        var vimeoId = url.pathname.split("/").filter(Boolean)[0];
        if (vimeoId && /^\d+$/.test(vimeoId)) return "https://player.vimeo.com/video/" + vimeoId;
      }
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(url.pathname)) return video.sourceUrl;
    } catch (error) {
      return "";
    }
    return "";
  };
})();
