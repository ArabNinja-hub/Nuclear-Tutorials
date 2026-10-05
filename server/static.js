"use strict";
/* ============================================================
   NUCLEAR TUTORIALS — Static file server
   Serves the existing HTML/CSS/JS site unchanged, with safe path
   resolution, conditional requests (ETag) and gzip for text assets.
   ============================================================ */

var fs = require("node:fs");
var path = require("node:path");
var zlib = require("node:zlib");
var crypto = require("node:crypto");

var MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf"
};

var COMPRESSIBLE = /^text\/|application\/(json|javascript)|image\/svg\+xml/;

/* Headers applied to every response. frame-ancestors / X-Frame-Options are
   intentionally absent so the site can be previewed inside an iframe. */
function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https: blob:",
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self'",
      "form-action 'self'",
      "object-src 'none'"
    ].join("; ")
  };
}

function resolveFile(rootDir, pathname) {
  var decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error) {
    return null;
  }
  if (decoded.indexOf("\0") !== -1) return null;
  var relative = decoded.replace(/^\/+/, "");
  var target = path.resolve(rootDir, relative || "index.html");
  if (target !== rootDir && !target.startsWith(rootDir + path.sep)) return null;

  var stats = stat(target);
  if (stats && stats.isDirectory()) {
    var indexFile = path.join(target, "index.html");
    stats = stat(indexFile);
    if (stats) return { file: indexFile, stats: stats };
    return null;
  }
  if (stats) return { file: target, stats: stats };

  /* Pretty paths: /universities → /universities.html */
  if (!path.extname(target)) {
    var withExtension = target + ".html";
    stats = stat(withExtension);
    if (stats) return { file: withExtension, stats: stats };
  }
  return null;
}

function stat(file) {
  try {
    var stats = fs.statSync(file);
    return stats.isFile() || stats.isDirectory() ? stats : null;
  } catch (error) {
    return null;
  }
}

function etagFor(stats) {
  return '"' + crypto.createHash("sha1").update(stats.size + "-" + stats.mtimeMs).digest("base64").slice(0, 20) + '"';
}

function acceptsGzip(req) {
  return String(req.headers["accept-encoding"] || "").indexOf("gzip") !== -1;
}

function serve(req, res, url, rootDir) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  var found = resolveFile(rootDir, url.pathname);
  if (!found) return false;

  var ext = path.extname(found.file).toLowerCase();
  var type = MIME[ext] || "application/octet-stream";
  var etag = etagFor(found.stats);
  var headers = Object.assign(securityHeaders(), {
    "Content-Type": type,
    "ETag": etag,
    "Last-Modified": found.stats.mtime.toUTCString(),
    /* Revalidate every request: content changes in the admin area must reach
       students immediately, and 304s keep repeat views cheap. */
    "Cache-Control": "no-cache",
    "Accept-Ranges": "bytes"
  });

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }

  var body = fs.readFileSync(found.file);
  if (COMPRESSIBLE.test(type) && body.length > 1024 && acceptsGzip(req)) {
    body = zlib.gzipSync(body, { level: 6 });
    headers["Content-Encoding"] = "gzip";
    headers.Vary = "Accept-Encoding";
  }
  headers["Content-Length"] = body.length;
  res.writeHead(200, headers);
  if (req.method === "HEAD") res.end();
  else res.end(body);
  return true;
}

module.exports = {
  serve: serve,
  resolveFile: resolveFile,
  securityHeaders: securityHeaders,
  MIME: MIME
};
