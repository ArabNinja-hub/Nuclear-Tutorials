# Nuclear Tutorials

A video learning platform for university and secondary students. Every lesson is
organised as **University → Semester 1 or 2 → Course → Video lesson**, and the
student always sees which university, semester and course they are inside.

The catalogue lives in a server database, so an administrator can add, edit,
reorder and publish video lessons without touching any source code — and every
student sees the change on their own device.

## Run it

```bash
npm start                 # http://localhost:8000
```

No build step and no third-party dependencies: the server is plain Node.js
(`node:http` + `node:sqlite`, Node 22.5 or newer) and the front end is HTML, CSS
and vanilla JavaScript.

| Command | What it does |
| --- | --- |
| `npm start` | Starts the platform (static pages + JSON API) on `PORT` (default `8000`) |
| `npm run dev` | Same, with `node --watch` |
| `npm run seed` | Replaces the catalogue with the shipped seed content |
| `npm run check` | Structural, accessibility and render checks (no server required) |
| `npm run check:flows` | Student and admin journeys against a running server |
| `BASE=http://127.0.0.1:8000 npm run check` | Adds HTTP, API and live-flow checks |

Environment: `PORT`, `HOST`, `NT_DATA_DIR`, `NT_DB_FILE`, `NT_SEED=off`,
`NT_ADMIN_PASSWORD` (used only on the very first run).

### Administrator sign-in

Open `/admin/login.html`. On a fresh install the first password is printed in the
server log and defaults to `nuclear-admin`; change it immediately in **Admin →
Settings → Administrator password**. Administration pages are marked `noindex`,
never appear in the student navigation, and every `/api/admin/*` route answers
`401` without a valid session cookie.

## What students do

1. **Browse** — `index.html` shows the institutions, Semester 1 and Semester 2
   course lists, and real catalogue totals. `courses.html` filters by study
   level, university, semester and search term.
2. **Open a course** — `course.html` lists that course's video lessons in
   teaching order, with the university, semester and course code in the header
   and progress for the signed-in student.
3. **Watch a lesson** — `lesson.html` plays the lesson in the page (YouTube and
   Vimeo embeds, direct MP4/WebM files, otherwise a link to the original
   source), shows topic, description, duration, provider and "up next", and
   records progress.
4. **Log in with an access code** — `access.html` asks for High School or
   University plus the code issued with a package. Redemption is validated by the
   server, a code works once, and progress is stored against that code, so a
   student can continue on another device.
5. **Dashboard** — `dashboard.html` shows only real data: continue learning or
   last watched lesson, recently viewed lessons, the courses of the current
   university and semester, and lesson counts.

Packages are **Basic**, **Standard** and **Premium**; a package unlocks the
lessons at its level and below. Package names, prices, features and the access
period are editable under **Admin → Packages**.

## What administrators do

| Page | Purpose |
| --- | --- |
| `admin/index.html` | Overview: real totals, semester coverage, recently added lessons |
| `admin/courses.html` | Universities/schools and courses: create, edit, delete, pick semester 1 or 2 |
| `admin/lessons.html` | Video lessons: filter by university → semester → course, add, edit, reorder, publish/unpublish, delete |
| `admin/codes.html` | Issue access codes per package and see redemption status |
| `admin/announcements.html` | Publish, unpublish and edit announcements |
| `admin/packages.html` | Package names, prices, taglines, feature lists and the access period |
| `admin/settings.html` | Support email, access period, administrator password |

Adding a lesson only needs the university, semester and course selection (shown
at the top of every form), a title, a video URL and optionally a topic,
description, thumbnail, duration and package level. The server detects the
provider and thumbnail from the URL, and the lesson appears for students as soon
as it is published.

## Where data lives

- **Server database** (`server/data/`, git-ignored): universities, courses,
  video lessons, access codes, progress, announcements, settings and the
  administrator password hash. This is the single source of truth.
- **localStorage** (per device): the student's access grant (`code`, package,
  expiry), learning preferences (name, level, university, semester) and a mirror
  of public settings. Catalogue content is never cached there — each page loads
  it from the API and keeps it in memory for that page view.

## Honest limitations

- Lessons stream or open from their original public source (for example MIT
  OpenCourseWare under CC BY-NC-SA, and Crash Course). The platform does not
  re-host video files, and lesson playback depends on that source being online.
- Checkout issues an access code directly; it **does not process a payment** and
  contacts no payment provider. Prices are set by the platform team.
- Access codes are a simple redemption system with no password accounts, and
  video URLs are not DRM-protected.
- The platform is **video lessons only**: there are **no document or material
  uploads** (no PDFs, notes or file sharing) and no quiz or certificate system.
- Thumbnails are fetched from the video source; when an image cannot load, the
  card falls back to a designed placeholder instead of a broken image.
