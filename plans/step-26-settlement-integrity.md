# Step 26 — a settlement books only the exchange difference that happened, one receipt cannot be spent twice, a receipt settles only what is owed to us, a mistyped payment can be put right, and a void says why

**SOP step:** 26 "Record the money and settle it" · **Money > Payments** (`/expenses/payments`, page title **Pay and Receive**) → **Add** → sheet **Add Payment / Receipt** → row icon **Verify** → dialog **Verify — <payment no>** · undo on **Money > Write-offs** (`/expenses/write-offs`, page title **Write-off Management**) → row icon **Void write-off**
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` (`feat/new-layout`), 2026-09-21. The `nct-layout` working tree is checked out at `ea1560e7` and `git diff --stat 6bb3a1bf HEAD -- packages apps` is empty, so every `file:line` below matches `6bb3a1bf`. Every citation was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Standard. Two money handlers (`writeOffs.verify`, `writeOffs.reverse`), one new payment verb (`payments.update`), two pages, one optional read on `invoices.list`. **No migration under any recommended option.** Phase 2 changes the lock order of two money transactions and must be proven on real Postgres, not PGlite.
**Cross-plan items owned:** the ledger items **`fx-gain-loss`** (repair `s26` only), the write-off-reversal half of **`bill-rewrite`** ("reversing one needs none"; step 23 took the bill-total half and hands this half over by name, `step-23-bill-approval-integrity.md:8`), and the settlement half of **`money-by-hand`** ("is this invoice paid?"; step 25 takes the e-mail half). The lock order for the three ledger writers is shared with steps 24 and 25 and is settled by crosscheck X30 (D5-A): payment → cost lines `(created_at, id)` → bill(s) by id (§7.6, D5).
**Status:** every decision in §9 is **Decided** (Wilfred, 2026-09-21: the recommended option throughout, with the crosscheck X-item additions listed in "Decisions settled" at the end). Probe re-checks named in §5 and §9 still stop their task for a re-plan if they contradict a choice.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope` at `procedures/org.ts:429`). Governed writers in `packages/api/src/modules/governed/writer.ts` (scoped `FOR UPDATE` load at `:234`, gates, pinned write). Drizzle schema in `packages/db/src/schema`, SQL migrations in `packages/db/src/migrations` (journal ends `0065_quotation_send_decision`). TanStack Router file routes in `apps/web/src/routes/_next`. zod on both sides. vitest on PGlite (`pushTestSchema`), plus the real-Postgres suite `packages/api/src/routers/expense.concurrency.test.ts`, gated on `DATABASE_URL_TEST` (`:26`, `describe.skipIf` at `:65`). Dev: web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Entry.** Nav `Money > Payments` and `Money > Write-offs`, both `p: "expense:read"` (`apps/web/src/components/shell-next/nav.ts:233-234`). The lists gate on `expense.payment.read` / `expense.writeOff.read` (`routers/expense/payments.ts:216`, `routers/expense/write-offs.ts:170`).
  - **Who.** The nodes `expense.payment.create|delete`, `expense.writeOff.verify|reverse` (`modules/expense/permissions.ts:47-55`, `:160-185`) are held through the `expense` root by **admin, branch-manager and accounting** (`packages/api/src/roles.ts`, `MODULE_ROLE_GRANTS`). Director holds `expense.payment.read` and `expense.writeOff.read` leaves only; sales and ops hold none. There is **no cashier role** in the app; the SOP's "Cashier" is a job title that maps to accounting.
  - **Record.** `PaymentFormSheet` (`apps/web/src/routes/_next/expenses/payments.tsx:176`). Fields: Attribute (default `receipt`), Pay and Receive Date (default today), Settlement Unit (required free text, placeholder "Counterparty name", `:291-306`), Our Account, Other Account, Financial Voucher No., Receipts and Payment Way, Currency, Price, Bank Slip Number, Post Time, Note. Currency and Price are required by the schema (`:168-169`) but not starred. `CompanyPicker` is imported (`:43`) and never rendered, so `settlementCompanyId` is always `null` (`:201`, `:217`). **The sheet sends no `exchangeRate`** (`:211-226`).
  - **Server create.** `payments.create` (`routers/expense/payments.ts:269`) trims and requires `settlementUnit` (`:288`), refuses a caller denied `payment.settlementUnit` (`:327-332`), allocates `PAY…` in the same transaction (`:341-342`) and stores **`exchangeRate: input.exchangeRate ?? "1"`** (`:363`); the comment at `:358-362` records that not seeding it is a decision pending an eyun capture. There is **no `payments.update`** (`:375-377`: "Removed until an edit journey with a write-off/balance guard … is built").
  - **Delete.** `payments.delete` (`:379`) runs `paymentWriter.remove`, whose gate `paymentUnsettledGate` (`:134-155`) refuses a payment with `writtenOffAmount > 0` **and also any payment with a voided write-off** (`:141-152`: "those are a permanent record and deleting the payment would destroy them"), because `write_off.payment_id` is `ON DELETE CASCADE` (`packages/db/src/schema/expense.ts:599` onward). The row's Delete icon is disabled only while `writtenOffAmount > 0` (`payments.tsx:909-910`).
  - **Verify dialog.** `VerifyDialog` (`payments.tsx:478`). On open it prefills Amount with `amount − writtenOffAmount` and Account with `selfAccount` (`:495-505`). The Bill picker is `bills.list({ settlementUnit, limit: 200 })` (`:517-524`) and the Cost Line picker is `costLines.list({ settlementUnit, limit: 200 })` (`:526-531`) filtered to `billId` set (`:552`). **Neither picker filters by attribute or status**, so payable and receivable bills, and bills already fully settled, are all offered. The 核销汇率 field shows only across currencies (`:680`). **Verify** sends `paymentId`, `billId | costLineId`, `amount`, `method`, `account`, `person`, and `exchangeRate` only across currencies (`:722-731`).
  - **Server verify.** `writeOffs.verify` (`write-offs.ts:264`), in order:
    1. loads the payment **on `context.db`, outside any transaction, no lock** (`:296-300`); refuses `amount > amount − writtenOffAmount` on that read (`:302-307`);
    2. resolves the target: a single line (must be billed, `:322-326`; must agree with a given bill, `:333-337`) or every line of the bill **ordered by `createdAt` only** (`:347-351`), again outside the transaction;
    3. checks the `bill.write_off` gate (`:366-368`) and, for a line target, `cost_line.write_off` (`:372-380`), **both on `context.db`**;
    4. **never compares the payment's direction with the bill's attribute** — `attributeForDirection(pay.direction)` is used only to pick the FX leg (`:444`, `:479`);
    5. resolves the rate before the transaction (`:416-484`): across currencies the operator's 核销汇率, else the org `write_off` rate, else BAD_REQUEST (`:457-461`); same currency, the `write_off` rate from the payment currency to the branch reporting currency (`:473-483`; `resolveRate` returns `"1"` for a same-currency pair, `exchange-rate.ts:175`);
    6. spreads the amount over the target lines from the **stale** line read (`:527-563`), computes `applied` and `appliedPayment` (`:566-586`);
    7. opens the transaction (`:610`): increments each line and derives its status in SQL (`:612-625`), increments the payment (`:627-636`), reads the bill's lines back and decides coverage (`:646-652`), computes 汇兑损益 (`:686-693`), advances the bill to `done` if it was `invoiced`, else `written_off` (`:694-708`), inserts `write_off` and `write_off_line` (`:712-789`) and the audit row (`:791-825`).
  - **Server void.** `writeOffs.reverse` (`:867`): loads the row outside the transaction (`:879-888`), checks `bill.cancel_write_off` on `context.db` (`:894-896`), reads the currencies (`:923-948`), computes `paymentGiveBack = amount ÷ write_off.exchange_rate` across currencies (`:949-957`), then in one transaction: claims the row `WHERE voided_at IS NULL` (`:971-984`), decrements the payment (`:988-999`), gives each line back its recorded split (`:1011-1061`) or the legacy reconstruction (`:1062-1104`), reverts the bill `done → invoiced`, `written_off → open` and unwinds the stamped FX (`:1105-1132`). `reason` is accepted (`:869`, optional) and **the page never sends it** (`write-offs.tsx:456`, `reverse.mutate({ id })`).
  - **Seed.** "Bill review" ticks `input_invoice_no` and `write_off`, not `cancel_write_off` (`modules/audit/seed.ts:176-193`, gates at `:192`). `seed/money.ts` creates two USD payments with no `exchangeRate` (`:300-330`).

- **Finding F1 (money, highest): every cross-currency settlement of a foreign-currency receipt books an exchange gain or loss that never happened — confirmed by reading and by arithmetic.**
  - Across currencies `settledRate = appliedPayment × payment.exchangeRate ÷ applied` (`write-offs.ts:687-688`). The sheet never sends a rate, so `payment.exchange_rate` is `1` for every payment recorded in the app (`payments.ts:363`).
  - Worked case: branch reporting currency MYR; bill `NCT-B-…` receivable MYR 4,200.00 (`bill.exchange_rate` NULL, read as 1, `:686`); receipt USD 1,000.00; operator types 核销汇率 4.2. Then `applied = 4200`, `appliedPayment = 1000`, `settledRate = 1000 × 1 ÷ 4200 = 0.238`, and `fx = (0.238 − 1) × 4200 = −3,200.00` MYR is added to `bill.fx_gain_loss` and stamped on the write-off (`:700-705`, `:773`). The true figure is 0: the operator's rate *is* the conversion, and the bill is in the reporting currency.
  - The same fault has a second route that does not need a cross-currency write-off: a **USD receipt against a USD bill whose `bill.exchange_rate` is NULL** (`createBill` leaves it NULL when no bill rate is on file, `cost-lines.ts:2595-2614`, `:2642`). Then `settledRate` is the resolved USD→MYR `write_off` rate (say 4.3) and `billRate` reads 1, so a **gain of 3.3 × the amount** is booked.
  - Where it goes: `bill.fx_gain_loss` feeds the month-end export (`modules/export/month-end.ts:318`, `:359`) and `write_off.fx_gain_loss` feeds the financial report (`routers/report.ts:2891`), so step 27's profit figures carry it.
  - The only existing FX test sets `payment.exchange_rate = 4.5` by raw UPDATE first (`expense.cross-currency-writeoff.test.ts:531-561`), so the path the app actually produces is untested. `seed/money.ts:300-330` produces it on every seeded org.
  - A receipt in the reporting currency is correct (its rate of 1 is true), which matches the ledger item's wording.

- **Finding F2 (money, concurrency): one receipt can be spent twice, and one line can be settled twice — confirmed by reading; not reproducible on PGlite.**
  - The over-balance guard reads the payment outside the transaction (`:296-307`); the payment increment is atomic (`:634`) but **unconditional**, and there is deliberately no `written_off_amount <= amount` CHECK (`schema/expense.ts:585-589`). Two verifies of the same MYR 1,000.00 receipt against two different MYR 1,000.00 bills both pass the guard and both commit: the payment ends at `written_off_amount = 2000` and two bills read settled on MYR 1,000.00 of money.
  - The spread uses each line's **stale** remaining balance (`:538-540`). Two verifies from two different receipts against the same MYR 1,000.00 bill both apply 1,000.00; the line ends at `written_off_amount = 2000` (no CHECK on the line either, `:237-245`) and the second receipt's money is silently absorbed as over-settlement instead of staying unapplied.
  - Two single-line verifies on the two lines of one bill each read the bill's lines inside their own transaction (`:646-652`) without seeing the other's uncommitted increment, so neither sees full coverage: **the bill stays `open`/`invoiced` with every line settled**.
  - Lock order today: verify touches lines, then the payment, then the bill (`:612-707`); reverse touches the payment, then lines, then the bill (`:988-1131`). A verify and a void on the same receipt and bill can deadlock, and Postgres answers one with a raw 500.
  - The `write_off` gate is read on `context.db` before the transaction (`:367`), so a bill re-submitted for review between the read and the write is still settled. Step 23 names steps 24 and 26 as owners (`step-23-bill-approval-integrity.md:74`).
  - `expense.concurrency.test.ts` covers only two concurrent `createBill` and two concurrent `invoice` calls (`:105`, `:137`). Nothing races `verify` or `reverse`.

- **Finding F3 (integrity): a receipt can settle a payable bill, and a payment can settle a receivable one — confirmed by reading.** No comparison exists between `payment.direction` and `bill.attribute` / `cost_line.attribute` anywhere in `write-offs.ts` (grep of `direction` finds only `:444`, `:479`). The picker offers both attributes for the same Settlement Unit (`payments.tsx:517-524`), and forwarding counterparties are routinely both customer and agent. Result: money that came in marks a supplier bill paid; the receivable stays open; the FX sign is taken from the bill (`:692`), so it is also inverted. No test uses `direction: "payment"` against a bill at all (grep of `expense.ledger`, `expense.cross-currency-writeoff`, `expense.corrections` tests).

- **Finding F4 (dead end): a payment that was ever verified can never be corrected or removed — confirmed by reading.** After the write-off is voided, `writtenOffAmount` is back to 0, so the Delete icon re-enables (`payments.tsx:910`), but the server refuses on the voided write-off (`payments.ts:145-152`). There is no update verb (`:375-377`). A receipt keyed as MYR 10,000.00 instead of 1,000.00, or under the wrong Settlement Unit or currency, stays in the ledger for ever at its full amount: it inflates `payments.totals` receipts and "prereceived" (`write-offs.ts:237-258`), the report's receipts-and-payments figures (`report.ts:2429-2431`, `:2849-2852`), and the Verify dialog keeps offering it. The SOP's pitfall ("void the write-off first") sends staff straight into this.

- **Finding F5 (sign-off): voiding a write-off needs no second person, no reason, and cannot be made to need one by ticking the gate — confirmed by reading.**
  - The void is held by the same three roles as verify. The page sends no reason (`write-offs.tsx:456`); the server takes it as optional (`write-offs.ts:869`).
  - `cancel_write_off` is declared (`modules/expense/gates.ts:20`) and wired (`write-offs.ts:895`) but not seeded (`seed.ts:192`). Ticking it would not help: `assertGatesCleared` passes when the bill's latest submission is `passed` (`modules/audit/gates.ts:91-92`), and in a seeded org a bill can only be written off after exactly that approval (`write_off` gate, `:367`). So the "Cancel the verification" box reads as protection and freezes nothing on the normal path.
  - Consequence: one accountant can void a settled receivable and re-verify the same receipt against another customer's bill, leaving only an audit row with a NULL reason.

- **Finding F6 (hand-off to step 27): foreign-currency payments convert at 1 in every payment total.** `paymentTotals` multiplies by `payment.exchange_rate` (`modules/expense/money.ts:345-372`), and so does the report (`report.ts:2429-2431`, `:2849-2852`). With every foreign payment at 1, USD 1,000 is summed as MYR 1,000. This is the other half of the ledger's "stored at a rate of 1 and cannot be corrected". Phase 3 lets the rate be captured. Old payments stored at rate 1 (`getReceiptPayment`, the month-end pack) stay as stored: an **accepted gap, confirmed 2026-09-21** in step 27's settlement.

- **Finding F7 (visibility): "is this invoice paid?" has no answer — confirmed.** `write_off` carries `bill_id` only (`schema/expense.ts:599` onward); `invoices.ts` never reads `write_off` or `write_off_line` (grep: only the cancel path reads `cost_line.written_off_amount`, `:721`). Both per-line splits exist (`invoice_line`, `:717`; `write_off_line`, `:756`), so the answer is derivable without a migration.

- **Adjacent defects in the same paths (flagged; fixed only where noted).**
  1. Lines created in one transaction share `created_at` (`defaultNow()` is the transaction start), and the spread orders by `createdAt` alone (`:351`), so the fill order among them is undefined. **Fixed in Phase 2** by ordering `(created_at, id)`, the order step 24 also uses.
  2. A cross-currency void gives the payment back `round(amount ÷ rate, 6)` (`:957`), not the figure verify took; when the receipt was fully absorbed verify took the operator's amount verbatim (`:582-586`). With a rate below 1 the two differ by a few millionths. Flag only (D10).
  3. A fully settled bill that was only **partly** invoiced goes to `written_off`, not `done` (`:694`; a partial issue leaves the bill `open`, `bills.ts:1994`), and `bills.invoice` then refuses it. **Owned by step 24 Phase 3**; this plan keeps `:694` and `:1124` unchanged so 24's tests stay valid.
  4. On a line target whose bill is outside the caller's bill scope, the bill is never advanced (`:660`). Low; flag only.
  5. The Verify icon stays enabled on a fully settled payment (`payments.tsx:896-903`); the prefill is empty and **Verify** stays disabled (`:720`). Harmless; Phase 1 Task 1.3 greys it.

- **Precedent this plan follows.**
  - Money locks: the governed writer's scoped `FOR UPDATE` load (`writer.ts:234`) and step 24 §4.3 (lines in `created_at, id` order before the bill).
  - Refusal wording: `invoices.issue`'s currency sentence and verify's own rate sentence (`write-offs.ts:459`): name both sides.
  - Real-Postgres proof: `expense.concurrency.test.ts` pattern (`Promise.allSettled` of two `call(…)`s, per-run org ids, `:65-103`).
  - Edit verb: the governed writer's `update` kind with a `pin`, as `paymentWriter.delete` pins `writtenOffAmount` (`payments.ts:196-199`).

---

## 1. Overview

**Problem.** Recording money and settling it works on the plain path (a MYR receipt against a MYR bill). Off that path it goes wrong in ways nobody sees. A USD receipt settled against a MYR bill books a loss equal to most of the bill. Two accountants settling at the same moment can spend one receipt twice. A receipt from a customer who is also an agent can be settled against that agent's payable bill. A mistyped receipt, once settled, can never be corrected or removed. And a settlement can be voided by the person who booked it, with no reason.

**Goals.**
- **Phase 1 (F1, F3):** a settlement books an exchange difference only when both rates it needs are known, and a receipt settles only receivables (a payment only payables). The picker offers only bills that can still be settled on that side.
- **Phase 2 (F2):** verify and void are serialised on the payment, the lines and the bill, in one lock order shared with steps 24 and 25. One receipt cannot be spent twice; a line cannot be settled twice; the bill advances when its last line is settled.
- **Phase 3 (F4, F5, F6):** an unsettled payment can be edited; a void needs a written reason, which the list shows; a foreign-currency payment can carry its rate.
- **Phase 4 (F7, optional):** the invoice list shows how much of each invoice is settled.

**Success criteria.**
- The worked case in F1 books `fx_gain_loss` NULL on the bill and the write-off; the existing FX test (`expense.cross-currency-writeoff.test.ts:531`) still books +240.
- `writeOffs.verify` of a receipt against a payable bill returns BAD_REQUEST _"A receipt settles receivable bills only. NCT-B-… is payable."_ and writes nothing (D3-A).
- On real Postgres, two concurrent verifies of one MYR 1,000.00 receipt against two MYR 1,000.00 bills leave `payment.written_off_amount = 1000`, one bill settled, and the other call refused with the balance sentence; twenty repetitions, no 500.
- A payment with only voided write-offs can be edited from its row; its audit row carries before and after.
- `writeOffs.reverse` without a reason returns BAD_REQUEST; with one, the Write-offs list shows it.
- Existing suites pass, judged by reading the output for `failed` (memory: `vp-run-exit-code-lies`).

**In scope.** `writeOffs.verify` and `writeOffs.reverse` (FX rule, side rule, locks, gate reads inside the transaction, spread order); `payments.update` [NEW verb] and the Edit sheet; the void reason; the payment rate field; the Verify picker filters; one optional read on `invoices.list` and one column; tests; read-only production probes.

**Out of scope.**
- Correcting FX already booked, over-settlements already stored, or wrong-side write-offs already stored (probes report them; D11).
- Partially invoiced bills going `written_off` (step 24 Phase 3).
- The issue-side and cancel-side locks (steps 24 Phase 2 and 25 Phase 2). This plan only agrees the order with them (D5).
- The settlement company on payments (step 20 owns the company reference on cost lines; the payment picker stays unrendered).
- How reports convert payments recorded before Phase 3: an accepted gap, confirmed 2026-09-21 (step 27 plans no conversion of old rows).
- Settling against an invoice rather than a bill (D8-B, a migration; not recommended).

**SOP findings (`customer-intake-sop/sop.json`, step 26 and ledger).**

| Finding | Planned? | Where |
|---|---|---|
| ledger `fx-gain-loss` (repair `s26`) | Yes | Phase 1 (booking), Phase 3 (rate capture) |
| ledger `bill-rewrite`, reversal half (repairs `s23`, `s26`) | Yes, with a different repair from the ledger's wording: the gate cannot bite, so a reason is required instead (D7) | Phase 3 |
| ledger `money-by-hand`, settlement half (repairs `s25`, `s26`) | Yes, read-only, optional (D8) | Phase 4 |
| `breaks[]` entries touching step 26 | None exist | – |
| Not in the SOP: F2 double spend, F3 wrong side, F4 dead end | Yes | Phases 2, 1, 3 |

**Decisions (all Decided 2026-09-21, the recommended option; §9 keeps three approaches each):**
- How the exchange difference is computed → D1 [A: derive the payment's base rate; book nothing when a rate is unknown]
- Payment exchange rate on the sheet → D2 [A: optional field, prefilled, shown only for a foreign currency]
- Receipt vs payable → D3 [A: refuse; picker filtered]
- How verify and void are serialised → D4 [A: `FOR UPDATE` and recompute inside]
- Shared lock order with 24 and 25 → D5 [A: payment → lines `(created_at, id)` → bill; X30]
- Correcting a settled-then-voided payment → D6 [A: `payments.update` while no live write-off; catalog row per X37]
- Void sign-off → D7 [A: reason required and shown]
- Invoice settled figure → D8 [A: derived read, FIFO per line]
- Picker hygiene → D9 [A: hide settled targets client-side]
- Void give-back crumb → D10 [A: accept, flag]
- Residue already stored → D11 [A: report only]

---

## 2. User Journeys

**Journey 1 (changed): Accounting settles a USD receipt against a MYR bill**
Trigger: bill `NCT-B-202609-0031` for Sunrise Trading, receivable, MYR 4,200.00, approved (step 23) and invoiced (step 24). The customer paid USD 1,000.00.
Steps:
1. **Money > Payments** → **Add** → Attribute **Receipt**, Settlement Unit `Sunrise Trading`, Currency **USD**, Price `1000` → a new row **Exchange Rate (USD → MYR)** appears, prefilled from the org's write-off rate if one is on file (D2-A); accounting leaves or corrects it → **Add Payment** → toast _"Payment PAY-… recorded"_ (unchanged).
2. Row icon **Verify** → **Target** Bill → the Bill list shows only Sunrise Trading's **receivable** bills that are not yet fully settled (D3-A, D9-A) → picks `NCT-B-202609-0031 · MYR`.
3. Types 核销汇率 `4.2` → preview _"Will write off 4,200.00 MYR against the target, consuming 1,000.00 USD of this receipt."_ (unchanged) → **Verify** → toast _"Write-off WO-… recorded"_.
4. The bill reads **done**; its FX gain/loss is empty (D1-A). Before: −3,200.00 MYR.
5. Variant: a USD receipt against a USD bill with no bill rate on file → recorded; toast adds _"No exchange gain or loss booked: the bill has no exchange rate."_ (D1-A, `fxUnknown`).
Where it lives: the existing sheet (one conditional field) and dialog (filtered picker); the server rule.

**Journey 2 (new refusal): A receipt cannot settle a supplier bill**
Trigger: Harbour Freight is both a customer and an overseas agent. It has a receivable bill and a payable bill.
Steps:
1. Accounting opens **Verify** on Harbour Freight's receipt → the Bill list shows only the receivable bill (D3-A).
2. An RPC call (or a stale tab) naming the payable bill → BAD_REQUEST _"A receipt settles receivable bills only. NCT-B-202609-0044 is payable."_ Nothing is written.
Where it lives: the existing dialog; the server refusal.

**Journey 3 (changed): Two accountants settle the same receipt at the same time**
Trigger: one MYR 1,000.00 receipt; two open MYR 1,000.00 bills for the same customer; two accountants each open **Verify**.
Steps:
1. Both press **Verify** within the same second.
2. One gets _"Write-off WO-… recorded"_. The other waits on the payment row, then gets _"Write-off amount exceeds the payment's unwritten balance"_ (the existing sentence, now measured on the locked row).
3. The payment row reads Verification Amount 1,000.00 (before: 2,000.00).
Where it lives: server only.

**Journey 4 (new): Accounting corrects a mistyped receipt**
Trigger: a receipt was keyed as MYR 10,000.00 instead of 1,000.00 and was already settled against a bill.
Steps:
1. **Money > Write-offs** → **Void write-off** on its row → the dialog now asks **Reason** (required) → types _"Receipt amount keyed wrong"_ → **Void Write-off** → toast _"Write-off voided"_ (D7-A).
2. **Money > Payments** → the row's new **Edit** icon (enabled because nothing live is settled against it) → the sheet opens titled **Edit Payment / Receipt**, prefilled → Price `1000` → **Save** → toast _"Payment PAY-… updated"_ (D6-A).
3. **Verify** again against the bill → recorded.
4. Old journey, for contrast: after step 1, **Delete** re-enabled and then failed with _"Payment has 1 voided write-off(s); those are a permanent record…"_, and there was no Edit. The wrong receipt stayed for ever.
Where it lives: the existing Write-offs and Payments pages; one new sheet mode.

**Journey 5 (changed): A void says who and why**
Trigger: any void.
Steps:
1. The void dialog refuses to confirm with an empty reason (button disabled; the server refuses too).
2. The Write-offs list shows **Void reason** and **Voided by** beside **Voided at** for voided rows.
Where it lives: the existing Write-offs page.

**Journey 6 (new, optional — Phase 4): Accounting answers "is this invoice paid?"**
Trigger: the customer asks whether invoice `NCT-INV-202609-0107` is settled.
Steps:
1. **Money > Invoices** → the row shows **Settled** `4,200.00` and a badge **Paid** (or **Part paid**, **Unpaid**) (D8-A).
Where it lives: one column on the existing list.

## 3. Result (What Changes for the User)

**Before:** settling a foreign receipt books a large fictitious loss; two people can settle one receipt twice; a receipt can mark a supplier bill paid; a wrong receipt, once settled, is stuck for ever; a void needs no reason.
**After:** exchange differences appear only when real; one receipt is spent once; receipts settle receivables and payments settle payables; a receipt with nothing live against it can be edited; every void carries a reason.
**Key differences:**
- Accounting: the Verify picker is shorter (one side, unsettled only); a foreign payment has a rate field; an Edit icon on unsettled payments; a Reason box on void.
- Month-end (step 27): bill and write-off FX figures stop carrying invented losses for new settlements.
- Nobody: the plain MYR-against-MYR path behaves exactly as before.

---

## 4. Technical Architecture

### 4.1 What the exchange difference is (Journey 1; Phase 1) → D1

`modules/expense/settlement-fx.ts` [NEW] exports one pure function, so the rule is testable without a database:

```ts
export function settlementFx(i: {
  crossCurrency: boolean;
  applied: number;            // target (bill/line) currency, what the lines absorbed
  appliedPayment: number;     // payment currency, what the receipt gave up
  conversionRate: number;     // 核销汇率, payment → target (1 when same currency)
  payCurrency: string; payRate: number;           // payment.exchange_rate as stored
  targetCurrency: string;
  billRate: number | null;                        // bill.exchange_rate, NULL kept as NULL
  localCurrency: string | null;                   // reportingCurrency(...)
  payToLocalFromTable: number | null;             // resolved before the tx (see below)
  attribute: "receivable" | "payable";
}): { fx: number | null; unknown: "bill_rate" | "payment_rate" | null }
```

Rules, in order:
1. No `localCurrency` → `{ fx: null, unknown: "payment_rate" }`.
2. **Bill side (accrued base per target unit).** `targetCurrency === localCurrency` → 1. Else `billRate` if not NULL. Else → `{ fx: null, unknown: "bill_rate" }`. (Today NULL reads as 1, `write-offs.ts:686`.)
3. **Payment side (realised base per payment unit).** `payCurrency === localCurrency` → 1. Else, across currencies with `targetCurrency === localCurrency` → `conversionRate` (the operator's rate *is* the conversion into the reporting currency). Else `payRate` **when it is not 1** (an explicit rate, including one typed on the sheet after Phase 3 or set by the existing test). Else `payToLocalFromTable`. Else → `{ fx: null, unknown: "payment_rate" }`.
4. `settledRate = appliedPayment × payToLocal ÷ applied` (this reduces to today's same-currency formula, because there `appliedPayment = applied` and `payToLocal` is the resolved `write_off` rate). `gain = round((settledRate − billToLocal) × applied)`; payable flips the sign (as `:692`); `|settledRate − billToLocal| ≤ 1e-9` → `fx: null`.

`payToLocalFromTable` is the `write_off` rate from the payment currency to `localCurrency`, resolved **before** the transaction with `resolveRate` exactly as `:473-483` does today. The same-currency leg already computes it as `writeOffRate`; the cross-currency leg gains one lookup (only when rule 3 reaches it).

`verify` replaces `:686-693` with a call to `settlementFx`, keeps `bill.fx_gain_loss` accumulation and the write-off stamp unchanged, and returns one additive field `fxUnknown: "bill_rate" | "payment_rate" | null`. The payments page's success toast appends one sentence when it is set (Journey 1 step 5). A stored `payment.exchange_rate = 1` on a foreign payment is read as "unknown", not "par": no currency pair in `CURRENCIES` trades at par.

The worked case in F1: rule 2 gives 1 (MYR bill), rule 3 gives 4.2 (target is local), `settledRate = 1000 × 4.2 ÷ 4200 = 1`, so `fx` is NULL. The existing test (`:531`) sets `payRate = 4.5` on a USD payment against a CNY bill in a MYR branch: rule 3 takes 4.5, `billToLocal = 0.6`, `settledRate = 1000 × 4.5 ÷ 7100`, `fx = +240`, unchanged.

### 4.2 The side rule (Journey 2; Phase 1) → D3

In `verify`, after the target is resolved and before the gates:
- bill target: select `attribute` and `billNo` with the bill (`:342-345` already selects `id`, `currency`);
- line target: `line.attribute` is on the loaded row.

If `attributeForDirection(pay.direction)` (`shared.ts:182`) differs, throw BAD_REQUEST: _"A receipt settles receivable bills only. <billNo> is payable."_ / _"A payment settles payable bills only. <billNo> is receivable."_ (for a line: _"… This fee line is payable."_). The refusal sits after the scoped loads, so it leaks nothing a NOT_FOUND hides.

Web (`VerifyDialog`): both picker queries add `attribute: direction === "receipt" ? "receivable" : "payable"` (`bills.list` and `costLines.list` already accept it, `bills.ts:243`, `shared.ts:757`).

### 4.3 Serialised verify and void (Journey 3; Phase 2) → D4, D5

Operative lock order (D5-A): **payment → cost lines by `(created_at, id)` → bill.** This matches reverse's current order (`:988-1131`), step 24's "lines before bill" (`step-24-invoice-issue-integrity.md` §4.3) and the governed writer's unbill (line, then bill). Crosscheck X30 settled it for all three plans: step 25 D7's cancel takes the same order (lines `(created_at, id)` → bills by id, after its pinned `UPDATE invoice`), and step 24's issue does too (24 D3-A). Bills are locked `ORDER BY id` wherever more than one is taken.

```
verify (inside one transaction; reads outside stay only for early refusals and rate lookups)
  ├─ SELECT payment WHERE id AND payScope FOR UPDATE                    NEW
  ├─ re-check over-balance on the locked row                             moved from :302
  ├─ SELECT cost_line WHERE bill_id = :bill ORDER BY created_at, id FOR UPDATE   NEW (all lines of the bill,
  │     also for a line target, because coverage is measured on the whole bill)
  ├─ SELECT bill WHERE id AND billScope FOR UPDATE                       NEW (was a plain read at :653)
  ├─ assertGateCleared(tx, … "bill", "write_off"); cost_line twin on tx  moved from :367, :373
  ├─ side rule, spread, applied, appliedPayment, FX — from the LOCKED rows      recomputed
  └─ writes as today (:612-789), plus the audit row
reverse
  ├─ claim write_off WHERE voided_at IS NULL (unchanged, :971)
  ├─ SELECT payment … FOR UPDATE; lines of the split (or the bill) ORDER BY created_at, id FOR UPDATE; bill FOR UPDATE   NEW
  ├─ assertGateCleared(tx, … "cancel_write_off")                          moved from :895
  └─ decrements and statuses from the LOCKED rows (today: plain reads at :1017, :1068, :1112)
```

- The pre-transaction reads stay so that NOT_FOUND, the unbilled-line refusal, the bill/line mismatch and the rate refusal still answer without taking a lock. Everything that decides a money figure is recomputed from the locked rows.
- A line target on a standalone line (`billId` NULL) is refused before the transaction today (`:322`), so the "lines of the bill" lock always has a bill.
- `FOR UPDATE` on a `WHERE bill_id = X` select re-checks the predicate against the newest row version, so a line unbilled by a transaction that committed first is excluded, not settled.
- `paymentUnsettledGate` (`payments.ts:134`) runs inside `paymentWriter.remove`, which already loads the payment `FOR UPDATE` (`writer.ts:234`): a delete and a verify now queue on the same row instead of relying on the pin alone.
- A deadlock that still occurs (`40P01`) is mapped to CONFLICT _"Another settlement on this payment or bill is in progress. Try again."_ in both `verify` and `reverse`, so a miss is a retry, not a 500 (X30; steps 24 and 25 map it the same way).
- PGlite runs every transaction on one connection, so these locks cannot be proven there; Phase 2's proof is real Postgres (§10).

### 4.4 Editing an unsettled payment (Journey 4; Phase 3) → D6

- New node `EXPENSE.paymentUpdate = "expense.payment.update"`, `isEndpoint: true`, parent `EXPENSE.payment` (`permissions.ts:160-170`). Admin, branch-manager and accounting inherit it through the `expense` root; director and viewer do not. `permissions/registry.sync.test.ts` requires the node to gate a real endpoint, which `payments.update` does.
- **Catalog row (crosscheck X37).** The node needs its `permission_node` row, because a grant to a custom role or a member references it through foreign keys; `db:seed-nodes` runs in no pipeline and cannot run under bun. It follows step 13 D12-A's path, **not a migration and not seed code**: the executor first reads the `expense.payment.create` row (`SELECT * FROM permission_node WHERE key = 'expense.payment.create'`) to match its `module`/`resource`/`action` shape, then hands Wilfred the exact, reviewed `INSERT INTO permission_node (…) SELECT 'expense.payment.update', …, '<registry label>', … FROM permission_node WHERE key = 'expense.payment.create' ON CONFLICT (key) DO NOTHING`, with the label equal to the registry label. Wilfred runs it on dev before the Phase 3 proof and on production after the deploy, before any grant to a custom role or member. Read-only check: `SELECT key, parent_key, is_endpoint FROM permission_node WHERE key = 'expense.payment.update'`. Root holders (admin, branch-manager, accounting) reach the node through the `expense` root with or without the row, so the endpoint works on deploy.
- New verb `update` on `paymentWriter` (`payments.ts:175`), `kind: "update"`, `fieldMode: "strip"` (as the writer already declares, `:172`), with one gate `paymentHasNoLiveWriteOff`: refuse CONFLICT _"This payment has a live write-off. Void it on Write-offs first."_ when `writtenOffAmount > 0` or any `write_off` with `voided_at IS NULL` exists; and a `pin` on `writtenOffAmount` exactly like `delete` (`:196-199`). Voided write-offs do **not** block an edit; they stay as history pointing at the corrected payment, and the audit row records `before` and `after`.
- Input: `id` plus the create fields, each `nullish` (patch semantics; `null` clears an optional text field — memory `edit-forms-cannot-clear-a-field`). `direction`, `currency`, `amount` and `settlementUnit` are editable. The create handler's refusal for a caller denied `payment.settlementUnit` (`:327-332`) is repeated when `settlementUnit` is in the input.
- `paymentNo`, `writtenOffAmount`, `owningBranchId`, `createdBy` are not in the input.
- Web: an **Edit** icon (`Pencil`, title "Edit") before **Verify**, disabled while `writtenOffAmount > 0`. `PaymentFormSheet` gains an optional `payment` prop: title **Edit Payment / Receipt**, button **Save**, prefill from the row, success toast _"Payment <no> updated"_. The sheet is **keyed on the payment id** so a second Edit does not show the first row's values (memory `tanstack-form-istouched-reseed-trap`), and it reseeds only on open (memory `refetch-overwrites-typed-input`).
- `payments.tsx` Delete keeps its server message; its `ConfirmDialog` description gains _"A payment with voided write-offs cannot be deleted; edit it instead."_

### 4.5 Void reason (Journey 5; Phase 3) → D7

- `reverse` input: `reason: z.string().trim().min(1, "Give a reason for voiding").max(500)`.
- `write-offs.tsx`: the row's `ConfirmDialog` (`:291-307`) is replaced by a small `VoidWriteOffDialog` in the same file (a `Textarea` **Reason**, required; **Void Write-off** disabled while it is blank or pending), sending `{ id, reason }`. Two columns, **Void reason** and **Voided by** (`MemberName`, as **Creator** at `:270-273`), hidden by default and reachable from the column gear (D7 note); `MUST_SHOW_COLUMNS["expenses-write-offs"]` only if Wilfred later asks for them visible.
- Test callers of `reverse` pass a reason (16 calls across `expense.corrections`, `expense.cross-currency-writeoff`, `expense.ledger`, `expense.transaction-integration`, `expense.wave1` tests).

### 4.6 Payment exchange rate (Journey 1 step 1; Phase 3) → D2

- `PaymentFormSheet`: after Currency is chosen, call `exchangeRates.suggest({ rateType: "write_off", fromCurrency, attribute })` (`exchange-rate.ts:500`; `attribute` from Attribute). If `toCurrency` is null or equals the chosen currency, show nothing. Otherwise show **Exchange Rate (USD → MYR)** prefilled with `rate` when not null, editable, optional; send `exchangeRate` only when the field is visible and not blank.
- Server: unchanged (`payments.ts:303`, `:363`). Blank still stores 1, which §4.1 reads as unknown.

### 4.7 Invoice settled figure (Journey 6; Phase 4, optional) → D8

`modules/expense/invoice-settlement.ts` [NEW], `invoiceSettlement(db, organizationId, invoiceIds)`:
1. Collect the cost lines of those invoices from `invoice_line`.
2. For each such line, all **issued** `invoice_line` rows on it across the org, ordered by `invoice.invoice_time` (then `created_at`, then id).
3. Settle each line's current `written_off_amount` onto those rows first-invoiced first.
4. `settled(invoice) = Σ` its rows' settled parts; `settlement = unpaid | part | paid` against `Σ` its rows' amounts.

`invoices.list` (`invoices.ts:381`) adds `settledAmount` and `settlement` to each row (one extra grouped query per page). `invoices.tsx` adds **Settled** and a badge. Read-only; no write path changes.

### 4.8 Data model

**No schema change under any recommended option.** D6-B would add `payment.voided_at`, `voided_by`, `void_reason` (migration placeholder `00NN_payment_void`); D6-C would change `write_off.payment_id` to `ON DELETE SET NULL` (`00NN_write_off_payment_set_null`); D8-B would add `write_off.invoice_id` (`00NN_write_off_invoice`); D10-C would add `write_off.payment_amount` (`00NN_write_off_payment_amount`). Numbers are assigned at merge (X38). None of these options was chosen (D4-C, D6-B, D6-C, D8-B, D10-C), so step 26 ships no migration.

### 4.9 API contracts

| Procedure | Change | New refusals / fields |
|---|---|---|
| `writeOffs.verify` | FX rule (D1); side rule (D3); locks and in-transaction gate reads (D4, D5); spread order `(created_at, id)` | BAD_REQUEST side sentence; output `fxUnknown` (additive) |
| `writeOffs.reverse` | `reason` required (D7); locks (D4, D5) | BAD_REQUEST _"Give a reason for voiding"_ |
| `payments.update` | **new** (D6) | CONFLICT live write-off; FORBIDDEN denied `settlementUnit` |
| `payments.create`, `payments.delete` | unchanged | – |
| `invoices.list` | output `settledAmount`, `settlement` (additive, D8) | – |

Input shapes of `verify`, `create`, `delete`, `list` are unchanged.

### 4.10 Key decisions

1. **Book less, not more.** When a rate the difference needs is unknown, the settlement books nothing and says so (D1-A). An empty FX cell is honest; a figure computed at par looks authoritative and is wrong by the whole rate (the same argument as `write-offs.ts:447-456`).
2. **Refuse the wrong side outright** (D3-A), after probe 26-P3 shows whether any org relies on it.
3. **Lock, then recompute.** Pre-transaction reads stay for early refusals only (D4-A).
4. **One lock order for the ledger** — payment, lines, bill — shared with steps 24 and 25, settled by crosscheck X30 (D5-A).
5. **Edit, not void, a payment** — no migration, and the handler comment already anticipates it (D6-A).
6. **A reason, not a gate.** The gate cannot bite on the normal path (F5); a required reason is the smallest real control (D7-A).

---

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- Re-locate every anchor in `write-offs.ts`, `payments.ts`, `payments.tsx`, `write-offs.tsx`, `invoices.ts`, `permissions.ts` **by symbol** at the base commit. Steps 21–25 edit neighbouring handlers.
- D1-A, D3-A decided (Phase 1). Re-check before Task 1.2: probe 26-P3; if any org shows live wrong-side write-offs with `payment_way = 'reconciliation'`, stop and re-plan D3 (option B).

### Phase 1 — A settlement books only real exchange differences, and settles only its own side (F1, F3)

**Delivers:** Journeys 1 and 2 end to end.
**Dependencies:** none beyond the base commit. D1-A, D3-A, D9-A (decided).

- **1.1** `settlementFx` (§4.1) with unit tests: the F1 worked case → NULL; the existing +240 case → 240; payment in reporting currency → today's figure; USD/USD with NULL bill rate → `unknown: "bill_rate"`; USD→EUR bill in a MYR branch with no table rate and `payRate = 1` → `unknown: "payment_rate"`; payable sign flip; rates equal → NULL. Files: `packages/api/src/modules/expense/settlement-fx.ts` [NEW], `packages/api/src/modules/expense/settlement-fx.test.ts` [NEW]. · **Agent A (backend)**
- **1.2** In `verify`: resolve `payToLocalFromTable` before the transaction when §4.1 rule 3 needs it; replace `:686-693` with `settlementFx`; return `fxUnknown`; add the side rule (§4.2), selecting `attribute` and `billNo` on the bill read. Keep `:694` and `:1124` exactly as they are (step 24 Phase 3 relies on them). Files: `packages/api/src/routers/expense/write-offs.ts`. · **Agent A (backend)**
- **1.3** Tests in `expense.cross-currency-writeoff.test.ts`: (a) receipt created through `paymentsRouter.create` with **no** rate, USD 1,000 against a MYR 4,200 receivable at 核销汇率 4.2 → `bill.fx_gain_loss` NULL, `write_off.fx_gain_loss` NULL, `fxUnknown` null, bill `open` → after invoice path unchanged; (b) USD/USD, bill rate NULL → NULL and `fxUnknown: "bill_rate"`; (c) the existing +240 test unchanged. In `expense.ledger.test.ts`: receipt against a payable bill → BAD_REQUEST, zero `write_off` rows, payment and lines unchanged; payment against a receivable line target → BAD_REQUEST; receipt against receivable → recorded (regression). Re-run `expense.base-currency.test.ts`, `expense.corrections.test.ts`, `expense.wave1.test.ts`, `expense.transaction-integration.test.ts`, `expense.rbac.test.ts`, `modules/export/month-end.test.ts`. Files: `packages/api/src/routers/expense.cross-currency-writeoff.test.ts`, `packages/api/src/routers/expense.ledger.test.ts`. · **Agent A (backend)**
- **1.4** Web `VerifyDialog`: attribute filter on both pickers (§4.2); hide bills with `status` `written_off`/`done` and lines whose `writtenOffAmount >= amount` (D9-A); success toast appends the `fxUnknown` sentence; the row's **Verify** icon disabled when `writtenOffAmount >= amount`. Files: `apps/web/src/routes/_next/expenses/payments.tsx`. · **Agent B (frontend)**

**Acceptance.**
- In the browser, Journey 1 books no FX on the MYR bill, and the Bill list for a receipt shows receivable, unsettled bills only (§10).
- The tests above pass, judged by reading the output.

### Phase 2 — One receipt is spent once (F2)

**Delivers:** Journey 3 end to end.
**Dependencies:** Phase 1 merged (same handlers). D4-A, D5-A decided; the lock order is crosscheck X30's, which steps 24 (D3-A) and 25 (D7) carry too. Step 23 Phase 1 merged (its `FOR UPDATE` in the bill's `exists`, `resources.ts:441-450`, is what makes the in-transaction gate read meaningful against a concurrent submit).

- **2.1** `verify`: the locked reads and recomputation of §4.3; gate calls on `tx`; spread order `(createdAt, id)`; `40P01` mapped to CONFLICT (§4.3, X30). Files: `packages/api/src/routers/expense/write-offs.ts`. · **Agent C (backend)**
- **2.2** `reverse`: the locks of §4.3 after the claim; statuses and decrements from the locked rows; gate call on `tx`; `40P01` mapped to CONFLICT (X30). Files: `packages/api/src/routers/expense/write-offs.ts`. · **Agent C (backend)**
- **2.3** Real-Postgres tests in `expense.concurrency.test.ts` (one `describe` block of its own, same gate):
  1. **same receipt, two bills:** one MYR 1,000 receipt, two MYR 1,000 receivable bills; fire both verifies → exactly one fulfils; `payment.written_off_amount = 1000`; the loser is BAD_REQUEST with the balance sentence; one `write_off` row.
  2. **two receipts, one bill:** two MYR 1,000 receipts, one MYR 1,000 bill → one fulfils, the other BAD_REQUEST _"Target is already fully written off"_; `cost_line.written_off_amount = 1000`; the losing receipt's `written_off_amount = 0`.
  3. **sibling lines:** a two-line bill (600 + 400), two single-line verifies at once → both fulfil; the bill is `written_off`.
  4. **verify vs void:** a settled write-off W on receipt R and bill B; fire `reverse(W)` and a new `verify(R → B')` → both settle or one is refused by a sentence; no rejection is a deadlock error; afterwards `R.written_off_amount` equals the sum of R's live write-offs.
  Each runs 20 times. Before merging, run 1 and 2 against Phase 1's handler and record that they fail there. The block is step 26's own `describe`; no other plan's case is edited (X35). Because Phase 2 changes locks, the PR also re-runs every case already in the file and pastes both runs on the dev Neon branch ("skipped" is not a pass). The bills pass `write_off` by seeding a `passed` submission as `audit-review.test.ts:1078-1110` does, or the test org has no Bill flow. `DATABASE_URL_TEST` points at the dev branch, never production. Files: `packages/api/src/routers/expense.concurrency.test.ts`. · **Agent C (backend)**
- **2.4** Re-run the PGlite suites of Task 1.3 and `packages/api/src/architecture.test.ts` (the update/insert enumeration at `:435-444`, `:684-686` is unchanged: this phase adds reads, not writes). Files: none. · **Agent C (backend)**

**Acceptance.**
- The four real-Postgres cases pass 20/20 with names visible in the output (not skipped), and cases 1–2 were seen failing on the old handler.
- Journey 3 in two browser tabs as two accountants ends with one write-off (§10 edge case 3).

### Phase 3 — A wrong payment can be put right, and a void says why (F4, F5, F6)

**Delivers:** Journeys 4 and 5, and Journey 1 step 1's rate field.
**Dependencies:** Phase 2 merged (`reverse` input and body). D2-A, D6-A, D7-A (decided). The `expense.payment.update` catalog row (§4.4, X37) is on dev before the Phase 3 proof.

- **3.1** `EXPENSE.paymentUpdate` node; `paymentWriter.update` verb with its gate and pin; `payments.update` procedure (§4.4). Read the `expense.payment.create` catalog row and hand Wilfred the exact `INSERT … SELECT … ON CONFLICT (key) DO NOTHING` for the new node's `permission_node` row (§4.4, X37); no migration, no seed change. Files: `packages/api/src/modules/expense/permissions.ts`, `packages/api/src/routers/expense/payments.ts`. · **Agent D (backend)**
- **3.2** `reverse` requires `reason` (§4.5); update every test caller. Files: `packages/api/src/routers/expense/write-offs.ts`, `packages/api/src/routers/expense.corrections.test.ts`, `packages/api/src/routers/expense.cross-currency-writeoff.test.ts`, `packages/api/src/routers/expense.ledger.test.ts`, `packages/api/src/routers/expense.transaction-integration.test.ts`, `packages/api/src/routers/expense.wave1.test.ts`. · **Agent D (backend)**
- **3.3** Tests: `expense.payment-update.test.ts` [NEW] — edit a never-settled payment (amount, currency, unit) → 200 and an `expense.payment.update` audit row with before/after; edit a payment with a live write-off → CONFLICT, row unchanged; void, then edit → 200; clearing `note` with `null` → NULL; a caller denied `payment.settlementUnit` sending it → FORBIDDEN; director → FORBIDDEN (`Missing permission`); `registry.sync.test.ts`, `permissions/reachability.test.ts`, `expense.rbac.test.ts` pass. `reverse` without reason → BAD_REQUEST, with reason → `void_reason` stored. Files: `packages/api/src/routers/expense.payment-update.test.ts` [NEW]. · **Agent D (backend)**
- **3.4** Web payments page: Edit icon and edit mode of `PaymentFormSheet` (§4.4); the conditional rate field (§4.6); the Delete description sentence. Files: `apps/web/src/routes/_next/expenses/payments.tsx`. · **Agent B (frontend)**
- **3.5** Web write-offs page: `VoidWriteOffDialog` and the two columns (§4.5). Files: `apps/web/src/routes/_next/expenses/write-offs.tsx`, `apps/web/src/components/list-default-columns.ts` (only if D7 makes the columns default-visible). · **Agent B (frontend)**
- **3.6** Seed: `seed/money.ts` sends `exchangeRate` for its two USD payments (a fixed, commented figure), so seeded orgs no longer produce F1 data. Files: `seed/money.ts`. · **Agent D (backend)**

**Acceptance.**
- Journey 4 and Journey 5 in the browser (§10).
- `tsc` for web and api (`bun run check-types`, output read for "failed"), and the tests above pass.
- On dev, `SELECT key, parent_key, is_endpoint FROM permission_node WHERE key = 'expense.payment.update'` returns one row (Wilfred ran the X37 INSERT); on production the same check follows the deploy, before any grant to a custom role or member.

### Phase 4 (optional) — The invoice list says how much is settled (F7)

**Delivers:** Journey 6.
**Dependencies:** Phase 1 merged. Step 25 Phase 2 merged (same file, `invoices.ts`; different procedure). D8-A (decided); the phase stays optional.

- **4.1** `invoiceSettlement` (§4.7) and its use in `invoices.list`. Tests: one invoice fully settled → `paid`; a bill invoiced 400 + 600 in two invoices and settled 500 → first `paid` (400), second `part` (100); a cancelled invoice is skipped; a voided write-off returns the figure to `unpaid`. Files: `packages/api/src/modules/expense/invoice-settlement.ts` [NEW], `packages/api/src/modules/expense/invoice-settlement.test.ts` [NEW], `packages/api/src/routers/expense/invoices.ts`. · **Agent E (backend)**
- **4.2** Web: **Settled** column and badge. Files: `apps/web/src/routes/_next/expenses/invoices.tsx`. · **Agent B (frontend)**

**Acceptance.** Journey 6 in the browser; tests pass.

---

## 6. Delegation & Parallelization Plan

| Agent | Type | Model | Effort | Tasks | Owns (edits) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.3 | `modules/expense/settlement-fx.ts` [NEW], `…/settlement-fx.test.ts` [NEW], `routers/expense/write-offs.ts`, `routers/expense.cross-currency-writeoff.test.ts`, `routers/expense.ledger.test.ts` | `modules/setting/fx-settings.ts`, `routers/expense/exchange-rate.ts`, `routers/expense/shared.ts`, `modules/expense/money.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.4, 3.4, 3.5, 4.2 | `apps/web/src/routes/_next/expenses/payments.tsx`, `…/write-offs.tsx`, `…/invoices.tsx`, `apps/web/src/components/list-default-columns.ts` | `apps/web/src/components/confirm-dialog.tsx`, `apps/web/src/lib/expense.ts`, `apps/web/src/utils/orpc.ts` |
| Agent C (backend) | backend-engineer | opus | high | 2.1–2.4 | `routers/expense/write-offs.ts`, `routers/expense.concurrency.test.ts` (own `describe` only) | `modules/governed/writer.ts`, `modules/audit/gates.ts`, step 24 and 25 plans (lock order) |
| Agent D (backend) | backend-engineer | sonnet | medium | 3.1–3.3, 3.6 | `routers/expense/payments.ts`, `modules/expense/permissions.ts`, `routers/expense/write-offs.ts` (`reverse` input only), the five test files of 3.2, `routers/expense.payment-update.test.ts` [NEW], `seed/money.ts` | `permissions/registry.sync.test.ts`, `roles.ts`, `serialize.ts` |
| Agent E (backend) | backend-engineer | sonnet | medium | 4.1 | `modules/expense/invoice-settlement.ts` [NEW], its test, `routers/expense/invoices.ts` (`list` only) | `schema/expense.ts` |

All paths under `packages/api/src/` unless they start with `apps/`, `seed/` or `packages/db/`.

**Schedule:** Phase 1 (A then B) → Phase 2 (C) → Phase 3 (D and B in parallel: D owns server files, B owns pages; B builds against D's contract in §4.4–4.5) → Phase 4 (E then B). `write-offs.ts` is owned by one agent per phase. `expense.concurrency.test.ts` is shared with steps 21, 22, 24 and 25, each adding its own block; the second to merge rebases.

**Contract between A/C/D and B:** `verify` output gains `fxUnknown`; `reverse` input requires `reason`; `payments.update` input is `{ id } & Partial<create input with nullish optionals>` and returns the masked row like `create`.

---

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`)

- **`writeOffs.verify`.** Web `payments.tsx:722`. Seed: none (`seed/money.ts` names it in comments only). Tests: `expense.ledger`, `expense.corrections`, `expense.cross-currency-writeoff`, `expense.base-currency`, `expense.wave1`, `expense.transaction-integration`, `expense.rbac`, `expense/exchange-rate.test.ts`, `serialize.test.ts`, `architecture.test.ts` (enumeration `:435-437`, `:684-685`). Output gains one field; no reader breaks.
- **`writeOffs.reverse`.** Web `write-offs.tsx:414-425, 456`. Tests: 16 calls in five files (§4.5). All must pass a reason after Task 3.2. `architecture.test.ts:438-444, 686` unchanged. Step 25 D6-A's sentence names the action ("Void write-off"), which keeps its name.
- **`payments.create` / `payments.delete`.** Unchanged. Web `payments.tsx:185, 1004`; `seed/money.ts:316`; tests listed in Phase 0.
- **`bill.fx_gain_loss` / `write_off.fx_gain_loss` readers.** `bills.ts:288-295` (filters), `bills.ts:1095` (derived-field note), `modules/export/month-end.ts:318, 359`, `routers/report.ts:2891`. New settlements carry NULL where they used to carry an invented figure; readers already handle NULL (`month-end.test.ts:305`).
- **`bill.status` written by verify/reverse.** Unchanged values (`:694`, `:1124`). Readers: fee alert, labels, bills list, `invoices.cancel`, step 24 Phase 3.
- **`invoices.list`.** Web `invoices.tsx`; output gains two fields (Phase 4).
- **`EXPENSE` nodes.** New `paymentUpdate`; `roles.ts` inherits it for `expense` root holders; `seed/assign.ts` maps nodes to queues and needs nothing. The `permission_node` catalog has no row for it until Wilfred runs the X37 INSERT (§4.4); until then only root holders reach it, and no custom role or member can be granted it.

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| USD receipt vs MYR bill at 4.2 | −3,200.00 FX booked | NULL | API-only |
| USD receipt vs USD bill, bill rate NULL | invented gain | NULL + toast note | API first: note missing until web lands, harmless |
| Receipt vs payable bill | 200, payable marked paid | 400 | API first: picker still offers it, server refuses with a sentence |
| Two verifies, one receipt | both 200, receipt over-spent | one 200, one 400 | API-only |
| Void | no reason | reason required | **Web must deploy with or before API** for Phase 3: an old page sends `{ id }` and would get 400 on every void |
| Edit payment | impossible | `payments.update` | Web without API: Edit icon 404s; deploy API first |
| Invoice paid? | no answer | Settled column | Web without API: column empty |

### 7.3 Behaviour change for existing orgs and live data

- **Phase 1 changes every org at once.** New cross-currency settlements book less FX. Settlements already booked keep their figures (D11-A); 26-P1 sizes them. Wrong-side verifies start refusing; 26-P3 sizes how often it happened.
- **Phase 2** adds waits of milliseconds on contended rows; no visible change except the refused loser.
- **Phase 3** makes the void reason mandatory for everyone. Payments stuck by F4 (26-P4) become editable.
- Nothing is repaired automatically.

### 7.4 Nullable assumptions

- `bill.exchange_rate` is nullable (`schema/expense.ts` bill, "doc-level FX"); §4.1 now treats NULL on a foreign bill as unknown, not 1. `bills.totals` and `billTotals` still read NULL as 1 (accepted gap, confirmed 2026-09-21).
- `payment.exchange_rate` is NOT NULL DEFAULT 1; a stored 1 on a foreign payment is read as unknown by verify only.
- `write_off.bill_id` is nullable (`ON DELETE SET NULL`); the side rule on a line target reads `cost_line.attribute`, so a write-off whose bill was later dissolved is unaffected.
- `reportingCurrency` can return NULL (`fx-settings.ts:212-224`); §4.1 rule 1.

### 7.5 Deployment coupling

- Phases 1 and 2 are API-first and safe either way round.
- Phase 3 must ship **web and API together** (the reason field). After the deploy, and before any grant of `expense.payment.update` to a custom role or member, Wilfred runs the X37 catalog INSERT on production and the read-only check (§4.4). Build `apps/web` first so a partial deploy does not split them (memory `alchemy-partial-deploy-splits-the-stage`, `prod-deploy-recipe`).
- Phase 4 is API-first.

### 7.6 Merge order against steps 02–27

| Plan / phase | Shared code | Order and reason |
|---|---|---|
| **23 Phase 1** (`step-23-bill-approval-integrity.md`) | `modules/audit/resources.ts` bill `exists` `FOR UPDATE`; `write-offs.ts` gate calls must stay (`:491`) | 23 P1 before **26 P2**: the in-transaction gate read serialises against submit only once `exists` locks the bill. 26 keeps both `write_off` calls and the `cancel_write_off` call. |
| **24 Phase 2** (`step-24-invoice-issue-integrity.md` D3-A) | lock order lines `(created_at, id)` → bill; `expense.concurrency.test.ts` (issue vs verify case) | Same order as D5-A. Either merges first; the second rebases the test file. 24's issue-vs-verify case re-runs after 26 P2. |
| **24 Phase 3** | `write-offs.ts:694` (`written_off` for an un-invoiced bill), `:1124` (`done → invoiced`) | 26 changes neither. 24's Phase 3 tests re-run after 26 P1 and P2. |
| **25 Phase 2** (`step-25-invoice-document-truth.md` D7-A, `:246-247`, `:298-299`, `:498`) | cancel locks **bill → lines by id**; `expense.concurrency.test.ts` | **Settled by crosscheck X30.** 25's written order was the reverse of 24's and 26's, and a cancel and a verify on one bill could deadlock. X30 settled one order for all three: 25 D7 keeps option A and, after its pinned `UPDATE invoice`, locks lines `(created_at, id)` then bills by id; all three map `40P01` to CONFLICT. 25 names "Void write-off" in a sentence; 26 keeps that label. |
| **25 Phase 1–2** | `invoices.ts` (`cancel`, loader, `document`), `invoices.tsx` (preview) | **26 P4 after 25 P2**: different procedure (`list`) and different page region, same files. |
| **22 Phase 1** | `cost-lines.ts` `createBill` (bill rate, company) | No shared function. 22 adds a block to `expense.concurrency.test.ts`. |
| **21 Phases 1–2** | `expense.concurrency.test.ts` | Own block each; second rebases. |
| **20** (`step-20-fee-entry-integrity.md`) | cost-line settlement company; line rates | No shared code. If 20 gives cost lines a company, a later plan can match payments by company; 26 does not depend on it. |
| **02 Phase 1** | `bills.invoice` credit check | No overlap. |
| **27** (planned; `step-27-month-close-truth.md`, settled 2026-09-21) | reads `payment.exchange_rate`, `bill/write_off.fx_gain_loss`; month-end | Settled 2026-09-21: F6's old payments at rate 1 (`getReceiptPayment`, the pack) and `bills.totals`/`billTotals` reading a NULL bill rate as 1 are **accepted gaps**. Step 27 restates no FX booked before 26 P1 (26 D11-A). |

**Required order:** 26 P1 (independent) → [23 P1 merged] → 26 P2 → 26 P3 → [25 P2 merged] → 26 P4. One phase per worktree, sequentially.

### 7.7 Read-only production probes (SELECT only; Wilfred runs them; none blocks Phase 1 code)

`bill.fx_gain_loss_currency` is stamped with the reporting currency at settlement (`write-offs.ts:703`), so the probes use it as the reporting currency where a settlement exists, and `team.currency` otherwise (an org-level base currency, if set, overrides the branch's; note it when reading 26-P8).

```sql
-- 26-P1 FX booked on the two fabricated routes (D1, D11)
select w.organization_id, p.currency as pay_ccy, b.currency as bill_ccy,
       b.fx_gain_loss_currency as local_ccy,
       case when p.currency <> b.currency then 'cross' else 'same, bill rate null' end as route,
       count(*) as write_offs, sum(w.fx_gain_loss::numeric) as fx_booked
from write_off w
join payment p on p.id = w.payment_id
join bill b on b.id = w.bill_id
where w.voided_at is null and w.fx_gain_loss is not null
  and (   (p.currency <> b.currency and p.currency <> b.fx_gain_loss_currency and p.exchange_rate = 1)
       or (p.currency = b.currency and b.currency <> b.fx_gain_loss_currency and b.exchange_rate is null))
group by 1, 2, 3, 4, 5 order by 1, 2, 3;

-- 26-P2 Over-spent receipts and over-settled lines (D4, D11)
select organization_id, payment_no, direction, currency, amount, written_off_amount
from payment where written_off_amount > amount + 0.000001
order by organization_id, payment_no;
select organization_id, id, bill_id, currency, amount, written_off_amount
from cost_line where amount > 0 and written_off_amount > amount + 0.000001
order by organization_id, bill_id;

-- 26-P3 Live write-offs on the wrong side, by payment way (gates D3)
select w.organization_id, p.direction, b.attribute, coalesce(p.payment_way, 'none') as way,
       count(*) as write_offs, sum(w.amount::numeric) as amount
from write_off w
join payment p on p.id = w.payment_id
join bill b on b.id = w.bill_id
where w.voided_at is null
  and ((p.direction = 'receipt' and b.attribute = 'payable')
    or (p.direction = 'payment' and b.attribute = 'receivable'))
group by 1, 2, 3, 4 order by 1, 2, 3, 4;

-- 26-P4 Payments stuck by F4: nothing live, at least one voided write-off (D6)
select p.organization_id, p.currency, count(*) as payments, sum(p.amount::numeric) as amount
from payment p
where p.written_off_amount = 0
  and exists (select 1 from write_off w where w.payment_id = p.id)
  and not exists (select 1 from write_off w where w.payment_id = p.id and w.voided_at is null)
group by 1, 2 order by 1, 2;

-- 26-P5 Voids: how many, how many without a reason, how many by the person who booked them (D7)
select organization_id, count(*) as voids,
       count(*) filter (where void_reason is null or btrim(void_reason) = '') as no_reason,
       count(*) filter (where voided_by = created_by) as self_voided
from write_off where voided_at is not null
group by 1 order by 1;

-- 26-P6 Bill flow gates per org (D7: is cancel_write_off ticked anywhere?)
select f.organization_id, f.enabled,
       string_agg(g.gate_key, ',' order by g.gate_key) as gates
from audit_flow f left join audit_flow_gate g on g.flow_id = f.id
where f.trigger_type = 'bill'
group by 1, 2 order by 1;

-- 26-P7 Bills whose every line is settled but which never advanced (F2 residue, D11)
with cov as (
  select bill_id, bool_and(written_off_amount >= amount) as all_settled, count(*) as lines
  from cost_line where bill_id is not null group by bill_id)
select b.organization_id, b.status, count(*) as bills
from bill b join cov on cov.bill_id = b.id
where cov.all_settled and b.status in ('open', 'invoiced')
group by 1, 2 order by 1, 2;

-- 26-P8 Foreign-currency payments stored at rate 1 (D2; accepted gap, confirmed 2026-09-21)
select p.organization_id, p.currency, t.currency as branch_ccy,
       count(*) as payments, sum(p.amount::numeric) as amount
from payment p join team t on t.id = p.owning_branch_id
where p.currency <> t.currency and p.exchange_rate = 1
group by 1, 2, 3 order by 1, 2;

-- 26-P9 Line drift: stored written-off amount vs the sum of live split rows
--      (legacy write-offs without split rows show here too; read with 26-P2)
with s as (
  select wl.cost_line_id, sum(wl.amount::numeric) as total
  from write_off_line wl join write_off w on w.id = wl.write_off_id
  where w.voided_at is null group by 1)
select cl.organization_id, count(*) as lines
from cost_line cl left join s on s.cost_line_id = cl.id
where abs(cl.written_off_amount::numeric - coalesce(s.total, 0)) > 0.000001
group by 1 order by 1;

-- 26-P10 Invoices whose bills carry live settlements (sizes D8)
select i.organization_id, count(distinct i.id) as invoices
from invoice i
join invoice_bill ib on ib.invoice_id = i.id
join write_off w on w.bill_id = ib.bill_id and w.voided_at is null
where i.state = 'issued'
group by 1 order by 1;
```

### 7.8 Blocking prerequisites

- Phase 1: D1-A, D3-A, D9-A decided; 26-P3 read (re-plan D3 to B if it shows `reconciliation` wrong-side use).
- Phase 2: D4-A, D5-A decided (the X30 order, which steps 24 and 25 carry); step 23 Phase 1 merged.
- Phase 3: D2-A, D6-A, D7-A decided; Phase 2 merged; the X37 catalog row on dev before the Phase 3 proof.
- Phase 4: D8-A chosen; step 25 Phase 2 merged.

---

## 8. Cross-Cutting Concerns

1. **Permissions.** One new node (`expense.payment.update`), inherited by the three roles that already record payments. No role file change. Its `permission_node` catalog row is an owner-run INSERT (§4.4, X37), not a migration. `registry.sync` and `reachability` tests run in Task 3.3.
2. **Field masks.** `payments.update` strips denied optional columns and refuses a denied `settlementUnit`, like `create` (`payments.ts:317-332`). `invoices.list` new fields are money on a row the caller can already read.
3. **Audit.** `payments.update` writes `expense.payment.update` with before/after through the writer. `reverse` already stores `voidReason` on the row and `before: wo` in its audit row.
4. **Row locking.** New: payment, then lines `(created_at, id)`, then bill `FOR UPDATE`, in verify and reverse. Bounded by one bill's lines. Same order as steps 24 and 25 (X30).
5. **Numbers and rounding.** `settlementFx` uses `roundMoney` once, as `:691` does.
6. **Copy.** Every new sentence is in §2 and §4; grep `payments.tsx`, `write-offs.tsx`, `invoices.tsx`, `lib/expense.ts` and `customer-intake-sop/sop.json` for "Void write-off", "Verify", "Edit" before closing each phase (project CLAUDE.md "Shared Copy").
7. **SOP page.** Step 26's guide text changes (pitfalls, void, result; §9 "SOP text vs code"). Before editing it, read `C:/Project/ZYT-Task/hosting/SITE.md` (project CLAUDE.md "Staff SOP page"); a `/zyt-update` pass after each phase lands is available to Wilfred, not assigned (crosscheck X39: accepted unowned gap; this plan edits no SOP text).
8. **Tests on real Postgres.** CI has no `DATABASE_URL_TEST`; each Phase 2 PR pastes the real-Postgres output with test names.
9. **UK spelling** in all new copy ("serialise", "organisation").

---

## 9. Decision Register, Open Questions & Risks

On 2026-09-21 Wilfred accepted the recommended option of every decision below, and every Proposed reading in `steps-20-26-crosscheck.md` X28–X40; where an X-item adds to or overrides this plan's own recommendation, the Chosen line says so. Each keeps its three approaches.

**D1: How is the exchange difference on a settlement computed?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Phase 1

| | Approach | Trade-off |
|---|---|---|
| **A** | **Derive the payment's base rate (reporting currency → 1; bill in reporting currency → the 核销汇率; an explicit stored rate; else the org write-off rate); treat a NULL rate on a foreign bill as unknown; book nothing and say so when either side is unknown** (Recommended) (Chosen) | No migration, no web change needed. Correct for the common case (foreign receipt against a local bill books 0). Settlements with no rate on file book no FX until a rate exists; the toast says why. |
| B | Stop booking FX on every cross-currency settlement; keep same-currency FX | Smallest change. Loses real FX where both rates are known (the +240 test case), which the owner ruling of 2026-08-17 wanted. |
| C | Require `exchangeRate` on every foreign-currency payment and trust it | Fixes new payments only; every existing payment still books at 1; blocks recording a receipt until someone knows the bank rate. |

- **Chosen: A** (Wilfred, 2026-09-21).

**D2: Does the payment sheet capture an exchange rate?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 3.4

| | Approach | Trade-off |
|---|---|---|
| **A** | **Optional field, shown only when the currency differs from the reporting currency, prefilled from the org's `write_off` rate through `exchangeRates.suggest`** (Recommended) (Chosen) | Lets accounting record the bank's real rate; improves payment totals and step 27 for new rows. Which rate type a payment should seed from is the open eyun capture question (`payments.ts:358-362`); `write_off` is the closest. |
| B | Server seeds the rate silently at create, no field | No UI; the stored figure looks authoritative though nobody typed it — the reason the current code declines to seed. |
| C | No field; leave payment conversion to step 27 | Nothing changes here; the ledger item stays half open and every foreign payment stays at 1. |

- **Chosen: A** (Wilfred, 2026-09-21).

**D3: Can a receipt settle a payable bill (and a payment a receivable one)?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.2 · Re-check 26-P3 first

| | Approach | Trade-off |
|---|---|---|
| **A** | **Refuse the wrong side on the server; the pickers show only the payment's side** (Recommended) (Chosen) | Closes F3. If an org nets receivables against payables through a write-off, it loses that route (26-P3 shows whether any does). |
| B | Refuse unless the payment's way is **Reconciliation** (treated as an offset) | Keeps a possible netting use; guesses what eyun means by the way, which has not been captured. |
| C | Filter the pickers only; the server still accepts | UI-only; RPC and stale tabs still settle the wrong side. |

- **Chosen: A** (Wilfred, 2026-09-21). Re-check before Task 1.2: probe 26-P3; if it shows live `reconciliation` wrong-side use, stop and re-plan to B.

**D4: How are verify and void serialised?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Phase 2

| | Approach | Trade-off |
|---|---|---|
| **A** | **Lock payment, lines and bill `FOR UPDATE` inside the transaction and recompute every figure from the locked rows; gate reads on the transaction** (Recommended) (Chosen) | Closes all four races (double spend, double settle, bill not advancing, gate window). Needs a real-Postgres test and an agreed lock order (D5). |
| B | Conditional atomic updates (`… WHERE written_off_amount + x <= amount`, CONFLICT on 0 rows), no locks | No lock-order coordination. Leaves the sibling-line race (bill never advances) and the gate window; zero-amount lines need a special case. |
| C | Add `written_off_amount <= amount` CHECKs (`00NN_written_off_within_amount`) | A migration; turns the race into a 500 on live data, which `schema/expense.ts:585-589` explicitly rejected; zero-amount lines break the line CHECK. |

- **Chosen: A** (Wilfred, 2026-09-21). Depends on step 23 P1 (the bill `exists` `FOR UPDATE`) merged before 26 P2.

**D5: Which lock order do steps 24, 25 and 26 share?** · Status: **Decided 2026-09-21 — Chosen: A (per X30)** · Blocks: Phase 2 here, 24 Phase 2, 25 Phase 2

| | Approach | Trade-off |
|---|---|---|
| **A** | **Payment (if any) → cost lines `(created_at, id)` → bill, for verify, void, issue, cancel and unbill** (Recommended) (Chosen) | Matches today's unbill and reverse and step 24's plan; step 25 changes its cancel order. |
| B | Bill → cost lines by id (step 25's order) everywhere | Matches 25; step 24 and this plan change, and the governed writer's unbill (line, then bill) must change too. |
| C | A per-bill transaction advisory lock taken first by every ledger writer | Row order stops mattering; a new convention every future writer must remember, and the governed writer needs a hook. |

- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X30 settled it for 24, 25 and 26: payment (verify and void only) → cost lines `(created_at, id)` → bills `ORDER BY id`; step 25 D7 keeps option A in this order after its pinned `UPDATE invoice`, step 24's issue takes it too, and all three map `40P01` to CONFLICT.

**D6: How is a settled-then-voided payment corrected?** · Status: **Decided 2026-09-21 — Chosen: A (plus X37)** · Blocks: Task 3.1

| | Approach | Trade-off |
|---|---|---|
| **A** | **`payments.update` while nothing live is settled against the payment; voided write-offs stay as history** (Recommended) (Chosen) | No migration; the handler comment anticipates it. A corrected payment keeps voided history recorded against its old figures (the audit row keeps both). |
| B | "Void payment" (`00NN_payment_void`: `voided_at`, `voided_by`, `void_reason`), excluded from totals and pickers, then record a new one | Best accounting trail. A migration, plus every payment reader must add a `voided_at IS NULL` filter. |
| C | Let delete succeed once every write-off is voided, with `write_off.payment_id` `ON DELETE SET NULL` (`00NN_write_off_payment_set_null`) | Simple for staff; the voided write-offs lose their payment and their currency (reverse reads it, `:923-930`). |

- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X37 adds the `expense.payment.update` `permission_node` row by an owner-run, reviewed `INSERT … SELECT … ON CONFLICT (key) DO NOTHING` on step 13 D12-A's path (§4.4, Task 3.1), dev before the Phase 3 proof, production after the deploy.

**D7: What does a void need?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 3.2

| | Approach | Trade-off |
|---|---|---|
| **A** | **A written reason, required by the server, shown with who voided on the Write-offs list** (Recommended) (Chosen) | Small; makes every void explainable. It is accountability, not a second signature. |
| B | A + the voider must differ from the member who booked the write-off (unless no other member holds `expense.writeOff.reverse`) | A real four-eyes rule; the "unless" needs a holder count like step 08's `eligibleReviewerCount`; blocks a one-accountant org's routine fixes. |
| C | Seed `cancel_write_off` ticked for new orgs | Looks like a control and freezes nothing on the normal path (F5); listed so it is not chosen by accident. |

- **Chosen: A** (Wilfred, 2026-09-21). Columns hidden by default (the note below).

Note for D7: whether **Void reason** and **Voided by** show by default (`MUST_SHOW_COLUMNS`) is a copy choice inside A; default hidden unless Wilfred says otherwise.

**D8: Does step 26 answer "is this invoice paid?"** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Phase 4

| | Approach | Trade-off |
|---|---|---|
| **A** | **Derive a settled figure per invoice from the two per-line splits, first-invoiced first, on `invoices.list`** (Recommended) (Chosen) | Read-only, no migration. The FIFO rule is a convention: a line settled 500 across invoices of 400 and 600 reads the first one paid. |
| B | Record settlement against an invoice (`00NN_write_off_invoice`, `write_off.invoice_id`) and let Verify target an invoice | Exact; a migration, a new target type and a new spread. |
| C | Defer; leave the question to step 27's statements | Nothing here; the ledger item stays open. |

- **Chosen: A** (Wilfred, 2026-09-21). Phase 4 stays optional.

**D9: What does the Verify picker offer?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.4

| | Approach | Trade-off |
|---|---|---|
| **A** | **The payment's side only, minus bills `written_off`/`done` and fully settled lines (client-side filter)** (Recommended) (Chosen) | Shorter list; nothing the server would refuse for being settled. Still capped at 200 per query. |
| B | Also hide bills whose Bill review is not approved | Needs a review-state read per bill; the server sentence already explains it. |
| C | Unchanged | Staff keep picking targets that bounce. |

- **Chosen: A** (Wilfred, 2026-09-21).

**D10: The cross-currency void give-back crumb** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: nothing

| | Approach | Trade-off |
|---|---|---|
| **A** | **Accept and flag; below 0.00001 in practice, hidden by 2-dp display** (Recommended) (Chosen) | No change. A payment can show a millionth unwritten. |
| B | Read the give-back from the verify audit row's `appliedPayment` | Exact; makes a money figure depend on the audit log. |
| C | Store it (`00NN_write_off_payment_amount`) | Exact; a migration for a millionth. |

- **Chosen: A** (Wilfred, 2026-09-21).

**D11: What happens to residue already stored (26-P1, P2, P3, P7, P9)?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: nothing in code

| | Approach | Trade-off |
|---|---|---|
| **A** | **Report only; accounting voids and re-verifies by hand where it matters** (Recommended) (Chosen) | No automated money edits. Old FX figures stay until someone voids those write-offs. |
| B | A one-off repair script, run by Wilfred on the dev branch then production | Faster; an automated rewrite of booked money, needs its own review. |
| C | Step 27 restates FX in reports without touching rows | Rows stay wrong; every report must repeat the rule. |

- **Chosen: A** (Wilfred, 2026-09-21).

### Open questions

- Q1 (D3): does any org settle across sides on purpose? 26-P3 answers it.
- Q2 (D2): which eyun rate type seeds a payment? Still the capture question at `payments.ts:358-362`.
- Q3 (D5): answered by crosscheck X30; steps 24, 25 and 26 share one order.

### Risks

- **Lock order drifts from X30** → a deadlock between issue/cancel and verify. Mitigation: D5-A (X30) is written into 24, 25 and 26; `40P01` maps to CONFLICT; each lock-changing PR re-runs every case in `expense.concurrency.test.ts` (X35).
- **An org uses wrong-side settlements** → D3-A blocks a routine. Mitigation: 26-P3 before Task 1.2.
- **Tests that call `reverse` without a reason** are easy to miss. Mitigation: grep `writeOffsRouter.reverse` after Task 3.2; count must match 16 plus new ones.
- **Old pages after Phase 3** send voids with no reason. Mitigation: deploy web with API (§7.5).
- **FX residue** stays in historical month-end figures. Mitigation: D11, 26-P1, step 27.
- **Phase 4 FIFO** may not match how accounting thinks of partial invoices. Mitigation: D8-A keeps Phase 4 optional; it can be dropped.

### SOP text vs code (Phase 0 wins)

1. Pitfall "A payment that has been written off cannot be deleted; void the write-off first." — **Wrong.** Voiding does not make it deletable: a payment with any voided write-off is refused too (`payments.ts:141-152`), and there is no edit (`:375-377`). Changed by Phase 3 (D6-A): "void the write-off first, then **Edit** the payment".
2. Guide `role`: "Cashier / Accounting" — there is no cashier role; the nodes are held by admin, branch-manager and accounting (`roles.ts` `MODULE_ROLE_GRANTS`); director and viewer only read.
3. Writes: "Any FX gain or loss on a cross-currency settlement, written to the bill." — true mechanically, but the figure is invented whenever the payment is not in the reporting currency (F1), and also for a same-currency settlement on a bill with no rate. Changed by Phase 1.
4. Result: "done on the normal path, since step 24 invoiced it" — only when the bill was **fully** invoiced; a partly invoiced bill goes `written_off` (`write-offs.ts:694`). Step 24 Phase 3 changes what happens next.
5. Void: "Payment balance and each cost line get back exactly what was taken" — the lines do; across currencies the payment gets back a recomputed figure (`:957`), which can differ by a millionth (D10).
6. Pitfall "voiding [is frozen] by the Cancel the verification gate, where ticked" — true, but on the normal path that gate cannot freeze anything, because the bill was already approved to be written off (F5).
7. Golden step "Options show number and currency; only billed cost lines are offered" — true, but bills of **both** sides and every status are offered (`payments.tsx:517-552`). Changed by Phase 1.
8. Watch: "Settlement attaches to the bill, never the invoice … 'is this invoice paid?' has no answer on any screen" — true (F7). Changed by Phase 4 if D8-A.
9. Everything else in step 26's `golden`, `fields` and `pitfalls` matches the code at the cited lines (checked: `payments.tsx:257, 294, 316, 466, 593, 637, 680, 736, 899`; `write-offs.tsx:296`; `write-offs.ts:303, 322, 367, 895`). The guide's `payments.tsx:1222` is one line off the **Add** action (`:1223`).

---

## 10. Verification & Proof

### Tests

- **New:** `modules/expense/settlement-fx.test.ts` (Task 1.1); `routers/expense.payment-update.test.ts` (Task 3.3); `modules/expense/invoice-settlement.test.ts` (Task 4.1).
- **Extended:** `expense.cross-currency-writeoff.test.ts` and `expense.ledger.test.ts` (Task 1.3); `expense.concurrency.test.ts` four cases × 20 on real Postgres in 26's own `describe`, plus a re-run of every other case in the file (Task 2.3, X35); the five `reverse` callers (Task 3.2).
- **Re-run unchanged:** `expense.base-currency`, `expense.corrections`, `expense.wave1`, `expense.transaction-integration`, `expense.rbac`, `expense.filters`, `expense.bills`, `expense.numbering`, `expense/exchange-rate.test.ts`, `serialize.test.ts`, `modules/export/month-end.test.ts`, `permissions/registry.sync.test.ts`, `permissions/reachability.test.ts`, both `architecture.test.ts` files (memory `two-architecture-tests`), and step 24's Phase 3 tests once merged.
- **Type-check:** `bun run check-types`, read for "failed" (memory `vp-run-exit-code-lies`).
- Judge every run by its output, never its exit code.

### Browser (in-app browser, web `http://localhost:3101`, server `:3000`)

Setup: a freshly seeded e2e org (`bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>`), logged in as an **accounting** actor from `ACTORS` (re-read `seed-cli.ts` at the base commit; memory `browser-verification-via-seed-parity`). Its Bill review ticks `write_off`, so approve the test bills through both stages first (as `seed/money.ts:1-30` describes). Assert on the DOM, not screenshots (memory `blank-screenshot-is-not-blank-page`); confirm console errors in a new tab (memory `browser-console-buffer-survives-reload`). Check which org the shared session is on before each walk (memory `shared-session-active-org`). Before the Phase 3 walks, confirm on dev that `SELECT key, parent_key, is_endpoint FROM permission_node WHERE key = 'expense.payment.update'` returns a row (X37).

**Golden path (Journey 1).** Create a MYR receivable bill of 4,200.00, approve and invoice it. **Money > Payments → Add**: Receipt, Settlement Unit exactly as the bill, USD, 1000 → the rate row appears (Phase 3) → **Add Payment** → toast. **Verify** → the Bill list holds the bill and no payable bill → rate 4.2 → preview line → **Verify** → toast. Open **Money > Bills**: the bill reads Done and FX gain/loss is empty. Open **Money > Write-offs**: the new row, FX empty.

**Edge case 1 (Journey 2).** Same Settlement Unit, a payable bill exists → not in the list. Through the browser console, `fetch('/rpc/writeOffs/verify', …)` naming it → 400 with the side sentence; the payable bill is unchanged.

**Edge case 2 (Journey 4 and 5).** Record MYR 10,000 by mistake, verify 1,000 of it against a bill. On **Write-offs**, **Void write-off** → **Void Write-off** stays disabled until a reason is typed → void → the row shows the reason and your name. On **Payments**, **Edit** is enabled → Price 1000 → **Save** → toast; the row reads 1,000.00. **Delete** on the same row → toast with the voided-history sentence. **Edit** on a payment with a live write-off → disabled.

**Edge case 3 (Journey 3).** Two tabs, two accountants (or one accountant, two tabs), one MYR 1,000 receipt and two MYR 1,000 bills; press **Verify** in both within a second → one success toast, one balance toast; the payment row reads 1,000.00. (The deterministic proof is the real-Postgres test; this walk is a smoke check.)

**Edge case 4 (Journey 1 step 5).** USD receipt against a USD bill whose Exchange rate is empty on **Money > Bills** → toast includes the "no exchange gain or loss booked" sentence; FX empty.

**Edge case 5 (Journey 6, Phase 4 only).** Invoice a bill 400 then 600 (two invoices), settle 500 → **Money > Invoices** shows the first Paid 400.00 and the second Part paid 100.00; void the write-off → both Unpaid.

### Evidence to file per phase

Test output with names; the real-Postgres output (Phase 2) including the failing run against the old handler; DOM assertions or the walk's recorded video for each journey above; the probe results Wilfred chooses to share.

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and the Proposed reading of every cross-plan item in `steps-20-26-crosscheck.md` (X28–X40). Each §9 entry keeps all three approaches; only the status, the Chosen line and the text that described a decision as open were changed, plus the task text the crosscheck items below required.

**Chosen:** D1-A · D2-A · D3-A (re-check 26-P3 before Task 1.2; re-plan to B if reconciliation use appears) · D4-A (step 23 P1 merged first) · D5-A (X30) · D6-A (+ X37 catalog row) · D7-A · D8-A (Phase 4 stays optional) · D9-A · D10-A · D11-A.

**Crosscheck items as they land in this plan.** X30 → D5-A is the shared order (payment → lines `(created_at, id)` → bills by id); step 25 D7 takes it after its pinned `UPDATE invoice` and step 24's issue takes it too, so the old "step 25 changes its cancel order" text now records X30's settlement; `40P01` → CONFLICT added (header, §1 decisions, §4.3, §4.10 item 4, §5 Phase 2 dependencies and Tasks 2.1–2.2, §7.6 step 25 row and required order, §7.8, §8 item 4, D5, Q3, Risks). X35 → 26's own `describe` in `expense.concurrency.test.ts`, never editing another's; Phase 2's PR pastes both runs and re-runs every case in the file (Task 2.3, §10 Tests, Risks). X37 → the `expense.payment.update` `permission_node` row by owner-run INSERT on step 13 D12-A's path (§4.4, Task 3.1, Phase 3 dependencies and acceptance, §7.1, §7.5, §7.8, §8 item 1, §10 browser setup, D6). X38 → every conditional migration here sits in a non-chosen option (D4-C, D6-B, D6-C, D8-B, D10-C); no migration (§4.8). X39 → the corrections in §9 "SOP text vs code" are an accepted unowned gap; §8 item 7 no longer assigns a `/zyt-update` pass. X40 → step 27 "(no plan yet)" in §7.6 left as is. X28, X29, X31–X34, X36 → do not touch this plan; no text change.
