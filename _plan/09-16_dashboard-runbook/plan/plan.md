# Dashboard: runbook replaces the to-do

**Written:** 2026-09-16 · **Repo:** `C:/Project/ZYT-Task` (site) · **Decisions (Wilfred, 2026-09-16):**
tickable runbook is the main view · the 48 finding to-dos move behind a Findings tab, history intact ·
`WAITING-ON-WILFRED.md` items become owner steps inside the runbook, and the file is retired.

## 1. User journeys

| # | Old | New |
|---|---|---|
| J1 | Open `/` → NCT to-do: 48 findings in 10 workstreams | Open `/` → NCT **Runbook**: ordered stages (Steps 1–3 → 4–10 → 11 → anytime), each a tickable step marked *Session* or *Wilfred*, with a link to the section of the runbook page it comes from |
| J2 | Tick a finding → name dialog → saved in Convex, history in panel | Same interaction on a runbook step (same panel: detail, owner, waits-for, link, history) |
| J3 | — | Click **Findings** tab → today's to-do list exactly as now, ticks and history intact. `?view=findings&task=<id>` deep-links still work (`?task=` alone also opens Findings) |
| J4 | Steps 1–3 runbook exists only as a local HTML file | `/nct/steps-1-3-runbook/` is live and listed in the page list |
| J5 | Open items live in `WAITING-ON-WILFRED.md` on disk | They are *Wilfred* steps in the runbook, placed where they gate work (e.g. production collision count sits before "Step 02 Phase 3") |
| J6 | JWA / ZYT: empty to-do | No runbook seed → the Runbook tab says "No runbook yet" and Findings is shown as before |

## 2. Status found while planning

- Steps 1–3: plans (`nct-layout/_plan/09-14_*`), `steps-1-3-rollout.md` and `steps-1-3-runbook.html` exist. **No code**: no `feat/step1/2/3` branches or worktrees, latest migration is `0065`. All runbook steps start open.
- Steps 4–10, step 11: planned, not started.

## 3. Runbook content (NCT) — draft, for review

Stage **A · Before anyone deploys the site again** (Wilfred)
1. Sync the "ZYT Skill" session: it must deploy from disk including the step-11 page files
2. Browser-check `/nct/customer-intake-sop/` (Show my flow, `?role=`, full-screen chain, fix list)
3. Browser-check `/jwa/full-chain-sop/` ("verified against code" line, role view)

Stage **B · Steps 1–3** (source: `steps-1-3-runbook.md`, anchors per h2)
1. Create worktrees wt-step1/2/3 and start three sessions (Session)
2. Wave 1: step 01 all phases · step 03 all phases · step 02 Phase 1 (Session)
3. Merge step 03 → step 02 Phase 1 → step 01 (`0066`) (Wilfred merges)
4. Wave 2: rebase wt-step2, run step 02 Phase 2, merge (Session / Wilfred)
5. **Gate:** run production collision count with `probe-step2.ts` (Wilfred) — clear duplicates (Task 3.0) if ≠ 0
6. Wave 3: step 02 Phase 3 (`0067`), merge (Session / Wilfred)
7. Close the loop on the SOP page, remove worktrees (Session)

Stage **C · Steps 4–10** (source: `steps-4-10-runbook.md`)
1. One-time setup (§3)
2. Wave 1: 04 · 08 P1+P4 · 05 — **gates before merge:** step 04 prod counts, step 05 role-policy check (Wilfred)
3. Wave 2: 08 P2+P3 · 06 — then step 08 drift count (Wilfred)
4. Wave 3: F.1 · 07 · 09 — **gate:** step 07 clash probe (Wilfred)
5. Wave 4: step 10 — add the "use Correct decision" hint (`correctionPath: true`) to its prompt (Wilfred); **gate:** re-seed script (Wilfred)
6. Clean up (§10)

Stage **D · Step 11 — Convert won quote** (source: `plans/step-11-convert-won-quote.md`)
1. Run read-only production queries P1, P2, P4, P5 (§7); hand P1 list to sales/ops (Wilfred)
2. Tell step 12 and 14 planners the job-number allocator moves to `insert-order.ts` (Wilfred)
3. Phase 1 (X5) in its own worktree, after step 05 merged — needs go-ahead (Wilfred → Session)
4. Prove the conversion lock on the dev DB: two simultaneous Converts → one order (Session)
5. Phase 2 after step 10 merged; Phase 3 after Phase 2 (Session)
6. Fix `tracker/seed/flow-nct.json:155` `/order//edit`; revisit `:143` once Phase 1 merges (Session)

Stage **E · Anytime** (Wilfred)
1. Authorise Cloudflare and Neon MCP servers
2. Set NCT's real App URL (replaces `localhost:3101` default)
3. JWA: add to-do seed + Convex seed mutation

## 4. Design

- **Seed:** new `tracker/seed/runbook-nct.json` — `{ stages: [{ id, title, blurb, source, steps: [{ id, title, detail, owner: "wilfred"|"session", waitsFor?: [ids], link?: "/nct/…#anchor", src?: [] }] }] }`. Step ids prefixed `rb-nct-` and treated as permanent Convex keys.
- **Convex:** no schema change. Runbook steps are rows in `findings` (keys cannot collide with finding ids — `build-seed.mjs` checks). `seed:nct` in `convex/seed.ts` also imports `runbook-nct.json` and inserts missing rows; never resets ticks. `board` query unchanged (returns both).
- **projects.json:** `seed.runbook` path (optional per company); new page `Runbook · Steps 1–3`.
- **build-seed.mjs:** load runbook when present; fail on duplicate ids, id overlap with tasks, unknown `waitsFor`.
- **index.html:** tab pair "Runbook | Findings" in `.todo-head`; `S.view` (default `runbook`, `?view=` in URL). `renderRunbook()` reuses `.ws`/`.task` markup (stage = section, step = row with owner chip + waits-for text); `renderPanel()` branches on item type. Show All/Open/Done applies to both views; category select and "workstreams" count only in Findings. `liveOf`/`setDone` unchanged (they key by id).
- **Steps 1–3 page:** convert `steps-1-3-runbook.html` body → `steps-1-3-runbook.md` (h2 = TOC entry, same as 4–10), deploy block in `deploy-site.ps1`, add path to `PAGES` in `hosting/pwa/sw.js`.
- **Docs:** `SITE.md` pages table + "what can change" row for the runbook seed; README link. `WAITING-ON-WILFRED.md` deleted once Stage A/D/E rows exist (content lives in the seed).

Files: `tracker/seed/runbook-nct.json` [new], `steps-1-3-runbook.md` [new], `hosting/hub/projects.json`, `hosting/hub/build-seed.mjs`, `hosting/hub/index.html`, `hosting/convex-app/convex/seed.ts`, `hosting/deploy-site.ps1`, `hosting/pwa/sw.js`, `hosting/SITE.md`, `WAITING-ON-WILFRED.md` [delete].

## 5. Phases

**Phase 1 — J4.** Steps 1–3 runbook page. Gate: dry-run build succeeds; `/nct/steps-1-3-runbook/` renders locally with TOC; content matches the HTML section by section.

**Phase 2 — J1, J2, J3, J6.** Runbook seed + build-seed validation + dashboard view + `seed:nct` extension. Gate: `npx convex dev --once` then `npx convex run seed:nct` on **dev** reports runbook rows inserted; local wrangler + dev Convex in the in-app browser: runbook is default, tick/untick a step with history, Findings tab shows 48 with existing ticks, `?task=nct-identity` deep link opens Findings, JWA shows "No runbook yet", 375px width, light + dark.

**Phase 3 — J5 + ship.** Delete `WAITING-ON-WILFRED.md`, update `SITE.md`/README. **Ask before:** `npx convex deploy -y` + `npx convex run --prod seed:nct` (additive rows only) and the production `deploy-site.ps1`. Gate: live `/` ticks a runbook step; existing finding ticks unchanged.

## 6. Risks

- **Other session deploys from disk.** The "ZYT Skill" session publishes whatever is on disk; a half-finished `index.html` would go live. Mitigation: do Phase 2 edits in one sitting and dry-run before leaving; Stage A step 1 still needs Wilfred.
- **Prod site before prod seed.** If the page ships before `seed:nct --prod`, ticking a runbook step fails with "That task does not exist." Order: Convex deploy + seed first, then site.
- **Key permanence.** Renaming a runbook step id orphans its ticks — same rule as task ids, noted in `SITE.md`.
- **Public site.** Runbook text becomes public (production gate commands, file paths). Same exposure as the existing runbook pages; no secrets included.
