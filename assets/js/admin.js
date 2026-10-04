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
    { id: "announcements", label: "Announcements", href: "announcements.html", icon: "bell" },
    { id: "packages", label: "Access Packages", href: "packages.html", icon: "layers" },
    { id: "codes", label: "Access Codes", href: "codes.html", icon: "key" },
    { id: "students", label: "Students", href: "students.html", icon: "users" },
    { id: "payments", label: "Payments", href: "payments.html", icon: "receipt" },
    { id: "settings", label: "Settings", href: "settings.html", icon: "settings" }
  ];

  var TITLES = {
    home: ["Admin Dashboard", "Simulated platform overview"],
    videos: ["Videos", "Manage lesson videos and their access levels"],
    courses: ["Courses", "Course catalogue and academic pathways"],
    announcements: ["Announcements", "Publish student-facing platform updates"],
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
      '<div class="card adm-stat"><span class="lab">' + NT.icon("users") + "Demo student records</span><span class=\"val\">" + fig.students.toLocaleString() + '</span><span class="delta flat">' + NT.icon("info") + "Simulated overview figure</span></div>" +
      '<div class="card adm-stat"><span class="lab">' + NT.icon("badge-check") + "Simulated active access</span><span class=\"val\">" + fig.active.toLocaleString() + '</span><span class="delta flat">' + NT.icon("info") + "Illustrative demo figure</span></div>" +
      '<div class="card adm-stat"><span class="lab">' + NT.icon("video") + "Sample video lessons</span><span class=\"val\">" + counts.total + '</span><span class="delta flat">' + NT.icon("library") + D.COURSES.length + " sample courses</span></div>" +
      '<div class="card adm-stat"><span class="lab">' + NT.icon("banknote") + "Simulated revenue</span><span class=\"val\">" + NT.kwacha(fig.total) + '</span><span class="delta flat">' + NT.icon("info") + "Not business reporting</span></div>" +
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
    function pathwaySummary(course) {
      return NT.coursePathways(course).map(function (path) {
        if (path.educationLevel === "high-school") {
          var grade = D.HIGH_SCHOOL_LEVELS.filter(function (item) { return item.id === path.levelId; })[0];
          return "High School" + (grade ? " · " + grade.label : "");
        }
        var university = NT.university(path.universityId);
        var programme = NT.programme(path.programmeId);
        return "University" + (university ? " · " + university.name : " · institution not specified") +
          (programme ? " · " + programme.name + (programme.school ? " · " + programme.school : "") : " · programme / school not specified");
      }).join("<br>");
    }

    function render() {
      var s = NT.store.get();
      var rows = D.COURSES.map(function (course) {
        var lessons = NT.courseLessons(course.id);
        var counts = { basic: 0, standard: 0, premium: 0 };
        lessons.forEach(function (lesson) { counts[NT.levelOf(lesson)]++; });
        var subject = NT.subject(course.subjectId) || { title: course.title };
        return '<tr><td class="td-strong" data-label="Course">' + NT.esc(course.title) + '</td>' +
          '<td data-label="Subject">' + NT.esc(subject.title) + '</td><td data-label="Academic path">' + pathwaySummary(course) + '</td>' +
          '<td data-label="Lessons">' + lessons.length + '</td><td data-label="Basic">' + counts.basic + '</td><td data-label="Standard">' + counts.standard + '</td>' +
          '<td data-label="Premium">' + counts.premium + '</td><td data-label="Status">' + statusBadge("published") + "</td></tr>";
      }).join("");
      var extra = s.extraCourses.map(function (course) {
        var subject = NT.subject(course.subjectId) || { title: "—" };
        var level = NT.educationLevel(course.educationLevel);
        var levelLabel = level ? level.label : "—";
        var grade = D.HIGH_SCHOOL_LEVELS.filter(function (item) { return item.id === course.levelId; })[0];
        var university = NT.university(course.universityId);
        var programme = NT.programme(course.programmeId);
        var universityName = course.universityName || (university && university.name) || "Institution not specified";
        var programmeName = course.programmeName || (programme && programme.name) || "Programme / school not specified";
        var path = course.educationLevel === "university"
          ? levelLabel + " · " + universityName + " · " + programmeName
          : levelLabel + (grade ? " · " + grade.label : "");
        return '<tr><td class="td-strong" data-label="Course">' + NT.esc(course.title) + '</td><td data-label="Subject">' + NT.esc(subject.title) +
          '</td><td data-label="Academic path">' + NT.esc(path) + '</td><td data-label="Lessons">0</td><td data-label="Basic">0</td><td data-label="Standard">0</td><td data-label="Premium">0</td>' +
          '<td data-label="Status">' + statusBadge("draft") + "</td></tr>";
      }).join("");

      root.innerHTML =
        '<div class="adm-toolbar"><p class="muted small">Course records connect a subject to an education pathway. Lesson access levels stay manageable from Videos.</p>' +
        '<span class="spacer"></span><button class="btn btn-primary" id="createCourse">' + NT.icon("plus") + "Create Course</button></div>" +
        '<div class="academic-model-strip"><div><b>High School</b><span>Grade / Form / Level → Subject → Course → Lessons</span></div><div><b>University</b><span>University → Programme / School → Course → Lessons</span></div></div>' +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Course</th><th>Subject</th><th>Academic path</th><th>Lessons</th><th>Basic</th><th>Standard</th><th>Premium</th><th>Status</th></tr></thead><tbody>' +
        rows + extra + "</tbody></table></div>";

      root.querySelector("#createCourse").addEventListener("click", function () {
        var levels = D.EDUCATION_LEVELS.map(function (item) { return '<option value="' + item.id + '">' + NT.esc(item.label) + "</option>"; }).join("");
        var subjects = D.SUBJECTS.map(function (item) { return '<option value="' + item.id + '">' + NT.esc(item.title) + "</option>"; }).join("");
        var m = NT.modal({
          title: "Create course draft",
          body: '<div class="field"><label for="cTitle">Course title</label><input class="input" id="cTitle" placeholder="e.g. Geography"></div>' +
            '<div class="field"><label for="cDesc">Description</label><textarea class="input" id="cDesc" rows="3" placeholder="Short course description"></textarea></div>' +
            '<div class="input-row"><div class="field"><label for="cLevel">Education level</label><select class="input" id="cLevel">' + levels + '</select></div>' +
            '<div class="field"><label for="cSubject">Subject</label><select class="input" id="cSubject">' + subjects + "</select></div></div>" +
            '<div id="cPathwayFields"></div>' +
            '<p class="field-hint">This creates a locally saved draft with its academic pathway. New catalogue taxonomies can be added to the shared education data model.</p>',
          footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="cGo">Create course draft</button>'
        });
        var levelInput = m.querySelector("#cLevel");
        var pathFields = m.querySelector("#cPathwayFields");
        function renderPathwayFields() {
          if (levelInput.value === "university") {
            pathFields.innerHTML = '<div class="input-row"><div class="field"><label for="cUniversity">University (optional)</label><input class="input" id="cUniversity" maxlength="100" placeholder="Verified institution name"></div>' +
              '<div class="field"><label for="cProgramme">Programme / School (optional)</label><input class="input" id="cProgramme" maxlength="100" placeholder="Verified programme or school"></div></div>' +
              '<p class="field-hint">Use verified academic names. University affiliations are not pre-filled in this demo.</p>';
          } else {
            pathFields.innerHTML = '<div class="field"><label for="cGrade">Grade / Form / Level</label><select class="input" id="cGrade">' +
              D.HIGH_SCHOOL_LEVELS.map(function (item) { return '<option value="' + item.id + '">' + NT.esc(item.label + " · " + item.detail) + "</option>"; }).join("") + "</select></div>";
          }
        }
        levelInput.addEventListener("change", renderPathwayFields);
        renderPathwayFields();

        m.querySelector("#cGo").addEventListener("click", function () {
          var title = m.querySelector("#cTitle").value.trim() || "New Course";
          var course = {
            title: title,
            desc: m.querySelector("#cDesc").value.trim(),
            subjectId: m.querySelector("#cSubject").value,
            educationLevel: levelInput.value,
            status: "draft"
          };
          if (course.educationLevel === "university") {
            course.universityName = m.querySelector("#cUniversity").value.trim();
            course.programmeName = m.querySelector("#cProgramme").value.trim();
          } else {
            course.levelId = m.querySelector("#cGrade").value;
          }
          NT.store.mutate(function (state) {
            course.id = "c" + (state.extraCourses.length + 1);
            state.extraCourses.push(course);
          });
          m.close();
          NT.toast("Course draft saved: " + title, "success");
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
      var extraPackages = Array.isArray(s.extraPackages) ? s.extraPackages : [];
      root.innerHTML =
        '<div class="adm-toolbar"><p class="muted small">Packages control what a student can watch after payment.</p><span class="spacer"></span>' +
        '<button class="btn btn-primary" id="createPkg">' + NT.icon("plus") + "New Package Draft</button></div>" +
        '<div class="table-wrap"><table class="nt-table"><thead><tr><th>Package</th><th>Price</th><th>Includes</th><th>Videos</th><th>Action</th></tr></thead><tbody>' +
        D.LEVELS.map(function (lv) {
          var p = NT.packageDetails(lv);
          return "<tr><td data-label=\"Package\">" + NT.levelBadge(lv) + (p.name !== D.LEVEL_LABEL[lv] ? '<small class="package-admin-name">' + NT.esc(p.name) + "</small>" : "") + '</td><td data-label="Price"><b>' + NT.kwacha(NT.packagePrice(lv)) + "</b></td>" +
            '<td data-label="Includes"><span class="small muted">' + NT.esc(p.features.join(" · ")) + "</span></td>" +
            '<td data-label="Videos"><b>' + cum[lv] + "</b> <span class=\"tiny muted\">of " + counts.total + "</span></td>" +
            '<td data-label="Action"><button class="btn btn-sm btn-secondary" data-edit="' + lv + '">' + NT.icon("pencil", "icon-sm") + "Edit</button></td></tr>";
        }).join("") +
        extraPackages.map(function (pkg) {
          var benefits = Array.isArray(pkg.features) && pkg.features.length ? pkg.features.join(" · ") : "Benefits not set";
          return '<tr class="package-draft-row"><td data-label="Package"><b>' + NT.esc(pkg.name) + '</b><span class="badge badge-warn">Draft</span><small class="package-admin-name">Admin-only · not active at checkout</small></td>' +
            '<td data-label="Price"><b>' + NT.kwacha(pkg.price) + '</b></td><td data-label="Includes"><span class="small muted">' + NT.esc(benefits) + '</span></td>' +
            '<td data-label="Videos"><span class="muted">—</span></td><td data-label="Action"><button class="btn btn-sm btn-ghost" data-discard-package="' + NT.esc(String(pkg.id)) + '">Discard draft</button></td></tr>';
        }).join("") +
        "</tbody></table></div>";
      root.querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () {
          var lv = b.dataset.edit;
          var m = NT.modal({
            title: "Edit " + D.LEVEL_LABEL[lv] + " package",
            body: '<div class="field"><label>Package name</label><input class="input" id="pName" value="' + NT.esc(NT.packageDetails(lv).name) + '"></div>' +
              '<div class="field"><label>Price (K)</label><input class="input" type="number" id="pPrice" value="' + NT.packagePrice(lv) + '"></div>' +
              '<div class="field"><label>Short description</label><input class="input" id="pTagline" value="' + NT.esc(NT.packageDetails(lv).tagline) + '"></div>' +
              '<div class="field"><label>Includes (one per line)</label><textarea class="input" id="pFeat" rows="4">' + NT.esc(NT.packageDetails(lv).features.join("\n")) + '</textarea></div>' +
              '<p class="field-hint">Package names, prices and benefits are saved in this browser and update pricing, checkout and access summaries. The demo keeps the three access tiers.</p>',
            footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="pSave">Save changes</button>'
          });
          m.querySelector("#pSave").addEventListener("click", function () {
            var v = parseInt(m.querySelector("#pPrice").value, 10);
            var name = m.querySelector("#pName").value.trim() || D.LEVEL_LABEL[lv];
            var tagline = m.querySelector("#pTagline").value.trim();
            var features = m.querySelector("#pFeat").value.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
            NT.store.mutate(function (st) {
              if (!isNaN(v) && v > 0) st.packages[lv] = v;
              st.packageDetails[lv] = { name: name, tagline: tagline, features: features };
            });
            m.close();
            NT.toast(name + " package updated", "success");
            render();
          });
        });
      });
      root.querySelectorAll("[data-discard-package]").forEach(function (button) {
        button.addEventListener("click", function () {
          var id = button.dataset.discardPackage;
          NT.store.mutate(function (st) {
            st.extraPackages = (st.extraPackages || []).filter(function (pkg) { return String(pkg.id) !== id; });
          });
          NT.toast("Package draft discarded", "success");
          render();
        });
      });
      root.querySelector("#createPkg").addEventListener("click", function () {
        var m = NT.modal({
          title: "New package draft",
          body: '<div class="input-row"><div class="field"><label for="nName">Package name</label><input class="input" id="nName" placeholder="e.g. Exam Booster" required></div>' +
            '<div class="field"><label for="nPrice">Price (K)</label><input class="input" type="number" id="nPrice" min="1" value="150"></div></div>' +
            '<div class="field"><label for="nFeat">Benefits</label><textarea class="input" id="nFeat" rows="3" placeholder="One benefit per line"></textarea></div>' +
            '<p class="field-hint">This saves an admin-only draft in this browser. It does not change checkout; Basic, Standard and Premium remain the three active access tiers.</p>',
          footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="nGo">Save draft</button>'
        });
        m.querySelector("#nGo").addEventListener("click", function () {
          var name = m.querySelector("#nName").value.trim();
          var price = parseInt(m.querySelector("#nPrice").value, 10);
          if (!name) {
            m.querySelector("#nName").focus();
            NT.toast("Enter a name for this package draft", "error");
            return;
          }
          if (isNaN(price) || price < 1) {
            m.querySelector("#nPrice").focus();
            NT.toast("Enter a valid package price", "error");
            return;
          }
          var features = m.querySelector("#nFeat").value.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
          NT.store.mutate(function (st) {
            st.extraPackages = Array.isArray(st.extraPackages) ? st.extraPackages : [];
            st.extraPackages.unshift({ id: "draft-package-" + Date.now(), name: name, price: price, features: features, created: new Date().toISOString() });
          });
          m.close();
          NT.toast(name + " package draft saved", "success");
          render();
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

  /* ---------------- announcements ---------------- */
  function pageAnnouncements(root) {
    function render() {
      var notices = (NT.store.get().announcements || []).slice().sort(function (a, b) {
        return new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0);
      });
      root.innerHTML =
        '<div class="adm-toolbar"><p class="muted small">Write a notice for students. Only published updates appear on the public Announcements page.</p><span class="spacer"></span><span class="badge badge-warn">Local demo content</span></div>' +
        '<section class="adm-card announcement-admin-compose"><div class="adm-card-head"><h3>New announcement</h3><span class="sub">Saved in this browser only</span></div>' +
        '<div class="adm-card-body"><form id="announcementForm" class="settings-form">' +
        '<div class="field"><label for="announcementTitle">Title</label><input class="input" id="announcementTitle" maxlength="120" placeholder="e.g. A course update" required></div>' +
        '<div class="field"><label for="announcementBody">Message</label><textarea class="input" id="announcementBody" rows="4" maxlength="1200" placeholder="Write a clear update for students" required></textarea></div>' +
        '<div class="input-row"><div class="field"><label for="announcementStatus">Status</label><select class="input" id="announcementStatus"><option value="draft">Save as draft</option><option value="published">Publish now</option></select></div>' +
        '<div class="field announcement-publish-note"><span class="announcement-field-label">Student visibility</span><span class="field-hint">Drafts stay in Admin. Published notices appear in Announcements and Search.</span></div></div>' +
        '<div><button class="btn btn-primary" type="submit">' + NT.icon("plus") + "Save announcement</button></div></form></div></section>" +
        '<div class="adm-card"><div class="adm-card-head"><div><h3>All announcements</h3><span class="sub">' + notices.length + " saved · published notices show to students</span></div></div>" +
        '<div class="adm-card-body"><div class="announcement-admin-list">' + (notices.length ? notices.map(function (notice) {
          var excerpt = String(notice.body || "");
          if (excerpt.length > 180) excerpt = excerpt.slice(0, 177) + "…";
          return '<article class="announcement-admin-item"><div><div class="announcement-admin-meta">' + statusBadge(notice.status || "draft") + "<span>" + NT.fmtDate(notice.updated || notice.created) + "</span></div>" +
            '<h3>' + NT.esc(notice.title) + '</h3><p>' + NT.esc(excerpt) + "</p></div>" +
            '<div class="announcement-admin-actions"><label class="sr-only" for="announcementStatus-' + NT.esc(String(notice.id)) + '">Status for ' + NT.esc(notice.title) + "</label>" +
            '<select class="input" id="announcementStatus-' + NT.esc(String(notice.id)) + '" data-ann-status="' + NT.esc(String(notice.id)) + '"><option value="draft"' + (notice.status === "published" ? "" : " selected") + '>Draft</option><option value="published"' + (notice.status === "published" ? " selected" : "") + '>Published</option></select>' +
            '<button class="btn btn-sm btn-secondary" type="button" data-ann-edit="' + NT.esc(String(notice.id)) + '" aria-label="Edit ' + NT.esc(notice.title) + '">' + NT.icon("pencil", "icon-sm") + "Edit</button>" +
            '<button class="btn btn-sm btn-danger-soft" type="button" data-ann-delete="' + NT.esc(String(notice.id)) + '" aria-label="Delete ' + NT.esc(notice.title) + '">' + NT.icon("trash", "icon-sm") + "Delete</button></div></article>";
        }).join("") : '<div class="announcement-admin-empty">No announcements have been created yet. Save a draft or publish an update for students.</div>') + "</div></div></div>";

      root.querySelector("#announcementForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var title = root.querySelector("#announcementTitle").value.trim();
        var body = root.querySelector("#announcementBody").value.trim();
        if (!title || !body) {
          NT.toast("Add both a title and a message", "error");
          return;
        }
        var status = root.querySelector("#announcementStatus").value;
        NT.store.addAnnouncement({ title: title, body: body, status: status, updated: new Date().toISOString() });
        NT.toast(status === "published" ? "Announcement published for students" : "Announcement saved as a draft", "success");
        render();
      });
      root.querySelectorAll("[data-ann-status]").forEach(function (select) {
        select.addEventListener("change", function () {
          NT.store.updateAnnouncement(select.dataset.annStatus, { status: select.value, updated: new Date().toISOString() });
          NT.toast(select.value === "published" ? "Announcement published" : "Announcement moved to drafts", "success");
          render();
        });
      });
      root.querySelectorAll("[data-ann-edit]").forEach(function (button) {
        button.addEventListener("click", function () {
          var id = button.dataset.annEdit;
          var notice = (NT.store.get().announcements || []).filter(function (item) { return String(item.id) === id; })[0];
          if (!notice) return;
          var isPublished = notice.status === "published";
          var modal = NT.modal({
            title: "Edit announcement",
            body: '<div class="settings-form"><div class="field"><label for="editAnnouncementTitle">Title</label><input class="input" id="editAnnouncementTitle" maxlength="120" value="' + NT.esc(notice.title) + '" required></div>' +
              '<div class="field"><label for="editAnnouncementBody">Message</label><textarea class="input" id="editAnnouncementBody" rows="5" maxlength="1200" required>' + NT.esc(notice.body) + '</textarea></div>' +
              '<div class="field"><label for="editAnnouncementStatus">Status</label><select class="input" id="editAnnouncementStatus"><option value="draft"' + (isPublished ? "" : " selected") + '>Draft</option><option value="published"' + (isPublished ? " selected" : "") + '>Published</option></select></div></div>',
            footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="saveAnnouncementEdit">Save changes</button>'
          });
          modal.querySelector("#saveAnnouncementEdit").addEventListener("click", function () {
            var title = modal.querySelector("#editAnnouncementTitle").value.trim();
            var body = modal.querySelector("#editAnnouncementBody").value.trim();
            if (!title || !body) {
              NT.toast("Add both a title and a message", "error");
              return;
            }
            var status = modal.querySelector("#editAnnouncementStatus").value;
            NT.store.updateAnnouncement(id, { title: title, body: body, status: status, updated: new Date().toISOString() });
            modal.close();
            NT.toast("Announcement updated", "success");
            render();
          });
        });
      });
      root.querySelectorAll("[data-ann-delete]").forEach(function (button) {
        button.addEventListener("click", function () {
          var id = button.dataset.annDelete;
          var modal = NT.modal({
            title: "Delete announcement?",
            body: "<p class=\"muted\">This removes the announcement from the local demo. This action cannot be undone.</p>",
            footer: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger-soft" id="deleteAnnouncement">Delete announcement</button>'
          });
          modal.querySelector("#deleteAnnouncement").addEventListener("click", function () {
            NT.store.removeAnnouncement(id);
            modal.close();
            NT.toast("Announcement deleted", "success");
            render();
          });
        });
      });
    }
    render();
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
      '<div class="adm-card-body"><p class="muted small" style="margin-bottom:14px">Reset returns the demo to its factory state: clears active access, progress, local profile details, announcements, generated codes, payments and admin edits.</p>' +
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

  var routes = { home: pageHome, videos: pageVideos, courses: pageCourses, announcements: pageAnnouncements, packages: pagePackages, codes: pageCodes, students: pageStudents, payments: pagePayments, settings: pageSettings };

  document.addEventListener("DOMContentLoaded", function () {
    var root = renderShell();
    var page = document.body.dataset.admin || "home";
    if (routes[page]) routes[page](root);
  });
})();
