// Mock the two views from the seed: the client's weekly page, and the internal board.
//   node tracker/build-mocks.mjs      (run from C:/Project/ZYT-Task)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const flow = JSON.parse(readFileSync("tracker/seed/flow-nct.json", "utf8"));
const tasks = JSON.parse(readFileSync("tracker/seed/tasks-nct.json", "utf8"));
const clientTasks = JSON.parse(readFileSync("tracker/seed/client-tasks-nct.json", "utf8"));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ── sample states, invented for the mock ───────────────────────────────
   Nothing is implemented yet, so every state below is made up to show the
   views working. Each carries its own event trail. */
const WEEK = "14 September 2026";
const SAMPLE = {
  "nct-c07-customer-records": {
    state: "done", owner: "Aina",
    events: [
      ["planned", "in_progress", "Plan approved, worktree open", "Aina", "8 Sep"],
      ["in_progress", "done", "Duplicate names now refused; credit checked at invoicing", "Aina", "12 Sep"],
    ],
    reported: "done",
  },
  "nct-c03-quote-pricing": {
    state: "in_progress", owner: "Aina",
    events: [["planned", "in_progress", "Rate-card gate first; container mix next", "Aina", "11 Sep"]],
    reported: "in_progress",
  },
  "nct-c06-enquiry-record": {
    state: "in_progress", owner: "Ruben",
    events: [["planned", "in_progress", "Channel field and inbox link started", "Ruben", "9 Sep"]],
    reported: "in_progress",
  },
  "nct-c04-approvals-hold": {
    state: "blocked", owner: "Ruben",
    events: [
      ["planned", "in_progress", "Reviewed all four approval queues", "Ruben", "10 Sep"],
      ["in_progress", "blocked", "Need NCT to confirm who may approve their own work", "Ruben", "13 Sep"],
    ],
    reported: "in_progress",            // deliberately differs from live, to show the two clocks
  },
  "nct-c01-invoice-completeness": {
    state: "in_progress", owner: "Aina",
    events: [["planned", "in_progress", "Carrying the customer through to the invoice", "Aina", "13 Sep"]],
    reported: "planned",
  },
};
const STATE_LABEL = { planned: "Planned", in_progress: "In progress", blocked: "Blocked", done: "Shipped" };
const ORDER = { done: 0, blocked: 1, in_progress: 2, planned: 3 };

const items = clientTasks.map((c) => {
  const s = SAMPLE[c.id] ?? { state: "planned", owner: null, events: [], reported: "planned" };
  return { ...c, ...s, since: s.events.at(-1)?.[4] ?? null };
});
items.sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.title.localeCompare(b.title));
const count = (st) => items.filter((i) => i.state === st).length;
const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));

/* ── shared head ─────────────────────────────────────────────────────── */
const head = (title, css) => `<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<style>${css}</style>`;

const TOKENS = `
:root {
  --ground:#f7f7f4; --surface:#fffffe; --sunk:#eceeea; --ink:#17242a; --ink-soft:#42565d;
  --ink-faint:#6d8188; --rule:#d9ddd8; --rule-strong:#b9c0ba;
  --teal:#2e6b6e; --teal-soft:#dde9e7; --amber:#b5780f; --amber-soft:#f2e6cd;
  --oxide:#9e3b2a; --oxide-soft:#f6e4e0;
  --display:"Archivo","Helvetica Neue",Arial,sans-serif;
  --body:"Source Serif 4",Georgia,"Times New Roman",serif;
  --mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --ground:#0e1719; --surface:#142024; --sunk:#101a1d; --ink:#e6ebe7; --ink-soft:#a9b8b8;
  --ink-faint:#7f9191; --rule:#24353a; --rule-strong:#35494e;
  --teal:#6fb3ae; --teal-soft:#17302f; --amber:#e0a53f; --amber-soft:#3a2f16;
  --oxide:#e08874; --oxide-soft:#33201c;
}}
:root[data-theme="dark"]{
  --ground:#0e1719; --surface:#142024; --sunk:#101a1d; --ink:#e6ebe7; --ink-soft:#a9b8b8;
  --ink-faint:#7f9191; --rule:#24353a; --rule-strong:#35494e;
  --teal:#6fb3ae; --teal-soft:#17302f; --amber:#e0a53f; --amber-soft:#3a2f16;
  --oxide:#e08874; --oxide-soft:#33201c;
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:400 1rem/1.6 var(--body);
  -webkit-font-smoothing:antialiased;padding-inline:1.25rem}
h1,h2,h3{font-family:var(--display);margin:0;text-wrap:balance;letter-spacing:-0.015em}
p{margin:0;max-width:65ch}
.mock{display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap;background:var(--amber-soft);
  border-left:3px solid var(--amber);padding:.55rem .8rem;border-radius:0 3px 3px 0;font-size:.86rem}
.mock b{font-family:var(--display);color:var(--amber)}
.chip{font:500 .66rem var(--mono);letter-spacing:.1em;text-transform:uppercase;
  padding:.14rem .45rem;border-radius:2px;white-space:nowrap}
.s-done{background:var(--teal-soft);color:var(--teal)}
.s-in_progress{background:var(--amber-soft);color:var(--amber)}
.s-blocked{background:var(--oxide-soft);color:var(--oxide)}
.s-planned{background:var(--sunk);color:var(--ink-faint)}
`;

/* ── client view ─────────────────────────────────────────────────────── */
const clientCss = TOKENS + `
.wrap{max-width:44rem;margin:0 auto;padding-block:3.5rem 6rem}
.eyebrow{font:500 .7rem var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint);
  display:flex;gap:.3rem 1rem;flex-wrap:wrap}
h1{font-size:clamp(2rem,5vw,2.7rem);line-height:1.06;font-weight:700;margin:.7rem 0 .5rem}
.summary{margin-top:1.6rem;background:var(--surface);border:1px solid var(--rule);border-radius:3px;
  padding:1.1rem 1.2rem;display:grid;gap:.7rem}
.summary .next{color:var(--ink-soft);border-top:1px solid var(--rule);padding-top:.7rem;font-size:.95rem}
.tally{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1.4rem}
.tally span{font:500 .72rem var(--mono);letter-spacing:.08em;text-transform:uppercase;
  border:1px solid var(--rule);border-radius:2px;padding:.3rem .55rem;background:var(--surface)}
.tally b{font-family:var(--display);font-size:.95rem;margin-right:.35rem}
h2.group{font-size:.78rem;font-family:var(--mono);font-weight:500;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-faint);margin:2.6rem 0 .9rem;
  border-bottom:1px solid var(--rule);padding-bottom:.4rem}
.item{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:1rem 1.1rem;
  margin-bottom:.8rem}
.item.blocked{border-left:3px solid var(--oxide)}
.item.done{border-left:3px solid var(--teal)}
.item.in_progress{border-left:3px solid var(--amber)}
.item h3{font-size:1.08rem;font-weight:600;margin-bottom:.35rem}
.item .row{display:flex;flex-wrap:wrap;gap:.5rem .8rem;align-items:baseline;margin-bottom:.45rem}
.item .since{font:.72rem var(--mono);color:var(--ink-faint)}
.item p{color:var(--ink-soft);font-size:.95rem}
details{margin-top:.7rem;border-top:1px dashed var(--rule);padding-top:.6rem}
summary{cursor:pointer;font:500 .74rem var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--teal)}
summary::marker{color:var(--rule-strong)}
.trail{list-style:none;margin:.7rem 0 0;padding:0;display:grid;gap:.55rem}
.trail li{display:grid;grid-template-columns:4.4rem minmax(0,1fr);gap:.7rem;font-size:.9rem}
.trail .when{font:.72rem var(--mono);color:var(--ink-faint);padding-top:.15rem}
.trail .note{color:var(--ink-soft)}
.trail .who{font:.72rem var(--mono);color:var(--ink-faint)}
.differs{margin-top:.6rem;background:var(--sunk);border-radius:2px;padding:.45rem .6rem;
  font-size:.85rem;color:var(--ink-soft)}
.foot{margin-top:3.2rem;border-top:1px solid var(--rule);padding-top:1rem;
  font:.74rem/1.7 var(--mono);color:var(--ink-faint)}
@media (max-width:34rem){.trail li{grid-template-columns:minmax(0,1fr);gap:.15rem}}
`;

const trail = (it) => it.events.length ? `
      <details>
        <summary>Status history</summary>
        <ul class="trail">
          ${it.events.map(([from, to, note, who, when]) => `<li>
            <span class="when">${esc(when)}</span>
            <span><span class="chip s-${to}">${STATE_LABEL[to]}</span>
              <span class="note"> ${esc(note)}</span>
              <span class="who"> — ${esc(who)}</span></span>
          </li>`).join("")}
        </ul>
        ${it.reported !== it.state ? `<p class="differs">Reported on ${WEEK.split(" ").slice(0, 2).join(" ")} as
          <strong>${STATE_LABEL[it.reported]}</strong> · now ${STATE_LABEL[it.state]}.</p>` : ""}
      </details>` : "";

const group = (state, heading, blurb) => {
  const list = items.filter((i) => i.state === state);
  if (!list.length) return "";
  return `<h2 class="group">${heading} · ${list.length}</h2>
    ${blurb ? `<p style="color:var(--ink-soft);margin-bottom:.9rem">${blurb}</p>` : ""}
    ${list.map((it) => `<article class="item ${it.state}">
      <div class="row"><h3>${esc(it.title)}</h3><span class="chip s-${it.state}">${STATE_LABEL[it.state]}</span>
        ${it.since ? `<span class="since">since ${esc(it.since)}</span>` : ""}</div>
      <p>${esc(it.blurb)}</p>${trail(it)}
    </article>`).join("")}`;
};

const clientHtml = `${head("NCT Delivery Report", clientCss)}
<div class="wrap">
  <header>
    <div class="eyebrow"><span>Prepared by ZYT Agency</span><span>NCT Freight Forwarding</span><span>Enquiry to invoice</span></div>
    <h1>Week of ${WEEK}</h1>
    <p style="color:var(--ink-soft)">Where your project stands, reported weekly. Open any item to see how it has moved.</p>
  </header>

  <div class="mock" style="margin-top:1.4rem"><b>Mock</b>
    <span>Real flow and real findings; the states, names and dates below are made up to show the view.</span></div>

  <section class="summary">
    <p><strong>Customer records are cleaned up and shipped.</strong> Duplicate customers can no
    longer be created by spelling, and credit limits are now checked when an invoice is raised.</p>
    <p>Quoting and enquiry recording are underway. One piece is waiting on you: we need a decision
    on who may approve their own work before we can lock approvals down.</p>
    <p class="next"><strong>Next week:</strong> finish the enquiry channel record, start carrying
    customer details through to the invoice.</p>
  </section>

  <div class="tally">
    <span><b>${count("done")}</b> shipped</span>
    <span><b>${count("in_progress")}</b> in progress</span>
    <span><b>${count("blocked")}</b> blocked</span>
    <span><b>${count("planned")}</b> planned</span>
  </div>

  ${group("done", "Shipped this week", "")}
  ${group("blocked", "Waiting on you", "We cannot move these without a decision or access from your side.")}
  ${group("in_progress", "In progress", "")}
  ${group("planned", "Planned", "Agreed, not started yet. We will tell you the week each one begins.")}

  <p class="foot">Status as reported on ${WEEK}. Individual items show their current state, which can
  have moved since the report. Questions go to your ZYT contact — this page does not take replies.</p>
</div>`;

/* ── internal view ───────────────────────────────────────────────────── */
const internalCss = TOKENS + `
.wrap{max-width:76rem;margin:0 auto;padding-block:2.5rem 5rem}
.top{display:flex;flex-wrap:wrap;gap:1rem 2rem;align-items:flex-end;justify-content:space-between}
h1{font-size:1.9rem;font-weight:700}
.eyebrow{font:500 .68rem var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint)}
.stats{display:flex;flex-wrap:wrap;gap:.45rem}
.stat{border:1px solid var(--rule);background:var(--surface);border-radius:2px;padding:.35rem .6rem;
  font:500 .72rem var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.stat b{font-family:var(--display);font-size:1rem;color:var(--ink);margin-right:.35rem}
.stat.money b{color:var(--oxide)} .stat.data b{color:var(--amber)} .stat.blocked b{color:var(--teal)}
.cols{display:grid;grid-template-columns:minmax(0,15rem) minmax(0,1fr);gap:2rem;margin-top:2rem;align-items:start}
@media (max-width:64rem){.cols{grid-template-columns:minmax(0,1fr)}}
.rail{border:1px solid var(--rule);border-radius:3px;background:var(--surface);overflow:hidden}
.rail h2{font:500 .68rem var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint);
  padding:.6rem .7rem;border-bottom:1px solid var(--rule)}
.rail ul{list-style:none;margin:0;padding:0}
.rail li{display:grid;grid-template-columns:1.9rem minmax(0,1fr) auto;gap:.4rem;align-items:baseline;
  padding:.32rem .7rem;font-size:.84rem;border-bottom:1px solid var(--rule)}
.rail li:last-child{border-bottom:0}
.rail .n{font:500 .7rem var(--mono);color:var(--ink-faint)}
.rail .c{font:500 .68rem var(--mono);color:var(--oxide)}
.rail .c.zero{color:var(--ink-faint)}
.rail .ph{background:var(--sunk);font:500 .66rem var(--mono);letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-faint);padding:.35rem .7rem;display:block}
.draft{background:var(--surface);border:1px solid var(--rule);border-left:3px solid var(--teal);
  border-radius:0 3px 3px 0;padding:.9rem 1rem;margin-bottom:1.6rem;display:grid;gap:.5rem}
.draft h2{font-size:1rem}
.draft .hint{font:.74rem var(--mono);color:var(--ink-faint)}
.ci{background:var(--surface);border:1px solid var(--rule);border-radius:3px;margin-bottom:.9rem;overflow:hidden}
.ci-head{display:flex;flex-wrap:wrap;gap:.5rem .8rem;align-items:baseline;padding:.7rem .9rem;border-bottom:1px solid var(--rule)}
.ci-head h3{font-size:1rem;font-weight:600;flex:1 1 18rem}
.ci-head .owner{font:.72rem var(--mono);color:var(--ink-faint)}
.ci-head .vis{font:.66rem var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint)}
table{border-collapse:collapse;width:100%;font-size:.86rem}
th,td{text-align:left;vertical-align:top;padding:.42rem .9rem;border-bottom:1px solid var(--rule)}
tr:last-child td{border-bottom:0}
th{font:500 .64rem var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint)}
td.sev{white-space:nowrap}
td .src{font:.68rem var(--mono);color:var(--ink-faint);display:block;margin-top:.15rem}
td .rep{color:var(--ink-soft);display:block;margin-top:.2rem}
.tablewrap{overflow-x:auto}
.foot{margin-top:2.6rem;border-top:1px solid var(--rule);padding-top:1rem;font:.74rem/1.7 var(--mono);color:var(--ink-faint)}
`;

const sevChip = (s) => s ? `<span class="chip s-${s === "money" ? "blocked" : s === "data" ? "in_progress" : "planned"}"
  style="${s === "money" ? "background:var(--oxide-soft);color:var(--oxide)" : ""}">${s}</span>`
  : `<span class="chip s-planned">ranked</span>`;

const openOn = (n) => tasks.filter((t) => t.steps.some((x) => x.n === n)).length;
const sevCount = (s) => tasks.filter((t) => t.severity === s).length;

const internalHtml = `${head("NCT Delivery Board", internalCss)}
<div class="wrap">
  <div class="top">
    <div>
      <div class="eyebrow">ZYT internal · NCT Freight Forwarding · enquiry to invoice</div>
      <h1>Delivery board</h1>
    </div>
    <div class="stats">
      <span class="stat"><b>${tasks.length}</b> open tasks</span>
      <span class="stat money"><b>${sevCount("money")}</b> money</span>
      <span class="stat data"><b>${sevCount("data")}</b> data</span>
      <span class="stat blocked"><b>${sevCount("blocked")}</b> blocked</span>
      <span class="stat"><b>${clientTasks.length}</b> client items</span>
      <span class="stat"><b>${flow.steps.length}</b> steps</span>
    </div>
  </div>

  <div class="mock" style="margin-top:1.2rem"><b>Mock</b>
    <span>48 real findings against the real 27-step flow; owners, states and dates are sample data.</span></div>

  <div class="cols">
    <aside class="rail">
      <h2>The flow · open per step</h2>
      <ul>
        ${flow.phases.map((p) => `<li class="ph">${p.key} · ${esc(p.label)}</li>` +
          flow.steps.filter((s) => s.phase === p.key).map((s) => `<li>
            <span class="n">${String(s.n).padStart(2, "0")}</span>
            <span>${esc(s.title)}</span>
            <span class="c${openOn(s.n) ? "" : " zero"}">${openOn(s.n) || "—"}</span></li>`).join("")).join("")}
      </ul>
    </aside>

    <main>
      <section class="draft">
        <h2>Friday draft — week of ${WEEK}</h2>
        <p>Assembled from this week's state changes. Edit the wording, choose what the client sees, then publish.</p>
        <p class="hint">1 shipped · 3 in progress · 1 blocked on a client decision · ${count("planned")} planned and untouched</p>
      </section>

      ${items.map((it) => `<section class="ci">
        <div class="ci-head">
          <h3>${esc(it.title)}</h3>
          <span class="chip s-${it.state}">${STATE_LABEL[it.state]}</span>
          <span class="owner">${it.owner ? "owner " + esc(it.owner) : "unassigned"}</span>
          <span class="vis">${it.visible ? "client-visible" : "not yet visible"}</span>
          <span class="owner">${it.covers.length} task${it.covers.length === 1 ? "" : "s"}</span>
        </div>
        <div class="tablewrap"><table>
          <thead><tr><th>Severity</th><th>Task</th><th>Step</th></tr></thead>
          <tbody>
            ${it.covers.map((id) => {
              const t = byId[id];
              const steps = t.steps.map((x) => (x.kind === "break-after" ? "after " : "") + String(x.n).padStart(2, "0")).join(", ");
              return `<tr>
                <td class="sev">${sevChip(t.severity)}${t.rank ? `<span class="src">rank ${String(t.rank).padStart(2, "0")}</span>` : ""}</td>
                <td><strong>${esc(t.title)}</strong>
                  ${t.repair ? `<span class="rep">${esc(t.repair)}</span>` : ""}
                  ${t.src?.length ? `<span class="src">${esc(t.src.join(" · "))}</span>` : ""}</td>
                <td class="sev"><span class="src">${steps}</span></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table></div>
      </section>`).join("")}
    </main>
  </div>

  <p class="foot">Seeded from tracker/seed/*.json · flow and findings real, states sample ·
  client wording lives on the client item, never on a task.</p>
</div>`;

mkdirSync("mocks", { recursive: true });
writeFileSync("mocks/client-weekly.html", clientHtml);
writeFileSync("mocks/internal-board.html", internalHtml);
console.log("client items:", items.length, "| tasks shown:", tasks.length);
console.log("states:", JSON.stringify(Object.fromEntries(["done", "blocked", "in_progress", "planned"].map((s) => [s, count(s)]))));
console.log("wrote mocks/client-weekly.html and mocks/internal-board.html");
