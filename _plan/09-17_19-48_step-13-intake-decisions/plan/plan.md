# Step 13: a received order opens straight into operations, and a rejection can only be undone by a separate, recorded reopen

**SOP step:** 13 "Receive it into operations" · `/order/to-receive` (Operations → To Receive) → row tick / Reject ✕, or the detail pane's **Receive this order** / **Rejected**
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-17. This is the commit steps 04-11 were planned at. `git status -- apps packages` is clean. `e2e/` has uncommitted edits (`e2e/fixtures/seed-cli.ts`, `types.ts`, `playwright.config.ts`, `qa-manifest.ts`, untracked `e2e/specs/intake.golden-path.spec.ts`); none references `receive`/`reject` (grep in the self-review pass), but they shift `seed-cli.ts` lines after `:25`, so §10 locates that file by symbol. Every `file:line` below was found by searching for its symbol at that HEAD in this pass.
**Tier:** Standard. Phase 1 is web only. Phase 2 changes what a write procedure refuses, adds a procedure and a permission node, and changes an architecture-test allow-list. **No migration** (D3-A, Decided 2026-09-17).
**Owns tracker items:** `nct-s13-intake-decisions-are-asymmetrical` (step 13) and the **To Receive half** of `nct-dead-queues` (break after 13). The Shipment review half of `nct-dead-queues` belongs to step 17 (phase D). It is recorded below and not planned.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`). Drizzle schema in `packages/db/src/schema`, migrations in `packages/db/src/migrations`. TanStack Router file routes in `apps/web/src/routes/_next`. zod on both sides. vitest on PGlite (`pushTestSchema`). Playwright for e2e.

- **The screen.**
  - Route `/_next/order/to-receive` is at `apps/web/src/routes/_next/order.to-receive.tsx:95` (1,606 lines). There is no `_auth` twin.
  - Nav entry Operations → To Receive, gated `p: "collectiveOrder:read"` (`apps/web/src/components/shell-next/nav.ts:151-155`).
  - Pool-strip "To receive" counter: query `receiveQuery` (`pool-strip.tsx:132`), entry at `:198-204`.
  - The list defaults to `acceptStatus: "unaccepted"` (`listInput`, `order.to-receive.tsx:684-687`). Status tabs are `<AcceptStatusTabs>` at `:1448`, with counts from `useAcceptStatusCounts()` at `:528`.
  - Row mapping at `:689-730`:
    - `acceptStatusRaw` keeps the enum (`:699`; docblock `:174-183`).
    - `businessType` is **mapped to its display label** (`:701`). The raw trade is not kept on the row, so the page cannot build a trade-specific link today.
    - The row does not map `acceptedAt`, `rejectedAt` or `rejectReason` either. A grep of the page finds those names only in a comment (`:406`). The Rejected tab never shows why or when an order was rejected.
  - Actions cell, `:370-436`:
    - `settled = received || rejected` (`:379`).
    - The tick (`:392-402`) and the Reject ✕ (`RejectDialog`, `:409-415`) are both disabled when settled, with the tooltip "Already decided".
    - The overflow menu holds only **Open details** (`:429-431`), which reopens the same pane.
  - `actOn(mode, ids, reason)` (`:745-783`) runs `Promise.allSettled` over receive/reject (`:752`), calls `queryClient.invalidateQueries()` with no key (`:759`), then toasts. It returns nothing, so a caller cannot tell a refusal from a success.
  - `decideReading` (`:866-876`) calls `actOn`, then **always** advances to the next row or closes the pane.
  - Pane actions (`:1576-1590`): **Receive this order** (`:1580`, `disabled={acting}` only) and `<RejectDialog disabled={acting}>`. **Neither is gated on `settled`.**
  - `RejectDialog` (`apps/web/src/components/reject-dialog.tsx:30`):
    - The reason is optional (`:117`), trimmed and sent as `undefined` when empty (`:129`).
    - Title "Reject N order(s)" (`:108`).
    - The non-icon trigger reads "Rejected", and its description still talks about a selection that no longer exists.

- **The procedures** (`packages/api/src/routers/collective-order.ts`, 4,871 lines).
  - `receive` (`:3203`, comment `:3202` "accept an intake order into its business-type list"):
    - Gate `requireNode(COLLECTIVE_ORDER.receive)`. Input `{ orderId }` with no reason (`:3205`).
    - In one transaction it runs a scoped load **with no row lock** (`:3210-3213`), then `assertUnlocked` (`:3217`).
    - It refuses only `received` (`:3229-3231`).
    - It sets `received`, `acceptedAt = now` and **clears `rejectedAt` and `rejectReason`** (`:3240-3245`).
    - It writes `collectiveOrder.receive` with `before: { acceptStatus }` (`:3248-3256`).
    - The comment at `:3218-3228` says `rejected → received` "stays LEGAL on purpose… refusing it would make rejection terminal and unrecoverable", and carries `TODO(verify-semantics)` (eyun unobserved).
  - `reject` (`:3316`):
    - Gate `COLLECTIVE_ORDER.reject`. Input `{ orderId, reason?: max 500 }` (`:3318`).
    - Scoped load with no lock, then `assertUnlocked` (`:3330`).
    - It refuses anything but `unaccepted` (`:3335-3339`), with the message `Cannot reject an order that is already ${existing.acceptStatus}`, which puts the raw enum in the toast.
    - It sets `rejected`, `rejectedAt` and `rejectReason` (`:3344-3348`), and writes `collectiveOrder.reject` with the reason in `after` (`:3351-3359`).
    - Its comment (`:3331-3334`) sends retirement of a received order to lifecycle (end / archive / delete).
  - `unacceptedCount` (`:3266`) and `acceptStatusCounts` (`:3296`) are both gated on **receive**, not read.
  - `assertUnlocked` is at `:547`.
  - `acceptStatus` is absent from `orderFields` (`:138`). The only writers are `receive`, `reject` and `duplicate`'s reset to `unaccepted` (`:2694`).
  - `list` (`:2431`) filters by status only when one is passed (`:1242`).
- **Schema** (`packages/db/src/schema/collective-order.ts`):
  - `AcceptStatus` at `:59`. `accept_status` defaults to `unaccepted`, not null (`:130`), with index `collective_order_acceptStatus_idx` (`:354`).
  - `accepted_at` `:317`, `rejected_at` `:321`, `reject_reason` `:322`.
  - There is no `accepted_by` / `rejected_by`.
  - `audit_log` indexes org, actor, created_at and action (`packages/db/src/schema/audit-log.ts:28-31`), **not `target_id`**.

- **Permissions.**
  - Nodes `receive` / `reject`: `modules/collective-order/permissions.ts:17-18`, registered as endpoints under the root at `:84-93`.
  - Resolution is by dotted ancestor (`permittedNode`, `packages/api/src/procedures/org.ts:235`).
  - Roles (`packages/api/src/roles.ts`):
    - admin (`:88`, root `:93`), branch-manager (`:102`, root `:107`) and ops (`:154`, root `:169`, comment "Receiving, rejecting…" `:167`) hold the `collectiveOrder` root.
    - sales (`:124`) hold read/create/duplicate/update/detail only.
    - accounting (`:174`) hold read/detail/review. director (`:203`) and viewer (`:227`) hold read.
  - **Node catalog.** `seedPermissionNodes` (`packages/api/src/roles.ts:249`, upsert from the module registry) is called only by `seedSystemRoles` (`roles.ts:393`, at org creation, `routers/org.ts:125`) and `topUpSystemRoleGrants` (`roles.ts:372`, behind the admin button `role.syncSystemRoles`, `routers/role.ts:379-384`, pressed from `apps/web/src/routes/_next/permissions.tsx:1048`). The script `packages/api/src/scripts/seed-nodes.ts` (`packages/api/package.json:17` `db:seed-nodes`) is **not run by any workflow** (grep of `.github` finds no caller), and it **cannot run under bun**: it imports `createDb` from `@nct-ai/db`, whose `packages/db/src/index.ts:1` imports `env` from `@nct-ai/env/server`, which re-exports `cloudflare:workers` (`packages/env/src/server.ts:5`). `docs/plans/plan-of-record-2026-07-30.md:227` records that nodes are inserted by hand on dev for this reason.
  - `role_node_grant.node_key` and `member_override.node_key` are FKs to `permission_node.key` (`packages/db/src/schema/permissions.ts:42-44`, `:107-109`). A grant of a node that is not in the catalog fails. Root holders reach a new node through ancestor resolution in `requireNode` (`procedures/org.ts:230`), so they do not need the row.
  - The web has **no module-node check**. `usePermissionGate` (`apps/web/src/components/shell-next/use-overview-view.ts:115`) reads the flat matrix from `org.members.me` (`packages/api/src/routers/org.ts:500-503`). The pool strip's precedent is "hide on query error" (`pool-strip.tsx:120-139`).

- **Finding `nct-s13-intake-decisions-are-asymmetrical`: CONFIRMED, with one correction.**
  - True: a received order cannot be rejected (`:3335`). Test: `collective-order.guards.test.ts:321-328`.
  - True: a rejected order can be received. It is deliberate (`:3218-3228`), and a test pins it (`:351-363`, "ALLOWS re-receiving a rejected order, and records the correction").
  - **Overstated:** "with no second decision recorded". An audit row **is** written (`collectiveOrder.receive`, `before_json = {"acceptStatus":"rejected"}`). What is actually missing:
    1. The reversal carries no reason. `receive` has no reason field.
    2. It wipes the rejection stamps from the row (`:3243-3244`). The original reason survives only in the reject audit row, and `audit_log` has no `target_id` index to find it.
    3. It is the same verb and the same node as an ordinary receive, so it is not a visible, separate decision.
    4. Nothing takes a row lock. A reject and a receive pressed together can both load `unaccepted` and both commit. The last writer wins, leaving two audit rows that contradict each other.
  - **The UI path the finding does not name:** on the Rejected tab, click a row, then **Receive this order** (`:1580`, not gated on `settled`). The order moves to received silently.

- **Finding `nct-dead-queues`, To Receive half: CONFIRMED.**
  - The pane's actions hold only Receive and Reject (`:1576-1590`). The overflow menu is **Open details** only (`:429-431`). The page renders no `Link` and no `navigate` to an order.
  - The SOP's own hand-off is manual: "Note the order number, then open the matching trade ledger" (`customer-intake-sop/sop.json:2046-2050`; result `:2063`). The flow card says the same (`tracker/seed/flow-nct.json:178`).
  - **The link target already exists, and so does the map. The Phase 0 evidence did not name the map:**
    - Record pages `apps/web/src/routes/_next/order.<trade>_.$orderId.tsx` exist for all nine trades (e.g. `order.sea-export_.$orderId.tsx:32`).
    - `TRADE_SEGMENT: Record<BusinessType, string>` and `recordTo()` in `apps/web/src/components/shell-next/record-routes.ts:22`, `:63` already map `businessType → /order/<segment>/<id>`. The three non-mechanical cases are `logistics_park_cd → logistics`, `road → land`, `domestic_water → domestic-trade`.
    - `record-routes.test.ts` reads the nine configs' `DETAIL_ROUTE` constants as text and fails when the two disagree.
    - Global search already uses it (`rail-search.tsx:296`).
  - **The pattern to copy:** the ledger pane's **Open full page** (`apps/web/src/components/order-ledger/order-ledger-page.tsx:1229-1236`) passes a route **pattern** plus `params` to `<Link>` (`types.ts:193-205` explains why: a pattern keeps TanStack's param type check). The record page's **Edit order** is one click further (`order-record-page.tsx:123`). `orderNoCell` (`apps/web/src/components/order-no-cell.tsx`) documents the "record page first, form one click away" rule.

- **Shipment review half of `nct-dead-queues`: OUT OF SCOPE (step 17).** Evidence recorded only:
  - `apps/web/src/routes/_next/approve/lading.tsx` exists and mounts the lading ledger.
  - `seed/operations.ts:402-411` notes that `/approve/lading` reads `lading`, not `bl_job`.
  - `ReviewMenu` is imported by the order-ledger configs, `order-row-actions.tsx` and `review-queue.tsx`, and by no lading screen.
  - `approve/company.tsx` and `approve/contract.tsx` exist. Nobody verified their submitters in this pass.
  - Step 17's plan owns all of it.

- **Adjacent defects found (NEW, not in the tracker).**
  1. **Receiving gates nothing.**
     - `OrderLedgerPage`'s list input is `{ businessType, ...filters.applied, awaitingMyReview }` (`order-ledger-page.tsx:339-343`), with no `acceptStatus`. Unaccepted **and rejected** orders already appear in, and can be worked from, all nine trade ledgers.
     - `update` (`:2847`), `transition` (`:3581`), `batch` (`:3694`), `saveChildren` (`:3954`) and `review` (`:3380`) never read `acceptStatus`. The only other references are the delete/batch audit snapshots (`:3184`, `:3747`, `:3850`).
     - So the intake decision is advisory, and "terminal rejection" can only mean terminal **at intake** unless D4 goes further.
  2. **The page does not know who may decide.** Sales hold read but not receive/reject. They see enabled buttons that fail with FORBIDDEN, and the tab counts fail silently (`acceptStatusCounts` is gated on receive).
  3. **The decider is not on the row** (no `*_by` columns), and the audit table cannot be looked up by target efficiently.
  4. **Reject's CONFLICT message shows raw enums** (`:3337`).
  5. **`decideReading` advances on refusal** (`:866-876`), so the refused order leaves the pane.
  6. **`actOn` invalidates every query** (`:759`). Minor, and not planned (no opportunistic cleanup).
  7. **The Rejected tab hides the rejection.** No reason and no time is shown (see above).
  8. The pane's reject trigger reads "Rejected", and the dialog description mentions a selection. This is copy, not planned here.

- **Tests that pin today's behaviour.**
  - `packages/api/src/routers/collective-order.guards.test.ts`: intake block `:306-363`; `NODE_KEYS` seed list `:69-81` (a new node must be added there); counts `:1369-1408`; `unacceptedCount` `:1410`.
  - `collective-order.seeded-roles.test.ts:114-121` (ops can receive).
  - `collective-order.parity.test.ts:101`, `:315-320`.
  - `packages/api/src/architecture.test.ts:495-496` lists `collectiveOrderRouter.receive` / `.reject :: update(collectiveOrder)`. The stale-entry rule is at `:1128`.
  - `apps/web/src/components/order-ledger/accept-status-tabs.test.tsx`.
  - e2e: `e2e/to-receive/row-actions.spec.ts` (header case 4 "an already-decided order cannot be decided twice", `:18`), `e2e/page-objects/to-receive.page.ts` (`receiveButtonIn` `:172`, `rejectButtonIn` `:180`).
  - **Correction to the Phase 0 evidence:** these specs **do** run in CI. `.github/workflows/e2e.yml:81` "Run the parity suite" runs `bun run e2e:parity` (`:99`, root `playwright.config.ts`, `testDir: ./e2e`).
  - Seeder: `seed/operations.ts` `acceptPass` (`:318`) receives or rejects by index bucket and counts any error matching `/already|CONFLICT/i` as convergence (`:368-378`).

- **SOP text vs code.**
  - "Receive it, which stamps the acceptance time, or reject it with a reason": true, but the reason is optional.
  - "Re-receiving an accepted order is refused": true (`:3229`).
  - The pitfall "a rejected one can still be received" is true (the finding).
  - "Open it from its trade ledger for step 14" is manual because of the dead end.
  - The SOP role line "needs collectiveOrder:read to see the queue, plus receive/reject to decide" matches the server, but the page does not act on it (adjacent 2).

- **Migration state.**
  - `packages/db/src/migrations/meta/_journal.json` has 65 entries, the last `idx 64`, `tag 0065_quotation_send_decision`. The last files on disk are `0063_alert_snooze_expiry.sql`, `0064_company_contact.sql` and `0065_quotation_send_decision.sql`. Nothing is pending.
  - Reserved by other plans: 0066 (01), 0067 (02), 0068 (04), 0069-0072 conditional (05-08), 0073 (09), 0074 (10). Step 11's conditional `0075_…` is dead (11 D3-A was chosen; `steps-12-15-crosscheck.md` §3), and every conditional migration in steps 11-15 uses an `00NN_` placeholder numbered at merge (X14). Re-verified in the self-review pass: the journal has 65 entries ending `idx 64` `0065_quotation_send_decision`.
  - **This plan needs no migration**, because D3-A is Decided. The `00NN_collective_order_intake_actor` placeholder that D3-B/C would have needed is dead; any conditional migration in steps 11-15 that does survive is named `00NN_<name>` and numbered at merge (X14).

- **Overlap with plans 04-11.**
  - No plan in 04-10 touches `receive`, `reject`, `acceptStatus` or the To Receive page.
  - **Step 11 Phase 2 Task 2.1** moves `collective-order.ts:2288-2418` (`MAX_JOB_NUMBER_ATTEMPTS` `:2288` through `insertOrderWithJobNumber` `:2363`) to `modules/collective-order/insert-order.ts` [NEW in step 11]. It also re-keys and removes entries in `architecture.test.ts` next to `:495-496`. Every step-13 API line cited here shifts by about 130 lines after that merge. **Tasks locate by symbol.**
  - Step 11's conversion inserts `collective_order` with the default `accept_status = 'unaccepted'`, so converted jobs arrive in To Receive. After step 11 Phase 2 they arrive numbered. This plan assumes both and needs neither.
  - Steps 08/10 change the **audit engine**. This plan does not touch `collectiveOrder.review`, the engine or `gates.ts`, and the reopen is deliberately **not** routed through the engine (D1).
  - **Steps 12, 14 and 15 now have plans that write `routers/collective-order.ts`, none in `receive`, `reject` or the new `reopen`** (checked by grep of each plan this pass):
    - `step-12-job-number.md` Task 1.1: `.for("update")` on `assignNumber`'s scoped load, plus its allow-list comment.
    - `step-14-job-shape.md` Task 1.2: a readiness hook on the order review engine, reusing step 07's `assertPublishable` hook (X9). Its revised text (D5-C, Decided) no longer writes freeze guards or locks; they belong to step 15 (X6).
    - `step-15-order-approval-integrity.md` Tasks 1.2-1.3: freeze guards and `.for("update")` on the order content writers (`update`, `assignNumber`, `setAbnormalTags`, `delete`, `updateBatch`, `batch`, `saveChildren`) and the `collective_order.exists` lock. Task 2.1 deletes the legacy `review` and `reviewBatch` and their allow-list entries, and drops `isEndpoint` on `[COLLECTIVE_ORDER.review]` in `modules/collective-order/permissions.ts:94-98`, next to this plan's `reopen` node.
    - **Who owns the under-review freeze and row lock is settled: step 15** (`steps-12-15-crosscheck.md` **X6**, accepted 2026-09-17; step 12 D5, step 14 D5 and step 15 D17 all resolve to it). Step 15 Phase 1 freezes the order content writers and takes the lock in `collective_order.exists`, and **15 P1 merges before 14 P1**. Step 13 does not depend on it: `receive`, `reject` and `reopen` are on no plan's frozen-writer list. See §9 "Cross-plan item X6".
    - Step 14 also owns the record/edit page the new link lands on.
    - Consequence for step 13: Phase 2 rebases **after 11, 12, 14 and 15 whenever they merge first**, and re-finds `receive`, `reject`, the allow-list strings and `NODE_KEYS` by symbol.

---

## 1. Overview

**Problem.**
- An operator who receives an order in To Receive has nowhere to go. The queue has no way out to the order, so step 14 starts with "note the number, find the right ledger, search for it".
- The two intake verbs are also lopsided. A rejection can be silently undone by pressing **Receive this order** in the pane. That undo gives no reason, takes the same permission as an ordinary receive, and wipes the rejection's time and reason off the row.
- Two people deciding the same order at once can both succeed.

**Goal.**
- **Phase 1 (dead end):** from To Receive, one click opens the order's record page, for any of the nine trades.
- **Phase 2 (asymmetry):**
  - `receive` and `reject` are each legal only from `unaccepted`.
  - Undoing a rejection is a separate **Reopen** that requires a reason, has its own permission node and audit action, and returns the order to the queue for a normal receive.
  - The Rejected tab shows when and why.
  - Concurrent decisions serialize.
  - The page stops offering decisions to people who cannot make them.

**Success criteria.**
- On `/order/to-receive`, the reading pane of any row shows **Open full page**. It lands on `/order/<trade>/<id>` (e.g. `/order/land/<id>` for `road`), and that page's **Edit order** opens the form.
- `collectiveOrder.receive` on a rejected order returns CONFLICT with _"This order was already rejected on 03 Sep 2026. Reopen it with a reason before receiving it."_ It makes no row change and writes no audit row.
- `collectiveOrder.reopen({ orderId, reason })` on a rejected order sets `unaccepted`, keeps `rejectedAt` / `rejectReason` on the row, and writes `collectiveOrder.reopen` with the reason. On any other state it returns CONFLICT. Without a reason it returns BAD_REQUEST.
- On the Rejected tab the pane shows "Rejected on … · <reason>" and a **Reopen** button, and no Receive or Reject. On a reopened order back in Unaccepted, the pane shows "Previously rejected on … · <reason>".
- A refused decision leaves the pane on the same order.
- A sales member sees the queue and the link, but no decision buttons.

**In scope.**
- The To Receive pane and row actions.
- A link-pattern helper beside `TRADE_SEGMENT`.
- The `receive` refusal.
- The `reopen` procedure and node.
- Row locks on the three intake writers.
- Plain-language CONFLICT messages.
- Showing the intake stamps in the pane.
- Refusal-aware advance.
- Permission-aware buttons (D6).
- Tests, and read-only production probes.

**Out of scope.**
- Shipment review, lading submission, and the company and contract queues (step 17).
- Hiding unaccepted or rejected orders from the trade ledgers, or freezing edits on a rejected order (adjacent defect 1; D4-A, Decided: not in this step, and recorded as an **accepted known gap** under X13 until an owner is named).
- Rejecting an order after it was received (D1 keeps that in lifecycle: end / archive / delete).
- `accepted_by` / `rejected_by` columns (D3-B).
- The unkeyed `invalidateQueries` (adjacent 6).
- The "Rejected" trigger copy (adjacent 8).
- The unbounded `list` (existing, shared with every ledger).
- Anything in `collectiveOrder.review` or the audit engine (steps 08/10).

**Tracker items (`tracker/seed/tasks-nct.json`, steps containing `n: 13`):**

| Task id | Kind at step 13 | Planned here? | Why |
|---|---|---|---|
| `nct-s13-intake-decisions-are-asymmetrical` | `step` 13 | **Yes, Phase 2** | The refusal and the reopen live in the two intake procedures |
| `nct-dead-queues` | `break-after` 13 (and `step` 17) | **To Receive half: Phase 1.** Shipment review half: no | The step 17 half is a lading submission path, not a To Receive change |

**Input Gate.** No Input Gate was held; Wilfred accepted every recommendation on 2026-09-17 (§9).

**Decisions (settled 2026-09-17)** — every one is **Decided** in §9, with all three approaches kept there for the record:
- Undoing a rejection is a separate reopen verb, not a reasoned receive → D1-A
- A reopen returns the order to `unaccepted`, not straight to `received` → D2-A
- Reopen history lives in `audit_log`, and the row keeps the rejection stamps until the next decision → D3-A
- Receiving still does not gate the trade ledgers in this step → D4-A
- The link goes to the trade record page, not the edit form → D5-A
- Decision buttons are hidden when the counts query answers FORBIDDEN → D6-A
- Reopen gets its own endpoint node under the root → D7-A
- Rejection's reason stays optional → D8-A
- Concurrent intake decisions are serialized by `SELECT … FOR UPDATE` on the scoped load in all three handlers, proven on real Postgres → D9-A
- Phase 1 merges in any wave; Phase 2 merges after step 11 Phase 2 and rebases by symbol → D10-A
- A refused decision keeps the pane on the order, read by id → D11-A
- The `collectiveOrder.reopen` catalog row goes in by an owner-run INSERT → D12-A
- Cross-plan: step 15 owns the order under-review freeze and row lock (`steps-12-15-crosscheck.md` X6); step 13 does not depend on it → §9 Cross-plan item X6, Decided A

Several of these still carry a **re-check before the task runs** (a production probe or an operations answer): D3/D4 (P3, P4), D7/D12 (P8), D8 (P7), and the legacy-stamp tolerance in §4 (P5, P1). The choice stands; if a probe contradicts it, stop and re-plan rather than improvising.

## 2. User Journeys

**Journey 1 (changed, Phase 1): Operations receive an order and carry on into it**
Trigger: a converted job (step 11) or a new order (step 12) sits in **To Receive → Unaccepted orders**.
Steps:
1. Ops open Operations → To Receive → the Unaccepted tab lists the order.
2. Ops click the row → the reading pane opens with its fields. The pane actions read **Receive this order**, **Rejected** (today's trigger copy) and **Open full page ↗**.
3. Ops press the row tick or **Receive this order** → toast _"1 order received"_. The row leaves the Unaccepted tab, and the pane moves to the next order (unchanged).
4. To carry on with the order they just received, ops switch to the **Received order** tab, click the row, and press **Open full page** → the app navigates to `/order/<trade>/<id>`, the trade's record page.
   - The overflow menu on every row also offers **Open full page**, so a received row can be opened without the pane.
5. On the record page ops press **Edit order** (`order-record-page.tsx:123`) → `/order/<id>/edit` (step 14).
6. Flow ends: the order is received and open for operational detail. No ledger search.
Where it lives: the existing To Receive pane and row overflow menu. Navigation to an existing page.

Old journey, for contrast: step 4 had no link. The SOP said "note the order number, then open the matching trade ledger", which meant finding the right one of nine ledgers and searching it.

**Journey 2 (changed, Phase 2): Operations reject an order, and it stays rejected**
Trigger: a duplicate booking arrives at intake.
Steps:
1. Ops press the row's Reject ✕ → dialog "Reject 1 order(s)" → type _"duplicate of JOB2609-00041"_ → **Reject** → toast _"1 order rejected"_.
2. Ops open the **Rejected** tab and click the row → the pane shows an **Intake** group: _Rejected on 17 Sep 2026 · duplicate of JOB2609-00041_. The actions read **Reopen…** and **Open full page**. There is no Receive and no Reject.
3. The row's tick and ✕ stay disabled ("Already decided"). The row carries a **Reopen** icon.
4. Flow ends: the order stays rejected until someone reopens it on purpose.
Where it lives: the existing Rejected tab and pane.

Old journey, for contrast: at step 2 the pane offered an enabled **Receive this order**. One click moved the order to received, with no reason, the same permission as any receive, and the reason wiped from the row.

**Journey 3 (new, Phase 2): An ops lead reopens a mistaken rejection**
Trigger: the "duplicate" was a real second shipment.
Steps:
1. The ops lead opens the Rejected tab, clicks the row, and presses **Reopen…** → a dialog titled "Reopen JOB2609-00042" with a **required** reason (1-500 chars). The confirm button stays disabled while the reason is blank.
2. The lead types _"second container, not a duplicate — confirmed with sales"_ and presses **Reopen** → the server locks the row, checks `rejected`, and sets `unaccepted`. The audit row `collectiveOrder.reopen` holds the before state (including the old reason) and the new reason. Toast: _"JOB2609-00042 reopened, back in Unaccepted"_.
3. The row leaves the Rejected tab, and the Unaccepted count rises by one.
4. On the Unaccepted tab the pane's Intake group reads _Previously rejected on 17 Sep 2026 · duplicate of JOB2609-00041_. The actions are **Receive this order**, **Rejected** and **Open full page**.
5. Ops press **Receive this order** → received, as in Journey 1. The rejection stamps are cleared from the row (today's rule), and the full story stays in three audit rows: reject, reopen, receive.
6. Flow ends: two separate recorded decisions (reopen with its reason, then receive) replace one silent flip.
Where it lives: the existing Rejected tab and pane, plus a new small dialog.

**Journey 4 (new refusal, Phase 2): A stale tab tries to decide an order someone else already decided**
Trigger: two operators have the queue open, and A rejects an order that B is reading.
Steps:
1. B presses **Receive this order** in the pane → the server refuses with CONFLICT: _"This order was already rejected on 17 Sep 2026. Reopen it with a reason before receiving it."_
2. The toast shows the sentence. The list refetches and the order leaves the Unaccepted list. Per D11-A **the pane stays on the same order** (it no longer advances on a refusal; the pane reads the order by id through `collectiveOrder.get` once the row has left the filtered list) and shows the Rejected state with **Reopen…**, with no position/prev/next.
3. If A and B press at the same instant, the row lock serializes them: one succeeds, and the other gets the CONFLICT above, or _"This order was already received on …"_.
4. Flow ends: one decision recorded, and B knows why theirs was refused.
Where it lives: the existing pane and toast.

**Journey 5 (changed, Phase 2, D6): A salesperson looks at the queue**
Trigger: sales want to see whether their booking has been picked up.
Steps:
1. Sales open To Receive (they hold `collectiveOrder:read`) → the list renders. The tab bar shows no numbers (as today, because the counts query is refused).
2. The row Actions cell shows only the overflow menu (**Open details**, **Open full page**). The pane shows **Open full page** and no Receive, Reject or Reopen.
3. Flow ends: sales can find and open the order, and are not offered buttons that fail with FORBIDDEN.
Where it lives: the existing page.

## 3. Result (What Changes for the User)

**Before:** To Receive is a dead end: you decide, then go and find the order in its ledger. A rejected order can be received again with one unexplained click, and its rejection reason disappears. Everyone with read access sees decision buttons.
**After:** every order in the queue opens its record page in one click. A rejection stands until someone reopens it with a reason, and the Rejected tab shows when and why. Refused decisions say why in plain words and keep the order on screen.
**Key differences:**
- Ops: **Open full page** in the pane and in the row menu.
- Ops: a rejected order shows **Reopen…** (reason required) in place of an enabled **Receive this order**.
- Ops: the pane's Intake group shows received/rejected time and reason.
- Sales and other read-only roles: no decision buttons.
- Accounting and audit readers: reversals appear as their own `collectiveOrder.reopen` rows with a reason.

## 4. Technical Architecture

### Data flow

```
Phase 1 (web)
  row.businessTypeRaw ──► recordRoutePattern(trade) ──► <Link to="/order/<segment>/$orderId" params={{orderId}}>
                            (record-routes.ts, beside TRADE_SEGMENT)            (existing record routes)

Phase 2 (api)
  receive({orderId})
    tx: SELECT … WHERE id AND scope FOR UPDATE   (D9)
        assertUnlocked(existing, "received")
        assertIntakeTransition(existing, "receive")   → CONFLICT unless unaccepted   (D1)
        UPDATE set received, acceptedAt=now, rejectedAt=null, rejectReason=null        (unchanged)
        audit collectiveOrder.receive  before {acceptStatus} after {acceptStatus}      (unchanged)

  reject({orderId, reason?})
    tx: … FOR UPDATE; assertUnlocked; assertIntakeTransition(existing, "reject")   (message reworded)
        UPDATE / audit unchanged

  reopen({orderId, reason})                                                     [NEW]  (D1, D2, D7)
    tx: … FOR UPDATE; assertUnlocked(existing, "reopened")
        assertIntakeTransition(existing, "reopen")   → CONFLICT unless rejected
        UPDATE set acceptStatus='unaccepted'   (rejectedAt / rejectReason kept — D3-A; acceptedAt stays null)
        audit collectiveOrder.reopen  before {acceptStatus:'rejected', rejectedAt, rejectReason}
                                      after  {acceptStatus:'unaccepted', reason}
```

### Data model

**No schema change under D3-A.** `accept_status` keeps its three values, and "reopened" is not a fourth state. A reopened order is `unaccepted` with `rejected_at IS NOT NULL`, which is what Journey 3 step 4's "Previously rejected on …" reads. The D3-B columns below would serve the same step plus Journey 2 step 2 with an actor.

Not built (D3-A was chosen on 2026-09-17). Kept only so the rejected shape stays readable next to the decision — D3-B would have been:

```ts
// packages/db/src/schema/collective-order.ts, beside acceptedAt (:317) / rejectedAt (:321)
acceptedBy: text("accepted_by"),   // member id, nullable (legacy rows)
rejectedBy: text("rejected_by"),
reopenedAt: timestamp("reopened_at"),
reopenedBy: text("reopened_by"),
reopenReason: text("reopen_reason"),
```

That would have taken a conditional migration named `00NN_collective_order_intake_actor` [NEW], numbered at merge after the reserved 0066-0074 (X14). Under D3-A **this plan adds no migration at all**. D3-C (a history table) is written out in §9.

### Intake guard (Phase 2)

`packages/api/src/modules/collective-order/intake-guard.ts` [NEW] is pure, so tests and the web can share its predicate:

```ts
import type { AcceptStatus } from "@nct-ai/db/schema/collective-order"; // :59

export type IntakeVerb = "receive" | "reject" | "reopen";

/** Which state each verb is legal from. D1-A: every verb has exactly one source state. */
export const INTAKE_FROM: Record<IntakeVerb, AcceptStatus> = {
  receive: "unaccepted",
  reject: "unaccepted",
  reopen: "rejected",
};

export function canIntake(verb: IntakeVerb, status: AcceptStatus | string): boolean;

/** Throws ORPCError CONFLICT with an operator sentence (no raw enums). */
export function assertIntakeTransition(
  order: { acceptStatus: string; acceptedAt: Date | null; rejectedAt: Date | null },
  verb: IntakeVerb,
): void;
```

Messages. `<day>` is a `DD Mon YYYY` date (the same wording step 11 plans for its Lost message; no shared server date helper was located in this pass, so the guard formats it locally). The date clause is dropped when the stamp is null (legacy rows):

| verb × state | Message |
|---|---|
| receive × received | "This order was already received on <day>." |
| receive × rejected | "This order was already rejected on <day>. Reopen it with a reason before receiving it." |
| reject × received | "This order was already received on <day>, so it can no longer be rejected. End, archive or delete it instead." |
| reject × rejected | "This order was already rejected on <day>." |
| reopen × unaccepted | "Only a rejected order can be reopened. This one is still waiting to be received." |
| reopen × received | "Only a rejected order can be reopened. This one was received on <day>." |

Traces to Journey 2 steps 2-3 (which verbs the pane offers, via `canIntake`), Journey 3 step 2 (reopen only from rejected) and Journey 4 step 1 (the refusal sentence).

Every message the seeder can meet (receive or reject on a decided order) contains "already", so its convergence regex `/already|CONFLICT/i` (`seed/operations.ts:374`) keeps matching.

### API contracts

**`collectiveOrder.receive`** (changed behaviour, same input and output):
- The load gains `.for("update")` (precedent: `modules/governed/writer.ts:234`, `modules/audit/shared.ts:44`).
- The inline `received` check becomes `assertIntakeTransition(existing, "receive")`, which now also refuses `rejected`.
- The comment at `:3218-3228` is rewritten. It records that the correction path is now `reopen`, and closes `TODO(verify-semantics)` with the decision reference.
- Refusal order: NOT_FOUND → FORBIDDEN (locked) → CONFLICT (intake).
- Traces to Journey 1 step 3 (unchanged success), Journey 3 step 5 (receive after reopen) and Journey 4 steps 1-3 (refusal, lock).

**`collectiveOrder.reject`** (message only, plus the lock): `.for("update")`, and `assertIntakeTransition(existing, "reject")` replaces `:3335-3339`. Traces to Journey 2 step 1 and Journey 4 step 3; the reworded refusal is proven by §10 edge case 2.

**`collectiveOrder.reopen`** [NEW procedure in the existing router]:

```ts
reopen: orgProcedure
  .use(requireNode(COLLECTIVE_ORDER.reopen))
  .input(z.object({ orderId: z.string(), reason: z.string().trim().min(1).max(500) }))
  // → returns the updated collective_order row (same shape receive/reject return)
```

- Errors: BAD_REQUEST (blank or oversize reason, from zod), NOT_FOUND (out of scope), FORBIDDEN (no node, or locked), CONFLICT (not rejected).
- Audit: `action: "collectiveOrder.reopen"`, `targetType: "collectiveOrder"`, `before: { acceptStatus, rejectedAt, rejectReason }`, `after: { acceptStatus: "unaccepted", reason }`.
- Traces to Journey 3 step 2.

**Permission node** (D7): `COLLECTIVE_ORDER.reopen = "collectiveOrder.reopen"`, registered `{ parent: root, label: "Reopen a rejected order", isEndpoint: true }`. admin, branch-manager and ops inherit it through the root. No role list changes, and the reachability test is satisfied through the root grants. The catalog row reaches each environment per D12. Traces to Journey 3 step 1 (who may reopen) and Journey 5 step 2 (sales may not).

**Architecture allow-list:** add `"routers/collective-order.ts :: collectiveOrderRouter.reopen :: update(collectiveOrder)"` beside `:495-496`, with a guards comment (scoped `FOR UPDATE` load, lock check, `rejected` only, audited).

### Web

- `apps/web/src/components/shell-next/record-routes.ts`: add

  ```ts
  /** "/order/<segment>/$orderId", or null for a trade outside the nine (same null rule as recordTo). */
  export function orderRecordPattern(trade: string | null | undefined): string | null;
  ```

  It returns a **pattern** so `<Link>` keeps its param check, as `OrderLedgerConfig.detailRoute` does (`types.ts:193-205`). Traces to Journey 1 step 4.
- `order.to-receive.tsx`:
  - The row gains `businessTypeRaw`, `acceptedAtRaw`, `rejectedAtRaw` and `rejectReason`, mapped from the `list` row, which already returns the full `collective_order` row (`:2458-2468`).
  - The pane gains **Open full page** and an **Intake** group.
  - The overflow menu gains **Open full page**.
  - Pane decision buttons follow `canIntake` per verb.
  - A **Reopen** row icon appears on rejected rows.
  - `actOn` returns `{ done, failed }`, and `decideReading` advances only when `failed === 0`.
  - The pane's row survives the refetch (D11-A). Today `reading` is `visibleRows[readingIndex]?.original` (`:846-848`) over `listInput`, which defaults to `acceptStatus: "unaccepted"` (`:686-691`), and `actOn` invalidates every query (`:759`). So an order that someone else rejected drops out of the list and `reading` becomes undefined whatever `decideReading` does. The fix extracts the row mapper inside the `data` memo (`:692-724`) into `toQueueRow(row)`, and adds `readingFallback = useQuery(orpc.collectiveOrder.get.queryOptions({ input: { orderId: readingId ?? "" } }), enabled: !!readingId && readingIndex < 0)`, mapped through `toQueueRow`. `get` returns the same enriched shape as `list` (`routers/collective-order.ts:2471`, comment at `:2490-2493`). `reading = visibleRows[readingIndex]?.original ?? readingFallback`. Position and prev/next already go undefined when `readingIndex < 0` (`:1591-1600`).
  - `canDecide` (D6): false when `useAcceptStatusCounts()` errors with code `FORBIDDEN`.
- `apps/web/src/components/reopen-dialog.tsx` [NEW]: the same structure as `RejectDialog`, with a required reason (confirm disabled while `reason.trim() === ""`, `maxLength={500}`), neutral styling, title `Reopen <orderNumber>`, and description "It goes back to Unaccepted orders. The reason is kept in the audit log." Traces to Journey 3 steps 1-2.
- Row mapping of `acceptedAtRaw` / `rejectedAtRaw` / `rejectReason` and the Intake group trace to Journey 2 step 2 and Journey 3 step 4; `canDecide` traces to Journey 5 step 2; `toQueueRow` / `readingFallback` trace to Journey 4 step 2.

### Key decisions (all settled 2026-09-17, §9)
- How a rejection is undone → D1-A, a separate `reopen` verb (shapes all of Phase 2)
- Where a reopen lands → D2-A, back to `unaccepted` (2.2)
- Where reopen history lives → D3-A, `audit_log` only, stamps kept (2.2; no migration)
- Whether rejection gates ledgers or edits → D4-A, not in this step (accepted known gap, X13)
- Link destination → D5-A, the trade record page (1.1)
- How the page knows who may decide → D6-A, hide on FORBIDDEN counts (2.5)
- Reopen's permission node → D7-A, a new endpoint node under the root (2.2)
- Whether a rejection reason becomes required → D8-A, stays optional
- Concurrency control → D9-A, `SELECT … FOR UPDATE` in all three handlers
- Merge timing relative to step 11 → D10-A, Phase 1 any wave, Phase 2 after 11 Phase 2
- What the pane shows after a refused decision → D11-A, the pane keeps the order, read by id (2.5, 2.6)
- How the `collectiveOrder.reopen` catalog row reaches each environment → D12-A, owner-run INSERT (the Phase 2 dev proof and any P8 grant, not the code)
- The intake guard is a pure module shared by the router and tests (`intake-guard.ts`) → follows from D1-A; no separate decision (a different file layout changes no behaviour)
- Who owns the order under-review freeze → Cross-plan item X6, Decided A: **step 15** (no step-13 task)

## 5. Phased Implementation

**Prerequisites.**
- Every decision this plan needs (D1-D12) is **Decided** as of 2026-09-17 (§9), so no decision blocks either phase.
- Gates that remain: the D12-A `permission_node` INSERT on dev before the Phase 2 proof; probes P3/P4 (D4 gap), P7 (D8), P8 (custom-role grants) before the production deploy. **Re-check before the task that depends on it; if a probe contradicts the choice, stop and re-plan.**
- Cross-plan item X6 is Decided A (step 15 owns the freeze and the `collective_order.exists` lock; 15 P1 merges before 14 P1). It touches no step-13 task.
- Per X16, the uncommitted `e2e/` changes in `nct-layout` must be committed before Wave 6; Phase 1's spec edits assume that working tree, so they rebase on whatever lands.
- Before Phase 2 starts, re-find `receive`, `reject` and the allow-list entries **by symbol** at the base commit, because step 11 Phase 2 shifts `collective-order.ts` and edits `architecture.test.ts`.

### Phase 1: To Receive opens the order (the `nct-dead-queues` To Receive half)

**Delivers:** Journey 1 end to end.
**Dependencies:** none open (D5-A settled). No server change and no other plan's code.

- **1.1** In `apps/web/src/components/shell-next/record-routes.ts`, add `orderRecordPattern(trade)` built on `TRADE_SEGMENT` (null for an unknown trade). In `record-routes.test.ts`, add cases: all nine configs' `DETAIL_ROUTE` equal `orderRecordPattern(businessType)` (reuse `readDeclarations()`); `road → "/order/land/$orderId"`; `"logistics_cd"` and `null` → null. Files: `apps/web/src/components/shell-next/record-routes.ts`, `apps/web/src/components/shell-next/record-routes.test.ts`. · **Agent A (frontend)**
- **1.2** In `order.to-receive.tsx`:
  - Add `businessTypeRaw: row.businessType` to `ToReceiveOrder` and to the mapping beside `acceptStatusRaw` (`:699`), with a docblock in the style of `:174-183`.
  - In the pane `actions` (`:1576-1590`), append `pattern ? <Link to={pattern} params={{ orderId: reading.id }}><Button variant="outline" size="sm">Open full page <ArrowUpRight /></Button></Link> : null`, copying `order-ledger-page.tsx:1229-1236`.
  - In the row overflow menu (`:429-431`), add a `DropdownMenuItem` **Open full page** that navigates to the same pattern (`useNavigate`, with `params`). Omit it when the pattern is null.
  - Leave every decision button unchanged in this phase, so the only UI route that un-rejects today is removed in the same commit as its replacement (Phase 2).

  Files: `apps/web/src/routes/_next/order.to-receive.tsx`. · **Agent A (frontend)**
- **1.3** e2e: in `e2e/page-objects/to-receive.page.ts`, add `openFullPageInPane()` and `openFullPageFromRow(rowText)`. In `e2e/to-receive/row-actions.spec.ts`, add "the pane opens the order's record page" (the URL matches `/order/[a-z-]+/<id>$` and the record heading shows the order number) and "the row menu opens the same page". Update the header list to name case 5. Files: `e2e/page-objects/to-receive.page.ts`, `e2e/to-receive/row-actions.spec.ts`. · **Agent B (test)**

**Acceptance.**
- From To Receive, a user opens a sea-export order and a `road` order through **Open full page** and lands on `/order/sea-export/<id>` and `/order/land/<id>` record pages. **Edit order** there opens the form (Journey 1 end to end).
- `record-routes.test.ts` passes. `bun run check-types` output has no `error TS`, and no workspace reports failed.
- `bun run e2e:parity -- e2e/to-receive/row-actions.spec.ts` passes.

### Phase 2: Intake decisions are final at intake, and a rejection is undone only by a recorded reopen (`nct-s13-intake-decisions-are-asymmetrical`)

**Delivers:** Journeys 2, 3, 4 and 5.
**Dependencies:** Phase 1 merged (the pane actions block is shared). Step 11 Phase 2 merged (D10-A). All of D1-A, D2-A, D3-A, D6-A, D7-A, D9-A, D11-A and D12-A are settled; the only gate left is the D12-A `permission_node` INSERT on dev before the proof (§10).

- **2.1** Add `intake-guard.ts` per §4 and D1/D2. Unit tests cover the full verb × state matrix (3 × 3), the message for each refusal with a stamp present and absent, and the check that no message contains a raw enum token (`unaccepted`, `received`, `rejected` as bare words). Files: `packages/api/src/modules/collective-order/intake-guard.ts` [NEW], `packages/api/src/modules/collective-order/intake-guard.test.ts` [NEW]. · **Agent C (backend)**
- **2.2** Router and permissions:
  - `receive` and `reject`: add `.for("update")` to the scoped load (D9) and call `assertIntakeTransition`. Rewrite the comments at `receive` (`:3218-3228`) and `reject` (`:3331-3334`) to state the rule and name `reopen`.
  - Add `reopen` per §4 (D2-A: sets `unaccepted`; D3-A: keeps the rejection stamps).
  - Add `reopen` to `COLLECTIVE_ORDER` (`permissions.ts:17-18`) and register it (`:84-93`) per D7-A.
  - Add the allow-list entry beside `architecture.test.ts:495-496`.

  Files: `packages/api/src/routers/collective-order.ts`, `packages/api/src/modules/collective-order/permissions.ts`, `packages/api/src/architecture.test.ts`. · **Agent C (backend)**
- **2.3** Router tests in `collective-order.guards.test.ts`:
  - Add `[COLLECTIVE_ORDER.reopen, COLLECTIVE_ORDER.root, true]` to `NODE_KEYS` (`:69-81`).
  - **Replace** "ALLOWS re-receiving a rejected order" (`:351-363`) with "refuses receiving a rejected order". Assert CONFLICT with the reopen sentence, `acceptStatus` still `rejected`, `rejectReason` intact, and no `collectiveOrder.receive` audit row.
  - New `describe("reopen")`:
    - rejected → unaccepted, stamps kept, and one `collectiveOrder.reopen` audit row whose `before` holds the old reason and whose `after` holds the new one;
    - blank reason → BAD_REQUEST;
    - unaccepted or received → CONFLICT;
    - locked → FORBIDDEN;
    - out of scope → NOT_FOUND;
    - `u-locker` (accounting, no root) → FORBIDDEN;
    - reject → reopen → receive → `received`, `rejectedAt` null, and three audit rows in order.
  - Extend "refuses rejecting an order that is no longer at intake" (`:321-328`) to assert the message has no raw enum.
  - Extend `acceptStatusCounts` "moves an order between buckets" (`:1375`) with a reopen step (rejected → unaccepted, total unchanged).
  - In `collective-order.seeded-roles.test.ts`, add "lets ops reopen a rejected order" beside `:114-121`, and "sales cannot reopen".
  - **No lock test on PGlite.** A held transaction on PGlite blocks every other query on its single connection (`drizzle-orm/pglite/session.js` `transaction`), so "receive does not resolve first" would pass without any `FOR UPDATE`: a false positive, not a proof.
  - **Lock proof on real Postgres:** `packages/api/src/routers/collective-order.intake.concurrency.test.ts` [NEW] — step 13's own file, distinct from the `collective-order.concurrency.test.ts` that step 15 creates and step 14 adds a describe to (X8). Per X8 this PR pastes its real-Postgres output, because CI has no `DATABASE_URL_TEST`. It follows the pattern of `expense.concurrency.test.ts` (`describe.skipIf(!TEST_URL)` at `:65`, `DATABASE_URL_TEST` at `:27`, `createDbClient`, a per-run org, child-first `afterAll` cleanup). `createDbClient` returns a pool (`packages/db/src/client.ts`), so two connections are available. The test:
    1. seeds one unaccepted order;
    2. connection A opens a transaction and runs `SELECT … FROM collective_order WHERE id = $1 FOR UPDATE`;
    3. B starts `call(collectiveOrderRouter.receive, …)` and does not await it;
    4. A sets `accept_status = 'rejected'`, `rejected_at = now()`, inserts one `collectiveOrder.reject` audit row, and commits;
    5. asserts B rejects with CONFLICT (the reject sentence), the row is `rejected`, and exactly one decision audit row exists for the order.
    - **It must fail on the pre-change handler**: without the lock, B's unlocked load reads `unaccepted`, its UPDATE waits on A's row lock, then overwrites to `received`. The executor runs it once on the HEAD handler and records the failure in the PR before applying Task 2.2.
    - `DATABASE_URL_TEST` is set in no workflow (grep of `.github/workflows`), so CI skips it. It is a local gate against the dev Neon branch, and the executor pastes its output.

  Files: `packages/api/src/routers/collective-order.guards.test.ts`, `packages/api/src/routers/collective-order.seeded-roles.test.ts`, `packages/api/src/routers/collective-order.intake.concurrency.test.ts` [NEW]. · **Agent C (backend)**
- **2.4** `ReopenDialog` per §4. Files: `apps/web/src/components/reopen-dialog.tsx` [NEW]. · **Agent D (frontend)**
- **2.5** `order.to-receive.tsx`:
  - Map `acceptedAtRaw`, `rejectedAtRaw` and `rejectReason` onto the row.
  - Add an **Intake** `DetailGroup` first in `detailGroups` (`:878`):
    - Status label.
    - Received on (when set).
    - For `rejected`, "Rejected on" plus reason. For `unaccepted` with `rejectedAtRaw`, "Previously rejected on" plus reason. Use "No reason given" when the reason is null.
  - Pane actions:
    - **Receive this order** only when `canIntake("receive", raw)`.
    - `RejectDialog` only when `canIntake("reject", raw)`.
    - `ReopenDialog` only when `canIntake("reopen", raw)`.
    - All three are also gated on `canDecide` (D6). **Open full page** is always shown.
  - Row cell (`:370-436`): keep the tick and ✕ (disabled when settled). On rejected rows add an icon-only Reopen trigger (`RotateCcw`, tooltip "Reopen"). Hide all three when `!canDecide`.
  - `actOn` gains a `"reopen"` mode calling `client.collectiveOrder.reopen`, and returns `{ done, failed }`. The success toast for reopen reads `"<orderNumber> reopened, back in Unaccepted"`.
  - `decideReading` (`:866-876`) advances only when `failed === 0` (adjacent defect 5). On a refusal it leaves `readingId` set.
  - D11-A: add `toQueueRow` and `readingFallback` as in §4 Web, so the pane keeps showing the order after it leaves the filtered list.
  - `canDecide = !(acceptStatusCounts.error && isForbidden(acceptStatusCounts.error))`, with `isForbidden` checking the oRPC error `code === "FORBIDDEN"`. While the counts are pending, buttons render as today (fail-open: the server enforces).
  - Import `canIntake` from the API package if the web already imports from `@nct-ai/api` modules. Otherwise inline the three-line `INTAKE_FROM` map with a comment pointing at `intake-guard.ts` (the agent checks for an existing web import of `packages/api/src/modules/*` before choosing).

  Files: `apps/web/src/routes/_next/order.to-receive.tsx`. · **Agent D (frontend)**
- **2.6** e2e and seeder:
  - `to-receive.page.ts`: add `reopenButtonIn(rowText)`, `paneReopen(reason)` and `paneIntakeGroup()`.
  - **Fixture isolation.** The parity suite runs serially on one shared org (`playwright.config.ts:32` `fullyParallel: false`, `:35` `workers: 1`) with exactly five seeded unaccepted orders (`e2e/global-setup.ts` `FIXTURE_ORDERS` `:116`, created at `:165-168`). `row-actions.spec.ts:26` asserts `toHaveCount(5)`, and `enum-labels` / `buss-type-filter` read the same rows. **No Phase 2 test decides a seeded row.**
  - New spec `e2e/to-receive/intake-decisions.spec.ts` [NEW], not `row-actions.spec.ts`:
    - A local `setupRpc(page, path, input)` helper that copies global-setup's throwing `rpc` (`e2e/global-setup.ts:71`, not exported); `page.request` carries the owner storage state.
    - `beforeEach`: read `owningBranchId` from `collectiveOrder/list` (the fixture branch id is not exported to specs), then `collectiveOrder/create` one order with `jobNumber: "E2E-DEC-<testInfo.workerIndex>-<Date.now()>"` and a trade that has a segment (`sea_export`). Tests address the row only by that number.
    - `afterEach` (runs on failure too): `collectiveOrder/delete` that order (`routers/collective-order.ts:3148`; refuses only locked or cleared orders, and a fresh order is neither), so the five-row count is restored.
    - Tests: "a rejected order offers Reopen, not Receive" (pane and row); "reopen needs a reason and returns the order to Unaccepted with its history shown"; header case 4 "an already-decided order cannot be decided twice" as an explicit test; and "a refused decision" — open the order in two pages, reject it in page A, press **Receive this order** in page B, expect the toast sentence, then (D11-A) the pane's order number unchanged and **Reopen…** visible.
  - `seed/operations.ts` `acceptPass`: no code change. Confirm by reading that a second run over a re-ordered list, which would now try `receive` on a seeded-rejected order, still counts as `converged` (the message contains "already"). Add a one-line comment saying so.

  Files: `e2e/page-objects/to-receive.page.ts`, `e2e/to-receive/intake-decisions.spec.ts` [NEW], `seed/operations.ts` (comment only). · **Agent B (test)**

**Acceptance.**
- Journeys 2-5 as written, in the browser.
- The api tests `intake-guard.test.ts`, `collective-order.guards.test.ts`, `collective-order.seeded-roles.test.ts`, `collective-order.parity.test.ts`, `architecture.test.ts`, `permissions/registry.sync.test.ts`, `permissions/reachability.test.ts` and `permissions/node-guard.test.ts` all pass, judged by reading the output for `failed`.
- `bun run check-types` is clean by reading, and `bun run e2e:parity -- e2e/to-receive` passes.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (frontend) | frontend-engineer | sonnet | medium | 1.1, 1.2 | `apps/web/src/components/shell-next/record-routes.ts`, `apps/web/src/components/shell-next/record-routes.test.ts`, `apps/web/src/routes/_next/order.to-receive.tsx` | `apps/web/src/components/order-ledger/order-ledger-page.tsx`, `apps/web/src/components/order-ledger/types.ts`, `apps/web/src/components/order-ledger/configs/*.tsx` |
| Agent B (test) | test-engineer | sonnet | medium | 1.3 | `e2e/page-objects/to-receive.page.ts`, `e2e/to-receive/row-actions.spec.ts` | `apps/web/src/routes/_next/order.to-receive.tsx` |

Run mode: **A → B**. B waits on the **Open full page** button and menu item from 1.2 (its accessible names).
Serialization point: after A, run `bun run check-types` and `bunx vp test run apps/web/src/components/shell-next/record-routes.test.ts`. After B, run `bun run e2e:parity -- e2e/to-receive/row-actions.spec.ts`.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | opus | high | 2.1, 2.2, 2.3 | `packages/api/src/modules/collective-order/intake-guard.ts` [NEW], `…/intake-guard.test.ts` [NEW], `packages/api/src/routers/collective-order.ts`, `packages/api/src/modules/collective-order/permissions.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/routers/collective-order.guards.test.ts`, `packages/api/src/routers/collective-order.seeded-roles.test.ts` | `packages/api/src/roles.ts`, `packages/api/src/procedures/org.ts`, `packages/api/src/modules/governed/writer.ts`, `packages/db/src/schema/collective-order.ts`, `packages/api/src/audit.ts` |
| Agent D (frontend) | frontend-engineer | sonnet | high | 2.4, 2.5 | `apps/web/src/components/reopen-dialog.tsx` [NEW], `apps/web/src/routes/_next/order.to-receive.tsx` | `apps/web/src/components/reject-dialog.tsx`, `apps/web/src/components/order-ledger/accept-status-tabs.tsx`, `packages/api/src/modules/collective-order/intake-guard.ts` |
| Agent B (test) | test-engineer | sonnet | medium | 2.6 | `e2e/page-objects/to-receive.page.ts`, `e2e/to-receive/intake-decisions.spec.ts` [NEW], `seed/operations.ts` | `apps/web/src/routes/_next/order.to-receive.tsx`, `apps/web/src/components/reopen-dialog.tsx` |

- Opus for C: it changes what a write path refuses, adds a permission node under the reachability and sync guards, adds a row lock, and changes an architecture allow-list, so a wrong transaction boundary loses an audit row.
- Effort high for D: permission-aware rendering and refusal-aware advance each involve a real decision.

Run mode: **C → D → B**, with 2.4 starting in parallel with C.
- D's 2.5 waits on the `collectiveOrder.reopen` client type and `intake-guard.ts` exports from 2.1/2.2, because oRPC client types come from the router.
- B waits on 2.5's accessible names.

Ownership handoffs:
- `apps/web/src/routes/_next/order.to-receive.tsx`: Agent A (Phase 1) → Agent D (Phase 2).
- `e2e/to-receive/row-actions.spec.ts` (Phase 1 only), `e2e/to-receive/intake-decisions.spec.ts` [NEW] (Phase 2) and `e2e/page-objects/to-receive.page.ts`: Agent B in both phases.

Serialization points:
- After C: `bunx vp test run packages/api/src/modules/collective-order/intake-guard.test.ts packages/api/src/routers/collective-order.guards.test.ts packages/api/src/routers/collective-order.seeded-roles.test.ts packages/api/src/architecture.test.ts packages/api/src/permissions`, then read the output for `failed`.
- After D: `bun run check-types`.
- After B: the e2e command in §10.

Smell test: one owner per task · no file owned twice in a phase · `order.to-receive.tsx` passes A → D strictly across phases · every wait names its artifact (1.2 button names, 2.2 client type, 2.5 accessible names) · Phase 1 alone delivers Journey 1.

## 7. Impact & Breakage Analysis

- **`receive` behaviour change (Phase 2).** Callers re-found by grep at HEAD in the self-review pass (`collectiveOrder.receive|reject`, `collectiveOrder/receive|reject`, `collectiveOrderRouter.receive|reject` over `apps packages e2e seed`):
  - `apps/web/src/routes/_next/order.to-receive.tsx:755` (receive) and `:756` (reject), both inside `actOn`; the row and the pane go through it.
  - `seed/operations.ts` `acceptPass` (`:318`): `decide("collectiveOrder/receive", …)` `:381`, `decide("collectiveOrder/reject", …)` `:387`, convergence regex `:374`.
  - Tests: `collective-order.guards.test.ts` (17 lines naming `collectiveOrderRouter.receive|reject` or `COLLECTIVE_ORDER.receive|reject`), `collective-order.seeded-roles.test.ts:114-121` (ops can receive) and `:136-142` (refuses sales the intake decision), `collective-order.parity.test.ts:101` (node list) and `:316` (receive call).
  - Non-callers: `architecture.test.ts:495-496` (allow-list strings), `modules/collective-order/permissions.ts:17-18` (node keys), `reject-dialog.tsx:25` (comment). `pool-strip.tsx:133` references only `unacceptedCount`; `accept-status-tabs.tsx:80` only `acceptStatusCounts`.
  - No `e2e/` file calls either procedure over RPC, including the uncommitted `e2e/specs/intake.golden-path.spec.ts`.

  Only `guards.test.ts:351-363` asserts the rejected → received path, and Task 2.3 replaces it. The seeder buckets by index and matches `/already|CONFLICT/i`, and the new sentences contain "already".
- **`reject` message change.** Anything matching the old text `Cannot reject an order that is already`: grep finds only the router itself. The e2e specs do not assert toast text for reject refusals.
- **New procedure and node.**
  - `permissions/registry.sync.test.ts` checks registry ↔ endpoints, so `requireNode(COLLECTIVE_ORDER.reopen)` must be registered in the same commit.
  - `permissions/reachability.test.ts` requires a non-owner role to hold every node, and admin, branch-manager and ops reach it through the root.
  - **Catalog row, owner-run (no deploy step exists; D12-A, Decided).** `db:seed-nodes` is not in any pipeline and cannot run under bun (Phase 0 Permissions). admin, branch-manager and ops reach `reopen` through the root by ancestor resolution with or without the row, so the endpoint works on deploy. The row is needed only to **grant** `collectiveOrder.reopen` to a custom role or member (the FKs at `schema/permissions.ts:42-44`, `:107-109`), which is the P8 mitigation. Path:
    1. **Dev:** Wilfred (or the executor, with his yes) runs the reviewed statement below on the dev branch before the Phase 2 proof.
    2. **Production:** Wilfred runs the same reviewed statement after the server deploy and **before** any P8 grant. Alternative already used in practice: an admin presses **Sync system roles** (`role.syncSystemRoles`, which calls `seedPermissionNodes`), but that also inserts any missing system-role grants for that org, so the plain INSERT is recommended.
    3. The statement copies the columns of the existing `receive` row, so module/resource/parent cannot be mistyped:
       `INSERT INTO permission_node (key, parent_key, module, resource, action, label, is_endpoint) SELECT 'collectiveOrder.reopen', parent_key, module, resource, 'reopen', 'Reopen a rejected order', true FROM permission_node WHERE key = 'collectiveOrder.receive' ON CONFLICT (key) DO NOTHING;`
       The executor first reads `SELECT key, parent_key, module, resource, action, label, is_endpoint FROM permission_node WHERE key IN ('collectiveOrder.receive','collectiveOrder.reject');` and confirms `action` holds the verb (`receive`/`reject`) before using `'reopen'`; if it holds something else, match that shape. The label must equal the registry label in §4 ("Reopen a rejected order"), because a later `seedPermissionNodes` upserts it (`roles.ts:249` onward).
    4. **Read-only check** (both environments): `SELECT key, parent_key, is_endpoint FROM permission_node WHERE key = 'collectiveOrder.reopen';` returns one row whose `parent_key` equals the `receive` row's `parent_key` read in step 3.
  - System roles need no top-up because they hold the root key.
  - **Custom roles** that were granted `collectiveOrder.receive` and `collectiveOrder.reject` as leaves will **not** get `reopen`. That is intended: reopen is a separate grant (D7).
- **Row lock.** `FOR UPDATE` on `collective_order` inside the three intake handlers.
  - Other writers of the same row (`update`, `transition`, `batch`, `saveChildren`, `review`) do not take `FOR UPDATE` at HEAD, but their `UPDATE collective_order` statements (for example `update`'s `tx.update(collectiveOrder)` at `routers/collective-order.ts:2934`) take the row lock, so they **wait** behind a held intake lock for the length of the short intake transaction. There is no deadlock cycle: each intake handler locks exactly one order row, and after steps 12 (X7) and 15 (X6) the other writers also lock that single row first (or a set in id order for `updateBatch`/`batch`).
  - The hold time is one UPDATE plus one audit insert.
- **Web.**
  - `order.to-receive.tsx` is the only page changed.
  - `RejectDialog` is unchanged (still used by the row and the pane).
  - `AcceptStatusTabs` is unchanged: a reopen moves counts between buckets, and `accept-status-tabs.test.tsx` does not need to change.
  - `record-routes.ts` gains one export. Its existing consumer `rail-search.tsx` is unaffected.
- **Current flows, before → after.**
  - _Rejected → received via the pane_: before, one call to `receive`. After, `receive` returns CONFLICT, and the UI offers `reopen` then `receive`. **Deployment coupling:** an old web against a new server shows the CONFLICT toast on the pane's still-enabled Receive button, which is harmless. A new web against an old server would call a missing `reopen` (404), so **deploy the server before or with the web**.
  - _Receive from Unaccepted_: unchanged apart from the lock and the pane link.
  - _Reject from Unaccepted_: unchanged apart from the lock.
- **Nullable fields relied on.**
  - `rejected_at` / `reject_reason` are nullable. Pre-`rejectedAt` rejections are legacy rows with a null stamp, so messages drop the date and the pane shows "No reason given".
  - `accepted_at` is null on legacy received rows (probe P5).
  - `business_type` is not null (`schema/collective-order.ts:127`), but an out-of-enum value yields no link (`orderRecordPattern` returns null).
- **Adjacent defect 1 stays live.** A rejected order still shows and edits in its trade ledger. The fix here makes the intake **record** honest, not the order inert. D4 records the choice, and §9 Risks says who must know.
- **Cross-plan collisions:**

| Shared code | Steps that write it | Handled by |
|---|---|---|
| `routers/collective-order.ts` | 11 Phase 2 (moves `:2288-2418` out; `assignNumber` D7-A re-stamp); 12 Task 1.1 (`assignNumber` `.for("update")` and its row lock, owned by step 12 per X7); the order under-review freeze and row locks on the content writers, owned by **step 15 Phase 1** (X6, Decided; step 14 D5-C), with 15 P1 before 14 P1; 14 Task 3.2 (status validation in `update`/`updateBatch`/`create`); 15 Task 2.1 (deletes `review`, `reviewBatch`); **13 Phase 2** (`receive`, `reject`, new `reopen`) | No overlap with `receive`/`reject`/`reopen`. 13 Phase 2 merges after 11 Phase 2 (D10-A), rebases after 12/14/15 if they land first, and locates by symbol |
| `collective-order.guards.test.ts` | 14 Task 3.2 (literals at `:658/668`, `:1031/1038`); 15 Task 2.3 (deletes `:474-599`, `:741-811`); the freeze cases go to `collective-order.under-review.test.ts` [NEW, step 15] per X6; **13 Task 2.3** (`NODE_KEYS`, intake block) | Different describes; `NODE_KEYS` edited by symbol |
| `packages/api/src/architecture.test.ts` allow-list | 08 Task 3.3, 10 Task 1.4, 11 Tasks 1.2/2.1/2.2/2.4, 12 Tasks 1.1/1.2 (comments), 15 P1 (comments) and Task 2.1 (removes `:494`, `:876`), **13 Task 2.2** | Entries are line-independent; comments collide. 13's new entry beside `:495-496` neighbours 15's `:494` removal, so the second to merge rebases. Re-run after every rebase |
| `modules/collective-order/permissions.ts` | **13 Task 2.2** (`reopen` key `:17-18`, registration `:84-93`); **15 Task 2.1** (drops `isEndpoint` on `[COLLECTIVE_ORDER.review]` `:94-98`). The earlier "13 only" was wrong (`steps-12-15-crosscheck.md` §2) | Neighbouring blocks; the second to merge rebases, and both run `permissions/registry.sync.test.ts` |
| `seed/operations.ts` | **13 Task 2.6** (comment only); 14 Task 1.3 (order values, raw insert); 15 Task 3.7 (`ensureLadings`) | X12 (Decided): 14 P1 merges before 15 P3; 13's comment beside `acceptPass` rebases by symbol |
| `apps/web/src/routes/_next/order.to-receive.tsx` | **13 only** among 01-11 | none |
| `record-routes.ts` | **13 Task 1.1** (global search owns it, no open plan) | Additive export |
| e2e to-receive specs | **13** (Phase 2 in its own new spec with per-test orders) | none |
| Migration journal | 01, 02, 04, 09, 10; 05-08 and 11 conditional; **13: none** (D3-A Decided) | Surviving conditionals are `00NN_<name>`, numbered at merge (X14) |

**Recommended merge order (D10-A).** Phase 1 is web-only and collides with no plan, so it can go in its own worktree `wt-step13-p1` in any wave (earliest useful: Wave 1). Phase 2 goes in `wt-step13-p2` after step 11 Phase 2 (Wave 5 or later), rebased on it, with `receive` and `reject` re-found by symbol.

**Production read-only probes (Wilfred runs; none blocks Phase 1):**
- **P1 (sizing the queue):**
  `SELECT organization_id, accept_status, count(*) FROM collective_order GROUP BY 1,2 ORDER BY 1,2;`
- **P2 (the finding in production: reversals that already happened, D1/D2):**
  `SELECT organization_id, target_id, actor_user_id, created_at FROM audit_log WHERE action = 'collectiveOrder.receive' AND before_json::jsonb ->> 'acceptStatus' = 'rejected' ORDER BY created_at DESC;`
  Each hit is an order that Phase 2 would have forced through a reasoned reopen. A high count argues for D2-B.
- **P3 (does a rejected order carry work? D4):**
  `SELECT o.organization_id, o.id, o.job_number, o.rejected_at, (SELECT count(*) FROM cost_line c WHERE c.order_id = o.id) AS cost_lines, o.order_audit_status, o.process, o.locked, o.archived FROM collective_order o WHERE o.accept_status = 'rejected';`
  (`cost_line.order_id` was verified at `packages/db/src/schema/expense.ts:57`, index `cost_line_order_idx` `:190`.) Rejected orders with cost lines mean D4-C would strand live work.
- **P4 (do people work unaccepted orders in ledgers? D4):**
  `SELECT o.organization_id, count(*) FROM collective_order o WHERE o.accept_status = 'unaccepted' AND EXISTS (SELECT 1 FROM cost_line c WHERE c.order_id = o.id) GROUP BY 1;`
- **P5 (stamp consistency; legacy nulls the messages must tolerate):**
  `SELECT accept_status, count(*) FILTER (WHERE accepted_at IS NULL) AS no_accepted_at, count(*) FILTER (WHERE rejected_at IS NULL) AS no_rejected_at, count(*) FILTER (WHERE reject_reason IS NOT NULL) AS has_reason FROM collective_order GROUP BY 1;`
- **P6 (who decides, D7 and D3-B value):**
  `SELECT action, actor_user_id, count(*) FROM audit_log WHERE action IN ('collectiveOrder.receive','collectiveOrder.reject') GROUP BY 1,2 ORDER BY 3 DESC;`
- **P7 (is the optional reason used? D8):**
  `SELECT count(*) FILTER (WHERE reject_reason IS NULL) AS no_reason, count(*) AS total FROM collective_order WHERE accept_status = 'rejected';`
- **P8 (custom roles and member overrides holding receive/reject as leaves, who would lack reopen, D7):**
  `SELECT r.organization_id, r.name, g.node_key FROM role r JOIN role_node_grant g ON g.role_id = r.id WHERE g.node_key IN ('collectiveOrder.receive','collectiveOrder.reject') AND r.is_system = false;`
  `SELECT organization_id, member_id, node_key, effect FROM member_override WHERE node_key IN ('collectiveOrder.receive','collectiveOrder.reject');`
  (Tables verified: `role` `packages/db/src/schema/organization.ts:111`, `is_system` `:120`; `role_node_grant` `packages/db/src/schema/permissions.ts:35-44`; `member_override` `:97-107`.)

## 8. Cross-Cutting Concerns

- **Errors.**
  - Every intake refusal is `ORPCError("CONFLICT")` with a sentence and no enum.
  - A blank reopen reason is a zod BAD_REQUEST, and the dialog prevents it anyway.
  - The page already toasts `error.message` through `actOn` (`:766-775`).
  - A refused decision no longer advances the pane; per D11-A the pane keeps its order (read by id).
- **Testing.**
  - A pure guard matrix (2.1).
  - Router tests on PGlite (2.3), including the replaced "ALLOWS" test.
  - The permission guard suites.
  - Architecture test.
  - e2e parity specs (they run in CI through `e2e:parity`).
  - The lock proof is `collective-order.intake.concurrency.test.ts` [NEW] on real Postgres (`DATABASE_URL_TEST`, dev Neon branch), shown to fail on the pre-change handler. PGlite cannot prove it.
  - Phase 2 e2e tests create and delete their own orders, so the five-row parity fixture is never mutated.
- **Migration.** None: D3-A is Decided, so no schema change and no journal entry. Nothing to gate.
- **Rollback.**
  - Phase 1: revert (UI only).
  - Phase 2: revert. Orders reopened in the meantime are `unaccepted` with rejection stamps, which the old code handles: receive clears the stamps as before. `collectiveOrder.reopen` audit rows remain as history. The `collectiveOrder.reopen` permission node row stays in the catalog, unused and harmless.
- **Audit trail.** Receive and reject rows are unchanged. The new action `collectiveOrder.reopen` carries the before state (with the old reason) and the new reason. A refused call writes nothing, matching the router.

**Performance & Scalability**
1. **Pagination.** N/A: `reopen` is a single-row mutation. `list` is unchanged (unbounded today, shared with every ledger, out of scope).
2. **SQL-side filtering.** The scoped load stays a WHERE on `id` plus scope. No application-side filtering is added.
3. **N+1.** None. Each handler runs a fixed three statements (lock-load, update, audit insert). The page's per-row link is computed client-side from the already-fetched row.
4. **Index coverage.** The load is by primary key plus scope columns. The counts keep `collective_order_acceptStatus_idx` (`:354`). No new WHERE on a large table. `audit_log` still has no `target_id` index. This plan adds no lookup by target (D3-A writes only), so none is needed here.
5. **Write atomicity.** Lock-load, check, update and audit sit in one `context.db.transaction`, as today.
6. **Row locking.** Added: `SELECT … FOR UPDATE` on `collective_order` in `receive`, `reject` and `reopen` (D9). That closes the receive/reject race in Journey 4 step 3.
7. **Connections/resources.** None new.
8. **Tenant isolation.** All three loads keep `applyScope(context.db, context.org, "collectiveOrder", orderScopeCols)`. The UPDATE's `WHERE id` follows a scoped locked load (the existing pattern). The audit row carries `organizationId`.
9. **Payload size.** Unchanged: reopen returns the same row shape as receive and reject.
10. **Hot path.** Operator-triggered mutations. `acceptStatusCounts` (`staleTime` 30 s) is reused for D6 with no extra request.

## 9. Decision Register, Open Questions & Risks

No Input Gate was held. On **2026-09-17 Wilfred accepted the recommended option for every decision below**, so each one is **Decided** and carries its chosen letter. All three approaches are kept for the record. Where a decision rests on a production probe or an operations answer, a **Re-check before Task N** line names the probe: the choice stands, but the check is still required before that task runs, and a contradicting result stops the task for a re-plan rather than an improvised change.

### Decided — shapes Phase 2

**D1: How is an intake rejection undone?** · Status: Decided · Shapes: Phase 2 (Tasks 2.1-2.6)

| | Approach | Consequence |
|---|---|---|
| **A** | **A separate `reopen` verb** (Recommended). `receive` and `reject` are legal only from `unaccepted`. `reopen` is legal only from `rejected`, requires a reason, has its own node and audit action, and returns the order to the queue | Matches the SOP repair's second option ("refuse receiving a rejected one without an explicit re-open") and step 10's settled shape: the ordinary verb refuses, and the correction is a visibly separate path with a reason. The one UI path that silently un-rejects today goes away. Adds one procedure, one node and one allow-list entry, and replaces one test that pins the old behaviour (`guards.test.ts:351`). |
| **B** | **Reasoned re-receive.** Keep `rejected → received` legal on `receive`, but require a `reason` input when the order is rejected, and write the audit action as `collectiveOrder.receive` with `after.correction = true` | Smallest change, with no new node or procedure. The reversal is still the same verb and permission as an ordinary receive, so it is not a separate decision anyone can grant or withhold. The pane's Receive button stays live on rejected rows (with a reason prompt). |
| **C** | **Full symmetry.** A plus letting `reject` act on a **received** order with a required reason (the SOP repair's first option) | Symmetrical on paper. A received order may already carry cost lines and edits (adjacent defect 1; probe P3/P4), and "reject" would then overlap lifecycle end / archive / delete, which the code already names as the way to retire a live order (`:3331-3334`). A received → rejected move would also need rules for what happens to that work. |

- **Recommendation: A.** It closes the defect as filed, copies the correction pattern Wilfred already chose for quotations (step 10 D1), and does not blur intake into lifecycle.
- **Chosen: A** (Wilfred, 2026-09-17)
- **Shapes:** all of Phase 2; no longer blocks it.
- **Where it lands:** §4 guard and contracts, Tasks 2.1-2.6, Journeys 2-4.

**D2: Where does a reopened order land?** · Status: Decided · Shapes: Task 2.2

| | Approach | Consequence |
|---|---|---|
| **A** | **Back to `unaccepted`** (Recommended). The order re-enters the queue and is received normally | Two recorded decisions (reopen with its reason, then receive with its time), and no new state. Anyone who may receive can finish it. Costs one extra click for the person who reopened. |
| **B** | **Straight to `received`** with the reason | One click, and matches the finding's "pulled back into operations" wording. The reopen and the receive collapse into one act, so `acceptedAt` and the reopen share a moment and a single person both reverses and accepts. |
| **C** | **Back to `unaccepted`, and the next receive must be by a different member** than the one who reopened | Two-person control on reversals. Needs the reopen actor read back from `audit_log` (no `target_id` index) or D3-B columns, and can strand an order in a one-person branch. |

- **Recommendation: A.** It keeps three states and one source state per verb, and probe P2 shows whether reversals are frequent enough to justify B's shortcut.
- **Chosen: A** (Wilfred, 2026-09-17)
- **Re-check before Task 2.2:** probe P2 (how many reversals already happened); if it contradicts the choice, stop and re-plan.
- **Where it lands:** §4 `reopen`, Journey 3, the 2.3 cases.

**D3: Where does the reversal's history live?** · Status: Decided · Shapes: Task 2.2 (no migration under the chosen option)

| | Approach | Consequence |
|---|---|---|
| **A** | **`audit_log` only, and the row keeps `rejected_at` / `reject_reason` through the reopen** (Recommended). `receive` still clears them | No migration. The queue can show "Previously rejected on … · reason" on a reopened order. The complete chain (reject, reopen, receive) is readable in the audit log, but not per order efficiently (no `target_id` index), and once received the row itself no longer shows that a rejection happened. |
| **B** | **Actor and reopen columns on `collective_order`**: `accepted_by`, `rejected_by`, `reopened_at`, `reopened_by`, `reopen_reason` | The row answers "who decided" (adjacent defect 3) and "was this ever reopened" forever, and the list can show it. Needs a migration numbered at merge, nullable legacy rows, and a decision on what `duplicate` resets (`:2694`). |
| **C** | **An intake-decision history table** (`collective_order_intake_decision`: order, verb, actor, at, reason), in the shape of step 10's `quotation_decision` | Full history per order, indexable, reportable. A new table, a migration, and a second writer to keep in step with three procedures, for a queue whose reversal rate is unknown (P2). |

- **Recommendation: A.** The finding's complaint is an **unrecorded** reversal, and A records it with its reason and keeps it visible while the order is back in the queue. B or C become worth their migration only if P2/P6 show reversals or "who decided" questions are common.
- **Chosen: A** (Wilfred, 2026-09-17) — no migration, and no schema owner in Phase 2.
- **Re-check before Task 2.2:** probes P2 and P6 (reversal rate, and how often "who decided" is asked); if they contradict the choice, stop and re-plan for B or C, which add a migration and a schema owner.
- **Where it lands:** §4 data model, 2.2, the 2.5 Intake group.

**D5: Where does the link out of To Receive go?** · Status: Decided · Shapes: Tasks 1.1-1.3 (all of Phase 1)

| | Approach | Consequence |
|---|---|---|
| **A** | **The trade's record page** `/order/<segment>/$orderId` via `TRADE_SEGMENT` (Recommended), as **Open full page** in the pane and the row menu | Same label, icon and destination as the ledger pane (`order-ledger-page.tsx:1229-1236`). It follows the "read before edit" rule `order-no-cell.tsx` states. The existing tested map means no new trade table. **Edit order** is one click further. |
| **B** | **The edit form** `/order/$orderId/edit` (type-agnostic, where step 14 happens) | One click fewer into step 14, and no trade lookup. It puts a live Save form behind a "look at it" click, which `order-no-cell.tsx` moved the ledgers away from. It is also a different destination from the same label in the ledgers. |
| **C** | **A and a receive-toast action "Fill in details"** to the edit form | Fastest hand-off after receiving, plus reading-first everywhere else. Adds a toast action whose target order must be captured before the pane advances, a second entry point for step 14, and more surface to test. |

- **Recommendation: A.** It reuses a tested map and an existing pattern, and gives the same label the same destination across the app. C can be added once step 14's plan settles where operational entry begins.
- **Chosen: A** (Wilfred, 2026-09-17)
- **Shapes:** 1.1-1.3; nothing blocks Phase 1.
- **Where it lands:** §4 web, Phase 1, Journey 1.

**D6: How does To Receive know who may decide?** · Status: Decided · Shapes: Task 2.5 (`canDecide` part)

| | Approach | Consequence |
|---|---|---|
| **A** | **Hide decision buttons when `acceptStatusCounts` answers FORBIDDEN** (Recommended). Show them while pending or on any other error | Reuses a query the page already makes and the pool-strip precedent (`pool-strip.tsx:120-139`). No server change. It infers `reopen` from `receive`, so a custom role holding receive but not reopen still sees Reopen and gets a FORBIDDEN toast. |
| **B** | **Expose module-node grants to the web** (extend `org.members.me` with the caller's permitted node keys and add a `useNodeGate`) | Exact per-verb gating, reusable by every page with node-gated actions. A change to a shared endpoint and hook that other plans have not scoped, with payload and caching consequences. |
| **C** | **No client gating**; the server refuses | No change. Sales and viewers keep seeing enabled buttons that fail. |

- **Recommendation: A.** It fixes the real audience (sales, accounting, viewer, director) with no shared-surface change. B is the right general fix, but it belongs to a plan that owns permissions UX.
- **Chosen: A** (Wilfred, 2026-09-17)
- **Re-check before Task 2.5:** probe P8 (custom roles or overrides holding receive/reject as leaves, who would see Reopen and get FORBIDDEN); if it contradicts the choice, stop and re-plan.
- **Where it lands:** 2.5, Journey 5.

**D7: Which permission does reopen require?** · Status: Decided · Shapes: Task 2.2

| | Approach | Consequence |
|---|---|---|
| **A** | **New endpoint node `collectiveOrder.reopen` under the root** (Recommended) | Separately grantable, like `duplicate` and the lifecycle children. admin, branch-manager and ops inherit it with no role edit. Custom roles holding only receive/reject leaves do not get it (probe P8). |
| **B** | **Reuse `collectiveOrder.reject`**: whoever may reject may undo | No new node and no catalog change. A reversal cannot be granted or withheld separately, which weakens "a separate decision". |
| **C** | **Require `collectiveOrder.review`** (the order approver's node) | Puts reversals with reviewers (accounting in the seed, `roles.ts:191`). Accounting does not hold receive, so a reopened order returns to ops. It mixes the intake decision with the audit engine's node, which steps 08/10 are changing. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-17)
- **Re-check before Task 2.2 and before deploy:** probe P8. Every custom role or override it lists that should keep the ability to undo a rejection needs an explicit `collectiveOrder.reopen` grant (after the D12-A catalog INSERT); if P8 contradicts the choice, stop and re-plan.
- **Where it lands:** `permissions.ts`, the `NODE_KEYS` test list, §7 probe P8.

**D11: What does the pane show after a refused decision?** · Status: Decided · Shapes: the pane part of Task 2.5 and the refusal test in 2.6

| | Approach | Consequence |
|---|---|---|
| **A** | **Keep the pane on the order, read by id** (Recommended). When the reading row leaves the filtered list, the pane falls back to `collectiveOrder.get` for `readingId`, mapped by the same row mapper | Journey 4 as written: B sees why they were refused and the Rejected state with Reopen, in place. One extra query only while the row is off-list. Side effect: the pane also survives any other refetch that drops its row (for example a colleague deciding it), with no position or prev/next. |
| **B** | **Close the pane on a refusal**, and the toast names the tab the order is now on | No new query and no mapper extraction. B must switch tabs and find the order again to see the state or reopen it. |
| **C** | **Keep today's code apart from not advancing** | The pane silently closes when the refetch drops the row (`order.to-receive.tsx:846-848`), with no pointer to where the order went. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-17)
- **Shapes:** the pane part of 2.5 and the 2.6 refusal test.
- **Where it lands:** §4 Web, Journey 4 step 2, 2.5, 2.6, §10 edge case 1.

**D12: How does the `collectiveOrder.reopen` row reach `permission_node` in each environment?** · Status: Decided · Gates: the Phase 2 dev proof (§10) and any production P8 grant; not the code

| | Approach | Consequence |
|---|---|---|
| **A** | **Owner-run reviewed INSERT** copied from the `receive` row: dev before the proof, production after deploy (Recommended) | Exactly one row, no side effects, and the shape is copied so it cannot be mistyped (§7). Needs Wilfred's yes on dev and Wilfred's own run on production. |
| **B** | **An admin presses Sync system roles** (`role.syncSystemRoles` → `seedPermissionNodes`) per org | In-app, no SQL. It also inserts any missing system-role grants for that org, a wider write than this plan needs. |
| **C** | **Insert nothing now**; root holders reach `reopen` by ancestor resolution | No production write. Custom roles and member overrides (P8) cannot be granted `reopen` until someone adds the row. |

- **Recommendation: A.** No pipeline runs `db:seed-nodes` and it cannot run under bun (Phase 0 Permissions); `docs/plans/plan-of-record-2026-07-30.md:227` shows hand inserts are already the practice on dev.
- **Chosen: A** (Wilfred, 2026-09-17)
- **Re-check before the Phase 2 dev proof:** run the read-only `SELECT` in §7 step 3 first and confirm the `receive` row's shape, then apply the INSERT with Wilfred's yes; production is Wilfred's own run after the deploy and before any P8 grant. If that read contradicts what §7 assumes, stop and re-plan the statement. Task 2.2's code can be written without it.
- **Where it lands:** §7 "Catalog row, owner-run", §10 Migrations, §9 Risks.

**Cross-plan item X6: Which plan owns the order under-review freeze and its row lock?** (step 12 D5, step 14 D5, step 15 D17, formerly labelled "X1" in step 15; `steps-12-15-crosscheck.md` X6) · Status: Decided · Affects: step 14 Phase 1 and step 15 Phase 1; no step-13 task

| | Approach | Consequence |
|---|---|---|
| **A** | **Step 15 owns it** (Recommended by X6): its Phase 1 freezes every order content writer and locks `collective_order.exists`; 15 P1 → 14 P1 | One owner. Matches the SOP (`fixes[0]` under step 15), step 12 D5-A and step 14's revised D5-C. Tests go in `collective-order.under-review.test.ts` [NEW, step 15]. |
| **B** | **Step 14 owns it** and adopts step 15 §4.1 verbatim; 14 P1 → 15 P1 | Also one owner, but step 15 drops Tasks 1.1-1.4 and step 12 D5 is re-pointed. Step 14 Phase 1 grows by a concurrency-sensitive task. |
| **C** | **Defer the freeze**; ship step 14 readiness and step 15 without it | Breaks the circular dependency, but a submitted order stays editable under review, so the readiness check can be defeated. |

- **Recommendation: A**, as `steps-12-15-crosscheck.md` X6 recommends.
- **Chosen: A** (Wilfred, 2026-09-17) — **step 15** owns the under-review freeze and the lock in `collective_order.exists`, and **step 15 Phase 1 merges before step 14 Phase 1**. Settled together with step 12 D5, step 14 D5 and step 15 D17.
- **Affects?** Steps 14 P1 and 15 P1 only. Not step 13: `receive`, `reject` and `reopen` are on no plan's frozen-writer list.
- **Where it lands:** in this plan, only Phase 0 "Overlap" and the §7 collision table; the work lives in steps 14 and 15.

### Decided — no task in this plan

**D4: Should a rejected (or unaccepted) order be kept out of operations beyond the intake record?** · Status: Decided · No task in this plan

| | Approach | Consequence |
|---|---|---|
| **A** | **Not in this step** (Recommended). Record adjacent defect 1 as unowned follow-up work (`steps-12-15-crosscheck.md` X13: step 14 does not plan it), and run probes P3/P4 first | Step 13 fixes what the finding names (an unrecorded reversal and a dead end) without changing nine ledgers or five write procedures. Rejection stays advisory outside To Receive until then, which must be said to ops. |
| **B** | **Ledgers hide rejected orders by default.** `OrderLedgerPage` adds `acceptStatus` ≠ `rejected` unless a filter asks, which needs a `list` input for "not rejected" | Rejected jobs stop appearing in daily ledgers. It touches the shared ledger page for nine trades, a `list` input contract and their parity specs, and a job someone already worked disappears from view. |
| **C** | **Server freezes rejected orders**: `update`, `saveChildren`, `transition` and `review` refuse while `acceptStatus = 'rejected'` | Rejection becomes truly terminal until reopened. Five write paths change, and any rejected order with cost lines (P3) becomes uneditable, including billing corrections. |

- **Recommendation: A.** The data (P3, P4) should decide whether B or C is wanted.
- **Chosen: A** (Wilfred, 2026-09-17) — not in this step. Per X13 this stays **UNOWNED and is recorded as an accepted known gap**: step 14 never mentions `acceptStatus`, step 15 D14-C records it as unowned, and no step 12-15 plan picks it up.
- **Re-check before any follow-up:** probes P3 and P4 (do rejected or unaccepted orders already carry cost lines); if they contradict the choice, that follow-up is re-planned, not improvised inside step 13.
- **Blocking?** No.
- **Where it lands:** §1 out of scope, §7, §9 Risks.

**D8: Should a rejection require a reason?** · Status: Decided · No task in this plan

| | Approach | Consequence |
|---|---|---|
| **A** | **Keep it optional** (Recommended) | No change. `RejectDialog`'s docblock records that eyun's control was never observed with data. A reopen's reason (required) still explains every reversal. |
| **B** | **Required on the server** (`reason: z.string().trim().min(1).max(500)`) | Every rejection is explained. It breaks any caller that omits it (guards tests `:321-328`, `:351`, counts `:1388`), and the seeder already passes one. |
| **C** | **Required in the dialog only** | Explained in practice for UI users. The server accepts reason-less calls, so the rule is soft. |

- **Recommendation: A** until probe P7 shows how often the reason is left blank.
- **Chosen: A** (Wilfred, 2026-09-17) — the reason stays optional and nothing in this plan changes.
- **Re-check:** probe P7 (how often `reject_reason` is null); if it contradicts the choice, stop and re-plan for B as its own change, not inside step 13.
- **Blocking?** No.
- **Where it lands:** none unless changed.

### Decided — precedent-following (were Assumed until 2026-09-17)

**D9: How are concurrent intake decisions serialized?** · Status: Decided · Shapes: Tasks 2.2-2.3

| | Approach | Consequence |
|---|---|---|
| **A** | **`SELECT … FOR UPDATE` on the scoped load in all three handlers** (Recommended) | Matches the repo's lock precedent (`governed/writer.ts:234`, `audit/shared.ts:44`), and step 11 D3-A chose the same for conversion. It cannot be proven on PGlite, so the proof is a real-Postgres test (Task 2.3). |
| **B** | **Conditional UPDATE** `… WHERE id = ? AND accept_status = <expected>`, and CONFLICT when zero rows | No lock and provable on PGlite. The refusal message must be computed after a failed update (a re-read), and the audit `before` is taken from a read that may already be stale. |
| **C** | **No change** | The last writer wins, and two contradictory audit rows can appear. Rare on a one-at-a-time queue. |

- **Recommendation: A.** Same `.for("update")` pattern as `governed/writer.ts:234` and `audit/shared.ts:44`; a different answer changes no user-visible behaviour.
- **Chosen: A** (Wilfred, 2026-09-17). It follows the repo's lock precedent and step 11 D3-A; B or C would change Tasks 2.2-2.3 but no journey.
- **Blocking?** No. Its proof is the real-Postgres test in 2.3, whose output the PR pastes because CI has no `DATABASE_URL_TEST` (X8).
- **Where it lands:** §4 data flow, §8 item 6, 2.3 concurrency test, §10 edge case 4.

**D10: When does each phase merge relative to steps 04-11?** · Status: Decided · Scheduling only

| | Approach | Consequence |
|---|---|---|
| **A** | **Phase 1 any wave (web-only, no collisions). Phase 2 after step 11 Phase 2**, re-finding symbols (Recommended) | The dead end closes early. Phase 2 avoids rebasing through the allocator move and adjacent allow-list edits. |
| **B** | **Both phases after step 11 Phase 2** | One worktree. The link waits for Wave 5 for no technical reason. |
| **C** | **Both phases early**; step 11 Phase 2 rebases over 13 | Earliest fix of the asymmetry. Step 11's opus-level allocator move absorbs a conflicting `architecture.test.ts` and router rebase. |

- **Recommendation: A.** Phase 1 collides with no plan; Phase 2 avoids rebasing through step 11's allocator move.
- **Chosen: A** (Wilfred, 2026-09-17). `steps-12-15-crosscheck.md` §1 and its wave table already schedule 13 P1 in Wave 1 and 13 P2 after 11 P2. Per X16 the uncommitted `e2e/` changes in `nct-layout` are committed before Wave 6.
- **Blocking?** No (scheduling only).
- **Where it lands:** §7 merge order.

### Risks
- _Rejection stays advisory in the ledgers (adjacent defect 1)_ → certain under D4-A (Decided), medium impact → **the release note says plainly that "Rejected" is an intake record, not a freeze. Per X13 this is an accepted known gap with no owner in steps 12-15; probes P3/P4 decide whether a later step takes B or C.**
- _A custom role or member override loses the ability to undo a rejection it could undo before_ → low likelihood (probe P8) → **run P8 before deploy, and grant `collectiveOrder.reopen` to any listed role or member that should keep it.**
- _PGlite cannot prove the row lock_ → certain → **2.3 adds `collective-order.intake.concurrency.test.ts` [NEW] on real Postgres, held-lock ordering rather than a racing `Promise.all`, run once against the HEAD handler to show it fails. CI skips it (no `DATABASE_URL_TEST`), so its output is pasted in the PR (X8).**
- _`collectiveOrder.reopen` missing from `permission_node` in an environment_ → certain unless inserted (no pipeline runs `db:seed-nodes`) → **root holders are unaffected; §7 owner-run INSERT (D12-A, Decided) before any P8 grant, then the read-only check.**
- _Phase 2 e2e mutating the shared parity fixture_ → removed by design → **per-test orders created in `beforeEach` and deleted in `afterEach` (Task 2.6).**
- _Line drift from step 11 Phase 2_ → certain → **tasks locate by symbol (`receive`, `reject`, `assertUnlocked`, the allow-list strings), not by line.**
- _Deploying web before server_ → medium → **§7 coupling: server first, or both together.**
- _Merge dependencies across 11/12/14/15_ → certain → **fixed order per the crosscheck: 15 P1 before 14 P1 (X6), 14 P1 before 15 P3 for `seed/operations.ts` (X12), `assignNumber`'s lock owned by step 12 Task 1.1 (X7). 13 P2 merges after 11 P2 and rebases by symbol after whichever of 12/14/15 lands first.**
- _The uncommitted `e2e/` changes in `nct-layout` (X16)_ → certain → **they are committed before Wave 6; step 13's spec edits rebase on whatever lands. `nct-layout` stays read-only for this planning work.**
- _The Phase 0 evidence claimed the to-receive e2e specs do not run in CI_ → corrected (`e2e.yml:81-99`) → **Phase 1 and 2 spec changes gate CI, so they must pass before merge.**

### Finding text vs code (Phase 0 wins)
1. "with no second decision recorded": a `collectiveOrder.receive` audit row with `before: rejected` is written (`:3248-3256`). What is missing is a reason, a separate verb and permission, and the row's rejection stamps (cleared at `:3243-3244`). The plan fixes those.
2. "A received order can never be rejected": true, and kept by design (D1-A). Lifecycle retires live orders.
3. The SOP step text "reject it with a reason": the reason is optional (`reject-dialog.tsx:117`). D8.
4. `nct-dead-queues` "To Receive has no link out": true (`order.to-receive.tsx:429-431`, `:1576-1590`). The Shipment review half is step 17's.

## 10. Verification & Proof

**App URL:** http://localhost:3101/order/to-receive (web :3101, API server :3000). Run one worktree's servers at a time.
**Preconditions:**
- **Fixture:** the multi-actor audit org, `bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed walk13-<date>` (usage at `e2e/fixtures/seed-cli.ts:11-13`; line numbers are at HEAD, and the uncommitted working-tree edits shift lines after `:25`, so locate `ACTORS` and `seedParity` by symbol). Its stdout JSON holds `organizationId`, `branchId` and a signed `cookie` per actor (`ACTORS` `:45-69`): owner, directorA/B, accountant, **salesperson** (sales), **managerA**/managerB (branch-manager), viewer. It has **no ops actor and no orders**. (Not `seed-parity`: that seeds one owner cookie and no orders, `seedParity` `:169-223`; `acceptPass` lives in `seed/operations.ts`, a separate RPC seeder, and neither command runs it.)
- **Decider:** **managerA** stands in for ops. branch-manager holds the `collectiveOrder` root (`roles.ts:102`, `:107`) as ops does (`roles.ts:154`, `:169`), so the server path is identical. Sales is **salesperson**.
- **Setup script** (`e2e/out/_walk/setup13.ts`, run with bun, using `e2e/fixtures/rpc.ts` `rpc(request, path, cookie, input)` with managerA's cookie):
  1. `collectiveOrder/create` ×4 with `owningBranchId = branchId`: **U1** (`road`), **U3** (`sea_export`), **U2** (`sea_export`) and **R** (`sea_export`), each with a distinct `jobNumber` `W13-*`.
  2. `collectiveOrder/reject` on **R** with reason "Seeded rejection — incomplete booking details" (legal from `unaccepted` before and after Phase 2).
  3. Print the four ids and numbers.
- Unaccepted orders in two trades whose segment is not a mechanical transform: **U1** (`road`) and **U3** (`sea_export`).
- Announce the active org before driving the browser. Use the managerA cookie for the ops walk and the salesperson cookie for edge case 3.

**Migrations:** none (D3-A). The journal is not touched by this plan, so there is nothing to confirm in `packages/db/src/migrations/meta/_journal.json`. Before the Phase 2 proof, the owner-run `permission_node` INSERT from §7 is applied to the dev branch (with Wilfred's yes; `db:seed-nodes` cannot run under bun), and the read-only check `SELECT key, parent_key, is_endpoint FROM permission_node WHERE key = 'collectiveOrder.reopen';` returns one row. Grants to custom roles or members (P8) only after that.

**Test commands** (read each output for `failed` / `error TS`; `bun run check-types` can exit 0 while printing "failed"):
- Phase 1:
  - `bunx vp test run apps/web/src/components/shell-next/record-routes.test.ts`
  - `bun run check-types`
  - `bun run e2e:parity -- e2e/to-receive/row-actions.spec.ts`
- Phase 2:
  - `bunx vp test run packages/api/src/modules/collective-order/intake-guard.test.ts packages/api/src/routers/collective-order.guards.test.ts packages/api/src/routers/collective-order.seeded-roles.test.ts packages/api/src/routers/collective-order.parity.test.ts packages/api/src/architecture.test.ts packages/api/src/permissions`
  - `bunx vp test run apps/web/src/components/order-ledger/accept-status-tabs.test.tsx`
  - `DATABASE_URL_TEST=<dev Neon branch URL> bunx vp test run packages/api/src/routers/collective-order.intake.concurrency.test.ts` (read the output: `skipped` means the URL was not set, which is not a pass)
  - `bun run check-types`
  - `bun run e2e:parity -- e2e/to-receive`

**Phase 1 golden path (Journey 1), as managerA (standing in for ops):**
1. Navigate to `/order/to-receive` → the **Unaccepted orders** tab is lit, and rows are listed.
2. Click the `road` order's row → the pane opens. Its actions show **Receive this order**, **Rejected** and **Open full page ↗**.
3. Press **Receive this order** → toast "1 order received", and the pane moves to the next row.
4. Click the **Received order** tab, then the same order's row → press **Open full page** → the URL is `/order/land/<id>`, and the record page heading shows that order.
5. Press **Edit order** → `/order/<id>/edit` shows the form.
6. Back on To Receive, open a `sea_export` row's **⋯** menu → **Open full page** → `/order/sea-export/<id>`.

**Phase 1 edge case:** a row whose trade has no segment. Only reachable through legacy data, so there is no seed for it. Confirm by unit test that `orderRecordPattern("logistics_cd")` returns null, and that the page omits the button rather than rendering a dead link (code read of the null branch).
**Phase 1 regression:** the row tick and ✕ still decide without moving the pane (`row-actions.spec.ts` "the Actions cell does not also open the pane"). The ledger pane's **Open full page** on `/order/sea-export` is unchanged.

**Phase 2 golden path (Journeys 2 and 3), as managerA (standing in for ops):**
1. `/order/to-receive` → click **U2** → press **Rejected** → reason "duplicate of test" → **Reject** → toast "1 order rejected".
2. **Rejected** tab → click U2 → the pane's Intake group reads "Rejected on <today> · duplicate of test". The actions are **Reopen…** and **Open full page**, with no Receive. The row shows a disabled tick and ✕, plus a **Reopen** icon.
3. Press **Reopen…** → the dialog's **Reopen** stays disabled while the reason is empty → type "not a duplicate" → **Reopen** → toast "<number> reopened, back in Unaccepted". U2 leaves the Rejected tab, and the Unaccepted count rises by 1.
4. **Unaccepted orders** tab → click U2 → Intake reads "Previously rejected on <today> · duplicate of test". Press **Receive this order** → toast "1 order received".
5. `/audit-log` filtered to U2 (or by action) → three rows in order: `collectiveOrder.reject`, `collectiveOrder.reopen` (the after holds "not a duplicate"), `collectiveOrder.receive`.

**Edge case 1: stale tab (Journey 4).** Open **U3** in two tabs. In tab A, reject it. In tab B, which still shows it unaccepted, press **Receive this order** → toast "This order was already rejected on <today>. Reopen it with a reason before receiving it." Per D11-A the pane **stays on that order** and, after the refetch, shows **Reopen…**.
**Edge case 2: reject after receive.** On a received order, the row ✕ is disabled. Through the network (walk script with the managerA cookie), call `collectiveOrder/reject` → CONFLICT "This order was already received on …, so it can no longer be rejected. End, archive or delete it instead." No raw `received` token appears.
**Edge case 3: sales (Journey 5).** With the salesperson cookie (sales hold `collectiveOrder.read` at branch scope, and every seeded actor is a member of the seed branch, `seed-cli.ts:125`), open `/order/to-receive` → rows are listed, the tabs show no counts, no tick, ✕ or Reopen renders, and the pane shows only **Open full page**, which works.
**Edge case 4: concurrency (D9).** Proven by `collective-order.intake.concurrency.test.ts` [NEW] (Task 2.3), not by a browser or `Promise.all` walk: two calls fired together over Neon usually do not interleave, so one run proves nothing. Evidence required: its output on the HEAD handler (fails: row ends `received`) and on the Phase 2 handler (passes: B CONFLICT, row `rejected`, one decision audit row).

**Regression check.**
- The tab counts partition the scope before and after a reopen (the counts test, plus visual sum).
- The pool-strip "To receive" count matches the Unaccepted tab.
- `seed/operations.ts acceptPass`: code read only (Task 2.6) that its `/already|CONFLICT/i` match (`:368-378`) covers the new sentences; it is not re-run here, because neither `seed-cli.ts` command runs it.
- `bun run e2e:parity -- e2e/to-receive` still passes `row-actions.spec.ts` "every row carries its own Receive and Reject" (`toHaveCount(5)`) after `intake-decisions.spec.ts` runs.
- `/order/sea-export` ledger rows and its pane are unchanged.
- `collectiveOrder.duplicate` of a received order still produces an `unaccepted` copy (`:2694`).

**Mobile:** at 400px on `/order/to-receive`:
- The pane's action row (Receive / Rejected / Open full page, or Reopen / Open full page) wraps without horizontal scroll.
- The row Actions cell (up to three icons plus ⋯) stays within its column.
- The Reopen dialog's textarea and buttons fit the viewport.

**Readiness: 9/10 — every decision is settled (2026-09-17), so both phases are executable; what is left is sequencing, probes and proofs, not choices.** Phase 1 is small, fully located, backed by an existing tested route map, and could ship today. What remains:
- Merge dependencies: 13 P2 after 11 P2, rebased by symbol after whichever of 12/14/15 lands first; 15 P1 before 14 P1 (X6); 14 P1 before 15 P3 (X12); the `nct-layout` `e2e/` working tree committed before Wave 6 (X16).
- Read-only production probes still to run, each with a "stop and re-plan if it contradicts the choice" gate: P1/P5 (queue size, legacy stamps), P2/P6 (D2, D3), P3/P4 (the D4 gap), P7 (D8), P8 (D7, D12 grants).
- The row lock is proven only on real Postgres, which CI skips (no `DATABASE_URL_TEST`), so its evidence is a pasted local run on the **dev** branch, before and after the change (X8). Every proof in this plan is dev-DB-only; nothing is run against production.
- `collectiveOrder.reopen` reaches `permission_node` only through the owner-run INSERT (D12-A); any P8 grant waits for it.
- Rejection stays advisory in the trade ledgers (D4-A): an accepted known gap with no owner in steps 12-15 (X13).

## Review disposition (2026-09-17)

1. major · correctness · Pane cannot stay on a refused order: `reading` comes from the filtered list (`order.to-receive.tsx:846-848`) and the refetch (`:759`) drops the rejected order → **Fixed** (confirmed at HEAD). New open decision D11 (A: fall back to `collectiveOrder.get` by `readingId` with an extracted `toQueueRow`, recommended; B: close and name the tab). Updated Journey 4 step 2, §4 Web, Task 2.5, Task 2.6 refusal test (asserts per D11 option), §8 Errors, §10 edge case 1, Key decisions.
2. minor · correctness · §7 row-lock text said other writers do not wait → **Fixed** (§7 Row lock): their `UPDATE collective_order` (for example `routers/collective-order.ts:2934`) waits for the short intake transaction; no deadlock cycle because each handler locks one order row.
3. minor · correctness · Collision table said steps 12/14 have no plans and omitted 15 → **Fixed** (Phase 0 Overlap and §7 collision table): lists 12 Task 1.1, 14 Tasks 1.2-1.3, 15 Tasks 1.2-1.3 and 2.1 by handler, adds a `guards.test.ts` row, and states Phase 2 rebases by symbol after whichever of 11/12/14/15 lands first. No plan touches `receive`/`reject`/`reopen`.
4. major · data-safety · Plan relied on a `db:seed-nodes` deploy step that no pipeline runs and that cannot run under bun → **Fixed** (confirmed: `seed-nodes.ts:1` → `packages/db/src/index.ts:1` → `packages/env/src/server.ts:5` `cloudflare:workers`; no `.github` caller; `plan-of-record-2026-07-30.md:227`). Phase 0 Permissions, §7 "Catalog row, owner-run" (reviewed `INSERT … SELECT … FROM permission_node WHERE key = 'collectiveOrder.receive' ON CONFLICT DO NOTHING`, dev with Wilfred's yes, production by Wilfred before any P8 grant, read-only check; `role.syncSystemRoles` named as the in-app alternative with its grant side effect), §9 Risks, §10 Migrations.
5. major · verifiability · §10 fixture was wrong (`seed-parity` has one owner cookie, no orders, no `acceptPass`; missing `--preload`) → **Fixed** (confirmed `seedParity` `seed-cli.ts:169-223`). §10 Preconditions now use `bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>`, managerA as the decider (branch-manager holds the root like ops), salesperson for edge case 3, and a setup script that creates U1/U2/U3/R and rejects R over RPC. Regression line about re-running `acceptPass` replaced by a code read.
6. major · verifiability · Lock proofs unreliable (PGlite false positive; single `Promise.all` over Neon) → **Fixed** (Task 2.3, §8 Testing, D9 row, §9 Risks, §10 commands and edge case 4): `collective-order.intake.concurrency.test.ts` [NEW] on the `expense.concurrency.test.ts` pattern, held `FOR UPDATE` on connection A, receive on B, reject-and-commit on A, assert CONFLICT and one audit row; must be shown failing on the HEAD handler. CI skips it (no `DATABASE_URL_TEST` in workflows), so output is pasted.
7. major · verifiability · Phase 2 e2e would mutate the five shared parity rows (`row-actions.spec.ts:26` `toHaveCount(5)`, `workers: 1`) → **Fixed** (Task 2.6, §6 agent table and file ownership, §7 table, §9 Risks, §10 regression): new `e2e/to-receive/intake-decisions.spec.ts` [NEW]; each test creates its own `E2E-DEC-*` order in `beforeEach` (branch id read from `collectiveOrder/list`) and deletes it in `afterEach`.

Counts: 7 fixed, 0 rejected, 0 deferred.

### Self-review gate (2026-09-17)

/planpro Closing Step checklist, run against this file (tier **Standard**, **2** phases). Callers and migrations re-verified by grep at nct-layout HEAD `6bb3a1bf` in this pass.

- §4 data models and endpoints name the journey step they serve → **fixed**: added "Traces to" lines for `receive`, `reject`, the intake guard, the D3-A data model, the permission node, `ReopenDialog` and the page's row/pane changes (`reopen` and `orderRecordPattern` already traced).
- §5 tasks list real file paths or `[NEW]` → **pass**: 18 cited paths checked for existence at HEAD; `intake-guard.ts`, `intake-guard.test.ts`, `reopen-dialog.tsx`, `intake-decisions.spec.ts` and `collective-order.intake.concurrency.test.ts` are absent and tagged `[NEW]`.
- Every §5 task has exactly one owner agent from §6 → **pass** (1.1-1.2 A, 1.3 B, 2.1-2.3 C, 2.4-2.5 D, 2.6 B).
- No new dependency outside a §9 open question → **pass** (none added).
- Every §9 decision has three approaches, one recommendation, a status and blocking marked → **fixed**: the blanket "OPEN — Wilfred decides" replaced by per-decision status. New D12 (catalog row path, previously only in §7). **Superseded on 2026-09-17:** Wilfred accepted every recommendation, so D1-D12 and cross-plan item X6 are all **Decided A**; all three approaches stay in the register, and probe-dependent decisions carry a re-check line.
- Every §1 assumption and §4 key decision points at a §9 id → **fixed**: §4 Key decisions gained D12 and X6 and names the intake-guard layout as following from D1-A. **Superseded on 2026-09-17:** §1 now carries one "Decisions (settled)" list pointing at the §9 ids, with no Assumptions split.
- Every Input Gate question appears in §9 as Decided → **n/a**: no Input Gate was held (stated in §1).
- §7 caller list came from a grep this session → **fixed**: re-grepped; added `order.to-receive.tsx:756`, `seed/operations.ts:381`/`:387`, `seeded-roles.test.ts:136-142`, `parity.test.ts:316`, corrected the guards-test count (17 lines by symbol, was "19"), noted the uncommitted `e2e/` edits call neither procedure. Collision table corrected per `steps-12-15-crosscheck.md` §2: `permissions.ts` is also written by step 15 Task 2.1, `seed/operations.ts` by 14/15 (X12), and freeze ownership references X6 instead of "14 Tasks 1.2-1.3 … freeze guards".
- §10 URL and port are the project's dev URL → **pass**: `http://localhost:3101` (`apps/web/vite.config.ts:8` `port: 3101`).
- Migration numbers match the journal → **fixed**: journal confirmed at 65 entries ending `0065_quotation_send_decision`; removed the dead `0075` reservation (11 D3-A chosen) and cited X14 placeholders. This plan still adds no migration under D3-A.
- Tier in META.md matches what was written → **pass**: Standard, 2 phases, all 10 sections present (META.md to be created from these values).
- §1 Assumptions lists every judgment call made in place of asking, with its §9 id → **fixed** (D9, D10). **Superseded on 2026-09-17:** nothing is assumed any more; D9 and D10 are Decided A alongside the rest.
- Context file named, requirements planned or declined, conflicts in §9 → **pass**: the two tracker items are named in §1 with planned/declined status, the step 17 half is declined, and finding-vs-code conflicts are in §9 "Finding text vs code".

### Decisions settled (2026-09-17)

Wilfred accepted the recommended option for every decision in this plan and every settlement in `steps-12-15-crosscheck.md`. All three approaches stay in §9; only status and chosen lines changed.

- D1 → **A** (a separate `reopen` verb; `receive` and `reject` are legal only from `unaccepted`)
- D2 → **A** (a reopen returns the order to `unaccepted`) · re-check P2
- D3 → **A** (`audit_log` only; the row keeps `rejected_at` / `reject_reason` through the reopen; no migration) · re-check P2, P6
- D4 → **A** (rejection is not enforced beyond the intake record in this step; accepted known gap, unowned, X13) · re-check P3, P4
- D5 → **A** (the link goes to the trade record page `/order/<segment>/$orderId`)
- D6 → **A** (decision buttons hidden when `acceptStatusCounts` answers FORBIDDEN) · re-check P8
- D7 → **A** (new endpoint node `collectiveOrder.reopen` under the root) · re-check P8
- D8 → **A** (a rejection reason stays optional) · re-check P7
- D9 → **A** (`SELECT … FOR UPDATE` on the scoped load in all three intake handlers)
- D10 → **A** (Phase 1 any wave; Phase 2 after step 11 Phase 2, re-found by symbol)
- D11 → **A** (a refused decision keeps the pane on the order, read by id)
- D12 → **A** (owner-run reviewed INSERT of the `permission_node` row; dev before the proof, production by Wilfred before any P8 grant)
- Cross-plan X6 → **A** (**step 15** owns the order under-review freeze and the lock in `collective_order.exists`; 15 P1 merges before 14 P1)

Cross-plan settlements this plan's text was made consistent with: X6 (freeze owner is step 15, not step 14), X7 (step 12 Task 1.1 owns the `assignNumber` row lock), X8 (step 15 creates `collective-order.concurrency.test.ts` and step 14 adds a describe; step 13 keeps its own `collective-order.intake.concurrency.test.ts`, and every such PR pastes real-Postgres output because CI has no `DATABASE_URL_TEST`), X9 (step 14 reuses step 07's `assertPublishable` hook), X11 (the widened re-stamp is folded into step 11 Task 2.4), X12 (step 14 Phase 1 before step 15 Phase 3 for `seed/operations.ts`), X13 (submit-time order-state checks, keeping rejected orders out of ledgers, and the steps 14-15 SOP text stay **UNOWNED — accepted known gaps**), X14 (conditional migrations are named `00NN_<name>` and numbered at merge; step 13 adds none), X16 (the uncommitted `e2e/` changes in `nct-layout` are committed before Wave 6).
