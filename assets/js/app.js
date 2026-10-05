/* ============================================================
   NUCLEAR TUTORIALS — Public site behaviour
   Routing by <body data-page="...">
   ============================================================ */
(function () {
  var D = NT.data;

  /* ============================ shared renderers ============================ */

  /* Access packages: price, what it unlocks, and the three features that differ. */
  NT.renderPricingCards = function (el) {
    var s = NT.store.get();
    var total = NT.counts().total;
    el.innerHTML = D.LEVELS.map(function (id) {
      var p = NT.packageDetails(id);
      var current = s.access === id;
      /* The access period is already shown next to the price. */
      var feats = p.features.filter(function (f) {
        return String(f).toLowerCase().indexOf("days of access") === -1;
      }).map(function (f) {
        return "<li>" + NT.icon("check") + "<span>" + NT.esc(f) + "</span></li>";
      }).join("");
      var actionClass = p.popular ? "btn-primary" : (id === "premium" ? "btn-dark" : "btn-secondary");
      return '<article class="price-card price-' + id + (p.popular ? " popular" : "") + ' reveal" data-delay="' + D.LEVELS.indexOf(id) + '">' +
        (p.popular ? '<span class="popular-tag">Most popular</span>' : "") +
        '<span class="price-name t-' + id + '">' + NT.esc(p.name) + "</span>" +
        '<div class="price-amount"><b>' + NT.kwacha(NT.packagePrice(id)) + "</b><span>/ " + s.settings.days + " days</span></div>" +
        '<p class="price-desc">' + NT.esc(p.tagline) + "</p>" +
        '<div class="price-unlocks"><b>' + NT.availableFor(id) + "</b><span>of " + total + " lessons included</span></div>" +
        '<ul class="price-feats">' + feats + "</ul>" +
        (current
          ? '<button class="btn btn-secondary btn-block" disabled>' + NT.icon("check-circle") + "Current package</button>"
          : '<a class="btn ' + actionClass + ' btn-block" href="' + NT.base() + 'checkout.html?pkg=' + id + '">Get access</a>') +
        "</article>";
    }).join("");
  };

  function courseProgress(course) {
    var state = NT.store.get();
    if (!state.access) return null;
    var lessons = NT.courseLessons(course.id);
    var unlocked = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); });
    if (!unlocked.length) return null;
    var done = unlocked.filter(function (lesson) { return NT.store.isComplete(lesson.id); }).length;
    var hasStarted = done > 0 || (state.recentLessons || []).some(function (id) {
      return lessons.some(function (lesson) { return lesson.id === id; });
    });
    return hasStarted ? { done: done, total: unlocked.length, pct: Math.round((done / unlocked.length) * 100) } : null;
  }

  /* Wording for education pathways lives in ui.js so every page cannot drift apart. */
  function coursePathwayLabel(path) { return NT.pathwayLabel(path); }

  /* One course card: visual, name, pathway, short description, lesson count,
     and a single action that opens the course's own page. */
  NT.renderCourseCard = function (course) {
    var lessons = NT.courseLessons(course.id);
    var state = NT.store.get();
    var unlocked = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); });
    var meta = lessons.length + (lessons.length === 1 ? " lesson" : " lessons") + " · " + NT.courseDuration(course.id);
    var stateHtml = "";
    if (state.access && unlocked.length) {
      var done = unlocked.filter(function (lesson) { return NT.store.isComplete(lesson.id); }).length;
      var pct = Math.round((done / unlocked.length) * 100);
      var cls = done === unlocked.length ? "is-done" : done > 0 ? "is-progress" : "is-open";
      var ico = done === unlocked.length ? "circle-check" : done > 0 ? "trending-up" : "unlock";
      var label = done === unlocked.length ? "Completed" : done > 0 ? done + " of " + unlocked.length + " complete" : unlocked.length + " unlocked";
      stateHtml = '<span class="course-card-state ' + cls + '">' + NT.icon(ico) + NT.esc(label) + "</span>";
      meta = lessons.length + (lessons.length === 1 ? " lesson" : " lessons") + " · " + pct + "%";
    } else if (state.access) {
      stateHtml = '<span class="course-card-state is-locked">' + NT.icon("lock") + "Upgrade needed</span>";
    }
    var href = NT.base() + "course.html?id=" + encodeURIComponent(course.id);
    return '<article class="course-card reveal" data-delay="' + (D.COURSES.indexOf(course) % 3) + '" id="' + NT.esc(course.id) + '">' +
      '<a class="course-card-media" href="' + href + '" tabindex="-1" aria-hidden="true" style="--thumb-bg:' + course.thumb + '">' + NT.thumbArt(course) +
      '<span class="course-media-tag">' + NT.esc(NT.coursePathwayNames(course, "high-school") || "High School") + "</span>" +
      '<span class="course-play">' + NT.icon("play") + "</span>" +
      '<span class="course-icon" style="--tint:' + course.tint + ";--tint-fg:" + course.tintFg + '">' + NT.icon(course.icon) + "</span></a>" +
      '<div class="course-card-body">' +
      '<div class="course-card-top"><span class="course-subject">' + NT.esc((NT.subject(course.subjectId) || {}).title || course.title) + "</span>" +
      stateHtml + "</div>" +
      "<h3>" + '<a href="' + href + '">' + NT.esc(course.title) + "</a></h3>" +
      '<p class="course-path">' + NT.icon(NT.pathwayIcon("high-school"), "icon-sm") + NT.esc(NT.coursePathwayNames(course)) + "</p>" +
      '<p class="desc">' + NT.esc(course.desc) + "</p>" +
      '<div class="course-card-foot"><span class="course-card-meta">' + NT.icon("play-circle", "icon-sm") + NT.esc(meta) + "</span>" +
      '<a class="btn btn-secondary btn-sm" href="' + href + '">View course' + NT.icon("arrow-right", "icon-sm") + "</a>" +
      "</div>" +
      "</div></article>";
  };

  function lessonRow(l, showCourse) {
    var unlocked = NT.isUnlocked(l);
    var done = NT.store.isComplete(l.id);
    var course = NT.course(l.courseId) || {};
    return '<div class="list-row">' +
      '<div class="lico" style="background:' + (course.tint || "var(--bg-soft)") + ";color:" + (course.tintFg || "var(--ink-2)") + '">' +
      NT.icon(done ? "circle-check" : unlocked ? "play-circle" : "lock") + "</div>" +
      '<div class="grow"><b>' + NT.esc(l.title) + "</b><small>" +
      (showCourse ? NT.esc(l.courseTitle) + " · " : "") + NT.esc(l.duration) + " · " + D.LEVEL_LABEL[NT.levelOf(l)] +
      (done ? " · Completed" : "") + "</small></div>" +
      (unlocked
        ? '<a class="btn btn-sm btn-secondary" href="' + NT.base() + "lesson.html?id=" + l.id + '">' + (done ? "Review" : "Watch") + "</a>"
        : '<span class="requires">' + D.LEVEL_LABEL[NT.levelOf(l)] + " required</span>") +
      "</div>";
  }

  /* ============================ HOME ============================ */

  /* Choose what you study → get access → start learning. Nothing else. */
  function pageHome() {
    var popular = document.getElementById("courseGrid");
    if (popular) popular.innerHTML = D.COURSES.slice(0, 3).map(NT.renderCourseCard).join("");
    NT.initReveal();

    var days = document.getElementById("accessDays");
    if (days) days.textContent = NT.store.get().settings.days;

    var list = document.getElementById("accessList");
    if (list) {
      list.innerHTML = D.LEVELS.map(function (id) {
        var p = NT.packageDetails(id);
        return '<a class="access-row" href="' + NT.base() + 'pricing.html">' +
          "<b>" + NT.esc(p.name) + "</b>" +
          '<span class="access-price">' + NT.kwacha(NT.packagePrice(id)) + "</span>" +
          "<small>" + NT.esc(p.tagline) + "</small></a>";
      }).join("");
    }
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
    var subject = NT.qs("subject");
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
        button.addEventListener("click", function () { level = button.dataset.pathway; render(); });
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

  /* ============================ INDIVIDUAL COURSE ============================
     A course is its own learning environment: identity band with progress and
     the next action, what you'll learn, the full lesson list with live access
     states, and exactly what each package opens here. */
  function pageCourse() {
    var id = NT.qs("id") || NT.qs("course") || "";
    var course = NT.course(id) || D.COURSES[0];
    var root = document.getElementById("courseRoot");
    var lessons = NT.courseLessons(course.id);
    var state = NT.store.get();
    var unlocked = lessons.filter(function (l) { return NT.isUnlocked(l); });
    var done = unlocked.filter(function (l) { return NT.store.isComplete(l.id); }).length;
    var started = done > 0 || (state.recentLessons || []).some(function (rid) {
      return lessons.some(function (l) { return l.id === rid; });
    });
    var pct = unlocked.length ? Math.round((done / unlocked.length) * 100) : 0;
    var next = unlocked.filter(function (l) { return !NT.store.isComplete(l.id); })[0] || unlocked[0];
    var first = lessons[0];
    var ranges = NT.tierRange(course.id);

    document.title = course.title + " — Nuclear Tutorials";

    var primaryCta = state.access && next
      ? '<a class="btn btn-primary btn-lg" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(next.id) + '">' +
        NT.icon("play") + (started ? "Continue learning" : "Start learning") + "</a>"
      : '<a class="btn btn-primary btn-lg" href="' + NT.base() + 'pricing.html">' + NT.icon("unlock") + "Get access</a>";
    var secondaryCta = state.access
      ? '<a class="btn btn-outline-light btn-lg" href="' + NT.base() + "library.html?course=" + encodeURIComponent(course.id) + '">' + NT.icon("library") + "Open in library</a>"
      : '<a class="btn btn-outline-light btn-lg" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Redeem a code</a>";

    var progressHtml = state.access && unlocked.length && started
      ? '<div class="course-hero-progress"><div class="progress-row"><span style="white-space:nowrap">Your progress</span>' +
        '<div class="progress"><i style="width:' + pct + '%"></i></div><span>' + pct + "%</span></div></div>"
      : "";

    var hero =
      '<section class="course-hero"><div class="container">' +
      '<div class="crumbs"><a href="' + NT.base() + 'index.html">Home</a>' + NT.icon("chevron-right", "icon-sm") +
      '<a href="' + NT.base() + 'courses.html">Courses</a>' + NT.icon("chevron-right", "icon-sm") +
      "<span>" + NT.esc(course.title) + "</span></div>" +
      '<div class="course-hero-grid">' +
      "<div>" +
      '<div class="course-hero-ident"><span class="course-hero-icon">' + NT.icon(course.icon) + "</span>" +
      '<span class="course-hero-path">' + NT.esc(NT.coursePathwayNames(course)) + "</span></div>" +
      "<h1>" + NT.esc(course.title) + "</h1>" +
      '<p class="course-hero-desc">' + NT.esc(course.desc) + "</p>" +
      '<div class="course-meta-row">' +
      "<span>" + NT.icon("play-circle") + "<span class='mono'>" + lessons.length + "</span> lessons</span>" +
      "<span>" + NT.icon("clock") + NT.esc(NT.courseDuration(course.id)) + " of video</span>" +
      "<span>" + NT.icon(NT.pathwayIcon("high-school")) + NT.esc(NT.pathwayShort(NT.coursePathway(course, "high-school")) || "High School") + "</span>" +
      (state.access ? "<span>" + NT.icon("unlock") + "<span class='mono'>" + unlocked.length + "</span> unlocked for you</span>" : "") +
      "</div>" +
      '<div class="course-hero-actions">' + primaryCta + secondaryCta + "</div>" +
      progressHtml +
      "</div>" +
      '<aside class="course-hero-card" aria-hidden="true">' +
      '<div class="course-hero-art" style="--thumb-bg:' + course.thumb + '">' + NT.thumbArt(course) +
      '<span class="play">' + NT.icon("play", "icon-lg") + "</span></div>" +
      '<div class="course-hero-card-body"><b>' + NT.esc(first.title) + "</b>" +
      "<small>Lesson 1 of " + lessons.length + " · " + NT.esc(first.duration) + " · " + D.LEVEL_LABEL[NT.levelOf(first)] + "</small></div>" +
      "</aside>" +
      "</div></div></section>";

    /* What you'll learn — the three honest outcomes this course delivers. */
    var learn =
      '<section class="section section-tight"><div class="container">' +
      '<div class="section-head"><span class="eyebrow eyebrow-orbit">What you\'ll learn</span>' +
      "<h2>Three levels of depth in one course</h2>" +
      "<p>Every course is taught from the ground up, then taken to exam depth and beyond. Your package decides how far you go.</p></div>" +
      '<div class="learn-points">' +
      D.LEVELS.map(function (level, i) {
        return '<article class="learn-point t-' + level + ' reveal" data-delay="' + i + '">' +
          '<span class="tier">' + NT.icon(level === "premium" ? "sparkles" : level === "standard" ? "trending-up" : "book-open") + D.LEVEL_LABEL[level] + "</span>" +
          "<p>" + NT.esc(NT.LEVEL_BLURB[level]) + "</p></article>";
      }).join("") +
      "</div></div></section>";

    /* The lesson list, with live access + completion states. */
    function lessonRow(l) {
      var un = NT.isUnlocked(l);
      var isDone = NT.store.isComplete(l.id);
      var cls = isDone ? "is-complete" : un ? "is-open" : "is-locked";
      var ico = isDone ? "circle-check" : un ? "play-circle" : "lock";
      var num = String(l.index).padStart(2, "0");
      return '<li class="lib-lesson ' + cls + '">' +
        '<span class="lib-index" aria-hidden="true">' + num + "</span>" +
        '<span class="lib-state" aria-hidden="true">' + NT.icon(ico) + "</span>" +
        '<span class="lib-lesson-title"><b>' + NT.esc(l.title) + "</b><small>" + NT.esc(l.duration) + " · " + D.LEVEL_LABEL[NT.levelOf(l)] + " lesson" + (isDone ? " · Completed" : "") + "</small></span>" +
        '<span class="lib-lesson-action">' +
        (un
          ? '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(l.id) + '">' + (isDone ? "Review" : "Watch") + "</a>"
          : '<span class="requires">' + D.LEVEL_LABEL[NT.levelOf(l)] + " required</span>") +
        "</span></li>";
    }
    var list =
      '<section class="section section-alt"><div class="container">' +
      '<div class="section-head section-head-row"><div>' +
      '<span class="eyebrow eyebrow-orbit">Course contents</span>' +
      "<h2>Every lesson, in order</h2>" +
      "<p>Lessons build on each other from the first principle to the hardest paper.</p></div>" +
      (next ? '<a class="link-arrow" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(next.id) + '">' +
        (started ? "Continue where you left off" : "Start with lesson 1") + NT.icon("arrow-right", "icon-sm") + "</a>" : "") +
      "</div>" +
      '<ul class="lib-lessons course-lessons">' + lessons.map(lessonRow).join("") + "</ul>" +
      "</div></section>";

    /* Access requirement for this specific course. */
    var access =
      '<section class="section"><div class="container">' +
      '<div class="section-head"><span class="eyebrow eyebrow-orbit">Access requirement</span>' +
      "<h2>What each package opens here</h2>" +
      "<p>The same three packages apply to every course. This is exactly how much of " + NT.esc(course.title) + " each one unlocks.</p></div>" +
      '<div class="tier-strip">' +
      D.LEVELS.map(function (level) {
        var r = ranges[level];
        var current = state.access === level;
        return '<div class="tier-cell tc-' + level + (current ? " is-current" : "") + '">' +
          '<span class="name"><span class="dot"></span>' + D.LEVEL_LABEL[level] + (current ? " · your package" : "") + "</span>" +
          '<span class="what">' + (r ? "Lessons <span class='mono'>" + r.from + "–" + r.to + "</span>" : "No lessons") + "</span>" +
          "<small>" + (r ? r.count + " of " + lessons.length + " lessons · " + NT.kwacha(NT.packagePrice(level)) : "") + "</small>" +
          "</div>";
      }).join("") +
      "</div>" +
      '<p class="muted small" style="margin-top:16px">' +
      (state.access
        ? "You're on " + NT.esc(NT.packageDetails(state.access).name) + ". " +
          (unlocked.length < lessons.length
            ? '<a href="' + NT.base() + 'pricing.html">Compare packages to unlock the rest.</a>'
            : "This course is fully unlocked for you.")
        : 'Choose a package or redeem an access code to start watching. <a href="' + NT.base() + 'pricing.html">Compare packages</a>.') +
      "</p></div></section>";

    root.innerHTML = hero + learn + list + access;
  }

  /* ============================ PRICING ============================ */
  function pagePricing() {
    NT.renderPricingCards(document.getElementById("pricingGrid"));
    var yes = '<span class="yes">' + NT.icon("check") + "</span>";
    var no = '<span class="no">' + NT.icon("x", "icon-sm") + "</span>";
    var days = NT.store.get().settings.days;
    var total = NT.counts().total;
    document.getElementById("cmpHead").innerHTML = "<tr><th>What you get</th>" + D.LEVELS.map(function (level) {
      return "<th>" + NT.esc(NT.packageDetails(level).name) + " · " + NT.kwacha(NT.packagePrice(level)) + "</th>";
    }).join("") + "</tr>";
    var rows = [
      ["Lessons included", D.LEVELS.map(function (level) { return "<b>" + NT.availableFor(level) + "</b> of " + total; })],
      ["Basic lessons in every course", [yes, yes, yes]],
      ["Standard lessons in every course", [no, yes, yes]],
      ["Premium advanced lessons", [no, no, yes]],
      ["Progress tracking", [no, yes, yes]],
      ["New videos as they are released", [no, no, yes]],
      ["Access period", [days + " days", days + " days", days + " days"]]
    ];
    document.getElementById("cmpBody").innerHTML = rows.map(function (row) {
      return '<tr><td data-label="What you get">' + row[0] + "</td>" + row[1].map(function (cell, index) {
        return '<td data-label="' + NT.esc(NT.packageDetails(D.LEVELS[index]).name) + '">' + cell + "</td>";
      }).join("") + "</tr>";
    }).join("");
  }

  /* ============================ ACCESS CODE ============================ */
  function pageAccess() {
    var form = document.getElementById("codeForm");
    var input = document.getElementById("codeInput");
    var msg = document.getElementById("codeMsg");
    var result = document.getElementById("codeResult");
    var s = NT.store.get();

    if (s.access) {
      document.getElementById("currentAccess").classList.remove("hidden");
      document.getElementById("currentAccessBody").innerHTML =
        '<div class="kv">' +
        '<div class="row"><span>Active package</span><b>' + NT.esc(NT.packageDetails(s.access).name) + "</b></div>" +
        '<div class="row"><span>Status</span><b><span class="badge badge-success">' + NT.icon("badge-check") + "Active</span></b></div>" +
        '<div class="row"><span>Lessons unlocked</span><b>' + NT.availableFor(s.access) + " of " + NT.counts().total + "</b></div>" +
        '<div class="row"><span>Source</span><b>' + NT.esc((s.accessMeta && (s.accessMeta.code || s.accessMeta.source)) || "—") + "</b></div>" +
        "</div>";
    }

    document.querySelectorAll(".code-chip").forEach(function (ch) {
      ch.addEventListener("click", function () {
        input.value = ch.dataset.code;
        msg.innerHTML = "";
        input.focus();
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = input.value.trim().toUpperCase();
      msg.innerHTML = "";
      result.classList.add("hidden");
      if (!val) {
        msg.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div><b>Enter an access code first.</b><br>Paste the code from your payment receipt, e.g. NT-STANDARD-2026.</div></div>";
        return;
      }
      var rec = NT.store.findCode(val);
      if (!rec) {
        msg.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div><b>That code isn't valid.</b><br>Check for typos — demo codes look like <span class='mono'>NT-STANDARD-2026</span>. If you just paid, use the code on your receipt.</div></div>";
        return;
      }
      if (rec.status === "redeemed" && rec.seeded) {
        msg.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div><b>This code has already been redeemed.</b><br>Each access code works once. Contact support if you believe this is a mistake.</div></div>";
        return;
      }
      /* redeem */
      NT.store.redeemCode(rec.code);
      NT.store.setAccess(rec.pkg, { code: rec.code, source: "code" });
      var total = NT.counts().total, avail = NT.availableFor(rec.pkg);
      result.classList.remove("hidden");
      result.innerHTML =
        '<div class="unlock-result">' +
        '<div class="big-ico">' + NT.icon("unlock", "icon-xl") + "</div>" +
        "<h2>" + D.LEVEL_LABEL[rec.pkg].toUpperCase() + " access unlocked</h2>" +
        '<p class="videos-line"><b>' + avail + " of " + total + "</b> lessons are now available.</p>" +
        '<div class="btns" style="justify-content:center">' +
        '<a class="btn btn-primary btn-lg" href="' + NT.base() + 'dashboard.html">' + NT.icon("layout-dashboard") + "Go to Dashboard</a>" +
        '<a class="btn btn-secondary btn-lg" href="' + NT.base() + 'library.html">' + NT.icon("library") + "Browse the library</a>" +
        "</div></div>";
      form.classList.add("hidden");
      document.getElementById("codeHints").classList.add("hidden");
      NT.toast(D.LEVEL_LABEL[rec.pkg] + " access unlocked", "success");
    });
  }

  /* ============================ ACCESS CONTROL DEMO ============================ */
  function pageControl() {
    function personaList(level) {
      return D.LEVELS.map(function (lv) {
        var ok = D.LEVEL_RANK[level] >= D.LEVEL_RANK[lv];
        var n = NT.allLessons().filter(function (l) { return NT.levelOf(l) === lv; }).length;
        return '<li class="' + (ok ? "ok" : "no") + '">' + NT.icon(ok ? "check-circle" : "lock") +
          "<span>" + D.LEVEL_LABEL[lv] + " lessons <span class='muted'>(" + n + " in total)</span></span></li>";
      }).join("");
    }

    function renderPersonas() {
      var cur = NT.store.get().access;
      var isPersona = NT.store.get().accessMeta && NT.store.get().accessMeta.source === "persona";
      document.getElementById("personaGrid").innerHTML = D.LEVELS.map(function (lv) {
        var viewing = isPersona && cur === lv;
        return '<div class="card persona-card' + (viewing ? " active-view" : "") + '">' +
          '<div class="persona-head"><h2>' + D.LEVEL_LABEL[lv] + " student</h2>" +
          '<span class="persona-price">' + NT.kwacha(NT.packagePrice(lv)) + "</span></div>" +
          '<ul class="persona-list">' + personaList(lv) + "</ul>" +
          '<button class="btn ' + (viewing ? "btn-secondary" : "btn-dark") + ' btn-block" data-persona="' + lv + '">' +
          NT.icon(viewing ? "eye" : "log-in") + "View as " + D.LEVEL_LABEL[lv] + " student</button>" +
          "</div>";
      }).join("");
      document.querySelectorAll("[data-persona]").forEach(function (b) {
        b.addEventListener("click", function () {
          var lv = b.dataset.persona;
          NT.store.setAccess(lv, { source: "persona" });
          NT.toast("Now viewing the platform as a " + D.LEVEL_LABEL[lv] + " student", "success");
          renderAll();
          var existing = document.querySelector(".demo-banner");
          if (existing) existing.remove();
          NT.renderDemoBanner();
        });
      });
    }

    function renderPreview() {
      var st = NT.store.get();
      var cur = st.access;
      document.getElementById("viewState").innerHTML = cur
        ? '<span class="badge badge-success">' + NT.icon("badge-check") + "Viewing as " + D.LEVEL_LABEL[cur] + " student</span>"
        : '<span class="badge badge-outline">' + NT.icon("eye") + "Visitor — nothing unlocked</span>";
      document.getElementById("matrixBody").innerHTML = D.LEVELS.map(function (lessonLv) {
        return "<tr><td>" + D.LEVEL_LABEL[lessonLv] + " lessons</td>" + D.LEVELS.map(function (persona) {
          var ok = D.LEVEL_RANK[persona] >= D.LEVEL_RANK[lessonLv];
          return '<td class="' + (ok ? "yes" : "no") + '" data-label="' + D.LEVEL_LABEL[persona] + '">' + NT.icon(ok ? "check-circle" : "lock", "icon-sm") + "</td>";
        }).join("") + "</tr>";
      }).join("");
      var samples = ["math-1", "math-5", "math-7", "phys-4", "chem-8", "cs-2"].map(NT.lesson).filter(Boolean);
      document.getElementById("previewGrid").innerHTML = samples.map(function (l) {
        var unlocked = NT.isUnlocked(l);
        var c = NT.course(l.courseId);
        return '<a class="card lesson-card" href="' + NT.base() + "library.html?course=" + l.courseId + '">' +
          '<div class="thumb" style="--thumb-bg:' + c.thumb + '">' + NT.thumbArt(c) +
          '<span class="thumb-icon">' + NT.icon(c.icon) + "</span>" +
          '<span class="dur">' + l.duration + "</span>" +
          (unlocked ? "" : '<div class="lock-scrim"><div class="lockbox"><span class="ring">' + NT.icon("lock") + "</span>Locked</div></div>") +
          "</div>" +
          '<div class="lesson-body"><span class="lesson-course">' + NT.esc(l.courseTitle) + '</span><span class="lesson-title">' + NT.esc(l.title) + "</span>" +
          '<div class="lesson-meta"><span>' + NT.icon(unlocked ? "unlock" : "lock", "icon-sm") + (unlocked ? "Available" : "Upgrade needed") + "</span></div></div></a>";
      }).join("");
      document.getElementById("resetView").classList.toggle("hidden", !(st.accessMeta && st.accessMeta.source === "persona"));
    }

    function renderAll() { renderPersonas(); renderPreview(); }
    renderAll();
    document.getElementById("resetView").addEventListener("click", function () {
      NT.store.clearAccess();
      var b = document.querySelector(".demo-banner"); if (b) b.remove();
      NT.toast("Demo view reset — back to visitor state", "success");
      renderAll();
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

    function lessonMarkup(l) {
      var unlocked = NT.isUnlocked(l);
      var done = NT.store.isComplete(l.id);
      var cls = done ? "is-complete" : unlocked ? "is-open" : "is-locked";
      var ico = done ? "circle-check" : unlocked ? "play-circle" : "lock";
      var stateText = done ? "Completed" : "";
      var num = String(l.index == null ? "" : l.index).padStart(2, "0");
      return '<li class="lib-lesson ' + cls + '">' +
        '<span class="lib-index" aria-hidden="true">' + NT.esc(num) + "</span>" +
        '<span class="lib-state" aria-hidden="true">' + NT.icon(ico) + "</span>" +
        '<span class="lib-lesson-title"><b>' + NT.esc(l.title) + "</b><small>" +
        NT.esc(l.duration) + " · " + D.LEVEL_LABEL[NT.levelOf(l)] + " lesson" + (stateText ? " · " + stateText : "") + "</small></span>" +
        '<span class="lib-lesson-action">' +
        (unlocked
          ? '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(l.id) + '">' +
            (done ? "Review" : "Watch") + "</a>"
          : '<span class="requires">' + D.LEVEL_LABEL[NT.levelOf(l)] + " required</span>") +
        "</span></li>";
    }

    function courseSection(courseRecord, lessons) {
      var all = NT.courseLessons(courseRecord.id);
      var included = all.filter(function (l) { return NT.isUnlocked(l); });
      var done = included.filter(function (l) { return NT.store.isComplete(l.id); }).length;
      var pct = included.length ? Math.round((done / included.length) * 100) : 0;
      var next = lessons.filter(function (l) { return NT.isUnlocked(l) && !NT.store.isComplete(l.id); })[0] ||
        lessons.filter(function (l) { return NT.isUnlocked(l); })[0];
      var access = NT.store.get().access;
      return '<section class="lib-course reveal">' +
        '<header class="lib-course-head">' +
        '<span class="course-icon" style="--tint:' + courseRecord.tint + ";--tint-fg:" + courseRecord.tintFg + '">' + NT.icon(courseRecord.icon) + "</span>" +
        "<div><h2><a href=\"" + NT.base() + "course.html?id=" + encodeURIComponent(courseRecord.id) + "\">" + NT.esc(courseRecord.title) + "</a></h2><p>" + all.length + " lessons" +
        (access ? " · " + included.length + " included with your " + NT.esc(NT.packageDetails(access).name) + " access" : "") + "</p></div>" +
        (next ? '<a class="link-arrow" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(next.id) + '">' +
          (NT.store.isComplete(next.id) ? "Review course" : "Continue") + NT.icon("arrow-right", "icon-sm") + "</a>" : "") +
        "</header>" +
        (access && included.length
          ? '<div class="progress lib-course-progress" aria-hidden="true"><i style="width:' + pct + '%"></i></div>'
          : "") +
        '<ul class="lib-lessons">' + lessons.map(lessonMarkup).join("") + "</ul>" +
        "</section>";
    }

    function renderStatus() {
      var options = [
        { id: "all", label: "All" },
        { id: "open", label: "Available" },
        { id: "locked", label: "Locked" }
      ];
      statusHost.innerHTML = options.map(function (option) {
        return '<button type="button" data-status="' + option.id + '" class="' + (status === option.id ? "active" : "") +
          '" aria-pressed="' + (status === option.id) + '">' + option.label + "</button>";
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
      var q = search.value.trim().toLowerCase();
      var all = NT.allLessons();
      var matches = function (l) {
        if (course && l.courseId !== course) return false;
        if (status === "open" && !NT.isUnlocked(l)) return false;
        if (status === "locked" && NT.isUnlocked(l)) return false;
        if (q && (l.title + " " + l.courseTitle).toLowerCase().indexOf(q) === -1) return false;
        return true;
      };
      var sections = D.COURSES.map(function (courseRecord) {
        return { course: courseRecord, lessons: NT.courseLessons(courseRecord.id).filter(matches) };
      }).filter(function (entry) { return entry.lessons.length; });

      root.innerHTML = sections.length
        ? sections.map(function (entry) { return courseSection(entry.course, entry.lessons); }).join("")
        : '<p class="lib-empty">No lessons match. Try another search or filter.</p>';

      var unlockedCount = all.filter(function (l) { return NT.isUnlocked(l); }).length;
      var lockedCount = all.length - unlockedCount;
      summary.innerHTML = access
        ? '<span><b>' + unlockedCount + "</b> of " + all.length + " lessons included with your " +
          NT.esc(NT.packageDetails(access).name) + " access.</span>" +
          (lockedCount ? '<a class="link-arrow" href="' + NT.base() + 'pricing.html">Unlock the remaining ' + lockedCount + " " + NT.icon("arrow-right", "icon-sm") + "</a>" : "")
        : "<span>Every lesson is shown — redeem an access code or choose a package to watch.</span>";
      renderStatus();
      renderChips();
      gate.classList.toggle("hidden", !!access);
      NT.initReveal();
    }

    search.addEventListener("input", render);
    render();
  }

  /* ============================ RESOURCES ============================ */
  function pageResources() {
    var search = document.getElementById("resourceSearch");
    var subject = document.getElementById("resourceSubject");
    var list = document.getElementById("resourceCourses");
    var summary = document.getElementById("resourceSummary");

    subject.innerHTML = '<option value="">All subjects</option>' + D.SUBJECTS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.title) + "</option>";
    }).join("");

    function renderCourse(course) {
      var lessons = NT.courseLessons(course.id);
      var included = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); }).length;
      var access = NT.store.get().access;
      return '<article class="card resource-course">' +
        '<div class="course-card-top"><span class="course-icon" style="--tint:' + course.tint + ";--tint-fg:" + course.tintFg + '">' + NT.icon(course.icon) + "</span></div>" +
        '<h3>' + NT.esc(course.title) + "</h3>" +
        '<p class="desc">' + NT.esc(course.desc) + "</p>" +
        '<p class="resource-course-count"><b>' + lessons.length + "</b> tutorial videos" +
        (access ? " · " + included + " included with your package" : "") + "</p>" +
        '<a class="btn btn-secondary" href="' + NT.base() + "library.html?course=" + encodeURIComponent(course.id) + '">Open video lessons' + NT.icon("arrow-right", "icon-sm") + "</a>" +
        "</article>";
    }

    function render() {
      var query = search.value.trim().toLowerCase();
      var courses = D.COURSES.filter(function (course) {
        if (subject.value && course.subjectId !== subject.value) return false;
        var haystack = [course.title, course.desc, NT.coursePathwayNames(course)].join(" ").toLowerCase();
        return !query || haystack.indexOf(query) !== -1;
      });
      list.innerHTML = courses.length
        ? courses.map(renderCourse).join("")
        : '<p class="lib-empty">No courses match that search.</p>';
      summary.textContent = courses.length + " course" + (courses.length === 1 ? "" : "s") + " · " +
        NT.allLessons().length + " tutorial videos in the current demo catalogue";
    }

    [subject].forEach(function (el) { el.addEventListener("change", render); });
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
    function matches(fields, query, allowResourceType) {
      if (!query) return false;
      if (allowResourceType && /^(video|videos|tutorial|tutorial video|tutorial videos)$/.test(query)) return true;
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
      var done = NT.store.isComplete(lesson.id);
      return '<article class="search-result">' +
        '<span class="search-result-icon" style="--tint:' + course.tint + ";--tint-fg:" + course.tintFg + '">' + NT.icon("play-circle") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>Lesson</span><span>' + NT.esc(lesson.courseTitle) + "</span>" +
        (done ? '<span class="search-complete">Completed</span>' : "") + "</div>" +
        "<h3>" + NT.esc(lesson.title) + "</h3>" +
        "<small>" + NT.esc(lesson.duration) + " · " + NT.esc(D.LEVEL_LABEL[NT.levelOf(lesson)]) + " lesson</small></div>" +
        (unlocked
          ? '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(lesson.id) + '">' + (done ? "Review" : "Watch") + "</a>"
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
          "<p>Course names, subjects and lesson titles. Results come from the current demo catalogue.</p>" +
          '<div class="search-suggestions"><span>Browse a subject</span>' + chips + "</div></div>";
        results.querySelectorAll("[data-suggestion]").forEach(function (button) {
          button.addEventListener("click", function () { input.value = button.dataset.suggestion; render(); input.focus(); });
        });
        return;
      }

      var courses = D.COURSES.filter(function (course) {
        var lessonTitles = NT.courseLessons(course.id).map(function (lesson) { return lesson.title; }).join(" ");
        var paths = NT.coursePathways(course).map(coursePathwayLabel).join(" ");
        return matches([course.title, course.desc, lessonTitles, paths], query, false);
      });
      var lessons = NT.allLessons().filter(function (lesson) {
        var course = NT.course(lesson.courseId) || {};
        return matches([lesson.title, lesson.courseTitle, lesson.description, course.desc], query, true);
      });
      var notices = publishedAnnouncements().filter(function (notice) {
        return matches([notice.title, notice.body], query, false);
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
        "<p class=\"muted\">There are no published updates at the moment. When Nuclear Tutorials posts a notice, it will appear here.</p>" +
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
    var gradeField = document.getElementById("profileGradeField");
    var universityFields = document.getElementById("profileUniversityFields");
    var grade = document.getElementById("profileSchoolLevel");
    var subject = document.getElementById("profileSubject");
    var notice = document.getElementById("profileSaveMessage");
    var saved = Object.assign({ name: "", educationLevel: "", levelId: "", university: "", programme: "", subjectId: "" }, NT.store.get().profile || {});

    level.innerHTML = '<option value="">Choose a level (optional)</option>' + D.EDUCATION_LEVELS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.label) + "</option>";
    }).join("");
    grade.innerHTML = '<option value="">Choose a grade, form or level</option>' + D.HIGH_SCHOOL_LEVELS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.label + " · " + item.detail) + "</option>";
    }).join("");
    subject.innerHTML = '<option value="">No subject selected</option>' + D.SUBJECTS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.title) + "</option>";
    }).join("");
    document.getElementById("profileName").value = saved.name || "";
    level.value = saved.educationLevel || "";
    grade.value = saved.levelId || "";
    subject.value = saved.subjectId || "";
    document.getElementById("profileUniversity").value = saved.university || "";
    document.getElementById("profileProgramme").value = saved.programme || "";

    function syncPathFields() {
      gradeField.classList.toggle("hidden", level.value !== "high-school");
      universityFields.classList.toggle("hidden", level.value !== "university");
    }
    function renderSummary(profile) {
      var access = NT.store.get().access;
      var path = profile.educationLevel === "high-school"
        ? "High School" + (profile.levelId ? " · " + (D.HIGH_SCHOOL_LEVELS.filter(function (item) { return item.id === profile.levelId; })[0] || {}).label : "")
        : profile.educationLevel === "university"
          ? "University" + (profile.university ? " · " + profile.university : "") + (profile.programme ? " · " + profile.programme : "")
          : "No pathway selected yet";
      document.getElementById("profileSummary").innerHTML =
        '<div class="profile-summary-identity"><span class="profile-avatar">' + NT.icon("circle-user", "icon-lg") + "</span><div>" +
        "<small>Learning profile · this device</small><b>" + NT.esc(profile.name || "Student") + "</b><span>" + NT.esc(path) + "</span></div></div>" +
        '<div class="profile-summary-details"><span><small>Subject interest</small><b>' + NT.esc((NT.subject(profile.subjectId) || {}).title || "Not selected") + "</b></span>" +
        '<span><small>Access package</small><b>' + (access ? NT.esc(NT.packageDetails(access).name) + " · Active" : "No active package") + "</b></span></div>";
      document.getElementById("profileBrowseCourses").href = NT.base() + "courses.html" + (profile.educationLevel ? "?level=" + encodeURIComponent(profile.educationLevel) : "");
    }
    level.addEventListener("change", syncPathFields);
    syncPathFields();
    renderSummary(saved);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var profile = {
        name: document.getElementById("profileName").value.trim().slice(0, 60),
        educationLevel: level.value,
        levelId: level.value === "high-school" ? grade.value : "",
        university: level.value === "university" ? document.getElementById("profileUniversity").value.trim().slice(0, 100) : "",
        programme: level.value === "university" ? document.getElementById("profileProgramme").value.trim().slice(0, 100) : "",
        subjectId: subject.value
      };
      NT.store.mutate(function (state) { state.profile = profile; });
      notice.innerHTML = NT.icon("check-circle", "icon-sm") + " Profile saved on this device.";
      renderSummary(profile);
      NT.toast("Learning profile saved", "success");
    });
  }

  /* ============================ DASHBOARD ============================ */
  /* A student workspace: continue learning, recent activity, progress, my courses. */
  function pageDashboard() {
    var s = NT.store.get();
    var root = document.getElementById("dashRoot");

    if (!s.access) {
      root.innerHTML = '<div class="dashboard-empty"><h1>Your learning starts here.</h1>' +
        "<p>Activate a package to track progress, continue watching and see the courses included with your access.</p>" +
        '<div class="dashboard-empty-actions"><a class="btn btn-primary" href="' + NT.base() + 'pricing.html">' + NT.icon("layers") + "View access packages</a>" +
        '<a class="btn btn-secondary" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Redeem an access code</a>" +
        '<a class="link-arrow" href="' + NT.base() + 'courses.html">Explore courses ' + NT.icon("arrow-right", "icon-sm") + "</a></div></div>";
      return;
    }

    var all = NT.allLessons();
    var unlocked = all.filter(function (lesson) { return NT.isUnlocked(lesson); });
    var completed = unlocked.filter(function (lesson) { return NT.store.isComplete(lesson.id); });
    var pct = unlocked.length ? Math.round((completed.length / unlocked.length) * 100) : 0;
    var meta = s.accessMeta || {};
    var since = meta.since ? new Date(meta.since) : new Date();
    if (isNaN(since.getTime())) since = new Date();
    var expires = new Date(since.getTime() + s.settings.days * 86400000);
    var packageInfo = NT.packageDetails(s.access);
    var profile = s.profile || {};
    var profileLevel = D.EDUCATION_LEVELS.filter(function (item) { return item.id === profile.educationLevel; })[0] || null;
    function orderForPathway(courses) {
      if (!profileLevel) return courses;
      return courses.slice().sort(function (a, b) {
        return (NT.coursePathway(a, profileLevel.id) ? 0 : 1) - (NT.coursePathway(b, profileLevel.id) ? 0 : 1);
      });
    }

    var recentIds = (s.recentLessons || []).slice();
    if (!recentIds.length) recentIds = s.completed.slice().reverse();
    var recent = recentIds.map(NT.lesson).filter(Boolean).slice(0, 4);

    var next = recent.filter(function (lesson) { return NT.isUnlocked(lesson) && !NT.store.isComplete(lesson.id); })[0] ||
      unlocked.filter(function (lesson) { return !NT.store.isComplete(lesson.id); })[0] || unlocked[0];
    var nextCourse = next ? (NT.course(next.courseId) || D.COURSES[0]) : null;

    var continueHtml;
    if (next) {
      continueHtml = '<section class="card dashboard-continue">' +
        '<div class="dashboard-continue-art" style="--thumb-bg:' + (nextCourse.thumb || D.COURSES[0].thumb) + '">' + NT.thumbArt(nextCourse) +
        '<span class="continue-course-icon">' + NT.icon(nextCourse.icon || "book-open") + "</span>" +
        '<span class="continue-art-label">' + NT.icon("play-circle", "icon-sm") + "Next up</span></div>" +
        '<div class="dashboard-continue-copy"><span class="eyebrow">Continue learning</span>' +
        "<h2>" + NT.esc(next.title) + "</h2><p>" + NT.esc(next.courseTitle) + " · " + NT.esc(next.duration) + " min · " + D.LEVEL_LABEL[NT.levelOf(next)] + " lesson</p>" +
        '<div class="continue-progress-label"><span>Overall progress</span><b>' + pct + "%</b></div>" +
        '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
        '<a class="btn btn-primary" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(next.id) + '">' + NT.icon("play") +
        (recent.length ? "Continue lesson" : "Start your first lesson") + "</a></div></section>";
    } else {
      continueHtml = '<section class="card card-pad dashboard-finished"><h2>Every lesson in your package is complete.</h2>' +
        "<p class=\"muted\" style=\"margin:8px 0 16px\">Review any lesson, or explore the rest of the catalogue.</p>" +
        '<a class="btn btn-secondary" href="' + NT.base() + 'library.html">Open your library</a></section>';
    }

    var recentHtml = recent.length ? recent.map(function (lesson) { return lessonRow(lesson, true); }).join("") :
      '<p class="muted small">No lessons watched yet. Open a lesson and it will appear here.</p>';

    var courseRows = orderForPathway(D.COURSES).map(function (course) {
      var lessons = NT.courseLessons(course.id);
      var courseUnlocked = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); });
      var done = courseUnlocked.filter(function (lesson) { return NT.store.isComplete(lesson.id); }).length;
      var coursePct = courseUnlocked.length ? Math.round((done / courseUnlocked.length) * 100) : 0;
      return '<a class="dashboard-course-row" href="' + NT.base() + "course.html?id=" + encodeURIComponent(course.id) + '">' +
        '<span class="dashboard-course-icon" style="--tint:' + course.tint + ";--tint-fg:" + course.tintFg + '">' + NT.icon(course.icon) + "</span>" +
        '<span class="dashboard-course-info"><b>' + NT.esc(course.title) + "</b><small>" + courseUnlocked.length + " of " + lessons.length +
        " lessons included · " + done + " completed</small>" +
        '<span class="progress"><i style="width:' + coursePct + '%"></i></span></span>' +
        '<span class="dashboard-course-pct">' + coursePct + "%</span>" +
        '<span class="dashboard-row-arrow">' + NT.icon("chevron-right", "icon-sm") + "</span></a>";
    }).join("");

    root.innerHTML =
      '<div class="dashboard-page">' +
      '<header class="dashboard-heading"><div><span class="eyebrow">Your learning</span>' +
      "<h1>" + (profile.name ? "Welcome back, " + NT.esc(profile.name) + "." : "Welcome back.") + "</h1>" +
      "<p>" + NT.esc(packageInfo.name) + " access · " + completed.length + " of " + unlocked.length + " lessons completed · active until " + NT.fmtDate(expires.toISOString()) + "</p></div>" +
      '<div class="dashboard-heading-actions">' +
      '<a class="pathway-chip" href="' + NT.base() + 'profile.html">' + NT.icon(profileLevel ? NT.pathwayIcon(profileLevel.id) : "target") +
      NT.esc(profileLevel ? profileLevel.label : "Set your pathway") + "</a>" +
      '<a class="btn btn-secondary btn-sm" href="' + NT.base() + 'library.html">Open library</a></div></header>' +

      continueHtml +

      '<section class="dashboard-section reveal"><div class="dashboard-section-head"><h2>Recently accessed</h2>' +
      '<a class="link-arrow" href="' + NT.base() + 'library.html">Full library ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
      '<div class="list-rows dashboard-recent-list">' + recentHtml + "</div></section>" +

      '<section class="dashboard-section reveal" data-delay="1"><div class="dashboard-section-head"><h2>My courses</h2>' +
      '<a class="link-arrow" href="' + NT.base() + 'courses.html">Browse all courses ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
      '<div class="dash-progress"><div class="nums"><b>' + pct + '%</b> complete across your ' + NT.esc(packageInfo.name) + " package · " +
      '<span class="stat-denom">' + completed.length + " of " + unlocked.length + " lessons</span></div>" +
      '<div class="progress"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="dashboard-course-list">' + courseRows + "</div></section>" +
      "</div>";
  }

  /* ============================ LESSON / PLAYER ============================ */
  function pageLesson() {
    var id = NT.qs("id") || "math-1";
    var lesson = NT.lesson(id) || NT.lesson("math-1");
    var course = NT.course(lesson.courseId);
    var lessons = NT.courseLessons(course.id);
    var idx = lessons.findIndex(function (l) { return l.id === lesson.id; });
    var prev = lessons[idx - 1], nextL = lessons[idx + 1];
    var unlocked = NT.isUnlocked(lesson);
    var root = document.getElementById("lessonRoot");

    document.title = lesson.title + " — Nuclear Tutorials";

    var sideList = lessons.map(function (l) {
      var un = NT.isUnlocked(l);
      return '<a class="side-item' + (l.id === lesson.id ? " current" : "") + (un ? "" : " is-locked") + '" href="' +
        (un ? NT.base() + "lesson.html?id=" + l.id : "#") + '"' + (un ? "" : ' data-locked="1"') + ">" +
        '<span class="n">' + l.index + '</span><span class="t">' + NT.esc(l.title) + "</span>" +
        (NT.store.isComplete(l.id) ? NT.icon("circle-check") : un ? NT.icon("play", "icon-sm") : NT.icon("lock", "icon-sm")) +
        "</a>";
    }).join("");

    var courseDone = lessons.filter(function (l) { return NT.isUnlocked(l) && NT.store.isComplete(l.id); }).length;
    var courseUnlocked = lessons.filter(function (l) { return NT.isUnlocked(l); }).length;
    var coursePct = courseUnlocked ? Math.round((courseDone / courseUnlocked) * 100) : 0;

    var crumbs = '<div class="crumbs"><a href="' + NT.base() + 'index.html">Home</a> ' + NT.icon("chevron-right", "icon-sm") +
      ' <a href="' + NT.base() + 'courses.html">Courses</a> ' + NT.icon("chevron-right", "icon-sm") +
      ' <a href="' + NT.base() + "course.html?id=" + encodeURIComponent(course.id) + '">' + NT.esc(course.title) + "</a> " +
      NT.icon("chevron-right", "icon-sm") + " <span>Lesson " + lesson.index + "</span></div>";

    var contents = '<aside class="lesson-side"><div class="card"><div class="card-head"><h2 style="font-size:1rem">Course contents</h2>' +
      '<span class="muted small">' + courseDone + "/" + courseUnlocked + " done</span></div>" +
      '<div class="side-list">' + sideList + "</div></div></aside>";

    if (!unlocked) {
      root.innerHTML = crumbs +
        '<div class="split" style="margin-top:24px">' +
        '<div class="card gate"><div class="big-ico" style="background:var(--tier-' + NT.levelOf(lesson) + '-bg);color:var(--tier-' + NT.levelOf(lesson) + ')">' + NT.icon("lock", "icon-xl") + "</div>" +
        "<h1 style=\"font-size:1.5rem\">This lesson is locked</h1>" +
        "<p><b>" + NT.esc(lesson.title) + "</b> is part of the <b>" + D.LEVEL_LABEL[NT.levelOf(lesson)] + "</b> package. " +
        (NT.store.get().access
          ? "Your current " + D.LEVEL_LABEL[NT.store.get().access] + " access doesn't include it yet."
          : "Choose a package or redeem an access code to start watching.") + "</p>" +
        '<div class="btns" style="justify-content:center"><a class="btn btn-primary" href="' + NT.base() + 'pricing.html">Compare packages</a>' +
        '<a class="btn btn-secondary" href="' + NT.base() + 'library.html">Back to library</a></div></div>' +
        contents + "</div>";
      wireLockedLinks();
      return;
    }

    root.innerHTML = crumbs +
      '<div class="lesson-page" style="margin-top:20px">' +
      '<div class="lesson-main">' +
      '<div class="player-frame" id="playerFrame">' +
      '<canvas id="playerCanvas"></canvas>' +
      '<div class="player-tag"><span class="demo">Demo video</span><span>' + NT.esc(course.title) + "</span></div>" +
      '<div class="player-overlay" id="playerOverlay"><span class="bigplay">' + NT.icon("play", "icon-lg") + "</span></div>" +
      "</div>" +
      '<div class="player-controls">' +
      '<button class="pc-btn" id="pcPlay" aria-label="Play or pause">' + NT.icon("play") + "</button>" +
      '<span class="pc-time" id="pcTime">0:00 / ' + lesson.duration + "</span>" +
      '<input class="seek" id="pcSeek" type="range" min="0" max="' + NT.parseDur(lesson.duration) + '" value="0" step="1" aria-label="Seek">' +
      '<select class="lvl-select" id="pcSpeed" aria-label="Playback speed"><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="4">4× (demo)</option></select>' +
      '<button class="pc-btn" id="pcMute" aria-label="Mute">' + NT.icon("volume") + "</button>" +
      '<button class="pc-btn" id="pcFull" aria-label="Fullscreen">' + NT.icon("maximize") + "</button>" +
      "</div>" +

      '<div class="lesson-info">' +
      "<h1>" + NT.esc(lesson.title) + "</h1>" +
      '<div class="lesson-meta"><span>' + NT.esc(course.title) + "</span>" +
      "<span>Lesson " + lesson.index + " of " + lessons.length + "</span>" +
      '<span>' + NT.icon("clock", "icon-sm") + NT.esc(lesson.duration) + "</span>" +
      NT.levelBadge(NT.levelOf(lesson)) +
      '<span id="doneBadge"></span></div>' +
      '<div class="lesson-progress progress-row"><span style="white-space:nowrap">Course progress</span>' +
      '<div class="progress"><i id="courseProg" style="width:' + coursePct + '%"></i></div>' +
      '<span id="coursePct">' + coursePct + "%</span></div>" +
      '<div class="lesson-actions">' +
      (prev ? '<a class="btn btn-secondary" href="' + NT.base() + "lesson.html?id=" + prev.id + '">' + NT.icon("arrow-left") + "Previous</a>" :
        '<span class="muted small">First lesson in this course</span>') +
      (nextL ? '<a class="btn btn-primary" href="' + NT.base() + "lesson.html?id=" + nextL.id + '">Next lesson' + NT.icon("arrow-right") + "</a>" :
        '<span class="muted small">Final lesson in this course</span>') +
      '<span class="spacer"></span>' +
      '<button class="btn btn-secondary" id="markDone">' + NT.icon("circle-check") + "Mark as complete</button>" +
      "</div></div></div>" +
      contents + "</div>";

    wireLockedLinks();
    initPlayer(lesson, course);
    renderDoneState();

    function renderDoneState() {
      var done = NT.store.isComplete(lesson.id);
      var badge = document.getElementById("doneBadge");
      if (badge) badge.innerHTML = done ? '<span class="badge badge-success">' + NT.icon("circle-check") + "Completed</span>" : "";
      var btn = document.getElementById("markDone");
      if (btn) {
        btn.innerHTML = NT.icon(done ? "rotate" : "circle-check") + (done ? "Mark as not complete" : "Mark as complete");
        btn.classList.toggle("btn-secondary", !done);
        btn.classList.toggle("btn-dark", done);
      }
      var d2 = lessons.filter(function (l) { return NT.isUnlocked(l) && NT.store.isComplete(l.id); }).length;
      var u2 = lessons.filter(function (l) { return NT.isUnlocked(l); }).length;
      var p2 = u2 ? Math.round((d2 / u2) * 100) : 0;
      var cp = document.getElementById("courseProg"); if (cp) cp.style.width = p2 + "%";
      var cpt = document.getElementById("coursePct"); if (cpt) cpt.textContent = p2 + "%";
      var head = root.querySelector(".card-head .muted");
      if (head) head.textContent = d2 + "/" + u2 + " done";
    }

    document.getElementById("markDone").addEventListener("click", function () {
      var done = NT.store.isComplete(lesson.id);
      NT.store.toggleComplete(lesson.id, !done);
      if (!done) NT.store.recordLessonVisit(lesson.id);
      NT.toast(!done ? "Lesson completed — progress updated" : "Lesson marked as not complete", "success");
      renderDoneState();
    });
  }

  function wireLockedLinks() {
    document.querySelectorAll("[data-locked]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        NT.toast("That lesson is locked for your current package.", "error");
      });
    });
  }

  /* ---------- canvas demo player ---------- */
  function initPlayer(lesson, course) {
    var canvas = document.getElementById("playerCanvas");
    var frame = document.getElementById("playerFrame");
    var overlay = document.getElementById("playerOverlay");
    var playBtn = document.getElementById("pcPlay");
    var seek = document.getElementById("pcSeek");
    var timeEl = document.getElementById("pcTime");
    var speedSel = document.getElementById("pcSpeed");
    var muteBtn = document.getElementById("pcMute");
    var fullBtn = document.getElementById("pcFull");

    var dur = NT.parseDur(lesson.duration);
    var st = { t: 0, playing: false, speed: 1, muted: false, ended: false, notified: false };
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);

    function resize() {
      var r = frame.getBoundingClientRect();
      W = r.width; H = r.height;
      if (!ctx) return;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    window.addEventListener("resize", resize);

    function orbit(cx, cy, rx, ry, rot, color, w) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
    }

    function draw() {
      if (!ctx || !W) return;
      var t = st.t;
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0d2334"); g.addColorStop(1, "#0a1622");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1;
      for (var x = 0; x < W; x += 44) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (var y = 0; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      var cx = W * 0.72, cy = H * 0.44, base = Math.min(W, H) * 0.30;
      orbit(cx, cy, base, base * 0.42, t * 0.22, "rgba(110,203,232,.55)", 2.2);
      orbit(cx, cy, base, base * 0.42, t * 0.22 + Math.PI / 3, "rgba(224,33,138,.42)", 2.2);
      orbit(cx, cy, base, base * 0.42, t * 0.22 + (2 * Math.PI) / 3, "rgba(244,123,32,.40)", 2.2);
      var pulse = 6 + Math.sin(t * 2.2) * 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, pulse + 7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 1.4; ctx.stroke();

      ctx.beginPath();
      for (var px = 0; px <= W; px += 4) {
        var yy = H * 0.82 + Math.sin(px * 0.02 + t * 2.4) * 9 * Math.sin(t * 0.7 + px * 0.004);
        if (px === 0) ctx.moveTo(px, yy); else ctx.lineTo(px, yy);
      }
      ctx.strokeStyle = "rgba(110,203,232,.5)"; ctx.lineWidth = 1.6; ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.font = "600 " + Math.max(10, W * 0.016) + "px Inter, system-ui, sans-serif";
      ctx.fillText("NUCLEAR TUTORIALS · " + course.title.toUpperCase(), W * 0.05, H * 0.14);
      ctx.fillStyle = "rgba(255,255,255,.96)";
      ctx.font = "700 " + Math.max(16, W * 0.034) + "px Inter, system-ui, sans-serif";
      ctx.fillText(lesson.title, W * 0.05, H * 0.14 + Math.max(22, W * 0.045));
      ctx.fillStyle = "rgba(255,255,255,.4)";
      ctx.font = "500 " + Math.max(10, W * 0.015) + "px Inter, system-ui, sans-serif";
      ctx.fillText("Demo whiteboard recording · lesson " + lesson.index, W * 0.05, H * 0.14 + Math.max(22, W * 0.045) + Math.max(16, W * 0.024));

      ctx.fillStyle = "rgba(20,147,184,.85)";
      ctx.fillRect(0, H - 3, W * (st.t / dur), 3);
    }

    var last = null;
    function loop(ts) {
      if (last == null) last = ts;
      var dt = (ts - last) / 1000; last = ts;
      if (st.playing) {
        st.t += dt * st.speed;
        if (st.t >= dur) {
          st.t = dur; st.playing = false; st.ended = true;
          setPlayIcon();
          overlay.classList.remove("hide");
          if (!st.notified) {
            st.notified = true;
            if (!NT.store.isComplete(lesson.id)) {
              NT.store.toggleComplete(lesson.id, true);
              NT.toast("Lesson finished — marked as complete", "success");
              var btn = document.getElementById("markDone");
              if (btn) {
                var badge = document.getElementById("doneBadge");
                if (badge) badge.innerHTML = '<span class="badge badge-success">' + NT.icon("circle-check") + "Completed</span>";
                btn.innerHTML = NT.icon("rotate") + "Mark as not complete";
                btn.classList.add("btn-dark"); btn.classList.remove("btn-secondary");
              }
            }
          }
        }
        seek.value = Math.floor(st.t);
        timeEl.textContent = NT.fmtSec(st.t) + " / " + lesson.duration;
      }
      draw();
      requestAnimationFrame(loop);
    }

    function setPlayIcon() {
      playBtn.innerHTML = NT.icon(st.playing ? "pause" : "play");
      overlay.classList.toggle("hide", st.playing);
    }
    function toggle() {
      if (st.ended) { st.t = 0; st.ended = false; st.notified = false; }
      var willPlay = !st.playing;
      if (willPlay) NT.store.recordLessonVisit(lesson.id);
      st.playing = willPlay;
      setPlayIcon();
    }
    playBtn.addEventListener("click", toggle);
    overlay.addEventListener("click", toggle);
    seek.addEventListener("input", function () {
      st.t = +seek.value; st.ended = st.t >= dur; st.notified = false;
      timeEl.textContent = NT.fmtSec(st.t) + " / " + lesson.duration;
    });
    speedSel.addEventListener("change", function () { st.speed = +speedSel.value; });
    muteBtn.addEventListener("click", function () {
      st.muted = !st.muted;
      muteBtn.innerHTML = NT.icon(st.muted ? "volume-x" : "volume");
    });
    fullBtn.addEventListener("click", function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else frame.requestFullscreen && frame.requestFullscreen();
    });
    resize();
    requestAnimationFrame(loop);
  }

  /* ============================ CHECKOUT ============================ */
  function pageCheckout() {
    var pkg = D.PACKAGES[NT.qs("pkg")] ? NT.qs("pkg") : "standard";
    var method = "mtn";
    var root = document.getElementById("checkoutRoot");

    function price() { return NT.packagePrice(pkg); }

    function render() {
      var p = NT.packageDetails(pkg);
      root.innerHTML =
        '<div class="split-aside">' +
        '<div class="card card-pad">' +
        '<span class="eyebrow">Demo checkout</span>' +
        '<h2 style="margin:10px 0 8px">Simulated payment</h2>' +
        '<p class="muted small" style="margin-bottom:22px">No money moves and no real account is contacted. Fields below are visual only.</p>' +

        '<div class="field" style="margin-bottom:20px"><span class="lab">1 · Choose your package</span>' +
        '<div class="method-grid method-grid-3">' +
        D.LEVELS.map(function (lv) {
          return '<button type="button" class="method-card pkg-choice' + (pkg === lv ? " selected" : "") + '" data-pkg="' + lv + '" aria-pressed="' + (pkg === lv) + '">' +
            '<span class="pkg-choice-name">' + NT.esc(NT.packageDetails(lv).name) + "</span>" +
            '<span class="pkg-choice-price">' + NT.kwacha(NT.packagePrice(lv)) + "</span>" +
            '<span class="pkg-choice-meta">Unlocks ' + NT.availableFor(lv) + " of " + NT.counts().total + " lessons</span>" +
            '<span class="radio"></span></button>';
        }).join("") + "</div></div>" +

        '<div class="field" style="margin-bottom:20px"><span class="lab">2 · Payment method</span>' +
        '<div class="method-grid">' +
        D.METHODS.map(function (m) {
          return '<button type="button" class="method-card' + (method === m.id ? " selected" : "") + '" data-method="' + m.id + '" aria-pressed="' + (method === m.id) + '">' +
            '<span class="mico">' + NT.icon(m.icon) + "</span><span><b>" + m.name + "</b><small>" + m.hint + "</small></span>" +
            '<span class="radio"></span></button>';
        }).join("") + "</div></div>" +

        '<div id="methodFields"></div>' +
        "</div>" +

        '<aside class="card card-pad" style="position:sticky;top:88px">' +
        "<h3>Order summary</h3>" +
        '<div class="kv" style="margin:14px 0">' +
        '<div class="row"><span>Package</span><b>' + NT.esc(p.name) + "</b></div>" +
        '<div class="row"><span>Access duration</span><b>' + NT.store.get().settings.days + " days</b></div>" +
        '<div class="row"><span>Lessons unlocked</span><b>' + NT.availableFor(pkg) + " of " + NT.counts().total + "</b></div>" +
        '<div class="row"><span>Amount</span><b style="font-size:18px">' + NT.kwacha(price()) + "</b></div>" +
        "</div>" +
        '<ul class="price-feats" style="margin-bottom:18px">' + p.features.map(function (f) { return "<li>" + NT.icon("check") + "<span>" + NT.esc(f) + "</span></li>"; }).join("") + "</ul>" +
        '<button class="btn btn-primary btn-block btn-lg" id="payBtn">' + NT.icon("shield-check") + "Pay " + NT.kwacha(price()) + " (demo)</button>" +
        '<p class="tiny muted center" style="margin-top:12px">Demo price — no real charge</p>' +
        "</aside></div>";

      renderFields();

      root.querySelectorAll("[data-pkg]").forEach(function (b) {
        b.addEventListener("click", function () { pkg = b.dataset.pkg; render(); });
      });
      root.querySelectorAll("[data-method]").forEach(function (b) {
        b.addEventListener("click", function () { method = b.dataset.method; render(); });
      });
      document.getElementById("payBtn").addEventListener("click", pay);
    }

    function renderFields() {
      var box = document.getElementById("methodFields");
      if (method === "card") {
        box.innerHTML =
          '<div class="stack" style="gap:14px"><div class="field"><label for="payCard">Card number</label>' +
          '<input class="input mono" id="payCard" inputmode="numeric" placeholder="4242 4242 4242 4242" maxlength="19" value="4242 4242 4242 4242">' +
          '<span class="field-hint">Visual only — never sent anywhere.</span></div>' +
          '<div class="input-row"><div class="field"><label for="payExpiry">Expiry</label><input class="input mono" id="payExpiry" placeholder="MM/YY" value="12/28"></div>' +
          '<div class="field"><label for="payCvc">CVC</label><input class="input mono" id="payCvc" placeholder="123" value="123" maxlength="4"></div></div></div>';
      } else {
        var m = D.METHODS.filter(function (x) { return x.id === method; })[0];
        box.innerHTML =
          '<div class="field"><label for="payWallet">' + m.name + ' number</label>' +
          '<input class="input mono" id="payWallet" inputmode="tel" placeholder="097X XXX XXX" value="0977 000 000">' +
          '<span class="field-hint">Visual only — no prompt is sent to any phone.</span></div>';
      }
    }

    function pay() {
      var steps = ["Contacting " + D.METHODS.filter(function (m) { return m.id === method; })[0].name + " (simulated)", "Confirming payment of " + NT.kwacha(price()), "Issuing your access code"];
      var ov = document.createElement("div");
      ov.className = "processing";
      ov.innerHTML = '<div class="box"><div class="spinner"></div><h3>Processing payment</h3>' +
        '<p class="muted small" style="margin-top:6px">Demo transaction — nothing is charged.</p>' +
        '<ul class="proc-steps">' + steps.map(function (s, i) { return '<li data-i="' + i + '">' + NT.icon("clock") + s + "</li>"; }).join("") + "</ul></div>";
      document.body.appendChild(ov);
      var lis = ov.querySelectorAll(".proc-steps li");
      var i = 0;
      var timer = setInterval(function () {
        if (i > 0) { lis[i - 1].classList.remove("on"); lis[i - 1].classList.add("done"); lis[i - 1].innerHTML = NT.icon("check") + steps[i - 1]; }
        if (i < lis.length) { lis[i].classList.add("on"); lis[i].innerHTML = NT.icon("clock") + steps[i]; i++; }
        else { clearInterval(timer); setTimeout(function () { ov.remove(); success(); }, 350); }
      }, 620);
    }

    function success() {
      var code = NT.store.genCode(pkg);
      var ref = NT.store.genRef();
      var mName = D.METHODS.filter(function (m) { return m.id === method; })[0].name;
      NT.store.addCode(code, pkg, "redeemed");
      NT.store.addPayment({ ref: ref, student: "Demo Student (you)", pkg: pkg, method: mName, amount: price(), date: new Date().toISOString().slice(0, 10) });
      NT.store.setAccess(pkg, { code: code, source: "payment", method: mName, ref: ref });

      root.innerHTML =
        '<div class="panel panel-narrow"><div class="unlock-result">' +
        '<div class="big-ico">' + NT.icon("check-circle", "icon-xl") + "</div>" +
        "<h2>Payment successful</h2>" +
        '<p class="videos-line" style="margin-top:10px">Your ' + D.LEVEL_LABEL[pkg] + " access is active — <b>" + NT.availableFor(pkg) + " of " + NT.counts().total + "</b> lessons are now available.</p>" +
        '<div class="receipt">' +
        '<div class="rrow"><span>Package purchased</span><b>' + NT.esc(NT.packageDetails(pkg).name) + " · " + NT.kwacha(price()) + "</b></div>" +
        '<div class="rrow"><span>Payment method</span><b>' + mName + " (demo)</b></div>" +
        '<div class="rrow"><span>Transaction reference</span><b class="mono">' + ref + "</b></div>" +
        '<div class="rrow code"><span>Access code</span><b>' + code + "</b></div>" +
        "</div>" +
        '<div class="btns" style="justify-content:center">' +
        '<button class="btn btn-secondary" id="copyCode">' + NT.icon("copy") + "Copy code</button>" +
        '<a class="btn btn-secondary" href="' + NT.base() + 'library.html">' + NT.icon("library") + "Open library</a>" +
        '<a class="btn btn-primary btn-lg" href="' + NT.base() + 'dashboard.html">' + NT.icon("layout-dashboard") + "Go to Dashboard</a>" +
        "</div>" +
        '<p class="tiny muted" style="margin-top:14px">Keep this code — it also appears in the admin Access Codes list as redeemed.</p>' +
        "</div></div>";
      document.getElementById("copyCode").addEventListener("click", function () { NT.copy(code); });
      NT.toast("Payment successful — " + D.LEVEL_LABEL[pkg] + " access active", "success");
    }

    render();
  }

  /* ============================ router ============================ */
  var routes = {
    home: pageHome, courses: pageCourses, course: pageCourse, pricing: pagePricing, access: pageAccess,
    control: pageControl, library: pageLibrary, resources: pageResources, search: pageSearch,
    announcements: pageAnnouncements, profile: pageProfile, dashboard: pageDashboard,
    lesson: pageLesson, checkout: pageCheckout
  };

  document.addEventListener("DOMContentLoaded", function () {
    NT.renderHeader();
    NT.renderFooter();
    NT.renderDemoBanner();
    var page = document.body.dataset.page;
    if (routes[page]) routes[page]();
    NT.initReveal();
  });
})();
