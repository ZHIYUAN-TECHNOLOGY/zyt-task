# Step 04 — a rate card nobody approved cannot price a quotation

**SOP step:** 04 "Publish the rate card" · `/fee-templates` → `/fee-templates/$templateId` → `/approve/template`
**Evidence read at:** the JSON was captured at `6c31a20e`; this plan re-read the code at HEAD `6bb3a1bf` (`feat/new-layout`), 2026-09-15
**Tier:** Standard (migration, a write-path refusal on money, org-scoped audit-flow data for every existing tenant)

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers`, the audit engine in `packages/api/src/modules/audit`, Drizzle + drizzle-kit (`packages/db/src/schema`, migrations in `packages/db/src/migrations`), TanStack Router file routes under `apps/web/src/routes/_next`, zod on both sides, vitest (PGlite), Playwright under `e2e/`.
- **What the defect says is true: the gate row is missing.** `SEEDED_FLOWS` in `packages/api/src/modules/audit/seed.ts:134-143` seeds `fee_template` / "Expense template review" as **enabled**, with one branch-manager stage and `gates: []` (`:141`). The key is declared, though: `defineGates("fee_template", [{ key: "reference_fee_template", label: "Reference Template" }])` at `packages/api/src/modules/quotation/gates.ts:17`.
- **What the JSON's repair gets wrong about the code.** It offers "enforce approved-only inside applyTemplate" as an alternative. `applyTemplate` **already** calls `assertGateCleared(…, "fee_template", template.id, "reference_fee_template")` at `packages/api/src/routers/quotation.ts:3593-3599`. The code is wired; only the data is missing. `assertGatesCleared` returns early when the flow has no gate row (`packages/api/src/modules/audit/gates.ts:81-85`), and that early return is the whole hole. Logged as D7.
- **A second hole the JSON does not mention: a NEW quotation never calls `applyTemplate`.** In `apps/web/src/components/reference-template-dialog.tsx`, `handleApply` (`:495`) pushes lines into the unsaved form on the client when there is no `quotationId` (`:515`, via `toDraftLine` `:175-205`, which stamps `listTemplateId: templateId`). Those lines reach the server through `quotations.create` → `resolveFeeLineProvenance` (`quotation.ts:1695`, called at `:3008`), which checks **only** that the template id exists in the org. So seeding the gate row alone still leaves this path open: **new quote → tick Show all templates → pick a draft card → Apply → Save**. `quotations.update` reaches the same function (`:3261`), with any `listTemplateId` the payload carries.
- **Changing the seed does not reach existing orgs.** `seedAuditFlows` skips any trigger that already has a flow (`seed.ts:222-223`, *"an org's later edits are never overwritten"*), and its only production caller is `org.create` (`packages/api/src/routers/org.ts:132`). Every live org, including production (Neon `br-round-sun`), keeps `gates: []` until something writes the row. That makes a backfill necessary (D1).
- **A tenant can already arm the gate by hand.** Parameters → Approval flows (`apps/web/src/components/parameters/approval-flows-tab.tsx`, backed by `packages/api/src/modules/audit/flow-admin.ts`, which validates keys against the vocabulary at `:159`) renders **Reference Template** as a checkbox. Nobody has ticked it, because nothing tells them to.
- **The gate and the floor read two different sources.**
  - The gate reads the **latest `audit_submission`** (`gates.ts:90-92`, `shared.ts:332`).
  - The price floor reads the **`fee_template.audit_status` cache**: `loadTariffCells` `quotation.ts:1811` (`:1845`) and `loadOrgTariffCells` `:1881` (`:1908`).
  - The picker's default filter also reads the cache: `reference-template-dialog.tsx:260`.

  The sources disagree in one reachable case. `feeTemplates.update` re-prices an approved sheet and repaints the cache to `draft` (`quotation.ts:1071-1077`), while its `passed` submission stays the latest one. The floor then drops the sheet, but the gate still lets it be applied at the new, unapproved prices. This is reachable only when the flow allows editing after approval, because `assertPostApprovalEditable` (`:983`) refuses the edit otherwise. The seed sets `postApprovalEditable: false` (`seed.ts:232`), but `e2e/specs/quotation.tariff-check.spec.ts:118` and several audit specs configure `true`. See D3.
- **The legacy `feeTemplates.review`** (`quotation.ts:1321-1357`) still flips the cache with no submission behind it. No web page calls it: the queue uses `engineDecideBatch("fee_template", …)` at `apps/web/src/routes/_next/fee-templates/index.tsx:249`, and `qa/runner.mjs:27699` records that. `feeTemplates.review` is still mounted and granted, though. Out of scope here: step 08 Task 3.3 deletes it (X3, 2026-09-15).
- **The review queue already works and needs no code change to decide.** `/approve/template` (`apps/web/src/routes/_next/approve/template.tsx:37`) mounts `FeeTemplatesPage mode="review"`. The list is scoped by `awaitingMyReview` (`quotation.ts:794`). Approved / Rejected call `engineDecideBatch` → `auditReview.decideByResource`. The editor's **Review → Submit for review** is `ReviewMenu` at `apps/web/src/routes/_next/fee-templates/$templateId.tsx:655`. Once this plan arms the gate, the queue sits on sales' critical path, so the plan proves it end to end (§10) and gives the refusal wording a pointer to it.
- **Tests: precedent and blast radius.**
  - `packages/api/src/modules/audit/seed.test.ts:154-170` pins the seeded gate keys for `quotation` and `bill`, and the new key gets the same pin.
  - `gates.test.ts:91` checks every seeded key against the vocabulary. `gates.test.ts:50-64` scans `src` for `assertGates?Cleared(` calls whose resource type and key are **string literals**, with no comma inside the ids argument. A second caller must follow that shape, or the "every caller passes a declared key" guard cannot see it.
  - `quotation.rate-card.test.ts` (13 `applyTemplate` references) and `quotation.apply-picks.test.ts` (26) never call `seedAuditFlows`, so they have no flow and stay green.
  - The e2e specs that touch template review build their own flow with `gateKeys: []` (`quotation.tariff-check.spec.ts:125`, `quotation.tariff-deal.spec.ts:168,364`, `audit.template-queue.spec.ts:43`), so they stay green but prove nothing about the gate.
  - `seed/tariff.ts:259-268` submits and approves its demo sheets, so the demo tariff survives the gate.
- **Migration state.** The journal has 65 entries ending `0065_quotation_send_decision` and there are 65 `.sql` files, contiguous, nothing pending. Steps 01 and 02 have claimed `0066` and `0067`; neither is on disk yet. **This plan reserves `0068`.** Precedent for a data migration: `0054_lading_views_move.sql` does `INSERT … SELECT gen_random_uuid()::text … ON CONFLICT`, and it already passes the PGlite chain replay, so `gen_random_uuid()` is safe there. The unique index `auditFlowGate_flowId_gateKey_uidx (flow_id, gate_key)` (`packages/db/src/schema/audit.ts:334`) makes `ON CONFLICT DO NOTHING` exact. `packages/db/package.json` has only `db:generate` (`drizzle-kit generate`). A data-only migration has no schema diff, so it has to be generated with `drizzle-kit generate --custom` (or written by hand with a matching journal entry and snapshot) and pass the three gates in `packages/db/src/migrations.test.ts`.

---

## 1. Overview

**Problem.** "Expense template review" is switched on in every org and reviewers do approve rate cards at `/approve/template`, yet the server lets a card nobody approved price a real quotation. Two paths are open:

1. **Saved quotation.** `applyTemplate` asks the gate, but the flow carries no gate row, so the answer is always "go ahead".
2. **New quotation.** The picker copies lines on the client and `quotations.create` never asks at all.

The only thing standing between a draft price and a customer is the picker's default filter, and **Show all templates** turns it off. The draft card also sets no floor (`loadTariffCells` reads approved only), so the quote carries unreviewed prices with nothing holding them.

**Goal.** Once an org's template flow says approval is required, no path writes a template-sourced line from a card whose review has not passed. That must hold for new orgs, for existing orgs, and in the picker the operator actually uses. A tenant that switches the flow off keeps pricing freely, as the engine intends (`gates.ts:22-24`).

**Success criteria.**

- `quotations.applyTemplate` on a never-submitted, pending or rejected template answers `CONFLICT "Reference Template" requires review approval first`, in every org whose `fee_template` flow is enabled.
- `quotations.create` / `quotations.update` refuse a fee line that **newly** references such a template, with the same message. A line already on the quotation keeps round-tripping.
- After migration `0068`, every existing org's `fee_template` flow carries the `reference_fee_template` gate row, and a new org is seeded with it.
- In the picker, an unapproved card is visibly not applicable when the org requires approval, and the refusal names where to get it approved.
- Golden path proven in the browser: build a card → Submit for review → approve in `/approve/template` → the card prices a quote.

**In scope.** The seed entry and its test; migration `0068` (backfill); the gate on the provenance path; the reopened-sheet predicate (D3); an additive list flag and the picker UX; API tests; one e2e spec covering the queue.
**Out of scope.**

- Removing the legacy `feeTemplates.review` (see the risk in §9).
- Gating `quotations.duplicate`, which copies stored provenance and is not a new reference (D6).
- Changing the floor's cache read.
- The four-condition filter and group logic in the picker.
- Anything in steps 05–10.

**Inputs read.** `steps/step-04.json`, `steps/step-04-findings.json` (one finding, `nct-s04-the-tariff-gate-is-declared-but-never-enforced`, whose sole repair this plan implements). The JSON's pitfalls 1 and 2 are both addressed. Nothing in them is declined.

**Assumptions.**

- Backfill with a migration, not a one-off script → D1
- Close the new-quote path inside `resolveFeeLineProvenance`, gating only newly referenced template ids → D2
- A sheet re-priced after approval counts as unapproved for referencing → D3
- The picker learns whether approval is required from an additive flag on `feeTemplates.list` → D4
- Unapproved cards in live orgs are not grandfathered → D5
- Duplicating a quotation is not a new reference and stays ungated → D6
- The JSON's "enforce inside applyTemplate" alternative is already implemented; the repair is data plus the second path → D7
- Cost-side templates are gated too; the gate is per template, not per side → D8

## 2. User Journeys

**Journey 1 (changed): Sales prices a SAVED quotation from a card nobody approved**
Trigger: Quotation detail → Fee lines → **Reference Template**.
Old steps, for contrast: tick **Show all templates** → pick the draft card (subtitle reads "Draft") → Next → tick cells → **Apply** → toast *Template lines applied*. The quote now carries unreviewed prices and the floor banner reads *The tariff price floor is not enforcing anything on this quotation.*
New steps:

1. User opens **Reference Template** → the dialog lists approved cards (unchanged).
2. Ticks **Show all templates** → draft, pending and rejected cards appear with their status in the subtitle (unchanged). **New:** when the org requires approval, each such row is disabled and reads *Not approved — submit it for review before pricing from it*.
3. The user cannot choose the row, so **Next** stays disabled for it. This step happens inline in the dialog.
4. If an out-of-date client still sends the apply, the server refuses: toast *"Reference Template" requires review approval first*.
5. Flow ends: no line is written, and the quotation is unchanged.

Where it lives: the existing Reference Template dialog on `/quotations/$quotationId`.

**Journey 2 (changed): Sales prices a NEW quotation from a draft card**
Trigger: `/quotations/new` → Fee lines → **Reference Template**.
Old steps: identical to the old Journey 1 up to Apply. Lines land in the unsaved form, **Save** creates the quotation, and the draft prices are stored with `price_source = tariff|deal|template`.
New steps:

1. Same dialog, with the same disabled rows as Journey 1 step 2, so the draft card cannot be picked.
2. If lines reach Save anyway (an old client or a hand-built payload), `quotations.create` refuses the whole save with *"Reference Template" requires review approval first*. The form keeps every value, and the error comes through the page's existing save-error toast.
3. Flow ends: nothing saved. The user removes those lines or waits for approval.

Where it lives: the same dialog, inline, and the quotation form's Save.

**Journey 3 (unchanged path, now load-bearing): Sales admin publishes a card, a reviewer approves it, Sales prices from it**
Trigger: Sales → Fee templates → **Add**.

1. User fills Template Name, Business Type, Fee Type = Selling Price, billing units, fee rows → **Save Template** → toast *Template created* (unchanged).
2. Header **Review** → **Submit for review** → the list shows the template as *Pending* (unchanged).
3. Reviewer opens **Approvals → Expense template** (`/approve/template`) → the row is listed with the Submit staff columns → ticks it → **Approved** → toast *1 template(s) approved*, and the row leaves the queue (unchanged).
4. Sales opens **Reference Template** on a quotation → the card is in *Standard tariff* (or *Deals for …*) without Show all → Next → tick cells → **Apply** → toast *Template lines applied*.
5. Flow ends: the lines carry the card's prices, and the floor enforces them.

Where it lives: `/fee-templates/$templateId` header, `/approve/template` toolbar, and the quotation's dialog.

**Journey 4 (unchanged, must keep working): a tenant with template review switched off**
Trigger: owner disables "Expense template review" in Parameters → Approval flows.

1. Sales ticks Show all → draft cards are **selectable** (the flag reads false) → Apply succeeds, and so does Save on a new quote.
2. Flow ends: behaviour is identical to today for that tenant.

## 3. Result (What Changes for the User)

**Before:** A draft or rejected rate card prices a customer's quotation as soon as someone ticks Show all templates, on both new and saved quotes, while the approval queue looks as if it were guarding something.
**After:** In every org that reviews templates, only an approved card can be referenced onto a quotation. The picker says why a card is unavailable, and the server refuses it on every write path.
**Key differences:**

- Sales: unapproved cards under Show all are greyed out, with the reason, when the org requires approval.
- Sales: a save or apply carrying an unapproved card is refused with one message, instead of succeeding silently.
- Reviewer: approving in `/approve/template` is now what releases a card for pricing. The queue itself is unchanged.
- Owner: Parameters → Approval flows shows **Reference Template** ticked on Expense template review, and unticking it restores today's behaviour.

## 4. Technical Architecture

**Data flow.** Each write path that references a template onto a quotation runs the engine's own gate against the *template*:

- **Saved-quote apply:** `applyTemplate`, already gated. It gains the reopened-sheet predicate.
- **New or edited lines:** `resolveFeeLineProvenance` gains the gate for newly referenced ids.
- **The data:** the seed and migration `0068` give the gate its row.
- **The picker:** reads one boolean to render what the server will say.

**4.1 Seed (serves Journey 1 step 4 and Journey 2 step 2 for new orgs).**
`packages/api/src/modules/audit/seed.ts:141`:

```ts
// eyun's Fee Template trigger is one checkbox and its shipped template ticks it:
// a card still under review must not be priced from (modules/quotation/gates.ts).
gates: ["reference_fee_template"],
```

**4.2 Migration `0068_fee_template_reference_gate.sql` [NEW] (serves the same steps for existing orgs) → D1.**

```sql
-- Arms the Reference Template gate on every org's Expense template review flow.
-- seedAuditFlows skips an existing trigger whole, so the seed change alone never
-- reaches an org created before it. ON CONFLICT: an org that already ticked it by
-- hand in Parameters → Approval flows keeps its single row.
INSERT INTO "audit_flow_gate" ("id", "flow_id", "gate_key")
SELECT gen_random_uuid()::text, f."id", 'reference_fee_template'
FROM "audit_flow" f
WHERE f."trigger_type" = 'fee_template'
ON CONFLICT ("flow_id", "gate_key") DO NOTHING;
```

- Every `fee_template` flow gets the row, enabled or not. A disabled flow freezes nothing (`gates.ts:78-79`), so turning review on later arms the gate without a second step.
- No schema change. It is generated with `drizzle-kit generate --custom --name fee_template_reference_gate` so the journal entry and snapshot come out right.
- Rollback statement (documented, not shipped): `DELETE FROM audit_flow_gate WHERE gate_key = 'reference_fee_template'`. That would also delete rows ticked by hand. Acceptable: none exist today, and the §7 pre-flight query confirms it.

**4.3 Gate on the provenance path (serves Journey 2 step 2) → D2.**
In `resolveFeeLineProvenance` (`quotation.ts:1695`), after the org-existence query and before the mapping:

```ts
// A line that NEWLY points at a template is a reference, the same verb as
// applyTemplate, so it clears the same gate. A line round-tripping the template
// it already had is not: re-saving an old quote must not be refused because its
// card was later superseded or re-opened.
const newlyReferenced = [
  ...new Set(
    feeLines
      .filter((l) => l.listTemplateId && (l.id ? existing?.get(l.id)?.listTemplateId : null) !== l.listTemplateId)
      .map((l) => l.listTemplateId as string),
  ),
];
await assertTemplatesReferenceable(db, organizationId, newlyReferenced);
```

- Called after the org-scoped existence check, so a foreign id still answers `BAD_REQUEST … does not exist in this organization` before any review state is described. That is the rule in `gates.ts:60-62`.
- One batch call. `assertGatesCleared` is all-or-nothing, with a count.
- `existing` is `undefined` on `create`, so every referenced id counts as new there.

**4.4 One helper, both callers (serves Journey 1 step 4 and Journey 2 step 2) → D3.**
A module-local function in `quotation.ts`, beside `resolveFeeLineProvenance`:

```ts
async function assertTemplatesReferenceable(
  db: Context["db"] | DbTransaction,
  organizationId: string,
  templateIds: readonly string[],
): Promise<void> {
  if (templateIds.length === 0) return;
  // Literal resource type and key: gates.test.ts scans for exactly this shape.
  await assertGatesCleared(db, organizationId, "fee_template", templateIds, "reference_fee_template");
  // D3 — a passed review whose sheet was re-priced afterwards (update's reopen
  // path repaints the cache to draft and leaves the submission passed). Only
  // consulted when the gate is armed, so a review-off tenant is untouched.
  if (!(await referenceGateArmed(db, organizationId))) return;
  const reopened = await db
    .select({ id: feeTemplate.id })
    .from(feeTemplate)
    .where(and(eq(feeTemplate.organizationId, organizationId), inArray(feeTemplate.id, [...templateIds]), ne(feeTemplate.auditStatus, "approved")));
  if (reopened.length > 0) {
    throw new ORPCError("CONFLICT", { message: `"Reference Template" requires review approval first` });
  }
}
```

- `applyTemplate` (`:3593-3599`) replaces its inline `assertGateCleared` with `assertTemplatesReferenceable(context.db, organizationId, [template.id])`.
- `gates.test.ts`'s scan still sees the `fee_template.reference_fee_template` literal pair inside the helper, so the caller-sync guard stays satisfied.
- `referenceGateArmed(db, organizationId)` [NEW, same file] = `enabledFlowFor(db, org, "fee_template")` + a gate-row lookup. Both are exported from `modules/audit/shared.ts` / `schema/audit`, so no engine internals are added.

**4.5 List flag (serves Journey 1 step 2, Journey 2 step 1, Journey 4 step 1) → D4.**
`feeTemplates.list` (`quotation.ts:744-835`) returns `{ rows, total, referenceRequiresApproval: boolean }` from `referenceGateArmed`. The change is additive: `fee-templates/index.tsx` reads `.rows` uncast (its comment at `:215-223`), and the dialog reads `.rows` / `.total`.

**4.6 Picker (serves Journey 1 steps 2–3, Journey 2 step 1).**
In `reference-template-dialog.tsx`, when `templatesQuery.data?.referenceRequiresApproval` is true, a row whose `auditStatus !== "approved"` renders its `RadioGroupItem` `disabled`, with the reason line under the name. The selection guard effect at `:437-444` also clears a chosen id that has become non-applicable.

The `onError` fallback (`:382-388`) is unchanged: the server message is shown verbatim, and the gate message reads correctly on its own. The Show all label (`:~660`) gains *"— templates that are not approved cannot be applied while approval is required"* only when the flag is true.

**Key decisions.** Backfill by migration → D1 · gate only new references → D2 · reopened sheet refused → D3 · server-told flag, not a client guess → D4 · no grandfathering → D5 · duplicate stays ungated → D6 · the JSON's alternative is already implemented → D7 · cost cards gated too → D8.

## 5. Phased Implementation

### Phase 1 — The server refuses an unapproved card on every write path, in every org

**Delivers:** Journeys 1 and 2 at the API boundary (step 4 / step 2), plus Journey 4's "review off stays free". A user with an old picker still cannot price from a draft card.
**Dependencies:** D5 pre-flight count read (§7, blocking). Migrations `0066` / `0067` from steps 01/02 are merged, or `0068` is renumbered at merge.

- **Task 1.1** — Set `gates: ["reference_fee_template"]` on the `fee_template` entry, with the comment. Extend `seed.test.ts`'s "freezes Convert order…" case with `expect(fGates).toEqual(["reference_fee_template"])` for `fee_template`.
  Files: `packages/api/src/modules/audit/seed.ts`, `packages/api/src/modules/audit/seed.test.ts` · Owner: **Agent A (backend)**
- **Task 1.2** — Generate the custom migration `0068_fee_template_reference_gate` with the §4.2 SQL. Confirm the three gates: tags equal files, `idx` contiguous (65 → 66 only after 0066/0067, else renumber), PGlite replay green. Read the `migrations.test.ts` output, not the exit code.
  Files: `packages/db/src/migrations/0068_fee_template_reference_gate.sql` [NEW], `packages/db/src/migrations/meta/_journal.json`, `packages/db/src/migrations/meta/0068_snapshot.json` [NEW] · Owner: **Agent A (backend)**
- **Task 1.3** — Add `referenceGateArmed` and `assertTemplatesReferenceable` (§4.4). Swap `applyTemplate`'s inline gate call for the helper. Call the helper from `resolveFeeLineProvenance` for newly referenced ids (§4.3). Import `assertGatesCleared` and `enabledFlowFor` (the `:38` import line already brings `assertGateCleared`).
  Files: `packages/api/src/routers/quotation.ts` · Owner: **Agent A (backend)**
- **Task 1.4** — API tests in a new file, following `quotation.rate-card.test.ts`'s PGlite setup plus `seedAuditFlows(db, org)`:
  - `applyTemplate` refused for never-submitted, `under_review` and `rejected`, and allowed after `passed`.
  - Allowed when the flow is disabled, and allowed when the gate row is deleted (Journey 4).
  - `create` with a draft `listTemplateId` refused, and nothing inserted.
  - `update` round-tripping an existing line whose card was re-opened is **not** refused, but adding a new line from that card **is** (D2 / D3).
  - Foreign-org id → `BAD_REQUEST`, never `CONFLICT`.
  - Reopened sheet (flow `postApprovalEditable: true`, approve, re-price) → refused (D3).

  Files: `packages/api/src/routers/quotation.template-gate.test.ts` [NEW] · Owner: **Agent A (backend)**

**Acceptance.** `gates.test.ts`, `seed.test.ts`, `migrations.test.ts`, `quotation.rate-card.test.ts`, `quotation.apply-picks.test.ts` and the new file all pass. At the API boundary, a salesperson in a seeded org cannot create a quotation carrying a draft card's line, and can once the card's review has passed.

### Phase 2 — The picker says it, and the queue is proven to release the card

**Delivers:** Journeys 1–3 end to end in the browser, and Journey 4 visibly unchanged.
**Dependencies:** Phase 1 (the `referenceRequiresApproval` field is the contract Agent B consumes).

- **Task 2.1** — Add `referenceRequiresApproval` to `feeTemplates.list`'s return (§4.5). One call per list request, outside the page and count queries.
  Files: `packages/api/src/routers/quotation.ts` · Owner: **Agent A (backend)**
- **Task 2.2** — Picker: disabled unapproved rows with the reason line, the conditional Show-all label suffix, and the selection-clearing guard (§4.6). No change to the grouping, the steps, or the stale-pick handling.
  Files: `apps/web/src/components/reference-template-dialog.tsx` · Owner: **Agent B (frontend)**
- **Task 2.3** — E2E spec on a `seed-parity`-style org **without** reconfiguring the fee_template flow's gates. The spec must not call `configureFlow` with `gateKeys: []` for `fee_template`, which would disarm the gate it is proving. Route the reviewer by member id through `configureFlow` with `gateKeys: ["reference_fee_template"]`, following `quotation.tariff-check.spec.ts:111-126`.
  - Walk Journey 3 through `/fee-templates/$templateId` → Review → Submit, `/approve/template` → Approved, then the quotation's Reference Template.
  - Before approval, assert the row is disabled under Show all, and that an API `quotations/applyTemplate` returns 409.

  Files: `e2e/specs/quotation.template-gate.spec.ts` [NEW] · Owner: **Agent C (test)**

**Acceptance.** A sales admin builds a card, submits it, a branch manager approves it in `/approve/template`, and sales prices a quote from it. Before the approval, the same card is greyed out under Show all and the API refuses it. With the flow disabled, the card is selectable and applies.

## 6. Delegation & Parallelization Plan

**Phase 1 — The server refuses an unapproved card**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.4 | `packages/api/src/modules/audit/seed.ts`, `packages/api/src/modules/audit/seed.test.ts`, `packages/db/src/migrations/0068_fee_template_reference_gate.sql`, `packages/db/src/migrations/meta/_journal.json`, `packages/db/src/migrations/meta/0068_snapshot.json`, `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/quotation.template-gate.test.ts` | `packages/api/src/modules/audit/gates.ts`, `shared.ts`, `gates.test.ts`, `packages/db/src/schema/audit.ts` |

opus — a migration on the gated chain that writes org-scoped audit data for every live tenant, plus a money refusal on the quotation write path.
Run mode: single agent (every task touches `quotation.ts` or the chain).
Serialization points: after 1.2, `migrations.test.ts` output read and journal inspected. After 1.4, `bun run check-types`, grepping the output for "failed" rather than trusting the exit code.

**Phase 2 — Picker and queue**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | sonnet | medium | 2.1 | `packages/api/src/routers/quotation.ts` | — |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 2.2 | `apps/web/src/components/reference-template-dialog.tsx` | `packages/api/src/routers/quotation.ts` |
| Agent C (test) | test-engineer | sonnet | medium | 2.3 | `e2e/specs/quotation.template-gate.spec.ts` | `e2e/fixtures/flow.ts`, `e2e/specs/quotation.tariff-check.spec.ts` |

Run mode: **A → (B ∥ C)**. B waits on the `referenceRequiresApproval` field in `feeTemplates.list`'s inferred output type. C waits on B, because it asserts the disabled row, so in practice it runs **A → B → C**. C may draft in parallel but runs only after B.
Ownership hand-off: `packages/api/src/routers/quotation.ts`: Agent A (Phase 1) → Agent A (Phase 2).

Smell test: every task has one owner · no file owned twice in a phase · B ∥ C file sets disjoint · the one opus justified, no haiku · the sequential wait names its artifact · Phase 1 completes Journeys 1–2 at the API boundary, Phase 2 completes them in the UI.

## 7. Impact & Breakage Analysis

- **`assertGatesCleared("fee_template", …, "reference_fee_template")` becomes live in every org.** Callers after the change: `applyTemplate` (`quotation.ts:3519`) and `resolveFeeLineProvenance` (`:1695`, used by `create` `:3008` and `update` `:3261`), both through the helper. Front-end callers of those procedures:
  - `reference-template-dialog.tsx:366` (`applyTemplate`)
  - the quotation form's create and update on `apps/web/src/routes/_next/quotations/$quotationId.tsx`
  - `seed/tariff.ts` (approves first, unaffected)
  - `qa/runner.mjs` template cases at `:27494-27596`, which submit and decide. Re-run them.
- **Live data.** Any org with unapproved cards that sales currently use loses them the moment `0068` applies. **Blocking prerequisite (Task 1.2):** Wilfred runs, or authorises, a read-only count on production `br-round-sun`:
  - `select audit_status, count(*) from fee_template group by 1`
  - `select count(distinct list_template_id) from quotation_fee_line l join fee_template t on t.id = l.list_template_id where t.audit_status <> 'approved' and l.created_at > now() - interval '30 days'`

  The result settles D5.
- **Quotes already carrying draft-card lines.** They are not refused on re-save, because D2 gates only newly referenced ids. The floor still ignores them (unchanged).
- **Return shape.** `feeTemplates.list` gains one boolean, which is additive. Consumers are `fee-templates/index.tsx:201` (reads `.rows`, uncast) and `reference-template-dialog.tsx:328` (reads `.rows` / `.total`). A grep for `feeTemplates.list` in `apps/web/src` found only those two.
- **Nullable fields relied on.** `quotation_fee_line.list_template_id` is nullable (FK `ON DELETE SET NULL`, `0060`). A null is a manual line and never gated. `fee_template.audit_status` is NOT NULL, defaulting to `draft`.
- **The e2e suite.** Specs that call `configureFlow(… "fee_template", gateKeys: [])` replace the flow's gates and stay green without proving anything. Specs on a freshly created org that apply a **never-submitted** card through the seeded flow would now get a 409. A grep for `applyTemplate` / `listTemplateId` under `e2e/specs` found only `quotation.tariff-check.spec.ts`, which approves first.
- **Deployment coupling.**
  - Migration `0068` and the Phase 1 server code are safe in either order. The migration alone arms `applyTemplate` (already wired); the code alone adds a gate that stays inert until the row exists.
  - Phase 2's web depends on the field. Deploy the server first, per the "build apps/web first / partial deploy splits the stage" memory. An old web against the new server still works: refusals arrive as toasts.
- **Blocking prerequisites.** (1) The D5 pre-flight count. (2) `0066` / `0067` landed, or `0068` renumbered at merge so the chain never gaps.

## 8. Cross-Cutting Concerns

- **Errors.**
  - Refusals are `CONFLICT`, carrying the engine's own wording, which names the gate label an owner sees in Parameters.
  - Ordering: an org-scope miss answers `NOT_FOUND` / `BAD_REQUEST` first, and review state is described only after it.
  - The dialog's existing `onError` fallback surfaces the message; the new-quote Save uses the form's existing error toast.
- **Testing.**
  - API: the new `quotation.template-gate.test.ts` plus the extended `seed.test.ts`. `gates.test.ts`'s sync guard covers the helper's literal call.
  - Migration: `migrations.test.ts` (three gates).
  - Browser: the e2e spec in Task 2.3, then §10 by hand.
- **Migration.** `0068`, data only, idempotent (`ON CONFLICT DO NOTHING`), with no extensions and no DDL.
- **Rollback.** Revert the code. To disarm without a deploy, untick **Reference Template** on Expense template review in Parameters → Approval flows, which is the tenant-level kill switch and needs no SQL. The data rollback SQL is in §4.2.

**Performance & Scalability**

1. **Pagination** — N/A: no new list, and `feeTemplates.list` keeps its limit/offset. The flag is one scalar.
2. **SQL-side filtering** — the gate, flow and cache predicates are all SQL `WHERE` on org, id and trigger.
3. **N+1** — none. `resolveFeeLineProvenance` gates the whole save in one batch (`inArray`), and `latestSubmissionByResource` is already batched. The rate-seeding loop at `:1638` is untouched.
4. **Index coverage** — `audit_flow` by `(organization_id, trigger_type)` via the partial unique "one enabled flow" index. `audit_flow_gate` uses `auditFlowGate_flowId_gateKey_uidx`. `audit_submission` lookups use the existing resource index the gate already uses. The `fee_template` id plus org check is a PK lookup.
5. **Write atomicity** — the gate runs before `create`'s transaction (like `assertNoLineBelowTariff`) and inside `update`'s `tx`. The migration is a single statement.
6. **Row locking** — read-then-write race: a card could be re-opened between the gate check and the insert on `create`, which checks outside the transaction. The window is milliseconds, and a re-open needs an editor saving the same card at that moment. Accepted: the floor re-evaluates on the next save. No `FOR UPDATE`, matching `assertGatesCleared`'s existing callers.
7. **Resources** — no new connections or external calls.
8. **Tenant isolation** — every query in the helper filters `organization_id`. The migration joins nothing across orgs, because each gate row hangs off its own org's flow.
9. **Payload size** — one boolean on the list.
10. **Hot path** — `feeTemplates.list` runs on the Fee Templates page and when the picker opens (`staleTime: 30_000`). The flag adds two indexed point reads, a negligible rise in request rate.

## 9. Decision Register, Open Questions & Risks

Every decision this plan rests on. None has been put to Wilfred yet; the plan is written for each recommendation. §1 and §4 point here by id.

### Settled 2026-09-15 — was blocking

**D5: What happens to unapproved cards that live orgs are already pricing from?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | No grandfathering: `0068` arms the gate everywhere, and sales submit whatever they need | Correct from day one. Can stop a sales desk mid-quote if prod has draft cards in daily use, until a branch manager clears the queue. |
| **B** | Before `0068`, auto-pass every existing card with a synthetic `passed` submission | Nobody is blocked. It writes approvals nobody gave, into the audit trail, for exactly the prices this defect is about. |
| **C** | Ship the code and seed, but do not backfill; tell each owner to tick Reference Template in Parameters | Zero surprise, but production stays unguarded until someone acts, and the defect stays open where the money is. |

- **Recommendation: A** — the seeded flow already routes templates to a branch manager in one stage (`seed.ts:140`), so the queue can absorb a one-off batch. Run the §7 pre-flight count first. If it shows cards used in the last 30 days, announce the change and have them submitted the day before `0068` applies.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Task 1.2 (whether `0068` exists and when it applies).
- **Where it lands:** §4.2, §7 prerequisites, Task 1.2

**D1: How does the gate row reach orgs that already exist?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Data migration `0068` inserting the row for every `fee_template` flow | Runs on every environment through the normal chain, idempotently. Costs a migration number and the three gates. |
| **B** | A one-off script under `seed/` (like `seed/flows.ts`) run per environment | No migration, but it depends on someone running it on prod, and "exit 0 is not applied". |
| **C** | Seed only, so new orgs get the gate and existing orgs tick it by hand | Smallest change; production stays open until each owner acts (same as D5-C). |

- **Recommendation: A** — the chain is the one thing every environment is guaranteed to replay. `0054` is the precedent for a data-only `INSERT … SELECT … ON CONFLICT`, and the unique `(flow_id, gate_key)` index makes it exact.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Task 1.2.
- **Where it lands:** §4.2, Task 1.2

### Settled 2026-09-15 — was non-blocking

**D3: Does a sheet re-priced after approval count as approved for referencing?** · Status: **Settled — B chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Gate only, which reads the latest submission: a re-priced sheet with a standing `passed` stays referenceable | One rule, the engine's. But on flows allowing post-approval edits, new unreviewed prices can be applied while the floor ignores the sheet. |
| **B** | Gate plus, when armed, cache must be `approved` (§4.4) | Closes the reopen hole and agrees with the floor and picker, both of which read the cache. It reads a column the engine calls a cache, but only as an extra refusal, never as a release. |
| **C** | Change `update`'s reopen path to also withdraw or supersede the passed submission | One source of truth, but a resource router writing engine state crosses the seam `resources.ts:15-17` forbids. |

- **Recommendation: B** — the floor already treats `audit_status = 'approved'` as the truth about prices (`quotation.ts:1845`, `:1908`), and the reopen comment at `:1045-1070` says the cache is being "told the truth" there. Refusing on it keeps the gate from being looser than the floor.
- **Chosen:** B (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No, it can be decided during Task 1.3. Under A, drop the second half of the helper and its test case.
- **Where it lands:** §4.4, Task 1.3, Task 1.4

**D4: How does the picker know whether an unapproved card can be applied?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Additive `referenceRequiresApproval` boolean on `feeTemplates.list` | The picker disables the right rows for review-on tenants and stays free for review-off ones. Two point reads per list call. |
| **B** | Remove unapproved cards from Show all everywhere | No server change, but review-off tenants (whose cards never become approved) lose the only way to pick any card. |
| **C** | Leave the picker; rely on the server refusal toast | No web change. The operator ticks forty cells, presses Apply and gets refused, and on a new quote the refusal only arrives at Save. |

- **Recommendation: A** — sales lack `org-param.manage`, so they cannot read the flow list, and the list response is the one read the picker already makes.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No, it shapes Phase 2 only.
- **Where it lands:** §4.5, §4.6, Tasks 2.1, 2.2

### Assumed

**D2: Where is the new-quote path closed?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | In `resolveFeeLineProvenance`, only for ids new to the line | Covers `create` and `update` in one place, and re-saving an old quote is never refused. |
| **B** | Gate every `listTemplateId` on every save | Simpler, but a quote priced from a card later re-opened becomes unsaveable, even to fix a typo. |
| **C** | Make the new-quote dialog save the quote first and then call `applyTemplate` | One server path, but it changes the form's save flow (dirty-form rules at `$quotationId.tsx:740`) and does nothing about hand-built payloads. |

- **Recommendation: A** — `resolveFeeLineProvenance` already distinguishes "round-tripping" from "clearing" via `existing` (`quotation.ts:1686-1692`), so "newly referencing" is the same distinction, made in the same function.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4.3, Task 1.3

**D6: Is `quotations.duplicate` a reference that needs the gate?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | No: it copies stored provenance (`quotation.ts:3444`) and is gated by `copy` | No change. A duplicate of an old draft-priced quote carries those lines, as the source did. |
| **B** | Yes: gate the copied `listTemplateId`s | Stricter, but duplicating any quote touched by a since-re-opened card fails whole. |
| **C** | Copy the lines but demote the provenance to `manual` | The copy never claims a tariff it has not cleared, but it silently changes `price_source`. |

- **Recommendation: A** — duplicate does not pull prices from a template; it copies a quotation, which has its own `copy` gate.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §1 out of scope

**D7: The JSON offers "enforce approved-only inside applyTemplate" as an alternative repair. Follow it?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Treat the claim as stale: the call exists (`quotation.ts:3593`), so fix the data and the second path | Uses the engine as designed. Tenants keep the off switch. |
| **B** | Hard-code approved-only in `applyTemplate`, regardless of flow | Closes the saved-quote path without a migration, but review-off tenants can never apply a card, which breaks `gates.ts:22-24`, and the new-quote path stays open. |
| **C** | Both: the seed row and a hard-coded check | Belt and braces, with the same review-off breakage as B. |

- **Recommendation: A** — the JSON's claim that the server never checks is wrong about the code; what is missing is the gate row, plus a path the JSON did not see.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Phase 0, §4

**D8: Are Cost templates gated too?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Yes, the gate is per template whatever its side | Matches the picker's approved-only rule, which already applies to every group (`reference-template-dialog.tsx:243-244`). Buy-side cards also need approval. |
| **B** | Selling templates only | Cost cards stay free, but `feeType` can flip, and the reopen path exists because a cost sheet flipped to selling becomes a floor. |
| **C** | Add a second gate key for cost | Gives flexibility, but the eyun vocabulary is one checkbox (`gates.ts:13-16`), so it would invent a control. |

- **Recommendation: A** — the declared vocabulary and the picker's default both treat a template as one reviewable thing.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4.4

**Risks.**

- _`0068`'s number collides with steps 01/02 or with another session_ → likely if merge order shifts, blocks the push → **renumber at merge, then re-run tags-equal-files and idx-contiguous before pushing.**
- _A sales desk is blocked on the morning `0068` applies_ → medium likelihood, high impact → **the D5 pre-flight count, plus same-day submission and approval of cards in use, before applying.**
- _The legacy `feeTemplates.review` flips the cache to `approved` with no submission_ → low likelihood (no UI calls it), medium impact → **under D3-B the gate still requires a passed submission, so a cache-only approval does not release a card. Step 08 Task 3.3 removes the procedure (X3).**
- _A future edit wraps the helper's ids argument in an expression with a comma_ → low likelihood, silent → **the helper's comment names the `gates.test.ts` scan shape.**
- _Shared worktree: `quotation.ts` and `reference-template-dialog.tsx` are edited by steps 06/07 plans in flight_ → high likelihood → **single committer at a time; read every hunk before `git add` (memory: shared index sweeps uncommitted hunks).**

### Settlements that span plans (2026-09-15)

- **X2, rate-card self-approval (option A).** Nobody currently stops a template author from approving their own card. Step 08 builds a per-resource `separationOfDuties` switch in `REVIEWABLE_RESOURCES` (step 08 D1-B). **Follow-up Task F.1, which runs only after step 08 merges:** turn the switch on for `fee_template`. Add a router test proving that the submitter of a fee-template review is refused on decide. Owner: step 04's backend agent.
- **X3, legacy `feeTemplates.review` (option A).** Step 08 Task 3.3 deletes it together with `quotations.review` and its allow-list entry in the architecture test. Step 04 does not touch it.

## 10. Verification & Proof

**App URL:** http://localhost:3101
**Preconditions:**

- An org created **after** Phase 1 (`e2e/fixtures/seed-cli.ts seed-parity <runId>`), so its Expense template review flow is seeded with Reference Template ticked, plus a pre-existing org migrated through `0068`.
- A salesperson cookie and a branch-manager cookie. Check the active org first; the session's active org is shared across sessions.
- One quotation for a known client, saved.

**Migrations:** `0068_fee_template_reference_gate`. Before testing, confirm it is in `meta/_journal.json` **and** applied (`select count(*) from audit_flow_gate where gate_key = 'reference_fee_template'` equals the number of `fee_template` flows), not just that the migrate command exited 0.

**Golden path — Journey 3 (and Journey 1 before approval):**

1. As sales admin, navigate to `/fee-templates` → press **Add** → **New Fee Template** opens.
2. Fill Template Name `Gate Proof <runId>`, Business Type, Fee Type **Selling Price**, add billing unit `20GP`, add a fee row with `20GP = 500` → **Save Template** → toast *Template created*.
3. Open the saved quotation → **Reference Template** → tick **Show all templates** → `Gate Proof <runId>` is listed with subtitle *Draft*, its radio is **disabled**, and the reason reads *Not approved — submit it for review before pricing from it*.
4. Back on the template → header **Review** → **Submit for review** → the status reads *Pending*.
5. As branch manager, navigate to `/approve/template` → the row `Gate Proof <runId>` is listed → tick it → **Approved** → toast *1 template(s) approved*, and the row disappears.
6. As sales, reopen the quotation → **Reference Template** → `Gate Proof <runId>` shows under *Standard tariff* **without** Show all → **Next** → tick `20GP` → **Apply** → toast *Template lines applied*, and a fee line priced 500 appears.
7. The floor banner does **not** read *not enforcing anything* for that line.

**Edge case — new quotation bypass (Journey 2):** as sales, create a second draft card (not submitted). On `/quotations/new`, from the browser devtools console or via the API, `POST quotations/create` with a fee line whose `listTemplateId` is the draft card → 409 *"Reference Template" requires review approval first*, and no quotation appears in `/quotations`. In the UI, the same card is disabled under Show all.
**Edge case — review off (Journey 4):** as owner, Parameters → Approval flows → disable Expense template review → as sales, the draft card is **selectable** under Show all and Apply succeeds. Re-enable afterwards.
**Regression check:**

- Re-save an existing quotation whose lines came from a card later re-opened → **Save** succeeds (D2).
- `quotation.rate-card.test.ts` and `quotation.apply-picks.test.ts` pass unchanged.
- `e2e/specs/quotation.tariff-check.spec.ts` and `audit.template-queue.spec.ts` still pass.

**Mobile:** at 375px, the disabled row's reason line wraps inside the dialog's scrolling list with no horizontal page overflow. The `/approve/template` toolbar stays reachable.

_2026-09-15: Wilfred chose the recommendation for every open decision in §9. The readiness points held back for pending decisions no longer apply._

**Readiness: 7/10** — every path, line and precedent above was re-read at HEAD `6bb3a1bf`. Three points are held back:

- **D5 and D1 block Task 1.2,** and they depend on a production count nobody has run.
- **`0068` depends on `0066` / `0067` landing first.**
- **The server-side decision is sound, but the UI half (D4) is unproven in a browser.**
