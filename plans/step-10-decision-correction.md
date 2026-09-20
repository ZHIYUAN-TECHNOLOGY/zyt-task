# Step 10 — a mis-keyed Won / Lost can be corrected, reviewed, and still seen

**SOP step:** 10 "Record their answer" · `/quotations/$quotationId` → header → **Decide**
**Evidence read at:** HEAD `6bb3a1bf` on `feat/new-layout`, 2026-09-15. The step guide was captured at `6c31a20e`, two commits earlier. Every `file:line` below was re-located by symbol at HEAD.
**Tier:** Standard (new table + migration, a new review trigger in the shared audit engine, `organizationId`-scoped writes to `quotation`)

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`). Drizzle schema in `packages/db/src/schema`, with migrations under `packages/db/src/migrations`. TanStack Router file routes under `apps/web/src/routes/_next`. zod on both sides, vitest on PGlite (`test-schema.ts`).
- **The refusal, as it is today.** `quotations.decide` is at `packages/api/src/routers/quotation.ts:2865`. The docblock names the gap at `:2856-2863`: _"THE GAP, NAMED: there is no such correction path yet, so a mis-keyed decision currently needs a database fix … corrections belong in a path that is visibly a correction rather than in the endpoint that looks like the ordinary one."_ The refusal itself is at `:2908-2917`. It keys on `decidedAt !== null` as well as status, because "the stamp is the fact; the status is a projection of it". The step guide cites `:2855`, which is one line off. The code's own author already asked for a **separate, visible** correction path. This plan builds that path and does not reopen `decide`.
- **Where a decision lives.** It is four nullable columns on `quotation`: `decided_at`, `decided_by`, `decision_reference`, `decision_note` (`packages/db/src/schema/quotation.ts:369-384`, migration 0065), plus `status`. There is **no history**. `decide` writes one `audit_log` row (`quotation.decide`, `quotation.ts:2941-2955`), and `audit_log` has no index on `target_id` (`schema/audit-log.ts:28-31`). "Keep both stamps" therefore needs somewhere to keep them.
- **The freeze.** `quotations.update` refuses any row with `decidedAt !== null` (`quotation.ts:3189`). A correction must not reopen editing. The escape for a changed *price* stays `duplicate`, which nulls all eight stamps (`:3479-3486`).
- **The review engine is record-level, not change-level.** `modules/audit/submit.ts` opens an `audit_submission` against `(resourceType, resourceId)`. `decide.ts:149-161` marks it `passed` and repaints a cache, and that is all. There is **no "on approval, apply this change" hook anywhere** (grep for `onPassed|afterPass|onApprove`: zero hits). The engine's whole seam is `REVIEWABLE_RESOURCES` (`modules/audit/resources.ts:122`), and every entry only reports `exists`, `repaintCache` and `amountOf`. Reusing the engine for a correction therefore needs one small extension: an optional `onPassed` hook.
- **The trigger vocabulary is code, not a DB enum.** `AUDIT_TRIGGER_TYPES` (`packages/db/src/schema/audit.ts:42`) is a TS tuple, and `audit_submission.resource_type` and `audit_flow.trigger_type` are `text`. Adding a trigger needs no enum migration. It does reach every `z.enum(AUDIT_TRIGGER_TYPES)`: `routers/audit-review.ts:40,398,428,446,631`, `routers/audit-flow.ts:136`, `modules/audit/flow-admin.ts:44`. It also reaches the web mirror `apps/web/src/lib/audit-review.ts:18-24` and the approvals card maps `apps/web/src/components/shell-next/card-approvals.tsx:39,79`.
- **Flows reach existing orgs only by re-seeding.** `seedAuditFlows` (`modules/audit/seed.ts:206`) is idempotent: it skips any trigger that already has a flow. Only `org.create` calls it (`routers/org.ts:132`). A new seeded flow therefore reaches **new** orgs only, unless someone runs a re-seed. Without a flow, `submitForReview` refuses with `No enabled review flow for …` (`submit.ts:45-50`).
- **Who can review today.** The seeded quotation flow routes its stage to `branch-manager` (`seed.ts`, the `quotation` entry of `SEEDED_FLOWS`). Both `sales` and `branch-manager` hold the whole `quotation` root, which includes `quotation.review` (`packages/api/src/roles.ts`, the `sales` and `branch-manager` arrays). `director` holds only `quotation.read`. The engine's `decide` has **no self-decision refusal** today. That is the Step 08 finding "branch manager approves their own quotation" (`seed.ts:69`). `retract` already checks ownership the right way round (`withdraw.ts:48`).
- **Conversion does not require Won** (this contradicts the step guide's "Won → step 11"). `convertToOrder` (`quotation.ts:3887`) checks only the `convert_order` gate (`:3908`), that no order exists yet (`:3919-3932`) and the retired-trade rule. It then sets `status = 'converted'` (`:4180-4182`) and leaves the decision stamps as they were. The record page offers Convert on `auditStatus === "approved"` (`$quotationId.tsx:1494-1497`), with no check on outcome. A **Lost** quotation can be converted. `costLines.importFromQuote` (`routers/expense/cost-lines.ts:2177`) *is* gated on `won | converted` (`:2191`) and stamps `cost_line.source_quote_id` (`schema/expense.ts:96`). Deleting an order (`collective-order.ts:3148`) never touches the quotation, so it stays `converted`.
- **No win-rate report exists** (this contradicts the step guide's "poisons win-rate reporting"). A grep for `win rate|winRate|hit rate|conversion rate` in `packages/api`, `apps/web` and `packages/db` finds nothing. These are the readers of `won`/`lost` today:
  - the list status filter `quotation.ts:2041`
  - the record-page badge and "by X on Y" line `$quotationId.tsx:1355-1361`
  - the Post-to-ledger button `$quotationId.tsx:1463`
  - the `importFromQuote` gate
  - `send`'s CASE that preserves a decision through a race (`quotation.ts:2748-2752`)

  The harm is real but narrower than filed. A wrong Won makes the list filter wrong, and it unlocks Post to cost ledger on a deal the customer refused. Any future win-rate report would inherit the same error.
- **Architecture gate.** `packages/api/src/architecture.test.ts:527-528` enumerates every `update(quotation)` writer site with its guards. A new writer must be added there with a comment, or the api architecture test goes red. That file is not the web `architecture.test.ts` of the same name.
- **Migration state.** The journal has 65 entries, ending `0065_quotation_send_decision`, with 65 `.sql` files. It is contiguous and nothing is pending. Steps 01/02 claim `0066`/`0067`, and this plan **reserves `0074`**. `migrations.test.ts` requires contiguous `idx`, so 0074 can only land after 0066-0073 exist. Otherwise it is renumbered at merge (see D11).
- **Existing tests that change.** `quotation.send-decide.test.ts:389`, `:403` and `:432` pin the re-decide refusal. They stay green, because the refusal is kept; only its message gains a pointer.

---

## 1. Overview

**Problem.** The Decide dialog records Won or Lost, and then the quotation is frozen. If sales press Won on a quotation the customer actually refused, or record the wrong answer date, nothing in the app can put it right. The code's own docblock says the fix is a database edit. Until someone makes that edit, the quotation list filters it as won and Post to cost ledger stays open on a lost deal. Every future conversion or win-rate figure counts it wrong. A silent database edit leaves no trace of what was first recorded.

**Goal.** A decided quotation can be corrected through a path that is visibly a correction:
- someone requests it with a reason;
- a second person approves it through the existing review engine;
- it is applied atomically, keeping the original decision next to the correction;
- it is refused when an order or ledger lines already depend on the outcome.

**Success criteria.**
- Sales can request a correction of outcome, answer date, customer reference or note from the quotation header, with a mandatory reason.
- Nothing about the quotation changes until a reviewer who is **not** the requester approves. Rejecting or retracting leaves it untouched.
- On approval, `quotation.status` and the four decision columns show the corrected values. The list filter, badge and ledger gate read them with no change of their own.
- The record page shows the full decision history: the original decision, every correction, who requested and who approved, and why.
- An outcome change is refused while an order or ledger lines exist from this quotation.
- The `quotation.decide` refusal no longer tells anyone a database fix is needed.

**In scope.** A `quotation_decision` history table (migration 0074). A `quotation_decision` review trigger with an `onPassed` apply hook in the audit engine. A `requestDecisionCorrection` endpoint and an apply function. Changes to `decide`: it writes history and its refusal message changes. A decision-correction dialog, a pending-correction panel and a history card on the record page. A thin approvals queue page. A convert/post guard while a correction is pending. A re-seed script so existing orgs get the flow.

**Out of scope.**
- A win-rate report, because none exists (D8 fixes the contract it must read).
- Correcting legacy `won`/`lost` rows that have no stamp: they have no `decidedAt`, are not frozen, and step 09's Resend is their remedy.
- Unwinding an order or ledger lines (D4 refuses rather than cascades).
- Editing a decided quotation's prices (`duplicate` stays the path).
- Changing `decide`'s golden path.

**Inputs read.** `step-10.json`, `step-10-findings.json`, `step-08.json` (fixes only, for the dependency). The `planpro` skill. `step-03-contact-nomination.md` and `step-01-enquiry-channel.md` as house style. Project memory: migration gates, the two architecture tests, edit forms cannot clear a field, seed-parity browser verification, shared-session active org. Everything in the step JSON is either planned or declined above. File-vs-code conflicts are logged as D12.

**Assumptions.**
- The reviewer's surface is a panel on the record page plus a thin queue page → D7
- Reports read the corrected values from the `quotation` columns; history is for audit → D8
- Convert and Post to ledger are refused while a correction is pending → D9
- History is backfilled from existing stamps plus the matching `audit_log` row → D10
- The migration number is 0074 and gets renumbered at merge if 0066-0073 are not all in → D11
- Existing orgs receive the new flow through a one-off idempotent re-seed script → D6
- A correction sends all four decision values every time (full state, not a patch), so a blank field clears it → §4 contract

## 2. User Journeys

**Journey 1 (new): Sales requests a correction of a mis-keyed decision**
Trigger: sales open a quotation whose header reads **Won · by Aisyah on 03 Sep**, and the customer's thread says they declined.
Steps:
1. Sales see `/quotations/$quotationId` → the header shows the status badge and "by <member> on <date>" (unchanged), and a new **Correct decision** button beside it. The button shows only when `decidedAt` is set, no correction is pending, and the user holds `quotation.update`.
2. Sales press **Correct decision** → a dialog, **Correct decision on NCT-Q-…**, opens and says: _"The current decision stays on record. The correction takes effect only after a reviewer approves it."_ It is prefilled with the current Outcome, Decision date, Customer reference and Note.
3. Sales change **Outcome** to **Lost**. The options are Won, Lost and **Not decided yet** (D5). They can also adjust the date, reference or note, and must type a **Reason for correction**. Without a reason, the error reads _"Say why the recorded decision is wrong."_
4. Sales press **Request correction**. The server checks the request (it must be decided, actually differ, and have no order or ledger lines when the outcome changes), stores the proposal, and submits it for review.
   - The toast reads _"Correction sent for review"_.
   - The header shows an amber **Correction pending review** chip, with **Retract** for the requester.
   - The quotation's status, date and reference are **unchanged**.
5. Flow ends: the proposal is in the reviewer's queue. If the refusal condition is hit (an order exists), the dialog stays open and shows the server message inline: _"This quotation has order ORD-… — its outcome cannot be changed while the order exists."_
Where it lives: inline in the existing quotation header, and in a dialog modelled on `decide-quotation-dialog.tsx`.

Old journey, for contrast: steps 1 and 2 did not exist. There was no button, so the decision stayed wrong until someone edited the database, with no record of the change.

**Journey 2 (new): A branch manager approves or rejects the correction**
Trigger: the approvals card on the dashboard shows **Decision correction · 1**. Alternatively, the manager opens the quotation directly.
Steps:
1. The manager opens **Approvals → Decision corrections** (`/approve/decision-correction`) → a table lists pending proposals: Quotation no., Current → Proposed outcome, Proposed date, Reason, Requested by / at. Each row links to the quotation.
2. The manager opens the row → the quotation page shows a **Pending correction** panel above the Threads card, with a side-by-side table (**Recorded** vs **Proposed**) for Outcome, Decision date, Customer reference and Note, plus the Reason, the requester, and **Approve** / **Reject** buttons with an optional remark.
3. The manager presses **Approve** → the engine records the decision, the stage passes, and `onPassed` applies the correction in the same transaction.
   - Toast: _"Correction approved: NCT-Q-… is now Lost"_.
   - The header badge reads **Lost · by <requester> on <corrected date>** with a small **Corrected** tag, and the panel disappears.
4. Alternatively, the manager presses **Reject** with a remark → toast _"Correction rejected"_. The quotation is untouched, and the requester sees the rejection in the history card.
5. If the requester is the only eligible reviewer, **Approve** answers _"You cannot approve a correction you requested"_. That refusal is the Step 08 self-decision rule.
6. Flow ends: the queue row is gone and the history card has a new row.
Where it lives: a new thin queue page plus an inline panel on the existing record page.

**Journey 3 (new): Anyone reading the quotation sees what was originally recorded**
Trigger: a sales manager asks why a quote counted as won last month now reads Lost.
Steps:
1. The user opens the quotation → a **Decision history** card under the Threads card lists every decision row, oldest first. Each row shows the kind (Decision or Correction), outcome, answer date, reference, note, reason, requested by/at, reviewed by/at plus remark, and a state: **Current**, **Superseded**, **Rejected**, **Retracted** or **Pending**.
2. Flow ends: the original Won row is **Superseded**, with the correction beside it. Nothing was overwritten out of sight.
Where it lives: a card on the existing record page. It shows only when at least one decision row exists.

**Journey 4 (changed): Convert / Post to ledger while a correction is pending**
1. On a Won quotation with a pending correction, the user presses **Post to cost ledger** or **Convert to order** → the server refuses: _"A decision correction is pending review. Resolve it before converting."_ The toast shows that message.
2. The buttons are also disabled, with that sentence as their title, whenever `retrieve` reports a pending correction.
Where it lives: the existing header buttons (`$quotationId.tsx:1463-1504`).

## 3. Result (What Changes for the User)

**Before:** once someone presses Won or Lost, the answer is permanent. A wrong one stays in the list filter and keeps Post to cost ledger open until a developer edits the database, and afterwards nobody can see what was first recorded.
**After:** sales request a correction with a reason, a manager approves it in the normal approvals flow, and the quotation shows both the original decision and the correction.
**Key differences:**
- Sales: a **Correct decision** button and dialog on a decided quotation, plus a **Correction pending review** chip with Retract.
- Branch manager: a **Decision corrections** approval queue, and an Approve/Reject panel on the quotation.
- Everyone: a **Decision history** card, and a **Corrected** tag on the status line.
- Nobody: an outcome that an existing order or ledger lines depend on still cannot be flipped; the refusal names the order.

## 4. Technical Architecture

### Data flow

```
Journey 1  quotations.requestDecisionCorrection ──► insert quotation_decision (kind=correction, applied_at NULL)
                                                   └► submitForReview(resourceType "quotation_decision", resourceId = proposal.id)
Journey 2  auditReview.decideByResource ──► modules/audit/decide.ts ──► final stage passed
                                                   └► REVIEWABLE_RESOURCES.quotation_decision.onPassed(tx, org, proposalId)
                                                        └► applyDecisionCorrection: lock, re-check, UPDATE quotation, supersede prior row, audit
           reject / retract ──► repaintCache(status rejected|withdrawn) ──► proposal.closed_at = now
Journey 3  quotations.decisionHistory({ id }) ──► select quotation_decision where quotation_id, org
```

Engine reuse, not a parallel mechanism → D1. History in a table, with the `quotation` columns as the projection → D2, D8.

### Data model: `quotation_decision` [NEW] (migration `0074_quotation_decision`)

Needed by Journey 1 step 4, Journey 2 step 3 and Journey 3 step 1.

```ts
// packages/db/src/schema/quotation.ts — beside `quotation`
export const quotationDecision = pgTable(
  "quotation_decision",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    quotationId: text("quotation_id").notNull()
      .references(() => quotation.id, { onDelete: "cascade" }),
    /** 'decision' (written by quotations.decide) | 'correction' (a reviewed proposal). */
    kind: text("kind").notNull(),
    /** 'won' | 'lost' | 'sent' — 'sent' = the correction withdraws the decision (D5). */
    outcome: text("outcome").notNull(),
    decidedOn: timestamp("decided_on"),          // NULL only when outcome = 'sent'
    decisionReference: text("decision_reference"),
    decisionNote: text("decision_note"),
    reason: text("reason"),                       // required by the API for kind='correction'
    requestedBy: text("requested_by").references(() => member.id, { onDelete: "set null" }),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    /** The decision row that was current when this was requested; NULL for the first decision
     *  or a pre-0074 quotation the backfill could not attribute (D10). */
    supersedesId: text("supersedes_id"),
    appliedAt: timestamp("applied_at"),           // NULL = proposal not (yet) applied
    closedAt: timestamp("closed_at"),             // set on reject / retract — terminal, never applied
    supersededAt: timestamp("superseded_at"),     // set when a later correction replaces this row
    supersededById: text("superseded_by_id"),
    source: text("source").default("app").notNull(), // 'app' | 'backfill_0074'
    // Review CACHE columns — the same five every reviewable table carries since 0036,
    // written only by the engine's repaintCache (resources.ts).
    auditStatus: text("audit_status").default("draft").notNull(),
    submittedAt: timestamp("submitted_at"),
    submittedBy: text("submitted_by"),
    auditedAt: timestamp("audited_at"),
    auditedBy: text("audited_by"),
    auditReason: text("audit_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index("quotation_decision_quotation_idx").on(t.organizationId, t.quotationId, t.requestedAt),
    // exactly one CURRENT decision per quotation
    uniqueIndex("quotation_decision_current_uq").on(t.quotationId)
      .where(sql`${t.appliedAt} IS NOT NULL AND ${t.supersededAt} IS NULL`),
    // at most one OPEN proposal per quotation — the engine's one-open-review rule is per
    // proposal id, so the quotation-level rule needs its own guarantee
    uniqueIndex("quotation_decision_open_proposal_uq").on(t.quotationId)
      .where(sql`${t.appliedAt} IS NULL AND ${t.closedAt} IS NULL`),
    check("quotation_decision_kind_ck", sql`${t.kind} in ('decision','correction')`),
    check("quotation_decision_outcome_ck", sql`${t.outcome} in ('won','lost','sent')`),
  ],
);
```

The migration is a `CREATE TABLE`, the indexes and checks, and one backfill `INSERT … SELECT` (D10):

```sql
INSERT INTO quotation_decision (id, organization_id, quotation_id, kind, outcome, decided_on,
  decision_reference, decision_note, requested_by, requested_at, applied_at, source, audit_status)
SELECT gen_random_uuid()::text, q.organization_id, q.id, 'decision',
       COALESCE(a.after_json::jsonb->>'status', q.status),
       q.decided_at, q.decision_reference, q.decision_note, q.decided_by,
       COALESCE(a.created_at, q.updated_at), COALESCE(a.created_at, q.updated_at),
       'backfill_0074', 'draft'
FROM quotation q
LEFT JOIN LATERAL (
  SELECT after_json, created_at FROM audit_log
  WHERE audit_log.organization_id = q.organization_id
    AND audit_log.action = 'quotation.decide' AND audit_log.target_id = q.id
  ORDER BY created_at DESC LIMIT 1) a ON true
WHERE q.decided_at IS NOT NULL
  AND COALESCE(a.after_json::jsonb->>'status', q.status) IN ('won','lost');
```

A `converted` quotation with no `quotation.decide` audit row is skipped, because its outcome cannot be named honestly. That is the same rule 0065 used for stamps. `gen_random_uuid()` is core Postgres 13+ and needs no extension. The PGlite chain replay must confirm it (gate 3). If it fails, generate ids as `md5(random()::text || q.id)`.

### Audit engine extension (D1): owned by this plan, sequenced after Step 08

```ts
// packages/api/src/modules/audit/resources.ts — ReviewableResource gains:
/** Runs inside the deciding transaction when the submission reaches `passed` —
 *  for resources whose approval IS a state change (a decision correction).
 *  Throwing rolls back the reviewer's decision with it. Absent = no effect. */
onPassed?(tx: DbTransaction, org: OrgContext, resourceId: string): Promise<void>;
```

- `modules/audit/decide.ts`: in the final-stage `passed` branch (currently `:149-161`), call `await entry.onPassed?.(tx, org, submission.resourceId)` **before** `repaintCache`.
- `modules/audit/submit.ts`: in the every-stage-skipped auto-pass branch (currently `:122-136`), make the same call.
- `packages/db/src/schema/audit.ts`: append `"quotation_decision"` to `AUDIT_TRIGGER_TYPES`.
- `resources.ts` entry `quotation_decision`:
  - `submitNode: QUOTATION.update`, `reviewNode: QUOTATION.review`.
  - `exists` checks the row by id and org, with `kind = 'correction'`.
  - `repaintCache` writes the five cache columns and sets `closedAt = now()` when `payload.status` is `rejected` or `withdrawn`.
  - `amountOf` returns `null`.
  - `onPassed` is `applyDecisionCorrection`.
- `modules/audit/seed.ts` gets a new `SEEDED_FLOWS` entry, `{ trigger: "quotation_decision", name: "Decision correction", withdrawalMode: "direct", stages: [{ roles: ["branch-manager"], quorum: "any_pass_all_reject" }], gates: [], note: "A recorded Won/Lost changes only after a second person approves it." }` (D3).
- `modules/quotation/gates.ts`: no gate keys for the new trigger (`defineGates` is not called for it). `gates.test.ts` requires every declared key to have a caller, so declaring none is correct.

### API contracts

**`quotations.requestDecisionCorrection`** [NEW] (Journey 1 step 4), in `packages/api/src/routers/quotation.ts`:

```ts
requestDecisionCorrection: orgProcedure
  .use(requireNode(QUOTATION.update))
  .input(z.object({
    id: z.string(),
    outcome: z.enum(["won", "lost", "sent"]),
    decidedOn: z.coerce.date().nullable(),              // required unless outcome = "sent"
    customerReference: z.string().trim().max(200).nullable(), // FULL STATE: null clears
    note: z.string().trim().max(2000).nullable(),
    reason: z.string().trim().min(1, "Say why the recorded decision is wrong.").max(1000),
  }))
  // → { proposalId: string; submissionStatus: "under_review" | "passed"; quotation: MaskedQuotation }
```

The handler runs in one transaction:
1. Load the quotation with `applyScope`, `FOR UPDATE`, and refuse NOT_FOUND if it is not visible.
2. Refuse `decidedAt === null`: _"This quotation has no recorded decision. Use Decide."_
3. Refuse `outcome !== "sent" && decidedOn === null`.
4. Refuse a no-op (all four values equal the current ones): _"Nothing to correct."_
5. When the outcome changes, run the D4 refusal: an order exists (`collective_order.quotation_id`, org-scoped), or any `cost_line` with `source_quote_id = id` exists in the org.
6. Load the current decision row (`applied_at IS NOT NULL AND superseded_at IS NULL`). It may be absent for a skipped backfill row.
7. Insert the proposal row. A `23505` on `quotation_decision_open_proposal_uq` becomes CONFLICT _"A correction is already pending review."_
8. `submitForReview(tx, context.org, { resourceType: "quotation_decision", resourceId, remark: reason })`. Its `No enabled review flow` CONFLICT passes through reworded (D6).
9. `writeAuditRaw` with action `quotation.decision.correction.request`, target the quotation, and `after` = the proposal snapshot.
10. Return. If the engine auto-passed, `onPassed` has already applied the correction.

**`applyDecisionCorrection(tx, org, proposalId)`** [NEW] (Journey 2 step 3), in `packages/api/src/modules/quotation/decision-correction.ts`:
1. Lock the proposal and refuse unless `applied_at IS NULL AND closed_at IS NULL`.
2. Lock the quotation `FOR UPDATE` by id and `organization_id`. This is org scope, not the reviewer's data scope, following `repaintCache`'s precedent. See Risks.
3. **Stale check:** the current decision row's id must equal `proposal.supersedesId`. Otherwise CONFLICT _"The decision changed after this correction was requested. Reject it and request again."_ The throw rolls back the reviewer's vote with it.
4. Re-run the D4 refusal, because an order may have been minted since the request. D9 makes that unlikely, but the check must hold anyway.
5. `UPDATE quotation` with:
   - `status`: the proposal outcome, **except** when the current status is `converted` and the outcome is unchanged, in which case `converted` is kept;
   - `decidedAt = decidedOn`, `decidedBy = proposal.requestedBy`, `decisionReference`, `decisionNote`;
   - for outcome `sent`, all four set to `NULL` and `status = 'sent'`.

   The WHERE re-asserts `organization_id`, and the rowcount is asserted.
6. Set `superseded_at` and `superseded_by_id` on the prior row. Set `applied_at = now()` on the proposal.
7. `writeAuditRaw` with action `quotation.decision.correct`, target the quotation, `before` = the prior decision snapshot plus status, and `after` = the new snapshot plus `{ proposalId, approvedBy: org.membership.id }`.

**`quotations.decide`** (changed). After the existing UPDATE, insert a `kind: 'decision'` row with `applied_at = now()`. If a current row exists (impossible under the refusal, but the index guards it), the insert raises `23505`, which becomes CONFLICT. The refusal message becomes _"This quotation is already won. Use Correct decision to change it."_ The docblock's "THE GAP, NAMED" paragraph is replaced by a pointer to `requestDecisionCorrection`.

**`quotations.retrieve`** (changed, additive), for Journey 1 step 1, Journey 2 step 2 and Journey 4 step 2: it adds `pendingDecisionCorrection: { proposalId, outcome, decidedOn, customerReference, note, reason, requestedBy, requestedAt } | null` and `decisionCorrected: boolean`. `decisionCorrected` is true when the current row's `kind` is `'correction'`. Both come from one indexed select.

**`quotations.decisionHistory`** [NEW] (Journey 3). `requireNode(QUOTATION.read)`, input `{ id }`, a scoped existence check, then rows ordered `requested_at asc` and capped at 50, with the state derived from `applied_at/closed_at/superseded_at`.

**`convertToOrder` / `costLines.importFromQuote`** (changed, Journey 4): after the scoped load, refuse with CONFLICT when an open proposal exists for the quotation (D9).

**Web.**
- `apps/web/src/lib/audit-review.ts` adds `"quotation_decision"` to `EngineResourceType`.
- `card-approvals.tsx` gets label `"Decision correction"` and route `"/approve/decision-correction"`.
- The Approve/Reject panel calls `client.auditReview.decideByResource({ resourceType: "quotation_decision", resourceIds: [proposalId], decision, remark })`, and Retract calls `retractByResource`.
- Afterwards, invalidate `quotations.retrieve`, `quotations.decisionHistory` and `quotations.list`.

### Key decisions
- Correct through the review engine with an `onPassed` hook, not a quotation-local two-person rule → D1
- History in `quotation_decision`, with the `quotation` columns kept as the current projection → D2, D8
- Seeded reviewer is branch-manager, with the self-decision refusal from Step 08 → D3
- Outcome changes refused while an order or ledger lines exist; date/reference/note stay correctable → D4
- "Not decided yet" is a correction target → D5
- No flow means refuse with a pointer, and existing orgs get the flow by re-seed → D6

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- Step 08's engine changes are merged: the self-decision refusal in `modules/audit/decide.ts`, and whatever Step 08 changes in `submit.ts`, `gates.ts` and `post-approval.ts`. This plan edits `decide.ts`, `submit.ts` and `resources.ts` after them.
- The migration journal head is re-read. If 0066-0073 are not all present, renumber 0074 to the next contiguous idx (D11).
- D1, D2 and D4 are confirmed.

### Phase 1 — A correction is requested, reviewed and applied

**Delivers:** Journeys 1 and 2 end-to-end, on the record page.
**Dependencies:** the prerequisites above.

- **1.1** Add the `quotationDecision` table and relations to `packages/db/src/schema/quotation.ts`. Generate `0074_quotation_decision.sql` plus its snapshot and journal entry, then hand-append the backfill `INSERT`. Run `bunx vp test run packages/db/src/migrations.test.ts` and grep its output for failures (all three gates). Files: `packages/db/src/schema/quotation.ts`, `packages/db/src/migrations/0074_quotation_decision.sql` [NEW], `packages/db/src/migrations/meta/0074_snapshot.json` [NEW], `packages/db/src/migrations/meta/_journal.json`, `packages/api/src/test-schema.ts` (if it enumerates tables). · **Agent A (backend)**
- **1.2** Engine extension: the `onPassed?` hook on `ReviewableResource`, the calls in `decide.ts` (final pass) and `submit.ts` (auto-pass), `"quotation_decision"` in `AUDIT_TRIGGER_TYPES`, the `REVIEWABLE_RESOURCES.quotation_decision` entry, and the `SEEDED_FLOWS` entry. Unit test: a resource with `onPassed` that throws rolls back the decision and leaves the submission `under_review`. Files: `packages/api/src/modules/audit/resources.ts`, `packages/api/src/modules/audit/decide.ts`, `packages/api/src/modules/audit/submit.ts`, `packages/api/src/modules/audit/seed.ts`, `packages/db/src/schema/audit.ts`, `packages/api/src/modules/audit/seed.test.ts`, `packages/api/src/modules/audit/gates.test.ts` (only if it enumerates triggers). · **Agent A (backend)**
- **1.3** `applyDecisionCorrection` plus the shared D4 refusal helper `assertOutcomeNotDependedOn(tx, orgId, quotationId)`. Files: `packages/api/src/modules/quotation/decision-correction.ts` [NEW]. · **Agent A (backend)**
- **1.4** Router work:
  - add `requestDecisionCorrection`;
  - `decide` writes its history row and gets the new refusal message and docblock;
  - `retrieve` gains `pendingDecisionCorrection` and `decisionCorrected`;
  - add `decisionHistory`;
  - register the new `update(quotation)` writer site in the api architecture test, with its guards comment.

  Files: `packages/api/src/routers/quotation.ts`, `packages/api/src/architecture.test.ts`. · **Agent A (backend)**
- **1.5** Tests in `quotation.decision-correction.test.ts` [NEW], on PGlite, with a seeded flow and two members (sales requester, branch-manager reviewer):
  - request, then approve: the quotation is corrected, the prior row superseded and both audit rows present;
  - reject, then retract: the quotation is untouched and `closed_at` is set;
  - self-approve is refused (needs Step 08);
  - a stale proposal is refused on approve;
  - an outcome change with an order is refused, and with a `source_quote_id` cost line is refused;
  - a date-only correction on a `converted` quotation keeps `converted`;
  - outcome `sent` nulls all four stamps and re-enables `update`;
  - a second open proposal is refused;
  - no flow gives the D6 message;
  - a cross-org id is NOT_FOUND.

  Also extend `quotation.send-decide.test.ts:389/403` to assert the new message and a `kind: 'decision'` history row. Files: `packages/api/src/routers/quotation.decision-correction.test.ts` [NEW], `packages/api/src/routers/quotation.send-decide.test.ts`. · **Agent A (backend)**
- **1.6** `CorrectDecisionDialog`, modelled on `decide-quotation-dialog.tsx`, with the same re-seed-on-open effect keyed on `[open, quotationId]` (see the memory note on the TanStack re-seed trap). It prefills from `loaded`, offers the three outcomes, hides the date when the outcome is "Not decided yet", requires Reason, sends full state (blank becomes `null`), and shows the server error inline. Files: `apps/web/src/components/quotation/correct-decision-dialog.tsx` [NEW]. · **Agent B (frontend)**
- **1.7** `PendingDecisionCorrectionPanel`: a Recorded vs Proposed table, Approve/Reject with remark for anyone except the requester, Retract for the requester, and query invalidation. Files: `apps/web/src/components/quotation/pending-decision-correction-panel.tsx` [NEW], `apps/web/src/lib/audit-review.ts`. · **Agent B (frontend)**
- **1.8** Record page wiring:
  - the **Correct decision** button in the status block (after `$quotationId.tsx:1361`), gated on `loaded.decidedAt && !loaded.pendingDecisionCorrection`;
  - the pending chip;
  - the **Corrected** tag when `decisionCorrected`;
  - the panel mounted before `LinkedThreadsCard` (`:3311`);
  - the dialog mounted beside `DecideQuotationDialog` (`:3323`).

  Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx`. · **Agent B (frontend)**

**Acceptance.** Sales can request Won → Lost with a reason on a sent, decided quotation. A different branch-manager approves it on the record page, and the badge reads Lost with the Corrected tag without a reload. The same flow with Reject leaves Won. `quotation.decision-correction.test.ts`, `quotation.send-decide.test.ts`, `modules/audit/*.test.ts`, the api `architecture.test.ts` and `migrations.test.ts` all pass, judged by reading their output.

### Phase 2 — History is visible, reviewers can find the queue, and conversion waits

**Delivers:** Journeys 3 and 4, and Journey 2 step 1 (discovery).
**Dependencies:** Phase 1 merged, which provides the `decisionHistory` and `retrieve` contracts and the trigger type.

- **2.1** Journey 4 guard, part 1: `convertToOrder` refuses while a proposal is open, checked after `assertGateCleared` (`quotation.ts:3908`). Test in `quotation.convert.test.ts`. Files: `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/quotation.convert.test.ts`. · **Agent C (backend)**
- **2.2** Journey 4 guard, part 2: `costLines.importFromQuote` refuses while a proposal is open, checked after its `won|converted` gate (`cost-lines.ts:2191`). The existence query is imported from `modules/quotation/decision-correction.ts` (read-only there). Files: `packages/api/src/routers/expense/cost-lines.ts`, `packages/api/src/routers/quotation.convert.test.ts`. · **Agent C (backend)**
- **2.3** Re-seed script for existing orgs. It loops over organizations and calls `seedAuditFlows(tx, orgId)` per org in its own transaction, so it is idempotent and skips triggers that already exist. It prints the orgs it seeded plus any stage left with no reviewer row (the `audit-flow.ts:64` case). Files: `packages/api/src/scripts/seed-audit-flows.ts` [NEW]. · **Agent C (backend)**
- **2.4** `DecisionHistoryCard`, built on `quotations.decisionHistory`, mounted under Threads and hidden when there are no rows. Files: `apps/web/src/components/quotation/decision-history-card.tsx` [NEW], `apps/web/src/routes/_next/quotations/$quotationId.tsx`. · **Agent D (frontend)**
- **2.5** Disable Convert and Post to ledger, with a title, when `pendingDecisionCorrection` is set. Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx`. · **Agent D (frontend)**
- **2.6** The `/approve/decision-correction` queue page. It lists the rows from `auditReview.listQueue({ resourceType: "quotation_decision" })`, joined client-side to the quotation no. that the list returns, and links each row to `/quotations/$quotationId`. It also gets its label and route in `card-approvals.tsx`. If `listQueue` does not return enough to render a row, add a `quotations.listPendingDecisionCorrections` endpoint instead; that endpoint is owned by Agent C, with the requirement declared in §6. Files: `apps/web/src/routes/_next/approve/decision-correction.tsx` [NEW], `apps/web/src/components/shell-next/card-approvals.tsx`. · **Agent D (frontend)**

**Acceptance.** A manager lands on the dashboard, sees **Decision correction · 1**, opens the queue, opens the quotation and approves it. The history card shows the original Won row as Superseded and the Lost correction as Current. With a correction pending, Convert and Post to ledger are disabled, and calling them directly returns CONFLICT. The re-seed script run twice seeds each org once.

## 6. Delegation & Parallelization Plan

**Phase 1: a correction is requested, reviewed and applied**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.5 | `packages/db/src/schema/quotation.ts`, `packages/db/src/schema/audit.ts`, `packages/db/src/migrations/0074_*.sql`, `packages/db/src/migrations/meta/*`, `packages/api/src/modules/audit/{resources,decide,submit,seed}.ts`, `packages/api/src/modules/audit/{seed,gates}.test.ts`, `packages/api/src/modules/quotation/decision-correction.ts`, `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/quotation.decision-correction.test.ts`, `packages/api/src/routers/quotation.send-decide.test.ts`, `packages/api/src/architecture.test.ts`, `packages/api/src/test-schema.ts` | `packages/api/src/modules/audit/{shared,withdraw,gates,post-approval}.ts`, `packages/api/src/roles.ts`, `packages/db/src/schema/{expense,collective-order,audit-log}.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.6–1.8 | `apps/web/src/components/quotation/correct-decision-dialog.tsx`, `apps/web/src/components/quotation/pending-decision-correction-panel.tsx`, `apps/web/src/lib/audit-review.ts`, `apps/web/src/routes/_next/quotations/$quotationId.tsx` | `apps/web/src/components/quotation/decide-quotation-dialog.tsx`, `packages/api/src/routers/quotation.ts` |

Agent A gets opus because the task adds a migration with a backfill, extends the shared audit engine's transaction boundary, and writes `organizationId`-scoped status changes, all of which are §7 breakage surface.
Run mode: **A → B**, sequential. B waits on the router contract from Task 1.4 (the `requestDecisionCorrection` input/output and the `retrieve` additions) so the oRPC client types resolve. B may start once 1.4's handler signature is committed. Parallel with a frozen contract is not recommended, because `$quotationId.tsx` types come straight from the router.
Serialization points: after 1.1, run the migration gates and apply the migration to the dev branch, checking the journal. After A, run `migrations.test.ts`, the api `architecture.test.ts` and `bun run check-types`, reading the output rather than the exit code. After B, run `check-types` again.

**Phase 2: history, discovery, conversion guard**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | sonnet | medium | 2.1–2.3 | `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/expense/cost-lines.ts`, `packages/api/src/routers/quotation.convert.test.ts`, `packages/api/src/scripts/seed-audit-flows.ts` | `packages/api/src/modules/quotation/decision-correction.ts`, `packages/api/src/modules/audit/seed.ts` |
| Agent D (frontend) | frontend-engineer | sonnet | medium | 2.4–2.6 | `apps/web/src/components/quotation/decision-history-card.tsx`, `apps/web/src/routes/_next/quotations/$quotationId.tsx`, `apps/web/src/routes/_next/approve/decision-correction.tsx`, `apps/web/src/components/shell-next/card-approvals.tsx` | `apps/web/src/lib/audit-review.ts`, `packages/api/src/routers/audit-review.ts` |

Run mode: **C ∥ D**, parallel, because the file sets are disjoint. The one conditional: if D finds `listQueue` insufficient (2.6), C adds `quotations.listPendingDecisionCorrections` in `quotation.ts`, and D waits for it.
Ownership handoffs: `packages/api/src/routers/quotation.ts` and `apps/web/src/routes/_next/quotations/$quotationId.tsx` go from Agent A/B (Phase 1) to Agent C/D (Phase 2).
Serialization point: `bun run check-types` plus the api test suite after both finish.

Smell test: every task has exactly one owner · no file is owned twice within a phase · C ∥ D are disjoint · the one opus is justified · the A → B wait names its artifact (the Task 1.4 contract) · Phase 1 delivers Journeys 1 and 2 on its own.

## 7. Impact & Breakage Analysis

- **`AUDIT_TRIGGER_TYPES` (+1 value).** Consumers, from grep:
  - `routers/audit-review.ts:40,398,428,446,631` (zod enums, which widen safely);
  - `routers/audit-flow.ts:136` (Parameter Setting lists triggers, so a "Decision correction" flow appears there; confirm the page has a label fallback);
  - `modules/audit/flow-admin.ts:44`;
  - `apps/web/src/components/shell-next/card-approvals.tsx:39,79`: `Record<…>` maps typed on the trigger would **fail type-check** until the new key is added. Agent D owns that, but because it would break in Phase 1, Agent A must check whether the map is typed exhaustively. If it is, the key moves into Phase 1 under Agent B (declared here).
  - `REVIEWABLE_RESOURCES: Record<AuditTriggerType, …>` must gain the entry in the same commit, or api type-check fails.
- **`ReviewableResource` shape.** Adding the optional `onPassed` is additive for all 10 existing entries. `decide.ts` and `submit.ts` are the only callers of the pass transition (grep `status: "passed"` in `modules/audit`). `decideSeparateFlowWithdrawal` never reaches `passed`, so it needs no call.
- **`quotations.decide`.** The return shape is unchanged. The one new insert is covered by the existing transaction. Callers are `decide-quotation-dialog.tsx:69` and the test at `quotation.send-decide.test.ts:346-466`. The CONFLICT message text changes, and nothing in `apps/web` matches on the text (the dialog toasts `error.message`).
- **`quotations.retrieve`.** Additive fields. Callers are `$quotationId.tsx` and any `retrieve` consumer. The page's local type at `:858-872` is widened by B.
- **`quotation` writers.** A new `update(quotation)` site inside `modules/quotation/decision-correction.ts` must be listed in `architecture.test.ts` (around `:505-532`). `send`'s CASE at `:2748-2752` still preserves `won/lost/converted`. After an approved "Not decided yet" correction, `status = 'sent'` with null stamps, so a later Resend and a fresh Decide both work as they do for any sent quotation.
- **`convertToOrder` / `importFromQuote`.** One extra CONFLICT, only while a proposal is open. `quotation.convert.test.ts` cases without proposals are unaffected.
- **Nullable fields the plan depends on.** `quotation.decided_by` is nullable and `set null` on member delete, so the backfill keeps a null `requested_by` honestly. `collective_order.quotation_id` is nullable text with no FK (`schema/collective-order.ts:138`), so the D4 check must filter on the org as well as the id. `cost_line.source_quote_id` is trace-only with no FK (`schema/expense.ts:94-96`); an orphan after a quote delete is harmless, since the quote row cascades its decisions anyway.
- **Deployment coupling.**
  - Phase 1 backend (the migration and trigger) must deploy **before** the Phase 1 web build. The new buttons call endpoints that would otherwise 404. Build `apps/web` first, per the memory note on alchemy's partial deploy.
  - The migration must be applied before the server deploys, or `decide` fails on the missing table. That would be a 500 on the golden path of step 10 itself.
  - Phase 2 can deploy independently, and the re-seed script runs after the Phase 1 deploy.
- **Cross-plan coupling.**
  - Step 08 edits `modules/audit/decide.ts` (self-decision refusal) and possibly `submit.ts` and `post-approval.ts`, plus `quotation.ts:3845` (the legacy `review`), `:2355` (export gate) and `:3196` (`assertNotUnderReview`).
  - Step 09 edits `send` in `quotation.ts:2598-2832` and `quotation.send-decide.test.ts`.
  - Step 11+ edits `convertToOrder` and `cost-lines.ts`.
  - Rebase onto each, and re-run the api architecture test after every rebase.
- **Blocking prerequisites.** Step 08's self-decision refusal is merged (without it, Journey 2 step 5 is false and a requester can approve their own correction when they hold the stage role). D1, D2 and D4 are decided. The migration number is resolved.

## 8. Cross-Cutting Concerns

- **Errors.** Every refusal is `ORPCError("CONFLICT" | "NOT_FOUND" | "FORBIDDEN")` with an operator-readable sentence. The dialog shows it inline and the panel toasts it. `onPassed` throws inside the reviewer's transaction, so a failed apply never leaves a `passed` submission with an unapplied correction.
- **Testing.**
  - API boundary tests on PGlite (Task 1.5).
  - An engine-level rollback test (Task 1.2).
  - Migration replay (`migrations.test.ts`).
  - Browser proof per §10 with two members.
  - The api `architecture.test.ts`, not the web one.
- **Migration.** `0074_quotation_decision`: one table, 3 indexes (2 partial unique), 2 checks, and one backfill `INSERT`. Rollback is `DROP TABLE quotation_decision`, which removes only the history. The `quotation` columns are untouched by the migration, so current decisions survive a rollback.
- **Rollback of the feature.** Revert the web and api commits, then drop the table. Corrections already applied remain applied on `quotation` (which is correct data), and their `audit_log` rows survive (`quotation.decision.correct` carries before and after). Leftover `audit_submission` rows with `resource_type = 'quotation_decision'` are inert once the trigger is gone. They can be deleted with the flow, or left.
- **Audit trail.** Per correction, four kinds of immutable row are written:
  1. `quotation.decision.correction.request` (target: quotation);
  2. the engine's `audit.submit` / `audit.decide` / `audit.retract` (target: the proposal, via `logAuditAction`);
  3. `quotation.decision.correct` on approval (target: quotation, with before/after snapshots and the approver);
  4. the `quotation_decision` rows themselves, which are never deleted and only stamped `superseded_at` or `closed_at`.

  The audit-log page (`routes/_next/audit-log.tsx`) filters by action, so `quotation.decision.correct` is findable there.

**Performance & Scalability**

1. **Pagination.** `decisionHistory` is per quotation and capped at 50 rows (realistically 1-3). The queue uses the engine's existing `listQueue`, whose bounds are unchanged.
2. **SQL-side filtering.** Every lookup (open proposal, current decision, order existence, `source_quote_id` existence) is a WHERE clause. None filters in memory.
3. **N+1.** None. `retrieve` adds one select, apply runs a fixed 5-6 statements, and history is one query. The queue page joins in one query if 2.6 adds an endpoint.
4. **Index coverage.**
   - `quotation_decision_quotation_idx (organization_id, quotation_id, requested_at)` serves history and the current/open lookups.
   - The two partial uniques serve "current" and "open".
   - Order existence: `collective_order.quotation_id` has **no index** (verified: only the column at `:138`). `retrieve` already runs the same lookup at `quotation.ts:2381-2389`, so it is not new load, but the correction adds two more call sites. This plan does not add the index; flagged for step 11's plan.
   - `cost_line (organization_id, source_quote_id)`: no index. The existence probe is `LIMIT 1` and runs only on an outcome-changing correction (rare, operator-triggered). If `EXPLAIN` shows a seq scan on a large ledger, add a partial index `where source_quote_id is not null` in the same migration, which is still 0074.
   - The backfill's `LATERAL` over `audit_log` filters on `action` (`audit_log_action_idx`) and then `target_id`. It runs once and only over decided quotations, which number in the hundreds.
5. **Write atomicity.** `requestDecisionCorrection` puts the proposal insert, the submission and the audit row in one transaction. Apply puts the quotation update, the supersede stamp, the applied stamp, the audit row, the reviewer's decision row and the submission status in one transaction (the engine's). `decide` puts its update plus the history insert in one.
6. **Row locking.**
   - Request: the quotation is read `FOR UPDATE` before the no-op, D4 and current-row checks, and the open-proposal partial unique backs it up.
   - Apply: proposal and quotation are both `FOR UPDATE`, and the stale check compares `supersedesId` to the current row read under that lock.
   - `convertToOrder`: its open-proposal check has no lock, so a request committing concurrently with a conversion could slip through. Apply's D4 re-check refuses the outcome change afterwards, so the failure mode is a proposal that cannot be approved, not corrupted data.
7. **Connections/resources.** No new connections or external calls.
8. **Tenant isolation.** Every new query filters `organization_id`. The request path also applies `applyScope(..., quotationScopeCols)`. Apply uses org scope, matching the engine's `repaintCache` (the reviewer may sit outside the quotation's branch scope, which is how every review already works). `decisionHistory` runs a scoped existence check before reading.
9. **Payload size.** `retrieve` gains one small object and one boolean. History rows are small text.
10. **Hot path.** `retrieve` runs on every record-page load, and adds one indexed point select. The queue page is operator-triggered. No `staleTime` change is needed.

## 9. Decision Register, Open Questions & Risks

### Settled 2026-09-15 — was blocking

**D1: Through what path is a decision corrected?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | A new `quotation_decision` trigger in the audit engine, plus an optional `onPassed` hook that applies the correction when the review passes | Reuses flows, stages, quorum, queues, retract, Parameter Setting and the Step 08 self-decision refusal. Tenants configure who signs. Costs one hook in shared engine files that Step 08 is also editing, and a flow that existing orgs must be re-seeded to get. |
| **B** | A quotation-local two-person rule: `requestDecisionCorrection` and `resolveDecisionCorrection` in `quotation.ts`, where the resolver holds `quotation.review` and is not the requester | Touches no engine file and no Step 08 overlap. It is exactly the parallel review mechanism the engine exists to remove: its own queue, its own retract, no configuration. `sales` hold `quotation.review` via the root grant, so any salesperson could approve a peer's correction. |
| **C** | A direct correction behind a new `quotation.decision.correct` node (branch-manager/admin), with a mandatory reason and history, and no second person | Smallest build. The history table still keeps both stamps. The person being measured on win-rate can rewrite it alone, which is the "silently overwrites a commercial outcome" the `decide` docblock refused. |

- **Recommendation: A.** `decide`'s own docblock asks for "a path that is visibly a correction". The engine already gives every other state change in this module a submitter, a reviewer, a queue and a trail, and the brief says to reuse Step 08's machinery.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, it blocks Tasks 1.2-1.5 and 1.7.
- **Where it lands:** §4 engine extension. Tasks 1.2, 1.3, 1.7, 2.6.

**D2: Where do superseded decisions live?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | A new `quotation_decision` history table (one row per decision or correction) with the `quotation` columns as the current projection | Both stamps are queryable, the proposal row doubles as the engine resource, and the partial uniques enforce one current and one open per quotation. Needs migration 0074 and a backfill. |
| **B** | No table: overwrite the columns and keep the original only in `audit_log` before/after JSON | No migration. History is text JSON with no `target_id` index and no row to review, which forces D1 toward B or C. "Keeps both stamps" becomes true only for someone reading the audit log by hand. |
| **C** | Add `original_*` columns on `quotation` (the first decision only) | A small migration. Loses every correction after the first, and there is still no proposal row for review. |

- **Recommendation: A.** D1-A needs a resource row to review. 0065 already set the precedent that status alone is not a record, and a history table is the only option that lets a future report ask "as first recorded" versus "as corrected".
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, it blocks Task 1.1.
- **Where it lands:** §4 data model. Tasks 1.1, 1.4, 2.4.

**D4: What happens when the quotation's outcome already has dependants (an order, or ledger lines)?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Refuse an **outcome** change while an order (`collective_order.quotation_id`) or ledger lines (`cost_line.source_quote_id`) exist. Date, reference and note stay correctable, and a `converted` status is kept | Nothing downstream is contradicted. The operator must delete the order or reverse the lines first, and the message names what is blocking. A Won-then-converted deal the customer really refused needs order cleanup first, which is step 11+'s domain. |
| **B** | Allow the outcome change and flag the order ("quotation corrected to Lost") for operations to act on | The report is fixed immediately. Leaves a live order and receivables contradicting a Lost quotation, and needs a flag surface on the order that no plan owns. |
| **C** | Cascade: a correction to Lost cancels the order and voids unbilled lines | Most complete. Reaches into collective-order and expense money paths from a sales correction, and billed lines cannot be voided. That scope is far beyond step 10. |

- **Recommendation: A.** `decide` already refuses on `converted` because "re-labelling it lost would contradict the order" (`quotation.ts:2896-2898`). A matches that reasoning and keeps money paths out of a sales correction.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, it blocks Tasks 1.3 and 1.4 (the refusal helper).
- **Where it lands:** §4 request and apply. Tasks 1.3-1.5.

### Settled 2026-09-15

**D3: Who approves a correction in the seeded flow?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | `branch-manager`, the same as the seeded quotation flow, plus the Step 08 self-decision refusal | Matches the existing quotation review, and branch managers already hold `quotation.review`. A manager correcting their own team's win-rate is a mild conflict of interest. |
| **B** | `director`, plus a new `quotation.decisionCorrection.review` leaf granted to director | An independent reviewer, like the A2 and bill queues. Needs a new permission node, a `roles.ts` grant and a `reviewNode` change, and director cannot read quotation detail today beyond `quotation.read`. |
| **C** | Owner/admin only | The strictest option. Admins become a bottleneck for a routine data-entry fix, and no seeded flow routes to admin today. |

- **Recommendation: A.** It matches the one quotation flow already seeded. Tenants can re-route it in Parameter Setting without code, and the self-decision refusal closes the only real hole.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No. It is seed data and can change before Task 1.2 lands.
- **Where it lands:** `seed.ts` `SEEDED_FLOWS`. Task 1.2.

**D5: Can a correction withdraw the decision entirely ("Not decided yet")?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Yes: outcome `sent` nulls the four stamps and returns status to `sent` | Covers the likeliest mistake: pressing Decide on the wrong quotation, or before the customer answered. The quotation becomes editable and decidable again. |
| **B** | No: only Won ↔ Lost plus date/reference/note | Simpler. A premature decision can only be "corrected" to the other wrong answer. |
| **C** | Withdraw only within N days of the decision | Bounds abuse. The window is arbitrary, and needs a parameter or a hard-coded constant. |

- **Recommendation: A.** The review already guards against abuse, and a premature decision is a real failure mode that B cannot fix at all.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No. It changes one enum value and one dialog option, and can wait until Task 1.4.
- **Where it lands:** §4 contract. Tasks 1.3, 1.4, 1.6.

**D6: What happens when an org has no enabled Decision-correction flow?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Refuse: _"Decision corrections need a review flow. Ask an admin to enable 'Decision correction' in Parameter Setting."_ Seed it enabled for new orgs, and ship a re-seed script for existing ones | Never unreviewed. It is the same rule `submitForReview` applies to every trigger. Existing orgs are blocked until the script runs, so it is part of the deploy. |
| **B** | Fall back to a direct correction by any `quotation.review` holder who is not the requester | Always available. It is a second, hidden policy that bypasses a tenant's decision to disable the flow. |
| **C** | Seed the flow lazily inside `requestDecisionCorrection` when missing | No deploy step. A write to org configuration inside a sales request, and it resurrects a flow an admin deliberately deleted. |

- **Recommendation: A.** `seedAuditFlows` is already idempotent (`seed.ts:196-198`), so the script is safe to re-run. Every other trigger refuses without a flow.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No, but the script must run before any browser verification against an existing org.
- **Where it lands:** Tasks 1.4 and 2.3, and the §10 preconditions.

### Assumed

**D7: Where does the reviewer act?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | A panel on the quotation record page, plus a thin `/approve/decision-correction` queue page linking to it | The reviewer sees the thread and the decision in context, and the queue gives discovery through the approvals card. One new route. |
| **B** | Queue page only, deciding from the table | Matches `/approve/quotation`. The reviewer decides without the customer's reply in view. |
| **C** | Record page only, with no queue | No new route. A pending correction is undiscoverable unless someone links it. |

- **Recommendation: A.** The only evidence for a correction is the customer thread on the record page (`LinkedThreadsCard`, `$quotationId.tsx:519`).
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Tasks 1.7, 1.8, 2.6.

**D8: What do reports read as the true outcome?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | The `quotation.status` and `decided_*` columns, which apply keeps current; history is for audit and "as first recorded" analysis | Every existing reader (list filter `:2041`, badge, `importFromQuote` gate, send CASE) is correct with no change. A future win-rate report reads one table. |
| **B** | Readers take the latest applied `quotation_decision` row | One source of truth. Every existing reader must be rewritten to join, and the columns would drift. |
| **C** | A SQL view `quotation_current_decision` | Tidy for future reports. It is a second projection of the same fact, and no report exists to consume it yet. |

- **Recommendation: A.** It is the pattern `audit_status` already follows, a cache repainted by the one writer, and it needs zero reader changes.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4 apply. Task 1.3.

**D9: Can Convert or Post to ledger run while a correction is pending?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Refuse both while a proposal is open | A Won → Lost correction cannot be overtaken by a conversion that then blocks it (D4). Adds one check each to two handlers. |
| **B** | Allow both; apply re-checks D4 and refuses | No new guard. The reviewer finds an unapprovable correction later. |
| **C** | Allow, and auto-reject the pending correction on conversion | Self-healing. The engine gains a side door that rejects a submission with no reviewer. |

- **Recommendation: A.** Refusing before the conflicting action is cheaper than an unapprovable queue item.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Tasks 2.1, 2.2, 2.5.

**D10: Is decision history backfilled for quotations decided before 0074?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Backfill one `kind: 'decision'` row per stamped quotation, with the outcome from its `quotation.decide` audit row, falling back to `status` when it is won/lost; skip converted rows with no audit row | Existing decisions become correctable with a proper stale check, and nothing is invented. The skipped rows correct with `supersedesId = NULL`. |
| **B** | No backfill; history starts at 0074 | Simplest migration. Every existing decision's correction has no "original" row, so the history card shows only the correction. |
| **C** | Backfill everything, inferring `won` for converted rows | Complete-looking. It invents an outcome for a Lost quotation that was converted (possible, see Phase 0), which is the fabrication 0065 refused. |

- **Recommendation: A.** It is honest about unknowns and follows 0065's "NULL reads as we do not know" rule.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4 migration. Task 1.1.

**D11: Which migration number does this ship as?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Reserve `0074`, and renumber to the next contiguous idx at merge if 0066-0073 are not all in | Honours the coordinator's reservation. The merge step must re-read the journal. |
| **B** | Take the next free number now (`0066` at HEAD) | Contiguous today. Collides with step 01. |
| **C** | Ship without a migration (D2-B) | No number. Loses the history table. |

- **Recommendation: A.** The coordinator assigned 0074, and the `idx`-contiguous gate forces the renumber check anyway.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No; it is resolved at merge.
- **Where it lands:** Task 1.1.

**D12: Where the step guide and the code disagree, which does the plan follow?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Follow the code, and record each conflict | The plan is built on what runs. |
| **B** | Follow the guide | The plan would target a win-rate report that does not exist and a Won-only conversion that is not enforced. |
| **C** | Stop and ask | Nothing ships. |

- **Recommendation: A.** The conflicts are:
  1. The guide cites `quotation.ts:2855`; the gap is named at `:2860-2863` and `decide` is at `:2865` (HEAD `6bb3a1bf`).
  2. "Poisons win-rate reporting": no win-rate report exists. The readers are the list filter, the badge, the `importFromQuote` gate and the send CASE.
  3. "Won → step 11 Convert to order": `convertToOrder` does not check the outcome at all, and a Lost quotation can be converted. The plan does not change that (out of scope, flagged for step 11), and D4 accounts for it.
  4. "The quotation becomes read-only": true for `update`, but Convert and Post to ledger remain available on a decided quotation.
  5. The golden-path citations `$quotationId.tsx:531` (Threads) and `decide-quotation-dialog.tsx:181` (Record decision) are still accurate.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Phase 0, §1.

### Risks
- _Step 08 lands without the code-level self-decision refusal and only re-points the seed to director_ → medium likelihood, high impact, because a requester who holds the stage role approves their own correction → **Task 1.2 adds the refusal for `quotation_decision` itself (`submission.submittedBy === org.membership.id` → FORBIDDEN in `decide.ts`) if Step 08's version is absent at rebase.**
- _Engine files conflict with Step 08 mid-flight_ → high likelihood if run concurrently → **Phase 1 starts only after Step 08 merges; Agent A rebases and re-runs `modules/audit/*.test.ts`.**
- _Apply writes under org scope while the reviewer sits outside the quotation's branch scope_ → low impact, and it is the engine's standing model (`repaintCache` writes by id) → **accept, and state it in the architecture-test writer comment.**
- _Existing orgs have no flow at deploy_ → certain without the script → **run `seed-audit-flows.ts` as part of the Phase 1 deploy, and put it in §10 preconditions.**
- _A `card-approvals.tsx` map typed on the trigger breaks Phase 1 type-check_ → medium likelihood → **Agent A checks the map type in 1.2. If it is exhaustive, B takes the key in Phase 1.**
- _`gen_random_uuid()` fails the PGlite replay_ → low likelihood → **fall back to `md5(random()::text || q.id)` ids, and verify with `migrations.test.ts` before commit.**

### Settlements that span plans (2026-09-15)

- **X1 (option A).** Task 1.2 turns step 08's `separationOfDuties` switch on for the `quotation_decision` resource in `REVIEWABLE_RESOURCES`. Without this, step 08's self-decision refusal does not reach corrections, and D3's "the requester can never approve their own correction" is not true. Add that case to the Task 1.7 test.
- **X4 (option C).** `quotations.decide` is **not** frozen while a quotation is under review. This agrees with step 08 D6: the customer's answer is a real event, and Convert to order stays gated on approval.
- **X5 (option B).** `convertToOrder` never checks for Won, so a Lost quotation converts. This belongs to the step 11 plan and is logged in `steps-4-10-crosscheck.md`. D4-A's refusal is not affected.

## 10. Verification & Proof

**App URL:** http://localhost:3101 (server :3000)
**Preconditions:**
- A seed-parity org (`e2e/fixtures/seed-cli.ts seed-parity <runId>`), with the migration applied and confirmed in the journal, and `seed-audit-flows.ts` run.
- Two members with minted cookies: **sales** (requester) and **branch-manager** (reviewer).
- A quotation sent through step 09 (has `sentAt`) and decided **Won** with reference `PO-1`.
- A second Won quotation already converted to an order.
- Announce the active org before driving the browser, because the session is shared.

**Migrations:** `0074_quotation_decision` (renumbered per D11). Check the journal entry, not the command's exit code.

**Golden path, Journeys 1 and 2:**
1. As sales, open `/quotations/<wonId>` → the header reads **Won · by <sales> on <date>** and shows **Correct decision**.
2. Press **Correct decision** → the dialog is prefilled with Won, the date and `PO-1`.
3. Choose **Lost**, clear the reference, leave Reason empty, and press **Request correction** → an inline _"Say why the recorded decision is wrong."_ appears.
4. Type Reason _"Customer declined by email 04 Sep"_ and press **Request correction** → toast _"Correction sent for review"_. The header still reads **Won**, with a **Correction pending review** chip. **Post to cost ledger** and **Convert to order** are disabled.
5. As sales, press **Approve** on the panel (if it is shown) or call `decideByResource` → refused: _"You cannot approve a correction you requested"_.
6. Switch to branch-manager and open the dashboard → the approvals card shows **Decision correction · 1**. Open it → `/approve/decision-correction` lists the quotation with Won → Lost and the reason.
7. Open the row → the **Pending correction** panel shows Recorded (Won, PO-1) against Proposed (Lost, blank).
8. Press **Approve** → toast _"Correction approved: NCT-Q-… is now Lost"_. The header reads **Lost · by <sales> on <date>** with a **Corrected** tag, and the panel is gone.
9. The **Decision history** card shows two rows: Decision · Won · PO-1 · **Superseded**, and Correction · Lost · reason · approved by <manager> · **Current**.
10. `/quotations?status=won` no longer lists the quotation, and `?status=lost` does.
11. `/audit-log` filtered to `quotation.decision.correct` shows one row whose before/after holds Won/PO-1 → Lost/null.

**Edge case:** on the **converted** quotation, request Won → Lost → the dialog shows _"This quotation has order ORD-… — its outcome cannot be changed while the order exists."_ and nothing is submitted. Then change only the Decision date → the request is accepted, and after approval the badge still reads **Converted** with the new date in history.
**Second edge:** request a correction, then as sales press **Retract** → the chip disappears, and the history row reads **Retracted**, with the quotation unchanged.
**Regression check:** the ordinary Decide on a fresh sent quotation still records Won, and the toast and "by X on Y" line are unchanged. Pressing Decide again (via the API) returns the new message _"… Use Correct decision to change it."_ The `quotation.send-decide.test.ts` race test (`:292`) still passes, and `/approve/quotation` still lists quotation submissions only.
**Mobile:** at 400px the Correct decision dialog fits without horizontal scroll, the Recorded/Proposed table in the panel stacks or scrolls inside its card, and the history card wraps.

_2026-09-15: Wilfred chose the recommendation for every open decision in §9. The readiness points held back for pending decisions no longer apply._

**Readiness: 6/10.** D1, D2 and D4 are open and blocking, and they shape the whole build. The plan also extends shared engine files that Step 08 is changing (the self-decision refusal is a hard dependency). The migration number depends on 0066-0073 merging, existing orgs need a re-seed at deploy, and the `listQueue` payload's fitness for the queue page (2.6) is unverified.
