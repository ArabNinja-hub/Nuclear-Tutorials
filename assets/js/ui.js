/* ============================================================
   NUCLEAR TUTORIALS — Shared UI

   Header and navigation, footer, dialogs and toasts, plus the
   components every page builds from: course cards, video cards,
   semester switches, progress bars and empty/loading states.
   ============================================================ */
(function () {
  window.NT = window.NT || {};

  /* ---------- paths ---------- */
  NT.base = function () {
    return location.pathname.indexOf("/admin/") !== -1 ? "../" : "";
  };

  /* ---------- logo ---------- */
  NT.logoImg = function (cls, alt) {
    return '<img class="' + (cls || "brand-logo") + '" src="' + NT.base() + 'assets/img/logo.jpg" ' +
      'alt="' + (alt || "Nuclear Tutorials logo") + '" loading="eager" decoding="async">';
  };

  /* ---------- formatting ---------- */
  NT.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  NT.kwacha = function (n) { return "K" + Number(n).toLocaleString("en-ZM"); };
  NT.fmtDate = function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso || "";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return String(d.getDate()).padStart(2, "0") + " " + months[d.getMonth()] + " " + d.getFullYear();
  };
  NT.fmtRelative = function (iso) {
    var date = new Date(iso);
    if (isNaN(date)) return "";
    var diff = Date.now() - date.getTime();
    var minutes = Math.round(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes + " min ago";
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
    var days = Math.round(hours / 24);
    if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
    return NT.fmtDate(iso);
  };
  NT.qs = function (name) {
    return new URLSearchParams(location.search).get(name);
  };
  NT.cap = function (s) { return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1); };
  NT.plural = function (count, word) {
    return count + " " + word + (Number(count) === 1 ? "" : "s");
  };

  /* ---------- badges ---------- */
  NT.levelBadge = function (level, locked) {
    var cls = "badge badge-" + level;
    var ico = locked === true ? "lock" : (locked === false ? "unlock" : "shield");
    return '<span class="' + cls + '">' + NT.icon(ico) + NT.data.LEVEL_LABEL[level] + "</span>";
  };
  NT.semesterBadge = function (semester) {
    return '<span class="badge badge-semester">' + NT.icon("calendar") + NT.semesterLabel(semester) + "</span>";
  };
  NT.watchedBadge = function (label) {
    return '<span class="badge badge-success">' + NT.icon("check-circle") + NT.esc(label || "Watched") + "</span>";
  };

  /* ---------- navigation ---------- */
  var PUBLIC_NAV = [
    { id: "courses", page: "courses", label: "Courses", href: "courses.html" },
    { id: "library", page: "library", label: "Video library", href: "library.html" },
    { id: "pricing", page: "pricing", label: "Pricing", href: "pricing.html" },
    { id: "how", page: "", label: "How it works", href: "index.html#how-it-works" }
  ];

  function brandHtml(showSub) {
    return '<a class="brand" href="' + NT.base() + 'index.html" aria-label="Nuclear Tutorials — home">' +
      NT.logoImg("brand-logo") +
      '<span class="brand-copy"><span class="brand-name">Nuclear <span>Tutorials</span></span>' +
      (showSub === false ? "" : '<span class="brand-sub">University &amp; High School</span>') + "</span></a>";
  }

  function accountLink(state, cls) {
    if (state.access) {
      return '<a class="btn btn-ghost header-account ' + cls + '" href="' + NT.base() + 'dashboard.html">' +
        '<span class="dot" aria-hidden="true"></span>Dashboard</a>';
    }
    return '<a class="btn btn-ghost header-login ' + cls + '" href="' + NT.base() + 'access.html">Log in</a>';
  }

  NT.renderHeader = function () {
    var page = document.body.dataset.page || "";
    var state = NT.store.get();

    function navIsActive(item) { return item.page && page === item.page; }

    var links = PUBLIC_NAV.map(function (item) {
      return '<a href="' + NT.base() + item.href + '" class="' + (navIsActive(item) ? "active" : "") + '"' +
        (navIsActive(item) ? ' aria-current="page"' : "") + ">" + item.label + "</a>";
    }).join("");

    function sheetLink(href, icon, label, active) {
      return '<a href="' + NT.base() + href + '" class="' + (active ? "active" : "") + '"' +
        (active ? ' aria-current="page"' : "") + ">" + NT.icon(icon) + "<span>" + label + "</span></a>";
    }
    var accountSheetPrimary = state.access
      ? sheetLink("dashboard.html", "layout-dashboard", "Dashboard", page === "dashboard")
      : sheetLink("access.html", "key", "Log in with a code", page === "access");

    var totals = NT.content.data() ? NT.content.totals() : null;
    var statusCard = state.access
      ? "<b>" + NT.esc(NT.packageDetails(state.access).name) + " package active.</b> " +
        NT.percentLabel(NT.availableFor(state.access), totals ? totals.videos : 0) + " of the published lessons are included."
      : "<b>No access code redeemed yet.</b> Choose a package and log in to start learning.";

    var html =
      '<a class="skip-link" href="#main">Skip to main content</a>' +
      '<div class="container header-inner">' +
      brandHtml() +
      '<nav class="nav-links" aria-label="Primary">' + links + "</nav>" +
      '<div class="header-actions">' +
      accountLink(state, "") +
      '<a class="btn-icon header-search-btn" href="' + NT.base() + 'search.html" aria-label="Search lessons">' + NT.icon("search") + "</a>" +
      '<a class="btn btn-primary btn-sm header-access-link" href="' + NT.base() + 'pricing.html">Get access</a>' +
      '<button class="nav-toggle" id="navToggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-haspopup="dialog">' + NT.icon("menu") + "</button>" +
      "</div></div>" +
      '<div class="mobile-sheet" id="mobileSheet" aria-hidden="true" inert>' +
      '<div class="scrim" data-close-sheet></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="Navigation">' +
      '<div class="sheet-head">' + brandHtml(false) +
      '<button class="modal-x" data-close-sheet aria-label="Close navigation">' + NT.icon("x") + "</button></div>" +
      '<nav class="sheet-nav" aria-label="All pages">' +
      '<span class="sheet-label">Learn</span>' +
      sheetLink("courses.html", "graduation-cap", "Courses", page === "courses") +
      sheetLink("library.html", "video", "Video library", page === "library") +
      sheetLink("pricing.html", "layers", "Pricing", page === "pricing") +
      sheetLink("index.html#how-it-works", "target", "How it works", false) +
      '<span class="sheet-label">Your learning</span>' +
      accountSheetPrimary +
      sheetLink("library.html", "book-marked", "My lessons", page === "library") +
      sheetLink("profile.html", "circle-user", "Profile", page === "profile") +
      '<span class="sheet-label">More</span>' +
      sheetLink("announcements.html", "bell", "Announcements", page === "announcements") +
      sheetLink("search.html", "search", "Search", page === "search") +
      "</nav>" +
      '<div class="sheet-foot"><p class="sheet-status">' + NT.icon("info") + "<span>" + statusCard + "</span></p>" +
      "</div></div></div>" +
      '<nav class="mobile-nav" aria-label="Mobile navigation">' +
      '<a href="' + NT.base() + 'courses.html" class="' + (page === "courses" ? "active" : "") + '">' + NT.icon("graduation-cap") + "<span>Courses</span></a>" +
      '<a href="' + NT.base() + 'library.html" class="' + (page === "library" ? "active" : "") + '">' + NT.icon("video") + "<span>Lessons</span></a>" +
      (state.access
        ? '<a href="' + NT.base() + 'dashboard.html" class="' + (page === "dashboard" ? "active" : "") + '">' + NT.icon("layout-dashboard") + "<span>Dashboard</span></a>"
        : '<a href="' + NT.base() + 'access.html" class="' + (page === "access" ? "active" : "") + '">' + NT.icon("key") + "<span>Log in</span></a>") +
      '<button class="mobile-nav-more" id="mobileMore" type="button" aria-label="More navigation" aria-expanded="false" aria-haspopup="dialog">' +
      NT.icon("ellipsis") + "<span>More</span></button></nav>";

    var header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = html;
    document.body.classList.add("has-mobile-nav");
    document.body.prepend(header);

    var main = document.querySelector("main");
    if (!main) main = document.querySelector(".page-head, .section-body, section");
    if (main) {
      if (!main.id) main.id = "main";
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    }

    var sheet = header.querySelector("#mobileSheet");
    var toggle = header.querySelector("#navToggle");
    var more = header.querySelector("#mobileMore");
    var lastTrigger = null;
    function setOpen(open, trigger) {
      if (open) lastTrigger = trigger || toggle || more;
      sheet.classList.toggle("open", open);
      sheet.setAttribute("aria-hidden", String(!open));
      sheet.inert = !open;
      if (toggle) toggle.setAttribute("aria-expanded", String(open));
      if (more) more.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("sheet-locked", open);
      if (open) {
        var firstLink = sheet.querySelector(".sheet-nav a");
        if (firstLink) firstLink.focus();
      } else if (lastTrigger && lastTrigger.focus) {
        lastTrigger.focus();
      }
    }
    if (toggle) toggle.addEventListener("click", function () { setOpen(!sheet.classList.contains("open"), toggle); });
    if (more) more.addEventListener("click", function () { setOpen(!sheet.classList.contains("open"), more); });
    header.querySelectorAll("[data-close-sheet]").forEach(function (el) {
      el.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && sheet.classList.contains("open")) setOpen(false);
    });
  };

  /* ---------- footer ---------- */
  NT.renderFooter = function () {
    var base = NT.base();
    var settings = NT.store.settings();
    var supportEmail = String(settings.supportEmail || "").trim();
    var contactLink = supportEmail
      ? '<a href="mailto:' + encodeURIComponent(supportEmail) + '">' + NT.esc(supportEmail) + "</a>"
      : "";
    var institutions = NT.content.data() ? NT.content.universities() : [];
    var universityLinks = institutions.slice(0, 4).map(function (item) {
      return '<a href="' + base + "courses.html?university=" + encodeURIComponent(item.id) + '">' + NT.esc(item.shortName) + "</a>";
    }).join("");
    var footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML =
      '<div class="container"><div class="footer-grid">' +
      '<div class="footer-brand">' + brandHtml() +
      "<p>Video lessons for university and secondary students, organised by university, semester and course.</p>" +
      '<p class="footer-note">Lessons play from their original public source (for example MIT OpenCourseWare and Crash Course).</p></div>' +
      '<div class="footer-col"><h4>Learn</h4>' +
      '<a href="' + base + 'courses.html">All courses</a>' +
      universityLinks +
      '<a href="' + base + 'library.html">Video library</a>' +
      '<a href="' + base + 'pricing.html">Access packages</a></div>' +
      '<div class="footer-col"><h4>Your learning</h4>' +
      '<a href="' + base + 'dashboard.html">Dashboard</a>' +
      '<a href="' + base + 'profile.html">Learning profile</a>' +
      '<a href="' + base + 'access.html">Log in with a code</a>' +
      '<a href="' + base + 'index.html#how-it-works">How it works</a></div>' +
      '<div class="footer-col"><h4>Updates</h4>' +
      '<a href="' + base + 'announcements.html">Announcements</a>' +
      '<a href="' + base + 'search.html">Search lessons</a></div>' +
      '</div><div class="footer-bottom"><span>© ' + new Date().getFullYear() + " Nuclear Tutorials</span>" +
      (contactLink ? "<span>Support: " + contactLink + "</span>" : "") + "</div></div>";
    document.body.appendChild(footer);
  };

  /* ---------- toast ---------- */
  NT.toast = function (msg, type) {
    var wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    var toast = document.createElement("div");
    toast.className = "toast " + (type || "");
    var ico = type === "success" ? "check-circle" : type === "error" ? "circle-alert" : "info";
    toast.innerHTML = NT.icon(ico) + "<span>" + NT.esc(msg) + "</span>";
    wrap.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3600);
  };

  /* ---------- modal ---------- */
  NT.modal = function (opts) {
    var scrim = document.createElement("div");
    scrim.className = "modal-scrim";
    scrim.innerHTML =
      '<div class="modal' + (opts.size ? " modal-" + opts.size : "") + '" role="dialog" aria-modal="true" aria-label="' + NT.esc(opts.title || "Dialog") + '">' +
      '<div class="modal-head"><h3>' + NT.esc(opts.title || "") + "</h3>" +
      '<button class="modal-x" data-close aria-label="Close">' + NT.icon("x") + "</button></div>" +
      '<div class="modal-body">' + (opts.body || "") + "</div>" +
      (opts.footer ? '<div class="modal-foot">' + opts.footer + "</div>" : "") +
      "</div>";
    document.body.appendChild(scrim);
    function close() { scrim.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(event) { if (event.key === "Escape") close(); }
    scrim.addEventListener("click", function (event) { if (event.target === scrim) close(); });
    scrim.querySelectorAll("[data-close]").forEach(function (button) { button.addEventListener("click", close); });
    document.addEventListener("keydown", onKey);
    scrim.close = close;
    return scrim;
  };

  /* ---------- scroll entrances ---------- */
  NT.initReveal = function () {
    var elements = Array.prototype.slice.call(document.querySelectorAll(".reveal"))
      .filter(function (el) { return !el.hasAttribute("data-reveal-bound"); });
    if (!elements.length) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      elements.forEach(function (el) { el.classList.add("is-in"); el.setAttribute("data-reveal-bound", "1"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    elements.forEach(function (el) { el.setAttribute("data-reveal-bound", "1"); observer.observe(el); });
  };

  NT.copy = function (text) {
    function done() { NT.toast("Copied to clipboard: " + text, "success"); }
    function fallback() {
      var area = document.createElement("textarea");
      area.value = text; document.body.appendChild(area); area.select();
      try { document.execCommand("copy"); done(); } catch (error) { NT.toast("Code: " + text, "info"); }
      area.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
  };

  /* ---------- page states ---------- */
  NT.skeletonCards = function (count, shape) {
    var cards = "";
    for (var index = 0; index < count; index++) {
      cards += '<div class="skeleton-card' + (shape === "wide" ? " skeleton-wide" : "") + '" aria-hidden="true">' +
        '<div class="sk-thumb"></div><div class="sk-line sk-line-lg"></div>' +
        '<div class="sk-line"></div><div class="sk-line sk-line-sm"></div></div>';
    }
    return '<div class="skeleton-grid">' + cards + "</div>";
  };

  NT.empty = function (options) {
    var opts = options || {};
    return '<div class="empty-state reveal">' +
      '<span class="empty-icon">' + NT.icon(opts.icon || "video", "icon-lg") + "</span>" +
      "<h3>" + NT.esc(opts.title || "Nothing here yet") + "</h3>" +
      (opts.message ? "<p>" + NT.esc(opts.message) + "</p>" : "") +
      (opts.action ? '<div class="empty-actions">' + opts.action + "</div>" : "") +
      "</div>";
  };

  NT.offlinePanel = function (retryId) {
    return '<div class="empty-state offline-state reveal">' +
      '<span class="empty-icon">' + NT.icon("circle-alert", "icon-lg") + "</span>" +
      "<h3>The content service is not reachable</h3>" +
      "<p>Course and video data is served by the Nuclear Tutorials backend. Start it with " +
      "<code>npm start</code> and reload this page.</p>" +
      (retryId ? '<div class="empty-actions"><button class="btn btn-secondary" type="button" id="' + retryId + '">' +
        NT.icon("rotate") + "Try again</button></div>" : "") +
      "</div>";
  };

  /* One entry point for data-backed sections: shows a skeleton while the
     catalogue loads, a clear offline panel if it cannot be reached, and
     then hands control to the page renderer. */
  NT.view = function (root, render, options) {
    var opts = options || {};
    if (!root) return;
    if (NT.content.status() === "ready") { render(NT.content.data()); NT.initReveal(); return; }
    root.innerHTML = opts.skeleton === false ? "" : (opts.skeleton || NT.skeletonCards(opts.count || 6, opts.shape));
    NT.content.ready(function (data) {
      render(data);
      NT.initReveal();
    }, function () {
      root.innerHTML = NT.offlinePanel("retryLoad");
      var retry = document.getElementById("retryLoad");
      if (retry) retry.addEventListener("click", function () {
        NT.content.reload().then(function (data) { render(data); NT.initReveal(); }, function () {
          root.innerHTML = NT.offlinePanel();
        });
      });
    });
  };

  /* ---------- shared components ---------- */

  NT.percentLabel = function (part, total) {
    if (!total) return "0";
    return Math.round((part / total) * 100) + "%";
  };

  NT.progressBar = function (watched, total, options) {
    var opts = options || {};
    var percent = total ? Math.round((watched / total) * 100) : 0;
    return '<div class="progress' + (opts.compact ? " progress-compact" : "") + '">' +
      '<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '"' +
      ' aria-label="' + NT.esc(opts.label || "Course progress") + '">' +
      '<span class="progress-fill" style="width:' + percent + '%"></span></div>' +
      '<span class="progress-text">' + watched + " of " + total + " lessons watched</span></div>";
  };

  /* Thumbnail with a designed fallback so a missing image never breaks a card. */
  NT.thumb = function (video, size) {
    var fallback = '<span class="thumb-fallback" aria-hidden="true">' + NT.icon("play", "icon-lg") + "</span>";
    var image = video.thumbnailUrl
      ? '<img src="' + NT.esc(video.thumbnailUrl) + '" alt="" loading="lazy" decoding="async" ' +
        'onerror="this.parentNode.classList.add(\'is-fallback\');this.remove()">'
      : "";
    var duration = video.durationSeconds ? '<span class="thumb-duration">' + NT.duration(video.durationSeconds) + "</span>" : "";
    return '<span class="thumb thumb-' + (size || "md") + (video.thumbnailUrl ? "" : " is-fallback") + '">' +
      image + fallback + duration + "</span>";
  };

  NT.videoCard = function (video, options) {
    var opts = options || {};
    var unlocked = NT.isUnlocked(video);
    var watched = NT.progress.watched(video.id);
    var href = NT.base() + "lesson.html?id=" + encodeURIComponent(video.id);
    var context = opts.context === false ? "" :
      '<p class="video-card-context">' + NT.esc(opts.contextLabel || NT.videoContext(video)) + "</p>";
    return '<article class="video-card reveal' + (watched ? " is-watched" : "") + (unlocked ? "" : " is-locked") + '" data-video="' + NT.esc(video.id) + '">' +
      '<a class="video-card-media" href="' + href + '" aria-label="Open ' + NT.esc(video.title) + '">' +
      NT.thumb(video) +
      '<span class="play-badge">' + NT.icon("play") + "</span>" +
      (watched ? '<span class="watched-flag">' + NT.icon("check-circle") + "Watched</span>" : "") +
      "</a>" +
      '<div class="video-card-body">' +
      '<div class="video-card-top">' +
      (opts.index ? '<span class="video-card-index">' + String(opts.index).padStart(2, "0") + "</span>" : "") +
      '<span class="video-card-topic">' + NT.esc(video.topic || video.courseTitle) + "</span>" +
      (unlocked ? "" : NT.levelBadge(NT.levelOf(video), true)) + "</div>" +
      "<h3><a href=\"" + href + "\">" + NT.esc(video.title) + "</a></h3>" +
      context +
      (video.description && opts.description !== false
        ? '<p class="video-card-desc">' + NT.esc(video.description) + "</p>" : "") +
      '<div class="video-card-foot">' +
      NT.levelBadge(NT.levelOf(video), !unlocked) +
      '<a class="btn btn-secondary btn-sm" href="' + href + '">' +
      (watched ? "Watch again" : (unlocked ? "Watch lesson" : "Preview")) + NT.icon("arrow-right", "icon-sm") + "</a>" +
      "</div></div></article>";
  };

  NT.courseCard = function (course, options) {
    var opts = options || {};
    var lessons = NT.content.lessonsOf(course.id);
    var watched = NT.progress.watchedIn(course.id);
    var href = NT.base() + "course.html?id=" + encodeURIComponent(course.id);
    var hasAccess = NT.store.isActive();
    var meta = opts.showProgress === false ? "" : (hasAccess
      ? NT.progressBar(watched, lessons.length, { compact: true, label: course.title + " progress" })
      : '<span class="course-card-meta">' + NT.plural(lessons.length, "video lesson") + "</span>");
    return '<article class="course-card reveal" id="' + NT.esc(course.id) + '">' +
      '<div class="course-card-head">' +
      '<span class="course-icon" style="--tint:' + NT.esc(course.tint || "var(--bg-soft)") + ";--tint-fg:" + NT.esc(course.tintFg || "var(--ink-2)") + '">' +
      NT.icon(course.icon || "book-open") + "</span>" +
      "<div><h3><a href=\"" + href + "\">" + NT.esc(course.title) + "</a></h3>" +
      '<p class="course-path">' + NT.icon("building", "icon-sm") + NT.esc(course.universityShort || course.universityName) +
      '<span class="dot-sep" aria-hidden="true">·</span>' + NT.esc(NT.semesterLabel(course.semester)) +
      (course.code ? '<span class="dot-sep" aria-hidden="true">·</span>' + NT.esc(course.code) : "") + "</p></div></div>" +
      '<div class="course-card-body"><p class="desc">' + NT.esc(course.description) + "</p>" +
      '<div class="course-card-foot">' + meta +
      '<a class="btn btn-secondary btn-sm" href="' + href + '">Open course' + NT.icon("arrow-right", "icon-sm") + "</a>" +
      "</div></div></article>";
  };

  NT.universityCard = function (university, options) {
    var opts = options || {};
    var semesterOne = NT.content.semesterCourses(university.id, 1).length;
    var semesterTwo = NT.content.semesterCourses(university.id, 2).length;
    var href = NT.base() + "courses.html?university=" + encodeURIComponent(university.id) + (opts.semester ? "&semester=" + opts.semester : "");
    return '<article class="university-card reveal">' +
      '<div class="university-card-head">' +
      '<span class="university-mark" style="--accent:' + NT.esc(university.accent || "var(--brand-600)") + '">' +
      NT.icon(university.level === "high-school" ? "book-open" : "building") + "</span>" +
      "<div><h3><a href=\"" + href + "\">" + NT.esc(university.name) + "</a></h3>" +
      '<p class="university-card-meta">' + NT.icon("target", "icon-sm") + NT.esc(university.city || "Zambia") +
      '<span class="dot-sep" aria-hidden="true">·</span>' + NT.plural(university.courseCount, "course") +
      '<span class="dot-sep" aria-hidden="true">·</span>' + NT.plural(university.videoCount, "video lesson") + "</p></div></div>" +
      (university.summary ? '<p class="university-card-summary">' + NT.esc(university.summary) + "</p>" : "") +
      '<div class="semester-split">' +
      '<a class="semester-cell" href="' + NT.base() + "courses.html?university=" + encodeURIComponent(university.id) + '&semester=1">' +
      '<span class="semester-name">' + NT.icon("calendar", "icon-sm") + "Semester 1</span>" +
      '<span class="semester-count">' + NT.plural(semesterOne, "course") + "</span></a>" +
      '<a class="semester-cell" href="' + NT.base() + "courses.html?university=" + encodeURIComponent(university.id) + '&semester=2">' +
      '<span class="semester-name">' + NT.icon("calendar", "icon-sm") + "Semester 2</span>" +
      '<span class="semester-count">' + NT.plural(semesterTwo, "course") + "</span></a>" +
      "</div></article>";
  };

  /* Semester switch used on the catalogue, library and dashboard. */
  NT.semesterSwitch = function (options) {
    var opts = options || {};
    var id = opts.id || "semesterSwitch";
    var cells = NT.content.SEMESTERS.map(function (semester) {
      var count = opts.counts ? opts.counts[semester.id] || 0 : null;
      var active = Number(opts.current) === semester.id;
      return '<button type="button" class="semester-option' + (active ? " active" : "") + '" data-semester="' + semester.id + '"' +
        ' aria-pressed="' + active + '">' + NT.icon("calendar") + "<span>" + semester.label + "</span>" +
        (count == null ? "" : '<small>' + count + (count === 1 ? " course" : " courses") + "</small>") + "</button>";
    }).join("");
    var all = opts.allowAll
      ? '<button type="button" class="semester-option' + (opts.current ? "" : " active") + '" data-semester="0"' +
        ' aria-pressed="' + (!opts.current) + '">' + NT.icon("layers") + "<span>All semesters</span></button>"
      : "";
    return '<div class="semester-switch" id="' + NT.esc(id) + '" role="group" aria-label="' +
      NT.esc(opts.label || "Select a semester") + '">' + all + cells + "</div>";
  };

  NT.crumbs = function (items) {
    return '<nav class="crumbs" aria-label="Breadcrumb">' + (items || []).map(function (item, index) {
      var last = index === (items || []).length - 1;
      if (last || !item.href) return "<span" + (last ? ' aria-current="page"' : "") + ">" + NT.esc(item.label) + "</span>";
      return '<a href="' + item.href + '">' + NT.esc(item.label) + "</a>" + NT.icon("chevron-right", "icon-sm");
    }).join("") + "</nav>";
  };

  NT.pageHead = function (options) {
    var opts = options || {};
    return '<section class="page-head"><div class="container">' +
      (opts.crumbs ? opts.crumbs : "") +
      (opts.eyebrow ? '<span class="eyebrow">' + NT.esc(opts.eyebrow) + "</span>" : "") +
      "<h1>" + NT.esc(opts.title || "") + "</h1>" +
      (opts.lede ? '<p class="lede">' + NT.esc(opts.lede) + "</p>" : "") +
      (opts.body || "") + "</div></section>";
  };

  NT.statCard = function (options) {
    var opts = options || {};
    return '<div class="stat-card">' +
      '<span class="stat-icon">' + NT.icon(opts.icon || "target") + "</span>" +
      "<div><b>" + NT.esc(String(opts.value)) + "</b><span>" + NT.esc(opts.label) + "</span>" +
      (opts.hint ? "<small>" + NT.esc(opts.hint) + "</small>" : "") + "</div></div>";
  };

  /* Marks a lesson as watched on the server, then refreshes the DOM
     hooks a page registered through NT.onProgress. */
  var progressListeners = [];
  NT.onProgress = function (fn) { progressListeners.push(fn); };
  NT.markWatched = function (videoId, extra) {
    if (!NT.store.isActive()) return Promise.resolve(null);
    return NT.progress.mark(videoId, extra).then(function (items) {
      progressListeners.forEach(function (fn) { fn(items); });
      return items;
    }, function () { return null; });
  };
})();
