# Step 21 — a fee approval covers what the reviewer read, holds until the fee is billed, and only the queue can grant it

**SOP step:** 21 "Get the fees reviewed" · submitter: **Money → Cost lines** (`/expenses/cost-lines`) → tick rows → **Review (n)** → **Submit for review** · reviewer: **Approvals → Cost review** (`/approve/cost`) → **Approved** / **Rejected**
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` (base branch `feat/new-layout`), 2026-09-21. The working tree read is `C:/Project/NCT/nct-layout` on `feat/intake-golden-path-e2e` at `ea1560e7`; `git diff --stat 6bb3a1bf HEAD -- packages apps` is empty, so every `packages/` and `apps/` citation below matches `6bb3a1bf`. Every `file:line` was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Standard. Changes guards on every cost-line writer (the fee ledger's single-row and batch verbs, and the order fees page's `saveChildren` cost leg), adds one state to `createBill`'s J4 floor (the gate-call fix is step 22 Phase 1's, X28), deletes two live RPC procedures and a governed-writer verb from a guarded allow-list, flips one per-resource engine flag, and changes behaviour for existing orgs and live fees. No migration under any recommended option.
**Status:** every decision in §9 is **Decided** (Wilfred, 2026-09-21: the recommended option throughout, with the crosscheck X-item overrides listed in "Decisions settled" at the end; D1 is handed to step 22 under X28). Each keeps its three approaches.
**Cross-plan items owned:** none handed over by name. This plan takes, for `cost_line`, the three shapes step 15 fixed for `collective_order` (under-review freeze, approval that binds, legacy self-approval verb). Step 15 D2-B deliberately left the order fees page's cost leg outside the order freeze on the grounds that "costs are governed by the cost-line review"; §Phase 0 Finding D shows that review does not govern that path today, so this plan closes the gap D2-B relies on.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`). Cost-line single-row verbs go through the governed writer `costLineWriter` (`routers/expense/cost-lines.ts:293`; pipeline in `modules/governed/writer.ts`: node → tx → scoped `FOR UPDATE` load `:234` → gates `:250` → pinned write `:318-323`). Drizzle schema in `packages/db/src/schema`. TanStack Router file routes in `apps/web/src/routes/_next`. vitest on PGlite; real-Postgres suites use `describe.skipIf(!TEST_URL)` (`routers/expense.concurrency.test.ts:65`). Dev: web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Submit.** Ledger mode of `CostLinesPage` renders `<ReviewMenu onReview={engineReview("cost_line")}>` only when rows are ticked (`apps/web/src/routes/_next/expenses/cost-lines.tsx:2221-2227`). `ReviewMenu` fans out one call per id with `Promise.allSettled` (`components/review-menu.tsx:101-116`), so a mixed selection half-succeeds. `engineReview` maps `pending` to `auditReview.submit` (`lib/audit-review.ts:37-38`).
  - **Engine.** `submitForReview` (`modules/audit/submit.ts:24`) checks `submitNode` (`:33`; `EXPENSE.costLineUpdate`, `resources.ts:400`), `exists` (`:39`; org-only, no lock, `resources.ts:402-408`), the enabled flow (`:45-50`), initiators, one open attempt (`:71-84`), inserts the submission, then `repaintCache` (`:151-156`), which **UPDATEs the `cost_line` row inside the submit transaction** (`resources.ts:409-432`).
  - **Queue.** `/approve/cost` mounts `<CostLinesPage mode="review">` (`routes/_next/approve/cost.tsx:18-66`). The list adds `awaitingMyReview(context.org, "cost_line", costLine.id)` (`routers/expense/cost-lines.ts:881-882`). **Approved / Rejected** call `engineDecideBatch("cost_line", ids, to, reason)` (`cost-lines.tsx:1971`), i.e. `auditReview.decideByResource`, one transaction, all-or-nothing (`routers/audit-review.ts:394-423`). Decide re-checks `reviewNode` (`modules/audit/decide.ts:50`).
  - **Seed.** `SEEDED_FLOWS` "Cost review" (`modules/audit/seed.ts:166-175`): one stage, role `accounting`, `any_pass_all_reject`, `withdrawalMode: "direct"`, **`gates: []` (`:173`)**. `seedAuditFlows` writes `postApprovalEditable: false` (`:232` region) and runs only for new orgs. The six `cost_line` gate keys (`mark_reconciliation`, `create_bill`, `lock_cost`, `unlock_cost`, `write_off`, `export_document`) are declared and "deliberately unticked" (`modules/expense/gates.ts:26-47`).
  - **Roles** (`packages/api/src/roles.ts`): ops hold the `expense.costLine` root (`:158`), so update, delete **and review**; accounting holds the `expense` root (`:174-175`), so it can submit **and** decide; director holds `expense.costLine.review` as a leaf (`:205`); admin and branch-manager hold `expense`.

- **Finding A — `createBill` checks the opt-in "must be approved" gate against the raw ticks, not the resolved selection: confirmed.** `createBill` (`cost-lines.ts:2388`) resolves ticks, or the whole filter result when nothing is ticked, into `costLineIds` (`:2448-2454`, `resolveCostLineSelection`, `routers/expense/shared.ts:1042-1057`). Every later check uses `lines`/`costLineIds` except the gate, which is handed `input.costLineIds` (`:2502-2508`). On the unticked path that array is `[]` and `assertGatesCleared` returns at once (`modules/audit/gates.ts:76`). The UI offers exactly that path: **Create Bill (全选)** (`cost-lines.tsx:2214-2217`). The export router, which shares the resolver, already passes the resolved ids (`routers/export.ts:180-183, 231`), so the bug is local to `createBill`. **Consequence is conditional:** the seed ticks no `create_bill` key, so only orgs whose admin ticked it are exposed (probe 21-P1).

- **Finding B — the always-on J4 floor reads the cache, misses one open state, and runs outside the transaction.** J4 (`cost-lines.ts:2481-2496`) refuses only `auditStatus` `pending` or `rejected`. A line whose **withdrawal is awaiting a reviewer** caches `withdraw_pending` (`cacheStatusFor`, `modules/audit/resources.ts:37`) and bills. The check runs on `context.db` before the billing transaction (`:2457`, transaction `:2551`); the claim verb `claim` (`:388-404`) has **no gates** and pins only `billId IS NULL`, so a submit that commits between the read and the claim bills a line that is under review. The seeded flow is `direct` withdrawal, so `withdraw_pending` needs a tenant flow change; the race needs a submit inside a sub-second window. Low likelihood, money consequence.

- **Finding C — an approved fee is not bound by its approval on four writers: confirmed, and wider than filed.**

  | Writer | Line | Post-approval freeze | Under-review freeze | Web caller |
  |---|---|---|---|---|
  | `costLines.update` (writer `update`) | `:1319`, gates `:336-342` | `postApprovalGate` `:139-143` | **none** | edit sheet `cost-lines.tsx:395` |
  | `costLines.delete` (writer `delete`) | `:1618`, gates `:431` | **none** | **none** | `cost-lines.tsx:1906` |
  | `costLines.batch` `delete` | `:1684`, branch `:1774-1817` | **none** | **none** | **BatchOperation → Delete**, `cost-line-batch-menu.tsx:131` |
  | `costLines.exchangeRateBatch` | `:2063-2166` | **none** (`isClaimed` only, `batch.ts:116-124`) | **none** | **Modify exchange rate…**, `cost-line-batch-menu.tsx:351` |
  | `collectiveOrder.saveChildren` cost leg | `collective-order.ts:4098-4440` | **none** | **none** | **order fees page** `order.$orderId.expenses.tsx:598` |
  | `costLines.batch` reconcile / lock / archive, `tagBatch` | `:1684`, `:1939` | none | none | toolbar | 

  - `postApprovalGate` reads the latest submission and refuses only when it is `passed` under a flow with `postApprovalEditable: false` (`modules/audit/post-approval.ts:32-55`), the seeded default.
  - **The order fees page is the main door, and the SOP did not name it.** SOP step 20 books fees on `/order/$orderId/expenses`, which posts **both grids, every row, every save** to `saveChildren` (`order.$orderId.expenses.tsx:630-643`). Its cost leg loads the order's lines **without `FOR UPDATE`** (`collective-order.ts:4146-4185`), refuses only removal or money edits of **settled** lines (billed / invoiced / written off: `:4189-4190`, `:4211-4216`, `:4237-4270`), then deletes omitted rows (`:4306`) and UPDATEs every sent row (`:4396-4414`). Review state is never read. So after accounting approves a fee, ops open the same page and rewrite its amount, currency or rate, or delete it, with a "Fees saved" toast (`:600`).
  - The state toggles (reconcile, lock, archive, tags) are not content. They are left open on purpose, and this plan keeps them open (D3).
  - `assertNotUnderReview` (`gates.ts:130-143`) is called from `company.ts:1343`, `lading.ts:1474, 1513`, `quotation.ts:980` only; `cost_line` nowhere.

- **Finding D — a fee under review is fully editable: confirmed.** No cost-line writer calls `assertNotUnderReview`. A fee submitted at RM 500 can be saved at RM 5,000 on the fees page or the edit sheet while it sits in `/approve/cost`; the reviewer approves the new figure, and `postApprovalGate` then freezes it there. Deleting a fee under review leaves an **orphan open submission**: `eligibleOpenSubmissions` (`audit-review.ts:143-160`) does not join the resource, so `pendingSummary` keeps counting a row the queue can never list.
  - **Serialisation is cheaper than for orders.** `repaintCache` UPDATEs the `cost_line` row inside the submit transaction (`resources.ts:409-432`, called at `submit.ts:151`). A writer that loads the same row `FOR UPDATE` therefore serialises with submit: if the writer locks first, submit's repaint waits and the reviewer sees the saved content; if submit's repaint locks first, the writer waits, and its freeze check (a new statement under READ COMMITTED) sees the committed submission and refuses. The governed writer already locks (`writer.ts:234`). **Three loads do not:** `saveChildren`'s cost load (`collective-order.ts:4146`), `batch` (`cost-lines.ts:1734`) and `exchangeRateBatch` (`:2078`). No lock in `cost_line.exists` is needed (contrast step 15 Task 1.3, where the order has no such repaint write on the same row before commit; this plan does not rely on that difference for orders).

- **Finding E — the legacy `costLines.review` / `costLines.reviewBatch` verbs let a fee be stamped approved with no submission: not in the SOP, confirmed.**
  - `review` (`cost-lines.ts:1465-1520`) and `reviewBatch` (`:1530-1615`) require `EXPENSE.costLineReview` and write `auditStatus` plus stamps directly through the writer's `review` verb (`:357-387`, gates `reviewLockGate` `:204-210`, `auditTransitionGate` `:213-225`) or `applyReviewBatch` (`routers/expense/review-batch.ts:89`). No `audit_submission` is filed. Legal edges (`packages/api/src/quotation/values.ts:257-265`) include `draft→pending→approved` and **`rejected→draft`**.
  - Holders: ops (`expense.costLine` root), admin, branch-manager, accounting (`expense` root), director (leaf). Ops book fees, so ops can approve their own fee in two calls.
  - Money consequence: J4 reads the cache (Finding B). A fee the reviewer **rejected** is `rejected` in the cache and J4 blocks it; one legacy call `rejected→draft` makes it billable with no re-review. The engine attempt stays `rejected` and the badge disagrees with the trail.
  - Reach: no web caller (the ban is `apps/web/src/architecture.test.ts:957-976`); RPC only. Allow-list entry `packages/api/src/architecture.test.ts:871` (`costLinesRouter.reviewBatch :: applyReviewBatch(costLine)`). Test callers: `expense.review.test.ts:85, 123-208, 500-542` (J4 cases seed cache states through the verb), `expense.wave1.test.ts:502-612`, `expense.rbac.test.ts:537-560`. Comments: `-cost-lines.columns.tsx:398`, `routers/expense/batch.ts:187`, `routers/expense/bills.ts:1189`, `collective-order.ts:3471`, `collective-order.guards.test.ts:508`, `architecture.test.ts:1270`.
  - **Deleting both fails `permissions/registry.sync.test.ts:22`** ("every registry node marked isEndpoint gates a real endpoint"): `EXPENSE.costLineReview` is `isEndpoint: true` (`modules/expense/permissions.ts:110-114`) and its only `requireNode` sites are these two procedures. The engine re-checks it at decide time through `permittedNode` (`decide.ts:50`), which records no endpoint. Same shape and same resolution as step 15 D9-A and step 08 X10.

- **Finding F — accounting can approve its own fee: confirmed.** Accounting holds `expense` (submit node) and is the seeded stage role. The engine has no self-decision check until step 08 Phase 2 adds `separationOfDuties` per resource, and step 08 writes it `false` for `cost_line` ("each step flips its own resource", step 08 D1-B). The API suite relies on cost-line self-decision (`audit-review.test.ts:746`, `:1159-1162`).

- **Adjacent defects (flagged, not planned).**
  1. Engine `decide` does not refuse a locked fee; the legacy verb did (`reviewLockGate`). Low.
  2. `submitForReview` accepts a billed or locked fee (`exists` is org-only). Low; a billed fee's review has nothing left to gate.
  3. `saveChildren`'s cost leg ignores the single-fee lock and the rec/pay lock (no `lockedAt` / `recPayLockedAt` in `:4148-4175`), which `costLines.update` refuses (`singleFeeLockGate` `:146-156`, `recPayLockGate` `:159-169`). Owner: step 20.
  4. `bills.review` / `reviewBatch` are the same legacy shape (`bills.ts:1189` "the third of three"). Owner: step 23.
  5. After a refused decision the queue still clears the ticks (`cost-lines.tsx:1981-1983` run after the `catch`). UX only.
  6. `collectiveOrder.assignNumber` re-stamps `order_no` on unbilled lines (step 11 Task 2.4), approved ones included. `order_no` is a reference, not money; accepted.

- **Hand-off to step 22.** After approval the line reads Approved in **Audit Status**, drops out of `/approve/cost`, and is billed from **Money → Cost lines → Create Bill**. The hand-off itself works. The "after 21" break (`breaks[]`: the order's fees page has no Create bill, and its ledger link carries no order filter) is step 22's.

- **Precedent this plan follows.**
  - Freeze placement: after the scoped load, inside the transaction, before any write (`quotation.ts:980`, `company.ts:1343`, `lading.ts:1474`). Order: existing refusals → under review → approved-and-locked → order lock → writes.
  - Deleting a legacy verb and keeping its node with `isEndpoint: false`: step 15 Task 2.1 (D9-A), step 08 Task 3.3 (X10).
  - Per-resource self-decision: step 08 D1-B `separationOfDuties`; step 15 D8-A flips `collective_order`.
  - Partial-report contract for bulk FX: `exchangeRateBatch` already reports `skipped` from what came back (`:2144-2149`).
  - Residue report: step 15 Task 2.4 (`packages/db/scripts/…` read-only).

- **Migration state.** Journal ends at `0065_quotation_send_decision`; nothing pending. **This plan needs no migration.** No option in §9 needs one either.

- **Is the step mostly sound?** The submit → queue → decide path is sound (engine, routing, all-or-nothing decide). What is broken is everything around it: the approval does not bind, the window before approval is open, and a side door stamps the result. Three small phases.

---

## 1. Overview

**Problem.** A fee sent for review can be rewritten while accounting reads it, so the approval lands on a figure nobody saw. After approval, the same fee's amount, rate or existence can still be changed on the order fees page, by **Modify exchange rate…**, or by delete, with no re-review. A tenant that ticked "Create bill requires approval" has that rule skipped whenever the operator bills without ticking rows. And an RPC verb lets anyone holding the review node (ops included) stamp a fee approved, or clear a rejection, with no submission.

**Goals.**
- **Phase 1 (Findings A, B):** billing respects review on every path: the opt-in gate sees the real selection, the always-on floor covers every open state, and the floor is checked on the locked row inside the billing transaction. Under X28 step 22 Phase 1 delivers the gate on the resolved ids and the locked in-transaction read (22 D1-B, D2-A); this plan adds `withdraw_pending` and proves the race.
- **Phase 2 (Findings C, D):** from submit until billing, a fee's content changes only by withdrawing (under review) or not at all (approved, locked flow), on every writer, the order fees page included. Submit and save cannot interleave.
- **Phase 3 (Findings E, F):** the engine is the only writer of `cost_line.audit_status`, and nobody decides a fee they submitted.

**Success criteria.**
- With `create_bill` ticked, `createBill` with `costLineIds: []` and a `filterScope` covering an unapproved line returns CONFLICT _"\"Create bill\" requires review approval first — 1 of N selected are not approved"_ and creates no bill (delivered by step 22 Phase 1, X28; checked here in §10 Journey 3).
- `createBill` refuses a line whose cache reads `withdraw_pending`, with the J4 sentence.
- On a fee whose latest attempt is `under_review` or `withdrawal_under_review`: `costLines.update` with a content key, `costLines.delete`, `costLines.batch({action:"delete"})`, and `saveChildren` changing or removing that fee each return CONFLICT and write nothing; `exchangeRateBatch` leaves it untouched and lists it in `skipped` with `reason: "under_review"`. The same fee's reconcile / lock / archive / tag toggles still work.
- On a fee whose latest attempt is `passed` under a flow with `postApprovalEditable: false`: the same writers refuse (update already does) and `exchangeRateBatch` skips it with `reason: "approved"`. `saveChildren` re-sending it unchanged succeeds.
- `/rpc/costLines/review` and `/rpc/costLines/reviewBatch` answer 404; `registry.sync.test.ts` and both architecture tests pass.
- An accountant who submitted a fee does not see it in `/approve/cost`, and a decide call on it returns FORBIDDEN (after step 08 Phase 2, under D8-A).

**In scope.** `createBill`'s J4 floor (`withdraw_pending`; the gate input and the locked in-transaction read are step 22's, X28); under-review and post-approval freezes on `update` (content only), `delete`, batch delete, `exchangeRateBatch`, and the `saveChildren` cost leg; row locks on the three unlocked loads; one read helper; FX dialog copy; deleting the two legacy verbs, the writer `review` verb and their allow-list/registry fallout; `separationOfDuties: true` for `cost_line`; a read-only residue report; read-only production probes.

**Out of scope.**
- Freezing state toggles (reconcile, lock, archive, tags) on reviewed fees (D3).
- UI markers on the fees page for approved or under-review rows (D11; server refusals only).
- The fees page's missing Create bill and unfiltered ledger link (step 22).
- `saveChildren` ignoring the single-fee lock (step 20), `bills.review` (step 23), engine decide on a locked fee.
- Repairing drifted caches, orphans or bills already raised (D9 reports only).
- SOP text for step 21 (a `sop.json` edit in `C:/Project/ZYT-Task`, not this plan; §9 "SOP text vs code" lists what it should say).

**SOP findings (`customer-intake-sop/sop.json`, guide step 21 `fixes`):**

| Finding | Planned? | Where |
|---|---|---|
| "The 'fees must pass review before billing' gate is silently skipped whenever the operator bills without ticking rows" | Yes, as filed, by step 22 Phase 1 (D1 handed over, X28) | §10 Journey 3 proves it |
| "An approved fee's exchange rate can still be rewritten in bulk, past the post-approval freeze" | Yes, as a skip-and-report rather than a refusal (D5), and extended to the fees page (D6) | Phase 2 |
| "An approved fee can be deleted outright" | Yes, plus batch delete and the fees page (D4, D6) | Phase 2 |
| "A fee sitting in the review queue is fully editable" | Yes, content keys only (D3), every writer, with row locks (D10) | Phase 2 |
| (not filed) legacy `costLines.review` / `reviewBatch` | Yes (D7) | Phase 3 |
| (not filed) accounting decides its own fee | Yes, gated on step 08 Phase 2 and probes (D8) | Phase 3 |

**Input Gate.** Held. Every decision in §9 is **Decided** (2026-09-21): the recommended option of each, with D1 handed to step 22 and the crosscheck overrides X28, X29, X30, X33 and X34 applied to the tasks below.

## 2. User Journeys

**Journey 1 (changed): Operations submit fees and cannot rewrite them while accounting reads them**
Trigger: SOP step 20 is done; the order has fees.
Steps:
1. Ops open **Money → Cost lines**, search the job number, tick the order's two fees, **Review (2)** → **Submit for review** → toast _"2 rows — submit for review"_ (`review-menu.tsx:110`); **Audit Status** reads Pending (unchanged).
2. Ops go back to `/order/<id>/expenses`, change the THC fee from 500 to 5,000, **Save** → error toast _"1 cost line(s) are under review and cannot be changed here. Withdraw the submission first: THC"_. Nothing is written; the grid keeps the typed value.
3. The same through **Money → Cost lines** → edit sheet → Save → _"This record is under review and cannot be edited. Retract the submission first."_ (existing sentence, `gates.ts:140`).
4. **BatchOperation → Modify exchange rate…** over both fees → dialog lists both as not changed, _"under review"_ beside each.
5. **Mark as… → 对账 · Reconciled** on the same fees → works (toggles are not content, D3).
6. To correct: tick THC, **Review (1)** → **Request withdrawal** → the seeded flow is `direct`, so it reads Withdrawn at once. Edit, save, submit again.
7. Flow ends: accounting's queue shows attempts whose content matches what was saved before submit.
Where it lives: the existing ledger, fees page and batch menu; server refusals, plus one reason label in the FX dialog.

Old journey, for contrast: step 2 saved, and accounting approved 5,000 without seeing the change.

**Journey 2 (changed): An approved fee stays as approved until it is billed**
Trigger: accounting approved the fees in `/approve/cost`; the org's Cost review flow has **edits after approval** off (seeded default).
Steps:
1. Ops open `/order/<id>/expenses`, add a new "Seal fee" row, **Save** → "Fees saved" (the approved rows were re-sent unchanged, D6).
2. Change the approved THC amount, **Save** → _"1 cost line(s) are approved and locked and cannot be changed here: THC. Add a correcting fee line, or ask an administrator to allow edits after approval."_
3. Delete the approved THC row, **Save** → the same sentence with "removed". On **Money → Cost lines**, delete the row → _"This record was approved and its content can no longer be edited"_ (existing sentence); **BatchOperation → Delete** → _"1 selected line(s) are approved and locked; they cannot be deleted"_.
4. **Modify exchange rate…** over THC and the new Seal fee → Seal fee updated; THC listed as not changed, _"approved"_.
5. **Create Bill (2)** → bill created (unchanged).
6. Flow ends: the bill carries the figures the reviewer approved.
Where it lives: the same screens; server refusals.

Old journey, for contrast: steps 2–4 all succeeded silently.

**Journey 3 (changed): Billing respects the review on every path**
Trigger: an org whose admin ticked **Create bill** on the Cost review flow (`/parameters`, Approval Process Setting).
Steps:
1. Ops filter **Money → Cost lines** to one settlement unit; nothing ticked; press **Create Bill (全选)** → the dialog counts the filter's lines; Create → error toast _"\"Create bill\" requires review approval first — 1 of 3 selected are not approved"_. No bill.
2. After accounting approves the third fee, the same press creates the bill.
3. In any org: a fee whose withdrawal is waiting on a reviewer is ticked → Create Bill → _"1 selected line(s) are awaiting or failed cost review"_.
4. Flow ends: no path bills a fee the review has not cleared.
Where it lives: the existing Create Bill dialog; server only. Steps 1–2 come from step 22 Phase 1 (X28); step 3 from this plan's Task 1.1.

**Journey 4 (changed): Only the queue approves a fee, and not by the person who submitted it**
Trigger: fees are Pending.
Steps:
1. Accountant opens **Approvals → Cost review**, ticks, **Approved** → toast _"2 line(s) approved"_ (unchanged).
2. Anyone calling `costLines.review` or `costLines.reviewBatch` over RPC → 404.
3. An accountant books a fee and submits it → it is not in their own **Cost review** queue; a decide call returns FORBIDDEN _"You submitted this record. Another reviewer must decide it."_ Another accountant (or a tenant-added director stage) decides it. In an org with only one accountant, submit refuses with step 08's "nobody else can decide" sentence (D8 names the choice).
4. Flow ends: `cost_line.audit_status` changes only through `audit_submission`.
Where it lives: the existing queue; server only.

## 3. Result (What Changes for the User)

**Before:** a fee can be rewritten while accounting reviews it, and rewritten, re-rated or deleted after they approve it. A tenant's "bill only approved fees" rule is skipped on the untick-to-bill-all path. A rejected fee can be cleared and billed over RPC by the person who booked it.
**After:** a submitted fee is frozen until decided or withdrawn; an approved fee stays as approved until billed (unless the flow allows edits after approval); every billing path honours the review; approval happens only in the queue, by someone other than the submitter.
**Key differences:**
- Ops: saving the fees page refuses a change to a fee under review or approved, naming the fee. Adding new fees and re-saving unchanged ones still works. Toggles still work.
- Ops: **Modify exchange rate…** lists reviewed fees as not changed, with the reason.
- Accounting: what they approve is what was submitted; they cannot approve their own fee.
- Admins: **Create bill** on the Cost review flow now means what it says on the 全选 path.

## 4. Technical Architecture

### 4.1 Billing sees the real selection and every open state (Journey 3; Phase 1) → D1, D2

Under X28 step 22 Phase 1 owns the `createBill` body: it reads the lines `.for("update")` inside `context.db.transaction` and runs the count, billed and J4 checks and `assertGatesCleared(tx, organizationId, "cost_line", costLineIds, "create_bill")` on the locked rows (22 D1-B, D2-A). This plan's only edit there is the J4 set, on 22's locked read:

```ts
// J4 floor (on 22's locked rows): withdraw_pending joins pending and rejected (D2-A)
const OPEN_OR_FAILED = new Set(["pending", "rejected", "withdraw_pending"]);
const unapproved = lines.filter((l) => OPEN_OR_FAILED.has(l.auditStatus ?? ""));
```

No `reviewFloorGate` on the `claim` verb (X28): with the lines locked inside the transaction, a submit's `repaintCache` UPDATE of the same row either commits first (the locked read sees `pending`) or waits, so a second check on the claim adds nothing. The real-Postgres interleave in Task 1.2 proves 22's lock without it.

### 4.2 One reader for review freezes over a selection (Phase 2) → D3, D5, D6

`packages/api/src/modules/expense/review-freeze.ts` [NEW]. It lives in the expense module, not in `modules/audit/`, so it does not collide with step 15 Task 1.1's `assertNoneUnderReview` / `assertPostApprovalEditableMany` in the shared audit files:

```ts
export type ReviewFreeze = "under_review" | "approved";

/** Which of these cost lines review freezes, and why. One latest-submission query, one flow query. */
export async function costLineReviewFreezes(
  db: Context["db"] | DbTransaction,
  organizationId: string,
  ids: readonly string[],
): Promise<Map<string, ReviewFreeze>>;
// latestSubmissionByResource(db, org, "cost_line", ids) (modules/audit/shared.ts:332);
// under_review | withdrawal_under_review → "under_review";
// passed and its flow's postApprovalEditable === false → "approved" (same rule as post-approval.ts:43-54).

export function reviewFreezeSentence(kind: ReviewFreeze, verb: "changed" | "removed" | "deleted", names: string[]): string;
// "N cost line(s) are under review and cannot be <verb> here. Withdraw the submission first: A, B"
// "N cost line(s) are approved and locked and cannot be <verb> here: A, B. Add a correcting fee line, or ask an administrator to allow edits after approval."
```

Names are `feeNo ?? costName`, never a maskable column (`batch.ts:180-190` explains why).

### 4.3 Freeze on every content writer (Journeys 1–2; Phase 2) → D3, D4, D5, D6, D10

**Governed writer (`cost-lines.ts:293-437`).**

```ts
import { underReviewGate } from "../../modules/governed/gates"; // step 23 Task 1.1's shared gate (X34)

/** The window between submit and decision: content keys only (toggles stay operable, D3). */
const costLineContentUnderReviewGate: MutateGate = async (tx, ctx, rows, patches) => {
  for (const row of rows) {
    const patch = patches.get(String(row.id)) ?? {};
    if (frozenEditKeys(patch).length === 0) continue;
    await assertNotUnderReview(tx, ctx.org.organizationId, "cost_line", String(row.id));
  }
};

update.gates: [costLineContentUnderReviewGate, postApprovalGate, singleFeeLockGate, recPayLockGate, billedFieldsGate, orderUnlockedGate]
delete.gates: [deleteRefusalsGate, underReviewGate("cost_line"), postApprovalGate, orderUnlockedGate, splitsReleaseGate]
```

No local gate is named `underReviewGate`, so nothing shadows the shared import (X34). `splitsReleaseGate` writes (it releases historic splits), so it stays last. `postApprovalGate` on update is unchanged (it already refuses toggles on an approved fee; not this plan's defect).

**`costLines.batch` (`:1684`).** The row load (`:1734-1737`) gains `.orderBy(costLine.createdAt, costLine.id).for("update")` (D10, in the X30 order). In the `delete` branch, after the lock refusals (`:1788`) and before `releaseHistoricSplits` (`:1793`):

```ts
const freezes = await costLineReviewFreezes(tx, organizationId, ids);
// under_review first, then approved; all-or-nothing like every refusal in this branch.
// CONFLICT (the state-refusal code the audit guards use), not the branch's BAD_REQUEST.
```

Other actions are not touched (D3).

**`costLines.exchangeRateBatch` (`:2063`).** The load (`:2078-2094`) gains `.orderBy(costLine.createdAt, costLine.id).for("update")` (X30). After `assertOrdersUnlocked` (`:2104-2108`):

```ts
const freezes = await costLineReviewFreezes(tx, organizationId, rows.map((r) => r.id));
const targets = rows.filter((r) => !isClaimed(r) && !freezes.has(r.id));
// skipped gains a reason (additive field on SkippedLine, batch.ts:172):
//   freezes.get(id) ?? "settled"
```

`SkippedLine` gains `reason: "settled" | "under_review" | "approved"`; `describeSkipped` takes it as a second argument. Its only caller is this handler (grep at HEAD). The audit row's `after.skippedIds` is unchanged; `after.skippedReasons` is added.

**`collectiveOrder.saveChildren` cost leg (`collective-order.ts:4098-4440`).**
- Base: step 20 Phases 1 and 2 are merged (X29). Step 20 owns the lock freezes on this leg (settled, `locked_at`, `rec_pay_locked_at`, the delete pin, the company id) and its `removable` delete set (20 D1-A); it calls no approval check here. This plan owns every review-state freeze on the leg, under review **and** approved-and-locked.
- The `existing` load (`:4146`) gains `.orderBy(costLine.createdAt, costLine.id).for("update")` (D10, X30; grep first in case step 20 already added a lock). Lock order in this handler is order row (step 15 Task 1.3) → cost lines, and no other writer takes them the other way round.
- The inline "did this key change" comparator inside `wouldEditSettled` (`:4237-4265`, which step 20 Task 2.1 extends to its `frozen` predicate) is lifted into a local `changedKeys(c, prev)` with **no behaviour change**, so the settled/lock checks and the new review check share one definition of "an edit". This plan owns the lift; step 20 does not lift it (X29).
- After step 20's lock refusals and its `removable` computation (`removable = existing.filter((r) => loaded.has(r.id) && !keep.has(r.id))`, 20 D1-A), before the delete:

```ts
const freezes = await costLineReviewFreezes(tx, organizationId, existing.map((r) => r.id));
// "removed" is step 20's loaded-and-removed set, never existing − keep (X29): a fee added
// elsewhere after the page loaded is kept and counted in keptUnseen, not refused as removed.
const frozenRemoved = removable.filter((r) => freezes.has(r.id));
const frozenEdited  = input.costs.filter((c) => c.id && freezes.has(c.id) && changedKeys(c, prevOf(c.id)).length > 0);
// refuse under_review first, then approved; CONFLICT with reviewFreezeSentence(kind, "removed" | "changed", names)
```

A re-sent unchanged row is not an edit, so the page's "every row, every save" contract keeps working. Under step 15 D2-B the order-level freeze skips a costs-only save; this check is what that carve-out now leans on.

### 4.4 FX dialog says why (Journeys 1–2; Phase 2) → D5

`apps/web/src/components/expense/cost-line-batch-menu.tsx`:
- The warning toast (`:362-364`) becomes _"N line(s) updated · M not changed"_.
- The skipped list intro (`:381-384`) becomes _"N line(s) updated. The following M were not changed:"_, and each `<li>` appends a muted reason: _"settled"_ (billed, invoiced, written off or locked), _"under review"_, _"approved"_.
- The two sentences occur only in this file (grep of `apps`, `packages`, `e2e` at HEAD); re-grep before merge.

### 4.5 The engine is the only approver (Journey 4; Phase 3) → D7, D8

- Delete `costLinesRouter.review` (`:1452-1520`, docblock included) and `reviewBatch` (`:1522-1615`). Delete the writer's `review` verb (`:357-387`) and, if nothing else uses them, `reviewLockGate` (`:204-210`), `auditTransitionGate` (`:213-225`) and now-unused imports (`canAuditTransition`, `isAuditorDecision`, `applyReviewBatch`, `ReviewBatchRefusal`, `normaliseAuditFrom`, `auditStatusSchema` — each only if its last use goes; `bun run check-types` and lint decide).
- `packages/api/src/architecture.test.ts`: remove `:871`, the last `ALLOWED_INDIRECT_WRITES` entry (15 P2 removed `:876` and 23 P3 removed `:872` first, X33); update the comment at `:1266-1271`, which names `costLines.reviewBatch` as the reason the indirect-write check exists. The check stays: replace the floor at `:1273` (as 23 Task 3.1 left it) with an assertion that `ALLOWED_INDIRECT_WRITES` is empty and that the scanner still runs, so a future helper that receives a money table is still caught (X33).
- `routers/expense/review-batch.ts`: delete it only if `grep -rn "review-batch"` finds no importer and lint flags it (X33); otherwise leave it.
- `modules/expense/permissions.ts:110-114`: `isEndpoint: false` on `[EXPENSE.costLineReview]`, with the comment step 15 §4.3 uses ("No oRPC endpoint gates on this node since step 21 deleted costLines.review/reviewBatch. The audit engine re-checks it at decide time (`modules/audit/decide.ts:50`)"). The label "Review cost lines (submit / approve / reject)" becomes "Review cost lines (approve / reject)", because submit rides `costLineUpdate` (`resources.ts:400`).
- `modules/audit/resources.ts` `cost_line` entry (`:399`): `separationOfDuties: true` (D8-A; the flag is step 08 Task 2.1's).
- Comments that describe the verb as live, updated to past tense: `-cost-lines.columns.tsx:398`, `batch.ts:187`, and `bills.ts:1189`, `collective-order.ts:3471`, `collective-order.guards.test.ts:508` only where the code around them still exists. Under X33 the last three sit inside code 15 P2 (`:3471`, `:508`) and 23 P3 (`:1189`) delete, so expect to skip them; the commit message says which were skipped.

### 4.6 Data model

No schema change. `cost_line.audit_status` stays the engine's cache (`schema/expense.ts:163`), written only by `repaintCache` after Phase 3.

### 4.7 API contracts (input shapes unchanged)

| Procedure | Change | New refusals / output |
|---|---|---|
| `costLines.createBill` | J4 adds `withdraw_pending` (D2); gate on resolved ids and locked in-transaction read are step 22 P1's (D1 handed over, X28); no claim gate | BAD_REQUEST J4 sentence (22 owns the CONFLICT gate sentence with count) |
| `costLines.update` | under-review freeze on content keys | CONFLICT under review |
| `costLines.delete` | under-review and post-approval freeze | CONFLICT |
| `costLines.batch` (`delete`) | row lock; review freeze over selection | CONFLICT with count and names |
| `costLines.exchangeRateBatch` | row lock; reviewed fees skipped | output `skipped[].reason` (additive) |
| `collectiveOrder.saveChildren` (`costs`) | cost-row lock; review freeze on changed or removed fees | CONFLICT with count and names |
| `costLines.review`, `reviewBatch` | **removed** | 404 |
| `auditReview.submit` / `decide*` for `cost_line` | step 08's self-decision rules apply (D8) | CONFLICT at submit when nobody else can decide; FORBIDDEN at decide |

Refusal order a caller sees on a fee write: NOT_FOUND → existing input refusals (billed, locked, settled) → under review → approved-and-locked → order locked.

### 4.8 Key decisions (all Decided 2026-09-21; §9 has the three approaches of each)
- `createBill` gate input → D1 (Chosen: handed to step 22, X28; 22 Task 1.1 delivers the resolved-ids gate)
- J4 floor and locked re-check → D2 (Chosen A, X28: `withdraw_pending` here; the locked read is 22 D2-A's; no claim gate)
- What the under-review freeze covers → D3 (Chosen A: content writers, not toggles)
- Approved fee delete → D4 (Chosen A: refuse under a locked flow)
- FX batch on reviewed fees → D5 (Chosen A: skip and report with a reason)
- Fees page cost leg → D6 (Chosen A, X29: refuse changed or removed frozen fees; this plan owns both the approved and the under-review freeze there)
- Legacy verbs → D7 (Chosen A: delete, node kept with `isEndpoint: false`)
- Self-decision on fees → D8 (Chosen A: turn on, re-check probes)
- Residue → D9 (Chosen A: report only)
- Row locks → D10 (Chosen A, X30: `FOR UPDATE` on the three unlocked loads, ordered by `(created_at, id)`)
- Fees page UI → D11 (Chosen A: server refusal only)

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- Step 15 Phase 3 merged (Task 3.3 adds `expense_entry` to `costLines.create`, same file). Step 22 Phase 1 merged before Phase 1 (X28). Phase 2 also needs step 15 Phase 1 merged (its `.for("update")` on the `saveChildren` order load and its conditional freeze sit above the cost leg this plan edits), step 20 Phases 1 and 2 merged (X29) and step 23 Phase 1 merged (the shared `underReviewGate`, X34). Phase 3 needs step 08 Phase 2 (the `separationOfDuties` field), step 08 Task 3.3 (the `isEndpoint` precedent) and step 23 Phase 3 merged (X33).
- D1–D11 decided 2026-09-21 (§9). Tasks are written for the Chosen option of each, with the X28–X34 overrides applied.
- Re-locate every anchor in `cost-lines.ts`, `batch.ts`, `collective-order.ts`, `resources.ts`, `permissions.ts`, `architecture.test.ts` **by symbol** at the base commit.

### Phase 1 — Billing respects the review on every path (Findings A, B)

**Delivers:** Journey 3 end to end.
**Dependencies:** step 15 Phase 3 merged (`cost-lines.ts`). **Step 22 Phase 1 merged first (X28):** at the base commit, grep `createBill` for `assertGatesCleared(tx, …, costLineIds, "create_bill")` and for the in-transaction `.for("update")` read of the lines; if either is missing, stop. D1 (handed to 22) and D2 decided. Probe 21-P1 read before merge (sizes who is exposed; does not block code).

- **1.1** `createBill`: add `withdraw_pending` to the J4 set on 22's locked read, and rewrite the J4 comment to name the three states and say the check runs on locked rows inside the transaction (§4.1). No gate-ids change (22 Task 1.1 made it) and no claim gate (X28). Files: `packages/api/src/routers/expense/cost-lines.ts`. · **Agent A (backend)**
- **1.2** Tests in `packages/api/src/routers/expense.review.test.ts`, `describe("createBill is the gate that finally reads auditStatus (J4)")` (`:500`). Cases 1, 2 and 4 of the earlier draft (gate on the filter path, gate with ticks, unticked filter path) are dropped: step 22's `expense.create-bill.test.ts` [NEW] carries them (X28). What stays:
  3. A line cached `withdraw_pending` → BAD_REQUEST J4 sentence.
  Seed cache states by raw `update(costLine).set({ auditStatus })`, not through `costLines.review`, so Phase 3 does not have to rewrite this case.
  **Real Postgres:** `routers/expense.concurrency.test.ts` gains one named `it` (X35): connection A opens a transaction and runs `submitForReview` on line L up to (not including) commit; connection B starts `createBill([L])` without awaiting; A commits; B → the J4 refusal from 22's locked read and no bill. It proves step 22's lock and must pass **without** any claim gate. Paste in the PR a failing run on a checkout without 22 Phase 1's in-transaction lock and the passing run at the base. `DATABASE_URL_TEST` points at the dev branch, never production. Files: `packages/api/src/routers/expense.review.test.ts`, `packages/api/src/routers/expense.concurrency.test.ts`. · **Agent A (backend)**

**Acceptance.**
- §10 Journey 3 in the browser.
- `expense.review.test.ts`, `expense.filter-scope.test.ts`, `expense.bills.test.ts` pass, read for `failed`. The concurrency case passes on the dev branch (its name is in the output, so it was not skipped) and was seen failing without step 22's in-transaction lock.

### Phase 2 — A fee under review, or approved, changes only by the review (Findings C, D)

**Delivers:** Journeys 1 and 2 end to end.
**Dependencies:** Phase 1 merged (hands off `cost-lines.ts`); step 15 Phase 1 merged (`collective-order.ts` `saveChildren`); step 20 Phases 1 and 2 merged, in the order 20 P1 → 20 P2 → 21 P2 (X29: `removable`, `loadedCostIds`, the lock freezes, and no approval call on the leg); step 23 Phase 1 merged (the shared `underReviewGate`, X34). D3, D4, D5, D6, D10, D11 decided. Re-check before Task 2.3: probes 21-P5, 21-P6, 21-P7 (they size how often ops change reviewed fees today); if they show this is routine work, stop and re-plan D4/D6.

- **2.1** `modules/expense/review-freeze.ts` [NEW] (§4.2) with unit cases: none frozen; `under_review`; `withdrawal_under_review`; `passed` + locked flow → `approved`; `passed` + editable flow → not frozen; `rejected`, `withdrawn` → not frozen; empty ids → no query. Files: `packages/api/src/modules/expense/review-freeze.ts` [NEW], `packages/api/src/modules/expense/review-freeze.test.ts` [NEW]. · **Agent B (backend)**
- **2.2** Writer and ledger batch verbs (§4.3): local `costLineContentUnderReviewGate` on `update`; the shared `underReviewGate("cost_line")` imported from `modules/governed/gates.ts` (step 23 Task 1.1, X34) + `postApprovalGate` on `delete`; row lock (`created_at, id`, X30) and freeze in `batch` delete; row lock (same order), skip and `reason` in `exchangeRateBatch`; `SkippedLine.reason` and `describeSkipped` in `batch.ts`. Files: `packages/api/src/routers/expense/cost-lines.ts`, `packages/api/src/routers/expense/batch.ts`. · **Agent B (backend)**
- **2.3** `saveChildren` cost leg (§4.3), on top of step 20 P2 (X29): cost-row lock ordered by `(created_at, id)` (X30); `changedKeys` lift, owned here (no behaviour change; the existing settled and step 20 lock tests prove it); review freeze, under review and approved-and-locked, on changed fees and on removed fees, where "removed" is step 20's `removable` (loaded-and-removed, 20 D1-A), never `existing − keep`. Grep the handler for step 15's and step 20's guards first so nothing is added twice, and confirm no `assertPostApprovalEditableMany(…, "cost_line", …)` call remains on the leg. Files: `packages/api/src/routers/collective-order.ts`. · **Agent B (backend)**
- **2.4** Tests. New suite `packages/api/src/routers/expense.review-freeze.test.ts` [NEW] (one file, so `expense.review.test.ts` keeps one writer per phase). Submissions seeded by raw insert the way `audit-review.test.ts:1078-1110` does. Cases:
  1. `under_review` → `update({ amount })` CONFLICT; `update({ reconciled: true })` succeeds; `delete` CONFLICT; `batch delete` over [frozen, free] CONFLICT naming 1, both rows still present; `exchangeRateBatch` over [frozen, free] → `affected: 1`, `skipped[0].reason === "under_review"`, frozen row's rate unchanged; `batch lock` succeeds.
  2. `passed`, flow `postApprovalEditable: false` → `delete`, `batch delete` CONFLICT; FX skip with `"approved"`.
  3. `passed`, flow editable → all succeed.
  4. `rejected`, `withdrawn`, never submitted → all succeed.
  5. `saveChildren` on an order with fees F1 (`under_review`), F2 (`passed`, locked), F3 (free): re-send all three unchanged plus a new row → saved, new row inserted; change F1's amount → CONFLICT, nothing written (re-read F1, F3, the new row absent, and `audit_log`); omit F2 with F2 in `loadedCostIds` → CONFLICT "removed"; omit F2 with F2 not in `loadedCostIds` (added after the page loaded) → saved, F2 kept, `keptUnseen` 1 (X29); change F3 only → saved.
  6. Foreign-scope id → `delete` NOT_FOUND before CONFLICT.
  7. Deleting a fee under review is refused, so no orphan is created (count open submissions before and after).
  Re-run `expense.batch.test.ts` (the `isClaimed` agreement cases), `collective-order.costs.test.ts`, `expense.review.test.ts`, `expense.ledger.test.ts`, `audit-review.test.ts`.
  **Real Postgres:** `expense.concurrency.test.ts` gains one interleave for `saveChildren`: A runs `submitForReview` on F without committing; B starts `saveChildren` changing F's amount; A commits; B → CONFLICT, F unchanged. Seen failing without the cost-row lock first. Files: `packages/api/src/routers/expense.review-freeze.test.ts` [NEW], `packages/api/src/routers/expense.concurrency.test.ts`. · **Agent B (backend)**
- **2.5** FX dialog copy and reason label (§4.4). Files: `apps/web/src/components/expense/cost-line-batch-menu.tsx`. · **Agent C (frontend)**

**Acceptance.**
- §10 Journeys 1 and 2 in the browser, as `managerA` and `accountant`.
- The suites above pass, judged by reading the output for `failed`. The `saveChildren` interleave passes on the dev branch and was seen failing without the lock.
- `bun run check-types` (read the output; it can exit 0 while printing "failed") covers `apps/web` for the `SkippedLine.reason` field.

### Phase 3 — Only the queue approves a fee, and not by its submitter (Findings E, F)

**Delivers:** Journey 4 end to end.
**Dependencies:** Phase 2 merged (hands off `cost-lines.ts`). Step 08 Phase 2 merged (`separationOfDuties`) and step 08 Task 3.3 (the `isEndpoint` pattern). Step 23 Phase 3 merged first (X33: it removes `architecture.test.ts:872` and lowers the floor). D7, D8, D9 decided. Re-check before Task 3.1: probe 21-P3 (legacy verb use). Re-check before Task 3.2: probes 21-P8 and 21-P9 (who submits fees, how many accountants each org has). A contradiction stops the task for a re-plan.

- **3.1** Delete the verbs, the writer verb, their gates and imports; remove the last `ALLOWED_INDIRECT_WRITES` entry (`:871`) and replace the floor at `:1273` with an assertion that the list is empty and that the scanner still runs (X33); delete `routers/expense/review-batch.ts` only if `grep -rn "review-batch"` finds no importer and lint flags it; `isEndpoint: false` and label on `EXPENSE.costLineReview`; past-tense comments (§4.5), skipping `collective-order.ts:3471`, `collective-order.guards.test.ts:508` and `bills.ts:1189` wherever the code around them is already gone (15 P2 / 23 P3), and saying which in the commit message. Grep `packages`, `apps`, `e2e`, `seed` for `costLinesRouter.review`, `costLines/review`, `costLines.reviewBatch` and confirm only tests and comments remain. Files: `packages/api/src/routers/expense/cost-lines.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/modules/expense/permissions.ts`, `packages/api/src/routers/expense/review-batch.ts` (delete, conditional), `packages/api/src/routers/expense/batch.ts` (comment), `packages/api/src/routers/expense/bills.ts` (comment, if still present), `packages/api/src/routers/collective-order.ts` (comment, if still present), `apps/web/src/routes/_next/expenses/-cost-lines.columns.tsx` (comment). · **Agent D (backend)**
- **3.2** `separationOfDuties: true` on `REVIEWABLE_RESOURCES.cost_line`. Files: `packages/api/src/modules/audit/resources.ts`. · **Agent D (backend)**
- **3.3** Tests:
  - `expense.review.test.ts` `describe("costLines.review is the only writer of auditStatus")` (`:123-208`): replace with `describe("the engine is the only writer of cost_line.audit_status")`: create/update cannot set it (keep `:129`), submit → decide stamps `submittedBy` / `auditedBy` through `repaintCache`, withdrawal through `retractByResource`, and a POST to the deleted verb is not routable (assert `costLinesRouter` has no `review` key).
  - `expense.wave1.test.ts:484-612` (the status-pin race cases): delete; the race they guarded is gone with the verb, and `decide` locks the submission (`modules/audit/shared.ts:33`).
  - `expense.rbac.test.ts:537-560`: re-point to `auditReview.submit` for `cost_line` (sales refused by `submitNode`; ops scoped).
  - `audit-review.test.ts`: re-seat cost-line self-decisions (`:746`, `:1159-1162`) onto a second accountant member; add `describe("cost lines: separation of duties")` — accountant submits, decides → FORBIDDEN, no `audit_decision` row; second accountant decides → `passed`; submitter's `pendingSummary` excludes it; single-accountant org → submit CONFLICT with step 08's sentence.
  - D7 pin: `registry.sync.test.ts` passes; a member without `expense.costLine.review` on the stage gets FORBIDDEN `Missing permission: expense.costLine.review` from decide.
  - Run `permissions/registry.sync.test.ts`, `permissions/reachability.test.ts`, `modules/audit/seed.test.ts`, both architecture tests.
  Files: `packages/api/src/routers/expense.review.test.ts`, `packages/api/src/routers/expense.wave1.test.ts`, `packages/api/src/routers/expense.rbac.test.ts`, `packages/api/src/routers/audit-review.test.ts`. · **Agent D (backend)**
- **3.4** Residue report (D9-A): `packages/db/scripts/audit-cost-review-drift-2026-09.sql` [NEW] with probes 21-P2, 21-P3, 21-P4, 21-P10 as counts plus row lists. Run read-only on the dev branch; paste counts in the PR. Files: `packages/db/scripts/audit-cost-review-drift-2026-09.sql` [NEW]. · **Agent D (backend)**
- **3.5** E2E: run `e2e/specs/audit.review-queue.spec.ts`, `audit.withdraw.spec.ts`, `audit.post-approval.spec.ts`, `audit.reject-resubmit.spec.ts`, `audit.condition-threshold.spec.ts`, `cost-lines.control-row.spec.ts`, `showcase.params-govern-approval.spec.ts` against a freshly seeded org. Fix a spec that self-decides a fee by deciding as another actor, never by switching the flag off. Files: failing specs under `e2e/specs/` only. · **Agent E (test)**

**Acceptance.**
- `/rpc/costLines/review` → 404.
- §10 Journey 4 in the browser (accountant cannot approve their own fee; another reviewer can).
- The suites and specs above pass; dev drift counts are in the PR.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.2 | `packages/api/src/routers/expense/cost-lines.ts`, `packages/api/src/routers/expense.review.test.ts`, `packages/api/src/routers/expense.concurrency.test.ts` | `packages/api/src/modules/audit/gates.ts`, `packages/api/src/routers/expense/shared.ts`, `packages/api/src/modules/governed/writer.ts`, `packages/api/src/routers/audit-review.test.ts` |

opus / high: a money-minting handler (on step 22's restructured body) and a real-Postgres interleave that must prove 22's lock.
Run mode: single agent.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent B (backend) | backend-engineer | opus | high | 2.1–2.4 | `packages/api/src/modules/expense/review-freeze.ts` [NEW], `…/review-freeze.test.ts` [NEW], `packages/api/src/routers/expense/cost-lines.ts`, `packages/api/src/routers/expense/batch.ts`, `packages/api/src/routers/collective-order.ts`, `packages/api/src/routers/expense.review-freeze.test.ts` [NEW], `packages/api/src/routers/expense.concurrency.test.ts` | `packages/api/src/modules/audit/shared.ts`, `packages/api/src/modules/audit/post-approval.ts`, `apps/web/src/routes/_next/order.$orderId.expenses.tsx` |
| Agent C (frontend) | frontend-engineer | sonnet | medium | 2.5 | `apps/web/src/components/expense/cost-line-batch-menu.tsx` | `packages/api/src/routers/expense/batch.ts` |

opus for B: guards on five money writers, one of them in a 4,800-line router four other plans edit, plus row locks.
Run mode: **B (Task 2.2's `SkippedLine.reason`) → C**, then B ∥ C. Contract: `exchangeRateBatch` output `skipped[].reason: "settled" | "under_review" | "approved"`; C starts once `bun run check-types` sees it.

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent D (backend) | backend-engineer | opus | high | 3.1–3.4 | `packages/api/src/routers/expense/cost-lines.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/modules/expense/permissions.ts`, `packages/api/src/modules/audit/resources.ts`, `packages/api/src/routers/expense/review-batch.ts` (conditional delete, X33), `packages/api/src/routers/expense/{batch,bills}.ts` (comments), `packages/api/src/routers/collective-order.ts` (comment), `apps/web/src/routes/_next/expenses/-cost-lines.columns.tsx` (comment), the four test files in 3.3, `packages/db/scripts/audit-cost-review-drift-2026-09.sql` [NEW] | `packages/api/src/permissions/registry.ts`, `packages/api/src/modules/audit/decide.ts`, `packages/api/src/modules/audit/queue-filter.ts` |
| Agent E (test) | test-engineer | sonnet | medium | 3.5 | failing specs under `e2e/specs/` only | `e2e/fixtures/seed-cli.ts`, `seed/run-money.ts` |

opus for D: deletes live procedures under a stale-entry allow-list and a registry sync guard, and switches self-decision on for a shared engine resource.
Run mode: **D → E**.

**Schedule:** Phase 1 → Phase 2 → Phase 3, sequential (shared `cost-lines.ts`, `expense.concurrency.test.ts`).
**Serialisation points:** after each phase, `bun run check-types` and grep the output for `error TS` and `failed`; both architecture tests; restart `:3000` before any browser check (`bun --hot` does not reload `packages/api`).
**Commits:** the worktree may be shared. One committer at a time; confirm the index is empty before `git add`, and read every hunk.

**Smell test.**
- [x] Every task has exactly one owner.
- [x] No file is owned twice within a phase.
- [x] The B → C contract is named (`skipped[].reason`).
- [x] Every opus is justified; no haiku.
- [x] Each phase completes a journey (3; 1 and 2; 4).

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`, 2026-09-21)

- **`costLines.createBill`.** Web `cost-lines.tsx:1126` (dialog, ticks or `filterScope`). Tests `expense.review.test.ts:500-542`, `expense.bills.test.ts`, `expense.filter-scope.test.ts`. Output shape unchanged.
- **`costLineWriter` verbs.** `create` `:1310`, `update` `:1335`, `unbill` `:1421`, `review` `:1484` (deleted in Phase 3), `delete` `:1627`, `claim` `:2660`. Only `update` and `delete` gain gates (the claim gate is dropped, X28).
- **`costLines.update`.** Web edit sheet `cost-lines.tsx:395` (content keys only; toggles come through `batch`). Seeders: `seed/run-money.ts` books fees before submitting (step 14 §7 names `:187` as its cost-line submit), so no seeded edit lands on a submitted fee; re-read at the base commit.
- **`costLines.delete`.** Web `cost-lines.tsx:1906`; its `onError` surfaces the server message (re-read the handler at the base commit).
- **`costLines.batch`.** Web `cost-line-batch-menu.tsx:131, 463`. Only the `delete` branch changes.
- **`costLines.exchangeRateBatch`.** Web `cost-line-batch-menu.tsx:351` only. `SkippedLine` / `describeSkipped` have no other caller.
- **`collectiveOrder.saveChildren`.** Web `order-form.tsx:1733` (sends `costs: costPayload` with the other child arrays, `:1746`, so an order-form save that changes a reviewed fee gets the same refusal, which is correct; one that leaves fees alone passes) and `order.$orderId.expenses.tsx:598` (costs only). Tests `collective-order.costs.test.ts`.
- **`costLines.review` / `reviewBatch`.** No web or e2e caller. Tests and comments listed in Phase 0 Finding E. **External RPC scripts would 404; none found in the repo.**
- **`EXPENSE.costLineReview` node.** `permissions.ts:30, 110-114`, `resources.ts:401`, `roles.ts:205` (director leaf), and inherited by the `expense` / `expense.costLine` roots. The node stays.
- **`REVIEWABLE_RESOURCES.cost_line`.** Callers: `submit.ts`, `decide.ts`, `withdraw.ts`, `queue-filter.ts`, `audit-review.ts`. Only the flag changes.

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| Untick → Create Bill (全选), `create_bill` ticked | bills unapproved lines | 409 (step 22 P1, X28) | API-only |
| Bill a `withdraw_pending` line | 200 | 400 (J4) | API-only |
| Submit → edit fee on fees page | 200 | 409 naming the fee | API-only; the page toasts `error.message` (`:609`) |
| Submit → edit sheet / delete | 200 | 409 | API-only |
| Approve → change / delete on fees page | 200 | 409 | API-only |
| Approve → Modify exchange rate | rate changed | skipped, reason "approved" | API first: web shows old copy and no reason (harmless); web first: `reason` undefined, label hidden (harmless) |
| Approve → Mark reconciled / Lock | 200 | 200 | – |
| Legacy RPC self-approval | 200 | 404 | API-only |
| Accountant decides own fee | 200 | 403 | API-only |

### 7.3 Behaviour change for existing orgs and live fees

- **Phase 1** changes only orgs that ticked `create_bill` (21-P1) and lines in `withdraw_pending` (21-P2).
- **Phase 2 changes every org at once**, because it does not depend on gates:
  - Fees under review now (21-P2) become read-only for content until decided or withdrawn. Ops mid-edit on the fees page hit 409.
  - Approved fees under a locked flow (the seeded default) can no longer be edited, re-rated or deleted before billing. 21-P5, 21-P6 and 21-P7 show how often that happens today. The escape is a correcting fee line, or an admin turning on **edits after approval** for the Cost review flow in `/parameters`. Step 08 D3-A (settled) also refuses re-submitting an approved, locked record, so there is no re-review path for the same line.
- **Phase 3** removes the legacy verbs (21-P3 sizes use) and self-decision (21-P8, 21-P9). An org with one accountant who also books fees gets a submit refusal for those fees (step 08 D2-A).
- **E2E orgs** created before the change keep their flows; nothing here is seeded.

### 7.4 Nullable assumptions

- `cost_line.audit_status` is nullable with no default (`schema/expense.ts:163-166`); `null` means never submitted and passes every new check.
- `cost_line.order_id` is nullable (`:57`, `restrict`); a standalone fee is not reached by `saveChildren` and is covered by the ledger verbs.
- `feeNo` may be null; the refusal names fall back to `costName`.
- `audit_submission.resource_id` has no FK; orphans are possible and reported (21-P4).

### 7.5 Deployment coupling

- Each phase deploys on its own. Phase 2: API before web (the dialog reads `skipped[].reason`; either order is harmless, §7.2). Phases 1 and 3 are API-only apart from comments.
- Build `apps/web` before deploy so a partial deploy does not split server and web (memory `alchemy-partial-deploy-splits-the-stage`); no phase breaks under that split.

### 7.6 Merge order against steps 04–27

| Plan / task | Shared code | Why step 21 goes after (or how it coexists) |
|---|---|---|
| **08 Tasks 2.1–2.7** | `resources.ts` `separationOfDuties` (written `false` for `cost_line`), `decide.ts`, `submit.ts`, `shared.ts` `eligibleReviewerCount`, `queue-filter.ts`, `audit-review.ts` | Task 3.2 flips a field that exists only after 2.1. **Must merge first.** |
| **08 Tasks 3.1–3.3** | `post-approval.ts` optional message; `submit.ts` re-submit refusal (D3-A); `architecture.test.ts`; `isEndpoint` on quotation nodes (X10) | The Journey 2 remedy sentence assumes D3-A. Task 3.1 copies X10. **Must merge first.** |
| 10 Task 2.2 | `cost-lines.ts` `importFromQuote` | Different function. 10 before 21. |
| 11 Task 3.1 | `cost-lines.ts` `importFromQuote` (caller types) | Different function. 11 P3 before 21. |
| 11 Task 2.4, 12 Tasks 1.1–1.2 | `collective-order.ts` `assignNumber` re-stamps `cost_line.order_no` | Different handler; `order_no` not frozen here (Phase 0 adjacent 6). |
| **15 Phase 1** (Tasks 1.2, 1.3) | `collective-order.ts` `saveChildren` (order-row `FOR UPDATE`, conditional freeze on containers/cargo/appendages), `gates.ts`, `post-approval.ts` | Task 2.3 edits the cost leg below 15's guard and relies on its order lock for lock order. This plan adds no helper to `gates.ts` / `post-approval.ts` (its helper is in `modules/expense/`). **15 P1 before 21 P2.** |
| **15 Phase 3 Task 3.3** | `cost-lines.ts` `costLines.create` (`expense_entry` gate) | Different function; must be kept. **15 P3 before 21 P1.** |
| 15 Task 2.1 | `architecture.test.ts` (removes `:494`, `:876`) | Neighbouring lines to `:871`; the second to merge rebases. |
| 15 Tasks 2.3, 3.5; 14 Task 1.2; 08 | `audit-review.test.ts` | 21 P3 edits the cost-line cases only; after 15 P3. |
| 14, 12 | `collective-order.ts` other handlers | No overlap with the cost leg. |
| **16–19** (plans written in parallel) | `lading.ts`; none of this plan's files expected | None, unless a 16–19 plan edits `collective-order.ts` `saveChildren`; the runbook crosscheck confirms. |
| **20** (plan written in parallel) | `order.$orderId.expenses.tsx`; `saveChildren` cost leg (unnamed rows, single-fee lock, adjacent 3, `removable`/`loadedCostIds`) | Same block as Task 2.3. **Settled by X29:** 20 P1 → 20 P2 → 21 P2. Step 20 owns the lock freezes and the `removable` delete set, and drops its approval call; step 21 owns every review-state freeze (under review and approved) and the `changedKeys` lift, and computes "removed" from 20's `removable`. |
| **22** (parallel) | `cost-lines.ts` `createBill`, Create Bill dialog in `cost-lines.tsx` | **Settled by X28, reversing this plan's earlier order:** 22 P1 before 21 P1. 22 owns the `createBill` body (resolved-ids gate on `tx`, locked in-transaction read, every guard on locked rows); 21 Task 1.1 only adds `withdraw_pending` to the J4 set, and there is no claim gate. 22's `expense.create-bill.test.ts` carries the gate cases. |
| **23** (parallel) | `bills.ts` legacy `review` / `reviewBatch`; `permissions.ts` `EXPENSE.billReview` `isEndpoint`; `modules/governed/gates.ts` `underReviewGate` | Same D7 pattern in neighbouring blocks of `permissions.ts`; the second to merge rebases, and both run `registry.sync.test.ts`. **23 P1 before 21 P2** (Task 2.2 imports the shared `underReviewGate`, X34). **23 P3 before 21 P3** (X33: 23 removes `:872` and lowers the floor; 21 removes the last entry and asserts the list is empty). |
| 24–27 (parallel) | invoices, payments, write-offs, month close | None expected; `cost_line` writes in `invoices.ts` / `bills.ts` are billed-line paths, outside this freeze (billed lines are no longer reviewable content). |

**Required order:** 08 (Phases 2–3) → 10 → 11 P3 → 15 P1 → 15 P3 → 22 P1 (X28) → **21 P1** → 20 P1 → 20 P2 (X29) and 23 P1 (X34) → **21 P2** → 23 P3 (X33) → **21 P3**, one phase per worktree, sequentially.

### 7.7 Read-only production probes (SELECT only; Wilfred runs with the owner's override; none blocks Phase 1 code)

```sql
-- 21-P1 Cost review flow per org: enabled, post-approval lock, ticked gates, reviewers (D1, D4, D8)
select f.organization_id, f.id as flow_id, f.enabled, f.post_approval_editable, f.withdrawal_mode,
       (select string_agg(g.gate_key, ',' order by g.gate_key) from audit_flow_gate g where g.flow_id = f.id) as gates,
       (select string_agg(distinct coalesce(r.name, 'member:' || fr.member_id), ',')
          from audit_flow_stage s join audit_flow_reviewer fr on fr.stage_id = s.id
          left join role r on r.id = fr.role_id where s.flow_id = f.id) as reviewers
from audit_flow f where f.trigger_type = 'cost_line'
order by f.organization_id;

-- 21-P2 Live fees by latest submission vs cached audit_status (Phase 2 freeze size; drift; withdraw_pending)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'cost_line'
  order by resource_id, submitted_at desc, created_at desc)
select cl.organization_id, coalesce(l.status, 'never_submitted') as latest,
       coalesce(cl.audit_status, 'null') as cached, (cl.bill_id is not null) as billed, count(*)
from cost_line cl left join latest l on l.resource_id = cl.id
group by 1, 2, 3, 4 order by 1, 2, 3, 4;

-- 21-P3 Legacy verb use, and self-approval through it (D7, D9)
select organization_id, action, count(*) as calls, min(created_at), max(created_at)
from audit_log where action in ('expense.costLine.review', 'expense.costLine.reviewBatch')
group by 1, 2;
select a.organization_id, a.target_id, a.actor_user_id, a.created_at
from audit_log a
where a.action = 'expense.costLine.review' and a.after_json like '%"auditStatus":"approved"%'
  and exists (select 1 from audit_log b where b.action = 'expense.costLine.review'
              and b.target_id = a.target_id and b.actor_user_id = a.actor_user_id
              and b.after_json like '%"auditStatus":"pending"%' and b.created_at < a.created_at);
-- reviewBatch rows carry a comma-joined target_id and an ids array in after_json; count them separately.

-- 21-P4 Orphan submissions for deleted fees, by status (a passed orphan = an approved fee later deleted)
select s.organization_id, s.status, count(*)
from audit_submission s left join cost_line cl on cl.id = s.resource_id
where s.resource_type = 'cost_line' and cl.id is null
group by 1, 2 order by 1, 2;

-- 21-P5 Exchange-rate batch edits that landed on an approved fee (Finding C exercised)
select s.organization_id, count(*) as edits, count(distinct s.resource_id) as fees
from audit_submission s
join audit_log a on a.action = 'expense.costLine.exchangeRateBatch'
 and a.target_id like '%' || s.resource_id || '%' and a.created_at > s.resolved_at
where s.resource_type = 'cost_line' and s.status = 'passed'
group by 1;

-- 21-P6 Single-row edits and deletes after approval, and batch deletes (D4 sizing)
select s.organization_id, a.action, count(*) as events, count(distinct s.resource_id) as fees
from audit_submission s
join audit_log a on a.created_at > s.resolved_at
 and ((a.action in ('expense.costLine.update', 'expense.costLine.delete') and a.target_id = s.resource_id)
   or (a.action = 'expense.costLine.batch.delete' and a.target_id like '%' || s.resource_id || '%'))
where s.resource_type = 'cost_line' and s.status = 'passed'
group by 1, 2 order by 1, 2;
-- A later attempt resets the question; filter out rows where a newer submission exists before a.created_at if counts are high.

-- 21-P7 Fees-page saves on orders holding a fee that was under review or approved at the time (D6 sizing)
select s.organization_id, s.status, count(distinct a.id) as saves, count(distinct cl.order_id) as orders
from audit_submission s
join cost_line cl on cl.id = s.resource_id and cl.order_id is not null
join audit_log a on a.action = 'collectiveOrder.saveChildren' and a.target_id = cl.order_id
 and a.created_at > s.submitted_at
 and (s.status = 'passed' or a.created_at < coalesce(s.resolved_at, now()))
where s.resource_type = 'cost_line' and s.status in ('under_review', 'withdrawal_under_review', 'passed')
group by 1, 2 order by 1, 2;
-- The audit row does not say which fee changed; compare before_json/after_json of a sample.

-- 21-P8 Engine self-decisions on fees (D8)
select s.organization_id, count(*) as self_decisions
from audit_submission s
join audit_stage_instance i on i.submission_id = s.id
join audit_decision d on d.stage_instance_id = i.id
where s.resource_type = 'cost_line' and d.reviewer_id = s.submitted_by
group by 1;

-- 21-P9 Who submits fees, by role, and how many accounting members each org has (D8: single-accountant orgs)
select s.organization_id, m.role, count(*) as submissions
from audit_submission s join member m on m.id = s.submitted_by
where s.resource_type = 'cost_line'
group by 1, 2 order by 1, 2;
select organization_id, count(*) as accountants from member where role = 'accounting' group by 1 order by 1;

-- 21-P10 Billed fees whose latest review is open or failed (J4 bypass residue)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'cost_line'
  order by resource_id, submitted_at desc, created_at desc)
select cl.organization_id, l.status, count(*)
from cost_line cl join latest l on l.resource_id = cl.id
where cl.bill_id is not null and l.status in ('under_review', 'withdrawal_under_review', 'rejected')
group by 1, 2 order by 1, 2;

-- 21-P11 Bills in orgs with create_bill ticked that carry lines never approved (Finding A exercised)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'cost_line'
  order by resource_id, submitted_at desc, created_at desc)
select cl.organization_id, count(distinct cl.bill_id) as bills, count(*) as lines
from cost_line cl
join audit_flow f on f.organization_id = cl.organization_id and f.trigger_type = 'cost_line' and f.enabled
join audit_flow_gate g on g.flow_id = f.id and g.gate_key = 'create_bill'
left join latest l on l.resource_id = cl.id
where cl.bill_id is not null and coalesce(l.status, 'none') <> 'passed'
group by 1;
-- Includes lines billed before the key was ticked; compare bill created_at with the gate row's creation if needed.
```

**What each probe decides.** 21-P1 → D1 urgency, D4, D8. 21-P2 → Phase 2 blast radius, D2. 21-P3, 21-P4, 21-P10 → D7, D9. 21-P5, 21-P6, 21-P7 → D4, D5, D6. 21-P8, 21-P9 → D8. 21-P11 → D1 and D9.

### 7.8 Blocking prerequisites

- Steps 08 (Phases 2–3), 10, 11 P3, 15 P1, 15 P3, 22 P1 (X28), 20 P1–P2 (X29), 23 P1 (X34) and 23 P3 (X33) merged — blocks the phases named in §7.6.
- D1–D11 decided 2026-09-21 (§9); D1 is delivered by step 22 Task 1.1.
- The order between step 20 and 21 P2 for the `saveChildren` cost leg — settled in the steps 16–27 crosscheck before Task 2.3.
- `DATABASE_URL_TEST` for a dev Neon branch — blocks the Phase 1 and Phase 2 concurrency acceptance.
- Probe re-checks (a contradiction stops the task for a re-plan): 21-P5/P6/P7 before Task 2.3; 21-P3 before Task 3.1; 21-P8/P9 before Task 3.2.

## 8. Cross-Cutting Concerns

- **Errors.** State refusals are `ORPCError("CONFLICT")` with sentences that say what to do (withdraw first; add a correcting fee or ask an administrator). The J4 floor keeps its existing BAD_REQUEST. Self-decision is FORBIDDEN (step 08). Every guard sits after the scoped load, so a foreign id answers NOT_FOUND first (`gates.ts:59-62`). The fees page, edit sheet, delete and batch menus already toast `error.message`.
- **Testing.** PGlite router suites at the API boundary (1.2, 2.1, 2.4, 3.3); registry sync; both architecture tests; e2e audit and cost-line specs (3.5); browser proof in §10. Row locks (this plan's, and step 22's `createBill` lock that Task 1.2's interleave exercises) are proven only in `expense.concurrency.test.ts` on real Postgres, never by PGlite (one connection; every transaction serialises, so a lock test there also passes on the old code).
- **Migration.** None.
- **Rollback.** Every phase is a plain revert; no phase writes data or seeds anything. Phase 3's revert restores the verbs and the `isEndpoint` line together.
- **Audit trail.** Refusals write nothing. `exchangeRateBatch`'s row gains `skippedReasons`. After Phase 3 the engine's `audit.submit` / `audit.decide` rows are the only record of fee reviews.

**Performance & Scalability**
1. **Pagination.** Unchanged.
2. **SQL-side filtering.** `costLineReviewFreezes` is one `IN` query on `audit_submission` plus one on `audit_flow` for the distinct flow ids, compared in memory over ≤ `MAX_BATCH_IDS` rows (or an order's fees).
3. **N+1.** The writer gates run per row, but the writer handles one row per call. `createBill`'s claim gets no gate (X28). Batch paths use the one-query helper.
4. **Index coverage.** The latest-submission read uses the same `(organization_id, resource_type, resource_id)` path every existing freeze uses; not re-verified by name in this pass.
5. **Write atomicity.** Every new guard runs inside its handler's transaction; after step 22 P1 the `create_bill` gate and J4 also run inside `createBill`'s transaction on locked rows (X28).
6. **Row locking.** `FOR UPDATE` added on three loads, ordered by `(created_at, id)` (X30, the one ledger lock order); lock order order → cost lines in `saveChildren`. Submit serialises through `repaintCache`'s row write (Phase 0 Finding D).
7. **Connections/resources.** None new.
8. **Tenant isolation.** Every added read filters `organization_id`.
9. **Payload size.** `skipped[]` gains one short string per row.
10. **Hot path.** `saveChildren` (every fees-page save) gains one indexed read and a row lock on the order's fees.

## 9. Decision Register, Open Questions & Risks

**Statuses.** On 2026-09-21 Wilfred accepted the recommended option of every decision below, and every Proposed reading in `steps-20-26-crosscheck.md` X28–X40; where an X-item overrides this plan's own recommendation, the Chosen line says so. Each keeps its three approaches.

**D1: What does `createBill`'s opt-in `create_bill` gate check?** · Status: **Decided 2026-09-21 — Chosen: handed to step 22 (per X28)**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen — delivered by step 22 Task 1.1, X28)** | Pass the resolved `costLineIds` (ticks or filter result) | One-word fix; matches the export router (`export.ts:231`); the gate means the same on both paths. |
| B | Refuse the 全选 path outright when `create_bill` is ticked | Forces ticking in gated orgs; large month-end selections (up to 2000) become impossible there. |
| C | Leave it | The tenant's rule stays skipped on the path the UI promotes. |

- **Releases:** Task 1.1. **Probe:** 21-P1, 21-P11.
- **Chosen: handed to step 22** (Wilfred, 2026-09-21); crosscheck X28: no row of this table is built here as written; row A's content (the resolved ids) is delivered by step 22 Task 1.1 (22 D1-B), on `tx` inside its locked transaction, and this plan's Task 1.1 makes no gate-ids change.

**D2: What does the always-on J4 floor refuse, and where is it checked?** · Status: **Decided 2026-09-21 — Chosen: A (per X28)**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen)** | Keep reading the cache; add `withdraw_pending`; re-check the same set on the locked row in a `claim` gate | Closes the open-withdrawal hole and the submit race with no extra query; relies on the cache being engine-written, which Phase 3 guarantees. |
| B | Read the engine's latest submission instead of the cache (refuse `under_review`, `withdrawal_under_review`, `rejected`) | Immune to cache drift today, but legacy-drifted `pending`/`rejected` caches with no submission become billable (21-P2 sizes it), and one more query per bill. |
| C | Leave it | A fee whose withdrawal awaits a reviewer bills; the race stays. |

- **Releases:** Task 1.1. **Probe:** 21-P2.
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X28: delivered by step 22 D2-A (locked read inside the transaction, every guard on locked rows) plus this plan's one added state `withdraw_pending`; the claim-verb `reviewFloorGate` is dropped.

**D3: What does the under-review freeze cover?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen)** | Content writers: `update` when a content key is sent, `delete`, batch delete, FX batch, `saveChildren` changes/removals. Toggles (reconcile, lock, archive, tags) stay open | The reviewer approves what they read; month-end toggles keep working; matches `LOCK_EXEMPT_COLS` (`cost-lines.ts:122-131`), which already says what a toggle is. |
| B | A plus every toggle | A fee under review cannot be reconciled or locked; reconcile often runs across a whole month and would refuse on any selection with one pending fee. |
| C | Only `costLines.update` (the SOP's literal repair) | The fees page (the main door) and delete stay open; the finding is not closed. |

- **Releases:** Tasks 2.2–2.4.
- **Chosen: A** (Wilfred, 2026-09-21).

**D4: Can an approved, unbilled fee be deleted?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen)** | No, when the flow locks approved content (`postApprovalEditable: false`); message names the remedy (correcting fee line, or admin allows edits after approval) | Same contract as `update`. With step 08 D3-A there is no re-review of the same line, so a wrong approved fee is corrected by an adjusting line. 21-P6 shows how often ops delete approved fees today. |
| B | Yes, but only by a holder of `expense.costLine.review` (accounting), logged | Keeps a clean-up path; a second-pair-of-eyes control becomes one person's call, and ops lose a path they use. |
| C | Leave it open | Approved revenue can vanish before billing with no signal. |

- **Releases:** Tasks 2.2–2.3. **Probe:** 21-P4, 21-P6.
- **Chosen: A** (Wilfred, 2026-09-21).

**D5: What does Modify exchange rate do to a reviewed fee?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen)** | Skip it and report it with a reason (`"under_review"` / `"approved"`), like settled lines | Keeps the existing partial-report contract month-close relies on; operator sees which lines and why. Needs a copy change in one file. |
| B | Refuse the whole batch if any selected fee is reviewed | Simpler; a mixed month selection can never be re-rated in one go. |
| C | Route each row through `costLineWriter.update` | Reuses the gates, but turns a set-based update into N governed writes with N audit rows, and loses the skip report (the writer throws). |

- **Releases:** Tasks 2.2, 2.5. **Probe:** 21-P5.
- **Chosen: A** (Wilfred, 2026-09-21).

**D6: How does the order fees page (`saveChildren` costs) treat a reviewed fee?** · Status: **Decided 2026-09-21 — Chosen: A (per X29)**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen)** | Refuse the save when it changes or removes a fee under review or approved-and-locked, naming the fees; unchanged re-sends pass | Closes the main door; the page's send-everything contract keeps working through the existing comparator. |
| B | Silently keep the stored values for frozen fees and save the rest | No error, but the operator sees "Fees saved" for a change that did not happen (the silent-failure shape this repo keeps fixing). |
| C | Leave it to step 20's plan | Step 15 D2-B's carve-out stays unguarded until someone else acts. |

- **Releases:** Task 2.3. **Probe:** 21-P7. **Cross-plan:** step 20 order (§7.6).
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X29: this plan owns both the approved and the under-review freeze on `saveChildren` (step 20 drops its approval call), "removed" is step 20's `removable`, and the order is 20 P1 → 20 P2 → 21 P2.

**D7: What happens to `costLines.review` / `reviewBatch`?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen)** | Delete both and the writer's `review` verb; keep `EXPENSE.costLineReview` with `isEndpoint: false` | The engine is the only writer; matches step 15 D4-A/D9-A and step 08 X10. Tests that seeded cache states through the verb are re-seated. |
| B | Keep them but refuse unless an engine submission agrees | Two writers of one field that must agree forever; more code than deleting. |
| C | Keep them, owner-only | Still a second approval path, and the owner bypass is already wide. |

- **Releases:** Task 3.1. **Probe:** 21-P3.
- **Chosen: A** (Wilfred, 2026-09-21).

**D8: May a member decide a fee they submitted?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen)** | No: `separationOfDuties: true` on `cost_line` (step 08's switch) | Accounting cannot approve its own fee. An org whose only accountant books fees gets a submit refusal for those fees until a second reviewer is added to the stage (step 08 D2-A). |
| B | Leave self-decision on | No change; an accountant's own fee is approved by one person. |
| C | On, and seed a second stage reviewer (director) for new orgs | Covers single-accountant new orgs; changes the seed for every new org and adds a second role to "hundreds a week" (`seed.ts:170-171`). |

- **Releases:** Task 3.2. **Probe:** 21-P8, 21-P9.
- **Chosen: A** (Wilfred, 2026-09-21).

**D9: What about fees already billed, approved or deleted through the holes?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen)** | Report only (`audit-cost-review-drift-2026-09.sql`, read-only) | Same as step 08 D5-A and step 15 D13-A; any repair is a later decision with the counts in hand. |
| B | Repaint drifted caches from the engine | Fixes badges; a legacy-approved line with no submission would go back to `null` (still billable), so it changes little and writes production data. |
| C | Nothing | Nobody knows the size. |

- **Releases:** Task 3.4.
- **Chosen: A** (Wilfred, 2026-09-21).

**D10: How are submit and save serialised on the three unlocked loads?** · Status: **Decided 2026-09-21 — Chosen: A (per X30)**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen)** | `.for("update")`, ordered by `(created_at, id)` (X30; drafted as "by id"), on `saveChildren`'s cost load, `batch` and `exchangeRateBatch` | Serialises with `repaintCache`'s row write (Finding D); proven on real Postgres. |
| B | Lock in `cost_line.exists` instead | Takes the lock earlier in submit but leaves the three writers unlocked, so the save side can still interleave. |
| C | No lock | A save can land between the freeze check and a committed submit. |

- **Releases:** Tasks 2.2–2.4.
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X30: every `cost_line` `FOR UPDATE` (`saveChildren`'s existing load, `batch`, `exchangeRateBatch`) orders by `(created_at, id)`, not `id`.

**D11: Does the fees page show which fees are under review or approved?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A (Recommended) (Chosen)** | No UI change; the server refusal names the fees | Smallest change; the page's owner (step 20) can add markers later. |
| B | Mark frozen rows read-only in the grid | Clearer, but the `children` payload must carry review state and the grid (step 20's area) gains a mode. |
| C | Both a marker and a banner | Most helpful; most code in a file another plan edits. |

- **Releases:** none (A); a new web task under B or C.
- **Chosen: A** (Wilfred, 2026-09-21).

### Risks

- **Live fees under review become read-only on Phase 2 deploy.** Likely; medium. → **Announce "withdraw before editing" with the deploy; 21-P2 gives the count.**
- **Ops rely on editing or deleting approved fees before billing.** Unknown. → **Re-check before Task 2.3: 21-P5/P6/P7; if they show a routine pattern, stop and re-plan D4/D6.**
- **Deleting the verbs fails the permission registry sync.** Certain without D7-A's `isEndpoint` line. → **Task 3.1 runs `registry.sync.test.ts` before committing.**
- **Step 20 and this plan edit the same `saveChildren` block.** Certain. → **Settled by X29: 20 P1 → 20 P2 → 21 P2; 20 owns the lock freezes and `removable`, 21 the review freezes and `changedKeys` (§7.6). Between 20 P2 and 21 P2 an approved fee stays editable from the order page, as today (accepted cost).**
- **The `create_bill` pre-check runs outside the transaction at HEAD.** A retract between check and claim bills one line. Low. → **Closed by step 22 P1 (X28): the gate and J4 run on locked rows inside the transaction; Task 1.2's interleave proves it.**
- **PGlite cannot prove the locks or the submit-vs-createBill race.** Certain. → **Real-Postgres cases in `expense.concurrency.test.ts`, each seen failing first.**
- **Line numbers drift** (steps 10, 11, 15 edit `cost-lines.ts` / `collective-order.ts`). Certain. → **Every task locates by symbol.**
- **A stale `:3000` server makes browser checks pass on old code.** High. → **Restart after every `packages/api` change; check the process start time.**

### SOP text vs code (Phase 0 wins)

| # | SOP / finding claims | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| 1 | Fix 1: gate skipped on the unticked path | True (`cost-lines.ts:2502-2508`, `gates.ts:76`), but only in orgs that ticked `create_bill`: the seed ticks none (`seed.ts:173`, `modules/expense/gates.ts:26-30`) | Code (D1, probe 21-P1) |
| 2 | Fix 2: FX batch skips the post-approval freeze | True (`:2063-2166`, `batch.ts:116-124`); it also ignores the under-review window, and the fees page (`collective-order.ts:4396-4414`) rewrites approved fees too — the SOP names neither | Code (D5, D6) |
| 3 | Fix 3: delete gates are billed / locked / rec-pay only | True (`:431`, `:1774-1795`); `saveChildren` removal (`collective-order.ts:4306`) is a third door, and deleting under review leaves an orphan submission counted by `pendingSummary` | Code (D4, D6) |
| 4 | Fix 4: `assertNotUnderReview` only in company, lading, quotation | True (`company.ts:1343`, `lading.ts:1474, 1513`, `quotation.ts:980`); repair "add it to update" misses delete, batch delete, FX and the fees page | Code (D3) |
| 5 | Fix 2/3 cite `cost-lines.ts:137-142, 333-339` | `postApprovalGate` is `:139-143`; update gates `:336-342` | none |
| 6 | Pitfall: Create Bill refuses pending or rejected; null/draft bill | True, and `withdraw_pending` also bills; the check reads the cache, which the legacy verb rewrites | Code (D2, D7) |
| 7 | Role: submitter needs `expense.costLine.update`; reviewer `expense.costLine.review`, routed | True (`resources.ts:400-401`, `decide.ts:50`); omits that any holder of `expense.costLine.review` (ops, admin, branch manager, accounting, director) can stamp a fee approved over RPC (`cost-lines.ts:1465, 1530`) | Code (D7) |
| 8 | Role: seeded flow routes to accounting, any-pass | True (`seed.ts:166-175`); accounting also holds the submit node (`roles.ts:175`), so it can approve its own fee | Code (D8) |
| 9 | Guide: node label "submit / approve / reject" (`permissions.ts:112`) | Submit rides `costLineUpdate`, not this node | Code (label fix in Task 3.1) |
| 10 | Guide: "The queue's Approved/Rejected is one all-or-nothing transaction" | True (`audit-review.ts:394-423`); after a refusal the queue still clears the ticks (`cost-lines.tsx:1981-1983`) | none (adjacent 5) |
| 11 | Guide: ticks clear on filter or page change (`cost-lines.tsx:1944`) | True (`:1944-1947`) | none |
| 12 | Step card: the fee ledger's toolbar carries reconcile, lock, archive, tag and FX | True (`cost-line-batch-menu.tsx:85-89, 166-169, 477`) | none |

What the SOP text should say after this plan (for whoever edits `sop.json`; not this plan's task): the pitfalls gain "A fee under review cannot be changed or deleted until it is decided or withdrawn" and "An approved fee cannot be changed, re-rated or deleted before billing unless the flow allows edits after approval; add a correcting fee line"; the role line gains "you cannot approve a fee you submitted".

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000. One worktree's servers at a time.
**Preconditions:**
- A freshly seeded audit e2e org: `bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>`. `ACTORS` (`e2e/fixtures/seed-cli.ts:52-77`): owner, directorA, directorB, accountant, salesperson, managerA, managerB, viewer. The walk uses:
  - **Fee submitter: `managerA`** (branch-manager; holds `expense`, so update, delete, submit).
  - **Fee reviewer: `accountant`** (the seeded Cost review stage role).
  - **Flow editor: `owner`** (`/parameters`, Approval Process Setting).
  - For D8: a second accounting member is needed; there is only one in `ACTORS`. As `owner`, add `directorA`'s role to the Cost review stage for the D8 check, and restore afterwards.
- A sea-export order **O1** with a job number and three fees on `/order/<O1>/expenses`: THC 500 MYR, Seal 50 MYR, Doc 30 MYR; none submitted.
- Confirm the actor with `fetch('/api/auth/get-session')` before each actor's steps. Restart `:3000` after the last `packages/api` edit.

**Migrations:** none. Confirm the journal still ends where the merged steps left it and that those are applied (check `_journal.json` and the database, not the command exit code).

**Test commands** (read each output for `failed` and the `Test Files` line):
- Phase 1: `bunx vp test run packages/api/src/routers/expense.review.test.ts packages/api/src/routers/expense.create-bill.test.ts packages/api/src/routers/expense.filter-scope.test.ts packages/api/src/routers/expense.bills.test.ts packages/api/src/architecture.test.ts`, then `DATABASE_URL_TEST=<dev branch URL> bunx vp test run packages/api/src/routers/expense.concurrency.test.ts` (its tests listed as passed, not skipped).
- Phase 2: `bunx vp test run packages/api/src/modules/expense/review-freeze.test.ts packages/api/src/routers/expense.review-freeze.test.ts packages/api/src/routers/expense.batch.test.ts packages/api/src/routers/collective-order.costs.test.ts packages/api/src/routers/expense.review.test.ts packages/api/src/routers/expense.ledger.test.ts packages/api/src/routers/audit-review.test.ts`, then the concurrency suite as above.
- Phase 3: `bunx vp test run packages/api/src/permissions/registry.sync.test.ts packages/api/src/permissions/reachability.test.ts packages/api/src/modules/audit/seed.test.ts packages/api/src/routers/expense.review.test.ts packages/api/src/routers/expense.wave1.test.ts packages/api/src/routers/expense.rbac.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/architecture.test.ts apps/web/src/architecture.test.ts`, then the e2e specs in Task 3.5.
- Every phase: `bun run check-types` (confirm `apps/web` ran).

**Golden path — Journey 1 (Phase 2; `managerA`)**
1. Navigate to `/expenses/cost-lines`, type O1's job number in **Search all columns** → three rows, **Audit Status** empty.
2. Tick THC and Seal → **Review (2)** → **Submit for review** → toast _"2 rows — submit for review"_; both read Pending.
3. Navigate to `/order/<O1>/expenses`, change THC to 5000, **Save** → error toast containing _"under review"_ and _"THC"_; reload → THC still 500.
4. Change only Doc to 35, **Save** → _"Fees saved"_; reload → Doc 35 (a free fee in the same save works).
5. Back on the ledger, open THC's edit sheet, set 5000, Save → toast _"This record is under review and cannot be edited. Retract the submission first."_
6. Tick THC and Doc → **BatchOperation (2)** → **Modify exchange rate…** → 4.7500 → dialog lists THC with _"under review"_; Doc's rate reads 4.7500 on reload, THC's is unchanged.
7. Tick THC → **Mark as… (1)** → **对账 · Reconciled** → success; THC shows reconciled.
8. Tick THC → **Review (1)** → **Request withdrawal** → Withdrawn. Edit THC to 520 → saved. Submit again → Pending.

**Golden path — Journey 2 (Phase 2; `accountant` then `managerA`)**
1. As `accountant`, **Approvals → Cost review** → THC and Seal listed. Tick both → **Approved** → toast _"2 line(s) approved"_; the queue empties.
2. As `managerA`, `/order/<O1>/expenses` → add "Handling 80", **Save** → _"Fees saved"_ (approved rows re-sent unchanged).
3. Change THC to 600, **Save** → toast containing _"approved and locked"_ and _"THC"_; no 500 in the network panel; reload → 520. (This is step 20 §10 edge case 4's approved half, moved here under X29.)
4. Delete the Seal row, **Save** → the same refusal naming Seal; reload → Seal present.
5. On the ledger, delete Seal from its row → _"This record was approved and its content can no longer be edited"_. **BatchOperation → Delete** over Seal → _"1 selected line(s) are approved and locked"_ refusal.
6. **Modify exchange rate…** over THC and Handling → Handling updated, THC listed _"approved"_.
7. Tick THC and Seal → **Create Bill (2)** → Create → toast _"Bill … created"_.

**Golden path — Journey 3 (Phase 1, after step 22 P1; `owner`, `managerA`, `accountant`)** Steps 1–5 check step 22's gate fix (X28) on the merged base; edge case 1 checks this plan's `withdraw_pending`.
1. As `owner`, `/parameters` → Approval Process Setting → Cost review → tick **Create bill** → save.
2. As `managerA`, create three fees on order O2 (one settlement unit, MYR); submit two; as `accountant` approve those two.
3. As `managerA`, filter the ledger to O2; tick nothing; **Create Bill (全选)** → dialog shows 3 → Create → error toast _"\"Create bill\" requires review approval first — 1 of 3 selected are not approved"_; `/expenses/bills` has no new bill.
4. Submit and approve the third → the same press → bill created.
5. As `owner`, untick **Create bill**.

**Golden path — Journey 4 (Phase 3)**
1. In the console, POST `/rpc/costLines/review` with `{ id, to: "approved" }` → **404**.
2. As `owner`, add the **director** role to the Cost review stage. As `accountant`, create fee F on O1 and submit it. `/approve/cost` → F is **not** listed; `auditReview/decideByResource` for F → FORBIDDEN _"You submitted this record. Another reviewer must decide it."_ As `directorA`, `/approve/cost` → F listed → **Approved**. Restore the stage.

**Edge case 1: withdrawal awaiting a reviewer (Phase 1).** As `owner`, set the Cost review flow's withdrawal to require reviewer approval. Submit fee W, then **Request withdrawal** → W reads Withdrawal under review. **Create Bill** with W ticked → _"1 selected line(s) are awaiting or failed cost review"_. Restore the flow.

**Edge case 2: rejected fee (Phases 2–3).** Submit fee R; as `accountant`, **Rejected** with reason "rate wrong" → R reads Rejected. As `managerA`, edit R on the fees page → saved (a rejected attempt is terminal and editable). **Create Bill** with R → J4 refusal. Submit again, approve, bill → created.

**Edge case 3: flow allows edits after approval (Phase 2).** As `owner`, turn on edits after approval for Cost review. An approved fee on the fees page → changed and saved; **Modify exchange rate…** applies to it. Restore.

**Edge case 4: submit/save serialisation (dev branch, not the browser).** Proven by the `expense.concurrency.test.ts` interleaves (Tasks 1.2 and 2.4), judged by the call results and the final rows (`cost_line`, `bill`, latest `audit_submission.status`), never by timestamps (`defaultNow()` is transaction start). Each was seen failing without its lock (for Task 1.2, step 22's in-transaction lock; no claim gate exists, X28).

**Regression checks.**
1. `/expenses/cost-lines`: create, edit, delete a never-submitted fee; Tag…, Lock, Archiving on any fee.
2. `/order/<id>/expenses`: save, copy to payable, delete a never-submitted fee.
3. **Create Bill** with ticks on never-submitted fees in an org without `create_bill` → created.
4. `/approve/bill`, `/approve/order`, `/approve/quotation` behave as before.
5. `e2e/specs/audit.review-queue.spec.ts`, `audit.withdraw.spec.ts`, `audit.post-approval.spec.ts`, `cost-lines.control-row.spec.ts` pass.

**Mobile:** at 400px the fees-page refusal toast wraps without horizontal scroll, and the FX dialog's skipped list shows the reason under each fee name.

**Readiness: 7/10 — every defect is verified at `6bb3a1bf` and each phase is small and testable at the API boundary; what holds it back is that Phases 1–3 sit on top of unmerged step 20, 22 and 23 phases over the same blocks, and live impact is unmeasured until the probes run.** Outstanding:
- D1–D11 are Decided (2026-09-21); Phase 1 rests on step 22 P1 (X28), Phase 2 on step 20 P1–P2 (X29) and 23 P1 (X34), Phase 3 on 23 P3 (X33).
- Hard dependency on unmerged steps 08 (Phases 2–3), 15 (Phases 1 and 3), 10 and 11 P3, which edit the same files; anchors must be re-located after each lands.
- The `saveChildren` cost-leg order against step 20, and the `createBill` order against step 22, are settled by X29 and X28 (`steps-20-26-crosscheck.md`).
- Probes 21-P1 to 21-P11 are unrun; 21-P5/P6/P7 and 21-P8/P9 can stop Tasks 2.3 and 3.2.
- Lock and race proofs exist only on a dev Neon branch (`DATABASE_URL_TEST`); CI does not run them, so each PR pastes the real-Postgres output.

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and the Proposed reading of every cross-plan item in `steps-20-26-crosscheck.md` (X28–X40). Each §9 entry keeps all three approaches; only the status, the Chosen line and the text that described a decision as open were changed, plus the task text the overrides below required.

**Chosen:** D1-handed to step 22 (X28; row A's content delivered by 22 Task 1.1) · D2-A (X28) · D3-A · D4-A · D5-A · D6-A (X29) · D7-A · D8-A · D9-A · D10-A (X30) · D11-A.

**Crosscheck overrides as they land in this plan.** X28 → step 22 Phase 1 owns the `createBill` body and merges first; Task 1.1 only adds `withdraw_pending` to the J4 set and rewrites the J4 comment (no gate-ids change, no claim-verb `reviewFloorGate`); Task 1.2 drops cases 1, 2 and 4 (they live in 22's `expense.create-bill.test.ts`) and keeps case 3 and the real-Postgres interleave, which now proves 22's lock without a claim gate; edits in the header, §1, Journey 3, §4.1, §4.7, §4.8, §5 prerequisites and Phase 1, §6, §7.1, §7.2, §7.6 (the "21 P1 before 22 … keep the claim gate" row reversed), §7.8, §8, D1, D2, Risks, §10 Journey 3 and edge case 4, Readiness. X29 → 20 P1 → 20 P2 → 21 P2; this plan owns the approved and the under-review freeze on `saveChildren`, Task 2.3 computes "removed" from step 20's `removable` (never `existing − keep`) and owns the `changedKeys` lift; §4.3, §5 Phase 2, Tasks 2.3 and 2.4 (a `loadedCostIds` case), §7.6, D6, Risks, and §10 Journey 2 step 3 (step 20's edge case 4 approved half). X30 → every `cost_line` `FOR UPDATE` here (`saveChildren`, `batch`, `exchangeRateBatch`) orders by `(created_at, id)`; §4.3, Tasks 2.2–2.3, §8 item 6, D10. X33 → 23 P3 merges before 21 P3; Task 3.1 and §4.5 remove the last `ALLOWED_INDIRECT_WRITES` entry and replace the floor with an empty-list assertion plus a scanner-runs check, delete `review-batch.ts` only if nothing imports it and lint flags it, and skip the comment edits whose code 15 P2 / 23 P3 already deleted (named in the commit message); §5 Phase 3, §6, §7.6. X34 → Task 2.2 and §4.3 use the shared `underReviewGate("cost_line")` from `modules/governed/gates.ts` for `delete` and name the local content-keys gate `costLineContentUnderReviewGate`; 23 P1 before 21 P2 (§5, §7.6). X35 → each interleave is its own named `it` in `expense.concurrency.test.ts`, failing and passing runs pasted; Task 1.2 wording only. X31, X32, X36, X37, X38 → do not touch this plan. X39 → the §9 "SOP text vs code" corrections stay an accepted unowned gap; no text change. X40 → §7.8's "steps 16–27 crosscheck" line left as written.
