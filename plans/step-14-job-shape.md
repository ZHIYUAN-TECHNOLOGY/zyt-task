# Step 14: an order must have the basic details of a shipment before it can go for review, cannot be changed while under review, and records its status from a fixed list of milestones

**SOP step:** 14 "Fill in the operational detail" · `/order/$orderId/edit` (also `/order/new` and the per-trade ledgers such as `/order/sea-export`)
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-17. This is the same commit steps 04–11 were planned at. Every `file:line` below was located by symbol at that HEAD in this pass.
**Tier:** Standard. Phase 1 implements step 07's `assertPublishable?` hook on the `collective_order` entry of the shared audit engine (D10-A) and fixes the operations seeder that submits orders. Phase 3 changes what the order write contract accepts for `status`. No migration under the chosen options.
**Readiness: 8/10. Decisions settled 2026-09-17 (all D1–D15 Decided, §9).** Remaining real risks: merge dependencies (08, 10, 11 Phase 2, 12 Phase 1, 07 Phase 3 and 15 Phase 1 must land first); probes P1, P3, P4, P5 and operations input on the required set and the non-sea status chains must be re-checked before Tasks 1.1 / 3.1; the race proof runs on a dev test database only (CI has no `DATABASE_URL_TEST`); the legacy review bypass stays open until step 15 deletes the verbs. See §10.
**Cross-plan items owned:**
- The `saveChildren` `orderNo` rule on an unnumbered job, handed over by step 12 (`step-12-job-number.md` §7 "Lock behaviour" and its collision row for `saveChildren` `orderNo`). See §9 Risks.
- **Not owned (D5-C Decided 2026-09-17; `steps-12-15-crosscheck.md` X6 settled the same way):** the order under-review freeze and the submit/save row lock. Step 08 handed the freeze to "the orders step" (`step-08-quotation-approval-integrity.md` §10 table, row 1), the SOP files it under step 15 (`customer-intake-sop/sop.json`, step 15 `fixes[0]`), step 12 D5-A names step 15 as owner, and step 15 plans it in full (§4.1, D1, D2-B, D10-A, Tasks 1.1–1.4). Step 14 **depends on step 15 Phase 1** for it, because the readiness check has a gap without the freeze; step 15 Phase 1 merges before step 14 Phase 1. D5-A (step 14 owns it) stays recorded in §9 as a rejected alternative with the rules it would have had to adopt.
- **Not owned:** the `assignNumber` row lock (step 12 Task 1.1, X7) and the widened `orderNo` re-stamp (step 11 Task 2.4, X11).
- **Not owned:** deleting the legacy `collectiveOrder.review` / `reviewBatch` verbs, the order self-approval rule, and ticking order gates. All three stay with step 15 (D7).
- **Unowned, accepted known gaps (X13, 2026-09-17):** submit-time order-state checks (archived, not received, rejected at intake), keeping rejected orders out of the ledgers, and SOP text for steps 14–15. No plan owns them.

---

## Phase 0 findings (read before the plan)

- **Stack.**
  - Routers: oRPC in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`).
  - Schema and migrations: Drizzle schema in `packages/db/src/schema`, migrations in `packages/db/src/migrations`.
  - Web: TanStack Router file routes in `apps/web/src/routes/_next`.
  - Validation and tests: zod on both sides, and vitest on PGlite (`packages/api/src/test-schema.ts`).
  - Shared code: web imports pure api modules through the `"./*"` export in `packages/api/package.json:8`, for example `@nct-ai/api/modules/expense/bridge` in `apps/web/src/components/tariff-hint.tsx:1`.

- **Tracker items** (`tracker/seed/tasks-nct.json`, the tasks whose `steps` include `n: 14`):
  - `nct-job-shape` (rank 15): "Nothing enforces the shape of a job …"
  - `nct-haulage` (rank 18; steps 14 and 19): "Haulage is a separate island …"

  The SOP's step 14 card has no `fixes` array. Its pitfalls are "No field is mandatory on the edit form" and "desk roles are typed names".

- **`nct-job-shape`, part 1: confirmed. The server requires almost nothing.**
  - `create` (`routers/collective-order.ts:2508`) requires `owningBranchId` and `businessType`. The UI fills both automatically: the branch from `branches.data[0]` (`apps/web/src/components/order-form.tsx:867`) and the trade from `?type`.
  - Every other key in `orderFields` (`:138`) is `.optional()` or `.nullish()`. The only required key is `businessType: z.enum(BUSINESS_TYPES)` (`:139`).
  - `update` (`:2847`) makes `businessType` optional too (`:2853`), and an empty patch returns the row unchanged (`:2930`).
  - The client's only precondition is "Select an owning branch first" on create (`order-form.tsx:1594-1597`).
  - **The finding understates the problem.** The review submit path checks nothing about the order's content either. `submitForReview` (`modules/audit/submit.ts:24`) checks:
    1. the submit node (`:33`);
    2. `entry.exists` (`:39`);
    3. that an enabled flow exists (`:45`);
    4. the initiators (`:54-68`);
    5. that no attempt is already open (`:71-84`);
    6. that the flow has stage definitions (`:89`).
  - `ReviewableResource` (`modules/audit/resources.ts:63-89`) has no hook for checking content.
  - The e2e suite depends on this gap. `e2e/specs/audit.order-queue.spec.ts:122-136` creates one order per trade with only `{owningBranchId, mbl, businessType, orderSource}` and submits each one. `audit.review-queue.spec.ts:115-130` does the same.

- **`nct-job-shape`, part 2: confirmed. Order status is free text.**
  - UI: a plain box, `["status", "Order status"]` at `order-form.tsx:358`. The comment at `:346-357` explains why it moved there.
  - API: `status: z.string().max(200).nullish()` (`:305`), with the rationale at `:295-304`.
  - DB: a bare `status: text("status")` (`packages/db/src/schema/collective-order.ts:286`) with no `$type` and no CHECK constraint.
  - `statusTime` (`schema :315`) is stamped by the server when the status changes (`:2917-2921`).
  - The list filter is also free text: `status: z.string().max(200).optional()` (`:707`), matched as a substring with `ilike` (`:1303`). Each of the nine trade ledgers renders "Order status" as a text filter (for example `order-ledger/configs/land.tsx:1787`).
  - **A second API writer exists.** `updateBatch` (`:2997`) accepts `status` through `batchPatchFields` (built by destructuring `orderFields` at `:348-353`, used as `z.object(batchPatchFields)` at `:3004`) and stamps `statusTime` on each row it changes (`:3066-3077`). No code in `apps/`, `e2e/` or `seed/` calls `collectiveOrder.updateBatch`.
  - **Tests pin free-text values.** `collective-order.guards.test.ts:658` (`"in_transit"`) and `:1031` / `:1038` (`"In transit"`); `collective-order.parity.test.ts:249`, `:262` and `:270` (`"In transit"`, `"Arrived"`); `collective-order.clearing.test.ts:136` (`"in_progress"`).
  - `duplicate` clears `status` and `statusTime` on the copy (`:2698-2699`).
  - `status` is separate from `process` (`schema :72`, `:131`; transition table `PROCESS_TRANSITIONS` at `:578`), from `acceptStatus` (`schema :130`) and from `orderAuditStatus` (`schema :337`). This plan changes only `status`.

- **What eyun does with status.**
  - eyun's status is a **flow template chosen by the tenant**, with milestone nodes ticked by hand. See `docs/reference/eyun-behaviour-capture-2026-07-29.md:243-254` ("Status flows are configurable named templates, not a fixed enum").
  - The default sea-export chain runs 已订舱 → 已配舱 → 拖车已安排 → 已进港 → 海关已放行 → 码头已放行 → 已上船 → 已签单 → … → 应收已录入 / 应付已录入, with a timestamp per node. Chains differ per template (`docs/reference/eyun-manual-2025-03-findings.md:615-617`).
  - The parity table rates templates "weeks" of work (`:529`).
  - `docs/plans/parity90/ledgers/sea-export.md:188` records "eyun's value set uncaptured" for the other trades.
  - **Only the sea-export chain has been captured, and it contains a gap ("…").** Any vocabulary for the other eight trades is a proposal, not a copy of eyun (D3).

- **`nct-haulage`: confirmed, with one correction.**
  - **The truck map.** It is `apps/web/src/routes/_next/tracking.tsx` over `packages/api/src/routers/tracking.ts` (`snapshot` `:22`, `history` `:96`, both `requireNode(TRACKING.read)`). The permission module declares `tracking.read` only (`modules/tracking/permissions.ts`).
  - **Ingest.** `packages/api/src/lib/fleet-poll.ts`, `fleet-ingest.ts` and `fleetmy-client.ts`.
  - **Tables.** `fleet_devices`, `fleet_positions_latest` and `fleet_positions_history` (`packages/db/src/schema/fleet.ts`). All three are keyed on `(organization_id, account_id, device_id)`, with no surrogate id and no order column.
  - **Correction: there is no vehicle-type entity.** `FLEET_VEHICLE_TYPES` (`lib/fleet-status.ts:47`) is a list of words that `parseVehicleType` (`:74`) reads out of FleetMy's free-text `description`. It surfaces as `vehicleType` at `tracking.ts:73`.
  - **No driver, dispatch, leg or proof-of-delivery table exists** in `packages/db/src/schema`. The `group_dispatch` order source (`schema :60-70`) is an eyun label, not an entity.
  - **The order's truck fields are free text.** `fleetWarehouse`, `vehicle`, `vehicleNo` and `vehicleVolume` (`schema :224-227`; form `:385-387`) are one set per order, and nothing joins them to `fleet_devices`.
  - **The Logistics Park C/D batch/vehicle sub-list is marked "DEFERRED — NOT IMPLEMENTED"** at `order-form.tsx:2579-2589`.

- **Adjacent defects on the same code paths** (none is in the tracker):
  1. **No order writer checks for an open review.**
     - Affected writers: `update` (`:2847`), `saveChildren` (`:3954`), `setAbnormalTags` (`:4729`), `assignNumber` (`:2770`) and `updateBatch` (`:2997`).
     - Only `assertPostApprovalEditable` is imported (`:16`), and it is called at `:2800`, `:2892` and `:4756`.
     - The helper `assertNotUnderReview` (`modules/audit/gates.ts:130`) exists. The fee-template update calls it in the intended position, after the scoped load and before the post-approval check (`routers/quotation.ts:980-983`).
     - Without this freeze, a readiness check can be defeated: submit a complete order, then clear its fields. → D5.
     - A second web caller of `saveChildren` exists besides the edit form: the fees page `apps/web/src/routes/_next/order.$orderId.expenses.tsx:598`, which sends `costs` alone (docblock at `:51`: "`saveChildren` reconciles the order's ENTIRE cost set"). A freeze on all of `saveChildren` would block fee entry under review; step 15 D2-B exempts a costs-only call for that reason.
     - `REVIEWABLE_RESOURCES.collective_order.exists` (`modules/audit/resources.ts:204-215`) takes no lock, and `submitForReview`'s open-attempt SELECT (`submit.ts:71-84`) takes none either. Step 15 D10-A adds `.for("update")` to that `exists`, the pattern step 08 Task 1.2 sets for `quotation.exists`.
  2. **`saveChildren` and `updateBatch` skip the post-approval freeze** that `update` applies (`:2892`). Approved orders therefore keep editable containers, cargo and fees unless a tenant ticks the gates, and the seeded order flow has `gates: []` (`modules/audit/seed.ts:150`). That is step 15's gate work; see §7.
  3. **The legacy `collectiveOrder.review` (`:3380`) and `reviewBatch` (`:3487`)** move an order `draft → pending` without filing an `audit_submission`. They are allow-listed at `packages/api/src/architecture.test.ts:494` and `:876`, and no code in `apps/`, `e2e/` or `seed/` calls them. A readiness check placed only in the engine can be skipped over RPC by anyone holding `collectiveOrder.review`, which includes ops (`roles.ts:166`). → D7.
  4. **Saving an order is not atomic.** `onSave` makes separate calls: `update`/`create` (`order-form.tsx:1644` / `:1646`), then `saveChildren` (`:1733`), then `setAbnormalTags` (`:1762`). Readiness must therefore be judged on the **stored** order and its stored children at submit time, never on a form payload.
  5. **Masking interacts with required fields.** `stripDeniedFields` (`:2907`) silently drops fields the caller cannot read, such as `clientName`. A caller who cannot see a masked field cannot fill it, so it must never be required on create or update. It can be required at submit, where the stored row is read. → D1.
  6. **A cosmetic label bug.** The container editor label is the JS string `"Containers (case type &amp; TEU)"` (`order-form.tsx:2590`), so it renders `&amp;` literally. The SOP golden path calls this out. It is the only occurrence in `apps/` or `e2e/`.
  7. **Minor, step 12's domain.** `update` writes `jobNumber` without `normaliseJobNumber` (the helper is defined at `:2298`; `update` builds `values` at `:2915` and writes them with `.update(collectiveOrder).set(values)` at `:2933-2935`), unlike create and duplicate. Not taken.

- **What a converted order already carries.** `convertToOrder` (`routers/quotation.ts:3887`) inserts `clientName`, `clientCompanyId`, `entrustUnit`, `tradeTerms`, `bookingAgent`, `shipCompany`, `portOfShipment`, `portOfDestination`, the totals and `operationPersonnel: q.quotationStaff` (`:3971-4010`), then copies the containers. So a sea-export order converted after step 11 Phase 2 lacks only vessel, voyage and ETD under the D2-A rule set.

- **The web surfaces a refusal without changes.** The ledger row's `<ReviewMenu>` (`order-ledger/order-row-actions.tsx:135`) calls `client.auditReview.submit` (`apps/web/src/lib/audit-review.ts:38`) and toasts `Refused — ${msg}` (`components/review-menu.tsx:117`). A server refusal with a clear sentence therefore reaches the operator without any web change.

- **Architecture gates.**
  - `apps/web/src/architecture.test.ts:531-560` parses the `const orderFields = {` literal and fails if any key (including `status`) is not quoted somewhere in `order-form.tsx`. A `status` select built with `enumSelect("status", …)` keeps the key quoted.
  - `packages/api/src/architecture.test.ts:491-503` lists the order writers. This plan adds guard calls but no new write sites, so no allow-list entries change.

- **Migration state.** The journal ends at idx 64, `0065_quotation_send_decision`, and `0065_quotation_send_decision.sql` is the last file on disk. Nothing is pending. Reserved numbers: 0066 (step 01), 0067 (02), 0068 (04), 0069–0072 conditional (05–08), 0073 (09), 0074 (10). **This plan needs no migration under the chosen options.** D3-B (a CHECK constraint), D6-C (fleet link columns) or D8-B (an `audit_flow` column) would add one, named `00NN_<name>` and numbered at merge (`steps-12-15-crosscheck.md` X14).

- **Seed.** `seed/operations.ts` creates orders through `collectiveOrder/create` (`:265`) or a raw SQL insert just above it (`:247-258`), then adds children through `collectiveOrder/saveChildren` (`:288`; two container lines and one cargo line per order, `:288-307`). Neither path sets `status`.
  - **The seeder submits orders.** `seed/run-operations.ts:107-111` calls `submitForReview(who.cookie, "collective_order", mine.slice(0, 6)…)` and exits 1 on any failure (`:130`). The shared order `values` (`seed/operations.ts:213-231`) carry `jobNumber`, `clientName`, `etd`, `eta` and both ports, but no `operationPersonnel`, `vesselName` or `voyage`. Under D2-A every one of those six submissions is refused, and seeding a demo or QA org aborts. Task 1.3 fixes the seed.

---

## 1. Overview

**Problem.** An order can be submitted for review, and approved, with no client, no vessel, no ports and no cargo. Once submitted, it can still be edited while the reviewer is looking at it. Its "Order status" is whatever someone typed, so the ledgers cannot filter or count orders by where the shipment actually is.

**Goals.**
- **Phase 1 (`nct-job-shape`, review side):** submitting an order that lacks the basic details of a shipment is refused, and the message names what is missing. An order under review cannot be edited until it is withdrawn or decided.
- **Phase 2 (`nct-job-shape`, form side):** while filling in the form, operations can see what is still missing before the order can go for review.
- **Phase 3 (`nct-job-shape`, status):** "Order status" is chosen from the milestone list for the order's trade, and the ledgers filter by it exactly.

**Success criteria.**
- `auditReview.submit` on a sea-export order with no vessel returns CONFLICT with a message such as _"This order cannot go for review yet. Missing: Vessel name, Voyage, ETD."_ No `audit_submission` row is written, and `order_audit_status` stays `draft`.
- A complete order submits exactly as it does today.
- While an order's latest submission is `under_review` or `withdrawal_under_review`, its content writers return CONFLICT with the existing sentence _"This record is under review and cannot be edited. Retract the submission first."_ (`gates.ts:139-141`). **Delivered by step 15 Phase 1** (prerequisite under D5-C, Decided; with step 15's D2-B costs-only exemption); step 14 re-walks it as a regression check.
- Running the operations seeder (`seed/run-operations.ts`) still submits its six orders and exits 0.
- The edit form shows a "Before review" panel listing the missing fields, and each rail section with a missing field shows a marker. Both update as the operator types.
- The Order status control is a dropdown of the trade's milestones. A status outside the list is refused on create, update and updateBatch. A legacy free-text value already stored still displays and is never rewritten unless someone changes it (D4-A).
- A draft stays free: any combination of fields still **saves** (D1-A).

**In scope.**
- `modules/collective-order/job-shape.ts` [NEW], a pure rule set shared by the server and the web.
- The `collective_order` implementation of step 07's `ReviewableResource.assertPublishable?` hook (D10-A, X9): a read-only readiness check that throws CONFLICT. No new interface member and no `submit.ts` edit.
- A real-Postgres concurrency test proving readiness holds when a submit races an edit that clears a required field: one `describe` added to `collective-order.concurrency.test.ts` [NEW in step 15] (D11-A, X8).
- The fixtures in api tests, e2e specs and the operations seeder that submit incomplete orders.
- The form's readiness panel and rail markers.
- The `&amp;` label fix (one string in a file Phase 2 already owns).
- `modules/collective-order/order-status.ts` [NEW] (the vocabulary), zod validation on the three writers, the form dropdown, and the nine ledger filters.
- Read-only production probes for Wilfred.

**Out of scope.**
- **Haulage entities.** Drivers, dispatch, legs, proof of delivery, a truck-to-job link and the Logistics Park C/D batch/vehicle sub-list go to step 19 (D6-A).
- **Configurable status templates, per-milestone timestamps and operation alerts** (eyun 操作预警). These are rejected in D3; each is weeks of work.
- **Step 15 work.** The under-review freeze on order writers and the submit/save row lock (D5-C; step 15 D1, D2, D10), deleting `collectiveOrder.review` / `reviewBatch`, the order self-approval rule, ticking order gates (`seed.ts:150`), and the missing post-approval freeze on `saveChildren` / `updateBatch` (D7).
- **Linking desk roles to members** (the SOP watch). This is later work that can reuse step 05's `MemberNameSelect` [NEW in step 05].
- **Normalising `jobNumber` on update** (step 12).
- **Making save atomic** (adjacent defect 4). Readiness reads stored data, so this plan does not need it.
- **Submit-time order state** (archived, not received, rejected at intake), keeping rejected orders out of the ledgers, and SOP text for steps 14–15. Step 13 D4-A handed the first to step 14, but `steps-12-15-crosscheck.md` X13 (settled 2026-09-17) leaves all three **unowned**, recorded as accepted known gaps.

**Input Gate.** No Input Gate was held; Wilfred accepted every recommendation on 2026-09-17 (§9).

**Decisions (settled 2026-09-17)** (each Decided in §9 with the recommended option; probe re-checks noted there still apply):
- Readiness is enforced when an order is submitted for review, never when it is saved → D1 (A)
- The required set is a small core plus a few fields per trade, kept as data in one file → D2 (A; re-check P3/P4 and operations input before Task 1.1)
- Status is a code-owned milestone list per trade, stored as a key in the existing text column → D3 (A; re-check P1 and operations input before Task 3.1)
- Legacy status values stay as they are until someone changes them → D4 (A; re-check P1 before Task 3.2)
- Step 15 Phase 1 owns the under-review freeze and the lock in `collective_order.exists`, and merges before step 14 Phase 1 → D5 (C; crosscheck X6)
- Haulage gets nothing structural in step 14 → D6 (A)
- The legacy review verbs stay until step 15 deletes them → D7 (A)
- The readiness rule applies to every order submission in every org → D8 (A; re-check P5 before Task 1.2)
- Readiness is shown on the form panel and in the ledger's refusal toast only → D9 (A)
- The readiness check implements step 07's `assertPublishable?` member rather than adding a new one → D10 (A; crosscheck X9)
- Step 15 creates the shared concurrency test file and step 14 adds a `describe` to it → D11 (A; crosscheck X8)
- The readiness rules live in one pure module under `packages/api/src/modules/collective-order/`, imported by the web through the `"./*"` export → D12 (A)
- The status value check sits in the `create` / `update` / `updateBatch` handlers after the scoped load, not in zod → D13 (A)
- The ledger status filter matches known keys exactly and keeps `ilike` for any other text → D14 (A)
- Phase 3's server and web ship in one release, with the old-tab refusal accepted → D15 (A)

## 2. User Journeys

**Journey 1 (changed): Operations submit an order that is not ready**
Trigger: a sea-export order converted from a quotation has client, ports and containers, but no vessel, voyage or ETD. Operations try to send it for review.
Steps:
1. Operations open `/order/sea-export` → the row shows Audit status **Draft** (unchanged).
2. They open the row's **Review this order** menu and choose **Submit for review** → the server loads the stored order and counts its container and cargo lines. `missingForReview` returns Vessel name, Voyage and ETD.
3. Toast: _"Refused — This order cannot go for review yet. Missing: Vessel name, Voyage, ETD."_ No submission is written, and the row still reads **Draft**.
4. They open the order, fill in the three fields, save, and submit again → toast _"1 row — submit for review"_ (the existing wording). The row reads **Pending**.
5. Flow ends: the order is in `/approve/order` for accounting.

Where it lives: the existing ledger row menu. The refusal is the existing toast. No new screen.

Old journey, for contrast: step 3 succeeded, and the reviewer received an order with no vessel.

**Journey 2 (new refusal, delivered by step 15 Phase 1 under D5-C): Someone edits an order that is under review**
Step 14 does not build this journey (D5-C, Decided); it is listed because the readiness guarantee in Journey 1 relies on it, and §10 re-walks it. Fees on `/order/$orderId/expenses` stay writable while the order is under review (step 15 D2-B).
Trigger: an order was submitted this morning. An operator still has its edit form open in another tab and changes the ETD.
Steps:
1. They press **Save** on `/order/$orderId/edit` → `collectiveOrder.update` finds the latest submission `under_review`.
2. Toast (from the existing `catch` in `onSave`): _"This record is under review and cannot be edited. Retract the submission first."_ Nothing is written, and the form keeps the typed values.
3. They go back to the ledger → **Review this order** → **Request withdrawal** (the existing verb; the seeded flow's `withdrawalMode: "direct"` retracts at once, `seed.ts:147`) → edit and save → submit again.
4. Flow ends: the reviewer sees the order as it was when it was last submitted.

Where it lives: the existing edit form and row menu. No new screen.

**Journey 3 (new): Operations see what is missing while filling in the form**
Trigger: operations open `/order/$orderId/edit` or `/order/new?type=sea_import`.
Steps:
1. Above the section rail, a **Before review** panel reads _"Missing before review: Client, Port of shipment, ETA, at least one container line"_. The **Business information**, **Shipping space** and **Cargo & fees** rail items each show a small amber dot.
2. The operator picks the client in **Business information** → "Client" leaves the list and that rail dot clears, with no save needed.
3. They add a container line in **Cargo & fees** → the "container line" item clears.
4. When nothing is missing, the panel reads **Ready for review** in muted text.
5. They press **Save** → toast **Order updated**, and they land on the ledger (unchanged). Saving never requires the list to be empty.
6. Flow ends: the order is ready for Journey 1 step 4.

Where it lives: inline on the existing order form, above the rail. No dialog, no new route.

**Journey 4 (changed): Operations record where the shipment is**
Trigger: the carrier confirms the booking.
Steps:
1. On `/order/$orderId/edit`, **Business information → Order status** is now a dropdown listing the sea-export milestones (Booked, Space allocated, Haulage arranged, …).
2. They choose **Booked** and save → toast **Order updated**. The server checks that `booked` belongs to `sea_export` and stamps `statusTime` (unchanged rule).
3. On `/order/sea-export`, the **Order status** filter is a dropdown of the same list. Choosing **Booked** shows exactly the orders at that milestone, not orders whose typed text merely contains "book".
4. An old order whose status was typed as "In transit" shows that text in the column and in the form, labelled _"In transit (old value)"_ in the dropdown's trigger. Saving the form without touching status leaves it as it is (D4-A).
5. Flow ends: the status column holds a key from a known list.

Where it lives: the existing form field and the existing ledger filter slot.

**No journey for haulage.** Under D6-A nothing user-visible changes for trucks in step 14.

## 3. Result (What Changes for the User)

**Before:** Any order can be submitted and approved whatever it contains, and it stays editable while the reviewer looks at it. Order status is a free-text box, and its filter is a substring search.
**After:** An order must have its client, route, schedule and cargo before it can be submitted, the form shows what is still missing, a submitted order is frozen until it is withdrawn or decided, and status is picked from the trade's milestone list.
**Key differences:**
- Operations: **Submit for review** names the missing fields instead of succeeding, and the edit form shows a "Before review" panel with markers on the rail.
- Operations: saving an order that is under review is refused with a sentence saying to retract first (step 15 Phase 1, a prerequisite). Fees can still be entered.
- Operations: Order status is a dropdown, and the ledger filter matches it exactly.
- Accounting (reviewers): every order that reaches `/approve/order` has the basic details of a shipment, and it cannot change under them.
- Nobody: saving a draft is unchanged. Nothing about trucks changes.

## 4. Technical Architecture

### Data flow

```
Ledger row → ReviewMenu → auditReview.submit({resourceType:"collective_order", resourceId})
  submitForReview(tx, org, input)                         modules/audit/submit.ts
  ├─ submitNode permission                                (unchanged)
  ├─ entry.exists                                         [step 15 Task 1.3, D10-A] collective_order row .for("update")
  ├─ [step 08 Task 3.2] post-approval refusal             (lands before this plan)
  ├─ enabled flow · initiators · open attempt             (unchanged)
  ├─ entry.assertPublishable?.(tx, orgId, resourceId)     [step 07 Phase 3 call] step 14 implements it (D1-A, D10-A) → CONFLICT, nothing written
  │     collective_order: plain read (no lock; the row is already locked by exists)
  │                       order row (org-keyed) + count container / cargo lines
  │                       → missingForReview(row, counts)  modules/collective-order/job-shape.ts [NEW]
  ├─ stage definitions                                    (unchanged)
  └─ insert audit_submission … repaintCache               (unchanged)

decide (final pass)                                        [step 07 Phase 3] re-calls entry.assertPublishable?
  collective_order: same readiness read → an incomplete order already under review cannot be approved until withdrawn and completed

Order writers (update, assignNumber, setAbnormalTags, delete, updateBatch, batch delete, saveChildren content arrays)
  [step 15 Phase 1, prerequisite under D5-C]
  scoped load .for("update") → assertNotUnderReview → assertPostApprovalEditable → locked → write
  saveChildren({costs}) alone is not frozen (step 15 D2-B)

OrderForm (web)
  form state + containers/cargo arrays → missingForReview(...)  (same pure module)
  → "Before review" panel + rail dots (Phase 2)
  status: enumSelect("status", orderStatusOptions(businessType, stored))  (Phase 3)
```

### Data model

**No schema change under the chosen options.**
- `collective_order.status` stays `text`. Phase 3 narrows it in TypeScript only, through the shared vocabulary; the column keeps no `$type` so legacy strings still type-check on read.
- Under D3-B a CHECK constraint would be added, which needs a backfill first (probe P1).
- Under D6-C, nullable `fleet_account_id text` and `fleet_device_id text` would be added (composite reference, no FK, because `fleet_devices` has a composite primary key, `schema/fleet.ts`).

### Readiness rule set: `modules/collective-order/job-shape.ts` [NEW] (Phase 1)

A pure module with no drizzle or oRPC imports, so the web can import it (the precedent is `@nct-ai/api/modules/expense/bridge`). Needed by Journey 1 step 2 and Journey 3 steps 1–4.

```ts
import type { BusinessType, ConsignType } from "@nct-ai/db/schema/collective-order"; // type-only

export type ReadinessSection = "business" | "shipping" | "internal" | "lines"; // = order-form SECTIONS ids

/** The stored fields the rules read. Dates arrive as Date (server) or string (form). */
export type ReadinessOrder = {
  businessType: string;
  consignType: string | null;
  jobNumber: string | null;
  clientName: string | null;
  clientCompanyId: string | null;
  operationPersonnel: string | null;
  portOfShipment: string | null;
  portOfDestination: string | null;
  vesselName: string | null;
  voyage: string | null;
  etd: Date | string | null;
  eta: Date | string | null;
};
export type ReadinessLines = { containerLines: number; cargoLines: number };

export type MissingItem = { key: string; label: string; section: ReadinessSection };

/** Data, not code: one row per requirement, so D2 changes are one-line edits. */
export const REVIEW_REQUIREMENTS: Readonly<Record<BusinessType, readonly Requirement[]>>;

export function missingForReview(order: ReadinessOrder, lines: ReadinessLines): MissingItem[];

/** "This order cannot go for review yet. Missing: Vessel name, Voyage, ETD." */
export function readinessMessage(missing: readonly MissingItem[]): string;
```

Rules: a text field counts as present when `trim() !== ""`. The client counts as present when `clientCompanyId` is set **or** `clientName` is not blank, because legacy rows carry only the name. Labels match the form's labels (`order-form.tsx` field tables), so the message and the form name a field the same way.

**Required set (D2-A, Decided 2026-09-17; re-check against probes P3/P4 and operations input before Task 1.1, and if they contradict it, stop and re-plan):**

| Trade | Core (all trades) | Route and schedule | Cargo |
|---|---|---|---|
| `sea_export` | Job Number · Client · Operation Personnel | Port of shipment · Port of destination · Vessel name · Voyage · ETD | FCL: ≥1 container line. LCL/bulk: ≥1 cargo line |
| `sea_import` | same | Port of shipment · Port of destination · Vessel name · Voyage · ETA | same as sea_export |
| `lcl` | same | Port of shipment · Port of destination · Vessel name · Voyage · ETD | ≥1 cargo line |
| `air_export` | same | Port of shipment · Port of destination · Voyage (Flight No., `order-form.tsx:263-267`) · ETD | ≥1 cargo line |
| `air_import` | same | Port of shipment · Port of destination · Voyage (Flight No.) · ETA | ≥1 cargo line |
| `road`, `domestic_water` | same | Port of shipment · Port of destination · ETD | ≥1 container or cargo line |
| `logistics_park_cd` | same | none (shipping keys are excluded, `order-form.tsx:280-287`, `LOGISTICS_EXCLUDED_SHIPPING_KEYS`) | ≥1 cargo line |
| `rail` (retired) | same | none | none |

Job Number is in the core because the SOP's step 14 precondition is "The order has a job number (step 12)", and step 11 Phase 2 makes conversion allocate one. In an org without a `job` sequence, the operator types one or uses **Assign number** (`assignNumber`, `:2770`).

### Engine hook: step 07's `ReviewableResource.assertPublishable?` (Phase 1, D10-A)

Needed by Journey 1 steps 2–4.

**Shape (D10-A, Decided 2026-09-17; crosscheck X9).** Step 07 Task 3.3 adds `assertPublishable?(tx, organizationId, resourceId): Promise<void>` to `ReviewableResource` and calls it in `submitForReview` and at the final pass in `decide`. The 04–10 runbook rule is that later engine hooks reuse it. Step 14 implements `assertPublishable` on the `collective_order` entry, throwing CONFLICT with `readinessMessage(...)`, and adds **no interface member and no `submit.ts` edit**. `assertPublishable` does not exist at HEAD (grep this pass); it arrives with step 07 Phase 3. Re-check before Task 1.2: step 07's submit call sits after the open-attempt check (`submit.ts:71-84`) and before the stage lookup; if it does not, stop and re-plan. (D10-B's separate `readinessProblem?` member is recorded in §9 as a rejected alternative.)

**Side effect of D10-A (accepted).** Because step 07 also calls `assertPublishable` at the final pass in `decide`, an incomplete order that is already under review on deploy day cannot be approved: the reviewer's approve is refused with the missing list, and the order must be withdrawn, completed and resubmitted. Probe P5/P6 size how many orders this affects.

```ts
// modules/audit/resources.ts, REVIEWABLE_RESOURCES.collective_order
async assertPublishable(tx, organizationId, resourceId) {
  const missing = missingForReview(await loadReadinessOrder(tx, organizationId, resourceId), await countLines(tx, resourceId));
  if (missing.length > 0) throw new ORPCError("CONFLICT", { message: readinessMessage(missing) });
}
```

- The member is optional on the interface (step 07), so the other entries need no edit.
- The `collective_order` entry (`:201`) implements it with three queries:
  1. the order row, projected to the `ReadinessOrder` columns, filtered by `id` **and** `organizationId`;
  2. `count(*)` from `collective_order_container` where `order_id`;
  3. `count(*)` from `collective_order_cargo` where `order_id`.

  Both child tables are indexed on `order_id` (`schema/collective-order.ts:399` and `:437`). The result is `missingForReview(...)`, mapped through `readinessMessage` when the list is not empty.
- **The hook takes no lock.** Serialisation comes from `REVIEWABLE_RESOURCES.collective_order.exists` loading the row `.for("update")` (step 15 Task 1.3, step 15 D10-A, copying step 08 Task 1.2's `quotation.exists`; X6). `submitForReview` calls `exists` at `submit.ts:39`, before the open-attempt check, so by the time the hook reads, the transaction already holds the order row and every frozen writer (which also locks the row, step 15 Task 1.3) waits. The child counts are safe too: container and cargo writes go through `saveChildren`, whose load takes the same row lock.
- `submitForReview` (step 07's call) runs it after the open-attempt check (`submit.ts:71-84`) and before the stage lookup (`:89`). A duplicate submit still reads "already under review", and a refusal happens before any insert, so nothing needs rolling back.

- CONFLICT matches every other state refusal in this function (`:47`, `:83`, `:90`). The codebase never uses `PRECONDITION_FAILED` (grep: 0 non-test hits).

### Under-review freeze and submit lock (owned by step 15 Phase 1, D5-C)

**One owner.** Step 15 §4.1 and Tasks 1.1–1.4 already specify the freeze and the lock in full, step 12 D5-A names step 15 as owner, and `steps-12-15-crosscheck.md` X6 settled it that way (Wilfred, 2026-09-17). Under D5-C (Decided), step 14 writes **no** guard and **no** lock in `routers/collective-order.ts` or `resources.ts`, and step 14 Phase 1 lists step 15 Phase 1 as a prerequisite. What step 14 relies on, by symbol:

| Step 15 item | What step 14 relies on |
|---|---|
| Task 1.2 / D1-A: `assertNotUnderReview` in `update`, `assignNumber`, `setAbnormalTags`, `delete`; `assertNoneUnderReview` [NEW in step 15] in `updateBatch` and `batch` delete | A submitted order's header fields cannot be cleared before decision |
| Task 1.2 / D2-B: `saveChildren` checks only when `containers`, `cargo` or `appendages` are sent | Container and cargo counts cannot drop to zero under review; fee entry on `order.$orderId.expenses.tsx:598` keeps working |
| Task 1.3 / D10-A: `.for("update")` on the handlers' scoped loads (batch loads `.orderBy(collectiveOrder.id)` first) and on `REVIEWABLE_RESOURCES.collective_order.exists` (`resources.ts:204-215`) | Submit and edit serialise on the order row before the readiness read |
| Task 1.4: `collective-order.under-review.test.ts` [NEW in step 15], including `saveChildren({costs})` succeeding under review | The freeze is proven once, by step 15's suite; step 14 does not duplicate it |

**Rejected alternative D5-A** (step 14 owns it; kept for the record): step 14 would have adopted step 15 §4.1 verbatim, not the earlier five-writer shape: the D2-B costs-only exemption, the lock in `collective_order.exists` (the readiness hook stays a plain read), `.orderBy(collectiveOrder.id).for("update")` on `updateBatch`'s multi-row load (`routers/collective-order.ts:3046-3049` at HEAD has no `orderBy`), `delete` and `batch` delete, and the two `…Many` helpers. Step 15 then drops its Tasks 1.1–1.4 and depends on step 14 Phase 1, and step 12 D5 is re-pointed to step 14. The chosen D5-C is written into all three plans (12 D5, 14 D5, 15 D1/D10 and §7.6) before either plan executes.

`transition`, `receive`, `reject` and the legacy review verbs are not frozen by either plan; lifecycle and intake verbs are step 15 D1-C's rejected option.

### Status vocabulary: `modules/collective-order/order-status.ts` [NEW] (Phase 3, D3-A)

Needed by Journey 4 steps 1–3.

```ts
export type OrderStatusOption = { value: string; label: string };
/** Ordered milestone list per trade. Keys are stable snake_case; labels are English UI copy. */
export const ORDER_STATUS_VALUES: Readonly<Record<BusinessType, readonly OrderStatusOption[]>>;
export function isOrderStatusFor(businessType: string, value: string): boolean;
/** For the form: the trade's list, plus the stored legacy value (flagged) when it is not in the list. */
export function orderStatusOptions(businessType: string, stored: string | null): (OrderStatusOption & { legacy?: true })[];
export function orderStatusLabel(businessType: string, value: string | null): string | null;
```

**Vocabulary (D3-A, Decided 2026-09-17; re-check against probe P1 and operations input on the non-sea chains before Task 3.1, and if they contradict it, stop and re-plan):**

| Trade | Milestones, in order | Source |
|---|---|---|
| `sea_export` | `booked` Booked · `space_allocated` Space allocated · `haulage_arranged` Haulage arranged · `gated_in` Gated in · `customs_released` Customs released · `terminal_released` Terminal released · `loaded` Loaded on board · `bl_signed` B/L signed · `receivables_entered` Receivables entered · `payables_entered` Payables entered | eyun default chain (`eyun-manual-2025-03-findings.md:617`). The nodes behind eyun's "…" are uncaptured |
| `lcl` | as `sea_export` | proposal |
| `sea_import` | `arrival_notice` Arrival notice received · `do_collected` Delivery order collected · `customs_released` Customs released · `haulage_arranged` Haulage arranged · `delivered` Delivered · `receivables_entered` · `payables_entered` | proposal, not captured |
| `air_export` / `air_import` | `booked` · `customs_released` · `departed` Departed · `arrived` Arrived · `delivered` · `receivables_entered` · `payables_entered` | proposal |
| `road` / `domestic_water` / `rail` / `logistics_park_cd` | `booked` · `haulage_arranged` · `picked_up` Picked up · `delivered` · `receivables_entered` · `payables_entered` | proposal |

This is a **current milestone**, one value, as today's single column is. eyun's per-node timestamps and multi-tick stepper are not modelled (D3).

### API contracts

- **`auditReview.submit`** (input and output unchanged; Journey 1 steps 2–4). New refusal: CONFLICT with `readinessMessage(...)` when `resourceType = "collective_order"` and the stored order is not ready. The refusal order is NOT_FOUND → [step 08 post-approval] → no flow → initiator → already under review → **not ready** → no stages.
- **Order writers' under-review refusals** (Journey 2): specified by step 15 §4.6 and not changed by step 14 (D5-C).
- **Phase 3, `status` on `create` / `update` / `updateBatch`** (Journey 4 steps 2 and 4):
  - The `orderFields.status` shape stays `z.string().max(200).nullish()`, so the web architecture parse and `batchPatchFields` keep their shape.
  - Each handler adds a check after the scoped load: when `status` is a non-null string that differs from the stored value, it must satisfy `isOrderStatusFor(effectiveBusinessType, status)`. Otherwise BAD_REQUEST _"Order status must be one of the Sea Export milestones: Booked, Space allocated, …. If you see a text box for Order status, reload the page."_ (the last sentence covers a tab opened before the release, §7 Deployment coupling).
  - `effectiveBusinessType` is `rest.businessType ?? existing.businessType` on `update`, the input `businessType` on `create`, and each row's `businessType` on `updateBatch` (a mixed-trade batch is checked per row, and any failure refuses the whole batch).
  - Validation sits in the handler, not in zod, because the allowed set depends on the stored row (D4-A lets an unchanged legacy value through).
- **Phase 3, `collectiveOrder.list` filter** (Journey 4 step 3; D14): `status` input is unchanged. In `buildOrderConditions`, when `input.status` is a known key in any trade's vocabulary, use `eq(collectiveOrder.status, input.status)` and remove it from the `likes` array (`:1302-1303`). Otherwise keep the `ilike`, so old bookmarked searches for legacy text still work.

### Web

- **Phase 2.** `apps/web/src/components/order-ledger/order-readiness.tsx` [NEW] exports `OrderReadinessPanel({ missing })` and `sectionsWithMissing(missing): Set<ReadinessSection>`. In `order-form.tsx`:
  - `useMemo` over `form`, `containers.length` and `cargo.length` (state at `:854-855`) calls `missingForReview`. Blank container and cargo rows (every cell empty) are not counted.
  - The panel renders above the rail.
  - `SECTIONS` rail items (`:1289`) get a dot when `sectionsWithMissing` contains their id. `clientName` and `jobNumber` map to `business`, `operationPersonnel` to `internal`, and line counts to `lines`.
  - `onSave` is unchanged (D1-A).
- **Phase 3.** In `order-form.tsx`:
  - remove `["status", "Order status"]` from `TEXT_FIELDS` (`:358`) and render `enumSelect("status", orderStatusOptions(form.businessType, loaded status), "Order status")` in Business information;
  - add `"status"` to `SELECT_KEYS` (`:433`) so `buildPayload` and the rail keep counting it;
  - update the comment at `:346-357`.

  In each of the nine configs, the Order status filter becomes a select over `ORDER_STATUS_VALUES[<trade>]`, and the column cell renders `orderStatusLabel(...) ?? raw`.

### Key decisions (all Decided 2026-09-17, Wilfred)
- Readiness at submit, not at save or in the DB → D1-A
- Which fields are required per trade → D2-A (re-check P3/P4 and operations input before Task 1.1)
- The status value set → D3-A (re-check P1 and operations input before Task 3.1)
- What happens to legacy status text → D4-A (re-check P1 before Task 3.2)
- Who owns the under-review freeze and the submit lock → D5-C: step 15 Phase 1, merged before step 14 Phase 1 (crosscheck X6)
- Haulage scope → D6-A
- Legacy review verbs left for step 15 → D7-A
- The rule applies to every org and every submission → D8-A (re-check P5 before Task 1.2)
- Readiness shown on the form panel plus the refusal toast only → D9-A
- Engine seam: implement step 07's `assertPublishable?` → D10-A (crosscheck X9)
- Step 15 creates `collective-order.concurrency.test.ts`; step 14 adds a `describe` → D11-A (crosscheck X8)
- Rule set as one pure api module shared with the web → D12-A
- Status validation in the handlers, not zod → D13-A
- Status filter `eq` for known keys, `ilike` otherwise → D14-A
- Phase 3 server and web in one release → D15-A

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- Decisions: all settled 2026-09-17 (§9). Probe re-checks still required: P3 and P4 plus operations input before Task 1.1 (D2), P5 before Task 1.2 (D8). If a probe contradicts the chosen option, stop and re-plan.
- Steps 08 and 10 merged: both edit `modules/audit/resources.ts` and `submit.ts`, and step 08 Task 3.2 places its refusal where this hook's neighbour goes.
- **Step 07 Phase 3 merged** (D10-A): `assertPublishable?` exists on `ReviewableResource` and is called in `submitForReview` after the open-attempt check and at the final pass in `decide`. Grep the base commit for `assertPublishable`; if it is missing, stop.
- Step 11 Phase 2 merged: it moves about 130 lines out of `routers/collective-order.ts` into `modules/collective-order/insert-order.ts` [NEW in step 11], beside this plan's new modules. Step 11 Task 2.4 carries the widened `orderNo` re-stamp (X11).
- Step 12 Phase 1 merged, including Task 1.1's `assignNumber` row lock (X7).
- **Step 15 Phase 1 merged** (D5-C, X6: freeze, `collective_order.exists` lock, its under-review suite, and `collective-order.concurrency.test.ts` [NEW in step 15]). Before Task 1.2, grep the base commit for `assertNotUnderReview` in `routers/collective-order.ts`, for `.for("update")` inside `REVIEWABLE_RESOURCES.collective_order.exists`, and for the concurrency test file; if any is missing, stop (the prerequisite has not landed).
- **Before Wave 6 (X16):** the uncommitted e2e changes in the `nct-layout` working tree are committed, so Task 1.4's edits to `e2e/specs/*` start from a committed base.
- Re-read `collective-order.ts`, `submit.ts` and `resources.ts` **by symbol** at the base commit. Every line number in this plan will have shifted.

### Phase 1: an incomplete order cannot go for review

**Delivers:** Journey 1 end to end through the existing ledger menu. Journey 2 is delivered by step 15 Phase 1 and re-walked here.
**Dependencies:** D1, D2, D5, D8, D10, D11 (all Decided); steps 07 Phase 3, 08, 10, 11 Phase 2, 12 Phase 1 and 15 Phase 1 merged; probes P3/P4/P5 re-checked.

- **1.1** Write `job-shape.ts` with `REVIEW_REQUIREMENTS` per D2, `missingForReview` and `readinessMessage`. Unit tests cover:
  - every trade × complete order → `[]`;
  - each requirement blanked on its own (null, `""`, `"  "`) → exactly that item;
  - client present through `clientCompanyId` only, and through `clientName` only;
  - FCL vs LCL cargo rule;
  - `rail` → core only;
  - an unknown `businessType` string → core only (never throws);
  - message wording and order (form section order).

  Files: `packages/api/src/modules/collective-order/job-shape.ts` [NEW], `packages/api/src/modules/collective-order/job-shape.test.ts` [NEW]. · **Agent A (backend)**
- **1.2** Engine hook (D10-A):
  - implement step 07's `assertPublishable` on `collective_order`, throwing CONFLICT with `readinessMessage(...)`; no interface or `submit.ts` edit;
  - three org-keyed plain reads (no lock; `exists` already holds the row, §4 and §8 item 6), evaluated after the open-attempt check (step 07's call position).

  Engine tests in `audit-review.test.ts`:
  - a sparse order is refused with the missing list, with no submission row and `order_audit_status` still `draft`;
  - a complete order submits;
  - a sparse order in **another org** gets NOT_FOUND, not the list;
  - a `quotation` submission is unaffected by the order readiness rule;
  - D10-A side effect: an incomplete order already under review (submission seeded directly) is refused at the final pass in `decide` with the missing list, and approves after withdrawal, completion and resubmission.

  **Fixture change:** fill `co-sep` (`:265-272`: add `jobNumber`, `clientName`, `operationPersonnel`, and one cargo row, since it is `logistics_park_cd`/lcl), `co-gated` (`:273-282`: add `operationPersonnel`, the sea-export route and schedule, and one container) and `co-export` (`:283-291`, same). The fixtures submitted at `:831`, `:1111` and `:1259` must stay green.

  **Concurrency test:** add one `describe` ("submit vs clear vessel") to `packages/api/src/routers/collective-order.concurrency.test.ts` [NEW in step 15] (D11-A, X8), on the pattern of `expense.concurrency.test.ts` (`describe.skipIf(!TEST_URL)` over `DATABASE_URL_TEST`, real Postgres, `:26-27`, `:65`). Deterministic interleave, repeated for both orders of release:
  1. On connection A, open a transaction and `SELECT … FOR UPDATE` a complete sea-export order.
  2. Fire `collectiveOrder.update({ orderId, vesselName: null })` and `auditReview.submit` for the same order through the router on the pool; neither may resolve while A holds the lock (assert both still pending after a short wait).
  3. Commit A. Await both.
  4. Pass criteria, judged by HTTP result plus final state, never by timestamps: **either** submit returned 200 and update returned CONFLICT (the row still has its vessel and one submission exists), **or** update returned 200 and submit returned CONFLICT naming "Vessel name" (no submission row). Any run with both 200 fails.

  Files: `packages/api/src/modules/audit/resources.ts`, `packages/api/src/modules/audit/submit.ts`, `packages/api/src/routers/audit-review.test.ts`, `packages/api/src/routers/collective-order.concurrency.test.ts` [NEW]. · **Agent A (backend)**

- **1.3** Operations seeder: add `operationPersonnel` (for example `"Seed Ops"`), `vesselName` and `voyage` (for example `` `V${100 + i}` ``) to the shared order `values` object in `seed/operations.ts:213-231`, and add the matching columns to the raw insert for retired trades (`:247-258`), so both paths still read one field set (the file's own comment requires it). Re-check the object against the final `REVIEW_REQUIREMENTS` from Task 1.1: children already give every order two container lines and one cargo line (`:288-307`), and `jobNumber`, `clientName`, `etd`, `eta` and both ports are already set. Acceptance: running the operations seeder against a fresh dev org prints `collective_order submitted 6` and exits 0 (`seed/run-operations.ts:107-130`). Files: `seed/operations.ts`. · **Agent B (test)**

- **1.4** e2e fixtures that submit sparse orders. Build the payload from a shared helper `readyOrderPayload(businessType, seed)` [NEW] in `e2e/fixtures/ready-order.ts`: it fills the D2 fields, and the caller then calls `collectiveOrder/saveChildren` with one container line (sea FCL) or one cargo line (others). Apply it in:
  - `e2e/specs/audit.order-queue.spec.ts` (the loop at `:122-136` and the seam order at `:217-222`);
  - `e2e/specs/audit.review-queue.spec.ts` (`:115-120`);
  - `e2e/specs/audit.post-approval.spec.ts` (`:41-45`; the `:67-71` order is never submitted and stays as it is).

  Add one e2e case in `audit.order-queue.spec.ts`: a bare order's **Submit for review** shows the "Missing:" toast, and the row stays Draft. Files: `e2e/fixtures/ready-order.ts` [NEW], the three specs. · **Agent B (test)**

**Acceptance.**
- On `/order/sea-export`, **Submit for review** on an order with no vessel toasts the missing list, and the row stays Draft. After filling the fields it submits (Journey 1).
- Regression (Journey 2, step 15's guard): saving an order under review still toasts the retract sentence, and after **Request withdrawal** the save succeeds.
- The operations seeder submits its six orders and exits 0 (Task 1.3).
- `collective-order.concurrency.test.ts` passes against `DATABASE_URL_TEST` (the run must show the suite executed, not skipped).
- These pass, judged by reading the output for `failed`: `job-shape.test.ts`, `audit-review.test.ts`, `collective-order.under-review.test.ts` (step 15's suite, re-run unchanged), `collective-order.guards.test.ts`, `collective-order.numbering.test.ts`, `collective-order.clearing.test.ts`, `modules/audit/seed.test.ts`, the api `architecture.test.ts`, and the three e2e specs.

### Phase 2: the form shows what is missing before review

**Delivers:** Journey 3 end to end.
**Dependencies:** Phase 1 merged (it imports `job-shape.ts`); D9-A (Decided 2026-09-17).

- **2.1** Write `order-readiness.tsx`, with the panel and `sectionsWithMissing`. Test it with the rendering pattern of `apps/web/src/components/order-ledger/accept-status-tabs.test.tsx` (`renderToStaticMarkup` from `react-dom/server`, a `.tsx` file): an empty list renders "Ready for review", three items render three names, and the section mapping is correct. Files: `apps/web/src/components/order-ledger/order-readiness.tsx` [NEW], `apps/web/src/components/order-ledger/order-readiness.test.tsx` [NEW]. · **Agent C (frontend)**
- **2.2** Wire the panel into `order-form.tsx`:
  - a `useMemo` over form state and non-blank container and cargo rows;
  - render the panel above the rail;
  - add the rail dot with `aria-label="Missing details for review"`;
  - fix the label at `:2590` to `"Containers (case type & TEU)"`.

  `onSave` is unchanged. Files: `apps/web/src/components/order-form.tsx`. · **Agent C (frontend)**

**Acceptance.**
- On `/order/new?type=sea_import`, the panel lists the core and sea-import items. Filling each one removes it without saving, and the rail dots clear section by section.
- A form with items still missing saves with **Order updated** / **Order created**.
- The containers header reads "Containers (case type & TEU)".
- `bun run check-types` and `order-form.payload.test.ts`, `order-form-retired-type.test.ts`, `apps/web/src/order-form-clearing.test.ts` and `apps/web/src/architecture.test.ts` pass, judged by reading the output.

### Phase 3: order status comes from the trade's milestone list

**Delivers:** Journey 4 end to end.
**Dependencies:** Phase 2 merged (the same `order-form.tsx`); D3-A and D4-A (Decided 2026-09-17), with probe P1 and operations input on the non-sea chains re-checked before Task 3.1 — if either contradicts the choice, stop and re-plan.

- **3.1** Write `order-status.ts` per D3, with tests:
  - every trade has at least one option;
  - keys are unique within a trade;
  - `isOrderStatusFor` works across trades;
  - `orderStatusOptions` appends a stored legacy value flagged `legacy: true`, and does not duplicate a known one;
  - `orderStatusLabel` falls back to null for unknown values.

  Files: `packages/api/src/modules/collective-order/order-status.ts` [NEW], `packages/api/src/modules/collective-order/order-status.test.ts` [NEW]. · **Agent D (backend)**
- **3.2** Server validation on `create`, `update` and `updateBatch` per §4 (D4-A), plus the `eq`/`ilike` split in `buildOrderConditions` (`:1302-1303`). Update the `orderFields.status` comment (`:295-304`) to say the value set lives in `order-status.ts` and is enforced in the handlers.

  Tests:
  - replace the free-text literals with vocabulary keys in `collective-order.guards.test.ts:658/668` and `:1031/1038`, `collective-order.parity.test.ts:249/262/270`, and `collective-order.clearing.test.ts:136`, each checked for what it asserts;
  - add cases: an unknown value is refused on each writer, and the message ends with the reload sentence; an unchanged legacy value passes through `update` (the row is seeded with `"In transit"` directly); clearing to null is allowed; a mixed-trade `updateBatch` refuses when one row's trade lacks the key; the list filter uses `eq` for `booked` and `ilike` for `"transit"`.

  Files: `packages/api/src/routers/collective-order.ts`, `packages/api/src/routers/collective-order.guards.test.ts`, `packages/api/src/routers/collective-order.parity.test.ts`, `packages/api/src/routers/collective-order.clearing.test.ts`. · **Agent D (backend)**
- **3.3** Web form: move `status` from `TEXT_FIELDS` to `SELECT_KEYS` and render it as `enumSelect` with `orderStatusOptions` (the legacy value shown as "<text> (old value)"). Keep the key quoted, so `apps/web/src/architecture.test.ts` still finds it. Files: `apps/web/src/components/order-form.tsx`. · **Agent E (frontend)**
- **3.4** Ledger filters and columns: in each of the nine configs, replace the Order status text filter with a select over `ORDER_STATUS_VALUES[<trade>]`, and render the column cell through `orderStatusLabel(...) ?? raw`. The configs and their filter lines at HEAD:
  - `sea-export.tsx` `:1114`, `:1939-1945`
  - `sea-import.tsx` `:1128`, `:2053-2056`
  - `air-export.tsx` `:1055`, `:1786`
  - `air-import.tsx` `:1020`, `:1715-1718`
  - `domestic-trade.tsx` `:976`, `:1875-1882`
  - `land.tsx` `:946`, `:1782-1787`
  - `lcl.tsx` `:1004`, `:1780-1789`
  - `logistics.tsx` `:821`, `:1630-1648`
  - `rail.tsx` `:988`, `:1832-1838`

  Run the nine `order-ledger-parity-*.test.ts` files; their `["status", "Order status"]` label rows must still pass. Files: the nine files under `apps/web/src/components/order-ledger/configs/`. · **Agent E (frontend)**

**Acceptance.**
- On a sea-export order, Order status is a dropdown of the ten milestones. Choosing **Booked** and saving shows "Booked" in the ledger column, and the ledger filter **Booked** returns exactly that order.
- An order seeded with `"In transit"` shows "In transit (old value)" and saves other edits without error.
- An RPC `update` with `status: "Arrived"` on a sea-export order returns BAD_REQUEST naming the list.
- The api and web tests above, the nine parity tests and `bun run check-types` pass, judged by reading the output.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.2 | `packages/api/src/modules/collective-order/job-shape.ts` [NEW], `…/job-shape.test.ts` [NEW], `packages/api/src/modules/audit/resources.ts`, `packages/api/src/modules/audit/submit.ts`, `packages/api/src/routers/audit-review.test.ts`, `packages/api/src/routers/collective-order.concurrency.test.ts` [NEW] | `packages/api/src/routers/collective-order.ts`, `packages/api/src/routers/expense.concurrency.test.ts`, `packages/api/src/modules/audit/{gates,shared,post-approval,seed}.ts`, `packages/db/src/schema/{collective-order,audit}.ts`, `apps/web/src/components/order-form.tsx` (labels) |
| Agent B (test) | test-engineer | sonnet | medium | 1.3–1.4 | `seed/operations.ts`, `e2e/fixtures/ready-order.ts` [NEW], `e2e/specs/audit.order-queue.spec.ts`, `e2e/specs/audit.review-queue.spec.ts`, `e2e/specs/audit.post-approval.spec.ts` | `packages/api/src/modules/collective-order/job-shape.ts`, `seed/run-operations.ts` |

- **Files follow D10-A and D11-A (Decided 2026-09-17):** Agent A does not write `submit.ts` and adds no interface member (it implements step 07's `assertPublishable` in `resources.ts`), and `collective-order.concurrency.test.ts` already exists from step 15, so Agent A only adds a `describe` to it.
- **Why opus for A:** it edits the shared audit engine that ten resources use and writes the real-Postgres interleave test. A hook in the wrong position either leaks review state to a foreign org or refuses after an insert.
- **Run mode:** A(1.1) → (A(1.2) ∥ B). B waits on the committed `REVIEW_REQUIREMENTS` from 1.1 so the seed and fixture helper fill exactly the required set.
- **Serialization point:** after A, run `bunx vp test run packages/api/src/modules/collective-order/job-shape.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/routers/collective-order.under-review.test.ts packages/api/src/routers/collective-order.guards.test.ts packages/api/src/architecture.test.ts` and grep the output for `failed`; then `DATABASE_URL_TEST=<dev test branch> bunx vp test run packages/api/src/routers/collective-order.concurrency.test.ts` and confirm it ran rather than skipped. After B, run the operations seeder on a fresh dev org and the three e2e specs (§10 commands).

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (frontend) | frontend-engineer | sonnet | medium | 2.1–2.2 | `apps/web/src/components/order-ledger/order-readiness.tsx` [NEW], `…/order-readiness.test.tsx` [NEW], `apps/web/src/components/order-form.tsx` | `packages/api/src/modules/collective-order/job-shape.ts` |

Run mode: single agent. Serialization point: `bun run check-types` (read the output; it can exit 0 while printing "failed").

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent D (backend) | backend-engineer | opus | high | 3.1–3.2 | `packages/api/src/modules/collective-order/order-status.ts` [NEW], `…/order-status.test.ts` [NEW], `packages/api/src/routers/collective-order.ts`, `…/collective-order.guards.test.ts`, `…/collective-order.parity.test.ts`, `…/collective-order.clearing.test.ts` | `apps/web/src/architecture.test.ts` |
| Agent E (frontend) | frontend-engineer | sonnet | medium | 3.3–3.4 | `apps/web/src/components/order-form.tsx`, the nine `apps/web/src/components/order-ledger/configs/*.tsx` | `packages/api/src/modules/collective-order/order-status.ts`, the nine `order-ledger-parity-*.test.ts` |

- **Why opus for D:** it changes what three writers accept and the list query every ledger issues.
- **Run mode:** D(3.1) → (D(3.2) ∥ E). E waits on the committed `order-status.ts` exports.

**Ownership hand-offs:**
- `packages/api/src/routers/collective-order.ts` and `…/collective-order.guards.test.ts`: step 15 Phase 1 (prerequisite, D5-C) → Agent D (Phase 3).
- `apps/web/src/components/order-form.tsx`: Agent C (Phase 2) → Agent E (Phase 3)

**Smell test:**
- [x] Each task has one owner.
- [x] No file is owned twice within a phase.
- [x] Each parallel group's file sets are disjoint.
- [x] The opus assignments are justified; there are no haiku assignments.
- [x] Each wait names its artifact.
- [x] Phase 1 alone completes Journeys 1 and 2.

## 7. Impact & Breakage Analysis

- **`submitForReview` (Phase 1).**
  - Callers (`git grep submitForReview( HEAD -- packages apps e2e seed`, this pass): `routers/audit-review.ts:359` (the only caller of the engine function) and `quotation.rate-card.test.ts:1345` (a local helper of the same name; confirm it reaches the engine and not a quotation resource before assuming it is affected). The web reaches it through `apps/web/src/lib/audit-review.ts:38`.
  - Seed RPC helper `submitForReview` (`seed/sales.ts:320`) callers: only `seed/run-operations.ts:107` submits `collective_order`; `:112` (lading), `seed/cli.ts:269`/`:274` (fee_template, quotation), `seed/run-approvals.ts:88` (company arms, contract), `seed/run-money.ts:187` (cost_line) and `seed/tariff.ts:259` (fee_template) do not.
  - The hook is optional, so every other resource is unchanged.
  - Engine tests submitting orders: `audit-review.test.ts:831`, `:1111` and `:1259` (fixtures updated in 1.2).
  - e2e specs submitting orders: `audit.order-queue.spec.ts:132`, `audit.review-queue.spec.ts:127` and `audit.post-approval.spec.ts:46` (updated in 1.4).
  - No other spec passes `resourceType: "collective_order"` (grep over `e2e/specs`, this pass; `audit.review-queue.spec.ts:131` submits a lading).
  - `audit-flow.test.ts:112` only lists the trigger.
- **The frozen order writers (step 15 Phase 1 under D5-C; listed here because step 14's guarantee depends on them).**
  - Web callers (grep `collectiveOrder.saveChildren` / `collectiveOrder/saveChildren` over `apps`, `e2e`, `seed`, excluding tests, this pass):
    - `order-form.tsx:1644` (`update`), `:1733` (`saveChildren`, all child arrays) and `:1762` (`setAbnormalTags`), all inside `onSave`, whose `catch` already toasts the message;
    - **`apps/web/src/routes/_next/order.$orderId.expenses.tsx:598`** (`saveChildren`, `costs` only). Under step 15 D2-B it is **not** frozen, so fees (demurrage, storage) can be booked while accounting reviews; step 15 Task 1.4 case 2 proves `saveChildren({costs})` succeeds under review. Readiness does not read costs, so D2-B does not weaken it.;
    - `assign-job-number-button.tsx:159` (`assignNumber`; rendered at `order-form.tsx:2404` and `order-ledger/order-record-page.tsx:113`, per step 11 Phase 0);
    - `updateBatch`: none (the only mentions are a comment at `apps/web/src/architecture.test.ts:480` and QA case text in `apps/qa-review/src/cases.json`).
  - e2e callers: `e2e/order-parity/ledger-row-actions.spec.ts:162` waits on a UI `collectiveOrder/update` for an order it never submits, so the freeze does not reach it.
  - Seed callers: `seed/operations.ts:288` (`saveChildren`, on fresh orders before `run-operations.ts:107` submits them, so never under review at that point).
  - **Partial-save hazard:** under review, `update` is refused first, so the form never writes a header and then fails on children. The only new partial state is a form with a fresh draft left undiscarded, which is the intended outcome.
  - Behaviour change: an operator who edits an order right after submitting must withdraw first. Probe P7 sizes how often this happens today (sizing only; it is not a pass/fail check).
- **Operations seeder (Phase 1).** `seed/run-operations.ts:107-130` submits six orders and exits 1 on any refusal. Without Task 1.3 every D2-A submission is refused (no Operation Personnel, Vessel name or Voyage in `seed/operations.ts:213-231`), so seeding a demo or QA org aborts. Task 1.3 fixes it and its run is a Phase 1 acceptance check.
- **Readiness rule vs existing data.**
  - It applies only at submit. Orders already `pending` or `approved` are untouched, and so are their open submissions.
  - A **re-submission** of a rejected or withdrawn legacy order is checked, which is the intent.
  - Probe P5 counts how many draft or rejected orders would be refused today; P3 and P4 size each rule.
- **`status` contract (Phase 3).**
  - Writers: `create` (`:2508`), `update` (`:2847`), `updateBatch` (`:2997`).
  - `duplicate` clears `status` (`:2698`), and `convertToOrder` (`quotation.ts:3971-4010`) does not set it.
  - Readers: the ledger column in the nine configs (for example `air-export.tsx:564`), the list filter (`:707`, `:1303`), and the web architecture test (`apps/web/src/architecture.test.ts:531-560`, which is key-only).
  - Any integration writing free text over RPC gets BAD_REQUEST. No code in `apps/`, `e2e/` or `seed/` writes `status`, apart from the form.
- **Nullable fields the rules depend on.** Every readiness column is nullable (`schema/collective-order.ts`: `jobNumber` `:125`, `clientName` `:140`, `clientCompanyId` `:152`, `portOfShipment` `:194`, `portOfDestination` `:195`, `vesselName` `:200`, `voyage` `:202`, `etd` `:206`, `eta` `:208`, `operationPersonnel` `:277`). The rules treat null and blank alike. `consignType` is NOT NULL with default `fcl` (`:133`).
- **Masked fields.** The readiness query runs inside the engine with no field masking, so a caller who cannot read `clientName` still gets "Client" in the missing list when the order truly has none. The label reveals no value. That caller cannot fill the field, and someone with access must. This is recorded under Risks.
- **Deployment coupling.**
  - Phase 1: the server and the e2e fixtures ship together. Web is unaffected (refusals toast).
  - Phase 2: web only.
  - Phase 3: **server and web ship in one release** (one deploy of the stage, with `apps/web` built before the deploy so a partial deploy cannot split them; step 15 §7.5 records the same hazard). Web-first is not the rule, because it would invert the standing server-before-web order and the pipeline has no switch to force it.
  - **Accepted, visible outcome:** an operator with a tab opened before the release still has the free-text box. Saving a new typed status against the new server returns BAD_REQUEST, and nothing is written (edits in that save are refused too, and the form keeps them). The refusal message ends with _"If you see a text box for Order status, reload the page."_ Task 3.2's test asserts that sentence, and §10 Phase 3 edge case 2 walks it. A new web against an old server cannot occur in a single release.
  - No migration.
- **Cross-plan collisions:**

| Shared code | Steps that write it | Handled by |
|---|---|---|
| `ReviewableResource` type and the `collective_order` entry (`modules/audit/resources.ts:63-89`, `:201-243`) | 08 Task 2.1 (`separationOfDuties`, required on every entry), 10 Task 1.2 (`onPassed?`, new `quotation_decision` entry), **14 Task 1.2** (implements step 07's `assertPublishable?` on the `collective_order` entry, D10-A) | 14 merges after 07 Phase 3, 08 and 10, and adds **no** interface member — only the entry's implementation. The `collective_order` entry will already carry `separationOfDuties: false` |
| `submitForReview` body (`modules/audit/submit.ts:24-159`) | 08 Task 3.2 (post-approval refusal after `exists`), 10 Task 1.2 (auto-pass `onPassed`), **14 Task 1.2** (readiness after the open-attempt check) | Different positions. The §4 refusal order is the contract |
| `REVIEWABLE_RESOURCES.collective_order.exists` (`resources.ts:204-215`) | 08 Task 1.2 (pattern on `quotation.exists`), **15 Task 1.3** (`.for("update")`, D10-A) | Step 14 does not touch `exists`; the readiness hook is a plain read that relies on 15's lock |
| `routers/collective-order.ts` | 11 Phase 2 (moves the allocator out; D7 edits `assignNumber`), 12 Phase 1 (`assignNumber`), **15 Phase 1** (freeze and locks on seven handlers, D1/D2-B/D10), 15 Phases 2–3, **14 Task 3.2** (status validation, list filter) | Under D5-C: 11 Phase 2 → 12 Phase 1 → 15 Phase 1 → 14 Phase 1 → … → 14 Phase 3. Step 14 adds no guard or lock to this file |
| `seed/operations.ts` | 13 Task 2.6 (comment only), **14 Task 1.3**, 15 Task 3.7 (`ensureLadings`) | Corrected per `steps-12-15-crosscheck.md` X12: 14 Phase 1 merges before 15 Phase 3, whose seeder acceptance run uses the post-14 seeder |
| `collective-order.concurrency.test.ts` [NEW] | 15 Task 1.4, **14 Task 1.2** | D11 (crosscheck X8): recommended, step 15 creates it and step 14 adds a `describe` |
| `ReviewableResource` hook shape | 07 Task 3.3 (`assertPublishable?`), **14 Task 1.2** | D10 (crosscheck X9): recommended, step 14 implements 07's member and adds none |
| `modules/collective-order/` directory | 11 (`insert-order.ts` [NEW]), **14** (`job-shape.ts`, `order-status.ts` [NEW]) | Disjoint new files |
| `apps/web/src/components/order-form.tsx` | 05 (possibly `MemberNameSelect` reuse, soft), 11 (`AssignJobNumberButton` toast is in a different file), **14 Phases 2–3** | Rebase by hand |
| `packages/api/src/architecture.test.ts` | 08, 10, 11 | **14 adds no entries** (guards only, no new write sites) |
| Migration journal | 01, 02, 04, 05–08 (conditional), 09, 10 | **None for 14** under D3-A and D6-A |

**Recommended merge order (D5-C).** 08 (Phases 1–3) → 10 (Task 1.2) → 11 Phase 2 → 12 Phase 1 → **15 Phase 1** → **14 Phase 1** → 14 Phase 2 → 14 Phase 3. Phase 1 is one worktree (`wt-step14`), followed by Phase 2 and then Phase 3 in the same worktree or in two sequential ones. Step 15 Phases 2–3 do not touch step 14's files beyond `resources.ts`/`submit.ts` positions already listed, and can run before or after step 14.

**Hand-offs that must be written into the other plans before either executes** (this pass edits step 14 only):
- **Step 15 §7.6:** replace the row "12–14 (no plans yet)" with "14: depends on 15 Phase 1 for the freeze and the `exists` lock; adds the readiness check after the open-attempt check, implementing step 07's `assertPublishable` (D10-A, Decided); owns the `saveChildren` `orderNo` rule (step 12 hand-off)"; add "→ 14 Phase 1" after "15 Phase 1" in the required order. (This is the D5-C text; the D5-A variant is no longer written into step 15.)
- **Step 12 D5:** unchanged under the Decided D5-C (step 15 owns).
- **Step 15 D15** (half-save when content gates are ticked) is handed to step 14 by step 15. Step 14 does not make save atomic (§1 Out of scope); step 15's own recommended gate seed (its D5-A) ticks no content gate, so the half-save needs a tenant to tick one. Recorded under §9 Risks.

**Production read-only probes (Wilfred runs; P1 blocks Phase 3, P3–P5 block Task 1.1):**

```sql
-- P1  What is in the free-text status column today (D3 vocabulary, D4 legacy handling)
select business_type, status, count(*) as n, max(length(status)) as max_len
from collective_order group by 1, 2 order by business_type, n desc;

-- P2  Rows with a status but no status_time (legacy or direct inserts)
select count(*) filter (where status is not null and status_time is null) as status_no_time,
       count(*) filter (where status is not null) as with_status, count(*) as total
from collective_order;

-- P3  Share of live orders missing each proposed D2 field, per trade
select business_type, count(*) as total,
  count(*) filter (where coalesce(trim(job_number),'') = '') as no_job_number,
  count(*) filter (where coalesce(trim(client_name),'') = '' and client_company_id is null) as no_client,
  count(*) filter (where coalesce(trim(operation_personnel),'') = '') as no_ops_person,
  count(*) filter (where coalesce(trim(port_of_shipment),'') = '') as no_pol,
  count(*) filter (where coalesce(trim(port_of_destination),'') = '') as no_pod,
  count(*) filter (where coalesce(trim(vessel_name),'') = '') as no_vessel,
  count(*) filter (where coalesce(trim(voyage),'') = '') as no_voyage,
  count(*) filter (where etd is null) as no_etd,
  count(*) filter (where eta is null) as no_eta
from collective_order where archived = false
group by business_type order by business_type;

-- P4  Orders with no container / no cargo lines, per trade and consign type
select o.business_type, o.consign_type, count(*) as total,
  count(*) filter (where not exists (select 1 from collective_order_container c where c.order_id = o.id)) as no_containers,
  count(*) filter (where not exists (select 1 from collective_order_cargo g where g.order_id = o.id)) as no_cargo
from collective_order o where o.archived = false
group by 1, 2 order by 1, 2;

-- P5  Orders by review cache state that lack a client or job number (who a resubmit would refuse)
select order_audit_status, business_type, count(*) as n,
  count(*) filter (where coalesce(trim(client_name),'') = '' and client_company_id is null) as no_client,
  count(*) filter (where coalesce(trim(job_number),'') = '') as no_job
from collective_order group by 1, 2 order by 1, 2;

-- P6  Latest engine submission vs the cache (anything under review now; legacy-only 'pending')
select s.status as latest_submission, o.order_audit_status, count(*)
from collective_order o
left join lateral (
  select a.status from audit_submission a
  where a.organization_id = o.organization_id and a.resource_type = 'collective_order' and a.resource_id = o.id
  order by a.submitted_at desc limit 1
) s on true
group by 1, 2 order by 1, 2;

-- P7  Orders edited while a submission was open (D5 exposure)
select l.action, count(distinct l.target_id) as orders, count(*) as edits
from audit_log l
join audit_submission a
  on a.resource_type = 'collective_order' and a.resource_id = l.target_id
 and a.organization_id = l.organization_id
 and l.created_at > a.submitted_at
 and (a.resolved_at is null or l.created_at < a.resolved_at)
where l.action in ('collectiveOrder.update','collectiveOrder.saveChildren',
                   'collectiveOrder.setAbnormalTags','collectiveOrder.assignNumber','collectiveOrder.batch.update')
group by 1;

-- P8  Has updateBatch (no UI caller) ever run, and did it write status?
select date_trunc('month', created_at) as m, count(*),
       count(*) filter (where after_json::jsonb ? 'status') as wrote_status
from audit_log where action = 'collectiveOrder.batch.update' group by 1 order by 1;

-- P9  Haulage: are vehicle fields used, and do typed plates match a tracked device? (D6 sizing)
select o.business_type,
  count(*) filter (where coalesce(trim(o.vehicle_no),'') <> '') as with_vehicle_no,
  count(*) filter (where coalesce(trim(o.vehicle_no),'') <> '' and exists (
     select 1 from fleet_devices d where d.organization_id = o.organization_id
       and (d.display_name ilike '%' || trim(o.vehicle_no) || '%' or d.description ilike '%' || trim(o.vehicle_no) || '%'))) as matches_fleet
from collective_order o group by 1 order by 1;

-- P10 Fleet size per org/account (picker sizing under D6-B/C)
select organization_id, account_id, count(*) as devices, count(*) filter (where is_active) as active
from fleet_devices group by 1, 2;

-- P11 Legacy review verb use (D7 exposure: orders moved by collectiveOrder.review without a submission)
select date_trunc('month', created_at) as m, action, count(*)
from audit_log where action in ('collectiveOrder.review','collectiveOrder.reviewBatch')
group by 1, 2 order by 1;
```

## 8. Cross-Cutting Concerns

- **Errors.**
  - Readiness returns CONFLICT with one sentence listing labels in form-section order.
  - The freeze (step 15) returns CONFLICT with the engine's existing sentence (`gates.ts:139-141`).
  - A status outside the list returns BAD_REQUEST naming the trade's list.
  - Every refusal happens before any write, and nothing is written to the audit log for it, matching every other refusal in these routers.
  - The web needs no new error handling: `ReviewMenu` (`review-menu.tsx:117`) and `onSave`'s `catch` already toast `error.message`.
- **Testing.**
  - Pure unit tests: `job-shape.test.ts`, `order-status.test.ts`.
  - Engine tests on PGlite: `audit-review.test.ts`.
  - Router tests: `collective-order.guards.test.ts`, `parity`, `clearing`.
  - Web: component test for the panel; architecture tests on both sides.
  - e2e: the three audit specs, plus one new refusal case.
  - Browser proof per §10.
- **Migration.** None under D3-A and D6-A.
- **Rollback.**
  - Phase 1: revert. No data was written differently; submissions and edits were only refused.
  - Phase 2: revert (UI only).
  - Phase 3: revert. Rows written with keys keep them, and after the revert they display as raw keys (`booked`) in a free-text column. That is readable and harmless, and a later re-apply relabels them.
- **Audit trail.** Unchanged. A refused submit or edit writes no `audit_log` row and no `audit_submission`.

**Performance & Scalability**
1. **Pagination.** N/A. The list endpoint's pagination is unchanged, and the new code is single-record or bounded-batch.
2. **SQL-side filtering.**
   - The readiness row load and both counts are WHERE clauses on `id` / `order_id` and `organization_id`.
   - The status filter moves from `ilike` to `eq` for known keys, still in SQL.
3. **N+1.**
   - Readiness is three queries per submit. `ReviewMenu` submits one id per call, fanned out by `Promise.allSettled` (`review-menu.tsx:105`), which is today's pattern; each call is its own transaction.
   - `updateBatch`'s under-review check is step 15's `assertNoneUnderReview` (one query for the selection). Step 14 Phase 3 adds a per-row status check over rows already loaded, with no extra query.
4. **Index coverage.**
   - `collective_order` is looked up by primary key.
   - `collective_order_container_orderId_idx` (`schema :399`) and `collective_order_cargo_orderId_idx` (`:437`) cover the counts.
   - `latestSubmissionByResource` uses `auditSubmission_resource_idx` (`schema/audit.ts:413`).
   - `eq(status)` has no index, the same as today's `ilike`. The list is already org- and trade-filtered, and orders number in the hundreds per org, so none is added.
5. **Write atomicity.** Readiness runs inside the caller's existing transaction (`audit-review.ts:359`), before any insert. The freeze (step 15) runs inside each order handler's `context.db.transaction`.
6. **Row locking.**
   - **Where the lock lives.** One place per side, both owned by step 15 under D5-C: `REVIEWABLE_RESOURCES.collective_order.exists` loads the order `.for("update")` (step 15 Task 1.3, D10-A, the step 08 Task 1.2 pattern), and the frozen writers load it `.for("update")`. The readiness hook is a **plain read**.
   - **Why not in the hook.** `submitForReview` calls `exists` at `submit.ts:39`, then runs the open-attempt SELECT (`:71-84`) with no lock, then the hook. A lock taken first in the hook would let two concurrent submits both pass the open-attempt check before either locked. With the lock in `exists`, the second submit waits at `:39` and then sees the first submission as open.
   - **Batch lock order.** Multi-row loads lock in id order (`.orderBy(collectiveOrder.id).for("update")`, step 15 §4.1). At HEAD `updateBatch` loads with no `orderBy` (`routers/collective-order.ts:3046-3049`); two overlapping batch edits locking in different orders could deadlock, which is why step 15 orders them.
   - **Proof.** PGlite is single-connection, so step 14 proves the submit-versus-edit interleave in `collective-order.concurrency.test.ts` [NEW] against `DATABASE_URL_TEST` (Task 1.2), judged by HTTP results plus final state.
7. **Connections/resources.** None new.
8. **Tenant isolation.**
   - The readiness queries filter by `organizationId` (the order) and by `order_id` taken from that org-checked row.
   - `assertNotUnderReview` is org-keyed (`gates.ts:130-136`).
   - Every writer keeps its `applyScope` load before the new call, so a foreign id answers NOT_FOUND before any review state is revealed.
9. **Payload size.** No response shapes change. Error messages are one sentence.
10. **Hot path.**
    - Submit and save are operator-triggered.
    - The form's `useMemo` recomputes on each keystroke over about 15 fields and two array lengths, which is negligible.
    - The ledger list query changes one predicate.

## 9. Decision Register, Open Questions & Risks

**Status of every decision below.** No Input Gate was held; on 2026-09-17 Wilfred accepted the recommended option for every decision, D1–D15, and every settlement in `steps-12-15-crosscheck.md` (X6–X16). All fifteen are therefore **Decided**, with the option letter and date on each "Chosen" line. The rejected approaches stay in place, unchanged, as the record of what was weighed. Where a choice rests on a production probe or on operations input, the decision stands but the check is still required before the named task; each such decision carries a "Re-check before Task N" line, and a contradicting result means stop and re-plan rather than quietly deviate.

The order under-review freeze and row lock (D5) is one decision across three plans: step 12 D5, step 14 D5 and step 15 D17 name the same choice, and `steps-12-15-crosscheck.md` X6 settled it as step 15's (accepted 2026-09-17).

### Blocking (all Decided 2026-09-17)

**D1: Where is "an order must have its basic shape" enforced?** · Status: Decided · Blocking: Phase 1 (Tasks 1.2–1.4)

| | Approach | Consequence |
|---|---|---|
| **A** | **At submit for review**, through step 07's optional `assertPublishable?` hook on `ReviewableResource` (D10-A), reading the stored order and its line counts (Recommended) | Drafts stay free, as in eyun and the SOP ("save sends only what changed"). Existing sparse rows are untouched until someone resubmits them. It is not defeated by masked-field stripping or non-atomic saves, because it reads stored data. It needs the under-review freeze (D5; step 15 Phase 1 under D5-C) to stay true after submit, and it can be bypassed over RPC by the legacy review verbs until step 15 deletes them (D7). |
| **B** | **On `create`/`update`:** required fields in zod or in the handler | Every save of an incomplete draft fails, including converted orders on first open and every legacy sparse row (P3). Users with `clientName` masked cannot save at all (`stripDeniedFields`, `:2907`). It breaks `seed/operations.ts` and most router fixtures. |
| **C** | **In the database:** NOT NULL on the core columns | Same breakage as B, plus a backfill migration over every existing row, and it cannot express per-trade or "one of client id / name" rules. |

- **Recommendation: A.** The SOP's pitfall is about what reaches review and beyond. Submit is the one moment where "incomplete" becomes someone else's problem, and the engine already has a per-resource seam.
- **Chosen:** A (Wilfred, 2026-09-17)
- **Blocking?** Yes. It blocks Phase 1 (Tasks 1.2–1.4). It changes user-visible behaviour: whether an incomplete draft can be saved.
- **Where it lands:** §4 engine hook, Tasks 1.2 and 2.2 (`onSave` unchanged).

**D2: Which fields must an order have before it can be submitted?** · Status: Decided · Blocking: Task 1.1

| | Approach | Consequence |
|---|---|---|
| **A** | **A small core plus route/schedule/cargo per trade**, as in the §4 table (Job Number, Client, Operation Personnel; ports, vessel/voyage or flight, ETD or ETA; ≥1 container or cargo line), kept as data in `REVIEW_REQUIREMENTS` (Recommended) | It covers the SOP's named gaps ("no client, no vessel, no ports and no cargo"). A converted order is already mostly complete (`quotation.ts:3971-4010`). Each row is a one-line change once P3/P4 show a rule is unrealistic. It does not check lading-bill parties, weights or HS codes. |
| **B** | **A broad eyun-like set per trade**, adding shipper/consignee/notify, marks, gross weight and volume totals, cut-off time and trade terms | Reviewers see nearly complete jobs. Many real orders are submitted before the B/L parties are known (step 16 raises the B/L afterwards), so B pushes review later or pushes junk values in. The fixture changes roughly triple. |
| **C** | **Core only:** Job Number and Client for every trade | Smallest change and fixtures, with no per-trade logic. It leaves "no vessel, no ports, no cargo" reviewable, so the SOP pitfall remains three-quarters open. |

- **Recommendation: A.** It closes the SOP's four named gaps with rules the converted-order path already satisfies, and it stays data-driven for tuning after the probes.
- **Chosen:** A (Wilfred, 2026-09-17)
- **Re-check before Task 1.1:** probes P3 and P4 plus operations input on the required set; if they contradict the choice, stop and re-plan.
- **Blocking?** Yes. It blocks Task 1.1 until that re-check is done.
- **Where it lands:** `job-shape.ts`, fixtures in 1.2 and 1.4, and the Phase 2 panel.

**D5: Who owns the order under-review freeze and the submit/save row lock?** · Status: Decided · Blocking: Phase 1

Context: `steps-12-15-crosscheck.md` X6 records that steps 14 and 15 each named the other as owner and recommends that step 15 owns it (this plan's D5-C). Step 15 already plans this work in full (§4.1, D1-A seven handlers, D2-B costs-only exemption, D10-A lock in `collective_order.exists`, Tasks 1.1–1.4), and step 12 D5-A names step 15 as owner. An earlier draft of this plan also claimed it, in a different shape (all of `saveChildren` frozen, lock inside the readiness hook). Two owners would put conflicting guards on the same handlers, so exactly one must be chosen and written into steps 12, 14 and 15.

| | Approach | Consequence |
|---|---|---|
| **A** | **Step 14 owns it**, adopting step 15 §4.1 verbatim: seven handlers, D2-B (`saveChildren({costs})` not frozen), `.for("update")` in `collective_order.exists` and on the handlers' loads (batch loads ordered by id), the `assertNoneUnderReview` / `assertPostApprovalEditableMany` helpers and step 15's under-review suite. Step 15 drops Tasks 1.1–1.4 and depends on step 14 Phase 1; step 12 D5 is re-pointed | Readiness and the freeze land in one merge. Step 14 Phase 1 grows by step 15's Phase 1 (a new suite, two helpers, seven handlers), and step 15's D1/D2/D3/D10 become step 14 blockers. Step 15's post-approval half (D3-A in `saveChildren`) would then need splitting out or moving too. |
| **B** | **Split:** step 14 freezes `update` and content `saveChildren` only; step 15 adds the rest | Smallest step 14 change, but one defect across two plans, two test suites and two lock placements. This is the double ownership the review flagged. |
| **C** | **Step 15 owns it; step 15 Phase 1 is a prerequisite of step 14 Phase 1** (Recommended) | One owner, matching step 12 D5-A, step 15's plan and the SOP data (step 15 `fixes[0]`). Step 14 Phase 1 shrinks to the readiness hook, the seed and fixtures, and the interleave test. Step 14 waits for step 15 Phase 1, which itself waits on 08, 10 and 11 Phase 2 (the same wave step 14 already needed). No window exists in which readiness is advisory, because step 14 cannot merge first. |

- **Recommendation: C** (the X6 settlement). Step 15's design is the more complete one (fees page, delete, batch, lock placement consistent with step 08), and the other two plans already point at it. Moving it into step 14 buys nothing but a larger Phase 1.
- **Chosen:** C (Wilfred, 2026-09-17) — one cross-plan decision with step 12 D5 and step 15 D17, settled together through `steps-12-15-crosscheck.md` X6: step 15 owns the freeze and the lock in `collective_order.exists`, and step 15 Phase 1 merges before step 14 Phase 1.
- **Blocking?** Yes. It blocks Phase 1 (it decides the prerequisite list and whether Phase 1 carries step 15's tasks).
- **Where it lands:** §0 header, §4 "Under-review freeze and submit lock", §5 prerequisites and Task 1.3 note, §6 hand-offs, §7 collisions, merge order and hand-offs to steps 12 and 15.

**D8: Which submissions does the readiness rule apply to?** · Status: Decided · Blocking: Task 1.2

| | Approach | Consequence |
|---|---|---|
| **A** | **Every `collective_order` submission in every org** (Recommended) | One rule and no configuration. A legacy sparse order that was rejected must be completed before resubmitting, which is the point of the change. |
| **B** | **Per flow:** a new `audit_flow.require_complete boolean default false` column that orgs switch on in Parameter Setting | Tenants opt in, so there is no surprise refusal. It needs a migration, a flow-editor control, a seed default, and a decision on what the seed sets. Until someone ticks it, the finding stays open. |
| **C** | **Only orders created after the deploy** (compare `createdAt` with a constant) | Legacy rows are never blocked. It adds a hidden date rule that nobody can see in the UI, and legacy sparse orders stay reviewable forever. |

- **Recommendation: A.** The rule fires only at submit, so nothing already in review or approved changes, and P5 sizes who a resubmit would refuse before the rule ships. A per-flow switch leaves the finding open wherever nobody ticks it.
- **Chosen:** A (Wilfred, 2026-09-17)
- **Re-check before Task 1.2:** probe P5 (how many open or resubmittable orders a universal rule would refuse); if it contradicts the choice, stop and re-plan.
- **Blocking?** Yes. It blocks Task 1.2 until P5 is run. It decides which orgs see refusals.
- **Where it lands:** Task 1.2 (hook has no flow lookup).

**D10: Which engine seam carries the readiness check?** · Status: Decided · Blocking: Task 1.2

| | Approach | Consequence |
|---|---|---|
| **A** | **Implement step 07's `assertPublishable?`** on the `collective_order` entry, throwing CONFLICT with `readinessMessage(...)`; no new member and no `submit.ts` edit (Recommended) | Follows the 04–10 runbook rule and `steps-12-15-crosscheck.md` X9. Readiness is also re-checked at the final pass in `decide`, so a sparse order already under review on deploy day cannot be approved until it is withdrawn and completed. Needs step 07 Phase 3 merged, with its submit call placed after the open-attempt check. |
| **B** | **Add a separate `readinessProblem?` member**, called only in `submitForReview` (the §4 block) | Submit-only, with no dependency on step 07. Two parallel content hooks on one interface, against the runbook rule, so the plan must record why it departs. |
| **C** | **A `collective_order` branch inside `submitForReview`** (`if (input.resourceType === "collective_order")`) | No interface change at all. It puts resource knowledge into the generic engine, which every other check avoids by going through `REVIEWABLE_RESOURCES`. |

- **Recommendation: A.** The runbook already set the precedent for content hooks on this interface, and X9 found step 07's hook has the same signature and a compatible call site. `assertPublishable` does not exist at HEAD; it arrives with step 07.
- **Chosen:** A (Wilfred, 2026-09-17) — cross-plan with step 07, settled through crosscheck X9: step 14 reuses step 07's `assertPublishable` hook and adds no `readinessProblem?` member. **Accepted side effect:** because step 07 also calls the hook at the final pass in `decide`, an incomplete order already under review cannot be approved — it must be withdrawn, completed and resubmitted.
- **Re-check before Task 1.2:** grep the base commit for `assertPublishable` on `ReviewableResource` and confirm step 07's submit call sits after the open-attempt check (`submit.ts:71-84`); if it does not, stop and re-plan.
- **Blocking?** Yes. It blocks Task 1.2: it decides the files touched and whether readiness is re-checked when a review passes.
- **Where it lands:** §4 engine hook, Task 1.2, §6 Agent A files, §7 collisions.

**D11: Who creates `collective-order.concurrency.test.ts`, and how is the submit-versus-edit race proven?** · Status: Decided · Blocking: the race test in Task 1.2 only

| | Approach | Consequence |
|---|---|---|
| **A** | **Step 15 creates the file** (update-vs-submit, delete-vs-submit); step 14 Task 1.2 adds one `describe` for submit-vs-clear-vessel and drops the [NEW] tag (Recommended) | One plan creates the file, matching the 15 P1 → 14 P1 order and `steps-12-15-crosscheck.md` X8. Step 14's proof still runs on real Postgres. |
| **B** | **Step 14 creates the file [NEW]**, as Task 1.2 was first written | Both plans create the same path, so the later merge conflicts by construction. |
| **C** | **No step 14 race test**; rely on step 15's interleaves plus the readiness read sitting after the `exists` lock | Smallest change. Nothing proves readiness itself under the interleave, only the freeze. |

- **Recommendation: A.** It follows the merge order D5-C already implies and keeps a readiness-specific proof.
- **Chosen:** A (Wilfred, 2026-09-17) — cross-plan file ownership with step 15, crosscheck X8: step 15 creates `collective-order.concurrency.test.ts`, step 14 adds one `describe`, and because CI has no `DATABASE_URL_TEST` each PR pastes the real-Postgres run output into its description.
- **Blocking?** Yes, for the race test in Task 1.2 only. The rest of Phase 1 can proceed.
- **Where it lands:** Task 1.2, §6 Agent A files, §7 collisions, §10 Phase 1 edge case 4.

**D3: What is the order status value set?** · Status: Decided · Blocking: Phase 3

| | Approach | Consequence |
|---|---|---|
| **A** | **A code-owned milestone list per trade** in `order-status.ts` (the §4 table: the eyun sea-export chain, and proposed chains for the other trades), one current value in the existing text column, validated in the writers (Recommended) | The ledger filter becomes exact, and the vocabulary is shared by server and web. No migration. It differs from eyun in two ways: no per-tenant templates, and one current milestone instead of ticked nodes with their own timestamps (`statusTime` still records the last change). The non-sea chains are proposals Wilfred must confirm with operations. |
| **B** | **One global fixed list** for all trades, plus a CHECK constraint | Simplest filter and a DB guarantee. Air and road orders offer sea milestones such as "Gated in". The CHECK needs P1 and a backfill of every legacy value first, plus a migration. |
| **C** | **Keep free text and add suggestions** (a datalist of the sea-export chain) | No contract change, and no test or legacy impact. The finding ("no value set behind it") stays open, and the filter stays a substring search. |

- **Recommendation: A.** It closes the finding with no migration and follows the repo's "enum-like columns are plain text" convention (`schema/collective-order.ts:29-31`). Configurable templates (eyun's model) are rated weeks (`eyun-manual-2025-03-findings.md:529`) and can later replace the constant without changing stored keys.
- **Chosen:** A (Wilfred, 2026-09-17)
- **Re-check before Task 3.1:** probe P1 plus operations input on the non-sea milestone chains (they are proposals, not captured eyun data); if either contradicts the choice, stop and re-plan.
- **Blocking?** Yes. It blocks Phase 3 until that re-check is done.
- **Where it lands:** `order-status.ts`, Tasks 3.1–3.4.

**D4: What happens to status text already stored that is not in the list?** · Status: Decided · Blocking: Task 3.2

| | Approach | Consequence |
|---|---|---|
| **A** | **Leave it.** Writers accept an unchanged stored value, the form shows it as "<text> (old value)", and the filter keeps `ilike` for text that is not a known key. Any new value must come from the list (Recommended) | No data change and no migration. Legacy rows remain until someone updates them, and the ledger shows a mix of labels and old text for a while (P1 sizes it). |
| **B** | **Backfill:** a one-off script maps P1's distinct values to keys (for example "In transit" → `departed`), with unmapped values nulled | A clean column at once. Someone must write and approve the map, it is a production data change that needs Wilfred's approval to run, and a wrong mapping silently changes what an order says. |
| **C** | **Clear all legacy values** to null | Clean, with no mapping effort. Recorded status information is destroyed. |

- **Recommendation: A.** It is the only option with no production write. B can follow once P1 shows the legacy set is small and mappable.
- **Chosen:** A (Wilfred, 2026-09-17)
- **Re-check before Task 3.2:** probe P1 (the distinct legacy status values and how many rows carry them); if it contradicts the choice, stop and re-plan.
- **Blocking?** Yes. It blocks Task 3.2 until P1 is run.
- **Where it lands:** `orderStatusOptions`, handler validation, and the filter split.

**D9: Where does readiness show before the operator presses Submit?** · Status: Decided · Blocking: Phase 2

| | Approach | Consequence |
|---|---|---|
| **A** | **On the edit form** (a "Before review" panel and rail dots), with the ledger relying on the server's refusal toast (Recommended) | Operators see the list where they fix it. No list-query change and no per-row computation on a 129-column grid. A ledger user learns an order is incomplete only when Submit is refused, and the toast names the fields. |
| **B** | **Also grey out Submit in the ledger row menu** with a tooltip naming what is missing | Prevents the refused click. The list response would have to carry every readiness field and child counts for each row (two correlated counts per row on every ledger page), and `ReviewMenu` has no per-move disabled prop today (`review-menu.tsx:62-84`). |
| **C** | **Server refusal only**, no form panel | Smallest change (Phase 2 disappears). Operators discover what is missing by trial and error, one refused submit at a time. |

- **Recommendation: A.** It puts the list where the operator fixes it, reuses the shared rule module, and needs no ledger query change.
- **Chosen:** A (Wilfred, 2026-09-17)
- **Blocking?** Yes. It blocks Phase 2 only (it decides the user-visible surface).
- **Where it lands:** Phase 2.

### Not blocking (all Decided 2026-09-17)

**D6: Does step 14 do anything about haulage?** · Status: Decided · Blocking: none

| | Approach | Consequence |
|---|---|---|
| **A** | **Nothing structural.** Step 19 owns drivers, dispatch, legs, POD, the truck-to-job link and the Logistics Park C/D batch/vehicle sub-list. Step 14's status list includes a "Haulage arranged" milestone (Recommended) | No schema or tracking change here, and `nct-haulage` stays open for step 19 with this plan's evidence. Operators keep typing plates into `vehicleNo`. |
| **B** | **A soft link, no migration:** `vehicleNo` becomes a combobox over `tracking.snapshot` devices, storing the device's display name as text | Fewer mistyped plates, and the map and orders use the same names. Still no join (text match only). It adds a `tracking.read` dependency to the order form, which not every order role holds (for example `ops`, `roles.ts:154-172`, does not list it), and step 19 would likely replace it. |
| **C** | **A hard link:** nullable `fleet_account_id` and `fleet_device_id` on `collective_order` (composite reference; `fleet_devices` has no surrogate id), a picker, and a "view on map" link | A real truck-to-job link. It needs a migration, one truck per order (the single-vehicle limitation noted in the eyun findings), and a model step 19's legs would have to supersede. |

- **Recommendation: A.** A truck belongs to a leg or dispatch, not to a whole order, so any link made now is shaped wrongly for step 19. Probe P9 tells step 19 whether typed plates already match devices.
- **Chosen:** A (Wilfred, 2026-09-17) — scope boundary with step 19, which keeps `nct-haulage`.
- **Blocking?** No.
- **Where it lands:** §1 out of scope, the D3 vocabulary, and the step 19 plan.

**D7: What about the legacy `collectiveOrder.review` / `reviewBatch`, which bypass the readiness check?** · Status: Decided · Blocking: none

| | Approach | Consequence |
|---|---|---|
| **A** | **Leave them to step 15**, which deletes them (step 08 D4 pattern) together with the order self-approval rule (Recommended) | Step 14 stays out of the review verbs. Until step 15 merges, anyone holding `collectiveOrder.review` (ops, admin, branch-manager, accounting) can move a sparse draft to `pending` over RPC without a submission. There is no UI caller, and P11 shows whether it has ever happened. |
| **B** | **Call `missingForReview` inside the legacy `review` for `draft → pending`** | Closes the bypass now, but adds logic to code scheduled for deletion, and needs a PGlite test on a verb nobody calls. |
| **C** | **Delete both verbs in step 14** | Closes the bypass and removes two allow-list entries (`architecture.test.ts:494`, `:876`) and their tests (`collective-order.guards.test.ts:474-600`, `:741-811`). This takes step 15's work into step 14. |

- **Recommendation: A.** No caller exists, the deletion has a settled precedent and a natural owner, and the exposure is measurable (P11).
- **Chosen:** A (Wilfred, 2026-09-17) — cross-plan ownership with step 15, which deletes both verbs in its Task 2.1.
- **Blocking?** No.
- **Where it lands:** §1 out of scope, §7 collisions, the step 15 plan.

### Decided

All of them, on 2026-09-17: D1–D11 above and D12–D15 below, each at its recommended option. The one-line roll-up is in the "Decisions settled (2026-09-17)" subsection at the end of this file.

### Engineering calls (were Assumed; Decided 2026-09-17)

**D12: Where do the readiness rules live, so the server and the form use the same list?** · Status: Decided · Blocking: none

| | Approach | Consequence |
|---|---|---|
| **A** | **One pure module `modules/collective-order/job-shape.ts`**, with no drizzle or oRPC imports, imported by the web through the `"./*"` export (Recommended) | One rule list. The precedent is `@nct-ai/api/modules/expense/bridge` (`apps/web/src/components/tariff-hint.tsx:1`). The module must stay free of server imports. |
| **B** | **A copy of the rules in the web** | No cross-package import. Two lists drift, and the panel can say "Ready for review" while submit refuses. |
| **C** | **A `collectiveOrder.readiness` RPC** that the form calls as the operator types | One list, on the server only. A request per change, and it reads stored data rather than the unsaved form. |

- **Recommendation: A.** It follows an existing shared-module precedent and is the only option where the panel and the refusal cannot disagree.
- **Chosen:** A (Wilfred, 2026-09-17)
- **Blocking?** No.
- **Where it lands:** §4 rule set, Tasks 1.1 and 2.2.

**D13: Where is a status value checked against the trade's list?** · Status: Decided · Blocking: none

| | Approach | Consequence |
|---|---|---|
| **A** | **In the `create` / `update` / `updateBatch` handlers after the scoped load**, only when the value changes (Recommended) | The handler sees the stored row, so an unchanged legacy value passes (D4-A) and `update` can use the stored trade. `orderFields.status` keeps its shape for the web architecture test and `batchPatchFields`. |
| **B** | **A zod `.refine` on `orderFields.status`** | Declarative, but zod cannot see the stored value or the stored trade on a partial `update`, so D4-A cannot be honoured. |
| **C** | **Only in the web dropdown**; the server keeps accepting any text | No server change. RPC writers can still store free text, so the finding stays open. |

- **Recommendation: A.** It is the only placement compatible with D4-A and with `update` patches that omit `businessType`.
- **Chosen:** A (Wilfred, 2026-09-17)
- **Blocking?** No. If D4 moves to B or C, option B becomes possible, but A still works.
- **Where it lands:** §4 API contracts, Task 3.2.

**D14: How does the ledger's Order status filter match?** · Status: Decided · Blocking: none

| | Approach | Consequence |
|---|---|---|
| **A** | **`eq` when the input is a known key in any trade's list, `ilike` otherwise** (Recommended) | Exact results for dropdown picks, and old bookmarked text searches for legacy values still work. Two code paths in `buildOrderConditions`. |
| **B** | **`eq` always** | Simplest. A saved search for legacy text such as "transit" returns nothing. |
| **C** | **Keep `ilike` always** | No query change. "Booked" still matches any text containing "book", so the filter is not exact. |

- **Recommendation: A.** It makes new values exact without breaking the legacy rows that D4-A keeps.
- **Chosen:** A (Wilfred, 2026-09-17)
- **Blocking?** No.
- **Where it lands:** §4 API contracts, Tasks 3.2 and 3.4.

**D15: How are Phase 3's server and web released?** · Status: Decided · Blocking: none

| | Approach | Consequence |
|---|---|---|
| **A** | **One release**: `apps/web` built before the deploy, server and web together; a tab opened earlier gets BAD_REQUEST ending "reload the page" (Recommended) | Matches the standing server-before-web order and step 15 §7.5. The old-tab refusal is visible, but it writes nothing and tells the operator what to do. |
| **B** | **Web first, server later** | No old-tab refusal. The pipeline has no switch to force the order, and it inverts the standing one. |
| **C** | **Server first, accepting free text for one release**, then tighten | No refusal for old tabs. Free text keeps arriving during the window, and a second server change is needed. |

- **Recommendation: A.** It is the only option the current deploy pipeline supports without a new mechanism.
- **Chosen:** A (Wilfred, 2026-09-17)
- **Blocking?** No.
- **Where it lands:** §7 Deployment coupling, the Task 3.2 message, §10 Phase 3 edge case 2.

### Risks
- _Steps 08, 10 and 11 shift every line cited in `submit.ts`, `resources.ts` and `collective-order.ts`_ → certain → **each task locates code by symbol (`submitForReview`, `REVIEWABLE_RESOURCES.collective_order`, the handler names), and the §5 prerequisites say to re-read at the base commit.**
- _The D2 set refuses a large share of real submissions on day one_ → medium, until P3/P4/P5 are run → **run the probes before Task 1.1 and drop or relax any rule whose missing share is high, recording the reason in `REVIEW_REQUIREMENTS`' docblock.**
- _A masked user sees "Client" missing and cannot fix it_ → low (roles that mask `clientName` rarely submit orders) → **the message names the field only. The §10 edge case confirms no value leaks, and operations route the fix to a role that can see the field.**
- _Submit and edit race in the window between the check and the write_ → low (two people on one order within milliseconds) → **the order row is locked `FOR UPDATE` in `collective_order.exists` and in the writers' loads (step 15 Task 1.3; §8 item 6); step 14 proves readiness under that interleave in `collective-order.concurrency.test.ts` [NEW] (Task 1.2).**
- _Step 15 Phase 1 slips, and step 14 Phase 1 is held behind it_ → medium → **D5-C (Decided) accepts the wait: step 14 never merges readiness without the freeze. Escalate the slip rather than re-open the ownership choice.**
- _`saveChildren` writes `orderNo` NULL on lines of an unnumbered job, and races `assignNumber` (hand-off from step 12 §7 "Lock behaviour")_ → low → **Rule: a line saved while the job has no number carries `orderNo` NULL (today's behaviour at `routers/collective-order.ts:4453`, `orderNo: order.jobNumber`); step 11 Task 2.4's re-stamp in `assignNumber` (widened to NULL lines if step 12 D2 picks A or B) repairs those lines when the number is assigned, and D2-A requires Job Number before submit, so no submitted order has NULL-numbered lines from before the assign. The race (saveChildren reads `jobNumber` unlocked in its load at `:3971-3990`, then inserts after `assignNumber`'s re-stamp commits) is closed by step 15 Task 1.3's `.for("update")` on `saveChildren`'s scoped load, which is unconditional (it runs before the D2-B content check): the load waits on `assignNumber`'s row lock and, under READ COMMITTED, re-reads the committed row with the new `jobNumber`. Owner: step 14 for the rule (stated here), step 15 for the lock. Step 12 probe P3's `null` kind counts any residual hits.**
- _A tenant ticks a content gate (`expense_entry`, `container_info`, `cargo_info`) and every edit save of an unapproved order half-saves (header written, children refused), step 15 D15 handing this to step 14_ → low (step 15's own recommended D5-A, its gate seed, ticks no content gate) → **not fixed in step 14 (atomic save is out of scope, §1). Recorded as open for a later plan; a read of `audit_flow` gates per org (step 15 §7.7) shows whether any org has ticked one.**
- _The operations seeder's order values drift from `REVIEW_REQUIREMENTS` after a D2 change_ → medium → **Task 1.3 re-checks after D2 is final, and the seeder run is a Phase 1 acceptance check; a later D2 edit must re-run the seeder.**
- _The proposed non-sea status chains do not match how NCT operations work_ → high → **D3 blocks Task 3.1 until Wilfred confirms the lists with operations. Keys are stable, and labels and order can change later without a data change.**
- _The legacy review verbs bypass readiness until step 15_ → low (no caller) → **D7-A. Step 15 Task 2.1 deletes both verbs; its plan should name this bypass as closed by that task.**
- _e2e specs outside the three named start submitting orders later_ → low → **the `readyOrderPayload` helper is the documented way to build a submittable order, named in the spec docblocks.**

### SOP text vs code (Phase 0 wins)
1. **"Save sends only what changed and returns you to the trade ledger."** True (`buildPayload` `:1457`, toast `:1769`). It is unchanged by this plan.
2. **"No field on any trade is mandatory."** True for saving, and after this plan still true for saving. It becomes false for **submitting** (D1-A). The SOP card for step 14 should gain a line saying which fields are needed before step 15.
3. **"Creating at /order/new needs owning branch and business type."** True (`create` input), and both are filled automatically.
4. **"Containers (case type &amp; TEU) (the label really does render that way)."** True (`:2590`). Fixed in Task 2.2.
5. **The step 15 card's `fixes[0]`** cites `saveChildren (:4756)` and `assignJobNumber (:2800)`. At HEAD, `:4756` is inside `setAbnormalTags` and the procedure is `assignNumber`. The defect is real; step 15 Task 1.2 covers all of them (this plan's D5).
6. **The step 14 "before" line, "The order has a job number (step 12)".** Not enforced today. Under D2-A it becomes enforced at submit.

## 10. Verification & Proof

**App URL:** http://localhost:3101 (`apps/web/vite.config.ts:8`; the API server runs alongside it, per `.claude/launch.json`). Run one worktree's servers at a time.
**Preconditions:**
- An audit e2e org from `bun --preload apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>` (usage at `seed-cli.ts:11-13`; `e2e/global-setup.ts:59` passes the same `--preload`). Its `seed` runs `seedOrgParams` (a `job` sequence) and `seedAuditFlows` (the **Order review** flow, `modules/audit/seed.ts:145-151`, `withdrawalMode: "direct"`, stage role `accounting`). `seed-parity` is not used: it creates one owner member and no orders.
- Actors from that seed's `ACTORS` (`seed-cli.ts:45-69`): **salesperson** (role `sales`, holds `collectiveOrder.update`, the order flow's submit node, `roles.ts:142`) as the submitter, and **accountant** (role `accounting`) as the reviewer. Before step 1, confirm with one RPC `auditReview.submit` on a complete order that the salesperson is accepted as initiator; if not, use **managerA** (role `branch-manager`, holds `collectiveOrder`). Announce the active org before driving the browser.
- Order **OS**: a sea-export order with client, ports, Operation Personnel, a job number and one container line, but no vessel, voyage or ETD (convert a Won quotation after step 11, or create it and fill those fields).
- Order **OL**: an order whose `status` is set to `"In transit"` directly in the dev database (Phase 3 only).

**Migrations:** none under the recommended options. Check `packages/db/src/migrations/meta/_journal.json` still ends at the merged head, not the command exit code.

**Test commands** (read each output for `failed`; `bun run check-types` can exit 0 while printing "failed"):
- Phase 1: `bunx vp test run packages/api/src/modules/collective-order/job-shape.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/routers/collective-order.under-review.test.ts packages/api/src/routers/collective-order.guards.test.ts packages/api/src/routers/collective-order.numbering.test.ts packages/api/src/routers/collective-order.clearing.test.ts packages/api/src/modules/audit/seed.test.ts packages/api/src/architecture.test.ts`, then `DATABASE_URL_TEST=<dev test branch> bunx vp test run packages/api/src/routers/collective-order.concurrency.test.ts` (confirm it ran, not skipped), then `bun run e2e -- e2e/specs/audit.order-queue.spec.ts e2e/specs/audit.review-queue.spec.ts e2e/specs/audit.post-approval.spec.ts` (the `e2e` script uses `e2e/playwright.config.ts`, which owns `e2e/specs`; `e2e:parity` does not run them), then the operations seeder against a fresh dev org, reading its output for `collective_order submitted 6`.
- Phase 2: `bunx vp test run apps/web/src/components/order-ledger/order-readiness.test.tsx apps/web/src/components/order-form.payload.test.ts apps/web/src/components/order-form-retired-type.test.ts apps/web/src/order-form-clearing.test.ts apps/web/src/architecture.test.ts`, then `bun run check-types`.
- Phase 3: `bunx vp test run packages/api/src/modules/collective-order/order-status.test.ts packages/api/src/routers/collective-order.guards.test.ts packages/api/src/routers/collective-order.parity.test.ts packages/api/src/routers/collective-order.clearing.test.ts apps/web/src/architecture.test.ts apps/web/src/components/order-ledger/order-ledger-parity-*.test.ts`, then `bun run check-types`.

**Golden path, Phase 1 (Journey 1):**
1. As the submitter, open `/order/sea-export` → the OS row shows Audit status **Draft**.
2. Click the row's **Review this order** (clipboard icon) → **Submit for review** → toast _"Refused — This order cannot go for review yet. Missing: Vessel name, Voyage, ETD."_ The row still reads **Draft**.
3. Open OS (`/order/<OS>/edit`), fill in Vessel name `E2E VESSEL`, Voyage `001E` and an ETD, then **Save** → toast **Order updated**, and the app lands on `/order/sea-export`.
4. **Review this order** → **Submit for review** → toast _"1 row — submit for review"_. The row reads **Pending**.
5. As the accountant, open `/approve/order` → OS is listed.

**Phase 1, edge case 1 (Journey 2, freeze; regression on step 15's guard under D5-C):**
1. With OS pending, open `/order/<OS>/edit` as the submitter, change Voyage to `002E`, and **Save** → toast _"This record is under review and cannot be edited. Retract the submission first."_
2. Reload → Voyage still reads `001E`.
3. On the ledger, **Review this order** → **Request withdrawal** → toast confirms, and the row returns to an editable state.
4. Edit and save → **Order updated**.
5. Resubmit OS. While it is pending, open `/order/<OS>/expenses`, add a fee `THC 100` and save → saved (step 15 D2-B; fees are not frozen).

**Phase 1, edge case 2 (masked caller).** As a role with `collectiveOrder.clientName` masked, if one exists in the seed, submit an order with no client → the toast names "Client" and shows no value. If no seeded role masks the field, record "not exercised" and rely on the router test.

**Phase 1, edge case 3 (other resources).** Submit an approved-flow quotation from `/quotations` → it behaves exactly as before (no readiness message).

**Phase 1, edge case 4 (race).** Proven by `collective-order.concurrency.test.ts` [NEW] (Task 1.2) against `DATABASE_URL_TEST`, not by a browser walk and not by timestamps: `submitted_at` and `audit_log.created_at` are both `defaultNow()` (`packages/db/src/schema/audit.ts:370`, `audit-log.ts:25`), which is transaction start, so a correctly serialised update can carry a later timestamp than a submit that started first. Pass: in every interleave, exactly one of submit and update returns 200, and the final state matches the winner (submission present with vessel intact, or no submission with vessel cleared). Probe P7 stays a production sizing query only.

**Golden path, Phase 2 (Journey 3):**
1. Open `/order/new?type=sea_import` → the **Before review** panel lists Job Number, Client, Operation Personnel, Port of shipment, Port of destination, Vessel name, Voyage, ETA and "at least one container line". **Business information**, **Shipping space**, **Internal** and **Cargo & fees** each show an amber dot.
2. Pick a client → "Client" leaves the list.
3. Fill in everything in **Shipping space** → its dot clears.
4. Add a container line with case type `40HQ` → "container line" clears, and the **Cargo & fees** dot clears.
5. Leave Operation Personnel empty and press **Save** → toast **Order created** (saving is not blocked).
6. The Containers editor header reads "Containers (case type & TEU)".

**Phase 2 edge case.** On `/order/new?type=logistics_park_cd`, the panel does not list ports or vessel (they are excluded for that trade) but does list "at least one cargo line".

**Golden path, Phase 3 (Journey 4):**
1. Open `/order/<OS>/edit` → **Order status** is a dropdown listing Booked … Payables entered.
2. Choose **Booked**, then **Save** → **Order updated**.
3. On `/order/sea-export`, the Status column for OS reads **Booked**. Open filters → **Order status** is a dropdown. Choose **Booked** → only orders at that milestone are listed.
4. Open `/order/<OL>/edit` → Order status shows **In transit (old value)**. Change Comments and **Save** → **Order updated**, and the status still reads "In transit".

**Phase 3 edge case 1.** From a node walk script with the submitter cookie, `collectiveOrder.update({ orderId: OS, status: "Arrived" })` → BAD_REQUEST naming the Sea Export list, and OS still reads **Booked**.

**Phase 3 edge case 2 (tab opened before the release).** Before deploying Phase 3 locally, open `/order/<OS>/edit` in a tab; restart the servers on the Phase 3 build without reloading that tab. Type `Arrived` into the old free-text Order status box and **Save** → toast ends with _"If you see a text box for Order status, reload the page."_, and a reload of the ledger shows OS unchanged. Reload the edit tab → Order status is the dropdown.

**Regression check.**
- `/order/new` → create an order with only the automatically filled fields → **Order created** (saving is unaffected).
- **Duplicate** on OS → the copy has no status and is Draft.
- `/approve/order` → approving OS works for accounting.
- The quotation → **Convert to order** flow still lands on the edit form, and the panel lists only vessel, voyage and ETD for a sea-export conversion.
- `/tracking` is unchanged.

**Mobile:** at 400px, the Before review panel wraps above the rail without horizontal scroll, rail dots stay visible, and the Order status dropdown fits the field column.

**Readiness: 8/10. Decisions settled 2026-09-17 (all D1–D15 Decided, §9).** The engine seam, every caller (including the fees page and the operations seeder) and the single owner of the freeze and lock are located, and the race has a deterministic real-Postgres test. What holds the score back:
- D2 and D3 are settled but still need operations input and production probes (P1, P3–P5) re-checked before Tasks 1.1 and 3.1. The non-sea status chains are proposals, not captured eyun data; if a probe contradicts the choice, stop and re-plan.
- The D5-C settlement (X6) must still be written into steps 12 and 15 (§7 hand-offs) before either plan executes; step 15 §7.6 still lists "12–14 (no plans yet)".
- Phase 1 depends on five other plans (07 Phase 3, 08, 10, 11 Phase 2, 12 Phase 1 and, under D5-C, 15 Phase 1) merging first into the same files, so every line reference will move.
- The legacy review bypass stays open until step 15 Phase 2 deletes the verbs (D7-A).
- The submit-versus-edit race is proven on a dev test database only: CI has no `DATABASE_URL_TEST`, so each PR pastes the real-Postgres run output (X8).
- X13's accepted known gaps (submit-time order state, keeping rejected orders out of the ledgers, SOP text for steps 14–15) stay unowned.

## Review disposition (2026-09-17)

1. blocker · correctness · Step 14 and step 15 both claimed the order under-review freeze and row locks, in conflicting shapes (all of `saveChildren` vs D2-B; lock in `readinessProblem` vs `exists`) → **Fixed**: D5 reframed as "who owns it", recommendation changed to D5-C (step 15 owns; step 15 Phase 1 is a prerequisite of step 14 Phase 1); D5-A kept as the alternative that adopts step 15 §4.1 verbatim. Header, §1, §4 "Under-review freeze and submit lock", §5 prerequisites, old Task 1.3 removed, §6, §7 collisions and merge order, §9 D5. Edits to steps 12 and 15 are **Deferred** to their own revision passes (this pass edits step 14 only); the exact text is in §7 "Hand-offs that must be written into the other plans".
2. major · correctness · Fees page `order.$orderId.expenses.tsx:598` calls `saveChildren` (costs only) and was missing from §7 → **Fixed**: added to Phase 0 defect 1 and §7 frozen writers (verified by grep over `apps`, `e2e`, `seed`); freeze follows step 15 D2-B, proven by step 15 Task 1.4 case 2; §10 edge case 1 step 5 walks a fee under review; Journey 2 and §3 say fees stay writable.
3. major · correctness · Lock inside `readinessProblem` runs after the unlocked open-attempt check, so two submits both pass it → **Fixed**: hook is a plain read; lock lives in `REVIEWABLE_RESOURCES.collective_order.exists` (step 15 Task 1.3 / D10-A, step 08 Task 1.2 pattern), called at `submit.ts:39` before `:71-84`. §4 data flow and engine hook, Task 1.2, §8 item 6.
4. minor · correctness · Wrong citations for `batchPatchFields` and `update`'s `jobNumber` write → **Fixed**: `batchPatchFields` built at `:348-353`, used at `:3004`; `normaliseJobNumber` defined at `:2298`, `update` builds `values` at `:2915` and writes at `:2933-2935` (Phase 0).
5. major · data-safety · Freezing all of `saveChildren` blocks fee booking under review → **Fixed** (same as 2): D2-B exemption adopted under both D5-C and D5-A; §7, Journey 2, §10.
6. major · data-safety · Operations seeder (`seed/run-operations.ts:107-130`) submits six orders lacking Operation Personnel, Vessel name and Voyage and exits 1 → **Fixed**: Phase 0 Seed note, new Task 1.3 (`seed/operations.ts:213-231` values plus raw insert `:247-258`), Phase 1 acceptance, §6 Agent B, §7 impact row and collision row, §9 risk, §10 test commands.
7. minor · data-safety · `updateBatch` lock without deterministic order can deadlock → **Fixed**: `.orderBy(collectiveOrder.id).for("update")` stated in §4 (D5-A adoption list) and §8 item 6, citing HEAD `:3046-3049`; under D5-C it is step 15 §4.1's.
8. minor · data-safety · Phase 3 deploy recommended web-first with no mechanism and no old-tab case → **Fixed**: §7 Deployment coupling now requires one release (web built before deploy), names the old-tab BAD_REQUEST as an accepted outcome, adds the reload sentence to the §4 message, a Task 3.2 assertion and §10 Phase 3 edge case 2.
9. minor · data-safety · Step 12's `saveChildren` NULL `orderNo` and unlocked-read race hand-off had no owner → **Fixed**: §0 cross-plan items and a §9 Risk stating the rule (NULL on unnumbered jobs, repaired by the `assignNumber` re-stamp; Job Number required at submit) and that step 15 Task 1.3's unconditional lock on `saveChildren`'s load (`:3971-3990`) serialises it against `assignNumber`; `orderNo: order.jobNumber` verified at `:4453`.
10. major · verifiability · Double ownership with step 15, acceptance proven twice by different suites, different lock placement → **Fixed** (same as 1): Journey 2 acceptance is now a regression check on step 15's guard; step 14 re-runs `collective-order.under-review.test.ts` [NEW in step 15] instead of writing its own freeze tests; one lock placement.
11. major · verifiability · Race pass criterion used `defaultNow()` timestamps, which flag correct serialised runs → **Fixed**: Task 1.2 adds `collective-order.concurrency.test.ts` [NEW] on the `expense.concurrency.test.ts` pattern (`DATABASE_URL_TEST`, `describe.skipIf`) with a held-lock deterministic interleave judged by HTTP results plus final state; §10 edge case 4 rewritten; P7 marked sizing-only. Timestamps verified at `schema/audit.ts:370`, `audit-log.ts:25`.
12. major · verifiability · `seed-parity` has one owner and no ops/accounting; command lacked `--preload` → **Fixed**: §10 preconditions use `bun --preload apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>` (`seed-cli.ts:11-13`, `global-setup.ts:59`), which runs `seedOrgParams` and `seedAuditFlows`; submitter is `salesperson` (`sales` holds `collectiveOrder.update`, `roles.ts:142`) with `managerA` as fallback after an initiator check, reviewer is `accountant`. Walk steps re-worded.
13. minor · verifiability · `order-readiness.test.ts` cannot render JSX and cited a source-parse test → **Fixed**: renamed `order-readiness.test.tsx` [NEW] following `accept-status-tabs.test.tsx` (`renderToStaticMarkup`), in Task 2.1, §6 and §10.
14. minor · verifiability · "the e2e runner" is not a command → **Fixed**: `bun run e2e -- e2e/specs/audit.order-queue.spec.ts e2e/specs/audit.review-queue.spec.ts e2e/specs/audit.post-approval.spec.ts` (script `e2e` uses `e2e/playwright.config.ts`, `package.json:61`).

### Self-review gate (2026-09-17)

Run against this file after reclassifying §9. Evidence re-read at HEAD `6bb3a1bf` with `git grep` / `git show HEAD:` (the working tree has unrelated uncommitted deletions, so HEAD was read directly).

- **§4 models and endpoints name a journey step:** fixed. The engine hook, `auditReview.submit`, the under-review refusals, the status writers and the list filter now name Journeys 1, 2 and 4.
- **§5 tasks list real paths:** pass. Every existing path in Tasks 1.1–3.4 was confirmed at HEAD, including the nine configs and nine `order-ledger-parity-*.test.ts` files. The five `[NEW]` files are absent at HEAD; `collective-order.concurrency.test.ts` is now conditional on D11.
- **One owner agent per §5 task:** pass (A: 1.1–1.2, B: 1.3–1.4, C: 2.1–2.2, D: 3.1–3.2, E: 3.3–3.4).
- **No new dependency outside a §9 open question:** pass. No package is added.
- **Every §9 decision has three approaches, one recommendation, a status and blocking:** fixed. D1–D11 are Open (D1, D2, D3, D4, D5, D8, D9, D10 and D11 blocking; D6 and D7 not), D12–D15 are Assumed, none is Decided. D9 moved into the blocking group and gained a reason. D10 (engine seam, crosscheck X9), D11 (concurrency test file, X8) and D12–D15 (judgment calls §4 had made without alternatives) were added. D5 references X6 and stays Open and blocking. **Superseded 2026-09-17:** Wilfred accepted every recommendation, so D1–D15 are all Decided; see "Decisions settled (2026-09-17)" below.
- **Every §1 assumption and §4 key decision points at a §9 id:** fixed. §1 now splits Assumed (D12–D15) from Open decisions the plan is written for, and §4 Key decisions lists D1–D15 with statuses.
- **Input Gate questions recorded as Decided:** n/a. No Input Gate was held, and §1 says so.
- **§7 caller list from a grep this session:** fixed. Added the seed helper callers (only `seed/run-operations.ts:107` submits orders), the web caller `apps/web/src/lib/audit-review.ts:38`, the `e2e/order-parity/ledger-row-actions.spec.ts:162` update caller, and the `updateBatch` non-callers; corrected `duplicate`'s `status: null` to `:2698`; corrected the `seed/operations.ts` collision row (X12); added collision rows for D10 and D11.
- **§10 URL and port:** pass. `http://localhost:3101` matches `apps/web/vite.config.ts:8` at HEAD.
- **Migration numbers match the journal:** pass. The journal ends at idx 64, tag `0065_quotation_send_decision`, which is the last `.sql` file. Conditional migrations are now named `00NN_<name>` (X14), and D8-B was added to that list.
- **Tier in META.md:** n/a here (META.md is written from this pass's return values): Standard, 3 phases.
- **§1 Assumptions lists every judgment call with its §9 id:** fixed (D12–D15).
- **Context files named, requirements planned or declined, conflicts in §9:** pass. The header names SOP step 14 and tracker items `nct-job-shape` (planned) and `nct-haulage` (declined to step 19 through D6); SOP-versus-code conflicts are in §9 "SOP text vs code". X13 (submit-time order state) is now listed as out of scope.


### Decisions settled (2026-09-17)

Wilfred accepted the recommended option for every decision in this plan, and every settlement in `steps-12-15-crosscheck.md` (X6–X16). One line per decision:

- **D1 → A** — readiness is enforced at submit for review, through step 07's `assertPublishable?` hook; saving a draft stays free.
- **D2 → A** — a small core (Job Number, Client, Operation Personnel) plus route/schedule/cargo per trade, held as data in `REVIEW_REQUIREMENTS`. Re-check P3/P4 and operations input before Task 1.1.
- **D3 → A** — a code-owned milestone list per trade in `order-status.ts`, one current value in the existing text column. Re-check P1 and operations input on the non-sea chains before Task 3.1.
- **D4 → A** — legacy status text is left as it is, shown as "(old value)", and only new values must come from the list. Re-check P1 before Task 3.2.
- **D5 → C** — step 15 owns the under-review freeze and the `.for("update")` lock in `REVIEWABLE_RESOURCES.collective_order.exists`; step 15 Phase 1 merges before step 14 Phase 1 (crosscheck X6).
- **D6 → A** — nothing structural for haulage in step 14; drivers, dispatch, legs, POD and the truck-to-job link stay with step 19.
- **D7 → A** — the legacy `collectiveOrder.review` / `reviewBatch` bypass is left to step 15 Task 2.1, which deletes both verbs.
- **D8 → A** — the readiness rule applies to every `collective_order` submission in every org, with no per-flow switch. Re-check P5 before Task 1.2.
- **D9 → A** — readiness shows on the edit form ("Before review" panel plus rail dots) and in the ledger's server-refusal toast; no ledger query change.
- **D10 → A** — the check implements step 07's `assertPublishable?` on the `collective_order` entry; no new interface member and no `submit.ts` edit (crosscheck X9). Accepted side effect: an incomplete order already under review cannot be approved until it is withdrawn, completed and resubmitted. Re-check step 07's call placement before Task 1.2.
- **D11 → A** — step 15 creates `collective-order.concurrency.test.ts`; step 14 adds one `describe` for submit-vs-clear-vessel (crosscheck X8). CI has no `DATABASE_URL_TEST`, so the PR pastes the real-Postgres output.
- **D12 → A** — the rules live in one pure module, `modules/collective-order/job-shape.ts`, imported by the web through the `"./*"` export.
- **D13 → A** — status values are checked in the `create` / `update` / `updateBatch` handlers after the scoped load, not in zod.
- **D14 → A** — the ledger filter uses `eq` for a known key and keeps `ilike` for any other text.
- **D15 → A** — Phase 3's server and web ship in one release; the old-tab BAD_REQUEST ending "reload the page" is accepted.

**Cross-plan settlements accepted the same day** (`steps-12-15-crosscheck.md`): X6 (step 15 owns the freeze and the `exists` lock; merge 15 Phase 1 before 14 Phase 1), X7 (step 12 Task 1.1 owns the `assignNumber` row lock), X8 (concurrency-test ownership, with real-Postgres output pasted into each PR), X9 (step 14 reuses step 07's `assertPublishable`), X11 (the widened `orderNo` re-stamp sits in step 11 Task 2.4), X12 (step 14 Phase 1 merges before step 15 Phase 3 for `seed/operations.ts`), X13 (submit-time order-state checks, keeping rejected orders out of the ledgers, and SOP text for steps 14–15 stay **unowned** — accepted known gaps), X14 (conditional migrations are named `00NN_<name>` and numbered at merge), X16 (the uncommitted e2e changes in `nct-layout` are committed before Wave 6).
