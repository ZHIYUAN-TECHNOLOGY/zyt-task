# Step 03 — make an un-nominated contact visible, not invisible

**SOP step:** 03 "Record the person who called" · `/companies/$companyId` → Contacts card
**Evidence read at:** commit `6c31a20e`, 2026-09-14
**Tier:** Standard (adds an `organizationId`-scoped query to the ageing report)

---

## Phase 0 findings (read before the plan)

- **Stack** — oRPC (`@orpc/server`, `@orpc/zod`) routers in `packages/api/src/routers`, Drizzle (`drizzle-orm`, `drizzle-kit`) schema in `packages/db/src/schema`, TanStack Router file routes under `apps/web/src/routes/_next`, zod on both sides, vitest.
- **The defect as filed** — "a contact nobody ticked as Primary never reaches the collections call list" — **is accurate about the behaviour but wrong to call it an accident.** Two deliberate, documented decisions produce it:
  1. `computeAgeing` (`packages/api/src/routers/report.ts`, the `companyContact` left join in the detail query) joins on `is_primary = true`, and `report.test.ts` pins case 3 — _"resolved company, contacts but NO primary → blank, row survives"_ — with the comment _"'we hold people here but nobody is nominated' is a real state of the directory, not an error."_ The fixture's non-primary contact is a **"Junior Clerk", role "Documentation"**: exactly the person a fallback would ring about an unpaid debt.
  2. The export (`report.ts`, the `Ageing Detail` sheet rows) writes the Contact cells **blank, never a placeholder**, so _"a collections supervisor [can] select the Contact column and filter to Blanks to get the list of counterparties the directory is missing a person for."_
- **So the real defect is narrower:** the sheet cannot tell _"we hold nobody"_ from _"we hold three people and nobody chose one."_ Both print blank, so the Blanks filter sends the clerk to add a contact that already exists.
- **Precedent for ordering** — `companyContacts.list` orders `is_primary desc, created_at asc, id asc`, and the send-quotation dialog prefills `rows.find(r => r.isPrimary) ?? rows[0]`. The UI already picks a fallback for _email prefill_; the report deliberately does not for _debt collection_. Both are defensible; this plan keeps that split.
- **Touch surface** — `packages/api/src/routers/report.ts` (detail select, detail mapping, export headers + rows), `packages/api/src/routers/report.test.ts` (the four-bill call-list test), `apps/web/src/components/company/company-contacts.tsx` (Contacts card). No web consumer renders ageing `detail` rows — `apps/web/src/routes/_next/report/financial/index.tsx` reads the summary and calls `report.exportAgeing` — so the new field is additive.
- **Migration state** — journal has 65 entries ending `0065_quotation_send_decision`; 65 `.sql` files. Contiguous, nothing pending. **This plan adds no migration.**
- **Index** — `company_contact_companyId_idx (company_id, created_at)` covers a `group by company_id`; the partial `company_contact_primary_uidx … where is_primary` enforces one primary per company and is not touched.

---

## 1. Overview

**Problem.** On the month-end ageing export, a counterparty with contacts on file but none marked primary prints blank Contact / Role / Phone / Email — identical to a counterparty with no contacts at all. The supervisor's "filter Contact to Blanks" workflow therefore mixes two different jobs: _add a person_ and _nominate one of the people already there_. The second job is invisible, so it does not get done, and the clerk looks the number up by hand.

**Goal.** Make the un-nominated state visible in both places it matters — on the export, and on the company's Contacts card — **without** guessing who to ring and **without** breaking the Blanks filter.

**Success criteria.**

- The Ageing Detail sheet has a numeric **Contacts on file** column: `0` for none, `N` for a company with people and no primary, blank when the bill has no resolved company.
- Filtering Contact = Blanks **and** Contacts on file > 0 yields exactly the companies that need a primary nominated.
- A company's Contacts card warns when contacts exist and none is primary, with the fix one click away.

**In scope.** The detail query, its mapping, the export columns, the existing test, the Contacts card notice.
**Out of scope.** Auto-promoting a contact; falling back to a non-primary contact on the sheet; changing the partial unique index; any schema change; showing contacts on the Financial Stat tab itself.

**Assumptions.**

- No existing `_plan/` session covers contact nomination (active sessions: five-designs, money-search, tariff-rate-cards, w1-fleet, w4-quick-view, operational-readiness), so this is a new session rather than an addition.
- The two decisions above are correct and are kept; the fix is visibility, not a behaviour reversal → D1, D2
- "Contacts on file" counts every contact row for the company in the org, regardless of role → D4

## 2. User Journeys

**Journey 1 (new): Collections supervisor finds companies that need a primary nominated**
Trigger: Month end. Reports → Financial Stat → Ageing tab → Export.
Steps:

1. Supervisor presses **Export** on the Ageing tab → an XLSX downloads (unchanged).
2. Opens the **Ageing Detail** sheet → sees the existing Contact, Contact Role, Contact Phone, Contact Email columns, and a new **Contacts on file** column immediately after them.
3. Filters Contact = (Blanks) → sees every row with nobody to ring (unchanged behaviour).
4. Adds a second filter, Contacts on file > 0 → the list narrows to companies that _have_ people but no nominated primary.
5. Flow ends: the supervisor hands that shorter list to Sales to nominate, and the rest (Contacts on file = 0) to whoever adds new contacts.
   Where it lives: the existing ageing export — no new screen.

Old journey, for contrast — steps 1–3 identical; at step 3 every blank looked the same, so both jobs went to "add a contact", and the people already on file were looked up by hand.

**Journey 2 (new): Sales sees that nobody is nominated while on the company**
Trigger: Sales opens a company from Sales → Companies.
Steps:

1. User sees the company record → the **Contacts** card lists its people, primary first (unchanged ordering).
2. If one or more contacts exist and none is primary → an inline notice sits above the table: _"Nobody is marked primary. This company's row on the collections sheet will have no one to ring — edit a contact and tick Primary contact."_
3. User presses the pencil (**Edit**) on the right person → the existing **Edit contact** dialog opens (unchanged).
4. Ticks **Primary contact** → **Save changes** → toast _Contact updated_ (unchanged).
5. Flow ends: the list refetches, the primary sorts to the top, the notice is gone.
   Where it lives: inline in the existing Contacts card.

## 3. Result (What Changes for the User)

**Before:** A company with three contacts and no primary prints blank on the collections sheet, looking exactly like a company with nobody on file. Nothing on the company record says anything is wrong.
**After:** The sheet says how many people are on file, so the two gaps can be told apart by a filter, and the Contacts card tells Sales that nobody is nominated.
**Key differences:**

- Collections supervisor: new **Contacts on file** column on Ageing Detail.
- Sales: a notice on the Contacts card when contacts exist but none is primary.
- Nobody: no change to who is rung — the sheet still names only a nominated primary.

## 4. Technical Architecture

**Data flow.** `report.ageing` / `report.exportAgeing` → `computeAgeing` → detail query. Add one derived table, joined once, carrying a per-company contact count; surface it on the detail row; write it as a numeric cell in the export.

**Detail query — derived count (serves Journey 1 steps 2 and 4).**

```ts
// packages/api/src/routers/report.ts — inside computeAgeing, beside the existing companyContact join
const contactCounts = context.db
  .select({
    companyId: companyContact.companyId,
    onFile: sql<number>`count(*)::int`.as("on_file"),
  })
  .from(companyContact)
  .where(eq(companyContact.organizationId, context.org.organizationId))
  .groupBy(companyContact.companyId)
  .as("contact_counts");

// …existing select gains:
contactsOnFile: contactCounts.onFile,

// …existing joins gain, AFTER the primary-contact join:
.leftJoin(contactCounts, eq(contactCounts.companyId, bill.settlementCompanyId))
```

- A grouped derived table joined once, **not** a correlated subquery per row (see §8 item 3).
- Scoped by `organizationId` inside the derived table, so the join cannot count another tenant's contacts (§8 item 8).
- The existing `is_primary = true` join is **unchanged** — no new fan-out: `contact_counts` has one row per company.

**Detail mapping (serves Journey 1 step 2).**

```ts
// three-way, and the difference is the point:
contactsOnFile: d.companyId === null ? null : Number(d.contactsOnFile ?? 0),
//   null → the bill never resolved to a company (free-text settlement unit)
//   0    → a company with nobody on file
//   N>0  → people on file; `contactName === null` then means "none nominated"
```

**Export (serves Journey 1 steps 2–4).** Append header `"Contacts on file"` after `"Contact Email"`; the row writes `d.contactsOnFile ?? ""` as a **number** cell (empty for null). The four Contact cells stay exactly as they are — blank means blank — so the existing Blanks filter keeps working.

**Contacts card notice (serves Journey 2 step 2).** In `apps/web/src/components/company/company-contacts.tsx`, derive:

```ts
// list is ordered is_primary desc, so page 1's first row answers for every page
const noPrimary = query.isSuccess && total > 0 && rows.length > 0 && !rows[0].isPrimary;
```

and render a notice above the table. No new request: the existing `companyContacts.list` query already carries `total` and the ordering.

**Key decisions.**

- **Visibility over inference.** Do not pick a person the business did not nominate → D1.
- **A separate column over a placeholder.** Keeps the documented Blanks filter intact → D2.
- **Derived-table join over a per-row subquery.** One aggregate for the whole detail query → D3.

## 5. Phased Implementation

### Phase 1 — The sheet tells the two gaps apart

**Delivers:** Journey 1 end-to-end.
**Dependencies:** none (no pending migrations).

- **Task 1.1** — Add the `contactCounts` derived table and `contactsOnFile` to the detail select in `computeAgeing`; left join it on `bill.settlementCompanyId`. Keep the primary-contact join untouched.
  Files: `packages/api/src/routers/report.ts` · Owner: **Agent A (backend)**
- **Task 1.2** — Map `contactsOnFile` three-way (null / 0 / N) in the returned `detail` rows, with a comment naming the three meanings.
  Files: `packages/api/src/routers/report.ts` · Owner: **Agent A (backend)**
- **Task 1.3** — Append the `"Contacts on file"` header and a numeric cell to the Ageing Detail sheet rows. Do not touch the four Contact cells.
  Files: `packages/api/src/routers/report.ts` · Owner: **Agent A (backend)**
- **Task 1.4** — Extend the existing four-bill call-list test: BILL-CALL-1 → `contactsOnFile` 2 (primary + second contact), BILL-CALL-2 → 0, BILL-CALL-3 → 1 with `contactName` still null, BILL-CALL-4 → null. Keep every existing assertion, including the fan-out guard (still exactly one row per bill).
  Files: `packages/api/src/routers/report.test.ts` · Owner: **Agent A (backend)**

**Acceptance.** Supervisor can export, filter Contact = Blanks and Contacts on file > 0, and get only the companies with people but no primary. `report.test.ts` passes with the extended cases; row counts unchanged.

### Phase 2 — The company says so too

**Delivers:** Journey 2 end-to-end.
**Dependencies:** none on Phase 1 (disjoint files); can ship first or together.

- **Task 2.1** — Derive `noPrimary` from the existing list query and render an inline notice above the contacts table, using the card's existing notice/empty-state styling. Hide it while the query is pending or errored.
  Files: `apps/web/src/components/company/company-contacts.tsx` · Owner: **Agent B (frontend)**

**Acceptance.** On a company with contacts and no primary, user sees the notice, edits a contact, ticks Primary, saves, and the notice disappears without a reload.

## 6. Delegation & Parallelization Plan

**Phase 1 — The sheet tells the two gaps apart**

| Agent             | subagent_type    | Model | Effort | Tasks   | Owns (write)                                                                    | Reads only                          |
| ----------------- | ---------------- | ----- | ------ | ------- | ------------------------------------------------------------------------------- | ----------------------------------- |
| Agent A (backend) | backend-engineer | opus  | high   | 1.1–1.4 | `packages/api/src/routers/report.ts`, `packages/api/src/routers/report.test.ts` | `packages/db/src/schema/company.ts` |

opus — the change adds an `organizationId`-scoped aggregate to a multi-tenant report query and must not introduce row fan-out.
Run mode: single agent.

**Phase 2 — The company says so too**

| Agent              | subagent_type     | Model  | Effort | Tasks | Owns (write)                                           | Reads only                                    |
| ------------------ | ----------------- | ------ | ------ | ----- | ------------------------------------------------------ | --------------------------------------------- |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 2.1   | `apps/web/src/components/company/company-contacts.tsx` | `packages/api/src/routers/company-contact.ts` |

Run mode: **A ∥ B** across the two phases — file sets are disjoint and neither consumes the other's output.
Serialization point: type-check (`bun run check-types`, reading its output rather than its exit code) after both finish.

Smell test: every task has one owner · no file owned twice · parallel groups disjoint · the one `opus` is justified · no sequential dependency · each phase completes a journey.

## 7. Impact & Breakage Analysis

- **`computeAgeing` detail rows** — callers: `report.ageing` (Financial Stat tab, reads the summary, not `detail`) and `report.exportAgeing` (the XLSX). Return shape change is **additive** (`contactsOnFile`); no caller destructures `detail` in `apps/web` (grepped: no `.tsx` reads `contactName` / `contactPhone`).
- **Row fan-out** — the new join is to a table with one row per `company_id`, so it cannot multiply bill rows. The existing test's "exactly one row per bill" assertion is the guard and is kept.
- **Nullable columns relied on** — `bill.settlement_company_id` is nullable (the historic free-text ledger, case 4). The mapping keys `null` on it deliberately; do not coalesce to 0 there.
- **Export consumers** — the column is appended at the end, so anyone with a spreadsheet macro reading columns by position keeps working for every existing column.
- **Contacts card** — reads only data already fetched; no new endpoint, no change to create/update/delete.
- **Deployment coupling** — none. Phase 1 and Phase 2 deploy independently in either order.
- **Blocking prerequisites** — none.

## 8. Cross-Cutting Concerns

- **Errors** — no new failure modes; the notice is hidden on a pending or errored list query.
- **Testing** — extend `report.test.ts` (API boundary for the count and the three-way mapping); the Contacts card notice is proven in the browser (§10).
- **Migration** — none.
- **Rollback** — revert the commit; no data written, nothing to undo.

**Performance & Scalability**

1. **Pagination** — N/A: the detail query's bounds are unchanged; this adds a column, not rows.
2. **SQL-side filtering** — the count is computed and org-scoped in SQL.
3. **N+1** — none: one grouped derived table joined once, not a subquery per detail row.
4. **Index coverage** — `company_contact_companyId_idx (company_id, created_at)` serves the `group by company_id`; the `organization_id` predicate is evaluated inside the aggregate. If the table grows large, add `(organization_id, company_id)` — not needed at current volumes.
5. **Write atomicity** — N/A: read-only.
6. **Row locking** — N/A: no read-then-write.
7. **Resources** — no new connections or external calls.
8. **Tenant isolation** — the derived table filters `company_contact.organization_id = context.org.organizationId`; the join key alone would not be enough.
9. **Payload size** — one integer per detail row.
10. **Hot path** — month-end report and export, operator-triggered; not on page load.

## 9. Decision Register, Open Questions & Risks

Every decision this plan rests on. **All settled on 2026-09-14: you accepted every recommendation.** Each block keeps the group it was in before, so the history of what was asked, assumed or open stays readable. §1 and §4 point here by id.

### Settled — was open

**D1: When a company has contacts but none is primary, what does the collections sheet do?** · Status: Decided

|       | Approach                                                         | Consequence                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Fall back to the oldest contact                                  | Every row names somebody — including the "Junior Clerk, Documentation" the existing test uses as its example. Overturns a documented decision; can send a debt chase to the wrong desk. |
| **B** | Auto-promote the first contact on create                         | Stops new gaps, but nominates someone the business did not choose, leaves every existing company blank, and a deleted primary reopens the gap.                                          |
| **C** | Keep the sheet blank; add **Contacts on file** and a card notice | Nobody is guessed at; the gap becomes filterable and visible where it is fixed. Costs one column and one notice.                                                                        |

- **Recommendation: C** — both existing decisions — no guessed primary, blank Contact cells for the Blanks filter — are deliberate and pinned by `report.test.ts`; C fixes the friction without reversing either.
- **Chosen:** C (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No (settled).
- **Where it lands:** §4 detail query and export; Tasks 1.1–1.4, 2.1

**D2: Where does "people on file, none nominated" show on the sheet?** · Status: Decided

|       | Approach                                                   | Consequence                                                                                         |
| ----- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **A** | Text in the blank Contact cell ("3 on file, none primary") | Breaks the documented Blanks filter — placeholder text sorts and filters as if somebody were there. |
| **B** | A separate numeric **Contacts on file** column             | Contact stays blank-filterable; the two gaps separate with a second filter.                         |
| **C** | Leave the sheet; fix it only on the Contacts card          | Cheapest, but the supervisor at month end still cannot tell the gaps apart.                         |

- **Recommendation: B** — preserves the existing export contract and adds the one filter that was missing.
- **Chosen:** B (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 export; Task 1.3

### Settled — was a plan assumption

**D3: How is the per-company contact count computed?** · Status: Decided

|       | Approach                                                | Consequence                                                                    |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **A** | One grouped derived table, org-scoped, left-joined once | One aggregate for the whole detail query; no row fan-out.                      |
| **B** | A correlated subquery per detail row                    | Simpler to read; Postgres evaluates it per row — an N+1 in SQL.                |
| **C** | A second query, merged in JavaScript                    | Keeps the main query untouched; two round-trips and merge code that can drift. |

- **Recommendation: A** — the detail query is already a set-based join; a derived table matches it and scales with bills, not bills × contacts.
- **Chosen:** A (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 detail query; Task 1.1

**D4: What does "Contacts on file" count?** · Status: Decided

|       | Approach                                    | Consequence                                                                          |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| **A** | Every contact row for the company           | Simple and honest; a contact with no phone or email still counts.                    |
| **B** | Only contacts with a phone or email         | Counts people you could actually ring; hides contacts recorded by name only.         |
| **C** | Only contacts whose role looks like finance | Closest to "someone to chase", but role is free text — the match would be guesswork. |

- **Recommendation: A** — the column's job is to say "people exist, none nominated"; filtering on reachability belongs to whoever nominates.
- **Chosen:** A (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 derived table; Task 1.1

**D5: How does the Contacts card know nobody is primary?** · Status: Decided

|       | Approach                                                                | Consequence                                                                    |
| ----- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **A** | Read `rows[0].isPrimary` from the existing list (ordered primary-first) | No new request; correct across pages because the order puts any primary first. |
| **B** | A new `hasPrimary` field on the list response                           | Explicit, but changes a shared response shape for one notice.                  |
| **C** | A separate count endpoint                                               | Most explicit; an extra request on every company page.                         |

- **Recommendation: A** — `companyContacts.list` already orders `is_primary desc`, so page 1's first row answers the question for free.
- **Chosen:** A (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §4 Contacts card; Task 2.1

**D6: Add a `(organization_id, company_id)` index on `company_contact` now?** · Status: Decided

|       | Approach                                | Consequence                                                                               |
| ----- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| **A** | Add it in this change                   | Future-proof; a migration for a table that is small today.                                |
| **B** | Add it later, if `EXPLAIN` shows a scan | No migration now; `company_contact_companyId_idx` covers the group-by at current volumes. |
| **C** | Never                                   | Relies on the org predicate staying cheap forever.                                        |

- **Recommendation: B** — the existing `(company_id, created_at)` index serves the aggregate today, and this plan is otherwise migration-free.
- **Chosen:** B (you, 2026-09-14 — accepted the recommendation)
- **Blocking?** No.
- **Where it lands:** §8 item 4

**Risks.**

- _A macro reads the Ageing Detail sheet by column count_ → low likelihood, low impact → **append the column last** so every existing column keeps its position.
- _The card notice nags where "nobody nominated" is intended_ → medium likelihood, low impact → **word it as information about the sheet, not an error**, inside the card rather than as a toast.

## 10. Verification & Proof

**App URL:** http://localhost:3101
**Preconditions:** a seeded owner org (`e2e/fixtures/seed-cli.ts seed-parity <runId>`); in it, one company with two contacts and **no** primary, one company with one primary contact, one company with no contacts; an unpaid receivable bill whose settlement company is each of them, plus one free-text-only bill.
**Migrations:** none.

**Golden path — Journey 1:**

1. Navigate to `/report/financial` → the Financial Stat page loads.
2. Open the **Ageing** tab → the summary table renders.
3. Press **Export** → an XLSX downloads.
4. Open the **Ageing Detail** sheet → the last column is headed **Contacts on file**.
5. Row for the two-contacts-no-primary company → Contact cells empty, Contacts on file = **2**.
6. Row for the primary-contact company → Contact shows the person, Contacts on file = **1**.
7. Row for the no-contacts company → Contact cells empty, Contacts on file = **0**.
8. Row for the free-text bill → Contact cells empty, Contacts on file **empty**.

**Golden path — Journey 2:**

1. Navigate to `/companies`, open the two-contacts-no-primary company → the Contacts card shows 2 rows and the **Nobody is marked primary** notice.
2. Press the pencil on either contact → **Edit contact** opens.
3. Tick **Primary contact** → press **Save changes** → toast _Contact updated_.
4. The ticked contact sorts to the top and the notice is gone, without a reload.

**Edge case:** a company whose only contact was primary and is then deleted → the card shows its empty state (no contacts), **not** the no-primary notice; on the sheet, Contacts on file = 0.
**Regression check:** §7's fan-out guard — every bill still appears on the Ageing Detail sheet exactly once; the existing `report.test.ts` call-list assertions pass unchanged.
**Mobile:** at 400px, the notice wraps inside the Contacts card without horizontal overflow.

**Readiness: 9/10** — the approach reverses no documented decision and touches three files; the remaining points are the unconfirmed `(organization_id, company_id)` index need at larger contact volumes (D6 defers it), and a browser pass on the export that no test automates.
