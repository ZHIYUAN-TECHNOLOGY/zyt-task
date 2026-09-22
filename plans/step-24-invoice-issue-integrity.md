# Step 24 — the invoice carries the title accounting typed, a typed number cannot jam numbering, issuing takes the same locks as every other money write, and a paid bill can still be invoiced

**SOP step:** 24 "Issue the invoice" · `/expenses/bills` (page title **Bill Management**) → row icon **Invoicing** → dialog **Invoicing — <bill no>** → **Issue Invoice**
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` (`feat/new-layout`), 2026-09-21. The `nct-layout` working tree is checked out on `feat/intake-golden-path-e2e` at `ea1560e7`, and `git diff --stat 6bb3a1bf HEAD -- packages apps` is empty, so every `file:line` below matches `6bb3a1bf`. Every citation was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Standard. One money-minting handler (`billsRouter.invoice`), one dialog, one row-action condition. No migration under any recommended option. Phase 2 changes the lock order of a money transaction and must be proven on real Postgres, not PGlite.
**Cross-plan items owned:** none handed over by name. The ledger item **"Credit is captured and never enforced"** (`sop.json` `ledger.items[15]`, id `credit`, repairs `s24` and `s02`) is **already planned by step 02 Phase 1** (`step-02-credit-and-duplicates.md` §4 "`bills.invoice`" and Tasks 1.2–1.4). This plan does not re-plan it; it fixes the merge order (D6, D7).
**Status:** every decision in §9 is **Decided** (Wilfred, 2026-09-21: the recommended option throughout; no crosscheck X-item picks a different option here, and the X-item consequences are listed in "Decisions settled" at the end).

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope` at `procedures/org.ts:429`). Drizzle schema in `packages/db/src/schema`, migrations in `packages/db/src/migrations`. TanStack Router file routes in `apps/web/src/routes/_next`. zod on both sides. vitest on PGlite (`pushTestSchema`), plus one real-Postgres suite, `packages/api/src/routers/expense.concurrency.test.ts`, gated on `DATABASE_URL_TEST` (`:26`). Dev: web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Entry.** Nav `Money > Bills` → `/expenses/bills`, permission `expense:read` (`apps/web/src/components/shell-next/nav.ts:231`). Row icon `title="Invoicing"` (`apps/web/src/routes/_next/expenses/-bills.columns.tsx:825`), **disabled unless `status === "open"`** (`:826`), calls `actions.onInvoice` → `setInvoicing` (`bills.tsx:1031`) → `<InvoicingDialog>` (`bills.tsx:1797`).
  - **Dialog** `InvoicingDialog` (`bills.tsx:473`). Category select (`:526`, values `INVOICE_CATEGORIES`, `apps/web/src/lib/expense.ts:166-180`: VAT general, VAT special, Digital electronic Ordinary, Digital electronic Special, **Proforma**). Type select (`:544`; Paper, Electronic, `lib/expense.ts:158-163`). Invoice Number (`:563`, placeholder "Auto-generated if left blank"). Invoice Title (`:572`, prefilled `bill.invoiceTitle ?? ""`, `:498`). Amount (`:580`, prefilled `String(Math.max(Number(total) - Number(invoiced), 0))`, `:499`). **Issue Invoice** (`:603`) is disabled until Category and Type are set or while pending (`:604`) and sends `billIds: [bill.id]`, `amount`, `category`, `type`, `invoiceNumber`, **`invoiceTitle`** (`:618-625`), each through `emptyToUndefined` (trims; blank → undefined, `apps/web/src/lib/quotation.ts:118-122`). Success toasts _"Invoice <no> issued"_ (`:506`) and invalidates bills list/totals, invoices list, cost-lines list (`:507-510`).
  - **Handler** `billsRouter.invoice` (`packages/api/src/routers/expense/bills.ts:1699`), `requireNode(EXPENSE.invoiceCreate)` (`:1700`; node `expense.invoice.create`, `modules/expense/permissions.ts:43`). Held by admin, branch-manager and accounting through the `expense` root (`packages/api/src/roles.ts:90, :104, :175`); ops hold only `expense.costLine` (`:158`); sales, director and viewer hold reads only. In order it:
    1. refuses repeated bill ids (`:1749-1754`);
    2. loads the bills **with `context.db`, outside any transaction, no lock** (`:1756-1759`), NOT_FOUND unless every id is in scope (`:1762`);
    3. `assertGatesCleared(context.db, …, "bill", ids, "input_invoice_no")` (`:1765-1771`), also outside the transaction; the key is ticked by the seeded bill flow (`modules/audit/seed.ts:192`) and declared at `modules/expense/gates.ts:18`;
    4. checks one currency, one branch, one attribute, and `status === "open"` (`:1781-1806`);
    5. refuses a partial `amount` across several bills (`:1808-1813`);
    6. loads every covered bill's cost lines, **again outside the transaction, no lock**, ordered `createdAt ASC` (`:1822-1826`);
    7. computes outstanding `total − invoiced` per bill and refuses fully invoiced (`:1840-1851`), zero or over-balance amounts (`:1853-1861`);
    8. spreads the amount over lines in creation order from those stale rows (`:1874-1903`);
    9. opens the transaction (`:1925`), allocates `NCT-INV-YYYYMM-NNNN` when no number was typed (`:1926-1928`; `makeNo`, `routers/expense/shared.ts:305-308`; counter `allocateNumber(tx, org, "INV")`, org-wide and monotonic, `modules/numbering/allocate.ts`), inserts `invoice` (`:1930-1959`, **`buyer: input.buyer ?? first.invoiceTitle`** at `:1955`), `invoice_bill` (`:1962-1969`);
    10. per bill: `UPDATE bill SET invoiced_amount = LEAST(invoiced + alloc, total), status = 'invoiced' if fully` **WHERE `id`, `status = 'open'`, `invoiced_amount = <read>`** (`:1982-2003`), CONFLICT on 0 rows (`:2004-2008`); inserts `invoice_line` (`:2011-2020`); updates each line **`WHERE id` only**, with `invoicedAmount` and `status = deriveStatus({...staleRow, invoicedAmount})` computed in JS from the pre-transaction read (`:2027-2038`);
    11. writes `expense.invoice.create` to `audit_log` (`:2047-2063`) and returns the invoice and each bill's new status (`:2065-2085`).
  - **Architecture allow-list** for this handler: `update(bill)` and `update(costLine)` (`packages/api/src/architecture.test.ts:404-405`), `insert(invoice)`, `insert(invoiceBill)`, `insert(invoiceLine)` (`:672-674`). This plan adds no write site.
  - **Next step's inputs.** The invoice lands on `/expenses/invoices` (nav label "Invoices", `nav.ts:232`; page title "Invoice Record", `routes/_next/expenses/invoices.tsx:1012`). Step 25's document resolves the buyer name **from `invoice.buyer` first** (`modules/export/invoice-document.ts:331-337`, `resolveBuyer`), then the settlement company, then the bill's title.

- **Finding F1 (the Invoice Title field does nothing): confirmed.** The dialog sends `invoiceTitle` (`bills.tsx:624`). The input schema accepts it (`bills.ts:1719`). **No line of the handler reads `input.invoiceTitle`** (grep of `input.invoiceTitle` in `bills.ts` finds only the list filter at `:250`). The stamped buyer is `input.buyer ?? first.invoiceTitle` (`:1955`), and the dialog never sends `buyer`. So an accountant who corrects the customer's name in the dialog gets a toast of success and an invoice whose buyer, and whose printed document at step 25 (`invoice-document.ts:331`), still carry the bill's old title. No test covers the field (grep of `invoiceTitle` in `expense.*.test.ts` finds bill filters and `bills.update` only).
  - **Adjacent (same lines): the read-implies-write rule is broken for `buyer`/`seller`.** `invoice` declares `buyer` and `seller` maskable (`modules/expense/permissions.ts:251`), and the codebase rule is "a field you cannot READ is a field you cannot WRITE" (`routers/expense.rbac.test.ts:691`, proven for `bills.update` at `:694`). `bills.invoice` writes `input.buyer` and `input.seller` (`:1950`, `:1955`) with no `stripDeniedFields`. No UI sends them, so this is RPC-only.

- **Finding F2 (a typed invoice number can 500, and can jam auto-numbering): confirmed.**
  - The typed number is used verbatim (`:1926-1927`), untrimmed on the server. `invoice_org_number_uq` is a plain unique index on `(organization_id, invoice_number)` (`schema/expense.ts:512`), deliberately kept (`:501-511`), and it covers cancelled invoices too.
  - `bills.invoice` has **no `isUniqueViolation` mapping** (`pg-errors.ts:48` exists; grep of `bills.ts` for it finds nothing). A duplicate typed number therefore surfaces as a raw INTERNAL_SERVER_ERROR, and the dialog toasts that (`bills.tsx:513`). The handler's own comment (`:1909-1912`) says a clash "stays a genuine conflict for the caller to resolve", but the caller is not told which number clashed.
  - **The jam.** The generated branch draws from an org-wide `INV` counter inside the transaction, and "the rollback takes the counter with it" (`modules/numbering/allocate.ts`, docblock "PASS A TRANSACTION"). If anyone ever typed a number of the generated shape `NCT-INV-<this month>-<n>` with `n` ahead of the counter, the auto-numbered issue that reaches `n` collides, rolls back its own counter increment, and the next attempt draws the **same** `n` again. Every auto-numbered invoice in that organisation then fails until someone types a number or the month rolls over. Nothing refuses a typed number of the generated shape.
  - The SOP's field "Invoice Number — auto-generated if blank" is true; its pitfalls are silent on both failure modes.

- **Finding F3 (issuing reads stale rows and locks in the opposite order to every other money writer): confirmed, narrow window, money consequence.**
  - Steps 2, 3 and 6 above read bills, gate state and lines **outside** the transaction under READ COMMITTED. The only guard is the optimistic bill pin `status = 'open' AND invoiced_amount = <read>` (`:1996-2002`). It does **not** pin `total_amount`, and the line updates pin nothing (`:2036`).
  - **Race with `costLines.unbill`** (`routers/expense/cost-lines.ts:1383`). Unbill releases a line (`costLineWriter` verb `unbill`, pin `billId`/`invoicedAmount`/`writtenOffAmount`, `:405-420`) and retotals the bill (`billWriter` verb `retotal`, pin `status`/`totalAmount`/`invoicedAmount`, `bills.ts:513-535`), refusing only when `bill.invoicedAmount ≠ 0` at its own read (`cost-lines.ts:1432-1436`). If an unbill commits between the invoice handler's reads and its bill UPDATE, the bill's `invoiced_amount` is unchanged, so **the invoice pin passes**. The invoice then records its full stale amount on `invoice.amount`, puts invoiced money and an `invoice_line` row on a line that is no longer on the bill, derives that line's status from its stale `billId`, and `LEAST(…, total)` silently clamps the bill. `invoices.cancel` later filters the split by the bill's **current** lines (`invoices.ts:680-682`), so that line's invoiced money is never given back.
  - **Race with `writeOffs.verify`.** Verify updates line written-off amounts and a status derived from its own read of `invoicedAmount` ("invoicedAmount is untouched here, so its coverage is stable from the read", `write-offs.ts:544-553`). The invoice handler updates the same lines with a status derived from its stale `writtenOffAmount`. Whichever commits second writes a status that ignores the other: a line that is both invoiced and written off can read `invoiced_unwritten` or `written_uninvoiced` instead of `done` (`modules/expense/money.ts:47-58`).
  - **Lock order.** Unbill (governed writer `FOR UPDATE`, `modules/governed/writer.ts:234`: line, then bill), verify (lines by `createdAt ASC`, `write-offs.ts:351`, then bill, `:646-708`) and cancel (invoice, lines, then bill, `invoices.ts:639-718`) all take **lines before the bill**. `bills.invoice` takes **the bill before its lines** (`:1982` then `:2030`). Two such transactions on one bill can deadlock; Postgres aborts one with a raw 500.
  - `expense.concurrency.test.ts:137` proves only "two concurrent invoices on one bill issue one" (the pin path). Nothing tests unbill, verify or cancel racing an issue.

- **Finding F4 (a bill that was paid before it was fully invoiced can never be invoiced): confirmed, a dead end.**
  - `writeOffs.verify` never requires an invoice (no status refusal in `write-offs.ts`). A fully written-off bill becomes `done` only if it was already `invoiced`, otherwise `written_off` (`write-offs.ts:694`). That includes a bill **partially** invoiced through step 24's own partial path, because a partial issue leaves it `open` (`bills.ts:1994`).
  - `bills.invoice` then refuses: _"Bill <no> is not invoiceable (status: written_off)"_ (`:1801-1805`), and the row icon is greyed (`-bills.columns.tsx:826`).
  - The rest of the system expects the invoice to follow: the line model has `written_uninvoiced` and `partially_written_uninvoiced` states (`money.ts:55-57`), and the workbench fee alert raises **未开票 / not invoiced for `written_off` bills** (`modules/workbench/fee-alert.ts:97`). Staff are told to invoice a bill that no screen and no endpoint lets them invoice. Cash customers who pay before the tax invoice, and any bill part-invoiced then settled in full, are stuck with no invoice for the remainder.
  - `invoices.cancel` already handles the other direction: cancelling an invoice on a fully written-off bill sets `written_off`, not `open` (`invoices.ts:710-716`).

- **Finding F5 (a Proforma invoice spends the bill): confirmed, by design, undocumented.** `proforma` is one of the five categories (`routers/expense/shared.ts:117`, `lib/expense.ts:171`) and nothing in `packages/api` or `apps/web` reads the category for behaviour (grep of `proforma`). A proforma therefore advances `bill.invoiced_amount` and flips the bill to `invoiced` exactly as a tax invoice does. To issue the real invoice afterwards, accounting must cancel the proforma first (`invoices.cancel`, which voids it). Neither the dialog nor the SOP says so.

- **Finding F6 (no credit check): confirmed, owned by step 02.** No code computes counterparty exposure on this path (`bills.ts:1742-2087`). Step 02 Phase 1 adds `bills.creditCheck`, a `creditOverrideReason` input and an in-transaction exposure re-check to this handler, and a notice plus reason box to this dialog (`step-02-credit-and-duplicates.md` §4, Tasks 1.2 and 1.4). Not re-planned here (D6).

- **Finding F7 (the Amount prefill shows float noise): confirmed, cosmetic.** `String(1000 − 333.33)` is `666.6700000000001` (`bills.tsx:499`); the input shows it verbatim. The server accepts it (`positiveDecimalString`, `packages/api/src/quotation/values.ts:419-427`) and denoises at 6 dp (`quotation/money.ts:25-39`), so no money is wrong; the field just looks broken. `money.ts:15-17` names this as "a real figure users have seen on a bill".

- **Checked and sound (no change).**
  - Scope: every named bill must resolve in the caller's `expense` scope (`:1744`, `:1762`); lines are fetched only by those ids.
  - Over-invoicing is bounded by `bill_invoiced_amount_within_total` (`schema/expense.ts:415-418`) and the `LEAST` clamp (`:1992`).
  - Two concurrent issues on one bill: exactly one wins (`expense.concurrency.test.ts:137`).
  - Double press: the button is disabled while pending (`bills.tsx:604`).
  - Partial invoicing across several bills is refused on purpose (`:1808-1813`); the multi-bill path has no UI caller (`bills.tsx:612-620`). This is a feature gap the SOP already states, not a defect.
  - Cancel reverses by the recorded split (`invoices.ts:620-718`).

- **Migration state.** The journal has 65 entries ending `0065_quotation_send_decision`, with 65 `.sql` files, contiguous, nothing pending. Other plans reserve `0066`–`0074` and conditional `00NN_<name>` placeholders numbered at merge (runbook §6). **This plan needs no migration under any recommended option.** D5-B would not need one either (the category column exists).

---

## 1. Overview

**Problem.** Issuing an invoice mostly works, and partial invoicing is real. Four things are wrong on the path. The **Invoice Title** accounting edits in the dialog is thrown away, so the customer's document prints the old name. A typed invoice number that already exists fails as an unexplained server error, and one typed in the system's own format can stop every auto-numbered invoice in the organisation for the rest of the month. The handler reads the bill and its lines before its transaction and locks them in the opposite order to every other money writer, so a line removed from the bill, or a settlement landing at the same moment, can leave invoiced money on a line no bill owns, or a wrong line status. And a bill that was paid before it was fully invoiced can never be invoiced, even though the workbench keeps telling staff to invoice it.

**Goals.**
- **Phase 1 (F1, F2, F7):** the invoice carries the title typed in the dialog; a clashing number is refused with a sentence naming it; a typed number cannot take the generated shape; the amount prefill reads as money.
- **Phase 2 (F3):** issuing re-reads what it spends inside its transaction, under row locks taken lines-then-bill like unbill, verify and cancel.
- **Phase 3 (F4, F5):** a written-off bill with an uninvoiced balance can be invoiced, and becomes `done` when covered; the dialog says a Proforma spends the balance.

**Success criteria.**
- Editing Invoice Title to "Sunrise Trading Sdn. Bhd." and issuing stores `invoice.buyer = "Sunrise Trading Sdn. Bhd."`; the step 25 preview prints it; the bill's own title is unchanged.
- A caller denied `invoice.buyer` who sends `buyer` or `invoiceTitle` gets an invoice whose buyer is the bill's title (D1-A).
- Typing an invoice number already used in the organisation returns CONFLICT _"Invoice number 44444 is already used in this organisation."_ and writes nothing.
- Typing `NCT-INV-202609-0042` returns BAD_REQUEST _"NCT-INV-… numbers are generated by the system. Leave Invoice Number blank to get the next one, or type the tax-authority number."_ (D2-A).
- On real Postgres, an issue racing an unbill of a line on the same bill never leaves an `invoice_line` on a line whose `bill_id` is not covered by that invoice; an issue racing a write-off verify leaves every touched line with `status = deriveStatus(row)`; neither raises a deadlock as a 500.
- A bill partially invoiced (400 of 1000) and then written off in full shows an enabled **Invoicing** icon; issuing 600 leaves it `done`, its lines `done`, and it leaves the fee alert's 未开票 list.
- The existing suites (`expense.ledger`, `expense.corrections`, `expense.wave1`, `expense.filters`, `expense.bills`, `expense.rbac`, `expense.cross-currency-writeoff`) and the api `architecture.test.ts` pass, judged by reading the output.

**In scope.** `billsRouter.invoice` (buyer, field stripping, number rules and error mapping, in-transaction locked reads, written-off eligibility); `InvoicingDialog` (prefill, Proforma hint); the row icon condition; tests; read-only production probes for Wilfred.

**Out of scope.**
- Credit limit at invoicing (step 02 Phase 1, D6).
- A multi-bill UI (录入发票号 over the row selection); the SOP already calls it absent.
- The invoice document, buyer address/tax ID, seller tax ID, SST (step 25; ledger items `identity`, `tax-invoice`).
- Invoice email and settlement against invoices (steps 25–26; ledger item `money-by-hand`).
- Red reversal (红冲, `cnState` has no writer).
- Repairing historic rows that F3 may already have produced (D8: report only).
- Case-insensitive invoice-number uniqueness (probe 24-P9 sizes it; no index change here).

**SOP findings (`customer-intake-sop/sop.json`, step 24):**

| Item | Planned? | Where |
|---|---|---|
| Ledger `credit` "Credit is captured and never enforced" (repairs s24, s02) | No, step 02 Phase 1 owns it | D6, §7.6 |
| Pitfall "No credit-limit or customer credit check exists on this path" | No (as above) | D6 |
| Pitfall "A bill that is invoiced or written off cannot be invoiced again" | Yes: false for written-off bills, which may never have been invoiced | Phase 3, §9 SOP text |
| Golden step "Check Invoice Title … Editable" | Yes: editable but ignored | Phase 1 |
| Pitfall "Invoicing several bills … has no UI entry point" | No (feature gap, stated correctly) | Out of scope |
| Break after step 20 "The customer's identity ends here" | No (steps 20/25) | Out of scope |

**Readiness of this step.** Step 24 is mostly sound: its money arithmetic, scope, gate and partial path hold. The plan is three small phases in one handler and one dialog. Phase 2 is the only delicate one.

**Decisions (all Decided 2026-09-21; chosen option in brackets, the recommended one in every case):**
- What the dialog's Invoice Title writes → D1 [A]
- How typed invoice numbers are validated → D2 [A]
- How issuing is serialised against unbill, verify and cancel → D3 [A]
- Whether a written-off bill can be invoiced → D4 [A]
- What a Proforma does → D5 [A]
- Who owns the credit check at invoicing → D6 [A]
- Merge order against step 02 → D7 [A]
- What happens to historic rows F3 may have produced → D8 [A]
- How the Amount prefill is rounded → D9 [A]

## 2. User Journeys

**Journey 1 (changed): Accounting issues a full invoice with a corrected title**
Trigger: bill `NCT-B-202609-0031` for Sunrise Trading is approved (step 23), open, MYR 4,200.00. The bill's Invoice Title reads "Sunrise Trading" and the customer wants "Sunrise Trading Sdn. Bhd.".
Steps:
1. Accounting opens **Money > Bills**, searches **Search all columns** for the bill, and presses **Invoicing** → the dialog opens with Title "Sunrise Trading" and Amount `4200` (unchanged).
2. Accounting picks **VAT general invoice**, **Electronic**, leaves Invoice Number blank, types the new title, and presses **Issue Invoice** → toast _"Invoice NCT-INV-202609-0107 issued"_ (unchanged).
3. The invoice appears on **Money > Invoices** with buyer "Sunrise Trading Sdn. Bhd." (Phase 1; today it shows "Sunrise Trading"). The bill shows `invoiced`.
4. Flow ends: step 25's preview prints the new buyer name.
Where it lives: the existing dialog. No new screen.
Old journey: step 3 showed the old title, and nothing said the edit had been dropped.

**Journey 2 (new refusal): Accounting types a number that is taken, or one in the system's format**
Trigger: accounting keys the tax-authority number from the paper invoice.
Steps:
1. Accounting types `44444`, which a colleague already recorded last week, and presses **Issue Invoice** → toast _"Invoice number 44444 is already used in this organisation."_ The dialog stays open with the typed values. Nothing is written. (Today: "Internal server error".)
2. Accounting types `NCT-INV-202609-0042` to "reserve" a number → toast _"NCT-INV-… numbers are generated by the system. Leave Invoice Number blank to get the next one, or type the tax-authority number."_ (D2-A).
3. Flow ends: accounting corrects the number or clears it.
Where it lives: the existing `onError` toast (`bills.tsx:513`).

**Journey 3 (hardened): An issue meets an un-bill or a settlement at the same moment**
Trigger: accounting issues an invoice on a two-line bill while ops remove one line from it (**Unbill**), or while another accountant verifies a payment against it.
Steps:
1. The issue takes row locks on the bill's lines, then the bill, inside its transaction, and re-reads them.
2. If the unbill committed first, the issue sees the smaller bill and the remaining line, and the amount check runs on what is really there: a now-too-large amount is refused with the existing _"Invoice amount exceeds the bill's outstanding balance (…)"_. If the issue committed first, the unbill is refused by its own existing check _"Bill has invoiced amounts — cancel its invoice(s) before removing a line"_.
3. With a settlement, each line's status is derived from the committed written-off amount, so a line both invoiced and settled reads **done**.
4. Flow ends: one consistent state, and every loser gets a sentence, not a 500.
Where it lives: server only.

**Journey 4 (new): Accounting invoices a bill the customer already paid**
Trigger: a walk-in customer paid MYR 1,000 in cash; the payment was verified against bill `NCT-B-202609-0040` (step 26) before any invoice. Or: the bill was invoiced 400 in part, then settled in full. The workbench 未开票 alert lists it.
Steps:
1. Accounting opens **Money > Bills** → the row shows `written_off` and the **Invoicing** icon is **enabled** (today greyed).
2. The dialog prefills the uninvoiced balance (1000, or 600). Accounting picks category and type and presses **Issue Invoice** → toast _"Invoice … issued"_.
3. The bill becomes `done`; its lines become `done`; it leaves the 未开票 alert.
4. Flow ends.
Where it lives: the existing row icon and dialog.
Old journey: step 1 showed a greyed icon, the server refused with _"Bill … is not invoiceable (status: written_off)"_, and the alert never cleared.

**Journey 5 (clarified): Accounting issues a Proforma**
Trigger: the customer wants a proforma before paying.
Steps:
1. In the dialog accounting picks **Proforma invoice** → a line under the select reads _"A proforma counts against this bill's balance. Cancel it on Money > Invoices before issuing the tax invoice."_ (D5-A).
2. Issue as today.
3. Flow ends. When the tax invoice is due, accounting cancels the proforma (step 25's Invoice Record) and invoices again.
Where it lives: the existing dialog.

## 3. Result (What Changes for the User)

**Before:** the Invoice Title box looked editable and was ignored; a clashing number was a server error; a number typed in the system's format could stop auto-numbering; a same-moment unbill or settlement could leave the ledger wrong; a paid bill could never be invoiced; a proforma silently spent the bill.
**After:** the title typed is the title printed; number problems are named; issuing is serialised with every other money write; a paid bill can be invoiced and closes as done; the dialog says what a proforma does.
**Key differences:**
- Accounting: the Invoicing icon is live on `written_off` rows with a balance; new refusal sentences for numbers; a proforma hint.
- Ops: nothing visible (an unbill racing an issue now gets the existing "cancel its invoice(s)" sentence).
- Nobody: the credit check is step 02's change, not this one.

## 4. Technical Architecture

### 4.1 Buyer and field stripping (Journey 1; Phase 1) → D1

In `billsRouter.invoice`, before the transaction:

```ts
// read-implies-write (expense.rbac.test.ts:691): a denied field never reaches the row
const own = stripDeniedFields({ buyer: input.buyer, seller: input.seller }, context.org, "invoice");
const titleAllowed = !isFieldDenied(context.org, "invoice", "buyer")
  && !isFieldDenied(context.org, "bill", "invoiceTitle");
const typedTitle = titleAllowed ? clean(input.invoiceTitle) : undefined;
// …
buyer: clean(own.buyer) ?? typedTitle ?? first.invoiceTitle,
seller: own.seller,
```

`clean` = trim, blank → undefined. The bill's own `invoice_title` is **not** written (D1-A); the dialog edits this document only. `isFieldDenied` and `stripDeniedFields` are the existing helpers (`isFieldDenied` at `serialize.ts:40`, `stripDeniedFields` imported at `bills.ts:48`). The audit `after` gains `buyer`.

### 4.2 Invoice number rules (Journey 2; Phase 1) → D2

```ts
const typed = input.invoiceNumber?.trim() || undefined;
if (typed && GENERATED_INVOICE_NO.test(typed))          // /^NCT-INV-\d{6}-\d+$/i
  throw new ORPCError("BAD_REQUEST", { message: "NCT-INV-… numbers are generated by the system. …" });
```

`GENERATED_INVOICE_NO` lives beside `makeNo` in `routers/expense/shared.ts` so the shape and the pattern cannot drift. Inside the transaction, the `insert(invoice)` is wrapped:

```ts
try { await tx.insert(invoice).values(…) }
catch (e) {
  if (isUniqueViolation(e) && pgErrorMatches(e, /invoice_org_number_uq/))
    throw new ORPCError("CONFLICT", { message: `Invoice number ${invoiceNumber} is already used in this organisation.` });
  throw e;
}
```

Throwing inside the transaction callback rolls the transaction back, which is what we want. The generated branch cannot collide once typed numbers cannot take its shape (probe 24-P2 checks that no existing typed row already does).

### 4.3 Locked, in-transaction reads (Journey 3; Phase 2) → D3

```
invoice({billIds, …})
  scoped existence check (outside tx, unchanged: NOT_FOUND before anything else)
  tx.begin
  ├─ SELECT cost_line WHERE bill_id IN (ids) ORDER BY created_at, id FOR UPDATE   (lines first: unbill/verify/cancel order; X30)
  ├─ SELECT bill WHERE id IN (ids) AND scope ORDER BY id FOR UPDATE                (then bills)
  ├─ assertGatesCleared(tx, …, "input_invoice_no")                                  (moved onto tx)
  ├─ agreements, status, partial rule, outstanding, amount checks                   (unchanged code, fresh rows)
  ├─ [step 02, after merge] exposure re-check + override audit
  ├─ allocate number, insert invoice / invoice_bill                                  (unchanged)
  ├─ UPDATE bill … WHERE id AND status = <read> AND invoiced_amount = <read> AND total_amount = <read>
  ├─ insert invoice_line; UPDATE cost_line … WHERE id AND bill_id = <bill> AND invoiced_amount = <read>
  └─ audit
  tx.commit
```

- The pins stay as a belt; with the locks held they cannot miss, but a stale-entry reader of the code sees every precondition in the WHERE, matching `unbill`'s own comment (`cost-lines.ts:410-412`).
- Lines are locked in `created_at, id` order, the same order verify walks them (`write-offs.ts:351`), so issue and verify cannot deadlock on line pairs. This is the one ledger lock order (crosscheck X30): payment (verify and void only) → cost lines `ORDER BY created_at, id` → bill(s) `ORDER BY id`. Step 25's cancel (25 D7) takes the same lines → bills order after its pinned `UPDATE invoice`, not the bill → lines order 25's own text first had; 26's verify and void (26 D5-A) take it too.
- The 200-bill cap (`:1711`) bounds the lock set; the handler already iterates every line inside one transaction today.
- If a deadlock still occurs (another writer with a different order), map SQLSTATE `40P01` to CONFLICT (X30; 25 and 26 map it the same way) _"The bill changed while the invoice was being issued; refresh and retry."_ using `pgErrorMatches(e, /40P01|deadlock/)`.

### 4.4 Written-off bills (Journey 4; Phase 3) → D4

- Eligibility: `status ∈ {open, written_off}` and outstanding `> 0`. `invoiced` and `done` stay refused with today's sentence.
- The bill UPDATE pins the status it read, and sets on full coverage `status = read === "written_off" ? "done" : "invoiced"`. A partial issue leaves the status unchanged.
- Lines: `deriveStatus` already yields `done` / `invoiced_partially_written` from fresh rows (`money.ts:47-58`).
- A multi-bill document may mix `open` and `written_off` bills (same currency/branch/attribute rules). The agreements check does not look at status.
- Cancel is unchanged: it recomputes `written_off` vs `open` from write-off coverage (`invoices.ts:710-716`), which is the correct inverse of `done`.
- Web: the row icon condition becomes `status === "open" || (status === "written_off" && outstanding > 0)` with `outstanding` computed as the dialog does. A shared predicate `isInvoiceable(bill)` goes in `apps/web/src/lib/expense.ts` so the icon and any future batch entry cannot disagree.

### 4.5 Proforma hint (Journey 5; Phase 3) → D5

Dialog only: when `category === "proforma"`, render one `text-xs text-muted-foreground` line under the Category select (copy in Journey 5). No server change under D5-A.

### 4.6 Data model

No schema change under any recommended option. No migration.

### 4.7 API contracts

**`bills.invoice`** (input shape unchanged; behaviour changed):
- Phase 1: `invoiceTitle` becomes the buyer (D1); `buyer`/`seller` stripped when denied; `invoiceNumber` trimmed, generated shape refused (D2); duplicate → CONFLICT naming the number.
- Phase 2: reads move inside the transaction under `FOR UPDATE`; bill pin gains `total_amount`; line UPDATEs gain `bill_id` and `invoiced_amount` pins; deadlock → CONFLICT. Refusal messages are unchanged, but **the loser of two simultaneous full issues now gets** _"Bill … is not invoiceable (status: invoiced)"_ **instead of** _"Bill was invoiced concurrently; refresh and retry"_, because it waits for the winner and re-reads.
- Phase 3: `written_off` bills with a balance are accepted (D4).
- Output unchanged. Audit `after` gains `buyer` (Phase 1).

**Refusal order as the caller sees it (after all phases):** BAD_REQUEST repeated id → NOT_FOUND scope → BAD_REQUEST generated-shape number → (tx) gate CONFLICT → currency / branch / attribute / status BAD_REQUEST → partial-multi BAD_REQUEST → no lines / fully invoiced / amount BAD_REQUEST → [step 02 credit PRECONDITION_FAILED] → duplicate number CONFLICT → pin CONFLICT.

**Web:** `InvoicingDialog` prefill (D9), Proforma hint (D5); `-bills.columns.tsx:826` uses `isInvoiceable`.

### 4.8 Key decisions
All Decided 2026-09-21 (§9):
- What the dialog's Invoice Title writes → D1-A (Task 1.1)
- How typed numbers are validated → D2-A (Task 1.2)
- Serialisation strategy → D3-A, the X30 lock order (Phase 2)
- Written-off eligibility → D4-A (Phase 3 Tasks 3.1–3.3; supersedes step 25 D6, X31)
- Proforma behaviour → D5-A (Task 3.4)
- Credit ownership → D6-A (no code here; confirms scope)
- Merge order against step 02 → D7-A (02 Phase 1 is the base)
- Historic residue → D8-A (report only)
- Prefill rounding → D9-A (Task 1.4 only)

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- D1, D2, D7 and D9 are Decided (A each, 2026-09-21). Re-check before Task 1.2: probe 24-P2; if it finds jam candidates, hand them to accounting before the shape is refused (§7.8).
- Re-read `billsRouter.invoice` by symbol at the base commit. Step 02 Phase 1 merges first (D7-A), so its `creditOverrideReason` input, exposure re-check and dialog notice are present and must be kept.

### Phase 1 — The invoice says what accounting typed, and a typed number cannot break numbering (F1, F2, F7)

**Delivers:** Journeys 1 and 2.
**Dependencies:** D1-A, D2-A, D9-A (Decided). Step 02 Phase 1 merged (D7-A).

- **1.1** Buyer from the dialog title and read-implies-write stripping for `buyer`, `seller`, `invoiceTitle` (§4.1, D1). Audit `after` gains `buyer`. Update the input-schema comment at `bills.ts:1719-1723`. Files: `packages/api/src/routers/expense/bills.ts`. · **Agent A (backend)**
- **1.2** Invoice number: trim; refuse the generated shape (D2-A); map `invoice_org_number_uq` 23505 to CONFLICT inside the transaction (§4.2). Export `GENERATED_INVOICE_NO` beside `makeNo`. Rewrite the comment at `bills.ts:1909-1924` so it names the mapping it now has. Files: `packages/api/src/routers/expense/bills.ts`, `packages/api/src/routers/expense/shared.ts`. · **Agent A (backend)**
- **1.3** Tests, new `describe("bills.invoice — what the dialog sends")` in `expense.bills.test.ts`:
  - title edited → `invoice.buyer` equals it; `bill.invoice_title` unchanged;
  - title blank or whitespace → buyer is the bill title;
  - explicit `buyer` wins over `invoiceTitle`;
  - in `expense.rbac.test.ts` (the "a field you cannot READ" describe, `:691`): a caller denied `invoice.buyer` sending `buyer: "INVENTED"` and `invoiceTitle: "INVENTED"` → buyer is the bill title; denied `invoice.seller` → seller null;
  - duplicate typed number → CONFLICT naming it, zero new invoice rows, bill `invoiced_amount` unchanged, no `expense.invoice.create` audit row;
  - duplicate of a **cancelled** invoice's number → CONFLICT (the index covers it, D2);
  - `"  44444  "` stored as `44444`;
  - `NCT-INV-202609-0042` and lower-case `nct-inv-202609-0042` → BAD_REQUEST; the counter did not move;
  - blank number → `NCT-INV-YYYYMM-NNNN` as today.
  Files: `packages/api/src/routers/expense.bills.test.ts`, `packages/api/src/routers/expense.rbac.test.ts`. · **Agent A (backend)**
- **1.4** Dialog prefill: `setAmount` and the "outstanding" line use a denoised figure (D9-A: `Number((total − invoiced).toFixed(6))`, then `String`). No other dialog change in this phase. Files: `apps/web/src/routes/_next/expenses/bills.tsx`. · **Agent B (frontend)**

**Acceptance.**
- Journey 1 in the browser: the Invoice Record row and the step 25 preview show the edited title.
- Journey 2: both refusal toasts appear; the dialog stays open; no invoice row is created.
- A bill of 1000 invoiced 333.33 prefills `666.67`.
- `expense.bills.test.ts`, `expense.rbac.test.ts`, `expense.ledger.test.ts`, `expense.corrections.test.ts`, `expense.wave1.test.ts` and the api `architecture.test.ts` pass, judged by reading the output; `bun run check-types` output read for "failed" (its exit code lies).

### Phase 2 — Issuing is serialised with the ledger's other money writers (F3)

**Delivers:** Journey 3.
**Dependencies:** Phase 1 merged (same handler). D3-A (Decided; the X30 order). A `DATABASE_URL_TEST` Postgres for the executor (dev branch, never production).

- **2.1** Restructure `billsRouter.invoice` per §4.3:
  - keep a scoped existence check outside the transaction so NOT_FOUND still precedes every state refusal;
  - inside the transaction, lock lines (`created_at, id` order) then bills (`id` order) `FOR UPDATE`, re-read both, and run the gate and every check on the fresh rows;
  - add `total_amount` to the bill pin, `bill_id` + `invoiced_amount` to each line UPDATE (CONFLICT _"The bill changed while the invoice was being issued; refresh and retry."_ on 0 rows);
  - map `40P01` to the same CONFLICT (X30).
  Keep `LEAST(…)` and `roundMoney` untouched. Update the docblock "OVER-INVOICING" paragraph (`:1682-1691`) to name the locks. No allow-list key changes (reads are not governed writes); refresh the comment at `architecture.test.ts:404-405` if it describes the guard. Files: `packages/api/src/routers/expense/bills.ts`, `packages/api/src/architecture.test.ts` (comment only). · **Agent C (backend)**
- **2.2** Real-Postgres tests in `expense.concurrency.test.ts` (same `DATABASE_URL_TEST` gate, `:26`). Each case below is its own named `it` under the existing `describe.skipIf(!TEST_URL)`; no other plan's case is edited (crosscheck X35). The PR pastes the failing run on the pre-change code and the passing run after, both on the dev Neon branch ("skipped" is not a pass). Phase 2 changes lock order, so the PR also re-runs **every** case already in the file (22's, 21's and any other step's that merged first) and pastes that output.
  - **issue vs unbill:** a two-line bill (600 + 400), in a fixture org **with no Bill audit flow** (X35). After step 23 Phase 1, `retotal` refuses an unbill on an approved bill under the seeded flow, so with the seeded flow the unbill would be refused before any race ran. The case's docblock says the fixture org has no Bill flow, and why (a Bill flow with "Can edit after approval" would also do; it is not the one used); fire `bills.invoice({billIds:[b]})` and `costLines.unbill({id: line400})` with `Promise.allSettled`, 20 repetitions with fresh fixtures. Each run: exactly one fulfils or both refuse cleanly; no rejection is INTERNAL_SERVER_ERROR; every `invoice_line` of an issued invoice points at a line whose `bill_id` is covered by that invoice; `bill.invoiced_amount = Σ issued invoice_bill.amount`; `invoice.amount = Σ its invoice_bill.amount`.
  - **issue vs verify:** a bill with one 1000 line and a verified-ready payment of 1000; fire issue and `writeOffs.verify`; after both: the line's status equals `deriveStatus(row)` and is `done`; the bill is `done`; no 500.
  - **issue vs cancel:** a bill invoiced 400 by invoice I1; fire `invoices.cancel(I1)` and a second partial issue of 600; afterwards `bill.invoiced_amount = Σ issued coverage`, no 500.
  - The existing "two concurrent invoice calls" test (`:137`) stays green; its loser now fails with the status sentence.
  PGlite cannot run these (single connection, `:18-21`); the PGlite suites must still pass unchanged. Files: `packages/api/src/routers/expense.concurrency.test.ts`. · **Agent C (backend)**
- **2.3** PGlite regression: the whole `expense.*` suite plus `workbench` fee-alert tests, read for `failed`. No new PGlite test is needed for the locks themselves. Files: none (run only). · **Agent C (backend)**

**Acceptance.** The three race tests pass 20/20 on the dev Postgres, each pre-change run is pasted failing, every other case in `expense.concurrency.test.ts` still passes, and all that output is filed with the PR (X35). PGlite suites unchanged. Journey 1 still issues in the browser with no visible difference.

### Phase 3 — A paid bill can still be invoiced, and a proforma says what it does (F4, F5)

**Delivers:** Journeys 4 and 5.
**Dependencies:** Phase 2 merged (the status pin is the one Phase 2 rewrites). D4-A, D5-A (Decided).
**Deploy/release note (X31).** Under D4-A, step 25 D6 is superseded: `invoices.cancel` gains no settled-bill refusal, and 25's confirm text says "The amount it invoiced goes back to its bill, so the bill can be invoiced again." That sentence is true only once this phase is live, so **25 Phase 2 merges and deploys after 24 Phase 3**, never before. Before 24 Phase 3 ships, accounting sees both lists: 24-P6 (written-off bills with an uninvoiced balance) and 25-P8 (bills stranded by a void), since both become invoiceable on deploy.

- **3.1** Server eligibility per §4.4 (D4-A): accept `written_off` with outstanding > 0; pin the read status; full coverage → `done` from `written_off`, `invoiced` from `open`. Returned `bills[].status` widens to `"open" | "invoiced" | "written_off" | "done"`. Update the comment at `bills.ts:1798-1800`. Files: `packages/api/src/routers/expense/bills.ts`. · **Agent D (backend)**
- **3.2** Tests in `expense.bills.test.ts`, new `describe("bills.invoice — a settled bill")`:
  - never-invoiced bill, fully written off → issue in full → bill `done`, lines `done`, fee alert kinds `[]` (`outstandingKinds("done")`, `fee-alert.ts`);
  - 400/1000 partial, then written off in full → issue 600 → `done`;
  - partial issue on a written-off bill (300 of 600) → status stays `written_off`, lines `partially…` per `deriveStatus`;
  - `done` and `invoiced` bills still refused with today's sentence;
  - cancel of the Phase 3 invoice returns the bill to `written_off` (existing cancel logic);
  - a multi-bill document over one `open` and one `written_off` bill → both covered in full, statuses `invoiced` and `done`.
  Files: `packages/api/src/routers/expense.bills.test.ts`. · **Agent D (backend)**
- **3.3** Web: `isInvoiceable(bill)` in `apps/web/src/lib/expense.ts`; the row icon uses it (`-bills.columns.tsx:826`). The dialog's outstanding line already reads from `bill`. Files: `apps/web/src/lib/expense.ts`, `apps/web/src/routes/_next/expenses/-bills.columns.tsx`. · **Agent E (frontend)**
- **3.4** Proforma hint (§4.5, D5-A). Files: `apps/web/src/routes/_next/expenses/bills.tsx`. · **Agent E (frontend)**

**Acceptance.** Journeys 4 and 5 in the browser. Tests above pass. `bun run check-types` output read.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.3 | `packages/api/src/routers/expense/bills.ts`, `packages/api/src/routers/expense/shared.ts`, `packages/api/src/routers/expense.bills.test.ts`, `packages/api/src/routers/expense.rbac.test.ts` | `packages/api/src/serialize.ts`, `packages/api/src/pg-errors.ts`, `packages/api/src/modules/numbering/allocate.ts`, `packages/api/src/modules/expense/permissions.ts`, `packages/db/src/schema/expense.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | low | 1.4 | `apps/web/src/routes/_next/expenses/bills.tsx` | `packages/api/src/quotation/money.ts` |

Opus for A: it edits the handler that mints invoices, inside the transaction, with field-permission rules. Run mode: **A ∥ B** (file-disjoint; B needs no new contract). Serialization point: after A, `bunx vp test run packages/api/src/routers/expense.bills.test.ts packages/api/src/routers/expense.rbac.test.ts packages/api/src/routers/expense.ledger.test.ts packages/api/src/architecture.test.ts` and grep the output for `failed`.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | opus | high | 2.1–2.3 | `packages/api/src/routers/expense/bills.ts`, `packages/api/src/routers/expense.concurrency.test.ts`, `packages/api/src/architecture.test.ts` (comment only) | `packages/api/src/routers/expense/{cost-lines,write-offs,invoices}.ts`, `packages/api/src/modules/governed/writer.ts`, `packages/api/src/modules/audit/gates.ts`, `packages/api/src/modules/expense/money.ts` |

Opus: lock order across four money writers, proven only on real Postgres. Run mode: single agent. The dev Postgres URL comes from Wilfred; the agent never points `DATABASE_URL_TEST` at production (memory: "Neon: two branches, two truths").

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent D (backend) | backend-engineer | sonnet | medium | 3.1–3.2 | `packages/api/src/routers/expense/bills.ts`, `packages/api/src/routers/expense.bills.test.ts` | `packages/api/src/modules/workbench/fee-alert.ts`, `packages/api/src/routers/expense/{write-offs,invoices}.ts` |
| Agent E (frontend) | frontend-engineer | sonnet | low | 3.3–3.4 | `apps/web/src/lib/expense.ts`, `apps/web/src/routes/_next/expenses/-bills.columns.tsx`, `apps/web/src/routes/_next/expenses/bills.tsx` | `packages/api/src/routers/expense/bills.ts` |

Run mode: **D → E** for 3.3 (E waits on the widened status in the output types); 3.4 may start at once.

Smell test: one owner per task · no file owned twice within a phase · `bills.ts` passes A → C → D strictly in sequence · every wait names its artifact · Phase 1 alone fixes the two defects accounting sees daily (F1, F2).

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`)

- **`bills.invoice` callers.** Web: `InvoicingDialog` only (`apps/web/src/routes/_next/expenses/bills.tsx:504`). Tests: `expense.ledger.test.ts` (`:825`, `:874`, `:1106` and the multi-bill describe `:773`), `expense.corrections.test.ts` (partial invoicing J6c `:272`, `:278`, `:468`), `expense.wave1.test.ts:125`, `expense.concurrency.test.ts:149-150`. No e2e spec drives the dialog (grep of `Issue Invoice` in `e2e/specs`); `e2e/out/_walk/*` are walk artefacts, not executed specs.
- **Readers of `invoice.buyer`.** `invoice-document.ts:331` (`resolveBuyer`, step 25), `invoices.ts:166-174` (list filter, stripped when denied), invoice list/grid masking via `permissions.ts:251`.
- **Readers of `bill.status = 'written_off'`.** Fee alert (`fee-alert.ts:97`, raises 未开票 for it), labels (`routers/expense/labels.ts:30`), bills list filters, write-off reverse (`write-offs.ts:1117-1124`, reverts `done → invoiced` and `written_off → open`), cancel (`invoices.ts:710-716`). Phase 3 creates `done` from `written_off`; every reader already handles `done`.
- **Other writers of the same rows** (Phase 2 lock order): `costLines.unbill` (`cost-lines.ts:1383`), `bills.dissolve` (`bills.ts:1457`, pins `status`/`total`/`invoiced`, `:541-560`), `writeOffs.verify`, `writeOffs.reverse`, `invoices.cancel`, `costLines.createBill` (claims unbilled lines only; cannot touch a billed line).
- **`architecture.test.ts`.** Entries `:404-405`, `:672-674` unchanged. No new write site.

### 7.2 Flows before and after

| Flow | Before | After |
|---|---|---|
| Edit title in dialog | ignored; bill title printed | typed title stored as buyer (D1-A) |
| Typed duplicate number | 500 "Internal server error" | CONFLICT naming the number |
| Typed generated-shape number | accepted; may jam auto-numbering later | BAD_REQUEST (D2-A) |
| Issue racing unbill | can put invoiced money on a released line | one wins; the other refuses with a sentence |
| Issue racing verify | can leave a wrong line status; possible deadlock 500 | fresh status; CONFLICT at worst |
| Two full issues at once | loser: "invoiced concurrently" | loser: "not invoiceable (status: invoiced)" |
| Paid, un-invoiced bill | icon greyed, server refuses | invoiceable; ends `done` (D4-A) |
| Proforma | silent | hint under the select (D5-A) |

### 7.3 Behaviour change for existing orgs and live bills

- Every org gets Phases 1–3 at once on deploy; no per-org switch.
- Existing `written_off` bills with a balance (probe 24-P6, plus the bills stranded by a void that step 25's probe 25-P8 lists; X31) become invoiceable immediately and will show the live icon. Accounting sees both lists before deploy, because some of these may have been invoiced **outside** the system; D4 names this.
- Existing invoices are untouched. Existing typed numbers of the generated shape (24-P2) stay valid; only new ones are refused.

### 7.4 Nullable assumptions

- `bill.invoice_title` nullable → buyer may stay null, as today.
- `invoice.invoice_number` nullable (plain-create records); the generated branch always fills it.
- `input.invoiceTitle` absent from older clients → falls back to the bill title (today's result).
- `cost_line.bill_id` null means unbilled (Phase 2 line pin).

### 7.5 Deployment coupling

- Phase 1: server first or together. An old web against a new server gains the title fix automatically (it already sends `invoiceTitle`). A new web against an old server only shows a rounder prefill.
- Phase 2: server only.
- Phase 3: **server before web.** A new web against an old server shows a live icon that the old server refuses with today's sentence (harmless, confusing). Build `apps/web` before deploying (memory: "Alchemy partial deploy splits the stage").
- No migration in any phase.

### 7.6 Merge order against steps 02–27

| Plan / task | Shared code | Order |
|---|---|---|
| **02 Phase 1** (Tasks 1.2, 1.4) | `billsRouter.invoice` (input `creditOverrideReason`, in-transaction exposure re-check, `bill.invoice.credit_override` audit), `InvoicingDialog` (notice, reason box), `expense.bills.test.ts` | **D7-A: 02 Phase 1 merges first.** 24 Phase 1 rebases over it; 24 Phase 2 moves 02's exposure re-check to after the locked re-read (§4.3) and must keep it. |
| 02 Phases 2–3 | `company.ts`, migration `0067` | No overlap. |
| 08, 15 (Phase 3) | `modules/audit/gates.ts`, `seed.ts`; 15 adds gate calls in `routers/lading.ts` and `costLines.create` | No overlap with `bills.invoice`. 24 leaves those gate calls alone. 15's `packages/api/src/architecture.test.ts` edits touch other entries; comments may collide, rebase by hand. |
| 11 (Phases 2–3) | `modules/expense/bridge.ts`, `cost-lines.ts` `importFromQuote` | No shared function. |
| 04–07, 09–10, 12–14 | quotation/order code | No overlap. |
| 16–19 (no plans at time of writing) | lading, fees | Not expected to touch `bills.invoice`. |
| 20–22 (no plans at time of writing) | `costLines.create`, `createBill`, `bills.ts` bill create | Different handlers in `bills.ts`/`cost-lines.ts`; rebase by symbol. If step 20 carries `settlement_company_id` onto the bill, D1-A's buyer precedence is unaffected (it stamps names only). |
| 23 (no plan at time of writing) | bill review, `input_invoice_no` gate | 24 Phase 2 moves the gate call onto `tx` and after the lock; a step 23 plan must keep the call and its key. |
| 25 (no plan at time of writing) | `invoice-document.ts` `resolveBuyer`, `invoices.ts` | 24 changes what `invoice.buyer` holds, not how it is read. A step 25 plan that freezes buyer address/tax ID should read `invoice.buyer` as the typed title. Settled against step 25's plan (crosscheck X30, X31, X35; X40: the "no plan" label is stale): 25 D7 locks cancel lines → bills in the X30 order and maps `40P01` to CONFLICT; 25 D6 is superseded under 24 D4-A; **25 Phase 2 merges and deploys after 24 Phase 3**; 25-P8 adds to 24-P6 for accounting before 24 Phase 3 ships; 25 Task 2.3 adds its own `it` to `expense.concurrency.test.ts`. |
| 26 (no plan at time of writing) | `write-offs.ts` `verify`/`reverse`, bill status `written_off`/`done` | 24 Phase 3 relies on verify setting `written_off` for un-invoiced bills (`write-offs.ts:694`) and reverse mapping `done → invoiced` (`:1124`). A step 26 plan that changes either must re-run 24's Phase 3 tests. 24 Phase 2 fixes the lock order on the issue side only. |
| 27 (no plan at time of writing) | month-end artifacts read invoices and bills | Read-only; `done` already handled. |
| Migration journal | none from 24 | — |

**Required order:** 02 Phase 1 → **24 Phase 1 → 24 Phase 2 → 24 Phase 3** → 25 Phase 2 (X31), one worktree `wt-step24`, phases merged sequentially. Phase 1 has no dependency beyond 02 Phase 1 and can go in any wave after it.

### 7.7 Read-only production probes (SELECT only; Wilfred runs them; none blocks Phase 1 code)

```sql
-- 24-P1 How invoice numbers are used today, per org (D2 sizing)
select organization_id,
       count(*) filter (where invoice_number ~* '^NCT-INV-\d{6}-\d+$') as generated_shape,
       count(*) filter (where invoice_number !~* '^NCT-INV-\d{6}-\d+$') as typed,
       count(*) filter (where invoice_number is null) as no_number,
       count(*) filter (where invoice_number <> btrim(invoice_number)) as untrimmed
from invoice group by 1 order by 1;

-- 24-P2 Jam candidates: generated-shape numbers at or ahead of the org's INV counter (F2; blocks Task 1.2 only if non-empty)
select i.organization_id, i.invoice_number, i.state, d.next_seq
from invoice i
join document_number d on d.organization_id = i.organization_id and d.prefix = 'INV'
where i.invoice_number ~* '^NCT-INV-\d{6}-\d+$'
  and split_part(i.invoice_number, '-', 4)::bigint >= d.next_seq;

-- 24-P3 Split rows on lines no covered bill owns (F3 residue, D8)
select i.organization_id, il.invoice_id, i.invoice_number, il.cost_line_id, cl.bill_id, il.amount
from invoice_line il
join invoice i on i.id = il.invoice_id
join cost_line cl on cl.id = il.cost_line_id
where i.state = 'issued'
  and (cl.bill_id is null
       or not exists (select 1 from invoice_bill ib where ib.invoice_id = il.invoice_id and ib.bill_id = cl.bill_id));

-- 24-P4 Bills whose invoiced amount disagrees with their issued coverage (F3 residue, D8)
select b.organization_id, b.bill_no, b.status, b.total_amount, b.invoiced_amount,
       coalesce(sum(ib.amount) filter (where i.state = 'issued'), 0) as covered
from bill b
left join invoice_bill ib on ib.bill_id = b.id
left join invoice i on i.id = ib.invoice_id
group by b.id
having round(b.invoiced_amount - coalesce(sum(ib.amount) filter (where i.state = 'issued'), 0), 6) <> 0;

-- 24-P5 Invoices whose face amount differs from their coverage (F3 residue, D8)
select i.organization_id, i.invoice_number, i.amount, sum(ib.amount) as covered
from invoice i join invoice_bill ib on ib.invoice_id = i.id
where i.state = 'issued' and i.amount is not null
group by i.id having round(i.amount - sum(ib.amount), 6) <> 0;

-- 24-P6 Written-off bills with an uninvoiced balance (F4 sizing; what becomes invoiceable on deploy)
select organization_id, attribute, currency, count(*) as bills,
       count(*) filter (where invoiced_amount = 0) as never_invoiced,
       sum(total_amount - invoiced_amount) as uninvoiced
from bill
where status = 'written_off' and invoiced_amount < total_amount
group by 1, 2, 3 order by 1, 2, 3;

-- 24-P7 Categories in use, and proformas later cancelled (D5 sizing)
select organization_id, category, state, count(*) from invoice group by 1, 2, 3 order by 1, 2, 3;

-- 24-P8 Is the input_invoice_no gate on, per org (context for the SOP "before" line)
select f.organization_id, f.enabled,
       exists (select 1 from audit_flow_gate g where g.flow_id = f.id and g.gate_key = 'input_invoice_no') as gate_on
from audit_flow f where f.trigger_type = 'bill' order by 1;

-- 24-P9 Invoice numbers that differ only by case or spaces (out-of-scope sizing)
select organization_id, lower(btrim(invoice_number)) as n, count(*)
from invoice where invoice_number is not null
group by 1, 2 having count(*) > 1;

-- 24-P10 Cost lines whose stored status disagrees with their amounts (F3 residue, D8; approximate derivation of money.ts:47-58)
select organization_id, status, count(*)
from cost_line
where bill_id is not null and amount > 0
  and status <> case
    when written_off_amount >= amount then case when invoiced_amount >= amount then 'done' else 'written_uninvoiced' end
    when written_off_amount > 0 then case when invoiced_amount >= amount then 'invoiced_partially_written' else 'partially_written_uninvoiced' end
    else case when invoiced_amount >= amount then 'invoiced_unwritten' else 'uninvoiced_unwritten' end
  end
group by 1, 2 order by 1, 2;
```

`coverage()` in `money.ts` has its own epsilon; treat 24-P10 as a pointer to rows to inspect, not a verdict.

### 7.8 Blocking prerequisites

- D1, D2, D7 (Phase 1), D3 (Phase 2), D4, D5 (Phase 3): all Decided 2026-09-21.
- 24-P2 empty, or its rows handed to accounting, before Task 1.2 ships (a jam candidate must be known before the shape is refused).
- 24-P6 and step 25's 25-P8 read, and accounting shown both lists, before Phase 3 deploys (X31).
- A dev Postgres URL for `DATABASE_URL_TEST` before Task 2.2.

## 8. Cross-Cutting Concerns

- **Errors.** Every new refusal is an `ORPCError` with an operator sentence (BAD_REQUEST for the shape, CONFLICT for clashes and races). The dialog already toasts `error.message` and stays open.
- **Testing.** PGlite router tests for Phases 1 and 3; real-Postgres race tests for Phase 2 (`expense.concurrency.test.ts`); the api architecture test after every task; §10 in the browser.
- **Migration.** None.
- **Rollback.** Phase 1: revert; buyers already stored keep the typed title (correct data). Phase 2: revert; no data shape changed. Phase 3: revert; bills already moved to `done` stay `done` (correct: invoiced and settled), and their invoices cancel normally.
- **Audit trail.** `expense.invoice.create.after` gains `buyer`. Refusals write nothing, as every refusal in this router does.
- **Copy.** New sentences appear only in `bills.ts` and the dialog. Grep the worktree for "is not invoiceable" and "Auto-generated if left blank" before declaring done (shared-copy rule).
- **SOP.** Step 24's text must change after Phase 1 and Phase 3 (§9 "SOP text vs code"). This plan edits no SOP text: the corrections are an accepted unowned gap (crosscheck X39); a `/zyt-update` pass after deploy remains available to Wilfred, not assigned. Whoever edits reads `C:/Project/ZYT-Task/hosting/SITE.md` first, per the project rule.

**Performance & Scalability**
1. **Pagination.** Not applicable.
2. **SQL-side filtering.** Every lock and pin is a WHERE clause.
3. **N+1.** Unchanged: one grouped line read, one bill read, then the per-line UPDATE loop that exists today.
4. **Index coverage.** `cost_line_bill_idx`-style lookups by `bill_id` (the existing read) and bill primary keys.
5. **Write atomicity.** Everything from the lock to the audit row is one transaction, as today.
6. **Row locking.** New: lines then bills `FOR UPDATE`, capped by 200 bills. Same order as unbill, verify and cancel.
7. **Connections.** None new. The `INV` counter row lock is held a little longer (from allocation to commit, as today).
8. **Tenant isolation.** The bill lock keeps `billScope`; lines are reached only through locked, scoped bill ids.
9. **Payload.** Unchanged.
10. **Hot path.** Operator-triggered.

## 9. Decision Register, Open Questions & Risks

On 2026-09-21 Wilfred accepted the recommended option of every decision below, and every Proposed reading in `steps-20-26-crosscheck.md` X28–X40. No X-item overrides this plan's own recommendation; where one adds to a decision, the Chosen line says so. Each keeps its three approaches.

**D1: What should the dialog's Invoice Title write?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.1

| | Approach | Cost |
|---|---|---|
| **A** | **The typed title becomes this invoice's buyer; the bill keeps its own title** (Recommended) (Chosen). Explicit `buyer` wins; denied `invoice.buyer`/`bill.invoiceTitle` falls back to the bill title; `buyer`/`seller` stripped when denied | Matches what the dialog promises and what step 25 prints (`invoice.buyer` first). One handler change. The bill and later invoices on it still show the old title, which is right for a one-off correction. |
| **B** | **The typed title also rewrites `bill.invoice_title`** | Later invoices on the same bill pick it up. Adds a second writer of `bill` fields to a money handler, needs `bills.update`'s field gates (`input_…` gates, post-approval freeze on an approved bill), and changes an approved bill behind its reviewer. |
| **C** | **Make the field read-only** and send staff to **Edit bill details** to change the title | No server change beyond stripping. Adds a detour, and an approved bill may be frozen against edits, so the correction may be impossible. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).
- **Where it lands:** §4.1, Task 1.1, Task 1.3, Journey 1.

**D2: How are typed invoice numbers validated?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.2

| | Approach | Cost |
|---|---|---|
| **A** | **Trim; refuse the generated `NCT-INV-YYYYMM-N` shape; map a clash to CONFLICT naming the number** (Recommended) (Chosen) | Closes the jam at its cause and names every clash. A tax-authority number that genuinely looks like ours (none plausible) would be refused. |
| **B** | **Trim; map a clash to CONFLICT; on a generated-branch clash, retry allocation under a savepoint** | Tolerates typed numbers of any shape. Reintroduces a retry loop around an allocator whose docblock deliberately deleted them ("a retry … only hides the next bug"), and leaves the namespaces shared. |
| **C** | **Map a clash to CONFLICT only** | Smallest. Leaves the jam possible. |

- **Recommendation: A.** Case-insensitive uniqueness is out of scope; 24-P9 sizes it.
- **Chosen: A** (Wilfred, 2026-09-21).
- **Where it lands:** §4.2, Task 1.2, Task 1.3, Journey 2.

**D3: How is issuing serialised against unbill, verify and cancel?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Phase 2

| | Approach | Cost |
|---|---|---|
| **A** | **Re-read inside the transaction under `FOR UPDATE`, lines then bills, in verify's line order; keep and widen the pins; map deadlock to CONFLICT** (Recommended) (Chosen) | Removes stale reads and the inverted lock order at once, matching every other writer. Needs a real-Postgres test. The two-full-issues loser's message changes (§4.7). |
| **B** | **Keep reads outside; widen the pins only** (bill `total_amount`; line `bill_id`, `invoiced_amount`, `written_off_amount`) | No lock change, so no new wait. Still bill-before-lines (deadlocks stay possible as 500s unless mapped), and a verify that commits between read and write turns every issue into a retry. |
| **C** | **Accept the window** | No work. Leaves a path that puts invoiced money on a line no bill owns. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X30, X35: this is the one ledger lock order (lines `ORDER BY created_at, id`, then bills `ORDER BY id`), which 25 D7 and 26 D5-A also take, with `40P01` → CONFLICT in 24, 25 and 26; Task 2.2 adds its own `it`s, uses a no-Bill-flow fixture org for issue vs unbill, and re-runs every case in `expense.concurrency.test.ts`.
- **Where it lands:** §4.3, Phase 2.

**D4: Can a written-off bill with an uninvoiced balance be invoiced?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Tasks 3.1–3.3

| | Approach | Cost |
|---|---|---|
| **A** | **Yes; full coverage makes it `done`; the row icon is live for it** (Recommended) (Chosen) | Clears the dead end the fee alert already points at, uses states the line model already has (`written_uninvoiced`), no migration. Bills invoiced outside the system in the past become invoiceable twice over in practice; 24-P6 lists them for accounting first. |
| **B** | **No; correct the SOP pitfall and stop the fee alert raising 未开票 for `written_off`** | No money-path change. Makes "paid before invoiced" permanently un-invoiceable, which contradicts partial invoicing and every cash customer's need for a tax invoice. |
| **C** | **A separate "Invoice settled bill" action** with its own refusal set | Explicit for auditors. A second entry point into the same money write, which the handler docblock argues against (`bills.ts:1645-1650`). |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X31: step 25 D6 is superseded, 25 Phase 2 merges and deploys after 24 Phase 3, and 25-P8 adds to 24-P6 for accounting before 24 Phase 3 ships (Phase 3 deploy note, §7.3, §7.6, §7.8).
- **Where it lands:** §4.4, Phase 3, Journey 4.

**D5: What should a Proforma invoice do?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 3.4

| | Approach | Cost |
|---|---|---|
| **A** | **Keep it money-bearing; say so in the dialog and the SOP** (cancel before issuing the tax invoice) (Recommended) (Chosen) | No behaviour change; one line of copy. The bill reads `invoiced` while only a proforma exists. |
| **B** | **A proforma issues a document without advancing `invoiced_amount`** | Matches the word "proforma". Every reader of invoices (cancel, month-end, document, invoice list totals, fee alert) must learn to exclude it; a cancel must not give back money it never took. Large. |
| **C** | **Remove Proforma from the categories** | Simplest. Loses a category eyun has; staff would issue proformas outside the system. |

- **Recommendation: A.** 24-P7 shows whether proformas are used at all.
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X39: the SOP half of "say so in the dialog and the SOP" is an accepted unowned gap; this plan adds the dialog line only.
- **Where it lands:** §4.5, Task 3.4, Journey 5.

**D6: Who owns the credit check at invoicing?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: nothing in this plan's code

| | Approach | Cost |
|---|---|---|
| **A** | **Step 02 Phase 1, as planned there** (warn, require a reason, audit the override) (Recommended) (Chosen) | Already designed in detail against this handler and dialog. Step 24 only keeps it through its rebase. |
| **B** | **Move it into step 24** | Keeps all invoicing changes in one plan; duplicates a finished design and re-opens step 02's decided D1/D3/D9. |
| **C** | **No credit check** | Ledger item `credit` stays open. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).
- **Where it lands:** §1 SOP table, §7.6.

**D7: Merge order against step 02 Phase 1** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: the base branch for `wt-step24`

| | Approach | Cost |
|---|---|---|
| **A** | **02 Phase 1 first; 24 rebases and places 02's exposure re-check after the locked re-read** (Recommended) (Chosen) | 02's check then runs on locked rows for free. 24 waits for 02. |
| **B** | **24 first; 02 rebases onto the in-transaction structure** | 24's Phase 1 ships sooner. 02's plan text ("inside the transaction the handler already opens") still fits, but its author must place the check after the locks. |
| **C** | **One combined worktree** | One review of the handler. Couples two plans' decisions and tests. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21): 02 Phase 1 first; 24 rebases and puts 02's exposure re-check after the locked re-read.
- **Where it lands:** §7.6, Phase 2 Task 2.1.

**D8: What happens to historic rows F3 may have produced?** · Status: **Decided 2026-09-21 — Chosen: A** · Not blocking

| | Approach | Cost |
|---|---|---|
| **A** | **Report only**: Wilfred runs 24-P3, P4, P5, P10 and hands any rows to accounting (Recommended) (Chosen) | No data change; each case judged by someone who knows it. |
| **B** | **A reviewed one-off SQL script** re-deriving line statuses and bill amounts from the splits | Automatic. A production money write outside this step; needs its own review and dev-branch rehearsal. |
| **C** | **Nothing** | Silent residue stays. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).
- **Where it lands:** §7.7.

**D9: How is the Amount prefill rounded?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.4

| | Approach | Cost |
|---|---|---|
| **A** | **The server's 6-dp denoise** (`toFixed(6)` then `Number`) (Recommended) (Chosen) | Agrees with `roundMoney` byte for byte; never changes a real value. |
| **B** | **Round to 2 dp** | Looks like money. Wrong for 0- and 3-dp currencies; `money.ts:19-23` rejects currency-scale rounding as unobserved. |
| **C** | **Leave it** | No work; the field keeps showing `666.6700000000001`. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).
- **Where it lands:** Task 1.4.

### Risks

- _PGlite cannot prove the locks_ → certain → **Phase 2 tests run on the dev Postgres via `DATABASE_URL_TEST`; outputs filed with the PR; PGlite suites must stay green unchanged.**
- _A lock added to the money path deadlocks with a writer this plan did not trace_ → low → **all four other writers traced (§7.1) take lines before bills, and steps 25 and 26 take the same order (X30); `40P01` maps to CONFLICT so a miss is a retry, not a 500.**
- _D4-A makes bills invoiced outside the system invoiceable again_ → medium → **24-P6 and 25-P8 lists to accounting before Phase 3 deploys (X31).**
- _25 Phase 2 deploys before 24 Phase 3, so its cancel confirm promises a re-issue the server still refuses_ → low → **25 Phase 2 merges and deploys after 24 Phase 3 (X31, §7.6).**
- _Step 02 Phase 1 lands with its exposure check before the locks_ → medium under D7-A → **Task 2.1 moves it after the locked re-read and keeps its tests green.**
- _Line numbers drift_ (step 02 edits the same handler) → certain → **every task locates by symbol (`billsRouter.invoice`, `InvoicingDialog`), not by line.**

### SOP text vs code (Phase 0 wins)

Recorded only; no plan edits the SOP (crosscheck X39).

1. "Check **Invoice Title** (prefilled from the bill). Editable." — editable, but the edit is discarded; the invoice's buyer is the bill's title (`bills.ts:1955`, no reader of `input.invoiceTitle`). Fixed by Phase 1.
2. "A bill that is invoiced or written off cannot be invoiced **again**" — a written-off bill may never have been invoiced at all (`write-offs.ts:694`); the refusal (`bills.ts:1801`) is a dead end the fee alert contradicts (`fee-alert.ts:97`). Changed by Phase 3 (D4-A).
3. "Invoice Number — auto-generated if blank" — true (`NCT-INV-YYYYMM-NNNN`, org-wide counter); silent on the 500 for a duplicate and on the jam. Fixed by Phase 1.
4. "Invoice Category required / Invoice Type required" — required by the button only (`bills.tsx:604`); the server accepts neither (`bills.ts:1716-1717`). Accurate for the UI; no change.
5. The category list includes **Proforma invoice**, and the SOP does not say it spends the bill's balance. Copy added by Phase 3 (D5-A).
6. "Frozen by the Input invoice no. review gate until the latest bill review passes" — true only where the key is ticked (seeded for new orgs, `seed.ts:192`); 24-P8 shows each org.
7. Everything else in the step card, guide and pitfalls matches the code: route and title, `expense:read` / `expense.invoice.create`, the five category and two type values, the prefilled outstanding and the "X of Y already invoiced — Z outstanding" line (`bills.tsx:591-595`), the over-balance sentence, the partial path leaving the bill open, the writes (invoice, `invoice_bill`, `invoice_line`, bill and line amounts and statuses), no credit check, no multi-bill UI, and the hand-off to Money > Invoices ("Invoice Record").

## 10. Verification & Proof

**App URL:** http://localhost:3101 (server :3000). One worktree's servers at a time (runbook §9). Announce the active org before driving the browser (memory: "Shared session active org").
**Preconditions:**
- A seed-parity org (`e2e/fixtures/seed-cli.ts seed-parity <runId>`) with an **accounting** cookie and a **viewer** or field-restricted role for the rbac edge case; the bill flow ticking `input_invoice_no`.
- Bill **B1**: receivable, MYR, one line 4,200, approved, open, Invoice Title "Sunrise Trading".
- Bill **B2**: receivable, MYR, lines 600 + 400 = 1,000, approved, open (partial and race cases).
- Bill **B3**: receivable, MYR, one line 1,000, approved, **no invoice**, fully written off against a verified payment (Journey 4).
- Bill **B4**: receivable, MYR, 1,000, approved, invoiced 400, then fully written off.
- An existing invoice numbered `44444` in the org (issue one with that typed number first).

**Migrations:** none.

**Unit / integration tests to add or change** (run each, read the output for `failed`):
- `packages/api/src/routers/expense.bills.test.ts`: title → buyer; blank title; explicit buyer wins; duplicate number CONFLICT with no side effects; duplicate of a cancelled number; trimming; generated-shape refusal (both cases); blank → generated (Phase 1). Settled-bill cases (Phase 3).
- `packages/api/src/routers/expense.rbac.test.ts`: denied `invoice.buyer`/`seller` cannot write them through `bills.invoice`.
- `packages/api/src/routers/expense.concurrency.test.ts` (real Postgres): issue vs unbill, issue vs verify, issue vs cancel, 20 repetitions each; the existing two-issue test.
- Unchanged but re-run: `expense.ledger.test.ts`, `expense.corrections.test.ts`, `expense.wave1.test.ts`, `expense.filters.test.ts`, `expense.cross-currency-writeoff.test.ts`, the workbench fee-alert tests, `packages/api/src/architecture.test.ts`.

**Golden path (Journey 1):**
1. As accounting, open `/expenses/bills`, type `B1`'s number in **Search all columns** → one row, status open, **Invoicing** icon enabled.
2. Press **Invoicing** → dialog **Invoicing — <B1 no>**; Title "Sunrise Trading"; Amount `4200`.
3. Pick **VAT general invoice**, **Electronic**; leave Invoice Number blank; change Title to "Sunrise Trading Sdn. Bhd."; press **Issue Invoice** → toast _"Invoice NCT-INV-<yyyymm>-<n> issued"_; the dialog closes; the row shows `invoiced` and the icon greys.
4. Open `/expenses/invoices` → the new row shows buyer "Sunrise Trading Sdn. Bhd.", amount 4,200.00, state issued.
5. Open the invoice's preview (step 25) → Buyer prints "Sunrise Trading Sdn. Bhd.".
6. Back on `/expenses/bills`, open **Edit bill details** for B1 → its Invoice Title still reads "Sunrise Trading".

**Edge case 1: partial, then prefill (Phase 1 D9).** On B2, invoice `333.33` → toast; the row stays open. Re-open **Invoicing** → Amount reads `666.67`, and the line under it reads "333.33 of 1,000.00 already invoiced — 666.67 outstanding". Issue it → the bill shows `invoiced`.

**Edge case 2: number clash and shape (Journey 2).** On a fresh open bill, type `44444` → toast _"Invoice number 44444 is already used in this organisation."_; the dialog stays open; `/expenses/invoices` has no new row. Type `NCT-INV-202609-9999` → the shape refusal toast. Clear the number → issues with a generated number.

**Edge case 3: paid before invoiced (Journey 4, Phase 3).** Find B3 → status `written_off`, **Invoicing** icon enabled (today greyed). Invoice it in full → toast; the row shows `done`. The workbench fee alert no longer lists B3 under 未开票. Repeat with B4 → Amount prefills `600`; after issuing, `done`.

**Edge case 4: proforma hint (Phase 3).** In the dialog pick **Proforma invoice** → the hint line appears under the select; pick another category → it disappears.

**Edge case 5: races (Journey 3, dev Postgres).** Use an org whose Bill flow is absent or has "Can edit after approval" (X35; under the seeded flow the unbill on approved B2 is refused before any race). From `e2e/out/_walk/`, run a node walk (not bun; memory "Playwright launch hangs under bun") with the accounting cookie that fires `bills.invoice` on B2 and `costLines.unbill` on its 400 line with `Promise.all` → one fulfils, one rejects with a sentence (never "Internal server error"); `/expenses/invoices` and `/expenses/bills` agree on the amounts.

**Edge case 6: field restriction.** As a role denied `invoice.buyer`, call `bills.invoice` from the walk script with `buyer: "INVENTED"` → the stored buyer is the bill title.

**Regression check.**
- Cancel an invoice from `/expenses/invoices` → its bill returns to open (or `written_off` for B3/B4) and its lines' invoiced amounts return, as today.
- `costLines.unbill` on a bill with no invoice still works; on an invoiced bill it still refuses with "cancel its invoice(s)".
- The Bills footer totals (Receivable, Have-been received, Unwritten-off) are unchanged for the same filter.
- `/approve/bill` (step 23) is unchanged; a bill whose review is not approved still refuses with the gate sentence.

**Mobile:** at 400px the Invoicing dialog stacks its two selects without horizontal scroll, and the Proforma hint wraps.

**Readiness: 8/10.** Phase 1 is small, fully located and testable at the API boundary; Phase 3 reuses states the model already has. What holds the score back:
- D4-A changes what accounting can do with existing paid bills, and 24-P6/25-P8 are unrun.
- Phase 2 can only be proven on a real Postgres, and the executor needs a dev URL.
- Step 02 Phase 1 edits the same handler and dialog first (D7-A), so line numbers here will move.
- The size of live residue (24-P3 to 24-P6, P10) is unknown until Wilfred runs the probes.

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and the Proposed reading of every cross-plan item in `steps-20-26-crosscheck.md` (X28–X40). Each §9 entry keeps all three approaches; only the status, the Chosen line and the text that described a decision as open were changed, plus the task and order text the crosscheck items below required.

**Chosen:** D1-A · D2-A · D3-A · D4-A · D5-A · D6-A · D7-A · D8-A · D9-A.

**Crosscheck overrides as they land in this plan.** No X-item picks a different option here; these add to the chosen ones.
- X30 → D3-A is the one ledger lock order (payment → lines `ORDER BY created_at, id` → bills `ORDER BY id`); §4.3 names it and records that step 25's cancel (25 D7) takes lines → bills after its pinned `UPDATE invoice`, not bill → lines; Task 2.1, Risks and §7.6's step 25 row note `40P01` → CONFLICT in 24, 25 and 26. This plan never described 25's cancel as bill → lines, so no sentence was reversed.
- X31 → D4-A supersedes step 25 D6; Phase 3 gains a deploy/release note (25 Phase 2 merges and deploys after 24 Phase 3; accounting sees 24-P6 and 25-P8 before 24 Phase 3 ships); §7.3, §7.6 (step 25 row and required order), §7.8 and Risks say the same.
- X35 → Task 2.2: each case is its own `it`; failing pre-change and passing runs pasted from the dev Neon branch; the Phase 2 PR re-runs every case already in `expense.concurrency.test.ts`; the issue-vs-unbill fixture org has no Bill flow, and its docblock says so and why. §10 edge case 5 uses an org whose Bill flow is absent or has "Can edit after approval".
- X39 → §8 "SOP" and §9 "SOP text vs code": recorded only, no plan edits the SOP; D5-A's SOP half is part of that gap.
- X40 → the "no plan at time of writing" labels in §7.6 stay; the step 25 row, edited for X30/X31, notes the label is stale.
- X28, X29, X32, X33, X34, X36, X37 → do not touch this plan; no text change. X38 → no migration under any chosen option; no text change.
