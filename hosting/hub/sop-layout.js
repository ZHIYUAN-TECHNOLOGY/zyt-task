/* NCT SOP page on admin.zhiyuantech.ai — hosted layout, appended by deploy-site.ps1 after the
   page's own scripts. customer-intake-sop.html (also the claude.ai artifact) is not edited.
   Everything here MOVES existing nodes, so the listeners the page bound by id keep working.
     1. Title block, phase index and "How they arrive" show in the chain pane while Step 01 is shown.
     2. The whole chain (chart + step pane) lives in a full-screen view opened by the tab on the
        right edge; it fits one window. The App URL sits above the step pane; the chart's intro
        paragraph and legend are removed.
     3. "The document" moves below "What to fix first".
     4. The ZYT top bar's theme button (same zyt.theme key as the dashboard). */
(function () {
  'use strict';
  function $(sel) { return document.querySelector(sel); }
  function make(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  // ── 4. theme ──
  var themeBtn = $('#zyt-theme');
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeBtn) themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#04061a' : '#ffffff');
  }
  applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('zyt.theme', next); } catch (e) { /* per-visit only */ }
      applyTheme(next);
    });
  }

  // ── 1. top block → Step 01's pane ──
  var pane = $('#chain-pane');
  var intro = make('div', 'zyt-intro');
  ['.masthead', 'nav.index', '#arrivals'].forEach(function (sel) {
    var el = $(sel);
    if (el) intro.appendChild(el);
  });

  function placeIntro() {
    if (!pane) return;
    var num = pane.querySelector('.cp-num');
    var isStep1 = !!num && num.textContent.trim() === 'Step 01';
    if (isStep1 && intro.parentNode !== pane) pane.insertBefore(intro, pane.firstChild);
    if (!isStep1 && intro.parentNode === pane) pane.removeChild(intro);
  }
  if (pane && intro.childNodes.length) {
    // the page rebuilds the pane (innerHTML = "") on every hover; put the block back for Step 01
    new MutationObserver(placeIntro).observe(pane, { childList: true });
    placeIntro();
  }

  // ── 2. the whole chain as a full-screen view ──
  var chain = $('.chain');
  var map = $('#map');
  var sheet = null, tab = null, closeBtn = null, lastFocus = null;

  function isOpen() { return !!sheet && !sheet.hidden; }

  function setPageInert(on) {
    ['.zyt-top', '.wrap'].forEach(function (sel) {
      var el = $(sel);
      if (el) { el.inert = on; if (on) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); }
    });
  }

  function openChain() {
    if (!sheet || isOpen()) return;
    lastFocus = document.activeElement;
    sheet.hidden = false;
    // a class, not an inline style: the step guide clears html.style.overflow when it closes
    document.documentElement.classList.add('zyt-chain-open');
    setPageInert(true);
    tab.setAttribute('aria-expanded', 'true');
    closeBtn.focus({ preventScroll: true });
  }

  function closeChain(restoreFocus) {
    if (!isOpen()) return;
    sheet.hidden = true;
    document.documentElement.classList.remove('zyt-chain-open');
    setPageInert(false);
    tab.setAttribute('aria-expanded', 'false');
    if (restoreFocus !== false) {
      var back = lastFocus && document.contains(lastFocus) && lastFocus !== document.body ? lastFocus : tab;
      back.focus({ preventScroll: true });
    }
  }

  if (chain) {
    sheet = make('div', 'zyt-chain');
    sheet.id = 'zyt-chain';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'The whole chain');
    sheet.hidden = true;

    // no header: the chart's intro paragraph and legend are dropped from this page
    ['#map > .lede', '#map > .map-legend'].forEach(function (sel) {
      var el = $(sel);
      if (el) el.remove();
    });

    closeBtn = make('button', 'zyt-chain-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close the whole chain');

    // right column = App URL + close above the step pane. The pane is rebuilt on every hover
    // (innerHTML = ""), so the form sits beside it rather than inside it.
    if (pane) {
      var side = make('div', 'zyt-side');
      var sideTools = make('div', 'zyt-side-tools');
      var appUrl = $('#baseurl');
      if (appUrl) sideTools.appendChild(appUrl);
      sideTools.appendChild(closeBtn);
      pane.parentNode.insertBefore(side, pane);
      side.appendChild(sideTools);
      side.appendChild(pane);
    } else {
      sheet.appendChild(closeBtn);
    }

    var body = make('div', 'zyt-chain-body');
    // role view: the page's "Show my flow" select sits just before .chain; keep it with the chart
    var roleSelect = chain.previousElementSibling;
    if (roleSelect && roleSelect.classList.contains('role-select')) body.appendChild(roleSelect);
    body.appendChild(chain);
    sheet.appendChild(body);
    document.body.appendChild(sheet);
    if (map) map.hidden = true;

    tab = make('button', 'zyt-chain-tab', 'The whole chain');
    tab.type = 'button';
    tab.setAttribute('aria-controls', 'zyt-chain');
    tab.setAttribute('aria-expanded', 'false');
    document.body.appendChild(tab);

    tab.addEventListener('click', openChain);
    closeBtn.addEventListener('click', function () { closeChain(); });

    // Esc closes the view — unless the step guide is open on top of it; that closes first.
    // Capture phase, so this sees the guide before the guide's own handler removes it.
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !isOpen() || document.querySelector('.sm-backdrop')) return;
      closeChain();
    }, true);

    // links from the pane to the document ("Open step 08 in the document") leave the view
    sheet.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (href === '#arrivals' || href === '#map') return; // already inside this view
      closeChain(false);
    });

    // "Repairs · Step 25" chips in What to fix first point at the chart: open the view first
    if (typeof window.chainFocus === 'function') {
      var focusInChart = window.chainFocus;
      window.chainFocus = function (kind, n) { openChain(); return focusInChart(kind, n); };
    }
  }

  // #arrivals (and #map) now live inside the view: open it, show Step 01, then scroll
  function followHash() {
    if (location.hash === '#map') { openChain(); return; }
    if (location.hash !== '#arrivals') return;
    openChain();
    if (window.SOP && window.SOP.showStep) window.SOP.showStep(1);
    // showStep empties the pane; the observer would re-insert the block a microtask later,
    // too late for the scroll below, so put it back now
    placeIntro();
    var target = $('#arrivals');
    if (target) target.scrollIntoView({ block: 'start' });
  }
  // A shared ?role= link means "show me my flow", and the role rail lives inside the view.
  // The page drops an unknown role from the URL on init, so only a real role opens it.
  function followRole() {
    var role = null;
    try { role = new URL(location.href).searchParams.get('role'); } catch (e) {}
    if (role) openChain();
  }
  followRole();
  followHash();
  // the browser's own jump to a hash happens around load; repeat once layout has settled
  window.addEventListener('load', function () { setTimeout(followHash, 60); });
  window.addEventListener('hashchange', followHash);

  // ── 5. Run the journey a step belongs to ──
  // The step guide already lists the golden path in words; this puts the
  // recorded one beside it. hub/golden-path.js maps the step number to a job
  // and owns the panel; steps with no journey yet (11–15) get nothing rather
  // than a dead button. The runner is on the viewer's own machine, so this is
  // dark for anyone who has not started it — which is the honest state.
  var runPanels = {};

  function addRunPanel(n) {
    if (!window.ZytGoldenPath || !n || isNaN(n)) return;
    var match = window.ZytGoldenPath.jobForStep(Number(n));
    if (!match) return;
    var backdrop = $('.sm-backdrop');
    if (!backdrop) return;
    var heads = backdrop.querySelectorAll('h4');
    var head = null;
    for (var i = 0; i < heads.length; i++) {
      if (/^golden path$/i.test(heads[i].textContent.trim())) { head = heads[i]; break; }
    }
    if (!head) return;
    if (!runPanels[match.job]) {
      runPanels[match.job] = window.ZytGoldenPath.create(match.job, {
        className: 'gp-inline',
        heading: false,
        showTitle: false,
        runLabel: '▶ Run ' + match.covers,
        regenLabel: '↻ Regenerate ' + match.covers,
        blurb: 'Plays ' + match.covers + ' — this step included — in a browser window on this computer, slowed down so you can follow it. It uses a throwaway test organization on the dev database and removes it afterwards.',
      });
    }
    var panel = runPanels[match.job].node;
    if (head.nextElementSibling === panel) return;
    head.after(panel);
  }

  // The page rebuilds the modal's contents for Prev, Next, the arrow keys and
  // every click on the chart, and none of those go through `openStepGuide`, so
  // the modal itself is watched instead of only the one entry point. Inserting
  // the panel is idempotent — it re-fires this observer, and the second pass
  // finds it already in place and stops.
  function watchModal(backdrop) {
    addRunPanel(stepShowing(backdrop));
    new MutationObserver(function () { addRunPanel(stepShowing(backdrop)); })
      .observe(backdrop, { childList: true, subtree: true });
  }

  function stepShowing(backdrop) {
    var num = backdrop.querySelector('.sm-num');
    return num ? parseInt(num.textContent, 10) : NaN;
  }

  new MutationObserver(function () {
    var backdrop = $('.sm-backdrop');
    if (backdrop && !backdrop.dataset.gpWatched) {
      backdrop.dataset.gpWatched = '1';
      watchModal(backdrop);
    }
  }).observe(document.body, { childList: true });

  // ── 3. The document below What to fix first ──
  var fixes = $('#fixes'), docHead = $('#document'), docBody = $('#doc-body');
  if (fixes && docHead && docBody && fixes.after) fixes.after(docHead, docBody);
})();
