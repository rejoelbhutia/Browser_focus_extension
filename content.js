/*
 * content.js — v10
 *
 * DUAL APPROACH:
 * 1. Inject a <style> tag — handles elements present at load time
 * 2. MutationObserver — directly hides elements added dynamically
 *    (YouTube re-renders content constantly; inline style via JS
 *     catches what CSS misses and vice versa)
 */

console.log("[YT Focus v10] starting...");


/* ─── STORAGE API ─────────────────────────────────────────────────────────── */

var storageGet, storageSet, storageOnChanged;

if (typeof browser !== "undefined" && browser.storage) {
  console.log("[YT Focus v10] API: browser");
  storageGet = function(d, cb) { browser.storage.local.get(d).then(cb).catch(console.error); };
  storageSet = function(i, cb) { browser.storage.local.set(i).then(function(){ if(cb)cb(); }).catch(console.error); };
  storageOnChanged = browser.storage.onChanged;
} else if (typeof chrome !== "undefined" && chrome.storage) {
  console.log("[YT Focus v10] API: chrome");
  storageGet = function(d, cb) {
    chrome.storage.local.get(d, function(r) { if(!chrome.runtime.lastError) cb(r); });
  };
  storageSet = function(i, cb) {
    chrome.storage.local.set(i, function() { if(!chrome.runtime.lastError && cb) cb(); });
  };
  storageOnChanged = chrome.storage.onChanged;
} else {
  console.error("[YT Focus v10] No storage API.");
}

if (!storageGet) throw new Error("[YT Focus] no storage API");


/* ─── DEFAULTS ────────────────────────────────────────────────────────────── */

var DEFAULTS = { hideShorts: false, hideSidebar: false, hideHomepage: false, hideEndcards: false };
var current  = Object.assign({}, DEFAULTS);


/* ─── LAYER 1: STYLE TAG ──────────────────────────────────────────────────── */
/*
 * Injects CSS rules into the page. Fast and persistent.
 * Uses :has() for complex selectors — supported in Brave/Chrome/Firefox.
 */

function updateStyleTag(s) {
  var css = [];

  if (s.hideShorts) {
    css.push(
      /* The shorts card itself */
      "ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2 { display:none!important }",
      /* Any grid item wrapping a shorts card or linking to /shorts/ */
      "ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model) { display:none!important }",
      "ytd-rich-item-renderer:has(a[href*='/shorts/']) { display:none!important }",
      /* Shelf rows */
      "ytd-rich-section-renderer { display:none!important }",
      "ytd-rich-shelf-renderer { display:none!important }",
      /* Search result rows linking to shorts */
      "ytd-video-renderer:has(a[href*='/shorts/']) { display:none!important }",
      /* Section wrapping a shorts shelf in search */
      "ytd-item-section-renderer:has(ytm-shorts-lockup-view-model) { display:none!important }",
      /* Grid shelf in search */
      "grid-shelf-view-model:has(a[href*='/shorts/']) { display:none!important }",
      /* Left nav: expanded sidebar */
      "ytd-guide-entry-renderer:has(a[href='/shorts']) { display:none!important }",
      "ytd-guide-entry-renderer:has(a[title='Shorts']) { display:none!important }",
      /* Left nav: mini collapsed sidebar */
      "ytd-mini-guide-entry-renderer:has(a[href='/shorts']) { display:none!important }",
      "ytd-mini-guide-entry-renderer:has(a[title='Shorts']) { display:none!important }"
    );
  }

  if (s.hideSidebar) {
    css.push(
      "#secondary { display:none!important }",
      "ytd-watch-next-secondary-results-renderer { display:none!important }"
    );
  }

  if (s.hideHomepage) {
    css.push(
      "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer { display:none!important }",
      "ytd-browse[page-subtype='home'] #primary::before { content:'🎯 Focus Mode — home feed hidden'; display:block; text-align:center; padding:80px 20px; font-size:18px; color:#aaa }"
    );
  }

  if (s.hideEndcards) {
    css.push(
      ".ytp-ce-element, .ytp-ce-covering-overlay, .ytp-endscreen-content, .ytp-endscreen-element { display:none!important }"
    );
  }

  var tag = document.getElementById("yt-focus-styles");
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "yt-focus-styles";
    (document.head || document.documentElement).appendChild(tag);
  }
  tag.textContent = css.join("\n");
  console.log("[YT Focus v10] style tag updated, rules:", css.length);
}


/* ─── LAYER 2: DIRECT JS HIDING ──────────────────────────────────────────── */
/*
 * Directly sets display:none on elements. Catches what CSS misses
 * (e.g. elements rendered after :has() is evaluated, or edge cases
 * where the CSS specificity loses to YouTube's inline styles).
 */

function hideNow(s) {
  if (s.hideShorts) {
    killAll("ytm-shorts-lockup-view-model");
    killAll("ytm-shorts-lockup-view-model-v2");
    killAll("ytd-rich-section-renderer");
    killAll("ytd-rich-shelf-renderer");
    killAll("ytd-rich-item-renderer", function(el) {
      return !!el.querySelector("ytm-shorts-lockup-view-model, a[href*='/shorts/']");
    });
    killAll("ytd-video-renderer", function(el) {
      return !!el.querySelector("a[href*='/shorts/']");
    });
    killAll("ytd-item-section-renderer", function(el) {
      return !!el.querySelector("ytm-shorts-lockup-view-model");
    });
    killAll("grid-shelf-view-model", function(el) {
      return !!el.querySelector("a[href*='/shorts/']");
    });
    /* Nav sidebar — exact href match */
    killAll("ytd-guide-entry-renderer", function(el) {
      return !!el.querySelector("a[href='/shorts'], a[title='Shorts']");
    });
    killAll("ytd-mini-guide-entry-renderer", function(el) {
      return !!el.querySelector("a[href='/shorts'], a[title='Shorts']");
    });
  }

  if (s.hideSidebar) {
    killAll("#secondary");
    killAll("ytd-watch-next-secondary-results-renderer");
  }

  if (s.hideHomepage) {
    var browse = document.querySelector("ytd-browse[page-subtype='home']");
    if (browse) {
      var grid = browse.querySelector("ytd-rich-grid-renderer");
      if (grid) grid.style.setProperty("display", "none", "important");
    }
  }

  if (s.hideEndcards) {
    killAll(".ytp-ce-element");
    killAll(".ytp-ce-covering-overlay");
    killAll(".ytp-endscreen-content");
    killAll(".ytp-endscreen-element");
  }
}

function killAll(sel, fn) {
  try {
    document.querySelectorAll(sel).forEach(function(el) {
      if (!fn || fn(el)) el.style.setProperty("display", "none", "important");
    });
  } catch(e) {}
}


/* ─── MUTATION OBSERVER ──────────────────────────────────────────────────── */

var observer = new MutationObserver(function() {
  var anyOn = Object.keys(current).some(function(k){ return current[k]; });
  if (anyOn) hideNow(current);
});

observer.observe(document.documentElement, { childList: true, subtree: true });


/* ─── LOAD + APPLY ───────────────────────────────────────────────────────── */

function apply(s) {
  current = s;
  updateStyleTag(s);
  hideNow(s);
}

function loadAndApply() {
  storageGet(DEFAULTS, function(saved) {
    console.log("[YT Focus v10] settings:", JSON.stringify(saved));
    apply(saved);
  });
}

storageOnChanged.addListener(function(changes, area) {
  if (area !== "local") return;
  loadAndApply();
});

document.addEventListener("yt-navigate-finish", loadAndApply);

loadAndApply();