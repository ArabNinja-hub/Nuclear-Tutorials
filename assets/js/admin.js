/* ============================================================
   NUCLEAR TUTORIALS — Admin console
   Edits persist to the backend when served by server.js; falls
   back to localStorage when served statically.
   ============================================================ */
(function () {
  var D = NT.data;
  var NAV = [
    { id: "home", label: "Overview", href: "index.html", icon: "layout-dashboard", group: "Overview" },
    { id: "courses", label: "Courses", href: "courses.html", icon: "book-open", group: "Catalogue" },
    { id: "lessons", label: "Lesson access", href: "lessons.html", icon: "lock", group: "Catalogue" },
    { id: "announcements", label: "Announcements", href: "announcements.html", icon: "bell", group: "Catalogue" },
    { id: "packages", label: "Access packages", href: "packages.html", icon: "layers", group: "Access" },
    { id: "codes", label: "Access codes", href: "codes.html", icon: "key", group: "Access" },
    { id: "settings", label: "Settings", href: "settings.html", icon: "settings", group: "System" }
  ];
  var TITLES = {
    home: "Overview",
    courses: "Courses",
    lessons: "Lesson access",
    announcements: "Announcements",
    packages: "Access packages",
    codes: "Access codes",
    settings: "Settings"
  };

  function renderShell() {
    var page = document.body.dataset.admin || "home";
    var sidebar = document.createElement("aside");
    sidebar.className = "admin-side";
    sidebar.id = "adminSide";
    sidebar.innerHTML =
      '<div class="side-brand"><a class="brand" href="index.html">' + NT.logoImg("brand-logo") +
      '<span><span class="brand-name">Nuclear <span>Tutorials</span></span><span class="brand-sub">Administration</span></span></a></div>' +
      '<nav class="side-nav">' + NAV.map(function (item, index) {
        var heading = index === 0 || NAV[index - 1].group !== item.group
          ? '<span class="side-label">' + NT.esc(item.group) + "</span>" : "";
        return heading + '<a href="' + item.href + '" class="' + (page === item.id ? "active" : "") + '"' +
          (page === item.id ? ' aria-current="page"' : "") + ">" + NT.icon(item.icon) + NT.esc(item.label) + "</a>";
      }).join("") +
      '<span class="side-label">Site</span><a href="../index.html">' + NT.icon("external") + "View public site</a>" +
      '<button type="button" class="side-nav-logout" id="sideLogout">' + NT.icon("log-out") + "Sign out</button></nav>";
    document.body.prepend(sidebar);

    var main = document.createElement("div");
    main.className = "admin-main";
    var offline = NT.store.get().serverError === "offline";
    var badgeHtml = offline
      ? '<span class="badge badge-warn">' + NT.icon("info") + "Offline (local)</span>"
      : '<span class="badge badge-success">' + NT.icon("check-circle") + "Connected</span>";
    var footHtml = offline
      ? "Offline mode - changes saved in this browser only."
      : "Connected - changes saved to the platform and visible to all students.";
    main.innerHTML =
      '<a class="skip-link" href="#adminContent">Skip to admin content</a>' +
      '<div class="admin-top"><button class="admin-burger" id="admBurger" type="button" aria-label="Open admin menu" aria-controls="adminSide" aria-expanded="false">' + NT.icon("menu") + "</button>" +
      '<div><div class="crumb">Administration</div><h1>' + NT.esc(TITLES[page] || "Overview") + "</h1></div>" +
      '<div class="spacer"></div>' +
      badgeHtml +
      '<button class="btn btn-sm btn-ghost" id="topLogout" type="button">' + NT.icon("log-out", "icon-sm") + "Sign out</button>" +
      '<a class="btn btn-sm btn-secondary" href="../index.html">' + NT.icon("external", "icon-sm") + "Public site</a></div>" +
      '<main class="admin-content" id="adminContent" tabindex="-1"></main>' +
      '<div class="admin-foot"><span>Nuclear Tutorials</span><span>' + footHtml + "</span></div>";
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
    function logout() {
      NT.store.adminLogout();
      renderLogin();
    }
    var lo1 = document.getElementById("topLogout");
    var lo2 = document.getElementById("sideLogout");
    if (lo1) lo1.addEventListener("click", logout);
    if (lo2) lo2.addEventListener("click", logout);
    return document.getElementById("adminContent");
  }

  function renderLogin() {
    // Remove any existing shell
    document.querySelectorAll(".admin-side, .admin-main, .scrim-side").forEach(function (n) { n.remove(); });
    document.body.classList.add("admin-login-body");
    var wrap = document.createElement("main");
    wrap.className = "admin-login-wrap";
    wrap.innerHTML =
      '<div class="admin-login-card card card-pad">' +
      '<div class="admin-login-brand">' + NT.logoImg("brand-logo") +
      '<div><div class="brand-name">Nuclear <span>Tutorials</span></div><div class="brand-sub">Administration</div></div></div>' +
      '<h1>Sign in to Admin Console</h1>' +
      '<p class="muted" style="margin-bottom:18px">Enter your admin password to manage courses, access codes, announcements and settings.</p>' +
      '<form id="adminLoginForm" class="settings-form"><div class="field">' +
      '<label for="adminPassword">Password</label>' +
      '<input class="input" id="adminPassword" type="password" autocomplete="current-password" placeholder="Admin password" required>' +
      '<div id="adminLoginMsg"></div>' +
      '<button class="btn btn-primary" type="submit" style="margin-top:10px">Sign in</button>' +
      '<p class="field-hint" style="margin-top:14px">Default password is <code class="mono">admin</code> — set the <code class="mono">ADMIN_PASSWORD</code> environment variable in production.</p>' +
      "</form></div>";
    document.body.appendChild(wrap);
    document.getElementById("adminLoginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var pw = document.getElementById("adminPassword").value;
      var msg = document.getElementById("adminLoginMsg");
      msg.innerHTML = "";
      NT.store.adminLogin(pw).then(function () {
        wrap.remove();
        document.body.classList.remove("admin-login-body");
        bootAdmin();
      }).catch(function () {
        msg.innerHTML = '<div class="alert alert-error" style="margin-top:10px">' + NT.icon("circle-alert") + "<div><b>Incorrect password.</b></div></div>";
      });
    });
    document.getElementById("adminPassword").focus();
  }

  function badge(status) {
    var classes = { unused: "badge-outline", redeemed: "badge-warn", published: "badge-success", draft: "badge-warn" };
    var icons = { unused: "key", redeemed: "check", published: "check-circle", draft: "pencil" };
    return '<span class="badge ' + (classes[status] || "badge-outline") + '">' + NT.icon(icons[status] || "info") + NT.esc(NT.cap(status || "draft")) + "</span>";
  }

  function pageHome(root) {
    root.innerHTML =
      '<div class="adm-card"><div class="adm-card-head"><h2>Administration</h2></div>' +
      '<div class="adm-card-body"><p class="muted">Manage the course catalogue, adjust lesson access and package details, publish announcements, and generate access codes.</p></div></div>' +
      '<div class="adm-grid preview-admin-grid">' +
      '<a class="adm-card admin-action-card" href="courses.html"><span class="admin-action-icon">' + NT.icon("book-open") + "</span><h3>Courses</h3><p>Review the course catalogue.</p></a>" +
      '<a class="adm-card admin-action-card" href="lessons.html"><span class="admin-action-icon">' + NT.icon("lock") + "</span><h3>Lesson access</h3><p>Set the package level for each lesson.</p></a>" +
      '<a class="adm-card admin-action-card" href="packages.html"><span class="admin-action-icon">' + NT.icon("layers") + "</span><h3>Access packages</h3><p>Adjust package names, pricing and feature descriptions.</p></a>" +
      '<a class="adm-card admin-action-card" href="codes.html"><span class="admin-action-icon">' + NT.icon("key") + "</span><h3>Access codes</h3><p>Generate and manage access codes for students.</p></a>" +
      '<a class="adm-card admin-action-card" href="announcements.html"><span class="admin-action-icon">' + NT.icon("bell") + "</span><h3>Announcements</h3><p>Publish announcements visible to all students.</p></a>" +
      "</div>";
  }

  function pageCourses(root) {
    var rows = D.COURSES.map(function (course) {
      var lessons = NT.courseLessons(course.id);
      var counts = { basic: 0, standard: 0, premium: 0 };
      lessons.forEach(function (lesson) { counts[NT.levelOf(lesson)]++; });
      var pathways = NT.coursePathways(course).map(function (path) {
        return NT.pathwayLabel(path);
      }).filter(Boolean).join(", ") || "Not specified";
      return '<tr><td class="td-strong" data-label="Course"><a href="../course.html?id=' + encodeURIComponent(course.id) + '">' + NT.esc(course.title) + "</a></td>" +
        '<td data-label="Education level">' + NT.esc(pathways) + "</td>" +
        '<td data-label="Lessons">' + lessons.length + '</td>' +
        '<td data-label="Basic">' + counts.basic + '</td><td data-label="Standard">' + counts.standard + '</td>' +
        '<td data-label="Premium">' + counts.premium + "</td></tr>";
    }).join("");
    root.innerHTML = '<div class="adm-toolbar"><p class="muted small">Overview of courses, their pathways, and lesson breakdown by access tier.</p></div>' +
      '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Course</th><th>Education level</th><th>Lessons</th><th>Basic</th><th>Standard</th><th>Premium</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
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
          var patch = {}; patch.lessonLevels = Object.assign({}, NT.store.get().lessonLevels);
          patch.lessonLevels[id] = select.value;
          NT.store.adminCommit(patch).then(function () {
            NT.toast("Lesson access updated", "success");
            render();
          });
        });
      });
    }
    render();
  }

  function pagePackages(root) {
    function render() {
      var counts = NT.counts();
      root.innerHTML = '<div class="adm-toolbar"><p class="muted small">Configure package pricing and feature descriptions.</p></div>' +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Package</th><th>Price</th><th>Lessons included</th><th>Summary</th><th></th></tr></thead><tbody>' +
        D.LEVELS.map(function (level) {
          var details = NT.packageDetails(level);
          return '<tr><td data-label="Package">' + NT.levelBadge(level) + '<small class="package-admin-name">' + NT.esc(details.name) + "</small></td>" +
            '<td data-label="Price"><b>' + NT.kwacha(NT.packagePrice(level)) + "</b></td>" +
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
          '<div class="field"><label for="packagePrice">Price (K)</label><input class="input" id="packagePrice" type="number" min="0" value="' + NT.packagePrice(level) + '"></div>' +
          '<div class="field"><label for="packageFeatures">What is included</label><textarea class="input" id="packageFeatures" rows="3">' + NT.esc(details.features.join("\n")) + '</textarea><span class="field-hint">Enter one concise item per line.</span></div></div>',
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="savePackage">Save changes</button>'
      });
      modal.querySelector("#savePackage").addEventListener("click", function () {
        var name = modal.querySelector("#packageName").value.trim();
        var price = Number(modal.querySelector("#packagePrice").value);
        if (!name || !Number.isFinite(price) || price < 0) {
          NT.toast("Enter a package name and valid price", "error");
          return;
        }
        var features = modal.querySelector("#packageFeatures").value.split("\n").map(function (item) { return item.trim(); }).filter(Boolean);
        var packagesPatch = {}; packagesPatch[level] = price;
        var pdPatch = {}; Object.keys(NT.store.get().packageDetails || {}).forEach(function (k) { pdPatch[k] = NT.store.get().packageDetails[k]; });
        pdPatch[level] = Object.assign({}, (NT.store.get().packageDetails || {})[level] || {}, { name: name, features: features });
        NT.store.adminCommit({ packages: packagesPatch, packageDetails: pdPatch }).then(function () {
          modal.close();
          NT.toast("Package updated", "success");
          render();
        });
      });
    }
    render();
  }

  function pageCodes(root) {
    function render() {
      var codes = NT.store.get().codes;
      var subText = NT.store.get().serverLoaded
        ? "Codes created here can be redeemed by any student on any device."
        : "Codes created here can be redeemed on this device.";
      root.innerHTML = '<div class="adm-card code-admin-card"><div class="adm-card-head"><div><h2>Generate an access code</h2><span class="sub">' + subText + "</span></div></div>" +
        '<div class="adm-card-body"><div class="codegen"><div class="field"><label for="codePackage">Package</label><select class="input" id="codePackage">' +
        D.LEVELS.map(function (level) { return '<option value="' + level + '">' + D.LEVEL_LABEL[level] + "</option>"; }).join("") +
        '</select></div><button class="btn btn-primary" type="button" id="generateAdminCode">' + NT.icon("key") + "Generate code</button></div></div></div>" +
        (codes.length ? '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Code</th><th>Package</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>' +
          codes.map(function (record) {
            return '<tr><td data-label="Code" class="mono td-strong">' + NT.esc(record.code) + "</td>" +
              '<td data-label="Package">' + NT.levelBadge(record.pkg) + "</td>" +
              '<td data-label="Status">' + badge(record.status) + "</td>" +
              '<td data-label="Created">' + NT.fmtDate(record.created) + "</td>" +
              '<td><button class="btn btn-sm btn-danger-soft" data-del="' + NT.esc(record.code) + '">Revoke</button></td></tr>';
          }).join("") + "</tbody></table></div>" : '<div class="adm-card"><div class="adm-card-body"><p class="muted">No access codes have been generated yet.</p></div></div>');
      root.querySelector("#generateAdminCode").addEventListener("click", function () {
        var btn = this; btn.disabled = true;
        var packageId = root.querySelector("#codePackage").value;
        NT.store.adminAddCode(packageId).then(function () {
          NT.toast("Access code generated", "success");
          render();
        }, function () { btn.disabled = false; NT.toast("Could not generate code", "error"); });
      });
      root.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          NT.store.adminDeleteCode(b.dataset.del).then(function () { render(); NT.toast("Code revoked", "success"); });
        });
      });
    }
    render();
  }

  function pageAnnouncements(root) {
    function render() {
      var notices = NT.store.get().announcements.slice().sort(function (a, b) {
        return new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0);
      });
      root.innerHTML = '<div class="adm-toolbar"><p class="muted small">Draft and publish announcements visible to students.</p></div>' +
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
        var btn = this.querySelector('button[type="submit"]'); btn.disabled = true;
        NT.store.adminAddAnnouncement({ title: title, body: body, status: root.querySelector("#announcementStatus").value, updated: new Date().toISOString() }).then(function () {
          NT.toast("Announcement saved", "success");
          render();
        }, function () { btn.disabled = false; NT.toast("Could not save announcement", "error"); });
      });
      root.querySelectorAll("[data-status]").forEach(function (select) {
        select.addEventListener("change", function () {
          NT.store.adminUpdateAnnouncement(select.dataset.status, { status: select.value, updated: new Date().toISOString() }).then(function () { render(); });
        });
      });
      root.querySelectorAll("[data-edit]").forEach(function (button) {
        button.addEventListener("click", function () { editAnnouncement(button.dataset.edit); });
      });
      root.querySelectorAll("[data-delete]").forEach(function (button) {
        button.addEventListener("click", function () {
          NT.store.adminDeleteAnnouncement(button.dataset.delete).then(function () {
            NT.toast("Announcement deleted", "success"); render();
          });
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
        NT.store.adminUpdateAnnouncement(id, { title: title, body: body, updated: new Date().toISOString() }).then(function () {
          modal.close(); render();
        });
      });
    }
    render();
  }

  function pageSettings(root) {
    var settings = NT.store.get().settings;
    root.innerHTML = '<section class="adm-card"><div class="adm-card-head"><h2>Platform settings</h2></div><div class="adm-card-body">' +
      '<form id="settingsForm" class="settings-form"><div class="field"><label for="supportEmail">Support email <span class="muted">(optional)</span></label><input class="input" id="supportEmail" type="email" value="' + NT.esc(settings.email) + '"><span class="field-hint">If set, this address appears in the public footer.</span></div>' +
      '<div class="field"><label for="accessDays">Access period (days)</label><input class="input" id="accessDays" type="number" min="1" value="' + Number(settings.days) + '"></div>' +
      '<button class="btn btn-primary" type="submit">' + NT.icon("check") + "Save settings</button></form></div></section>" +
      '<section class="adm-card reset-card"><div class="adm-card-head"><h2>Reset platform data</h2></div><div class="adm-card-body"><p class="muted">Clears all generated access codes, announcements, and customizations. Cannot be undone.</p>' +
      '<button class="btn btn-danger-soft" id="resetLocalData">' + NT.icon("rotate") + "Reset all data</button></div></section>";
    root.querySelector("#settingsForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var email = root.querySelector("#supportEmail").value.trim();
      var days = parseInt(root.querySelector("#accessDays").value, 10);
      if ((email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || isNaN(days) || days < 1) {
        NT.toast("Enter a valid email or leave it blank, and set an access period", "error");
        return;
      }
      NT.store.adminCommit({ settings: { email: email, days: days } }).then(function () {
        NT.toast("Settings saved", "success");
      });
    });
    root.querySelector("#resetLocalData").addEventListener("click", function () {
      var modal = NT.modal({
        title: "Reset all platform data?",
        body: "<p class=\"muted\">This will permanently clear all access codes, announcements, and lesson access customizations across the platform.</p>",
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger-soft" id="confirmReset">Reset</button>'
      });
      modal.querySelector("#confirmReset").addEventListener("click", function () {
        NT.store.reset();
        modal.close();
        location.reload();
      });
    });
  }

  var ROUTES = {
    home: pageHome,
    courses: pageCourses,
    lessons: pageLessons,
    announcements: pageAnnouncements,
    packages: pagePackages,
    codes: pageCodes,
    settings: pageSettings
  };

  function bootAdmin() {
    var root = renderShell();
    var route = ROUTES[document.body.dataset.admin || "home"];
    if (route) route(root);
  }

  document.addEventListener("DOMContentLoaded", function () {
    function go() {
      if (NT.store.adminIsAuthed()) bootAdmin();
      else renderLogin();
    }
    if (NT.store.bootstrap) {
      NT.store.bootstrap().then(go, go);
    } else {
      go();
    }
  });
})();
