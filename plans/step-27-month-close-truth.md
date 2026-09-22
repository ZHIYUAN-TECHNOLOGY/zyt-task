# Step 27 — month-end files say what currency their totals are in, a statement goes to one counterparty, the tabs and the pack agree about the month, and a finished job can be closed

**SOP step:** 27 "Close the month" · **Money → Cost lines** (`/expenses/cost-lines`, page title Cost Detail) → **导出单证 · Export documents** → **导出表格 · Export table** dialog · the order's **Expense Entry** page (`/order/$orderId/expenses`) → the same dialog · **Reports → Financial Stat** (`/report/financial`) → five tabs, **Month-end pack**, **Excel** / **PDF** · **Money → Bills** → **Mark synced to finance**.
**Evidence read at:** HEAD `6bb3a1bf` on `feat/new-layout`, 2026-09-21. The `nct-layout` worktree is checked out at `ea1560e7` on `feat/intake-golden-path-e2e`; `git diff --stat 6bb3a1bf HEAD -- packages apps` is empty and `git status --short -- packages apps` is clean, so every code citation below matches `6bb3a1bf`. Every `file:line` was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Standard. Report and export code only, plus one web component per phase. No schema change and no migration under the Chosen options. Phase 2 changes which day a boundary-hour row is reported on (a restatement of existing tab figures), and Phase 3 partly reverses a product decision taken on 1 September 2026 (commit `d4c7df34`). Both were decision-gated, and both were settled on 2026-09-21 (D2-A, D11-A).
**Cross-plan items owned:** the step-27 halves of ledger items `two-profits` (step 20 took the fee-rate half, `step-20-fee-entry-integrity.md:7, 128`), `never-overdue` (step 22 took the source half, `step-22-bill-grouping-integrity.md:100`), `base-currency` (step 22 took none, its §9 row 9) and `never-closed` (repairs b27, s27; nobody else claims it). The SOP fix "The month-end documents have no menu entry".
**Settled 2026-09-21.** Wilfred accepted the recommended option of every decision in this plan (§9: D1–D11, all A), and the settlements X28–X40 in `steps-20-26-crosscheck.md` as written there. Each §9 entry keeps its three approaches; the Chosen one is marked. D11-A partly reverses the 1 September 2026 decision in `d4c7df34`, and was chosen knowing that.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope` at `procedures/org.ts`). Drizzle schema in `packages/db/src/schema`, migrations in `packages/db/src/migrations` (journal ends `0065_quotation_send_decision`; other plans reserve or conditionally name later numbers). TanStack Router file routes in `apps/web/src/routes/_next`. vitest on PGlite (`pushTestSchema`). Dev: web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Cost-line export (multi-shipment).** The Cost lines toolbar mounts `<ExportTableDialog selectedIds={…} filter={filterInput} size="sm" />` (`apps/web/src/routes/_next/expenses/cost-lines.tsx:2239-2243`), beside **Create Bill** (`:2214`) and the **标记为…** mark menu (`:2247`, `CostLineMarkAsMenu` in `components/expense/cost-line-batch-menu.tsx:455-491`, which sets 对账 · Reconciled and 锁定 · Locked through `costLines.batch`).
  - **Order-page export (single shipment).** `order.$orderId.expenses.tsx:796-799` passes **every saved fee on the order, receivable and payable**, as ticks (`costs.map((c) => c.id)`), disabled while the page is dirty.
  - **Dialog.** `components/export-table-dialog.tsx`: button label `:280`; 文件类型 `:307` (对账单 / DEBIT_NOTE / 单票利润单, `FILE_TYPES` `:84-88`); 文件名 `:323`; 选择账户 for DEBIT_NOTE only `:335-381` (with "no accounts" and "no default" wording); 导出格式 `:385` (XLSX only); 取消 `:405`, 预览 `:413`, 导出 after. Nothing ticked sends `{ filterScope: { filter, confirmedCount } }` (`:137-140`).
  - **Server.** `routers/export.ts`: `preview` and `download`, both `requireNode(EXPENSE.costLineRead)`. `collectRows` (`:163-235`) resolves the selection with `resolveCostLineSelection` (cap `filterScopeCap("export")` = 1000, `expense/filter-scope.ts`), reads `exportCols` (`:139-156`, no bill columns), refuses an empty visible set, checks the `export_document` gate on every order and every line, and masks fields. Both write an audit row (`export.preview`, `export.download`). Nothing is stored.
  - **Builders.** `modules/export/artifacts.ts`: `buildStatement` (`:319`) sections by currency, prints receivables **and payables**, and ends with 应收合计 / 应付合计 / **利润 (本位币)** from `rollupCostLines` (`:334-340`). `buildDebitNote` (`:354`) prints receivables only, one converted total, and the remittance block. `buildProfitSheet` (`:391`) sections by order number. Converted totals use each line's own `exchange_rate` (`modules/expense/money.ts:188-198`), which is `NOT NULL DEFAULT '1'` (`schema/expense.ts:69`).
  - **Financial Stat.** `routes/_next/report/financial/index.tsx`: `canRead` = `report:read`, `canExport` = `report:export` (`:603-604`). Month picker `:900-907` (default `new Date().toISOString().slice(0, 7)` at `:640`, `max` from the same UTC clock at `:904`); **Month-end pack** `:908-922`; `<ExportButton>` Excel/PDF `:924-930`; tabs `:937-943`. Date filters are sent as `${day}T00:00:00Z` / `T23:59:59Z` (`:605-610`).
  - **Report server.** `routers/report.ts`: `buildFinancialWhere` (`:413-430`) compares `to_char(<timestamp>, 'YYYY-MM-DD')` — the stored **UTC** day. `getFinancialSummary` (`:1757`) reports per currency plus a `local` roll-up through `bill.exchange_rate`, with `billsMissingRate` and `mixedLocalCurrencies` warnings (`:1880-1935`; web `:1580-1601`). `getReceiptPayment` (`:2385-2466`) has its own UTC-day filter and `.limit(200)` (`:2439`). `getAgeing` → `computeAgeing` (`:599`). `exportMonthEndPack` (`:2705-3050`) converts every stored instant to the **branch zone** (`zonedDay`, `:2760-2761`; zone from `resolveMonthEndZone`, `:541-572`) and writes `report.exportMonthEndPack`. `exportFinancial` (`:3480-3627`) returns bill detail as Excel, or a PDF with a summary.
  - **Finance hand-off.** `bills.markFinanceSynced` (`routers/expense/bills.ts:1313`, node `EXPENSE.billUpdate`) toggles `bill.finance_synced`; the pack only reports it (`report.ts:2691-2697`, `:2961`). Bills column button `-bills.columns.tsx:839-849`.

- **Finding 1 (money): the Financial Stat PDF adds currencies together.** `exportFinancial`'s PDF path sums `r.total` and `r.verified` — the bill's amount in **its own currency** — across every bill in the filter (`report.ts:3574-3590`) and prints them as `Receivable`, `Payable`, `Gross profit` with no unit (`modules/report/pdf.ts:285-298`). A USD 1,000 bill and a MYR 5,000 bill print "Receivable: 6,000.00". The screen never does this: `getFinancialSummary` is per currency with a separately warned local roll-up. The PDF is the file a manager or bookkeeper keeps. The Excel path is per row with a Currency column, so it is sound. **Confirmed.**

- **Finding 2 (money, commercial): a "customer statement" or DEBIT NOTE can span any number of counterparties, and the order-page statement prints carrier costs and our profit.**
  - Neither builder nor `collectRows` looks at `settlement_unit` across the selection. The unticked path exports whatever the filter matches, and the SOP's own instruction ("filter to the customer and month") is the only thing keeping one statement to one customer.
  - `DEBIT_NOTE_COLUMNS` (`artifacts.ts:236-246`) has **no settlement-unit column and the artefact has no addressee**, so a DEBIT NOTE over two customers is one demand for payment for both, addressed to nobody.
  - The order page ticks every fee on the job (`order.$orderId.expenses.tsx:797`). The SOP (guide step 6) sends staff there "for one shipment's statement". That 对账单 lists the carrier's and trucker's lines by name (`FEE_COLUMNS` includes 结算单位) and ends with **利润 (本位币)** (`artifacts.ts:339`) — our margin — on a document meant for the customer.
  - **Confirmed.** Consequence depends on staff sending the file, which is what the step tells them to do.

- **Finding 3 (money): export totals are labelled 本位币 with no currency, use line rates, and never warn.**
  - Every converted total on the three artefacts is labelled `(本位币)` (`artifacts.ts:337-339, 372, 400-402, 415-417`). The builder comment (`:314-317`) says this is because "there is no organisation currency, only a per-branch one". **That is stale:** `org_setting.base_currency` exists, is settable in Parameters (`routes/_next/settings_/parameters.tsx`), and is read through `orgBaseCurrency` (`modules/setting/fx-settings.ts:187-194`). The pack already names it when set (`report.ts:2979-2986`).
  - When it is unset, a line's rate converts into its owning **branch** currency (fx-settings `reportingCurrency`, `:212-224`), so a selection spanning a MYR branch and a VND branch adds MYR to VND under one heading. `getFinancialSummary` detects exactly this and warns (`mixedLocalCurrencies`); the artefacts do not.
  - `rollupCostLines` treats the line rate as authoritative (`money.ts:198`), and the rate column defaults to 1, so a foreign line saved without a rate is added 1:1. The source repair is step 20 Phase 1 (table rate at entry). This plan only makes the total say what it is.
  - **Confirmed.**

- **Finding 4 (integrity): the Financial Stat tabs and the month-end pack disagree about which month a row is in.**
  - The pack converts each instant to the branch zone before taking its day (`report.ts:2760-2777`) and documents why: a payment stored `2026-09-30 23:30` UTC is 1 October in Kuala Lumpur (`:2734-2740`).
  - Every tab takes the **UTC** day: `buildFinancialWhere` (`:419-424`), `getReceiptPayment` (`:2396-2411`), and the trend buckets `to_char(${dateExpr}, 'YYYY-MM')` in `getProfitAnalysis` (`:1960-1963`). `exportFinancial` reuses `buildFinancialWhere` (`:3485`).
  - So for a UTC+8 branch, anything stored 16:00–23:59 UTC on the last day of a month is in the tab's month and the pack's next month, and the same eight hours on the day before the 1st move the other way. The pack's own comment says "the tab and the pack must agree about which movements belong to a period" (`:2833-2834`); they share predicates but not the day. A bookkeeper reconciling the pack's Receipts sheet against the tab gets a difference nobody can source.
  - **Confirmed** by reading both predicates; 27-P5 and 27-P6 size it.

- **Finding 5 (integrity): the receipts tab silently stops at 200 rows.** `getReceiptPayment` ends `.limit(200)` (`report.ts:2439`), returns only `rows`, and the tab renders them with no count and no notice (`financial/index.tsx:2048-2096`). The profit statement solved the same cap with `truncated` (`report.ts:2374`, web `:1988`). The pack refuses to reuse the cap for this very reason (`:2835-2837`). **Confirmed.**

- **Finding 6 (dead end): a job can never be ended or locked.**
  - `collectiveOrder.transition` (`routers/collective-order.ts:3581`) and `batch` (`:3694`) implement shut out / end / lock / archive with process-transition checks and gate calls (`lock`, `unlock`, `end_order`, `shut_out`). Grep of `apps/web`, `e2e` and `seed` finds **no caller** of either.
  - The last caller, `batch-operation-menu.tsx`, was deleted by `d4c7df34` (1 September 2026), whose message calls the loss of the nine bulk verbs "a product decision, taken by the user".
  - `permissions.ts:34-48` records that `lifecycleLock` and `lifecycleArchive` advertise a right nobody can exercise, and says to "revisit when the lifecycle verbs get a UI again".
  - Consequence at month end: after the statement goes out, the job's fees stay editable, because the order lock that `costLines.create` (`refuseIfOrderLocked`) and `saveChildren` (`assertUnlocked`) already respect can never be set. The trade ledgers' **Finished** filter (`order-ledger/format.ts:88`) returns nothing. Step 15 Phase 3 seeds the `lock`, `end_order` and `shut_out` gates for new orgs; without a caller they gate nothing.
  - **Confirmed.**

- **Finding 7 (integrity): the ageing report cannot tell "not late" from "no due date".** `computeAgeing` returns `daysOverdue: null` for both (`report.ts:914-918`) and sorts undated bills last (`:931-936`). The export writes both as a blank cell (`:2628`). The tab shows buckets only. Step 22 Task 1.2 makes new bills carry a company and so a due date. Every bill raised before it stays undated, because the 0062 trigger fills only on NULL → company (`0062_payment_terms_due_date.sql`, directional rule). Finance cannot see how much of the ledger is undated. **Confirmed**; 27-P8 sizes it.

- **Finding 8 (integrity): one shipment has three profits, and no screen says which.**
  - Financial Stat converts at the **bill** rate, and only over **billed** fees (`report.ts:1790-1798, 1969-1970, 2196-2199`).
  - The per-shipment profit sheet (`artifacts.ts:391-422`), the order page's gross-profit box (`feeLocalAmount`, per step 20) and Business Stat's summary (`report.ts:1183`) convert at the **line** rate over **all** fees, billed or not.
  - Step 20 Phase 1 makes the line rate the table rate at entry. What remains is real: a different rate date, and unbilled fees. That is not wrong, but it is invisible. **Confirmed.**

- **Finding 9 (friction): the three documents are reached only from two toolbars.** As the SOP fix says. The cited `cost-lines.tsx:1944` is a pagination-reset effect; the mount is `:2239`. `costLinesSearchSchema` (`cost-lines.tsx:122-147`) already accepts `from`, `to` and `settlementUnit` in the URL, so a pre-filled link needs no new route.

- **Finding 10 (low): the month picker reads the UTC month.** On the 1st of a month before 08:00 in Kuala Lumpur, `max` is the previous month, so the current month cannot be picked, and the default is the previous month by accident (`financial/index.tsx:640, 904`). The server accepts any `YYYY-MM` (`MONTH_PATTERN`, `modules/export/month-end.ts:488`). **Confirmed.**

- **Finding 11 (low, money): a DEBIT NOTE demands lines that were already received.** Nothing in `collectRows` or `buildDebitNote` reads `cost_line.written_off_amount`. That is by design ("nothing derived from a bill", `artifacts.ts:21-36`), and the operator can filter by status first. The dialog does not warn. **Confirmed**; ranked last.

- **Adjacent, not planned (flagged).**
  1. The pack's zone depends on the **viewer's active branch** when no branch filter is set (`resolveMonthEndZone` `:561-564`), and falls back to UTC for a multi-branch org with no active branch (`:571`). Two people can get two packs for one month. The zone is audited (`:3036-3040`). Phase 2 reuses this resolver deliberately, so the tabs and the pack share the same answer; making it org-level is a separate decision.
  2. `defaultFileName` stamps the UTC date (`modules/export/file-name.ts:39`).
  3. **Excel** / **PDF** always export bill detail, whatever tab is open (`report.ts:3487-3502`). They also honour only six of the filter panel's fields (`buildFinancialWhere` `:425-428`). That is SOP text, not a defect (§9 SOP rows 2–3).
  4. The order page can delete a locked line (step 20 finding; its Task 2.1).
  5. `cost_line.exchange_rate` defaults to 1 (step 20).

- **Precedent this plan follows.**
  - Warnings are facts returned beside figures and never change a figure: `billsMissingRate` and `mixedLocalCurrencies` (`report.ts:1733-1756, 1880-1935`).
  - One builder, two sinks: `computeAgeing` serves both `getAgeing` and `exportAgeing` (`:2534, 2548`); the export dialog's preview and download share `buildArtifact`.
  - Truncation flag: `getProfitStatement.truncated` (`:2374`).
  - Branch-zone day: the pack's `zonedDay` (`:2760-2761`) and its boundary tests in `report.month-end.test.ts`.
  - Per-row ledger actions: `OrderRowActions` (`components/order-ledger/order-row-actions.tsx:96`), mounted at `order-ledger-page.tsx:157, 1228`.

- **Migration state.** No migration under the Chosen options. Had D2-C been chosen (an org-level report zone), it would be `00NN_org_setting_report_timezone`, numbered at merge per the runbook.

- **Size.** Mostly sound: the export engine, the pack and the summary tab are careful code. The defects are at the edges: one PDF, the counterparty rule, labels, a shared day function, one cap and one missing UI. Three phases, each small.

---

## 1. Overview

**Problem.** At month end, finance produces four kinds of file. Two of them state totals in no currency: the Financial Stat PDF adds currencies together, and the three export documents call a mixed sum 本位币. The customer statement and DEBIT NOTE can cover several customers at once, and the one-shipment statement the SOP recommends prints the carrier's costs and our profit. The Financial Stat tabs and the month-end pack put the last eight hours of every month in different months. The receipts tab stops at 200 rows without saying so. And once the month is closed nothing can end or lock a job, so the fees under a sent statement stay editable.

**Goals.**
- **Phase 1 (findings 1, 2, 3, 5, 11):** every total on a month-end file names its currency or is withheld with a sentence. A statement or DEBIT NOTE goes to one counterparty. The receipts tab says when it is showing only part of the month.
- **Phase 2 (findings 4, 7, 8, 9, 10):** a month means the same days on every Financial Stat tab and in the pack. Ageing says how many open bills have no due date. Each profit figure says which rate and which fees it counts. Financial Stat links to the three documents for the picked month, and the picker reads the office's own calendar.
- **Phase 3 (finding 6):** an operator can end a finished job and lock it, one row at a time, through the verbs and gates that already exist.

**Success criteria.**
- `report.exportFinancial({ format: "pdf" })` over a USD bill and a MYR bill prints one summary line **per currency**. It prints a local line only with a named unit, and prints no line that adds USD to MYR.
- `export.preview` / `export.download` for `statement` or `debit_note` whose resolved lines carry more than one settlement unit return BAD_REQUEST _"A statement goes to one settlement unit. This selection has 3 (Acme, Carrier X, …). Filter or pick one."_ and write nothing. `profit_sheet` is unaffected.
- On the order page, choosing 对账单 or DEBIT_NOTE on a job with fees to three parties shows a required **结算单位 · Settlement unit** select, and the file carries only that party's lines.
- Converted totals read `应收合计 (MYR)` when a base currency is set or the selection has one target. With mixed targets they are withheld, and the artefact carries the notice _"Converted total withheld: these lines convert into MYR and VND. Per-currency totals above are exact."_
- `getReceiptPayment` returns `truncated: true` and `total` when more than 200 rows match, and the tab says _"Showing the latest 200 of 243 movements. Narrow the filter or use Month-end pack for the full month."_
- For a UTC+8 branch, a payment stored `2026-09-30 17:00` UTC appears in the receipts tab filtered to October and in October's pack, and in neither for September (Phase 2).
- `getAgeing` returns `undatedBills` / `undatedOutstanding`, and the tab and the export say how much open money has no due date.
- A row on a trade ledger offers **End job** and **Lock job** (and their reversals) to members who hold the lifecycle nodes. After Lock, the order's Expense Entry page refuses a new fee with the existing locked message (Phase 3).

**In scope.** `exportFinancial` PDF summary; the counterparty rule and base-currency labelling in `export.ts` / `artifacts.ts`; the dialog's settlement-unit pick and notices; the receipts cap flag; branch-zone days on Financial Stat; the ageing undated count; basis labels on profit figures; a Financial Stat link to the documents; the month picker's clock; per-row End / Lock on the order ledgers; read-only probes.

**Out of scope.**
- The fee-row rate and settlement company at entry (step 20).
- Bill company and due date at grouping (step 22).
- Re-anchoring or back-filling `bill.due_date` (steps 22/25; step 25 D1).
- A period close or month lock (the pack's header, `report.ts:2682-2688`, rules it out and this plan keeps that).
- Business Stat's own date filter (same UTC convention; not step 27).
- An org-level report zone (adjacent 1; D2-C).
- Bulk lifecycle verbs (D11-B, not chosen).
- Archive and delete on the ledger.
- Email send from the dialog (D7 of the original export plan).

**SOP findings (`customer-intake-sop/sop.json`, step 27 `fixes` and ledger items repairing s27/b27):**

| Finding | Planned? | Where |
|---|---|---|
| s27 fix "The month-end documents have no menu entry" | Yes, as a link on Financial Stat carrying the month (D9) | Phase 2 |
| Ledger `never-overdue` (s22, s27) — the s27 part | Yes: count and say, not re-date (D7) | Phase 2 |
| Ledger `two-profits` (s20, s27) — the s27 part | Yes: label the basis, change no figure (D8) | Phase 2 |
| Ledger `base-currency` (s22, s27) — the s27 part | Yes, on exports (D1). Claim partly stale (§9 SOP row 9) | Phase 1 |
| Ledger `never-closed` / break after 27 "The job never ends" | Yes, per-row End / Lock (D11) | Phase 3 |

**Decisions (all Decided 2026-09-21; the Chosen option in brackets, the recommended one in every case):**
- How a mixed-currency total is shown on a PDF or export → D1 [A: per currency always; converted only with a named unit]
- Which clock decides a Financial Stat month → D2 [A: the pack's branch zone]
- A statement or DEBIT NOTE over several counterparties → D3 [A: refuse, and let the dialog pick one]
- The 利润 line on a statement → D4 [A: relabel 净额]
- A DEBIT NOTE over already-received lines → D5 [A: notice only]
- The receipts cap → D6 [A: flag and count]
- Undated open bills in ageing → D7 [A: count and say]
- Three profit bases → D8 [A: label each]
- Where the documents are reached → D9 [A: link from Financial Stat]
- The month picker's clock and default → D10 [A: local clock, current month]
- Closing a job → D11 [A: per-row End / Lock]

## 2. User Journeys

**Journey 1 (changed): Accounting exports a customer statement for the month**
Trigger: steps 20–26 are done for September.
Steps:
1. Accounting opens **Money → Cost lines** and filters **Settlement unit** = Acme Trading and the September dates. No ticks.
2. They press **导出单证 · Export documents (全选)** → the dialog names the count. They choose 对账单 → **预览**.
3. The preview shows the per-currency sections and, at the foot, `应收合计 (MYR)` / `应付合计 (MYR)` / `净额 (MYR)` when the lines share a target (D1-A, D4-A). With mixed targets it shows an amber notice instead of the converted lines.
4. They press **导出** → toast _"Exported 对账单-2026-10-01.xlsx"_ (unchanged).
5. If they had forgotten the settlement-unit filter → 预览 and 导出 refuse with the one-counterparty sentence (D3-A). Nothing downloads.
6. Flow ends: one file, one customer, a total in a named currency.
Where it lives: the existing toolbar and dialog; server refusal plus a notice.

Old journey, for contrast: at step 5 the file downloaded with every customer's fees and a 利润 line.

**Journey 2 (changed): Operations export one shipment's statement from the order page**
Trigger: a job with a receivable to Acme and payables to Carrier X and Trucker Y.
Steps:
1. Ops open `/order/<id>/expenses`, press **导出单证 · Export documents (5)**, choose 对账单.
2. A required **结算单位 · Settlement unit** select appears listing Acme, Carrier X and Trucker Y, and 预览 stays disabled until one is picked (D3-A).
3. They pick Acme → the preview lists Acme's lines only; 导出 downloads it.
4. Choosing 单票利润单 hides the select and exports the whole job as today.
Where it lives: the existing dialog.

**Journey 3 (changed): Finance hands the month to the bookkeeper**
Trigger: 1 October, 09:00 in Kuala Lumpur.
Steps:
1. Finance opens **Reports → Financial Stat**. The month picker shows 2026-10 and allows it (D10-A).
2. They pick 2026-09, press **Month-end pack** → the workbook downloads (unchanged).
3. They open **Actual receipt and payment report** with Date 2026-09-01 to 2026-09-30 → the rows match the pack's Receipts sheet, including a receipt taken at 07:30 on 1 October, which appears in neither (D2-A). With more than 200 rows the tab says so (D6-A).
4. They press **PDF** → the summary is per currency; the local line names MYR or is withheld (D1-A).
5. **Ageing report** reads _"12 open bills (MYR 48,200.00 · USD 3,100.00) have no due date and cannot show days overdue"_ when some bills are undated (D7-A).
6. They press **Statements & debit notes for 2026-09** → Cost lines opens filtered to 1–30 September, ready for Journey 1 (D9-A).
7. On **Money → Bills** they press **Mark synced to finance** per bill (unchanged).
Where it lives: the existing page; a notice, a label and a link.

**Journey 4 (new): Operations end and lock a finished job**
Trigger: the job's statement has gone out.
Steps:
1. Ops open `/order/sea-export`; the row's Actions cell shows a **Lifecycle** menu (D11-A).
2. **End job** → confirm dialog _"End SE2609-0012? The job moves to Finished."_ → toast _"Job ended"_. The row's Process column reads Finished.
3. **Lock job** → confirm → toast _"Job locked"_. On `/order/<id>/expenses`, **Save** now fails with the existing locked refusal, and on Cost lines a new fee with that order fails the same way.
4. In an org whose Order review flow ticks `lock` / `end_order` (new orgs after step 15 Phase 3), an unapproved job refuses with _"\"Lock\" requires review approval first"_ (the gate's own sentence).
5. **Unlock job** / **Cancel end** reverse them; a locked job must be unlocked before any other move (`collective-order.ts` transition, "Order is locked — unlock it before any other transition").
Where it lives: the existing per-row Actions cell; the server verb already exists.

Old journey, for contrast: no screen could do steps 2–5.

## 3. Result (What Changes for the User)

**Before:** the PDF says "Receivable 6,000" for USD 1,000 plus MYR 5,000. A statement can cover several customers and show our margin. The receipts tab and the pack disagree on boundary hours. The receipts tab stops at 200 rows in silence. A finished job stays open forever.
**After:** every total names its currency or says why it is withheld. A statement or DEBIT NOTE names one counterparty. A month is the office's month on every tab and in the pack. A capped tab says it is capped. Ops can end and lock a job.
**Key differences:**
- Accounting: statements and DEBIT NOTEs refuse a mixed counterparty set; the order page asks which party.
- Finance: PDF summary per currency; receipts tab cap stated; ageing states the undated money; profit figures say "at bill rates, billed fees" or "at fee rates, all fees".
- Ops: End / Lock on each ledger row.
- Bookkeeper: the pack and the tabs reconcile to the row.

## 4. Technical Architecture

### 4.1 PDF summary per currency (Journey 3 step 4; Phase 1) → D1

- Extract `getFinancialSummary`'s handler body (`report.ts:1760-1935`) into `async function computeFinancialSummary(context, i)`, on the `computeAgeing` precedent. `getFinancialSummary` calls it; so does `exportFinancial`'s PDF path. The function takes the same filter input. `report.test.ts` greps handler source for the `buildFinancialWhere` identifier (`:2187-2280`); the helper keeps calling it, and the test's handler table is re-checked by the implementer.
- `FinancialPdfSummary` (`pdf.ts:234-243`) becomes `{ billCount, byCurrency: {currency, receivable, payable, receivableVerified, payableVerified, grossProfit}[], local: {currency: string | null, receivable, payable, grossProfit, …} | null, notices: string[] }`.
- `buildFinancialPdf` prints one line per currency, then the local line labelled with `local.currency`, or omits it and prints the notices. Under D1-A, `local` is `null` when `mixedLocalCurrencies.length > 0`. `local.currency` is the base currency if set, else the single branch currency of the filtered bills.
- The notices reuse the screen's two sentences (`financial/index.tsx:1582-1585, 1601-1603`). Per the shared-copy rule, the implementer greps for both strings and keeps one wording.
- The Excel path is unchanged.

### 4.2 One counterparty per statement; named converted totals (Journeys 1–2; Phase 1) → D1, D3, D4, D5

**Server (`routers/export.ts`, in `collectRows` after the scoped read and before the gates):**

```ts
// statement / debit_note only — one settlement unit (D3-A)
const units = await db
  .selectDistinct({ unit: sql<string>`coalesce(btrim(${costLine.settlementUnit}), '')` })
  .from(costLine).where(and(scope, inArray(costLine.id, costLineIds)));
if (type !== "profit_sheet" && units.length > 1) {
  throw new ORPCError("BAD_REQUEST", { message: oneCounterpartyMessage(units) }); // names ≤ 3, then "…"
}
```

- `collectRows` gains the `type` argument. The query reads the **unmasked** column for the check only. The message names units only when the caller can read the field. If `maskFields` would hide `settlementUnit` for this member, the message gives the count alone. The implementer checks `maskFields(…, "costLine")` field names at the base commit.
- **Conversion target (D1-A).** A second read: `selectDistinct({ currency: team.currency }).from(costLine).innerJoin(team, eq(team.id, costLine.owningBranchId)).where(and(scope, inArray(costLine.id, costLineIds)))`, plus `orgBaseCurrency`.
  - `target` = base currency if set.
  - Else the single branch currency.
  - Else `null` with `mixed = [..currencies]`.
- `buildArtifact(type, rows, account, { target, mixed })`.
- **Builders (`artifacts.ts`).**
  - Converted totals are labelled `(<target>)` instead of `(本位币)`.
  - When `target === null`, the `totals` array omits converted lines, and the artefact gains `notices: string[]`. `Artifact` gets an optional `notices?`. `renderXlsx` writes each notice as a row under the totals; the dialog renders them amber.
  - `buildStatement`'s third line becomes `净额 (<target>)` (D4-A).
  - The builder docblock (`:306-318`) is corrected: base currency exists; `null` means mixed.
  - `rollupCostLines` and `billTotal` are unchanged, so the file's "no money arithmetic of its own" rule (`:1-20`) holds.
- **D5-A.** For `debit_note`, count selected receivable lines with `written_off_amount > 0` in the same read. When the count is positive, add the notice _"N of these lines are already received in part or in full; this DEBIT NOTE asks for their whole amount."_ The column is read, never printed, so the "nothing derived from a bill" non-goal stays true (`BILL_DERIVED_COST_LINE_COLUMNS` is about printed columns).

**Web (`components/export-table-dialog.tsx`).**
- New optional prop `lines?: { id: string; settlementUnit: string | null }[]`, passed by both mounts. Cost lines passes `selectedLines`; the order page passes its `costs`.
- When `type` is `statement` or `debit_note`, `lines` is given, and the ticked ids span more than one trimmed unit, render **结算单位 · Settlement unit** (required) listing the units. The selection sent is the ids of the picked unit only. 预览 and 导出 stay disabled until one is picked. Changing type or unit clears the preview (the `changeType` rule, `:142-145`).
- The unticked path has no `lines`, so the server refusal (toast) is the guard.
- Render `artifact.notices` above the preview table in the same amber style as the bank-account warning (`:375-379`).

### 4.3 Receipts cap stated (Journey 3 step 3; Phase 1) → D6

`getReceiptPayment` runs a `count(*)` over the same `filters` and returns `{ rows, total, truncated: total > rows.length }`. The receipts card renders the sentence from §1 when `truncated`. Additive output; the only web reader is `financial/index.tsx:743`.

### 4.4 A month is the branch's month (Journey 3 step 3; Phase 2) → D2

- Hoist the pack's `zonedDay` (`report.ts:2760-2761`) to module scope as `zonedDayExpr(expr: SQL, timeZone: string)`, plus `zonedMonthExpr` (`'YYYY-MM'`). The pack's comment block about the double `AT TIME ZONE` moves with it; the pack calls the hoisted form. The pack comment's warning (`:2768-2775`) that it must not name `buildFinancialWhere` still applies — only the day function is shared.
- `buildFinancialWhere(scope, i, timeZone)` compares `zonedDayExpr(dateExpr, timeZone)`. `getReceiptPayment` does the same for `coalesce(payment_date, created_at)`. `getProfitAnalysis`'s buckets use `zonedDayExpr` / `zonedMonthExpr`. Every caller resolves `timeZone` once through `resolveMonthEndZone(context, i.branchId)`, the pack's resolver, so a tab and a pack for the same branch filter agree by construction.
- Callers of `buildFinancialWhere` at HEAD: `getFinancialSummary`, `getProfitAnalysis`, `getProfitBreakdown`, `getProfitStatement`, `getBillingRecords`, `computeAgeing` (if it uses it; re-check), `exportFinancial`. Task 2.1 greps them all.
- `axisDate` in `getProfitStatement` (`:2305`) and any other `to_char(${dateExpr}` in a SELECT list also move to the zoned form, so the displayed day matches the filtered day.
- The web keeps sending `T00:00:00Z` (the server uses only the day part, `:420`).

### 4.5 Ageing says what is undated (Journey 3 step 5; Phase 2) → D7

`computeAgeing` adds, over the same `unpaid` predicate: `undated: { billCount, byCurrency: { currency, outstanding }[] }`, counting bills with `due_date is null`. `getAgeing` returns it. `exportAgeing` writes one line under the summary sheet. The tab renders an amber line under the table (the `billsMissingRate` style). No figure, bucket or sort changes.

### 4.6 Profit figures say their basis (Phase 2) → D8

Copy only, no figure changes:
- Financial Stat profit tabs and summary tiles get a sub-caption _"At each bill's rate · billed fees only"_.
- The profit sheet's footer gets a notice row _"At each fee's own rate · every fee on the job, billed or not"_ (through `notices`, §4.2).
- Business Stat's summary tile gets _"At each fee's own rate · all fees"_.

The implementer greps `apps/web/src` and `packages/api/src/modules/export` for "gross profit" / "利润" captions and reports every instance touched.

### 4.7 Documents link and month picker (Journey 3 steps 1, 6; Phase 2) → D9, D10

- In `financial/index.tsx`, beside **Month-end pack** (inside `canExport`), add a link-styled button **Statements & debit notes for <month>** → `navigate({ to: "/expenses/cost-lines", search: { from: firstDay, to: lastDay } })`, where `firstDay` / `lastDay` come from the picked month. Hidden unless the member has `expense:read` (nav's own key, `nav.ts:228`).
  - Task 2.4 re-reads which date `from`/`to` filter on Cost lines (fee date or created date) and uses the same meaning the pack uses for fees, or states the difference in the button's `title`.
- The picker's `max` and default use the browser's local calendar (`new Date()` → local `YYYY-MM` via `getFullYear()`/`getMonth()`), not `toISOString()`.

### 4.8 Per-row End / Lock (Journey 4; Phase 3) → D11

- `OrderRowActions` gains props `process` and `locked` (from the ledger row; `order-ledger-page.tsx:157` and `:1228` pass them — re-read the row shape at the base commit).
- Render a small **Lifecycle** dropdown (existing `DropdownMenu` primitive) with **End job** / **Cancel end** (by `process`), **Lock job** / **Unlock job** (by `locked`). Each confirms, then calls `client.collectiveOrder.transition({ orderId, process: "finished" | "not_shut_out" } | { orderId, locked })`, invalidates queries, and toasts the result or `error.message`.
- Shut out stays off (not a month-end verb; D11-C lists it). No server change: gates, process checks and audit are already in `transition`.
- **Visibility.** The ledger already reads `org.members.me` permissions for other controls; the implementer confirms whether node keys `collectiveOrder.lifecycle.process` / `.lock` appear in `me.permissions` (`lib/permissions.ts:70-77`). If not, the menu renders for everyone with `collectiveOrder:update`, and the server's FORBIDDEN `Missing permission: …` toast is the guard.
- **Roles.** Accounting holds no lifecycle node (`roles.ts:174`), so the step-27 actor asks ops or a branch manager to lock. The release note says so (probe 27-P13).
- The comment at `modules/collective-order/permissions.ts:34-48` is updated: the verbs have a UI again.

### 4.9 Data model

**No schema change under the Chosen options.** D2-C (not chosen) would have added `org_setting.report_timezone text` (nullable), migration `00NN_org_setting_report_timezone`, numbered at merge.

### 4.10 API contracts

| Procedure | Change | New refusals / fields |
|---|---|---|
| `report.exportFinancial` (pdf) | summary via `computeFinancialSummary`; per currency; local only with a unit | – |
| `report.getFinancialSummary` | body extracted, output unchanged | – |
| `export.preview`, `export.download` | one-counterparty rule for `statement`/`debit_note`; named target; `notices` | BAD_REQUEST one counterparty |
| `report.getReceiptPayment` | `total`, `truncated` | – |
| Financial Stat procedures using `buildFinancialWhere`, and `getReceiptPayment` (Phase 2) | days in the branch zone | – (boundary rows move) |
| `report.getAgeing`, `exportAgeing` | `undated` | – |
| `collectiveOrder.transition` | unchanged; gains a web caller | existing gate / locked / process refusals |

Refusal order on export: FORBIDDEN (node) → selection refusals (cap, count mismatch, empty) → one counterparty → NOT_FOUND none visible → gates.

### 4.11 Key decisions (all Decided 2026-09-21; §9 keeps the three approaches of each)
D1-A, D2-A, D3-A, D4-A, D5-A, D6-A, D7-A, D8-A, D9-A, D10-A, D11-A Chosen (each the recommended option).

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- D1, D3, D4, D5, D6 settled (Wilfred, 2026-09-21: all A).
- Step 20 Phase 1 and step 22 Phase 1 merged, or explicitly accepted as later; D8/D7 copy reads best after them (§7.6). For `order.$orderId.expenses.tsx`, crosscheck X36 (settled as proposed) fixes the order: step 20's page edits (P1–P3) → step 22 Phase 2 → this plan's Task 1.5.
- Step 02 Task 1.1 (moves `verifiedAmountExpr` out of `report.ts`) and step 03 Phase 1 (edits `computeAgeing`) merged, because they rewrite the regions Tasks 1.1, 1.3 and 2.2 edit.
- Re-locate every anchor in `report.ts`, `export.ts`, `artifacts.ts`, `pdf.ts`, `export-table-dialog.tsx`, `financial/index.tsx`, `order-row-actions.tsx` **by symbol** at the base commit.

### Phase 1 — Every month-end total names its currency, and a statement names one counterparty (findings 1, 2, 3, 5, 11)

**Delivers:** Journeys 1 and 2 end to end, and Journey 3 steps 3 (cap) and 4.
**Dependencies:** D1, D3, D4, D5, D6 (settled 2026-09-21, all A). Steps 02 Task 1.1 and 03 Phase 1 merged. Task 1.5 after step 22 Phase 2 (X36).

- **1.1** Extract `computeFinancialSummary`; rebuild the PDF summary per currency with a named or withheld local line and the two notices (§4.1). Files: `packages/api/src/routers/report.ts`, `packages/api/src/modules/report/pdf.ts`. · **Agent A (backend)**
- **1.2** Counterparty rule, conversion target, `notices`, D4 label, D5 notice (§4.2); correct the builder docblock. Files: `packages/api/src/routers/export.ts`, `packages/api/src/modules/export/artifacts.ts`, `packages/api/src/modules/export/xlsx.ts` (notice rows). · **Agent A (backend)**
- **1.3** `getReceiptPayment` `total` / `truncated` (§4.3). Files: `packages/api/src/routers/report.ts`. · **Agent A (backend)**
- **1.4** Tests:
  - `report.test.ts` `describe("exportFinancial")`:
    - PDF over USD + MYR bills in one branch → the summary names both currencies and prints no cross-currency sum (assert on the text layer `pdf.test.ts` already reads, or on `buildFinancialPdf`'s input through a spy).
    - Two branches (MYR, VND) with no base currency → local line absent and the mixed sentence present.
    - With `org_setting.base_currency = 'MYR'` → local line labelled MYR.
  - `report.test.ts` `describe("getReceiptPayment")`: 201 payments → `rows.length === 200`, `total === 201`, `truncated === true`; 3 payments → `truncated === false`.
  - `export.test.ts`:
    - A statement over two units → BAD_REQUEST naming both, and no `export.download` audit row.
    - The same with one unit → 200.
    - A profit sheet over two units → 200.
    - A debit note over one unit with a line having `written_off_amount > 0` → notice present.
    - An unticked statement whose filter spans units → BAD_REQUEST.
    - A masked-settlement-unit member → message carries a count, not names.
  - `artifacts.test.ts`:
    - Labels use the target code.
    - `target: null` → no converted totals, notice present.
    - Every remaining footer still equals an independent `rollupCostLines` / `billTotal` call (the file's existing pin).
    - Statement third label is 净额.

  Files: `packages/api/src/routers/report.test.ts`, `packages/api/src/routers/export.test.ts`, `packages/api/src/modules/export/artifacts.test.ts`, `packages/api/src/modules/report/pdf.test.ts`. · **Agent A (backend)**
- **1.5** Dialog: `lines` prop, settlement-unit select, notices; pass `lines` from both mounts; receipts truncation sentence (§4.2, §4.3). Files: `apps/web/src/components/export-table-dialog.tsx`, `apps/web/src/routes/_next/expenses/cost-lines.tsx` (one prop at the mount), `apps/web/src/routes/_next/order.$orderId.expenses.tsx` (one prop at the mount), `apps/web/src/routes/_next/report/financial/index.tsx` (receipts card). · **Agent B (frontend)**

**Acceptance.**
- §10 Journeys 1–2 pass in the browser; the order-page statement lists only the picked party.
- The Financial Stat PDF over a two-currency seed shows two currency lines and no unlabelled sum.
- The suites above pass, judged by reading the output for `failed`.

### Phase 2 — A month is the office's month, and each figure says what it counts (findings 4, 7, 8, 9, 10)

**Delivers:** Journey 3 end to end.
**Dependencies:** Phase 1 merged (hands off `report.ts`, `artifacts.ts`, `financial/index.tsx`). D2, D7, D8, D9, D10 (settled 2026-09-21, all A). Re-check before Task 2.1: probes 27-P5 and 27-P6 (how many rows move); if boundary rows are material in closed months already handed to a bookkeeper, stop and decide the release note with Wilfred.

- **2.1** Hoist `zonedDayExpr` / `zonedMonthExpr`; thread `timeZone` through `buildFinancialWhere`, `getReceiptPayment`, the trend buckets and any `to_char(${dateExpr}` in a SELECT (§4.4). Grep every `buildFinancialWhere(` and `to_char(` in `report.ts` and list them in the PR. Files: `packages/api/src/routers/report.ts`. · **Agent C (backend)**
- **2.2** `computeAgeing` `undated`; `exportAgeing` line (§4.5). Files: `packages/api/src/routers/report.ts`. · **Agent C (backend)**
- **2.3** Tests:
  - `report.month-end.test.ts`: a new `describe("tabs agree with the pack")`. For a KL branch, seed payments at `2026-08-31T15:59Z`, `2026-08-31T16:00Z`, `2026-09-30T15:59Z` and `2026-09-30T16:00Z`, and bills at the same instants. Then `getReceiptPayment` and `getFinancialSummary` filtered to September contain exactly the rows the pack's Receipts and Invoices sheets hold for 2026-09. Fixture copied from the file's existing boundary pins.
  - `report.test.ts`: `getAgeing` with two undated open bills and one dated one → `undated.billCount === 2`, buckets unchanged.
  - Re-run all of `report.test.ts`: fixtures that seed noon-UTC instants are unaffected; any that seed near midnight UTC are listed and adjusted with a comment, never by weakening an assertion.

  Files: `packages/api/src/routers/report.month-end.test.ts`, `packages/api/src/routers/report.test.ts`. · **Agent C (backend)**
- **2.4** Web: ageing undated line; basis captions (§4.6); documents link (§4.7); local-clock picker. Files: `apps/web/src/routes/_next/report/financial/index.tsx`, `apps/web/src/routes/_next/report/business/index.tsx` (caption only; re-locate the file at the base commit). · **Agent D (frontend)**
- **2.5** Profit-sheet basis notice through `notices` (§4.6). Files: `packages/api/src/modules/export/artifacts.ts`, `packages/api/src/modules/export/artifacts.test.ts`. · **Agent C (backend)**

**Acceptance.**
- §10 Journey 3 passes; the boundary test is green and was seen failing on the old predicates first (run it once against HEAD's `buildFinancialWhere` and record the failure in the PR).
- The ageing tab states the undated count on a seed with an undated bill.
- The picker allows the current local month on the 1st before 08:00 (verified by overriding the clock in the console; §10 edge 4).

### Phase 3 — A finished job can be ended and locked (finding 6)

**Delivers:** Journey 4 end to end.
**Dependencies:** D11 (settled 2026-09-21, A). Step 15 Phase 3 merged if its gates are to be exercised (not required for the code). Re-check before Task 3.1: probes 27-P9, 27-P12, 27-P13; if 27-P12 shows orgs with `lock` ticked and a large unapproved backlog (step 15 P11), say in the release note that Lock will refuse those jobs.

- **3.1** `OrderRowActions` lifecycle menu; pass `process` / `locked` from both mounts (§4.8). Files: `apps/web/src/components/order-ledger/order-row-actions.tsx`, `apps/web/src/components/order-ledger/order-ledger-page.tsx`. · **Agent E (frontend)**
- **3.2** Comment update in `modules/collective-order/permissions.ts:34-48` (the verbs have a UI). Files: `packages/api/src/modules/collective-order/permissions.ts` (comment only). · **Agent E (frontend)**
- **3.3** E2E: `e2e/specs/order.lifecycle.spec.ts` [NEW]:
  - As a branch-manager seed actor, End then Lock a job from the ledger row.
  - `collectiveOrder.get` shows `process: "finished"`, `locked: true`.
  - A `costLines.create` with that `orderId` over RPC → the locked refusal.
  - Unlock → a fee saves.

  Run with the e2e seed (`e2e/fixtures/seed-cli.ts`; re-read `ACTORS` at the base commit). Files: `e2e/specs/order.lifecycle.spec.ts` [NEW]. · **Agent F (test)**

**Acceptance.**
- §10 Journey 4 passes in the browser.
- `apps/web/src/architecture.test.ts` passes: every new button has a handler.
- The new spec passes.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.4 | `packages/api/src/routers/report.ts`, `packages/api/src/modules/report/pdf.ts`, `packages/api/src/routers/export.ts`, `packages/api/src/modules/export/artifacts.ts`, `packages/api/src/modules/export/xlsx.ts`, the four test files in 1.4 | `packages/api/src/modules/setting/fx-settings.ts`, `packages/api/src/modules/expense/money.ts`, `packages/api/src/serialize.ts`, `packages/api/src/routers/expense/filter-scope.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.5 | `apps/web/src/components/export-table-dialog.tsx`, `apps/web/src/routes/_next/expenses/cost-lines.tsx` (mount prop), `apps/web/src/routes/_next/order.$orderId.expenses.tsx` (mount prop), `apps/web/src/routes/_next/report/financial/index.tsx` | `apps/web/src/components/filter-scope-confirm.tsx` |

opus / high for A: money labels on customer-facing files, a refusal on a shared export path, and a 3,600-line router that steps 02 and 03 also edit.
Run mode: **A (the `Artifact.notices` type and the BAD_REQUEST contract) → B**. B starts once `bun run check-types` sees `notices?` and `getReceiptPayment`'s `truncated`.
Serialization point: `bun run check-types` (grep the output for `error TS` and `failed`), then the Phase 1 suites.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | opus | high | 2.1–2.3, 2.5 | `packages/api/src/routers/report.ts`, `packages/api/src/routers/report.month-end.test.ts`, `packages/api/src/routers/report.test.ts`, `packages/api/src/modules/export/artifacts.ts`, `packages/api/src/modules/export/artifacts.test.ts` | `packages/api/src/modules/export/month-end.ts` |
| Agent D (frontend) | frontend-engineer | sonnet | medium | 2.4 | `apps/web/src/routes/_next/report/financial/index.tsx`, `apps/web/src/routes/_next/report/business/index.tsx` | `apps/web/src/routes/_next/expenses/cost-lines.tsx` (search schema) |

opus for C: a restatement of which day a row belongs to across seven procedures, proven against the pack's boundary pins.
Run mode: C ∥ D; the `undated` field is the one contract (D reads it once C's type-check is clean).
Handoffs: `report.ts`, `artifacts.ts`: Agent A → Agent C. `financial/index.tsx`: Agent B → Agent D.

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent E (frontend) | frontend-engineer | sonnet | medium | 3.1, 3.2 | `apps/web/src/components/order-ledger/order-row-actions.tsx`, `apps/web/src/components/order-ledger/order-ledger-page.tsx`, `packages/api/src/modules/collective-order/permissions.ts` (comment) | `packages/api/src/routers/collective-order.ts` (`transition`), `apps/web/src/lib/permissions.ts` |
| Agent F (test) | test-engineer | sonnet | medium | 3.3 | `e2e/specs/order.lifecycle.spec.ts` [NEW] | `e2e/fixtures/seed-cli.ts` |

Run mode: E → F.
**Schedule:** Phase 1 → Phase 2 → Phase 3. Phase 3 shares no file with Phases 1–2 and may run in parallel with them on its own worktree.
**Serialization points:** after each phase, `bun run check-types` (read the output; it can exit 0 while printing "failed"), both architecture tests, and restart `:3000` before any browser check (`bun --hot` does not reload `packages/api`).
**Commits:** one committer at a time in a shared worktree; confirm the index is empty before `git add` and read every hunk.

**Smell test.**
- [x] Every task has one owner; no file is owned twice within a phase.
- [x] A → B and C → D contracts are named (`notices`, `truncated`, `undated`).
- [x] Every opus is justified; no haiku.
- [x] Each phase completes a journey (1–2, 3, 4).

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at `6bb3a1bf`, 2026-09-21)

- **`export.preview` / `export.download`.**
  - Web: `export-table-dialog.tsx` only, mounted at `cost-lines.tsx:2239` and `order.$orderId.expenses.tsx:796`.
  - E2E: `e2e/specs/dynamic-params.bank-accounts-export.spec.ts` (DEBIT_NOTE remittance). Re-run it; if it exports a mixed-unit selection, give its fixture one settlement unit, never loosen the rule.
  - Tests: `export.test.ts`, `artifacts.test.ts`.
- **`buildArtifact`.** Callers `export.ts` only (`preview`, `download`). Signature gains an optional fourth argument.
- **`report.exportFinancial`.** Web `<ExportButton>` (`financial/index.tsx:2365`). Tests `report.test.ts:2125-2180`. `buildFinancialPdf` callers: `report.ts` only.
- **`getFinancialSummary`.** Web `financial/index.tsx:612-617`; output unchanged by the extraction.
- **`getReceiptPayment`.** Web `financial/index.tsx:743`; tests `report.test.ts:1341-1395`.
- **`buildFinancialWhere`.** Seven handlers in `report.ts` (Task 2.1 lists them). `report.test.ts:2187-2280` pins which handlers consume a date axis by grepping source; the builder keeps its name.
- **`computeAgeing`.** `getAgeing`, `exportAgeing`. Steps 02 and 03 also edit it (§7.6).
- **`collectiveOrder.transition`.** No caller today; Phase 3 adds one. Tests `collective-order.guards.test.ts` and `audit-review.test.ts` (step 15 gate cases) already call it over RPC.
- **`OrderRowActions`.** Two mounts in `order-ledger-page.tsx`, used by the eight trade ledgers and `/approve/order` (`isReview`, which keeps the menu hidden: Phase 3 renders it only when `!isReview`).

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| Statement over two customers | file downloads | 400 with the sentence | API first: the dialog toasts the refusal until web lands; web first: the unit select appears, the server allows either |
| Order-page 对账单 | whole job incl. carriers and 利润 | pick one party; 净额 | API first: the order page's statement refuses until web lands (the select is the only way to one party). **Ship web and API together** or API second |
| DEBIT NOTE total | `应收合计 (本位币)` | `应收合计 (MYR)` or withheld with a notice | API-only; web renders notices once it lands |
| Financial Stat PDF | cross-currency sum | per currency | API-only |
| Receipts tab >200 | silent cap | notice | API first: field ignored; web first: field missing, no notice |
| Tab for September | UTC days | branch-zone days | API-only |
| End / Lock job | impossible | per row | web-only |

### 7.3 Behaviour change for existing orgs

- **Phase 1:** any org that exports mixed-unit statements or DEBIT NOTEs gets a refusal (27-P3, 27-P4 size how often the order page produced one). Every exported total changes its label; orgs with mixed branch currencies and no base currency lose the converted total on exports (27-P1).
- **Phase 2:** tab figures for any period restate by the boundary rows (27-P5, 27-P6). A PDF or Excel already filed for a closed month will not match a re-run on the new code for rows in those eight hours. The release note says so, with the counts. The pack does not change.
- **Phase 3:** no automatic change; jobs are ended or locked only when someone presses the button. This is the partial reversal of `d4c7df34` that D11-A accepts (per row only, no bulk). In an org with `lock` / `end_order` ticked (27-P12), unapproved jobs refuse.

### 7.4 Nullable assumptions

- `cost_line.settlement_unit` is nullable free text; `null` and `''` count as one "(blank)" unit, so a selection mixing a blank and a named unit is refused.
- `org_setting` may have no row for an org; `orgBaseCurrency` returns `null` (fx-settings `:187-194`).
- `team.timezone` and `team.currency` are NOT NULL (`schema/organization.ts:73-74`).
- `bill.due_date` nullable (the point of D7).
- `payment.payment_date` nullable; `coalesce(payment_date, created_at)` as today.

### 7.5 Deployment coupling

- Phase 1: API and web **together** (the order-page statement row in §7.2). Build `apps/web` first so a partial deploy does not split the stage (memory `alchemy-partial-deploy-splits-the-stage`).
- Phase 2: API-first safe.
- Phase 3: web-only.

### 7.6 Merge order against steps 04–27

| Plan / task | Shared code | Why and which order |
|---|---|---|
| **02 Task 1.1** | `report.ts` (`verifiedAmountExpr` moves to `modules/credit/exposure.ts`) | Tasks 1.1 and 2.2 read the expression. **02 first.** |
| **03 Phase 1** | `report.ts` `computeAgeing` detail select and export rows; `report.test.ts` four-bill test | Task 2.2 adds beside the same select. **03 first.** |
| 11 Phases 2–3 | `artifacts.ts` read-only reference (order numbers, quantity/price) | No shared code; converted jobs stop splitting sections. Either order. |
| 15 Phase 3 | `collective-order.ts` gates `lock`/`end_order`; `export.ts` `export_document` gate stays; `routers/lading.ts` and `costLines.create` gate calls | This plan edits none of them and keeps the `export_document` calls in `collectRows` in place (the new check goes before them). Phase 3 exercises step 15's gates; merge 15 P3 first to test them. |
| **20 Phase 1** | line rate at entry (`cost-lines.ts`, `collective-order.ts saveChildren`) | No shared file. D8 copy is accurate only after it ("at each fee's own rate" = table rate). **20 P1 first, preferred.** |
| 20 Task 2.1 | order-page delete of locked lines | Phase 3's lock is fully effective on the order page only after it. **20 P2 before 27 P3, preferred.** |
| 21 | `routers/export.ts` read-only reference (`:180-183, 231`) | Step 21 edits `createBill`, not `export.ts`. No conflict. |
| **22 Phases 1–2** | `cost-lines.tsx` (Create Bill region); due dates at grouping | Different region from Task 1.5's one-prop change at `:2239`; second to merge rebases. D7's count shrinks after 22 P1. 22's own suggested order ends "→ 27". |
| 23 | `bills.ts` `markFinanceSynced` (reads) | None. |
| 24, 25 | invoices, invoice document | None; 25 D1 keeps the document's due date invoice-anchored, and D7 here re-dates nothing. |
| 26 | write-offs; `write_off` feeds the pack's Settlements sheet and ageing; `payment.exchange_rate` read by `getReceiptPayment` and the pack | Read-only overlap, checked in `step-27-runbook.md` §2 (there is no "16–27 crosscheck"). Step 26 D2 is settled **A** (an optional payment rate on the sheet, its Phase 3), so step 26 does **not** hand payment conversion to step 27. Payments recorded before 26 P3 stay at rate 1 in `getReceiptPayment` and the pack (26 F6, 26-P8), and `bills.totals` / `billTotals` still read a NULL bill rate as 1 (26 §7.4). Both are **accepted gaps, confirmed 2026-09-21**; this plan adds no task for either. Step 26 D8-A and D11-A keep invoice settlement and FX residue in step 26, so neither is deferred here. |
| 13, 14 | `order-ledger` configs, `order-form.tsx` | 13 adds no web code to `order-row-actions.tsx`; 15 edits only its comments (15 Task 2.1). Phase 3 rebases on 15 Task 2.1's comment edit. |

**Required order:** 02 Task 1.1 → 03 Phase 1 → **27 Phase 1** → **27 Phase 2**; on `order.$orderId.expenses.tsx`, step 20 (all phases) → 22 Phase 2 → 27 Task 1.5 (X36, settled as proposed); 20 Phase 1 and 22 Phase 1 preferred before 27 Phase 2 (copy accuracy); 15 Phase 3 and 20 Phase 2 preferred before **27 Phase 3**. One phase per worktree.

### 7.7 Read-only production probes (SELECT only; Wilfred runs them with the owner's override; none blocks writing code)

```sql
-- 27-P1 Conversion targets per org: base currency set? how many branch currencies carry money? (D1)
select b.organization_id, s.base_currency,
       count(distinct t.currency) as branch_currencies,
       string_agg(distinct t.currency, ',') as currencies, count(*) as bills
from bill b join team t on t.id = b.owning_branch_id
left join org_setting s on s.organization_id = b.organization_id
group by 1, 2 order by 1;

-- 27-P2 Financial Stat PDFs already produced, and how many had no currency filter (finding 1 exercised)
select organization_id, count(*) as pdf_exports,
       count(*) filter (where before_json not like '%"currency":"%') as without_currency_filter,
       min(created_at), max(created_at)
from audit_log
where action = 'report.exportFinancial' and after_json like '%"format":"pdf"%'
group by 1 order by 1;

-- 27-P3 Month-end documents downloaded, by kind (D3 sizing)
select organization_id, target_id as kind, count(*) as downloads,
       sum((after_json::json ->> 'rowCount')::int) as lines, max(created_at) as latest
from audit_log where action = 'export.download'
group by 1, 2 order by 1, 2;

-- 27-P4 Jobs whose fees span more than one settlement unit (every order-page statement of these mixes parties)
select organization_id, count(*) as jobs_with_many_units
from (select organization_id, order_id,
             count(distinct coalesce(btrim(settlement_unit), '')) as units
      from cost_line where order_id is not null group by 1, 2) x
where units > 1 group by 1 order by 1;

-- 27-P5 Payments whose UTC month differs from their branch-zone month, last 12 months (D2)
select p.organization_id, t.timezone,
       to_char((coalesce(p.payment_date, p.created_at) at time zone 'UTC') at time zone t.timezone, 'YYYY-MM') as zone_month,
       count(*) filter (where to_char(coalesce(p.payment_date, p.created_at), 'YYYY-MM')
         <> to_char((coalesce(p.payment_date, p.created_at) at time zone 'UTC') at time zone t.timezone, 'YYYY-MM')) as month_moves,
       count(*) as payments
from payment p join team t on t.id = p.owning_branch_id
where coalesce(p.payment_date, p.created_at) > now() - interval '12 months'
group by 1, 2, 3 order by 1, 3;

-- 27-P6 Bills whose UTC creation month differs from their branch-zone month (D2, default axis)
select b.organization_id, t.timezone,
       count(*) filter (where to_char(b.created_at, 'YYYY-MM')
         <> to_char((b.created_at at time zone 'UTC') at time zone t.timezone, 'YYYY-MM')) as month_moves,
       count(*) as bills
from bill b join team t on t.id = b.owning_branch_id
group by 1, 2 order by 1;

-- 27-P7 Months with more than 200 payment movements (D6)
select organization_id, to_char(coalesce(payment_date, created_at), 'YYYY-MM') as month, count(*)
from payment group by 1, 2 having count(*) > 200 order by 1, 2;

-- 27-P8 Open bills with no due date, and how many have no company either (D7)
select b.organization_id, b.attribute, b.currency,
       count(*) filter (where b.due_date is null) as undated,
       count(*) filter (where b.due_date is null and b.settlement_company_id is null) as undated_no_company,
       count(*) as open_bills
from bill b
where b.total_amount::numeric - coalesce((select sum(w.amount::numeric) from write_off w
                                          where w.bill_id = b.id and w.voided_at is null), 0) > 0
group by 1, 2, 3 order by 1, 2, 3;

-- 27-P9 Job lifecycle state today (D11: expect almost nothing finished or locked)
select organization_id, process, locked, archived, count(*)
from collective_order group by 1, 2, 3, 4 order by 1, 2, 3, 4;

-- 27-P10 Bills whose rate differs from their lines' rates (D8 sizing)
select b.organization_id, count(*) as bills,
       count(*) filter (where b.exchange_rate is null) as bill_rate_null,
       count(*) filter (where b.exchange_rate is not null
                          and abs(b.exchange_rate::numeric - l.min_rate) > 0.000001) as rate_differs,
       count(*) filter (where l.min_rate <> l.max_rate) as lines_disagree
from bill b
join (select bill_id, min(exchange_rate::numeric) as min_rate, max(exchange_rate::numeric) as max_rate
      from cost_line where bill_id is not null group by 1) l on l.bill_id = b.id
group by 1 order by 1;

-- 27-P11 Unbilled fees by month (what Financial Stat's billed-only profit leaves out; D8)
select organization_id, to_char(created_at, 'YYYY-MM') as month, attribute, currency, count(*),
       sum(amount::numeric) as amount
from cost_line where bill_id is null
group by 1, 2, 3, 4 order by 1, 2, 3, 4;

-- 27-P12 Lifecycle gates ticked on the Order review flow (D11; step 15 P1 subset)
select f.organization_id, f.enabled, g.gate_key
from audit_flow f join audit_flow_gate g on g.flow_id = f.id
where f.trigger_type = 'collective_order' and g.gate_key in ('lock', 'unlock', 'end_order', 'shut_out')
order by 1, 3;

-- 27-P13 Roles that can end or lock a job (D11 release note)
select r.organization_id, r.name as role, g.node_key
from role_node_grant g join role r on r.id = g.role_id
where g.node_key in ('collectiveOrder', 'collectiveOrder.lifecycle',
                     'collectiveOrder.lifecycle.process', 'collectiveOrder.lifecycle.lock')
order by 1, 2, 3;
```

**What each probe decides.** P1 → D1 (who loses the converted line). P2 → how much finding 1 has already reached files. P3, P4 → D3 (how often mixed statements were produced; the order page's share). P5, P6 → D2 and its release note. P7 → D6. P8 → D7's wording. P9, P12, P13 → D11 and its release note. P10, P11 → D8.

### 7.8 Blocking prerequisites

- D1, D3, D4, D5, D6 release Phase 1; D2, D7, D8, D9, D10 release Phase 2; D11 releases Phase 3. All were settled on 2026-09-21 (every one A).
- Steps 02 Task 1.1 and 03 Phase 1 merged before Phase 1 (shared `report.ts` regions).
- Probe re-checks (a contradiction stops the task for a re-plan): P5 and P6 before Task 2.1; P9, P12, P13 before Task 3.1. P1–P4 feed the Phase 1 release note.

## 8. Cross-Cutting Concerns

- **Errors.** The counterparty refusal is `BAD_REQUEST` (the input is the problem, like the filter-scope cap, `filter-scope.ts`), with a sentence that says what to do. Lifecycle refusals are the server's existing CONFLICT / FORBIDDEN messages, toasted verbatim.
- **Money.** No new arithmetic. Converted totals still come from `rollupCostLines` and `getFinancialSummary`'s SQL; this plan changes labels, withholds a mixed sum, and moves the day boundary.
- **Shared copy.** The two mixed-currency sentences, the basis captions and the 净额 label each exist in more than one place after this plan. Each task greps `apps/web/src` and `packages/api/src` for the old string before declaring done (`本位币`, `利润 (本位币)`, "were converted at 1.0", "Gross profit").
- **Testing.** PGlite router suites at the API boundary (`report.test.ts`, `report.month-end.test.ts`, `export.test.ts`), builder pins (`artifacts.test.ts`), the PDF text (`pdf.test.ts`), one new e2e spec, and the browser proof in §10. No concurrency proof is needed: every change is a read or an existing single-row verb.
- **Migration.** None. D2-C alone would add `00NN_org_setting_report_timezone`.
- **Rollback.** Each phase is a plain revert; no phase writes data. Jobs ended or locked through Phase 3 stay so after a revert, as with any lifecycle write; reverse them over RPC (`transition`) if needed.
- **Audit trail.** Refusals write nothing. `export.preview` / `export.download` rows keep their shape; `after.notices` may be added (additive). `collectiveOrder.transition` already audits every move.

**Performance & Scalability**
1. **Pagination.** `getReceiptPayment` stays at 200 rows; it gains one `count(*)` over the same predicates.
2. **SQL-side filtering.** The counterparty and target reads are `selectDistinct` over ≤ 1,000 ids (`MAX_EXPORT_LINES`).
3. **N+1.** None. `computeFinancialSummary` is the same queries the summary already runs, called once per PDF.
4. **Index coverage.** `cost_line` by id (primary key) for the new reads; `team` by id. Zoned-day predicates are expressions, as the pack's already are, so they cannot use a plain index on `created_at`. The tabs' current `to_char(...)` predicates cannot either, so there is no regression. `bill_org_idx` and scope still narrow first.
5. **Write atomicity.** No new writes.
6. **Row locking.** None added; `transition` runs as today.
7. **Connections/resources.** One extra small query per export and per receipts load; `resolveMonthEndZone` adds one indexed `team` read per Financial Stat call (up to three reads; cache per handler).
8. **Tenant isolation.** Every new read carries `scope` or `organization_id`; `resolveMonthEndZone` filters `team.organization_id` (`:550`).
9. **Payload size.** `notices` adds a few short strings.
10. **Hot path.** Financial Stat loads call six procedures; each gains one `team` read. Acceptable; if measured slow, resolve the zone once in the web input (not planned).

## 9. Decision Register, Open Questions & Risks

**Statuses.** No Input Gate was held; on 2026-09-21 Wilfred accepted the recommended option of **every** decision below, so all eleven are **Decided**, each with option A. Each keeps its three approaches, its recommendation and its consequence table, so any of them can be re-opened by reading what was rejected. Where a decision leans on a production probe, its **Chosen** line names it: the choice stands, but the check is still required before the task that depends on it, and a contradiction stops the work for a re-plan rather than being absorbed.

**D1: How is a total over several currencies shown on the PDF and the export documents?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Per-currency totals always; the converted total only with a named unit (base currency, else the single branch currency); withheld with a sentence when targets mix (Recommended) (Chosen) | No file shows a sum in no currency. Mixed-branch orgs without a base currency lose the converted line on exports and PDF until they set 本位币 in Parameters (27-P1). Matches the screen's own warnings. |
| **B** | Keep the converted total; add the warning sentence beside it | Nothing disappears; the wrong number stays on a customer-facing file with a note the customer may read. |
| **C** | Refuse PDF / export unless a base currency is set | Forces the setting; blocks month-end for every org that never set one, on the day they need the files. |

- **Recommendation: A.** It is the rule the summary tiles already follow, applied to the files.
- **Chosen: A** (Wilfred, 2026-09-21). Probe 27-P1 sizes who loses the converted line; it feeds the Phase 1 release note and does not re-open the choice.
- **Releases:** Tasks 1.1, 1.2. **Where it lands:** §4.1, §4.2.

**D2: Which clock decides which month a row belongs to on Financial Stat?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | The pack's: branch zone through `resolveMonthEndZone`, on every tab, bucket and Excel/PDF (Recommended) (Chosen) | Tabs and pack agree row for row. Past-period tab figures restate by the boundary rows (27-P5, 27-P6); a file already filed may not match a re-run. Inherits adjacent 1 (the viewer's active branch decides when no branch filter is set). |
| **B** | Make the pack use UTC days like the tabs | One convention, no tab restatement; the pack then files eight hours of every month in the wrong month for the office, which its own comment argues against at length. |
| **C** | A (branch zone) but from a new org-level report zone, `00NN_org_setting_report_timezone` | Removes the viewer dependence; a migration and a Parameters field for a case 27-P1/P6 may show is rare. |

- **Recommendation: A**, with the release note carrying P5/P6. **Re-check:** P5, P6 before Task 2.1.
- **Chosen: A** (Wilfred, 2026-09-21). Re-check before Task 2.1: probes 27-P5 and 27-P6; if boundary rows are material in closed months already handed to a bookkeeper, stop and decide the release note with Wilfred. A contradiction stops the task for a re-plan.
- **Releases:** Tasks 2.1, 2.3. **Where it lands:** §4.4.

**D3: What happens to a statement or DEBIT NOTE over several counterparties?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Server refuses statement / DEBIT NOTE when the resolved lines carry more than one settlement unit; the dialog offers a required unit pick when it knows the lines (Recommended) (Chosen) | One document, one addressee. The order-page statement becomes "pick a party". An org that sent a combined statement to a group of related companies must now export per unit. Profit sheet unaffected. |
| **B** | One file, one section per unit (a statement per party inside it) | Nothing refuses; the file still goes to one inbox with other parties' lines in it. |
| **C** | Allow it; show an amber notice in the preview naming the units | Least change; relies on the operator reading a notice before sending money documents. |

- **Recommendation: A.** A DEBIT NOTE has no addressee field; one unit is the only way it is addressed at all.
- **Chosen: A** (Wilfred, 2026-09-21). Probes 27-P3 and 27-P4 size the Phase 1 release note. Phase 1 API and web deploy together (§7.5).
- **Re-check:** P3, P4 (how often it happened). **Releases:** Tasks 1.2, 1.5. **Where it lands:** §4.2.

**D4: What is the statement's third total called?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | `净额 (<unit>)` — receivable minus payable for the one counterparty (Recommended) (Chosen) | Under D3-A it is exactly the net balance with that party; "profit" was never true for one counterparty. |
| **B** | Drop the line | Simpler; loses the net figure a contra-account customer reconciles against. |
| **C** | Keep `利润` | The customer reads our word for margin on their statement. |

- **Recommendation: A.** **Releases:** Task 1.2.
- **Chosen: A** (Wilfred, 2026-09-21).

**D5: Does a DEBIT NOTE say when lines are already received?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | A notice in preview and file counting received lines; figures unchanged (Recommended) (Chosen) | The operator sees it before sending; the "nothing derived from a bill" rule for printed columns holds. |
| **B** | Exclude lines with `written_off_amount > 0` | Silent narrowing of a money document; a part-paid line vanishes. |
| **C** | Nothing | As today; the SOP tells staff to filter by status first. |

- **Recommendation: A.** **Releases:** Task 1.2.
- **Chosen: A** (Wilfred, 2026-09-21).

**D6: The receipts tab's 200-row cap** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Keep 200; return `total` and `truncated`; say it (Recommended) (Chosen) | Same pattern as the profit statement; points to the pack for the full month. |
| **B** | Paginate the tab | Full list on screen; more web work for a tab the pack already covers. |
| **C** | Remove the cap | Unbounded payload on a page that loads six queries. |

- **Recommendation: A.** **Re-check:** P7. **Releases:** Tasks 1.3, 1.5.
- **Chosen: A** (Wilfred, 2026-09-21). Probe 27-P7 sizes it for the release note.

**D7: Open bills with no due date in ageing** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Count them and say so on the tab and in the export; change no bucket (Recommended) (Chosen) | Finance can see the hole and its size; the source repair stays with step 22 and nothing is re-dated. |
| **B** | Derive a read-time due date from `created_at + days_payable` for undated bills | Days overdue appear, but ageing and the Overdue chip then disagree, and a later real due date moves the figure — what 0062's directional rule forbids. |
| **C** | Nothing here; rely on step 22 | New bills fix themselves; the historic undated ledger stays invisible (P8). |

- **Recommendation: A.** **Releases:** Tasks 2.2, 2.4.
- **Chosen: A** (Wilfred, 2026-09-21). Probe 27-P8 sets the wording; re-run it after step 22 Phase 1 is deployed.

**D8: Three profit bases** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Label each surface with its rate and its fee scope; change no figure (Recommended) (Chosen) | Staff can explain a difference; no restatement (`artifacts.ts:3-5` quotes "changing its definition is a restatement, not a refactor"). |
| **B** | Financial Stat converts at line rates | One number, but a restatement of every past Financial Stat figure, and bill-grain reports then disagree with the invoices they cite. |
| **C** | Profit sheet uses bill rates for billed lines | Mixed bases within one sheet; unbilled lines still at line rates. |

- **Recommendation: A.** **Re-check:** P10, P11 size the gap for the release note. **Releases:** Tasks 2.4, 2.5.
- **Chosen: A** (Wilfred, 2026-09-21). Probes 27-P10 and 27-P11 size the gap for the release note.

**D9: Where are the month-end documents reached?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | A link on Financial Stat beside Month-end pack that opens Cost lines filtered to the picked month (Recommended) (Chosen) | The month-end page leads to the documents with the period filled; no new route or nav entry. |
| **B** | A **Reports → Month-end documents** nav item pointing at Cost lines | Discoverable in the sidebar; no period pre-fill (nav `to` is static). |
| **C** | SOP text only | No code; the friction stays for anyone not reading the SOP. |

- **Recommendation: A.** **Releases:** Task 2.4.
- **Chosen: A** (Wilfred, 2026-09-21).

**D10: The month picker's clock and default** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Local calendar for `max` and default; default stays the current month (Recommended) (Chosen) | Fixes the 00:00–08:00 hole; keeps the page's stated reason for the current-month default (`financial/index.tsx:634-638`). |
| **B** | Local calendar; default to last month during the first five days | Faster close; a rule staff must learn, and a mid-month check on day 3 shows last month. |
| **C** | As today | The first-morning hole stays. |

- **Recommendation: A.** **Releases:** Task 2.4.
- **Chosen: A** (Wilfred, 2026-09-21).

**D11: Can a job be closed, and how?** · Status: **Decided 2026-09-21 — Chosen: A** (reverses part of the 1 September 2026 decision in `d4c7df34`; chosen knowing that)

| | Approach | Consequence |
|---|---|---|
| **A** | Per-row **End job** / **Cancel end** / **Lock job** / **Unlock job** in the existing Actions cell, over the existing `transition` verb (Recommended) (Chosen) | The fees under a sent statement can be frozen; step 15's `lock`/`end_order` gates mean something; the Finished filter fills. No bulk, in keeping with the reason the toolbar went. Accounting cannot press it (no lifecycle grant, `roles.ts:174`; P13). |
| **B** | Restore the bulk toolbar (nine verbs over up to 200 orders) | Fast month-end closing; brings back the surface Wilfred removed, including bulk delete. |
| **C** | Leave it; the SOP says jobs stay open | No code; "the job never ends" stays true, and order lock stays unreachable. |

- **Recommendation: A.** **Re-check:** P9, P12, P13. **Releases:** Phase 3.
- **Chosen: A** (Wilfred, 2026-09-21). This partly reverses the 1 September 2026 product decision in `d4c7df34`, which removed the bulk lifecycle toolbar, and Wilfred chose it knowing that. The reversal is limited to per-row End / Lock and their reversals: no bulk verbs come back, and delete, archive and shut out stay off. Re-check before Task 3.1: probes 27-P9, 27-P12 and 27-P13; a contradiction stops the task for a re-plan. Phase 3 runs, so the `wt-step27-close` worktree is created.

### Risks

- **Phase 2 restates past tab figures.** Certain for boundary rows. → **Release note with P5/P6 counts; the pack is unchanged, so the bookkeeper's filed packs stay right.**
- **The order-page statement refuses if API ships before web.** Certain under D3-A. → **Ship Phase 1 web and API together (§7.5).**
- **Mixed-branch orgs lose converted totals on exports.** Likely where P1 shows it. → **The notice names the fix: set 本位币 in Parameters.**
- **`report.test.ts` fixtures near midnight UTC move day.** Possible. → **Task 2.3 lists and adjusts them with comments; never weaken an assertion.**
- **The viewer's active branch decides the zone** (adjacent 1). Low for single-zone orgs. → **Accepted with D2-A (2026-09-21); D2-C was the alternative.**
- **Lock refuses unapproved jobs in gated orgs.** Certain where P12 shows `lock` ticked. → **Release note; step 15's own rollout (its D6).**
- **Phase 3 partly reverses `d4c7df34`.** Certain; chosen knowingly (D11-A). → **Per row only; bulk verbs, delete, archive and shut out stay off.**
- **Foreign payments before 26 P3 read at rate 1; a NULL bill rate reads as 1.** Certain for old rows (26-P8). → **Accepted gaps, confirmed 2026-09-21; the Phase 2 release note must not say the receipts tab "reconciles" foreign money.**
- **Line numbers drift** (steps 02, 03, 20, 22 edit neighbouring code). Certain. → **Every task locates by symbol.**
- **A stale `:3000` makes browser checks pass on old code.** High. → **Restart after every `packages/api` change and check the process start time.**

### SOP text vs code (Phase 0 wins)

| # | SOP / ledger claims | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| 1 | "There is no period close or month lock in NCT" | No period close, true. But lines can be marked 对账 / 锁定 beside Export (`cost-line-batch-menu.tsx:455-491`, `costLines.batch`), and an order lock exists server-side with no UI (`transition`) | Code (D11); the SOP should name the line marks |
| 2 | "Press Excel or PDF to export the current Financial Stat view" | Always the bill-detail list, whatever tab is open (`report.ts:3487-3502`) | Code (SOP text) |
| 3 | "Uses the page filters" | Only date, cost attribute, settlement unit, currency and branch reach the query (`buildFinancialWhere` `:419-428`) | Code (SOP text) |
| 4 | Fix src `cost-lines.tsx:1944` | `:1944` is a pagination reset; the export mount is `:2239` | Code |
| 5 | Golden step 5 cites `export-table-dialog.tsx:412` | 预览 is `:413` | none |
| 6 | Month "cannot be later than the current month" | Only the input's `max`, from the UTC clock (`:904`); the server accepts any `YYYY-MM` | Code (D10) |
| 7 | "An egress audit row is written for report exports" | Also for cost-line exports: `export.preview` and `export.download` (`export.ts`) | Code |
| 8 | "Tick cost lines and export the customer statement" | The statement also prints payables and a 利润 line, and can span counterparties (`artifacts.ts:319-341`) | Code (D3, D4) |
| 9 | Ledger `base-currency`: "There is no organisation base currency" | An optional `org_setting.base_currency` exists and is settable in Parameters (`fx-settings.ts:187-224`); the defect bites only when unset. The export builder's comment repeats the stale claim (`artifacts.ts:314-317`) | Code (D1) |
| 10 | Ledger `two-profits`: two profits | Three: Business Stat also uses line rates over all fees (`report.ts:1183`); Financial Stat is also billed-only | Code (D8) |
| 11 | "Blank name uses the default '<type>-YYYY-MM-DD'" | True; the date is the UTC date (`file-name.ts:39`) | Code (adjacent 2) |
| 12 | Role "Export documents: expense.costLine.read" | True (`export.ts:289, 304, 343`) | – |
| 13 | "Mark synced to finance … toggle" | True; needs `expense.bill.update` (`bills.ts:1313-1314`), which accounting must hold to do it | Code |
| 14 | Ledger `never-overdue`: "Ageing counts days overdue from the due date alone" | True (`report.ts:914-918`); undated bills also sort last (`:936`) | Code (D7) |

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000. One worktree's servers at a time.
**Preconditions:**
- A freshly seeded e2e org (`bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>`). Re-read `ACTORS` at the base commit. Use `accountant` for exports and Financial Stat, `managerA` (branch-manager, holds the `collectiveOrder` root) for Journey 4, and `owner` for Parameters.
- In that org:
  - Two branches, KL (MYR, `Asia/Kuala_Lumpur`) and HCM (VND).
  - No base currency at first.
  - Job **J1** with a receivable to **Acme** (MYR 1,000) and payables to **Carrier X** (USD 200, rate 4.4) and **Trucker Y** (MYR 150).
  - Bills for J1 (USD and MYR).
  - One payment stored `2026-09-30T17:00Z`.
  - One open bill with no settlement company.
- Confirm the actor with `fetch('/api/auth/get-session')` before each actor's steps. Restart `:3000` after the last `packages/api` edit.

**Migrations:** none. Confirm the journal ends where the merged steps left it and those migrations are applied (journal and database, not an exit code).

**Test commands** (read each output for `failed` and the `Test Files` line):
- Phase 1: `bunx vp test run packages/api/src/routers/report.test.ts packages/api/src/routers/export.test.ts packages/api/src/modules/export/artifacts.test.ts packages/api/src/modules/report/pdf.test.ts packages/api/src/architecture.test.ts`
- Phase 2: `bunx vp test run packages/api/src/routers/report.month-end.test.ts packages/api/src/routers/report.test.ts packages/api/src/modules/export/artifacts.test.ts packages/api/src/modules/export/month-end.test.ts`
- Phase 3: `bunx vp test run apps/web/src/architecture.test.ts packages/api/src/routers/collective-order.guards.test.ts`, then `e2e/specs/order.lifecycle.spec.ts`, `report.golden-path.spec.ts`, `dynamic-params.bank-accounts-export.spec.ts`.
- Every phase: `bun run check-types` (confirm `apps/web` ran; grep for `error TS`).

**Golden path — Journey 1 (Phase 1; `accountant`)**
1. `/expenses/cost-lines` → filter Settlement unit = Acme and September → press **导出单证 · Export documents (全选)** → the dialog names the count.
2. 文件类型 对账单 → **预览** → sections per currency; footer `应收合计 (MYR)`, `应付合计 (MYR)`, `净额 (MYR)`; no `本位币`, no `利润`.
3. **导出** → toast _"Exported 对账单-<date>.xlsx"_; open the file → same footer.
4. Clear the Settlement unit filter → **预览** → error toast naming Acme, Carrier X, Trucker Y; nothing downloads; `audit_log` has no new `export.download` row.

**Golden path — Journey 2 (Phase 1; `managerA`)**
1. `/order/<J1>/expenses` → **导出单证 · Export documents (3)** → 对账单 → a required **结算单位 · Settlement unit** select lists three parties; **预览** is disabled.
2. Pick Acme → **预览** → one line, Acme only → **导出** → the file has no Carrier X or Trucker Y row.
3. Switch to 单票利润单 → the select disappears → **预览** shows all three lines under J1.

**Golden path — Journey 3 (Phases 1–2; `accountant`)**
1. `/report/financial` → **PDF** → open it: one summary line for MYR and one for USD. No local line, and the mixed-currency sentence present (two branch currencies, no base currency).
2. As `owner`, set base currency MYR in Parameters; repeat → local line labelled MYR.
3. Actual receipt and payment report, Date 2026-10-01 to 2026-10-31 → the `2026-09-30T17:00Z` payment is listed. September → not listed (Phase 2).
4. Month picker 2026-09 → **Month-end pack** → Receipts sheet agrees with step 3.
5. Ageing report → amber line naming one undated open bill and its amount.
6. **Statements & debit notes for 2026-09** → lands on `/expenses/cost-lines?from=2026-09-01&to=2026-09-30` with the chips showing the dates.

**Golden path — Journey 4 (Phase 3; `managerA`)**
1. `/order/sea-export` → J1's Actions → **Lifecycle → End job** → confirm → toast; the Process column reads Finished.
2. **Lock job** → confirm → toast. `/order/<J1>/expenses` → add a fee, Save → the locked refusal toast. Reload → the fee is absent.
3. **Unlock job** → add the fee → saved.

**Edge case 1: masked counterparty.** A member whose `costLine.settlementUnit` is masked exports an unticked mixed set → the refusal gives a count, no names.
**Edge case 2: DEBIT NOTE over a part-received line.** Write off half of Acme's line (step 26 flow), export a DEBIT_NOTE for Acme → notice _"1 of these lines is already received in part or in full…"_; the amount is unchanged.
**Edge case 3: receipts cap.** On the dev branch or a seed with 201 payments in a month → the tab shows the "latest 200 of 201" sentence.
**Edge case 4: first-morning picker.** In the console, override `Date` to `2026-10-01T01:00:00+08:00` and reload → the picker's `max` is 2026-10 and it defaults to 2026-10.
**Edge case 5: gated lock.** In a new org after step 15 Phase 3, try **Lock job** on an unsubmitted job → toast with the gate sentence; the row is unchanged.

**Regression checks.**
1. A single-unit DEBIT NOTE still carries the default bank account block (`dynamic-params.bank-accounts-export.spec.ts`).
2. Month-end pack filename and sheets unchanged (`report.month-end.test.ts`).
3. Financial Stat summary tiles unchanged (the extraction changes no figure).
4. Create Bill (全选) on Cost lines unaffected.
5. `/approve/order` shows no Lifecycle menu (`isReview`).

**Mobile:** at 400px the dialog's unit select and notices wrap without horizontal scroll; the Lifecycle menu opens inside the Actions cell.

**Readiness: 7/10 — every decision was settled on 2026-09-21 and the defects are verified in code, with fixes that are small and testable at the API boundary; what holds the score is that Phase 2 restates past tab figures, Phase 3 knowingly reverses part of a recorded product decision, the prerequisite merges have not landed, and the probes are unrun.** What is still outstanding:
- Steps 02 Task 1.1 and 03 Phase 1 must merge first (shared `report.ts` regions). On `order.$orderId.expenses.tsx`, step 20's page edits and step 22 Phase 2 merge before Task 1.5 (X36). Steps 20, 22 and 15 Phase 3 are preferred first for copy accuracy and to exercise the gates.
- Step 26 was cross-checked in `step-27-runbook.md` §2. Its two hand-offs (payments before 26 P3 at rate 1; a NULL bill rate read as 1) are accepted gaps, confirmed 2026-09-21, and add no task here.
- Probes 27-P1 to 27-P13 are unrun; P5/P6 re-check D2 before Task 2.1, P9/P12/P13 re-check D11 before Task 3.1.

---

## Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and the cross-plan settlements X28–X40 in `steps-20-26-crosscheck.md` as that file words them. He also confirmed the accepted gaps listed in `step-27-runbook.md` §10. Each §9 entry keeps all three approaches; only the status, the Chosen line and the text that described a decision as open were changed.

| Decision | Chosen | Note |
|---|---|---|
| D1 | A | Per-currency totals always; a converted total only under a named unit, else withheld with a sentence (27-P1 for the release note) |
| D2 | A | The pack's branch zone (`resolveMonthEndZone`) on every Financial Stat tab, bucket and file (re-check P5, P6 before Task 2.1) |
| D3 | A | Server refuses a statement / DEBIT NOTE over more than one settlement unit; the dialog offers a required unit pick. Phase 1 API and web deploy together |
| D4 | A | The statement's third total is `净额 (<unit>)` |
| D5 | A | Notice only for already-received lines on a DEBIT NOTE; figures unchanged |
| D6 | A | Receipts tab keeps 200 rows and returns `total` / `truncated` |
| D7 | A | Ageing counts and states undated open bills; no bucket changes, nothing re-dated |
| D8 | A | Each profit surface names its rate and fee scope; no figure changes |
| D9 | A | A link on Financial Stat opens Cost lines filtered to the picked month |
| D10 | A | Local calendar for the month picker; default stays the current month |
| D11 | A | Per-row End / Cancel end / Lock / Unlock over `collectiveOrder.transition`. **Partly reverses `d4c7df34` (1 September 2026), chosen knowing that**; no bulk verbs return. Phase 3 runs, and `wt-step27-close` is created (re-check P9, P12, P13 before Task 3.1) |

**Cross-plan settlements that land in this plan.**
- **X36** → §5 prerequisites, Phase 1 dependencies, §7.6 required order: step 20's edits to `order.$orderId.expenses.tsx` (P1–P3) → step 22 Phase 2 → this plan's Task 1.5.
- **X38** → §4.9, §8: no migration under the Chosen options; D2-C's `00NN_org_setting_report_timezone` would have been numbered at merge.
- **X39, X40** → the SOP text in §9 "SOP text vs code" stays on the same terms as steps 20–26 (an accepted unowned gap, or one `/zyt-update` after each deploy), and stale "no plan yet" references to step 27 in other plans are recorded, not edited (`step-27-runbook.md` §12).
- X28–X35 and X37 touch no file or decision of this plan.

**Step 26 settled, as it lands here.** Step 26 D2 is **A**: the payment sheet gains an optional rate in step 26 Phase 3, so step 26 does **not** hand payment conversion to step 27 (its option C, not chosen, would have). Step 26 D8-A and D11-A keep invoice settlement and FX residue in step 26. What remains are two **accepted gaps, confirmed 2026-09-21**: foreign payments recorded before 26 P3 are summed at rate 1 in `getReceiptPayment` and the pack (26 F6, 26-P8), and `bills.totals` / `billTotals` read a NULL bill rate as 1 (26 §7.4). No task here takes either, and no session should invent one.
