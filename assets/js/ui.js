/* ============================================================
   NUCLEAR TUTORIALS — Shared UI

   Header and navigation, footer, dialogs and toasts, plus the
   components every page builds from: course cards, video cards,
   semester switches, progress bars and empty/loading states.
   ============================================================ */
(function () {
  window.NT = window.NT || {};

  /* ---------- theme (light / dark / system) ---------- */
  (function () {
    var THEME_KEY = 'nt_theme_preference';
    var VALID = ['light', 'dark', 'system'];
    function getPreference() {
      try {
        var v = localStorage.getItem(THEME_KEY);
        if (VALID.indexOf(v) !== -1) return v;
      } catch (e) {}
      return 'system';
    }
    function getEffective(pref) {
      var p = pref || getPreference();
      if (p === 'light' || p === 'dark') return p;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
      return 'light';
    }
    function apply(pref) {
      var effective = getEffective(pref);
      var root = document.documentElement;
      if (!root) return;
      root.setAttribute('data-theme', effective);
      root.setAttribute('data-theme-preference', pref || getPreference());
      root.style.colorScheme = effective;
    }
    function setPreference(pref) {
      if (VALID.indexOf(pref) === -1) return;
      try { localStorage.setItem(THEME_KEY, pref); } catch (e) {}
      apply(pref);
      try {
        window.dispatchEvent(new CustomEvent('nt:themechange', { detail: { preference: pref, effective: getEffective(pref) } }));
      } catch (e) {}
    }
    NT.theme = {
      getPreference: getPreference,
      getEffective: getEffective,
      apply: apply,
      set: setPreference,
      init: function () {
        apply(getPreference());
        if (window.matchMedia) {
          try {
            var mq = window.matchMedia('(prefers-color-scheme: dark)');
            var handler = function () {
              if (getPreference() === 'system') apply('system');
            };
            if (mq.addEventListener) mq.addEventListener('change', handler);
            else if (mq.addListener) mq.addListener(handler);
          } catch (e) {}
        }
      }
    };
    try { NT.theme.init(); } catch (e) {}
  })();

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
  var PUBLIC_MOBILE_NAV = [
    { page: "home", label: "Home", href: "index.html", icon: "house" },
    { page: "how", label: "How it works", href: "index.html#how-it-works", icon: "target" },
    { page: "pricing", label: "Packages", href: "pricing.html", icon: "layers" }
  ];
  var PUBLIC_MORE_PAGES = ["about", "login", "signup", "privacy-policy", "terms-and-conditions"];
  var LEARNER_MOBILE_NAV = [
    { page: "dashboard", label: "Home", href: "dashboard.html", icon: "layout-dashboard" },
    { page: "courses", label: "Courses", href: "courses.html", icon: "book-open" },
    { page: "search", label: "Search", href: "search.html", icon: "search" },
    { page: "library", label: "Library", href: "library.html", icon: "book-marked" }
  ];
  var LEARNER_MORE_PAGES = ["profile", "announcements", "access", "checkout", "pricing", "about"];

  function brandHtml(showSub) {
    return '<a class="brand" href="' + NT.base() + 'index.html" aria-label="Nuclear Tutorials — home">' +
      NT.logoImg("brand-logo") +
      '<span class="brand-copy"><span class="brand-name">Nuclear <span>Tutorials</span></span>' +
      (showSub === false ? "" : '<span class="brand-sub">Structured learning</span>') + "</span></a>";
  }

  function navIsActive(key, page) {
    if (key === "how") return page === "home" && location.hash === "#how-it-works";
    if (key === "home") return page === "home" && location.hash !== "#how-it-works";
    if (key === "courses") return ["courses", "course", "lesson"].indexOf(page) !== -1;
    if (key === "dashboard") return page === "dashboard";
    return key === page;
  }

  function navLink(item, page) {
    var active = navIsActive(item.page, page);
    return '<a href="' + NT.base() + item.href + '" data-nav-key="' + item.page + '" class="' + (active ? "active" : "") + '"' +
      (active ? ' aria-current="page"' : "") + ">" + item.label + "</a>";
  }

  function mobileLink(item, page) {
    var active = navIsActive(item.page, page);
    return '<a href="' + NT.base() + item.href + '" data-nav-key="' + item.page + '"' +
      (active ? ' class="active" aria-current="page"' : "") + ">" +
      NT.icon(item.icon) + "<span>" + item.label + "</span></a>";
  }

  function sheetLink(href, icon, label, active, pageKey) {
    return '<a href="' + NT.base() + href + '" data-nav-key="' + pageKey + '"' +
      (active ? ' class="active" aria-current="page"' : "") + ">" +
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

    var settings = NT.store ? NT.store.settings() : {};
    var supportEmail = String(settings.supportEmail || "").trim();
    var hasContact = !!supportEmail;
    var whatsappNumber = "260764599915";
    var whatsappLink = "https://wa.me/" + whatsappNumber;
    var themePref = NT.theme ? NT.theme.getPreference() : "system";

    function themeOptionsHtml(extraClass) {
      var pref = NT.theme ? NT.theme.getPreference() : themePref;
      var opts = [
        { id: "light", icon: "sun", label: "Light" },
        { id: "dark", icon: "moon", label: "Dark" },
        { id: "system", icon: "monitor", label: "System" }
      ];
      return '<div class="more-theme-options' + (extraClass ? ' ' + extraClass : '') + '" role="radiogroup" aria-label="Appearance">' +
        opts.map(function (o) {
          var checked = pref === o.id;
          return '<button type="button" class="more-theme-option" data-theme-option="' + o.id + '" role="radio" aria-checked="' + (checked ? "true" : "false") + '">' +
            NT.icon(o.icon) + "<span>" + o.label + "</span></button>";
        }).join("") + "</div>";
    }

    function sheetThemeGroup() {
      return '<div class="sheet-group"><span class="sheet-label">Appearance</span>' + themeOptionsHtml("sheet-theme-options") + "</div>";
    }

    var sheetLinks = signedIn
      ? '<div class="sheet-group sheet-primary-links"><span class="sheet-label">Your learning</span>' +
        sheetLink("dashboard.html", "layout-dashboard", "Dashboard", navIsActive("dashboard", page), "dashboard") +
        sheetLink("courses.html", "book-open", "Courses", navIsActive("courses", page), "courses") +
        sheetLink("search.html", "search", "Search", navIsActive("search", page), "search") +
        sheetLink("library.html", "book-marked", "Learning library", navIsActive("library", page), "library") +
        '</div><div class="sheet-group"><span class="sheet-label">Account & access</span>' +
        sheetLink("profile.html", "circle-user", "Learning profile", page === "profile", "profile") +
        sheetLink("announcements.html", "bell", "Announcements", page === "announcements", "announcements") +
        sheetLink("access.html", "key", "Redeem an access code", page === "access", "access") +
        sheetLink("pricing.html", "layers", "Access packages", page === "pricing", "pricing") +
        '</div>' + sheetThemeGroup() +
        '<div class="sheet-group"><span class="sheet-label">About the platform</span>' +
        sheetLink("about.html", "info", "About", page === "about", "about") +
        sheetLink("index.html#how-it-works", "target", "How it works", navIsActive("how", page), "how") +
        sheetLink("/privacy-policy", "shield-check", "Privacy Policy", false, "privacy-policy") +
        sheetLink("/terms-and-conditions", "file-text", "Terms & Conditions", false, "terms-and-conditions") +
        '</div><button class="sheet-logout" id="sheetLogout" type="button">' + NT.icon("log-out") + "<span>Log out</span></button>"
      : '<div class="sheet-group"><span class="sheet-label">Explore</span>' +
        sheetLink("index.html", "house", "Home", navIsActive("home", page), "home") +
        sheetLink("index.html#how-it-works", "target", "How it works", navIsActive("how", page), "how") +
        sheetLink("pricing.html", "layers", "Access / Packages", page === "pricing", "pricing") +
        sheetLink("about.html", "info", "About", page === "about", "about") +
        '</div><div class="sheet-group"><span class="sheet-label">Your account</span>' +
        sheetLink("login.html", "log-in", "Log in", page === "login", "login") +
        sheetLink("signup.html", "user-round-plus", "Get Started", page === "signup", "signup") +
        '</div>' + sheetThemeGroup() +
        '<div class="sheet-group"><span class="sheet-label">Support & legal</span>' +
        (hasContact
          ? sheetLink("mailto:" + encodeURIComponent(supportEmail), "mail", supportEmail, false, "contact")
          : sheetLink("mailto:mandasteven23@gmail.com", "mail", "Contact", false, "contact")) +
        sheetLink(whatsappLink, "message-circle", "WhatsApp", false, "whatsapp") +
        sheetLink("/privacy-policy", "shield-check", "Privacy Policy", false, "privacy-policy") +
        sheetLink("/terms-and-conditions", "file-text", "Terms & Conditions", false, "terms-and-conditions") +
        "</div>";

    function moreItem(href, icon, title, desc, active, pageKey) {
      var isActive = !!active;
      var isExternal = href.indexOf("http") === 0 || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0;
      var base = isExternal ? "" : NT.base();
      var target = isExternal ? ' target="_blank" rel="noopener"' : "";
      var hk = pageKey ? ' data-nav-key="' + pageKey + '"' : "";
      return '<a class="more-menu-item' + (isActive ? " active" : "") + '" href="' + base + href + '"' + hk +
        (isActive ? ' aria-current="page"' : "") + target + ">" +
        '<span class="more-menu-item-icon">' + NT.icon(icon) + "</span>" +
        '<span class="more-menu-item-copy"><span class="more-menu-item-title">' + NT.esc(title) + "</span>" +
        (desc ? '<span class="more-menu-item-desc">' + NT.esc(desc) + "</span>" : "") +
        "</span></a>";
    }
    function moreItemExternal(href, icon, title, desc) {
      return '<a class="more-menu-item" href="' + href + '" target="_blank" rel="noopener">' +
        '<span class="more-menu-item-icon">' + NT.icon(icon) + "</span>" +
        '<span class="more-menu-item-copy"><span class="more-menu-item-title">' + NT.esc(title) + "</span>" +
        (desc ? '<span class="more-menu-item-desc">' + NT.esc(desc) + "</span>" : "") +
        "</span></a>";
    }

    var mobileNav = signedIn
      ? '<nav class="mobile-nav mobile-nav-student" aria-label="Primary mobile navigation">' +
        LEARNER_MOBILE_NAV.map(function (item) { return mobileLink(item, page); }).join("") +
        '<button class="mobile-nav-more' + (LEARNER_MORE_PAGES.indexOf(page) !== -1 ? " is-current" : "") +
        '" id="mobileMore" type="button" aria-label="More destinations" aria-controls="mobileSheet" aria-expanded="false" aria-haspopup="dialog">' +
        NT.icon("ellipsis") + "<span>More</span></button></nav>"
      : '<nav class="mobile-nav mobile-nav-public" aria-label="Primary mobile navigation">' +
        PUBLIC_MOBILE_NAV.map(function (item) { return mobileLink(item, page); }).join("") +
        '<button class="mobile-nav-more' + (PUBLIC_MORE_PAGES.indexOf(page) !== -1 ? " is-current" : "") +
        '" id="publicMore" type="button" aria-label="More options" aria-controls="publicMoreMenu" aria-expanded="false" aria-haspopup="dialog">' +
        NT.icon("more-horizontal") + "<span>More</span></button></nav>";

    var publicMoreMenuHtml = "";
    if (!signedIn) {
      var secondaryGroup = '<div class="more-menu-group"><span class="more-menu-label">Secondary</span>' +
        moreItem("about.html", "info", "About", "Learn more about Nuclear Tutorials", page === "about", "about") +
        moreItem("login.html", "log-in", "Log in", "Access your account", page === "login", "login") +
        moreItem("signup.html", "user-round-plus", "Get Started", "Begin learning", page === "signup", "signup") +
        "</div>";

      var appearanceGroup = '<div class="more-menu-group"><span class="more-menu-label">Appearance</span>' + themeOptionsHtml("") + "</div>";

      var supportItems = "";
      if (hasContact) {
        supportItems += moreItemExternal("mailto:" + encodeURIComponent(supportEmail), "mail", "Contact", "Get in touch");
      } else {
        supportItems += moreItemExternal("mailto:mandasteven23@gmail.com", "mail", "Contact", "Get in touch");
      }
      supportItems += moreItemExternal(whatsappLink, "message-circle", "WhatsApp", "Chat on WhatsApp");
      supportItems += moreItem("/privacy-policy", "shield-check", "Privacy Policy", "", false, "privacy-policy");
      supportItems += moreItem("/terms-and-conditions", "file-text", "Terms & Conditions", "", false, "terms-and-conditions");

      var supportGroup = '<div class="more-menu-group"><span class="more-menu-label">Support & legal</span>' + supportItems + "</div>";

      publicMoreMenuHtml =
        '<div class="public-more-scrim" id="publicMoreScrim" aria-hidden="true"></div>' +
        '<div class="public-more-menu" id="publicMoreMenu" aria-hidden="true" inert role="dialog" aria-modal="false" aria-labelledby="publicMoreTitle">' +
        '<div class="public-more-menu-inner">' +
        '<div class="public-more-menu-handle" aria-hidden="true"></div>' +
        '<div class="public-more-menu-head"><div><span class="public-more-menu-kicker">MORE</span>' +
        '<h2 class="public-more-menu-title" id="publicMoreTitle">More options</h2></div>' +
        '<button class="modal-x" id="publicMoreClose" type="button" aria-label="Close more menu">' + NT.icon("x") + "</button></div>" +
        '<nav class="public-more-menu-nav" aria-label="More options">' +
        secondaryGroup + '<div class="more-menu-divider" aria-hidden="true"></div>' +
        appearanceGroup + '<div class="more-menu-divider" aria-hidden="true"></div>' +
        supportGroup +
        "</nav></div></div>";
    }

    var html =
      '<a class="skip-link" href="#main">Skip to main content</a>' +
      '<div class="container header-inner">' + brandHtml() +
      '<nav class="nav-links" aria-label="Primary">' + links + "</nav>" +
      '<div class="header-actions">' + actions +
      '<button class="nav-toggle" id="navToggle" type="button" aria-label="Open navigation" aria-controls="mobileSheet" aria-expanded="false" aria-haspopup="dialog">' +
      NT.icon("menu") + "</button></div></div>" +
      '<div class="mobile-sheet" id="mobileSheet" aria-hidden="true" inert>' +
      '<div class="scrim" data-close-sheet aria-hidden="true"></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mobileSheetTitle">' +
      '<div class="sheet-handle" aria-hidden="true"></div>' +
      '<div class="sheet-head"><div><span class="sheet-kicker">' + (signedIn ? "MORE" : "NUCLEAR TUTORIALS") + "</span>" +
      '<h2 id="mobileSheetTitle">' + (signedIn ? "Your learning space" : "Explore the platform") + "</h2></div>" +
      '<button class="modal-x" data-close-sheet type="button" aria-label="Close navigation">' + NT.icon("x") + "</button></div>" +
      '<nav class="sheet-nav" aria-label="More navigation">' + sheetLinks + "</nav>" +
      '<div class="sheet-foot"><p class="sheet-status">' + NT.icon("sparkles") +
      '<span>' + (signedIn ? "Your learning, organized. Learn at your pace and keep moving forward." : "Explore the platform, compare access and choose how to get started.") +
      "</span></p></div></div></div>" +
      publicMoreMenuHtml;

    var header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = html;
    document.body.classList.add("has-mobile-nav");
    document.body.prepend(header);

    var sheet = header.querySelector("#mobileSheet");
    if (sheet) document.body.appendChild(sheet);
    var publicMoreMenu = header.querySelector("#publicMoreMenu");
    var publicMoreScrim = header.querySelector("#publicMoreScrim");
    if (publicMoreMenu) document.body.appendChild(publicMoreMenu);
    if (publicMoreScrim) document.body.appendChild(publicMoreScrim);

    var main = document.querySelector("main");
    if (!main) main = document.querySelector(".page-head, .section-body, section");
    if (main) {
      if (!main.id) main.id = "main";
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    }

    var mobileTemplate = document.createElement("div");
    mobileTemplate.innerHTML = mobileNav;
    var mobileElement = mobileTemplate.firstElementChild;
    if (!mobileElement) {
      mobileElement = document.createElement("nav");
      mobileElement.innerHTML = mobileNav;
    }
    if (main && main.parentNode === document.body && document.body.insertBefore) {
      document.body.insertBefore(mobileElement, main);
    } else {
      document.body.appendChild(mobileElement);
    }

    var toggle = header.querySelector("#navToggle");
    var more = mobileElement.querySelector ? mobileElement.querySelector("#mobileMore") : null;
    var publicMore = mobileElement.querySelector ? mobileElement.querySelector("#publicMore") : null;
    var publicMoreClose = publicMoreMenu ? publicMoreMenu.querySelector("#publicMoreClose") : null;
    var lastTrigger = null;
    var lastPublicTrigger = null;
    var lockedScrollY = 0;
    var bodyStyleBeforeLock = null;
    var htmlOverflowBeforeLock = "";
    var inertBeforeLock = [];

    function lockPageScroll() {
      if (bodyStyleBeforeLock) return;
      var body = document.body;
      var htmlElement = document.documentElement;
      var styleProperties = ["position", "top", "left", "right", "width", "overflow", "paddingRight"];
      bodyStyleBeforeLock = {};
      styleProperties.forEach(function (property) { bodyStyleBeforeLock[property] = body.style[property] || ""; });
      htmlOverflowBeforeLock = htmlElement.style.overflow || "";
      lockedScrollY = typeof window.pageYOffset === "number"
        ? window.pageYOffset
        : (htmlElement.scrollTop || body.scrollTop || 0);

      var viewportWidth = window.innerWidth || 0;
      var documentWidth = htmlElement.clientWidth || viewportWidth;
      var scrollbarWidth = Math.max(0, viewportWidth - documentWidth);
      var existingPadding = window.getComputedStyle
        ? parseFloat(window.getComputedStyle(body).paddingRight) || 0
        : parseFloat(body.style.paddingRight) || 0;

      body.style.position = "fixed";
      body.style.top = "-" + lockedScrollY + "px";
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      if (scrollbarWidth) body.style.paddingRight = (existingPadding + scrollbarWidth) + "px";
      htmlElement.style.overflow = "hidden";
      document.body.classList.add("sheet-locked");
      htmlElement.classList.add("sheet-locked");
    }

    function unlockPageScroll() {
      if (!bodyStyleBeforeLock) return;
      var body = document.body;
      var htmlElement = document.documentElement;
      Object.keys(bodyStyleBeforeLock).forEach(function (property) {
        body.style[property] = bodyStyleBeforeLock[property];
      });
      htmlElement.style.overflow = htmlOverflowBeforeLock;
      document.body.classList.remove("sheet-locked");
      htmlElement.classList.remove("sheet-locked");
      bodyStyleBeforeLock = null;
      if (window.scrollTo) window.scrollTo(0, lockedScrollY);
    }

    function setBackgroundInert(inert) {
      var siblings = Array.prototype.slice.call(document.body.children || []);
      if (inert) {
        inertBeforeLock = [];
        siblings.forEach(function (element) {
          if (element === sheet || element === publicMoreMenu || element === publicMoreScrim || element.tagName === "SCRIPT") return;
          inertBeforeLock.push({ element: element, wasInert: !!element.inert });
          element.inert = true;
        });
      } else {
        inertBeforeLock.forEach(function (entry) { entry.element.inert = entry.wasInert; });
        inertBeforeLock = [];
      }
    }

    function focusableElements() {
      if (!sheet || !sheet.querySelectorAll) return [];
      return Array.prototype.slice.call(sheet.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(function (element) {
        if (element.disabled || (element.getAttribute && element.getAttribute("aria-hidden") === "true")) return false;
        return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
      });
    }

    function publicMoreFocusable() {
      if (!publicMoreMenu || !publicMoreMenu.querySelectorAll) return [];
      return Array.prototype.slice.call(publicMoreMenu.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(function (element) {
        if (element.disabled || (element.getAttribute && element.getAttribute("aria-hidden") === "true")) return false;
        return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
      });
    }

    function syncThemeUI() {
      var pref = NT.theme ? NT.theme.getPreference() : "system";
      document.querySelectorAll("[data-theme-option]").forEach(function (btn) {
        var isChecked = btn.getAttribute("data-theme-option") === pref;
        btn.setAttribute("aria-checked", isChecked ? "true" : "false");
      });
    }

    function setPublicMoreOpen(open, trigger) {
      if (!publicMoreMenu || !publicMoreScrim) return;
      if (publicMoreMenu.classList.contains("open") === open) return;
      if (open) {
        if (sheet && sheet.classList.contains("open")) {
          setOpen(false);
        }
        lastPublicTrigger = trigger || publicMore;
        publicMoreMenu.classList.add("open");
        publicMoreScrim.classList.add("open");
        publicMoreMenu.setAttribute("aria-hidden", "false");
        publicMoreScrim.setAttribute("aria-hidden", "false");
        publicMoreMenu.inert = false;
        if (publicMore) publicMore.setAttribute("aria-expanded", "true");
        syncThemeUI();
        var focusables = publicMoreFocusable();
        var first = focusables[0] || publicMoreClose;
        if (first && first.focus) {
          try { first.focus(); } catch (e) {}
        }
      } else {
        publicMoreMenu.classList.remove("open");
        publicMoreScrim.classList.remove("open");
        publicMoreMenu.setAttribute("aria-hidden", "true");
        publicMoreScrim.setAttribute("aria-hidden", "true");
        publicMoreMenu.inert = true;
        if (publicMore) publicMore.setAttribute("aria-expanded", "false");
        if (lastPublicTrigger && lastPublicTrigger.focus) {
          try { lastPublicTrigger.focus(); } catch (e) {}
        }
      }
    }

    function setOpen(open, trigger) {
      if (!sheet || sheet.classList.contains("open") === open) return;
      if (open) {
        if (publicMoreMenu && publicMoreMenu.classList.contains("open")) {
          setPublicMoreOpen(false);
        }
        lastTrigger = trigger || toggle || more;
        lockPageScroll();
        setBackgroundInert(true);
        sheet.classList.add("open");
        sheet.setAttribute("aria-hidden", "false");
        sheet.inert = false;
        if (toggle) toggle.setAttribute("aria-expanded", "true");
        if (more) more.setAttribute("aria-expanded", "true");
        syncThemeUI();
        var focusables = focusableElements();
        var initialFocus = focusables[0] || null;
        for (var index = 0; index < focusables.length; index++) {
          if (focusables[index].tagName === "A") { initialFocus = focusables[index]; break; }
        }
        if (initialFocus && initialFocus.focus) initialFocus.focus();
      } else {
        sheet.classList.remove("open");
        sheet.setAttribute("aria-hidden", "true");
        sheet.inert = true;
        if (toggle) toggle.setAttribute("aria-expanded", "false");
        if (more) more.setAttribute("aria-expanded", "false");
        setBackgroundInert(false);
        unlockPageScroll();
        if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
      }
    }

    if (toggle) toggle.addEventListener("click", function () { setOpen(!sheet.classList.contains("open"), toggle); });
    if (more) more.addEventListener("click", function () { setOpen(!sheet.classList.contains("open"), more); });
    if (publicMore) publicMore.addEventListener("click", function () { setPublicMoreOpen(!publicMoreMenu.classList.contains("open"), publicMore); });
    if (publicMoreClose) publicMoreClose.addEventListener("click", function () { setPublicMoreOpen(false); });
    if (publicMoreScrim) publicMoreScrim.addEventListener("click", function () { setPublicMoreOpen(false); });
    if (sheet) {
      sheet.querySelectorAll("[data-close-sheet]").forEach(function (element) {
        element.addEventListener("click", function () { setOpen(false); });
      });
      sheet.querySelectorAll(".sheet-nav a").forEach(function (link) {
        link.addEventListener("click", function () { setOpen(false); });
      });
      var sheetLogout = sheet.querySelector("#sheetLogout");
      if (sheetLogout) sheetLogout.addEventListener("click", function () {
        setOpen(false);
        NT.auth.logout().then(function () { location.href = NT.base() + "index.html"; }, function (error) {
          NT.toast(error.message || "You could not be logged out right now.", "error");
        });
      });
    }
    if (publicMoreMenu) {
      publicMoreMenu.querySelectorAll(".public-more-menu-nav a").forEach(function (link) {
        link.addEventListener("click", function () { setPublicMoreOpen(false); });
      });
    }

    function handleThemeOptionClick(event) {
      var btn = event.target.closest ? event.target.closest("[data-theme-option]") : null;
      if (!btn) return;
      var opt = btn.getAttribute("data-theme-option");
      if (!opt) return;
      if (NT.theme) NT.theme.set(opt);
      syncThemeUI();
    }

    document.addEventListener("click", function (event) {
      if (event.target.closest && event.target.closest("[data-theme-option]")) {
        handleThemeOptionClick(event);
      }
    });

    window.addEventListener("nt:themechange", function () { syncThemeUI(); });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (publicMoreMenu && publicMoreMenu.classList.contains("open")) {
          event.preventDefault();
          setPublicMoreOpen(false);
          return;
        }
        if (!sheet || !sheet.classList.contains("open")) return;
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      if (sheet && sheet.classList.contains("open")) {
        var focusables = focusableElements();
        if (!focusables.length) { event.preventDefault(); return; }
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (event.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (publicMoreMenu && publicMoreMenu.classList.contains("open")) {
        var pf = publicMoreFocusable();
        if (!pf.length) { event.preventDefault(); return; }
        var pfirst = pf[0];
        var plast = pf[pf.length - 1];
        if (event.shiftKey && (document.activeElement === pfirst || !publicMoreMenu.contains(document.activeElement))) {
          event.preventDefault();
          plast.focus();
        } else if (!event.shiftKey && (document.activeElement === plast || !publicMoreMenu.contains(document.activeElement))) {
          event.preventDefault();
          pfirst.focus();
        }
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 760) {
        if (publicMoreMenu && publicMoreMenu.classList.contains("open")) setPublicMoreOpen(false);
      }
    });

    if (mobileElement) {
      mobileElement.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          if (publicMoreMenu && publicMoreMenu.classList.contains("open")) setPublicMoreOpen(false);
        });
      });
    }

    if (!signedIn && page === "home" && window.addEventListener) {
      window.addEventListener("hashchange", function () {
        var isHow = location.hash === "#how-it-works";
        var targets = [];
        [header, mobileElement, sheet, publicMoreMenu].forEach(function (root) {
          if (!root || !root.querySelectorAll) return;
          targets = targets.concat(Array.prototype.slice.call(root.querySelectorAll('[data-nav-key="home"], [data-nav-key="how"]')));
        });
        targets.forEach(function (element) {
          var active = element.getAttribute("data-nav-key") === (isHow ? "how" : "home");
          element.classList.toggle("active", active);
          if (active) element.setAttribute("aria-current", "page");
          else element.removeAttribute("aria-current");
        });
      });
    }

    syncThemeUI();
  };

  NT.setHeaderContext = function () { /* kept as a harmless compatibility hook for existing page renderers */ };
  NT.setHeaderContext = function () { /* kept as a harmless compatibility hook for existing page renderers */ };

  /* ---------- footer ---------- */
  /* The two legal documents live at the canonical, extensionless routes
     /privacy-policy and /terms-and-conditions, so the same absolute hrefs work
     from every page that renders the shared footer, including /admin/ pages. */
  var LEGAL_LINKS = [
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/terms-and-conditions", label: "Terms &amp; Conditions" }
  ];
  function legalLink(index, className) {
    var link = LEGAL_LINKS[index];
    return '<a' + (className ? ' class="' + className + '"' : "") +
      ' href="' + link.href + '">' + link.label + "</a>";
  }

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
      legalLink(0) +
      legalLink(1) +
      '<a class="footer-admin-link" href="/admin/login.html">Admin Console</a></div>' +
      learningColumn +
      (contactLink ? '<div class="footer-col"><h4>Contact</h4><a href="mailto:' + encodeURIComponent(supportEmail) + '">' + NT.esc(supportEmail) + "</a></div>" : "") +
      '</div><div class="footer-bottom"><span>© ' + new Date().getFullYear() + " Nuclear Tutorials</span>" +
      '<span class="footer-legal-links">' + legalLink(0) + '<span class="dot-sep" aria-hidden="true">·</span>' + legalLink(1) + "</span>" +
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
