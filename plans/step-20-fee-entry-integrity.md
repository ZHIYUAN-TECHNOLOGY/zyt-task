# Step 20 — a fee typed on the order keeps its rate, its row, its lock and its customer

**SOP step:** 20 "Enter what the job cost and what it bills" · trade ledger → open the order → **Expenses** (record page) or **Expense entry** (edit form) → `/order/$orderId/expenses` → **Save**
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-21. The `nct-layout` working tree is on `feat/intake-golden-path-e2e` at `ea1560e7`, but `git diff 6bb3a1bf -- packages apps` is empty, so every citation below matches `6bb3a1bf`. Every `file:line` was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Standard. One server handler (`collectiveOrderRouter.saveChildren`), its two web callers (the Expense Entry page and the order edit form), and tests. No schema change and no migration under any recommended option.
**Status:** every decision in §9 is **Decided** (Wilfred, 2026-09-21: the recommended option throughout, with the crosscheck X-item overrides listed in "Decisions settled" at the end — D6 narrows to B, locks only, per X29).
**Owns cross-plan items:** tracker `nct-s20-unnamed-fee-rows-are-dropped-without-a-word` (step 20 fix), the step-20 half of `nct-identity` (break after step 20), and the step-20 half of `nct-two-profits` (the fee row's own rate). The step-25 half of `nct-identity` and the step-27 half of `nct-two-profits` stay with those steps.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`). Drizzle schema in `packages/db/src/schema`. TanStack Router file routes in `apps/web/src/routes/_next`. zod on both sides. vitest on PGlite (`pushTestSchema`). Dev web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Entry.** `order-record-page.tsx:115` (`Expenses`) and `order-form.tsx:2150-2157` (`Expense entry`, edit mode only) both navigate to `/order/$orderId/expenses` (`routes/_next/order.$orderId.expenses.tsx:64`).
  - **Load.** `collectiveOrder.get` (`:460`) for the Basic info panel, `collectiveOrder.children` (`:461-463`; server `routers/collective-order.ts:3881`) for the fees. `children` returns whole `cost_line` rows (`select()` at `:3915`), masked by `maskRow`, so `lockedAt`, `recPayLockedAt`, `auditStatus` and `settlementCompanyId` reach the page but the page reads none of them.
  - **Grid.** Two `FeeGrid`s (`:844-867`). New-row defaults at `:264-306`: quantity `1`, currency `USD` (`:293`), **exchange rate `1` (`:294`)**, unit price/amount/tax `0`, settlement unit = order client on the receivable grid only (`:852`, `:865`). `patch` recomputes `amount = quantity × unitPrice` to 6 dp when either input moves (`:220-230`).
  - **Save.** `save()` (`:613-663`) drops every row with a blank name (`:629`), then sends **both** grids to `saveChildren` with `exchangeRate: r.exchangeRate || null` (`:657`) and `settlementUnit` unless the column is masked (`:652-654`). The Save button is disabled until `children` resolves (`:800-802`, `loaded` `:547`).
  - **Server.** `saveChildren` (`collective-order.ts:3954`) loads the order (`:3969-3993`, no lock at HEAD), refuses a locked order (`:3996-3998`, "Order is locked"), checks the `expense_entry` gate when `costs` is sent (`:4003-4010`), requires `expense.costLine.update` and `.read` (`:4110-4137`), reads the order's existing lines in the caller's expense scope (`:4146-4185`), refuses dropping or money-editing a *settled* line (`settled` `:4189-4190`, `:4211-4216`, `:4236-4270`), deletes every existing line whose id was not sent (`removable` `:4286`, delete `:4306`), seeds rates for new rows (`:4358-4398`), updates/inserts (`:4397-4500`), writes one `audit_log` row with before/after cost lines (`:4535-4572`) and returns `{ ok: true }` (`:4574`).
  - **Second caller.** The order edit form posts the full cost array on **every** Save (`order-form.tsx:1700-1709`, `:1733`), with only `costName`, `amount`, `currency`, `remark` per row. Its children prefill runs **once per order** (`loadedChildrenForRef`, `:970-985`), so a long-open edit form holds the fee set it first saw.

- **Finding F1 (money) — every fee typed on Expense Entry is stored at rate 1, and the org's "no fee without a rate" switch is bypassed. Confirmed.**
  - The server seeds a new line's rate from the monthly table only when the caller sent **no** rate: `needsSeed` filters on `c.exchangeRate === undefined` (`:4358-4362`). The page never omits it: new rows start at `"1"` (`:294`) and a blanked cell sends `null` (`:657`), which `costLineExtras` coerces to `"1"` (`:534`). So the seed block never runs for this page. Its own comment says it was added because "every fee entered on an order stored the literal 1" (`:4315-4322`), and its test suite only ever omits the key (`collective-order.costs.test.ts:1513-1600`, `saveCosts` `:57-61`).
  - `Copy to payable` / `Copy to receivables` spread the source row (`:677-689`), so a payable copy carries the receivable's rate. The server prices the two legs separately (`:4383`, test "prices receivables and payables on their OWN legs" `:1524`); the copy defeats that too.
  - The ironic half: the order **edit form** omits `exchangeRate` (`order-form.tsx:1700-1709`), so its new fees *are* seeded. Two screens, one handler, two prices for the same fee.
  - Every figure downstream multiplies by the line rate: `rollupCostLines` (`modules/expense/money.ts:188`, `:198`), the page's gross-profit box (`feeLocalAmount`, `apps/web/src/lib/expense.ts:372-378`). `createBill` resolves its own `bill` rate from the table (`cost-lines.ts:2593-2620`), so a bill and its lines then disagree. This is the step-20 half of `nct-two-profits`.
  - `costLines.create` refuses an unrated fee when the org turned `fee_savable_without_rate` off (`cost-lines.ts:1262`, `modules/setting/fx-settings.ts:293-306`; schema `schema/setting.ts:135`, default `true`). `saveChildren` never calls it (grep: callers are `cost-lines.ts:1262`, `quotation.ts:3002`, `:3210` only). An org that forbids unrated fees still gets them from both order screens.

- **Finding F2 (data loss, concurrency) — a stale save deletes fees someone else added. Confirmed.**
  - `saveChildren` reads "existing" **inside** its transaction (`:4146`) and deletes every existing unsettled line the payload omits (`:4286`, `:4306`). The payload is the caller's snapshot from page load. Any line added after that snapshot is omitted, so it is deleted:
    - by `costLines.create` with an `orderId` (the Money > Cost lines **Add** dialog, `routes/_next/expenses/cost-lines.tsx:385`);
    - by `convertToOrder` / `importFromQuote` attaching lines (step 11);
    - by a second tab or a second operator on Expense Entry;
    - by the **order edit form**, whose once-per-order prefill (`order-form.tsx:970-985`) means an edit form left open in one tab deletes every fee added on Expense Entry in another tab the next time its header is saved.
  - The reverse also happens: a line deleted elsewhere after load is sent back with its old id; `existing.some(r => r.id === c.id)` is false, so the insert leg (`:4425-4432`) **re-creates** it under a new id.
  - Step 15 Task 1.3 adds `.for("update")` on this load. That serialises two saves; it does not stop the second save's stale payload deleting the first save's rows, because the delete set is computed from the payload.
  - Recovery exists only in `audit_log` (`before.costLines` `:4553-4561`). Nothing tells the operator.

- **Finding F3 (data loss) — a fee with no name is dropped, and clearing the name of a saved fee deletes it. Confirmed; wider than the SOP fix.**
  - `save()` filters `costName.trim() !== ""` over **all** rows (`:629`), saved ones included. A new row with an amount and no name vanishes (the SOP's `fixes[0]`). A **saved** row whose name the operator clears is also filtered out, so the server reads it as omitted and deletes it (`:4286`) under a "Fees saved" toast. If that row is settled, the operator instead gets "1 cost line(s) are billed, invoiced or written off and cannot be removed here" (`:4213-4215`) for a row they did not remove.
  - The comment at `:626-628` justifies the silent drop as eyun's rule. The placeholder (`:404-406`) is the only warning.
  - The edit form has the same filter (`order-form.tsx:1701`), plus amount and currency.

- **Finding F4 (integrity; severs the hand-off to step 21) — saveChildren ignores fee locks and Cost-review approval that the ledger enforces. Confirmed.**
  - The ledger's `update` verb carries `postApprovalGate`, `singleFeeLockGate`, `recPayLockGate`, `billedFieldsGate`, `orderUnlockedGate` (`cost-lines.ts:333-342`); its `delete` refuses billed, locked and rec/pay-locked lines (`deleteRefusalsGate` `:227-245`) and pins `bill_id IS NULL AND locked_at IS NULL` (`:431-436`).
  - `saveChildren`'s `settled` predicate is `billId`, `invoicedAmount`, `writtenOffAmount` only (`:4189-4190`). So:
    - it **deletes** a locked (`locked_at`) or rec/pay-locked (`rec_pay_locked_at`) unbilled line when the payload omits it — the database trigger is `BEFORE UPDATE` only (`db/src/migrations/0033_cost_line_immutable.sql:152-165`), so nothing stops a delete;
    - it **updates** a locked line's money columns, which the trigger refuses with SQLSTATE 23514 (`0033…:152-165`, function `0042_settled_line_company_refs.sql:63-95`). Nothing maps it: `isCheckViolation` is used only in `routers/expense/bills.ts`, so the operator sees a raw 500;
    - it never calls `assertPostApprovalEditable(…, "cost_line", …)` (grep: its three calls in `collective-order.ts` are `"collective_order"` at `:2800`, `:2892`, `:4756`). The seeded "Cost review" flow (`modules/audit/seed.ts:167-168`) is written `postApprovalEditable: false` (`:232`), so a fee **approved at step 21** is frozen on Money > Cost lines and freely editable or deletable here.
  - The page freezes only settled rows (`isSettled` `:155-156`); a locked row renders editable.
  - Step 15 D2-B keeps fees outside the **order** freeze because "fees are governed by the cost-line review" (step 15 §2 Journey 1 step 4). On this path that governance does not exist yet. This plan supplies the lock half; step 21 Phase 2 supplies the review-state half, approval included (X29).

- **Finding F5 (identity; the break after step 20) — the fee drops the customer's company record. Confirmed.**
  - `cost_line.settlement_company_id` exists (`schema/expense.ts:82`). `costLines.create` accepts and writes it (`cost-lines.ts:1113`, `:1282`). `saveChildren`'s `costInput` has no such key (`:388-477`) and its order load does not select `clientCompanyId` (`:3969-3993`), although the order carries it (`schema/collective-order.ts:152`; the edit form keeps it, `order-form.tsx:943`).
  - The seed stamps only the **name** on receivables (`settlementUnit: order.clientName`, `:4480-4484`).
  - `createBill` copies `head.settlementCompanyId` onto the bill (`cost-lines.ts:2638`); the payment-terms trigger fills the due date only from a non-null `settlement_company_id` (`0062_payment_terms_due_date.sql:150-153`); the invoice resolves its buyer from the first bill with one (`routers/expense/invoices.ts:346-348`). A fee entered on either order screen therefore produces a bill with no due date and an invoice with no buyer address or tax id — ledger items `identity` and `never-overdue`.

- **Finding F6 (advisory) — the FX banner asks the wrong question. Confirmed.**
  - It compares each currency against the **branch** currency (`:730-741`). The server converts into **本位币** when the org set one (`reportingCurrency`, `fx-settings.ts:212-224`), so an org with a base currency is warned about pairs it does not need and not warned about the ones it does.
  - `exchangeRates.list` accepts no `periods` key (schema `routers/expense/exchange-rate.ts:224-236`), so zod strips it (the page's own comment admits this, `:469-476`) and any rate row of **any** type and **any** period silences the banner. The server resolves by the shipment's dates through the time-standard chain (`effectiveRateDate`, `:4368-4372`), not by "this month".
  - After a save, nothing says a seed missed. `saveChildren` returns `{ ok: true }` only; `costLines.create` returns `rateMissing` (`cost-lines.ts:1313`), which the ledger page toasts (`cost-lines.tsx:1139`).

- **Finding F7 (low; money shown to the customer) — typing only the Total saves `1 × 0 = 500`. Confirmed.**
  - New rows start at quantity `1` and unit price `0` (`:286`, `:295`). Typing Total price does not touch either (recompute runs only for quantity/unit price, `:220`). The saved line has `quantity 1`, `unit_price 0`, `amount 500`, and the invoice prints both columns (`modules/export/invoice-document.ts:422-423`, `:560-567`).

- **Finding F8 (low; feeds step 22) — a payable saved without a vendor.** `Copy to payable` blanks the Settlement unit (`:688`), new payables start blank (`:865`), and `save()` sends `null` (`:654`). `createBill` buckets on `settlementUnit ?? ""` with no order in the key by default (`cost-lines.ts:2521-2530`), so blank-vendor payables from different orders group into one bill addressed to nobody. No plan adds a refusal in `createBill` (accepted known gap, crosscheck X32, sized by 20-P10); the page at least says so (D10).

- **Checked and sound (no plan).**
  - The save-before-load guard (`:618-621`, `:800-802`) and the dirty-gated refill (`:568-572`) do what their comments say.
  - The permission split (`update`, `read`, `create`, `delete` nodes, `:4110-4137`, `:4287-4297`) and the field-mask handling (`dropDenied`, server-derived seed outside the strip, `:4425-4484`) are right.
  - Settled lines: drop and money-edit refusals (`:4211-4270`) are right for billed/invoiced/written-off lines.
  - `Special receivables` / `Special payable` are inert and say so (`:918-922`); `Interest` shows `—` (`:887`). Both are deliberate.
  - Order lock (`:3996`) and the `expense_entry` gate (`:4003-4010`) refuse as the SOP says.

- **Adjacent, flagged only (not planned here).**
  1. The footer link to Cost Detail carries no order filter (`:928`). That is the break after step 21 ("Order → Bill"); step 21/22 owns it.
  2. No under-review freeze on cost lines on **either** writer (`costLines.update` has no `assertNotUnderReview`). Step 21 owns Cost review and every review-state freeze on this path, through its `costLineReviewFreezes` (X29, §4.4).
  3. The `fee_rate_editable` and `fee_rate_follows_table` switches (`fx-settings.ts:51-53`, `routers/setting.ts:145-146`) are stored and enforced nowhere, on any fee writer. Not a step-20 defect.
  4. Two editors changing the **same** line's amount: last write wins. No version column is read. Named in §9 Risks.
  5. Hidden-column detection samples `costs[0]` (`:557-565`), so on an order with no fees a field-masked role sees an editable Settlement unit cell whose value the server strips. Low; flagged.

- **Precedent this plan follows.**
  - Rate seeding and the unrated switch: `costLines.create` (`cost-lines.ts:1228-1262`, `rateMissing` in its output `:1313`).
  - Lock and approval refusals: the ledger's gates (`cost-lines.ts:139-245`) and their messages.
  - Row lock on the order load: step 15 Task 1.3 (`.for("update")` on `saveChildren`'s scoped load). This plan relies on it and adds it only if step 15 Phase 1 has not merged (grep first).
  - Approval freeze: not this plan (X29). Step 21 Task 2.3's `costLineReviewFreezes` (`modules/expense/review-freeze.ts`, NEW in that plan) covers it; step 15 Task 1.1's `assertPostApprovalEditableMany` is not called here.
  - Server-derived values merged after `dropDenied`: `saveChildren`'s own settlement-unit seed (`:4425-4484`).

- **Migration state.** Journal ends `0065_quotation_send_decision` (idx 64), contiguous. Other plans reserve `0066`–`0068`, `0073`, `0074` and hold conditional `00NN_<name>` placeholders (crosscheck X14). **This plan needs no migration** under any recommended option: `settlement_company_id` already exists, and the only other option that would need one (D1-B's version token) uses `cost_line.updated_at`, which exists (`schema/expense.ts:176-179`).

---

## 1. Overview

**Problem.** Expense Entry is where operations book what a job cost and what it bills. Today a USD fee typed there is stored at rate 1 in a MYR branch, so the job's profit is wrong the moment it is saved. A save made from a stale tab, or from the order edit form left open, deletes fees that someone added elsewhere. Clearing a fee's name deletes the fee. A fee locked or approved in Cost review can still be edited or deleted from here. And the fee forgets which company the customer is, so the bill never gets a due date and the invoice goes out without an address or tax id.

**Goal.**
- **Phase 1 (F1, F2, F3, F6):** a save stores the table rate for new fees (or refuses, where the org says so), deletes only fees the operator saw and removed, and never drops a fee without saying so.
- **Phase 2 (F4 lock half, F5):** locked fees are frozen here exactly as on Money > Cost lines (approved fees follow with step 21 Phase 2, X29), and a receivable billed to the order's client carries the client's company record.
- **Phase 3 (F7, F8):** the grid stops saving a quantity × unit price that does not equal the amount, and warns when a payable has no vendor.

**Success criteria.**
- A new USD receivable saved on a MYR-branch order with a local rate of 4.70 on file stores `exchange_rate = 4.7`; its payable copy stores the payable leg. The gross-profit box after save matches `rollupCostLines`.
- With `fee_savable_without_rate = false` and no rate on file, Save refuses with the switch's sentence and writes nothing. With it `true`, Save succeeds and the page says which currencies are unrated.
- A fee added from Money > Cost lines while Expense Entry is open and dirty survives the Expense Entry save; the toast says it was kept, and the grid reloads with it.
- A new row with an amount and no name is refused by name ("Receivable row 3 has an amount but no Name of cost"). Clearing the name of a saved fee is refused, and the bin icon is the only way to remove it.
- A locked fee renders read-only; a raw RPC edit or delete of it returns the ledger's own sentence, not a 500. (An approved fee under a locking Cost review flow is refused by step 21's sentence after 21 P2 — X29; not a step-20 criterion.)
- A receivable whose Settlement unit is the order's client stores `settlement_company_id = collective_order.client_company_id`; a bill made from it gets a due date.

**In scope.** `saveChildren`'s cost leg; its output; the Expense Entry page; the edit form's cost payload; tests; read-only production probes for Wilfred.

**Out of scope.**
- Step 21's review-state freezes on cost lines (under review and approved-and-locked, every writer including `saveChildren`, X29), and its queue.
- A refusal of blank settlement units in `createBill`: an accepted known gap under crosscheck X32, owned by no plan (sized by 20-P10). Step 22's order-filtered link from Expense Entry.
- Step 25's invoice buyer fallback for bills already made without a company.
- Step 27's reconciliation of the fee-rate profit with the bill-rate profit (`nct-two-profits` step-27 half).
- A company picker for vendors (D7 option B).
- Backfilling rates or company ids on existing lines (D8: report only).
- The unenforced `fee_rate_editable` / `fee_rate_follows_table` switches.

**Tracker items (`tracker/seed/tasks-nct.json`, `steps` containing `n: 20`):**

| Task id | Kind at step 20 | Planned here? | Why |
|---|---|---|---|
| `nct-s20-unnamed-fee-rows-are-dropped-without-a-word` | `step` 20 | **Yes, Phase 1 (Task 1.4)** | F3; widened to cover clearing a saved fee's name. |
| `nct-identity` "The customer's identity does not survive the journey" | `break-after` 20 (and `step` 25) | **Yes, step-20 half, Phase 2 (Task 2.2)** | The id is lost in `saveChildren`. Step 25 keeps its own half (printing a buyer for bills that already lack one). |
| `nct-two-profits` "One shipment, two profits" | `step` 20 (and `step` 27) | **Partly, Phase 1 (Task 1.2)** | The fee row's rate becomes the table's rate. The bill-rate vs fee-rate difference that remains is step 27's. |

**Assumptions.**
- Step 15 Phase 1 merges first and supplies the `.for("update")` on `saveChildren`'s load (§7.6). If not, Task 1.1 adds it itself. (Phase 2 no longer needs step 15's `assertPostApprovalEditableMany`, X29.)
- `resolveRate` with `rateType: "local"` and the attribute leg is the right seed for this page, as it already is for the edit form and `costLines.create`.
- A receivable's counterparty equals the order's client in the common case (the page seeds it so, `:852`). Only that case gets a company id in Phase 2.

## 2. User Journeys

**Journey 1 (changed): Operations enter a job's fees (golden path)**
Trigger: the order is saved and not locked; its client is ACME (a company record); the branch reports in MYR; the local-rate table has USD→MYR receivable 4.70, payable 4.50.
Steps:
1. Ops open the order and press **Expenses** → `/order/$orderId/expenses`; Save reads **Loading…** until fees load (unchanged).
2. In **Receivable detail** press **Costs name** → a row with Quantity 1, Currency USD, **Exchange rate blank with the hint "From rate table"**, Settlement unit ACME.
3. Fill Ocean Freight, 1 × 1000 → Total 1000.
4. Press **Copy to payable** → a payable copy with a blank Settlement unit and a **blank** Exchange rate. Type the haulier.
5. Press **Save** → toast _"Fees saved"_. The grid reloads: the receivable shows rate 4.7, the payable 4.5. The gross-profit box reads 4700 − 4500 = 200 MYR.
6. Flow ends on Expense Entry. Next: step 21 (Cost review) — the receivable now carries ACME's company record, so step 22's bill will get ACME's payment terms.
Where it lives: the existing page and the existing Save.

Old journey, for contrast: step 2 showed Exchange rate `1`; step 5 stored 1 on both lines, and the box read 1000 − 1000 = 0 "MYR". The receivable carried the name ACME only.

**Journey 2 (new refusal / notice): No rate on file**
Trigger: the order has a fee in THB and the table has no THB→MYR local rate.
Steps:
1. Ops add a THB fee and press **Save**.
2. Org switch **无汇率时费用可保存** on (the default): saved at the column default 1. Toast _"Fees saved. No exchange rate on file for THB — these fees count at rate 1 until one is set."_ with the link to `/expenses/exchange-rates` in the banner.
3. Switch off: refused, _"A fee line has no exchange rate for its currency this month, and this organization does not allow saving fees without a rate (参数设置 · 无汇率时费用可保存 is off)"_. Nothing written; the grid keeps the typing.
Where it lives: the existing banner slot and toast.

**Journey 3 (hardened): Someone adds a fee while Expense Entry is open**
Trigger: ops have Expense Entry open with unsaved typing; accounting adds "Customs inspection" to the same order from Money > Cost lines → **Add**.
Steps:
1. Ops press **Save** → the server deletes only fees ops loaded and removed; "Customs inspection" was never loaded, so it is kept.
2. Toast _"Fees saved. 1 fee added elsewhere since you opened this page was kept."_ The grid reloads and shows it.
3. Variant: accounting **deleted** a fee ops still have on screen → Save refused, _"1 fee on this order was deleted by someone else after you opened it. Reload to see the current fees."_ Nothing written; typing kept.
4. Variant: the order edit form, open since this morning, is saved → the same rule applies to its cost array; today's fees survive.
Where it lives: server; the page's and the form's existing toasts.

**Journey 4 (changed): A fee without a name**
Steps:
1. Ops type 250 into a new row's Total price and forget the name. Press **Save** → refused, _"Receivable row 3 has an amount but no Name of cost. Name it, or remove the row with the bin."_ The row is outlined.
2. An untouched new row (name blank, every figure at its default) is still dropped quietly.
3. Ops clear the name of a saved fee and press **Save** → refused, _"Payable row 2 is a saved fee. Give it a name, or remove it with the bin."_

**Journey 5 (hardened): A locked or approved fee**
Trigger: accounting locked a fee (Single Fee Lock) or Cost review approved it under a flow that locks approved content.
Steps:
1. Ops open Expense Entry → a locked row is read-only, its bin disabled with the title _"This fee is locked and cannot be edited or removed here"_.
2. An approved row stays typable. After step 21 Phase 2, Save refuses it with step 21's `costLineReviewFreezes` sentence, which names the fee (X29). Between 20 P2 and 21 P2 it stays editable here, as today (accepted cost).
3. A raw RPC delete of a locked fee returns CONFLICT with the same sentence, not a 500.

**Journey 6 (hidden, server): the fee carries the customer's record**
1. Journey 1 step 5 stores `settlement_company_id` = the order's `client_company_id` on the ACME receivable.
2. Ops later change that receivable's Settlement unit to "ACME Logistics Sdn Bhd (paying agent)" → the id is cleared, because the name no longer is the order's client.
3. Step 22's bill from the ACME line gets ACME's payment terms and a due date (trigger `0062…:150-153`).

## 3. Result (What Changes for the User)

**Before:** fees typed on the order page are priced at 1 in any currency; a save can silently delete other people's fees, drop a half-typed fee, or delete a fee whose name was cleared; locked and approved fees are editable here; the bill made later has no due date.
**After:** the rate comes from the table (or the org's switch refuses); a save deletes only what the operator removed; nothing is dropped without a sentence; locked fees are frozen here too (approved fees from step 21 Phase 2, X29); the customer's company follows the fee.
**Key differences:**
- Operations: the Exchange rate cell starts blank and fills after Save; some saves are now refused with a sentence where they used to succeed quietly.
- Accounting: fees added from the ledger survive an order-page save; locks hold everywhere (Cost review approvals on this page from step 21 Phase 2, X29).
- Finance (steps 22–27): receivables from the order page reach the bill with a company id; profit per job uses the table rate.

## 4. Technical Architecture

### 4.1 Data flow (after all phases)

```
saveChildren({ orderId, costs, loadedCostIds? })                      (D1-A: new optional key)
  tx.begin
  ├─ SELECT collective_order … FOR UPDATE      (step 15 Task 1.3; +clientCompanyId, clientName — Task 2.2)
  ├─ locked → FORBIDDEN "Order is locked"      (unchanged)
  ├─ expense_entry gate                        (unchanged)
  ├─ permissions update/read                   (unchanged)
  ├─ existing = SELECT cost_line … (+lockedAt, recPayLockedAt, settlementCompanyId)
  ├─ stale check (D2-A): ids ∈ loadedCostIds ∩ keep, ∉ existing → CONFLICT "deleted by someone else"
  ├─ frozen(r) = settled(r) OR lockedAt OR recPayLockedAt                  (D6-B, Task 2.1)
  ├─ refuse drop of frozen · refuse money edit of frozen (lock sentence / settled sentence)
  ├─ removable = existing ∩ loadedCostIds − keep     (D1-A; whole existing − keep when key absent)
  ├─ (step 21 Task 2.3 adds costLineReviewFreezes here, over removable and changed lines — X29)
  ├─ create/delete permissions, releaseHistoricSplits, DELETE … WHERE bill_id IS NULL AND locked_at IS NULL
  │     AND rec_pay_locked_at IS NULL   (pin; row count must equal removable.length)
  ├─ rate seeds for inserted rows with no exchangeRate  (unchanged logic, now reached — D4-A)
  ├─ unratedCurrencies = currencies whose seed missed → assertUnratedFeeAllowed (D5-A, Task 1.2)
  ├─ UPDATE / INSERT (insert: settlementCompanyId = order.clientCompanyId when receivable and
  │     name = order.clientName — D7-A; update: keep id in step with the name on unfrozen lines)
  ├─ writeAuditRaw collectiveOrder.saveChildren (+ keptUnseen, unratedCurrencies)
  └─ return { ok: true, keptUnseen, unratedCurrencies }
  tx.commit
```

### 4.2 Rate seeding reaches the page (F1; Phase 1) → D4, D5

- **Web.** New rows start with `exchangeRate: ""` (`:294`) and the input's placeholder reads `From rate table`. `copyAcross` sets `exchangeRate: ""` on each copy (`:677-689`). In `save()`, a row **without an id** whose rate cell is blank omits the key; a row with an id keeps today's `r.exchangeRate || null` (a blanked saved rate still means "clear to 1", `:534`).
- **Gross-profit box before save.** A blank rate on an unsaved row counts as 1 (`feeLocalAmount`, `lib/expense.ts:376`). The box gains one line under the figures when any unsaved row in a currency other than the reporting currency has a blank rate: _"N unsaved fee(s) count at rate 1 until saved."_ (D4 option A; the box's figures stay honest about what they are.)
- **Server.** No change to the seed itself. After the seed loop, collect `unratedCurrencies` = distinct currencies of `needsSeed` rows whose key is absent from `rateSeeds` **and** whose currency differs from the reporting currency (same-currency needs no row; `resolveRate` short-circuits it). If `localCurrency` is null (no branch currency), treat every foreign `needsSeed` row as unrated. Then `await assertUnratedFeeAllowed(tx, organizationId, unratedCurrencies.length > 0)` (D5-A). The function takes `Db`; it is already called with a transaction handle at `quotation.ts:3210`.
- **Order form.** Unchanged: it already omits `exchangeRate`, so it gains D5's refusal and the `unratedCurrencies` output.

### 4.3 Delete only what the caller saw (F2; Phase 1) → D1, D2

- **Input.** `loadedCostIds: z.array(z.string()).max(2000).optional()` beside `costs`. 2000 is far above any order's fee count and bounds the payload.
- **Rule when present.**
  - `removable = existing.filter(r => loaded.has(r.id) && !keep.has(r.id))`.
  - `keptUnseen = existing.filter(r => !loaded.has(r.id)).length` (returned, and in the audit `after`).
  - `vanished = input.costs.filter(c => c.id && loaded.has(c.id) && !existing.some(r => r.id === c.id))`. Non-empty → CONFLICT (D2-A) before any write.
- **Rule when absent.** Exactly today's (`removable = existing − keep`, and an unknown id inserts). Keeps any external caller working; both web callers send the key after Phase 1.
- **Web.** Expense Entry keeps `baselineIds` (a ref set in the refill effect `:568-572` to the ids it loaded) and sends it. The edit form keeps `loadedCostIdsRef` set in its prefill (`order-form.tsx:970-985`) and sends it with `costs` (`:1733`). Both toast `keptUnseen` when > 0.
- **Why not a lock alone.** Step 15's `FOR UPDATE` serialises; the delete set still comes from the payload (Phase 0 F2).

### 4.4 Fee freezes on the order path (F4; Phase 2) → D6

```ts
// routers/collective-order.ts, inside saveChildren's cost leg (local helpers, not exported)
const locked = (r: Existing) => r.lockedAt !== null || r.recPayLockedAt !== null;
const frozen = (r: Existing) => settled(r) || locked(r);   // = the 0033 trigger's WHEN clause
```
- `wouldDropSettled` becomes `wouldDropFrozen`; messages split: settled keeps `:4213-4215`'s sentence; locked reads _"N fee(s) are locked and cannot be removed here; unlock them on Money > Cost lines first"_.
- `wouldEditSettled` uses `frozen`. For a **locked** line the allowed set is the ledger's (`LOCK_EXEMPT_COLS` has no caller-writable column, `cost-lines.ts:123-132`), so `remark`/`billingUnit` edits on a locked line are refused too — matching `singleFeeLockGate`. For a settled, unlocked line `SETTLED_EDITABLE` (`:4236`) stays.
- **Approval.** Not added here (D6-B, per X29). Task 2.1 extends the existing inline comparison (`:4247-4268`) to its `frozen` predicate and does **not** lift it; step 21 Task 2.3 lifts it into `changedKeys` and adds `costLineReviewFreezes` (under review and approved-and-locked, one query, the fees named), computing "removed" from this task's `removable` (loaded AND not kept, D1-A), not `existing − keep`. Accepted cost: between 20 P2 and 21 P2 an approved fee stays editable from the order page, as today.
- **Delete pin.** The DELETE gains `and(isNull(costLine.billId), isNull(costLine.lockedAt), isNull(costLine.recPayLockedAt))` and `.returning({ id })`; a short count → CONFLICT _"A fee was billed or locked while you were saving; reload and retry"_ (the ledger's `:431-436` pattern).
- **Under review.** Not added (step 21's `costLineReviewFreezes` covers it with the approved state, X29).
- **Web.** `isSettled` (`:155-156`) becomes `isFrozen`, adding `lockedAt`/`recPayLockedAt` (the `children` rows carry them); the bin's title names which (`:421-425`). `CostRecord` (`:103-121`) gains `lockedAt`, `recPayLockedAt`, `auditStatus`.

### 4.5 The fee carries the customer's company (F5; Phase 2) → D7, D8

- Order load adds `clientCompanyId: collectiveOrder.clientCompanyId`.
- `existing` adds `settlementCompanyId`.
- **Insert (receivable only).** After `callerFields` and the settlement-unit seed, compute `finalUnit = callerFields.settlementUnit ?? (seeded ? order.clientName : undefined)`. If `order.clientCompanyId` and `finalUnit?.trim() === order.clientName?.trim()`, add `settlementCompanyId: order.clientCompanyId`. Server-derived, merged after `dropDenied` like the name seed (`:4425-4484`).
- **Update (unfrozen receivable lines only; frozen lines cannot change the name, trigger).** When the caller's `settlementUnit` survived the strip: set `settlementCompanyId` to `order.clientCompanyId` if the name equals the client name, else `null`. When the key is absent, leave the column alone (patch rule).
- **Payables.** Never stamped (no vendor picker; D7-B is the later option).
- Nothing changes on `costInput` (no new caller-writable key), so no new field-deny surface.

### 4.6 What the page says (F3, F6; Phase 1; F7, F8; Phase 3) → D3, D9, D10, D11

- **Pure helper** `apps/web/src/lib/fee-rows.ts` [NEW]: `feeRowProblems(rows, side)` returns `{ index, kind: "unnamed-with-content" | "saved-unnamed" | "no-vendor" }[]`. "Content" = amount, unit price or tax rate ≠ 0, or quantity ≠ 1, or any text in billing unit / remark. `isUntouchedNewRow(row)` for the quiet drop.
- **Save.** Refuse (toast + row outline) on any `unnamed-with-content` or `saved-unnamed` (D3-A). Drop `isUntouchedNewRow` rows as today. `no-vendor` payables: inline warning line above the payable grid, save proceeds (D10-A). The copy must not promise that billing will refuse: no plan adds that refusal (X32).
- **After save.** Toast from the output: `keptUnseen` and `unratedCurrencies` (§2 Journeys 2–3). The banner (`:815-828`) renders from the **last save's** `unratedCurrencies` when present, and otherwise from today's client check with its target corrected (D11-A).
- **Total typed directly (D9-A).** In `patch`, when `key === "amount"` and `round(quantity × unitPrice, 6) ≠ amount`, set `unitPrice` to `""` (quantity stays). The saved line then carries `unit_price NULL`, and the invoice prints a lump sum instead of `1 × 0.00 = 500`. Matches step 11 D8-A ("carry both only when they multiply out").

### 4.7 Data model

**No schema change.** Columns read: `cost_line.exchange_rate`, `locked_at`, `rec_pay_locked_at`, `settlement_company_id`, `updated_at` (D1-B only); `collective_order.client_company_id`, `client_name`; `org_setting.fee_savable_without_rate`, `base_currency`. No migration under any option in §9 (D1-B would read `updated_at`, which exists).

### 4.8 API contracts

**`collectiveOrder.saveChildren`** (changed)
- Input: gains `loadedCostIds?: string[]` (max 2000). `costInput` unchanged.
- Output: `{ ok: true }` → `{ ok: true; keptUnseen: number; unratedCurrencies: string[] }`. Both are `0`/`[]` when `costs` is not sent. Additive: callers that read only `ok` are unaffected (web callers `order.$orderId.expenses.tsx:598`, `order-form.tsx:1733`; seed `seed/operations.ts:288` sends no costs).
- New refusals, all before any write:

| Condition | Code | Message |
|---|---|---|
| id in `loadedCostIds` and in `costs`, gone from the table | CONFLICT | "N fee(s) on this order were deleted by someone else after you opened it. Reload to see the current fees." |
| unrated new fee and `fee_savable_without_rate = false` | BAD_REQUEST | shared sentence (`fx-settings.ts:301-304`) |
| omit a locked / rec-pay-locked line | CONFLICT | "N fee(s) are locked and cannot be removed here; unlock them on Money > Cost lines first" |
| any edit of a locked line | CONFLICT | "N fee(s) are locked; unlock them on Money > Cost lines before editing" |
| touch an approved line under a locking flow | — | not in step 20 (D6-B, X29); step 21 Task 2.3's sentence after 21 P2 |
| delete pin short | CONFLICT | "A fee was billed or locked while you were saving; reload and retry" |

- Audit `after` gains `keptUnseen` and `unratedCurrencies`; `before` rows gain `lockedAt`, `recPayLockedAt`, `settlementCompanyId` (they are selected).

**`collectiveOrder.children`**: unchanged (already returns whole rows).

### 4.9 Key decisions (all Decided 2026-09-21 — §9 keeps the three approaches of each)

- Stale snapshot → D1 (Chosen A: `loadedCostIds`), D2 (Chosen A: refuse).
- Unnamed rows → D3 (Chosen A).
- New-row rate → D4 (Chosen A), unrated switch → D5 (Chosen A).
- Which freezes → D6 (Chosen B per X29: locks only; the approval half is step 21 D6-A).
- Company id → D7 (Chosen A), existing lines → D8 (Chosen A: report only).
- Total typed → D9 (Chosen A); blank vendor → D10 (Chosen A per X32: warning only, no refusal anywhere); banner → D11 (Chosen A).
- When it ships → D12 (Chosen A).

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- D1, D2, D3, D4, D5 and D12 settled (Wilfred, 2026-09-21: all A).
- Step 15 Phase 1 merged (D12-A), or its absence recorded so Task 1.1 adds the order-row lock.
- Re-read `saveChildren` by symbol at the base commit. Steps 11, 12 and 15 shift lines in `collective-order.ts` (step 11 Task 2.1 moves ~130 lines above it).
- 20-P1, 20-P3 and 20-P4 run by Wilfred (sizing only; none blocks code).

### Phase 1 — A save keeps the rate, keeps other people's fees, and drops nothing silently (F1, F2, F3, F6)

**Delivers:** Journeys 1 (rate half), 2, 3, 4 end to end.
**Dependencies:** D1–D5, D11, D12. Step 15 Phase 1 (lock) preferred.

- **1.1** `saveChildren`: add `loadedCostIds` to the input; compute `removable`, `keptUnseen` and `vanished` per §4.3 (D1, D2); return `keptUnseen`; add it to the audit `after`. Grep for `.for("update")` on the order load; add it only if step 15 Task 1.3 is not on the base (and say so in the commit). Files: `packages/api/src/routers/collective-order.ts`. · **Agent A (backend)**
- **1.2** `saveChildren`: collect `unratedCurrencies` and call `assertUnratedFeeAllowed` per §4.2 (D5); return `unratedCurrencies`; add to the audit `after`. Rewrite the `needsSeed` comment to say the page now omits the key. Files: `packages/api/src/routers/collective-order.ts`. · **Agent A (backend)**
- **1.3** Tests in `collective-order.costs.test.ts`, new `describe("saveChildren — stale snapshots and unrated fees")`:
  - `loadedCostIds` = [A]; table holds A and B (B inserted after "load"); payload [A edited] → A updated, B kept, `keptUnseen` 1.
  - payload omits A with `loadedCostIds` [A] → A deleted.
  - A deleted from the table; payload [A] with `loadedCostIds` [A] → CONFLICT, nothing written (count rows and `audit_log`).
  - key absent → today's behaviour (existing cases stay green untouched).
  - a USD receivable **without** `exchangeRate` + a payable copy without it → 4.7 / 4.5 (extends `:1524`).
  - no THB rate, switch default → saved at 1, `unratedCurrencies: ["THB"]`; switch off (`org_setting.fee_savable_without_rate = false`) → BAD_REQUEST, zero rows; same-currency MYR fee with no rate row → not unrated.
  - the existing "leaves an UNCOVERED window at the column default" (`:1569`) stays green (switch on).
  Files: `packages/api/src/routers/collective-order.costs.test.ts`. · **Agent A (backend)**
- **1.4** Web helper `fee-rows.ts` [NEW] with `feeRowProblems` / `isUntouchedNewRow` and a vitest file. Files: `apps/web/src/lib/fee-rows.ts` [NEW], `apps/web/src/lib/fee-rows.test.ts` [NEW]. · **Agent B (frontend)**
- **1.5** Expense Entry page:
  - new-row `exchangeRate: ""` with placeholder; `copyAcross` blanks the copy's rate; `save()` omits a blank rate on id-less rows (§4.2);
  - `baselineIds` ref set in the refill effect and sent as `loadedCostIds` (§4.3);
  - `save()` runs `feeRowProblems` and refuses per D3; drops only untouched rows; replace the `:626-628` comment;
  - success toast from `keptUnseen` / `unratedCurrencies`; banner per D11-A (target = reporting currency — read `orgSettings` base currency if the page can already reach it; otherwise the last-save list only, and drop the client check);
  - the pre-save footnote in the gross-profit box (§4.2).
  Files: `apps/web/src/routes/_next/order.$orderId.expenses.tsx`. · **Agent B (frontend)**
- **1.6** Order edit form: `loadedCostIdsRef` set in the children prefill and sent with `costs`; toast `keptUnseen`. Its own blank-name filter (`:1701`) gains the saved-row refusal from `feeRowProblems` (`saved-unnamed` only; the form has no quantity columns). Files: `apps/web/src/components/order-form.tsx`. · **Agent B (frontend)**

**Acceptance.**
- Journey 1 steps 2–5 in the browser store 4.7 / 4.5 (read back on Money > Cost lines).
- Journey 3's main case and the vanished-fee variant behave as written, in two tabs.
- Journey 4's three cases.
- `collective-order.costs.test.ts`, `counterparty-trim.test.ts`, `collective-order.parity.test.ts`, `expense.wave1.test.ts`, `fee-rows.test.ts` and the api `architecture.test.ts` pass; `bun run check-types` passes — judged by reading the output for `failed`, never the exit code.

### Phase 2 — Locked fees stay frozen here; the fee keeps the customer's company (F4 lock half, F5)

**Delivers:** Journeys 5 (lock half; its approved-row step comes from step 21 Phase 2, X29) and 6.
**Dependencies:** Phase 1 merged. D6 (B, per X29), D7, D8. Step 15 Task 1.1 is **not** needed for this phase (no approval call here). Step 21 Phase 2 merges after it (order 20 P1 → 20 P2 → 21 P2, X29).

- **2.1** `saveChildren` freezes per §4.4 (D6-B): `existing` selects the lock columns; `frozen`; split messages; locked-line edit refusal (extend the inline comparator at `:4247-4268` to `frozen`; do not lift it into `changedKeys` — step 21 Task 2.3 lifts it); keep `removable` (loaded AND not kept) named as-is, since step 21 Task 2.3 builds on it; DELETE pin with row count. No `assertPostApprovalEditableMany` call and no per-id fallback (X29). Update the allow-list comment above `architecture.test.ts:355-357` to name the lock guards (keys unchanged). Files: `packages/api/src/routers/collective-order.ts`, `packages/api/src/architecture.test.ts` (comment only). · **Agent C (backend)**
- **2.2** `saveChildren` company id per §4.5 (D7). Files: `packages/api/src/routers/collective-order.ts`. · **Agent C (backend)**
- **2.3** Tests:
  - `collective-order.costs.test.ts`: locked unbilled line omitted → CONFLICT (lock sentence), row still there; rec/pay-locked same; locked line amount edit → CONFLICT (not a raw 23514); locked line remark edit → CONFLICT; unlocked settled line remark edit → still succeeds (`SETTLED_EDITABLE`).
  - `counterparty-trim.test.ts` (it already seeds the client name): receivable insert with seeded name → `settlementCompanyId` = order's `clientCompanyId`; typed `"ACME "` → trimmed match → stamped; other name → null; payable named ACME → null; update away from the client name → cleared; order with no `clientCompanyId` → null; caller denied `costLine.settlementUnit` → seeded name and id both stamped.
  - One `createBill` case in `bills.terms.test.ts` style: a receivable saved through `saveChildren` on an order whose client has payment terms → the bill's due date is set.
  Files: `packages/api/src/routers/collective-order.costs.test.ts`, `packages/api/src/routers/counterparty-trim.test.ts`, `packages/api/src/routers/expense/bills.terms.test.ts`. · **Agent C (backend)**
- **2.4** Page: `isFrozen` with lock columns; bin title; `CostRecord` fields. Files: `apps/web/src/routes/_next/order.$orderId.expenses.tsx`. · **Agent D (frontend)**

**Acceptance.** Journey 5's lock half in the browser (lock a fee on Money > Cost lines, then open Expense Entry); Journey 6 read back on Money > Cost lines and on a bill made at step 22. The Phase 1 suites plus `bills.terms.test.ts` pass by reading the output.

### Phase 3 — The grid saves figures that add up, and says when a payable has no vendor (F7, F8)

**Delivers:** Journey 1 edge cases.
**Dependencies:** Phase 1 (the helper). D9, D10. Web only.

- **3.1** `patch` clears unit price when Total is typed and no longer equals quantity × unit price (D9-A); `fee-rows.test.ts` gains the case. Files: `apps/web/src/routes/_next/order.$orderId.expenses.tsx`, `apps/web/src/lib/fee-rows.ts`, `apps/web/src/lib/fee-rows.test.ts`. · **Agent E (frontend)**
- **3.2** The `no-vendor` inline warning above the payable grid (D10-A). The copy says the payable has no Settlement unit and names the row; it must not promise that billing will refuse — no plan adds that refusal (accepted gap, X32). Files: `apps/web/src/routes/_next/order.$orderId.expenses.tsx`. · **Agent E (frontend)**

**Acceptance.** Typing Total 500 on a fresh row saves `quantity 1, unit_price NULL, amount 500` (read back on Money > Cost lines); a payable without a vendor shows the warning and still saves.

**Small-plan note.** The step's page and handler are mostly sound (Phase 0 "Checked and sound"). Phase 1 carries the money and the data-loss fixes; Phase 2 carries the hand-off fixes; Phase 3 is polish (D9-A and D10-A chosen).

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.3 | `packages/api/src/routers/collective-order.ts`, `packages/api/src/routers/collective-order.costs.test.ts` | `packages/api/src/modules/setting/fx-settings.ts`, `packages/api/src/routers/expense/cost-lines.ts`, `packages/db/src/schema/{expense,setting}.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.4–1.6 | `apps/web/src/lib/fee-rows.ts` [NEW], `apps/web/src/lib/fee-rows.test.ts` [NEW], `apps/web/src/routes/_next/order.$orderId.expenses.tsx`, `apps/web/src/components/order-form.tsx` | `apps/web/src/lib/expense.ts`, `packages/api/src/routers/collective-order.ts` |

Opus for A: it changes which fee rows a money handler deletes, inside one transaction with a stale-entry-gated allow-list. A wrong set loses ledger rows.
Run mode: **A ∥ B(1.4) → B(1.5–1.6)**. 1.4 needs nothing from A. 1.5–1.6 wait for 1.1–1.2's output fields (`keptUnseen`, `unratedCurrencies`) because oRPC client types come from the router.
Serialization point: after A, `bunx vp test run packages/api/src/routers/collective-order.costs.test.ts packages/api/src/architecture.test.ts` and grep for `failed`. After B, `bun run check-types` and grep for `failed`.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | opus | high | 2.1–2.3 | `packages/api/src/routers/collective-order.ts`, `…/collective-order.costs.test.ts`, `…/counterparty-trim.test.ts`, `…/expense/bills.terms.test.ts`, `packages/api/src/architecture.test.ts` (comment) | `packages/db/src/migrations/0033_cost_line_immutable.sql`, `…/0062_payment_terms_due_date.sql`, `packages/api/src/routers/expense/cost-lines.ts` |
| Agent D (frontend) | frontend-engineer | sonnet | low | 2.4 | `apps/web/src/routes/_next/order.$orderId.expenses.tsx` | `packages/api/src/routers/collective-order.ts` |

Run mode: **C ∥ D** (D reads row fields `children` already returns).

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent E (frontend) | frontend-engineer | sonnet | low | 3.1–3.2 | `apps/web/src/routes/_next/order.$orderId.expenses.tsx`, `apps/web/src/lib/fee-rows.ts`, `…/fee-rows.test.ts` | `packages/api/src/modules/export/invoice-document.ts` |

Smell test: one owner per task · no file owned twice within a phase · `collective-order.ts` passes A → C strictly in sequence · the page passes B → D → E in sequence · every wait names its artefact (1.1/1.2 output fields).

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`, 2026-09-21)

- **`collectiveOrder.saveChildren`.** Web: `order.$orderId.expenses.tsx:598` (costs only), `order-form.tsx:1733` (all arrays). Seed: `seed/operations.ts:288` (containers and cargo only — unaffected by every change here). e2e: no spec calls it with `costs` (grep of `e2e/`). Tests: `collective-order.costs.test.ts`, `collective-order.guards.test.ts`, `collective-order.parity.test.ts`, `counterparty-trim.test.ts`, `expense.review.test.ts`, `expense.wave1.test.ts`. None asserts the output shape beyond `ok`; the new keys are additive.
- **Allow-list** `architecture.test.ts:355-357` (`saveChildren :: delete|insert|update(costLine)`): keys unchanged; comment updated in Task 2.1.
- **`assertUnratedFeeAllowed`.** Existing callers `cost-lines.ts:1262`, `quotation.ts:3002`, `:3210`. Signature unchanged.
- **`assertPostApprovalEditableMany`** (step 15, NEW there). Not called by this plan (X29); step 21's `costLineReviewFreezes` is the approval check on this path.
- **Readers of `cost_line.settlement_company_id`:** `createBill` (`cost-lines.ts:2638`), the bill due-date trigger (via `bill`, `0062…:150-153`), `invoices.ts:346-348` (via `bill`), `expense/shared.ts:1213` (projection comment). All already handle a non-null id; this plan only makes it non-null more often.
- **Readers of `cost_line.exchange_rate`:** `rollupCostLines` (`money.ts:188`), order list rollup (`collective-order.ts:1081-1113`), the page's box, exports. All multiply by it; values change from 1 to the table rate on **new** lines only.

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| New USD fee on Expense Entry | stored at 1 | table rate, or refused by switch | Web first: page omits the rate, old server seeds it (the seed exists today) — correct. API first: old page sends "1", new server honours it — today's behaviour until web lands. |
| Save while a fee was added elsewhere | added fee deleted | kept, toast | API first: old web sends no `loadedCostIds` → today's behaviour. Web first: old server strips the unknown key (zod object) → today's behaviour. |
| Save with a fee deleted elsewhere | re-created under a new id | CONFLICT | as above |
| Unnamed fee with an amount | dropped silently | refused by row | web only |
| Clear a saved fee's name | fee deleted | refused | web only |
| Edit a locked fee | raw 500 | CONFLICT sentence | API only |
| Omit a locked fee | deleted | CONFLICT | API only |
| Edit an approved fee (locking flow) | 200 | 200 until 21 P2, then step 21's CONFLICT (X29) | step 21's |
| Receivable to the client | name only | name + company id | API only |

### 7.3 Behaviour change for existing orgs and live orders

- **Every org, immediately after Phase 1 (web):** new foreign-currency fees from Expense Entry take the table rate. Profit on jobs entered after the deploy moves; jobs entered before do not (D8-A). Tell operations that the Exchange rate cell now fills after Save.
- **Orgs with `fee_savable_without_rate = false` (20-P3):** order-page saves of an unrated foreign fee start refusing, from both screens. Today they succeed.
- **Phase 2:** orders with locked unbilled fees (20-P6) can no longer drop those fees from the order page; any habit of "delete and retype a locked fee" breaks. Orgs using Cost review with the seeded locking flow (20-P7) lose editing of approved fees from the order page with step 21 Phase 2, not this phase (X29) — which is the flow's own setting.
- **Live orders:** no stored row changes. Existing lines keep their rate and their null company id.

### 7.4 Nullable assumptions

- `collective_order.client_company_id` nullable → no stamp (today's null).
- `collective_order.client_name` nullable → no seed, no stamp (unchanged).
- `cost_line.locked_at` / `rec_pay_locked_at` null = unlocked.
- `reportingCurrency` may return null (no base currency, no branch currency) → every foreign new fee is "unrated" and the switch decides (§4.2).
- `loadedCostIds` absent = legacy caller → today's reconcile.

### 7.5 Deployment coupling

- Each phase deploys on its own, in either order of server and web (§7.2 last column). Phase 1 is safest **server first** so the switch refusal and `keptUnseen` exist when the new page lands; web-first is also safe.
- Build `apps/web` before the deploy so a partial deploy does not split the stage (memory `alchemy-partial-deploy-splits-the-stage`).

### 7.6 Merge order against steps 04–27

| Plan / task | Shared code | Why step 20 goes after (or not) |
|---|---|---|
| **11 Task 2.1** | `collective-order.ts:2288-2418` moves out (~130-line shift above `saveChildren`) | Re-locate by symbol. **Must merge first.** |
| 11 Phase 3 | `modules/expense/bridge.ts` (quantity/unit price on converted lines) | No shared code. D9-A agrees with step 11 D8-A (both keep only products that multiply out). |
| **12 Phase 1** | `assignNumber` re-stamp of `cost_line.order_no` | Different handler; step 12 §7 names the residual `saveChildren` race, closed by step 15's lock. Either order; after is simpler. |
| 13 | `receive`/`reject`/`reopen` | No overlap. |
| **14** (`step-14-job-shape.md`) | states the `saveChildren` `orderNo` rule (no code); edits `order-form.tsx` (Tasks 2.2, 3.3: readiness panel, status select) | Different lines from Task 1.6 (prefill ref at `:970-985`, payload at `:1700-1733`). Second to merge rebases. Step 14 keeps its `orderNo` rule; this plan does not touch `orderNo`. |
| **15 Task 1.1** | `modules/audit/post-approval.ts` `assertPostApprovalEditableMany` [NEW there] | Not called after X29 (the approval half is step 21's). No ordering need for Phase 2. |
| **15 Tasks 1.2–1.3** | `saveChildren`: under-review freeze and post-approval for **content** arrays only (step 15 D2-B, D3-A), `.for("update")` on the load | Same handler, same transaction head. Step 20's cost-leg changes sit below step 15's guards. **Must merge first**; Task 1.1 greps for the lock. Step 15 D2-B's premise ("fees are governed by the cost-line review") becomes true with Task 2.1 (locks) and step 21 Phase 2 (review states, X29). |
| 15 Task 1.5 | `order-form.tsx` notice, Save `:2699` | Different lines; rebase. |
| **15 Phase 3 Task 3.3** | `costLines.create` `expense_entry` gate in `routers/expense/cost-lines.ts` | This plan does **not** edit `cost-lines.ts`; the gate call stays. Step 15 Phase 3 also adds gate calls in `routers/lading.ts`; untouched here. |
| 08 Tasks 3.1 | `post-approval.ts` optional message | Read only. |
| 04–07, 09, 10 | quotation code | No overlap. |
| 16–19 (plans written in parallel) | `lading.ts` `create`/`update` | No overlap. Plans 16–17 must keep step 15's gate calls. |
| **21** (no plan at writing) | cost-line review and its review-state freezes | X29: step 21 Task 2.3 adds `costLineReviewFreezes` (under review and approved-and-locked) on `saveChildren` and every other cost-line writer, computes "removed" from Task 2.1's `removable`, and lifts `changedKeys`. Order **20 P1 → 20 P2 → 21 P2**. |
| **22** | `createBill` blank-settlement-unit bucket (F8), order-filtered link (`:928`) | No plan adds the `createBill` refusal (accepted gap, X32); D10-A's warning is all there is. 22 P2 (the Cost Detail link) merges after 20 P3 (X36). |
| **25** | invoice buyer resolution (`invoices.ts:346-348`) | Reads the ids Phase 2 writes. After step 20 Phase 2, so its tests can use a real stamped line. |
| **27** | fee-rate vs bill-rate profit | After Phase 1, so the remaining difference is the genuine rate-date difference, not rate 1. |

**Required order:** 11 P2 → 12 P1 → 15 P1 → **20 P1** → **20 P2** → 21 P2 (X29) → (20 P3 any time after 20 P1; 22 P2 after 20 P3, X36). Placed as a wave after the steps 11–15 Wave 11 (crosscheck §6; crosscheck X40: Wave 17/18 in the runbook): **Wave 12 = 20 P1**, **Wave 13 = 20 P2 (+ 20 P3 in parallel, disjoint files: P3 is web-only and P2's web task 2.4 is the only page edit — run 2.4 and 3.x in one frontend session to keep the page single-owner)**.

### 7.7 Read-only production probes (SELECT only; Wilfred runs with the owner's override; none blocks Phase 1 code)

```sql
-- 20-P1 Rate-1 exposure: order fees in a foreign currency stored at rate 1 (F1, D8)
select cl.organization_id, cl.currency, coalesce(s.base_currency, t.currency) as reporting,
       count(*) filter (where cl.bill_id is null)     as unbilled,
       count(*) filter (where cl.bill_id is not null) as billed,
       sum(cl.amount)                                  as face_amount
from cost_line cl
join team t on t.id = cl.owning_branch_id
left join org_setting s on s.organization_id = cl.organization_id
where cl.order_id is not null
  and cl.exchange_rate = 1
  and cl.currency <> coalesce(s.base_currency, t.currency)
group by 1, 2, 3 order by 1, 2;

-- 20-P2 Of those, how many had a local rate on file at creation (i.e. the seed would have found one)
select cl.organization_id, count(*) as would_have_seeded
from cost_line cl
join team t on t.id = cl.owning_branch_id
left join org_setting s on s.organization_id = cl.organization_id
where cl.order_id is not null and cl.exchange_rate = 1
  and cl.currency <> coalesce(s.base_currency, t.currency)
  and exists (select 1 from expense_exchange_rate r
              where r.organization_id = cl.organization_id and r.rate_type = 'local'
                and r.from_currency = cl.currency
                and r.to_currency = coalesce(s.base_currency, t.currency)
                and r.start_time <= cl.created_at
                and (r.end_time is null or r.end_time > cl.created_at))
group by 1 order by 1;

-- 20-P3 Orgs that forbid unrated fees (D5 impact)
select organization_id, fee_savable_without_rate, base_currency
from org_setting where fee_savable_without_rate = false;

-- 20-P4 Fees deleted by order-page saves (F2 sizing): lines in before, absent from after
with s as (
  select a.organization_id, a.target_id, a.created_at, a.actor_user_id,
         array(select x->>'id' from jsonb_array_elements((a.before_json::jsonb)->'costLines') x) as before_ids,
         array(select x->>'id' from jsonb_array_elements((a.after_json::jsonb)->'costLines') x
               where x ? 'id') as after_ids
  from audit_log a
  where a.action = 'collectiveOrder.saveChildren'
    and a.before_json is not null and (a.before_json::jsonb) ? 'costLines')
select organization_id, count(*) as saves_that_deleted,
       sum(cardinality(array(select unnest(before_ids) except select unnest(after_ids)))) as lines_deleted
from s
where cardinality(array(select unnest(before_ids) except select unnest(after_ids))) > 0
group by 1 order by 1;

-- 20-P5 Lines whose breakdown does not multiply out (F7, D9)
select organization_id, count(*) as one_times_zero
from cost_line
where order_id is not null and quantity = 1 and unit_price = 0 and amount > 0
group by 1 order by 1;

-- 20-P6 Locked but unbilled order fees (F4; what Phase 2 starts protecting)
select organization_id,
       count(*) filter (where locked_at is not null)          as locked,
       count(*) filter (where rec_pay_locked_at is not null)  as rec_pay_locked
from cost_line
where order_id is not null and bill_id is null
group by 1 order by 1;

-- 20-P7 Cost review flows and approved order fees (F4, D6)
select organization_id, enabled, post_approval_editable
from audit_flow where trigger_type = 'cost_line' order by 1;
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'cost_line'
  order by resource_id, submitted_at desc, created_at desc)
select cl.organization_id, l.status, count(*)
from cost_line cl join latest l on l.resource_id = cl.id
where cl.order_id is not null
group by 1, 2 order by 1, 2;

-- 20-P8 Receivables that lost the client's company (F5, D7, D8)
select cl.organization_id,
       count(*) filter (where btrim(cl.settlement_unit) = btrim(co.client_name)) as name_is_client,
       count(*) filter (where btrim(coalesce(cl.settlement_unit,'')) <> btrim(coalesce(co.client_name,''))) as other_name,
       count(*) filter (where cl.bill_id is not null) as already_billed
from cost_line cl
join collective_order co on co.id = cl.order_id
where cl.attribute = 'receivable'
  and cl.settlement_company_id is null
  and co.client_company_id is not null
group by 1 order by 1;

-- 20-P9 Bills with no settlement company (the downstream effect; step 22/25 context)
select organization_id, attribute, count(*) as bills_without_company
from bill where settlement_company_id is null
group by 1, 2 order by 1, 2;

-- 20-P10 Order fees with a blank settlement unit (F8, D10)
select organization_id, attribute,
       count(*) filter (where bill_id is null)     as unbilled,
       count(*) filter (where bill_id is not null) as billed
from cost_line
where order_id is not null and coalesce(btrim(settlement_unit), '') = ''
group by 1, 2 order by 1, 2;
```

### 7.8 Blocking prerequisites

- Every decision settled 2026-09-21: D1–D5 and D12 (Phase 1); D6–D8 (Phase 2); D9–D10 (Phase 3); D11 (Task 1.5).
- Step 15 Phase 1 on the base, or the fallback named in Task 1.1 accepted (Phase 2 no longer depends on step 15, X29).
- No probe blocks code. 20-P3 must be read before the Phase 1 release note (it names who starts being refused).

## 8. Cross-Cutting Concerns

- **Errors.** Every new refusal is a sentence the operator can act on, with a count and, from the page, the row. Server refusals happen before any write; the page keeps the typing on error (it does not clear `dirty`, `:609`). The raw 23514 on locked edits disappears.
- **Testing.** PGlite router tests (1.3, 2.3); a pure web helper test (1.4, 3.1); §10 in the browser. The concurrency cases in 1.3 simulate "added after load" by inserting between the fixture and the call — PGlite cannot hold two connections, so the two-tab walk in §10 is the real proof.
- **Migration.** None.
- **Rollback.** Revert per phase. Phase 1: lines saved with a table rate keep it (correct data); `loadedCostIds` disappears and the old reconcile returns. Phase 2: stamped company ids stay (correct data; the trigger allows gaining one). Phase 3: web only.
- **Audit trail.** `collectiveOrder.saveChildren.after` gains `keptUnseen` and `unratedCurrencies`; `before` rows gain lock columns and `settlementCompanyId`. A refused save writes nothing, like every other refusal in this router.
- **Copy.** New sentences live in `saveChildren` and the page. Grep the worktree for "cannot be removed here" and "Fees saved" before declaring done (project rule: shared copy). The ledger's own lock sentences are not reused verbatim because they name one line.

**Performance & Scalability**
1. **Pagination.** Not applicable: one order's fees.
2. **SQL-side filtering.** `existing` and the DELETE are WHERE clauses; the stale check is a set difference over ≤ the order's fee count.
3. **N+1.** None added. The seed stays once per (currency, attribute). No approval query here (X29; step 21 adds its one `costLineReviewFreezes` query).
4. **Index coverage.** `cost_line_order_idx` (`expense.ts:190`) for `existing`.
5. **Write atomicity.** Every check and write stays in `saveChildren`'s one transaction; the DELETE pin turns a lost race into CONFLICT.
6. **Row locking.** The order row lock (step 15) serialises two saves of one order; `costLines.create` does not take it, which D1-A tolerates by design (unseen rows are kept).
7. **Connections/resources.** None new.
8. **Tenant isolation.** `existing` keeps the expense `applyScope`; `loadedCostIds` only narrows the delete set, it cannot widen it (an id outside `existing` is never deleted). The company id comes from the order row already loaded under scope.
9. **Payload size.** `loadedCostIds` ≤ 2000 ids; output adds two small fields.
10. **Hot path.** Operator-triggered saves only.

## 9. Decision Register, Open Questions & Risks

On 2026-09-21 Wilfred accepted the recommended option of every decision below, and every Proposed reading in `steps-20-26-crosscheck.md` X28–X40; where an X-item overrides this plan's own recommendation (D6, per X29), the Chosen line says so. Each keeps its three approaches.

### Decided — was blocking Phase 1

**D1: How does a save avoid deleting fees the caller never saw?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Tasks 1.1, 1.5, 1.6

| | Approach | Cost |
|---|---|---|
| **A** | **`loadedCostIds`:** the caller says which ids it loaded; only those can be deleted by omission; unseen lines are kept and counted (Recommended) (Chosen) | Small, additive, backward compatible (absent key = today). Both callers already hold the ids. Leaves same-line field conflicts as last-write-wins (Risks). |
| **B** | **Version token:** the caller sends the loaded set's `max(updated_at)` and count; any difference refuses the whole save with "fees changed — reload" | Catches field conflicts too. Every concurrent add blocks the other operator's whole grid, who must reload and retype; the edit form (open for hours) would refuse most saves that touch no fee. |
| **C** | **Explicit deletes:** drop "omitted = deleted"; callers send `deletedCostIds` | The cleanest contract. Changes the meaning of the payload for every caller at once (order form, any script); an old web against a new server would stop deleting anything, silently. |

- **Recommendation: A.** It closes the loss with the least change in meaning, and B's strictness lands on the operator who did nothing wrong.
- **Chosen: A** (Wilfred, 2026-09-21).
- **Where it lands:** §4.3, Tasks 1.1/1.3/1.5/1.6.

**D2: A fee the caller still shows was deleted elsewhere. What does Save do?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.1

| | Approach | Cost |
|---|---|---|
| **A** | **Refuse** the save with a reload sentence, before any write (Recommended) (Chosen) | No resurrection; the operator sees what changed. One extra refusal path. |
| **B** | **Skip** the vanished row and report it in the output | The rest saves; the operator may not notice the fee they edited is gone. |
| **C** | **Re-insert** it (today) | No refusal; silently undoes someone else's delete under a new id. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).

**D3: What happens to a fee row with no name?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Tasks 1.4–1.6

| | Approach | Cost |
|---|---|---|
| **A** | **Refuse rows with content or an id; drop only untouched new rows** (Recommended) (Chosen) | Closes the tracker item and the worse "cleared name deletes the fee" case; a stray empty row from a mis-click still vanishes quietly. Needs the "untouched" definition (§4.6). |
| **B** | **Refuse every blank-name row** | Simplest rule. A mis-click on **Costs name** blocks Save until the row is binned. |
| **C** | **Keep dropping, but say so** ("2 unnamed rows were not saved") and keep them on screen | No refusal. A cleared-name saved fee is still deleted, now with a toast after the fact. |

- **Recommendation: A.** It matches the SOP fix ("refuse the save and name the offending row") and the quotation grid's naming of a bad line.
- **Chosen: A** (Wilfred, 2026-09-21).

**D4: How does a new fee get its exchange rate?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Tasks 1.2, 1.5

| | Approach | Cost |
|---|---|---|
| **A** | **Blank cell, server seeds:** new rows and copies start blank; the page omits the key; the grid shows the seeded rate after Save; the profit box footnotes unsaved blank-rate rows (Recommended) (Chosen) | One seed implementation for both screens and `costLines.create`, including the time standard and 本位币. The rate is visible only after Save. |
| **B** | **Client-side resolve:** the page looks up the rate as the currency is chosen and fills the cell | The operator sees the rate while typing. Re-implements `resolveRate`, `effectiveRateDate` and `reportingCurrency` in the browser; they will drift, and the list endpoint cannot filter by period (Phase 0 F6). |
| **C** | **Server reinterprets:** treat a sent `"1"` on a foreign-currency insert as "not supplied" and seed | No web change. Makes a deliberately typed 1 impossible, and hides the rule in the server. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).

**D5: Does the org switch "无汇率时费用可保存" apply to the order screens?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.2

| | Approach | Cost |
|---|---|---|
| **A** | **Yes, as on Money > Cost lines:** an unrated new foreign fee is refused when the switch is off; when on, the save reports `unratedCurrencies` (Recommended) (Chosen) | One rule for every fee writer. Orgs with the switch off (20-P3) start seeing refusals on both order screens. |
| **B** | **Warn only** on the order screens | No new refusal. The switch keeps meaning "on one screen only". |
| **C** | **Leave as is** | No change; the bypass stays. |

- **Recommendation: A.** The switch's own sentence names fee entry as its subject.
- **Chosen: A** (Wilfred, 2026-09-21).

**D11: What does the FX banner check?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.5

| | Approach | Cost |
|---|---|---|
| **A** | **The server's answer:** after a save, show the banner from `unratedCurrencies`; before the first save, keep a client check with the target corrected to the reporting currency and `rateType: "local"` sent (Recommended) (Chosen) | The post-save banner is exact. The pre-save check stays approximate (it cannot apply the time standard). |
| **B** | **Post-save only:** remove the client check | Never wrong; no warning until the first Save. |
| **C** | **Fix the client check only** | No server field needed; still guesses the date. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).

**D12: When does Phase 1 ship relative to step 15?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: the base branch for `wt-step20`

| | Approach | Cost |
|---|---|---|
| **A** | **After step 15 Phase 1** (Wave 12 in §7.6), reusing its lock and helper (Recommended) (Chosen) | No duplicated guard; one owner for the order-row lock. Rate-1 fees keep accumulating until then (20-P1 sizes it). |
| **B** | **Hotfix before step 15**, adding the lock itself; step 15 Task 1.3 greps and skips | The money defect closes several waves earlier. Step 15 must rebase over a changed `saveChildren` head and its task text says "grep first" already. |
| **C** | **Split:** ship only the web half of F1 (Task 1.5's rate omission) as a hotfix now — the server seed already exists — and the rest after step 15 | Closes rate 1 immediately with a web-only diff and no server change. The switch (D5) and F2/F3 wait. |

- **Recommendation: A**, with C worth taking if 20-P1 shows material exposure.
- **Chosen: A** (Wilfred, 2026-09-21).

### Decided — was blocking Phase 2

**D6: Which fee freezes does the order path honour?** · Status: **Decided 2026-09-21 — Chosen: B (per X29)** · Blocks: Task 2.1

| | Approach | Cost |
|---|---|---|
| **A** | **The database trigger's definition plus Cost-review approval:** locked and rec/pay-locked lines are frozen like settled ones (no drop, no edit; locked lines refuse remark too, as the ledger does), and approved lines under a locking flow are refused (Recommended) | Same answer as Money > Cost lines and the trigger, no raw 500. Step 15 D2-B's premise holds. One batched approval query per save. |
| **B** | **Locks only** (no approval check) (Chosen) | Smaller; approved fees stay editable from the order page — the step-21 hand-off stays severed. |
| **C** | **Refuse the whole save** when any fee on the order is locked or approved | Simplest server rule; blocks adding a new fee to any order with one locked line. |

- **Recommendation: A.**
- **Chosen: B** (Wilfred, 2026-09-21); crosscheck X29 — step 21 owns every review-state freeze (under review and approved-and-locked) on every cost-line writer, `saveChildren` included, through `costLineReviewFreezes` (21 D6-A); step 20 keeps the locks, the delete pin and the company id. The hand-off severance B names is closed by 21 P2; between 20 P2 and 21 P2 an approved fee stays editable from the order page, as today (accepted).

**D7: How does a fee keep the customer's company record?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 2.2

| | Approach | Cost |
|---|---|---|
| **A** | **Stamp from the order:** a receivable whose Settlement unit equals the order's client name gets `client_company_id`; changing the name away clears it (Recommended) (Chosen) | No UI, no new input key, no migration; covers the page's default path and the edit form. Payables and receivables billed to a third party stay id-less. |
| **B** | **Company picker** in the Settlement unit column on both grids, sending `settlementCompanyId` | Covers vendors and third parties. A new control, a new caller-writable key (field-deny surface), and a same-org validation. |
| **C** | **Name lookup** against the company master on every save | Covers known vendors automatically. Duplicate or near-duplicate names pick the wrong company silently. |

- **Recommendation: A**, with B as a later step once the vendor side needs terms.
- **Chosen: A** (Wilfred, 2026-09-21).

**D8: What about fees already saved at rate 1 or without a company?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: nothing in code

| | Approach | Cost |
|---|---|---|
| **A** | **Report only:** Wilfred runs 20-P1, P2, P8 and hands the lists to accounting (Recommended) (Chosen) | No production write. Unbilled lines can be corrected on Money > Cost lines. |
| **B** | **One-off script** for **unbilled, unlocked** lines: set `settlement_company_id` where the name is the order's client; re-seed rates where 20-P2 finds a covering rate | Fixes the backlog. A production data change, and re-seeding rates moves reported profit on past jobs. |
| **C** | **Nothing** | Past jobs keep wrong figures and id-less bills. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).

### Phase 3 (not blocking Phases 1–2)

**D9: Total typed directly** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 3.1

| | Approach | Cost |
|---|---|---|
| **A** | **Clear unit price** when Total no longer equals quantity × unit price (Recommended) (Chosen) | The invoice prints a lump sum, never `1 × 0.00 = 500`. Consistent with step 11 D8-A. |
| **B** | **Derive unit price** = Total ÷ quantity | Every line prints a breakdown; long decimals appear (500 ÷ 3). |
| **C** | **Leave** | 20-P5 lines keep printing a wrong product. |

- **Chosen: A** (Wilfred, 2026-09-21).

**D10: A payable with no vendor** · Status: **Decided 2026-09-21 — Chosen: A (per X32)** · Blocks: Task 3.2

| | Approach | Cost |
|---|---|---|
| **A** | **Warn on the page**; no plan refuses at bill creation (accepted gap, X32) (Recommended) (Chosen) | The operator is told at entry; no new refusal here. |
| **B** | **Refuse the save** | Blocks booking an estimated cost before the vendor is known. |
| **C** | **Nothing here**; step 22 only | Smallest; the operator learns at billing time. |

- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X32 — the warning ships alone and its copy must not promise that billing will refuse. No plan adds a blank-settlement-unit refusal in `createBill` (step 22 has none; a follow-up is unassigned, sized by 20-P10), so blank-vendor payables still group into one bill addressed to nobody.

### Risks

- _Same-line concurrent edits stay last-write-wins_ → low (two people editing one fee's figures in the same minute) → **named, not fixed (D1-B would); `audit_log` keeps both versions.**
- _Step 15 Phase 1 not merged when Phase 1 starts_ → medium → **Task 1.1 greps and adds the lock; Phase 2 no longer depends on step 15 (no approval call, X29).**
- _Approved fees stay editable from the order page between 20 P2 and 21 P2_ → certain, for one wave → **accepted (X29); as today; step 21 Phase 2 closes it.**
- _Blank-vendor payables still group into one bill addressed to nobody_ → sized by 20-P10 → **accepted known gap (X32): D10-A warns only, and no plan adds a `createBill` refusal.**
- _Orgs with the switch off start seeing refusals_ → certain for 20-P3 orgs → **release note names them; the refusal sentence names the setting.**
- _Profit on new jobs moves once rates are real_ → certain, intended → **tell accounting; D8-A leaves old jobs alone so the change is dated.**
- _The edit form's cost editor diverges further from Expense Entry_ → low → **Task 1.6 gives it `loadedCostIds` and the saved-row name refusal; it keeps omitting quantity columns by design.**
- _Line numbers drift_ (steps 11, 12, 14, 15 edit `collective-order.ts` and `order-form.tsx`) → certain → **every task locates by symbol (`saveChildren`, `costLineExtras`, `needsSeed`, `copyAcross`, `loadedChildrenForRef`).**
- _PGlite cannot prove two-connection races_ → certain → **§10 Edge case 2 proves Journey 3 with two tabs on the dev branch.**

### SOP text vs code (Phase 0 wins)

1. **Role:** "collectiveOrder.update to save (saveChildren requires COLLECTIVE_ORDER.update)". Also required: `expense.costLine.update` **and** `expense.costLine.read` for any save with fees, `expense.costLine.create` to add one and `expense.costLine.delete` to remove one (`collective-order.ts:4110-4137`, `:4287-4297`).
2. **Golden step 3:** "Exchange rate 1" is true of the page, and is the defect F1 — the server would have seeded the table rate if the page sent nothing (`:4358-4362`).
3. **Golden step 8 / before-list:** "An exchange rate exists for the current month … or the FX banner will warn". The banner checks against the branch currency, not 本位币, and any rate of any type or period silences it (`:730-741`, `exchange-rate.ts:224-236`). The rate actually used is chosen by the shipment's dates (`:4368-4372`).
4. **Golden step 9 / pitfall:** "Rows with an empty Name of cost are silently dropped". True, and wider: clearing a **saved** fee's name deletes it (`:629`, `:4286`).
5. **Pitfall:** "Rows already billed, invoiced or written off are read-only and cannot be removed here". True, but locked and rec/pay-locked fees are **not** read-only here and can be deleted (`:155-156`, `:4189-4190`; trigger is update-only).
6. **Writes:** "reconciled by id: … rows removed from the grid deleted". Also deleted: every fee added by anyone else after the page loaded (F2).
7. **Writes:** "Settlement unit stored as a plain string". True; and `settlement_company_id` exists on the row and is never set on this path (F5). The break's "the company reference is not even an accepted field on this path" is true (`costInput` `:388-477`).
8. **Fields:** "Settlement unit … Hidden if the role is field-masked". Only when the order already has a fee (`:557-565`); flagged.
9. **Result:** "Next: step 21, submit the fees for Cost review". After approval the fees remain editable here under the seeded locking flow (F4) until step 21 Phase 2 (X29).
10. Everything else in the step 20 card (routes, entry buttons, Loading… guard, defaults, recompute, Copy to payable blanking, Copy to receivables keeping the unit, one Save for both grids, the locked-order refusal and banner, the Expense entry gate, the export button being disabled while dirty, the inert Special checkboxes and the Interest dash) matches the code.

## 10. Verification & Proof

**App URL:** http://localhost:3101 (server :3000). One worktree's servers at a time.
**Preconditions:**
- A seed-parity org (`e2e/fixtures/seed-cli.ts seed-parity <runId>`) with cookies for **ops** and **accounting**. Announce the active org before driving the browser (memory `shared-session-active-org`).
- Branch currency MYR, no org base currency (and a second run with base currency SGD for Edge case 5).
- Local rates USD→MYR receivable 4.70 / payable 4.50 covering the order's ETD; no THB rate.
- Order **O1**: saved, unlocked, client ACME linked to a company with payment terms 30 days.
- Order **O2**: one unbilled fee locked on Money > Cost lines. (The approved fee is step 21 §10 Journey 2's precondition, X29.)
- `org_setting.fee_savable_without_rate` toggled per Edge case 3.

**Migrations:** none.

**Unit / integration tests to add or change** (run each; read the output for `failed`):
- `packages/api/src/routers/collective-order.costs.test.ts`: stale-snapshot cases (kept, deleted, vanished → CONFLICT, key absent); seed reached without `exchangeRate` on both legs; unrated → switch on/off; same-currency not unrated; locked/rec-pay-locked drop and edit refusals; settled remark edit still allowed. (Approved-line cases are step 21 Task 2.3's, X29.)
- `packages/api/src/routers/counterparty-trim.test.ts`: company-id stamp matrix (§5 Task 2.3).
- `packages/api/src/routers/expense/bills.terms.test.ts`: bill from an order-page receivable gets a due date.
- `apps/web/src/lib/fee-rows.test.ts` [NEW]: untouched vs content rows, saved unnamed, no-vendor, Total-typed rule.
- `packages/api/src/architecture.test.ts`: passes after every task.

**Golden path (Journey 1):**
1. As ops, open O1 from the Sea Export ledger → **Expenses** → Save reads **Loading…**, then **Save**.
2. **Costs name** in Receivable detail → Exchange rate blank with "From rate table"; Settlement unit ACME.
3. Ocean Freight, quantity 1, unit price 1000, USD → Total 1000. The profit box shows the "count at rate 1 until saved" footnote.
4. **Copy to payable** → copy with blank Settlement unit and blank rate; type "Haulier Sdn Bhd".
5. **Save** → _"Fees saved"_; the receivable shows 4.7, the payable 4.5; the box reads receivable 4,700.00, payable 4,500.00, gross profit 200.00.
6. On Money > Cost lines, filter O1's job number → both lines show the same rates; the receivable's row detail shows the company link (Phase 2).

**Edge case 1: unnamed rows (Journey 4).** Add a row, type Total 250, no name → Save refused naming "Receivable row 2"; add an untouched row → Save succeeds and the untouched row is gone; clear the name of the saved Ocean Freight → Save refused.
**Edge case 2: a fee added elsewhere (Journey 3), two tabs.** Tab 1: O1 Expense Entry, type into a new row (dirty). Tab 2: Money > Cost lines → **Add** a receivable on O1. Tab 1: **Save** → toast "1 fee added elsewhere … was kept"; the grid shows it. Repeat with tab 2 **deleting** a fee tab 1 shows → tab 1 Save refused with the reload sentence; nothing changed on Money > Cost lines. Repeat with the O1 **edit form** open in tab 1 since before the add → header Save keeps the added fee.
**Edge case 3: unrated currency (Journey 2).** Add a THB fee → Save → saved at 1 with the THB notice and banner. Turn the switch off → add another THB fee → Save refused with the switch's sentence; the typed row stays.
**Edge case 4: locked (Journey 5).** Open O2 → the locked row is read-only with the lock title; a raw RPC edit or delete of it → refused with the lock sentence; no 500 in the network panel. The approved half moved to step 21 §10 Journey 2 (X29).
**Edge case 5: base currency set.** With org base currency SGD and no USD→SGD rate, the banner names USD before saving, and after Save the notice names USD; with USD→MYR only, no MYR-target warning appears.
**Edge case 6: Total typed (Phase 3).** A new row with Total 500 typed → after Save, Money > Cost lines shows quantity 1, unit price blank, amount 500; the invoice preview prints a lump sum.
**Edge case 7: payable without vendor (Phase 3).** Copy to payable and Save without typing a vendor → the warning shows above Payable details and does not promise a billing refusal (X32); the save succeeds.

**Regression check.**
- The order edit form's Save still saves header, containers, cargo and fees together; a header-only save with no fee changes needs no create/delete node (existing test `:567` describe).
- A field-masked role still cannot write Settlement unit, and its receivables still get the client name (and now id) seeded (`counterparty-trim.test.ts`, costs test `:1086`).
- Billed lines: remark and billing unit still editable; money edit still refused with today's sentence.
- `Export documents` still disabled while dirty and enabled after Save.
- Locked order: Save disabled, banner shown, server "Order is locked" unchanged.

**Mobile:** at 400px the page scrolls the grids inside their own `overflow-x-auto` boxes (`:334`); the new warning lines wrap without horizontal page scroll.

**Readiness: 7/10.** Phase 1 is small and located to the line, and two of its four fixes are web-only on top of server code that already exists. Held back by: Phase 1 waits on step 15 Phase 1 for the order-row lock; the two-tab race can only be proven in the browser; D5 changes behaviour for orgs Wilfred has not yet sized (20-P3); and the live damage (20-P1, P4, P8) is unknown until the probes run.

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and the Proposed reading of every cross-plan item in `steps-20-26-crosscheck.md` (X28–X40). Each §9 entry keeps all three approaches; only the status, the Chosen line and the text that described a decision as open were changed, plus the task text the overrides below required.

**Chosen:** D1-A · D2-A · D3-A · D4-A · D5-A · D6-B (per X29; recommended was A) · D7-A · D8-A · D9-A · D10-A (per X32: warning only) · D11-A · D12-A.

**Crosscheck overrides as they land in this plan.**
- X29 → D6 narrows to B (locks only); the approval half is step 21 D6-A's `costLineReviewFreezes`. Edited: header, Phase 0 F4 closing line and adjacent item 2, precedent list, §1 goal, success criteria, out of scope and assumptions, Journey 5 step 2, §3, §4.1 diagram, §4.4 (Approval and Under review bullets), §4.8 refusal table, §4.9, Phase 2 heading/dependencies (step 15 Task 1.1 no longer needed), Task 2.1 (no `assertPostApprovalEditableMany` call, no per-id fallback; extends the inline comparator to `frozen`, does not lift `changedKeys`; `removable` kept as named), Task 2.3 (approval cases dropped), Agent C reads, §7.1, §7.2, §7.3, §7.6 (15 Task 1.1, 15 Tasks 1.2–1.3 and 21 rows; required order 20 P1 → 20 P2 → 21 P2), §7.8, §8 items 3–4, Risks, SOP item 9, §10 preconditions (O2), test list and edge case 4 (approved half → step 21 §10 Journey 2), Readiness. Accepted cost: between 20 P2 and 21 P2 an approved fee stays editable from the order page, as today.
- X32 → D10-A ships its warning only; its copy must not promise that billing will refuse; no plan adds the `createBill` refusal (accepted gap, sized by 20-P10). Edited: Phase 0 F8, §1 out of scope, §4.6, Task 3.2, §7.6 step 22 row, D10 row A and Chosen line, Risks, §10 edge case 7.
- X36 → 20's page edits (Tasks 1.5, 2.4, 3.1–3.2) run in one lane, as §7.6 already asked; 22 P2 (Cost Detail link at `:928`) merges after 20 P3. Added to §7.6's step 22 row and required order.
- X40 → Wave 12/13 wording in §7.6 and D12 left as written; one parenthetical "(crosscheck X40: Wave 17/18 in the runbook)" added in the §7.6 order sentence, which X29 changed anyway.
- X28, X30, X31, X33, X34, X37 → do not touch this plan (step 20 locks no `cost_line` rows itself; its only `FOR UPDATE` is step 15's order-row lock). X35 → this plan adds no case to `expense.concurrency.test.ts`; no text change. X38 → no migration under any chosen option; no text change. X39 → the "SOP text vs code" list stays an accepted unowned gap; this plan edits no SOP.
