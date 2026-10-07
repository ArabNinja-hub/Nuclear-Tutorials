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

    function typeNextCharacter() {
      if (!isCurrentCycle(generation)) return;

      position += 1;
      textNode.nodeValue = phrase.slice(0, position);
      if (position === phrase.length) {
        text.classList.remove("is-typing");
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
