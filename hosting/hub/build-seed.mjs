// Builds the JSON the dashboard embeds: every project in hosting/hub/projects.json with
// its tasks, workstreams and flow from tracker/seed. Live tick state comes from Convex;
// this is the content and the offline fallback.
//   node hosting/hub/build-seed.mjs <out.json> [--runbook <path>] [--public <dir>] [--report-snippets]
// --runbook <path>    use this runbook seed instead of projects.json's seed.runbook (the one project
//                     that has one). For negative tests on a scratch copy; tracked files stay untouched.
// --public <dir>      the built site (deploy-site.ps1 passes hosting/site/public): every task's
//                     download zip must exist there. Without it only the zip's path shape is checked.
// --report-snippets   print the runbook steps that would fail the "no silent empty snippets" rule,
//                     then exit 0 without writing anything.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i === -1 ? null : (argv.splice(i, 2)[1] ?? ''); };
const runbookOverride = flag('--runbook');
const publicDir = flag('--public');
const reportSnippets = argv.includes('--report-snippets');
const out = argv.filter((a) => !a.startsWith('--'))[0];
if (!out && !reportSnippets) throw new Error('usage: node build-seed.mjs <out.json> [--runbook <path>] [--public <dir>] [--report-snippets]');

const read = (rel) => JSON.parse(readFileSync(isAbsolute(rel) ? rel : join(root, rel), 'utf8'));
const registry = read('hosting/hub/projects.json');
// Pages a runbook step may link to: every listed page, plus each company's `unlisted` paths —
// pages deploy-site.ps1 builds but that are reached from a runbook rather than the page list.
const allHrefs = new Set(registry.flatMap((p) => [...p.pages.map((pg) => pg.href), ...(p.unlisted || [])]));
// ── copyable snippets for runbook steps ──
// A step's `link` points at a section of a runbook page. The build reads that section's code
// blocks (prompts, bash, SQL) from the page's markdown source, so the dashboard can offer them
// with a copy button. Nothing is copied into the seed by hand, so it cannot drift from the page.
// Heading ids must match build-runbook.mjs exactly: same slug rules, same de-duplication order.
const marked = new Marked({ gfm: true });
function slugger() {
  const used = new Map();
  return (html) => {
    const base = html.replace(/<[^>]+>/g, '').replace(/&[a-z0-9#]+;/gi, ' ').toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') || 'section';
    const n = used.get(base) || 0;
    used.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}
const sectionsCache = new Map();
function sectionsOf(sourceRel) {
  if (sectionsCache.has(sourceRel)) return sectionsCache.get(sourceRel);
  const tokens = marked.lexer(readFileSync(join(root, sourceRel), 'utf8'));
  const slug = slugger();
  const map = new Map();
  const headings = [];
  tokens.forEach((t, i) => {
    if (t.type !== 'heading') return;
    const id = slug(marked.parseInline(t.text));
    map.set(id, { i, depth: t.depth });
    headings.push({ id, text: t.text });
  });
  const result = { tokens, map, headings };
  sectionsCache.set(sourceRel, result);
  return result;
}
const plainText = (md) => md.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
function snippetsFor(link, sourceByHref) {
  if (!link || !link.includes('#')) return [];
  const [href, anchor] = link.split('#');
  const source = sourceByHref.get(href);
  if (!source || !source.endsWith('.md')) return [];
  const { tokens, map } = sectionsOf(source);
  const at = map.get(anchor);
  if (!at) throw new Error(`runbook link ${link}: no heading with that id in ${source}`);
  const out = [];
  let label = null;
  for (let i = at.i + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'heading' && t.depth <= at.depth) break;
    if (t.type === 'heading') { label = plainText(t.text); continue; }
    if (t.type === 'paragraph') { const txt = plainText(t.text); label = txt.length <= 120 ? txt.replace(/:$/, '') : label; continue; }
    if (t.type === 'code' && t.text.trim()) {
      out.push({ label: label || plainText(tokens[at.i].text), lang: t.lang || 'text', text: t.text });
      label = null;
    }
  }
  return out;
}

// A heading that names a wave (plan D28): "Wave 12 — `wt-step16`", "4. Wave 1: start three sessions".
const WAVE_HEADING = /^(\d+\.\s*)?Wave\s+\d+/i;
const emptySnippetSteps = [];

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
  const runbookPath = p.seed.runbook ? (runbookOverride || p.seed.runbook) : null;
  const runbook = runbookPath ? read(runbookPath) : null;
  // every page's markdown source, across companies, so a step can link another company's page
  const sourceByHref = new Map(registry.flatMap((q) => q.pages.filter((pg) => pg.source).map((pg) => [pg.href, pg.source])));
  if (runbook) {
    const seen = new Set(known);
    const stepIds = new Set(runbook.stages.flatMap((st) => st.steps.map((s) => s.id)));
    const anchored = new Set(); // "<href>#<id>" of every step link and prompt, for the wave rule
    for (const st of runbook.stages) {
      if (!st.steps.length) throw new Error(`${p.key}: runbook stage ${st.id} has no steps`);
      for (const s of st.steps) {
        if (seen.has(s.id)) throw new Error(`${p.key}: runbook step id ${s.id} is used twice (or by a task)`);
        seen.add(s.id);
        if (!['wilfred', 'session'].includes(s.owner)) throw new Error(`${p.key}: runbook step ${s.id} has owner "${s.owner}"`);
        const bad = (s.waitsFor || []).filter((k) => !stepIds.has(k));
        if (bad.length) throw new Error(`${p.key}: runbook step ${s.id} waits for unknown steps [${bad}]`);
        if (s.assignee !== undefined) {
          // the same rule as a tick's name (findings.ts, index.html): trim, collapse spaces, 1-40 chars
          const name = typeof s.assignee === 'string' ? s.assignee.trim().replace(/\s+/g, ' ') : '';
          if (!name || name.length > 40) throw new Error(`${p.key}: runbook step ${s.id} assignee must be 1–40 characters`);
        }
        if (s.link && !allHrefs.has(s.link.split('#')[0])) {
          throw new Error(`${p.key}: runbook step ${s.id} links to ${s.link}, which is not a page in projects.json`);
        }
        // `prompts` (optional) lists exact sections to take snippets from; otherwise the step's link.
        for (const l of s.prompts || []) {
          if (!allHrefs.has(l.split('#')[0])) throw new Error(`${p.key}: runbook step ${s.id} prompts ${l}, which is not a page in projects.json`);
        }
        const sources = s.prompts || [s.link];
        for (const l of sources) if (l && l.includes('#')) anchored.add(l);
        const snippets = sources.flatMap((l) => snippetsFor(l, sourceByHref));
        // No silent empty snippets (plan §4.3 #6): a step pointing into a markdown page must yield at
        // least one block, unless it says "snippets": false because its section has none by design.
        const optOut = s.snippets === false;
        const intoMarkdown = sources.some((l) => l && (sourceByHref.get(l.split('#')[0]) || '').endsWith('.md'));
        if (!snippets.length && intoMarkdown && !optOut) {
          if (reportSnippets) emptySnippetSteps.push(`${s.id}  <- ${sources.join(', ')}`);
          else throw new Error(`${p.key}: runbook step ${s.id} takes no snippets from ${sources.join(', ')} (set "snippets": false if that is by design)`);
        }
        delete s.prompts;
        delete s.snippets;
        if (snippets.length) s.snippets = snippets;
      }
    }

    // Tasks (plan §4.2, §4.3 #2-#4): the dashboard's list. A task groups whole stages, in order; its
    // id is not a Convex key but shares their key space so ?task= stays unambiguous.
    if (!reportSnippets) {
      const tasksOut = runbook.tasks || [];
      const stageIds = new Set(runbook.stages.map((st) => st.id));
      const owner = new Map();
      for (const t of tasksOut) {
        if (seen.has(t.id)) throw new Error(`${p.key}: task id ${t.id} is used twice (or by a step or finding)`);
        seen.add(t.id);
        for (const sid of t.stages || []) {
          if (!stageIds.has(sid)) throw new Error(`${p.key}: task ${t.id} lists unknown stage ${sid}`);
          if (owner.has(sid)) throw new Error(`${p.key}: runbook stage ${sid} is in two tasks (${owner.get(sid)}, ${t.id})`);
          owner.set(sid, t.id);
        }
        if (t.runbook && !(sourceByHref.get(t.runbook) || '').endsWith('.md')) {
          throw new Error(`${p.key}: task ${t.id} runbook ${t.runbook} is not a page with an .md source`);
        }
        for (const a of t.attach || []) {
          if (!allHrefs.has(a.href)) throw new Error(`${p.key}: task ${t.id} attachment ${a.href} is not a page in projects.json`);
        }
        if (t.download !== undefined) {
          if (!/^\/nct\/downloads\/[\w.-]+\.zip$/.test(t.download)) {
            throw new Error(`${p.key}: task ${t.id} download ${t.download} is not /nct/downloads/<name>.zip`);
          }
          // the bundles are built before this script runs (deploy-site.ps1), so the zip must be there
          if (publicDir && !existsSync(join(resolve(publicDir), t.download.slice(1)))) {
            throw new Error(`${p.key}: task ${t.id} download ${t.download} is missing from ${publicDir}`);
          }
        }
      }
      for (const st of runbook.stages) {
        if (!owner.has(st.id)) throw new Error(`${p.key}: runbook stage ${st.id} is in no task`);
      }
      // Every runbook page is some task's body, so the wave rule below reaches all of them.
      const taskRunbooks = new Set(tasksOut.map((t) => t.runbook).filter(Boolean));
      for (const pg of p.pages) {
        if (pg.type === 'Runbook' && (pg.source || '').endsWith('.md') && !taskRunbooks.has(pg.href)) {
          throw new Error(`${p.key}: runbook page ${pg.href} is in no task`);
        }
      }

      // Wave coverage (plan §4.3 #5, D2): every wave heading of every task's runbook must be the
      // anchor of some step's link or prompts, in any task. Coverage is by anchor, so a new wave in a
      // runbook cannot ship without a checklist step for it.
      for (const t of tasksOut) {
        if (!t.runbook) continue;
        const source = sourceByHref.get(t.runbook);
        for (const hd of sectionsOf(source).headings) {
          if (!WAVE_HEADING.test(hd.text.replace(/`/g, '').trim())) continue;
          if (!anchored.has(`${t.runbook}#${hd.id}`)) throw new Error(`${p.key}: ${source} wave heading #${hd.id} has no step`);
        }
      }

      // Enriched for the client: the runbook page's title and last edit, the same rule as pages[].
      const pageByHref = new Map(p.pages.map((pg) => [pg.href, pg]));
      runbook.tasks = tasksOut.map(({ runbook: href, ...t }) => {
        const { id, title, short, loose, sop, settled, migrations, stages, download, attach } = t;
        const out = { id, title, short, loose, sop, settled, migrations, stages, download };
        if (href) {
          const pg = pageByHref.get(href);
          out.runbook = { href, title: pg ? pg.title : href, updated: statSync(join(root, sourceByHref.get(href))).mtime.toISOString() };
        }
        out.attach = attach || [];
        return JSON.parse(JSON.stringify(out)); // drops the absent optional fields
      });
    }
  }

  const pages = p.pages.map(({ source, ...page }) => ({
    ...page,
    updated: source ? statSync(join(root, source)).mtime.toISOString() : null,
  }));
  const { seed, unlisted, ...meta } = p;
  return { ...meta, pages, tasks, workstreams, runbook, flow: { phases: flow.phases, steps: flow.steps } };
});

if (reportSnippets) {
  console.log(emptySnippetSteps.length
    ? `steps that take no snippets and do not say "snippets": false (${emptySnippetSteps.length}):\n  ${emptySnippetSteps.join('\n  ')}`
    : 'every step that points into a markdown page takes at least one snippet, or opts out');
  process.exit(0);
}

// "<" escaped so the JSON can sit inside a <script> tag safely
const json = JSON.stringify({ projects }).replace(/</g, '\\u003c');
writeFileSync(out, json);
console.log(`seed: ${projects.map((p) => `${p.key} ${p.tasks.length} tasks / ${p.workstreams.length} workstreams${p.runbook ? ` / ${p.runbook.stages.reduce((n, st) => n + st.steps.length, 0)} runbook steps` : ''}`).join('; ')} (${json.length} bytes)`);
