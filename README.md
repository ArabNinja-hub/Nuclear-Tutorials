# Nuclear Tutorials

A responsive static website preview for browsing course outlines, lesson titles, education-level views, and package access tiers. It is plain HTML, CSS, and JavaScript; no build step is required.

## Preview scope

This repository demonstrates the catalogue and access-code flow, not a live learning platform:

- The access-code flow saves the selected education level and package locally in the current browser.
- Package prices are illustrative preview values. Checkout generates a local preview code; it does not contact a payment provider or process a payment.
- Codes, profile preferences, package edits, lesson access overrides, announcements, and settings stay in browser storage. There is no account service, shared database, or admin sign-in.
- The included course and lesson entries are catalogue data, not an authoritative syllabus. Lesson video or other lesson materials are not hosted in this build.

Do not treat preview prices, course coverage, or locally generated codes as live offers or production credentials.

## Education-level access flow

On `access.html`, choose **High School** or **University**, enter an access code, then continue. A successful code redemption stores the chosen level in `profile.educationLevel` and opens the corresponding filtered course view. The same preference can be edited later on `profile.html`.

For a local walkthrough, open `pricing.html`, select a package, generate a preview code on `checkout.html`, and redeem it on `access.html`. A code generated in one browser is not available in another.

## Run locally

Serve the repository root with any static HTTP server. For example:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Relative paths also support deployment under a project subpath.

## Checks

```bash
node scripts/check-platform.js
node scripts/smoke-render.js
```

To include HTTP checks, start a static server and provide its URL:

```bash
BASE=http://127.0.0.1:8000 node scripts/check-platform.js
```

## Main pages

- `index.html` — concise introduction and course preview.
- `courses.html` — education-level filter and course catalogue.
- `course.html?id=…` — course outline, lesson list, and package access breakdown.
- `pricing.html` → `checkout.html` — preview package comparison and local code generation.
- `access.html` — education-level choice and access-code redemption.
- `dashboard.html`, `library.html`, `lesson.html`, `profile.html` — browser-local learning view and preferences.
- `search.html`, `announcements.html` — catalogue search and browser-local announcements.
- `admin/` — local preview settings for courses, lesson access, packages, codes, announcements, and resettable browser state. This is not a secured administration system.

## Project files

- `assets/js/data.js` — course, lesson, pathway, and package catalogue.
- `assets/js/store.js` — browser-local preview state and legacy-state migration.
- `assets/js/ui.js` — shared navigation, footer, accessibility helpers, and dialog/toast UI.
- `assets/js/app.js` — public page rendering and access flow.
- `assets/js/admin.js` — local preview settings.
- `assets/css/main.css`, `assets/css/admin.css` — public and admin-preview styles.
- `scripts/check-platform.js`, `scripts/smoke-render.js` — repository checks.
