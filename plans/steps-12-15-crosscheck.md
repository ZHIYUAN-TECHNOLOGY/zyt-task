# Steps 11–15: cross-plan check (2026-09-17)

> **X6–X16 are settled. 2026-09-17: Wilfred accepted the recommended settlement for every one of them, with no exception.** Step 11 was already fully decided (D1-B, D2–D9 A, 2026-09-16). The per-decision registers inside the steps 12–15 plans are settled the same way, on the recommended option in each case. Each heading below now carries a **Settled** line naming the chosen settlement; the analysis under it is kept as written, so the reasoning and the rejected readings stay visible. Where a settlement needed an edit in a plan, the Settled line says whether that edit is already carried.

The four plans for steps 12–15 were revised in parallel on 2026-09-17. All of them read nct-layout HEAD `6bb3a1bf` (`feat/new-layout`), the same commit steps 04–11 used. This pass re-read the plans and checked the claims below against that HEAD, read-only. Every `file:line` cited was found by symbol this pass. Paths are relative to `C:/Project/NCT/nct-layout`, and `[NEW]` marks a file that does not exist yet.

| Step | Plan | Readiness | Migration (recommended options) | Open blocking decisions |
|---|---|---|---|---|
| 11 | step-11-convert-won-quote.md | 7/10 | none (conditional `0075_…` only if D3-B/C, and D3-A was chosen) | none, all decided |
| 12 | step-12-job-number.md | 9/10 | none (`0076_…` only if D3-B) | D1, D2, D6 |
| 13 | step-13-intake-decisions.md | 8/10 | none (`00NN_collective_order_intake_actor` only if D3-B/C) | D1, D2, D3, D5, D6, D7, D9, D11 |
| 14 | step-14-job-shape.md | 7/10 | none (D3-B CHECK, D6-C fleet columns or D8-B `audit_flow` column would add one) | D1, D2, D3, D4, D5, D8, D9 |
| 15 | step-15-order-approval-integrity.md | 7/10 | none (`00NN_audit_submission_content_hash` only if D11-B) | "X1" (its own label, see X6), D1–D5, D7–D10 |

**The last column is the state as of 2026-09-17 morning, kept for the record.** On 2026-09-17 Wilfred settled all of them on the recommended option, so no decision in this table blocks a wave any more. The migration column is unchanged: under the settled options steps 11–15 add no migration.

---

## 1. Dependencies and required merge order

### Dependencies on steps 04–10

| Task in 11–15 | Needs merged first (04–10) | Why |
|---|---|---|
| 11 Phase 1 | 05. It is rebased over 08 Phase 3 | 05 edits `quotation.ts`. 08 Task 3.3 deletes the legacy `quotationsRouter.review` (`quotation.ts:3845`), which sits directly above `convertToOrder` (`:3887`) (step 11 D4-A) |
| 11 Phase 2 | 10 (all) | 10 Task 2.1 puts its pending-correction refusal in the same `convertToOrder` region, and 10 Task 2.2 edits `importFromQuote` (step 11 §7) |
| 11 Phase 3 | 06 (and 07) | Quantities above 1 and floored lines must exist for D8-A's test data (step 11 Phase 3 dependencies, Risks) |
| 12, 13 Phase 2 | none directly. They depend on 11 Phase 2 | Step 11 moves `collective-order.ts:2288-2418` to `modules/collective-order/insert-order.ts` [NEW] and re-keys `architecture.test.ts:488`/`:505` |
| 14 Phase 1 | 07 Phase 3, 08 (all phases), 10 Task 1.2 | `modules/audit/resources.ts` and `submit.ts` are written by 07 (`assertPublishable?`), 08 (Task 1.2 `quotation.exists` lock, Task 2.1 `separationOfDuties`, Task 3.2 re-submit refusal) and 10 (`onPassed?`, new entry). See X9 on reusing 07's hook |
| 15 Phase 1 | 08 Phase 1 (Tasks 1.2, 1.3), 08 Phase 3 (Task 3.1), 10 Task 1.2 | Lock pattern on `exists`; the `gates.ts:103-129` docblock; the optional message argument on `post-approval.ts` that `…Many` mirrors; `resources.ts`/`seed.ts` shape |
| 15 Phase 2 | 08 Phase 2 (Task 2.1), 08 Task 3.3 **with X10 applied** | The `separationOfDuties` flag must exist before 15 turns it on. The `registry.sync.test.ts:22` fix must be the same in both plans |
| 15 Phase 3 | 10 Task 1.2 | `modules/audit/seed.ts` `SEEDED_FLOWS`, `AUDIT_TRIGGER_TYPES` |

### Order within steps 11–15 (after X6 and X7 are settled as recommended)

```
11 P1 ─(Wave 1)
10 ──► 11 P2 ──► 11 P3
            ├──► 12 P1 (+P3) ──► 15 P1 ──► 15 P2 ──► 14 P1 ──► 14 P2 ──► 14 P3
            │                                              └──► 15 P3
            └──► 13 P2 (rebases by symbol over 12 when 12 merges first)
13 P1 ─(any wave; web only)          12 P2 (SOP text) ─ after 11 P2 is DEPLOYED
```

The binding edges and their reasons:
- **11 P2 → 12 P1.** 12 adds a lock and widens the re-stamp predicate that 11 Task 2.4 creates in `assignNumber`. 12 also imports `normaliseJobNumber` from the moved module.
- **11 P2 → 13 P2** (13 D10-A). This avoids rebasing through the allocator move and the edits to allow-list entries next to `architecture.test.ts:495-496`.
- **12 P1 → 15 P1.** Step 12 Task 1.1 owns `.for("update")` on `assignNumber`, and 15 adds only the freeze after it (X7).
- **15 P1 → 14 P1.** 14's readiness check is only sound once the under-review freeze and the lock in `collective_order.exists` are in place (X6).
- **15 P2 → 14 P1** (recommended, not forced). It deletes `collectiveOrder.review`/`reviewBatch`, the RPC bypass of readiness (14 D7). Both phases also write the `collective_order` entry in `resources.ts` and `audit-review.test.ts`, so they must be sequential anyway.
- **14 P1 → 15 P3.** Both write `seed/operations.ts` (X12), `audit-review.test.ts` and e2e audit specs.
- **14 P1 → 14 P2 → 14 P3.** Step 14 passes `order-form.tsx` from Phase 2 to Phase 3, and Phase 2 imports `job-shape.ts` from Phase 1.

---

## 2. Code written by more than one plan (11–15 and 04–10)

Collisions are handled by ordering, never by merging by hand. "Different functions" means git merges the rebase cleanly. The later branch still re-locates its code by symbol.

| Shared code | Writers | Handled by |
|---|---|---|
| `routers/collective-order.ts` allocator region `:2288-2418` | 11 Task 2.1 (moves it) | Everyone after 11 P2 re-locates by symbol (about 130 lines shift) |
| `collectiveOrderRouter.assignNumber` (`:2770`) | 11 Task 2.4 (re-stamp, `restampedLines`); 12 Tasks 1.1–1.2 (lock, widened predicate); 15 P1 (`assertNotUnderReview`) | 11 → 12 → 15. One owner per line: X7, X11 |
| `update` (`:2847`) | 12 P3 (normalise `jobNumber`); 15 P1 (freeze and lock); 14 Task 3.2 (status validation) | 12 → 15 → 14 P3, each in a different part of the handler |
| `updateBatch` (`:2997`) | 15 P1 (freeze, post-approval, id-ordered lock); 14 Task 3.2 (per-row status check) | 15 → 14 P3 |
| `saveChildren` (`:3954`), `setAbnormalTags` (`:4729`), `delete` (`:3148`), `batch` (`:3694`), `get` (`:2471`) | 15 P1 only (14 states the `orderNo` rule and writes no code) | none |
| `receive` (`:3203`), `reject` (`:3316`), new `reopen` | 13 P2 only | none |
| `review` (`:3380`), `reviewBatch` (`:3487`) | 15 Task 2.1 deletes them | 15 P2 before 14 P1 (14 D7) |
| `create` (`:2508`), `buildOrderConditions`, `orderFields.status` comment | 14 Task 3.2 | none |
| `packages/api/src/architecture.test.ts` | 08 Task 3.3; 10 Task 1.4; 11 Tasks 1.2/2.1/2.2/2.4 (`:488` re-key, `:505` removed, new `assignNumber :: update(costLine)`); 12 Tasks 1.1/1.2 (comments); 13 Task 2.2 (new `reopen` entry beside `:495-496`); 15 P1 (comments), 15 Task 2.1 (removes `:494`, `:876`) | Wave order. 13's entry and 15's `:494` removal are neighbouring lines, so the second to merge rebases. The stale-entry rule (`:1128`) means each key change is committed together with its code |
| `modules/audit/resources.ts` `collective_order` entry (`:201`, `exists` `:204-215`) | 08 Task 2.1 (`separationOfDuties: false`); 15 Task 1.3 (`exists` lock, X6); 15 Task 2.2 (`true`); 14 Task 1.2 (readiness member, X9) | 08 → 15 P1 → 15 P2 → 14 P1 |
| `ReviewableResource` type and `modules/audit/submit.ts` | 07 Task 3.3 (`assertPublishable?`, call before insert); 08 Tasks 2.x/3.2; 10 Task 1.2 (`onPassed?`); 14 Task 1.2 (`readinessProblem?` and call) | 07 → 08 → 10 → 14. X9: 14 reuses 07's member and adds none |
| `modules/audit/gates.ts`, `post-approval.ts` | 08 Tasks 1.3/3.1; 15 Task 1.1 (`assertNoneUnderReview`, `assertPostApprovalEditableMany`) | 08 → 15 |
| `modules/audit/seed.ts` / `seed.test.ts` | 04 (fee_template gate); 08 (comment); 10 (new flow); 15 Task 3.4 (four order gates), 15 Task 2.1 (comment) | 04 → 08 → 10 → 15 P3 |
| `routers/audit-review.test.ts` | 08; 14 Task 1.2 (fills `co-sep`, `co-gated`, `co-export`); 15 Tasks 2.3/3.5 | 15 P2 → 14 P1 → 15 P3 |
| `collective-order.guards.test.ts` | 13 Task 2.3 (`NODE_KEYS` `:69-81`, intake block); 14 Task 3.2 (literals at `:658/668`, `:1031/1038`); 15 Task 2.3 (deletes `:474-599`, `:741-811`); 15 Task 1.4 (see X6) | Wave order. X6 moves 15's freeze cases to their own file to take one writer off this file |
| `collective-order.numbering.test.ts` | 11 Tasks 2.3/2.4; 12 Tasks 1.3/3.2 | 11 → 12 |
| New real-Postgres tests | 12 `collective-order.numbering.concurrency.test.ts` [NEW]; 13 `collective-order.intake.concurrency.test.ts` [NEW]; **14 and 15 both name `collective-order.concurrency.test.ts` [NEW]** | X8 |
| `modules/collective-order/permissions.ts` | 13 Task 2.2 (`reopen` node, `:17-18`, `:84-93`); 15 Task 2.1 (`isEndpoint` on `review`, `:94-98`) | Neighbouring blocks. 13 §7 says "13 only", which is wrong. The second to merge rebases, and both run `registry.sync.test.ts` |
| `seed/operations.ts`, `seed/run-operations.ts` | 13 Task 2.6 (comment); 14 Task 1.3 (order values `:213-231`, raw insert `:247-258`); 15 Task 3.7 (`ensureLadings` `:432`, docblock) | X12 |
| `apps/web/src/components/order-form.tsx` | 15 Task 1.5 (notice, Save `:2699` disabled); 14 Task 2.2 (readiness panel above the rail, `&amp;` label `:2590`); 14 Task 3.3 (status select) | 15 P1 → 14 P2 → 14 P3. Put the under-review notice above the Before-review panel |
| `order-ledger/order-record-page.tsx` | 15 Task 1.5 | none |
| `routers/quotation.ts` `convertToOrder`, `$quotationId.tsx` header, `quotation.convert.test.ts` | 08 Task 3.3 (adjacent `review` deletion); 10 Tasks 1.8/2.1/2.5; 11 all phases | 11 P1 (Wave 1) → 10 (Wave 4, see X15) → 11 P2/P3 |
| `modules/expense/bridge.ts` | 11 Phases 2–3 only (06 changes its input, not its code) | none |
| `routers/expense/cost-lines.ts` | 10 Task 2.2 (`importFromQuote`); 11 Task 3.1 (`importFromQuote` caller types); 15 Task 3.3 (`costLines.create` `expense_entry`) | Different functions: 10 → 11 P3 → 15 P3 |
| `routers/lading.ts` `create`/`update`, `modules/collective-order/gates.ts` | 15 Phase 3 only (steps 16–17 have no plans yet) | Plans 16 and 17 must keep 15's gate calls |
| `apps/web/src/routes/_next/order.to-receive.tsx`, `shell-next/record-routes.ts`, `e2e/to-receive/*` | 13 only (grep of plans 04–15) | none |
| `e2e/specs/audit.order-queue.spec.ts`, `audit.review-queue.spec.ts`, `audit.post-approval.spec.ts` | 14 Task 1.4 (ready payloads); 15 Task 2.1 (comments), 15 Task 3.6 (fixes specs that fail) | 14 P1 → 15 P3 |
| `e2e/fixtures/seed-cli.ts` | 15 Task 2.1 (comment); used by the §10 of 12–15 | X16 (uncommitted edits in the main tree) |
| `customer-intake-sop/sop.json`, `tracker/seed/flow-nct.json` (ZYT-Task repo) | 12 Task 2.1/2.2 only. 14 says the step 14 card "should gain a line" and 15 rewrites nothing, but neither has a task | 12 P2 after the Wave 5 deploy. The step 14/15 text gaps have no owner (see the list under X13) |

---

## 3. Migrations and placeholders

- **Journal head at HEAD:** `packages/db/src/migrations/meta/_journal.json` ends at idx 64, `0065_quotation_send_decision`, and `0065_quotation_send_decision.sql` is the last file. Numbers already reserved: 0066 (01), 0067 (02), 0068 (04), 0069–0072 conditional (05–08), 0073 (09), 0074 (10).
- **Under the recommended options, steps 11–15 add no migration.** None of Waves 5–11 in §6 migrates, so they cannot collide with 01, 02, 04, 09 or 10 in the journal.
- **Conditional placeholders.** None is final, because runbook §6 assigns numbers at merge:

| Plan | Option | Placeholder as written | Settlement |
|---|---|---|---|
| 11 | D3-B/C (D3-A was chosen) | `0075_collective_order_quotation_uq` | dead; `00NN_` if revived |
| 12 | D3-B | `0076_collective_order_job_number_trimmed` | rename to `00NN_…` (X14) |
| 13 | D3-B/C | `00NN_collective_order_intake_actor` | ok |
| 14 | D3-B (status CHECK), D6-C (fleet columns), D8-B (`audit_flow.require_complete`) | unnamed | name as `00NN_…` if chosen (X14) |
| 15 | D11-B | `00NN_audit_submission_content_hash` | ok |

- **Not a migration, but an owner-run write:** step 13 Phase 2 needs a `permission_node` row for `collectiveOrder.reopen`. No pipeline runs `db:seed-nodes`, and the script cannot run under bun (13 §7). The row goes in by a reviewed `INSERT … SELECT … FROM permission_node WHERE key = 'collectiveOrder.receive' ON CONFLICT DO NOTHING`. It runs on dev before the Phase 2 proof, and Wilfred runs it on production after the deploy and before any P8 grant. Root holders reach the node through their ancestor grant without the row.
- **Data rollback that is not a plain revert:** step 15 Phase 3 writes `audit_flow_gate` rows with `create_lading`. A full revert makes those orgs' Order review flow unsaveable (`flow-admin.ts:158-164`). Use step 15 §8's partial revert, or its probe-sized, owner-run delete.

---

## 4. Settlements that span plans (X6 onward)

### X6 — Two plans each say the other owns the order under-review freeze, so the merge order is circular. **Blocker.**

**Settled 2026-09-17 (Wilfred accepted the recommendation).** Chosen: **step 15 owns the freeze and the submit lock** — step 14 takes D5-C, and step 15's own "X1" label takes option B and is renamed X6. `collective_order.exists` gets `.for("update")` unconditionally (Task 1.3), step 15 Phase 1 applies its §4.1 Fallback list from day one including the D2-B content-array carve-out, the tests live in `collective-order.under-review.test.ts` [NEW in step 15], and the merge order is **15 P1 → 14 P1**. The text fixes listed at the end of this item are still owed in steps 12, 13, 14 and 15.

- **Step 14** (revised 19:49) recommends D5-C: step 15 owns the freeze and the submit lock, and **15 Phase 1 → 14 Phase 1**. The lock goes in `REVIEWABLE_RESOURCES.collective_order.exists`, and the readiness hook is a plain read. Step 14's test commands run `collective-order.under-review.test.ts` "[NEW in step 15]".
- **Step 15** (revised 19:53) recommends its own "X1-A": step 14 owns five writers, and **14 Phase 1 → 15 Phase 1**. It says the lock at submit is "in step 14's `readinessProblem`", and its tests extend "step 14's `describe("an order under review is frozen")`". Step 15 was describing an earlier draft of step 14 that no longer exists.
- **Consequence as written:** each plan lists the other as a blocking prerequisite. Under both texts, no plan adds the lock to `exists`, and no test suite exists for either to extend.
- **Verified at HEAD:** `submitForReview` calls `entry.exists` at `submit.ts:39` and runs the open-attempt SELECT unlocked at `:71`. A lock taken later, inside a readiness hook, would let two concurrent submits both pass `:71` (step 14 review item 3 is correct). `collective_order.exists` (`resources.ts:204-215`) takes no lock today.
- **Recommended settlement: step 15 owns it.** That means step 14 D5-C, and step 15's own label taking option B.
  - Step 15 Phase 1 applies its §4.1 "Fallback" list: `update`, `assignNumber`, `setAbnormalTags`, `updateBatch` (via `assertNoneUnderReview`, rows loaded in id order), `delete`, `batch` delete, and `saveChildren` with the D2-B content-array carve-out from day one. That removes step 15's "interim window" in which the fees page is refused.
  - Task 1.3 adds `.for("update")` to `collective_order.exists` unconditionally, on the pattern of step 08 Task 1.2.
  - The tests go in `collective-order.under-review.test.ts` [NEW, step 15], the file step 14 already names. This keeps one more writer out of `collective-order.guards.test.ts`.
  - Order: 15 P1 → 14 P1.
  - Why step 15: the SOP files the finding under step 15 (`fixes[0]`), step 08 §7.1 hands it to "the orders step", step 12 D5-A names step 15, and step 14's latest text agrees.
- **Text fixes this settlement needs** (Wilfred's edits, not made here):
  - Step 15: the header ownership note, §4.1, §5 prerequisites, Tasks 1.2–1.4, §7.6 required order, and the decision labelled "X1". Rename that label to X6, because "X1" already means step 10's self-decision switch in `steps-4-10-crosscheck.md`.
  - Step 13: the Phase 0 "Overlap" bullets and §7 collision row, which still say "14 Tasks 1.2-1.3 … freeze guards".
  - Step 12: the §7 `assignNumber` collision row ("14 Task 1.3") and D5 option A's "Today both step 14 … and step 15 … plan this".

### X7 — Three plans claim the lock on `assignNumber`

**Settled 2026-09-17 (Wilfred accepted the recommendation).** Chosen: **step 12 Task 1.1 owns the `.for("update")` lock**, 12 P1 merges before 15 P1, and step 15 adds only `assertNotUnderReview` between the has-number CONFLICT (`:2791`) and `assertPostApprovalEditable` (`:2800`), after grepping the handler so no second lock is added.

- Step 12 Task 1.1 adds `.for("update")` to `assignNumber`'s scoped load (`collective-order.ts:2784-2787`) and declares itself the owner. Step 15's fallback list, and the earlier step 14 draft that 12 and 13 still cite, add it again.
- **Settlement:** step 12 Task 1.1 owns the lock, and 12 P1 merges before 15 P1. Step 15 adds only `assertNotUnderReview` to `assignNumber`: after the has-number CONFLICT (`:2791`) and before `assertPostApprovalEditable` (`:2800`), matching step 12's §4 data flow. Step 15 greps the handler for `.for("update")` and does not add a second one.

### X8 — Steps 14 and 15 would create the same new test file

**Settled 2026-09-17 (Wilfred accepted the recommendation).** Chosen: **step 15 creates `collective-order.concurrency.test.ts`** with the update-vs-submit and delete-vs-submit interleaves; step 14 Task 1.2 adds its submit-vs-clear-vessel `describe` to that file and drops the [NEW] tag. Steps 12 and 13 keep their own files. Because `DATABASE_URL_TEST` is in no workflow, the PR checklist must carry the pasted dev-branch output for all four, plus the failing pre-change run — "skipped" is not a pass.

- Both Task 14.1.2 and Task 15.1.4 create `packages/api/src/routers/collective-order.concurrency.test.ts` [NEW]. Only `expense.concurrency.test.ts` exists at HEAD.
- **Settlement:** step 15 creates the file with the update-vs-submit and delete-vs-submit interleaves. Step 14 Task 1.2 adds a `describe` to that file for its submit-vs-clear-vessel interleave and drops the [NEW] tag.
- Steps 12 and 13 keep their own distinct files.
- `DATABASE_URL_TEST` appears in no workflow (grep of `.github/workflows`), so CI skips all four of these proofs. The runbook's PR checklist must require the pasted dev-branch output: "skipped" is not a pass, and the failing run on pre-change code must be shown.

### X9 — Step 14's `readinessProblem?` duplicates step 07's `assertPublishable?`

**Settled 2026-09-17 (Wilfred accepted the recommendation).** Chosen: **option A** — step 14 implements step 07's `assertPublishable` on the `collective_order` entry, throwing CONFLICT with `readinessMessage(...)`, and adds no new `ReviewableResource` member and no `submit.ts` change. Step 07's Wave 3 prompt gains the placement line: call it **after** the open-attempt check (`submit.ts:71-84`) and before the stage lookup (`:89`). Option B (a separate submit-only member) is rejected. The re-check at decide time is accepted, sized by 14 P3 / 15 P2.

- Step 07 Task 3.3 adds `assertPublishable?(tx, organizationId, resourceId): Promise<void>` to `ReviewableResource`. It is called in `submitForReview` before the insert and again at the final pass in `decide`. Step 07 D8-A is chosen.
- Step 14 adds `readinessProblem?(tx, organizationId, resourceId): Promise<string | null>` to the same interface, called in the same function. Step 14 never mentions step 07. The 04–10 runbook §1 rule is that a later engine hook reuses 07's shape and does not add a parallel one.
- **Recommended settlement (A):** step 14 implements `assertPublishable` on the `collective_order` entry. It throws CONFLICT with `readinessMessage(...)`, and step 14 adds no new member and no `submit.ts` change.
  - Step 07's Wave 3 prompt gains one line: place the submit call **after** the open-attempt check (`submit.ts:71-84`) and before the stage lookup (`:89`). That is still "before the insert", and a duplicate submit then reads "already under review".
  - Consequence: readiness is also re-checked when the review finally passes. With the freeze from X6 in place, content cannot change under review. The only orders affected are sparse ones already under review on deploy day, which cannot be approved until they are withdrawn and completed. Step 14 P3 and step 15 P2 size that.
- **Alternative (B):** keep a separate, submit-only member, and record in step 14 why it departs from the runbook rule.

### X10 — Deleting the legacy review verbs fails `registry.sync.test.ts` in step 08 too, for two nodes

**Settled 2026-09-17 (Wilfred accepted the recommendation).** Chosen: **step 08 Task 3.3 drops `isEndpoint: true` on both `QUOTATION.review` and `QUOTATION.feeTemplateReview`**, each with the step 15 D9-A comment that the engine re-checks the node at decide time, and the Wave 2 prompt says so. Step 15 D9 then follows this precedent instead of setting it. **The step 08 plan already carries this edit** (added 2026-09-17 under Task 3.3 and §9). Verified by symbol at HEAD `6bb3a1bf`: the nodes are at `modules/quotation/permissions.ts:56-60` and `:98-102`, their only `requireNode` calls are `quotation.ts:3846` and `:1322`, and the engine keeps reading them at `modules/audit/resources.ts:125` and `:164`.

- `registry.sync.test.ts:22` requires every `isEndpoint: true` node to gate a real endpoint. Step 15 D9-A resolves this for `COLLECTIVE_ORDER.review` and flags `QUOTATION.review` to step 08.
- **Verified at HEAD:** step 08 Task 3.3 also deletes `feeTemplates.review` (X3). That procedure holds the only `requireNode(QUOTATION.feeTemplateReview)` (`quotation.ts:1322`), and the node is `isEndpoint: true` (`modules/quotation/permissions.ts:98-102`). `QUOTATION.review` is `isEndpoint: true` at `:56-60`, and its only `requireNode` is `quotation.ts:3846`. Neither step 08 nor step 04 plans a registry change.
- **Settlement:** step 08 Task 3.3 drops `isEndpoint: true` on both `QUOTATION.review` and `QUOTATION.feeTemplateReview`. Each gets a comment that the engine re-checks it at decide time (`resources.ts:125`, `:164`; `decide.ts:50`), using the same wording step 15 D9-A uses. Add this to the Wave 2 prompt (08 P2+P3). Step 15 D9 then follows an existing precedent and no longer defines it.

### X11 — The re-stamp predicate in `assignNumber` is decided in step 11 and refined in step 12

**Settled 2026-09-17 (Wilfred accepted the recommendation).** Chosen: **fold the widening into step 11 Task 2.4 before it is built** (step 12 D2-A) — predicate `order_no = quotation_no OR order_no IS NULL`, NULL-only when the order has no `quotation_no`, and locked-but-unbilled lines included (step 12 D8-A). Step 12 Task 1.2 becomes the fallback only, step 12 P3 runs in place of step 11 P4, and the Wave 5 prompt carries it. **Step 11's plan already carries this edit** (`step-11-convert-won-quote.md`, header additions note and Task 2.4, §4 data flow, Phase 3 test list, §7 probe P4, §10) — do not add it again.

- Step 11 D7-A re-stamps unbilled lines where `order_no = quotation_no`. Step 12 found a third kind of line (`order_no` NULL, written by `saveChildren` at `collective-order.ts:4453` while the job is blank). Its D2 widens the predicate, and its D8 asks about locked-but-unbilled lines.
- **Verified:** the only migrations touching `cost_line_settled_immutable` are `0033` (trigger `WHEN` `:157-164`) and `0042`. Neither mentions `order_no`, so the re-stamp UPDATE cannot raise.
- **Settlement:** fold the widening into step 11 Task 2.4 before it is built (12 D2-A):
  - the predicate is `order_no = quotation_no OR order_no IS NULL`, or NULL-only when the order has no `quotation_no`;
  - with 12 D8-A, locked-but-unbilled lines are included.
  - Add it to the Wave 5 prompt. Step 12 Task 1.2 becomes the fallback only.
  - Run step 12 P3 in place of step 11 P4, because it answers a wider question.

### X12 — Three plans edit `seed/operations.ts`; step 14 §7 says no other plan does

**Settled 2026-09-17 (Wilfred accepted the recommendation).** Chosen: **14 P1 merges before 15 P3**, step 15 Task 3.7's acceptance run uses the post-14 seeder (six complete submitted orders plus unlinked ladings), and step 14's §7 "no other plan edits it" row is corrected to name 13 Task 2.6 and 15 Task 3.7. That correction is owed in the step 14 plan.

- Writers: 13 Task 2.6 (comment only), 14 Task 1.3 (adds `operationPersonnel`, `vesselName` and `voyage` to the order values and raw insert) and 15 Task 3.7 (`ensureLadings` creates ladings unlinked when `create_lading` is ticked, plus the `run-operations.ts` docblock and `seed/flows.ts`).
- Each of 14 and 15 accepts its phase by running the operations seeder on a fresh dev org.
- **Settlement:** 14 P1 merges before 15 P3. 15 Task 3.7's acceptance run must use the post-14 seeder, which then both submits six complete orders and creates unlinked ladings. Correct step 14's §7 row.

### X13 — Nobody owns submit-time order state (archived, not received, rejected)

**Settled 2026-09-17 (Wilfred accepted the recommendation): accepted unowned gaps.** Chosen: **do not add submit-time accept-status checks to step 14 Phase 1.** The RPC-only gap is accepted for now; it is not assigned to any of steps 11–15 and no plan changes because of it. Step 13 Phase 2's release note must say plainly that "Rejected" is an intake record, not a freeze (13 §9 Risks). Whether it later becomes a follow-up task after 14 P1, or a "readiness: received at intake, not archived" row on the X9 hook, stays Wilfred's call and is out of scope for these plans. The matching SOP-text gap for steps 14 and 15 is accepted as unowned on the same terms: neither step 12 Phase 2 nor any later SOP pass is assigned it here.

- Step 13 D4-A hands "keep rejected orders out of operations" to "step 14's plan". Step 14 never mentions `acceptStatus`. Step 15 D14-C records submit-time state checks as unowned and names step 14's hook as the cheapest carrier.
- **Settlement:** do not add this to step 14 Phase 1. It would change the e2e fixtures, and the seeder's submitted orders are picked by index, not by accept status.
  - Wilfred names it a follow-up task after 14 P1, a "readiness: received at intake, not archived" row on the X9 hook, or accepts the RPC-only gap.
  - Until then, say plainly with 13 Phase 2's release note that "Rejected" is an intake record, not a freeze (13 §9 Risks).
- The same gap in ownership applies to SOP text for steps 14 and 15: step 14 says the step 14 card "should gain a line", and step 15 has no SOP task. Give both to step 12 Phase 2's docs agent, or to a later SOP pass.

### X14 — Migration placeholders

**Settled 2026-09-17 (Wilfred accepted the recommendation).** Chosen: **every conditional migration in steps 11–15 is written as `00NN_<name>` and takes the next free number when its branch is rebased for merge** (runbook §6); step 11's `0075_…` and step 12 D3-B's `0076_…` stop naming numbers, and any step that picks a migrating option becomes the only migrating step in its wave. **Steps 11 and 12 already carry this edit** (`step-11-convert-won-quote.md` header note, §2 migration state, §4, §7, §9 option B, §10; `step-12-job-number.md` D3 option B) — do not add it again. Steps 13, 14 and 15 still owe the rename where they name a number.

- **Settlement:** every conditional migration in steps 11–15 uses `00NN_<name>` and takes the next free number when its branch is rebased for merge (runbook §6). Step 12 D3-B's `0076_…` and step 11's `0075_…` stop naming numbers.
- If Wilfred picks any migrating option (11 D3-B/C, 12 D3-B, 13 D3-B/C, 14 D3-B/D6-C/D8-B, 15 D11-B), that step becomes the only migrating step in its wave.

### X15 — Follow-ups from step 11 that the 04–10 runbook does not carry yet

**Settled 2026-09-17 (Wilfred accepted the recommendation).** Chosen: **the 04–10 runbook carries both follow-ups** — Wave 1 gains `wt-step11` (11 Phase 1, merged after 05 per 11 D4-A), and the Wave 4 `wt-step10` prompt gains the two lines (`correctionPath: true` on the `assertConvertibleOutcome` call, and step 10's pending-correction refusal placed **after** `assertConvertibleOutcome`). **`steps-4-10-runbook.md` already carries this edit** (added 2026-09-17: §2 wave diagram and wave table, §3 Wave 1 worktree commands, §4 Wave 1 `wt-step11` prompt, §4 Wave 4 prompt, §11).

- **Verified in `steps-4-10-runbook.md`:** the §2 wave table has no step 11 row. The §4 Wave 4 prompt for `wt-step10` does not mention step 11.
- **Settlement:**
  - Wave 1 gains `wt-step11` (11 Phase 1), merged after 05 (11 D4-A).
  - The Wave 4 prompt gains two lines:
    1. set `correctionPath: true` in the `assertConvertibleOutcome` call;
    2. place step 10's pending-correction refusal **after** `assertConvertibleOutcome` in `convertToOrder` (11 §4 refusal order).

### X16 — Uncommitted e2e edits under the fixtures every §10 uses

**Settled 2026-09-17 (Wilfred accepted the recommendation).** Chosen: **Wilfred commits or sets aside the uncommitted `e2e/` changes himself before Wave 6.** No agent stashes, resets or checks out anything, and every §10 keeps re-reading `ACTORS` at its base commit.

- The main nct-layout tree has uncommitted edits to `e2e/fixtures/seed-cli.ts` (+78/−2), `e2e/fixtures/types.ts`, `e2e/playwright.config.ts` and `e2e/qa-manifest.ts`, plus untracked `e2e/specs/intake.golden-path.spec.ts` and `e2e/reporters/step-events.ts`.
- Worktrees branch from committed history, so executors will not see these edits. Step 15 Task 2.1 edits `seed-cli.ts` comments, and the §10 walks of 12–15 read its `ACTORS`.
- **Settlement:** Wilfred commits or sets aside those e2e changes himself before Wave 6. Agents never stash, reset or check them out. Every §10 re-reads `ACTORS` at the base commit, as step 15 already says.

---

## 5. Read-only production probes (SELECT only; Wilfred runs them with the owner's override)

The full SQL is in each plan's §7. Column names were spot-checked against the schema at HEAD:
- `audit_log.before_json`/`after_json` are `text` (`schema/audit-log.ts:23-24`), so the `::jsonb` casts are needed;
- `audit_submission.submitted_by` `:367`, `submitted_at` `:370`, `resolved_at` `:395`;
- `audit_stage_instance.submission_id` `:421`;
- `audit_decision.stage_instance_id` `:478`, `reviewer_id` `:481`;
- `member.role` `organization.ts:25`, `role.is_system` `:120`, `member_override.effect` `permissions.ts:111`;
- `fleet_devices.display_name`/`description`/`is_active` `fleet.ts:33-36`;
- `number_sequence.doc_type` `org-param.ts:189`, `scope_key` `:199`.

"Dup" means run it once, as the other ID.

| ID | Question | Decides / blocks | Dup |
|---|---|---|---|
| 12-P1 | Blank job numbers by org and origin, and whether the org has a `job` sequence | 12 D7, Journey 1 load | related to 15-P10 |
| 12-P2 | Untrimmed or whitespace-only `job_number` | 12 D3 | |
| 12-P3 | Cost lines whose `order_no` disagrees with their numbered order (null / quotation_no / other; billed or not) | 12 D2, X11 | replaces 11-P4 |
| 12-P4 | Orders whose lines carry two or more distinct references | sizing | |
| 12-P5, P5b | More than one `assignNumber` audit row per order; an assigned value the order no longer holds | 12 D1 | |
| 12-P6 | Job numbers cleared or changed through `update` | 12 D4 | |
| 12-P7 | Ladings whose `order_no` resolves to no order | 12 D4 | |
| 12-P8 | Numbers assigned on an order whose current submission is under review | 12 D5, X7 | subset of 15-P7 |
| 12-P9 | `job` sequence configuration per org | 12 D7, and 14 D2 (Job Number required) | |
| 12-P10 | Locked-but-unbilled lines on blank orders | 12 D8, X11 | |
| 13-P1 | `accept_status` counts per org | sizing | |
| 13-P2 | Rejected → received reversals already in `audit_log` | 13 D1, D2 | |
| 13-P3 | Rejected orders carrying cost lines and state | 13 D4, X13 | |
| 13-P4 | Unaccepted orders already carrying cost lines | 13 D4, X13 | |
| 13-P5 | Legacy null accept/reject stamps | message wording | |
| 13-P6 | Who receives and rejects | 13 D3, D7 | |
| 13-P7 | Share of rejections with no reason | 13 D8 | |
| 13-P8 | Custom roles and member overrides holding receive/reject as leaves | 13 D7. **Run before the 13 Phase 2 deploy**, then grant `reopen` | |
| 13-chk | `permission_node` row for `collectiveOrder.reopen` (read-only check after the owner-run INSERT) | 13 Phase 2 deploy | |
| 14-P1 | Distinct free-text `status` values per trade | 14 D3, D4. **Blocks 14 Phase 3** | |
| 14-P2 | Status set but no `status_time` | sizing | |
| 14-P3 | Share of live orders missing each proposed required field, per trade | 14 D2. **Blocks Task 14.1.1**; also sizes X9 | |
| 14-P4 | Orders with no container or cargo lines | 14 D2. **Blocks Task 14.1.1** | |
| 14-P5 | Review cache state × missing client or job number | 14 D8. **Blocks Task 14.1.1** | |
| 14-P6 | Latest submission vs `order_audit_status` | 14 D5, X9 | = 15-P2 + 15-P3 |
| 14-P7 | Edits landed while a submission was open | 14 D5 | = 15-P7 (15 also covers delete and batch actions) |
| 14-P8 | Has `updateBatch` ever run, and did it write status | 14 Task 3.2 | |
| 14-P9, P10 | Typed vehicle plates vs fleet devices; fleet size | 14 D6 (step 19) | |
| 14-P11 | Legacy `collectiveOrder.review`/`reviewBatch` use | 14 D7 | = 15-P4 (first query) |
| 15-P1 | Order flow per org: enabled, post-approval, gates, reviewers | 15 D5, D6, D8 | |
| 15-P2 | Live orders by latest submission | 15 D6; the under-review count frozen on the 15 P1 deploy | |
| 15-P3 | Cache drift vs latest submission | 15 D13, D12 | |
| 15-P4 | Legacy verb use, and self-approval through it | 15 D4, D13 | |
| 15-P5 | B/Ls linked to unapproved orders | 15 D6 | |
| 15-P6 | Fees and billed lines on unapproved orders | 15 D2, D5 | |
| 15-P7 | Edits during an open submission (with batch variants) | finding A exposure | |
| 15-P8 | Orphan submissions for deleted orders | 15 D13 | |
| 15-P9 | Engine self-decisions on orders | 15 D8 | |
| 15-P10 | Approved orders with no job number under a locked flow | 15 D16 | |
| 15-P11 | Orders locked, ended or shut out without approval | 15 D6 backlog | |
| 15-P12 | Who submits orders, by role | 15 D8 | |
| 15-P13 | Child saves after approval under a locked flow | 15 D3. Read before answering D3 | |
| 15-rb | `audit_flow_gate` rows with `create_lading`, per org | only on a Phase 3 rollback (§8) | |

Step 11's P1–P5 (§7 of that plan) are also still to run. P1 lists orders already minted from Lost quotations (D9-A report), and 11-P4 is replaced by 12-P3.

---

## 6. Suggested waves for a runbook for steps 11–15

This continues the numbering of `steps-4-10-runbook.md` Waves 1–4. A wave starts only when every branch of the previous wave has merged. Worktrees are created when their wave starts. No wave below migrates under the recommended options.

| Wave | Starts when | Runs in parallel | Merge order in the wave | Before starting | Deploy notes |
|---|---|---|---|---|---|
| **1** (additions) | now | + `wt-step11` (11 P1) · + `wt-step13-p1` (13 P1, web only) | 04 → 08 P1+P4 → 05 → **11 P1** → **13 P1** | 13 D5 answered; X15 added to the runbook | 13 P1's e2e spec runs in CI (`e2e.yml:81-99`) |
| 2–3 | as in the 04–10 runbook | unchanged | unchanged | X10 in the Wave 2 prompt (08 Task 3.3); X9's placement line in the Wave 3 prompt (07) | |
| **4** | as in the 04–10 runbook | 10 | 10 | X15's two lines in the Wave 4 prompt | |
| **5** | all of Wave 4 merged | `wt-step11` (11 P2 then P3, one session) | 11 P2 → 11 P3 | X11 in the prompt; run 11 P1–P5 and 12-P3 | server before web (toast reads `jobNumber`) |
| **6** | Wave 5 merged | `wt-step12` (12 P1, plus P3 if D3-A) · `wt-step13-p2` (13 P2) · 12 P2 (SOP text, ZYT-Task repo; only after Wave 5 is **deployed**) | 12 P1 → 13 P2 (rebase by symbol) | 12 D1/D2/D8, 13 D1–D3/D6/D7/D9/D11; X7, X16; run 13-P8 | 13 P2: server before web; the owner-run `permission_node` INSERT on dev before the proof, on production after deploy and before P8 grants. Wilfred republishes the SOP site |
| **7** | Wave 6 merged | `wt-step15` (15 P1) | 15 P1 | X6 settled and written into 12/13/14/15; 15 D1–D3/D10; run 15-P2, P7, P13 | API before web (`get.underReview`); announce "withdraw before editing" |
| **8** | Wave 7 merged | 15 P2 (same worktree) | 15 P2 | 15 D4/D8/D9; X10 already merged in 08; run 15-P1, P4, P12 | API only; `/rpc/collectiveOrder/review` returns 404 |
| **9** | Wave 8 merged | `wt-step14` (14 P1) | 14 P1 | X8, X9, X12; 14 D1/D2/D5/D8; **run 14-P3, P4, P5 first** | Server and e2e fixtures together; the operations seeder must exit 0 |
| **10** | Wave 9 merged | 15 P3 (`wt-step15`) · 14 P2 (`wt-step14`) | 15 P3 → 14 P2 | 15 D5/D7, 14 D9; run 15-P1, P2, P5, P11 for the release note (15 D6) | 15 P3's rollback is a partial revert (§3); 14 P2 is web only |
| **11** | Wave 10 merged | 14 P3 | 14 P3 | 14 D3/D4 confirmed with operations; **run 14-P1** | One release for server and web, with `apps/web` built before deploy |

Wave 10's two phases have disjoint files. 15 P3 writes `lading.ts`, `cost-lines.ts`, `audit/seed.ts`, `audit-review.test.ts`, `seed/*` and e2e specs. 14 P2 writes `order-form.tsx` and `order-readiness.tsx` [NEW].

If Wilfred instead chooses step 14 as owner in X6 (14 D5-A), Waves 7–9 become: 14 P1 carrying 15 §4.1 → 15 P1 deltas → 15 P2. Step 14 P1 then also needs 12 P1 merged first (X7).
