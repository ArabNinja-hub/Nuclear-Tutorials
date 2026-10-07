#!/usr/bin/env node
/* ============================================================
   Static asset versioning (cache busting)

   The platform serves CSS and JavaScript with
   `Cache-Control: public, max-age=3600`, so a returning visitor can
   keep an old stylesheet or script for up to an hour after a
   deployment. Every page therefore asks for its local assets with a
   short content hash:

       assets/css/main.css?v=1f3c9a02

   The marker is derived from the bytes of the asset itself, so it
   changes exactly when the file changes and stays stable otherwise:
   a deployment that does not touch the asset keeps the same URL and
   the browser keeps its cached copy — that is the point.

   Run it after editing any CSS or JavaScript:

       npm run assets:version     rewrite the ?v= markers
       npm run assets:check       fail if any marker is stale or missing

   `npm run check` and `npm run check:production` run the check form,
   so a forgotten version cannot reach a deployment unnoticed.
   ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var ROOT = path.resolve(__dirname, "..");
var CHECK_ONLY = process.argv.indexOf("--check") !== -1;

/* Local CSS/JS references only: absolute URLs, inline scripts and images are
   left exactly as they are. The query part is optional so the script can both
   add a missing marker and refresh an outdated one. */
var ASSET_REFERENCE = /(href|src)="((?:\.\.\/)*assets\/(?:css|js)\/[^"?#]+\.(?:css|js))(\?[^"?#]*)?"/g;

function shortHash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 8);
}

function htmlPages() {
  var pages = fs.readdirSync(ROOT).filter(function (name) { return name.endsWith(".html"); });
  var adminDir = path.join(ROOT, "admin");
  if (fs.existsSync(adminDir)) {
    fs.readdirSync(adminDir).forEach(function (name) {
      if (name.endsWith(".html")) pages.push(path.join("admin", name));
    });
  }
  return pages.sort();
}

/* One page: report every reference and, when writing, bring each marker up to
   the hash of the file it points at. */
function versionPage(relativePage, write) {
  var absolutePage = path.join(ROOT, relativePage);
  var pageDir = path.dirname(absolutePage);
  var source = fs.readFileSync(absolutePage, "utf8");
  var report = { page: relativePage, references: 0, stale: [], missing: [] };
  var updated = source.replace(ASSET_REFERENCE, function (full, attribute, reference, query) {
    var target = path.resolve(pageDir, reference);
    if (!fs.existsSync(target)) {
      report.missing.push(reference);
      return full;
    }
    report.references++;
    var marker = "?v=" + shortHash(target);
    if (query === marker) return full;
    report.stale.push({ from: reference + (query || ""), to: reference + marker });
    return attribute + '="' + reference + marker + '"';
  });
  if (write && updated !== source) fs.writeFileSync(absolutePage, updated);
  return report;
}

var reports = htmlPages().map(function (page) { return versionPage(page, !CHECK_ONLY); });
var references = reports.reduce(function (count, report) { return count + report.references; }, 0);
var stale = reports.reduce(function (count, report) { return count + report.stale.length; }, 0);
var missing = reports.reduce(function (count, report) { return count + report.missing.length; }, 0);

reports.forEach(function (report) {
  if (!CHECK_ONLY) {
    report.stale.forEach(function (entry) {
      console.log("  " + report.page + ": " + entry.from + " → " + entry.to);
    });
  } else {
    report.stale.forEach(function (entry) {
      console.error("  STALE    " + report.page + ": " + entry.from + " should be " + entry.to);
    });
  }
  report.missing.forEach(function (reference) {
    console.error("  MISSING  " + report.page + " → " + reference);
  });
});

var pageCount = reports.length;
if (CHECK_ONLY) {
  if (stale || missing) {
    console.error("\nRun `npm run assets:version` to refresh the asset versions.");
    console.log("asset versions: " + references + " references checked across " + pageCount +
      " pages, " + (stale + missing) + " out of date");
    process.exit(1);
  }
  console.log("asset versions: " + references + " references carry a current content hash across " +
    pageCount + " pages");
  process.exit(0);
}

console.log(stale
  ? "\nUpdated " + stale + " reference" + (stale === 1 ? "" : "s") + " across " + pageCount + " pages."
  : "Asset versions already current (" + references + " references across " + pageCount + " pages).");
if (missing) process.exit(1);
