# Step 11 — only a quotation that was not lost becomes a job, once, with its number and its breakdown

**SOP step:** 11 "Convert the won quote into a job" · `/quotations/$quotationId` → header → **Convert to order** → lands on `/order/$orderId/edit`
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-16. This is the same commit steps 04–10 were planned at. Every `file:line` below was located by symbol at that HEAD.
**Tier:** Standard. Phase 1 is a small guard in a money-minting handler. Phase 2 moves a shared allocator between files and changes an architecture-test allow-list. Phase 3 changes the quote→ledger mapper used by two writers. No migration unless D3 picks B or C.
**Additions 2026-09-17 (from `steps-12-15-crosscheck.md` X11 and X14, Wilfred accepted the recommendations):** Task 2.4's re-stamp predicate is widened to `order_no = quotation_no OR order_no IS NULL`, locked-but-unbilled lines included (step 12 D2-A and D8-A); conditional migration placeholders read `00NN_<name>`, numbered at merge. Settled decisions D1–D9 are unchanged.
**Owns cross-plan item:** **X5** (`steps-4-10-crosscheck.md`: "`convertToOrder` never checks for Won, so a Lost quotation converts"). Step 10 deferred it here as X5 option B (`step-10-decision-correction.md` §9, "Settlements that span plans").

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`). Drizzle schema in `packages/db/src/schema`, migrations in `packages/db/src/migrations`. TanStack Router file routes in `apps/web/src/routes/_next`. zod on both sides. vitest on PGlite (`pushTestSchema`).
- **The conversion path.** `quotationsRouter.convertToOrder` is at `packages/api/src/routers/quotation.ts:3887`, gated `requireNode(QUOTATION.convert)` (`:3888`; node key `quotation.convert`, `modules/quotation/permissions.ts:24`). In order, it:
  1. does a scoped load **outside any transaction** (`:3892-3897`);
  2. checks the flow's `convert_order` gate (`:3908`, `assertGateCleared` in `modules/audit/gates.ts:146`; ticked by the seeded quotation flow, `modules/audit/seed.ts:71`);
  3. checks "no order yet" against `collective_order.quotation_id`, **also outside the transaction** (`:3919-3932`);
  4. refuses a retired trade (`:3952-3956`);
  5. opens the transaction (`:3969`) and **inserts `collective_order` directly** (`:3971-4010`);
  6. copies containers (`:4013-4022`);
  7. carries non-"if any" selling lines through `mapFeeLineToCostLine` (`:4059-4100`) and attaches any orderless ledger rows for the same fee lines (`:4118-4174`);
  8. sets `quotation.status = 'converted'` (`:4180-4183`) and writes `quotation.convertToOrder` to `audit_log` (`:4185-4200`).
- **X5 is real, confirmed in source.** Nothing between `:3887` and `:3969` reads `status`, `decidedAt` or any decision column. The only state checks are the approval gate, the existing order and the trade. The web button agrees: it renders on `auditStatus === "approved" && !convertedOrderId` (`apps/web/src/routes/_next/quotations/$quotationId.tsx:1494-1497`), with no outcome test. The comment at `:1478-1493` explains the approval pre-filter and never mentions Won. So an approved quotation converts whether it is **draft, sent, won or lost**. The existing suite never tests a non-won conversion: its fixture `q-1` is `status: "won"` with no decision stamps (`routers/quotation.convert.test.ts:150-160`).
- **Every reader of Won/Lost today** (for X5's guard to agree with):
  - the status-lifecycle docblock: `draft → sent` by `send`, `sent → won|lost` by `decide`, `* → converted` by `convertToOrder` and `importFromQuote` (`quotation.ts:1443-1458`);
  - `decide` refuses an unsent quotation (`:2890`) and an already-decided one, including `converted` (`:2908-2917`);
  - `send` refuses won/lost/converted (`:2631-2635`), and its stamp CASE preserves them (`:2748-2752`);
  - the list filter (`:2041`);
  - the record-page badge and "by X on Y" line (`$quotationId.tsx:1354-1361`);
  - the Post-to-ledger button (`$quotationId.tsx:1463-1476`);
  - `costLines.importFromQuote` requires `won | converted` (`routers/expense/cost-lines.ts:2191-2195`), refuses a quotation that has an order (`:2235-2248`), and sets `converted` without minting an order (`:2311-2319`).
- **`converted` erases the outcome from the status column.** After conversion the column reads `converted`, and the four decision columns (`schema/quotation.ts:369-384`) hold a date, member, reference and note, **but no outcome**. Two consequences:
  - A `converted` row with **no** order can only have come from `importFromQuote`, which only accepts `won | converted` (`cost-lines.ts:2191`). A guard that lets `converted`-without-order through is therefore honest.
  - Once step 10 lands, its `quotation_decision` history table keeps the outcome (step 10 §4). Step 10 D8 makes the `quotation` columns the projection readers use, so this plan reads `quotation.status` and does not join the history.
- **An undecided quotation cannot always be decided.** `decide` refuses `sentAt === null` (`quotation.ts:2890`). `sentAt` has one writer, `send`, which goes out through a connected mailbox and refuses without one (`modules/mailbox/reply.ts:494-504`). A quotation handed over by WhatsApp or in person (the channels step 01 plans for) can **never** reach Won, and the seed's won/lost rows carry no stamps either (`seed/sales.ts:186-194`). A strict "Won only" guard would make those quotations unconvertible forever. That is why D1 exists.
- **"One-shot" holds only without concurrency.** The order check (`:3919-3932`) and the insert (`:3971`) run in different transactions, with no lock and no unique index. `collective_order.quotation_id` is plain text with no index (`packages/db/src/schema/collective-order.ts:138`; the table's indexes are at `:350-381`). Two simultaneous presses (two tabs or two users) can both pass the check and mint two orders. A partial unique index cannot be the fix as things stand: `collectiveOrder.duplicate` spreads `...source` (`routers/collective-order.ts:2683`) and does not reset `quotationId`, so a duplicated order legitimately shares its source's quotation. That is also what the list's "Booking times" count relies on (`quotation.ts:2222-2230`). See D3.
- **The break after step 11 (tracker `nct-unnumbered`) is confirmed.**
  - Conversion inserts `collective_order` directly, while `create` (`collective-order.ts:2554`) and `duplicate` (`:2680`) go through `insertOrderWithJobNumber` (`:2363-2418`). That function allocates from the org's `job` sequence (`modules/org-param/allocate.ts:28`; seeded `JOB` + `yymm`, `modules/org-param/seed.ts:82`), retries on the partial unique index (`schema/collective-order.ts:379-381`), and degrades to "no number" when no sequence exists.
  - The repo already carries a failing-by-design test for exactly this gap: `it.fails("convertToOrder: the converted order carries a job number")` at `routers/collective-order.numbering.test.ts:471-474`. Its docblock (`:457-470`) says to delete `.fails` when conversion allocates.
  - Carried and attached lines take `orderNo = quotationNo` (`modules/expense/bridge.ts:128`, `quotation.ts:4151`). Lines added later on the order take `orderNo = order.jobNumber` (`collective-order.ts:4453`, in `saveChildren`), so one job's lines carry two different references.
  - The invoice prints `orderNo` per line (`modules/export/invoice-document.ts:419`, `:557`), and the month-end artifact groups sections by it (`modules/export/artifacts.ts:393-397`).
  - The manual repair exists: `assignNumber` (`collective-order.ts:2770`), rendered by `AssignJobNumberButton` on the edit form (`apps/web/src/components/order-form.tsx:2404`) and the record page (`components/order-ledger/order-record-page.tsx:113`). It stamps the order only and does not touch its lines.
- **Tracker `nct-lump-sums` is confirmed, with one catch the tracker does not mention.**
  - `cost_line` has `quantity` and `unit_price` (`schema/expense.ts:100-101`, both non-negative checked at `:229-230`). The invoice prints both (`invoice-document.ts:422-423`, `:563-567`), and so does the month-end artifact (`artifacts.ts:210-211`, `:242-243`).
  - The mapper documents dropping them: "`chargeUnit`/`quantity`/`unitPrice` (the ledger row is a single gross amount)" (`bridge.ts:15-17`).
  - **The catch:** a fee line's `totalPrice` is `max(quantity × unitPrice, minCharge)` (`packages/api/src/quotation/money.ts:62-85`), so on a floored line quantity × price ≠ amount. The order's fee grid also **recomputes `amount = quantity × unitPrice`** whenever either is edited (`apps/web/src/routes/_next/order.$orderId.expenses.tsx:220-230`). Carrying both blindly would print a sum that does not multiply out, and one edit would silently drop the floor. See D8.
  - Step 06 makes quantities above 1 routine (`step-06-tariff-quantity-from-containers.md` Phase 0, "Conversion (step 11+)").
- **Architecture gate.**
  - `packages/api/src/architecture.test.ts` enumerates every governed write by enclosing scope. Conversion holds five entries: `insert(costLine)` `:451`, `update(costLine)` `:461`, `insert(collectiveOrder)` `:505`, `update(quotation)` `:514`, and the allocator's `routers/collective-order.ts :: insertOrderRow :: insert(collectiveOrder)` at `:488`.
  - A stale entry fails the gate ("A stale entry is dead config that reads as a live decision", `:1128`). So Phase 2 must remove `:505` and re-key `:488` in the same commit.
  - This is the **api** architecture test, not the web one of the same name.
- **The SOP text vs the code.**
  - "Convert the **won** quote": not enforced (X5).
  - "a quotation that already has an order is refused": true, but only sequentially (D3).
  - "receivable lines only — cost-side and if-any lines are deliberately left behind": true (`:4044-4060`).
  - "drops you on the order's edit form": true (`$quotationId.tsx:834`).
  - The break's "conversion never allocates one" and "every cost line it creates inherits the quotation number": both true (see above).
  - The step 10 flow card's "Won → step 11. Lost → the chain ends here" (`tracker/seed/flow-nct.json:143`) is false today: a Lost quotation continues to step 11.
- **Migration state.** The journal has 65 entries ending `0065_quotation_send_decision` (idx 64), with 65 `.sql` files. It is contiguous and nothing is pending. Steps 01/02/04/09/10 reserve `0066`/`0067`/`0068`/`0073`/`0074`, and steps 05–08 hold conditional `0069`–`0072`. **This plan needs no migration under the recommended options.** If D3 picks B or C, it takes placeholder `00NN_collective_order_quotation_uq` (addition 2026-09-17, crosscheck X14: no fixed number), and the real number is assigned at merge (runbook §6).

---

## 1. Overview

**Problem.** Pressing **Convert to order** mints a job and burns the quotation. Today it does that for a quotation the customer **refused**, because the handler never asks what the customer answered. The job it mints has no job number, so its fee lines carry the quotation number and every later line carries the job number. Its receivable lines arrive as bare lump sums, so the invoice's Qty and Unit price columns print blank. Two presses at the same moment can mint two jobs.

**Goal.**
- **Phase 1 (X5):** a quotation recorded as Lost is refused with a sentence that says why, and conversion is one-shot under concurrency too.
- **Phase 2 (`nct-unnumbered`):** a converted job arrives numbered, and the lines conversion creates carry that number.
- **Phase 3 (`nct-lump-sums`):** a receivable line keeps its quantity and unit price when they honestly multiply to its amount.

**Success criteria.**
- `convertToOrder` on a Lost quotation returns CONFLICT with _"NCT-Q-… was recorded as Lost on 03 Sep 2026, so it cannot be converted to an order."_ No order, no cost line and no status change result. The Convert button is not offered on a Lost quotation.
- A Won quotation converts exactly as today (same toast, same landing, same carried lines).
- A quotation that already has an order is refused, including when two requests arrive together (one succeeds, one gets CONFLICT).
- After Phase 2, a conversion in an org with a `job` sequence lands on the edit form showing `JOByymm#####`, the **Assign number** button is absent, and every carried or attached line's `order_no` equals that number. The `it.fails` at `collective-order.numbering.test.ts:471` becomes a passing `it`.
- After Phase 3, a line priced 3 × 250 = 750 prints `3`, `250.00`, `750.00` on the invoice. A floored line (1 × 80 raised to 120) keeps its amount, with quantity and unit price left blank.

**In scope.**
- X5 guard and row lock in `convertToOrder`.
- The web button gate.
- Moving the job-number allocator into a module both routers can call.
- Conversion using it.
- The `orderNo` of carried/attached lines.
- Optionally (D7) re-stamping lines when **Assign number** fills a number later.
- The bridge mapper carrying quantity/unit price (D8).
- Tests for all of the above.
- Read-only production probes for Wilfred.

**Out of scope.**
- Correcting a mis-recorded Lost (step 10 owns **Correct decision**).
- Unwinding orders already minted from Lost quotations (D9: report only).
- Deciding a quotation that was never emailed (a step 09/10 gap, named in D1).
- Numbering the 129 legacy unnumbered orders (step 12's **Assign number** already does it).
- The **Post to cost ledger** button reading "Posted ✓" on a quotation converted by order rather than posted (`$quotationId.tsx:1468-1473`). It is cosmetic and flagged for a later step.
- `chargeUnit` → `billing_unit` (D8 option C mentions it).
- Invoice layout (step 25).

**Tracker items (`tracker/seed/tasks-nct.json`, `steps` containing `n: 11`):**

| Task id | Kind at step 11 | Planned here? | Why |
|---|---|---|---|
| `nct-lump-sums` "Conversion turns every fee into a lump sum" | `step` 11 (and `step` 25) | **Yes, Phase 3** | The loss happens in `mapFeeLineToCostLine`, which conversion calls. Step 25 only prints what arrives, so no step 25 change is needed. |
| `nct-unnumbered` "Conversion still produces an unnumbered job" | `break-after` 11 (and `step` 12) | **Yes, Phase 2** | The root cause is conversion's direct insert. Step 12's manual button stays as the repair for legacy orders. |
| X5 (cross-plan, not in the tracker) | step 11 | **Yes, Phase 1** | Handed over by `steps-4-10-crosscheck.md`. |

No step-11 task is left out. Related items **not** taken: `nct-s10-a-mis-keyed-decision-cannot-be-corrected` (step 10's) and `nct-channels` (step 01's; D1 depends on it).

**Assumptions.**
- Step 10 merges before Phases 2–3, and its D8 keeps `quotation.status` the source of truth → no history join (Phase 0).
- The refusal sentence points at **Correct decision** only once step 10 is merged → D4.
- `insertOrderWithJobNumber`'s three branches (typed number, no sequence, allocate) are right for conversion too, and conversion never passes a typed number → D5.

## 2. User Journeys

**Journey 1 (changed): Sales converts a won quotation**
Trigger: the customer's PO arrived, and Decide recorded **Won · by Aisyah on 03 Sep**. The quotation is approved.
Steps:
1. Sales open `/quotations/$quotationId` → the header shows **Won**, "by Aisyah on 03 Sep", and **Convert to order** (unchanged).
2. Sales press **Convert to order** → the server locks the quotation, checks the gate, the outcome, the existing order and the trade, then mints the order.
   - Toast: _"Order JOB2609-00042 created with 4 receivable fee line(s)"_. Before Phase 2 the toast reads as today, with no number.
3. The app lands on `/order/$orderId/edit` → the Job Number box reads `JOB260900042`, and **Assign number** does not render (it renders only while the number is blank, `order-form.tsx:2404`).
4. Sales open the order's Expenses tab → each carried receivable shows Qty and Unit price where they multiply out (Phase 3), and its order number is the job number (Phase 2).
5. Flow ends: back on the quotation, the badge reads **Converted** and **Convert to order** is gone.
Where it lives: the existing header button and the existing order edit form. No new screens.

Old journey, for contrast: step 2's toast had no number. Step 3 landed on an em-dash Job Number with **Assign number** under it (step 12). Step 4 showed lump sums carrying the quotation number.

**Journey 2 (new refusal): Someone tries to convert a lost quotation**
Trigger: a quotation was approved, sent, and recorded **Lost · lost on price**. A salesperson opens it from an old link, or a tab opened before the decision was recorded.
Steps:
1. On a fresh load of a Lost quotation, **Convert to order** is **not rendered**. The header shows **Lost · by … on …** and nothing else to press.
2. From a stale tab (loaded while the quotation was still Sent), the user presses **Convert to order** → the server refuses. Toast: _"NCT-Q-202609-0107 was recorded as Lost on 03 Sep 2026, so it cannot be converted to an order."_ After step 10 merges, the toast continues: _"If the customer accepted after all, use Correct decision."_ The page refetches and the button disappears.
3. Flow ends: no order, no cost lines, and the status stays **Lost**.
Where it lives: the existing header and the existing `onError` toast (`$quotationId.tsx:836`).

**Journey 3 (hardened): Two people convert the same quotation at once**
Trigger: two tabs, or a salesperson and their manager, press **Convert to order** within the same second.
Steps:
1. The first request locks the quotation row and mints the order.
2. The second request waits on the lock, re-reads, finds the order, and is refused with the existing _"This quotation has already been converted to an order."_ (`quotation.ts:3930`).
3. Flow ends: one order. The second user's toast says why, and the page refetch hides the button.
Where it lives: server only.

**Journey 4 (changed, D7): Operations assign a number to a job converted before Phase 2**
Trigger: an order converted last month still shows an em-dash.
Steps:
1. The user opens `/order/$orderId/edit` and presses **Assign number** → the order gets `JOB2609…`, as today.
2. With D7-A: the order's **unbilled** lines whose `order_no` is still the quotation number, or NULL (addition 2026-09-17, crosscheck X11 / step 12 D2-A; locked-but-unbilled lines included, step 12 D8-A), are re-stamped to the new job number in the same transaction. Toast: _"Job number JOB2609… assigned; 4 fee line(s) updated"_. Billed lines keep the number their issued invoice printed.
3. Flow ends: the next invoice for this job prints one number.
Where it lives: the existing **Assign number** button.

## 3. Result (What Changes for the User)

**Before:** Convert works on any approved quotation, including one the customer refused. The job arrives without a number, its fees carry the quotation number and no quantities, and a double press can create two jobs.
**After:** a Lost quotation cannot become a job and says why. A won one becomes a numbered job whose fees carry that number and their quantity × price breakdown. A double press creates one job.
**Key differences:**
- Sales: **Convert to order** is gone on Lost quotations. The toast names the new job number. There is no **Assign number** detour after converting.
- Accounting: invoices for converted jobs print one order number and real Qty / Unit price columns.
- Nobody: a draft or sent (undecided) quotation still converts under D1-B. That changes only if Wilfred picks D1-A or D1-C.

## 4. Technical Architecture

### Data flow

```
convertToOrder({id})
  tx.begin
  ├─ SELECT quotation … WHERE id AND scope FOR UPDATE            (D3-A; moved inside tx)
  ├─ assertGateCleared(tx, org, "quotation", id, "convert_order") (unchanged, now on tx)
  ├─ assertConvertibleOutcome(q)                                 (NEW, X5 — D1, D2)
  ├─ [step 10, after merge] refuse while a decision correction is open (step 10 Task 2.1)
  ├─ SELECT collective_order WHERE quotation_id AND org          (moved inside tx, after lock)
  ├─ isRetiredBusinessType                                       (unchanged)
  ├─ insertOrderWithJobNumber(tx, org, values)                   (Phase 2 — replaces direct insert)
  ├─ containers, receivable lines via mapFeeLineToCostLine(…, {orderId, orderNo: order.jobNumber ?? q.quotationNo})
  │                                                              (Phase 2 D6; Phase 3 D8 qty/unitPrice)
  ├─ attach orderless lines SET order_id, order_no = same orderNo
  ├─ UPDATE quotation SET status='converted'
  └─ writeAuditRaw quotation.convertToOrder (+ jobNumber)
  tx.commit
```

### Data model

**No schema change under the recommended options.** D3-B/C would add:

```ts
// packages/db/src/schema/collective-order.ts — ONLY if D3 = B or C
index("collective_order_org_quotation_idx").on(table.organizationId, table.quotationId)
// D3-B: uniqueIndex(...).where(sql`quotation_id IS NOT NULL AND source_order_id IS NULL`)
//        — needs a way to tell a converted order from a duplicate; no such column exists today.
```

Migration placeholder `00NN_collective_order_quotation_uq` (addition 2026-09-17, crosscheck X14), **number assigned at merge** (runbook §6). The prerequisite production probe (§7, probe P3) must show no two converted orders on one quotation.

### X5 guard: `assertConvertibleOutcome` (Phase 1)

In `packages/api/src/modules/quotation/convert-guard.ts` [NEW]. It is a pure function, so web and tests can share the rule:

```ts
import type { QuotationStatus } from "../../quotation/values"; // QUOTATION_STATUSES, values.ts:100

export type ConvertOutcomeInput = {
  quotationNo: string;
  status: QuotationStatus | string;
  decidedAt: Date | null;
};

/** X5. Throws ORPCError CONFLICT when the recorded outcome forbids a job. D1-B + D2-A:
 *  refuse `lost`; accept draft | sent | won | converted (converted-without-order can only
 *  come from importFromQuote, which itself requires won — cost-lines.ts:2191). */
export function assertConvertibleOutcome(q: ConvertOutcomeInput, opts: { correctionPath: boolean }): void;

/** Same predicate for the header button (no throw). */
export function isConvertibleOutcome(status: string): boolean;
```

Message: `${quotationNo} was recorded as Lost${decidedAt ? " on " + formatDay(decidedAt) : ""}, so it cannot be converted to an order.` When `opts.correctionPath` is true (set once step 10 is merged, D4), append `" If the customer accepted after all, use Correct decision."`. An unstamped legacy Lost row (`seed/sales.ts:189`) gets the sentence without a date.

Under **D1-A** the predicate becomes `status === "won" || status === "converted"`, and the message for draft/sent reads _"Record the customer's answer with Decide before converting."_. Under **D1-C** see §9.

### API contracts

**`quotations.convertToOrder`** (changed; input unchanged `{ id: string }`)
- Phase 1:
  - Move the scoped load and the existing-order check **inside** `context.db.transaction` and add `.for("update")` to the load. Precedent: `modules/audit/shared.ts:44`, `modules/governed/writer.ts:234`.
  - `assertGateCleared` receives `tx` (its signature already accepts `DbTransaction`, `gates.ts:147`).
  - Call `assertConvertibleOutcome` after the gate and before the order check.
  - The retired-trade refusal stays where it is.
  - Output is unchanged in Phase 1.
- Phase 2: output gains `jobNumber: string | null` (masked by `isFieldDenied(org, "collectiveOrder", "jobNumber")`, the same rule `insertOrderWithJobNumber` applies). The audit `after` gains `jobNumber`.
- Refusal order, as the caller sees it: NOT_FOUND → gate CONFLICT → **Lost CONFLICT** → (step 10: correction pending CONFLICT) → already-converted CONFLICT → retired BAD_REQUEST.

**`insertOrderWithJobNumber`** (moved, Phase 2): `packages/api/src/modules/collective-order/insert-order.ts` [NEW] exports `insertOrderWithJobNumber(tx, org, values)`, `normaliseJobNumber`, `hasJobNumber` and `MAX_JOB_NUMBER_ATTEMPTS`, plus the private `insertOrderRow`. The bodies move verbatim from `collective-order.ts:2288-2418`. `collective-order.ts` imports them, and `assignNumber` keeps its own loop (`:2804-2830`) but imports the constant.

**`mapFeeLineToCostLine`** (changed):
- Phase 2: `opts` gains `orderNo?: string | null`. The mapper writes `orderNo: opts.orderNo !== undefined ? opts.orderNo : quote.quotationNo`, so `importFromQuote`, which does not pass it, keeps today's value.
- Phase 3: `BridgeFeeLine` gains `quantity: string | null; unitPrice: string | null`. The mapper applies D8. The docblock at `bridge.ts:15-17` is rewritten.

**`collectiveOrder.assignNumber`** (changed, Phase 2, only under D7-A): after stamping, in the same transaction, `UPDATE cost_line SET order_no = <new> WHERE organization_id = org AND order_id = order.id AND bill_id IS NULL AND (order_no = order.quotation_no OR order_no IS NULL)` (the `order_no` predicate spares lines typed by hand). **Addition 2026-09-17 (crosscheck X11 / step 12 D2-A):** the `OR order_no IS NULL` arm covers lines `saveChildren` wrote while the job number was blank (`collective-order.ts:4453`, `orderNo: order.jobNumber`); when the order's `quotation_no` is NULL the predicate is NULL-only (`order_no IS NULL`), never `order_no = NULL`. With step 12 D8-A there is no `locked_at` / `rec_pay_locked_at` exclusion: a locked-but-unbilled line is re-stamped too. The settled-line trigger cannot raise on it: `cost_line_settled_immutable` enters its function for locked lines (`0033_cost_line_immutable.sql:157-164`), but the function (`0042_settled_line_company_refs.sql:63-87`) never compares `order_no` (verified at HEAD `6bb3a1bf`). The output gains `restampedLines: number`, and the audit `after` gains the count. This is a new `update(costLine)` site for the architecture allow-list, with its guards comment.

**Web**
- `$quotationId.tsx:1494-1497` gains `isConvertibleOutcome(loaded.status)`.
- The `convertMutation.onSuccess` toast (`:815-835`) names `result.jobNumber` when present.
- `assign-job-number-button.tsx` toast names `restampedLines` (D7-A).

### Key decisions
- What conversion accepts → D1 (blocking Phase 1)
- How "Lost" is recognised → D2 (blocking Task 1.1)
- How one-shot survives concurrency → D3 (blocking Task 1.2)
- When Phase 1 ships relative to steps 08/10 → D4
- Where the allocator lives → D5 (blocking 2.1)
- Which order number the converted lines carry → D6 (blocking 2.2)
- Whether Assign number re-stamps existing lines → D7 (blocking 2.4 only)
- How quantity/unit price cross the bridge → D8 (blocking Phase 3)
- What happens to jobs already minted from Lost quotations → D9 (not blocking)

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- D1, D2 and D3 answered by Wilfred.
- D4 answered, because it decides which base branch the Phase 1 worktree starts from.
- Re-read `quotation.ts` by symbol at the base commit. Steps 05, 08 and 10 shift line numbers in this file.

### Phase 1 — A Lost quotation cannot become a job, and a job is minted once (X5)

**Delivers:** Journeys 2 and 3 end to end, and Journey 1 unchanged.
**Dependencies:** D1–D4. No other plan's code is required.

- **1.1** Add `assertConvertibleOutcome` / `isConvertibleOutcome` per D1 and D2, with unit tests for every status × stamped/unstamped, and for the message with and without a date and with and without `correctionPath`. Files: `packages/api/src/modules/quotation/convert-guard.ts` [NEW], `packages/api/src/modules/quotation/convert-guard.test.ts` [NEW]. · **Agent A (backend)**
- **1.2** Restructure `convertToOrder`:
  - move the load and the order check into the transaction;
  - lock the load `FOR UPDATE` (D3-A);
  - pass `tx` to `assertGateCleared`;
  - call the guard, with `correctionPath: false` until step 10 is on the base (D4).

  The `update(quotation)` WHERE keeps `scope` (`:4183`). Update the allow-list comment at `architecture.test.ts:505`/`:514` to name the lock and the outcome guard (entry keys unchanged). Files: `packages/api/src/routers/quotation.ts`, `packages/api/src/architecture.test.ts`. · **Agent A (backend)**
- **1.3** Router tests in `quotation.convert.test.ts`. Add fixtures `q-lost` (approved, `status: "lost"`, `decidedAt` set, a passed submission), `q-lost-legacy` (`status: "lost"`, no stamp) and `q-sent` (approved, `status: "sent"`). Cases:
  - Lost → CONFLICT with the dated sentence, zero orders, zero cost lines, status still `lost`, no `quotation.convertToOrder` audit row.
  - Legacy Lost → CONFLICT without a date.
  - `q-1` Won → converts (existing cases stay green untouched).
  - `q-sent` → converts under D1-B (refused under D1-A).
  - A quotation set to `converted` by `importFromQuote` with no order → converts.
  - The existing "refuses to convert twice" (`:465`) still passes.

  Also add a lock test: begin a raw transaction holding `SELECT … FOR UPDATE` on `q-1`, then assert that `convert("q-1")` does not resolve before that transaction commits. PGlite is single-connection, so this may not be expressible there. If not, write the test as `it.skip` with the reason, and prove Journey 3 in §10 against the dev database. Files: `packages/api/src/routers/quotation.convert.test.ts`. · **Agent A (backend)**
- **1.4** Web gate: add `isConvertibleOutcome(loaded.status)` to the Convert condition at `$quotationId.tsx:1494-1497`, and extend the comment at `:1478-1493` to name X5. Nothing else on the page changes. Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx`. · **Agent B (frontend)**

**Acceptance.**
- A Lost quotation shows no Convert button, and a stale-tab press toasts the Lost sentence.
- A Won quotation converts and lands on the edit form as before.
- Two near-simultaneous conversions against the dev DB leave one order.
- `convert-guard.test.ts`, `quotation.convert.test.ts`, `quotation.attach-and-warn.test.ts`, `expense.self-bridge.test.ts`, `collective-order.numbering.test.ts` (its `it.fails` still fails) and the api `architecture.test.ts` all pass, judged by reading the output.

### Phase 2 — A converted job arrives numbered, and its lines carry the number (`nct-unnumbered`)

**Delivers:** Journey 1 steps 2–4 (number part), and Journey 4 under D7-A.
**Dependencies:** Phase 1 merged. Step 10 merged (its Task 2.1 edits the same handler region). D5, D6, and D7 for Task 2.4.

- **2.1** Move `insertOrderWithJobNumber`, `insertOrderRow`, `normaliseJobNumber`, `hasJobNumber` and `MAX_JOB_NUMBER_ATTEMPTS` verbatim from `routers/collective-order.ts:2288-2418` to `modules/collective-order/insert-order.ts` (D5-A), and re-import them in the router. In `architecture.test.ts`, re-key `:488` to `modules/collective-order/insert-order.ts :: insertOrderRow :: insert(collectiveOrder)` and move its comment. Run `collective-order.numbering.test.ts` before going further: `create`/`duplicate` must be unchanged. Files: `packages/api/src/modules/collective-order/insert-order.ts` [NEW], `packages/api/src/routers/collective-order.ts`, `packages/api/src/architecture.test.ts`. · **Agent C (backend)**
- **2.2** `convertToOrder` calls `insertOrderWithJobNumber(tx, context.org, { …values, jobNumber: null })` in place of the direct insert.
  - Delete `architecture.test.ts:505` (`quotationsRouter.convertToOrder :: insert(collectiveOrder)`) in the same commit, or the stale-entry rule (`:1128`) fails.
  - Compute `orderNo` per D6 and pass it to the mapper (`:4075`) and to the attach UPDATE (`:4151`).
  - Return `jobNumber` and add it to the audit `after`.
  - Update the `mapFeeLineToCostLine` signature and `bridge.test.ts`.

  Files: `packages/api/src/routers/quotation.ts`, `packages/api/src/modules/expense/bridge.ts`, `packages/api/src/modules/expense/bridge.test.ts`, `packages/api/src/architecture.test.ts`. · **Agent C (backend)**
- **2.3** Tests:
  - In `collective-order.numbering.test.ts:471`, `it.fails` becomes `it`.
  - New numbering cases: an org with no `job` sequence converts with `jobNumber` null and lines carrying the quotation number (D6-A); a caller denied the `jobNumber` field converts with no number returned.
  - `quotation.convert.test.ts`: carried lines' `orderNo` equals the order's `jobNumber`.
  - `quotation.attach-and-warn.test.ts`: the attached line's `orderNo` equals the job number, and the assertion that pins `orderNo = quotationNo` (if any) changes.

  Files: `packages/api/src/routers/collective-order.numbering.test.ts`, `packages/api/src/routers/quotation.convert.test.ts`, `packages/api/src/routers/quotation.attach-and-warn.test.ts`. · **Agent C (backend)**
- **2.4** (D7-A only) `assignNumber` re-stamps unbilled lines as in §4. Add an allow-list entry `routers/collective-order.ts :: collectiveOrderRouter.assignNumber :: update(costLine)` with its guards comment ("blank or quotation-number references"), plus a test (billed line untouched, hand-typed `order_no` untouched, other org untouched).
  - **Addition 2026-09-17 (crosscheck X11 / step 12 D2-A, D8-A):** the predicate is `bill_id IS NULL AND (order_no = <quotation_no> OR order_no IS NULL)`, or `bill_id IS NULL AND order_no IS NULL` when the order has no `quotation_no`. No locked-line exclusion. Test cases, in `collective-order.numbering.test.ts`:
    - **re-stamp (widened):** an order with `quotationNo: "NCT-Q-9"`, `jobNumber: null` and four lines: `order_no` NULL unbilled, `"NCT-Q-9"` unbilled, `"HAND-REF"` unbilled, NULL billed (`billId` set). After assign, the first two carry the job number, the third stays `HAND-REF`, the fourth stays NULL, and `restampedLines` is 2. A second order in `org-b` with a NULL unbilled line keeps NULL.
    - **re-stamp, no quotation number:** an order with `quotationNo: null` and one NULL unbilled line plus one `"HAND-REF"` line → only the NULL line is re-stamped (`restampedLines` 1).
    - **re-stamp locked (D8-A):** an unbilled NULL line with `lockedAt` set and one with `recPayLockedAt` set → both carry the job number and the UPDATE does not raise. This proves the trigger ignores `order_no` only if the suite's database applies the SQL migrations (0033, 0042); the executor confirms that from the test DB setup and otherwise proves it on the dev branch.
  - Step 12 Task 1.2 becomes the fallback only (run it there if this task merges without the widening). Files: `packages/api/src/routers/collective-order.ts`, `packages/api/src/routers/collective-order.numbering.test.ts`, `packages/api/src/architecture.test.ts`. · **Agent C (backend)**
- **2.5** Web: the conversion toast names the job number. The assign toast names the re-stamped count (D7-A). Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx`, `apps/web/src/components/order-ledger/assign-job-number-button.tsx`. · **Agent D (frontend)**

**Acceptance.**
- Converting in a seed-parity org lands on an edit form with a `JOB…` number and no **Assign number** button.
- The Expenses tab's lines carry that number.
- Under D7-A, pressing **Assign number** on a pre-Phase-2 converted order updates its unbilled lines, including NULL-reference and locked-but-unbilled ones (addition 2026-09-17, crosscheck X11).
- The numbering, convert, attach-and-warn, bridge and api architecture tests pass. `bun run check-types` passes, judged by reading the output.

### Phase 3 — Receivable lines keep their quantity and unit price (`nct-lump-sums`)

**Delivers:** Journey 1 step 4 (breakdown part).
**Dependencies:** Phase 2 merged (the same mapper signature). D8. Ideally step 06 merged, so quantities above 1 exist in the test data.

- **3.1** Pass `quantity` and `unitPrice` into `BridgeFeeLine` from both callers. Both already load full fee-line rows (`quotation.ts:4044-4047`, `cost-lines.ts:2271-2274`), so this is type-only at the call sites. Apply D8 in the mapper, using `computeFeeLineAmounts` (`quotation/money.ts:62`) with no `minCharge` to compare `quantity × unitPrice` against `totalPrice` at 2-dp money rounding. Rewrite the `bridge.ts:15-17` docblock. Files: `packages/api/src/modules/expense/bridge.ts`, `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/expense/cost-lines.ts`. · **Agent E (backend)**
- **3.2** Tests:
  - mapper: exact product → carried; floored line → both null; quantity 0 → carried as `0`/price with amount 0; unit price with more than 2 dp.
  - `quotation.convert.test.ts`: `fl-1` (1 × 1000) carries `1`/`1000`.
  - `expense.self-bridge.test.ts`: `importFromQuote` carries the same.
  - One invoice-document test: a converted line renders Qty and Unit price.

  Files: `packages/api/src/modules/expense/bridge.test.ts`, `packages/api/src/routers/quotation.convert.test.ts`, `packages/api/src/routers/expense.self-bridge.test.ts`, `packages/api/src/modules/export/invoice-document.test.ts` (if present; otherwise the nearest artifacts test). · **Agent E (backend)**

**Acceptance.** A quotation with a 3 × 250 line and a floored line converts. On the order's Expenses tab, the first shows 3 / 250 / 750 and the second shows blank / blank / 120. The invoice export prints the same. The tests above pass.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.3 | `packages/api/src/modules/quotation/convert-guard.ts` [NEW], `…/convert-guard.test.ts` [NEW], `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/quotation.convert.test.ts`, `packages/api/src/architecture.test.ts` | `packages/api/src/modules/audit/gates.ts`, `packages/api/src/quotation/values.ts`, `packages/api/src/routers/expense/cost-lines.ts`, `packages/db/src/schema/{quotation,collective-order}.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | low | 1.4 | `apps/web/src/routes/_next/quotations/$quotationId.tsx` | `packages/api/src/modules/quotation/convert-guard.ts` |

Opus for A: a lock and a refusal inside the one handler that mints orders and money lines. A wrong transaction boundary loses the audit row or double-mints.
Run mode: **A → B**. B imports `isConvertibleOutcome` from 1.1, so it can start as soon as 1.1 is committed and runs in parallel with 1.2–1.3.
Serialization point: after A, run `bunx vp test run packages/api/src/routers/quotation.convert.test.ts packages/api/src/architecture.test.ts` and grep for `failed`. After B, run `bun run check-types`.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | opus | high | 2.1–2.4 | `packages/api/src/modules/collective-order/insert-order.ts` [NEW], `packages/api/src/routers/collective-order.ts`, `packages/api/src/routers/quotation.ts`, `packages/api/src/modules/expense/bridge.ts`, `…/bridge.test.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/routers/collective-order.numbering.test.ts`, `…/quotation.convert.test.ts`, `…/quotation.attach-and-warn.test.ts` | `packages/api/src/modules/org-param/allocate.ts`, `packages/db/src/schema/expense.ts` |
| Agent D (frontend) | frontend-engineer | sonnet | low | 2.5 | `apps/web/src/routes/_next/quotations/$quotationId.tsx`, `apps/web/src/components/order-ledger/assign-job-number-button.tsx` | `packages/api/src/routers/{quotation,collective-order}.ts` |

Opus for C: it moves a serial allocator across files, rewrites two allow-list entries under a stale-entry gate, and changes a money-line column in two writers.
Run mode: **C → D**. D waits on the `jobNumber` / `restampedLines` output fields from 2.2/2.4, because oRPC client types come from the router.

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent E (backend) | backend-engineer | sonnet | medium | 3.1–3.2 | `packages/api/src/modules/expense/bridge.ts`, `…/bridge.test.ts`, `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/expense/cost-lines.ts`, `…/quotation.convert.test.ts`, `…/expense.self-bridge.test.ts`, `packages/api/src/modules/export/invoice-document.test.ts` | `packages/api/src/quotation/money.ts`, `packages/api/src/modules/export/{invoice-document,artifacts}.ts`, `apps/web/src/routes/_next/order.$orderId.expenses.tsx` |

Run mode: single agent, with no web change.

Smell test: one owner per task · no file owned twice within a phase · `quotation.ts` passes A → C → E strictly in sequence · every wait names its artifact (1.1 guard export, 2.2/2.4 output fields) · Phase 1 alone closes X5.

## 7. Impact & Breakage Analysis

- **`convertToOrder` transaction boundary (Phase 1).**
  - The load moves inside the transaction and takes a row lock on `quotation`. Callers: `$quotationId.tsx:813`, plus the tests listed in 1.3.
  - Lock ordering: step 10's `applyDecisionCorrection` also locks `quotation FOR UPDATE` first (step 10 §8, row locking), and conversion locks nothing before `quotation`, so no deadlock cycle is introduced.
  - `importFromQuote` takes no lock. A concurrent import and conversion behave as today, and conversion's attach block already tolerates it (`:4094-4100`).
  - The lock is held through the whole insert (containers plus ≤ ~50 fee lines). That is well under a second, on an operator-triggered action.
- **Behaviour change for Lost quotations.** Any e2e or seed flow that converts a Lost quotation now gets CONFLICT. Grep at HEAD: the only e2e mention of `convertToOrder` is a comment (`e2e/specs/audit.order-queue.spec.ts:98`), and every api test fixture that converts is `status: "won"` (`quotation.convert.test.ts:155`, `quotation.attach-and-warn.test.ts:156`, `expense.self-bridge.test.ts:98`, `collective-order.numbering.test.ts:485`). `apps/qa-review/src/cases.json` records historic runs; it is not executed.
- **Web header (Phase 1).** One extra predicate on an existing condition. Step 10 Task 2.5 disables the same button while a correction is pending. Both conditions compose with `&&`.
- **Allocator move (Phase 2).**
  - `create` and `duplicate` keep calling the same function from a new path.
  - The allow-list keys change: `:488` is re-keyed and `:505` removed. Both in one commit, or the api architecture test fails in either direction.
  - `assignNumber` keeps its own loop.
  - No behaviour change for orders created outside conversion.
- **Carried lines' `order_no` (Phase 2).** Readers of `cost_line.order_no`:
  - cost-line list filter `routers/expense/cost-lines.ts:764` (`ilike` substring): a search by quotation number stops finding new converted lines, and a search by job number starts finding them;
  - invoice document `invoice-document.ts:419`;
  - month-end grouping `artifacts.ts:393-397` (converted jobs stop splitting into two sections);
  - `expense/shared.ts:1236` projection.

  Tell accounting that converted lines now carry the job number.
- **Mapper `quantity`/`unitPrice` (Phase 3).**
  - Non-null values on converted lines make the order grid's recompute (`order.$orderId.expenses.tsx:220-230`) active for them. D8-A only carries values whose product already equals the amount, so a recompute reproduces the same amount until someone edits a number, which is the intended grid behaviour.
  - The `cost_line_settled_immutable` trigger (0036/0037) freezes eleven columns on settled lines. It is irrelevant here, because conversion inserts new unbilled lines and attach does not touch quantity or price.
  - The non-negative checks (`expense.ts:229-230`) hold, because fee-line inputs are non-negative (`schema/quotation.ts:237` comment).
- **Nullable fields relied on.** `collective_order.job_number` is nullable, and a null number means "no sequence" or "field denied" (D6-A falls back to the quotation number). `quotation.decided_at` is nullable on legacy rows (D2). `cost_line.bill_id` null means unbilled (D7-A predicate).
- **Deployment coupling.** Phase 1 server and web can deploy together. The web gate is additive, and an old web against a new server only sees the refusal toast. Phase 2: server before web (the toast reads `jobNumber`, which is optional-safe anyway). No migration under the recommended options.
- **Cross-plan collisions**, in the runbook §1 table style:

| Shared code | Steps that write it | Handled by |
|---|---|---|
| `convertToOrder` body (`quotation.ts:3887-4222`) | 08 Phase 3 (deletes the adjacent legacy `review`, `:3845-3881`), 10 Task 2.1 (pending-correction refusal after the gate, `:3908`), **11 Phases 1–3** | 11 Phase 1 lands first (D4-A). 10 rebases and places its check after `assertConvertibleOutcome`. 11 Phases 2–3 wait for 10 |
| Header buttons in `$quotationId.tsx:1463-1506` | 09 (notice), 10 Tasks 1.8/2.5 (Correct decision; disable Convert while pending), **11 Tasks 1.4/2.5** | Different conditions on the same element. Rebase and resolve by hand; 10 goes after 11 Phase 1 |
| `quotation.convert.test.ts` | 05 Task 1.4 (runs it, may touch `:168`), 10 Tasks 2.1/2.2, **11 Tasks 1.3/2.3/3.2** | New `describe` blocks per step; rebase |
| `mapFeeLineToCostLine` (`modules/expense/bridge.ts`) | **11 Phases 2–3**; 06 changes the quantities that arrive (no edit); 25 reads the output (no plan yet) | 11 owns it. Phase 3 after 06 so tests see qty > 1 |
| `routers/expense/cost-lines.ts` `importFromQuote` | 10 Task 2.2 (pending-correction refusal), **11 Task 3.1** (type-only caller change) | Different lines; 11 Phase 3 after 10 |
| Job-number allocator (`collective-order.ts:2288-2418`) and `assignNumber` (`:2770`) | **11 Phase 2** (moves it; D7 edits `assignNumber`), 12 (Assign number — no plan yet), 14 (`saveChildren` `orderNo`, `:4453` — no plan yet) | 11 Phase 2 merges before any step 12/14 plan is executed; those plans must read the new module path |
| `packages/api/src/architecture.test.ts` allow-list | 08 Task 3.3, 10 Task 1.4, **11 Tasks 1.2/2.1/2.2/2.4** | Re-run after every rebase; entries are line-independent but comments collide |
| Migration journal | 01, 02, 04, 09, 10; **11 only if D3-B/C** | Number assigned at merge (runbook §6) |

**Recommended merge order.** Phase 1 goes in its own worktree `wt-step11` in **Wave 1**, merging after step 05. It touches only `convertToOrder`'s first 70 lines, one JSX condition and one test file, and it closes a live money defect four waves earlier. Phases 2 and 3 go in **Wave 5**, after step 10, as one worktree with Phase 2 before Phase 3. If Wilfred picks D4-B, all three phases run in Wave 5.

**Production read-only probes (Wilfred runs; none blocks Phase 1 code):**
- **P1 (X5 exposure, D9):** `select q.organization_id, q.quotation_no, a.created_at, a.after_json::jsonb->>'orderId' as order_id from audit_log a join quotation q on q.id = a.target_id where a.action = 'quotation.convertToOrder' and a.before_json::jsonb->>'status' = 'lost';`
- **P2 (D1 sizing):** `select a.before_json::jsonb->>'status' as from_status, count(*) from audit_log a where a.action = 'quotation.convertToOrder' group by 1;` A large `draft`/`sent` share makes D1-A a real regression.
- **P3 (D3):** `select quotation_id, count(*) from collective_order where quotation_id is not null group by 1 having count(*) > 1;` Every hit must be explained by `collectiveOrder.duplicate` audit rows before any unique index is considered.
- **P4 (D7 sizing):** `select count(*) from cost_line cl join collective_order o on o.id = cl.order_id where o.quotation_id is not null and cl.order_no = o.quotation_no and cl.bill_id is null;` Also run the same count with `bill_id is not null`. **Addition 2026-09-17 (crosscheck X11):** replaced by step 12 probe P3, which also counts NULL references; run 12-P3 instead (and 12-P10 for locked-but-unbilled lines).
- **P5 (D8 sizing):** `select count(*) filter (where round(quantity*unit_price, 2) <> round(total_price, 2)) as floored, count(*) from quotation_fee_line where side = 'selling' and not if_any;`

## 8. Cross-Cutting Concerns

- **Errors.** Every refusal is `ORPCError("CONFLICT")` with an operator-readable sentence naming the quotation number. The page already toasts `error.message` (`$quotationId.tsx:836`). The lock wait is invisible to the user, and there are no new error codes.
- **Testing.** A pure guard unit test (1.1); router tests on PGlite (1.3, 2.3, 3.2); the architecture test after every task that moves a writer; §10 in the browser, with Journey 3 against the dev Neon branch because PGlite cannot hold two connections.
- **Migration.** None under D3-A. Under D3-B/C: `00NN_collective_order_quotation_uq` (placeholder; next free number at merge per runbook §6; addition 2026-09-17, crosscheck X14), preceded by probe P3. Gates: `bunx vp test run packages/db/src/migrations.test.ts`.
- **Rollback.** Phase 1: revert the commit. No data was written differently, only refused. Phase 2: revert. Orders numbered by conversion keep their numbers (correct data), and lines keep the job number. Phase 3: revert. Lines already carrying quantity/price keep them, which is harmless because they multiply out.
- **Audit trail.** A refused conversion writes nothing, matching every other refusal in this router. `quotation.convertToOrder.after` gains `jobNumber` (Phase 2). `collectiveOrder.assignNumber.after` gains `restampedLines` (D7-A).

**Performance & Scalability**
1. **Pagination.** Not applicable: single-record mutations.
2. **SQL-side filtering.** The order-existence check, the attach SELECT and the D7 re-stamp are all WHERE clauses.
3. **N+1.** None added. Conversion keeps its fixed statement count plus the allocator's 1–20 attempts (the same as `create`).
4. **Index coverage.** `collective_order.quotation_id` has no index (`schema/collective-order.ts:138`), and conversion, `retrieve` (`quotation.ts:2381-2389`), `importFromQuote` and the list's correlated count all probe it. Phase 1 adds no new probe (it moves one). D3-B/C would add the index. D7's re-stamp uses `cost_line_order_idx` (`expense.ts:190`).
5. **Write atomicity.** Lock, checks, order, containers, lines, attach, status and audit all run in one transaction. The allocator's savepoint pattern is kept verbatim.
6. **Row locking.** `quotation FOR UPDATE` serializes conversions of the same quotation and serializes conversion against step 10's correction apply. A different quotation is not blocked.
7. **Connections/resources.** None new.
8. **Tenant isolation.**
   - The locked load keeps `applyScope(…, quotationScopeCols)`.
   - The order check keeps `organizationId`.
   - The allocator is org-keyed.
   - D7's UPDATE filters `organization_id` and `order_id` from the scoped order load.
9. **Payload size.** One nullable string in the output.
10. **Hot path.** Conversion is operator-triggered. `retrieve` is unchanged.

## 9. Decision Register, Open Questions & Risks

**All decisions DECIDED by Wilfred on 2026-09-16: every recommendation accepted (D1-B, D2–D9 A).**

### Blocking

**D1: What must be true of the customer's answer before a quotation can be converted?** · Status: **DECIDED** · Blocks: Phase 1 (Tasks 1.1–1.4)

| | Approach | Cost |
|---|---|---|
| **A** | **Won only.** Accept `won`, or `converted` with no order. Refuse `lost`, and refuse `draft`/`sent` with _"Record the customer's answer with Decide before converting."_ | Matches the SOP title and the flow card ("Lost → the chain ends here"), and every job then has a recorded Won. **Strands every quotation that was not emailed through the app:** `decide` refuses `sentAt === null` (`quotation.ts:2890`), and only a mailbox send writes it (`reply.ts:494-504`). WhatsApp and walk-in quotations become unconvertible until steps 01/09 add a manual "record as sent". It also breaks every approved-but-undecided conversion in use today (probe P2). |
| **B** | **Refuse Lost only** (Recommended). Accept `draft`, `sent`, `won`, `converted`. Refuse `lost` with the dated sentence | Closes X5 exactly as filed, with no regression for quotations handed over outside email and no fixture churn. Conversion still does not *prove* a Won, so a future win-rate report must treat "converted without a decision" as its own bucket. |
| **C** | **Refuse Lost; conversion of an undecided quotation records Won.** Convert on `draft`/`sent` opens a small dialog (answer date, customer reference), and the transaction writes the four decision columns and `status` before minting | Every job gets a Won with a real date, and nothing is stranded. It adds a second writer of decision stamps (a new allow-list site, plus a step 10 history row it must also write), a dialog on a one-press action, and it contradicts `decide`'s "never sent → no answer" rule on purpose. It is the largest option, and it couples Phase 1 to step 10's table. |

- **Recommendation: B.** The defect is "a Lost quotation converts". B closes it without inventing a second decision path or locking out quotations the app cannot mark as sent. A and C are right once "record as sent" exists (step 01/09 territory), and D1 can be revisited then.
- **Chosen: B (Wilfred, 2026-09-16)**
- **Where it lands:** `convert-guard.ts` predicate and message (1.1), the 1.3 fixtures, the 1.4 button condition, §10.

**D2: How does the guard recognise "Lost"?** · Status: **DECIDED** · Blocks: Task 1.1

| | Approach | Cost |
|---|---|---|
| **A** | **The status column:** `status === "lost"`, stamped or not (Recommended) | One predicate, the same column every other reader uses (list filter `:2041`, `send` `:2631`, `importFromQuote` `:2191`). Legacy dropdown-typed Lost rows (`seed/sales.ts:189`) are refused too, and they have no date for the message. |
| **B** | **The stamp:** `status === "lost" && decidedAt !== null` | Only real, recorded refusals block. A legacy row typed "lost" in the old dropdown still converts, which is exactly the unrecorded kind of outcome 0065 set out to stop trusting. |
| **C** | **Status or history:** A, plus the current `quotation_decision` row's outcome once step 10 exists | Survives a future writer that forgets the projection. It joins a table step 10 D8 declared audit-only, and it cannot ship before step 10. |

- **Recommendation: A.** Step 10 D8 keeps `quotation.status` authoritative, `send`'s CASE preserves `lost` (`:2748-2752`), and treating a typed "lost" as "lost" is the conservative reading for a money-minting action.
- **Chosen: A (Wilfred, 2026-09-16)**
- **Where it lands:** Task 1.1, and the 1.3 `q-lost-legacy` case.

**D3: How is "one order per quotation" kept under concurrent presses?** · Status: **DECIDED** · Blocks: Task 1.2 (and a migration, if B or C)

| | Approach | Cost |
|---|---|---|
| **A** | **Row lock:** load the quotation `FOR UPDATE` inside the conversion transaction and run the order check after it (Recommended) | No migration. It reuses the repo's lock precedent (`audit/shared.ts:44`) and also serializes against step 10's correction apply. It protects only writers that take the lock, but conversion is the only minter of a quotation's first order. Not provable on PGlite (single connection), so §10 proves it on dev. |
| **B** | **Partial unique index** on `collective_order (organization_id, quotation_id)` | A database-level guarantee. **Breaks `collectiveOrder.duplicate`**, which copies `quotationId` (`collective-order.ts:2683`) and feeds the "Booking times" count (`quotation.ts:2222-2230`). It needs a new column to tell a converted order from a copy, a backfill, probe P3 clean, and migration `00NN_collective_order_quotation_uq` (number assigned at merge; placeholder renamed 2026-09-17, crosscheck X14). |
| **C** | **Both:** A now, plus a non-unique index on `(organization_id, quotation_id)` for the probes | A's safety plus the missing index step 10 flagged (step 10 §8 item 4). Adds a migration whose only benefit is lookup speed on a table of hundreds of rows per org. |

- **Recommendation: A.** It closes the race with no schema change, and B collides with a deliberate duplicate behaviour that nothing in this step should change.
- **Chosen: A (Wilfred, 2026-09-16)**
- **Where it lands:** Task 1.2, §4 data model, §8 migration.

**D5: Where does the job-number allocator live so conversion can call it?** · Status: **DECIDED** · Blocks: Task 2.1

| | Approach | Cost |
|---|---|---|
| **A** | **Move to `modules/collective-order/insert-order.ts`** and import it from both routers (Recommended) | Matches the module pattern the audit and quotation helpers already follow. One allow-list re-key. It touches a region steps 12/14 will read, so their plans must use the new path. |
| **B** | **Export from `routers/collective-order.ts`** and import it into `routers/quotation.ts` | No move and no re-key. It creates a router-to-router import, and `quotation.ts` then loads the whole order router module (4,000+ lines) for one function. |
| **C** | **Copy the loop into `convertToOrder`** | No shared-file edit. It is the two-copies-of-a-serial-loop drift the allow-list comment at `architecture.test.ts:476-479` was written to stop, and it adds a new allow-list entry. |

- **Recommendation: A.**
- **Chosen: A (Wilfred, 2026-09-16)**
- **Where it lands:** Tasks 2.1–2.2, the §7 collision table.

**D6: Which order number do the lines conversion creates carry?** · Status: **DECIDED** · Blocks: Task 2.2

| | Approach | Cost |
|---|---|---|
| **A** | **The job number when one was allocated, otherwise the quotation number** (Recommended) | Fixes the two-numbers-on-one-invoice case wherever a `job` sequence exists. An org without a sequence (or a caller denied the field) keeps today's traceable quotation reference instead of nothing. |
| **B** | **The job number, or null** (exactly what `saveChildren` writes, `collective-order.ts:4453`) | One rule for every line on an order. Without a sequence, converted lines lose their only reference, and month-end files them under "无订单号" (`artifacts.ts:397`). |
| **C** | **Keep the quotation number** and only number the order | No ledger change. The invoice still prints two numbers for one job, so `nct-unnumbered` is half-fixed. |

- **Recommendation: A.**
- **Chosen: A (Wilfred, 2026-09-16)**
- **Where it lands:** Tasks 2.2–2.3.

**D8: How do quantity and unit price cross from the fee line to the ledger line?** · Status: **DECIDED** · Blocks: Phase 3

| | Approach | Cost |
|---|---|---|
| **A** | **Carry both only when `round(quantity × unitPrice, 2) = totalPrice`; otherwise leave both null** (Recommended) | The invoice never prints a product that does not equal its amount. A floored line (`money.ts:62-85`) stays a lump sum, and the order grid's recompute (`order.$orderId.expenses.tsx:220-230`) cannot silently drop a floor. Floored lines (probe P5) keep today's blank columns. |
| **B** | **Always carry both** | Every line prints a breakdown. On floored lines the invoice shows e.g. `1 × 80 = 120`, and the first edit of quantity on the order recomputes 120 → 80, silently removing the minimum charge. |
| **C** | **Always carry both, and also `chargeUnit` → `billing_unit`, with a remark "minimum charge applied" on floored lines** | The most informative. It writes a sentence into `remark` (overwriting the quote note mapped at `bridge.ts:149`, or concatenating it), and still exposes the recompute hazard. `billing_unit` has different semantics ("distinct from settlementUnit (Add-fee dialog)", `expense.ts:105`) that nobody has confirmed. |

- **Recommendation: A.**
- **Chosen: A (Wilfred, 2026-09-16)**
- **Where it lands:** Tasks 3.1–3.2.

### Not blocking code

**D4: When does Phase 1 (X5) ship, and what does its refusal point to?** · Status: **DECIDED** · Blocks: scheduling of Phase 1, and the base branch for `wt-step11`

| | Approach | Cost |
|---|---|---|
| **A** | **Wave 1 hotfix:** Phase 1 in its own worktree, merged after step 05. The message has no "Correct decision" pointer (`correctionPath: false`). Step 10's session flips it to `true` when it rebases in Wave 4 (Recommended) | Closes a live defect four waves early, in a small diff (one handler head, one JSX condition, one test file). Step 10 inherits a one-line follow-up that must be written into its prompt at Wave 4 (it cannot be in step 10's plan file without editing it). There is a textual rebase with step 08 Phase 3 (the adjacent `review` deletion). |
| **B** | **Wave 5, after step 10,** with the pointer from day one | No cross-plan follow-up. Lost quotations stay convertible through Waves 1–4. |
| **C** | **Fold into step 10's Wave 4 worktree** | One session touches `convertToOrder` once. It enlarges the lowest-readiness plan (step 10, 6/10) with an unrelated guard, and still waits until Wave 4. |

- **Recommendation: A.**
- **Chosen: A (Wilfred, 2026-09-16)**
- **Where it lands:** §7 merge order, Task 1.2 `correctionPath`, runbook Wave 1/4 prompts (Wilfred's edit, not this plan's).

**D7: When Assign number fills in a job number later, do the order's existing lines follow?** · Status: **DECIDED** · Blocks: Task 2.4 only

| | Approach | Cost |
|---|---|---|
| **A** | **Re-stamp unbilled lines** whose `order_no` equals the order's quotation number, in the same transaction (Recommended) | Repairs every pre-Phase-2 conversion the moment someone presses **Assign number** (step 12's existing habit). Billed lines keep the number their issued invoice printed, and hand-typed values are untouched. It adds one allow-list site to a step 12 handler. |
| **B** | **Re-stamp all matching lines, billed included** | One number everywhere. A re-printed historical invoice would show a number the customer never received. |
| **C** | **Forward only:** no re-stamp | No change to `assignNumber`. Every order converted before Phase 2 keeps printing two numbers (probe P4 counts them). |

- **Recommendation: A.**
- **Chosen: A (Wilfred, 2026-09-16)**
- **Where it lands:** Task 2.4, Journey 4.

**D9: What happens to jobs already minted from Lost quotations?** · Status: **DECIDED** · Blocks: nothing (a data question, answered by probe P1)

| | Approach | Cost |
|---|---|---|
| **A** | **Report only:** Wilfred runs P1 and hands the list to sales/operations to confirm or delete each job by hand (Recommended) | No data change, and each case is judged by someone who knows the customer. Some will be real wins mis-recorded as Lost (step 10's Correct decision is refused while the order exists, step 10 D4-A). |
| **B** | **Flag on the order:** a visible "Quotation recorded as Lost" banner on orders whose quotation's `decide` audit row says lost | Operations see it in context. A new read path on the order page and a join through `audit_log`, which has no `target_id` index (step 10 Phase 0). |
| **C** | **Script:** delete or archive such orders that have no billed lines and no bill of lading | Automatic cleanup. Destroys jobs that may be real, and it is a production data change outside this step. |

- **Recommendation: A.**
- **Chosen: A (Wilfred, 2026-09-16)**
- **Where it lands:** §7 probe P1.

### Risks
- _PGlite cannot prove the row lock_ → certain → **Task 1.3 writes the lock test as `it.skip` with the reason if it cannot run; §10 Journey 3 proves it on the dev Neon branch with two concurrent calls.**
- _Step 10 lands first and places its pending-correction refusal where the X5 guard goes_ → medium likelihood under D4-B/C → **the refusal order in §4 is the contract. Whoever rebases second puts X5 before step 10's check.**
- _Moving the allocator changes an allow-list key under a stale-entry gate_ → high likelihood of a red test if split across commits → **Tasks 2.1 and 2.2 each commit the key change together with the code change.**
- _D1-B leaves undecided conversions invisible to a future win-rate report_ → medium → **named in D1. Any report must bucket "converted, no decision".**
- _Step 06 raises quantities above 1 and step 07 changes floors, shifting how many lines D8-A carries_ → low impact → **Phase 3 runs after both. Probe P5 is re-run at merge.**
- _Line numbers drift_: steps 05/08/10 all edit `quotation.ts` → certain → **every task locates by symbol (`convertToOrder`, `insertOrderWithJobNumber`, `mapFeeLineToCostLine`), not by line.**

### SOP text vs code (Phase 0 wins)
1. "Convert the **won** quote": any approved quotation converts, including Lost (`quotation.ts:3887-3969`, `$quotationId.tsx:1494-1497`). Fixed by Phase 1.
2. "It is one-shot": only sequentially. The check and the insert are in separate transactions with no lock or index (`:3919-3932`, `:3969`). Fixed by Phase 1 (D3).
3. The flow card for step 10, "Lost → the chain ends here" (`tracker/seed/flow-nct.json:143`), is false until Phase 1.
4. The flow card for step 11 summary, "You are on /order//edit" (`flow-nct.json:155`), shows an empty `$orderId`. It is a copy typo in the tracker seed, not code.
5. The SOP's step 11 prose omits that conversion also requires an **approved** review (the `convert_order` gate, `:3908`). Step 08's text covers it.
6. Everything else in the step 11 card and the break (header/company/containers carried, receivable only, if-any left behind, lands on the edit form, no job number, lines keep the quotation number) matches the code.

## 10. Verification & Proof

**App URL:** http://localhost:3101 (server :3000). One worktree's servers at a time (runbook §9).
**Preconditions:**
- A seed-parity org (`e2e/fixtures/seed-cli.ts seed-parity <runId>`) with the quotation review flow ticking `convert_order`, a `job` sequence (seeded by `org-param/seed.ts:82`), a connected mailbox, and cookies for **sales** and **branch-manager**. Announce the active org before driving the browser.
- Quotation **QW**: approved, sent through step 09, decided **Won** with reference `PO-1`. Two selling lines: `3 × 250` and a floored `1 × 80 → 120`. One if-any line.
- Quotation **QL**: approved, sent, decided **Lost**, note "lost on price".
- Quotation **QS**: approved, sent, undecided.
- A pre-Phase-2 converted order **OX** with no job number (create it before deploying Phase 2, or insert it through the seed).

**Migrations:** none under D3-A. Under D3-B/C, check the journal entry for the numbered `00NN_collective_order_quotation_uq` (numbered at merge; addition 2026-09-17, crosscheck X14), not the command exit code.

**Unit / integration tests to add or change** (run each, read the output for `failed`):
- `packages/api/src/modules/quotation/convert-guard.test.ts` [NEW]: the status × stamp matrix, and the message variants.
- `packages/api/src/routers/quotation.convert.test.ts`: Lost refused with no side effects; legacy Lost refused; Won converts; Sent converts (D1-B); import-converted without order converts; twice refused; lock test (or `it.skip` with reason); carried `orderNo` = job number; `quantity`/`unitPrice` carried per D8.
- `packages/api/src/routers/collective-order.numbering.test.ts`: `it.fails` → `it` (`:471`); no-sequence conversion; field-denied conversion; D7 re-stamp cases, plus (addition 2026-09-17, crosscheck X11) the widened NULL-reference, no-quotation-number and locked-but-unbilled cases from Task 2.4.
- `packages/api/src/routers/quotation.attach-and-warn.test.ts`: attached line's `orderNo`.
- `packages/api/src/modules/expense/bridge.test.ts`: `orderNo` option; D8 exact/floored/zero cases.
- `packages/api/src/routers/expense.self-bridge.test.ts`: `importFromQuote` carries quantity/unit price and keeps `orderNo = quotationNo`.
- `packages/api/src/architecture.test.ts`: passes after every task that touches a writer.

**Golden path (Journey 1):**
1. As sales, open `/quotations/<QW>` → the header reads **Won · by <sales> on <date>**, with **Convert to order** visible.
2. Press **Convert to order** → toast _"Order JOB…… created with 2 receivable fee line(s)"_ (Phase 2 wording; Phase 1 alone keeps today's toast). The app lands on `/order/<id>/edit`.
3. The Job Number box shows `JOB<yymm>#####`, and **Assign number** is absent (Phase 2).
4. Open the order's Expenses tab → two receivable lines, with no if-any line. The `3 × 250` line shows Qty 3, Unit price 250, Amount 750. The floored line shows blank, blank, 120 (Phase 3, D8-A). Both lines' order number equals the job number (Phase 2).
5. Back on `/quotations/<QW>` → the badge reads **Converted**, and **Convert to order** is gone.

**Edge case 1: Lost is refused (Journey 2).**
1. Open `/quotations/<QL>` → the header reads **Lost**, and there is **no** Convert button.
2. Open `/quotations/<QS>` in tab 1. In tab 2, record **Decide → Lost** on QS. In tab 1 (stale), press **Convert to order** → toast _"NCT-Q-… was recorded as Lost on <date>, so it cannot be converted to an order."_ After the refetch, the button is gone.
3. Confirm nothing was created: the `/order/sea-export` ledger (or QS's trade) has no new row, and `/audit-log` filtered to `quotation.convertToOrder` has no QS row.

**Edge case 2: already converted is refused.** Return to the tab still showing QW before its conversion (or re-press in a second stale tab) → toast _"This quotation has already been converted to an order."_ One order exists for QW.

**Edge case 3: concurrent conversion (Journey 3, dev DB).** Create a fresh approved Won quotation. From `e2e/out/_walk/`, run a node walk script with the sales cookie that fires two `quotations.convertToOrder` calls with `Promise.all` → one resolves with an `orderId`, and one rejects CONFLICT with the already-converted sentence. The trade ledger shows one new order.

**Edge case 4: undecided (D1-B).** Convert a fresh approved **Sent** quotation → it succeeds. Under D1-A it would be refused with the Decide sentence instead; record whichever D1 chose.

**Edge case 5: Assign number repairs an old job (D7-A).** Open `/order/<OX>/edit` → press **Assign number** → toast names the number and _"N fee line(s) updated"_. The Expenses tab shows the new number on unbilled lines (including any that had a blank order number; addition 2026-09-17, crosscheck X11) and the quotation number on any billed line.

**Regression check.**
- `/quotations/<QW>`'s **Post to cost ledger** behaviour is unchanged on a Won, unconverted quotation.
- `collectiveOrder.create` from the ledger toolbar still allocates the next serial after the one conversion took (no reuse).
- **Duplicate** on a converted order still works and keeps `quotationId` (D3-A leaves it alone).
- The invoice export for QW's order prints one order number and the Qty/Unit price columns.
- `/approve/quotation` is unchanged.

**Mobile:** at 400px the quotation header wraps without horizontal scroll, with the Convert button absent on Lost. The order edit form shows the job number box without overflow.

**Readiness: 7/10.** Phase 1 is small, fully located and testable (one handler head, one JSX condition, fixtures that already say `won`). Four things hold the score back:
- ~~D1 is a genuine product call~~ — resolved 2026-09-16: all decisions taken as recommended (D1-B).
- The concurrency fix cannot be proven on PGlite and needs a dev-DB walk.
- Phase 2 moves a shared allocator into the path of steps 12 and 14, which have no plans yet.
- The size of the live damage (probes P1, P2, P4, P5) is unknown until Wilfred runs the read-only queries.
