# Steps 16–19: cross-plan check (2026-09-21)

> **X17–X27 are settled. 2026-09-21: Wilfred accepted the recommended settlement for every one of them, with no exception.** The per-decision registers inside the steps 16–19 plans are settled the same way, on the recommended option in each case, except where a settled X-item overrides a plan's own recommendation (X17 makes step 17 D2 = B; X18 makes step 17 D8 "superseded by step 16 D1"). Each heading below now carries a **Settled** line naming the chosen settlement; the analysis under it is kept as written, so the reasoning and the rejected readings stay visible. Every text fix a settlement needed has been applied in the plans on 2026-09-21; each item says where.

The four plans for steps 16–19 were written in parallel on 2026-09-21. All of them read nct-layout HEAD `6bb3a1bf` (`feat/new-layout`), the commit steps 04–15 were planned at. The nct-layout main checkout sits at `ea1560e7` on `feat/intake-golden-path-e2e`; `git diff --stat 6bb3a1bf HEAD -- packages apps seed` is empty (checked this pass), so every citation under `packages/`, `apps/` and `seed/` matches `6bb3a1bf`. This pass re-read the four plans in full, grepped the steps 04–15 and 20–25 plans for every file 16–19 write, and checked the collision claims below against the code, read-only. Paths are relative to `C:/Project/NCT/nct-layout`, and `[NEW]` marks a file that does not exist yet.

| Step | Plan | Readiness | Migration (recommended options) | Open decisions (all of them) |
|---|---|---|---|---|
| 16 | step-16-lading-create.md | 7/10 | none (`00NN_lading_state_repair` only under D2-C) | D1–D12 |
| 17 | step-17-lading-states-and-review.md | 7/10 | none (no option in D1–D12 needs one) | D1–D12 |
| 18 | step-18-bl-document-approval.md | 7/10 | none (`00NN_bl_job_open_bl_number_uidx` under D7-B, `00NN_document_link_created_by_set_null` under D11-B) | D1–D11 |
| 19 | step-19-demurrage-clock-reach.md | 7/10 | none (`00NN_bl_number_normalise` under D4-C, `00NN_bl_job_order_link` under D6-C) | D1–D7 (plus Q1–Q3, not planned) |

**The last column is the state as of 2026-09-21 before settlement, kept for the record.** Later on 2026-09-21 Wilfred settled every one of those decisions (recommended option, or the X-item's reading where one overrides), so no decision in this table blocks a wave any more. The readiness column is the plans' own score at writing. The migration column is unchanged: under the settled options steps 16–19 add no migration.

**Two pairs of plans overlap, and they overlap differently.**
- **16 and 17 both rebuild `lading.update`.** Each was written believing the other had no plan: step 16 says "Step 17 (no plan yet)" and takes the under-review freeze; step 17 says step 16's plan "was not read" and its D2-A takes the same freeze. They also both remove the Audit Status field, both refuse hand-typed workflow statuses (with different vocabularies), and both create `lading.concurrency.test.ts` [NEW]. X17–X22 are about this pair, and **X17 and X18 are the only blockers in this track.**
- **18 and 19 already agree.** Step 18 D3-A and step 19 D1-A both put the order `documents` payload reshape in step 19 Task 2.2 and both ask for step 18's link writer (18 Phase 1) to merge before step 19 Phase 2. X23 only records it; X24 names one gap between them.

---

## 1. Dependencies and required merge order

### Dependencies on steps 04–15

| Task in 16–19 | Needs merged first (04–15) | Why (verified this pass) |
|---|---|---|
| 16 Phase 1 | **15 Phase 3** (Wave 10), 15 Phase 1 Task 1.3, 08 Task 2.1, 08 Task 3.5 | 15 Task 3.2 writes the `assertGateCleared(…, "create_lading")` calls into `lading.create` and `lading.update` (not there yet: `grep create_lading routers/lading.ts` is empty at HEAD). 16 Task 1.2 moves the update call onto `tx`. 15 Task 1.3 is the `exists` lock pattern 16 copies into `lading.exists` (`modules/audit/resources.ts:248-254`, no lock today). 08 Task 2.1 writes `separationOfDuties` beside it. 08 Task 3.5 creates `packages/db/scripts/` (absent at HEAD) |
| 16 Phase 2 | **15 Phase 1** Task 1.5 | Both write the `actions` block of `components/order-ledger/order-record-page.tsx` (`:98-126`; 15 adds the under-review notice, 16 two links) |
| 17 Phase 1 | 08 Phases 1–3, 10 Task 1.2, 14 Phase 1, **15 Phases 1–3**, **all of step 16** | `resources.ts` (08, 10, 14, 15 all write it); `lading.ts` `update` (15 P3, 16 P1). 17's own §5 said "Step 16 merged if its plan edits `lading.ts` `update` or `create.tsx`": it edits both, and 17 §5 now requires all of step 16 (X17) |
| 17 Phase 2 | 17 Phase 1 | `lading.ts`, `$id/index.tsx`, `$id/edit.tsx`, `lading.concurrency.test.ts` hand over |
| 18 Phase 1 | none under D3-A | Writes `routers/document.ts`, `documents.$documentId.tsx`, `seed/review-documents.ts` [NEW], `seed/cli.ts`; no plan in 04–15 writes any of them (grep of plans). Under D3-B it also needs 11 P2, 12 P1, 13 P2, 14 P1, 15 P1 (`collective-order.ts`) |
| 18 Phases 2–3 | 18 Phase 1 | Same web file; `register-hooks.test.ts` hands from Task 2.3 to Task 3.3 |
| 19 Phase 1 | none | `bl-job.ts`, `customs-tracking.tsx`, `bl-job-record.tsx`, `card-gateout.tsx`: no plan in 04–15 or 20–25 writes them (grep) |
| 19 Phase 2 | 11 Phase 2, 12 Phase 1, **18 Phase 1** | 11 and 12 edit other `describe`s in `collective-order.numbering.test.ts`; 18 P1 writes the `document_link` rows the card's checklist counts (X23) |
| 19 Phase 3 | 19 Phases 1 and 2 | `bl-job.ts` after Phase 1; imports Phase 2's `bl-number.ts` |

### Order within steps 16–19 (under the Proposed X17 and X23)

X17 and X23 were settled as proposed on 2026-09-21, so this order is binding.

```
15 P3 ─(Wave 10)──► 16 P1 ──► 16 P2 ──► 16 P3 ──► 17 P1 ──► 17 P2
15 P1 ─(Wave 7)───────────────┘
18 P1 ──► 18 P2 ──► 18 P3
   └────────► 19 P2 ──► 19 P3
19 P1 ─────────────────┘
```

The binding edges and their reasons:
- **15 P3 → 16 P1.** 16 Task 1.2 moves 15's literal `create_lading` call inside the new transaction; `modules/audit/gates.test.ts:67` scans for the literal.
- **16 P1 → 17 P1** (X17). One owner for the rebuilt `lading.update`; 17 greps for 16's guard, lock and `exists` lock and adds none.
- **16 P1 → 16 P2 → 16 P3.** `lading.ts`, `lading.test.ts` and `create.tsx` pass A → C → E and B → D → E (16 §6).
- **16 (all) → 17.** 17 P2 edits `create.tsx`, `lading/index.tsx`, `$id/edit.tsx` and `lading.ts` after 16 is done with them; both plans name this order (16 §7.6, 17 §7.6).
- **18 P1 → 19 P2** (X23). The card first renders with real link counts, not three "Missing" chips on every order.
- **19 P1, 19 P2 → 19 P3.**

---

## 2. Code written by more than one plan (16–19, and against 04–15 and 20–25)

Collisions are handled by ordering, never by resolving a merge by hand. "Different functions" means git rebases cleanly; the later branch still re-locates by symbol.

| Shared code | Writers | Handled by |
|---|---|---|
| `routers/lading.ts` `update` (`:1537-1650`; load `:1544-1551`, `assertPostApprovalEditable` on `context.db` `:1554`, order resolution `:1587-1602`, held/amended re-route `:1604-1607`, transaction `:1609`) | 15 Task 3.2 (gate call); **16 Tasks 1.1, 1.2** (status rule, branch, freeze, `FOR UPDATE`, in-tx guards), 16 Task 2.1 (write-side resolver); **17 Task 1.1** (same freeze and lock), 17 Task 2.3 (status refusal, `auditStatus`) | **X17, X18, X19, X22.** 15 P3 → 16 → 17. Under X17 17 Task 1.1 adds nothing to `update` |
| `routers/lading.ts` `create` (`:1030`, insert `:1049-1133`, `auditStatus` `:1128`) | 15 Task 3.2 (gate); 16 Task 1.1 (status, `auditStatus`), 16 Task 2.1 (resolver); 17 Task 2.3 (status, `auditStatus`) | X18, X19. 17 Task 2.3 finds it done |
| `ladingFields.auditStatus` `:330`, `ladingUpdateInput.auditStatus` `:424` (`listInput.auditStatus` `:442` is a filter and stays) | 16 Task 1.1; 17 Task 2.3 | X19 |
| `routers/lading.ts` `applyWorkflow` (`:601-678`), `WORKFLOW` table (`:541-593`), `statusAfter` (`:526-539`) | 17 Task 2.1 only. 16 D1-B would add a `statusAfter` change and puts it in step 17 | none, unless 16 D1-B (X18) |
| `routers/lading.ts` `uploadAttachment` (`:1997`), `deleteAttachment` (`:2083`) | 17 Tasks 1.1, 2.2. 16 D4-A says attachments "stay writable" but writes no attachment code | X21 |
| `routers/lading.ts` `get` (`:1360`) | 17 Task 1.1 (`underReview`) | none |
| `routers/lading.ts` `listLadings` (`:802`), `ocrExtractionForForm` (`:2365`) | 16 Tasks 2.2, 3.1 | none |
| `modules/audit/resources.ts` `lading.exists` (`:248-254`) | 08 Task 2.1 (neighbouring `separationOfDuties`); **16 Task 1.2 and 17 Task 1.2** (the same `.for("update")`) | X17. 08 → 16 P1; 17 greps and adds nothing |
| `modules/audit/resources.ts` other entries and the `ReviewableResource` type | 07, 08, 10, 14, 15 (see `steps-12-15-crosscheck.md` §2) | Different entries; rebase by symbol |
| `modules/audit/gates.ts` `assertNotUnderReview` docblock (`:103-129`) | 08 Task 1.3 (rewrites it), 15 Task 1.1; 17 Task 1.1 (adds lading callers) | 08 → 15 → 17. Under X17 the lading `update` caller is 16's; 17 names both lading callers in one edit |
| `packages/api/src/routers/lading.test.ts` (`:716-725` pin writes `status: "released"` through `update` on a held bill) | 16 Tasks 1.3, 2.3, 3.1; 17 Task 2.4 | X18 (16 changes the pin to `confirmed`; 17 Task 2.4 still names "the existing `:721` case" with `released`). 16 → 17 |
| `lading.concurrency.test.ts` [NEW] | **16 Task 1.3 creates it; 17 Task 1.3 also creates it**; 17 Task 2.4 adds describes | X20 |
| Under-review test cases | 16 Task 1.3 in `lading.test.ts` `describe("under review")`; 17 Task 1.3 in `lading.under-review.test.ts` [NEW] | X20 |
| `apps/web/src/routes/_next/lading/create.tsx` | 16 Tasks 1.4, 2.4, 3.2; 17 Task 2.5 | 16 P1 → 16 P2 → 16 P3 → 17 P2. X18, X19 |
| `apps/web/src/routes/_next/lading/$id/edit.tsx` (form seeds `status: d.status` `:348`; `handleSubmit` sends `{ ...form }` `:666`; `status`, `owningBranchId` in `NON_CLEARABLE` `:690`) | 16 Task 1.4 (read-only non-settable status, omit echoes, Audit Status removed); 17 Task 1.4 (Save disabled under review), 17 Task 2.5 (Audit Status, On-hold) | 16 P1 → 17 P1 → 17 P2. X18 is why the echo matters |
| `apps/web/src/routes/_next/lading/$id/index.tsx` (toolbar `:362-434`; card mount `:138`, `:451`) | 17 Tasks 1.4, 2.5. 18 and 19 only need the card mount kept (19 §7.6) | 17 keeps `readOrderDocumentRollup(orderQuery.data)` and `<OrderDocumentsCard>` |
| `apps/web/src/routes/_next/lading/index.tsx` | 16 Task 2.4 (`orderId` search key); 17 Task 2.5 (Hold reason on row circulation) | Different regions; 16 P2 → 17 P2 |
| `apps/web/src/routes/_next/lading/-lading.columns.tsx` | 17 Task 2.5 | none (16 reads only) |
| `components/order-ledger/order-record-page.tsx` `actions` | 11–15 read it; 15 Task 1.5 writes; 16 Task 2.4 writes. 20 reads `:115` (Expenses) only | 15 P1 → 16 P2. Put the two B/L links before **Expenses** and keep 15's notice |
| `modules/lading/resolve-order.ts` (+ test) | 16 Task 2.1. 12 reads (`usableOrderNo` mirrors `normaliseJobNumber`); 15 P3 reads | none |
| `packages/db/scripts/` | 08 Task 3.5 creates; 15 Task 2.4, 16 Task 1.5, 17 Task 2.6, 21 add sibling scripts | Different files; X25 on duplicated queries |
| `routers/collective-order.ts` `enrichOrderRows` documents half (`OrderCustomsState` `:1844`, `OrderDocumentState` `:1859`, `emptyDocumentState` `:1878`, `enrichOrderRows` `:1891`, "First one wins" `:2191`) | **19 Task 2.2**; 18 Task 1.2 **only under D3-B** | X23. Other functions of the file: 11–15, 20 and 21 (`saveChildren`), different regions |
| `collective-order.numbering.test.ts` rollup `describe` (`:546-760`) | 19 Task 2.3. Other `describe`s: 11 Tasks 2.3/2.4, 12 Tasks 1.3/3.2 | 11 → 12 → 19 P2 |
| `apps/web/src/features/order-documents/rollup.test.ts`, `order-documents-card.tsx` | 19 Task 2.4; 18 Task 1.4 only under D3-B | X23 |
| `routers/document.ts` (`link` `:382`, new `unlink`) | 18 Task 1.1. 20–25 mention `invoice-document.ts`, a different file | none |
| `routes/_next/documents.$documentId.tsx` | 18 Tasks 1.3, 2.1, 2.2 | one worktree, sequential |
| `modules/document/register-hooks.ts`, `hooks.ts`, `register-hooks.test.ts`, `hooks.test.ts` | 18 Tasks 2.3, 3.1–3.3. 19 does not edit them (19 §7.6) | 18 P2 → 18 P3 |
| `packages/api/src/architecture.test.ts` | 18 Task 3.1 adds `"modules/document/register-hooks.ts :: blIntakeHook"` to `ALLOWED_EXECUTE_SITES` (`:1299`). 16 P1, 17 P1–P2 only re-run it (lading keys `:320-329` unchanged). 08, 10, 11–15, 20 also edit the file | Entries are line-independent; the later merge rebases and re-runs it (stale-entry rule) |
| `routers/bl-job.ts` `get` (`:165`), new `sourceStatus` | 19 Tasks 1.1, 3.1 | one worktree, sequential |
| `components/customs-tracking/bl-job-record.tsx` | 19 Tasks 1.4, 3.3 | sequential |
| `/order/$orderId/expenses` (route target of 19's **Fees** link) | 20 edits the page (`order.$orderId.expenses.tsx`), not its path | If step 20 renames the route, it updates `bl-job-record.tsx` (19 §7.6) |
| `seed/cli.ts`, `seed/review-documents.ts` [NEW] | 18 Task 1.5. 15 Task 3.7 edits `seed/operations.ts`, `run-operations.ts`, `flows.ts`, not `cli.ts` | none |
| `e2e/specs/lading.golden-path.spec.ts`, `audit.review-queue.spec.ts`, `audit.withdraw.spec.ts` | Re-run by 16 and 17; 15 Task 3.6 fixes specs that link to unapproved orders | No 16–19 task edits them; they must stay green |
| `customer-intake-sop/sop.json` (ZYT-Task repo) | No task in 16–19. Each plan lists "SOP text vs code" corrections in §9 and puts SOP text out of scope | X27 |

---

## 3. Migrations and placeholders

- **Journal head at HEAD:** `packages/db/src/migrations/meta/_journal.json` ends at idx 64, `0065_quotation_send_decision`, and `0065_quotation_send_decision.sql` is the last file (checked this pass). Reserved by earlier plans: 0066 (01), 0067 (02), 0068 (04), 0069–0072 conditional (05–08), 0073 (09), 0074 (10); every conditional in 11–15 is `00NN_<name>`.
- **Under the settled options (the recommended ones), steps 16–19 add no migration.** None of the waves in §6 migrates.
- **Conditional placeholders.** All are already written `00NN_<name>` (X26):

| Plan | Option | Placeholder as written | Note |
|---|---|---|---|
| 16 | D2-C (repair in a migration) | `00NN_lading_state_repair` | Not recommended; a data repair, hardest to undo |
| 18 | D7-B (partial unique index on open jobs) | `00NN_bl_job_open_bl_number_uidx` | Fails to build while 18-P1 finds open duplicates |
| 18 | D11-B | `00NN_document_link_created_by_set_null` | Fixes one table of twelve; the system-wide cascade needs its own plan |
| 19 | D4-C | `00NN_bl_number_normalise` | Backfill of `bl_job.bl_number` and `collective_order.mbl/hbl` |
| 19 | D6-C | `00NN_bl_job_order_link` | New nullable `bl_job.order_id` |

- **No owner-run database write** is needed by any phase under the recommended options (no `permission_node` row: 18's `document.unlink` reuses `DOCUMENT.update`, 19's `sourceStatus` reuses `BL_JOB.read`). The only data writes are local: 18 Task 1.5's seed on the dev branch.
- **Rollback:** every phase in 16–19 is a plain revert (each plan's §8). None writes data a revert would strand.

---

## 4. Settlements that span plans (X17 onward)

X1–X5 are `steps-4-10-crosscheck.md`'s and X6–X16 are `steps-12-15-crosscheck.md`'s. This file continues at X17. Every item was written as a proposal and is now **Settled** (2026-09-21, the recommended reading in each case).

### X17 — Two plans rebuild `lading.update` for the same freeze and lock. **Blocker.**

**Settled 2026-09-21 (Wilfred accepted the recommendation).** Chosen: **step 16 Phase 1 owns the under-review freeze, the `FOR UPDATE` load, the in-transaction guards and step 15's moved gate call in `lading.update`, plus `.for("update")` in `REVIEWABLE_RESOURCES.lading.exists`. Step 17 takes its own D2-B, and 17 Phase 1 keeps only what is its alone.** The text fixes listed at the end of this item are applied in both plans.

- **Step 16** (header "Cross-plan items owned", §4.3, Task 1.2, D4-A, D5-A) takes the freeze and the lock. It believed step 17 had no plan.
- **Step 17** (D2, recommended A) takes the same freeze and lock in its Phase 1, so that "the freeze and the Submit ship in one deploy". It says step 16's plan was not read, and its Risks line says "Step 16's plan also claims the `update` freeze … reconcile in the 16–27 cross-check before either merges".
- **Consequence as written:** two plans rewrite one handler into one locked transaction, two plans add the same lock to `lading.exists`, and two plans create `lading.concurrency.test.ts` with the same submit-vs-update interleave.
- **Verified at HEAD:** `update` has no `assertNotUnderReview` (its lading callers are `delete` `:1474` and `bulkDelete` `:1513` only), runs `assertPostApprovalEditable` on `context.db` at `:1554`, and opens its transaction at `:1609`. `lading.exists` (`resources.ts:248-254`) takes no lock.
- **Why step 16, not step 17:**
  - 16 Phase 1 has to restructure the same handler anyway. Its status echo rule (§4.1, X18) and its branch check (D7) both compare the sent value with the **loaded row**, so they must sit after the scoped load inside the transaction. A split would put two plans in one handler, which is 17 D2-C, the option 17 lists "to name the failure".
  - 16 merges first in both plans' own order (16 §7.6: "16 P1 → 16 P2 → 16 P3 → 17"; 17 §7.6: "… → 16 → 17 P1").
  - 17's argument for D2-A is the unsafe window. The unsafe order is **Submit without freeze**; **freeze without Submit** is harmless, and 17 D2-B itself says it "protects … RPC use", which the seeder and specs already exercise (`seed/run-operations.ts:112`, `e2e/specs/audit.review-queue.spec.ts:131`). With 16 P1 merged and deployed before 17 P1, there is no window.
- **What step 17 Phase 1 still does under this reading:** `<ReviewMenu>` on the bill page (D1), `lading.get.underReview` and the notice / disabled Save (D10), the `deleteAttachment` freeze (D3-B, X21), the `gates.ts` docblock, and its test cases 2 (the `deleteAttachment` half), 4, 5, 7 and 8 added to the shared file (X20). Task 1.1's own instruction already says "Grep the handler for an existing `assertNotUnderReview(` and `.for("update")` first, in case step 16 added either"; under X17 it finds both and adds neither. Task 1.2 becomes a grep that confirms 16's `exists` lock.
- **Deploy consequence:** 16 P1's release note carries 17's line "bills already submitted over RPC or by the seeder become frozen" (16-P4 / 17-P2 size it).
- **Alternative (rejected 2026-09-21):** 17 owns it (17 D2-A). Then 16 Task 1.2 shrinks to the branch check and the echo rule, both of which still need the row loaded inside the transaction; 16 would have to take the `FOR UPDATE` load anyway and 17 add the guard after it. That is the split.
- **Text fixes this settlement needs** (applied 2026-09-21): step 17 D2 marked B, its header "Cross-plan items owned", §4.2, Task 1.1–1.3 and §7.6 row 16; step 16 §7.6 row 17 ("no plan yet").

### X18 — Two vocabularies for the statuses a person may type, and the edit form's echo. **Blocker.**

**Settled 2026-09-21 (Wilfred accepted the recommendation).** Chosen: **one decision, settled in step 16 as D1 (A: `draft`, `confirmed`, `cancelled` settable; `on-hold`, `amended`, `released` and unknown strings refused; a `status` equal to the row's current one is an echo and is dropped before the check). Step 17 D8 reads "superseded by step 16 D1"; step 16 Phase 1 owns the code; 17 Task 2.3 drops its status half and 17 Task 2.5 drops its On-hold half.** Step 17's D8, Journey 4, §4.5, §4.8, Tasks 2.3–2.5 and success criteria now say so (applied 2026-09-21).

- **Step 16 D1-A** refuses `released` too: "`released` has no workflow writer at all. Check-out patches only `checkedOutAt`", so the dropdown is the only way into it. Its §4.1 adds the echo rule and a read-only Status on the edit form for a non-settable loaded value.
- **Step 17 D8-A** refuses only `on-hold` and `amended`; its Journey 4 says Status "offers Draft, Confirmed, Released, Cancelled"; its Task 2.4 keeps "the existing `:721` case" that writes `released` through `update` on a held bill.
- **Verified at HEAD — the echo breaks 17 D8-A on its own.** The edit form seeds `status: d.status` (`$id/edit.tsx:348`), builds `payload = { ...form }` (`:666`) and never blanks `status` (`NON_CLEARABLE`, `:690`). A held bill loads with `status = "on-hold"`, so **every** save of a held or amended bill sends `status: "on-hold"` / `"amended"`. A server that refuses those values without first dropping an echo refuses every edit of every held bill. 17 §4.5 noticed the Select must render the stored value but not that the value is then sent back. Today the same echo already corrupts the base status (`values.statusBefore = values.status`, `lading.ts:1604-1606`; 16 Phase 0 Finding A "New").
- **The two plans' test pins contradict.** `lading.test.ts:716-725` writes `status: "released"` through `update` on a held bill and expects `released` after Cancel Hold. 16 Task 1.3 changes `:719`/`:724` to `confirmed`; 17 Task 2.4 relies on the case as it stands.
- **Whatever vocabulary Wilfred picks, the echo rule is not optional.** Any option that refuses a value the edit form can hold must drop an unchanged `status` first. That is 16 §4.1's rule and it lives in 16 Task 1.1.
- **Interplay with step 17 D6.** 16 D1-B ("check-out also writes `released`") changes `statusAfter`, which 17 owns, and would sit beside 17 D6-A's new Check Out precondition. Had Wilfred picked 16 D1-B, that part would have moved into 17 Task 2.1, not 16 Phase 1. He picked D1-A, so nothing moves.

### X19 — The Audit Status field is removed twice

**Settled 2026-09-21 (Wilfred accepted the recommendation).** Chosen: **step 16 Phase 1 owns it (16 D3-A); step 17 D4 is settled to the same answer (A), and 17 Tasks 2.3 and 2.5 drop the `auditStatus` part after grepping for it.** Step 17's Tasks 2.3 and 2.5 now say so (applied 2026-09-21). 17 §7.6 already says "If 16 removes the Audit Status select itself, Task 2.5 drops that part". The record page's read-only **Audit Status** row (`components/lading/lading-record.tsx:212`) is untouched by both. Verified: `auditStatus` is accepted at `lading.ts:330` and `:424`, written at `:1128`; the forms render it at `create.tsx:1292-1307`, `$id/edit.tsx:1558`.

### X20 — Two new real-Postgres files with the same name, and two homes for the under-review cases

**Settled 2026-09-21 (Wilfred accepted the recommendation).** Chosen: **step 16 Phase 1 creates `packages/api/src/routers/lading.concurrency.test.ts` with the submit-vs-update interleave, and puts its `describe("under review")` cases in `packages/api/src/routers/lading.under-review.test.ts` [NEW] instead of `lading.test.ts`. Step 17 Phase 1 adds its remaining under-review cases (deleteAttachment, `get.underReview`, verbs not frozen, the `create_lading` regression) to that file; step 17 Phase 2 adds its three concurrency `describe`s (double check-in, hold vs amend, two uploads) to 16's concurrency file. Both 17 files lose their [NEW] tag.** Step 16 Task 1.3, §6 and §10, and step 17 Tasks 1.3 and 2.4, §6 and §8, carry this (applied 2026-09-21).

- Step 16 Task 1.3 and step 17 Task 1.3 both create `lading.concurrency.test.ts` [NEW] with the same deterministic interleave. At HEAD only `expense.concurrency.test.ts` exists (checked).
- The separate under-review file follows the precedent X6 set for orders (`collective-order.under-review.test.ts`), and takes one writer off `lading.test.ts`, which 16 (three phases) and 17 (Phase 2) already share.
- `DATABASE_URL_TEST` is in no workflow, so CI skips both new real-Postgres files (`lading.concurrency.test.ts`, 18's `register-hooks.concurrency.test.ts`). Each PR that owns or extends one pastes two runs against the **dev Neon branch**: failing on the pre-change code, passing after. "Skipped" is not a pass.

### X21 — Attachments under review: "stay writable" vs "freeze delete"

**Settled 2026-09-21 (Wilfred accepted the recommendation).** Chosen: **step 17 D3 governs the attachment writers (B: freeze `deleteAttachment` under review and after approval, keep uploads open); step 16 D4 is read as covering `lading.update` only.** No code conflict: step 16 writes no attachment code, and its only attachment test ("`uploadAttachment` under review → 200", 16 Task 1.3) holds under 17 D3-B. Had Wilfred picked 17 D3-A (freeze uploads too), that test would have moved to 17 and flipped. Step 16's §4.3 and D4 now say its freeze covers `lading.update` only (applied 2026-09-21).

### X22 — Refusal order on `lading.update`

**Settled 2026-09-21 (Wilfred accepted the recommendation).** Chosen: **step 16's order, because 16 owns the handler under X17: NOT_FOUND → BAD_REQUEST status (a change only) → FORBIDDEN branch (a change only) → CONFLICT under review → CONFLICT approved-and-locked → step 15's `create_lading` CONFLICT** (16 §4.9). Step 17 §4.8 listed NOT_FOUND → under review → approved → status → gate. No test in either plan asserts the relative order of status against under-review, so only 17's §4.8 text changed (applied 2026-09-21). The reverse (17's order) is rejected; both orders keep NOT_FOUND first.

### X23 — Who reshapes the order `documents` payload (step 18 D3, step 19 D1)

**Settled 2026-09-21 (Wilfred accepted the recommendation).** Chosen: **A in both plans — step 19 Task 2.2 owns the whole reshape (`counts` and `customs`, the D2 match rule, D3 permission, D4 normalisation); step 18 writes no payload code, so its Tasks 1.2 and 1.4 and its D4 are not done; 18 Phase 1 (link writer) merges before 19 Phase 2.** The two plans already recommended the same thing; 18 D3 and 19 D1 are now both Decided A.

- **Verified at HEAD:** the reader returns `null` unless `documents.counts` is an array (`apps/web/src/features/order-documents/rollup.ts:118`); the server sends the flat `OrderDocumentState` (`collective-order.ts:1859`); the "First one wins by number" fold is at `:2191`. So both mounts of the card are blank today.
- Under the rejected 18 D3-B / 19 D1-B, 18 Task 1.2 would have landed first (and needs 11 P2, 12 P1, 13 P2, 14 P1, 15 P1 merged, §1), then 19 Task 2.2 replaces it, and 18 D4 becomes live.
- **Deploy order is load-bearing:** if 19 P2's server deploys before 18 P1, every order shows three "Missing" chips under a running customs clock (18 §7.3, 19 §7.3). 18-P4 / 19-P4 (the same query) confirm no `collective_order` links exist today.

### X24 — BL numbers are compared raw at intake and normalised on the order

**Settled 2026-09-21 (Wilfred accepted the recommendation): accepted known gap, recorded; no plan changes.** It is not assigned to any of steps 16–19. Whether it later becomes a follow-up task stays Wilfred's call and is out of scope for these plans.

- Step 18 D7-A serialises intake per org, but the dedupe still compares `bl_number` as stored (`intake.ts:123`; 18 adjacent defect 3, unowned). Step 19 D4-B trims and upper-cases both sides when it matches jobs to orders.
- So `MSKU1234567` and `msku1234567 ` still make two open jobs after 18 P3, and 19's order card then reports them as **Match not certain** (19 D2-A), which is the correct warning for a real duplicate.
- Folding `normaliseBlNumber` into the intake is not a one-line import: `intake.ts` is in `packages/port-tracking`, and 19's helper is in `packages/api/src/modules/bl-tracking/bl-number.ts` [NEW]. The difference between 18-P1 (raw open duplicates) and 19-P2 (normalised) sizes it.

### X25 — Two drift scripts, overlapping queries

**Settled 2026-09-21 (Wilfred accepted the recommendation).** Chosen: **keep both scripts under their own names (16 Task 1.5 `audit-lading-state-drift-2026-09.sql`, 17 Task 2.6 `audit-lading-review-drift-2026-09.sql`); 17's script drops 17-P3, which is 16-P3 already in 16's script.** Step 17 Task 2.6 now says so (applied 2026-09-21). Both are read-only; the duplication would be harmless, but one reading per question keeps the PR counts comparable. The probe duplicates are listed in §5.

### X26 — Migration placeholders

**Settled 2026-09-21 (Wilfred accepted the recommendation).** Chosen: **unchanged rule (X14): every conditional migration in 16–19 is `00NN_<name>` and takes the next free number when its branch is rebased for merge; a step that picks a migrating option becomes the only migrating step in its wave.** All five placeholders in §3 already follow it; no plan names a number, and no migrating option was chosen.

### X27 — SOP text for steps 16–19 has no owner

**Settled 2026-09-21 (Wilfred accepted the recommendation): accepted unowned gap on the X13 terms.** No task in 16–19 edits `sop.json`, and no step is assigned the text. A `/zyt-update` pass after a step deploys stays available to Wilfred, as it was for X13, but is not scheduled by these plans. Each plan puts `customer-intake-sop/sop.json` out of scope and lists its corrections in §9 "SOP text vs code" (16: 15 rows, 17: 9, 18: 12, 19: 11). Two of them matter to users after the code lands: step 17 D9-A relies on SOP text telling documentation to write the Checked-In/Out remarks before submitting, and step 16 D1-A removes **Released** from the Status choices. The SOP page's "When a Customer Comes In" steps 16–19 describe the app as it is today until someone edits them.

**Not a new item.** Step 17 D12-A (submit-time data scope in `lading.exists`) defers with step 15 D14 under X13; no plan in 16–19 changes that.

---

## 5. Read-only production probes (SELECT only; Wilfred runs them with the owner's override)

The full SQL is in each plan's §7.7. No session connects to production. Column names were spot-checked against the schema at HEAD by the plans; three assumptions in 16's probes (`company.organization_id`, `team.organization_id`, `role.name`) and 19-P6's `role_node_grant` columns are to be re-read before running.

"Dup" means run it once, and report under both ids.

| ID | Question | Decides / blocks | Dup |
|---|---|---|---|
| 16-P1 | Status against the stamps that should have set it (released never checked out, on-hold without hold, base overwritten by the echo) | 16 D1, D2; before 16 Task 1.1 | its hold/amend columns ⊂ 17-P6 |
| 16-P2 | Status values outside every vocabulary | 16 D1; before 16 Task 1.1 | |
| 16-P3 | Review cache disagreeing with the latest submission | 16 D2, D3; before 16 Task 1.1 | = 17-P3 |
| 16-P4 | Bills by latest submission; `lading.update` rows during an open submission | 16 D4, D5; before 16 Task 1.2; the freeze notice | first query = 17-P2; second ⊂ 17-P8 (17 also counts attachment deletes) |
| 16-P5 | Bills linked to an order in another branch; role data scopes for `lading`/`collectiveOrder` | 16 D6; before 16 Task 2.1 | |
| 16-P6 | Bills whose branch is another org's team | 16 D7; before 16 Task 1.2 | |
| 16-P7 | Orders the create picker lists today vs under D9-A | 16 D9; before 16 Task 2.4 | |
| 16-P8, P9, P10 | Orders with several bills; duplicate bill numbers; cross-org party/member ids | sizing (adjacent defects) | |
| 17-P1 | Lading flow per org: enabled, post-approval, withdrawal mode, ticked gates, reviewer rows | 17 D1, D2, D9; no-director risk; before 17 Task 1.3 | |
| 17-P2 | Bills by latest submission | 17 Phase 1 deploy notice; before 17 Task 1.3 | = 16-P4 first query (re-run: it is a count at a later date) |
| 17-P3 | Audit-status cache vs engine | 17 D4, D11 | = 16-P3 |
| 17-P4 | Bills held and released now; released without check-in; check-outs while held | 17 D6; before 17 Task 2.1 | |
| 17-P5 | Same move recorded twice within 5 s | 17 D5 urgency | |
| 17-P6 | Workflow statuses disagreeing with stamps | 17 D8 (under X18: 16 D1); before 17 Task 2.3 | ⊇ 16-P1's hold/amend columns |
| 17-P7 | Uploaded scans missing from the list, never deleted | Finding E sizing | |
| 17-P8 | `lading.update` / attachment deletes during review | Finding B sizing | ⊇ 16-P4 second query |
| 17-P9 | Hold reasons ever recorded | 17 D7 | |
| 17-P10 | Remark edits through `lading.update` | 17 D9; before settling D9 | |
| 18-P1 | Open duplicate `bl_job`s per (org, BL) | 18 D7; before 18 Task 3.1; release note | related to 19-P2 (19 normalises and splits open/finished) |
| 18-P2 | Approved `mbl_hbl` documents with no job; whether another job holds the BL | 18 D8; before 18 Task 3.1 | |
| 18-P3 | Approved invoice/packing-list documents named like a B/L | 18 D10 | |
| 18-P4 | `document_link` counts by entity type | 18 Phase 1 release note; X23 | = 19-P4 |
| 18-P5 | Reject-then-reprocess workaround use | 18 D5 urgency | |
| 18-P6 | Approved documents whose final extraction has an error-severity issue | 18 D6 | |
| 18-P7 | `document_type_setting` per org (auto-approve drops notices) | sizing (adjacent defect 2) | |
| 18-P8 | `member.remove` / `member.leave` frequency | 18 D11 | |
| 19-P1 | Orgs with open jobs; each portal login saved; last `check_observed` | 19 Phase 1 urgency, D7 | |
| 19-P2 | BL numbers with more than one non-voided job, open vs finished | 19 D2; before 19 Task 2.1 | related to 18-P1 |
| 19-P3 | Orders matching a job exactly vs only after trim/upper | 19 D4 (drop Task 2.1 if equal); before 19 Task 2.1 | |
| 19-P4 | `document_link` counts by entity type | 19 D1, §7.3 | = 18-P4 |
| 19-P5 | Open jobs past deadline with boxes in the yard, last alert | Q1 (not planned) | |
| 19-P6 | Roles with `document.read` but not `bl-job.read` | 19 D3; before 19 Task 2.1 | |
| 19-P7 | Who can void | Q3 (not planned) | |

---

## 6. Suggested waves for a runbook for steps 16–19

This continues the global wave numbering: Waves 1–4 are `steps-4-10-runbook.md`'s, Waves 5–11 are `steps-11-15-runbook.md`'s. A wave starts only when every branch of the previous wave has merged. Every decision was settled on 2026-09-21, so the decision ids in the "Before starting" column are kept for the record and now read as **probe re-checks only**. No wave below migrates under the settled options.

| Wave | Starts when | Runs in parallel | Merge order in the wave | Before starting | Deploy notes |
|---|---|---|---|---|---|
| **12** | Wave 11 merged (so 15 P1–P3 and 14 P1–P3 are in) | `wt-step16` (16 P1) · `wt-step18` (18 P1) · `wt-step19` (19 P1) | 18 P1 → 19 P1 → 16 P1 (any order works; disjoint files) | 16 D1, D3, D4, D5, D7 (D2 for Task 1.5); 18 D1, D2, D3; 19 D7; X17–X23 settled; probes 16-P1, P2, P3, P4, P6; 18-P4; 19-P1 | 16 P1: either order, announce "retract before editing"; 18 P1: either order, build web first; 19 P1: server first |
| **13** | Wave 12 merged | `wt-step16` (16 P2) · `wt-step18` (18 P2) · `wt-step19` (19 P2) | 16 P2 → 18 P2 → 19 P2 | 16 D6, D8, D9, D10; 18 D5, D6; 19 D1–D5; X23, X24; probes 16-P5, P7; 18-P5, P6; 19-P2, P3, P6 | 16 P2: server before web; 18 P2: web only; **19 P2 only after 18 P1 is deployed** (X23) |
| **14** | Wave 13 merged | `wt-step16` (16 P3) · `wt-step18` (18 P3) · `wt-step19` (19 P3) | 18 P3 → 16 P3 → 19 P3 | 16 D11, D12; 18 D7, D8; 19 D6; probes 18-P1, P2 | 16 P3: either order; 18 P3: API only; 19 P3: server first |
| **15** | Wave 14 merged (all of 16) | `wt-step17` (17 P1) | 17 P1 | 17 D1, D2 (= X17), D3, D10; probes 17-P1, 17-P2 | **API before web** |
| **16** | Wave 15 merged | `wt-step17` (17 P2) | 17 P2 | 17 D4–D9, D11 (D8 under X18); X18, X19, X25; probes 17-P4, 17-P6 | API first cleanest |

Wave 12–14's three phases in each wave have disjoint write sets (checked against each plan's §6): 16 writes the `lading/*` and `lading.ts`/`resources.ts`/`resolve-order.ts` side; 18 writes the document side and, in Wave 14, one `ALLOWED_EXECUTE_SITES` entry; 19 writes the `bl-job` side and, in Wave 13, `enrichOrderRows` in `collective-order.ts`, which no 16–18 task writes.

Alternatives Wilfred may choose:
- **Start 18 P1 and 19 P1 earlier.** Neither depends on any 04–15 phase (§1) and no 04–15 plan writes their files, so they could run beside Waves 5–11. Holding them to Wave 12 keeps one clear start line and costs only calendar time.
- **Start 16 P1 beside Wave 11.** 16 §7.6 says it has no file in common with 14 P3; it needs only Wave 10 (15 P3).
- **17 owns the freeze (X17 alternative; rejected 2026-09-21).** Then 16 P1 would still have taken the status, branch and `FOR UPDATE` load, 17 P1 would have added the guard after it, and the waves would have stayed the same.
