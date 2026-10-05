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
Physics, Chemistry, Computer Science and Biology listings are sample/demo content,
not claims about official syllabuses. High-school pathways are illustrative; the demo
currently lists no university affiliations or programmes, so university pathways are
explicitly marked as unspecified. Course discovery can be filtered by level, subject,
grade, university and programme when those catalogue details are available.

The Resources page currently surfaces tutorial videos only; notes, study materials,
revision materials and past papers are labelled unavailable rather than implied to
exist. Search covers the current catalogue and published local-demo announcements.
The Profile page stores optional study preferences in this browser, not in an account.

## Run it

```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```

All page and asset links are relative, so the static site also works from a GitHub Pages
project subpath such as `/Nuclear-Tutorials/`.

```bash
# smoke, flow, journey, admin, accessibility and CSS checks
python3 -m http.server 8000
BASE=http://127.0.0.1:8000 node scripts/check-platform.js

# headless render smoke: executes every public + admin route and fails on
# thrown errors or "undefined"/"NaN" leaking into rendered markup
node scripts/smoke-render.js
```

## Demo walkthrough (student)

1. **Discover** — `index.html` and `courses.html` (choose a learning path, browse the sample catalogue); `library.html` shows every lesson and its access state.
2. **Personalise** — `profile.html` saves optional study preferences locally; it does not create an account.
3. **Pay** — `pricing.html` → *Get Access* → `checkout.html` (Airtel Money, MTN MoMo,
   Zamtel Money or Card — visual-only fields) → *Pay K… (demo)*.
4. **Code** — the receipt issues a code like `NT-STANDARD-4826`; it is also stored
   in the admin Access Codes list as *Redeemed*.
5. **Unlock** — or redeem a prepared code on `access.html`:
   `NT-BASIC-2026`, `NT-STANDARD-2026`, `NT-PREMIUM-2026`.
6. **Learn** — `dashboard.html` (continue learning, recently accessed, progress and My
   courses) and `lesson.html` (internal player with course progress, complete-state,
   course contents and prev/next).
7. **Prove the model** — `control.html` lets the presenter click
   *View as Basic / Standard / Premium student* and watch the entire platform re-lock
   live. A floating banner ends the demo view.

## Demo walkthrough (admin)

`admin/index.html` — a separate console: simulated Dashboard figures, Videos (change any
lesson's access level and see the student library react; simulated upload), Courses
(education-pathway metadata and course drafts), Announcements (create, edit, publish,
unpublish and delete local student-facing notices), Access Packages (edit names, prices
and benefits live; save admin-only package drafts), Access Codes (generate codes),
Students, Payments and Settings. Basic, Standard and Premium remain the active checkout
tiers. Dashboard figures and all payment/code flows are demonstrations, not production
records or transactions.

## State

Everything persists in `localStorage` (`nt_demo_state_v1`) while navigating:
access level, completed/recent lessons, local learning profile, announcements, generated
codes, payments, package edits and other admin changes. Profile details and notices are
local to this browser; there is no account or backend. Reset any time from **Admin →
Settings → Reset demo data**.

## Brand

The client logo is used as-supplied from `assets/img/logo.jpg` (see
`assets/img/README.md`). Interface accents are derived from the logo's palette
(sky-cyan primary, magenta/amber tier accents) on a clean navy/slate base.

## Interface layer

The public UI is one design system (`assets/css/main.css`) plus one admin shell
(`assets/css/admin.css`). The information architecture stays lean — fewer boxes, no
duplicate sections — while colour, type, depth and restrained motion give the
platform a Nuclear Tutorials identity rather than a blank document look.

- **Public navigation is three destinations.** Courses, Pricing and How it works are the
  only marketing links in the header. Login (the access-code page) and Get Access sit
  apart as account actions, and the dashboard appears there only once a student has
  access. Resources, Announcements, Search, the Library, the profile and the demo tools
  live in the overflow sheet and the footer, so learning functions never read as
  marketing navigation.
- **One idea per section.** The home page is hero → *Choose your learning path* →
  *Popular courses* → *How it works* → *Access packages*. No statistics strip, no
  duplicate "why us" block, no second call-to-action band repeating the first.
- **Courses is the discovery surface.** A pathway selector (All / High School /
  University) plus one search field, then a clean card grid. Each card carries only the
  course visual, name, pathway, short description, lesson count and one CTA.
- **Every course is its own page (`course.html?id=…`).** An identity band with the
  lesson count, runtime and the next action; *what you'll learn* as the three honest
  tier outcomes; the full lesson list with live access/completion states; and an
  access-requirement strip showing exactly which lessons Basic, Standard and Premium
  open in that course. Discovery → course → lessons → learning, in that order.
- **The library shows states, not decoration.** Lessons are grouped by course as plain
  rows: completed, available ("Watch" / "Review") or the package a locked lesson needs.
  A single summary line states how many of the 40 lessons the current access includes.
- **The lesson page is the player.** Under it: lesson title, course, lesson number,
  duration, level, course progress, Previous / Next and Mark as complete, with the
  course contents beside it for "what can I watch next".
- **The dashboard is a workspace.** Continue learning, recently accessed, package
  progress and My courses — no announcements or marketing panels.
- **Access stays obvious.** Basic unlocks 15 of 40 lessons, Standard 30 and Premium all
  40; pricing cards and the comparison table state that difference directly.
- **Shared wording** — `NT.pathwayLabel`, `NT.coursePathwayNames` and `NT.pathwayCounts`
  in `assets/js/ui.js` are the single source of pathway wording for both the public site
  and the admin console, so the two cannot drift apart.
- **Restrained motion.** Sections and cards opt into a single fade-and-rise entrance
  (`.reveal`, bound by `NT.initReveal()`); hover states lift by a few pixels; the hero
  preview floats on its orbit. Everything collapses to nothing under
  `prefers-reduced-motion`.
- **Mobile is designed, not shrunk.** The sticky mobile header always keeps the logo and
  wordmark visible and vertically centred, with the access action and menu control
  beside it (the wordmark compacts, never disappears, at 320px). A four-tab bottom bar
  carries Courses / Pricing / Dashboard-or-Login / More, and the overflow sheet holds
  the rest. Touch targets are 40px+ and no page scrolls horizontally at 320px.

## Design reference

The Mighty Axon Tutorials (themightyaxontutorials.com) was studied as a *quality*
reference for how a serious tutoring platform presents itself — specificity over
slogans, real catalogue content on marketing surfaces, ordinal wayfinding, factual
trust signals, mobile-first intent — and then reinterpreted in Nuclear Tutorials' own
language: navy reactor surfaces, the teal/magenta/amber orbit spectrum from the client
mark, monospace lesson indices and codes, and orbit-ring ornaments. No layout, copy,
colour or component is copied from the reference.

All flows (payment → access package → access code → unlocked content), routes, demo
data, demo codes and `localStorage` state are unchanged.

## Structure

```
index.html  courses.html  course.html  resources.html  search.html  announcements.html  profile.html
pricing.html  access.html  control.html  library.html  dashboard.html  lesson.html  checkout.html
admin/        index videos courses announcements packages codes students payments settings
assets/css/   main.css (design system + public UI), admin.css (console shell)
assets/js/    icons.js data.js store.js ui.js (shared UI + pathway helpers)
              app.js (public routing) admin.js (console routing)
assets/img/   logo.jpg (client artwork)
scripts/      check-platform.js (smoke, flow, journey, admin, accessibility, CSS)
              smoke-render.js (headless render smoke for every route)
```

Icons are inline Lucide stroke SVGs (`assets/js/icons.js`) — no CDN, works offline.
