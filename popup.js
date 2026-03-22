/*
 * popup.js — v2
 * Same browser detection as content.js.
 */

var storageGet;
var storageSet;

if (typeof browser !== "undefined" && browser.storage) {
  storageGet = function(d, cb) { browser.storage.local.get(d).then(cb).catch(console.error); };
  storageSet = function(i, cb) { browser.storage.local.set(i).then(function(){ if(cb)cb(); }).catch(console.error); };
} else if (typeof chrome !== "undefined" && chrome.storage) {
  storageGet = function(d, cb) {
    chrome.storage.local.get(d, function(r) { if (!chrome.runtime.lastError) cb(r); });
  };
  storageSet = function(i, cb) {
    chrome.storage.local.set(i, function() { if (!chrome.runtime.lastError && cb) cb(); });
  };
}

var DEFAULTS = { hideShorts: false, hideSidebar: false, hideHomepage: false, hideEndcards: false };
var savedTimer = null;

document.addEventListener("DOMContentLoaded", function() {

  /* Load saved settings and check the right toggles */
  if (storageGet) {
    storageGet(DEFAULTS, function(saved) {
      document.querySelectorAll("input[data-setting]").forEach(function(cb) {
        cb.checked = saved[cb.dataset.setting];
      });
    });
  }

  /* Save immediately when any toggle is flipped */
  document.querySelectorAll("input[data-setting]").forEach(function(checkbox) {
    checkbox.addEventListener("change", function() {
      if (!storageSet) return;
      var update = {};
      update[checkbox.dataset.setting] = checkbox.checked;
      storageSet(update, function() {
        /* Show "Saved!" briefly */
        var el = document.getElementById("save-status");
        el.textContent = "✓ Saved!";
        el.classList.add("visible");
        clearTimeout(savedTimer);
        savedTimer = setTimeout(function() { el.classList.remove("visible"); }, 1500);
      });
    });
  });

});