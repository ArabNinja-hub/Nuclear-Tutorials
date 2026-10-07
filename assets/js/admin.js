/* ============================================================
   NUCLEAR TUTORIALS — Administration
   Sign-in gate + catalogue management (universities, semesters,
   courses, video lessons, codes, announcements, settings).

   Every change goes to the server API, so students on other
   devices see it immediately.
   ============================================================ */
(function () {
  var D = NT.data;
  var root = document.getElementById("adminRoot");

  /* Add real column labels before admin tables become compact mobile cards. */
  function labelAdminTables(scope) {
    if (!scope) return;
    scope.querySelectorAll("table.nt-table").forEach(function (table) {
      var headers = Array.prototype.slice.call(table.querySelectorAll("thead th")).map(function (cell) {
        return cell.textContent.trim();
      });
      table.querySelectorAll("tbody tr").forEach(function (row) {
        Array.prototype.slice.call(row.cells).forEach(function (cell, index) {
          if (headers[index]) cell.setAttribute("data-label", headers[index]);
        });
      });
      table.setAttribute("data-mobile-labelled", "true");
    });
  }

  if (root && window.MutationObserver) {
    new MutationObserver(function () { labelAdminTables(root); }).observe(root, { childList: true, subtree: true });
  }

  var NAV = [
    { route: "home", href: "index.html", label: "Overview", icon: "layout-dashboard" },
    { route: "courses", href: "courses.html", label: "Universities & courses", icon: "building" },
    { route: "lessons", href: "lessons.html", label: "Video lessons", icon: "video" },
    { route: "codes", href: "codes.html", label: "Access codes", icon: "key" },
    { route: "enquiries", href: "enquiries.html", label: "Payment enquiries", icon: "message-circle" },
    { route: "announcements", href: "announcements.html", label: "Announcements", icon: "bell" },
    { route: "packages", href: "packages.html", label: "Packages", icon: "layers" },
    { route: "settings", href: "settings.html", label: "Settings", icon: "settings" }
  ];

  /* Icons offered when creating a course. Kept next to the icon set so the
     library check can confirm every option exists. */
  var ICON_CHOICES = ["book-open", "calculator", "atom", "code", "sigma", "flask-conical", "microscope", "chart-line", "cpu", "leaf"];

  var TITLES = {
    home: { title: "Overview", sub: "Catalogue activity and quick actions" },
    courses: { title: "Universities & courses", sub: "Organise the catalogue by institution and semester" },
    lessons: { title: "Video lessons", sub: "Add, order, publish and edit lessons inside a course" },
    codes: { title: "Access codes", sub: "Issue and manage student access" },
    enquiries: { title: "Payment enquiries", sub: "Confirm WhatsApp payments and email student access codes" },
    announcements: { title: "Announcements", sub: "Short updates shown to students" },
    packages: { title: "Access packages", sub: "Names, prices and what each package includes" },
    settings: { title: "Settings", sub: "Support contact, access period and administrator password" }
  };

  /* ------------------------------------------------------------ shell */

  function shell(route, content, actions) {
    var meta = TITLES[route] || TITLES.home;
    var navMarkup = NAV.map(function (item) {
      var active = item.route === route;
      return '<a class="adm-nav-link' + (active ? " active" : "") + '" href="' + item.href + '"' +
        (active ? ' aria-current="page"' : "") + ">" + NT.icon(item.icon) + "<span>" + item.label + "</span></a>";
    }).join("");

    root.innerHTML =
      '<div class="adm-shell">' +
      '<div class="adm-scrim" id="admScrim" hidden></div>' +
      '<aside class="adm-side" id="admSide" aria-label="Administration">' +
      '<a class="adm-brand" href="../index.html">' +
      '<img src="../assets/img/logo.jpg" alt="" width="34" height="34">' +
      '<span><b>Nuclear Tutorials</b><small>Administration</small></span></a>' +
      '<nav class="adm-nav">' + navMarkup + "</nav>" +
      '<div class="adm-side-foot">' +
      '<a class="adm-nav-link" href="../index.html" target="_blank" rel="noopener">' + NT.icon("external") + "<span>View student site</span></a>" +
      '<button class="adm-nav-link" type="button" id="admLogout">' + NT.icon("log-out") + "<span>Sign out</span></button>" +
      "</div></aside>" +
      '<div class="adm-main">' +
      '<header class="adm-topbar">' +
      '<button class="adm-burger" type="button" id="admBurger" aria-label="Open administration menu" aria-expanded="false">' +
      NT.icon("menu") + "</button>" +
      "<div><h1>" + meta.title + "</h1><p>" + meta.sub + "</p></div>" +
      '<div class="adm-topbar-actions">' + (actions || "") + "</div>" +
      "</header>" +
      '<div class="adm-content" id="admContent">' + content + "</div></div></div>";

    var burger = document.getElementById("admBurger");
    var side = document.getElementById("admSide");
    var scrim = document.getElementById("admScrim");
    function close() { document.body.classList.remove("side-open"); scrim.hidden = true; burger.setAttribute("aria-expanded", "false"); }
    burger.addEventListener("click", function () {
      var open = document.body.classList.toggle("side-open");
      scrim.hidden = !open;
      burger.setAttribute("aria-expanded", String(open));
    });
    scrim.addEventListener("click", close);
    side.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", close); });

    document.getElementById("admLogout").addEventListener("click", function () {
      NT.api.admin.logout().then(function () {
        location.href = "login.html";
      }, function () {
        location.href = "login.html";
      });
    });
  }

  function loading(label) {
    return '<div class="adm-loading"><span class="adm-spin" aria-hidden="true"></span><p>' +
      NT.esc(label || "Loading from the server…") + "</p></div>";
  }

  function fail(host, error, retry) {
    var message = error && error.status === 401
      ? "Your administrator session expired. Sign in again."
      : (error && error.message) || "Something went wrong.";
    host.innerHTML = '<div class="adm-empty"><span class="empty-icon">' + NT.icon("circle-alert", "icon-lg") + "</span>" +
      "<h2>Could not load this page</h2><p>" + NT.esc(message) + "</p></div>";
    if (error && error.status === 401) window.setTimeout(function () { location.href = "login.html"; }, 1200);
    if (retry) NT.toast(message, "error");
  }

  function option(value, label, current) {
    return '<option value="' + NT.esc(value) + '"' + (String(current) === String(value) ? " selected" : "") + ">" + NT.esc(label) + "</option>";
  }

  function levelOptions(current) {
    return D.LEVELS.map(function (level) { return option(level, D.LEVEL_LABEL[level], current); }).join("");
  }

  function slugHint(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  }

  /* Reload the public catalogue so student-facing copy stays in sync. */
  function refreshCatalogue() {
    NT.content.reload().catch(function () { /* offline is handled per page */ });
  }

  /* ------------------------------------------------------------ login */

  function pageLogin() {
    if (!root) return;
    document.body.classList.add("adm-login-body");
    root.innerHTML =
      '<div class="adm-login">' +
      '<div class="adm-login-card">' +
      '<a class="adm-brand adm-brand-center" href="../index.html">' +
      '<img src="../assets/img/logo.jpg" alt="" width="42" height="42">' +
      '<span><b>Nuclear Tutorials</b><small>Administration</small></span></a>' +
      "<h1>Administrator sign-in</h1>" +
      '<p class="muted">The dashboard manages universities, semesters, courses and video lessons. ' +
      "Students never see these controls.</p>" +
      '<form id="admLoginForm" novalidate>' +
      '<div class="field"><label for="admPassword">Administrator password</label>' +
      '<input class="input" id="admPassword" name="password" type="password" autocomplete="current-password" ' +
      'placeholder="Enter your password" required aria-describedby="admLoginHelp"></div>' +
      '<p class="field-hint" id="admLoginHelp">On a fresh install the first-run password is printed once in the server log. ' +
      "It must be changed before the catalogue can be managed.</p>" +
      '<div class="adm-login-message" id="admLoginMessage" aria-live="polite"></div>' +
      '<button class="btn btn-primary btn-block btn-lg" type="submit" id="admLoginSubmit">' + NT.icon("log-in") + "Sign in</button>" +
      "</form>" +
      '<a class="link-arrow adm-login-back" href="../index.html">' + NT.icon("arrow-left", "icon-sm") + "Back to the student site</a>" +
      "</div></div>";

    var form = document.getElementById("admLoginForm");
    var message = document.getElementById("admLoginMessage");
    var submit = document.getElementById("admLoginSubmit");
    var input = document.getElementById("admPassword");

    NT.api.admin.session().then(function (payload) {
      if (!payload.authenticated) return;
      /* An un-rotated session belongs on the first-run screen, not in the
         catalogue. */
      location.replace(payload.mustChangePassword ? "first-run.html" : "index.html");
    }, function () { /* server unreachable — let the form explain */ });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var password = input.value;
      if (!password) {
        message.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div>Enter the administrator password.</div></div>";
        input.focus();
        return;
      }
      submit.disabled = true;
      NT.api.admin.login(password).then(function (payload) {
        if (payload && payload.mustChangePassword) {
          /* First run: the console stays locked until a real password is set,
             so go straight to that screen instead of a catalogue page. */
          location.href = "first-run.html";
          return;
        }
        location.href = NT.qs("next") || "index.html";
      }, function (error) {
        submit.disabled = false;
        var text = error.status === 0 ? "The server is unreachable. Start Nuclear Tutorials and try again." : error.message;
        message.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div>" + NT.esc(text) + "</div></div>";
        input.select();
      });
    });
  }

  /* ------------------------------------------------------------ first run

     Shown after signing in with the first-run password and whenever a
     protected admin page is opened while the rotation is still pending.
     It is the only screen the server lets an un-rotated session use: it
     explains the situation and replaces the temporary password with the
     administrator's own. No catalogue endpoint is called here. */

  function pageFirstRun() {
    if (!root) return;
    document.body.classList.add("adm-login-body");
    root.innerHTML =
      '<div class="adm-login">' +
      '<div class="adm-login-card">' +
      '<a class="adm-brand adm-brand-center" href="../index.html">' +
      '<img src="../assets/img/logo.jpg" alt="" width="42" height="42">' +
      '<span><b>Nuclear Tutorials</b><small>Administration</small></span></a>' +
      "<h1>Set your administrator password</h1>" +
      '<p class="muted">This installation is still using its first-run password, so the Admin Console stays ' +
      "locked. Choose the password you will sign in with from now on and the console opens immediately.</p>" +
      '<form id="admFirstRunForm" novalidate>' +
      '<div class="field"><label for="frCurrent">First-run password</label>' +
      '<input class="input" id="frCurrent" type="password" autocomplete="current-password" ' +
      'placeholder="The password you just signed in with" required></div>' +
      '<div class="field"><label for="frNext">New password</label>' +
      '<input class="input" id="frNext" type="password" autocomplete="new-password" ' +
      'placeholder="At least 8 characters" required></div>' +
      '<div class="field"><label for="frConfirm">Confirm new password</label>' +
      '<input class="input" id="frConfirm" type="password" autocomplete="new-password" ' +
      'placeholder="Type the new password again" required></div>' +
      '<p class="field-hint">Use at least 8 characters, and never reuse the first-run password from the ' +
      "server log. Setting it signs out every other administrator session.</p>" +
      '<div class="adm-login-message" id="admFirstRunMessage" aria-live="polite"></div>' +
      '<button class="btn btn-primary btn-block btn-lg" type="submit" id="admFirstRunSubmit">' +
      NT.icon("key") + "Set password</button>" +
      "</form>" +
      '<button class="btn btn-secondary btn-block" type="button" id="admFirstRunSignOut">' +
      NT.icon("log-out") + "Sign out</button>" +
      '<a class="link-arrow adm-login-back" href="../index.html">' +
      NT.icon("arrow-left", "icon-sm") + "Back to the student site</a>" +
      "</div></div>";

    var form = document.getElementById("admFirstRunForm");
    var message = document.getElementById("admFirstRunMessage");
    var submit = document.getElementById("admFirstRunSubmit");
    var current = document.getElementById("frCurrent");
    var next = document.getElementById("frNext");
    var confirm = document.getElementById("frConfirm");

    function complain(text) {
      message.innerHTML = '<div class="alert alert-error">' + NT.icon("circle-alert") + "<div>" + NT.esc(text) + "</div></div>";
    }

    document.getElementById("admFirstRunSignOut").addEventListener("click", function () {
      NT.api.admin.logout().then(function () {
        location.href = "login.html";
      }, function () {
        location.href = "login.html";
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      message.innerHTML = "";
      if (!current.value) { complain("Enter the first-run password you signed in with."); current.focus(); return; }
      if (!next.value) { complain("Choose a new administrator password."); next.focus(); return; }
      if (next.value.length < 8) { complain("Use at least 8 characters for the new password."); next.focus(); return; }
      if (confirm.value !== next.value) { complain("The two new passwords do not match."); confirm.focus(); return; }
      submit.disabled = true;
      NT.api.admin.changePassword(current.value, next.value, confirm.value).then(function () {
        /* The server clears the rotation flag and issues a fresh session, so
           the dashboard loads normally from here on. */
        NT.toast("Password set. Loading the Admin Console…", "success");
        window.setTimeout(function () { location.href = "index.html"; }, 600);
      }, function (error) {
        submit.disabled = false;
        var text = error.status === 0 ? "The server is unreachable. Start Nuclear Tutorials and try again." : error.message;
        complain(text);
        if (error.status === 401) current.select();
      });
    });

    current.focus();
  }

  /* ------------------------------------------------------------ overview */

  function pageHome() {
    shell("home", loading(), '<a class="btn btn-primary btn-sm" href="lessons.html" aria-label="Add a video lesson" title="Add a video lesson">' + NT.icon("plus") + "<span>Add a video lesson</span></a>");
    var host = document.getElementById("admContent");
    NT.api.admin.overview().then(function (payload) {
      var totals = payload.totals || {};
      var cards = [
        { label: "Universities", value: totals.universities, hint: totals.schools + " secondary pathway" },
        { label: "Courses", value: totals.courses, hint: "Semester 1 and 2" },
        { label: "Video lessons", value: totals.videos, hint: totals.published + " published · " + totals.drafts + " draft" },
        { label: "Access codes", value: totals.codes, hint: totals.codesRedeemed + " redeemed" },
        { label: "Students seen", value: totals.students, hint: totals.views + " progress records" }
      ];
      var stats = '<div class="adm-cards">' + cards.map(function (card) {
        return '<article class="adm-card adm-stat"><span class="adm-stat-value">' + card.value + "</span>" +
          '<span class="adm-stat-label">' + card.label + "</span>" +
          '<span class="adm-stat-hint">' + NT.esc(card.hint) + "</span></article>";
      }).join("") + "</div>";

      var semesters = '<section class="adm-card adm-block"><div class="adm-block-head"><h2>Semester coverage</h2>' +
        "<p>Lessons are grouped by the semester you selected when adding them.</p></div>" +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Semester</th><th>Courses</th><th>Video lessons</th><th></th></tr></thead><tbody>' +
        (payload.semesters || []).map(function (row) {
          return "<tr><td class='td-strong'>" + NT.esc(NT.semesterLabel(row.semester)) + "</td><td>" + row.courses + "</td><td>" + row.videos + "</td>" +
            '<td class="adm-row-end"><a class="btn btn-secondary btn-sm" href="lessons.html?semester=' + row.semester + '">Manage lessons</a></td></tr>';
        }).join("") + "</tbody></table></div></section>";

      var recent = '<section class="adm-card adm-block"><div class="adm-block-head"><h2>Recently added lessons</h2>' +
        "<p>The latest video lessons in the catalogue, newest first.</p></div>" +
        (payload.recentVideos && payload.recentVideos.length
          ? videoTable(payload.recentVideos, { compact: true })
          : '<div class="adm-empty-inline">No lessons yet. <a href="lessons.html">Add the first one</a>.</div>') + "</section>";

      var universities = '<section class="adm-card adm-block"><div class="adm-block-head"><h2>Your institutions</h2>' +
        "<p>Each university keeps its own semester and course structure.</p></div>" +
        '<div class="adm-chip-row">' + (payload.universities || []).map(function (item) {
          return '<a class="adm-chip" href="courses.html?university=' + encodeURIComponent(item.id) + '">' +
            NT.icon(item.level === "high-school" ? "book-open" : "building", "icon-sm") +
            NT.esc(item.name) + "<span>" + item.courseCount + " courses</span></a>";
        }).join("") + "</div></section>";

      host.innerHTML = stats + semesters + recent + universities;
    }, function (error) { fail(host, error); });
  }

  /* ------------------------------------------------------------ universities & courses */

  function pageCourses() {
    shell("courses", loading());
    var host = document.getElementById("admContent");
    var state = { universityId: "", semester: 1 };

    Promise.all([NT.api.admin.universities(), NT.api.admin.courses({})]).then(function (results) {
      var universities = results[0].universities || [];
      var courses = results[1].courses || [];
      var query = NT.qs("university");
      state.universityId = universities.some(function (item) { return item.id === query; })
        ? query
        : (universities[0] ? universities[0].id : "");
      var semesterQuery = parseInt(NT.qs("semester"), 10);
      if (semesterQuery === 1 || semesterQuery === 2) state.semester = semesterQuery;
      else {
        var first = courses.filter(function (item) { return item.universityId === state.universityId; })[0];
        if (first) state.semester = first.semester;
      }

      function coursesOf() {
        return courses.filter(function (item) { return item.universityId === state.universityId && item.semester === state.semester; });
      }

      function render() {
        var university = universities.filter(function (item) { return item.id === state.universityId; })[0];
        var counts = { 1: 0, 2: 0 };
        courses.filter(function (item) { return item.universityId === state.universityId; }).forEach(function (item) {
          counts[item.semester] = (counts[item.semester] || 0) + 1;
        });

        var institutionPanel = '<section class="adm-card adm-block"><div class="adm-block-head">' +
          '<div><h2>Universities and schools</h2><p>A course always belongs to one institution and one semester.</p></div>' +
          '<button class="btn btn-primary btn-sm" type="button" id="addUniversity">' + NT.icon("plus") + "Add institution</button></div>" +
          '<div class="adm-list">' + universities.map(function (item) {
            var active = item.id === state.universityId;
            return '<div class="adm-list-row' + (active ? " is-active" : "") + '">' +
              '<button class="adm-list-pick" type="button" data-university="' + NT.esc(item.id) + '">' +
              "<b>" + NT.esc(item.name) + "</b>" +
              "<span>" + NT.esc(item.level === "high-school" ? "Secondary school pathway" : (item.city || "University")) +
              " · " + item.courseCount + " courses · " + item.videoCount + " lessons</span></button>" +
              '<div class="adm-row-actions">' +
              '<button class="btn btn-ghost btn-sm" type="button" data-edit-university="' + NT.esc(item.id) + '">' + NT.icon("pencil") + "Edit</button>" +
              '<button class="btn btn-ghost btn-sm adm-danger" type="button" data-delete-university="' + NT.esc(item.id) + '">' + NT.icon("trash") + "</button>" +
              "</div></div>";
          }).join("") + "</div></section>";

        var coursePanel = '<section class="adm-card adm-block"><div class="adm-context">' +
          '<span class="adm-context-label">Editing</span>' +
          '<span class="adm-context-item">' + NT.icon("building", "icon-sm") + "<b>" + NT.esc(university ? university.name : "No institution") + "</b></span>" +
          '<span class="adm-context-item">' + NT.icon("calendar", "icon-sm") + "<b>" + NT.esc(NT.semesterLabel(state.semester)) + "</b></span>" +
          '<span class="adm-context-item">' + NT.icon("book-open", "icon-sm") + "<b>" + counts[state.semester] + " courses</b></span></div>" +
          '<div class="adm-toolbar"><div class="segmented" role="group" aria-label="Semester being edited">' +
          [1, 2].map(function (semester) {
            return '<button type="button" data-semester="' + semester + '" class="' + (state.semester === semester ? "active" : "") + '">' +
              NT.semesterLabel(semester) + " · " + (counts[semester] || 0) + "</button>";
          }).join("") + "</div>" +
          '<button class="btn btn-primary btn-sm" type="button" id="addCourse"' + (university ? "" : " disabled") + ">" +
          NT.icon("plus") + "Add course</button></div>" +
          (coursesOf().length
            ? '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Course</th><th>Code</th><th>Lessons</th><th>Status</th><th></th></tr></thead><tbody>' +
              coursesOf().map(function (item) {
                return '<tr><td class="td-strong">' + NT.esc(item.title) + "</td>" +
                  "<td>" + NT.esc(item.code || "—") + "</td>" +
                  "<td>" + item.videoCount + "</td>" +
                  '<td><span class="badge badge-semester">' + NT.esc(NT.semesterLabel(item.semester)) + "</span></td>" +
                  '<td class="adm-row-end">' +
                  '<a class="btn btn-secondary btn-sm" href="lessons.html?course=' + encodeURIComponent(item.id) + '">' + NT.icon("video") + "Lessons</a>" +
                  '<button class="btn btn-ghost btn-sm" type="button" data-edit-course="' + NT.esc(item.id) + '">' + NT.icon("pencil") + "</button>" +
                  '<button class="btn btn-ghost btn-sm adm-danger" type="button" data-delete-course="' + NT.esc(item.id) + '">' + NT.icon("trash") + "</button>" +
                  "</td></tr>";
              }).join("") + "</tbody></table></div>"
            : '<div class="adm-empty-inline">No courses in ' + NT.esc(NT.semesterLabel(state.semester)) +
              " for this institution yet. Use “Add course” to create the first one.</div>") +
          "</section>";

        host.innerHTML = '<div class="adm-grid">' + institutionPanel + coursePanel + "</div>";
        wireUniversityPanel();
        wireCoursePanel();
      }

      function wireUniversityPanel() {
        host.querySelectorAll("[data-university]").forEach(function (button) {
          button.addEventListener("click", function () {
            state.universityId = button.dataset.university;
            render();
          });
        });
        host.querySelectorAll("[data-edit-university]").forEach(function (button) {
          button.addEventListener("click", function () { editUniversity(button.dataset.editUniversity); });
        });
        host.querySelectorAll("[data-delete-university]").forEach(function (button) {
          button.addEventListener("click", function () { removeUniversity(button.dataset.deleteUniversity); });
        });
        var add = document.getElementById("addUniversity");
        if (add) add.addEventListener("click", function () { editUniversity(""); });
      }

      function wireCoursePanel() {
        host.querySelectorAll("[data-semester]").forEach(function (button) {
          button.addEventListener("click", function () {
            state.semester = parseInt(button.dataset.semester, 10);
            render();
          });
        });
        var add = document.getElementById("addCourse");
        if (add) add.addEventListener("click", function () { editCourse(""); });
        host.querySelectorAll("[data-edit-course]").forEach(function (button) {
          button.addEventListener("click", function () { editCourse(button.dataset.editCourse); });
        });
        host.querySelectorAll("[data-delete-course]").forEach(function (button) {
          button.addEventListener("click", function () { removeCourse(button.dataset.deleteCourse); });
        });
      }

      function editUniversity(id) {
        var existing = universities.filter(function (item) { return item.id === id; })[0] || {};
        var modal = NT.modal({
          title: id ? "Edit institution" : "Add an institution",
          body: '<div class="adm-form">' +
            '<div class="field"><label for="uName">Institution name</label>' +
            '<input class="input" id="uName" value="' + NT.esc(existing.name || "") + '" placeholder="e.g. University of Zambia" required></div>' +
            '<div class="field"><label for="uShort">Short name</label>' +
            '<input class="input" id="uShort" value="' + NT.esc(existing.shortName || "") + '" placeholder="e.g. UNZA"></div>' +
            '<div class="adm-form-row">' +
            '<div class="field"><label for="uLevel">Type</label><select class="input" id="uLevel">' +
            option("university", "University", existing.level || "university") +
            option("high-school", "Secondary school pathway", existing.level) + "</select></div>" +
            '<div class="field"><label for="uCity">City</label><input class="input" id="uCity" value="' + NT.esc(existing.city || "") + '" placeholder="e.g. Lusaka"></div>' +
            "</div>" +
            '<div class="field"><label for="uSummary">Summary</label>' +
            '<textarea class="input" id="uSummary" rows="3" placeholder="One or two sentences shown on the university card.">' + NT.esc(existing.summary || "") + "</textarea></div>" +
            '<div class="field"><label for="uAccent">Accent colour</label><input class="input" id="uAccent" type="color" value="' +
            NT.esc(existing.accent || "#0d7ea4") + '"></div></div>',
          footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
            '<button class="btn btn-primary" id="saveUniversity">' + (id ? "Save changes" : "Add institution") + "</button>"
        });
        modal.querySelector("#saveUniversity").addEventListener("click", function (event) {
          var button = event.currentTarget;
          var body = {
            name: modal.querySelector("#uName").value.trim(),
            shortName: modal.querySelector("#uShort").value.trim(),
            level: modal.querySelector("#uLevel").value,
            city: modal.querySelector("#uCity").value.trim(),
            summary: modal.querySelector("#uSummary").value.trim(),
            accent: modal.querySelector("#uAccent").value
          };
          if (!body.name) return NT.toast("Give the institution a name", "error");
          button.disabled = true;
          var request = id ? NT.api.admin.updateUniversity(id, body) : NT.api.admin.createUniversity(body);
          request.then(function (payload) {
            var saved = payload.university;
            if (id) {
              universities = universities.map(function (item) { return item.id === id ? saved : item; });
            } else {
              universities.push(saved);
              state.universityId = saved.id;
            }
            NT.toast(id ? "Institution updated" : "Institution added", "success");
            modal.close();
            render();
            refreshCatalogue();
          }, function (error) {
            button.disabled = false;
            NT.toast(error.message, "error");
          });
        });
      }

      function removeUniversity(id) {
        var item = universities.filter(function (entry) { return entry.id === id; })[0];
        if (!item) return;
        var confirm = NT.modal({
          title: "Delete " + item.name + "?",
          body: "<p class=\"muted\">This removes the institution, its " + item.courseCount + " courses and " + item.videoCount +
            " video lessons. Students lose access to them immediately and this cannot be undone.</p>",
          footer: '<button class="btn btn-ghost" data-close>Keep it</button><button class="btn btn-danger-soft" id="confirmDelete">Delete permanently</button>'
        });
        confirm.querySelector("#confirmDelete").addEventListener("click", function () {
          NT.api.admin.deleteUniversity(id).then(function () {
            universities = universities.filter(function (entry) { return entry.id !== id; });
            courses = courses.filter(function (entry) { return entry.universityId !== id; });
            if (state.universityId === id) state.universityId = universities[0] ? universities[0].id : "";
            NT.toast("Institution deleted", "success");
            confirm.close();
            render();
            refreshCatalogue();
          }, function (error) { NT.toast(error.message, "error"); });
        });
      }

      function editCourse(id) {
        var existing = courses.filter(function (item) { return item.id === id; })[0] || {};
        var university = universities.filter(function (item) { return item.id === state.universityId; })[0];
        var modal = NT.modal({
          title: id ? "Edit course" : "Add a course",
          body: '<div class="adm-context adm-context-inline">' +
            '<span class="adm-context-item">' + NT.icon("building", "icon-sm") + "<b>" + NT.esc(university ? university.name : "") + "</b></span>" +
            '<span class="adm-context-item">' + NT.icon("calendar", "icon-sm") + "<b>" + NT.esc(NT.semesterLabel(state.semester)) + "</b></span></div>" +
            '<div class="adm-form">' +
            '<div class="field"><label for="cTitle">Course title</label>' +
            '<input class="input" id="cTitle" value="' + NT.esc(existing.title || "") + '" placeholder="e.g. Mathematics I" required></div>' +
            '<div class="field"><label for="cCode">Course code</label>' +
            '<input class="input" id="cCode" value="' + NT.esc(existing.code || "") + '" placeholder="e.g. MTH 1010"></div>' +
            '<div class="field"><label for="cDesc">Description</label>' +
            '<textarea class="input" id="cDesc" rows="3" placeholder="What the course covers.">' + NT.esc(existing.description || "") + "</textarea></div>" +
            '<div class="adm-form-row">' +
            '<div class="field"><label for="cIcon">Icon</label><select class="input" id="cIcon">' +
            ICON_CHOICES.map(function (name) { return option(name, name, existing.icon || "book-open"); }).join("") + "</select></div>" +
            '<div class="field"><label for="cTint">Card tint</label><input class="input" id="cTint" type="color" value="' +
            NT.esc(existing.tint || "#e8f6fb") + '"></div>' +
            "</div></div>",
          footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
            '<button class="btn btn-primary" id="saveCourse">' + (id ? "Save changes" : "Add course") + "</button>"
        });
        modal.querySelector("#saveCourse").addEventListener("click", function (event) {
          var button = event.currentTarget;
          var body = {
            universityId: state.universityId,
            semester: state.semester,
            title: modal.querySelector("#cTitle").value.trim(),
            code: modal.querySelector("#cCode").value.trim(),
            description: modal.querySelector("#cDesc").value.trim(),
            icon: modal.querySelector("#cIcon").value,
            tint: modal.querySelector("#cTint").value
          };
          if (!body.title) return NT.toast("Give the course a title", "error");
          button.disabled = true;
          var request = id ? NT.api.admin.updateCourse(id, body) : NT.api.admin.createCourse(body);
          request.then(function (payload) {
            if (id) courses = courses.map(function (item) { return item.id === id ? payload.course : item; });
            else courses.push(payload.course);
            NT.toast(id ? "Course updated" : "Course added", "success");
            modal.close();
            render();
            refreshCatalogue();
          }, function (error) {
            button.disabled = false;
            NT.toast(error.message, "error");
          });
        });
      }

      function removeCourse(id) {
        var item = courses.filter(function (entry) { return entry.id === id; })[0];
        if (!item) return;
        var confirm = NT.modal({
          title: "Delete this course?",
          body: "<p class=\"muted\">" + NT.esc(item.title) + " and its " + item.videoCount +
            " video lessons are removed from the catalogue. This cannot be undone.</p>",
          footer: '<button class="btn btn-ghost" data-close>Keep it</button><button class="btn btn-danger-soft" id="confirmDelete">Delete course</button>'
        });
        confirm.querySelector("#confirmDelete").addEventListener("click", function () {
          NT.api.admin.deleteCourse(id).then(function () {
            courses = courses.filter(function (entry) { return entry.id !== id; });
            NT.toast("Course deleted", "success");
            confirm.close();
            render();
            refreshCatalogue();
          }, function (error) { NT.toast(error.message, "error"); });
        });
      }

      render();
    }, function (error) { fail(host, error); });
  }

  /* ------------------------------------------------------------ video lessons */

  function videoTable(videos, options) {
    var showCourse = !options || options.showCourse !== false;
    var rows = videos.map(function (video, index) {
      var level = video.level || "standard";
      return "<tr data-video-row=\"" + NT.esc(video.id) + '">' +
        '<td class="adm-cell-lesson"><div class="adm-lesson-cell"><span class="adm-order">' + (index + 1) + "</span>" +
        '<div class="adm-lesson-copy"><b>' + NT.esc(video.title) + "</b>" +
        '<span class="adm-lesson-sub">' + NT.esc(video.topic || "") + "</span>" +
        (showCourse ? '<span class="adm-lesson-sub">' + NT.esc(video.courseTitle || "") +
          " · " + NT.esc(NT.semesterLabel(video.semester)) + "</span>" : "") +
        "</div>" + NT.thumb(video, "sm") + "</div></td>" +
        '<td><span class="badge badge-' + level + '">' + D.LEVEL_LABEL[level] + "</span></td>" +
        "<td>" + (video.durationSeconds ? NT.duration(video.durationSeconds) : "—") + "</td>" +
        "<td>" + (video.published ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-outline">Draft</span>') + "</td>" +
        '<td class="adm-row-end">' +
        '<button class="btn btn-ghost btn-sm" type="button" data-move="up" data-video="' + NT.esc(video.id) + '" aria-label="Move lesson up">' + NT.icon("arrow-up") + "</button>" +
        '<button class="btn btn-ghost btn-sm" type="button" data-move="down" data-video="' + NT.esc(video.id) + '" aria-label="Move lesson down">' + NT.icon("arrow-down") + "</button>" +
        '<button class="btn btn-ghost btn-sm" type="button" data-toggle="' + NT.esc(video.id) + '">' +
        (video.published ? NT.icon("eye-off") + "Unpublish" : NT.icon("eye") + "Publish") + "</button>" +
        '<button class="btn btn-ghost btn-sm" type="button" data-edit="' + NT.esc(video.id) + '">' + NT.icon("pencil") + "Edit</button>" +
        '<button class="btn btn-ghost btn-sm adm-danger" type="button" data-delete="' + NT.esc(video.id) + '" aria-label="Delete lesson">' + NT.icon("trash") + "</button>" +
        "</td></tr>";
    }).join("");
    return '<div class="table-wrap"><table class="nt-table adm-lesson-table"><thead><tr>' +
      "<th>Lesson</th><th>Package</th><th>Duration</th><th>Status</th><th></th></tr></thead><tbody>" + rows + "</tbody></table></div>";
  }

  function pageLessons() {
    shell("lessons", loading());
    var host = document.getElementById("admContent");
    var state = { universityId: "", semester: 1, courseId: "" };

    NT.api.admin.universities().then(function (payload) {
      var universities = payload.universities || [];
      if (!universities.length) {
        host.innerHTML = '<div class="adm-empty"><h2>No institutions yet</h2>' +
          "<p>Add a university and a course before adding video lessons.</p>" +
          '<a class="btn btn-primary" href="courses.html">Go to universities &amp; courses</a></div>';
        return;
      }
      var queryCourse = NT.qs("course");
      var queryUniversity = NT.qs("university");
      var querySemester = parseInt(NT.qs("semester"), 10);
      var chosen = null;

      function pickDefaults() {
        var institution = universities.filter(function (item) {
          return item.id === (queryUniversity || "");
        })[0];
        if (!institution) {
          institution = universities.filter(function (item) { return item.videoCount > 0; })[0] || universities[0];
        }
        state.universityId = institution.id;
        state.semester = querySemester === 1 || querySemester === 2 ? querySemester : (state.semester || 1);
        if (chosen && chosen.universityId === institution.id) {
          state.semester = chosen.semester;
          state.courseId = chosen.id;
        }
      }

      pickDefaults();

      if (queryCourse) {
        NT.api.admin.courses({ university: state.universityId }).then(function (result) {
          var match = (result.courses || []).filter(function (item) { return item.id === queryCourse; })[0];
          if (match) { chosen = match; state.semester = match.semester; state.courseId = match.id; }
          render();
        }, function () { render(); });
      } else {
        render();
      }

      function render() {
        var university = universities.filter(function (item) { return item.id === state.universityId; })[0];
        var controls = '<section class="adm-card adm-block"><div class="adm-context">' +
          '<span class="adm-context-label">Adding lessons to</span>' +
          '<span class="adm-context-item">' + NT.icon("building", "icon-sm") + "<b>" + NT.esc(university ? university.name : "") + "</b></span>" +
          '<span class="adm-context-item">' + NT.icon("calendar", "icon-sm") + "<b>" + NT.esc(NT.semesterLabel(state.semester)) + "</b></span>" +
          '<span class="adm-context-item">' + NT.icon("book-open", "icon-sm") + "<b id=\"admCourseName\">…</b></span></div>" +
          '<div class="adm-toolbar">' +
          '<label class="field field-inline"><span class="field-label">University</span><select class="input" id="fUniversity">' +
          universities.map(function (item) { return option(item.id, item.name, state.universityId); }).join("") + "</select></label>" +
          '<label class="field field-inline"><span class="field-label">Semester</span><select class="input" id="fSemester">' +
          option(1, "Semester 1", state.semester) + option(2, "Semester 2", state.semester) + "</select></label>" +
          '<label class="field field-inline"><span class="field-label">Course</span><select class="input" id="fCourse"></select></label>' +
          '<label class="field field-inline"><span class="field-label">Status</span><select class="input" id="fStatus">' +
          option("all", "All lessons", "all") + option("published", "Published only", "") + option("draft", "Drafts only", "") + "</select></label>" +
          "</div></section>";

        host.innerHTML = controls + '<div id="lessonList">' + loading("Loading lessons…") + "</div>";

        document.getElementById("fUniversity").addEventListener("change", function (event) {
          state.universityId = event.target.value;
          state.courseId = "";
          render();
        });
        document.getElementById("fSemester").addEventListener("change", function (event) {
          state.semester = parseInt(event.target.value, 10);
          state.courseId = "";
          render();
        });
        document.getElementById("fStatus").addEventListener("change", function () { loadLessons(); });

        NT.api.admin.courses({ university: state.universityId, semester: state.semester }).then(function (result) {
          var courses = result.courses || [];
          if (!courses.some(function (item) { return item.id === state.courseId; })) {
            state.courseId = courses[0] ? courses[0].id : "";
          }
          var select = document.getElementById("fCourse");
          select.innerHTML = courses.length
            ? courses.map(function (item) { return option(item.id, (item.code ? item.code + " · " : "") + item.title, state.courseId); }).join("")
            : '<option value="">No courses in this semester</option>';
          var nameHost = document.getElementById("admCourseName");
          var current = courses.filter(function (item) { return item.id === state.courseId; })[0];
          if (nameHost) nameHost.textContent = current ? current.title : "No course selected";
          select.addEventListener("change", function (event) {
            state.courseId = event.target.value;
            var picked = courses.filter(function (item) { return item.id === state.courseId; })[0];
            if (nameHost) nameHost.textContent = picked ? picked.title : "No course selected";
            loadLessons();
          });
          loadLessons();
        }, function (error) { fail(document.getElementById("lessonList"), error); });
      }

      function loadLessons() {
        var list = document.getElementById("lessonList");
        if (!state.courseId) {
          list.innerHTML = '<div class="adm-card adm-block"><div class="adm-empty-inline">Choose a course to manage its video lessons. ' +
            'If this semester has no courses yet, <a href="courses.html">add a course first</a>.</div></div>';
          return;
        }
        list.innerHTML = loading("Loading video lessons…");
        var status = document.getElementById("fStatus").value;
        NT.api.admin.videos({ course: state.courseId, status: status }).then(function (result) {
          var videos = result.videos || [];
          list.innerHTML = '<section class="adm-card adm-block"><div class="adm-block-head">' +
            '<div><h2>Video lessons</h2><p>' + videos.length + " lesson" + (videos.length === 1 ? "" : "s") +
            " in this course. The list order is the order students see.</p></div>" +
            '<button class="btn btn-primary btn-sm" type="button" id="addLesson">' + NT.icon("plus") + "Add video lesson</button></div>" +
            (videos.length ? videoTable(videos, { showCourse: false })
              : '<div class="adm-empty-inline">No video lessons yet. Use “Add video lesson” to paste a YouTube, Vimeo or MP4 link.</div>') +
            "</section>";

          document.getElementById("addLesson").addEventListener("click", function () { editLesson(""); });
          list.querySelectorAll("[data-edit]").forEach(function (button) {
            button.addEventListener("click", function () { editLesson(button.dataset.edit); });
          });
          list.querySelectorAll("[data-delete]").forEach(function (button) {
            button.addEventListener("click", function () { removeLesson(button.dataset.delete); });
          });
          list.querySelectorAll("[data-toggle]").forEach(function (button) {
            button.addEventListener("click", function () {
              var id = button.dataset.toggle;
              var video = videos.filter(function (item) { return item.id === id; })[0];
              NT.api.admin.updateVideo(id, { published: video.published ? 0 : 1 }).then(function () {
                NT.toast(video.published ? "Lesson unpublished" : "Lesson published — students can see it now", "success");
                loadLessons();
                refreshCatalogue();
              }, function (error) { NT.toast(error.message, "error"); });
            });
          });
          list.querySelectorAll("[data-move]").forEach(function (button) {
            button.addEventListener("click", function () {
              NT.api.admin.moveVideo(button.dataset.video, button.dataset.move).then(function () {
                loadLessons();
                refreshCatalogue();
              }, function (error) { NT.toast(error.message, "error"); });
            });
          });
        }, function (error) { fail(list, error); });
      }

      function editLesson(id) {
        var existing = null;
        if (id) {
          var rows = host.querySelectorAll("[data-video-row]");
          for (var index = 0; index < rows.length; index++) {
            if (rows[index].dataset.videoRow === id) break;
          }
        }
        NT.api.admin.videos({ course: state.courseId }).then(function (result) {
          existing = (result.videos || []).filter(function (item) { return item.id === id; })[0] || {};
          var university = universities.filter(function (item) { return item.id === state.universityId; })[0];
          var courseName = document.getElementById("admCourseName");
          var modal = NT.modal({
            size: "lg",
            title: id ? "Edit video lesson" : "Add a video lesson",
            body: '<div class="adm-context adm-context-inline">' +
              '<span class="adm-context-item">' + NT.icon("building", "icon-sm") + "<b>" + NT.esc(university ? university.name : "") + "</b></span>" +
              '<span class="adm-context-item">' + NT.icon("calendar", "icon-sm") + "<b>" + NT.esc(NT.semesterLabel(state.semester)) + "</b></span>" +
              '<span class="adm-context-item">' + NT.icon("book-open", "icon-sm") + "<b>" +
              NT.esc(courseName ? courseName.textContent : "") + "</b></span></div>" +
              '<div class="adm-form">' +
              '<div class="field"><label for="vTitle">Lesson title</label>' +
              '<input class="input" id="vTitle" value="' + NT.esc(existing.title || "") + '" placeholder="e.g. Limits and continuity" required></div>' +
              '<div class="field"><label for="vTopic">Topic</label>' +
              '<input class="input" id="vTopic" value="' + NT.esc(existing.topic || "") + '" placeholder="e.g. MIT 18.01 · Lecture 2"></div>' +
              '<div class="field"><label for="vSource">Video URL</label>' +
              '<input class="input" id="vSource" type="url" inputmode="url" autocapitalize="none" spellcheck="false" value="' + NT.esc(existing.sourceUrl || "") + '" placeholder="https://www.youtube.com/watch?v=…" required>' +
              '<span class="field-hint">YouTube and Vimeo links play inside the lesson page. The platform detects the provider and thumbnail automatically.</span></div>' +
              '<div class="adm-form-row">' +
              '<div class="field"><label for="vLevel">Package level</label><select class="input" id="vLevel">' + levelOptions(existing.level) + "</select></div>" +
              '<div class="field"><label for="vDuration">Duration</label>' +
              '<input class="input" id="vDuration" value="' + NT.esc(existing.duration || "") + '" placeholder="e.g. 48:12 or 2892"></div>' +
              "</div>" +
              '<div class="field"><label for="vThumb">Thumbnail URL <span class="muted">(optional)</span></label>' +
              '<input class="input" id="vThumb" type="url" inputmode="url" autocapitalize="none" spellcheck="false" value="' + NT.esc(existing.thumbnailUrl || "") + '" placeholder="Leave blank to use the platform thumbnail"></div>' +
              '<div class="field"><label for="vDesc">Description</label>' +
              '<textarea class="input" id="vDesc" rows="4" placeholder="What the lesson covers, and any attribution for the video source.">' + NT.esc(existing.description || "") + "</textarea></div>" +
              '<label class="adm-check"><input type="checkbox" id="vPublished"' + (existing.published === false ? "" : " checked") + ">" +
              "<span>Published — visible to students immediately</span></label></div>",
            footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
              '<button class="btn btn-primary" id="saveLesson">' + (id ? "Save lesson" : "Add lesson") + "</button>"
          });
          modal.querySelector("#saveLesson").addEventListener("click", function (event) {
            var button = event.currentTarget;
            var body = {
              courseId: state.courseId,
              title: modal.querySelector("#vTitle").value.trim(),
              topic: modal.querySelector("#vTopic").value.trim(),
              sourceUrl: modal.querySelector("#vSource").value.trim(),
              level: modal.querySelector("#vLevel").value,
              duration: modal.querySelector("#vDuration").value.trim(),
              thumbnailUrl: modal.querySelector("#vThumb").value.trim(),
              description: modal.querySelector("#vDesc").value.trim(),
              published: modal.querySelector("#vPublished").checked ? 1 : 0
            };
            if (!body.title) return NT.toast("Give the lesson a title", "error");
            if (!body.sourceUrl) return NT.toast("Paste the video URL", "error");
            button.disabled = true;
            var request = id ? NT.api.admin.updateVideo(id, body) : NT.api.admin.createVideo(body);
            request.then(function () {
              NT.toast(id ? "Lesson saved" : "Lesson added", "success");
              modal.close();
              loadLessons();
              refreshCatalogue();
            }, function (error) {
              button.disabled = false;
              NT.toast(error.message, "error");
            });
          });
        }, function (error) { NT.toast(error.message, "error"); });
      }

      function removeLesson(id) {
        var confirm = NT.modal({
          title: "Delete this lesson?",
          body: "<p class=\"muted\">The video lesson is removed from the course and from student progress. This cannot be undone.</p>",
          footer: '<button class="btn btn-ghost" data-close>Keep it</button><button class="btn btn-danger-soft" id="confirmDelete">Delete lesson</button>'
        });
        confirm.querySelector("#confirmDelete").addEventListener("click", function () {
          NT.api.admin.deleteVideo(id).then(function () {
            NT.toast("Lesson deleted", "success");
            confirm.close();
            loadLessons();
            refreshCatalogue();
          }, function (error) { NT.toast(error.message, "error"); });
        });
      }
    }, function (error) { fail(host, error); });
  }

  /* ------------------------------------------------------------ codes */

  function pageCodes() {
    shell("codes", loading());
    var host = document.getElementById("admContent");

    function load() {
      host.innerHTML = loading("Loading access codes…");
      NT.api.admin.codes().then(function (payload) {
        var codes = payload.codes || [];
        var unused = codes.filter(function (item) { return item.status === "unused"; }).length;
        host.innerHTML =
          '<div class="adm-cards">' +
          '<article class="adm-card adm-stat"><span class="adm-stat-value">' + codes.length + '</span><span class="adm-stat-label">Codes issued</span></article>' +
          '<article class="adm-card adm-stat"><span class="adm-stat-value">' + unused + '</span><span class="adm-stat-label">Still unused</span></article>' +
          '<article class="adm-card adm-stat"><span class="adm-stat-value">' + (codes.length - unused) + '</span><span class="adm-stat-label">Redeemed</span></article>' +
          "</div>" +
          '<section class="adm-card adm-block"><div class="adm-block-head"><div><h2>Issue access codes</h2>' +
          "<p>Each code works once and is tied to the package you choose.</p></div></div>" +
          '<div class="adm-toolbar"><label class="field field-inline"><span class="field-label">Package</span>' +
          '<select class="input" id="codePackage">' + D.LEVELS.map(function (level) {
            return option(level, D.LEVEL_LABEL[level] + " — " + NT.kwacha(NT.packagePrice(level)), level);
          }).join("") + "</select></label>" +
          '<label class="field field-inline"><span class="field-label">How many</span>' +
          '<input class="input" id="codeCount" type="number" min="1" max="25" value="5"></label>' +
          '<button class="btn btn-primary btn-sm" type="button" id="issueCodes">' + NT.icon("plus") + "Issue codes</button></div></section>" +
          '<section class="adm-card adm-block"><div class="adm-block-head"><h2>Issued codes</h2>' +
          "<p>Codes stay on the server, so they can be redeemed from any device.</p></div>" +
          (codes.length
            ? '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Code</th><th>Package</th><th>Status</th><th>Issued</th><th></th></tr></thead><tbody>' +
              codes.map(function (item) {
                return '<tr><td class="td-strong mono">' + NT.esc(item.code) + "</td>" +
                  '<td><span class="badge badge-' + item.package + '">' + D.LEVEL_LABEL[item.package] + "</span></td>" +
                  '<td>' + (item.status === "redeemed" ? '<span class="badge badge-success">Redeemed</span>' : '<span class="badge badge-outline">Unused</span>') + "</td>" +
                  "<td>" + NT.fmtDate(item.redeemedAt || item.issuedAt) + "</td>" +
                  '<td class="adm-row-end"><button class="btn btn-ghost btn-sm adm-danger" type="button" data-delete-code="' + NT.esc(item.code) + '">' +
                  NT.icon("trash") + "</button></td></tr>";
              }).join("") + "</tbody></table></div>"
            : '<div class="adm-empty-inline">No codes issued yet.</div>') + "</section>";

        document.getElementById("issueCodes").addEventListener("click", function (event) {
          var button = event.currentTarget;
          var pkg = document.getElementById("codePackage").value;
          var count = Math.min(Math.max(parseInt(document.getElementById("codeCount").value, 10) || 1, 1), 25);
          button.disabled = true;
          NT.api.admin.createCodes(pkg, count).then(function (payload) {
            button.disabled = false;
            NT.toast(payload.codes.length + " " + D.LEVEL_LABEL[pkg].toLowerCase() + " code(s) issued", "success");
            load();
          }, function (error) {
            button.disabled = false;
            NT.toast(error.message, "error");
          });
        });
        host.querySelectorAll("[data-delete-code]").forEach(function (button) {
          button.addEventListener("click", function () {
            NT.api.admin.deleteCode(button.dataset.deleteCode).then(function () {
              NT.toast("Access code removed", "success");
              load();
            }, function (error) { NT.toast(error.message, "error"); });
          });
        });
      }, function (error) { fail(host, error); });
    }
    load();
  }

  /* ------------------------------------------------------------ announcements */

  function pageAnnouncements() {
    shell("announcements", loading(), '<button class="btn btn-primary btn-sm" type="button" id="newAnnouncement" aria-label="Create an announcement" title="Create an announcement">' +
      NT.icon("plus") + "<span>New announcement</span></button>");
    var host = document.getElementById("admContent");

    function load() {
      host.innerHTML = loading("Loading announcements…");
      NT.api.admin.announcements().then(function (payload) {
        var items = payload.announcements || [];
        host.innerHTML = '<section class="adm-card adm-block"><div class="adm-block-head">' +
          "<div><h2>Announcements</h2><p>Published announcements appear on the student announcements page and in search.</p></div>" +
          '<button class="btn btn-primary btn-sm" type="button" id="newAnnouncementInline">' + NT.icon("plus") + "New announcement</button></div>" +
          (items.length
            ? '<div class="adm-announcements">' + items.map(function (item) {
              return '<article class="adm-announcement"><div class="adm-announcement-head">' +
                "<div><h3>" + NT.esc(item.title) + "</h3><span class=\"muted small\">" + NT.fmtDate(item.updatedAt || item.createdAt) + " · " +
                (item.status === "published" ? "Published" : "Draft") + "</span></div>" +
                '<div class="adm-row-actions">' +
                '<button class="btn btn-ghost btn-sm" type="button" data-edit-announcement="' + NT.esc(item.id) + '">' + NT.icon("pencil") + "Edit</button>" +
                '<button class="btn btn-ghost btn-sm" type="button" data-status-announcement="' + NT.esc(item.id) + '" data-status="' +
                (item.status === "published" ? "draft" : "published") + '">' +
                (item.status === "published" ? NT.icon("eye-off") + "Unpublish" : NT.icon("eye") + "Publish") + "</button>" +
                '<button class="btn btn-ghost btn-sm adm-danger" type="button" data-delete-announcement="' + NT.esc(item.id) + '">' + NT.icon("trash") + "</button>" +
                "</div></div><p>" + NT.esc(item.body || "") + "</p></article>";
            }).join("") + "</div>"
            : '<div class="adm-empty-inline">No announcements yet. Students see the page once you publish one.</div>') +
          "</section>";

        function openForm(id) {
          var existing = items.filter(function (item) { return item.id === id; })[0] || {};
          var modal = NT.modal({
            title: id ? "Edit announcement" : "New announcement",
            body: '<div class="adm-form"><div class="field"><label for="aTitle">Title</label>' +
              '<input class="input" id="aTitle" value="' + NT.esc(existing.title || "") + '" placeholder="e.g. New Semester 2 lessons published"></div>' +
              '<div class="field"><label for="aBody">Message</label>' +
              '<textarea class="input" id="aBody" rows="5" placeholder="Keep it short and useful.">' + NT.esc(existing.body || "") + "</textarea></div>" +
              '<label class="adm-check"><input type="checkbox" id="aPublished"' + (existing.status === "draft" ? "" : " checked") + ">" +
              "<span>Publish now</span></label></div>",
            footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="saveAnnouncement">Save</button>'
          });
          modal.querySelector("#saveAnnouncement").addEventListener("click", function (event) {
            var button = event.currentTarget;
            var body = {
              title: modal.querySelector("#aTitle").value.trim(),
              body: modal.querySelector("#aBody").value.trim(),
              status: modal.querySelector("#aPublished").checked ? "published" : "draft"
            };
            if (body.title.length < 3 || body.body.length < 3) return NT.toast("Add a title and a message", "error");
            button.disabled = true;
            var request = id ? NT.api.admin.updateAnnouncement(id, body) : NT.api.admin.createAnnouncement(body);
            request.then(function () {
              NT.toast("Announcement saved", "success");
              modal.close();
              load();
            }, function (error) {
              button.disabled = false;
              NT.toast(error.message, "error");
            });
          });
        }

        function bindNew() {
          var newButton = document.getElementById("newAnnouncement");
          if (newButton) newButton.onclick = function () { openForm(""); };
          var inline = document.getElementById("newAnnouncementInline");
          if (inline) inline.onclick = function () { openForm(""); };
        }
        bindNew();
        host.querySelectorAll("[data-edit-announcement]").forEach(function (button) {
          button.addEventListener("click", function () { openForm(button.dataset.editAnnouncement); });
        });
        host.querySelectorAll("[data-status-announcement]").forEach(function (button) {
          button.addEventListener("click", function () {
            NT.api.admin.updateAnnouncement(button.dataset.statusAnnouncement, { status: button.dataset.status }).then(function () {
              NT.toast("Announcement " + button.dataset.status, "success");
              load();
            }, function (error) { NT.toast(error.message, "error"); });
          });
        });
        host.querySelectorAll("[data-delete-announcement]").forEach(function (button) {
          button.addEventListener("click", function () {
            NT.api.admin.deleteAnnouncement(button.dataset.deleteAnnouncement).then(function () {
              NT.toast("Announcement deleted", "success");
              load();
            }, function (error) { NT.toast(error.message, "error"); });
          });
        });
      }, function (error) { fail(host, error); });
    }
    load();

    var header = document.getElementById("newAnnouncement");
    if (header) header.addEventListener("click", function () {
      var inline = document.getElementById("newAnnouncementInline");
      if (inline) inline.click();
    });
  }

  /* ------------------------------------------------------------ packages */

  function pagePackages() {
    shell("packages", loading());
    var host = document.getElementById("admContent");
    NT.api.admin.settings().then(function (payload) {
      var settings = payload.settings || {};
      var packages = settings.packages || {};
      var total = NT.counts().total;
      host.innerHTML = '<section class="adm-card adm-block"><div class="adm-block-head"><div><h2>Access packages</h2>' +
        "<p>These names, prices and features are what students see on the pricing page.</p></div></div>" +
        '<form class="adm-form" id="packagesForm">' +
        '<div class="adm-form-row"><div class="field"><label for="sAccessDays">Access period (days)</label>' +
        '<input class="input" id="sAccessDays" type="number" min="1" max="3650" value="' +
        NT.esc(String(settings.accessDays || NT.accessDays())) + '"></div>' +
        '<div class="field"><label for="sSupportEmail">Support email</label>' +
        '<input class="input" id="sSupportEmail" type="email" value="' + NT.esc(settings.supportEmail || "") + '" placeholder="support@example.com"></div></div>' +
        D.LEVELS.map(function (level) {
          var pack = packages[level] || {};
          return '<fieldset class="adm-fieldset"><legend><span class="badge badge-' + level + '">' + D.LEVEL_LABEL[level] +
            "</span><small>" + NT.availableFor(level) + " of " + total + " lessons included</small></legend>" +
            '<div class="adm-form-row"><div class="field"><label for="pkg-' + level + '-name">Name</label>' +
            '<input class="input" id="pkg-' + level + '-name" value="' + NT.esc(pack.name || "") + '"></div>' +
            '<div class="field"><label for="pkg-' + level + '-price">Price (Kwacha)</label>' +
            '<input class="input" id="pkg-' + level + '-price" type="number" min="0" value="' + NT.esc(String(pack.price == null ? "" : pack.price)) + '"></div></div>' +
            '<div class="field"><label for="pkg-' + level + '-tagline">Tagline</label>' +
            '<input class="input" id="pkg-' + level + '-tagline" value="' + NT.esc(pack.tagline || "") + '"></div>' +
            '<div class="field"><label for="pkg-' + level + '-features">Feature list <span class="muted">(one per line)</span></label>' +
            '<textarea class="input" id="pkg-' + level + '-features" rows="3">' + NT.esc((pack.features || []).join("\n")) + "</textarea></div></fieldset>";
        }).join("") +
        '<div class="adm-form-actions"><button class="btn btn-primary" type="submit">' + NT.icon("save") + "Save packages</button></div></form></section>";

      document.getElementById("packagesForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var body = {
          accessDays: parseInt(document.getElementById("sAccessDays").value, 10) || NT.accessDays(),
          supportEmail: document.getElementById("sSupportEmail").value.trim(),
          packages: {}
        };
        D.LEVELS.forEach(function (level) {
          body.packages[level] = {
            name: document.getElementById("pkg-" + level + "-name").value.trim(),
            price: parseInt(document.getElementById("pkg-" + level + "-price").value, 10) || 0,
            tagline: document.getElementById("pkg-" + level + "-tagline").value.trim(),
            features: document.getElementById("pkg-" + level + "-features").value.split("\n").map(function (line) { return line.trim(); }).filter(Boolean)
          };
        });
        var button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        NT.api.admin.saveSettings(body).then(function (payload) {
          button.disabled = false;
          NT.store.applyServerSettings(payload.settings);
          NT.toast("Package settings saved", "success");
          refreshCatalogue();
        }, function (error) {
          button.disabled = false;
          NT.toast(error.message, "error");
        });
      });
    }, function (error) { fail(host, error); });
  }

  /* ------------------------------------------------------------ settings */

  function pageSettings() {
    shell("settings", loading());
    var host = document.getElementById("admContent");
    NT.api.admin.settings().then(function (payload) {
      var settings = payload.settings || {};
      host.innerHTML = '<div class="adm-grid adm-grid-form">' +
        '<section class="adm-card adm-block"><div class="adm-block-head"><div><h2>Platform settings</h2>' +
        "<p>Contact details and how long a redeemed code stays active.</p></div></div>" +
        '<form class="adm-form" id="settingsForm">' +
        '<div class="field"><label for="setSupport">Support email</label>' +
        '<input class="input" id="setSupport" type="email" value="' + NT.esc(settings.supportEmail || "") + '" placeholder="support@example.com"></div>' +
        '<div class="field"><label for="setDays">Access period (days)</label>' +
        '<input class="input" id="setDays" type="number" min="1" max="3650" value="' + NT.esc(String(settings.accessDays || NT.accessDays())) + '">' +
        '<span class="field-hint">Applies to access codes redeemed from now on.</span></div>' +
        '<div class="adm-form-actions"><button class="btn btn-primary" type="submit">' + NT.icon("save") + "Save settings</button></div>" +
        "</form></section>" +
        '<section class="adm-card adm-block"><div class="adm-block-head"><div><h2>Administrator password</h2>' +
        "<p>Changing the password signs out every other administrator session.</p></div></div>" +
        '<form class="adm-form" id="passwordForm">' +
        '<div class="field"><label for="pwCurrent">Current password</label>' +
        '<input class="input" id="pwCurrent" type="password" autocomplete="current-password"></div>' +
        '<div class="field"><label for="pwNext">New password</label>' +
        '<input class="input" id="pwNext" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>' +
        '<div class="field"><label for="pwConfirm">Confirm new password</label>' +
        '<input class="input" id="pwConfirm" type="password" autocomplete="new-password" placeholder="Type the new password again"></div>' +
        '<div class="adm-form-actions"><button class="btn btn-secondary" type="submit" id="pwSubmit">' + NT.icon("key") + "Change password</button>" +
        "</div>" +
        "</form></section></div>" +
        '<section class="adm-card adm-block"><div class="adm-block-head"><div><h2>Data model</h2>' +
        "<p>Everything students see comes from the server database.</p></div></div>" +
        '<div class="adm-kv">' +
        '<div class="row"><span>Structure</span><b>University → Semester 1 or 2 → Course → Video lessons</b></div>' +
        '<div class="row"><span>Lesson sources</span><b>YouTube, Vimeo or direct MP4 links</b></div>' +
        '<div class="row"><span>Student progress</span><b>Stored against the access code on the server</b></div>' +
        "</div></section>";

      document.getElementById("settingsForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var body = {
          supportEmail: document.getElementById("setSupport").value.trim(),
          accessDays: parseInt(document.getElementById("setDays").value, 10) || NT.accessDays()
        };
        var button = event.currentTarget.querySelector("button");
        button.disabled = true;
        NT.api.admin.saveSettings(body).then(function (payload) {
          button.disabled = false;
          NT.store.applyServerSettings(payload.settings);
          NT.toast("Settings saved", "success");
        }, function (error) {
          button.disabled = false;
          NT.toast(error.message, "error");
        });
      });

      /* A first-run password must be replaced before the admin API accepts
         catalogue management. That now happens on its own screen
         (first-run.html), which this router sends un-rotated sessions to,
         so by the time Settings loads there is nothing left to explain. */

      document.getElementById("passwordForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var current = document.getElementById("pwCurrent").value;
        var next = document.getElementById("pwNext").value;
        var confirm = document.getElementById("pwConfirm").value;
        if (next.length < 8) return NT.toast("Use at least 8 characters for the new password", "error");
        if (confirm !== next) return NT.toast("The two new passwords do not match", "error");
        var button = event.currentTarget.querySelector("button");
        button.disabled = true;
        NT.api.admin.changePassword(current, next, confirm).then(function () {
          /* The server clears every other session and issues this browser a
             fresh one, so the dashboard is loaded instead of the sign-in
             page. */
          NT.toast("Password changed", "success");
          window.setTimeout(function () { location.href = "index.html"; }, 700);
        }, function (error) {
          button.disabled = false;
          NT.toast(error.message, "error");
        });
      });
    }, function (error) { fail(host, error); });
  }

  /* ------------------------------------------------------------ payment enquiries */

  function enquiryStatusBadge(item) {
    if (item.status === "rejected") {
      return '<span class="badge badge-outline">' + NT.icon("x") + "Rejected</span>";
    }
    if (item.status === "pending") {
      return '<span class="badge badge-warn">' + NT.icon("clock") + "Pending</span>";
    }
    if (item.emailStatus === "failed") {
      return '<span class="badge badge-warn">' + NT.icon("circle-alert") + "Email failed</span>";
    }
    return '<span class="badge badge-success">' + NT.icon("check-circle") +
      (item.emailStatus === "sent" ? "Emailed" : "Confirmed") + "</span>";
  }

  function pageEnquiries() {
    shell("enquiries", loading());
    var host = document.getElementById("admContent");
    var filter = "all";

    function statCard(value, label, hint) {
      return '<article class="adm-card adm-stat"><span class="adm-stat-value">' + value +
        '</span><span class="adm-stat-label">' + label + "</span>" +
        (hint ? '<span class="adm-stat-hint">' + hint + "</span>" : "") + "</article>";
    }

    function rowsMarkup(items) {
      return '<div class="table-wrap"><table class="nt-table"><thead><tr>' +
        "<th>Student</th><th>Package</th><th>Reference</th><th>Requested</th><th>Status</th><th></th>" +
        "</tr></thead><tbody>" + items.map(function (item) {
          var actions = "";
          if (item.status === "pending") {
            actions = '<button class="btn btn-primary btn-sm" type="button" data-confirm-enquiry="' + NT.esc(item.id) + '">' +
              NT.icon("check") + "Confirm payment</button>" +
              '<button class="btn btn-ghost btn-sm adm-danger" type="button" data-reject-enquiry="' + NT.esc(item.id) + '">' +
              NT.icon("x") + "Reject</button>";
          } else if (item.status === "confirmed") {
            actions = '<button class="btn btn-ghost btn-sm" type="button" data-copy-code="' + NT.esc(item.code || "") + '">' +
              NT.icon("copy") + "Copy code</button>" +
              '<button class="btn btn-ghost btn-sm" type="button" data-email-enquiry="' + NT.esc(item.id) + '">' +
              NT.icon("rotate") + (item.emailStatus === "sent" ? "Resend email" : "Retry email") + "</button>";
          } else {
            actions = '<span class="muted small">No code issued</span>';
          }
          return "<tr>" +
            '<td class="td-strong">' + NT.esc(item.studentName) +
            '<br><span class="muted small">' + NT.esc(item.studentEmail) + "</span></td>" +
            '<td><span class="badge badge-' + NT.esc(item.package) + '">' + NT.esc(item.packageName) + "</span>" +
            '<br><span class="muted small">' + NT.kwacha(item.amount) + "</span></td>" +
            '<td class="mono">' + NT.esc(item.reference) + "</td>" +
            "<td>" + NT.fmtDate(item.createdAt) + "</td>" +
            "<td>" + enquiryStatusBadge(item) +
            (item.code ? '<br><span class="mono small">' + NT.esc(item.code) + "</span>" : "") +
            (item.emailStatus === "failed" && item.emailError
              ? '<br><span class="adm-hint">' + NT.esc(item.emailError.slice(0, 90)) + "</span>"
              : "") +
            "</td>" +
            '<td class="adm-row-end">' + actions + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    function load() {
      host.innerHTML = loading("Loading payment enquiries…");
      NT.api.admin.enquiries().then(function (payload) {
        var all = payload.enquiries || [];
        var mail = payload.mail || {};
        var items = filter === "all" ? all : all.filter(function (item) { return item.status === filter; });
        var pending = all.filter(function (item) { return item.status === "pending"; }).length;
        var confirmed = all.filter(function (item) { return item.status === "confirmed"; }).length;
        var failed = all.filter(function (item) {
          return item.status === "confirmed" && item.emailStatus === "failed";
        }).length;
        var rejected = all.filter(function (item) { return item.status === "rejected"; }).length;
        var filters = [
          { id: "all", label: "All (" + all.length + ")" },
          { id: "pending", label: "Pending (" + pending + ")" },
          { id: "confirmed", label: "Confirmed (" + confirmed + ")" },
          { id: "rejected", label: "Rejected (" + rejected + ")" }
        ];
        host.innerHTML =
          '<div class="adm-cards">' +
          statCard(String(pending), "Awaiting confirmation", "Payment still to be verified") +
          statCard(String(confirmed), "Confirmed payments", "Access codes issued") +
          statCard(String(failed), "Email failed", failed ? "Needs attention" : "Nothing to retry") +
          statCard(String(rejected), "Rejected", "No code issued") +
          "</div>" +
          '<section class="adm-card adm-block"><div class="adm-block-head"><div><h2>Payment enquiries</h2>' +
          "<p>Students agree the package with " + NT.esc(payload.contact || "Nuclear Tutorials") +
          " on WhatsApp. Confirming a payment issues one access code and emails it; rejecting issues none.</p></div>" +
          '<div class="segmented">' + filters.map(function (option) {
            return '<button type="button" data-enquiry-filter="' + option.id + '" class="' +
              (filter === option.id ? "active" : "") + '" aria-pressed="' + (filter === option.id) + '">' +
              option.label + "</button>";
          }).join("") + "</div></div>" +
          (mail.configured
            ? ""
            : '<div class="adm-notice">' + NT.icon("circle-alert") +
              "<div><b>Email delivery is not configured on this server.</b> Access codes are still issued and shown here; " +
              "configure sending and use <b>Retry email</b>. " + NT.esc(mail.transport || "") + "</div></div>") +
          (items.length
            ? rowsMarkup(items)
            : '<div class="adm-empty-inline">' +
              (all.length ? "No enquiries with this status." : "No payment enquiries yet. Requests raised on the package page appear here.") +
              "</div>") +
          "</section>";

        host.querySelectorAll("[data-enquiry-filter]").forEach(function (button) {
          button.addEventListener("click", function () {
            filter = button.dataset.enquiryFilter;
            load();
          });
        });
        host.querySelectorAll("[data-copy-code]").forEach(function (button) {
          button.addEventListener("click", function () { NT.copy(button.dataset.copyCode); });
        });
        host.querySelectorAll("[data-confirm-enquiry]").forEach(function (button) {
          button.addEventListener("click", function () { confirmEnquiry(button.dataset.confirmEnquiry, button); });
        });
        host.querySelectorAll("[data-reject-enquiry]").forEach(function (button) {
          button.addEventListener("click", function () { rejectEnquiry(button.dataset.rejectEnquiry); });
        });
        host.querySelectorAll("[data-email-enquiry]").forEach(function (button) {
          button.addEventListener("click", function () { retryEmail(button.dataset.emailEnquiry, button); });
        });
      }, function (error) { fail(host, error); });
    }

    function showResult(html) {
      var existing = document.getElementById("enquiryResult");
      if (existing) existing.remove();
      var notice = document.createElement("div");
      notice.id = "enquiryResult";
      notice.className = "adm-notice adm-notice-success";
      notice.innerHTML = html;
      host.insertBefore(notice, host.firstChild);
      NT.initReveal();
    }

    /* Confirming twice never mints a second code: the server answers with the
       code that was already issued, and the console says so. */
    function confirmEnquiry(id, button) {
      button.disabled = true;
      NT.api.admin.confirmEnquiry(id).then(function (payload) {
        var item = payload.enquiry;
        showResult(NT.icon("check-circle") + "<div><b>Payment confirmed for " + NT.esc(item.studentName) +
          ".</b> Access code <span class=\"mono\">" + NT.esc(item.code || "") + "</span> for the " +
          NT.esc(item.packageName) + " package." +
          (payload.duplicate ? " This enquiry was already confirmed, so the existing code was kept — no new code was issued." : "") +
          (payload.emailSent
            ? " The code was emailed to " + NT.esc(item.studentEmail) + "."
            : " The code could not be emailed yet" + (item.emailError ? " (" + NT.esc(item.emailError) + ")" : "") +
              ". Use <b>Retry email</b> once delivery is available — the code is already saved.") +
          "</div>");
        NT.toast(payload.duplicate ? "Already confirmed — code shown again" : "Payment confirmed", "success");
        load();
      }, function (error) {
        button.disabled = false;
        NT.toast(error.message, "error");
      });
    }

    function rejectEnquiry(id) {
      var modal = NT.modal({
        title: "Reject this payment enquiry?",
        body: '<p class="muted">No access code is issued and the student is not emailed. The request stays on the list as rejected.</p>',
        footer: '<button class="btn btn-ghost" data-close>Keep it</button>' +
          '<button class="btn btn-danger-soft" id="confirmReject">Reject enquiry</button>'
      });
      modal.querySelector("#confirmReject").addEventListener("click", function () {
        var button = modal.querySelector("#confirmReject");
        button.disabled = true;
        NT.api.admin.rejectEnquiry(id).then(function (payload) {
          modal.close();
          NT.toast("Enquiry " + payload.enquiry.reference + " rejected", "success");
          load();
        }, function (error) {
          button.disabled = false;
          NT.toast(error.message, "error");
        });
      });
    }

    function retryEmail(id, button) {
      button.disabled = true;
      NT.api.admin.retryEnquiryEmail(id).then(function (payload) {
        var item = payload.enquiry;
        showResult(NT.icon("check-circle") + "<div><b>Access code emailed.</b> " +
          NT.esc(item.packageName) + " code sent to " + NT.esc(item.studentEmail) +
          " (attempt " + item.emailAttempts + ").</div>");
        load();
      }, function (error) {
        button.disabled = false;
        NT.toast(error.message, "error");
      });
    }

    load();
  }

  /* ------------------------------------------------------------ router */


  var routes = {
    login: pageLogin,
    "first-run": pageFirstRun,
    home: pageHome,
    courses: pageCourses,
    lessons: pageLessons,
    codes: pageCodes,
    enquiries: pageEnquiries,
    announcements: pageAnnouncements,
    packages: pagePackages,
    settings: pageSettings
  };

  document.addEventListener("DOMContentLoaded", function () {
    var route = document.body.dataset.admin || "home";
    var handler = routes[route] || routes.home;

    if (route === "login") {
      handler();
      return;
    }

    root.innerHTML = '<div class="adm-loading"><span class="adm-spin" aria-hidden="true"></span>' +
      "<p>Checking your administrator session…</p></div>";

    NT.api.admin.session().then(function (payload) {
      if (!payload || !payload.authenticated) {
        location.replace("login.html?next=" + encodeURIComponent(route + ".html"));
        return;
      }
      /* First run: the console stays locked until the first-run password is
         replaced, so the only page that can load is the password screen.
         Once the password is set, that screen sends the administrator on to
         the dashboard. */
      if (payload.mustChangePassword && route !== "first-run") {
        location.replace("first-run.html");
        return;
      }
      if (!payload.mustChangePassword && route === "first-run") {
        location.replace("index.html");
        return;
      }
      handler();
    }, function () {
      root.innerHTML = '<div class="adm-empty"><span class="empty-icon">' + NT.icon("circle-alert", "icon-lg") + "</span>" +
        "<h1>Administration is offline</h1><p>Start the Nuclear Tutorials server, then reload this page.</p>" +
        '<div class="empty-actions"><a class="btn btn-primary" href="' + NT.base() + 'index.html">Student site</a>' +
        '<button class="btn btn-secondary" type="button" onclick="location.reload()">Reload</button></div></div>';
    });
  });
})();
