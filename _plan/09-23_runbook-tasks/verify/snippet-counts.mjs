// Phase 1 regression check (plan §5 Task 1.9, §10 "Regression check").
// Compares the "Show and copy" snippet count of every runbook step that exists in BOTH seeds.
// New steps are ignored; a pre-existing step whose count changed is a regression.
//   node snippet-counts.mjs <base.json> <branch.json>
// base.json   = node hosting/hub/build-seed.mjs <scratch>/head.json   (main tree, at the H1 commit)
// branch.json = the worktree's hosting/site/seed.json after a DryRun
// Exit 0: no differences. Exit 1: differences listed. Exit 2: bad input.
import { readFileSync } from 'node:fs';

const [basePath, branchPath] = process.argv.slice(2);
if (!basePath || !branchPath) {
  console.error('usage: node snippet-counts.mjs <base.json> <branch.json>');
  process.exit(2);
}

function counts(path) {
  const seed = JSON.parse(readFileSync(path, 'utf8'));
  const out = new Map();
  for (const p of seed.projects || []) {
    for (const st of (p.runbook && p.runbook.stages) || []) {
      for (const s of st.steps) out.set(`${p.key}/${s.id}`, (s.snippets || []).length);
    }
  }
  return out;
}

const base = counts(basePath);
const branch = counts(branchPath);
const changed = [];
const missing = [];
for (const [id, n] of base) {
  if (!branch.has(id)) missing.push(id);
  else if (branch.get(id) !== n) changed.push(`${id}: ${n} -> ${branch.get(id)}`);
}
const added = [...branch.keys()].filter((id) => !base.has(id));

console.log(`base ${base.size} steps · branch ${branch.size} steps · ${added.length} new (ignored)`);
if (missing.length) console.log(`MISSING from branch (a step id was removed or renamed):\n  ${missing.join('\n  ')}`);
if (changed.length) console.log(`CHANGED snippet counts:\n  ${changed.join('\n  ')}`);
if (missing.length || changed.length) process.exit(1);
console.log('no differences for pre-existing steps');
