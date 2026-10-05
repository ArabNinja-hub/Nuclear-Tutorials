"use strict";
/* ============================================================
   NUCLEAR TUTORIALS — Server helpers
   JSON responses, request bodies, field validation and the
   canonical video-source analyser. Provider detection lives here
   (not in the browser) so stored rows already carry a ready-to-use
   embed URL and thumbnail, and the client never has to re-derive it.
   ============================================================ */

var YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
var MEDIA_EXT = /\.(mp4|webm|ogv|ogg|m4v|mov)(\?|#|$)/i;
var MAX_BODY_BYTES = 512 * 1024;

function send(res, status, payload, headers) {
  var body = Buffer.from(JSON.stringify(payload == null ? {} : payload), "utf8");
  res.writeHead(status, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store"
  }, headers || {}));
  res.end(body);
}

function readJson(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      if (!chunks.length) return resolve({});
      try {
        var parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(parsed && typeof parsed === "object" ? parsed : {});
      } catch (error) {
        reject(Object.assign(new Error("Body must be valid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

/* ---------- field normalisation ---------- */
function text(value, max) {
  var out = String(value == null ? "" : value).replace(/\r\n/g, "\n").trim();
  if (max && out.length > max) out = out.slice(0, max);
  return out;
}

function intOrNull(value) {
  if (value === "" || value == null) return null;
  var n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function intOr(value, fallback) {
  var n = intOrNull(value);
  return n === null ? fallback : n;
}

function oneOf(value, allowed, fallback) {
  return allowed.indexOf(value) !== -1 ? value : fallback;
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

/* Accepts seconds, "mm:ss" or "hh:mm:ss" and returns whole seconds or null. */
function duration(value) {
  if (value === "" || value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
  var raw = String(value).trim();
  if (/^\d+$/.test(raw)) return Math.min(86400, parseInt(raw, 10));
  var parts = raw.split(":").map(function (part) { return part.trim(); });
  if (parts.length < 2 || parts.length > 3 || parts.some(function (part) { return !/^\d{1,3}$/.test(part); })) return null;
  var seconds = parts.reduce(function (total, part) { return total * 60 + parseInt(part, 10); }, 0);
  return seconds > 0 && seconds <= 86400 ? seconds : null;
}

function isHttpUrl(value) {
  try {
    var url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (error) {
    return false;
  }
}

/* ---------- video source analysis ----------
   provider: youtube | vimeo | file | external
   The result is stored with the video so the student pages can embed or
   link out without guessing, and the admin form can preview the source. */
function analyzeVideoUrl(raw) {
  var url = text(raw, 2000);
  var result = {
    ok: false,
    provider: "",
    externalId: "",
    embedUrl: "",
    autoThumbnail: "",
    reason: ""
  };
  if (!url) {
    result.reason = "Enter the video URL.";
    return result;
  }
  if (!isHttpUrl(url)) {
    result.reason = "The video URL must start with https:// or http://.";
    return result;
  }
  var parsed = new URL(url);
  var host = parsed.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    var shortId = parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (YOUTUBE_ID.test(shortId)) return youtube(shortId);
  }
  if (/(^|\.)youtube\.com$/.test(host) || host === "m.youtube.com") {
    var watchId = parsed.searchParams.get("v");
    if (watchId && YOUTUBE_ID.test(watchId)) return youtube(watchId);
    var segments = parsed.pathname.split("/").filter(Boolean);
    var marker = segments.findIndex(function (segment) {
      return ["embed", "shorts", "live", "v"].indexOf(segment) !== -1;
    });
    if (marker !== -1 && segments[marker + 1] && YOUTUBE_ID.test(segments[marker + 1])) return youtube(segments[marker + 1]);
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    var segments = parsed.pathname.split("/").filter(Boolean);
    var numeric = segments.filter(function (segment) { return /^\d{6,12}$/.test(segment); })[0];
    if (numeric) {
      result.ok = true;
      result.provider = "vimeo";
      result.externalId = numeric;
      result.embedUrl = "https://player.vimeo.com/video/" + numeric;
      return result;
    }
  }
  if (MEDIA_EXT.test(parsed.pathname)) {
    result.ok = true;
    result.provider = "file";
    result.embedUrl = url;
    return result;
  }

  /* Any other link is kept, but it opens in a new tab rather than embedding. */
  result.ok = true;
  result.provider = "external";
  result.embedUrl = "";
  result.reason = "This link cannot be embedded, so students open it in a new tab.";
  return result;

  function youtube(id) {
    result.ok = true;
    result.provider = "youtube";
    result.externalId = id;
    result.embedUrl = "https://www.youtube-nocookie.com/embed/" + id + "?rel=0&modestbranding=1";
    result.autoThumbnail = "https://img.youtube.com/vi/" + id + "/hqdefault.jpg";
    return result;
  }
}

function validationError(message, fields) {
  var error = new Error(message);
  error.status = 400;
  error.fields = fields || {};
  return error;
}

module.exports = {
  send: send,
  readJson: readJson,
  text: text,
  intOrNull: intOrNull,
  intOr: intOr,
  oneOf: oneOf,
  bool: bool,
  duration: duration,
  isHttpUrl: isHttpUrl,
  analyzeVideoUrl: analyzeVideoUrl,
  validationError: validationError
};
