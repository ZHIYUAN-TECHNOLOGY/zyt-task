// Seed the tracker model from the NCT SOP's data file, with the page's own id and fold rules
// (tracker/sop-findings.mjs). customer-intake-sop/sop.json is the only source.
//   node tracker/build-seed.mjs [--sop <path>] [--out-dir <dir>]
// --sop <path>      read this sop.json instead (a scratch copy for tests)
// --out-dir <dir>   write tasks-nct.json and flow-nct.json there instead of tracker/seed/
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findingsFromSop, flowFromSop } from "./sop-findings.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1]; };
const sopPath = resolve(root, flag("--sop") ?? "customer-intake-sop/sop.json");
const outDir = resolve(root, flag("--out-dir") ?? "tracker/seed");

const sop = JSON.parse(readFileSync(sopPath, "utf8"));

// ── the flow: 5 phases, 27 steps ──────────────────────────────────────
const flow = flowFromSop(sop, { id: "flow-nct-enquiry-to-invoice", name: "Enquiry to invoice" });

// ── internal tasks: 18 ranked chain defects + 30 step-local findings ──
const tasks = findingsFromSop(sop, { prefix: "nct-" });

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "flow-nct.json"), JSON.stringify(flow, null, 2));
writeFileSync(join(outDir, "tasks-nct.json"), JSON.stringify(tasks, null, 2));

const bySev = {};
for (const t of tasks) bySev[t.severity ?? "ranked"] = (bySev[t.severity ?? "ranked"] ?? 0) + 1;
console.log("source:", sopPath, "| out:", outDir);
console.log("steps:", flow.steps.length, "| phases:", flow.phases.length);
console.log("tasks:", tasks.length, JSON.stringify(bySev));
console.log("steps with no task:",
  flow.steps.filter((s) => !tasks.some((t) => t.steps.some((x) => x.n === s.n))).map((s) => s.n));
