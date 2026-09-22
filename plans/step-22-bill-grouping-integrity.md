# Step 22 — a bill covers exactly the fees it was grouped from, under the gate the tenant set, and knows who it is to

**SOP step:** 22 "Group the fees into a bill" · **Money → Cost lines** (`/expenses/cost-lines`, page title Cost Detail) → tick lines, or tick nothing (全选) → **Create Bill** dialog → bills appear under **Money → Bills**
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-21. The `nct-layout` worktree is on `feat/intake-golden-path-e2e` (`ea1560e7`), but `git diff --stat 6bb3a1bf -- packages apps` is empty, so every `packages/` and `apps/` citation below matches `6bb3a1bf`. Every `file:line` was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Small–Standard. Phase 1 changes one money handler (`costLines.createBill`): where it reads and locks its lines, which ids the review gate sees, and which company a new bill points at. Phase 2 is two small web changes (a link and a checkbox). No schema change, no migration under the recommended options. No new permission node.
**Cross-plan items:** the `create_bill` gate bypass is also filed under SOP step **21** (`sop.json` guide n=21 `fixes[0]`, same line `cost-lines.ts:2506`). Ownership is D1 (Decided: B, step 22 owns it; crosscheck X28). The "Order → Bill" break (`sop.json` `breaks[]`, `after: 21`) lands on step 22's screen; ownership is part of D4 (Decided: A, step 22 owns it).
**Status:** every decision in §9 is **Decided** (Wilfred, 2026-09-21: the recommended option throughout, with the crosscheck X-item overrides listed in "Decisions settled" at the end).

**Size verdict.** Step 22 is mostly sound. Grouping, numbering, the all-or-nothing claim, the 全选 count echo and the per-bucket exchange rate all hold up against the code. The plan is therefore two phases: one server phase for three real money defects, and one web phase for the severed hand-off from the job and the missing per-order split.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`). Governed writers in `packages/api/src/modules/governed/writer.ts`. Drizzle schema in `packages/db/src/schema`, SQL migrations in `packages/db/src/migrations` (journal ends at `0065_quotation_send_decision.sql`). TanStack Router file routes in `apps/web/src/routes/_next`. vitest on PGlite (`pushTestSchema`, `packages/api/src/test-schema.ts:86`). Real-Postgres suites use `describe.skipIf(!TEST_URL)` (`routers/expense.concurrency.test.ts:65`). Dev: web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Entry.** Sidebar **Money → Cost lines** (`apps/web/src/components/shell-next/nav.ts:226-228`, `p: "expense:read"`). The toolbar button reads **Create Bill (n)** with ticks and **Create Bill (全选)** with none (`apps/web/src/routes/_next/expenses/cost-lines.tsx:2214-2216`).
  - **Dialog.** `CreateBillDialog` (`cost-lines.tsx:1037`). With nothing ticked, `useFilterScope` counts the filtered set (`:1064`) and `<FilterScopeNotice>` names it (`:1165`). With ticks, a client-side preview groups by settlement unit · attribute · currency · owning branch · optional tax rate (`:1071-1090`) and lists one row per bill with total and line count (`:1177-1204`). **Also split by tax rate** (`:1206-1215`). **Invoice Title** only for a one-bill ticked selection with an unmasked settlement unit (`:1249-1264`). **Remark** (`:1265-1272`). The submit sends ticks or `{ filterScope: { filter, confirmedCount } }`, plus `groupByTaxRate`, `invoiceTitle` (single-bill only) and `remark` (`:1286-1306`). **It never sends `groupByOrder`.** Errors surface through the global mutation toast (`apps/web/src/utils/orpc.ts:63-90`; the dialog sets no `onError`).
  - **Server.** `costLines.createBill` (`packages/api/src/routers/expense/cost-lines.ts:2388`), node `EXPENSE.billCreate` (`:2389`). Input `costLineIds ≤ MAX_BATCH_IDS` default `[]` (`:2401`), `filterScope?` (`:2410`), `groupByTaxRate?` (`:2424`), `groupByOrder?` (`:2434`), `invoiceTitle?`, `remark?` (`:2435-2436`).
    1. `resolveCostLineSelection` (`routers/expense/shared.ts:1042`) returns the ticks unchanged, or rebuilds the filter set server-side, refusing count 0, count over `IMPLICIT_SELECTION_CAP = 2000` (`routers/expense/filter-scope.ts:64`) and a count that differs from `confirmedCount` (`assertFilterScope`, `filter-scope.ts:185-209`). Called at `cost-lines.ts:2446-2452`.
    2. **Reads the lines on `context.db`, outside any transaction, with no lock** (`:2457-2460`), then checks the count (`:2462`), already billed (`:2473-2479`) and cost review J4 — `pending` or `rejected` refuses (`:2489-2496`).
    3. **Review gate:** `assertGatesCleared(context.db, organizationId, "cost_line", input.costLineIds, "create_bill")` (`:2502-2508`) — the raw input array, not the resolved `costLineIds`.
    4. Groups by `[settlementUnit ?? "", attribute, currency, owningBranchId, taxRate if asked, orderId if asked]` (`:2521-2538`).
    5. One transaction (`:2551`): one block of bill numbers (`allocateNumbers`, `:2553`); per bucket `billTotal(bucketLines)` from the step-2 read (`:2573`), the bill rate as of now (`:2595-2615`), `billWriter.create` with `settlementUnit`, **`settlementCompanyId: head.settlementCompanyId`** (`:2638`), `invoiceTitle: callerInvoiceTitle ?? head.settlementUnit ?? null` (`:2643`); then `costLineWriter.mutateEach(wctx, "claim", …)` (`:2660-2665`).
    6. Returns `bills`, `rateMissing`, `rateAsOf`, `updatedLineIds` (`:2680-2695`).
  - **The claim verb** (`cost-lines.ts:388-404`) pins only `billId IS NULL` (`:395-398`). `mutateEach` (`modules/governed/writer.ts:413`) loads the ids `FOR UPDATE` through `loadManyScoped` (`writer.ts:223-240`, `.for("update")` at `:234`, no `ORDER BY`), runs the verb's gates (none on `claim`) and writes.
  - **Roles.** `expense.bill.create` comes with the `expense` root: admin (`packages/api/src/roles.ts:90`), branch-manager (`:104`), accounting (`:175`). Ops hold `expense.costLine` only (`:158`), so ops cannot bill. Director holds read and review leaves only (`:204-213`).
  - **Seed.** "Cost review" flow `gates: []` (`modules/audit/seed.ts:166-174`); "Bill review" ticks `input_invoice_no`, `write_off` (`:176-193`). `create_bill` is declared in the cost-line vocabulary (`modules/expense/gates.ts:42`) and ticked by no seed. Tenants can tick it in Approval Process Setting.
  - **Bill numbers** are `NCT-B-YYYYMM-NNNN` (`makeNo`, `routers/expense/shared.ts:305-308`).
  - **Due date.** Not written by router code. The BEFORE INSERT trigger `bill_payment_terms_snapshot` (`packages/db/src/migrations/0062_payment_terms_due_date.sql:150-161, 177-179, 186-189`) copies `company.days_payable` through `bill.settlement_company_id` and derives `due_date = created_at::date + days`. A bill with no `settlement_company_id` gets no due date. The BEFORE UPDATE arm (`:191-199`) allows NULL → terms when the bill later gains a company.

- **Finding A (money, integrity): the opt-in "fees must pass review before billing" gate is skipped on the 全选 path — confirmed.** `:2506` passes `input.costLineIds`; on the 全选 path that is `[]` (the zod default, `:2401`), and `assertGatesCleared` returns at once on an empty array (`packages/api/src/modules/audit/gates.ts:76`). Every other guard reads the resolved rows. So a tenant who ticked **Create bill** on its Cost review flow has it enforced for ticks and bypassed for 全选 — the path the button offers when nothing is ticked. No test covers the `create_bill` gate at all (`grep -rn create_bill packages/api/src --include=*.test.ts` finds nothing). SOP step 22 already lists this as a pitfall, and SOP step 21 files it as a fix.

- **Finding B (money, integrity): a bill's total can disagree with its own lines — confirmed by reading; not reproducible without real Postgres.** The lines are read at `:2457` on `context.db` with no lock. The bill total is computed from that read (`:2573`) inside the later transaction. The claim reloads the rows `FOR UPDATE` (`writer.ts:234`) only after the bill row is inserted, and its pin checks only `billId IS NULL`. `costLines.update` pins the same `billId IS NULL` (`cost-lines.ts:346-352`), so an amount edit that commits between the read and the claim is not refused by either side. Result: the bill is stored with the old total while its lines carry the new amounts. `bill_invoiced_amount_within_total` (`packages/db/src/schema/expense.ts:415-418`) then caps invoicing at the stale figure. The same window lets a line become `pending` (engine submit repaints `cost_line.audit_status`, `modules/audit/resources.ts:399-430`) after J4 passed. Two overlapping `createBill` calls lock their lines in unspecified order (no `ORDER BY` at `writer.ts:230-234`), so they can deadlock and answer a Postgres deadlock error instead of the named CONFLICT; the existing race test (`expense.concurrency.test.ts:105`) uses one line, so it cannot see this.

- **Finding C (money timing): the bill takes its counterparty from the first line only, and on the happy path no line has one — confirmed.** `settlementCompanyId: head.settlementCompanyId` (`:2638`). The group key uses the settlement unit **text** (`:2524`), not the company id. Only `costLines.create` writes `cost_line.settlement_company_id` (`cost-lines.ts:1282`, from the CompanyPicker, `cost-lines.tsx:670-685`, which also allows free text). The order fee grid (`saveChildren`) defaults the unit to `order.clientName` with no company id (`routers/collective-order.ts:4480-4482`), and the quote bridge sets only the unit (`modules/expense/bridge.ts:101`). So:
  1. Lines from steps 11 and 20 reach step 22 with `settlement_company_id IS NULL`, their bill has no company, the trigger never fires, and the bill has no due date. This is ledger item `never-overdue`, whose repairs name s22 and s27.
  2. A bucket whose first line lacks the id loses it even when a later line carries it.
  3. Two lines with the same unit text but different company ids merge into one bill that names only the first company. The picker cannot produce this directly (it writes the company's own name, and names are unique); it arises after a company rename, from a free-text unit that later matches, or from RPC.
  - `company.name` is unique per organisation (`packages/db/src/schema/company.ts:138`, `company_org_name_uidx`), so an exact-name lookup is deterministic.

- **Finding D (dead end, severed hand-off from step 21/20): you cannot bill a job from the job — confirmed.** The order's fee page links to the ledger with no search params: `<Link to="/expenses/cost-lines">` (`apps/web/src/routes/_next/order.$orderId.expenses.tsx:928`). The ledger accepts `orderId` (`cost-lines.tsx:178`, wired to the list filter at `:1776`) and `status` (`:126`), but no chip is declared for `orderId` (chip list `:1640-1715`), so a deep-linked order scope would be invisible. `orderNo` is a substring (`ilike`) filter (step 11 §7), so "J1" also matches "J10" — typing the job number and pressing 全选 can pull another job's fees into the bill.

- **Finding E (friction): no screen can split per order — confirmed.** The server implements `groupByOrder` (`:2434`, `:2533`). No web caller sends it (`grep -rn groupByOrder apps/web/src` finds nothing). The dialog's preview key (`:1078-1084`) has no order dimension, and its row text and React key (`:1189-1195`) omit the owning branch, so two buckets that differ only by branch render as two identical rows under one duplicated key.

- **Finding F (integrity, API only): one `invoiceTitle` is stamped onto every bill of a split.** `:2643` applies the single scalar to every bucket. The web withholds it on a split (`cost-lines.tsx:1301-1304`), but the server does not refuse it, so any other caller (RPC, script, a future screen) stamps one counterparty's name onto several bills. The in-repo RPC callers (`seed/money.ts:169`, `e2e/specs/audit.bill-queue.spec.ts:74`, `e2e/specs/ledger-search.status-labels.spec.ts:103, 156`) send no title.

- **Checked and sound (no plan).**
  - Selection resolution and the 2000 cap refuse rather than truncate (`filter-scope.ts:194-201`); the count echo refuses drift (`:202-207`); ticks and filter together are refused (`shared.ts:1049-1053`).
  - IDOR: the scoped read plus the count check (`cost-lines.ts:2457-2466`).
  - Numbering: one `allocateNumbers` block per call (`:2553`).
  - Same-currency rate is `"1"` (`routers/expense/exchange-rate.ts:175`); `rateMissing` is true only when a cross-currency rate or the reporting currency is missing.
  - Line amounts are positive at the boundary (`positiveDecimalString`, `cost-lines.ts:1073`); `bill_total_amount_non_negative` holds.
  - Double billing across two concurrent calls on the same line: one wins, no stray bill (`expense.concurrency.test.ts:105-135`).

- **Adjacent defects in the same paths (flagged, not planned).**
  1. Archived ("trash") lines can be billed: the default list hides them (`shared.ts:816-818`), but ticking them under **Archived = Only archived** and billing is not refused. Probe 22-P7 sizes it.
  2. The 全选 path cannot preview the split; the operator learns the bill count only from the toast. A server dry-run would be a new endpoint.
  3. A billed line can still be submitted to cost review: `cost_line.exists` (`resources.ts:399-406`) neither checks `bill_id` nor locks. Step 21's area.
  4. The bill rate is dated at creation (`:2613`) while fee rows use the shipment date — ledger item `two-profits` (repairs s20, s27).
  5. `bills.terms.test.ts` installs the 0062 trigger locally because `test-schema.ts` does not replay `0062_payment_terms_due_date.sql`; no other suite can see due dates. Owner of `test-schema.ts`, not this plan.

---

## 1. Overview

**Problem.** Accounting groups fees into bills on Cost Detail. Three things go wrong with money. A tenant's "fees must be approved before billing" rule is silently skipped when nobody ticks rows. A fee edited at the moment of billing can leave the bill's total different from its own lines, and invoicing is then capped at the wrong figure. And a bill raised from the normal job flow never learns which company it is to, so it has no due date and can never become overdue. Separately, a job's own fee page sends you to the organisation-wide ledger with no filter, and no screen offers the per-order split the server already supports.

**Goals.**
- **Phase 1:** what `createBill` checks is what it bills. The gate reads the resolved selection; the lines are read and locked inside the write transaction and every guard runs on the locked rows; each bill gets the counterparty its lines name, and so gets a due date where the company has terms.
- **Phase 2:** from a job's fee page, one click lands on that job's unbilled fees, visibly scoped; the dialog offers **Also split by order** and its preview says what each bill is.

**Success criteria.**
- In an org whose Cost review flow ticks **Create bill**, `createBill({ filterScope })` over a set containing a never-submitted line returns CONFLICT _"\"Create bill\" requires review approval first — n of m selected are not approved"_ and creates nothing; ticks behave as today.
- A deterministic real-Postgres interleave (an amount edit committing while `createBill` waits) ends with `bill.total_amount` equal to the sum of its lines; the same test fails against the current handler.
- A bill grouped from lines whose unit exactly matches a company with `days_payable = 30` carries that company and `due_date = created_at::date + 30`.
- `/order/<id>/expenses` → **Cost Detail** link lands on `/expenses/cost-lines?orderId=<id>&status=bill_not_established` with a visible **Order** chip; **Create Bill (全选)** bills only that job's unbilled fees.
- **Also split by order** produces one bill per order, and the preview row names the order and, where it matters, the branch.

**In scope.** `createBill` gate ids, in-transaction locked read and guards, company resolution per bucket, server refusal of a title on a split; the fee-page link, an `orderId` chip, the split-by-order checkbox and preview; tests; read-only probes.

**Out of scope.**
- Fixing `settlement_company_id` at the source (`saveChildren`, the quote bridge) — step 20's plan (ledger `identity`, repairs b20/s25). D3 is compatible with it.
- Backfilling company or due date onto existing bills (D7).
- Ageing, the Overdue chip and cross-branch totals (step 27; ledger `never-overdue`, `base-currency`).
- The bill's own freezes after creation (step 23; ledger `bill-rewrite`).
- Cost-review integrity of the line itself — edits under review, deletion after approval, bulk rate rewrite (step 21's other three fixes).
- A **Create bill** button on the order's own fee page (D4-C, not recommended).
- Adjacent defects 1–5 above.

**SOP findings (`customer-intake-sop/sop.json`):**

| Finding | Planned? | Where |
|---|---|---|
| Step 22 `fixes[0]` "Bills cannot be split per order, though the server can" | Yes | Phase 2 (Task 2.2) |
| Step 22 pitfall "On the unticked path the opt-in Create bill review gate … does not apply" (= step 21 `fixes[0]`) | Yes, owner per D1 | Phase 1 (Task 1.1) |
| Step 22 pitfall "The group key includes owning branch but the preview row text does not show it" | Yes | Phase 2 (Task 2.2) |
| Break `after: 21` "Order → Bill" | Yes, owner per D4 | Phase 2 (Task 2.1) |
| Ledger `never-overdue` (repairs s22, s27) — the s22 part | Yes | Phase 1 (Task 1.2) |
| Ledger `base-currency` (repairs s22, s27) | No code at step 22: the group key already includes currency and owning branch, and each bucket resolves its own rate target (`:2595`). See §9 "SOP text vs code" row 9 | — |
| Not filed: stale total under a concurrent edit | Yes | Phase 1 (Task 1.1) |
| Not filed: one invoice title stamped on a split (API) | Yes, per D6 | Phase 1 (Task 1.3) |

**Decisions (all Decided 2026-09-21; Chosen in brackets):**
- Which plan owns the gate-ids fix → D1 [B: step 22]
- How `createBill` makes its guards and total match what it bills → D2 [A: read and lock in the transaction, `(created_at, id)` order per X30]
- Which company a new bill points at → D3 [A: bucket's own id, else exact-name match; refuse a bucket with two]
- The job → bill hand-off → D4 [A: link with `orderId` + `status`, plus an Order chip; step 22 owns it]
- Default of **Also split by order** → D5 [A: off]
- A title sent for a split → D6 [A: refuse]
- Existing bills (bypass residue, stale totals, bills with no company) → D7 [A: report only]

## 2. User Journeys

**Journey 1 (changed): Accounting bills a filtered set in an org that requires approved fees**
Trigger: an org's Cost review flow ticks **Create bill** (Approval Process Setting). Some fees for customer X are approved, one is not yet submitted.
Steps:
1. Accountant opens **Money → Cost lines**, filters **Settlement Unit = X** and **Expense Status = Not billed**, ticks nothing → **Create Bill (全选)**.
2. The dialog names the count (unchanged). Presses **Create Bills from N Lines** → error toast _"\"Create bill\" requires review approval first — 1 of N selected are not approved"_. Nothing is created.
3. Accountant filters **Audit Status**, submits the missing fee from the Review menu, has it approved at **Approvals → Cost review** (`/approve/cost`), repeats step 1–2 → toast _"Bill NCT-B-… created"_.
4. Flow ends: every billed line passed review, whichever way it was selected.
Where it lives: the existing dialog; server refusal only.
Old journey, for contrast: at step 2 the bill was created with the unapproved fee inside it.

**Journey 2 (changed): A bill raised from a job's fees gets its due date**
Trigger: customer X exists in the company directory with **Days payable** 30. The job's client is X, so the job's fee rows carry settlement unit "X" (`collective-order.ts:4480-4482`) and no company id.
Steps:
1. Accountant bills those lines (either path) → toast _"Bill NCT-B-… created"_ (unchanged).
2. **Money → Bills** → the new bill's **Due Date** column shows creation date + 30 (`-bills.columns.tsx:712-742`), and **Days overdue** counts once that date passes.
3. If two lines in one group name two different directory companies under the same unit text → error toast _"Settlement unit \"X\" points at two different companies on the selected lines. Correct the lines' Settlement Unit, then bill again."_ Nothing is created (D3-A).
4. Flow ends: the bill names the company; the workbench's Overdue chip can see it (step 27 reads it).
Where it lives: server only; the Bills list already renders the column.

**Journey 3 (changed): Accounting bills a job from the job**
Trigger: a job's fees are entered (step 20) and approved (step 21).
Steps:
1. Accountant opens `/order/<id>/expenses` and presses the **Cost Detail** link under the grids → lands on Cost Detail with chips **Order** and **Expense Status: Not billed**; only that job's unbilled fees are listed.
2. Ticks nothing → **Create Bill (全选)** → the dialog counts exactly those lines → **Create Bills from N Lines** → one bill per settlement unit · attribute · currency · branch.
3. Or ticks lines from several jobs (after removing the Order chip), ticks **Also split by order** → the preview lists one row per order, each naming the job number → **Create N Bills**.
4. Flow ends: the operator never re-types a job number, and a substring match cannot drag another job in.
Where it lives: the existing link text on the fee page; the existing dialog gains one checkbox.
Old journey, for contrast: the link opened the whole organisation's ledger; the operator typed the job number into **Order No.** (a substring match) or repeated the dialog per job.

## 3. Result (What Changes for the User)

**Before:** the approval rule for billing works only when you tick; a fee edited during billing can make a bill whose total is wrong for good; bills from the job flow have no due date; the job page drops you on the whole ledger.
**After:** billing refuses unapproved fees however you select them; a bill always equals its lines at the moment it was made; bills name their company and carry its terms; the job page opens its own unbilled fees, and you can split by order.
**Key differences:**
- Accounting (gated orgs): 全选 over unapproved fees is refused with a count.
- Accounting (everyone): bills from the job flow show a due date when the customer has terms; a rare "two companies under one name" refusal.
- Accounting: a scoped landing from the job page and an **Also split by order** checkbox.
- Nobody: grouping keys, numbering and the dialog's other fields are unchanged.

## 4. Technical Architecture

### 4.1 Read, lock and guard inside the transaction (Journey 1; Phase 1) → D1, D2

`createBill` keeps `resolveCostLineSelection` outside the transaction (it only yields ids and refuses a bad scope). Everything from the line read onwards moves inside `context.db.transaction`:

```ts
// routers/expense/cost-lines.ts, createBill handler (sketch; locate by symbol)
const costLineIds = await resolveCostLineSelection(context.db, context.org, lineScope, input, { … });

return await context.db.transaction(async (tx) => {
  // D2-A: lock in (created_at, id) order (crosscheck X30, the one line order every ledger writer takes)
  // so two overlapping calls queue instead of deadlocking.
  const lines = await tx
    .select()
    .from(costLine)
    .where(and(inArray(costLine.id, costLineIds), lineScope))
    .orderBy(costLine.createdAt, costLine.id)
    .for("update");
  if (lines.length !== costLineIds.length) throw new ORPCError("BAD_REQUEST", { message: "One or more selected cost lines were not found" });
  if (lines.length === 0) throw …;                // unchanged wording
  /* already-billed check — unchanged wording */
  /* J4 pending/rejected check — unchanged wording */
  await assertGatesCleared(tx, organizationId, "cost_line", costLineIds, "create_bill"); // D1: resolved ids, and the tx
  // grouping, allocateNumbers, per-bucket rate, company (4.2), billWriter.create, claim — as today, on `lines`
});
```

- Order of refusals a caller sees is unchanged: selection refusals → not found → none selected → already billed → J4 → gate → (new) company conflict (4.2) → (new) title on split (4.3).
- The gate is read on `tx`: the flow and latest submissions are then read in the same snapshot as the locked lines. It does not lock `audit_submission`; a decision landing after the read is the same READ COMMITTED window every gate call has today.
- The claim's `loadManyScoped` re-locks rows the transaction already holds (no-op) and still pins `billId IS NULL`. Its `FOR UPDATE` without `ORDER BY` (`writer.ts:230-234`) no longer decides lock order, because the ordered read above took the locks first. `writer.ts` is not edited.
- `lineScope` is computed on `context.db` before the transaction (`:2441`); it is an SQL fragment and is valid inside `tx`.
- Effect on concurrent `costLines.update`: if the edit commits first, `createBill` reads the new amount; if `createBill` locks first, the edit waits, then its `billId IS NULL` pin fails with _"Cost line was billed concurrently; refresh and retry"_ (`cost-lines.ts:351`). Either way the bill equals its lines.

### 4.2 The bill's counterparty (Journey 2; Phase 1) → D3

Per bucket, before `billWriter.create`:

```ts
// D3-A (sketch). Pure part in modules/expense/bill-company.ts [NEW], lookup on tx.
const ids = new Set(bucketLines.map((l) => l.settlementCompanyId).filter(Boolean));
if (ids.size > 1) throw new ORPCError("BAD_REQUEST", {
  message: `Settlement unit "${head.settlementUnit ?? ""}" points at two different companies on the selected lines. Correct the lines' Settlement Unit, then bill again.`,
});
let settlementCompanyId = ids.size === 1 ? [...ids][0]! : null;
if (!settlementCompanyId && head.settlementUnit?.trim()) {
  const [c] = await tx.select({ id: company.id }).from(company)
    .where(and(eq(company.organizationId, organizationId), eq(company.name, head.settlementUnit.trim())));
  settlementCompanyId = c?.id ?? null;       // company_org_name_uidx: at most one row
}
```

- The group key is **unchanged** (unit text), so the web preview stays an exact mirror and no bill count changes.
- Exact, trimmed, case-sensitive match only. No fuzzy match. A renamed company or a typo leaves `null`, as today.
- The unit string itself is not masked away here: `head.settlementUnit` is the server's own read, not the caller's field (`cost-lines.ts:2617-2622` explains why it must survive the strip).
- The trigger then snapshots terms and the due date on INSERT; no router code writes `due_date`.
- The refusal message names the unit the caller already sees on the lines. If the caller is denied `settlementUnit` (field axis), the message would still name it; D3's sub-question (the value appears in the error, not in a row) is settled with its recommendation: use the generic wording _"Two different companies share one settlement unit on the selected lines…"_ when `settlementUnit` is a denied field for the caller (check with `stripDeniedFields`).

### 4.3 A title for one bill only (Phase 1) → D6

After grouping, if `buckets.length > 1` and `input.invoiceTitle` survived `stripDeniedFields` and is non-empty → `BAD_REQUEST` _"An invoice title applies to one bill; this selection makes N. Leave it blank and each bill takes its own settlement unit."_ Checked before any write. The web never sends it on a split, so no web change.

### 4.4 The hand-off from the job (Journey 3; Phase 2) → D4

- `order.$orderId.expenses.tsx:928`: `<Link to="/expenses/cost-lines" search={{ orderId, status: "bill_not_established" }}>`. `orderId` is the route param already in scope; `status` uses the existing enum value (confirm the literal in `EXPENSE_STATUSES` at the base commit).
- `cost-lines.tsx` chip list (`:1640-1715`): add `f("orderId", "Order")`. The chip shows the raw id; if `chipFieldsFor` supports a display formatter, show the job number from the first listed row's `order.jobNumber` instead (re-read `components/list-page/use-url-filters.ts` first; do not build a new chip component).
- The link's sentence (`:926-932`) gains "for this job" wording only if Wilfred wants copy changed; grep the worktree for the sentence before editing it (shared copy rule).

### 4.5 Split by order (Journey 3; Phase 2) → D5

- New state `groupByOrder` beside `groupByTaxRate` (`cost-lines.tsx:1061`), reset on open (`:1116-1123`), sent in the payload (`:1293`).
- Preview key (`:1078-1084`) appends `groupByOrder ? (l.orderId ?? "") : ""`, matching the server's key order (`cost-lines.ts:2523-2534`). Add `orderId: string | null` to the `CostLine` interface (`-cost-lines.columns.tsx:195`); `costLines.list` already returns the full row (`line: costLine`, `cost-lines.ts:484`).
- Preview row text (`:1192-1196`) appends ` · <order.jobNumber ?? orderNo ?? "No order">` when splitting by order, and ` · <branch name>` when the preview holds two buckets that differ only by branch. React key uses the full group key.
- The note (`:1220-1223`) becomes "Settlement unit, attribute, currency and branch always split."
- Checkbox label **Also split by order**, beside **Also split by tax rate**. Applies on the 全选 path too (the server honours it there).

### 4.6 Data model

**No schema change and no migration under the recommended options.** D3-A reads `company` (existing unique index); D2-A adds a row lock; the trigger from 0062 is unchanged. D7-B would be an owner-run data UPDATE, not a migration.

### 4.7 API contracts (input shape unchanged)

| Procedure | Change | New refusals |
|---|---|---|
| `costLines.createBill` | Lines read `FOR UPDATE` in `(created_at, id)` order (X30) inside the transaction; all guards and totals on the locked rows (D2-A); gate on resolved ids and `tx` (D1) | CONFLICT gate sentence on the 全选 path (was: none) |
| `costLines.createBill` | Bill `settlementCompanyId` from the bucket's single id, else exact-name company (D3-A) | BAD_REQUEST two companies under one unit |
| `costLines.createBill` | `invoiceTitle` with more than one bucket (D6-A) | BAD_REQUEST title on a split |
| `costLines.createBill` output | Unchanged shape. `bills[]` rows are masked as today | — |

Journey steps served: gate → Journey 1 step 2; company → Journey 2 steps 2–3; `groupByOrder` (existing input) → Journey 3 step 3.

### 4.8 Key decisions (all Decided 2026-09-21; §9 keeps the three approaches of each)
- Gate-ids fix owner → D1 (Chosen B; X28)
- In-transaction locked read → D2 (Chosen A, `(created_at, id)` order per X30)
- Bill counterparty → D3 (Chosen A)
- Job → bill hand-off → D4 (Chosen A)
- Split-by-order default → D5 (Chosen A)
- Title on a split → D6 (Chosen A)
- Existing bills → D7 (Chosen A)

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- D1, D2, D3, D6 are Decided (B, A, A, A). Step 22 owns the whole `createBill` body, so Phase 1 has no predecessor on step 21; step 21 Phase 1 merges after it (X28, §7.6).
- Re-check before Task 1.1: probe 22-P1 (D1/D2 urgency); before Task 1.2: 22-P4, 22-P5 (D3), read by Wilfred. If a probe contradicts the choice, stop that task and re-plan.
- Re-locate every anchor in `cost-lines.ts`, `writer.ts`, `gates.ts`, `cost-lines.tsx` and `order.$orderId.expenses.tsx` **by symbol** at the base commit; steps 10, 11, 15 (and 20, 21 once planned) shift lines in `cost-lines.ts`.

### Phase 1 — What `createBill` checks is what it bills (findings A, B, C, F)

**Delivers:** Journey 1 and Journey 2 end to end.
**Dependencies:** D1-B, D2-A, D3-A, D6-A (Decided). Step 15 Phase 3 (`costLines.create` `expense_entry`) and steps 10/11 (`importFromQuote`) are different functions; either order, keep their calls.

- **1.1** Move the line read, the count/billed/J4 checks and the gate call inside the transaction; read `FOR UPDATE` ordered by `(created_at, id)` (X30); pass the resolved `costLineIds` and `tx` to `assertGatesCleared` (§4.1). Map a Postgres `40P01` (deadlock) raised inside the transaction to CONFLICT, so a lock-order miss is a retry, not a 500 (X30). Update the handler docblock ("Atomic: …", `:2384-2386`) to say the lines are locked for the whole call. Files: `packages/api/src/routers/expense/cost-lines.ts`. · **Agent A (backend)**
- **1.2** Company resolution per bucket (§4.2): pure `pickBucketCompany(lines)` returning `{ id } | { conflict: true } | { id: null }` in `packages/api/src/modules/expense/bill-company.ts` [NEW] with its unit test; the name lookup and the refusal in the handler; `settlementCompanyId` passed to `billWriter.create` and to the `created[]` row only as today (the output shape does not gain the field). Files: `packages/api/src/modules/expense/bill-company.ts` [NEW], `packages/api/src/modules/expense/bill-company.test.ts` [NEW], `packages/api/src/routers/expense/cost-lines.ts`. · **Agent A (backend)**
- **1.3** Title on a split refused (§4.3). Files: `packages/api/src/routers/expense/cost-lines.ts`. · **Agent A (backend)**
- **1.4** Tests.
  - **PGlite router suite** `packages/api/src/routers/expense.create-bill.test.ts` [NEW] (a new file so step 21's likely edits to `expense.review.test.ts` do not collide; fixture copied from `expense.filter-scope.test.ts`'s `describe("createBill — 「不勾选=全选」")` at `:273` and the flow seeding in `routers/audit-review.test.ts`):
    Cases 1–4 are the `createBill` gate cases for both plans (X28): step 21 Task 1.2 drops its duplicates of them and adds only its `withdraw_pending` case.
    1. Gate ticked, 全选 over one passed + one never-submitted line → CONFLICT naming "1 of 2"; zero `bill` rows; both lines `bill_id IS NULL`.
    2. Gate ticked, ticks over the same two → the same CONFLICT (unchanged behaviour, now pinned).
    3. Gate ticked, 全选 over two passed lines → one bill.
    4. Gate unticked, 全选 over a never-submitted line → one bill (J4 floor only).
    5. Bucket where line 2 (not line 1) has `settlementCompanyId = C` → bill `settlement_company_id = C`.
    6. No line has an id; unit "Acme Sdn Bhd" equals a company's name → bill points at it; unit "acme sdn bhd" → `null`.
    7. Two lines, same unit, ids C1 and C2 → BAD_REQUEST, nothing written. With `groupByOrder` and the two lines on different orders → two bills, each with its own id.
    8. Split selection with `invoiceTitle: "X"` → BAD_REQUEST; one-bucket selection with a title → title stored.
    9. Refusal order: a foreign-scope id with an unapproved line → BAD_REQUEST not found, not CONFLICT.
  - **Due date through the trigger:** in the same new suite, install the 0062 trigger the way `routers/expense/bills.terms.test.ts` does (replaying the migration file, never restating it), give the company `days_payable = 30`, bill → `due_date = created_at::date + 30`. Do not edit `test-schema.ts` (adjacent defect 5).
  - **Real Postgres** — add this plan's own named `it`s to `packages/api/src/routers/expense.concurrency.test.ts` (existing, `describe.skipIf(!TEST_URL)`), never editing another plan's (X35): connection A opens a transaction, `UPDATE cost_line SET amount = '150' WHERE id = L` (holds the row lock, uncommitted). Start `call(costLinesRouter.createBill, { costLineIds: [L] })` on the router's own client without awaiting. Wait until `pg_stat_activity` shows the router's backend waiting on a lock (poll with a 5 s cap) — under the fix it waits at the read; under the old code it waits at the claim, after inserting the bill. Commit A, await the call. Assert `bill.total_amount = '150'` and equals `sum(cost_line.amount)` for that bill. Run it once against the unfixed handler and record that it fails (total `1000`/seed amount). A second `it`: two `createBill` calls over lines `[L1, L2]` and `[L2, L1]` → one fulfils, one CONFLICT, no deadlock error in either rejection. Run with `DATABASE_URL_TEST` on the dev Neon branch, never production. Phase 1 changes lock order, so its PR also re-runs every case already in the file and pastes both the failing pre-change run and the passing run ("skipped" is not a pass; X35).
  - Re-run `expense.filter-scope.test.ts`, `expense.review.test.ts`, `expense.ledger.test.ts`, `expense.wave1.test.ts`, `expense.transaction-integration.test.ts`, `expense.rbac.test.ts`, `expense.numbering.test.ts`, `expense.batch.test.ts`, `collective-order.costs.test.ts`, `routers/expense/bills.terms.test.ts`, both `architecture.test.ts` files.
  Files: `packages/api/src/routers/expense.create-bill.test.ts` [NEW], `packages/api/src/routers/expense.concurrency.test.ts`. · **Agent A (backend)**

**Acceptance.**
- §10 Journey 1 and Journey 2 pass in the browser as `accountant`.
- The new suite and the re-run suites pass, judged by reading the output for `failed` and the `Test Files` line. The concurrency `it`s pass on the dev branch with `DATABASE_URL_TEST` set (the output lists them, not skipped), and the stale-total `it` was seen failing on the unfixed handler.
- `bun run check-types` output contains no `error TS` and no "failed".

### Phase 2 — Bill the job from the job (findings D, E)

**Delivers:** Journey 3 end to end.
**Dependencies:** Phase 1 merged (not a code dependency; the per-order split is safer once the counterparty rule is in). D4-A, D5-A (Decided). Task 2.1's link edit in `order.$orderId.expenses.tsx` merges after step 20 Phase 3 (X36).

- **2.1** Fee-page link with `orderId` and `status` (§4.4); `orderId` chip on the ledger. Grep `apps/web/src` for the link sentence before touching copy. Files: `apps/web/src/routes/_next/order.$orderId.expenses.tsx`, `apps/web/src/routes/_next/expenses/cost-lines.tsx`. · **Agent B (frontend)**
- **2.2** **Also split by order** checkbox, preview key, row text with job number and (when needed) branch, full React key, note text (§4.5); `orderId` on the `CostLine` interface. Files: `apps/web/src/routes/_next/expenses/cost-lines.tsx`, `apps/web/src/routes/_next/expenses/-cost-lines.columns.tsx`. · **Agent B (frontend)**
- **2.3** Web tests: if `cost-lines.tsx` exports its grouping (it does not today), extract the preview key to a pure `billGroupKey(line, { groupByTaxRate, groupByOrder })` in `apps/web/src/routes/_next/expenses/-bill-group-key.ts` [NEW] with `-bill-group-key.test.ts` [NEW] pinning it against the server's key order (branch included, order last). Run `apps/web/src/architecture.test.ts` and `e2e/specs/cost-lines.control-row.spec.ts`. Files: `apps/web/src/routes/_next/expenses/-bill-group-key.ts` [NEW], `apps/web/src/routes/_next/expenses/-bill-group-key.test.ts` [NEW], `apps/web/src/routes/_next/expenses/cost-lines.tsx`. · **Agent B (frontend)**

**Acceptance.**
- §10 Journey 3 passes in the browser, including the substring edge case.
- `bun run check-types` clean (read the output); `-bill-group-key.test.ts` and `cost-lines.control-row.spec.ts` pass.
- Mobile: at 400 px the dialog's two checkboxes and the preview rows wrap without horizontal scroll.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.4 | `packages/api/src/routers/expense/cost-lines.ts`, `packages/api/src/modules/expense/bill-company.ts` [NEW], `packages/api/src/modules/expense/bill-company.test.ts` [NEW], `packages/api/src/routers/expense.create-bill.test.ts` [NEW], `packages/api/src/routers/expense.concurrency.test.ts` | `packages/api/src/modules/governed/writer.ts`, `packages/api/src/modules/audit/gates.ts`, `packages/api/src/routers/expense/shared.ts`, `packages/api/src/routers/expense/filter-scope.ts`, `packages/api/src/routers/expense/bills.terms.test.ts`, `packages/db/src/migrations/0062_payment_terms_due_date.sql`, `packages/db/src/schema/company.ts` |

opus / high: a lock and transaction-boundary change in the money handler every bill goes through, proven only on real Postgres.
Run mode: single agent.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent B (frontend) | frontend-engineer | sonnet | medium | 2.1–2.3 | `apps/web/src/routes/_next/order.$orderId.expenses.tsx`, `apps/web/src/routes/_next/expenses/cost-lines.tsx`, `apps/web/src/routes/_next/expenses/-cost-lines.columns.tsx`, `apps/web/src/routes/_next/expenses/-bill-group-key.ts` [NEW], `apps/web/src/routes/_next/expenses/-bill-group-key.test.ts` [NEW] | `apps/web/src/components/list-page/use-url-filters.ts`, `apps/web/src/components/filter-scope-confirm.tsx`, `packages/api/src/routers/expense/cost-lines.ts` |

Run mode: single agent. Contract with Phase 1: none beyond the existing `groupByOrder` input.

**Schedule:** Phase 1 → Phase 2. They share no file, so Phase 2 may be built in parallel and merged second.
**Serialization points:** after each phase, `bun run check-types` (grep the output for `error TS` and `failed`; it can exit 0 while printing "failed"), both architecture tests, then restart `:3000` before any browser check (`bun --hot` does not reload `packages/api`).
**Commits:** the worktree may be shared. One committer at a time; confirm the index is empty before `git add`, and read every hunk.

**Smell test.**
- [x] Every task has exactly one owner.
- [x] No file is owned twice within a phase.
- [x] Every opus is justified; no haiku.
- [x] Each phase completes a journey (1+2, 3).

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`, 2026-09-21)

- **`costLines.createBill`.** Web: `cost-lines.tsx:1126` only (no other `createBill` in `apps/web/src`; `order.$orderId.expenses.tsx:280`, `order-form.tsx:1683, 2621` and `filter-scope-confirm.tsx:37` are comments or types). RPC: `seed/money.ts:169` (ticks, no title), `e2e/specs/audit.bill-queue.spec.ts:74` (one settlement set, asserts one bill), `e2e/specs/ledger-search.status-labels.spec.ts:103, 156` (one line). Tests: `expense.concurrency.test.ts`, `expense.filter-scope.test.ts`, `expense.review.test.ts`, `expense.ledger.test.ts`, `expense.wave1.test.ts`, `expense.corrections.test.ts`, `expense.cross-currency-writeoff.test.ts`, `expense.batch.test.ts`, `expense.transaction-integration.test.ts`, `expense.rbac.test.ts`, `expense.numbering.test.ts`, `expense.base-currency.test.ts`, `collective-order.costs.test.ts`, `counterparty-trim.test.ts`. None sends a title on a split; any that bills lines whose units exactly match a seeded company will now get that company on the bill (assertions on `settlementCompanyId`: `expense.ledger.test.ts:1162-1177` sends the id explicitly, so unchanged).
- **`assertGatesCleared`.** Signature unchanged; it already accepts a transaction (`gates.ts:65`).
- **`costLineWriter` `claim`.** Unchanged; its re-lock becomes a no-op inside the same transaction.
- **`costLines.update` / `delete` / `unbill`.** Unchanged; they now wait on a `createBill` in flight instead of racing it.
- **Bill `settlement_company_id` readers.** The 0062 trigger (due date), `modules/export/invoice-document.ts` (payment terms on the document), `modules/workbench/fee-alert.ts` and `routers/report.ts` (ageing, due date), `modules/export/month-end.ts`. All already handle a set company; more bills will now have one.
- **`/expenses/cost-lines` search.** `orderId` and `status` already in `costLinesSearchSchema` (`:126`, `:178`), shared with `/approve/cost` (`routes/_next/approve/cost.tsx:4`); the new chip also appears there when `orderId` is set, which is harmless.

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| 全选 in a gated org over an unapproved fee | 200, bill created | 409 gate sentence | API-only |
| Ticks in a gated org over an unapproved fee | 409 | 409 (unchanged) | – |
| Fee edited while its bill is being created | both 200; bill total stale | edit waits then 409 "billed concurrently", or bill reads the new amount | API-only |
| Two overlapping `createBill` calls | one 200, other 409 or a deadlock 500 | one 200, other 409 | API-only |
| Bill from job-flow fees, unit = a directory company | no company, no due date | company and due date | API-only |
| Bucket with two company ids | one bill naming the first | 400 | API-only |
| RPC title on a split | stamped on every bill | 400 | API-only; web never sends it |
| Fee page → Cost Detail | whole ledger | the job's unbilled fees, chipped | Web-only |
| Per-order split | not reachable | checkbox | Web-only; server already accepts it |

### 7.3 Behaviour change for existing orgs

- **Phase 1 changes every org on deploy.**
  - Gated orgs (22-P1) lose the 全选 bypass immediately. Accountants used to billing large unapproved sets that way will be refused with a count.
  - Every new bill whose unit exactly matches a directory company gains that company and, where the company has **Days payable**, a due date from its creation date. The workbench Overdue chip and ageing start seeing those bills as they pass due. 22-P4 sizes how many bills this would have affected so far.
  - A few selections will be refused for two companies under one unit (22-P5 sizes it).
  - Existing bills do not change (D7-A).
- **Phase 2** changes the fee page link and adds an unticked checkbox; nothing billed differently unless an operator ticks it.

### 7.4 Nullable assumptions

- `cost_line.settlement_unit` nullable; a null/blank unit skips the name lookup.
- `cost_line.settlement_company_id` and `bill.settlement_company_id` nullable FKs to `company` (`schema/expense.ts:82, 264`).
- `company.days_payable` nullable; a company with none leaves the bill dateless (trigger `:155-161`), as intended.
- `cost_line.order_id` nullable; with **Also split by order**, standalone fees form their own group (server key `""`), labelled "No order".
- `cost_line.audit_status` nullable; J4 treats `null` as billable (unchanged).

### 7.5 Deployment coupling

- Phase 1 is API-only. Phase 2 is web-only and depends on no new API field. Either can deploy alone.
- Build `apps/web` before deploy so a partial deploy does not split server and web (memory `alchemy-partial-deploy-splits-the-stage`); neither phase breaks under that split.

### 7.6 Merge order against steps 04–27

| Plan / task | Shared code | Handling |
|---|---|---|
| 10 Task 2.2 | `cost-lines.ts` `importFromQuote` (`:2177`) | Different function. Either order; re-locate by symbol. |
| 11 Task 3.1 | `cost-lines.ts` `importFromQuote` caller types | Different function. Either order. |
| **15 Task 3.3** | `cost-lines.ts` `costLines.create` (`expense_entry` gate after `refuseIfOrderLocked`) | Different function. Either order. **Step 22 must keep step 15's gate call in `costLines.create`**; it does not touch that handler. Step 15's `lading.ts` gate calls are untouched. |
| 12 | `cost_line.order_no` writers (`saveChildren`, `costLines.create`) | No code overlap. Phase 2's preview label prefers `order.jobNumber` over `orderNo`, so it reads correctly before and after step 12. |
| 02 | `routers/expense/bills.ts` `invoice` | No overlap (step 22 does not edit `bills.ts`). |
| 04–09, 13, 14 | quotation / order files | No overlap. |
| **20 (no plan yet)** | `order.$orderId.expenses.tsx` (its fix at `:629`; this plan's link at `:928`); `saveChildren` / bridge `settlement_company_id` (ledger `identity`) | Different lines in one web file: 22 P2 merges after 20 P3, which runs step 20's page edits in one lane (X36). D3-A and a step-20 source fix are complementary: once lines carry the id, D3's name lookup simply stops being reached. Step 20 must not remove the bucket rule. |
| **21 (no plan yet)** | `cost-lines.ts:2506` — the **same line** (its `fixes[0]`); also its `update` verb (`:333`), `delete` verb (`:429`) and bulk rate (`:2115`) | **D1-B (X28).** Step 22 owns the whole `createBill` body, `:2506` included. Step 21 Phase 1 merges after 22 P1, adds only `withdraw_pending` to the J4 set, drops its `reviewFloorGate` on the `claim` verb, and edits its other three sites. (D1-A, step 21 first, was the rejected alternative.) Step 21's cost-line tests should not go in `expense.create-bill.test.ts` (this plan's file); its submit-vs-`createBill` interleave must pass on 22's lock without the claim gate. |
| 23 (no plan yet) | `bills.ts` (re-total, under-review freeze) | No overlap. Step 23 inherits bills that now name a company. |
| 24–26 (no plans yet) | `bills.ts`, invoices, payments | No overlap. Due dates now exist on new bills; step 25's document already prints terms from the company. |
| **27** (planned; `step-27-month-close-truth.md`, settled 2026-09-21) | `cost-lines.tsx` (its export mount at `:2239`, not `:1944`); ledger `never-overdue`, `base-currency` (s27 parts: ageing, cross-branch totals) | Different region of the same web file: the second to merge rebases; step 27 Task 1.5 merges after 22 P2 (X36). Step 27 reads the due dates D3 starts producing. |

**Required order:** **22 P1** → 21 P1 (X28); 20 P3 → **22 P2** (X36); 22 P2 → 27 Task 1.5 (X36). Suggested around them: 15 P3 → **22 P1** → 21 P1 → 20 → **22 P2** → 27, each on its own worktree, sequentially.

### 7.7 Read-only production probes (SELECT only; Wilfred runs them with the owner's override; none blocks writing code)

```sql
-- 22-P1 Which orgs tick "Create bill" on Cost review (D1/D2 urgency; Journey 1 reach)
select f.organization_id, f.id as flow_id, f.enabled,
       exists (select 1 from audit_flow_gate g
               where g.flow_id = f.id and g.gate_key = 'create_bill') as create_bill_ticked
from audit_flow f
where f.trigger_type = 'cost_line'
order by f.organization_id;

-- 22-P2 Residue of the bypass: billed lines whose latest cost review is not 'passed', in orgs that tick the gate now
--        (audit_flow_gate has no created_at, so this also counts lines billed before the gate was ticked)
with gated as (
  select f.organization_id
  from audit_flow f join audit_flow_gate g on g.flow_id = f.id
  where f.trigger_type = 'cost_line' and f.enabled and g.gate_key = 'create_bill'),
latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'cost_line'
  order by resource_id, submitted_at desc, created_at desc)
select cl.organization_id, coalesce(l.status, 'never_submitted') as latest,
       count(*) as billed_lines, count(distinct cl.bill_id) as bills
from cost_line cl
join gated g on g.organization_id = cl.organization_id
left join latest l on l.resource_id = cl.id
where cl.bill_id is not null and coalesce(l.status, 'never_submitted') <> 'passed'
group by 1, 2 order by 1, 2;

-- 22-P3 Bills whose stored total differs from the sum of their current lines (finding B residue, any cause)
select b.organization_id, b.id, b.bill_no, b.status, b.total_amount,
       coalesce(sum(cl.amount), 0) as line_sum, count(cl.id) as lines, b.created_at
from bill b left join cost_line cl on cl.bill_id = b.id
group by b.organization_id, b.id, b.bill_no, b.status, b.total_amount, b.created_at
having b.total_amount <> coalesce(sum(cl.amount), 0)
order by b.organization_id, b.created_at;

-- 22-P4 Bills with no company, and how many D3-A would have resolved (D3, D7)
select b.organization_id,
       count(*) as bills,
       count(*) filter (where b.settlement_company_id is null) as no_company,
       count(*) filter (where b.settlement_company_id is null and exists (
          select 1 from cost_line cl where cl.bill_id = b.id and cl.settlement_company_id is not null)) as a_line_had_one,
       count(*) filter (where b.settlement_company_id is null and exists (
          select 1 from company c where c.organization_id = b.organization_id
                                   and c.name = btrim(b.settlement_unit))) as unit_matches_a_company,
       count(*) filter (where b.due_date is null) as no_due_date
from bill b
group by 1 order by 1;

-- 22-P5 Bills whose lines name two or more different companies (D3-A would refuse these selections)
select b.organization_id, b.id, b.bill_no, b.settlement_unit,
       count(distinct cl.settlement_company_id) as companies
from bill b join cost_line cl on cl.bill_id = b.id
where cl.settlement_company_id is not null
group by b.organization_id, b.id, b.bill_no, b.settlement_unit
having count(distinct cl.settlement_company_id) > 1
order by b.organization_id, b.bill_no;

-- 22-P6 How often a bill spans several orders today (D5 default)
select x.organization_id,
       count(*) filter (where x.orders > 1) as multi_order_bills,
       count(*) as bills
from (select b.id, b.organization_id, count(distinct cl.order_id) as orders
      from bill b join cost_line cl on cl.bill_id = b.id
      group by b.id, b.organization_id) x
group by 1 order by 1;

-- 22-P7 Archived ("trash") lines that sit on a bill (adjacent defect 1, sizing only)
select organization_id, count(*) as archived_billed_lines, count(distinct bill_id) as bills
from cost_line
where archived and bill_id is not null
group by 1 order by 1;
```

### 7.8 Blocking prerequisites

- D1, D2, D3, D6 (Phase 1) and D4, D5 (Phase 2) are Decided; D7 blocks nothing in code.
- Step 20 Phase 3 merged — blocks Task 2.1's merge (X36). Phase 1 has no step-21 predecessor (X28).
- `DATABASE_URL_TEST` for a dev Neon branch available to Agent A — blocks Phase 1 acceptance (concurrency test). CI has no `DATABASE_URL_TEST`; the PR pastes the real-Postgres output.
- Probe re-checks: 22-P1 before Task 1.1 (reach of Journey 1's new refusal, for the release note); 22-P4 and 22-P5 before Task 1.2 (D3); 22-P6 before Task 2.2 (D5). If a probe contradicts the choice, stop that task and re-plan.

## 8. Cross-Cutting Concerns

- **Errors.** Gate refusals keep `assertGatesCleared`'s CONFLICT wording. New refusals are BAD_REQUEST with a sentence that says what to do (correct the lines; leave the title blank). All run before any write, inside the transaction, so a refusal rolls back nothing because nothing was written. The dialog already shows server messages through the global mutation toast (`utils/orpc.ts:63-90`).
- **Testing.** PGlite at the API boundary (`expense.create-bill.test.ts` [NEW], `bill-company.test.ts` [NEW]); the due-date rule through the replayed 0062 trigger; the lock only on real Postgres (`expense.concurrency.test.ts`), because PGlite serialises every transaction on one connection and a lock test there passes on the old code too; web key test; browser proof in §10.
- **Migration.** None under the recommended options.
- **Rollback.** Both phases are plain reverts; no phase writes data outside normal bill creation. Bills created with a resolved company keep it after a revert (correct data; the trigger's directional rule forbids moving their due date).
- **Audit trail.** Unchanged: `expense.bill.create` per bill and one `expense.costLine.claim` batch row. The bill's audit meta (`costLineIds`, `splitInto`, `:2649-2652`) could add `settlementCompanyResolvedBy: "line" | "name" | null`; recommended, so a later reader can tell a name match from a picked company. Refusals write nothing.

**Performance & Scalability**
1. **Pagination.** Unchanged.
2. **SQL-side filtering.** The selection is still resolved in SQL (`resolveCostLineSelection`); the locked read is one `IN` query of at most 2000 ids.
3. **N+1.** The company lookup is one indexed query per bucket that has no id, bounded by the bucket count (the same loop already runs `reportingCurrency` and `resolveRate` per bucket).
4. **Index coverage.** `company_org_name_uidx (organization_id, name)` serves the lookup; `cost_line` primary key serves the locked read.
5. **Write atomicity.** Improved: guards, totals and writes now share one transaction and one snapshot of the lines.
6. **Row locking.** Up to 2000 `cost_line` rows locked `FOR UPDATE` in `(created_at, id)` order (X30) for the duration of one `createBill` (sub-second for normal sets; a 2000-line 全选 holds them longest). Concurrent edits to those fees wait, then get the existing "billed concurrently" CONFLICT. Overlapping bill calls queue instead of deadlocking.
7. **Connections/resources.** None new.
8. **Tenant isolation.** The locked read keeps `lineScope`; the company lookup filters `organization_id`.
9. **Payload size.** Unchanged.
10. **Hot path.** `createBill` is not a per-page-load path; each call gains at most one lookup per bucket.

## 9. Decision Register, Open Questions & Risks

**Statuses.** On 2026-09-21 Wilfred accepted the recommended option of every decision below, and every Proposed reading in `steps-20-26-crosscheck.md` X28–X40; where an X-item overrides this plan's own recommendation, the Chosen line says so. Each keeps its three approaches.

**D1: Which plan owns the gate-ids fix at `cost-lines.ts:2506`?** · Status: **Decided 2026-09-21 — Chosen: B (per X28)**

| | Approach | Consequence |
|---|---|---|
| **A** | Step 21 owns it (the SOP files it there). Step 22 depends on it and moves the corrected call into the transaction | Matches the SOP's filing. Step 22 Phase 1 cannot merge until step 21's fix lands, and one line of `createBill` has two plans' fingerprints on it. |
| **B** | Step 22 owns it in Task 1.1, together with the transaction move (Recommended) (Chosen) | One owner for the whole `createBill` body and one test file for its refusals. Step 21 records it as handed over and edits only its other three sites. |
| **C** | Both plans write it; the second to merge drops its copy | No coordination needed up front; the runbook carries a known conflict and a risk that neither drops the test. |

- **Recommendation: B.** The fix is one argument, but Task 1.1 rewrites the lines around it (the call moves into the transaction and takes `tx`), so a separate owner would merge into a handler that is being restructured.
- **Chosen: B** (Wilfred, 2026-09-21); crosscheck X28: step 22 Phase 1 owns the whole `createBill` body and merges first; step 21 Phase 1 follows, adds only `withdraw_pending` to the J4 set and drops its claim-verb `reviewFloorGate`.
- **Releases:** Task 1.1; §7.6 step 21 row.

**D2: How does `createBill` make its guards and its total match what it bills?** · Status: **Decided 2026-09-21 — Chosen: A, in `(created_at, id)` order (per X30)**

| | Approach | Consequence |
|---|---|---|
| **A** | Read the lines `FOR UPDATE`, ordered by `(created_at, id)` (X30; was: by id), inside the transaction; run every guard and compute every total on the locked rows (Recommended) (Chosen) | One snapshot for checks, totals and writes. Concurrent fee edits wait, then conflict. Overlapping calls queue instead of deadlocking. Needs a real-Postgres test to prove. |
| **B** | Keep the read outside; after the claim, recompute each bill's total from the claimed rows and update the bill | Fixes the total only. J4 and the gate still judge a stale read, and the bill row is written twice. Lock order stays unspecified. |
| **C** | Widen the claim pin to `amount` and `audit_status` equal to the values read | Refuses instead of waiting: correct but noisier (a harmless concurrent edit aborts the whole bill). Needs `writer.ts` pin plumbing for a per-row expected value. |

- **Recommendation: A.** It is the house pattern (step 15 D10-A, step 08 Task 1.2) and it closes all three windows at once.
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X30: the locked read orders by `(created_at, id)`, not `id`, the one line order every ledger writer takes; a `40P01` maps to CONFLICT.
- **Releases:** Task 1.1, the concurrency test.

**D3: Which company does a new bill point at?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | The bucket's single non-null `settlementCompanyId`; if none, the organisation's company whose name exactly equals the trimmed unit; if the bucket holds two different ids, refuse (Recommended) (Chosen) | Job-flow bills get a company and a due date from day one, including lines already in the ledger. Group key and preview unchanged. A rare new refusal. An exact name match is a heuristic, bounded by `company_org_name_uidx`. |
| **B** | The bucket's single non-null id, refuse on two; no name lookup (leave job-flow lines to step 20's source fix) | No heuristic in money code. Until step 20 lands, and for every line entered before it, job-flow bills stay dateless — the ledger's `never-overdue` stays open. |
| **C** | Add `settlementCompanyId` to the group key (split by company) | Never merges two companies, but a line with the id and a line without split into two bills for the same customer; the web preview must change too; no fix for all-null buckets. |

- **Recommendation: A.** It is the only option that gives today's happy path a due date without a data backfill, and the name index makes the match unambiguous. Probe 22-P4 shows how many bills it would have resolved; 22-P5 how many selections it would refuse.
- **Sub-question (settled with the recommendation):** when the caller is denied the `settlementUnit` field, should the refusal name the unit? Recommended: no — generic wording (§4.2).
- **Chosen: A** (Wilfred, 2026-09-21); sub-question: generic wording.
- **Releases:** Task 1.2.

**D4: How does a job hand off to billing, and who owns it?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Step 22 owns it. The fee page link carries `orderId` and `status=bill_not_established`; the ledger gains an **Order** chip for `orderId` (Recommended) (Chosen) | One-click, exact scope, visible and removable. 全选 then bills exactly the job's unbilled fees. Two small web edits. |
| **B** | Link with `orderNo=<job number>` (visible in the existing Order No. filter) | No new chip, but `orderNo` is a substring match: J1 also lists J10's fees, and 全选 would bill them. |
| **C** | Mount **Create bill** on the order's fee page itself | Best for the operator, but a second mount of a money dialog, its own selection model, and the fee page is step 20's; larger than the defect. |

- **Recommendation: A.** The break lands on step 22's screen; the fix is a link prop and one chip entry. Step 20's plan is told (it edits the same file elsewhere).
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X36: Task 2.1 merges after step 20 Phase 3, and step 27 Task 1.5 after 22 P2.
- **Releases:** Task 2.1.

**D5: What is the default of "Also split by order"?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Unticked, like the tax-rate box and the server default (Recommended) (Chosen) | Month-end statements to one counterparty keep working unchanged; per-shipment billing is one tick. |
| **B** | Ticked by default | Per-shipment billing by default; month-end statements need an untick every time. Changes today's bill count for anyone who does not look. |
| **C** | Always split by order, no checkbox | Every bill has one order (and could take the shipment's rate date), but month-end consolidated bills become impossible. |

- **Recommendation: A.** 22-P6 shows how often bills span several orders today; if that is near zero, B is worth reconsidering.
- **Chosen: A** (Wilfred, 2026-09-21).
- **Releases:** Task 2.2.

**D6: What happens to an `invoiceTitle` sent for a selection that makes several bills?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Refuse with BAD_REQUEST before any write (Recommended) (Chosen) | The API matches the web's rule; a stale or scripted caller learns why. |
| **B** | Ignore it on a split; each bill takes its own unit | Never wrong on the bill, but silently drops what the caller sent. |
| **C** | Leave as today | One counterparty's name on several bills, from any non-web caller. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).
- **Releases:** Task 1.3.

**D7: What about bills that already exist?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Report only: Wilfred reads 22-P2, 22-P3, 22-P4, 22-P5; no data change (Recommended) (Chosen) | No live bill changes under anyone. Old bills stay dateless and any stale totals stay until someone acts on the list. |
| **B** | An owner-run, reviewed `UPDATE bill SET settlement_company_id = …` for bills with no company whose unit exactly matches a company, sized by 22-P4 first | The 0062 BEFORE UPDATE arm fills terms and a due date from each bill's **creation** date, so old unpaid bills appear overdue on the workbench at once. Correct, but a visible jump for finance. |
| **C** | Unbill and rebill affected bills | Touches invoiced and approved bills; not possible for many (unbill refuses invoiced lines). |

- **Recommendation: A**, with B as a later owner decision taken with 22-P4 in hand and a note to finance.
- **Chosen: A** (Wilfred, 2026-09-21).
- **Releases:** nothing in code.

### Risks

- **Gated orgs lose the 全选 shortcut over unapproved fees on deploy.** Likely where the gate is ticked; 22-P1 names them. → Release note: "filter Audit Status first".
- **Row locks make a fee edit wait during a large 全选.** Low impact; sub-second in normal use, longest for 2000 lines. → Accepted; the edit then conflicts with the existing sentence.
- **Name match assigns a company the operator did not pick.** Low: exact, trimmed, org-unique match only. → Audit meta records how the company was resolved (§8); D3-B is the fallback.
- **New due dates light up the Overdue chip for new bills.** Intended; step 27 owns ageing. → Mention in the release note.
- **PGlite cannot prove the lock.** Certain. → Real-Postgres `it` on the dev branch, seen failing first.
- **Step 21 and step 22 both edit `:2506`.** Resolved by D1-B (X28). → Step 22 owns the `createBill` body and merges first; step 21 adds only `withdraw_pending` after it; §7.6.
- **Blank-vendor payables still group into one bill addressed to nobody.** Accepted known gap (crosscheck X32): no plan adds a blank-settlement-unit refusal to `createBill`; D3-A's name lookup skips a blank unit and leaves `null`. A small follow-up (a Task 1.3b) is not assigned; 20-P10 sizes it.
- **Line numbers drift.** Certain (steps 10, 11, 15, 20, 21 edit `cost-lines.ts`). → Locate by symbol.
- **A stale `:3000` makes browser checks pass on old code.** High. → Restart after every `packages/api` change and check the process start time.

### SOP text vs code (Phase 0 wins)

| # | SOP claims | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| 1 | steps[22].what: "optionally grouping by tax rate and **splitting one bill per order**" | No web control sends `groupByOrder`; only RPC can (`cost-lines.tsx:1286-1306`) | Code (Phase 2 adds it) |
| 2 | steps[22].what: "Mixed … settlement party … cannot land in one bill" | The key is the unit **text** (`:2524`); two companies with the same unit text merge, and the bill names the first line's company (`:2638`) | Code (D3) |
| 3 | golden step 8: toast "Bill B… created" | Bill numbers are `NCT-B-YYYYMM-NNNN` (`shared.ts:305-308`), so the toast reads "Bill NCT-B-… created" | Code |
| 4 | golden step 5: "Settlement unit, attribute and currency (and owning branch) always split" | True in code; the dialog's own note omits branch (`cost-lines.tsx:1220-1223`) | Code (Task 2.2 fixes the note) |
| 5 | before: "If a tenant ticked the cost-line Create bill gate, every selected line must have passed review" | Only for ticks; bypassed on 全选 (`:2506`, `gates.ts:76`) — the SOP's own pitfall says so | Code (Task 1.1) |
| 6 | writes: "settlementCompanyId copied from the first line" | Accurate; the consequence (no due date on job-flow bills) is not stated | Code (D3) |
| 7 | writes: "Bill exchange rate … null when missing" | Also null when neither an org base currency nor a branch currency is set (`:2595-2615`); same-currency is `"1"`, not null | Code |
| 8 | pitfall: "Lines from different orders to the same settlement unit merge; the dialog has no per-order split" | Accurate at HEAD | Code (Phase 2) |
| 9 | Ledger `base-currency`: "There is no organisation base currency" | An optional org base currency exists (`org_setting.base_currency`, `orgBaseCurrency`, `modules/setting/fx-settings.ts:187-224`), settable in Parameters; bills fall back to the branch currency when unset | Code (no step 22 change) |
| 10 | break after 21: "its one link to the fee ledger carries no filter — even though that ledger accepts an order filter" | Accurate: `order.$orderId.expenses.tsx:928`; the ledger accepts `orderId` (`cost-lines.tsx:178`) but shows no chip for it | Code (D4) |
| 11 | role: "expense.bill.create to create bills" | Held via the `expense` root by admin, branch-manager, accounting; ops cannot bill (`roles.ts:90, 104, 158, 175`) | Code |

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000. One worktree's servers at a time.
**Preconditions:**
- A freshly seeded audit e2e org: `bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>`. Re-read `ACTORS` at the base commit (the fixture has uncommitted edits in `nct-layout`). At HEAD the actors are owner, directorA, directorB, accountant, salesperson, managerA, managerB, viewer. **Biller: `accountant`** (holds the `expense` root). **Flow editor: `owner`.** **Company creator: `managerA`** (branch-manager) or `owner`.
- Company **S22 Trading** with **Days payable 30**; a second company **S22 Other**.
- Order **O1** (job J-S22-1, client S22 Trading) and **O2** (job J-S22-10, client S22 Trading), each with two receivable fees entered on `/order/<id>/expenses` (so their unit is "S22 Trading" and no company id), all approved at `/approve/cost`.
- Confirm the actor with `fetch('/api/auth/get-session')` before each actor's steps. Restart `:3000` after the last `packages/api` edit.

**Migrations:** none. Confirm the journal still ends where the merged steps left it and that `0062_payment_terms_due_date.sql` is applied on the dev database (check `_journal.json` and the database, not a command's exit code).

**Test commands** (read each output for `failed` and the `Test Files` line):
- Phase 1: `bunx vp test run packages/api/src/modules/expense/bill-company.test.ts packages/api/src/routers/expense.create-bill.test.ts packages/api/src/routers/expense.filter-scope.test.ts packages/api/src/routers/expense.review.test.ts packages/api/src/routers/expense.ledger.test.ts packages/api/src/routers/expense.wave1.test.ts packages/api/src/routers/expense.transaction-integration.test.ts packages/api/src/routers/expense.rbac.test.ts packages/api/src/routers/expense.numbering.test.ts packages/api/src/routers/expense.batch.test.ts packages/api/src/routers/collective-order.costs.test.ts packages/api/src/routers/expense/bills.terms.test.ts packages/api/src/architecture.test.ts`, then `DATABASE_URL_TEST=<dev branch URL> bunx vp test run packages/api/src/routers/expense.concurrency.test.ts` (confirm its tests are listed as passed, not skipped).
- Phase 2: `bunx vp test run apps/web/src/routes/_next/expenses/-bill-group-key.test.ts apps/web/src/architecture.test.ts`, then the Playwright spec `e2e/specs/cost-lines.control-row.spec.ts`.
- Every phase: `bun run check-types` (confirm `apps/web` ran; grep for `error TS`).

**Golden path — Journey 1 (Phase 1; `owner` edits the flow, `accountant` bills)**
1. As `owner`, Approval Process Setting → Cost review → tick **Create bill** → save.
2. As `managerA`, `/order/<O1>/expenses` → add a third fee "S22 UNREVIEWED 50" → Save (not submitted).
3. As `accountant`, `/expenses/cost-lines`, filter **Settlement Unit = S22 Trading**, **Expense Status = Not billed** → Search. Tick nothing → **Create Bill (全选)** → the notice names the count (5).
4. Press **Create Bills from 5 Lines** → error toast contains _"requires review approval first — 1 of 5 selected are not approved"_; `/expenses/bills` has no new bill; the five lines still read Not billed.
5. Tick the same five → **Create N Bills** → the same refusal (unchanged path).
6. Submit "S22 UNREVIEWED 50" from the Review menu; approve it at `/approve/cost`; repeat step 3–4 → toast _"Bill NCT-B-… created"_ (one bill: one unit, attribute, currency, branch).

**Golden path — Journey 2 (Phase 1; `accountant`)**
1. `/expenses/bills` → the bill from Journey 1 step 6 → **Due Date** = its creation date + 30 days; in the console `bills/list` (or the record) shows `settlementCompanyId` = S22 Trading's id.
2. Conflict check. The CompanyPicker writes the picked company's name as the unit (`cost-lines.tsx:670-685`) and names are unique, so the screen cannot produce this case; it arises from a company renamed after its lines were entered, or from RPC. In the console, call `costLines/create` twice with `settlementUnit: "S22 Trading"`, once with S22 Other's id and once with S22 Trading's id (other fields as a normal receivable fee). Reload `/expenses/cost-lines`, tick both → **Create Bill** → error toast _"… points at two different companies on the selected lines …"_; no bill.

**Golden path — Journey 3 (Phase 2; `accountant`)**
1. `/order/<O1>/expenses` → press **Cost Detail** under the grids → URL is `/expenses/cost-lines?orderId=<O1>&status=bill_not_established`; chips **Order** and **Expense Status** are visible; only O1's unbilled fees are listed.
2. Tick nothing → **Create Bill (全选)** → the count equals O1's unbilled fees → create → one bill; O2's fees still Not billed.
3. Remove the **Order** chip; filter **Settlement Unit = S22 Trading**, **Not billed**; tick one fee from each of O1 and O2 → open **Create Bill** → preview "1 bill will be created". Tick **Also split by order** → preview "2 bills will be created", rows end "· J-S22-1" and "· J-S22-10" → **Create 2 Bills** → toast lists two numbers; each bill's lines belong to one order.

**Edge case 1: substring trap (why D4-A uses `orderId`).** Filter **Order No. = J-S22-1** → the list shows O2's (J-S22-10) fees too. With the Journey 3 link instead, only O1's appear.

**Edge case 2: title on a split at the API.** In the console, POST `/rpc/costLines/createBill` with O1 and O2 line ids, `groupByOrder: true`, `invoiceTitle: "X"` → HTTP 400, message about one bill; no bill created.

**Edge case 3: stale total (dev branch, not the browser).** Proven by the real-Postgres `it` (Task 1.4) with a deterministic interleave; pass = `bill.total_amount` equals the sum of its lines after the edit commits; the same test against the unfixed handler fails (recorded in the PR). Judged by final row state, never by timestamps.

**Edge case 4: masked settlement unit.** As a role denied the `settlementUnit` field (if the seed has none, skip and rely on test 1.4.7 plus the D3 sub-question), the two-companies refusal uses the generic wording.

**Regression checks.**
1. Ticked single-line bill without the gate → created, invoice title prefilled and editable (unchanged).
2. **Also split by tax rate** still splits and previews correctly.
3. 全选 over more than 2000 lines → the cap refusal (unchanged).
4. `/approve/cost` still lists and decides; its URL accepts `orderId` and shows the new chip only when set.
5. `e2e/specs/audit.bill-queue.spec.ts` and `ledger-search.status-labels.spec.ts` pass.

**Mobile:** at 400 px, the Create Bill dialog's two checkboxes, the preview rows with job numbers and the Order chip wrap without horizontal scroll.

**Readiness: 7/10 — the defects are verified in code and the fixes are small; held back by the unrun lock proof (it needs a dev database) and unrun probes.**
- Seven decisions (D1–D7) Decided 2026-09-21; D1-B and D3-A shape Phase 1's code.
- The stale-total and deadlock findings are proven only by reading until the real-Postgres test runs.
- Probes 22-P1 to 22-P7 are unrun; 22-P4/22-P5 gate D3 and 22-P6 gates D5.
- Step 21's plan takes D1's owner for `:2506` as handed to step 22 (X28); step 20's plan must keep D3's bucket rule.

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and the Proposed reading of every cross-plan item in `steps-20-26-crosscheck.md` (X28–X40). Each §9 entry keeps all three approaches; only the status, the Chosen line and the text that described a decision as open were changed, plus the task text the overrides below required.

**Chosen:** D1-B · D2-A (`(created_at, id)` order, X30) · D3-A (sub-question: generic wording) · D4-A · D5-A · D6-A · D7-A.

**Crosscheck overrides as they land in this plan.** X28 → D1-B confirmed, with the order settled as 22 P1 → 21 P1: header cross-plan line, §5 prerequisites, Task 1.4 (cases 1–4 are both plans' gate cases), §7.6 step 21 row and required order, §7.8, Risks, readiness. X30 → the locked read orders by `(created_at, id)`, not `id`, and a `40P01` maps to CONFLICT: §1 decisions list, §4.1 sketch, §4.7, §4.8, Task 1.1, §8 item 6, D2. X32 → accepted known gap, no blank-settlement-unit refusal and no Task 1.3b: §9 Risks. X35 → this plan's own named `it`s in `expense.concurrency.test.ts`; 22 P1 is lock-changing, so its PR re-runs every case in the file and pastes the failing and passing runs: Task 1.4. X36 → 22 P2 merges after 20 P3, step 27 Task 1.5 after 22 P2: Phase 2 dependencies, §7.6 step 20 and 27 rows and required order, §7.8, D4. X40 → the §7.6 required-order line was corrected, since X28/X36 decide it; the other "no plan yet" lines stay as written. X29, X31, X33, X34, X37 → do not touch this plan. X38 → no migration under any Chosen option; no text change. X39 → the "SOP text vs code" rows stay an accepted unowned gap; no text change.
