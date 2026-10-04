# Nuclear Tutorials — Client Demo

A production-quality **interactive demo** of the Nuclear Tutorials paid video-learning
platform. No build step, no backend, no real payments: open `index.html` through any
static server (or double-click it) and the whole product concept is demonstrable
end-to-end.

> **Demo build.** All payments, mobile-money prompts, transaction references and
> access codes are simulated. No money moves and no real account is contacted.

---

## The concept in one line

**PAYMENT → ACCESS LEVEL → ACCESS CODE → UNLOCKED CONTENT**

| Package  | Price (demo) | Unlocks                                   |
|----------|--------------|-------------------------------------------|
| Basic    | K50          | Basic lessons in every course             |
| Standard | K100         | Basic + Standard lessons, progress tracking |
| Premium  | K200         | Everything — the full library             |

A student can watch a lesson when their package level is **at least** the lesson's
access level. Every one of the 40 demo lessons (5 courses × 8 lessons) carries a
Basic / Standard / Premium level.

## Academic catalogue

The public catalogue supports two education pathways:

- **High School** → Grade / Form / Level → Subject → Course → Lessons
- **University** → University → Programme / School → Course → Lessons

`assets/js/data.js` keeps education levels, school levels, subjects, universities,
programmes and course offerings as separate data collections. Current Mathematics,
Physics, Chemistry, Computer Science and Biology listings are sample/demo content;
their illustrative high-school and university offerings do not claim to represent a
specific institution's official syllabus. Course discovery can be filtered by level,
subject, grade, university and programme.

## Run it

```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```

## Demo walkthrough (student)

1. **Browse** — `index.html`, `courses.html`, `library.html` (filter course samples by High School or University; a visitor sees lesson access states).
2. **Pay** — `pricing.html` → *Get Access* → `checkout.html` (Airtel Money, MTN MoMo,
   Zamtel Money or Card — visual-only fields) → *Pay K… (demo)*.
3. **Code** — the receipt issues a code like `NT-STANDARD-4826`; it is also stored
   in the admin Access Codes list as *Redeemed*.
4. **Unlock** — or redeem a prepared code on `access.html`:
   `NT-BASIC-2026`, `NT-STANDARD-2026`, `NT-PREMIUM-2026`.
5. **Learn** — `dashboard.html` (course progress, recently watched, unlocked courses,
   locked content and package info) and `lesson.html` (internal player with progress,
   complete-state, prev/next and related lessons).
6. **Prove the model** — `control.html` lets the presenter click
   *View as Basic / Standard / Premium student* and watch the entire platform re-lock
   live. A floating banner ends the demo view.

## Demo walkthrough (admin)

`admin/index.html` — a separate console: Dashboard (1,284 students · 962 active ·
40 videos · K96,450 revenue, revenue-by-package, recent payments), Videos (change any
lesson's access level and see the student library react; simulated upload), Courses
(education-pathway metadata and course drafts), Access Packages (edit names, prices and
benefits live; save admin-only package drafts), Access Codes (generate codes), Students,
Payments, Settings. Basic, Standard and Premium remain the active checkout tiers.

## State

Everything persists in `localStorage` (`nt_demo_state_v1`) while navigating:
access level, completed/recent lessons, generated codes, payments, package edits and other admin changes.
Reset any time from **Admin → Settings → Reset demo data**.

## Brand

The client logo is used as-supplied from `assets/img/logo.jpg` (see
`assets/img/README.md`). Interface accents are derived from the logo's palette
(sky-cyan primary, magenta/amber tier accents) on a clean navy/slate base.

## Structure

```
index.html  courses.html  pricing.html  access.html  control.html
library.html  dashboard.html  lesson.html  checkout.html
admin/        index videos courses packages codes students payments settings
assets/css/   main.css (design system + public UI), admin.css (console shell)
assets/js/    icons.js data.js store.js ui.js app.js admin.js
assets/img/   logo.jpg (client artwork)
```

Icons are inline Lucide stroke SVGs (`assets/js/icons.js`) — no CDN, works offline.
