# Step 23 — a signed bill keeps the total the reviewers read, its paperwork can still be finished, and only the review engine can approve it

**SOP step:** 23 "Get the bill approved" · submitter: **Money → Bills** (`/expenses/bills`) → row clipboard icon (**Review**) → **Submit for review** · reviewer: **Approvals → Bill review** (`/approve/bill`) → tick → **Approved** / **Rejected**
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-21. The `nct-layout` working tree is checked out on `feat/intake-golden-path-e2e` (`ea1560e7`), but `git diff 6bb3a1bf HEAD -- packages apps` is empty, so every `packages/` and `apps/` citation below matches `6bb3a1bf`. Every `file:line` was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Working tree note:** the tree carries unrelated deletions under `_plan/` and `docs/reference/`, and the e2e changes step 15 names (X16). `git status -- packages apps` is clean. Agents never stash, reset or check them out.
**Tier:** Standard, small. Phase 1 adds two freezes to three verbs of one governed writer and one row lock. Phase 2 narrows one freeze and changes one dialog. Phase 3 deletes two legacy RPC verbs. **No migration** under any recommended option.
**Status of decisions:** every decision in §9 is **Decided** (Wilfred, 2026-09-21: the recommended option throughout, with the crosscheck X-items that touch this plan listed in "Decisions settled" at the end). Each keeps its three approaches. Tasks are worded for the chosen option.
**Cross-plan items owned:** the ledger item `bill-rewrite` ("An approved bill's total can still be rewritten"), which `sop.json` assigns to steps 23 and 26. This plan takes its bill-total half. Its write-off-reversal half ("reversing one needs none", the unticked `cancel_write_off` gate) is step 26's and is not planned here.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`). Governed writes go through `defineGovernedWriter` (`packages/api/src/modules/governed/writer.ts`), which loads the row `FOR UPDATE` (`:230-234`), runs the verb's `gates` in order (`:241-260`), then writes with the verb's `pin` in the WHERE. Drizzle schema in `packages/db/src/schema`, migrations in `packages/db/src/migrations` (journal ends `0065_quotation_send_decision`, idx 64; nothing pending). TanStack file routes in `apps/web/src/routes/_next`. vitest on PGlite (`pushTestSchema`); real-Postgres proofs use `DATABASE_URL_TEST` (`routers/expense.concurrency.test.ts:26-27, 65`). Dev: web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Submit.** The bill ledger's Actions cell renders `<ReviewMenu iconOnly selectedIds={[row.original.id]} onReview={reviewBill} />` only outside review mode (`apps/web/src/routes/_next/expenses/-bills.columns.tsx:808-810`), with `reviewBill = engineReview("bill")` (`:289`). `engineReview` maps "pending" to `auditReview.submit` (`apps/web/src/lib/audit-review.ts:36-38`). The router runs `submitForReview` in a transaction (`packages/api/src/routers/audit-review.ts:355-360`). `submitForReview` (`modules/audit/submit.ts`) checks the submit node (`:33`; for bills `EXPENSE.billUpdate`, `modules/audit/resources.ts:442`), `entry.exists` (`:39`), the enabled flow (`:45`), initiators (`:54-68`), one open attempt (`:71-84`), inserts the submission and repaints the cache.
  - **The bill's `exists`** (`resources.ts:444-450`) is an org-only `SELECT id` with **no lock and no state check**, so a fully invoiced or settled bill can be submitted too.
  - **Queue.** `/approve/bill` mounts `<BillsPage mode="review" />` (`routes/_next/approve/bill.tsx:22-27`). Review mode pre-sets Audit status to pending (`routes/_next/expenses/bills.tsx:806-808`), and the list applies `awaitingMyReview` (`routers/expense/bills.ts:414`). The toolbar decides through `engineDecideBatch("bill", …)` (`bills.tsx:1336`), which calls `auditReview.decideByResource` — batch, all-or-nothing, one transaction (`audit-review.ts:389-424`). `decide` checks the review node (`modules/audit/decide.ts:50`), the open stage and the frozen reviewer set (`:56-81`), records the decision, evaluates quorum with `eligibleReviewerCount` as the denominator (`:106`), advances or resolves, and repaints the cache **only on the final outcome** (`:156`, "The FINAL decider stamps").
  - **Seed.** `SEEDED_FLOWS` "Bill review" (`modules/audit/seed.ts:176-194`): `withdrawalMode: "requires_reviewer_approval"`, stage 1 `accounting` `all_pass_any_reject`, stage 2 `director` `any_pass_any_reject`, **gates `["input_invoice_no", "write_off"]` (`:192`)**. `seedAuditFlows` writes `postApprovalEditable: false` for every flow and skips a trigger that already has one, so editing the seed changes nothing for existing orgs (step 15 Phase 0 establishes the same for orders).
  - **Roles** (`packages/api/src/roles.ts`): admin and branch-manager hold the `expense` root (`:90`, `:104`), so they can edit, submit, un-bill, dissolve and hold `expense.bill.review`. Accounting holds the `expense` root too (`:175`), so **an accountant can submit a bill and sit on its stage 1**. Director holds `expense.bill.read` and `expense.bill.review` as leaves and no write (`:203-207`).

- **The six declared bill gates** (`modules/expense/gates.ts:17-24`) and where each is called:

  | Key | Caller | Seeded? |
  |---|---|---|
  | `input_invoice_no` | `bills.invoice`, `routers/expense/bills.ts:1765-1771` (on `context.db`, before the handler's transaction) | yes |
  | `write_off` | `writeOffs.verify`, `routers/expense/write-offs.ts:367` (on `context.db`) | yes |
  | `cancel_write_off` | `writeOffs.reverse`, `write-offs.ts:895` | no (step 26) |
  | `delete_fee` | `costLines.unbill`, `routers/expense/cost-lines.ts:1435` | no |
  | `input_courier_no` | `billFieldGates`, `bills.ts:438-445` | no |
  | `input_voucher_no` | `billFieldGates`, `bills.ts:447-454` | no |

- **Finding A (money): an approved bill's total can be rewritten downward. Confirmed, and it also holds while the bill is under review.**
  - The only writer of `bill.total_amount` after creation is the `retotal` verb of `billWriter` (`bills.ts:513-534`). Its only gate is none: it carries a `pin` (status open, total and invoiced amount unchanged, `:527-533`) and no `gates` key. Compare `update` (`:507-512`), which carries `postApprovalGate("bill")`.
  - `retotal`'s only caller is `costLines.unbill` (`cost-lines.ts:1383-1452`). The handler checks: line on a bill, line not locked and carrying no invoiced or written-off money (via the `unbill` verb's `unbillLineGate`, `:273-291`), bill `open` (`:1429-1433`), the `delete_fee` gate (`:1435`), no invoiced amount on the bill (`:1438-1442`), not the last line (`:1443-1447`). **Nothing reads the bill's review state.** Web caller: **Remove from bill** on `/expenses/cost-lines` (`-cost-lines.columns.tsx:1320-1332`, mutation `cost-lines.tsx:1914-1926`).
  - So, under the seeded flow: the director approves a bill of 2,300; accounting removes a 300 line; the bill reads 2,000, still **Approved**; the invoice gate (`gates.ts:92`) passes because the latest submission is still `passed`; the invoice at step 24 is issued for 2,000. The released line is unbilled again (`deriveStatus`), so it can be put on a new bill.
  - **The ledger's implied repair (tick `delete_fee`) is the wrong tool.** A gate means "this verb requires review approval first": `assertGatesCleared` refuses every id whose latest submission is **not** `passed` (`gates.ts:92`), including a bill never submitted (`gates.test.ts:155`). Ticking `delete_fee` would therefore refuse line removal on every **draft** bill, refuse it while under review (good), and **allow it after approval** (the defect). The comment above the call (`cost-lines.ts:1432-1434`, "a bill under review must not have its fee set shrunk") describes a freeze the gate does not implement. It also changes nothing for existing orgs (seed runs at `org.create` only).

- **Finding B (integrity, dead queue row): a bill can be dissolved while under review, or after approval.**
  - `bills.dissolve` (`bills.ts:1457-1557`) refuses a non-open bill, invoiced amounts, issued invoices, live write-offs, dirty/locked/unscoped lines. **It reads no review state.** The `dissolve` verb (`:548-573`) has a pin and no gates. `billWriter.remove` does run a verb's gates (`writer.ts:441-456`), so a gate placed on the verb would bite.
  - It releases lines through `costLineWriter`'s `unbill` verb (`:1543-1548`), **not** through the `costLines.unbill` handler, so a guard placed in that handler (where `delete_fee` sits) is bypassed by dissolving. The comment at `:1540-1542` ("so dissolving is never the cheaper way around unbill's guards") is true of the line-side gates only.
  - **Under review:** the bill row is deleted, and its `audit_submission` stays `under_review`. `eligibleOpenSubmissions` (`audit-review.ts:143-163`) selects from `audit_submission` without joining the resource, so `pendingSummary` and `listPending` (`:666-705`) keep counting a bill nobody can open. The bill list (which joins `bill`) no longer shows it, so no reviewer can decide it. It clears only if the submitter retracts it by submission id, and under `requires_reviewer_approval` the reviewers must then approve the withdrawal of a bill that no longer exists.
  - **After approval:** the signature is discarded with the bill. The lines return to unbilled; a new bill made from them starts with no submission and is invoice-gated again. No approved total is rewritten, which is why D2 treats this case differently from Finding A.

- **Finding C (integrity): a bill under review can have its header edited.** `bills.update` (`bills.ts:1122-1167`) goes through `billWriter.update`, whose gates are `postApprovalGate("bill")` and `billFieldGates` (`:510`). `assertPostApprovalEditable` returns unless the latest attempt is `passed` (`modules/audit/post-approval.ts:43`), so it is inert while under review, and `assertNotUnderReview` has no bill caller (its callers are `company.ts:1343`, `lading.ts:1474, 1513`, `quotation.ts:980`). The editable fields include `invoiceTitle` (the invoice's default buyer, `bills.ts:1722`), `exchangeRate` (multiplied into `localAmount`, `:879`, and `bills.totals`, `:1574-1593`) and `serviceFee`/`serviceFeeCurrency`. So a reviewer can approve a bill whose invoice title or rate changed after they read it. The postApprovalGate docblock (`modules/governed/gates.ts:15`, "a record under review is frozen") says the opposite of what the gate does.

- **Finding D (severed hand-off to steps 24–26): after approval, the bill's paperwork cannot be finished.**
  - With the seeded `postApprovalEditable: false`, `bills.update` on an approved bill is refused whole ("This record was approved and its content can no longer be edited", `post-approval.ts:50-53`), including **Courier, Courier No., Financial Voucher No., Exported Voucher Name, Remark and Bill Tag**. Those are recorded after invoicing and posting, not before approval.
  - The code already made this argument for one column: `markFinanceSynced` deliberately bypasses the writer "because handing an APPROVED bill to the bookkeeper is precisely the normal case" (`bills.ts:1306-1311`; allow-list `packages/api/src/architecture.test.ts:335-354`).
  - The two field gates make it worse when ticked: `input_courier_no` refuses the field **until** approval, and the post-approval freeze refuses it **after**, so under a non-editable flow the field can never be written.
  - The web dialog sends **every** field on every save (`bills.tsx:449-462`, `orNull` turns blanks into `null`, and `null` is kept by the handler, `:1152-1155`). So with either field gate ticked, *any* save of an unapproved bill is refused, and after approval every save is refused, whatever the operator changed.
  - The web comment "Bill details are editable at ANY status: these are metadata … never money" (`-bills.columns.tsx:811-813`) is false on both counts.

- **Finding E (integrity, RPC only): the legacy cache writers are still live.** `bills.review` (`bills.ts:1207-1244`, via `billWriter`'s `review` verb `:574-604`) and `bills.reviewBatch` (`:1388-1455`, via `applyReviewBatch`, allow-list `architecture.test.ts:872`) write `bill.audit_status` and its stamps directly and file no `audit_submission`. Holders of `expense.bill.review`: admin, branch-manager, accounting, director.
  - They cannot open a gate: every gate reads `audit_submission` (`gates.ts:90`).
  - They **can** make the cache disagree with the engine: flip an under-review bill's cache to `approved`, and the queue, which pre-filters Audit status = pending (`bills.tsx:806-808`), hides a bill still waiting on a reviewer; or show **Approved** on a bill every gate still refuses.
  - No web caller: the web architecture test bans legacy review verbs (`apps/web/src/architecture.test.ts:957`). Their own docblock says they are "retired by the wave-5 queue cut-over" (`bills.ts:1204-1205`); they were not.
  - Deleting them trips the permission registry sync exactly as step 15 Finding C found for orders: `requireNode(EXPENSE.billReview)` appears only at `bills.ts:1208` and `:1389`, and `[EXPENSE.billReview]` is `isEndpoint: true` (`modules/expense/permissions.ts:136-140`). Step 15 D9-A (drop `isEndpoint`, keep the node) is the precedent.

- **Finding F (concurrency, low): submit does not serialise with a bill write.** `bill.exists` takes no lock (`resources.ts:444-450`), while every `billWriter` write loads the bill `FOR UPDATE` (`writer.ts:230-234`). Once Phase 1 adds the under-review check, a write that read "not under review" can still commit after a concurrent submit commits. Step 08 Task 1.2 (quotation) and step 15 Task 1.3 (order) close the same race with `FOR UPDATE` in `exists`.

- **Finding G (permission, by design today): an accountant may decide their own bill at stage 1.** `decide` never compares the actor with `submission.submittedBy`. Step 08 D1-B builds a per-resource `separationOfDuties` switch and writes it `false` for `bill` on purpose, because the API suite pins bill self-decision in 8+ places and `eligibleReviewerCount` (`shared.ts:247`) counts every accountant, including the submitter (step 08 Phase 0). Stage 2 is independent by role design: director holds no write (`roles.ts` comment above `director`). This plan does not flip the switch (D7-C).

- **Checked and sound (no task).**
  - The invoice freeze bites and names the gate: `"Input invoice no." requires review approval first` (`gates.ts:97`); a batch reads "… — N of M selected are not approved" (`:98`). **No router test proves it for bills**: the only gate tests use a generic resource (`gates.test.ts:154-210`) or ladings (`audit-review.test.ts:1180-1213`). Task 1.4 adds the pin, because step 24 depends on it.
  - "Newest submission wins" (`gates.ts:87-92`), so a re-submission re-freezes invoicing.
  - Reject records the reason (`bills.tsx:1328-1333` → `remark`).
  - The row Review icon is hidden in the queue (`-bills.columns.tsx:808`).
  - Batch approve is all-or-nothing.
  - The billed-line money columns are frozen (`billedFieldsGate`, `cost-lines.ts:170-190`), so `unbill` and `dissolve` are the only paths that change a bill's total.

- **Adjacent, flagged not planned.**
  1. The `input_invoice_no` and `write_off` gate reads run on `context.db` outside the write transaction (`bills.ts:1765`, `write-offs.ts:367`). The only thing that can move a `passed` bill back is a new submission, and step 08 Task 3.2 (D3-A) refuses re-submitting a locked approval. Owners: steps 24 and 26.
  2. `submitForReview` accepts a bill in any state (invoiced, written off). Owner: step 22/24 plans; flagged.
  3. The **Invoicing** icon is enabled on every open bill whatever its review state (`-bills.columns.tsx:824-830`), so an operator fills the dialog and then gets the gate refusal. Owner: step 24.

- **Migration state.** Journal at idx 64 `0065_quotation_send_decision`, 65 `.sql` files, contiguous. Other plans reserve 0066–0074 and conditional `00NN_` names (`steps-12-15-crosscheck.md` §3). **This plan needs no migration** under any recommended option. None of the non-recommended options needs one either.

---

## 1. Overview

**Problem.** Bill review is the one approval in the chain that ships with teeth: invoicing and write-off stay frozen until the bill's latest review passes. But the thing the reviewers sign, the bill's total, is not protected:
- A line can be removed while the bill is waiting on the reviewers, or after the director has signed, and the bill keeps reading Approved at the new total.
- The bill can be dissolved in the middle of a review, leaving a ghost row in every reviewer's Pending count.
- Its invoice title and exchange rate can be edited while under review.

In the other direction, the approval freezes too much: after sign-off the courier and voucher numbers that steps 24–26 need can no longer be typed in. And two old RPC verbs can still repaint the review badge without the engine.

**Goal.**
- **Phase 1 (Findings A, B, C, F):** while a bill is under review nothing about it can change. After approval its line set and signed figures are frozen. A bill under review cannot be dissolved. Submit serialises with bill writes.
- **Phase 2 (Finding D):** after approval, the paperwork fields stay writable, and the edit dialog sends only what the operator changed.
- **Phase 3 (Finding E; Finding G is not taken, D7-C):** the legacy `bills.review` / `bills.reviewBatch` verbs are gone, so the engine is the only thing that can approve a bill.

**Success criteria.**
- On a bill under review: **Remove from bill** → error toast _"This record is under review and cannot be edited. Retract the submission first."_, and the total is unchanged. **Edit bill → Save** → the same refusal. **Dissolve** → the same refusal, and the bill is still listed.
- On an approved bill (seeded flow): **Remove from bill** → error toast naming the approval, and the total is unchanged. **Invoicing** still works (step 24 unchanged).
- After Phase 2, on an approved bill: set Courier No. and Financial Voucher No. → toast _"Bill updated"_, and the values persist. Changing the Invoice Title is refused.
- After Phase 3: `POST /rpc/bills/review` and `/rpc/bills/reviewBatch` → 404. Submit → approve → invoice through the queue works as today.

**In scope.**
- `underReviewGate` in the shared governed gates.
- The three `billWriter` verbs: `update`, `retotal`, `dissolve`.
- The row lock in `bill.exists`.
- A narrowed post-approval freeze on `bills.update`.
- The bill edit dialog's diff.
- Deleting the two legacy verbs (and the writer's `review` verb), plus the registry line.
- Tests at the router boundary, one real-Postgres lock proof, and read-only production probes.

**Out of scope.**
- The write-off reversal gate (`cancel_write_off`, step 26).
- Gate reads outside transactions (steps 24/26).
- Submit accepting non-open bills (step 22/24).
- The Invoicing icon's affordance (step 24).
- Bill self-decision (D7-C: left off).
- Repairing bills whose totals already changed after approval (D8: report only).
- The FX and base-currency ledger items (steps 22/26/27).

**Assumptions.**
- Step 08 merges first. Its Task 3.1 gives `assertPostApprovalEditable` an optional `message`, used here for a bill-specific sentence. If it has not merged, Task 1.2 uses the generic message and says so in the PR.
- Step 08 Task 3.2 (D3-A: refuse re-submitting a locked approval) stands. That is what makes "approved" final under the seeded flow, and it is why D2 must leave a way to correct an approved bill.
- The review engine's `latestSubmissionByResource` (`shared.ts:332`) stays the single reader of "current attempt" for gates, post-approval and under-review checks.

---

## 2. User Journeys

**Journey 1 (changed): accounting tries to change a bill that is waiting on the reviewers**
Trigger: bill B1 (three lines, total 2,300) was submitted this morning. Accounting spots a 300 line that belongs to another customer.
Steps:
1. On `/expenses/cost-lines`, the operator presses **Remove from bill** on the 300 line and confirms. The server loads the line and the bill, runs the existing checks, then the `retotal` verb's new `underReviewGate`. Error toast: _"This record is under review and cannot be edited. Retract the submission first."_ The line stays billed, and B1 reads 2,300.
2. On `/expenses/bills`, **Edit bill** → change Invoice Title → **Save** → the same toast. **Dissolve** → the same toast, and B1 is still listed.
3. The operator opens B1's **Review** menu → **Request withdrawal**. The seeded flow unwinds through the reviewers who already signed (`requires_reviewer_approval`). Once the withdrawal is granted, step 1 succeeds (_"Line removed from its bill"_) and B1 reads 2,000.
4. The operator submits B1 again. Flow ends: the reviewers see 2,000.
Where it lives: the existing buttons and toasts (`cost-lines.tsx:1925`, `bills.tsx:376`, `:984`). No new screen.

Old journey, for contrast: steps 1 and 2 succeeded silently. Accounting's first reviewer had read 2,300, the second read 2,000, and nothing on the bill said the total had moved.

**Journey 2 (changed): someone changes a signed bill**
Trigger: B1 passed both stages at 2,300 (Approved). It is not invoiced yet.
Steps:
1. **Remove from bill** on a B1 line → refused (D1-A). Toast: _"BILL-… was approved at this total. Dissolve it and bill the lines again to change them."_ (step 08 `message` option; generic post-approval sentence otherwise). B1 still reads 2,300.
2. **Invoicing** on B1 → issued exactly as today (step 24 hand-off unchanged).
3. If the approved bill really is wrong and not yet invoiced: **Dissolve** → allowed (D2-A). Its lines return to unbilled. Toast _"Bill dissolved — its lines are unbilled again"_. The replacement bill made from the corrected lines starts in Draft, and **Invoicing** on it is refused until it passes review.
Where it lives: existing controls only.

Old journey, for contrast: step 1 succeeded, B1 kept reading Approved at 2,000, and the invoice went out for a figure nobody signed.

**Journey 3 (changed): accounting finishes the paperwork on an approved, invoiced bill (Phase 2)**
Trigger: B1 is approved and invoiced. The courier has picked up the documents, and the payment voucher is posted.
Steps:
1. `/expenses/bills` → B1 → **Edit bill** → Courier `DHL`, Courier No. `TRK-23-1`, Financial Voucher No. `PV-23-1` → **Save**. The dialog sends only those three keys. Toast _"Bill updated"_. Reload shows the values.
2. The same dialog, with Invoice Title changed → refused with the approval sentence. The dialog stays open with the typed values.
3. Nothing changed → **Save** closes the dialog without a request (no "No fields to update" error).
Where it lives: the existing dialog (`bills.tsx:333-470`).

Old journey, for contrast: step 1 was refused, because the approval froze every field and the dialog sent every field anyway. The numbers lived in a spreadsheet.

**Journey 4 (unchanged golden path): submit → two stages → invoice**
1. Submitter: `/expenses/bills` → row **Review** → **Submit for review** → Audit status Pending.
2. Accounting: `/approve/bill` → tick → **Approved** → _"1 bill(s) approved"_. The bill stays Pending until every accountant has signed (stage 1 `all_pass_any_reject`).
3. Director: `/approve/bill` → tick → **Approved** → the bill leaves the queue and reads Approved.
4. Step 24: **Invoicing** works. On an unapproved bill it is refused with _"\"Input invoice no.\" requires review approval first"_.

**Journey 5 (hardened, Phase 3): no side door to Approved**
A holder of `expense.bill.review` calls `/rpc/bills/review` or `/rpc/bills/reviewBatch` → 404. The badge on `/expenses/bills` can only move through the engine, so the queue's pending filter always shows every bill waiting on a reviewer.

---

## 3. Result (What Changes for the User)

**Before:** the review gate froze invoicing, but a bill's total could shrink under the reviewers or after they signed. A bill could vanish in mid-review and leave a ghost in everyone's Pending count. After sign-off the courier and voucher boxes refused every save.
**After:** what the reviewers read is what they signed, and what they signed is what gets invoiced. A wrong approved bill is corrected by dissolving it and billing again, which forces a fresh review. Paperwork fields stay open after approval.

**Key differences:**
- Accounting: **Remove from bill**, **Edit bill** and **Dissolve** refuse while a bill is under review. **Remove from bill** refuses after approval too. Courier and voucher numbers can be entered after approval.
- Reviewers: the total they approve cannot change until they have decided. No ghost rows.
- Director: unchanged.
- Admins: nothing. The flow editor and its checkboxes are unchanged.

---

## 4. Technical Architecture

### 4.1 Under-review and post-approval freezes on the bill writer (Journeys 1–2; Phase 1) → D1, D2, D3

New shared gate in `packages/api/src/modules/governed/gates.ts`, beside `postApprovalGate` (`:16-22`):

```ts
/** A record WAITING ON A REVIEWER is frozen: whatever the reviewer reads is what they sign.
 *  Not configurable — see assertNotUnderReview (modules/audit/gates.ts:103-143). */
export function underReviewGate(resourceType: AuditTriggerType): MutateGate {
  return async (tx, ctx, rows) => {
    for (const row of rows) {
      await assertNotUnderReview(tx, ctx.org.organizationId, resourceType, String(row.id));
    }
  };
}
```

This exported `underReviewGate` is the **shared** gate (crosscheck X34): step 21 Phase 2 (Task 2.2) imports it as `underReviewGate("cost_line")` for the cost-line `delete` verb, and names its own content-keys variant `costLineContentUnderReviewGate`. Export it under exactly this name and signature.

The same file's `postApprovalGate` docblock (`:15`) is corrected to "a record whose approval is locked is frozen".

`billWriter` verbs (`routers/expense/bills.ts:458-605`):

| Verb | Today's gates | After Phase 1 (recommended options) | Callers |
|---|---|---|---|
| `update` (`:507`) | `postApprovalGate("bill")`, `billFieldGates` | `underReviewGate("bill")`, `postApprovalGate("bill")`, `billFieldGates` (D3-A) | `bills.update` (`:1165`) |
| `retotal` (`:522`) | none | `underReviewGate("bill")`, `postApprovalGate("bill")` with the bill message (D1-A) | `costLines.unbill` (`cost-lines.ts:1448`) |
| `dissolve` (`:548`) | none | `underReviewGate("bill")` (D2-A) | `bills.dissolve` (`bills.ts:1549`) |

- **Why on the verbs, not in the handlers.** `dissolve` releases lines through the line-side verb and never reaches the `unbill` handler (Phase 0 Finding B). A freeze on the bill-side verbs covers every present and future caller, and the writer's `FOR UPDATE` load (`writer.ts:230-234`) means the check and the write see the same row.
- **Refusal order the caller sees.** `unbill`: not on a bill → line locked or carrying money → bill not open → `delete_fee` gate (if ticked) → bill invoiced → last line → **under review** → **approved**. The two new checks run last because they live in `retotal`. Any earlier refusal is unchanged. Because the handler runs in one transaction, the line release before them rolls back. `dissolve`: every existing check → line releases → **under review** (rolls back all).
- **Bill message.** Under D1-A, `retotal`'s post-approval refusal reads `${billNo} was approved at this total. Dissolve it and bill the lines again to change them.` It uses step 08 Task 3.1's `options.message`. A small local gate wraps `assertPostApprovalEditable(tx, org, "bill", id, { message })`. Before step 08 merges, it uses the generic sentence.
- **Editable flows.** A tenant who set **Can edit after approval** on their bill flow keeps today's behaviour after approval (`post-approval.ts:50`). That is their stated configuration, and D1-B/C discuss it.
- **The `delete_fee` comment** at `cost-lines.ts:1432-1434` is rewritten to say what the gate does ("removing a line requires the bill's review to have passed"). The call stays, because it is a declared vocabulary key with a registry-sync test (`gates.test.ts:67`).

### 4.2 Submit serialises with bill writes (Phase 1) → D6

`REVIEWABLE_RESOURCES.bill.exists` (`resources.ts:444-450`) gains `.for("update")` on its `SELECT`, the same one-line pattern as step 08 Task 1.2 (quotation) and step 15 Task 1.3 (order). A bill write holds the bill row from its writer load to commit, so a concurrent submit waits and then sees the committed state. A submit holds the row until the submission commits, so a concurrent write then reads `under_review` and refuses. PGlite cannot prove this (one connection). `expense.bill-review.concurrency.test.ts` [NEW] proves it on real Postgres.

### 4.3 Paperwork after approval (Journey 3; Phase 2) → D4

In `bills.ts`, the `update` verb's `postApprovalGate("bill")` is replaced by a local gate that asks only when the post-strip patch touches a **signed field**:

```ts
/** What the reviewers signed on a bill's header. Everything else on bills.update is
 *  paperwork recorded after sign-off (courier, voucher, remark, tags) — the same reason
 *  markFinanceSynced bypasses the writer (bills.ts:1306-1311). D4-A. */
export const BILL_SIGNED_FIELDS = ["invoiceTitle", "serviceFee", "serviceFeeCurrency", "exchangeRate"] as const;

const billSignedFieldsPostApproval: MutateGate = async (tx, ctx, rows, patches) => {
  for (const row of rows) {
    const patch = patches.get(String(row.id)) ?? {};
    if (BILL_SIGNED_FIELDS.some((k) => k in patch)) {
      await assertPostApprovalEditable(tx, ctx.org.organizationId, "bill", String(row.id));
    }
  }
};
```

- Verb gates become `[underReviewGate("bill"), billSignedFieldsPostApproval, billFieldGates]`.
- The under-review freeze stays whole (D3-A): during a review nothing on the header moves.
- The `input_courier_no` / `input_voucher_no` gates are untouched. Ticked, they still mean "not before approval", and now the fields become writable after it.
- The handler comment at `:1163-1166` is updated to name the narrowed freeze.

**Web** (`apps/web/src/routes/_next/expenses/bills.tsx`, `BillEditDialog` `:333-470`):
- The dialog keeps the loaded values (the `useEffect` at `:353-365` seeds them) and, on Save, sends `id` plus only the keys whose normalised value differs: trimmed string or `null`, tags compared as the joined list.
- An empty diff closes the dialog with no request.
- `DialogDescription` (`:398-401`) reads: _"The amount, currency and settlement unit come from the cost lines this bill groups. Once the bill is approved, its invoice title, service fee and rate are locked; courier, voucher, remark and tags stay editable."_
- The comment at `-bills.columns.tsx:811-813` is corrected.
- Copy grep: "Details only" occurs only at `bills.tsx:399`.

### 4.4 Retire the legacy cache writers (Journey 5; Phase 3) → D5

- Delete `billsRouter.review` (`bills.ts:1186-1244`, docblock included), `billsRouter.reviewBatch` (`:1387-1455`), and `billWriter`'s `review` verb (`:574-604`).
- Remove imports left unused: `auditTransitionGate`, `reviewStamp` (`:68`), `applyReviewBatch`, `ReviewBatchRefusal` and `normaliseAuditFrom` if nothing else in the file uses them. Grep each before deleting.
- `architecture.test.ts:872` (`billsRouter.reviewBatch :: applyReviewBatch(bill)`) is removed in the same commit, or the stale-entry rule fails.
- **The indirect-write floor (X33).** In the same commit, lower the floor at `architecture.test.ts:1273` (`expect(passed.length).toBeGreaterThanOrEqual(2)`) to the count that remains after the removal, re-counted at the base commit (not guessed), with a comment naming X33 and saying step 21 Task 3.1 removes the last entry and replaces the floor with an empty-list assertion. After 15 P2 removes `:876` and this phase removes `:872`, the floor of 2 would otherwise fail. 23 P3 merges before 21 P3.
- `modules/expense/permissions.ts:136-140`: drop `isEndpoint: true` on `[EXPENSE.billReview]`, with a comment that `decide.ts:50` re-checks it at decide time (step 15 D9-A precedent). Grants and `roles.ts` are unchanged.
- Web comments that name `bills.review` as a live writer: `bills.tsx:328`, `:1008`, `:1106`; `-bills.columns.tsx:795-807`. Reword them to the engine. No behaviour change.

### 4.5 Data model

**No schema change.** No new column, index or constraint. Rows written are unchanged in shape. The only data-visible change is that refused writes no longer happen.

### 4.6 API contracts (all input shapes unchanged)

| Procedure | Change | New refusals (all `CONFLICT`) |
|---|---|---|
| `costLines.unbill` | output unchanged | under review; approved (non-editable flow) |
| `bills.dissolve` | output unchanged | under review |
| `bills.update` | Phase 1: under review refused. Phase 2: after approval, only signed-field patches refused | under review; approved + signed field |
| `auditReview.submit` (bill) | waits on a concurrent bill write | none new |
| `bills.review`, `bills.reviewBatch` | **removed** (Phase 3) | 404 |
| `bills.invoice`, `writeOffs.*`, `auditReview.decide*` | unchanged | none |

### 4.7 Key decisions (all Decided 2026-09-21 — §9)

- D1-A what freezes a bill's line set (Task 1.2 `retotal`)
- D2-A dissolve under review / after approval (Task 1.2 `dissolve`)
- D3-A header edits under review (Task 1.2 `update`)
- D4-A which header fields stay writable after approval (Phase 2)
- D5-A legacy verbs (Phase 3)
- D6-A submit-time lock (Task 1.3)
- D7-C bill self-decision (no task; Task 3.4 not done)
- D8-A bills already rewritten after approval (report only)

---

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- D1, D2, D3 and D6 settled (A, 2026-09-21). Re-check before the Phase 1 release note: 23-P1 and 23-P2; if either contradicts the choice, stop and re-plan.
- Step 08 Phases 1 and 3 merged (gates.ts docblock, `post-approval.ts` optional message, re-submit refusal). If not merged, Phase 1 can still land with the generic message; say so in the PR.
- Re-locate every anchor by symbol at the base commit.

### Phase 1 — What the reviewers read is what they sign (Findings A, B, C, F)

**Delivers:** Journeys 1 and 2 end to end. Journey 4 unchanged.
**Dependencies:** D1, D2, D3, D6. No other plan's code is required (step 08 only improves the message).

- **1.1** Add and export `underReviewGate(resourceType)` in `modules/governed/gates.ts` (§4.1) and correct the `postApprovalGate` docblock. It is the shared gate (X34): step 21 Phase 2 imports it by exactly this name for the cost-line `delete` verb, so keep the name and signature. Files: `packages/api/src/modules/governed/gates.ts`. · **Agent A (backend)**
- **1.2** Wire the gates into `billWriter` per §4.1:
  - `update`: prepend `underReviewGate("bill")` (D3-A).
  - `retotal`: `[underReviewGate("bill"), billPostApprovalWithMessage]` (D1-A).
  - `dissolve`: `[underReviewGate("bill")]` (D2-A).
  - Rewrite the `delete_fee` comment at `cost-lines.ts:1432-1434`. The call stays.

  Files: `packages/api/src/routers/expense/bills.ts`, `packages/api/src/routers/expense/cost-lines.ts` (comment only). · **Agent A (backend)**
- **1.3** `REVIEWABLE_RESOURCES.bill.exists` loads `FOR UPDATE` (D6-A). Files: `packages/api/src/modules/audit/resources.ts`. · **Agent A (backend)**
- **1.4** Router tests, new file `packages/api/src/routers/expense.bill-review-integrity.test.ts` [NEW] on PGlite. Build the org with `seedAuditFlows`, so the seeded bill flow is real, not raw-inserted. Actors: an accountant submitter (`m-acct1`), a second accountant, a director. Bill `b1` has three lines of 1,200 / 800 / 300. Cases:
  - **Invoice hand-off pin:** `bills.invoice` on never-submitted `b1` → CONFLICT containing `"Input invoice no." requires review approval first`. After submit and every stage passing → invoice succeeds. Then submit again (only if step 08 Task 3.2 is not on the base; otherwise assert that re-submit is refused) → invoice refused.
  - **Under review:** `costLines.unbill` on the 300 line → CONFLICT "under review", `b1.totalAmount` still `2300`, line `billId` still `b1`, no `expense.bill.retotal` or `expense.costLine.unbill` audit row. `bills.update` `{ invoiceTitle }` → CONFLICT, and the column is unchanged. `bills.dissolve` → CONFLICT, `b1` exists, all three lines still billed.
  - **Withdrawal granted** (`withdrawn`) → `unbill` succeeds, total `2000`.
  - **Approved, seeded flow:** `unbill` → CONFLICT with the approval sentence, total `2300`. `dissolve` (not invoiced) → succeeds, lines unbilled. `createBill` on the lines → new bill, and `bills.invoice` on it → gate CONFLICT.
  - **Approved, flow set `postApprovalEditable: true`:** `unbill` → succeeds (tenant configuration honoured).
  - **Rejected:** `unbill` and `update` succeed (a rejected attempt is terminal).
  - **Ordering:** a line carrying invoiced money on an under-review bill still gets the existing money refusal first (message unchanged).

  Also re-run `routers/expense.corrections.test.ts` (J6 un-bill/dissolve on never-submitted bills must stay green), `expense.review.test.ts`, `expense.bills.test.ts`, `audit-review.test.ts`, `modules/audit/gates.test.ts` and the api `architecture.test.ts`. Files: `packages/api/src/routers/expense.bill-review-integrity.test.ts` [NEW]. · **Agent A (backend)**
- **1.5** Real-Postgres lock proof `packages/api/src/routers/expense.bill-review.concurrency.test.ts` [NEW], `describe.skipIf(!DATABASE_URL_TEST)` like `expense.concurrency.test.ts:65`. Deterministic interleave:
  - Connection A opens a transaction and runs the `unbill` load path up to holding the bill row (`SELECT … FOR UPDATE` on `bill`).
  - Connection B calls `auditReview.submit` for the bill and must not resolve until A commits.
  - After A commits, B's submission exists. A second write through `bills.update` then refuses as under review.

  Run it first against the tree without Task 1.3 and record that it fails. Files: that file. · **Agent A (backend)**

**Acceptance.**
- In the browser (§10), Journeys 1 and 2 behave as written.
- `expense.bill-review-integrity.test.ts`, `expense.corrections.test.ts`, `expense.review.test.ts`, `expense.bills.test.ts`, `audit-review.test.ts`, `gates.test.ts` and the api `architecture.test.ts` pass, judged by reading the output for `failed`, not the exit code.
- `DATABASE_URL_TEST=… bunx vp test run packages/api/src/routers/expense.bill-review.concurrency.test.ts` lists its test as **passed**, not skipped.
- `bun run check-types` output shows no failure.

### Phase 2 — Paperwork can be finished after approval (Finding D)

**Delivers:** Journey 3.
**Dependencies:** Phase 1 merged (same verb's gate list). D4.

- **2.1** Replace `postApprovalGate("bill")` on the `update` verb with `billSignedFieldsPostApproval` and export `BILL_SIGNED_FIELDS` (§4.3, D4-A). Update the handler comment at `bills.ts:1163-1166`. Files: `packages/api/src/routers/expense/bills.ts`. · **Agent B (backend)**
- **2.2** Tests in `expense.bill-review-integrity.test.ts`. Approved `b1`, seeded flow:
  - `{ courier, courierNo, financialVoucherNo, exportedVoucher, remark, tags }` → saved and audited.
  - `{ invoiceTitle }`, `{ serviceFee }`, `{ exchangeRate }` → CONFLICT each.
  - A mixed patch `{ courierNo, invoiceTitle }` → CONFLICT, and neither column changed.
  - With `input_courier_no` ticked on the flow: a `courierNo` patch on a draft bill → gate CONFLICT; on the approved bill → saved.
  - Under review: a `courierNo` patch → CONFLICT (D3-A).

  Files: `packages/api/src/routers/expense.bill-review-integrity.test.ts`. · **Agent B (backend)**
- **2.3** Web `BillEditDialog`, per §4.3:
  - changed-keys-only payload;
  - an empty diff closes the dialog;
  - new `DialogDescription`;
  - the comment at `-bills.columns.tsx:811-813`.

  Files: `apps/web/src/routes/_next/expenses/bills.tsx`, `apps/web/src/routes/_next/expenses/-bills.columns.tsx`. · **Agent C (frontend)**

**Acceptance.**
- Journey 3 in the browser.
- The Phase 1 suite still passes.
- `bun run check-types` output shows `apps/web` ran with no failure.

### Phase 3 — Only the engine approves a bill (Finding E; Finding G not taken, D7-C)

**Delivers:** Journey 5.
**Dependencies:** D5. Step 08 Task 3.3 and step 15 Task 2.1 merged first (same allow-list region and the same registry resolution, X10). Phase 2 merged (same file). **Merges before step 21 Phase 3** (X33).

- **3.1** Delete `bills.review`, `bills.reviewBatch` and `billWriter`'s `review` verb. Remove the imports left unused. Delete `architecture.test.ts:872`, and **in the same commit** lower the floor at `architecture.test.ts:1273` (`expect(passed.length).toBeGreaterThanOrEqual(2)`) to the count that remains, re-counted at the base commit (do not guess), with a comment naming X33 (§4.4). Step 21 Task 3.1 later removes the last entry and replaces the floor with an empty-list assertion; step 21 skips its comment at `bills.ts:1189`, which sits in the `bills.review` docblock this task deletes. `routers/expense/review-batch.ts` stays: `cost-lines.ts` still imports `applyReviewBatch` until step 21 Phase 3, and X33 deletes the file only once `grep -rn "review-batch"` finds no importer and lint flags it. Drop `isEndpoint` on `[EXPENSE.billReview]` with its comment (§4.4). Files: `packages/api/src/routers/expense/bills.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/modules/expense/permissions.ts`. · **Agent D (backend)**
- **3.2** Tests:
  - delete the `describe("bills.review — …")` block (`expense.review.test.ts:210-392`, including its nested `reviewBatch` block at `:317`);
  - delete the two legacy cases in `expense.rbac.test.ts:515-525` and `:562`;
  - add a case: `Object.keys(billsRouter)` contains neither `review` nor `reviewBatch`;
  - add a case: a director **without** `expense.bill.review` on the open stage is refused by `decideByResource` (the node still bites through `decide.ts:50`).

  Run `permissions/registry.sync.test.ts`, `permissions/reachability.test.ts`, both architecture tests and `audit-review.test.ts`. Files: `packages/api/src/routers/expense.review.test.ts`, `packages/api/src/routers/expense.rbac.test.ts`, `packages/api/src/routers/expense.bill-review-integrity.test.ts`. · **Agent D (backend)**
- **3.3** Reword the web comments naming `bills.review` as live (`bills.tsx:328`, `:1008`, `:1106`; `-bills.columns.tsx:795-807`). Comments only. Files: `apps/web/src/routes/_next/expenses/bills.tsx`, `apps/web/src/routes/_next/expenses/-bills.columns.tsx`. · **Agent E (frontend)**
- **3.4** **Not done under D7-C** (kept for the record; it would apply only under D7-A). Set `bill.separationOfDuties = true` in `resources.ts`. This needs step 08 Task 2.1's switch on the base. Rewrite the 8+ self-decision bill tests step 08 lists (`audit-review.test.ts:626-629, 718-722, 1034-1036, 1063-1065, 1296-1319, 1331-1375`) to decide as the second accountant. Add a case: in a one-accountant org, submitting as that accountant is refused per step 08 D2-A. Files: `packages/api/src/modules/audit/resources.ts`, `packages/api/src/routers/audit-review.test.ts`. · **Agent D (backend)**

**Acceptance.**
- `/rpc/bills/review` → 404.
- Journey 4 golden path is unchanged in the browser.
- `registry.sync.test.ts` and both architecture tests pass, judged by reading the output.
- The api `architecture.test.ts` indirect-write floor at `:1273` equals the re-counted remaining entries (X33), carries its comment, and passes in the same commit that removes `:872`.

---

## 6. Delegation & Parallelization

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.5 | `packages/api/src/modules/governed/gates.ts`, `packages/api/src/routers/expense/bills.ts`, `packages/api/src/routers/expense/cost-lines.ts` (comment), `packages/api/src/modules/audit/resources.ts`, `…/routers/expense.bill-review-integrity.test.ts` [NEW], `…/routers/expense.bill-review.concurrency.test.ts` [NEW] | `modules/audit/{gates,post-approval,shared,submit,decide}.ts`, `modules/governed/writer.ts`, `modules/audit/seed.ts`, `packages/db/src/schema/{expense,audit}.ts` |

Opus: a refusal inside the only writer of `bill.total_amount`, a row lock in the shared engine registry, and a lock proof that must fail first.
Run mode: single agent. Serialization point: after 1.4, run `bunx vp test run packages/api/src/routers/expense.bill-review-integrity.test.ts packages/api/src/routers/expense.corrections.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/architecture.test.ts` and grep for `failed`.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent B (backend) | backend-engineer | sonnet | medium | 2.1–2.2 | `packages/api/src/routers/expense/bills.ts`, `…/expense.bill-review-integrity.test.ts` | `modules/audit/post-approval.ts`, `modules/expense/gates.ts` |
| Agent C (frontend) | frontend-engineer | sonnet | medium | 2.3 | `apps/web/src/routes/_next/expenses/bills.tsx`, `…/-bills.columns.tsx` | `packages/api/src/routers/expense/bills.ts` |

Run mode: **B ∥ C**. C needs no new output field, because the input shape is unchanged. Serialization point: `bun run check-types` after both.

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent D (backend) | backend-engineer | sonnet | medium | 3.1, 3.2 (3.4 not done, D7-C) | `packages/api/src/routers/expense/bills.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/modules/expense/permissions.ts`, `…/expense.review.test.ts`, `…/expense.rbac.test.ts`, `…/expense.bill-review-integrity.test.ts` (`modules/audit/resources.ts`, `routers/audit-review.test.ts` only under D7-A, not taken) | `procedures/org.ts`, `permissions/registry.sync.test.ts`, `routers/expense/review-batch.ts` |
| Agent E (frontend) | frontend-engineer | haiku | low | 3.3 | `apps/web/src/routes/_next/expenses/bills.tsx`, `…/-bills.columns.tsx` | none |

Run mode: **D ∥ E** (comments only on E's side).

Smell test: one owner per file per phase · `bills.ts` passes A → B → D strictly in sequence · `bills.tsx` passes C → E · every wait names its artifact (Phase 1 merged verb list; step 08/15 allow-list merges) · Phase 1 alone closes the money defect.

---

## 7. Impact & Breakage

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`, 2026-09-21)

- **`billWriter.mutate(…, "retotal", …)`**: `cost-lines.ts:1448` only. Web caller of `costLines.unbill`: `cost-lines.tsx:1914-1926` (toasts `error.message`). Tests: `expense.corrections.test.ts:148-212` (never-submitted bills, so unaffected), `expense.concurrency.test.ts` (if it un-bills, same).
- **`billWriter.remove(…, "dissolve", …)`**: `bills.ts:1549` only. Web: `bills.tsx:975-986`. Tests: `expense.corrections.test.ts:214-270`, `:519`.
- **`billWriter.mutate(…, "update", …)`**: `bills.ts:1165` only. Web: `bills.tsx:368-379`. Tests: `expense.review.test.ts:393-500`.
- **`REVIEWABLE_RESOURCES.bill.exists`**: `submit.ts:39` only.
- **`postApprovalGate` (shared)**: bill `update` only (`bills.ts:510`). Cost lines use their own local copy (`cost-lines.ts:139-143`). Phase 2 removes the bill's use; the helper stays exported.
- **`assertNotUnderReview`**: new caller through `underReviewGate`; signature unchanged.
- **`bills.review` / `bills.reviewBatch`**: no web or e2e caller (`apps/web/src/architecture.test.ts:957` bans it). Tests `expense.review.test.ts:210-392`, `expense.rbac.test.ts:515-525, 562`. Allow-list `architecture.test.ts:872`, and the indirect-write floor at `architecture.test.ts:1273` that its removal must lower (X33). External scripts would 404; none found in the repo.
- **`EXPENSE.billReview` node**: `permissions.ts:39, 136-140`, `resources.ts:443`, `roles.ts:207` (director leaf), `bills.ts:1208, 1389`. After Phase 3 the node stays and is checked at decide time.
- **`BillEditDialog`**: rendered once from `BillsPage` (`bills.tsx`), in both ledger and review modes.

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| Remove a line from an under-review bill | 200, total drops | 409 | API-only; web already toasts |
| Remove a line from an approved bill (seeded flow) | 200, total drops, still Approved | 409 | API-only |
| Remove a line from a draft or rejected bill | 200 | 200 | – |
| Dissolve an under-review bill | 200, ghost submission | 409 | API-only |
| Dissolve an approved, uninvoiced bill | 200 | 200 (D2-A) | – |
| Edit invoice title while under review | 200 | 409 | API-only |
| Edit courier no. on an approved bill | 409 | 200 (Phase 2) | API first: the old web sends all fields, so a save still hits a signed field and is refused until web lands. Correct, but unexplained. Web first: harmless (a smaller payload, still refused by the old API) |
| Submit during a concurrent bill write | both commit | submit waits | API-only |
| Legacy `bills.review` RPC | 200 | 404 | API-only |
| Submit → approve → invoice | 200 | 200 | – |

### 7.3 Behaviour change for existing orgs and live bills

- **Phase 1 changes every org with an enabled bill flow immediately.** No config is involved: under-review freezes are not configurable.
  - Bills currently under review (23-P2 counts them) become read-only for un-bill, dissolve and header edits until decided or withdrawn.
  - Under the seeded non-editable flow, approved bills stop losing lines. Orgs that set **Can edit after approval** (23-P1) keep today's post-approval behaviour.
  - Orgs with **no enabled bill flow** are untouched: no submission can exist, so no freeze fires.
- **Phase 2 loosens** the post-approval freeze on bills to the four signed fields, for every org with a non-editable flow.
- **Phase 3** removes two RPC verbs no screen uses. 23-P6 sizes any external use.
- **Operations announcement (with the Phase 1 deploy):** "To change a bill under review, request withdrawal first. To change an approved bill that is not invoiced, dissolve it and bill again; the new bill needs a fresh review."

### 7.4 Nullable assumptions

- `bill.audit_status` is nullable (NULL = never submitted, `schema/expense.ts:295`). No new guard reads it; every guard reads `audit_submission`.
- `bill.exchange_rate` is nullable (`:278`). Phase 2 treats a `null` in the patch as a signed-field write (clearing the rate is a change).
- `audit_submission.resource_id` has no FK, so orphans are possible and existing ones are reported (23-P3), not repaired.
- `cost_line.bill_id` NULL means unbilled. The unbill pin is unchanged.

### 7.5 Deployment coupling

- Phase 1 is API-only. Phase 2: deploy API and web together (see the row in §7.2). Phase 3 is API-only, plus comments.
- Build `apps/web` before deploy so a partial deploy does not split the stage (memory `alchemy-partial-deploy-splits-the-stage`).
- No migration in any phase.

### 7.6 Merge order against steps 04–27

| Plan / task | Shared code | Relation to step 23 |
|---|---|---|
| **02 Task 1.2** | `bills.ts` `bills.invoice` (credit re-check, `creditOverrideReason`) | Different procedure. Either order; the second rebases by symbol. Task 1.4's invoice pin must pass with 02's new optional input absent. |
| **04** | `modules/audit/seed.ts` / `seed.test.ts:154-170` (pins the bill gate keys) | Step 23 does not touch the seed. No conflict. |
| **08 Task 1.2** | `resources.ts` (`quotation.exists` `FOR UPDATE`) | Task 1.3 copies the pattern on the `bill` entry. 08 first. |
| **08 Task 1.3** | `modules/audit/gates.ts` `assertNotUnderReview` docblock | `underReviewGate` calls it unchanged. 08 first (docblock callers list gains bills). |
| **08 Task 2.1** | `resources.ts` `separationOfDuties` (written `false` on `bill`) | Task 1.3 edits the same entry. **08 first.** Task 3.4 would flip it under D7-A; not done (D7-C). |
| **08 Task 3.1** | `post-approval.ts` optional `message` | Task 1.2 uses it for the bill sentence. **08 first** (else generic message). |
| **08 Task 3.2** | `submit.ts` re-submit refusal | Changes Task 1.4's re-submit case (asserted either way). **08 first.** |
| **08 Task 3.3** + X10 | `architecture.test.ts` legacy-verb entries; registry resolution | Phase 3 follows the same resolution. **08 first.** |
| 10 Task 1.2 | `resources.ts` (`onPassed?`), `decide.ts`, `submit.ts` | Different entry. Rebase by symbol. |
| 10 Task 2.2, 11 Task 3.1 | `cost-lines.ts` `importFromQuote` | Different procedure from Task 1.2's comment edit. Either order. |
| **15 Task 1.1** | `modules/audit/gates.ts` (`assertNoneUnderReview`), `post-approval.ts` (`…Many`) | Step 23 adds nothing to either file (its new gate lives in `governed/gates.ts`). No conflict; either order. |
| **15 Task 1.3** | `resources.ts` `collective_order.exists` lock | Neighbouring entry. The second to merge rebases. |
| **15 Task 2.1** | `architecture.test.ts:876` removal (`collectiveOrder.reviewBatch`), adjacent to `:872`; `permissions.ts` D9-A pattern | **Phase 3 after 15 Phase 2** (neighbouring lines, same pattern). |
| **21 Task 3.1** + X33 | `architecture.test.ts:871` (last `ALLOWED_INDIRECT_WRITES` entry) and the floor at `:1273`; `permissions.ts` neighbouring blocks (`:110-114` vs `:136-140`); other cases of `expense.review.test.ts` / `expense.rbac.test.ts` | **23 Phase 3 before 21 Phase 3.** Task 3.1 lowers the floor to the re-counted remainder in the commit that removes `:872`; 21 then replaces it with an empty-list assertion and skips its `bills.ts:1189` comment (deleted here). 21 rebases and runs `registry.sync.test.ts`. |
| **21 Task 2.2** + X34 | imports `underReviewGate` from `modules/governed/gates.ts` for the cost-line `delete` verb | Task 1.1's export is the shared gate; 23 Phase 1 lands first. No local shadow in `cost-lines.ts` (21 names its variant `costLineContentUnderReviewGate`). |
| **15 Task 3.3** | `cost-lines.ts` `costLines.create` `expense_entry` gate | Different procedure. Either order; must be kept. |
| 16–17 (no plans in `plans/` at writing) | `lading.ts` | No overlap. |
| **22** (no plan yet) | `cost-lines.ts` `createBill`, `bills.ts` bill creation, possibly `resources.ts` `bill.exists` state check (Phase 0 adjacent item 2) | If 22 adds a state check to `bill.exists`, it must keep Task 1.3's `.for("update")`. Merge 23 Phase 1 first, or 22 re-locates. |
| **24** (no plan yet) | `bills.ts` `bills.invoice` (gate at `:1765`), Invoicing dialog in `bills.tsx` | Must keep the `input_invoice_no` call and Task 1.4's pin. Its dialog work in `bills.tsx` is a different component from `BillEditDialog`; rebase. |
| **25** (no plan yet) | invoice document (reads `invoiceTitle`) | Reads only. Phase 2 freezes `invoiceTitle` after approval (D4-A). |
| **26** (no plan yet) | `write-offs.ts` `verify`/`reverse` gates; `cancel_write_off` seeding; `bills.ts` `exchangeRate` | Must keep the `write_off` call. If 26 needs to set `bill.exchangeRate` after approval, it collides with D4-A (see D4). |
| **27** (no plan yet) | `bills.totals`, month-end pack (reads) | Reads only. |
| Migration journal | none of step 23's phases | – |

**Recommended order:** 08 (Phases 1–3) → **23 Phase 1** → 23 Phase 2 → 15 Phase 2 → **23 Phase 3** → 21 Phase 3 (X33), one phase per worktree. Phase 1 has no dependency on steps 10–15 beyond rebasing `resources.ts`. It closes a live money defect, so it should go in the earliest wave after step 08.

### 7.7 Read-only production probes (SELECT only; Wilfred runs them; none blocks writing code)

```sql
-- 23-P1 Bill flow per org: enabled, post-approval lock, ticked gates, stages (D1, D4, D7)
select f.organization_id, f.id as flow_id, f.enabled, f.post_approval_editable, f.withdrawal_mode,
       (select string_agg(g.gate_key, ',' order by g.gate_key)
          from audit_flow_gate g where g.flow_id = f.id) as gates,
       (select string_agg(s.stage_no || ':' || s.quorum_rule, ' ' order by s.stage_no)
          from audit_flow_stage s where s.flow_id = f.id and s.kind = 'review') as stages
from audit_flow f where f.trigger_type = 'bill'
order by f.organization_id;

-- 23-P2 Live bills by latest submission (what Phase 1 freezes on deploy)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'bill'
  order by resource_id, submitted_at desc, created_at desc)
select b.organization_id, coalesce(l.status, 'never_submitted') as latest, b.status, count(*) as bills
from bill b left join latest l on l.resource_id = b.id
group by 1, 2, 3 order by 1, 2, 3;

-- 23-P3 Ghost submissions: open reviews whose bill no longer exists (Finding B residue)
select s.organization_id, s.id as submission_id, s.status, s.submitted_at
from audit_submission s left join bill b on b.id = s.resource_id
where s.resource_type = 'bill' and b.id is null
  and s.status in ('under_review', 'withdrawal_under_review')
order by s.submitted_at;

-- 23-P4 Totals rewritten while under review or after approval (Finding A exposure, D8)
select a.organization_id, a.target_id as bill_id, a.created_at, s.status as attempt_status,
       s.submitted_at, s.resolved_at, a.before_json, a.after_json
from audit_log a
join lateral (
  select x.status, x.submitted_at, x.resolved_at from audit_submission x
  where x.resource_type = 'bill' and x.resource_id = a.target_id and x.submitted_at <= a.created_at
  order by x.submitted_at desc limit 1) s on true
where a.action = 'expense.bill.retotal'
  and ((s.resolved_at is null or s.resolved_at > a.created_at) or s.status = 'passed')
order by a.created_at;

-- 23-P5 Header edits made while a review was open (Finding C exposure, D3)
select a.organization_id, a.target_id as bill_id, a.created_at, a.after_json
from audit_log a
join audit_submission s on s.resource_type = 'bill' and s.resource_id = a.target_id
  and a.created_at > s.submitted_at and (s.resolved_at is null or a.created_at < s.resolved_at)
where a.action = 'expense.bill.update'
order by a.created_at;

-- 23-P6 Legacy verb use (D5)
select organization_id, action, count(*) as calls, min(created_at), max(created_at)
from audit_log where action in ('expense.bill.review', 'expense.bill.reviewBatch')
group by 1, 2;

-- 23-P7 Cache drift: bill.audit_status disagrees with the latest submission (D5)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'bill'
  order by resource_id, submitted_at desc, created_at desc)
select b.organization_id, coalesce(b.audit_status, 'draft') as cache, coalesce(l.status, 'none') as latest, count(*)
from bill b left join latest l on l.resource_id = b.id
where coalesce(b.audit_status, 'draft') <> case l.status
        when 'under_review' then 'pending' when 'passed' then 'approved'
        when 'rejected' then 'rejected' when 'withdrawal_under_review' then 'withdraw_pending'
        when 'withdrawn' then 'withdrawn' else 'draft' end
group by 1, 2, 3 order by 1, 2, 3;

-- 23-P8 Paperwork dead end: approved bills missing courier / voucher numbers (D4)
with latest as (
  select distinct on (resource_id) resource_id, status, flow_id
  from audit_submission where resource_type = 'bill'
  order by resource_id, submitted_at desc, created_at desc)
select b.organization_id, b.status, f.post_approval_editable, count(*) as approved_bills,
       count(*) filter (where b.courier_no is null) as no_courier_no,
       count(*) filter (where b.financial_voucher_no is null) as no_voucher_no
from bill b join latest l on l.resource_id = b.id and l.status = 'passed'
join audit_flow f on f.id = l.flow_id
group by 1, 2, 3 order by 1, 2, 3;

-- 23-P9 Self-decision at stage 1, and accountants per org (D7)
select s.organization_id, count(*) as self_decided_stage_1
from audit_submission s
join audit_stage_instance i on i.submission_id = s.id and i.kind = 'review' and i.stage_no = 1
join audit_decision d on d.stage_instance_id = i.id and d.reviewer_id = s.submitted_by
where s.resource_type = 'bill'
group by 1;
select organization_id, count(*) as accountants from member where role = 'accounting' group by 1;
```

Re-check the cache vocabulary in 23-P7 against `cacheStatusFor` (`resources.ts`) at the base commit before reading its output.

### 7.8 Blocking prerequisites

- D1-A, D2-A, D3-A, D6-A settled (2026-09-21) → release Phase 1. D4-A → Phase 2. D5-A → Phase 3 (D7-C: no task).
- Step 08 Phases 1–3 merged → recommended before Phase 1 (message and re-submit behaviour). Step 15 Phase 2 merged → blocks Phase 3.
- `DATABASE_URL_TEST` for a dev Neon branch (`br-wandering-mud`, never the production default branch) → blocks Task 1.5 acceptance.
- Probe checks (a contradiction stops the task for a re-plan): 23-P1 and 23-P2 before the Phase 1 release note; 23-P8 before Phase 2; 23-P6 and 23-P7 before Phase 3. Re-check before Phase 3: 23-P9; if it shows orgs where stage 2 is disabled or skipped by a condition, stop and re-plan D7.

---

## 8. Cross-Cutting Concerns

- **Errors.** Every new refusal is `ORPCError("CONFLICT")` from the shared helpers, with an operator sentence. The under-review sentence names the fix (retract). The post-approval sentence on `retotal` names the fix (dissolve and bill again). Each guard runs after the scoped writer load, so a foreign id still answers NOT_FOUND first (`gates.ts:59-62` house rule). All three web mutations already toast `error.message`.
- **Testing.** PGlite router tests at the API boundary (1.4, 2.2, 3.2) on an org seeded through `seedAuditFlows`; one real-Postgres interleave (1.5), seen failing without the lock first; both architecture tests and the registry sync (Phase 3); browser proof in §10.
- **Migration.** None.
- **Rollback.** Every phase is a plain revert. No phase writes data differently; they only refuse. Phase 3's revert restores the verbs and `isEndpoint` together.
- **Audit trail.** Refusals write nothing (matches every guard in these routers). The engine's `audit.submit` / `audit.decide` rows become the only record of bill reviews after Phase 3. Existing `expense.bill.review` rows stay as history.

**Performance & Scalability**
1. **Pagination.** Not applicable: single-record mutations.
2. **SQL-side filtering.** Each new check is one `latestSubmissionByResource` read (`shared.ts:332`, one `IN` query), plus one `audit_flow` read when the latest attempt passed.
3. **N+1.** `dissolve` and `retotal` act on one bill each. `update` is single-row.
4. **Index coverage.** The same `audit_submission (organization_id, resource_type, resource_id)` path every existing freeze uses; no new WHERE shape. The index name was not re-verified in this pass.
5. **Write atomicity.** All checks run inside the handler's existing transaction, on the writer's locked row. A refusal rolls back the line release that preceded it.
6. **Row locking.** `bill.exists` gains `FOR UPDATE`, so submit and bill writes on the same bill serialise for the length of one write (sub-second). Other bills are not blocked.
7. **Connections/resources.** None new.
8. **Tenant isolation.** Every added read filters `organization_id`. `exists` keeps its org predicate.
9. **Payload size.** Phase 2's dialog sends fewer keys.
10. **Hot path.** `bills.update` and `costLines.unbill` are operator actions. `bills.list` is untouched.

---

## 9. Decision Register, Open Questions & Risks

On 2026-09-21 Wilfred accepted the recommended option of every decision below, and every Proposed reading in `steps-20-26-crosscheck.md` X28–X40; where an X-item touches a decision, the Chosen line says so (none overrides this plan's own recommendation). Each keeps its three approaches. Tasks are worded for the chosen option.

**D1: What freezes a bill's line set (un-bill and the re-total)?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.2 (`retotal`)

| | Approach | Consequence |
|---|---|---|
| **A** | **Freeze while under review, and after approval when the flow is not editable**, as gates on the `retotal` verb (Recommended) (Chosen) | What the reviewers read cannot change, and what they signed is what is invoiced. It covers every caller of `retotal`. Tenants who chose **Can edit after approval** keep that. A wrong approved bill is fixed by dissolving it (D2-A), which forces a new review. |
| **B** | Freeze while under review only | Closes the "shrunk under the reviewer" half. An approved total can still be rewritten and invoiced, which is the ledger item's headline. |
| **C** | Tick `delete_fee` in the seed (the ledger's implied repair) | A gate means "requires approval first" (`gates.ts:92`), so this freezes un-bill on every draft bill, freezes it under review, and **releases it after approval**, which is the defect. It also changes only new orgs (seed at `org.create`). |

- **Recommendation: A.** It is the only option that protects the signed figure, and it uses the existing post-approval switch rather than a new rule.
- **Chosen: A** (Wilfred, 2026-09-21).
- **Releases:** Task 1.2 `retotal`, Journeys 1–2. **Re-check:** 23-P1 (how many orgs run an editable bill flow) and 23-P4 (how often this has happened).

**D2: Can a bill be dissolved while under review, or after approval?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.2 (`dissolve`)

| | Approach | Consequence |
|---|---|---|
| **A** | **Refuse while under review; allow after approval** (Recommended) (Chosen) | Removes the ghost submission. An approved but wrong, uninvoiced bill has a way back: dissolve, correct the lines, re-bill, and the new bill must pass review before it can be invoiced. No approved total is ever rewritten; it is discarded with its bill. The discarded approval stays in `audit_submission` as history. |
| **B** | Refuse while under review and after approval | The strongest freeze, but an approved bill with a wrong line can then never be corrected: retract works only while under review (`withdraw.ts`), and step 08 D3-A refuses re-submitting a locked approval. The fix happens outside the system. |
| **C** | Leave dissolve alone; clean ghost rows with a report | No behaviour change. Ghosts keep inflating every reviewer's Pending count (23-P3), and a reviewer can still lose the bill they are reading. |

- **Recommendation: A.** It closes the integrity hole without creating a dead end.
- **Chosen: A** (Wilfred, 2026-09-21).
- **Releases:** Task 1.2 `dissolve`, Journey 2 step 3.

**D3: Are the bill's header fields frozen while under review?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.2 (`update`)

| | Approach | Consequence |
|---|---|---|
| **A** | **Freeze every field of `bills.update` while under review** (`underReviewGate`; Recommended) (Chosen) | The same non-configurable rule as contracts, ladings and fee templates (`gates.ts:103-129`). Courier or remark typos wait until the review ends (usually hours). |
| **B** | Freeze only the signed fields (`BILL_SIGNED_FIELDS`) while under review | Paperwork stays writable during review. It adds a second, per-field meaning of "under review" that no other resource has. |
| **C** | No change | A reviewer can approve an invoice title or rate that changed after they read it (23-P5 sizes it). |

- **Recommendation: A.** One rule for every reviewed record; the window is short.
- **Chosen: A** (Wilfred, 2026-09-21).

**D4: After approval, which bill fields stay writable?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Phase 2

| | Approach | Consequence |
|---|---|---|
| **A** | **Freeze the signed fields (`invoiceTitle`, `serviceFee`, `serviceFeeCurrency`, `exchangeRate`); leave courier, courier no., voucher no., exported voucher, remark and tags writable**, and send only changed keys from the dialog (Recommended) (Chosen) | Steps 24–26 can record their paperwork. The invoice's buyer title and the bill's rate stay what was signed. If step 26 needs to set `exchangeRate` after approval (the FX ledger item), it must re-open this decision. |
| **B** | Make every field writable after approval (drop the post-approval gate on `update`) | Simplest. An approved bill's invoice title and rate can change after sign-off; `exchangeRate` feeds `localAmount` and `bills.totals`. |
| **C** | Keep today's full freeze | Paperwork stays outside the system (23-P8 sizes it). Ticking `input_courier_no` / `input_voucher_no` under a non-editable flow keeps making those fields unwritable forever. |

- **Recommendation: A.** It follows the `markFinanceSynced` reasoning already in the code (`bills.ts:1306-1311`).
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X40 records that step 26 does not write `bill.exchange_rate`, so the re-open condition in row A does not arise.

**D5: What happens to `bills.review` / `bills.reviewBatch`?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Phase 3

| | Approach | Consequence |
|---|---|---|
| **A** | **Delete both and the writer's `review` verb; drop `isEndpoint` on `expense.bill.review`, keep the node** (step 15 D9-A precedent; Recommended) (Chosen) | The engine becomes the only writer of the badge. Grants unchanged. About 190 lines of tests go with the verbs. |
| **B** | Keep them, but refuse whenever the bill has any `audit_submission` | Keeps an RPC path for orgs with no flow. It is still a second approval machine that files nothing. |
| **C** | Keep them; report drift (23-P7) | No change. The queue can still be emptied of a waiting bill by one RPC call. |

- **Recommendation: A.** No screen calls them, and their docblock already says they were meant to go.
- **Chosen: A** (Wilfred, 2026-09-21); crosscheck X33: Task 3.1 also lowers the indirect-write floor at `architecture.test.ts:1273` in the same commit, and 23 P3 merges before 21 P3.

**D6: Does submit lock the bill row?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.3

| | Approach | Consequence |
|---|---|---|
| **A** | **`FOR UPDATE` in `bill.exists`** (Recommended) (Chosen) | Submit and bill writes serialise. One line, same as steps 08 and 15. Proven only on real Postgres. |
| **B** | No lock; accept the race | A write that read "not under review" can commit after a submit. Rare (two people, same bill, same second), and the reviewer reads the committed state anyway unless they decide in that window. |
| **C** | Lock generically in `submitForReview` for every resource | One place for all resources, but it changes the engine for every step at once and duplicates the per-entry locks steps 08/15 already add. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).

**D7: May an accountant decide their own bill at stage 1?** · Status: **Decided 2026-09-21 — Chosen: C** · Blocks: Task 3.4 only

| | Approach | Consequence |
|---|---|---|
| **A** | Turn `separationOfDuties` on for `bill` (step 08's switch) | The submitter cannot sign their own stage 1, and the denominator excludes them. **An org with one accountant can no longer submit a bill from that accountant** (step 08 D2-A), so it cannot invoice until someone else submits. It also means rewriting 8+ tests. |
| **B** | Turn it on only when stage 1 still has another eligible reviewer | No dead end. It is a new conditional rule in the shared engine, and in one-accountant orgs self-approval continues silently. |
| **C** | **Leave it off; the director stage is the independent check** (Recommended) (Chosen) | Matches the roles design (the director holds no write) and today's tests. Stage 1 is "the accountants agree", not "someone other than the submitter". 23-P9 shows how often it happens. |

- **Recommendation: C**, unless 23-P9 shows orgs where stage 2 is disabled or skipped by a condition. Then A with an announcement.
- **Chosen: C** (Wilfred, 2026-09-21). Task 3.4 is not done. Re-check before Phase 3: 23-P9; if it shows stage 2 disabled or skipped, stop and re-plan.

**D8: What happens to bills whose total already changed after approval?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: nothing

| | Approach | Consequence |
|---|---|---|
| **A** | **Report only**: run 23-P4, and Wilfred reviews each row with accounting (Recommended) (Chosen) | No automated write. An invoice already issued for a rewritten figure is a customer conversation, not a script. |
| **B** | Reset the latest submission of each affected, uninvoiced bill so it needs a fresh review | Forces re-signing. It is a write to review history by script, which is exactly what the engine exists to prevent. |
| **C** | Ignore | Unknown exposure stays unknown. |

- **Recommendation: A.**
- **Chosen: A** (Wilfred, 2026-09-21).

### Risks

- **Bills under review become read-only on deploy.** Likely; low impact. → **Announce "request withdrawal before changing a bill" with the Phase 1 deploy; 23-P2 gives the count.**
- **Accounting relies on removing lines from approved bills.** Medium; D1-A makes them dissolve and re-bill, which costs a fresh review. → **23-P4 before the release note. If it contradicts D1-A (routine use), stop and re-plan D1 before merging.**
- **Phase 2 partial deploy.** An old web against the new API still sends every field, so a paperwork save on an approved bill is still refused until the web lands. → **Deploy API and web together; build web first.**
- **Step 26 needs `exchangeRate` after approval.** Unknown until step 26 is planned. → **D4 names it; step 26's plan must read D4.**
- **PGlite cannot prove the lock.** Certain. → **Task 1.5 on the dev branch, seen failing first. CI has no `DATABASE_URL_TEST`, so the PR pastes the output.**
- **Line numbers drift** (steps 02, 08, 10, 11, 15 edit the same files). Certain. → **Locate by symbol.**
- **A stale `:3000` server makes browser checks pass on old code** (memory `bun-hot-ignores-workspace-deps`). High. → **Restart the server after every `packages/api` change and check the process start time.**

### SOP text vs code (Phase 0 wins)

| # | SOP / ledger claims | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| 1 | "It does not protect the bill's own total: a line can still be removed, and the re-total that follows is not frozen" | True (`cost-lines.ts:1383-1452`, `bills.ts:513-534`), and also true **while under review**. Dissolve is a second path (`bills.ts:1457`) | Code (D1, D2) |
| 2 | Ledger `bill-rewrite`: "the two [gates] it skips protect the signed figure" | `delete_fee` would freeze drafts and release approved bills (`gates.ts:92`); it cannot protect a signed figure | Code (D1-A, not C) |
| 3 | "Invoicing is frozen until the bill's latest review passes" | True (`bills.ts:1765-1771`), but read on `context.db` before the transaction; no router test pins it | Code (Task 1.4 pin; race flagged to 24) |
| 4 | Pitfall: "re-submitting after approval re-freezes it" | True at HEAD; false for seeded non-editable flows once step 08 Task 3.2 (D3-A) lands, because re-submit is refused | Code (Task 1.4 asserts either way) |
| 5 | Pitfall: "Seeded flow needs BOTH accounting reviewers" | Every member holding the accounting role (`eligibleReviewerCount`, `shared.ts:247`), including the submitter; one in the e2e seed | Code (§10 uses one accountant) |
| 6 | writes: "approved or rejected with auditor, time and reason per stage" | The bill row is stamped once, by the final decider (`decide.ts:156`); per-stage verdicts live in `audit_decision` | Code |
| 7 | result: "invoicing and write-off are unfrozen" | True, and at the same moment every header field freezes, courier and voucher included (`post-approval.ts:43-53`) | Code (D4) |
| 8 | Web comment: "Bill details are editable at ANY status … never money" (`-bills.columns.tsx:811-813`) | Refused after approval; `exchangeRate` and `serviceFee` are money figures | Code (Task 2.3) |
| 9 | `bills.review` docblock: "retired by the wave-5 queue cut-over" (`bills.ts:1204-1205`) | Still live over RPC, with `bills.reviewBatch` | Code (D5) |
| 10 | Web comment: "`bills.review` is the only writer of `pending`" (`-bills.columns.tsx:795`) | The engine repaints it on submit (`resources.ts:452-474`) | Code (Task 3.3) |
| 11 | Role: submitter "audit.read and expense.bill.update" | True (`audit-review.ts:356`, `resources.ts:442`); accounting, admin and branch-manager all hold it through the `expense` root | Code |
| 12 | Golden path: "All-or-nothing batch" | True (`audit-review.ts:389-424`) | none |

---

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000. One worktree's servers at a time.
**Preconditions:**
- A freshly seeded e2e org: `bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>`. Its `seedAuditFlows` call gives it the seeded Bill review flow: stage 1 accounting, stage 2 director, gates `input_invoice_no` and `write_off`, not editable after approval. Re-read `ACTORS` at the base commit (`seed-cli.ts:52-77`, uncommitted edits at HEAD per X16). The walk uses:
  - **Submitter / accounting operator: `managerA`** (branch-manager, `expense` root: edit, submit, un-bill, dissolve, invoice). Not a stage reviewer, so self-decision does not blur the result.
  - **Stage 1: `accountant`** (the org's only accounting member, so stage 1 passes on one approval).
  - **Stage 2: `directorA`.**
  - **Flow editor: `owner`.**
- Confirm the actor with `fetch('/api/auth/get-session')` before each actor's steps (memory `shared-session-active-org`). Restart `:3000` after the last `packages/api` edit.
- Bill **B1**: as `managerA`, create three receivable MYR lines of 1200, 800 and 300 (`costLines/create`), then `costLines/createBill` → one bill, total 2300 (the construction `e2e/specs/audit.bill-queue.spec.ts:60-80` uses). Bills **B2** and **B3** the same way, with two lines each.

**Migrations:** none. Confirm `_journal.json` still ends where the merged steps left it.

**Test commands** (read the output for `failed` and the `Test Files` line; `bun run check-types` can exit 0 while printing "failed"):
- Phase 1: `bunx vp test run packages/api/src/routers/expense.bill-review-integrity.test.ts packages/api/src/routers/expense.corrections.test.ts packages/api/src/routers/expense.review.test.ts packages/api/src/routers/expense.bills.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/modules/audit/gates.test.ts packages/api/src/architecture.test.ts`, then `DATABASE_URL_TEST=<dev branch URL> bunx vp test run packages/api/src/routers/expense.bill-review.concurrency.test.ts` (confirm passed, not skipped).
- Phase 2: the first file above, plus `bun run check-types` (confirm `apps/web` ran).
- Phase 3: `bunx vp test run packages/api/src/permissions/registry.sync.test.ts packages/api/src/permissions/reachability.test.ts packages/api/src/routers/expense.review.test.ts packages/api/src/routers/expense.rbac.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/architecture.test.ts apps/web/src/architecture.test.ts`, then `e2e/specs/audit.bill-queue.spec.ts`.

**Golden path — Journeys 4, 1 and 2 (Phase 1)**
1. As `managerA`, go to `/expenses/bills`. B1's row shows Audit status **Draft** and total 2,300.
2. B1 → clipboard icon (**Review**) → **Submit for review** → success toast. The row reads **Pending**.
3. Go to `/expenses/cost-lines`, find the 300 line → **Remove from bill** → confirm → error toast _"This record is under review and cannot be edited. Retract the submission first."_ In the console, `bills/get` for B1 → `totalAmount` `"2300"`. The line still shows B1.
4. `/expenses/bills` → B1 → **Edit bill** → change Invoice Title → **Save** → the same toast. **Dissolve** B1 → confirm → the same toast. B1 is still listed.
5. As `accountant`, go to `/approve/bill`. B1 is listed. Tick it → **Approved** → _"1 bill(s) approved"_. The row leaves this queue.
6. As `directorA`, go to `/approve/bill`. B1 is listed. Tick it → **Approved** → the row leaves the queue. On `/expenses/bills`, B1 reads **Approved**.
7. As `managerA`, **Remove from bill** on the 300 line → error toast naming the approval. `bills/get` → still `"2300"`.
8. B1 → **Invoicing** → issue for the full balance → success toast. B1's invoiced amount is 2,300 (step 24 hand-off).

**Golden path — Journey 3 (Phase 2; `managerA`, on B1 after step 8)**
1. **Edit bill** → Courier `DHL`, Courier No. `TRK-23-1`, Financial Voucher No. `PV-23-1` → **Save** → _"Bill updated"_. In the network panel, the `bills/update` request body carries exactly those three keys plus `id`. Reload: the values show.
2. **Edit bill** → change Invoice Title → **Save** → approval refusal toast. Reload: the old title.
3. **Edit bill** → change nothing → **Save** → the dialog closes, and no `bills/update` request is sent.

**Edge case 1: unapproved bill cannot be invoiced.** As `managerA`, B2 (Draft) → **Invoicing** → issue → error toast _"\"Input invoice no.\" requires review approval first"_. B2's invoiced amount stays 0.

**Edge case 2: correcting an approved, uninvoiced bill (D2-A).** Submit B3 and approve it at both stages. As `managerA`, **Dissolve** B3 → _"Bill dissolved — its lines are unbilled again"_. Both lines read unbilled. Create a bill from one line → new bill B3′ in **Draft**. **Invoicing** on B3′ → gate refusal.

**Edge case 3: withdrawal releases the freeze.** Submit B2. As `managerA`, open the Review menu → **Request withdrawal**. As `accountant`, approve the withdrawal from the queue (the seeded `requires_reviewer_approval` mode). B2 reads **Withdrawn**. **Remove from bill** on one of its lines → _"Line removed from its bill"_.

**Edge case 4: editable flow honoured (D1-A).** As `owner`, edit the Bill review flow and turn on **Can edit after approval**. On an approved bill, **Remove from bill** → succeeds. Restore the flow afterwards.

**Edge case 5: no ghost (D2-A).** Submit a fresh bill B4. As `managerA`, **Dissolve** B4 → refused. As `accountant`, the Workbench Pending count for bills is 1, and B4 is listed on `/approve/bill`.

**Edge case 6: legacy verbs gone (Phase 3).** In the console, POST `/rpc/bills/review` `{ id: <B2>, to: "approved" }` → 404. B2's badge is unchanged.

**Edge case 7: submit/write serialisation.** Proven only by `expense.bill-review.concurrency.test.ts` on the dev branch (Task 1.5), judged by final state (submission exists, and the later write is refused), not by timestamps.

**Regression checks.**
1. On a Draft bill, **Remove from bill**, **Dissolve** and **Edit bill** all work as today.
2. **Finance Synced** toggles on an approved bill (it bypasses the writer).
3. `/approve/cost`, `/approve/order` and `/approve/quotation` behave as before (only a new gate helper and the `bill` entry changed).
4. `e2e/specs/audit.bill-queue.spec.ts` passes (its flow is editable and ungated).

**Mobile:** at 400px the refusal toasts wrap without horizontal scroll, and the Edit bill dialog's new description wraps inside the dialog.

**Readiness: 7/10.** The defects are verified by symbol at `6bb3a1bf`, and each phase is small and testable at the API boundary. What holds it back (decisions are settled):
- Phase 1 wants step 08 Phases 1–3 on the base (message option, re-submit refusal, `resources.ts` shape), and Phase 3 needs step 15 Phase 2.
- Steps 22, 24 and 26 have no plans yet, and each writes neighbouring code (`bill.exists`, `bills.invoice`, `exchangeRate`).
- Live exposure is unmeasured until 23-P1–P9 are run.
- The lock proof exists only on a dev Neon branch.

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and the Proposed reading of every cross-plan item in `steps-20-26-crosscheck.md` (X28–X40). Each §9 entry keeps all three approaches; only the status, the Chosen line and the text that described a decision as open were changed, plus the task text the crosscheck items below required.

**Chosen:** D1-A · D2-A · D3-A · D4-A · D5-A · D6-A · D7-C · D8-A.

**Crosscheck items as they land in this plan.** None overrides this plan's own recommendation. X33 → 23 P3 merges before 21 P3; Task 3.1 lowers the indirect-write floor at `architecture.test.ts:1273` to the re-counted remainder in the commit that removes `:872`, with a comment (§4.4, Task 3.1, Phase 3 dependencies and acceptance, §7.1, §7.6 new step 21 Task 3.1 row and recommended order, D5 Chosen line); `review-batch.ts` stays until X33's grep-and-lint rule clears it; step 21 skips its `bills.ts:1189` comment. X34 → Task 1.1's exported `underReviewGate(resourceType)` is the shared gate step 21 Task 2.2 imports for the cost-line `delete` verb (§4.1, Task 1.1, §7.6 new step 21 Task 2.2 row). D7-C → Task 3.4 marked not done (§1, Phase 0 Finding G, Phase 3, §6 Agent D, §7.6 step 08 Task 2.1 row, §7.8). X35 → `expense.bill-review.concurrency.test.ts` is this plan's own file and it adds nothing to `expense.concurrency.test.ts`; no text change (24's issue-vs-unbill fixture rule is step 24's). X38 → no migration under any chosen option; no text change. X39 → the §9 "SOP text vs code" rows, including the "request withdrawal before changing a bill" announcement, are an accepted unowned gap; no text change. X40 → the stale "no plan yet" rows for steps 22, 24–27 in §7.6, the D4 and Risks worry that step 26 writes `bill.exchange_rate`, the §7.6 worry that step 22 edits `bill.exists`, and the readiness bullet on steps 22/24/26 are left as written; neither worry holds (the crosscheck is authoritative).
