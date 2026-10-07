/* ============================================================
   NUCLEAR TUTORIALS — Outgoing email

   Sends the access email a student receives after Mr Steven Manda
   confirms a payment. Dependency-free on purpose, like the rest of
   the server: a small SMTP client (node:net / node:tls) plus an
   optional HTTPS relay for hosts that prefer an API.

   Configuration (environment variables — see .env.example):

     NT_SMTP_URL        smtps://user:password@smtp.example.com:465
                        (or smtp:// for port 587 with STARTTLS)
     NT_SMTP_HOST       host name, when NT_SMTP_URL is not used
     NT_SMTP_PORT       port (default 587; 465 when NT_SMTP_SECURE=1)
     NT_SMTP_USER       SMTP username (optional: relay may be open)
     NT_SMTP_PASS       SMTP password
     NT_SMTP_SECURE     "1" → implicit TLS from the first byte (port 465)
     NT_SMTP_STARTTLS   "0" → never upgrade to TLS (not recommended)
     NT_SMTP_ALLOW_INSECURE  "1" → allow plain SMTP with no TLS at all
     NT_MAIL_FROM       envelope + header sender (required)
     NT_MAIL_FROM_NAME  display name (default "Nuclear Tutorials")
     NT_MAIL_API_URL    https relay: receives {from,fromName,to,subject,text,html}
     NT_MAIL_API_KEY    bearer token for NT_MAIL_API_URL
     NT_MAIL_TIMEOUT_MS per-command timeout (default 15000)

   When nothing is configured the transport reports itself as
   unconfigured and sending fails with a clear reason. That failure is
   never silent: the payment enquiry stores it and Admin → Payment
   enquiries offers "Retry email" so a confirmation is never lost.
   ============================================================ */
"use strict";

var net = require("net");
var tls = require("tls");
var os = require("os");
var crypto = require("crypto");

var DEFAULT_TIMEOUT = 15000;

function text(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max || 500);
}

function parseSmtpUrl(raw) {
  var value = text(raw, 500);
  if (!value) return null;
  var secure = /^smtps:\/\//i.test(value);
  var normalised = value.replace(/^smtps?:\/\//i, "http://");
  try {
    var url = new URL(normalised);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : (secure ? 465 : 587),
      secure: secure,
      user: decodeURIComponent(url.username || ""),
      pass: decodeURIComponent(url.password || "")
    };
  } catch (error) {
    return { invalid: value };
  }
}

function config() {
  var fromUrl = parseSmtpUrl(process.env.NT_SMTP_URL);
  if (fromUrl && fromUrl.invalid) {
    return { error: "NT_SMTP_URL is not a valid smtp:// or smtps:// URL." };
  }
  var secureFlag = text(process.env.NT_SMTP_SECURE, 8).toLowerCase();
  var secure = fromUrl ? fromUrl.secure : (secureFlag === "1" || secureFlag === "true");
  var host = text(process.env.NT_SMTP_HOST, 200) || (fromUrl ? fromUrl.host : "");
  var port = Number(text(process.env.NT_SMTP_PORT, 8)) || (fromUrl ? fromUrl.port : (secure ? 465 : 587));
  var starttlsFlag = text(process.env.NT_SMTP_STARTTLS, 8).toLowerCase();
  var timeout = Number(text(process.env.NT_MAIL_TIMEOUT_MS, 12)) || DEFAULT_TIMEOUT;
  if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 120000) timeout = DEFAULT_TIMEOUT;
  return {
    host: host,
    port: Number.isFinite(port) && port > 0 ? port : (secure ? 465 : 587),
    secure: secure,
    starttls: starttlsFlag === "0" ? false : !secure,
    allowInsecure: text(process.env.NT_SMTP_ALLOW_INSECURE, 4) === "1",
    user: text(process.env.NT_SMTP_USER, 200) || (fromUrl ? fromUrl.user : ""),
    pass: process.env.NT_SMTP_PASS != null && process.env.NT_SMTP_PASS !== ""
      ? process.env.NT_SMTP_PASS
      : (fromUrl ? fromUrl.pass : ""),
    from: text(process.env.NT_MAIL_FROM, 320),
    fromName: text(process.env.NT_MAIL_FROM_NAME, 120) || "Nuclear Tutorials",
    apiUrl: text(process.env.NT_MAIL_API_URL, 500),
    apiKey: text(process.env.NT_MAIL_API_KEY, 500),
    timeout: timeout
  };
}

/* True when enough configuration exists for a send to be attempted. */
function isConfigured() {
  var cfg = config();
  if (cfg.error) return false;
  if (cfg.apiUrl) return true;
  return !!(cfg.host && cfg.from);
}

/* A short, non-secret description of the active transport, for the
   administrator console. */
function describe() {
  var cfg = config();
  if (cfg.error) return cfg.error;
  if (cfg.apiUrl) return "HTTPS relay" + (cfg.apiKey ? " (key set)" : " (no key)");
  if (!cfg.host) return "Not configured — set NT_SMTP_HOST/NT_SMTP_URL and NT_MAIL_FROM";
  var sender = cfg.from ? cfg.from : "no sender (NT_MAIL_FROM is empty)";
  return cfg.host + ":" + cfg.port + (cfg.secure ? " (TLS)" : (cfg.starttls ? " (STARTTLS)" : " (no TLS)")) +
    " · from " + sender;
}

/* ------------------------------------------------------------
   Message assembly
   ------------------------------------------------------------ */

function encodeHeaderValue(value) {
  var raw = String(value == null ? "" : value);
  /* Keep the header ASCII-safe without pulling in a MIME library. */
  return /^[\x20-\x7e]*$/.test(raw) ? raw : "=?UTF-8?B?" + Buffer.from(raw, "utf8").toString("base64") + "?=";
}

function base64Lines(value) {
  var encoded = Buffer.from(String(value == null ? "" : value), "utf8").toString("base64");
  var lines = [];
  for (var index = 0; index < encoded.length; index += 76) lines.push(encoded.slice(index, index + 76));
  return lines.join("\r\n");
}

function rfc5322Date(date) {
  var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var pad = function (value) { return String(value).padStart(2, "0"); };
  var offsetMinutes = -date.getTimezoneOffset();
  var sign = offsetMinutes >= 0 ? "+" : "-";
  var abs = Math.abs(offsetMinutes);
  return days[date.getDay()] + ", " + pad(date.getDate()) + " " + months[date.getMonth()] + " " +
    date.getFullYear() + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) +
    " " + sign + pad(Math.floor(abs / 60)) + pad(abs % 60);
}

function addressLine(email, name) {
  var address = text(email, 320);
  var label = text(name, 160);
  if (!label) return "<" + address + ">";
  return "\"" + label.replace(/["\\]/g, "") + "\" <" + address + ">";
}

function buildMessage(cfg, message) {
  var boundary = "nt-" + crypto.randomBytes(12).toString("hex");
  var to = text(message.to, 320);
  var subject = text(message.subject, 300) || "Nuclear Tutorials";
  var fromAddress = text(message.from || cfg.from, 320);
  var host = fromAddress.split("@")[1] || "nuclear-tutorials.local";
  var headers = [
    "From: " + addressLine(fromAddress, message.fromName || cfg.fromName),
    "To: <" + to + ">",
    "Subject: " + encodeHeaderValue(subject),
    "Date: " + rfc5322Date(new Date()),
    "Message-ID: <" + crypto.randomBytes(12).toString("hex") + "@" + host + ">",
    "MIME-Version: 1.0",
    "Auto-Submitted: auto-generated",
    "Content-Type: multipart/alternative; boundary=\"" + boundary + "\""
  ];
  var parts = [];
  parts.push("--" + boundary + "\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" +
    base64Lines(message.text || ""));
  if (message.html) {
    parts.push("--" + boundary + "\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" +
      base64Lines(message.html));
  }
  return {
    envelopeFrom: fromAddress,
    data: headers.join("\r\n") + "\r\n\r\n" + parts.join("\r\n") + "\r\n--" + boundary + "--\r\n"
  };
}

/* ------------------------------------------------------------
   SMTP conversation
   ------------------------------------------------------------ */

function smtpSend(cfg, message) {
  return new Promise(function (resolve, reject) {
    var socket = null;
    var buffer = "";
    var waiting = [];
    var finished = false;

    function cleanup() {
      if (socket && !socket.destroyed) {
        socket.removeAllListeners();
        socket.destroy();
      }
    }
    function fail(error) {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
    function succeed() {
      if (finished) return;
      finished = true;
      cleanup();
      resolve({ ok: true, transport: cfg.host + ":" + cfg.port });
    }

    function pump() {
      if (!waiting.length) return;
      var lines = buffer.split("\r\n");
      buffer = lines.pop();
      var replies = [];
      var complete = false;
      lines.forEach(function (line) {
        if (!line) return;
        replies.push(line);
        /* "250-LINE" continues, "250 LINE" ends the reply. */
        if (/^\d{3} /.test(line)) complete = true;
      });
      if (!complete || !replies.length) return;
      var current = waiting[0];
      waiting = waiting.slice(1);
      var code = Number(replies[replies.length - 1].slice(0, 3));
      var payload = replies.join(" ").slice(4);
      current({ code: code, text: payload, lines: replies });
      pump();
    }

    function readReply(label) {
      return new Promise(function (resolve, rejectReply) {
        var timer = setTimeout(function () {
          waiting = waiting.filter(function (entry) { return entry !== onReply; });
          rejectReply(new Error("The mail server did not answer " + label + " in time."));
        }, cfg.timeout);
        function onReply(reply) {
          clearTimeout(timer);
          if (reply.code >= 400) {
            rejectReply(new Error(label + " was refused (" + reply.code + "): " + reply.text));
            return;
          }
          resolve(reply);
        }
        waiting.push(onReply);
        pump();
      });
    }

    function send(line) {
      if (!socket || socket.destroyed) return Promise.reject(new Error("The connection to the mail server was closed."));
      socket.write(line + "\r\n");
      return Promise.resolve();
    }

    function command(line, label) {
      return send(line).then(function () { return readReply(label); });
    }

    /* RFC 4616 PLAIN when advertised, otherwise the widely supported LOGIN. */
    function authenticate(capabilities) {
      if (!cfg.user) return Promise.resolve();
      var advertisePlain = capabilities.some(function (line) { return /AUTH .*PLAIN/i.test(line); });
      if (advertisePlain) {
        var token = Buffer.from("\u0000" + cfg.user + "\u0000" + cfg.pass, "utf8").toString("base64");
        return command("AUTH PLAIN " + token, "AUTH PLAIN");
      }
      return command("AUTH LOGIN", "AUTH LOGIN").then(function () {
        return command(Buffer.from(cfg.user, "utf8").toString("base64"), "AUTH LOGIN username");
      }).then(function () {
        return command(Buffer.from(cfg.pass || "", "utf8").toString("base64"), "AUTH LOGIN password");
      });
    }

    var connected = new Promise(function (openResolve, openReject) {
      socket = cfg.secure
        ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
        : net.connect({ host: cfg.host, port: cfg.port });
      socket.setTimeout(cfg.timeout, function () { fail(new Error("The mail server timed out.")); });
      socket.on("error", function (error) { fail(new Error("Could not reach " + cfg.host + ":" + cfg.port + " — " + error.message)); });
      socket.on("close", function () {
        if (!finished) fail(new Error("The mail server closed the connection before the message was accepted."));
      });
      socket.on("data", function (chunk) {
        buffer += chunk.toString("utf8");
        pump();
      });
      var settle = function () { openResolve(); };
      if (cfg.secure) socket.once("secureConnect", settle);
      else socket.once("connect", settle);
      socket.once("error", openReject);
    });

    connected.then(function () {
      return readReply("the greeting");
    }).then(function () {
      return command("EHLO " + (os.hostname() || "nuclear-tutorials"), "EHLO");
    }).then(function (greeting) {
      var capabilities = greeting.lines || [];
      var supportsStartTls = capabilities.some(function (line) { return /STARTTLS/i.test(line); });
      if (!cfg.secure && cfg.starttls) {
        if (!supportsStartTls) {
          if (!cfg.allowInsecure) {
            throw new Error("The mail server does not offer STARTTLS. Set NT_SMTP_STARTTLS=0 and " +
              "NT_SMTP_ALLOW_INSECURE=1 only if the relay is on a trusted network.");
          }
          return capabilities;
        }
        return command("STARTTLS", "STARTTLS").then(function () {
          return new Promise(function (upgradeResolve, upgradeReject) {
            var plain = socket;
            plain.removeAllListeners("data");
            var upgraded = tls.connect({ socket: plain, servername: cfg.host }, function () {
              socket = upgraded;
              socket.setTimeout(cfg.timeout, function () { fail(new Error("The mail server timed out.")); });
              socket.on("error", function (error) { fail(new Error("TLS upgrade failed — " + error.message)); });
              socket.on("close", function () {
                if (!finished) fail(new Error("The mail server closed the connection during the TLS upgrade."));
              });
              socket.on("data", function (chunk) { buffer += chunk.toString("utf8"); pump(); });
              upgradeResolve();
            });
            upgraded.once("error", upgradeReject);
          });
        }).then(function () {
          return command("EHLO " + (os.hostname() || "nuclear-tutorials"), "EHLO");
        }).then(function (second) { return second.lines || capabilities; });
      }
      if (!cfg.secure && !cfg.starttls && !cfg.allowInsecure) {
        throw new Error("Refusing to send mail over an unencrypted connection. Set NT_SMTP_SECURE=1, " +
          "keep STARTTLS on, or set NT_SMTP_ALLOW_INSECURE=1 for a trusted local relay.");
      }
      return capabilities;
    }).then(function (capabilities) {
      return authenticate(capabilities || []);
    }).then(function () {
      return command("MAIL FROM:<" + message.envelopeFrom + ">", "MAIL FROM");
    }).then(function () {
      return command("RCPT TO:<" + text(message.to, 320) + ">", "RCPT TO");
    }).then(function () {
      return command("DATA", "DATA");
    }).then(function () {
      return send(message.data + "\r\n.");
    }).then(function () {
      return readReply("the message body");
    }).then(function () {
      return send("QUIT");
    }).then(function () {
      succeed();
    }).catch(function (error) {
      fail(error);
    });
  });
}

/* ------------------------------------------------------------
   HTTPS relay
   ------------------------------------------------------------ */

function relaySend(cfg, message) {
  var payload = {
    from: text(message.from || cfg.from, 320),
    fromName: text(message.fromName || cfg.fromName, 160),
    to: text(message.to, 320),
    subject: text(message.subject, 300),
    text: String(message.text || ""),
    html: String(message.html || "")
  };
  var headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (cfg.apiKey) headers.Authorization = "Bearer " + cfg.apiKey;
  var controller = typeof AbortController === "function" ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, cfg.timeout) : null;
  return fetch(cfg.apiUrl, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
    signal: controller ? controller.signal : undefined
  }).then(function (response) {
    if (timer) clearTimeout(timer);
    if (!response.ok) {
      return response.text().then(function (body) {
        throw new Error("The mail relay answered HTTP " + response.status +
          (body ? " — " + text(body, 200) : "."));
      });
    }
    return { ok: true, transport: "relay" };
  }, function (error) {
    if (timer) clearTimeout(timer);
    throw new Error("The mail relay could not be reached — " + ((error && error.message) || error));
  });
}

/* ------------------------------------------------------------
   Public API
   ------------------------------------------------------------ */

/* Rejects with a readable reason when the message cannot be handed to a
   mail server. Callers must treat a rejection as "the student has not
   been emailed yet" and keep the access code safe (it is already stored). */
function sendMail(message) {
  var cfg = config();
  if (cfg.error) return Promise.reject(new Error(cfg.error));
  if (!message || !text(message.to, 320)) return Promise.reject(new Error("No recipient address was supplied."));
  if (cfg.apiUrl) return relaySend(cfg, message);
  if (!cfg.host) {
    return Promise.reject(new Error("Email delivery is not configured on this server " +
      "(set NT_SMTP_HOST/NT_SMTP_URL and NT_MAIL_FROM, or NT_MAIL_API_URL)."));
  }
  if (!cfg.from) return Promise.reject(new Error("NT_MAIL_FROM is not set, so the sender address is unknown."));
  var built = buildMessage(cfg, message);
  return smtpSend(cfg, { envelopeFrom: built.envelopeFrom, to: message.to, data: built.data });
}

module.exports = {
  config: config,
  describe: describe,
  isConfigured: isConfigured,
  buildMessage: buildMessage,
  sendMail: sendMail
};
