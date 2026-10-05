/* ============================================================
   NUCLEAR TUTORIALS — Public site behaviour
   Routing by <body data-page="...">
   ============================================================ */
(function () {
  var D = NT.data;

  /* ============================ shared renderers ============================ */

  /* Access package cards: prices and exact lesson coverage. */
  NT.renderPricingCards = function (el) {
    var s = NT.store.get();
    var total = NT.counts().total;
    el.innerHTML = D.LEVELS.map(function (id) {
      var p = NT.packageDetails(id);
      var current = s.access === id;
      var feats = p.features.filter(function (f) {
        return String(f).toLowerCase().indexOf("days of access") === -1;
      }).map(function (f) {
        return "<li>" + NT.icon("check") + "<span>" + NT.esc(f) + "</span></li>";
      }).join("");
      var actionClass = "btn-secondary";
      return '<article class="price-card price-' + id + ' reveal" data-delay="' + D.LEVELS.indexOf(id) + '">' +
        '<span class="price-name t-' + id + '">' + NT.esc(p.name) + "</span>" +
        '<div class="price-amount"><b>' + NT.kwacha(NT.packagePrice(id)) + "</b><span>/ " + s.settings.days + " days</span></div>" +
        '<div class="price-unlocks"><b>' + NT.availableFor(id) + "</b><span>of " + total + " lessons included</span></div>" +
        '<ul class="price-feats">' + feats + "</ul>" +
        (current
          ? '<button class="btn btn-secondary btn-block" disabled>' + NT.icon("check-circle") + "Current package</button>"
          : '<a class="btn ' + actionClass + ' btn-block" href="' + NT.base() + 'checkout.html?pkg=' + encodeURIComponent(id) + '">Choose package</a>') +
        "</article>";
    }).join("");
  };

  /* Wording for education pathways lives in ui.js so every page cannot drift apart. */
    /* One course card: subject, selected pathway, lesson count and one action. */
  NT.renderCourseCard = function (course) {
    var lessons = NT.courseLessons(course.id);
    var state = NT.store.get();
    var unlocked = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); }).length;
    var pathId = state.profile && state.profile.educationLevel;
    var pathLabel = NT.coursePathwayNames(course, pathId) || NT.coursePathwayNames(course);
    var accessLabel = state.access
      ? unlocked + " of " + lessons.length + " available"
      : lessons.length + (lessons.length === 1 ? " lesson" : " lessons");
    var href = NT.base() + "course.html?id=" + encodeURIComponent(course.id);
    return '<article class="course-card reveal" data-delay="' + (D.COURSES.indexOf(course) % 3) + '" id="' + NT.esc(course.id) + '">' +
      '<div class="course-card-head"><span class="course-icon" style="--tint:' + course.tint + ";--tint-fg:" + course.tintFg + '">' + NT.icon(course.icon) + "</span>" +
      '<div><h3>' + NT.esc(course.title) + "</h3>" +
      '<p class="course-path">' + NT.esc(pathLabel) + "</p></div></div>" +
      '<div class="course-card-body"><p class="desc">' + NT.esc(course.desc) + "</p>" +
      '<div class="course-card-foot"><span class="course-card-meta">' + NT.esc(accessLabel) + "</span>" +
      '<a class="btn btn-secondary btn-sm" href="' + href + '">View course' + NT.icon("arrow-right", "icon-sm") + "</a>" +
      "</div></div></article>";
  };

  /* ============================ HOME ============================ */
  function pageHome() {
    var grid = document.getElementById("courseGrid");
    if (grid) grid.innerHTML = D.COURSES.slice(0, 3).map(NT.renderCourseCard).join("");
  }

  /* ============================ COURSES ============================ */
  function pageCourses() {
    var wrap = document.getElementById("courseList");
    var tabsHost = document.getElementById("pathwayTabs");
    var search = document.getElementById("courseSearch");
    var summary = document.getElementById("courseResults");
    var chips = document.getElementById("activeFilters");
    var profile = NT.store.get().profile || {};
    var queryLevel = NT.qs("level");
    if (!D.EDUCATION_LEVELS.some(function (item) { return item.id === queryLevel; })) {
      queryLevel = D.EDUCATION_LEVELS.some(function (item) { return item.id === profile.educationLevel; })
        ? profile.educationLevel : "";
    }
    var level = queryLevel;
    var subject = NT.qs("subject") || profile.subjectId || "";
    if (!D.SUBJECTS.some(function (item) { return item.id === subject; })) subject = "";

    function renderTabs() {
      var focused = tabsHost.contains(document.activeElement) ? document.activeElement.dataset.pathway : null;
      var options = [{ id: "", label: "All courses", icon: "layers" }].concat(D.EDUCATION_LEVELS.map(function (item) {
        return { id: item.id, label: item.label, icon: NT.pathwayIcon(item.id) };
      }));
      tabsHost.innerHTML = options.map(function (option) {
        var active = level === option.id;
        return '<button type="button" class="pathway-tab' + (active ? " active" : "") + '" data-pathway="' + option.id + '" aria-pressed="' + active + '">' +
          NT.icon(option.icon) + "<span>" + NT.esc(option.label) + "</span></button>";
      }).join("");
      tabsHost.querySelectorAll("[data-pathway]").forEach(function (button) {
        button.addEventListener("click", function () {
          level = button.dataset.pathway;
          if (level) {
            NT.store.mutate(function (state) {
              state.profile = Object.assign({ name: "", educationLevel: "", subjectId: "" }, state.profile || {});
              state.profile.educationLevel = level;
            });
          }
          render();
        });
      });
      if (focused !== null) {
        var refocus = tabsHost.querySelector('[data-pathway="' + focused + '"]');
        if (refocus) refocus.focus();
      }
    }

    function renderChips() {
      var active = subject ? (NT.subject(subject) || {}).title : "";
      chips.innerHTML = active
        ? '<span class="filter-chip">Subject: ' + NT.esc(active) +
          '<button type="button" id="clearSubject" aria-label="Clear subject filter">' + NT.icon("x") + "</button></span>"
        : "";
      var clear = document.getElementById("clearSubject");
      if (clear) clear.addEventListener("click", function () { subject = ""; render(); });
      chips.classList.toggle("hidden", !chips.innerHTML);
    }

    function syncUrl() {
      if (!window.history || !window.history.replaceState) return;
      try {
        var url = new URL(window.location.href);
        if (level) url.searchParams.set("level", level); else url.searchParams.delete("level");
        if (subject) url.searchParams.set("subject", subject); else url.searchParams.delete("subject");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      } catch (e) { /* file:// previews cannot rewrite history */ }
    }

    function render() {
      var q = search.value.trim().toLowerCase();
      var list = D.COURSES.filter(function (course) {
        if (level && !NT.coursePathway(course, level)) return false;
        if (subject && course.subjectId !== subject) return false;
        if (q && (course.title + " " + course.desc).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      wrap.innerHTML = list.length
        ? list.map(NT.renderCourseCard).join("")
        : '<div class="card course-empty"><h2>No courses match</h2><p>Try another pathway, subject or search term.</p>' +
          '<button class="btn btn-secondary" type="button" id="emptyClear">Clear search</button></div>';
      var activeLevel = level ? NT.educationLevel(level) : null;
      var lessonCount = list.reduce(function (sum, course) { return sum + NT.courseLessons(course.id).length; }, 0);
      summary.innerHTML = "<span><b>" + list.length + "</b> " + (list.length === 1 ? "course" : "courses") +
        " · <b>" + lessonCount + "</b> lessons" +
        (activeLevel ? " · " + NT.esc(activeLevel.label) + " pathway" : "") + "</span>" +
        "<span class='muted'>Open a course to see its full lesson list</span>";
      var emptyClear = document.getElementById("emptyClear");
      if (emptyClear) emptyClear.addEventListener("click", function () {
        subject = "";
        search.value = "";
        render();
      });
      renderTabs();
      renderChips();
      syncUrl();
      NT.initReveal();
    }

    search.addEventListener("input", render);
    render();
  }

  /* ============================ INDIVIDUAL COURSE ============================ */
  function pageCourse() {
    var id = NT.qs("id") || NT.qs("course") || "";
    var course = NT.course(id);
    var root = document.getElementById("courseRoot");
    if (!course) {
      root.innerHTML = '<div class="card lesson-notice"><h1>Course not found</h1><a class="btn btn-secondary" href="' + NT.base() + 'courses.html">Browse courses</a></div>';
      return;
    }
    var lessons = NT.courseLessons(course.id);
    var state = NT.store.get();
    var unlocked = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); });
    var ranges = NT.tierRange(course.id);
    var chosenPath = state.profile && state.profile.educationLevel;
    var matchingPath = chosenPath && NT.coursePathway(course, chosenPath);
    var pathwayLabel = matchingPath ? NT.pathwayLabel(matchingPath) : NT.coursePathwayNames(course);
    var pathwayIcon = NT.pathwayIcon(matchingPath ? matchingPath.educationLevel : "high-school");
    var firstAvailable = unlocked[0];

    document.title = course.title + " — Nuclear Tutorials";
    var primaryCta = firstAvailable
      ? '<a class="btn btn-primary btn-lg" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(firstAvailable.id) + '">' + NT.icon("book-open") + "View first included lesson</a>"
      : '<a class="btn btn-primary btn-lg" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Log in with an access code</a>";

    var hero =
      '<section class="course-hero"><div class="container">' +
      '<div class="crumbs"><a href="' + NT.base() + 'index.html">Home</a>' + NT.icon("chevron-right", "icon-sm") +
      '<a href="' + NT.base() + 'courses.html">Courses</a>' + NT.icon("chevron-right", "icon-sm") +
      "<span>" + NT.esc(course.title) + "</span></div>" +
      '<div class="course-hero-copy">' +
      '<div class="course-hero-ident"><span class="course-hero-icon">' + NT.icon(course.icon) + "</span>" +
      '<span class="course-hero-path">' + NT.esc(pathwayLabel) + "</span></div>" +
      "<h1>" + NT.esc(course.title) + "</h1>" +
      '<p class="course-hero-desc">' + NT.esc(course.desc) + "</p>" +
      '<div class="course-meta-row"><span>' + NT.icon("book-open") + "<span class='mono'>" + lessons.length + "</span> lessons</span>" +
      '<span>' + NT.icon(pathwayIcon) + NT.esc(pathwayLabel) + "</span>" +
      (state.access ? "<span>" + NT.icon("unlock") + "<span class='mono'>" + unlocked.length + "</span> lessons included</span>" : "") +
      '</div><div class="course-hero-actions">' + primaryCta + "</div>" +
      "</div></div></section>";

    function lessonRow(lesson) {
      var isUnlocked = NT.isUnlocked(lesson);
      var num = String(lesson.index).padStart(2, "0");
      return '<li class="lib-lesson ' + (isUnlocked ? "is-open" : "is-locked") + '">' +
        '<span class="lib-index" aria-hidden="true">' + num + "</span>" +
        '<span class="lib-state" aria-hidden="true">' + NT.icon(isUnlocked ? "book-open" : "lock") + "</span>" +
        '<span class="lib-lesson-title"><b>' + NT.esc(lesson.title) + "</b><small>" + D.LEVEL_LABEL[NT.levelOf(lesson)] + " access</small></span>" +
        '<span class="lib-lesson-action">' +
        (isUnlocked
          ? '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(lesson.id) + '">View lesson details</a>'
          : '<span class="requires">' + D.LEVEL_LABEL[NT.levelOf(lesson)] + " access required</span>") +
        "</span></li>";
    }
    var list =
      '<section class="section section-alt"><div class="container">' +
      '<div class="section-head"><span class="eyebrow">Course contents</span>' +
      "<h2>Lessons</h2><p>Listed lesson titles and their package access levels. Lesson materials are not hosted in this preview.</p></div>" +
      '<ul class="lib-lessons course-lessons">' + lessons.map(lessonRow).join("") + "</ul>" +
      "</div></section>";

    var access =
      '<section class="section"><div class="container">' +
      '<div class="section-head"><span class="eyebrow">Package access</span>' +
      "<h2>Lessons included by package</h2><p>Access levels for this course.</p></div>" +
      '<div class="tier-strip">' + D.LEVELS.map(function (level) {
        var range = ranges[level];
        var current = state.access === level;
        return '<div class="tier-cell tc-' + level + (current ? " is-current" : "") + '">' +
          '<span class="name"><span class="dot"></span>' + D.LEVEL_LABEL[level] + (current ? " · current" : "") + "</span>" +
          '<span class="what">' + (range ? "Lessons <span class='mono'>" + range.from + "–" + range.to + "</span>" : "No lessons") + "</span>" +
          "<small>" + (range ? range.count + " of " + lessons.length + " lessons" : "") + "</small></div>";
      }).join("") +
      '</div><p class="muted small" style="margin-top:16px">' +
      (state.access
        ? "Your " + NT.esc(NT.packageDetails(state.access).name) + " package includes " + unlocked.length + " of " + lessons.length + " listed lessons in this preview."
        : 'Already have a code? <a href="' + NT.base() + 'access.html">Log in to view your package access</a>. Need a code? <a href="' + NT.base() + 'pricing.html">View packages</a>.') +
      "</p></div></section>";

    root.innerHTML = hero + list + access;
  }

  /* ============================ PRICING ============================ */
  function pagePricing() {
    NT.renderPricingCards(document.getElementById("pricingGrid"));
  }

  /* ============================ ACCESS CODE ============================ */
  function pageAccess() {
    var form = document.getElementById("codeForm");
    var input = document.getElementById("codeInput");
    var msg = document.getElementById("codeMsg");
    var result = document.getElementById("codeResult");
    var radios = Array.prototype.slice.call(form.querySelectorAll('input[name="educationLevel"]'));
    var profile = NT.store.get().profile || {};
    var queryLevel = NT.qs("level");
    var selectedLevel = D.EDUCATION_LEVELS.some(function (item) { return item.id === queryLevel; })
      ? queryLevel : profile.educationLevel;

    radios.forEach(function (radio) { radio.checked = radio.value === selectedLevel; });
    var codeFromLink = NT.qs("code");
    if (codeFromLink) input.value = codeFromLink.toUpperCase();

    var current = NT.store.get();
    if (current.access) {
      document.getElementById("currentAccess").classList.remove("hidden");
      document.getElementById("currentAccessBody").innerHTML =
        '<div class="kv">' +
        '<div class="row"><span>Active package</span><b>' + NT.esc(NT.packageDetails(current.access).name) + "</b></div>" +
        '<div class="row"><span>Learning level</span><b>' + NT.esc((NT.educationLevel(profile.educationLevel) || {}).label || "Not selected") + "</b></div>" +
        '<div class="row"><span>Lessons included</span><b>' + NT.availableFor(current.access) + " of " + NT.counts().total + "</b></div>" +
        "</div>";
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value.trim().toUpperCase();
      var choice = radios.filter(function (radio) { return radio.checked; })[0];
      msg.innerHTML = "";
      result.classList.add("hidden");
      if (!choice) {
        msg.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div><b>Choose your level.</b><br>Select High School or University before continuing.</div></div>";
        radios[0].focus();
        return;
      }
      if (!value) {
        msg.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div><b>Enter your access code.</b><br>Use the code provided for your package.</div></div>";
        input.focus();
        return;
      }
      var record = NT.store.findCode(value);
      if (!record || D.LEVELS.indexOf(record.pkg) === -1) {
        msg.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div><b>That code could not be found.</b><br>Check the code or return to the package preview to generate one on this device.</div></div>";
        input.focus();
        return;
      }
      if (record.status === "redeemed") {
        msg.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div><b>This code has already been used.</b><br>Each preview code can be redeemed once in this browser.</div></div>";
        input.focus();
        return;
      }

      NT.store.redeemCode(record.code);
      NT.store.mutate(function (state) {
        state.profile = Object.assign({ name: "", educationLevel: "", subjectId: "" }, state.profile || {});
        state.profile.educationLevel = choice.value;
      });
      NT.store.setAccess(record.pkg, { code: record.code, source: "access-code", educationLevel: choice.value });
      var level = NT.educationLevel(choice.value);
      result.classList.remove("hidden");
      result.innerHTML =
        '<div class="unlock-result">' +
        '<div class="big-ico">' + NT.icon("check-circle", "icon-xl") + "</div>" +
        "<h2>Access preview updated</h2>" +
        '<p class="access-line">' + NT.esc(level.label) + " pathway · " + NT.esc(NT.packageDetails(record.pkg).name) + " package</p>" +
        '<a class="btn btn-primary btn-lg" href="' + NT.base() + 'courses.html?level=' + encodeURIComponent(choice.value) + '">' +
        NT.icon("book-open") + "Continue to your courses</a></div>";
      form.classList.add("hidden");
      document.querySelector(".access-packages-link").classList.add("hidden");
      NT.toast("Learning level saved", "success");
    });
  }

  /* ============================ LIBRARY ============================ */
  function pageLibrary() {
    var root = document.getElementById("libRoot");
    var search = document.getElementById("libSearch");
    var statusHost = document.getElementById("libStatus");
    var summary = document.getElementById("libSummary");
    var chips = document.getElementById("activeFilters");
    var gate = document.getElementById("libGate");
    var course = NT.qs("course");
    if (!NT.course(course)) course = "";
    var status = "all";

    function lessonMarkup(lesson) {
      var unlocked = NT.isUnlocked(lesson);
      return '<li class="lib-lesson ' + (unlocked ? "is-open" : "is-locked") + '">' +
        '<span class="lib-index" aria-hidden="true">' + NT.esc(String(lesson.index == null ? "" : lesson.index).padStart(2, "0")) + "</span>" +
        '<span class="lib-state" aria-hidden="true">' + NT.icon(unlocked ? "book-open" : "lock") + "</span>" +
        '<span class="lib-lesson-title"><b>' + NT.esc(lesson.title) + "</b><small>" + D.LEVEL_LABEL[NT.levelOf(lesson)] + " access</small></span>" +
        '<span class="lib-lesson-action">' +
        (unlocked
          ? '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(lesson.id) + '">View lesson details</a>'
          : '<span class="requires">' + D.LEVEL_LABEL[NT.levelOf(lesson)] + " access required</span>") +
        "</span></li>";
    }

    function renderStatus() {
      var options = [{ id: "all", label: "All" }, { id: "open", label: "Available" }, { id: "locked", label: "Locked" }];
      statusHost.innerHTML = options.map(function (option) {
        var active = status === option.id;
        return '<button type="button" data-status="' + option.id + '" class="' + (active ? "active" : "") +
          '" aria-pressed="' + active + '">' + option.label + "</button>";
      }).join("");
      statusHost.querySelectorAll("[data-status]").forEach(function (button) {
        button.addEventListener("click", function () { status = button.dataset.status; render(); });
      });
    }

    function renderChips() {
      chips.innerHTML = course
        ? '<span class="filter-chip">' + NT.esc(NT.course(course).title) +
          '<button type="button" id="clearCourse" aria-label="Show every course">' + NT.icon("x") + "</button></span>"
        : "";
      var clear = document.getElementById("clearCourse");
      if (clear) clear.addEventListener("click", function () { course = ""; render(); });
      chips.classList.toggle("hidden", !chips.innerHTML);
    }

    function render() {
      var access = NT.store.get().access;
      var query = search.value.trim().toLowerCase();
      var all = NT.allLessons();
      var sections = D.COURSES.map(function (courseRecord) {
        var lessons = NT.courseLessons(courseRecord.id).filter(function (lesson) {
          if (course && lesson.courseId !== course) return false;
          if (status === "open" && !NT.isUnlocked(lesson)) return false;
          if (status === "locked" && NT.isUnlocked(lesson)) return false;
          return !query || (lesson.title + " " + lesson.courseTitle).toLowerCase().indexOf(query) !== -1;
        });
        if (!lessons.length) return "";
        var included = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); }).length;
        return '<section class="lib-course reveal"><header class="lib-course-head">' +
          '<span class="course-icon" style="--tint:' + courseRecord.tint + ";--tint-fg:" + courseRecord.tintFg + '">' + NT.icon(courseRecord.icon) + "</span>" +
          '<div><h2><a href="' + NT.base() + "course.html?id=" + encodeURIComponent(courseRecord.id) + '">' + NT.esc(courseRecord.title) + "</a></h2>" +
          "<p>" + lessons.length + " lesson" + (lessons.length === 1 ? "" : "s") + (access ? " · " + included + " available" : "") + "</p></div></header>" +
          '<ul class="lib-lessons">' + lessons.map(lessonMarkup).join("") + "</ul></section>";
      }).filter(Boolean);

      root.innerHTML = sections.length ? sections.join("") : '<p class="lib-empty">No lessons match your search or filter.</p>';
      var available = all.filter(function (lesson) { return NT.isUnlocked(lesson); }).length;
      summary.textContent = access
        ? available + " of " + all.length + " listed lessons are included with your " + NT.packageDetails(access).name + " package in this preview."
        : "Enter an access code to see which listed lessons your package includes in this preview.";
      renderStatus();
      renderChips();
      gate.classList.toggle("hidden", !!access);
      NT.initReveal();
    }

    search.addEventListener("input", render);
    render();
  }

  /* ============================ SEARCH ============================ */
  function publishedAnnouncements() {
    return (NT.store.get().announcements || []).filter(function (notice) {
      return notice && notice.status === "published";
    }).sort(function (a, b) {
      return new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0);
    });
  }

  function pageSearch() {
    var input = document.getElementById("globalSearchInput");
    var results = document.getElementById("searchResults");
    var summary = document.getElementById("searchSummary");
    var tabs = document.querySelectorAll("[data-search-kind]");
    var kind = NT.qs("type") || "all";
    var validKinds = ["all", "courses", "lessons"];
    if (validKinds.indexOf(kind) === -1) kind = "all";
    input.value = NT.qs("q") || "";

    function normal(value) { return String(value || "").toLowerCase().trim(); }
    function matches(fields, query) {
      if (!query) return false;
      return fields.join(" ").toLowerCase().indexOf(query) !== -1;
    }
    function courseResult(course) {
      var lessons = NT.courseLessons(course.id);
      return '<article class="search-result">' +
        '<span class="search-result-icon" style="--tint:' + course.tint + ";--tint-fg:" + course.tintFg + '">' + NT.icon(course.icon) + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>Course</span></div>' +
        "<h3>" + NT.esc(course.title) + "</h3><p>" + NT.esc(course.desc) + "</p>" +
        "<small>" + lessons.length + " lessons · " + NT.esc(NT.coursePathwayNames(course)) + "</small></div>" +
        '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "course.html?id=" + encodeURIComponent(course.id) + '">View course</a></article>';
    }
    function lessonResult(lesson) {
      var course = NT.course(lesson.courseId) || { tint: "var(--bg-soft)", tintFg: "var(--ink-2)" };
      var unlocked = NT.isUnlocked(lesson);
      return '<article class="search-result">' +
        '<span class="search-result-icon" style="--tint:' + course.tint + ";--tint-fg:" + course.tintFg + '">' + NT.icon("book-open") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>Lesson</span><span>' + NT.esc(lesson.courseTitle) + "</span></div>" +
        "<h3>" + NT.esc(lesson.title) + "</h3>" +
        "<small>" + NT.esc(D.LEVEL_LABEL[NT.levelOf(lesson)]) + " lesson</small></div>" +
        (unlocked
          ? '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(lesson.id) + '">View lesson details</a>'
          : '<a class="btn btn-secondary btn-sm" href="' + NT.base() + 'pricing.html">View packages</a>') +
        "</article>";
    }
    function announcementResult(notice) {
      return '<article class="search-result">' +
        '<span class="search-result-icon">' + NT.icon("bell") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>Announcement</span><span>' + NT.fmtDate(notice.updated || notice.created) + "</span></div>" +
        "<h3>" + NT.esc(notice.title) + "</h3><p>" + NT.esc(notice.body) + "</p></div>" +
        '<a class="search-result-link" href="' + NT.base() + 'announcements.html" aria-label="Read announcement">' + NT.icon("arrow-up-right") + "</a></article>";
    }
    function syncUrl(query) {
      if (!window.history || !window.history.replaceState) return;
      try {
        var url = new URL(window.location.href);
        if (query) url.searchParams.set("q", query);
        else url.searchParams.delete("q");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      } catch (e) { /* file:// previews cannot rewrite history */ }
    }
    function render() {
      var query = normal(input.value);
      syncUrl(input.value.trim());
      tabs.forEach(function (tab) {
        var active = tab.dataset.searchKind === kind;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", String(active));
      });
      if (!query) {
        summary.textContent = "Search the course and lesson catalogue.";
        var chips = D.SUBJECTS.map(function (item) {
          return '<button class="search-suggestion" type="button" data-suggestion="' + NT.esc(item.title) + '">' + NT.icon(item.icon) + NT.esc(item.title) + "</button>";
        }).join("");
        results.innerHTML = '<div class="search-start"><span class="search-start-icon">' + NT.icon("search", "icon-lg") + '</span><h2>Search the catalogue</h2>' +
          "<p>Course names, subjects and lesson titles. Search the course and lesson catalogue.</p>" +
          '<div class="search-suggestions"><span>Browse a subject</span>' + chips + "</div></div>";
        results.querySelectorAll("[data-suggestion]").forEach(function (button) {
          button.addEventListener("click", function () { input.value = button.dataset.suggestion; render(); input.focus(); });
        });
        return;
      }

      var courses = D.COURSES.filter(function (course) {
        var lessonTitles = NT.courseLessons(course.id).map(function (lesson) { return lesson.title; }).join(" ");
        var paths = NT.coursePathways(course).map(NT.pathwayLabel).join(" ");
        return matches([course.title, course.desc, lessonTitles, paths], query);
      });
      var lessons = NT.allLessons().filter(function (lesson) {
        var course = NT.course(lesson.courseId) || {};
        return matches([lesson.title, lesson.courseTitle, lesson.description, course.desc], query);
      });
      var notices = publishedAnnouncements().filter(function (notice) {
        return matches([notice.title, notice.body], query);
      });
      var count = (kind === "courses" ? courses.length : 0) +
        (kind === "lessons" ? lessons.length : 0) +
        (kind === "all" ? courses.length + lessons.length + notices.length : 0);
      summary.textContent = count + " result" + (count === 1 ? "" : "s") + " for “" + input.value.trim() + "”";
      var parts = [];
      if (courses.length && (kind === "all" || kind === "courses")) {
        parts.push('<section class="search-result-section"><div class="search-section-heading"><h2>Courses</h2><span>' + courses.length + "</span></div>" + courses.map(courseResult).join("") + "</section>");
      }
      if (lessons.length && (kind === "all" || kind === "lessons")) {
        parts.push('<section class="search-result-section"><div class="search-section-heading"><h2>Lessons</h2><span>' + lessons.length + "</span></div>" + lessons.map(lessonResult).join("") + "</section>");
      }
      if (notices.length && kind === "all") {
        parts.push('<section class="search-result-section"><div class="search-section-heading"><h2>Announcements</h2><span>' + notices.length + "</span></div>" + notices.map(announcementResult).join("") + "</section>");
      }
      results.innerHTML = parts.length ? parts.join("") :
        '<div class="search-empty"><span class="search-start-icon">' + NT.icon("search", "icon-lg") + "</span><h2>No matching results</h2>" +
        "<p>Try another course, subject or lesson title.</p>" +
        '<a class="link-arrow" href="' + NT.base() + 'courses.html">Browse the course catalogue ' + NT.icon("arrow-right", "icon-sm") + "</a></div>";
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { kind = tab.dataset.searchKind; render(); });
    });
    input.addEventListener("input", render);
    render();
  }

  /* ============================ ANNOUNCEMENTS ============================ */
  function pageAnnouncements() {
    var root = document.getElementById("announcementsRoot");
    var items = publishedAnnouncements();
    if (!items.length) {
      root.innerHTML = '<div class="announcement-empty"><h2>No announcements yet</h2>' +
        "<p class=\"muted\">There are no published announcements.</p>" +
        '<a class="btn btn-secondary" style="margin-top:20px" href="' + NT.base() + 'courses.html">Browse courses' + NT.icon("arrow-right", "icon-sm") + "</a></div>";
      return;
    }
    root.innerHTML = '<div class="announcement-list">' + items.map(function (notice) {
      var body = NT.esc(notice.body || "").replace(/\n/g, "<br>");
      return '<article class="announcement-item">' +
        '<div class="announcement-item-date">' + NT.fmtDate(notice.updated || notice.created) + "</div>" +
        '<div class="announcement-item-body"><h2>' + NT.esc(notice.title) + "</h2><p>" + body + "</p></div></article>";
    }).join("") + "</div>";
  }

  /* ============================ PROFILE ============================ */
  function pageProfile() {
    var form = document.getElementById("profileForm");
    var level = document.getElementById("profileEducationLevel");
    var subject = document.getElementById("profileSubject");
    var notice = document.getElementById("profileSaveMessage");
    var saved = Object.assign({ name: "", educationLevel: "", subjectId: "" }, NT.store.get().profile || {});

    level.innerHTML = '<option value="">Choose a level</option>' + D.EDUCATION_LEVELS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.label) + "</option>";
    }).join("");
    subject.innerHTML = '<option value="">No subject selected</option>' + D.SUBJECTS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.title) + "</option>";
    }).join("");
    document.getElementById("profileName").value = saved.name || "";
    level.value = saved.educationLevel || "";
    subject.value = saved.subjectId || "";

    function renderSummary(profile) {
      var access = NT.store.get().access;
      var levelInfo = NT.educationLevel(profile.educationLevel);
      var path = levelInfo ? levelInfo.label : "No level selected";
      document.getElementById("profileSummary").innerHTML =
        '<div class="profile-summary-identity"><span class="profile-avatar">' + NT.icon("circle-user", "icon-lg") + "</span><div>" +
        "<small>Learning profile · this device</small><b>" + NT.esc(profile.name || "Learner") + "</b><span>" + NT.esc(path) + "</span></div></div>" +
        '<div class="profile-summary-details"><span><small>Subject</small><b>' + NT.esc((NT.subject(profile.subjectId) || {}).title || "Not selected") + "</b></span>" +
        '<span><small>Access package</small><b>' + (access ? NT.esc(NT.packageDetails(access).name) + " · Active" : "No active package") + "</b></span></div>";
      var params = new URLSearchParams();
      if (profile.educationLevel) params.set("level", profile.educationLevel);
      if (profile.subjectId) params.set("subject", profile.subjectId);
      document.getElementById("profileBrowseCourses").href = NT.base() + "courses.html" + (params.toString() ? "?" + params.toString() : "");
    }
    renderSummary(saved);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var profile = {
        name: document.getElementById("profileName").value.trim().slice(0, 60),
        educationLevel: level.value,
        subjectId: subject.value
      };
      NT.store.mutate(function (state) {
        state.profile = Object.assign({}, state.profile || {}, profile);
      });
      notice.innerHTML = NT.icon("check-circle", "icon-sm") + " Preferences saved on this device.";
      renderSummary(profile);
      NT.toast("Learning preferences saved", "success");
    });
  }

  /* ============================ DASHBOARD ============================ */
  function pageDashboard() {
    var state = NT.store.get();
    var root = document.getElementById("dashRoot");
    var profile = state.profile || {};
    var level = NT.educationLevel(profile.educationLevel);

    if (!state.access) {
      root.innerHTML = '<div class="dashboard-empty"><h1>Log in to continue.</h1>' +
        '<p>Choose High School or University, then enter your access code to open your course list.</p>' +
        '<a class="btn btn-primary" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Log in with an access code</a></div>";
      return;
    }

    var path = level ? level.label : "No learning level selected";
    var courseUrl = NT.base() + "courses.html" + (profile.educationLevel ? "?level=" + encodeURIComponent(profile.educationLevel) : "");
    var meta = state.accessMeta || {};
    var since = meta.since ? new Date(meta.since) : null;
    var expiry = since && !isNaN(since.getTime())
      ? NT.fmtDate(new Date(since.getTime() + state.settings.days * 86400000).toISOString())
      : "";

    root.innerHTML =
      '<div class="dashboard-page">' +
      '<header class="dashboard-heading"><div><span class="eyebrow">Your learning</span>' +
      '<h1>' + (profile.name ? "Welcome, " + NT.esc(profile.name) + "." : "Welcome back.") + "</h1>" +
      '<p>' + NT.esc(NT.packageDetails(state.access).name) + " package · " + NT.esc(path) +
      (expiry ? " · Access until " + expiry : "") + "</p></div>" +
      '<a class="btn btn-secondary btn-sm" href="' + NT.base() + 'profile.html">' + NT.icon("settings") + "Edit preferences</a></header>" +
      '<section class="card dashboard-continue"><div class="dashboard-continue-copy">' +
      '<span class="eyebrow">Course catalogue</span><h2>Continue to your courses</h2>' +
      '<p>Your course list opens in the ' + NT.esc(path) + " pathway. You can change this any time in your profile.</p>" +
      '<a class="btn btn-primary" href="' + courseUrl + '">' + NT.icon("book-open") + "Browse courses</a></div></section>" +
      "</div>";
  }

  /* ============================ LESSON ============================ */
  function pageLesson() {
    var id = NT.qs("id") || "";
    var lesson = NT.lesson(id);
    var root = document.getElementById("lessonRoot");
    if (!lesson) {
      root.innerHTML = '<div class="card lesson-notice"><h1>Lesson not found</h1><a class="btn btn-secondary" href="' + NT.base() + 'courses.html">Browse courses</a></div>';
      return;
    }
    var course = NT.course(lesson.courseId);
    if (!course) {
      root.innerHTML = '<div class="card lesson-notice"><h1>Course not found</h1><a class="btn btn-secondary" href="' + NT.base() + 'courses.html">Browse courses</a></div>';
      return;
    }
    document.title = lesson.title + " — Nuclear Tutorials";
    var crumbs = '<div class="crumbs"><a href="' + NT.base() + 'index.html">Home</a> ' + NT.icon("chevron-right", "icon-sm") +
      ' <a href="' + NT.base() + 'courses.html">Courses</a> ' + NT.icon("chevron-right", "icon-sm") +
      ' <a href="' + NT.base() + "course.html?id=" + encodeURIComponent(course.id) + '">' + NT.esc(course.title) + "</a> " +
      NT.icon("chevron-right", "icon-sm") + " <span>" + NT.esc(lesson.title) + "</span></div>";
    if (!NT.isUnlocked(lesson)) {
      root.innerHTML = crumbs + '<div class="card lesson-notice lesson-gate"><span class="badge badge-' + NT.levelOf(lesson) + '">' +
        NT.icon("lock") + D.LEVEL_LABEL[NT.levelOf(lesson)] + " access required</span>" +
        '<h1>' + NT.esc(lesson.title) + "</h1><p>This lesson is included with the " + NT.esc(D.LEVEL_LABEL[NT.levelOf(lesson)]) + " package or above.</p>" +
        '<div class="lesson-notice-actions"><a class="btn btn-primary" href="' + NT.base() + 'pricing.html">View packages</a>' +
        '<a class="btn btn-secondary" href="' + NT.base() + 'access.html">Log in with a code</a></div></div>';
      return;
    }
    root.innerHTML = crumbs + '<article class="card lesson-notice">' +
      '<span class="eyebrow">' + NT.esc(course.title) + " · " + D.LEVEL_LABEL[NT.levelOf(lesson)] + "</span>" +
      '<h1>' + NT.esc(lesson.title) + "</h1>" +
      '<p>Lesson materials are not hosted in this preview. This page shows the lesson title and its package access level.</p>' +
      '<a class="btn btn-secondary" href="' + NT.base() + "course.html?id=" + encodeURIComponent(course.id) + '">' + NT.icon("arrow-left") + "Back to course</a></article>";
  }

  /* ============================ ACCESS-CODE PREVIEW ============================ */
  function pageCheckout() {
    var pkg = NT.qs("pkg");
    var root = document.getElementById("checkoutRoot");
    var p = D.PACKAGES[pkg] ? NT.packageDetails(pkg) : null;

    if (!p) {
      root.innerHTML = '<div class="card card-pad checkout-empty"><h2>Choose a package first</h2>' +
        '<a class="btn btn-primary" href="' + NT.base() + 'pricing.html">View packages</a></div>';
      return;
    }

    root.innerHTML = '<div class="card card-pad checkout-preview-card">' +
      '<span class="eyebrow">Preview only</span><h2>' + NT.esc(p.name) + " package</h2>" +
      '<div class="checkout-summary"><div><span>Preview price</span><b>' + NT.kwacha(NT.packagePrice(pkg)) + "</b></div>" +
      "<div><span>Access period</span><b>" + NT.store.get().settings.days + " days</b></div>" +
      "<div><span>Lessons included</span><b>" + NT.availableFor(pkg) + " of " + NT.counts().total + "</b></div></div>" +
      '<p class="muted">This preview does not process payments. Generate a local code to try the access flow on this device.</p>' +
      '<button class="btn btn-primary btn-lg" type="button" id="generateCode">Generate preview access code</button>' +
      '<div id="checkoutResult" class="checkout-result hidden" aria-live="polite"></div>' +
      '<a class="link-arrow checkout-back" href="' + NT.base() + 'pricing.html">Back to access packages ' + NT.icon("arrow-right", "icon-sm") + "</a>" +
      "</div>";

    document.getElementById("generateCode").addEventListener("click", function (event) {
      var button = event.currentTarget;
      var code = "";
      for (var attempt = 0; attempt < 10; attempt++) {
        code = NT.store.genCode(pkg);
        if (!NT.store.findCode(code)) break;
      }
      NT.store.addCode(code, pkg, "unused");
      var result = document.getElementById("checkoutResult");
      result.classList.remove("hidden");
      result.innerHTML = '<p>Your code is stored in this browser. It is not a receipt or a payment confirmation.</p>' +
        '<code class="preview-code">' + NT.esc(code) + "</code>" +
        '<div class="lesson-notice-actions"><button class="btn btn-secondary" type="button" id="copyPreviewCode">' + NT.icon("copy") + "Copy code</button>" +
        '<a class="btn btn-primary" href="' + NT.base() + 'access.html?code=' + encodeURIComponent(code) + '">Continue to login</a></div>';
      button.disabled = true;
      button.textContent = "Code generated";
      document.getElementById("copyPreviewCode").addEventListener("click", function () {
        NT.copy(code);
      });
    });
  }

  /* ============================ router ============================ */
  var routes = {
    home: pageHome, courses: pageCourses, course: pageCourse, pricing: pagePricing,
    access: pageAccess, library: pageLibrary, search: pageSearch, announcements: pageAnnouncements,
    profile: pageProfile, dashboard: pageDashboard, lesson: pageLesson, checkout: pageCheckout
  };

  document.addEventListener("DOMContentLoaded", function () {
    NT.renderHeader();
    NT.renderFooter();
    var page = document.body.dataset.page;
    if (routes[page]) routes[page]();
    NT.initReveal();
  });
})();
