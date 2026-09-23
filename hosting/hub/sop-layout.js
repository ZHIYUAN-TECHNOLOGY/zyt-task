/* NCT SOP page on admin.zhiyuantech.ai — hosted layout, appended by deploy-site.ps1 after the
   page's own scripts. customer-intake-sop.html (also the claude.ai artifact) is not edited.
   Everything here MOVES existing nodes, so the listeners the page bound by id keep working.
     1. The page is one section: a bar with the role tabs and the App URL, the steps as a
        vertical flow on the left, and the step guide the page builds for its modal shown
        inline on the right. The title block, phase index, "How they arrive", the chart,
        "What to fix first" and "The document" are removed.
     2. The step guide's Run panel (golden path) for the journey the step belongs to.
     3. The ZYT top bar's theme button (same zyt.theme key as the dashboard). */
(function () {
  'use strict';
  function $(sel) { return document.querySelector(sel); }
  function make(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // ── 3. theme ──
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

  // ── 2. Run the journey a step belongs to ──
  // The step guide already lists the golden path in words; this puts the
  // recorded one beside it. hub/golden-path.js maps the step number to a job
  // and owns the panel; steps with no journey get nothing rather than a dead button.
  var runPanels = {};

  function addRunPanel(box, n) {
    if (!window.ZytGoldenPath || !n || isNaN(n)) return;
    var match = window.ZytGoldenPath.jobForStep(Number(n));
    if (!match) return;
    var heads = box.querySelectorAll('h4');
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
    if (head.nextElementSibling !== panel) head.after(panel);
  }

  // ── 1. one section: role tabs + App URL, vertical flow, the step guide inline ──
  var SOP = window.SOP;
  var wrap = $('.wrap');
  if (!SOP || !SOP.STEP || !window.openStepGuide || !wrap) return;

  // what this page no longer shows
  ['.masthead', 'nav.index', '#arrivals', '#fixes'].forEach(function (sel) {
    var el = $(sel);
    if (el) el.remove();
  });
  // hidden rather than removed: the page's step records live in the document and the chart
  ['#map', '#document', '#doc-body'].forEach(function (sel) {
    var el = $(sel);
    if (el) { el.hidden = true; el.classList.add('zyt-gone'); }
  });

  var guide = make('section', 'zyt-guide');
  guide.id = 'zyt-guide';
  guide.setAttribute('aria-label', 'Steps');

  var bar = make('div', 'zg-bar');
  var rail = $('.role-rail');
  if (rail) {
    rail.classList.add('zg-roles');
    var railHead = rail.querySelector('.rr-head');
    if (railHead) railHead.classList.add('zg-sr');
    bar.appendChild(rail);
  }
  var appUrl = $('#baseurl');
  if (appUrl) { appUrl.classList.add('zg-url'); bar.appendChild(appUrl); }
  guide.appendChild(bar);

  var main = make('div', 'zg-main');
  var flow = make('nav', 'zg-flow');
  flow.setAttribute('aria-label', 'The whole chain, step by step');
  var host = make('div', 'zg-step');
  main.appendChild(flow);
  main.appendChild(host);
  guide.appendChild(main);
  wrap.insertBefore(guide, wrap.firstChild);

  // the flow: phases in order, each step a button, breaks between them where they fall
  var order = SOP.ORDER || Object.keys(SOP.STEP).map(Number).sort(function (a, b) { return a - b; });
  var nodes = {};
  var lastPhase = null;
  var list = null;
  order.forEach(function (n, i) {
    var s = SOP.STEP[n];
    if (!s) return;
    var ph = s.phase || {};
    if (ph.letter !== lastPhase) {
      lastPhase = ph.letter;
      var group = make('div', 'zg-phase');
      var h = make('div', 'zg-phase-head');
      h.appendChild(make('span', 'zg-phase-letter', ph.letter || ''));
      var ht = make('span', 'zg-phase-text');
      ht.appendChild(make('span', 'zg-phase-name', ph.name || ''));
      if (ph.who) ht.appendChild(make('span', 'zg-phase-who', ph.who));
      h.appendChild(ht);
      group.appendChild(h);
      list = make('ol', 'zg-steps');
      group.appendChild(list);
      flow.appendChild(group);
    }
    var li = make('li', 'zg-item');
    var chartNode = document.querySelector('.chain-canvas .cn[data-step="' + n + '"]');
    var cls = chartNode ? chartNode.getAttribute('class') || '' : '';
    var btn = make('button', 'zg-node' + (/\baside\b/.test(cls) ? ' aside' : '') + (/\bpitfall\b/.test(cls) ? ' pitfall' : ''));
    btn.type = 'button';
    btn.dataset.step = n;
    btn.appendChild(make('span', 'zg-num', pad(n)));
    btn.appendChild(make('span', 'zg-label', s.label));
    btn.addEventListener('click', function () { show(n, true); });
    li.appendChild(btn);
    var brk = SOP.BREAK && SOP.BREAK[n];
    if (brk) {
      var b = make('div', 'zg-break');
      b.appendChild(make('span', 'zg-break-mark', '‖'));
      b.appendChild(make('span', 'zg-break-label', 'Chain break · ' + brk.label));
      li.appendChild(b);
    }
    list.appendChild(li);
    nodes[n] = btn;
  });

  // Up/Down walk the flow
  flow.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var cur = e.target.closest && e.target.closest('.zg-node');
    if (!cur) return;
    var i = order.indexOf(Number(cur.dataset.step)) + (e.key === 'ArrowDown' ? 1 : -1);
    var n = order[i];
    if (n == null || !nodes[n]) return;
    e.preventDefault();
    nodes[n].focus();
    show(n, false);
  });

  // role tabs: the page's own buttons select the role; the flow dims steps that are not theirs
  var R = window.SOP_ROLE;
  function markRole() {
    var active = !!(R && R.active && R.active());
    order.forEach(function (n) {
      if (!nodes[n]) return;
      var mine = !active || (R.parts(n) || []).length > 0;
      nodes[n].classList.toggle('off', !mine);
    });
  }
  // the open step is rebuilt too, so its "your part" line follows the role
  function roleChanged() {
    markRole();
    if (current) window.openStepGuide(current);
  }
  guide.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.rr-btn')) setTimeout(roleChanged, 0);
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'role-select') setTimeout(roleChanged, 0);
  });

  // The page builds the step guide into a full-screen modal. Each time it does (a flow click,
  // Prev, Next), its box moves here and the empty modal is closed through its own Close button,
  // which also undoes the modal's scroll lock and key handler.
  var current = null;
  function adopt(backdrop) {
    var box = backdrop.querySelector('.sm');
    if (!box) return;
    box.removeAttribute('role');
    box.removeAttribute('aria-modal');
    var close = box.querySelector('[data-close]');
    host.innerHTML = '';
    host.appendChild(box);
    if (close) { close.click(); close.remove(); }
    var num = box.querySelector('.sm-num');
    var n = num ? parseInt(num.textContent, 10) : NaN;
    current = n;
    Object.keys(nodes).forEach(function (k) {
      var on = Number(k) === n;
      nodes[k].classList.toggle('on', on);
      if (on) nodes[k].setAttribute('aria-current', 'step'); else nodes[k].removeAttribute('aria-current');
    });
    var body = box.querySelector('.sm-body');
    if (body) body.scrollTop = 0;
    if (nodes[n]) nodes[n].scrollIntoView({ block: 'nearest' });
    addRunPanel(box, n);
  }
  new MutationObserver(function (records) {
    records.forEach(function (r) {
      r.addedNodes.forEach(function (node) {
        if (node.classList && node.classList.contains('sm-backdrop')) adopt(node);
      });
    });
  }).observe(document.body, { childList: true });

  function show(n, bringIntoView) {
    if (!SOP.STEP[n]) return;
    if (n !== current) window.openStepGuide(n);
    if (bringIntoView) {
      var top = guide.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight / 2) guide.scrollIntoView({ block: 'start' });
    }
  }

  // #step-5 / #s5 / #s05 open that step; anything else starts at step 1
  function stepFromHash() {
    var m = /^#(?:step-?|s)(\d+)$/i.exec(location.hash || '');
    return m ? Number(m[1]) : null;
  }
  markRole();
  show(stepFromHash() || order[0], false);
  window.addEventListener('hashchange', function () {
    var n = stepFromHash();
    if (n) show(n, true);
  });
})();
