// One board, two audiences: a Team/Client toggle hides what a client should not see.
//   node tracker/build-board.mjs      (run from C:/Project/ZYT-Task)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const flow = JSON.parse(readFileSync("tracker/seed/flow-nct.json", "utf8"));
const tasks = JSON.parse(readFileSync("tracker/seed/tasks-nct.json", "utf8"));
const streams = JSON.parse(readFileSync("tracker/seed/client-tasks-nct.json", "utf8"));
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));

const WEEK = "14 September 2026";
/* Sample states and events. `internal: true` marks a note the client never sees —
   the toggle that keeps the log honest. */
const SAMPLE = {
  "nct-c07-customer-records": { state: "done", owner: "Aina", events: [
    ["in_progress", "Plan approved, worktree open", "Aina", "8 Sep", false],
    ["in_progress", "Case-insensitive index needs a production count first — asked Wilfred", "Aina", "10 Sep", true],
    ["done", "Duplicate names refused; credit checked at invoicing", "Aina", "12 Sep", false],
  ], reported: "done" },
  "nct-c03-quote-pricing": { state: "in_progress", owner: "Aina", events: [
    ["in_progress", "Rate-card gate first, container mix next", "Aina", "11 Sep", false],
  ], reported: "in_progress" },
  "nct-c06-enquiry-record": { state: "in_progress", owner: "Ruben", events: [
    ["in_progress", "Channel field and inbox link started", "Ruben", "9 Sep", false],
  ], reported: "in_progress" },
  "nct-c04-approvals-hold": { state: "blocked", owner: "Ruben", events: [
    ["in_progress", "Reviewed all four approval queues", "Ruben", "10 Sep", false],
    ["in_progress", "Worse than filed: submit-then-retract unlocks an approved record", "Ruben", "12 Sep", true],
    ["blocked", "Need NCT to confirm who may approve their own work", "Ruben", "13 Sep", false],
  ], reported: "in_progress" },
  "nct-c01-invoice-completeness": { state: "in_progress", owner: "Aina", events: [
    ["in_progress", "Carrying the customer through to the invoice", "Aina", "13 Sep", false],
  ], reported: "planned" },
};
/* The handover prompt: the one thing that is team-only by definition. */
const PROMPT = {
  "nct-c07-customer-records": "Fix the defects recorded against step 02 of NCT's enquiry-to-invoice chain…",
  "nct-c03-quote-pricing": "Fix the defects recorded against steps 04, 06 and 07…",
  "nct-c04-approvals-hold": "Fix the defects recorded against step 08 of NCT's enquiry-to-invoice chain…",
};
const LABEL = { planned: "Planned", in_progress: "In progress", blocked: "Blocked", done: "Shipped" };
const ORDER = { done: 0, blocked: 1, in_progress: 2, planned: 3 };

const items = streams.map((s) => {
  const m = SAMPLE[s.id] ?? { state: "planned", owner: null, events: [], reported: "planned" };
  return { ...s, ...m, since: m.events.at(-1)?.[3] ?? null, prompt: PROMPT[s.id] ?? null };
}).sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.title.localeCompare(b.title));

const n = (st) => items.filter((i) => i.state === st).length;
const sev = (s) => tasks.filter((t) => t.severity === s).length;
const openOn = (step) => tasks.filter((t) => t.steps.some((x) => x.n === step)).length;

const css = `
:root{
  --ground:#f7f7f4;--surface:#fffffe;--sunk:#eceeea;--ink:#17242a;--ink-soft:#42565d;--ink-faint:#6d8188;
  --rule:#d9ddd8;--rule-strong:#b9c0ba;--teal:#2e6b6e;--teal-soft:#dde9e7;--amber:#b5780f;--amber-soft:#f2e6cd;
  --oxide:#9e3b2a;--oxide-soft:#f6e4e0;
  --display:"Archivo","Helvetica Neue",Arial,sans-serif;--body:"Source Serif 4",Georgia,serif;
  --mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#0e1719;--surface:#142024;--sunk:#101a1d;--ink:#e6ebe7;--ink-soft:#a9b8b8;--ink-faint:#7f9191;
  --rule:#24353a;--rule-strong:#35494e;--teal:#6fb3ae;--teal-soft:#17302f;--amber:#e0a53f;--amber-soft:#3a2f16;
  --oxide:#e08874;--oxide-soft:#33201c;}}
:root[data-theme="dark"]{
  --ground:#0e1719;--surface:#142024;--sunk:#101a1d;--ink:#e6ebe7;--ink-soft:#a9b8b8;--ink-faint:#7f9191;
  --rule:#24353a;--rule-strong:#35494e;--teal:#6fb3ae;--teal-soft:#17302f;--amber:#e0a53f;--amber-soft:#3a2f16;
  --oxide:#e08874;--oxide-soft:#33201c;}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:400 1rem/1.6 var(--body);padding-inline:1.25rem;
  -webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--display);margin:0;letter-spacing:-0.015em;text-wrap:balance}
p{margin:0;max-width:68ch}
.wrap{max-width:72rem;margin:0 auto;padding-block:2.2rem 5rem}

/* view switch */
.bar{position:sticky;top:0;z-index:5;background:var(--ground);border-bottom:1px solid var(--rule);
  display:flex;flex-wrap:wrap;gap:.6rem 1rem;align-items:center;padding:.6rem 0;margin-bottom:1.6rem}
.seg{display:inline-flex;border:1px solid var(--rule-strong);border-radius:3px;overflow:hidden}
.seg button{font:600 .78rem var(--display);background:var(--surface);color:var(--ink-soft);border:0;
  padding:.35rem .8rem;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--ink);color:var(--ground)}
.bar .what{font:.76rem var(--mono);color:var(--ink-faint)}
body.as-client .team-word{display:none}
body:not(.as-client) .client-word{display:none}
body.as-client .team-only{display:none!important}

.head{display:grid;gap:.5rem}
.eyebrow{font:500 .68rem var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint)}
h1{font-size:1.9rem;font-weight:700}
.stats{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.9rem}
.stat{border:1px solid var(--rule);background:var(--surface);border-radius:2px;padding:.32rem .6rem;
  font:500 .7rem var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.stat b{font-family:var(--display);font-size:.98rem;color:var(--ink);margin-right:.35rem}
.stat.money b{color:var(--oxide)}.stat.data b{color:var(--amber)}
.mock{display:flex;gap:.5rem;flex-wrap:wrap;background:var(--amber-soft);border-left:3px solid var(--amber);
  padding:.5rem .8rem;border-radius:0 3px 3px 0;font-size:.85rem;margin-top:1.1rem}
.mock b{font-family:var(--display);color:var(--amber)}

.report{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:1rem 1.1rem;
  margin-top:1.4rem;display:grid;gap:.6rem}
.report h2{font-size:1.05rem}
.report .next{border-top:1px solid var(--rule);padding-top:.6rem;color:var(--ink-soft);font-size:.95rem}
.draft{border-left:3px solid var(--teal);background:var(--surface);border:1px solid var(--rule);
  border-radius:0 3px 3px 0;padding:.8rem 1rem;margin-top:1rem;display:grid;gap:.4rem}
.draft .hint{font:.74rem var(--mono);color:var(--ink-faint)}

.cols{display:grid;grid-template-columns:minmax(0,14.5rem) minmax(0,1fr);gap:2rem;margin-top:1.8rem;align-items:start}
@media (max-width:62rem){.cols{grid-template-columns:minmax(0,1fr)}}
.rail{border:1px solid var(--rule);border-radius:3px;background:var(--surface);overflow:hidden}
.rail h2{font:500 .66rem var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint);
  padding:.55rem .7rem;border-bottom:1px solid var(--rule)}
.rail ul{list-style:none;margin:0;padding:0}
.rail li{display:grid;grid-template-columns:1.8rem minmax(0,1fr) auto;gap:.4rem;align-items:baseline;
  padding:.3rem .7rem;font-size:.83rem;border-bottom:1px solid var(--rule)}
.rail li:last-child{border-bottom:0}
.rail .n{font:500 .68rem var(--mono);color:var(--ink-faint)}
.rail .c{font:500 .66rem var(--mono);color:var(--oxide)}.rail .c.zero{color:var(--ink-faint)}
.rail .ph{background:var(--sunk);font:500 .64rem var(--mono);letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-faint);display:block;padding:.3rem .7rem}

.ws{background:var(--surface);border:1px solid var(--rule);border-radius:3px;margin-bottom:1rem;overflow:hidden}
.ws.blocked{border-left:3px solid var(--oxide)}.ws.done{border-left:3px solid var(--teal)}
.ws.in_progress{border-left:3px solid var(--amber)}
.ws-head{display:flex;flex-wrap:wrap;gap:.5rem .8rem;align-items:baseline;padding:.8rem 1rem}
.ws-head h3{font-size:1.05rem;font-weight:600;flex:1 1 20rem}
.chip{font:500 .64rem var(--mono);letter-spacing:.1em;text-transform:uppercase;padding:.14rem .45rem;border-radius:2px}
.s-done{background:var(--teal-soft);color:var(--teal)}.s-in_progress{background:var(--amber-soft);color:var(--amber)}
.s-blocked{background:var(--oxide-soft);color:var(--oxide)}.s-planned{background:var(--sunk);color:var(--ink-faint)}
.sv-money{background:var(--oxide-soft);color:var(--oxide)}.sv-data{background:var(--amber-soft);color:var(--amber)}
.sv-blocked{background:var(--teal-soft);color:var(--teal)}.sv-friction,.sv-ranked{background:var(--sunk);color:var(--ink-faint)}
.meta{font:.7rem var(--mono);color:var(--ink-faint)}
.ws-body{padding:0 1rem 1rem;display:grid;gap:.8rem}
.blurb{color:var(--ink-soft);font-size:.95rem}
.differs{background:var(--sunk);border-radius:2px;padding:.4rem .6rem;font-size:.85rem;color:var(--ink-soft)}
details{border-top:1px dashed var(--rule);padding-top:.6rem}
summary{cursor:pointer;font:500 .72rem var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--teal)}
.trail{list-style:none;margin:.6rem 0 0;padding:0;display:grid;gap:.5rem}
.trail li{display:grid;grid-template-columns:4.2rem minmax(0,1fr);gap:.7rem;font-size:.9rem}
.trail .when{font:.7rem var(--mono);color:var(--ink-faint);padding-top:.15rem}
.trail .who{font:.7rem var(--mono);color:var(--ink-faint)}
.trail li.internal{background:var(--sunk);border-radius:2px;padding:.3rem .4rem;margin-left:-.4rem}
.trail .lock{font:.62rem var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--oxide)}
.prompt{background:var(--sunk);border-radius:3px;padding:.6rem .75rem;display:grid;gap:.35rem}
.prompt .lock{font:500 .64rem var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--oxide)}
.prompt code{font:.76rem var(--mono);color:var(--ink-soft);display:block;overflow-x:auto;white-space:nowrap}
.tablewrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:.86rem}
th,td{text-align:left;vertical-align:top;padding:.4rem .5rem;border-bottom:1px solid var(--rule)}
tr:last-child td{border-bottom:0}
th{font:500 .62rem var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint)}
td .rep{display:block;color:var(--ink-soft);margin-top:.15rem}
td .src{display:block;font:.68rem var(--mono);color:var(--ink-faint);margin-top:.15rem}
.foot{margin-top:2.6rem;border-top:1px solid var(--rule);padding-top:1rem;font:.74rem/1.7 var(--mono);color:var(--ink-faint)}
`;

const trail = (it) => it.events.length ? `<details${it.state === "blocked" ? " open" : ""}>
  <summary>Status history</summary>
  <ul class="trail">
    ${it.events.map(([to, note, who, when, internal]) => `<li class="${internal ? "internal team-only" : ""}">
      <span class="when">${esc(when)}</span>
      <span><span class="chip s-${to}">${LABEL[to]}</span>
        ${internal ? '<span class="lock">internal</span> ' : ""}${esc(note)}
        <span class="who team-only"> — ${esc(who)}</span></span></li>`).join("")}
  </ul>
  ${it.reported !== it.state ? `<p class="differs">Reported on 14 Sep as <strong>${LABEL[it.reported]}</strong> ·
    now ${LABEL[it.state]}.</p>` : ""}
</details>` : "";

const rows = (it) => `<div class="tablewrap"><table>
  <thead><tr><th>Severity</th><th>Finding<span class="team-only"> and repair</span></th><th>Step</th></tr></thead>
  <tbody>${it.covers.map((id) => {
    const t = byId[id];
    const where = t.steps.map((x) => (x.kind === "break-after" ? "after " : "") + String(x.n).padStart(2, "0")).join(", ");
    return `<tr>
      <td><span class="chip sv-${t.severity ?? "ranked"}">${t.severity ?? `rank ${String(t.rank).padStart(2, "0")}`}</span></td>
      <td><strong>${esc(t.title)}</strong>
        ${t.repair ? `<span class="rep team-only">${esc(t.repair)}</span>` : ""}
        ${t.src?.length ? `<span class="src team-only">${esc(t.src.join(" · "))}</span>` : ""}</td>
      <td><span class="src">${where}</span></td></tr>`;
  }).join("")}</tbody></table></div>`;

const html = `<title>NCT Delivery Board</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<style>${css}</style>
<div class="wrap">
  <div class="bar">
    <div class="seg" role="group" aria-label="Who is viewing">
      <button type="button" id="v-team" aria-pressed="true">Team</button>
      <button type="button" id="v-client" aria-pressed="false">Client</button>
    </div>
    <span class="what team-word">Everything: repairs, evidence, internal notes, handover prompts.</span>
    <span class="what client-word">What NCT sees: prompts, internal notes and owner names are hidden.</span>
  </div>

  <header class="head">
    <div class="eyebrow">ZYT Agency · NCT Freight Forwarding · enquiry to invoice</div>
    <h1>Delivery board</h1>
    <p style="color:var(--ink-soft)">Ten workstreams across a 27-step flow. The weekly report is the
      approved summary; every workstream below shows where it stands right now.</p>
    <div class="stats">
      <span class="stat"><b>${n("done")}</b> shipped</span>
      <span class="stat"><b>${n("in_progress")}</b> in progress</span>
      <span class="stat"><b>${n("blocked")}</b> blocked</span>
      <span class="stat"><b>${n("planned")}</b> planned</span>
      <span class="stat team-only"><b>${tasks.length}</b> findings</span>
      <span class="stat money team-only"><b>${sev("money")}</b> money</span>
      <span class="stat data team-only"><b>${sev("data")}</b> data</span>
    </div>
  </header>

  <div class="mock"><b>Mock</b><span>The flow and the ${tasks.length} findings are real; states, owners,
    dates and notes are sample data.</span></div>

  <section class="report">
    <h2>Week of ${WEEK}</h2>
    <p><strong>Customer records are cleaned up and shipped.</strong> Duplicate customers can no longer be
      created by spelling, and credit limits are checked when an invoice is raised.</p>
    <p>Quoting and enquiry recording are underway. One piece is waiting on you: we need a decision on who
      may approve their own work before approvals can be locked down.</p>
    <p class="next"><strong>Next week:</strong> finish the enquiry channel record, start carrying customer
      details through to the invoice.</p>
  </section>

  <section class="draft team-only">
    <h2 style="font-size:1rem">Friday draft — not yet sent</h2>
    <p>Assembled from this week's state changes. Edit the wording, then publish to NCT.</p>
    <p class="hint">${n("done")} shipped · ${n("in_progress")} in progress · ${n("blocked")} blocked on a client decision</p>
  </section>

  <div class="cols">
    <aside class="rail">
      <h2>The flow<span class="team-only"> · findings per step</span></h2>
      <ul>${flow.phases.map((p) => `<li class="ph">${p.key} · ${esc(p.label)}</li>` +
        flow.steps.filter((s) => s.phase === p.key).map((s) => `<li>
          <span class="n">${String(s.n).padStart(2, "0")}</span><span>${esc(s.title)}</span>
          <span class="c team-only${openOn(s.n) ? "" : " zero"}">${openOn(s.n) || "—"}</span></li>`).join("")).join("")}
      </ul>
    </aside>

    <main>
      ${items.map((it) => `<section class="ws ${it.state}">
        <div class="ws-head">
          <h3>${esc(it.title)}</h3>
          <span class="chip s-${it.state}">${LABEL[it.state]}</span>
          ${it.since ? `<span class="meta">since ${esc(it.since)}</span>` : ""}
          <span class="meta team-only">${it.owner ? "owner " + esc(it.owner) : "unassigned"}</span>
          <span class="meta team-only">${it.covers.length} finding${it.covers.length === 1 ? "" : "s"}</span>
        </div>
        <div class="ws-body">
          <p class="blurb">${esc(it.blurb)}</p>
          ${trail(it)}
          ${it.prompt ? `<div class="prompt team-only"><span class="lock">Team only · handover prompt</span>
            <code>${esc(it.prompt)}</code></div>` : ""}
          ${rows(it)}
        </div>
      </section>`).join("")}
    </main>
  </div>

  <p class="foot">Generated from tracker/seed/*.json · one board, two audiences ·
    the client view hides prompts, internal notes and owner names, nothing else.</p>
</div>
<script>
(function(){
  var team=document.getElementById("v-team"),client=document.getElementById("v-client"),KEY="zyt.board.view";
  function set(view,save){
    document.body.classList.toggle("as-client",view==="client");
    team.setAttribute("aria-pressed",String(view!=="client"));
    client.setAttribute("aria-pressed",String(view==="client"));
    if(save){try{localStorage.setItem(KEY,view)}catch(e){}}
  }
  team.addEventListener("click",function(){set("team",true)});
  client.addEventListener("click",function(){set("client",true)});
  var saved="team";try{saved=localStorage.getItem(KEY)||"team"}catch(e){}
  set(saved,false);
})();
</script>`;

mkdirSync("mocks", { recursive: true });
writeFileSync("mocks/board.html", html);
console.log("workstreams:", items.length, "| findings:", tasks.length,
  "| team-only blocks:", (html.match(/team-only/g) || []).length);
