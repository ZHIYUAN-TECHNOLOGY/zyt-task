# Step 02 — one company, one exposure: stop duplicates and make credit a recorded decision

**SOP step:** 02 "Create the customer" · `/companies`, `/companies/$companyId/edit`, `/companies/$companyId`
**Defects:** ledger **rank 16 — "Credit is captured and never enforced"** · step-local **[data] "Duplicate companies enter through case"**
**Evidence read at:** commit `6c31a20e`, 2026-09-14
**Tier:** Standard (money path, unique index migration, tenant-scoped aggregate)

---

## Phase 0 findings

- **Stack** — oRPC (`@orpc/server`, `@orpc/zod`) in `packages/api/src/routers`, Drizzle + drizzle-kit in `packages/db`, TanStack Router under `apps/web/src/routes/_next`, zod, vitest.
- **Credit is advisory by an earlier decision.** In `computeAgeing` (`packages/api/src/routers/report.ts`): _"ADVISORY, per the phase decision — surfaced so the caller can badge 'outstanding vs limit'. Nothing here blocks a bill or an invoice on it, and the limit is the only half stored: the balance is derived from the ledger at read time, because a stored balance is a cache with no repainter."_ The user has now chosen **warn, and allow with an audited reason** — this plan supersedes "never interrupts" but keeps "no stored balance".
- **The limit has no currency of its own.** `company.credit_limit` is a bare `numeric`; `company.settlement_currency` is a separate nullable `text`. Bills carry their own `currency` (`packages/db/src/schema/expense.ts`, `bill`). There is no organisation base currency (ledger defect rank 07).
- **Outstanding is already computable.** `report.ts` defines `verifiedAmountExpr` (non-voided write-offs per bill) and `outstandingExpr = total_amount − verified`; `bill.settlement_company_id` references `company.id` and is **nullable**.
- **Invoicing** is `bills.invoice` (`packages/api/src/routers/expense/bills.ts`): input `billIds[1..200]`, `amount?`, `category?`, `type?`, `invoiceNumber?`, …; it applies the bill scope, then `assertGatesCleared(… "bill", …, "input_invoice_no")`. The web dialog is in `apps/web/src/routes/_next/expenses/bills.tsx` (**Invoice Category**, **Issue Invoice**; errors surface as `toast.error(error.message)`).
- **Precedent for a pre-check** — the quotation editor calls a read-only `quotations.tariffCheck` query and the server re-enforces on save (`assertNoLineBelowTariff`). This plan copies that shape: a `bills.creditCheck` read, re-enforced inside `bills.invoice`. No precedent exists for structured `ORPCError` data, so the plan does not introduce one.
- **The name key already exists.** The A3 backfill (`company-backfill.test.ts`) matches `lower(btrim(name))` against a quotation's free-text client, and **refuses to pick a winner when two companies share a name** — so every existing case/whitespace collision is also a customer whose quotations the backfill leaves unlinked, which feeds ledger rank 01. This plan uses the same key for the refusal, the report and the index, so a company that is unique here is unambiguous there.
- **Measured, 2026-09-14 (read-only probe, counts only).** Dev branch (`ep-super-math`): **0 collision groups**. Production was **not** measured: `apps/server/dev-db-guard.ts` refuses a production `DATABASE_URL` unless `I_KNOW_THIS_IS_PRODUCTION=1` is set, and that override is the owner's to give. The production count remains Phase 3's gate.
- **Duplicates** — `company_org_name_uidx` is `(organization_id, name)` (`packages/db/src/schema/company.ts`); `refuseDuplicateName` in `packages/api/src/routers/company.ts` maps `23505` to _"A company with this name already exists in the directory"_. `company.list` already searches `ilike` over `name`, `nameEn`, `code`, `customerCode`. `company.delete` refuses a referenced company (`23503` / `23001`), so an unreferenced duplicate can be deleted today; a referenced one cannot, and **no merge tool exists**.
- **Migration state** — 65 journal entries ending `0065_quotation_send_decision`, 65 files, contiguous. This plan adds one migration, `0067`; step 01 takes `0066` by the fixed rule in that plan.
- **Expression-index precedent** — `packages/db/src/schema/audit.ts` already declares an index over ``sql`coalesce("initiator_role_id", '')` ``, so a Drizzle index on ``sql`lower(btrim(${table.name}))` `` follows an existing pattern rather than introducing one. PGlite replay forbids extensions: `lower(btrim(name))` is core Postgres, no `citext`.

## 1. Overview

**Problems.**

1. A credit limit is stored and shown, but invoicing never looks at it, so a customer far over their limit is invoiced exactly like one with none.
2. Company names are unique only case-sensitively, so "Sunrise Sdn Bhd" and "SUNRISE SDN BHD" both save; one customer's quotations, orders and bills then split across two records, and any exposure figure understates the truth.

**Decisions taken (user, 2026-09-14).**

- Credit: **warn, and allow with a reason that is audited.**
- Duplicates: **prevent new ones now, report the existing ones for someone to resolve by hand, and add the case-insensitive unique index only once that report is empty.**

**Goals / success criteria.**

- Issuing an invoice for a company whose outstanding receivable exceeds its limit shows the exposure and requires a reason; the reason is in the audit log.
- Creating or renaming a company to a case-variant of an existing name is refused, naming the existing company, and the Add dialog shows near matches while typing.
- The Companies list can show every existing case-collision.
- After the collision list is empty, a migration makes `(organization_id, lower(btrim(name)))` unique.

**In scope.** `bills.creditCheck`, the re-check in `bills.invoice`, the invoicing dialog warning; case-insensitive create/rename refusal; Add-dialog near matches; a collision filter on the Companies list; the gated index migration.
**Out of scope.** Blocking invoices; a stored balance; FX conversion of exposure (→ D3); an automated or UI merge tool (→ D4); credit checks anywhere but invoicing.

**Assumptions.**

- No existing `_plan/` session covers credit or company de-duplication; new session.
- Exposure = outstanding **receivable** only (payables do not consume a customer's credit) → D7
- The limit is checked per currency, reporting any currency it did not count → D3

## 2. User Journeys

**Journey 1 (changed): Accounting invoices a customer who is over their limit**
Trigger: Money → Bills → tick a receivable bill → **Invoicing**.
Old journey: dialog opens → fill **Invoice Category** and **Invoice Type** → **Issue Invoice** → toast _Invoice … issued_. The limit is never mentioned.
New journey:

1. User opens **Invoicing** → the dialog loads as today, and runs a credit check for the bill's settlement company.
2. Under limit, or no limit set, or no company resolved → nothing changes.
3. Over limit → an amber notice at the top of the dialog, one line per currency (D3): _"Sunrise Trading is over its credit limit: MYR 84,200.00 outstanding against a limit of MYR 50,000.00."_ When bills in other currencies or bills with no settlement company were left out, a second line says so (D3, D5): _"Not counted: USD 3,100.00 in another currency, and 4 bills with no company."_ A required **Reason for invoicing over the limit** box follows, at least 10 characters (D9). **Issue Invoice** stays disabled until the reason is long enough.
4. User types a reason, presses **Issue Invoice** → the server re-checks, issues the invoice, and writes an audit entry carrying exposure, limit, currency and the reason → toast _Invoice … issued_ (unchanged).
5. Flow ends: the invoice exists, and crossing the limit is a recorded act with a name and a reason on it.
   Where it lives: inline in the existing Invoicing dialog.

**Journey 2 (changed): Sales tries to add a company that already exists under a different case**
Trigger: Sales → Companies → **Add**.
Old journey: type "SUNRISE SDN BHD" → **Create and continue** → a second company is created.
New journey:

1. User types in **Company title** → below the field, after a short pause, _"Already in the directory:"_ lists up to five near matches (case-insensitive contains), each a link to that company.
2. User presses **Create and continue** anyway on an exact case-variant → refused inline: _"Sunrise Sdn Bhd is already in the directory — open it instead."_ with a link.
3. Flow ends: no duplicate is created; the user goes to the existing record.
   Where it lives: inline in the existing **Add company** dialog. The same refusal applies on the edit form's rename.

**Journey 3 (new): An administrator resolves existing duplicates**
Trigger: Sales → Companies.

1. User opens **All filters** → a **Name collisions** toggle, with a count, when any exist.
2. Turns it on → the list shows only companies whose names collide case-insensitively, sorted so each group sits together.
3. For each group, the user opens the unwanted record and either **renames** it (if it is genuinely a different company) or **deletes** it (if it is unreferenced). A referenced duplicate that is genuinely the same customer cannot be deleted, so the user notes the pair for the reviewed merge script (Task 3.0, D4).
4. Flow ends: the toggle's count reaches zero, which is the precondition for Phase 3's index.
   Where it lives: the existing Companies list and record pages.

## 3. Result

**Before:** Invoicing ignores the credit limit entirely; a case-variant company name creates a second customer; nobody can list the duplicates that already exist.
**After:** Invoicing over the limit shows the exposure and asks for a reason that is kept; new case-variant duplicates are refused with a link to the original; existing duplicates can be filtered, resolved, and then locked out by the index.
**Key differences:**

- Accounting: an over-limit notice and a required reason in the Invoicing dialog.
- Sales: near-match list while typing a new company name, and a refusal for case-variants.
- Admin: a **Name collisions** filter on Companies.
- Audit: every over-limit invoice carries exposure, limit and reason.

## 4. Technical Architecture

**Exposure — one derivation, two callers (Journey 1 steps 1 and 4).**

```ts
// packages/api/src/modules/credit/exposure.ts  [NEW]
export async function companyExposure(
  db: Db,
  organizationId: string,
  companyId: string,
  currency: string,
): Promise<{ outstanding: string; limit: string | null; currency: string }>;
// SQL: sum(bill.total_amount - verified) over bills where
//   bill.organization_id = $org AND bill.settlement_company_id = $company
//   AND bill.attribute = 'receivable' AND bill.currency = $currency
//   AND (total_amount - verified) > 0
```

`verifiedAmountExpr` moves from `report.ts` into this module and `report.ts` imports it, so ageing and invoicing can never compute outstanding two ways.

**`bills.creditCheck` [NEW] (Journey 1 step 1).**

```ts
input:  { billIds: string[] }               // same scoping as bills.invoice
output: { companies: Array<{ companyId, companyName, currency,
          outstanding: string, limit: string, over: boolean }> }
```

Returns one row per company **per currency** (D3), only for companies with a non-null limit, plus `uncountedBills` — the selection's bills with no settlement company (D5). Scoped with the same `applyScope(… "expense", billScopeCols)` as `bills.invoice`.

**`bills.invoice` (Journey 1 step 4).** Input gains `creditOverrideReason: z.string().trim().min(10).max(500).optional()` (D9). After the scope and gate checks, inside the transaction the handler already opens (`context.db.transaction`, after its validation block): compute exposure per settlement company; if any is `over` and no reason → `ORPCError("PRECONDITION_FAILED", { message: "Sunrise Trading is over its credit limit (MYR 84,200.00 of MYR 50,000.00). Give a reason to invoice anyway." })`. With a reason → proceed and `writeAuditRaw(tx, { action: "bill.invoice.credit_override", after: { companyId, outstanding, limit, currency, reason } })`.

**Duplicate refusal (Journey 2 step 2).** In `company.create` and in `company.update` when `name` changes: `select id, name from company where organization_id = $org and lower(btrim(name)) = lower(btrim($name)) and id <> $self limit 1` → `ORPCError("CONFLICT", { message: "<existing name> is already in the directory — open it instead." })`. `refuseDuplicateName` stays as the backstop for the race.

**Near matches (Journey 2 step 1).** Reuse `company.list` with `q` and `limit: 5` — no new endpoint.

**Collision report (Journey 3).** `company.list` filter gains `nameCollisions: z.boolean().optional()` → `where lower(btrim(name)) in (select lower(btrim(name)) from company where organization_id = $org group by lower(btrim(name)) having count(*) > 1)`, ordered by `lower(btrim(name))`. `company.nameCollisionCount` [NEW] returns the count for the toggle badge.

**Index (Phase 3).** Migration `0067_company_name_ci_unique.sql` [NEW]:

```sql
DROP INDEX IF EXISTS "company_org_name_uidx";
CREATE UNIQUE INDEX "company_org_name_ci_uidx" ON "company" ("organization_id", lower(btrim("name")));
```

Drizzle: `uniqueIndex("company_org_name_ci_uidx").on(table.organizationId, sql\`lower(btrim(${table.name}))\`)`.

## 5. Phased Implementation

### Phase 1 — Crossing the credit limit becomes a recorded decision

**Delivers:** Journey 1.

- **1.1** Create `packages/api/src/modules/credit/exposure.ts` [NEW]; move `verifiedAmountExpr` there; update `report.ts` to import it (no behaviour change). · **Agent A (backend)**
- **1.2** Add `bills.creditCheck`; add `creditOverrideReason` and the in-transaction re-check + audit to `bills.invoice`. Files: `packages/api/src/routers/expense/bills.ts`. · **Agent A (backend)**
- **1.3** Tests at the API boundary: exposure is computed per currency and never sums across currencies (D3); `uncountedBills` counts the selection's bills with no settlement company (D5); a reason under 10 characters is refused (D9); under limit → no reason needed; over limit, no reason → `PRECONDITION_FAILED`; over limit with reason → issued + audit row; no limit → unaffected; bills with null `settlement_company_id` → unaffected; out-of-scope bill id → `NOT_FOUND` as today. Files: `packages/api/src/routers/expense.bills.test.ts`. · **Agent A (backend)**
- **1.4** Invoicing dialog: call `creditCheck` on open; render one notice line per over-limit currency and a _Not counted_ line for other currencies and `uncountedBills` (D3, D5); require a reason of at least 10 characters (D9); send `creditOverrideReason`. Files: `apps/web/src/routes/_next/expenses/bills.tsx`. · **Agent B (frontend)**

**Acceptance.** User can invoice an over-limit customer only after typing a reason, and the audit log shows it; under-limit invoicing is unchanged.

### Phase 2 — No new duplicates, and the old ones are findable

**Delivers:** Journeys 2 and 3.

- **2.1** Case-insensitive refusal in `company.create` and name-changing `company.update`; `nameCollisions` filter on `company.list`; `company.nameCollisionCount`. Files: `packages/api/src/routers/company.ts`. · **Agent C (backend)**
- **2.2** Tests: create case-variant → `CONFLICT` naming the original; rename into a case-variant → `CONFLICT`; rename to own name with different case → allowed; collision filter org-scoped. Files: `packages/api/src/routers/company.test.ts`. · **Agent C (backend)**
- **2.3** Near-match list under **Company title** in the Add dialog; inline refusal with link. Files: `apps/web/src/routes/_next/companies.tsx`. · **Agent D (frontend)**
- **2.4** **Name collisions** toggle with count in the Companies filters. Files: `apps/web/src/routes/_next/companies.tsx`. · **Agent D (frontend)**

**Acceptance.** User cannot create "SUNRISE SDN BHD" beside "Sunrise Sdn Bhd"; an admin can filter to every existing collision.

### Phase 3 — Lock it in

**Delivers:** Journey 2 becomes impossible to bypass, even by race.
**Dependencies:** **blocked until `company.nameCollisionCount` returns 0 in every environment the migration will run in** (dev branch and production). Referenced same-customer pairs are cleared by Task 3.0 rather than by building a merge tool (D4).

- **3.0** For each referenced same-customer pair left on the Phase 2 report, write a one-off, reviewed SQL script that repoints every reference to the surviving record — `quotation` and fee templates (`client_company_id`, `settlement_company_id`), `collective_order` (`client_company_id`, `entrust_company_id`), `cost_line` and `bill` (`settlement_company_id`, `entrust_company_id`, `billing_company_id`), `lading` (`shipper_id`, `consignee_id`, `notify_party_id`, `entrust_company_id`), `company_contact` and `contract` (`company_id`), and `thread_link` rows where `entity_type = 'customer'` (a text id, not a foreign key, so nothing refuses it) — inside one transaction, then deletes the duplicate. Run it against the dev branch first, read the row counts, and attach the script and counts to the PR. Files: `packages/db/scripts/merge-company-duplicates-2026-09.sql` [NEW]. · **Agent E (backend)**
- **3.1** Replace the index; generate `0067`; confirm the three migration gates. Files: `packages/db/src/schema/company.ts`, `packages/db/src/migrations/0067_company_name_ci_unique.sql` [NEW], `packages/db/src/migrations/meta/_journal.json`. · **Agent E (backend)**

**Acceptance.** Inserting a case-variant directly in SQL fails with `23505`, which `refuseDuplicateName` still maps to the friendly message.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent              | subagent_type     | Model  | Effort | Tasks   | Owns (write)                                                                                                                                                                             | Reads only                                                               |
| ------------------ | ----------------- | ------ | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Agent A (backend)  | backend-engineer  | opus   | high   | 1.1–1.3 | `packages/api/src/modules/credit/exposure.ts` [NEW], `packages/api/src/routers/report.ts`, `packages/api/src/routers/expense/bills.ts`, `packages/api/src/routers/expense.bills.test.ts` | `packages/db/src/schema/expense.ts`, `packages/db/src/schema/company.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.4     | `apps/web/src/routes/_next/expenses/bills.tsx`                                                                                                                                           | `packages/api/src/routers/expense/bills.ts`                              |

opus — money path, inside the invoicing transaction, tenant-scoped aggregate. Run mode **A → B** (B waits on `bills.creditCheck`'s contract).

**Phase 2**

| Agent              | subagent_type     | Model  | Effort | Tasks   | Owns (write)                                                                      | Reads only                            |
| ------------------ | ----------------- | ------ | ------ | ------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| Agent C (backend)  | backend-engineer  | opus   | high   | 2.1–2.2 | `packages/api/src/routers/company.ts`, `packages/api/src/routers/company.test.ts` | `packages/db/src/schema/company.ts`   |
| Agent D (frontend) | frontend-engineer | sonnet | medium | 2.3–2.4 | `apps/web/src/routes/_next/companies.tsx`                                         | `packages/api/src/routers/company.ts` |

opus — the collision filter is an org-scoped subquery. Run mode **C → D**. Phases 1 and 2 are file-disjoint and may run in parallel.

**Phase 3**

| Agent             | subagent_type    | Model | Effort | Tasks   | Owns (write)                                                                                                                                                                                    | Reads only |
| ----------------- | ---------------- | ----- | ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Agent E (backend) | backend-engineer | opus  | high   | 3.0–3.1 | `packages/db/scripts/merge-company-duplicates-2026-09.sql` [NEW], `packages/db/src/schema/company.ts`, `packages/db/src/migrations/0067_*.sql`, `packages/db/src/migrations/meta/_journal.json` | —          |

opus — a data-repointing script and a unique index migration, both against live data. Run mode: single — 3.0 then 3.1, after the collision gate.
**Serialization points:** type-check after each phase (read the output, not the exit code); migration applied and journal checked after 3.1.

## 7. Impact & Breakage Analysis

- **`verifiedAmountExpr` move** — callers: `report.ts` only (grepped). Pure relocation; the ageing test suite is the guard.
- **`bills.invoice`** — additive optional input. Callers: `apps/web/src/routes/_next/expenses/bills.tsx` (single and batch invoicing). **Behaviour change:** an over-limit invoice without a reason is now refused. Any script or batch path that invoices without the dialog must pass a reason — grep found no other caller in `apps/web`.
- **Nullable fields relied on** — `bill.settlement_company_id` is nullable; those bills are skipped by the check (they have no limit to consume). **This under-counts exposure while ledger defect rank 01 stands** — most fees reach bills without a company. The dialog states how many bills it could not count → D5.
- **`company.create` / `update`** — new refusal. Callers: the Add dialog, the edit form, `company.ts` backfill paths — **check `company-backfill.test.ts` fixtures do not rely on case-variant names.**
- **`company.list` filter** — additive.
- **Deployment coupling** — Phase 1 backend must deploy before or with its dialog; the dialog without the server sends an unknown field (stripped) and never sees the check. Phase 3 must deploy only after the collision count is zero in production, or the migration fails mid-deploy (see `alchemy-partial-deploy-splits-the-stage`).
- **Blocking prerequisites** — Phase 3 is blocked on data. Phases 1–2 have none.

## 8. Cross-Cutting Concerns

- **Errors** — credit refusal is `PRECONDITION_FAILED` with a full sentence; duplicate refusal is `CONFLICT` naming the original; both surface through the existing `toast.error(error.message)` and, in the dialogs, inline.
- **Testing** — API tests per phase; browser proof per §10.
- **Migration** — one migration, gated on data; rollback recreates `company_org_name_uidx`.
- **Rollback** — Phases 1–2 revert cleanly; Phase 3 rollback is `DROP INDEX company_org_name_ci_uidx; CREATE UNIQUE INDEX company_org_name_uidx …`.

**Performance & Scalability**

1. **Pagination** — `creditCheck` returns at most one row per company in the (≤200) selected bills; the collision filter rides `company.list` pagination.
2. **SQL-side filtering** — exposure summed in SQL; collisions found with `group by lower(btrim(name)) having count(*) > 1`.
3. **N+1** — `creditCheck` groups by `settlement_company_id` in one query, not one query per bill.
4. **Index coverage** — **measured 2026-09-14 on the dev branch:** `EXPLAIN` of the exposure query is an _Index Scan using `bill_org_created_idx`_ on `organization_id`, with `settlement_company_id`, `attribute` and `currency` applied as a filter over that org's bills (134 bills on dev). **No new index in this plan.** Add `bill_org_company_attr_idx (organization_id, settlement_company_id, attribute)` in a later migration only if a single organisation's bill count makes that filter measurable; the collision subquery is served by Phase 3's `lower(btrim(name))` index, and by a scan of one org's companies before it.
5. **Write atomicity** — the re-check, the invoice, and the audit row share `bills.invoice`'s existing transaction.
6. **Row locking** — two invoices racing past the same limit: acceptable (a warning, not a hard cap); do not add `FOR UPDATE` on bills for an advisory check.
7. **Resources** — none new.
8. **Tenant isolation** — every exposure and collision query filters `organization_id` in SQL; `creditCheck` applies the expense scope before resolving companies.
9. **Payload** — a handful of rows.
10. **Hot path** — `creditCheck` runs when the Invoicing dialog opens; operator-triggered, not on page load.

## 9. Decision Register, Open Questions & Risks

Every decision this plan rests on. **All settled on 2026-09-14: you accepted every recommendation.** Each block keeps the group it was in before, so the history of what was asked, assumed or open stays readable. §1 and §4 point here by id.

### Settled — was open and blocking

**D4: Referenced duplicates cannot be deleted and there is no merge tool. How are they resolved?** · Status: Decided

|       | Approach                                                                       | Consequence                                                                       |
| ----- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **A** | Build a merge action that repoints quotations, orders, bills and contacts      | Resolves every case; large and risky — touches every table referencing `company`. |
| **B** | Rename genuine look-alikes; hand-merge the rest with a reviewed one-off script | Cheap, but a script per merge.                                                    |
| **C** | Leave referenced duplicates and exclude them from the index                    | The index can never land.                                                         |

- **Recommendation: B** — size the problem with Phase 2's collision count first; build A only if that count is large.
- **Chosen:** B (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No longer a decision block. Phase 3 still waits on data: the collision count must reach 0.
- **Where it lands:** Phase 3; Task 3.1

### Settled — was open

**D3: A credit limit has no currency, and bills do. What does "over the limit" mean?** · Status: Decided

|       | Approach                                                           | Consequence                                                                              |
| ----- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **A** | Compare only bills in `company.settlement_currency`; ignore others | Simple; a customer billed in two currencies is only half-checked, silently.              |
| **B** | Convert every bill with the exchange-rate table                    | Complete, but there is no organisation base currency (rank 07) and rates are hand-typed. |
| **C** | Check per currency and say which currencies were not counted       | Never claims a number it cannot compute.                                                 |

- **Recommendation: C** — it is honest at the point of decision and becomes B once rank 07 is fixed.
- **Chosen:** C (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No (settled).
- **Where it lands:** §4 `companyExposure`, `bills.creditCheck`; Tasks 1.1, 1.2, 1.4

**D5: Exposure under-counts while bills lose their company (ledger rank 01). Ship anyway?** · Status: Decided

|       | Approach                                                  | Consequence                                                             |
| ----- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| **A** | Ship the check as is                                      | Some over-limit customers will not trip it; when it fires, it is right. |
| **B** | Fix rank 01 first                                         | Complete, but credit waits on the largest defect in the chain.          |
| **C** | Ship, and show "N bills with no company were not counted" | Honest about the gap in the dialog itself.                              |

- **Recommendation: C** — a check that says what it could not see beats one that silently under-counts, or none at all.
- **Chosen:** C (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 `bills.creditCheck` output; Task 1.4

### Settled — decided at the input gate

**D1: How hard should invoicing enforce the credit limit?** · Status: Decided

|       | Approach                                | Consequence                                                          |
| ----- | --------------------------------------- | -------------------------------------------------------------------- |
| **A** | Warn, and allow with an audited reason  | Keeps the advisory spirit; crossing the line becomes a recorded act. |
| **B** | Block over the limit (manager override) | Reverses the earlier advisory decision.                              |
| **C** | Advisory badge only                     | Matches the current decision exactly; never interrupts.              |

- **Recommendation: A** — the code documents credit as advisory by an earlier phase decision; A keeps that and adds accountability.
- **Chosen:** A (you, at the input gate — matched the recommendation)
- **Blocking?** No (settled).
- **Where it lands:** Phase 1

**D2: What happens to company names that already collide by case?** · Status: Decided

|       | Approach                                                                       | Consequence                                            |
| ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **A** | Prevent new ones, report existing ones, add the index once the report is empty | Safe; the index waits on people resolving the list.    |
| **B** | Automated merge in a migration                                                 | Fast; a wrong merge is hard to undo.                   |
| **C** | Prevent new ones only; no index                                                | Existing duplicates stay; a race can still create one. |

- **Recommendation: A** — it never deletes or merges data without a person looking, and still ends with the database enforcing it.
- **Chosen:** A (you, at the input gate — matched the recommendation)
- **Blocking?** No (settled).
- **Where it lands:** Phases 2–3

### Settled — was a plan assumption

**D6: How does the invoicing dialog learn the exposure?** · Status: Decided

|       | Approach                                                            | Consequence                                                                              |
| ----- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **A** | A read-only `bills.creditCheck`, re-enforced inside `bills.invoice` | Matches the `quotations.tariffCheck` precedent; one extra request when the dialog opens. |
| **B** | Refuse with structured error data and let the client react          | One round-trip; no precedent in this repo for `ORPCError` data.                          |
| **C** | Compute it in the client from lists already loaded                  | No server change; trivially bypassed and easily wrong.                                   |

- **Recommendation: A** — the tariff check already established this exact read-then-enforce pattern.
- **Chosen:** A (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4; Tasks 1.2, 1.4

**D7: What counts toward a customer's exposure?** · Status: Decided

|       | Approach                                        | Consequence                                                        |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------ |
| **A** | Outstanding receivable bills only               | Clear and matches the ageing report's definition of outstanding.   |
| **B** | Receivables net of payables to the same company | Right for agents who are also suppliers; wrong for most customers. |
| **C** | Receivables plus cost lines not yet billed      | Earliest warning; counts money not yet asked for.                  |

- **Recommendation: A** — it reuses `outstandingExpr` so ageing and invoicing can never disagree about who owes what.
- **Chosen:** A (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 `companyExposure`; Task 1.1

**D8: Two invoices racing past the same limit at once?** · Status: Decided

|       | Approach                                               | Consequence                                    |
| ----- | ------------------------------------------------------ | ---------------------------------------------- |
| **A** | Accept it — the check is a warning, not a cap          | No locking on the money tables.                |
| **B** | Lock the company's bills `FOR UPDATE` during the check | Exact; serialises invoicing per customer.      |
| **C** | A Postgres advisory lock per company                   | Exact without row locks; one more moving part. |

- **Recommendation: A** — D1 makes this a recorded warning, so a rare double-pass costs a missing reason, not money.
- **Chosen:** A (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §8 item 6

**D9: What does a valid over-limit reason look like?** · Status: Decided

|       | Approach                       | Consequence                                        |
| ----- | ------------------------------ | -------------------------------------------------- |
| **A** | Any non-empty text             | Fastest; invites "ok".                             |
| **B** | At least 10 characters         | A light nudge toward a real sentence.              |
| **C** | A picked reason plus free text | Reportable; a closed list someone has to maintain. |

- **Recommendation: B** — it blocks the reflexive "ok" without inventing a taxonomy nobody has agreed.
- **Chosen:** B (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 `creditOverrideReason`; Task 1.2

**D10: How is case-insensitive uniqueness enforced?** · Status: Decided

|       | Approach                                                  | Consequence                                                           |
| ----- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| **A** | A unique index on `(organization_id, lower(btrim(name)))` | Core Postgres; replaces the old index.                                |
| **B** | A `citext` column                                         | Idiomatic, but an extension — the PGlite migration replay forbids it. |
| **C** | A stored `name_key` column kept in sync                   | Works everywhere; a second copy of the name to maintain.              |

- **Recommendation: A** — it is the only one that passes the repo's migration gates without adding state.
- **Chosen:** A (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 index; Task 3.1

**Risks.**

- _Phase 3 migration runs against production with collisions still present_ → high impact → **the gate is a production data check, recorded in the PR before merge.**
- _Resolving collisions changes what the A3 backfill can link_ → likely, and wanted → **re-run the backfill after Phase 2's report reaches zero and record how many more quotations gain a company; `company.create` is the only code that inserts companies, so nothing else is affected by the refusal.**

## 10. Verification & Proof

**App URL:** http://localhost:3101
**Preconditions:** seeded owner org (`e2e/fixtures/seed-cli.ts seed-parity <runId>`); company "Sunrise Trading" with credit limit 50,000 and settlement currency MYR; two unpaid MYR receivable bills to it totalling 84,200, both approved (so the invoicing gate is clear); company "Sunrise Sdn Bhd" plus an unreferenced "SUNRISE SDN BHD" inserted before Phase 2 lands.
**Migrations:** Phase 3 adds `0067_company_name_ci_unique` — confirm the journal and apply only after the collision count is 0.

**Golden path — Journey 1:**

1. `/expenses/bills` → tick one Sunrise Trading bill → **Invoicing**.
2. Expect the amber notice naming MYR 84,200.00 against MYR 50,000.00 and a **Reason for invoicing over the limit** box; **Issue Invoice** disabled.
3. Type "Agreed with director — payment due Friday" → **Issue Invoice** enables → press it → toast _Invoice … issued_.
4. `/audit-log` → the newest entry is `bill.invoice.credit_override` with the reason and figures.

**Golden path — Journey 2:**

1. `/companies` → **Add** → type "sunrise sdn" → _Already in the directory:_ lists **Sunrise Sdn Bhd**.
2. Type exactly "SUNRISE SDN BHD" → **Create and continue** → refused inline with a link to **Sunrise Sdn Bhd**; no company created.

**Golden path — Journey 3:**

1. `/companies` → **All filters** → **Name collisions (1)** → the two Sunrise Sdn Bhd variants list together.
2. Open the unreferenced variant → delete → the toggle count becomes 0.

**Edge case:** a bill whose settlement company has **no** credit limit → Invoicing shows no notice and issues as today.
**Regression check:** the ageing report's detail and export totals are unchanged after `verifiedAmountExpr` moves (`report.test.ts` passes, and one exported sheet compared before/after).
**Mobile:** at 400px the credit notice and reason box stack inside the dialog without horizontal scroll.

**Readiness: 8/10** — every procedure, column, index and precedent named here was verified in code or measured on the dev branch on 2026-09-14; Phases 1–2 are ready to execute. The remaining points are one number: **production's collision count**, which the repo's `dev-db-guard` correctly stops me reading. If it is 0, Task 3.0 is a no-op and this plan is 9/10; if it is not, the count sizes Task 3.0.

**To take the reading (owner only, read-only, counts only):**

```bash
I_KNOW_THIS_IS_PRODUCTION=1 bun --env-file=apps/server/.env --env-file=packages/infra/.env.prod \
  --preload ./apps/server/cf-shim.mjs e2e/out/_walk/probe-step2.ts
```

It runs two `SELECT`s and prints `collision groups` and `collided companies referenced` — no names, no writes.
