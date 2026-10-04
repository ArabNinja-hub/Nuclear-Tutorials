/* ============================================================
   NUCLEAR TUTORIALS — Shared UI: header, mobile nav, footer,
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

  NT.levelBadge = function (level, locked) {
    var cls = "badge badge-" + level;
    var ico = locked === true ? "lock" : (locked === false ? "unlock" : "shield");
    return '<span class="' + cls + '">' + NT.icon(ico) + NT.data.LEVEL_LABEL[level] + "</span>";
  };

  /* ---------- header ---------- */
  var NAV = [
    { id: "courses", page: "courses", label: "Courses", href: "courses.html", icon: "book-open", defaultCourse: true },
    { id: "high-school", page: "courses", label: "High School", href: "courses.html?level=high-school", icon: "graduation-cap", level: "high-school" },
    { id: "university", page: "courses", label: "University", href: "courses.html?level=university", icon: "graduation-cap", level: "university" },
    { id: "pricing", page: "pricing", label: "Packages", href: "pricing.html", icon: "layers" },
    { id: "library", page: "library", label: "Library", href: "library.html", icon: "library" },
    { id: "dashboard", page: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "layout-dashboard" }
  ];

  function brandHtml() {
    return '<a class="brand" href="' + NT.base() + 'index.html">' +
      NT.logoImg("brand-logo") +
      '<span><span class="brand-name">Nuclear <span>Tutorials</span></span>' +
      '<span class="brand-sub">High School · University</span></span></a>';
  }

  NT.renderHeader = function () {
    var page = document.body.dataset.page || "";
    var s = NT.store.get();
    var chip = "";
    if (s.access) {
      chip = '<a class="access-chip" href="' + NT.base() + 'dashboard.html" title="Your active access">' +
        '<span class="dot"></span>' + NT.esc(NT.packageDetails(s.access).name) + " access · Active</a>";
    }
    function navIsActive(item) {
      if (page !== item.page) return false;
      if (item.level) return NT.qs("level") === item.level;
      if (item.defaultCourse) return !NT.qs("level");
      return true;
    }
    var links = NAV.map(function (n) {
      return '<a href="' + NT.base() + n.href + '" class="' + (navIsActive(n) ? "active" : "") + '">' + n.label + "</a>";
    }).join("");
    var sheetLinks = NAV.map(function (n) {
      return '<a href="' + NT.base() + n.href + '" class="' + (navIsActive(n) ? "active" : "") + '">' +
        NT.icon(n.icon) + "<span>" + n.label + "</span></a>";
    }).join("");

    var statusCard = s.access
      ? '<div class="sheet-status">' + NT.icon("badge-check") + "<div><b>" + NT.esc(NT.packageDetails(s.access).name) + " access is active.</b><br>" + NT.availableFor(s.access) + " of " + NT.counts().total + " videos unlocked.</div></div>"
      : '<div class="sheet-status">' + NT.icon("lock") + "<div><b>No active access yet.</b><br>Choose a package or redeem an access code.</div></div>";

    var html =
      '<div class="container header-inner">' +
      brandHtml() +
      '<nav class="nav-links" aria-label="Primary">' + links + "</nav>" +
      '<div class="header-actions">' + chip +
      '<a class="btn btn-primary btn-sm" href="' + NT.base() + 'access.html">' + NT.icon("key") + "Unlock Access</a>" +
      '<button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">' + NT.icon("menu") + "</button>" +
      "</div></div>" +
      '<div class="mobile-sheet" id="mobileSheet" aria-hidden="true">' +
      '<div class="scrim" data-close-sheet></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="Menu">' +
      '<div class="sheet-head">' + brandHtml() +
      '<button class="modal-x" data-close-sheet aria-label="Close menu">' + NT.icon("x") + "</button></div>" +
      '<nav class="sheet-nav">' + sheetLinks +
      '<a href="' + NT.base() + 'access.html">' + NT.icon("key") + "<span>Unlock Access</span></a>" +
      '<a href="' + NT.base() + 'control.html">' + NT.icon("shield-check") + "<span>Access control demo</span></a>" +
      '<a href="' + NT.base() + 'admin/index.html">' + NT.icon("settings") + "<span>Admin console</span></a>" +
      "</nav>" +
      '<div class="sheet-foot">' + statusCard +
      '<a class="btn btn-primary btn-block" href="' + NT.base() + (s.access ? "dashboard.html" : "pricing.html") + '">' +
      (s.access ? "Go to Dashboard" : "Get Access") + "</a>" +
      "</div></div></div>";

    var header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = html;
    document.body.prepend(header);

    var sheet = header.querySelector("#mobileSheet");
    var toggle = header.querySelector("#navToggle");
    function setOpen(open) {
      sheet.classList.toggle("open", open);
      sheet.setAttribute("aria-hidden", String(!open));
      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("sheet-locked", open);
    }
    toggle.addEventListener("click", function () { setOpen(!sheet.classList.contains("open")); });
    header.querySelectorAll("[data-close-sheet]").forEach(function (el) {
      el.addEventListener("click", function () { setOpen(false); });
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
      '<div class="footer-brand">' +
      '<a class="brand" href="' + b + 'index.html">' + NT.logoImg("brand-logo") +
      '<span><span class="brand-name">Nuclear <span>Tutorials</span></span><span class="brand-sub">Learning for every next step</span></span></a>' +
      "<p>Structured tutorial courses for high-school and university students, organised by education level, subject and course.</p>" +
      '<div class="footer-note">' + NT.icon("info") + "Client demo — all payments and codes are simulated.</div>" +
      "</div>" +
      '<div class="footer-col"><h4>Platform</h4>' +
      '<a href="' + b + 'courses.html">Courses</a>' +
      '<a href="' + b + 'pricing.html">Pricing</a>' +
      '<a href="' + b + 'library.html">Video library</a>' +
      '<a href="' + b + 'dashboard.html">Student dashboard</a></div>' +
      '<div class="footer-col"><h4>Access</h4>' +
      '<a href="' + b + 'access.html">' + NT.icon("key", "icon-sm") + "Redeem access code</a>" +
      '<a href="' + b + 'control.html">' + NT.icon("shield-check", "icon-sm") + "Access control demo</a>" +
      '<a href="' + b + 'checkout.html">' + NT.icon("credit-card", "icon-sm") + "Demo checkout</a>" +
      '<a href="' + b + 'admin/index.html">' + NT.icon("settings", "icon-sm") + "Admin console</a></div>" +
      '<div class="footer-col"><h4>Contact</h4>' +
      '<a href="mailto:' + s.settings.email + '">' + NT.icon("mail", "icon-sm") + s.settings.email + "</a>" +
      '<a href="tel:+260211000000">' + NT.icon("phone", "icon-sm") + "+260 211 000 000</a>" +
      '<a href="' + b + 'index.html">' + NT.icon("map-pin", "icon-sm") + "Lusaka, Zambia</a></div>" +
      "</div>" +
      '<div class="footer-bottom"><span>© 2026 Nuclear Tutorials. All rights reserved.</span>' +
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
    setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 220); }, 3400);
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
    return '<svg class="thumb-art" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="g-' + c.id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ffffff" stop-opacity=".14"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>' +
      '<rect width="320" height="180" fill="url(#g-' + c.id + ')"/>' +
      '<g fill="none" stroke="#ffffff" stroke-opacity=".16" stroke-width="1.2">' +
      '<circle cx="262" cy="34" r="46"/><circle cx="262" cy="34" r="72"/><circle cx="262" cy="34" r="98"/>' +
      '<path d="M-10 150 C 60 120, 110 168, 180 138 S 300 150, 340 120"/>' +
      '<path d="M-10 168 C 60 140, 110 186, 180 156 S 300 168, 340 140"/>' +
      "</g>" +
      '<g stroke="#ffffff" stroke-opacity=".22" stroke-width="1"><path d="M24 26h54M24 40h38M24 54h46"/></g>' +
      "</svg>";
  };
})();
