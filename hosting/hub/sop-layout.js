/* NCT SOP page on admin.zhiyuantech.ai — hosted layout, appended by deploy-site.ps1 after the
   page's own scripts. customer-intake-sop.html (also the claude.ai artifact) is not edited.
   Everything here MOVES existing nodes, so the listeners the page bound by id keep working.
     1. Title block, phase index and "How they arrive" show in the chain pane while Step 01 is shown.
     2. "What to fix first" is removed; the whole chain (chart + step pane) sits in its place as
        a window-tall section. The App URL sits above the step pane; the chart's intro
        paragraph and legend are removed.
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

  // ── 2. the whole chain, inline where "What to fix first" was ──
  // The ranked-defects ledger is dropped from this page; the chart and step pane take its
  // place as a window-tall section, so no modal, edge tab or close button is needed.
  var chain = $('.chain');
  var map = $('#map');
  var fixes = $('#fixes');
  var sheet = null;

  function openChain() {
    if (sheet) sheet.scrollIntoView({ block: 'start' });
  }

  if (chain) {
    sheet = make('section', 'zyt-chain');
    sheet.id = 'zyt-chain';
    sheet.setAttribute('aria-label', 'The whole chain');

    // no header: the chart's intro paragraph and legend are dropped from this page
    ['#map > .lede', '#map > .map-legend'].forEach(function (sel) {
      var el = $(sel);
      if (el) el.remove();
    });

    // right column = App URL above the step pane. The pane is rebuilt on every hover
    // (innerHTML = ""), so the form sits beside it rather than inside it.
    if (pane) {
      var side = make('div', 'zyt-side');
      var sideTools = make('div', 'zyt-side-tools');
      var appUrl = $('#baseurl');
      if (appUrl) sideTools.appendChild(appUrl);
      pane.parentNode.insertBefore(side, pane);
      if (appUrl) side.appendChild(sideTools);
      side.appendChild(pane);
    }

    var body = make('div', 'zyt-chain-body');
    // role view: the page's "Show my flow" select sits just before .chain; keep it with the chart
    var roleSelect = chain.previousElementSibling;
    if (roleSelect && roleSelect.classList.contains('role-select')) body.appendChild(roleSelect);
    body.appendChild(chain);
    sheet.appendChild(body);
    // the hosted page showed What to fix first above The document; the chain takes that slot
    var anchor = $('#document') || fixes || map;
    if (anchor) anchor.parentNode.insertBefore(sheet, anchor);
    else document.body.appendChild(sheet);
    if (map) map.hidden = true;
  }
  if (fixes) fixes.remove();

  // #arrivals (and #map) now live inside the chain section: show Step 01, then scroll
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
  // A shared ?role= link means "show me my flow", and the role rail lives in the chain section.
  // The page drops an unknown role from the URL on init, so only a real role scrolls to it.
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

})();
