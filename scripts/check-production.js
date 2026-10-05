#!/usr/bin/env node
/* ============================================================
   Production verification suite

   Runs every check that matters for a production deployment, in order,
   and prints one summary. The live steps need a running server
   (npm start) — they are the ones that prove the platform behaves for
   real students and administrators.

   Usage:  npm run check:production
           BASE=https://your-app.onrender.com npm run check:production
           NT_ADMIN_PASSWORD=<first-run password> npm run check:production
   ============================================================ */
"use strict";

var path = require("path");
var childProcess = require("child_process");
var ROOT = path.resolve(__dirname, "..");
var BASE = (process.env.BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

/* Each step: the script, the extra environment it needs, and what it proves. */
var steps = [
  { name: "Platform structure and policies", script: "scripts/check-platform.js",
    proves: "files, page shells, fonts, icons, video-only policy, production isolation rules" },
  { name: "Static render smoke", script: "scripts/smoke-render.js",
    proves: "every page renders without a server, offline states, fabricated grants rejected" },
  { name: "Database, first run and isolation", script: "scripts/test-db.js",
    proves: "empty production database, password rotation, persistence, development isolation" },
  { name: "Package access control", script: "scripts/check-access.js", live: true,
    proves: "the Basic/Standard/Premium matrix, redaction and bypass attempts over HTTP" },
  { name: "Live pages, API and journeys", script: "scripts/check-platform.js", env: { BASE: BASE },
    proves: "every page and asset over HTTP, the API, the admin guard and the flows" },
  { name: "Live render smoke", script: "scripts/smoke-render.js", env: { SMOKE_BASE: BASE },
    proves: "the pages render against the live API with real catalogue data" },
  { name: "Student and admin journeys", script: "scripts/check-flows.js", live: true,
    proves: "University → Semester → Course → Video → Watch, and admin → add → publish" }
];

function run(step) {
  /* Each step starts from a clean slate: the offline suites must not inherit
     BASE or SMOKE_BASE, and only live steps get a server address. */
  var env = Object.assign({}, process.env, { NODE_NO_WARNINGS: "1" });
  delete env.BASE;
  delete env.SMOKE_BASE;
  env = Object.assign(env, step.env || {});
  var result = childProcess.spawnSync(process.execPath, [path.join(ROOT, step.script)], {
    cwd: ROOT, env: env, encoding: "utf8"
  });
  var output = (result.stdout || "") + (result.stderr || "");
  /* Use the final tally: a suite may print an inner suite's summary first. */
  var tallies = output.match(/(\d+) passed, (\d+) failed/g) || [];
  var counts = tallies.length ? /(\d+) passed, (\d+) failed/.exec(tallies[tallies.length - 1]) : null;
  return {
    label: step.name,
    proves: step.proves,
    status: result.status,
    passed: counts ? Number(counts[1]) : null,
    failed: counts ? Number(counts[2]) : null,
    output: output,
    skipped: (output.match(/(\d+) skip/g) || []).length && !counts
  };
}

console.log("Production verification suite");
console.log("Server under test: " + BASE);
console.log("Administrator password: " + (process.env.NT_ADMIN_PASSWORD ? "provided through NT_ADMIN_PASSWORD" : "not set (a first-run password will be rotated automatically)"));
console.log("");

var results = steps.map(function (step, index) {
  console.log("[" + (index + 1) + "/" + steps.length + "] " + step.name + " …");
  var result = run(step);
  var summary = result.passed === null
    ? (result.status === 0 ? "completed" : "could not run")
    : result.passed + " passed, " + result.failed + " failed";
  console.log("      " + (result.status === 0 ? "OK  " : "FAIL") + "  " + summary);
  if (result.status !== 0) {
    result.output.split("\n").filter(function (line) { return /FAIL|Error|error:/.test(line); })
      .slice(0, 12).forEach(function (line) { console.log("      " + line.trim()); });
    if (result.passed === null) {
      console.log("      hint: start the server first (`npm start`) or pass BASE=https://your-app.onrender.com");
    }
  }
  return result;
});

var totalPassed = results.reduce(function (sum, result) { return sum + (result.passed || 0); }, 0);
var totalFailed = results.reduce(function (sum, result) { return sum + (result.failed || 0); }, 0);
var broken = results.filter(function (result) { return result.status !== 0; });

console.log("");
console.log("Summary");
console.log("  checks run     : " + totalPassed + " assertions passed, " + totalFailed + " failed");
console.log("  suites passed  : " + (results.length - broken.length) + " of " + results.length);
if (broken.length) {
  console.log("  failed suites  : " + broken.map(function (result) { return result.label; }).join(", "));
  console.log("\nProduction verification FAILED.");
  process.exit(1);
}
console.log("\nAll production checks passed.");
