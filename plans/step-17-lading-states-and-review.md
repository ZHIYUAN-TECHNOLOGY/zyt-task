# Step 17 — a bill of lading can be sent for review from the screen, cannot be rewritten while the director reads it, and each state move happens once and says why

**SOP step:** 17 "Move the B/L through its states" · **Shipment** (`/lading`) → one bill (`/lading/$id`) · toolbar **Check In / Amend / Check Out / Hold** and their cancels, per-row **Circulation** menu on the ledger, **Attachments** card · reviewer decides under **Approvals → Shipment review** (`/approve/lading`)
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-21. The `nct-layout` worktree is checked out at `ea1560e7` on `feat/intake-golden-path-e2e`; `git diff --stat 6bb3a1bf HEAD -- packages apps` is empty, so every citation under `packages/` and `apps/` matches `6bb3a1bf`. This is the commit steps 04–15 were planned at. Every `file:line` below was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Standard. Adds a submit path to a live, enabled review flow; adds an under-review freeze to `deleteAttachment` and row locks to the eight state verbs and the attachment writers; reads the shared audit-engine registry (`resources.ts`) without editing it. As first drafted it also froze and locked `lading.update`, locked `lading.exists` and removed the Audit Status field. No migration under the settled options. **Under crosscheck X17–X19 (settled 2026-09-21), the `lading.update` freeze, row lock and in-transaction guards, the `lading.exists` lock, the Audit Status removal and the workflow-status refusal are built by step 16 Phase 1; this plan confirms each by grep and adds none of them.**
**Cross-plan items owned:** the "Shipment review half" of the `dead-queues` ledger item (step 13 §1 hands it here by name: "The step 17 half is a lading submission path"); the attachment writers under review (crosscheck X21: `deleteAttachment` freeze, D3-B). The `lading.update` under-review freeze and transaction boundary that step 15 §1 "Out of scope" and its Risks hand to "steps 16/17" is **step 16's** (D2-B, per X17); this plan does not take it.
**Status.** Every decision below is **Decided (2026-09-21)**. Wilfred took the Recommended option of each, except where a settled crosscheck item overrides it: **D2 is B (per X17)** and **D8 is superseded by step 16 D1 (per X18)**. See "Decisions settled (2026-09-21)" at the end.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`, `loadScoped` at `procedures/org.ts:467`, which already takes `{ tx, forUpdate }`). Drizzle schema in `packages/db/src/schema`. TanStack Router file routes in `apps/web/src/routes/_next`. vitest on PGlite. Dev: web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Detail page toolbar.** `routes/_next/lading/$id/index.tsx:362-434` renders four `<WorkflowButton>`s (`:364` Check In, `:374` Check Out, `:384` Amend, `:394` Hold), then **Excel**, **PDF** and **Edit**. Each button reads one stamp (`checkedInAt`, `checkedOutAt`, `amendedAt`, `heldAt`) and flips between the verb and its cancel (`WorkflowButton`, `:657-683`). All four are shown when `perms.has("lading:update")` (`:296-307`). Toasts: _Checked in_ `:167`, _Check in cancelled_ `:174`, _Checked out_ `:181`, _Check out cancelled_ `:188`, _Amended_ `:195`, _Amendment cancelled_ `:202`, _Put on hold_ `:209`, _Hold released_ `:216`, _Exported <file>_ `:225`. Errors reach the user through the global `MutationCache.onError` net (`utils/orpc.ts:63`), because these mutations define no `onError`.
  - **Ledger row menu.** `routes/_next/lading/-lading.columns.tsx:700-717` offers all eight actions on every row regardless of state (comment `:708-711`); `runCirculation` (`lading/index.tsx:442-462`) calls `lading.circulate` with one id and toasts _Not moved — <reason>_ on a refusal.
  - **Server.** `WORKFLOW` table (`routers/lading.ts:541-593`): four permission nodes, each cancel on its action's node. `applyWorkflow` (`:601-678`): `loadScoped` on `context.db` **without** `forUpdate` (`:608-614`), precondition (`:616-617`), one `assertGateCleared(context.db, …)` per action with literal keys (`:624-640`), then **one** transaction for the update and its audit row (`:657-675`). `statusAfter` (`:526-539`) derives `status` from the hold/amend stamps and keeps the displaced status in `statusBefore`. Eight endpoints `:1652-1659` (`workflowProcedure`, `:683-688`); `circulate` (`:1670-1699`) admits on any of the four nodes and re-checks the specific one (`:1681`).
  - **Gates.** `modules/lading/gates.ts:12-21` declares eight keys (`endorsement`, `endorsement_cancel`, `amendment`, `amendment_cancel`, `release`, `release_cancel`, `detention`, `detention_cancel`). The seeded "Bill of lading review" flow (`modules/audit/seed.ts:153-164`) is **enabled** (default `enabled: flow.enabled ?? true`, `:233`), one stage for role `director`, `gates: []`, `postApprovalEditable: false` (`:232`). Tenants can tick any key in Approval Process Setting (`modules/audit/flow-admin.ts:116`). A ticked key refuses every lading whose latest submission is not `passed`, **including one never submitted** (`modules/audit/gates.ts:92`).
  - **Review engine.** `REVIEWABLE_RESOURCES.lading` (`modules/audit/resources.ts:245-280`): `submitNode: LADING.update`, `reviewNode: LADING.review`; `exists` (`:247-253`) takes no lock and no data scope; `repaintCache` writes `lading.audit_status` and the submit/audit stamps. `auditReview.submit` is `routers/audit-review.ts:355`.
  - **Queue.** `/approve/lading` mounts `<LadingPage mode="review">` (`routes/_next/approve/lading.tsx:36`), lists by `awaitingMyReview` (`lading/index.tsx:351`), and decides through `engineDecideBatch("lading", …)` (`:406`). The select column exists only in review mode (`-lading.columns.tsx:816`).
  - **Roles.** `lading.detail` (the subtree holding the four workflow nodes) is granted to admin, branch-manager and ops (`packages/api/src/roles.ts:92, 106, 166`); `lading.review` to director only (`:219`). The flat statement gives `lading:*` to owner, admin, branch-manager, ops and `lading:read` to the rest (`packages/auth/src/permissions.ts:105, 132, 154, 176`). **No "documentation" role exists.**
  - **Attachments.** `uploadAttachment` (`lading.ts:1997-2053`), `deleteAttachment` (`:2083-2127`) keep a `jsonb` list on the lading row (`schema/lading.ts:180`) and objects in R2 under `lading/<id>/…`.
  - **Downstream.** Nothing outside `routers/lading.ts`, `schema/lading.ts` and three web files reads `checked_in_at`, `checked_out_at`, `held_at` or `amended_at` (grep over `packages`, `apps`). The states are a record for people; no later step (18–27) reads them. There is no severed code hand-off to step 18 from this step.

- **Finding A — the review half is missing: confirmed, and it is also a dead end for gates (highest consequence).**
  - No web file calls `auditReview.submit` for `lading`: `engineReview` (`apps/web/src/lib/audit-review.ts:34`) is bound only in `components/order-ledger/order-row-actions.tsx:16`, and `<ReviewMenu>` is rendered by no lading screen (grep of `apps/web/src`). The engine path exists and works: `seed/run-operations.ts:112` and `e2e/specs/audit.review-queue.spec.ts:131` submit ladings over RPC.
  - Consequences in a real org: (1) the enabled, director-staffed flow never receives a submission, so `/approve/lading` is empty by construction; (2) **if an admin ticks any of the eight lading gates, that verb refuses on every bill for ever** — `"<Label>" requires review approval first` — with no control anywhere on screen that could create the approval it asks for. `audit-review.test.ts:1175` pins the refusal for `detention`.

- **Finding B — `lading.update` is not frozen while under review, and does not serialize with submit (becomes live the day Finding A is fixed).**
  - `update` (`lading.ts:1537-1650`) loads on `context.db` without a lock (`:1544-1551`), runs `assertPostApprovalEditable` on `context.db` outside its transaction (`:1554`), resolves the order link on `context.db` (`:1587-1596`), and only then opens its transaction (`:1609`). There is **no** `assertNotUnderReview` (its lading callers are `delete` `:1474` and `bulkDelete` `:1513` only).
  - `REVIEWABLE_RESOURCES.lading.exists` takes no `FOR UPDATE`, so a save can commit after a concurrent submit.
  - Step 15 Phase 3 adds `assertGateCleared(context.db, …, "create_lading")` to this handler on `context.db` and logs the same read-then-write race as owned by "steps 16/17" (step 15 §8 item 5, Risks).
  - `deleteAttachment` has no review guard at all, so a scan the reviewer relied on can be removed mid-review or after approval.

- **Finding C — the "Audit Status" select writes the engine's cache by hand.**
  - `create.tsx:1292-1307` and `$id/edit.tsx:1558` offer _None / Pending / Approved / Rejected_. The server accepts `auditStatus` on create (`ladingFields`, `lading.ts:330`; insert `:1128`) and update (`ladingUpdateInput`, `:424`) and writes it to `lading.audit_status` (`schema/lading.ts:190`), the column `repaintCache` owns.
  - Readers: the record's **Audit Status** row (`components/lading/lading-record.tsx:212`), the ledger's audit-status column (`-lading.columns.tsx:760`), the ledger filter including _unsubmitted_ = `IS NULL` (`lading.ts:743-747`), and the list export (`:1291`). A bill can therefore read **Approved** everywhere without any review. The gates and the queue read `audit_submission`, so no gate is bypassed; the display lies. After Finding A is fixed, a hand-write also contradicts a live submission.

- **Finding D — a state move is read outside its write, so it can apply twice or on stale state.**
  - `applyWorkflow` reads the row, checks the precondition and the gate before the transaction opens, and its `UPDATE` is unconditional (`:658`). Two presses (two users, or the detail page and a ledger row in two tabs) both pass `"Already checked in"` and both write: two `lading.check-in` audit rows, the stamp rewritten with the later time. A `hold` racing an `amend` computes `status` from the same stale row, so the bill can end **held while showing `amended`**. A `hold` racing an edit that sets `status` loses the edit (`statusBefore` keeps the old base). The gate read can race a retract or a reject.
  - `lading.test.ts:725-740` proves only the sequential refusal.

- **Finding E — the attachment list is read-modify-write without a lock.** `uploadAttachment` reads `attachments` on `context.db` (`:2011`), builds `next` (`:2033`) and writes it in a later transaction (`:2039-2040`); `deleteAttachment` does the same (`:2095-2110`). Two uploads at once keep only one entry (the other object is stranded in R2, invisible and undownloadable because `downloadAttachment` requires a listed key, `:2070`). An upload racing a delete can resurrect the deleted entry, whose object is then gone (`:2124`), so its download answers NOT_FOUND.

- **Finding F — Check Out is allowed while the bill is on Hold.** No precondition relates the four stamps (`:541-593`); `check-out` checks only `checkedOutAt`. A detained bill can be released; a bill can also be checked out without ever being checked in. The code comment (`:476-486`) says eyun treats each state as independent. Whether release during detention must be refused is a business rule, so it is D6, not a fix taken for granted.

- **Finding G — Hold never records a reason from any screen.** The server accepts `reason` and writes `held_reason` (`:585-586`, input `:686`), and the record's exception reads _On hold since … — <reason>_ (`lading-record.tsx:358`). The detail page sends `hold.mutate({ ladingId: id })` (`$id/index.tsx:399`) and the row menu sends `{ ladingIds: [id], action }` (`lading/index.tsx:446`). The reason field is dead.

- **Finding H — "on-hold" can be set by hand as a status.** `STATUS_OPTIONS` includes `on-hold` on both forms (`create.tsx:140`, `$id/edit.tsx:165`). A bill set to `on-hold` with `held_at` null shows **Hold** (not Cancel Hold); pressing Hold stores `statusBefore = "on-hold"` (`statusAfter`, `:534`), and Cancel Hold restores `on-hold`. The bill reads On hold until someone edits the status again. Recoverable, low consequence.

- **Adjacent facts (flagged, not fixed here).**
  1. `lading.exists` ignores data scope, so a member with `lading.update` and an "own" scope can submit someone else's bill over RPC (same shape as step 15 D14, deferred there under X13).
  2. Once Finding A is fixed, an **approved** bill under the seeded `postApprovalEditable: false` refuses every `lading.update`, including **Checked-In Remark** and **Checked-Out Remark**, which the SOP presents as notes written while the bill moves (D9).
  3. The **Documents** card on the bill (`OrderDocumentsCard`, `$id/index.tsx:451`) never renders (SOP break "Documents → the job"); that is step 18's.
  4. `separationOfDuties` does not exist at HEAD; step 08 Task 2.1 writes `false` for `lading` (step 08 §7 table: "director-signed and cannot self-approve under seed"). Nothing to add here.

- **Precedent this plan follows.** Freeze placement and order from step 15 §4.1: scoped load (`FOR UPDATE`) → `assertNotUnderReview` → `assertPostApprovalEditable` → writes, all inside one transaction. `exists` lock from step 08 Task 1.2. Engine-driven "under review" notice from step 15 D12 (`get` gains a derived field). `<ReviewMenu>` bound through `engineReview` at module scope, as `apps/web/src/architecture.test.ts:939` requires.

- **Migration state.** Journal ends at `0065_quotation_send_decision` (idx 64), 65 `.sql` files, contiguous. Reservations by other plans: 0066 (01), 0067 (02), 0068 (04), 0069–0072 conditional (05–08), 0073 (09), 0074 (10); every other conditional is `00NN_<name>`, numbered at merge. **This plan needs no migration** under any recommended option. D5-B (not recommended) needs none either.

- **Is step 17 mostly sound?** The state machine itself is: the eight verbs, their nodes, their gates, `statusAfter` and the cancel twins are coherent and well tested (`lading.test.ts:564-740`). What is broken is around it: the missing submit (A) and what a working submit exposes (B), a hand-writable cache (C), and three read-outside-write races (D, E and B's lock). The plan is two phases.

---

## 1. Overview

**Problem.** Documentation can check a bill in, amend it, check it out and hold it, but cannot send it for review from any screen. The seeded review flow is therefore dead, and any org that ticks a lading gate freezes that verb on every bill with no way out. If the submit path were added alone, the bill could still be rewritten while the director reads it. Separately, anyone who can edit a bill can type its audit status as **Approved**, two clicks can move a bill twice, two uploads can lose a scan, a detained bill can be released, and a hold never says why.

**Goals.**
- **Phase 1 (A, B):** a bill is sent for review from its own page and appears in Shipment review; while it is there its content cannot change, and submit and save cannot interleave. The bill page says it is under review.
- **Phase 1 (A, B), as settled:** the freeze and lock on `lading.update` and `lading.exists` arrive with step 16 Phase 1 (X17); this phase adds the Submit, the notice and the `deleteAttachment` freeze on top of them.
- **Phase 2 (C–H):** each state move reads and writes the same locked row, so it happens once; the attachment list cannot lose or resurrect an entry; the audit status is written only by the engine; the workflow-owned statuses cannot be typed by hand; Hold asks for a reason; and (D6-A, Decided) a held bill cannot be checked out. The audit-status and typed-status goals are delivered by step 16 Phase 1 (X18, X19); this phase confirms them.

**Success criteria.**
- On `/lading/<id>`, **Review → Submit for review** as a branch manager toasts _"1 row — submit for review"_ (`review-menu.tsx:110`); the bill appears in `/approve/lading` for a director, who approves it.
- While that bill is under review, `lading.update` (step 16's freeze, X17) and `lading.deleteAttachment` (this plan) return CONFLICT _"This record is under review and cannot be edited. Retract the submission first."_ and write nothing; the edit page shows the notice with **Save** disabled.
- With `detention` ticked, an approved bill can be put on hold; an unsubmitted one is refused as today; the refusal can now be cleared from the screen.
- Two concurrent `checkIn` calls on one bill on real Postgres: exactly one succeeds, one CONFLICT _"Already checked in"_, one `lading.check-in` audit row.
- Two concurrent `uploadAttachment` calls on one bill on real Postgres: both entries listed.
- `lading.create` and `lading.update` ignore `auditStatus`; neither form shows **Audit Status**; neither offers **On-hold** (nor Amended nor Released) as a status; `status: "on-hold"` sent over RPC is refused. Delivered by step 16 Phase 1 (its D1-A and D3-A, crosscheck X18 and X19); this plan confirms it and adds nothing.
- **Hold** asks for an optional reason and the record shows it.

**In scope.** Submit on the bill page; under-review and post-approval freeze on `deleteAttachment`; engine-driven `underReview` on `lading.get`; `applyWorkflow` in one locked transaction; attachment writers locked; Hold reason prompt; the D6 precondition; grep confirmations of what step 16 Phase 1 built (the `lading.update` freeze, row lock, in-transaction guards and moved `create_lading` call, the `exists` lock, `auditStatus` removed, workflow statuses refused; X17–X19); read-only probes; a read-only drift report.

**Out of scope.**
- Linking the bill to its order, and create-time behaviour (step 16).
- The `lading.update` freeze, `FOR UPDATE` load, in-transaction guards and the `lading.exists` lock (step 16 Phase 1, X17); the status vocabulary and the Audit Status removal (step 16 D1 and D3, X18 and X19).
- The `create_lading` gate itself (step 15 Phase 3; this plan keeps and moves its `update` call).
- Submit-time data scope in `lading.exists` (adjacent fact 1; D12 recommends deferring with step 15 D14).
- The Documents card and MBL/HBL documents (step 18); tracking and the demurrage clock (step 19).
- A submit or row-state-aware menu on the ledger row (D1-B is the follow-up if wanted).
- Repairing hand-written `audit_status` values (D11-A reports only).

**SOP findings (`customer-intake-sop/sop.json`, step 17 `watch` and ledger item `dead-queues`):**

| Finding | Planned? | Where |
|---|---|---|
| Watch / pitfall: "no shipment screen can submit a lading for review" | Yes | Phase 1 |
| Ledger `dead-queues`: "Shipment review … no screen can submit a lading into it" (repairs `s` 17) | Yes, the Shipment review half; To Receive is step 13's | Phase 1 |
| Field note: "Audit Status … editable on the create and edit forms and persisted, but it is a cache column" | Yes, by step 16 Phase 1 (X19) | Phase 2 confirms (D4) |

**Decisions (all Decided 2026-09-21; Chosen option in brackets):**
- Where the Submit control lives → D1 [A: the bill page toolbar]
- Who owns the `lading.update` freeze and lock → D2 [B: step 16 Phase 1, merged before 17 (per X17)]
- Attachments while under review and after approval → D3 [B: freeze delete, keep upload open]
- The Audit Status field → D4 [A: drop from both inputs and both forms, done by step 16 Phase 1 (X19)]
- How a state move serializes → D5 [A: one transaction with `FOR UPDATE`]
- Check Out while on Hold → D6 [A: refuse]
- Hold reason → D7 [A: optional reason prompt]
- Hand-set workflow statuses → D8 [superseded by step 16 D1-A: `draft`, `confirmed`, `cancelled` settable, echo dropped (per X18)]
- Remarks after approval → D9 [A: accept the freeze and say so in the SOP]
- Under-review notice on the bill → D10 [B: engine-driven `underReview` on `lading.get`]
- Residue (hand-written audit statuses) → D11 [A: report only]
- Submit-time data scope → D12 [A: defer with step 15 D14]

## 2. User Journeys

**Journey 1 (new): Documentation sends a bill for review, and the director approves it**
Trigger: the bill exists (step 16) and is ready to be checked.
Steps:
1. A branch manager (or ops member) opens **Shipment** → the bill → the toolbar now carries **Review** beside **Edit** (D1-A).
2. **Review → Submit for review** → toast _"1 row — submit for review"_. The record's **Audit Status** reads Pending (engine repaint), and a notice above the record reads _"Under review. Request withdrawal from the Review menu to make changes."_ (D10-B).
3. **Edit** still opens the form, but **Save** is disabled with the same sentence as its title. A stale tab that saves anyway gets the server's CONFLICT toast (`$id/edit.tsx:451`). Nothing is written.
4. The state buttons keep working (Check In, Amend, Hold, Check Out; unless a gate is ticked).
5. A director opens **Approvals → Shipment review** (`/approve/lading`) → the bill is listed → ticks it → **Approved** → toast _"1 lading(s) approved"_ (`lading/index.tsx:407`).
6. Flow ends: the bill reads Approved; in an org that ticked any lading gate, that verb now works on this bill.
Where it lives: the existing bill page toolbar and the existing queue.

Old journey, for contrast: step 2 did not exist. The queue was always empty, and a ticked gate could never be cleared.

**Journey 2 (changed): Documentation corrects a bill that is under review**
Trigger: the bill is Pending and a correction is needed.
Steps:
1. **Review → Request withdrawal** → the seeded lading flow is `withdrawalMode: "direct"` (`seed.ts:156`, lading entry), so the attempt becomes withdrawn at once; the notice disappears.
2. **Edit** → change the consignee → **Save Changes** → saved.
3. **Review → Submit for review** again.
Where it lives: the existing Review menu and edit form.

**Journey 3 (changed): Documentation moves a bill, and each move happens once**
Trigger: the bill is being worked (any review state).
Steps:
1. **Check In** pressed twice quickly (or once here and once from the ledger row in another tab) → one _Checked in_ toast; the second press returns _"Already checked in"_. The Circle Time column shows one move.
2. **Hold** → a small dialog asks for an optional reason ("Customs query") → **Put on hold**; the record's exception reads _On hold since … — Customs query_ (D7-A).
3. **Check Out** on the held bill → refused _"On hold — release the hold before checking out"_ (D6-A). **Cancel Hold** → _Hold released_ → **Check Out** → _Checked out_.
4. Two colleagues upload a scan each at the same moment → both appear in **Attachments**.
Where it lives: the existing toolbar, row menu and attachments card.

Old journey, for contrast: step 1 could record two moves, step 2 could not record a reason, step 3 released a detained bill, step 4 could lose a scan.

**Journey 4 (changed): Editing a bill no longer offers the fields the system owns**
Trigger: documentation opens `/lading/create` or `/lading/<id>/edit`.
Steps:
1. **Administration** no longer shows **Audit Status**. The record page still shows it, read-only, as the engine set it.
2. **Status** offers Draft, Confirmed, Cancelled (step 16 D1-A, which supersedes this plan's D8 under X18). It no longer offers On-hold (Hold owns it), Amended (Amend owns it) or Released (check-out's stamp is the release record). A bill whose stored status is one of those shows it read-only, _"Set by the bill's workflow"_.
Where it lives: the existing create and edit forms, as step 16 Phase 1 leaves them; this plan changes neither for this journey.

## 3. Result (What Changes for the User)

**Before:** a bill cannot be sent for review from any screen, so Shipment review is always empty and a ticked lading gate freezes that verb for ever. A bill's audit status is whatever the last editor picked. A double press moves a bill twice, two uploads can lose a scan, a detained bill can be released, and a hold has no reason.
**After:** a bill is submitted from its own page, reviewed by a director, frozen while under review, and the audit status is the engine's alone. Each move applies once on a locked row; Hold asks why; a held bill must be released before it is checked out (D6-A).
**Key differences:**
- Documentation: a **Review** menu on the bill; an under-review notice and a disabled Save while the director reads it; Hold asks for a reason; On-hold and Audit Status leave the forms (step 16 Phase 1).
- Director: Shipment review finally has rows.
- Admins: ticking a lading gate becomes usable, because the approval it needs can now be obtained.
- Nobody: the state buttons do not change shape.

## 4. Technical Architecture

### 4.1 Submit from the bill page (Journey 1; Phase 1) → D1, D10

`apps/web/src/routes/_next/lading/$id/index.tsx`:

```tsx
import { ReviewMenu } from "@/components/review-menu";
import { engineReview } from "@/lib/audit-review";

// Module scope, as apps/web/src/architecture.test.ts:939 requires.
const reviewLading = engineReview("lading");

// in `actions`, before the Edit button, same visibility as Edit:
{canUpdate && data && <ReviewMenu selectedIds={[id]} onReview={reviewLading} />}
```

`ReviewMenu` already invalidates every query after a move (`review-menu.tsx:106`), so the record repaints. Not `iconOnly`: that variant hard-codes `aria-label="Review this order"` (`review-menu.tsx:139`). The menu still lists all five moves; Approve and Reject are refused for a submitter without `lading.review` with `Missing permission: lading.review`, the same contract as the order row.

**Under-review notice (D10-B).** `lading.get` (`lading.ts:1360`) gains one derived output field after its scoped load: `underReview: status === "under_review" || status === "withdrawal_under_review"`, from `latestSubmissionByResource(context.db, organizationId, "lading", [row.id])` (`modules/audit/shared.ts:332`). The bill page renders a one-line notice when `detail.data.underReview`; `$id/edit.tsx` disables **Save Changes** with the sentence as `title`. It reads the engine, not `audit_status`, for the reason step 15 §4.2 gives: the cache can be wrong (Finding C, probe 17-P3).

### 4.2 Freeze and lock on the bill's content writers (Journeys 1–2; Phase 1) → D2, D3

**Under D2-B (per X17), the `update` half below is step 16 Task 1.2's, not this plan's.** Step 16 §4.3 is its operative spec (it also places the status and branch checks after the scoped load, in the X22 order). This plan's Task 1.1 greps the rebuilt handler for the one locked transaction, `assertNotUnderReview`, the `FOR UPDATE` load and the moved `create_lading` literal on `tx`, and adds none of them. The `update` sketch is kept only as the shape to confirm. The `deleteAttachment` half is this plan's (D3-B, X21).

Spec in `packages/api/src/routers/lading.ts` (re-locate by symbol at the base commit; step 15 Phase 3 and step 16 Phase 1 edit `update` first):

```ts
// update — built by step 16 Task 1.2 (X17); confirm by grep, add nothing
return context.db.transaction(async (tx) => {
  const row = await loadScoped(context, "lading", lading, { id: lading.id, ...ladingScopeCols },
    ladingId, { tx, forUpdate: true });                                  // was :1544-1551, no lock
  await assertNotUnderReview(tx, organizationId, "lading", ladingId);    // NEW
  await assertPostApprovalEditable(tx, organizationId, "lading", ladingId); // was context.db :1554
  // …values loop unchanged…
  // resolveLadingOrder(tx, …) instead of context.db (:1589, :1593)
  // step 15 Phase 3's gate call, kept and moved onto tx:
  //   if (typeof values.orderId === "string" && values.orderId !== row.orderId)
  //     await assertGateCleared(tx, organizationId, "collective_order", values.orderId, "create_lading");
  // …status redirect, update, containers, audit row unchanged…
});

// deleteAttachment (D3-B) — load, guards and row write in one transaction; R2 delete stays after it
await context.db.transaction(async (tx) => {
  const row = await loadScoped(context, "lading", lading, {...}, input.ladingId, { tx, forUpdate: true });
  await assertNotUnderReview(tx, organizationId, "lading", input.ladingId);
  await assertPostApprovalEditable(tx, organizationId, "lading", input.ladingId);
  // requireEntry, filtered write, audit row — unchanged
});
```

`packages/api/src/modules/audit/resources.ts`, `lading.exists`: `.for("update")` on its select, unconditionally, on the step 08 Task 1.2 pattern. It is taken at `submit.ts:39`, before the open-attempt check, so submit and `update` serialize on the lading row. **Step 16 Task 1.2 adds it (X17); this plan's Task 1.2 only confirms it by grep.**

`loadScoped` computes scope on `context.db` and reads the row on `tx` (`procedures/org.ts:458-466`), so the NOT_FOUND-before-CONFLICT house rule (`gates.ts` doc) holds.

**Why the state verbs are not frozen under review.** A reviewer approves the bill's content. Checking it in or holding it records what happened to the paper, and the tenant already decides per verb, through the eight gates, whether a move needs approval. Freezing them under review would stop cargo work for the length of every review.

**Docblocks.** `modules/audit/gates.ts` `assertNotUnderReview` (`:103-129` region, after step 08 Task 1.3's rewrite): add `lading.update` and `lading.deleteAttachment` to the callers named there. `schema/audit.ts:356-360`: no change (lading delete already refuses).

### 4.3 One state move, one locked row (Journey 3; Phase 2) → D5, D6

`applyWorkflow` (`lading.ts:601-678`) becomes one transaction:

```ts
return context.db.transaction(async (tx) => {
  const row = await loadScoped(context, "lading", lading, {...}, ladingId, { tx, forUpdate: true });
  const blocked = step.precondition(row);
  if (blocked) throw new ORPCError("CONFLICT", { message: blocked });
  // the eight literal assertGateCleared calls, unchanged except tx for context.db
  // (literals kept: gates.test.ts:67 scans for them)
  const now = new Date();
  const patch = { ...statusAfter(row, step.patch(row, now, reason)), circulationAt: now, circulationBy: … };
  await tx.update(lading).set(patch).where(eq(lading.id, ladingId));
  await writeAuditRaw(tx, { … });
  return { success: true as const, action, label: step.label };
});
```

`circulate` keeps its per-row loop; each row gets its own transaction, so one refusal still does not undo the others (its documented contract, `:1667-1668`). Architecture allow-list key `routers/lading.ts :: applyWorkflow :: update(lading)` (`packages/api/src/architecture.test.ts:320`) is unchanged: the write stays in the same function.

**D6-A precondition.** `check-out`'s precondition becomes:

```ts
precondition: (row) =>
  row.checkedOutAt ? "Already checked out"
  : row.heldAt ? "On hold — release the hold before checking out"
  : null,
```

Nothing else changes: Hold after Check Out stays allowed (a released bill can still be detained at destination), and Check Out without Check In stays allowed (D6 lists it as option C's extension only).

### 4.4 The attachment list (Journey 3 step 4; Phase 2) → D5

`uploadAttachment`: scope check first (read only, as today, so a foreign id is NOT_FOUND before any R2 write), then `bucket.put`, then **one transaction** that re-loads the row with `loadScoped({ tx, forUpdate: true })`, appends to the fresh `attachments`, writes and audits. `deleteAttachment` already moves into a locked transaction in §4.2. A failed transaction after `bucket.put` leaves an orphan object, which is today's accepted failure mode for delete (`:2098-2100`).

### 4.5 Fields the system owns (Journey 4; Phase 2) → D4, D8

**Settled 2026-09-21: every bullet below except the last is delivered by step 16 Phase 1** (its D3-A for `auditStatus` under X19; its D1-A with the echo rule for statuses under X18, which supersedes this plan's D8). The bullets are kept as what Task 2.3 and Task 2.5 confirm by grep. Where step 16 differs, step 16 wins: it refuses `released` as well as `on-hold` and `amended`, uses its own §4.1 sentences, drops a `status` equal to the loaded one **before** checking it (the edit form resends the loaded status on every save, `$id/edit.tsx:348, 666, 690`, so a refusal without that rule would refuse every edit of a held bill), and shows a non-settable stored status read-only instead of in the Select.

- `lading.ts` `ladingFields` (`:330`) and `ladingUpdateInput` (`:424`): remove `auditStatus`. `create`'s insert (`:1128`) writes `auditStatus: null`. zod strips unknown keys, so an old client that still sends it is ignored, not refused.
- `create` and `update`: refuse workflow-owned statuses with BAD_REQUEST (step 16's `assertSettableStatus`, `modules/lading/status.ts` [NEW in step 16]). `update`'s existing redirect for held or amended bills (`:1604-1607`) stays.
- `create.tsx`: drop the **Audit Status** select (`:1292-1307`), the schema key (`:117`) and the default (`:248`); `STATUS_OPTIONS` (`:140`) becomes `["draft", "confirmed", "cancelled"]`.
- `$id/edit.tsx`: same (select `:1558`, schema `:127`, defaults `:302`, seed `:401`, SECTIONS key `:600`, `STATUS_OPTIONS` `:165`); a stored `on-hold`, `amended` or `released` renders read-only, and `handleSubmit` omits an unchanged `status`.
- The record page (`lading-record.tsx:212`), the ledger column and filter keep reading `audit_status`: it is now written only by `repaintCache`.

### 4.6 Hold reason (Journey 3 step 2; Phase 2) → D7

A small reason dialog (reuse `useRejectReason` from `components/reject-reason-dialog` (already used at `lading/index.tsx:391`), or the Reject dialog shape in `review-menu.tsx`, whichever the implementer finds already exported) on **Hold** in the bill toolbar and on the row menu's **Hold** item. Cancel closes without holding; an empty reason holds with no reason. `hold.mutate({ ladingId: id, reason })` and `circulate({ ladingIds: [id], action: "hold", reason })`. No server change.

### 4.7 Data model

**No schema change under any recommended option.** Every column used exists (`schema/lading.ts:180, 190, 211-232`).

### 4.8 API contracts (input shapes unchanged except where stated)

Journey steps served: Journey 1 → `auditReview.submit/decide*`, `lading.get`; Journey 2 → `lading.update`, `auditReview.retractByResource`; Journey 3 → the eight verbs, `circulate`, attachment writers; Journey 4 → `lading.create`, `lading.update`.

| Procedure | Change | New refusals |
|---|---|---|
| `lading.get` | output gains `underReview: boolean` (D10-B) | – |
| `lading.update` | **all by step 16 Phase 1** (X17–X19): one transaction; row lock; under-review freeze; post-approval check moved onto `tx`; order resolution and step 15's `create_lading` gate on `tx`; input loses `auditStatus`; refuses workflow statuses after dropping an echo. This plan changes nothing here | (step 16's) CONFLICT under review; BAD_REQUEST workflow status |
| `lading.create` | **by step 16 Phase 1**: input loses `auditStatus`; refuses workflow statuses | (step 16's) BAD_REQUEST workflow status |
| `lading.deleteAttachment` | row lock; under-review and post-approval freeze (D3-B) | CONFLICT |
| `lading.uploadAttachment` | row lock on the list write | – |
| `lading.checkIn` … `cancelHold`, `circulate` | load, precondition, gate and write in one locked transaction (D5-A); `check-out` refuses a held bill (D6-A) | CONFLICT `On hold — release the hold before checking out` |
| `auditReview.submit` for `lading` | row lock in `exists` | – |

Refusal order a caller sees on `lading.update` (step 16's, per X22): NOT_FOUND → BAD_REQUEST status (a change only) → FORBIDDEN branch (a change only) → CONFLICT under review → CONFLICT approved-and-locked → step 15's `create_lading` CONFLICT (step 16 §4.9). No test in either plan asserts the relative order of status against under review.

### 4.9 Key decisions (all Open; §9 keeps the three approaches of each)
All Decided 2026-09-21; the heading is kept as written.
- Submit on the bill page → D1-A · owner of the `update` freeze → D2-B (step 16, per X17) · attachments → D3-B · Audit Status field → D4-A (done by step 16, X19) · serialization → D5-A · release while held → D6-A · hold reason → D7-A · workflow statuses → D8 superseded by step 16 D1-A (per X18) · remarks after approval → D9-A · notice → D10-B · residue → D11-A · submit scope → D12-A.

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- Steps **08 (Phases 1–3)**, **10 (Task 1.2)**, **15 (Phases 1–3)** and **14 Phase 1** merged into the base branch (§7.6). **All of step 16 merged** (crosscheck X17): it rebuilds `lading.update` with the freeze and lock, adds the `lading.exists` lock, edits `create.tsx` and `$id/edit.tsx`, and creates `lading.concurrency.test.ts` and `lading.under-review.test.ts`, which this plan extends. Step 16 Phase 1 must also be **deployed** before this plan's Phase 1 deploys.
- D1, D2 (B), D3 and D10 are Decided (2026-09-21). Re-check probes 17-P1 and 17-P2 before Task 1.3; if they contradict the choices, stop and re-plan.
- Re-locate every anchor in `lading.ts`, `resources.ts`, `$id/index.tsx`, `$id/edit.tsx`, `create.tsx` **by symbol** at the base commit.

### Phase 1 — A bill can be sent for review, and cannot be rewritten while it is read (Findings A, B)

**Delivers:** Journeys 1 and 2 end to end.
**Why one phase.** Shipping the Submit without the freeze opens step 15's finding A for ladings. Under D2-B (X17) the `update` freeze and lock already shipped with step 16 Phase 1, which is harmless without a Submit; this phase's own freeze (`deleteAttachment`) and the Submit merge and deploy together, API before web, and only after step 16 Phase 1 is deployed.
**Dependencies:** as above. D1, D2 (B), D3, D10 Decided.

- **1.1** **Confirm, do not rebuild, `lading.update`.** Grep the handler for the one locked transaction, `assertNotUnderReview(`, `.for("update")` on the scoped load and step 15 Phase 3's literal `create_lading` call on `tx` (step 16 Task 1.2, X17). All four must be there; if any is missing, stop: the prerequisite has not landed. Add no second guard or lock. Then add the `deleteAttachment` guards (D3-B, §4.2) and `lading.get.underReview` (D10-B), and name both lading callers (`lading.update`, from step 16, and `lading.deleteAttachment`) in the `gates.ts` docblock in one edit. Files: `packages/api/src/routers/lading.ts`, `packages/api/src/modules/audit/gates.ts` (docblock only). · **Agent A (backend)**
- **1.2** **Grep only:** confirm `.for("update")` in `REVIEWABLE_RESOURCES.lading.exists` (step 16 Task 1.2, X17). No edit; if it is missing, stop. Files: none written (`packages/api/src/modules/audit/resources.ts` read only). · **Agent A (backend)**
- **1.3** Tests, added to **`packages/api/src/routers/lading.under-review.test.ts`, which step 16 Task 1.3 creates** (X20; not [NEW] here). Seed submissions by raw insert the way `audit-review.test.ts:1078-1110` does. Under X17 step 16 already covers case 1, case 3, case 6 and the `update` half of case 2; this task adds **the `deleteAttachment` half of case 2, and cases 4, 5, 7 and 8**, and re-runs the rest unchanged. Cases (numbering kept):
  1. `under_review` → `update` (a field change, a `containers` replace, an `orderNo` re-link) CONFLICT; re-read the row, containers and `audit_log` to prove nothing was written.
  2. `withdrawal_under_review` → `update` and `deleteAttachment` CONFLICT.
  3. `rejected`, `withdrawn`, never submitted → `update` succeeds.
  4. `passed` under a `postApprovalEditable: false` flow → `update` and `deleteAttachment` CONFLICT with the approved message; `uploadAttachment` succeeds (D3-B; stub the bucket as `lading.test.ts` does).
  5. Under review → `checkIn` and `hold` still succeed (§4.2 "Why the state verbs are not frozen").
  6. Foreign-scope id → `update` NOT_FOUND before CONFLICT.
  7. `get` returns `underReview: true` under `under_review`, `false` never submitted, `false` when `audit_status = 'pending'` was hand-written with no submission.
  8. With `create_lading` ticked on the order flow (step 15 Phase 3), re-linking to an unapproved order through `update` is still refused (regression of 15's call after the move).

  **Real-Postgres test:** the submit-vs-update interleave in `packages/api/src/routers/lading.concurrency.test.ts` is **step 16 Task 1.3's** (X20; that plan creates the file). This task writes none; it re-runs the file on the dev branch with `DATABASE_URL_TEST` and confirms its tests are listed, not skipped. No PGlite lock test (PGlite serializes every transaction on one connection; step 15 §5 Task 1.4 explains why such a test passes on old code). Files: `packages/api/src/routers/lading.under-review.test.ts`. · **Agent A (backend)**
- **1.4** Web: `<ReviewMenu>` in the bill toolbar (§4.1), the under-review notice on the bill page, Save disabled on the edit page. Files: `apps/web/src/routes/_next/lading/$id/index.tsx`, `apps/web/src/routes/_next/lading/$id/edit.tsx`. · **Agent B (frontend)**

**Acceptance.**
- In the browser, a branch manager submits a bill from its page, sees the notice and a disabled Save, withdraws, edits, resubmits; a director approves it in `/approve/lading` (§10 Journeys 1–2).
- `lading.under-review.test.ts`, `lading.test.ts`, `audit-review.test.ts`, `modules/audit/gates.test.ts` and both architecture tests pass, judged by reading the output for `failed`. `lading.concurrency.test.ts` (step 16's) still passes on the dev branch with `DATABASE_URL_TEST` set (its tests are named in the output, not skipped).

### Phase 2 — Each move happens once, and the record says only what is true (Findings C–H)

**Delivers:** Journeys 3 and 4 end to end.
**Dependencies:** Phase 1 merged (hands off `lading.ts`, `$id/index.tsx`, `$id/edit.tsx`). D4–D9, D11 Decided (D8 superseded by step 16 D1, X18). Re-check probe 17-P4 before Task 2.1 (D6) and 17-P6 before Task 2.3 (now a confirmation of step 16 D1).

- **2.1** `applyWorkflow` in one locked transaction (§4.3, D5-A); the D6-A precondition. Files: `packages/api/src/routers/lading.ts`. · **Agent C (backend)**
- **2.2** `uploadAttachment` list write under the row lock (§4.4). Files: `packages/api/src/routers/lading.ts`. · **Agent C (backend)**
- **2.3** **Grep only** (X18, X19): confirm step 16 Phase 1 removed `auditStatus` from `ladingFields`, `ladingUpdateInput` and the create insert, and that `create` and `update` call `assertSettableStatus` after dropping an echo. If both are in place, this task writes no code; say so in the commit message. If either is missing, stop: step 16 Phase 1 has not landed. Files: none written (`packages/api/src/routers/lading.ts` read only). · **Agent C (backend)**
- **2.4** Tests:
  - `lading.test.ts`: `checkOut` on a held bill → CONFLICT with the D6 sentence; after `cancelHold` → succeeds; `hold` after `checkOut` → succeeds. The `auditStatus` and workflow-status cases are step 16 Task 1.3's (X18, X19) and are re-run, not re-written. The existing held-bill edit case (`:716-725` at `6bb3a1bf`) now writes `status: "confirmed"`, not `released` (step 16 Task 1.3 changed that pin); it must still land in `statusBefore`.
  - `lading.concurrency.test.ts` (created by step 16 Task 1.3, X20; not [NEW] here), new `describe`s: two `checkIn` calls interleaved on two connections → one success, one CONFLICT, one `lading.check-in` audit row; `hold` racing `amend` → final `status` is `on-hold`; two `uploadAttachment` calls → two entries. Each seen failing against the pre-Task-2.1/2.2 code first.
  - Re-run `audit-review.test.ts` (the `:1175` detention case now runs its gate read on `tx`) and `modules/audit/gates.test.ts` (`:67` literal-caller scan).
  Files: `packages/api/src/routers/lading.test.ts`, `packages/api/src/routers/lading.concurrency.test.ts`. · **Agent C (backend)**
- **2.5** Web: Hold reason dialog on the bill toolbar and the row menu (§4.6). The **Audit Status** and **On-hold** removal is step 16 Task 1.4's (X18, X19): grep `apps/web/src/routes/_next/lading` for `auditStatus`, the label "Audit Status" and `STATUS_OPTIONS`, confirm the options are `["draft", "confirmed", "cancelled"]`, and drop that half of this task. Do not re-add Released. Update `-lading-edit-sections.test.ts` and `-lading.columns.test.tsx` only if they fail. Files: `apps/web/src/routes/_next/lading/$id/index.tsx`, `apps/web/src/routes/_next/lading/index.tsx`, `apps/web/src/routes/_next/lading/-lading.columns.tsx`, and the two test files if needed (`create.tsx` and `$id/edit.tsx` read only). · **Agent D (frontend)**
- **2.6** Drift report (D11-A): `packages/db/scripts/audit-lading-review-drift-2026-09.sql` [NEW] containing probes 17-P4, 17-P6 and 17-P7 as counts plus row lists. 17-P3 is left out: it is 16-P3, already in step 16's `audit-lading-state-drift-2026-09.sql` (X25). `packages/db/scripts/` is created by step 08 Task 3.5. Run it read-only on the dev branch and paste the counts in the PR. Files: that script. · **Agent C (backend)**

**Acceptance.**
- In the browser: a double press checks in once; Hold with a reason shows it; Check Out on a held bill is refused; neither form shows Audit Status or On-hold, as step 16 left them (§10 Journeys 3–4).
- The tests above pass (read for `failed`); the concurrency describes pass on the dev branch and were seen failing without the change.
- `e2e/specs/lading.golden-path.spec.ts` and `e2e/specs/audit.review-queue.spec.ts` pass.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.3 | `packages/api/src/routers/lading.ts`, `packages/api/src/modules/audit/gates.ts` (docblock), `packages/api/src/routers/lading.under-review.test.ts` (created by step 16) | `packages/api/src/modules/audit/resources.ts` (grep, X17), `packages/api/src/routers/lading.concurrency.test.ts` (step 16's; re-run only), `packages/api/src/procedures/org.ts`, `packages/api/src/modules/audit/shared.ts`, `packages/api/src/modules/audit/submit.ts`, `packages/api/src/modules/audit/post-approval.ts`, `packages/api/src/routers/audit-review.test.ts`, `packages/api/src/routers/expense.concurrency.test.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.4 | `apps/web/src/routes/_next/lading/$id/index.tsx`, `apps/web/src/routes/_next/lading/$id/edit.tsx` | `apps/web/src/components/review-menu.tsx`, `apps/web/src/lib/audit-review.ts`, `apps/web/src/architecture.test.ts` |

opus / high for A: it must confirm, without duplicating, the locked transaction and gate call step 16 built in a money-governed handler (X17), and add a second frozen writer (`deleteAttachment`) and an engine-driven field on the same router.
Run mode: **A (Task 1.1's `get.underReview`) → B**, then A's tests ∥ B. Contract: `lading.get` output gains `underReview: boolean`; B starts once `bun run check-types` sees it.
Serialization point: `bun run check-types` (read the output), then `bunx vp test run` on the Phase 1 suites; restart `:3000` before the browser walk.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | opus | high | 2.1–2.4, 2.6 | `packages/api/src/routers/lading.ts`, `packages/api/src/routers/lading.test.ts`, `packages/api/src/routers/lading.concurrency.test.ts`, `packages/db/scripts/audit-lading-review-drift-2026-09.sql` [NEW] | `packages/api/src/modules/audit/gates.test.ts`, `packages/api/src/architecture.test.ts` |
| Agent D (frontend) | frontend-engineer | sonnet | medium | 2.5 | `apps/web/src/routes/_next/lading/create.tsx`, `apps/web/src/routes/_next/lading/$id/edit.tsx`, `apps/web/src/routes/_next/lading/$id/index.tsx`, `apps/web/src/routes/_next/lading/index.tsx`, `apps/web/src/routes/_next/lading/-lading.columns.tsx`, `apps/web/src/routes/_next/lading/-lading-edit-sections.test.ts`, `apps/web/src/routes/_next/lading/-lading.columns.test.tsx` | `apps/web/src/components/review-menu.tsx`, `apps/web/src/components/lading/lading-record.tsx` |

opus for C: three concurrency changes on one router, each needing a real-Postgres interleave test that must first be seen failing.
Run mode: C ∥ D. There is no server contract between them: the `auditStatus` and workflow-status rules are step 16's and already merged (X18, X19); D does not wait on C.
Handoffs: `lading.ts`: Agent A → Agent C. `lading.concurrency.test.ts`: step 16 Agent A → Agent C (X20). `$id/index.tsx`, `$id/edit.tsx`: Agent B → Agent D.

**Schedule:** Phase 1 → Phase 2, sequential (shared `lading.ts` and the two web files).
**Serialization points:** after each phase, `bun run check-types` and grep the output for `error TS` and `failed` (it can exit 0 while printing "failed"); both architecture tests; restart `:3000` (`bun --hot` does not reload `packages/api`).
**Commits:** the worktree may be shared. One committer at a time; confirm the index is empty before `git add`, and read every hunk.

**Smell test.**
- [x] Every task has exactly one owner.
- [x] No file is owned twice within a phase.
- [x] The A → B contract is named (`get.underReview`).
- [x] Every opus is justified; no haiku.
- [x] Each phase completes journeys (1–2, 3–4).

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`, 2026-09-21)

- **`lading.update`.** Web: `routes/_next/lading/$id/edit.tsx:429` (toasts `err.message` at `:451`). Tests: `lading.test.ts` (edit cases including `:721`), `lading-parties-backfill.test.ts`. E2E: `lading.golden-path.spec.ts:133` (Save Changes on a never-submitted bill; unaffected). Seed: none found for update. Step 15 Phase 3 adds the `create_lading` call.
- **`lading.create`.** Web `create.tsx` (Create Bill of Lading); `e2e/specs/audit.review-queue.spec.ts:121`, `lading.golden-path.spec.ts:85`; seed `seed/operations.ts` `ensureLadings`. None sends `auditStatus` (grep over `e2e`, `seed`, `packages/api/src/routers/*.test.ts`) and none sends `status: "on-hold"`.
- **`lading.get`.** Readers: `$id/index.tsx:68`, `$id/edit.tsx` (seed of the form). One additive field.
- **The eight verbs and `circulate`.** Web `$id/index.tsx:164-219`, `lading/index.tsx:433-462`. Tests `lading.test.ts:564-810`, `audit-review.test.ts:1175-1220`, and `lading.test.ts:173-240` (node checks). Signatures unchanged.
- **Attachments.** Web `$id/index.tsx:233-294`. Tests in `lading.test.ts` (attachment cases; the bucket stub). Signatures unchanged.
- **`REVIEWABLE_RESOURCES.lading.exists`.** Only caller `submit.ts:39`. Return shape unchanged.
- **`auditStatus` input key.** Only the two forms send it. The **list** input `auditStatus` (`lading.ts:442`) is a filter and stays.
- **`<ReviewMenu>`.** New importer `$id/index.tsx`; `apps/web/src/architecture.test.ts:939` requires `engineReview(...)` binding, which §4.1 uses.
- **Architecture allow-list** (`packages/api/src/architecture.test.ts:320-329`). Keys are per function and write; no function gains or loses a write, so no key changes. The "money write on a transaction handle" rule is still met (every write stays on `tx`).

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| Submit a bill from the screen | impossible | Review menu on the bill | Web before API: the menu works (engine already accepts ladings); `update` is already frozen by step 16 P1 (X17), but `deleteAttachment` is not and there is no notice. **Deploy API first, and only after step 16 P1 is deployed.** |
| Edit a bill under review | 200 | 409; Save disabled | API first: 409 toast before the notice ships; correct but unexplained |
| Delete a scan under review / after approval | 200 | 409 | API-only |
| Ticked lading gate | permanent refusal | refusal until approved | – |
| Double Check In | two writes | one write, one CONFLICT | API-only |
| Check Out while held | 200 | 409 (D6-A) | API-only |
| Save a form with Audit Status set | written | ignored (field gone) | Changed by step 16 Phase 1 (X19), not this plan |
| Save with Status = On-hold | written | 400 (field gone from form) | Changed by step 16 Phase 1 (X18), not this plan; an unchanged echo is dropped, not refused |
| Hold | no reason | optional reason | Web-only |

### 7.3 Behaviour change for existing orgs and live bills

- **Phase 1 changes every org at once**, because the lading flow is seeded enabled:
  - Bills can be submitted, so bills become frozen under review and, once approved, frozen against editing (seeded `postApprovalEditable: false`), **including the two remark fields** (D9). 17-P1 shows which orgs have the flow enabled and how it is set.
  - Any org that has ticked a lading gate (17-P1) stops being stuck: its bills can now be approved. Until each bill is approved, the refusal stays.
  - Orgs whose lading stage has no reviewer rows (no `director` role when seeded; `seed.ts` doc above `seedAuditFlows`) would get submissions nobody can decide. Step 08 Phase 2 (D2-A there) refuses such a submit; 17-P1's `reviewer_rows` sizes it.
  - Bills already submitted over RPC or by the seeder (17-P2) become frozen against `update` the moment **step 16 Phase 1** deploys (X17; its release note carries this line), and against `deleteAttachment` when this Phase 1 deploys.
- **Phase 2**: hand-written audit statuses stay as they are (D11-A) until the engine next repaints the bill; **On-hold** set by hand stays, shown read-only by step 16's edit form; a held bill can no longer be checked out (D6-A; 17-P4 counts bills that are held and released today).

### 7.4 Nullable assumptions

- `lading.audit_status` is nullable (`schema/lading.ts:190`); NULL means never submitted to the list filter (`lading.ts:745`). After D4-A only `repaintCache` writes it.
- `lading.attachments` may be NULL; every writer already reads `?? []`.
- `lading.held_reason` nullable; an empty reason from the dialog stays NULL.
- `lading.order_id` nullable; the step 15 gate on `update` runs only on a changed, non-null link.

### 7.5 Deployment coupling

- Phase 1: API before web (required), and only after step 16 Phase 1 is deployed (its `update` freeze and `exists` lock, X17). A web-first deploy lets a bill be submitted while `deleteAttachment` is still unfrozen.
- Phase 2: API and web independent; API first is cleanest (§7.2).
- Build `apps/web` before deploy so a failed deploy does not split server and web (memory `alchemy-partial-deploy-splits-the-stage`).

### 7.6 Merge order against steps 04–27

| Plan / task | Shared code | Why step 17 goes after (or before) |
|---|---|---|
| **08 Task 1.2** | `resources.ts` (`quotation.exists` lock) | Task 1.2 here copies the pattern into `lading.exists`. **Must merge first.** |
| **08 Task 1.3** | `gates.ts:103-129` docblock | Task 1.1 appends lading callers to the rewritten text. |
| **08 Tasks 2.1–2.7** | `resources.ts` (`separationOfDuties: false` on `lading`), `submit.ts` (refuse a submit nobody can decide) | The lading entry changes shape; the submit refusal protects orgs with no director (§7.3). **Must merge first.** |
| **08 Task 3.5** | creates `packages/db/scripts/` | Task 2.6 adds a sibling script. |
| **10 Task 1.2** | `resources.ts` (`onPassed?`), `submit.ts` | Same file and type. **Must merge first.** |
| 07 Task 3.3 | `ReviewableResource.assertPublishable?`, `submit.ts` | Different member; rebase by symbol. |
| **15 Phase 1** | `resources.ts` `collective_order.exists` lock beside `lading.exists`; `gates.ts` docblock | Neighbouring lines. **Must merge first.** |
| **15 Phase 2** | `resources.ts` `collective_order` entry | Neighbouring lines. **Must merge first.** |
| **14 Phase 1** | `resources.ts` (`readinessProblem` via 07's hook, X9) | Same file. **Must merge first.** |
| **15 Phase 3** | `lading.ts` `create` and **`update`** (`create_lading` gate calls, on `context.db`) | **Must merge first.** Step 16 Task 1.2 moves 15's `update` call onto `tx` inside the new transaction and keeps its literal key (`gates.test.ts:67`) (X17). This closes the race step 15 logged as owned by 16/17. This plan's Task 1.3 case 8 pins it. |
| **16** (`step-16-lading-create.md`) | `lading.ts` `create`/`update`, `resources.ts` `lading.exists`, `create.tsx`, `$id/edit.tsx`, `lading/index.tsx`, `lading.test.ts`, `lading.concurrency.test.ts` [NEW in 16], `lading.under-review.test.ts` [NEW in 16] | **All of step 16 merges before 17 P1** (crosscheck X17, settled 2026-09-21). Step 16 owns the `update` freeze, `FOR UPDATE` load, in-transaction guards and the `exists` lock (this plan's D2-B); its D1 supersedes this plan's D8 (X18); it removes the Audit Status select and input, so Tasks 2.3 and 2.5 drop that part (X19); it creates both test files this plan extends (X20). 17 re-locates by symbol. |
| 12 D4 (C recommended) | `lading.order_no` renumber propagation | No code under 12 D4-C. |
| 13 | To Receive half of `dead-queues` | No shared file. |
| 18 | `$id/index.tsx` (`OrderDocumentsCard`, the Documents break), documents pipeline | Different region of the same file. Either order; the second rebases. |
| 19 | tracking payload, possibly a card on the bill page | Same as 18. |
| 20–27 | cost lines, bills, invoices, payments, close | No shared code found: none reads the lading state stamps or `audit_status`. |

**Required order:** 08 (Phases 1–3) → 10 (Task 1.2) → 11 P2 → 12 P1 → 15 P1 → 15 P2 → 14 P1 → 15 P3 → 16 → **17 P1 → 17 P2**. One phase per worktree, sequentially.

### 7.7 Read-only production probes (SELECT only; Wilfred runs with the owner's override; none blocks writing code)

```sql
-- 17-P1 Lading flow per org: enabled, post-approval lock, withdrawal mode, ticked gates, reviewer rows (D1, D2, D9; §7.3)
select f.organization_id, f.id as flow_id, f.enabled, f.post_approval_editable, f.withdrawal_mode,
       (select string_agg(g.gate_key, ',' order by g.gate_key) from audit_flow_gate g where g.flow_id = f.id) as gates,
       (select count(*) from audit_flow_stage s join audit_flow_reviewer fr on fr.stage_id = s.id
         where s.flow_id = f.id) as reviewer_rows
from audit_flow f where f.trigger_type = 'lading'
order by f.organization_id;

-- 17-P2 Bills by latest submission (what Phase 1 freezes on deploy; RPC/seeder use)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'lading'
  order by resource_id, submitted_at desc, created_at desc)
select la.organization_id, coalesce(l.status, 'never_submitted') as latest, count(*) as bills
from lading la left join latest l on l.resource_id = la.id
group by 1, 2 order by 1, 2;

-- 17-P3 Audit-status cache that disagrees with the engine (hand-written through the forms; D4, D11)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'lading'
  order by resource_id, submitted_at desc, created_at desc)
select la.organization_id, la.audit_status, coalesce(l.status, 'none') as latest, count(*)
from lading la left join latest l on l.resource_id = la.id
where coalesce(la.audit_status, '') <> case l.status
        when 'under_review' then 'pending' when 'passed' then 'approved'
        when 'rejected' then 'rejected' when 'withdrawal_under_review' then 'withdraw_pending'
        when 'withdrawn' then 'withdrawn' else '' end
group by 1, 2, 3 order by 1, 2, 3;

-- 17-P4 Release while detained, and release without check-in (D6)
select organization_id,
       count(*) filter (where held_at is not null and checked_out_at is not null) as held_and_released_now,
       count(*) filter (where checked_out_at is not null and checked_in_at is null) as out_without_in,
       count(*) filter (where held_at is not null) as held_now
from lading group by 1 order by 1;
select organization_id, count(*) as checkouts_while_held
from audit_log
where action = 'lading.check-out' and (before_json::jsonb ->> 'heldAt') is not null
group by 1;

-- 17-P5 The same move recorded twice within 5 seconds with no cancel between (Finding D exercised; D5)
select a.organization_id, a.action, count(*) as doubled
from audit_log a
where a.action in ('lading.check-in', 'lading.check-out', 'lading.amend', 'lading.hold')
  and exists (select 1 from audit_log b
              where b.target_id = a.target_id and b.action = a.action and b.id <> a.id
                and b.created_at between a.created_at and a.created_at + interval '5 seconds')
group by 1, 2 order by 1, 2;

-- 17-P6 Workflow statuses that disagree with the stamps (hand-set On-hold, etc.; D8)
select organization_id, status, (held_at is not null) as held, (amended_at is not null) as amended, count(*)
from lading
where (status = 'on-hold' and held_at is null)
   or (status = 'amended' and amended_at is null)
   or (held_at is not null and status <> 'on-hold')
   or (held_at is null and amended_at is not null and status <> 'amended')
group by 1, 2, 3, 4 order by 1, 2;

-- 17-P7 Uploaded scans missing from their bill's list and never deleted (Finding E exercised)
select a.organization_id, count(*) as lost_entries
from audit_log a join lading l on l.id = a.target_id
where a.action = 'lading.attachment.upload'
  and not exists (select 1 from jsonb_array_elements(coalesce(l.attachments, '[]'::jsonb)) e
                  where e ->> 'key' = a.after_json::jsonb ->> 'key')
  and not exists (select 1 from audit_log d
                  where d.action = 'lading.attachment.delete' and d.target_id = a.target_id
                    and d.before_json::jsonb ->> 'key' = a.after_json::jsonb ->> 'key')
group by 1;

-- 17-P8 Edits that landed while a bill was under review (Finding B already exercised over RPC)
select s.organization_id, a.action, count(*) as edits, count(distinct s.resource_id) as bills
from audit_submission s
join audit_log a on a.target_id = s.resource_id
 and a.action in ('lading.update', 'lading.attachment.delete')
 and a.created_at > s.submitted_at and a.created_at < coalesce(s.resolved_at, now())
where s.resource_type = 'lading'
group by 1, 2 order by 1, 2;

-- 17-P9 Hold reasons ever recorded (Finding G; D7)
select organization_id, count(*) filter (where held_reason is not null) as with_reason,
       count(*) filter (where held_at is not null) as held_now
from lading group by 1 order by 1;

-- 17-P10 How often remarks are edited (D9: would the post-approval freeze bite?)
select organization_id, count(*) as remark_edits, count(distinct target_id) as bills
from audit_log
where action = 'lading.update'
  and (after_json::jsonb ?| array['checkedInRemark', 'checkedOutRemark'])
group by 1 order by 1;
```

**What each probe decides.** 17-P1 → D1, D2, D9 and the no-reviewer risk. 17-P2 → Phase 1 deploy impact. 17-P3 → D4, D11. 17-P4 → D6. 17-P5 → D5 urgency. 17-P6 → D8. 17-P7 → Finding E urgency. 17-P8 → how much Finding B has happened. 17-P9 → D7. 17-P10 → D9.

### 7.8 Blocking prerequisites

- Steps 08, 10 (Task 1.2), 15 (all phases), 14 Phase 1 and **all of step 16** merged — blocks every task (X17).
- Decisions: all settled 2026-09-21, so none blocks a phase any more. For the record, D1, D2, D3, D10 released Phase 1; D4–D9, D11 Phase 2; D12 nothing (A defers).
- `DATABASE_URL_TEST` for a dev Neon branch available to Agents A and C — blocks each phase's acceptance.
- Probe re-checks (a contradiction stops the task for a re-plan): 17-P1, 17-P2 before Task 1.3; 17-P4 before 2.1; 17-P6 before 2.3; 17-P10 before the D9 remark guidance goes into the SOP (D9-A stands unless it shows frequent edits).

## 8. Cross-Cutting Concerns

- **Errors.** State refusals are `ORPCError("CONFLICT")` with sentences that say what to do (withdraw first; release the hold first). Workflow-status input is BAD_REQUEST. Every guard sits after the scoped load, so a foreign id answers NOT_FOUND first. The edit form toasts `err.message` (`$id/edit.tsx:451`); the bill page's verbs rely on the global `MutationCache` net (`utils/orpc.ts:63`), which already shows server messages.
- **Testing.** PGlite router suites at the API boundary (`lading.under-review.test.ts`, created by step 16 and extended here, `lading.test.ts`, `audit-review.test.ts`); `gates.test.ts` literal-caller scan; both architecture tests; e2e `lading.golden-path.spec.ts`, `audit.review-queue.spec.ts`; browser proof in §10. Every lock is proven only by `lading.concurrency.test.ts` (created by step 16, X20; this plan adds three `describe`s) on real Postgres (dev branch), each test first seen failing on the old code.
- **Migration.** None.
- **Rollback.** Both phases are plain reverts; neither writes data. Reverting Phase 1 after bills were submitted leaves open submissions that nobody can see from the bill page but that `/approve/lading` still decides; that is safe.
- **Audit trail.** Refusals write nothing. A Hold reason is recorded in the `lading.hold` audit row's `after` (already, through `patch`).

**Performance & Scalability**
1. **Pagination.** Unchanged.
2. **SQL-side filtering.** Unchanged; `underReview` is one indexed read on `get`.
3. **N+1.** None added. `circulate` still loops per row (≤ 200), now one short transaction per row instead of a read plus a transaction.
4. **Index coverage.** Row locks by primary key; `latestSubmissionByResource` uses the same `audit_submission (organization_id, resource_type, resource_id)` path every freeze uses (index name not re-verified in this pass).
5. **Write atomicity.** After this plan every lading writer reads, guards and writes in one transaction, except `uploadAttachment`'s R2 put, which must precede the row write.
6. **Row locking.** `FOR UPDATE` on the lading row in `update`, the eight verbs, both attachment writers and at submit. Each lock lasts one short statement group. `update` with a `containers` replace holds it for the delete-and-insert, as today's transaction already does.
7. **Connections/resources.** None new. An upload holds no lock during the R2 put.
8. **Tenant isolation.** Every load keeps `applyScope`; `exists` keeps its org predicate.
9. **Payload size.** `lading.get` gains one boolean.
10. **Hot path.** The state verbs and `update` are daily-volume, single-row operations; the added lock and one indexed read are negligible.

## 9. Decision Register, Open Questions & Risks

**Statuses.** On 2026-09-21 Wilfred accepted the Recommended option of every decision below, and every cross-plan settlement in `steps-16-19-crosscheck.md` (X17–X27), so all twelve are **Decided**. Two settled X-items override this plan's own recommendation: **D2 is B, not A (per X17)**, and **D8 is superseded by step 16 D1 (per X18)**; §1, §4.2, §4.5, §4.8, §5 and §7.6 were edited to match. Each entry keeps its three approaches, its recommendation and its consequence table, so any of them can be re-opened by reading what was rejected. Where a decision leans on a production probe, the **Re-check** line stands: the choice holds, but the check is still required before the task that depends on it, and a contradiction stops the work for a re-plan. The grouping headings below ("Open — blocking Phase 1" and so on) are kept as written because headings are page anchors; they now say only which phase each decision released.

### Open — blocking Phase 1

**D1: Where does a bill get sent for review?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | **The bill page toolbar** (`$id/index.tsx`), a `<ReviewMenu>` beside Edit (Recommended) (Chosen) | One file. Matches the SOP's step ("open the bill"), where the state buttons already live. The ledger still has no review control. |
| **B** | Bill page **and** the ledger row's actions cell, like the order ledger | Submitting many bills is one click each from the list. Needs a noun prop on `ReviewMenu` (its `iconOnly` label says "order", `review-menu.tsx:139`) and edits `-lading.columns.tsx`, a 55-column model (`lading/index.tsx:437-438`). |
| **C** | Ledger row only | Mirrors orders exactly; the bill page, where documentation actually works, still cannot submit. |

- **Recommendation: A** — smallest change that closes the dead end; B can follow if 17-P2 shows volumes where per-row submit matters.
- **Releases:** Task 1.4.

**D2: Which plan adds the under-review freeze and row lock to `lading.update`?** · Status: **Decided 2026-09-21 — Chosen: B (per X17)** (step 15 hands it to "steps 16/17")

| | Approach | Consequence |
|---|---|---|
| **A** | **Step 17 Phase 1**, together with the Submit that makes it reachable, and `lading.exists`'s lock (Recommended) | The freeze and the Submit ship in one deploy, so there is no window where a bill can be submitted and rewritten. Step 16 adds no freeze. |
| **B** | Step 16, merged before 17 (Chosen, per X17) | The freeze lands while nothing can submit, so it protects only RPC use; step 17 then depends on 16 for the one guarantee its Submit needs. |
| **C** | Split: 16 adds the freeze, 17 the lock | Two plans in one handler; the lock and the guard it protects land in different deploys. Listed to name the failure. |

- **Recommendation (as written): A.** Step 16's plan must record the same owner.
- **Settled: B, per crosscheck X17 (2026-09-21), overriding this plan's recommendation.** Step 16 Phase 1 has to restructure the same handler anyway (its echo rule and branch check compare with the row loaded inside the transaction), and it merges and deploys first, so there is no window: the unsafe order is Submit without freeze, and freeze without Submit is harmless. Step 16's plan records the same owner. Tasks 1.1–1.3 were re-worded to grep for step 16's guard, lock and `exists` lock and add none.
- **Releases:** Tasks 1.1–1.3 (as greps).

**D3: Are a bill's attachments frozen while it is under review, and after approval?** · Status: **Decided 2026-09-21 — Chosen: B**

| | Approach | Consequence |
|---|---|---|
| **A** | Freeze upload and delete, exactly like `update` | Paperwork that arrives during a review (a release letter, a customs note) cannot be filed until the review ends; after approval under the seeded flow, never. Blocks step 17's own "record the paperwork" line. |
| **B** | **Freeze delete only; uploads stay open** (Recommended) (Chosen) | What the reviewer relied on cannot disappear; new paper keeps arriving. The reviewer may see a scan that was not there when they opened the bill, which adds evidence and removes none. |
| **C** | Leave both free | A scan can be deleted mid-review or after approval. |

- **Recommendation: B.**
- **Releases:** Task 1.1.

**D10: How does the bill page say it is under review?** · Status: **Decided 2026-09-21 — Chosen: B**

| | Approach | Consequence |
|---|---|---|
| **A** | Server refusal only; the edit page's existing toast explains | No new field. The user learns only after typing and saving. |
| **B** | **`lading.get` gains `underReview` from the engine; a notice on the bill page and Save disabled on the edit page** (Recommended) (Chosen) | Same pattern as step 15 D12 for orders. One indexed read per bill load. |
| **C** | Derive it from the `audit_status` cache | No server change, but the cache is hand-writable until Phase 2 and can be wrong afterwards (17-P3), so Save could be disabled on a bill the server accepts. |

- **Recommendation: B.**
- **Releases:** Tasks 1.1, 1.4.

### Open — blocking Phase 2

**D4: What happens to the Audit Status field on the forms?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | **Drop `auditStatus` from `create` and `update` inputs and remove the select from both forms; the record page keeps showing it read-only** (Recommended) (Chosen) | The engine is the only writer of the cache. Old clients' values are ignored. |
| **B** | Server ignores it; the forms keep a read-only display | Same safety; the form shows a field the user cannot change, which the record page already shows. |
| **C** | Leave it writable and document it | A bill can read Approved everywhere without a review; after Phase 1, the cache can contradict a live submission. |

- **Recommendation: A.** Re-check 17-P3 (= 16-P3) before Task 2.3.
- **Settled (X19):** A, and the code is step 16 D3-A's (its Phase 1). Tasks 2.3 and 2.5 drop the `auditStatus` part after grepping for it.
- **Releases:** Tasks 2.3, 2.5 (as greps).

**D5: How does a state move serialize?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | **Load, precondition, gate and write in one transaction with `FOR UPDATE` on the lading row** (Recommended) (Chosen) | The precondition and `statusAfter` read the row they write. Same shape as every other freeze in these plans; `loadScoped` already supports it. |
| **B** | Conditional update (`… where checked_in_at is null`) and count affected rows | No lock, but `statusAfter` still reads a stale `status`/`statusBefore`, so the hold-versus-amend case stays wrong, and eight different predicates to keep in step with the table. |
| **C** | Leave it | Doubled moves and wrong derived status remain possible (17-P5 sizes it). |

- **Recommendation: A.** The same choice applies to the attachment list (§4.4).
- **Releases:** Tasks 2.1, 2.2.

**D6: May a bill on Hold be checked out?** · Status: **Decided 2026-09-21 — Chosen: A** (a business rule; confirm against how the desk uses eyun)

| | Approach | Consequence |
|---|---|---|
| **A** | **Refuse Check Out while held: "On hold — release the hold before checking out"** (Recommended) (Chosen) | Release during detention needs a deliberate Cancel Hold first, which is itself audited and can be gated (`detention_cancel`). One precondition line. Differs from eyun's independent states. |
| **B** | Allow it, but the UI warns and asks to confirm | Keeps eyun parity; a warning is one more click that becomes habit. No server rule. |
| **C** | Leave it independent (eyun parity), optionally also refuse Check Out without Check In | Today's behaviour. A detained bill can be released by anyone holding the check-out node. |

- **Recommendation: A** — "A wrong consignee releases cargo to the wrong party" is the seeded flow's own note (`seed.ts:163`); releasing held cargo is the same class of loss. Re-check 17-P4 before Task 2.1: if the desk routinely checks out held bills, stop and re-plan.
- **Releases:** Task 2.1.

**D7: Does Hold ask for a reason?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | **An optional reason dialog on Hold, on the bill page and the row menu** (Recommended) (Chosen) | The existing `held_reason` column and record exception start working. One click more per hold. |
| **B** | A required reason | Every hold is explained; the dialog cannot be dismissed with an empty box, which slows urgent holds. |
| **C** | Leave it | `held_reason` stays dead (17-P9). |

- **Recommendation: A.**
- **Releases:** Task 2.5.

**D8: Can On-hold (and Amended) be typed as a status?** · Status: **Decided 2026-09-21 — Superseded by step 16 D1 (Chosen there: A) (per X18)**

| | Approach | Consequence |
|---|---|---|
| **A** | **Remove On-hold from both forms; `create`/`update` refuse `on-hold` and `amended` with BAD_REQUEST** (Recommended) | Hold and Amend own those statuses, so the stamps and the status cannot disagree. An old form that picks On-hold gets a 400 until web deploys. |
| **B** | Remove from the forms only | The RPC can still write it; nothing on screen can. |
| **C** | Leave it | A bill can read On hold with no hold, and Hold/Cancel Hold cycle it back to On hold (Finding H). |

- **Recommendation (as written): A.** Re-check 17-P6 before Task 2.3.
- **Settled: superseded by step 16 D1, per crosscheck X18 (2026-09-21).** No row above is chosen here. Step 16 D1-A governs the vocabulary for both plans: `draft`, `confirmed`, `cancelled` settable; `on-hold`, `amended`, `released` and unknown strings refused; a `status` equal to the row's current one is an echo and is dropped before the check. Option A as written would have refused every save of a held or amended bill, because the edit form resends the loaded status (`$id/edit.tsx:348, 666, 690`). Step 16 Phase 1 owns the code; Task 2.3 drops its status half and Task 2.5 its On-hold half; Journey 4, §4.5 and Task 2.4 were edited to match. 17-P6 is still re-checked before Task 2.3, as a confirmation of step 16 D1.
- **Releases:** nothing in this plan (Tasks 2.3 and 2.5 confirm by grep).

**D9: After approval, may the Checked-In / Checked-Out Remarks still be edited?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | **Accept the freeze (seeded `postApprovalEditable: false`); the SOP says to write the remarks before submitting, or ask an admin to set the flow editable** (Recommended) (Chosen) | No code. Consistent with every other resource. Remarks written after approval need a re-submission. |
| **B** | Exempt the two remark fields from the post-approval freeze in `update` | Remarks stay writable; a field-level exemption is new machinery in the engine's one rule. |
| **C** | Seed new orgs' lading flow with `postApprovalEditable: true` | Every approved bill stays fully editable in new orgs, which defeats the review for the consignee. |

- **Recommendation: A**, provided 17-P10 shows remarks are rarely edited. If they are edited often, B.
- **Re-check:** 17-P10. A stands; if it shows frequent remark edits, stop and re-plan toward B rather than absorbing it.
- **Releases:** nothing in code under A; the SOP text (an accepted unowned gap under X27, see Risks).

**D11: What happens to audit statuses already hand-written?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | **Report only (17-P3 in Task 2.6's script; under X25 the reading comes from 16-P3 in step 16's script)** (Recommended) (Chosen) | No production write. The engine repaints each bill on its next submission. |
| **B** | An owner-run statement repaints `audit_status` from the latest submission | Clean cache; a production data change. |
| **C** | Null every `audit_status` with no submission | Clean for the common case; loses nothing real, but still a production write. |

- **Recommendation: A** — the same answer Wilfred gave for quotations (step 08 D5-A) and orders (step 15 D13-A).
- **Releases:** Task 2.6.

### Open — non-blocking

**D12: Should submitting a bill respect the submitter's data scope?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | **Defer, together with step 15 D14 (accepted known gap, X13)** (Recommended) (Chosen) | No change here. RPC-only: the bill page only shows bills the caller can read. |
| **B** | Add `applyScope` to `lading.exists` | Needs the org context inside `exists`, which the `ReviewableResource` signature does not carry; an engine-wide change. |
| **C** | Check scope in `auditReview.submit` for every resource | The right place, but it is step 15 D14's question for all resources. |

- **Recommendation: A.**
- **Releases:** nothing.

### Risks

- **Bills submitted over RPC become frozen on deploy.** Certain where 17-P2 is non-zero (dev and e2e orgs at least). Under X17 the `update` freeze arrives with step 16 Phase 1's deploy (its release note carries the notice) and the `deleteAttachment` freeze with this Phase 1. → **Announce "withdraw before editing"; 17-P2 (= a re-run of 16-P4's first query) gives the count.**
- **An approved bill's remarks can no longer be edited.** Certain under D9-A in seeded orgs. → **SOP text for step 17 must say so; under X27 (settled 2026-09-21) that text change is an accepted unowned gap, on the same terms as steps 14–15 under X13.**
- **An org with no director role gets undecidable submissions.** Low, if step 08 Phase 2 has merged (its submit refusal); otherwise medium. → **Merge order §7.6; 17-P1 `reviewer_rows`.**
- **Step 16's plan also claims the `update` freeze.** Resolved: crosscheck X17 settled it on 2026-09-21 — step 16 owns it, this plan takes D2-B, and Tasks 1.1–1.2 grep and add nothing.
- **Moving step 15's `create_lading` call breaks its literal-caller scan.** Low; the move is step 16 Task 1.2's. → **Keep the literal key; `gates.test.ts:67` and this plan's Task 1.3 case 8.**
- **PGlite cannot prove any lock.** Certain. → **`lading.concurrency.test.ts` on the dev branch, each test first seen failing.**
- **A stale `:3000` makes browser checks pass on old code.** High. → **Restart after every `packages/api` change and check the process start time.**
- **Line numbers drift.** Certain (08, 10, 15, 16 edit the same files). → **Every task locates by symbol.**

### SOP text vs code (Phase 0 wins)

| # | SOP claims | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| 1 | Role: "Documentation · needs lading:read plus the gate for each verb" | No documentation role. The verbs need `lading.detail.workflow.<verb>` nodes (admin, branch-manager, ops through `lading.detail`, `roles.ts:92, 106, 166`); the buttons show on the flat `lading:update` (`$id/index.tsx:296-307`). A "gate" is an audit-flow key, unticked by default (`seed.ts:162`), not a permission | Code |
| 2 | "each behind its own gate" | Four permission nodes (each cancel shares its action's) but eight gate keys (`modules/lading/gates.ts:12-21`); no key is ticked for any new org | Code |
| 3 | "a checked-in bill offers Cancel Check In and nothing else" | Each of the four buttons flips independently; a checked-in bill still offers Check Out, Amend and Hold (`$id/index.tsx:364-403`). The comment at `:160-163` means "per state" | Code |
| 4 | "Per row … the list's tick-boxes drive review only" | The ledger `/lading` has no tick-boxes; the select column exists only on `/approve/lading` (`-lading.columns.tsx:816`). The row menu offers all eight moves on every row, whatever the state (`:700-717`) | Code |
| 5 | Watch: "no shipped screen can submit … the queue can only ever decide submissions that cannot be created" | True for screens. Submissions can be created over RPC (`auditReview.submit`, `audit-review.ts:355`); the seeder and `audit.review-queue.spec.ts:131` do. Also: a ticked lading gate is then a permanent freeze (Finding A) | Code (Phase 1) |
| 6 | Field note: Audit Status "is a cache column: no screen can queue a lading for review" | Worse: the value typed is written into the engine's cache and shown and filtered on as the review outcome (Finding C) | Code (D4) |
| 7 | "Add per-state notes in Checked-In Remark and Checked-Out Remark on the record" (`create.tsx:1311`) | The fields are on the create and edit forms, not on the record page, and after approval under the seeded flow the edit form refuses them (D9) | Code |
| 8 | Golden path cites `$id/index.tsx:191` (Amend), `:219` (export) | Amend's mutation is `:192`, its button `:384`; export's mutation is `:221` | none |
| 9 | "Hold for a detention" | Hold takes a reason server-side that no screen sends (Finding G); Check Out is not refused while held (Finding F) | Code (D6, D7) |

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000. One worktree's servers at a time.
**Preconditions:**
- A freshly seeded audit e2e org: `bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>`. Re-read `ACTORS` at the base commit (the file had uncommitted edits in the main tree, X16). At HEAD it seeds owner, directorA, directorB, accountant, salesperson, managerA, managerB, viewer. The walk uses:
  - **Submitter and mover: `managerA`** (branch-manager: flat `lading:*` plus `lading.detail`).
  - **Second mover: `managerB`** (same role), for the two-tab and concurrent-upload checks.
  - **Reviewer: `directorA`** (holds `lading.read` and `lading.review`, `roles.ts:218-219`; the seeded lading stage is `director`).
  - **Flow editor: `owner`.**
- A bill **B1** created by `managerA` (bill number `BL-S17-1`, one container, one attachment), not submitted.
- Confirm the actor with `fetch('/api/auth/get-session')` before each actor's steps (the session and active org are shared across sessions). Restart `:3000` after the last `packages/api` edit.

**Migrations:** none. Confirm the journal still ends where the merged steps left it and that those are applied (check `_journal.json` and the database, not an exit code).

**Test commands** (read each output for `failed` and the `Test Files` line):
- Phase 1: `bunx vp test run packages/api/src/routers/lading.under-review.test.ts packages/api/src/routers/lading.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/modules/audit/gates.test.ts packages/api/src/architecture.test.ts apps/web/src/architecture.test.ts`, then `DATABASE_URL_TEST=<dev branch URL> bunx vp test run packages/api/src/routers/lading.concurrency.test.ts` (confirm its tests ran, not skipped).
- Phase 2: the same list plus `apps/web/src/routes/_next/lading/-lading-edit-sections.test.ts apps/web/src/routes/_next/lading/-lading.columns.test.tsx`, then the concurrency file again.
- Every phase: `bun run check-types` (confirm `apps/web` ran), then `e2e/specs/lading.golden-path.spec.ts` and `e2e/specs/audit.review-queue.spec.ts`.

**Golden path — Journeys 1 and 2 (Phase 1)**
1. As `managerA`, navigate to `/lading`, open B1 → the toolbar shows **Check In, Check Out, Amend, Hold, Excel, PDF, Review, Edit**.
2. **Review → Submit for review** → toast _"1 row — submit for review"_; the record's **Audit Status** reads `pending`; the under-review notice is visible.
3. **Edit** → the notice is visible and **Save Changes** has the `disabled` attribute with the sentence in `title`.
4. In the console, POST `/rpc/lading/update` with `{ ladingId: B1, vessel: "S17 CHANGED" }` → HTTP 409, body contains _"This record is under review"_. GET B1 → `vessel` unchanged. POST `/rpc/lading/deleteAttachment` for B1's scan → 409; the scan is still listed.
5. On B1, **Check In** → _Checked in_ (verbs are not frozen under review).
6. As `directorA`, navigate to `/approve/lading` → B1 is listed. Tick it → **Approved** → toast _"1 lading(s) approved"_; the row leaves the queue. `/lading/<B1>` → Audit Status `approved`; no notice.
7. Journey 2: as `managerA`, create **B2**, submit it, then **Review → Request withdrawal** → toast; notice gone. **Edit** → change **Vessel**, **Save Changes** → saved; GET shows the new vessel. Submit again → Pending.

**Golden path — Journeys 3 and 4 (Phase 2)**
1. As `managerA` on B2 (withdraw it first), double-click **Check Out** quickly → one _Checked out_ toast, at most one _Already checked out_ error; Circle Time shows one move; `audit_log` on the dev branch has one `lading.check-out` row for B2 in that second. **Cancel Check Out**.
2. **Hold** → the reason dialog appears → type "Customs query" → confirm → _Put on hold_; the exception reads _On hold since … — Customs query_.
3. **Check Out** → error toast _"On hold — release the hold before checking out"_ (D6-A). **Cancel Hold** → _Hold released_. **Check Out** → _Checked out_.
4. `/lading` → B2's row menu → **Hold** → the same dialog; cancel it → nothing changes.
5. `/lading/create` → **Administration** has no **Audit Status**; **Status** has no **On-hold**. `/lading/<B2>/edit` → the same.
6. In the console, POST `/rpc/lading/create` with `status: "on-hold"` → 400; with `auditStatus: "approved"` → created, and GET shows `auditStatus: null`.

**Edge case 1: a ticked gate is no longer a dead end.** As `owner`, tick **Detention** on the Bill of lading review flow. As `managerA`, on a new bill B3, **Hold** → refused _"\"Detention\" requires review approval first"_. Submit B3; as `directorA` approve it; as `managerA`, **Hold** → _Put on hold_. Untick the gate afterwards.

**Edge case 2: approved bill is locked for content (D3-B, D9).** On B1 (approved, seeded `postApprovalEditable: false`): **Edit** → change **Checked-In Remark** → Save → error toast _"This record was approved and its content can no longer be edited"_. Upload a scan → _Attached …_ (D3-B). Delete a scan → 409.

**Edge case 3: concurrency (dev branch, not the browser).** Proven by `lading.concurrency.test.ts`: submit versus update, double check-in, hold versus amend, two uploads. Judged by results and final state (row, `status`, `attachments`, audit rows), never by timestamps (`created_at` and `submitted_at` default to the transaction start). Each test recorded failing against the code before its task.

**Edge case 4: two tabs, two movers.** `managerA` and `managerB` both open B2 with Check In showing; `managerA` presses it, then `managerB` → `managerB` gets _"Already checked in"_ and, after the refetch, sees **Cancel Check In**.

**Regression checks.**
1. `lading.golden-path.spec.ts` (create, read, edit on a never-submitted bill) passes unchanged.
2. `/approve/review` still lists a lading submitted over RPC (`audit.review-queue.spec.ts`).
3. Excel and PDF export on B1 still download (_Exported …_).
4. With `create_lading` ticked on the order flow (step 15), re-linking a bill to an unapproved order through Edit is still refused.
5. `/order/sea-export` row Review menu still submits an order (shared `ReviewMenu` untouched).

**Mobile:** at 400px the bill toolbar wraps (eight buttons) without horizontal page scroll; the under-review notice and the Hold reason dialog fit; the disabled Save still exposes its reason on tap.

**Readiness: 7/10 — the defects are verified at HEAD and each fix is small and testable at the API boundary; every decision is settled (2026-09-21) and the ownership with step 16 is fixed by X17–X22, but the plan stands on all of step 16 and several other unmerged plans, and the locks can only be proven on a dev database.** Outstanding:
- Decisions: none open. D1–D12 Decided (D2-B per X17; D8 superseded by step 16 D1 per X18).
- Hard dependency on unmerged plans that edit the same files: 08, 10 (Task 1.2), 14 Phase 1, 15 (all phases) and all of step 16 (§7.6 row 16); Tasks 1.1–1.3, 2.3 and 2.5 stop if a grep finds step 16's part missing.
- Probes 17-P1, 17-P2, 17-P4, 17-P6, 17-P10 are unrun; each can stop the task it gates.
- The SOP text for step 17 (roles, gates, per-row menu, remarks after approval) has no owning task: an accepted unowned gap under X27.

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and every recommended settlement in `steps-16-19-crosscheck.md` (X17–X27). Where a settled X-item overrides this plan's own recommendation, the X-item wins. Each §9 entry keeps all three approaches; only the status, the Chosen marks, the settled notes and the text that described a decision as open were changed.

**Chosen:** D1-A · **D2-B (per X17)** · D3-B · D4-A · D5-A · D6-A · D7-A · **D8 superseded by step 16 D1-A (per X18)** · D9-A · D10-B · D11-A · D12-A.

**Overrides of this plan's own recommendation.** X17 → D2 is B, not A: step 16 Phase 1 owns the `lading.update` freeze, `FOR UPDATE` load, in-transaction guards, step 15's moved gate call and the `lading.exists` lock. Header, §1, §4.2, §4.8, §5 (prerequisites, "Why one phase", Tasks 1.1–1.3), §6, §7.2, §7.3, §7.5, §7.6 rows 15 P3 and 16, §7.8 and Risks were edited to match. X18 → D8 is superseded by step 16 D1-A (`released` is refused too, and the echo rule is mandatory). Journey 4, §1 success criteria, §4.5, §4.8, Tasks 2.3–2.5 (the `:721` pin now writes `confirmed`) and §7.2 were edited to match.

**Crosscheck settlements, as they land in this plan.** X19 → D4-A is done by step 16 D3-A; Tasks 2.3 and 2.5 drop the `auditStatus` part after grepping. X20 → Task 1.3 adds cases 2 (the `deleteAttachment` half), 4, 5, 7 and 8 to step 16's `lading.under-review.test.ts`, and Task 2.4 adds three `describe`s to step 16's `lading.concurrency.test.ts`; neither file is [NEW] here. X21 → D3-B governs the attachment writers; step 16 D4 covers `lading.update` only. X22 → §4.8 uses step 16's refusal order. X25 → Task 2.6's script drops 17-P3 (= 16-P3). X26 → no migrating option was chosen; any revived one is `00NN_<name>`. X27 → the SOP text for step 17, including D9-A's remark guidance, is an accepted unowned gap. D12-A stays deferred with step 15 D14 under X13.
