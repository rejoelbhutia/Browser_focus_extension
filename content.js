/*
 * content.js — v11
 *
 * PERFORMANCE FIX:
 * The MutationObserver was firing hundreds of times per second (on every
 * single DOM change), running expensive querySelectorAll calls each time.
 * This caused YouTube's search page to freeze on the loading spinner.
 *
 * Fix: throttle the observer with a debounce — it waits 300ms after the
 * last DOM change before running, so bursts of changes (like YouTube
 * rendering search results) only trigger ONE hide pass instead of hundreds.
 *
 * APPROACH:
 * 1. <style> tag injection — handles elements at load time (fast, zero JS cost)
 * 2. Debounced MutationObserver — catches dynamically added elements
 *    without hammering the CPU
 */

console.log("[YT Focus v11] starting...");


/* ─── STORAGE API ─────────────────────────────────────────────────────────── */

var storageGet, storageSet, storageOnChanged;

if (typeof browser !== "undefined" && browser.storage) {
  console.log("[YT Focus v11] API: browser (Firefox/Safari)");
  storageGet = function(d, cb) { browser.storage.local.get(d).then(cb).catch(console.error); };
  storageSet = function(i, cb) { browser.storage.local.set(i).then(function(){ if(cb)cb(); }).catch(console.error); };
  storageOnChanged = browser.storage.onChanged;

} else if (typeof chrome !== "undefined" && chrome.storage) {
  console.log("[YT Focus v11] API: chrome (Chrome/Brave/Edge)");
  storageGet = function(d, cb) {
    chrome.storage.local.get(d, function(r) { if (!chrome.runtime.lastError) cb(r); });
  };
  storageSet = function(i, cb) {
    chrome.storage.local.set(i, function() { if (!chrome.runtime.lastError && cb) cb(); });
  };
  storageOnChanged = chrome.storage.onChanged;

} else {
  console.error("[YT Focus v11] No storage API.");
}

if (!storageGet) throw new Error("[YT Focus] no storage API");


/* ─── DEFAULTS ────────────────────────────────────────────────────────────── */

var DEFAULTS = { hideShorts: false, hideSidebar: false, hideHomepage: false, hideEndcards: false };
var current  = Object.assign({}, DEFAULTS);


/* ─── LAYER 1: STYLE TAG ──────────────────────────────────────────────────── */
/*
 * Injecting a <style> tag is the most efficient way to hide elements.
 * The browser's CSS engine handles matching — no JS loop needed.
 * This handles elements that exist at load time at zero CPU cost.
 */

function updateStyleTag(s) {
  var css = [];

  if (s.hideShorts) {
    css.push(
      "ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2 { display:none!important }",
      "ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model) { display:none!important }",
      "ytd-rich-item-renderer:has(a[href*='/shorts/']) { display:none!important }",
      "ytd-rich-section-renderer { display:none!important }",
      "ytd-rich-shelf-renderer { display:none!important }",
      "ytd-video-renderer:has(a[href*='/shorts/']) { display:none!important }",
      "ytd-item-section-renderer:has(ytm-shorts-lockup-view-model) { display:none!important }",
      "grid-shelf-view-model:has(a[href*='/shorts/']) { display:none!important }",
      "ytd-guide-entry-renderer:has(a[href='/shorts']) { display:none!important }",
      "ytd-guide-entry-renderer:has(a[title='Shorts']) { display:none!important }",
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
}


/* ─── LAYER 2: DEBOUNCED JS HIDING ───────────────────────────────────────── */
/*
 * DEBOUNCE: instead of running on every DOM mutation, we wait 300ms
 * after the last mutation before doing anything. If YouTube adds 200
 * elements in a burst (search results loading), we run hideNow() ONCE
 * after it finishes — not 200 times.
 *
 * This is the key performance fix. The old code ran hideNow() on every
 * single mutation, which froze the page on heavy renders.
 */

var debounceTimer = null;

function scheduleHide() {
  /* Cancel any pending run and restart the 300ms countdown */
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function() {
    var anyOn = Object.keys(current).some(function(k) { return current[k]; });
    if (anyOn) hideNow(current);
  }, 300);
}


/* ─── HIDE ELEMENTS DIRECTLY ─────────────────────────────────────────────── */
/*
 * Fallback for elements the CSS engine missed (e.g. elements added after
 * the style tag was injected, or where :has() specificity loses).
 * Only runs once per debounce window — much cheaper than before.
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
/*
 * Watches for DOM changes but only SCHEDULES a hide pass — the actual
 * work happens 300ms later via the debounce. This means YouTube's renderer
 * can add hundreds of elements freely without being interrupted.
 */

var observer = new MutationObserver(function() {
  var anyOn = Object.keys(current).some(function(k) { return current[k]; });
  if (anyOn) scheduleHide();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree:   true,
});


/* ─── LOAD + APPLY ───────────────────────────────────────────────────────── */

function apply(s) {
  current = s;
  updateStyleTag(s);  /* instant — browser CSS engine does the work */
  hideNow(s);         /* JS pass for anything CSS missed */
}

function loadAndApply() {
  storageGet(DEFAULTS, function(saved) {
    console.log("[YT Focus v11] settings:", JSON.stringify(saved));
    apply(saved);
  });
}

storageOnChanged.addListener(function(changes, area) {
  if (area !== "local") return;
  loadAndApply();
});

document.addEventListener("yt-navigate-finish", loadAndApply);

loadAndApply();