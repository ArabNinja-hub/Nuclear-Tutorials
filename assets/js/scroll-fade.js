/* ============================================================
   NUCLEAR TUTORIALS — Scroll-linked edge dissolve

   Companion to assets/css/scroll-fade.css. It builds the fixed band
   that lets content dissolve into the page background near the
   bottom of the viewport, colours it to match the surface it covers,
   and provides the scroll-position fallback for browsers without CSS
   scroll-driven animations.

   Rules it keeps:
   * scrolling is never intercepted — listeners are passive and no
     wheel, touch or keyboard event is ever cancelled;
   * layout is never read inside the scroll frame (the band's height
     is measured on resize, not while scrolling);
   * the work per frame is a handful of custom-property writes, and
     only in the fallback path;
   * `prefers-reduced-motion: reduce` removes the band entirely.
   ============================================================ */
(function () {
  "use strict";

  /* Scroll distance the band needs to arrive, in CSS pixels. Matches the
     scroll range in scroll-fade.css (`animation-range: 0 120px`). */
  var ARRIVE = 120;
  /* Share of the scroll range over which the band retreats at page end.
     Matches `animation-range: 96% 100%` in the stylesheet. */
  var RECEDE = 0.04;
  /* Scroll distance between surface-colour samples. Colour changes are
     few, so sampling a handful of times per screen is plenty. */
  var SAMPLE_STEP = 96;
  /* Fallbacks if nothing on the page reports a usable background. */
  var FALLBACK_RGB = "6, 23, 35";
  /* Where across the band to look for the surface colour, as fractions
     of the viewport width. Three points are enough to tell the middle of
     a section from an edge; the centre is read first so it also wins any
     tie. */
  var SAMPLE_COLUMNS = [0.5, 0.16, 0.84];

  var layer = null;
  var veil = null;
  var blur = null;
  var motionQuery = null;
  var themeObserver = null;
  var frame = 0;
  var bandHeight = 0;
  var bandCenterY = 0;
  var lastSampleTop = null;
  var bound = false;
  var cssTimeline = false;

  /* ---------- capability checks ---------- */

  function supportsScrollTimeline() {
    var css = window.CSS;
    if (!css || !css.supports) return false;
    try {
      return css.supports("animation-timeline: scroll(root block)") ||
        css.supports("animation-timeline: scroll()");
    } catch (error) {
      return false;
    }
  }

  function reducedMotion() {
    return !!(motionQuery && motionQuery.matches);
  }

  function scrollTop() {
    var root = document.documentElement;
    return window.pageYOffset || (root && root.scrollTop) || 0;
  }

  function maxScroll() {
    var root = document.documentElement;
    var height = root ? root.scrollHeight : 0;
    return Math.max(0, height - window.innerHeight);
  }

  /* ---------- the surface behind the band ---------- */

  /* Computed colours arrive as rgb()/rgba(); anything else (a gradient, an
     image, a modern colour function) is treated as "not a flat surface"
     so the search keeps walking up the tree. */
  function parseColor(value) {
    var match = /^rgba?\(([^)]+)\)$/i.exec(String(value || "").trim());
    if (!match) return null;
    var parts = match[1].split(/[\s,\/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    var r = parseFloat(parts[0]);
    var g = parseFloat(parts[1]);
    var b = parseFloat(parts[2]);
    var a = parts.length > 3 ? parseFloat(parts[3]) : 1;
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) return null;
    return {
      r: Math.round(r),
      g: Math.round(g),
      b: Math.round(b),
      a: isFinite(a) ? a : 1
    };
  }

  /* Walk from a hit-tested element up to the first surface that is
     actually painted: a section's own background, or the page background
     when the section is transparent. */
  function paintedSurface(node) {
    var current = node;
    for (var depth = 0; current && depth < 8; depth++) {
      if (current.nodeType === 1) {
        var color = parseColor(window.getComputedStyle(current).backgroundColor);
        if (color && color.a > 0.55) return color;
      }
      current = current.parentElement;
    }
    return null;
  }

  function colorKey(color) {
    return color.r + "," + color.g + "," + color.b;
  }

  /* Sample three columns across the middle of the band and keep the most
     common answer, so a single card or a rounded panel at one edge cannot
     drag the whole gradient to a different colour. */
  function sampleSurface() {
    if (!layer) return;

    /* No hit-testing support (very old engines): settle for the page
       background rather than leaving a colour that may not match. */
    if (!document.elementsFromPoint) {
      applySurface(paintedSurface(document.body));
      return;
    }

    var y = Math.max(1, Math.min(window.innerHeight - 2, bandCenterY));
    var votes = {};
    var order = [];

    SAMPLE_COLUMNS.forEach(function (fraction) {
      var x = Math.max(1, Math.min(window.innerWidth - 2, window.innerWidth * fraction));
      var stack = document.elementsFromPoint(x, y) || [];
      for (var i = 0; i < stack.length; i++) {
        if (stack[i] === layer || (layer.contains && layer.contains(stack[i]))) continue;
        var color = paintedSurface(stack[i]);
        if (!color) continue;
        var key = colorKey(color);
        if (!votes[key]) {
          votes[key] = { count: 0, color: color };
          order.push(key);
        }
        votes[key].count++;
        break;
      }
    });

    if (!order.length) {
      applySurface(null);
      return;
    }

    var winner = votes[order[0]];
    order.forEach(function (key) {
      if (votes[key].count > winner.count) winner = votes[key];
    });
    applySurface(winner.color);
  }

  /* Only touch the style sheet when the answer actually changes. */
  function applySurface(color) {
    if (!layer) return;
    var next = color ? colorKey(color) : FALLBACK_RGB;
    if (layer.style.getPropertyValue("--nt-fade-rgb").trim() !== next) {
      layer.style.setProperty("--nt-fade-rgb", next);
    }
  }

  /* ---------- the band ---------- */

  /* Measured on resize only — never inside a scroll frame, so scrolling
     cannot trigger a layout read. */
  function measure() {
    if (!layer) return;
    var rect = layer.getBoundingClientRect ? layer.getBoundingClientRect() : null;
    bandHeight = (rect && rect.height) || layer.offsetHeight || 160;
    bandCenterY = rect && rect.height ? rect.top + rect.height / 2 : window.innerHeight - bandHeight / 2;
  }

  /* The fallback drive: one write for the arrival ramp and one for the
     retreat at the end of the page. Scroll timelines do this natively, so
     this only runs when they are unavailable.

     Both values are movements, never opacity: an element with opacity
     below 1 becomes a backdrop root, and the band's backdrop blur would
     stop seeing the page. */
  function paint() {
    if (!layer) return;
    var top = scrollTop();
    var limit = maxScroll();
    var depth = ARRIVE > 0 ? Math.min(1, top / ARRIVE) : 1;
    var recedeStart = limit * (1 - RECEDE);
    var recede = limit > 0 && top > recedeStart && limit > recedeStart
      ? (top - recedeStart) / (limit - recedeStart)
      : 0;
    layer.style.setProperty("--nt-fade-arrive", (Math.round((1 - depth) * 1000) / 10) + "%");
    layer.style.setProperty("--nt-fade-recede", (Math.round(recede * bandHeight * 0.46 * 100) / 100) + "px");
  }

  function onScroll() {
    if (!layer || frame) return;
    frame = window.requestAnimationFrame(function () {
      frame = 0;
      if (!layer) return;
      if (!cssTimeline) paint();
      var top = scrollTop();
      if (lastSampleTop === null || Math.abs(top - lastSampleTop) >= SAMPLE_STEP) {
        lastSampleTop = top;
        sampleSurface();
      }
    });
  }

  function onResize() {
    if (!layer) return;
    measure();
    lastSampleTop = null;
    onScroll();
  }

  function onThemeChange() {
    if (!layer) return;
    lastSampleTop = null;
    onScroll();
  }

  function bind() {
    if (bound) return;
    bound = true;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });
    window.addEventListener("nt:themechange", onThemeChange);
    window.addEventListener("load", onResize);
    if (window.MutationObserver) {
      themeObserver = new MutationObserver(onThemeChange);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
  }

  function unbind() {
    if (!bound) return;
    bound = false;
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    window.removeEventListener("nt:themechange", onThemeChange);
    window.removeEventListener("load", onResize);
    if (themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }
  }

  function mount() {
    if (layer) return;
    if (!document.body) return;
    cssTimeline = supportsScrollTimeline();

    layer = document.createElement("div");
    layer.className = "scroll-fade";
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("data-scroll-fade", "");

    /* Two masked siblings rather than one masked parent: a mask on a
       parent would not clip the child's backdrop blur. */
    veil = document.createElement("span");
    veil.className = "scroll-fade-veil";
    blur = document.createElement("span");
    blur.className = "scroll-fade-blur";
    layer.appendChild(veil);
    layer.appendChild(blur);
    document.body.appendChild(layer);

    bandHeight = 0;
    measure();
    lastSampleTop = null;
    sampleSurface();
    if (!cssTimeline) paint();
    bind();
    onScroll();
  }

  function unmount() {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    unbind();
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = null;
    veil = null;
    blur = null;
    lastSampleTop = null;
    bandHeight = 0;
    bandCenterY = 0;
  }

  /* ---------- lifecycle ---------- */

  function sync() {
    if (reducedMotion()) unmount();
    else {
      mount();
      /* The preference can change in place; the surface colour cannot be
         trusted after it does. */
      onThemeChange();
    }
  }

  function start() {
    if (window.matchMedia) {
      try {
        motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (motionQuery.addEventListener) motionQuery.addEventListener("change", sync);
        else if (motionQuery.addListener) motionQuery.addListener(sync);
      } catch (error) {
        motionQuery = null;
      }
    }
    sync();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
