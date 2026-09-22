# Steps 20–26: cross-plan check (2026-09-21)

> **X28–X40 are settled. 2026-09-21: Wilfred accepted the recommended reading of every one of them, with no exception.** The per-decision registers inside the steps 20–26 plans are settled the same way, on the recommended option in each case, except where an X-item below overrides a plan's own recommendation: X28 hands step 21 D1 to step 22; X29 narrows step 20 D6 to locks only (its option B); X30 changes step 25 D7's lock order and the line order key of 21 D10 and 22 D2; X31 makes step 25 D6 superseded under step 24 D4-A. Each heading below now carries a **Settled** line naming the chosen settlement; the analysis under it is kept as written, so the reasoning and the rejected readings stay visible. **Every text fix these items list was applied to the plans on 2026-09-21**, in the same pass that settled them; each Settled line says where.

The seven plans for steps 20–26 were written in parallel on 2026-09-21. All of them read nct-layout HEAD `6bb3a1bf` (`feat/new-layout`), the commit steps 04–19 were planned at. The nct-layout main checkout sits at `ea1560e7` on `feat/intake-golden-path-e2e`, and `git diff --stat 6bb3a1bf HEAD -- packages apps seed` is empty (checked this pass), so every citation under `packages/`, `apps/` and `seed/` matches `6bb3a1bf`.

This pass re-read the seven plans in full. It grepped the steps 02–19 and 27 plans for every file 20–26 write, and checked the collision claims below against the code, read-only. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.

| Step | Plan | Readiness | Migration (settled options) | Decisions (all settled 2026-09-21) |
|---|---|---|---|---|
| 20 | step-20-fee-entry-integrity.md | 7/10 | none (no option in §9 needs one; D1-B would read the existing `cost_line.updated_at`) | D1–D5 A · **D6-B (X29)** · D7–D12 A |
| 21 | step-21-fee-review-integrity.md | 7/10 | none (no option needs one) | **D1 handed to step 22 (X28)** · D2–D11 A (D2 via 22 D2-A, X28; D10 in the X30 order) |
| 22 | step-22-bill-grouping-integrity.md | 7/10 | none (D7-B would be an owner-run data UPDATE, not a migration) | D1-B (= X28) · D2-A (X30 order) · D3–D7 A |
| 23 | step-23-bill-approval-integrity.md | 7/10 | none (no option in D1–D8 needs one) | D1–D6 A · D7-C · D8-A |
| 24 | step-24-invoice-issue-integrity.md | 8/10 | none (no option in D1–D9 needs one) | D1–D9 A (D3-A = X30, D4-A = X31) |
| 25 | step-25-invoice-document-truth.md | 7/10 | none (rejected D1-C would need `00NN_bill_due_date_invoice_anchor`) | D1-B · D2–D5 A · **D6 superseded under 24 D4-A (X31)** · **D7-A in the X30 order** · D8–D10 A |
| 26 | step-26-settlement-integrity.md | 7/10 | none (conditional `00NN_payment_void` D6-B, `00NN_write_off_payment_set_null` D6-C, `00NN_write_off_invoice` D8-B, `00NN_write_off_payment_amount` D10-C, `00NN_written_off_within_amount` D4-C) | D1–D11 A (D5-A = X30; D6-A with the X37 catalog row) |

**The last column is the settled state (2026-09-21).** It replaced a column that listed every decision as open. Under the settled options steps 20–26 add no migration; the migration column is unchanged.

**The seven plans overlap in four places, and three of them are blockers.**
- **`createBill` has two authors (X28).** Step 21 Task 1.1 fixes the gate ids and adds a claim-verb gate. Step 22 Task 1.1 rewrites the same lines inside a new locked transaction, and its D1-B claims the gate fix.
- **`saveChildren`'s cost leg has two authors (X29).** Step 20 Phase 1–2 changes which fees a save deletes and which it freezes. Step 21 Task 2.3 adds a review freeze to the same block. Both plans refuse edits to an **approved** fee, through two different helpers.
- **The ledger's lock order has three authors (X30).** Steps 24 and 26 lock lines before the bill. Step 25 locks the bill before the lines, and says that matches `bills.invoice`. That is true at HEAD and false after step 24 Phase 2.
- **Voiding a paid invoice (X31).** Step 24 D4-A makes a `written_off` bill invoiceable again. Step 25 D6-A refuses the void that produces such a bill, and lists 24's change as its own rejected option B.

---

## 1. Dependencies and required merge order

### Dependencies on steps 02–19

| Task in 20–26 | Needs merged first (02–19) | Why (verified this pass) |
|---|---|---|
| 20 Phase 1 | 11 Phase 2, **15 Phase 1** (Tasks 1.1–1.3) | 11 Task 2.1 moves ~130 lines above `saveChildren` (`collective-order.ts:3954`). 15 Task 1.3 adds `.for("update")` on `saveChildren`'s order load, and 15 D2-B leaves the cost leg outside the order freeze (step 20 D12-A). 14 Phases 2–3 and 15 Task 1.5 wrote `order-form.tsx` first (20 Task 1.6) |
| 20 Phase 2 | none from 15 Task 1.1 | X29 is settled: 20 Task 2.1 no longer calls `assertPostApprovalEditableMany`, so 15's helper is not a prerequisite of this phase |
| 21 Phase 1 | 15 Phase 3, **22 Phase 1 (X28)** | 15 Task 3.3 writes `costLines.create` in the same file. Under X28, 22 P1 owns the `createBill` body 21 edits |
| 21 Phase 2 | 15 Phase 1, **20 Phase 2 (X29)**, 21 Phase 1 | 15's order lock sets the lock order (order row → cost lines). 20 changes the delete set and freezes the 21 check builds on |
| 21 Phase 3 | 08 Phase 2 (Task 2.1 `separationOfDuties`), 08 Task 3.3 (X10 precedent), **15 Phase 2**, **23 Phase 3 (X33)** | 21 Task 3.2 flips a flag 08 creates. 15 Task 2.1 deletes the indirect-write entry beside `architecture.test.ts:871` and two of 21's comment targets |
| 22 Phase 1 | 15 Phase 3 (keep its `costLines.create` gate call) | Different function in `cost-lines.ts`; either order, keep the call |
| 22 Phase 2 | 20 Phase 3 (X36) | Same web file `order.$orderId.expenses.tsx` (22 edits the link at `:928`) |
| 23 Phase 1 | 08 Phases 1–3 (message option, `assertNotUnderReview` docblock, re-submit refusal, `resources.ts` shape) | Verified: `separationOfDuties` is absent from `modules/audit/resources.ts` at HEAD; the `bill` entry is at `:441`, `exists` at `:444`, `cost_line` at `:399` |
| 23 Phase 3 | **15 Phase 2**, 08 Task 3.3 | `architecture.test.ts:872` sits between 21's `:871` and 15's `:876`; the same `isEndpoint` pattern |
| 24 Phase 1 | **02 Phase 1** (24 D7-A) | 02 Tasks 1.2/1.4 edit `billsRouter.invoice` and `InvoicingDialog`. Scheduled in `steps-1-3-runbook.md` |
| 24 Phase 2 | 24 Phase 1 (X30 settled) | Lock order |
| 25 Phase 1 | 11 Phase 3 (Task 3.2 adds one case to `invoice-document.test.ts`) | Additive cases; the second to merge rebases |
| 25 Phase 2 | 25 Phase 1; **24 Phase 3** (X31 settled: 24 D4-A Chosen) | See X31 |
| 26 Phase 2 | 26 Phase 1, **23 Phase 1** (X30 settled) | 23 Task 1.3's `FOR UPDATE` in `bill.exists` makes 26's in-transaction gate read meaningful (26 §7.6) |
| 26 Phase 4 | 25 Phase 2 | Same files (`invoices.ts`, `invoices.tsx`), different procedure |

No 20–26 task needs a step 16–19 phase. Their only shared files are `modules/audit/resources.ts` (16/17 edit `lading.exists`; 21/23 edit `cost_line` and `bill`), `routers/collective-order.ts` (19 edits `enrichOrderRows`; 20/21 edit `saveChildren`) and `packages/api/src/architecture.test.ts`. All three are neighbouring entries or different functions.

### Order within steps 20–26 (under the settled X28–X31)

```
20 P1 ──► 20 P2 ──► 20 P3 ─────────────► 22 P2
22 P1 ──► 21 P1 ──┐
          20 P2 ──┴► 21 P2 ──► 21 P3
23 P1 ──► 23 P2 ──► 23 P3 ──────────────┘ (X33: 23 P3 before 21 P3)
23 P1 ──► 26 P2
02 P1 ──► 24 P1 ──► 24 P2 ──► 24 P3 ──► 25 P2 ──► 26 P4
25 P1 ────────────────────────────────┘
26 P1 ──► 26 P2 ──► 26 P3
```

The binding edges and their reasons:
- **22 P1 → 21 P1** (X28). 22 moves the `createBill` read and guards into a locked transaction. 21's `withdraw_pending` then goes into the moved J4 set.
- **20 P1 → 20 P2 → 21 P2** (X29). All three change the same `saveChildren` cost block. 21's freeze must compute "removed" from 20's delete set.
- **23 P1 → 26 P2.** 26's in-transaction `write_off` gate read serialises against a submit only once `bill.exists` locks.
- **24 P3 → 25 P2** (X31; 24 D4-A is Chosen). 25's void then no longer strands a bill. Its confirm text must not promise a re-issue before the server allows one.
- **23 P3 → 21 P3** (X33). Both remove an `applyReviewBatch` caller, and the first to merge has to handle the indirect-write floor.
- **20 P3 → 22 P2** (X36). The same web page.
- **25 P2 → 26 P4.** The same two files.

---

## 2. Code written by more than one plan (20–26, and against 02–19 and 27)

Collisions are handled by ordering, never by merging by hand. "Different functions" means git merges the rebase cleanly; the later branch still re-locates its code by symbol.

| Shared code | Writers | Handled by |
|---|---|---|
| `routers/collective-order.ts` `saveChildren` cost leg (`:3954`; `settled` `:4189`, `removable` `:4286`, seed `needsSeed`) | 15 P1 (order-row lock, conditional content freeze); **20 Tasks 1.1–1.2** (`loadedCostIds`, `keptUnseen`, `unratedCurrencies`); **20 Tasks 2.1–2.2** (locks, delete pin, approval check, company id); **21 Task 2.3** (cost-row `FOR UPDATE`, `changedKeys` lift, review freeze) | 15 P1 → 20 P1 → 20 P2 → 21 P2. **X29** gives each line one owner |
| `routers/expense/cost-lines.ts` `createBill` (`:2388`; gate `:2502-2508`, J4 `:2481-2496`, claim verb `:388-404`) | **21 Task 1.1** (gate ids, `withdraw_pending`, `reviewFloorGate` on `claim`); **22 Tasks 1.1–1.3** (locked read inside the transaction, gate ids on `tx`, company per bucket, title on a split) | **X28**: 22 P1 owns the body; 21 P1 adds `withdraw_pending` only |
| `cost-lines.ts` writer verbs `update`/`delete`, `batch` delete, `exchangeRateBatch` | 21 Task 2.2 | 21 only. Its loads take `FOR UPDATE` in the X30 order |
| `cost-lines.ts` `review`/`reviewBatch` (`:1465`, `:1530`), writer `review` verb | 21 Task 3.1 deletes | 21 only; allow-list effect in X33 |
| `cost-lines.ts` `costLines.unbill` `delete_fee` comment (`:1432-1434`) | 23 Task 1.2 (comment only) | Different function from 22's `createBill`; either order |
| `cost-lines.ts` `costLines.create` (`expense_entry` gate) | 15 Task 3.3 | 20–26 must keep it; none edits that handler |
| `routers/expense/bills.ts` `billWriter` verbs `update`/`retotal`/`dissolve` (`:507-573`) | 23 Tasks 1.2, 2.1 | 23 only |
| `bills.ts` `bills.review`/`reviewBatch` (`:1186-1244`, `:1387-1455`) | 23 Task 3.1 deletes; **21 Task 3.1 edits a comment at `:1189`, inside the docblock 23 deletes** | X33: if 23 P3 merged first, 21 skips that comment |
| `bills.ts` `billsRouter.invoice` (`:1699`) | 02 P1 (credit re-check); 24 Tasks 1.1–1.2, 2.1, 3.1 | 02 P1 → 24 P1 → 24 P2 → 24 P3 in one worktree |
| `apps/web/src/routes/_next/expenses/bills.tsx` | 23 Task 2.3 (`BillEditDialog`), 23 Task 3.3 (comments); 24 Task 1.4 (`InvoicingDialog` prefill), 24 Task 3.4 (Proforma hint); 02 P1 (InvoicingDialog notice) | Different components. Wave order; the second to merge rebases |
| `apps/web/src/routes/_next/expenses/-bills.columns.tsx` | 23 Task 2.3 (comment `:811-813`), 23 Task 3.3 (comments `:795-807`); **24 Task 3.3 (Invoicing icon `:826`)** | Neighbouring lines in one Actions cell; 23 P2/P3 merge before 24 P3 |
| `routers/expense/invoices.ts` | 25 Tasks 1.3 (loader, `exportDocument`), 2.1 (`cancel`); 26 Task 4.1 (`list`) | 25 P1 → 25 P2 → 26 P4 |
| `apps/web/src/routes/_next/expenses/invoices.tsx` | 25 Tasks 1.5, 2.4; 26 Task 4.2 | 25 P1 → 25 P2 → 26 P4 |
| `modules/export/invoice-document.ts` / `.test.ts` | 25 Tasks 1.1–1.2; 11 Task 3.2 (one test case) | 11 P3 (long merged) → 25 P1 |
| `routers/expense/write-offs.ts` | 26 only (Phases 1–3). 24 Phase 3 relies on `:694` and `:1124` unchanged; 26 keeps both | 26 only; 24's Phase 3 tests re-run after 26 P1 and P2 |
| `routers/expense/payments.ts`, `payments.tsx`, `write-offs.tsx`, `seed/money.ts` | 26 only | none |
| **`packages/api/src/routers/expense.concurrency.test.ts`** (real Postgres; `describe.skipIf(!TEST_URL)` at `:65`, two `it`s at `:105`, `:137` today) | **21 Tasks 1.2, 2.4; 22 Task 1.4; 24 Task 2.2; 25 Task 2.3; 26 Task 2.3** — six writers | **X35**: each adds its own `it`/`describe`, never edits another's; the second to merge in a wave rebases |
| `packages/api/src/architecture.test.ts` | 20 Task 2.1 (comment above `:355-357`); **21 Task 3.1** (remove `:871`, comment `:1266-1271`); **23 Task 3.1** (remove `:872`); 24 Task 2.1 (comment `:404-405`); 25 Task 2.1 (comment only; `:418-421`, `:675-676` must stay); 15 Task 2.1 (removes `:876`); 18 Task 3.1 (execute-site entry) | Entries are line-independent, and comments collide. **X33 for the indirect-write floor** at `:1273` |
| `modules/expense/permissions.ts` | 21 Task 3.1 (`isEndpoint: false` + label on `costLineReview`, `:110-114`); 23 Task 3.1 (`isEndpoint` on `billReview`, `:136-140`); **26 Task 3.1 (new `expense.payment.update` node)** | Neighbouring blocks. Wave order; each runs `registry.sync.test.ts`. X37 for 26's catalog row |
| `modules/audit/resources.ts` | 23 Task 1.3 (`bill.exists` `FOR UPDATE`, `:444`); 21 Task 3.2 (`cost_line` `separationOfDuties: true`, `:399`); 23 Task 3.4 (only if 23 D7-A); 08, 10, 14, 15, 16, 17 (other entries) | Neighbouring entries. Wave order; the second rebases |
| `modules/governed/gates.ts` | 23 Task 1.1 (new exported `underReviewGate`) | **X34**: 21 P2 reuses it for the delete case |
| `modules/audit/gates.ts`, `post-approval.ts` | 08, 15 Task 1.1; read only by 20–26 | X29 is settled, so 20 Task 2.1 does not call 15's `assertPostApprovalEditableMany` |
| `routers/expense/batch.ts` | 21 Task 2.2 (`SkippedLine.reason`, `describeSkipped`), 21 Task 3.1 (comment) | 21 only |
| `apps/web/src/routes/_next/order.$orderId.expenses.tsx` | **20 Tasks 1.5, 2.4, 3.1–3.2**; **22 Task 2.1** (link `:928`); 27 Task 1.5 (one prop at the export-dialog mount) | **X36**: 20 → 22 P2 → 27 |
| `apps/web/src/components/order-form.tsx` | 14 P2/P3, 15 Task 1.5 (long merged); 20 Task 1.6 (prefill ref `:970-985`, payload `:1700-1733`) | 20 only in this track |
| `apps/web/src/routes/_next/expenses/cost-lines.tsx` | 22 Tasks 2.1–2.3 (chip list, `CreateBillDialog`); 27 Task 1.5 (one prop at the mount) | 22 P2 → 27 (other runbook) |
| `apps/web/src/routes/_next/expenses/-cost-lines.columns.tsx` | 22 Task 2.2 (`CostLine.orderId`, `:195`); 21 Task 3.1 (comment `:398`) | Different lines; wave order |
| `apps/web/src/lib/expense.ts` | 24 Task 3.3 (`isInvoiceable`); 25 Task 1.5 (a date-only helper, only if missing) | Different functions; different waves |
| `routers/expense/shared.ts` | 24 Task 1.2 (`GENERATED_INVOICE_NO` beside `makeNo`) | 24 only (22 reads `resolveCostLineSelection`) |
| `routers/expense.review.test.ts` | 21 Task 1.2 (J4 describe `:500`), 21 Task 3.3 (`:123-208` rewrite); 23 Task 3.2 (delete `:210-392`) | Different `describe`s. Wave order |
| `routers/expense.rbac.test.ts` | 24 Task 1.3 (`:691` describe); 21 Task 3.3 (`:537-560`); 23 Task 3.2 (delete `:515-525`, `:562`) | Different cases. Wave order |
| `routers/expense.ledger.test.ts` | 26 Task 1.3, 26 Task 3.2 (reverse reason); 25 Task 2.2 (beside `:611`) | Different cases. Wave order |
| `routers/expense.wave1.test.ts` | 21 Task 3.3 (delete `:484-612`); 26 Task 3.2 (reason on `reverse` calls) | Different cases. 26 P3 before 21 P3 |
| `routers/expense.bills.test.ts` | 24 Tasks 1.3, 3.2; 02 P1 | One worktree for 24 |
| `routers/audit-review.test.ts` | 21 Task 3.3 (cost-line self-decision cases `:746`, `:1159-1162`); 23 Task 3.4 (only if 23 D7-A); 08, 14, 15 | Different cases. Wave order |
| `routers/collective-order.costs.test.ts` | 20 Tasks 1.3, 2.3; 21 and 22 re-run it | 20 only writes |
| `routers/counterparty-trim.test.ts`, `routers/expense/bills.terms.test.ts` | 20 Task 2.3; 22 reads `bills.terms.test.ts` for the 0062 replay pattern | 20 only writes |
| `packages/db/scripts/` | 08 Task 3.5 creates the folder; 15, 16, 17 and **21 Task 3.4** (`audit-cost-review-drift-2026-09.sql` [NEW]) add sibling scripts | Different files |
| `cost_line.settlement_company_id` (data, not code) | 20 Task 2.2 stamps it on receivables at source; 22 Task 1.2 resolves the bill's company from the lines, then by exact name | Complementary. Once 20 lands, 22's name lookup is reached less often. **Step 20 must not remove 22's bucket rule** (22 §7.6) |
| Review freeze on `bills.update` vs bill `exchangeRate` | 23 D4-A freezes `exchangeRate` after approval | 26 writes no `bill.exchange_rate` (it reads NULL as unknown, §4.1), so 23's risk "step 26 needs `exchangeRate` after approval" does not arise |
| Race fixture for 24's issue-vs-unbill test | 24 Task 2.2 | After 23 P1, `retotal` refuses an unbill on an approved bill under a non-editable flow. The fixture must use an org with no Bill flow, or one with **Can edit after approval**, or the race is never exercised (see X35) |

---

## 3. Migrations and placeholders

- **Journal head at HEAD:** `packages/db/src/migrations/meta/_journal.json` ends at idx 64, `0065_quotation_send_decision`. Steps 01–10 reserve `0066`–`0074` (two conditional). Steps 11–19 add none under their recommended options.
- **Under the settled options, steps 20–26 add no migration.** None of the waves in §6 migrates.
- **Conditional placeholders.** All already follow the `00NN_<name>` rule (X38):

| Plan | Option | Placeholder as written | State |
|---|---|---|---|
| 25 | D1-C (rejected in the plan) | `00NN_bill_due_date_invoice_anchor` | not chosen (D1-B) |
| 26 | D6-B | `00NN_payment_void` | not chosen (D6-A) |
| 26 | D6-C | `00NN_write_off_payment_set_null` | not chosen (D6-A) |
| 26 | D8-B | `00NN_write_off_invoice` | not chosen (D8-A) |
| 26 | D10-C | `00NN_write_off_payment_amount` | not chosen (D10-A) |
| 26 | D4-C | `00NN_written_off_within_amount` | not chosen (D4-A); would turn a race into a 500 on live data |

- **Not a migration, but an owner-run write:** step 26 Phase 3 adds the permission node `expense.payment.update`. The plan as first written did not say how the node reaches the `permission_node` catalog; it now carries X37's owner-run INSERT. Step 13 D12-A found that `db:seed-nodes` runs in no pipeline and cannot run under bun, and that grants to custom roles or members need the row (FKs `schema/permissions.ts:42-44`, `:107-109`). See X37.
- **Not migrations either:** 20 D8-B, 22 D7-B, 24 D8-B and 26 D11-B are one-off data repairs. None was chosen (all four decisions settled on A, report only). Each would be owner-run and reviewed.

---

## 4. Settlements that span plans (X28 onward)

X1–X16 live in the earlier crosschecks, and X17–X27 in `steps-16-19-crosscheck.md`. Every item below (X28–X40) is **Settled (2026-09-21)** on the reading this pass recommended. X28, X29 and X30 were blockers; X31 decided what 25 Phase 2 contains. The **Proposed** text each item carried is kept in the Settled line, so what was accepted stays readable.

### X28 — Two plans rewrite `createBill`'s gate call, and one of them also moves it. **Blocker.**

**Settled (2026-09-21): Wilfred accepted the recommended reading.** Chosen: **step 22 Phase 1 owns the `createBill` body** — the gate on the resolved ids, the locked read inside the transaction, every guard on the locked rows (22 D1-B, D2-A). Step 21 Phase 1 merges after it, adds `withdraw_pending` to the J4 set only, and drops its `reviewFloorGate` on the `claim` verb. Step 21 D1 reads "handed to step 22 (X28)". Step 21 D2-A is delivered by 22 D2-A plus the one added state. **The text fixes this needs are applied** (2026-09-21): step 21 D1/D2, §4, Tasks 1.1–1.2, §5 and §7.6; step 22 D1 and its order lines.

- **Verified at HEAD:** `assertGatesCleared(context.db, organizationId, "cost_line", input.costLineIds, "create_bill")` at `cost-lines.ts:2502-2508`. The lines are read on `context.db` before the transaction (22 Phase 0 B). The claim verb pins only `billId IS NULL`.
- **21 Task 1.1** changes the argument to the resolved `costLineIds`, adds `withdraw_pending`, and adds a gate to `claim` that re-reads the cache on the writer's locked row. 21 §7.6 recommends 21 P1 before 22, and says "22 must keep the resolved-ids gate and the claim gate".
- **22 Task 1.1** moves the read, the count/billed/J4 checks and the gate inside `context.db.transaction`, reading the lines `.orderBy(…).for("update")`. 22 D1-B recommends that step 22 owns the gate fix, because it restructures the lines around it.
- **Why 22's reading.** Once the lines are locked inside the transaction, J4 runs on the locked rows. A submit's `repaintCache` UPDATE of the same `cost_line` row (`resources.ts:409-432`) then either commits first (and the locked read sees `pending`) or waits. 21's claim gate re-checks the same thing a second time, so it adds nothing. One author for the whole handler body also means one test file for its refusals.
- **Tests.** 22's `expense.create-bill.test.ts` [NEW] carries the gate cases (22 Task 1.4 cases 1–4). 21 Task 1.2 drops its cases 1, 2 and 4, which duplicate them, and keeps case 3 (`withdraw_pending`). It also keeps its real-Postgres interleave (submit racing `createBill`), which now proves 22's lock. It must pass without the claim gate.
- **Rejected alternative, kept for the record — 22 D1-A** (step 21 owns it): 21 P1 merges first with the gate fix and the claim gate, and 22 Task 1.1 moves that call into the transaction unchanged. The claim gate then stays, as redundant belt.

### X29 — Two plans edit `saveChildren`'s cost leg, and both freeze approved fees. **Blocker.**

**Settled (2026-09-21): Wilfred accepted the recommended reading.** Chosen: **order 20 P1 → 20 P2 → 21 P2. Step 21 owns every review-state freeze on every cost-line writer (under review and approved-and-locked), through its `costLineReviewFreezes` helper. Step 20 Phase 2 owns the lock freezes only** (settled, `locked_at`, `rec_pay_locked_at`, the delete pin, the company id). 20 Task 2.1 drops its `assertPostApprovalEditableMany(tx, org, "cost_line", touched)` call and its approval test cases: **20 D6 is Chosen as B (per X29)**, with the approval half moved to 21 D6-A. The cost below (one wave in which an approved fee stays editable from the order page) is accepted. **The text fixes this needs are applied** (2026-09-21): step 20 D6, §4.4, Tasks 2.1/2.3, Journey 5, §10 edge case 4; step 21 §4.3, Task 2.3 and §10 Journey 2.

- **Verified at HEAD:** the cost leg's `settled` predicate (`collective-order.ts:4189`) reads bill/invoiced/written-off only. `removable = existing.filter((r) => !keep.has(r.id))` (`:4286`). No `cost_line` post-approval or under-review call exists on this path.
- **20 D6-A** adds locks and `assertPostApprovalEditableMany` (step 15's helper, generic sentence). **21 D6-A** adds `costLineReviewFreezes` (`modules/expense/review-freeze.ts` [NEW]: under review and approved, one query, the fees named). As written, a save touching an approved fee would be checked twice, under two sentences.
- **Why 21's.** One rule then holds on all five cost-line writers (update, delete, batch delete, FX batch, `saveChildren`), with one sentence that names the fees. It also covers the under-review window, which 20 does not touch.
- **Cost of this reading:** for the one wave between 20 P2 and 21 P2, an approved fee stays editable from the order page, as it is today. The rejected alternative (for the record) was that 20 keeps the approval freeze and 21 Task 2.3 checks `under_review` only on `saveChildren`.
- **Line-level rules that follow:**
  - 21 Task 2.3 computes "removed" from **20's** delete set (`removable` = loaded-and-removed, 20 D1-A), not from `existing − keep`. Otherwise an approved fee added elsewhere after the page loaded, which 20 keeps and counts in `keptUnseen`, would be refused as "removed".
  - 21 Task 2.3 owns the `changedKeys` lift. 20 Task 2.1 extends the existing inline comparator to its `frozen` predicate and does not lift it.
  - 21's `.for("update")` on the `existing` load takes the X30 line order.
- Consequence for step 20's text: Journey 5 step 2's approved-row refusal comes from 21's sentence after 21 P2. Its §10 edge case 4 (the approved half) moves to 21's §10 Journey 2.

### X30 — One lock order for every ledger writer. **Blocker for 22 P1 (its line order), and for 24 P2, 25 P2 and 26 P2.**

**Settled (2026-09-21): Wilfred accepted the recommended reading.** Chosen: **payment (verify and void only) → cost lines `ORDER BY created_at, id` → bill(s) `ORDER BY id`**, for issue (24 D3-A), cancel (25 D7), verify and void (26 D5-A), unbill and dissolve (unchanged). The cancel's pinned `UPDATE invoice` stays first, as today. Step 25 D7 keeps its option A (lock and compute from locked rows) but takes this order instead of bill → lines by id. Every `FOR UPDATE` on `cost_line` in 21 (D10-A: `saveChildren`, `batch`, `exchangeRateBatch`) and 22 (D2-A: `createBill`) orders by `(created_at, id)` instead of `id`. 22, 24, 25 and 26 map `40P01` to CONFLICT. **The text fixes this needs are applied** (2026-09-21): step 25 D7, §4.6 and §7.6; step 21 D10; step 22 D2 and Task 1.1; step 26 D5.

- **Verified at HEAD:**
  - `bills.invoice` updates the bill (`bills.ts:1983`) before the lines (`:2031`).
  - `invoices.cancel` reads the lines unlocked (`invoices.ts:676`).
  - `write-offs.ts` advances the bill after the lines (`:694-697`).
  - No `.for("update")` appears in `invoices.ts`, `bills.ts` or `write-offs.ts` today.
- **Step 25 §4.6 and D7-A** lock "bill then line … the same order `bills.invoice` takes". That describes today's handler, which step 24 Phase 2 reverses to lines then bills. 25 §7.6 also asks step 26 to take "bill, then lines, by id" if it locks verify. **26 D5-A** asks the opposite, and names step 25 as the one to change.
- **Why this order.** Four writers already take lines before the bill: the governed writer's unbill, reverse, step 24's plan, and dissolve. Only 25's new code would take the reverse order.
- **Why `(created_at, id)` everywhere.** 24 and 26 lock billed lines in `(created_at, id)` order. `saveChildren`'s cost load and `exchangeRateBatch` also lock **billed** lines of an order (they skip them after locking), and lines created in one transaction share `created_at` (26 adjacent defect 1). Two orders over the same rows can deadlock. The change costs nothing.
- Step 24 maps `40P01` to CONFLICT; 25 and 26 do the same, so a miss is a retry, not a 500. Step 22's plan also maps it for `createBill` (added 2026-09-21).

### X31 — Re-invoicing a written-off bill: step 24 D4 and step 25 D6 answer the same question

**Settled (2026-09-21): Wilfred accepted the recommended reading.** 24 D4 was settled first, on **A** (a `written_off` bill with an uninvoiced balance is invoiceable and ends `done`). So **25 D6 reads "superseded"** (under 24 D4-A, per X31): no settled-bill refusal in `invoices.cancel`, and 25 Task 2.1 drops the D6-A check. Task 2.4's confirm text says what is now true: "The amount it invoiced goes back to its bill, so the bill can be invoiced again." 25 Task 2.2 case (a) becomes "cancel on a `done` bill succeeds, bill `written_off`, `bills.invoice` re-issues, bill `done`". **25 P2 merges and deploys after 24 P3.** (The branch "if 24 D4 is B or C, 25 D6-A stands" did not arise.) **The text fixes this needs are applied** (2026-09-21): step 25 D6, Tasks 2.1, 2.2 and 2.4, §5 and Journey 3; step 24's Phase 3 deploy note.

- **Verified:** 25 D6-B is literally "Let `bills.invoice` issue on a `written_off` bill (→ `done`)". 25 rejects it only because "it changes step 24's money-minting handler … and overlaps plan 24". Plan 24 recommends exactly that change (Phase 3) for the same dead end (Finding F4: the fee alert says "not invoiced" for `written_off`, `fee-alert.ts:97`).
- Under both A's as written, a paid invoice with a typo is corrected in five steps (reverse → cancel → re-issue → re-verify) when two would do (cancel → re-issue). The refusal would also block a path the server by then supports.
- **Deploy coupling:** 25 P2's new confirm text is false until 24 P3 is deployed. So 25 P2 deploys after 24 P3, never before.
- 25-P8 (bills stranded by a void) then sizes what 24 P3 makes invoiceable on deploy. It adds to 24-P6, and accounting should see both lists before 24 P3 ships.

### X32 — A payable with no vendor: step 20 assumes a step 22 refusal that no plan contains

**Settled (2026-09-21): accepted known gap, recorded.** Chosen: **20 D10-A ships its warning only, and its copy must not promise that billing will refuse.** No plan in 20–26 adds a refusal of a blank settlement unit in `createBill`. The step 22 follow-up (a small Task 1.3b) is **not assigned**: it stays an unplanned follow-up for Wilfred, sized by 20-P10. Until then, blank-vendor payables from several orders still group into one bill addressed to nobody. **The text fixes this needs are applied** (2026-09-21): step 20 D10, §1 Out of scope and Task 3.2; step 22 records the gap.

- 20 D10-A: "Warn on the page; step 22 refuses at bill creation". 20 §1 Out of scope: "Step 22's refusal of blank settlement units in `createBill`".
- 22's plan has no such refusal (grep of "blank" in the step 22 plan: only the invoice-title sentence and a nullable note). Its buckets keep `settlementUnit ?? ""` (`cost-lines.ts:2521-2530`). So blank-vendor payables from several orders still group into one bill addressed to nobody.

### X33 — Deleting the last legacy review verbs: the indirect-write floor, neighbouring lines, and comments that vanish

**Settled (2026-09-21): Wilfred accepted the recommended reading.** Chosen: **23 P3 merges before 21 P3.**
- **23 Task 3.1** removes `:872`, and in the same commit lowers the floor at `architecture.test.ts:1273` (`expect(passed.length).toBeGreaterThanOrEqual(2)`) to the count that remains, with a comment.
- **21 Task 3.1** removes the last entry (`:871`). It replaces the floor with an assertion that `ALLOWED_INDIRECT_WRITES` is empty and that the scanner still runs, so a future helper that receives a money table is still caught.
- `routers/expense/review-batch.ts` is deleted by 21 P3 only if `grep -rn "review-batch"` finds no importer and lint flags it (the default, settled with this item).

21's comment edits at `collective-order.ts:3471`, `collective-order.guards.test.ts:508` and `bills.ts:1189` are skipped wherever the code around them is already gone. **The text fixes this needs are applied** (2026-09-21): step 23 Task 3.1 lowers the floor; step 21 §4.5 and Task 3.1 replace it and skip the dead comment targets.

- **Verified at HEAD:**
  - `ALLOWED_INDIRECT_WRITES` holds three entries (`architecture.test.ts:871`, `:872`, `:876`), and the test asserts `passed.length >= 2` (`:1273`).
  - `applyReviewBatch(` has three callers: `collective-order.ts:3528`, `bills.ts:1415`, `cost-lines.ts:1574`.
  - After 15 P2 removes `:876`, two remain, so the next removal takes `passed` to 1 and fails the floor (unless other refs count; re-count at the base commit).
  - 21 §4.5 says the floor "must still hold". 23's plan does not mention it.
- **Dead comment targets (verified):**
  - `collective-order.ts:3471` sits inside `collectiveOrder.review` (`:3380`–`:3486`), which 15 Task 2.1 deletes.
  - `collective-order.guards.test.ts:508` sits inside `:474-599`, which 15 Task 2.3 deletes.
  - `bills.ts:1189` is the "third of three" line in `bills.review`'s docblock, which 23 Task 3.1 deletes.
- Both phases also edit neighbouring blocks of `modules/expense/permissions.ts` (`:110-114`, `:136-140`) and different cases of `expense.review.test.ts` and `expense.rbac.test.ts`. The second rebases and runs `registry.sync.test.ts`.

### X34 — One `underReviewGate`, not two

**Settled (2026-09-21): Wilfred accepted the recommended reading.** Chosen: **23 Task 1.1's exported `underReviewGate(resourceType)` in `modules/governed/gates.ts` is the shared gate. 21 Task 2.2 uses `underReviewGate("cost_line")` for the `delete` verb in place of its local `underReviewOnDeleteGate`. It names its content-keys variant `costLineContentUnderReviewGate` (not `underReviewGate`), so no local name shadows the shared import.** The text fix is applied in step 21 §4.3 and Task 2.2 (2026-09-21).

- Verified: `cost-lines.ts` keeps a local copy of `postApprovalGate` (`:139`) and imports nothing from `modules/governed/gates.ts`. `bills.ts:68` imports `postApprovalGate` from it. 23 P1 (Wave 17) lands long before 21 P2.

### X35 — Six plans add real-Postgres cases to `expense.concurrency.test.ts`

**Settled (2026-09-21): Wilfred accepted the recommended reading.** Chosen: **each plan adds its own named `it` (or its own `describe` block, for 26) under the existing `describe.skipIf(!TEST_URL)` and never edits another's. Each PR pastes two runs against the dev Neon branch: the failing run on the pre-change code and the passing run after ("skipped" is not a pass; X8 rule). Each lock-changing PR (22 P1, 24 P2, 25 P2, 26 P2) also re-runs every case already in the file, so a lock-order regression shows up in the PR that causes it.** Step 24 Task 2.2 now names the fixture rule below (2026-09-21).

- Writers: 21 Tasks 1.2, 2.4; 22 Task 1.4; 24 Task 2.2; 25 Task 2.3; 26 Task 2.3.
- Verified: `DATABASE_URL_TEST` appears in no workflow (the steps 12–15 crosscheck's X8 finding still holds), so CI skips every case.
- **24's issue-vs-unbill fixture** must use an org whose Bill flow is absent or editable after approval. After 23 P1, an unbill on an approved bill under the seeded flow is refused by `retotal`'s gate, so the race would never run.

### X36 — `order.$orderId.expenses.tsx` passes through three plans

**Settled (2026-09-21): Wilfred accepted the recommended reading.** Chosen: **step 20's page edits run in one lane (20 P1 Task 1.5, 20 P2 Task 2.4, 20 P3 Tasks 3.1–3.2). 22 P2 (the Cost Detail link at `:928`) merges after 20 P3, and step 27 Task 1.5 (one prop at the export-dialog mount) after 22 P2.** 20 §7.6 already asks that 2.4 and 3.x share one frontend session. 22 §7.6 names the file as shared with 20. 27 §7.6 names 20 P1 and 22 P1 as preferred predecessors.

### X37 — The new `expense.payment.update` node needs its catalog row

**Settled (2026-09-21): Wilfred accepted the recommended reading — an owner-run catalog INSERT.** Chosen: **step 26 Phase 3 follows step 13 D12-A's path, with an owner-run, reviewed `INSERT … SELECT … FROM permission_node WHERE key = 'expense.payment.create' ON CONFLICT (key) DO NOTHING`, label equal to the registry label. Wilfred runs it on dev before the Phase 3 proof and on production after the deploy, before any grant to a custom role or member. A read-only `SELECT key, parent_key, is_endpoint FROM permission_node WHERE key = 'expense.payment.update'` confirms it.** Step 26's plan now carries this in §4.4, Task 3.1 and its Phase 3 gates (2026-09-21). Root holders (admin, branch-manager, accounting) reach the node through the `expense` root with or without the row, so the endpoint works on deploy.

- Step 26's plan was silent on the catalog when this item was written (grep of `permission_node` and `seed-nodes` in it found nothing); the settlement added it.
- The executor first reads the `expense.payment.create` row, to match its `module`/`resource`/`action` shape (13 §7 step 3).

### X38 — Migration placeholders

**Settled (2026-09-21): Wilfred accepted the recommended reading.** Chosen: **unchanged rule (X14, X26).** Every conditional migration in 20–26 is `00NN_<name>` and takes the next free number when its branch is rebased for merge. A step that picks a migrating option becomes the only migrating step in its wave; under the settled options none does. All six placeholders in §3 already follow it.

### X39 — SOP text for steps 20–26 has no owner

**Settled (2026-09-21): accepted unowned gap on the X13/X27 terms.** Chosen: **no step or wave is assigned the SOP text for steps 20–26.** A `/zyt-update` pass after a step deploys stays available to Wilfred, but is not scheduled here. Each plan lists its corrections in §9 "SOP text vs code" and edits nothing: 20 (10 rows), 21 (12), 22 (11), 23 (12), 24 (7), 25 (15), 26 (9). Four of them matter to users as soon as the code lands:
- 23's announcement "request withdrawal before changing a bill";
- 24's Proforma note;
- 25's void text;
- 26's "void the write-off, then **Edit** the payment".

Read `C:/Project/ZYT-Task/hosting/SITE.md` before any edit.

### X40 — Stale cross-references inside the plans

**Settled (2026-09-21): record only; no plan is edited for these.** Sessions follow this crosscheck where a plan's own §7.6 disagrees:
- 22, 23, 24 and 25 call steps 20–27 "no plan yet" or "written in parallel", and 26 §7.6 lists step 27 as "no plan yet". Step 27 now has a plan and its own runbook (`step-27-runbook.md`), settled 2026-09-21. (Step 22's §7.6 row for step 27 was corrected in the 2026-09-21 pass, including the export mount at `cost-lines.tsx:2239`, not `:1944`.)
- 20 §7.6 and D12-A place 20 P1/P2 in "Wave 12/13", which are steps 16–19's waves.
- 21 §7.8 defers its order against step 20 to "the steps 16–27 crosscheck" (this file).
- 23 worries that 22 edits `bill.exists` and that 26 writes `bill.exchange_rate`; neither does.

The runbook's §12 lists each one with the reading used.

---

## 5. Read-only production probes (SELECT only; Wilfred runs them with the owner's override)

The full SQL is in each plan's §7.7. Column names were spot-checked against HEAD where a plan's own §7.7 cites them. **"Dup" means run it once, as the other id.** "Gates" names the task a probe must precede; a probe that contradicts its decision stops that task for a re-plan.

| ID | Question | Decides / gates | Dup |
|---|---|---|---|
| 20-P1 | Foreign-currency order fees stored at rate 1, billed vs unbilled | F1 sizing; D8, D12 (take D12-C if large) | |
| 20-P2 | Of those, how many had a covering local rate at creation | D8-B sizing | |
| 20-P3 | Orgs with `fee_savable_without_rate = false` | **Before the 20 P1 release note** (who starts being refused) | |
| 20-P4 | Fees deleted by order-page saves (before minus after) | F2/D1 sizing | |
| 20-P5 | Order fees with quantity 1, unit price 0, amount > 0 | D9 | |
| 20-P6 | Locked or rec/pay-locked unbilled order fees | 20 P2 behaviour change | |
| 20-P7 | Cost review flows; order fees by latest submission | D6 | first query ⊂ 21-P1; second = 21-P2 restricted to `order_id is not null` |
| 20-P8 | Receivables with no company on orders that have a client company | D7, D8 | |
| 20-P9 | Bills with no settlement company, by attribute | context for 22/25 | ⊂ 22-P4 |
| 20-P10 | Order fees with a blank settlement unit | D10; X32 | |
| 21-P1 | Cost review flow per org: enabled, post-approval, withdrawal, gates, reviewers | D1 urgency, D4, D8 | ⊃ 22-P1 |
| 21-P2 | Live fees by latest submission vs cached `audit_status` | D2; **the 21 P2 "withdraw before editing" notice** | |
| 21-P3 | Legacy `expense.costLine.review`/`reviewBatch` use and self-approval | **Before 21 Task 3.1** (D7) | |
| 21-P4 | Orphan `cost_line` submissions by status | D4, D9 | |
| 21-P5 | FX-batch edits after approval | **Before 21 Task 2.3** (D5) | |
| 21-P6 | Single-row edits/deletes and batch deletes after approval | **Before 21 Task 2.3** (D4) | |
| 21-P7 | Fees-page saves on orders holding a reviewed fee | **Before 21 Task 2.3** (D6) | |
| 21-P8 | Engine self-decisions on fees | **Before 21 Task 3.2** (D8) | |
| 21-P9 | Fee submitters by role; accountants per org | **Before 21 Task 3.2** (D8) | second query = 23-P9's second query |
| 21-P10 | Billed fees whose latest review is open or rejected | D9 report | related to 22-P2 |
| 21-P11 | Bills in `create_bill`-ticked orgs carrying never-approved lines | D1, D9 | = 22-P2 (22 groups by status) |
| 22-P1 | Orgs that tick **Create bill** on Cost review | **Before 22 Task 1.1** (release note) | = 21-P1's gates column |
| 22-P2 | Billed lines not `passed` in gated orgs | D7 residue | = 21-P11 |
| 22-P3 | Bills whose total differs from their lines | D7 residue | |
| 22-P4 | Bills with no company; how many D3-A would resolve; no due date | **Before 22 Task 1.2** (D3) | ⊃ 20-P9 |
| 22-P5 | Bills whose lines name two companies | **Before 22 Task 1.2** (D3) | |
| 22-P6 | Bills spanning several orders | **Before 22 Task 2.2** (D5) | |
| 22-P7 | Archived lines on a bill | sizing only | |
| 23-P1 | Bill flow per org: enabled, post-approval, withdrawal, gates, stages | D1, D4, D7; the 23 P1 release note | ⊃ 24-P8, ⊃ 26-P6 |
| 23-P2 | Live bills by latest submission | **Before the 23 P1 release note** | |
| 23-P3 | Ghost submissions (bill deleted) | D2 residue | |
| 23-P4 | `retotal` under review or after approval | **Before the 23 P1 release note** (re-open D1 if routine) | |
| 23-P5 | Header edits during an open review | D3 | |
| 23-P6 | Legacy `expense.bill.review`/`reviewBatch` use | **Before 23 Phase 3** (D5) | |
| 23-P7 | Cache drift vs latest submission | **Before 23 Phase 3** (D5) | |
| 23-P8 | Approved bills missing courier/voucher | **Before 23 Phase 2** (D4) | |
| 23-P9 | Stage-1 self-decisions; accountants per org | before D7 is settled | second query = 21-P9's second query |
| 24-P1 | Invoice numbers by shape per org | D2 sizing | |
| 24-P2 | Generated-shape numbers at or ahead of the INV counter | **Before 24 Task 1.2 ships**; rows go to accounting | |
| 24-P3 | `invoice_line` rows on lines no covered bill owns | D8 residue | |
| 24-P4 | Bills whose invoiced amount disagrees with issued coverage | D8 residue | ⊂ 25-P9 |
| 24-P5 | Invoices whose amount differs from coverage | D8 residue | |
| 24-P6 | `written_off` bills with an uninvoiced balance | **Before the 24 P3 deploy** (tell accounting); X31 | related to 25-P8 |
| 24-P7 | Categories in use, incl. proforma | D5 | |
| 24-P8 | `input_invoice_no` on per org | SOP context | = 23-P1's gates column |
| 24-P9 | Numbers differing only by case/space | out-of-scope sizing | |
| 24-P10 | Billed lines whose status disagrees with their amounts | D8 residue | related to 26-P9 |
| 25-P1 | Issued invoices whose printed term differs from the bill's snapshot | **Before 25 Phase 1** (D1) | |
| 25-P2 | Document due date vs `bill.due_date` | only if D1-C is reconsidered | |
| 25-P3 | Multi-bill invoices with different terms | **Before 25 Phase 1** (D2) | |
| 25-P4 | Invoices whose UTC date is not the branch day | **Before 25 Phase 1** (D4) | |
| 25-P5 | Issued invoices printing the buyer's name only | D8; release note | |
| 25-P6 | Roles denied buyer fields, and members | **Before 25 Phase 1** (D3) | |
| 25-P7 | Exported but never marked Downloaded, by role | **Before 25 Phase 1** (D5) | |
| 25-P8 | Bills stranded by a void | **Before 25 Task 2.1** (D6; X31) | ⊂ 24-P6 |
| 25-P9 | Bills whose invoiced total disagrees with lines or live coverage | **Before 25 Task 2.1** (D7) | ⊃ 24-P4 |
| 26-P1 | FX booked on the two fabricated routes | D1, D11 | |
| 26-P2 | Over-spent receipts and over-settled lines | D4, D11 | |
| 26-P3 | Live wrong-side write-offs by payment way | **Before 26 Task 1.2** (D3; re-plan to B if `reconciliation` use appears) | |
| 26-P4 | Payments stuck with only voided write-offs | D6 | |
| 26-P5 | Voids without a reason; self-voids | D7 | |
| 26-P6 | Is `cancel_write_off` ticked anywhere | D7 | = 23-P1's gates column |
| 26-P7 | Bills with every line settled that never advanced | D11 | |
| 26-P8 | Foreign payments stored at rate 1 | D2; **accepted gap** (confirmed 2026-09-21 in step 27's settlement: old payments at rate 1 stay as stored) | |
| 26-P9 | Line written-off drift vs live split rows | D11 | related to 24-P10 |
| 26-P10 | Issued invoices whose bills carry live settlements | D8 | |
| X37-chk | `permission_node` row for `expense.payment.update` | read-only check after the owner-run INSERT (26 P3) | |

**Run once, report under both ids:** 21-P11 = 22-P2 · 22-P1 = 21-P1's gates column · 24-P8 and 26-P6 = 23-P1's gates column · 20-P9 ⊂ 22-P4 · 24-P4 ⊂ 25-P9 · 21-P9's second query = 23-P9's second query · 20-P7 is 21-P1 plus 21-P2 restricted to order fees. 25-P8 ⊂ 24-P6, but the two are asked at different times (Wave 20), so report 24-P6 with the 25-P8 subset marked.

---

## 6. Suggested waves for a runbook for steps 20–26

This continues the global numbering: Waves 1–4 are `steps-4-10-runbook.md`'s, 5–11 `steps-11-15-runbook.md`'s, and 12–16 `steps-16-19-runbook.md`'s. A wave starts only when every branch of the previous wave has merged. Worktrees are created when their wave starts. No wave below migrates under the settled options.

**The "Before starting" column was written before the decisions were settled.** Its decision and X-item ids are all settled now (2026-09-21); read them as "implement the Chosen option", and treat the probe ids as the only live gates.

| Wave | Starts when | Runs in parallel | Merge order in the wave | Before starting | Deploy notes |
|---|---|---|---|---|---|
| **17** | all of Wave 16 merged | 20 P1 · 22 P1 · 23 P1 · 25 P1 · 26 P1 | 23 P1 → 22 P1 → 26 P1 → 25 P1 → 20 P1 | X28, X30 (22 P1's line order), X35; 20 D1–D5, D11, D12; 22 D1–D3, D6; 23 D1–D3, D6; 25 D1–D5, D8–D10; 26 D1, D3, D9; probes 22-P1, 22-P4, 22-P5, 25-P1/P3/P4/P6/P7, 26-P3; 20-P3 and 23-P2/P4 for release notes | 20 P1 server first; 22 P1, 23 P1 API only; 25 P1 API before web; 26 P1 API first |
| **18** | Wave 17 merged | 20 P2 then P3 (one session) · 21 P1 · 23 P2 · 24 P1 · 26 P2 | 23 P2 → 24 P1 → 21 P1 → 26 P2 → 20 P2 → 20 P3 | **X29**, X30 (26 P2), X32; 20 D6–D10; 21 D1, D2; 23 D4; 24 D1, D2, D6, D7, D9; 26 D4, D5; probes 23-P8, 24-P2; 02 P1 merged | 23 P2 API and web together; 24 P1 server first; 26 P2 server only; 20 P3 web only |
| **19** | Wave 18 merged | 21 P2 · 22 P2 · 23 P3 · 24 P2 · 26 P3 | 23 P3 → 24 P2 → 21 P2 → 26 P3 → 22 P2 | X33, X34, X36, X37; 21 D3–D6, D10, D11; 22 D4, D5; 23 D5, D7; 24 D3; 26 D2, D6, D7; probes 21-P5/P6/P7, 22-P6, 23-P6/P7 | 21 P2 API first, announce "withdraw before editing"; 23 P3 API only; 24 P2 server only; 26 P3 web and API together, plus the X37 catalog row |
| **20** | Wave 19 merged | 21 P3 · 24 P3 · 25 P2 | 24 P3 → 25 P2 → 21 P3 | X31; 21 D7–D9; 24 D4, D5; 25 D6, D7; probes 21-P3, 21-P8/P9, 24-P6, 25-P8/P9 | 24 P3 server before web, accounting told first; **25 P2 only after 24 P3 is deployed**; 21 P3 API only |
| **21** (optional) | Wave 20 merged | 26 P4 | 26 P4 | 26 D8-A | API first |

Why five lanes at once in Waves 17–19: each lane's primary write set is disjoint (checked against each plan's §6), and every shared file in a wave is a different function or a different `describe`. The two same-file pairs are 23 P1/22 P1 on `cost-lines.ts` (a comment in `unbill` vs `createBill`) and 23 P2/24 P1 on `bills.ts` and `bills.tsx` (the `update` verb and `BillEditDialog` vs `invoice` and `InvoicingDialog`). The merge order puts each pair's earlier half first.

**Faster alternative (Wilfred's call only).** No 20–26 phase needs a step 16–19 phase (§1), so Wave 17 could start after Wave 11 instead of Wave 16, beside Waves 12–16. The cost is rebasing over 16/17's `resources.ts` entries and 18's allow-list line. A session does not move itself earlier.
