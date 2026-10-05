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

The production database **starts empty**. Nothing is preloaded: you add
universities, courses and video lessons yourself through the admin area. A
sample catalogue (MIT OpenCourseWare and Crash Course lectures) exists only for
local development and automated checks:

```bash
npm run seed:demo         # load the development sample (never in production)
npm run seed:status       # what is in the database right now
npm run seed:clear        # empty the catalogue again
```

No build step and no third-party dependencies: the server is plain Node.js
(`node:http` + `node:sqlite`, Node 22.5 or newer) and the front end is HTML, CSS
and vanilla JavaScript.

| Command | What it does |
| --- | --- |
| `npm start` | Starts the platform (static pages + JSON API) on `PORT` (default `8000`) |
| `npm run dev` | Same, with `node --watch` |
| `npm run seed:demo` | Loads the development sample catalogue (refused when `NODE_ENV=production`) |
| `npm run seed:clear` | Empties the catalogue (keeps codes, progress, announcements, settings) |
| `npm run seed:status` | Prints the database path, catalogue counts and content source |
| `npm run check` | Structural, accessibility and render checks (no server required) |
| `npm run check:flows` | Student and admin journeys against a running server |
| `npm run check:access` | Package access control: the Basic/Standard/Premium matrix and bypass attempts |
| `npm run test:setup` | First-run admin, empty database, restart persistence and expired codes |
| `BASE=http://127.0.0.1:8000 npm run check` | Adds HTTP, API and live-flow checks |
| `npm run check:production` | Everything above against a running server: structure, render, first-run/empty database, package access control and the live flows |

Environment (see `.env.example`): `PORT`, `HOST`, `NT_DATA_DIR`, `NT_DB_FILE`,
`NT_ADMIN_PASSWORD`, `NT_REQUIRE_PERSISTENT_STORAGE`, `NT_ALLOW_DEMO_SEED`.

The live checks sign in as the administrator, so start the server with
`NT_ADMIN_PASSWORD` set (a first-run password is rotated by the check itself).

### Administrator sign-in

Open `/admin/login.html`.

- Set `NT_ADMIN_PASSWORD` before the first start, or read the strong password the
  server generates and prints **once** in its log. The password shipped in early
  builds is never created by this version and is refused if an old database
  still carries it.
- **The first-run password must be changed.** Until it is, a signed-in
  administrator can only reach the session probe and the password change: every
  other `/api/admin/*` route answers `403`, so a temporary password is never a
  production credential.
- Administration pages are marked `noindex`, never appear in the student
  navigation, and every `/api/admin/*` route answers `401` without a valid
  session cookie. Students signed in with an access code are refused too.

Never treat a first-run or sample password as a production credential, and never
commit `.env` or `NT_ADMIN_PASSWORD` to the repository.

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

Packages are **Basic**, **Standard** and **Premium**: basic covers basic lessons,
standard adds standard lessons, premium covers everything. Package names, prices,
features and the access period are editable under **Admin → Packages**.

Lesson access is enforced by the server, not by the browser. The catalogue,
lesson, list and search responses only contain a video URL when the caller's
access code (sent as `X-NT-Code`) covers that lesson's tier; everything else
comes back as `locked: true` with `sourceUrl: null`, and asking for a protected
lesson by ID returns `403`. Editing the front-end JavaScript or localStorage,
calling the API by hand, requesting a protected lesson directly, or scraping the
catalogue all fail — see `npm run check:access`, which tests the full package
matrix and each of those bypass attempts.

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

Data flows in one direction only:

```
Admin  →  Server API  →  SQLite database  →  Student API request  →  Student sees it
```

- **Server database**: universities, courses, video lessons, access codes,
  progress, announcements, settings and the administrator password hash. This is
  the single source of truth.
- **localStorage** (per device): the student's access grant (`code`, package,
  expiry), learning preferences (name, level, university, semester) and a mirror
  of public settings. Catalogue content is never cached there — each page loads
  it from the API and keeps it in memory for that page view. Editing this
  storage cannot unlock anything: the server re-reads the code from the database
  on every request and drops a local grant it no longer recognises.

### Persistent storage in production

The SQLite file must sit on a persistent disk, or it is erased on every deploy:

1. Create a disk in your host (Render: **Disks** → mount path `/var/data`).
2. Set `NT_DATA_DIR` to that mount path (`render.yaml` already does this).
3. Keep `NT_REQUIRE_PERSISTENT_STORAGE=1` so the server refuses to boot if the
   database would fall back inside the deploy directory.

With that in place the catalogue, access codes and student progress survive
application restarts, redeploys and new releases. Without it, `npm start` still
works locally but the data lives in `server/data/` and is disposable.

## Honest limitations

- Lessons stream or open from their original public source (for example MIT
  OpenCourseWare under CC BY-NC-SA, and Crash Course). The platform does not
  re-host video files, and lesson playback depends on that source being online.
- Checkout issues an access code directly; it **does not process a payment** and
  contacts no payment provider. Prices are set by the platform team.
- Access codes are a simple redemption system with no password accounts. The
  server withholds protected URLs from unauthorised clients, but a student who is
  legitimately allowed to watch a lesson can still share that link onward — there
  is no DRM.
- The platform is **video lessons only**: there are **no document or material
  uploads** (no PDFs, notes or file sharing) and no quiz or certificate system.
- Thumbnails are fetched from the video source; when an image cannot load, the
  card falls back to a designed placeholder instead of a broken image.
- Sample content in `server/seed/content.json` is development data. It is never
  loaded automatically and `npm run seed:demo` refuses to run when
  `NODE_ENV=production` (override only for a deliberate staging check with
  `NT_ALLOW_DEMO_SEED=1`).
