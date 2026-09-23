// Local golden-path runner for the ZYT dashboard (admin.zhiyuantech.ai).
//
// The dashboard is a static page; it cannot start a browser. This small server,
// run on the machine that has the NCT repo, starts a HEADED, slowed-down
// Playwright run when a runbook step's "Run golden path" button is pressed, and
// streams each test.step back to the page as it happens.
//
//   node hosting/runner/server.mjs
//
// Safety:
// - listens on 127.0.0.1 only, so nothing off this machine can reach it;
// - every route except /video checks Origin against ALLOWED_ORIGINS, so other
//   websites open in the same browser cannot start a run (the dashboard itself
//   is public, but a visitor's click only reaches THEIR OWN localhost);
// - one run at a time; jobs are a fixed list below, never a command from the page;
// - the e2e suite seeds its own organization, refuses the production database,
//   and tears the organization down afterwards.
//
// Env: NCT_DIR (default C:/Project/NCT/nct-layout), RUNNER_PORT (4317),
// RUNNER_SLOWMO ms (600), RUNNER_EXTRA_ORIGINS (comma list, e.g. a local -DryRun preview).

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NCT_DIR = process.env.NCT_DIR || 'C:/Project/NCT/nct-layout';
const PORT = Number(process.env.RUNNER_PORT || 4317);
const SLOWMO = String(process.env.RUNNER_SLOWMO || 600);
const ALLOWED_ORIGINS = new Set([
  'https://admin.zhiyuantech.ai',
  ...(process.env.RUNNER_EXTRA_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);

// The last finished run of each job, kept beside this file so a restart of the
// runner — or a terminal run of the suite, which clears e2e/out/ before it
// writes — cannot take the recording away. <job>.json holds the verdict and
// the step list, <job>.mp4 the video. One per job: a new run replaces it.
const RUNS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'runs');
mkdirSync(RUNS_DIR, { recursive: true });
const savedJson = (jobId) => join(RUNS_DIR, `${jobId}.json`);
const savedVideo = (jobId) => join(RUNS_DIR, `${jobId}.mp4`);

function readSaved(jobId) {
  try { return JSON.parse(readFileSync(savedJson(jobId), 'utf8')); } catch { return null; }
}

// Job id -> what to run. The dashboard names a job by id (a runbook step's `run` field).
const JOBS = {
  'nct-intake-steps-1-3': {
    title: 'NCT · SOP steps 1–3 golden path',
    args: ['playwright', 'test', '--config', 'e2e/playwright.config.ts', '--project', 'intake', '--headed'],
    video: 'e2e/out/email/intake-golden-path/video.mp4',
  },
  'nct-quote-build-steps-4-7': {
    title: 'NCT · SOP steps 4–7 golden path',
    args: ['playwright', 'test', '--config', 'e2e/playwright.config.ts', '--project', 'quote-build', '--headed'],
    video: 'e2e/out/quotation/quote-build-golden-path/video.mp4',
  },
  'nct-quote-decide-steps-8-10': {
    title: 'NCT · SOP steps 8–10 golden path',
    args: ['playwright', 'test', '--config', 'e2e/playwright.config.ts', '--project', 'quote-decide', '--headed'],
    video: 'e2e/out/quotation/quote-decide-golden-path/video.mp4',
  },
  'nct-order-open-steps-11-15': {
    title: 'NCT · SOP steps 11–15 golden path',
    args: ['playwright', 'test', '--config', 'e2e/playwright.config.ts', '--project', 'order-open', '--headed'],
    video: 'e2e/out/collective-shipping/order-open-golden-path/video.mp4',
  },
  'nct-bl-run-steps-16-19': {
    title: 'NCT · SOP steps 16–19 golden path',
    args: ['playwright', 'test', '--config', 'e2e/playwright.config.ts', '--project', 'lading-run', '--headed'],
    video: 'e2e/out/lading/bl-run-golden-path/video.mp4',
  },
  'nct-bill-build-steps-20-23': {
    title: 'NCT · SOP steps 20–23 golden path',
    args: ['playwright', 'test', '--config', 'e2e/playwright.config.ts', '--project', 'bill-build', '--headed'],
    video: 'e2e/out/expense/bill-build-golden-path/video.mp4',
  },
  'nct-invoice-close-steps-24-27': {
    title: 'NCT · SOP steps 24–27 golden path',
    args: ['playwright', 'test', '--config', 'e2e/playwright.config.ts', '--project', 'invoice-close', '--headed'],
    video: 'e2e/out/expense/invoice-close-golden-path/video.mp4',
  },
};

// DATABASE_URL and BETTER_AUTH_SECRET come from the app's own server env, the same
// pair e2e/README.md tells a person to export. Read with the repo's own dotenv.
function nctEnv() {
  const dotenv = createRequire(join(NCT_DIR, 'package.json'))('dotenv');
  return dotenv.parse(readFileSync(join(NCT_DIR, 'apps/server/.env')));
}

let run = null; // { id, job, child, events: [], status: 'running'|'passed'|'failed'|'stopped', startedAt }
const listeners = new Set();

function publish(event) {
  const e = { ...event, at: Date.now() };
  run.events.push(e);
  for (const res of listeners) res.write(`data: ${JSON.stringify(e)}\n\n`);
}

function startRun(jobId) {
  const job = JOBS[jobId];
  const id = String(Date.now());
  run = { id, jobId, child: null, events: [], status: 'running', startedAt: Date.now() };
  publish({ type: 'run-start', runId: id, job: jobId, title: job.title });
  publish({ type: 'log', text: 'Starting the NCT app servers (about 30 s before the browser opens)…' });

  let env;
  try {
    env = { ...process.env, ...nctEnv(), E2E_STEP_EVENTS: '1', E2E_SLOWMO: SLOWMO };
    // Bun's server listens on $PORT when set. A launcher that sets PORT for THIS
    // runner would send the NCT API to the runner's port instead of :3000.
    delete env.PORT;
    delete env.BUN_PORT;
  } catch (err) {
    run.status = 'failed';
    publish({ type: 'run-end', status: 'failed', error: `Could not read ${NCT_DIR}/apps/server/.env: ${err.message}` });
    return;
  }

  const child = spawn('npx', job.args, { cwd: NCT_DIR, env, shell: true, windowsHide: true });
  run.child = child;
  const tail = [];
  let buffer = '';
  const onData = (chunk) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, '').replace(/\x1b\[[0-9;]*m/g, '');
      buffer = buffer.slice(nl + 1);
      if (line.startsWith('@@step ')) {
        try { publish(JSON.parse(line.slice(7))); } catch { /* partial line from a crash */ }
      } else if (line.trim() && !line.includes('will not be watched')) {
        tail.push(line);
        if (tail.length > 40) tail.shift();
      }
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('close', (code) => {
    const current = run;
    if (!current || current.id !== id) return;
    if (current.status === 'running') current.status = code === 0 ? 'passed' : 'failed';
    const recorded = join(NCT_DIR, job.video);
    let hasVideo = existsSync(recorded);
    // A stopped run keeps whatever was saved before it: half a journey is not
    // a recording worth replacing a whole one with.
    if (current.status !== 'stopped') {
      try {
        if (hasVideo) copyFileSync(recorded, savedVideo(jobId));
        writeFileSync(savedJson(jobId), JSON.stringify({
          job: jobId,
          title: job.title,
          status: current.status,
          startedAt: current.startedAt,
          finishedAt: Date.now(),
          steps: stepsOf(current.events),
          output: current.status === 'passed' ? undefined : tail.slice(-20).join('\n'),
          hasVideo,
        }, null, 2));
      } catch (err) {
        console.error('could not save the run:', err.message);
      }
    }
    hasVideo = hasVideo || existsSync(savedVideo(jobId));
    publish({
      type: 'run-end',
      status: current.status,
      exitCode: code,
      video: hasVideo ? `/video/${jobId}?v=${id}` : null,
      output: current.status === 'passed' ? undefined : tail.slice(-20).join('\n'),
    });
    current.child = null;
  });
}

/** The step list as the panel shows it, folded out of a run's events. */
function stepsOf(events) {
  const steps = [];
  for (const e of events) {
    if (e.type === 'step-begin') steps.push({ title: e.title, state: 'running' });
    if (e.type === 'step-end') {
      const s = steps.find((x) => x.title === e.title && x.state === 'running');
      if (s) Object.assign(s, { state: e.ok ? 'ok' : 'fail', error: e.error, ms: e.durationMs });
    }
  }
  for (const s of steps) if (s.state === 'running') s.state = 'fail';
  return steps;
}

// taskkill /T: the child is npx -> node -> playwright -> browser + two dev servers.
function stopRun() {
  if (!run?.child) return false;
  run.status = 'stopped';
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(run.child.pid), '/T', '/F']);
  else run.child.kill('SIGTERM');
  return true;
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Chrome's Private Network Access: a public page reaching 127.0.0.1 must be allowed explicitly.
  if (req.headers['access-control-request-private-network']) res.setHeader('Access-Control-Allow-Private-Network', 'true');
  return true;
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function summary() {
  return run ? { id: run.id, job: run.jobId, status: run.status, startedAt: run.startedAt } : null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (!cors(req, res)) return json(res, 403, { error: 'origin not allowed' });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // Chrome's Local Network Access blocks a <video src> pointing here (an element
  // cannot opt in), so the page fetches this and plays it as a blob — which makes
  // it a CORS request like every other, hence the check above.
  if (req.method === 'GET' && url.pathname.startsWith('/video/')) {
    const jobId = decodeURIComponent(url.pathname.slice(7));
    const job = JOBS[jobId];
    // The saved copy first: e2e/out/ is cleared by any run of the suite.
    const file = !job ? null : existsSync(savedVideo(jobId)) ? savedVideo(jobId) : join(NCT_DIR, job.video);
    if (!file || !existsSync(file)) return json(res, 404, { error: 'no video yet' });
    const size = statSync(file).size;
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : size - 1;
      res.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': size });
    return createReadStream(file).pipe(res);
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    // Objects, not bare ids: the dashboard shows each job's own title, so a page
    // deployed once does not have to know what a later job is called.
    return json(res, 200, {
      ok: true,
      jobs: Object.entries(JOBS).map(([id, job]) => ({ id, title: job.title })),
      run: summary(),
    });
  }

  // The last finished run of one job, for a panel opening with no run live.
  if (req.method === 'GET' && url.pathname.startsWith('/last/')) {
    const jobId = decodeURIComponent(url.pathname.slice(6));
    if (!JOBS[jobId]) return json(res, 404, { error: `unknown job: ${jobId}` });
    const saved = readSaved(jobId);
    if (!saved) return json(res, 404, { error: 'never run' });
    return json(res, 200, { ...saved, video: saved.hasVideo || existsSync(savedVideo(jobId)) ? `/video/${jobId}?v=${saved.finishedAt}` : null });
  }

  if (req.method === 'POST' && url.pathname === '/run') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1024) req.destroy(); });
    req.on('end', () => {
      let jobId;
      try { jobId = JSON.parse(body || '{}').job; } catch { return json(res, 400, { error: 'bad json' }); }
      if (!JOBS[jobId]) return json(res, 404, { error: `unknown job: ${jobId}` });
      if (run?.status === 'running') return json(res, 409, { error: 'a run is already in progress', run: summary() });
      startRun(jobId);
      json(res, 202, { run: summary() });
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/stop') {
    return json(res, stopRun() ? 200 : 409, { run: summary() });
  }

  // Server-sent events: replays the current run, then streams it live.
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Without it Chrome sniffs the first bytes and holds the stream: the page then
      // sees the opening events and nothing more until the run ends.
      'X-Content-Type-Options': 'nosniff',
    });
    // 2 KB of comment, for the same reason — it fills whatever buffer is waiting.
    res.write(`:${' '.repeat(2048)}\n\n`);
    for (const e of run?.events || []) res.write(`data: ${JSON.stringify(e)}\n\n`);
    listeners.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => { clearInterval(ping); listeners.delete(res); });
    return;
  }

  json(res, 404, { error: 'not found' });
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopRun(); process.exit(0); });
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ZYT golden-path runner on http://127.0.0.1:${PORT}`);
  console.log(`  NCT repo: ${NCT_DIR}`);
  console.log(`  accepts:  ${[...ALLOWED_ORIGINS].join(', ')}`);
});
