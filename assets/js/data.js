/* ============================================================
   NUCLEAR TUTORIALS — Access levels, packages and catalogue helpers

   Content itself (universities, semesters, courses, video lessons)
   comes from the server through NT.content. This file describes the
   access system that decides which lessons a package opens, and keeps
   the copy for the packages that the administrator can edit.
   ============================================================ */
(function () {
  window.NT = window.NT || {};

  var LEVELS = ["basic", "standard", "premium"];
  var LEVEL_RANK = { basic: 1, standard: 2, premium: 3 };
  var LEVEL_LABEL = { basic: "Basic", standard: "Standard", premium: "Premium" };

  var EDUCATION_LEVELS = [
    { id: "high-school", label: "High School", icon: "book-open" },
    { id: "university", label: "University", icon: "graduation-cap" }
  ];

  /* Defaults are used only when the server settings have not loaded yet. */
  var PACKAGES = {
    basic: {
      id: "basic", name: "Basic", price: 50,
      tagline: "Basic video lessons across the catalogue.",
      features: ["Basic video lessons in every course"]
    },
    standard: {
      id: "standard", name: "Standard", price: 100,
      tagline: "Basic and Standard video lessons across the catalogue.",
      features: ["Basic and Standard video lessons in every course"]
    },
    premium: {
      id: "premium", name: "Premium", price: 200,
      tagline: "Every published video lesson across the catalogue.",
      features: ["All video lessons in every course"]
    }
  };

  NT.data = {
    LEVELS: LEVELS,
    LEVEL_RANK: LEVEL_RANK,
    LEVEL_LABEL: LEVEL_LABEL,
    EDUCATION_LEVELS: EDUCATION_LEVELS,
    PACKAGES: PACKAGES
  };

  /* ---------- packages ---------- */

  function serverPackages() {
    var settings = NT.store.settings();
    return settings && settings.packages ? settings.packages : null;
  }

  NT.packageDetails = function (id) {
    var base = PACKAGES[id];
    if (!base) return null;
    var overrides = (serverPackages() || {})[id] || {};
    return {
      id: id,
      name: overrides.name || base.name,
      price: Number.isFinite(Number(overrides.price)) ? Number(overrides.price) : base.price,
      tagline: overrides.tagline || base.tagline,
      features: Array.isArray(overrides.features) && overrides.features.length ? overrides.features : base.features.slice()
    };
  };

  NT.packagePrice = function (id) {
    var details = NT.packageDetails(id);
    return details ? details.price : 0;
  };

  NT.accessDays = function () {
    var days = parseInt(NT.store.settings().accessDays, 10);
    return Number.isFinite(days) && days > 0 ? days : 180;
  };

  /* ---------- levels and access ---------- */

  NT.levelOf = function (video) {
    var level = video && video.level;
    return LEVELS.indexOf(level) !== -1 ? level : "standard";
  };

  NT.isUnlocked = function (video) {
    var state = NT.store.get();
    if (!state.access) return false;
    if (!NT.store.isActive()) return false;
    return LEVEL_RANK[state.access] >= LEVEL_RANK[NT.levelOf(video)];
  };

  NT.counts = function () {
    var videos = NT.content.data() ? NT.content.data().videos : [];
    var counts = { total: videos.length, basic: 0, standard: 0, premium: 0 };
    videos.forEach(function (video) { counts[NT.levelOf(video)] += 1; });
    return counts;
  };

  NT.availableFor = function (level) {
    if (!level || !LEVEL_RANK[level]) return 0;
    var videos = NT.content.data() ? NT.content.data().videos : [];
    return videos.filter(function (video) {
      return LEVEL_RANK[level] >= LEVEL_RANK[NT.levelOf(video)];
    }).length;
  };

  /* Lesson numbers a package opens inside one course, e.g. Basic 1-2. */
  NT.tierRange = function (courseId) {
    var lessons = NT.content.lessonsOf(courseId);
    var out = {};
    LEVELS.forEach(function (level) {
      var indexes = [];
      lessons.forEach(function (lesson, index) {
        if (LEVEL_RANK[level] >= LEVEL_RANK[NT.levelOf(lesson)]) indexes.push(index + 1);
      });
      out[level] = indexes.length
        ? { from: indexes[0], to: indexes[indexes.length - 1], count: indexes.length }
        : null;
    });
    return out;
  };

  /* ---------- academic phrasing ---------- */

  NT.educationLevel = function (id) {
    var match = EDUCATION_LEVELS.filter(function (item) { return item.id === id; })[0];
    return match || null;
  };

  NT.semesterLabel = function (semester) {
    return Number(semester) === 2 ? "Semester 2" : "Semester 1";
  };

  NT.semesterShort = function (semester) {
    return Number(semester) === 2 ? "S2" : "S1";
  };

  NT.pathwayIcon = function (educationLevelId) {
    return educationLevelId === "high-school" ? "book-open" : "graduation-cap";
  };

  /* One-line context used across cards, crumbs and the admin forms. */
  NT.contextLine = function (parts) {
    return (parts || []).filter(Boolean).join(" · ");
  };

  NT.courseContext = function (course) {
    if (!course) return "";
    return NT.contextLine([course.universityName, NT.semesterLabel(course.semester), course.code]);
  };

  NT.videoContext = function (video) {
    if (!video) return "";
    return NT.contextLine([video.universityShort || video.universityName, NT.semesterLabel(video.semester), video.courseTitle]);
  };
})();
