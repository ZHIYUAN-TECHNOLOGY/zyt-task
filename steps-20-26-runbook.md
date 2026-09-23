# Steps 20–26 Runbook: from plan to merged code

**For:** whoever implements SOP steps 20–26 (enter the job's fees → get them reviewed → group them into a bill → get the bill approved → issue the invoice → hand over the document → record the money and settle it)
**Written:** 2026-09-21 · **Base branch:** `feat/new-layout`, evidence HEAD `6bb3a1bf` · **Repo:** `nct-layout`
**Plan owner:** Wilfred. He settled the decisions (2026-09-21), and he merges the PRs, deploys, and runs anything that touches production.
**Readiness:** the plans' own scores — 20, 21, 22, 23, 25 and 26 at 7/10, 24 at 8/10 (§0). Every decision is settled.

This is how to turn the seven /planpro plans for steps 20–26 into merged code. It covers **Waves 17 to 21**, which continue the global numbering. Waves 1–4 are `steps-4-10-runbook.md`'s, Waves 5–11 are `steps-11-15-runbook.md`'s, and Waves 12–16 are `steps-16-19-runbook.md`'s.

Each wave runs in its own git worktrees, one Claude Code session per worktree, and no two sessions edit the same code at the same time.

**Every decision across steps 20–26 is settled.** On **2026-09-21** Wilfred took the recommended option of every per-plan decision, and accepted the recommended reading of every cross-plan item X28–X40, with no exception. Where an X-item overrides a plan's own recommendation, the X-item wins (§1). Each plan's §9 says which option is **Chosen**, and the crosscheck carries a **Settled** line per X-item. Sessions implement that option and do not re-open it.

---

## 0. What you are building

| Step | Plan file | What it fixes | Phases | Migration | Readiness |
|---|---|---|---|---|---|
| 20 | [`step-20-fee-entry-integrity.md`](/nct/step-20-plan/) | Expense Entry stores every fee at rate 1 and bypasses the no-rate switch. A stale save deletes fees added elsewhere. A blank or cleared name drops a fee silently. Locked and Cost-review-approved fees stay editable or deletable there. Receivables lose the client's company id, so their bills get no due date | 3 | none (no option in §9 needs one) | 7/10 |
| 21 | [`step-21-fee-review-integrity.md`](/nct/step-21-plan/) | Fee review binds. The `create_bill` gate sees the real selection and every open state. Fees under review, or approved and locked, cannot be changed, re-rated or deleted on any writer, the order fees page included. The legacy `costLines.review`/`reviewBatch` go. No self-approval of fees | 3 | none | 7/10 |
| 22 | [`step-22-bill-grouping-integrity.md`](/nct/step-22-plan/) | `createBill` skips the `create_bill` gate on the 全选 path. It can store a total that differs from its lines under a concurrent edit. It gives job-flow bills no company, so no due date. Also: the job page's link to Cost Detail carries no filter, and no screen offers split-by-order | 2 | none (D7-B would be an owner-run data UPDATE, not a migration) | 7/10 |
| 23 | [`step-23-bill-approval-integrity.md`](/nct/step-23-plan/) | Bill review protects invoicing but not the signed figure. This stops lines being removed, and bills being dissolved or re-titled, while under review. It stops an approved bill's total being rewritten, reopens courier/voucher entry after approval, and removes the legacy `bills.review`/`reviewBatch` side door | 3 | none | 7/10 |
| 24 | [`step-24-invoice-issue-integrity.md`](/nct/step-24-plan/) | `bills.invoice` ignores the dialog's Invoice Title. A typed number can 500 it or jam auto-numbering. It reads and locks bill-before-lines outside its transaction (unbill/verify races). It refuses the `written_off` bills the fee alert tells staff to invoice | 3 | none | 8/10 |
| 25 | [`step-25-invoice-document-truth.md`](/nct/step-25-plan/) | The document prints today's company term and a UTC date, and silently drops the buyer for Field-masked callers. The preview omits tax rate, qty, two totals and CANCELLED. Downloaded is a second call that errors for directors and viewers. The Active tile is always 0. Voiding a settled bill's invoice strands the bill, and the void reads lines unlocked | 2 | none (rejected D1-C would need `00NN_bill_due_date_invoice_anchor`) | 7/10 |
| 26 | [`step-26-settlement-integrity.md`](/nct/step-26-plan/) | Invented FX gains and losses on cross-currency settlements. One receipt spent twice, or one line settled twice, by concurrent verifies. Receipts settling payable bills. Voided-then-stuck payments that can never be corrected. Voids with no reason. Optional: a settled figure per invoice | 4 | none (conditional `00NN_…` under D4-C, D6-B, D6-C, D8-B, D10-C; §7) | 7/10 |

Every plan is also a page on this site — the file names above link to them.

<a class="rb-dl" href="/nct/downloads/all-plans.zip" download>⤓ Download all plans <small>every plan and crosscheck in the plans folder, plus the runbooks</small></a>

The smaller [steps-20-26-plans.zip](/nct/downloads/steps-20-26-plans.zip) in *Get the files* holds only what this runbook needs.

Under the settled options **no wave in this runbook migrates**. The conditional migrations, none of them chosen, are listed in §7.

Also read **[`steps-20-26-crosscheck.md`](/nct/steps-20-26-crosscheck/)**. It records how the seven plans depend on each other and on steps 02–19. It also records the thirteen cross-plan settlements X28–X40 and the merged probe list, and it is the source of the wave order in §3.

### Get the files

**Download everything this runbook needs:** [steps-20-26-plans.zip](/nct/downloads/steps-20-26-plans.zip). It holds this page's markdown, the seven step plans (20–26) and `steps-20-26-crosscheck.md`.

Unzip it to `C:/nct-plans/`. The prompts below use that path, so change them if yours differs. The zip is rebuilt on every site deploy, so re-download it if the pages have changed since. The prompts read the **Chosen** option from each plan's §9, so a copy from before the 2026-09-21 settlement is out of date.

The plans are **not in git**, so the zip (or the folder `C:\Project\ZYT-Task\plans\` from Wilfred) is the only way to get them.

The code repo `C:/Project/NCT/nct-layout` is the only place code changes, and only inside a worktree of it.

---

## 1. Before any wave starts: the settled decisions

**All settled on 2026-09-21.** Wilfred took the **Recommended** option of every per-plan decision below, and accepted the recommended reading of every cross-plan item, with no exception. This section is the record of what was chosen. Each plan's §9 marks the option **Chosen** (and each plan ends with a "Decisions settled (2026-09-21)" list); the crosscheck turns each item's Proposed line into a **Settled** line. Sessions implement the Chosen option and do not re-open it.

**Where an X-item overrides a plan's own recommendation, the X-item wins.** The plans were edited on 2026-09-21 to match:
- **X28** hands step 21 D1 to step 22 (22 D1-B), and delivers 21 D2-A through 22 D2-A plus `withdraw_pending`. 21's claim-verb `reviewFloorGate` is dropped. This decided what 22 P1 writes in Wave 17.
- **X29** narrows step 20 D6 to its option B (locks only). The approval half moves to step 21 D6-A. This decided what 20 P2 writes in Wave 18.
- **X30** keeps step 25 D7-A but flips its lock order to lines `(created_at, id)` → bills. Step 21 D10 and step 22 D2 lock lines by `(created_at, id)`, not `id`. This decided the lock order in Wave 17 (22 P1) and Wave 18 (26 P2).
- **X31** follows 24 D4-A. Step 25 D6-A is **superseded**: 25 P2 refuses nothing, and it merges and deploys after 24 P3.
- **X33** splits the architecture-test floor. 23 P3 lowers it; 21 P3 replaces it with an empty-list assertion.

A probe that contradicts a settled decision still stops its task for a re-plan (§8). That is a re-check, not an open decision.

### Cross-plan items (crosscheck §4)

| Id | Question | Settled (2026-09-21) | Implemented in |
|---|---|---|---|
| **X28** | Who writes `createBill`'s gate call, and is 21's claim-verb gate still needed? | **Step 22 P1** owns the body (resolved ids, locked read inside the transaction, every guard on locked rows). 21 P1 adds `withdraw_pending` only and drops `reviewFloorGate`. The gate test cases live in 22's `expense.create-bill.test.ts` | Wave 17 (22 P1), Wave 18 (21 P1) |
| **X29** | Who freezes approved fees on `saveChildren`, and in which order do 20 and 21 edit its cost leg? | 20 P1 → 20 P2 → 21 P2. **Step 21** owns every review-state freeze (under review and approved). 20 P2 keeps the lock freezes, the delete pin and the company id, and drops its `assertPostApprovalEditableMany` call. 21 computes "removed" from 20's `loadedCostIds` delete set | Wave 18 (20 P2) |
| **X30** | One lock order for issue, cancel, verify, void and unbill? | Payment (verify/void) → cost lines `ORDER BY created_at, id` → bill(s) `ORDER BY id`. 25 D7 takes this order (not bill → lines). Every `cost_line` `FOR UPDATE` in 21 and 22 orders by `(created_at, id)` too. Map `40P01` to CONFLICT | Wave 17 (22 P1), Wave 18 (26 P2), Wave 19 (24 P2), Wave 20 (25 P2) |
| **X31** | Step 24 D4-A makes a `written_off` bill invoiceable; does 25 D6-A still refuse the void? | 24 D4 was settled on A, so **25 D6 is superseded**: no settled-bill refusal, the confirm text says the bill can be invoiced again, and 25 P2 merges and deploys after 24 P3 | Wave 20 |
| X32 | 20 D10-A said "step 22 refuses a blank vendor at bill creation"; 22 plans no such refusal | **Accepted known gap.** 20 ships the warning only, and its copy promises no refusal. The step 22 follow-up (a `createBill` refusal) is not assigned; 20-P10 sizes it | Wave 18 (20 P3) |
| X33 | 21 P3 and 23 P3 both delete the last `applyReviewBatch` callers | 23 P3 first, lowering the `architecture.test.ts:1273` floor. 21 P3 empties `ALLOWED_INDIRECT_WRITES` and replaces the floor. 21 skips comment edits whose code 15 P2 or 23 P3 already deleted. `review-batch.ts` is deleted only if grep finds no importer and lint flags it | Wave 19 (23 P3), Wave 20 (21 P3) |
| X34 | Two `underReviewGate`s? | 23 P1's shared `underReviewGate(resourceType)` in `modules/governed/gates.ts`. 21 P2 uses it for `delete` and names its content-keys gate `costLineContentUnderReviewGate` | Wave 19 (21 P2) |
| X35 | Six plans add cases to `expense.concurrency.test.ts` | Each adds its own `it`/`describe` and never edits another's. Each PR pastes the failing and passing dev-branch runs, and each lock-changing PR re-runs every case in the file. 24's unbill fixture uses an org with no, or an editable, Bill flow | Wave 17 onward |
| X36 | `order.$orderId.expenses.tsx` passes through 20, 22 and 27 | 20's page edits in one lane → 22 P2 → step 27 | Wave 19 (22 P2) |
| X37 | 26 P3's new node `expense.payment.update` has no catalog row | **Owner-run `permission_node` INSERT** on step 13 D12-A's path: Wilfred runs it on dev before the Phase 3 proof, and on production after the deploy, before any grant to a custom role or member | Wave 19 (26 P3) |
| X38 | Migration placeholders | Unchanged rule (X14/X26): `00NN_<name>`, numbered at merge | any |
| X39 | SOP text for steps 20–26 has no owner | **Accepted unowned gap** (X13/X27 terms). A `/zyt-update` pass after a deploy stays available to Wilfred, but no wave is assigned it | none |
| X40 | The plans carry stale "no plan yet" and wave numbers | Record only (§12); sessions read the crosscheck, not those lines | none |

### Per-plan decisions (each plan's §9)

| Plan | Dn | Question | Chosen (2026-09-21) | Implemented in |
|---|---|---|---|---|
| 20 | D1 | How does a save avoid deleting fees the caller never saw? | A: optional `loadedCostIds`; delete only loaded-and-removed ids, keep and count unseen lines | Wave 17 |
| 20 | D2 | A fee still on screen was deleted elsewhere: what does Save do? | A: refuse with a reload sentence before any write | Wave 17 |
| 20 | D3 | What happens to a fee row with no name? | A: refuse rows with content or an id, naming the row; drop only untouched new rows | Wave 17 |
| 20 | D4 | How does a new fee get its exchange rate? | A: blank cell on new rows and copies; the page omits the key; the server seeds from the table | Wave 17 |
| 20 | D5 | Does the org switch 无汇率时费用可保存 apply to the order screens? | A: yes, as in `costLines.create`; otherwise return `unratedCurrencies` | Wave 17 |
| 20 | D11 | What does the FX banner check? | A: the server's `unratedCurrencies` after a save; before that, a client check against the reporting currency | Wave 17 |
| 20 | D12 | When does Phase 1 ship relative to step 15? | A: after 15 P1 (met by Wave 17); C, a web-only rate hotfix earlier, is worth taking if 20-P1 is large | Wave 17 |
| 20 | D6 | Which fee freezes does `saveChildren` honour? | **B (per X29): locks only** — the 0033 trigger's definition with a delete pin. The plan recommended A; the approval half moved to step 21 D6-A | Wave 18 |
| 20 | D7 | How does a fee keep the customer's company record? | A: stamp `order.client_company_id` on receivables named as the order's client; clear it when the name changes | Wave 18 |
| 20 | D8 | Fees already saved at rate 1 or without a company? | A: report only (20-P1, P2, P8) | none |
| 20 | D9 | Total typed directly (1 × 0 = 500)? | A: clear unit price when Total no longer equals quantity × unit price | Wave 18 (20 P3) |
| 20 | D10 | A payable saved with no vendor? | A (per X32): warn on the page only; the copy promises no refusal at billing | Wave 18 (20 P3) |
| 21 | D1 | What does `createBill`'s opt-in `create_bill` gate check? | **Handed to step 22 (per X28)**: the resolved ids, built by 22 D1-B | Wave 17 (via 22 D1) |
| 21 | D2 | What does the always-on J4 floor refuse, and where? | A (per X28): add `withdraw_pending`; the locked-row re-check comes from 22 D2-A, and no claim-verb gate | Wave 18 |
| 21 | D3 | What does the under-review freeze cover? | A: content writers (update with content keys, delete, batch delete, FX batch, `saveChildren` changes/removals); toggles stay open | Wave 19 |
| 21 | D4 | Can an approved, unbilled fee be deleted? | A: no under a locked flow; the message names the remedy | Wave 19 |
| 21 | D5 | What does Modify exchange rate do to a reviewed fee? | A: skip it and report it with a reason (`under_review` / `approved`) | Wave 19 |
| 21 | D6 | How does the order fees page treat a reviewed fee? | A (X29): refuse saves that change or remove it, naming the fees, with "removed" taken from step 20's `removable`; unchanged re-sends pass | Wave 19 |
| 21 | D10 | How are submit and save serialised on the three unlocked loads? | A (per X30): `FOR UPDATE` on `saveChildren`'s cost load, `batch` and `exchangeRateBatch`, ordered by `(created_at, id)` | Wave 19 |
| 21 | D11 | Does the fees page show which fees are under review or approved? | A: no UI change; the server refusal names the fees | Wave 19 |
| 21 | D7 | What happens to `costLines.review` / `reviewBatch`? | A: delete both and the writer `review` verb; keep the node with `isEndpoint: false` | Wave 20 |
| 21 | D8 | May a member decide a fee they submitted? | A: no, `separationOfDuties: true` on `cost_line` | Wave 20 |
| 21 | D9 | Residue from the holes? | A: read-only report only | Wave 20 |
| 22 | D1 | Which plan owns the gate-ids fix at `cost-lines.ts:2506`? | B: step 22 Task 1.1, with the transaction move (= X28) | Wave 17 |
| 22 | D2 | How does `createBill` make its guards and total match what it bills? | A (per X30): read lines `FOR UPDATE` inside the transaction, ordered by `(created_at, id)`, and run every guard and total on the locked rows | Wave 17 |
| 22 | D3 | Which company does a new bill point at? | A: the bucket's single id, else an exact-name company; refuse two ids; generic wording when the unit is a denied field | Wave 17 |
| 22 | D6 | `invoiceTitle` sent for a selection that makes several bills? | A: refuse with BAD_REQUEST before any write | Wave 17 |
| 22 | D4 | How does a job hand off to billing, and who owns it? | A: step 22; the fee-page link carries `orderId` + `status=bill_not_established`; the ledger gains an Order chip | Wave 19 |
| 22 | D5 | Default of **Also split by order**? | A: unticked | Wave 19 |
| 22 | D7 | Existing bills (bypass residue, stale totals, no company)? | A: report only | none |
| 23 | D1 | What freezes a bill's line set? | A: gates on the `retotal` verb, under review and after approval on non-editable flows | Wave 17 |
| 23 | D2 | Can a bill be dissolved under review or after approval? | A: refuse under review; allow after approval | Wave 17 |
| 23 | D3 | Are bill header fields frozen while under review? | A: freeze all of `bills.update` via `underReviewGate` | Wave 17 |
| 23 | D6 | Does submit lock the bill row? | A: `FOR UPDATE` in `bill.exists` | Wave 17 |
| 23 | D4 | Which bill fields stay writable after approval? | A: freeze `invoiceTitle`/`serviceFee`/`serviceFeeCurrency`/`exchangeRate` only; the dialog sends changed keys only | Wave 18 |
| 23 | D5 | Legacy `bills.review` / `bills.reviewBatch`? | A: delete both and the writer verb; drop `isEndpoint` on `expense.bill.review` | Wave 19 |
| 23 | D7 | May an accountant decide their own bill at stage 1? | C: leave `separationOfDuties` off; the director stage is the independent check | Wave 19 |
| 23 | D8 | Bills whose total already changed after approval? | A: report only (23-P4) | none |
| 24 | D1 | What does the dialog's Invoice Title write? | A: the typed title becomes this invoice's buyer; the bill title is untouched; a denied buyer/seller is stripped | Wave 18 |
| 24 | D2 | How are typed invoice numbers validated? | A: trim; refuse the generated `NCT-INV-YYYYMM-N` shape; map an `invoice_org_number_uq` clash to CONFLICT naming the number | Wave 18 |
| 24 | D6 | Who owns the credit check at invoicing? | A: step 02 Phase 1, as already planned | Wave 18 |
| 24 | D7 | Merge order against step 02 Phase 1? | A: 02 P1 first; 24 rebases and puts 02's exposure check after the locked re-read | Wave 18 |
| 24 | D9 | Amount prefill rounding? | A: the server's 6-dp denoise | Wave 18 |
| 24 | D3 | How is issuing serialised against unbill, verify and cancel? | A: re-read inside the transaction `FOR UPDATE`, lines then bills; widen the pins; `40P01` → CONFLICT (= X30) | Wave 19 |
| 24 | D4 | Can a `written_off` bill with an uninvoiced balance be invoiced? | A: yes; full coverage makes it `done`; the row icon is live (X31 builds on it) | Wave 20 |
| 24 | D5 | What does a Proforma do? | A: stays money-bearing; a dialog hint and an SOP note to cancel it before the tax invoice | Wave 20 |
| 24 | D8 | Historic rows F3 may have produced? | A: report only | none |
| 25 | D1 | Where does the printed payment term come from? | B: the bill's 0062 snapshot anchored on the invoice date, with the company's current term as a labelled fallback | Wave 17 |
| 25 | D2 | Covered bills with different terms on one invoice? | A: print the shortest term and warn in the preview | Wave 17 |
| 25 | D3 | A caller denied the buyer (Field axis)? | A: masked preview with a notice; `exportDocument` FORBIDDEN before the audit row | Wave 17 |
| 25 | D4 | Which calendar dates the invoice? | A: the owning branch's `team.timezone` via `calendarParts` | Wave 17 |
| 25 | D5 | Who records Downloaded? | A: the server, inside `exportDocument`, for `invoiceUpdate` holders; the web stops calling `markDownloaded` | Wave 17 |
| 25 | D8 | Thin buyer block (identity break)? | A: a preview warning; no fallback lookup via the order's client company | Wave 17 |
| 25 | D9 | How does the preview match the file? | A: a typed preview with the sheet's eight columns, both totals, CANCELLED, date only | Wave 17 |
| 25 | D10 | The always-zero Active (this page) tile? | A: Issued (this page) | Wave 17 |
| 25 | D6 | Voiding the invoice of a fully settled bill? | **Superseded under 24 D4-A (per X31)**: no refusal. The plan recommended A (refuse with CONFLICT) | Wave 20 |
| 25 | D7 | Void concurrency? | **A in the X30 order (per X30)**: lock and compute from the locked rows, keeping the same write statements; lines `(created_at, id)`, then bills, after the pinned invoice update. The plan had bill → lines | Wave 20 |
| 26 | D1 | How is the settlement exchange difference computed? | A: derive the payment's base rate; treat a NULL foreign bill rate as unknown; book nothing and say so when unknown | Wave 17 |
| 26 | D3 | Can a receipt settle a payable bill (and vice versa)? | A: refuse on the server and filter both pickers by side (26-P3 first) | Wave 17 |
| 26 | D9 | What does the Verify picker offer? | A: the payment's side only, minus settled bills and lines | Wave 17 |
| 26 | D4 | How are verify and void serialised? | A: `FOR UPDATE` on payment, lines and bill inside the transaction; recompute from locked rows; gate reads on `tx` | Wave 18 |
| 26 | D5 | Shared lock order with steps 24 and 25? | A: payment → cost lines `(created_at, id)` → bill everywhere (= X30) | Wave 18 |
| 26 | D2 | Does the payment sheet capture an exchange rate? | A: an optional field, shown only for a non-reporting currency, prefilled via `exchangeRates.suggest` (`write_off`) | Wave 19 |
| 26 | D6 | How is a settled-then-voided payment corrected? | A: `payments.update` while no live write-off exists (owner-run catalog row, X37) | Wave 19 |
| 26 | D7 | What does a void need? | A: a server-required reason, shown with Voided by on the list | Wave 19 |
| 26 | D8 | Answer "is this invoice paid?" | A: a derived settled figure per invoice on `invoices.list`, first-invoiced first (Phase 4 stays optional) | Wave 21 |
| 26 | D10 | Cross-currency void give-back crumb? | A: accept and flag | none |
| 26 | D11 | Residue already stored? | A: report only | none |

---

## 2. Why the waves are in this order

Seven plans write the same handful of money files. Collisions are handled by **ordering and a single owner**, never by resolving a merge by hand. Four overlaps decide the shape:

- **`createBill` has two authors.** Step 21 fixes its gate ids and adds a claim-verb gate. Step 22 rewrites the same lines inside a new locked transaction. X28 gives the body to 22, so **22 P1 (Wave 17) → 21 P1 (Wave 18)**.
- **`saveChildren`'s cost leg has two authors.** Step 20 changes which fees a save deletes and freezes. Step 21 adds a review freeze to the same block. X29 orders them **20 P1 → 20 P2 → 21 P2** (Waves 17, 18, 19) and gives the approval freeze to 21.
- **The ledger lock order has three authors.** Steps 24 and 26 lock lines before the bill; step 25 locks the bill first. X30 makes it one order before any of them locks anything.
- **A void's refusal hung on an issue rule.** Under X31 (24 D4-A Chosen), 25 P2 drops the refusal and follows 24 P3 (both Wave 20, 24 first).

The binding edges, from the crosscheck §1–§2 and each plan's §7.6:

| Shared code | Writers | Handled by |
|---|---|---|
| `routers/collective-order.ts` `saveChildren` cost leg | 15 P1 (long merged); 20 Tasks 1.1–1.2, 2.1–2.2; 21 Task 2.3 | 20 P1 (W17) → 20 P2 (W18) → 21 P2 (W19). **X29** |
| `routers/expense/cost-lines.ts` `createBill` | 21 Task 1.1; 22 Tasks 1.1–1.3 | 22 P1 (W17) → 21 P1 (W18). **X28** |
| `cost-lines.ts` writer verbs, `batch`, `exchangeRateBatch`, `review`/`reviewBatch` | 21 Phases 2–3; 23 Task 1.2 (comment in `unbill` only) | 21 P1 → P2 → P3 in one worktree; 23's comment is a different function |
| `routers/expense/bills.ts` | 23 (billWriter verbs; `review`/`reviewBatch`); 24 (`invoice`); 21 Task 3.1 (a comment inside `bills.review`'s docblock) | 23 P1 → 23 P2 → 23 P3 and 02 P1 → 24 P1 → P2 → P3, interleaved by wave with 23 first in each shared wave. X33 for 21's comment |
| `apps/web/src/routes/_next/expenses/bills.tsx`, `-bills.columns.tsx` | 23 P2/P3 (`BillEditDialog`, comments `:795-813`); 24 P1/P3 (`InvoicingDialog`, icon `:826`) | 23 first in each wave; 24 rebases |
| `routers/expense/invoices.ts`, `invoices.tsx` | 25 P1, P2; 26 P4 | 25 P1 (W17) → 25 P2 (W20) → 26 P4 (W21) |
| `routers/expense/write-offs.ts` | 26 only | 26 P1 → P2 → P3; 24 P3 relies on `:694` and `:1124`, which 26 keeps |
| `routers/expense.concurrency.test.ts` | 21 P1, 21 P2, 22 P1, 24 P2, 25 P2, 26 P2 | **X35**: own `it`/`describe` each; the second in a wave rebases |
| `packages/api/src/architecture.test.ts` | 20, 21, 23, 24, 25 (and 15, 18 earlier) | Entries are line-independent. **X33** for the indirect-write floor |
| `modules/expense/permissions.ts` | 21 P3, 23 P3, 26 P3 | Neighbouring blocks; 23 P3 → 26 P3 (W19) → 21 P3 (W20). **X37** for 26's catalog row |
| `modules/audit/resources.ts` | 23 P1 (`bill.exists`), 21 P3 (`cost_line`) | Neighbouring entries; wave order |
| `apps/web/src/routes/_next/order.$orderId.expenses.tsx` | 20 (all phases); 22 P2 (link `:928`); step 27 (a mount prop) | **X36**: 20 → 22 P2 → 27 |

**Why five lanes.** In Waves 17–19 each lane's primary write set is disjoint (checked against each plan's §6). Every file two lanes share in one wave is a different function or a different `describe`, and the merge order puts the earlier half first:
- step 20 writes the order fees path;
- step 22 writes `createBill`;
- step 23 writes the bill's review side;
- step 24 writes `bills.invoice`;
- step 25 writes the invoice document;
- step 26 writes write-offs and payments.

Step 21 follows once 22's `createBill` and 20's cost leg are in, because it edits both.

---

## 3. The waves at a glance

```
              Wave 17    Wave 18        Wave 19    Wave 20    Wave 21
wt-step20     20 P1      20 P2 → P3
wt-step22     22 P1                     22 P2
wt-step23     23 P1      23 P2          23 P3
wt-step25     25 P1                                25 P2
wt-step26     26 P1      26 P2          26 P3                 26 P4 (optional)
wt-step21                21 P1          21 P2      21 P3
wt-step24                24 P1          24 P2      24 P3
```

| Wave | Starts when | Runs in parallel | Merge order in the wave | Settled decisions the wave implements (2026-09-21) | Probes Wilfred runs first | Deploy notes |
|---|---|---|---|---|---|---|
| **17** | all of Wave 16 (step 17 P2) merged | `wt-step20`: 20 Phase 1 · `wt-step22`: 22 Phase 1 · `wt-step23`: 23 Phase 1 · `wt-step25`: 25 Phase 1 · `wt-step26`: 26 Phase 1 | 23 P1 → 22 P1 → 26 P1 → 25 P1 → 20 P1 | **X28, X30**, X35; 20 D1–D5, D11, D12 (A); 22 D1-B, D2-A (X30 order), D3-A, D6-A; 23 D1–D3, D6 (A); 25 D1-B, D2–D5 A, D8–D10 A; 26 D1, D3, D9 (A) | **22-P1 before 22 Task 1.1; 22-P4, 22-P5 before 22 Task 1.2; 26-P3 before 26 Task 1.2; 25-P1, P3, P4, P6, P7 before 25 Phase 1**; 20-P3, 23-P2, 23-P4 before those release notes | 20 P1: server first. 22 P1, 23 P1: API only; announce "request withdrawal before changing a bill" (23). 25 P1: **API before web**. 26 P1: API first. Build `apps/web` before every deploy |
| **18** | Wave 17 merged | `wt-step20`: 20 Phase 2 then Phase 3 (one session, two PRs) · `wt-step21`: 21 Phase 1 · `wt-step23`: 23 Phase 2 · `wt-step24`: 24 Phase 1 · `wt-step26`: 26 Phase 2 | 23 P2 → 24 P1 → 21 P1 → 26 P2 → 20 P2 → 20 P3 | **X29**, X30 (26 P2), X32; 20 D6-B (X29), D7–D9 A, D10-A (X32); 21 D1 (handed to 22, X28), D2-A; 23 D4-A; 24 D1, D2, D6, D7, D9 (A); 26 D4-A, D5-A | **23-P8 before 23 Phase 2; 24-P2 before 24 Task 1.2 ships**; 20-P6, 20-P7, 20-P8, 21-P1, 21-P2, 21-P11, 26-P2, 26-P7 for the PRs and release notes | 20 P2: API only (2.4 is web, either order). 20 P3: web only. 21 P1: API only. 23 P2: **API and web together**. 24 P1: server first or together. 26 P2: server only |
| **19** | Wave 18 merged | `wt-step21`: 21 Phase 2 · `wt-step22`: 22 Phase 2 · `wt-step23`: 23 Phase 3 · `wt-step24`: 24 Phase 2 · `wt-step26`: 26 Phase 3 | 23 P3 → 24 P2 → 21 P2 → 26 P3 → 22 P2 | X33, X34, X36, X37; 21 D3–D6, D10 (X30 order), D11 (A); 22 D4-A, D5-A; 23 D5-A, D7-C; 24 D3-A; 26 D2, D6, D7 (A) | **21-P5, 21-P6, 21-P7 before 21 Task 2.3; 22-P6 before 22 Task 2.2; 23-P6, 23-P7 before 23 Phase 3**; 23-P9 (re-check of 23 D7-C); 21-P2 for the notice; 26-P4, 26-P5 | 21 P2: API before web; announce **"withdraw before editing a fee"**. 22 P2: web only. 23 P3: API only (`/rpc/bills/review` 404). 24 P2: server only. 26 P3: **web and API together**, plus the X37 catalog row |
| **20** | Wave 19 merged | `wt-step21`: 21 Phase 3 · `wt-step24`: 24 Phase 3 · `wt-step25`: 25 Phase 2 | 24 P3 → 25 P2 → 21 P3 | **X31**; 21 D7–D9 (A); 24 D4-A, D5-A; 25 D6 superseded (X31), D7-A (X30 order) | **21-P3 before 21 Task 3.1; 21-P8, 21-P9 before 21 Task 3.2; 25-P8, 25-P9 before 25 Task 2.1; 24-P6 before the 24 P3 deploy** | 24 P3: server before web; accounting gets the 24-P6 list first. **25 P2: only after 24 P3 is deployed** (X31). 21 P3: API only (`/rpc/costLines/review` 404) |
| **21** (optional) | Wave 20 merged | `wt-step26`: 26 Phase 4 | 26 P4 | 26 D8-A (the phase stays optional) | 26-P10 | API first |

**Faster alternative, Wilfred's call only.** No 20–26 phase needs a step 16–19 phase (crosscheck §1). Their only shared files are neighbouring entries in `modules/audit/resources.ts` and `architecture.test.ts`, and a different function of `collective-order.ts`. So Wave 17 could start after Wave 11 and run beside Waves 12–16, at the cost of rebasing over them. This runbook keeps one start line after Wave 16. A session does not move itself earlier.

---

## 4. One-time setup

In your main `nct-layout` checkout, before a wave starts:

```bash
git fetch origin
git switch feat/new-layout
git pull --ff-only
```

Create a wave's worktrees **when that wave starts**, so each branches from the latest base.

```bash
# from the nct-layout folder

# Wave 17
git worktree add ../wt-step20 -b feat/step20-fee-entry-integrity      origin/feat/new-layout
git worktree add ../wt-step22 -b feat/step22-bill-grouping-integrity  origin/feat/new-layout
git worktree add ../wt-step23 -b feat/step23-bill-approval-integrity  origin/feat/new-layout
git worktree add ../wt-step25 -b feat/step25-invoice-document-truth   origin/feat/new-layout
git worktree add ../wt-step26 -b feat/step26-settlement-integrity     origin/feat/new-layout

# Wave 18
git worktree add ../wt-step21 -b feat/step21-fee-review-integrity     origin/feat/new-layout
git worktree add ../wt-step24 -b feat/step24-invoice-issue-integrity  origin/feat/new-layout
```

Then run `bun install` inside **each** new worktree, and start `claude` there in its own terminal.

> A worktree is an extra folder on its own branch that shares one git history. Each Claude session gets its own folder, so no session can overwrite another's edits or sweep them into its commit.

Which worktree carries which phases:
- `wt-step20`: Phases 1–3 across Waves 17–18.
- `wt-step21`: Phases 1–3 across Waves 18–20.
- `wt-step22`: Phases 1–2 across Waves 17 and 19.
- `wt-step23`: Phases 1–3 across Waves 17–19.
- `wt-step24`: Phases 1–3 across Waves 18–20.
- `wt-step25`: Phases 1–2 across Waves 17 and 20.
- `wt-step26`: Phases 1–4 across Waves 17–19 and 21.

Each phase is its own commit range and its own PR; rebase between them (§6). Only one session commits in a worktree at a time: confirm the index is empty before `git add`.

**The main checkout is not on the base branch.** At the time of writing `C:/Project/NCT/nct-layout` sits on `feat/intake-golden-path-e2e` at `ea1560e7`, e2e-only commits past `6bb3a1bf`. Worktrees branch from `origin/feat/new-layout`, so those specs are invisible to every session unless they have merged. Wilfred decides what happens to them; **no session stashes, resets or checks out anything, in any worktree, for any reason.** Every §10 walk re-reads `ACTORS` in `e2e/fixtures/seed-cli.ts` by symbol at its own base commit.

**Five parallel sessions, one set of dev ports.** Waves 17–19 run five worktrees at once, but only one worktree's dev servers (`:3101` web, `:3000` API) can run at a time. Sessions that reach their browser proof queue for the ports (§10).

---

## 5. The prompt for each session

Paste one of these into the session in the matching worktree. They follow one template:
- read the plan and the crosscheck;
- name the phases;
- name the settled decisions (Wilfred, 2026-09-21) and implement the Chosen option, without re-opening it;
- re-locate by symbol;
- prove it with §10, and stop.

### Wave 17 — `wt-step20`

```text
Read C:/nct-plans/step-20-fee-entry-integrity.md in full, and C:/nct-plans/steps-20-26-crosscheck.md.
Implement PHASE 1 ONLY (Tasks 1.1-1.6). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-A, D2-A, D3-A, D4-A, D5-A, D11-A, D12-A) — implement the Chosen
option and do not re-open it. Before the release note, ask me for probe 20-P3 (orgs that start being refused).
Before you start: grep saveChildren in routers/collective-order.ts for step 15's .for("update") on the order
load. If it is there, do not add a second one; if it is absent, stop and tell me (step 15 Phase 1 should have
merged in Wave 7).
Keep the delete set exactly as §4.3 defines it (removable = loaded AND not kept). Step 21 Phase 2 will build its
review freeze on that set (crosscheck X29), so name it `removable` and do not fold it into another expression.
The plan was read at 6bb3a1bf and steps 11-19 have moved every line: re-locate saveChildren, costLineExtras,
needsSeed, copyAcross, loadedChildrenForRef and the allow-list block BY SYMBOL at HEAD, never by line.
Prove it with the plan's §10: the Phase 1 test list, then the golden path steps 1-5 and edge cases 1, 2 (two
tabs), 3 and 5 in the browser at localhost:3101. Read test and type-check output for "failed"; exit codes lie.
Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project bill-build` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 17 — `wt-step22`

```text
Read C:/nct-plans/step-22-bill-grouping-integrity.md in full, and C:/nct-plans/steps-20-26-crosscheck.md.
Implement PHASE 1 ONLY (Tasks 1.1-1.4). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-B, D2-A in the X30 order, D3-A, D6-A; crosscheck X28 and X30
settled) — implement the Chosen option and do not re-open it. Before Task 1.1 ask me for probe 22-P1; before
Task 1.2 for 22-P4 and 22-P5. A contradiction stops that task for a re-plan.
Under X28 (settled), THIS phase owns the whole createBill body: the gate on the resolved costLineIds and on
tx, the locked read inside the transaction, and every guard on the locked rows. Step 21 Phase 1 later adds only
withdraw_pending to the J4 set. Put the create_bill gate cases in expense.create-bill.test.ts [NEW].
Under X30, the locked read orders by (created_at, id), not by id, and a 40P01 maps to a CONFLICT sentence.
Before you start: grep cost-lines.ts for step 15's expense_entry gate in costLines.create and keep it; your
handler is a different function.
The plan was read at 6bb3a1bf: re-locate createBill, the claim verb, resolveCostLineSelection and
loadManyScoped BY SYMBOL at HEAD.
CI has no DATABASE_URL_TEST: run the two new expense.concurrency.test.ts cases against the dev Neon branch, and
paste the failing run on the unfixed handler and the passing run into the PR. "Skipped" is not a pass.
Prove it with the plan's §10: the Phase 1 test list, then Journeys 1 and 2 and edge cases 2 and 4 in the
browser at localhost:3101. Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project bill-build` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 17 — `wt-step23`

```text
Read C:/nct-plans/step-23-bill-approval-integrity.md in full, and C:/nct-plans/steps-20-26-crosscheck.md.
Implement PHASE 1 ONLY (Tasks 1.1-1.5). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-A, D2-A, D3-A, D6-A) — implement the Chosen option and do not
re-open it. Before the release note, ask me for probes 23-P2 and 23-P4; if 23-P4 shows retotal after approval is
routine, stop and re-plan D1.
Task 1.1's underReviewGate(resourceType) in modules/governed/gates.ts is the shared gate (crosscheck X34);
export it under exactly that name. Step 21 Phase 2 will import it.
Before you start: confirm step 08 Phases 1-3 are on the base (separationOfDuties in modules/audit/resources.ts,
the optional message on assertPostApprovalEditable). If the message option is missing, use the generic
sentence and say so in the PR, as §5 allows.
In cost-lines.ts you edit only the delete_fee comment inside costLines.unbill; step 22 Phase 1 is rewriting
createBill in the same file in this wave and merges after you.
The plan was read at 6bb3a1bf: re-locate billWriter's update/retotal/dissolve verbs, bill.exists,
costLines.unbill and the gates BY SYMBOL at HEAD.
CI has no DATABASE_URL_TEST: run expense.bill-review.concurrency.test.ts [NEW] on the dev Neon branch, and paste
the failing run without Task 1.3 and the passing run into the PR.
Prove it with the plan's §10: the Phase 1 test list, the golden path steps 1-8, and edge cases 1, 2, 3, 4 and 5
in the browser at localhost:3101. Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project bill-build` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 17 — `wt-step25`

```text
Read C:/nct-plans/step-25-invoice-document-truth.md in full, and C:/nct-plans/steps-20-26-crosscheck.md.
Implement PHASE 1 ONLY (Tasks 1.1-1.5). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-B, D2-A, D3-A, D4-A, D5-A, D8-A, D9-A, D10-A) — implement the
Chosen option and do not re-open it. Before Phase 1, ask me for probes 25-P1, 25-P3, 25-P4, 25-P6 and 25-P7.
Do not touch invoices.cancel. It is Phase 2 (Wave 20), and its lock order (X30) and its dropped refusal (X31)
belong to that phase.
Keep buildInvoiceDocument pure (no IO, no clock). New input fields are optional, and new output fields are
additive; step 11 Phase 3's case in invoice-document.test.ts must still pass.
The plan was read at 6bb3a1bf: re-locate loadInvoiceDocument, resolveTerms, resolveBuyer, isoDate,
exportDocument and InvoiceDocumentPreview BY SYMBOL at HEAD.
Deploy note for the PR: API before web (D5-A).
Prove it with the plan's §10: the Phase 1 test list, then Journeys 1 and 2 and edge cases 1-3 in the browser at
localhost:3101. Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project invoice-close` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 17 — `wt-step26`

```text
Read C:/nct-plans/step-26-settlement-integrity.md in full, and C:/nct-plans/steps-20-26-crosscheck.md.
Implement PHASE 1 ONLY (Tasks 1.1-1.4). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-A, D3-A, D9-A) — implement the Chosen option and do not re-open
it. Before Task 1.2, ask me for probe 26-P3: if any org shows live wrong-side write-offs with
payment_way = 'reconciliation', stop — D3 is re-planned, not worked around.
Keep write-offs.ts :694 (written_off vs done) and :1124 (done -> invoiced) exactly as they are; step 24 Phase 3
relies on both. Add no locks in this phase; they are Phase 2 and follow crosscheck X30.
The plan was read at 6bb3a1bf: re-locate writeOffs.verify, the FX block, attributeForDirection and
VerifyDialog BY SYMBOL at HEAD.
Prove it with the plan's §10: the Phase 1 tests, then the golden path (Journey 1 without the Phase 3 rate row)
and edge cases 1 and 4 in the browser at localhost:3101. Never run git stash, git reset or git checkout. Never
point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project invoice-close` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 18 — `wt-step20` (rebase first, see §6)

```text
Read C:/nct-plans/step-20-fee-entry-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 1 is merged.
Implement PHASE 2 (Tasks 2.1-2.4), open its PR, then PHASE 3 (Tasks 3.1-3.2) as a second PR. Stop at Phase 3's
acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: Phase 2 D6-B per X29 (locks only), D7-A, D8-A; Phase 3 D9-A, D10-A
per X32 (warning only); crosscheck X29 and X32 settled) — implement the Chosen option and do not re-open it.
Under X29: Task 2.1 adds the lock freezes (settled, locked_at, rec_pay_locked_at), the split
messages, the locked-line edit refusal and the DELETE pin, but NOT the assertPostApprovalEditableMany call.
Step 21 Phase 2 owns every review-state freeze on this path. Drop the approved-line cases from Task 2.3, and do
not lift the inline changedKeys comparator (step 21 lifts it).
Under X32: the no-vendor warning must not say that billing will refuse; no plan adds that refusal.
Task 2.4 and Tasks 3.1-3.2 are the page's only edits in this track until step 22 Phase 2; keep them in this lane.
Re-locate saveChildren, isSettled, patch and the allow-list comment BY SYMBOL at HEAD.
Prove it with the plan's §10: edge case 4 (the lock half), golden path step 6 and the Phase 2 test list, then
edge cases 6 and 7 for Phase 3. Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project bill-build` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 18 — `wt-step21`

```text
Read C:/nct-plans/step-21-fee-review-integrity.md in full, and C:/nct-plans/steps-20-26-crosscheck.md.
Implement PHASE 1 ONLY. Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1 handed to step 22 per X28; D2-A, delivered by 22 D2-A plus
withdraw_pending) — implement the Chosen option and do not re-open it.
Under X28, step 22 Phase 1 already moved createBill's read, guards and gate call inside a locked
transaction with the resolved ids. Grep createBill for assertGatesCleared(tx, … costLineIds, "create_bill") and
for the in-transaction .for("update") read. If either is missing, stop: the prerequisite has not landed.
Your Task 1.1 is then ONLY: add withdraw_pending to the J4 set and rewrite the J4 comment. Do NOT add
reviewFloorGate to the claim verb. In Task 1.2, keep case 3 (withdraw_pending) and the real-Postgres
submit-vs-createBill interleave, which must now pass through step 22's lock. Drop cases 1, 2 and 4; they live in
step 22's expense.create-bill.test.ts.
The plan was read at 6bb3a1bf: re-locate createBill, the J4 block and the claim verb BY SYMBOL at HEAD.
CI has no DATABASE_URL_TEST: run the interleave on the dev Neon branch and paste its output (its name listed,
not skipped). Prove it with the plan's §10: Journey 3 and edge case 1 in the browser at localhost:3101.
Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project bill-build` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 18 — `wt-step23` (rebase first)

```text
Read C:/nct-plans/step-23-bill-approval-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 1 is merged.
Implement PHASE 2 ONLY (Tasks 2.1-2.3). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D4-A) — implement the Chosen option and do not re-open it. Before
Phase 2, ask me for probe 23-P8.
You merge BEFORE step 24 Phase 1 in this wave: it edits InvoicingDialog in the same bills.tsx and the invoice
procedure in the same bills.ts. Touch only BillEditDialog and the update verb's gate list.
Re-locate the update verb, BillEditDialog and the -bills.columns.tsx comment BY SYMBOL at HEAD.
Deploy note for the PR: API and web together, web built first (§7.2 of the plan).
Prove it with the plan's §10 Journey 3, including the network-panel check that bills/update carries only the
changed keys. Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project bill-build` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 18 — `wt-step24`

```text
Read C:/nct-plans/step-24-invoice-issue-integrity.md in full, and C:/nct-plans/steps-20-26-crosscheck.md.
Implement PHASE 1 ONLY (Tasks 1.1-1.4). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-A, D2-A, D6-A, D7-A, D9-A) — implement the Chosen option and do
not re-open it. Before Task 1.2 ships, ask me for probe 24-P2 (jam candidates).
Before you start: grep billsRouter.invoice for creditOverrideReason (step 02 Phase 1, D7-A). If it is absent,
stop and tell me. If it is present, keep its input, its exposure re-check and its dialog notice.
Step 23 Phase 2 merges before you in this wave and edits BillEditDialog in the same bills.tsx; touch only
InvoicingDialog. Add no locks in this phase; they are Phase 2.
The plan was read at 6bb3a1bf: re-locate billsRouter.invoice, makeNo, InvoicingDialog and the rbac describe BY
SYMBOL at HEAD.
Prove it with the plan's §10: the golden path (Journey 1) and edge cases 1, 2 and 6 in the browser at
localhost:3101. Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project invoice-close` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 18 — `wt-step26` (rebase first)

```text
Read C:/nct-plans/step-26-settlement-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 1 is merged.
Implement PHASE 2 ONLY (Tasks 2.1-2.4). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D4-A, D5-A = X30; crosscheck X30 settled) — implement the Chosen
option and do not re-open it.
Under X30: payment FOR UPDATE, then the bill's cost lines ORDER BY created_at, id FOR UPDATE, then the bill,
in both verify and reverse. Map 40P01 to a CONFLICT sentence.
Before you start: grep REVIEWABLE_RESOURCES.bill.exists for .for("update") (step 23 Phase 1). If it is absent,
stop and tell me.
Add your four cases as your own describe block in expense.concurrency.test.ts (X35); do not edit anyone else's.
Re-run every case already in that file.
The plan was read at 6bb3a1bf: re-locate verify, reverse and the gate calls BY SYMBOL at HEAD.
CI has no DATABASE_URL_TEST: run 20 repetitions on the dev Neon branch, and paste cases 1-2 failing on Phase 1's
handler plus all four passing into the PR. Prove it with the plan's §10 edge case 3 (two tabs, a smoke check).
Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project invoice-close` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 19 — `wt-step21` (rebase first)

```text
Read C:/nct-plans/step-21-fee-review-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 1 is merged,
and step 20 Phases 2-3 are merged.
Implement PHASE 2 ONLY (Tasks 2.1-2.5). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D3-A, D4-A, D5-A, D6-A per X29, D10-A in the X30 order, D11-A;
crosscheck X29, X30 and X34 settled) — implement the Chosen option and do not re-open it. Before Task 2.3, ask me for probes 21-P5, 21-P6 and 21-P7; if they show that changing
reviewed fees is routine work, stop for a re-plan of D4/D6.
Under X29, you own the approved AND the under-review freeze on saveChildren. Compute "removed" from step 20's
`removable` (loaded and not kept), never from existing minus kept, or an approved fee added elsewhere after
page load would be refused as removed. Lift changedKeys with no behaviour change.
Under X34, import underReviewGate from modules/governed/gates.ts (step 23) for the delete verb. Name your
content-keys gate costLineContentUnderReviewGate.
Under X30, every cost_line FOR UPDATE you add orders by (created_at, id).
Re-locate saveChildren, the writer verbs, batch, exchangeRateBatch and describeSkipped BY SYMBOL at HEAD.
CI has no DATABASE_URL_TEST: run the saveChildren interleave on the dev Neon branch, and paste the failing run
without the cost-row lock and the passing run. Prove it with the plan's §10 Journeys 1 and 2 and edge case 3 in
the browser at localhost:3101. Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project bill-build` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 19 — `wt-step22` (rebase first)

```text
Read C:/nct-plans/step-22-bill-grouping-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 1 is
merged, and step 20 Phase 3 is merged.
Implement PHASE 2 ONLY (Tasks 2.1-2.3). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D4-A, D5-A; crosscheck X36 settled) — implement the Chosen option
and do not re-open it. Before Task 2.2, ask me for probe 22-P6.
Crosscheck X36: step 20 has finished with order.$orderId.expenses.tsx; you change only the Cost Detail link.
Grep apps/web/src for the link sentence before touching any copy.
Re-locate the link, the chip list, CreateBillDialog and the CostLine interface BY SYMBOL at HEAD.
This phase is web only. Prove it with the plan's §10 Journey 3 and edge case 1, plus the web test and
cost-lines.control-row.spec.ts. Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project bill-build` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 19 — `wt-step23` (rebase first)

```text
Read C:/nct-plans/step-23-bill-approval-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 2 is merged.
Implement PHASE 3 ONLY (Tasks 3.1-3.3; Task 3.4 is not done, because D7 is Chosen as C). Stop at its
acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D5-A, D7-C; crosscheck X33 settled) — implement the Chosen option and
do not re-open it. Before Phase 3, ask me for probes 23-P6, 23-P7 and 23-P9 (a re-check of D7-C).
Before you start: confirm collectiveOrderRouter.review / reviewBatch and the architecture.test.ts :876 entry are
gone (step 15 Phase 2). If not, stop.
Under X33 you merge before step 21 Phase 3: removing the billsRouter.reviewBatch entry drops the
"no helper receives a money table" count. In the same commit, lower the floor to the count that remains, with a
comment naming X33. Re-count at the base commit; do not guess.
Step 26 Phase 3 edits the neighbouring block of modules/expense/permissions.ts later in this wave.
Re-locate the procedures, the writer review verb, the allow-list entry and the permissions block BY SYMBOL at HEAD.
Prove it with the plan's §10 edge case 6 (the 404) and the Journey 4 golden path, plus registry.sync, reachability
and both architecture tests. Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project bill-build` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 19 — `wt-step24` (rebase first)

```text
Read C:/nct-plans/step-24-invoice-issue-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 1 is merged.
Implement PHASE 2 ONLY (Tasks 2.1-2.3). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D3-A = X30; crosscheck X30 and X35 settled) — implement the Chosen
option and do not re-open it.
Under X30: lock cost lines ORDER BY created_at, id FOR UPDATE, then bills ORDER BY id FOR UPDATE, inside the
transaction. Move step 02's exposure re-check after the locked re-read and keep its tests green.
Under X35, the issue-vs-unbill fixture must use an org with no Bill flow, or one with "Can edit after approval".
Since step 23 Phase 1, retotal refuses an unbill on an approved bill under the seeded flow, so the race would
never run. Say which you used in the test's docblock. Add your cases as your own its; re-run every case in the file.
The plan was read at 6bb3a1bf: re-locate billsRouter.invoice BY SYMBOL at HEAD.
CI has no DATABASE_URL_TEST: run the three races 20 times each on the dev Neon branch and paste the output.
Prove it with the plan's §10 edge case 5 and an unchanged Journey 1 in the browser at localhost:3101.
Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project invoice-close` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 19 — `wt-step26` (rebase first)

```text
Read C:/nct-plans/step-26-settlement-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 2 is merged.
Implement PHASE 3 ONLY (Tasks 3.1-3.6). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D2-A, D6-A, D7-A; crosscheck X37 settled as an owner-run catalog
INSERT) — implement the Chosen option and do not re-open it.
Under X37, the new node expense.payment.update needs a permission_node catalog row before it can be granted to
a custom role or member. That row is an owner-run INSERT (step 13 D12-A's path), not a migration and not seed
code. First read the expense.payment.create row's shape, then hand me the exact INSERT to run on dev BEFORE the
Phase 3 proof. Do not run it yourself.
Step 23 Phase 3 edited the neighbouring block of modules/expense/permissions.ts earlier in this wave; rebase and
run registry.sync and reachability.
Every writeOffsRouter.reverse test caller must pass a reason: grep and count them (16 plus any new).
Key PaymentFormSheet on the payment id, and reseed it only on open.
Re-locate paymentWriter, payments.create, reverse, PaymentFormSheet and the write-offs ConfirmDialog BY SYMBOL at HEAD.
Deploy note for the PR: web and API together.
Prove it with the plan's §10 edge case 2 (Journeys 4 and 5) in the browser at localhost:3101.
Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project invoice-close` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 20 — `wt-step21` (rebase first)

```text
Read C:/nct-plans/step-21-fee-review-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 2 is merged,
and step 23 Phase 3 is merged.
Implement PHASE 3 ONLY (Tasks 3.1-3.5). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D7-A, D8-A, D9-A; crosscheck X33 settled) — implement the Chosen
option and do not re-open it. Before Task 3.1 ask me for 21-P3; before
Task 3.2 for 21-P8 and 21-P9. A contradiction stops that task for a re-plan.
Before you start: grep modules/audit/resources.ts for separationOfDuties (step 08 Phase 2). If it is absent, stop.
Under X33, you remove the LAST ALLOWED_INDIRECT_WRITES entry. Replace the count floor with an assertion that the
list is empty and that the scanner still runs, and delete routers/expense/review-batch.ts only if grep -rn
"review-batch" finds no importer and lint flags it (X33). Skip the comment edits at collective-order.ts:3471,
collective-order.guards.test.ts:508 and bills.ts:1189 wherever step 15 or step 23 already deleted the code
around them. Say which ones in the commit message.
Run the drift script read-only on the dev branch only, and paste its counts.
Re-locate every procedure, allow-list entry and permissions block BY SYMBOL at HEAD.
Prove it with the plan's §10 Journey 4 and edge case 2, plus the e2e specs in Task 3.5.
Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project bill-build` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 20 — `wt-step24` (rebase first; merges before 25 P2)

```text
Read C:/nct-plans/step-24-invoice-issue-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 2 is merged.
Implement PHASE 3 ONLY (Tasks 3.1-3.4). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D4-A, which X31 builds on, and D5-A) — implement the Chosen option
and do not re-open it.
Before the PR, ask me for probe 24-P6. Accounting must see that list (and 25-P8's subset, crosscheck X31) before
this phase deploys.
Step 25 Phase 2 merges right after you. Under X31, its confirm text promises that a voided invoice's bill can be
invoiced again, which is only true once your Phase 3 is deployed. Say so in the PR's deploy note: server before
web, and before 25 P2.
Re-run step 26's write-off tests: write-offs.ts :694 and :1124 must still read as your plan assumes.
Re-locate billsRouter.invoice, the -bills.columns.tsx icon and InvoicingDialog BY SYMBOL at HEAD.
Prove it with the plan's §10 edge cases 3 and 4 and the cancel regression check.
Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project invoice-close` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 20 — `wt-step25` (rebase first; merges after 24 P3)

```text
Read C:/nct-plans/step-25-invoice-document-truth.md and C:/nct-plans/steps-20-26-crosscheck.md. Phase 1 is merged,
and step 24 Phase 3 is merged.
Implement PHASE 2 ONLY (Tasks 2.1-2.4). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D6 superseded under step 24 D4-A per X31; D7-A in the X30 lock
order) — implement the Chosen option and do not re-open it. Before Task 2.1, ask me for 25-P8 and 25-P9.
Under X30, lock the cost lines ORDER BY created_at, id FOR UPDATE, then the covered bills ORDER BY id FOR UPDATE,
after the pinned invoice update, and map 40P01 to CONFLICT. The plan's §4.6 now says so (the old bill-then-lines
reading was true only before step 24 Phase 2). Keep the same six raw
write statements, so the architecture allow-list is unchanged.
Under X31 (24 D4-A Chosen), there is NO settled-bill refusal. Task 2.2 case (a): cancel on a done bill
succeeds, the bill reads written_off, and bills.invoice re-issues to done. The confirm text says the bill can be
invoiced again. The plan's Tasks 2.1, 2.2 and 2.4 already carry this.
Re-locate invoices.cancel and the confirm dialog BY SYMBOL at HEAD.
CI has no DATABASE_URL_TEST: run the interleave on the dev Neon branch, and paste the failing run without the
locks and the passing run. Prove it with the plan's §10 Journey 3 (as amended by X31) in the browser at
localhost:3101. Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project invoice-close` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

### Wave 21 — `wt-step26` (optional; rebase first)

```text
Read C:/nct-plans/step-26-settlement-integrity.md and C:/nct-plans/steps-20-26-crosscheck.md. Phases 1-3 are
merged, and step 25 Phase 2 is merged.
Implement PHASE 4 ONLY (Tasks 4.1-4.2). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D8-A, a derived settled figure per invoice) — implement the Chosen
option and do not re-open it. This phase stays optional: run it only when Wilfred starts Wave 21.
You edit only invoices.list and one column of invoices.tsx; step 25 owns the rest of both files.
Re-locate invoices.list and the invoices.tsx columns BY SYMBOL at HEAD.
Prove it with the plan's §10 edge case 5 in the browser at localhost:3101.
Never run git stash, git reset or git checkout. Never point anything at production.
Before the PR: run the golden path that covers your step — `npx playwright test --config e2e/playwright.config.ts --project invoice-close` — and update its assertions to your step's new behaviour. The journey for your step is the spec whose header lists it; e2e/README.md 'Adding a golden path' has the rules. Never run two golden paths at once (each needs ports 3000/3101 and seeds a throwaway org on the dev branch), and no golden path may ever press Send on a quotation or invoice.
```

> If the session has the `/execute` skill, `/execute C:/nct-plans/step-2N-….md` works too. Tell it the phases in the same words, and repeat the "decisions are settled — implement the Chosen option and do not re-open it", "re-locate by symbol" and "never stash, reset or checkout" lines.

---

## 6. Keeping a branch up to date

Before a branch's PR is merged, bring it up to date with whatever merged ahead of it. Do this inside its worktree:

```bash
git fetch origin
git rebase origin/feat/new-layout
bun install
bun run check-types
git push --force-with-lease
```

Do the same **between phases in a shared worktree** (every worktree here carries two to four phases): rebase onto the base that now contains the merged earlier phase, and start the next phase's session only after `bun run check-types` is clean.

**If the rebase stops on a conflict:** resolve it by hand, `git add <file>`, then `git rebase --continue`. If you're unsure which side is right, `git rebase --abort` puts the branch back exactly as it was. Then ask.

**Never use `git stash`, `git reset` or `git checkout -- <path>`**, in any session, for any reason. The stash stack is shared by every worktree and every session on the machine.

After every rebase, re-run `packages/api/src/architecture.test.ts` and `apps/web/src/architecture.test.ts`. Allow-list comments collide even when the entries do not, the stale-entry rule fails in both directions, and X33 moves the indirect-write floor twice.

Five sessions share `expense.concurrency.test.ts` across Waves 17–20 (X35). If your rebase brings in another plan's case, run the whole file on the dev branch again before pushing.

---

## 7. Migrations: numbers are assigned at merge

**Under the settled options, no phase in Waves 17–21 adds a migration.** The plans carry conditional ones, and none was chosen:

| Plan | Conditional migration | State |
|---|---|---|
| 25 | `00NN_bill_due_date_invoice_anchor` under D1-C | Not chosen (D1-B); the 0062 trigger refuses to move a set due date |
| 26 | `00NN_payment_void` under D6-B | Not chosen (D6-A) |
| 26 | `00NN_write_off_payment_set_null` under D6-C | Not chosen (D6-A); voided write-offs would lose their payment's currency |
| 26 | `00NN_write_off_invoice` under D8-B | Not chosen (D8-A) |
| 26 | `00NN_write_off_payment_amount` under D10-C | Not chosen (D10-A; a migration for a millionth) |
| 26 | `00NN_written_off_within_amount` under D4-C | Not chosen (D4-A); would turn a race into a 500 on live data |
| 20, 21, 22, 23, 24 | none | No option in their registers needs one |

**Rule (X38, as X14 and X26): if a migrating option is ever revived, the migration is written `00NN_<name>` and takes the next free number at the moment its branch is rebased for merge**, exactly as `steps-4-10-runbook.md` §6 describes. A step that picks a migrating option becomes the only migrating step in its wave, and its migration must pass all three gates: tags equal files, contiguous idx, and the PGlite chain replay (`bunx vp test run packages/db/src/migrations.test.ts`).

**One owner-run database write is needed** under the settled options (X37, settled 2026-09-21), and no session runs it without Wilfred's explicit yes:
- **Step 26 Phase 3 (X37)** adds the permission node `expense.payment.update`. `db:seed-nodes` is in no pipeline and cannot run under bun (step 13 Phase 0), so the catalog row goes in by a reviewed `INSERT … SELECT … FROM permission_node WHERE key = 'expense.payment.create' ON CONFLICT (key) DO NOTHING`, with the label equal to the registry label. It runs on dev before the Phase 3 proof, and on production after the deploy and before any grant to a custom role or member. Root holders reach the node without the row. Confirm with the read-only `SELECT key, parent_key, is_endpoint FROM permission_node WHERE key = 'expense.payment.update'`.

The data repairs some plans list as options (20 D8-B, 22 D7-B, 24 D8-B, 26 D11-B) were not chosen: all four decisions settled on A, report only. Each would be its own owner-run, reviewed script.

Before each phase, confirm the journal still ends where the merged steps left it (at HEAD `6bb3a1bf` it ends at idx 64, `0065_quotation_send_decision`, before steps 01–10's reservations). Read `packages/db/src/migrations/meta/_journal.json` **and** the migrations table — never a command's exit code. Steps 22 and 25 also rely on `0062_payment_terms_due_date.sql` being applied on the dev database.

---

## 8. Stop gates: owner only

Every probe is a read-only `SELECT` against production, and **Wilfred runs all of them with the owner's override.** No session connects to production, ever. The full SQL lives in each plan's §7.7.

**Run the probes for a wave before the code is written, not before the merge.** Several of them gate a specific task, and a probe that contradicts its decision stops that task for a re-plan rather than being argued away. The decisions are settled (§1), so a probe no longer chooses an option: it confirms the Chosen one, and a contradiction stops that task for a re-plan.

| Wave | Probe | Question | Gates |
|---|---|---|---|
| 17 | **22-P1** | Orgs that tick **Create bill** on Cost review | **Before 22 Task 1.1** (the release note). = 21-P1's gates column |
| 17 | **22-P4** | Bills with no company; how many D3-A would resolve; bills with no due date | **Before 22 Task 1.2** (D3). ⊃ 20-P9 |
| 17 | **22-P5** | Bills whose lines name two companies | **Before 22 Task 1.2** (D3) |
| 17 | **26-P3** | Live wrong-side write-offs, by payment way | **Before 26 Task 1.2** (D3; re-plan to B on `reconciliation` use) |
| 17 | **25-P1, P3, P4, P6, P7** | Moved terms; mixed terms; UTC-day misdates; buyer-masked roles; exported-not-marked | **Before 25 Phase 1** (D1, D2, D4, D3, D5) |
| 17 | 20-P3 | Orgs with `fee_savable_without_rate = false` | **Before the 20 P1 release note** (who starts being refused) |
| 17 | 23-P2, 23-P4 | Live bills by submission; totals rewritten under review or after approval | **Before the 23 P1 release note**; re-open D1 if routine |
| 17 | 20-P1, P2, P4; 23-P1; 26-P1; 25-P5 | Rate-1 exposure; fees deleted by stale saves; bill flows; invented FX; name-only buyers | Sizing for the PRs and release notes |
| 18 | **23-P8** | Approved bills missing courier/voucher numbers | **Before 23 Phase 2** (D4) |
| 18 | **24-P2** | Generated-shape invoice numbers at or ahead of the counter | **Before 24 Task 1.2 ships**; any rows go to accounting |
| 18 | 20-P5, P6, P7, P8, P10 | Lump-sum lines; locked unbilled fees; approved order fees; receivables without a company; blank vendors | 20 D9, D6, D7, D10, X32 |
| 18 | 21-P1, 21-P2, 21-P11 | Cost review flows; fees by submission vs cache; bills with never-approved lines in gated orgs | 21 D1, D2 urgency. 21-P11 = 22-P2 |
| 18 | 24-P1; 26-P2, 26-P7 | Invoice-number shapes; over-spent receipts; bills that never advanced | Sizing |
| 19 | **21-P5, 21-P6, 21-P7** | FX edits, edits/deletes and fees-page saves on reviewed fees | **Before 21 Task 2.3**: routine use stops the task for a re-plan of D4/D6 |
| 19 | **22-P6** | Bills spanning several orders | **Before 22 Task 2.2** (D5) |
| 19 | **23-P6, 23-P7** | Legacy bill-review verb use; cache drift | **Before 23 Phase 3** (D5) |
| 19 | 23-P9 | Stage-1 self-decisions; accountants per org | **Before 23 Phase 3** (re-check of D7-C). Second query = 21-P9's |
| 19 | 21-P2 (re-run) | Fees under review today | The 21 P2 "withdraw before editing" notice |
| 19 | 24-P3, P4, P5, P10; 26-P4, P5, P8 | Issue-race residue; stuck payments; voids with no reason; foreign payments at rate 1 | Sizing; 26-P8 is an accepted gap (old payments at rate 1 stay as stored, confirmed 2026-09-21 with step 27) |
| 19 | X37-chk | The `expense.payment.update` catalog row exists | Read-only check after the owner-run INSERT |
| 20 | **21-P3** | Legacy `expense.costLine.review` use and self-approval | **Before 21 Task 3.1** (D7) |
| 20 | **21-P8, 21-P9** | Engine self-decisions on fees; submitters by role; accountants per org | **Before 21 Task 3.2** (D8) |
| 20 | **25-P8, 25-P9** | Bills stranded by a void; bills whose invoiced total disagrees | **Before 25 Task 2.1** (D6 under X31, D7) |
| 20 | **24-P6** | `written_off` bills with an uninvoiced balance | **Before the 24 P3 deploy**; accounting told first (X31: report 25-P8 as its subset) |
| 20 | 24-P7; 21-P4, 21-P10 | Categories in use; orphan fee submissions; billed fees still open or rejected | 24 D5; 21 D9 report |
| 21 | 26-P10 | Issued invoices whose bills carry live settlements | 26 D8 |

**Duplicates — run once, report under both ids.**
- 21-P11 = 22-P2.
- 22-P1 = 21-P1's gates column.
- 24-P8 and 26-P6 = 23-P1's gates column.
- 20-P9 ⊂ 22-P4.
- 24-P4 ⊂ 25-P9.
- The second query of 21-P9 = the second query of 23-P9.
- 20-P7 is 21-P1 plus 21-P2 restricted to order fees.
- 25-P8 ⊂ 24-P6, both read in Wave 20.

Do not ask Wilfred for the same reading twice in one wave.

**Sizing probes that gate nothing** (20-P1, 20-P2, 20-P4, 20-P5, 22-P3, 22-P7, 24-P9, 25-P2, 25-P5, 26-P1, 26-P9, 26-P10) can be run at any point. They belong in the PR description and the release note, not in front of the code. 25-P2 matters only if D1-C is reconsidered.

Message template, one per wave:

```text
Wave <N> (<step and phases>) is ready to start. Before any code, can you run these read-only production
probes with the owner's override and send me the counts?

  <id> — <one-line question> — from <plan file> §7.7
  <id> — <one-line question> — from <plan file> §7.7

<id> gates <task>: if it contradicts <decision>, I stop and we re-plan rather than work around it.
The decisions this wave implements are settled (Wilfred, 2026-09-21): <plan Dn, crosscheck Xnn>.
Nothing here writes; they are SELECTs only. I will not run anything against production myself.
```

**Deploying is separate from merging, and is Wilfred's call.** The per-wave deploy notes are in §3. The couplings that bite:
- **25 P1 API before web.**
- **23 P2 and 26 P3 web and API together.**
- **24 P3 server before web**, with accounting told first.
- **25 P2 only after 24 P3 is deployed.**

Build `apps/web` before every deploy so a failed deploy does not split the stage.

---

## 9. Checklist before each PR

Run inside the worktree once its session says it is done:

- [ ] The phase implemented the option marked **Chosen** in its plan's §9 and the **Settled** reading of every X-item it relied on (all settled 2026-09-21), and re-opened none of them. A probe that contradicted one stopped the task for a re-plan instead.
- [ ] `bun run check-types`: **read the output.** It can exit 0 while printing "failed". Confirm `apps/web` and `seed` actually ran.
- [ ] `bun run test`, and the phase's own test command from the plan's §10: read each output for `failed`, not the exit code.
- [ ] If the phase touched `packages/api`: `packages/api/src/architecture.test.ts` passes. A green from `apps/web/src/architecture.test.ts` is a different gate; run both. Re-run them after every rebase.
- [ ] If the phase touched permissions (21 P3, 23 P3, 26 P3): `permissions/registry.sync.test.ts` and `permissions/reachability.test.ts` pass.
- [ ] **Real-Postgres concurrency tests: paste the output into the PR (X35).** CI has no `DATABASE_URL_TEST`, so these never run there, and a `skipped` line is **not** a pass. Each PR that adds a case shows two pasted runs against the **dev Neon branch**: the failing run on the pre-change code and the passing run after.
  - `expense.concurrency.test.ts`: 21 P1, 21 P2, 22 P1, 24 P2, 25 P2, 26 P2.
  - `expense.bill-review.concurrency.test.ts`: 23 P1.
  - A PR that changes a lock (22 P1, 24 P2, 25 P2, 26 P2) also re-runs every case already in the file.
- [ ] Drift script (21 Task 3.4): run read-only on the dev branch and paste the counts; production is Wilfred's.
- [ ] Owner-run writes (26 P3's catalog row, X37): the exact statement is in the PR, and Wilfred's yes is recorded before it ran on dev.
- [ ] Migrations: none is expected in this track (§7). If one was revived, it is named `00NN_<name>`, took the next free number at rebase, and `bunx vp test run packages/db/src/migrations.test.ts` passes.
- [ ] Shared copy: every sentence the phase changed was grepped across the worktree (e.g. "Fees saved", "cannot be removed here", "is not invoiceable", "Active (this page)", "Its bill reverts to Open", "Void write-off"), per the project rule.
- [ ] The plan's §10 walked in the browser at `localhost:3101`, **one worktree's dev servers at a time** (§10).
- [ ] Every hunk read in `git diff origin/feat/new-layout...HEAD`, not just the file list.
- [ ] Commit, push, open the PR:

```bash
git add -A
git commit -m "fix(expense): <what> (SOP step 2N phase N)"   # fix(order) for step 20
git push -u origin <branch>
gh pr create --base feat/new-layout --fill
```

Then ask Wilfred to merge, **in the order in §3**.

**Close the loop.** After each merge, tick the fixed defects on the SOP page (*When a Customer Comes In*) under the step's *What to fix first*, and paste the PR link as a comment.

---

## 10. Traps in this repo

| What you see | Why | Do this |
|---|---|---|
| The browser shows another step's changes | Every worktree's app wants `:3101` (web) and `:3000` (API), and five worktrees are live at once | Stop every dev server, then start only the worktree you're checking |
| An API change "doesn't work" but returns 200 | `bun --hot` doesn't reload `packages/api` changes | Restart the API server before any browser check, and check its start time |
| Type-check "passed" but the log says failed | `vp run` exit codes lie | Grep the output for `failed` and `error TS` |
| A concurrency test reports `skipped` and the PR calls it green | `DATABASE_URL_TEST` is set in no workflow | Run it on the dev Neon branch and paste both runs (X35) |
| A PGlite lock test passes on the old code too | PGlite is one connection: any second query waits on an open transaction whether or not a lock was taken | Don't write that test. Prove locks on real Postgres |
| A concurrency test judged by `submitted_at` or `created_at` | Both default to transaction start | Judge by the HTTP result and the final row state |
| A deadlock 500 between two money writers | Two handlers locked the same lines in different orders | X30: payment → lines `(created_at, id)` → bill, everywhere; map `40P01` to CONFLICT |
| 24's issue-vs-unbill race never produces a race | After 23 P1, `retotal` refuses an unbill on an approved bill under the seeded flow | Use an org with no Bill flow, or an editable one (X35), and say so in the test |
| Two plans both freeze approved fees on the order fees page | Steps 20 and 21 each planned it before the settlement | X29: step 21 owns review state; step 20 owns locks (20 D6-B) |
| Two plans both edit `createBill`'s gate line | Steps 21 and 22 each planned it | X28: step 22 owns the body; step 21 adds `withdraw_pending` only |
| An approved fee added elsewhere is refused as "removed" on the order page | 21's freeze computed "removed" as `existing − kept` | Use step 20's `removable` (loaded and removed), X29 |
| The architecture test fails on the indirect-write floor | `ALLOWED_INDIRECT_WRITES` shrinks from three entries to none across 15 P2, 23 P3 and 21 P3, and `:1273` asserts at least 2 | X33: 23 P3 lowers the floor; 21 P3 replaces it |
| The architecture test fails right after a correct change | The stale-entry rule fires in both directions | Commit each allow-list key change in the same commit as its code, and re-run after every rebase |
| A comment the plan says to edit is not there | 15 P2 deleted `collectiveOrder.review` and its guards tests; 23 P3 deletes `bills.review` | Skip it and say so in the commit (X33) |
| The new payment permission can't be granted to a custom role | No `permission_node` catalog row; `db:seed-nodes` cannot run under bun | The owner-run INSERT (X37); root holders work without it |
| Every void is refused after 26 P3 deploys | An old page sends `reverse({ id })` with no reason | Deploy web with or before the API |
| The void confirm promises a re-issue that fails | 25 P2 deployed before 24 P3 | 25 P2 only after 24 P3 is deployed (X31) |
| The invoice preview shows a different term after 25 P1 | Correct: the bill's 0062 snapshot, not today's company term | Release note to accounting with 25-P1/P4 counts |
| Due dates suddenly appear on new bills | 22 P1 resolves the bill's company | Intended; mention it in the release note (the Overdue chip starts seeing them) |
| The order fees page's link opens the whole ledger | 22 P2 has not merged | X36 order: 20 → 22 P2 |
| The browser checks another org's data | One login is shared across sessions, and whoever switches org last redirects everyone | Confirm the actor with `fetch('/api/auth/get-session')` and the active org before each step |
| A pane screenshot is solid white | Pane screenshots can return blank while the DOM is fine | Assert on the DOM (`read_page`, `get_page_text`), not the screenshot |
| A fixed console error still shows after reload | The pane's console buffer survives reload | Confirm in a new tab |
| Every line number in the plan is wrong | Steps 08–19 rewrote the same routers after the plans were read, and 20–26 rewrite them again | Re-locate by symbol at HEAD. The plans' line numbers were read at `6bb3a1bf` and are historical |
| The e2e fixtures look different from the plan | The main checkout carries e2e-only commits past `6bb3a1bf` on another branch | Never stash, reset or checkout. Re-read `ACTORS` by symbol at your base commit |
| The session can't find the plan | Plans aren't in git | Give it the absolute path to your downloaded copy under `C:/nct-plans/` |

**Accepted gaps, stated plainly (settled 2026-09-21).** No plan in 20–26 closes these, and no session should invent a fix:
- **A payable with no vendor still bills to nobody (X32).** 20 P3 warns on the page; `createBill` does not refuse. A step 22 follow-up is not assigned.
- **Old foreign payments stay at rate 1, and `bills.totals`/`billTotals` read a NULL bill rate as 1** (26 F6; confirmed 2026-09-21 with step 27's settlement). 26 P3 lets new payments carry a rate; step 27 restates no FX booked before 26 P1 (26 D11-A).
- **SOP text for steps 20–26 (X39).** Each plan lists what is wrong in its §9 "SOP text vs code" and edits nothing.
- **A cancelled invoice re-rendered later reads today's bill and company** (25 Risks). Freezing the buyer at issue needs a column; no plan takes it.
- **Existing residue** (rate-1 fees, id-less bills, invented FX, over-settlements, stranded bills): every plan reports only (20 D8, 21 D9, 22 D7, 23 D8, 24 D8, 26 D11).

---

## 11. Clean up

Only once a branch is merged **and** `git status` in its worktree is clean:

```bash
# from the nct-layout folder
git worktree remove ../wt-step20
git branch -d feat/step20-fee-entry-integrity
```

Keep, until their last phase has merged:

- **`wt-step20`** — through Wave 18 (Phase 3).
- **`wt-step21`** — through Wave 20 (Phase 3). Do not remove it after Wave 18 or Wave 19.
- **`wt-step22`** — through Wave 19 (Phase 2). It sits idle in Wave 18; keep it.
- **`wt-step23`** — through Wave 19 (Phase 3).
- **`wt-step24`** — through Wave 20 (Phase 3).
- **`wt-step25`** — through Wave 20 (Phase 2). It sits idle in Waves 18–19; keep it.
- **`wt-step26`** — through Wave 21 (Phase 4), or Wave 19 if Wilfred does not run the optional Phase 4.

---

## 12. Where the plans and the crosscheck disagree

These are the places where `steps-20-26-crosscheck.md` and a plan did not say the same thing, or where a plan is out of date about another plan. **Every crosscheck item was settled on 2026-09-21**, and in the same pass the plans were edited to carry each settlement, so most rows below are now **resolved**: the plan agrees with the crosscheck. The "plan said" column keeps the drafted text for the record. Rows marked **stale (X40)** were left in the plans on purpose; sessions follow the crosscheck there.

| Subject | Crosscheck (settled) | The plan said (as drafted) | Reading used here |
|---|---|---|---|
| Owner of `createBill`'s gate fix | X28: step 22 P1 owns the body | **21 Task 1.1** and §7.6: 21 P1 before 22, "22 must keep … the claim gate". **22 D1-B**: step 22 owns it | **Settled: step 22.** 21 P1 adds `withdraw_pending` only. Resolved: 21 D1 reads "handed to step 22 (X28)", 21 Task 1.1 and §7.6 say 22 P1 → 21 P1 |
| 21's claim-verb gate | X28: redundant once 22 locks the lines inside the transaction | **21 D2-A**: re-check J4 on the locked row in a `claim` gate | **Settled: dropped.** 21's real-Postgres interleave stays and must pass through 22's lock. Resolved in 21 §4.1 and Task 1.2 |
| Who freezes approved fees on `saveChildren` | X29: step 21 | **20 D6-A** and Task 2.1: `assertPostApprovalEditableMany(…, "cost_line", touched)`. **21 D6-A**: `costLineReviewFreezes`. **20 §4.4**: "step 21 adds `assertNoneUnderReview` beside it" | **Settled: step 21.** 20 D6 is Chosen as B (locks only); 20's Journey 5 step 2 and edge case 4's approved half moved to 21 §10 Journey 2. Resolved in both plans |
| What 21 counts as "removed" | X29: step 20's `removable` (loaded and not kept) | **21 §4.3**: `existing.filter((r) => !keep.has(r.id) && freezes.has(r.id))` | 20's set; otherwise an unseen approved fee is refused. Resolved in 21 §4.3 and Task 2.3 |
| Lock order for cancel | X30: lines `(created_at, id)` → bills | **25 D7-A, §4.6**: bill then lines by id, "the same order `bills.invoice` takes". **24 D3-A**: lines then bills. **26 D5-A**: lines then bill, "step 25 changes its cancel order". **25 §7.6**: asks 26 to take bill then lines | **Settled: lines first.** 25's description of `bills.invoice` was true at HEAD, not after 24 P2. Resolved: 25 D7 is Chosen as A in the X30 order, and its §4.6 and §7.6 say so |
| Line order key in 21 and 22 | X30: `(created_at, id)` | **21 D10-A** and **22 D2-A**: ordered by `id` | **Settled: `(created_at, id)`**, because `saveChildren` and `exchangeRateBatch` also lock billed lines. Resolved in both plans |
| Re-invoicing a `written_off` bill | X31: 24 D4-A governs; 25 D6 superseded | **25 D6-A**: refuse the void. **25 D6-B** (rejected there) is 24 D4-A. **24 D4-A**: invoiceable, ends `done` | **Settled: 24's.** 25 P2 drops the refusal and fixes the confirm text, after 24 P3. Resolved: 25 D6 reads "superseded under 24 D4-A (X31)" |
| Blank vendor at bill creation | X32: accepted gap | **20 D10-A**: "step 22 refuses at bill creation"; 20 §1 Out of scope names it as step 22's. **22**: no such task | **Settled: gap.** 20's warning promises nothing. Resolved: 20 D10 and §1 record the gap, and 22's Risks records it too |
| The indirect-write floor | X33: 23 P3 lowers it, 21 P3 replaces it | **21 §4.5**: the `>= 2` floor "must still hold". **23**: does not mention it | It cannot hold after 15 P2 plus one more removal. Resolved: 23 Task 3.1 lowers it, and 21 Task 3.1 replaces it. **23's new value is re-counted at the base commit**, not written into the plan |
| 21's comment targets | X33: skip those already deleted | **21 §4.5, Task 3.1**: edit `collective-order.ts:3471`, `collective-order.guards.test.ts:508`, `bills.ts:1189` | `:3471` and `:508` sit inside code 15 P2 deletes; `:1189` inside code 23 P3 deletes. Skip them. Resolved in 21 Task 3.1 |
| Two `underReviewGate`s | X34: 23's shared gate | **21 §4.3**: a local `underReviewGate` and `underReviewOnDeleteGate` in `cost-lines.ts`. **23 Task 1.1**: exported `underReviewGate(resourceType)` | 23's for delete; 21's content-keys gate renamed `costLineContentUnderReviewGate`. Resolved in 21 §4.3 and Task 2.2 |
| 26's new permission node | X37: owner-run catalog row | **26 §4.4**: the node and verb, no catalog step | X37. Resolved: 26 §4.4, Task 3.1 and its Phase 3 gates carry the owner-run INSERT |
| `40P01` in `createBill` | X30 names 24, 25 and 26 | **22** now maps it for `createBill` too (added 2026-09-21) | Harmless and consistent. A deadlock miss is a retry sentence, never a 500 |
| Waves for step 20 | 20 P1 in Wave 17; 20 P2 and P3 in Wave 18 | **20 §7.6**: "Wave 12 = 20 P1, Wave 13 = 20 P2 (+ 20 P3)"; **D12-A**: "Wave 12 in §7.6" | **Stale (X40).** Waves 12–16 belong to steps 16–19; use this runbook's numbers. 20 §7.6 now adds a pointer to Wave 17/18 |
| 20 vs 21 order | 20 P1 → 20 P2 → 21 P2 | **21 §7.6**: "21 P1 → (20 if it edits the cost leg) → 21 P2"; 21 §7.8 defers it to "the steps 16–27 crosscheck". **20 §7.6**: "Step 21 goes after step 20 Phase 2" | Agreed; this crosscheck is the one 21 means. 21 §7.6 now states 20 P1 → 20 P2 → 21 P2; §7.8's wording is stale (X40) |
| 22 vs 20 order | 20 P1 ∥ 22 P1 (Wave 17); 22 P2 after 20 P3 | **22 §7.6**: "21 (if D1-A) → 22 P1 → 20 → 22 P2". **20 §7.6**: "Either order" for 22 | Disjoint files in P1; X36 for the page. Resolved: 22 §7.6 now reads 22 P1 → 21 P1 (X28), 20 P3 → 22 P2 (X36) |
| 23's worry about 22 and `bill.exists` | 22 does not touch `bill.exists` | **23 §7.6**: "If 22 adds a state check to `bill.exists`, it must keep Task 1.3's lock" | Moot. **Stale (X40)** |
| 23's worry about 26 and `exchangeRate` | 26 writes no `bill.exchange_rate` | **23 D4, Risks**: "if step 26 needs to set `exchangeRate` after approval, it must re-open D4" | Moot; 23 D4-A stands. **Stale (X40)**; 23 D4's Chosen line notes it does not arise |
| 24's issue-vs-unbill fixture | X35: an org with no or an editable Bill flow | **24 Task 2.2**: a two-line bill, no mention of 23's `retotal` freeze | X35's fixture, stated in the test docblock. Resolved: 24 Task 2.2 and §10 edge case 5 name it (an org with no Bill flow) |
| 26 P2's prerequisite | 23 P1 merged | **26 §7.6**: same | Agreed (Wave 17 → Wave 18) |
| 24's prerequisite on step 02 | 02 P1 merged (`steps-1-3-runbook.md`) | **24 D7-A**: 02 P1 first | The Wave 18 prompt greps for `creditOverrideReason` and stops if absent |
| Plans that "cannot see" each other | All seven plans exist, and step 27 has its own plan and runbook | **22, 23, 24, 25** §7.6 and readiness lines call steps 20–27 "no plan yet" or "written in parallel"; **26 §7.6** listed step 27 as "no plan yet" | **Stale (X40)**, left in 22–25. 26 §7.6 and 22 §7.6's step 27 rows were corrected on 2026-09-21 (step 27 planned; 22's export mount is `cost-lines.tsx:2239`, not `:1944`) |
| Readiness | Not re-scored at settlement | 20–23, 25, 26: 7/10; 24: 8/10 | The plans' scores (§0). They are now limited by unrun probes and by the real-Postgres proofs, not by open decisions |

---

## 13. Not covered here

- **Steps 01–19.** `steps-1-3-runbook.md`, `steps-4-10-runbook.md` (Waves 1–4), `steps-11-15-runbook.md` (Waves 5–11) and `steps-16-19-runbook.md` (Waves 12–16). This runbook's Wave 17 starts only after Wave 16. Step 02 Phase 1 (credit at invoicing), which step 24 builds on, is in `steps-1-3-runbook.md`.
- **Step 27** (close the month). `plans/step-27-month-close-truth.md` exists and is sequenced in its own runbook, not here. It edits one prop each in `order.$orderId.expenses.tsx` and `cost-lines.tsx` after steps 20 and 22 (X36). It reads the due dates 22 P1 starts producing, the FX figures 26 P1 stops inventing, and the payment rates 26 P3 lets staff capture (26-P8 is its hand-off).
- **Decisions not planned as work.** 20 D7-B (a vendor company picker), 22 adjacent defects (archived lines billable, no 全选 preview), 24's case-insensitive invoice numbers (24-P9), 25's buyer-freeze-at-issue column, 26 D8-B (settling against an invoice), and red reversal (红冲).
- **Adjacent defects each plan flags and does not plan** (each plan's Phase 0 "Adjacent" list): the unenforced `fee_rate_editable` / `fee_rate_follows_table` switches (20), engine decide on a locked fee (21), submit accepting a non-open bill (23), and the Invoicing icon on unapproved bills (23/24).
- **Repairing live data.** Every plan reports residue only (§10 accepted gaps). Any repair script is a separate owner decision with its own review.
- **SOP text for steps 20–26** (X39) and the SOP site itself. The site is public; Wilfred rebuilds and deploys it from `hosting/`, including the `steps-20-26-plans.zip` bundle and the plan and crosscheck pages this runbook links to.
- **Production access of any kind.** Every probe, every owner-run write and every deploy is Wilfred's. Sessions work against the dev Neon branch, and never against `br-round-sun`.
