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

  /* ================== server-backed rendering ==================
     Pages that read the content database share one lifecycle: a skeleton while
     the request is in flight, real content when it lands, and an honest retry
     message when the service cannot be reached. Nothing is invented in between,
     and no global content is ever read from localStorage. */
  function bindRetry(host, handler) {
    var retry = host.querySelector("[data-retry]");
    if (retry) retry.addEventListener("click", handler);
  }

  function renderInto(host, path, render, options) {
    var opts = options || {};
    if (!host) return;
    function paint() {
      host.innerHTML = NT.loadingState({
        count: opts.count || 3,
        kind: opts.kind || "card",
        label: opts.label || "Loading"
      });
      NT.api.load(path, function (data) {
        host.innerHTML = render(data || {});
        NT.watchThumbnails(host);
        NT.initReveal();
        if (opts.after) opts.after(data || {}, host);
      }, function (error) {
        host.innerHTML = NT.errorState(NT.api.message(error), opts.error || {});
        bindRetry(host, function () {
          NT.api.forget(path);
          paint();
        });
      });
    }
    paint();
  }

  function notFoundCard(title, body, href, label) {
    return '<div class="card lesson-notice"><h1>' + NT.esc(title) + "</h1>" +
      (body ? "<p>" + NT.esc(body) + "</p>" : "") +
      '<a class="btn btn-secondary" href="' + NT.base() + href + '">' + NT.esc(label || "Browse") + "</a></div>";
  }

  function matchesQuery(query, fields) {
    if (!query) return true;
    return fields.filter(Boolean).join(" ").toLowerCase().indexOf(query) !== -1;
  }

  function countLabel(count, singular, plural) {
    return count + " " + (count === 1 ? singular : (plural || singular + "s"));
  }

  function syncQuery(params) {
    if (!window.history || !window.history.replaceState) return;
    try {
      var url = new URL(window.location.href);
      Object.keys(params).forEach(function (key) {
        var value = params[key];
        if (value === "" || value == null) url.searchParams.delete(key);
        else url.searchParams.set(key, String(value));
      });
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (error) { /* file:// previews cannot rewrite history */ }
  }

  /* ============================ HOME ============================ */
  /* Aggregate counts of published content only — real numbers from the server. */
  function homeStats(universities) {
    var courses = 0;
    var videos = 0;
    var seconds = 0;
    universities.forEach(function (university) {
      courses += university.courseCount || 0;
      videos += university.videoCount || 0;
      seconds += university.durationSeconds || 0;
    });
    if (!videos) return "";
    var items = [
      { icon: "building", value: universities.length, label: countLabel(universities.length, "university", "universities") },
      { icon: "book-open", value: courses, label: countLabel(courses, "course") },
      { icon: "video", value: videos, label: countLabel(videos, "video lesson") }
    ];
    var runtime = NT.durationWords(seconds);
    if (runtime) items.push({ icon: "clock", value: runtime, label: "of published lessons" });
    return '<div class="stat-strip">' + items.map(function (item) {
      return '<div class="stat-cell">' + NT.icon(item.icon) + "<b>" + NT.esc(String(item.value)) + "</b>" +
        "<small>" + NT.esc(item.label) + "</small></div>";
    }).join("") + "</div>";
  }

  function pageHome() {
    var grid = document.getElementById("courseGrid");
    if (grid) grid.innerHTML = D.COURSES.slice(0, 3).map(NT.renderCourseCard).join("");
    var host = document.getElementById("universityPreview");
    var stats = document.getElementById("homeStats");
    renderInto(host, "api/universities", function (data) {
      var list = data.universities || [];
      if (!list.length) {
        return '<div class="card preparing-card">' +
          '<span class="preparing-icon">' + NT.icon("building", "icon-lg") + "</span>" +
          "<div><h2>University video lessons are on the way.</h2>" +
          "<p>Each university lists Semester 1 and Semester 2 courses, and every course lists its video lessons. " +
          "Until an institution is published, browse the course outlines to see every lesson and the package that includes it.</p>" +
          '<div class="preparing-actions">' +
          '<a class="btn btn-secondary btn-sm" href="' + NT.base() + 'courses.html">Browse course outlines' + NT.icon("arrow-right", "icon-sm") + "</a>" +
          '<a class="btn btn-ghost btn-sm" href="' + NT.base() + 'pricing.html">View access packages</a></div></div></div>';
      }
      var cards = list.slice(0, 3).map(function (university, index) {
        return NT.universityCard(university, { delay: index % 3 });
      }).join("");
      var label = list.length > 3 ? "All " + list.length + " universities" : "Browse universities";
      return cards + '<div class="preview-more"><a class="link-arrow" href="' + NT.base() + 'universities.html">' +
        NT.esc(label) + " " + NT.icon("arrow-right", "icon-sm") + "</a></div>";
    }, {
      kind: "uni",
      label: "Loading universities",
      error: { title: "Cannot load universities" },
      after: function (data) {
        if (stats) stats.innerHTML = homeStats(data.universities || []);
      }
    });
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

  /* ============================ INDIVIDUAL COURSE ============================
     course.html serves both catalogue layers:
       • the built-in subject outlines (Mathematics, Physics, …) with lesson
         titles and package tiers — behaviour unchanged;
       • university courses from the content database, which list video lessons.
     Record ids never collide, so one page handles both. */
  function pageCourse() {
    var id = NT.qs("id") || NT.qs("course") || "";
    var root = document.getElementById("courseRoot");
    var catalogueCourse = NT.course(id);
    if (catalogueCourse) {
      renderCatalogueCourse(catalogueCourse, root);
      return;
    }
    renderUniversityCourse(id, root);
  }

  function renderCatalogueCourse(course, root) {
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
      "<h2>Lessons</h2><p>Listed lesson titles and their package access levels.</p></div>" +
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
        ? "Your " + NT.esc(NT.packageDetails(state.access).name) + " package includes " + unlocked.length + " of " + lessons.length + " listed lessons."
        : 'Already have a code? <a href="' + NT.base() + 'access.html">Log in to view your package access</a>. Need a code? <a href="' + NT.base() + 'pricing.html">View packages</a>.') +
      "</p></div></section>";

    root.innerHTML = hero + list + access;
  }

  /* A university course from the content database: its video lessons. */
  function renderUniversityCourse(id, root) {
    if (!id) {
      root.innerHTML = notFoundCard("Course not found", "Choose a university to see its semesters and courses.", "universities.html", "Browse universities");
      return;
    }
    var path = "api/courses/" + encodeURIComponent(id);
    root.innerHTML = NT.loadingState({ count: 2, kind: "video", label: "Loading course" });
    NT.api.load(path, function (data) {
      var course = data.course;
      var university = data.university;
      var videos = data.videos || [];
      var state = NT.store.get();
      document.title = course.title + " · " + university.name + " — Nuclear Tutorials";
      NT.progress.setContext({ universityId: university.id, semester: course.semester, courseId: course.id });

      var available = videos.filter(function (video) { return NT.isVideoUnlocked(video); });
      var watched = videos.filter(function (video) { return NT.progress.watched(video.id); }).length;
      var nextUp = available.filter(function (video) { return !NT.progress.watched(video.id); })[0] || available[0] || null;
      var subject = NT.subject(course.subjectId);
      var tint = NT.subjectTint(course.subjectId);

      var primaryCta;
      if (nextUp) {
        primaryCta = '<a class="btn btn-primary btn-lg" href="' + NT.videoHref(nextUp) + '">' +
          NT.icon("circle-play") + (watched ? "Continue learning" : "Start learning") + "</a>";
      } else if (videos.length) {
        primaryCta = '<a class="btn btn-primary btn-lg" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Log in with an access code</a>";
      } else {
        primaryCta = '<span class="btn btn-secondary btn-lg" aria-disabled="true">' + NT.icon("video") + "No video lessons published yet</span>";
      }

      var hero =
        '<section class="course-hero video-course-hero"><div class="container">' +
        NT.crumbs([
          { label: "Home", href: NT.base() + "index.html" },
          { label: "Universities", href: NT.base() + "universities.html" },
          { label: university.name, href: NT.universityHref(university, course.semester) },
          { label: course.semesterLabel },
          { label: course.title }
        ]) +
        '<div class="course-hero-copy">' +
        '<div class="course-hero-ident"><span class="course-hero-icon" style="--tint:' + tint.tint + ";--tint-fg:" + tint.tintFg + '">' +
        NT.icon(subject ? subject.icon : "book-open") + "</span>" +
        '<span class="course-hero-path">' + NT.esc(university.name) + " · " + NT.esc(course.semesterLabel) + "</span></div>" +
        "<h1>" + NT.esc(course.title) + "</h1>" +
        (course.description ? '<p class="course-hero-desc">' + NT.esc(course.description) + "</p>" : "") +
        '<div class="course-meta-row">' +
        "<span>" + NT.icon("video") + "<span class='mono'>" + videos.length + "</span> " + (videos.length === 1 ? "video lesson" : "video lessons") + "</span>" +
        (course.durationSeconds ? "<span>" + NT.icon("clock") + NT.esc(NT.durationWords(course.durationSeconds)) + "</span>" : "") +
        (course.code ? "<span>" + NT.icon("hash") + NT.esc(course.code) + "</span>" : "") +
        (course.instructor ? "<span>" + NT.icon("circle-user") + NT.esc(course.instructor) + "</span>" : "") +
        (state.access ? "<span>" + NT.icon("unlock") + "<span class='mono'>" + available.length + "</span> included with your package</span>" : "") +
        (watched ? "<span>" + NT.icon("check-check") + "<span class='mono'>" + watched + "</span> watched</span>" : "") +
        '</div><div class="course-hero-actions">' + primaryCta +
        '<a class="btn btn-ghost btn-lg" href="' + NT.universityHref(university, course.semester) + '">' + NT.icon("arrow-left") + "All " + NT.esc(course.semesterLabel) + " courses</a>" +
        "</div></div></div></section>";

      var contents =
        '<section class="section section-alt"><div class="container">' +
        '<div class="section-head section-head-row"><div><span class="eyebrow">Course contents</span>' +
        "<h2>Video lessons</h2><p>Watch in order, or jump to the topic you need. " +
        "Lessons show the access package that includes them.</p></div>" +
        (videos.length ? '<span class="section-head-count">' + NT.icon("list") + countLabel(videos.length, "lesson") + "</span>" : "") +
        "</div>" +
        (videos.length
          ? '<div class="video-grid">' + videos.map(function (video, index) {
            return NT.videoCard(video, { delay: index % 3, context: false });
          }).join("") + "</div>"
          : NT.emptyState({
            icon: "video",
            title: "No video lessons published yet",
            body: "This course exists in " + course.semesterLabel + " but has no published videos. Check back soon.",
            action: { href: NT.universityHref(university, course.semester), label: "Back to " + course.semesterLabel, icon: "arrow-left" }
          })) +
        "</div></section>";

      var access =
        '<section class="section"><div class="container">' +
        '<div class="section-head"><span class="eyebrow">Package access</span>' +
        "<h2>Video lessons included by package</h2><p>Every video lesson carries the access level set by the administrator.</p></div>" +
        '<div class="tier-strip">' + D.LEVELS.map(function (level) {
          var included = videos.filter(function (video) {
            return D.LEVEL_RANK[level] >= D.LEVEL_RANK[video.level];
          }).length;
          var current = state.access === level;
          return '<div class="tier-cell tc-' + level + (current ? " is-current" : "") + '">' +
            '<span class="name"><span class="dot"></span>' + D.LEVEL_LABEL[level] + (current ? " · current" : "") + "</span>" +
            '<span class="what">' + (included ? "<span class='mono'>" + included + "</span> of <span class='mono'>" + videos.length + "</span> video lessons" : "No video lessons") + "</span>" +
            "<small>" + (current ? "Included with your package" : "Included with " + D.LEVEL_LABEL[level] + " and above") + "</small></div>";
        }).join("") + "</div>" +
        '<p class="muted small" style="margin-top:16px">' +
        (state.access
          ? "Your " + NT.esc(NT.packageDetails(state.access).name) + " package includes " + available.length + " of " + videos.length + " video lessons in this course."
          : 'Already have a code? <a href="' + NT.base() + 'access.html">Log in to watch your included lessons</a>. Need a code? <a href="' + NT.base() + 'pricing.html">View packages</a>.') +
        "</p></div></section>";

      root.innerHTML = hero + contents + access;
      NT.watchThumbnails(root);
      NT.initReveal();
    }, function (error) {
      if (NT.api.statusOf(error) === 404) {
        root.innerHTML = notFoundCard("Course not found", "It may have been unpublished or removed by an administrator.", "universities.html", "Browse universities");
        return;
      }
      root.innerHTML = NT.errorState(NT.api.message(error), { title: "Cannot load this course" });
      bindRetry(root, function () {
        NT.api.forget(path);
        renderUniversityCourse(id, root);
      });
    });
  }

  /* ============================ UNIVERSITIES ============================
     Step one of discovery: pick an institution. */
  function pageUniversities() {
    var host = document.getElementById("universityList");
    var summary = document.getElementById("universitySummary");
    var search = document.getElementById("universitySearch");
    var list = [];
    var query = NT.qs("q") || "";
    if (search) search.value = query;

    function paint() {
      var needle = query.trim().toLowerCase();
      var matches = list.filter(function (university) {
        return matchesQuery(needle, [university.name, university.shortName, university.city, university.country, university.description]);
      });
      if (!list.length) {
        host.innerHTML = NT.emptyState({
          icon: "building",
          title: "No universities published yet",
          body: "Universities appear here with their Semester 1 and Semester 2 courses as soon as an administrator publishes them.",
          note: "Course outlines and package access stay available in the meantime.",
          action: { href: NT.base() + "courses.html", label: "Browse course outlines", icon: "book-open" }
        });
      } else if (!matches.length) {
        host.innerHTML = NT.emptyState({
          icon: "search",
          title: "No universities match that search",
          body: "Try the full name, an abbreviation or a city.",
          button: { id: "clearUniversitySearch", label: "Clear search", icon: "x" }
        });
        var clear = document.getElementById("clearUniversitySearch");
        if (clear) clear.addEventListener("click", function () {
          query = "";
          if (search) search.value = "";
          syncQuery({ q: "" });
          paint();
          if (search) search.focus();
        });
      } else {
        host.innerHTML = matches.map(function (university, index) {
          return NT.universityCard(university, { delay: index % 3 });
        }).join("");
      }
      var videos = matches.reduce(function (total, university) { return total + (university.videoCount || 0); }, 0);
      var courses = matches.reduce(function (total, university) { return total + (university.courseCount || 0); }, 0);
      if (summary) {
        summary.innerHTML = list.length
          ? "<span><b>" + matches.length + "</b> " + (matches.length === 1 ? "university" : "universities") +
            " · <b>" + courses + "</b> courses · <b>" + videos + "</b> video lessons</span>" +
            "<span class='muted'>Choose a university, then pick Semester 1 or Semester 2</span>"
          : "<span class='muted'>Published universities appear here</span>";
      }
      NT.watchThumbnails(host);
      NT.initReveal();
    }

    function load() {
      host.innerHTML = NT.loadingState({ count: 3, kind: "uni", label: "Loading universities" });
      NT.api.load("api/universities", function (data) {
        list = data.universities || [];
        paint();
      }, function (error) {
        host.innerHTML = NT.errorState(NT.api.message(error), { title: "Cannot load universities" });
        bindRetry(host, function () {
          NT.api.forget("api/universities");
          load();
        });
      });
    }

    if (search) {
      search.addEventListener("input", function () {
        query = search.value;
        syncQuery({ q: query.trim() });
        paint();
      });
    }
    load();
  }

  /* ============================ UNIVERSITY DETAIL ============================
     Step two: choose a semester, then a course. */
  function pageUniversity() {
    var id = NT.qs("id") || "";
    var hero = document.getElementById("universityRoot");
    var switcher = document.getElementById("semesterSwitch");
    var grid = document.getElementById("universityCourseGrid");
    var results = document.getElementById("universityCourseResults");
    var search = document.getElementById("universityCourseSearch");
    var body = document.getElementById("universityBody");
    var payload = null;
    var semester = Number(NT.qs("semester")) === 2 ? 2 : 1;
    var query = "";

    /* The semester switcher and course grid only make sense for a real
       university, so they stay hidden until one is loaded. */
    function showBody(visible) {
      if (body) body.classList.toggle("hidden", !visible);
    }

    if (!id) {
      hero.innerHTML = notFoundCard("Choose a university", "Pick your institution to see its semesters, courses and video lessons.", "universities.html", "Browse universities");
      if (switcher) switcher.innerHTML = "";
      if (grid) grid.innerHTML = "";
      showBody(false);
      return;
    }

    function paintHero() {
      var university = payload.university;
      var profile = NT.store.get().profile || {};
      var isMine = profile.universityId === university.id;
      var videos = university.videoCount || 0;
      hero.innerHTML =
        '<section class="uni-hero" style="--uni-accent:' + NT.esc(university.accent || "#0d7ea4") + '"><div class="container">' +
        NT.crumbs([
          { label: "Home", href: NT.base() + "index.html" },
          { label: "Universities", href: NT.base() + "universities.html" },
          { label: university.name }
        ]) +
        '<div class="uni-hero-copy">' +
        '<span class="uni-hero-mark" aria-hidden="true">' +
        (university.logoUrl
          ? '<img src="' + NT.esc(university.logoUrl) + '" alt="" loading="lazy" data-thumb>'
          : NT.esc((university.shortName || university.name).slice(0, 4))) +
        "</span>" +
        '<div class="uni-hero-text"><span class="eyebrow">University</span>' +
        "<h1>" + NT.esc(university.name) + "</h1>" +
        (university.city || university.country
          ? '<p class="uni-hero-place">' + NT.icon("map-pin", "icon-sm") + NT.esc([university.city, university.country].filter(Boolean).join(", ")) + "</p>" : "") +
        (university.description ? '<p class="uni-hero-desc">' + NT.esc(university.description) + "</p>" : "") +
        '<div class="course-meta-row">' +
        "<span>" + NT.icon("book-open") + "<span class='mono'>" + (university.courseCount || 0) + "</span> courses</span>" +
        "<span>" + NT.icon("video") + "<span class='mono'>" + videos + "</span> video lessons</span>" +
        (university.durationSeconds ? "<span>" + NT.icon("clock") + NT.esc(NT.durationWords(university.durationSeconds)) + "</span>" : "") +
        '</div><div class="uni-hero-actions">' +
        (isMine
          ? '<span class="btn btn-secondary" aria-disabled="true">' + NT.icon("check-circle") + "Your university</span>"
          : '<button class="btn btn-primary" type="button" id="setMyUniversity">' + NT.icon("graduation-cap") + "Set as my university</button>") +
        '<a class="btn btn-ghost" href="' + NT.base() + 'universities.html">' + NT.icon("building") + "All universities</a>" +
        "</div></div></div></div></section>";

      var setMine = document.getElementById("setMyUniversity");
      if (setMine) setMine.addEventListener("click", function () {
        NT.store.mutate(function (state) {
          state.profile = Object.assign({ name: "", educationLevel: "", subjectId: "", universityId: "", semester: null }, state.profile || {});
          state.profile.universityId = university.id;
          state.profile.semester = semester;
          if (!state.profile.educationLevel) state.profile.educationLevel = "university";
        });
        NT.toast("Saved " + university.name + " to your learning profile", "success");
        paintHero();
      });
      NT.watchThumbnails(hero);
    }

    function paintSwitcher() {
      if (!switcher) return;
      switcher.innerHTML = NT.semesterSwitcher({
        current: semester,
        semesters: payload.semesters,
        label: payload.university.name + " — choose a semester"
      });
      switcher.querySelectorAll("[data-semester]").forEach(function (button) {
        button.addEventListener("click", function () {
          var next = Number(button.dataset.semester);
          if (next === semester) return;
          semester = next;
          query = "";
          if (search) search.value = "";
          syncQuery({ semester: semester });
          paint();
        });
      });
    }

    function paintCourses() {
      var university = payload.university;
      var needle = query.trim().toLowerCase();
      var all = (payload.courses || []).filter(function (course) { return Number(course.semester) === semester; });
      var matches = all.filter(function (course) {
        return matchesQuery(needle, [course.title, course.code, course.instructor, course.description]);
      });
      if (results) {
        results.innerHTML = "<span><b>" + matches.length + "</b> " + (matches.length === 1 ? "course" : "courses") +
          " in " + NT.esc(NT.semesterLabel(semester)) + "</span>" +
          "<span class='muted'>" + NT.esc(matches.reduce(function (total, course) { return total + (course.videoCount || 0); }, 0) + " video lessons") + "</span>";
      }
      if (!grid) return;
      if (!all.length) {
        var other = Number(semester) === 1 ? 2 : 1;
        var otherHas = (payload.courses || []).some(function (course) { return Number(course.semester) === other; });
        grid.innerHTML = NT.emptyState({
          icon: "calendar-days",
          title: "No courses in " + NT.semesterLabel(semester) + " yet",
          body: "Nothing has been published for this semester at " + university.name + ".",
          action: otherHas ? { href: NT.universityHref(university, other), label: "Go to " + NT.semesterLabel(other), icon: "arrow-right" } : null
        });
        return;
      }
      if (!matches.length) {
        grid.innerHTML = NT.emptyState({
          icon: "search",
          title: "No courses match that search",
          body: "Try a course title, code or lecturer name.",
          button: { id: "clearCourseSearch", label: "Clear search", icon: "x" }
        });
        var clear = document.getElementById("clearCourseSearch");
        if (clear) clear.addEventListener("click", function () {
          query = "";
          if (search) search.value = "";
          paintCourses();
          if (search) search.focus();
        });
        return;
      }
      grid.innerHTML = matches.map(function (course, index) {
        return NT.courseCard(course, { delay: index % 3 });
      }).join("");
      NT.initReveal();
    }

    function paint() {
      paintHero();
      paintSwitcher();
      paintCourses();
      NT.progress.setContext({ universityId: payload.university.id, semester: semester });
      document.title = payload.university.name + " · " + NT.semesterLabel(semester) + " — Nuclear Tutorials";
    }

    function load() {
      var path = "api/universities/" + encodeURIComponent(id);
      hero.innerHTML = NT.loadingState({ count: 1, kind: "uni", label: "Loading university" });
      if (grid) grid.innerHTML = NT.loadingState({ count: 3, kind: "card", label: "Loading courses" });
      if (switcher) switcher.innerHTML = "";
      showBody(true);
      NT.api.load(path, function (data) {
        payload = data;
        var available = (data.university.availableSemesters || []);
        if (available.length && available.indexOf(semester) === -1 && !NT.qs("semester")) semester = available[0];
        paint();
      }, function (error) {
        var message = NT.api.statusOf(error) === 404
          ? "That university is not published."
          : NT.api.message(error);
        hero.innerHTML = NT.api.statusOf(error) === 404
          ? notFoundCard("University not found", message, "universities.html", "Browse universities")
          : NT.errorState(message, { title: "Cannot load this university" });
        if (switcher) switcher.innerHTML = "";
        if (grid) grid.innerHTML = "";
        showBody(false);
        if (NT.api.statusOf(error) !== 404) {
          bindRetry(hero, function () {
            NT.api.forget(path);
            load();
          });
        }
      });
    }

    if (search) {
      search.addEventListener("input", function () {
        query = search.value;
        paintCourses();
      });
    }
    load();
  }

  /* ============================ VIDEO LESSON ============================
     Step four: watch. The player markup is written once so navigating the
     playlist or marking a lesson watched never reloads the video. */
  function pageVideo() {
    var id = NT.qs("id") || "";
    var root = document.getElementById("videoRoot");
    if (!id) {
      root.innerHTML = notFoundCard("Video lesson not found", "Open the video library to choose a lesson.", "library.html", "Browse the video library");
      return;
    }
    var path = "api/videos/" + encodeURIComponent(id);
    root.innerHTML = NT.loadingState({ count: 1, kind: "video", label: "Loading video lesson" });

    NT.api.load(path, function (data) {
      render(data);
    }, function (error) {
      if (NT.api.statusOf(error) === 404) {
        root.innerHTML = notFoundCard("Video lesson not found", "It may have been unpublished or removed by an administrator.", "library.html", "Browse the video library");
        return;
      }
      root.innerHTML = NT.errorState(NT.api.message(error), { title: "Cannot load this video lesson" });
      bindRetry(root, function () {
        NT.api.forget(path);
        NT.api.load(path, function (data) { render(data); });
      });
    });

    function render(data) {
      var video = data.video;
      var course = data.course;
      var university = data.university;
      var playlist = data.playlist || [];
      var unlocked = NT.isVideoUnlocked(video);
      document.title = video.title + " · " + course.title + " — Nuclear Tutorials";
      if (unlocked) NT.progress.recordView(video);

      var stage = unlocked
        ? NT.playerMarkup(video)
        : '<div class="player player-gate"><span class="player-gate-icon">' + NT.icon("lock", "icon-xl") + "</span>" +
          "<h2>" + NT.esc(D.LEVEL_LABEL[video.level]) + " access required</h2>" +
          "<p>This video lesson is included with the " + NT.esc(D.LEVEL_LABEL[video.level]) +
          " package or above. Log in with your access code to watch it.</p>" +
          '<div class="player-gate-actions"><a class="btn btn-primary" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Log in with a code</a>" +
          '<a class="btn btn-secondary" href="' + NT.base() + 'pricing.html">View packages</a></div></div>';

      root.innerHTML =
        '<div class="watch-page">' +
        NT.crumbs([
          { label: "Home", href: NT.base() + "index.html" },
          { label: "Universities", href: NT.base() + "universities.html" },
          { label: university.name, href: NT.universityHref(university, course.semester) },
          { label: course.semesterLabel, href: NT.universityHref(university, course.semester) },
          { label: course.title, href: NT.courseHref(course) },
          { label: video.title }
        ]) +
        '<div class="watch-layout">' +
        '<div class="watch-main">' +
        '<div class="watch-stage">' + stage + "</div>" +
        '<div class="watch-head"><span class="eyebrow">' + NT.esc(university.name) + " · " + NT.esc(course.semesterLabel) + " · " +
        '<a href="' + NT.courseHref(course) + '">' + NT.esc(course.title) + "</a></span>" +
        "<h1>" + NT.esc(video.title) + "</h1>" +
        '<div class="watch-meta">' +
        (video.topic ? '<span class="video-topic">' + NT.esc(video.topic) + "</span>" : "") +
        (video.durationSeconds ? "<span>" + NT.icon("clock", "icon-sm") + NT.esc(NT.durationWords(video.durationSeconds)) + "</span>" : "") +
        "<span>" + NT.icon(NT.providerIcon(video.provider), "icon-sm") + NT.esc(NT.providerLabel(video.provider)) + "</span>" +
        '<span class="badge badge-' + video.level + '">' + NT.icon(unlocked ? "unlock" : "lock") + NT.esc(D.LEVEL_LABEL[video.level]) + "</span>" +
        "<span>" + NT.icon("list", "icon-sm") + "Lesson " + data.position + " of " + data.total + "</span>" +
        "</div>" +
        (video.description ? '<p class="watch-desc">' + NT.esc(video.description).replace(/\n/g, "<br>") + "</p>" : "") +
        '<div class="watch-actions" id="watchActions"></div>' +
        '<nav class="watch-pager" aria-label="Lesson navigation">' +
        (data.previous
          ? '<a class="watch-pager-link" href="' + NT.videoHref(data.previous) + '">' + NT.icon("arrow-left", "icon-sm") +
            "<span><small>Previous</small><b>" + NT.esc(data.previous.title) + "</b></span></a>"
          : '<span class="watch-pager-link is-empty"><small>Previous</small><b>First lesson</b></span>') +
        (data.next
          ? '<a class="watch-pager-link watch-pager-next" href="' + NT.videoHref(data.next) + '"><span><small>Next</small><b>' +
            NT.esc(data.next.title) + "</b></span>" + NT.icon("arrow-right", "icon-sm") + "</a>"
          : '<span class="watch-pager-link is-empty"><small>Next</small><b>Last lesson</b></span>') +
        "</nav></div></div>" +
        '<aside class="watch-side">' +
        '<section class="card watch-course-card">' +
        '<span class="eyebrow">' + NT.esc(course.semesterLabel) + "</span>" +
        '<h2><a href="' + NT.courseHref(course) + '">' + NT.esc(course.title) + "</a></h2>" +
        '<p class="watch-course-university">' + NT.esc(university.name) + "</p>" +
        '<div class="course-progress"><span class="course-progress-track"><span class="course-progress-fill" id="courseProgressFill"></span></span>' +
        "<small id=\"courseProgressLabel\"></small></div>" +
        '<a class="btn btn-secondary btn-block" href="' + NT.courseHref(course) + '">' + NT.icon("book-open") + "Open course</a>" +
        "</section>" +
        '<section class="card watch-playlist-card"><h2>' + NT.icon("list", "icon-sm") + "In this course</h2>" +
        '<ol class="video-rows" id="watchPlaylist"></ol></section>' +
        "</aside></div></div>";

      function paintActions() {
        var actions = document.getElementById("watchActions");
        if (actions) {
          actions.innerHTML = unlocked
            ? '<button class="btn ' + (NT.progress.watched(video.id) ? "btn-secondary" : "btn-primary") + '" type="button" id="toggleWatched">' +
              NT.icon(NT.progress.watched(video.id) ? "check-check" : "check-circle") +
              (NT.progress.watched(video.id) ? "Watched" : "Mark as watched") + "</button>"
            : '<span class="watch-locked-note">' + NT.icon("lock", "icon-sm") + "Unlock with the " + NT.esc(D.LEVEL_LABEL[video.level]) + " package to track progress</span>";
          if (video.provider === "youtube" || video.provider === "vimeo") {
            actions.innerHTML += '<a class="btn btn-ghost" href="' + NT.esc(video.url) + '" target="_blank" rel="noopener noreferrer">' +
              NT.icon("external") + "Open on " + NT.esc(NT.providerLabel(video.provider)) + "</a>";
          }
          actions.innerHTML += '<a class="btn btn-ghost" href="' + NT.courseHref(course) + '">' + NT.icon("arrow-left") + "Back to course</a>";
          var toggle = document.getElementById("toggleWatched");
          if (toggle) toggle.addEventListener("click", function () {
            var nowWatched = NT.progress.setWatched(video);
            NT.toast(nowWatched ? "Marked as watched" : "Removed from watched", "success");
            paintActions();
            paintPlaylist();
          });
        }
      }

      function paintPlaylist() {
        var list = document.getElementById("watchPlaylist");
        if (list) {
          list.innerHTML = playlist.map(function (item, index) {
            return NT.videoRow(item, { index: index + 1, current: item.id === video.id });
          }).join("");
        }
        var watchedCount = playlist.filter(function (item) { return NT.progress.watched(item.id); }).length;
        var percent = playlist.length ? Math.round((watchedCount / playlist.length) * 100) : 0;
        var fill = document.getElementById("courseProgressFill");
        var label = document.getElementById("courseProgressLabel");
        if (fill) fill.style.width = percent + "%";
        if (label) label.textContent = playlist.length
          ? watchedCount + " of " + playlist.length + " lessons watched"
          : "No lessons published yet";
      }

      paintActions();
      paintPlaylist();
      NT.watchThumbnails(root);
      NT.initReveal();
    }
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

  /* ============================ LIBRARY ============================
     Two views over one page:
       • Video lessons — the server catalogue, filterable by university,
         semester, course and availability;
       • Course outlines — the built-in lesson lists and package tiers. */
  function pageLibrary() {
    var tabs = document.getElementById("libraryTabs");
    var videoPane = document.getElementById("videoPane");
    var outlinePane = document.getElementById("outlinePane");
    var tab = NT.qs("tab") === "outlines" ? "outlines" : "videos";

    function setTab(next) {
      tab = next;
      if (tabs) {
        tabs.querySelectorAll("[data-library-tab]").forEach(function (button) {
          var active = button.dataset.libraryTab === tab;
          button.classList.toggle("active", active);
          button.setAttribute("aria-pressed", String(active));
        });
      }
      if (videoPane) videoPane.classList.toggle("hidden", tab !== "videos");
      if (outlinePane) outlinePane.classList.toggle("hidden", tab !== "outlines");
      syncQuery({ tab: tab === "videos" ? "" : tab });
    }

    if (tabs) {
      tabs.querySelectorAll("[data-library-tab]").forEach(function (button) {
        button.addEventListener("click", function () { setTab(button.dataset.libraryTab); });
      });
    }
    setTab(tab);
    initVideoLibrary();
    initOutlineLibrary();
  }

  function initVideoLibrary() {
    var host = document.getElementById("libVideos");
    var search = document.getElementById("videoSearch");
    var universitySelect = document.getElementById("videoUniversity");
    var semesterSelect = document.getElementById("videoSemester");
    var courseSelect = document.getElementById("videoCourse");
    var statusHost = document.getElementById("videoStatus");
    var summary = document.getElementById("videoSummary");
    var chips = document.getElementById("videoFilters");
    var gate = document.getElementById("videoGate");
    if (!host) return;

    var catalogue = { universities: [], courses: [], videos: [] };
    var filters = { university: NT.qs("university") || "", semester: NT.qs("semester") || "", course: NT.qs("course") || "", status: "all" };

    function courseById(id) {
      return catalogue.courses.filter(function (course) { return course.id === id; })[0] || null;
    }
    function universityById(id) {
      return catalogue.universities.filter(function (item) { return item.id === id; })[0] || null;
    }

    function options(select, items, selected, allLabel) {
      if (!select) return;
      select.innerHTML = '<option value="">' + NT.esc(allLabel) + "</option>" + items.map(function (item) {
        return '<option value="' + NT.esc(item.value) + '"' + (String(selected) === String(item.value) ? " selected" : "") + ">" +
          NT.esc(item.label) + "</option>";
      }).join("");
    }

    function populateFilters() {
      options(universitySelect, catalogue.universities.map(function (item) {
        return { value: item.id, label: item.name };
      }), filters.university, "All universities");
      options(semesterSelect, D.SEMESTERS.map(function (item) {
        return { value: item.id, label: item.label };
      }), filters.semester, "Both semesters");
      var courses = catalogue.courses.filter(function (course) {
        if (filters.university && course.universityId !== filters.university) return false;
        if (filters.semester && Number(course.semester) !== Number(filters.semester)) return false;
        return true;
      });
      options(courseSelect, courses.map(function (course) {
        return { value: course.id, label: course.title + (course.code ? " (" + course.code + ")" : "") + " · Semester " + course.semester };
      }), filters.course, "All courses");
      if (filters.course && !courseById(filters.course)) filters.course = "";
    }

    function renderStatus() {
      if (!statusHost) return;
      var choices = [{ id: "all", label: "All" }, { id: "open", label: "Available" }, { id: "locked", label: "Locked" }];
      statusHost.innerHTML = choices.map(function (choice) {
        var active = filters.status === choice.id;
        return '<button type="button" data-status="' + choice.id + '" class="' + (active ? "active" : "") +
          '" aria-pressed="' + active + '">' + choice.label + "</button>";
      }).join("");
      statusHost.querySelectorAll("[data-status]").forEach(function (button) {
        button.addEventListener("click", function () {
          filters.status = button.dataset.status;
          render();
        });
      });
    }

    function renderChips() {
      if (!chips) return;
      var active = [];
      var university = filters.university ? universityById(filters.university) : null;
      if (university) active.push({ key: "university", label: university.name });
      if (filters.semester) active.push({ key: "semester", label: NT.semesterLabel(filters.semester) });
      var course = filters.course ? courseById(filters.course) : null;
      if (course) active.push({ key: "course", label: course.title });
      chips.innerHTML = active.map(function (item) {
        return '<span class="filter-chip">' + NT.esc(item.label) +
          '<button type="button" data-clear="' + item.key + '" aria-label="Clear ' + NT.esc(item.label) + ' filter">' + NT.icon("x") + "</button></span>";
      }).join("") + (active.length ? '<button class="filter-chip filter-chip-clear" type="button" data-clear="all">Clear all</button>' : "");
      chips.classList.toggle("hidden", !active.length);
      chips.querySelectorAll("[data-clear]").forEach(function (button) {
        button.addEventListener("click", function () {
          var key = button.dataset.clear;
          if (key === "all") { filters.university = ""; filters.semester = ""; filters.course = ""; }
          else filters[key] = "";
          populateFilters();
          syncFilters();
          render();
        });
      });
    }

    function syncFilters() {
      syncQuery({ university: filters.university, semester: filters.semester, course: filters.course });
    }

    function selectedVideos() {
      var query = search ? search.value.trim().toLowerCase() : "";
      return catalogue.videos.filter(function (video) {
        var course = courseById(video.courseId);
        if (!course) return false;
        if (filters.university && course.universityId !== filters.university) return false;
        if (filters.semester && Number(course.semester) !== Number(filters.semester)) return false;
        if (filters.course && course.id !== filters.course) return false;
        var unlocked = NT.isVideoUnlocked(video);
        if (filters.status === "open" && !unlocked) return false;
        if (filters.status === "locked" && unlocked) return false;
        return matchesQuery(query, [video.title, video.topic, video.description, course.title, course.code, course.instructor, universityById(course.universityId) ? universityById(course.universityId).name : ""]);
      });
    }

    function render() {
      var videos = selectedVideos();
      var access = NT.store.get().access;
      renderStatus();
      renderChips();
      if (gate) {
        gate.classList.toggle("hidden", !!access || !catalogue.videos.length);
      }
      if (!catalogue.videos.length) {
        host.innerHTML = NT.emptyState({
          icon: "video",
          title: "The video library is empty",
          body: "No video lessons have been published yet. As soon as an administrator adds them they appear here, grouped by university, semester and course.",
          action: { href: NT.base() + "universities.html", label: "Browse universities", icon: "building" }
        });
      } else if (!videos.length) {
        host.innerHTML = NT.emptyState({
          icon: "search",
          title: "No video lessons match",
          body: "Try a different university, semester or search term.",
          button: { id: "clearVideoFilters", label: "Clear filters", icon: "x" }
        });
        var clear = document.getElementById("clearVideoFilters");
        if (clear) clear.addEventListener("click", function () {
          filters = { university: "", semester: "", course: "", status: "all" };
          if (search) search.value = "";
          populateFilters();
          syncFilters();
          render();
        });
      } else {
        /* Group by university → semester → course so every card keeps its context. */
        var groups = [];
        videos.forEach(function (video) {
          var course = courseById(video.courseId);
          var group = groups.filter(function (item) { return item.course.id === course.id; })[0];
          if (!group) {
            group = { course: course, university: universityById(course.universityId), videos: [] };
            groups.push(group);
          }
          group.videos.push(video);
        });
        host.innerHTML = groups.map(function (group) {
          var included = group.videos.filter(function (video) { return NT.isVideoUnlocked(video); }).length;
          var subject = NT.subject(group.course.subjectId);
          var tint = NT.subjectTint(group.course.subjectId);
          return '<section class="lib-course reveal">' +
            '<header class="lib-course-head">' +
            '<span class="course-icon" style="--tint:' + tint.tint + ";--tint-fg:" + tint.tintFg + '">' + NT.icon(subject ? subject.icon : "book-open") + "</span>" +
            "<div><h2><a href=\"" + NT.courseHref(group.course) + "\">" + NT.esc(group.course.title) + "</a></h2>" +
            "<p>" + NT.esc([group.university ? group.university.name : "", group.course.semesterLabel].filter(Boolean).join(" · ")) +
            " · " + countLabel(group.videos.length, "video lesson") +
            (access ? " · " + included + " available" : "") + "</p></div>" +
            '<a class="btn btn-ghost btn-sm lib-course-open" href="' + NT.courseHref(group.course) + '">Open course' + NT.icon("arrow-right", "icon-sm") + "</a>" +
            "</header>" +
            '<div class="video-grid">' + group.videos.map(function (video, index) {
              return NT.videoCard(video, { delay: index % 3, context: false, description: false });
            }).join("") + "</div></section>";
        }).join("");
      }
      var available = catalogue.videos.filter(function (video) { return NT.isVideoUnlocked(video); }).length;
      if (summary) {
        summary.textContent = !catalogue.videos.length
          ? "Published video lessons appear here."
          : access
            ? available + " of " + catalogue.videos.length + " published video lessons are included with your " +
              NT.packageDetails(access).name + " package." + (videos.length !== catalogue.videos.length ? " Showing " + videos.length + "." : "")
            : catalogue.videos.length + " published video lessons. Log in with an access code to watch the ones your package includes.";
      }
      NT.watchThumbnails(host);
      NT.initReveal();
    }

    function load() {
      host.innerHTML = NT.loadingState({ count: 3, kind: "video", label: "Loading the video library" });
      NT.api.load("api/library", function (data) {
        catalogue = {
          universities: data.universities || [],
          courses: data.courses || [],
          videos: data.videos || []
        };
        populateFilters();
        render();
      }, function (error) {
        host.innerHTML = NT.errorState(NT.api.message(error), { title: "Cannot load the video library" });
        bindRetry(host, function () {
          NT.api.forget("api/library");
          load();
        });
      });
    }

    if (search) search.addEventListener("input", render);
    if (universitySelect) universitySelect.addEventListener("change", function () {
      filters.university = universitySelect.value;
      filters.course = "";
      populateFilters();
      syncFilters();
      render();
    });
    if (semesterSelect) semesterSelect.addEventListener("change", function () {
      filters.semester = semesterSelect.value;
      filters.course = "";
      populateFilters();
      syncFilters();
      render();
    });
    if (courseSelect) courseSelect.addEventListener("change", function () {
      filters.course = courseSelect.value;
      var course = courseById(filters.course);
      if (course) {
        filters.university = course.universityId;
        filters.semester = String(course.semester);
        populateFilters();
      }
      syncFilters();
      render();
    });
    load();
  }

  /* Built-in course outlines and their package access levels. */
  function initOutlineLibrary() {
    var root = document.getElementById("libRoot");
    var search = document.getElementById("libSearch");
    var statusHost = document.getElementById("libStatus");
    var summary = document.getElementById("libSummary");
    var chips = document.getElementById("activeFilters");
    var gate = document.getElementById("libGate");
    if (!root) return;
    var course = NT.qs("outlineCourse");
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
        ? available + " of " + all.length + " listed lessons are included with your " + NT.packageDetails(access).name + " package."
        : "Enter an access code to see which listed lessons your package includes.";
      renderStatus();
      renderChips();
      gate.classList.toggle("hidden", !!access);
      NT.initReveal();
    }

    search.addEventListener("input", render);
    render();
  }

  /* ============================ SEARCH ============================
     One search box over everything a student can open: universities,
     university courses, video lessons (all from the server), plus the built-in
     course outlines, lesson titles and published announcements. */
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
    var validKinds = ["all", "universities", "courses", "videos", "lessons"];
    var kind = validKinds.indexOf(NT.qs("type")) !== -1 ? NT.qs("type") : "all";
    var remote = { universities: [], courses: [], videos: [], pending: false, error: "" };
    var timer = null;
    input.value = NT.qs("q") || "";

    function normal(value) { return String(value || "").toLowerCase().trim(); }
    function matches(fields, query) {
      if (!query) return false;
      return fields.join(" ").toLowerCase().indexOf(query) !== -1;
    }

    function universityResult(university) {
      return '<article class="search-result">' +
        '<span class="search-result-icon">' + NT.icon("building") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>University</span>' +
        (university.city ? "<span>" + NT.esc(university.city) + "</span>" : "") + "</div>" +
        "<h3>" + NT.esc(university.name) + "</h3>" +
        "<small>" + countLabel(university.courseCount || 0, "course") + " · " +
        countLabel(university.videoCount || 0, "video lesson") + "</small></div>" +
        '<a class="btn btn-secondary btn-sm" href="' + NT.universityHref(university) + '">Choose semester</a></article>';
    }
    function universityCourseResult(course) {
      return '<article class="search-result">' +
        '<span class="search-result-icon" style="--tint:' + NT.subjectTint(course.subjectId).tint +
        ";--tint-fg:" + NT.subjectTint(course.subjectId).tintFg + '">' + NT.icon(NT.subject(course.subjectId) ? NT.subject(course.subjectId).icon : "book-open") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>University course</span>' +
        "<span>" + NT.esc(course.universityName) + " · " + NT.esc(course.semesterLabel) + "</span></div>" +
        "<h3>" + NT.esc(course.title) + "</h3>" +
        (course.description ? "<p>" + NT.esc(course.description) + "</p>" : "") +
        "<small>" + countLabel(course.videoCount || 0, "video lesson") +
        (course.code ? " · " + NT.esc(course.code) : "") + "</small></div>" +
        '<a class="btn btn-secondary btn-sm" href="' + NT.courseHref(course) + '">Open course</a></article>';
    }
    function videoResult(video) {
      var unlocked = NT.isVideoUnlocked(video);
      return '<article class="search-result">' +
        '<span class="search-result-thumb">' + NT.thumbnailMarkup(video) +
        (video.durationSeconds ? '<span class="video-duration-chip">' + NT.esc(NT.duration(video.durationSeconds)) + "</span>" : "") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>Video lesson</span>' +
        "<span>" + NT.esc(NT.videoContext(video)) + "</span></div>" +
        "<h3>" + NT.esc(video.title) + "</h3>" +
        (video.topic ? "<p>" + NT.esc(video.topic) + "</p>" : "") +
        "<small>" + NT.esc(D.LEVEL_LABEL[video.level]) + " access" + (unlocked ? " · included with your package" : "") + "</small></div>" +
        (unlocked
          ? '<a class="btn btn-secondary btn-sm" href="' + NT.videoHref(video) + '">' + NT.icon("circle-play", "icon-sm") + "Watch</a>"
          : '<a class="btn btn-secondary btn-sm" href="' + NT.videoHref(video) + '">' + NT.icon("lock", "icon-sm") + "Access</a>") +
        "</article>";
    }
    function courseResult(course) {
      var lessons = NT.courseLessons(course.id);
      return '<article class="search-result">' +
        '<span class="search-result-icon" style="--tint:' + course.tint + ";--tint-fg:" + course.tintFg + '">' + NT.icon(course.icon) + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>Course outline</span></div>' +
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
      syncQuery({ q: query, type: kind === "all" ? "" : kind });
    }

    function sectionMarkup(title, icon, items) {
      if (!items.length) return "";
      return '<section class="search-result-section"><div class="search-section-heading"><h2>' + NT.icon(icon, "icon-sm") +
        NT.esc(title) + "</h2><span>" + items.length + "</span></div>" + items.join("") + "</section>";
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
        summary.textContent = "Search universities, courses, video lessons and lesson outlines.";
        var chips = D.SUBJECTS.map(function (item) {
          return '<button class="search-suggestion" type="button" data-suggestion="' + NT.esc(item.title) + '">' + NT.icon(item.icon) + NT.esc(item.title) + "</button>";
        }).join("");
        results.innerHTML = '<div class="search-start"><span class="search-start-icon">' + NT.icon("search", "icon-lg") + "</span>" +
          "<h2>Search everything</h2>" +
          "<p>Universities, semesters, courses, video lesson titles and topics.</p>" +
          '<div class="search-suggestions"><span>Browse a subject</span>' + chips + "</div>" +
          '<a class="link-arrow search-start-link" href="' + NT.base() + 'universities.html">Browse universities instead ' + NT.icon("arrow-right", "icon-sm") + "</a></div>";
        results.querySelectorAll("[data-suggestion]").forEach(function (button) {
          button.addEventListener("click", function () { input.value = button.dataset.suggestion; runSearch(); input.focus(); });
        });
        return;
      }

      var outlineCourses = D.COURSES.filter(function (course) {
        var lessonTitles = NT.courseLessons(course.id).map(function (lesson) { return lesson.title; }).join(" ");
        var paths = NT.coursePathways(course).map(NT.pathwayLabel).join(" ");
        return matches([course.title, course.desc, lessonTitles, paths], query);
      }).map(courseResult);
      var lessons = NT.allLessons().filter(function (lesson) {
        var course = NT.course(lesson.courseId) || {};
        return matches([lesson.title, lesson.courseTitle, lesson.description, course.desc], query);
      }).map(lessonResult);
      var notices = publishedAnnouncements().filter(function (notice) {
        return matches([notice.title, notice.body], query);
      }).map(announcementResult);
      var universities = remote.universities.map(universityResult);
      var uniCourses = remote.courses.map(universityCourseResult);
      var videos = remote.videos.map(videoResult);

      var counts = {
        universities: universities.length,
        courses: uniCourses.length + outlineCourses.length,
        videos: videos.length,
        lessons: lessons.length
      };
      var total = kind === "all"
        ? counts.universities + counts.courses + counts.videos + counts.lessons + notices.length
        : counts[kind] || 0;
      summary.innerHTML = (remote.pending ? "Searching… · " : "") + total + " result" + (total === 1 ? "" : "s") +
        " for “" + NT.esc(input.value.trim()) + "”" + (remote.error ? " · " + NT.esc(remote.error) : "");

      var parts = [];
      if (kind === "all" || kind === "universities") parts.push(sectionMarkup("Universities", "building", universities));
      if (kind === "all" || kind === "courses") parts.push(sectionMarkup("Courses", "book-open", uniCourses.concat(outlineCourses)));
      if (kind === "all" || kind === "videos") parts.push(sectionMarkup("Video lessons", "video", videos));
      if (kind === "all" || kind === "lessons") parts.push(sectionMarkup("Lesson outlines", "list", lessons));
      if (kind === "all") parts.push(sectionMarkup("Announcements", "bell", notices));

      results.innerHTML = parts.filter(Boolean).length ? parts.join("")
        : '<div class="search-empty"><span class="search-start-icon">' + NT.icon("search", "icon-lg") + "</span>" +
          "<h2>No matching results</h2><p>Try a university name, course title, topic or lesson.</p>" +
          '<div class="lesson-notice-actions"><a class="btn btn-secondary" href="' + NT.base() + 'universities.html">Browse universities</a>' +
          '<a class="link-arrow" href="' + NT.base() + 'courses.html">Browse course outlines ' + NT.icon("arrow-right", "icon-sm") + "</a></div></div>";
      NT.watchThumbnails(results);
    }

    function runSearch() {
      var query = input.value.trim();
      if (timer) clearTimeout(timer);
      if (!query) {
        remote = { universities: [], courses: [], videos: [], pending: false, error: "" };
        render();
        return;
      }
      remote.pending = true;
      render();
      timer = setTimeout(function () {
        var path = "api/search?q=" + encodeURIComponent(query);
        NT.api.load(path, function (data) {
          remote = {
            universities: data.universities || [],
            courses: data.courses || [],
            videos: data.videos || [],
            pending: false,
            error: ""
          };
          render();
        }, function (error) {
          remote = { universities: [], courses: [], videos: [], pending: false, error: NT.api.unreachable(error) ? "video results unavailable" : "" };
          render();
        });
      }, 180);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { kind = tab.dataset.searchKind; render(); });
    });
    input.addEventListener("input", runSearch);
    runSearch();
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

  /* ============================ PROFILE ============================
     Device-local study preferences: name, education level, university,
     semester and subject. The university list comes from the server. */
  function pageProfile() {
    var form = document.getElementById("profileForm");
    var level = document.getElementById("profileEducationLevel");
    var subject = document.getElementById("profileSubject");
    var university = document.getElementById("profileUniversity");
    var semester = document.getElementById("profileSemester");
    var notice = document.getElementById("profileSaveMessage");
    var saved = Object.assign({ name: "", educationLevel: "", subjectId: "", universityId: "", semester: null }, NT.store.get().profile || {});
    var universities = [];

    level.innerHTML = '<option value="">Choose a level</option>' + D.EDUCATION_LEVELS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.label) + "</option>";
    }).join("");
    subject.innerHTML = '<option value="">No subject selected</option>' + D.SUBJECTS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.title) + "</option>";
    }).join("");
    semester.innerHTML = '<option value="">No semester selected</option>' + D.SEMESTERS.map(function (item) {
      return '<option value="' + item.id + '">' + NT.esc(item.label) + "</option>";
    }).join("");
    document.getElementById("profileName").value = saved.name || "";
    level.value = saved.educationLevel || "";
    subject.value = saved.subjectId || "";
    semester.value = saved.semester ? String(saved.semester) : "";

    function selectedUniversity() {
      return universities.filter(function (item) { return item.id === saved.universityId; })[0] || null;
    }

    function renderSummary(profile) {
      var access = NT.store.get().access;
      var levelInfo = NT.educationLevel(profile.educationLevel);
      var path = levelInfo ? levelInfo.label : "No level selected";
      var institution = selectedUniversity();
      document.getElementById("profileSummary").innerHTML =
        '<div class="profile-summary-identity"><span class="profile-avatar">' + NT.icon("circle-user", "icon-lg") + "</span><div>" +
        "<small>Learning profile · this device</small><b>" + NT.esc(profile.name || "Learner") + "</b><span>" + NT.esc(path) + "</span></div></div>" +
        '<div class="profile-summary-details">' +
        "<span><small>University</small><b>" + NT.esc(institution ? institution.name : "Not selected") + "</b></span>" +
        "<span><small>Semester</small><b>" + NT.esc(profile.semester ? NT.semesterLabel(profile.semester) : "Not selected") + "</b></span>" +
        "<span><small>Subject</small><b>" + NT.esc((NT.subject(profile.subjectId) || {}).title || "Not selected") + "</b></span>" +
        '<span><small>Access package</small><b>' + (access ? NT.esc(NT.packageDetails(access).name) + " · Active" : "No active package") + "</b></span>" +
        "<span><small>Video lessons watched</small><b>" + NT.progress.watchedCount() + "</b></span></div>";
      var browse = document.getElementById("profileBrowseCourses");
      if (browse) {
        browse.href = institution
          ? NT.universityHref(institution, profile.semester || (institution.availableSemesters || [])[0] || 1)
          : NT.base() + "universities.html";
        browse.innerHTML = (institution ? "Open my semester" : "Choose a university") + NT.icon("arrow-right", "icon-sm");
      }
    }

    function loadUniversities() {
      if (!university) return;
      university.innerHTML = '<option value="">Loading universities…</option>';
      NT.api.load("api/universities", function (data) {
        universities = data.universities || [];
        university.innerHTML = '<option value="">No university selected</option>' + universities.map(function (item) {
          return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.name) + "</option>";
        }).join("");
        university.value = saved.universityId || "";
        if (saved.universityId && !selectedUniversity()) saved.universityId = "";
        renderSummary(saved);
      }, function (error) {
        university.innerHTML = '<option value="">Universities unavailable</option>';
        notice.innerHTML = NT.icon("wifi-off", "icon-sm") + " " + NT.esc(NT.api.message(error));
      });
    }

    renderSummary(saved);
    loadUniversities();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var profile = {
        name: document.getElementById("profileName").value.trim().slice(0, 60),
        educationLevel: level.value,
        subjectId: subject.value,
        universityId: university ? university.value : "",
        semester: semester.value ? Number(semester.value) : null
      };
      saved = Object.assign({}, saved, profile);
      NT.store.mutate(function (state) {
        state.profile = Object.assign({}, state.profile || {}, profile);
      });
      notice.innerHTML = NT.icon("check-circle", "icon-sm") + " Preferences saved on this device.";
      renderSummary(profile);
      NT.toast("Learning preferences saved", "success");
    });
  }

  /* ============================ DASHBOARD ============================
     Only real information: the student's package, the university and semester
     they chose, the video lessons this device has actually watched, and the
     published catalogue returned by the server. */
  function pageDashboard() {
    var state = NT.store.get();
    var root = document.getElementById("dashRoot");
    var profile = Object.assign({ name: "", educationLevel: "", subjectId: "", universityId: "", semester: null }, state.profile || {});
    var level = NT.educationLevel(profile.educationLevel);

    if (!state.access) {
      root.innerHTML = '<div class="dashboard-empty"><h1>Log in to continue.</h1>' +
        "<p>Choose High School or University, then enter your access code to open your video lessons.</p>" +
        '<div class="lesson-notice-actions"><a class="btn btn-primary" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Log in with an access code</a>" +
        '<a class="btn btn-secondary" href="' + NT.base() + 'universities.html">' + NT.icon("building") + "Browse universities</a></div></div>";
      return;
    }

    var path = level ? level.label : "No learning level selected";
    var meta = state.accessMeta || {};
    var since = meta.since ? new Date(meta.since) : null;
    var expiry = since && !isNaN(since.getTime())
      ? NT.fmtDate(new Date(since.getTime() + state.settings.days * 86400000).toISOString())
      : "";

    root.innerHTML =
      '<div class="dashboard-page">' +
      '<header class="dashboard-heading"><div><span class="eyebrow">Your learning</span>' +
      "<h1>" + (profile.name ? "Welcome, " + NT.esc(profile.name) + "." : "Welcome back.") + "</h1>" +
      "<p>" + NT.esc(NT.packageDetails(state.access).name) + " package · " + NT.esc(path) +
      (expiry ? " · Access until " + expiry : "") + "</p></div>" +
      '<div class="dashboard-heading-actions">' +
      '<a class="btn btn-secondary btn-sm" href="' + NT.base() + 'library.html">' + NT.icon("video") + "Video library</a>" +
      '<a class="btn btn-ghost btn-sm" href="' + NT.base() + 'profile.html">' + NT.icon("settings") + "Edit preferences</a>" +
      "</div></header>" +
      '<div id="dashData">' + NT.loadingState({ count: 2, kind: "card", label: "Loading your dashboard" }) + "</div>" +
      "</div>";

    var host = document.getElementById("dashData");
    NT.api.load("api/library", function (data) {
      render(data);
    }, function (error) {
      host.innerHTML = NT.errorState(NT.api.message(error), {
        title: "Cannot load your video lessons",
        helpHref: NT.base() + "index.html#how-it-works"
      });
      bindRetry(host, function () {
        NT.api.forget("api/library");
        NT.api.load("api/library", function (data) { render(data); });
      });
    });

    function render(data) {
      var universities = data.universities || [];
      var courses = data.courses || [];
      var videos = data.videos || [];
      var institution = universities.filter(function (item) { return item.id === profile.universityId; })[0] || null;
      var context = NT.progress.context();
      if (!institution && context.universityId) {
        institution = universities.filter(function (item) { return item.id === context.universityId; })[0] || null;
      }
      var semester = profile.semester || (institution ? Number(context.semester) || (institution.availableSemesters || [])[0] || 1 : null);
      var available = videos.filter(function (video) { return NT.isVideoUnlocked(video); });
      var watchedIds = NT.progress.watchedIds().filter(function (id) {
        return videos.some(function (video) { return video.id === id; });
      });
      var recent = NT.progress.recent(4);
      var last = NT.progress.last();

      var scopeCourses = courses.filter(function (course) {
        if (!institution) return false;
        if (course.universityId !== institution.id) return false;
        return semester ? Number(course.semester) === Number(semester) : true;
      });
      var scopeVideos = videos.filter(function (video) {
        return scopeCourses.some(function (course) { return course.id === video.courseId; });
      });
      var scopeWatched = watchedIds.filter(function (id) {
        return scopeVideos.some(function (video) { return video.id === id; });
      });
      var percent = scopeVideos.length ? Math.round((scopeWatched.length / scopeVideos.length) * 100) : 0;

      var metrics =
        '<section class="dash-metrics">' +
        NT.metric({ icon: "check-check", value: watchedIds.length, label: "video lessons watched" }) +
        NT.metric({ icon: "unlock", value: available.length + " / " + videos.length, label: "published lessons in your package" }) +
        NT.metric({ icon: "building", value: institution ? institution.shortName || institution.name : "Not set", label: "your university" }) +
        NT.metric({ icon: "calendar-days", value: semester ? NT.semesterLabel(semester) : "Not set", label: "current semester" }) +
        "</section>";

      var continueCard;
      if (last) {
        var lastVideo = videos.filter(function (video) { return video.id === last.id; })[0];
        var target = lastVideo || last;
        var resumed = NT.progress.watched(last.id);
        continueCard =
          '<section class="card dash-continue reveal">' +
          '<span class="dash-continue-thumb">' + NT.thumbnailMarkup(target) +
          '<span class="video-thumb-overlay" aria-hidden="true">' + NT.icon("circle-play") + "</span></span>" +
          '<div class="dash-continue-copy"><span class="eyebrow">' + (resumed ? "Watched · open again" : "Continue learning") + "</span>" +
          "<h2>" + NT.esc(target.title) + "</h2>" +
          "<p>" + NT.esc([target.universityName, target.semester ? NT.semesterLabel(target.semester) : "", target.courseTitle].filter(Boolean).join(" · ")) + "</p>" +
          '<div class="dash-continue-actions">' +
          (NT.isVideoUnlocked(target)
            ? '<a class="btn btn-primary" href="' + NT.base() + "video.html?id=" + encodeURIComponent(target.id) + '">' + NT.icon("circle-play") + (resumed ? "Watch again" : "Resume lesson") + "</a>"
            : '<a class="btn btn-primary" href="' + NT.base() + "video.html?id=" + encodeURIComponent(target.id) + '">' + NT.icon("lock") + "View access</a>") +
          '<a class="btn btn-ghost" href="' + NT.base() + 'library.html">Open video library</a></div></div></section>';
      } else {
        continueCard =
          '<section class="card dash-continue reveal"><div class="dash-continue-copy">' +
          '<span class="eyebrow">Start here</span><h2>Pick your first video lesson.</h2>' +
          "<p>Choose your university and semester, open a course and start watching. Lessons you finish are remembered on this device.</p>" +
          '<div class="dash-continue-actions">' +
          '<a class="btn btn-primary" href="' + NT.base() + 'universities.html">' + NT.icon("building") + "Choose university</a>" +
          '<a class="btn btn-ghost" href="' + NT.base() + 'library.html">Browse the video library</a></div></div></section>';
      }

      var progressCard =
        '<section class="card dash-progress reveal"><div class="dash-card-head"><h2>Your progress</h2>' +
        (institution ? "<span class='muted small'>" + NT.esc(institution.name) + (semester ? " · " + NT.esc(NT.semesterLabel(semester)) : "") + "</span>" : "") +
        "</div>" +
        (scopeVideos.length
          ? '<div class="dash-progress-bar"><span class="course-progress-track"><span class="course-progress-fill" style="width:' + percent + '%"></span></span>' +
            "<small>" + scopeWatched.length + " of " + scopeVideos.length + " video lessons watched in " +
            NT.esc(semester ? NT.semesterLabel(semester) : "your semester") + " · " + percent + "%</small></div>"
          : '<p class="muted small">' + (institution
            ? "No published video lessons in this semester yet."
            : "Choose your university and semester to track progress here.") + "</p>") +
        (scopeCourses.length
          ? '<ul class="dash-course-progress">' + scopeCourses.map(function (course) {
            var courseVideos = scopeVideos.filter(function (video) { return video.courseId === course.id; });
            var done = watchedIds.filter(function (id) {
              return courseVideos.some(function (video) { return video.id === id; });
            }).length;
            var coursePercent = courseVideos.length ? Math.round((done / courseVideos.length) * 100) : 0;
            return '<li><a href="' + NT.courseHref(course) + '"><b>' + NT.esc(course.title) + "</b>" +
              "<small>" + done + " of " + courseVideos.length + " watched</small>" +
              '<span class="course-progress-track"><span class="course-progress-fill" style="width:' + coursePercent + '%"></span></span></a></li>';
          }).join("") + "</ul>"
          : "") +
        (watchedIds.length
          ? '<button class="btn btn-ghost btn-sm dash-reset" type="button" id="resetProgress">' + NT.icon("rotate", "icon-sm") + "Clear watched history</button>"
          : "") +
        "</section>";

      var recentCard =
        '<section class="card dash-recent reveal"><div class="dash-card-head"><h2>' + NT.icon("history", "icon-sm") + "Recently viewed</h2>" +
        '<a class="link-arrow" href="' + NT.base() + 'library.html">Video library' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
        (recent.length
          ? '<ul class="video-rows compact">' + recent.map(function (item, index) {
            var live = videos.filter(function (video) { return video.id === item.id; })[0];
            var entry = live || {
              id: item.id, title: item.title, topic: item.topic, thumbnail: item.thumbnail,
              durationSeconds: item.durationSeconds, level: item.level, provider: "",
              universityName: item.universityName, semester: item.semester, courseTitle: item.courseTitle
            };
            entry.semesterLabel = entry.semester ? NT.semesterLabel(entry.semester) : "";
            return NT.videoRow(entry, { index: index + 1 });
          }).join("") + "</ul>"
          : '<p class="muted small">Lessons you open appear here so you can jump straight back in.</p>') +
        "</section>";

      var coursesCard;
      if (!institution) {
        coursesCard =
          '<section class="card dash-courses reveal"><div class="dash-card-head"><h2>Available courses</h2></div>' +
          NT.emptyState({
            compact: true,
            icon: "building",
            title: "Choose your university",
            body: universities.length
              ? "Pick the institution you study at and your semester to see its courses here."
              : "No universities have been published yet. Course outlines stay available in the meantime.",
            action: universities.length
              ? { href: NT.base() + "universities.html", label: "Browse universities", icon: "building" }
              : { href: NT.base() + "courses.html", label: "Browse course outlines", icon: "book-open" }
          }) + "</section>";
      } else {
        var availableCourses = scopeCourses.filter(function (course) { return course.videoCount > 0; });
        coursesCard =
          '<section class="dash-courses reveal"><div class="dash-card-head"><h2>' +
          NT.esc(institution.name) + (semester ? " · " + NT.esc(NT.semesterLabel(semester)) : "") + "</h2>" +
          NT.semesterSwitcher({ current: semester || 1, semesters: institution.semesters, label: "Switch semester" }) +
          "</div>" +
          (availableCourses.length
            ? '<div class="course-catalog-grid">' + availableCourses.slice(0, 6).map(function (course, index) {
              return NT.courseCard(course, { delay: index % 3 });
            }).join("") + "</div>"
            : NT.emptyState({
              compact: true,
              icon: "calendar-days",
              title: "No courses in this semester yet",
              body: "Nothing has been published for " + NT.esc(semester ? NT.semesterLabel(semester) : "this semester") + " at " + institution.name + "."
            })) +
          '<a class="link-arrow dash-courses-all" href="' + NT.universityHref(institution, semester) + '">Open ' +
          NT.esc(institution.shortName || institution.name) + " " + NT.icon("arrow-right", "icon-sm") + "</a></section>";
      }

      host.innerHTML =
        metrics + continueCard +
        '<div class="dash-columns">' + progressCard + recentCard + "</div>" +
        coursesCard +
        '<section class="dash-secondary"><a class="link-arrow" href="' + NT.base() + "courses.html" +
        (profile.educationLevel ? "?level=" + encodeURIComponent(profile.educationLevel) : "") + '">Browse the ' +
        NT.esc(path) + " course outlines " + NT.icon("arrow-right", "icon-sm") + "</a></section>";

      host.querySelectorAll(".semester-option").forEach(function (button) {
        button.addEventListener("click", function () {
          var next = Number(button.dataset.semester);
          NT.store.mutate(function (currentState) {
            currentState.profile = Object.assign({}, currentState.profile || {}, {
              universityId: institution.id,
              semester: next
            });
          });
          NT.toast("Switched to " + NT.semesterLabel(next), "success");
          profile = NT.store.get().profile;
          render(data);
        });
      });
      var reset = document.getElementById("resetProgress");
      if (reset) reset.addEventListener("click", function () {
        var modal = NT.modal({
          title: "Clear watched history?",
          body: '<p class="muted">This removes the lessons marked as watched and the recently viewed list on this device. Your access code and preferences stay.</p>',
          footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger-soft" id="confirmResetProgress">Clear history</button>'
        });
        modal.querySelector("#confirmResetProgress").addEventListener("click", function () {
          NT.progress.reset();
          modal.close();
          NT.toast("Watched history cleared", "success");
          render(data);
        });
      });
      NT.watchThumbnails(host);
      NT.initReveal();
    }
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
    profile: pageProfile, dashboard: pageDashboard, lesson: pageLesson, checkout: pageCheckout,
    universities: pageUniversities, university: pageUniversity, video: pageVideo
  };

  document.addEventListener("DOMContentLoaded", function () {
    NT.renderHeader();
    NT.renderFooter();
    var page = document.body.dataset.page;
    if (routes[page]) routes[page]();
    NT.watchThumbnails(document);
    NT.initReveal();
  });
})();

