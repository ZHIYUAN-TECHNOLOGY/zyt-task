/**
 * The Golden path panel, shared by the dashboard and the SOP pages.
 *
 * It asks `hosting/runner/server.mjs` on the viewer's OWN machine
 * (127.0.0.1:4317) to play one recorded journey headed and slowed down,
 * streams each `test.step` into the page as it happens, and shows the
 * recording at the end. Nothing here reaches anyone else's computer: the
 * runner listens on loopback only and answers this site's origin alone.
 *
 * EVERY request carries `targetAddressSpace: 'loopback'`. Chrome 142+ (Local
 * Network Access) blocks a public page from reaching 127.0.0.1 unless the
 * request opts in — without it the fetch fails at once with a bare "Failed to
 * fetch". That is also why progress arrives on a STREAMED FETCH rather than an
 * EventSource, and why the recording is fetched into a blob instead of being
 * pointed at with a `src`: neither of those can opt in.
 *
 * `create(job, opts)` hands back a node and keeps its own state, so a page may
 * mount more than one. Keep the node between re-renders: re-creating it
 * restarts a playing video and drops the run's history.
 */
(function () {
  var URL_BASE = 'http://127.0.0.1:4317';

  /** SOP → step number → the journey that covers it. Keyed by SOP (the first
   * path segment of its page, e.g. /nct/customer-intake-sop/ → 'nct') so one
   * SOP's recordings never show on another's steps. A step outside the map
   * returns null, and the caller shows nothing rather than a dead button. Keep
   * in step with `JOBS` in hosting/runner/server.mjs. */
  var BY_STEP = {
    nct: [
      { from: 1, to: 3, job: 'nct-intake-steps-1-3', covers: 'steps 1–3' },
      { from: 4, to: 7, job: 'nct-quote-build-steps-4-7', covers: 'steps 4–7' },
      { from: 8, to: 10, job: 'nct-quote-decide-steps-8-10', covers: 'steps 8–10' },
      { from: 11, to: 15, job: 'nct-order-open-steps-11-15', covers: 'steps 11–15' },
      { from: 16, to: 19, job: 'nct-bl-run-steps-16-19', covers: 'steps 16–19' },
      { from: 20, to: 23, job: 'nct-bill-build-steps-20-23', covers: 'steps 20–23' },
      { from: 24, to: 27, job: 'nct-invoice-close-steps-24-27', covers: 'steps 24–27' },
    ],
  };

  /** The seeded e2e actor keys (nct-layout e2e/fixtures/seed-cli.ts ACTORS),
   * as a person would name the screen. */
  var ROLE_LABELS = {
    owner: 'Owner',
    salesperson: 'Salesperson',
    managerA: 'Branch manager',
    managerB: 'Second branch manager',
    accountant: 'Accountant',
    directorA: 'Director',
    directorB: 'Second director',
    viewer: 'Viewer',
  };
  function roleLabel(role) { return ROLE_LABELS[role] || role || ''; }

  function jobForStep(n, sop) {
    var list = BY_STEP[sop] || [];
    for (var i = 0; i < list.length; i++) {
      if (n >= list[i].from && n <= list[i].to) return list[i];
    }
    return null;
  }

  /** Minimal DOM builder — this file cannot borrow the host page's. Text only
   * ever arrives through textContent. */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }

  function create(job, opts) {
    opts = opts || {};
    var S = {
      job: job,
      title: null,
      reach: 'unknown',
      run: null,
      steps: [],
      end: null,
      note: '',
      busy: false,
      streaming: false,
      // The run's clips, one per person on screen: { src, role, local }.
      clips: [],
      ci: 0,
      // Runner clip src → blob URL (or 'loading').
      blobs: {},
      // Where the recording on screen came from: 'live' (a run now), 'local'
      // (the runner's save on this computer) or 'published' (on the site).
      source: null,
    };
    var node = h('section', { class: 'gp' + (opts.className ? ' ' + opts.className : '') });

    // `ms` is generous for anything a click started: Chrome asks for local
    // network access on the first request, and the fetch hangs until the
    // person answers that prompt.
    function req(path, init, ms) {
      var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, ms || 3000);
      init = init || {};
      init.signal = ctl.signal;
      init.targetAddressSpace = 'loopback';
      return fetch(URL_BASE + path, init).finally(function () { clearTimeout(timer); });
    }

    function check(asked) {
      S.busy = true;
      if (asked) { S.note = 'Asking this computer… if Chrome asks to allow local network access, allow it.'; paint(); }
      req('/health', null, asked ? 60000 : 3000)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          // `jobs` is a list of { id, title }; an older runner sends bare ids.
          var jobs = (d.jobs || []).map(function (j) { return typeof j === 'string' ? { id: j } : j; });
          var mine = jobs.filter(function (j) { return j.id === S.job; })[0];
          S.title = mine && mine.title;
          S.reach = mine ? 'up' : 'nojob';
          if (d.run && d.run.job === S.job) connect();
          else if (mine && !S.end) loadLast();
          S.note = '';
        })
        .catch(function () { S.reach = 'down'; S.note = asked ? 'No answer from the runner on this computer.' : ''; })
        .finally(function () { S.busy = false; paint(); });
    }

    // The last finished run of this journey, as the runner saved it. Shown until
    // someone regenerates it; a runner restart does not lose it.
    function loadLast() {
      req('/last/' + encodeURIComponent(S.job), null, 5000)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (last) {
          if (!last || (S.run && S.run.status === 'running')) return;
          // A published recording stays on screen unless this one is newer.
          if (S.source === 'published' && S.end && S.end.at >= last.finishedAt) return;
          S.source = 'local';
          S.run = { id: 'saved', status: last.status, startedAt: last.startedAt };
          S.steps = last.steps || [];
          S.end = { status: last.status, at: last.finishedAt, output: last.output };
          setClips((last.videos || []).map(function (v) { return { src: v.src, role: v.role, local: true }; }));
          paint();
        })
        .catch(function () {});
    }

    // The recording published on the site: same origin, so no runner and no
    // loopback opt-in. Anyone who opens the page sees it, on any machine.
    function loadPublished() {
      fetch('/golden-paths/' + encodeURIComponent(S.job) + '.json', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (pub) {
          if (!pub || S.source === 'live' || S.source === 'local') return;
          S.source = 'published';
          S.run = { id: 'published', status: pub.status, startedAt: pub.startedAt };
          S.steps = pub.steps || [];
          S.end = { status: pub.status, at: pub.finishedAt };
          // Plain srcs: same origin needs no blob, and the video streams.
          setClips((pub.videos || []).map(function (v) {
            return { src: '/golden-paths/' + encodeURIComponent(S.job) + '-' + v.i + '.mp4', role: v.role, local: false };
          }));
          paint();
        })
        .catch(function () {});
    }

    function connect() {
      if (S.streaming) return;
      S.streaming = true;
      fetch(URL_BASE + '/events', { targetAddressSpace: 'loopback' })
        .then(function (r) {
          var reader = r.body.getReader(), decoder = new TextDecoder(), buffer = '';
          function pump() {
            return reader.read().then(function (chunk) {
              if (chunk.done) { S.streaming = false; return; }
              buffer += decoder.decode(chunk.value, { stream: true });
              var cut;
              while ((cut = buffer.indexOf('\n\n')) >= 0) {
                buffer.slice(0, cut).split('\n').forEach(function (line) {
                  if (line.indexOf('data: ') === 0) event(line.slice(6));
                });
                buffer = buffer.slice(cut + 2);
              }
              return pump();
            });
          }
          return pump();
        })
        .catch(function () { S.streaming = false; S.reach = 'down'; paint(); });
    }

    function event(raw) {
      var e; try { e = JSON.parse(raw); } catch (err) { return; }
      if (e.job && e.job !== S.job) return;
      if (e.type === 'run-start') { S.run = { id: e.runId, status: 'running', startedAt: e.at }; S.steps = []; S.end = null; S.note = ''; S.source = 'live'; }
      else if (e.type === 'log') S.note = e.text;
      else if (e.type === 'test-begin') S.note = 'Browser open — watch the new window.';
      else if (e.type === 'step-begin') S.steps.push({ title: e.title, state: 'running' });
      else if (e.type === 'step-end') {
        var s = S.steps.filter(function (x) { return x.title === e.title && x.state === 'running'; })[0];
        if (s) { s.state = e.ok ? 'ok' : 'fail'; s.error = e.error; s.ms = e.durationMs; }
      } else if (e.type === 'run-end') {
        S.end = e; if (S.run) S.run.status = e.status; S.note = '';
        S.steps.forEach(function (x) { if (x.state === 'running') x.state = 'fail'; });
        setClips((e.videos || []).map(function (v) { return { src: v.src, role: v.role, local: true }; }));
      }
      paint();
    }

    // A journey with several people has one clip per person, labelled by the
    // role whose screen it is; the first is shown until another is picked.
    function setClips(clips) {
      S.clips = clips;
      S.ci = 0;
      if (clips.length) loadClip(clips[0]);
    }

    // A runner clip is fetched and handed to the <video> as a blob, because an
    // element cannot opt in to a loopback request; a published clip is same
    // origin and plays from its URL.
    function loadClip(clip) {
      if (!clip.local || S.blobs[clip.src]) return;
      S.blobs[clip.src] = 'loading';
      req(clip.src, null, 30000)
        .then(function (r) { return r.ok ? r.blob() : null; })
        .then(function (b) {
          if (!b) { delete S.blobs[clip.src]; return; }
          S.blobs[clip.src] = window.URL.createObjectURL(b);
          paint();
        })
        .catch(function () { delete S.blobs[clip.src]; });
    }

    function clipUrl(clip) {
      if (!clip.local) return clip.src;
      var u = S.blobs[clip.src];
      return u && u !== 'loading' ? u : null;
    }

    function start() {
      S.busy = true; S.note = 'Starting…'; paint();
      req('/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job: S.job }) }, 60000)
        .then(function (r) { return r.json().then(function (d) { return { code: r.status, d: d }; }); })
        .then(function (x) {
          S.reach = 'up';
          if (x.code === 409) S.note = 'A run is already in progress.';
          else if (x.code !== 202) S.note = (x.d && x.d.error) || 'The runner refused the run.';
          connect();
        })
        .catch(function () { S.reach = 'down'; S.note = ''; })
        .finally(function () { S.busy = false; paint(); });
    }

    function stop() {
      req('/stop', { method: 'POST' }).catch(function () {}).finally(paint);
    }

    function paint() {
      var running = S.run && S.run.status === 'running';
      var clip = S.clips[S.ci] || null;
      var oldVideo = node.querySelector('video');
      // The same clip keeps its element, so a repaint does not restart it.
      var keepVideo = oldVideo && clip && oldVideo.dataset.src === clip.src ? oldVideo : null;
      node.textContent = '';

      if (opts.heading !== false) append(node, h('h3', { text: 'Golden path' }));
      if (S.title && opts.showTitle !== false) append(node, h('p', { class: 'gp-title', text: S.title }));
      append(node, h('p', { class: 'gp-blurb', text: opts.blurb || 'Plays this journey in a browser window on this computer, slowed down so you can follow it. It uses a throwaway test organization on the dev database and removes it afterwards.' }));

      var up = S.reach === 'up';
      if (up) append(node, h('div', { class: 'gp-actions' },
        h('button', { type: 'button', class: 'gp-run', disabled: running || S.busy, onclick: start },
          running ? 'Running…' : S.end ? (opts.regenLabel || '↻ Regenerate') : (opts.runLabel || '▶ Run golden path')),
        running ? h('button', { type: 'button', class: 'gp-stop', onclick: stop }, 'Stop') : null));
      else if (S.reach === 'unknown' && !S.end) {
        append(node, h('p', { class: 'gp-blurb gp-note', text: 'Looking for the runner on this computer…' }));
      }

      if (S.note) append(node, h('p', { class: 'gp-blurb gp-note', role: 'status', text: S.note }));

      if (S.steps.length) {
        append(node, h('ol', { class: 'gp-steps' }, S.steps.map(function (s) {
          return h('li', { class: 'gp-' + s.state },
            h('span', { class: 'gp-mark', 'aria-hidden': 'true', text: s.state === 'ok' ? '✓' : s.state === 'fail' ? '✗' : '…' }),
            h('span', null, h('span', { text: s.title }), s.error ? h('small', { class: 'gp-err', text: s.error }) : null),
            s.ms != null ? h('time', { text: (s.ms / 1000).toFixed(1) + ' s' }) : null);
        })));
      }

      if (S.end) {
        var secs = S.run ? Math.round((S.end.at - S.run.startedAt) / 1000) : null;
        var word = { passed: 'Passed', failed: 'Failed', stopped: 'Stopped' }[S.end.status] || S.end.status;
        append(node, h('p', { class: 'gp-result gp-' + S.end.status, role: 'status', text: word + (secs != null ? ' · ' + secs + ' s' : '') }));
        if ((S.source === 'local' || S.source === 'published') && S.end.at) {
          var when = new Date(S.end.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          append(node, h('p', { class: 'gp-blurb gp-when', text: S.source === 'published'
            ? 'Recorded ' + when + ' · published on this site.'
            : 'Recorded ' + when + ' on this computer. Regenerate to record it again.' }));
        }
        if (S.end.error) append(node, h('p', { class: 'gp-err', text: S.end.error }));
        if (S.end.output) append(node, h('pre', { class: 'gp-out', text: S.end.output }));
        if (S.clips.length > 1) {
          // One clip per person: whose screen to watch.
          append(node, h('div', { class: 'gp-clips', role: 'group', 'aria-label': 'Whose screen' }, S.clips.map(function (c, i) {
            return h('button', {
              type: 'button',
              class: 'gp-clip',
              'aria-pressed': String(i === S.ci),
              onclick: function () { S.ci = i; loadClip(c); paint(); },
            }, roleLabel(c.role) || 'Screen ' + (i + 1));
          })));
        }
        var url = clip && clipUrl(clip);
        if (url) {
          append(node, keepVideo || h('video', { class: 'gp-video', controls: true, preload: 'metadata', src: url, 'data-src': clip.src }));
        } else if (clip) {
          append(node, h('p', { class: 'gp-blurb', text: 'Fetching the recording…' }));
        }
      }
      if (S.reach === 'down' || S.reach === 'nojob') {
        append(node, h('div', { class: 'gp-off' },
          h('p', { text: S.reach === 'nojob'
            ? 'The runner on this computer doesn’t know this journey. Restart it:'
            : (S.end ? 'To play it again live or regenerate it, start the runner in C:\\Project\\ZYT-Task:' : 'The runner isn’t running on this computer. Start it in C:\\Project\\ZYT-Task:') }),
          h('code', { class: 'gp-cmd', text: 'node hosting/runner/server.mjs' }),
          h('p', { class: 'gp-blurb', text: 'Already started it? Chrome asks once before a website may reach this computer — press Check again and allow it.' }),
          h('button', { type: 'button', class: 'gp-retry', disabled: S.busy, onclick: function () { check(true); } }, 'Check again')));
      }
    }

    loadPublished();
    if (S.reach === 'unknown' && !S.busy) check();
    paint();
    return { node: node, refresh: function () { if (!S.busy) check(); } };
  }

  window.ZytGoldenPath = { create: create, jobForStep: jobForStep, url: URL_BASE };
})();
