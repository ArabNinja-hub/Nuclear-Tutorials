(function () {
  "use strict";

  var text = document.querySelector(".hero-home [data-hero-rotator]");
  if (!text) return;

  // Keep the mounted rotator and its text node in place; only change the text data.
  var textNode = text.firstChild;
  if (!textNode || textNode.nodeType !== 3) {
    textNode = document.createTextNode("");
    text.insertBefore(textNode, text.firstChild);
  }

  var phrases = [
    "Stay ahead.",
    "Stay focused.",
    "Stay prepared.",
    "Keep improving.",
    "Reach further."
  ];
  var reducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  var timer = null;
  var cycle = 0;
  var typeDelay = 68;
  var deleteDelay = 38;
  var phraseHold = 2000;

  /* The rotator is centred over the fixed slot, so a growing phrase would
     otherwise be re-centred on every keystroke and slide sideways across the
     headline. Pin the running text to the spot the completed phrase will
     occupy: measure the typed text, the full phrase and the caret, then shift
     the rotator by half the difference. The caret then advances in place, a
     finished phrase stays centred, and deleting pulls characters off the
     right edge instead of dragging the word around. */
  var probe = null;

  function measureText(value) {
    if (!probe) {
      probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.whiteSpace = "nowrap";
      text.parentNode.appendChild(probe);
    }
    probe.textContent = value;
    return probe.getBoundingClientRect().width;
  }

  function caretFootprint() {
    if (!window.getComputedStyle) return 0;
    var style = window.getComputedStyle(text, "::after");
    return (parseFloat(style.width) || 0) + (parseFloat(style.marginLeft) || 0);
  }

  function pinToPhrase(phrase, withCaret) {
    var fullWidth = measureText(phrase);
    var typedWidth = measureText(textNode.nodeValue);
    var caret = withCaret ? caretFootprint() : 0;
    var shift = (typedWidth + caret - fullWidth) / 2;
    text.style.transform = shift ? "translateX(" + shift + "px)" : "";
  }

  function clearTimer() {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function isCurrentCycle(generation) {
    return generation === cycle && !(reducedMotion && reducedMotion.matches);
  }

  function typePhrase(index, generation) {
    if (!isCurrentCycle(generation)) return;

    var phrase = phrases[index];
    var position = 0;
    textNode.nodeValue = "";
    text.classList.remove("is-erasing");
    text.classList.add("is-typing");
    pinToPhrase(phrase, true);

    function typeNextCharacter() {
      if (!isCurrentCycle(generation)) return;

      position += 1;
      textNode.nodeValue = phrase.slice(0, position);
      pinToPhrase(phrase, true);
      if (position === phrase.length) {
        text.classList.remove("is-typing");
        text.style.transform = "";
        timer = window.setTimeout(function () {
          erasePhrase(index, generation);
        }, phraseHold);
        return;
      }
      timer = window.setTimeout(typeNextCharacter, typeDelay);
    }

    typeNextCharacter();
  }

  function erasePhrase(index, generation) {
    if (!isCurrentCycle(generation)) return;

    var phrase = phrases[index];
    var position = phrase.length;
    text.classList.remove("is-typing");
    text.classList.add("is-erasing");

    function deleteNextCharacter() {
      if (!isCurrentCycle(generation)) return;

      position -= 1;
      textNode.nodeValue = phrase.slice(0, position);
      pinToPhrase(phrase, false);
      if (position === 0) {
        text.classList.remove("is-erasing");
        timer = window.setTimeout(function () {
          typePhrase((index + 1) % phrases.length, generation);
        }, 120);
        return;
      }
      timer = window.setTimeout(deleteNextCharacter, deleteDelay);
    }

    deleteNextCharacter();
  }

  function showStaticPhrase() {
    cycle += 1;
    clearTimer();
    text.classList.remove("is-typing", "is-erasing");
    textNode.nodeValue = phrases[0];
    text.style.transform = "";
  }

  function startCycle() {
    if (reducedMotion && reducedMotion.matches) {
      showStaticPhrase();
      return;
    }

    cycle += 1;
    clearTimer();
    typePhrase(0, cycle);
  }

  if (reducedMotion) {
    var onMotionPreferenceChange = function (event) {
      if (event.matches) showStaticPhrase();
      else startCycle();
    };
    if (reducedMotion.addEventListener) {
      reducedMotion.addEventListener("change", onMotionPreferenceChange);
    } else if (reducedMotion.addListener) {
      reducedMotion.addListener(onMotionPreferenceChange);
    }
  }

  if (reducedMotion && reducedMotion.matches) showStaticPhrase();
  else startCycle();
})();
