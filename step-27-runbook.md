# Step 27 Runbook: from plan to merged code

**For:** whoever implements SOP step 27 (close the month: the customer statements, DEBIT NOTEs and profit sheets from Cost lines, the Financial Stat tabs and files, the month-end pack, and closing the finished jobs)
**Written:** 2026-09-21 · **Base branch:** `feat/new-layout`, evidence HEAD `6bb3a1bf` · **Repo:** `nct-layout`
**Plan owner:** Wilfred. He merges the PRs, deploys, and runs anything that touches production.
**Readiness:** 7/10 (the plan's score). Every decision settled 2026-09-21.

This is how to turn the /planpro plan for step 27 into merged code. It covers **Waves 22 and 23**, which continue the global numbering:
- Waves 1–4 are `steps-4-10-runbook.md`'s.
- Waves 5–11 are `steps-11-15-runbook.md`'s.
- Waves 12–16 are `steps-16-19-runbook.md`'s.
- Waves 17–21 are `steps-20-26-runbook.md`'s.

`steps-1-3-runbook.md` keeps its own Waves 1–3.

Each wave runs in its own git worktrees, one Claude Code session per worktree, and no two sessions edit the same code at the same time.

**Every decision for step 27 is settled.** Wilfred settled D1–D11 on **2026-09-21**, taking the recommended option in every case with no exception (all A), and settled the steps 20–26 cross-plan items X28–X40 the same day as that crosscheck words them. The plan's §9 says which option is **Chosen**. Sessions implement that option and do not re-open it. §1 records what was settled. Step 27 is a single plan, so it has no separate crosscheck file. **§2 "Collisions with steps 01–26"** takes its place. It was checked against every plan in `plans/` and against the code at `6bb3a1bf`.

---

## 0. What you are building

| Step | Plan file | What it fixes | Phases | Migration | Readiness |
|---|---|---|---|---|---|
| 27 | [`step-27-month-close-truth.md`](/nct/step-27-plan/) | The month-end files add currencies together: the Financial Stat PDF, and the export totals labelled 本位币. Statements and DEBIT NOTEs can span several counterparties, and the order-page statement prints carrier costs and 利润. The Financial Stat tabs use UTC days while the pack uses the branch zone. The receipts tab stops at 200 rows without saying so. Ageing cannot show open bills that have no due date. Three profit bases carry no labels. Financial Stat has no link to the month-end documents. The month picker runs on the UTC clock. No screen can end or lock a job | 3 | none (D2-A; only D2-C, not chosen, would have needed `00NN_org_setting_report_timezone`) | 7/10 |

The phases:
- **Phase 1** (findings 1, 2, 3, 5, 11). Every month-end total names its currency, or is withheld with a sentence. A statement or DEBIT NOTE goes to one counterparty. The receipts tab says when it is capped. Journeys 1 and 2.
- **Phase 2** (findings 4, 7, 8, 9, 10). A month means the branch's days on every Financial Stat tab and in the pack. Ageing counts undated bills. Profit figures name their basis. Financial Stat links to the documents, and the picker uses the local clock. Journey 3.
- **Phase 3** (finding 6). Per-row **End job / Cancel end / Lock job / Unlock job** on the trade ledgers, over the existing `collectiveOrder.transition` verb. Journey 4.

The plan is also a page on this site — the file name above links to it.

<a class="rb-dl" href="/nct/downloads/all-plans.zip" download>⤓ Download all plans <small>every plan and crosscheck in the plans folder, plus the runbooks</small></a>

The smaller [step-27-plans.zip](/nct/downloads/step-27-plans.zip) in *Get the files* holds only what this runbook needs.

Under the settled options **no wave in this runbook migrates**, and no phase needs an owner-run database write.

### Get the files

**Download everything this runbook needs:** [step-27-plans.zip](/nct/downloads/step-27-plans.zip). It holds this page's markdown (`step-27-runbook.md`) and the step plan (`step-27-month-close-truth.md`).

Unzip it to `C:/nct-plans/`. The prompts below use that path, so change them if yours differs. The zip is rebuilt on every site deploy, so re-download it if the pages have changed since. Make sure your copy of the plan shows **Decided 2026-09-21 — Chosen: A** in §9; a download from before the settlement does not.

The plans are **not in git**, so the zip (or the folder `C:\Project\ZYT-Task\plans\` from Wilfred) is the only way to get them.

The code repo `C:/Project/NCT/nct-layout` is the only place code changes, and only inside a worktree of it.

---

## 1. Before any wave starts: settle these decisions

**Settled.** Wilfred settled every decision on **2026-09-21**, taking the Recommended option in every case with no exception: D1–D11 are all **A**. The plan's §9 marks each one **Decided 2026-09-21 — Chosen: A** and keeps the three approaches, so a rejected option can be read later. Sessions implement the Chosen option and do not re-open it. This section is kept as the record of what was settled; its heading is unchanged so links to it still work.

The three with visible consequences, as settled:
- **D3-A.** The server refuses a statement or DEBIT NOTE over more than one settlement unit, and the order-page statement becomes "pick a party". Phase 1's API and web deploy together.
- **D11-A.** Per-row End / Cancel end / Lock / Unlock. This **partly reverses the 1 September 2026 product decision** (`d4c7df34`, which removed the bulk lifecycle toolbar), and Wilfred chose it knowing that. Only the per-row verbs come back; no bulk verbs, delete, archive or shut out. **Phase 3 runs, so `wt-step27-close` is created in Wave 22** (§4).
- **D2-A.** The pack's branch zone on every Financial Stat tab. Past tab figures restate by the boundary-hour rows. Probes 27-P5 and 27-P6 still run before Task 2.1 (§8); a contradiction stops that task for a re-plan.

| Plan | Dn | Question | Settled (2026-09-21) | Needed by |
|---|---|---|---|---|
| 27 | D1 | How is a total over several currencies shown on the PDF and the export documents? | **A:** per-currency totals always; the converted total only when its unit can be named (base currency, else the single branch currency); otherwise withheld with a sentence | Wave 22 (27 P1) |
| 27 | D3 | What happens to a statement or DEBIT NOTE over several counterparties? | **A:** the server refuses more than one settlement unit; the dialog offers a required unit pick when it knows the lines | Wave 22 (27 P1) |
| 27 | D4 | What is the statement's third total called? | **A:** relabel 利润 as `净额 (<unit>)` | Wave 22 (27 P1) |
| 27 | D5 | Does a DEBIT NOTE say when lines are already received? | **A:** a notice only; figures unchanged | Wave 22 (27 P1) |
| 27 | D6 | The receipts tab's 200-row cap? | **A:** keep 200; return `total` and `truncated`; say so on the tab | Wave 22 (27 P1) |
| 27 | D11 | Can a job be closed, and how? (partly reverses `d4c7df34`, chosen knowingly) | **A:** per-row End / Cancel end / Lock / Unlock through the existing `transition` verb; no bulk actions | Wave 22 (27 P3) |
| 27 | D2 | Which clock decides a Financial Stat month? | **A:** the pack's branch zone (`resolveMonthEndZone`) on every tab, bucket and Excel/PDF export | Wave 23 (27 P2) |
| 27 | D7 | Open bills with no due date in ageing? | **A:** count them and say so; no re-dating, no bucket change | Wave 23 (27 P2) |
| 27 | D8 | Three profit bases? | **A:** label each surface with its rate and fee scope; no figure changes | Wave 23 (27 P2) |
| 27 | D9 | Where are the month-end documents reached? | **A:** a link on Financial Stat that opens Cost lines filtered to the picked month | Wave 23 (27 P2) |
| 27 | D10 | The month picker's clock and default? | **A:** local calendar; default stays the current month | Wave 23 (27 P2) |

**Cross-plan items, settled the same day.** The steps 20–26 settlements X28–X40 in `steps-20-26-crosscheck.md` are settled as that file proposes them. The ones that reach step 27:
- **X36:** on `order.$orderId.expenses.tsx`, step 20's page edits (P1–P3) → step 22 Phase 2 → step 27 Task 1.5. Met by starting Wave 22 after Wave 20 (§2, §3).
- **X38:** no conditional migration was chosen; had one been, it would be `00NN_<name>`, numbered at merge (§7).
- **X39, X40:** step 27's SOP text corrections follow the same terms as steps 20–26, and stale "no plan yet" references to step 27 in other plans are recorded in §12, not edited.

**Step 26's two hand-offs: accepted gaps, confirmed by Wilfred on 2026-09-21.** Step 26 D2 is settled **A** (the payment sheet gains an optional rate in step 26 Phase 3), so step 26 does **not** hand payment conversion to step 27. Two gaps remain, and step 27 plans no task for either:
- **Step 26 finding F6.** Foreign payments recorded before 26 P3 stay at rate 1, and are summed 1:1 in `getReceiptPayment` (the receipts tab) and the pack (26-P8 sizes them).
- **`bills.totals` and `billTotals` read a NULL bill rate as 1** (step 26 §7.4, "unchanged; step 27").

The Phase 2 release note must not say the receipts tab "reconciles" foreign money for the months those old payments sit in.

---

## 2. Why the waves are in this order

Step 27 has three phases and two write sets:
- **Phases 1–2** write report and export code (`report.ts`, `export.ts`, `artifacts.ts`, `pdf.ts`), the export dialog and Financial Stat.
- **Phase 3** writes the order ledger's row actions.

The two sets share no file (plan §6, and confirmed below). So:

- **Phase 1 → Phase 2 in one worktree.** Phase 2 edits the same regions of `report.ts`, `artifacts.ts` and `financial/index.tsx` as Phase 1 (plan §6 hand-offs A → C, B → D). They cannot run side by side.
- **Phase 3 runs in its own worktree beside Phase 1.** The plan says it "may run in parallel". It prefers step 15 Phase 3 (the `lock` / `end_order` gates) and step 20 Phase 2 (the order page stops deleting locked lines) to be merged first. Both are in by Wave 18.
- **Everything waits for steps 20–26.** Task 1.5 edits one prop on `order.$orderId.expenses.tsx`, which steps 20 and 22 rewrite first. Crosscheck X36 in `steps-20-26-crosscheck.md` sets the order **20 → 22 P2 → step 27**, and 22 P2 is Wave 19. Phase 2's copy is accurate only after 20 P1 (fee rates) and 22 P1 (due dates) are in (plan §7.6).
- **Steps 02 and 03 must be in.** Step 02 Task 1.1 moves `verifiedAmountExpr` out of `report.ts`. Step 03 Phase 1 edits `computeAgeing`. Both rewrite regions that Tasks 1.1, 1.3 and 2.2 edit. Both belong to Wave 1 of `steps-1-3-runbook.md`. **At `6bb3a1bf` neither has landed**: `const verifiedAmountExpr` is still at `report.ts:169`, and `packages/api/src/modules/credit/` does not exist. The Phase 1 prompt checks this and stops if either is missing.

### Collisions with steps 01–26

Every file step 27 writes was grepped for in every plan under `plans/` (steps 01–26 and the three crosscheck files). Each hit was then checked against the code at `6bb3a1bf`. "Read-only" means the other plan cites the file but does not list it under a task's `Files:`.

| Shared code | Step 27 writes | Other plans that touch it | Handled by |
|---|---|---|---|
| `packages/api/src/routers/report.ts`: `verifiedAmountExpr`, `computeAgeing` | 1.1 (reads the expression), 2.1 (`computeAgeing` calls `buildFinancialWhere` at `:601`), 2.2 (`undated`) | **02 Task 1.1** moves `verifiedAmountExpr` to `modules/credit/exposure.ts` [NEW]. **03 Phase 1** adds to the `computeAgeing` detail select, mapping and export rows | `steps-1-3-runbook.md` Wave 1 merged before Wave 22. The prompt greps for it |
| `report.ts`: `getFinancialSummary`, `getProfitAnalysis`, `getProfitBreakdown`, `getProfitStatement`, `getReceiptPayment`, `getBillingRecords`, `exportFinancial`, `exportMonthEndPack`, `buildFinancialWhere`, `resolveMonthEndZone` | 1.1, 1.3, 2.1 | None writes them. Step 22 cites the ageing due date (read-only). Step 26 cites `:2891` (`write_off.fx_gain_loss`) and `:2429-2431` (payment conversion, its F6), both read-only | No collision. F6 is a gap (§1, §12) |
| `packages/api/src/routers/report.test.ts` | 1.4, 2.3 | 02 (regression run), 03 (the four-bill call-list test). Different `describe` blocks | Rebase. The source-grep test at `:2190-2318` is a trap (§10) |
| `routers/export.ts`, `modules/export/artifacts.ts`, `modules/export/xlsx.ts`, `modules/report/pdf.ts` and their tests; `report.month-end.test.ts` | 1.1, 1.2, 1.4, 2.3, 2.5 | None writes them. 15 re-runs `export.test.ts` in its Phase 3 list. 21 cites `export.ts:231` and 11 cites `artifacts.ts:393-397`, both read-only | No collision. The new check goes **before** the `export_document` gate calls in `collectRows`, which step 15 relies on and which stay in place |
| `apps/web/src/components/export-table-dialog.tsx` | 1.5 | None | — |
| `apps/web/src/routes/_next/expenses/cost-lines.tsx` | 1.5: one `lines` prop on the `<ExportTableDialog>` mount (`:2239`, next to Create Bill and 标记为…) | 15, 20, 21, 22 edit other regions (Create Bill, `CreateBillDialog`, review toolbar) | Different region. The second to merge rebases. 22 P2 is in by Wave 19 |
| `apps/web/src/routes/_next/order.$orderId.expenses.tsx` | 1.5: one `lines` prop on the mount (`:796`) | **20** (all three phases), **22 P2** (the Cost Detail link), and read-only citations in 11, 14, 15, 19, 21 | **X36**: 20 → 22 P2 → 27 Task 1.5. Met at Wave 22 |
| `apps/web/src/routes/_next/report/financial/index.tsx`, `report/business/index.tsx` | 1.5, 2.4 | None. Step 03 only walks `/report/financial` in its §10 | — |
| `apps/web/src/components/order-ledger/order-row-actions.tsx` | 3.1 | **15 Task 2.1**: comment block `:54-63` only. 13, 14 and 17 cite `ReviewMenu` / `engineReview` here, read-only | 15 is long merged (Waves 5–11). Leave the review comments as 15 left them |
| `apps/web/src/components/order-ledger/order-ledger-page.tsx` | 3.1: pass `process` / `locked` at the two `<OrderRowActions>` mounts (`:157`, `:1228`) | 12, 13, 15, 18 and 19 cite it, read-only | No collision |
| `packages/api/src/modules/collective-order/permissions.ts` | 3.2: the comment at `:34-48` only | **13 Task 2.2** (`reopen`, `:17-18`, `:84-93`); **15 Task 2.1** (`isEndpoint` on `review`, `:94-98`) | Neighbouring blocks, long merged. Run `registry.sync.test.ts` anyway |
| `collectiveOrder.transition` (`routers/collective-order.ts:3581`) | none (Phase 3 adds its first web caller) | **15 Phase 3** seeds the `lock` / `end_order` / `shut_out` gates for new orgs. 15 P1 locks the content writers | No edit. Phase 3 exercises 15's gates |
| `e2e/specs/order.lifecycle.spec.ts` [NEW] | 3.3 | None | — |
| `packages/api/src/modules/export/month-end.ts` | none (read-only) | 22 and 26 cite it, read-only | — |

**Nothing in steps 01–26 writes any of step 27's report or export files except steps 02 and 03.** Every other overlap is either one prop in a page that steps 20 and 22 rewrite first, or neighbouring comments.

---

## 3. The waves at a glance

```
                   Wave 22        Wave 23
wt-step27          27 P1          27 P2
wt-step27-close    27 P3
```

| Wave | Starts when | Runs in parallel | Merge order in the wave | Decisions (settled 2026-09-21) | Probes Wilfred runs first | Deploy notes |
|---|---|---|---|---|---|---|
| **22** | all of Wave 20 merged (Wave 21, 26 P4, is optional and shares no file), and `steps-1-3-runbook.md` Wave 1 (02 P1, 03) merged | `wt-step27`: 27 Phase 1 (Agent A then Agent B, one session, one PR) · `wt-step27-close`: 27 Phase 3 | 27 P1 → 27 P3 (disjoint files; either order works) | **D1, D3, D4, D5, D6** A (P1); **D11** A (P3) | 27-P1, P2, P3, P4 for the P1 release note (D1/D3 sizing); 27-P7 for D6. **27-P9, P12, P13 before 27 Task 3.1** | **27 P1: API and web together** (under D3-A the order-page statement refuses until the unit pick lands). Build `apps/web` first. **27 P3: web only.** Release note: Lock refuses unapproved jobs in orgs whose Order flow ticks `lock` (27-P12) |
| **23** | Wave 22's 27 P1 merged (27 P3 need not be) | `wt-step27`: 27 Phase 2 | 27 P2 | **D2, D7, D8, D9, D10** A | **27-P5, 27-P6 before 27 Task 2.1**; 27-P8 for the D7 wording (re-run after 22 P1 is deployed); 27-P10, P11 for the D8 note | API first is safe; web captions can follow. **Release note:** past tab figures restate by the boundary rows (P5/P6 counts); filed packs do not change |

**D11 is settled A,** so 27 P3 runs in Wave 22 and `wt-step27-close` is created with `wt-step27`.

**Faster alternative, Wilfred's call only.** No step 27 phase needs Wave 21 (26 P4 edits only `invoices.list` and one column of `invoices.tsx`). Phase 3 needs nothing after Wave 18. So 27 P3 could start after Wave 18, and 27 P1 after Wave 20. This runbook keeps one start line after Wave 20. A session does not move itself earlier.

---

## 4. One-time setup

In your main `nct-layout` checkout, before a wave starts:

```bash
git fetch origin
git switch feat/new-layout
git pull --ff-only
```

Create a wave's worktrees **when that wave starts**, so each branches from the latest base.

```bash
# from the nct-layout folder

# Wave 22 (both worktrees: D11 was settled A, so Phase 3 runs)
git worktree add ../wt-step27       -b feat/step27-month-close-truth  origin/feat/new-layout
git worktree add ../wt-step27-close -b feat/step27-job-lifecycle      origin/feat/new-layout

# Wave 23: no new worktree. wt-step27 rebases onto the base that contains 27 P1 (§6).
```

Then run `bun install` inside **each** new worktree, and start `claude` there in its own terminal.

> A worktree is an extra folder on its own branch that shares one git history. Each Claude session gets its own folder, so no session can overwrite another's edits or sweep them into its commit.

Which worktree carries which phases:
- `wt-step27`: Phase 1 (Wave 22), then Phase 2 (Wave 23). Each phase is its own PR; rebase between them (§6).
- `wt-step27-close`: Phase 3 only (Wave 22). It exists because D11 was settled A.

Only one session commits in a worktree at a time: confirm the index is empty before `git add`.

**The main checkout is not on the base branch.** At the time of writing `C:/Project/NCT/nct-layout` sits on `feat/intake-golden-path-e2e` at `ea1560e7`, with e2e-only commits past `6bb3a1bf`. Worktrees branch from `origin/feat/new-layout`, so those specs are invisible to every session unless they have merged. Wilfred decides what happens to them. **No session stashes, resets or checks out anything, in any worktree, for any reason.** Every §10 walk re-reads `ACTORS` in `e2e/fixtures/seed-cli.ts` by symbol at its own base commit.

**Two parallel sessions, one set of dev ports.** Only one worktree's dev servers (`:3101` web, `:3000` API) can run at a time. Sessions that reach their browser proof queue for the ports (§10).

---

## 5. The prompt for each session

Paste one of these into the session in the matching worktree. They follow one template:
- read the plan and §2 of this runbook;
- name the phase;
- state that the decisions are settled, and implement the Chosen option;
- re-locate by symbol;
- prove it with the plan's §10, and stop.

### Wave 22 — `wt-step27` (Phase 1)

```text
Read C:/nct-plans/step-27-month-close-truth.md in full, and §2 "Collisions with steps 01-26" and §12 of
C:/nct-plans/step-27-runbook.md.
Implement PHASE 1 ONLY (Tasks 1.1-1.5: Agent A's backend tasks 1.1-1.4 first, then Agent B's 1.5 once
check-types sees Artifact.notices and getReceiptPayment's truncated). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-A, D3-A, D4-A, D5-A, D6-A) — implement the Chosen option and do
not re-open it.
Before you start, check the prerequisites and stop and tell me if either is missing:
  - step 02 Task 1.1: verifiedAmountExpr is no longer defined in packages/api/src/routers/report.ts and
    packages/api/src/modules/credit/exposure.ts exists;
  - step 03 Phase 1: computeAgeing's detail query carries step 03's contactsOnFile field (the
    contact_counts derived table).
The plan was read at 6bb3a1bf and steps 02-26 have moved every line: re-locate getFinancialSummary,
exportFinancial, buildFinancialPdf, FinancialPdfSummary, getReceiptPayment, collectRows, buildArtifact,
buildStatement, buildDebitNote, buildProfitSheet, renderXlsx, both <ExportTableDialog> mounts and the
receipts card BY SYMBOL at HEAD, never by line.
When you extract computeFinancialSummary (Task 1.1), the report.test.ts test "names every procedure that
builds an axis expression" greps each handler's source for /buildFinancialWhere|computeAgeing/. Add
computeFinancialSummary to that pattern; never drop getFinancialSummary from CONSUMERS and never weaken an
assertion.
Task 1.5 on the order page: if settlementUnit is masked for the member, the dialog cannot group the lines;
leave the server refusal as the guard, as §4.2 says for the unticked path.
Re-run e2e/specs/dynamic-params.bank-accounts-export.spec.ts; if it exports a mixed-unit selection, give its
fixture one settlement unit, never loosen the rule.
Prove it with the plan's §10: the Phase 1 test command, then Journeys 1 and 2, Journey 3 steps 1-2, and edge
cases 1, 2 and 3 in the browser at localhost:3101. Restart :3000 after the last packages/api edit. Read test
and type-check output for "failed"; exit codes lie.
API and web ship together in one PR (plan §7.5). Never run git stash, git reset or git checkout. Never point
anything at production.
```

### Wave 22 — `wt-step27-close` (Phase 3)

```text
Read C:/nct-plans/step-27-month-close-truth.md in full, and §2 "Collisions with steps 01-26" and §12 of
C:/nct-plans/step-27-runbook.md.
Implement PHASE 3 ONLY (Tasks 3.1-3.3). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D11-A, per-row End / Cancel end / Lock / Unlock, no bulk verbs;
it partly reverses d4c7df34 and was chosen knowing that) — implement the Chosen option and do not re-open it.
Before Task 3.1, ask me for probes 27-P9, 27-P12 and 27-P13. If 27-P12 shows orgs with lock ticked and a
large unapproved backlog, say so in the PR's release note; a contradiction with D11 stops the task.
You edit only order-row-actions.tsx, the two <OrderRowActions> mounts in order-ledger-page.tsx, the comment
in modules/collective-order/permissions.ts and the new e2e spec. No server change: transition already carries
the gates, process checks and audit. Keep the review comments step 15 left in order-row-actions.tsx.
The Actions cell types its row as { id: string }. Widen it to the ledger row's real shape so process and
locked are type-checked; do not cast. Render the Lifecycle menu only when !isReview.
The plan was read at 6bb3a1bf: re-locate OrderRowActions, both mounts, collectiveOrder.transition, the
lifecycle node keys and ACTORS in e2e/fixtures/seed-cli.ts BY SYMBOL at HEAD.
Prove it with the plan's §10: the Phase 3 test command, Journey 4 and edge case 5 in the browser at
localhost:3101, and regression check 5 (/approve/order shows no Lifecycle menu). Run the new spec with node
from e2e/out/_walk/ if it hangs under bun. Read output for "failed"; exit codes lie.
Web only. Never run git stash, git reset or git checkout. Never point anything at production.
```

### Wave 23 — `wt-step27` (Phase 2; rebase first)

```text
Read C:/nct-plans/step-27-month-close-truth.md in full, and §2 "Collisions with steps 01-26" and §12 of
C:/nct-plans/step-27-runbook.md. Phase 1 is merged; rebase onto origin/feat/new-layout first.
Implement PHASE 2 ONLY (Tasks 2.1-2.5). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D2-A, D7-A, D8-A, D9-A, D10-A) — implement the Chosen option and do
not re-open it. D2-A adds no migration.
Accepted gaps (confirmed by Wilfred, 2026-09-21), not yours to fix: foreign payments recorded before step 26
Phase 3 stay at rate 1 in getReceiptPayment and the pack (step 26 F6), and bills.totals / billTotals read a
NULL bill rate as 1. The release note must not claim the receipts tab reconciles foreign money.
Before Task 2.1, ask me for probes 27-P5 and 27-P6. If boundary rows are material in closed months already
handed to a bookkeeper, stop and we decide the release note together.
Task 2.1: grep every buildFinancialWhere( and every to_char( in report.ts and list them all in the PR. At
6bb3a1bf there were seven buildFinancialWhere call sites (computeAgeing, getFinancialSummary,
getProfitAnalysis, getProfitBreakdown, getProfitStatement, getBillingRecords, exportFinancial). Beyond the
plan's list, getFinancialSummary has its own UTC-day filter on write_off.verified_at: zone it too. computeAgeing
builds its own UTC month/day anchors: list them, and ask me before changing an ageing bucket.
Write the boundary test first and run it against the old predicates; paste that failure into the PR.
The plan was read at 6bb3a1bf: re-locate buildFinancialWhere, getReceiptPayment, getProfitAnalysis's
buckets, getProfitStatement's axisDate, the pack's zonedDay, resolveMonthEndZone, computeAgeing, exportAgeing,
the Month-end pack button and the month picker BY SYMBOL at HEAD, never by line.
Shared copy: grep apps/web/src and packages/api/src for every caption you add or replace ("Gross profit",
利润, 本位币) and list every instance in the PR.
Prove it with the plan's §10: the Phase 2 test command, Journey 3 steps 3-6, and edge case 4 in the browser at
localhost:3101. Restart :3000 after the last packages/api edit. Read output for "failed"; exit codes lie.
Never run git stash, git reset or git checkout. Never point anything at production.
```

> If the session has the `/execute` skill, `/execute C:/nct-plans/step-27-month-close-truth.md` works too. Tell it the phase in the same words, and repeat the "decisions are settled", "re-locate by symbol" and "never stash, reset or checkout" lines.

---

## 6. Keeping a branch up to date

Before a branch's PR is merged, bring it up to date with whatever merged ahead of it. Do this inside its worktree:

```bash
git fetch origin
git rebase origin/feat/new-layout
bun install
bun run check-types
git push --force-with-lease
```

Do the same **between Phase 1 and Phase 2 in `wt-step27`**. Rebase onto the base that now contains the merged Phase 1, and start the Phase 2 session only after `bun run check-types` is clean.

**If the rebase stops on a conflict:** resolve it by hand, `git add <file>`, then `git rebase --continue`. If you're unsure which side is right, `git rebase --abort` puts the branch back exactly as it was. Then ask.

**Never use `git stash`, `git reset` or `git checkout -- <path>`**, in any session, for any reason. The stash stack is shared by every worktree and every session on the machine.

After every rebase, re-run `packages/api/src/architecture.test.ts` and `apps/web/src/architecture.test.ts`, then the `report.test.ts` source-grep test (§10).

---

## 7. Migrations: numbers are assigned at merge

**Under the settled options, no phase in Waves 22–23 adds a migration.** The plan carries one conditional migration:

| Plan | Conditional migration | State |
|---|---|---|
| 27 | `00NN_org_setting_report_timezone` (nullable `org_setting.report_timezone text`) under D2-C | Not chosen (D2-A settled 2026-09-21 reuses `resolveMonthEndZone`) |

**Rule (as X14, X26 and X38): if a migrating option is Chosen, the migration is written `00NN_<name>` and takes the next free number at the moment its branch is rebased for merge**, exactly as `steps-4-10-runbook.md` §6 describes. It must pass all three gates:
- tags equal files;
- contiguous idx;
- the PGlite chain replay (`bunx vp test run packages/db/src/migrations.test.ts`).

**No owner-run database write is needed** under the settled options. Phase 3 writes lifecycle state only when a person presses the button, through the audited `transition` verb.

Before each phase, confirm the journal still ends where the merged steps left it. At HEAD `6bb3a1bf` it ends at idx 64, `0065_quotation_send_decision`, before the numbers steps 01–26 took at merge. Read `packages/db/src/migrations/meta/_journal.json` **and** the migrations table — never a command's exit code.

---

## 8. Stop gates: owner only

Every probe is a read-only `SELECT` against production, and **Wilfred runs all of them with the owner's override.** No session connects to production, ever. The full SQL lives in the plan's §7.7.

**Run the probes for a wave before the code is written, not before the merge.** Several of them gate a specific task, and a probe that contradicts its decision stops that task for a re-plan rather than being argued away. The decisions are settled (§1), so the probes now re-check them and feed the release notes; a probe never re-opens a decision by argument, but a contradiction stops its task for a re-plan.

| Wave | Probe | Question | Gates |
|---|---|---|---|
| 22 | 27-P1 | Per org: is a base currency set, and how many branch currencies carry money? | D1-A release note (who loses the converted line on exports) |
| 22 | 27-P2 | Financial Stat PDFs already produced, and how many had no currency filter | Sizing (how far finding 1 already reached filed documents) |
| 22 | 27-P3 | `export.download` counts by kind | D3-A release note (how often mixed statements went out) |
| 22 | 27-P4 | Jobs whose fees span more than one settlement unit | D3-A release note (every order-page statement of these mixes parties) |
| 22 | 27-P7 | Months with more than 200 payments | D6-A release note |
| 22 | **27-P9** | `collective_order` process / locked / archived distribution | **Before 27 Task 3.1** (D11 re-check) |
| 22 | **27-P12** | `lock` / `unlock` / `end_order` / `shut_out` gates ticked on Order review flows | **Before 27 Task 3.1** (D11; who gets refused). ⊂ step 15's P1 (ticked gates per Order flow) |
| 22 | **27-P13** | Roles holding the lifecycle nodes | **Before 27 Task 3.1** (D11 and its release note: accounting holds none) |
| 23 | **27-P5** | Payments whose UTC month differs from their branch-zone month | **Before 27 Task 2.1** (D2 re-check and release note) |
| 23 | **27-P6** | Bills whose UTC creation month differs from their branch-zone month | **Before 27 Task 2.1** (D2 re-check and release note) |
| 23 | 27-P8 | Open bills with no due date, and how many also have no company | **D7 wording**. Overlaps 22-P4's `no_due_date` column (all bills, not only open ones). Re-run after 22 P1 is deployed, because new bills start carrying due dates |
| 23 | 27-P10 | Bills whose rate differs from their lines' rates | D8 sizing |
| 23 | 27-P11 | Unbilled fees by month | D8 sizing |

**Duplicates and overlaps — run once, report under both ids.**
- 27-P12 is a subset of step 15's P1 (its ticked-gates column, restricted to the four lifecycle gates). If 15-P1 was read recently, reuse it.
- 27-P8 and 22-P4 both count bills with no due date. 22-P4 counts all bills; 27-P8 counts open bills per side and currency. Run 27-P8; it is not a pure duplicate.
- 26-P8 (foreign payments stored at rate 1) sizes the accepted gap confirmed on 2026-09-21 (step 26 D2-A covers new payments only). Read it beside 27-P5 for the Phase 2 release note (§1, §12).

Do not ask Wilfred for the same reading twice in one wave.

**Sizing probes that gate nothing** (27-P2, 27-P10, 27-P11) can be run at any point. They belong in the PR description and the release note, not in front of the code.

Message template, one per wave:

```text
Wave <N> (<step and phases>) is ready to start. Before any code, can you run these read-only production
probes with the owner's override and send me the counts?

  <id> — <one-line question> — from step-27-month-close-truth.md §7.7
  <id> — <one-line question> — from step-27-month-close-truth.md §7.7

<id> gates <task>: if it contradicts <decision>, I stop and we re-plan rather than work around it.
Decisions are settled (Wilfred, 2026-09-21: <27 Dn-A, …>); these counts re-check them and feed the release note.
Nothing here writes; they are SELECTs only. I will not run anything against production myself.
```

**Deploying is separate from merging, and is Wilfred's call.** The per-wave deploy notes are in §3. The couplings that bite:
- **27 P1: API and web together.** Under D3-A an API-first deploy makes every order-page statement refuse until the unit pick lands.
- **27 P2: API first is safe,** and the release note carries the P5/P6 counts.
- **27 P3: web only.** Accounting cannot press Lock (no lifecycle grant); say so in the release note.

Build `apps/web` before every deploy so a failed deploy does not split the stage.

---

## 9. Checklist before each PR

Run inside the worktree once its session says it is done:

- [ ] The phase implements the option marked **Chosen** in the plan's §9 (all A, settled 2026-09-21) and re-opens none.
- [ ] `bun run check-types`: **read the output.** It can exit 0 while printing "failed". Confirm `apps/web` and `seed` actually ran.
- [ ] `bun run test`, and the phase's own test command from the plan's §10: read each output for `failed`, not the exit code.
- [ ] If the phase touched `packages/api`: `packages/api/src/architecture.test.ts` passes. A green from `apps/web/src/architecture.test.ts` is a different gate; run both. Re-run them after every rebase.
- [ ] Phases 1–2: the `report.test.ts` block "every financial date axis survives every handler that reads one" passes. Every consumer is still in `CONSUMERS`, and no assertion was weakened (§10).
- [ ] Phase 2: the tabs-agree-with-the-pack boundary test was seen **failing** on the old predicates, and that run is pasted into the PR. Every `buildFinancialWhere(` and `to_char(` site in `report.ts` is listed with its new form.
- [ ] Phase 3: `permissions/registry.sync.test.ts` passes (the comment edit sits beside declared node keys), and `e2e/specs/order.lifecycle.spec.ts` passes.
- [ ] Phase 1: `e2e/specs/dynamic-params.bank-accounts-export.spec.ts` passes with one settlement unit in its fixture.
- [ ] Migrations: none is expected (§7; D2-A was chosen, not D2-C). If the diff contains one, it is wrong: stop and ask.
- [ ] Shared copy: every string the phase changed was grepped across the worktree, per the project rule. That covers `本位币`, `利润 (本位币)`, "were converted at 1.0", "Gross profit", the two mixed-currency sentences, the one-counterparty refusal and the basis captions.
- [ ] The plan's §10 walked in the browser at `localhost:3101`, **one worktree's dev servers at a time** (§10). The actor was confirmed with `fetch('/api/auth/get-session')` before each actor's steps.
- [ ] Every hunk read in `git diff origin/feat/new-layout...HEAD`, not just the file list.
- [ ] Commit, push, open the PR:

```bash
git add -A
git commit -m "fix(report): <what> (SOP step 27 phase N)"   # fix(order) for phase 3
git push -u origin <branch>
gh pr create --base feat/new-layout --fill
```

Then ask Wilfred to merge, **in the order in §3**.

**Close the loop.** After each merge, tick the fixed defects on the SOP page (*When a Customer Comes In*) under step 27's *What to fix first*, and paste the PR link as a comment.

---

## 10. Traps in this repo

| What you see | Why | Do this |
|---|---|---|
| `report.test.ts` fails "in the CONSUMERS table but no longer reads a date axis" right after Task 1.1 | The test greps each handler's source for `/buildFinancialWhere\|computeAgeing/`. Once `getFinancialSummary` calls the extracted `computeFinancialSummary`, its handler no longer contains either name | Add `computeFinancialSummary` to the pattern. Keep `getFinancialSummary` in `CONSUMERS`. Never delete the check |
| The boundary test passes on the old code too | Its fixtures seed noon-UTC instants, so no row crosses a day | Use the plan's four instants (`15:59Z` / `16:00Z` on the last day of each month) for a KL branch, and paste the failing run first |
| Phase 2 moves some tab figures but not others | `getFinancialSummary`'s write-off verified-day filter and `computeAgeing`'s anchors build their own `to_char(...)` outside `buildFinancialWhere` | List every `to_char(` in `report.ts`; zone the period filters; ask before changing an ageing bucket |
| The tab and the pack still disagree for one viewer | `resolveMonthEndZone` uses the viewer's active branch when no branch filter is set, and UTC for a multi-branch org with no active branch (plan adjacent 1) | Expected under D2-A; test with a branch filter set. D2-C is the alternative |
| The order-page statement refuses right after deploy | API deployed before web under D3-A | Deploy Phase 1 API and web together |
| The unit select never appears on the order page | The member's `settlementUnit` column is masked, so the grid carries no unit | Correct: the server refusal (a count, no names) is the guard |
| A converted total vanished from an org's exports | Its branches use different currencies and no base currency is set (D1-A) | Intended. The notice names the fix: set 本位币 in Parameters. Release note with the 27-P1 counts |
| Lock job refuses with "requires review approval first" | The org's Order flow ticks `lock` (step 15 Phase 3 seeds it for new orgs) | Intended; the gate's own sentence. Release note with 27-P12 |
| `process` / `locked` read as `undefined` in the row menu | The Actions cell types its row as `{ id: string }`, and a cast hides the missing fields | Widen the type to the ledger row; never `as` |
| A locked job's fee still deletes on the order page | Step 20 Task 2.1 not merged | 20 P2 is Wave 18; check it is in before the Phase 3 proof |
| An API change "doesn't work" but returns 200 | `bun --hot` doesn't reload `packages/api` changes | Restart the API server before any browser check, and check its start time |
| Type-check "passed" but the log says failed | `vp run` exit codes lie | Grep the output for `failed` and `error TS` |
| The new e2e spec hangs at chromium launch | Playwright launch hangs under bun | Run it with `node` from `e2e/out/_walk/`; a spec with project dependencies may need `--no-deps` and its env vars |
| The browser shows the other worktree's changes | Both worktrees want `:3101` (web) and `:3000` (API) | Stop every dev server, then start only the worktree you're checking |
| The browser checks another org's data | One login is shared across sessions, and whoever switches org last redirects everyone | Confirm the actor with `fetch('/api/auth/get-session')` and the active org before each step |
| A pane screenshot is solid white | Pane screenshots can return blank while the DOM is fine | Assert on the DOM (`read_page`, `get_page_text`), not the screenshot |
| The first-morning picker check passes without the fix | The console `Date` override was applied after the page read the clock | Override `Date`, then reload, as §10 edge case 4 says |
| Every line number in the plan is wrong | Steps 02–26 rewrote `report.ts`, `cost-lines.tsx` and the order fees page after the plan was read | Re-locate by symbol at HEAD. The plan's line numbers were read at `6bb3a1bf` and are historical |
| The e2e fixtures look different from the plan | The main checkout carries e2e-only commits past `6bb3a1bf` on another branch | Never stash, reset or checkout. Re-read `ACTORS` by symbol at your base commit |
| The session can't find the plan | Plans aren't in git | Give it the absolute path to your downloaded copy under `C:/nct-plans/` |

**Accepted gaps, stated plainly (confirmed by Wilfred, 2026-09-21).** Step 27 closes none of these, and no session should invent a fix:
- **Foreign payments at rate 1 in the receipts tab and the pack** (step 26 F6, 26-P8). Step 26 D2 is settled A: staff can capture a rate for new payments from 26 P3 on; old ones stay at 1. Step 26 does not hand payment conversion to step 27.
- **A NULL bill rate read as 1** in `bills.totals` / `billTotals` (step 26 says "unchanged; step 27"; step 27 plans nothing).
- **No period close or month lock** (plan out of scope; the pack's header rules it out).
- **The pack's zone depends on the viewer's active branch** (plan adjacent 1; accepted with D2-A, D2-C not chosen).
- **The default file name stamps the UTC date** (plan adjacent 2), and **Excel / PDF always export bill detail**, honouring six filter fields (adjacent 3; SOP text).

---

## 11. Clean up

Only once a branch is merged **and** `git status` in its worktree is clean:

```bash
# from the nct-layout folder
git worktree remove ../wt-step27-close
git branch -d feat/step27-job-lifecycle
```

Keep, until their last phase has merged:

- **`wt-step27`** — through Wave 23 (Phase 2). Do not remove it after Wave 22.
- **`wt-step27-close`** — through Wave 22 (Phase 3).

---

## 12. Where the plans and the crosscheck disagree

Step 27 has no crosscheck file. This table records where the plan disagrees with the code at `6bb3a1bf`, with another plan, or with §2 of this runbook, and each row says which reading this runbook uses. On 2026-09-21 the plan was edited to record the settled decisions, X36 and the step 26 accepted gaps; rows it now agrees with say so. None of these rows changes a settled decision.

| Subject | Code / other plans / this runbook say | The plan says | Reading used here |
|---|---|---|---|
| Steps 02 and 03 prerequisites | At `6bb3a1bf`, `const verifiedAmountExpr` is still at `report.ts:169` and `modules/credit/` does not exist, so 02 Task 1.1 has not landed. Both 02 P1 and 03 are `steps-1-3-runbook.md` Wave 1 | §5, §7.8: "merged before Phase 1" | Agreed; the Phase 1 prompt checks and stops |
| `computeAgeing` and `buildFinancialWhere` | `computeAgeing` calls `buildFinancialWhere` at `:601`. There are seven call sites in all | §4.4: "`computeAgeing` (if it uses it; re-check)"; §7.1 "seven handlers" | It does. Seven call sites; Task 2.1 zones all of them |
| UTC days outside `buildFinancialWhere` | `getFinancialSummary` filters write-offs by `to_char(write_off.verified_at, 'YYYY-MM-DD')` (`:1843-1850`). `computeAgeing` builds `to_char(anchor, 'YYYY-MM')` / `'YYYY-MM-DD'` (`:656`, `:876`) | §4.4 names `buildFinancialWhere`, `getReceiptPayment`, the trend buckets and SELECT-list `to_char(${dateExpr}` only | Zone the summary's write-off period filter too. List the ageing anchors and ask before changing a bucket (D7-A promises unchanged buckets) |
| The source-grep test in `report.test.ts` | Checks both directions (`:2297-2318`). Extracting `computeFinancialSummary` breaks the "no longer reads a date axis" direction | §4.1: "the test's handler table is re-checked by the implementer" | Add `computeFinancialSummary` to the pattern (§10) |
| `OrderRowActions` row shape | `order-ledger-page.tsx:157` types the cell row as `{ id: string }` | §4.8: "re-read the row shape at the base commit" | Widen the type; no cast |
| Step 26's hand-offs | 26 F6 (payments at rate 1 in `getReceiptPayment` and the pack) and 26 §7.4 (`billTotals` NULL-as-1) name step 27 as owner. Step 26 D2 is settled **A**, so step 26 does not leave payment conversion to step 27 (that was its option C) | §7.6 (updated 2026-09-21): both are accepted gaps; no task takes either | **Accepted gaps, confirmed by Wilfred on 2026-09-21** (§1, §10). There is no "16–27 crosscheck"; §2 here is the check. No re-plan is needed |
| Step 26 on step 27 | 26 §7.6 still calls step 27 "no plan yet" and says 27 "must decide how reports convert payments recorded before 26 P3 (F6), and whether it restates FX booked before 26 P1 (D11)" | Nothing | Stale (X40 terms). Step 27's answer: F6's old payments are an accepted gap, and 26 D11-A (report only) means step 27 restates no FX |
| Where 22 thinks step 27 edits Cost lines | The export mount is `cost-lines.tsx:2239`; `:1944` is a pagination-reset effect | **22 §7.6**: "27 (no plan yet) … its month-end menu at `:1944`" | Step 27's reading (§9 SOP row 4). 22's "no plan yet" is stale |
| Order of 20, 22 and 27 on the order fees page | X36 (`steps-20-26-crosscheck.md`, settled 2026-09-21): 20 → 22 P2 → 27 Task 1.5 | §5 and §7.6 (updated 2026-09-21): X36's order | Agreed; met by starting at Wave 22 |
| Phase 3's timing | Phase 3 shares no file with Phases 1–2, and its preferred prerequisites (15 P3, 20 P2) are in by Wave 18 | §6: "may run in parallel with them on its own worktree" | Wave 22 beside Phase 1. It could start earlier, but that is Wilfred's call (§3) |
| Who can press Lock | `roles.ts:174`: accounting holds no lifecycle node | Journey 4 and §4.8: ops or a branch manager; accounting asks | Agreed; the release note says so (27-P13) |
| Readiness | Not re-scored here | 7/10, now limited by the Phase 2 restatement, the knowing `d4c7df34` reversal, unmerged prerequisites and unrun probes (decisions settled 2026-09-21) | The plan's score, 7/10 |

---

## 13. Not covered here

- **Steps 01–26.** `steps-1-3-runbook.md`, `steps-4-10-runbook.md` (Waves 1–4), `steps-11-15-runbook.md` (Waves 5–11), `steps-16-19-runbook.md` (Waves 12–16) and `steps-20-26-runbook.md` (Waves 17–21). This runbook's Wave 22 starts only after Wave 20, plus `steps-1-3-runbook.md` Wave 1.
- **Options not chosen (not planned as work):**
  - D1-C (refuse exports without a base currency);
  - D2-C (an org-level report zone, and its migration);
  - D3-B (one file with a section per unit);
  - D6-B (a paginated receipts tab);
  - D7-B (derived due dates);
  - D8-B/C (restating Financial Stat at line rates);
  - D9-B (a nav entry);
  - D10-B (last month by default early in the month);
  - D11-B (the bulk lifecycle toolbar).
- **Out of scope in the plan:** fee rates and settlement companies at entry (step 20), bill company and due date at grouping (step 22), re-dating `bill.due_date` (steps 22/25), a period close or month lock, Business Stat's own date filter, archive and delete on the ledger, shut out, and email send from the export dialog.
- **Adjacent defects the plan flags and does not plan:**
  - the viewer-dependent pack zone;
  - the UTC file-name date;
  - Excel/PDF exporting bill detail whatever tab is open;
  - the order page deleting a locked line (step 20);
  - `cost_line.exchange_rate` defaulting to 1 (step 20).
- **Repairing live data.** No phase writes data. Any restatement or repair is a separate owner decision with its own review.
- **SOP text for step 27.** The plan's §9 "SOP text vs code" lists 14 corrections and edits nothing. Run `/zyt-update` after each deploy. The site is public; Wilfred rebuilds and deploys it from `hosting/`. That includes the `step-27-plans.zip` bundle (a `$bundles` entry in `deploy-site.ps1`) and the plan page this runbook links to.
- **Production access of any kind.** Every probe and every deploy is Wilfred's. Sessions work against the dev Neon branch, and never against `br-round-sun`.
