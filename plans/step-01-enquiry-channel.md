# Step 01 — every enquiry leaves a record, whatever channel it came in on

**SOP step:** 01 "Read the enquiry" · `/inbox`, `/inbox/$threadId` · ledger defect **rank 13 — "Only email leaves an enquiry record"**
**Evidence read at:** commit `6c31a20e`, 2026-09-14
**Tier:** Standard (schema + migration)

---

## Phase 0 findings

- **Stack** — oRPC routers (`packages/api/src/routers`), Drizzle + drizzle-kit (`packages/db/src/schema`, migrations in `packages/db/src/migrations`), TanStack Router file routes (`apps/web/src/routes/_next`), zod both sides, vitest.
- **Thread → customer link is half-built.** `threadLinkEntity` in `packages/db/src/schema/mailbox.ts` already reserves `["quotation", "shipment", "customer"]` _"so the enum + table need no migration when those modules land"_. But `thread.linkAdd` and `thread.linksForEntity` (`packages/api/src/routers/thread.ts`) accept only `z.enum(["quotation"])`, and `linkAdd` validates the target against the `quotation` table only.
- **No channel anywhere.** `packages/db/src/schema/quotation.ts` has no source / channel / enquiry column; the header input is `quotationHeaderInput` and the list filter is `quotationFilterSchema` in `packages/api/src/routers/quotation.ts`.
- **Threads have no outcome.** `threadStatus` is `new | open | pending | resolved | closed`; won/lost lives only on `quotation.status`.
- **Precedent** — the inbox context panel already mounts `LinkPicker` (`apps/web/src/components/inbox/link-picker.tsx`) inside `reading-pane.tsx`; the company create flow is `orpc.company.create` from the **Add company** dialog in `apps/web/src/routes/_next/companies.tsx`, which hands off to `/companies/$companyId/edit`.
- **Migration state** — journal: 65 entries ending `0065_quotation_send_decision`; 65 `.sql` files; contiguous. This plan adds **one** migration, `0066`. No other `_plan/` session claims `0066` or `0067` (grepped 2026-09-14). **Fixed rule:** step 01 takes `0066` and step 02 takes `0067`; if step 02 merges first, it still ships as `0067` only after this one is in, so the chain never has a gap.
- **Migration gates** (repo convention) — tags must equal files, `idx` must be contiguous, and the PGlite chain replay forbids extensions. A `pgEnum` + nullable column needs none.

## 1. Overview

**Problem.** Only an emailed enquiry leaves a trace. WhatsApp and agent nominations have nowhere to land; walk-ins and phone calls are typed straight into a company or quotation and leave no record of how the customer arrived. Even the emailed one has no outcome, because a thread can be closed but never won or lost. And an email sender cannot be turned into a customer: name, address and domain are retyped at step 2.

**Decision taken (user, 2026-09-14).** Record the channel **on the quotation**, link inbox threads to the **customer** using the reserved enum value, and **derive** a thread's outcome from its linked quotation. No new Enquiry entity.

**Goals.**

- Every new quotation records how the customer reached NCT.
- An inbox thread can create the customer from its sender, and stays linked to that customer.
- A thread linked to a quotation shows that quotation's Won / Lost.
- Win rate per channel is answerable from the quotation ledger.

**In scope.** Channel column + migration; header field; ledger column + filter; `customer` link target; "Create company from sender"; outcome shown on the thread.
**Out of scope.** An Enquiry table/screen; enquiries that never became a quotation (→ D3); WhatsApp ingestion; changing thread statuses.

**Assumptions.**

- No existing `_plan/` session covers enquiry intake, so this is a new session.
- Existing quotations with an inbox thread linked to them are backfilled as `email`; every other existing quotation stays null ("not recorded") → D4
- Channel is optional on save for now, with a follow-up to make it required once a month of data shows the skip rate (a required field today would break duplicate/convert paths that carry no channel) → D2

## 2. User Journeys

**Journey 1 (new): Sales records how a walk-in or WhatsApp customer arrived**
Trigger: Sales → Quotations → **Add**.
Steps:

1. User sees **New Quote** → the one-line brief now shows **Channel · Not set** beside Business type and Client.
2. User presses **All 27 fields + 16 services** → a **How they reached us** select sits next to **Client \***: Email · WhatsApp · Walk-in · Phone · Agent nomination · Repeat booking.
3. User picks **Walk-in**, fills the rest, presses **Save Quote** → toast _Quote saved_; the brief reads **Channel · Walk-in**.
4. Flow ends: the quotation carries its channel for the rest of its life.
   Where it lives: inline in the existing quotation editor header.

**Journey 2 (new): Sales turns an email sender into a customer**
Trigger: Inbox → open a thread from an unknown sender.
Steps:

1. User sees the reading pane → the context panel (beside **Link a quotation…**) shows a **Customer** block: _"Not linked to a company."_ with **Create company from sender** and **Link existing company…**.
2. User presses **Create company from sender** → the existing **Add company** dialog opens, **Company title** prefilled from the sender's display name (or the domain when there is none), **Customer** ticked.
3. User corrects the title, presses **Create and continue** → the company is created, the thread is linked to it (`customer` link), and the user lands on the company edit form as today.
4. Returning to the thread → the Customer block names the company with a link to it.
5. Flow ends: sender details were never retyped from memory; the thread is findable from the company.
   Where it lives: the inbox context panel, reusing the existing dialog.

Old journey — steps 1–3 did not exist: the salesperson opened Companies in another tab and retyped the sender.

**Journey 3 (new): A thread shows whether its enquiry was won**
Trigger: Inbox → open a thread linked to a quotation.
Steps:

1. User sees the linked quotation in the context panel → it now carries its status badge (**Draft / Sent / Won / Lost / Converted**).
2. Flow ends: the thread's outcome is visible without a won/lost field of its own.
   Where it lives: the existing link list in the context panel.

**Journey 4 (new): Sales manager reads win rate by channel**
Trigger: Sales → Quotations.
Steps:

1. User opens **All filters** → a **Channel** select sits beside Business Type.
2. Picks **WhatsApp** and status **Won** → the ledger narrows; the count shows how many WhatsApp enquiries were won.
3. Flow ends: repeat with **Lost** for the other half of the rate.
   Where it lives: the existing quotation ledger.

## 3. Result

**Before:** Only email enquiries leave a trace; nobody can say how a walk-in or WhatsApp customer arrived, the sender of an email is retyped by hand, and a thread never shows whether it was won.
**After:** Every quotation records its channel; an email sender becomes a customer in one press; a linked thread shows its quotation's outcome.
**Key differences:**

- Sales: **How they reached us** on the quotation header, and **Channel** in the brief.
- Sales: **Create company from sender** and **Link existing company…** in the inbox.
- Sales: Won / Lost badge on a thread's linked quotation.
- Manager: **Channel** filter and column on the quotation ledger.

## 4. Technical Architecture

**Schema (Journey 1 step 2, Journey 4 step 1).**

```ts
// packages/db/src/schema/quotation.ts
export const enquiryChannel = pgEnum("enquiry_channel", [
  "email", "whatsapp", "walk_in", "phone", "agent_nomination", "repeat_booking",
]);
// on the quotation table:
enquiryChannel: enquiryChannel("enquiry_channel"),   // nullable: null = not recorded
// and an index for the ledger filter:
index("quotation_org_channel_idx").on(table.organizationId, table.enquiryChannel),
```

Migration `0066_quotation_enquiry_channel.sql` [NEW]: `CREATE TYPE`, `ALTER TABLE … ADD COLUMN enquiry_channel`, `CREATE INDEX`, then one backfill (D4):

```sql
UPDATE "quotation" q SET "enquiry_channel" = 'email'
WHERE q."enquiry_channel" IS NULL
  AND EXISTS (SELECT 1 FROM "thread_link" tl
              WHERE tl."entity_type" = 'quotation' AND tl."entity_id" = q."id");
```

A thread link is evidence of an emailed enquiry, so this recovers real history without guessing; every other row stays null.

**API.**

- `quotationHeaderInput` gains `enquiryChannel: enquiryChannelSchema.nullish()` (Journey 1 step 3). Create and update both accept it; update keeps patch semantics (an explicit `null` clears).
- `quotationFilterSchema` gains `enquiryChannel: enquiryChannelSchema.optional()`, applied in SQL with `eq` (Journey 4 step 2) — single-value, the same shape as the existing `status` and `businessType` filters beside it.
- `quotations.duplicate` already copies it with no change — the handler spreads `...source` into the new row. `quotations.convertToOrder` does not need it.
- `thread.linkAdd` / `thread.linksForEntity`: `entityType: z.enum(["quotation", "customer"])` (`linkRemove` takes a `linkId` and needs no change). `linkAdd` validates a `customer` target against `company` **with the company scope applied** — the mirror of today's quotation check (Journey 2 step 3).
- `thread.linkList` returns rows from `threadLinksWithQuoteRef` (`packages/api/src/routers/thread.ts`), which **already** left-joins `quotation` and the legacy `quote` per entity type and returns `entityRef` / `entityLabel`. Extend that helper: add `entityStatus` from `quotation.status`, and a third left join to `company` on `entity_type = 'customer'` (org-scoped) feeding `entityLabel`. Same query, no new round-trip (Journeys 2 step 4, 3 step 1).

**Web.**

- `apps/web/src/routes/_next/quotations/$quotationId.tsx` — the select in the expanded header, a **Channel** pair in the brief.
- `apps/web/src/routes/_next/quotations/-quotations.columns.tsx` + `index.tsx` — a **Channel** column (hidden by default) and filter field.
- `apps/web/src/components/inbox/reading-pane.tsx` — a **Customer** block in the context panel.
- `apps/web/src/routes/_next/companies.tsx` — `CompanyFormDialog` accepts optional `defaults` (`name`, `isCustomer`) and an `onCreated(company)` hook, so the inbox can link before the hand-off navigation.
- `apps/web/src/components/inbox/link-picker.tsx` — a `entityType` prop so the same picker searches companies for **Link existing company…**.

**Decisions.** Channel on the quotation, not a new entity → D1. Nullable, not required → D2. Outcome derived, not stored on the thread → D5. Stored as a Postgres enum → D7.

## 5. Phased Implementation

### Phase 1 — The quotation records its channel

**Delivers:** Journeys 1 and 4.
**Dependencies:** migrations contiguous (true today).

- **1.1** Add `enquiryChannel` enum, column and index; generate migration `0066` with the thread-link backfill (D4); confirm the three migration gates, and that the PGlite replay runs the `UPDATE` cleanly on an empty database. Files: `packages/db/src/schema/quotation.ts`, `packages/db/src/migrations/0066_quotation_enquiry_channel.sql` [NEW], `packages/db/src/migrations/meta/_journal.json`. · **Agent A (backend)**
- **1.2** Accept the field in `quotationHeaderInput`, copy it in `duplicate`, filter on it in `quotationFilterSchema`. Files: `packages/api/src/routers/quotation.ts`, `packages/api/src/quotation/values.ts` (export the zod enum). · **Agent A (backend)**
- **1.3** API tests: create/update/clear round-trip; duplicate copies; filter returns only matching rows and stays org-scoped; a quotation seeded with a `thread_link` before the migration reads `email` after it, and one without stays null. Files: `packages/api/src/routers/quotation.filters.test.ts`. · **Agent A (backend)**
- **1.4** Header select + brief pair; ledger column + filter field. Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx`, `apps/web/src/routes/_next/quotations/-quotations.columns.tsx`, `apps/web/src/routes/_next/quotations/index.tsx`. · **Agent B (frontend)**

**Acceptance.** User can set **Walk-in** on a new quotation, save, reopen and see it; filter the ledger to WhatsApp + Won.

### Phase 2 — A thread becomes a customer and shows its outcome

**Delivers:** Journeys 2 and 3.
**Dependencies:** none on Phase 1 (disjoint files).

- **2.1** Open `customer` on `linkAdd` / `linksForEntity`, scoped company validation, and enrich `thread.linkList` with quotation status and company name. Files: `packages/api/src/routers/thread.ts`. · **Agent C (backend)**
- **2.2** API tests: link a customer in scope; refuse a company outside scope; enriched links carry status and name. Files: `packages/api/src/routers/thread.test.ts`. · **Agent C (backend)**
- **2.3** `CompanyFormDialog` gains optional `defaults` + `onCreated`; existing call site unchanged. Files: `apps/web/src/routes/_next/companies.tsx`. · **Agent D (frontend)**
- **2.4** Customer block in the context panel (create-from-sender, link existing, linked state) and status badges on quotation links; `LinkPicker` takes `entityType`. The picker is presentational — its search text and results are owned by the route (`linkQuery`, the debounced quotation query), so the company search is added there and passed down through `ReadingPane`. Files: `apps/web/src/routes/_next/inbox.$threadId.tsx`, `apps/web/src/components/inbox/reading-pane.tsx`, `apps/web/src/components/inbox/link-picker.tsx`. · **Agent D (frontend)**
- **2.5** A verification fixture that makes Journeys 2 and 3 provable without a live mailbox: insert a `mailbox_connection`, a `thread` (its required columns are `organization_id`, `mailbox_connection_id`, `provider_thread_ref`) from `Rina Tan <rina@kolombong-traders.my>`, one inbound `message`, and a second thread with a `thread_link` to a Won quotation. Expose it as a `seed-inbox` command beside `seed-parity`, with a matching teardown. Files: `e2e/fixtures/seed-cli.ts`, `e2e/fixtures/seed-inbox.ts` [NEW]. · **Agent C (backend)**

**Acceptance.** User opens a thread from an unknown sender, presses **Create company from sender**, creates it, returns to the thread and sees it linked; a thread linked to a Won quotation shows **Won**.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent              | subagent_type     | Model  | Effort | Tasks   | Owns (write)                                                                                                                                                                                                                                                           | Reads only                              |
| ------------------ | ----------------- | ------ | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Agent A (backend)  | backend-engineer  | opus   | high   | 1.1–1.3 | `packages/db/src/schema/quotation.ts`, `packages/db/src/migrations/0066_*.sql`, `packages/db/src/migrations/meta/_journal.json`, `packages/api/src/routers/quotation.ts`, `packages/api/src/quotation/values.ts`, `packages/api/src/routers/quotation.filters.test.ts` | —                                       |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.4     | `apps/web/src/routes/_next/quotations/$quotationId.tsx`, `-quotations.columns.tsx`, `index.tsx`                                                                                                                                                                        | `packages/api/src/routers/quotation.ts` |

opus — schema + migration against the gated migration chain. Run mode: **A → B** (B waits on the generated contract for `enquiryChannel`).

**Phase 2**

| Agent              | subagent_type     | Model  | Effort | Tasks        | Owns (write)                                                                                                                                                                                  | Reads only                                                                 |
| ------------------ | ----------------- | ------ | ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Agent C (backend)  | backend-engineer  | opus   | high   | 2.1–2.2, 2.5 | `packages/api/src/routers/thread.ts`, `packages/api/src/routers/thread.test.ts`, `e2e/fixtures/seed-cli.ts`, `e2e/fixtures/seed-inbox.ts` [NEW]                                               | `packages/db/src/schema/mailbox.ts`, `packages/api/src/routers/company.ts` |
| Agent D (frontend) | frontend-engineer | sonnet | medium | 2.3–2.4      | `apps/web/src/routes/_next/companies.tsx`, `apps/web/src/routes/_next/inbox.$threadId.tsx`, `apps/web/src/components/inbox/reading-pane.tsx`, `apps/web/src/components/inbox/link-picker.tsx` | `packages/api/src/routers/thread.ts`                                       |

opus — `linkAdd` must apply the company scope, a multi-tenant boundary. Run mode: **C → D**. Phases 1 and 2 may run in parallel with each other.
**Serialization points:** migration applied and journal checked (after 1.1); type-check after each phase, reading the output not the exit code.

## 7. Impact & Breakage Analysis

- **`quotation` table** — new nullable column; every existing insert keeps working. Readers that `select()` the whole row gain a field; no destructuring breaks. The backfill touches only quotations with a `thread_link`, so it is bounded by the number of links, not the ledger.
- **`quotationHeaderInput`** — additive optional field. Older clients omit it (zod strips nothing required).
- **`thread.linkAdd` / `linksForEntity`** — widening an enum is additive. Callers: `apps/web/src/components/inbox/link-picker.tsx`, `apps/web/src/components/quotation/send-quotation-dialog.tsx` (invalidates `linksForEntity` for `quotation` — unchanged).
- **`thread.linkList` return shape** — gains fields; the reading pane is its consumer and is updated in 2.4.
- **`CompanyFormDialog`** — new optional props; the one existing call site in `companies.tsx` passes neither.
- **Deployment coupling** — Phase 1 backend (migration + API) must deploy before or with its web task. Phase 2 backend must deploy before 2.4, or the web sends `customer` to a server that refuses it.
- **Blocking prerequisites** — none. Migration number to be confirmed against the step-02 work at merge.

## 8. Cross-Cutting Concerns

- **Errors** — linking an out-of-scope company refuses with `BAD_REQUEST` _"Company not found in this organization"_, mirroring the quotation message.
- **Testing** — API tests per phase; browser proof per §10.
- **Migration** — one additive migration with one backfill `UPDATE`; rollback is `DROP INDEX`, `DROP COLUMN`, `DROP TYPE` (the backfilled values go with the column).
- **Rollback** — revert; the nullable column is harmless if left.

**Performance & Scalability**

1. Pagination — the ledger is already paginated; the filter narrows it.
2. SQL-side filtering — `eq(quotation.enquiryChannel, …)` in the WHERE.
3. N+1 — `thread.linkList` enrichment is one query joining `quotation` and `company`, not one lookup per link.
4. Index — `quotation_org_channel_idx (organization_id, enquiry_channel)`.
5. Write atomicity — "create company then link" is two calls; if the link fails, the company exists unlinked and the Customer block still offers **Link existing company…** — acceptable, no transaction across procedures.
6. Row locking — N/A: no read-then-write race.
7. Resources — none new.
8. Tenant isolation — the channel filter rides the existing quotation scope; the `customer` link target is validated with `applyScope` on `company`.
9. Payload — two small fields per link.
10. Hot path — the reading pane loads links per opened thread; one query, unchanged count.

## 9. Decision Register, Open Questions & Risks

Every decision this plan rests on. **All settled on 2026-09-14: you accepted every recommendation.** Each block keeps the group it was in before, so the history of what was asked, assumed or open stays readable. §1 and §4 point here by id.

### Settled — was open

**D2: Should the channel be required on a new quotation?** · Status: Decided

|       | Approach                                               | Consequence                                                                                              |
| ----- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **A** | Required on create                                     | Complete data from day one; breaks duplicate and every seed or test that creates a quotation without it. |
| **B** | Optional, with the brief showing **Channel · Not set** | No breakage; relies on the brief to prompt, so some quotations stay unrecorded.                          |
| **C** | Optional now, required once adoption is checked        | B today, with a follow-up once the ledger shows how often it is skipped.                                 |

- **Recommendation: C** — ship as B and tighten only when a month of data shows the skip rate — requiring it on day one breaks the duplicate path.
- **Chosen:** C (you, 2026-09-14 — accepted the recommendation) — changed from the plan's original B
- **Blocking?** No.
- **Where it lands:** §4 API; Task 1.2

**D3: What about enquiries that never become a quotation?** · Status: Decided

|       | Approach                              | Consequence                                                    |
| ----- | ------------------------------------- | -------------------------------------------------------------- |
| **A** | A draft quotation per enquiry         | Every enquiry recorded, but the ledger fills with draft noise. |
| **B** | A lightweight Enquiry record later    | The honest model — the option declined for now at D1.          |
| **C** | Accept the gap for non-email channels | An unquoted WhatsApp enquiry still leaves nothing.             |

- **Recommendation: C** — it follows from D1; revisit B only if the unquoted-enquiry count turns out to matter.
- **Chosen:** C (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §1 scope

### Settled — decided at the input gate

**D1: How should non-email enquiries be recorded?** · Status: Decided

|       | Approach                                                           | Consequence                                     |
| ----- | ------------------------------------------------------------------ | ----------------------------------------------- |
| **A** | Channel on the quotation + customer thread links + derived outcome | No new entity; covers most of the defect.       |
| **B** | A new Enquiry record and screen                                    | Complete; a new module and a much larger plan.  |
| **C** | Only create-company-from-sender                                    | Smallest; the rank-13 defect stays mostly open. |

- **Recommendation: A** — it closes most of the defect on tables and links that already exist, including the reserved `customer` link value.
- **Chosen:** A (you, at the input gate — matched the recommendation)
- **Blocking?** No (settled).
- **Where it lands:** Whole plan; Phases 1–2

### Settled — was a plan assumption

**D4: What channel do existing quotations get?** · Status: Decided

|       | Approach                                                 | Consequence                                                   |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------- |
| **A** | Leave them null ("not recorded")                         | Honest; historical win-rate by channel starts empty.          |
| **B** | Backfill `email` where the quotation has a linked thread | Recovers real history for emailed work; leaves the rest null. |
| **C** | Backfill a default for all                               | Full history, but invented.                                   |

- **Recommendation: B** — a thread link is genuine evidence of an emailed enquiry, so it recovers history without guessing — a one-statement backfill in the same migration.
- **Chosen:** B (you, 2026-09-14 — accepted the recommendation) — changed from the plan's original A
- **Blocking?** No.
- **Where it lands:** §4 migration; Task 1.1

**D5: Where does a thread's won/lost live?** · Status: Decided

|       | Approach                                   | Consequence                                                              |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------ |
| **A** | Derived from the linked quotation's status | One source of truth; a thread with no quotation shows no outcome.        |
| **B** | A stored outcome column on the thread      | Every thread can be closed as won or lost; two places can disagree.      |
| **C** | New `won` / `lost` thread statuses         | Visible in the triage bar; mixes a sales outcome into a triage workflow. |

- **Recommendation: A** — it is part of the decision at D1 and avoids a second copy of an outcome that already exists on the quotation.
- **Chosen:** A (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 `thread.linkList`; Task 2.1

**D6: How does "Create company from sender" collect the details?** · Status: Decided

|       | Approach                                       | Consequence                                                               |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| **A** | Reuse the **Add company** dialog with defaults | One create path; the user can correct the title before saving.            |
| **B** | An inline mini-form in the inbox panel         | Faster, but a second create form that can drift from the first.           |
| **C** | Create silently from the sender, edit later    | One press, but display names make poor legal names and duplicates follow. |

- **Recommendation: A** — `CompanyFormDialog` already owns validation and the hand-off to the full edit form.
- **Chosen:** A (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 web; Task 2.3

**D7: How is the channel stored?** · Status: Decided

|       | Approach                           | Consequence                                                            |
| ----- | ---------------------------------- | ---------------------------------------------------------------------- |
| **A** | A Postgres enum (`pgEnum`)         | Enforced by the database; adding a value needs a migration.            |
| **B** | Text with a zod enum               | No migration to add a channel; the database accepts any string.        |
| **C** | An org-configurable reference list | Each org defines channels; win-rate by channel stops being comparable. |

- **Recommendation: A** — `thread_link_entity` and `thread_status` already use `pgEnum` for closed vocabularies in the same area.
- **Chosen:** A (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 schema; Task 1.1

**Risks.**

- _Migration number collides with the step-02 plan_ → likely if both run → **renumber at merge; check tags-equal-files before pushing.**
- _Senders with no display name prefill a poor company title_ → medium → **fall back to the domain; the dialog is editable before create.**

## 10. Verification & Proof

**App URL:** http://localhost:3101
**Preconditions:** `bun --env-file=apps/server/.env --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed-parity <runId>`, then `… seed-inbox <runId>` (Task 2.5) for the Rina Tan thread and the thread linked to a Won quotation. No live mailbox needed. Tear both down afterwards.
**Migrations:** `0066_quotation_enquiry_channel` — confirm it is in the journal and applied before testing, then open a quotation that was sent from the inbox before the migration: its brief reads **Channel · Email**.

**Golden path — Journey 1 & 4:**

1. `/quotations` → press **Add** → **New Quote**; brief shows **Channel · Not set**.
2. Press **All 27 fields + 16 services** → **How they reached us** is visible.
3. Pick **Walk-in**, set **Business Type** and **Client**, press **Save Quote** → _Quote saved_; brief shows **Channel · Walk-in**.
4. Back to `/quotations` → **All filters** → **Channel = Walk-in** → the new quotation is the only row.

**Golden path — Journey 2 & 3:**

1. `/inbox` → open Rina Tan's thread → context panel shows **Not linked to a company.**
2. Press **Create company from sender** → **Add company** opens with **Company title** = "Rina Tan", **Customer** ticked.
3. Change it to "Kolombong Traders Sdn Bhd", press **Create and continue** → lands on the company edit form.
4. Return to the thread → the Customer block names **Kolombong Traders Sdn Bhd**.
5. Open the thread linked to the Won quotation → its link shows **Won**.

**Edge case:** link a company from another org by id through the API → refused with _Company not found in this organization_; nothing is linked.
**Regression check:** sending a quotation (step 9) still opens and links a thread, and the quotation's **Threads** card still lists it.
**Mobile:** at 400px the Customer block stacks under the thread and the header select stays within the form.

**Follow-up (D2):** one month after release, count new quotations with a null `enquiry_channel`; if the rate is low, make it required on create in a separate change.

**Readiness: 9/10** — every file, procedure and pattern named here was verified in code on 2026-09-14, the migration number is fixed, and the browser proof now has its own fixture. The point held back is that Task 2.5's fixture does not exist yet, so §10's second golden path cannot be walked until it is written; D3 leaves unquoted non-email enquiries unrecorded by your decision, not by a gap in the plan.
