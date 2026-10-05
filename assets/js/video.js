/* ============================================================
   NUCLEAR TUTORIALS — Video lesson presentation
   ------------------------------------------------------------
   Turns the records returned by the content service into the shared
   video markup used by the library, course pages, watch page and
   dashboard. Provider detection happens on the server, so these
   helpers only format and render — they never guess a source.
   ============================================================ */
(function () {
  window.NT = window.NT || {};

  var PROVIDER_LABEL = {
    youtube: "YouTube",
    vimeo: "Vimeo",
    file: "Video file",
    external: "External link"
  };
  var PROVIDER_ICON = {
    youtube: "play",
    vimeo: "film",
    file: "video",
    external: "external"
  };

  NT.providerLabel = function (provider) {
    return PROVIDER_LABEL[provider] || "Video source";
  };
  NT.providerIcon = function (provider) {
    return PROVIDER_ICON[provider] || "video";
  };

  /* ---------- durations ---------- */
  NT.duration = function (seconds) {
    var total = Number(seconds);
    if (!Number.isFinite(total) || total <= 0) return "";
    total = Math.round(total);
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var rest = total % 60;
    function pad(value) { return String(value).padStart(2, "0"); }
    return hours ? hours + ":" + pad(minutes) + ":" + pad(rest) : minutes + ":" + pad(rest);
  };

  NT.durationWords = function (seconds) {
    var total = Number(seconds);
    if (!Number.isFinite(total) || total <= 0) return "";
    total = Math.round(total);
    var hours = Math.floor(total / 3600);
    var minutes = Math.round((total % 3600) / 60);
    if (hours && minutes) return hours + " hr " + minutes + " min";
    if (hours) return hours + " hr";
    if (minutes) return minutes + " min";
    return "under a minute";
  };

  NT.totalDurationLabel = function (seconds) {
    var words = NT.durationWords(seconds);
    return words ? words + " of video" : "";
  };

  /* ---------- access ---------- */
  /* Videos reuse the existing Basic / Standard / Premium package tiers, so
     the access-code flow keeps deciding what a student may watch. */
  NT.videoLevel = function (video) {
    return (video && video.level) || "basic";
  };
  NT.isVideoUnlocked = function (video) {
    var access = NT.store.get().access;
    if (!access) return false;
    return NT.data.LEVEL_RANK[access] >= NT.data.LEVEL_RANK[NT.videoLevel(video)];
  };
  NT.videoAccessLabel = function (video) {
    return NT.data.LEVEL_LABEL[NT.videoLevel(video)] + " access";
  };

  /* ---------- links ---------- */
  NT.videoHref = function (video) {
    return NT.base() + "video.html?id=" + encodeURIComponent(video.id);
  };
  NT.courseHref = function (course) {
    return NT.base() + "course.html?id=" + encodeURIComponent(course.id);
  };
  NT.universityHref = function (university, semester) {
    var href = NT.base() + "university.html?id=" + encodeURIComponent(university.id);
    return semester ? href + "&semester=" + encodeURIComponent(semester) : href;
  };

  /* University · Semester 1 · Course — the context every video shows so a
     student always knows where a lesson belongs. */
  NT.videoContext = function (video) {
    return [video.universityName, video.semesterLabel, video.courseTitle].filter(Boolean).join(" · ");
  };
  NT.courseContext = function (course) {
    return [course.universityName, course.semesterLabel, course.code].filter(Boolean).join(" · ");
  };

  /* ---------- thumbnails ---------- */
  function initials(text) {
    return String(text || "").trim().split(/\s+/).slice(0, 2).map(function (word) {
      return word.charAt(0).toUpperCase();
    }).join("") || "NT";
  }

  /* The image sits on top of a branded placeholder tile: if a thumbnail is
     missing or fails to load, the tile shows through instead of a broken
     image icon. */
  NT.thumbnailMarkup = function (video) {
    var source = video.thumbnail || "";
    var label = video.courseTitle || video.title || "";
    var fallback =
      '<span class="thumb-fallback" aria-hidden="true">' +
      '<span class="thumb-fallback-mark">' + NT.esc(initials(label)) + "</span>" +
      NT.icon(NT.providerIcon(video.provider), "icon-lg") + "</span>";
    if (!source) return '<span class="thumb-media is-placeholder">' + fallback + "</span>";
    return '<span class="thumb-media">' + fallback +
      '<img src="' + NT.esc(source) + '" alt="" loading="lazy" decoding="async" data-thumb>' +
      "</span>";
  };

  /* Attach real error handlers (CSP blocks inline onerror attributes). */
  NT.watchThumbnails = function (root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    scope.querySelectorAll("img[data-thumb]").forEach(function (image) {
      if (image.dataset.thumbBound) return;
      image.dataset.thumbBound = "1";
      image.addEventListener("error", function () {
        image.classList.add("is-broken");
        var media = image.closest(".thumb-media");
        if (media) media.classList.add("is-placeholder");
      });
    });
  };

  /* ---------- player ---------- */
  NT.playerMarkup = function (video) {
    var title = NT.esc(video.title);
    if (video.provider === "file") {
      return '<div class="player player-file"><video controls preload="metadata" playsinline' +
        (video.thumbnail ? ' poster="' + NT.esc(video.thumbnail) + '"' : "") + '>' +
        '<source src="' + NT.esc(video.url) + '">' +
        "Your browser cannot play this video file. <a href=\"" + NT.esc(video.url) + '" rel="noopener">Download it instead</a>.' +
        "</video></div>";
    }
    if (video.embedUrl && (video.provider === "youtube" || video.provider === "vimeo")) {
      return '<div class="player player-embed"><iframe src="' + NT.esc(video.embedUrl) + '" title="' + title + '"' +
        ' loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen' +
        ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe></div>';
    }
    /* Anything else opens where it is hosted; embedding an unknown origin
       would only produce a blank frame. */
    return '<div class="player player-external">' + NT.thumbnailMarkup(video) +
      '<div class="player-external-copy">' + NT.icon(NT.providerIcon(video.provider), "icon-lg") +
      "<h2>This lesson opens on " + NT.esc(NT.providerLabel(video.provider).toLowerCase()) + "</h2>" +
      '<p>The video is hosted outside Nuclear Tutorials, so it plays in a new tab.</p>' +
      '<a class="btn btn-primary" href="' + NT.esc(video.url) + '" target="_blank" rel="noopener noreferrer">' +
      NT.icon("external") + "Open video lesson</a></div></div>";
  };

  NT.canEmbed = function (video) {
    return video.provider === "file" || (!!video.embedUrl && (video.provider === "youtube" || video.provider === "vimeo"));
  };

  /* ---------- cards ---------- */
  function metaBits(video, options) {
    var bits = [];
    if (video.topic) bits.push('<span class="video-topic">' + NT.esc(video.topic) + "</span>");
    var shown = NT.duration(video.durationSeconds);
    if (shown) bits.push('<span class="video-duration-text">' + NT.icon("clock", "icon-sm") + shown + "</span>");
    if (!options || options.level !== false) {
      bits.push('<span class="badge badge-' + NT.videoLevel(video) + '">' + NT.icon(NT.isVideoUnlocked(video) ? "unlock" : "lock") +
        NT.esc(NT.data.LEVEL_LABEL[NT.videoLevel(video)]) + "</span>");
    }
    return bits.join("");
  }

  /* Modern video card: 16:9 artwork, hover lift, watch state, lock state. */
  NT.videoCard = function (video, options) {
    var opts = options || {};
    var unlocked = NT.isVideoUnlocked(video);
    var watched = NT.progress && NT.progress.watched(video.id);
    var classes = ["video-card", "reveal"];
    if (!unlocked) classes.push("is-locked");
    if (watched) classes.push("is-watched");
    if (opts.current) classes.push("is-current");
    return '<article class="' + classes.join(" ") + '"' + (opts.delay ? ' data-delay="' + opts.delay + '"' : "") + ">" +
      '<a class="video-thumb" href="' + NT.videoHref(video) + '" aria-label="' +
      NT.esc((unlocked ? "Watch " : "View access requirements for ") + video.title) + '">' +
      NT.thumbnailMarkup(video) +
      '<span class="video-thumb-overlay" aria-hidden="true">' + NT.icon(unlocked ? "play" : "lock") + "</span>" +
      (video.durationSeconds ? '<span class="video-duration-chip" aria-hidden="true">' + NT.esc(NT.duration(video.durationSeconds)) + "</span>" : "") +
      (watched ? '<span class="video-watched-chip" title="Watched">' + NT.icon("check-check", "icon-sm") + "</span>" : "") +
      "</a>" +
      '<div class="video-body">' +
      '<div class="video-meta">' + metaBits(video, opts) + "</div>" +
      '<h3 class="video-title"><a href="' + NT.videoHref(video) + '">' + NT.esc(video.title) + "</a></h3>" +
      (opts.context === false ? "" : '<p class="video-context">' + NT.esc(NT.videoContext(video)) + "</p>") +
      (video.description && opts.description !== false
        ? '<p class="video-desc">' + NT.esc(video.description) + "</p>" : "") +
      '<div class="video-actions">' +
      (unlocked
        ? '<a class="btn btn-secondary btn-sm" href="' + NT.videoHref(video) + '">' + NT.icon("circle-play", "icon-sm") + "Watch lesson</a>"
        : '<a class="btn btn-ghost btn-sm" href="' + NT.videoHref(video) + '">' + NT.icon("lock", "icon-sm") + NT.esc(NT.videoAccessLabel(video)) + " required</a>") +
      '<span class="video-provider">' + NT.icon(NT.providerIcon(video.provider), "icon-sm") + NT.esc(NT.providerLabel(video.provider)) + "</span>" +
      "</div></div></article>";
  };

  /* Compact row used in playlists, course outlines and the watch page sidebar. */
  NT.videoRow = function (video, options) {
    var opts = options || {};
    var unlocked = NT.isVideoUnlocked(video);
    var watched = NT.progress && NT.progress.watched(video.id);
    var classes = ["video-row"];
    if (!unlocked) classes.push("is-locked");
    if (watched) classes.push("is-watched");
    if (opts.current) classes.push("is-current");
    var index = opts.index ? '<span class="video-row-index">' + NT.esc(String(opts.index).padStart(2, "0")) + "</span>" : "";
    return '<li class="' + classes.join(" ") + '">' +
      '<a class="video-row-link" href="' + NT.videoHref(video) + '">' + index +
      '<span class="video-row-thumb">' + NT.thumbnailMarkup(video) +
      '<span class="video-row-play" aria-hidden="true">' + NT.icon(unlocked ? "play" : "lock", "icon-sm") + "</span></span>" +
      '<span class="video-row-copy"><b>' + NT.esc(video.title) + "</b>" +
      "<small>" +
      [video.topic ? NT.esc(video.topic) : "", NT.duration(video.durationSeconds), NT.esc(NT.data.LEVEL_LABEL[NT.videoLevel(video)])]
        .filter(Boolean).join(" · ") +
      "</small></span>" +
      (watched ? '<span class="video-row-watched" title="Watched">' + NT.icon("check-check", "icon-sm") + "</span>" : "") +
      (opts.current ? '<span class="video-row-now">Playing</span>' : "") +
      "</a></li>";
  };

  /* Course card used inside a semester: keeps university + semester context
     visible on every card. */
  NT.courseCard = function (course, options) {
    var opts = options || {};
    var subject = NT.subject(course.subjectId);
    var tint = subject ? NT.subjectTint(course.subjectId).tint : "#eef2f6";
    var tintFg = subject ? NT.subjectTint(course.subjectId).tintFg : "#40566d";
    var watched = NT.progress ? NT.progress.watchedInCourse(course.id) : 0;
    var percent = course.videoCount ? Math.round((watched / course.videoCount) * 100) : 0;
    return '<article class="course-card video-course-card reveal"' + (opts.delay ? ' data-delay="' + opts.delay + '"' : "") + ">" +
      '<div class="course-card-head">' +
      '<span class="course-icon" style="--tint:' + tint + ";--tint-fg:" + tintFg + '">' + NT.icon(subject ? subject.icon : "book-open") + "</span>" +
      "<div><h3><a href=\"" + NT.courseHref(course) + "\">" + NT.esc(course.title) + "</a></h3>" +
      '<p class="course-path">' + NT.esc([course.universityName, course.semesterLabel].filter(Boolean).join(" · ")) + "</p></div></div>" +
      '<div class="course-card-body">' +
      (course.code || course.instructor
        ? '<p class="course-card-facts">' +
          (course.code ? "<span>" + NT.icon("hash", "icon-sm") + NT.esc(course.code) + "</span>" : "") +
          (course.instructor ? "<span>" + NT.icon("circle-user", "icon-sm") + NT.esc(course.instructor) + "</span>" : "") + "</p>"
        : "") +
      (course.description ? '<p class="desc">' + NT.esc(course.description) + "</p>" : "") +
      (course.videoCount
        ? '<div class="course-progress" role="img" aria-label="' + watched + " of " + course.videoCount + ' video lessons watched">' +
          '<span class="course-progress-track"><span class="course-progress-fill" style="width:' + percent + '%"></span></span>' +
          "<small>" + (watched ? watched + " of " + course.videoCount + " watched" : "Not started") + "</small></div>"
        : "") +
      '<div class="course-card-foot"><span class="course-card-meta">' +
      (course.videoCount
        ? NT.icon("video", "icon-sm") + "<span class='mono'>" + course.videoCount + "</span> video lesson" + (course.videoCount === 1 ? "" : "s") +
          (course.durationSeconds ? " · " + NT.esc(NT.durationWords(course.durationSeconds)) : "")
        : NT.icon("video", "icon-sm") + "No video lessons yet") +
      "</span>" +
      '<a class="btn btn-secondary btn-sm" href="' + NT.courseHref(course) + '">' +
      (course.videoCount ? "Start learning" : "View course") + NT.icon("arrow-right", "icon-sm") + "</a>" +
      "</div></div></article>";
  };

  /* University card — the first step of course discovery. */
  NT.universityCard = function (university, options) {
    var opts = options || {};
    var accent = university.accent || "#0d7ea4";
    var semester = (university.availableSemesters && university.availableSemesters[0]) || 1;
    function semesterChip(item) {
      return '<span class="uni-semester"><b>Semester ' + item.semester + "</b><small>" +
        item.courses + (item.courses === 1 ? " course" : " courses") + " · " + item.videos +
        (item.videos === 1 ? " video" : " videos") + "</small></span>";
    }
    var chips = (university.semesters || []).filter(function (item) { return item.courses > 0; });
    return '<article class="uni-card reveal"' + (opts.delay ? ' data-delay="' + opts.delay + '"' : "") + ' style="--uni-accent:' + NT.esc(accent) + '">' +
      '<a class="uni-card-link" href="' + NT.universityHref(university, semester) + '" aria-label="Open ' + NT.esc(university.name) + '">' +
      '<span class="uni-mark" aria-hidden="true">' +
      (university.logoUrl
        ? '<img src="' + NT.esc(university.logoUrl) + '" alt="" loading="lazy" data-thumb>'
        : NT.esc(initials(university.shortName || university.name))) +
      "</span>" +
      '<span class="uni-copy"><b>' + NT.esc(university.name) + "</b>" +
      (university.city || university.country
        ? "<small>" + NT.icon("map-pin", "icon-sm") + NT.esc([university.city, university.country].filter(Boolean).join(", ")) + "</small>" : "") +
      (university.description ? '<span class="uni-desc">' + NT.esc(university.description) + "</span>" : "") +
      "</span></a>" +
      '<div class="uni-foot">' +
      (chips.length ? '<div class="uni-semesters">' + chips.map(semesterChip).join("") + "</div>"
        : '<p class="uni-empty">No published courses yet.</p>') +
      '<span class="uni-total">' + NT.icon("video", "icon-sm") + "<b>" + (university.videoCount || 0) + "</b> video lessons</span>" +
      '<a class="btn btn-secondary btn-sm" href="' + NT.universityHref(university, semester) + '">Choose semester' + NT.icon("arrow-right", "icon-sm") + "</a>" +
      "</div></article>";
  };
})();
