/* ============================================================
   NUCLEAR TUTORIALS — Course catalogue and access package data
   ============================================================ */
(function () {
  window.NT = window.NT || {};

  var LEVELS = ["basic", "standard", "premium"];
  var LEVEL_RANK = { basic: 1, standard: 2, premium: 3 };
  var LEVEL_LABEL = { basic: "Basic", standard: "Standard", premium: "Premium" };

  var EDUCATION_LEVELS = [
    { id: "high-school", label: "High School" },
    { id: "university", label: "University" }
  ];
  var SUBJECTS = [
    { id: "math", title: "Mathematics", icon: "sigma" },
    { id: "phys", title: "Physics", icon: "atom" },
    { id: "chem", title: "Chemistry", icon: "flask" },
    { id: "cs", title: "Computer Science", icon: "cpu" },
    { id: "bio", title: "Biology", icon: "leaf" }
  ];
  var PACKAGES = {
    basic: {
      id: "basic", name: "Basic", price: 50,
      tagline: "Basic lessons across the course catalogue.",
      features: ["Basic lessons in every course"]
    },
    standard: {
      id: "standard", name: "Standard", price: 100,
      tagline: "Basic and Standard lessons across the course catalogue.",
      features: ["Basic and Standard lessons in every course"]
    },
    premium: {
      id: "premium", name: "Premium", price: 200,
      tagline: "All listed lessons across the course catalogue.",
      features: ["All lessons in every course"]
    }
  };

  /* Lesson level pattern per course: 3 basic, 3 standard, 2 premium */
  var PATTERN = ["basic", "basic", "basic", "standard", "standard", "standard", "premium", "premium"];

  var COURSES = [
    {
      id: "math", title: "Mathematics", icon: "sigma",
      tint: "#e8f4f9", tintFg: "#0e7fa2",
      desc: "Number systems, algebra, functions, calculus, sequences, probability and statistics.",
      lessons: [
        "Number Systems",
        "Algebra Essentials",
        "Functions and Graphs",
        "Limits",
        "Differentiation",
        "Integration",
        "Series and Sequences",
        "Probability and Statistics"
      ]
    },
    {
      id: "phys", title: "Physics", icon: "atom",
      tint: "#eef2f6", tintFg: "#40566d",
      desc: "Units, motion, forces, energy, waves, circuits, magnetism and nuclear physics.",
      lessons: [
        "Units and Measurement",
        "Motion in a Line",
        "Forces and Newton Laws",
        "Work and Energy",
        "Waves",
        "Electric Circuits",
        "Magnetism",
        "Intro to Nuclear Physics"
      ]
    },
    {
      id: "chem", title: "Chemistry", icon: "flask",
      tint: "#f9ecf4", tintFg: "#9c2b70",
      desc: "Atomic structure, the periodic table, bonding, the mole, acids and bases, redox, organic chemistry and kinetics.",
      lessons: [
        "Atomic Structure",
        "The Periodic Table",
        "Chemical Bonding",
        "The Mole Concept",
        "Acids and Bases",
        "Redox Reactions",
        "Organic Basics",
        "Reaction Kinetics"
      ]
    },
    {
      id: "cs", title: "Computer Science", icon: "cpu",
      tint: "#e7f4ec", tintFg: "#177245",
      desc: "Computer fundamentals, programming, logic, data structures, algorithms, databases and networks.",
      lessons: [
        "How Computers Work",
        "Intro to Programming",
        "Variables and Logic",
        "Loops and Functions",
        "Data Structures",
        "Algorithms",
        "Databases",
        "Networks and the Web"
      ]
    },
    {
      id: "bio", title: "Biology", icon: "leaf",
      tint: "#fbf3e2", tintFg: "#96660f",
      desc: "Cell biology, cell division, genetics, inheritance, human body systems and evolution.",
      lessons: [
        "The Cell",
        "Cell Division",
        "Genetics Basics",
        "Inheritance",
        "Human Digestion",
        "Circulation",
        "Nervous System",
        "Evolution"
      ]
    }
  ];

  /* Course pages are available in the two education-level views. */
  COURSES.forEach(function (course) {
    course.subjectId = course.id;
    course.offerings = EDUCATION_LEVELS.map(function (level) {
      return { educationLevel: level.id };
    });
  });

  /* Build lesson access tiers from the ordered catalogue entries. */
  var LESSONS = [];
  COURSES.forEach(function (course) {
    course.lessons.forEach(function (title, i) {
      LESSONS.push({
        id: course.id + "-" + (i + 1),
        courseId: course.id,
        courseTitle: course.title,
        index: i + 1,
        title: title,
        level: PATTERN[i],
        status: "published",
        description: course.title + " · " + title
      });
    });
  });

  NT.data = {
    LEVELS: LEVELS,
    LEVEL_RANK: LEVEL_RANK,
    LEVEL_LABEL: LEVEL_LABEL,
    EDUCATION_LEVELS: EDUCATION_LEVELS,
    SUBJECTS: SUBJECTS,
    PACKAGES: PACKAGES,
    COURSES: COURSES,
    LESSONS: LESSONS
  };

  /* ---------- Helpers ---------- */
  NT.educationLevel = function (id) {
    return EDUCATION_LEVELS.filter(function (x) { return x.id === id; })[0] || null;
  };
  NT.subject = function (id) {
    return SUBJECTS.filter(function (x) { return x.id === id; })[0] || null;
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
  NT.allLessons = function () {
    return NT.data.LESSONS;
  };
  NT.courseLessons = function (courseId) {
    return NT.allLessons().filter(function (l) { return l.courseId === courseId; });
  };
  NT.levelOf = function (lesson) {
    var ov = NT.store.get().lessonLevels[lesson.id];
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
