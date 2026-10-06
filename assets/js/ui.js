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
    { page: "home", label: "Home", href: "index.html" },
    { page: "how", label: "How it works", href: "index.html#how-it-works" },
    { page: "pricing", label: "Access / Packages", href: "pricing.html" },
    { page: "about", label: "About", href: "about.html" }
  ];
  var LEARNER_NAV = [
    { page: "dashboard", label: "Dashboard", href: "dashboard.html" },
    { page: "courses", label: "Courses", href: "courses.html" },
    { page: "search", label: "Search", href: "search.html" },
    { page: "library", label: "Learning library", href: "library.html" }
  ];

  function brandHtml(showSub) {
    return '<a class="brand" href="' + NT.base() + 'index.html" aria-label="Nuclear Tutorials — home">' +
      NT.logoImg("brand-logo") +
      '<span class="brand-copy"><span class="brand-name">Nuclear <span>Tutorials</span></span>' +
      (showSub === false ? "" : '<span class="brand-sub">Structured learning</span>') + "</span></a>";
  }

  function navLink(item, page) {
    var active = item.page === page || (item.page === "dashboard" && page === "dashboard");
    return '<a href="' + NT.base() + item.href + '" class="' + (active ? "active" : "") + '"' +
      (active ? ' aria-current="page"' : "") + ">" + item.label + "</a>";
  }

  function mobileLink(href, icon, label, active) {
    return '<a href="' + NT.base() + href + '"' + (active ? ' class="active" aria-current="page"' : "") + ">" +
      NT.icon(icon) + "<span>" + label + "</span></a>";
  }

  NT.renderHeader = function () {
    var page = document.body.dataset.page || "";
    var user = NT.auth && NT.auth.user ? NT.auth.user() : null;
    var signedIn = !!(user && user.learnerType);
    var nav = signedIn ? LEARNER_NAV : PUBLIC_NAV;
    var links = nav.map(function (item) { return navLink(item, page); }).join("");
    var actions = signedIn
      ? '<a class="btn btn-secondary btn-sm header-account" href="' + NT.base() + 'profile.html">' + NT.icon("circle-user") + "Learning profile</a>"
      : '<a class="btn btn-ghost header-login" href="' + NT.base() + 'login.html">Log in</a>' +
        '<a class="btn btn-primary btn-sm header-access-link" href="' + NT.base() + 'signup.html">Get Started</a>';

    var sheetLinks = signedIn
      ? '<span class="sheet-label">Your learning</span>' +
        '<a href="' + NT.base() + 'dashboard.html">' + NT.icon("layout-dashboard") + "<span>Dashboard</span></a>" +
        '<a href="' + NT.base() + 'courses.html">' + NT.icon("book-open") + "<span>Courses</span></a>" +
        '<a href="' + NT.base() + 'search.html">' + NT.icon("search") + "<span>Search</span></a>" +
        '<a href="' + NT.base() + 'library.html">' + NT.icon("book-marked") + "<span>Learning library</span></a>" +
        '<a href="' + NT.base() + 'profile.html">' + NT.icon("circle-user") + "<span>Learning profile</span></a>" +
        '<span class="sheet-label">Platform</span>' +
        '<a href="' + NT.base() + 'pricing.html">' + NT.icon("layers") + "<span>Access packages</span></a>" +
        '<a href="' + NT.base() + 'about.html">' + NT.icon("info") + "<span>About</span></a>" +
        '<a href="' + NT.base() + 'index.html#how-it-works">' + NT.icon("target") + "<span>How it works</span></a>" +
        '<button class="sheet-logout" id="sheetLogout" type="button">' + NT.icon("log-out") + "<span>Log out</span></button>"
      : '<span class="sheet-label">Platform</span>' +
        '<a href="' + NT.base() + 'index.html#how-it-works">' + NT.icon("target") + "<span>How it works</span></a>" +
        '<a href="' + NT.base() + 'pricing.html">' + NT.icon("layers") + "<span>Access / Packages</span></a>" +
        '<a href="' + NT.base() + 'about.html">' + NT.icon("info") + "<span>About</span></a>" +
        '<span class="sheet-label">Your account</span>' +
        '<a href="' + NT.base() + 'login.html">' + NT.icon("log-in") + "<span>Log in</span></a>" +
        '<a href="' + NT.base() + 'signup.html">' + NT.icon("user-round-plus") + "<span>Get Started</span></a>";

    var mobileNav = signedIn
      ? '<nav class="mobile-nav" aria-label="Primary mobile navigation">' +
        mobileLink("dashboard.html", "layout-dashboard", "Home", page === "dashboard") +
        mobileLink("courses.html", "book-open", "Courses", ["courses", "course", "lesson"].indexOf(page) !== -1) +
        mobileLink("search.html", "search", "Search", page === "search") +
        mobileLink("library.html", "book-marked", "Library", page === "library") +
        '<button class="mobile-nav-more' + (["dashboard", "courses", "course", "lesson", "search", "library"].indexOf(page) === -1 ? " is-current" : "") + '" id="mobileMore" type="button" aria-label="More pages" aria-expanded="false" aria-haspopup="dialog">' +
        NT.icon("ellipsis") + "<span>More</span></button></nav>"
      : '<nav class="mobile-nav mobile-nav-public" aria-label="Primary mobile navigation">' +
        mobileLink("index.html", "house", "Home", page === "home") +
        mobileLink("index.html#how-it-works", "target", "How it works", false) +
        mobileLink("pricing.html", "layers", "Packages", page === "pricing") +
        mobileLink("login.html", "log-in", "Log in", page === "login") +
        mobileLink("signup.html", "user-round-plus", "Get Started", page === "signup") +
        "</nav>";

    var html =
      '<a class="skip-link" href="#main">Skip to main content</a>' +
      '<div class="container header-inner">' + brandHtml() +
      '<nav class="nav-links" aria-label="Primary">' + links + "</nav>" +
      '<div class="header-actions">' + actions +
      (signedIn ? '<button class="nav-toggle" id="navToggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-haspopup="dialog">' + NT.icon("menu") + "</button>" :
        '<button class="nav-toggle" id="navToggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-haspopup="dialog">' + NT.icon("menu") + "</button>") +
      "</div></div>" +
      '<div class="mobile-sheet" id="mobileSheet" aria-hidden="true" inert>' +
      '<div class="scrim" data-close-sheet></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="Site navigation">' +
      '<div class="sheet-head"><div><span class="sheet-kicker">Nuclear Tutorials</span><h2>' + (signedIn ? "Your learning space" : "Explore the platform") + "</h2></div>" +
      '<button class="modal-x" data-close-sheet aria-label="Close navigation">' + NT.icon("x") + "</button></div>" +
      '<nav class="sheet-nav" aria-label="More pages">' + sheetLinks + "</nav>" +
      '<div class="sheet-foot"><p class="sheet-status">' + NT.icon("sparkles") + "<span>Your learning, organized. Learn at your pace and keep moving forward.</span></p></div>" +
      "</div></div>";

    var header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = html;
    document.body.classList.add("has-mobile-nav");
    document.body.prepend(header);
    var mobileSheet = header.querySelector("#mobileSheet");
    if (mobileSheet) document.body.appendChild(mobileSheet);
    var mobileTemplate = document.createElement("div");
    mobileTemplate.innerHTML = mobileNav;
    var mobileElement = mobileTemplate.firstElementChild;
    if (!mobileElement) {
      mobileElement = document.createElement("nav");
      mobileElement.innerHTML = mobileNav;
    }
    document.body.appendChild(mobileElement);

    var main = document.querySelector("main");
    if (!main) main = document.querySelector(".page-head, .section-body, section");
    if (main) {
      if (!main.id) main.id = "main";
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    }

    var sheet = document.getElementById("mobileSheet");
    var toggle = header.querySelector("#navToggle");
    var more = document.getElementById("mobileMore");
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
      } else if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    }
    if (toggle) toggle.addEventListener("click", function () { setOpen(!sheet.classList.contains("open"), toggle); });
    if (more) more.addEventListener("click", function () { setOpen(!sheet.classList.contains("open"), more); });
    sheet.querySelectorAll("[data-close-sheet]").forEach(function (el) {
      el.addEventListener("click", function () { setOpen(false); });
    });
    var sheetLogout = sheet.querySelector("#sheetLogout");
    if (sheetLogout) sheetLogout.addEventListener("click", function () {
      NT.auth.logout().then(function () { location.href = NT.base() + "index.html"; }, function (error) {
        NT.toast(error.message || "You could not be logged out right now.", "error");
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && sheet.classList.contains("open")) setOpen(false);
    });
  };

  NT.setHeaderContext = function () { /* kept as a harmless compatibility hook for existing page renderers */ };

  /* ---------- footer ---------- */
  NT.renderFooter = function () {
    var base = NT.base();
    var settings = NT.store.settings();
    var supportEmail = String(settings.supportEmail || "").trim();
    var contactLink = supportEmail
      ? '<a href="mailto:' + encodeURIComponent(supportEmail) + '">' + NT.esc(supportEmail) + "</a>"
      : "";
    var user = NT.auth && NT.auth.user ? NT.auth.user() : null;
    var learningColumn = user && user.learnerType
      ? '<div class="footer-col"><h4>Your learning</h4>' +
        '<a href="' + base + 'dashboard.html">Dashboard</a>' +
        '<a href="' + base + 'courses.html">Courses</a>' +
        '<a href="' + base + 'profile.html">Learning profile</a>' +
        '<a href="' + base + 'library.html">Learning library</a></div>'
      : '<div class="footer-col"><h4>Your account</h4>' +
        '<a href="' + base + 'signup.html">Get Started</a>' +
        '<a href="' + base + 'login.html">Log in</a></div>';
    var footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML =
      '<div class="container"><div class="footer-grid footer-grid-neutral">' +
      '<div class="footer-brand">' + brandHtml(false) +
      "<p>Structured lessons for wherever you are in your academic journey.</p>" +
      '<p class="footer-note">Your learning, organized. Learn at your pace and keep moving forward.</p></div>' +
      '<div class="footer-col"><h4>Platform</h4>' +
      '<a href="' + base + 'about.html">About</a>' +
      '<a href="' + base + 'index.html#how-it-works">How it works</a>' +
      '<a href="' + base + 'pricing.html">Access Packages</a>' +
      '<a class="footer-admin-link" href="/admin/login.html">Admin Console</a></div>' +
      learningColumn +
      (contactLink ? '<div class="footer-col"><h4>Contact</h4><a href="mailto:' + encodeURIComponent(supportEmail) + '">' + NT.esc(supportEmail) + "</a></div>" : "") +
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

    if (opts.list) {
      var accessLabel = unlocked
        ? '<span class="badge badge-success">' + NT.icon("check-circle") + "Included</span>"
        : '<span class="badge badge-warn">' + NT.icon("lock") + NT.esc(NT.data.LEVEL_LABEL[NT.levelOf(video)]) + " required</span>";
      var detailParts = [];
      if (video.durationSeconds) detailParts.push(NT.icon("clock", "icon-sm") + NT.duration(video.durationSeconds));
      if (video.topic) detailParts.push(NT.esc(video.topic));
      return '<a class="video-card lesson-row reveal' + (watched ? " is-watched" : "") + (unlocked ? "" : " is-locked") +
        '" data-video="' + NT.esc(video.id) + '" href="' + href + '" aria-label="Lesson ' +
        String(opts.index || 1).padStart(2, "0") + ': ' + NT.esc(video.title) + (unlocked ? "" : ", " + NT.data.LEVEL_LABEL[NT.levelOf(video)] + " package required") + '">' +
        '<span class="video-card-index">' + String(opts.index || 1).padStart(2, "0") + "</span>" +
        '<span class="lesson-row-copy"><span class="lesson-row-course">' + NT.esc(video.courseTitle || "Video lesson") + "</span>" +
        '<strong class="lesson-row-title">' + NT.esc(video.title) + "</strong>" +
        (detailParts.length ? '<span class="lesson-row-details">' + detailParts.join('<span class="lesson-row-dot">·</span>') + "</span>" : "") +
        '</span><span class="lesson-row-access">' + accessLabel +
        (watched ? '<span class="badge badge-success lesson-row-watched">' + NT.icon("check-circle") + "Watched</span>" : "") +
        '</span><span class="lesson-row-arrow">' + NT.icon("arrow-right") + "</span></a>";
    }

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
      '<div class="course-card-heading"><p class="course-path">' + NT.icon("building", "icon-sm") + NT.esc(course.universityShort || course.universityName) + "</p>" +
      "<h3><a href=\"" + href + "\">" + NT.esc(course.title) + "</a></h3>" +
      '<div class="course-card-tags">' +
      NT.semesterBadge(course.semester) +
      (course.code ? '<span class="badge badge-outline course-code">' + NT.esc(course.code) + "</span>" : "") +
      "</div></div></div>" +
      '<div class="course-card-body">' +
      (course.description ? '<p class="desc">' + NT.esc(course.description) + "</p>" : "") +
      '<div class="course-card-foot">' + meta +
      '<a class="btn btn-secondary btn-sm" href="' + href + '">Open course' + NT.icon("arrow-right", "icon-sm") + "</a>" +
      "</div></div></article>";
  };

  NT.universityCard = function (university, options) {
    var opts = options || {};
    var semesterOne = NT.content.semesterCourses(university.id, 1).length;
    var semesterTwo = NT.content.semesterCourses(university.id, 2).length;
    var city = university.city ? NT.esc(university.city) + '<span class="dot-sep" aria-hidden="true">·</span>' : "";
    var href = NT.base() + "courses.html?university=" + encodeURIComponent(university.id) + (opts.semester ? "&semester=" + opts.semester : "");
    return '<article class="university-card reveal">' +
      '<div class="university-card-head">' +
      '<span class="university-mark" style="--accent:' + NT.esc(university.accent || "var(--brand-600)") + '">' +
      NT.icon(university.level === "high-school" ? "book-open" : "building") + "</span>" +
      "<div><h3><a href=\"" + href + "\">" + NT.esc(university.name) + "</a></h3>" +
      '<p class="university-card-meta">' + NT.icon("target", "icon-sm") + city + NT.plural(university.courseCount, "course") +
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
        ' aria-label="All semesters" aria-pressed="' + (!opts.current) + '">' + NT.icon("layers") + "<span>All</span></button>"
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
