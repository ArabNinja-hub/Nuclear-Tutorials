/* ============================================================
   NUCLEAR TUTORIALS — Platform detection

   One place that answers "is this process running on a deployed
   host?", so the production rules (no development files on the
   website, no sample content, strict storage requirements) apply on
   every platform — Railway included.

   Deployed hosts set at least one of these variables themselves; none
   of them is ever set on a development machine:

     Railway   RAILWAY_ENVIRONMENT_NAME / RAILWAY_SERVICE_ID /
               RAILWAY_PROJECT_ID / RAILWAY_PUBLIC_DOMAIN /
               RAILWAY_VOLUME_MOUNT_PATH (set when a volume is attached)
     Render    RENDER / RENDER_SERVICE_ID / RENDER_EXTERNAL_URL
     Heroku    DYNO
     Fly.io    FLY_APP_NAME
     Cloud Run K_SERVICE
     Azure     WEBSITE_SITE_NAME
     Vercel    VERCEL
     Netlify   NETLIFY
   ============================================================ */
"use strict";

var DEPLOYED_VARIABLES = [
  "RAILWAY_ENVIRONMENT_NAME", "RAILWAY_ENVIRONMENT_ID", "RAILWAY_SERVICE_ID", "RAILWAY_PROJECT_ID",
  "RAILWAY_PUBLIC_DOMAIN", "RAILWAY_VOLUME_MOUNT_PATH", "RAILWAY_VOLUME_NAME",
  "RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_URL",
  "DYNO", "FLY_APP_NAME", "K_SERVICE", "WEBSITE_SITE_NAME", "VERCEL", "NETLIFY"
];

function isDeployed() {
  return DEPLOYED_VARIABLES.some(function (name) {
    return !!String(process.env[name] || "").trim();
  });
}

/* The platform that was detected, for log lines and error messages. */
function deployedPlatform() {
  if (String(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_VOLUME_MOUNT_PATH || "").trim()) return "Railway";
  if (process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL) return "Render";
  if (process.env.DYNO) return "Heroku";
  if (process.env.FLY_APP_NAME) return "Fly.io";
  if (process.env.K_SERVICE) return "Cloud Run";
  if (process.env.WEBSITE_SITE_NAME) return "Azure App Service";
  if (process.env.VERCEL) return "Vercel";
  if (process.env.NETLIFY) return "Netlify";
  return "a deployed host";
}

function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

/* A loopback bind address only accepts connections from inside the same
   container, so a platform's proxy (Railway included) can never reach it. */
function isLoopback(host) {
  var value = String(host || "").trim().toLowerCase();
  return value === "localhost" || value === "::1" || value === "[::1]" ||
    value === "127.0.0.1" || /^127\./.test(value);
}

module.exports = {
  isDeployed: isDeployed,
  deployedPlatform: deployedPlatform,
  isProduction: isProduction,
  isLoopback: isLoopback
};
