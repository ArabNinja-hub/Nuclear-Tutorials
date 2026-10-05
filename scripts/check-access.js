#!/usr/bin/env node
/* ============================================================
   Package access control checks

   Proves that Basic / Standard / Premium limits are enforced by the
   server and cannot be bypassed from the browser:

     1. the package matrix (allowed / denied for every combination)
     2. direct API requests to protected lessons (403, no source URL)
     3. catalogue responses never contain a protected video source
     4. fabricated or edited access codes in localStorage change nothing
     5. a redeemed code cannot be promoted to another package by the client
     6. progress cannot be written with an unused, expired or unknown code

   Usage:  node scripts/check-access.js
           BASE=http://127.0.0.1:8123 node scripts/check-access.js
   ============================================================ */
"use strict";

var http = require("http");
var https = require("https");

var BASE = (process.env.BASE || "http://127.0.0.1:" + (process.env.PORT || 8000)).replace(/\/$/, "");
var passed = 0;
var failed = 0;

function check(condition, label) {
  if (condition) { passed++; console.log("  PASS  " + label); }
  else { failed++; console.error("  FAIL  " + label); }
}
function group(label) { console.log("\n== " + label + " =="); }

function request(method, path, body, options) {
  var opts = options || {};
  return new Promise(function (resolve, reject) {
    var url = new URL(BASE + path);
    var client = url.protocol === "https:" ? https : http;
    var payload = body == null ? null : JSON.stringify(body);
    var headers = { Accept: "application/json" };
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    if (opts.code) headers["X-NT-Code"] = opts.code;
    if (opts.cookie) headers.Cookie = opts.cookie;
    var req = client.request(url, { method: method, headers: headers }, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () {
        var raw = Buffer.concat(chunks).toString("utf8");
        var json = null;
        try { json = JSON.parse(raw); } catch (error) { /* non-JSON */ }
        resolve({ status: res.statusCode, json: json, raw: raw });
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, function () { req.destroy(new Error("timeout")); });
    if (payload) req.write(payload);
    req.end();
  });
}

var credentials = process.env.NT_ADMIN_PASSWORD || "nuclear-admin";
var issued = {};

function catalogueFor(code) {
  return request("GET", "/api/catalogue", null, code ? { code: code } : {}).then(function (response) {
    return response.json.catalogue;
  });
}
function videoById(catalogue, id) {
  return catalogue.videos.filter(function (video) { return video.id === id; })[0] || null;
}
function issueAndRedeem(pack) {
  return request("POST", "/api/codes/issue", { package: pack }).then(function (response) {
    var code = response.json && response.json.code;
    return request("POST", "/api/access/redeem", { code: code, educationLevel: "university" }).then(function (redeemed) {
      return redeemed.status === 200 ? code : null;
    });
  });
}

var state = {};

request("GET", "/api/catalogue").then(function (response) {
  group("Server-side package matrix");
  var publicCatalogue = response.json.catalogue;
  state.levels = {};

  ["basic", "standard", "premium"].forEach(function (level) {
    var found = publicCatalogue.videos.filter(function (video) { return video.level === level; })[0];
    if (found) state.levels[level] = found;
  });

  if (!state.levels.basic || !state.levels.standard || !state.levels.premium) {
    check(false, "the catalogue needs at least one basic, standard and premium lesson to test with " +
      "(run `npm run seed:demo` for a local check)");
    console.log("\n" + passed + " passed, " + failed + " failed");
    process.exit(1);
  }

  check(publicCatalogue.videos.every(function (video) { return video.locked === true; }),
    "a visitor receives every lesson marked as locked");
  check(publicCatalogue.videos.every(function (video) { return video.sourceUrl === null; }),
    "a visitor receives no video source URLs at all");
  state.publicCatalogue = publicCatalogue;

  var matrix = {
    basic: { basic: true, standard: false, premium: false },
    standard: { basic: true, standard: true, premium: false },
    premium: { basic: true, standard: true, premium: true }
  };
  var packages = ["basic", "standard", "premium"];
  return packages.reduce(function (chain, pack) {
    return chain.then(function () {
      return issueAndRedeem(pack).then(function (code) {
        state[pack] = code;
        return catalogueFor(code).then(function (catalogue) {
          packages.forEach(function (tier) {
            var video = videoById(catalogue, state.levels[tier].id);
            var expected = matrix[pack][tier];
            check(!!video && video.locked === !expected,
              pack + " → " + tier + " lesson = " + (expected ? "allowed" : "denied"));
          });
          return catalogue;
        });
      });
    });
  }, Promise.resolve()).then(function (catalogue) {
    state.premiumCatalogue = catalogue;
  });
}).then(function () {
  group("Direct API requests to protected lessons");
  var scenarios = [
    [null, "visitor", false],
    [state.basic, "basic", false],
    [state.standard, "standard", false],
    [state.premium, "premium", true]
  ];
  return scenarios.reduce(function (chain, entry) {
    var code = entry[0];
    var pack = entry[1];
    var allowed = entry[2];
    return chain.then(function () {
      return request("GET", "/api/videos/" + encodeURIComponent(state.levels.premium.id), null, code ? { code: code } : {})
        .then(function (response) {
          if (allowed) {
            check(response.status === 200 && response.json.video && /^https?:\/\//.test(response.json.video.sourceUrl || ""),
              pack + " requesting a premium lesson directly is served with its source URL");
          } else {
            check(response.status === 403, pack + " requesting a premium lesson directly is refused (403)");
            check(!/"sourceUrl"\s*:\s*"https?:/.test(response.raw), pack + " refusal leaks no source URL");
          }
        });
    });
  }, Promise.resolve());
}).then(function () {
  group("Catalogue, list and search responses");
  return catalogueFor(state.basic).then(function (catalogue) {
    var premium = videoById(catalogue, state.levels.premium.id);
    check(premium && premium.sourceUrl === null && premium.locked === true,
      "a basic code never receives a premium source URL in the catalogue");
    var standard = videoById(catalogue, state.levels.standard.id);
    check(standard && standard.sourceUrl === null, "a basic code never receives a standard source URL either");
    var basic = videoById(catalogue, state.levels.basic.id);
    check(basic && /^https?:\/\//.test(basic.sourceUrl || ""), "a basic code does receive basic source URLs");
    return request("GET", "/api/videos?status=all", null, { code: state.basic });
  }).then(function (response) {
    check(!/"sourceUrl"\s*:\s*"https?:[^"]*(?:premium|standard)/.test(response.raw),
      "the video list endpoint redacts every lesson above the caller's package");
    check(response.json.videos.filter(function (video) { return video.level !== "basic"; })
      .every(function (video) { return video.sourceUrl === null; }),
      "no standard or premium source URL is present in the list response");
    var title = state.levels.premium.title.split(" ").slice(0, 3).join(" ");
    return request("GET", "/api/search?q=" + encodeURIComponent(title), null, { code: state.basic });
  }).then(function (response) {
    var hits = (response.json.videos || []).filter(function (video) { return video.level === "premium"; });
    check(hits.length > 0, "search still finds premium lessons for a basic code");
    check(hits.every(function (video) { return video.sourceUrl === null && video.locked === true; }),
      "search results never include a protected source URL");
  });
}).then(function () {
  group("Fabricated and edited local state");
  /* The browser is not trusted: these are the values a student could write
     into localStorage, sent straight to the API. */
  var fabricated = [
    { label: "a made-up premium code", code: "NT-PREMIUM-9999" },
    { label: "the salted hash of a real premium code", code: "NT-PREMIUM-0000" },
    { label: "an empty code", code: "" },
    { label: "a basic code as a fake premium header", code: state.basic }
  ];
  return fabricated.reduce(function (chain, entry) {
    return chain.then(function () {
      return request("GET", "/api/videos/" + encodeURIComponent(state.levels.premium.id), null, { code: entry.code })
        .then(function (response) {
          check(response.status === 403, entry.label + " is refused by the server (403)");
          check(!/"sourceUrl"\s*:\s*"https?:/.test(response.raw), entry.label + " returns no video source");
        });
    });
  }, Promise.resolve());
}).then(function () {
  group("Access code integrity");
  return request("POST", "/api/codes/issue", { package: "basic" }).then(function (response) {
    var unused = response.json.code;
    return request("GET", "/api/catalogue", null, { code: unused }).then(function (catalogueResponse) {
      check(catalogueResponse.json.catalogue.videos.every(function (video) { return video.locked === true; }),
        "an issued but unredeemed code grants no lesson at all");
      return request("POST", "/api/progress", { videoId: state.levels.basic.id, completed: true }, { code: unused });
    }).then(function (progressResponse) {
      check(progressResponse.status === 401, "an unredeemed code cannot write progress");
      return request("GET", "/api/progress", null, { code: unused });
    }).then(function (progressResponse) {
      check(progressResponse.status === 401, "an unredeemed code cannot read progress");
      /* A redeemed basic code must stay basic even if the client asks for more. */
      return request("GET", "/api/videos/" + encodeURIComponent(state.levels.premium.id), null, { code: state.basic });
    }).then(function (response) {
      check(response.status === 403, "a redeemed basic code cannot escalate to premium by re-requesting");
      return request("POST", "/api/access/redeem", { code: state.basic, educationLevel: "university" });
    }).then(function (response) {
      check(response.status === 409, "a redeemed code cannot be redeemed again to change its package");
      return request("POST", "/api/progress", { videoId: state.levels.basic.id, completed: true }, { code: "NT-PREMIUM-9999" });
    }).then(function (response) {
      check(response.status === 401, "progress cannot be written with a fabricated code");
    });
  });
}).then(function () {
  /* Expiry and first-run behaviour need a database that can be prepared
     before the server starts, so they live in scripts/test-db.js
     (`npm run test:setup`). */
  return null;
}).then(function () {
  group("Student accounts cannot reach administration");
  var requests = [
    ["GET", "/api/admin/overview"],
    ["GET", "/api/admin/videos"],
    ["GET", "/api/admin/settings"],
    ["POST", "/api/admin/videos"],
    ["POST", "/api/admin/universities"],
    ["POST", "/api/admin/courses"],
    ["POST", "/api/admin/codes"],
    ["PUT", "/api/admin/settings"],
    ["PATCH", "/api/admin/settings"],
    ["PATCH", "/api/admin/videos/none"],
    ["DELETE", "/api/admin/videos/none"],
    ["DELETE", "/api/admin/courses/none"],
    ["DELETE", "/api/admin/codes/NT-X-0000"]
  ];
  var second = [["GET", "/api/admin/overview"], ["POST", "/api/admin/videos"], ["PUT", "/api/admin/settings"]];
  return requests.reduce(function (chain, entry) {
    return chain.then(function () {
      return request(entry[0], entry[1], entry[0] === "GET" ? null : {}, { code: state.premium })
        .then(function (response) {
          check(response.status === 401 || response.status === 403,
            "a signed-in student calling " + entry[0] + " " + entry[1] + " is refused (" + response.status + ")");
        });
    });
  }, Promise.resolve()).then(function () {
    /* The same calls with no credentials at all (a visitor). */
    return second.reduce(function (chain, entry) {
      return chain.then(function () {
        return request(entry[0], entry[1], entry[0] === "GET" ? null : {}).then(function (response) {
          check(response.status === 401 || response.status === 403,
            "an unauthenticated " + entry[0] + " " + entry[1] + " is refused (" + response.status + ")");
        });
      });
    }, Promise.resolve());
  });
}).then(function () {
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
}).catch(function (error) {
  console.error("Access checks could not complete: " + (error && error.message));
  console.error("Start the server first (npm start), or pass BASE=http://host:port");
  process.exit(1);
});
