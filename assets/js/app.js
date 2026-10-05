/* ============================================================
   NUCLEAR TUTORIALS — Public site behaviour
   Routing by <body data-page="...">

   Learning path: University → Semester → Course → Video lesson.
   ============================================================ */
(function () {
  var D = NT.data;

  /* Wait for the catalogue, and for the student's progress when they are
     signed in with an access code, before drawing a section. */
  function loadFor(root, render, viewOptions) {
    NT.view(root, function () {
      if (NT.store.isActive()) {
        NT.progress.load().then(render, render);
      } else {
        render();
      }
    }, viewOptions);
  }

  function watchNotice() {
    if (NT.store.isActive()) return "";
    return '<div class="inline-notice">' + NT.icon("info") +
      "<span>You are browsing without an access code, so lessons show their preview state. " +
      '<a href="' + NT.base() + 'pricing.html">See access packages</a>.</span></div>';
  }

  /* ============================ HOME ============================ */
  function pageHome() {
    var grid = document.getElementById("universityGrid");
    var stats = document.getElementById("homeStats");
    var featured = document.getElementById("featuredCourses");
    var steps = document.getElementById("homeSteps");

    if (stats) {
      loadFor(stats, function () {
        var totals = NT.content.totals();
        stats.innerHTML =
          NT.statCard({ icon: "building", value: totals.universities, label: "universities", hint: "plus a secondary school pathway" }) +
          NT.statCard({ icon: "graduation-cap", value: totals.courses, label: "courses", hint: "Semester 1 and Semester 2" }) +
          NT.statCard({ icon: "video", value: totals.videos, label: "video lessons", hint: "published and playable now" }) +
          NT.statCard({ icon: "layers", value: D.LEVELS.length, label: "access packages", hint: "from basic to premium" });
      }, { skeleton: '<div class="stat-row">' + NT.skeletonCards(4) + "</div>", count: 4 });
    }

    if (grid) {
      loadFor(grid, function () {
        var universities = NT.content.universities();
        var schools = NT.content.schools();
        var markup = universities.map(function (item) { return NT.universityCard(item); }).join("");
        if (schools.length) {
          markup += schools.map(function (item) { return NT.universityCard(item); }).join("");
        }
        grid.innerHTML = markup || NT.empty({
          icon: "building",
          title: "No universities published yet",
          message: "An administrator can add universities, courses and video lessons from the admin area."
        });
      }, { count: 4, shape: "wide" });
    }

    if (featured) {
      loadFor(featured, function () {
        var courses = NT.content.courses().filter(function (course, index, list) {
          return index === 0 || list.slice(0, index).every(function (previous) {
            return previous.universityId !== course.universityId;
          });
        }).slice(0, 3);
        featured.innerHTML = courses.map(function (course) { return NT.courseCard(course); }).join("");
      }, { count: 3 });
    }

    if (steps) {
      loadFor(steps, function () {
        var first = NT.content.universities()[0];
        var course = first ? NT.content.semesterCourses(first.id, 1)[0] : null;
        var lesson = course ? NT.content.lessonsOf(course.id)[0] : null;
        var items = [
          { title: "Choose your university", text: "Every course belongs to a specific university, so the work you see matches your programme.", href: "courses.html", icon: "building" },
          { title: "Pick your semester", text: "Semester 1 and Semester 2 are separate views, with their own course lists.", href: first ? "courses.html?university=" + first.id + "&semester=1" : "courses.html", icon: "calendar" },
          { title: "Open a course", text: "Each course collects its video lessons in the order they are taught.", href: course ? "course.html?id=" + course.id : "courses.html", icon: "book-open" },
          { title: "Press play", text: "Lessons play in the page, and your progress is saved to your access code.", href: lesson ? "lesson.html?id=" + lesson.id : "library.html", icon: "play" }
        ];
        steps.innerHTML = items.map(function (item, index) {
          return '<a class="step step-link reveal" data-delay="' + index + '" href="' + NT.base() + item.href + '">' +
            '<span class="step-num">0' + (index + 1) + "</span>" +
            '<span class="step-icon">' + NT.icon(item.icon) + "</span>" +
            "<h3>" + NT.esc(item.title) + "</h3><p>" + NT.esc(item.text) + "</p></a>";
        }).join("");
      }, { skeleton: NT.skeletonCards(4), count: 4 });
    }

    var packages = document.getElementById("homePackages");
    if (packages) {
      loadFor(packages, function () {
        var total = NT.counts().total;
        packages.innerHTML = D.LEVELS.map(function (level) {
          var details = NT.packageDetails(level);
          return '<article class="package-strip-card reveal">' +
            '<span class="price-name t-' + level + '">' + NT.esc(details.name) + "</span>" +
            '<div class="price-amount"><b>' + NT.kwacha(details.price) + "</b><span>/ " + NT.accessDays() + " days</span></div>" +
            '<p class="muted small">' + NT.esc(details.tagline || "") + "</p>" +
            '<span class="package-unlocks">' + NT.availableFor(level) + " of " + total + " published lessons</span>" +
            '<a class="btn btn-secondary btn-block" href="' + NT.base() + 'pricing.html">Compare packages</a></article>';
        }).join("");
      }, { count: 3 });
    }
  }

  /* ============================ COURSES (discovery) ============================ */
  function pageCourses() {
    var listHost = document.getElementById("courseList");
    if (!listHost) return;
    var toolbar = document.getElementById("discoveryToolbar");
    var summary = document.getElementById("courseResults");
    var chips = document.getElementById("activeFilters");
    var semesterHost = document.getElementById("semesterSwitchHost");

    var profile = NT.store.get().profile || {};
    var state = {
      universityId: "",
      semester: 0,
      level: "",
      query: ""
    };

    NT.content.load().then(function () {
      var query = NT.qs("university");
      var institutions = NT.content.universities().concat(NT.content.schools());
      if (query && institutions.some(function (item) { return item.id === query; })) state.universityId = query;
      else if (profile.universityId && institutions.some(function (item) { return item.id === profile.universityId; })) state.universityId = profile.universityId;

      var semesterQuery = parseInt(NT.qs("semester"), 10);
      if (semesterQuery === 1 || semesterQuery === 2) state.semester = semesterQuery;
      else if (profile.semester === 1 || profile.semester === 2) state.semester = profile.semester;

      var levelQuery = NT.qs("level");
      state.level = D.EDUCATION_LEVELS.some(function (item) { return item.id === levelQuery; })
        ? levelQuery
        : (profile.educationLevel || "");
      state.query = NT.qs("q") || "";
      renderToolbar();
      render();
    }, function () {
      listHost.innerHTML = NT.offlinePanel("retryCourses");
      var retry = document.getElementById("retryCourses");
      if (retry) retry.addEventListener("click", function () { location.reload(); });
    });

    function institutionOptions() {
      var universities = NT.content.universities();
      var schools = NT.content.schools();
      var visible = state.level === "high-school" ? schools : (state.level === "university" ? universities : universities.concat(schools));
      return visible;
    }

    function renderToolbar() {
      if (!toolbar) return;
      var options = institutionOptions();
      var levelTabs = [{ id: "", label: "All levels", icon: "layers" }].concat(D.EDUCATION_LEVELS.map(function (item) {
        return { id: item.id, label: item.label, icon: NT.pathwayIcon(item.id) };
      }));
      toolbar.innerHTML =
        '<div class="toolbar-row">' +
        '<div class="pathway-tabs" id="levelTabs" role="group" aria-label="Filter by study level">' +
        levelTabs.map(function (option) {
          var active = state.level === option.id;
          return '<button type="button" class="pathway-tab' + (active ? " active" : "") + '" data-level="' + option.id + '"' +
            ' aria-pressed="' + active + '">' + NT.icon(option.icon) + "<span>" + NT.esc(option.label) + "</span></button>";
        }).join("") + "</div>" +
        '<div class="toolbar-row-right">' +
        '<label class="field field-inline"><span class="sr-only">University</span>' +
        '<select class="input" id="universitySelect" aria-label="Choose a university">' +
        '<option value="">All institutions</option>' +
        options.map(function (item) {
          return '<option value="' + NT.esc(item.id) + '"' + (state.universityId === item.id ? " selected" : "") + ">" +
            NT.esc(item.name) + "</option>";
        }).join("") + "</select></label>" +
        '<label class="search-field"><span class="sr-only">Search courses</span>' + NT.icon("search") +
        '<input class="input" id="courseSearch" type="search" placeholder="Search courses" value="' + NT.esc(state.query) + '"></label>' +
        "</div></div>";

      toolbar.querySelectorAll("[data-level]").forEach(function (button) {
        button.addEventListener("click", function () {
          state.level = button.dataset.level;
          if (state.level) {
            NT.store.setProfile({ educationLevel: state.level });
            if (state.universityId) {
              var current = NT.content.university(state.universityId);
              if (current && current.level !== state.level) state.universityId = "";
            }
          }
          renderToolbar();
          render();
        });
      });
      var select = document.getElementById("universitySelect");
      if (select) {
        select.addEventListener("change", function () {
          state.universityId = select.value;
          NT.store.setProfile({ universityId: state.universityId });
          render();
        });
      }
    }

    function syncUrl() {
      if (!window.history || !window.history.replaceState) return;
      try {
        var url = new URL(window.location.href);
        if (state.universityId) url.searchParams.set("university", state.universityId); else url.searchParams.delete("university");
        if (state.semester) url.searchParams.set("semester", state.semester); else url.searchParams.delete("semester");
        if (state.query) url.searchParams.set("q", state.query); else url.searchParams.delete("q");
        if (state.level) url.searchParams.set("level", state.level); else url.searchParams.delete("level");
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch (error) { /* file:// previews cannot rewrite history */ }
    }

    function renderChips() {
      if (!chips) return;
      var university = state.universityId ? NT.content.university(state.universityId) : null;
      var markup = university
        ? '<span class="filter-chip">' + NT.esc(university.shortName) +
          '<button type="button" data-clear="university" aria-label="Show all institutions">' + NT.icon("x") + "</button></span>"
        : "";
      chips.innerHTML = markup;
      chips.classList.toggle("hidden", !markup);
      var clear = chips.querySelector("[data-clear]");
      if (clear) clear.addEventListener("click", function () {
        state.universityId = "";
        NT.store.setProfile({ universityId: "" });
        renderToolbar();
        render();
      });
    }

    function renderSemesterSwitch(counts) {
      if (!semesterHost) return;
      semesterHost.innerHTML = NT.semesterSwitch({
        id: "semesterSwitch",
        current: state.semester,
        counts: counts,
        allowAll: true,
        label: "Choose a semester"
      });
      semesterHost.querySelectorAll("[data-semester]").forEach(function (button) {
        button.addEventListener("click", function () {
          state.semester = parseInt(button.dataset.semester, 10) || 0;
          if (state.semester) NT.store.setProfile({ semester: state.semester });
          render();
        });
      });
    }

    function render() {
      var courses = NT.content.courses({
        universityId: state.universityId,
        semester: state.semester,
        level: state.level
      });
      var query = state.query.trim().toLowerCase();
      if (query) {
        courses = courses.filter(function (course) {
          return (course.title + " " + course.code + " " + course.description + " " + course.universityName)
            .toLowerCase().indexOf(query) !== -1;
        });
      }

      var counts = { 1: 0, 2: 0 };
      NT.content.courses({ universityId: state.universityId, level: state.level }).forEach(function (course) {
        counts[course.semester] = (counts[course.semester] || 0) + 1;
      });
      renderSemesterSwitch(counts);

      var lessons = courses.reduce(function (sum, course) { return sum + NT.content.lessonsOf(course.id).length; }, 0);
      var university = state.universityId ? NT.content.university(state.universityId) : null;
      var semesterLabel = state.semester ? NT.semesterLabel(state.semester) : "both semesters";

      listHost.innerHTML = courses.length
        ? courses.map(function (course) { return NT.courseCard(course); }).join("")
        : NT.empty({
          icon: "search",
          title: "No courses match yet",
          message: "Try another university, semester or search term — or ask your administrator to publish a course here.",
          action: '<button class="btn btn-secondary" type="button" id="emptyReset">' + NT.icon("rotate") + "Reset filters</button>"
        });
      var reset = document.getElementById("emptyReset");
      if (reset) reset.addEventListener("click", function () {
        state.universityId = "";
        state.semester = 0;
        state.level = "";
        state.query = "";
        renderToolbar();
        render();
      });

      if (summary) {
        summary.innerHTML = "<span>" +
          (university ? "<b>" + NT.esc(university.name) + "</b> · " : "") +
          NT.esc(NT.cap(semesterLabel)) + " · <b>" + courses.length + "</b> " + (courses.length === 1 ? "course" : "courses") +
          " · <b>" + lessons + "</b> video lessons</span>" +
          watchNotice();
      }
      renderChips();
      syncUrl();
      NT.initReveal();
    }

    /* The search box lives inside the toolbar, which is re-rendered with
       the filters, so the listener is delegated from the toolbar itself. */
    if (toolbar) {
      toolbar.addEventListener("input", function (event) {
        if (event.target && event.target.id === "courseSearch") {
          state.query = event.target.value;
          render();
        }
      });
    }
  }

  /* ============================ INDIVIDUAL COURSE ============================ */
  function pageCourse() {
    var root = document.getElementById("courseRoot");
    var id = NT.qs("id") || NT.qs("course") || "";
    loadFor(root, function () {
      var course = NT.content.course(id);
      if (!course) {
        root.innerHTML = NT.pageHead({
          crumbs: NT.crumbs([{ label: "Home", href: NT.base() + "index.html" }, { label: "Courses", href: NT.base() + "courses.html" }, { label: "Not found" }]),
          title: "Course not found",
          lede: "That course is not in the catalogue, or it is no longer published."
        }) + '<div class="container section-body">' + NT.empty({
          icon: "book-open",
          title: "Nothing to show",
          message: "Browse the catalogue to find the courses available for your university and semester.",
          action: '<a class="btn btn-primary" href="' + NT.base() + 'courses.html">Browse courses</a>'
        }) + "</div>";
        return;
      }

      document.title = course.title + " — Nuclear Tutorials";
      var lessons = NT.content.lessonsOf(course.id);
      var unlocked = lessons.filter(function (lesson) { return NT.isUnlocked(lesson); });
      var watched = NT.progress.watchedIn(course.id);
      var ranges = NT.tierRange(course.id);
      var state = NT.store.get();
      var university = NT.content.university(course.universityId);
      var firstTarget = unlocked[0] || lessons[0];
      var courseUrl = NT.base() + "course.html?id=" + encodeURIComponent(course.id);

      var hero = '<section class="course-hero"><div class="container">' +
        NT.crumbs([
          { label: "Home", href: NT.base() + "index.html" },
          { label: "Courses", href: NT.base() + "courses.html" },
          { label: university ? university.shortName : "Course", href: NT.base() + "courses.html?university=" + encodeURIComponent(course.universityId) + "&semester=" + course.semester },
          { label: course.title }
        ]) +
        '<div class="course-hero-copy">' +
        '<div class="course-hero-ident">' +
        '<span class="course-hero-icon" style="--tint:' + NT.esc(course.tint || "rgba(255,255,255,.12)") + ";--tint-fg:" + NT.esc(course.tintFg || "#fff") + '">' +
        NT.icon(course.icon || "book-open") + "</span>" +
        "<div><span class=\"course-hero-path\">" + NT.esc(course.universityName) + "</span>" +
        '<span class="course-hero-chip">' + NT.icon("calendar", "icon-sm") + NT.esc(NT.semesterLabel(course.semester)) + "</span>" +
        (course.code ? '<span class="course-hero-chip">' + NT.esc(course.code) + "</span>" : "") +
        "</div></div>" +
        "<h1>" + NT.esc(course.title) + "</h1>" +
        '<p class="course-hero-desc">' + NT.esc(course.description) + "</p>" +
        '<div class="course-meta-row">' +
        "<span>" + NT.icon("video") + "<span class='mono'>" + lessons.length + "</span> video lessons</span>" +
        (state.access
          ? "<span>" + NT.icon("unlock") + "<span class='mono'>" + unlocked.length + "</span> included with your package</span>"
          : "<span>" + NT.icon("lock") + "Log in to unlock included lessons</span>") +
        (state.access ? "<span>" + NT.icon("check-circle") + "<span class='mono'>" + watched + "</span> watched</span>" : "") +
        "</div>" +
        '<div class="course-hero-actions">' +
        (firstTarget
          ? '<a class="btn btn-primary btn-lg" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(firstTarget.id) + '">' +
            NT.icon("play") + (watched ? "Continue this course" : "Start learning") + "</a>"
          : '<a class="btn btn-secondary btn-lg" href="' + NT.base() + 'courses.html">' + NT.icon("arrow-left") + "Back to courses</a>") +
        '<a class="btn btn-outline-light btn-lg" href="' + NT.base() + "library.html?course=" + encodeURIComponent(course.id) + '">' +
        NT.icon("video") + "All lessons in library</a>" +
        "</div></div></div></section>";

      var progressSection = state.access
        ? '<section class="section section-tight"><div class="container">' +
          '<div class="card course-progress-card">' + NT.progressBar(watched, lessons.length, { label: course.title + " progress" }) +
          "<p class=\"muted small\">Progress is stored with your access code, so it follows you to any device you log in from.</p></div></div></section>"
        : "";

      var listSection = '<section class="section section-alt" id="lessons"><div class="container">' +
        '<div class="section-head section-head-row"><div><span class="eyebrow">' +
        NT.esc(NT.semesterLabel(course.semester)) + " · " + NT.esc(course.universityShort || course.universityName) + "</span>" +
        "<h2>Video lessons</h2><p>Watch in order, or open any lesson that your package includes.</p></div>" +
        '<span class="badge badge-brand">' + NT.plural(lessons.length, "lesson") + "</span></div>" +
        (lessons.length
          ? '<div class="video-grid">' + lessons.map(function (lesson, index) {
            return NT.videoCard(lesson, { description: false, index: index + 1 });
          }).join("") + "</div>"
          : NT.empty({
            icon: "video",
            title: "No video lessons in this course yet",
            message: "An administrator can add the first lesson from Admin → Video lessons. Check back soon.",
            action: '<a class="btn btn-secondary" href="' + NT.base() + 'library.html">Browse other lessons</a>'
          })) +
        "</div></section>";

      var accessSection = '<section class="section"><div class="container">' +
        '<div class="section-head"><span class="eyebrow">Access</span><h2>Which lessons each package includes</h2>' +
        "<p>Package levels apply to every course in the catalogue.</p></div>" +
        '<div class="tier-strip">' + D.LEVELS.map(function (level) {
          var range = ranges[level];
          var current = state.access === level;
          return '<div class="tier-cell tc-' + level + (current ? " is-current" : "") + '">' +
            '<span class="name"><span class="dot"></span>' + D.LEVEL_LABEL[level] + (current ? " · current" : "") + "</span>" +
            '<span class="what">' + (range ? "Lessons <span class='mono'>" + range.from + "–" + range.to + "</span>" : "No lessons") + "</span>" +
            "<small>" + (range ? range.count + " of " + lessons.length + " lessons" : "") + "</small></div>";
        }).join("") + "</div>" +
        '<p class="muted small section-note">' + (state.access
          ? "Your " + NT.esc(NT.packageDetails(state.access).name) + " package includes " + unlocked.length + " of " + lessons.length + " lessons in this course."
          : 'Already have a code? <a href="' + NT.base() + 'access.html">Log in to see your access</a>. Need a code? <a href="' + NT.base() + 'pricing.html">Compare packages</a>.') +
        "</p></div></section>";

      root.innerHTML = hero + progressSection + listSection + accessSection;
      document.title = course.title + " — " + course.universityName + " — Nuclear Tutorials";
    });
  }

  /* ============================ LESSON (video) ============================ */
  function pageLesson() {
    var root = document.getElementById("lessonRoot");
    var id = NT.qs("id") || "";
    if (!root) return;

    root.innerHTML = NT.skeletonCards(1, "wide");

    function paint(payload) {
      var video = payload.video;
      var course = payload.course || NT.content.course(video.courseId);
      var university = payload.university || NT.content.university(video.universityId);
      var lessons = payload.lessons || NT.content.lessonsOf(video.courseId);
      var previous = payload.previous || null;
      var next = payload.next || null;
      var index = lessons.map(function (item) { return item.id; }).indexOf(video.id);
      var unlocked = NT.isUnlocked(video);
      var entry = NT.progress.entry(video.id);
      var watched = !!(entry && entry.completed);
      var started = !!entry;
      var embed = unlocked ? NT.embedUrl(video) : "";

      document.title = video.title + " — Nuclear Tutorials";

      var crumbs = NT.crumbs([
        { label: "Home", href: NT.base() + "index.html" },
        { label: university ? university.shortName : "Courses", href: NT.base() + "courses.html?university=" + encodeURIComponent(video.universityId) + "&semester=" + video.semester },
        { label: course ? course.title : "Course", href: NT.base() + "course.html?id=" + encodeURIComponent(video.courseId) },
        { label: video.title }
      ]);

      var player;
      if (!unlocked) {
        player = '<div class="player player-locked">' +
          NT.thumb(video, "xl") +
          '<div class="player-lock-overlay"><span class="lock-badge">' + NT.icon("lock") + D.LEVEL_LABEL[NT.levelOf(video)] + " lesson</span>" +
          "<h2>" + NT.esc(video.title) + "</h2>" +
          "<p>This lesson is included with the " + D.LEVEL_LABEL[NT.levelOf(video)] + " package or above.</p>" +
          '<div class="player-lock-actions">' +
          '<a class="btn btn-primary" href="' + NT.base() + 'pricing.html">' + NT.icon("layers") + "Compare packages</a>" +
          '<a class="btn btn-outline-light" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Log in with a code</a>" +
          "</div></div></div>";
      } else if (embed && video.provider === "direct") {
        player = '<div class="player"><video controls preload="metadata" playsinline poster="' + NT.esc(video.thumbnailUrl || "") + '" src="' + NT.esc(embed) + '"></video></div>';
      } else if (embed) {
        player = '<div class="player player-embed"><iframe src="' + NT.esc(embed) + '?rel=0&modestbranding=1" title="' +
          NT.esc(video.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
          'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe></div>';
      } else {
        player = '<div class="player player-external">' + NT.thumb(video, "xl") +
          '<div class="player-lock-overlay"><h2>Play this lesson at the source</h2>' +
          "<p>This lesson is hosted by " + NT.esc(NT.providerLabel(video.provider)) + ", so it opens in a new tab.</p>" +
          '<a class="btn btn-primary" href="' + NT.esc(video.sourceUrl) + '" target="_blank" rel="noopener">' +
          NT.icon("external") + "Open lesson</a></div></div>";
      }

      var actions = unlocked
        ? '<div class="lesson-actions">' +
          '<button class="btn ' + (watched ? "btn-secondary" : "btn-primary") + '" type="button" id="toggleWatched" data-watched="' + (watched ? "1" : "0") + '">' +
          NT.icon(watched ? "check-circle" : "check") + (watched ? "Watched" : "Mark as watched") + "</button>" +
          '<a class="btn btn-secondary" href="' + NT.esc(video.sourceUrl) + '" target="_blank" rel="noopener">' +
          NT.icon("external") + "Open on " + NT.esc(NT.providerLabel(video.provider)) + "</a>" +
          (next ? '<a class="btn btn-ghost" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(next.id) + '">Next lesson' + NT.icon("arrow-right", "icon-sm") + "</a>" : "") +
          "</div>"
        : "";

      var meta = '<div class="lesson-meta">' +
        NT.levelBadge(NT.levelOf(video), !unlocked) +
        (video.durationSeconds ? "<span>" + NT.icon("clock", "icon-sm") + NT.duration(video.durationSeconds) + "</span>" : "") +
        "<span>" + NT.icon("video", "icon-sm") + NT.esc(NT.providerLabel(video.provider || "other")) + "</span>" +
        (started ? "<span class=\"lesson-meta-state\">" + NT.icon("check-circle", "icon-sm") + (watched ? "Watched" : "In progress") + "</span>" : "") +
        "</div>";

      var context = '<div class="lesson-context">' +
        '<a href="' + NT.base() + "courses.html?university=" + encodeURIComponent(video.universityId) + "&semester=" + video.semester + '">' +
        NT.icon("building", "icon-sm") + NT.esc(video.universityName) + "</a>" +
        '<a href="' + NT.base() + "courses.html?university=" + encodeURIComponent(video.universityId) + "&semester=" + video.semester + '">' +
        NT.icon("calendar", "icon-sm") + NT.esc(NT.semesterLabel(video.semester)) + "</a>" +
        '<a href="' + NT.base() + "course.html?id=" + encodeURIComponent(video.courseId) + '">' +
        NT.icon("book-open", "icon-sm") + NT.esc(video.courseTitle) + "</a>" +
        "</div>";

      var main = '<article class="lesson-page">' + crumbs +
        '<header class="lesson-head">' + context +
        "<h1>" + NT.esc(video.title) + "</h1>" +
        (video.topic ? '<p class="lesson-topic">' + NT.esc(video.topic) + "</p>" : "") +
        meta + actions + "</header>" +
        player +
        (video.description ? '<div class="lesson-description"><h2>About this lesson</h2><p>' + NT.esc(video.description) + "</p></div>" : "") +
        '<p class="lesson-source">Lesson ' + (index + 1) + " of " + lessons.length + " in " + NT.esc(video.courseTitle) +
        (unlocked ? ". Video hosted by " + NT.esc(NT.providerLabel(video.provider)) + "." : ". Source hidden until your package includes it.") +
        "</p></article>";

      var navigation = '<nav class="lesson-pager" aria-label="Lesson navigation">' +
        (previous
          ? '<a class="pager-link" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(previous.id) + '">' +
            NT.icon("arrow-left") + "<span><small>Previous lesson</small><b>" + NT.esc(previous.title) + "</b></span></a>"
          : "<span></span>") +
        (next
          ? '<a class="pager-link pager-next" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(next.id) + '">' +
            "<span><small>Next lesson</small><b>" + NT.esc(next.title) + "</b></span>" + NT.icon("arrow-right") + "</a>"
          : "<span></span>") +
        "</nav>";

      var others = lessons.filter(function (item) { return item.id !== video.id; }).slice(0, 6);
      var more = others.length
        ? '<section class="section section-alt"><div class="container">' +
          '<div class="section-head section-head-row"><div><span class="eyebrow">' + NT.esc(video.courseTitle) + "</span>" +
          "<h2>More lessons in this course</h2></div>" +
          '<a class="link-arrow" href="' + NT.base() + "course.html?id=" + encodeURIComponent(video.courseId) + '">Course overview ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
          '<div class="video-grid">' + others.map(function (item) { return NT.videoCard(item, { description: false, context: false }); }).join("") + "</div>" +
          "</div></section>"
        : "";

      root.innerHTML = '<div class="container lesson-shell">' + main + navigation + "</div>" + more;

      if (unlocked && !started && NT.store.isActive()) NT.markWatched(video.id, { completed: false });

      var toggle = document.getElementById("toggleWatched");
      if (toggle) {
        toggle.addEventListener("click", function () {
          var isWatched = toggle.dataset.watched === "1";
          toggle.disabled = true;
          NT.markWatched(video.id, { completed: !isWatched }).then(function () {
            toggle.disabled = false;
            toggle.dataset.watched = isWatched ? "0" : "1";
            toggle.innerHTML = NT.icon(isWatched ? "check" : "check-circle") + (isWatched ? "Mark as watched" : "Watched");
            toggle.className = "btn " + (isWatched ? "btn-primary" : "btn-secondary");
            NT.toast(isWatched ? "Marked as not watched" : "Saved to your progress", "success");
          }, function () {
            toggle.disabled = false;
            NT.toast("Progress needs an active access code", "error");
          });
        });
      }
      NT.initReveal();
    }

    /* The lesson itself is requested from the server with the student's
       access code, so a protected lesson cannot be opened by editing the
       page or by requesting the URL directly. */
    var preload = [NT.content.load().catch(function () { /* the lesson request still works */ })];
    if (NT.store.isActive()) preload.push(NT.progress.load().catch(function () { /* progress is optional */ }));
    Promise.all(preload).then(function () {
      return NT.content.lesson(id);
    }).then(function (payload) {
      paint(payload);
    }, function (error) {
      if (error && error.status === 403) return paintLocked(error.details);
      if (error && error.status === 404) return paintMissing();
      var local = NT.content.video(id);
      if (local && NT.isUnlocked(local)) return paint({ video: local });
      root.innerHTML = NT.offlinePanel("retryLesson");
      var retry = document.getElementById("retryLesson");
      if (retry) retry.addEventListener("click", function () { location.reload(); });
    });

    function paintLocked(details) {
      /* The lock response carries only identification fields, so the public
         catalogue summary supplies the title, description and context. */
      var summary = NT.content.video(id) || {};
      var locked = (details && details.video) || {};
      var video = Object.assign({}, summary, locked, {
        id: locked.id || summary.id,
        courseId: locked.courseId || summary.courseId,
        semester: locked.semester || summary.semester,
        level: locked.level || summary.level
      });
      if (!video || !video.title) return paintMissing();
      var course = NT.content.course(video.courseId) || {};
      document.title = video.title + " — Nuclear Tutorials";
      root.innerHTML = '<div class="container lesson-shell"><article class="lesson-page">' +
        NT.crumbs([
          { label: "Home", href: NT.base() + "index.html" },
          { label: course.universityShort || "Courses", href: NT.base() + "courses.html?university=" + encodeURIComponent(course.universityId || "") },
          { label: course.title || "Course", href: NT.base() + "course.html?id=" + encodeURIComponent(video.courseId) },
          { label: video.title }
        ]) +
        '<header class="lesson-head"><div class="lesson-context">' +
        '<span>' + NT.icon("lock", "icon-sm") + D.LEVEL_LABEL[NT.levelOf(video)] + " lesson</span>" +
        "</div><h1>" + NT.esc(video.title) + "</h1></header>" +
        '<div class="player player-locked">' + NT.thumb(video, "xl") +
        '<div class="player-lock-overlay"><span class="lock-badge">' + NT.icon("lock") + "Package required</span>" +
        "<h2>This lesson is not included in your package</h2>" +
        "<p>The video source is only sent to students whose access code covers the " + D.LEVEL_LABEL[NT.levelOf(video)] +
        " tier. Choose a package that includes it, or redeem a matching code.</p>" +
        '<div class="player-lock-actions">' +
        '<a class="btn btn-primary" href="' + NT.base() + 'pricing.html">' + NT.icon("layers") + "Compare packages</a>" +
        '<a class="btn btn-outline-light" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Log in with a code</a>" +
        "</div></div></div>" +
        (video.description ? '<div class="lesson-description"><h2>About this lesson</h2><p>' + NT.esc(video.description) + "</p></div>" : "") +
        '<p class="lesson-source">The protected video URL is not visible on this page or in this response.</p>' +
        "</article></div>";
    }

    function paintMissing() {
      root.innerHTML = NT.empty({
        icon: "video",
        title: "Lesson not found",
        message: "This video lesson is not published, or the link is out of date.",
        action: '<a class="btn btn-primary" href="' + NT.base() + 'library.html">Open the video library</a>'
      });
    }
  }

  /* ============================ LIBRARY ============================ */
  function pageLibrary() {
    var root = document.getElementById("libRoot");
    if (!root) return;
    var search = document.getElementById("libSearch");
    var statusHost = document.getElementById("libStatus");
    var summary = document.getElementById("libSummary");
    var chips = document.getElementById("activeFilters");
    var toolbar = document.getElementById("libToolbar");
    var filterHost = document.getElementById("libFilters");
    var gate = document.getElementById("libGate");

    var state = { universityId: "", semester: 0, courseId: "", status: "all", level: "", query: "" };

    NT.content.load().then(function () {
      var university = NT.qs("university");
      if (university && NT.content.university(university)) state.universityId = university;
      var semester = parseInt(NT.qs("semester"), 10);
      if (semester === 1 || semester === 2) state.semester = semester;
      var course = NT.qs("course");
      if (course && NT.content.course(course)) {
        state.courseId = course;
        var owner = NT.content.course(course);
        state.universityId = owner.universityId;
        state.semester = owner.semester;
      }
      state.level = NT.qs("level") && D.LEVELS.indexOf(NT.qs("level")) !== -1 ? NT.qs("level") : "";
      state.query = NT.qs("q") || "";
      if (search) search.value = state.query;

      renderFilters();
      render();

      if (NT.store.isActive()) {
        NT.progress.load().then(function () {
          if (gate) gate.classList.add("hidden");
          render();
        });
      }
    }, function () {
      root.innerHTML = NT.offlinePanel("retryLib");
      var retry = document.getElementById("retryLib");
      if (retry) retry.addEventListener("click", function () { location.reload(); });
    });

    function renderFilters() {
      if (!filterHost) return;
      var universities = NT.content.universities().concat(NT.content.schools());
      var courses = NT.content.courses({ universityId: state.universityId, semester: state.semester });
      filterHost.innerHTML =
        '<label class="field field-inline"><span class="field-label">University</span>' +
        '<select class="input" id="libUniversity" aria-label="Filter by university">' +
        '<option value="">All universities</option>' +
        universities.map(function (item) {
          return '<option value="' + NT.esc(item.id) + '"' + (state.universityId === item.id ? " selected" : "") + ">" +
            NT.esc(item.name) + "</option>";
        }).join("") + "</select></label>" +
        '<label class="field field-inline"><span class="field-label">Course</span>' +
        '<select class="input" id="libCourse" aria-label="Filter by course">' +
        '<option value="">All courses</option>' +
        courses.map(function (item) {
          return '<option value="' + NT.esc(item.id) + '"' + (state.courseId === item.id ? " selected" : "") + ">" +
            NT.esc(item.code ? item.code + " · " + item.title : item.title) + "</option>";
        }).join("") + "</select></label>" +
        '<label class="field field-inline"><span class="field-label">Package level</span>' +
        '<select class="input" id="libLevel" aria-label="Filter by package level">' +
        '<option value="">Any level</option>' +
        D.LEVELS.map(function (level) {
          return '<option value="' + level + '"' + (state.level === level ? " selected" : "") + ">" + D.LEVEL_LABEL[level] + "</option>";
        }).join("") + "</select></label>";

      document.getElementById("libUniversity").addEventListener("change", function (event) {
        state.universityId = event.target.value;
        state.courseId = "";
        renderFilters();
        render();
      });
      document.getElementById("libCourse").addEventListener("change", function (event) {
        state.courseId = event.target.value;
        render();
      });
      document.getElementById("libLevel").addEventListener("change", function (event) {
        state.level = event.target.value;
        render();
      });
    }

    function renderStatus() {
      if (!statusHost) return;
      var options = [{ id: "all", label: "All" }, { id: "open", label: "Available" }, { id: "locked", label: "Locked" }];
      statusHost.innerHTML = options.map(function (option) {
        var active = state.status === option.id;
        return '<button type="button" data-status="' + option.id + '" class="' + (active ? "active" : "") + '" aria-pressed="' + active + '">' +
          option.label + "</button>";
      }).join("");
      statusHost.querySelectorAll("[data-status]").forEach(function (button) {
        button.addEventListener("click", function () { state.status = button.dataset.status; render(); });
      });
    }

    function syncUrl() {
      if (!window.history || !window.history.replaceState) return;
      try {
        var url = new URL(window.location.href);
        function set(key, value) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
        set("university", state.universityId);
        set("semester", state.semester || "");
        set("course", state.courseId);
        set("level", state.level);
        set("q", state.query);
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch (error) { /* ignore */ }
    }

    function renderChips() {
      if (!chips) return;
      var parts = [];
      if (state.universityId) {
        var university = NT.content.university(state.universityId);
        parts.push({ key: "university", label: university ? university.shortName : state.universityId });
      }
      if (state.semester) parts.push({ key: "semester", label: NT.semesterLabel(state.semester) });
      if (state.courseId) {
        var course = NT.content.course(state.courseId);
        parts.push({ key: "course", label: course ? course.title : state.courseId });
      }
      if (state.level) parts.push({ key: "level", label: D.LEVEL_LABEL[state.level] + " lessons" });
      chips.innerHTML = parts.map(function (part) {
        return '<span class="filter-chip">' + NT.esc(part.label) +
          '<button type="button" data-clear="' + part.key + '" aria-label="Clear ' + NT.esc(part.label) + ' filter">' + NT.icon("x") + "</button></span>";
      }).join("");
      chips.classList.toggle("hidden", !parts.length);
      chips.querySelectorAll("[data-clear]").forEach(function (button) {
        button.addEventListener("click", function () {
          var key = button.dataset.clear;
          if (key === "university") { state.universityId = ""; state.courseId = ""; renderFilters(); }
          if (key === "semester") state.semester = 0;
          if (key === "course") state.courseId = "";
          if (key === "level") state.level = "";
          render();
        });
      });
    }

    function renderState() {
      if (!toolbar) return;
      var semesterHost = document.getElementById("libSemesters");
      if (!semesterHost) return;
      semesterHost.innerHTML = NT.semesterSwitch({
        id: "libSemesters",
        current: state.semester,
        allowAll: true,
        label: "Filter lessons by semester"
      });
      semesterHost.querySelectorAll("[data-semester]").forEach(function (button) {
        button.addEventListener("click", function () {
          state.semester = parseInt(button.dataset.semester, 10) || 0;
          state.courseId = "";
          renderFilters();
          render();
        });
      });
    }

    function render() {
      renderState();
      renderStatus();
      renderChips();
      syncUrl();
      var query = state.query.trim().toLowerCase();
      var videos = NT.content.videos({
        universityId: state.universityId,
        semester: state.semester,
        courseId: state.courseId,
        level: state.level
      }).filter(function (video) {
        if (state.status === "open" && !NT.isUnlocked(video)) return false;
        if (state.status === "locked" && NT.isUnlocked(video)) return false;
        if (!query) return true;
        return (video.title + " " + video.topic + " " + video.description + " " + video.courseTitle + " " + video.universityName)
          .toLowerCase().indexOf(query) !== -1;
      });

      root.innerHTML = videos.length
        ? '<div class="video-grid">' + videos.map(function (video) { return NT.videoCard(video); }).join("") + "</div>"
        : NT.empty({
          icon: "video",
          title: "No lessons match these filters",
          message: "Clear a filter or search a different topic.",
          action: '<button class="btn btn-secondary" type="button" id="clearLibFilters">' + NT.icon("rotate") + "Reset filters</button>"
        });
      var reset = document.getElementById("clearLibFilters");
      if (reset) reset.addEventListener("click", function () {
        state.universityId = "";
        state.semester = 0;
        state.courseId = "";
        state.level = "";
        state.status = "all";
        state.query = "";
        if (search) search.value = "";
        renderFilters();
        render();
      });

      if (summary) {
        summary.textContent = videos.length + " of " + NT.content.videos().length + " published lessons shown" +
          (NT.store.isActive() ? "" : " · log in to unlock included lessons");
      }
      if (gate) gate.classList.toggle("hidden", NT.store.isActive());
      NT.initReveal();
    }

    if (search) {
      search.addEventListener("input", function () {
        state.query = search.value;
        render();
      });
    }
  }

  /* ============================ DASHBOARD ============================ */
  function pageDashboard() {
    var root = document.getElementById("dashRoot");
    if (!root) return;
    var state = NT.store.get();

    if (!state.access) {
      root.innerHTML = '<div class="dashboard-empty">' +
        '<span class="empty-icon">' + NT.icon("key", "icon-lg") + "</span>" +
        "<h1>Log in to continue</h1>" +
        "<p>Enter the access code from your package to open your dashboard, progress and lessons.</p>" +
        '<div class="empty-actions"><a class="btn btn-primary" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Log in with an access code</a>" +
        '<a class="btn btn-secondary" href="' + NT.base() + 'pricing.html">Compare packages</a></div></div>';
      return;
    }

    loadFor(root, function () {
      var current = NT.store.get();
      var profile = current.profile || {};
      var university = profile.universityId ? NT.content.university(profile.universityId) : null;
      var semester = profile.semester === 1 || profile.semester === 2 ? profile.semester : 0;
      if (!university) {
        university = NT.content.universities()[0] || null;
      }
      var semesterCourses = university ? NT.content.semesterCourses(university.id, semester || 1) : [];
      var meta = current.accessMeta || {};
      var accessInfo = NT.packageDetails(current.access);
      var expiry = meta.expiresAt ? NT.fmtDate(meta.expiresAt) : "";
      var watched = NT.progress.items();
      var continueRow = NT.progress.mostRecent(20).filter(function (row) { return !row.entry.completed; })[0] ||
        NT.progress.mostRecent(1)[0] || null;
      var recentlyViewed = NT.progress.mostRecent(3);

      var semesterCounts = { 1: 0, 2: 0 };
      if (university) {
        NT.content.semesterCourses(university.id, 1).length && (semesterCounts[1] = NT.content.semesterCourses(university.id, 1).length);
        NT.content.semesterCourses(university.id, 2).length && (semesterCounts[2] = NT.content.semesterCourses(university.id, 2).length);
      }

      var heading = '<header class="dashboard-heading"><div>' +
        '<span class="eyebrow">Your learning</span>' +
        "<h1>" + (profile.name ? "Welcome back, " + NT.esc(profile.name) + "." : "Welcome back.") + "</h1>" +
        "<p>" + NT.esc(accessInfo.name) + " package" +
        (university ? " · " + NT.esc(university.name) : "") +
        (semester ? " · " + NT.esc(NT.semesterLabel(semester)) : "") +
        (expiry ? " · access until " + NT.esc(expiry) : "") + "</p></div>" +
        '<div class="dashboard-actions">' +
        '<a class="btn btn-secondary btn-sm" href="' + NT.base() + 'profile.html">' + NT.icon("settings") + "Preferences</a>" +
        '<button class="btn btn-ghost btn-sm" type="button" id="dashLogout">' + NT.icon("log-out") + "Log out</button>" +
        "</div></header>";

      var stats = '<div class="stat-row">' + [
        NT.statCard({ icon: "check-circle", value: NT.progress.count(), label: "lessons watched", hint: "saved to your code" }),
        NT.statCard({ icon: "unlock", value: NT.availableFor(current.access), label: "lessons included", hint: accessInfo.name + " package" }),
        NT.statCard({ icon: "book-open", value: semesterCourses.length, label: university ? university.shortName + " " + (semester ? NT.semesterShort(semester) : "courses") : "courses", hint: university ? university.name : "Choose a university" }),
        NT.statCard({ icon: "clock", value: expiry || "—", label: "access expires", hint: NT.accessDays() + " day package" })
      ].join("") + "</div>";

      var continueCard = continueRow
        ? '<section class="card dashboard-continue">' +
          '<div class="dashboard-continue-media">' + NT.thumb(continueRow.video, "lg") + "</div>" +
          '<div class="dashboard-continue-copy"><span class="eyebrow">' + (continueRow.entry.completed ? "Last watched" : "Continue learning") + "</span>" +
          "<h2>" + NT.esc(continueRow.video.title) + "</h2>" +
          '<p>' + NT.esc(NT.videoContext(continueRow.video)) + "</p>" +
          '<div class="dashboard-continue-actions">' +
          '<a class="btn btn-primary" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(continueRow.video.id) + '">' +
          NT.icon("play") + (continueRow.entry.completed ? "Watch again" : "Resume lesson") + "</a>" +
          '<a class="btn btn-secondary" href="' + NT.base() + "course.html?id=" + encodeURIComponent(continueRow.video.courseId) + '">Course overview</a>' +
          "</div></div></section>"
        : '<section class="card dashboard-continue dashboard-start"><div class="dashboard-continue-copy">' +
          '<span class="eyebrow">Start learning</span><h2>Your first lesson is waiting</h2>' +
          "<p>Open a course for your university and semester, pick a lesson and press play. Progress saves automatically to your access code.</p>" +
          '<a class="btn btn-primary" href="' + NT.base() + 'courses.html' + (university ? "?university=" + encodeURIComponent(university.id) + "&semester=" + (semester || 1) : "") + '">' +
          NT.icon("play") + "Browse your courses</a></div></section>";

      var recentSection = recentlyViewed.length
        ? '<section class="dashboard-section"><div class="section-head section-head-row"><div><h2>Recently viewed</h2>' +
          "<p>The last lessons you opened with this access code.</p></div>" +
          '<a class="link-arrow" href="' + NT.base() + 'library.html">Video library ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
          '<div class="video-grid video-grid-compact">' + recentlyViewed.map(function (row) {
            return NT.videoCard(row.video, { description: false });
          }).join("") + "</div></section>"
        : "";

      var courseSection = university
        ? '<section class="dashboard-section"><div class="section-head section-head-row"><div>' +
          "<h2>" + NT.esc(university.shortName) + " courses</h2>" +
          "<p>Switch semester to see its course list. Course cards show how much of each course you have watched.</p></div></div>" +
          NT.semesterSwitch({ id: "dashSemesters", current: semester || 0, counts: semesterCounts, allowAll: true, label: "Dashboard semester" }) +
          '<div class="course-grid dashboard-course-grid" id="dashCourses">' +
          (semesterCourses.length
            ? semesterCourses.map(function (course) { return NT.courseCard(course); }).join("")
            : NT.empty({ icon: "book-open", title: "No courses in this semester yet", message: "Try the other semester or another university." })) +
          "</div></section>"
        : "";

      root.innerHTML = '<div class="dashboard-page">' + heading + stats + continueCard + recentSection + courseSection + "</div>";

      var logout = document.getElementById("dashLogout");
      if (logout) logout.addEventListener("click", function () {
        var modal = NT.modal({
          title: "Log out of this device?",
          body: "<p class=\"muted\">Your access code and progress stay on the server. You can log in again at any time with the same code.</p>",
          footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger-soft" id="confirmLogout">Log out</button>'
        });
        modal.querySelector("#confirmLogout").addEventListener("click", function () {
          NT.store.clearAccess();
          NT.toast("Logged out of this device", "success");
          location.href = NT.base() + "index.html";
        });
      });

      var switchHost = document.getElementById("dashSemesters");
      if (switchHost) {
        switchHost.querySelectorAll("[data-semester]").forEach(function (button) {
          button.addEventListener("click", function () {
            var chosen = parseInt(button.dataset.semester, 10) || 0;
            NT.store.setProfile({ universityId: university.id, semester: chosen });
            pageDashboard();
          });
        });
      }
      var courseHost = document.getElementById("dashCourses");
      if (courseHost) NT.initReveal();
    });
  }

  /* ============================ SEARCH ============================ */
  function pageSearch() {
    var input = document.getElementById("globalSearchInput");
    var results = document.getElementById("searchResults");
    var summary = document.getElementById("searchSummary");
    var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-search-kind]"));
    if (!input || !results) return;
    var kind = NT.qs("type") || "all";
    var validKinds = ["all", "courses", "videos", "universities"];
    if (validKinds.indexOf(kind) === -1) kind = "all";
    input.value = NT.qs("q") || "";
    var timer = null;

    function syncUrl(value) {
      if (!window.history || !window.history.replaceState) return;
      try {
        var url = new URL(window.location.href);
        if (value) url.searchParams.set("q", value); else url.searchParams.delete("q");
        if (kind !== "all") url.searchParams.set("type", kind); else url.searchParams.delete("type");
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch (error) { /* ignore */ }
    }

    function institutionResult(item) {
      var courses = NT.content.semesterCourses(item.id, 1).length + NT.content.semesterCourses(item.id, 2).length;
      return '<article class="search-result">' +
        '<span class="search-result-icon">' + NT.icon(item.level === "high-school" ? "book-open" : "building") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>' +
        (item.level === "high-school" ? "Secondary pathway" : "University") + "</span><span>" + NT.esc(item.city || "") + "</span></div>" +
        "<h3>" + NT.esc(item.name) + "</h3>" +
        "<p>" + NT.esc(item.summary || "") + "</p>" +
        "<small>" + NT.plural(courses, "course") + " · " + NT.plural(item.videoCount, "video lesson") + "</small></div>" +
        '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "courses.html?university=" + encodeURIComponent(item.id) + '">Open</a></article>';
    }

    function courseResult(course) {
      return '<article class="search-result">' +
        '<span class="search-result-icon" style="--tint:' + NT.esc(course.tint || "var(--bg-soft)") + ";--tint-fg:" + NT.esc(course.tintFg || "var(--ink-2)") + '">' +
        NT.icon(course.icon || "book-open") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>' + NT.esc(course.universityName) + "</span><span>" +
        NT.esc(NT.semesterLabel(course.semester)) + "</span>" + (course.code ? "<span>" + NT.esc(course.code) + "</span>" : "") + "</div>" +
        "<h3>" + NT.esc(course.title) + "</h3><p>" + NT.esc(course.description) + "</p>" +
        "<small>" + NT.plural(NT.content.lessonsOf(course.id).length, "video lesson") + "</small></div>" +
        '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "course.html?id=" + encodeURIComponent(course.id) + '">Open course</a></article>';
    }

    function videoResult(video) {
      return '<article class="search-result search-result-video">' +
        '<span class="search-result-thumb">' + NT.thumb(video, "sm") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta">' +
        "<span>" + NT.esc(video.universityShort || video.universityName) + "</span>" +
        "<span>" + NT.esc(NT.semesterLabel(video.semester)) + "</span>" +
        "<span>" + D.LEVEL_LABEL[NT.levelOf(video)] + "</span>" +
        (video.durationSeconds ? "<span>" + NT.duration(video.durationSeconds) + "</span>" : "") + "</div>" +
        "<h3>" + NT.esc(video.title) + "</h3>" +
        "<p>" + NT.esc(video.topic || video.courseTitle) + "</p>" +
        "<small>" + NT.esc(video.courseTitle) + "</small></div>" +
        '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "lesson.html?id=" + encodeURIComponent(video.id) + '">' +
        (NT.isUnlocked(video) ? "Watch" : "Preview") + "</a></article>";
    }

    function announcementResult(notice) {
      return '<article class="search-result">' +
        '<span class="search-result-icon">' + NT.icon("bell") + "</span>" +
        '<div class="search-result-copy"><div class="search-result-meta"><span>Announcement</span><span>' +
        NT.fmtDate(notice.updatedAt || notice.createdAt) + "</span></div>" +
        "<h3>" + NT.esc(notice.title) + "</h3><p>" + NT.esc(notice.body) + "</p></div>" +
        '<a class="search-result-link" href="' + NT.base() + 'announcements.html" aria-label="Read announcement">' + NT.icon("arrow-up-right") + "</a></article>";
    }

    function render() {
      tabs.forEach(function (tab) {
        var active = tab.dataset.searchKind === kind;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", String(active));
      });
      var query = input.value.trim();
      syncUrl(query);
      if (!query) {
        summary.textContent = "Search the catalogue.";
        results.innerHTML = '<div class="search-start"><span class="search-start-icon">' + NT.icon("search", "icon-lg") + "</span>" +
          "<h2>Search lessons, courses and universities</h2>" +
          "<p>Type a topic such as “nuclear”, “calculus” or “data structures”.</p>" +
          '<div class="search-suggestions"><span>Try a topic</span>' +
          ["calculus", "nuclear", "mechanics", "programming", "statistics"].map(function (word) {
            return '<button class="search-suggestion" type="button" data-suggestion="' + word + '">' + NT.icon("search") + word + "</button>";
          }).join("") + "</div></div>";
        results.querySelectorAll("[data-suggestion]").forEach(function (button) {
          button.addEventListener("click", function () { input.value = button.dataset.suggestion; render(); input.focus(); });
        });
        return;
      }

      var local = NT.content.search(query);
      NT.api.get("/api/search?q=" + encodeURIComponent(query)).then(function (payload) {
        paint(payload, query);
      }, function () {
        paint({ universities: local.universities, courses: local.courses, videos: local.videos, announcements: [] }, query);
      });
    }

    function paint(payload, query) {
      var universities = payload.universities || [];
      var courses = payload.courses || [];
      var videos = payload.videos || [];
      var announcements = payload.announcements || [];
      var count = (kind === "all" ? universities.length + courses.length + videos.length + announcements.length
        : kind === "courses" ? courses.length
          : kind === "videos" ? videos.length
            : universities.length);
      summary.textContent = count + (count === 1 ? " result for " : " results for ") + "“" + query + "”";

      var parts = [];
      if (kind === "all" || kind === "universities") {
        if (universities.length) parts.push(section("Universities and schools", universities.length, universities.map(institutionResult)));
      }
      if (kind === "all" || kind === "courses") {
        if (courses.length) parts.push(section("Courses", courses.length, courses.map(courseResult)));
      }
      if (kind === "all" || kind === "videos") {
        if (videos.length) parts.push(section("Video lessons", videos.length, videos.map(videoResult)));
      }
      if (kind === "all" && announcements.length) {
        parts.push(section("Announcements", announcements.length, announcements.map(announcementResult)));
      }
      results.innerHTML = parts.length ? parts.join("") :
        '<div class="search-empty"><span class="search-start-icon">' + NT.icon("search", "icon-lg") + "</span>" +
        "<h2>No matches</h2><p>Try a different topic, university or course code.</p>" +
        '<a class="link-arrow" href="' + NT.base() + 'library.html">Browse the video library ' + NT.icon("arrow-right", "icon-sm") + "</a></div>";
      NT.initReveal();
    }

    function section(title, count, rows) {
      return '<section class="search-result-section"><div class="search-section-heading"><h2>' + title + "</h2><span>" + count + "</span></div>" +
        rows.join("") + "</section>";
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        kind = tab.dataset.searchKind;
        render();
      });
    });
    input.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(render, 180);
    });

    NT.content.load().then(render, function () {
      results.innerHTML = NT.offlinePanel("retrySearch");
      var retry = document.getElementById("retrySearch");
      if (retry) retry.addEventListener("click", function () { location.reload(); });
    });
  }

  /* ============================ PROFILE ============================ */
  function pageProfile() {
    var form = document.getElementById("profileForm");
    var nameField = document.getElementById("profileName");
    var levelField = document.getElementById("profileEducationLevel");
    var universityField = document.getElementById("profileUniversity");
    var semesterField = document.getElementById("profileSemester");
    var message = document.getElementById("profileSaveMessage");
    var summaryHost = document.getElementById("profileSummary");
    if (!form) return;

    var saved = Object.assign({ name: "", educationLevel: "", universityId: "", semester: 0 }, NT.store.get().profile || {});
    levelField.innerHTML = '<option value="">Choose a level</option>' + D.EDUCATION_LEVELS.map(function (item) {
      return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.label) + "</option>";
    }).join("");
    semesterField.innerHTML = '<option value="0">No semester selected</option>' +
      NT.content.SEMESTERS.map(function (item) {
        return '<option value="' + item.id + '">' + item.label + "</option>";
      }).join("");
    nameField.value = saved.name || "";
    levelField.value = saved.educationLevel || "";
    semesterField.value = saved.semester ? String(saved.semester) : "0";

    function renderUniversityOptions() {
      var level = levelField.value;
      var institutions = level === "high-school" ? NT.content.schools() : NT.content.universities();
      if (!level) institutions = NT.content.universities().concat(NT.content.schools());
      universityField.innerHTML = '<option value="">No university selected</option>' + institutions.map(function (item) {
        return '<option value="' + NT.esc(item.id) + '">' + NT.esc(item.name) + "</option>";
      }).join("");
      if (saved.universityId && institutions.some(function (item) { return item.id === saved.universityId; })) {
        universityField.value = saved.universityId;
      }
    }

    function renderSummary() {
      var state = NT.store.get();
      var access = state.access;
      var university = state.profile.universityId ? NT.content.university(state.profile.universityId) : null;
      summaryHost.innerHTML =
        '<div class="profile-summary-identity"><span class="profile-avatar">' + NT.icon("circle-user", "icon-lg") + "</span><div>" +
        "<small>Learning profile · this device</small><b>" + NT.esc(state.profile.name || "Learner") + "</b>" +
        "<span>" + NT.esc(university ? university.name : "No university selected") +
        (state.profile.semester ? " · " + NT.esc(NT.semesterLabel(state.profile.semester)) : "") + "</span></div></div>" +
        '<div class="profile-summary-details">' +
        "<span><small>Study level</small><b>" + NT.esc((NT.educationLevel(state.profile.educationLevel) || {}).label || "Not selected") + "</b></span>" +
        "<span><small>Access package</small><b>" + (access ? NT.esc(NT.packageDetails(access).name) + " · active" : "No active package") + "</b></span>" +
        "<span><small>Lessons watched</small><b>" + NT.progress.count() + "</b></span>" +
        "<span><small>Lessons included</small><b>" + (access ? NT.availableFor(access) : 0) + "</b></span>" +
        "</div>";
      var params = new URLSearchParams();
      if (state.profile.universityId) params.set("university", state.profile.universityId);
      if (state.profile.semester) params.set("semester", state.profile.semester);
      if (state.profile.educationLevel && !state.profile.universityId) params.set("level", state.profile.educationLevel);
      document.getElementById("profileBrowseCourses").href = NT.base() + "courses.html" + (params.toString() ? "?" + params.toString() : "");
    }

    NT.content.load().then(function () {
      renderUniversityOptions();
      if (NT.store.isActive()) NT.progress.load().then(renderSummary, renderSummary);
      else renderSummary();
    }, renderSummary);

    levelField.addEventListener("change", function () {
      saved.universityId = "";
      renderUniversityOptions();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var profile = NT.store.setProfile({
        name: nameField.value.trim().slice(0, 60),
        educationLevel: levelField.value,
        universityId: universityField.value,
        semester: parseInt(semesterField.value, 10) || 0
      });
      saved = profile;
      message.innerHTML = NT.icon("check-circle", "icon-sm") + " Preferences saved on this device.";
      renderSummary();
      NT.toast("Learning preferences saved", "success");
    });
  }

  /* ============================ PRICING ============================ */
  function pagePricing() {
    var grid = document.getElementById("pricingGrid");
    var root = document.getElementById("pricingRoot");
    if (!grid) return;
    loadFor(root || grid, function () {
      var state = NT.store.get();
      var total = NT.counts().total;
      grid.innerHTML = D.LEVELS.map(function (level) {
        var details = NT.packageDetails(level);
        var current = state.access === level;
        var features = details.features.map(function (feature) {
          return "<li>" + NT.icon("check") + "<span>" + NT.esc(feature) + "</span></li>";
        }).join("");
        return '<article class="price-card price-' + level + ' reveal">' +
          '<span class="price-name t-' + level + '">' + NT.esc(details.name) + "</span>" +
          '<div class="price-amount"><b>' + NT.kwacha(details.price) + "</b><span>/ " + NT.accessDays() + " days</span></div>" +
          '<div class="price-unlocks"><b>' + NT.availableFor(level) + "</b><span>of " + total + " published lessons included</span></div>" +
          '<ul class="price-feats">' + features + "</ul>" +
          (current
            ? '<button class="btn btn-secondary btn-block" type="button" disabled>' + NT.icon("check-circle") + "Current package</button>"
            : '<a class="btn btn-primary btn-block" href="' + NT.base() + "checkout.html?pkg=" + encodeURIComponent(level) + '">' +
              "Choose " + NT.esc(details.name) + "</a>") +
          "</article>";
      }).join("");
      NT.initReveal();
    }, { count: 3 });
  }

  /* ============================ CHECKOUT (access code preview) ============================ */
  function pageCheckout() {
    var root = document.getElementById("checkoutRoot");
    if (!root) return;
    var pkg = NT.qs("pkg");
    loadFor(root, function () {
      var pack = D.PACKAGES[pkg] ? NT.packageDetails(pkg) : null;
      if (!pack) {
        root.innerHTML = NT.empty({
          icon: "layers",
          title: "Choose a package first",
          message: "Pick the package you want from the access packages page.",
          action: '<a class="btn btn-primary" href="' + NT.base() + 'pricing.html">View packages</a>'
        });
        return;
      }
      root.innerHTML = '<div class="card card-pad checkout-preview-card">' +
        '<span class="eyebrow">Access code</span><h2>' + NT.esc(pack.name) + " package</h2>" +
        '<div class="checkout-summary">' +
        "<div><span>Price</span><b>" + NT.kwacha(pack.price) + "</b></div>" +
        "<div><span>Access period</span><b>" + NT.accessDays() + " days</b></div>" +
        "<div><span>Lessons included</span><b>" + NT.availableFor(pkg) + " of " + NT.counts().total + "</b></div></div>" +
        '<p class="muted">This build issues an access code directly, without a payment provider. ' +
        "The code is stored on the server, so it can be used on any device, once.</p>" +
        '<button class="btn btn-primary btn-lg" type="button" id="generateCode">' + NT.icon("key") + "Generate access code</button>" +
        '<div id="checkoutResult" class="checkout-result hidden" aria-live="polite"></div>' +
        '<a class="link-arrow checkout-back" href="' + NT.base() + 'pricing.html">Back to access packages ' + NT.icon("arrow-right", "icon-sm") + "</a></div>";

      document.getElementById("generateCode").addEventListener("click", function (event) {
        var button = event.currentTarget;
        button.disabled = true;
        NT.api.issueCode(pkg).then(function (payload) {
          var code = payload.code;
          var result = document.getElementById("checkoutResult");
          result.classList.remove("hidden");
          result.innerHTML = "<p>Keep this code safe. It can be redeemed once, on any device.</p>" +
            '<code class="preview-code">' + NT.esc(code) + "</code>" +
            '<div class="lesson-notice-actions"><button class="btn btn-secondary" type="button" id="copyPreviewCode">' +
            NT.icon("copy") + "Copy code</button>" +
            '<a class="btn btn-primary" href="' + NT.base() + "access.html?code=" + encodeURIComponent(code) + '">Continue to log in</a></div>';
          button.textContent = "Code generated";
          document.getElementById("copyPreviewCode").addEventListener("click", function () { NT.copy(code); });
        }, function (error) {
          button.disabled = false;
          NT.toast(error.status === 0 ? "The content service is unreachable" : error.message, "error");
        });
      });
    });
  }

  /* ============================ ACCESS CODE LOGIN ============================ */
  function pageAccess() {
    var form = document.getElementById("codeForm");
    var input = document.getElementById("codeInput");
    var message = document.getElementById("codeMsg");
    var result = document.getElementById("codeResult");
    if (!form) return;
    var radios = Array.prototype.slice.call(form.querySelectorAll('input[name="educationLevel"]'));
    var profile = NT.store.get().profile || {};
    var queryLevel = NT.qs("level");
    var selectedLevel = D.EDUCATION_LEVELS.some(function (item) { return item.id === queryLevel; })
      ? queryLevel
      : profile.educationLevel;
    radios.forEach(function (radio) { radio.checked = radio.value === selectedLevel; });
    var codeFromLink = NT.qs("code");
    if (codeFromLink) input.value = codeFromLink.toUpperCase();

    function renderCurrent() {
      var state = NT.store.get();
      var host = document.getElementById("currentAccess");
      if (!state.access) { host.classList.add("hidden"); return; }
      host.classList.remove("hidden");
      var meta = state.accessMeta || {};
      document.getElementById("currentAccessBody").innerHTML =
        '<div class="kv">' +
        '<div class="row"><span>Active package</span><b>' + NT.esc(NT.packageDetails(state.access).name) + "</b></div>" +
        '<div class="row"><span>Access code</span><b class="mono">' + NT.esc(meta.code || "") + "</b></div>" +
        '<div class="row"><span>Expires</span><b>' + NT.esc(meta.expiresAt ? NT.fmtDate(meta.expiresAt) : "—") + "</b></div>" +
        "</div>" +
        '<div class="access-current-actions">' +
        '<a class="btn btn-primary btn-sm" href="' + NT.base() + 'dashboard.html">' + NT.icon("layout-dashboard") + "Go to dashboard</a>" +
        '<button class="btn btn-ghost btn-sm" type="button" id="accessLogout">' + NT.icon("log-out") + "Log out of this device</button>" +
        "</div>";
      var logout = document.getElementById("accessLogout");
      if (logout) logout.addEventListener("click", function () {
        NT.store.clearAccess();
        NT.toast("Logged out of this device", "success");
        location.reload();
      });
    }
    renderCurrent();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value.trim().toUpperCase();
      var choice = radios.filter(function (radio) { return radio.checked; })[0];
      message.innerHTML = "";
      result.classList.add("hidden");

      if (!choice) {
        message.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") +
          "<div><b>Choose your level.</b><br>Select High School or University before continuing.</div></div>";
        radios[0].focus();
        return;
      }
      if (!value) {
        message.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") +
          "<div><b>Enter your access code.</b><br>Use the code issued with your package.</div></div>";
        input.focus();
        return;
      }

      var submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      NT.api.redeem(value, choice.value).then(function (payload) {
        submit.disabled = false;
        var access = payload.access;
        NT.store.setAccess(access.package, {
          code: access.code,
          since: access.since,
          expiresAt: access.expiresAt,
          educationLevel: access.educationLevel
        });
        NT.store.setProfile({ educationLevel: access.educationLevel });
        var levelInfo = NT.educationLevel(access.educationLevel);
        result.classList.remove("hidden");
        result.innerHTML = '<div class="unlock-result"><div class="big-ico">' + NT.icon("check-circle", "icon-xl") + "</div>" +
          "<h2>You are in</h2>" +
          '<p class="access-line">' + NT.esc(levelInfo ? levelInfo.label : "Your level") + " pathway · " +
          NT.esc(NT.packageDetails(access.package).name) + " package · until " + NT.fmtDate(access.expiresAt) + "</p>" +
          '<a class="btn btn-primary btn-lg" href="' + NT.base() + "courses.html?level=" + encodeURIComponent(access.educationLevel) +
          "&semester=1\">" + NT.icon("play") + "Continue to your courses</a></div>";
        form.classList.add("hidden");
        document.querySelector(".access-packages-link").classList.add("hidden");
        NT.toast("Access code redeemed", "success");
        renderCurrent();
      }, function (error) {
        submit.disabled = false;
        var text = error.status === 0
          ? "The content service is unreachable. Start the Nuclear Tutorials server and try again."
          : error.message;
        message.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div><b>That code could not be redeemed.</b><br>" +
          NT.esc(text) + "</div></div>";
        input.focus();
      });
    });
  }

  /* ============================ ANNOUNCEMENTS ============================ */
  function pageAnnouncements() {
    var root = document.getElementById("announcementsRoot");
    if (!root) return;
    root.innerHTML = '<div class="skeleton-grid">' + NT.skeletonCards(2) + "</div>";
    NT.api.get("/api/announcements").then(function (payload) {
      var items = payload.announcements || [];
      if (!items.length) {
        root.innerHTML = NT.empty({
          icon: "bell",
          title: "No announcements yet",
          message: "Platform and course updates published by the administrator will appear here.",
          action: '<a class="btn btn-secondary" href="' + NT.base() + 'courses.html">Browse courses</a>'
        });
        return;
      }
      root.innerHTML = '<div class="announcement-list">' + items.map(function (notice) {
        return '<article class="announcement-item reveal"><div class="announcement-item-date">' +
          NT.icon("bell", "icon-sm") + NT.fmtDate(notice.updatedAt || notice.createdAt) + "</div>" +
          '<div class="announcement-item-body"><h2>' + NT.esc(notice.title) + "</h2><p>" +
          NT.esc(notice.body || "").replace(/\n/g, "<br>") + "</p></div></article>";
      }).join("") + "</div>";
      NT.initReveal();
    }, function () {
      root.innerHTML = NT.offlinePanel("retryAnnouncements");
      var retry = document.getElementById("retryAnnouncements");
      if (retry) retry.addEventListener("click", function () { location.reload(); });
    });
  }

  /* ============================ router ============================ */
  var routes = {
    home: pageHome,
    courses: pageCourses,
    course: pageCourse,
    lesson: pageLesson,
    library: pageLibrary,
    dashboard: pageDashboard,
    search: pageSearch,
    profile: pageProfile,
    pricing: pagePricing,
    checkout: pageCheckout,
    access: pageAccess,
    announcements: pageAnnouncements
  };

  document.addEventListener("DOMContentLoaded", function () {
    NT.renderHeader();
    NT.renderFooter();
    var page = document.body.dataset.page;
    if (routes[page]) routes[page]();
    NT.initReveal();
  });
})();
