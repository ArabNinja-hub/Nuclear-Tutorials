/* ============================================================
   NUCLEAR TUTORIALS — Admin console (demo)
   Routing by <body data-admin="...">
   ============================================================ */
(function () {
  var D = NT.data;

  var NAV = [
    { id: "home", label: "Dashboard", href: "index.html", icon: "layout-dashboard" },
    { id: "videos", label: "Videos", href: "videos.html", icon: "video" },
    { id: "courses", label: "Courses", href: "courses.html", icon: "book-open" },
    { id: "packages", label: "Access Packages", href: "packages.html", icon: "layers" },
    { id: "codes", label: "Access Codes", href: "codes.html", icon: "key" },
    { id: "students", label: "Students", href: "students.html", icon: "users" },
    { id: "payments", label: "Payments", href: "payments.html", icon: "receipt" },
    { id: "settings", label: "Settings", href: "settings.html", icon: "settings" }
  ];

  var TITLES = {
    home: ["Admin Dashboard", "Simulated platform overview"],
    videos: ["Videos", "Manage lesson videos and their access levels"],
    courses: ["Courses", "Subjects and their lesson counts"],
    packages: ["Access Packages", "Pricing and what each package includes"],
    codes: ["Access Codes", "Generate and track redemption codes"],
    students: ["Students", "Enrolled students and their packages"],
    payments: ["Payments", "Simulated payment records"],
    settings: ["Settings", "Platform configuration (demo)"]
  };

  /* ---------------- shell ---------------- */
  function renderShell() {
    var page = document.body.dataset.admin || "home";
    var side = document.createElement("aside");
    side.className = "admin-side";
    side.id = "adminSide";
    side.innerHTML =
      '<div class="side-brand"><a class="brand" href="../index.html">' + NT.logoImg("brand-logo") +
      '<span><span class="brand-name">Nuclear <span>Tutorials</span></span><span class="brand-sub">Admin console</span></span></a></div>' +
      '<nav class="side-nav"><span class="side-label">Manage</span>' +
      NAV.map(function (n) {
        return '<a href="' + n.href + '" class="' + (page === n.id ? "active" : "") + '">' + NT.icon(n.icon) + n.label + "</a>";
      }).join("") +
      '<span class="side-label">Switch</span>' +
      '<a href="../index.html">' + NT.icon("external") + "View public site</a>" +
      "</nav>" +
      '<div class="side-foot"><div class="side-user"><span class="avatar">AD</span><span><b>Admin (demo)</b><small>owner@nucleartutorials.zm</small></span></div></div>';
    document.body.prepend(side);

    var main = document.createElement("div");
    main.className = "admin-main";
    main.innerHTML =
      '<div class="admin-top">' +
      '<button class="admin-burger" id="admBurger" aria-label="Open admin menu">' + NT.icon("menu") + "</button>" +
      '<div><div class="crumb">Admin / ' + TITLES[page][0] + "</div><h1>" + TITLES[page][0] + "</h1></div>" +
      '<div class="spacer"></div>' +
      '<span class="badge badge-warn">' + NT.icon("info") + "Demo data</span>" +
      '<a class="btn btn-sm btn-secondary" href="../index.html">' + NT.icon("external", "icon-sm") + "Public site</a>" +
      "</div>" +
      '<div class="admin-content" id="adminContent"></div>' +
      '<div class="admin-foot"><span>Nuclear Tutorials admin · demo build</span><span>All figures simulated — no production data</span></div>';
    document.body.appendChild(main);

    var scrim = document.createElement("div");
    scrim.className = "scrim-side";
    document.body.appendChild(scrim);
    document.getElementById("admBurger").addEventListener("click", function () {
      document.body.classList.toggle("side-open");
    });
    scrim.addEventListener("click", function () { document.body.classList.remove("side-open"); });
    return document.getElementById("adminContent");
  }

  /* ---------------- helpers ---------------- */
  function statusBadge(st) {
    var map = { Active: "badge-success", Expired: "badge-danger", active: "badge-success", unused: "badge-outline", redeemed: "badge-warn", published: "badge-success", draft: "badge-warn" };
    var ico = { Active: "badge-check", Expired: "clock", active: "check", unused: "key", redeemed: "receipt", published: "check-circle", draft: "pencil" }[st] || "info";
    return '<span class="badge ' + (map[st] || "badge-outline") + '">' + NT.icon(ico) + NT.cap(st) + "</span>";
  }

  function revenueFigures() {
    var s = NT.store.get();
    var byPkg = Object.assign({}, D.BASE_STATS.revenueByPackage);
    var total = D.BASE_STATS.revenue;
    s.payments.forEach(function (p) {
      if (p.seeded) return;
      byPkg[p.pkg] = (byPkg[p.pkg] || 0) + p.amount;
      total += p.amount;
    });
    var students = D.BASE_STATS.students + s.students.filter(function (x) { return !x.seeded; }).length;
    var active = D.BASE_STATS.activeAccess + (s.access ? 1 : 0) + s.students.filter(function (x) { return !x.seeded && x.status === "Active"; }).length;
    return { byPkg: byPkg, total: total, students: students, active: active };
  }

  /* ---------------- home ---------------- */
  function pageHome(root) {
    var s = NT.store.get();
    var fig = revenueFigures();
    var counts = NT.counts();
    var maxRev = Math.max.apply(null, D.LEVELS.map(function (l) { return fig.byPkg[l]; }));

    root.innerHTML =
      '<div class="adm-stats">' +
      '<div class="card adm-stat"><span class="lab">' + NT.icon("users") + "Total Students</span><span class=\"val\">" + fig.students.toLocaleString() + '</span><span class="delta up">' + NT.icon("trending-up") + "+38 this month</span></div>" +
      '<div class="card adm-stat"><span class="lab">' + NT.icon("badge-check") + "Active Access</span><span class=\"val\">" + fig.active.toLocaleString() + '</span><span class="delta flat">' + NT.icon("info") + Math.round((fig.active / fig.students) * 100) + "% of students</span></div>" +
      '<div class="card adm-stat"><span class="lab">' + NT.icon("video") + "Total Videos</span><span class=\"val\">" + counts.total + '</span><span class="delta flat">' + NT.icon("library") + D.COURSES.length + " courses</span></div>" +
      '<div class="card adm-stat"><span class="lab">' + NT.icon("banknote") + "Revenue</span><span class=\"val\">" + NT.kwacha(fig.total) + '</span><span class="delta up">' + NT.icon("trending-up") + "All packages</span></div>" +
      "</div>" +

      '<div class="adm-grid">' +
      '<div class="adm-card"><div class="adm-card-head"><h3>Recent Payments</h3><a class="link-arrow small" href="payments.html">All payments ' + NT.icon("arrow-right", "icon-sm") + "</a></div>" +
      '<div class="table-wrap" style="border:none;box-shadow:none;border-radius:0"><table class="nt-table"><thead><tr><th>Student</th><th>Package</th><th>Method</th><th>Amount</th><th>Date</th></tr></thead><tbody>' +
      s.payments.slice(0, 6).map(function (p) {
        return "<tr><td class=\"td-strong\" data-label=\"Student\">" + NT.esc(p.student) + '</td><td data-label="Package">' + NT.levelBadge(p.pkg) + '</td><td data-label="Method">' + NT.esc(p.method) + '</td><td data-label="Amount"><b>' + NT.kwacha(p.amount) + '</b></td><td data-label="Date">' + NT.fmtDate(p.date) + "</td></tr>";
      }).join("") +
      "</tbody></table></div></div>" +

      '<div class="stack">' +
      '<div class="adm-card"><div class="adm-card-head"><h3>Revenue by package</h3><span class="sub">Simulated</span></div>' +
      '<div class="adm-card-body"><div class="rev-bars">' +
      D.LEVELS.map(function (lv) {
        return '<div class="rev-row r-' + lv + '"><div class="top"><span>' + D.LEVEL_LABEL[lv] + " · " + NT.kwacha(NT.packagePrice(lv)) + '</span><b>' + NT.kwacha(fig.byPkg[lv]) + "</b></div>" +
          '<div class="bar"><i style="width:' + Math.round((fig.byPkg[lv] / maxRev) * 100) + '%"></i></div></div>';
      }).join("") +
      "</div></div></div>" +
      '<div class="adm-card"><div class="adm-card-head"><h3>Quick actions</h3></div><div class="adm-card-body" style="display:flex;flex-direction:column;gap:10px">' +
      '<a class="btn btn-secondary btn-block" href="codes.html">' + NT.icon("key", "icon-sm") + "Generate access code</a>" +
      '<a class="btn btn-secondary btn-block" href="videos.html">' + NT.icon("upload", "icon-sm") + "Upload a video</a>" +
      '<a class="btn btn-secondary btn-block" href="../control.html">' + NT.icon("eye", "icon-sm") + "Open access-control demo</a>" +
      "</div></div>" +
      "</div></div>";
  }

  /* ---------------- videos ---------------- */
  function pageVideos(root) {
    function render() {
      var q = (root.querySelector("#vSearch") || {}).value || "";
      var c = (root.querySelector("#vCourse") || {}).value || "";
      q = q.trim().toLowerCase();
      var list = NT.allLessons().filter(function (l) {
        if (c && l.courseId !== c) return false;
        if (q && l.title.toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      root.innerHTML =
        '<div class="adm-toolbar">' +
        '<div class="search">' + NT.icon("search") + '<input class="input" id="vSearch" placeholder="Search lessons…" value="' + NT.esc(q) + '"></div>' +
        '<select class="input" id="vCourse"><option value="">All courses</option>' +
        D.COURSES.map(function (x) { return '<option value="' + x.id + '"' + (c === x.id ? " selected" : "") + ">" + x.title + "</option>"; }).join("") +
        "</select>" +
        '<span class="spacer"></span><span class="badge badge-brand">' + NT.icon("video") + list.length + " videos</span>" +
        '<button class="btn btn-primary" id="uploadBtn">' + NT.icon("upload") + "Upload Video</button>" +
        "</div>" +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Lesson</th><th>Course</th><th>Duration</th><th>Access Level</th><th>Status</th></tr></thead><tbody>' +
        list.map(function (l) {
          return "<tr><td class=\"td-strong\" data-label=\"Lesson\">" + NT.esc(l.title) + '</td><td data-label="Course">' + NT.esc(l.courseTitle) + '</td><td data-label="Duration" class="mono">' + l.duration + '</td>' +
            '<td data-label="Access Level"><select class="lvl-select" data-lesson="' + l.id + '">' +
            D.LEVELS.map(function (lv) { return '<option value="' + lv + '"' + (NT.levelOf(l) === lv ? " selected" : "") + ">" + D.LEVEL_LABEL[lv] + "</option>"; }).join("") +
            '</select></td><td data-label="Status">' + statusBadge(l.status || "published") + "</td></tr>";
        }).join("") +
        "</tbody></table></div>";

      root.querySelector("#vSearch").addEventListener("input", render);
      root.querySelector("#vCourse").addEventListener("change", render);
      root.querySelector("#uploadBtn").addEventListener("click", uploadModal);
      root.querySelectorAll("[data-lesson]").forEach(function (sel) {
        sel.addEventListener("change", function () {
          var id = sel.dataset.lesson;
          NT.store.mutate(function (s) { s.videoLevels[id] = sel.value; });
          NT.toast("Access level updated — the student library reflects this immediately.", "success");
          render();
        });
      });
    }

    function uploadModal() {
      var m = NT.modal({
        title: "Upload Video (simulated)",
        body:
          '<div class="upload-zone" id="upZone">' + NT.icon("upload") +
          "<b>Drop a lesson video here</b><br><span class=\"small\">Demo only — no file is transferred.</span>" +
          '<div class="upload-bar hidden" id="upBar"><i></i></div></div>' +
          '<div class="field"><label>Lesson title</label><input class="input" id="upTitle" placeholder="e.g. Trigonometry Basics"></div>' +
          '<div class="input-row"><div class="field"><label>Course</label><select class="input" id="upCourse">' +
          D.COURSES.map(function (c) { return '<option value="' + c.id + '">' + c.title + "</option>"; }).join("") +
          '</select></div><div class="field"><label>Duration</label><input class="input mono" id="upDur" value="15:00"></div></div>' +
          '<div class="field"><label>Access level</label><select class="input" id="upLevel">' +
          D.LEVELS.map(function (lv) { return '<option value="' + lv + '">' + D.LEVEL_LABEL[lv] + "</option>"; }).join("") +
          "</select></div>",
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="upGo">' + NT.icon("upload") + "Upload (demo)</button>"
      });
      m.querySelector("#upGo").addEventListener("click", function () {
        var title = m.querySelector("#upTitle").value.trim() || "New Lesson";
        var courseId = m.querySelector("#upCourse").value;
        var dur = m.querySelector("#upDur").value.trim() || "15:00";
        var lvl = m.querySelector("#upLevel").value;
        var bar = m.querySelector("#upBar");
        bar.classList.remove("hidden");
        var w = 0;
        var t = setInterval(function () {
          w += 7 + Math.random() * 12;
          bar.querySelector("i").style.width = Math.min(100, w) + "%";
          if (w >= 100) {
            clearInterval(t);
            var course = NT.course(courseId);
            var n = NT.courseLessons(courseId).length + 1;
            NT.store.mutate(function (s) {
              s.extraLessons.push({
                id: courseId + "-up" + (s.extraLessons.length + 1),
                courseId: courseId, courseTitle: course.title, index: n,
                title: title, duration: dur, level: lvl, status: "published",
                description: course.title + " · " + title + ". Newly uploaded tutorial video (demo)."
              });
            });
            m.close();
            NT.toast("Video published: " + title, "success");
            render();
          }
        }, 120);
      });
    }

    render();
  }

  /* ---------------- courses ---------------- */
  function pageCourses(root) {
    function render() {
      var s = NT.store.get();
      var rows = D.COURSES.map(function (c) {
        var ls = NT.courseLessons(c.id);
        var n = { basic: 0, standard: 0, premium: 0 };
        ls.forEach(function (l) { n[NT.levelOf(l)]++; });
        return "<tr><td class=\"td-strong\" data-label=\"Course\">" + c.title + '</td><td data-label="Lessons">' + ls.length + '</td><td data-label="Basic">' + n.basic + '</td><td data-label="Standard">' + n.standard + '</td><td data-label="Premium">' + n.premium + '</td><td data-label="Status">' + statusBadge("published") + "</td></tr>";
      }).join("");
      var extra = s.extraCourses.map(function (c) {
        return "<tr><td class=\"td-strong\" data-label=\"Course\">" + NT.esc(c.title) + '</td><td data-label="Lessons">0</td><td data-label="Basic">0</td><td data-label="Standard">0</td><td data-label="Premium">0</td><td data-label="Status">' + statusBadge("draft") + "</td></tr>";
      }).join("");
      root.innerHTML =
        '<div class="adm-toolbar"><p class="muted small">Lessons per access level, per course. Changing a video\'s level on the Videos page updates these counts.</p>' +
        '<span class="spacer"></span><button class="btn btn-primary" id="createCourse">' + NT.icon("plus") + "Create Course</button></div>" +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Course</th><th>Lessons</th><th>Basic</th><th>Standard</th><th>Premium</th><th>Status</th></tr></thead><tbody>' +
        rows + extra + "</tbody></table></div>";
      root.querySelector("#createCourse").addEventListener("click", function () {
        var m = NT.modal({
          title: "Create Course (simulated)",
          body: '<div class="field"><label>Course title</label><input class="input" id="cTitle" placeholder="e.g. Geography"></div>' +
            '<div class="field"><label>Description</label><textarea class="input" id="cDesc" rows="3" placeholder="Short course description"></textarea></div>' +
            '<p class="field-hint">The course is created as a draft. Upload videos to populate its lessons.</p>',
          footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="cGo">Create course</button>'
        });
        m.querySelector("#cGo").addEventListener("click", function () {
          var title = m.querySelector("#cTitle").value.trim() || "New Course";
          NT.store.mutate(function (s) {
            s.extraCourses.push({ id: "c" + (s.extraCourses.length + 1), title: title, desc: m.querySelector("#cDesc").value.trim(), status: "draft" });
          });
          m.close();
          NT.toast("Course created as draft: " + title, "success");
          render();
        });
      });
    }
    render();
  }

  /* ---------------- packages ---------------- */
  function pagePackages(root) {
    function render() {
      var s = NT.store.get();
      var counts = NT.counts();
      var cum = { basic: counts.basic, standard: counts.basic + counts.standard, premium: counts.total };
      root.innerHTML =
        '<div class="adm-toolbar"><p class="muted small">Packages control what a student can watch after payment.</p><span class="spacer"></span>' +
        '<button class="btn btn-primary" id="createPkg">' + NT.icon("plus") + "Create Package</button></div>" +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Package</th><th>Price</th><th>Includes</th><th>Videos</th><th>Action</th></tr></thead><tbody>' +
        D.LEVELS.map(function (lv) {
          var p = D.PACKAGES[lv];
          return "<tr><td data-label=\"Package\">" + NT.levelBadge(lv) + '</td><td data-label="Price"><b>' + NT.kwacha(NT.packagePrice(lv)) + "</b></td>" +
            '<td data-label="Includes"><span class="small muted">' + p.features.join(" · ") + "</span></td>" +
            '<td data-label="Videos"><b>' + cum[lv] + "</b> <span class=\"tiny muted\">of " + counts.total + "</span></td>" +
            '<td data-label="Action"><button class="btn btn-sm btn-secondary" data-edit="' + lv + '">' + NT.icon("pencil", "icon-sm") + "Edit</button></td></tr>";
        }).join("") +
        "</tbody></table></div>";
      root.querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () {
          var lv = b.dataset.edit;
          var m = NT.modal({
            title: "Edit " + D.LEVEL_LABEL[lv] + " package",
            body: '<div class="field"><label>Price (K)</label><input class="input" type="number" id="pPrice" value="' + NT.packagePrice(lv) + '"></div>' +
              '<div class="field"><label>Includes (one per line)</label><textarea class="input" id="pFeat" rows="4">' + D.PACKAGES[lv].features.join("\n") + '</textarea></div>' +
              '<p class="field-hint">Price changes apply across pricing, checkout and the public site. Feature text is display-only in this demo.</p>',
            footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="pSave">Save changes</button>'
          });
          m.querySelector("#pSave").addEventListener("click", function () {
            var v = parseInt(m.querySelector("#pPrice").value, 10);
            if (!isNaN(v) && v > 0) NT.store.mutate(function (st) { st.packages[lv] = v; });
            m.close();
            NT.toast(D.LEVEL_LABEL[lv] + " package updated", "success");
            render();
          });
        });
      });
      root.querySelector("#createPkg").addEventListener("click", function () {
        var m = NT.modal({
          title: "Create Package (simulated)",
          body: '<div class="input-row"><div class="field"><label>Package name</label><input class="input" id="nName" placeholder="e.g. Exam Booster"></div>' +
            '<div class="field"><label>Price (K)</label><input class="input" type="number" id="nPrice" value="150"></div></div>' +
            '<div class="field"><label>Includes</label><textarea class="input" rows="3" placeholder="One benefit per line"></textarea></div>' +
            '<p class="field-hint">Creating additional packages is simulated in the demo — the three live tiers remain Basic, Standard and Premium.</p>',
          footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="nGo">Create package</button>'
        });
        m.querySelector("#nGo").addEventListener("click", function () {
          m.close();
          NT.toast("Package \"" + (m.querySelector("#nName").value || "New package") + "\" created (demo)", "success");
        });
      });
    }
    render();
  }

  /* ---------------- codes ---------------- */
  function pageCodes(root) {
    function render() {
      var s = NT.store.get();
      root.innerHTML =
        '<div class="adm-card" style="margin-bottom:20px"><div class="adm-card-head"><h3>Generate Access Code</h3><span class="sub">Codes appear below and can be redeemed on the public Access page</span></div>' +
        '<div class="adm-card-body"><div class="codegen">' +
        '<div class="field"><label for="gPkg">Package</label><select class="input" id="gPkg">' +
        D.LEVELS.map(function (lv) { return '<option value="' + lv + '">' + D.LEVEL_LABEL[lv] + " · " + NT.kwacha(NT.packagePrice(lv)) + "</option>"; }).join("") +
        '</select></div><button class="btn btn-primary" id="gGo" style="height:42px">' + NT.icon("key") + "Generate Access Code</button>" +
        "</div></div></div>" +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Code</th><th>Package</th><th>Status</th><th>Created</th></tr></thead><tbody>' +
        s.codes.map(function (c) {
          return '<tr><td data-label="Code" class="mono td-strong">' + NT.esc(c.code) + '</td><td data-label="Package">' + NT.levelBadge(c.pkg) + '</td><td data-label="Status">' + statusBadge(c.status) + '</td><td data-label="Created">' + NT.fmtDate(c.created) + "</td></tr>";
        }).join("") +
        "</tbody></table></div>";
      root.querySelector("#gGo").addEventListener("click", function () {
        var pkg = root.querySelector("#gPkg").value;
        var code = NT.store.genCode(pkg);
        NT.store.addCode(code, pkg, "unused");
        NT.toast("Generated " + code + " (" + D.LEVEL_LABEL[pkg] + ")", "success");
        render();
      });
    }
    render();
  }

  /* ---------------- students ---------------- */
  function pageStudents(root) {
    function render() {
      var s = NT.store.get();
      root.innerHTML =
        '<div class="adm-toolbar"><p class="muted small">' + s.students.length + " records shown (demo subset of " + D.BASE_STATS.students.toLocaleString() + " total students)</p>" +
        '<span class="spacer"></span><button class="btn btn-primary" id="addStudent">' + NT.icon("plus") + "Add Student</button></div>" +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Name</th><th>Package</th><th>Joined</th><th>Status</th></tr></thead><tbody>' +
        s.students.map(function (st) {
          return '<tr><td data-label="Name" class="td-strong">' + NT.esc(st.name) + '</td><td data-label="Package">' + NT.levelBadge(st.pkg) + '</td><td data-label="Joined">' + NT.fmtDate(st.joined) + '</td><td data-label="Status">' + statusBadge(st.status) + "</td></tr>";
        }).join("") +
        "</tbody></table></div>";
      root.querySelector("#addStudent").addEventListener("click", function () {
        var m = NT.modal({
          title: "Add Student (simulated)",
          body: '<div class="field"><label>Full name</label><input class="input" id="sName" placeholder="e.g. Grace Banda"></div>' +
            '<div class="input-row"><div class="field"><label>Package</label><select class="input" id="sPkg">' +
            D.LEVELS.map(function (lv) { return '<option value="' + lv + '">' + D.LEVEL_LABEL[lv] + "</option>"; }).join("") +
            '</select></div><div class="field"><label>Status</label><select class="input" id="sStatus"><option>Active</option><option>Expired</option></select></div></div>',
          footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="sGo">Add student</button>'
        });
        m.querySelector("#sGo").addEventListener("click", function () {
          var name = m.querySelector("#sName").value.trim() || "New Student";
          NT.store.addStudent({ name: name, pkg: m.querySelector("#sPkg").value, joined: new Date().toISOString().slice(0, 10), status: m.querySelector("#sStatus").value });
          m.close();
          NT.toast("Student added: " + name, "success");
          render();
        });
      });
    }
    render();
  }

  /* ---------------- payments ---------------- */
  function pagePayments(root) {
    var s = NT.store.get();
    var total = s.payments.reduce(function (a, p) { return a + p.amount; }, 0);
    root.innerHTML =
      '<div class="adm-toolbar"><p class="muted small">Session payments are appended to the top of this list. Recorded session total: <b>' + NT.kwacha(total) + "</b></p>" +
      '<span class="spacer"></span><span class="badge badge-warn">' + NT.icon("info") + "Simulated transactions</span></div>" +
      '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Student</th><th>Package</th><th>Method</th><th>Amount</th><th>Date</th></tr></thead><tbody>' +
      s.payments.map(function (p) {
        return '<tr><td data-label="Student" class="td-strong">' + NT.esc(p.student) + '</td><td data-label="Package">' + NT.levelBadge(p.pkg) + '</td><td data-label="Method">' + NT.esc(p.method) + '</td><td data-label="Amount"><b>' + NT.kwacha(p.amount) + '</b></td><td data-label="Date">' + NT.fmtDate(p.date) + (p.seeded ? "" : ' <span class="badge badge-brand">new</span>') + "</td></tr>";
      }).join("") +
      "</tbody></table></div>";
  }

  /* ---------------- settings ---------------- */
  function pageSettings(root) {
    var s = NT.store.get();
    root.innerHTML =
      '<div class="adm-card"><div class="adm-card-head"><h3>Platform settings</h3><span class="sub">Demo configuration</span></div>' +
      '<div class="adm-card-body"><form class="settings-form" id="setForm">' +
      '<div class="field"><label>Platform name</label><input class="input" id="setName" value="' + NT.esc(s.settings.name) + '"></div>' +
      '<div class="field"><label>Support email</label><input class="input" id="setEmail" type="email" value="' + NT.esc(s.settings.email) + '"></div>' +
      '<div class="input-row"><div class="field"><label>Currency</label><select class="input" id="setCur">' +
      ["Zambian Kwacha (K)", "US Dollar ($)", "South African Rand (R)"].map(function (c) { return "<option" + (c === s.settings.currency ? " selected" : "") + ">" + c + "</option>"; }).join("") +
      '</select></div><div class="field"><label>Access duration (days)</label><input class="input" id="setDays" type="number" min="1" value="' + s.settings.days + '"></div></div>' +
      '<div><button class="btn btn-primary" type="submit">' + NT.icon("check") + "Save Changes</button></div>" +
      "</form></div></div>" +
      '<div class="adm-card" style="margin-top:20px;border-color:#f0d3d0"><div class="adm-card-head"><h3>Demo data</h3><span class="badge badge-danger">' + NT.icon("circle-alert") + "Careful</span></div>" +
      '<div class="adm-card-body"><p class="muted small" style="margin-bottom:14px">Reset returns the demo to its factory state: clears active access, completions, generated codes, payments and admin edits.</p>' +
      '<button class="btn btn-danger-soft" id="resetDemo">' + NT.icon("rotate") + "Reset demo data</button></div></div>";

    root.querySelector("#setForm").addEventListener("submit", function (e) {
      e.preventDefault();
      NT.store.mutate(function (st) {
        st.settings.name = root.querySelector("#setName").value || "Nuclear Tutorials";
        st.settings.email = root.querySelector("#setEmail").value || st.settings.email;
        st.settings.currency = root.querySelector("#setCur").value;
        st.settings.days = Math.max(1, parseInt(root.querySelector("#setDays").value, 10) || 30);
      });
      NT.toast("Settings saved (demo)", "success");
    });
    root.querySelector("#resetDemo").addEventListener("click", function () {
      var m = NT.modal({
        title: "Reset demo data?",
        body: "<p class=\"muted\">This clears all session state: active access, completed lessons, generated codes, simulated payments and admin edits. The page will reload.</p>",
        footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger-soft" id="doReset">Reset everything</button>'
      });
      m.querySelector("#doReset").addEventListener("click", function () {
        NT.store.reset();
        location.reload();
      });
    });
  }

  var routes = { home: pageHome, videos: pageVideos, courses: pageCourses, packages: pagePackages, codes: pageCodes, students: pageStudents, payments: pagePayments, settings: pageSettings };

  document.addEventListener("DOMContentLoaded", function () {
    var root = renderShell();
    var page = document.body.dataset.admin || "home";
    if (routes[page]) routes[page](root);
  });
})();
