// Seed the tracker model from the SOP page — the page stays the source for now.
//   node tracker/build-seed.mjs      (run from C:/Project/ZYT-Task)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const html = readFileSync("customer-intake-sop.html", "utf8");
const guide = JSON.parse(
  html.match(/id="step-guide">([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, "</"),
);

const clean = (s) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&rsquo;|&#8217;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

// ── the flow: 5 phases, 27 steps ──────────────────────────────────────
const PHASES = [
  { key: "A", label: "Get them on file", steps: [1, 2, 3] },
  { key: "B", label: "Quote them", steps: [4, 5, 6, 7, 8, 9, 10] },
  { key: "C", label: "Open the job", steps: [11, 12, 13, 14, 15] },
  { key: "D", label: "Run it", steps: [16, 17, 18, 19] },
  { key: "E", label: "Bill it", steps: [20, 21, 22, 23, 24, 25, 26, 27] },
];
const titleOf = {};
for (const m of html.matchAll(/<article class="step" id="step-(\d+)">([\s\S]*?)<\/article>/g)) {
  titleOf[Number(m[1])] = clean(m[2].match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? "");
}

const flow = {
  id: "flow-nct-enquiry-to-invoice",
  name: "Enquiry to invoice",
  client: "NCT Freight Forwarding",
  phases: PHASES.map((p) => ({ key: p.key, label: p.label })),
  steps: guide.map((g) => ({
    n: g.n,
    key: `step-${String(g.n).padStart(2, "0")}`,
    title: titleOf[g.n] ?? `Step ${g.n}`,
    phase: PHASES.find((p) => p.steps.includes(g.n)).key,
    role: g.role ?? null,
    routes: (g.routes ?? []).map((r) => r.path),
    summary: clean(g.result ?? ""),
  })),
};

// ── internal tasks: 18 ranked chain defects + 30 step-local findings ──
const tasks = [];
const slug = (t) =>
  clean(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

for (const m of html.matchAll(/<li data-gap="([^"]+)"([\s\S]*?)<\/li>/g)) {
  const [, id, body] = m;
  const steps = [...body.matchAll(/data-k="(\w)" data-n="(\d+)"/g)].map((x) => ({
    kind: x[1] === "b" ? "break-after" : "step",
    n: Number(x[2]),
  }));
  tasks.push({
    id: `nct-${id}`,
    kind: "chain",
    rank: Number(body.match(/class="rank">(\d+)/)?.[1] ?? 0),
    title: clean(body.match(/<b>([\s\S]*?)<\/b>/)?.[1]),
    detail: clean(body.match(/class="body">([\s\S]*?)<\/span>/)?.[1]),
    severity: null,
    steps,
    state: "open",
    owner: null,
    repair: null,
    src: [],
  });
}
for (const g of guide) {
  for (const f of g.fixes ?? []) {
    tasks.push({
      id: `nct-s${String(g.n).padStart(2, "0")}-${slug(f.title)}`,
      kind: "step",
      rank: null,
      title: clean(f.title),
      detail: clean(f.why),
      severity: f.sev,
      steps: [{ kind: "step", n: g.n }],
      state: "open",
      owner: null,
      repair: clean(f.repair),
      src: f.src ? [f.src] : [],
    });
  }
}

mkdirSync("tracker/seed", { recursive: true });
writeFileSync("tracker/seed/flow-nct.json", JSON.stringify(flow, null, 2));
writeFileSync("tracker/seed/tasks-nct.json", JSON.stringify(tasks, null, 2));

const bySev = {};
for (const t of tasks) bySev[t.severity ?? "ranked"] = (bySev[t.severity ?? "ranked"] ?? 0) + 1;
console.log("steps:", flow.steps.length, "| phases:", flow.phases.length);
console.log("tasks:", tasks.length, JSON.stringify(bySev));
console.log("steps with no task:",
  flow.steps.filter((s) => !tasks.some((t) => t.steps.some((x) => x.n === s.n))).map((s) => s.n));
