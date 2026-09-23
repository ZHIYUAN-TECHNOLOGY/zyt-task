// The findings and the flow an SOP page shows, read from its sop.json with the page's own rules.
// Shared by tracker/build-seed.mjs (writes tracker/seed/tasks-nct.json and flow-nct.json) and
// hosting/hub/build-seed.mjs (the drift check), so both derive the same ids.
//
// The rules mirror the zyt-setup template (~/.claude/skills/zyt-setup/assets/sop-template.html):
//   - a ledger item keeps its `id`; rank is its 1-based position in ledger.items;
//   - a step fix's id is `f.id` when set, otherwise "s<nn>-" + slug(f.title), the slug capped at 48;
//   - a step fix that repeats a ledger item (`sameAs` names it, or the normalised titles match) is
//     not a second finding: it is dropped and the ledger item gains that step;
//   - "new" is `isNew` when set, otherwise firstFound later than the ledger's earliest firstFound
//     (and not fixed).
// Output ids carry a project prefix ("nct-") because they share one Convex key space.

// markup, a few entities and markdown bold stripped; curly quotes made straight (as the seed has
// always carried them); whitespace collapsed
export const clean = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&rsquo;|&#8217;|’/g, "'")
    .replace(/&ldquo;|&rdquo;|“|”/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// the template's slug(), normTitle() and pad(), character for character
export const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
export const normTitle = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const pad = (n) => (n < 10 ? '0' + n : String(n));

// the page's id for a step fix, without the project prefix
export const fixId = (g, f) => (f.id != null && f.id !== '' ? String(f.id) : 's' + pad(g.n) + '-' + slug(f.title));

// SOPTrack.status: null when the record has no status
const ST = { open: 1, 'partly-fixed': 1, fixed: 1 };
const status = (x) => {
  if (!x) return null;
  if (x.status != null) return ST[x.status] ? x.status : 'open';
  if (x.resolved != null) return x.resolved ? 'fixed' : 'open';
  return null;
};
const srcList = (s) => (s == null ? [] : [].concat(s).filter((x) => x != null && x !== ''));
// audit facts written by /zyt-audit, passed through when present
const AUDIT = ['status', 'fixedAt', 'origin', 'ruleId'];
const auditFacts = (x) => Object.fromEntries(AUDIT.filter((k) => x[k] != null).map((k) => [k, x[k]]));

export function findingsFromSop(sop, { prefix = 'nct-' } = {}) {
  const ledger = (sop.ledger && sop.ledger.items) || [];
  const minFound = ledger.reduce((m, x) => (x.firstFound && (!m || x.firstFound < m) ? x.firstFound : m), '');
  const items = ledger.map((it, i) => ({
    id: prefix + it.id,
    kind: 'chain',
    rank: i + 1,
    title: clean(it.title),
    isNew: it.isNew != null ? !!it.isNew : !!(it.firstFound && minFound && it.firstFound > minFound && status(it) !== 'fixed'),
    detail: clean(it.body),
    severity: it.sev ?? null,
    steps: (it.repairs || []).map((r) => ({ kind: r.k === 'b' ? 'break-after' : 'step', n: Number(r.n) })),
    state: 'open',
    owner: null,
    repair: null,
    src: srcList(it.src),
    ...auditFacts(it),
  }));

  const byId = {}, byTitle = {};
  ledger.forEach((it, i) => {
    byId[it.id] = items[i];
    const k = normTitle(it.title);
    if (k && !byTitle[k]) byTitle[k] = items[i];
  });

  for (const g of sop.guide || []) {
    for (const f of g.fixes || []) {
      const same = (f.sameAs != null && byId[f.sameAs]) || byTitle[normTitle(f.title)];
      if (same) {
        if (!same.steps.some((t) => t.n === g.n)) same.steps.push({ kind: 'step', n: g.n });
        continue;
      }
      items.push({
        id: prefix + fixId(g, f),
        kind: 'step',
        rank: null,
        title: clean(f.title),
        isNew: false,
        detail: clean(f.why),
        severity: f.sev ?? null,
        steps: [{ kind: 'step', n: g.n }],
        state: 'open',
        owner: null,
        repair: clean(f.repair),
        src: srcList(f.src),
        ...auditFacts(f),
      });
    }
  }
  return items;
}

// The flow the dashboard groups findings by: phases from sop.json phases[], one step per guide[]
// entry, its title from steps[] (the badge is not part of it).
export function flowFromSop(sop, { id, name } = {}) {
  const stepByN = new Map((sop.steps || []).map((s) => [s.n, s]));
  return {
    id,
    name,
    client: (sop.meta || {}).company ?? null,
    phases: (sop.phases || []).map((p) => ({ key: p.letter, label: p.name })),
    steps: (sop.guide || []).map((g) => {
      const st = stepByN.get(g.n) || {};
      return {
        n: g.n,
        key: `step-${String(g.n).padStart(2, '0')}`,
        title: st.title != null ? clean(st.title) : `Step ${g.n}`,
        phase: st.phase ?? null,
        role: g.role ?? null,
        routes: (g.routes ?? []).map((r) => r.path),
        summary: clean(g.result ?? ''),
      };
    }),
  };
}
