# Step 08: make an approval mean what the reviewer saw

**SOP step:** 08 "Get it approved" · `/quotations/$quotationId` (Submit for Review) → `/approve/quotation` (Approvals → Quotation review)
**Defects:** step-local **[money]** editable while under review · **[money]** branch manager approves their own quotation · **[data]** legacy `quotations.review` stamps approved with no submission · **[data]** submit-then-retract unlocks a frozen record · **[blocked]** "Export quotation" gate wired to reading, not exporting
**Evidence read at:** HEAD `6bb3a1bf` on `feat/new-layout`, 2026-09-15. The JSON was captured at `6c31a20e`, and the two commits since then are formatter and worktree sweeps. Every `file:line` below was re-read at HEAD.
**Tier:** Standard. It changes auth behaviour in the shared audit engine (who may decide), touches the reviewer queue's SQL filter, and every fix carries money or control risk.
**Addition 2026-09-17 (from `steps-12-15-crosscheck.md` X10, Wilfred accepted the recommendation):** Task 3.3 also drops `isEndpoint: true` on the `QUOTATION.review` and `QUOTATION.feeTemplateReview` permission nodes, in the same commit as the two procedure deletions, so `registry.sync.test.ts` still passes. See Task 3.3 and §9. **No settled decision in §9 changes.**
**Restored 2026-09-17:** this file was found filled with NUL bytes and was restored from `nct-steps-4-10-plans.zip` (the 2026-09-15 15:58 copy) before the addition above was applied. The corrupt file is kept beside it as `step-08-quotation-approval-integrity.md.CORRUPT-NULs-2026-09-17`. Wilfred should confirm nothing else was edited into step 08 between 2026-09-15 and the corruption.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers`, Drizzle schema and migrations in `packages/db`, and TanStack Router file routes under `apps/web/src/routes/_next`. zod and vitest on PGlite. The review engine lives in `packages/api/src/modules/audit/*` (submit / decide / withdraw / gates / post-approval / shared / resources / queue-filter / seed). The web side reaches it only through `apps/web/src/lib/audit-review.ts` (`engineReview`, `engineDecideBatch`).
- **Two review systems exist, and only one matters.** The engine writes one `audit_submission` per attempt. `REVIEWABLE_RESOURCES[x].repaintCache` (`resources.ts:77`) then projects the result onto the record's `audit_status` column, which is a display cache. The gates (`gates.ts:90`) and the post-approval freeze (`post-approval.ts:43`) both read the **latest submission** through one helper, `latestSubmissionByResource` (`shared.ts:332`, ordered `submitted_at desc`).
- **Defect 1 is confirmed exactly as filed.** `quotations.update` (`quotation.ts:3123`) runs a scoped load, then the `decidedAt` freeze (`:3187`), then `assertPostApprovalEditable` (`:3196`), and nothing else. `applyTemplate` (`:3519`) has only `assertPostApprovalEditable` (`:3575`). **`remove` (`:3344`) has the same hole**: it carries only `assertPostApprovalEditable` (`:3361`). That one was not in the JSON. `assertNotUnderReview` is **already imported** into `quotation.ts:38` and already guards the fee-template sibling (`:980`), so the fix needs no new import and no shared change. The stale claim in `gates.ts:120-124` is still there.
- **Defect 2 is confirmed, and one of the two repairs the JSON offers would fail.** `decide()` (`decide.ts:40-91`) checks `permittedNode(org, reviewNode)` (`:50`) and `isStageReviewer` (`:78`), and never compares `submission.submittedBy`. The only ownership test in the engine is `withdraw.ts:48`. The seed routes quotations to `branch-manager` (`seed.ts:69`), and `roles.ts:102-103` grants that role the whole `quotation` subtree: `quotation.update` (the submitNode, `resources.ts:124`) plus `quotation.review` (`:125`). **"Point the stage at director" does not work.** `director` holds only `quotation.read` (`roles.ts:214`), so `decide.ts:50` would answer FORBIDDEN, and `seed.test.ts:277` ("holds the review node its trigger re-checks") would go red. The seed also only runs for a trigger that has no flow yet (`seed.ts:223`), so existing orgs would keep the old stage. And tenants can re-route any stage in the flow editor (`flow-admin.ts:65`). The refusal has to live in the engine.
- **An engine-wide self-decision refusal would break other steps' flows.** Under seed plus `roles.ts`, four resources allow self-decision today: **quotation** (branch-manager), **fee_template** (branch-manager, `seed.ts:140` plus the `quotation` subtree), **cost_line** and **bill stage 1** (accounting holds the `expense` root, `roles.ts:174-175`). The API suite relies on bill and cost-line self-decision in at least 8 places (`audit-review.test.ts:626-629, 718-722, 1034-1036, 1063-1065, 1296-1319, 1331-1375, 1159-1162`). Bill stage 1 is `all_pass_any_reject` (`seed.ts:183`), and `eligibleReviewerCount` (`shared.ts:247`) counts every accountant. Refuse the submitter without also shrinking that count, and a two-accountant org could never pass a bill. This drives decision D1.
- **Defect 3 is confirmed, and the JSON names the wrong holders.** `quotations.review` (`quotation.ts:3845-3882`) writes `audit_status` through `canAuditTransition` and files no submission. The web app cannot reach it: `apps/web/src/architecture.test.ts` ("no legacy per-resource review verb is reached from the web app") bans every spelling. Its node, `quotation.review`, is held by **admin, branch-manager and sales**, all through `quotation` subtree roots (`roles.ts:89, 103, 125`). Director does not hold it. That means any salesperson can stamp their own quotation "approved" over RPC. Deleting the verb also means deleting its entry from the **api** writer allow-list (`packages/api/src/architecture.test.ts:512`). That test asserts equality in both directions (`:1206-1240`), so a stale entry goes red.
- **Defect 4 is confirmed and reachable in the UI.** `submitForReview` (`submit.ts:71-84`) refuses only an open attempt. `retract` (`withdraw.ts:51`) accepts any `under_review` attempt, and the seeded quotation flow is `direct` (`seed.ts:67`), so the latest status becomes `withdrawn` and `post-approval.ts:43` passes forever. The ledger row's `<ReviewMenu>` (`-quotations.columns.tsx:358`) offers **Submit for review** and **Request withdrawal** on every row regardless of status (`review-menu.tsx:49-56`). That makes the three clicks real, not only an RPC path. The record page shows no Submit on `approved` and **no control at all on `withdrawn`** (`$quotationId.tsx:1259-1316`): a retracted quotation cannot be resubmitted from its own page.
- **Defect 5 is confirmed.** The `export` gate call sits in `quotations.retrieve` (`quotation.ts:2355-2361`), which the record page loads (`$quotationId.tsx:585`) and which the decide, send and reference-template dialogs invalidate (`decide-quotation-dialog.tsx:73`, `send-quotation-dialog.tsx:173`, `reference-template-dialog.tsx:370`). `exportSheet` (`:2489`) and `send` (`:2598`) call no gate. The vocabulary is declared in `modules/quotation/gates.ts:8`, and `gates.test.ts:58-88` fails the build for a declared key with no `assertGateCleared` caller. Moving the call keeps two callers.
- **Precedents to follow.** The freeze position ("after the scoped load, before any write") is `feeTemplates.update` (`quotation.ts:973-983`), `contract.update` (`company.ts:1343`) and `lading` (`lading.ts:1474, 1513`). The ownership refusal shape is `withdraw.ts:48`. Data-drift remediation follows step 02: count read-only first, then a reviewed script, with no automated repair in a migration.
- **Nothing else can write `auditStatus` on a quotation.** `quotationHeaderInput` (`quotation.ts:1467`) has no `auditStatus`, so `update` cannot stamp a review. The only non-engine writer is `review`, which Phase 3 deletes.
- **Migration state.** `packages/db/src/migrations/meta/_journal.json` has 65 entries ending `0065_quotation_send_decision` (idx 64). The tag `0058` is absent, and idx is contiguous. Steps 01 and 02 claim `0066` and `0067`. **This plan adds no migration.** `0072` stays reserved for this step and is used only if Wilfred picks D1-C or D5-B.
- **Test fixtures that must keep passing.** `quotation.convert.test.ts:76-104` re-saves an approved quote under a flow with `postApprovalEditable: true` and a raw-inserted `passed` submission. That row is neither under review nor locked, so Phases 1 and 3 leave it alone. `gates.test.ts:177-186` ("a NEWER submission re-freezes") raw-inserts rows and never calls `submitForReview`, so Phase 3 leaves it alone too. `e2e/specs/audit.quotation-queue.spec.ts:38-82` has the owner submit and `managerA` decide, a different person, so Phase 2 leaves it alone.

---

## 1. Overview

**Problem.** Approving a quotation is the control that opens "Convert to order" (step 11). Today that control can be defeated four ways. (1) The salesperson changes the prices after submitting, so the manager signs numbers that no longer exist. (2) The branch manager prices a quote and approves it themselves. (3) Anyone holding `quotation.review` (including every salesperson) stamps "approved" over RPC with no review behind it, and the cache and the gate then disagree for good. (4) Whoever holds `quotation.update` re-submits an approved quote and retracts it, which lifts the post-approval freeze with no reviewer involved. Separately, (5) a tenant who ticks "Export quotation" makes every unapproved quotation impossible to open, while the export and the customer email keep working.

**Ranked by money and control risk** (this order also sets the phase order, with one scheduling exception in §6):

| Rank | Defect | Who can do it | Reach |
|---|---|---|---|
| 1 | Editable while under review | Every role with `quotation.update` (sales, branch-manager, admin) | Every org with the seeded quotation flow enabled (the default) |
| 2 | Self-approval | branch-manager (and anyone a tenant routes a stage to who also edits) | Every seeded org |
| 3 | Submit-then-retract unlock | Every `quotation.update` holder, in three ledger clicks | Every resource whose flow has `postApprovalEditable: false` (all seeded flows) |
| 4 | Legacy `review` stamp | admin, branch-manager, sales, over RPC only | Cache and gate diverge, and convert refuses with no explanation |
| 5 | Export gate on read | Any tenant that ticks the checkbox | Currently no seeded org (the key ships unticked, `seed.ts:71`) |

**Goals and success criteria.**

- Once submitted, a quotation cannot be edited, have a template applied, or be deleted until the submission is retracted or decided. The record page says so before the user tries.
- Whoever submitted an attempt cannot decide it. The row does not appear in their own queue. If nobody else can decide it, the submit itself is refused with a message naming the fix.
- An approved quotation under a locked flow cannot be re-submitted, so it cannot be unlocked by retracting.
- `quotations.review` is gone. The engine is the only writer of a quotation's review cache.
- With "Export quotation" ticked, an unapproved quotation opens and saves normally, and **Export** and **Send** are refused until it is approved.

**In scope.** `quotations.update` / `applyTemplate` / `remove` freeze; header controls on the record page (Save disabled under review, Retract, Resubmit on `withdrawn`); a per-resource segregation-of-duties switch in the engine, on for `quotation`; queue filtering of self-submitted rows; the submit-time refusal on approved-and-locked records; deleting `quotations.review`; a read-only drift report; moving the export gate.

**Out of scope.** The sibling holes this plan finds but does not own, listed in §7 for their steps: `feeTemplates.review` and fee-template self-approval (step 04); `collectiveOrder.update` with no under-review freeze; the bill and cost-line legacy review verbs. Also out: gating **Send** on approval by default (a separate SOP pitfall, step 09); freezing `decide` (won/lost) while under review (step 10); repairing drifted rows automatically (→ D5).

**Assumptions** (each points at §9):

- Segregation of duties is a per-resource switch in the engine registry, turned on for `quotation` only in this step → D1
- A submitter who is the only eligible reviewer is refused at submit, not allowed through → D2
- Re-submitting an approved record under a locked flow is refused, reusing the post-approval guard → D3
- `quotations.review` is deleted, not wrapped → D4
- Existing drift is measured and reported, not auto-repaired → D5
- `remove` joins the under-review freeze, but `send` and `decide` do not → D6
- The export gate moves to both `exportSheet` and `send` → D7
- The page disables Save and offers Retract, and the server remains the guard → D8
- The reviewer's own submissions are hidden from their queue → D9
- Submit and save are serialized with a row lock on the quotation → D10
- Where the JSON and the code disagree, the code wins, and every such conflict is logged → D11

## 2. User Journeys

**Journey 1 (changed): Sales tries to change a quotation that is waiting for review**
Trigger: Sales presses **Submit for Review** on `/quotations/$quotationId`, then notices a wrong price.

Old journey:
1. The badge turns Pending, and **Save Quote** stays enabled.
2. Sales retypes the selling price and presses **Save Quote**. A success toast appears and the stored quotation changes.
3. The branch manager opens it from `/approve/quotation`, may have loaded it before the save, and presses **Approved** on numbers the page no longer holds.

New journey:
1. The badge turns Pending. **Save Quote** and **Reference template** are disabled, and hovering either shows *"Under review. Retract the submission to edit."* A **Retract** button sits next to the badge.
2. Sales presses **Retract**. A *Review updated* toast appears, the badge reads Withdrawn, a **Resubmit** button appears, and Save is enabled again.
3. Sales corrects the price, presses **Save Quote**, then **Resubmit**. The badge reads Pending.
4. If a stale tab or a script calls `quotations.update` while Pending, the server answers 409: *"This record is under review and cannot be edited. Retract the submission first."* The error toast shows that text and nothing is written.
5. Flow ends: what sits in the reviewer's queue is exactly what was submitted.

Where it lives: inline in the existing record header (`data-testid="audit-controls"`).

**Journey 2 (changed): A branch manager prices a quotation and wants it approved**
Trigger: The branch manager creates a quotation and presses **Submit for Review**.

Old journey: opens **Approvals → Quotation review**, sees their own row, ticks it, presses **Approved**. Convert to order unlocks.

New journey:
1. On submit, the engine checks that at least one eligible reviewer other than the submitter exists on the opened stage.
   - If one exists, the badge turns Pending (unchanged).
   - If none does, the submit is refused with 409: *"Nobody but you can approve this quotation. Ask an administrator to add a reviewer under Approval Process Setting."* The badge stays Draft.
2. The branch manager opens **Approvals → Quotation review**. Their own submission is **not listed**, and the workbench pending count excludes it.
3. If they press **Approve** on the record page anyway, the error toast reads *"You submitted this quotation. Another reviewer must decide it."* No decision is written.
4. A second branch manager (or any other reviewer on the stage) sees the row in their queue and presses **Approved**. The toast confirms and **Convert to order** unlocks.
5. Flow ends: every approval has two different people on it.

Where it lives: the existing queue (`/approve/quotation`, `QuotationsPage mode="review"`) and the record header.

**Journey 3 (changed): Someone tries to reopen an approved quotation**
Trigger: A salesperson opens the `/quotations` ledger and uses the row's review menu on an **Approved** quotation.

Old journey: **Submit for review**, then **Request withdrawal** (direct mode, so it is withdrawn at once), then open the record and rewrite prices. The freeze is gone for good.

New journey:
1. The user picks **Submit for review** on the approved row. The toast reads *"Refused: This quotation is approved and locked. Duplicate it to quote again, or ask an administrator to allow edits after approval."* No submission is filed.
2. **Request withdrawal** has nothing to act on and answers *"No open review for this record"* (unchanged).
3. Flow ends: the approved quotation stays frozen and Convert to order stays available. A revised price goes through **Duplicate**, the existing escape hatch.

Where it lives: the existing ledger row menu. The record page already offers no submit on `approved`.

**Journey 4 (changed): A tenant turns on "Export quotation"**
Trigger: An administrator ticks **Export quotation** on the quotation flow in Approval Process Setting.

Old journey: every unapproved quotation answers 409 on open, so the author cannot finish it and the reviewer cannot read it. **Export** and **Send** on an approved-or-not quotation work unchanged.

New journey:
1. The author opens a draft quotation. It loads and saves normally.
2. The author presses **Export** (XLSX or PDF). The error toast reads *"\"Export quotation\" requires review approval first"*, and no file downloads.
3. The author presses **Send** and fills the dialog. The same refusal arrives **before** any email leaves.
4. The reviewer opens the quotation from the queue, reads it and approves it (unchanged).
5. The author presses **Export** and the file downloads. **Send** delivers.
6. Flow ends: the checkbox guards the two ways a price reaches the customer, and nothing else.

Where it lives: the existing record header buttons and the Send dialog.

**Defect 3 (legacy `review` verb) has no user-facing surface.** No page calls it. It closes through §10's API-boundary check and rides with Journey 3 in Phase 3.

## 3. Result (What Changes for the User)

**Before:** A submitted quotation can be rewritten under the reviewer. A branch manager can sign their own. An approved quotation can be unlocked by its author in three clicks, or stamped approved over RPC with nothing behind it. Ticking "Export quotation" locks everyone out of reading quotations while exports carry on.
**After:** Submitted means frozen until retracted or decided. Approved means somebody else signed, and it stays locked. The export checkbox blocks exports and emails.

**Key differences:**
- **Sales:** Save is disabled while Pending, with **Retract** beside the badge and **Resubmit** after retracting.
- **Branch manager:** their own submissions are absent from their queue, and approving one is refused. A branch with only one manager is told to add a reviewer at submit time.
- **Everyone:** Submit for review on an approved, locked quotation is refused with the Duplicate hint.
- **Administrator:** "Export quotation" now blocks Export and Send, not opening.

## 4. Technical Architecture

### 4.1 Freeze while under review (Journey 1 steps 1 and 4; Phase 1)

`packages/api/src/routers/quotation.ts`, same position as `feeTemplates.update:980`:

```ts
// update — after the decidedAt refusal (:3187-3191), before assertPostApprovalEditable (:3196)
await assertNotUnderReview(tx, context.org.organizationId, "quotation", id);

// applyTemplate — beside :3575, after the scoped quotation load
await assertNotUnderReview(context.db, organizationId, "quotation", input.quotationId);

// remove — beside :3361
await assertNotUnderReview(tx, organizationId, "quotation", input.id);
```

**Serializing submit against save (Journey 1 step 4) → D10.** The two can race today: `update`'s read of the latest submission and a concurrent `submitForReview` insert do not conflict, so a save can land after the submit commits. Lock the quotation row on both sides:

- `update`: the scoped load at `quotation.ts:3139-3143` gains `.for("update")`.
- `REVIEWABLE_RESOURCES.quotation.exists` (`resources.ts:126-131`) gains `.for("update")`, so `submitForReview` (`submit.ts:39`) takes the same lock inside its transaction.

Only the quotation entry changes. The other resources keep their current `exists`.

`gates.ts:120-124`: replace "A quotation was already safe, but by its own private route …" with a sentence saying quotations call this guard in `update`, `applyTemplate` and `remove`, like contracts and ladings.

### 4.2 Header controls (Journey 1 steps 1-3; Phase 1)

`apps/web/src/routes/_next/quotations/$quotationId.tsx`:

- `const underReview = loaded?.auditStatus === "pending" || loaded?.auditStatus === "withdraw_pending";`
- **Save Quote** (`:1507-1513`): `disabled={!canSubmit || isPending || underReview}`, with `title` set to the under-review sentence when `underReview`.
- **Reference template** trigger: disabled the same way. The implementer greps the dialog trigger in this file.
- `pending` branch (`:1269`): add **Retract**, which calls `reviewMutation.mutate({ id, to: "withdraw_pending" })`. That routes to `auditReview.retractByResource` (`audit-review.ts:426`). The server's *"Only the submitter may retract"* arrives as the error toast for a reviewer who presses it → D8.
- `rejected` branch (`:1303`): widen the condition to `rejected || withdrawn`, so **Resubmit** shows on a retracted quotation.
- Comment at `:768-773` ("The legacy endpoint stays for the wave-5 cut-over"): reword. Phase 3 deletes that endpoint.

This stays within the web architecture test: the buttons call `engineReview`, never a legacy verb.

### 4.3 Segregation of duties (Journey 2; Phase 2) → D1, D2, D9

**Registry (`modules/audit/resources.ts`).** Add to `ReviewableResource` (`:66-89`):

```ts
/**
 * Refuse a decision by the member who submitted the attempt, and leave that
 * member out of the stage's quorum count. On per resource, not engine-wide:
 * bill stage 1 and cost lines are decided by their own submitters today
 * (seeded accounting holds the expense root), and changing that belongs to
 * those steps. Flip it on here when a resource's owner takes it.
 */
separationOfDuties: boolean;
```

Set `quotation: true`. Set every other entry to `false` explicitly, so the step 04 / bill / cost-line owners see the switch on their own entry.

**Decide (`modules/audit/decide.ts`).** After `entry` is resolved (`:45`) and before the node check (`:50`):

```ts
if (entry.separationOfDuties && submission.submittedBy === org.membership.id) {
  throw new ORPCError("FORBIDDEN", {
    message: "You submitted this record. Another reviewer must decide it.",
  });
}
```

The quorum denominator (`:106`) becomes `eligibleReviewerCount(tx, org.organizationId, targets, entry.separationOfDuties ? submission.submittedBy : undefined)`.

**Withdrawals (`modules/audit/withdraw.ts`).** Apply the same refusal in `decideWithdrawal` (after `:160`) and `decideSeparateFlowWithdrawal` (before `:282`). It is inert for quotations today (direct mode), but otherwise a submitter could approve their own withdrawal once a tenant switches modes.

**Quorum count (`modules/audit/shared.ts:247`).** Add a fourth parameter, `excludeMemberId?: string`. When it is set, AND `member.id <> excludeMemberId` into the existing `where`. The change is additive, and callers that pass three arguments are unchanged.

**Submit (`modules/audit/submit.ts`).** After `openedStageNo` is known and not null (`:122`), when `entry.separationOfDuties`:
1. Load that stage instance's targets with `stageInstanceTargets`.
2. Count `eligibleReviewerCount(..., org.membership.id)`.
3. If the count is 0, throw CONFLICT with the Journey 2 step 1 message. The throw rolls back the whole transaction, so no orphan submission remains.

**Queues.**
- `modules/audit/queue-filter.ts:41` `awaitingMyReview`: when `REVIEWABLE_RESOURCES[resourceType].separationOfDuties`, append `and s.submitted_by <> ${org.membership.id}` beside `:59`. Its caller is the quotation ledger in review mode (`quotation.ts` imports it at `:41`), so no caller changes.
- `routers/audit-review.ts:143` `eligibleOpenSubmissions`: drop submissions where the flag is on and `submittedBy === org.membership.id` before building `signals`. `pendingSummary` and `listPending` both come through here (`:309`), so the count and the rows stay in agreement.

**Seed comment (`seed.ts:66`).** Add one line: the branch manager may both edit and sign, and the engine's `separationOfDuties` is what keeps them from signing their own. The stage itself does not change (see Phase 0 on why `director` fails).

### 4.4 Approved stays approved (Journey 3; Phase 3) → D3, D4, D5

**Submit refuses a locked, approved record (`submit.ts`).** After `exists` (`:39`):

```ts
await assertPostApprovalEditable(tx, org.organizationId, input.resourceType, input.resourceId, {
  message:
    "This record is approved and locked. Duplicate it to change it, or ask an administrator to allow edits after approval.",
});
```

**`post-approval.ts`.** Add an optional fifth argument, `options?: { message?: string }`, used at `:51`. The change is additive. The existing callers (`governed/gates.ts:19`, `cost-lines.ts:141`, `collective-order.ts:2800, 2892, 4756`, `lading.ts:1554`, `quotation.ts:983, 3196, 3361, 3575`) are unchanged.

This rule is **engine-wide on purpose**. Any resource whose flow has `postApprovalEditable: false` could otherwise be unlocked the same way, and the JSON already names collective orders. A flow set to editable passes the guard, so re-review after an allowed edit (the fee-template "reopened" path, `quotation.ts:1073-1078`) keeps working.

**Delete the legacy verb.**
- Remove `quotationsRouter.review` (`quotation.ts:3844-3882`, comment included).
- Keep the `canAuditTransition` import (`:96`), because `feeTemplates.review` (`:1334`) still uses it.
- Remove `"routers/quotation.ts :: quotationsRouter.review :: update(quotation)"` from `packages/api/src/architecture.test.ts:512`.
- The node `quotation.review` stays, because `resources.ts:125` still re-checks it at decide time.

**Drift report (read-only) → D5.** New file `packages/db/scripts/audit-quotation-review-drift-2026-09.sql` [NEW], counts only:

```sql
-- (a) cache says approved, latest submission is not passed (legacy review stamps)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission
  where resource_type = 'quotation'
  order by resource_id, submitted_at desc, created_at desc
)
select q.organization_id, count(*) as cache_approved_without_pass
from quotation q
left join latest l on l.resource_id = q.id
where q.audit_status = 'approved' and coalesce(l.status, 'none') <> 'passed'
group by q.organization_id;

-- (b) any resource: a passed attempt later superseded by an attempt that was
--     not passed, under a flow that forbids post-approval edits (the unlock)
select s.resource_type, count(distinct s.resource_id) as unlocked_after_approval
from audit_submission s
join audit_flow f on f.id = s.flow_id and f.post_approval_editable = false
where s.status = 'passed'
  and exists (
    select 1 from audit_submission n
    where n.organization_id = s.organization_id
      and n.resource_type = s.resource_type
      and n.resource_id = s.resource_id
      and n.submitted_at > s.submitted_at
      and n.status in ('withdrawn', 'rejected')
  )
group by s.resource_type;
```

Row lists for review follow the same shape, selecting ids in place of counts.

### 4.5 Export gate on the egress verbs (Journey 4; Phase 4) → D7

In `quotation.ts`:
- **`retrieve`**: delete the `assertGateCleared(..., "export")` block and its comment (`:2353-2361`).
- **`exportSheet`**: after the scoped load's `NOT_FOUND` (`:2504`), add `await assertGateCleared(context.db, context.org.organizationId, "quotation", input.id, "export");`. It sits before `renderQuotationDocument`, so a refusal costs no render and writes no `quotation.exportSheet` audit row.
- **`send`**: the same call after the scoped load's `NOT_FOUND` and before REFUSAL 3. That places it in the "everything that can fail happens before the send" block the docblock describes (`:2566-2573`).

The web side needs no change beyond confirming the refusal reaches a toast. `$quotationId.tsx:845` calls `client.quotations.exportSheet` directly, and `send-quotation-dialog.tsx` has its own mutation. Task 4.2 verifies both.

**Key decisions.**
- Freeze by calling the existing guard, not a new mechanism → D6
- Per-resource segregation switch, not engine-wide and not a DB column → D1
- Refuse at submit when nobody else can decide → D2
- Re-submission refusal reuses `assertPostApprovalEditable` → D3
- Delete `quotations.review` → D4
- Report drift before repairing it → D5
- Gate `exportSheet` and `send`, not `retrieve` → D7
- Server is the guard, UI is the explanation → D8
- Hide self-submitted rows in the reviewer queue → D9
- Row lock on submit and save → D10

## 5. Phased Implementation

### Phase 1: What the reviewer reads is what they sign

**Delivers:** Journey 1 end to end.
**Dependencies:** none. No pending migrations; the journal is contiguous at `0065`.

- **Task 1.1.** Add `assertNotUnderReview` to `quotations.update` (between `:3191` and `:3196`), `applyTemplate` (beside `:3575`) and `remove` (beside `:3361`), exactly as in §4.1. Order inside `update`: `decidedAt` → under review → post-approval.
  Files: `packages/api/src/routers/quotation.ts` · Owner: **Agent A (backend)**
- **Task 1.2.** Serialize submit against save: `.for("update")` on `update`'s scoped load (`quotation.ts:3139-3143`), and on `REVIEWABLE_RESOURCES.quotation.exists` (`resources.ts:126-131`).
  Files: `packages/api/src/routers/quotation.ts`, `packages/api/src/modules/audit/resources.ts` · Owner: **Agent A (backend)**
- **Task 1.3.** Correct the stale claim in `gates.ts:120-124` (§4.1).
  Files: `packages/api/src/modules/audit/gates.ts` · Owner: **Agent A (backend)**
- **Task 1.4.** New suite, seeded the way `quotation.convert.test.ts:76-104` seeds a flow and submissions. Cases:
  1. `under_review` → `update` 409, `applyTemplate` 409, `remove` 409, and nothing is written (re-read the fee lines).
  2. `withdrawal_under_review` → 409.
  3. `rejected` → `update` succeeds.
  4. `withdrawn` → succeeds.
  5. Never submitted → succeeds.
  6. Foreign-scope id → `NOT_FOUND` before `CONFLICT`.
  7. `passed` with an editable flow → succeeds (the convert suite's scenario).

  Files: `packages/api/src/routers/quotation.under-review.test.ts` [NEW] · Owner: **Agent A (backend)**
- **Task 1.5.** Header controls as in §4.2: Save and Reference template disabled with a title while under review; **Retract** on `pending`; **Resubmit** on `rejected || withdrawn`; reword the comment at `:768-773`.
  Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx` · Owner: **Agent B (frontend)**

**Acceptance.**
- A salesperson can submit, see Save disabled, retract, edit, save and resubmit, entirely from the record page (§10 Journey 1).
- A direct `quotations.update` call on a Pending quotation returns 409 and changes nothing.
- The new suite passes, and `quotation.convert.test.ts`, `quotation.rate-card.test.ts` and `quotation.send-decide.test.ts` pass unchanged.

### Phase 2: Someone else signs

**Delivers:** Journey 2 end to end.
**Dependencies:** Phase 1 merged, because `resources.ts` hands off from Agent A. **Blocked on D1 and D2.**

- **Task 2.1.** Add `separationOfDuties` to `ReviewableResource`: `true` on `quotation`, `false` written explicitly on the other nine entries.
  Files: `packages/api/src/modules/audit/resources.ts` · Owner: **Agent C (backend)**
- **Task 2.2.** Add `excludeMemberId` to `eligibleReviewerCount`.
  Files: `packages/api/src/modules/audit/shared.ts` · Owner: **Agent C (backend)**
- **Task 2.3.** Add the self-decision refusal and the denominator exclusion to `decide`, `decideWithdrawal` and `decideSeparateFlowWithdrawal` (§4.3).
  Files: `packages/api/src/modules/audit/decide.ts`, `packages/api/src/modules/audit/withdraw.ts` · Owner: **Agent C (backend)**
- **Task 2.4.** Add the submit-time "nobody else can decide" refusal.
  Files: `packages/api/src/modules/audit/submit.ts` · Owner: **Agent C (backend)**
- **Task 2.5.** Filter self-submitted rows out of the queues: `awaitingMyReview`, and `eligibleOpenSubmissions`, which feeds `pendingSummary` and `listPending`.
  Files: `packages/api/src/modules/audit/queue-filter.ts`, `packages/api/src/routers/audit-review.ts` · Owner: **Agent C (backend)**
- **Task 2.6.** Add the seed comment at the quotation flow. The stage does not change.
  Files: `packages/api/src/modules/audit/seed.ts` · Owner: **Agent C (backend)**
- **Task 2.7.** New `describe("segregation of duties")` in the engine suite:
  - **Fixture:** add a second branch manager, `m-bm2` / `u-bm2`, to the org-a members beside `:192`.
  - `u-bm` submits a quotation; `u-bm` deciding it → FORBIDDEN with no `audit_decision` row; `u-bm2` approves → `passed`.
  - `u-bm`'s `pendingSummary` does not count it, while `u-bm2`'s does.
  - Submit refused: a flow whose only stage names `m-bm` by member id, and `u-bm` submits → CONFLICT with no submission row.
  - **Regression:** the existing bill and cost-line self-decision tests (`:626-629`, `:1159-1162` and the others listed in Phase 0) pass **unchanged**, because the flag is off there.
  - Re-run the existing `pendingSummary` assertions (`:1395-1430`), which use `≥ 1` and should survive the extra member.

  Files: `packages/api/src/routers/audit-review.test.ts` · Owner: **Agent C (backend)**

**Acceptance.**
- A branch manager cannot approve their own quotation and does not see it in their queue. A second branch manager approves it, and Convert to order unlocks (§10 Journey 2).
- A single-reviewer branch gets the submit-time message.
- `seed.test.ts` and the full `audit-review.test.ts` pass.

### Phase 3: Approved stays approved

**Delivers:** Journey 3 end to end, and closes defect 3 at the API boundary.
**Dependencies:** Phases 1 and 2 merged (`submit.ts` hands off from C, and `quotation.ts` from A). **Blocked on D3.** D4 and D5 are recommended and non-blocking.

- **Task 3.1.** Add the optional message argument to `assertPostApprovalEditable`.
  Files: `packages/api/src/modules/audit/post-approval.ts` · Owner: **Agent D (backend)**
- **Task 3.2.** In `submitForReview`, call the guard after `exists` with the locked-record message (§4.4).
  Files: `packages/api/src/modules/audit/submit.ts` · Owner: **Agent D (backend)**
- **Task 3.3.** Delete `quotationsRouter.review` **and the legacy `feeTemplates.review` (X3)**, together with their allow-list entries. Confirm with a grep that nothing else references `quotationsRouter.review` or `quotations/review` in `packages`, `apps` or `e2e`. The Phase 0 grep found only the allow-list line.

  **Addition 2026-09-17 (from `steps-12-15-crosscheck.md` X10, Wilfred accepted the recommendation).** Deleting those two procedures removes the only endpoint gating on each of two permission nodes, so `registry.sync.test.ts` fails without a registry change. Its second test — "every registry node marked isEndpoint gates a real endpoint" (`packages/api/src/permissions/registry.sync.test.ts:22`) — collects every `isEndpoint: true` key and asserts that an endpoint gates it. **In the same commit as the deletions, drop `isEndpoint: true` from both nodes** in `packages/api/src/modules/quotation/permissions.ts`, locating them by symbol, not by line:
  - `[QUOTATION.review]` (at HEAD `6bb3a1bf`, `:56-60`), whose only `requireNode` is the procedure being deleted (`quotation.ts:3846`);
  - `[QUOTATION.feeTemplateReview]` (`:98-102`), whose only `requireNode` is the legacy fee-template review procedure (`quotation.ts:1322`).

  Keep every other field on both nodes, including `parent` and `label`. Both keys stay registered and stay granted: the audit engine still reads them as `reviewNode` (`modules/audit/resources.ts:125` and `:164`) and re-checks them at decide time (`modules/audit/decide.ts:50`). Give each one a comment saying exactly that, in the wording step 15 D9-A uses, so the next reader does not take the dropped flag for a lost permission. This mirrors step 15 D9-A, which resolves the identical problem for `COLLECTIVE_ORDER.review`; step 08 sets the precedent because it merges first. **Proof:** `bunx vp test run packages/api/src/permissions/registry.sync.test.ts` passes, and it fails on this task's code with the flags left on.

  Files: `packages/api/src/routers/quotation.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/modules/quotation/permissions.ts` (addition 2026-09-17) · Owner: **Agent D (backend)**
- **Task 3.4.** Engine suite additions:
  - Approve a quotation, then submit again → CONFLICT with the locked message and no new row.
  - Set the flow's `postApprovalEditable` to true → re-submission allowed.
  - Retract that new attempt → `assertPostApprovalEditable` now passes, and that is correct, because the flow allows edits.
  - Run the bill resubmit-after-reject tests (`:695-714`) unchanged.

  Files: `packages/api/src/routers/audit-review.test.ts` · Owner: **Agent D (backend)**
- **Task 3.5.** Write the drift report (§4.4). Run it read-only against the **dev** branch and record the counts in the PR. The production count needs the owner's `I_KNOW_THIS_IS_PRODUCTION=1` (step 02 precedent, `apps/server/dev-db-guard.ts`).
  Files: `packages/db/scripts/audit-quotation-review-drift-2026-09.sql` [NEW] · Owner: **Agent D (backend)**

**Acceptance.**
- On an approved quotation, the ledger menu's **Submit for review** is refused with the locked message, and the quotation stays approved and frozen (§10 Journey 3).
- Calling `quotations/review` over RPC returns 404.
- Both architecture tests pass. The counts from the drift report are in the PR.

### Phase 4: The export checkbox guards exports

**Delivers:** Journey 4 end to end.
**Dependencies:** Phase 1 merged (`quotation.ts` and `$quotationId.tsx` hand off). Independent of Phases 2 and 3, so it may run in parallel with Phase 2.

- **Task 4.1.** Move the gate from `retrieve` to `exportSheet` and `send` (§4.5).
  Files: `packages/api/src/routers/quotation.ts` · Owner: **Agent E (backend)**
- **Task 4.2.** Confirm the refusal reaches the user. The `exportSheet` handler around `$quotationId.tsx:845` and the Send dialog's mutation must toast `error.message`. If either swallows the error, add `toast.error(error.message)`.
  Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx`, `apps/web/src/components/quotation/send-quotation-dialog.tsx` · Owner: **Agent F (frontend)**
- **Task 4.3.** Tests, with a flow ticking `export` and a quotation with no passed submission:
  - `retrieve` succeeds.
  - `exportSheet` → CONFLICT, with no `quotation.exportSheet` audit row.
  - `send` → CONFLICT, and the mail port or `composeThread` fake is **never called** (reuse the suite's existing send fake).
  - Add a passed submission → both succeed.
  - `gates.test.ts` passes as is. Its caller scan (`:58-88`) still finds `export`, and `:191` stays green.

  Files: `packages/api/src/routers/quotation.send-decide.test.ts` · Owner: **Agent E (backend)**

**Acceptance.**
- With Export quotation ticked, the author opens and saves a draft. Export and Send are refused with the gate message until the quotation is approved, then both work (§10 Journey 4).
- No email leaves on a refusal.

## 6. Delegation & Parallelization Plan

**Phase 1: What the reviewer reads is what they sign**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.4 | `packages/api/src/routers/quotation.ts`, `packages/api/src/modules/audit/resources.ts`, `packages/api/src/modules/audit/gates.ts`, `packages/api/src/routers/quotation.under-review.test.ts` [NEW] | `packages/api/src/routers/quotation.convert.test.ts`, `packages/api/src/modules/audit/shared.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.5 | `apps/web/src/routes/_next/quotations/$quotationId.tsx` | `apps/web/src/lib/audit-review.ts`, `apps/web/src/components/review-menu.tsx` |

opus: the row lock and the guard order sit on a money write path in a file five other steps also edit.
Run mode: **A ∥ B**, with disjoint files. B needs no new API shape (the existing 409 is enough).

**Phase 2: Someone else signs**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | opus | xhigh | 2.1–2.7 | `packages/api/src/modules/audit/resources.ts`, `…/shared.ts`, `…/decide.ts`, `…/withdraw.ts`, `…/submit.ts`, `…/queue-filter.ts`, `…/seed.ts`, `packages/api/src/routers/audit-review.ts`, `packages/api/src/routers/audit-review.test.ts` | `packages/api/src/roles.ts`, `packages/api/src/modules/audit/seed.test.ts` |

opus / xhigh: it changes who may decide in the shared engine, including the quorum denominator and the queue SQL, and a mistake strands or opens every review queue.
Run mode: single agent. The tasks share every file.
Ownership handoff: `resources.ts`: Agent A (Phase 1) → Agent C (Phase 2).

**Phase 3: Approved stays approved**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent D (backend) | backend-engineer | opus | high | 3.1–3.5 | `packages/api/src/modules/audit/post-approval.ts`, `…/submit.ts`, `packages/api/src/routers/quotation.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/routers/audit-review.test.ts`, `packages/db/scripts/audit-quotation-review-drift-2026-09.sql` [NEW] | `packages/api/src/modules/governed/gates.ts`, `packages/api/src/routers/collective-order.ts` |

opus: an engine-wide refusal on submit across every reviewed resource, plus deleting a live procedure from a guarded allow-list.
Ownership handoffs:
- `submit.ts`, `audit-review.test.ts`: Agent C (Phase 2) → Agent D (Phase 3)
- `quotation.ts`: Agent E (Phase 4) → Agent D (Phase 3)

**Phase 4: The export checkbox guards exports**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent E (backend) | backend-engineer | sonnet | medium | 4.1, 4.3 | `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/quotation.send-decide.test.ts` | `packages/api/src/modules/audit/gates.test.ts` |
| Agent F (frontend) | frontend-engineer | sonnet | low | 4.2 | `apps/web/src/routes/_next/quotations/$quotationId.tsx`, `apps/web/src/components/quotation/send-quotation-dialog.tsx` | none |

Run mode: **E ∥ F**.
Ownership handoffs:
- `quotation.ts`: Agent A (Phase 1) → Agent E (Phase 4)
- `$quotationId.tsx`: Agent B (Phase 1) → Agent F (Phase 4)

**Schedule across phases:** **Phase 1 → (Phase 2 ∥ Phase 4) → Phase 3.** Phases 2 and 4 have disjoint files (engine and audit router versus quotation router and web). Phase 3 needs both `submit.ts` (from 2) and `quotation.ts` (from 4).

**Serialization points.** Each point needs every agent in its group finished first.
1. After each group: `bun run check-types`. Grep the output for `error TS` and `failed`, and confirm `apps/web` actually ran (see memory `vp-run-exit-code-lies`). Then `bunx vp test run packages/api/src/architecture.test.ts` and `apps/web/src/architecture.test.ts`.
2. After Phase 2: `bunx vp test run packages/api/src/routers/audit-review.test.ts packages/api/src/modules/audit`, and confirm the `Test Files` summary line is present.
3. Before any browser check: restart the `:3000` server, because `bun --hot` does not reload `packages/api`.

**Commits.** The worktree is shared with other live sessions: one committer at a time, check the index is empty before `git add`, and read every hunk.

**Smell test.**
- [x] Every task has one owner.
- [x] No file is owned twice within a phase.
- [x] Parallel groups (A∥B, E∥F, Phase 2∥Phase 4) are disjoint.
- [x] Every opus assignment is justified, and no haiku is used.
- [x] Sequential dependencies name their artifact (`resources.ts`, `submit.ts`, `quotation.ts`, `audit-review.test.ts`).
- [x] Every phase completes a journey (Phase 3 completes Journey 3 and closes defect 3 at the API boundary).

## 7. Impact & Breakage Analysis

### 7.1 Blast radius per fix: does it change fee templates (step 04), orders, bills?

| Fix | Where the change lives | Quotation | Fee templates (step 04) | Collective orders | Bills / cost lines | Others |
|---|---|---|---|---|---|---|
| 1 Under-review freeze | `quotation.ts` handlers only; `resources.ts` quotation `exists` lock | Changed | **No change.** Already guarded (`quotation.ts:980`) | **No change, same hole remains.** `collective-order.ts` has no `assertNotUnderReview` (only `assertPostApprovalEditable` at `:2800, 2892, 4756`). Flag to the orders step. | **No change.** `bills.ts:510` gates on `postApprovalGate("bill")`, and `cost-lines.ts` has its own `reviewLockGate` (`:368`). Whether either covers `under_review` was not verified; flag to their steps. | Lading and contract already guarded |
| 2 Self-decision | Shared engine: `decide.ts`, `withdraw.ts`, `submit.ts`, `shared.ts`, `queue-filter.ts`, `resources.ts`, `routers/audit-review.ts` | Changed (flag on) | **Mechanism shared, behaviour unchanged.** The flag is off. The same hole exists (`seed.ts:140` + `roles.ts:102-103`), and step 04 can close it by setting `fee_template.separationOfDuties = true`. | Unchanged (accounting cannot submit; ops are not targeted) | **Unchanged under D1-B.** Under D1-A, bill stage 1 becomes submitter-excluded, and 8+ tests plus the two-accountant quorum change. | Lading, company and contract are director-signed and cannot self-approve under seed |
| 3 Delete `quotations.review` | `quotation.ts`, `packages/api/src/architecture.test.ts:512` | Changed | **No.** `feeTemplates.review` (`quotation.ts:1321`) is the same defect, for step 04 | **No.** `collectiveOrder.review` (allow-list `architecture.test.ts:495`, handler near `collective-order.ts:3410`) is the same class | **No.** Governed `auditTransitionGate` verbs (`bills.ts:588`, `cost-lines.ts:368`, `review-batch.ts:105`) are the same class | none |
| 4 Refuse re-submit of a locked approval | Shared: `submit.ts`, `post-approval.ts` (additive arg) | Changed | **Changed.** An approved template under a non-editable flow can no longer be re-submitted. The "reopened" re-review path (`quotation.ts:1073-1078`) only runs when the flow is editable, so it is unaffected. | **Changed.** This closes the unlock the JSON names | **Changed.** An approved bill or cost line under the seeded flows cannot be re-submitted | All reviewed resources (all seeded flows are `postApprovalEditable: false`, `seed.ts:232`) |
| 5 Export gate | `quotation.ts` only | Changed only for tenants that tick `export` | No | No | No | No |

### 7.2 Callers traced (grep, this session)

- **`assertNotUnderReview`**
  - Existing callers: `company.ts:1343`, `lading.ts:1474, 1513`, `quotation.ts:980`.
  - Phase 1 adds three calls. The signature is unchanged.
- **`assertPostApprovalEditable`**
  - Callers: `governed/gates.ts:19`, `expense/cost-lines.ts:141`, `collective-order.ts:2800, 2892, 4756`, `lading.ts:1554`, `quotation.ts:983, 3196, 3361, 3575`.
  - The new fifth argument is optional, so every caller compiles unchanged.
- **`eligibleReviewerCount`**
  - Callers: `decide.ts:106`, `withdraw.ts:305`.
  - The new fourth argument is optional.
- **`awaitingMyReview`**
  - Callers: the ledger review-mode lists that import it, including `quotation.ts:41`.
  - The signature is unchanged. The added predicate applies only when the resource's flag is on.
- **`eligibleOpenSubmissions`**
  - Consumers: `pendingSummary`, `listPending` and `listQueue` in `audit-review.ts`.
  - The return shape is unchanged. Rows are filtered out, and no fields are removed.
- **`quotations.review`**
  - No web or e2e caller (the web architecture test enforces this).
  - Only the api allow-list line references it.
  - **External RPC scripts calling it would 404.** None were found in the repo.
- **`quotations.retrieve`**
  - Callers: `$quotationId.tsx:585`, and invalidations at `:728, 783, 801, 830`, `decide-quotation-dialog.tsx:73`, `send-quotation-dialog.tsx:173`, `reference-template-dialog.tsx:370`.
  - For tenants with `export` ticked, all of them stop receiving 409. Nobody else sees a difference.
- **`ReviewableResource` type**
  - Adding a required `separationOfDuties` breaks compilation of any literal entry that lacks it. All ten entries are in `resources.ts`, so no other file constructs one (confirmed by the `REVIEWABLE_RESOURCES` grep).

### 7.3 Flows before and after

- **Submit → edit.** Before: `auditReview.submit` 200, then `quotations.update` 200. After: `quotations.update` 409.
  - Out-of-sync deploy: web Phase 1 without the API only disables a button, which is harmless. The API without the web change shows a 409 toast on Save, which is correct but unexplained.
  - Either order is safe.
- **Self-approve.** Before: `decideByResource` 200. After: FORBIDDEN, and the row is absent from `listQueue` and `pendingSummary`.
  - Single package, no web change. It deploys as one.
- **Approve → resubmit → retract.** Before: 200, 200, then the freeze is lifted. After: `submit` 409, and retract has nothing to act on.
- **Export with gate ticked.** Before: `retrieve` 409, `exportSheet` 200, `send` 200. After: `retrieve` 200, `exportSheet` 409, `send` 409.

### 7.4 Nullable assumptions

- `audit_submission.submitted_by` is written on every insert (`submit.ts:102`). Legacy rows predating the engine have no submission at all, so the self-decision check never sees a null `submittedBy` on a row it can decide.
- `quotation.audit_status` can be `approved` with no submission (defect 3's residue). After Phase 3, such a row still shows Approved while `convert_order` refuses. The drift report counts them (D5).

### 7.5 Deployment coupling

- All four phases deploy independently. Phases 2 and 3 each live entirely in `packages/api`.
- **Build `apps/web` before deploy.** A failed deploy leaves the server on new code and the web on old (see memory `alchemy-partial-deploy-splits-the-stage`). No phase here breaks under that split.

### 7.6 Blocking prerequisites

- **D1 and D2** block Phase 2.
- **D3** blocks Phase 3.
- Phase 1 and Phase 4 have none.
- The production drift count (D5) does not block code. It sizes a follow-up.

### 7.7 Shared files other steps also touch

This plan's owners must rebase onto their commits, not stash them.

- **`packages/api/src/routers/quotation.ts`.** Steps 04 (`feeTemplatesRouter` lives here), 05-07 (`create` / `update` / tariff), 09 (`send`), 10 (`decide`) and 11 (`convertToOrder`).
- **`packages/api/src/modules/audit/gates.ts`, `post-approval.ts`, `submit.ts`, `decide.ts`, `withdraw.ts`, `shared.ts`, `resources.ts`, `queue-filter.ts`.** Step 04 (fee-template review) and the order, cost and bill steps.
- **`packages/api/src/routers/audit-review.ts` and `audit-review.test.ts`** (the audit router). Every step that reviews anything.
- **`packages/api/src/modules/audit/seed.ts`** (the seeded flows). Step 04's fee_template stage, and the order, cost and bill steps.
- **`packages/api/src/architecture.test.ts`** writer allow-list. Step 04 if it deletes `feeTemplates.review`.
- **`apps/web/src/routes/_next/quotations/$quotationId.tsx`.** Steps 05-07, 09, 10 and 11.

## 8. Cross-Cutting Concerns

- **Errors.** Every refusal is an `ORPCError`:
  - CONFLICT for state: under review, nobody else can decide, locked approval, gate.
  - FORBIDDEN for identity: self-decision.
  - Each message says what to do next (retract, add a reviewer, duplicate).
  - A foreign id answers `NOT_FOUND` first. Every guard sits after the scoped load, per the house rule in `gates.ts:59-62`.
- **Testing.** PGlite router suites at the API boundary (Tasks 1.4, 2.7, 3.4 and 4.3), both architecture tests, and `seed.test.ts`. Browser proof comes from §10, with seeded actors and assertions made on the DOM and `/rpc` responses, not on screenshots.
- **Migration.** None. `0072` stays reserved and unused unless D1-C or D5-B is chosen.
- **Rollback.** Each phase is a plain revert.
  - Phase 3's deletion reverts cleanly because no data depends on the verb.
  - None of the fixes write data. The Phase 3 script is read-only.

**Performance & Scalability**

1. **Pagination.** Unchanged. The queue filter adds a predicate inside the existing correlated `exists`, and `listQueue` / `listPending` keep their bounds.
2. **SQL-side filtering.**
   - The self-row exclusion in `awaitingMyReview` is SQL.
   - `eligibleOpenSubmissions` already filters in JS over the org's open submissions (`audit-review.ts:176-183`). The added `submittedBy` comparison follows that existing shape over the same rows, which are bounded by "open submissions in one org".
3. **N+1.**
   - Phase 1 adds one `latestSubmissionByResource` read per `update`, `applyTemplate` and `remove`, beside the identical read `assertPostApprovalEditable` already makes. That is two small queries, not a loop.
   - `decideByResource` already loops per id (max 200) and calls `decide`. The added check is an in-memory comparison on the row it already loaded.
   - The submit-time count is one query per submit.
4. **Index coverage.** The added reads use the same `audit_submission (organization_id, resource_type, resource_id)` access path the existing freeze already uses on every save. Its index name was not re-verified in this pass; the query shape is unchanged. The `submitted_by <> me` predicate filters rows already narrowed by org, resource and id, so no new index is needed.
5. **Write atomicity.**
   - Every guard runs inside its handler's transaction, except `applyTemplate`, whose existing guards run on `context.db` before its write transaction. That pre-existing gap is narrowed by Task 1.2's lock on `update` only. The same race for `applyTemplate` is logged as a risk.
   - The submit-time refusal throws inside `submitForReview`'s transaction, so no submission row survives it.
6. **Row locking.**
   - `decide` already locks the submission (`shared.ts:45`).
   - Task 1.2 adds `FOR UPDATE` on the quotation row in `update` and in `quotation.exists`, so submit and save serialize. The lock is held for one save, which is short.
7. **Resources.** No new connections or external calls. `send` refuses before its provider call.
8. **Tenant isolation.**
   - Every added read is scoped by `organization_id`: `latestSubmissionByResource` at `shared.ts:349`, `eligibleReviewerCount` at `:262`, and `awaitingMyReview` at `:56`.
   - The drift script groups by `organization_id` and joins submissions on org.
9. **Payload size.** Unchanged.
10. **Hot path.** `quotations.update` runs on every save, and it gains one indexed read and one row lock. `retrieve` (every page load) **loses** a flow and gate lookup. `pendingSummary` (workbench) is unchanged in query count.

## 9. Decision Register, Open Questions & Risks

Every open decision below was settled on 2026-09-15 with the recommended option. Assumed decisions are marked as such.

### Settled 2026-09-15 — was blocking

**D1: Where does "you cannot decide what you submitted" live?** · Status: **Settled — B chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Engine-wide in `decide()` for every resource, with the submitter excluded from every quorum count | Closes the hole everywhere at once, including bill stage 1, cost lines and fee templates. It changes three other steps' behaviour, rewrites 8+ existing tests, and needs those steps' owners to agree. |
| **B** | A per-resource `separationOfDuties` switch in `REVIEWABLE_RESOURCES`, on for `quotation` now | Closes step 08 with no change to bills, cost lines or templates. The mechanism is shared, and each step flips its own resource in one line. Other resources stay open until their steps act. |
| **C** | A per-flow `allow_self_decision` column (migration `0072`) editable in Approval Process Setting | Lets a tenant choose, which suits a one-manager branch. It adds a migration, a flow-editor field, and a default that some tenant will untick. |

- **Recommendation: B.** The seed and `roles.ts` show that accounting deciding its own bills and cost lines is today's working arrangement and is pinned by tests. Step 08 should not rewrite another step's money control, but it should build the switch those steps can use.
- **Chosen:** B (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Tasks 2.1–2.7.
- **Where it lands:** §4.3; Phase 2.

**D2: What happens when the submitter is the only person who could decide?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Refuse the submit with a message naming the fix (add a reviewer under Approval Process Setting) | Loud at the moment of action, with no stranded row in anyone's queue. A one-manager branch cannot get a quotation approved until an admin adds a second reviewer or names a person on the stage. |
| **B** | Allow the self-decision as a fallback, stamped `selfDecided: true` in the `audit.decide` trail | Nobody is ever blocked. The control is back to "one pair of eyes" in exactly the branches most likely to need two. |
| **C** | Escalate automatically to the org owner when no other reviewer exists | Nobody is blocked and a second person still signs. It invents routing the engine does not have (the owner is not a stage target), and owners become everyone's backstop without being asked. |

- **Recommendation: A.** The convert gate exists to require a second signature, and a submit-time refusal is the only option that keeps it while telling the user exactly what to change.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Task 2.4.
- **Where it lands:** §4.3 Submit; Journey 2 step 1.

**D3: How is an approved, locked record kept locked?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | `submitForReview` refuses when `assertPostApprovalEditable` would refuse, reusing the guard with a submit message | One call in one shared file, and the unlock sequence cannot start. It applies to every resource with a locked flow, orders included. Re-review of an unchanged approved record becomes impossible, which is consistent, since it cannot have changed. |
| **B** | Re-key the freeze on "any `passed` submission not superseded by a later `passed` one" | The freeze survives any later withdrawn or rejected attempt. The gates still read the latest attempt, so the freeze and `convert_order` disagree after a retract, and a re-submission now opens an attempt on content nobody can edit. |
| **C** | Leave submit open; make `retract` of an attempt on a previously approved record restore the `approved` cache and outcome | Keeps re-submission possible. It rewrites a terminal attempt's meaning, gives the withdrawal code a second job, and still leaves the record editable while the new attempt is open under Phase 1's rules. |

- **Recommendation: A.** It reuses the exact reader the freeze and the gates share (`latestSubmissionByResource`), so no two rules can disagree about which attempt is current. The escape hatches (Duplicate, or an admin allowing post-approval edits) already exist.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Tasks 3.1–3.2.
- **Where it lands:** §4.4; Phase 3; §7.1 row 4.

### Settled 2026-09-15 — was non-blocking

**D4: What happens to `quotations.review`?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Delete it and its allow-list entry | The cache has one writer. Any unknown external RPC caller gets 404. |
| **B** | Re-implement it as a thin wrapper over `submitForReview` / `decide` | Keeps the RPC name alive for unknown callers. It carries a second entry point to the engine that every future guard must remember, and `to: "draft"` has no engine meaning. |
| **C** | Keep it, but refuse every call with "Use Approvals" | A clear message for stray callers. It leaves a dead procedure, its node usage and its allow-list line in place. |

- **Recommendation: A.** The web architecture test already forbids every web path to it, and no repo caller exists, so the wrapper would serve nobody.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No; Phase 3 can be planned with A and switched.
- **Where it lands:** Task 3.3.

**D5: What happens to records that have already drifted (stamped approved, or unlocked)?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | A read-only count and list script, run on dev now and on production with the owner's override, then a reviewed per-row decision | Nothing changes without a person looking. Needs the production override, which is the owner's to give. |
| **B** | Migration `0072` repaints `quotation.audit_status` from the latest submission | Automatic and consistent. It silently demotes quotes staff believe are approved, and it cannot tell a legitimate edit-after-unlock from abuse. |
| **C** | Leave existing rows | No effort. Drifted rows keep showing Approved while convert refuses, with no explanation. |

- **Recommendation: A.** This follows step 02's precedent: size the problem before choosing a repair, and the dev count may well be zero.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No; code ships first.
- **Where it lands:** Task 3.5.

### Assumed

**D6: Which quotation verbs join the under-review freeze?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | `update`, `applyTemplate`, `remove` | Content and existence are frozen, matching `lading.delete` and `feeTemplates.update`. Send and Decide stay available. |
| **B** | Also `send` and `decide` | A pending quote cannot be emailed or marked won. That goes beyond the defect, and steps 09 and 10 own those verbs. |
| **C** | `update` and `applyTemplate` only, as the JSON says | Leaves deletion of a record the reviewer is reading. |

- **Recommendation: A.** Deleting what a reviewer is reading is the same failure as rewriting it, and the sibling `lading.delete` already refuses it.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Task 1.1.

**D7: Where does the "Export quotation" gate belong?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | `exportSheet` and `send` | Both egress verbs are guarded, matching the label and eyun's note (…导出报价单). |
| **B** | `exportSheet` only, plus a new `send` gate key | Separate control over email. It adds a vocabulary key and a config checkbox no seeded tenant asked for. |
| **C** | Keep it on `retrieve`, but exempt the stage reviewer | Reviews become decidable, but the author still cannot finish a draft and exports stay ungated. |

- **Recommendation: A.** `send` emails the same bytes `exportSheet` returns (`renderQuotationDocument`), so gating one without the other gates nothing.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4.5, Task 4.1.

**D8: What does the record page do while a quotation is under review?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Disable Save and Reference template with a title, add Retract, show Resubmit on withdrawn | The user learns the rule before hitting it, and the server stays the guard. |
| **B** | Change nothing and let the 409 toast explain | No web change. The user types a full edit and then loses it. |
| **C** | Make the whole form read-only | Clearest, but a large change to a 3,300-line form that other steps are editing. |

- **Recommendation: A.** It is the smallest change that completes Journey 1 on the page. Without Resubmit on `withdrawn`, a retracted quote cannot be sent back from its own record at all.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4.2, Task 1.5.

**D9: How does the reviewer queue treat the reviewer's own submission?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Hide it from `awaitingMyReview`, `listPending` and `pendingSummary` when the flag is on | The queue shows only rows the engine will accept, and the count agrees with the rows. |
| **B** | Show it, marked "You submitted this" | Transparent, but leaves work in the queue that can never be done. |
| **C** | No queue change; refuse only at decide | Smallest change. It recreates the "row you can open and then be refused on" bug `queue-filter.ts:17-22` was written to remove. |

- **Recommendation: A.** `queue-filter.ts` exists precisely so the queue asks the same question `decide()` does.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Task 2.5.

**D10: How are a concurrent submit and save kept from interleaving?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | `FOR UPDATE` on the quotation row in `update` and in `quotation.exists` | Serialized with one short lock, touching only the quotation entry. |
| **B** | Accept the race | No change. A save can still land milliseconds after submit, which is exactly defect 1, only rarer. |
| **C** | Lock the resource row generically in `submitForReview` for every resource | Uniform, but it changes locking behaviour for nine resources this step does not own. |

- **Recommendation: A.** It closes the window for the resource in scope, and the other resources can copy the pattern.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Task 1.2.

**D11: Conflicts between `step-08.json` and the code. Which wins?** · Status: Assumed (the code wins, per the brief)

| | Approach | Consequence |
|---|---|---|
| **A** | Follow the code and log each conflict (below) | The plan is buildable, and the JSON's authors can correct the guide. |
| **B** | Follow the JSON | Task 2 would ship a seed change that breaks decide and `seed.test.ts`. |
| **C** | Stop and ask | Not available to this planning run. |

- **Recommendation: A.**
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Phase 0; Tasks 1.1, 2.x, 3.3.

| # | JSON claims | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| C1 | `quotations.review` is "held by branch-manager and director" | Held by **admin, branch-manager, sales** (`roles.ts:89, 103, 125`). Director has `quotation.read` only (`:214`). | Code. Sales can self-stamp, which raises defect 3's reach. |
| C2 | Alternative repair: "point the seeded quotation stage at `director`" | Director lacks `quotation.review`, so `decide.ts:50` returns FORBIDDEN and `seed.test.ts:277` fails. The seed also skips existing orgs (`seed.ts:223`), and tenants can re-route stages (`flow-admin.ts:65`). | Engine refusal (D1-B) |
| C3 | Repair names only `update` and `applyTemplate` | `remove` (`quotation.ts:3361`) has the same missing guard | Code (D6) |
| C4 | Self-decision refusal "the same shape as `withdraw.ts:48`", implied engine-wide | Engine-wide would break bill stage 1's `all_pass` quorum and 8+ tests (`audit-review.test.ts`, Phase 0) | Per-resource switch plus denominator exclusion (D1-B) |
| C5 | The unlock is "three clicks" | Confirmed UI-reachable through the ledger `<ReviewMenu>` (`review-menu.tsx:49-56`). The record page also has no Resubmit on `withdrawn`. | Code; adds Resubmit (D8) |
| C6 | Line citations (`gates.ts:123/130`, `post-approval.ts:43`, `withdraw.ts:48/51`, `seed.ts:69/83-89/160/232`, `quotation.ts:2355/2489/2598/3196/3519/3575/3845`, `$quotationId.tsx:585/1266/1314`, `review-queue.tsx:360`) | All still accurate at HEAD | none |

**Risks.**

- **A one-manager branch cannot get quotations approved after Phase 2.**
  Likelihood: likely in small tenants. Impact: blocks conversion.
  Mitigation: **D2-A's submit-time message names the fix, and the release note tells admins to name a second reviewer on the quotation flow before deploy.**
- **A multi-stage quotation flow (tenant-configured) reaches a later stage whose only reviewer is the submitter.**
  Likelihood: rare, since the seed is single-stage. Impact: the attempt strands at that stage.
  Mitigation: **Task 2.4 checks the opened stage only. The stranded attempt stays retractable by the submitter, and the refusal text at decide names the problem. Extending the check to every applicable stage is recorded as a follow-up, not built now.**
- **`applyTemplate` checks its guards on `context.db` before its write transaction, so a submit can slip between them.**
  Likelihood: low. Impact: medium (template lines added under review).
  Mitigation: **move `applyTemplate`'s scoped load and both freezes inside its transaction, with `FOR UPDATE`, as part of Task 1.2 if the handler's structure allows. Otherwise record it as a known gap in the PR.**
- **Phase 3's engine-wide submit refusal surprises an order, bill or cost workflow that re-submits approved records.**
  Likelihood: low (no test or e2e spec found doing it). Impact: medium.
  Mitigation: **run the full `packages/api` suite and `e2e/specs/audit.*.spec.ts`, and announce the rule to the order, bill and cost step owners before Phase 3 merges.**
- **Parallel steps edit `quotation.ts` and the engine files at the same time.**
  Likelihood: high. Impact: merge conflicts or swept hunks.
  Mitigation: **one committer at a time; read every staged hunk; each agent rebases onto HEAD before committing and re-runs both architecture tests.**
- **A stale `:3000` server makes Phase 1-4 browser checks pass on old code.**
  Likelihood: high. Impact: false green.
  Mitigation: **restart the server after every `packages/api` change, and check the pid's start time against the last edit.**

### Settlements that span plans (2026-09-15)

- **X3 (option A).** Task 3.3 also deletes the legacy `feeTemplates.review` (`quotation.ts`, near `:1321`) and its allow-list entry. Remove the `canAuditTransition` import only if nothing else still uses it.
- **X10 (addition 2026-09-17, from `steps-12-15-crosscheck.md`; Wilfred accepted the recommendation).** Task 3.3 must also drop `isEndpoint: true` on `QUOTATION.review` and `QUOTATION.feeTemplateReview` in `modules/quotation/permissions.ts`, in the same commit, or `registry.sync.test.ts:22` fails: each deleted procedure held the node's only `requireNode`. Both nodes stay registered and keep being enforced at decide time through `modules/audit/resources.ts:125`/`:164`. This mirrors step 15 D9-A for `COLLECTIVE_ORDER.review`, which cites step 08 as the precedent. **This is an addition to an existing task, not a new decision; §9's settled decisions D1–D6 are unchanged.**
- **X1 (option A).** Step 10 turns `separationOfDuties` on for its own `quotation_decision` resource. Build the switch so a new resource can opt in with one line.
- **X2 (option A).** Step 04 follow-up Task F.1 turns the switch on for `fee_template` after this plan merges.
- **X4 (option C).** `decide` (Won/Lost) stays outside the under-review freeze, as D6 assumes. Convert to order still requires an approved review.
- **Step 09 D7-A.** When D7 moves the export gate into `send`, assert it **before** step 09's idempotency-key lookup, so a resumed send is gated too. Whichever of step 08 and step 09 merges second rebases onto `send`.

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000.
**Preconditions:**
- The audit e2e seed used by `e2e/specs/audit.quotation-queue.spec.ts`, which provides `actors.owner`, `actors.managerA` and a second manager, each with their own cookie.
- A **sales** actor, added to that seed if absent.
- The quotation flow enabled with `convert_order` ticked, stage 1 targeting role `branch-manager`, and `postApprovalEditable: false`.
- For Journey 4, `export` also ticked.
- Confirm who you are with `fetch('/api/auth/get-session')` before each actor's steps, never by assuming a cookie write landed. Switch actors with sign-out, then set the cookie.
- The `:3000` server restarted after the last `packages/api` edit.

**Migrations:** none. Before testing, confirm the journal still ends at `0065` plus whatever steps 01/02 applied (`0066`, `0067`), and that those are applied.

**Golden path: Journey 1 (sales)**
1. Create a quotation with one selling line at 540 and save it. Navigate to `/quotations/<id>` and expect the badge to read Draft.
2. Click **Submit for Review**. Expect the toast *Review updated*, the badge Pending, **Save Quote** `disabled`, and its `title` to contain "Under review".
3. Expect a **Retract** button inside `[data-testid="audit-controls"]`.
4. Call `quotations/update` over `/rpc` with the line at 300. Expect HTTP 409, body *"This record is under review…"*. Reload, and the line still reads 540.
5. Click **Retract**. Expect the badge Withdrawn, a **Resubmit** button, and Save enabled.
6. Change the line to 300, click **Save Quote**, then **Resubmit**. Expect the badge Pending and the line at 300.

**Golden path: Journey 2 (branch managers)**
1. As `managerA`, create and submit a quotation. Expect the badge Pending.
2. Navigate to `/approve/quotation`. Expect the quotation number **not** in the table.
3. Open `/quotations/<id>` and click **Approve**. Expect the error toast *"You submitted this record. Another reviewer must decide it."* and the badge still Pending.
4. As the second manager, go to `/approve/quotation`. Expect the row present. Tick it, click **Approved**, and expect the success toast.
5. Open the record. Expect the badge Approved and `[data-testid="convert-to-order"]` visible.

**Golden path: Journey 3 (sales, on the approved quote from Journey 2)**
1. Navigate to `/quotations`. Open that row's review menu and choose **Submit for review**. Expect the toast *"Refused — This record is approved and locked…"*.
2. Open the record. Expect the badge still Approved and **Convert to order** still visible.
3. Call `/rpc/quotations/review`. Expect 404.

**Golden path: Journey 4 (owner ticks Export; sales works a draft)**
1. As sales, open a **draft** quotation. Expect the page to render its lines (no 409 in network).
2. Click **Save Quote** and expect success.
3. Click Export XLSX. Expect the error toast *"\"Export quotation\" requires review approval first"* and no download.
4. Open **Send**, fill the fields and send. Expect the same error toast, and the thread list for the quotation to have no new outbound message.
5. Submit, then approve as a branch manager. Back as sales, click Export XLSX and expect a file to download.

**Edge case:** under D2-A, configure the quotation stage to name only `managerA` by member id, then as `managerA` click **Submit for Review**. Expect the error toast *"Nobody but you can approve this quotation…"*, the badge still Draft, and no row in `/approve/quotation` for anyone.

**Regression checks.** §7's shared-engine surface:
1. As an accountant, submit a bill and approve it as the same accountant. Expect the stage to record the decision exactly as before (flag off for bills).
2. `e2e/specs/audit.post-approval.spec.ts` and `audit.quotation-queue.spec.ts` pass.
3. Both architecture tests and `seed.test.ts` pass.
4. `quotation.convert.test.ts` re-saves its approved, editable quote successfully.

**Mobile:** at 400px width, the header's audit controls (badge, Retract, Resubmit) wrap without horizontal overflow, and the disabled Save still shows its reason on tap (title or tooltip).

_2026-09-15: Wilfred chose the recommendation for every open decision in §9. The readiness points held back for pending decisions no longer apply._

**Readiness: 7/10.** Every guard, caller, role grant and test pin cited here was re-read at HEAD `6bb3a1bf`. Phases 1 and 4 are ready to execute now. The missing points:
- Three decisions only Wilfred can make and that block Phases 2 and 3: D1 (engine-wide or per-resource segregation), D2 (the single-reviewer branch) and D3 (how the lock is kept).
- The unmeasured production drift count (D5).
- Two details not verified statically: whether the Export and Send handlers already toast a server refusal (Task 4.2), and whether `applyTemplate`'s pre-transaction guards can move inside its transaction without restructuring (a risk above).
