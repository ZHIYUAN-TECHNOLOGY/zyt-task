# Step 07 — a tariff that disagrees with itself still holds the floor

**SOP step:** 07 "Save against the tariff floor" · `/quotations/$quotationId` → **Save Quote** · step defect **"An ambiguous tariff silently drops the floor"** (severity: money)
**Evidence read at:** JSON captured at `6c31a20e`; code re-read at HEAD `6bb3a1bf` (`feat/new-layout`), 2026-09-15
**Tier:** Standard (changes a money rule, a cross-tier contract string, and the approval engine's seam; no schema change under the recommendations)

---

## Phase 0 findings (read before the plan)

- **Stack** — oRPC routers in `packages/api/src/routers`, Drizzle schema in `packages/db/src/schema`, TanStack Router file routes under `apps/web/src/routes/_next`, zod both sides, vitest. The tariff rules are a **pure module**, `packages/api/src/quotation/tariff-check.ts`, with its DB half in `packages/api/src/routers/quotation.ts`. Precedent plan: `_plan/09-06_13-26_tariff-rate-cards/plan/plan.md` (A15 key, A16 ambiguity, §4.3 floor).
- **Where the floor is dropped: three places, not one line.**
  1. `pickCell` (`tariff-check.ts:233`): among cells for one key in one tier, latest `validFrom` wins. When the latest cells share a `validFrom` and `sameAmount` fails, it returns `{ ambiguous: true, cell: null }` (`:249`). A stated N/A next to a price at the same date is also ambiguous (pinned by `tariff-check.test.ts:400`).
  2. `resolveTariff` (`:314`) turns that into `status: "ambiguous", tariffAmount: null` (`:360–372`).
  3. `belowTariffRefusal` (`:474`) keeps only `status === "below_tariff"` (`:479`), and `assertNoLineBelowTariff` (`quotation.ts:1934`) throws only when that returns a message. So an ambiguous line is never refused. This is **deliberate and documented** (module header `:21–26`, "a price nobody can name is not a price you can be under"). The fix reverses a written owner-level design choice, so it goes to D1.
- **The unit-spelling pitfall does not work the way the JSON says.** `norm` (`tariff-check.ts:59`; web twin `apps/web/src/lib/quotation.ts:452`) only trims and lower-cases. "40HQ" vs "40hq " already match. **"40HQ" vs "40 HQ" do not.** The line then resolves to `none` ("not in tariff"), not to `ambiguous`. The effect is the same, no floor, but the screen gives a different and misleading reason: the banner says _"no approved tariff price for this quotation's date"_.
  - **A second unit trap sits inside one sheet.** `buildTemplateRows` (`quotation.ts:476`) refuses duplicate billing-unit columns by **exact string** (`:483–492`). A sheet can therefore hold columns `20GP` and `20gp`. Both key to the same `norm`, both carry the sheet's own `validFrom`, and `pickCell` reads them as ambiguous whenever their amounts differ. Two rows with the same cost name and destination in one sheet cause the same thing. Nothing refuses them.
  - `chargeUnit` on a quotation line is **free text with a datalist** (`$quotationId.tsx:2830`; `mergeChargeUnits` `:416` merges the org master `orgParam.chargeUnits` with global `referenceData.containerTypes`). Semicolon multi-values (`40PF;40RF`) are legitimate (`apps/web/src/charge-unit-vocabulary.test.ts`). The org master `charge_unit` (`packages/db/src/schema/org-param.ts:25`) is unique on `(organization_id, code)` and has no alias column.
- **"Nothing on screen" is also inexact.** The editor already shows a grey advisory banner `data-testid="tariff-floor-off"` (`$quotationId.tsx:2541–2600`), which names ambiguous lines (`:2580–2584`), plus a row hint _"two tariffs disagree"_ (`apps/web/src/components/tariff-hint.tsx:190`). What is silent is the **refusal**: the save goes through, and the banner is advisory by design (`:2530–2537`).
- **How ambiguity is born, in practice.** `feeTemplates.duplicate` copies `validFrom` and `validTo` verbatim (`quotation.ts:1169–1170`). The documented revision flow is Duplicate → edit → approve (tariff plan Journey 5), so it produces **exactly** the equal-`validFrom` collision unless the operator changes the date. `feeTemplates.supersede` (`:1274`) is the only way out, and it is manual.
- **Every road to `auditStatus = 'approved'`** (the only thing `loadTariffCells` `:1811` admits; `:1845`):
  1. The engine's final pass, `decide` (`packages/api/src/modules/audit/decide.ts:35`, repaint at `:158`). It is reached from `auditReview.decide` (`packages/api/src/routers/audit-review.ts:366`) and from the bulk loop (`:415`).
  2. The engine's auto-pass, when every stage skips (`packages/api/src/modules/audit/submit.ts:122`).
  3. The **legacy direct setter** `feeTemplates.review` (`quotation.ts:1321`). It moves `auditStatus` with no engine and no stamps, and both tariff e2e specs seed through it (`e2e/specs/quotation.tariff-check.spec.ts:6`, `quotation.tariff-deal.spec.ts:12`). **Step 04 is expected to close or guard this road.**
  4. Changes that make an **already-approved** sheet collide without re-approval:
     - `feeTemplates.update` re-opens approval only on a grid rewrite or a side flip (`:1074`). A header edit to `validFrom`, `validTo` or `clientCompanyId` keeps the approval (fingerprint doc `:697–704`).
     - `supersede` can move `validTo` later and re-open an overlap.
- **The engine seam.** `ReviewableResource` (`packages/api/src/modules/audit/resources.ts:64`) has `exists`, `repaintCache`, `amountOf`, and no pre-approval hook. `fee_template` is registered at `:162`.
- **The refusal wire format is parsed by the browser.** `OFFENDER = /^Line "(.+?)" is below tariff: (\S+) < (\S+)$/` (`tariff-hint.tsx:256`) is anchored at the end, so **any suffix on the server sentence orphans the refusal**. The server sentence is `belowTariffLineMessage` (`tariff-check.ts:457`).
- **The key is a two-implementation contract.** `lineKey` exists in `tariff-check.ts:88` and `apps/web/src/lib/quotation.ts:481`, pinned by identical fixture tables in `apps/web/src/lib/line-key.test.ts` (128 lines) and `packages/api/src/quotation/tariff-check.test.ts` (795 lines). Other consumers of the web key:
  - picker dimming: `apps/web/src/components/reference-template-picker.tsx:439`, `reference-template-dialog.tsx:121`
  - hint lookup: `$quotationId.tsx:497`, `:914`, `:2442`
  - `assignRefusals` (`tariff-hint.tsx:286`), which already collapses interior whitespace in its own label key.
  - (`apps/web/src/routes/_next/permissions.tsx:542` has an unrelated local `lineKey`.)
- **Other readers of the resolver:**
  - `quotations.list` tariff drift (`quotation.ts:2263–2322`, with `loadOrgTariffCells` `:1881`)
  - `quotations.tariffCheck` (`:2429`)
  - the floor on `create` (`:3018`) and `update` (`:3286`)
  - web: the row hint (`tariff-hint.tsx:126`, `:148`), the badge (`:207`), the banner coverage (`$quotationId.tsx:458–512`)
- **An adjacent floor bypass.** `quotations.update` builds `feeLineRows` only when `feeLines` is in the patch (`:3256`) and runs the floor only `if (feeLineRows)` (`:3285`). A header-only update that re-dates the quote or changes its customer is never judged against the tariff that will then govern it → D5.
- **Migration state.** The journal has 65 entries ending `0065_quotation_send_decision`, with 65 `.sql` files, contiguous. Steps 01 and 02 claim `0066`/`0067`. **Under the recommendations this plan adds no migration.** It reserves **`0071`** only if D1 resolves to C (override with a reason). Gates, per memory `migration-has-three-gates`: tags equal files, `idx` contiguous, PGlite replay (no extensions).

---

## 1. Overview

**Problem.** The owner rule is "a quoted price may be higher than the tariff, never lower". It fails open in two ways. When two approved sheets for the same customer tier start on the same day and disagree on a price, the resolver names no floor, and a quotation saves below **both** prices. When a quotation line spells its unit `40 HQ` and the tariff column says `40HQ`, the line matches nothing and saves at any price. In both cases the only signal is an advisory banner, which in the second case blames the wrong thing. The collision is not exotic: duplicating an approved sheet to revise it copies its start date.

**Goals.**

- A selling line whose tariff is contested is **still floored**, deterministically, and the refusal reads exactly as any other below-tariff refusal.
- Unit spellings that differ only by spacing resolve to the same tariff cell, on the server and in the browser, identically.
- A sheet that would create a contested price **cannot become approved**. The refusal names the other sheet and tells the operator what to change.

**Success criteria.**

- Sheets A (Haulage — Kolombong · 40HQ = 540) and B (same key = 600) share a `validFrom` and are both approved. A line at 550 is refused with `Line "… · 40HQ" is below tariff: 550 < 600`, and a line at 600 saves.
- A line with unit `40 HQ` against a `40HQ` column resolves to that cell (hint `= tariff` / `Tariff 540 …`).
- Submitting or approving sheet B while A is approved at the same `validFrom` with a different amount is refused with a CONFLICT naming A and the first conflicting charge.
- Existing `tariff-check.test.ts`, `routers/quotation.tariff-check.test.ts`, `line-key.test.ts` pass with the ambiguous cases rewritten to the new rule. No other test changes expectations.

**In scope.**

- The resolver's tie rule and the refusal
- Unit and name normalisation in both key implementations
- Duplicate-column and duplicate-row refusal inside a selling sheet
- A conflict check on every road to approval
- Hint, badge and banner wording
- A read-only data probe

**Out of scope.**

- Changing latest-`validFrom`-wins
- Auto-superseding a predecessor
- Canonicalising free-text units against the org master
- The legacy `feeTemplates.review` road itself (step 04)
- Deal-vs-standard tier rules
- Floors on export/submit/convert (locked by the tariff plan)

**Context files read.** `step-07.json`, `step-07-findings.json` (one finding, same defect). Every requirement in them is planned. The JSON's "or an explicit override with a reason" is carried as D1 option C and is not recommended.

**Assumptions.**

- Approved-only sheets feed the floor, and step 04 makes the server enforce how a sheet becomes approved → dependency, D8
- The tie rule applies inside a tier only. Deal ties never fall through to standard → D1
- `ambiguous` stays in the `TariffStatus` union but is no longer emitted. Contested lines report their comparison status plus a `contested` list → D6
- A `none` line whose name and destination match a cell on another unit gets a "tariff prices this per …" hint → D7
- Inside one selling sheet, duplicate columns or rows under the normalised key are refused at save → D9
- Existing contested data in production is left to the new tie rule and reported by a probe, not migrated → D4

## 2. User Journeys

**Journey 1 (changed): Sales saves a quote on a lane with two disagreeing approved tariffs**
Trigger: Sales presses **Save Quote** on `/quotations/$quotationId`.
Steps:

1. User sees the fee grid. On the contested line the Unit Price hint reads **"Tariff 600 (Standard) · 2 approved tariffs disagree — the higher applies"** in warning tone (today: _"two tariffs disagree"_ and no figure).
2. User types 550 and presses **Save Quote** → the mutation is refused; the toast is suppressed as for any below-tariff refusal.
3. Red text under that row: **Refused: 550 is below the tariff 600** (unchanged renderer, `$quotationId.tsx:2374`).
4. User raises it to 600 → **Save Quote** → toast **Quote saved**; the tariff check refetches; the hint reads `= tariff · 2 approved tariffs disagree`.
5. Flow ends: saved at or above the stricter price. The grey "floor is off" banner no longer lists this line, because it is enforced.

Where it lives: inline in the existing quotation editor. No new surface.

Old journey, for contrast: at step 2 the save succeeded at 550. The banner said "match two approved tariffs that disagree, so no single floor can be applied", and nothing stopped it.

**Journey 2 (changed): Sales types a unit with a space**
Trigger: Sales types `40 HQ` in the 计费单位 cell of a selling line whose tariff column is `40HQ`, and saves.
Steps:

1. Save → the server keys the line to the `40HQ` cell → below-floor prices are refused as in Journey 1 step 3. Otherwise the save succeeds.
2. After save, the hint reads `Tariff 540 (Standard) …` or `= tariff`. The stored unit text is left exactly as typed.
3. If the unit is genuinely different (`40HC`) → the hint reads **"not in tariff — the tariff prices this charge per 40HQ"**. The banner's no-cell sentence adds _"or the charge unit differs from the tariff's column"_.
4. Flow ends: the operator either fixes the unit (and the floor applies on the next save) or keeps a deliberately unpriced line.

Where it lives: inline, same grid.

**Journey 3 (new refusal): A revised tariff cannot be approved on top of its predecessor's start date**
Trigger: Pricing duplicates approved sheet "Tariff — Haulage", edits a price, and submits it for review (Fee Templates → template → Review → **Submit for review**). Or a branch manager approves it from the approvals queue.
Steps:

1. User presses **Submit for review** → the server finds approved sheet "Tariff — Haulage" in the same tier with the same **Valid from** and a different amount on at least one charge.
2. The submit is refused (CONFLICT). The toast reads **"Cannot publish: 'Tariff — Haulage' is already approved from 2026-10-01 and prices Haulage — Kolombong · 40HQ at 540 (this sheet: 600), plus 3 more charges. Set a later Valid from, or supersede 'Tariff — Haulage' first."**
3. User changes **Valid from** to the new effective date, saves, and submits again → it goes to review.
4. The reviewer approves → the same check re-runs inside `decide` (a race guard) → it passes → the sheet is approved.
5. Flow ends: two approved sheets with different start dates. Latest-wins resolves every lane with no ambiguity.

Where it lives: the existing fee-template record page and the approvals queue. No new surface, only a refusal message.

Variant: an approved sheet's header **Valid from / Valid to / Customer** is edited while post-approval editing is allowed, or `supersede` moves `validTo` later. The same check runs, and the same message refuses the save.

## 3. Result (What Changes for the User)

**Before:** Two approved tariffs that disagree, or a unit typed with a space, switch the price floor off for that line, and the quote saves below cost. The banner admits it only in the first case, and it blames the wrong cause in the second.
**After:** A contested line is held to the higher approved price. Spacing in a unit no longer breaks the match. A sheet that would create the contest cannot be approved in the first place.
**Key differences:**

- Sales: a contested line shows the figure it is held to, and saving below it is refused like any other below-tariff line.
- Sales: `40 HQ` and `40HQ` are the same unit for the tariff. A genuinely different unit gets a "the tariff prices this per …" hint.
- Pricing / branch manager: submitting or approving a sheet that clashes with an approved one on the same start date is refused, with the sheet and charge named.
- Pricing: a selling sheet with `20GP` and `20gp` columns, or two identical rows, is refused at save.

## 4. Technical Architecture

### 4.1 Tie rule (Journey 1 steps 1–4) → D1, D6

`packages/api/src/quotation/tariff-check.ts`:

```ts
/** One sheet's opinion when the latest-dated sheets in a tier disagree. */
export type TariffContender = { templateId: string; templateName: string; amount: string | null };

export type TariffCheckLine = {
  // …existing fields unchanged…
  /** Non-null exactly when ≥2 latest-dated cells in the answering tier disagree.
   *  Ordered by amount desc (N/A last), then templateId asc. */
  contested: TariffContender[] | null;
};

type Picked = { cell: TariffTemplateCell; contested: TariffContender[] | null } | null;
```

`pickCell` keeps "latest `validFrom` wins, NULL earliest". Among the winners:

- If every amount is the same (`sameAmount`) → return the first; `contested: null` (unchanged).
- Otherwise → **the strictest cell wins**: the highest non-null amount. Ties on amount break by `templateId` ascending, so the result never depends on row order from SQL. `contested` lists every winner.
- If every disagreeing winner is N/A this is unreachable, because N/A vs N/A is `sameAmount`. If some are N/A and some are priced, the priced maximum wins. A stated "not available" does not outrank an approved price.

`resolveTariff` then treats the picked cell exactly as today: `not_available` / `below_tariff` / `deal` / `above_tariff` / `match`, carrying `contested` through. **No line is emitted with `status: "ambiguous"` any more.** The union member stays so the web switch and stored hint code compile. `counts.ambiguous` keeps its name and now counts lines with `contested !== null` (D6), so the header badge and list drift column keep working unchanged.

`belowTariffRefusal` and `belowTariffLineMessage` are **unchanged**. A contested line below its floor is `below_tariff` and produces the exact sentence the web regex parses (Phase 0: suffixes break it).

The module header (`:21–26`) and the `supersede` doc (`quotation.ts:1239–1241`, "an ambiguous line carries no floor") are rewritten to state the new rule.

### 4.2 Key normalisation (Journey 2 steps 1–2) → D3

Both key implementations change identically:

```ts
/** name/destination: trim, case-fold, collapse interior whitespace runs to one space. */
export function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
/** 计费单位: norm, then drop ALL whitespace — "40 HQ" ≡ "40HQ", "40PF; 40RF" ≡ "40PF;40RF". */
export function normUnit(s: string | null | undefined): string {
  return norm(s).replace(/\s+/g, "");
}
export function lineKey(line) {
  return [norm(line.costName), norm(line.destination), normUnit(line.chargeUnit)].join(KEY_SEPARATOR);
}
```

- No hyphen, punctuation or unicode folding (D3). The existing "leaves unicode as it is" fixture stays.
- New fixtures go into **both** tables, verbatim:
  - `["40 HQ"] ≡ ["40HQ"]`
  - `["Haulage  Local"] ≡ ["Haulage Local"]`
  - `["NT-20FT"] ≠ ["NT20FT"]`
  - `["40PF; 40RF"] ≡ ["40PF;40RF"]`
- Stored text is never rewritten. Only the comparison key changes.

### 4.3 Near-miss unit hint (Journey 2 step 3) → D7

For a `none` line, `resolveTariff` looks for cells in the tier that would have answered (deal cells if the quotation has a client, else standard) whose name and destination key matches while the unit key differs. It sets `TariffCheckLine.tariffUnits: string[] | null` to their distinct raw `chargeUnit` values, capped at 3. This is computed from an index keyed by `norm(costName) norm(destination)`, built in the same loop that builds `dealCells`/`standardCells`, so there is no per-line scan. The web hint `none` case reads `not in tariff — the tariff prices this charge per ${units.join(" / ")}`.

### 4.4 Inside-a-sheet prevention (Journey 3 variant) → D9

`buildTemplateRows` (`quotation.ts:476`):

- The duplicate-column check compares `normUnit(u.unit)`, not `u.unit`. The message names both spellings: `Billing units "20GP" and "20gp" are the same 计费单位 — keep one column.`
- The `unitIdByName` lookup and `cellSeen` for prices are unchanged. They address the caller's own spelling, which is now guaranteed unique under normalisation.
- **Selling sheets only:** refuse two rows whose `norm(costName)` + `norm(destination)` are equal: `Rows 3 and 7 are both "Haulage — Kolombong" — a selling tariff prices each charge once.` Cost sheets are exempt, matching the zero-price exemption precedent at `:559–584`.

### 4.5 Cross-sheet conflict check (Journey 3 steps 1–4) → D2, D8

**Pure half** (`tariff-check.ts`, testable with no DB):

```ts
export type TariffConflict = {
  otherTemplateId: string; otherTemplateName: string; validFrom: Date | null;
  costName: string; destination: string | null; chargeUnit: string | null;
  thisAmount: string | null; otherAmount: string | null;
};
/** Cells of `candidate` that would make pickCell see a disagreement against `approved`. */
export function findTariffConflicts(args: {
  candidate: readonly TariffTemplateCell[];   // all cells of ONE sheet
  approved: readonly TariffTemplateCell[];    // other approved selling cells, same org
}): TariffConflict[];
```

A conflict requires all of:

- same tier owner (`clientCompanyId` equal, NULL = NULL)
- same `validFrom` business day (both NULL counts as equal)
- overlapping windows (`validTo` inclusive, NULL open)
- equal `lineKey`
- `!sameAmount`

Different `validFrom` is never a conflict: latest wins.

**DB half** (`quotation.ts`, beside `loadTariffCells`):

- `loadTemplateCells(tx, organizationId, templateId)` uses the same join as `loadOrgTariffCells` (`:1881`) narrowed to one `feeTemplate.id`, with no audit-status predicate.
- `assertNoTariffConflict(tx, organizationId, templateId)`:
  - returns early unless the sheet is `feeType = 'selling'`
  - loads its cells, plus approved selling cells of **other** templates in the org whose `validFrom` equals the candidate's (or both NULL) and whose `clientCompanyId` matches the candidate's (`or(eq, isNull)` done correctly, never `IN (x, NULL)`)
  - runs `findTariffConflicts`
  - throws `ORPCError("CONFLICT", { message })` in the Journey 3 wording, naming the first conflict and a count of the rest

**Where it is called — every road from Phase 0:**

| Road | Call site | When |
|---|---|---|
| Submit | `modules/audit/submit.ts`, after `exists` and before inserting the submission | always, for resources that declare the hook |
| Auto-pass | same function; covered by the submit call, since it runs first | — |
| Final approval | `modules/audit/decide.ts`, inside `outcome === "passed"` when `nextStageNo === null`, **before** the status update (`:150–162`) | race guard: another sheet may have been approved since submit. A throw rolls back the whole transaction, including the `audit_decision` insert, so the reviewer can reject instead |
| Legacy setter | `feeTemplates.review` (`quotation.ts:1321`) when `input.to === "approved"` | only if step 04 keeps this procedure (D8) |
| Header edit on an approved sheet | `feeTemplates.update` (`:941`), after the patch is applied, when `existing.auditStatus === "approved" && !reopened` and the patch touches `validFrom`, `validTo` or `clientCompanyId` | inside the same transaction |
| Supersede | `feeTemplates.supersede` (`:1274`), after the update | only when `input.validTo` is later than `existing.validTo` or `existing.validTo` was earlier-closed |

**Engine seam** (`modules/audit/resources.ts:64`): add an optional member, and register it on `fee_template` (`:162`):

```ts
/** Refuse a resource that must not reach `passed` in its current state. Runs at
 *  submit and again at the final pass. Absent = no rule. */
assertPublishable?(tx: DbTransaction, organizationId: string, resourceId: string): Promise<void>;
```

The registration calls `assertNoTariffConflict`, **imported from a new `packages/api/src/quotation/tariff-publish.ts` [NEW]**. `resources.ts` states "the engine never imports a resource router", so `assertNoTariffConflict` and `loadTemplateCells` live in that module, and `quotation.ts` imports them from there too. `packages/api/src/architecture.test.ts` must stay green (memory `two-architecture-tests`).

### 4.6 Web (Journeys 1–2)

- `apps/web/src/components/tariff-hint.tsx`:
  - `tariffHint` appends ` · ${n} approved tariffs disagree — the higher applies` when `check.contested` is non-null (for `match` / `above_tariff` / `below_tariff` / `deal`).
  - The `none` case uses `check.tariffUnits`.
  - The `ambiguous` case stays as an unreachable fallback.
  - `tariffBadgeText` label `ambiguous` → `contested`.
- `apps/web/src/routes/_next/quotations/$quotationId.tsx`:
  - `tariffFloorCoverage` (`:473`) already counts `tariffAmount !== null` as enforced, so contested lines drop out of `floorGaps` automatically. The `ambiguous` bucket and its banner sentence (`:2580–2584`) are removed.
  - The `noCell` sentence gains "or the charge unit is spelt differently from the tariff's column".
  - `TariffCheckLine` is inferred from the oRPC contract; confirm by grep in Task 1.3.
- `apps/web/src/lib/quotation.ts`: `norm`/`normUnit`/`lineKey` per 4.2.

### Key decisions

- Strictest price wins a tie, rather than refusing the save or overriding with a reason → D1
- Refuse publication of a clash at submit and final pass, rather than warning or auto-closing → D2
- Whitespace-only unit folding, rather than punctuation folding or master snapping → D3
- Keep `ambiguous` in the union and the counts key; add `contested` → D6
- Optional engine hook in a new neutral module, rather than inline in the fee router only → D8

## 5. Phased Implementation

### Phase 1 — A contested line is floored (Journey 1)

**Dependencies:** D1 settled (blocking). No migration. Not dependent on step 04: it works on whatever `loadTariffCells` admits.

- **1.1** Rewrite `pickCell` to the strictest-wins rule with deterministic tie-breaks. Add `contested` to `TariffCheckLine` and carry it through every `lines.push` in `resolveTariff`. Stop emitting `ambiguous`. `counts.ambiguous` counts contested lines. Rewrite the header doc `:4–36` and the `pickCell` doc `:216–232`. Files: `packages/api/src/quotation/tariff-check.ts` · **Agent A (backend)**
- **1.2** Rewrite the ambiguous tests to the new rule:
  - `tariff-check.test.ts:230–242` (deal contested → deal max, no fall-through)
  - `:376–418` (equal validFrom → max; NULL/NULL → max; N/A beside price → the price; agreeing sheets → `contested: null`)
  - `:684–706` (counts)
  - `:774–792` (a contested line below max **is** refused, and the sentence matches the web `OFFENDER` regex verbatim)
  - determinism: shuffle the candidate order and get the same `templateId`.

  In `routers/quotation.tariff-check.test.ts:334–380`, two approved same-date sheets resolve to the max with `contested.length === 2`. New case: `quotations.update` at a price between the two amounts → BAD_REQUEST naming the line. Files: `packages/api/src/quotation/tariff-check.test.ts`, `packages/api/src/routers/quotation.tariff-check.test.ts` · **Agent A (backend)**
- **1.3** Fix the stale doc sentences in `quotation.ts`: the `supersede` doc `:1239–1241` and the `assertNoLineBelowTariff` doc `:1928`. Comments only, no logic. Files: `packages/api/src/routers/quotation.ts` · **Agent A (backend)**
- **1.4** Web wording:
  - `tariffHint` contested suffix; badge label `contested`
  - remove the banner's ambiguous bucket and sentence
  - grep `apps/web/src` and `e2e/` for `"two tariffs disagree"`, `"ambiguous"`, `tariff-floor-off` and update every assertion found

  Files: `apps/web/src/components/tariff-hint.tsx`, `apps/web/src/routes/_next/quotations/$quotationId.tsx`, plus any `e2e/specs/*.spec.ts` the grep names · **Agent B (frontend)**
- **1.5** _(only if D5 → A)_ In `quotations.update`, when `feeLines` is absent and the patch changes `clientCompanyId` or `quotationDate`, load the stored selling lines and run `assertNoLineBelowTariff` against the post-patch client and date. Add a router test for it. Files: `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/quotation.tariff-check.test.ts` · **Agent A (backend)**

**Acceptance.** User can open a quote on a lane with two same-date approved sheets (540 / 600), be refused at 550 with the red row text, and save at 600. The banner no longer lists that line. All three test files pass, with `bun run check-types` output read and not its exit code (memory `vp-run-exit-code-lies`).

### Phase 2 — Unit spelling and in-sheet duplicates (Journey 2)

**Dependencies:** D3 settled (blocking: it fixes the contract table). Phase 1 merged, because both edit `tariff-check.ts` and its test.

- **2.1** Add `normUnit`, collapse whitespace in `norm`, key on `normUnit(chargeUnit)`. Append the four fixtures from §4.2 to the shared table in `tariff-check.test.ts` **first**. The table is the artifact Agent B copies. Files: `packages/api/src/quotation/tariff-check.ts`, `packages/api/src/quotation/tariff-check.test.ts` · **Agent A (backend)**
- **2.2** Add the near-miss index and `tariffUnits` on `none` lines (D7), with tests: a `40HC` line against a `40HQ` cell gives `tariffUnits: ["40HQ"]`, and a different destination gives `null`. Files: same as 2.1 · **Agent A (backend)**
- **2.3** In `buildTemplateRows`, check duplicate columns under `normUnit`, and refuse duplicate rows on selling sheets (D9). Add tests to the existing fee-template router suite; locate it with `grep -rln "buildTemplateRows\|Duplicate billing unit" packages/api/src`. Files: `packages/api/src/routers/quotation.ts` + that test file · **Agent A (backend)**
- **2.4** Web twin: `norm`/`normUnit`/`lineKey` in `apps/web/src/lib/quotation.ts`, and the same four fixtures copied verbatim into `apps/web/src/lib/line-key.test.ts`. The `none` hint uses `tariffUnits`, and the banner `noCell` sentence gains the unit clause. Files: `apps/web/src/lib/quotation.ts`, `apps/web/src/lib/line-key.test.ts`, `apps/web/src/components/tariff-hint.tsx`, `apps/web/src/routes/_next/quotations/$quotationId.tsx` · **Agent B (frontend)**

**Acceptance.** User types `40 HQ` against a `40HQ` tariff, saves below the floor and is refused, then saves at the floor and sees `= tariff`. A pricing user saving a selling sheet with `20GP` and `20gp` columns gets a named refusal. `line-key.test.ts` and `tariff-check.test.ts` carry byte-identical fixture rows (diff them).

### Phase 3 — A clash cannot be published (Journey 3)

**Dependencies:**

- **Step 04 merged, or its final shape agreed** (D8, blocking Task 3.3). This phase edits `submit.ts`, `decide.ts` and `resources.ts`, which step 04 is expected to edit, and its handling of `feeTemplates.review` decides whether Task 3.4 exists.
- Phase 1 merged (the conflict definition reuses `sameAmount`/`businessDayStart`).

Tasks:

- **3.1** `findTariffConflicts` (pure) in `tariff-check.ts`, with tests:
  - same date, different amount → conflict
  - same amount → none
  - different date → none
  - different client → none
  - deal vs standard → none
  - NULL/NULL dates → conflict
  - non-overlapping windows → none
  - N/A vs price → conflict

  Files: `packages/api/src/quotation/tariff-check.ts`, `packages/api/src/quotation/tariff-check.test.ts` · **Agent A (backend)**
- **3.2** Create `packages/api/src/quotation/tariff-publish.ts` [NEW] with `loadTemplateCells` + `assertNoTariffConflict`, and `tariff-publish.test.ts` [NEW] against the router test DB harness used by `routers/quotation.tariff-check.test.ts`. The tests are org-scoped: another org's clashing sheet never conflicts. Files: both [NEW] · **Agent A (backend)**
- **3.3** Add the optional `assertPublishable` to `ReviewableResource`, register it on `fee_template`, and call it in `submitForReview` (before the insert) and in `decide` (final pass, before the status update). Tests: submit refused; decide refused after a racing approval; bulk decide rolls the whole batch back. **Decide explicitly whether the bulk path should skip-and-report instead**; D2's recommendation keeps the transaction all-or-nothing, as today. Files: `packages/api/src/modules/audit/resources.ts`, `packages/api/src/modules/audit/submit.ts`, `packages/api/src/modules/audit/decide.ts`, their existing tests (`gates.test.ts`/`quorum.test.ts` neighbours; add `publishable.test.ts` [NEW] in `packages/api/src/modules/audit/`) · **Agent A (backend)**
- **3.4** Call `assertNoTariffConflict` in `feeTemplates.update` (approved, not reopened, header window/client touched), in `feeTemplates.supersede` (validTo moved later), and in `feeTemplates.review` when `to === "approved"` (**skip if step 04 removed the procedure**). Files: `packages/api/src/routers/quotation.ts` · **Agent A (backend)**
- **3.5** Web check: confirm the fee-template record page's `<ReviewMenu>` (`apps/web/src/routes/_next/fee-templates/$templateId.tsx:639`) and the approvals queue surface a CONFLICT `message` as a toast verbatim. If either swallows it into a generic "Failed", show `error.message`. Files: `apps/web/src/routes/_next/fee-templates/$templateId.tsx` and the `ReviewMenu` component (`grep -rn "export function ReviewMenu" apps/web/src`) · **Agent B (frontend)**
- **3.6** Update the two tariff e2e specs' seeding so a second same-date sheet is **not** needed any more. Where a spec seeded a deliberate clash to show "ambiguous", seed it with the Phase 3 check bypassed through direct SQL fixtures in the spec's fixture helper, or drop that scenario in favour of the unit test. Files: `e2e/specs/quotation.tariff-check.spec.ts`, `e2e/specs/quotation.tariff-deal.spec.ts` · **Agent B (frontend)**

**Acceptance.** A pricing user duplicates an approved sheet, edits one price, and submits: refused with the named sheet and charge. After changing Valid from and resubmitting, a branch manager approves it successfully. `packages/api/src/architecture.test.ts` is green.

## 6. Delegation & Parallelization Plan

**Phase 1 — A contested line is floored**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1, 1.2, 1.3, 1.5 | `packages/api/src/quotation/tariff-check.ts`, `packages/api/src/quotation/tariff-check.test.ts`, `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/quotation.tariff-check.test.ts` | `apps/web/src/components/tariff-hint.tsx` (the `OFFENDER` regex) |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.4 | `apps/web/src/components/tariff-hint.tsx`, `apps/web/src/routes/_next/quotations/$quotationId.tsx`, e2e specs named by the grep | `packages/api/src/quotation/tariff-check.ts` |

opus for A: it changes a money rule on the save path and a type every tariff reader consumes.
Run mode: **A → B**. B waits on the `TariffCheckLine.contested` field in `tariff-check.ts`.

**Phase 2 — Unit spelling and in-sheet duplicates**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 2.1, 2.2, 2.3 | `packages/api/src/quotation/tariff-check.ts`, `packages/api/src/quotation/tariff-check.test.ts`, `packages/api/src/routers/quotation.ts`, fee-template router test | — |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 2.4 | `apps/web/src/lib/quotation.ts`, `apps/web/src/lib/line-key.test.ts`, `apps/web/src/components/tariff-hint.tsx`, `apps/web/src/routes/_next/quotations/$quotationId.tsx` | `packages/api/src/quotation/tariff-check.test.ts` (fixture table) |

opus for A: it changes a contract string two implementations must agree on.
Run mode: **A → B**. B waits on the appended fixture rows in `tariff-check.test.ts`.

**Phase 3 — A clash cannot be published**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | xhigh | 3.1–3.4 | `packages/api/src/quotation/tariff-check.ts`, `tariff-check.test.ts`, `packages/api/src/quotation/tariff-publish.ts` [NEW], `tariff-publish.test.ts` [NEW], `packages/api/src/modules/audit/resources.ts`, `submit.ts`, `decide.ts`, `publishable.test.ts` [NEW], `packages/api/src/routers/quotation.ts` | `packages/api/src/architecture.test.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 3.5, 3.6 | `apps/web/src/routes/_next/fee-templates/$templateId.tsx`, the `ReviewMenu` component file, `e2e/specs/quotation.tariff-check.spec.ts`, `e2e/specs/quotation.tariff-deal.spec.ts` | `packages/api/src/modules/audit/decide.ts` |

opus/xhigh for A: it edits the shared approval engine used by six resource types, inside a transaction.
Run mode: **A ∥ B**. The file sets are disjoint, and B only reads the CONFLICT message shape, fixed in §4.5.

**Serialization points:**

1. After each phase, run `bun run check-types` (grep the output for "failed") plus the three tariff test files.
2. Before Phase 3, rebase onto step 04's merged engine changes.
3. After Phase 3, run `bunx vp test run packages/api/src/architecture.test.ts`.
4. Restart the API server before any browser check (memory `bun-hot-ignores-workspace-deps`).

**Smell test:**

- [x] every task has one owner
- [x] no file is owned twice in a phase
- [x] the parallel group in Phase 3 is disjoint
- [x] every opus is justified; no haiku
- [x] sequential waits name their artifact
- [x] every phase completes a journey

## 7. Impact & Breakage Analysis

**Callers traced by grep this session.**

- **`TariffCheckLine` shape (additive `contested`, `tariffUnits`)** — consumers:
  - `quotations.tariffCheck` (`quotation.ts:2429`)
  - `quotations.list` drift (`:2263–2322`, reads `.counts` only)
  - `assertNoLineBelowTariff` (`:1934`)
  - web: `tariff-hint.tsx` (`liveTariffStatus :126`, `tariffHint :148`), `$quotationId.tsx` (`tariffFloorCoverage :473`, hint lookups `:914`, `:2442`)

  All are additive except the removed banner bucket. No caller destructures a closed object.
- **No `ambiguous` emission** — readers that branch on it:
  - `tariff-hint.tsx:190` (falls back, now unreachable)
  - `$quotationId.tsx:507` (bucket removed in 1.4)
  - both e2e specs (updated in 1.4 / 3.6)
- **`counts.ambiguous` semantics** move from "unfloored disagreement" to "floored disagreement". The list page's drift cell (`quotations.list`) renders it through the badge text, whose label changes to `contested`.
- **`lineKey`/`norm` change** — consumers:
  - server: resolver, the near-miss index
  - web: picker dimming (`reference-template-picker.tsx:439`, `reference-template-dialog.tsx:121`), hint lookup (`$quotationId.tsx:497`, `:914`, `:2442`), `assignRefusals` (`tariff-hint.tsx:286`; its own `labelKey` already collapses whitespace, so no drift)

  `tariffGridFingerprint` (`quotation.ts:715`) uses raw unit strings and is deliberately untouched. Respelling a column on an approved sheet still re-opens approval, which is the conservative direction.
- **Behaviour change on live quotations (intended; notify owners).** Two kinds of open draft/sent quote become refusable on their next save:
  - quotes with a contested lane priced between the two amounts
  - quotes with a whitespace-variant unit priced below its now-matched cell

  The list drift column will show them as `below tariff` immediately. Size it with the probe in §8 before release.
- **`buildTemplateRows` new refusals** — callers: `feeTemplates.create`, `.update` (`:1011`), `.duplicate`. A legacy sheet already holding case-variant columns or duplicate rows **cannot be re-saved** until it is cleaned. The probe finds them first.
- **Engine hook** — `REVIEWABLE_RESOURCES` has 9 keys (quotation, fee_template, company ×3, contract, collective_order, bill/cost_line, lading). The hook is optional, so eight are untouched. The `decide` throw rolls back the bulk loop in `audit-review.ts:415` for the whole batch.
- **Nullable fields relied on** — `fee_template.valid_from`/`valid_to` and `client_company_id` are nullable. NULL `validFrom` equals NULL for conflict purposes (matching `pickCell`). `template_fee_line.destination` is nullable, and `norm` maps NULL to `""`.
- **Deployment coupling.**
  - Phase 1: server and web must deploy together. An old web against a new server shows lines that are contested and refused with a stale "two tariffs disagree" hint. That is harmless but confusing, and never unsafe.
  - Phase 2: the key contract **must** deploy together, otherwise the picker dims the wrong rows (the documented silent failure). Memory `alchemy-partial-deploy-splits-the-stage`: build `apps/web` first.
  - Phase 3 is server-only, apart from optional message surfacing.
- **Blocking prerequisites.**
  - D1 before Task 1.1
  - D3 before Task 2.1
  - D2 and step 04's shape (D8) before Task 3.3
  - the §8 probe run on production (`br-round-sun`, read-only) before release, not before coding

## 8. Cross-Cutting Concerns

- **Errors.**
  - Below-floor: BAD_REQUEST with the unchanged sentence.
  - Publish clash: CONFLICT, one sentence, first conflict plus "and N more".
  - In-sheet duplicates: BAD_REQUEST, named.
  - No new failure on read paths; `tariffCheck` never throws for contested data.
- **Testing.**
  - Pure: `tariff-check.test.ts` (tie rule, key fixtures, conflicts).
  - DB boundary: `routers/quotation.tariff-check.test.ts`, `tariff-publish.test.ts`, `modules/audit/publishable.test.ts`.
  - Contract: identical fixture rows in `line-key.test.ts`.
  - Browser: §10.
- **Migration.** None under the recommendations. `0071` is reserved for D1 = C only.
- **Rollback.** Revert per phase, since no data is written.
  - Phase 1 revert → ambiguity drops the floor again.
  - Phase 2 revert must ship web and server together.
  - Phase 3 revert only removes refusals.
- **Read-only production probe (describe, do not run now).** Against the default Neon branch, with a read-only role:

  ```sql
  -- contested keys among approved selling sheets, per org/tier/start day
  with cells as (
    select ft.organization_id, ft.client_company_id, ft.valid_from, ft.valid_to, ft.id tpl, ft.name,
           lower(regexp_replace(trim(tfl.cost_name), '\s+', ' ', 'g')) cn,
           lower(regexp_replace(trim(coalesce(tfl.destination,'')), '\s+', ' ', 'g')) dst,
           lower(regexp_replace(coalesce(tbu.unit,''), '\s+', '', 'g')) unit,
           tflp.amount
    from template_fee_line_price tflp
    join template_fee_line tfl on tfl.id = tflp.template_fee_line_id
    join template_billing_unit tbu on tbu.id = tflp.template_billing_unit_id
    join fee_template ft on ft.id = tfl.fee_template_id
    where ft.fee_type = 'selling' and ft.audit_status = 'approved')
  select organization_id, client_company_id, valid_from, cn, dst, unit,
         count(distinct coalesce(amount::text,'n/a')) amounts, array_agg(distinct name) sheets
  from cells group by 1,2,3,4,5,6 having count(distinct coalesce(amount::text,'n/a')) > 1;
  ```

  Two companion probes:
  - `select fee_template_id, lower(regexp_replace(unit,'\s+','','g')) u, count(*) from template_billing_unit group by 1,2 having count(*) > 1` (case/space-variant columns)
  - open draft/sent `quotation_fee_line` selling rows whose `charge_unit` contains whitespace

  Record the counts in the release note.

**Performance & Scalability**

1. **Pagination** — N/A. No list endpoint is added. `quotations.list` stays paged, and `tariffUnits` is capped at 3 per line.
2. **SQL-side filtering** — the conflict load filters org, `fee_type`, `audit_status`, `valid_from` equality and the client predicate in SQL. Amount comparison and key matching run in TS over one sheet's cells plus same-date cells, which is a small set (six seeded sheets today).
3. **N+1** — none.
   - `assertNoTariffConflict` runs two queries.
   - The bulk-decide loop calls it once per fee-template resource in the batch, which is the same per-item shape `decide` already has. Acceptable for an operator batch; noted.
   - The near-miss index is built once per `resolveTariff` call, with no per-line scan.
4. **Index coverage** — the conflict query predicates on `fee_template (organization_id, fee_type, audit_status, valid_from)`. Task 3.2 must check the `fee_template` table's indexes in `packages/db/src/schema/quotation.ts`. At current volume (tens of sheets per org), no new index is needed. If `EXPLAIN` shows a seq scan past ~1k sheets, add `(organization_id, audit_status, valid_from)`, which needs a migration and therefore a new decision.
5. **Write atomicity** — every call runs inside the existing transaction of `submitForReview`, `decide`, `feeTemplates.update` and `supersede`. The refusal rolls back the decision row and the header patch together.
6. **Row locking** — two approvals of two clashing sheets can race: both `decide` transactions read "no other approved sheet" before either commits. **Mitigation:** in `assertNoTariffConflict`, take `pg_advisory_xact_lock(hashtext('tariff-publish:' || organization_id))` at the start. That serialises tariff publication per org, is cheap, and needs no extension. Raw `.execute()` must be added to `ALLOWED_EXECUTE_SITES` in `packages/api/src/architecture.test.ts` with a comment ("lock only").
7. **Connections** — none new.
8. **Tenant isolation** — both loads filter `fee_template.organization_id = organizationId` in SQL. The candidate's cells load by id **and** org. The test covers a foreign org's clashing sheet.
9. **Payload** — `contested` is at most the number of same-date sheets (typically 2). `tariffUnits` is at most 3.
10. **Hot path** — `tariffCheck` runs on every editor load and save. The added work is O(cells) in memory, with no query change. Conflict checks run only on publish verbs.

## 9. Decision Register, Open Questions & Risks

### Settled 2026-09-15 — was blocking

**D1: What floor does a line get when the latest approved sheets in its tier disagree?** · Status: **Settled — B chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Refuse the save while any line is ambiguous ("fix the tariff first") | Safest on money, but Sales is blocked by a data problem only Pricing can fix, on every quote touching that lane, until someone supersedes a sheet. |
| **B** | Strictest wins: the higher approved price is the floor; the hint names both sheets | Never below any price a reviewer approved, deterministic, no migration, and Sales can still quote at or above it. It can over-floor a lane where the lower sheet was the intended revision (fixed by superseding). |
| **C** | Refuse unless the operator records an override reason per line (new `quotation_fee_line.floor_override_reason`, migration **0071**, audited) | Matches the JSON's "explicit override" wording and keeps the operator moving. Adds schema, a dialog, a second enforcement concept, and a bypass that becomes routine. |

- **Recommendation: B** — the owner rule is "never lower than the set price", and when two set prices exist the only reading that cannot be under either is the higher one. Phase 3 makes the state rare enough that an override (C) would be machinery for an edge case.
- **Chosen:** B (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Task 1.1.
- **Where it lands:** §4.1; Tasks 1.1, 1.2, 1.4. C adds a Phase 1b with migration 0071.

**D2: What happens when a sheet would create a same-date clash on approval?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Refuse at submit and again at the final pass (CONFLICT, named sheet and charge) | The clash never reaches the floor, and the reviewer never sees an unapprovable sheet. The Duplicate → approve revision flow now requires changing Valid from, which is the correct behaviour but one more step. |
| **B** | Allow approval; show the reviewer a warning in the queue | No workflow change. D1 keeps money safe, but the contest persists silently on every quote on those lanes. |
| **C** | On approval, auto-close the predecessor (`validTo = candidate.validFrom − 1 day`) | One click. Impossible when the dates are equal (the window would close before it opens), so it would also have to move the candidate's `validFrom`: an edit nobody asked for, on an approved record. |

- **Recommendation: A** — the collision is born at Duplicate, where `validFrom` is copied (`quotation.ts:1169`). Refusing at publication, with the fix named, is the smallest rule that removes the cause. `supersede` already exists for the retire half.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Task 3.3.
- **Where it lands:** §4.5; Tasks 3.1–3.4.

**D3: How far does charge-unit normalisation go?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Whitespace only: units drop all whitespace; names and destinations collapse runs | Fixes `40HQ`/`40 HQ` and double-spaced names, cannot merge two genuinely different codes, and changes both contract tables by four rows. |
| **B** | Also ignore punctuation (`NT-20FT` ≡ `NT20FT`, `40'HQ` ≡ `40HQ`) | Catches more typos. Risks merging codes that differ only by a hyphen in some tenant's master, and must be re-implemented character-for-character in the browser. |
| **C** | Snap free text to the org `charge_unit` master code at write time (quotation lines and template columns) | One canonical spelling everywhere. Semicolon multi-values and global container types have no master row, and it needs an alias model (schema) to cover `40 HQ`. |

- **Recommendation: A** — it covers the pitfall as filed with the least risk of a false match. The near-miss hint (D7) makes the remaining spellings visible instead of silent.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Task 2.1.
- **Where it lands:** §4.2; Tasks 2.1, 2.4.

### Settled 2026-09-15 — was non-blocking

**D4: What happens to clashes and variant columns already in production?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Leave them. D1 floors them; run the §8 probe and hand the list to Pricing to supersede or clean | No data migration. Quotes on those lanes become strictly floored on release. |
| **B** | Data migration that closes the older-created of each clashing pair | Automatic, but it guesses which sheet is current — the exact guess A16 refused to make — inside a migration. |
| **C** | Revoke approval of every clashing sheet (back to draft) | Forces a human decision, and removes both floors on those lanes until re-approved: the opposite of the goal. |

- **Recommendation: A** — the probe turns an unknown into a named list, and nothing is rewritten on a guess.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No. Decide before release.
- **Where it lands:** §8 probe; release note.

**D5: Close the header-only update bypass in this step?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Yes. When `feeLines` is absent but `clientCompanyId`/`quotationDate` changes, judge the stored lines (Task 1.5) | Closes a real floor bypass on the same function, at about 20 lines plus one test. |
| **B** | Hand it to step 06, whose plan owns quote-header edits | Keeps this plan to the filed defect; the bypass stays open until step 06 ships. |
| **C** | Leave it; the editor always posts `feeLines` | No work. The API remains bypassable by any other caller (import, script, a future dialog). |

- **Recommendation: A** — it is the same guard in the same handler (`quotation.ts:3285`), and D1 changes which floors exist, so testing both together is cheaper.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No. It can be added to Phase 1 or dropped.
- **Where it lands:** Task 1.5.

### Conflicts between the step JSON and the code (Phase 0 wins)

**D10: The JSON's claims vs HEAD** · Status: Assumed (plan follows the code)

| | JSON claims | Code at HEAD | Plan follows |
|---|---|---|---|
| **A** | "the refusal skips it … with nothing on screen refusing it" | The refusal skips it (`tariff-check.ts:479`), but a grey banner (`$quotationId.tsx:2580`) and a row hint (`tariff-hint.tsx:190`) do say so, advisory only | Code. The defect is "not enforced", not "not shown". |
| **B** | Unit spellings "miss the tariff cell in the same way" (as ambiguity) | `40 HQ` resolves to `none`, not `ambiguous`; case/edge whitespace already match; only interior whitespace misses. Case-variant **columns inside one sheet** do create ambiguity (`quotation.ts:483–492`) | Code. Both mechanisms are fixed (Phase 2). |
| **C** | Defect source `tariff-check.ts:457` | `:457` is the message builder. The drop happens at `pickCell :249` → `resolveTariff :360–372` → filter `:479` | Code. Cited lines are current. |

- **Recommendation: C (follow code)** — the golden-path line numbers moved as well: save toast `$quotationId.tsx:723`, banner `:2567`.
- **Blocking?** No.

### Assumed

**D6: How is a contested line represented to readers?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Keep `ambiguous` in the union (never emitted); status is the comparison; add `contested[]`; `counts.ambiguous` counts contested | Additive. No web type breakage; badge/list keep their key. |
| **B** | Remove `ambiguous` and rename the count to `contested` | Cleaner types. Touches every switch and the list payload in the same deploy. |
| **C** | Keep `status: "ambiguous"` and put the floor in `tariffAmount` | One field. `liveTariffStatus` would then treat it as a normal floor and the label would vanish under typing; `belowTariffRefusal` needs a second status. |

- **Recommendation: A** — the smallest contract change that keeps the refusal on a single status.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4.1, Task 1.1.

**D7: Tell the operator which unit the tariff uses when a line misses?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | `tariffUnits` on `none` lines; hint "tariff prices this per 40HQ" | Turns the remaining spelling misses from silent into one-glance fixes. One index, no query. |
| **B** | Banner sentence only ("or the unit is spelt differently") | Cheaper; the operator still has to find which unit. |
| **C** | Cut it | Whitespace folding only; other variants stay silent. |

- **Recommendation: A** — the filed pitfall is a spelling miss; normalisation fixes one class, and this makes the rest visible.
- **Chosen:** A (assumed; the user can cut Task 2.2)
- **Blocking?** No.
- **Where it lands:** §4.3, Tasks 2.2, 2.4.

**D8: Where does the publish check hook in, given step 04?** · Status: Assumed — **dependency on step 04**

| | Approach | Consequence |
|---|---|---|
| **A** | Optional `assertPublishable` on `ReviewableResource`, called by `submit`/`decide`; logic in neutral `quotation/tariff-publish.ts` | Covers every engine road including bulk and auto-pass, and respects "engine never imports a router". Shares three files with step 04. |
| **B** | Inline in the fee-template router only (`update`, `supersede`, `review`) | No engine edit, but misses `decide` and auto-pass: the main road. |
| **C** | A Postgres trigger on `fee_template.audit_status` | Catches every writer. Business logic in SQL, a migration (0071), and PGlite replay must support it. |

- **Recommendation: A** — the engine is the only path step 04 is expected to leave for approval, so the rule must live there. Agree with step 04 that it owns `submit.ts`/`decide.ts` first and this phase rebases.
- **Chosen:** A (assumed)
- **Blocking?** Yes for Task 3.3, on step 04's merge (not on a user answer).
- **Where it lands:** §4.5, Tasks 3.2–3.4.

**D9: Refuse duplicates inside one selling sheet?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Refuse case/space-variant columns (all sheets) and duplicate name+destination rows (selling only) at save | Removes the in-sheet source of ambiguity. A legacy sheet with such data cannot be re-saved until cleaned. |
| **B** | Refuse columns only | Rows can still duplicate a charge with different prices. |
| **C** | Allow; rely on D1's strictest-wins | No friction, and the sheet can still contradict itself. |

- **Recommendation: A** — matches the existing exact-duplicate refusal (`quotation.ts:483`) and the cost-sheet exemption precedent (`:559–584`). The §8 probe sizes the legacy impact.
- **Chosen:** A (assumed)
- **Blocking?** No.
- **Where it lands:** §4.4, Task 2.3.

### Risks

- _Release makes some open quotes unsaveable at their current prices_ → medium likelihood, medium impact → **run the §8 probe and list the affected quotations in the release note; the list drift column names them on day one.**
- _Web and server key implementations drift_ → low likelihood, high (silent) impact → **byte-identical fixture rows in both tests; deploy Phase 2 as one release, web built first.**
- _Two clashing approvals race_ → low likelihood, medium impact → **per-org advisory transaction lock in `assertNoTariffConflict` (§8 item 6).**
- _Step 04 changes `submit.ts`/`decide.ts` concurrently_ → high likelihood, medium impact → **Phase 3 starts only after step 04 merges; the hook is optional, so it rebases cleanly.**
- _e2e specs seed through the legacy `feeTemplates.review`, which step 04 may remove_ → high likelihood, low impact → **Task 3.6 re-seeds through the engine or fixtures.**

## 10. Verification & Proof

**App URL:** http://localhost:3101 (API :3000; restart the server after `packages/api` edits)

**Preconditions:**

- A seeded owner org: `bun --env-file=apps/server/.env --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed-parity <runId>`
- In it, two **approved** selling fee templates with no client and the same Valid from:
  - A "Tariff — Haulage": Haulage Local — Kolombong · `40HQ` = 540
  - B "Tariff — Haulage (Copy)": same key = 600

  Seed B before Phase 3 lands, or via a fixture insert, because Phase 3 will refuse B.
- A draft quotation (no customer) dated inside the window, with that selling line.

**Migrations:** none (confirm the journal still ends at the last merged sibling migration; nothing from this step).

**Golden path — Journey 1:**

1. Navigate to `/quotations/<id>` → fee grid loads. The line's hint reads **Tariff 600 (Standard) · 2 approved tariffs disagree — the higher applies**.
2. Set Unit Price to 550 → press **Save Quote** → red text under the row: **Refused: 550 is below the tariff 600**. No "Quote saved" toast.
3. Set Unit Price to 600 → **Save Quote** → toast **Quote saved**. The hint reads **= tariff · 2 approved tariffs disagree — the higher applies**.
4. The grey `tariff-floor-off` banner does not list this line.

**Golden path — Journey 2:**

1. Change the line's 计费单位 to `40 HQ`, set price 500 → **Save Quote** → **Refused: 500 is below the tariff 600**.
2. Change the unit to `40HC`, price 500 → **Save Quote** → **Quote saved**. The hint reads **not in tariff — the tariff prices this charge per 40HQ**.

**Golden path — Journey 3:**

1. Navigate to `/fee-templates`, open A → **Duplicate** → edit Haulage 40HQ to 650 → Save.
2. **Review → Submit for review** → toast names **'Tariff — Haulage'**, **Haulage Local — Kolombong · 40HQ**, 540 vs 650, and "Set a later Valid from".
3. Set Valid from one day later → Save → **Submit for review** → it submits (status Pending).
4. As a branch manager, approve it in the approvals queue → status Approved.

**Edge cases:**

- A **customer deal** sheet for company X dated the same day as standard sheet A, at 380 → submit succeeds (a different tier is not a clash). A quotation for company X at 400 saves (`= deal`). One at 370 is refused against 380, with no fall-through to 600.
- A selling template with columns `20GP` and `20gp` → Save → refused with the named duplicate.

**Regression check:**

- A quotation on an **uncontested** lane: above-tariff still saves with the amber delta; below is refused with the same sentence as before.
- The picker in **Reference Template** still dims rows already on the quote, including one whose unit was typed `40 HQ`.
- `/quotations` list drift column renders for open quotes.
- Approving a **bill** or **order** in the approvals queue is unaffected (the hook is absent there).

**Mobile:** at 400px the longer hint text wraps inside the Unit Price cell without horizontal page scroll. The CONFLICT toast is readable.

_2026-09-15: Wilfred chose the recommendation for every open decision in §9. The readiness points held back for pending decisions no longer apply._

**Readiness: 7/10** — every seam, line and caller was re-read at HEAD. Held back:

- three owner calls (D1–D3) that change the money rule and the contract
- Phase 3's dependence on step 04's unmerged engine edits
- a production probe nobody has run, so the size of the "suddenly refused" set is unknown
