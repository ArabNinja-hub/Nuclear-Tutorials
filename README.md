# Nuclear Tutorials

A video learning platform for university and secondary students. Every lesson is
organised as **University → Semester 1 or 2 → Course → Video lesson**, and the
student always sees which university, semester and course they are inside.

The catalogue lives in a server database, so an administrator can add, edit,
reorder and publish video lessons without touching any source code — and every
student sees the change on their own device.

## Run it

```bash
npm start                 # http://localhost:8080
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
| `npm start` | Starts the platform (static pages + JSON API) on `PORT` (default `8080`, or whatever the host assigns) |
| `npm run dev` | Same, with `node --watch` |
| `npm run seed:demo` | Loads the development sample catalogue (refused when `NODE_ENV=production`) |
| `npm run seed:clear` | Empties the catalogue (keeps codes, progress, announcements, settings) |
| `npm run seed:status` | Prints the database path, catalogue counts and content source |
| `npm run check` | Structural, accessibility and render checks (no server required) |
| `npm run check:flows` | Student and admin journeys against a running server |
| `npm run check:access` | Package access control: the Basic/Standard/Premium matrix and bypass attempts |
| `npm run test:setup` | First-run admin, empty database, restart persistence and expired codes |
| `BASE=http://127.0.0.1:8080 npm run check` | Adds HTTP, API and live-flow checks |
| `npm run check:production` | The full production verification suite (7 stages, ~1000 assertions) against a running server — structure, render, empty first-run database and isolation, package access control, live pages/API/journeys. `BASE=https://your-app.up.railway.app` (or any deployment URL) to point it at a deployment |

Environment (see `.env.example`): `PORT`, `HOST`, `NT_DATA_DIR`, `NT_DB_FILE`,
`NT_ADMIN_PASSWORD`, `NT_REQUIRE_PERSISTENT_STORAGE`, `NT_SESSION_DAYS`,
`NT_COOKIE_SECURE`, `NT_ALLOWED_ORIGINS`.

The server always listens on `process.env.PORT` and binds `0.0.0.0`, so it
works behind the platform's HTTPS proxy. `HOST` can override the interface for
local work; a loopback-only bind on a deployed host is corrected with a warning,
because the platform's proxy could never reach it.

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

## Deploying

1. Set `NODE_ENV=production`, `NT_DATA_DIR` (the persistent disk mount, e.g.
   `/var/data`) and `NT_REQUIRE_PERSISTENT_STORAGE=1`; set `NT_ADMIN_PASSWORD`
   or read the generated first-run password from the service log.
2. Start the service. It comes up **empty**: no universities, courses, video
   lessons, codes or announcements — and no sample content can be created on a
   deployed host.
3. Sign in at `/admin/login.html`, change the first-run password (required
   before the admin API unlocks), then add the client's real catalogue.

Then run `npm run check:production` (with `BASE=https://your-app.up.railway.app`
or your Render URL) against the deployment to confirm the live behaviour before
handing it over.

Start-up never deletes, recreates or reseeds anything: an existing database is
opened, its schema is `CREATE TABLE IF NOT EXISTS` plus additive column
migrations, and the catalogue is left exactly as the administrator left it.

### Railway

`railway.json` pins the production contract: build with Nixpacks, start with
`npm start`, health-check `GET /health`, restart on failure, one replica
(one replica keeps the SQLite file to a single writer). `.nvmrc` pins Node 22,
which the server needs for `node:sqlite`.

`GET /health` is the liveness probe Railway waits for. It answers `200` with
`{"ok":true}` straight from the request handler — before the API router and
before any file is read — so it needs no SQLite, no administrator session, no
catalogue and no front-end file. Railway can only see it fail when the Node
process itself is gone, which stops a healthy container from being SIGTERMed
because a page or a slow volume made `GET /` look dead.

Manual setup on Railway:

1. **Volume** — add a volume to the service and mount it at `/var/data`. This
   is what makes the catalogue, access codes and student progress survive
   redeploys. The app picks the mount up automatically from Railway's
   `RAILWAY_VOLUME_MOUNT_PATH`; set `NT_DATA_DIR=/var/data` as well if you
   prefer it to be explicit. The database file is
   `/var/data/nuclear-tutorials.db`.
2. **Variables** — `NODE_ENV=production`, `NT_DATA_DIR=/var/data`,
   `NT_REQUIRE_PERSISTENT_STORAGE=1`, and either `NT_ADMIN_PASSWORD` (a strong
   value you choose) or nothing (read the generated first-run password once
   from the deploy log and change it in Admin → Settings).
3. **Networking** — Railway assigns `PORT` and terminates HTTPS in front of the
   container. The server binds `0.0.0.0`, trusts the forwarded protocol only
   for the `Secure` cookie flag, and keeps the admin cookie `HttpOnly` and
   `SameSite=Lax`. No CORS configuration is needed because the pages and the
   API share one origin; `NT_ALLOWED_ORIGINS` exists only for a future split
   front end and refuses `*`.

There are no uploaded files to worry about: the platform is video-only and
lessons are links to their original public source, so the volume holds the
database and nothing else. If a future feature stores media, it must write
under the same mount (`NT_DATA_DIR`), never inside the deploy directory.
`railway.json`, `render.yaml`, `.env.example`, `README.md`, `/scripts` and
`/server` are never served by a production deployment.

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

1. Create a disk in your host (Railway: add a volume mounted at `/var/data`;
   Render: **Disks** → mount path `/var/data`).
2. Set `NT_DATA_DIR` to that mount path (`railway.json`/`render.yaml` describe
   the same contract). On Railway the app also picks up
   `RAILWAY_VOLUME_MOUNT_PATH` automatically, so the database lands on the
   volume even when `NT_DATA_DIR` is not set.
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
  loaded automatically, and `npm run seed:demo` refuses to run when
  `NODE_ENV=production` or when the process is on a deployed host (Railway,
  Render, Heroku, Fly, Cloud Run, App Service, Vercel, Netlify). There is no
  override flag, so a production deployment can never load it — and a production
  database that somehow contains it logs a warning at start-up.
