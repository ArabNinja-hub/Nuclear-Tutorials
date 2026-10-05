/* ============================================================
   NUCLEAR TUTORIALS — Shared UI: header, navigation, footer,
   toasts, modals, formatting helpers.
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
      'alt="' + (alt || "Nuclear Tutorials logo") + '" loading="eager">';
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
    if (isNaN(d)) return iso;
    var m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return String(d.getDate()).padStart(2, "0") + " " + m[d.getMonth()] + " " + d.getFullYear();
  };
  NT.qs = function (name) {
    return new URLSearchParams(location.search).get(name);
  };
  NT.cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  /* ---------- academic pathway helpers ----------
     Education levels are course-level attributes: a course record lists one or
     more offerings, each pointing at an education level. These helpers keep the
     wording identical everywhere it is displayed. */
  NT.pathwayLabel = function (path) {
    var level = path && NT.data.EDUCATION_LEVELS.filter(function (item) {
      return item.id === path.educationLevel;
    })[0];
    return level ? level.label : "";
  };
  NT.pathwayIcon = function (educationLevelId) {
    return educationLevelId === "university" ? "graduation-cap" : "book-open";
  };
  /* Short pathway names for a course, e.g. "High School · University". */
  NT.coursePathwayNames = function (course, only) {
    var names = [];
    NT.coursePathways(course).forEach(function (path) {
      if (only && path.educationLevel !== only) return;
      var name = NT.pathwayLabel(path);
      if (name && names.indexOf(name) === -1) names.push(name);
    });
    return names.join(" · ");
  };
  NT.levelBadge = function (level, locked) {
    var cls = "badge badge-" + level;
    var ico = locked === true ? "lock" : (locked === false ? "unlock" : "shield");
    return '<span class="' + cls + '">' + NT.icon(ico) + NT.data.LEVEL_LABEL[level] + "</span>";
  };

  /* ---------- navigation ----------
     The desktop header surfaces Courses, Pricing and How it works. Learning
     tools stay in the navigation sheet and footer rather than crowding the bar. */
  var PUBLIC_NAV = [
    { id: "universities", page: "universities", label: "Universities", href: "universities.html" },
    { id: "library", page: "library", label: "Video library", href: "library.html" },
    { id: "courses", page: "courses", label: "Courses", href: "courses.html" },
    { id: "pricing", page: "pricing", label: "Pricing", href: "pricing.html" }
  ];

  function brandHtml(showSub) {
    return '<a class="brand" href="' + NT.base() + 'index.html" aria-label="Nuclear Tutorials — home">' +
      NT.logoImg("brand-logo") +
      '<span class="brand-copy"><span class="brand-name">Nuclear <span>Tutorials</span></span>' +
      (showSub === false ? "" : '<span class="brand-sub">High School &amp; University</span>') + "</span></a>";
  }

  function accountLink(s, cls) {
    if (s.access) {
      return '<a class="btn btn-ghost header-account ' + cls + '" href="' + NT.base() + 'dashboard.html">' +
        '<span class="dot" aria-hidden="true"></span>Dashboard</a>';
    }
    return '<a class="btn btn-ghost header-login ' + cls + '" href="' + NT.base() + 'access.html">Login</a>';
  }

  NT.renderHeader = function () {
    var page = document.body.dataset.page || "";
    var s = NT.store.get();

    /* The university detail page keeps "Universities" active, and a watch page
       keeps "Video library" active, so the header always shows where you are. */
    var pageGroup = { university: "universities", video: "library" };
    var grouped = pageGroup[page] || page;
    function navIsActive(item) { return !!item.page && grouped === item.page; }

    var links = PUBLIC_NAV.map(function (n) {
      return '<a href="' + NT.base() + n.href + '" class="' + (navIsActive(n) ? "active" : "") + '"' +
        (navIsActive(n) ? ' aria-current="page"' : "") + ">" + n.label + "</a>";
    }).join("");

    function sheetLink(href, icon, label, active) {
      return '<a href="' + NT.base() + href + '" class="' + (active ? "active" : "") + '"' +
        (active ? ' aria-current="page"' : "") + ">" + NT.icon(icon) + "<span>" + label + "</span></a>";
    }
    var accountSheetPrimary = s.access
      ? sheetLink("dashboard.html", "layout-dashboard", "Dashboard", page === "dashboard")
      : sheetLink("access.html", "key", "Login with access code", page === "access");

    var watched = NT.progress ? NT.progress.watchedCount() : 0;
    var statusCard = s.access
      ? "<b>" + NT.esc(NT.packageDetails(s.access).name) + " package active.</b> " +
        NT.availableFor(s.access) + " of " + NT.counts().total + " listed lessons included." +
        (watched ? " " + watched + " video lesson" + (watched === 1 ? "" : "s") + " watched on this device." : "")
      : "<b>No access package yet.</b> Choose a package or redeem the code you were given, then pick your university and semester.";

    var html =
      '<a class="skip-link" href="#main">Skip to main content</a>' +
      '<div class="container header-inner">' +
      brandHtml() +
      '<nav class="nav-links" aria-label="Primary">' + links + "</nav>" +
      '<div class="header-actions">' +
      accountLink(s, "") +
      '<a class="btn-icon header-search-btn" href="' + NT.base() + 'search.html" aria-label="Search the catalogue">' + NT.icon("search") + "</a>" +
      '<a class="btn btn-primary btn-sm header-access-link" href="' + NT.base() + 'pricing.html">Get Access</a>' +
      '<button class="nav-toggle" id="navToggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-haspopup="dialog">' + NT.icon("menu") + "</button>" +
      "</div></div>" +
      '<div class="mobile-sheet" id="mobileSheet" aria-hidden="true" inert>' +
      '<div class="scrim" data-close-sheet></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="Navigation">' +
      '<div class="sheet-head">' + brandHtml(false) +
      '<button class="modal-x" data-close-sheet aria-label="Close navigation">' + NT.icon("x") + "</button></div>" +
      '<nav class="sheet-nav" aria-label="All pages">' +
      '<span class="sheet-label">Learn</span>' +
      sheetLink("universities.html", "building", "Universities", grouped === "universities") +
      sheetLink("library.html", "video", "Video library", grouped === "library") +
      sheetLink("courses.html", "book-open", "Course outlines", page === "courses") +
      sheetLink("pricing.html", "layers", "Pricing", page === "pricing") +
      sheetLink("index.html#how-it-works", "target", "How it works", false) +
      '<span class="sheet-label">Your learning</span>' +
      accountSheetPrimary +
      sheetLink("dashboard.html", "layout-dashboard", "Dashboard", page === "dashboard") +
      sheetLink("profile.html", "circle-user", "Profile", page === "profile") +
      '<span class="sheet-label">More</span>' +
      sheetLink("announcements.html", "bell", "Announcements", page === "announcements") +
      sheetLink("search.html", "search", "Search", page === "search") +
      "</nav>" +
      '<div class="sheet-foot"><p class="sheet-status">' + NT.icon("info") + "<span>" + statusCard + "</span></p>" +
      "</div></div></div>" +
      '<nav class="mobile-nav" aria-label="Mobile navigation">' +
      '<a href="' + NT.base() + 'universities.html" class="' + (grouped === "universities" ? "active" : "") + '">' + NT.icon("building") + "<span>Universities</span></a>" +
      '<a href="' + NT.base() + 'library.html" class="' + (grouped === "library" ? "active" : "") + '">' + NT.icon("video") + "<span>Videos</span></a>" +
      '<a href="' + NT.base() + 'courses.html" class="' + (page === "courses" ? "active" : "") + '">' + NT.icon("book-open") + "<span>Courses</span></a>" +
      (s.access
        ? '<a href="' + NT.base() + 'dashboard.html" class="' + (page === "dashboard" ? "active" : "") + '">' + NT.icon("layout-dashboard") + "<span>Dashboard</span></a>"
        : '<a href="' + NT.base() + 'access.html" class="' + (page === "access" ? "active" : "") + '">' + NT.icon("key") + "<span>Login</span></a>") +
      '<button class="mobile-nav-more" id="mobileMore" type="button" aria-label="More navigation" aria-expanded="false" aria-haspopup="dialog">' +
      NT.icon("ellipsis") + "<span>More</span></button></nav>";

    var header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = html;
    document.body.classList.add("has-mobile-nav");
    document.body.prepend(header);

    /* Keyboard users land on the page content rather than the whole nav */
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
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sheet.classList.contains("open")) setOpen(false);
    });
  };

  /* ---------- footer ---------- */
  NT.renderFooter = function () {
    var base = NT.base();
    var settings = NT.store.get().settings;
    var supportEmail = String(settings.email || "").trim();
    var contactLink = supportEmail
      ? '<a href="mailto:' + encodeURIComponent(supportEmail) + '">' + NT.esc(supportEmail) + "</a>"
      : "";
    var footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML =
      '<div class="container"><div class="footer-grid">' +
      '<div class="footer-brand">' + brandHtml() +
      "<p>Video lessons organised by university, semester and course, plus course outlines for High School and University.</p>" +
      '<p class="footer-note">Payments are not processed on this site; access codes are stored in this browser.</p></div>' +
      '<div class="footer-col"><h4>Learn</h4>' +
      '<a href="' + base + 'universities.html">Universities</a>' +
      '<a href="' + base + 'library.html">Video library</a>' +
      '<a href="' + base + 'courses.html">Course outlines</a>' +
      '<a href="' + base + 'courses.html?level=high-school">High School</a>' +
      '<a href="' + base + 'pricing.html">Access packages</a>' +
      '<a href="' + base + 'index.html#how-it-works">How it works</a></div>' +
      '<div class="footer-col"><h4>Your learning</h4>' +
      '<a href="' + base + 'dashboard.html">Dashboard</a>' +
      '<a href="' + base + 'profile.html">Learning profile</a>' +
      '<a href="' + base + 'search.html">Search lessons</a>' +
      '<a href="' + base + 'access.html">Log in with an access code</a></div>' +
      '<div class="footer-col"><h4>Updates</h4>' +
      '<a href="' + base + 'announcements.html">Announcements</a>' +
      '<a href="' + base + 'search.html">Search the catalogue</a></div>' +
      '</div><div class="footer-bottom"><span>© ' + new Date().getFullYear() + ' Nuclear Tutorials</span>' +
      (contactLink ? '<span>Support: ' + contactLink + '</span>' : "") + '</div></div>';
    document.body.appendChild(footer);
  };

  /* ---------- toast ---------- */
  NT.toast = function (msg, type) {
    var wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    var t = document.createElement("div");
    t.className = "toast " + (type || "");
    var ico = type === "success" ? "check-circle" : type === "error" ? "circle-alert" : "info";
    t.innerHTML = NT.icon(ico) + "<span>" + NT.esc(msg) + "</span>";
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, 3400);
  };

  /* ---------- modal ---------- */
  NT.modal = function (opts) {
    var scrim = document.createElement("div");
    scrim.className = "modal-scrim";
    scrim.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-label="' + NT.esc(opts.title || "Dialog") + '">' +
      '<div class="modal-head"><h3>' + NT.esc(opts.title || "") + "</h3>" +
      '<button class="modal-x" data-close aria-label="Close">' + NT.icon("x") + "</button></div>" +
      '<div class="modal-body">' + (opts.body || "") + "</div>" +
      (opts.footer ? '<div class="modal-foot">' + opts.footer + "</div>" : "") +
      "</div>";
    document.body.appendChild(scrim);
    function close() { scrim.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    scrim.addEventListener("click", function (e) { if (e.target === scrim) close(); });
    scrim.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", close); });
    document.addEventListener("keydown", onKey);
    scrim.close = close;
    return scrim;
  };

  /* ---------- breadcrumbs ----------
     One implementation so every page reads
     Home › Universities › Campus › Semester 1 › Course the same way. */
  NT.crumbs = function (items) {
    var list = (items || []).filter(Boolean);
    if (!list.length) return "";
    return '<nav class="crumbs" aria-label="Breadcrumb">' + list.map(function (item, index) {
      var last = index === list.length - 1;
      var separator = index ? NT.icon("chevron-right", "icon-sm") : "";
      if (last || !item.href) {
        return separator + (last ? '<span aria-current="page">' + NT.esc(item.label) + "</span>" : "<span>" + NT.esc(item.label) + "</span>");
      }
      return separator + '<a href="' + item.href + '">' + NT.esc(item.label) + "</a>";
    }).join("") + "</nav>";
  };

  /* ---------- loading states ----------
     Skeletons match the real card geometry so nothing jumps when data lands. */
  NT.loadingState = function (options) {
    var opts = options || {};
    var label = opts.label || "Loading";
    var count = opts.count || 3;
    var kind = opts.kind || "card";
    var skeletons = [];
    for (var i = 0; i < count; i++) {
      if (kind === "video") {
        skeletons.push('<div class="skeleton skeleton-video"><span class="skeleton-thumb shimmer"></span>' +
          '<span class="skeleton-line w-40 shimmer"></span><span class="skeleton-line w-90 shimmer"></span>' +
          '<span class="skeleton-line w-70 shimmer"></span></div>');
      } else if (kind === "rows") {
        skeletons.push('<div class="skeleton skeleton-row"><span class="skeleton-dot shimmer"></span>' +
          '<span class="skeleton-line w-70 shimmer"></span><span class="skeleton-line w-20 shimmer"></span></div>');
      } else if (kind === "uni") {
        skeletons.push('<div class="skeleton skeleton-uni"><span class="skeleton-dot skeleton-dot-lg shimmer"></span>' +
          '<span class="skeleton-line w-60 shimmer"></span><span class="skeleton-line w-90 shimmer"></span>' +
          '<span class="skeleton-line w-40 shimmer"></span></div>');
      } else {
        skeletons.push('<div class="skeleton skeleton-card"><span class="skeleton-line w-40 shimmer"></span>' +
          '<span class="skeleton-line w-90 shimmer"></span><span class="skeleton-line w-70 shimmer"></span>' +
          '<span class="skeleton-line w-30 shimmer"></span></div>');
      }
    }
    return '<div class="skeleton-grid" role="status" aria-busy="true" aria-live="polite">' +
      '<span class="sr-only">' + NT.esc(label) + "…</span>" + skeletons.join("") + "</div>";
  };

  NT.spinner = function (label) {
    return '<span class="spinner" role="status" aria-live="polite">' + NT.icon("loader") +
      "<span>" + NT.esc(label || "Working") + "…</span></span>";
  };

  /* ---------- empty states ----------
     Honest copy: no invented counts, testimonials or placeholders. */
  NT.emptyState = function (options) {
    var opts = options || {};
    var action = opts.action
      ? '<a class="btn ' + (opts.actionStyle || "btn-primary") + '" href="' + opts.action.href + '">' +
        NT.icon(opts.action.icon || "arrow-right") + NT.esc(opts.action.label) + "</a>"
      : (opts.button ? '<button class="btn ' + (opts.actionStyle || "btn-secondary") + '" type="button" id="' + opts.button.id + '">' +
        NT.icon(opts.button.icon || "rotate") + NT.esc(opts.button.label) + "</button>" : "");
    return '<div class="empty-state' + (opts.compact ? " empty-state-compact" : "") + '">' +
      '<span class="empty-state-icon">' + NT.icon(opts.icon || "search", "icon-lg") + "</span>" +
      "<h2>" + NT.esc(opts.title || "Nothing here yet") + "</h2>" +
      (opts.body ? "<p>" + NT.esc(opts.body) + "</p>" : "") +
      (opts.note ? '<p class="empty-state-note">' + NT.icon("info", "icon-sm") + NT.esc(opts.note) + "</p>" : "") +
      (action ? '<div class="empty-state-actions">' + action + "</div>" : "") + "</div>";
  };

  /* ---------- error / offline state ----------
     The content service is required for the video catalogue, so a failure is
     reported plainly with a retry instead of showing an empty screen. */
  NT.errorState = function (message, options) {
    var opts = options || {};
    return '<div class="empty-state empty-state-error" role="alert">' +
      '<span class="empty-state-icon">' + NT.icon(opts.icon || "wifi-off", "icon-lg") + "</span>" +
      "<h2>" + NT.esc(opts.title || "Cannot load this content") + "</h2>" +
      "<p>" + NT.esc(message || "The content service did not respond.") + "</p>" +
      '<div class="empty-state-actions"><button class="btn btn-secondary" type="button" data-retry>' +
      NT.icon("rotate") + "Try again</button>" +
      (opts.helpHref ? '<a class="link-arrow" href="' + opts.helpHref + '">' + NT.esc(opts.helpLabel || "How access works") + NT.icon("arrow-right", "icon-sm") + "</a>" : "") +
      "</div></div>";
  };

  /* ---------- semester switcher ----------
     Two large, distinct tap targets. Semester 1 uses the brand cyan, semester 2
     a deep slate, so the current semester is obvious at a glance on a phone. */
  NT.semesterSwitcher = function (options) {
    var opts = options || {};
    var current = Number(opts.current) === 2 ? 2 : 1;
    var label = opts.label || "Choose a semester";
    return '<div class="semester-switch">' +
      '<span class="semester-switch-label" id="semesterSwitchLabel">' + NT.icon("calendar-days", "icon-sm") + NT.esc(label) + "</span>" +
      '<div class="semester-switch-options" role="group" aria-labelledby="semesterSwitchLabel">' +
      NT.data.SEMESTERS.map(function (semester) {
        var stats = (opts.semesters || []).filter(function (item) { return Number(item.semester) === semester.id; })[0] || {};
        var courses = Number(stats.courses || 0);
        var videos = Number(stats.videos || 0);
        var active = current === semester.id;
        return '<button type="button" class="semester-option semester-' + semester.id + (active ? " active" : "") + '"' +
          ' data-semester="' + semester.id + '" aria-pressed="' + active + '"' +
          (active ? ' aria-current="true"' : "") + ">" +
          '<span class="semester-option-head">' + NT.icon(semester.id === 1 ? "calendar-days" : "layers") +
          "<b>" + NT.esc(semester.label) + "</b>" +
          (active ? '<span class="semester-option-check">' + NT.icon("check", "icon-sm") + "</span>" : "") + "</span>" +
          "<span class=\"semester-option-stats\">" +
          (courses
            ? courses + (courses === 1 ? " course" : " courses") + " · " + videos + (videos === 1 ? " video lesson" : " video lessons")
            : "No courses published yet") +
          "</span></button>";
      }).join("") + "</div></div>";
  };

  /* Small labelled metric used on dashboards and university heroes. */
  NT.metric = function (options) {
    var opts = options || {};
    return '<div class="metric' + (opts.tone ? " metric-" + opts.tone : "") + '">' +
      (opts.icon ? '<span class="metric-icon">' + NT.icon(opts.icon) + "</span>" : "") +
      '<span class="metric-copy"><b>' + NT.esc(String(opts.value == null ? "" : opts.value)) + "</b>" +
      "<small>" + NT.esc(opts.label || "") + "</small></span></div>";
  };

  /* ---------- shared catalogue helpers ---------- */
  /* Which lesson numbers each package opens for one course, e.g. Basic 1–3. */
  NT.tierRange = function (courseId) {
    var lessons = NT.courseLessons(courseId);
    var out = {};
    NT.data.LEVELS.forEach(function (level) {
      var idx = [];
      lessons.forEach(function (l) {
        if (NT.data.LEVEL_RANK[level] >= NT.data.LEVEL_RANK[NT.levelOf(l)]) idx.push(l.index);
      });
      out[level] = idx.length ? { from: idx[0], to: idx[idx.length - 1], count: idx.length } : null;
    });
    return out;
  };

  /* ---------- restrained scroll entrances ----------
     Sections and cards fade/rise once as they enter the viewport. Elements opt
     in with class="reveal"; the observer never blocks rendering and is skipped
     entirely when the visitor prefers reduced motion. */
  NT.initReveal = function () {
    var els = Array.prototype.slice.call(document.querySelectorAll(".reveal"))
      .filter(function (el) { return !el.hasAttribute("data-reveal-bound"); });
    if (!els.length) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); el.setAttribute("data-reveal-bound", "1"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (el) { el.setAttribute("data-reveal-bound", "1"); io.observe(el); });
  };

  NT.copy = function (text) {
    function done() { NT.toast("Copied to clipboard: " + text, "success"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { NT.toast("Code: " + text, "info"); }
      ta.remove();
    }
  };

})();
