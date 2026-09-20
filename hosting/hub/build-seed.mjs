// Builds the JSON the dashboard embeds: every project in hosting/hub/projects.json with
// its tasks, workstreams and flow from tracker/seed. Live tick state comes from Convex;
// this is the content and the offline fallback.
//   node hosting/hub/build-seed.mjs <out.json>
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const out = process.argv[2];
if (!out) throw new Error('usage: node build-seed.mjs <out.json>');

const read = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const registry = read('hosting/hub/projects.json');
// Pages a runbook step may link to: every listed page, plus each company's `unlisted` paths —
// pages deploy-site.ps1 builds but that are reached from a runbook rather than the page list.
const allHrefs = new Set(registry.flatMap((p) => [...p.pages.map((pg) => pg.href), ...(p.unlisted || [])]));
const projects = registry.map((p) => {
  const tasks = read(p.seed.tasks);
  const workstreams = read(p.seed.workstreams).map(({ visible, ...w }) => w);
  const flow = read(p.seed.flow);

  const known = new Set(tasks.map((t) => t.id));
  const covered = workstreams.flatMap((w) => w.covers);
  const unknown = covered.filter((k) => !known.has(k));
  const uncovered = tasks.filter((t) => !covered.includes(t.id)).map((t) => t.id);
  if (unknown.length || uncovered.length) {
    throw new Error(`${p.key}: workstreams cover unknown tasks [${unknown}] or miss tasks [${uncovered}]`);
  }

  // Runbook steps tick through the same Convex table as tasks, so their ids share one key space.
  const runbook = p.seed.runbook ? read(p.seed.runbook) : null;
  if (runbook) {
    const seen = new Set(known);
    const stepIds = new Set(runbook.stages.flatMap((st) => st.steps.map((s) => s.id)));
    for (const st of runbook.stages) {
      if (!st.steps.length) throw new Error(`${p.key}: runbook stage ${st.id} has no steps`);
      for (const s of st.steps) {
        if (seen.has(s.id)) throw new Error(`${p.key}: runbook step id ${s.id} is used twice (or by a task)`);
        seen.add(s.id);
        if (!['wilfred', 'session'].includes(s.owner)) throw new Error(`${p.key}: runbook step ${s.id} has owner "${s.owner}"`);
        const bad = (s.waitsFor || []).filter((k) => !stepIds.has(k));
        if (bad.length) throw new Error(`${p.key}: runbook step ${s.id} waits for unknown steps [${bad}]`);
        if (s.link && !allHrefs.has(s.link.split('#')[0])) {
          throw new Error(`${p.key}: runbook step ${s.id} links to ${s.link}, which is not a page in projects.json`);
        }
      }
    }
  }

  const pages = p.pages.map(({ source, ...page }) => ({
    ...page,
    updated: source ? statSync(join(root, source)).mtime.toISOString() : null,
  }));
  const { seed, unlisted, ...meta } = p;
  return { ...meta, pages, tasks, workstreams, runbook, flow: { phases: flow.phases, steps: flow.steps } };
});

// "<" escaped so the JSON can sit inside a <script> tag safely
const json = JSON.stringify({ projects }).replace(/</g, '\\u003c');
writeFileSync(out, json);
console.log(`seed: ${projects.map((p) => `${p.key} ${p.tasks.length} tasks / ${p.workstreams.length} workstreams${p.runbook ? ` / ${p.runbook.stages.reduce((n, st) => n + st.steps.length, 0)} runbook steps` : ''}`).join('; ')} (${json.length} bytes)`);
