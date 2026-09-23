// Local golden-path runner for the ZYT dashboard (admin.zhiyuantech.ai).
//
// The dashboard is a static page; it cannot start a browser. This small server,
// run on the machine that has the NCT and JWA repos, starts a HEADED, slowed-down
// Playwright run when a runbook step's "Run golden path" button is pressed, and
// streams each test.step back to the page as it happens.
//
//   node hosting/runner/server.mjs
//
// Safety:
// - listens on 127.0.0.1 only, so nothing off this machine can reach it;
// - every route except /video checks Origin against ALLOWED_ORIGINS, so other
//   websites open in the same browser cannot start a run (the dashboard itself
//   is shared with clients, but a visitor's click only reaches THEIR OWN localhost);
// - one run at a time; jobs are a fixed list below, never a command from the page;
// - the e2e suite seeds its own organization, refuses the production database,
//   and tears the organization down afterwards.
//
// Env: NCT_DIR (default C:/Project/NCT/nct-layout), JWA_DIR (default
// C:/Project/JWASystemv2/jwa-golden), RUNNER_PORT (4317),
// RUNNER_SLOWMO ms (600), RUNNER_EXTRA_ORIGINS (comma list, e.g. a local -DryRun preview).

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NCT_DIR = process.env.NCT_DIR || 'C:/Project/NCT/nct-layout';
const JWA_DIR = process.env.JWA_DIR || 'C:/Project/JWASystemv2/jwa-golden';
const PORT = Number(process.env.RUNNER_PORT || 4317);
const SLOWMO = String(process.env.RUNNER_SLOWMO || 600);
const ALLOWED_ORIGINS = new Set([
  'https://admin.zhiyuantech.ai',
  ...(process.env.RUNNER_EXTRA_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);

// The last finished run of each job, kept beside this file so a restart of the
// runner — or a terminal run of the suite, which clears e2e/out/ before it
// writes — cannot take the recording away. <job>.json holds the verdict, the
// step list and the list of clips; <job>-<n>.mp4 are the clips. A journey with
// several people records one clip per person (one browser context each), so
// "the video" is a list, labelled by role. One run per job: a new run replaces it.
const RUNS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'runs');
mkdirSync(RUNS_DIR, { recursive: true });
const savedJson = (jobId) => join(RUNS_DIR, `${jobId}.json`);
const savedClip = (jobId, i) => join(RUNS_DIR, `${jobId}-${i}.mp4`);

/** The clips a run left in its e2e/out folder, in the order the reporter wrote
 * them, each with the role whose screen it is (meta.json `videoRoles`). */
function clipsOf(job) {
  const out = job.out;
  let meta = {};
  try { meta = JSON.parse(readFileSync(join(out, 'meta.json'), 'utf8')); } catch {}
  const names = meta.videos ?? (existsSync(join(out, 'video.mp4')) ? ['video.mp4'] : []);
  const clips = names
    .map((name, i) => ({ path: join(out, name), role: meta.videoRoles?.[i] ?? '' }))
    .filter((c) => existsSync(c.path));
  // NCT's reporter lists the LAST person first: Playwright tears fixtures down
  // in the reverse of their set-up order, and each role page files its video at
  // teardown. Each NCT golden path names its cast in story order, so reversing
  // puts the clips in the order the journey plays. JWA's golden fixture writes
  // story order itself and says so (`storyOrder: true`).
  return meta.storyOrder ? clips : clips.reverse();
}

/** Replace a job's saved clips with this run's. */
function saveClips(jobId, clips) {
  for (const f of readdirSync(RUNS_DIR)) {
    if (f.startsWith(`${jobId}-`) && f.endsWith('.mp4')) rmSync(join(RUNS_DIR, f));
  }
  clips.forEach((c, i) => copyFileSync(c.path, savedClip(jobId, i)));
  return clips.map((c, i) => ({ i, role: c.role }));
}

/** Runner URLs for a saved run's clips; `v` only defeats the browser cache. */
function clipUrls(jobId, videos, v) {
  return (videos ?? []).map((c) => ({ role: c.role, src: `/video/${encodeURIComponent(jobId)}/${c.i}?v=${v}` }));
}

function readSaved(jobId) {
  try { return JSON.parse(readFileSync(savedJson(jobId), 'utf8')); } catch { return null; }
}

// Job id -> what to run. The dashboard names a job by id (a runbook step's `run` field).
// NCT: npx playwright from the repo root, with the API's .env (DATABASE_URL, BETTER_AUTH_SECRET).
function nctJob(title, project, video) {
  return {
    title,
    repo: 'NCT',
    cwd: NCT_DIR,
    cmd: 'npx',
    args: ['playwright', 'test', '--config', 'e2e/playwright.config.ts', '--project', project, '--headed'],
    out: dirname(join(NCT_DIR, video)),
    env: nctEnv,
    starting: 'Starting the NCT app servers (about 30 s before the browser opens)…',
  };
}
// JWA: bunx playwright from apps/web (where @playwright/test is installed), against a web
// server of its own on :3700 and the shared dev Convex; the web app reads its own .env.
function jwaJob(title, project) {
  return {
    title,
    repo: 'JWA',
    cwd: join(JWA_DIR, 'apps/web'),
    cmd: 'bunx',
    args: ['playwright', 'test', '--config', '../../_e2e/golden.config.ts', '--project', project, '--headed'],
    out: join(JWA_DIR, '_e2e/golden-out', project),
    env: () => ({}),
    starting: 'Starting the JWA web app on :3700 (about 20 s before the browser opens)…',
  };
}

const JOBS = {
  'nct-intake-steps-1-3': nctJob('NCT · SOP steps 1–3 golden path', 'intake', 'e2e/out/email/intake-golden-path/video.mp4'),
  'nct-quote-build-steps-4-7': nctJob('NCT · SOP steps 4–7 golden path', 'quote-build', 'e2e/out/quotation/quote-build-golden-path/video.mp4'),
  'nct-quote-decide-steps-8-10': nctJob('NCT · SOP steps 8–10 golden path', 'quote-decide', 'e2e/out/quotation/quote-decide-golden-path/video.mp4'),
  'nct-order-open-steps-11-15': nctJob('NCT · SOP steps 11–15 golden path', 'order-open', 'e2e/out/collective-shipping/order-open-golden-path/video.mp4'),
  'nct-bl-run-steps-16-19': nctJob('NCT · SOP steps 16–19 golden path', 'lading-run', 'e2e/out/lading/bl-run-golden-path/video.mp4'),
  'nct-bill-build-steps-20-23': nctJob('NCT · SOP steps 20–23 golden path', 'bill-build', 'e2e/out/expense/bill-build-golden-path/video.mp4'),
  'nct-invoice-close-steps-24-27': nctJob('NCT · SOP steps 24–27 golden path', 'invoice-close', 'e2e/out/expense/invoice-close-golden-path/video.mp4'),
  'jwa-setup-steps-1-4': jwaJob('JWA · SOP steps 1–4 golden path', 'jwa-setup'),
  'jwa-raise-steps-5-8': jwaJob('JWA · SOP steps 5–8 golden path', 'jwa-raise'),
  'jwa-buy-steps-9-10': jwaJob('JWA · SOP steps 9–10 golden path', 'jwa-buy'),
  'jwa-receive-steps-11-14': jwaJob('JWA · SOP steps 11–14 golden path', 'jwa-receive'),
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
  publish({ type: 'log', text: job.starting });

  let env;
  try {
    env = { ...process.env, ...job.env(), E2E_STEP_EVENTS: '1', E2E_SLOWMO: SLOWMO };
    // Bun's server listens on $PORT when set. A launcher that sets PORT for THIS
    // runner would send the NCT API to the runner's port instead of :3000.
    delete env.PORT;
    delete env.BUN_PORT;
  } catch (err) {
    run.status = 'failed';
    publish({ type: 'run-end', status: 'failed', error: `Could not read the ${job.repo} env: ${err.message}` });
    return;
  }

  const child = spawn(job.cmd, job.args, { cwd: job.cwd, env, shell: true, windowsHide: true });
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
    // A stopped run keeps whatever was saved before it: half a journey is not
    // a recording worth replacing a whole one with.
    let videos = readSaved(jobId)?.videos ?? [];
    if (current.status !== 'stopped') {
      try {
        videos = saveClips(jobId, clipsOf(job));
        writeFileSync(savedJson(jobId), JSON.stringify({
          job: jobId,
          title: job.title,
          status: current.status,
          startedAt: current.startedAt,
          finishedAt: Date.now(),
          steps: stepsOf(current.events),
          output: current.status === 'passed' ? undefined : tail.slice(-20).join('\n'),
          videos,
          hasVideo: videos.length > 0,
        }, null, 2));
      } catch (err) {
        console.error('could not save the run:', err.message);
      }
    }
    publish({
      type: 'run-end',
      status: current.status,
      exitCode: code,
      videos: clipUrls(jobId, videos, id),
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
  // /video/<job>/<n>: one saved clip.
  if (req.method === 'GET' && url.pathname.startsWith('/video/')) {
    const [rawJob, rawIndex] = url.pathname.slice(7).split('/');
    const jobId = decodeURIComponent(rawJob ?? '');
    const i = Number(rawIndex);
    const file = JOBS[jobId] && Number.isInteger(i) && i >= 0 ? savedClip(jobId, i) : null;
    if (!file || !existsSync(file)) return json(res, 404, { error: 'no such clip' });
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
    return json(res, 200, { ...saved, videos: clipUrls(jobId, saved.videos, saved.finishedAt) });
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
  console.log(`  JWA repo: ${JWA_DIR}`);
  console.log(`  accepts:  ${[...ALLOWED_ORIGINS].join(', ')}`);
});
