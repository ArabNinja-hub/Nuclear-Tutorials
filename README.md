# Nuclear Tutorials

A video-lesson platform for Zambian students: **University → Semester 1 or 2 → Course → Video lessons**, with a server-backed catalogue and a separate administrator area. Plain HTML, CSS and JavaScript on the front end; a zero-dependency Node.js server with a SQLite database behind it. No build step, no npm packages to install.

## Run it

Requires Node.js **22.5 or newer** (the built-in `node:sqlite` module is used, so there are no dependencies to install).

```bash
npm start          # node server/index.js  →  http://localhost:8000
```

The server serves the static site **and** the JSON API from the same origin, so no CORS or proxy setup is needed.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8000` | HTTP port |
| `NT_HOST` / `HOST` | `0.0.0.0` | Bind address |
| `NT_DATA_DIR` | `data/` | Folder for the database and first-run note |
| `NT_DB_FILE` | `data/content.sqlite` | Database file (gitignored) |

### First administrator account

The database starts **completely empty** — no fictional universities, courses or video lessons. On the very first start the server creates one administrator and prints the credentials to the console:

```
First-run administrator
  email:    admin@nucleartutorials.local
  password: <generated>
  sign in:  http://localhost:8000/admin/login.html
```

The same details are written to `data/first-run-admin.txt` (inside the gitignored data folder) so a restart never loses access. Sign in at `/admin/login.html`, then change the password under **Settings → Admin sign-in**. Changing the password signs out every other device.

Sessions use an HTTP-only cookie and scrypt-hashed passwords; administrator API routes reject unauthenticated requests, and `/admin/*` pages show a sign-in notice when there is no session.

## What lives where

**Server database (shared by every device):** universities, semesters, courses, video lessons (title, topic, description, URL, provider, embed URL, thumbnail, duration, access tier, order, published/draft), administrator accounts and sessions.

**This browser only (device-local preview state, as before):** access-code redemption and package tier, watched-lesson progress, recently viewed lessons, profile preferences (name, education level, subject, chosen university and semester), locally generated preview codes, package edits, lesson-tier overrides for the built-in outlines, announcements and preview settings.

Global catalogue content is never written to `localStorage`: when an administrator publishes a lesson, every student device sees it on the next page load.

## Video lessons only

The platform stores **video lesson links** — YouTube, Vimeo or a direct media file (`.mp4`, `.webm`). There is no PDF, document, notes or other material-upload system anywhere in the API or the interface: nothing is ever uploaded to this server, administrators paste a URL and the server analyses it once (provider, embed URL, automatic thumbnail).

Each video lesson also carries an access tier — **Basic**, **Standard** or **Premium** — which reuses the existing access-code and package system, so the current redemption flow keeps deciding what a student may watch.

## Student experience

- `index.html` — hero with the university → semester → course → video path, live catalogue counts, university preview, built-in course outlines and access steps.
- `universities.html` — every published university with per-semester course and video counts.
- `university.html?id=…` — university hero, the semester switcher (Semester 1 and Semester 2 are visually distinct), course search and course cards.
- `course.html?id=…` — course detail: context banner, description, video playlist and the package tier each lesson needs. Built-in outline courses keep their existing lesson lists.
- `video.html?id=…` — the watch page: player, full context (university · semester · course), description, previous/next navigation, "mark as watched" and the course playlist.
- `library.html` — two tabs: **Video lessons** (filter by university, semester, course, availability) and **Course outlines**.
- `search.html` — universities, courses, video lessons, lesson outlines and announcements, filtered by tab.
- `dashboard.html` — continue learning, recently viewed, watched progress for the chosen university and semester, and available courses. Only real data is shown; no invented statistics, testimonials or student numbers.
- `profile.html` — name, education level, subject, university and semester preferences.
- `pricing.html` → `checkout.html` → `access.html` — the unchanged package comparison, local preview-code generation and access-code redemption.

Typography is Manrope for headings and Inter for body copy and labels (loaded from Google Fonts with `preconnect` and `display=swap`, plus a system fallback stack so the site still renders offline). Icons are inline Lucide-style SVGs from `assets/js/icons.js`.

## Administrator area

`/admin/` — never linked from any student page.

- **Overview** — real counts (universities, courses per semester, published and draft video lessons, published runtime, lessons per tier) and a getting-started checklist that switches off as each step is completed.
- **Universities** — create, edit, reorder, publish/unpublish and delete; accent colour, short name, city, country and description.
- **Courses** — every course is placed in one university and one semester; filter by university, semester, visibility and search.
- **Video lessons** — the main screen. A context bar pins **University → Semester → Course** above the form at all times, so a lesson cannot be added to the wrong place. Add a lesson (title, topic, duration, URL, thumbnail, description, tier, visibility), check the source before saving, then reorder, edit, publish/unpublish, delete or preview it. A second table lists every video lesson with search, visibility and tier filters. Deep links such as `videos.html?university=…&semester=2&course=…` restore the context.
- **Lesson access**, **Announcements**, **Packages**, **Codes** — the existing browser-local preview controls, clearly labelled "This browser only".
- **Settings** — admin sign-in details, password change, sign-out, content-service health, and the browser-local preview settings.

## API

Public (published records only, with parent status cascading):

```
GET /api/health            GET /api/stats
GET /api/universities?q=   GET /api/universities/:id
GET /api/courses?university=&semester=&q=   GET /api/courses/:id
GET /api/videos?university=&semester=&course=&level=&q=   GET /api/videos/:id
GET /api/library?university=&semester=     GET /api/search?q=
```

Administrator (session cookie required):

```
POST /api/admin/login      POST /api/admin/logout     GET /api/admin/session
GET  /api/admin/overview   POST /api/admin/analyze-url   PUT /api/admin/password
GET|POST /api/admin/universities|courses|videos
PATCH|DELETE /api/admin/{universities|courses|videos}/:id
POST /api/admin/{universities|courses|videos}/:id/move   {"direction":"up"|"down"}
```

Validation errors return `400` with `{ "error": "validation", "message": "…", "fields": { … } }`, which the admin forms render inline. There is no upload endpoint.

## Checks

```bash
npm test         # check-platform + smoke-render + test-flows
npm run check    # structure, accessibility, CSS, icon and platform-policy checks
npm run smoke    # renders every public and admin route in a minimal DOM
npm run flows    # boots the real server on a temporary database and walks the flows
```

`npm run flows` covers the three journeys end to end: student **University → Semester 1 → Course → Video → Watch**, student **University → Semester 2 → Course → Video → Watch**, and administrator **Sign in → University → Semester → Course → Add video → Publish → student sees the video**, plus drafts staying hidden, reordering, cascade deletes, tier gating, rate limiting and password changes.

To add HTTP checks against a running server:

```bash
BASE=http://127.0.0.1:8000 npm run check
```

## Preview scope

Parts of this repository remain an honest local preview rather than a live commercial service:

- The access-code flow saves the selected education level and package locally in the current browser; codes generated in one browser are not available in another.
- Package prices are illustrative preview values. Checkout generates a local preview code; it does not contact a payment provider or process a payment.
- Codes, profile preferences, package edits, lesson access overrides, announcements, preview settings and watched progress stay in browser storage.
- The included course and lesson outlines are catalogue data, not an authoritative syllabus. Lesson video or other lesson materials are not hosted in this build — video lessons point at their own source (YouTube, Vimeo or a media file URL).

Do not treat preview prices, course coverage, or locally generated codes as live offers or production credentials.

## Project files

- `server/index.js` — HTTP entry point: static site, JSON API, security headers.
- `server/db.js` — `node:sqlite` schema and query helpers (`data/content.sqlite`).
- `server/api.js` — public and administrator routes, validation, serializers.
- `server/auth.js` — scrypt passwords, sessions, cookies, first-run account, rate limiting.
- `server/util.js` — video-URL analysis (provider, embed URL, thumbnail), durations, responses.
- `server/static.js` — static file serving, MIME types, caching and 404 page.
- `assets/js/api.js` — content-service client with a per-page-view cache.
- `assets/js/video.js` — video, course and university card markup, thumbnails and player.
- `assets/js/data.js` — built-in course outlines, subjects, levels and packages.
- `assets/js/store.js` — browser-local preview state, progress and legacy migration.
- `assets/js/ui.js` — navigation, footer, semester switcher, loading/empty/error states, dialogs and toasts.
- `assets/js/app.js` — public page rendering and the access flow.
- `assets/js/admin.js` — administrator shell, sign-in gate and content management.
- `assets/css/main.css`, `assets/css/admin.css` — public and administrator styles.
- `scripts/check-platform.js`, `scripts/smoke-render.js`, `scripts/test-flows.js` — repository checks.
