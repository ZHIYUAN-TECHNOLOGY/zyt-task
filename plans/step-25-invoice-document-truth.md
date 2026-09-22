# Step 25 — the invoice a customer receives states the terms, the date and the buyer the ledger holds, the preview shows what the file prints, and a void never promises a re-issue it cannot deliver

**SOP step:** 25 "Produce and hand over the document" · Sidebar **Money → Invoices** (`/expenses/invoices`, page title **Invoice Record**) → row icon **Preview & download invoice document** → **下载 PDF** / **下载 XLSX** · row icons **Mark printed** and **Cancel invoice**
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-21. The `nct-layout` working tree is on `feat/intake-golden-path-e2e` at `ea1560e7`, and `git diff --stat 6bb3a1bf HEAD -- packages apps` is empty, so every code citation below matches `6bb3a1bf`. This is the same commit steps 04–15 were planned at. Every `file:line` was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Small–Standard. Two phases. Phase 1 changes a pure document builder, its loader and the preview dialog. Phase 2 changes one money-reversing handler (`invoices.cancel`). **No migration under any recommended option.**
**Cross-plan items owned:** the step-25 half of ledger item `identity` ("repairs: b 20, s 25") and of `lump-sums` ("repairs: s 11, s 25"). For `lump-sums` step 11 §1 already states that step 25 only prints what arrives; this plan confirms that (Phase 0) and plans no code for it. For `identity` the root cause is step 20's (the cost line loses the company). This plan takes only what step 25 can honestly do: warn before the document goes out (D8).
**Status:** every decision in §9 is **Decided** (Wilfred, 2026-09-21: the recommended option throughout, with the crosscheck X-item overrides listed in "Decisions settled" at the end — D6 superseded under step 24 D4-A (X31), D7-A in the X30 lock order). No production probe has been run; all are SELECTs for Wilfred.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope` at `procedures/org.ts:429`, `permittedNode` at `:287`). Drizzle schema in `packages/db/src/schema`, migrations in `packages/db/src/migrations`. TanStack Router file routes in `apps/web/src/routes/_next`. zod on both sides. vitest on PGlite (`pushTestSchema`); real-Postgres suites gate on `DATABASE_URL_TEST` (`routers/expense.concurrency.test.ts`). Dev: web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Page.** `/expenses/invoices` is `routes/_next/expenses/invoices.tsx`, wrapped in `RequirePermission perm="expense:read"` (`:102`); nav entry `components/shell-next/nav.ts:232` (`p: "expense:read"`). The list calls `invoices.list`, gated `requireNode(EXPENSE.invoiceRead)` (`routers/expense/invoices.ts:381-382`).
  - **Preview.** The row's download icon (`invoices.tsx:348-361`, title "Preview & download invoice document" `:355`) opens `InvoiceDocumentDialog` (`:282`). On open it calls `invoices.document` (`:300-305`; router `invoices.ts:452-455`, node `invoiceRead`), which runs `loadInvoiceDocument` (`:282-377`) and returns the model built by `buildInvoiceDocument` (`modules/export/invoice-document.ts:386-455`). The dialog draws it with `InvoiceDocumentPreview` (`invoices.tsx:450-522`).
  - **Files.** **下载 PDF** / **下载 XLSX** (`:416-430`) call `invoices.exportDocument` (`invoices.ts:473-536`, node `invoiceRead`). It re-runs the same loader, writes an `expense.invoice.exportDocument` audit row (`:491-509`), and returns base64. The PDF branch first runs `findInvoiceUnrenderableCell` (`:524`) and refuses Latin-unrenderable text with BAD_REQUEST (`:525-531`). Both sinks read `invoiceDocumentSheet` (`invoice-document.ts:522-596`; the PDF through `modules/pdf/invoice.ts:115`).
  - **Downloaded mark.** After a successful save the **client** calls `onDownloaded` only when `!invoice.isDownloaded` (`invoices.tsx:326`), which fires `invoices.markDownloaded` (`:828-835`; router `invoices.ts:538-551`, node **`invoiceUpdate`**, through `invoiceWriter` `:62-99`). The mark is a second request with a different permission from the download.
  - **Printed mark.** `markPrinted` (`invoices.ts:553-566`); button disabled once printed (`invoices.tsx:704`).
  - **Void.** **Cancel invoice** (`invoices.tsx:711-727`) → `invoices.cancel` (`invoices.ts:577-743`, node `invoiceCancel`). Draft → cancelled with no money movement (`:598-615`); already cancelled → no-op (`:599`). Issued → one transaction (`:619`): flip `state`/`viState` pinned on `state = 'issued'` (`:624-653`), read coverage (`:660`) and the per-line split (`:670`), then per bill: read its lines (`:676`), give each line back its split share (`:680-693`) or zero every line (legacy, `:694-705`), `GREATEST(invoiced − cov.amount, 0)` on the bill (`:711-717`), and re-derive the bill status (`:719-725`), then audit (`:728-737`).

- **Finding 1 (money, customer-facing): the document prints the buyer's *current* payment term, not the term the bill was raised under, and a different due date from the one the ledger chases.**
  - `resolveTerms` (`invoice-document.ts:354-376`) reads `company.days_payable` **as it is today** (`:358`, loaded at `invoices.ts:353-364`) and computes `invoice date + N` (`:363-365`).
  - Migration `0062_payment_terms_due_date.sql` gave every bill a **frozen snapshot**: `bill.payment_terms_days`, `payment_terms_anchor`, `due_date` (schema `schema/expense.ts:355-368`). The trigger copies `days_payable` at insert (`0062:149-160`), anchors `due_date` on `bill.created_at` (`0062:173-178`), and refuses to move terms or due date once set (`0062:130-144`). The migration's header states the rule: the due date "is what they told the customer".
  - So when the company's term is edited after the bill was raised, the invoice prints the **new** term while ageing and the Overdue chip use the **old** one. And the document's builder comment still says "Storing a due date on the bill is a later phase's decision" (`invoice-document.ts:233-238`), which 0062 overtook.
  - On a multi-bill invoice, only the **first** bill that has a company is looked at (`invoices.ts:346-348`). Bills with different terms are not noticed.
  - The builder's `InvoiceDocumentBill` input (`invoice-document.ts:90-99`) has no terms field, although the loader already selects every bill column (`invoices.ts:317-322`).
  - The 0062 anchor (`bill.created_at`) versus the document's (`invoice_time`) is a known, documented approximation (`0062:66-84`). This plan does not re-anchor the ledger (D1 option C, out of scope).

- **Finding 2 (integrity): what the customer receives depends on who pressed Download.**
  - The loader masks every input by the caller's Field axis (`invoices.ts:368-371`: `maskRow(row, org, "invoice")`, `maskFields(bills, org, "bill")`). `invoice` masks `buyer`/`seller` and `bill` masks `settlementUnit`/`invoiceTitle` (`modules/expense/permissions.ts:238`, `:251`).
  - A caller denied `bill.settlementUnit` also skips the company read entirely (`invoices.ts:346`), so address, tax ID and payment terms are dropped too.
  - `resolveBuyer` (`invoice-document.ts:325-344`) then finds no name. `infoRow` drops a null (`:505-507`), so **the file carries no Buyer row at all and no Payment terms row**, and nothing tells the operator. The same invoice downloaded by an owner (never masked, `serialize.ts:41`) prints a full buyer block.
  - That is right for the **screen** and wrong for a **customer document**: the person who cannot see the buyer should not be the one producing the buyer's invoice, and if they are, the file must not silently go out incomplete. See D3.

- **Finding 3 (dead end, false promise): voiding the invoice of a fully settled bill leaves a bill that can never be invoiced again, while the dialog promises the opposite.**
  - `cancel` sets the bill to `written_off` when every line is fully written off (`invoices.ts:719-725`). A bill that was `done` (invoiced and settled, `write-offs.ts:694`) therefore becomes `written_off`.
  - `bills.invoice` refuses anything but `open` (`bills.ts:1801-1805`: "Bill … is not invoiceable (status: written_off)").
  - The confirm dialog says _"Its bill reverts to Open and its cost lines become uninvoiced, so it can be re-invoiced."_ (`invoices.tsx:721`). The SOP step says the void "makes the bill re-invoiceable". Both are false for a paid bill.
  - The only way out is to reverse the write-off first (`writeOffs.reverse`, `write-offs.ts:867`, which puts a `written_off` bill back to `open`, `:1124`), then invoice, then write off again. Nothing on the page says so. The typical cause is a paid invoice with a typo in the buyer name: after the void, accounting cannot issue the corrected one.
  - **Settled (X31):** step 24 Phase 3 (24 D4-A) lets `bills.invoice` issue on a `written_off` bill with an uninvoiced balance (→ `done`), so the dead end closes there. Step 25 adds no refusal; it corrects the confirm text and locks the void.

- **Finding 4 (concurrency): the void reads the bill's lines without a lock and writes absolute values, so it can erase a concurrent write.**
  - Inside the transaction, `cancel` reads lines with a plain `select` (`invoices.ts:676`), then sets `invoicedAmount` to `stale − split` (`:684-690`) and `status` from the stale row (`deriveStatus({ ...l, invoicedAmount })`, `:689`). It also derives the bill status from the stale lines (`:719-722`).
  - Two writers can interleave under READ COMMITTED. The first is `bills.invoice` issuing the **remainder** of a partially invoiced bill (a partially invoiced bill stays `open`, `bills.ts:1797-1800`). Its bill update is pinned (`:1998-2002`), but its line updates (`:2027-2036`) commit before the cancel's line update runs. The second is `writeOffs.verify`, which writes `writtenOffAmount`, line status and bill status with no lock (`write-offs.ts:694-706`; no `.for("update")` anywhere under `routers/expense` except through the governed writer, `modules/governed/writer.ts:234`).
  - The cancel's line UPDATE then waits on the other transaction's row lock and overwrites its increment with a value computed before it. Result: `cost_line.invoiced_amount` no longer sums to `bill.invoiced_amount`, or a line's `status` contradicts its `written_off_amount`.
  - The bill figure itself is safe: it is a relative `GREATEST(...)` update (`:715`). Probe 25-P9 sizes any residue.
  - The window is small (two people acting on one bill in the same second), but the damage is silent and lands in money columns.

- **Finding 5 (the preview is not the document).** The dialog's description says _"The document as the counterparty receives it"_ (`invoices.tsx:373-376`). The preview (`:450-522`) draws only three columns (Bill Number, Description, Amount, `:478-480`) and one **Total**, which is `coveredTotal` (`:505-516`). The files print eight columns (`invoice-document.ts:468-477`: Bill No., Order No., Master doc no., Fee name, Qty, Unit price, **Tax rate**, Amount) and **both** totals, with the partial label (`:572-583`).
  - On a partial invoice the preview's lines add up to more than its Total, with no word saying why.
  - The preview header hard-codes **INVOICE** (`invoices.tsx:461`), so a cancelled invoice previews as live, although the files say **INVOICE — CANCELLED** (`invoice-document.ts:536`) and add `_CANCELLED` to the file name (`:500`).
  - The invoice date is a `YYYY-MM-DD` string shown through `formatDateTime` (`invoices.tsx:463`; `lib/expense.ts:227-238`), which adds an invented time of day (08:00 in Kuala Lumpur).
  - The model already carries every missing field. This is a rendering gap, not a data gap.

- **Finding 6 (customer-facing date): the invoice date and due date are UTC calendar days.** `isoDate` is `toISOString().slice(0, 10)` (`invoice-document.ts:252`). The builder calls this "so the string never shifts by host" (`:251`), but it shifts by business day: an invoice issued at 07:30 in Kuala Lumpur (23:30 UTC the day before) prints yesterday's date and a due date one day early.
  - Every branch has a NOT NULL `team.timezone` (`schema/organization.ts:73`). The number allocator already renders dates in a zone (`lib/document-number.ts:27-37`, `calendarParts`), so the invoice **number** `INV2609…` and the printed **date** can disagree about the month on the last morning of a month.
  - Probe 25-P4 sizes it.

- **Finding 7 (permission, small): directors and viewers get an error after a successful download, and the mark can be lost.** `exportDocument` needs `invoiceRead`; `markDownloaded` needs `invoiceUpdate`. The seeded **director** and **viewer** roles hold only `expense.invoice.read` (`roles.ts:208`, `:233`). They save the file, see _"Saved …"_, then get the global mutation error toast (`utils/orpc.ts:63-90`) for `markDownloaded`. For everyone else the mark depends on a second request from the tab. The server already knows the file was produced (its audit row), but does not record it on the invoice. Probe 25-P7 counts exported-but-never-marked invoices.

- **Finding 8 (display): the "Active (this page)" tile is always 0.** It counts `d.state === "active"` (`invoices.tsx:866`), but the only states are `draft | issued | cancelled` (`schema/expense.ts` invoice `state` comment; `routers/expense/labels.ts:50-54`).

- **Finding 9 (the identity break, as step 25 sees it).** The buyer's address, tax ID and payment terms come only from `bill.settlement_company_id` (`invoices.ts:346-348`). On the happy path that is NULL: the cost line created from the order carries no company (step 20's break), and `createBill` copies the line's value onto the bill (`routers/expense/cost-lines.ts:2638`). The document then prints the name only (`invoice-document.ts:333-343`), and **nothing on the preview warns** before the file goes to the customer. Root fix: step 20. Step 25: D8.

- **Confirmed sound (no change planned).**
  - The seller block never carries a tax ID (`invoice-document.ts:291`).
  - The void is atomic in one transaction, and a concurrent double void yields CONFLICT (`invoices.ts:624-653`).
  - The split-based reversal gives each line back exactly what this invoice took (`:670-693`).
  - `bill.invoiced_amount` is clamped at zero (`:715`).
  - Unbilling a line on an invoiced bill is refused (`cost-lines.ts:1436-1442`), so an issued invoice's line set is fixed.
  - The PDF charset guard runs before the renderer and names the offending text (`invoices.ts:524-531`).
  - Cancelling a cancelled invoice is a no-op (`:599`), and its icon is disabled (`invoices.tsx:715`).
  - The mixed-currency guard (`invoice-document.ts:392-398`) is backed by `bills.invoice` (`bills.ts:1782-1787`).
  - `lump-sums`: the document prints `quantity`/`unit_price` verbatim (`invoice-document.ts:420-421`, `:563-567`). Blanks come from conversion (step 11 Phase 3), so there is no step-25 change.

- **Not defects, out of scope.**
  - No send-by-email: a missing feature, not a broken one. Step 09's outbox is quotation-only.
  - No SST/GST: this is a commercial invoice.
  - Voiding is not gated by the approval engine (`modules/expense/gates.ts` declares no invoice keys). That is a control-design question, and it belongs with the `bill-rewrite` ledger item (steps 23/26).
  - A **cancelled** invoice re-rendered after its bill changed reads today's rows. `resolveBuyer`'s own comment names the real fix (freeze the buyer at issue), and it needs a column. Listed under Risks.

- **Architecture gate.** `packages/api/src/architecture.test.ts:418-421` and `:675-676` list `invoicesRouter.cancel`'s raw writes by enclosing scope: `update(costLine)` ×2, `update(bill)` ×2, `update(invoice)` ×2. A duplicate key is deliberate (`:287-291`), and a stale entry fails the gate. Phase 2 must keep exactly those write statements, or change the list in the same commit. Locks are SELECTs and are not listed. This is the **api** architecture test, not the web one.

- **Tests that exist.**
  - `modules/export/invoice-document.test.ts` pins the builder, including terms (`:318-330`) and the date (`:303-316`).
  - Router-level void tests: `expense.ledger.test.ts:611`, `expense.corrections.test.ts:347`, `:375`, `:394`, `expense.wave1.test.ts:159`.
  - **No router test calls `invoices.document` or `invoices.exportDocument`** (grep of `packages/api/src/**/*.test.ts`).
  - `expense.concurrency.test.ts` covers `createBill` and `bills.invoice` races on real Postgres (`:105`, `:137`), and has no void case.

- **Migration state.** The journal ends `0065_quotation_send_decision` (65 `.sql` files, contiguous). Steps 01–15 reserve or hold `0066`–`0074` and `00NN_` placeholders. **This plan needs no migration under any option it recommends.** D1-C (re-anchor the bill due date at invoicing) would need a trigger change; it is listed as rejected and would take `00NN_bill_due_date_invoice_anchor`, numbered at merge.

- **The SOP text vs the code:** see §9 "SOP text vs code (Phase 0 wins)".

**Step 25 is mostly sound.** The document machinery (one loader, one model, two sinks, audited export, atomic split-based void) is careful work. The defects are:
- what it reads for terms, date and buyer;
- the preview drawing less than the file;
- one false promise and one unlocked read in the void.

Hence two small phases.

---

## 1. Overview

**Problem.**
- The invoice the customer receives can state a payment term the bill was never raised under, and a date that is a day early.
- It can leave out the buyer entirely, depending on who downloaded it.
- The preview accounting approves shows no tax rate, no quantities and one total, where the file shows eight columns and two totals.
- Voiding a paid invoice promises a re-issue that the system then refuses.
- Two people on one bill in the same second can leave its lines and its total disagreeing.

**Goal.**
- **Phase 1 (Findings 1, 2, 5, 6, 7, 8, 9):**
  - the document prints the bill's own frozen payment term and the branch's calendar date;
  - a caller who cannot see the buyer cannot produce the file;
  - the preview shows everything the file prints, including CANCELLED;
  - producing the file records Downloaded on the server;
  - the preview warns when the buyer block will be incomplete.
- **Phase 2 (Findings 3, 4):** the confirm text tells the truth, and the void locks what it reverses. Voiding the invoice of a fully settled bill is not refused: after step 24 Phase 3 the bill it leaves `written_off` can be invoiced again (X31).

**Success criteria.**
- A company whose term was 30 days when the bill was raised, and 45 now, gets an invoice reading _"30 days after invoicing (due 2026-10-03)"_ for an invoice dated 2026-09-03. Today it reads 45 days.
- An invoice issued at 07:30 Kuala Lumpur time on 3 Sep prints `2026-09-03`.
- A member denied `bill.settlementUnit` presses **下载 XLSX** and gets _"You cannot see this invoice's buyer, so you cannot produce its document. Ask a colleague who can."_ No file is produced and no audit row is written. The preview still opens (masked), with a notice.
- The preview of a partial invoice shows the eight columns, **Total of lines** and **Invoiced on this document (partial)**. A cancelled invoice previews under **INVOICE — CANCELLED**.
- A director downloads a file: _"Saved Invoice_….xlsx"_, no error toast, and Downloaded stays as it was, because they do not hold `invoiceUpdate` (D5-A). An accountant's download sets Downloaded in the same request.
- Voiding the invoice of a `done` bill succeeds and leaves the bill `written_off`; `bills.invoice` then re-issues it and the bill ends `done` (step 24 Phase 3, X31). The void of a partly paid or unpaid bill works as today.
- A real-Postgres interleave of the void against `bills.invoice` on the same bill leaves `Σ cost_line.invoiced_amount = bill.invoiced_amount`.

**In scope.**
- `buildInvoiceDocument` terms, date and warnings.
- `loadInvoiceDocument`'s bill terms and branch timezone.
- The `exportDocument` masked-caller refusal and the Downloaded stamp.
- The preview dialog and the stats tile.
- The `cancel` locks and its confirm text (no settled-bill refusal; X31).
- Tests.
- Read-only production probes.

**Out of scope.**
- Carrying the company onto the cost line (step 20).
- Re-anchoring or back-filling `bill.due_date` (steps 22/27; D1-C).
- Freezing the buyer's address and tax ID onto the invoice at issue (needs a column; Risks).
- Email delivery.
- A tax invoice (SST).
- An approval gate on voiding (steps 23/26).
- Locking inside `writeOffs.verify` (step 26's handler; flagged).
- Letting `bills.invoice` issue on a `written_off` bill (step 24 Phase 3, 24 D4-A; X31).
- Re-writing the SOP page (a zyt-update after deploy; flagged in §7.8).

**Tracker items (`tracker/seed/tasks-nct.json`, ledger `repairs` naming step 25):**

| Ledger id | Kind at step 25 | Planned here? | Why |
|---|---|---|---|
| `identity` "The customer's identity does not survive the journey" | `s` 25 (and `b` 20) | **Partly: Phase 1, D8 (warning)** | The loss happens at step 20; step 25 can only refuse to hide it. |
| `lump-sums` "Conversion turns every fee into a lump sum" | `s` 25 (and `s` 11) | **No** | Step 25 prints what arrives (Phase 0); step 11 Phase 3 carries it. |
| break after step 20 ("The customer's identity ends here") | names step 25's buyer block | **Partly (D8)** | Same as `identity`. |

**Assumptions.**
- `bill.payment_terms_days` is the term the ledger means (0062 header).
- `team.timezone` is a valid IANA zone (`timezoneSchema`, `lib/document-number.ts:24`).
- No external caller depends on `exportDocument` succeeding for a masked caller (none in the repo; grep §7.1).

## 2. User Journeys

**Journey 1 (changed): Accounting produces and hands over the invoice**
Trigger: invoice `INV2609-00031` was issued at step 24 for bill `BI2609-0012` (Acme Trading, raised under a 30-day term; Acme's term has since been edited to 45).
Steps:
1. Accounting open **Money → Invoices** → the tiles read **Total Invoices**, **Issued (this page)** (D10-A; it used to read an always-zero "Active"), **Cancelled (this page)**, **Downloaded (this page)**.
2. They press **Preview & download invoice document** on the row → **发票预览 · Invoice INV2609-00031** opens.
   - The preview now shows the same eight columns the file prints, **Total of lines** and **Invoiced on this document**, and **Payment terms: 30 days after invoicing (due 2026-10-03)**. It used to be 45 days, from today's company.
   - The date reads **3 Sep 2026** with no time of day.
3. If the buyer block will be incomplete, a notice above the document reads, for example: _"This invoice's bill has no linked company, so the buyer's address, tax ID and payment terms will not print. Link the company on the bill's cost lines before sending, or send as is."_ (D8-A). If the covered bills carry different terms, a notice names them (D2-A).
4. They press **下载 PDF** → toast _"Saved Invoice_INV2609-00031.pdf"_. The server has set Downloaded in the same request (D5-A), and the row's Downloaded column reads Yes after the list refetches.
5. If **PDF refused** appears, they press **下载 XLSX** (unchanged).
6. They close with **取消** and send the file outside the system (unchanged).
7. After printing, they press **Mark printed** (unchanged).
Where it lives: the existing dialog and row. No new screen.

Old journey, for contrast:
- Step 2 showed three columns and one total, and a time of day on a date.
- The term was today's 45 days.
- A buyer without a company went out as a bare name with no warning.
- The Downloaded mark was a second request from the tab.

**Journey 2 (new refusal): A member who cannot see the buyer tries to produce the file**
Trigger: a tenant's "Junior accounts" role is denied the counterparty name on bills (Field axis).
Steps:
1. The member opens the preview → the buyer block reads **—**, with a notice: _"The buyer's details are hidden from you, so you cannot download this document."_ Both download buttons are disabled when the model says `buyerHidden` (D3-A).
2. From a direct RPC call, `exportDocument` returns FORBIDDEN with _"You cannot see this invoice's buyer, so you cannot produce its document. Ask a colleague who can."_ No audit row and no Downloaded mark are written.
Where it lives: the existing dialog; server refusal in `exportDocument`.

**Journey 3 (changed): Accounting voids a wrong invoice**
Trigger: `INV2609-00031` printed the wrong buyer name.
Steps:
1. **Unpaid or partly paid bill** (unchanged behaviour): **Cancel invoice** → the confirm text now reads _"Invoice INV2609-00031 will be cancelled. The amount it invoiced goes back to its bill, so the bill can be invoiced again."_ → **Cancel Invoice** → toast _"Invoice cancelled"_. The bill reads **Open**, and step 24 can issue the corrected invoice.
2. **Fully settled bill** (no refusal; X31): the same press and the same confirm text → toast _"Invoice cancelled"_. The bill reads **Written off** (its lines are still fully written off), and step 24 can issue the corrected invoice on it (24 Phase 3, D4-A), after which the bill reads **Done**. No write-off is reversed.
3. Flow ends: one issued invoice per bill share. The bill's lines and total agree, even if someone was issuing or settling on the same bill at that moment (Phase 2 locks).
Where it lives: the existing Cancel icon and confirm.

## 3. Result (What Changes for the User)

**Before:**
- The file states today's term and a UTC date.
- It may silently lack the buyer.
- The preview shows less than the file.
- A void of a paid invoice strands the bill.
- A same-second void can corrupt line totals.

**After:**
- The file states the bill's own term and the branch's date.
- It is refused rather than sent incomplete.
- The preview matches the file and warns about a thin buyer block.
- Downloaded is recorded by the server.
- A void of a paid invoice leaves a bill that can be invoiced again (step 24 Phase 3, X31), and the confirm text says so.
- The void serialises with issuing on the same bill.

**Key differences:**
- **Accounting:** new warnings in the preview; the Issued tile counts; a paid invoice with a typo is corrected by cancel → re-issue (X31).
- **Directors and viewers:** no error toast after a download; their download no longer sets Downloaded (D5-A).
- **Tenants with Field denials on the buyer:** those members can preview but not produce the file.
- **Customers:** see the term they agreed to and the right date.

## 4. Technical Architecture

### Data flow (after both phases)

```
invoices.document / exportDocument({invoiceId[, format]})
  loadInvoiceDocument
  ├─ invoice (scoped)                                   unchanged
  ├─ coverage → bills (scoped) → cost lines             unchanged
  ├─ bill terms: payment_terms_days, due_date           NEW input (already selected)
  ├─ buyer company (unless denied)                      unchanged
  ├─ branch timezone: team.timezone by invoice.owningBranchId   NEW (D4)
  └─ buildInvoiceDocument(…, {timezone, buyerHidden})   terms from bill snapshot (D1, D2),
                                                        dates in branch zone (D4), warnings[] (D8)
exportDocument
  ├─ if document.buyerHidden → FORBIDDEN (D3-A)          NEW, before any audit row
  ├─ render; auditExport                                 unchanged
  └─ if permittedNode(org, invoiceUpdate) && !isDownloaded → invoiceWriter.mutate(markDownloaded)   NEW (D5-A)

invoices.cancel({id, reason})  — issued branch
  tx.begin
  ├─ UPDATE invoice … WHERE state='issued'              unchanged (row lock on the invoice)
  ├─ coverage, split                                     unchanged
  ├─ SELECT cost_line … WHERE bill_id IN (…) ORDER BY created_at, id FOR UPDATE   NEW (D7-A, X30 order), replaces per-bill read
  ├─ SELECT bill … WHERE id IN (coverage) ORDER BY id FOR UPDATE      NEW (D7-A, X30 order)
  ├─ per bill: line updates from the LOCKED rows; bill GREATEST; bill status   same statements
  │   (a fully written bill still ends written_off; no refusal — D6 superseded, X31)
  ├─ audit                                               unchanged
  └─ 40P01 (deadlock) → CONFLICT, a retry                NEW (X30)
```

### 4.1 Terms from the bill's snapshot (Journey 1 step 2; Phase 1) → D1, D2

- `InvoiceDocumentBill` gains two **optional** fields, `paymentTermsDays?: number | null` and `dueDate?: string | null`. They are optional so the existing fixtures (`invoice-document.test.ts:20-150`) still type-check, and so step 11's added test is untouched. The loader passes them from the bill rows it already reads (`invoices.ts:317-322`).
- `resolveTerms(issued, bills, company, timezone)` under D1-B:
  1. Collect the covered bills' `paymentTermsDays` that are not null.
  2. If there are none, fall back to `company.daysPayable` (today's value, as now). The text then reads _"… days after invoicing (due …) — from the customer's current terms"_, so the source is visible in the preview, and a warning is added (D1-B).
  3. If they differ, apply D2: under D2-A print the **shortest** term and add a warning naming the terms per bill.
  4. The due date is `invoice date (branch zone) + N`. The anchor stays the invoice date, as the text says (`after_invoicing`). The ledger's `bill.due_date` is not printed (D1-C rejected).
- `InvoiceDocumentTerms` gains `source: "bill" | "company" | null`. It is additive.
- Refresh the stale comment at `invoice-document.ts:224-238` to cite 0062.

### 4.2 Dates in the branch's calendar (Journey 1 step 2; Phase 1) → D4

- `InvoiceDocumentInput` gains `timezone?: string` (default `"UTC"`, so every existing test keeps its value).
- `isoDate(d, tz)` uses `calendarParts(tz, d)` from `lib/document-number.ts:27`. That is one helper, the one the invoice number itself uses. `modules/export` importing from `lib` is allowed: `lib` is a leaf. Re-check the web and api architecture import rules at the base commit.
- The due-date arithmetic runs on the zoned calendar date (`YYYY-MM-DD` + N days via `Date.UTC`), so rollover still normalises.
- The loader reads `team.timezone` where `team.id = invoice.owningBranchId`, scoped by `organizationId`. An unknown or absent branch falls back to `"UTC"` and adds no warning, because the column is NOT NULL.

### 4.3 The masked caller (Journey 2; Phase 1) → D3

- The loader computes `buyerHidden = isFieldDenied(org, "invoice", "buyer") || isFieldDenied(org, "bill", "settlementUnit") || isFieldDenied(org, "bill", "invoiceTitle")` and passes it to the builder. It becomes `document.buyerHidden: boolean` on the model (additive).
- `exportDocument`: right after `loadInvoiceDocument` and **before** `auditExport`, `if (document.buyerHidden) throw new ORPCError("FORBIDDEN", { message: "You cannot see this invoice's buyer, so you cannot produce its document. Ask a colleague who can." })`.
- `document` (the preview) is unchanged: it returns the masked model, so the screen still honours the Field axis.
- Owners are never masked (`serialize.ts:41`), so they are unaffected.

### 4.4 Downloaded recorded by the server (Journey 1 step 4; Phase 1) → D5

- Under D5-A, after the audit row in each branch of `exportDocument`: `if (permittedNode(context.org, EXPENSE.invoiceUpdate) && !row.isDownloaded) await invoiceWriter.mutate(invoiceWriterCtx(context), "markDownloaded", input.invoiceId, () => ({ isDownloaded: true }))`.
- `isDownloaded` is not on the model today. The loader already holds the row, so pass it out as `header.isDownloaded`, additive, or re-read it. Pick one in the task, and do not add a second query if the header carries it.
- The writer checks the node itself (`invoices.ts:81-82`), so the `permittedNode` pre-check only avoids a FORBIDDEN that would fail the whole download.
- The web stops calling `onDownloaded` from the dialog (`invoices.tsx:326`) and invalidates the list query after a save instead. `markDownloaded` stays as a procedure: it is still listed in the permission registry, and removing it is not needed.
- The mark and the export audit row are two statements, not one transaction. A failure between them leaves an audited export without the mark, the same as today's failure mode, and probe 25-P7 counts it.

### 4.5 The preview draws the file (Journey 1 step 2; Phase 1) → D9, D8, D10

- `InvoiceDocumentPreview` (`invoices.tsx:450-522`) renders the eight columns in `INVOICE_DOCUMENT_COLUMNS` order, each from the model's line fields. Money goes through `formatMoney`; Qty and Tax rate are shown verbatim, as the sheet does (`invoice-document.ts:559-567`).
- The footer shows two rows, **Total of lines** (`totals.linesTotal`) and **Invoiced on this document** / **(partial)** (`totals.coveredTotal`), with the sheet's exact labels (`:572-583`).
- The header reads **INVOICE — CANCELLED** when `header.cancelled`, and shows the cancellation reason.
- The date is formatted as a date only. Use the existing date-only helper in `lib/expense.ts` if one exists at the base commit; otherwise add `formatDate` beside `formatDateTime`, and grep for an existing one first.
- A `document.warnings: string[]` list (built in the builder: D1-B company fallback, D2-A mixed terms, D8-A missing buyer address/tax ID/terms) renders as a notice above the document. The same strings do **not** go into the file.
- Stats tile (D10-A): `"Issued (this page)"` counting `state === "issued"`. Grep `apps/web` and `e2e` for `"Active (this page)"` first (shared copy rule).

### 4.6 The void locks what it reverses, and its confirm text tells the truth (Journey 3; Phase 2) → D6 (superseded, X31), D7

- Inside the issued branch's transaction, after the pinned invoice update (`invoices.ts:624-653`), which stays first, and the coverage/split reads (`:660-674`), take the X30 lock order:
  1. `SELECT … FROM cost_line WHERE bill_id IN (coverage ids) ORDER BY created_at, id FOR UPDATE`.
  2. `SELECT … FROM bill WHERE id IN (coverage ids) AND billScope ORDER BY id FOR UPDATE`.
  Lines then bills, each in one fixed order, so two voids over overlapping bills cannot deadlock, and the void takes the same order as step 24's issue (24 D3-A, lines then bills after 24 Phase 2), step 26's verify and void (26 D5-A: payment → lines `(created_at, id)` → bill), unbill and dissolve (X30). At HEAD `bills.invoice` takes bill then lines (bill update `bills.ts:1986`, then line updates `:2027`); step 24 Phase 2 reverses that, so 25 P2 follows the X30 order, not today's handler.
- Group the locked lines by bill. Replace the per-bill read at `:676` with that map. Every later computation (`:680-705`, `:719-722`) reads locked rows.
- **No settled-bill refusal** (D6 superseded under step 24 D4-A, X31). A bill whose lines are all fully written off still ends `written_off`, as today; after step 24 Phase 3, `bills.invoice` issues on it and it ends `done`.
- Map a deadlock (`40P01`) raised inside the transaction to CONFLICT, as 24 and 26 do (X30), so a miss is a retry, not a 500.
- Keep **the same raw write statements**: two `update(costLine)` (split arm, legacy arm), two `update(bill)` (amount, status), two `update(invoice)` (draft branch, issued branch). The architecture allow-list (`architecture.test.ts:418-421`, `:675-676`) is then unchanged. The `written_off` arm of the status update stays reachable and unchanged.
- Confirm text (`invoices.tsx:721`): _"Invoice X will be cancelled. The amount it invoiced goes back to its bill, so the bill can be invoiced again."_ (X31). It is true only once step 24 Phase 3 is deployed, so 25 P2 deploys after 24 P3. Grep for the old sentence ("Its bill reverts to Open and its cost lines become uninvoiced") across `apps/web` and `e2e`.

### 4.7 Data model

**No schema change and no migration under the recommended options.** New fields are on the **response model** only (`InvoiceDocument.buyerHidden`, `.warnings`, `terms.source`, optional input fields). Rejected D1-C would need `00NN_bill_due_date_invoice_anchor` (numbered at merge).

### 4.8 API contracts

| Procedure | Input | Output change | Error change |
|---|---|---|---|
| `invoices.document` | unchanged | + `buyerHidden: boolean`, + `warnings: string[]`, + `terms.source`, + `header.isDownloaded?` (D5-A) | none |
| `invoices.exportDocument` | unchanged | unchanged `{ filename, mime, base64 }` | + FORBIDDEN when `buyerHidden` (D3-A) |
| `invoices.markDownloaded` / `markPrinted` | unchanged | unchanged | none |
| `invoices.cancel` | unchanged | unchanged | + CONFLICT on a deadlock (`40P01`, X30); no settled-bill refusal (D6 superseded, X31) |

The web type `InvoiceDocumentModel` is inferred from the router (`invoices.tsx:147`), so the new fields reach the dialog with no hand-written type.

### 4.9 Key decisions (Decided 2026-09-21; §9 has the three approaches of each)

| Id | Question | Chosen (the recommended option unless noted) |
|---|---|---|
| D1 | Where does the printed payment term come from? | B: the bill's snapshot, with the company's current term as a labelled fallback |
| D2 | Covered bills with different terms | A: print the shortest, and warn |
| D3 | A caller denied the buyer | A: refuse the file; preview masked with a notice |
| D4 | Which calendar dates the invoice | A: the owning branch's timezone |
| D5 | Who records Downloaded | A: the server, inside `exportDocument`, for holders of `invoiceUpdate` |
| D6 | Voiding the invoice of a fully settled bill | Superseded under step 24 D4-A (X31): no refusal; 24 Phase 3 makes the bill invoiceable (recommended was A: refuse) |
| D7 | Void concurrency | A in the X30 order: lock lines `(created_at, id)`, then bills by id, and compute from locked rows |
| D8 | The thin buyer block (identity break) | A: warn in the preview; no fallback lookup |
| D9 | How the preview matches the file | A: typed preview with the same columns, totals and marking |
| D10 | The always-zero tile | A: "Issued (this page)" |

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- Step 11 Phase 3 merged, or not yet started. Its Task 3.2 adds one case to `invoice-document.test.ts`; the second to merge rebases (§7.6).
- Decisions: all settled (Wilfred, 2026-09-21; §9).
- Re-locate every anchor in `routers/expense/invoices.ts`, `modules/export/invoice-document.ts`, `routes/_next/expenses/invoices.tsx` and `architecture.test.ts` **by symbol** at the base commit. Plans 20–24 and 26 are being written in parallel and may land first (§7.6).
- Re-check before Phase 1: probes 25-P1…P7; before Phase 2: 25-P8, P9. If a probe contradicts its decision, stop that task and re-plan.

### Phase 1 — The file tells the customer the truth, and the preview shows it (Findings 1, 2, 5, 6, 7, 8, 9)

**Delivers:** Journeys 1 and 2 end to end.
**Dependencies:** none inside this plan. D1–D5, D8–D10 settled (2026-09-21).

- **1.1** Builder: optional `paymentTermsDays`/`dueDate` on `InvoiceDocumentBill`; `timezone?` and `buyerHidden?` on the input; `resolveTerms` per §4.1 (D1, D2); zoned `isoDate` via `calendarParts` (§4.2, D4); `buyerHidden`, `warnings[]`, `terms.source` on the model (D3, D8, D1-B); refresh the comments at `:224-238` and `:246-252`. Keep the builder pure: no IO and no clock. Files: `packages/api/src/modules/export/invoice-document.ts`. · **Agent A (backend)**
- **1.2** Builder tests in the existing suite:
  - bill snapshot 30 beats company 45 → text says 30, `source: "bill"`;
  - no snapshot, company 45 → 45, `source: "company"`, one warning;
  - neither → all null, no terms row (the existing `:324-330` case still holds);
  - two bills 30 and 60 → 30, and a warning naming both (D2-A);
  - `invoiceTime 2026-09-02T23:30:00Z` with `timezone: "Asia/Kuala_Lumpur"` → `invoiceDate "2026-09-03"`, and due date counted from 3 Sep;
  - the same instant with no timezone → `"2026-09-02"` (default UTC keeps old behaviour);
  - `buyerHidden: true` → flag on the model;
  - no buyer company → the D8 warning; with a company → none;
  - the sheet never contains a warning string;
  - existing cases unchanged.
  Files: `packages/api/src/modules/export/invoice-document.test.ts`. · **Agent A (backend)**
- **1.3** Loader and export:
  - pass bill terms and `team.timezone` (one scoped select by `invoice.owningBranchId`), and `buyerHidden` (§4.3);
  - `exportDocument` refuses a hidden buyer before `auditExport` (D3-A);
  - stamp Downloaded server-side for holders of `invoiceUpdate` (§4.4, D5-A), with `header.isDownloaded` on the model.
  Grep `routers/expense/invoices.ts` for every `loadInvoiceDocument(` call; there are two (`:455`, `:487`). Files: `packages/api/src/routers/expense/invoices.ts`. · **Agent A (backend)**
- **1.4** Router tests: `packages/api/src/routers/expense.invoice-document.test.ts` [NEW]. Fixture as `expense.ledger.test.ts` (PGlite, owner ctx, `seedLines` → `createBill` → `bills.invoice`). The Field-denial member is set up as `expense.rbac.test.ts` does (`fieldPermission` rows). Cases:
  1. `document` returns bill-snapshot terms after the company's `days_payable` is updated.
  2. `exportDocument` xlsx as owner → file, one `expense.invoice.exportDocument` audit row, and `invoice.is_downloaded = true`.
  3. As a member holding only `expense.invoice.read` (director-shaped) → file, audit row, `is_downloaded` still false, no error.
  4. As a member denied `bill.settlementUnit` → `exportDocument` FORBIDDEN with the sentence, no audit row, `is_downloaded` unchanged; `document` succeeds with `buyerHidden: true`.
  5. A cancelled invoice still exports, with `_CANCELLED` in the file name (regression).
  6. Foreign-scope invoice id → NOT_FOUND before FORBIDDEN (house rule).
  Files: `packages/api/src/routers/expense.invoice-document.test.ts` [NEW]. · **Agent A (backend)**
- **1.5** Web:
  - the preview per §4.5 (D9-A): eight columns, two totals, the CANCELLED header and reason, date-only;
  - the warnings notice (D8-A, D1-B, D2-A);
  - download buttons disabled with the hidden-buyer notice when `buyerHidden` (D3-A);
  - remove the `onDownloaded` call on save and invalidate `invoices.list` instead (D5-A);
  - the tile per D10-A.
  Grep `apps/web` and `e2e` for "Active (this page)", "The document as the counterparty receives it" and `onDownloaded` before editing. Files: `apps/web/src/routes/_next/expenses/invoices.tsx`, `apps/web/src/lib/expense.ts` (only if a date-only helper is missing). · **Agent B (frontend)**

**Acceptance.**
- §10 Journey 1 and Journey 2 and Edge cases 1–3 pass in the browser at `:3101`.
- `invoice-document.test.ts` and `expense.invoice-document.test.ts` pass, judged by reading the output for `failed`. The five existing void suites listed in Phase 0 still pass. `bun run check-types` shows `apps/web` ran and printed no "failed".

### Phase 2 — A void tells the truth and never races (Findings 3, 4)

**Delivers:** Journey 3 end to end.
**Dependencies:** Phase 1 merged (it hands off `routers/expense/invoices.ts` and `invoices.tsx`). **Step 24 Phase 3 merged** (X31), and 25 P2 **deploys only after 24 P3 is deployed**: before that the new confirm text is false for a paid bill. Step 24 Phase 2 merged too, so `bills.invoice` already takes the X30 order the interleave mirrors. D6, D7 settled (2026-09-21). Re-check before Task 2.1: probes 25-P8 (what 24 P3 makes invoiceable on deploy, X31) and 25-P9 (race residue); if one contradicts the choice, stop and re-plan.

- **2.1** `cancel` issued branch per §4.6:
  - after the pinned `UPDATE invoice` (still first), lock the cost lines `ORDER BY created_at, id`, then the covered bills `ORDER BY id` (X30);
  - compute from locked rows;
  - map `40P01` to CONFLICT (X30);
  - no settled-bill check (D6 superseded, X31);
  - the same six raw write statements.
  Update the `architecture.test.ts` comment only if it describes the branch (keys unchanged). Delete the stale `invoice_bill_issued_uq` sentence in the handler comment (`invoices.ts:572-575`; the index no longer exists, `schema/expense.ts:411`). Files: `packages/api/src/routers/expense/invoices.ts`, `packages/api/src/architecture.test.ts` (comment only, if needed). · **Agent C (backend)**
- **2.2** PGlite tests in `expense.ledger.test.ts`, beside `:611`:
  - (a) a `done` bill (issue, then `writeOffs.verify` the full amount) → `cancel` succeeds, bill `written_off`, `bills.invoice` re-issues, bill `done` (X31; needs step 24 Phase 3 at the base commit);
  - (b) a partly written bill → `cancel` succeeds, bill `open`, re-invoice succeeds;
  - (c) after `writeOffs.reverse` on a `done` bill → `cancel` succeeds and `bills.invoice` re-issues (the old correction path still works).
  Re-run `expense.corrections.test.ts` (`:347`, `:375`, `:394`) and `expense.wave1.test.ts:159`.
  **No PGlite lock test.** PGlite serialises every transaction on one connection, so such a test would pass on the old code too (step 15 §5 Task 1.4 records the same trap). Files: `packages/api/src/routers/expense.ledger.test.ts`. · **Agent C (backend)**
- **2.3** Real-Postgres interleave in `packages/api/src/routers/expense.concurrency.test.ts`, as this plan's own named `it` under the existing `describe.skipIf(!TEST_URL)` (`:52`); it edits no other plan's case (X35):
  1. Seed a bill of two lines (600 + 400) and partially invoice 500 (invoice A).
  2. Connection X opens a transaction and runs the `bills.invoice` line and bill updates for the remaining 500, without committing. The router cannot be paused mid-transaction, so X runs raw statements that mirror the handler's at the base commit (after step 24 Phase 2: lines `(created_at, id)`, then the pinned bill update, X30; at HEAD `bills.ts:1986-2036` takes the bill first). Start the cancel only after X holds the line row locks; prove that by polling `pg_locks` from a third connection. Write the method down in the test's docblock.
  3. Run `cancel` of invoice A on connection Y.
  4. Commit X, await Y.
  5. Assert `bill.invoiced_amount = Σ cost_line.invoiced_amount` and every line's `status = deriveStatus(line)`.
  Before merging, run it once against the handler without the locks and record that it fails there. Run with `DATABASE_URL_TEST` on the dev Neon branch, never production. The PR pastes the failing pre-change run and the passing run ("skipped" is not a pass), and, because 25 P2 changes locks, a run of **every** case already in the file (X35). Files: `packages/api/src/routers/expense.concurrency.test.ts`. · **Agent C (backend)**
- **2.4** Web confirm text per §4.6: _"Invoice X will be cancelled. The amount it invoiced goes back to its bill, so the bill can be invoiced again."_ (X31). Grep for the old sentence ("Its bill reverts to Open and its cost lines become uninvoiced") first. Files: `apps/web/src/routes/_next/expenses/invoices.tsx`. · **Agent B (frontend)**

**Acceptance.**
- §10 Journey 3 and Edge case 4 pass in the browser.
- 2.2's cases pass, and the existing void suites pass.
- 2.3 passes on the dev branch with `DATABASE_URL_TEST` set. The output names the test, so it was not skipped, and it was seen failing without the locks. Every other case in `expense.concurrency.test.ts` passes in the same run (X35).
- Both architecture tests pass unchanged.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| A (backend) | backend-engineer | sonnet | medium | 1.1–1.4 | `modules/export/invoice-document.ts`, `…/invoice-document.test.ts`, `routers/expense/invoices.ts`, `routers/expense.invoice-document.test.ts` [NEW] | `lib/document-number.ts`, `procedures/org.ts`, `serialize.ts`, `modules/expense/permissions.ts`, `schema/expense.ts`, `schema/organization.ts`, `routers/expense.ledger.test.ts`, `routers/expense.rbac.test.ts` |
| B (frontend) | frontend-engineer | sonnet | medium | 1.5 | `routes/_next/expenses/invoices.tsx`, `lib/expense.ts` (date helper only) | the router output type |

**Contract A → B:** the model fields `buyerHidden`, `warnings`, `terms.source`, `header.isDownloaded`, as in §4.8. B starts after 1.3's type compiles. A pushes the model shape first, as a type-only commit in the same branch.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| C (backend) | backend-engineer | opus | high | 2.1–2.3 | `routers/expense/invoices.ts` (`cancel` only), `routers/expense.ledger.test.ts` (new cases only), `routers/expense.concurrency.test.ts` (new `it` only), `architecture.test.ts` (comment only) | `routers/expense/bills.ts` (`invoice`), `routers/expense/write-offs.ts`, `modules/expense/money.ts` |
| B (frontend) | frontend-engineer | haiku | low | 2.4 | `routes/_next/expenses/invoices.tsx` (confirm text only) | — |

One worktree per phase, sequential. After each phase, check the modified files for import removals versus additions, and for any library swap.

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`)

- **`buildInvoiceDocument`**: `routers/expense/invoices.ts:364` (the only production caller) and `modules/export/invoice-document.test.ts` (21 calls). New input fields are optional; new output fields are additive.
- **`invoiceDocumentSheet` / `invoiceDocumentFilename`**: `invoices.ts:514-515`, `modules/pdf/invoice.ts:64, 90, 115`. The sheet gains no row except through `terms.text`, whose wording changes (§4.1). The PDF charset guard reads the same sheet, so the new text must stay Latin (it does: English only).
- **`loadInvoiceDocument`**: `invoices.ts:455` (`document`) and `:487` (`exportDocument`).
- **`invoices.document`**: web `invoices.tsx:300-305` only. **`invoices.exportDocument`**: web `invoices.tsx:314` only. No e2e spec or seed script calls either (grep of `e2e/`, `seed/`).
- **`invoices.markDownloaded`**: web `invoices.tsx:828` (fired from `:326` and the column action `:697`). After D5-A, the dialog no longer calls it. The procedure and its node stay (`modules/expense/permissions.ts:149-152`).
- **`invoices.cancel`**: web `invoices.tsx:844-850`. Tests `expense.ledger.test.ts:611`, `expense.corrections.test.ts:347, 375, 394`, `expense.wave1.test.ts:159`. Allow-list `architecture.test.ts:418-421, 675-676`.
- **`bills.invoice`**: not edited by step 25. Its `status !== "open"` refusal (`bills.ts:1801`) is relaxed by step 24 Phase 3 to admit a `written_off` bill with an uninvoiced balance (24 D4-A, X31), which the new confirm text relies on.
- **`writeOffs.verify` / `reverse`**: not edited. No step-25 sentence points at them any more (D6 superseded, X31).
- **Copy duplicates to grep** (shared copy rule): "Active (this page)", "The document as the counterparty receives it", "Its bill reverts to Open and its cost lines become uninvoiced", "After invoicing + ". The SOP page (`C:/Project/ZYT-Task/customer-intake-sop/sop.json` step 25 and guide 25) quotes some of these; it is not edited by this plan (§7.8).

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| Preview | 3 columns, 1 total, time on a date, no CANCELLED | 8 columns, 2 totals, date only, CANCELLED, warnings | Web first: new fields read `undefined`, so no warnings and the old term text; harmless. API first: old preview ignores new fields. |
| Download as accountant | file, then a second `markDownloaded` call | file, and the mark in the same request | API first: both the server and the old web mark; idempotent (flag already true, the web skips when `isDownloaded`). Web first: nobody marks until the API lands. **Deploy API before web.** |
| Download as director or viewer | file, then an error toast | file, no toast, no mark | API first: the error toast persists until web lands. |
| Download by a buyer-masked member | file without buyer or terms | FORBIDDEN, preview notice | API-first: FORBIDDEN toast via the dialog's refusal box (it shows `error.message`, `invoices.tsx:327-334`). |
| Void, unpaid or partly paid | reverses | reverses (now locked) | – |
| Void, fully settled | reverses; bill stranded `written_off` | reverses (now locked); bill `written_off`, invoiceable again through step 24 Phase 3 (X31) | 25 P2 deploys after 24 P3; before 24 P3 the new confirm text would be false. |

### 7.3 Behaviour change for existing orgs and live invoices

- **Every re-download of an old invoice changes** when the company's term moved after the bill was raised (P1), when invoice time was 00:00–07:59 local (P4), or when bills disagree (P3). The customer may already hold the old file. The new file is the correct one, but two different files of one invoice number can exist. → Release note for accounting, with P1/P4 counts.
- Members with a Field denial on the buyer (P6) lose the ability to produce files.
- Directors' and viewers' downloads stop marking (they never succeeded; P7).
- Stranded bills already in production (P8) become invoiceable when step 24 Phase 3 deploys (X31); this plan rewrites none of them. 25-P8 sizes that set and adds to 24-P6, and accounting sees both lists before 24 P3 ships.
- No data is rewritten by any phase.

### 7.4 Nullable assumptions

- `bill.payment_terms_days`, `due_date`: NULL on every bill without a company or with a company lacking a term (0062 `:156-159`), and on every bill before 0062 (no backfill, `0062:88-91`). D1-B falls back for these.
- `invoice.invoice_time`: nullable; `invoiceDate` coalesces to `created_at` (`invoice-document.ts:264-266`). The zone applies to whichever is used.
- `invoice.owning_branch_id`: NOT NULL (governed row). `team.timezone` NOT NULL.
- `company.days_payable`: nullable (the fallback may yield nothing).
- `invoice_line` split: absent on legacy invoices. The locked-lines map serves both arms.

### 7.5 Deployment coupling

- Phase 1: **API before web** (D5-A, §7.2). Build `apps/web` before deploying, so a partial deploy does not split the server and the web onto different code (memory `alchemy-partial-deploy-splits-the-stage`); no step in either order is harmful beyond §7.2.
- Phase 2: API-only except the confirm text. It deploys only after step 24 Phase 3 is deployed (X31).
- No migration, so no database ordering.

### 7.6 Merge order against steps 04–27

| Plan / task | Shared code | Order and why |
|---|---|---|
| **11 Phase 3, Task 3.2** | `modules/export/invoice-document.test.ts` (one new case) | 11 P3 before or after 25 P1. The second to merge rebases: additive cases in different `describe`s. No shared function. |
| 11 Phase 2 | `cost_line.order_no` values printed by the document | No code overlap; the document prints what arrives. |
| **15 Phase 3** | `routers/lading.ts` `create`/`update` gate calls; `costLines.create` `expense_entry` call | **Not touched by step 25.** Step 25 edits no lading or cost-line handler, so 15's gate calls are kept by construction. |
| 04–10, 12–14 | none (grep of `plans/*.md` for `invoice-document`, `expense/invoices`, `invoices.tsx`, `invoices.cancel`: only step 11 matches) | Either order. |
| 20 (no plan at time of writing; written in parallel) | Likely `modules/expense/bridge.ts`, `collective-order.ts` `saveChildren`, `cost-lines.ts` create/update (company on the cost line) | Expected no shared file. If 20 edits `loadInvoiceDocument`'s buyer resolution, **20 merges first** and 25 Task 1.3 rebases. Once 20 lands, D8's warning fires only on legacy bills. |
| 22 (written in parallel) | `bill` creation, `0062` due-date trigger, base currency | If 22 re-anchors or back-fills `bill.payment_terms_days`/`due_date`, **22 merges first**. D1-B reads whatever 22 leaves, and 25-P1/P2 must be re-run after 22. |
| 23 (written in parallel) | `bills.ts` retotal / unbill (`bill-rewrite`) | Expected no shared file. Unbill on an invoiced bill is already refused (`cost-lines.ts:1436`). |
| **24** (written in parallel) | `bills.ts` `invoice` (`:1699`), including the buyer default `:1955` and `invoiceTime` `:1943`; possibly `invoices.tsx` if it adds an issue control there | If 24 stamps the buyer's address or tax ID onto the invoice, or edits `invoices.tsx`, **24 merges first** and 25 re-locates by symbol. D6-B (issue on a `written_off` bill) is exactly what 24 Phase 3 delivers under 24 D4-A (X31): **25 P2 merges and deploys after 24 P3**, and after 24 P2, whose lines-then-bills order 25 P2 matches (X30). |
| **26** (written in parallel) | `write-offs.ts` `verify`/`reverse`; `expense.concurrency.test.ts` | **Lock order must match (X30):** 26 D5-A takes payment → lines `(created_at, id)` → bill, and 25 takes lines `(created_at, id)` → bills by id after its pinned invoice update, so the two cannot deadlock; both map `40P01` to CONFLICT. Each adds its own `it` (26: its own `describe`) to `expense.concurrency.test.ts` and never edits the other's; the second rebases and re-runs every case (X35). Order: either. |
| 27 (written in parallel) | ageing / Overdue reads `bill.due_date` | No shared code. D1 keeps the document's due date invoice-anchored; 27 decides the ledger's anchor. |

**Required order:** 25 P1 → 25 P2, one phase per worktree. It sits after whichever of 11 P3, 20, 22 and 24 has merged by then; 25 P2 is after 24 P3 in merge and in deploy (X31). 26 takes the same X30 lock order as P2.

### 7.7 Read-only production probes (SELECT only; Wilfred runs them with the owner's override; none blocks writing code)

`invoice_time` and `created_at` are `timestamp` without time zone holding UTC wall-clock (drizzle writes `Date` as UTC). The zone probes assume that; if P4's first row looks wrong, stop and re-check before D4.

```sql
-- 25-P1 Issued invoices whose printed term (today's company.days_payable) differs from the bill's snapshot (D1)
select i.organization_id,
       count(distinct i.id) as issued_invoices,
       count(distinct i.id) filter (where b.payment_terms_days is not null
                                      and c.days_payable is distinct from b.payment_terms_days) as printed_term_differs,
       count(distinct i.id) filter (where b.payment_terms_days is null and c.days_payable is not null) as bill_has_no_snapshot
from invoice i
join invoice_bill ib on ib.invoice_id = i.id
join bill b on b.id = ib.bill_id
left join company c on c.id = b.settlement_company_id
where i.state = 'issued'
group by 1 order by 1;

-- 25-P2 How far the document's due date (invoice date + snapshot days) sits from the ledger's bill.due_date (D1 option C sizing)
select i.organization_id,
       count(*) as pairs,
       count(*) filter (where (coalesce(i.invoice_time, i.created_at)::date + b.payment_terms_days) <> b.due_date) as dates_differ,
       max((coalesce(i.invoice_time, i.created_at)::date + b.payment_terms_days) - b.due_date) as max_days_apart
from invoice i
join invoice_bill ib on ib.invoice_id = i.id
join bill b on b.id = ib.bill_id
where i.state = 'issued' and b.payment_terms_days is not null and b.due_date is not null
group by 1 order by 1;

-- 25-P3 Multi-bill invoices whose bills carry different terms (D2)
select i.organization_id, i.id, i.invoice_number, count(distinct b.id) as bills,
       string_agg(distinct coalesce(b.payment_terms_days::text, 'none'), ',') as terms
from invoice i
join invoice_bill ib on ib.invoice_id = i.id
join bill b on b.id = ib.bill_id
where i.state = 'issued'
group by 1, 2, 3
having count(distinct coalesce(b.payment_terms_days, -1)) > 1
order by 1, 3;

-- 25-P4 Invoices whose printed UTC date is not the branch's calendar date (D4)
select t.timezone,
       count(*) as invoices,
       count(*) filter (where ((coalesce(i.invoice_time, i.created_at) at time zone 'UTC') at time zone t.timezone)::date
                              <> coalesce(i.invoice_time, i.created_at)::date) as printed_date_wrong_day
from invoice i
join team t on t.id = i.owning_branch_id
where i.state <> 'draft'
group by 1 order by 1;

-- 25-P5 Issued invoices that print the buyer's name only, because no covered bill has a company (D8; identity)
select i.organization_id,
       count(*) as issued,
       count(*) filter (where not exists (
         select 1 from invoice_bill ib join bill b on b.id = ib.bill_id
         where ib.invoice_id = i.id and b.settlement_company_id is not null)) as name_only
from invoice i
where i.state = 'issued'
group by 1 order by 1;

-- 25-P6 Roles denied a buyer field, and how many members hold them (D3)
select r.organization_id, r.name as role, fp.resource, fp.field,
       (select count(*) from member m where m.organization_id = r.organization_id and m.role = r.name) as members
from field_permission fp
join role r on r.id = fp.role_id
where (fp.resource = 'invoice' and fp.field in ('buyer', 'seller'))
   or (fp.resource = 'bill' and fp.field in ('settlementUnit', 'invoiceTitle'))
order by 1, 2, 3, 4;

-- 25-P7 Invoices exported at least once but never marked Downloaded, by who exported (D5)
select i.organization_id, m.role, count(distinct i.id) as exported_not_marked
from invoice i
join audit_log a on a.target_id = i.id and a.action = 'expense.invoice.exportDocument'
left join member m on m.organization_id = a.organization_id and m.user_id = a.actor_user_id
where i.is_downloaded = false
group by 1, 2 order by 1, 2;

-- 25-P8 Bills stranded by a void: cancelled invoice, bill written_off, no live invoice left (D6; X31: sizes what 24 P3 makes invoiceable on deploy, adds to 24-P6)
select i.organization_id, b.bill_no, b.status, b.total_amount, b.invoiced_amount,
       i.invoice_number, i.cancel_reason,
       (select max(a.created_at) from audit_log a
         where a.target_id = i.id and a.action = 'expense.invoice.cancel') as cancelled_at
from invoice i
join invoice_bill ib on ib.invoice_id = i.id
join bill b on b.id = ib.bill_id
where i.state = 'cancelled' and i.vi_state = 'the_cancellation' and b.status = 'written_off'
  and not exists (select 1 from invoice_bill ib2 join invoice i2 on i2.id = ib2.invoice_id
                  where ib2.bill_id = b.id and i2.state = 'issued')
order by 1, cancelled_at desc;

-- 25-P9 Bills whose invoiced total disagrees with their lines or with their live coverage (D7 residue)
select b.organization_id, b.bill_no, b.status, b.invoiced_amount,
       sum(cl.invoiced_amount) as lines_invoiced,
       (select coalesce(sum(ib.amount), 0) from invoice_bill ib join invoice i on i.id = ib.invoice_id
         where ib.bill_id = b.id and i.state = 'issued') as live_coverage
from bill b
join cost_line cl on cl.bill_id = b.id
group by b.id
having b.invoiced_amount <> sum(cl.invoiced_amount)
    or b.invoiced_amount <> (select coalesce(sum(ib.amount), 0) from invoice_bill ib join invoice i on i.id = ib.invoice_id
                              where ib.bill_id = b.id and i.state = 'issued')
order by 1, 2;
```

### 7.8 Blocking prerequisites

- D1–D10 settled by Wilfred on 2026-09-21 (§9). Phase 2 also needs step 24 Phase 3 merged, and deploys after it (X31).
- Probes: 25-P1, P3, P4, P6, P7 before Phase 1 (D1, D2, D4, D3, D5); 25-P2 only if D1-C is reconsidered; 25-P5 feeds the release note; 25-P8, P9 before Phase 2 (D6, D7). 25-P8's list goes to accounting with 24-P6's before 24 P3 ships (X31).
- `DATABASE_URL_TEST` for a dev Neon branch, for Task 2.3. CI has no `DATABASE_URL_TEST`, so the PR pastes the real-Postgres output.
- If plans 20, 22, 24 or 26 merge first, re-locate anchors and re-run P1/P2 (§7.6).
- **Follow-up outside this plan (flagged, not edited):** after the deploy, the SOP page's step 25 text (`sop.json` steps[25] "what", guide[25] golden steps 3 and 8, pitfalls, writes) needs a zyt-update. That is an accepted unowned gap (X39): a `/zyt-update` pass after the deploy remains available to Wilfred, not assigned. The intake SOP is published from `C:/Project/ZYT-Task`; read `hosting/SITE.md` first.

## 8. Cross-Cutting Concerns

- **Errors.**
  - Refusals are operator sentences that say what to do: FORBIDDEN for the hidden buyer (a permission fact). The void adds no state refusal (D6 superseded, X31); a deadlock (`40P01`) answers CONFLICT, a retry (X30).
  - Every refusal sits after the scoped load, so a foreign id answers NOT_FOUND first.
  - The dialog already shows `error.message` verbatim (`invoices.tsx:327-334`); the cancel mutation relies on the global toast (`utils/orpc.ts:63-90`).
- **Money rule.** The builder still computes no money. Terms and dates are display arithmetic over stored values; `billTotal` stays the only sum (`invoice-document.ts:406-407`).
- **Testing.**
  - PGlite: builder, router boundary (`expense.invoice-document.test.ts` [NEW], `expense.ledger.test.ts`).
  - Real Postgres, for the lock only (`expense.concurrency.test.ts`).
  - Both architecture tests.
  - The browser walks in §10.
- **Security.** D3-A narrows who can produce a customer document. No field that was masked becomes visible. The server-side mark uses `permittedNode` plus the governed writer's own node check.
- **Migration.** None.
- **Rollback.** Each phase reverts cleanly: no data is rewritten and no schema changes. A Phase 1 revert brings back today's terms and date. A Phase 2 revert brings back the unlocked read and the old confirm text.
- **Observability.** The export audit row already names who took which file. D3-A refusals are not audited (consistent with other FORBIDDENs).
- **Accessibility.** The warnings notice uses the same destructive/notice block as the refusal box (`invoices.tsx:380-396`). Disabled download buttons carry a `title` stating the reason.

## 9. Decision Register, Open Questions & Risks

**Statuses (/planpro).** No Input Gate was held. On 2026-09-21 Wilfred accepted the recommended option of every decision below, and every Proposed reading in `steps-20-26-crosscheck.md` X28–X40; where an X-item overrides this plan's own recommendation (D6 under X31, D7's lock order under X30), the Chosen line says so. Each keeps its three approaches and marks one Recommended. The **Re-check** line names the probe that could still overturn the choice: if it contradicts it, stop that task and re-plan.

### Decided — was blocking Phase 1

**D1: Where does the printed payment term come from?** · Status: **Decided 2026-09-21 — Chosen: B**

| | Approach | Consequence |
|---|---|---|
| **A** | Today's `company.days_payable` (status quo) | The customer is told whatever the directory says today. It disagrees with the term the bill was raised under, which 0062 froze precisely so it would not move under a chase. |
| **B** | The covered bills' `payment_terms_days` snapshot, anchored on the invoice date. Fall back to today's company term only when no bill carries a snapshot, labelled in the preview (Recommended) (Chosen) | The printed term is the ledger's term. Bills raised before 0062, or before the company had a term, still print one, with a visible source. The printed due date (invoice + N) and the ledger's `due_date` (bill created + N) still differ by the gap between raising and invoicing, which is the approximation 0062 documents. No migration. |
| **C** | Print `bill.due_date` verbatim, and re-anchor it on invoicing | One due date everywhere. But the trigger forbids moving a set due date (`0062:130-144`), so this needs `00NN_bill_due_date_invoice_anchor` and a decision on 0062's rule. Printing today's `due_date` without re-anchoring would show a customer "30 days" alongside a date 23 days after the invoice. |

- **Recommendation: B.** It fixes the defect that is certainly wrong (a moved term), with no migration. The anchor question belongs to whoever models the six anchors (0062 header), likely step 22 or 27.
- **Chosen: B** (Wilfred, 2026-09-21).
- **Re-check:** 25-P1 (how many invoices print a moved term); 25-P2 only if C is reconsidered.
- **Releases:** Tasks 1.1–1.4.

**D2: Covered bills carry different terms. What does one invoice state?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Print the shortest term and its due date; the preview warns, naming each bill's term (Recommended) (Chosen) | The customer is asked to pay no later than the earliest agreed date. Accounting sees the conflict before sending and can split the invoice. |
| **B** | Print no term; the preview warns | Nothing wrong is stated, but the document states nothing, which is today's failure for name-only buyers. |
| **C** | Refuse to issue multi-bill invoices across terms (step 24's handler) | Prevents the case. It changes step 24's batch rule and blocks the batch that 录入发票号 exists for. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).
- **Re-check:** 25-P3 (if zero rows, A and B are equivalent in practice).

**D3: A caller is denied the buyer (Field axis). What can they produce?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Preview masked, with a notice; `exportDocument` FORBIDDEN before any audit row; buttons disabled (Recommended) (Chosen) | No incomplete customer document can leave through a masked member. The screen keeps honouring the mask. Tenants who mask the buyer from their billing clerks must route file production to someone else. |
| **B** | Build the file unmasked for export (the file is for the customer, not the screen) | The member gets a complete file, and thereby reads the buyer they were denied, in a file they can open. The Field axis is defeated by a download. |
| **C** | Status quo: a masked file with no buyer row | Silent, incomplete customer documents, varying by who downloaded. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).
- **Re-check:** 25-P6 (which roles are affected; if a tenant masks its whole accounting team, A blocks their billing and the choice needs their input).

**D4: Which calendar dates the invoice?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | The owning branch's `team.timezone`, via `calendarParts` (Recommended) (Chosen) | The printed date matches the day the operator issued it and the month in its `INV` number. One more small select in the loader. Re-downloads of early-morning invoices change date (P4). |
| **B** | UTC, but printed as "(UTC)" | Honest but wrong for the customer; a Malaysian customer reads the wrong day. |
| **C** | The org-level number sequence's timezone | The same answer as A for single-zone orgs, but it reads a number-sequence setting to date a document, which is a hidden coupling. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).
- **Re-check:** 25-P4.

**D5: Who records Downloaded?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | The server, inside `exportDocument`, only for holders of `invoiceUpdate`, and only when not yet set; the web stops calling `markDownloaded` on save (Recommended) (Chosen) | One request, no error toast for directors or viewers. Downloaded then means "someone who handles invoices produced the file", which is what the column is read as. A director's review download does not mark. |
| **B** | The web checks the permission before calling `markDownloaded` | Removes the toast. The mark still depends on the tab surviving the second request, and it needs a client-side permission read the page does not do today. |
| **C** | Status quo | The error toast after a successful save, and marks lost when the tab closes (P7). |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).
- **Re-check:** 25-P7.

**D8: The thin buyer block (identity break). What does step 25 do?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Warn in the preview when the buyer has no address, no tax ID or no terms; no fallback lookup (Recommended) (Chosen) | Accounting knows before sending. Nothing is guessed. The warning disappears for new jobs once step 20 lands. |
| **B** | Fall back to the order's `client_company_id` (`schema/collective-order.ts:152`) through the covered cost lines' `order_id` | Fills the block on legacy bills, but a bill can span several orders and clients, and the settlement party is not always the client (`bridge.ts:101-140` keeps them apart). It could print the wrong company's tax ID. |
| **C** | Nothing; wait for step 20 | Legacy invoices keep going out thin with no warning. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).
- **Re-check:** 25-P5 (size of the thin population).

**D9: How does the preview match the file?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | The typed preview renders the same eight columns, both totals with the sheet's labels, the CANCELLED marking and a date-only date (Recommended) (Chosen) | Small change and readable UI. Parity is by review plus a Task 1.2 check that the sheet's labels come from exported constants the preview imports if they can be shared. Otherwise, by a comment naming the sheet. |
| **B** | `document` also returns the `SheetSpec`, and the dialog renders it generically | Parity by construction. But the dialog becomes a spreadsheet grid, and the sheet's row-shape vocabulary (`invoice-document.ts:517-520`) leaks into the web. |
| **C** | Embed the PDF | The builder's own header rejects it: a second path, and impossible for a PDF the server refuses (`invoices.tsx:443-449`). |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).

**D10: The always-zero "Active (this page)" tile.** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | "Issued (this page)" counting `state === "issued"` (Recommended) (Chosen) | A true number, in the ledger's own vocabulary (`labels.ts:50-54`). |
| **B** | Remove the tile | Fewer tiles, and nothing false. |
| **C** | Server-side counts over the filter (the page comment's "real answer", `invoices.tsx:853-864`) | Correct across pages, but three more queries and a response-shape change for a tile. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).

### Decided — was blocking Phase 2

**D6: Voiding the invoice of a fully settled bill.** · Status: **Decided 2026-09-21 — Chosen: superseded under step 24 D4-A (per X31)**

| | Approach | Consequence |
|---|---|---|
| **A** | Refuse with CONFLICT naming the bill, telling the operator to reverse the write-off first; fix the confirm text (Recommended) | No stranded bills. The correction path (reverse → cancel → re-issue → re-verify) is explicit and uses existing screens. A void of a paid invoice takes three more steps. |
| **B** | Let `bills.invoice` issue on a `written_off` bill (→ `done`) (Chosen — delivered by step 24 D4-A / Phase 3, X31) | One-step correction. But it changes step 24's money-minting handler, its optimistic pin (`bills.ts:1998-2002`, `eq(bill.status, "open")`) and the meaning of `written_off`, and it overlaps plan 24. |
| **C** | Copy-only: the confirm text tells the truth, and the behaviour stays | Honest, but it still produces stranded bills that need the same three steps, discovered afterwards. |

- **Recommendation: A.**
- **Re-check:** 25-P8 (if stranded bills are common, B may be worth step 24's cost; if zero, A is cheap insurance).
- **Chosen: superseded under step 24 D4-A** (Wilfred, 2026-09-21); crosscheck X31: 24 Phase 3 lets `bills.invoice` issue on a `written_off` bill with an uninvoiced balance (→ `done`), so D6-A's refusal is not built. Task 2.1 drops the check, Task 2.4's text reads _"The amount it invoiced goes back to its bill, so the bill can be invoiced again."_, Task 2.2 case (a) proves cancel → re-issue on a `done` bill, and 25 P2 merges and deploys after 24 P3. 25-P8 now sizes what 24 P3 makes invoiceable and adds to 24-P6.

**D7: Void concurrency.** · Status: **Decided 2026-09-21 — Chosen: A, in the X30 lock order (per X30)**

| | Approach | Consequence |
|---|---|---|
| **A** | After the pinned `UPDATE invoice` (still first), lock the covered bills' lines `ORDER BY created_at, id`, then the bills `ORDER BY id`, and compute everything from the locked rows (X30 order; written as bills then lines, by id, the order `bills.invoice` takes at HEAD but not after step 24 Phase 2) (Recommended) (Chosen) | Serialises with `bills.invoice` and with step 26's locked `writeOffs.verify` (26 D5-A, same order). Same write statements, so the allow-list is unchanged. `40P01` maps to CONFLICT. The proof needs real Postgres. |
| **B** | Make only the line amount update relative (`invoiced_amount - split`), with no locks | Fixes the lost increment on amounts. Line `status` and bill status are still derived from stale rows. |
| **C** | Defer to plan 26, which owns write-off locking | Leaves the void side of the race open. Plan 26 cannot lock the void's reads from its own handler. |

- **Recommendation: A.**
- **Re-check:** 25-P9 (residue in production; a non-zero count also needs a manual repair, outside this plan).
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X30: the lock order becomes lines `(created_at, id)` → bills by id after the pinned invoice update, the order 24 (issue), 26 (verify, void), unbill and dissolve take; `40P01` maps to CONFLICT. §4.6, Task 2.1, Task 2.3 and §7.6 (26 row) were edited for it.

### Risks

- **Old invoices re-download with a different term or date than the customer holds.** Likely where P1/P4 are non-zero; medium impact. → Release note to accounting with counts; the new file is the ledger's truth.
- **D3-A blocks a tenant whose whole billing team is buyer-masked.** Low likelihood; high impact for that tenant. → P6 before Phase 1; if hit, D3 needs the tenant's input.
- **Plans 20, 22, 24 and 26 are written in parallel and may reshape the loader, the bill terms or the write-off locks.** Certain overlap in intent, unknown in code. → Every task locates by symbol; §7.6 names the order; one lock order for 24, 25 and 26 (X30).
- **25 P2's confirm text is false if it deploys before step 24 Phase 3.** Certain if the order slips; medium impact (a paid invoice's void again strands the bill, now under a promise). → 25 P2 merges and deploys after 24 P3 (X31, §5 Phase 2 dependencies).
- **The lock test may be hard to make deterministic through the router.** Medium. → Task 2.3 allows mirrored raw transactions, documented in the test, and requires one run that fails without the locks.
- **A cancelled invoice re-rendered later reads today's bill rows and company.** Accepted and unowned. The real fix is freezing the buyer block at issue (needs a column), which fits step 24's plan. → Flagged to step 24.
- **`writeOffs.verify` stays unlocked.** Certain until plan 26. → 26 D5-A locks it in the X30 order (§7.6).
- **A stale `:3000` server makes browser checks pass on old code.** High. → Restart after every `packages/api` change and check the process start time (memory `bun-hot-ignores-workspace-deps`).

### SOP text vs code (Phase 0 wins)

| # | SOP claims (step 25 card, guide, watch) | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| 1 | "Preview the real document … fee lines with tax rate, two totals" | Files only. The preview shows 3 columns and 1 total (`invoices.tsx:478-480`, `:505-516`) | Code, then fix (D9) |
| 2 | Guide 25 step 3: preview "Rendered from the same model as the files" | Same model, but a different and partial layout, with no CANCELLED marking (`:461`) | Code (D9) |
| 3 | "payment terms derived from the company's days-payable" | True, and that is the defect: today's value, not the bill's 0062 snapshot (`invoice-document.ts:358`) | Code (D1) |
| 4 | "A void … makes the bill re-invoiceable" | Not for a fully settled bill: → `written_off` (`invoices.ts:719-725`), refused by `bills.invoice` (`bills.ts:1801`) | Code (D6 superseded; step 24 Phase 3 makes the claim true, X31) |
| 5 | Guide 25 step 8: "Bill reverts to Open" | Same as 4; also the confirm text (`invoices.tsx:721`) | Code (D6 superseded, X31; Task 2.4 text) |
| 6 | Writes: "invoice.isDownloaded set true on first successful save" | Set by a second client request needing `invoiceUpdate`; directors and viewers get an error (`invoices.tsx:326`, `roles.ts:208, 233`) | Code (D5) |
| 7 | Guide 25 step 1: stats tiles incl. "Active (this page)" | That tile is always 0 (`invoices.tsx:866`) | Code (D10) |
| 8 | Guide 25 step 5: "the message names the cell" | It names the text, not the cell (`invoices.ts:525-530`) | none (wording only) |
| 9 | Writes: "Nothing is stored for the document itself" | True for the file; an `expense.invoice.exportDocument` audit row is written per save (`:491-509`) | none (add to SOP text) |
| 10 | Watch: "The buyer block usually prints only a name" | True on the happy path (identity break), and for a buyer-masked downloader it prints **no** buyer at all (`invoices.ts:346`, `:368-371`) | Code (D3, D8) |
| 11 | Card: "seller (name, address, phone, contact — never a tax ID)" | True (`invoice-document.ts:286-294`) | – |
| 12 | Card: buyer "tax ID" | Prints `company.uniform_social_credit_code` labelled "Buyer tax ID" (`:340`, `:548`); a Malaysian customer's TIN lives in the same field only if staff typed it there | none (flag to the SOP text) |
| 13 | Role: "sidebar needs expense:read; list gates on expense.invoice.read" | True (`nav.ts:232`, `invoices.tsx:102`, `invoices.ts:382`) | – |
| 14 | Pitfall: cancelling a cancelled invoice is a no-op; the icon is disabled | True (`invoices.ts:599`, `invoices.tsx:715`) | – |
| 15 | Implicit: the printed invoice date is the day it was issued | UTC day (`invoice-document.ts:252`); early-morning invoices print yesterday | Code (D4) |

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000. One worktree's servers at a time.
**Preconditions:**
- A freshly seeded audit e2e org: `bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>`. Re-read `ACTORS` at the base commit: at HEAD it seeds owner, directorA, directorB, accountant, salesperson, managerA, managerB and viewer, and the file carries uncommitted edits in the main tree. Actors used:
  - **accountant** (accounting, holds the `expense` root: invoice read, update, cancel, write-off);
  - **directorA** (invoice read only, `roles.ts:208`);
  - **owner** (flow editor, field permissions);
  - one member given a Field denial on `bill.settlementUnit` through Roles & permissions (owner) — re-read the page path at the base commit.
- Company **Acme Trading** with **Days payable 30**, created before any bill.
- Invoice **I1**: a receivable cost line (Ocean Freight, 1000, currency MYR, `settlementCompanyId` = Acme, created through `costLines/create` in the console if the form has no company picker at the base commit) → **Create bill** → the bill approved through its seeded flow (the `input_invoice_no` gate) → **Issue invoice** for the full amount (step 24). Then, as owner, edit Acme's Days payable to **45**.
- Invoice **I2**: the same path with a second bill of two lines (600 + 400), invoiced **partially** for 500.
- Confirm the actor with `fetch('/api/auth/get-session')` before each actor's steps. Restart `:3000` after the last `packages/api` edit.

**Migrations:** none. Confirm the journal still ends where the merged steps left it, and that those migrations are applied. Check `_journal.json` and the database, not the command exit code.

**Test commands** (read the output for `failed` and for the `Test Files` line; `bun run check-types` can exit 0 while printing "failed"):
- Phase 1: `bunx vp test run packages/api/src/modules/export/invoice-document.test.ts packages/api/src/routers/expense.invoice-document.test.ts packages/api/src/routers/expense.ledger.test.ts packages/api/src/routers/expense.corrections.test.ts packages/api/src/routers/expense.rbac.test.ts packages/api/src/architecture.test.ts apps/web/src/architecture.test.ts`
- Phase 2: `bunx vp test run packages/api/src/routers/expense.ledger.test.ts packages/api/src/routers/expense.corrections.test.ts packages/api/src/routers/expense.wave1.test.ts packages/api/src/architecture.test.ts`, then `DATABASE_URL_TEST=<dev branch URL> bunx vp test run packages/api/src/routers/expense.concurrency.test.ts` (confirm the new test's name is in the output).
- Every phase: `bun run check-types` (confirm `apps/web` ran).

**Golden path — Journey 1 (Phase 1; accountant)**
1. Navigate to `/expenses/invoices` → the tiles read **Total Invoices**, **Issued (this page)** with a non-zero count, **Cancelled (this page)**, **Downloaded (this page)**.
2. On I1's row press **Preview & download invoice document** → the dialog title reads **发票预览 · Invoice <I1 no.>**. The preview shows the columns **Bill No., Order No., Master doc no., Fee name, Qty, Unit price, Tax rate, Amount**; **Payment terms** reads _"30 days after invoicing (due …)"_, with the due date 30 days after the shown invoice date (not 45). The date shows no time of day.
3. Press **下载 XLSX** → toast _"Saved Invoice_<no>.xlsx"_ and **no** error toast. Open the file: the Payment terms row matches step 2. In the Network panel only `exportDocument` was called, with no `markDownloaded` request. After the list refetches, I1's Downloaded column reads Yes.
4. Open I2's preview → **Total of lines** 1,000.00 and **Invoiced on this document (partial)** 500.00, the same labels as in the XLSX.

**Golden path — Journey 2 (Phase 1; the masked member)**
1. Open I1's preview → the buyer shows **—**, the notice _"The buyer's details are hidden from you, so you cannot download this document."_ is visible, and both download buttons have the `disabled` attribute.
2. In the console, call `invoices/exportDocument` for I1 over `/rpc` → HTTP 403 with the sentence. As owner, read the audit trail for I1 → no new `expense.invoice.exportDocument` row.

**Golden path — Journey 3 (Phase 2; accountant)**
1. On I2's row press **Cancel invoice** → the confirm text is the new sentence (§4.6) → **Cancel Invoice** → toast _"Invoice cancelled"_. On `/expenses/bills` the bill reads **Open** and can be invoiced again (issue it again, then leave it).
2. Record a receipt for I1's full amount and write it off against I1's bill (steps 26), so the bill reads **Done**. Back on `/expenses/invoices`, press **Cancel invoice** on I1 → the same confirm text → **Cancel Invoice** → toast _"Invoice cancelled"_. I1 reads **Cancelled**; the bill reads **Written off** (X31; needs step 24 Phase 3 on the server).
3. On `/expenses/bills`, issue an invoice on that bill (step 24) → it succeeds, and the bill reads **Done**. No write-off was reversed.

**Edge case 1: director download (Phase 1).** As directorA, open a not-yet-downloaded invoice's preview → **下载 XLSX** → _"Saved …"_ with no error toast. As accountant, the row's Downloaded column is unchanged.

**Edge case 2: cancelled preview (Phase 1).** Open the preview of the invoice cancelled in Journey 3 step 1 → the header reads **INVOICE — CANCELLED** with the reason; the downloaded file name ends `_CANCELLED.xlsx`.

**Edge case 3: thin buyer (Phase 1).** Create an invoice whose cost line has no company (the order-bridged happy path, or `costLines/create` without `settlementCompanyId`) → the preview shows the D8 warning, and the XLSX has no Buyer address, Buyer tax ID or Payment terms rows. The warning text is not in the file.

**Edge case 4: void race (Phase 2; dev branch only, not the browser).** Proven by Task 2.3's interleave. Pass is judged by final state (`bill.invoiced_amount = Σ cost_line.invoiced_amount`, line statuses equal to `deriveStatus`), never by timestamps.

**Regression checks.**
1. **Mark printed** still disables after one press, with the toast _"Marked as printed"_.
2. PDF refusal: set the org profile's company name to Chinese, press **下载 PDF** → the **PDF refused** box names the text; **下载 XLSX** still saves.
3. `/expenses/bills` → issue an invoice from a bill (step 24) → unchanged.
4. Voiding a draft invoice (if any exist) and double-voiding an issued one behave as before (`expense.corrections.test.ts`).

**Mobile:** at 400px, the preview's eight-column table scrolls inside its bordered box (`max-h-96 overflow-auto`, `invoices.tsx:453`) with no page-level horizontal scroll, and the warnings notice wraps.

**Readiness: 7/10 — small, well-evidenced changes; held back by unrun probes, Phase 2's dependency on step 24 Phases 2 and 3, and four neighbouring plans (20, 22, 24, 26) being written at the same time.**
- Every symbol, line, role grant, trigger clause and test pin cited here was read at `6bb3a1bf`. Phase 1 touches one pure builder, one loader and one dialog; Phase 2 touches one handler, with an unchanged allow-list.
- All ten decisions are Decided (2026-09-21): D1-B, D2-A, D3-A, D4-A, D5-A, D6 superseded under 24 D4-A (X31), D7-A in the X30 order, D8-A, D9-A, D10-A.
- The live impact is unmeasured until 25-P1…P9 are run. D3 in particular depends on P6.
- The lock proof exists only on a dev Neon branch.
- Plans 20, 22, 24 and 26 may reshape the loader's inputs, the bill's terms or the write-off locks. Anchors and probes must be re-checked after each lands.

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and the Proposed reading of every cross-plan item in `steps-20-26-crosscheck.md` (X28–X40). Each §9 entry keeps all three approaches; only the status, the Chosen line and the text that described a decision as open were changed, plus the task text the overrides below required.

**Chosen:** D1-B · D2-A · D3-A · D4-A · D5-A · D6 superseded under step 24 D4-A (X31; D6-B's behaviour, delivered by 24 Phase 3) · D7-A in the X30 lock order · D8-A · D9-A · D10-A.

**Crosscheck overrides as they land in this plan.** X31 → D6 superseded: no settled-bill refusal in `invoices.cancel`; edits in the header, Finding 3 (settled note), §1 (Phase 2 goal, success criterion, in/out of scope), §2 Journey 3 step 2, §3, §4 data flow, §4.6, §4.8, §4.9, §5 Phase 2 dependencies (24 P3 merged, 25 P2 deploys after 24 P3), Tasks 2.1, 2.2 case (a), 2.4 (new confirm text), §7.1, §7.2, §7.3, §7.5, §7.6 (24 row, required order), 25-P8's comment and §7.8 (P8 sizes what 24 P3 makes invoiceable, adds to 24-P6, accounting sees both before 24 P3 ships), §8 errors and rollback, Risks, SOP rows 4–5, §10 Journey 3 steps 2–3. X30 → D7-A keeps option A in the order pinned `UPDATE invoice` → cost lines `ORDER BY created_at, id` → bills `ORDER BY id`, with `40P01` mapped to CONFLICT and the six raw writes (allow-list) unchanged; edits in §4 data flow, §4.6 (the "bill then line … same order `bills.invoice` takes" sentence), §4.8, §4.9, Task 2.1, Task 2.3 step 2 (the mirrored `bills.invoice` statements follow 24 P2's order), §7.6 26 row (26 D5-A takes the same order, replacing the old "bill, then lines, by id" ask), Risks. X35 → Task 2.3 is its own named `it` in `expense.concurrency.test.ts`, the PR pastes failing and passing dev-branch runs, and, being lock-changing, re-runs every case in the file (Task 2.3, Phase 2 acceptance, §7.6 26 row). X39 → the SOP text corrections in §9 stay an accepted unowned gap; §7.8's follow-up reworded. X38 → no migration under any chosen option; no text change. X40 → the "written in parallel"/"no plan yet" lines in §5, §7.6 and Risks stay as written. X28, X29, X32, X33, X34, X36, X37 → do not touch this plan.
