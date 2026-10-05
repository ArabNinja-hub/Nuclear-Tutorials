# Nuclear Tutorials

A responsive website for browsing course outlines, lesson titles, education-level views, and package access tiers. It ships as plain HTML/CSS/JS with an optional zero-dependency Node backend for centralized admin persistence.

## Run with the backend (recommended)

The Node server serves static files and persists admin edits centrally so that any change made in `admin/` immediately appears on all student devices.

```bash
node server.js
```

Then open <http://localhost:8765>. Environment variables:

- `PORT` – port to listen on (default `8765`).
- `ADMIN_PASSWORD` – admin console password (default `admin`).
- `DATA_FILE` – JSON file used for persistence (default `data/db.json`).

To sign into the admin console, open <http://localhost:8765/admin/> and enter the admin password.

## Run statically (offline / preview)

If the `api/` endpoints are unreachable (for example, when serving through `python3 -m http.server` or opening files directly), the site transparently falls back to `localStorage` so the preview still works end-to-end. Codes generated in offline mode are local to that browser only.

```bash
python3 -m http.server 8000
```

## Persistence model

- **Centrally persisted (server-side) when backend is running:**
  - Access codes (generation, status, redemption tracking)
  - Announcements (drafts + published)
  - Package names, prices, and feature descriptions
  - Lesson access tiers (lessonLevels overrides)
  - Platform settings (support email, access period in days)
- **Per-device (localStorage only, never synced):**
  - The currently redeemed package on that device
  - Student profile (name, education level, subject)
  - Admin session token (used only to authenticate API requests from that browser)

Codes are **never exposed to unauthenticated visitors** through the public API, so they cannot leak between browsers via storage. Redemption is server-authoritative: each code can only be redeemed once, and a code not present in the backend is rejected regardless of what another browser has in localStorage.

## Education-level access flow

On `access.html`, choose **High School** or **University**, enter an access code, then continue. A successful code redemption stores the chosen level in `profile.educationLevel` and opens the corresponding filtered course view. The same preference can be edited later on `profile.html`.

## Checks

```bash
node scripts/check-platform.js
node scripts/smoke-render.js
```

To include HTTP checks, start the server and provide its URL:

```bash
BASE=http://127.0.0.1:8765 node scripts/check-platform.js
```

## Main pages

- `index.html` — concise introduction and course preview.
- `courses.html` — education-level filter and course catalogue.
- `course.html?id=…` — course outline, lesson list, and package access breakdown.
- `pricing.html` → `checkout.html` — package comparison and access code generation.
- `access.html` — education-level choice and access-code redemption.
- `dashboard.html`, `library.html`, `lesson.html`, `profile.html` — student learning view and preferences.
- `search.html`, `announcements.html` — catalogue search and announcements.
- `admin/` — authenticated administration console for courses, lesson access, packages, codes, announcements, and settings.

## Project files

- `server.js` – zero-dependency Node HTTP server (static files + `/api/*`, persists to `data/db.json`).
- `assets/js/data.js` — course, lesson, pathway, and package catalogue.
- `assets/js/store.js` — hybrid state store (API-first with localStorage fallback).
- `assets/js/ui.js` — shared navigation, footer, accessibility helpers, and dialog/toast UI.
- `assets/js/app.js` — public page rendering and access flow.
- `assets/js/admin.js` — admin console (login, shell, CRUD pages).
- `assets/css/main.css`, `assets/css/admin.css` — public and admin styles.
- `scripts/check-platform.js`, `scripts/smoke-render.js` — repository checks.
