/* ============================================================
   NUCLEAR TUTORIALS — Public site behaviour
   Routing by <body data-page="...">
   ============================================================ */
(function () {
  var D = NT.data;

  /* ============================ shared renderers ============================ */

  NT.renderPricingCards = function (el, compact) {
    var s = NT.store.get();
    el.innerHTML = D.LEVELS.map(function (id) {
      var p = NT.packageDetails(id);
      var price = NT.packagePrice(id);
      var feats = p.features.map(function (f) {
        return "<li>" + NT.icon("check") + "<span>" + NT.esc(f) + "</span></li>";
      }).join("");
      var current = s.access === id;
      return '<div class="card card-hover price-card' + (p.popular ? " popular" : "") + '">' +
        (p.popular ? '<span class="popular-tag">Most Popular</span>' : "") +
        '<span class="price-name t-' + id + '">' + NT.esc(p.name) + "</span>" +
        '<div class="price-amount"><b>' + NT.kwacha(price) + '</b><span>/ ' + s.settings.days + ' days</span></div>' +
        '<p class="price-desc">' + NT.esc(p.tagline) + "</p>" +
        '<ul class="price-feats">' + feats + "</ul>" +
        (current
          ? '<button class="btn btn-secondary btn-block" disabled>' + NT.icon("check-circle") + "Current package</button>"
          : '<a class="btn ' + (p.popular ? "btn-primary" : "btn-secondary") + ' btn-block" href="' + NT.base() + 'checkout.html?pkg=' + id + '">' + NT.icon("arrow-right") + "Get access</a>") +
        "</div>";
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

  function courseAccessState(course) {
    var lessons = NT.courseLessons(course.id);
    var unlocked = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); });
    var done = unlocked.filter(function (lesson) { return NT.store.isComplete(lesson.id); }).length;
    if (!unlocked.length) return { id: "locked", label: "Locked", done: 0, unlocked: 0, total: lessons.length };
    if (done === lessons.length && lessons.length) return { id: "completed", label: "Completed", done: done, unlocked: unlocked.length, total: lessons.length };
    if (done > 0) return { id: "in-progress", label: "In progress", done: done, unlocked: unlocked.length, total: lessons.length };
    return { id: "unlocked", label: "Unlocked", done: 0, unlocked: unlocked.length, total: lessons.length };
  }

  /* Wording for education pathways lives in ui.js so the public site and the
     admin console cannot drift apart. */
  function coursePathwayLabel(path) { return NT.pathwayLabel(path); }

  NT.renderCourseCard = function (course) {
    var lessons = NT.courseLessons(course.id);
    var prog = courseProgress(course);
    var status = courseAccessState(course);
    var subject = NT.subject(course.subjectId) || { title: course.title };
    var pathwayChips = NT.coursePathways(course).map(function (path) { return NT.pathwayChip(path); }).join("");
    var statusIcon = status.id === "locked" ? "lock" : status.id === "completed" ? "circle-check" : status.id === "in-progress" ? "play-circle" : "unlock";
    var accessText = status.id === "locked" ? "Choose a package to unlock lessons" :
      status.unlocked + " of " + status.total + " lessons included";
    return '<article class="card card-hover course-card" style="--tint:' + course.tint + ";--tint-fg:" + course.tintFg + '">' +
      '<div class="course-card-top"><div class="course-icon">' + NT.icon(course.icon) + "</div>" +
      '<span class="course-state course-state-' + status.id + '">' + NT.icon(statusIcon) + status.label + "</span></div>" +
      '<div class="course-pathway-tags">' + pathwayChips + "</div>" +
      '<span class="course-subject">' + NT.esc(subject.title) + " · Subject" + "</span>" +
      "<h3>" + NT.esc(course.title) + "</h3>" +
      '<p class="desc">' + NT.esc(course.desc) + "</p>" +
      '<div class="course-meta"><span>' + NT.icon("play-circle", "icon-sm") + lessons.length + " lessons</span>" +
      '<span>' + NT.icon(statusIcon, "icon-sm") + NT.esc(accessText) + "</span></div>" +
      (prog ? '<div class="course-progress"><div class="progress"><i style="width:' + prog.pct + '%"></i></div><span>' + prog.done + "/" + prog.total + " available lessons completed</span></div>" : "") +
      '<div class="course-foot"><a class="link-arrow" href="' + NT.base() + "library.html?course=" + encodeURIComponent(course.id) + '">Browse lessons ' + NT.icon("arrow-right", "icon-sm") + "</a>" +
      '<a class="link-arrow muted" href="' + NT.base() + "courses.html?subject=" + encodeURIComponent(course.subjectId) + '#' + encodeURIComponent(course.id) + '">Course details</a></div>' +
      "</article>";
  };

  function lessonRow(l, showCourse) {
    var unlocked = NT.isUnlocked(l);
    var done = NT.store.isComplete(l.id);
    return '<div class="list-row">' +
      '<div class="lico" style="background:' + (NT.course(l.courseId) || {}).tint + ";color:" + (NT.course(l.courseId) || {}).tintFg + '">' +
      NT.icon(done ? "circle-check" : unlocked ? "play-circle" : "lock") + "</div>" +
      '<div class="grow"><b>' + l.title + "</b><small>" +
      (showCourse ? l.courseTitle + " · " : "") + l.duration + " · " + D.LEVEL_LABEL[NT.levelOf(l)] +
      (done ? " · Completed" : "") + "</small></div>" +
      (unlocked
        ? '<a class="btn btn-sm btn-secondary" href="' + NT.base() + "lesson.html?id=" + l.id + '">' + (done ? "Review" : "Watch") + "</a>"
        : NT.levelBadge(NT.levelOf(l), true)) +
      "</div>";
  }

  /* ============================ HOME ============================ */
  function pageHome() {
    var counts = NT.counts();
    document.getElementById("statCourses").textContent = D.COURSES.length;
    document.getElementById("statVideos").textContent = counts.total;
    document.getElementById("statLevels").textContent = D.EDUCATION_LEVELS.length;
    document.getElementById("courseGrid").innerHTML = D.COURSES.map(NT.renderCourseCard).join("");
    NT.renderPricingCards(document.getElementById("pricingGrid"));
    /* Pathway figures come straight from the catalogue — no invented numbers. */
    D.EDUCATION_LEVELS.forEach(function (level) {
      var slot = document.getElementById("pathwayMeta-" + level.id);
      if (!slot) return;
      var figures = NT.pathwayCounts(level.id);
      slot.innerHTML = '<span>' + NT.icon("book-open", "icon-sm") + figures.courses + " courses</span>" +
        '<span>' + NT.icon("play-circle", "icon-sm") + figures.lessons + " tutorial videos</span>" +
        '<span>' + NT.icon("unlock", "icon-sm") + "Access by package</span>";
    });
  }

  /* ============================ COURSES ============================ */
  function pageCourses() {
    var wrap = document.getElementById("courseList");
    var education = document.getElementById("courseEducation");
    var subject = document.getElementById("courseSubject");
    var schoolLevel = document.getElementById("courseSchoolLevel");
    var university = document.getElementById("courseUniversity");
    var programme = document.getElementById("courseProgramme");
    var search = document.getElementById("courseSearch");
    var summary = document.getElementById("courseResults");
    var clear = document.getElementById("clearCourseFilters");

    function optionMarkup(items, valueKey, labelKey, firstLabel) {
      return '<option value="">' + firstLabel + "</option>" + items.map(function (item) {
        return '<option value="' + NT.esc(item[valueKey]) + '">' + NT.esc(item[labelKey]) + "</option>";
      }).join("");
    }

    education.innerHTML = optionMarkup(D.EDUCATION_LEVELS, "id", "label", "All education levels");
    subject.innerHTML = optionMarkup(D.SUBJECTS, "id", "title", "All subjects");
    schoolLevel.innerHTML = optionMarkup(D.HIGH_SCHOOL_LEVELS, "id", "label", "All grades / forms");
    university.innerHTML = optionMarkup(D.UNIVERSITIES, "id", "name", "All universities");

    var profile = NT.store.get().profile || {};
    var queryLevel = NT.qs("level") || profile.educationLevel;
    var querySubject = NT.qs("subject") || profile.subjectId;
    if (D.EDUCATION_LEVELS.some(function (item) { return item.id === queryLevel; })) education.value = queryLevel;
    if (D.SUBJECTS.some(function (item) { return item.id === querySubject; })) subject.value = querySubject;
    if (profile.levelId) schoolLevel.value = profile.levelId;
    if (!D.UNIVERSITIES.length) {
      university.options[0].textContent = "No university names listed in this demo";
      university.disabled = true;
    }

    function updateProgrammeOptions() {
      var list = D.PROGRAMMES.filter(function (item) { return !university.value || item.universityId === university.value; });
      programme.innerHTML = '<option value="">All programmes / schools</option>' + list.map(function (item) {
        return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.name + " · " + item.school) + "</option>";
      }).join("");
      programme.disabled = !list.length;
      if (!list.length) programme.options[0].textContent = "No programme names listed in this demo";
    }

    function currentOfferings(course) {
      return NT.coursePathways(course).filter(function (path) {
        if (education.value && path.educationLevel !== education.value) return false;
        if (path.educationLevel === "high-school" && schoolLevel.value && path.levelId !== schoolLevel.value) return false;
        if (path.educationLevel === "university" && university.value && path.universityId !== university.value) return false;
        if (path.educationLevel === "university" && programme.value && path.programmeId !== programme.value) return false;
        return true;
      });
    }

    /* Prominent pathway (education level) selector. It drives the same
       #courseEducation filter as the refine panel, so both stay in sync. */
    var pathwayTabHost = document.getElementById("pathwayTabs");
    function renderPathwayTabs() {
      if (!pathwayTabHost) return;
      /* Keep keyboard focus on the tab the visitor just used. */
      var focusedPathway = pathwayTabHost.contains(document.activeElement) ? document.activeElement.dataset.pathway : null;
      var options = [{ id: "", label: "All pathways", icon: "layers" }].concat(D.EDUCATION_LEVELS.map(function (item) {
        return { id: item.id, label: item.label, icon: NT.pathwayIcon(item.id) };
      }));
      pathwayTabHost.innerHTML = options.map(function (option) {
        var active = (education.value || "") === option.id;
        var figures = option.id ? NT.pathwayCounts(option.id) : { courses: D.COURSES.length, lessons: NT.allLessons().length };
        var count = figures.courses + (figures.courses === 1 ? " course" : " courses");
        return '<button type="button" class="pathway-tab' + (active ? " active" : "") + '" data-pathway="' + option.id + '" aria-pressed="' + active + '"' +
          ' aria-label="' + NT.esc(option.label + ", " + count) + '">' +
          NT.icon(option.icon) + "<span>" + NT.esc(option.label) + '</span><span class="count" aria-hidden="true">' + figures.courses + "</span></button>";
      }).join("");
      pathwayTabHost.querySelectorAll("[data-pathway]").forEach(function (button) {
        button.addEventListener("click", function () {
          education.value = button.dataset.pathway;
          refreshPathwayControls();
          render();
        });
      });
      if (focusedPathway !== null) {
        var refocus = pathwayTabHost.querySelector('[data-pathway="' + focusedPathway + '"]');
        if (refocus) refocus.focus();
      }
    }
    function syncUrl() {
      if (!window.history || !window.history.replaceState) return;
      var url = new URL(window.location.href);
      if (education.value) url.searchParams.set("level", education.value); else url.searchParams.delete("level");
      if (subject.value) url.searchParams.set("subject", subject.value); else url.searchParams.delete("subject");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }

    function courseCard(course, offerings) {
      var lessons = NT.courseLessons(course.id);
      var subjectInfo = NT.subject(course.subjectId) || { title: course.title, icon: course.icon };
      var counts = { basic: 0, standard: 0, premium: 0 };
      lessons.forEach(function (lesson) { counts[NT.levelOf(lesson)]++; });
      var progress = courseProgress(course);
      var path = education.value ? offerings[0] : null;
      var status = courseAccessState(course);
      var unlockedCount = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); }).length;
      var pathwayChips = (path ? [path] : offerings).map(function (item) { return NT.pathwayChip(item); }).join("");
      var statusIcon = status.id === "locked" ? "lock" : status.id === "completed" ? "circle-check" : status.id === "in-progress" ? "play-circle" : "unlock";
      var lessonRows = lessons.map(function (lesson) {
        var unlocked = NT.isUnlocked(lesson);
        var done = NT.store.isComplete(lesson.id);
        return '<div class="course-lesson-row">' +
          '<span class="lesson-index">' + String(lesson.index).padStart(2, "0") + '</span>' +
          '<span class="course-lesson-state" style="--tint:' + course.tint + ';--tint-fg:' + course.tintFg + '">' + NT.icon(done ? "circle-check" : unlocked ? "play" : "lock", "icon-sm") +
          '<span class="sr-only">' + (done ? "Completed" : unlocked ? "Unlocked" : "Locked") + "</span></span>" +
          '<span class="course-lesson-title"><b>' + NT.esc(lesson.title) + '</b><small>' + NT.esc(lesson.duration) + " min · " + D.LEVEL_LABEL[NT.levelOf(lesson)] + " access</small></span>" +
          (done ? '<span class="badge badge-success">Completed</span>' : unlocked ? '<a class="btn btn-sm btn-secondary" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(lesson.id) + '" aria-label="Watch ' + NT.esc(lesson.title) + '">Watch</a>' : NT.levelBadge(NT.levelOf(lesson), true)) +
          "</div>";
      }).join("");
      var activePackage = NT.store.get().access;
      var accessSummary = activePackage
        ? unlockedCount + " of " + lessons.length + " lessons included · " + NT.packageDetails(activePackage).name
        : "Locked · Basic access starts at " + NT.kwacha(NT.packagePrice("basic"));
      var catalogFacts = '<div class="catalog-facts"><span>' + NT.icon("play-circle", "icon-sm") + lessons.length + " lessons</span>" +
        '<span>' + NT.icon(unlockedCount ? "unlock" : "lock", "icon-sm") + NT.esc(accessSummary) + "</span></div>";
      var open = NT.qs("course") === course.id || location.hash === "#" + course.id ? " open" : "";
      return '<article class="card course-catalog-card" id="' + NT.esc(course.id) + '">' +
        '<div class="catalog-card-main">' +
        '<div class="catalog-card-top"><span class="course-icon" style="--tint:' + course.tint + ';--tint-fg:' + course.tintFg + '">' + NT.icon(course.icon) + '</span>' +
        '<span class="course-state course-state-' + status.id + '">' + NT.icon(statusIcon) + status.label + "</span></div>" +
        '<div class="course-pathway-tags">' + pathwayChips + "</div>" +
        '<span class="course-subject">' + NT.esc(subjectInfo.title) + " · Subject course</span>" +
        '<h2>' + NT.esc(course.title) + '</h2>' +
        '<p class="course-description">' + NT.esc(course.desc) + "</p>" + catalogFacts +
        (progress ? '<div class="catalog-progress"><div class="progress"><i style="width:' + progress.pct + '%"></i></div><span>' + progress.done + "/" + progress.total + " complete</span></div>" : "") +
        '<div class="access-levels"><span>Access by lesson</span><div class="tier-dots">' +
        '<span class="tier-dot b">Basic ' + counts.basic + '</span><span class="tier-dot s">Standard ' + counts.standard + '</span><span class="tier-dot p">Premium ' + counts.premium + "</span></div></div>" +
        '<details class="course-lessons"' + open + '><summary><span>View course lessons</span><span>' + lessons.length + ' lessons ' + NT.icon("chevron-down", "icon-sm") + "</span></summary>" +
        '<div class="course-lesson-list">' + lessonRows + "</div></details>" +
        '<div class="catalog-actions"><a class="link-arrow" href="' + NT.base() + "library.html?course=" + encodeURIComponent(course.id) + '">Open in library ' + NT.icon("arrow-right", "icon-sm") + "</a>" +
        '<a class="link-arrow muted" href="' + NT.base() + 'pricing.html">Compare packages</a></div>' +
        "</div></article>";
    }

    function render() {
      var query = search.value.trim().toLowerCase();
      var list = D.COURSES.map(function (course) {
        return { course: course, offerings: currentOfferings(course) };
      }).filter(function (entry) {
        var course = entry.course;
        var subjectInfo = NT.subject(course.subjectId) || { title: course.title };
        if (!entry.offerings.length) return false;
        if (subject.value && course.subjectId !== subject.value) return false;
        if (query && (course.title + " " + course.desc + " " + subjectInfo.title).toLowerCase().indexOf(query) === -1) return false;
        return true;
      });
      wrap.innerHTML = list.length
        ? list.map(function (entry) { return courseCard(entry.course, entry.offerings); }).join("")
        : '<div class="card course-empty"><span class="course-empty-icon">' + NT.icon("search", "icon-lg") + '</span><h2>No courses match these filters</h2><p>Try another subject, education level, university or search term.</p><button class="btn btn-secondary" type="button" id="emptyClear">Clear filters</button></div>';
      var activeLevel = education.value ? NT.educationLevel(education.value) : null;
      summary.innerHTML = '<span><b>' + list.length + "</b> " + (list.length === 1 ? "course" : "courses") + " found" +
        (activeLevel ? " · " + NT.esc(activeLevel.label) + " pathway" : "") + "</span>" +
        '<span class="tiny muted">Sample course catalogue · new subjects and programmes can be added over time</span>';
      renderPathwayTabs();
      syncUrl();
      var emptyClear = document.getElementById("emptyClear");
      if (emptyClear) emptyClear.addEventListener("click", clearFilters);
    }

    function refreshPathwayControls() {
      var level = education.value;
      document.getElementById("schoolLevelFilter").classList.toggle("hidden", level !== "high-school");
      document.getElementById("universityFilter").classList.toggle("hidden", level !== "university");
      document.getElementById("universityFilterNote").classList.toggle("hidden", level !== "university" || D.UNIVERSITIES.length > 0);
      updateProgrammeOptions();
    }

    function clearFilters() {
      education.value = "";
      subject.value = "";
      schoolLevel.value = "";
      university.value = "";
      programme.value = "";
      search.value = "";
      refreshPathwayControls();
      render();
    }

    var catalogueFacts = document.getElementById("catalogueFacts");
    if (catalogueFacts) {
      catalogueFacts.innerHTML = NT.icon("library", "icon-sm") + D.COURSES.length + " sample courses · " + NT.allLessons().length + " tutorial videos";
    }

    education.addEventListener("change", function () { refreshPathwayControls(); render(); });
    subject.addEventListener("change", render);
    schoolLevel.addEventListener("change", render);
    university.addEventListener("change", function () { updateProgrammeOptions(); render(); });
    programme.addEventListener("change", render);
    search.addEventListener("input", render);
    clear.addEventListener("click", clearFilters);
    refreshPathwayControls();
    render();
  }

  /* ============================ PRICING ============================ */
  function pagePricing() {
    NT.renderPricingCards(document.getElementById("pricingGrid"));
    var yes = '<span class="yes">' + NT.icon("check") + "</span>";
    var no = '<span class="no">' + NT.icon("lock", "icon-sm") + "</span>";
    var days = NT.store.get().settings.days;
    document.getElementById("cmpHead").innerHTML = "<tr><th>Feature</th>" + D.LEVELS.map(function (level) {
      var pkg = NT.packageDetails(level);
      return "<th>" + NT.esc(pkg.name) + " · " + NT.kwacha(NT.packagePrice(level)) + "</th>";
    }).join("") + "</tr>";
    var rows = [
      ["Basic lessons in every course", yes, yes, yes],
      ["Standard lessons in every course", no, yes, yes],
      ["Premium advanced lessons", no, no, yes],
      ["Access code issued on payment", yes, yes, yes],
      ["Progress tracking", no, yes, yes],
      ["Full video library", no, no, yes],
      ["New videos as they are released", no, no, yes],
      ["Access duration", days + " days", days + " days", days + " days"]
    ];
    document.getElementById("cmpBody").innerHTML = rows.map(function (row) {
      return '<tr><td data-label="Feature">' + NT.esc(row[0]) + "</td>" + D.LEVELS.map(function (level, index) {
        return '<td data-label="' + NT.esc(NT.packageDetails(level).name) + '">' + row[index + 1] + "</td>";
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
        '<div class="row"><span>Videos unlocked</span><b>' + NT.availableFor(s.access) + " of " + NT.counts().total + "</b></div>" +
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
        '<div class="row-between" style="justify-content:center;gap:12px;flex-wrap:wrap">' +
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
    var s = NT.store.get();

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
          (viewing ? '<span class="viewing-tag">Viewing now</span>' : "") +
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
      /* matrix */
      document.getElementById("matrixBody").innerHTML = D.LEVELS.map(function (lessonLv) {
        return "<tr><td>" + D.LEVEL_LABEL[lessonLv] + " lessons</td>" + D.LEVELS.map(function (persona) {
          var ok = D.LEVEL_RANK[persona] >= D.LEVEL_RANK[lessonLv];
          return '<td class="' + (ok ? "yes" : "no") + '" data-label="' + D.LEVEL_LABEL[persona] + '">' + NT.icon(ok ? "check-circle" : "lock", "icon-sm") + "</td>";
        }).join("") + "</tr>";
      }).join("");
      /* sample tiles */
      var samples = ["math-1", "math-5", "math-7", "phys-4", "chem-8", "cs-2"].map(NT.lesson).filter(Boolean);
      document.getElementById("previewGrid").innerHTML = samples.map(function (l) {
        var unlocked = NT.isUnlocked(l);
        var c = NT.course(l.courseId);
        return '<a class="card lesson-card' + (unlocked ? "" : " locked") + '" href="' + NT.base() + "library.html?course=" + l.courseId + '" style="text-decoration:none">' +
          '<div class="thumb" style="--thumb-bg:' + c.thumb + '">' + NT.thumbArt(c) +
          '<span class="thumb-icon">' + NT.icon(c.icon) + "</span>" +
          '<span class="lvl">' + NT.levelBadge(NT.levelOf(l)) + "</span>" +
          '<span class="dur">' + l.duration + "</span>" +
          (unlocked ? "" : '<div class="lock-scrim"><div class="lockbox"><span class="ring">' + NT.icon("lock") + "</span>Locked</div></div>") +
          "</div>" +
          '<div class="lesson-body"><span class="lesson-course">' + l.courseTitle + '</span><span class="lesson-title">' + l.title + "</span>" +
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
    var grid = document.getElementById("lessonGrid");
    var fCourse = document.getElementById("fCourse");
    var fLevel = document.getElementById("fLevel");
    var fStatus = document.getElementById("fStatus");
    var fSearch = document.getElementById("fSearch");
    var summary = document.getElementById("libSummary");

    var pre = NT.qs("course");
    if (pre && NT.course(pre)) fCourse.value = pre;

    function card(l) {
      var c = NT.course(l.courseId) || { tint: "#eef2f6", tintFg: "#40566d", thumb: "linear-gradient(135deg,#274b63,#101c2a)", icon: "video", title: l.courseTitle };
      var unlocked = NT.isUnlocked(l);
      var done = NT.store.isComplete(l.id);
      return '<article class="card card-hover lesson-card' + (unlocked ? "" : " locked") + '" data-lesson="' + l.id + '">' +
        '<div class="thumb" style="--thumb-bg:' + c.thumb + '">' + NT.thumbArt(c) +
        '<span class="thumb-icon">' + NT.icon(c.icon) + "</span>" +
        '<span class="lvl">' + NT.levelBadge(NT.levelOf(l)) + "</span>" +
        '<span class="dur">' + l.duration + "</span>" +
        (unlocked
          ? '<div class="playbadge"><span class="pico">' + NT.icon("play") + "</span></div>"
          : '<div class="lock-scrim"><div class="lockbox"><span class="ring">' + NT.icon("lock") + "</span>" + D.LEVEL_LABEL[NT.levelOf(l)] + " only</div></div>") +
        "</div>" +
        '<div class="lesson-body">' +
        '<span class="lesson-course">' + NT.esc(l.courseTitle) + "</span>" +
        '<span class="lesson-title">' + NT.esc(l.title) + "</span>" +
        '<div class="lesson-meta"><span>' + NT.icon("clock", "icon-sm") + l.duration + "</span>" +
        (done ? '<span class="badge badge-success">' + NT.icon("circle-check") + "Completed</span>" : "") +
        "</div>" +
        '<div class="lesson-foot">' +
        (unlocked
          ? '<a class="btn btn-primary btn-sm" href="' + NT.base() + "lesson.html?id=" + l.id + '">' + NT.icon("play", "icon-sm") + "Watch now</a>"
          : '<a class="btn btn-secondary btn-sm" href="' + NT.base() + 'pricing.html">' + NT.icon("lock", "icon-sm") + "Unlock with " + D.LEVEL_LABEL[NT.levelOf(l)] + "</a>") +
        '<span class="tiny muted">' + (unlocked ? "Included in your package" : D.LEVEL_LABEL[NT.levelOf(l)] + " package required") + "</span>" +
        "</div></div></article>";
    }

    function render() {
      var s = NT.store.get();
      var all = NT.allLessons();
      var q = fSearch.value.trim().toLowerCase();
      var list = all.filter(function (l) {
        if (fCourse.value && l.courseId !== fCourse.value) return false;
        if (fLevel.value && NT.levelOf(l) !== fLevel.value) return false;
        if (fStatus.value === "unlocked" && !NT.isUnlocked(l)) return false;
        if (fStatus.value === "locked" && NT.isUnlocked(l)) return false;
        if (q && (l.title + " " + l.courseTitle).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      grid.innerHTML = list.length
        ? list.map(card).join("")
        : '<div class="gate card"><div class="big-ico">' + NT.icon("search") + "</div><h3>No lessons match those filters</h3><p>Try clearing the search or choosing a different course.</p></div>";
      var unlockedCount = all.filter(function (l) { return NT.isUnlocked(l); }).length;
      summary.innerHTML = '<span class="badge badge-brand">' + NT.icon("library") + list.length + " of " + all.length + " lessons shown</span>" +
        (s.access
          ? '<span class="badge badge-success">' + NT.icon("unlock") + unlockedCount + " unlocked with " + D.LEVEL_LABEL[s.access] + "</span>"
          : '<span class="badge badge-warn">' + NT.icon("lock") + "Visitor view — redeem a code or pick a package to unlock</span>");
    }

    [fCourse, fLevel, fStatus].forEach(function (el) { el.addEventListener("change", render); });
    fSearch.addEventListener("input", render);
    render();

    if (!NT.store.get().access) {
      document.getElementById("libGate").classList.remove("hidden");
    }
  }

  /* ============================ RESOURCES ============================ */
  function pageResources() {
    var search = document.getElementById("resourceSearch");
    var level = document.getElementById("resourceLevel");
    var subject = document.getElementById("resourceSubject");
    var list = document.getElementById("resourceCourses");
    var summary = document.getElementById("resourceSummary");
    var types = document.getElementById("resourceTypes");

    level.innerHTML = '<option value="">All education levels</option>' + D.EDUCATION_LEVELS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.label) + "</option>";
    }).join("");
    subject.innerHTML = '<option value="">All subjects</option>' + D.SUBJECTS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.title) + "</option>";
    }).join("");
    types.innerHTML = D.RESOURCE_TYPES.map(function (type) {
      var available = type.available;
      var content = '<span class="resource-type-icon">' + NT.icon(available ? "video" : "file-text") + "</span>" +
        '<span class="resource-type-copy"><b>' + NT.esc(type.label) + '</b><small>' + NT.esc(type.description) + "</small></span>" +
        (available
          ? '<span class="resource-type-status available">' + NT.icon("check-circle", "icon-sm") + NT.allLessons().length + " videos</span>"
          : '<span class="resource-type-status">Not in this demo</span>');
      return available
        ? '<a class="resource-type resource-type-available" href="' + NT.base() + 'library.html">' + content + NT.icon("arrow-right", "icon-sm") + "</a>"
        : '<div class="resource-type resource-type-unavailable" aria-disabled="true">' + content + "</div>";
    }).join("");

    function renderCourse(course) {
      var lessons = NT.courseLessons(course.id);
      var included = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); }).length;
      var state = courseAccessState(course);
      var subjectInfo = NT.subject(course.subjectId) || { title: course.title };
      var examples = lessons.slice(0, 3).map(function (lesson) {
        var unlocked = NT.isUnlocked(lesson);
        return '<li><span>' + NT.icon(unlocked ? "play-circle" : "lock", "icon-sm") +
          '<b>' + NT.esc(lesson.title) + '</b></span><small>' + NT.esc(lesson.duration) + " · " + NT.esc(D.LEVEL_LABEL[NT.levelOf(lesson)]) + " access</small></li>";
      }).join("");
      return '<article class="card resource-course">' +
        '<div class="resource-course-head"><span class="course-icon" style="--tint:' + course.tint + ';--tint-fg:' + course.tintFg + '">' + NT.icon(course.icon) + '</span>' +
        '<span class="course-state course-state-' + state.id + '">' + NT.icon(state.id === "locked" ? "lock" : state.id === "in-progress" ? "play-circle" : state.id === "completed" ? "circle-check" : "unlock") + state.label + "</span></div>" +
        '<span class="course-subject">' + NT.esc(subjectInfo.title) + " · Tutorial videos</span>" +
        '<h3>' + NT.esc(course.title) + '</h3>' +
        '<p>' + NT.esc(course.desc) + '</p>' +
        '<div class="resource-course-count"><b>' + lessons.length + '</b><span>video lessons' + (NT.store.get().access ? " · " + included + " included with your package" : " · access required") + "</span></div>" +
        '<ul class="resource-example-list">' + examples + "</ul>" +
        '<a class="btn btn-secondary" href="' + NT.base() + "library.html?course=" + encodeURIComponent(course.id) + '">Open video lessons ' + NT.icon("arrow-right", "icon-sm") + "</a>" +
        "</article>";
    }

    function render() {
      var query = search.value.trim().toLowerCase();
      var courses = D.COURSES.filter(function (course) {
        if (subject.value && course.subjectId !== subject.value) return false;
        var offerings = NT.coursePathways(course);
        if (level.value && !offerings.some(function (path) { return path.educationLevel === level.value; })) return false;
        var subjectInfo = NT.subject(course.subjectId) || { title: course.title };
        var lessonNames = NT.courseLessons(course.id).map(function (lesson) { return lesson.title; }).join(" ");
        var haystack = [course.title, course.desc, subjectInfo.title, lessonNames].join(" ").toLowerCase();
        return !query || haystack.indexOf(query) !== -1;
      });
      list.innerHTML = courses.length
        ? courses.map(renderCourse).join("")
        : '<div class="card course-empty"><span class="course-empty-icon">' + NT.icon("search", "icon-lg") + '</span><h2>No video courses match</h2><p>Try another subject or search term.</p></div>';
      summary.textContent = courses.length + " course" + (courses.length === 1 ? "" : "s") + " · " + NT.allLessons().length + " tutorial videos in the current demo catalogue";
    }

    var profile = NT.store.get().profile || {};
    if (profile.educationLevel) level.value = profile.educationLevel;
    if (profile.subjectId) subject.value = profile.subjectId;
    [level, subject].forEach(function (el) { el.addEventListener("change", render); });
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
    var validKinds = ["all", "courses", "lessons", "resources"];
    if (validKinds.indexOf(kind) === -1) kind = "all";
    input.value = NT.qs("q") || "";

    function normal(value) { return String(value || "").toLowerCase().trim(); }
    function matches(fields, query, allowResourceType) {
      if (!query) return false;
      if (allowResourceType && /^(video|videos|tutorial|tutorial video|tutorial videos)$/.test(query)) return true;
      return fields.join(" ").toLowerCase().indexOf(query) !== -1;
    }
    function pathText(course) {
      return NT.coursePathways(course).map(coursePathwayLabel).join(" · ");
    }
    function courseResult(course) {
      var subjectInfo = NT.subject(course.subjectId) || { title: course.title };
      var status = courseAccessState(course);
      var progress = courseProgress(course);
      return '<article class="search-result search-course-result">' +
        '<span class="search-result-icon" style="--tint:' + course.tint + ';--tint-fg:' + course.tintFg + '">' + NT.icon(course.icon) + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>Course</span><span>' + NT.esc(subjectInfo.title) + '</span><span class="course-state course-state-' + status.id + '">' + NT.esc(status.label) + "</span></div>" +
        '<h3>' + NT.esc(course.title) + '</h3><p>' + NT.esc(course.desc) + '</p>' +
        '<div class="course-pathway-tags" style="margin-top:7px">' + NT.coursePathways(course).map(function (path) { return NT.pathwayChip(path); }).join("") + "</div>" +
        '<small>' + NT.courseLessons(course.id).length + " lessons" +
        (progress ? " · " + progress.done + "/" + progress.total + " available lessons complete" : "") + "</small></div>" +
        '<a class="search-result-link" href="' + NT.base() + "courses.html?subject=" + encodeURIComponent(course.subjectId) + '#' + encodeURIComponent(course.id) + '" aria-label="View ' + NT.esc(course.title) + ' course">' + NT.icon("arrow-up-right") + "</a></article>";
    }
    function lessonResult(lesson, resource) {
      var course = NT.course(lesson.courseId) || { tint: "#eef2f6", tintFg: "#40566d", title: lesson.courseTitle, icon: "video" };
      var unlocked = NT.isUnlocked(lesson);
      var done = NT.store.isComplete(lesson.id);
      var label = resource ? "Tutorial video" : "Lesson";
      return '<article class="search-result search-lesson-result">' +
        '<span class="search-result-icon" style="--tint:' + course.tint + ';--tint-fg:' + course.tintFg + '">' + NT.icon(resource ? "video" : "play-circle") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>' + label + '</span><span>' + NT.esc(lesson.courseTitle) + '</span>' +
        (done ? '<span class="search-complete">Completed</span>' : NT.levelBadge(NT.levelOf(lesson))) + "</div>" +
        '<h3>' + NT.esc(lesson.title) + '</h3><p>' + NT.esc(lesson.description || (lesson.courseTitle + " tutorial video lesson.")) + '</p>' +
        '<small>' + NT.esc(lesson.duration) + " · " + NT.esc(D.LEVEL_LABEL[NT.levelOf(lesson)]) + " package access</small></div>" +
        (unlocked
          ? '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(lesson.id) + '">' + NT.icon("play", "icon-sm") + "Open lesson</a>"
          : '<a class="btn btn-secondary btn-sm" href="' + NT.base() + 'pricing.html">' + NT.icon("lock", "icon-sm") + "View packages</a>") +
        "</article>";
    }
    function announcementResult(notice) {
      return '<article class="search-result search-announcement-result">' +
        '<span class="search-result-icon search-announcement-icon">' + NT.icon("bell") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>Announcement</span><span>' + NT.fmtDate(notice.updated || notice.created) + "</span></div>" +
        '<h3>' + NT.esc(notice.title) + '</h3><p>' + NT.esc(notice.body) + "</p></div>" +
        '<a class="search-result-link" href="' + NT.base() + 'announcements.html" aria-label="Read announcement">' + NT.icon("arrow-up-right") + "</a></article>";
    }
    function syncUrl(query) {
      if (!window.history || !window.history.replaceState) return;
      var url = new URL(window.location.href);
      if (query) url.searchParams.set("q", query);
      else url.searchParams.delete("q");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
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
        summary.textContent = "Search the current course and video catalogue.";
        var chips = D.SUBJECTS.map(function (item) {
          return '<button class="search-suggestion" type="button" data-suggestion="' + NT.esc(item.title) + '">' + NT.icon(item.icon) + NT.esc(item.title) + "</button>";
        }).join("");
        results.innerHTML = '<div class="search-start"><span class="search-start-icon">' + NT.icon("search", "icon-lg") + '</span><h2>What are you looking for?</h2><p>Search course names, subjects, lesson titles or tutorial videos. Results come from the current demo catalogue.</p><div class="search-suggestions"><span>Browse a subject</span>' + chips + "</div></div>";
        results.querySelectorAll("[data-suggestion]").forEach(function (button) {
          button.addEventListener("click", function () { input.value = button.dataset.suggestion; render(); input.focus(); });
        });
        return;
      }

      var courses = D.COURSES.filter(function (course) {
        var subjectInfo = NT.subject(course.subjectId) || { title: course.title };
        var lessonTitles = NT.courseLessons(course.id).map(function (lesson) { return lesson.title; }).join(" ");
        return matches([course.title, subjectInfo.title, course.desc, pathText(course), lessonTitles], query, false);
      });
      var lessons = NT.allLessons().filter(function (lesson) {
        var course = NT.course(lesson.courseId) || {};
        var subjectInfo = NT.subject(course.subjectId) || { title: lesson.courseTitle };
        return matches([lesson.title, lesson.courseTitle, lesson.description, course.desc, subjectInfo.title], query, true);
      });
      var notices = publishedAnnouncements().filter(function (notice) {
        return matches([notice.title, notice.body], query, false);
      });
      var count = (kind === "courses" ? courses.length : 0) +
        ((kind === "lessons" || kind === "resources" || kind === "all") ? lessons.length : 0) +
        (kind === "all" ? notices.length : 0);
      summary.textContent = count + " result" + (count === 1 ? "" : "s") + " for “" + input.value.trim() + "”";
      var parts = [];
      if (kind === "all" || kind === "courses") {
        if (courses.length) parts.push('<section class="search-result-section"><div class="search-section-heading"><h2>Courses & subjects</h2><span>' + courses.length + "</span></div>" + courses.map(courseResult).join("") + "</section>");
      }
      if (kind === "all" || kind === "lessons" || kind === "resources") {
        if (lessons.length) {
          var sectionLabel = kind === "resources" ? "Tutorial videos" : kind === "lessons" ? "Lessons" : "Lessons & tutorial videos";
          parts.push('<section class="search-result-section"><div class="search-section-heading"><h2>' + sectionLabel + '</h2><span>' + lessons.length + "</span></div>" + lessons.map(function (lesson) { return lessonResult(lesson, kind === "resources"); }).join("") + "</section>");
        }
      }
      if (kind === "all" && notices.length) {
        parts.push('<section class="search-result-section"><div class="search-section-heading"><h2>Announcements</h2><span>' + notices.length + "</span></div>" + notices.map(announcementResult).join("") + "</section>");
      }
      results.innerHTML = parts.length ? parts.join("") : '<div class="search-empty"><span class="search-start-icon">' + NT.icon("search", "icon-lg") + '</span><h2>No matching results</h2><p>Try another course, subject, lesson title or search for tutorial videos.</p><a class="link-arrow" href="' + NT.base() + 'courses.html">Browse the course catalogue ' + NT.icon("arrow-right", "icon-sm") + "</a></div>";
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
      root.innerHTML = '<div class="announcement-empty"><span class="announcement-empty-icon">' + NT.icon("bell", "icon-lg") + "</span>" +
        '<span class="eyebrow">Student updates</span><h2>No announcements yet</h2>' +
        '<p>There are no published updates at the moment. When Nuclear Tutorials posts a notice, it will appear here.</p>' +
        '<a class="btn btn-secondary" href="' + NT.base() + 'courses.html">Continue to courses ' + NT.icon("arrow-right", "icon-sm") + "</a></div>";
      return;
    }
    root.innerHTML = '<div class="announcement-list">' + items.map(function (notice) {
      var body = NT.esc(notice.body || "").replace(/\n/g, "<br>");
      return '<article class="announcement-item"><div class="announcement-item-date"><span>' + NT.icon("calendar", "icon-sm") + NT.fmtDate(notice.updated || notice.created) + "</span><span class=\"announcement-marker\"></span></div>" +
        '<div class="announcement-item-body"><span class="eyebrow">Nuclear Tutorials update</span><h2>' + NT.esc(notice.title) + '</h2><p>' + body + "</p></div></article>";
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
          ? "University" + (profile.university ? " · " + NT.esc(profile.university) : "") + (profile.programme ? " · " + NT.esc(profile.programme) : "")
          : "Choose a level to personalise course browsing";
      document.getElementById("profileSummary").innerHTML =
        '<div class="profile-summary-identity"><span class="profile-avatar">' + NT.icon("circle-user", "icon-lg") + "</span><div><small>Learning profile · this device</small><b>" + NT.esc(profile.name || "Student") + "</b><span>" + path + "</span></div></div>" +
        '<div class="profile-summary-details"><span><small>Subject interest</small><b>' + NT.esc((NT.subject(profile.subjectId) || {}).title || "Not selected") + "</b></span>" +
        '<span><small>Access package</small><b>' + (access ? NT.esc(NT.packageDetails(access).name) + " · Active" : "No active package") + "</b></span></div>";
      var browse = document.getElementById("profileBrowseCourses");
      browse.href = NT.base() + "courses.html" + (profile.educationLevel ? "?level=" + encodeURIComponent(profile.educationLevel) : "");
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
      notice.innerHTML = '<span>' + NT.icon("check-circle", "icon-sm") + "Profile saved on this device.</span>";
      renderSummary(profile);
      NT.toast("Learning profile saved", "success");
    });
  }

  /* ============================ DASHBOARD ============================ */
  function pageDashboard() {
    var s = NT.store.get();
    var root = document.getElementById("dashRoot");

    if (!s.access) {
      root.innerHTML = '<div class="dashboard-empty card"><span class="dashboard-empty-icon">' + NT.icon("layout-dashboard", "icon-xl") + "</span>" +
        '<span class="eyebrow">Student dashboard</span><h1>Your learning, all in one place.</h1>' +
        '<p>Activate a package to track lesson progress, continue watching and see the courses included with your access.</p>' +
        '<div class="dashboard-empty-actions"><a class="btn btn-primary" href="' + NT.base() + 'pricing.html">' + NT.icon("layers") + "View access packages</a>" +
        '<a class="btn btn-secondary" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Redeem an access code</a>" +
        '<a class="link-arrow" href="' + NT.base() + 'courses.html">Explore courses ' + NT.icon("arrow-right", "icon-sm") + "</a>" +
        '<a class="link-arrow" href="' + NT.base() + 'profile.html">Set up a learning profile ' + NT.icon("arrow-right", "icon-sm") + "</a></div></div>";
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
    /* The optional learning profile is the student's chosen academic pathway.
       When it is set, pathway courses are surfaced first and shown in the header. */
    var profileLevel = D.EDUCATION_LEVELS.filter(function (item) { return item.id === profile.educationLevel; })[0] || null;
    var profileGrade = profileLevel && profileLevel.id === "high-school"
      ? D.HIGH_SCHOOL_LEVELS.filter(function (item) { return item.id === profile.levelId; })[0] : null;
    var profilePathLabel = profileLevel
      ? profileLevel.label + (profileGrade ? " · " + profileGrade.label : "") +
        (profileLevel.id === "university" && profile.university ? " · " + profile.university : "")
      : "";
    function orderForPathway(courses) {
      if (!profileLevel) return courses;
      return courses.slice().sort(function (a, b) {
        return (NT.coursePathway(a, profileLevel.id) ? 0 : 1) - (NT.coursePathway(b, profileLevel.id) ? 0 : 1);
      });
    }
    var pathwayChip = profileLevel
      ? '<a class="pathway-chip' + (profileLevel.id === "university" ? " pc-university" : "") + '" href="' + NT.base() + 'profile.html" title="Change your learning pathway">' +
        NT.icon(NT.pathwayIcon(profileLevel.id)) + NT.esc(profilePathLabel) + "</a>"
      : '<a class="pathway-chip" href="' + NT.base() + 'profile.html" title="Choose a pathway to personalise your dashboard">' +
        NT.icon("target") + "Set your pathway</a>";
    var recentAnnouncements = publishedAnnouncements().slice(0, 2);
    var announcementsHtml = recentAnnouncements.length
      ? '<section class="card dashboard-section dashboard-announcements"><div class="dashboard-section-head"><div><span class="eyebrow">Platform updates</span><h2>Announcements</h2></div><a class="link-arrow" href="' + NT.base() + 'announcements.html">View all ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
        recentAnnouncements.map(function (notice) {
          var excerpt = String(notice.body || "");
          if (excerpt.length > 130) excerpt = excerpt.slice(0, 127) + "…";
          return '<article class="dashboard-announcement"><span class="dashboard-announcement-date">' + NT.fmtDate(notice.updated || notice.created) + "</span><b>" + NT.esc(notice.title) + "</b><p>" + NT.esc(excerpt) + "</p></article>";
        }).join("") + "</section>"
      : '<section class="dashboard-section dashboard-announcements dashboard-announcements-empty"><div class="dashboard-section-head"><div><span class="eyebrow">Platform updates</span><h2>Announcements</h2></div><a class="link-arrow" href="' + NT.base() + 'announcements.html">Open ' + NT.icon("arrow-right", "icon-sm") + "</a></div><p>No published announcements right now.</p></section>";
    var recentIds = (s.recentLessons || []).slice();
    if (!recentIds.length) recentIds = s.completed.slice().reverse();
    var recent = recentIds.map(NT.lesson).filter(Boolean).slice(0, 5);

    var next = recent.filter(function (lesson) { return NT.isUnlocked(lesson) && !NT.store.isComplete(lesson.id); })[0] ||
      unlocked.filter(function (lesson) { return !NT.store.isComplete(lesson.id); })[0] || unlocked[0];
    var nextCourse = next ? (NT.course(next.courseId) || D.COURSES[0]) : null;
    var continueHtml = next ?
      '<section class="card dashboard-continue">' +
      '<div class="dashboard-continue-art" style="--thumb-bg:' + (nextCourse.thumb || D.COURSES[0].thumb) + '">' + NT.thumbArt(nextCourse) +
      '<span class="continue-course-icon">' + NT.icon(nextCourse.icon || "book-open") + "</span>" +
      '<span class="continue-art-label">' + NT.icon("play-circle", "icon-sm") + "Next lesson</span></div>" +
      '<div class="dashboard-continue-copy"><span class="eyebrow">Continue learning</span>' +
      '<h2>' + NT.esc(next.title) + "</h2><p>" + NT.esc(next.courseTitle) + " · " + NT.esc(next.duration) + " min · " + D.LEVEL_LABEL[NT.levelOf(next)] + " access</p>" +
      '<div class="continue-progress-label"><span>Overall course progress</span><b>' + pct + '%</b></div><div class="progress"><i style="width:' + pct + '%"></i></div>' +
      '<a class="btn btn-primary" href="' + NT.base() + 'lesson.html?id=' + encodeURIComponent(next.id) + '">' + NT.icon("play") + (recent.length ? "Continue lesson" : "Start your first lesson") + '</a></div></section>' :
      '<section class="card dashboard-continue dashboard-finished"><div><span class="eyebrow">Learning progress</span><h2>You have completed every unlocked lesson.</h2><p>Explore more of the catalogue or review a lesson any time.</p><a class="btn btn-primary" href="' + NT.base() + 'library.html">Open your library</a></div></section>';

    var courseRows = orderForPathway(D.COURSES).map(function (course) {
      var lessons = NT.courseLessons(course.id);
      var courseUnlocked = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); });
      var done = courseUnlocked.filter(function (lesson) { return NT.store.isComplete(lesson.id); }).length;
      var coursePct = courseUnlocked.length ? Math.round((done / courseUnlocked.length) * 100) : 0;
      return '<a class="dashboard-course-row" href="' + NT.base() + "library.html?course=" + encodeURIComponent(course.id) + '">' +
        '<span class="dashboard-course-icon" style="--tint:' + course.tint + ';--tint-fg:' + course.tintFg + '">' + NT.icon(course.icon) + "</span>" +
        '<span class="dashboard-course-info"><b>' + NT.esc(course.title) + '</b><small>' + courseUnlocked.length + " of " + lessons.length + " lessons unlocked · " + done + " completed</small>" +
        '<span class="progress"><i style="width:' + coursePct + '%"></i></span></span><span class="dashboard-course-pct">' + coursePct + "%</span>" +
        '<span class="dashboard-row-arrow">' + NT.icon("chevron-right", "icon-sm") + "</span></a>";
    }).join("");

    var recentHtml = recent.length ? recent.map(function (lesson) {
      return lessonRow(lesson, true);
    }).join("") :
      '<div class="dashboard-activity-empty"><span>' + NT.icon("clock") + "</span><div><b>No lessons watched yet</b><small>Start a lesson and your recent activity will appear here.</small></div></div>";

    var lockedList = all.filter(function (lesson) { return !NT.isUnlocked(lesson); }).slice(0, 4);
    var lockedHtml = lockedList.length ? lockedList.map(function (lesson) { return lessonRow(lesson, true); }).join("") :
      '<div class="dashboard-activity-empty"><span>' + NT.icon("check-circle") + "</span><div><b>Your package includes the full library</b><small>All current demo lessons are unlocked.</small></div></div>";

    var unlockedCourses = D.COURSES.filter(function (course) {
      return NT.courseLessons(course.id).some(function (lesson) { return NT.isUnlocked(lesson); });
    });
    var miniCourses = orderForPathway(D.COURSES).map(function (course) {
      var lessons = NT.courseLessons(course.id);
      var included = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); }).length;
      return '<article class="dashboard-mini-course"><span class="dashboard-course-icon" style="--tint:' + course.tint + ';--tint-fg:' + course.tintFg + '">' + NT.icon(course.icon) + '</span>' +
        '<span class="course-subject">' + NT.esc((NT.subject(course.subjectId) || { title: course.title }).title) + '</span>' +
        '<h3>' + NT.esc(course.title) + '</h3><p>' + included + " of " + lessons.length + " lessons unlocked</p>" +
        '<a class="link-arrow" href="' + NT.base() + "library.html?course=" + encodeURIComponent(course.id) + '">View course ' + NT.icon("arrow-right", "icon-sm") + "</a></article>";
    }).join("");

    root.innerHTML =
      '<div class="dashboard-page">' +
      '<header class="dashboard-heading"><div><span class="eyebrow">Student dashboard</span><h1>' + (profile.name ? "Welcome back, " + NT.esc(profile.name) + "." : "Welcome back.") + '</h1><p>Your courses, progress and access in one place.</p></div>' +
      '<div class="dashboard-heading-actions">' + pathwayChip +
      '<span class="badge badge-' + s.access + '">' + NT.icon("layers") + NT.esc(packageInfo.name) + " package</span>" +
      '<span class="badge badge-success">' + NT.icon("badge-check") + "Access active</span>" +
      '<a class="btn btn-secondary" href="' + NT.base() + 'profile.html">' + NT.icon("circle-user", "icon-sm") + "Profile</a>" +
      '<a class="btn btn-secondary" href="' + NT.base() + 'library.html">Open library ' + NT.icon("arrow-right", "icon-sm") + '</a></div></header>' +

      '<div class="grid grid-4 dashboard-stats">' +
      '<div class="card stat-card"><span class="lab">' + NT.icon("book-open") + "Courses available</span><span class=\"val\">" + D.COURSES.length + '</span><span class="sub">Across both study pathways</span></div>' +
      '<div class="card stat-card"><span class="lab">' + NT.icon("unlock") + "Lessons unlocked</span><span class=\"val\">" + unlocked.length + '<span class="stat-denom"> / ' + all.length + '</span></span><span class="sub">Included with ' + NT.esc(packageInfo.name) + "</span></div>" +
      '<div class="card stat-card"><span class="lab">' + NT.icon("circle-check") + "Lessons completed</span><span class=\"val\">" + completed.length + '</span><span class="sub">Your completed learning</span></div>' +
      '<div class="card stat-card"><span class="lab">' + NT.icon("trending-up") + "Overall progress</span><span class=\"val\">" + pct + '%</span><div class="progress"><i style="width:' + pct + '%"></i></div></div></div>' +

      '<div class="dashboard-layout"><div class="dashboard-primary">' + continueHtml + announcementsHtml +
      '<section class="card dashboard-section"><div class="dashboard-section-head"><div><span class="eyebrow">Your study plan' + (profileLevel ? " · " + NT.esc(profileLevel.label) + " pathway" : "") + '</span><h2>Current courses</h2></div><a class="link-arrow" href="' + NT.base() + 'courses.html">Browse all courses ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
      '<div class="dashboard-course-list">' + courseRows + "</div></section>" +
      '<section class="card dashboard-section"><div class="dashboard-section-head"><div><span class="eyebrow">Pick up where you left off</span><h2>Recently watched</h2></div><a class="link-arrow" href="' + NT.base() + 'library.html">Full library ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
      '<div class="list-rows dashboard-recent-list">' + recentHtml + "</div></section>" +
      '<section class="dashboard-section dashboard-available"><div class="dashboard-section-head"><div><span class="eyebrow">Keep exploring</span><h2>Available courses</h2></div><a class="link-arrow" href="' + NT.base() + 'courses.html">Course catalogue ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
      '<div class="dashboard-mini-grid">' + miniCourses + "</div></section></div>" +

      '<aside class="dashboard-aside">' +
      '<section class="card dashboard-section access-info-card"><div class="dashboard-section-head"><div><span class="eyebrow">Purchased access</span><h2>Package details</h2></div><span class="access-live-dot" aria-label="Active"></span></div>' +
      '<p class="access-package-name">' + NT.esc(packageInfo.name) + " <span>· " + NT.kwacha(NT.packagePrice(s.access)) + "</span></p>" +
      '<div class="kv"><div class="row"><span>Status</span><b><span class="badge badge-success">Active</span></b></div>' +
      '<div class="row"><span>Access code</span><b class="mono">' + NT.esc(meta.code || "—") + "</b></div>" +
      '<div class="row"><span>Activated</span><b>' + NT.fmtDate(since.toISOString()) + "</b></div>" +
      '<div class="row"><span>Ends</span><b>' + NT.fmtDate(expires.toISOString()) + "</b></div>" +
      '<div class="row"><span>Access period</span><b>' + s.settings.days + " days</b></div></div>" +
      '<a class="btn btn-secondary btn-block" href="' + NT.base() + 'access.html">Manage access code</a></section>' +

      '<section class="card dashboard-section"><div class="dashboard-section-head"><div><span class="eyebrow">Included content</span><h2>Unlocked courses</h2></div><span class="badge badge-brand">' + unlockedCourses.length + "</span></div>" +
      '<div class="unlocked-course-list">' + unlockedCourses.map(function (course) {
        var count = NT.courseLessons(course.id).filter(function (lesson) { return NT.isUnlocked(lesson); }).length;
        return '<a href="' + NT.base() + "library.html?course=" + encodeURIComponent(course.id) + '"><span class="mini-course-icon" style="--tint:' + course.tint + ';--tint-fg:' + course.tintFg + '">' + NT.icon(course.icon) + '</span><span><b>' + NT.esc(course.title) + '</b><small>' + count + " lessons included</small></span>" + NT.icon("chevron-right", "icon-sm") + "</a>";
      }).join("") + "</div></section>" +

      '<section class="card dashboard-section dashboard-locked"><div class="dashboard-section-head"><div><span class="eyebrow">Package access</span><h2>Available to unlock</h2></div><span class="badge badge-outline">' + (all.length - unlocked.length) + " locked</span></div>" +
      (lockedList.length ? '<div class="list-rows">' + lockedHtml + "</div>" : '<div class="dashboard-unlocked-all">' + NT.icon("check-circle") + "Everything in the demo library is included.</div>") +
      (all.length > unlocked.length ? '<a class="btn btn-primary btn-block" href="' + NT.base() + 'pricing.html">Compare packages</a>' : "") + "</section></aside></div></div>";
  }

  /* ============================ LESSON / PLAYER ============================ */
  function pageLesson() {
    var id = NT.qs("id") || "math-5";
    var lesson = NT.lesson(id) || NT.lesson("math-5");
    var course = NT.course(lesson.courseId);
    var lessons = NT.courseLessons(course.id);
    var idx = lessons.findIndex(function (l) { return l.id === lesson.id; });
    var prev = lessons[idx - 1], nextL = lessons[idx + 1];
    var unlocked = NT.isUnlocked(lesson);
    var root = document.getElementById("lessonRoot");

    /* page head */
    document.title = lesson.title + " — Nuclear Tutorials";
    var lhT = document.getElementById("lhTitle");
    if (lhT) lhT.textContent = lesson.title;
    var lhS = document.getElementById("lhSub");
    if (lhS) lhS.textContent = course.title + " · Lesson " + lesson.index + " of " + lessons.length + " · " + lesson.duration + " watch";
    var lhC = document.getElementById("lhCrumb");
    if (lhC) lhC.innerHTML += ' <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg> <span>' + NT.esc(course.title) + "</span>";

    var sideList = lessons.map(function (l) {
      var un = NT.isUnlocked(l);
      return '<a class="side-item' + (l.id === lesson.id ? " current" : "") + (un ? "" : " is-locked") + '" href="' + (un ? NT.base() + "lesson.html?id=" + l.id : "#") + '"' + (un ? "" : ' data-locked="1"') + ">" +
        '<span class="n">' + l.index + '</span><span class="t">' + l.title + "</span>" +
        (NT.store.isComplete(l.id) ? NT.icon("circle-check") : un ? NT.icon("play", "icon-sm") : NT.icon("lock", "icon-sm")) +
        "</a>";
    }).join("");

    var courseDone = lessons.filter(function (l) { return NT.isUnlocked(l) && NT.store.isComplete(l.id); }).length;
    var courseUnlocked = lessons.filter(function (l) { return NT.isUnlocked(l); }).length;
    var coursePct = courseUnlocked ? Math.round((courseDone / courseUnlocked) * 100) : 0;
    var pathwayChips = NT.coursePathways(course).map(function (path) { return NT.pathwayChip(path); }).join("");

    if (!unlocked) {
      root.innerHTML =
        '<div class="card gate" style="margin:26px auto">' +
        '<div class="big-ico" style="background:var(--tier-' + NT.levelOf(lesson) + '-bg);color:var(--tier-' + NT.levelOf(lesson) + ')">' + NT.icon("lock", "icon-xl") + "</div>" +
        "<h2>This lesson is locked</h2>" +
        '<p><b>' + lesson.title + "</b> is part of the <b>" + D.LEVEL_LABEL[NT.levelOf(lesson)] + "</b> package. " +
        (NT.store.get().access
          ? "Your current " + D.LEVEL_LABEL[NT.store.get().access] + " access doesn't include it yet — upgrade to keep watching."
          : "Choose a package or redeem an access code to start watching.") + "</p>" +
        '<div class="btns"><a class="btn btn-primary" href="' + NT.base() + 'pricing.html">' + NT.icon("zap") + "Upgrade your access</a>" +
        '<a class="btn btn-secondary" href="' + NT.base() + 'library.html">Back to library</a></div>' +
        '<p class="tiny muted" style="margin-top:18px">Locked videos are never exposed before purchase — no preview URLs, no partial streams.</p>' +
        "</div>" +
        '<div class="split" style="margin-top:8px">' +
        '<div class="card"><div class="card-head"><h3>About this lesson</h3>' + NT.levelBadge(NT.levelOf(lesson), true) + "</div>" +
        '<div class="card-body"><p class="muted small">' + NT.esc(lesson.description) + "</p>" +
        '<div class="course-pathway-tags" style="margin-top:12px">' + pathwayChips + "</div>" +
        '<div class="kv" style="margin-top:14px"><div class="row"><span>Course</span><b>' + course.title + "</b></div>" +
        '<div class="row"><span>Duration</span><b>' + lesson.duration + "</b></div>" +
        '<div class="row"><span>Lesson</span><b>' + lesson.index + " of " + lessons.length + "</b></div></div></div></div>" +
        '<div class="card"><div class="card-head"><h3>In this course</h3></div><div class="side-list">' + sideList + "</div></div>" +
        "</div>";
      wireLockedLinks();
      return;
    }

    root.innerHTML =
      '<div class="player-shell">' +
      '<div>' +
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

      '<div class="card card-pad lesson-detail" style="margin-top:22px">' +
      '<div class="lesson-detail-head"><div>' +
      '<span class="lesson-course">' + NT.esc(course.title) + ' · Lesson ' + lesson.index + " of " + lessons.length + "</span>" +
      '<h2 class="lesson-detail-title">' + NT.esc(lesson.title) + "</h2>" +
      '<div class="lesson-meta"><span>' + NT.icon("clock", "icon-sm") + lesson.duration + "</span>" +
      NT.levelBadge(NT.levelOf(lesson), false) +
      '<span id="doneBadge"></span></div>' +
      '<div class="course-pathway-tags" style="margin-top:11px">' + pathwayChips + "</div></div>" +
      '<button class="btn btn-secondary" id="markDone">' + NT.icon("circle-check") + "Mark as complete</button></div>" +
      '<p class="lesson-detail-desc">' + NT.esc(lesson.description) + "</p>" +
      '<div class="progress-row" style="margin-top:18px"><span style="white-space:nowrap">Course progress</span><div class="progress"><i id="courseProg" style="width:' + coursePct + '%"></i></div><span id="coursePct">' + coursePct + "%</span></div>" +
      '<div class="lesson-nav-row">' +
      (prev ? '<a class="btn btn-secondary" href="' + NT.base() + "lesson.html?id=" + prev.id + '">' + NT.icon("arrow-left") + "Previous lesson</a>" : '<span class="lesson-nav-hint">' + NT.icon("play-circle", "icon-sm") + "This is the first lesson in the course</span>") +
      (nextL ? '<a class="btn btn-primary" title="Up next: ' + NT.esc(nextL.title) + '" href="' + NT.base() + "lesson.html?id=" + nextL.id + '">Next lesson' + NT.icon("arrow-right") + "</a>" : '<span class="lesson-nav-hint">' + NT.icon("circle-check", "icon-sm") + "Final lesson in this course</span>") +
      "</div></div>" +
      "</div>" +

      '<aside class="lesson-side">' +
      '<div class="card"><div class="card-head"><h3>Course contents</h3><span class="badge badge-outline">' + courseDone + "/" + courseUnlocked + " done</span></div>" +
      '<div class="side-list">' + sideList + "</div></div>" +
      '<div class="card"><div class="card-head"><h3>Related lessons</h3></div>' +
      '<div class="list-rows" style="padding:8px 14px 14px">' + relatedLessons(lesson).map(function (l) { return lessonRow(l, true); }).join("") + "</div></div>" +
      "</aside></div>";

    wireLockedLinks();
    initPlayer(lesson, course);
    renderDoneState();

    function renderDoneState() {
      var done = NT.store.isComplete(lesson.id);
      var b = document.getElementById("doneBadge");
      if (b) b.innerHTML = done ? '<span class="badge badge-success">' + NT.icon("circle-check") + "Completed</span>" : "";
      var btn = document.getElementById("markDone");
      if (btn) {
        btn.innerHTML = NT.icon(done ? "rotate" : "circle-check") + (done ? "Mark as not complete" : "Mark as complete");
        btn.classList.toggle("btn-secondary", !done);
        btn.classList.toggle("btn-dark", done);
      }
      /* refresh course progress + sidebar checks */
      var d2 = lessons.filter(function (l) { return NT.isUnlocked(l) && NT.store.isComplete(l.id); }).length;
      var u2 = lessons.filter(function (l) { return NT.isUnlocked(l); }).length;
      var p2 = u2 ? Math.round((d2 / u2) * 100) : 0;
      var cp = document.getElementById("courseProg"); if (cp) cp.style.width = p2 + "%";
      var cpt = document.getElementById("coursePct"); if (cpt) cpt.textContent = p2 + "%";
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

  function relatedLessons(lesson) {
    return NT.allLessons().filter(function (l) {
      return l.id !== lesson.id && NT.levelOf(l) === NT.levelOf(lesson) && l.courseId !== lesson.courseId;
    }).slice(0, 3);
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

      /* grid */
      ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1;
      for (var x = 0; x < W; x += 44) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (var y = 0; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      /* orbits */
      var cx = W * 0.72, cy = H * 0.44, base = Math.min(W, H) * 0.30;
      orbit(cx, cy, base, base * 0.42, t * 0.22, "rgba(110,203,232,.55)", 2.2);
      orbit(cx, cy, base, base * 0.42, t * 0.22 + Math.PI / 3, "rgba(224,33,138,.42)", 2.2);
      orbit(cx, cy, base, base * 0.42, t * 0.22 + (2 * Math.PI) / 3, "rgba(244,123,32,.40)", 2.2);
      /* nucleus */
      var pulse = 6 + Math.sin(t * 2.2) * 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, pulse + 7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 1.4; ctx.stroke();

      /* waveform */
      ctx.beginPath();
      for (var px = 0; px <= W; px += 4) {
        var yy = H * 0.82 + Math.sin(px * 0.02 + t * 2.4) * 9 * Math.sin(t * 0.7 + px * 0.004);
        if (px === 0) ctx.moveTo(px, yy); else ctx.lineTo(px, yy);
      }
      ctx.strokeStyle = "rgba(110,203,232,.5)"; ctx.lineWidth = 1.6; ctx.stroke();

      /* titles */
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.font = "600 " + Math.max(10, W * 0.016) + "px Inter, system-ui, sans-serif";
      ctx.fillText("NUCLEAR TUTORIALS · " + course.title.toUpperCase(), W * 0.05, H * 0.14);
      ctx.fillStyle = "rgba(255,255,255,.96)";
      ctx.font = "700 " + Math.max(16, W * 0.034) + "px Inter, system-ui, sans-serif";
      ctx.fillText(lesson.title, W * 0.05, H * 0.14 + Math.max(22, W * 0.045));
      ctx.fillStyle = "rgba(255,255,255,.4)";
      ctx.font = "500 " + Math.max(10, W * 0.015) + "px Inter, system-ui, sans-serif";
      ctx.fillText("Demo whiteboard recording · lesson " + lesson.index, W * 0.05, H * 0.14 + Math.max(22, W * 0.045) + Math.max(16, W * 0.024));

      /* progress glow along bottom */
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
              document.getElementById("markDone") && pageLessonRefreshDone();
            }
          }
        }
        seek.value = Math.floor(st.t);
        timeEl.textContent = NT.fmtSec(st.t) + " / " + lesson.duration;
      }
      draw();
      requestAnimationFrame(loop);
    }

    function pageLessonRefreshDone() {
      var b = document.getElementById("doneBadge");
      if (b) b.innerHTML = '<span class="badge badge-success">' + NT.icon("circle-check") + "Completed</span>";
      var btn = document.getElementById("markDone");
      if (btn) { btn.innerHTML = NT.icon("rotate") + "Mark as not complete"; btn.classList.add("btn-dark"); btn.classList.remove("btn-secondary"); }
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
        '<span class="eyebrow">Demo Checkout</span>' +
        "<h2 style=\"margin:10px 0 8px\">Simulated payment</h2>" +
        '<p class="muted small" style="margin-bottom:22px">Simulated payment. No money moves and no real account is contacted. Fields below are visual only.</p>' +

        '<div class="field" style="margin-bottom:20px"><label>1 · Choose your package</label>' +
        '<div class="method-grid method-grid-3">' +
        D.LEVELS.map(function (lv) {
          return '<button type="button" class="method-card pkg-choice' + (pkg === lv ? " selected" : "") + '" data-pkg="' + lv + '" aria-pressed="' + (pkg === lv) + '">' +
            '<span class="pkg-choice-name">' + NT.esc(NT.packageDetails(lv).name) + "</span>" +
            '<span class="pkg-choice-price">' + NT.kwacha(NT.packagePrice(lv)) + "</span>" +
            '<span class="pkg-choice-meta">Unlocks ' + NT.availableFor(lv) + " of " + NT.counts().total + " lessons</span>" +
            '<span class="radio"></span></button>';
        }).join("") + "</div></div>" +

        '<div class="field" style="margin-bottom:20px"><label>2 · Payment method</label>' +
        '<div class="method-grid">' +
        D.METHODS.map(function (m) {
          return '<button type="button" class="method-card' + (method === m.id ? " selected" : "") + '" data-method="' + m.id + '">' +
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
        '<div class="row"><span>Videos unlocked</span><b>' + NT.availableFor(pkg) + " of " + NT.counts().total + "</b></div>" +
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
        "<h2>Payment Successful</h2>" +
        '<p class="videos-line" style="margin-top:10px">Your ' + D.LEVEL_LABEL[pkg] + " access is active — <b>" + NT.availableFor(pkg) + " of " + NT.counts().total + "</b> lessons are now available.</p>" +
        '<div class="receipt">' +
        '<div class="rrow"><span>Package purchased</span><b>' + NT.esc(NT.packageDetails(pkg).name) + " · " + NT.kwacha(price()) + "</b></div>" +
        '<div class="rrow"><span>Payment method</span><b>' + mName + " (demo)</b></div>" +
        '<div class="rrow"><span>Transaction reference</span><b class="mono">' + ref + "</b></div>" +
        '<div class="rrow code"><span>Access code</span><b>' + code + '</b></div>' +
        "</div>" +
        '<div class="row-between" style="justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">' +
        '<button class="btn btn-secondary" id="copyCode">' + NT.icon("copy") + "Copy code</button>" +
        '<a class="btn btn-secondary" href="' + NT.base() + 'library.html">' + NT.icon("library") + "Open library</a>" +
        '<a class="btn btn-primary btn-lg" href="' + NT.base() + 'dashboard.html">' + NT.icon("layout-dashboard") + "Go to Dashboard</a>" +
        "</div>" +
        '<p class="tiny muted">Keep this code — it also appears in the admin Access Codes list as redeemed.</p>' +
        "</div></div>";
      document.getElementById("copyCode").addEventListener("click", function () { NT.copy(code); });
      NT.toast("Payment successful — " + D.LEVEL_LABEL[pkg] + " access active", "success");
    }

    render();
  }

  /* ============================ router ============================ */
  var routes = {
    home: pageHome, courses: pageCourses, pricing: pagePricing, access: pageAccess,
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
  });
})();
