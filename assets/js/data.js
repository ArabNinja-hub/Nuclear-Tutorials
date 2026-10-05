/* ============================================================
   NUCLEAR TUTORIALS — Demo data
   All figures are simulated for the client demonstration.
   ============================================================ */
(function () {
  window.NT = window.NT || {};

  var LEVELS = ["basic", "standard", "premium"];
  var LEVEL_RANK = { basic: 1, standard: 2, premium: 3 };
  var LEVEL_LABEL = { basic: "Basic", standard: "Standard", premium: "Premium" };

  /* Academic catalogue schema. Course records reference these stable IDs so the
     demo can grow from sample subjects into a much larger academic catalogue. */
  var EDUCATION_LEVELS = [
    {
      id: "high-school", label: "High School",
      hierarchy: ["Grade / Form / Level", "Subject", "Course", "Lessons"],
      description: "Syllabus-focused learning organised around school grade and subject."
    },
    {
      id: "university", label: "University",
      hierarchy: ["University", "Programme / School", "Course", "Lessons"],
      description: "Coursework organised by institution, programme and school."
    }
  ];
  var HIGH_SCHOOL_LEVELS = [
    { id: "senior-secondary", label: "Senior Secondary", detail: "Grades 10–12" }
  ];
  var SUBJECTS = [
    { id: "math", title: "Mathematics", icon: "sigma" },
    { id: "phys", title: "Physics", icon: "atom" },
    { id: "chem", title: "Chemistry", icon: "flask" },
    { id: "cs", title: "Computer Science", icon: "cpu" },
    { id: "bio", title: "Biology", icon: "leaf" }
  ];
  /* Institution and programme names are intentionally empty in the demo. The
     catalogue schema supports them, but no university affiliation is implied. */
  var UNIVERSITIES = [];
  var PROGRAMMES = [];
  var RESOURCE_TYPES = [
    { id: "tutorial-video", label: "Tutorial videos", available: true, description: "Video lessons in the current sample catalogue." },
    { id: "notes", label: "Study notes", available: false, description: "Study notes are not included in this demo." },
    { id: "study-materials", label: "Study materials", available: false, description: "Additional study materials are not included in this demo." },
    { id: "revision-materials", label: "Revision materials", available: false, description: "Revision materials are not included in this demo." },
    { id: "past-papers", label: "Past papers", available: false, description: "Past papers are not included in this demo." },
    { id: "other", label: "Other academic resources", available: false, description: "Other academic resources are not included in this demo." }
  ];

  var PACKAGES = {
    basic: {
      id: "basic", name: "Basic", price: 50,
      tagline: "Start learning the foundations of every course.",
      features: [
        "Selected tutorial videos",
        "Basic lessons in every course",
        "Access code on payment",
        "30 days of access"
      ]
    },
    standard: {
      id: "standard", name: "Standard", price: 100, popular: true,
      tagline: "The complete core curriculum with progress tracking.",
      features: [
        "Everything in Basic",
        "Standard lessons in every course",
        "Progress tracking"
      ]
    },
    premium: {
      id: "premium", name: "Premium", price: 200,
      tagline: "Every lesson, every course — the full library.",
      features: [
        "Everything in Standard",
        "Premium advanced lessons",
        "Full library",
        "New videos included"
      ]
    }
  };

  /* Lesson level pattern per course: 3 basic, 3 standard, 2 premium */
  var PATTERN = ["basic", "basic", "basic", "standard", "standard", "standard", "premium", "premium"];

  var COURSES = [
    {
      id: "math", title: "Mathematics", icon: "sigma",
      tint: "#e8f4f9", tintFg: "#0e7fa2",
      thumb: "linear-gradient(135deg,#0f4c66 0%,#0c2334 100%)",
      desc: "From number systems to calculus — build the mathematical foundation every exam requires.",
      lessons: [
        ["Number Systems", "12:40"],
        ["Algebra Essentials", "16:05"],
        ["Functions and Graphs", "18:22"],
        ["Limits", "14:48"],
        ["Differentiation", "21:10"],
        ["Integration", "22:35"],
        ["Series and Sequences", "17:52"],
        ["Probability and Statistics", "19:26"]
      ]
    },
    {
      id: "phys", title: "Physics", icon: "atom",
      tint: "#eef2f6", tintFg: "#40566d",
      thumb: "linear-gradient(135deg,#274b63 0%,#101c2a 100%)",
      desc: "Motion, forces, energy and fields — explained visually with fully worked problems.",
      lessons: [
        ["Units and Measurement", "11:15"],
        ["Motion in a Line", "15:40"],
        ["Forces and Newton Laws", "18:08"],
        ["Work and Energy", "16:55"],
        ["Waves", "20:12"],
        ["Electric Circuits", "19:44"],
        ["Magnetism", "18:30"],
        ["Intro to Nuclear Physics", "23:05"]
      ]
    },
    {
      id: "chem", title: "Chemistry", icon: "flask",
      tint: "#f9ecf4", tintFg: "#9c2b70",
      thumb: "linear-gradient(135deg,#5c2a4d 0%,#1d1220 100%)",
      desc: "Atomic structure to reaction kinetics, with clear models and guided practice.",
      lessons: [
        ["Atomic Structure", "13:25"],
        ["The Periodic Table", "14:50"],
        ["Chemical Bonding", "17:36"],
        ["The Mole Concept", "16:18"],
        ["Acids and Bases", "15:42"],
        ["Redox Reactions", "18:57"],
        ["Organic Basics", "20:44"],
        ["Reaction Kinetics", "19:08"]
      ]
    },
    {
      id: "cs", title: "Computer Science", icon: "cpu",
      tint: "#e7f4ec", tintFg: "#177245",
      thumb: "linear-gradient(135deg,#14532d 0%,#0b1f14 100%)",
      desc: "How computers think: programming fundamentals, data structures and the web.",
      lessons: [
        ["How Computers Work", "12:05"],
        ["Intro to Programming", "16:40"],
        ["Variables and Logic", "14:22"],
        ["Loops and Functions", "18:15"],
        ["Data Structures", "21:48"],
        ["Algorithms", "22:10"],
        ["Databases", "17:33"],
        ["Networks and the Web", "19:51"]
      ]
    },
    {
      id: "bio", title: "Biology", icon: "leaf",
      tint: "#fbf3e2", tintFg: "#96660f",
      thumb: "linear-gradient(135deg,#713f12 0%,#221507 100%)",
      desc: "From the cell to evolution: the living world, structured for efficient revision.",
      lessons: [
        ["The Cell", "13:10"],
        ["Cell Division", "15:28"],
        ["Genetics Basics", "17:05"],
        ["Inheritance", "16:47"],
        ["Human Digestion", "14:33"],
        ["Circulation", "15:59"],
        ["Nervous System", "18:41"],
        ["Evolution", "20:27"]
      ]
    }
  ];

  /* Each course is a subject record with one or more academic offerings. The
     included offerings are clearly marked as sample content; new grades,
     universities and programmes can be added without changing lesson logic. */
  COURSES.forEach(function (course) {
    course.subjectId = course.id;
    course.offerings = [
      {
        educationLevel: "high-school",
        levelId: "senior-secondary",
        label: "Senior Secondary · Grades 10–12"
      },
      {
        educationLevel: "university",
        universityId: null,
        programmeId: null,
        sample: true,
        label: "University · institution and programme details not listed"
      }
    ];
  });

  var LEVEL_BLURB = {
    basic: "A clear, from-scratch introduction with worked examples you can follow step by step.",
    standard: "Core syllabus coverage with exam-style questions and full solutions.",
    premium: "Advanced treatment with harder problems, proofs and extension material."
  };
  NT.LEVEL_BLURB = LEVEL_BLURB;

  /* Build the lesson catalogue */
  var LESSONS = [];
  COURSES.forEach(function (c) {
    c.lessons.forEach(function (l, i) {
      var level = PATTERN[i];
      LESSONS.push({
        id: c.id + "-" + (i + 1),
        courseId: c.id,
        courseTitle: c.title,
        index: i + 1,
        title: l[0],
        duration: l[1],
        level: level,
        status: "published",
        description: c.title + " · " + l[0] + ". " + LEVEL_BLURB[level] + " Presented on the Nuclear Tutorials digital whiteboard with past-paper style examples."
      });
    });
  });

  /* ---------- Seed admin records (simulated) ---------- */
  var SEED_PAYMENTS = [
    { ref: "NTX-2026-09184", student: "Chanda Mwale", pkg: "standard", method: "MTN Mobile Money", amount: 100, date: "2026-10-02", seeded: true },
    { ref: "NTX-2026-09151", student: "Bwalya Phiri", pkg: "premium", method: "Airtel Money", amount: 200, date: "2026-10-01", seeded: true },
    { ref: "NTX-2026-09087", student: "Mutale Banda", pkg: "basic", method: "Airtel Money", amount: 50, date: "2026-09-30", seeded: true },
    { ref: "NTX-2026-08976", student: "Kunda Zulu", pkg: "standard", method: "Card", amount: 100, date: "2026-09-28", seeded: true },
    { ref: "NTX-2026-08902", student: "Thandiwe Ngoma", pkg: "premium", method: "Zamtel Money", amount: 200, date: "2026-09-27", seeded: true },
    { ref: "NTX-2026-08841", student: "Mwansa Kalaba", pkg: "basic", method: "MTN Mobile Money", amount: 50, date: "2026-09-25", seeded: true }
  ];

  var SEED_STUDENTS = [
    { name: "Chanda Mwale", pkg: "standard", joined: "2026-08-14", status: "Active", seeded: true },
    { name: "Bwalya Phiri", pkg: "premium", joined: "2026-07-02", status: "Active", seeded: true },
    { name: "Mutale Banda", pkg: "basic", joined: "2026-09-30", status: "Active", seeded: true },
    { name: "Kunda Zulu", pkg: "standard", joined: "2026-06-21", status: "Active", seeded: true },
    { name: "Thandiwe Ngoma", pkg: "premium", joined: "2026-05-11", status: "Active", seeded: true },
    { name: "Mwansa Kalaba", pkg: "basic", joined: "2026-09-25", status: "Active", seeded: true },
    { name: "Joseph Sakala", pkg: "standard", joined: "2026-03-08", status: "Expired", seeded: true },
    { name: "Namakau Simataa", pkg: "premium", joined: "2026-08-19", status: "Active", seeded: true }
  ];

  var BASE_STATS = {
    students: 1284,
    activeAccess: 962,
    revenue: 96450,
    revenueByPackage: { basic: 18300, standard: 41200, premium: 36950 }
  };

  var METHODS = [
    { id: "airtel", name: "Airtel Money", hint: "Mobile wallet", icon: "smartphone" },
    { id: "mtn", name: "MTN Mobile Money", hint: "Mobile wallet", icon: "smartphone" },
    { id: "zamtel", name: "Zamtel Money", hint: "Mobile wallet", icon: "smartphone" },
    { id: "card", name: "Card", hint: "Visa / Mastercard", icon: "credit-card" }
  ];

  NT.data = {
    LEVELS: LEVELS,
    LEVEL_RANK: LEVEL_RANK,
    LEVEL_LABEL: LEVEL_LABEL,
    EDUCATION_LEVELS: EDUCATION_LEVELS,
    HIGH_SCHOOL_LEVELS: HIGH_SCHOOL_LEVELS,
    SUBJECTS: SUBJECTS,
    UNIVERSITIES: UNIVERSITIES,
    PROGRAMMES: PROGRAMMES,
    RESOURCE_TYPES: RESOURCE_TYPES,
    PACKAGES: PACKAGES,
    COURSES: COURSES,
    LESSONS: LESSONS,
    SEED_PAYMENTS: SEED_PAYMENTS,
    SEED_STUDENTS: SEED_STUDENTS,
    BASE_STATS: BASE_STATS,
    METHODS: METHODS,
    DEMO_CODES: ["NT-BASIC-2026", "NT-STANDARD-2026", "NT-PREMIUM-2026"]
  };

  /* ---------- Helpers ---------- */
  NT.educationLevel = function (id) {
    return EDUCATION_LEVELS.filter(function (x) { return x.id === id; })[0] || null;
  };
  NT.subject = function (id) {
    return SUBJECTS.filter(function (x) { return x.id === id; })[0] || null;
  };
  NT.university = function (id) {
    return UNIVERSITIES.filter(function (x) { return x.id === id; })[0] || null;
  };
  NT.programme = function (id) {
    return PROGRAMMES.filter(function (x) { return x.id === id; })[0] || null;
  };
  NT.coursePathways = function (course) {
    return (course && course.offerings) || [];
  };
  NT.coursePathway = function (course, levelId) {
    return NT.coursePathways(course).filter(function (x) { return x.educationLevel === levelId; })[0] || null;
  };
  NT.course = function (id) {
    return NT.data.COURSES.filter(function (c) { return c.id === id; })[0] || null;
  };
  NT.lesson = function (id) {
    return NT.allLessons().filter(function (l) { return l.id === id; })[0] || null;
  };
  /* Published lessons available on the public site (built-ins + uploads) */
  NT.allLessons = function () {
    var extra = (NT.store && NT.store.get().extraLessons) || [];
    return NT.data.LESSONS.concat(extra);
  };
  NT.courseLessons = function (courseId) {
    return NT.allLessons().filter(function (l) { return l.courseId === courseId; });
  };
  NT.levelOf = function (lesson) {
    var ov = NT.store.get().videoLevels[lesson.id];
    return ov || lesson.level;
  };
  NT.isUnlocked = function (lesson) {
    var a = NT.store.get().access;
    if (!a) return false;
    return NT.data.LEVEL_RANK[a] >= NT.data.LEVEL_RANK[NT.levelOf(lesson)];
  };
  NT.counts = function () {
    var all = NT.allLessons();
    var c = { total: all.length, basic: 0, standard: 0, premium: 0 };
    all.forEach(function (l) { c[NT.levelOf(l)]++; });
    return c;
  };
  NT.availableFor = function (level) {
    if (!level) return 0;
    var all = NT.allLessons();
    return all.filter(function (l) { return NT.data.LEVEL_RANK[level] >= NT.data.LEVEL_RANK[NT.levelOf(l)]; }).length;
  };
  NT.packagePrice = function (id) {
    var state = NT.store.get();
    return state.packages[id] != null ? state.packages[id] : NT.data.PACKAGES[id].price;
  };
  NT.packageDetails = function (id) {
    var base = NT.data.PACKAGES[id];
    if (!base) return null;
    var overrides = (NT.store.get().packageDetails || {})[id] || {};
    return Object.assign({}, base, overrides, {
      id: id,
      price: NT.packagePrice(id),
      features: Array.isArray(overrides.features) ? overrides.features : base.features.slice()
    });
  };
})();
