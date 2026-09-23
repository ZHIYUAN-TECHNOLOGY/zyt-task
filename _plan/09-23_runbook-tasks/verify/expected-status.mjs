// Phase 3 fixture (plan §5 Task 3.12, §10 "Fixture"). Prints what the Tasks list must show for NCT,
// from the built seed and the live dev board, using the §4.6 rules written out independently of
// index.html, so the page can be checked against it.
//   node expected-status.mjs [--me <name>] [--what-if <step id>] [--repo <worktree>]
//                            [--seed <seed.json>] [--board <board.json>]
// --repo      the worktree whose hosting/site/seed.json and hosting/convex-app to use
//             (default: the current directory)
// --seed      a built seed.json (default: <repo>/hosting/site/seed.json, written by a DryRun)
// --board     a saved findings:board result instead of asking dev Convex
//             (default: npx convex run findings:board '{"projectKey":"nct"}' in <repo>/hosting/convex-app)
// --me        the name set in "Ticking as"; fills the My tasks column
// --what-if   also print the row of the task owning that step, as if <me or "you"> ticked it now
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1]; };
const repo = resolve(opt('--repo') || process.cwd());
const seedPath = opt('--seed') || join(repo, 'hosting', 'site', 'seed.json');
const boardPath = opt('--board');
const meArg = opt('--me');
const whatIf = opt('--what-if');

// the same rule as findings.ts / the name dialog, lower-cased for comparison
const norm = (s) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').toLowerCase() : '');

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const p = seed.projects.find((q) => q.key === 'nct');
if (!p || !p.runbook || !p.runbook.tasks) throw new Error(`${seedPath}: no nct runbook.tasks (run a DryRun on the Phase 3 branch first)`);

let board;
if (boardPath) board = JSON.parse(readFileSync(boardPath, 'utf8'));
else {
  const cwd = join(repo, 'hosting', 'convex-app');
  // JSON5 with single quotes: cmd.exe (shell: true on Windows) strips double quotes
  const r = spawnSync('npx', ['convex', 'run', 'findings:board', "{projectKey:'nct'}"], { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`npx convex run findings:board failed in ${cwd}:\n${r.stderr || r.stdout}`);
  board = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
}
const live = new Map(board.findings.map((f) => [f.key, f]));

// ── model (§4.6): tasks own whole stages; steps numbered 1..N per task ──
const stageById = new Map(p.runbook.stages.map((st) => [st.id, st]));
const byKey = new Map();
const tasks = p.runbook.tasks.map((t) => {
  const task = { ...t, steps: [] };
  for (const sid of t.stages) {
    for (const s of stageById.get(sid).steps) {
      const x = { ...s, waitsFor: s.waitsFor || [], task, stage: sid, n: task.steps.length + 1 };
      task.steps.push(x);
      byKey.set(x.id, x);
    }
  }
  return task;
});
const refFrom = (x, t) => (x.task === t ? String(x.n) : `${x.task.short} · ${x.n}`);

function run(me, overrides) {
  const liveOf = (x) => overrides.get(x.id) || live.get(x.id) || { state: 'open', updatedBy: null };
  const isDone = (x) => !!x && liveOf(x).state === 'done';
  const waiting = (s) => s.waitsFor.filter((k) => !isDone(byKey.get(k))).map((k) => byKey.get(k));
  const ready = (t) => t.steps.filter((s) => !isDone(s) && !waiting(s).length);
  function status(t) {
    const done = t.steps.filter(isDone).length;
    if (!t.steps.length) return 'none';
    if (done === t.steps.length) return 'done';
    const r = ready(t);
    if (r.length && r.every((s) => s.owner === 'wilfred')) return 'waiting';
    return done ? 'progress' : 'none';
  }
  const mine = (t) => !!me && t.steps.some((s) => norm(s.assignee) === me || (isDone(s) && norm(liveOf(s).updatedBy) === me));
  const LABEL = { none: 'Not started', done: 'Done', waiting: 'Waiting on Wilfred', progress: 'In progress' };
  return (t) => {
    const next = ready(t)[0];
    return {
      task: t.short,
      status: LABEL[status(t)],
      progress: `${t.steps.filter(isDone).length} / ${t.steps.length}`,
      next: next ? `${refFrom(next, t)} ${next.title}` : '—',
      needsWilfred: ready(t).some((s) => s.owner === 'wilfred') ? 'yes' : 'no',
      mine: me ? (mine(t) ? 'yes' : 'no') : '(no --me)',
      open: status(t) !== 'done',
    };
  };
}

function print(rows, heading) {
  const cols = [['task', 'Task'], ['status', 'Status'], ['progress', 'Done'], ['needsWilfred', 'Needs Wilfred'], ['mine', 'My tasks'], ['next', 'Next ready step']];
  const w = cols.map(([k, h]) => Math.max(h.length, ...rows.map((r) => String(r[k]).length)));
  console.log(heading);
  console.log(cols.map(([, h], i) => h.padEnd(w[i])).join('  '));
  console.log(w.map((n) => '-'.repeat(n)).join('  '));
  for (const r of rows) console.log(cols.map(([k], i) => String(r[k]).padEnd(w[i])).join('  '));
}

const me = norm(meArg);
const row = run(me, new Map());
const rows = tasks.map(row);
print(rows, `T0 · nct · ${new Date().toISOString()}${meArg ? ` · me "${meArg}"` : ''}`);
console.log(`\nchips: All ${rows.length} · Open ${rows.filter((r) => r.open).length} · Needs Wilfred ${rows.filter((r) => r.needsWilfred === 'yes').length}` +
  (me ? ` · My tasks ${rows.filter((r) => r.mine === 'yes').length}` : ''));

if (whatIf) {
  const x = byKey.get(whatIf);
  if (!x) throw new Error(`--what-if ${whatIf}: not a runbook step`);
  const after = run(me, new Map([[whatIf, { state: 'done', updatedBy: meArg || 'you' }]]))(x.task);
  const before = row(x.task);
  console.log('');
  print([before, after].map((r, i) => ({ ...r, task: `${r.task} ${i ? '(after)' : '(before)'}` })),
    `W · ${x.task.short} after ticking ${x.n} (${whatIf})${live.get(whatIf)?.state === 'done' ? ' [already done on the board]' : ''}`);
}
