/* ============================================================
   NUCLEAR TUTORIALS — Administrator workspace
   ------------------------------------------------------------
   Two kinds of tools live here:

     1. Content management (universities, semesters, courses and
        video lessons). These write to the server database, so
        every student device sees the change immediately.
        Sign-in is required: the server rejects every write
        without a valid session, and /admin/* is redirected to
        the sign-in page.

     2. Local preview settings (package copy and prices, access
        codes, lesson access overrides, announcements). These
        stay in the administrator's own browser exactly as before
        and are labelled as previews wherever they appear.
   ============================================================ */
(function () {
  var D = NT.data;
  var NAV = [
    { id: "home", label: "Overview", href: "index.html", icon: "layout-dashboard", group: "Overview" },
    { id: "universities", label: "Universities", href: "universities.html", icon: "building", group: "Video content" },
    { id: "courses", label: "Courses", href: "courses.html", icon: "book-open", group: "Video content" },
    { id: "videos", label: "Video lessons", href: "videos.html", icon: "video", group: "Video content" },
    { id: "announcements", label: "Announcements", href: "announcements.html", icon: "bell", group: "Video content" },
    { id: "lessons", label: "Lesson access", href: "lessons.html", icon: "lock", group: "Access & packages" },
    { id: "packages", label: "Access packages", href: "packages.html", icon: "layers", group: "Access & packages" },
    { id: "codes", label: "Access codes", href: "codes.html", icon: "key", group: "Access & packages" },
    { id: "settings", label: "Settings", href: "settings.html", icon: "settings", group: "System" }
  ];
  var TITLES = {
    home: "Overview",
    universities: "Universities",
    courses: "Courses",
    videos: "Video lessons",
    lessons: "Lesson access",
    announcements: "Announcements",
    packages: "Access packages",
    codes: "Access codes",
    settings: "Settings",
    login: "Administrator sign-in"
  };
  /* Pages that only touch this browser, so they say so explicitly. */
  var LOCAL_PAGES = { lessons: 1, packages: 1, codes: 1, announcements: 1 };
  var sessionAdmin = null;

  function renderShell() {
    var page = document.body.dataset.admin || "home";
    var sidebar = document.createElement("aside");
    sidebar.className = "admin-side";
    sidebar.id = "adminSide";
    sidebar.innerHTML =
      '<div class="side-brand"><a class="brand" href="index.html">' + NT.logoImg("brand-logo") +
      '<span><span class="brand-name">Nuclear <span>Tutorials</span></span><span class="brand-sub">Administrator</span></span></a></div>' +
      '<nav class="side-nav">' + NAV.map(function (item, index) {
        var heading = index === 0 || NAV[index - 1].group !== item.group
          ? '<span class="side-label">' + NT.esc(item.group) + "</span>" : "";
        return heading + '<a href="' + item.href + '" class="' + (page === item.id ? "active" : "") + '"' +
          (page === item.id ? ' aria-current="page"' : "") + ">" + NT.icon(item.icon) + NT.esc(item.label) + "</a>";
      }).join("") +
      '<span class="side-label">Public site</span><a href="../index.html">' + NT.icon("external") + "View student site</a>" +
      '<a href="../universities.html">' + NT.icon("building") + "Universities</a>" +
      '<a href="../library.html">' + NT.icon("video") + "Video library</a></nav>";
    document.body.prepend(sidebar);

    var main = document.createElement("div");
    main.className = "admin-main";
    main.innerHTML =
      '<a class="skip-link" href="#adminContent">Skip to admin content</a>' +
      '<div class="admin-top"><button class="admin-burger" id="admBurger" type="button" aria-label="Open admin menu" aria-controls="adminSide" aria-expanded="false">' + NT.icon("menu") + "</button>" +
      '<div><div class="crumb">Administrator</div><h1>' + NT.esc(TITLES[page] || "Overview") + "</h1></div>" +
      '<div class="spacer"></div>' +
      (LOCAL_PAGES[page]
        ? '<span class="badge badge-warn">' + NT.icon("info") + "This browser only</span>"
        : '<span class="badge badge-success">' + NT.icon("database") + "Server database</span>") +
      '<span class="admin-account" id="adminAccount"></span>' +
      '<button class="btn btn-sm btn-ghost" type="button" id="adminSignOut">' + NT.icon("log-out", "icon-sm") + "Sign out</button>" +
      '<a class="btn btn-sm btn-secondary" href="../index.html">' + NT.icon("external", "icon-sm") + "Student site</a></div>" +
      '<main class="admin-content" id="adminContent" tabindex="-1"></main>' +
      '<div class="admin-foot"><span>Nuclear Tutorials</span>' +
      "<span>Universities, semesters, courses and video lessons are stored in the server database. " +
      "Package copy, access codes, lesson access overrides and announcements remain local preview tools.</span></div>";
    document.body.appendChild(main);

    var scrim = document.createElement("div");
    scrim.className = "scrim-side";
    document.body.appendChild(scrim);
    var burger = document.getElementById("admBurger");
    function setSideOpen(open) {
      document.body.classList.toggle("side-open", open);
      burger.setAttribute("aria-expanded", String(open));
    }
    burger.addEventListener("click", function () { setSideOpen(!document.body.classList.contains("side-open")); });
    scrim.addEventListener("click", function () { setSideOpen(false); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("side-open")) setSideOpen(false);
    });

    var signOut = document.getElementById("adminSignOut");
    if (signOut) signOut.addEventListener("click", function () { signOutNow(); });
    return document.getElementById("adminContent");
  }

  function setAccountChip(admin) {
    var chip = document.getElementById("adminAccount");
    if (!chip || !admin) return;
    chip.innerHTML = NT.icon("circle-user", "icon-sm") +
      "<span><b>" + NT.esc(admin.name || admin.email) + "</b><small>" + NT.esc(admin.email) + "</small></span>";
  }

  function signOutNow() {
    NT.api.post("api/admin/logout", {}).then(function () {
      NT.toast("Signed out", "success");
      location.href = "login.html";
    }, function (error) {
      NT.toast(NT.api.message(error, "Could not sign out"), "error");
    });
  }

  /* Every admin route runs inside this gate. The server also refuses
     unauthenticated writes and redirects /admin/* requests, so this is the
     second layer rather than the only one. */
  function requireAdmin(root, render) {
    var cached = NT.api.peek("api/admin/session");
    if (cached && cached.admin) {
      sessionAdmin = cached.admin;
      setAccountChip(cached.admin);
      render(cached.admin);
      return;
    }
    root.innerHTML = '<div class="adm-card"><div class="adm-card-body">' + NT.spinner("Checking sign-in") + "</div></div>";
    NT.api.load("api/admin/session", function (data) {
      if (data && data.admin) {
        sessionAdmin = data.admin;
        setAccountChip(data.admin);
        render(data.admin);
        return;
      }
      showSignInNotice(root);
    }, function (error) {
      showSignInNotice(root, error);
    });
  }

  function showSignInNotice(root, error) {
    var next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
    root.innerHTML =
      '<div class="adm-card admin-gate-card"><div class="adm-card-body">' +
      '<span class="admin-gate-icon">' + NT.icon("lock", "icon-xl") + "</span>" +
      "<h2>Administrator sign-in required</h2>" +
      "<p>" + NT.esc(error && NT.api.unreachable(error)
        ? "The content service is not reachable, so sign-in cannot be checked. Start the server with `npm start`, then try again."
        : "Sign in to manage universities, semesters, courses and video lessons. Students never see this area.") + "</p>" +
      '<a class="btn btn-primary" href="login.html?next=' + next + '">' + NT.icon("key") + "Go to sign-in</a>" +
      '<a class="btn btn-ghost" href="../index.html">' + NT.icon("external") + "Student site</a>" +
      "</div></div>";
  }

  /* ---------- shared admin helpers ---------- */
  function statusBadge(status) {
    var published = status === "published";
    return '<span class="badge ' + (published ? "badge-success" : "badge-warn") + '">' +
      NT.icon(published ? "eye" : "eye-off") + NT.esc(published ? "Published" : "Draft") + "</span>";
  }

  function applyFieldErrors(scope, error) {
    var fields = NT.api.fieldErrors(error);
    Object.keys(fields).forEach(function (name) {
      var input = scope.querySelector("[data-field='" + name + "']");
      if (!input) return;
      var wrapper = input.closest ? input.closest(".field") : null;
      if (!wrapper) return;
      var existing = wrapper.querySelector(".field-error");
      if (existing) existing.remove();
      var note = document.createElement("span");
      note.className = "field-error";
      note.innerHTML = NT.icon("circle-alert", "icon-sm") + NT.esc(fields[name]);
      wrapper.appendChild(note);
      input.classList.add("input-invalid");
    });
  }

  function busy(button, label) {
    if (!button) return;
    button.disabled = true;
    button.dataset.label = button.innerHTML;
    button.innerHTML = '<span class="spinner spinner-inline">' + NT.icon("loader") +
      "<span>" + NT.esc(label || "Saving") + "\u2026</span></span>";
  }

  function notBusy(button) {
    if (!button) return;
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }

  function selectOptions(items, selected, placeholder) {
    return '<option value="">' + NT.esc(placeholder || "Choose…") + "</option>" + items.map(function (item) {
      return '<option value="' + NT.esc(item.value) + '"' + (String(selected) === String(item.value) ? " selected" : "") + ">" +
        NT.esc(item.label) + "</option>";
    }).join("");
  }

  function semesterOptions(selected) {
    return D.SEMESTERS.map(function (item) {
      return '<option value="' + item.id + '"' + (String(selected) === String(item.id) ? " selected" : "") + ">" + NT.esc(item.label) + "</option>";
    }).join("");
  }

  function levelOptions(selected) {
    return D.LEVELS.map(function (level) {
      return '<option value="' + level + '"' + (selected === level ? " selected" : "") + ">" + NT.esc(D.LEVEL_LABEL[level]) + "</option>";
    }).join("");
  }

  function statusOptions(selected) {
    return ["published", "draft"].map(function (status) {
      return '<option value="' + status + '"' + (selected === status ? " selected" : "") + ">" +
        (status === "published" ? "Published — students can see it" : "Draft — hidden from students") + "</option>";
    }).join("");
  }

  function confirmDialog(options, onConfirm) {
    var modal = NT.modal({
      title: options.title,
      body: "<p class='muted'>" + options.body + "</p>" + (options.extra || ""),
      footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
        '<button class="btn ' + (options.danger === false ? "btn-primary" : "btn-danger-soft") + '" id="confirmAction">' +
        NT.esc(options.confirmLabel || "Confirm") + "</button>"
    });
    modal.querySelector("#confirmAction").addEventListener("click", function () {
      modal.close();
      onConfirm();
    });
    return modal;
  }

  function moveButtons(entity, id, options) {
    var canUp = !options || options.canUp !== false;
    var canDown = !options || options.canDown !== false;
    return '<span class="row-order">' +
      '<button class="btn-icon-sm" type="button" data-move="up" data-entity="' + entity + '" data-id="' + NT.esc(id) + '"' +
      (canUp ? "" : " disabled") + ' aria-label="Move up">' + NT.icon("arrow-up", "icon-sm") + "</button>" +
      '<button class="btn-icon-sm" type="button" data-move="down" data-entity="' + entity + '" data-id="' + NT.esc(id) + '"' +
      (canDown ? "" : " disabled") + ' aria-label="Move down">' + NT.icon("arrow-down", "icon-sm") + "</button></span>";
  }

  function bindMoveButtons(root, entityPath, after) {
    root.querySelectorAll("[data-move]").forEach(function (button) {
      button.addEventListener("click", function () {
        button.disabled = true;
        NT.api.move(entityPath(button.dataset.id), button.dataset.move).then(function () {
          NT.toast("Order updated", "success");
          after();
        }, function (error) {
          NT.toast(NT.api.message(error, "Could not reorder"), "error");
          button.disabled = false;
        });
      });
    });
  }

  function badge(status) {
    var classes = { unused: "badge-outline", redeemed: "badge-warn", published: "badge-success", draft: "badge-warn" };
    var icons = { unused: "key", redeemed: "check", published: "check-circle", draft: "pencil" };
    return '<span class="badge ' + (classes[status] || "badge-outline") + '">' + NT.icon(icons[status] || "info") + NT.esc(NT.cap(status || "draft")) + "</span>";
  }

  /* ============================ OVERVIEW ============================
     Every number here is a real count from the server database. Nothing is
     estimated, simulated or invented. */
  function pageHome(root) {
    root.innerHTML =
      '<div class="adm-card"><div class="adm-card-head"><h2>Content overview</h2></div>' +
      '<div class="adm-card-body"><p class="muted">Universities, semesters, courses and video lessons are stored in the server database, ' +
      "so every student device sees a change as soon as you save it. Package copy and prices, access codes, lesson access overrides and " +
      "announcements remain local preview tools in this browser; no payment processor is connected.</p></div></div>" +
      '<div id="adminOverview">' + NT.loadingState({ count: 2, kind: "rows", label: "Loading overview" }) + "</div>" +
      '<div class="adm-grid preview-admin-grid">' +
      '<a class="adm-card admin-action-card" href="universities.html"><span class="admin-action-icon">' + NT.icon("building") + "</span><h3>Universities</h3><p>Add the institutions students choose from.</p></a>" +
      '<a class="adm-card admin-action-card" href="courses.html"><span class="admin-action-icon">' + NT.icon("book-open") + "</span><h3>Courses</h3><p>Place courses in Semester 1 or Semester 2.</p></a>" +
      '<a class="adm-card admin-action-card" href="videos.html"><span class="admin-action-icon">' + NT.icon("video") + "</span><h3>Video lessons</h3><p>Add, reorder, publish and edit video lessons.</p></a>" +
      '<a class="adm-card admin-action-card" href="lessons.html"><span class="admin-action-icon">' + NT.icon("lock") + "</span><h3>Lesson access</h3><p>Set the package level for each outline lesson.</p></a>" +
      '<a class="adm-card admin-action-card" href="codes.html"><span class="admin-action-icon">' + NT.icon("key") + "</span><h3>Access codes</h3><p>Generate preview codes for this browser.</p></a>" +
      '<a class="adm-card admin-action-card" href="settings.html"><span class="admin-action-icon">' + NT.icon("settings") + "</span><h3>Settings</h3><p>Admin sign-in, support contact and access period.</p></a>" +
      "</div>";

    var host = document.getElementById("adminOverview");
    NT.api.load("api/admin/overview", function (data) {
      var metrics =
        '<div class="adm-metrics">' +
        NT.metric({ icon: "building", value: data.universities, label: "universities (" + data.publishedUniversities + " published)" }) +
        NT.metric({ icon: "book-open", value: data.courses, label: "courses (" + data.publishedCourses + " published)" }) +
        NT.metric({ icon: "video", value: data.videos, label: "video lessons (" + data.publishedVideos + " published)" }) +
        NT.metric({ icon: "clock", value: NT.durationWords(data.durationSeconds) || "0 min", label: "published runtime" }) +
        NT.metric({ icon: "calendar-days", value: data.semester1Courses + " / " + data.semester2Courses, label: "courses in Semester 1 / 2" }) +
        NT.metric({ icon: "pencil", value: data.draftVideos, label: "draft video lessons" }) +
        "</div>";

      var checklist =
        '<section class="adm-card"><div class="adm-card-head"><h2>Getting started</h2>' +
        '<span class="sub">Only real steps — each one switches off when it is done.</span></div>' +
        '<div class="adm-card-body"><ol class="adm-checklist">' +
        data.checklist.map(function (item, index) {
          return '<li class="' + (item.done ? "is-done" : "") + '">' +
            '<span class="adm-checklist-mark">' + NT.icon(item.done ? "check-circle" : "circle-alert") + "</span>" +
            "<span><b>" + (index + 1) + ". " + NT.esc(item.label) + "</b>" +
            "<small>" + (item.done ? "Done" : "Still to do") + "</small></span>" +
            (item.done ? "" : '<a class="btn btn-sm btn-secondary" href="' + item.href + '">Open</a>') + "</li>";
        }).join("") + "</ol></div></section>";

      var levelRow = data.byLevel.map(function (item) {
        return '<span class="badge badge-' + item.level + '">' + NT.icon("shield") + NT.esc(D.LEVEL_LABEL[item.level]) + " · " + item.count + "</span>";
      }).join(" ");

      var universityTable =
        '<section class="adm-card"><div class="adm-card-head"><h2>Content by university</h2>' +
        '<span class="sub">Published video lessons by access tier: ' + levelRow + "</span></div>" +
        (data.byUniversity.length
          ? '<div class="table-wrap"><table class="nt-table"><thead><tr><th>University</th><th>Status</th><th>Courses</th><th>Video lessons</th><th></th></tr></thead><tbody>' +
            data.byUniversity.map(function (item) {
              return '<tr><td class="td-strong" data-label="University">' + NT.esc(item.name) + "</td>" +
                '<td data-label="Status">' + statusBadge(item.status) + "</td>" +
                '<td data-label="Courses">' + item.courses + "</td>" +
                '<td data-label="Video lessons">' + item.videos + "</td>" +
                '<td data-label="Open"><a class="btn btn-sm btn-secondary" href="videos.html?university=' + encodeURIComponent(item.id) + '">' +
                NT.icon("video", "icon-sm") + "Manage videos</a></td></tr>";
            }).join("") + "</tbody></table></div>"
          : '<div class="adm-card-body">' + NT.emptyState({
            compact: true, icon: "building", title: "No universities yet",
            body: "Add your first university to start building the catalogue.",
            action: { href: "universities.html", label: "Add a university", icon: "plus" }
          }) + "</div>") +
        "</section>";

      var recent =
        '<section class="adm-card"><div class="adm-card-head"><h2>Recently updated video lessons</h2></div>' +
        (data.recentVideos.length
          ? '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Video lesson</th><th>Course</th><th>Semester</th><th>University</th><th>Tier</th><th>Status</th></tr></thead><tbody>' +
            data.recentVideos.map(function (video) {
              return '<tr><td class="td-strong" data-label="Video lesson">' + NT.esc(video.title) + "</td>" +
                '<td data-label="Course">' + NT.esc(video.courseTitle) + "</td>" +
                '<td data-label="Semester">' + NT.esc(video.semesterLabel || "—") + "</td>" +
                '<td data-label="University">' + NT.esc(video.universityName) + "</td>" +
                '<td data-label="Tier">' + NT.levelBadge(video.level) + "</td>" +
                '<td data-label="Status">' + statusBadge(video.status) + "</td></tr>";
            }).join("") + "</tbody></table></div>"
          : '<div class="adm-card-body"><p class="muted">No video lessons have been added yet.</p></div>') +
        "</section>";

      host.innerHTML = metrics + checklist + universityTable + recent;
    }, function (error) {
      host.innerHTML = NT.errorState(NT.api.message(error), { title: "Cannot load the overview" });
      var retry = host.querySelector("[data-retry]");
      if (retry) retry.addEventListener("click", function () {
        NT.api.forget("api/admin/overview");
        pageHome(root);
      });
    });
  }

  /* ============================ UNIVERSITIES ============================ */
  function universityFormFields(prefix, university) {
    var record = university || {};
    return '' +
      '<div class="field"><label for="' + prefix + 'Name">University name</label>' +
      '<input class="input" id="' + prefix + 'Name" data-field="name" maxlength="120" required value="' + NT.esc(record.name || "") + '" placeholder="University of Zambia"></div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="' + prefix + 'Short">Abbreviation <span class="muted">(optional)</span></label>' +
      '<input class="input" id="' + prefix + 'Short" data-field="shortName" maxlength="24" value="' + NT.esc(record.shortName || "") + '" placeholder="UNZA">' +
      '<span class="field-hint">Used on small screens and in the dashboard.</span></div>' +
      '<div class="field"><label for="' + prefix + 'City">City</label>' +
      '<input class="input" id="' + prefix + 'City" data-field="city" maxlength="80" value="' + NT.esc(record.city || "") + '" placeholder="Lusaka"></div>' +
      '</div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="' + prefix + 'Country">Country</label>' +
      '<input class="input" id="' + prefix + 'Country" data-field="country" maxlength="80" value="' + NT.esc(record.country || "") + '" placeholder="Zambia"></div>' +
      '<div class="field"><label for="' + prefix + 'Status">Visibility</label>' +
      '<select class="input" id="' + prefix + 'Status" data-field="status">' + statusOptions(record.status || "published") + "</select></div>" +
      '</div>' +
      '<div class="field"><label for="' + prefix + 'Description">Description <span class="muted">(optional)</span></label>' +
      '<textarea class="input" id="' + prefix + 'Description" data-field="description" rows="3" maxlength="600" placeholder="What students study here">' + NT.esc(record.description || "") + "</textarea></div>" +
      '<div class="field-row">' +
      '<div class="field"><label for="' + prefix + 'Accent">Accent colour</label>' +
      '<span class="color-field"><input type="color" id="' + prefix + 'AccentPicker" value="' + NT.esc(record.accent || "#0d7ea4") + '" aria-label="Pick an accent colour">' +
      '<input class="input" id="' + prefix + 'Accent" data-field="accent" maxlength="7" value="' + NT.esc(record.accent || "") + '" placeholder="#0d7ea4"></span>' +
      '<span class="field-hint">Used on the university card. Leave blank for the brand colour.</span></div>' +
      '<div class="field"><label for="' + prefix + 'Logo">Logo URL <span class="muted">(optional)</span></label>' +
      '<input class="input" id="' + prefix + 'Logo" data-field="logoUrl" maxlength="600" value="' + NT.esc(record.logoUrl || "") + '" placeholder="https://…">' +
      '<span class="field-hint">Square images work best. Initials are used when this is empty.</span></div>' +
      '</div>';
  }

  function readUniversityForm(scope) {
    function value(name) {
      var input = scope.querySelector("[data-field='" + name + "']");
      return input ? input.value.trim() : "";
    }
    return {
      name: value("name"),
      shortName: value("shortName"),
      city: value("city"),
      country: value("country"),
      description: value("description"),
      accent: value("accent"),
      logoUrl: value("logoUrl"),
      status: value("status") || "published"
    };
  }

  function bindAccentPicker(scope, prefix) {
    var picker = scope.querySelector("#" + prefix + "AccentPicker");
    var field = scope.querySelector("[data-field='accent']");
    if (!picker || !field) return;
    picker.addEventListener("input", function () { field.value = picker.value; });
    field.addEventListener("input", function () {
      if (/^#[0-9a-fA-F]{6}$/.test(field.value.trim())) picker.value = field.value.trim();
    });
  }

  function openUniversityModal(university, onSaved) {
    var prefix = university ? "editUni" : "newUni";
    var modal = NT.modal({
      title: university ? "Edit university" : "Add a university",
      body: '<div class="settings-form">' + universityFormFields(prefix, university) + "</div>",
      footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
        '<button class="btn btn-primary" id="saveUniversity">' + NT.icon("check") + (university ? "Save changes" : "Add university") + "</button>"
    });
    bindAccentPicker(modal, prefix);
    var save = modal.querySelector("#saveUniversity");
    save.addEventListener("click", function () {
      var payload = readUniversityForm(modal);
      modal.querySelectorAll(".field-error").forEach(function (node) { node.remove(); });
      modal.querySelectorAll(".input-invalid").forEach(function (node) { node.classList.remove("input-invalid"); });
      if (!payload.name) {
        NT.toast("Enter the university name", "error");
        return;
      }
      busy(save, "Saving");
      var request = university
        ? NT.api.patch("api/admin/universities/" + encodeURIComponent(university.id), payload)
        : NT.api.post("api/admin/universities", payload);
      request.then(function (data) {
        modal.close();
        NT.toast(university ? "University updated" : "University added", "success");
        onSaved(data.university);
      }, function (error) {
        notBusy(save);
        applyFieldErrors(modal, error);
        NT.toast(NT.api.message(error, "Could not save the university"), "error");
      });
    });
    return modal;
  }

  function pageUniversities(root) {
    function render() {
      root.innerHTML = '<div class="adm-toolbar"><div><h2 class="adm-toolbar-title">Universities</h2>' +
        '<p class="muted small">Students choose a university first, then a semester. Deleting a university also removes its courses and video lessons.</p></div>' +
        '<span class="spacer"></span><button class="btn btn-primary" type="button" id="addUniversity">' + NT.icon("plus") + "Add university</button></div>" +
        '<div id="universityList">' + NT.loadingState({ count: 3, kind: "rows", label: "Loading universities" }) + "</div>";

      root.querySelector("#addUniversity").addEventListener("click", function () {
        openUniversityModal(null, function () { render(); });
      });

      var host = root.querySelector("#universityList");
      NT.api.load("api/admin/universities", function (data) {
        var list = data.universities || [];
        if (!list.length) {
          host.innerHTML = '<div class="adm-card"><div class="adm-card-body">' + NT.emptyState({
            icon: "building",
            title: "No universities yet",
            body: "Add the institutions your students study at. Each one can then hold Semester 1 and Semester 2 courses.",
            button: { id: "addFirstUniversity", label: "Add your first university", icon: "plus" }
          }) + "</div></div>";
          var firstAdd = host.querySelector("#addFirstUniversity");
          if (firstAdd) firstAdd.addEventListener("click", function () {
            openUniversityModal(null, function () { render(); });
          });
          return;
        }
        host.innerHTML = '<div class="table-wrap"><table class="nt-table"><thead><tr>' +
          "<th>University</th><th>Location</th><th>Semester 1</th><th>Semester 2</th><th>Video lessons</th><th>Status</th><th>Order</th><th></th>" +
          "</tr></thead><tbody>" + list.map(function (item, index) {
            var first = (item.semesters || []).filter(function (entry) { return entry.semester === 1; })[0] || { courses: 0, videos: 0 };
            var second = (item.semesters || []).filter(function (entry) { return entry.semester === 2; })[0] || { courses: 0, videos: 0 };
            return '<tr><td class="td-strong" data-label="University"><span class="uni-cell-mark" style="--uni-accent:' +
              NT.esc(item.accent || "#0d7ea4") + '">' + NT.esc((item.shortName || item.name).slice(0, 3)) + "</span>" +
              "<span><b>" + NT.esc(item.name) + "</b><small>" + NT.esc(item.shortName || "") + "</small></span></td>" +
              '<td data-label="Location">' + NT.esc([item.city, item.country].filter(Boolean).join(", ") || "—") + "</td>" +
              '<td data-label="Semester 1">' + first.courses + " courses · " + first.videos + " videos</td>" +
              '<td data-label="Semester 2">' + second.courses + " courses · " + second.videos + " videos</td>" +
              '<td data-label="Video lessons">' + item.videoCount + "</td>" +
              '<td data-label="Status">' + statusBadge(item.status) + "</td>" +
              '<td data-label="Order">' + moveButtons("universities", item.id, { canUp: index > 0, canDown: index < list.length - 1 }) + "</td>" +
              '<td data-label="Actions"><span class="row-actions">' +
              '<a class="btn btn-sm btn-ghost" href="../university.html?id=' + encodeURIComponent(item.id) + '" target="_blank" rel="noopener">' + NT.icon("eye", "icon-sm") + "View</a>" +
              '<a class="btn btn-sm btn-ghost" href="courses.html?university=' + encodeURIComponent(item.id) + '">' + NT.icon("book-open", "icon-sm") + "Courses</a>" +
              '<button class="btn btn-sm btn-secondary" type="button" data-edit="' + NT.esc(item.id) + '">' + NT.icon("pencil", "icon-sm") + "Edit</button>" +
              '<button class="btn btn-sm btn-danger-soft" type="button" data-delete="' + NT.esc(item.id) + '">' + NT.icon("trash", "icon-sm") + "Delete</button>" +
              "</span></td></tr>";
          }).join("") + "</tbody></table></div>";

        bindMoveButtons(host, function (id) { return "api/admin/universities/" + encodeURIComponent(id); }, render);
        host.querySelectorAll("[data-edit]").forEach(function (button) {
          button.addEventListener("click", function () {
            var item = list.filter(function (entry) { return entry.id === button.dataset.edit; })[0];
            openUniversityModal(item, function () { render(); });
          });
        });
        host.querySelectorAll("[data-delete]").forEach(function (button) {
          button.addEventListener("click", function () {
            var item = list.filter(function (entry) { return entry.id === button.dataset.delete; })[0];
            if (!item) return;
            confirmDialog({
              title: "Delete " + item.name + "?",
              body: "This permanently removes the university together with <b>" + item.courseCount + " courses</b> and <b>" +
                item.videoCount + " video lessons</b>. Students will no longer see any of it.",
              confirmLabel: "Delete university"
            }, function () {
              NT.api.remove("api/admin/universities/" + encodeURIComponent(item.id)).then(function () {
                NT.toast("University deleted", "success");
                render();
              }, function (error) {
                NT.toast(NT.api.message(error, "Could not delete the university"), "error");
              });
            });
          });
        });
      }, function (error) {
        host.innerHTML = NT.errorState(NT.api.message(error), { title: "Cannot load universities" });
        var retry = host.querySelector("[data-retry]");
        if (retry) retry.addEventListener("click", function () {
          NT.api.forget("api/admin/universities");
          render();
        });
      });
    }
    render();
  }

  /* ============================ COURSES ============================
     Server-backed university courses (semester aware) plus the read-only view
     of the built-in outlines that have always shipped with the site. */
  function courseFormFields(prefix, course, universities) {
    var record = course || {};
    var subjects = D.SUBJECTS.map(function (item) {
      return { value: item.id, label: item.title };
    });
    return '' +
      '<div class="field-row">' +
      '<div class="field"><label for="' + prefix + 'University">University</label>' +
      '<select class="input" id="' + prefix + 'University" data-field="universityId" required>' +
      selectOptions(universities.map(function (item) { return { value: item.id, label: item.name }; }), record.universityId, "Choose a university") +
      "</select></div>" +
      '<div class="field"><label for="' + prefix + 'Semester">Semester</label>' +
      '<select class="input" id="' + prefix + 'Semester" data-field="semester" required>' + semesterOptions(record.semester || 1) + "</select></div>" +
      "</div>" +
      '<div class="field"><label for="' + prefix + 'Title">Course title</label>' +
      '<input class="input" id="' + prefix + 'Title" data-field="title" maxlength="140" required value="' + NT.esc(record.title || "") + '" placeholder="Programming Fundamentals"></div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="' + prefix + 'Code">Course code <span class="muted">(optional)</span></label>' +
      '<input class="input" id="' + prefix + 'Code" data-field="code" maxlength="24" value="' + NT.esc(record.code || "") + '" placeholder="CS101"></div>' +
      '<div class="field"><label for="' + prefix + 'Subject">Subject icon</label>' +
      '<select class="input" id="' + prefix + 'Subject" data-field="subjectId">' +
      selectOptions(subjects, record.subjectId, "Generic book icon") + "</select></div>" +
      "</div>" +
      '<div class="field"><label for="' + prefix + 'Instructor">Lecturer <span class="muted">(optional)</span></label>' +
      '<input class="input" id="' + prefix + 'Instructor" data-field="instructor" maxlength="120" value="' + NT.esc(record.instructor || "") + '" placeholder="Dr …"></div>' +
      '<div class="field"><label for="' + prefix + 'Description">Description <span class="muted">(optional)</span></label>' +
      '<textarea class="input" id="' + prefix + 'Description" data-field="description" rows="3" maxlength="600">' + NT.esc(record.description || "") + "</textarea></div>" +
      '<div class="field"><label for="' + prefix + 'Status">Visibility</label>' +
      '<select class="input" id="' + prefix + 'Status" data-field="status">' + statusOptions(record.status || "published") + "</select></div>";
  }

  /* Reads several cached endpoints and calls onDone once every payload has
     arrived. NT.api.load answers synchronously from a warm cache, so a page
     that already fetched these lists repaints without a spinner and never
     asks the server twice for the same data. */
  function loadAll(specs, onDone, onError) {
    var outstanding = specs.length;
    var failed = false;
    specs.forEach(function (spec) {
      NT.api.load(spec.path, function (payload) {
        if (failed) return;
        spec.assign(payload);
        outstanding -= 1;
        if (outstanding === 0) onDone();
      }, function (error) {
        if (failed) return;
        failed = true;
        onError(error);
      });
    });
  }

  function readForm(scope) {
    var payload = {};
    scope.querySelectorAll("[data-field]").forEach(function (input) {
      payload[input.dataset.field] = typeof input.value === "string" ? input.value.trim() : input.value;
    });
    return payload;
  }

  function openCourseModal(options) {
    var course = options.course || null;
    /* For a new course, defaults prefill the university and semester the
       administrator has already chosen in the video workspace. */
    var record = course || options.defaults || null;
    var prefix = course ? "editCourse" : "newCourse";
    var modal = NT.modal({
      title: course ? "Edit course" : "Add a course",
      body: (options.notice || "") + '<div class="settings-form">' + courseFormFields(prefix, record, options.universities) + "</div>",
      footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
        '<button class="btn btn-primary" id="saveCourse">' + NT.icon("check") + (course ? "Save changes" : "Add course") + "</button>"
    });
    var save = modal.querySelector("#saveCourse");
    save.addEventListener("click", function () {
      var payload = readForm(modal);
      modal.querySelectorAll(".field-error").forEach(function (node) { node.remove(); });
      modal.querySelectorAll(".input-invalid").forEach(function (node) { node.classList.remove("input-invalid"); });
      if (!payload.title || !payload.universityId) {
        NT.toast("Choose a university and enter a course title", "error");
        return;
      }
      payload.semester = Number(payload.semester) === 2 ? 2 : 1;
      busy(save, "Saving");
      var request = course
        ? NT.api.patch("api/admin/courses/" + encodeURIComponent(course.id), payload)
        : NT.api.post("api/admin/courses", payload);
      request.then(function (data) {
        modal.close();
        NT.toast(course ? "Course updated" : "Course added", "success");
        options.onSaved(data.course);
      }, function (error) {
        notBusy(save);
        applyFieldErrors(modal, error);
        NT.toast(NT.api.message(error, "Could not save the course"), "error");
      });
    });
    return modal;
  }

  function pageCourses(root) {
    var filters = {
      university: NT.qs("university") || "",
      semester: NT.qs("semester") || "",
      status: "",
      q: ""
    };
    var data = { universities: [], courses: [] };

    root.innerHTML =
      '<div class="adm-toolbar"><div><h2 class="adm-toolbar-title">Courses</h2>' +
      '<p class="muted small">Every course belongs to one university and one semester. Students reach video lessons through this structure.</p></div>' +
      '<span class="spacer"></span>' +
      '<a class="btn btn-secondary" href="videos.html">' + NT.icon("video", "icon-sm") + "Video lessons</a>" +
      '<button class="btn btn-primary" type="button" id="addCourse">' + NT.icon("plus") + "Add course</button></div>" +
      '<div class="adm-card filter-card"><div class="adm-card-body filter-body">' +
      '<div class="field"><label for="courseFilterUniversity">University</label><select class="input" id="courseFilterUniversity"></select></div>' +
      '<div class="field"><label for="courseFilterSemester">Semester</label><select class="input" id="courseFilterSemester">' +
      '<option value="">Both semesters</option>' + semesterOptions("") + '</select></div>' +
      '<div class="field"><label for="courseFilterStatus">Visibility</label><select class="input" id="courseFilterStatus">' +
      '<option value="">Published and drafts</option><option value="published">Published</option><option value="draft">Draft</option></select></div>' +
      '<div class="field"><label for="courseFilterSearch">Search</label>' +
      '<span class="search"><input class="input" id="courseFilterSearch" type="search" placeholder="Title, code or lecturer"></span></div>' +
      "</div></div>" +
      '<div id="courseAdminList">' + NT.loadingState({ count: 4, kind: "rows", label: "Loading courses" }) + "</div>" +
      '<section class="adm-card"><div class="adm-card-head"><h2>Built-in course outlines</h2>' +
      '<span class="sub">Shipped with the site; lesson titles and package tiers are managed under Lesson access.</span></div>' +
      '<div id="outlineHost"></div></section>';

    function selectedUniversities() {
      return data.universities;
    }

    function populateFilters() {
      var universitySelect = root.querySelector("#courseFilterUniversity");
      universitySelect.innerHTML = selectOptions(data.universities.map(function (item) {
        return { value: item.id, label: item.name };
      }), filters.university, "All universities");
      root.querySelector("#courseFilterSemester").value = filters.semester;
      root.querySelector("#courseFilterStatus").value = filters.status;
      root.querySelector("#courseFilterSearch").value = filters.q;
    }

    function visibleCourses() {
      var query = filters.q.toLowerCase();
      return data.courses.filter(function (course) {
        if (filters.university && course.universityId !== filters.university) return false;
        if (filters.semester && String(course.semester) !== String(filters.semester)) return false;
        if (filters.status && course.status !== filters.status) return false;
        if (query && [course.title, course.code, course.instructor, course.description, course.universityName]
          .join(" ").toLowerCase().indexOf(query) === -1) return false;
        return true;
      });
    }

    function renderList() {
      var host = root.querySelector("#courseAdminList");
      var list = visibleCourses();
      if (!data.universities.length) {
        host.innerHTML = '<div class="adm-card"><div class="adm-card-body">' + NT.emptyState({
          icon: "building",
          title: "Add a university first",
          body: "Courses are always attached to a university and a semester.",
          action: { href: "universities.html", label: "Go to universities", icon: "building" }
        }) + "</div></div>";
        return;
      }
      if (!list.length) {
        host.innerHTML = '<div class="adm-card"><div class="adm-card-body">' + NT.emptyState({
          icon: "book-open",
          title: data.courses.length ? "No courses match those filters" : "No courses yet",
          body: data.courses.length ? "Adjust the filters to see the rest of the catalogue." : "Create your first Semester 1 or Semester 2 course.",
          button: { id: "addFirstCourse", label: "Add a course", icon: "plus" }
        }) + "</div></div>";
        var firstAdd = host.querySelector("#addFirstCourse");
        if (firstAdd) firstAdd.addEventListener("click", function () { addCourse(); });
        return;
      }
      host.innerHTML = '<div class="table-wrap"><table class="nt-table"><thead><tr>' +
        "<th>Course</th><th>University</th><th>Semester</th><th>Video lessons</th><th>Runtime</th><th>Status</th><th>Order</th><th></th>" +
        "</tr></thead><tbody>" + list.map(function (course, index) {
          return '<tr><td class="td-strong" data-label="Course"><span><b>' + NT.esc(course.title) + "</b>" +
            (course.code ? "<small>" + NT.esc(course.code) + (course.instructor ? " · " + NT.esc(course.instructor) : "") + "</small>" : "") + "</span></td>" +
            '<td data-label="University">' + NT.esc(course.universityName) + "</td>" +
            '<td data-label="Semester"><span class="semester-chip semester-' + course.semester + '">' + NT.esc(course.semesterLabel) + "</span></td>" +
            '<td data-label="Video lessons">' + course.videoCount + "</td>" +
            '<td data-label="Runtime">' + NT.esc(NT.durationWords(course.durationSeconds) || "—") + "</td>" +
            '<td data-label="Status">' + statusBadge(course.status) + "</td>" +
            '<td data-label="Order">' + moveButtons("courses", course.id, { canUp: index > 0, canDown: index < list.length - 1 }) + "</td>" +
            '<td data-label="Actions"><span class="row-actions">' +
            '<a class="btn btn-sm btn-primary" href="videos.html?university=' + encodeURIComponent(course.universityId) +
            "&semester=" + course.semester + "&course=" + encodeURIComponent(course.id) + '">' + NT.icon("video", "icon-sm") + "Videos</a>" +
            '<a class="btn btn-sm btn-ghost" href="../course.html?id=' + encodeURIComponent(course.id) + '" target="_blank" rel="noopener">' + NT.icon("eye", "icon-sm") + "View</a>" +
            '<button class="btn btn-sm btn-secondary" type="button" data-edit="' + NT.esc(course.id) + '">' + NT.icon("pencil", "icon-sm") + "Edit</button>" +
            '<button class="btn btn-sm btn-danger-soft" type="button" data-delete="' + NT.esc(course.id) + '">' + NT.icon("trash", "icon-sm") + "Delete</button>" +
            "</span></td></tr>";
        }).join("") + "</tbody></table></div>";

      bindMoveButtons(host, function (id) { return "api/admin/courses/" + encodeURIComponent(id); }, function () { reload(); });
      host.querySelectorAll("[data-edit]").forEach(function (button) {
        button.addEventListener("click", function () {
          var course = data.courses.filter(function (item) { return item.id === button.dataset.edit; })[0];
          openCourseModal({ course: course, universities: selectedUniversities(), onSaved: reload });
        });
      });
      host.querySelectorAll("[data-delete]").forEach(function (button) {
        button.addEventListener("click", function () {
          var course = data.courses.filter(function (item) { return item.id === button.dataset.delete; })[0];
          if (!course) return;
          confirmDialog({
            title: "Delete " + course.title + "?",
            body: "Removes this " + NT.esc(course.semesterLabel) + " course and its <b>" + course.videoCount + " video lessons</b> from " +
              NT.esc(course.universityName) + ".",
            confirmLabel: "Delete course"
          }, function () {
            NT.api.remove("api/admin/courses/" + encodeURIComponent(course.id)).then(function () {
              NT.toast("Course deleted", "success");
              reload();
            }, function (error) {
              NT.toast(NT.api.message(error, "Could not delete the course"), "error");
            });
          });
        });
      });
    }

    function renderOutlines() {
      var host = root.querySelector("#outlineHost");
      host.innerHTML = '<div class="table-wrap"><table class="nt-table"><thead><tr>' +
        "<th>Course</th><th>Education level</th><th>Lessons</th><th>Basic</th><th>Standard</th><th>Premium</th></tr></thead><tbody>" +
        D.COURSES.map(function (course) {
          var lessons = NT.courseLessons(course.id);
          var counts = { basic: 0, standard: 0, premium: 0 };
          lessons.forEach(function (lesson) { counts[NT.levelOf(lesson)]++; });
          var pathways = NT.coursePathways(course).map(NT.pathwayLabel).filter(Boolean).join(", ") || "Not specified";
          return '<tr><td class="td-strong" data-label="Course"><a href="../course.html?id=' + encodeURIComponent(course.id) + '">' + NT.esc(course.title) + "</a></td>" +
            '<td data-label="Education level">' + NT.esc(pathways) + "</td>" +
            '<td data-label="Lessons">' + lessons.length + "</td>" +
            '<td data-label="Basic">' + counts.basic + '</td><td data-label="Standard">' + counts.standard + "</td>" +
            '<td data-label="Premium">' + counts.premium + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    function addCourse() {
      if (!data.universities.length) {
        NT.toast("Add a university before creating courses", "error");
        return;
      }
      openCourseModal({ universities: data.universities, onSaved: function (course) {
        filters.university = course.universityId;
        filters.semester = String(course.semester);
        reload();
      } });
    }

    function reload() {
      var host = root.querySelector("#courseAdminList");
      host.innerHTML = NT.loadingState({ count: 4, kind: "rows", label: "Loading courses" });
      loadAll([
        { path: "api/admin/universities", assign: function (payload) { data.universities = payload.universities || []; } },
        { path: "api/admin/courses", assign: function (payload) { data.courses = payload.courses || []; } }
      ], function () {
        populateFilters();
        renderList();
      }, function (error) {
        host.innerHTML = NT.errorState(NT.api.message(error), { title: "Cannot load courses" });
        var retry = host.querySelector("[data-retry]");
        if (retry) retry.addEventListener("click", reload);
      });
    }

    root.querySelector("#addCourse").addEventListener("click", addCourse);
    root.querySelector("#courseFilterUniversity").addEventListener("change", function (event) {
      filters.university = event.target.value; renderList();
    });
    root.querySelector("#courseFilterSemester").addEventListener("change", function (event) {
      filters.semester = event.target.value; renderList();
    });
    root.querySelector("#courseFilterStatus").addEventListener("change", function (event) {
      filters.status = event.target.value; renderList();
    });
    root.querySelector("#courseFilterSearch").addEventListener("input", function (event) {
      filters.q = event.target.value; renderList();
    });

    populateFilters();
    renderOutlines();
    reload();
  }

  /* ============================ VIDEO LESSONS ============================
     The main administrator screen. University, semester and course are chosen
     first and stay pinned above the form, so a lesson can never be added to
     the wrong place by accident. The platform is video-only: administrators
     paste a lesson link and nothing is ever stored as a file here. */
  function syncAdminQuery(params) {
    if (!window.history || !window.history.replaceState) return;
    try {
      var url = new URL(window.location.href);
      Object.keys(params).forEach(function (key) {
        var value = params[key];
        if (value === "" || value == null) url.searchParams.delete(key);
        else url.searchParams.set(key, String(value));
      });
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (error) { /* file:// previews cannot rewrite history */ }
  }

  function videoFormFields(prefix, video) {
    var record = video || {};
    return '' +
      '<div class="field"><label for="' + prefix + 'Title">Video title</label>' +
      '<input class="input" id="' + prefix + 'Title" data-field="title" maxlength="160" required value="' + NT.esc(record.title || "") + '" placeholder="Integration by parts"></div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="' + prefix + 'Topic">Topic <span class="muted">(optional)</span></label>' +
      '<input class="input" id="' + prefix + 'Topic" data-field="topic" maxlength="120" value="' + NT.esc(record.topic || "") + '" placeholder="Calculus"></div>' +
      '<div class="field"><label for="' + prefix + 'Duration">Duration <span class="muted">(optional)</span></label>' +
      '<input class="input" id="' + prefix + 'Duration" data-field="durationSeconds" maxlength="12" value="' +
      (record.durationSeconds ? NT.esc(NT.duration(record.durationSeconds)) : "") + '" placeholder="12:45 or 765">' +
      '<span class="field-hint">Minutes and seconds, or total seconds.</span></div>' +
      "</div>" +
      '<div class="field"><label for="' + prefix + 'Url">Video URL</label>' +
      '<input class="input" id="' + prefix + 'Url" data-field="url" type="url" maxlength="2000" required value="' + NT.esc(record.url || "") + '" placeholder="https://www.youtube.com/watch?v=…">' +
      '<span class="field-hint">YouTube, Vimeo or a direct video file (.mp4, .webm). Any other link opens in a new tab for the student.</span>' +
      '<button class="btn btn-sm btn-ghost" type="button" data-check-source>' + NT.icon("link", "icon-sm") + "Check source</button>" +
      '<div class="source-preview" data-source-preview aria-live="polite"></div></div>' +
      '<div class="field"><label for="' + prefix + 'Thumb">Thumbnail URL <span class="muted">(optional)</span></label>' +
      '<input class="input" id="' + prefix + 'Thumb" data-field="thumbnailUrl" type="url" maxlength="600" value="' + NT.esc(record.thumbnailUrl || "") + '" placeholder="https://…/thumbnail.jpg">' +
      '<span class="field-hint">YouTube thumbnails are generated automatically when this stays empty.</span>' +
      '<div class="thumb-preview" data-thumb-preview aria-live="polite"></div></div>' +
      '<div class="field"><label for="' + prefix + 'Description">Description <span class="muted">(optional)</span></label>' +
      '<textarea class="input" id="' + prefix + 'Description" data-field="description" rows="3" maxlength="2000">' + NT.esc(record.description || "") + "</textarea></div>" +
      '<div class="field-row">' +
      '<div class="field"><label for="' + prefix + 'Level">Access tier</label>' +
      '<select class="input" id="' + prefix + 'Level" data-field="level">' + levelOptions(record.level || "basic") + "</select>" +
      '<span class="field-hint">Which access package includes this lesson.</span></div>' +
      '<div class="field"><label for="' + prefix + 'Status">Visibility</label>' +
      '<select class="input" id="' + prefix + 'Status" data-field="status">' + statusOptions(record.status || "published") + "</select></div>" +
      "</div>";
  }

  function renderSourcePreview(scope, analysis) {
    var host = scope.querySelector("[data-source-preview]");
    if (!host) return;
    if (!analysis) { host.innerHTML = ""; return; }
    if (!analysis.ok) {
      host.innerHTML = '<span class="source-preview-row is-error">' + NT.icon("circle-alert") +
        "<span><b>That URL cannot be used.</b><small>" + NT.esc(analysis.reason || "Enter a valid video URL.") + "</small></span></span>";
      return;
    }
    var label = {
      youtube: "YouTube · plays inside the site",
      vimeo: "Vimeo · plays inside the site",
      file: "Video file · plays inside the site",
      external: "External link · opens in a new tab"
    }[analysis.provider] || "Video source";
    host.innerHTML = '<span class="source-preview-row ' + (analysis.provider === "external" ? "is-warn" : "is-ok") + '">' +
      NT.icon(analysis.provider === "external" ? "external" : "check-circle") +
      "<span><b>" + NT.esc(label) + "</b>" +
      (analysis.reason ? "<small>" + NT.esc(analysis.reason) + "</small>" : "") +
      (analysis.externalId ? "<small class='mono'>id " + NT.esc(analysis.externalId) + "</small>" : "") + "</span>" +
      (analysis.autoThumbnail ? '<img class="source-preview-thumb" src="' + NT.esc(analysis.autoThumbnail) + '" alt="">' : "") + "</span>";
    renderThumbPreview(scope, analysis.autoThumbnail);
  }

  function renderThumbPreview(scope, autoThumbnail) {
    var host = scope.querySelector("[data-thumb-preview]");
    if (!host) return;
    var field = scope.querySelector("[data-field='thumbnailUrl']");
    var custom = field ? field.value.trim() : "";
    var source = custom || autoThumbnail || "";
    if (!source) {
      host.innerHTML = '<span class="thumb-preview-row is-empty">' + NT.icon("image", "icon-sm") +
        "<small>No thumbnail set — the artwork from the video source is used.</small></span>";
      return;
    }
    host.innerHTML = '<span class="thumb-preview-row"><img src="' + NT.esc(source) + '" alt="Thumbnail preview">' +
      "<small>" + (custom ? "Custom thumbnail" : "Automatic thumbnail from the video source") + "</small></span>";
  }

  function bindVideoForm(scope, video) {
    var urlField = scope.querySelector("[data-field='url']");
    var thumbField = scope.querySelector("[data-field='thumbnailUrl']");
    var check = scope.querySelector("[data-check-source]");
    var lastAnalysis = video && video.url
      ? { ok: true, provider: video.provider, externalId: video.externalId, embedUrl: video.embedUrl, autoThumbnail: video.thumbnailAuto, reason: "" }
      : null;
    if (lastAnalysis) renderSourcePreview(scope, lastAnalysis);

    function analyze(notify) {
      var url = urlField ? urlField.value.trim() : "";
      if (!url) { renderSourcePreview(scope, null); return; }
      if (check) check.disabled = true;
      NT.api.post("api/admin/analyze-url", { url: url }).then(function (analysis) {
        if (check) check.disabled = false;
        renderSourcePreview(scope, analysis);
        if (notify) NT.toast(analysis.ok ? "Source checked" : "That URL cannot be used", analysis.ok ? "success" : "error");
      }, function (error) {
        if (check) check.disabled = false;
        NT.toast(NT.api.message(error, "Could not check that URL"), "error");
      });
    }

    if (check) check.addEventListener("click", function () { analyze(true); });
    if (urlField) urlField.addEventListener("change", function () { analyze(false); });
    if (thumbField) thumbField.addEventListener("input", function () {
      renderThumbPreview(scope, lastAnalysis ? lastAnalysis.autoThumbnail : "");
    });
  }

  /* Edit (and optionally move) an existing video lesson. */
  function openVideoModal(options) {
    var video = options.video;
    var prefix = "editVideo";
    var contextFields =
      '<div class="modal-context"><span class="modal-context-label">' + NT.icon("target", "icon-sm") + "Course placement</span>" +
      '<div class="field-row">' +
      '<div class="field"><label for="' + prefix + 'University">University</label>' +
      '<select class="input" id="' + prefix + 'University">' +
      selectOptions(options.universities.map(function (item) { return { value: item.id, label: item.name }; }), video.universityId, "Choose a university") + "</select></div>" +
      '<div class="field"><label for="' + prefix + 'Semester">Semester</label>' +
      '<select class="input" id="' + prefix + 'Semester">' + semesterOptions(video.semester) + "</select></div>" +
      '<div class="field"><label for="' + prefix + 'Course">Course</label>' +
      '<select class="input" id="' + prefix + 'Course"></select></div>' +
      "</div></div>";
    var modal = NT.modal({
      title: "Edit video lesson",
      body: contextFields + '<div class="settings-form">' + videoFormFields(prefix, video) + "</div>",
      footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
        '<button class="btn btn-primary" id="saveVideo">' + NT.icon("check") + "Save changes</button>"
    });

    var universitySelect = modal.querySelector("#" + prefix + "University");
    var semesterSelect = modal.querySelector("#" + prefix + "Semester");
    var courseSelect = modal.querySelector("#" + prefix + "Course");

    function fillCourses(selectedId) {
      var list = options.courses.filter(function (course) {
        return course.universityId === universitySelect.value && String(course.semester) === String(semesterSelect.value);
      });
      courseSelect.innerHTML = list.length
        ? list.map(function (course) {
          return '<option value="' + NT.esc(course.id) + '"' + (course.id === selectedId ? " selected" : "") + ">" +
            NT.esc(course.title + (course.code ? " (" + course.code + ")" : "")) + "</option>";
        }).join("")
        : '<option value="">No courses in this semester</option>';
    }
    universitySelect.addEventListener("change", function () { fillCourses(""); });
    semesterSelect.addEventListener("change", function () { fillCourses(""); });
    fillCourses(video.courseId);
    bindVideoForm(modal, video);

    var save = modal.querySelector("#saveVideo");
    save.addEventListener("click", function () {
      var payload = readForm(modal);
      modal.querySelectorAll(".field-error").forEach(function (node) { node.remove(); });
      modal.querySelectorAll(".input-invalid").forEach(function (node) { node.classList.remove("input-invalid"); });
      if (!payload.title || !payload.url) {
        NT.toast("A video lesson needs a title and a URL", "error");
        return;
      }
      if (!courseSelect.value) {
        NT.toast("Choose a course for this lesson", "error");
        return;
      }
      payload.courseId = courseSelect.value;
      busy(save, "Saving");
      NT.api.patch("api/admin/videos/" + encodeURIComponent(video.id), payload).then(function (data) {
        modal.close();
        NT.toast("Video lesson updated", "success");
        options.onSaved(data.video);
      }, function (error) {
        notBusy(save);
        applyFieldErrors(modal, error);
        NT.toast(NT.api.message(error, "Could not save the video lesson"), "error");
      });
    });
    return modal;
  }

  function pageVideos(root) {
    var data = { universities: [], courses: [], videos: [] };
    var selection = {
      universityId: NT.qs("university") || "",
      semester: NT.qs("semester") || "",
      courseId: NT.qs("course") || ""
    };
    var browse = { q: "", status: "", level: "" };

    function currentUniversity() {
      return data.universities.filter(function (item) { return item.id === selection.universityId; })[0] || null;
    }
    function currentCourse() {
      return data.courses.filter(function (item) { return item.id === selection.courseId; })[0] || null;
    }
    function coursesInScope() {
      return data.courses.filter(function (course) {
        if (selection.universityId && course.universityId !== selection.universityId) return false;
        if (selection.semester && String(course.semester) !== String(selection.semester)) return false;
        return true;
      });
    }
    function courseVideos() {
      return data.videos.filter(function (video) { return video.courseId === selection.courseId; });
    }

    /* ---------------- context bar ---------------- */
    function contextCard() {
      var university = currentUniversity();
      var course = currentCourse();
      var semesterSet = selection.semester === "1" || selection.semester === "2";
      var crumbs = [];
      if (university) crumbs.push(university.name);
      if (semesterSet) crumbs.push(NT.semesterLabel(selection.semester));
      if (course) crumbs.push(course.title + (course.code ? " (" + course.code + ")" : ""));
      var nextStep = !university ? "Choose the university" : (!semesterSet ? "Choose Semester 1 or Semester 2" : (!course ? "Choose or create a course" : ""));

      return '<section class="adm-card video-context-card">' +
        '<div class="adm-card-head"><h2>Where does this video lesson belong?</h2>' +
        '<span class="sub">University → semester → course, every time.</span></div>' +
        '<div class="adm-card-body">' +
        '<div class="context-steps">' +
        '<div class="context-step' + (university ? " is-done" : "") + '"><span class="context-step-num">1</span>' +
        '<div class="context-step-field"><small>University</small>' +
        '<select class="input" id="ctxUniversity">' +
        selectOptions(data.universities.map(function (item) { return { value: item.id, label: item.name }; }), selection.universityId, "Choose a university") +
        "</select></div></div>" +
        '<div class="context-step' + (semesterSet ? " is-done" : "") + '"><span class="context-step-num">2</span>' +
        '<div class="context-step-field"><small>Semester</small>' +
        '<div class="segmented semester-segmented" id="ctxSemester" role="group" aria-label="Choose a semester">' +
        D.SEMESTERS.map(function (item) {
          var active = String(selection.semester) === String(item.id);
          return '<button type="button" class="semester-' + item.id + (active ? " active" : "") + '" data-semester="' + item.id + '" aria-pressed="' + active + '">' +
            NT.esc(item.label) + "</button>";
        }).join("") + "</div></div></div>" +
        '<div class="context-step' + (course ? " is-done" : "") + '"><span class="context-step-num">3</span>' +
        '<div class="context-step-field"><small>Course</small>' +
        '<span class="context-course-row"><select class="input" id="ctxCourse">' +
        (coursesInScope().length
          ? selectOptions(coursesInScope().map(function (item) {
            return { value: item.id, label: item.title + (item.code ? " (" + item.code + ")" : "") + " · " + item.videoCount + " videos" };
          }), selection.courseId, "Choose a course")
          : '<option value="">No courses in this semester</option>') +
        "</select>" +
        '<button class="btn btn-sm btn-secondary" type="button" id="ctxNewCourse">' + NT.icon("plus", "icon-sm") + "New course</button></span>" +
        "</div></div></div>" +
        '<div class="context-banner' + (nextStep ? "" : " is-complete") + '">' +
        NT.icon(nextStep ? "circle-alert" : "check-circle") +
        (nextStep
          ? "<span><b>" + NT.esc(nextStep) + "</b><small>The add-video form opens once all three are set.</small></span>"
          : "<span><b>Adding video lessons to:</b><small>" + NT.esc(crumbs.join(" › ")) + "</small></span>") +
        "</div></div></section>";
    }

    function bindContext() {
      var universitySelect = root.querySelector("#ctxUniversity");
      var courseSelect = root.querySelector("#ctxCourse");
      var newCourse = root.querySelector("#ctxNewCourse");

      universitySelect.addEventListener("change", function () {
        selection.universityId = universitySelect.value;
        selection.courseId = "";
        if (!selection.semester) selection.semester = "1";
        syncSelection();
      });
      root.querySelectorAll("#ctxSemester [data-semester]").forEach(function (button) {
        button.addEventListener("click", function () {
          selection.semester = button.dataset.semester;
          selection.courseId = "";
          syncSelection();
        });
      });
      courseSelect.addEventListener("change", function () {
        selection.courseId = courseSelect.value;
        syncSelection();
      });
      newCourse.addEventListener("click", function () {
        if (!selection.universityId) {
          NT.toast("Choose a university first", "error");
          return;
        }
        if (selection.semester !== "1" && selection.semester !== "2") {
          NT.toast("Choose Semester 1 or Semester 2 first", "error");
          return;
        }
        openCourseModal({
          universities: data.universities,
          defaults: { universityId: selection.universityId, semester: Number(selection.semester) },
          notice: '<p class="context-reminder">' + NT.icon("target", "icon-sm") +
            "<span><b>Creating a course in:</b> " + NT.esc(currentUniversity().name + " › " + NT.semesterLabel(selection.semester)) + "</span></p>",
          onSaved: function (course) {
            selection.universityId = course.universityId;
            selection.semester = String(course.semester);
            selection.courseId = course.id;
            reload();
          }
        });
      });
    }

    function syncSelection() {
      syncAdminQuery({ university: selection.universityId, semester: selection.semester, course: selection.courseId });
      reload();
    }

    /* ---------------- add-video workspace ---------------- */
    function workspace() {
      var course = currentCourse();
      var university = currentUniversity() || data.universities.filter(function (item) {
        return item.id === course.universityId;
      })[0] || { name: course.universityName };
      var videos = courseVideos();
      var published = videos.filter(function (video) { return video.status === "published"; }).length;

      return '<div class="adm-grid-2 video-workspace">' +
        '<section class="adm-card"><div class="adm-card-head"><h2>Add a video lesson</h2>' +
        '<span class="sub">Video links only — no file uploads.</span></div>' +
        '<div class="adm-card-body">' +
        '<p class="context-reminder">' + NT.icon("target", "icon-sm") +
        "<span><b>Adding to:</b> " + NT.esc(university.name + " › " + course.semesterLabel + " › " + course.title) + "</span></p>" +
        '<form id="addVideoForm" class="settings-form" novalidate>' + videoFormFields("newVideo", null) +
        '<button class="btn btn-primary" type="submit" id="addVideoSubmit">' + NT.icon("plus") + "Add video lesson</button>" +
        "</form></div></section>" +
        '<section class="adm-card"><div class="adm-card-head"><h2>Lessons in this course</h2>' +
        '<span class="sub">' + videos.length + " total · " + published + " published · " + (videos.length - published) + " drafts</span></div>" +
        '<div class="adm-card-body"><div id="courseVideoList">' + videoListMarkup(videos) + "</div></div></section>" +
        "</div>";
    }

    function videoListMarkup(videos) {
      if (!videos.length) {
        return NT.emptyState({
          compact: true,
          icon: "video",
          title: "No video lessons in this course yet",
          body: "Add the first one with the form. Students see it as soon as it is published."
        });
      }
      return '<ol class="adm-video-list">' + videos.map(function (video, index) {
        var published = video.status === "published";
        return '<li class="adm-video-row' + (published ? "" : " is-draft") + '">' +
          '<span class="adm-video-order">' + moveButtons("videos", video.id, { canUp: index > 0, canDown: index < videos.length - 1 }) +
          '<span class="adm-video-position">' + (index + 1) + "</span></span>" +
          '<span class="adm-video-thumb">' + NT.thumbnailMarkup(video) + "</span>" +
          '<span class="adm-video-copy"><b>' + NT.esc(video.title) + "</b>" +
          "<small>" + NT.esc([video.topic, NT.duration(video.durationSeconds), NT.providerLabel(video.provider)].filter(Boolean).join(" · ") || "No topic set") + "</small>" +
          "<small class='muted'>Updated " + NT.esc(NT.fmtDate(video.updatedAt)) + "</small></span>" +
          '<span class="adm-video-badges">' + NT.levelBadge(video.level) + statusBadge(video.status) + "</span>" +
          '<span class="row-actions">' +
          '<button class="btn btn-sm ' + (published ? "btn-ghost" : "btn-secondary") + '" type="button" data-toggle="' + NT.esc(video.id) + '">' +
          NT.icon(published ? "eye-off" : "eye", "icon-sm") + (published ? "Unpublish" : "Publish") + "</button>" +
          '<a class="btn btn-sm btn-ghost" href="../video.html?id=' + encodeURIComponent(video.id) + '" target="_blank" rel="noopener">' + NT.icon("external", "icon-sm") + "View</a>" +
          '<button class="btn btn-sm btn-secondary" type="button" data-edit="' + NT.esc(video.id) + '">' + NT.icon("pencil", "icon-sm") + "Edit</button>" +
          '<button class="btn btn-sm btn-danger-soft" type="button" data-delete="' + NT.esc(video.id) + '">' + NT.icon("trash", "icon-sm") + "Delete</button>" +
          "</span></li>";
      }).join("") + "</ol>";
    }

    function bindWorkspace() {
      var form = root.querySelector("#addVideoForm");
      bindVideoForm(form, null);
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var payload = readForm(form);
        form.querySelectorAll(".field-error").forEach(function (node) { node.remove(); });
        form.querySelectorAll(".input-invalid").forEach(function (node) { node.classList.remove("input-invalid"); });
        if (!payload.title || !payload.url) {
          NT.toast("A video lesson needs a title and a URL", "error");
          return;
        }
        payload.courseId = selection.courseId;
        var submit = root.querySelector("#addVideoSubmit");
        busy(submit, "Adding");
        NT.api.post("api/admin/videos", payload).then(function (data) {
          NT.toast("Video lesson added to " + currentCourse().title, "success");
          reload();
        }, function (error) {
          notBusy(submit);
          applyFieldErrors(form, error);
          NT.toast(NT.api.message(error, "Could not add the video lesson"), "error");
        });
      });
      bindVideoRows(root.querySelector("#courseVideoList"), courseVideos());
    }

    function bindVideoRows(scope, videos) {
      if (!scope) return;
      bindMoveButtons(scope, function (id) { return "api/admin/videos/" + encodeURIComponent(id); }, reload);
      scope.querySelectorAll("[data-toggle]").forEach(function (button) {
        button.addEventListener("click", function () {
          var video = videos.filter(function (item) { return item.id === button.dataset.toggle; })[0];
          if (!video) return;
          var next = video.status === "published" ? "draft" : "published";
          button.disabled = true;
          NT.api.patch("api/admin/videos/" + encodeURIComponent(video.id), { status: next }).then(function () {
            NT.toast(next === "published" ? "Published — students can watch it now" : "Unpublished — hidden from students", "success");
            reload();
          }, function (error) {
            button.disabled = false;
            NT.toast(NT.api.message(error, "Could not change visibility"), "error");
          });
        });
      });
      scope.querySelectorAll("[data-edit]").forEach(function (button) {
        button.addEventListener("click", function () {
          var video = videos.filter(function (item) { return item.id === button.dataset.edit; })[0];
          if (!video) return;
          openVideoModal({ video: video, universities: data.universities, courses: data.courses, onSaved: reload });
        });
      });
      scope.querySelectorAll("[data-delete]").forEach(function (button) {
        button.addEventListener("click", function () {
          var video = videos.filter(function (item) { return item.id === button.dataset.delete; })[0];
          if (!video) return;
          confirmDialog({
            title: "Delete this video lesson?",
            body: "<b>" + NT.esc(video.title) + "</b> will be removed from " +
              NT.esc([video.universityName, video.semesterLabel, video.courseTitle].filter(Boolean).join(" › ")) +
              ". Students lose access immediately.",
            confirmLabel: "Delete video lesson"
          }, function () {
            NT.api.remove("api/admin/videos/" + encodeURIComponent(video.id)).then(function () {
              NT.toast("Video lesson deleted", "success");
              reload();
            }, function (error) {
              NT.toast(NT.api.message(error, "Could not delete the video lesson"), "error");
            });
          });
        });
      });
      NT.watchThumbnails(scope);
    }

    /* ---------------- browse every video lesson ---------------- */
    function browseCard() {
      return '<section class="adm-card"><div class="adm-card-head"><h2>All video lessons</h2>' +
        '<span class="sub">Choose a university, semester and course above to add lessons.</span></div>' +
        '<div class="adm-card-body filter-body">' +
        '<div class="field"><label for="videoBrowseSearch">Search</label>' +
        '<span class="search"><input class="input" id="videoBrowseSearch" type="search" placeholder="Title, topic or course" value="' + NT.esc(browse.q) + '"></span></div>' +
        '<div class="field"><label for="videoBrowseStatus">Visibility</label><select class="input" id="videoBrowseStatus">' +
        '<option value="">All</option><option value="published"' + (browse.status === "published" ? " selected" : "") + ">Published</option>" +
        '<option value="draft"' + (browse.status === "draft" ? " selected" : "") + ">Draft</option></select></div>" +
        '<div class="field"><label for="videoBrowseLevel">Access tier</label><select class="input" id="videoBrowseLevel">' +
        '<option value="">All tiers</option>' + D.LEVELS.map(function (level) {
          return '<option value="' + level + '"' + (browse.level === level ? " selected" : "") + ">" + D.LEVEL_LABEL[level] + "</option>";
        }).join("") + "</select></div></div>" +
        '<div id="videoBrowseList">' + browseTable() + "</div></section>";
    }

    function browseMatches() {
      var query = browse.q.toLowerCase();
      return data.videos.filter(function (video) {
        if (browse.status && video.status !== browse.status) return false;
        if (browse.level && video.level !== browse.level) return false;
        if (query && [video.title, video.topic, video.description, video.courseTitle, video.universityName]
          .join(" ").toLowerCase().indexOf(query) === -1) return false;
        return true;
      });
    }

    function browseTable() {
      var list = browseMatches();
      if (!data.videos.length) {
        return NT.emptyState({
          compact: true, icon: "video", title: "No video lessons yet",
          body: "Choose a university, semester and course above, then add your first video lesson."
        });
      }
      if (!list.length) {
        return NT.emptyState({ compact: true, icon: "filter", title: "No video lessons match", body: "Adjust the search or filters." });
      }
      return '<div class="table-wrap"><table class="nt-table"><thead><tr>' +
        "<th>Video lesson</th><th>Course</th><th>Semester</th><th>University</th><th>Duration</th><th>Tier</th><th>Status</th><th></th>" +
        "</tr></thead><tbody>" + list.map(function (video) {
          return '<tr><td class="td-strong" data-label="Video lesson"><span class="adm-table-thumb">' + NT.thumbnailMarkup(video) + "</span>" +
            "<span><b>" + NT.esc(video.title) + "</b><small>" + NT.esc(video.topic || NT.providerLabel(video.provider)) + "</small></span></td>" +
            '<td data-label="Course">' + NT.esc(video.courseTitle) + (video.courseCode ? "<small>" + NT.esc(video.courseCode) + "</small>" : "") + "</td>" +
            '<td data-label="Semester"><span class="semester-chip semester-' + video.semester + '">' + NT.esc(video.semesterLabel || "—") + "</span></td>" +
            '<td data-label="University">' + NT.esc(video.universityName) + "</td>" +
            '<td data-label="Duration">' + NT.esc(NT.duration(video.durationSeconds) || "—") + "</td>" +
            '<td data-label="Tier">' + NT.levelBadge(video.level) + "</td>" +
            '<td data-label="Status">' + statusBadge(video.status) + "</td>" +
            '<td data-label="Actions"><span class="row-actions">' +
            '<button class="btn btn-sm ' + (video.status === "published" ? "btn-ghost" : "btn-secondary") + '" type="button" data-toggle="' + NT.esc(video.id) + '">' +
            NT.icon(video.status === "published" ? "eye-off" : "eye", "icon-sm") + (video.status === "published" ? "Unpublish" : "Publish") + "</button>" +
            '<button class="btn btn-sm btn-secondary" type="button" data-edit="' + NT.esc(video.id) + '">' + NT.icon("pencil", "icon-sm") + "Edit</button>" +
            '<button class="btn btn-sm btn-danger-soft" type="button" data-delete="' + NT.esc(video.id) + '">' + NT.icon("trash", "icon-sm") + "Delete</button>" +
            "</span></td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    function bindBrowse() {
      var search = root.querySelector("#videoBrowseSearch");
      var status = root.querySelector("#videoBrowseStatus");
      var level = root.querySelector("#videoBrowseLevel");
      function refresh() {
        var host = root.querySelector("#videoBrowseList");
        host.innerHTML = browseTable();
        bindVideoRows(host, data.videos);
      }
      search.addEventListener("input", function () { browse.q = search.value; refresh(); });
      status.addEventListener("change", function () { browse.status = status.value; refresh(); });
      level.addEventListener("change", function () { browse.level = level.value; refresh(); });
      bindVideoRows(root.querySelector("#videoBrowseList"), data.videos);
    }

    /* ---------------- load and render ---------------- */
    function render() {
      if (!data.universities.length) {
        root.innerHTML = contextCard() +
          '<div class="adm-card"><div class="adm-card-body">' + NT.emptyState({
            icon: "building",
            title: "Add a university before adding video lessons",
            body: "Video lessons always belong to a university, a semester and a course.",
            action: { href: "universities.html", label: "Go to universities", icon: "building" }
          }) + "</div></div>";
        bindContext();
        return;
      }
      var course = currentCourse();
      root.innerHTML = contextCard() + (course ? workspace() : browseCard());
      bindContext();
      if (course) bindWorkspace();
      else bindBrowse();
      NT.initReveal();
    }

    function reload() {
      root.innerHTML = NT.loadingState({ count: 3, kind: "rows", label: "Loading video lessons" });
      loadAll([
        { path: "api/admin/universities", assign: function (payload) { data.universities = payload.universities || []; } },
        { path: "api/admin/courses", assign: function (payload) { data.courses = payload.courses || []; } },
        { path: "api/admin/videos", assign: function (payload) { data.videos = payload.videos || []; } }
      ], function () {
        /* Drop selections that no longer exist. */
        if (selection.universityId && !currentUniversity()) {
          selection.universityId = "";
          selection.semester = "";
          selection.courseId = "";
        }
        if (selection.courseId && !currentCourse()) selection.courseId = "";
        if (selection.courseId) {
          /* A deep link such as videos.html?course=… fills in the rest of the
             context from the course itself. */
          var chosen = currentCourse();
          selection.universityId = chosen.universityId;
          selection.semester = String(chosen.semester);
        }
        render();
      }, function (error) {
        root.innerHTML = NT.errorState(NT.api.message(error), { title: "Cannot load the video manager" });
        var retry = root.querySelector("[data-retry]");
        if (retry) retry.addEventListener("click", reload);
      });
    }

    reload();
  }

  function pageLessons(root) {
    function render() {
      var query = (root.querySelector("#lessonSearch") || {}).value || "";
      var courseId = (root.querySelector("#lessonCourse") || {}).value || "";
      query = query.trim().toLowerCase();
      var lessons = NT.allLessons().filter(function (lesson) {
        if (courseId && lesson.courseId !== courseId) return false;
        return !query || (lesson.title + " " + lesson.courseTitle).toLowerCase().indexOf(query) !== -1;
      });
      root.innerHTML =
        '<div class="adm-toolbar"><div class="search">' + NT.icon("search") + '<input class="input" id="lessonSearch" type="search" aria-label="Search lessons" placeholder="Search lessons" value="' + NT.esc(query) + '"></div>' +
        '<select class="input" id="lessonCourse" aria-label="Filter by course"><option value="">All courses</option>' +
        D.COURSES.map(function (course) { return '<option value="' + course.id + '"' + (courseId === course.id ? " selected" : "") + ">" + NT.esc(course.title) + "</option>"; }).join("") +
        "</select><span class='spacer'></span><span class='badge badge-brand'>" + lessons.length + " lessons</span></div>" +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Lesson</th><th>Course</th><th>Package level</th></tr></thead><tbody>' +
        (lessons.length ? lessons.map(function (lesson) {
          return '<tr><td class="td-strong" data-label="Lesson">' + NT.esc(lesson.title) + "</td>" +
            '<td data-label="Course">' + NT.esc(lesson.courseTitle) + "</td>" +
            '<td data-label="Package level"><label class="sr-only" for="level-' + NT.esc(lesson.id) + '">Package level for ' + NT.esc(lesson.title) + "</label>" +
            '<select class="lvl-select" id="level-' + NT.esc(lesson.id) + '" data-lesson="' + NT.esc(lesson.id) + '">' +
            D.LEVELS.map(function (level) { return '<option value="' + level + '"' + (NT.levelOf(lesson) === level ? " selected" : "") + ">" + D.LEVEL_LABEL[level] + "</option>"; }).join("") +
            "</select></td></tr>";
        }).join("") : '<tr><td colspan="3" class="muted">No lessons match this search.</td></tr>') +
        "</tbody></table></div>";
      root.querySelector("#lessonSearch").addEventListener("input", render);
      root.querySelector("#lessonCourse").addEventListener("change", render);
      root.querySelectorAll("[data-lesson]").forEach(function (select) {
        select.addEventListener("change", function () {
          var id = select.dataset.lesson;
          NT.store.mutate(function (state) { state.lessonLevels[id] = select.value; });
          NT.toast("Lesson access updated", "success");
          render();
        });
      });
    }
    render();
  }

  function pagePackages(root) {
    function render() {
      var counts = NT.counts();
      root.innerHTML = '<div class="adm-toolbar"><p class="muted small">Preview prices only. No payment provider is connected.</p></div>' +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Package</th><th>Preview price</th><th>Lessons included</th><th>Summary</th><th></th></tr></thead><tbody>' +
        D.LEVELS.map(function (level) {
          var details = NT.packageDetails(level);
          return '<tr><td data-label="Package">' + NT.levelBadge(level) + '<small class="package-admin-name">' + NT.esc(details.name) + "</small></td>" +
            '<td data-label="Preview price"><b>' + NT.kwacha(NT.packagePrice(level)) + "</b></td>" +
            '<td data-label="Lessons included">' + NT.availableFor(level) + " of " + counts.total + "</td>" +
            '<td data-label="Summary"><span class="small muted">' + NT.esc(details.features.join(" · ")) + "</span></td>" +
            '<td data-label="Edit"><button class="btn btn-sm btn-secondary" type="button" data-edit="' + level + '">' + NT.icon("pencil", "icon-sm") + "Edit</button></td></tr>";
        }).join("") +
        "</tbody></table></div>";
      root.querySelectorAll("[data-edit]").forEach(function (button) {
        button.addEventListener("click", function () { editPackage(button.dataset.edit); });
      });
    }

    function editPackage(level) {
      var details = NT.packageDetails(level);
      var modal = NT.modal({
        title: "Edit " + details.name + " package",
        body: '<div class="settings-form"><div class="field"><label for="packageName">Package name</label><input class="input" id="packageName" maxlength="40" value="' + NT.esc(details.name) + '"></div>' +
          '<div class="field"><label for="packagePrice">Preview price (K)</label><input class="input" id="packagePrice" type="number" min="0" value="' + NT.packagePrice(level) + '"></div>' +
          '<div class="field"><label for="packageFeatures">What is included</label><textarea class="input" id="packageFeatures" rows="3">' + NT.esc(details.features.join("\n")) + '</textarea><span class="field-hint">Enter one concise item per line.</span></div>' +
          '<p class="field-hint">Changes apply to this browser preview only.</p></div>',
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="savePackage">Save changes</button>'
      });
      modal.querySelector("#savePackage").addEventListener("click", function () {
        var name = modal.querySelector("#packageName").value.trim();
        var price = Number(modal.querySelector("#packagePrice").value);
        if (!name || !Number.isFinite(price) || price < 0) {
          NT.toast("Enter a package name and valid preview price", "error");
          return;
        }
        var features = modal.querySelector("#packageFeatures").value.split("\n").map(function (item) { return item.trim(); }).filter(Boolean);
        NT.store.mutate(function (state) {
          state.packages[level] = price;
          state.packageDetails[level] = Object.assign({}, state.packageDetails[level] || {}, { name: name, features: features });
        });
        modal.close();
        NT.toast("Package preview updated", "success");
        render();
      });
    }
    render();
  }

  function pageCodes(root) {
    function render() {
      var codes = NT.store.get().codes;
      root.innerHTML = '<div class="adm-card code-admin-card"><div class="adm-card-head"><div><h2>Generate a preview code</h2><span class="sub">Codes created here can be redeemed on this device only.</span></div></div>' +
        '<div class="adm-card-body"><div class="codegen"><div class="field"><label for="codePackage">Package</label><select class="input" id="codePackage">' +
        D.LEVELS.map(function (level) { return '<option value="' + level + '">' + D.LEVEL_LABEL[level] + "</option>"; }).join("") +
        '</select></div><button class="btn btn-primary" type="button" id="generateAdminCode">' + NT.icon("key") + "Generate code</button></div></div></div>" +
        (codes.length ? '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Code</th><th>Package</th><th>Status</th><th>Created</th></tr></thead><tbody>' +
          codes.map(function (record) {
            return '<tr><td data-label="Code" class="mono td-strong">' + NT.esc(record.code) + "</td>" +
              '<td data-label="Package">' + NT.levelBadge(record.pkg) + "</td>" +
              '<td data-label="Status">' + badge(record.status) + "</td>" +
              '<td data-label="Created">' + NT.fmtDate(record.created) + "</td></tr>";
          }).join("") + "</tbody></table></div>" : '<div class="adm-card"><div class="adm-card-body"><p class="muted">No preview codes have been generated in this browser.</p></div></div>');
      root.querySelector("#generateAdminCode").addEventListener("click", function () {
        var packageId = root.querySelector("#codePackage").value;
        var code;
        do { code = NT.store.genCode(packageId); } while (NT.store.findCode(code));
        NT.store.addCode(code, packageId, "unused");
        NT.toast("Preview code generated", "success");
        render();
      });
    }
    render();
  }

  function pageAnnouncements(root) {
    function render() {
      var notices = NT.store.get().announcements.slice().sort(function (a, b) {
        return new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0);
      });
      root.innerHTML = '<div class="adm-toolbar"><p class="muted small">Announcements are stored in this browser and are not shared to other visitors.</p></div>' +
        '<section class="adm-card"><div class="adm-card-head"><h2>New announcement</h2></div><div class="adm-card-body"><form id="announcementForm" class="settings-form">' +
        '<div class="field"><label for="announcementTitle">Title</label><input class="input" id="announcementTitle" maxlength="120" required></div>' +
        '<div class="field"><label for="announcementBody">Message</label><textarea class="input" id="announcementBody" rows="4" maxlength="1200" required></textarea></div>' +
        '<div class="field"><label for="announcementStatus">Status</label><select class="input" id="announcementStatus"><option value="draft">Draft</option><option value="published">Published</option></select></div>' +
        '<button class="btn btn-primary" type="submit">' + NT.icon("plus") + "Save announcement</button></form></div></section>" +
        '<section class="adm-card announcement-admin-list-card"><div class="adm-card-head"><h2>Saved announcements</h2></div><div class="adm-card-body"><div class="announcement-admin-list">' +
        (notices.length ? notices.map(function (notice) {
          return '<article class="announcement-admin-item"><div><div class="announcement-admin-meta">' + badge(notice.status) + "<span>" + NT.fmtDate(notice.updated || notice.created) + "</span></div>" +
            '<h3>' + NT.esc(notice.title) + '</h3><p>' + NT.esc(notice.body) + "</p></div>" +
            '<div class="announcement-admin-actions"><select class="input" aria-label="Status for ' + NT.esc(notice.title) + '" data-status="' + NT.esc(notice.id) + '"><option value="draft"' + (notice.status === "draft" ? " selected" : "") + '>Draft</option><option value="published"' + (notice.status === "published" ? " selected" : "") + '>Published</option></select>' +
            '<button class="btn btn-sm btn-secondary" type="button" data-edit="' + NT.esc(notice.id) + '">Edit</button>' +
            '<button class="btn btn-sm btn-danger-soft" type="button" data-delete="' + NT.esc(notice.id) + '">Delete</button></div></article>';
        }).join("") : '<p class="muted">No announcements have been created.</p>') +
        "</div></div></section>";

      root.querySelector("#announcementForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var title = root.querySelector("#announcementTitle").value.trim();
        var body = root.querySelector("#announcementBody").value.trim();
        if (!title || !body) return;
        NT.store.addAnnouncement({ title: title, body: body, status: root.querySelector("#announcementStatus").value, updated: new Date().toISOString() });
        NT.toast("Announcement saved locally", "success");
        render();
      });
      root.querySelectorAll("[data-status]").forEach(function (select) {
        select.addEventListener("change", function () {
          NT.store.updateAnnouncement(select.dataset.status, { status: select.value, updated: new Date().toISOString() });
          render();
        });
      });
      root.querySelectorAll("[data-edit]").forEach(function (button) {
        button.addEventListener("click", function () { editAnnouncement(button.dataset.edit); });
      });
      root.querySelectorAll("[data-delete]").forEach(function (button) {
        button.addEventListener("click", function () {
          NT.store.removeAnnouncement(button.dataset.delete);
          NT.toast("Announcement deleted", "success");
          render();
        });
      });
    }

    function editAnnouncement(id) {
      var notice = NT.store.get().announcements.filter(function (item) { return String(item.id) === String(id); })[0];
      if (!notice) return;
      var modal = NT.modal({
        title: "Edit announcement",
        body: '<div class="settings-form"><div class="field"><label for="editTitle">Title</label><input class="input" id="editTitle" maxlength="120" value="' + NT.esc(notice.title) + '"></div>' +
          '<div class="field"><label for="editBody">Message</label><textarea class="input" id="editBody" rows="5" maxlength="1200">' + NT.esc(notice.body) + '</textarea></div></div>',
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="saveEdit">Save changes</button>'
      });
      modal.querySelector("#saveEdit").addEventListener("click", function () {
        var title = modal.querySelector("#editTitle").value.trim();
        var body = modal.querySelector("#editBody").value.trim();
        if (!title || !body) return;
        NT.store.updateAnnouncement(id, { title: title, body: body, updated: new Date().toISOString() });
        modal.close();
        render();
      });
    }
    render();
  }

  /* ============================ SETTINGS ============================ */
  function pageSettings(root) {
    var settings = NT.store.get().settings;
    root.innerHTML =
      '<div class="adm-grid-2 settings-grid">' +
      '<section class="adm-card"><div class="adm-card-head"><h2>Admin sign-in</h2>' +
      '<span class="sub">Server-side session</span></div><div class="adm-card-body" id="adminAccountCard">' +
      NT.spinner("Loading account") + "</div></section>" +
      '<section class="adm-card"><div class="adm-card-head"><h2>Content service</h2>' +
      '<span class="sub">Shared by every device</span></div><div class="adm-card-body" id="serviceCard">' +
      NT.spinner("Checking service") + "</div></section>" +
      "</div>" +
      '<section class="adm-card"><div class="adm-card-head"><h2>Preview settings</h2>' +
      '<span class="sub">This browser only</span></div><div class="adm-card-body">' +
      '<form id="settingsForm" class="settings-form"><div class="field"><label for="supportEmail">Support email <span class="muted">(optional)</span></label>' +
      '<input class="input" id="supportEmail" type="email" value="' + NT.esc(settings.email) + '">' +
      '<span class="field-hint">If set, this address appears in the public footer.</span></div>' +
      '<div class="field"><label for="accessDays">Access period (days)</label>' +
      '<input class="input" id="accessDays" type="number" min="1" value="' + Number(settings.days) + '">' +
      '<span class="field-hint">Used to show when a redeemed code expires on this device.</span></div>' +
      '<button class="btn btn-primary" type="submit">' + NT.icon("check") + "Save preview settings</button></form></div></section>" +
      '<section class="adm-card reset-card"><div class="adm-card-head"><h2>Reset local preview data</h2></div>' +
      '<div class="adm-card-body"><p class="muted">Clears this browser\'s access, generated codes, preferences, announcements, package edits and lesson access overrides. ' +
      "Universities, courses and video lessons live in the server database and are <b>not</b> affected.</p>" +
      '<button class="btn btn-danger-soft" id="resetLocalData">' + NT.icon("rotate") + "Reset this browser</button></div></section>";

    /* ---- admin account ---- */
    var accountHost = document.getElementById("adminAccountCard");
    NT.api.load("api/admin/session", function (data) {
      var admin = data.admin || {};
      accountHost.innerHTML =
        '<div class="kv"><div class="row"><span>Signed in as</span><b>' + NT.esc(admin.email || "—") + "</b></div>" +
        '<div class="row"><span>Role</span><b>' + NT.esc(NT.cap(admin.role || "admin")) + "</b></div>" +
        '<div class="row"><span>Last sign-in</span><b>' + NT.esc(admin.lastLoginAt ? NT.fmtDate(admin.lastLoginAt) : "This session") + "</b></div>" +
        '<div class="row"><span>Active sessions</span><b>' + data.activeSessions + "</b></div>" +
        '<div class="row"><span>Session length</span><b>' + data.sessionDays + " days</b></div></div>" +
        '<form id="passwordForm" class="settings-form password-form">' +
        '<div class="field"><label for="currentPassword">Current password</label>' +
        '<input class="input" id="currentPassword" type="password" autocomplete="current-password" required></div>' +
        '<div class="field-row">' +
        '<div class="field"><label for="newPassword">New password</label>' +
        '<input class="input" id="newPassword" type="password" autocomplete="new-password" minlength="10" required>' +
        '<span class="field-hint">At least 10 characters.</span></div>' +
        '<div class="field"><label for="confirmPassword">Confirm new password</label>' +
        '<input class="input" id="confirmPassword" type="password" autocomplete="new-password" minlength="10" required></div>' +
        "</div>" +
        '<div class="password-form-actions"><button class="btn btn-secondary" type="submit">' + NT.icon("key") + "Change password</button>" +
        '<button class="btn btn-ghost" type="button" id="signOutButton">' + NT.icon("log-out") + "Sign out</button></div>" +
        "</form>";

      var signOutButton = document.getElementById("signOutButton");
      if (signOutButton) signOutButton.addEventListener("click", function () { signOutNow(); });
      var passwordForm = document.getElementById("passwordForm");
      if (passwordForm) passwordForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var current = document.getElementById("currentPassword").value;
        var next = document.getElementById("newPassword").value;
        var confirm = document.getElementById("confirmPassword").value;
        if (next !== confirm) {
          NT.toast("The new passwords do not match", "error");
          return;
        }
        if (next.length < 10) {
          NT.toast("Use at least 10 characters", "error");
          return;
        }
        var submit = passwordForm.querySelector("button[type='submit']");
        busy(submit, "Updating");
        NT.api.put("api/admin/password", { currentPassword: current, newPassword: next }).then(function () {
          NT.toast("Password changed. Other devices were signed out.", "success");
          passwordForm.reset ? passwordForm.reset() : null;
          notBusy(submit);
        }, function (error) {
          notBusy(submit);
          NT.toast(NT.api.message(error, "Could not change the password"), "error");
        });
      });
    }, function (error) {
      accountHost.innerHTML = NT.errorState(NT.api.message(error), { title: "Cannot load the admin account" });
    });

    /* ---- content service ---- */
    var serviceHost = document.getElementById("serviceCard");
    NT.api.load("api/health", function (health) {
      NT.api.load("api/admin/overview", function (overview) {
        serviceHost.innerHTML =
          '<div class="service-status"><span class="service-dot"></span><b>Connected</b>' +
          "<small>Universities, courses and video lessons are stored in the server database and shared by every device.</small></div>" +
          '<div class="kv"><div class="row"><span>Universities</span><b>' + overview.universities + " (" + overview.publishedUniversities + " published)</b></div>" +
          '<div class="row"><span>Courses</span><b>' + overview.courses + " · Semester 1: " + overview.semester1Courses + " · Semester 2: " + overview.semester2Courses + "</b></div>" +
          '<div class="row"><span>Video lessons</span><b>' + overview.videos + " (" + overview.publishedVideos + " published, " + overview.draftVideos + " drafts)</b></div>" +
          '<div class="row"><span>Published runtime</span><b>' + NT.esc(NT.durationWords(overview.durationSeconds) || "—") + "</b></div>" +
          '<div class="row"><span>Schema version</span><b class="mono">' + NT.esc(String(health.schemaVersion)) + "</b></div></div>" +
          '<a class="btn btn-secondary btn-sm" href="videos.html">' + NT.icon("video", "icon-sm") + "Manage video lessons</a>";
      }, function (error) {
        serviceHost.innerHTML = NT.errorState(NT.api.message(error), { title: "Cannot load content counts" });
      });
    }, function (error) {
      serviceHost.innerHTML =
        '<div class="service-status is-down">' + NT.icon("wifi-off") + "<b>Not reachable</b>" +
        "<small>" + NT.esc(NT.api.message(error)) + "</small></div>";
    });

    /* ---- local preview settings ---- */
    root.querySelector("#settingsForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var email = root.querySelector("#supportEmail").value.trim();
      var days = parseInt(root.querySelector("#accessDays").value, 10);
      if ((email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || isNaN(days) || days < 1) {
        NT.toast("Enter a valid email or leave it blank, and set an access period", "error");
        return;
      }
      NT.store.mutate(function (state) { state.settings.email = email; state.settings.days = days; });
      NT.toast("Preview settings saved", "success");
    });
    root.querySelector("#resetLocalData").addEventListener("click", function () {
      var modal = NT.modal({
        title: "Reset this browser?",
        body: "<p class=\"muted\">This clears locally stored access codes, preferences, announcements and preview settings. Server content is untouched.</p>",
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger-soft" id="confirmReset">Reset</button>'
      });
      modal.querySelector("#confirmReset").addEventListener("click", function () {
        NT.store.reset();
        location.reload();
      });
    });
  }

  /* ============================ SIGN-IN PAGE ============================
     Rendered without the admin shell. On success the administrator is sent to
     the page they originally asked for. */
  function pageLogin() {
    var brand = document.getElementById("adminLoginBrand");
    var form = document.getElementById("adminLoginForm");
    var message = document.getElementById("adminLoginMessage");
    var note = document.getElementById("adminLoginNote");
    var submit = document.getElementById("adminLoginSubmit");
    if (brand) {
      brand.innerHTML = NT.logoImg("brand-logo") + '<span class="brand-name">Nuclear <span>Tutorials</span></span>';
    }
    if (note) {
      note.innerHTML = NT.icon("info", "icon-sm") +
        "<span>First run? The administrator email and password were printed in the server log and saved to " +
        "<code>data/first-run-admin.txt</code>. Change the password after signing in.</span>";
    }

    /* The server redirects unauthenticated requests to
       login.html?next=%2Fadmin%2Fvideos.html, so both that absolute path and a
       plain file name are accepted — anything else (including protocol-relative
       or external destinations) falls back to the overview. */
    var requested = NT.qs("next") || "";
    var allowed = /^(?:\/admin\/)?([a-z0-9-]+\.html)(\?[^\s#]*)?$/i.exec(requested);
    var next = allowed ? allowed[1] + (allowed[2] || "") : "index.html";

    NT.api.load("api/admin/session", function (data) {
      if (data && data.admin) {
        message.innerHTML = '<div class="alert alert-success">' + NT.icon("check-circle") +
          "<div><b>Already signed in as " + NT.esc(data.admin.email) + ".</b></div></div>";
        if (form) form.classList.add("hidden");
        if (submit) submit.remove();
        var card = document.querySelector(".admin-login-card");
        if (card) {
          var continueLink = document.createElement("a");
          continueLink.className = "btn btn-primary btn-block";
          continueLink.href = next;
          continueLink.innerHTML = NT.icon("arrow-right") + "Continue to the admin area";
          card.appendChild(continueLink);
        }
      }
    });

    if (form) form.addEventListener("submit", function (event) {
      event.preventDefault();
      message.innerHTML = "";
      var email = document.getElementById("adminEmail").value.trim();
      var password = document.getElementById("adminPassword").value;
      if (!email || !password) {
        message.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") +
          "<div><b>Enter your email and password.</b></div></div>";
        return;
      }
      busy(submit, "Signing in");
      NT.api.post("api/admin/login", { email: email, password: password }).then(function (data) {
        NT.toast("Signed in as " + data.admin.email, "success");
        location.href = next;
      }, function (error) {
        notBusy(submit);
        var detail = error.status === 429
          ? "Too many failed attempts. Wait a few minutes, then try again."
          : "That email and password combination is not recognised.";
        message.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") +
          "<div><b>Sign-in failed.</b><br>" + NT.esc(detail) + "</div></div>";
        document.getElementById("adminPassword").value = "";
        document.getElementById("adminPassword").focus();
      });
    });
  }

  var ROUTES = {
    home: pageHome,
    universities: pageUniversities,
    courses: pageCourses,
    videos: pageVideos,
    lessons: pageLessons,
    announcements: pageAnnouncements,
    packages: pagePackages,
    codes: pageCodes,
    settings: pageSettings,
    login: pageLogin
  };

  document.addEventListener("DOMContentLoaded", function () {
    var requested = document.body.dataset.admin || "home";
    if (requested === "login") {
      pageLogin();
      return;
    }
    var page = ROUTES[requested] ? requested : "home";
    var root = renderShell();
    requireAdmin(root, function () {
      ROUTES[page](root);
    });
  });
})();
