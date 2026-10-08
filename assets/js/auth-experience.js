/* ============================================================
   NUCLEAR TUTORIALS — Seamless account screen switching
   Keeps /login[.html] and /signup[.html] as real, shareable routes
   while swapping the already-rendered forms without a page reload.
   ============================================================ */
(function () {
  function ready() {
    var root = document.querySelector("[data-auth-root]");
    if (!root) return;

    var stage = root.querySelector("[data-auth-stage]");
    var panels = {};
    Array.prototype.forEach.call(root.querySelectorAll("[data-auth-panel]"), function (panel) {
      panels[panel.getAttribute("data-auth-panel")] = panel;
    });
    if (!stage || !panels.login || !panels.signup) return;

    var activeMode = modeFromPath(location.pathname) || document.body.dataset.page || root.dataset.mode || "login";
    var activePanel = panels[activeMode] || panels.login;
    var transitionTimer = null;
    var transitionFrame = null;

    function modeFromPath(pathname) {
      var segment = String(pathname || "").replace(/\/$/, "").split("/").pop() || "";
      if (/^signup(?:\.html)?$/i.test(segment)) return "signup";
      if (/^login(?:\.html)?$/i.test(segment)) return "login";
      return "";
    }

    function reducedMotion() {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    function syncDocument(mode) {
      document.body.dataset.page = mode;
      root.dataset.mode = mode;
      document.title = mode === "signup" ? "Create Account — Nuclear Tutorials" : "Log In — Nuclear Tutorials";

      var description = document.querySelector('meta[name="description"]');
      if (description) {
        description.setAttribute("content", mode === "signup"
          ? "Create a Nuclear Tutorials account and organize your learning in one focused space."
          : "Log in to your Nuclear Tutorials learning space and continue where you left off.");
      }

      var accountLinks = document.querySelectorAll('[data-nav-key="login"], [data-nav-key="signup"]');
      Array.prototype.forEach.call(accountLinks, function (link) {
        var selected = link.getAttribute("data-nav-key") === mode;
        link.classList.toggle("active", selected);
        if (selected) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    }

    function focusHeading(panel) {
      var heading = panel && panel.querySelector("h1");
      if (!heading || !heading.focus) return;
      try { heading.focus({ preventScroll: true }); }
      catch (error) { heading.focus(); }
    }

    function finishTransition(shouldFocus) {
      if (transitionTimer) {
        window.clearTimeout(transitionTimer);
        transitionTimer = null;
      }
      if (transitionFrame !== null) {
        if (window.cancelAnimationFrame) window.cancelAnimationFrame(transitionFrame);
        transitionFrame = null;
      }
      Object.keys(panels).forEach(function (mode) {
        var panel = panels[mode];
        var isActive = mode === activeMode;
        panel.classList.remove("is-entering", "is-leaving");
        panel.hidden = !isActive;
        panel.inert = !isActive;
        panel.setAttribute("aria-hidden", isActive ? "false" : "true");
      });
      stage.classList.remove("is-animating");
      stage.style.height = "";
      activePanel = panels[activeMode];
      if (shouldFocus) focusHeading(activePanel);
    }

    function routeFor(mode) {
      var url = new URL(mode + ".html", location.href);
      url.search = location.search;
      url.hash = location.hash;
      return url.pathname + url.search + url.hash;
    }

    function setMode(nextMode, options) {
      options = options || {};
      if (!panels[nextMode]) return;
      if (nextMode === activeMode) {
        syncDocument(nextMode);
        return;
      }

      if (transitionTimer) finishTransition(false);
      var outgoing = activePanel || panels[activeMode];
      var incoming = panels[nextMode];
      activeMode = nextMode;
      syncDocument(nextMode);

      if (options.pushHistory && window.history && window.history.pushState) {
        try {
          window.history.pushState({ authMode: nextMode }, "", routeFor(nextMode));
        } catch (error) {
          /* The anchor remains a normal link if this page cannot update history. */
        }
      }

      if (reducedMotion()) {
        finishTransition(!!options.focus);
        return;
      }

      var fromHeight = outgoing.getBoundingClientRect
        ? outgoing.getBoundingClientRect().height
        : outgoing.offsetHeight;
      if (!fromHeight) fromHeight = outgoing.scrollHeight || 0;

      incoming.hidden = false;
      incoming.inert = false;
      incoming.setAttribute("aria-hidden", "false");
      incoming.classList.add("is-entering");

      outgoing.hidden = false;
      outgoing.inert = true;
      outgoing.setAttribute("aria-hidden", "true");
      outgoing.classList.add("is-leaving");

      root.style.setProperty("--auth-exit-x", nextMode === "signup" ? "-11px" : "11px");
      root.style.setProperty("--auth-enter-x", nextMode === "signup" ? "11px" : "-11px");
      stage.style.height = Math.ceil(fromHeight) + "px";
      stage.classList.add("is-animating");
      void stage.offsetHeight;

      var targetHeight = incoming.scrollHeight || incoming.offsetHeight || fromHeight;
      transitionFrame = window.requestAnimationFrame(function () {
        transitionFrame = null;
        if (activeMode !== nextMode) return;
        incoming.classList.remove("is-entering");
        stage.style.height = Math.ceil(targetHeight) + "px";
      });

      transitionTimer = window.setTimeout(function () {
        finishTransition(!!options.focus);
      }, 300);

    }

    function linkMode(anchor) {
      var declared = anchor.getAttribute("data-auth-switch") || anchor.getAttribute("data-nav-key");
      if (declared === "login" || declared === "signup") return declared;
      if (!anchor.href) return "";
      try {
        var url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin) return "";
        return modeFromPath(url.pathname);
      } catch (error) { return ""; }
    }

    document.addEventListener("click", function (event) {
      if (!event.target || !event.target.closest) return;
      var anchor = event.target.closest("a");
      if (!anchor) return;
      var nextMode = linkMode(anchor);
      if (!nextMode) return;
      if ((event.button != null && event.button !== 0) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (!window.history || !window.history.pushState) return;

      event.preventDefault();
      if (nextMode !== activeMode) setMode(nextMode, { pushHistory: true, focus: true });
    });

    window.addEventListener("popstate", function () {
      var mode = modeFromPath(location.pathname);
      if (mode && mode !== activeMode) setMode(mode, { focus: true });
    });

    Array.prototype.forEach.call(root.querySelectorAll("[data-password-toggle]"), function (button) {
      var input = document.getElementById(button.getAttribute("aria-controls"));
      var iconHost = button.querySelector("[data-password-icon]");
      if (!input || !iconHost) return;

      function updatePasswordVisibility(visible) {
        input.type = visible ? "text" : "password";
        button.setAttribute("aria-pressed", visible ? "true" : "false");
        button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
        iconHost.innerHTML = NT.icon(visible ? "eye-off" : "eye", "icon-sm");
      }

      updatePasswordVisibility(false);
      button.addEventListener("click", function () {
        updatePasswordVisibility(input.type === "password");
      });
    });

    /* ---- appearance toggle (the focused auth pages have no site header) ---- */
    var themeButton = document.querySelector("[data-auth-theme-toggle]");
    if (themeButton && window.NT && NT.theme) {
      var syncAuthTheme = function () {
        var effective = NT.theme.getEffective();
        var next = effective === "dark" ? "light" : "dark";
        themeButton.innerHTML = NT.icon(effective === "dark" ? "sun" : "moon", "icon-sm");
        themeButton.setAttribute("aria-label", "Switch to the " + next + " theme");
      };
      themeButton.addEventListener("click", function () {
        NT.theme.set(NT.theme.getEffective() === "dark" ? "light" : "dark");
        syncAuthTheme();
      });
      window.addEventListener("nt:themechange", syncAuthTheme);
      syncAuthTheme();
    }

    /* ---- "Forgot password?" disclosure ---- */
    var forgotToggle = root.querySelector("[data-forgot-toggle]");
    var forgotHelp = document.getElementById("forgotHelp");
    if (forgotToggle && forgotHelp) {
      forgotToggle.addEventListener("click", function () {
        var open = forgotHelp.hidden;
        forgotHelp.hidden = !open;
        forgotToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    /* ---- point support links at the configured support email ---- */
    var settings = window.NT && NT.store && NT.store.settings ? NT.store.settings() : null;
    var supportEmail = settings ? String(settings.supportEmail || "").trim() : "";
    if (supportEmail) {
      Array.prototype.forEach.call(document.querySelectorAll("[data-support-email]"), function (link) {
        link.href = "mailto:" + encodeURIComponent(supportEmail) +
          "?subject=" + encodeURIComponent("Password reset request — Nuclear Tutorials");
      });
    }

    finishTransition(false);
    syncDocument(activeMode);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
