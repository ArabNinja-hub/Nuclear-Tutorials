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

  /* ---------- logo ----------
     Canonical brand file: assets/img/logo.jpg (client supplied).
     Falls back through png/svg, then to a neutral placeholder tile
     so the demo never shows a broken image before the real file
     is dropped into /assets/img/. The logo artwork itself is never
     redrawn or altered — it is used exactly as supplied. */
  var PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
    '<rect width="120" height="120" rx="26" fill="#6ecbe8"/>' +
    '<g fill="none" stroke="#ffffff" stroke-opacity=".9" stroke-width="5">' +
    '<ellipse cx="60" cy="60" rx="40" ry="17"/>' +
    '<ellipse cx="60" cy="60" rx="40" ry="17" transform="rotate(60 60 60)"/>' +
    '<ellipse cx="60" cy="60" rx="40" ry="17" transform="rotate(120 60 60)"/>' +
    '</g><circle cx="60" cy="60" r="7" fill="#0c2334"/>' +
    "</svg>"
  );

  NT.logoImg = function (cls, alt) {
    var b = NT.base();
    return '<img class="' + (cls || "brand-logo") + '" src="' + b + 'assets/img/logo.jpg" ' +
      'alt="' + (alt || "Nuclear Tutorials logo") + '" loading="eager">';
  };
  /* second-step fallback (png -> svg -> placeholder) */
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.classList.contains("brand-logo")) {
      var src = t.getAttribute("src") || "";
      var b = NT.base();
      if (src.indexOf("logo.jpg") !== -1) { t.src = b + "assets/img/logo.png"; }
      else if (src.indexOf("logo.png") !== -1) { t.src = b + "assets/img/logo.svg"; }
      else if (src.indexOf("logo.svg") !== -1) { t.src = PLACEHOLDER; }
    }
  }, true);

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
  NT.parseDur = function (d) {
    var p = String(d).split(":");
    return (+p[0]) * 60 + (+p[1] || 0);
  };
  NT.fmtSec = function (s) {
    s = Math.max(0, Math.round(s));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  };
  NT.cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  /* ---------- academic pathway helpers ----------
     Education levels are course-level attributes: a course record lists one or
     more offerings, each pointing at an education level. These helpers keep the
     wording identical everywhere it is displayed. */
  NT.pathwayLabel = function (path) {
    if (!path) return "";
    if (path.educationLevel === "high-school") {
      var grade = NT.data.HIGH_SCHOOL_LEVELS.filter(function (item) { return item.id === path.levelId; })[0];
      return "High School" + (grade ? " · " + grade.label + " · " + grade.detail : "");
    }
    var university = NT.university(path.universityId);
    var programme = NT.programme(path.programmeId);
    return "University" + (university ? " · " + university.name : "") +
      (programme ? " · " + programme.name + (programme.school ? " · " + programme.school : "") : "");
  };
  NT.pathwayShort = function (path) {
    if (!path) return "";
    if (path.educationLevel === "high-school") {
      var grade = NT.data.HIGH_SCHOOL_LEVELS.filter(function (item) { return item.id === path.levelId; })[0];
      return "High School" + (grade ? " · " + grade.detail : "");
    }
    return "University";
  };
  NT.pathwayName = function (path) {
    var level = path && NT.data.EDUCATION_LEVELS.filter(function (item) { return item.id === path.educationLevel; })[0];
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
      var name = NT.pathwayName(path);
      if (name && names.indexOf(name) === -1) names.push(name);
    });
    return names.join(" · ");
  };
  NT.pathwayCounts = function (educationLevelId) {
    var courses = NT.data.COURSES.filter(function (course) {
      return NT.coursePathways(course).some(function (path) { return path.educationLevel === educationLevelId; });
    });
    var lessons = 0;
    courses.forEach(function (course) { lessons += NT.courseLessons(course.id).length; });
    return { courses: courses.length, lessons: lessons };
  };

  NT.levelBadge = function (level, locked) {
    var cls = "badge badge-" + level;
    var ico = locked === true ? "lock" : (locked === false ? "unlock" : "shield");
    return '<span class="' + cls + '">' + NT.icon(ico) + NT.data.LEVEL_LABEL[level] + "</span>";
  };

  /* ---------- navigation ----------
     The public navbar keeps three marketing destinations plus two clearly
     separated account actions (Login / Get Access). Everything else — the
     dashboard, library, profile and the demo tools — lives in the overflow
     sheet and the footer, so the header never turns into a site map. */
  var PUBLIC_NAV = [
    { id: "courses", page: "courses", label: "Courses", href: "courses.html" },
    { id: "pricing", page: "pricing", label: "Pricing", href: "pricing.html" },
    { id: "how", page: "", label: "How it works", href: "index.html#how-it-works" }
  ];

  function brandHtml(showSub) {
    return '<a class="brand" href="' + NT.base() + 'index.html">' +
      NT.logoImg("brand-logo") +
      '<span><span class="brand-name">Nuclear <span>Tutorials</span></span>' +
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

    function navIsActive(item) { return item.page && page === item.page; }

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

    var statusCard = s.access
      ? "<b>" + NT.esc(NT.packageDetails(s.access).name) + " access is active.</b> " +
        NT.availableFor(s.access) + " of " + NT.counts().total + " lessons unlocked."
      : "<b>No active access yet.</b> Choose a package or redeem an access code.";

    var html =
      '<a class="skip-link" href="#main">Skip to main content</a>' +
      '<div class="container header-inner">' +
      brandHtml() +
      '<nav class="nav-links" aria-label="Primary">' + links + "</nav>" +
      '<div class="header-actions">' +
      accountLink(s, "") +
      '<a class="btn btn-primary btn-sm header-access-link" href="' + NT.base() + 'pricing.html">Get Access</a>' +
      '<button class="nav-toggle" id="navToggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-haspopup="dialog">' + NT.icon("menu") + "</button>" +
      "</div></div>" +
      '<div class="mobile-sheet" id="mobileSheet" aria-hidden="true" inert>' +
      '<div class="scrim" data-close-sheet></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="Navigation">' +
      '<div class="sheet-head">' + brandHtml("") +
      '<button class="modal-x" data-close-sheet aria-label="Close navigation">' + NT.icon("x") + "</button></div>" +
      '<nav class="sheet-nav" aria-label="All pages">' +
      '<span class="sheet-label">Learn</span>' +
      sheetLink("courses.html", "book-open", "Courses", page === "courses") +
      sheetLink("pricing.html", "layers", "Pricing", page === "pricing") +
      sheetLink("index.html#how-it-works", "target", "How it works", false) +
      '<span class="sheet-label">Your learning</span>' +
      accountSheetPrimary +
      sheetLink("library.html", "video", "Library", page === "library") +
      sheetLink("profile.html", "circle-user", "Profile", page === "profile") +
      '<span class="sheet-label">More</span>' +
      sheetLink("resources.html", "library", "Resources", page === "resources") +
      sheetLink("announcements.html", "bell", "Announcements", page === "announcements") +
      sheetLink("search.html", "search", "Search", page === "search") +
      '<span class="sheet-label">Demo tools</span>' +
      sheetLink("control.html", "shield-check", "Access control demo", page === "control") +
      sheetLink("admin/index.html", "settings", "Admin console", false) +
      "</nav>" +
      '<div class="sheet-foot"><p class="sheet-status">' + NT.icon("info") + "<span>" + statusCard + "</span></p>" +
      '<a class="btn btn-primary btn-block" href="' + NT.base() + (s.access ? "dashboard.html" : "pricing.html") + '">' +
      (s.access ? "Go to Dashboard" : "View access packages") + "</a>" +
      "</div></div></div>" +
      '<nav class="mobile-nav" aria-label="Mobile navigation">' +
      '<a href="' + NT.base() + 'courses.html" class="' + (page === "courses" ? "active" : "") + '">' + NT.icon("book-open") + "<span>Courses</span></a>" +
      '<a href="' + NT.base() + 'pricing.html" class="' + (page === "pricing" ? "active" : "") + '">' + NT.icon("layers") + "<span>Pricing</span></a>" +
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
    var b = NT.base();
    var s = NT.store.get();
    var f = document.createElement("footer");
    f.className = "site-footer";
    f.innerHTML =
      '<div class="container">' +
      '<div class="footer-grid">' +
      '<div class="footer-brand">' + brandHtml() +
      "<p>Structured tutorial courses for high-school and university students, organised by pathway, subject and course.</p>" +
      '<div class="footer-note">Client demo — all payments and access codes are simulated.</div>' +
      "</div>" +
      '<div class="footer-col"><h4>Learn</h4>' +
      '<a href="' + b + 'courses.html">Courses</a>' +
      '<a href="' + b + 'courses.html?level=high-school">High School</a>' +
      '<a href="' + b + 'courses.html?level=university">University</a>' +
      '<a href="' + b + 'pricing.html">Pricing</a>' +
      '<a href="' + b + 'index.html#how-it-works">How it works</a></div>' +
      '<div class="footer-col"><h4>Your learning</h4>' +
      '<a href="' + b + 'dashboard.html">Dashboard</a>' +
      '<a href="' + b + 'library.html">Library</a>' +
      '<a href="' + b + 'profile.html">Profile</a>' +
      '<a href="' + b + 'access.html">Redeem access code</a></div>' +
      '<div class="footer-col"><h4>More</h4>' +
      '<a href="' + b + 'resources.html">Resources</a>' +
      '<a href="' + b + 'announcements.html">Announcements</a>' +
      '<a href="' + b + 'search.html">Search</a>' +
      '<a href="' + b + 'control.html">Access control demo</a>' +
      '<a href="' + b + 'admin/index.html">Admin console</a></div>' +
      "</div>" +
      '<div class="footer-bottom"><span>© 2026 Nuclear Tutorials. All rights reserved.</span>' +
      '<span>' + NT.esc(s.settings.email) + ' · Lusaka, Zambia</span>' +
      "<span>Demo build v1.0 · No real payments are processed</span></div>" +
      "</div>";
    document.body.appendChild(f);
  };

  /* ---------- persona / demo-view banner ---------- */
  NT.renderDemoBanner = function () {
    var s = NT.store.get();
    if (!s.access || (s.accessMeta && s.accessMeta.source !== "persona")) return;
    var el = document.createElement("div");
    el.className = "demo-banner";
    el.innerHTML = NT.icon("eye") +
      "<span>Viewing as <b>" + NT.data.LEVEL_LABEL[s.access] + " student</b> (demo)</span>" +
      '<button class="btn btn-invert" id="exitPersona">Exit demo view</button>';
    document.body.appendChild(el);
    el.querySelector("#exitPersona").addEventListener("click", function () {
      NT.store.clearAccess();
      el.remove();
      NT.toast("Demo view ended. Access cleared.", "success");
      setTimeout(function () { location.reload(); }, 350);
    });
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

  /* ---------- thumbnail art (SVG per course, deterministic) ---------- */
  NT.thumbArt = function (course) {
    var c = course || NT.data.COURSES[0];
    var id = c.id || "course";
    var motif = {
      math: '<path d="M16 128 C 70 70, 130 150, 210 78 S 300 36, 336 62" stroke="#ffffff" stroke-opacity=".4" fill="none" stroke-width="2"/>' +
        '<g stroke="#ffffff" stroke-opacity=".14" stroke-width="1">' +
        '<path d="M0 60h320M0 90h320M0 120h320M40 0v180M80 0v180M120 0v180M160 0v180M200 0v180M240 0v180M280 0v180"/></g>',
      phys: '<g fill="none" stroke="#ffffff" stroke-opacity=".38" stroke-width="1.5">' +
        '<ellipse cx="246" cy="64" rx="72" ry="26"/>' +
        '<ellipse cx="246" cy="64" rx="72" ry="26" transform="rotate(60 246 64)"/>' +
        '<ellipse cx="246" cy="64" rx="72" ry="26" transform="rotate(120 246 64)"/></g>' +
        '<circle cx="246" cy="64" r="6" fill="#ffffff" fill-opacity=".85"/>',
      chem: '<g fill="none" stroke="#ffffff" stroke-opacity=".34" stroke-width="1.4">' +
        '<circle cx="238" cy="52" r="18"/><circle cx="278" cy="78" r="14"/><circle cx="214" cy="90" r="12"/>' +
        '<path d="M252 62l18 12M226 66l-8 16"/></g>' +
        '<circle cx="238" cy="52" r="5" fill="#ffffff" fill-opacity=".7"/>' +
        '<circle cx="278" cy="78" r="4" fill="#ffffff" fill-opacity=".55"/>',
      cs: '<g fill="none" stroke="#ffffff" stroke-opacity=".32" stroke-width="1.3">' +
        '<rect x="208" y="28" width="36" height="24" rx="4"/><rect x="258" y="62" width="36" height="24" rx="4"/>' +
        '<rect x="208" y="96" width="36" height="24" rx="4"/><path d="M226 52v44M244 40h32l0 22"/></g>' +
        '<circle cx="226" cy="74" r="3.5" fill="#ffffff" fill-opacity=".7"/>',
      bio: '<g fill="none" stroke="#ffffff" stroke-opacity=".34" stroke-width="1.4">' +
        '<ellipse cx="244" cy="70" rx="54" ry="38"/><ellipse cx="244" cy="70" rx="22" ry="16"/>' +
        '<path d="M244 32c18 18 8 40 0 76"/></g>' +
        '<circle cx="258" cy="62" r="5" fill="#ffffff" fill-opacity=".65"/>'
    };
    return '<svg class="thumb-art" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="g-' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ffffff" stop-opacity=".14"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>' +
      '<rect width="320" height="180" fill="url(#g-' + id + ')"/>' +
      (motif[id] || '<circle cx="262" cy="34" r="72" fill="none" stroke="#ffffff" stroke-opacity=".16"/>') +
      '<g stroke="#ffffff" stroke-opacity=".2" stroke-width="1"><path d="M22 24h50M22 38h34M22 52h42"/></g>' +
      "</svg>";
  };
})();
