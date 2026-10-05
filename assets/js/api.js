/* ============================================================
   NUCLEAR TUTORIALS — Content service client
   ------------------------------------------------------------
   Every university, semester, course and video lesson is read from
   (and written to) the server database through this module. Global
   content is never kept in localStorage: when an admin publishes a
   video, every student device sees it on the next page load.

   GET responses are cached for the lifetime of one page view so a
   page that needs the same list twice only asks once, and the cache
   is dropped as soon as an admin changes something.
   ============================================================ */
(function () {
  window.NT = window.NT || {};

  var cache = {};
  var pending = {};
  var listeners = [];

  function prefix() {
    return typeof NT.base === "function" ? NT.base() : "";
  }

  function resolve(path) {
    return prefix() + String(path || "").replace(/^\/+/, "");
  }

  function notify(event) {
    listeners.forEach(function (listener) {
      try { listener(event); } catch (error) { /* a listener must not break a request */ }
    });
  }

  function parse(response) {
    var type = response.headers.get("content-type") || "";
    if (type.indexOf("application/json") === -1) {
      return response.text().then(function (text) { return { message: text }; }, function () { return {}; });
    }
    return response.json().catch(function () { return {}; });
  }

  function request(method, path, body) {
    if (typeof window.fetch !== "function") {
      return Promise.reject({ status: 0, error: "unsupported", message: "This browser cannot reach the content service." });
    }
    var init = {
      method: method,
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store"
    };
    if (body !== undefined && body !== null) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    return window.fetch(resolve(path), init).then(function (response) {
      return parse(response).then(function (data) {
        if (!response.ok) {
          var failure = (data && typeof data === "object" ? data : {});
          failure.status = response.status;
          if (!failure.message) {
            failure.message = response.status === 401
              ? "Administrator sign-in required."
              : response.status === 404
                ? "That record no longer exists."
                : "The content service could not complete that request (" + response.status + ").";
          }
          throw failure;
        }
        return data;
      });
    }, function () {
      throw {
        status: 0,
        error: "unreachable",
        message: "Cannot reach the content service. Start it with `npm start`, then reload."
      };
    });
  }

  NT.api = {
    /* ---------- reads ---------- */
    get: function (path) { return request("GET", path); },

    peek: function (path) {
      return Object.prototype.hasOwnProperty.call(cache, path) ? cache[path] : null;
    },

    /* Cache-aware read: onData runs synchronously when the payload is
       already available (used by the render smoke tests) and otherwise
       after the request settles. onError is optional; rejections are
       always handled so no promise is ever left dangling. */
    load: function (path, onData, onError) {
      if (Object.prototype.hasOwnProperty.call(cache, path)) {
        if (onData) onData(cache[path]);
        return Promise.resolve(cache[path]);
      }
      if (!pending[path]) {
        pending[path] = request("GET", path).then(function (data) {
          cache[path] = data;
          delete pending[path];
          notify({ type: "loaded", path: path });
          return data;
        }, function (error) {
          delete pending[path];
          notify({ type: "error", path: path, error: error });
          throw error;
        });
      }
      return pending[path].then(function (data) {
        if (onData) onData(data);
        return data;
      }, function (error) {
        if (onError) onError(error);
        return null;
      });
    },

    /* ---------- writes (admin only) ---------- */
    save: function (method, path, body) {
      return request(method, path, body).then(function (data) {
        NT.api.flush();
        notify({ type: "saved", path: path });
        return data;
      });
    },
    post: function (path, body) { return NT.api.save("POST", path, body || {}); },
    patch: function (path, body) { return NT.api.save("PATCH", path, body || {}); },
    put: function (path, body) { return NT.api.save("PUT", path, body || {}); },
    remove: function (path) { return NT.api.save("DELETE", path, undefined); },
    move: function (path, direction) { return NT.api.save("POST", path + "/move", { direction: direction }); },

    /* ---------- cache control ---------- */
    prime: function (path, data) { cache[path] = data; },
    forget: function (path) { delete cache[path]; delete pending[path]; },
    flush: function () { cache = {}; pending = {}; },
    onChange: function (listener) { listeners.push(listener); },

    /* ---------- helpers ---------- */
    statusOf: function (error) { return error && error.status ? error.status : 0; },
    unreachable: function (error) { return NT.api.statusOf(error) === 0; },
    message: function (error, fallback) {
      return (error && error.message) || fallback || "Something went wrong.";
    },
    fieldErrors: function (error) { return (error && error.fields) || {}; },
    /* Builds "?a=1&b=2" from an object, skipping empty values. */
    query: function (params) {
      var search = new URLSearchParams();
      Object.keys(params || {}).forEach(function (key) {
        var value = params[key];
        if (value === null || value === undefined || value === "") return;
        search.set(key, String(value));
      });
      var out = search.toString();
      return out ? "?" + out : "";
    }
  };
})();
