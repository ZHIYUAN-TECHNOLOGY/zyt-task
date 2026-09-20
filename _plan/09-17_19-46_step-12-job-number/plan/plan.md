# Step 12: after step 11 numbers the job at conversion, Assign number becomes a repair that fills a blank number exactly once and brings the order's lines with it

**SOP step:** 12 "Stamp the job number by hand" · `/order/$orderId/edit` → Business information → Job Number → **Assign number** (also on the record page, `/order/sea-export/$orderId`)
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-17. This is the commit steps 04–11 were planned at. Every `file:line` below was found by searching for its symbol at that HEAD during this pass. Files tagged [NEW] do not exist yet.
**Tier:** **Standard** (3 phases). It is not Micro: Phase 1 writes four files (`collective-order.ts`, `architecture.test.ts`, `collective-order.numbering.test.ts`, and a [NEW] concurrency test), Phase 2 writes two more outside the code repo, and the plan serves four journeys. It adds no schema change, no migration, and no auth or scope change: the scoped load gains a row lock, and the `applyScope` predicate is byte-identical afterwards. §7 and §9 hold material cross-plan sequencing (steps 11, 14, 15). Phase 3 was optional; D3-A (decided 2026-09-17) takes it, which adds one handler change.
**Readiness (2026-09-17):** 9/10, and every §9 decision is Decided (Wilfred accepted every recommendation). What remains is real risk, not open choices: step 11 Phase 2 must merge (with the X11 widening in Task 2.4, else Task 1.2 runs as fallback) before Phase 1, and deploy before Phase 2; merge order 11 P2 → 12 P1 → 15 P1 → 14 P1 (X6/X7); the lock is proven only on the dev Neon branch (Task 1.4, output pasted into the PR because CI has no `DATABASE_URL_TEST`, X8); production probes P3, P5/P5b, P6/P7, P9 and P10 must be re-checked before the tasks named in §9; uncommitted e2e changes in nct-layout must be committed before Wave 6 (X16).
**Owns tracker item:** `nct-unnumbered` (`tracker/seed/tasks-nct.json`, `steps: [break-after 11, step 12]`), **only for the part step 11 does not already own.** No other tracker task names step 12.
**Does not own:** conversion minting the number, the conversion-line `orderNo`, or the D7-A re-stamp itself. Those are step 11 Tasks 2.1–2.5, all decided.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`), with server RPC prefix `/rpc` (`apps/server/src/index.ts:135`). Drizzle schema lives in `packages/db/src/schema`. TanStack Router file routes live in `apps/web/src/routes/_next`. Tests run on vitest over PGlite via `pushTestSchema` (`packages/api/src/test-schema.ts`, which pushes the whole schema index). The web dev port is 3101 (`apps/web/vite.config.ts:7`).
- **Working tree.** Beyond the `_plan/` and `docs/reference/` deletions named in the brief, `git status` also shows uncommitted edits to `e2e/fixtures/seed-cli.ts`, `e2e/fixtures/types.ts`, `e2e/playwright.config.ts` and `e2e/qa-manifest.ts`, plus untracked `e2e/specs/intake.golden-path.spec.ts` and `e2e/reporters/step-events.ts`. None of them mention the job number or Assign number (grep). This plan does not touch them. The executor must not revert them.

### What the step does today

- **The button.** `AssignJobNumberButton` lives in `apps/web/src/components/order-ledger/assign-job-number-button.tsx:136` and calls `client.collectiveOrder.assignNumber({ orderId })` (`:159`).
  - On success it invalidates every query and toasts `Job number X assigned` (`:181`).
  - `No number sequence configured for jobs` (`MISSING_SEQUENCE_MESSAGE`, `:26`) gets an **Open Numbering** action (`:194-208`). Every other error prints the server's wording as sent (`:216`).
  - `needsJobNumber` (`:45`) trims, so null, `""` and whitespace-only all count as unnumbered.
  - It is rendered in two places. The order form shows it when `isEdit && orderId && needsJobNumber(savedJobNumber)` (`apps/web/src/components/order-form.tsx:2403-2408`), where `savedJobNumber` is the server row (`:745-747`). The record page shows it when `needsJobNumber(raw.jobNumber)` (`components/order-ledger/order-record-page.tsx:112-113`).
  - These are the only two callers of the button, and the button is the only caller of `assignNumber` in `apps`, `packages` and `e2e` (grep).
  - `acceptAssignedJobNumber` (`order-form.tsx:1015-1021`) moves the form value and the `loadedRef` baseline together.
- **The handler.** `collectiveOrderRouter.assignNumber` is at `packages/api/src/routers/collective-order.ts:2770`, gated `requireNode(COLLECTIVE_ORDER.update)`. In order, it:
  1. runs `applyScope`;
  2. refuses a caller denied the `jobNumber` field with FORBIDDEN (`:2780-2782`);
  3. opens a transaction and runs a **plain scoped SELECT with no lock** (`:2784-2787`);
  4. returns NOT_FOUND if the row is missing;
  5. returns CONFLICT `This order already has job number X` if `hasJobNumber(existing)` (`:2791-2795`);
  6. calls `assertPostApprovalEditable` (`:2800`) and `assertUnlocked(existing, "renumbered")` (`:2801`, helper at `:547`);
  7. runs an allocate loop of up to `MAX_JOB_NUMBER_ATTEMPTS` (`:2288`) tries. No sequence gives CONFLICT (`:2808-2812`). Otherwise it runs `UPDATE collective_order SET job_number = candidate WHERE id = existing.id` inside a savepoint (`:2814-2820`), and retries on 23505;
  8. writes the audit row `collectiveOrder.assignNumber` with before and after `jobNumber` (`:2835-2842`);
  9. returns `maskRow`.

  It **never calls `assertNotUnderReview`**, and it **never touches `cost_line.order_no` or `lading.order_no`**.
- **Orders not created by conversion are already numbered automatically.**
  - `create` runs `insertOrderWithJobNumber` (`:2363`), which normalises a typed number (`:2369`), pre-checks it and catches 23505.
  - A caller denied the field gets an insert with no number (`:2396-2398`).
  - Otherwise the function allocates, retries, and inserts with **no number when the org has no `job` sequence** (`:2401-2407`).
  - The trade ledger's Add button goes to `/order/new` (`components/order-ledger/order-ledger-page.tsx:1085-1089`), which is the same `create`. `duplicate` resets the number and allocates too.
  - So `/order/new` and the sea-export ledger need **no step 12 work**.
- **Conversion does not number.** `convertToOrder` (`packages/api/src/routers/quotation.ts:3887`) inserts directly (`:3972`) with no `jobNumber`. Attached lines take `orderNo: q.quotationNo` (`:4151`). Carried lines take `orderNo: quote.quotationNo` (`modules/expense/bridge.ts:128`). The repo pins the gap with `it.fails("convertToOrder: the converted order carries a job number")` (`collective-order.numbering.test.ts:471`). **Step 11 Phase 2 closes all of this.** Nothing here repeats it.
- **Lines added later carry the order's number at that moment.** `saveChildren` (`collective-order.ts:3954`) reads `jobNumber` without a lock (`:3971-3993`) and inserts cost lines with `orderNo: order.jobNumber` (`:4453`). An unnumbered order therefore gets lines with `order_no IS NULL`. `costLines.create` also writes `orderNo: input.orderNo` as sent (`routers/expense/cost-lines.ts:1270`), and that value may be null on a line that has an `orderId`.
- **Numbering configuration.** `allocateDocNumber` (`modules/org-param/allocate.ts:28`) reads the sequence and then increments it in one UPDATE (`:48-62`). That UPDATE row-locks the `number_sequence` row until the caller commits. It returns null with no sequence. The seed is `{ docType: "job", prefix: "JOB", dateFormat: "yymm", cadence: "monthly" }` (`modules/org-param/seed.ts:82`), `serialWidth` defaults to 5 (`schema/org-param.ts:193`), and the seed runs from `routers/org.ts:129` with `onConflictDoNothing`. "JOByymm#####" is therefore the seed default, not a rule.
- **Schema.**
  - `job_number` is nullable text (`packages/db/src/schema/collective-order.ts:125`).
  - The partial unique index is `(organization_id, job_number) WHERE job_number IS NOT NULL AND job_number <> ''` (`:379-381`). A whitespace-only value passes that predicate.
  - `cost_line.order_no` is free text (`schema/expense.ts:58`), `bill_id` is at `:88`, and `cost_line_order_idx` is at `:190`.
  - `lading.order_no` is at `schema/lading.ts:163`. `resolveLadingOrder` / `resolveLadingOrders` (`modules/lading/resolve-order.ts:142`, `:217`) match it against `job_number`.
- **Permissions.** `COLLECTIVE_ORDER.update` covers the button. From `packages/api/src/roles.ts`: admin (`:93`), branch-manager (`:107`) and ops (`:169`) hold the `collectiveOrder` root, and sales holds `collectiveOrder.update` (`:142`). The SOP's "Sales · needs collectiveOrder write" is correct.
- **Architecture allow-list.** `packages/api/src/architecture.test.ts:488` (`insertOrderRow`), `:491` (`assignNumber :: update(collectiveOrder)`, with its guard comment at `:489-490`) and `:492` (`update`).

### Refinements to the finding and to the Phase 0 brief

| Claim | Verdict at HEAD |
|---|---|
| "conversion allocates nothing", "the lines it created keep the quotation number", "one invoice can print two numbers" | **Confirmed** (above). Step 11 Phase 2 owns the fix. |
| Two reference variants on one job | **Three.** Conversion lines hold `quotation_no`, lines added while the job was unnumbered hold **NULL** (`:4453`), and lines added after numbering hold the job number. Step 11 D7-A re-stamps only `order_no = quotation_no` (`step-11-convert-won-quote.md:240`), so the NULL lines stay NULL after Assign number. |
| The name "assignJobNumber" (SOP step 15 fix text, `sop.json:2247-2248`) | **Wrong name.** The procedure is `collectiveOrder.assignNumber`. |
| "saveChildren (:4756) … the same gap" (`sop.json:2247`), repeated in the brief | **Wrong handler.** `:4756` is `assertPostApprovalEditable` inside **`setAbnormalTags`** (`:4729`). `saveChildren` (`:3954`) has **no `assertPostApprovalEditable` at all**. It checks `locked` (`:3996`) and the per-content gates (`:4003+`). This matters to step 15, not here. Reported in §9 so step 15's plan starts from the right facts. |
| Evidence §6 of the brief: whether `update` is `:2848-2960` | Confirmed. `update` writes `rest.jobNumber` unnormalised (`:2933-2937`, through `stripDeniedFields`), and the 23505 message quotes the raw input (`:2944-2949`). |

### What step 12 still owns once step 11 Phase 2 has merged

1. **A1: the double-press lost update (new, data).** Two sessions both load the order as blank (`:2784`) and both pass `hasJobNumber`. The first allocates, holds the `number_sequence` row lock and stamps. The second blocks in `allocateDocNumber` until the first commits, then **reuses its stale `existing`**, takes the next serial and overwrites (`:2816-2819`, whose WHERE clause is `id` only).
   - One serial ends up used and appearing on no order.
   - Both audit rows say `before: null`.
   - The first operator's toast and form box show a number the order no longer holds.
   - After step 11 D7-A, the lines the first press re-stamped carry that lost number too.
   - Nothing tests this. The `assignNumber` describe (`numbering.test.ts:499-544`) has four sequential cases.
   - PGlite runs one connection, so a unit test cannot interleave two transactions (step 11 hit the same limit, its §9 risks).
2. **D7-A misses NULL lines** (a refinement of step 11, D2).
3. **Legacy and no-sequence orders keep needing the button.** These are the ~129 pre-0061 orders (`assign-job-number-button.tsx:54`, `collective-order.ts:2747`), orders in orgs without a `job` row, and orders converted before step 11 Phase 2 deploys. The button stays. No UI change is needed.
4. **Under-review guard ownership** (D5, cross-plan with step 14 D5 and step 15 D17; settled 2026-09-17 per `steps-12-15-crosscheck.md` X6: step 15 owns it). The user rule sequences order-approval fixes after steps 08 and 10.
5. **Job Number box hygiene through `update`.** A2: the value is stored untrimmed (D3, decided A: normalise in Phase 3). A3: clearing or retyping the number does not propagate (D4, decided C: SOP pitfall only).
6. **SOP text.** Once step 11 Phase 2 deploys, step 12 stops being a required press and becomes a check (D6).

---

## 1. Overview

**Problem.** After step 11 Phase 2, a converted job arrives numbered, and Assign number is left as the repair for every order that is still blank. That repair has two holes. Two presses at the same moment overwrite each other: one serial is used and never appears, and the first operator is told a number the order does not hold. And the re-stamp step 11 adds brings only the lines that carry the quotation number, so lines typed while the job was blank keep an empty order number. The SOP still tells sales to press a button that, for new conversions, will no longer be there.

**Goal.**
- **Phase 1:** Assign number fills a blank number once, even when two people press it together. Every unbilled line of that order with a blank or quotation-number reference follows it.
- **Phase 2:** the SOP's step 12 describes what an operator actually does after step 11 Phase 2: check the number, and press Assign number only when it is blank.
- **Phase 3 (taken under D3-A, decided):** a job number typed into the edit form is stored the way `create` stores one: trimmed, with blank meaning none.

**Success criteria.**
- Two concurrent `assignNumber` calls on one blank order against the dev database give one success and one CONFLICT `This order already has job number JOB…`. There is exactly one `collectiveOrder.assignNumber` audit row, and `number_sequence.next_value` advances by exactly 1 (D1-A).
- Pressing Assign number on a blank order whose unbilled lines hold `order_no` NULL or the quotation number re-stamps all of them. Billed lines and hand-typed references are untouched (D2).
- Assign number on a locked order, a frozen approved order, or for a field-denied caller is refused, and each case has a test (these guards exist today but are untested).
- `sop.json` step 12 reads as a check, and the step 11 break and result text no longer send sales to press the button after every conversion.
- (Phase 3) Saving ` JOB-1 ` through the edit form stores `JOB-1`. A clash message quotes the trimmed number.

**In scope.** The row lock in `assignNumber`; the NULL widening of the re-stamp predicate only as the Task 1.2 fallback (under D2-A the widening lands in step 11 Task 2.4, crosscheck X11); tests for `assignNumber`'s guards; the allow-list comment; the SOP and tracker text for step 12 and its neighbours; normalising `update`'s `jobNumber` (Phase 3, D3-A).

**Out of scope.**
- Conversion numbering, conversion-line `orderNo`, the D7-A re-stamp itself and the assign toast (step 11 Tasks 2.1–2.5).
- `assertNotUnderReview` in any order handler (step 15 Phase 1, D5-A decided, per crosscheck X6).
- SOP text for steps 14 and 15, submit-time order-state checks, and keeping rejected orders out of ledgers: unowned by any plan, accepted as known gaps (crosscheck X13). Phase 2 only corrects step 15's two factual errors.
- `saveChildren`'s missing post-approval guard (step 15's finding, corrected in §9).
- `saveChildren`'s `orderNo` rule and its lack of a lock (step 14).
- Renumber propagation to ladings (D4).
- Numbering voided orders (the button's doc comment, `assign-job-number-button.tsx:88-92`).
- A dedicated "may number" permission node (`collective-order.ts:2760-2768`).
- Publishing the SOP site, which is Wilfred's action per `hosting/SITE.md`.

**Context files read in full:** `C:/Users/user/.claude/commands/planpro/SKILL.md` (format) and `C:/Project/ZYT-Task/plans/step-11-convert-won-quote.md` (the binding upstream plan). `C:/Project/ZYT-Task/plans/steps-12-15-crosscheck.md` items X6 (freeze ownership) and X7 (lock ownership) were read for the cross-plan settlements. The SOP data was read at `customer-intake-sop/sop.json:236-251`, `:505-507`, `:1927`, `:1942-2004`, `:2243-2249` and `:3779-3792`.

**Input Gate.** No Input Gate was held; Wilfred accepted every recommendation on 2026-09-17 (§9).

**Decisions (settled 2026-09-17)** (all three approaches of each stay in §9):
- A row lock (`FOR UPDATE` on the scoped load) prevents the double press, not a compare-and-set → D1-A.
- The NULL widening folds into step 11 Task 2.4 (crosscheck X11); Task 1.2 here is the fallback only → D2-A.
- `update` normalises the Job Number (Phase 3 is taken) → D3-A.
- The edit box stays the renumber path, with an SOP pitfall → D4-C.
- Step 15 Phase 1 owns the order under-review freeze and the lock in `collective_order.exists`; step 12 adds no freeze line (crosscheck X6) → D5-A.
- Step 12 stays, retitled "Check the job number" → D6-A.
- Creating or converting an order in an org with no `job` sequence stays silently numberless, as step 11 D6-A already relies on → D7-A.
- Locked but unbilled lines are re-stamped like any unbilled line → D8-A.

**Prerequisite (a sequencing fact, not a decision).** Step 11 Phase 2 (Tasks 2.1–2.5, D5-A, D6-A, D7-A, all decided) has merged before Phase 1 executes, so the helpers live in `packages/api/src/modules/collective-order/insert-order.ts` [NEW] and `assignNumber` already re-stamps → §7 merge order.

**Checks that remain although the choices stand** (see §9): probe P3 before Task 1.2/1.3 (D2), P2 before Phase 3 (D3), P6/P7 before Task 2.1 (D4), P8 before 15 P1 (D5), P9 before Task 2.1 (D7), P10 plus accounting's input before Task 1.3 (D8), P5/P5b before Task 1.1 (D1). If a probe contradicts its choice, stop and re-plan.

## 2. User Journeys

**Journey 1 (hardened): Operations repair a blank job number**
Trigger: an order shows an em-dash for Job Number. It may be a legacy order, one converted before step 11 Phase 2 deployed, or one created while the org had no `job` sequence.
Steps:
1. The user opens `/order/$orderId/edit` → Business information shows an empty **Job Number** box with **Assign number** under it (unchanged, `order-form.tsx:2403`). The same button is on the record page.
2. The user presses **Assign number** → the server locks the order row, re-checks that it is still blank, checks lock and freeze, allocates the next serial and stamps it. In the same transaction (step 11 D7-A, widened by D2), it re-stamps the order's unbilled lines whose `order_no` is NULL or the quotation number.
3. Toast: _"Job number JOB260900042 assigned; 3 fee line(s) updated"_ (step 11 Task 2.5 wording). The box fills and no draft dot appears (`acceptAssignedJobNumber`).
4. Flow ends: the order's Expenses tab shows the job number on every unbilled line. A billed line keeps the reference its issued invoice printed.
Where it lives: inline on the existing edit form or record page. No new surface.

Old journey, for contrast: step 2 had no lock. With D7-A as decided, step 4 would leave lines typed while the job was blank with an empty order number.

**Journey 2 (new refusal): Two people press Assign number together**
Trigger: the edit form and the record page are open in two tabs, or two operators work the same backlog.
Steps:
1. Both see a blank number and press within the same second.
2. The first request takes the row lock and stamps `JOB260900042`.
3. The second request waits on the lock, reads the committed row, and is refused before allocating: toast _"This order already has job number JOB260900042"_ (existing wording, `collective-order.ts:2793`). Its blanket invalidate is not run on error. The server refused, so the second user's box stays blank until the next refetch or reload shows the number and hides the button.
4. Flow ends: one number, one audit row, no used-up serial.
Where it lives: server only. The toast path is unchanged (`assign-job-number-button.tsx:216`).

Old journey, for contrast: both succeeded. The order kept the second number, the first user's box showed the first number, and the serial sequence had a hole.

**Journey 3 (changed text, no code): Sales finish a conversion and check the number**
Trigger: step 11's **Convert to order** lands on `/order/$orderId/edit`.
Steps:
1. Sales read SOP step 12, now titled "Check the job number" → it says the Job Number box should already show the org's next serial.
2. If the box is filled → carry on to step 13 or 14. There is nothing to press.
3. If the box is blank (the org has no `job` sequence, or the order predates the fix) → press **Assign number**. If the toast says **No number sequence configured for jobs**, use **Open Numbering** (Journey 1).
4. Flow ends: the job has its identity.
Where it lives: `customer-intake-sop/sop.json`, rendered at `/nct/customer-intake-sop/`.

**Journey 4 (Phase 3, D3-A decided): Someone pastes a job number into the edit form**
Trigger: an operator pastes ` JOB260900042 ` (with spaces from a spreadsheet) into the Job Number box of a numbered or blank order and saves.
Steps:
1. Save → `collectiveOrder.update` stores `JOB260900042`, trimmed. A whitespace-only box is stored as null, the same as an emptied box.
2. If another order holds that number → toast _"Job number JOB260900042 is already in use"_, quoting the trimmed value.
3. Flow ends: the stored number matches what `create`, the unique index and `needsJobNumber` all consider it to be.
Where it lives: the existing Save on the edit form.

## 3. Result (What Changes for the User)

**Before:** Assign number can be pressed twice at once, and both presses "succeed" with different numbers. Lines typed while the job was blank keep an empty order number even after it is numbered. The SOP tells sales to press Assign number after every conversion.
**After:** Assign number gives one number per order, however many presses arrive. Every unbilled blank or quotation-number line follows the new number. The SOP tells sales to check the number, and to press only when it is blank.
**Key differences:**
- Operations: a simultaneous second press is refused with the number the first press assigned.
- Accounting: a repaired job's unbilled lines all print the job number, including lines added before it had one.
- Sales: step 12 becomes a glance, not a required press (after step 11 Phase 2 deploys).
- (Phase 3) Anyone editing the Job Number box: stray spaces no longer create a "different" number.

## 4. Technical Architecture

### Data flow: `assignNumber` after this plan (step 11 Task 2.4 included)

```
assignNumber({orderId})
  isFieldDenied → FORBIDDEN                                         (unchanged)
  tx.begin
  ├─ SELECT collective_order WHERE id AND scope FOR UPDATE          (Task 1.1, D1-A — was unlocked)
  ├─ NOT_FOUND / hasJobNumber → CONFLICT                            (unchanged; now reads the committed row)
  ├─ [step 15, D5-A / X6] assertNotUnderReview(tx, org, "collective_order", id)   (not this plan)
  ├─ assertPostApprovalEditable; assertUnlocked                     (unchanged)
  ├─ allocate loop → UPDATE collective_order SET job_number WHERE id (unchanged)
  ├─ UPDATE cost_line SET order_no = <new>
  │    WHERE organization_id AND order_id AND bill_id IS NULL
  │      AND (order_no = <quotation_no> OR order_no IS NULL)        (step 11 Task 2.4, widened by D2)
  └─ writeAuditRaw collectiveOrder.assignNumber {jobNumber, restampedLines}
  tx.commit
```

Traces: the lock serves Journey 2 steps 2–3. The widened predicate serves Journey 1 step 2 and step 4.

### Data model

**No schema change and no migration.** The lock uses the primary key. The re-stamp uses `cost_line_order_idx` (`schema/expense.ts:190`). A database CHECK against untrimmed `job_number` is D3-B and was not chosen (D3-A decided).

### API contracts

**`collectiveOrder.assignNumber`** (serves Journey 1 steps 2–3 and Journey 2 steps 2–3): input unchanged (`{ orderId: string }`). Output is unchanged beyond step 11's `restampedLines`. Error set unchanged: FORBIDDEN, NOT_FOUND, CONFLICT (already numbered / no sequence / attempts exhausted / frozen), FORBIDDEN (locked, via `assertUnlocked`). A losing concurrent press now gets the existing "already has job number" CONFLICT instead of a 200.

Task 1.1, in drizzle:
```ts
const [existing] = await tx
  .select()
  .from(collectiveOrder)
  .where(and(eq(collectiveOrder.id, input.orderId), scope))
  .for("update"); // precedent: modules/audit/shared.ts:44, modules/governed/writer.ts:234
```

Task 1.2 (D2-A decided: this is step 11 Task 2.4's predicate per crosscheck X11; step 12 writes it only as the fallback when Task 2.4 was built without the widening), for the cost-line re-stamp WHERE clause:
```ts
and(
  eq(costLine.organizationId, organizationId),
  eq(costLine.orderId, existing.id),
  isNull(costLine.billId),
  existing.quotationNo
    ? or(eq(costLine.orderNo, existing.quotationNo), isNull(costLine.orderNo))
    : isNull(costLine.orderNo),
)
```
An order with no `quotation_no` (legacy, or created by `/order/new`) re-stamps only its NULL lines. That is what repairs the lines of the 129 legacy orders.

**`collectiveOrder.update`** (Phase 3, D3-A decided; serves Journey 4 steps 1–2): before `stripDeniedFields`, if `rest.jobNumber !== undefined`, replace it with `normaliseJobNumber(rest.jobNumber)` imported from `modules/collective-order/insert-order.ts`. The 23505 message quotes the normalised value. Input schema `orderFields.jobNumber: z.string().nullish()` (`collective-order.ts:146`) is unchanged, so `collective-order.clearing.test.ts`'s source parse (`:196-204`) is unaffected.

### Key decisions
- How the double press is prevented → D1 (Decided A: row lock, owned by Task 1.1 per X7)
- Whether the NULL-line widening lands in step 11 or here → D2 (Decided A: step 11 Task 2.4 per X11; Task 1.2 is fallback only)
- Whether `update` normalises the Job Number → D3 (Decided A: Phase 3 is taken)
- What clearing or retyping a number through the form should do → D4 (Decided C: leave as designed, SOP pitfall)
- Who adds `assertNotUnderReview` to `assignNumber` (cross-plan, crosscheck X6) → D5 (Decided A: step 15 Phase 1; merge 12 P1 → 15 P1 → 14 P1)
- What SOP step 12 becomes → D6 (Decided A: "Check the job number")
- Whether an order created with no sequence stays silently numberless → D7 (Decided A: keep)
- Whether the re-stamp touches locked but unbilled fee lines → D8 (Decided A: re-stamp them)

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- Step 11 Phase 2 merged, including Task 2.4. Confirm by symbol: `modules/collective-order/insert-order.ts` exports `insertOrderWithJobNumber`, and `assignNumber` contains an `update(costLine)`.
- Decisions D1-A, D2-A, D5-A and D8-A are settled (2026-09-17). Probes P3, P5/P5b and P10 (and accounting's input for D8) have been re-checked; if any contradicts its choice, stop and re-plan.
- Re-read `assignNumber` by symbol at the base commit, because step 11 moves lines in `collective-order.ts`.
- Under D2-A (X11) step 11 Task 2.4 should already carry the widened predicate. If step 11 merged without the widening, run Task 1.2 here as the fallback and record that in the commit message; otherwise skip Task 1.2.
- Uncommitted e2e changes in nct-layout are committed before Wave 6 (X16), since §10 uses those fixtures.

### Phase 1: Assign number fills a blank number once, and all the job's unbilled lines follow

**Delivers:** Journey 1 (widened re-stamp) and Journey 2 end to end.
**Dependencies:** step 11 Phase 2 merged; D1-A, D2-A, D5-A, D8-A (all Decided); probe re-checks above.

- **1.1** In `collectiveOrderRouter.assignNumber`, add `.for("update")` to the scoped load (D1-A). Add a short comment naming the race (stale `existing` after `allocateDocNumber` waits on the sequence row lock). Update the allow-list comment above `routers/collective-order.ts :: collectiveOrderRouter.assignNumber :: update(collectiveOrder)` (`architecture.test.ts:489-490` at HEAD) to name the lock. The entry key does not change. Files: `packages/api/src/routers/collective-order.ts`, `packages/api/src/architecture.test.ts`. · **Agent A (backend)**
- **1.2** (Fallback only under D2-A: run it only if step 11 Task 2.4 was built without the widening; X11) Widen the re-stamp predicate step 11 Task 2.4 added, as in §4. Update the `update(costLine)` allow-list comment step 11 added to say "blank or quotation-number references". Files: `packages/api/src/routers/collective-order.ts`, `packages/api/src/architecture.test.ts`. · **Agent A (backend)**
- **1.3** Tests, added to `describe("assignNumber repairs an order that has none")` in `collective-order.numbering.test.ts`. Use `rawOrder` (`:138`) and the `JOB_SEQUENCE` fixture (`:149`) only. Cases:
  - **locked:** `rawOrder({ jobNumber: null, locked: true })` → FORBIDDEN, and the number is still null.
  - **frozen:** insert an `audit_flow` (`triggerType: "collective_order"`, `postApprovalEditable: false`) and a `passed` `audit_submission` for the order (fixture shape as `quotation.rate-card.test.ts:1161-1181`) → CONFLICT `This record was approved…`, and the number is still null.
  - **field-denied:** a role whose field policy denies `collectiveOrder.jobNumber` → FORBIDDEN `Missing access to the job number field`, and `number_sequence.next_value` is unchanged. Copy the field-deny setup from the nearest suite that uses `isFieldDenied`, found by grep at execution time.
  - **whitespace-only:** `rawOrder({ jobNumber: "   " })` → stamped `JOB<yymm>00001` (pins agreement with `needsJobNumber`).
  - **second press:** after a successful assign, a second `assignNumber` → CONFLICT naming the first number; `next_value` advanced by exactly 1 overall; exactly one `audit_log` row with action `collectiveOrder.assignNumber`. This is sequential, so it is the part of Journey 2 PGlite can prove.
  - **re-stamp (D2):** an order with `quotationNo: "NCT-Q-9"` and four lines: `order_no` NULL unbilled, `"NCT-Q-9"` unbilled, `"HAND-REF"` unbilled, NULL billed (`billId` set). After assign, the first two carry the job number, the third is `HAND-REF`, the fourth is NULL, and `restampedLines` is 2. Add a second order in `org-b` with a NULL line that must stay NULL.
  - **legacy order with no quotation:** `quotationNo: null`, one NULL line → re-stamped.
  - **re-stamp locked (D8):** an unbilled NULL line with `lockedAt` set and one with `recPayLockedAt` set. Under D8-A (decided) both carry the job number and the UPDATE does not raise. This proves the trigger ignores `order_no` only if the suite's database applies the SQL migrations (0033, 0042); the executor confirms that from the test DB setup, and Task 1.4's seed adds one locked line so real Postgres covers it either way. Under D8-B/C both stay NULL.

  Concurrency itself cannot be interleaved on PGlite (single connection, and statements inside `db.transaction` are not visible to the file's SQL recorder, `:61-63`); Task 1.4 proves it. Do not add an `it` that passes on both the old and the new code. Files: `packages/api/src/routers/collective-order.numbering.test.ts`. · **Agent A (backend)**
- **1.4** Real-Postgres concurrency proof, `packages/api/src/routers/collective-order.numbering.concurrency.test.ts` [NEW], on the committed pattern of `packages/api/src/routers/expense.concurrency.test.ts` (`describe.skipIf(!TEST_URL)`, `createDbClient(TEST_URL)`, per-run `RUN` ids, child-first teardown in `afterAll`, `call(router.x, input, { context })`). One `it`, with a forced interleave so the result does not depend on timing:
  1. Seed a per-run org, branch, owner member, a `job` `number_sequence` row, and one order with `job_number` NULL plus two unbilled NULL cost lines (one with `locked_at` set, for D8).
  2. Open a holder connection **H** (a second `createDbClient(TEST_URL)`), begin a transaction and run `SELECT id FROM number_sequence WHERE id = <seq> FOR UPDATE`. `allocateDocNumber` (`modules/org-param/allocate.ts:28`) updates that row (`:51-53`), so every allocation now waits on H.
  3. Start two `call(collectiveOrderRouter.assignNumber, { orderId })` without awaiting.
  4. From a third connection, poll `pg_stat_activity` until **two** backends in this database show `wait_event_type = 'Lock'`, with a 30 s cap that fails the test. New code: one waits on the sequence row, the other on the order row. Old code: both wait on the sequence row, having both already read a blank order.
  5. Commit H, then `Promise.allSettled` both calls.
  6. Assert: exactly one fulfilled with a `jobNumber` and one rejected CONFLICT `This order already has job number <that number>`; `next_value` advanced by exactly 1; exactly one `audit_log` row `collectiveOrder.assignNumber` for the order; `job_number` equals the fulfilled response; both lines follow D8's chosen behaviour.
  Run it once against the pre-change code (Task 1.1 not applied, in a separate worktree; never `git stash` or `git reset`) and record that it **fails** (two fulfilled, `next_value` +2). This file stays distinct from `collective-order.concurrency.test.ts` (created by step 15, extended by step 14; X8). CI has no `DATABASE_URL_TEST`, so the PR description pastes the real-Postgres output of both runs (X8). Files: the new test only. · **Agent A (backend)**

**Acceptance.**
- A user can press **Assign number** on a blank order and see the number in the box, with every unbilled blank or quotation-number line on the Expenses tab showing it.
- `collective-order.numbering.concurrency.test.ts` passes with `DATABASE_URL_TEST` on the dev Neon branch, and was seen to fail on the pre-change code (§10 edge case 1); both outputs are pasted into the PR (X8).
- `collective-order.numbering.test.ts`, `collective-order.guards.test.ts`, `collective-order.clearing.test.ts` and `packages/api/src/architecture.test.ts` pass, judged by reading the output.

### Phase 2: SOP step 12 describes a check, not a required press

**Delivers:** Journey 3.
**Dependencies:** step 11 Phase 2 **deployed** (not only merged), because the SOP describes the live app. D6-A, D4-C, D7-A (Decided). Re-check probes P6/P7 (D4) and P9 (D7) before Task 2.1; if either contradicts its choice, stop and re-plan.
**Location:** `C:/Project/ZYT-Task` (not the code repo).

- **2.1** Edit `customer-intake-sop/sop.json` per D6-A:
  - **Step 12 summary** (`:236-251`): title "Check the job number"; `what` = the box should already show the org's next serial; press **Assign number** only when it is blank (a legacy order, an order converted before the fix, or an org with no job sequence). Replace `watch` with the NULL-line and no-sequence notes.
  - **Step 12 detail** (`:1942-2004`):
    - `role` "Sales, after converting · needs collectiveOrder.update to assign".
    - `before` drops "Job Number box is empty".
    - `golden`: 1. read the Job Number box; 2. if blank, press Assign number; 3. read the toast (number + lines updated); 4. the no-sequence refusal → Open Numbering. Re-locate every `src` by symbol after step 11 merges.
    - `writes`: "the next serial on the order; unbilled lines with a blank or quotation-number reference take it".
    - `pitfalls`: replace "Conversion never allocates a number…" with "An org with no job sequence still creates and converts orders without a number, silently". Keep a corrected NULL-line pitfall. Add "Changing the number later in the box does not update lines or bills of lading already carrying the old one" (D4-C).
    - `fields` note: "seeded JOB + yymm + 5-digit serial, configurable in Parameters → Numbering".
  - **Step 11 detail** `result` (`:1927`): "You are on /order/<id>/edit with the job number filled. If it is blank, see step 12."
  - **Break after 11** (`:505-507`): rewrite to state the break is closed by step 11 Phase 2, or remove the break entry, per D6-A.
  - **Finding `unnumbered`** (`:3779-3792`): body says conversion numbers the job and Assign number repairs older ones. Leave its `repairs` as is.
  - **Step 15 `fixes[0]`** (`:2247-2248`): `assignJobNumber` → `assignNumber`; "saveChildren (:4756)" → "setAbnormalTags (:4756); saveChildren has no assertPostApprovalEditable at all". Correct the facts only; the repair text stays step 15's. SOP text for steps 14 and 15 is unowned and accepted as a known gap (X13); this task does not take it on.

  Files: `C:/Project/ZYT-Task/customer-intake-sop/sop.json`. · **Agent B (docs)**
- **2.2** Mirror the title and summary in the tracker seed: `tracker/seed/flow-nct.json:158-167` (`key: "step-12"` unchanged, title and summary updated). Leave `tasks-nct.json` `nct-unnumbered` content alone; its tick state belongs to the hub. Files: `C:/Project/ZYT-Task/tracker/seed/flow-nct.json`. · **Agent B (docs)**
- **2.3** Hand Wilfred the rebuild and deploy step (`hosting/SITE.md`, `hosting/deploy-site.ps1`). The site is public (README), so the agent does not deploy. · **Agent B (docs)**

**Acceptance.** A reader of `/nct/customer-intake-sop/` (after Wilfred redeploys) can follow step 11 → step 12 on a fresh conversion and finds nothing to press. The same reader on a legacy blank order is told to press Assign number, and why. `sop.json` parses (`python -c "import json;json.load(open('customer-intake-sop/sop.json',encoding='utf-8'))"`).

### Phase 3 (taken, D3-A decided): the Job Number box stores what the index and the button agree on

**Delivers:** Journey 4.
**Dependencies:** Phase 1 merged (same file). Step 11 Task 2.1 merged (`normaliseJobNumber` export). Re-check probe P2 before Task 3.1; if it contradicts D3-A, stop and re-plan.

- **3.1** In `collectiveOrderRouter.update`, normalise `rest.jobNumber` when present, and quote the normalised value in the 23505 message (§4). Files: `packages/api/src/routers/collective-order.ts`. · **Agent C (backend)**
- **3.2** Tests in `collective-order.numbering.test.ts` [new `describe("update stores a job number the way create does")`]:
  - ` JOB-1 ` → `JOB-1`;
  - `"   "` over null → null;
  - `"   "` over `JOB-1` → null (a clear, same as an emptied box today);
  - a duplicate typed with spaces → CONFLICT quoting `JOB-1`;
  - two orders both saved `"  "` → no 23505.

  Run `collective-order.clearing.test.ts` unchanged. Files: `packages/api/src/routers/collective-order.numbering.test.ts`. · **Agent C (backend)**

**Acceptance.** Pasting ` JOB260900042 ` into the edit form and saving shows `JOB260900042` after reload. The numbering and clearing suites pass.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.4 | `packages/api/src/routers/collective-order.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/routers/collective-order.numbering.test.ts`, `packages/api/src/routers/collective-order.numbering.concurrency.test.ts` [NEW] | `packages/api/src/modules/collective-order/insert-order.ts` [NEW, created by step 11], `packages/api/src/modules/org-param/allocate.ts`, `packages/api/src/modules/audit/post-approval.ts`, `packages/api/src/routers/quotation.rate-card.test.ts`, `packages/db/src/schema/{collective-order,expense}.ts` |

Opus for A: it changes the transaction shape of the one handler that writes an order's identity under a serial allocator, and a wrong lock or predicate either re-opens the race or re-stamps billed lines.
Run mode: single agent. Serialization point: after 1.3, run the Phase 1 test command in §10 and `bun run check-types`, and read both outputs.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent B (docs) | general-purpose | sonnet | medium | 2.1–2.3 | `C:/Project/ZYT-Task/customer-intake-sop/sop.json`, `C:/Project/ZYT-Task/tracker/seed/flow-nct.json` | this plan, `plans/step-11-convert-won-quote.md`, the merged code (to re-locate `src` lines by symbol) |

Run mode: single agent, independent of Phase 1's code. It may run in parallel with Phase 1 **only after** step 11 Phase 2 has deployed.

**Phase 3 (D3-A decided)**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | sonnet | medium | 3.1–3.2 | `packages/api/src/routers/collective-order.ts`, `packages/api/src/routers/collective-order.numbering.test.ts` | `packages/api/src/modules/collective-order/insert-order.ts`, `packages/api/src/routers/collective-order.clearing.test.ts`, `apps/web/src/components/order-form.tsx` |

Run mode: **A → C**. The same two files hand off: `collective-order.ts` and `collective-order.numbering.test.ts` pass from Agent A (Phase 1) to Agent C (Phase 3).

Smell test: each task has one owner · no file is owned twice within a phase · A and C are strictly sequential on shared files · Phase 1 alone completes Journeys 1 and 2 · the one opus assignment is justified.

## 7. Impact & Breakage Analysis

- **Callers of `assignNumber` (grep at HEAD `6bb3a1bf`, re-run in the 2026-09-17 self-review pass):** `assign-job-number-button.tsx:159` (only caller), the allow-list entry `architecture.test.ts:491`, and `collective-order.numbering.test.ts:499-544`. The button is rendered at `order-form.tsx:2404` and `order-record-page.tsx:113`. No e2e spec presses it (grep of `e2e` for "Assign number"/`assignNumber`: none).
- **Lock behaviour (Task 1.1).**
  - `FOR UPDATE` on one `collective_order` row for the life of a short transaction: allocate, one UPDATE, the re-stamp UPDATE and one audit insert.
  - Writers that update the same row (`update`, `transition`, `review`, `receive`, `reject`) wait at most that long. Their own UPDATEs already take the row lock, so no new blocking class is introduced.
  - Lock order inside `assignNumber` is `collective_order` → `number_sequence` → `cost_line`. `create` and `duplicate` take `number_sequence` and then insert a new order row, so they never hold a lock on an existing order, and no cycle exists.
  - `saveChildren` reads the order without a lock (`:3971`). A save racing an assign can still insert a line with `order_no` NULL just after the re-stamp commits. That is a residual gap, and it belongs to step 14, which owns the `saveChildren` `orderNo` rule. It is listed there in §9 Risks.
- **Scope.** The `where(and(eq(id), scope))` is unchanged. Only `.for("update")` is appended. Postgres rejects `FOR UPDATE` only with aggregates, DISTINCT, GROUP BY or set operations in the locking SELECT itself. `applyScope` returns a predicate, and `saveChildren` and `update` use the same shape without a lock, so the executor must confirm the generated SQL runs on PGlite (the Task 1.3 tests exercise it).
- **Re-stamp widening (Task 1.2).**
  - Readers of `cost_line.order_no`: the cost-line list filter (`routers/expense/cost-lines.ts`, `ilike` on `orderNo`), the invoice document, month-end grouping, and the expense projection (locations per step 11 §7, not re-verified here because the reader set does not change).
  - Effect: lines that printed blank, or filed under "无订单号" in month-end, now print the job number. **Accounting should be told**, together with step 11's change.
  - Billed lines are excluded by `bill_id IS NULL`. **The settled-line trigger cannot raise on the re-stamp (verified at HEAD).** `cost_line_settled_immutable` is created in `packages/db/src/migrations/0033_cost_line_immutable.sql` (trigger `WHEN` at `:157-164`: `bill_id`, `invoiced_amount`, `written_off_amount`, `locked_at`, `rec_pay_locked_at`). Its function was replaced in `0042_settled_line_company_refs.sql` (`:63-87`), which raises only on `amount`, `currency`, `attribute`, `settlement_unit`, `cost_name`, `exchange_rate`, `quantity`, `unit_price`, `tax_rate`, `settlement_currency`, `settlement_exchange_rate` and the three company ids. `order_no` is not in either file. (`0036_audit_cache_stamps.sql` and `0037_audit_flow_advanced.sql` are audit migrations; the old "0036/0037" names were the integration branch's, squashed into 0033 per its header `:3-7`.) No settled-state exclusion is needed for the trigger.
  - The remaining question is policy, not a DB error: an unbilled line with `locked_at` or `rec_pay_locked_at` set (a locked fee) still matches `bill_id IS NULL`, so the re-stamp changes its reference. It should: **D8-A** (decided); probe P10 is re-checked before Task 1.3. Step 11 Task 2.4 has the same predicate and shares the answer.
- **Return shape.** Unchanged beyond step 11's `restampedLines`. No destructuring caller breaks.
- **Nullable fields relied on.** `collective_order.quotation_no` is nullable (`schema/collective-order.ts:139`), which is why §4 branches on it. `cost_line.bill_id` NULL means unbilled. `cost_line.order_no` is nullable free text.
- **Phase 3 (`update` normalise).** It changes what is stored for inputs with surrounding whitespace only. The form sends `jobNumber` only when changed (`order-form.tsx:1537-1552`) or when cleared to null (`:1583-1588`), so unchanged saves are unaffected. `updateBatch` cannot send `jobNumber` (`collective-order.ts:339`, `:351`).
- **Deployment coupling.** Phase 1 is server only, and the web is unchanged. Phase 2 is text only and must follow step 11 Phase 2's **deploy**. Phase 3 is server only.
- **Migrations.** None. The journal ends at idx 64 `0065_quotation_send_decision` (`packages/db/src/migrations/meta/_journal.json:454-457`), with 65 entries. Numbers reserved by other plans (`0066`–`0075`) are untouched.

**Cross-plan collisions**

| Shared code | Plans that write it | Handling |
|---|---|---|
| `assignNumber` body (`collective-order.ts:2770-2845`) | **11 Task 2.4** (re-stamp, `restampedLines`); **12 Tasks 1.1–1.2** (`.for("update")` on the load, widened predicate); **15 Phase 1** (`assertNotUnderReview` after the has-number CONFLICT, under step 15 D17 and step 14 D5-C, per crosscheck X6, settled 2026-09-17); step 14 does not write this handler | Order settled by X6: 11 Phase 2 → 12 Phase 1 → 15 Phase 1 → 14 Phase 1. **Lock ownership (crosscheck X7):** step 12 Task 1.1 adds `.for("update")` to `assignNumber` (it lands first and is the only plan whose purpose is the double-press race). Steps 14 and 15 must find it already present by symbol and not add it again. **Freeze ownership:** Decided (X6; this plan's D5-A, step 14 D5-C, step 15 D17): step 15 Phase 1 owns the order under-review freeze and the lock in `collective_order.exists`, and 15 Phase 1 merges before 14 Phase 1. Step 12 adds no `assertNotUnderReview`. Each re-locates by symbol. |
| Re-stamp predicate | **11 Task 2.4** (D7-A, widened per X11); **12** D2-A | Decided D2-A (X11): the widening (including locked-but-unbilled lines, D8-A) is in step 11's Wave-5 execution prompt (Wilfred's edit; this plan does not edit step 11's file). Step 12 Task 1.2 runs only as the fallback if Task 2.4 was built without it. |
| Job-number helpers (moved to `modules/collective-order/insert-order.ts` [NEW]) | **11 Task 2.1**; **12 Phase 3** (import only) | 11 first. Step 12 never edits the module. |
| `architecture.test.ts` comments for `assignNumber` | 08 Task 3.3, 10 Task 1.4, **11 Tasks 1.2/2.1/2.2/2.4**, **12 Tasks 1.1/1.2** | Comments only for 12. Re-run after every rebase. |
| `collective-order.numbering.test.ts` | **11 Tasks 2.3/2.4**; **12 Tasks 1.3/3.2** | New cases in existing or new `describe` blocks. Rebase. |
| `assertPostApprovalEditable` signature | 08 (optional 5th argument, additive) | No conflict. 12 does not change the call. |
| `collectiveOrder.update` (`:2848`) | **12 Phase 3**; **15** (`assertNotUnderReview`, D5-A decided / X6) | Different lines. 12 → 15 per the settled order. |
| `saveChildren` `orderNo` (`:4453`) and its missing lock | **14** (no plan yet) | Step 14 decides whether new lines on a blank job carry NULL. Step 12's widened re-stamp makes NULL safe to repair later. |
| `assign-job-number-button.tsx` toast | **11 Task 2.5** | 12 makes no web change. |
| `sop.json` step 12 / step 15 text | **12 Phase 2**; 15's plan will rewrite step 15 | 12 corrects step 15's two factual errors only. |

Steps 04–07 and 09 do not touch order numbering. Step 10 touches the audit engine and `convertToOrder`, neither of which step 12 edits.

**Recommended merge order.** Step 12 Phase 1 runs in the wave after step 11 Phase 2 (step 11 §7 puts that in Wave 5), as a small worktree `wt-step12` rebased on step 11 Phase 2. Phase 2 (text) follows the Wave 5 deploy. Phase 3 (D3-A) rides with Phase 1. Uncommitted e2e changes in nct-layout must be committed before Wave 6 (X16). The lock alone could ship earlier as a few-line hotfix, but it would then conflict textually with step 11 Task 2.4. P5/P5b size the live race: if they show none, waiting costs nothing.

**Production read-only probes (Wilfred runs; none blocks code).** Column names were checked against `schema/audit-log.ts` (`organization_id`, `action`, `target_id`, `created_at` at `:25`) and `schema/org-param.ts` (`prefix` `:190`, `date_format` `:192`, `serial_width` `:193`, `period_key` `:226`, `next_value` `:227`). `before_json`/`after_json` follow step 11's probes.

```sql
-- P1 (legacy load for Journey 1, D7): blank orders by org and origin, and whether the org has a job sequence
select o.organization_id, (o.quotation_id is not null) as converted, count(*) as blank,
       bool_or(ns.id is not null) as org_has_job_sequence
from collective_order o
left join number_sequence ns on ns.organization_id = o.organization_id and ns.doc_type = 'job' and ns.scope_key = ''
where o.job_number is null or btrim(o.job_number) = ''
group by 1, 2 order by 1, 2;

-- P2 (D3): untrimmed or whitespace-only numbers
select organization_id, id, '[' || job_number || ']' as raw
from collective_order where job_number is not null and job_number <> btrim(job_number);

-- P3 (D2 sizing): lines disagreeing with their numbered order, by kind and billed
select o.organization_id,
       case when cl.order_no is null then 'null' when cl.order_no = o.quotation_no then 'quotation_no' else 'other' end as kind,
       (cl.bill_id is not null) as billed, count(*)
from cost_line cl join collective_order o on o.id = cl.order_id
where o.job_number is not null and btrim(o.job_number) <> '' and cl.order_no is distinct from o.job_number
group by 1, 2, 3 order by 1, 2, 3;

-- P4: orders whose lines carry two or more distinct references
select cl.order_id, count(distinct coalesce(cl.order_no, '<null>')) as refs
from cost_line cl where cl.order_id is not null
group by 1 having count(distinct coalesce(cl.order_no, '<null>')) > 1;

-- P5 (D1): more than one assignNumber audit row per order (lost-update evidence)
select target_id, count(*), array_agg(after_json order by created_at)
from audit_log where action = 'collectiveOrder.assignNumber'
group by 1 having count(*) > 1;

-- P5b (D1): an assigned value the order no longer holds
select a.target_id, a.after_json::jsonb->>'jobNumber' as assigned, o.job_number as current
from audit_log a join collective_order o on o.id = a.target_id
where a.action = 'collectiveOrder.assignNumber'
  and (a.after_json::jsonb->>'jobNumber') is distinct from o.job_number;

-- P6 (D4): numbers cleared or changed through the edit form
select a.organization_id, a.target_id, a.before_json::jsonb->>'jobNumber' as before,
       a.after_json::jsonb->>'jobNumber' as after, a.created_at
from audit_log a
where a.action = 'collectiveOrder.update' and (a.after_json::jsonb ? 'jobNumber')
  and coalesce(a.before_json::jsonb->>'jobNumber', '') <> ''
order by a.created_at desc;

-- P7 (D4): ladings whose order_no resolves to no order
select l.organization_id, count(*) from lading l
where l.order_no is not null and l.order_no <> ''
  and not exists (select 1 from collective_order o where o.organization_id = l.organization_id and o.job_number = l.order_no)
group by 1;

-- P8 (D5): numbers assigned on an order whose CURRENT submission is under review (history needs decision timestamps)
select a.target_id, a.created_at from audit_log a
join audit_submission s on s.resource_type = 'collective_order' and s.resource_id = a.target_id
where a.action = 'collectiveOrder.assignNumber' and s.status in ('under_review', 'withdrawal_under_review');

-- P9 (D7): job sequence configuration per org
select organization_id, prefix, date_format, serial_width, cadence, next_value, period_key
from number_sequence where doc_type = 'job';

-- P10 (D8): locked but unbilled fee lines the re-stamp would touch, on orders still without a number
select c.organization_id,
       count(*) filter (where c.locked_at is not null) as locked,
       count(*) filter (where c.rec_pay_locked_at is not null) as rec_pay_locked
from cost_line c
join collective_order o on o.id = c.order_id and o.organization_id = c.organization_id
where c.bill_id is null
  and (c.locked_at is not null or c.rec_pay_locked_at is not null)
  and (o.job_number is null or btrim(o.job_number) = '')
  and (c.order_no is null or c.order_no = o.quotation_no)
group by 1;
```

## 8. Cross-Cutting Concerns

- **Errors.** No new error codes or messages. The losing concurrent press receives the existing `This order already has job number X` CONFLICT, which the button prints verbatim. Phase 3's clash message quotes the trimmed number.
- **Testing.** Router tests on PGlite (Tasks 1.3, 3.2). The api architecture test after every writer-comment change. Concurrency proven on the dev Neon branch (§10), because PGlite cannot hold two connections. Browser proof of Journeys 1 and 4.
- **Migration.** None.
- **Rollback.**
  - Phase 1: revert the commit. Numbers assigned are correct data, and lines re-stamped under the widened predicate carry the right number. Nothing needs undoing.
  - Phase 2: revert the JSON edits and redeploy.
  - Phase 3: revert. Trimmed values stay trimmed, which is harmless.
- **Audit trail.** Unchanged in shape. `collectiveOrder.assignNumber` keeps before and after `jobNumber` plus step 11's `restampedLines`. Under the lock, `before` is always the committed value.

**Performance & Scalability**
1. **Pagination.** N/A: single-record mutation.
2. **SQL-side filtering.** The lock and the re-stamp are WHERE clauses on id, org, order id, bill id and order no.
3. **N+1.** None. The statement count is fixed, plus 1–20 allocate attempts (unchanged).
4. **Index coverage.** The lock uses the `collective_order` primary key. The re-stamp uses `cost_line_order_idx` (`expense.ts:190`) and then filters that order's lines (tens of rows).
5. **Write atomicity.** Lock, allocate, stamp, re-stamp and audit run in one transaction. The allocate savepoint pattern is unchanged.
6. **Row locking.** This is the fix itself: the read-then-write on `collective_order` becomes `SELECT … FOR UPDATE`. The residual `saveChildren` read-then-insert is named in §7 and handed to step 14.
7. **Connections and resources.** None new.
8. **Tenant isolation.** The locked load keeps `applyScope`. The re-stamp filters `organization_id` and the scoped order's id. The allocator is org-keyed.
9. **Payload size.** Unchanged.
10. **Hot path.** Operator-triggered, a few hundred times in total across the backlog (`assign-job-number-button.tsx:175-176`). Not on page load.

## 9. Decision Register, Open Questions & Risks

No Input Gate was held. On 2026-09-17 Wilfred accepted the recommended option for every decision below, so all are **Decided**. All three approaches stay written out. Where a choice rests on a production probe or operations input, a "Re-check" line keeps that check mandatory: the choice stands, but if the probe contradicts it, stop and re-plan. The groupings below keep their original order (formerly blocking, formerly not blocking, formerly assumed).

### Decided (formerly blocking)

**D2: Where does "unbilled lines with a NULL order number also follow the new job number" land?** · Status: **Decided** · Task 1.2 is the fallback only

| | Approach | Consequence |
|---|---|---|
| **A** | **Fold it into step 11 Task 2.4 before it is built:** the predicate becomes `order_no = quotation_no OR order_no IS NULL` (NULL-only when the order has no quotation number). Wilfred adds one line to step 11's Wave 5 prompt (Recommended) | One predicate, one test set and one allow-list comment, written once. It also repairs the lines of the 129 legacy orders the moment someone presses the button. It amends a decided plan (D7-A), so Wilfred must approve the refinement. |
| **B** | **Step 12 widens it after step 11 merges** (Task 1.2) | Step 11 stays exactly as decided. The same predicate and test are edited twice in consecutive waves, and there is a window in which assigning a number leaves NULL lines behind. |
| **C** | **Do not widen:** NULL lines stay NULL; step 14 decides whether `saveChildren` should ever write NULL | Smallest change. One job can still print a blank reference beside the job number, month-end keeps filing those lines under "无订单号", and `nct-unnumbered` stays half-closed for jobs numbered late. |

- **Recommendation: A.** Task 2.4 is not built yet, so widening it now costs one clause, where B costs a second edit and a gap.
- **Why it needed Wilfred:** it amends a decided step 11 task (cross-plan) and changes which lines accounting sees re-stamped.
- **Chosen:** A (Wilfred, 2026-09-17). Crosscheck X11 folds the widening into step 11 Task 2.4's Wave 5 prompt; step 12 Task 1.2 becomes a fallback only, run if step 11 Task 2.4 was built without the widening.
- **Re-check before Task 1.2/1.3:** probe P3 (runs in place of step 11 P4, X11); if it contradicts the choice, stop and re-plan.
- **Blocking?** No longer. Task 1.2 runs only if step 11 merged without the widening.
- **Where it lands:** §4 predicate, Task 1.2, Task 1.3 re-stamp cases, §7 collision table.

**D5: Who owns the order under-review freeze (`assertNotUnderReview`, including on `assignNumber`) and the submit-side row lock?** · Status: **Decided** · Fixes Task 1.1 scope (no freeze line) and the Wave 6–9 merge order · One cross-plan decision with step 14 D5 and step 15 D17; settled by `steps-12-15-crosscheck.md` **X6** (step 15)

| | Approach | Consequence |
|---|---|---|
| **A** | **Step 15 Phase 1 owns it** for every order writer (`update`, `saveChildren`, `setAbnormalTags`, `assignNumber`, `updateBatch`, delete) plus `.for("update")` on `collective_order.exists`; step 14 D5-C; order 12 P1 → 15 P1 → 14 P1 (X6's settlement). Step 12 adds nothing (Recommended) | One owner, one pattern (`lading.ts:1474`, `company.ts:1343`, `quotation.ts:980`) and one test file (`collective-order.under-review.test.ts` [NEW, step 15]), sequenced after steps 08 and 10 as the user rule requires. Until then a blank number can be filled while the order is under review, a low-harm write that P8 sizes. Step 15 adds only the freeze line to `assignNumber`; step 12 Task 1.1 owns the lock (X7). |
| **B** | **Step 14 Phase 1 owns it** (step 14 D5-A; the step 15 D17 option naming step 14): order 12 P1 → 14 P1 → 15 P1 deltas | Also one owner, but step 14's readiness work then carries the freeze, the submit lock and their tests, and step 15's text must be rewritten to match. Step 12 adds nothing. |
| **C** | **Step 12 adds the one line to `assignNumber`** in Task 1.1, after steps 08 and 10 merge; the other writers go to step 14 or 15 | Closes this handler earlier. It splits one defect across two plans, forces 12 P1 behind 08 and 10, and the freeze owner must remember `assignNumber` is done. |

- **Recommendation: A**, as crosscheck X6 recommends: the SOP files the finding under step 15, step 08 §7.1 hands it to the orders step, and step 14's latest text agrees.
- **Why it needed Wilfred:** cross-plan ownership and merge order across steps 12, 14 and 15.
- **Chosen:** A (Wilfred, 2026-09-17). Step 15 Phase 1 owns the order under-review freeze and the lock in `collective_order.exists`; 15 Phase 1 merges before 14 Phase 1 (X6). Step 12 Task 1.1 owns the `assignNumber` row lock (X7). Step 12 adds no guard line.
- **Re-check before step 15 Phase 1:** probe P8 (numbers assigned while under review); if it contradicts the choice, stop and re-plan.
- **Blocking?** No longer. Task 1.1 has no guard line; merge order 11 P2 → 12 P1 → 15 P1 → 14 P1.
- **Where it lands:** §4 data flow placeholder, §7 `assignNumber` collision row, §5 prerequisites; step 15 Phase 1 (A) or step 14 Phase 1 (B).

**D6: What does SOP step 12 become once conversion numbers the job?** · Status: **Decided** · Shapes Phase 2

| | Approach | Consequence |
|---|---|---|
| **A** | **Keep step 12, retitled "Check the job number":** press Assign number only when blank. Rewrite the step 11 result, the break after 11, the `unnumbered` finding body and the pitfalls. Publish after step 11 Phase 2 deploys (Recommended) | Step numbers, the tracker's `step-12` key, the hub runbook and every plan's step references stay valid. The legacy/no-sequence repair stays documented where operators look. |
| **B** | **Remove step 12 and renumber 13–27 to 12–26** | A tidier SOP. It breaks `flow-nct.json` keys, `tasks-nct.json` `steps` references, `runbook-nct.json`, every plan file's step numbers and the published URLs' anchors. The repair path loses its home. |
| **C** | **Leave the step text; fix only the factual errors** (step 15's handler names) | No churn. After step 11 Phase 2 deploys, the SOP tells sales to press a button that is not rendered on a fresh conversion, which reads as a bug report waiting to happen. |

- **Recommendation: A.** It keeps every step reference valid and the repair path documented.
- **Why it needed Wilfred:** it changes what sales read on a public SOP page and the tracker's step structure.
- **Chosen:** A (Wilfred, 2026-09-17).
- **Blocking?** No longer. Phase 2 still waits on step 11 Phase 2 being deployed.
- **Where it lands:** Tasks 2.1–2.2, Journey 3.

### Decided (formerly not blocking)

**D3: Should `collectiveOrder.update` normalise the Job Number the way `create` does?** · Status: **Decided** · Phase 3 is taken

| | Approach | Consequence |
|---|---|---|
| **A** | **Normalise in `update`:** trim, and treat blank as null, using the shared `normaliseJobNumber` (Recommended) | `create`, `update`, the unique index, `hasJobNumber` and `needsJobNumber` all agree. Whitespace-only numbers stop colliding on the index. A whitespace-only save over a real number becomes a clear, which is what emptying the box already does. One handler and one test block. |
| **B** | **A plus a DB CHECK** (`job_number IS NULL OR (job_number = btrim(job_number) AND job_number <> '')`) | Guarantees it for every writer, including imports. It needs a migration (placeholder `00NN_collective_order_job_number_trimmed`, numbered at merge per X14) and probe P2 clean first, and it turns any untrimmed import into a 500 unless mapped. |
| **C** | **Leave it** | No change. The schema comment's "zero untrimmed values" (`schema/collective-order.ts:376-378`) is kept true by luck alone. P2 shows whether luck has held. |

- **Recommendation: A.** It closes the disagreement with the helper that already exists, with no migration.
- **Why it needed Wilfred:** it decides whether optional Phase 3 exists, and it changes what a save stores (a whitespace-only save becomes a clear).
- **Chosen:** A (Wilfred, 2026-09-17). Phase 3 runs; no migration.
- **Re-check before Task 3.1:** probe P2 (untrimmed or whitespace-only numbers); if it contradicts the choice, stop and re-plan.
- **Blocking?** No.
- **Where it lands:** Tasks 3.1–3.2, Journey 4.

**D4: What should clearing or retyping a job number in the edit form do?** · Status: **Decided** · Blocking: no

| | Approach | Consequence |
|---|---|---|
| **A** | **Refuse a clear on the server:** `update` rejects `jobNumber` null or blank when the stored value has one ("A job number cannot be removed; type the replacement"). Retyping stays allowed | It stops the clear → Assign-again path that uses up a serial and orphans lines and ladings. It blocks the "move a mistyped number from order X to order Y" workflow unless X gets a placeholder. It contradicts the button author's stated design (`assign-job-number-button.tsx:98-100`). |
| **B** | **Propagate a renumber:** when `update` changes a number, re-stamp unbilled cost lines and unreleased ladings that carry the old one | Documents stay linked. It is a new `update(costLine)` and `update(lading)` site in `update`, with lading release-state rules to define. It is step 16/17 territory and much larger than step 12. |
| **C** | **Leave it as designed** (the box stays the deliberate renumber path). Add an SOP pitfall that changing the number does not update existing lines or bills of lading, and revisit if P6/P7 show clears or orphans (Recommended) | No code, and it respects the existing documented decision. The hazard is written where operators read. Real damage, if any, is sized by P6/P7 before anyone builds A or B. |

- **Recommendation: C.** There is no evidence yet that clears or renumbers happen, and both fixes carry real workflow costs. The probes decide it.
- **Why it needed Wilfred:** user-visible edit behaviour, and it waits on production probes P6/P7.
- **Chosen:** C (Wilfred, 2026-09-17).
- **Re-check before Task 2.1:** probes P6/P7 (clears or renumbers through the form; orphaned ladings); if they contradict the choice, stop and re-plan.
- **Blocking?** No.
- **Where it lands:** Task 2.1 pitfall text; a future step 14/16 plan if A or B.

**D8: Should the re-stamp change the reference on a locked but unbilled fee line?** · Status: **Decided** · Blocking: no (Task 1.2 and step 11 Task 2.4 are written for A)

Fact first: the DB allows it. `cost_line_settled_immutable` enters its function for `locked_at` / `rec_pay_locked_at` lines (`0033_cost_line_immutable.sql:157-164`), but the function (`0042_settled_line_company_refs.sql:63-87`) never compares `order_no`, so the UPDATE succeeds. The question is whether a locked fee's reference *should* move.

| | Approach | Consequence |
|---|---|---|
| **A** | **Re-stamp them like any unbilled line** (predicate unchanged: `bill_id IS NULL`) (Recommended) | A blank or quotation-number reference is a missing identity, not money; the trigger froze money and company refs and left `order_no` out. The whole job prints one reference. A locked line's printed reference changes after it was locked, which accounting may notice. |
| **B** | **Exclude locked lines:** add `AND locked_at IS NULL AND rec_pay_locked_at IS NULL` | A locked fee is untouched in every column. Those lines keep a blank or quotation reference beside the job number and stay under "无订单号" in month-end; no later Assign press can repair them, since the order is then numbered. |
| **C** | **B, and report the skipped count** in the audit row and toast ("2 fee line(s) updated, 1 locked line left unchanged") | Honest about the gap. A new output field beside step 11's `restampedLines` and a toast change in `assign-job-number-button.tsx`, which step 11 Task 2.5 owns. |

- **Recommendation: A**, unless P10 shows locked unbilled lines on blank orders in live data *and* accounting says a lock covers the reference.
- **Why Open:** accounting policy on locked data, and it waits on probe P10 and accounting's input.
- **Chosen:** — (open)
- **Blocking?** No.
- **Where it lands:** §4 predicate, Task 1.2, Task 1.3 case **re-stamp locked (D8)**; step 11 Task 2.4 shares the predicate under D2-A.

### Assumed

**D1: How is a double press of Assign number prevented?** · Status: **Assumed** · Blocking: no (Task 1.1 proceeds with A unless overturned)

| | Approach | Consequence |
|---|---|---|
| **A** | **Row lock:** load the order `FOR UPDATE` inside the transaction, so the second press waits, reads the committed number and is refused before allocating (Recommended) | No serial is used up, and the audit `before` is always true. It follows the repo's lock precedent (`modules/audit/shared.ts:44`, `modules/governed/writer.ts:234`) and step 11 D3-A's choice for conversion. It cannot be proven on PGlite, so Task 1.4 proves it on the dev database. |
| **B** | **Compare-and-set:** add `AND (job_number IS NULL OR btrim(job_number) = '')` to the stamping UPDATE; 0 rows → CONFLICT | Precedent is `collectiveOrder.review` (`collective-order.ts:3450-3460`). No lock is held. The loser has already allocated, so **one serial is still used up** per race. With step 11 D7-A, the re-stamp must also be skipped on 0 rows. It needs a new message ("assigned by someone else just now"), because `existing.jobNumber` is stale. |
| **C** | **Leave it:** document the race, run probes P5/P5b, and fix only if they show hits | No code. The race stays reachable from two tabs. After step 11 D7-A, a hit also leaves re-stamped lines disagreeing with their order. |

- **Recommendation: A.** It closes the race without using up a serial or adding a message, and it matches the lock step 11 already chose for the neighbouring minting path.
- **Why Assumed:** A follows the repo's lock precedent and step 11 D3-A; the loser sees the existing CONFLICT wording, and B differs only in an internal serial gap and a message.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4 data flow, Task 1.1, Task 1.4, §10 edge case 1.

**D7: Should creating or converting an order in an org with no `job` sequence stay silently numberless?** · Status: **Assumed** · Blocking: no

| | Approach | Consequence |
|---|---|---|
| **A** | **Keep the silent fallback** (`insertOrderWithJobNumber` branch 2, `collective-order.ts:2401-2407`; step 11 D6-A relies on it). The SOP names it, and Assign number's "No number sequence" toast leads to Numbering (Recommended) | No outage when Parameters is incomplete. P9 shows whether any live org lacks a sequence; `seedOrgParams` creates one for every new org (`routers/org.ts:129`). |
| **B** | **Refuse create and convert without a sequence** | Every order is numbered. A Parameters gap becomes an inability to take work, which is the opposite of what the allocator's docblock chose (`:2349-2352`). |
| **C** | **Create, but return a `numbering: "unconfigured"` hint** that the form and conversion toast surface | The operator learns immediately. A new output field on `create` and `convertToOrder`, two toasts, and a collision with step 11 Task 2.2's output. |

- **Recommendation: A.** Every org is seeded with a sequence, and the repair path already explains itself. Revisit only if P9 finds an org without one.
- **Why Assumed:** A is today's behaviour, chosen by the allocator's docblock and already relied on by the decided step 11 D6-A; the plan changes no code for it, only SOP text.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Task 2.1 pitfall text.

### Corrections handed to other plans (facts, not decisions)
- **Step 15:** the SOP fix names `assignJobNumber`, but the procedure is `collectiveOrder.assignNumber`. It cites "saveChildren (:4756)", but `:4756` is in `setAbnormalTags` (`:4729`). `saveChildren` (`:3954`) has **no** `assertPostApprovalEditable`, so it lacks the post-approval freeze as well as the under-review guard. Task 2.1 corrects the SOP facts. Step 15's plan owns the code.
- **Step 11:** D2-A amends Task 2.4's predicate (Wilfred's prompt edit, not a file edit by this plan).
- **Step 14:** `saveChildren` reads `jobNumber` without a lock and writes it as `orderNo` (`:3971-3993`, `:4453`). Whether a blank job's new lines should carry NULL, and whether that read should lock, are step 14's calls. D2 makes NULL repairable either way.

### Risks
- _PGlite cannot interleave two transactions, so the lock has no unit test_ → certain → **Task 1.4 proves it on the dev Neon branch with a forced interleave (§10 edge case 1). Task 1.3 pins everything sequential around it.**
- _The re-stamp touches locked but unbilled fee lines_ → P10 sizes it → **the trigger does not protect `order_no` (`0033_cost_line_immutable.sql:157-164`, function `0042_settled_line_company_refs.sql:63-87`), so the UPDATE cannot raise; whether it should skip those lines is D8. Task 1.3 pins the chosen behaviour.**
- _Step 11 Phase 2 lands differently from its plan (for example, Task 2.4 dropped)_ → low → **the blocking prerequisite checks by symbol. If there is no `update(costLine)` in `assignNumber`, Task 1.2 becomes "add the re-stamp as specified in step 11 §4 plus the widening", and Wilfred is told before it starts.**
- _A concurrent `saveChildren` inserts a NULL line just after a re-stamp commits_ → low (needs a save and an assign on one order in the same second) → **named for step 14. The next Assign-style repair cannot re-run on a numbered order, so step 14's plan must decide the rule. Probe P3's `null` kind counts any hits.**
- _Line numbers drift under steps 08, 10 and 11_ → certain → **every task locates by symbol (`assignNumber`, `update`, `normaliseJobNumber`).**

### SOP text vs code (Phase 0 wins)
1. "to allocate the next `JOByymm#####` serial": only the seed default (`org-param/seed.ts:82`, `schema/org-param.ts:193`). The prefix, date format and width are configurable.
2. "Miss it and the job stays numberless": true today, false for new conversions after step 11 Phase 2.
3. "with any cost line added afterwards carrying a null order number": true (`:4453`). After D2, pressing Assign number repairs those lines.
4. Step 11 `result` "Go straight to step 12 and press Assign number": true today, false after step 11 Phase 2.
5. Step 12 `role` "needs collectiveOrder write": correct in substance (`COLLECTIVE_ORDER.update`; granted to sales, ops, admin and branch-manager).
6. Step 12 `fields` "/order/new allocates by itself when the box is left empty": true (`create` → `insertOrderWithJobNumber`), except in an org without a sequence (D7).
7. "The number lands in the box and the rest of the form is untouched": true (`acceptAssignedJobNumber`, `order-form.tsx:1015`).
8. Step 15 fix: wrong procedure name and wrong handler at `:4756` (above).

## 10. Verification & Proof

**App URL:** http://localhost:3101 (server http://localhost:3000, RPC prefix `/rpc`). One worktree's servers at a time.
**Preconditions:**
- Step 11 Phase 2 merged on the base.
- A seeded org: `bun --preload apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>` (usage in the file header at HEAD). It seeds org params (including the `job` sequence) and returns one cookie per actor. Use **owner** for the setup writes and scripts below, and **salesperson** (role `sales`) for the Assign-number presses in Journey 1, which is the SOP's actor. `seed-parity` returns a single owner cookie and is not used. Confirm the `job` row with P9 filtered to the run's org. Announce the active org before driving the browser.
- Order **OB**: blank job number, no quotation. Give it two unbilled cost lines with `order_no` NULL (add fees on its Expenses tab while it is blank) and one billed line (group it into a bill).
- Order **OQ**: blank job number, converted before step 11 Phase 2. If none exists, set `job_number` to NULL on a fresh conversion with a dev-branch SQL update, and confirm its lines carry the quotation number.
- Order **ON**: already numbered.
- The dev Neon branch only. Never production.

**Migrations:** none. Before starting, confirm the journal's last entry matches the database (`__drizzle_migrations` count equals the journal's entry count), not a command exit code.

**Tests (run each, and read the output for `failed`; do not trust the exit code alone):**
```
bunx vp test run packages/api/src/routers/collective-order.numbering.test.ts packages/api/src/routers/collective-order.guards.test.ts packages/api/src/routers/collective-order.clearing.test.ts packages/api/src/architecture.test.ts
bunx vp test run packages/api/src/modules/org-param/allocate.test.ts packages/api/src/modules/lading/resolve-order.test.ts
bun run check-types    # can exit 0 while printing "failed"; read the output
```
Tests added: Task 1.3 (locked, frozen, field-denied, whitespace-only, second press with one audit row and one serial, re-stamp matrix with cross-org, legacy with no quotation, re-stamp locked), Task 1.4 (real-Postgres concurrency, edge case 1) and Task 3.2 (Phase 3 only).

**Phase 1 golden path (Journey 1):**
1. As ops, open `/order/<OB>/edit` → Business information shows an empty **Job Number** box with **Assign number** under it.
2. Press **Assign number** → toast _"Job number JOB<yymm><serial> assigned; 2 fee line(s) updated"_. The box shows the number, with no unsaved-changes marker, and the button is gone.
3. Open the order's Expenses tab → both formerly blank unbilled lines show the job number, and the billed line still shows blank.
4. Open the record page for OB from `/order/sea-export` → the Job Number reads the same number, with no **Assign number** button.
5. Repeat on `/order/<OQ>/edit` → lines that carried the quotation number now carry the job number.

**Edge case 1: concurrent presses (Journey 2, dev database).**
1. Proof: `DATABASE_URL_TEST=<dev Neon branch URL> bunx vp test run packages/api/src/routers/collective-order.numbering.concurrency.test.ts`, and read the output for `1 passed`. A skip means the URL was not set and is not a pass. The forced interleave (H holds the `number_sequence` row, and both calls are confirmed waiting in `pg_stat_activity` before release) makes the outcome deterministic.
2. Contrast: the same test on the pre-change code fails with two fulfilled calls and `next_value` +2. Record both outputs.
3. Optional HTTP smoke, not the proof: from `e2e/out/_walk/`, a node script with the owner cookie fires two `POST /rpc/collectiveOrder/assignNumber` through `Promise.all` on a fresh blank order, 20 times on 20 fresh orders. New build: zero runs with two 200s, and each run leaves `next_value` +1 and one audit row. On the old build a double-200 is likely but not guaranteed (Neon may serialise the calls), so zero hits there proves nothing.

**Edge case 2: refusals are readable.**
- On `/order/<ON>/edit` there is no button.
- A stale second tab of OB opened before step 2, pressed after it → toast _"This order already has job number …"_. The box stays blank until reload, then shows the number.
- Lock a blank order from the walk script with the owner cookie: `POST /rpc/collectiveOrder/transition` with `{ "orderId": "<id>", "locked": true }` (`transition` input, `collective-order.ts:3592-3600`; it has no web caller). Press **Assign number** in a tab opened before the lock → toast _"Order is locked and cannot be renumbered"_ (`assertUnlocked`, `:549`), and `job_number` is still NULL.
- In an org with its `job` sequence deleted (dev branch) → toast **No number sequence configured for jobs** with **Open Numbering**, which navigates to `/parameters?tab=sequences`.

**Phase 2 proof (Journey 3):** after Wilfred rebuilds the SOP site locally, open the built SOP page → step 12 reads "Check the job number", step 11's result says the number is filled, and the step 15 fix names `assignNumber` and `setAbnormalTags`. Convert a Won quotation in the browser → it lands on `/order/<id>/edit` with the number filled and no button, which matches the text.

**Phase 3 proof (Journey 4, D3-A decided):** on `/order/<ON>/edit`, type ` JOB-TEST-1 ` and Save → reload shows `JOB-TEST-1`. On another order, type `JOB-TEST-1 ` and Save → toast _"Job number JOB-TEST-1 is already in use"_.

**Regression check.**
- `/order/new` from the sea-export ledger's Add with a blank box still saves a numbered order, taking the next serial after the ones used above.
- **Duplicate** on ON still produces a fresh number.
- Editing a non-number field on OB after assignment does not clear or change the number.
- A bill of lading picker on OB lists the new number (`resolveLadingOrder` path).
- `collective-order.clearing.test.ts` passes unchanged.

**Mobile:** at 400px, the edit form's Job Number box and the **Assign number** button stack without horizontal scroll. The record page header wraps. No layout change is expected, because there is no web change.

**Readiness: 9/10.** Phase 1 is small, fully located and testable, and it needs no migration and no web change. The settled-line trigger was read at HEAD and cannot block the re-stamp, and the race has a deterministic real-Postgres test. One point is held back:
- Everything waits on step 11 Phase 2 merging as planned, D2 asks Wilfred to amend a decided task, and the `assignNumber` freeze owner (D5 here, step 14 D5, step 15 D17; crosscheck X6 recommends step 15) must be settled across three plans.

## Review disposition (2026-09-17)

1. minor · correctness · §7 collision row for `assignNumber` omits step 14, which also adds `.for("update")` and `assertNotUnderReview` → **Fixed** (§7 collision table: 14 Task 1.3 and 15 added, lock owned by step 12 Task 1.1 and not re-added, freeze owned by exactly one of 14 D5 / 15 D1 (step 15's label is now D17, formerly "X1"; see the self-review gate below); D5 option A and "Where it lands" rewritten to settle across the three plans; still OPEN).
2. minor · correctness · settled-line risk cites 0036/0037 and does not apply to `order_no` → **Fixed** (§7 Re-stamp widening now cites `0033_cost_line_immutable.sql:157-164` and `0042_settled_line_company_refs.sql:63-87`, states `order_no` is not frozen; conditional exclusion removed; §9 risk replaced).
3. minor · correctness · pre-change contrast "expect two 200s" is not deterministic → **Fixed** (§10 edge case 1: contrast moved to the forced-interleave test; HTTP loop is 20 runs and explicitly not proof on the old build).
4. minor · correctness · `quotation_no` cited at `:138` (that is `quotationId`) → **Fixed** (§7 Nullable fields now `:139`). The Task 1.3 `rawOrder (:138)` cite refers to the test file, not the schema, and is unchanged.
5. minor · data-safety · wrong migrations; real gap is locked but unbilled lines (`locked_at` / `rec_pay_locked_at`) being re-stamped → **Fixed** (trigger facts in §7; new OPEN decision D8 with options A/B/C; read-only probe P10; Task 1.3 case "re-stamp locked (D8)"; Task 1.4 seeds a locked line).
6. major · verifiability · race proof via `Promise.all` over Neon is not deterministic → **Fixed** (new Task 1.4 `collective-order.numbering.concurrency.test.ts` [NEW] on the `expense.concurrency.test.ts` pattern: holder connection locks the `number_sequence` row that `allocateDocNumber` updates (`allocate.ts:51-53`), waits until two backends show `wait_event_type = 'Lock'`, releases, asserts one success / one CONFLICT / `next_value` +1 / one audit row; must fail on pre-change code; §5 acceptance and §10 edge case 1 point at it).
7. minor · verifiability · executor told to read 0036/0037 for the trigger; still listed as unverified → **Fixed** (same edits as items 2 and 5; readiness note updated).
8. minor · verifiability · seeder command lacks `--preload apps/server/cf-shim.mjs`, seed-parity has only an owner cookie, locking step has no caller → **Fixed** (§10 Preconditions use `bun --preload apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>` with owner and salesperson cookies; edge case 2 locks via `POST /rpc/collectiveOrder/transition` `{ orderId, locked: true }` and names the exact `assertUnlocked` message).

### Self-review gate (2026-09-17)

Run against `/planpro` "Closing Step — Self-Review Gate", with the code repo read-only at HEAD `6bb3a1bf`.

- **Every §4 data model and endpoint names the journey step it serves** → **fixed**. `assignNumber` now names Journey 1 steps 2–3 and Journey 2 steps 2–3; `update` (Phase 3) names Journey 4 steps 1–2.
- **Every §5 task lists real file paths, verified or [NEW]** → **pass**. The two [NEW] files are tagged: `collective-order.numbering.concurrency.test.ts` and step 11's `insert-order.ts`. Task 2.3 is a hand-off and writes no file.
- **Every §5 task has exactly one owner agent from §6** → **pass** (1.1–1.4 Agent A, 2.1–2.3 Agent B, 3.1–3.2 Agent C).
- **No new dependency outside a §9 open question** → **pass** (none added).
- **Every §9 decision has three approaches, one recommendation, a status and blocking marked** → **fixed**. The blanket "OPEN — Wilfred decides" was replaced. Open and blocking: D2, D5, D6. Open: D3, D4, D8. Assumed: D1, D7. Decided: none. Each block now has a "Why Open/Assumed" line. D5 was restated as the cross-plan freeze-ownership decision, kept Open and blocking, with its options aligned to `steps-12-15-crosscheck.md` X6. Step 15's decision is cited as D17 (formerly "X1"), not "D1", and the stale "14 Task 1.3" owner was removed from the §7 row.
- **Every §1 assumption and §4 key decision points at a §9 id** → **fixed**. §1 Assumptions now lists only the Assumed decisions (D1, D7). Recommendations for Open decisions are listed separately. §4 Key decisions gained the missing D8 and shows each status.
- **Every Input Gate question is in §9 as Decided** → **n/a**. No Input Gate was held, and §1 says so.
- **§7 caller list came from a grep run this session** → **pass**, re-run at HEAD. The only caller is `assign-job-number-button.tsx:159`. The other hits are the allow-list at `architecture.test.ts:491` and the tests at `collective-order.numbering.test.ts:499-544`. The button renders at `order-form.tsx:2404` and `order-record-page.tsx:113`. Neither `assignNumber` nor "Assign number" appears in `e2e`.
- **§10 URL and port are the project's dev URL** → **fixed**. http://localhost:3101 is correct. The Phase 0 cite was corrected from `vite.config.ts:8` to `:7`.
- **Migration numbers match the journal** → **pass**. The journal has 65 entries, and the last is `0065_quotation_send_decision` (`_journal.json:457`). The trigger `WHEN` clause is at `0033_cost_line_immutable.sql:157-164`, and the function is replaced in `0042_settled_line_company_refs.sql`. This plan adds no migration, and D3-B's `0076_…` is only a placeholder.
- **Tier matches what was written** → **fixed**. The header said "Micro in substance". It now says Standard, 3 phases, because the plan writes more than 3 files across four journeys. META.md should say tier `standard`, phases 3.
- **§1 Assumptions lists every judgment call made in place of asking** → **fixed** (D1, D7).
- **Context files: named in §1, requirements planned or declined, conflicts in §9** → **fixed**. §1 now also names `steps-12-15-crosscheck.md` (X6, X7). The SOP-vs-code conflicts remain in §9 "SOP text vs code".
