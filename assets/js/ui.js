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
      '<a class="btn-icon header-search-btn" href="' + NT.base() + 'search.html" aria-label="Search the catalogue">' + NT.icon("search") + "</a>" +
      '<a class="btn btn-primary btn-sm header-access-link" href="' + NT.base() + 'pricing.html">' +
      '<span class="header-access-label">Get Access</span>' + NT.icon("arrow-right", "icon-sm header-access-ico") + "</a>" +
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

  /* ---------- shared catalogue helpers ---------- */
  /* Total runtime of a course, formatted like "2h 31m". */
  NT.courseDuration = function (courseId) {
    var secs = NT.courseLessons(courseId).reduce(function (sum, l) { return sum + NT.parseDur(l.duration); }, 0);
    var h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60);
    return (h ? h + "h " : "") + m + "m";
  };
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

  /* ---------- thumbnail art (SVG per course, deterministic) ----------
     Each subject gets its own composed scene: a soft light source, a faint
     study grid, the subject motif and one orbital accent drawn from the brand
     mark. Purely decorative — always aria-hidden. */
  NT.thumbArt = function (course) {
    var c = course || NT.data.COURSES[0];
    var id = c.id || "course";
    var glow = {
      math: "rgba(69,198,230,.34)", phys: "rgba(120,170,220,.30)", chem: "rgba(224,33,138,.26)",
      cs: "rgba(64,200,130,.24)", bio: "rgba(244,160,60,.26)"
    }[id] || "rgba(69,198,230,.28)";
    var motif = {
      math: '<g stroke="#ffffff" stroke-opacity=".16" stroke-width="1"><path d="M0 44h320M0 76h320M0 108h320M0 140h320M48 0v180M96 0v180M144 0v180M192 0v180M240 0v180M288 0v180"/></g>' +
        '<path d="M-8 132 C 52 64, 116 152, 186 76 S 288 30, 330 58" stroke="#ffffff" stroke-opacity=".5" fill="none" stroke-width="2.2" stroke-linecap="round"/>' +
        '<path d="M-8 150 C 60 96, 128 168, 200 104 S 296 66, 330 88" stroke="#7fd0ea" stroke-opacity=".42" fill="none" stroke-width="1.6" stroke-linecap="round"/>' +
        '<circle cx="186" cy="76" r="4" fill="#ffffff" fill-opacity=".85"/>',
      phys: '<g fill="none" stroke="#ffffff" stroke-opacity=".4" stroke-width="1.6">' +
        '<ellipse cx="238" cy="70" rx="82" ry="30"/>' +
        '<ellipse cx="238" cy="70" rx="82" ry="30" transform="rotate(60 238 70)"/>' +
        '<ellipse cx="238" cy="70" rx="82" ry="30" transform="rotate(120 238 70)"/></g>' +
        '<circle cx="238" cy="70" r="7" fill="#ffffff" fill-opacity=".9"/>' +
        '<circle cx="238" cy="70" r="14" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.2"/>' +
        '<circle cx="320" cy="40" r="4" fill="#7fd0ea" fill-opacity=".8"/>' +
        '<circle cx="156" cy="100" r="3.4" fill="#e0218a" fill-opacity=".7"/>',
      chem: '<g fill="none" stroke="#ffffff" stroke-opacity=".38" stroke-width="1.5">' +
        '<circle cx="228" cy="52" r="20"/><circle cx="272" cy="82" r="15"/><circle cx="204" cy="96" r="13"/><circle cx="252" cy="120" r="10"/>' +
        '<path d="M244 64l16 11M214 66l-6 18M262 96l-5 15"/></g>' +
        '<circle cx="228" cy="52" r="6" fill="#ffffff" fill-opacity=".75"/>' +
        '<circle cx="272" cy="82" r="4.5" fill="#e0218a" fill-opacity=".6"/>' +
        '<circle cx="204" cy="96" r="4" fill="#7fd0ea" fill-opacity=".6"/>',
      cs: '<g fill="none" stroke="#ffffff" stroke-opacity=".36" stroke-width="1.4">' +
        '<rect x="196" y="26" width="42" height="28" rx="6"/><rect x="254" y="66" width="42" height="28" rx="6"/>' +
        '<rect x="196" y="106" width="42" height="28" rx="6"/><path d="M217 54v52M238 40h58l0 26"/></g>' +
        '<circle cx="217" cy="80" r="4" fill="#7fd0ea" fill-opacity=".75"/>' +
        '<g stroke="#7fd0ea" stroke-opacity=".5" stroke-width="1.4"><path d="M262 80h14M268 74v12"/></g>',
      bio: '<g fill="none" stroke="#ffffff" stroke-opacity=".38" stroke-width="1.5">' +
        '<ellipse cx="238" cy="76" rx="60" ry="42"/><ellipse cx="238" cy="76" rx="25" ry="18"/>' +
        '<path d="M238 34c20 20 9 46 0 84"/><path d="M238 34c-20 20-9 46 0 84"/></g>' +
        '<circle cx="254" cy="64" r="5.5" fill="#ffffff" fill-opacity=".7"/>' +
        '<circle cx="222" cy="90" r="4" fill="#f4a03c" fill-opacity=".65"/>'
    };
    return '<svg class="thumb-art" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs>' +
      '<radialGradient id="gl-' + id + '" cx="0.74" cy="0.24" r="0.85">' +
      '<stop offset="0" stop-color="' + glow + '"/><stop offset="1" stop-color="' + glow + '" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="vg-' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0.55" stop-color="#04101a" stop-opacity="0"/><stop offset="1" stop-color="#04101a" stop-opacity=".5"/></linearGradient>' +
      "</defs>" +
      '<rect width="320" height="180" fill="url(#gl-' + id + ')"/>' +
      (motif[id] || '<circle cx="262" cy="34" r="72" fill="none" stroke="#ffffff" stroke-opacity=".16"/>') +
      '<rect width="320" height="180" fill="url(#vg-' + id + ')"/>' +
      "</svg>";
  };
})();
