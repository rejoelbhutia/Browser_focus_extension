/*
 * browser-polyfill.js
 * -------------------
 * Creates a global `browserAPI` with a Promise-based storage interface
 * that works in Brave, Chrome, Edge, Firefox, and Safari.
 *
 * Root problem:
 *   Brave/Chrome/Edge  → only `chrome` exists, storage uses callbacks
 *   Firefox/Safari     → only `browser` exists, storage uses Promises
 *
 * Previous versions tried to auto-detect which style by calling .get()
 * at document_start — this crashed in Brave because the extension context
 * is not fully ready that early.
 *
 * Fix: we simply check whether `browser` (the Promise-based API) exists.
 * If yes, use it. If no, wrap `chrome`'s callbacks in Promises manually.
 * No test call needed — no crash.
 */

var browserAPI = (function () {

  /* ── Firefox / Safari: `browser` global exists and is Promise-based ── */
  if (typeof browser !== "undefined" && browser.storage) {
    return browser;
  }

  /* ── Brave / Chrome / Edge: only `chrome` exists, uses callbacks ── */
  if (typeof chrome !== "undefined" && chrome.storage) {

    return {
      storage: {
        local: {

          /*
           * Wraps chrome.storage.local.get(keys, callback)
           * into a Promise so callers can use .then()/.catch()
           */
          get: function (keys) {
            return new Promise(function (resolve, reject) {
              chrome.storage.local.get(keys, function (result) {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(result);
                }
              });
            });
          },

          /*
           * Wraps chrome.storage.local.set(items, callback)
           * into a Promise
           */
          set: function (items) {
            return new Promise(function (resolve, reject) {
              chrome.storage.local.set(items, function () {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          }

        },

        /*
         * onChanged works identically in all browsers (addListener-based),
         * so we pass it through directly without wrapping.
         */
        onChanged: chrome.storage.onChanged
      }
    };
  }

  /* ── Neither API found — extension is not running in a browser ── */
  console.error("[YT Focus] No browser extension API found.");
  return null;

}()); /* immediately-invoked function keeps internals private */