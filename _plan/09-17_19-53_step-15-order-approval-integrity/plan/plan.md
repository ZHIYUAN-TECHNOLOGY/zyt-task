# Step 15 — an order approval covers what the reviewer read, only the queue can grant it, and an unapproved order cannot get a bill of lading

**SOP step:** 15 "Get the order approved" · trade ledger row → **Review this order** menu → **Submit for review** · reviewer decides under **Approvals → Order review** (`/approve/order`)
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-17. This is the same commit steps 04–11 were planned at. Every `file:line` below was located by symbol at that HEAD in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Working tree note:** besides the unrelated `_plan/` and `docs/reference/` deletions, the tree also carries uncommitted edits to `e2e/fixtures/seed-cli.ts`, `e2e/fixtures/types.ts`, `e2e/playwright.config.ts`, `e2e/qa-manifest.ts` and untracked `e2e/specs/intake.golden-path.spec.ts`, `e2e/reporters/step-events.ts`. `git status -- packages apps` is clean, so every code citation below matches HEAD. §10 uses the e2e seed; re-read it at the base commit before running. Under X16 Wilfred commits or sets aside these e2e changes himself before Wave 6; agents never stash, reset or check them out.
**Tier:** Standard. Changes guards on every order write path, a row lock, the shared audit-engine registry (`resources.ts`), the seeded audit flows, a new gate key wired into `lading.ts` and `cost-lines.ts`, deletes two live RPC procedures from a guarded allow-list, and changes behaviour for existing orgs and live orders. No migration (D11-A decided).
**Cross-plan items owned:** none handed over by name. This plan takes the "collective orders: same hole remains" rows that step 08 §7.1 (rows 1 and 3) flagged to "the orders step", and it mirrors step 08 D1-B, D3-A, D4-A, D5-A, D6-A, D8-A and D10-A for `collective_order`.
**Ownership of the order under-review freeze (D17, Decided B, Wilfred 2026-09-17; `steps-12-15-crosscheck.md` X6).** This is the same question as step 12 D5 and step 14 D5. It was labelled "X1" in an earlier revision of this plan. It is now D17, because X1 already means step 10's self-decision switch in `steps-4-10-crosscheck.md`. **Step 15 owns the freeze on all seven order writers, the unconditional lock in `collective_order.exists` and `collective-order.under-review.test.ts` [NEW]; merge 15 Phase 1 before 14 Phase 1** (X6, step 14 D5-C). The `assignNumber` row lock is step 12 Task 1.1's (X7); step 15 adds only the under-review refusal there. §4.1 "Operative spec (D17-B)" governs Tasks 1.2–1.4. D17-A (step 14 owns it) is kept in §9 as a rejected alternative only.
**Settled 2026-09-17.** Wilfred accepted every recommended option in this plan (§9) and every recommended settlement in `steps-12-15-crosscheck.md` X6–X16.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope` at `procedures/org.ts:429`). Drizzle schema in `packages/db/src/schema`, migrations in `packages/db/src/migrations`. TanStack Router file routes in `apps/web/src/routes/_next`. zod on both sides. vitest on PGlite (`pushTestSchema`). Dev: web `:3101`, server `:3000` (`.claude/launch.json`).

- **The step today, end to end.**
  - **Submit.** The ledger Actions cell (`apps/web/src/components/order-ledger/order-ledger-page.tsx:157`) and the reading pane (`:1228`) render `<OrderRowActions>`. It binds `engineReview("collective_order")` and renders `<ReviewMenu>` unless `isReview` (`order-row-actions.tsx:135`). The menu offers Submit / Approve / Reject / Request withdrawal / Approve withdrawal on every row (`components/review-menu.tsx:49-56`).
  - **Engine.** `auditReview.submit` (`packages/api/src/routers/audit-review.ts:355`) runs `submitForReview` in a transaction. `submitForReview` (`modules/audit/submit.ts`) checks `submitNode` (`:33`), `entry.exists` (`:39`), the enabled flow (`:45`), initiators, one open attempt (`:71-84`), inserts the submission and repaints the order cache.
  - **Queue.** `/approve/order` mounts `<SeaExportPage mode="review" businessType={undefined} />` (`routes/_next/approve/order.tsx:30`). The list input sets `awaitingMyReview` (`order-ledger-page.tsx:342`). The toolbar decides through `engineDecideBatch("collective_order", …)` (`:447`). Nav entry `components/shell-next/nav.ts:99`.
  - **Seed.** `SEEDED_FLOWS` "Order review" (`modules/audit/seed.ts:145-152`): one stage, role `accounting`, `any_pass_all_reject`, **`gates: []` (`:150`)**. `seedAuditFlows` skips a trigger that already has a flow (`:223`), writes `postApprovalEditable: false` (`:232`) and `enabled: flow.enabled ?? true` (`:233`). Its only production caller is `org.create` (`routers/org.ts:132`), so **editing the seed changes nothing for existing orgs**.
  - **Roles** (`packages/api/src/roles.ts`): admin and branch-manager hold the `collectiveOrder` root; sales hold `collectiveOrder.update` but not review; **ops hold the root (`:169`), so update and review**; **accounting holds `collectiveOrder.review` as a leaf (`:191`) and no update**, so accounting cannot submit through the engine.

- **Finding A (editable under review): confirmed, and wider than filed.**
  - `assertNotUnderReview` does not occur in `packages/api/src/routers/collective-order.ts`. Its callers repo-wide are `company.ts:1343`, `lading.ts:1474, 1513`, `quotation.ts:980`.
  - `assertPostApprovalEditable` (`modules/audit/post-approval.ts:32`) returns unless the latest attempt is `passed`, so it is inert while `under_review`.
  - Guard table for the order router, by symbol:

  | Procedure | Line | Lock check | Post-approval | Under review | Web caller |
  |---|---|---|---|---|---|
  | `assignNumber` | 2770 | `assertUnlocked` :2801 | :2800 | none | `assign-job-number-button.tsx:159` |
  | `update` | 2847 | :2898 | :2892 | none | `order-form.tsx:1644` |
  | `updateBatch` | 2997 | :3056 | **none** | none | none |
  | `delete` | 3148 | :3162 | none | none | none |
  | `review` (legacy) | 3380 | :3404 | – | – | none (banned) |
  | `reviewBatch` (legacy) | 3487 | :3515 | – | – | none (banned) |
  | `transition` | 3581 | carve-out | – | – | none |
  | `batch` (incl. `delete`) | 3694 | carve-out | – | – | none |
  | `saveChildren` | 3954 | :3995 | **none** | none | `order-form.tsx:1733`, `order.$orderId.expenses.tsx:598` |
  | `setAbnormalTags` | 4729 | :4757 | :4756 | none | `order-form.tsx:1762` |

  - The finding's hints are wrong in two places: `:4756` is `setAbnormalTags`, not `saveChildren`; and the procedure at `:2800` is `assignNumber` (`:2770`), not "assignJobNumber". `saveChildren` has **no** `assertPostApprovalEditable` to sit beside, so the finding's repair has no anchor there (step 08 §7.1/§7.2 repeat the ambiguity, citing `:2800, 2892, 4756`).
  - **Race.** Every order write loads without `FOR UPDATE`, and `REVIEWABLE_RESOURCES.collective_order.exists` (`modules/audit/resources.ts:204-215`) takes no lock, so a save can commit after a concurrent submit (step 08 D10's race, for orders).
  - **No content hash.** `audit_submission` (`packages/db/src/schema/audit.ts:348-415`) has no version or hash column.
  - **Delete leaves an orphan.** `delete` and `batch` `delete` neither refuse nor close an open submission. `eligibleOpenSubmissions` (`audit-review.ts:143`) does not join the resource, so the queue count keeps a row nobody can open. The schema docblock (`schema/audit.ts:356-360`, "Orphan rows are prevented by the resource's own delete path") is false for orders.
  - **The fee grid is a separate writer.** `/order/$orderId/expenses` calls `saveChildren` with **costs only** (`order.$orderId.expenses.tsx:630-643`), and `costLines.create` with an `orderId` writes the same `cost_line` rows while checking only `locked` (`routers/expense/cost-lines.ts:1061`, order load `:1176-1204`, `refuseIfOrderLocked`). The seed's own note reads "Orders are reviewed for operational correctness, not for money" (`seed.ts:151`). See D2.

- **Finding B (approval freezes nothing downstream): confirmed, and the filed repair would break step 14.**
  - `assertGatesCleared` (`modules/audit/gates.ts:64`) returns at `:79` with no enabled flow and at `:85` when the key is not ticked. When ticked, it blocks every id whose latest submission is not `passed` (`:92`), **including an order never submitted** (`gates.test.ts:155`, "refuses a ticked verb on a record that was never submitted").
  - Nine keys are declared (`modules/collective-order/gates.ts:36-46`); none is seeded. `create_lading` does not exist, and eyun's 14 Order checkboxes (listed in the same file's comment) do not include one. Adding it is a deviation for `docs/prd/audit-management.md` "Deviations from eyun, and why" (`:99`).
  - `lading.create` (`routers/lading.ts:1030`) resolves the order with `resolveLadingOrder` (`:1048`; `modules/lading/resolve-order.ts:142`), which selects only the id. `lading.update` re-links a B/L by id or number (`lading.ts:1588-1600`, via `matchedOrderId`, `resolve-order.ts:75`). **A gate on `create` alone is bypassed by creating unlinked and linking on update.**
  - `lock`, `unlock`, `end_order` and `shut_out` are wired in `transition` (`:3644-3650`) and `batch` (`:3760-3766`), but **neither has a web caller** (grep of `orpc.collectiveOrder.*` / `client.collectiveOrder.*` in `apps/web`). "Exported" is `export_document` in `routers/export.ts:216-223`, which gates cost-line exports by their orders.
  - **Tenants can already tick keys** in Approval Process Setting (`modules/audit/flow-admin.ts:116`, `gateKeys` input `:86`). "Nothing ticked" is a seed fact; production needs probe P1.
  - **Ticking content keys half-saves step 14.** The edit form calls `update` (`order-form.tsx:1644`), then `saveChildren` with all child arrays (`:1732-1749`) as a separate request. With `expense_entry`, `container_info` or `cargo_info` ticked, every save of an unapproved order writes the header and then gets CONFLICT on the children. Since SOP step 14 (fill in containers, cargo, fees) precedes step 15, the filed repair ("tick expense_entry") contradicts the SOP. See D5 and D15.
  - `costLines.create` has no `expense_entry` call, so ticking that key still leaves the fee ledger open. See D7.

- **Finding C (legacy `collectiveOrder.review`): confirmed, and wider than filed.**
  - `review` (`:3380`) requires `COLLECTIVE_ORDER.review` (`:3381`), checks `canAuditTransition` (`:3410`; table `packages/api/src/quotation/values.ts:257-265`, `draft→pending→approved` legal), writes `orderAuditStatus` and the stamps directly (`:3420-3456`), and files no `audit_submission`. `isAuditorDecision` (`values.ts:282`) only picks the stamp pair; nothing compares the actor with `orderSubmittedBy`.
  - `reviewBatch` (`:3487`) is the same defect for up to `MAX_BATCH_IDS` orders.
  - Holders: admin, branch-manager, ops (root) and **accounting (leaf)**. Accounting cannot submit through the engine but can take any order `draft→pending→approved` alone through this verb.
  - It also **corrupts engine state**: it reads no submission, so it can move the cache of an order whose engine attempt is `under_review` or `rejected` (for example `rejected→draft→pending→approved`). The ledger badge then says Approved while every ticked gate still refuses.
  - The last web caller was removed (comment `order-row-actions.tsx:54-63`); `apps/web/src/architecture.test.ts:957` ("no legacy per-resource review verb is reached from the web app") bans it. Remaining references: allow-list `packages/api/src/architecture.test.ts:494` and indirect `:876`; tests `collective-order.guards.test.ts:474-599` (describe "order review — the writer orderAuditStatus never had", whose J3 filter test at `:480` uses the verb to create stamps), `:741-754`, `:756-811`; comments in `seed.test.ts:283`, `e2e/fixtures/seed-cli.ts:62`, `e2e/specs/audit.order-queue.spec.ts:24, 166`.
  - **Deleting it fails `permissions/registry.sync.test.ts:22`** ("every registry node marked isEndpoint gates a real endpoint"): `requireNode(COLLECTIVE_ORDER.review)` appears only at `:3381` and `:3488`, and `resources.ts:203` is checked with `permittedNode` at decide time (`decide.ts:50`), which does not call `recordEndpointNode` (`procedures/org.ts:233, 255`). The node is declared `isEndpoint: true` at `modules/collective-order/permissions.ts:94-98`.
  - **Step 08 has no resolution to copy.** Step 08 Task 3.3 (`step-08-quotation-approval-integrity.md:374`) only deletes `quotationsRouter.review` and `feeTemplates.review`; the plan never mentions `registry.sync`, `isEndpoint` or `recordEndpointNode`. At HEAD `requireNode(QUOTATION.review)` occurs only at `quotation.ts:3846`, and `modules/quotation/permissions.ts:56-60` marks that node `isEndpoint: true`, so step 08 hits the same `registry.sync.test.ts:22` failure unplanned. This plan picks its own resolution (D9) and flags the gap to step 08.
  - `canAuditTransition` / `isAuditorDecision` / `applyReviewBatch` stay (bills and cost lines use them).

- **Adjacent defects in the same paths (not in the findings).**
  1. `saveChildren` has no post-approval freeze, so containers, cargo and appendages stay writable on an approved order whose `update` refuses (D3).
  2. `updateBatch` has no audit guard at all (D1).
  3. Deleting an order leaves an orphan open submission (D1 freezes delete; D13 reports residue).
  4. `submitForReview` ignores order state: `exists` is org-only, with no data scope and no `archived` / `acceptStatus` check (D14).
  5. Engine `decide` does not refuse a locked order; the legacy verb did (`:3404`). Low severity; flagged only.
  6. `assignNumber` is frozen after approval (`:2800`), so an approved order with no job number can only be duplicated (D16).
  7. `transition`/`batch` archive and delete have no gate key (matches eyun); flagged only.
  8. `lading.update` has no `assertNotUnderReview` and runs its post-approval check on `context.db` outside its transaction (`lading.ts:1554`). Owner: steps 16/17; flagged only.
  9. No order screen reads `orderAuditStatus` (`order-form.tsx`, `order-record-page.tsx`), so nothing tells an operator an order is under review (D12).

- **Precedent this plan follows.**
  - Freeze placement: after the scoped load, inside the transaction, before any write (`quotation.ts:980`, `company.ts:1343`, `lading.ts:1474`). Step 08 Task 1.1 order: other refusals → `assertNotUnderReview` → `assertPostApprovalEditable`.
  - Serialization: step 08 Task 1.2 (`FOR UPDATE` on the router load and on the resource's `exists`). Lock precedent `modules/audit/shared.ts:33` (`loadSubmissionForUpdate`).
  - Deleting a legacy verb: step 08 Task 3.3 (D4-A, X3).
  - Self-decision: step 08 D1-B `separationOfDuties` on `ReviewableResource`, written `false` for `collective_order`; step 10 X1 (steps-4-10-crosscheck.md) flips its own resource in one line.
  - Re-submit of a locked approval: step 08 D3-A (Task 3.2) is engine-wide and already covers orders. **Nothing to add here.**
  - Drift report: step 08 Task 3.5 (`packages/db/scripts/audit-quotation-review-drift-2026-09.sql` [NEW in that plan]; `packages/db/scripts/` does not exist at HEAD).
  - Gate tests: `routers/audit-review.test.ts:1078` ("the Order trigger's newest gates") raw-inserts `audit_flow_gate` rows. `modules/audit/gates.test.ts:67` scans source for **literal** `assertGate(s)Cleared(…, "collective_order", …, "<key>")` callers, and `:91` checks seeded keys against the vocabulary.

- **Migration state.** The journal ends at `0065_quotation_send_decision` (idx 64); 65 `.sql` files; contiguous, nothing pending. Reservations by other plans: 0066/0067 (01/02), 0068 (04), 0069–0072 conditional (05–08), 0073 (09), 0074 (10), 0075 conditional (11). **This plan needs no migration** (D11-A decided). D11-B, not chosen, would have used `00NN_audit_submission_content_hash`; per X14 every conditional migration is named `00NN_<name>` and numbered at merge (runbook §6), including step 12 D3-B's former `0076_…`.

---

## 1. Overview

**Problem.** An operator submits an order and can keep rewriting it (vessel, ports, containers, cargo, client) until accounting presses Approved, so the approval stamps land on content the reviewer never saw. Nothing downstream asks whether the order was approved: an unsubmitted, pending or **rejected** order still gets a bill of lading. And a legacy endpoint still lets anyone holding `collectiveOrder.review` (ops, admin, branch manager, accounting) stamp an order approved alone, without a submission, bypassing `/approve/order`.

**Goals.**
- **Phase 1 (finding A):** while an order is under review, every write to its operational content is refused with a sentence saying how to change it (withdraw first). Submit and save cannot interleave. The order screens say it is under review.
- **Phase 2 (finding C):** the engine is the only writer of `order_audit_status`. Nobody decides an order they submitted.
- **Phase 3 (finding B):** approval unlocks something. A new org's order flow freezes lock, end, shut-out and **raising a B/L** until the order is approved, and existing orgs get the same switch plus the evidence to decide when to turn it on.

**Success criteria.**
- `collectiveOrder.update`, `updateBatch`, `assignNumber`, `setAbnormalTags`, `delete`, `batch({action:"delete"})`, and `saveChildren` with containers, cargo or appendages return CONFLICT _"This record is under review and cannot be edited. Retract the submission first."_ on an order whose latest attempt is `under_review` or `withdrawal_under_review`, and write nothing. They succeed on never-submitted, rejected and withdrawn orders. This plan adds all of these guards (D17-B decided, X6) and proves them in `collective-order.under-review.test.ts` [NEW], the file step 14 already names.
- The order edit form shows the under-review notice with **Save** disabled, derived from the engine's latest submission, not from the `order_audit_status` cache (D12).
- `/rpc/collectiveOrder/review` and `/rpc/collectiveOrder/reviewBatch` answer 404. Both architecture tests and `registry.sync.test.ts` pass.
- With `create_lading` ticked, `lading.create` naming an order that is not approved returns CONFLICT _"\"Raise bill of lading\" requires review approval first"_ and creates no lading; the same order after approval succeeds; linking an existing B/L to that order through `lading.update` is refused the same way.
- A new org (`org.create`) has an Order review flow with `lock`, `end_order`, `shut_out`, `create_lading` ticked (D5-A).

**In scope.** Under-review freeze and row lock on the order writes: all seven writers and the `exists` lock (D17-B decided; the `assignNumber` lock itself is step 12 Task 1.1's, X7); `saveChildren` post-approval freeze (D3); UI notice; deleting the two legacy verbs and their allow-list/registry fallout; `separationOfDuties: true` for orders; `create_lading` key and its callers; `expense_entry` in `costLines.create`; seeded gates; the existing-org rollout decision; a read-only residue report; read-only production probes for Wilfred.

**Out of scope.**
- Merging `update` + `saveChildren` into one atomic save (step 14's plan; D15).
- Order-state refusals at submit (D14-C decided: deferred and unowned; accepted known gap per X13, see §9 Risks).
- The `assignNumber` row lock (step 12 Task 1.1, X7).
- SOP text for step 15 (unowned; accepted known gap per X13).
- `lading.update` under-review freeze and transaction boundary (steps 16/17).
- Repairing drifted caches, orphans, or B/Ls already raised on unapproved orders (D13-A reports only).
- `ReviewMenu` offering every verb on every row (a cross-resource UI issue, shared with quotations).
- Engine `decide` on a locked order (adjacent defect 5).
- The engine re-submit refusal (step 08 Task 3.2 already covers orders).

**SOP findings (`customer-intake-sop/sop.json`, step 15 `fixes`):**

| Finding | Planned? | Where |
|---|---|---|
| `nct-s15-a-collective-order-stays-fully-editable-while-it` | Yes | Phase 1 |
| `nct-s15-order-approval-freezes-nothing-downstream-so-app` | Yes, with a different gate set than filed (D5) | Phase 3 |
| `nct-s15-the-legacy-collectiveorder-review-verb-lets-ops-` | Yes | Phase 2 |

**Input Gate.** No Input Gate was held; Wilfred accepted every recommendation on 2026-09-17 (§9).

**Decisions (settled 2026-09-17)** (each is **Decided** in §9, with its three approaches kept):
- Step 15 owns the freeze on all seven writers, the `exists` lock and `collective-order.under-review.test.ts`; 15 P1 before 14 P1 → D17-B (X6)
- The fee grid (`saveChildren` costs) stays outside the order freeze → D2-B
- `saveChildren` gains the post-approval freeze for containers, cargo and appendages → D3-A (re-check P13 before Task 1.2)
- Orders turn on `separationOfDuties` → D8-A (re-check P1, P12 before Task 2.2)
- New orgs seed `lock`, `end_order`, `shut_out`, `create_lading` → D5-A (re-check P1 before Task 3.4)
- `create_lading` checked in `lading.create` and on re-link in `lading.update`; `expense_entry` in `costLines.create` → D7-A
- Existing orgs: no automatic change, admins tick per org → D6-A (P2, P5, P11 feed the release note)
- The freeze covers every order content writer, delete and batch delete included → D1-A
- A concurrent submit and save are serialized by `FOR UPDATE` on the order row → D10-A
- The legacy `review` / `reviewBatch` verbs are deleted → D4-A (re-check P4 before Task 2.1)
- The `collectiveOrder.review` node stays and drops `isEndpoint: true` → D9-A (step 08 does the same for its nodes, X10)
- No content hash on submissions → D11-A
- The edit form shows a notice and disables Save, driven by the engine → D12-A
- Production residue is reported read-only → D13-A
- Submit-time order-state checks deferred and unowned (accepted known gap, X13) → D14-C
- Half-save left to step 14; content keys not seeded → D15-C
- `assignNumber` stays frozen after approval → D16-B (re-check P10 before Task 1.2)

## 2. User Journeys

**Journey 1 (changed): Operations submit an order and cannot rewrite it while accounting reads it**
Trigger: SOP step 14 is done; the order is saved.
Steps:
1. Ops open `/order/sea-export`, open the row's **Review this order** menu, choose **Submit for review** → toast _"1 row — submit for review"_ (`review-menu.tsx:110`); the Audit status column reads Pending (unchanged).
2. Ops open `/order/$orderId/edit` → a notice above the form reads _"Under review. Withdraw it from the trade ledger's review menu to make changes."_ **Save** is disabled with the same text as its title (D12; driven by the engine's latest submission, not the cached badge).
3. Ops (or a stale tab loaded before submit) press Save anyway → the server refuses `update` with the under-review sentence; the form's existing catch toasts it (`order-form.tsx:1771`). Nothing is written, so no half-save: `update` runs first and refuses.
4. Ops open `/order/$orderId/expenses` and add a fee → saved (D2-B: fees are governed by the cost-line review, not the order freeze).
5. To correct the order, ops choose **Request withdrawal** on the row menu → the seeded flow is `withdrawalMode: "direct"`, so the attempt becomes `withdrawn` at once and the badge reads Withdrawn. The edit form's notice disappears; ops save, then **Submit for review** again.
6. Flow ends: accounting's queue shows one open attempt whose content matches what was saved before submit.
Where it lives: the existing ledger row menu, the existing edit form (one notice and a disabled state), the existing server handlers.

Old journey, for contrast: at step 3 the save succeeded and accounting approved the edited order without seeing the change.

**Journey 2 (changed): Accounting approves an order in the queue, and nobody approves their own**
Trigger: an order is Pending.
Steps:
1. Accountant opens **Approvals → Order review** (`/approve/order`) → the row is listed (unchanged).
2. Ticks it and presses **Approved** → the submission passes; the badge reads Approved.
3. An ops member who holds the root also sits on a tenant-configured stage and submitted the order → the row is **not** in their queue, and a decision call returns FORBIDDEN _"You submitted this record. Another reviewer must decide it."_ (D8-A, via step 08's engine code).
4. Anyone calling `collectiveOrder.review` / `reviewBatch` over RPC gets 404 (D4-A).
5. Flow ends: `order_audit_status` changed only through `audit_submission`.
Where it lives: the existing queue; server only for steps 3–4.

**Journey 3 (new refusal): Documentation raises a B/L on an order that is not approved**
Trigger: an org whose Order review flow ticks **Raise bill of lading** (new orgs under D5-A; existing orgs once an admin ticks it, D6-A).
Steps:
1. Documentation opens `/lading/create`, picks an order that is Draft, Pending or Rejected in the **Linked order** select (which also copies its job number into **Order No**, `lading/create.tsx:1242-1270`), fills the B/L, presses Create → toast _"\"Raise bill of lading\" requires review approval first"_ (`lading/create.tsx` `onError` already toasts `err.message`). No lading is created; the form keeps its values.
2. The same with an **unlinked** B/L (**Linked order** set to "No order linked" **and** **Order No** emptied, so `resolveLadingOrder` cannot match the text) → created, as today.
3. Opening that unlinked B/L and setting the unapproved order's number → the same refusal, and the link is unchanged.
4. After accounting approves the order, Create succeeds and the B/L links to it.
5. Flow ends: every linked B/L in a gated org points at an approved order.
Where it lives: the existing `/lading/create` form and B/L edit page; server refusal only.

**Journey 4 (changed): An admin turns the freeze on for an existing org**
Trigger: Wilfred has read probes P1, P2, P5, P11 (§7).
Steps:
1. Admin opens Approval Process Setting → Order review → gate checkboxes → the new **Raise bill of lading** box appears beside the nine existing ones.
2. Ticks Lock, End/Cancel the end, Shut out, Raise bill of lading; saves.
3. From that moment, every order not approved (never submitted included) refuses those verbs. Ops submit the live backlog; accounting clears it in `/approve/order`.
4. Flow ends: the org matches a newly seeded org.
Where it lives: the existing flow editor (`flow-admin.ts` renders the declared vocabulary, so no web change).

## 3. Result (What Changes for the User)

**Before:** an order can be rewritten after it is submitted, stamped approved by an ops member or accountant alone through a hidden endpoint, and — approved, rejected or never submitted — it gets a bill of lading all the same.
**After:** a submitted order is frozen until it is approved, rejected or withdrawn. Approval happens only in the queue, by someone other than the submitter. In a gated org an order cannot get a B/L, be locked, ended or shut out until it is approved.
**Key differences:**
- Ops: the edit form says "Under review" and Save is disabled; to change a submitted order, withdraw it first.
- Accounting: what they approve is what was submitted; the queue count no longer includes rows they cannot decide.
- Documentation (gated orgs): B/L creation or linking on an unapproved order is refused with a reason.
- Admins: a **Raise bill of lading** checkbox; new orgs arrive with four order gates ticked.
- Nobody: fees on the order stay writable while it is under review (D2-B).

## 4. Technical Architecture

### 4.1 Under-review freeze on order writes (Journey 1 steps 2–3; Phase 1) → D17, D1, D2, D3, D10

**Owner (D17-B decided, X6).** Step 15 Phase 1 adds every guard and lock below; step 14 adds no freeze and its `assertPublishable` readiness hook (X9) is a plain read. Merge order: 15 Phase 1 → 14 Phase 1. Step 12 Task 1.1 (merged before 15 Phase 1) already owns `.for("update")` on `assignNumber`'s scoped load (X7); Task 1.2 greps that handler for `.for("update")` and does not add a second one.

Order inside each handler, after the scoped load and its NOT_FOUND:
`existing refusals (retired type, job-number conflict)` → **`assertNotUnderReview`** → `assertPostApprovalEditable` → `locked` check → writes.

**Operative spec (D17-B)** in `packages/api/src/routers/collective-order.ts`, by symbol (re-locate at the base commit; step 11 Phase 2 moves ~130 lines out of this file and step 12 Task 1.1 edits `assignNumber`):

```ts
// update, setAbnormalTags — scoped load gains .for("update"); before assertPostApprovalEditable
await assertNotUnderReview(tx, organizationId, "collective_order", input.orderId);

// assignNumber — lock already added by step 12 Task 1.1 (X7); after the has-number CONFLICT, before assertPostApprovalEditable
await assertNotUnderReview(tx, organizationId, "collective_order", input.orderId);

// delete (:3148 at HEAD) — scoped load gains .for("update"); before assertUnlocked(existing, "deleted")
await assertNotUnderReview(tx, organizationId, "collective_order", input.orderId);

// updateBatch — rows load .orderBy(collectiveOrder.id).for("update") (no orderBy at HEAD, :3046-3049)
await assertNoneUnderReview(tx, organizationId, "collective_order", ids);          // NEW helper
await assertPostApprovalEditableMany(tx, organizationId, "collective_order", ids); // NEW helper

// batch — only when input.action === "delete": rows load .orderBy(collectiveOrder.id).for("update")
await assertNoneUnderReview(tx, organizationId, "collective_order", ids);

// saveChildren — scoped load gains .for("update"); conditional from day one (D2-B), so there is no interim window
const writesOrderContent = Boolean(input.containers || input.cargo || input.appendages);
if (writesOrderContent) {
  await assertNotUnderReview(tx, organizationId, "collective_order", input.orderId);
  await assertPostApprovalEditable(tx, organizationId, "collective_order", input.orderId); // D3-A, new
}
```

Task 1.3 adds `.for("update")` to `REVIEWABLE_RESOURCES.collective_order.exists` (`resources.ts:204-215`) **unconditionally**, on the step 08 Task 1.2 pattern. That lock is taken at `submit.ts:39`, before the open-attempt check at `:71-84`. The tests go in `packages/api/src/routers/collective-order.under-review.test.ts` [NEW], the file step 14 already runs, and not in `collective-order.guards.test.ts`.

**New helpers** in `packages/api/src/modules/audit/gates.ts` and `post-approval.ts` (additive; one `latestSubmissionByResource` query for the whole selection, like `assertGatesCleared`). Step 15 introduces both (D17-B); step 14 adds no selection helper:

```ts
/** All-or-nothing twin of assertNotUnderReview for a selection (≤ MAX_BATCH_IDS). */
export async function assertNoneUnderReview(
  db: Context["db"] | DbTransaction, organizationId: string,
  resourceType: AuditTriggerType, resourceIds: readonly string[],
): Promise<void>;
// message: "N of M selected are under review and cannot be edited. Retract those submissions first."

/** post-approval.ts — same rule as assertPostApprovalEditable over a selection. */
export async function assertPostApprovalEditableMany(
  db: Context["db"] | DbTransaction, organizationId: string,
  resourceType: AuditTriggerType, resourceIds: readonly string[],
  options?: { message?: string }, // same optional arg step 08 Task 3.1 adds to the single form
): Promise<void>;
```

**Submit/save serialization → D10 (D10-A, D17-B decided).** The lock lives in `collective_order.exists`, taken at `submit.ts:39` before the unlocked open-attempt SELECT at `:71`, and the seven writers lock the same row (`assignNumber` through step 12 Task 1.1's lock, X7). Step 14's readiness hook is a plain read (X6, X9). Batch loads order by id before locking to avoid lock-order deadlocks.

**Why `saveChildren` checks only when content arrays are sent → D2.** The fees page sends `costs` alone (`order.$orderId.expenses.tsx:630-643`). Costs are `cost_line` rows with their own review flow and the same rows `costLines.create` writes unfrozen. The edit form always calls `update` first, so an under-review edit from the form is refused before `saveChildren` runs.

**Docblocks.**
- `gates.ts:103-129` (`assertNotUnderReview`): after step 08 Task 1.3 rewrites it, add this plan's order callers (`update`, `assignNumber`, `setAbnormalTags`, `delete`, `saveChildren`; `updateBatch` and `batch` delete through `assertNoneUnderReview`) and note that `saveChildren` calls it only for content arrays.
- `packages/db/src/schema/audit.ts:356-360`: say that order delete refuses while a submission is open (true after Task 1.2), and that terminal attempts may outlive their record.

### 4.2 Order screens say "under review" (Journey 1 step 2; Phase 1) → D12

**Why not read the cache.** `order_audit_status` drifts: the legacy `review` verb writes it with no `audit_submission` (Phase 0 Finding C, probe P3), and under D13-A that drift is only reported. A form that disabled Save on a cached `pending` would lock an order the server accepts, and the operator could not withdraw it (there is no engine attempt to withdraw). Phase 1 also ships before Phase 2. So the notice reads the **engine**, the same source the server guard reads.

- `packages/api/src/routers/collective-order.ts` `get` (`:2471` at HEAD): after the scoped load and NOT_FOUND, read `latestSubmissionByResource(context.db, organizationId, "collective_order", [row.id])` (`modules/audit/shared.ts:332`, returns `{ id, status, flowId }`) and add one derived field to the returned object: `underReview: status === "under_review" || status === "withdrawal_under_review"`. Additive output field; one indexed read per form load. Owned by Agent A (it already owns the router in Phase 1).
- `apps/web/src/components/order-form.tsx`: from the existing `existing` query (`:716`), `const underReview = isEdit && existing.data?.underReview === true`. Render a notice above the form: _"Under review. Withdraw it from the trade ledger's review menu to make changes."_ (reuse the form's existing banner/alert primitive; the implementer greps the file for it). The Save button (`:2699`, today `disabled={saving || (isEdit && !existing.data)}`) gains `|| underReview`, with `title` set to the sentence.
- `apps/web/src/components/order-ledger/order-record-page.tsx`: beside **Edit order** (`:123-125`), the same one-line notice when `underReview`. The link stays enabled (reading the form is harmless).
- The fees page does not change (D2-B).
- **Drifted rows.** A row whose badge says Pending but has no open engine attempt shows no notice and saves normally (the server agrees). Its badge keeps lying until someone acts on the D13-A report; Task 2.4 lists it (P3). What an operator does: nothing different; if they need the order reviewed, **Submit for review** works, because `submitForReview` reads submissions, not the cache.
- Task 1.5 depends on the `get` field, so it runs after Task 1.2's API change is type-checked (A → B for that one field; §6).

### 4.3 The engine is the only approver (Journey 2; Phase 2) → D4, D8, D9

- Delete `collectiveOrderRouter.review` (`:3380-3486`) and `reviewBatch` (`:3487-3578`) with their docblocks. Remove imports that become unused (`canAuditTransition` `:64`, `isAuditorDecision` `:66`, `auditStatusSchema`, `AuditStatus`, `applyReviewBatch` — each only if its last use goes; `bun run check-types` and lint decide).
- `packages/api/src/architecture.test.ts`: remove `:494` (`collectiveOrderRouter.review :: update(collectiveOrder)`) and `:876` (`collectiveOrderRouter.reviewBatch :: applyReviewBatch(collectiveOrder)`) and its comment `:873-875`. The stale-entry rule (`:1128`) fails otherwise.
- `modules/collective-order/permissions.ts:94-98` (D9-A): set `isEndpoint: false` on `[COLLECTIVE_ORDER.review]`, with a comment: _"No oRPC endpoint gates on this node since step 15 deleted collectiveOrder.review/reviewBatch. The audit engine re-checks it at decide time (`modules/audit/decide.ts:50`, `permittedNode(org, entry.reviewNode)`), which does not record an endpoint."_ `registry.sync.test.ts:22` then stops expecting an endpoint for it. Step 08 has the same unplanned failure for `QUOTATION.review` (`modules/quotation/permissions.ts:56-60`); flagged to step 08 to adopt the same line. The node stays: `resources.ts:203` re-checks it at decide time, `roles.ts:191` grants it, `seed.test.ts:275-300` requires the seeded reviewer to hold it.
- `modules/audit/resources.ts` `collective_order` entry: `separationOfDuties: true` (step 08 writes `false`; D8). Step 08's `decide`, `withdraw`, `submit` (nobody-else-can-decide refusal), `queue-filter` and `eligibleOpenSubmissions` code then applies to orders with no further code.
- Comments that describe the verb as live: `order-row-actions.tsx:54-63` (past tense is already right; add "deleted in step 15"), `roles.ts:187-190`, `e2e/fixtures/seed-cli.ts:62`, `e2e/specs/audit.order-queue.spec.ts:24, 166`, `seed.test.ts:283`.

### 4.4 Approval gates something (Journey 3; Phase 3) → D5, D6, D7

**Vocabulary.** `modules/collective-order/gates.ts`: add `{ key: "create_lading", label: "Raise bill of lading" }` and extend the header comment (a deviation from eyun's 14, with the reason). Add the deviation line to `docs/prd/audit-management.md` §"Deviations from eyun, and why".

**Callers (string literals, so `gates.test.ts:67` sees them).**

```ts
// routers/lading.ts, create — after resolveLadingOrder (:1048), before the insert
const linkedOrderId = matchedOrderId(orderMatch);
if (linkedOrderId)
  await assertGateCleared(tx, organizationId, "collective_order", linkedOrderId, "create_lading");

// routers/lading.ts, update — after values.orderId is set (:1596-1601), before the write
if (typeof values.orderId === "string" && values.orderId !== row.orderId)
  await assertGateCleared(context.db, organizationId, "collective_order", values.orderId, "create_lading");

// routers/expense/cost-lines.ts, create — after refuseIfOrderLocked(ord.locked), inside `if (input.orderId)`
await assertGateCleared(context.db, organizationId, "collective_order", input.orderId, "expense_entry");
```

`ambiguous`, `unmatched` and `stale_id` matches link nothing (`matchedOrderId` returns null) and are not gated, as today. Conversion (`quotation.convertToOrder`) and `importFromQuote` insert lines without going through `costLines.create`, so a ticked `expense_entry` does not block conversion.

**Seed (new orgs).** `modules/audit/seed.ts` collective_order entry: `gates: ["lock", "end_order", "shut_out", "create_lading"]` (D5-A), with a comment saying why the content keys are not seeded (step 14 precedes step 15; §Phase 0). `unlock` is not seeded, so an approved-then-locked order can always be released.

**Existing orgs (D6-A).** No code, no migration. The PR description carries the rollout checklist (Journey 4) and probe results; Wilfred ticks per org when ready.

### 4.5 Data model

**No schema change under the recommended options.** D11-B would add `audit_submission.content_hash text` (nullable) plus a `contentHashOf?(tx, resourceId)` hook on `ReviewableResource`, migration placeholder `00NN_audit_submission_content_hash` (number assigned at merge per the runbook).

### 4.6 API contracts (all input shapes unchanged)

Journey steps served: order writers and `get` → Journey 1 steps 2–5; `review`/`reviewBatch`, `auditReview.*` → Journey 2 steps 3–4; `lading.*` → Journey 3 steps 1–4; `costLines.create` → §10 regression check 3 and Task 3.5 (no journey: `expense_entry` is not seeded).

| Procedure | Change | New refusals |
|---|---|---|
| `collectiveOrder.update`, `assignNumber`, `setAbnormalTags` | D17-B: row lock; under-review freeze, added here | CONFLICT under review |
| `collectiveOrder.delete` | row lock; under-review freeze | CONFLICT under review |
| `collectiveOrder.get` | adds output field `underReview: boolean` from the engine's latest submission (D12) | – |
| `collectiveOrder.updateBatch` | post-approval freeze; D17-B: also row lock (id order) and under-review refusal | CONFLICT (count in message) |
| `collectiveOrder.batch` (`delete` only) | row lock; under-review freeze | CONFLICT (count) |
| `collectiveOrder.saveChildren` | row lock; under-review freeze on containers/cargo/appendages only (D2-B); post-approval freeze on the same arrays (D3-A) | CONFLICT |
| `collectiveOrder.review`, `reviewBatch` | **removed** | 404 |
| `auditReview.submit` for `collective_order` | row lock at submit in `exists` (D17-B, added here); step 08's self-decision rules apply | CONFLICT when nobody else can decide (step 08 D2-A) |
| `auditReview.decide*` for `collective_order` | step 08's self-decision rule applies | FORBIDDEN |
| `lading.create` | `create_lading` gate when an order is linked | CONFLICT `"Raise bill of lading" requires review approval first` |
| `lading.update` | same gate when the link changes to another order | CONFLICT |
| `costLines.create` | `expense_entry` gate when `orderId` is set | CONFLICT `"Expense entry" requires review approval first` |

Refusal order a caller sees on an order write: NOT_FOUND → existing input refusals → under review → approved-and-locked → locked → content gates.

### 4.7 Key decisions (all Decided 2026-09-17; §9 keeps the three approaches of each)
- Step 15 owns the order under-review freeze (crosscheck X6) → D17-B
- Fee grid outside the order freeze → D2-B
- `saveChildren` post-approval freeze → D3-A (re-check P13 before Task 1.2)
- Seeded gate set → D5-A (re-check P1 before Task 3.4)
- Existing-org rollout: admins tick per org → D6-A (P2, P5, P11 feed the release note)
- Gate callers → D7-A
- Separation of duties on orders → D8-A (re-check P1, P12 before Task 2.2)
- Freeze every content writer, delete included → D1-A
- Delete the legacy verbs → D4-A (re-check P4 before Task 2.1)
- Registry node after deletion → D9-A
- Row lock → D10-A
- No content hash → D11-A
- UI notice → D12-A
- Residue report only → D13-A
- Submit-time order state deferred and unowned (accepted known gap, X13) → D14-C
- Half-save left to step 14 → D15-C
- `assignNumber` stays frozen after approval → D16-B (re-check P10 before Task 1.2)

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- Steps **08 (Phases 1, 2, 3)**, **10 (Task 1.2)**, **11 (Phase 2, including Task 2.4)** and **12 Phase 1** merged into the base branch (§7.6 gives the reasons). Under D17-B (Decided, X6), step 14 Phase 1 is **not** a prerequisite: step 15 Phase 1 merges first and §4.1 "Operative spec (D17-B)" applies.
- D17-B, D2-B and D3-A are Decided (§9). Re-check before Task 1.2: probe P13 for D3-A; if it contradicts the choice, stop and re-plan.
- Re-locate every anchor in `collective-order.ts`, `resources.ts`, `gates.ts`, `post-approval.ts`, `submit.ts`, `seed.ts`, `architecture.test.ts` and `collective-order.guards.test.ts` **by symbol** at the base commit, including step 12 Task 1.1's `.for("update")` on `assignNumber` (X7).

### Phase 1 — What accounting approves is what ops submitted (finding A)

**Delivers:** Journey 1 end to end.
**Task wording (D17-B, Decided).** §4.1 "Operative spec (D17-B)" governs Tasks 1.2–1.4. Task 1.2 adds the full seven-writer freeze, with `saveChildren` conditional from day one and the `updateBatch` load ordered by id. Task 1.3 adds the `exists` lock unconditionally. Task 1.4 writes every case — `update`, `setAbnormalTags`, `assignNumber`, `updateBatch`, `delete`, `batch` delete and `saveChildren` — in `packages/api/src/routers/collective-order.under-review.test.ts` [NEW]; step 14 adds a `describe` to that same file (X8). Agent A owns it.
**Dependencies:** step 08 Phase 1 (Task 1.2 `resources.ts` lock pattern, Task 1.3 `gates.ts` docblock) and Phase 3 Task 3.1 (`post-approval.ts` optional message arg); step 11 Tasks 2.1/2.4 (line shifts and the `assignNumber` re-stamp loop, already folded into step 11 Task 2.4 per X11); step 12 Task 1.1 (the `assignNumber` row lock, X7). Step 14 Phase 1 merges **after** this phase.

- **1.1** Add `assertNoneUnderReview` to `modules/audit/gates.ts` (step 15 introduces it; step 14 adds no selection helper, D17-B) and `assertPostApprovalEditableMany` to `modules/audit/post-approval.ts` (§4.1), each using one `latestSubmissionByResource` call. Unit cases in `gates.test.ts`: all clear; one under review of three → CONFLICT naming "1 of 3"; `withdrawal_under_review` counts; empty ids → no query. Update the `assertNotUnderReview` docblock callers list. Files: `packages/api/src/modules/audit/gates.ts`, `packages/api/src/modules/audit/post-approval.ts`, `packages/api/src/modules/audit/gates.test.ts`. · **Agent A (backend)**
- **1.2** The full freeze exactly as §4.1 "Operative spec (D17-B)": `assertNotUnderReview` in `update`, `setAbnormalTags`, `assignNumber`, `delete` and (conditional on content arrays, D2-B) `saveChildren`, with the D3-A post-approval call beside the `saveChildren` one; `assertNoneUnderReview` in `updateBatch` and in `batch` when `action === "delete"`; `assertPostApprovalEditableMany` in `updateBatch`. Add the `underReview` output field to `get` (§4.2). Grep each handler body first so no guard or lock is added twice (step 12 Task 1.1 already owns `.for("update")` on `assignNumber`, X7). Correct the `schema/audit.ts:356-360` docblock. Files: `packages/api/src/routers/collective-order.ts`, `packages/db/src/schema/audit.ts` (comment only). · **Agent A (backend)**
- **1.3** Row locks (D10-A, D17-B): `.for("update")` on the scoped loads of `update`, `setAbnormalTags`, `saveChildren`, `delete`, `updateBatch` and `batch` delete (both batch loads `.orderBy(collectiveOrder.id)` first); `assignNumber` already has one from step 12 Task 1.1 (X7) — grep, do not add a second. Add `.for("update")` to `REVIEWABLE_RESOURCES.collective_order.exists` in `resources.ts` **unconditionally** (step 14 adds no lock there under X6/X9). Update the architecture allow-list comment for `delete` only if it describes guards (keys unchanged). Files: `packages/api/src/routers/collective-order.ts`, `packages/api/src/modules/audit/resources.ts`, `packages/api/src/architecture.test.ts` (comments only). · **Agent A (backend)**
- **1.4** Tests in **one** suite: `packages/api/src/routers/collective-order.under-review.test.ts` [NEW], created here (D17-B, X8); step 14 later adds its own `describe` to the same file. Seed submissions by raw insert the way `audit-review.test.ts:1078-1110` does. Cases:
  1. `under_review` → `update`, `setAbnormalTags`, `assignNumber`, `updateBatch`, `delete`, `batch` delete (mixed selection), `saveChildren({containers})`, `saveChildren({cargo})`, `saveChildren({appendages})` each CONFLICT; re-read the order, children and `audit_log` to prove nothing was written.
  2. `under_review` → `saveChildren({costs})` succeeds (D2-B).
  3. `withdrawal_under_review` → `delete` CONFLICT.
  4. `rejected`, `withdrawn`, never submitted → `delete` and `saveChildren({containers})` succeed.
  5. `passed` with `postApprovalEditable: false` → `saveChildren({containers})` and `updateBatch` CONFLICT with the approved message; `saveChildren({costs})` succeeds.
  6. Foreign-scope id → `delete` NOT_FOUND before CONFLICT.
  7. `get` returns `underReview: true` under `under_review`, `false` when never submitted, and `false` for an order whose cache says `pending` but has no submission (the drift case, D12).

  **No PGlite lock test.** PGlite is a single connection, and drizzle's pglite session runs `db.transaction` through `client.transaction` (`node_modules/drizzle-orm/pglite/session.js:114-126`). Any second query waits for the open transaction whether or not `FOR UPDATE` was taken, so such a test would also pass on the old code.

  **Real-Postgres concurrency test:** `packages/api/src/routers/collective-order.concurrency.test.ts` [NEW], modelled on `routers/expense.concurrency.test.ts` (`describe.skipIf(!TEST_URL)` at `:65`, `createDbClient(TEST_URL)` at `:71`, per-run org ids). This plan creates that file (X8); step 14 adds a `describe` to it later, and each PR pastes real-Postgres output because CI has no `DATABASE_URL_TEST`. The interleave is deterministic and runs twice: once for `update` and once for `delete` (both locks are this plan's, D17-B). Connection A opens a transaction and loads the order `FOR UPDATE`. Start the writer on connection B through `call(collectiveOrderRouter.<writer>, …)` without awaiting it. On A, insert the submission the way `submitForReview` does, or call `submitForReview` with A's tx. Commit A, then await B → CONFLICT with the under-review sentence, with the order row and children unchanged. Before merging, run it once against the router without the lock and record that it fails there. Run with `DATABASE_URL_TEST` pointing at the dev Neon branch, never production.

  Re-run `collective-order.costs.test.ts`, `collective-order.numbering.test.ts`, `collective-order.abnormal-tags.test.ts` and `audit-review.test.ts`. Files: `packages/api/src/routers/collective-order.under-review.test.ts` [NEW], `packages/api/src/routers/collective-order.concurrency.test.ts` [NEW]. · **Agent A (backend)**
- **1.5** Web notice, and Save disabled from `existing.data.underReview` (§4.2, D12-A). Files: `apps/web/src/components/order-form.tsx`, `apps/web/src/components/order-ledger/order-record-page.tsx`. · **Agent B (frontend)**

**Acceptance.**
- The submitter (seed actor `managerA`, §10) can submit, see the notice and a disabled Save, withdraw from the row menu, edit, save and resubmit, all in the browser (§10 Journey 1).
- A direct `collectiveOrder.delete` on a Pending order returns 409 and changes nothing; the fees page still saves a fee on it.
- `collective-order.under-review.test.ts` and the four suites above pass, judged by reading the output for `failed`. `collective-order.concurrency.test.ts` passes on the dev branch with `DATABASE_URL_TEST` set (the output names its tests, so it was not skipped), and it was seen failing without the lock.

### Phase 2 — Only the queue approves, and not by the submitter (finding C)

**Delivers:** Journey 2 end to end.
**Dependencies:** Phase 1 merged (hands off `collective-order.ts`, `resources.ts`, `collective-order.guards.test.ts`). Step 08 Phase 2 (`separationOfDuties` exists). D4-A, D8-A, D9-A (all Decided). Re-check before Task 2.1: probe P4 (legacy-verb usage); re-check before Task 2.2: probes P1 and P12 (who reviews, who submits); if either contradicts the choice, stop and re-plan. Step 08 Task 3.3 is **not** a source for D9, because it plans no registry change.

- **2.1** Delete `review` and `reviewBatch` and their now-unused imports. Remove allow-list entries `:494` and `:876` (with its comment). Apply D9-A to `permissions.ts:94-98`: drop `isEndpoint: true` on `[COLLECTIVE_ORDER.review]`, as `[COLLECTIVE_ORDER.lifecycle]` already does at `:99-105`, and add the comment from §4.3. Refresh the comments listed in §4.3. Grep `packages`, `apps`, `e2e` and `seed` for `collectiveOrderRouter.review`, `collectiveOrder/review` and `collectiveOrder.reviewBatch`, and confirm only tests and comments remain before 2.3. Files: `packages/api/src/routers/collective-order.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/modules/collective-order/permissions.ts`, `packages/api/src/roles.ts` (comment only), `apps/web/src/components/order-ledger/order-row-actions.tsx` (comment only), `e2e/fixtures/seed-cli.ts` (comment only), `e2e/specs/audit.order-queue.spec.ts` (comments only), `packages/api/src/modules/audit/seed.test.ts` (comment only). · **Agent C (backend)**
- **2.2** Set `separationOfDuties: true` on `REVIEWABLE_RESOURCES.collective_order` (D8-A). Files: `packages/api/src/modules/audit/resources.ts`. · **Agent C (backend)**
- **2.3** Tests:
  - `collective-order.guards.test.ts`: delete the suites at `:741-754` and `:756-811`, and the legacy-verb cases in `:474-599`. Keep "masks the row it returns" only if a surviving procedure still needs it. Re-seed the J3 Submit/Approve staff filter test (`:480`) through `submitForReview` + `decide` (or a raw submission + `repaintCache`), so the filter keeps coverage.
  - `audit-review.test.ts`, new `describe("orders: separation of duties")`: add a member who holds ops and is named on the order stage. They submit `co-sep`, then decide → FORBIDDEN, and no `audit_decision` row is written. An accountant decides → `passed`. The submitter's `pendingSummary` excludes it.
  - D9 pin: `permissions/registry.sync.test.ts` passes with `collectiveOrder.review` absent from `endpointKeysInCode()`. Add one case in `audit-review.test.ts`: a member **without** `collectiveOrder.review` who sits on the order stage gets FORBIDDEN `Missing permission: collectiveOrder.review` from `decide` (`decide.ts:50-51`). This shows the node still guards something after its endpoints are gone.
  - Regression: `audit-review.test.ts:831` (`submit("u-ops", "collective_order", "co-sep")`) and the order-gate cases (`:1078+`) still pass.
  - Run `permissions/registry.sync.test.ts`, `permissions/reachability.test.ts`, `modules/audit/seed.test.ts`, `collective-order.seeded-roles.test.ts` and both architecture tests.

  Files: `packages/api/src/routers/collective-order.guards.test.ts`, `packages/api/src/routers/audit-review.test.ts`. · **Agent C (backend)**
- **2.4** Residue report (D13-A): `packages/db/scripts/audit-order-review-drift-2026-09.sql` [NEW], containing probes P3, P4, P8 and P9 from §7 as counts plus row lists. Run it read-only on the dev branch and paste the counts in the PR; production needs the owner's override (`apps/server/dev-db-guard.ts`). Files: `packages/db/scripts/audit-order-review-drift-2026-09.sql` [NEW]. · **Agent C (backend)**

**Acceptance.**
- `/rpc/collectiveOrder/review` → 404.
- A submitter on the order stage cannot approve their own order and does not see it queued; the accountant approves it (§10 Journey 2).
- `registry.sync.test.ts`, both architecture tests, `seed.test.ts`, `audit-review.test.ts` and `collective-order.guards.test.ts` pass. The dev drift counts are in the PR.

### Phase 3 — An unapproved order cannot get a bill of lading (finding B)

**Delivers:** Journey 3 end to end, and Journey 4's checkbox.
**Dependencies:** Phase 2 merged. Step 10 Task 1.2 merged (`seed.ts` `SEEDED_FLOWS`, `AUDIT_TRIGGER_TYPES`), and step 14 Phase 1 merged before Phase 3 for `seed/operations.ts` (X12). D5-A, D6-A, D7-A (all Decided). Re-check before Task 3.4: probe P1 (ticked gates per org); if it contradicts D5-A, stop and re-plan. Probes P1, P2, P5, P11 feed the release note (not the code).

- **3.1** Declare `create_lading` (§4.4) and add the PRD deviation line. Files: `packages/api/src/modules/collective-order/gates.ts`, `docs/prd/audit-management.md`. · **Agent D (backend)**
- **3.2** `lading.create` and `lading.update` gate calls (§4.4). Files: `packages/api/src/routers/lading.ts`. · **Agent D (backend)**
- **3.3** `costLines.create` `expense_entry` call (§4.4, D7-A). Files: `packages/api/src/routers/expense/cost-lines.ts`. · **Agent D (backend)**
- **3.4** Seeded gates (D5-A), with the comment. Files: `packages/api/src/modules/audit/seed.ts`. · **Agent D (backend)**
- **3.5** Tests:
  - `audit-review.test.ts`, under "the Order trigger's newest gates": tick `create_lading`. `lading.create` with the `orderId` of a never-submitted order → CONFLICT and zero `lading` rows; with an `orderNo` matching it → CONFLICT; unlinked (no `orderId`, no `orderNo`) → created; after `decideAs("u-acct1")` approves → created and linked; rejected order → CONFLICT; `lading.update` setting that `orderNo` on an unlinked B/L → CONFLICT with `order_id` unchanged; a flow with the key unticked → all succeed.
  - `audit-review.test.ts`, same describe: `costLines.create` with an `orderId` under a ticked `expense_entry` → CONFLICT; without `orderId` → created. **With `expense_entry` ticked on the org's order flow, `call(quotationsRouter.convertToOrder, …)` on a Won quotation succeeds, and the new order carries its cost lines** (conversion is not gated). The fixture copies `quotation.convert.test.ts`'s setup; that file is re-run unchanged.
  - `seed.test.ts`: a new org's order flow has exactly the four keys, and `gates.test.ts` (`:67`, `:81`, `:91`) passes.
  - Re-run `audit-flow.test.ts` (its orgs are seeded through `seedAuditFlows`), `lading.test.ts`, `modules/lading/resolve-order.test.ts`, `export.test.ts`, `expense.self-bridge.test.ts` and `quotation.convert.test.ts`.

  Files: `packages/api/src/routers/audit-review.test.ts`, `packages/api/src/modules/audit/seed.test.ts`. · **Agent D (backend)**
- **3.6** E2E: run `e2e/specs/lading.golden-path.spec.ts`, `audit.order-queue.spec.ts`, `audit.review-queue.spec.ts`, `audit.withdraw.spec.ts`, `audit.post-approval.spec.ts` and `audit.flow-editor.spec.ts` against a freshly seeded org (the seed now ticks four order gates). Fix any spec that links a B/L to an unapproved order by approving the order first in its setup, never by unticking the gate. Files: the failing specs under `e2e/specs/` only. · **Agent E (test)**
- **3.7** Operations seeder. `seed/run-operations.ts:6-12` documents the order `create -> children -> accept/reject -> ladings -> submit`. `ensureLadings` (`seed/operations.ts:432`, called at `run-operations.ts:81`) sends `orderId` + `orderNo` on even rows (`operations.ts:449-458`) before any order is submitted. In an org created after Phase 3, whose flow is seeded with `create_lading`, that `lading/create` is refused and the run stops. Change `ensureLadings` to create every lading **unlinked** when the org's Order flow ticks `create_lading`. Read the flow the way `seed/flows.ts:58` `flowState` does, extended to return gate keys. Print one line saying links wait for approval, and leave linking to a later approval pass. Update the ordering docblock. Files: `seed/operations.ts`, `seed/run-operations.ts`, `seed/flows.ts`. · **Agent E (test)**

**Acceptance.**
- In a freshly seeded org, `/lading/create` with an unapproved order picked in **Linked order** is refused with the gate sentence; after approval it creates and links (§10 Journey 3).
- Approval Process Setting shows **Raise bill of lading** (Journey 4 step 1).
- The tests above and the e2e specs pass.
- The operations seeder (`bun --preload ./apps/server/cf-shim.mjs seed/cli.ts operations --write`, `seed/cli.ts:359`, targeting the org the seeder is configured for) completes against an org **created after Phase 3** on the dev branch, never production, with no FAILED line. `tsc -p seed/tsconfig.json` (part of `bun run check-types`) passes.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.4 | `packages/api/src/modules/audit/gates.ts`, `packages/api/src/modules/audit/post-approval.ts`, `packages/api/src/modules/audit/gates.test.ts`, `packages/api/src/routers/collective-order.ts`, `packages/api/src/modules/audit/resources.ts` (conditional), `packages/db/src/schema/audit.ts` (comment), `packages/api/src/architecture.test.ts` (comments), `packages/api/src/routers/collective-order.under-review.test.ts` [NEW], `packages/api/src/routers/collective-order.concurrency.test.ts` [NEW] | `packages/api/src/modules/audit/shared.ts`, `packages/api/src/modules/audit/submit.ts`, `packages/api/src/routers/audit-review.test.ts`, `packages/api/src/routers/expense.concurrency.test.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.5 | `apps/web/src/components/order-form.tsx`, `apps/web/src/components/order-ledger/order-record-page.tsx` | `apps/web/src/components/review-menu.tsx`, `apps/web/src/lib/audit-review.ts` |

opus / high for A: deltas and a lock test on a 4,871-line router that four other plans also edit (11, 12, 13, 14), plus shared engine helpers.
Run mode: **A (Task 1.2's `get` field) → B**, then A's remaining work ∥ B. Contract: `collectiveOrder.get` output gains `underReview: boolean`; B starts once `bun run check-types` sees it.
Serialization point: after both, `bun run check-types` (read the output), then `bunx vp test run` on the Phase 1 suites.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | opus | high | 2.1–2.4 | `packages/api/src/routers/collective-order.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/modules/collective-order/permissions.ts`, `packages/api/src/modules/audit/resources.ts`, `packages/api/src/roles.ts` (comment), `packages/api/src/modules/audit/seed.test.ts` (comment), `apps/web/src/components/order-ledger/order-row-actions.tsx` (comment), `e2e/fixtures/seed-cli.ts` (comment), `e2e/specs/audit.order-queue.spec.ts` (comments), `packages/api/src/routers/collective-order.guards.test.ts`, `packages/api/src/routers/audit-review.test.ts`, `packages/db/scripts/audit-order-review-drift-2026-09.sql` [NEW] | `packages/api/src/permissions/registry.ts`, `packages/api/src/procedures/org.ts`, `packages/api/src/modules/audit/decide.ts`, `packages/api/src/modules/audit/queue-filter.ts` |

opus for C: deletes live procedures under a stale-entry allow-list and a permission-registry sync guard, and switches self-decision on for a shared engine resource.
Run mode: single agent.
Handoffs: `collective-order.ts`, `resources.ts`, `architecture.test.ts`: Agent A (Phase 1) → Agent C (Phase 2). `collective-order.guards.test.ts` is Phase 2's alone (Agent C); Phase 1's cases live in `collective-order.under-review.test.ts` [NEW].

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent D (backend) | backend-engineer | opus | high | 3.1–3.5 | `packages/api/src/modules/collective-order/gates.ts`, `docs/prd/audit-management.md`, `packages/api/src/routers/lading.ts`, `packages/api/src/routers/expense/cost-lines.ts`, `packages/api/src/modules/audit/seed.ts`, `packages/api/src/routers/audit-review.test.ts`, `packages/api/src/modules/audit/seed.test.ts` | `packages/api/src/modules/lading/resolve-order.ts`, `packages/api/src/modules/audit/gates.test.ts`, `packages/api/src/modules/audit/flow-admin.ts`, `packages/api/src/routers/quotation.convert.test.ts` |
| Agent E (test) | test-engineer | sonnet | medium | 3.6, 3.7 | failing specs under `e2e/specs/` only; `seed/operations.ts`, `seed/run-operations.ts`, `seed/flows.ts` | `e2e/fixtures/seed-cli.ts`, `e2e/fixtures/flow.ts`, `seed/rpc.ts` |

opus for D: changes the default behaviour of every new org and adds refusals to the B/L and fee-ledger write paths that other steps own.
Run mode: **D → E**. E waits on 3.4's seed change, because the specs and the operations seeder run against orgs seeded through `seedAuditFlows`.
Handoffs: `audit-review.test.ts`: Agent C (Phase 2) → Agent D (Phase 3). `seed.test.ts`: Agent C (comment) → Agent D.

**Schedule:** Phase 1 → Phase 2 → Phase 3, strictly sequential (shared `collective-order.ts`, `resources.ts`, `audit-review.test.ts`, `collective-order.guards.test.ts`).
**Serialization points:** after each phase, run `bun run check-types` and grep the output for `error TS` and `failed` (the command can exit 0 while printing "failed"). Then run both architecture tests, and restart `:3000` before any browser check (`bun --hot` does not reload `packages/api`).
**Commits:** the worktree may be shared. One committer at a time; confirm the index is empty before `git add`, and read every hunk.

**Smell test.**
- [x] Every task has exactly one owner.
- [x] No file is owned twice within a phase.
- [x] The A → B contract is named (`get.underReview`); otherwise their files are disjoint.
- [x] Every opus is justified; no haiku.
- [x] D → E names its artifact (the seeded gate set).
- [x] Each phase completes a journey (1, 2, 3).

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`, re-run 2026-09-17 in the self-review pass)

- **Order writers under the freeze** (D17-B Decided: this plan adds all seven). Web callers: `order-form.tsx:1644` (`update`), `:1733` (`saveChildren`), `:1762` (`setAbnormalTags`); `order.$orderId.expenses.tsx:598` (`saveChildren`, costs only — unaffected under D2-B); `assign-job-number-button.tsx:159` (`assignNumber`). `updateBatch`, `delete`, `batch`, `transition` have **no** web caller. Tests: the `collective-order.*.test.ts` suites listed in 1.4. `collectiveOrder.get` gains one output field (`underReview`). Its web readers are `order-form.tsx:716`, `order-ledger/order-record-page.tsx:34`, `routes/_next/lading/$id/index.tsx:133` and `routes/_next/order.$orderId.expenses.tsx:460`, and all of them ignore unknown fields. The ledger reads `list`, not `get`.
- **`assertNotUnderReview`.** Existing callers `company.ts:1343`, `lading.ts:1474, 1513`, `quotation.ts:980` (+ step 08's three). Signature unchanged.
- **`assertPostApprovalEditable`.** Unchanged; the new `…Many` form is additive.
- **`REVIEWABLE_RESOURCES.collective_order.exists`.** Only caller `submit.ts:39`. Under D17-B (Decided), step 15 adds the row lock here unconditionally (§4.1 "Operative spec", Task 1.3). It changes no return shape.
- **`collectiveOrder.review` / `reviewBatch`.** No web or e2e caller. They appear in `architecture.test.ts:494, 876` and in the tests `collective-order.guards.test.ts:476, 746, 749, 758, 760` (audit-log assertions at `:544, 592, 774`). Comments name them in §4.3's list, plus `apps/web/src/architecture.test.ts:788`, `routers/expense/bills.ts:1190`, `e2e/specs/audit.order-queue.spec.ts:183` and `seed/run-operations.ts:99`. All of these are past-tense or neutral, so they need no edit beyond §4.3's list. **External RPC scripts calling them would 404; none found in the repo.**
- **`COLLECTIVE_ORDER.review` node.** Referenced at `permissions.ts:22, 94-98`, `resources.ts:203`, `roles.ts:191`, `collective-order.guards.test.ts:76, 174`, and `seed/assign.ts:38, 48` (node → `/approve/order` queue map). The node stays, so none of these change.
- **`defineGates("collective_order")`.** Read by `flow-admin.ts:116` (the editor vocabulary) and `gates.test.ts`. A new key appears in every org's editor unticked.
- **`lading.create` / `lading.update`.** Web `routes/_next/lading/create.tsx:353` (toasts `err.message` at `:370`); the B/L edit page (step 16/17 area). Tests `lading.test.ts`.
- **`costLines.create`.** Web `routes/_next/expenses/cost-lines.tsx:385`. Refusal applies only when an `orderId` is sent and the org ticked `expense_entry`.
- **`seedAuditFlows`.** Production `routers/org.ts:132`; e2e `e2e/fixtures/seed-cli.ts:101, 196`; tests `modules/audit/seed.test.ts:38, 186, 223`, `routers/audit-flow.test.ts:100, 102`, `routers/audit-review.test.ts:203, 205`. Every e2e org and every new production org gets the four gates. The test orgs do too, so Task 3.5 re-runs `audit-flow.test.ts` as well.

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| Submit → edit order | `auditReview.submit` 200 → `update` 200 | `update` 409 (from step 14 Phase 1); Save disabled (this plan) | API first (required, §7.5): 409 toast until web lands, correct but unexplained. Web first: field missing, notice hidden, harmless. |
| Submit → delete order (RPC) | 200, orphan submission | 409 | API-only; no web caller |
| Submit → add fee on fees page | 200 | 200 (D2-B) | – |
| Approve → edit containers on fees/edit page | `update` 409 but `saveChildren({containers})` 200 | both 409 (D3-A) | API-only |
| Legacy self-approval | `collectiveOrder.review` 200 ×2 | 404 | API-only; no web caller |
| B/L on unapproved order (gated org) | 200 | 409 | API-only; the create page already toasts errors |
| New org | order flow with no gates | four gates ticked | API-only |

### 7.3 Behaviour change for existing orgs and live orders

- **Phases 1 and 2 change every org immediately**, because they do not depend on gates:
  - Orders currently `under_review` (P2) become read-only until decided or withdrawn. Operators mid-edit on such an order hit 409 on Save.
  - `saveChildren` content arrays on approved orders under a non-editable flow start refusing (D3-A). P13 sizes how often that happens today.
  - Any member relying on the legacy verb loses it (P4 sizes use).
  - Order submitters sitting on their own stage lose self-decision; a flow whose only reviewer is the submitter refuses submit (step 08 D2-A). P1 + P12 size it.
- **Phase 3 changes new orgs only** (D6-A). An existing org changes only when an admin ticks the boxes. At that moment, with strict gate semantics (`gates.ts:92`), **every order not approved — including never-submitted live orders — refuses lock, end, shut-out and new B/L links**. P2 and P11 give the size of that backlog; P5 shows how many B/Ls already sit on unapproved orders (they are not touched: the gate runs only on create and re-link).
- **Mid-flight e2e/QA orgs** created before the change keep no gates (seed skips existing flows).

### 7.4 Nullable assumptions

- `lading.order_id` is nullable (`schema/lading.ts:162`, ON DELETE set null); an unlinked B/L is never gated.
- `collective_order.order_audit_status` is NOT NULL DEFAULT 'draft' (`schema/collective-order.ts:337-340`); neither the server guards nor the new notice read it (the notice reads `get.underReview`, derived from `audit_submission`, §4.2), so a drifted cache cannot disable Save.
- `audit_submission.resource_id` has no FK; orphans are possible and reported (P8).
- `collective_order.job_number` may be null; `resolveLadingOrder` then cannot match by number, so only an explicit id is gated.

### 7.5 Deployment coupling

- Each phase deploys on its own. Phase 1: API before web, because the web reads the new `get.underReview` field (a web-first deploy reads `undefined`, so the notice stays hidden and Save enabled — harmless, the server still refuses). Phases 2 and 3 are API-only except comments; Phase 3 also changes the operations seeder (`seed/`), which is not deployed.
- Build `apps/web` before deploy so a partial deploy does not split server and web (memory `alchemy-partial-deploy-splits-the-stage`); no phase breaks under that split.

### 7.6 Merge order against steps 04–14

| Plan / task | Shared code | Why step 15 goes after |
|---|---|---|
| **08 Task 1.2** | `resources.ts` (`quotation.exists` `FOR UPDATE`) | Step 15 Task 1.3 edits the `collective_order` entry beside it and copies the pattern. |
| **08 Task 1.3** | `gates.ts:103-129` docblock | Task 1.1 appends orders to the rewritten text. |
| **08 Tasks 2.1–2.7** | `resources.ts` `separationOfDuties`, `decide.ts`, `withdraw.ts`, `submit.ts`, `shared.ts` `eligibleReviewerCount`, `queue-filter.ts`, `audit-review.ts` | Task 2.2 flips a flag that does not exist until 2.1. **Must merge first.** |
| **08 Tasks 3.1–3.3** | `post-approval.ts` optional message; `submit.ts` re-submit refusal; `architecture.test.ts` | Task 1.1's `…Many` helper mirrors 3.1's signature. **Must merge first.** Step 08 plans no registry change for `QUOTATION.review` (Phase 0 Finding C); D9-A here is the proposed shared resolution, flagged to step 08. |
| **08 Task 3.5** | `packages/db/scripts/` (created there) | Task 2.4 adds a sibling script. |
| **10 Task 1.2** | `resources.ts` (`onPassed?`), `decide.ts`, `submit.ts`, `seed.ts` (new flow), `schema/audit.ts` `AUDIT_TRIGGER_TYPES` | Tasks 1.3, 2.2, 3.4 edit the same files. **Must merge first.** |
| 10 Task 1.1 | migration `0074` | None here unless D11-B. |
| **11 Task 2.1** | `collective-order.ts:2288-2418` moves to `modules/collective-order/insert-order.ts` [NEW in that plan]; `architecture.test.ts:488` re-keyed | ~130-line shift in the file every step-15 task edits. **Must merge first.** |
| **11 Task 2.4** | `assignNumber` re-stamps unbilled cost lines; new allow-list entry | Task 1.2 puts the freeze before that loop. **Must merge first.** |
| 11 Phase 1 / Phase 3 | `quotation.ts`, `bridge.ts` | No shared function. A converted order starts `draft` and needs step 15's submit. |
| 04, 05–07, 09 | `quotation.ts`, `$quotationId.tsx` | No overlap beyond `architecture.test.ts` comments. |
| **14 Phase 1** (`step-14-job-shape.md` Task 1.2 `readinessProblem?`, a plain read under its D5-C; D5-A alternative) | `resources.ts` `collective_order` entry; `collective-order.ts` order writers; `collective-order.under-review.test.ts` (step 14 re-runs it) | **D17-B Decided (X6): step 15 Phase 1 merges first** (15 P1 → 14 P1). Step 14 adds no guard and no lock; it adds a `describe` to `collective-order.under-review.test.ts` (X8) and reuses step 07's `assertPublishable` hook (X9). Step 14 Phase 1 then merges **before step 15 Phase 3**, because both touch `seed/operations.ts` (X12). |
| 14 Phases 2–3 | `order-form.tsx` (readiness panel, status select), `collective-order.ts` `status` validation | Different lines from Task 1.5's notice and `get` field. Either order; the second rebases. Step 14 keeps D15 (half-save). |
| 12 (`step-12-job-number.md`) | `assignNumber` body (Tasks 1.1–1.2), `update` (Phase 3) | 12 Phase 1 before 15 (its §7 row). **12's D5-A says step 15 owns `assertNotUnderReview` on `assignNumber`.** That matches D17-B, and step 12 Task 1.1 owns the row lock there (X7). 12 D3-B's `0076_` placeholder becomes `00NN_`, numbered at merge (X14). |
| 13 (`step-13-intake-decisions.md`) | `receive`/`reject`/new `reopen` in `collective-order.ts`, allow-list beside `:495-496` | Different handlers; either order. 13 does **not** take submit-time order-state checks (D14). |
| 16–17 (no plans yet) | `lading.ts` `create`/`update` | Their plans must keep the Task 3.2 gate calls. |

**Required order (D17-B Decided, per X6):** 08 (Phases 1–3) → 10 (Task 1.2) → 11 (Phase 2, incl. 2.4) → 12 Phase 1 → **15 Phase 1** → 14 Phase 1 → **15 Phase 2 → 15 Phase 3**, one phase per worktree, sequentially. 14 Phase 1 sits before 15 Phase 3 because of `seed/operations.ts` (X12); 15 Phase 2 may merge before or after it (no shared file). Per X16, the uncommitted `e2e/` changes in `nct-layout` must be committed or set aside by Wilfred before Wave 6.

### 7.7 Read-only production probes (SELECT only; Wilfred runs with the owner's override; none blocks Phase 1 code)

```sql
-- P1 Order flow per org: enabled, post-approval lock, ticked gates, stage reviewers (D5, D6, D8)
select f.organization_id, f.id as flow_id, f.enabled, f.post_approval_editable, f.withdrawal_mode,
       (select string_agg(g.gate_key, ',' order by g.gate_key) from audit_flow_gate g where g.flow_id = f.id) as gates,
       (select string_agg(distinct coalesce(r.name, 'member:' || fr.member_id), ',')
          from audit_flow_stage s join audit_flow_reviewer fr on fr.stage_id = s.id
          left join role r on r.id = fr.role_id where s.flow_id = f.id) as reviewers
from audit_flow f where f.trigger_type = 'collective_order'
order by f.organization_id;

-- P2 Live orders by latest submission (what Phase 1 freezes now, what gate-ticking freezes later)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'collective_order'
  order by resource_id, submitted_at desc, created_at desc)
select co.organization_id, coalesce(l.status, 'never_submitted') as latest, co.process, co.locked, count(*) as orders
from collective_order co left join latest l on l.resource_id = co.id
where co.archived = false
group by 1, 2, 3, 4 order by 1, 2, 3, 4;

-- P3 Cache drift: order_audit_status disagrees with the latest submission (legacy-verb residue, D13)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'collective_order'
  order by resource_id, submitted_at desc, created_at desc)
select co.organization_id, co.order_audit_status, coalesce(l.status, 'none') as latest, count(*)
from collective_order co left join latest l on l.resource_id = co.id
where co.order_audit_status <> case l.status
        when 'under_review' then 'pending' when 'passed' then 'approved'
        when 'rejected' then 'rejected' when 'withdrawal_under_review' then 'withdraw_pending'
        when 'withdrawn' then 'withdrawn' else 'draft' end
group by 1, 2, 3 order by 1, 2, 3;

-- P4 Legacy verb usage, and self-approval through the single-order verb (D4, D13)
select organization_id, action, count(*) as calls, min(created_at), max(created_at)
from audit_log where action in ('collectiveOrder.review', 'collectiveOrder.reviewBatch')
group by 1, 2;
select a.organization_id, a.target_id, a.actor_user_id, a.created_at
from audit_log a
where a.action = 'collectiveOrder.review' and a.after_json like '%"orderAuditStatus":"approved"%'
  and exists (select 1 from audit_log b where b.action = 'collectiveOrder.review'
              and b.target_id = a.target_id and b.actor_user_id = a.actor_user_id
              and b.after_json like '%"orderAuditStatus":"pending"%' and b.created_at < a.created_at);
-- reviewBatch rows carry a comma-joined target_id and an `ids` array in after_json; count them separately.

-- P5 Bills of lading linked to orders that are not approved (D6 sizing; not repaired)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'collective_order'
  order by resource_id, submitted_at desc, created_at desc)
select la.organization_id, coalesce(l.status, 'never_submitted') as order_latest, la.status as lading_status, count(*)
from lading la join collective_order co on co.id = la.order_id
left join latest l on l.resource_id = co.id
where coalesce(l.status, 'none') <> 'passed'
group by 1, 2, 3 order by 1, 2, 3;

-- P6 Fees booked / billed on orders that are not approved (D2, D5 expense_entry sizing)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'collective_order'
  order by resource_id, submitted_at desc, created_at desc)
select co.organization_id, coalesce(l.status, 'never_submitted') as order_latest,
       count(cl.id) as cost_lines, count(cl.bill_id) as billed_lines, count(distinct co.id) as orders
from cost_line cl join collective_order co on co.id = cl.order_id
left join latest l on l.resource_id = co.id
where coalesce(l.status, 'none') <> 'passed'
group by 1, 2 order by 1, 2;

-- P7 Edits that landed while an order was under review (finding A exercised)
select s.organization_id, a.action, count(*) as edits, count(distinct s.resource_id) as orders
from audit_submission s
join audit_log a on a.target_id = s.resource_id
 and a.action in ('collectiveOrder.update', 'collectiveOrder.saveChildren', 'collectiveOrder.assignNumber',
                  'collectiveOrder.setAbnormalTags', 'collectiveOrder.delete')
 and a.created_at > s.submitted_at
 and a.created_at < coalesce(s.resolved_at, now())
where s.resource_type = 'collective_order'
group by 1, 2 order by 1, 2;
-- updateBatch logs action 'collectiveOrder.batch.update' and batch delete 'collectiveOrder.batch.delete',
-- both with a comma-joined target_id: repeat with a.target_id like '%' || s.resource_id || '%'.

-- P8 Orphan submissions for deleted orders (D13)
select s.organization_id, s.status, count(*)
from audit_submission s left join collective_order co on co.id = s.resource_id
where s.resource_type = 'collective_order' and co.id is null
group by 1, 2;

-- P9 Engine self-decision on orders (D8)
select s.organization_id, count(*) as self_decisions
from audit_submission s
join audit_stage_instance i on i.submission_id = s.id
join audit_decision d on d.stage_instance_id = i.id
where s.resource_type = 'collective_order' and d.reviewer_id = s.submitted_by
group by 1;

-- P10 Approved orders with no job number under a locked flow (D16)
with latest as (
  select distinct on (resource_id) resource_id, status, flow_id
  from audit_submission where resource_type = 'collective_order'
  order by resource_id, submitted_at desc, created_at desc)
select co.organization_id, count(*)
from collective_order co join latest l on l.resource_id = co.id and l.status = 'passed'
join audit_flow f on f.id = l.flow_id and f.post_approval_editable = false
where co.job_number is null or btrim(co.job_number) = ''
group by 1;

-- P11 Orders locked, ended or shut out without an approval (D6 backlog)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'collective_order'
  order by resource_id, submitted_at desc, created_at desc)
select co.organization_id, co.locked, co.process, coalesce(l.status, 'never_submitted') as latest, count(*)
from collective_order co left join latest l on l.resource_id = co.id
where (co.locked or co.process in ('finished', 'shut_out')) and coalesce(l.status, 'none') <> 'passed'
group by 1, 2, 3, 4 order by 1, 2, 3, 4;

-- P12 Who submits orders, by role (D8: does a submitting role sit on the stage?)
select s.organization_id, m.role, count(*)
from audit_submission s join member m on m.id = s.submitted_by
where s.resource_type = 'collective_order'
group by 1, 2 order by 1, 2;

-- P13 Child edits after approval under a locked flow (D3: would the saveChildren freeze bite?)
select s.organization_id, count(*) as child_saves_after_approval, count(distinct s.resource_id) as orders
from audit_submission s
join audit_flow f on f.id = s.flow_id and f.post_approval_editable = false
join audit_log a on a.target_id = s.resource_id and a.action = 'collectiveOrder.saveChildren'
 and a.created_at > s.resolved_at
where s.resource_type = 'collective_order' and s.status = 'passed'
  and not exists (select 1 from audit_submission n where n.resource_id = s.resource_id
                  and n.resource_type = s.resource_type and n.submitted_at > s.submitted_at
                  and n.submitted_at < a.created_at)
group by 1;
-- The audit row does not say which arrays were sent; inspect before_json/after_json of a sample
-- to tell fee-only saves (unaffected under D2-B) from container/cargo saves.
```

**What each probe decides.** P1 → D5, D6, D8. P2, P11 → D6 backlog size. P3, P4, P8, P9 → D13 (and D4 urgency). P5, P6 → D6 and D2. P7 → how much finding A has already happened. P10 → D16. P12 → D8. P13 → D3.

### 7.8 Blocking prerequisites

- Steps 08, 10 (Task 1.2), 11 (Phase 2) and 12 Phase 1 merged — blocks all tasks. Step 14 Phase 1 merges **after** step 15 Phase 1 and **before** step 15 Phase 3 (X6, X12).
- Every decision is Decided (2026-09-17). Step 14 D5 and step 12 D5 record the same owner (X6, X7); those edits belong to their own plans.
- `DATABASE_URL_TEST` for a dev Neon branch available to Agent A — blocks Phase 1 acceptance (concurrency test).
- Probe re-checks (the choice stands; a contradiction stops the work for a re-plan): P13 and P6 and P10 before Task 1.2 (D3-A, D2-B, D16-B); P4 before Task 2.1 (D4-A); P1 and P12 before Task 2.2 (D8-A); P1 before Task 3.4 (D5-A); P2, P5, P11 plus operations input before the Phase 3 release note (D6-A).
- No probe blocks writing code; each blocks the task it is named against.

## 8. Cross-Cutting Concerns

- **Errors.** State refusals are `ORPCError("CONFLICT")` with operator sentences that say what to do (withdraw first; get the order approved). Self-decision is FORBIDDEN (step 08). Every guard sits after the scoped load, so a foreign id answers NOT_FOUND first (`gates.ts:59-62` house rule). The edit form and B/L create page already toast `error.message`.
- **Testing.** PGlite router suites at the API boundary (1.1, 1.4, 2.3, 3.5); `gates.test.ts` registry sync; `registry.sync.test.ts`; both architecture tests; `seed.test.ts`; e2e audit and lading specs (3.6); the operations seeder run (3.7); browser proof in §10. The row lock is proven only by `collective-order.concurrency.test.ts` [NEW] on real Postgres (dev branch, `DATABASE_URL_TEST`), never by PGlite, which serializes every transaction on its single connection.
- **Migration.** None under the recommended options. D11-B would add `00NN_audit_submission_content_hash` (number assigned at merge per the runbook).
- **Rollback.**
  - Phases 1 and 2 are plain reverts. No phase writes data. Phase 2's deletion reverts cleanly (no data depends on the verbs); revert D9's `isEndpoint` line with it.
  - **Phase 3 is not a plain revert.** Every org created while Phase 3 was live has an `audit_flow_gate` row with `gate_key = 'create_lading'`, and any admin may have ticked it elsewhere. If the vocabulary entry is removed, that org can no longer save its Order review flow at all: the editor loads the stored keys (`flow-admin.ts:350` returns `gateKeys`; `approval-flows-tab.tsx:183` seeds the draft from `flow.gateKeys`), renders checkboxes only for declared gates (`:780`), so the stale key cannot be unticked, sends it back (`:841`), and the server refuses any undeclared key with BAD_REQUEST `"create_lading" is not a gateable action for collective_order` (`flow-admin.ts:158-164`).
  - **Rollback procedure (recommended): partial revert.** Keep `{ key: "create_lading", … }` in `modules/collective-order/gates.ts`; revert only the `lading.ts` / `cost-lines.ts` callers, the seed change and the seeder change. The checkbox stays and is inert (no caller), so flows remain saveable. Remove the key in a later change only after the rows are gone.
  - **If the key must go:** first size the rows read-only (`select f.organization_id, count(*) from audit_flow_gate g join audit_flow f on f.id = g.flow_id where g.gate_key = 'create_lading' group by 1;`), then a reviewed, owner-run statement deletes exactly those rows (`delete from audit_flow_gate where gate_key = 'create_lading';`, expected count = the probe total) **before** the revert deploys. Wilfred runs it with the owner's override; never run from an agent.
  - Put this procedure in the Phase 3 PR description.
- **Audit trail.** Refusals write nothing (matches every guard in these routers). The engine's `audit.submit` / `audit.decide` rows become the only record of order reviews after Phase 2.

**Performance & Scalability**
1. **Pagination.** Unchanged; all changes are single-record or `MAX_BATCH_IDS`-bounded mutations.
2. **SQL-side filtering.** `assertNoneUnderReview` and `…Many` read latest submissions with one `IN` query (`latestSubmissionByResource`, `shared.ts:332`) and compare in memory over ≤ `MAX_BATCH_IDS` rows, the same shape as `assertGatesCleared`.
3. **N+1.** None added. Each single-order write gains one latest-submission read (two with post-approval, which already exists for most). Batch helpers are one query for the selection, not one per id.
4. **Index coverage.** The latest-submission read uses the same `audit_submission (organization_id, resource_type, resource_id)` path every existing freeze uses on every save; its index name was not re-verified in this pass. Gate lookups use `audit_flow_gate` unique (flow, key) (`schema/audit.ts:323-338`). No new WHERE shape.
5. **Write atomicity.** Every new guard runs inside the handler's existing transaction except `lading.update` and `costLines.create`, whose order loads already run on `context.db` before their write transaction. The gate there is a read-then-write race against a concurrent retract/reject; logged as a risk, owned by steps 16/17 and the cost-line step.
6. **Row locking.** `FOR UPDATE` on the order row in seven handlers and once at submit, so submit and save serialize. Under D17-B (Decided), this plan adds all seven and the `exists` lock at submit; `assignNumber`'s lock arrives with step 12 Task 1.1 (X7). Proven on real Postgres (`collective-order.concurrency.test.ts` [NEW]). Batch handlers lock in id order. Locks last one save (sub-second). `decide` already locks the submission (`shared.ts:33`); it does not lock the order, and does not need to, because saves refuse while the submission is open.
7. **Connections/resources.** None new.
8. **Tenant isolation.** Every added read filters `organization_id` (`latestSubmissionByResource`, `enabledFlowFor`). Gate calls use the id already proven org-local by `resolveLadingOrder` or the cost-line order load. `exists` keeps its org predicate.
9. **Payload size.** Unchanged.
10. **Hot path.** `collectiveOrder.update` and `saveChildren` run on every order save and gain one indexed read and a row lock. `collectiveOrder.get` (every form load) gains one indexed `latestSubmissionByResource` read for `underReview` (§4.2, D12).

## 9. Decision Register, Open Questions & Risks

**Statuses (/planpro).** No Input Gate was held; on 2026-09-17 Wilfred accepted the recommended option of **every** decision below, so all seventeen are **Decided**. Each keeps its three approaches, its recommendation and its consequence table, so any of them can be re-opened by reading what was rejected. Where a decision leans on a production probe or on operations input, the **Re-check** line names it: the choice stands, but the check is still required before the task that depends on it, and a contradiction stops the work for a re-plan rather than being absorbed. The former grouping (blocking / non-blocking / assumed) is kept as headings, because it still says which task each decision releases.

### Decided — was blocking

**D17: Which plan owns the order under-review freeze and its row locks?** · Status: **Decided** (same question as step 12 D5 and step 14 D5; `steps-12-15-crosscheck.md` X6, where this was labelled "X1")

| | Approach | Consequence |
|---|---|---|
| **A** | **Step 14 Phase 1** owns the freeze and `FOR UPDATE` loads on `update`, `saveChildren`, `setAbnormalTags`, `assignNumber`, `updateBatch`, plus the submit-side lock. Step 15 Phase 1 adds only `delete`, `batch` delete, the D2-B narrowing, the post-approval calls, `get.underReview` and the UI notice, and extends step 14's describe block | Step 14's current text recommends the opposite (its D5-C), so A needs step 14 to switch to its D5-A and adopt step 15 §4.1 verbatim: the lock in `exists`, the D2-B carve-out, and `updateBatch` ordered by id. Merge order 14 P1 → 15 P1, and the fees page is refused under review between the two merges unless 14 takes the carve-out. |
| **B** | **Step 15 Phase 1** owns all seven writers, the unconditional `exists` lock and `collective-order.under-review.test.ts` [NEW]; step 14 D5 answered C (Recommended) | One owner. This matches the SOP (finding filed under step 15), step 08's hand-off to "the orders step", step 12 D5-A and step 14's current text. The D2-B carve-out ships with the guard, so there is no interim window. Merge order 15 P1 → 14 P1. Step 14's readiness guarantee waits on step 15 Phase 1. |
| **C** | Split by handler with no coordination (the state before X6) | Each plan lists the other as a prerequisite, so the merge order is circular. No plan adds the `exists` lock, and no test suite exists for either plan to extend. Listed only to name the failure. |

- **Recommendation: B** — the X6 settlement. Three of the four sources (SOP, step 08, step 12) already name step 15, and step 14's current text agrees and already runs `collective-order.under-review.test.ts`. An earlier revision of this plan recommended A, based on a step 14 draft that no longer exists.
- **Chosen: B** (Wilfred, 2026-09-17; crosscheck X6). Step 15 Phase 1 owns all seven writers, the unconditional `exists` lock and `collective-order.under-review.test.ts` [NEW]; step 14 adds a `describe` to that file (X8) and reuses step 07's `assertPublishable` hook (X9).
- **Releases:** all of Phase 1 (Tasks 1.1–1.4) and the merge order in §7.6.
- **Where it lands:** header note, §1 In/Out of scope, §4.1 ("Which text applies", "Fallback (D17-B)"), §4.6, §5 prerequisites and Phase 1 "Task wording vs D17", §7.6, §7.8, §8 item 6, Risks. **Follow-ups outside this plan (flagged, not edited here):** step 14 D5 and step 12 D5 must record the same owner.

**D2: Does the order's fee grid freeze with the order?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | Freeze everything `saveChildren` writes, costs included | One rule for the whole order. The fees page refuses while under review (and after approval under D3). Meanwhile `costLines.create` on the Cost lines page still writes the same rows unfrozen: two doors to one room, only one locked. |
| **B** | Freeze containers, cargo and appendages; leave `costs` to the `expense_entry` gate and the cost line's own review (Recommended) | Matches the seed's stated purpose ("operational correctness, not money", `seed.ts:151`) and the other writer of the same rows. Fees can change while an order is Pending; accounting sees them through cost-line review. |
| **C** | Freeze costs only while under review, not after approval | Accounting reads fees at the moment of decision, and fees accrue afterwards. Still leaves `costLines.create` open during review, so the freeze is partial by construction. |

- **Recommendation: B.** A freeze that one page enforces and another ignores is not a control; fees already have their own review and gate.
- **Chosen: B** (Wilfred, 2026-09-17). Re-check before Task 1.2: probe P6 (fees on unapproved orders); if it contradicts the choice, stop and re-plan.
- **Cross-plan note:** step 14 D5-A as written freezes every `saveChildren` call, costs included. Under D17-B step 15 ships the carve-out with the guard, so step 14 inherits it and adds no guard of its own.
- **Releases:** Task 1.2.
- **Where it lands:** §4.1 `writesOrderContent`, Task 1.4 case 2, Journey 1 step 4.

**D3: Does `saveChildren` gain the post-approval freeze `update` already has?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | Yes, for containers, cargo and appendages (with D2-B) (Recommended) | The approved order is frozen consistently; today the edit form fails at `update` while the same containers save through `saveChildren`. Under the seeded `postApprovalEditable: false`, container numbers entered after approval need an admin to allow edits. Withdraw + re-approve is impossible after step 08 D3-A, so Duplicate is the escape. P13 sizes it. |
| **B** | No; leave post-approval as today and list it as a known gap | No new refusal for live approved orders. The approved content stays rewritable through one door. |
| **C** | Yes, costs included | Full consistency with `update`, but it blocks every post-approval fee on the order page (demurrage, storage) under the seeded flow. That is likely to jam operations. |

- **Recommendation: A** — unless P13 shows container/cargo saves after approval are routine. In that case choose **B**, and have a separate conversation about `postApprovalEditable` for orders.
- **Chosen: A** (Wilfred, 2026-09-17). Re-check before Task 1.2: probe P13 (child edits after approval under a locked flow); if it shows those saves are routine, stop and re-plan (option B, plus a separate `postApprovalEditable` conversation).
- **Releases:** Task 1.2.
- **Where it lands:** §4.1, Task 1.4 case 5, §7.3.

**D8: Do orders turn on `separationOfDuties`?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | `true` on `collective_order` (Recommended) | No change under the seed (accounting cannot submit). Closes self-approval for any tenant that routes the stage to ops, admin or branch manager, who hold both nodes. A flow whose only reviewer is the submitter refuses submit with step 08's message (P1, P12). |
| **B** | Keep step 08's `false` | No behaviour change anywhere; the engine hole stays open for tenant-edited flows. |
| **C** | Keep `false` and remove `collectiveOrder.review` from ops in `roles.ts` | Narrows who can review at all, but admin and branch manager still hold both, and it changes live grants for every ops member. |

- **Recommendation: A.** One line, inert under the seed, and it is what step 08 built the switch for.
- **Chosen: A** (Wilfred, 2026-09-17). Re-check before Task 2.2: probes P1 (stage reviewers per org) and P12 (who submits, by role); if a live flow's only reviewer is the submitting role, stop and re-plan.
- **Releases:** Task 2.2 (and its 2.3 tests).
- **Where it lands:** §4.3, Task 2.2, 2.3.

**D5: Which gates does a new org's Order review flow tick?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | `lock`, `end_order`, `shut_out`, `create_lading` (Recommended) | Approval gates the next SOP phase (step 16 B/L) and lifecycle closure, not step 14's data entry. No half-save. A rejected or never-submitted order cannot get a B/L. Fees stay bookable before approval. |
| **B** | The finding's repair: `expense_entry`, `end_order`, plus `create_lading` | Fees wait for approval. Every step-14 edit save of an unapproved order half-saves (header written, children refused) until D15-B exists, and new orders cannot carry fees at creation. Contradicts the SOP order. |
| **C** | Tick nothing; ship the code and key only | No behaviour change for anyone; finding B stays true for new orgs until an admin acts. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-17). Re-check before Task 3.4: probe P1 (what live flows already tick); if it contradicts the choice, stop and re-plan.
- **Releases:** Tasks 3.4, 3.6 and 3.7.
- **Where it lands:** §4.4, Task 3.4, 3.6, 3.7.

**D7: Where are approval gates checked?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | `create_lading` in `lading.create` **and** on re-link in `lading.update`; `expense_entry` also in `costLines.create` with an `orderId` (Recommended) | No create-unlinked-then-link bypass; a ticked `expense_entry` means the same on both fee writers. Adds refusals to files that steps 16/17 and the cost-line step own. |
| **B** | `create_lading` in `lading.create` only (the finding's repair) | Smallest; bypassed by linking on update. |
| **C** | No configurable key: `lading.create`/`update` refuse only when the order's latest attempt is `rejected` | Rejections finally mean something without a new checkbox or eyun deviation. Unsubmitted and pending orders still get B/Ls, and tenants cannot choose. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-17). Steps 16/17 and the cost-line step must keep these calls when they take those files.
- **Releases:** Tasks 3.1–3.3.
- **Where it lands:** §4.4, Tasks 3.1–3.3, 3.5.

**D6: What happens for existing orgs?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | No automatic change. Ship the key; the PR carries probe results and a checklist; an admin ticks per org when the backlog is ready (Recommended) | Nothing freezes mid-flight without a person choosing the moment. Finding B stays true for existing orgs until someone ticks. |
| **B** | An owner-run, reviewed SQL script inserts the D5 gate rows for every existing order flow on an announced date, after ops submit the live backlog | Enforced everywhere on a date. Every unapproved live order (P2, P11) refuses lock/end/shut-out/new B/L links at once; needs production write access with the override. |
| **C** | A migration backfills the gates | Automatic and repeatable, but it freezes live orders on deploy with no announcement: the worst of B, without the review. |

- **Recommendation: A.** Gates are already tenant configuration in the flow editor. Strict semantics freeze never-submitted live orders the instant a box is ticked, so that moment should be chosen with P2/P11 in hand.
- **Chosen: A** (Wilfred, 2026-09-17). Re-check before the Phase 3 release note: probes P2, P5 and P11 plus operations input on the live backlog; the per-org tick date stays an operations call, and if the backlog makes A unworkable, stop and re-plan.
- **Releases:** the Phase 3 release note only, not code.
- **Where it lands:** Journey 4, §7.3.

### Decided — was non-blocking

**D14: Should submit refuse orders out of the caller's data scope, archived, or not received?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | Add an optional `assertSubmittable(tx, org, resourceId)` hook to `ReviewableResource`; the order entry applies `applyScope` and refuses `archived` / `acceptStatus !== "received"` | Closes adjacent defect 4. It is another engine hook in files steps 08 and 10 edit. `orderScopeCols` lives in the router (`collective-order.ts:74`), so it must move to a module to avoid an import cycle. |
| **B** | Refuse state inside `exists` (returns false → NOT_FOUND) | One file; the message ("Record not found") is wrong for a visible order. |
| **C** | Defer, and record it as **unowned** (Recommended) | Keeps step 15 to its three findings. Neither step 12 nor step 13 plans submit-time state checks, so the RPC-only gap has no owner until Wilfred names one (§9 Risks). |

- **Recommendation: C.** The ledger row menu only offers orders the caller can already see; the gap needs a guessed id and changes only a cache. If Wilfred wants it closed, A is the shape, and step 14's `readinessProblem` hook (which already runs at submit and loads the order row) is the natural carrier: `archived` / `acceptStatus` could join its missing-list refusal.
- **Chosen: C** (Wilfred, 2026-09-17). Deferred and unowned, recorded as an **accepted known gap** (crosscheck X13): no step takes submit-time order-state checks. If it is closed later, A is the shape and step 14's readiness hook is the carrier.
- **Releases:** nothing; it was never blocking.
- **Where it lands:** §1 out of scope, §9 Risks (unowned).

**D15: What about the step-14 half-save when a tenant ticks content gates?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | Edit form sends each child array only when that set changed, and toasts a partial-save message naming what was refused | Fewer false trips; a real content change on a gated order still half-saves, now visibly. |
| **B** | One transactional `saveOrder` endpoint for header plus children | The real fix; a large change to the busiest form and two contracts. |
| **C** | Out of scope here; hand to step 14's plan, and D5-A does not seed content keys (Recommended) | No step-15 change to the form save path; tenants who tick content keys today keep the half-save until step 14 lands. |

- **Recommendation: C.** Step 15's own guards do not create a half-save (`update` refuses first under every freeze it adds); the defect belongs to the save path step 14 owns.
- **Chosen: C** (Wilfred, 2026-09-17). The half-save stays with the save path step 14 owns; D5-A seeds no content key, so no tenant meets it because of this plan.
- **Releases:** nothing; it was never blocking.
- **Where it lands:** §1 out of scope, §7.6 step 14 row.

**D16: Should `assignNumber` stay frozen after approval?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | Allow it past the post-approval freeze when the number is empty (keep the under-review freeze) | An approved unnumbered order can be numbered. It is a write past the lock, which the handler's own comment calls a back door. |
| **B** | Keep it frozen (Recommended) | Consistent; step 11 Phase 2 makes conversions arrive numbered, so the case shrinks to manual orders without a sequence. P10 sizes it. |
| **C** | Allow it only for admins | A controlled escape; a role check inside a guard that is otherwise role-free. |

- **Recommendation: B**, revisited if P10 is not near zero.
- **Chosen: B** (Wilfred, 2026-09-17). Re-check before Task 1.2: probe P10 (approved orders with no job number under a locked flow); if it is not near zero, stop and re-plan.
- **Releases:** nothing; it was never blocking.
- **Where it lands:** Task 1.2 (no change beyond the freeze order).

### Decided — were never blocking (judgment calls the plan had made in place of asking)

**D1: Which order writes join the under-review freeze?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | `update`, `updateBatch`, `assignNumber`, `setAbnormalTags`, `delete`, `batch` delete, `saveChildren` (per D2) (Recommended) | Content and existence are frozen, mirroring step 08 D6-A (`remove` frozen) and `lading.delete` (`lading.ts:1474`). Closes the RPC-only `updateBatch` and delete holes and stops new orphan submissions. |
| **B** | Only the finding's three: `update`, `saveChildren`, `assignNumber` | Smallest diff. Leaves `setAbnormalTags` (sent on every form save that touched reasons), `updateBatch` and delete writable under review, and keeps producing orphans. |
| **C** | A, plus lifecycle verbs (`transition` / `batch` lock, end, shut-out, archive) | Nothing moves while a reviewer reads. But lifecycle is not content, has no web caller today, and is already gate-configurable, so this duplicates D5 with a non-configurable rule. |

- **Recommendation: A.** Deleting or bulk-editing what a reviewer is reading is the same failure as editing it, and step 08 already chose that reading for quotations.
- **Chosen: A** (Wilfred, 2026-09-17). The extra writers (`updateBatch`, `delete`, `batch`) have no web caller, so users see no difference from B except fewer orphans.
- **Releases:** the seven-writer scope of Tasks 1.1–1.4.
- **Where it lands:** §4.1, Tasks 1.2–1.4.

**D10: How are a concurrent submit and save kept from interleaving?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | `FOR UPDATE` on the order row in each frozen handler and once at submit, in `collective_order.exists` (Recommended). Which plan writes the locks is D17 | Mirrors step 08 D10-A; one short lock per save. Proven on real Postgres by `collective-order.concurrency.test.ts` [NEW], not on PGlite. |
| **B** | Accept the race | No change; a save can still land milliseconds after submit, which is finding A made rarer. |
| **C** | Lock the resource row generically inside `submitForReview` for every resource | Uniform, but changes locking for nine resources other steps own. |

- **Recommendation: A.** It is step 08's pattern (Task 1.2), and the lock must sit in `exists` (`submit.ts:39`), before the unlocked open-attempt check at `:71-84`.
- **Chosen: A** (Wilfred, 2026-09-17). Step 15 writes every lock (D17-B), except `assignNumber`'s, which is step 12 Task 1.1's (X7).
- **Releases:** Task 1.3 and the concurrency test.
- **Where it lands:** §4.1, Task 1.3, §8 item 6.

**D4: What happens to `collectiveOrder.review` and `reviewBatch`?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | Delete both with their allow-list entries (Recommended) | The engine is the only writer of `order_audit_status`. Unknown external RPC callers get 404 (P4 shows whether any exist). |
| **B** | Re-implement as thin wrappers over `submitForReview` / `decide` | Keeps the RPC names, but every future guard must remember a second entry point, and `to: "draft"` has no engine meaning. |
| **C** | Keep them but refuse every call with "Use Approvals" | Clear message for stray callers; leaves dead procedures and allow-list lines. |

- **Recommendation: A.** Wilfred settled the identical question for quotations (step 08 D4-A, 2026-09-15), and the web architecture test already bans every web path.
- **Chosen: A** (Wilfred, 2026-09-17; following step 08 D4-A). Re-check before Task 2.1: probe P4 (legacy-verb calls in production); if a live caller shows up, stop and re-plan.
- **Releases:** Tasks 2.1 and 2.3.
- **Where it lands:** §4.3, Task 2.1, 2.3.

**D9: What happens to the `collectiveOrder.review` registry node once no endpoint requires it?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | Keep the node; drop `isEndpoint: true` on `[COLLECTIVE_ORDER.review]` (`permissions.ts:94-98`), with a comment that `decide.ts:50` re-checks it at decide time (Recommended) | `registry.sync.test.ts:22` passes; grants, `roles.ts:191` and `seed.test.ts` untouched. Precedent in the same file: `[COLLECTIVE_ORDER.lifecycle]` (`:99-105`). Task 2.3 pins that decide still refuses a stage member without the node. Step 08 needs the same line for `QUOTATION.review`; flagged. |
| **B** | Make the engine register every `reviewNode` as an endpoint (call `recordEndpointNode` from the resources registry) | The registry tells the truth about decide-time checks for all resources, but it is an engine-wide change to a permission guard other steps rely on. |
| **C** | Delete the node and point `reviewNode` at a new node | Clean vocabulary; needs a grant migration for every stored role row holding the old key. |

- **Recommendation: A.** It follows the `[COLLECTIVE_ORDER.lifecycle]` precedent, and grants are byte-identical. It is chosen here, not inherited: step 08 Task 3.3 contains no registry resolution. If step 08 later adopts a different rule, step 15 follows it.
- **Chosen: A** (Wilfred, 2026-09-17). No grant or user-visible change. Step 08 is expected to take the same line for `QUOTATION.review` (X10); flagged there, not edited here.
- **Releases:** Task 2.1's test gate.
- **Where it lands:** `permissions.ts:94-98`, §4.3, Tasks 2.1, 2.3.

**D11: Does a submission carry a content hash or version?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | No; the freeze plus row lock make edits during review impossible (Recommended) | No migration. Relies on every order writer calling the guard (Task 1.4 pins each). |
| **B** | `audit_submission.content_hash` set at submit and re-checked at decide | Detects writers that skip the guard, including future ones. Needs migration `00NN_audit_submission_content_hash` (numbered at merge), a per-resource hash hook, and a definition of "content" for orders with children. |
| **C** | Show "edited since submitted" in the queue from `audit_log` timestamps | Informative, no schema; a hint, not a control. |

- **Recommendation: A.** Step 08 made the same call for quotations; the hash duplicates a guard that now exists.
- **Chosen: A** (Wilfred, 2026-09-17). No migration in this plan; were B ever revisited, it is named `00NN_audit_submission_content_hash` and numbered at merge (X14).
- **Releases:** nothing; §4.5 stays schema-free.
- **Where it lands:** §4.5.

**D12: What do the order screens show while under review?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | Notice plus disabled Save on the edit form; one-line notice on the record page; both driven by a new `collectiveOrder.get` field `underReview` read from `audit_submission` (Recommended) | The operator learns the rule before typing a full edit. The cache (`order_audit_status`) is not read, so drifted rows (P3, legacy-verb residue) are never locked out of Save while the server would accept it. One extra indexed read per form load. |
| **B** | As A, but read the cached `order_audit_status`, and ship Task 1.5 only after Phase 2 **and** a D13 repaint, gated on P3 = 0 (formerly labelled A′) | No API field. Delays the notice by a phase and makes it depend on a data repair D13-A does not do. |
| **C** | Nothing; the 409 toast explains | No web change; the operator loses the edit they typed. |

- **Recommendation: A.** Mirrors step 08 D8-A. Making the whole form read-only was also considered and rejected, because it is a large change to a form step 14 also edits.
- **Chosen: A** (Wilfred, 2026-09-17; following step 08 D8-A). It adds a notice and a disabled state inside an existing screen, with no new design direction.
- **Releases:** Task 1.5, which still follows Task 1.2's `get` field.
- **Where it lands:** §4.2, Task 1.5.

**D13: What happens to residue already in production (legacy stamps, self-approvals, orphans, B/Ls on unapproved orders)?** · Status: **Decided**

| | Approach | Consequence |
|---|---|---|
| **A** | Read-only report script (P3, P4, P8, P9; P5 alongside), then per-row decisions (Recommended) | Nothing changes without a person looking. Needs the owner's override to run on production. |
| **B** | Migration repaints `order_audit_status` from the latest submission and closes orphan open submissions | Consistent data, but it silently demotes orders staff believe are approved, and it cannot tell legitimate history from abuse. |
| **C** | Leave it | No effort; drifted badges keep lying and orphan rows keep inflating queue counts. |

- **Recommendation: A.** Wilfred settled the identical question for quotations (step 08 D5-A, 2026-09-15).
- **Chosen: A** (Wilfred, 2026-09-17; following step 08 D5-A). The script writes nothing; any per-row repair is a later decision, taken with P3, P4, P8 and P9 in hand.
- **Releases:** Task 2.4.
- **Where it lands:** Task 2.4.

### Risks

- **Live under-review orders become read-only on deploy of Phase 1.** Likely; medium impact. → **Announce "withdraw before editing" to ops with the deploy; P2 gives the count.**
- **D3-A freezes container/cargo edits on approved orders under the seeded flow.** Medium likelihood; could block container-number entry. → **D3-A is Decided; re-check P13 before Task 1.2. If it contradicts the choice, stop and re-plan.**
- **Deleting the legacy verbs fails the permission registry sync.** Certain if D9 is not applied. → **Task 2.1 applies D9-A and runs `registry.sync.test.ts` before committing. Step 08 hits the same failure for `QUOTATION.review` with nothing planned; flagged to step 08.**
- **Seeded gates break e2e specs that link a B/L to an unapproved order.** Medium. → **Task 3.6 fixes specs by approving the order in setup, never by unticking.**
- **`lading.update` and `costLines.create` check the gate on `context.db` outside their write transaction.** Low likelihood; a reject landing between check and write lets one B/L link through. → **Accepted here; flagged to steps 16/17 and the cost-line step, which own those transaction boundaries.**
- **Line numbers drift.** Certain (steps 08, 10, 11 edit the same files). → **Every task locates by symbol.**
- **PGlite cannot prove the row lock.** Certain: one connection, every transaction serializes (`drizzle-orm/pglite/session.js:114-126`), so a lock test there passes on the old code. → **No PGlite lock test. `collective-order.concurrency.test.ts` [NEW] proves it on the dev branch with a deterministic interleave, and is seen failing without the lock first.**
- **Step 14 and step 15 each named the other as owner of the order freeze** (`steps-12-15-crosscheck.md` X6). **Resolved by D17-B (2026-09-17): step 15 Phase 1 merges first with the full freeze and the `exists` lock; step 14 adds only a `describe` (X8).** → **Residual risk: step 14's and step 12's own texts still have to record the same owner (their plans' edits). Task 1.2 greps each handler for an existing `assertNotUnderReview(` and `.for("update")` before writing, because step 12 Task 1.1 lands first (X7).**
- **Fees page blocked under review.** Cannot happen under D17-B: the D2-B costs carve-out ships in the same commit as the guard, and step 14 adds no `saveChildren` guard of its own.
- **Submit-time order-state checks (D14-C) are unowned.** Certain, and **accepted as a known gap** (X13), together with keeping rejected orders out of ledgers and the SOP text for steps 14–15. → **No owner is assigned; the RPC-only gap is accepted until someone takes it in a later plan.**
- **Operations seeder breaks on orgs created after Phase 3** (`seed/operations.ts:449-458` links ladings before submission). Certain without Task 3.7. → **Task 3.7; Phase 3 acceptance runs the seeder on a new org.**
- **A Phase 3 revert makes flow editing fail** for orgs holding a `create_lading` row (`flow-admin.ts:158-164`). Certain on a full revert. → **§8 Rollback: partial revert keeps the key, or an owner-run delete sized by a probe first.**
- **A stale `:3000` server makes browser checks pass on old code.** High. → **Restart after every `packages/api` change and check the process start time.**

### SOP text vs code (Phase 0 wins)

| # | SOP / finding claims | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| 1 | Finding A: "saveChildren (:4756)" | `:4756` is `setAbnormalTags`; `saveChildren` is `:3954` with no post-approval call | Code (D1, D3) |
| 2 | Finding A: "assignJobNumber (:2800)" | Procedure is `assignNumber` (`:2770`); `:2800` is its post-approval line | Code |
| 3 | Finding A repair: "beside each existing assertPostApprovalEditable call" | No such call in `saveChildren`; `updateBatch`, `delete`, `batch` delete also unguarded | Code (D1) |
| 4 | Finding B: "not one is ticked" | True for the seed; tenants can tick in the flow editor (`flow-admin.ts:116`) | Code (probe P1) |
| 5 | Finding B repair: "tick in SEEDED_FLOWS" | Seed runs only for new orgs (`seed.ts:223`, `org.ts:132`) | Code (D6) |
| 6 | Finding B repair: tick `expense_entry` | Half-saves every step-14 save; SOP puts fees before approval | Code (D5-A, D15) |
| 7 | Finding B: order can be "locked, ended" | True at the API; no web caller for `transition`/`batch` | Code |
| 8 | Finding B repair: gate `lading.create` | Bypassed by linking on `lading.update` (`lading.ts:1588-1600`) | Code (D7-A) |
| 9 | Finding C: "ops" can self-stamp | Also admin, branch manager, and accounting (leaf); `reviewBatch` too; also corrupts engine state | Code (D4) |
| 10 | Finding C: "order-row-actions.tsx:55" | Inside the comment block `:54-63` | none |
| 11 | SOP step 15 "role": reviewer "holding audit:read" | Decide also re-checks `collectiveOrder.review` (`decide.ts:50`) and stage membership (`:78`) | Code |

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000. One worktree's servers at a time.
**Preconditions:**
- A freshly seeded audit e2e org: `bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>` (usage in the file header; `e2e/fixtures/global-setup.ts:19-22` runs the same). Re-read `ACTORS` at the base commit, because the file has uncommitted edits at HEAD. At HEAD `ACTORS` (`seed-cli.ts:45-70`) seeds **owner, directorA, directorB, accountant, salesperson, managerA, managerB, viewer**: no ops member, no second accountant, no admin, and no "documentation" role exists. The walk uses the real actors:
  - **Submitter (ops-equivalent): `managerA`** (branch-manager). It holds the `collectiveOrder` root (`roles.ts` `MODULE_ROLE_GRANTS["branch-manager"]`), so it can update, submit and hold `collectiveOrder.review`, which is the same shape as ops (`roles.ts:169`).
  - **Order reviewer: `accountant`** (accounting). It is the seeded Order review stage role and holds `collectiveOrder.review` as a leaf (`roles.ts:191`).
  - **B/L creator: `managerB`** (branch-manager). `lading.create` comes from the flat statement: `lading: [...fullCrud]` for owner, admin, branch-manager and ops (`packages/auth/src/permissions.ts:105, 132, 154, 176`); accounting, director, sales and viewer hold only `read`. `lading.create` requires `LADING.create` (`lading.ts:1031`). managerB is not the submitter, so B/L refusals are not confused with self-decision.
  - **Flow editor: `owner`** (bypasses the node guard, `roles.ts:55`).
  - Each actor's cookie comes from the seed JSON. After Phase 3 the org's order flow has the four seeded gates. Before Phase 3 `create_lading` does not exist, so run Journey 3 only after Phase 3.
- A sea-export order **O1**, received into the ledger, with a job number, one container, one cargo line and one fee; not submitted.
- Confirm the actor with `fetch('/api/auth/get-session')` before each actor's steps. Restart `:3000` after the last `packages/api` edit.

**Migrations:** none. Confirm the journal still ends where the merged steps left it (0065 plus whatever 01, 02, 04, 09, 10 and the conditional 05–08, 11 applied) and that those are applied. Check `_journal.json` and the database, not the command exit code.

**Test commands** (run each; read the output for `failed` and for the `Test Files` summary line; `bun run check-types` can exit 0 while printing "failed"):
- Phase 1: `bunx vp test run packages/api/src/modules/audit/gates.test.ts packages/api/src/routers/collective-order.guards.test.ts packages/api/src/routers/collective-order.under-review.test.ts packages/api/src/routers/collective-order.costs.test.ts packages/api/src/routers/collective-order.numbering.test.ts packages/api/src/routers/collective-order.abnormal-tags.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/architecture.test.ts`, then `DATABASE_URL_TEST=<dev branch URL> bunx vp test run packages/api/src/routers/collective-order.concurrency.test.ts` (confirm the output lists its tests as passed, not skipped).
- Phase 2: `bunx vp test run packages/api/src/permissions/registry.sync.test.ts packages/api/src/permissions/reachability.test.ts packages/api/src/modules/audit/seed.test.ts packages/api/src/routers/collective-order.seeded-roles.test.ts packages/api/src/routers/collective-order.guards.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/architecture.test.ts apps/web/src/architecture.test.ts`
- Phase 3: `bunx vp test run packages/api/src/modules/audit/gates.test.ts packages/api/src/modules/audit/seed.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/routers/audit-flow.test.ts packages/api/src/routers/lading.test.ts packages/api/src/modules/lading/resolve-order.test.ts packages/api/src/routers/export.test.ts packages/api/src/routers/quotation.convert.test.ts packages/api/src/routers/expense.self-bridge.test.ts`, then the operations seeder against an org created after Phase 3 (Task 3.7 acceptance).
- Every phase: `bun run check-types` (confirm `apps/web` and `seed` ran), then the e2e specs in Task 3.6 for Phase 3 (and `audit.order-queue.spec.ts`, `audit.withdraw.spec.ts` for Phases 1–2).

**Golden path — Journey 1 (Phase 1; `managerA`)**
1. Navigate to `/order/sea-export` → O1's row shows Audit status **Draft**.
2. Open O1's **Review this order** menu → **Submit for review** → toast _"1 row — submit for review"_ (`review-menu.tsx:110`); the row reads **Pending**.
3. Navigate to `/order/<O1>/edit` → the under-review notice is visible; the **Save** button has the `disabled` attribute and its `title` contains "Under review".
4. In the console, call `collectiveOrder/update` over `/rpc` with `vesselName: "S15 CHANGED"` (the input field is `vesselName`, `collective-order.ts:192`; an unknown key such as `vessel` is stripped by zod and would prove nothing) → HTTP 409, body contains _"This record is under review"_. Call `collectiveOrder/get` → `vesselName` is still the original value.
5. Call `collectiveOrder/saveChildren` with `containers: []` → 409; reload the edit form → the container is still there. Call `collectiveOrder/delete` for O1 → 409; O1 is still listed.
6. Navigate to `/order/<O1>/expenses`, add a fee "THC 100", press Save → a success toast (re-read the page's wording at the base commit) and the fee persists on reload (D2-B).
7. Back on `/order/sea-export`, O1's menu → **Request withdrawal** → the row reads **Withdrawn**.
8. `/order/<O1>/edit` → no notice, Save enabled. Change **Vessel name**, Save → toast _"Order updated"_ (`order-form.tsx:1769`). `collectiveOrder/get` shows the new `vesselName`. Submit again → **Pending**.

**Golden path — Journey 2 (Phase 2)**
1. As `accountant`, navigate to `/approve/order` → O1 is listed. Tick it and press **Approved** → success toast; the row leaves the queue.
2. `/order/sea-export` → O1 reads **Approved**.
3. In the console, POST `/rpc/collectiveOrder/review` → **404**.
4. Self-decision: as `owner`, edit the Order review flow so its stage also names the **branch-manager** role. As `managerA`, submit a second order O2. `managerA` opens `/approve/order` → O2 is **not** listed; calling `auditReview/decideByResource` for O2 → FORBIDDEN _"You submitted this record. Another reviewer must decide it."_ As `managerB` (same role, not the submitter), O2 is listed and approvable; alternatively as `accountant`. Restore the flow afterwards.

**Golden path — Journey 3 (Phase 3; `managerB` raises B/Ls, `managerA` submits, `accountant` approves)**
1. As `managerA`, create order O3 (not submitted) with job number J3.
2. As `managerB`, navigate to `/lading/create`, fill bill number `BL-S15-1`, pick O3 in the **Linked order** select (`lading/create.tsx:1242-1270`; picking copies J3 into **Order No**), press Create → error toast _"\"Raise bill of lading\" requires review approval first"_; the URL stays on `/lading/create`; `/lading` has no `BL-S15-1`.
3. Set **Linked order** to "No order linked" **and** empty the **Order No** field (`:1275`), because a typed number still resolves to O3 → Create → toast _"Bill of Lading created"_ (`create.tsx:355`); the B/L is unlinked.
4. Open that B/L's edit page (`/lading/<id>/edit`), pick O3 in **Linked order** (`$id/edit.tsx:1513`), save → the same error toast; reload → still unlinked. Repeat by typing J3 into **Order No** (`:1542`) with Linked order empty → the same refusal.
5. As `managerA` submit O3; as `accountant` approve it. Back as `managerB`, pick O3 again → saved; the B/L shows the link.
6. As `owner`: open Approval Process Setting → Order review → the gate list shows **Raise bill of lading** ticked, plus Lock, End/Cancel the end, Shut out.

**Edge case 1: rejected order.** As `managerA` submit O4; as `accountant` reject it in `/approve/order` with reason "wrong POD". As `managerB`, create a B/L with O4 picked in Linked order → refused with the gate sentence. As `managerA`, `/order/<O4>/edit` → no notice, Save enabled (a rejected attempt is terminal and editable).

**Edge case 2: approved order is locked for content (D3-A).** On O1 (Approved, seeded `postApprovalEditable: false`): `/order/<O1>/expenses` add a fee → saved (D2-B). Call `collectiveOrder/saveChildren` with O1's containers → 409 _"This record was approved and its content can no longer be edited"_. The edit form's Save → the same message.

**Edge case 3: submit/save serialization (dev branch, not the browser).** Proven by `collective-order.concurrency.test.ts` (Task 1.4) with a deterministic interleave, not by a `Promise.all` race. Pass or fail is judged by the HTTP/`call` results and the **final state** (order row, children, latest `audit_submission.status`), never by timestamps: `audit_submission.submitted_at` (`schema/audit.ts:370`) and `audit_log.created_at` (`schema/audit-log.ts:25`) are both `defaultNow()`, which is the transaction start time, so a correctly serialized update can look like an edit after submit. Pass = the writer on connection B returns CONFLICT after A's submit commits, and the row is unchanged. The same test run against the router without the lock must fail (recorded in the PR).

**Edge case 4: drifted cache (D12).** On the dev branch only, pick (or, in the seeded e2e org, create through a raw update of `order_audit_status = 'pending'` with no submission) an order whose badge reads Pending with no open attempt → `/order/<id>/edit` shows no notice and Save succeeds. It appears in the Task 2.4 report (P3).

**Regression checks.**
1. `/order/sea-export` duplicate, Assign number (on an unnumbered draft) and abnormal reasons still save on a Draft order.
2. `/quotations/<id>` → Convert to order still lands on `/order/<id>/edit` with fees carried, with `expense_entry` ticked on the org (conversion is not gated).
3. `/expenses/cost-lines` → create a fee with no order → created.
4. `/approve/quotation` and `/approve/bill` behave as before (engine files touched only through flags and helpers).
5. `e2e/specs/audit.order-queue.spec.ts`, `audit.withdraw.spec.ts`, `audit.post-approval.spec.ts`, `lading.golden-path.spec.ts` pass.

**Mobile:** at 400px the edit form's under-review notice wraps without horizontal scroll, and the disabled Save still exposes its reason (title or tooltip on tap); `/lading/create` shows the error toast without overflow.

**Readiness: 8/10 — every decision settled 2026-09-17; the remaining risk is merge dependencies, unrun probes and proofs that only a dev database can give.** Every guard, caller, role grant, gate key, test pin, seeder call and probe column cited here was re-read at HEAD `6bb3a1bf`, and each phase is small and testable at the API boundary. The revision removed the double ownership with step 14, the inherited-but-missing D9 fix, the cache-driven notice, the false-positive lock test, the seeder break and the wrong rollback claim. What is still outstanding:
- All seventeen decisions are Decided (D17-B, D1-A, D2-B, D3-A, D4-A, D5-A, D6-A, D7-A, D8-A, D9-A, D10-A, D11-A, D12-A, D13-A, D14-C, D15-C, D16-B). Tasks 1.2–1.4 are worded for D17-B. Step 14 D5 and step 12 D5 still have to record the same owner in their own plans (X6, X7).
- Hard dependency on four unmerged plans (08 all phases, 10 Task 1.2, 11 Phase 2, 12 Phase 1) that rewrite the same files, with 14 Phase 1 between 15 Phase 1 and 15 Phase 3 (X12). Anchors must be re-located after each lands.
- Live impact is unmeasured until the probes are run: P13, P6, P10 before Task 1.2; P4 before 2.1; P1, P12 before 2.2; P1 before 3.4; P2, P5, P11 before the Phase 3 release note. A probe that contradicts its decision stops the task for a re-plan.
- The lock proof and the drift report exist only on a dev Neon branch (`DATABASE_URL_TEST`, `packages/db/scripts/…` run read-only); CI has no `DATABASE_URL_TEST`, so each PR pastes the real-Postgres output (X8). D14-C is an accepted unowned gap (X13). Steps 16–17 (which own `lading.ts` neighbouring code) have no plans yet.

## Review disposition (2026-09-17)

Every citation added in this revision was re-located by symbol at HEAD `6bb3a1bf` (read-only). Edits to plans 08, 12 and 14 are flagged, not made here.

1. **blocker · verifiability** · Step 14 Phase 1 and step 15 Phase 1 both add the freeze, the locks and a test suite to the same order writers, with contradictory merge orders → **Fixed.** New decision D17 (§9, recommended A: step 14 owns the five writers and the submit-side lock). Header ownership note; §4.1 rewritten as step-15 deltas plus a fallback for D17-B; §5 prerequisites and Tasks 1.2–1.4 (no re-added guards, one suite: extend step 14's describe block, `collective-order.under-review.test.ts` dropped); §6 ownership; §7.6 row for step 14 Phase 1 and required order. Step 12 D5 and step 14 D5 need matching edits (flagged in D17 and §7.6).
2. **major · data-safety** · Step 14 D5-A freezes every `saveChildren` call while step 15 D2-B keeps costs writable, and §7.6 said "12–14 (no plans yet)" → **Fixed.** §4.1 "Interim window" and D2 cross-plan note: under D2-B, step 14 should take the carve-out, or Task 1.2 narrows step 14's line. §7.6 rows rewritten against the real plans 12, 13 and 14; new risk in §9.
3. **major · correctness** · D9 copied a registry resolution from step 08 Task 3.3 that does not exist → **Fixed.** Confirmed: step 08 has no `registry`/`isEndpoint` text beyond the resource registry, and `QUOTATION.review` is `isEndpoint: true` (`modules/quotation/permissions.ts:56-60`) with only `quotation.ts:3846` requiring it. D9 now picks A itself (drop `isEndpoint: true` on `[COLLECTIVE_ORDER.review]`, following the `[COLLECTIVE_ORDER.lifecycle]` precedent at `permissions.ts:99-105`, with a comment citing `decide.ts:50`). Phase 0 Finding C, §4.3, Task 2.1, a new Task 2.3 pin (decide refuses a stage member without the node), §7.6 row 08 3.1–3.3, and Risks. The same gap is flagged to step 08.
4. **major · data-safety** · The web notice read the drifting `order_audit_status` cache, so drifted rows would get a permanently disabled Save → **Fixed.** §4.2: `collectiveOrder.get` gains `underReview` from `latestSubmissionByResource` (`shared.ts:332`), and the form reads that. Option A′ (cache + ship after Phase 2 and repaint, gated on P3 = 0) is recorded in D12 (relabelled D12-B in the self-review pass). Task 1.4 case 7, §7.4, §7.5 (API before web), §10 edge case 4, and the §6 A → B contract.
5. **major · data-safety** · Seeding `create_lading` breaks the operations seeder, which links ladings before submission → **Fixed.** New Task 3.7 (`seed/operations.ts`, `seed/run-operations.ts`, `seed/flows.ts`, owned by Agent E): create ladings unlinked when the gate is ticked. Phase 3 acceptance runs `seed/cli.ts operations --write` against an org created after Phase 3 on the dev branch. Risk added.
6. **major · data-safety** · The Phase 3 rollback claimed stale gates can be unticked, but the editor cannot save a flow holding an undeclared key → **Fixed.** Confirmed at `flow-admin.ts:158-164, 350` and `approval-flows-tab.tsx:183, 780, 841`. §8 Rollback now recommends a partial revert that keeps the vocabulary entry, or a probe-sized, owner-run delete of `audit_flow_gate` rows with `gate_key = 'create_lading'` before a full revert. Risk added.
7. **major · verifiability** · The browser walk used actors no seeder creates (ops, acct1/acct2, admin, documentation) → **Fixed**, with one sub-claim **rejected.** §10 now uses `managerA` (submitter), `accountant` (reviewer), `managerB` (B/L creator) and `owner` (flow editor), and gives the full seeder invocation. Rejected sub-claim, "none has a lading.create leaf": `packages/auth/src/permissions.ts:105, 132, 154, 176` grant `lading: [...fullCrud]` to owner, admin, branch-manager and ops, so `managerB` can reach `LADING.create` (`lading.ts:1031`).
8. **major · verifiability** · The PGlite lock test is a false positive, and the timestamp-based race proof is unsound → **Fixed.** The PGlite `it` is removed, with the reason (`drizzle-orm/pglite/session.js:114-126`). New `collective-order.concurrency.test.ts` [NEW], modelled on `expense.concurrency.test.ts:65, 71`, uses a deterministic A-locks / B-writes / A-submits interleave and must be seen failing without the lock. §10 edge case 3 is judged by results and final state, not by `defaultNow()` timestamps (`schema/audit.ts:370`, `schema/audit-log.ts:25`). §7.8, §8 Testing and Risks are updated.
9. **minor · correctness** · The expected Submit toast was wrong ("Review updated") → **Fixed.** Journey 1 in §2 and §10 now expect _"1 row — submit for review"_ (`review-menu.tsx:110`).
10. **minor · verifiability** · The walk strings and fields were wrong (the toast, and `vessel` instead of `vesselName`) → **Fixed.** §10 Journey 1 steps 2, 4 and 8 now use `vesselName` (`collective-order.ts:192`) and re-read the value through `collectiveOrder/get`. The toast is fixed as in item 9.
11. **minor · correctness** · D14 was handed to steps 12/13, which do not take it → **Fixed.** D14-C is now "defer, unowned". The recommendation names step 14's readiness hook as the cheapest carrier, and the gap is recorded in §9 Risks and §1 out of scope.
12. **minor · data-safety** · The `0076_` migration placeholder collides with step 12 → **Fixed here.** Changed to `00NN_audit_submission_content_hash` in Phase 0, §4.5, §8 and D11. The step 12 D3-B placeholder is flagged (§7.6), not edited.
13. **minor · verifiability** · "quotation.convert.test.ts passes with expense_entry ticked" was not exercised by any owned file → **Fixed.** Task 3.5 adds a ticked-`expense_entry` conversion case in `audit-review.test.ts` (owned by Agent D); `quotation.convert.test.ts` is re-run unchanged and listed as read-only.
14. **minor · verifiability** · The lading walk did not name the Linked order select or the Order No field, so the unlinked case could still match by text → **Fixed.** §2 Journey 3 and §10 Journey 3 spell out the controls (`lading/create.tsx:1242-1270, 1275`; `lading/$id/edit.tsx:1513, 1542`), clear both for the unlinked case, and add a typed-number re-link refusal.

### Self-review gate (2026-09-17)

Run against the /planpro closing checklist. The code repo was read-only, HEAD `6bb3a1bf`, and `git status -- packages apps` was clean.

| Checklist item | Result | Note |
|---|---|---|
| Every §4 data model and endpoint names the journey step it serves | fixed | §4.1–4.4 already named journeys. §4.6 gained a journey-step mapping line (`costLines.create` → §10 regression 3 / Task 3.5, as no journey seeds `expense_entry`). §4.5 has no schema change. |
| Every §5 task lists real file paths, verified or `[NEW]` | pass | Every cited path exists at HEAD. `collective-order.concurrency.test.ts`, `collective-order.under-review.test.ts` and `packages/db/scripts/…` are absent and tagged `[NEW]`. |
| Every §5 task has exactly one owner agent from §6 | pass | A (1.1–1.4), B (1.5), C (2.1–2.4), D (3.1–3.5), E (3.6–3.7). Agent A's owned files now include `collective-order.under-review.test.ts` [NEW, D17-B]. |
| No new dependency outside a §9 open question | pass | No package added. |
| Every §9 decision has three approaches, one recommendation, a status, blocking marked | fixed | The blanket "every decision is OPEN" line was replaced. There are 10 Open decisions (D17, D2, D3, D8, D5, D7, D6 blocking; D14, D15, D16 not) and 7 Assumed (D1, D10, D4, D9, D11, D12, D13), with a Chosen line on each. D12 had four options (A, A′, B, C): A′ became B, B became C, and the read-only form is noted as rejected. The register is reordered Open-blocking → Open → Assumed. The earlier "X1" label was renamed D17, with a reference to crosscheck X6. **Superseded later on 2026-09-17: all seventeen are now Decided; the headings keep the old grouping.** |
| Every §1 assumption and §4 key decision points at a §9 id | fixed | §1 now lists every decision with its id (as "Decisions (settled 2026-09-17)"). Every §4.7 line carries its id and status. |
| Every Input Gate question appears in §9 as Decided | pass | No Input Gate was held; §1 says so. Wilfred settled every decision on 2026-09-17 instead, so all seventeen are Decided with a named option and date. |
| §7 caller list came from a grep this session | fixed | Re-grepped at HEAD. `collectiveOrder.get` readers corrected (`order-form.tsx:716`, not `:715`; added `order-record-page.tsx:34`, `lading/$id/index.tsx:133`, `order.$orderId.expenses.tsx:460`; the ledger reads `list`, not `get`). Added comment references to the review verbs (`apps/web/src/architecture.test.ts:788`, `bills.ts:1190`, `audit.order-queue.spec.ts:183`, `seed/run-operations.ts:99`), node references (`guards.test.ts:76, 174`, `seed/assign.ts:38, 48`) and test callers of `seedAuditFlows` (`seed.test.ts`, `audit-flow.test.ts`, `audit-review.test.ts`). `audit-flow.test.ts` was added to Task 3.5 re-runs and the §10 Phase 3 command. Other callers (`assertNotUnderReview` ×4, web writers, `exists` at `submit.ts:39`, `lading.create` `create.tsx:353`, `costLines.create` `cost-lines.tsx:385`) were confirmed. |
| §10 URL and port are the project's dev URL | pass | `http://localhost:3101` (web) and `:3000` (API), matching `.claude/launch.json`. |
| Migration numbers match the journal | pass | Journal ends at idx 64 `0065_quotation_send_decision`; 65 `.sql` files. No migration planned; the D11-B placeholder stays `00NN_`. §10 migration note now includes the conditional 05–08 and 11 reservations. |
| Tier in META.md matches what was written | pass | Standard, 3 phases, all 10 sections (recorded for META.md). |
| §1 Assumptions lists every judgment call made in place of asking, with §9 id | fixed | See the §1 item above. |
| Context file passed: §1 names it, requirements planned or declined, conflicts in §9 | pass | The SOP findings table in §1 plans all three; "SOP text vs code" in §9 records the conflicts. |

**Correctness fix found by the gate.** D17 (formerly X1) recommended A, on the premise that step 14 plans the five-writer freeze. Step 14's current text recommends its D5-C (step 15 owns it), and X6 recommends the same. D17 was re-recommended **B** at that gate, and Wilfred accepted it later the same day (see "Decisions settled" below). The header, §1, §4.1 ("Which text applies" and "Fallback (D17-B)", now the operative spec: unconditional `exists` lock, D2-B carve-out from day one, `updateBatch` load ordered by id since `collective-order.ts:3046-3049` has no `orderBy`, and tests in `collective-order.under-review.test.ts` [NEW]), §4.6, §5 prerequisites and the Phase 1 note, §7.1, §7.6 (step 14 and step 12 rows, required order), §7.8, §8 item 6, Risks and the readiness bullets were updated. Tasks 1.2–1.4 were re-worded for D17-B when the decision was settled. §8 item 10 was also corrected: `get` does gain one read (§4.2).

### Decisions settled (2026-09-17)

Wilfred accepted the recommended option of every decision in §9, and every recommended settlement in `steps-12-15-crosscheck.md` (X6–X16). Each §9 entry keeps all three approaches; only the status, the Chosen line and the text that described a decision as open were changed.

| Decision | Chosen | Note |
|---|---|---|
| D1 | A | Freeze all seven order writers, delete and batch delete included |
| D2 | B | Containers, cargo, appendages freeze; `costs` stay writable (re-check P6) |
| D3 | A | `saveChildren` gains the post-approval freeze on content arrays (re-check P13) |
| D4 | A | Delete `collectiveOrder.review` and `reviewBatch` (re-check P4) |
| D5 | A | Seed `lock`, `end_order`, `shut_out`, `create_lading` (re-check P1) |
| D6 | A | Existing orgs change only when an admin ticks (P2, P5, P11 + operations input) |
| D7 | A | Gate `lading.create`, the `lading.update` re-link and `costLines.create` |
| D8 | A | `separationOfDuties: true` for `collective_order` (re-check P1, P12) |
| D9 | A | Keep the node, drop `isEndpoint: true` (step 08 to follow, X10) |
| D10 | A | `FOR UPDATE` in each frozen handler and in `exists` at submit |
| D11 | A | No content hash, no migration (X14 naming if ever revisited) |
| D12 | A | Notice plus disabled Save, driven by `get.underReview` |
| D13 | A | Read-only residue report, no repair |
| D14 | C | Deferred and **unowned** — accepted known gap (X13) |
| D15 | C | Half-save stays with step 14's save path |
| D16 | B | `assignNumber` stays frozen after approval (re-check P10) |
| D17 | B | Step 15 owns all seven writers, the `exists` lock and `collective-order.under-review.test.ts` [NEW]; 15 P1 before 14 P1 (X6) |

**Crosscheck settlements accepted (X6–X16), as they land in this plan.** X6 → header, §4.1, §5, §7.6, §7.8, D17. X7 → `assignNumber`'s row lock is step 12 Task 1.1's; Tasks 1.2/1.3 grep before adding. X8 → this plan creates `collective-order.under-review.test.ts` and `collective-order.concurrency.test.ts`; step 14 adds a `describe`; each PR pastes real-Postgres output, because CI has no `DATABASE_URL_TEST`. X9 → step 14 reuses step 07's `assertPublishable` hook; no freeze in it. X11 → the widened re-stamp lives in step 11 Task 2.4, so Task 1.2 only orders the freeze before that loop. X12 → step 14 Phase 1 merges before step 15 Phase 3 (`seed/operations.ts`). X13 → submit-time order-state checks (D14-C), keeping rejected orders out of ledgers, and the SOP text for steps 14–15 stay **unowned, accepted known gaps** (§9 Risks). X14 → any conditional migration is `00NN_<name>`, numbered at merge (§4.5, §8, D11). X16 → the uncommitted `e2e/` changes in `nct-layout` are committed or set aside by Wilfred before Wave 6; no agent stashes, resets or checks them out (header working-tree note, §7.6).
