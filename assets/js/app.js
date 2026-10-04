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
      var p = D.PACKAGES[id];
      var price = NT.packagePrice(id);
      var feats = p.features.map(function (f) {
        return "<li>" + NT.icon("check") + "<span>" + f + "</span></li>";
      }).join("");
      var current = s.access === id;
      return '<div class="card card-hover price-card' + (p.popular ? " popular" : "") + '">' +
        (p.popular ? '<span class="popular-tag">Most Popular</span>' : "") +
        '<span class="price-name t-' + id + '">' + p.name + "</span>" +
        '<div class="price-amount"><b>' + NT.kwacha(price) + '</b><span>/ ' + s.settings.days + ' days</span></div>' +
        '<p class="price-desc">' + p.tagline + "</p>" +
        '<ul class="price-feats">' + feats + "</ul>" +
        (current
          ? '<button class="btn btn-secondary btn-block" disabled>' + NT.icon("check-circle") + "Current package</button>"
          : '<a class="btn ' + (p.popular ? "btn-primary" : "btn-secondary") + ' btn-block" href="' + NT.base() + 'checkout.html?pkg=' + id + '">' + NT.icon("arrow-right") + "Get Access</a>") +
        "</div>";
    }).join("");
  };

  function courseProgress(course) {
    var s = NT.store.get();
    if (!s.access) return null;
    var ls = NT.courseLessons(course.id);
    var unlocked = ls.filter(function (l) { return NT.isUnlocked(l); });
    if (!unlocked.length) return null;
    var done = unlocked.filter(function (l) { return NT.store.isComplete(l.id); }).length;
    return { done: done, total: unlocked.length, pct: Math.round((done / unlocked.length) * 100) };
  }

  NT.renderCourseCard = function (course) {
    var ls = NT.courseLessons(course.id);
    var counts = { basic: 0, standard: 0, premium: 0 };
    ls.forEach(function (l) { counts[NT.levelOf(l)]++; });
    var prog = courseProgress(course);
    return '<article class="card card-hover course-card" style="--tint:' + course.tint + ";--tint-fg:" + course.tintFg + '">' +
      '<div class="row-between"><div class="course-icon">' + NT.icon(course.icon) + "</div>" +
      '<div class="tier-dots" title="Lessons by access level">' +
      '<span class="tier-dot b" title="' + counts.basic + ' Basic lessons">B ' + counts.basic + "</span>" +
      '<span class="tier-dot s" title="' + counts.standard + ' Standard lessons">S ' + counts.standard + "</span>" +
      '<span class="tier-dot p" title="' + counts.premium + ' Premium lessons">P ' + counts.premium + "</span></div></div>" +
      "<h3>" + course.title + "</h3>" +
      '<p class="desc">' + course.desc + "</p>" +
      '<div class="course-meta"><span>' + NT.icon("play-circle", "icon-sm") + ls.length + " lessons</span>" +
      "<span>" + NT.icon("clock", "icon-sm") + "Video tutorials</span></div>" +
      (prog ? '<div class="progress-row"><div class="progress"><i style="width:' + prog.pct + '%"></i></div><span>' + prog.pct + "%</span></div>" : "") +
      '<div class="course-foot"><a class="link-arrow" href="' + NT.base() + "library.html?course=" + course.id + '">View lessons ' + NT.icon("arrow-right", "icon-sm") + "</a>" +
      '<a class="link-arrow muted" href="' + NT.base() + "courses.html#" + course.id + '">Details</a></div>' +
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
    document.getElementById("statLevels").textContent = D.LEVELS.length;
    document.getElementById("courseGrid").innerHTML = D.COURSES.map(NT.renderCourseCard).join("");
    NT.renderPricingCards(document.getElementById("pricingGrid"));
  }

  /* ============================ COURSES ============================ */
  function pageCourses() {
    var wrap = document.getElementById("courseList");
    wrap.innerHTML = D.COURSES.map(function (c) {
      var ls = NT.courseLessons(c.id);
      var prog = courseProgress(c);
      var rows = ls.map(function (l) {
        var unlocked = NT.isUnlocked(l);
        var done = NT.store.isComplete(l.id);
        return '<div class="list-row">' +
          '<span class="mono tiny muted" style="width:20px;text-align:right">' + l.index + "</span>" +
          '<div class="lico" style="width:34px;height:34px;background:' + c.tint + ";color:" + c.tintFg + '">' +
          NT.icon(unlocked ? (done ? "circle-check" : "play") : "lock", "icon-sm") + "</div>" +
          '<div class="grow"><b>' + l.title + '</b><small>' + l.duration + " min watch</small></div>" +
          NT.levelBadge(NT.levelOf(l), !unlocked) +
          (unlocked ? '<a class="btn btn-sm btn-ghost" href="' + NT.base() + "lesson.html?id=" + l.id + '">' + NT.icon("play", "icon-sm") + "Watch</a>" : "") +
          "</div>";
      }).join("");
      return '<section class="card course-detail" id="' + c.id + '" style="scroll-margin-top:90px">' +
        '<div class="course-detail-head" style="--tint:' + c.tint + ";--tint-fg:" + c.tintFg + '">' +
        '<div class="course-icon">' + NT.icon(c.icon) + "</div>" +
        '<div class="grow"><h3>' + c.title + '</h3><p class="muted small">' + c.desc + "</p></div>" +
        '<div class="tier-dots"><span class="tier-dot b">Basic</span><span class="tier-dot s">Standard</span><span class="tier-dot p">Premium</span></div>' +
        "</div>" +
        (prog ? '<div class="progress-row" style="padding:0 24px"><span style="white-space:nowrap">' + prog.done + "/" + prog.total + " unlocked lessons completed</span><div class=\"progress\"><i style=\"width:" + prog.pct + '%"></i></div><span>' + prog.pct + "%</span></div>" : "") +
        '<div class="list-rows" style="padding:10px 20px 18px">' + rows + "</div>" +
        '<div class="course-detail-foot"><a class="btn btn-secondary btn-sm" href="' + NT.base() + "library.html?course=" + c.id + '">' + NT.icon("library", "icon-sm") + "Open in library</a>" +
        '<a class="btn btn-ghost btn-sm" href="' + NT.base() + 'pricing.html">Compare packages</a></div>' +
        "</section>";
    }).join("");
  }

  /* ============================ PRICING ============================ */
  function pagePricing() {
    NT.renderPricingCards(document.getElementById("pricingGrid"));
    var yes = '<span class="yes">' + NT.icon("check") + "</span>";
    var no = '<span class="no">' + NT.icon("lock", "icon-sm") + "</span>";
    var rows = [
      ["Basic lessons in every course", yes, yes, yes],
      ["Standard lessons in every course", no, yes, yes],
      ["Premium advanced lessons", no, no, yes],
      ["Access code issued on payment", yes, yes, yes],
      ["Progress tracking", no, yes, yes],
      ["Full video library", no, no, yes],
      ["New videos as they are released", no, no, yes],
      ["Access duration", "30 days", "30 days", "30 days"]
    ];
    document.getElementById("cmpBody").innerHTML = rows.map(function (r) {
      return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td><td>" + r[3] + "</td></tr>";
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
        '<div class="row"><span>Active package</span><b>' + D.LEVEL_LABEL[s.access] + "</b></div>" +
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
        '<p class="videos-line"><b>' + avail + " of " + total + "</b> videos are now available.</p>" +
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
          "<span>" + D.LEVEL_LABEL[lv] + " lessons <span class='muted'>(" + n + " videos)</span></span></li>";
      }).join("");
    }

    function renderPersonas() {
      var cur = NT.store.get().access;
      var isPersona = NT.store.get().accessMeta && NT.store.get().accessMeta.source === "persona";
      document.getElementById("personaGrid").innerHTML = D.LEVELS.map(function (lv) {
        var viewing = isPersona && cur === lv;
        return '<div class="card persona-card' + (viewing ? " active-view" : "") + '">' +
          (viewing ? '<span class="viewing-tag">Viewing now</span>' : "") +
          '<div class="persona-head"><h3>' + D.LEVEL_LABEL[lv] + " Student</h3>" +
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
          return '<td class="' + (ok ? "yes" : "no") + '">' + NT.icon(ok ? "check-circle" : "lock", "icon-sm") + "</td>";
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
          ? '<a class="btn btn-primary btn-sm" href="' + NT.base() + "lesson.html?id=" + l.id + '">' + NT.icon("play", "icon-sm") + "Watch Now</a>"
          : '<a class="btn btn-secondary btn-sm" href="' + NT.base() + 'pricing.html">' + NT.icon("lock", "icon-sm") + "Upgrade your access</a>") +
        '<span class="tiny muted">' + (unlocked ? "Included" : "Not in your package") + "</span>" +
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

  /* ============================ DASHBOARD ============================ */
  function pageDashboard() {
    var s = NT.store.get();
    var root = document.getElementById("dashRoot");

    if (!s.access) {
      root.innerHTML = '<div class="card gate">' +
        '<div class="big-ico">' + NT.icon("lock", "icon-xl") + "</div>" +
        "<h2>No active access yet</h2>" +
        "<p>Your dashboard appears here once a package is active. Choose a package and simulate payment, or redeem an access code you already have.</p>" +
        '<div class="btns"><a class="btn btn-primary" href="' + NT.base() + 'pricing.html">' + NT.icon("banknote") + "View packages</a>" +
        '<a class="btn btn-secondary" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Redeem access code</a></div></div>";
      return;
    }

    var all = NT.allLessons();
    var unlocked = all.filter(function (l) { return NT.isUnlocked(l); });
    var completed = unlocked.filter(function (l) { return NT.store.isComplete(l.id); });
    var pct = unlocked.length ? Math.round((completed.length / unlocked.length) * 100) : 0;
    var meta = s.accessMeta || {};
    var since = meta.since ? new Date(meta.since) : new Date();
    var expires = new Date(since.getTime() + s.settings.days * 86400000);

    /* continue learning: first unlocked, incomplete lesson */
    var next = unlocked.filter(function (l) { return !NT.store.isComplete(l.id); })[0] || unlocked[0];
    var nextCourse = next ? NT.course(next.courseId) : null;

    var continueHtml = next
      ? '<div class="card continue-card">' +
        '<div class="thumb" style="--thumb-bg:' + nextCourse.thumb + '">' + NT.thumbArt(nextCourse) +
        '<span class="thumb-icon">' + NT.icon(nextCourse.icon) + "</span>" +
        '<span class="dur">' + next.duration + "</span></div>" +
        '<div class="continue-body">' +
        '<span class="eyebrow">Continue Learning</span>' +
        "<h3>" + next.title + '</h3><p class="muted small">' + next.courseTitle + " · " + D.LEVEL_LABEL[NT.levelOf(next)] + " lesson · " + next.duration + "</p>" +
        '<div class="progress-row"><div class="progress"><i style="width:' + pct + '%"></i></div><span>' + pct + "% of your unlocked videos completed</span></div>" +
        '<div><a class="btn btn-primary" href="' + NT.base() + "lesson.html?id=" + next.id + '">' + NT.icon("play") + (completed.length ? "Continue lesson" : "Start watching") + "</a></div>" +
        "</div></div>"
      : "";

    var myCourses = D.COURSES.map(function (c) {
      var ls = NT.courseLessons(c.id);
      var un = ls.filter(function (l) { return NT.isUnlocked(l); });
      var done = un.filter(function (l) { return NT.store.isComplete(l.id); }).length;
      var p = un.length ? Math.round((done / un.length) * 100) : 0;
      return '<div class="list-row"><div class="lico" style="background:' + c.tint + ";color:" + c.tintFg + '">' + NT.icon(c.icon) + "</div>" +
        '<div class="grow"><b>' + c.title + '</b><small>' + done + " of " + un.length + " available lessons completed</small>" +
        '<div class="progress" style="margin-top:6px"><i style="width:' + p + '%"></i></div></div>' +
        '<span class="tiny muted">' + p + "%</span></div>";
    }).join("");

    var recent = s.completed.slice().reverse().map(NT.lesson).filter(Boolean).slice(0, 4);
    var recentHtml = recent.length
      ? recent.map(function (l) { return lessonRow(l, true); }).join("")
      : '<div class="list-row"><div class="lico">' + NT.icon("play-circle") + '</div><div class="grow"><b>No completed lessons yet</b><small>Finish your first video to see it here.</small></div></div>';

    var lockedList = all.filter(function (l) { return !NT.isUnlocked(l); }).slice(0, 5);
    var lockedHtml = lockedList.length
      ? lockedList.map(function (l) { return lessonRow(l, true); }).join("") +
        '<div style="padding:14px 4px 4px"><a class="btn btn-secondary btn-sm" href="' + NT.base() + 'pricing.html">' + NT.icon("zap", "icon-sm") + "Upgrade to unlock " + (all.length - unlocked.length) + " more videos</a></div>"
      : '<div class="list-row"><div class="lico">' + NT.icon("sparkles") + '</div><div class="grow"><b>Nothing locked</b><small>Premium unlocks the entire library.</small></div></div>';

    root.innerHTML =
      '<div class="dash-head"><div>' +
      '<span class="eyebrow">Student dashboard</span>' +
      "<h1 style=\"margin-top:10px\">Welcome back</h1>" +
      '<p class="muted" style="margin-top:8px">Here is your learning overview for this demo session.</p></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<span class="badge badge-' + s.access + '" style="font-size:13px;padding:6px 14px">' + NT.icon("award") + D.LEVEL_LABEL[s.access] + " package</span>" +
      '<span class="badge badge-success" style="font-size:13px;padding:6px 14px">' + NT.icon("badge-check") + "Access status: Active</span>" +
      "</div></div>" +

      '<div class="grid grid-4" style="margin-bottom:24px">' +
      '<div class="card stat-card"><span class="lab">' + NT.icon("book-open") + "Courses available</span><span class=\"val\">" + D.COURSES.length + '</span><span class="sub">All subjects included</span></div>' +
      '<div class="card stat-card"><span class="lab">' + NT.icon("library") + "Videos available</span><span class=\"val\">" + unlocked.length + '<span class="muted" style="font-size:15px;font-weight:600"> / ' + all.length + '</span></span><span class="sub">With ' + D.LEVEL_LABEL[s.access] + " access</span></div>" +
      '<div class="card stat-card"><span class="lab">' + NT.icon("circle-check") + "Videos completed</span><span class=\"val\">" + completed.length + '</span><span class="sub">Keep the streak going</span></div>' +
      '<div class="card stat-card"><span class="lab">' + NT.icon("trending-up") + "Learning progress</span><span class=\"val\">" + pct + '%</span><div class="progress" style="margin-top:6px"><i style="width:' + pct + '%"></i></div></div>' +
      "</div>" +

      continueHtml +

      '<div class="split" style="margin-top:24px">' +
      '<div class="stack">' +
      '<div class="card"><div class="adm-card-head" style="padding:15px 20px"><h3>My Courses</h3><a class="link-arrow small" href="' + NT.base() + 'courses.html">All courses ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
      '<div class="list-rows" style="padding:8px 20px 16px">' + myCourses + "</div></div>" +
      '<div class="card"><div class="adm-card-head" style="padding:15px 20px"><h3>Recent Lessons</h3><a class="link-arrow small" href="' + NT.base() + 'library.html">Library ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
      '<div class="list-rows" style="padding:8px 20px 16px">' + recentHtml + "</div></div>" +
      "</div>" +
      '<div class="stack">' +
      '<div class="card"><div class="adm-card-head" style="padding:15px 20px"><h3>Locked Content</h3><span class="badge badge-outline">' + (all.length - unlocked.length) + " locked</span></div>" +
      '<div class="list-rows" style="padding:8px 20px 16px">' + lockedHtml + "</div></div>" +
      '<div class="card"><div class="adm-card-head" style="padding:15px 20px"><h3>Access Information</h3>' + NT.icon("shield-check") + "</div>" +
      '<div style="padding:8px 20px 18px"><div class="kv">' +
      '<div class="row"><span>Package</span><b>' + D.LEVEL_LABEL[s.access] + " · " + NT.kwacha(NT.packagePrice(s.access)) + "</b></div>" +
      '<div class="row"><span>Status</span><b><span class="badge badge-success">Active</span></b></div>' +
      '<div class="row"><span>Access code</span><b class="mono">' + NT.esc(meta.code || "—") + "</b></div>" +
      '<div class="row"><span>Obtained via</span><b>' + NT.esc(meta.method || (meta.source === "code" ? "Access code" : meta.source === "persona" ? "Demo viewer" : "Demo checkout")) + "</b></div>" +
      '<div class="row"><span>Activated</span><b>' + NT.fmtDate(since.toISOString()) + "</b></div>" +
      '<div class="row"><span>Expires</span><b>' + NT.fmtDate(expires.toISOString()) + " (" + s.settings.days + " days)</b></div>" +
      '<div class="row"><span>Videos unlocked</span><b>' + unlocked.length + " of " + all.length + "</b></div>" +
      "</div></div></div>" +
      "</div></div>";
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
        '<div class="card"><div class="adm-card-head"><h3>About this lesson</h3>' + NT.levelBadge(NT.levelOf(lesson), true) + "</div>" +
        '<div class="adm-card-body"><p class="muted small">' + NT.esc(lesson.description) + "</p>" +
        '<div class="kv" style="margin-top:14px"><div class="row"><span>Course</span><b>' + course.title + "</b></div>" +
        '<div class="row"><span>Duration</span><b>' + lesson.duration + "</b></div>" +
        '<div class="row"><span>Lesson</span><b>' + lesson.index + " of " + lessons.length + "</b></div></div></div></div>" +
        '<div class="card"><div class="adm-card-head"><h3>In this course</h3></div><div class="side-list">' + sideList + "</div></div>" +
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

      '<div class="card card-pad" style="margin-top:22px">' +
      '<div class="row-between"><div>' +
      '<span class="lesson-course">' + NT.esc(course.title) + ' · Lesson ' + lesson.index + " of " + lessons.length + "</span>" +
      "<h2 style=\"margin:8px 0 6px;font-size:1.5rem\">" + NT.esc(lesson.title) + "</h2>" +
      '<div class="lesson-meta"><span>' + NT.icon("clock", "icon-sm") + lesson.duration + "</span>" +
      NT.levelBadge(NT.levelOf(lesson), false) +
      '<span id="doneBadge"></span></div></div>' +
      '<button class="btn btn-secondary" id="markDone">' + NT.icon("circle-check") + "Mark as complete</button></div>" +
      '<p class="muted" style="margin-top:14px;font-size:14.5px;line-height:1.7">' + NT.esc(lesson.description) + "</p>" +
      '<div class="progress-row" style="margin-top:18px"><span style="white-space:nowrap">Course progress</span><div class="progress"><i id="courseProg" style="width:' + coursePct + '%"></i></div><span id="coursePct">' + coursePct + "%</span></div>" +
      '<div class="row-between" style="margin-top:20px;padding-top:18px;border-top:1px solid var(--line)">' +
      (prev ? '<a class="btn btn-secondary btn-sm" href="' + NT.base() + "lesson.html?id=" + prev.id + '">' + NT.icon("arrow-left", "icon-sm") + "Previous lesson</a>" : '<span class="tiny muted">First lesson in course</span>') +
      (nextL ? '<a class="btn btn-primary btn-sm" href="' + NT.base() + "lesson.html?id=" + nextL.id + '">Next lesson ' + NT.icon("arrow-right", "icon-sm") + "</a>" : '<span class="tiny muted">Final lesson in course</span>') +
      "</div></div>" +
      "</div>" +

      '<aside class="lesson-side">' +
      '<div class="card"><div class="adm-card-head"><h3>Course contents</h3><span class="badge badge-outline">' + courseDone + "/" + courseUnlocked + " done</span></div>" +
      '<div class="side-list">' + sideList + "</div></div>" +
      '<div class="card"><div class="adm-card-head"><h3>Related lessons</h3></div>' +
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
      st.playing = !st.playing;
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
      var p = D.PACKAGES[pkg];
      root.innerHTML =
        '<div class="split-aside">' +
        '<div class="card card-pad">' +
        '<span class="eyebrow">Demo Checkout</span>' +
        "<h2 style=\"margin:10px 0 8px\">Simulated payment</h2>" +
        '<p class="muted small" style="margin-bottom:22px">Simulated payment. No money moves and no real account is contacted. Fields below are visual only.</p>' +

        '<div class="field" style="margin-bottom:20px"><label>1 · Choose your package</label>' +
        '<div class="method-grid method-grid-3">' +
        D.LEVELS.map(function (lv) {
          return '<button type="button" class="method-card' + (pkg === lv ? " selected" : "") + '" data-pkg="' + lv + '" style="flex-direction:column;align-items:flex-start;gap:2px">' +
            "<b>" + D.PACKAGES[lv].name + '</b><small>' + NT.kwacha(NT.packagePrice(lv)) + " · " + NT.availableFor(lv) + " videos</small>" +
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
        '<div class="row"><span>Package</span><b>' + p.name + "</b></div>" +
        '<div class="row"><span>Access duration</span><b>' + NT.store.get().settings.days + " days</b></div>" +
        '<div class="row"><span>Videos unlocked</span><b>' + NT.availableFor(pkg) + " of " + NT.counts().total + "</b></div>" +
        '<div class="row"><span>Amount</span><b style="font-size:18px">' + NT.kwacha(price()) + "</b></div>" +
        "</div>" +
        '<ul class="price-feats" style="margin-bottom:18px">' + p.features.map(function (f) { return "<li>" + NT.icon("check") + "<span>" + f + "</span></li>"; }).join("") + "</ul>" +
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
          '<div class="stack" style="gap:14px"><div class="field"><label>Card number</label>' +
          '<input class="input mono" inputmode="numeric" placeholder="4242 4242 4242 4242" maxlength="19" value="4242 4242 4242 4242">' +
          '<span class="field-hint">Visual only — never sent anywhere.</span></div>' +
          '<div class="input-row"><div class="field"><label>Expiry</label><input class="input mono" placeholder="MM/YY" value="12/28"></div>' +
          '<div class="field"><label>CVC</label><input class="input mono" placeholder="123" value="123" maxlength="4"></div></div></div>';
      } else {
        var m = D.METHODS.filter(function (x) { return x.id === method; })[0];
        box.innerHTML =
          '<div class="field"><label>' + m.name + ' number</label>' +
          '<input class="input mono" inputmode="tel" placeholder="097X XXX XXX" value="0977 000 000">' +
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
        '<p class="videos-line" style="margin-top:10px">Your ' + D.LEVEL_LABEL[pkg] + " access is active — <b>" + NT.availableFor(pkg) + " of " + NT.counts().total + "</b> videos are now available.</p>" +
        '<div class="receipt">' +
        '<div class="rrow"><span>Package purchased</span><b>' + D.LEVEL_LABEL[pkg] + " · " + NT.kwacha(price()) + "</b></div>" +
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
    control: pageControl, library: pageLibrary, dashboard: pageDashboard,
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
