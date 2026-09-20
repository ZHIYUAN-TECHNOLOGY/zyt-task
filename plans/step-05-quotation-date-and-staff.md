# Step 05 — the quotation's date and salesperson become facts someone chose, not save-time accidents

**SOP step:** 05 "Raise the quotation" · `/quotations` → **Add** → `/quotations/$quotationId` (brief disclosure **All 27 fields + 16 services**)
**Evidence read at:** commit `6bb3a1bf` (HEAD of `feat/new-layout`, 2026-09-15). The step JSON was captured at `6c31a20e`; every citation below was re-located by symbol at `6bb3a1bf`.
**Tier:** Standard. Two writers (`quotations.create`, `quotations.duplicate`) change what they stamp, one customer-facing printed value changes encoding, and the editor gains two fields. No schema change and no `organizationId` or scope change: `quotationScopeCols` stays `{organizationId, owningBranchId, createdBy}`, and this plan does not touch `createdBy`.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (zod inputs), Drizzle schema in `packages/db/src/schema`, TanStack Router file routes under `apps/web/src/routes/_next`, `@tanstack/react-form` on the editor, vitest with a PGlite harness for router tests, and Playwright specs under `e2e/specs`.
- **Both defects are accurate as filed.** The JSON's line numbers still hold at HEAD, give or take nothing:
  - `quotationHeaderInput` accepts `quotationDate: z.coerce.date().optional()` and `quotationStaff: z.string().optional()` (`packages/api/src/routers/quotation.ts:1531-1532`). `update` is `quotationHeaderInput.partial()` (`:3126`) and writes `.set({ ...patch, … })` (`:3304`), so both keys already work as patches.
  - `create` stamps `quotationDate: header.quotationDate ?? now` (`:3067`) and `quotationStaff: header.quotationStaff ?? context.session.user.name ?? membership.id` (`:3069`). The floor check on create uses `header.quotationDate ?? now` (`:3022`). The one on update uses `patch.quotationDate !== undefined ? patch.quotationDate : existing.quotationDate` (`:3290`).
  - `duplicate` builds `baseHeader = { ...source, id, createdBy: membership.id, … quotationDate: now, … }` (`:3450-3486`). `quotationStaff` rides in unchanged on `...source`.
  - The editor's `quoteFormSchema` (`apps/web/src/routes/_next/quotations/$quotationId.tsx:276-323`), its `defaultValues` (`:960-1005`) and its submit payload (`:1007-1080`) contain **neither** key. `grep quotationDate|quotationStaff apps/web/src` finds only the ledger's column (`-quotations.columns.tsx:142,149`), its filters (`index.tsx:590` for Quotation Staff as a text box, `:688-700` for Date From/To), and a comment in `supersede-template-dialog.tsx:76`.
- **Where the value goes.**
  - The printed sheet uses `dateOnly(header.quotationDate)`, which is `toISOString().slice(0,10)` and therefore the **UTC** day (`packages/api/src/modules/quotation/sheet.ts:199,341`). It prints `header.quotationStaff` as 业务员 (`:356`).
  - The tariff resolver judges the date through `businessDayStart`, the **Malaysian** day (`packages/api/src/quotation/tariff-check.ts:126`, MYT = UTC+8). That same function drives `loadTariffCells` (`quotation.ts:1817`), `tariffCheck` (`:2440-2472`), the ledger's drift badge (`:2322`) and `applyTemplate` (`:3563`).
  - The ledger filters `gte/lte(quotation.quotationDate, from/to)` (`:2044-2045`) and `ilike(quotation.quotationStaff, …)` (`:2048-2049`).
  - `convertToOrder` copies `operationPersonnel: q.quotationStaff` (`:4007`), so a wrong salesperson also lands on the order.
- **A latent defect the JSON did not see, and it shapes D3.** Every `quotation_date` today is an *instant* (`now`). The sheet prints its UTC day, but the tariff check uses its MYT day. For a quote saved between 00:00 and 08:00 MYT the two days differ. The repair the JSON suggests, `formatDateInput(loaded?.quotationDate)`, seeds the box with the **UTC** day (`apps/web/src/lib/quotation.ts:124-129`). The first save would then store that day as UTC midnight and move the floor check back a day. The codebase already has the correct precedent for date-only values:
  - P0-20 treats `valid_from`/`valid_to` as a "wall date encoded as UTC midnight".
  - `supersede-template-dialog.tsx:55-72` has `todayWallDate()` and sends the `YYYY-MM-DD` string, never a `Date`.
  - `company-deals.tsx:2` imports `businessDayStart` from `@nct-ai/api/quotation/tariff-check` into the web app.
- **Precedent for staff.** Every personnel column in the app is free **text**: `collective_order.*_personnel` (`packages/db/src/schema/collective-order.ts:277-282`), `company.*_personnel`, `expense.*_personnel`, and `quotation_staff` (`packages/db/src/schema/quotation.ts:303`). `order-form.tsx:421-427` edits them as plain text inputs. The only member-directory control is `MemberPicker` (`apps/web/src/components/member-picker.tsx:111`). It is a **filter** control with an "All" option, and its value is a **member id**, used for `createdBy`. It cannot be dropped onto a column that stores a name, which is a conflict with the JSON's "member picker" repair (see §9 D1). `org.members.list` is gated on `member.read` (`packages/api/src/routers/org.ts:507`), and sales, ops and accounting receive it through `MODULE_ROLE_GRANTS` (`packages/api/src/roles.ts:61-66`). `MemberPicker` already degrades to disabled when the grant is missing.
- **Field policy already covers both keys.** `create` and `update` call `refuseDeniedFields(header|patch, org, "quotation")` (`quotation.ts:2977,3136`; `serialize.ts:233`), so an admin can already deny `quotationDate` or `quotationStaff` to a role. This plan does not change that.
- **Memory traps that apply to this page.**
  1. *edit-forms-cannot-clear-a-field*: the payload uses `emptyToUndefined`, so a blank box leaves the stored value alone.
  2. *tanstack-form-isdirty-never-resets*: already fixed on this page (`updateMutation.onSuccess` → `form.reset(saved)`, `:759-763`). The new fields ride along.
  3. *tanstack-form-istouched-reseed-trap*: the editor has no `remountDeps` (`:693`), so a seed that arrives late, such as the session user's name, only lands while the form is untouched.
  4. *refetch-overwrites-typed-input*: the page seeds through `defaultValues` rather than an effect, so it is safe as long as the new fields do the same.
  5. *orpc-query-input-key-not-typechecked*: no new query filter keys are added.
- **Tests that pin nearby behaviour.**
  - `quotation.filters.test.ts:215-313` covers staff substring matching and inserts `quotationDate` directly at `:429`.
  - `quotation.convert.test.ts:168` checks staff carried to the order.
  - `quotation.apply-picks.test.ts:787-816` covers the duplicate path. Its `ctx()` user has **no `name`**, so `create` there stamps `membership.id`.
  - `quotation.send-decide.test.ts:468-600` covers create/update refusals.
- **Migration state.** `packages/db/src/migrations/meta/_journal.json` has 65 entries ending in `0065_quotation_send_decision` (idx 64), and there are 65 `.sql` files, contiguous with nothing pending. Steps 01 and 02 claim `0066` and `0067`. **This plan adds no migration.** `0069` stays reserved for step 05 and is used only if D3 is decided as C.

---

## 1. Overview

**Problem.**
- **Date.** A quotation's 报价日期 is whatever instant its first save happened at. No screen can set it or correct it. That instant prints on the sheet `quotations.send` emails to the customer, it is the ledger's only date column and date filter, and its Malaysian day decides which tariff the price floor and the hints are judged against. A quote drafted Monday and issued Thursday goes out dated Monday. A quote keyed in late is floor-checked against the wrong sheet. The only correction today is **Duplicate**, which re-dates the quote and uses up a new number.
- **Staff.** 业务员 is stamped from whoever saved first, and `duplicate` silently copies the *source's* salesperson. A coordinator entering a quote for a salesperson, or salesperson B re-quoting A's decided quote (the path the app itself prescribes, `quotation.ts:3191`), emails the customer a sheet naming the wrong person. That name then carries on to the converted order's Operation Personnel. Nothing in the app can correct it.

**Goal.** An operator can see, set and correct both values on the quotation editor. A duplicate names the person who made it. The date is stored in one encoding that the sheet, the ledger and the tariff check all read as the same calendar day.

**Success criteria.**
- The brief disclosure shows **Quotation Date \*** and **Quotation Staff** beside Validity Start/End. On a new quote they are pre-filled with today's Malaysian date and the signed-in member's name.
- Changing either and pressing **Save Quote** persists it. The ledger row, the exported sheet (EN 报价日期 / Quotation date and 业务员) and the tariff hints all reflect the change after a reload.
- Duplicating someone else's quote yields a draft whose Quotation Staff is the duplicator.
- A quote saved at 07:00 MYT prints, lists and floor-checks as the same calendar day.

**In scope.**
- Two editor fields plus a name-valued member select.
- `create` and `duplicate` stamping.
- The date encoding on new writes.
- Router tests and one web helper test.

**Out of scope.**
- A member-id foreign key for staff (D1 B).
- Backfilling legacy instants (D3 C).
- Converting the ledger's Quotation Staff filter to a picker (D9).
- Any change to `createdBy`, scope or numbering: `NCT-Q-YYYYMM` still comes from the save instant, not the chosen date (§7).
- Back-dating controls beyond the existing field policy and audit row (D4).
- The free-typed client pitfall from the step JSON, which belongs to steps 02 and 04.

**Context files read.**
- `scratchpad/steps/step-05.json` and `step-05-findings.json`, both fixes planned.
- House style from `plans/step-03-contact-nomination.md` and `plans/step-01-enquiry-channel.md`.
- The JSON's golden path and pitfalls are not otherwise implemented.

**Assumptions.**
- Staff stays a free-text name, chosen through a directory select that falls back to typing → D1
- A duplicate names the duplicator, with the same fallback chain `create` uses → D2
- `quotation_date` is written as a wall date (UTC midnight of the MYT day), with no backfill → D3
- Back-dating is allowed; it is already audited and already deniable per role → D4
- A duplicate is dated today's MYT business day → D5
- The fields go inside the brief disclosure, and the eight-pair brief line is unchanged → D6
- Date is required in the UI, and a blank staff box keeps the stored value → D7
- The server does not validate staff names against the directory → D8
- The ledger's Quotation Staff filter stays a text box → D9

## 2. User Journeys

**Journey 1 (changed): Sales raises a quotation on behalf of a salesperson, dated the day it is issued**
Trigger: Sales → Quotations → **Add**.
Steps:

1. The user sees **New Quote** with the brief open (`briefOpen` starts true for `new`).
2. Beside **Validity Start / Validity End**, the user sees **Quotation Date \*** pre-filled with today's Malaysian date, and **Quotation Staff** pre-filled with the signed-in member's name.
3. The user fills Business Type, Client and lane as in the SOP, unchanged.
4. The user opens **Quotation Staff** → a select lists the org's members by name → picks "Alice Tan". If the viewer lacks `member.read`, the control is a plain text box instead.
5. The user presses **Save Quote**. The server allocates `NCT-Q-YYYYMM-####` and stores the chosen date and staff, with toast _Quote NCT-Q-… created_ and the URL moving to the id (unchanged).
6. The flow ends when the ledger row shows the chosen date and "Alice Tan". **Export → EN** prints Quotation date = the chosen date and Staff = Alice Tan.

Where it lives: inline in the existing brief disclosure of `/quotations/$quotationId`.

Old journey, for contrast: steps 1, 3 and 5 are identical. There is no step 2 or step 4. The row is stamped with the save instant and the saver's name, and nothing on the page shows either.

**Journey 2 (new): Sales corrects the date or salesperson on a saved, undecided quotation**
Trigger: the customer is sent the quote days after it was drafted, or the wrong person was stamped.
Steps:

1. The user opens a draft or sent-but-undecided quote from the ledger. The brief is collapsed (unchanged).
2. The user presses **All 27 fields + 16 services** and sees Quotation Date showing the stored MYT day and Quotation Staff showing the stored name. A legacy name that is not in the directory still shows, marked _(not in directory)_.
3. The user changes the date to Thursday and picks Bob Lim, then presses **Save Quote**. The toast reads _Quote saved_ and the form re-baselines (existing `form.reset(saved)`).
4. If the new date moves a selling line under the tariff in force that day, the save is refused with the existing below-tariff message under the offending row. Nothing is written.
5. The flow ends when a reload shows both values persisted, the tariff hints are re-judged against Thursday, and the next Send emails a sheet dated Thursday naming Bob Lim.

Where it lives: inline in the existing brief disclosure.

A decided quotation still refuses every edit (`quotation.ts:3189`). The operator duplicates it, which is Journey 3.

**Journey 3 (changed): Salesperson B re-quotes A's decided quotation**
Trigger: B opens A's won or lost quote from the ledger → **Duplicate**.
Steps:

1. B presses **Duplicate**. The server copies the header and lines and allocates a new number (unchanged).
2. B lands on the copy. Status is Draft, and the send, decision and audit stamps are cleared (unchanged).
3. In the brief, Quotation Staff reads **B**, not A. Quotation Date reads **today's MYT date**.
4. The flow ends when B edits prices, saves, and sends. The sheet names B, and the ledger's Quotation Staff filter "B" finds the copy.

Where it lives: the existing Duplicate verb and the editor.

Old journey, for contrast: at step 3 the copy said A, for good, and filtering by B's name hid B's own work.

## 3. Result (What Changes for the User)

**Before:** The quotation date is the moment of the first save and the salesperson is whoever saved or whoever wrote the original. Neither is visible on the editor, and neither can be corrected. A duplicate keeps the original author's name.
**After:** Both sit in the quotation's full-field panel, pre-filled sensibly and editable until the quote is decided. A duplicate belongs to the person who made it. The date means the same calendar day on the sheet, in the ledger and to the tariff check.
**Key differences:**

- Sales: new **Quotation Date \*** and **Quotation Staff** fields beside Validity.
- Sales: **Duplicate** names you, not the original salesperson.
- Customer: the emailed sheet's 报价日期 and 业务员 are the ones Sales chose.
- Sales manager: the ledger's Date and Quotation Staff filters now find quotes by the day and the person they were issued under.

## 4. Technical Architecture

**Data flow.** The editor form carries `quotationDate` (`YYYY-MM-DD`) and `quotationStaff` (string) in the existing `onSubmit` payload. `quotations.create` / `quotations.update` validate them against the unchanged `quotationHeaderInput` and write them. The sheet, ledger, tariff check and convert read the same columns, and none of those readers change.

**No schema change.** `quotation_date timestamp DEFAULT now()` and `quotation_staff text` stay as they are (`packages/db/src/schema/quotation.ts:302-303`). No API input shape changes, because both keys are already accepted.

**Server: create (needed by Journey 1 step 5, §10 golden path step 6).**

```ts
// packages/api/src/routers/quotation.ts — create
// the date the floor check reads (:3022) and the date stored (:3067) are the SAME value
const quotationDate = header.quotationDate ?? businessDayStart(now); // D3: wall-date encoding
await assertNoLineBelowTariff(context.db, organizationId, header.clientCompanyId, quotationDate, feeLineRows);
// …baseHeader:
quotationDate,
quotationStaff: defaultQuotationStaff(context), // when header.quotationStaff is absent — see below
```

```ts
// one definition, used by create and duplicate (D2)
function defaultQuotationStaff(context: { session: { user: { name?: string | null } }; org: { membership: { id: string } } }) {
  return context.session.user.name?.trim() || context.org.membership.id;
}
// create:    quotationStaff: header.quotationStaff?.trim() || defaultQuotationStaff(context)
```

`businessDayStart` is already imported (`quotation.ts:87`). A caller that sends a date is unaffected: `z.coerce.date()` of `"2026-09-17"` is already UTC midnight, the wall-date encoding.

**Server: duplicate (needed by Journey 3 step 3).** In `baseHeader` (`:3450`), next to `createdBy: membership.id`:

```ts
quotationStaff: defaultQuotationStaff(context), // D2 — the duplicator, not `...source`
quotationDate: businessDayStart(now),           // D5 — was `now`; same MYT day, wall-date encoding
```

**Server: update.** No code change. The patch already writes `quotationDate` and `quotationStaff`, and the floor check already reads the patched date (`:3290`). The `refuseDeniedFields` guard (`:3136`) and the audit row's `before: existing, after: patch` (`:3326-3334`) cover a re-date or re-assignment with no new code.

**Web: date helper (needed by Journey 2 step 2).**

```ts
// apps/web/src/lib/quotation.ts — beside formatDateInput
import { businessDayStart } from "@nct-ai/api/quotation/tariff-check"; // precedent: company-deals.tsx:2
/** The MYT calendar day of a stored quotation date, as YYYY-MM-DD — the day the tariff check uses. */
export function businessDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "" : formatDateInput(businessDayStart(d));
}
```

Called with `new Date()` for a new quote. This gives the same result as `todayWallDate()` in MYT, but independently of the browser's zone, because the business day is MYT by owner decision (`tariff-check.ts:112-118`).

**Web: form wiring (Journeys 1–2).**
- **Schema.** `quoteFormSchema` gains `quotationDate: z.string().min(1, "Quotation date is required")` and `quotationStaff: z.string().optional()`.
- **`defaultValues`.**
  - `quotationDate: businessDateInput(loaded?.quotationDate ?? (isNew ? new Date() : undefined))`
  - `quotationStaff: loaded?.quotationStaff ?? (isNew ? (session?.user.name ?? "") : "")`
  - `session` comes from `authClient.useSession()` (precedent: `member-picker.tsx:50`). It is seeded through `defaultValues`, never through an effect (memory: refetch-overwrites-typed-input). A late-arriving session only lands while the form is untouched, and if the box is still blank at save, the server stamps the same name (D7).
- **Payload** (beside `validFrom` at `:1076`): `quotationDate: emptyToUndefined(value.quotationDate)` and `quotationStaff: emptyToUndefined(value.quotationStaff)`. Both are **always** sent when non-blank (D3 A). The string goes up as-is, never as a `Date` (precedent: `supersede-template-dialog.tsx:243-250`).
- **`loaded` type** (`:852`): picks both up through `QuoteFormValues`. The server returns a `Date | string`, and `businessDateInput` accepts both.

**Web: staff control (needed by Journey 1 step 4, Journey 2 step 2).** Add `MemberNameSelect` to `apps/web/src/components/member-picker.tsx`. It sits beside `MemberPicker` and does not modify it, because `MemberPicker`'s id and "All" contract has 27 importers.
- **Value.** The value is a member **name**. The options are `members.map(m => m.name)`, de-duplicated.
- **Legacy value.** If the current value is non-empty and not among the names, it is rendered as a first option labelled `"<value> (not in directory)"`, so a legacy or eyun-imported name never silently disappears on open.
- **Fallback.** When `isError` is true (no `member.read`) it renders a plain `<Input>` with the same value/onChange, which keeps the field editable rather than disabled, and D1 A holds either way.
- **No clear option.** Blanking is not offered, which matches patch semantics (memory: edit-forms-cannot-clear-a-field).

**Key decisions.**
- Staff stays text, chosen through a name-valued select → D1
- The duplicator becomes the staff → D2
- Wall-date encoding on every new write, no backfill → D3
- Back-dating allowed, relying on the existing field policy and audit → D4
- A duplicate is dated today → D5
- Placement in the brief disclosure → D6
- Required and blank rules → D7
- No server validation of names → D8
- Ledger filter untouched → D9

## 5. Phased Implementation

### Phase 1 — The server stamps the right person and a consistent day

**Delivers:** Journey 3 end-to-end (duplicate names the duplicator, dated today), plus the server half of Journeys 1–2. Journey 3 needs no editor change to be observable, because the ledger column and the sheet already show both values.
**Dependencies:** none. No pending migrations, and none added.

- **Task 1.1** — Add `defaultQuotationStaff(context)` (trimmed session name, falling back to `membership.id`) near `quotationScopeCols`. In `create`:
  - Compute `quotationDate = header.quotationDate ?? businessDayStart(now)` once, and pass it to both `assertNoLineBelowTariff` (`:3022`) and `baseHeader` (`:3067`).
  - Set `quotationStaff: header.quotationStaff?.trim() || defaultQuotationStaff(context)` (`:3069`). Keep the eyun comment and update it to say the value is a default the editor can override.
  - Files: `packages/api/src/routers/quotation.ts` · Owner: **Agent A (backend)**
- **Task 1.2** — In `duplicate`'s `baseHeader` (`:3450-3486`), add `quotationStaff: defaultQuotationStaff(context)` beside `createdBy`, and change `quotationDate: now` to `businessDayStart(now)`. Extend the block comment (`:3447-3449`) with one sentence explaining why staff is re-pointed, in the same "rides in on `...source`" voice as the 0065 stamp comment.
  - Files: `packages/api/src/routers/quotation.ts` · Owner: **Agent A (backend)**
- **Task 1.3** — Write the router tests, using the harness shape of `quotation.send-decide.test.ts` (PGlite, `ctx()`), with a named session user and a second member context. Cases:
  - (a) `create` without date/staff → `quotationDate` equals `businessDayStart(injected now)` and `quotationStaff` equals the session name.
  - (b) `create` with `quotationDate: "2026-09-17"` and `quotationStaff: "Alice Tan"` → both stored verbatim, the date as `2026-09-17T00:00:00Z`.
  - (c) `update` with `{ id, quotationDate: "2026-09-18", quotationStaff: "Bob Lim" }` → both patched, and the audit row's `after` carries both.
  - (d) `duplicate` of a row whose `quotationStaff` is `"Alice Tan"`, called as a member named `"Bob Lim"` → the copy reads `"Bob Lim"` and the source is unchanged.
  - (e) `update` re-dating to a day whose tariff makes an existing selling line below floor → `BAD_REQUEST`, nothing written.
  - (f) a session user with `name: null` → `create` stamps `membership.id` (pins today's fallback).
  - (g) `create` at 23:30Z → `quotationDate` is the *next* UTC date's midnight (the MYT day), and `sheet.ts`'s `dateOnly` of it equals the MYT day.
  - Files: `packages/api/src/routers/quotation.date-staff.test.ts` [NEW] · Owner: **Agent A (backend)**
- **Task 1.4** — Run the existing quotation suites unchanged: `quotation.apply-picks.test.ts` (its duplicate `ctx()` has no user name, so the copy now stamps `membership.id`, which no assertion there reads), `quotation.convert.test.ts`, `quotation.filters.test.ts`, `quotation.send-decide.test.ts`, `quotation.tariff-check.test.ts`, `modules/quotation/sheet.test.ts`. Fix only assertions that pin the old `now` instant or the copied staff, and name each one in the commit message.
  - Files: those tests, only if an assertion pins the old behaviour · Owner: **Agent A (backend)**

**Acceptance.** Salesperson B can duplicate A's quote and see B in the ledger's Quotation Staff column and on the exported sheet. Every router suite listed passes, confirmed by reading `bunx vp test run` output rather than its exit code (memory: vp-run-exit-code-lies).

### Phase 2 — The editor shows and edits both

**Delivers:** Journeys 1 and 2 end-to-end.
**Dependencies:** none on Phase 1 for compilation, because the input keys already exist. Journey 1 step 2's "today in MYT" only matches the server default once Task 1.1 ships (§7 coupling).

- **Task 2.1** — Add `businessDateInput()` to `apps/web/src/lib/quotation.ts`, importing `businessDayStart` from `@nct-ai/api/quotation/tariff-check`. Unit-test it:
  - `2026-09-14T23:30:00Z` → `"2026-09-15"`
  - `2026-09-15T00:00:00Z` → `"2026-09-15"`
  - `null` → `""`
  - an invalid string → `""`
  - once with `TZ=America/New_York` stubbed (precedent: `countdown.test.ts:325`), to prove it does not depend on the browser zone.
  - Files: `apps/web/src/lib/quotation.ts`, `apps/web/src/lib/quotation.test.ts` [NEW] · Owner: **Agent B (frontend)**
- **Task 2.2** — Add `MemberNameSelect` to `apps/web/src/components/member-picker.tsx`, with the value, options, legacy-option and `isError` text-box fallback described in §4. Do not touch `MemberPicker` or `MemberName`.
  - Files: `apps/web/src/components/member-picker.tsx` · Owner: **Agent B (frontend)**
- **Task 2.3** — Wire the editor:
  - Add the two keys to `quoteFormSchema`.
  - Seed them in `defaultValues` (read the session via `authClient.useSession()`).
  - Add them to the payload beside `validFrom`/`validTo`.
  - Render `<form.Field name="quotationDate">` (`type="date"`, label **Quotation Date \***, with the field error shown like the other required fields) and `<form.Field name="quotationStaff">` (label **Quotation Staff**, `MemberNameSelect`) immediately **before** the `validFrom` field (`:1891`), so the three dates sit together and staff sits beside them.
  - Leave the eight brief pairs (`:1583-1611`) untouched (D6).
  - Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx` · Owner: **Agent B (frontend)**
- **Task 2.4** — Browser-verify §10's Journey 1 and 2 walks on `:3101`, and file the evidence in the session's `chrome-test/`.
  - Files: none (evidence only) · Owner: **Agent C (verify)**

**Acceptance.**
- On a new quote the user sees both fields pre-filled, changes them, saves, reloads, and sees the chosen values in the editor, the ledger and the EN sheet.
- On a saved draft the user re-dates it and re-assigns staff.
- A blank date refuses with the brief opened and the message naming `quotationDate` (the existing `onSubmitInvalid`, `:1102`).
- `bun run check-types` output contains no "failed" (memory: vp-run-exit-code-lies).

## 6. Delegation & Parallelization Plan

**Phase 1 — The server stamps the right person and a consistent day**

| Agent             | subagent_type    | Model | Effort | Tasks   | Owns (write)                                                                                                                                   | Reads only                                                                                                   |
| ----------------- | ---------------- | ----- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Agent A (backend) | backend-engineer | opus  | high   | 1.1–1.4 | `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/quotation.date-staff.test.ts` [NEW], any existing quotation test that pins old behaviour (Task 1.4) | `packages/api/src/quotation/tariff-check.ts`, `packages/api/src/modules/quotation/sheet.ts`, `packages/db/src/schema/quotation.ts` |

opus: the change alters what two writers stamp on a customer-facing printed record and moves the date the price-floor check judges against, and `quotation.ts` is the file steps 04 and 06–10 also edit (§7).
Run mode: single agent.

**Phase 2 — The editor shows and edits both**

| Agent              | subagent_type     | Model  | Effort | Tasks   | Owns (write)                                                                                                                                  | Reads only                                                                         |
| ------------------ | ----------------- | ------ | ------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 2.1–2.3 | `apps/web/src/lib/quotation.ts`, `apps/web/src/lib/quotation.test.ts` [NEW], `apps/web/src/components/member-picker.tsx`, `apps/web/src/routes/_next/quotations/$quotationId.tsx` | `packages/api/src/routers/quotation.ts`, `apps/web/src/components/supersede-template-dialog.tsx` |
| Agent C (verify)   | test-engineer     | sonnet | medium | 2.4     | session `chrome-test/` evidence only                                                                                                          | everything above                                                                   |

Run mode: **A ∥ B → C**. Phase 1 and Phase 2's Agent B have disjoint file sets and can run together. Agent C waits for both, because the Journey 1 walk asserts the server default (Task 1.1) and the editor fields (Task 2.3).
Serialization points:
1. Type-check (`bun run check-types`, reading its output) after A and B.
2. The quotation router suites green.
3. Restart the API server before C: `bun --hot` does not reload `packages/api` edits (memory: bun-hot-ignores-workspace-deps).

Smell test:
- [x] every task has one owner
- [x] no file is owned twice in a phase
- [x] A and B are disjoint
- [x] the one `opus` is justified, and there is no `haiku`
- [x] C names its artifact (both agents' commits, served)
- [x] each phase completes a journey

## 7. Impact & Breakage Analysis

Callers were grepped this session (`quotationDate|quotationStaff` across `packages/`, `apps/`, `e2e/`).

- **`quotations.create` stored date.** Stored values change from an instant to UTC midnight of the MYT day.
  - Readers: `sheet.ts:341` (`dateOnly`) prints the MYT day. Before, it printed the UTC day, which was a day early for 00:00–08:00 MYT saves.
  - `businessDayStart` readers (`quotation.ts:1817,2322,2451,2470,3563`, `tariff-check.ts:324`) give the identical day, so the floor and hints are unchanged.
  - The ledger column (`-quotations.columns.tsx:145`, `toLocaleDateString`) shows the same day in a MYT browser.
  - Ledger `from/to` (`quotation.ts:2044-2045`) gets more correct: `to = "2026-09-15"` → `lte 15 Sep 00:00Z` now **includes** a wall-dated 15 Sep row, which an instant row excluded. Legacy instant rows keep the old off-by-a-day `to` behaviour until re-saved (D3).
  - `supersede-template-dialog.tsx:76`'s `dayAfter` → `gte(quotationDate, from)` still selects "dated strictly after" correctly for both encodings.
  - `e2e/specs/quotation.tariff-check.spec.ts` and `quotation.tariff-deal.spec.ts` read the date through the tariff check only, so they are unaffected by the same-day argument. Re-run them in Agent C's pass.
- **The editor always sends the date on update.** On a legacy instant row, the first save from the editor converts it to its MYT wall date. The floor judgement is unchanged (same business day). The printed date moves forward one day **only** for rows first saved between 00:00 and 08:00 MYT, which is a correction, but a re-exported sheet can then differ from one already emailed (Risk 1).
- **`quotations.duplicate` staff.**
  - `convertToOrder` (`:4007`) will now copy the duplicator into `operationPersonnel` on orders converted from duplicates. This is the intended fix and is pinned by `quotation.convert.test.ts:168` for non-duplicated quotes only.
  - Ledger `quotationStaff` filter semantics are unchanged.
  - `quotation.apply-picks.test.ts:804` calls duplicate with a nameless `ctx()` and asserts only line provenance.
- **Numbering is not re-dated.** `makeQuotationNo(seq, now)` (`:3086,3492`) keeps using the save instant. A quote back-dated to August that was saved in September is numbered `NCT-Q-202609-…`. This is intended: the number is a counter, not a date. It is stated in §10's edge case so nobody files it as a bug.
- **Return shapes.** No procedure's return shape changes. `retrieve` already returns both columns. The `loaded` cast (`$quotationId.tsx:852`) is an `as` over `QuoteFormValues` (memory: cast-switches-off-the-check-that-mattered). Agent B confirms by reading `quotations.retrieve`'s select that both keys are present rather than trusting the cast.
- **Nullable columns relied on.** Both columns are nullable. `businessDateInput(null)` → `""`, so the required-date validator makes a legacy null-date row refuse to save until a date is picked, with the brief opened and the field named. That is the right repair queue, but it is a new refusal (Risk 2).
- **Field policy.** A role denied `quotationDate` or `quotationStaff` now gets `FORBIDDEN: Not permitted to set quotation fields: …` on **every** save, because the editor always sends both. Before, the editor never sent them, so the denial was dormant (Risk 3, blocking prerequisite below).
- **Deployment coupling.**
  - Phase 2 alone works: the server accepts both keys today. The only mismatch is that a new quote saved without touching the date box stores the browser-computed MYT day while old server code would have used an instant for API callers.
  - Phase 1 alone works: no editor change is required.
  - Ship both in one deploy anyway, in the order web build → deploy (memory: alchemy-partial-deploy-splits-the-stage).
- **Overlap with sibling steps.**
  - `packages/api/src/routers/quotation.ts` (create `baseHeader` and duplicate `baseHeader`)
  - `apps/web/src/routes/_next/quotations/$quotationId.tsx` (quoteFormSchema, defaultValues, payload, brief disclosure)
  - `apps/web/src/lib/quotation.ts`
  - `apps/web/src/components/member-picker.tsx` if another step adds a picker

  These are the likely collision points with steps 04 (client pick) and 06–08 (fee lines, templates, tariff), and with 09–10 (send/decide, which reads the sheet). Commit one step at a time (memory: shared-worktree-commit-protocol, shared-index-sweeps-uncommitted-hunks).
- **Blocking prerequisites.**
  - (1) D1, D2 and D3 need Wilfred's call before Task 1.1.
  - (2) Before Phase 2 ships, check whether any org role policy denies `quotationDate` or `quotationStaff`: run a read-only query of the policy table behind `procedures/org.ts:131` on the production Neon branch. If one does, D7's payload rule must send the keys only when changed.

## 8. Cross-Cutting Concerns

- **Errors.** No new server error type.
  - A below-tariff refusal after a re-date reuses the existing row-level message (`$quotationId.tsx:927-943`).
  - A blank date is a client validation refusal that opens the brief (existing `onSubmitInvalid`).
  - A missing `member.read` falls back to a text box, never a disabled field.
- **Testing.**
  - API boundary: the new `quotation.date-staff.test.ts` (Task 1.3).
  - Helper: the new `quotation.test.ts` (Task 2.1).
  - Browser: §10.
  - The migrations test is not needed, because there is no migration.
- **Migration.** None. `0069` stays reserved and unused unless D3 → C.
- **Rollback.** Revert the commits. Rows written in the meantime keep wall-date values and chosen names. Every reader handles both encodings (§7), so nothing needs undoing.

**Performance & Scalability**

1. **Pagination.** N/A: no list endpoint changes. `org.members.list` is already fetched and cached for 5 minutes by `useMembers` (`member-picker.tsx:59-66`) on pages that show creators. The editor adds one consumer of the same cached query.
2. **SQL-side filtering.** N/A: no new filter. The ledger's date and staff predicates are unchanged SQL.
3. **N+1.** None. Create and duplicate do the same inserts. `defaultQuotationStaff` reads the session in memory.
4. **Index coverage.** N/A: no new WHERE or ORDER BY. The `quotation_date` range filter was already unindexed and is not made worse.
5. **Write atomicity.** Unchanged: create, update and duplicate already write header, children and audit in one transaction (`:3084,3139,3490`). The new values are part of the same `insert`/`update`.
6. **Row locking.** Update's read-then-write of `existing` (`:3140`), including the floor read of `existing.quotationDate`, is unchanged. A concurrent re-date and fee save race exactly as any two concurrent header edits already do. No new race is introduced.
7. **Resources.** No new connections or external calls.
8. **Tenant isolation.** Writes go through the existing scoped `update` and `duplicate` reads. `org.members.list` filters `member.organizationId = context.org.organizationId` (`org.ts:520`), so the select cannot offer another tenant's people.
9. **Payload.** Two scalars per save.
10. **Hot path.** The editor page. The members query is cached for 5 minutes with `retry: false`, so the extra load is one request per session per org.

## 9. Decision Register, Open Questions & Risks

### Settled 2026-09-15 — was blocking

**D1: How is Quotation Staff chosen and stored?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

|       | Approach                                                                                                   | Consequence                                                                                                                                                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Keep `quotation_staff` text; editor shows a directory select whose value is the member's **name**, legacy names kept as an extra option, text-box fallback without `member.read` | No migration; the sheet, ledger filter (`ilike`), convert → `operationPersonnel` and eyun-imported names all keep working. A renamed user leaves old quotes with the old name (the same as every `*_personnel` column today). |
| **B** | Add `quotation_staff_member_id` → `member.id` (migration `0069`), keep the text as the printed snapshot, filter by id | Survives renames and gives an exact "my quotes" filter. Costs a migration, a backfill that cannot resolve legacy free-text names, a new filter key, and a convert decision (orders store text). Diverges from every other personnel column. |
| **C** | Plain free-text input, like `order-form.tsx`'s personnel fields                                            | Cheapest and consistent with the order form. Typos split one salesperson across the ledger filter, and nothing defaults the right spelling.                                                                                                |

- **Recommendation: A.** Every personnel column in this app is text (`collective-order.ts:277-282`, `company.ts:104-110`, `quotation.ts:303`). A name-valued select fixes the spelling without migrating a column that the sheet and convert already read as text.
- **Conflict with the step JSON:** the JSON says "member picker". The only existing `MemberPicker` stores a member **id** and has an "All" filter option (`member-picker.tsx:111-137`), so it cannot be dropped in. A needs the new `MemberNameSelect`.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Tasks 1.1 and 2.2 (B would add a Phase 0 migration task and change both).
- **Where it lands:** §4 staff control; Tasks 1.1, 2.2, 2.3

**D2: Who is the staff on a duplicate?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

|       | Approach                                                                  | Consequence                                                                                                                                           |
| ----- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | The duplicator (session name, falling back to member id), the same rule as `create` | Journey 3 fixed; matches `createdBy: membership.id` beside it. A coordinator duplicating for a salesperson must re-pick in the editor, which D1 now allows. |
| **B** | Keep the source's staff (today)                                           | Right for "same salesperson, next month's price". Wrong for the re-quote path the app prescribes, and now at least correctable by D1.                   |
| **C** | Blank, so the editor forces a pick                                        | Never wrong silently. Adds a required field to the duplicate flow, and a copy saved via API has no staff on the sheet.                                   |

- **Recommendation: A.** `duplicate`'s own comment says "make the duplicator the creator" (`quotation.ts:3448-3449`). The decided-quote freeze sends people to duplicate (`:3191`), and whoever re-quotes owns the new offer.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Task 1.2.
- **Where it lands:** §4 duplicate; Tasks 1.2, 1.3(d)

**D3: What encoding does `quotation_date` carry, and what happens to legacy rows?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

|       | Approach                                                                                                                   | Consequence                                                                                                                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Wall date (UTC midnight of the MYT day) on every new write: create default `businessDayStart(now)`, duplicate likewise, editor always sends `YYYY-MM-DD`. No backfill | Sheet, ledger and tariff agree for every new or edited quote; same P0-20 encoding as `valid_from/valid_to`. Legacy rows convert on their next editor save, and for 00:00–08:00 MYT rows the printed date moves forward one day (a correction). |
| **B** | Keep instants; editor seeds from the MYT day and sends the date **only when the operator changed it**                      | Untouched saves never rewrite the stored instant. Needs per-field dirty tracking on a page where `isDirty` is re-baselined on save (a new trap surface). The sheet keeps printing the UTC day, so the 00–08 MYT disagreement persists. |
| **C** | A, plus migration `0069` backfilling `quotation_date = date_trunc('day', quotation_date + interval '8 hours')`               | Every row agrees immediately and the ledger `to` filter is uniform. Silently rewrites the printed date of already-emailed quotes; a data migration on a customer-facing value, with its own three gates.                                                        |

- **Recommendation: A.** The repo already settled day-granular quote dates in MYT (`tariff-check.ts:104-125`) and wall-date encoding (P0-20, `supersede-template-dialog.tsx:55-72`). A brings `quotation_date` into line without rewriting history nobody asked to touch.
- **Conflict with the step JSON:** the JSON's repair seeds with `loaded?.quotationDate` via `formatDateInput`, which is the **UTC** day. On a 00:00–08:00 MYT row the first save would store the previous day and move the floor check back a day. Phase 0 wins, and the plan seeds through `businessDateInput`.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Tasks 1.1, 2.1 and 2.3 (B changes the payload rule, C adds a migration task reserving `0069`).
- **Where it lands:** §4 create, duplicate, date helper, payload; §7 first two bullets

### Settled 2026-09-15 — was non-blocking

**D4: May a quotation be back-dated (or forward-dated) freely?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

|       | Approach                                                                                     | Consequence                                                                                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Allow any date. The existing audit row records before/after, and the existing field policy can deny `quotationDate` per role | Covers "entered late" from the JSON. Back-dating onto an older, cheaper tariff to pass the price floor is possible, but visible in `quotation.update` audit rows and deniable per role today.       |
| **B** | Refuse a date earlier than the created-at business day                                        | Closes floor evasion by back-dating. Also blocks the JSON's own "quote entered late" case, which is exactly a back-date.                                                                                   |
| **C** | Allow, but a new permission node gates changing the date away from its default                | Precise control. Adds an RBAC node, role-grant defaults and a UI gate, which is a bigger change than the defect.                                                                                            |

- **Recommendation: A.** Both motivating cases in the JSON need the date to move, and the per-field deny axis (`serialize.ts:233`) plus the audit trail already exist for exactly this. Revisit if the floor audit shows abuse.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No. A needs no code, and B or C can be added in a later phase.
- **Where it lands:** Task 1.3(e); Risk 4

### Assumed

**D5: What date does a duplicate carry?** · Status: Assumed

|       | Approach                          | Consequence                                                                                      |
| ----- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| **A** | Today's MYT business day          | Same behaviour as today in the new encoding; a new offer is dated when it is made.                |
| **B** | The source's date                 | Preserves a date that no longer describes the new offer, and the floor is judged on a stale tariff. |
| **C** | Blank, forcing a pick             | A draft with no date prints blank if exported before editing.                                     |

- **Recommendation: A.** `duplicate` already re-dates (`:3483`), and D3 only fixes its encoding.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Task 1.2

**D6: Where do the two fields live?** · Status: Assumed

|       | Approach                                                                  | Consequence                                                                                                                      |
| ----- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Inside the brief disclosure, immediately before Validity Start            | Where the JSON repair points. The three dates sit together, and it prints (the disclosure is `print:block`). Collapsed by default on saved quotes. |
| **B** | Also add "Date" and "Staff" to the eight-pair brief line                  | Visible without expanding, but breaks the design's "eight pairs, in its order" (`:1575-1576`).                                    |
| **C** | In the page header beside the quotation number                            | Most visible, but a new header layout on a page the sibling steps also edit.                                                      |

- **Recommendation: A.** It follows the existing disclosure pattern with no design change, and `onSubmitInvalid` already opens the brief when the date refuses.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Task 2.3

**D7: Required and blank rules on the editor.** · Status: Assumed

|       | Approach                                                                                        | Consequence                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **A** | Date required in the form. A blank staff box is sent absent, so the server keeps or stamps the default | Matches the sheet (a date always prints). A legacy null-date row must pick a date on its next save. Staff cannot be cleared. |
| **B** | Both optional; blanks absent                                                                    | No new refusal, but a new quote with the date box cleared silently takes today.                                    |
| **C** | Both required                                                                                   | Forces a staff pick even where the default was right, and refuses legacy rows with no staff.                      |

- **Recommendation: A.** A quote without a date is not printable as a quote, while staff has a sound server default.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No, subject to the §7 field-policy prerequisite.
- **Where it lands:** Task 2.3; Risk 2

**D8: Does the server validate staff against the member directory?** · Status: Assumed

|       | Approach                                        | Consequence                                                                                             |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **A** | No; any trimmed string                          | Legacy and eyun names re-save fine, and the API stays usable for imports. The UI select prevents typos for most users. |
| **B** | Refuse names not in `member` ∪ the row's stored value | Stricter, but one more query per save, and a user rename makes old quotes refuse on re-save.                      |
| **C** | Accept, but return a warning rider              | Informative, but needs a new response field and UI.                                                     |

- **Recommendation: A.** The column is text everywhere, and D1 A puts the guard where the typing happens.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Task 1.1

**D9: Does the ledger's Quotation Staff filter become a picker?** · Status: Assumed

|       | Approach                                   | Consequence                                                                                              |
| ----- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **A** | Leave it a substring text box              | No change; it finds legacy names and partial matches (pinned by `quotation.filters.test.ts:283-313`).    |
| **B** | Swap for `MemberNameSelect`                | Tidier, but loses substring search and legacy names not in the directory.                                |
| **C** | Add a "Mine" quick chip                    | Useful, but a new ledger feature outside both defects.                                                   |

- **Recommendation: A.** It is out of scope, and the fix makes the existing filter correct without changing it.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** none

**Risks.**

1. _A re-exported sheet shows a different date from the one already emailed_ (legacy 00:00–08:00 MYT rows, first editor save). Likelihood low (NCT works Malaysian office hours), impact low. **Mitigation: accept.** The new date is the correct MYT day, and the `quotation.update` audit row keeps the old instant in `before`.
2. _A legacy row with a null `quotation_date` refuses to save._ Likelihood low (the column defaults `now()`), impact low. **Mitigation:** the refusal opens the brief and names the field (existing `onSubmitInvalid`). No backfill.
3. _A role policy denying `quotationDate`/`quotationStaff` turns every save into a 403_, because the editor now always sends both. Impact high if present. **Mitigation:** run the §7 prerequisite query before Phase 2 ships. If any deny exists, Task 2.3 sends a key only when its value differs from the seeded one.
4. _Back-dating used to dodge the price floor._ Likelihood unknown, impact medium. **Mitigation:** D4 A relies on the audit trail plus field deny; Wilfred can pick B or C.
5. _A merge collision with steps 04 and 06–10 in `quotation.ts` and `$quotationId.tsx`._ Likelihood high, impact medium. **Mitigation:** Agent A and Agent B each land one commit, then re-grep `baseHeader` and `quoteFormSchema` after rebasing onto the siblings. The single-committer protocol applies.

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API on its usual port; restart it after Phase 1 (memory: bun-hot-ignores-workspace-deps).
**Preconditions:**
- An owner cookie in a seeded org (`e2e/fixtures/seed-cli.ts seed-parity <runId>`).
- In that org, two members named e.g. "Alice Tan" and "Bob Lim". Log in as Bob.
- One saved draft quotation created by Alice with staff "Alice Tan".
- One **won** quotation with staff "Alice Tan".
- One approved selling tariff whose price changes between two dates, with a draft quote priced at the later tariff (for the edge case).
- Nobody else switching the shared session's active org during the walk (memory: shared-session-active-org).

**Migrations:** none. Confirm the journal still ends `0065` (or at the siblings' `0066`/`0067`) and has nothing unapplied before testing.

**Golden path — Journey 1:**

1. Navigate to `/quotations` and press **Add** → **New Quote**, brief open.
2. Expect **Quotation Date \*** = today's MYT date and **Quotation Staff** = "Bob Lim", immediately before **Validity Start**.
3. Set Business Type, pick a Client, set Quotation Date to three days ahead, and open Quotation Staff → pick **Alice Tan**.
4. Press **Save Quote** → toast _Quote NCT-Q-… created_, URL becomes `/quotations/<id>`.
5. Reload, then expand **All 27 fields + 16 services** → Quotation Date shows the chosen day and Quotation Staff shows Alice Tan.
6. Go to `/quotations` → the new row's date column shows the chosen day and Quotation Staff shows Alice Tan. Filter Quotation Date From = To = the chosen day → the row is listed.
7. Back on the quote, **Export → EN / Excel** → the sheet's Quotation date cell = the chosen `YYYY-MM-DD` and Staff = Alice Tan.

**Golden path — Journey 2:**

1. Open Alice's saved draft, then expand the brief → Staff = Alice Tan, and Date = its MYT creation day.
2. Change the date to tomorrow, pick **Bob Lim**, and press **Save Quote** → toast _Quote saved_.
3. Reload → both values persisted. The fee grid's tariff hints still render (no "check failed" header line).

**Golden path — Journey 3:**

1. Open the won quotation → the header says it is decided. Press **Duplicate**.
2. On the copy, expand the brief → Quotation Staff = **Bob Lim** and Quotation Date = today's MYT date, while the status badge is Draft.
3. `/quotations` → filter Quotation Staff = "Bob" → the copy is listed and the original is not.

**Edge cases.**
- **Floor refusal.** On the tariff-priced draft, move Quotation Date back to a day whose tariff is higher and save → the save is refused with the below-tariff message under the offending row. Reload → the date is unchanged.
- **Blank date.** Clear Quotation Date and save → the brief opens and the toast names `quotationDate`, with nothing written.
- **Numbering.** Back-dating a new quote into last month still yields `NCT-Q-<this month>-…` (§7, intended).

**Regression check.**
- `bunx vp test run packages/api/src/routers/quotation` → every quotation suite green, read from output.
- `e2e/specs/quotation.tariff-check.spec.ts` and `quotation.tariff-deal.spec.ts` pass (the date encoding must not move a tariff day).
- Convert the Journey 3 copy to an order → the order's Operation Personnel reads Bob Lim.
- Open a quotation **without** touching the brief, change one fee line and save → tariff hints and the floor behave as before.

**Mobile:** at 400px the brief grid is `grid-cols-1`. Both new fields stack above Validity Start with no horizontal overflow, and the staff select opens within the viewport.

_2026-09-15: Wilfred chose the recommendation for every open decision in §9. The readiness points held back for pending decisions no longer apply._

**Readiness: 8/10.** Every line cited was re-read at `6bb3a1bf` and both writers and the editor wiring are fully specified. The missing points:
- D1–D3 are open and blocking, and D3 C would add migration `0069`.
- The §7 field-policy query on production has not been run.
- `quotation.ts` and `$quotationId.tsx` are shared with five sibling plans, so exact line numbers will drift before execution.
