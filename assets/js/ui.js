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
      ? "<b>" + NT.esc(NT.packageDetails(s.access).name) + " preview package selected.</b> " +
        NT.availableFor(s.access) + " of " + NT.counts().total + " listed lessons included."
      : "<b>No preview package selected.</b> Generate a local code from Access packages or redeem an existing code.";

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
      sheetLink("courses.html", "book-open", "Courses", page === "courses") +
      sheetLink("pricing.html", "layers", "Pricing", page === "pricing") +
      sheetLink("index.html#how-it-works", "target", "How it works", false) +
      '<span class="sheet-label">Your learning</span>' +
      accountSheetPrimary +
      sheetLink("library.html", "book-open", "Library", page === "library") +
      sheetLink("profile.html", "circle-user", "Profile", page === "profile") +
      '<span class="sheet-label">More</span>' +
      sheetLink("announcements.html", "bell", "Announcements", page === "announcements") +
      sheetLink("search.html", "search", "Search", page === "search") +
      "</nav>" +
      '<div class="sheet-foot"><p class="sheet-status">' + NT.icon("info") + "<span>" + statusCard + "</span></p>" +
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
      "<p>Course outlines and lesson-access preview for High School and University.</p>" +
      '<p class="footer-note">Preview build. Payments are not processed; access codes are stored in this browser.</p></div>' +
      '<div class="footer-col"><h4>Learn</h4>' +
      '<a href="' + base + 'courses.html">Courses</a>' +
      '<a href="' + base + 'courses.html?level=high-school">High School</a>' +
      '<a href="' + base + 'courses.html?level=university">University</a>' +
      '<a href="' + base + 'pricing.html">Access packages</a>' +
      '<a href="' + base + 'index.html#how-it-works">How it works</a></div>' +
      '<div class="footer-col"><h4>Your learning</h4>' +
      '<a href="' + base + 'dashboard.html">Dashboard</a>' +
      '<a href="' + base + 'library.html">Lesson library</a>' +
      '<a href="' + base + 'profile.html">Learning profile</a>' +
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
