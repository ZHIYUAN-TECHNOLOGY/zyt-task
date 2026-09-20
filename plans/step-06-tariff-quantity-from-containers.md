# Step 06 — applied tariff lines take their quantity from the container mix

**SOP step:** 06 "Price it" · `/quotations/$quotationId` → Containers, Batches and Fee Details cards · step fix **"Applied tariff lines ignore the container mix"** (severity: money)
**Evidence read at:** `6bb3a1bf` (HEAD of `feat/new-layout`, 2026-09-15). The step guide was captured at `6c31a20e`, two commits earlier. Every `file:line` below was re-located at HEAD.
**Tier:** Standard. It changes what `quotations.applyTemplate` writes (money on a multi-tenant write path) and needs three or more files. There is no schema change under the recommended options.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers live in `packages/api/src/routers` and pure domain helpers in `packages/api/src/quotation/*.ts`. The web app imports those helpers through the `"./*"` export of `packages/api/package.json`; `money.ts` is the precedent. Drizzle schema is in `packages/db/src/schema`. TanStack Router file routes are under `apps/web/src/routes/_next`, with TanStack Form, zod and vitest.
- **The defect is accurate, and quantity 1 is a documented decision, not an oversight.** `applyTemplate` (`packages/api/src/routers/quotation.ts:3519`) says at `:3659-3662`: _"`quantity` stays 1 for the same reason: deriving it from the quotation's container count is a rule eyun has never been observed to apply. The amount lands on `unitPrice`, where the operator multiplies it by the quantity they actually booked."_ The line builder at `:3756-3797` calls `computeFeeLineAmounts({ unitPrice, minCharge, exchangeRate })` without a quantity, so `money.ts:75` defaults it to `"1"`. The client path does the same in `toDraftLine` (`apps/web/src/components/reference-template-dialog.tsx:175-205`; the JSON's `:190` still points at `quantity: amounts.quantity`). **So this plan overturns a documented rule, and says why:** the repo already holds a written rule for it. See the next bullet.
- **The precedent rule exists, and nothing uses it yet.** `charge_unit.is_box_type` (`packages/db/src/schema/org-param.ts:40`, migration 0027) is commented _"HGJ 'Is a box type unit': box units (20GP, 40HQ) multiply by container counts of that type; non-box units (CBM, per BL) multiply by cargo quantities. Wave 1 stores the flag; consumers interpret it."_ `docs/prd/dynamic-params.md:92` says the same. Nothing reads the flag today.
- **The two vocabularies do not meet by string equality. This is the real design problem.**
  - A quotation container row stores `container_type` as free text (`packages/db/src/schema/quotation.ts:400-411`). The Containers card (`$quotationId.tsx:2120-2196`) offers `referenceData.containerTypes` codes, which are **lower-case slugs** (`40hq`, `20gp`, `40ft-trailer`, `20t`, `lcl`, `truck`: 126 rows from migration 0032). It falls back to the upper-case `CONTAINER_TYPES` tuple (`apps/web/src/lib/quotation.ts:63`), and `emptyContainer()` (`:349`) seeds `"20GP"`.
  - A template billing unit is free text (`template_billing_unit.unit`, `schema/quotation.ts:176-196`). **NCT's own tariff does not use equipment codes.** `seed/tariff-data.ts:68-81` declares `NT-20FT`, `NT-40FT`, `SL-20FT`, `SL-40FT`, `20FT`, `40FT`, `SET`, `SHIPMENT`, `BL`, `PERSON`, `PERSON-HR` and `CBM`, and the six sheets use exactly those. None of those codes is flagged `isBoxType` (`seed/tariff.ts:94-97` never sends it).
  - Result: a strict `unit === containerType` rule would match nothing on NCT's real tariff. `40FT` has to match `40hq` + `40gp` + `40HQ` by **size**, and `SET` / `SHIPMENT` / `BL` / `PERSON` / `CBM` have no container equivalent.
- **Default ticks already select cells that the container mix rules out.** `defaultTickedKeys` (`apps/web/src/components/reference-template-picker.tsx:141-149`) ticks every priced cell of a template that has no destinations and at most 12 cells. The Custom Clearance sheet (5 cells) therefore arrives with both **Custom Examination Fee 20FT** and **40FT** ticked, even on a 3×40HQ booking.
- **The picker assumes duplicate charges are sometimes one line per container.** The `existingKeys` prop comment (`reference-template-picker.tsx:237-240`) says: _"a repeated charge is sometimes right (two containers, two haulage lines)"_. Quantity N on one line is the alternative, logged as D3.
- **Save-first guard.** On a saved quotation the dialog's **Next** is disabled while the form is dirty (`$quotationId.tsx:2456-2458`, `disabledReason`). So when `applyTemplate` runs, the stored `quotation_container` rows **are** the rows on screen. The server path can read containers from the DB. The unsaved (new-quote) path must be handed the form's containers.
- **Step 7 floor check: no interaction.** `resolveTariff` / `belowTariffRefusal` (`packages/api/src/quotation/tariff-check.ts:314`, `:474`) compare `unitPrice` against the cell amount, keyed by `lineKey(costName, destination, chargeUnit)` (`:88`; web mirror `apps/web/src/lib/quotation.ts:481`). Quantity is never read. As long as `chargeUnit` stays the template's unit, seeding quantity cannot move a line's tariff status.
- **Min-charge floor.** `computeFeeLineAmounts` applies `qty > 0 ? max(qty × price, minCharge) : 0` (`money.ts:62-85`), and the editor's `recalcLine` (`$quotationId.tsx:1191-1206`) does the same on every edit. A seeded quantity above 1 can only lift a line off its floor. Quantity 0 zeroes the line.
- **Conversion (step 11+, not planned here).** `mapFeeLineToCostLine` (`packages/api/src/modules/expense/bridge.ts:17`) deliberately does not carry `chargeUnit` / `quantity` / `unitPrice`. It carries `totalPrice`. So **the corrected money reaches the order**, as one gross amount (3 × 250 = 750), and the known SOP defect loses only the breakdown. This step makes that defect _more visible_ (a 750 row with no "3 ×"). It does not make it worse in money.
- **Tests that pin quantity 1.**
  - `quotation.rate-card.test.ts:305` and `:369` belong to the no-picks describe block, which the handler calls "the regression oracle … untouched". `apply-picks.test.ts:311`/`:547` seed hand-inserted lines.
  - `unpivot-template-lines.test.ts:122` calls `computeFeeLineAmounts({ unitPrice })` with no quantity.
  - The server fixtures (`q-1`) insert **no** `quotation_container` rows: grep count 0 in `apply-picks.test.ts`, and none in `rate-card.test.ts`. A rule of "no containers → quantity 1" keeps every existing assertion green.
- **Touch surface.**
  - `packages/api/src/quotation/container-quantity.ts` [NEW] and its `.test.ts` [NEW].
  - `packages/api/src/routers/quotation.ts` (`applyTemplate` `:3519-3842`) and a new `quotation.apply-quantity.test.ts` [NEW].
  - `apps/web/src/components/reference-template-dialog.tsx`, `apps/web/src/components/reference-template-picker.tsx` (`defaultTickedKeys`) and `apps/web/src/components/reference-template-picker.test.ts`.
  - `apps/web/src/routes/_next/quotations/$quotationId.tsx` (dialog props `:2415-2500`; Fee Details notice).
- **Migration state.** Journal has 65 entries ending `0065_quotation_send_decision`, and there are 65 `.sql` files. Steps 01/02 have claimed 0066/0067 but not landed them. **This plan adds no migration under its recommendations.** If D5-C is chosen, it takes **0070** and must land after 0066–0069 so the chain stays contiguous.
- **Sessions.** `_plan/09-06_13-26_tariff-rate-cards` is the active session that built the picker and applyTemplate's 0060 behaviour. This work extends it, but that session's plan is executed, so this is a new session (see Assumptions).

---

## 1. Overview

**Problem.** A salesperson fills **Containers** with 3×40HQ, opens **Reference Template**, ticks the Forwarding sheet's 40FT cells and presses **Apply**. Every applied line lands at **Qty 1**, so the quote reads RM 200 for an Operational Cost Recovery Surcharge that is really RM 600. Nothing on screen says the quantity was not derived. The operator must remember to retype every line. If they forget, the customer is quoted a third of the charge, and that under-quote rides `totalPrice` all the way to the order and the bill.

**Goal.** An applied template line whose billing unit is a container unit takes its quantity from the quotation's container mix. Lines whose unit has no container meaning keep quantity 1. When the mix changes later, the grid says so and offers a one-press correction. It never rewrites quantities silently.

**Success criteria.**

- 3×40HQ + Forwarding sheet, ticking `40FT` cells → each applied line has **Qty 3** and **Total = 3 × unit price** (or the floor, whichever is higher). The server path and the unsaved client path give identical rows.
- 2×20GP + 1×40HQ + Custom Clearance sheet → the picker arrives with **Custom Examination Fee 20FT and 40FT** ticked. Applied, they land at Qty 2 and Qty 1. `EDI` (SET) and `Custom Documentation` (SHIPMENT) land at Qty 1.
- 1×40HQ only + Custom Clearance sheet → **20FT is not pre-ticked**. If the operator ticks it anyway, it lands at Qty 1 with a "no 20FT containers on this quote" hint.
- A quotation with no container rows applies exactly as today (Qty 1 everywhere). Every existing test stays green unmodified.
- Change 3×40HQ to 5×40HQ and save → Fee Details shows _"2 template lines don't match Containers"_ with **Match Qty to containers**. Pressing it sets Qty 5 and recomputes totals. **Save Quote** stores it.
- Step 7's below-tariff refusal and the header tariff badge are unchanged for every line.

**In scope.** A pure unit→container matching function. Seeding quantity on both apply paths. Container-aware default ticks. The mismatch notice and the correction action. Tests.
**Out of scope.**
- Seeding CBM/kg units from `totalVolumeCbm` / gross weight (→ D4).
- Seeding PERSON / PERSON-HR / SET.
- Conversion dropping quantity/unit price (SOP step 11+).
- Setting `isBoxType` on NCT's charge units (→ D1-C).
- The cost side (cost-template lines follow the same rule; nothing extra is built for them).
- Batches: the batch card carries addresses, not container counts.

**Assumptions.**

- A new `_plan/` session, not an addition to `09-06_13-26_tariff-rate-cards`. That session is executed, and this reverses one of its stated rules → D8.
- The step guide's `:190` cite and its "template never reads your container mix" are accurate at HEAD. The guide omits the documented reason the handler gives; that conflict is recorded → D9.
- Units match containers by exact code first, then by size class → D1.
- A quotation with no container rows keeps quantity 1 on every line → D2.
- One line with quantity N, not N lines at quantity 1 → D3.
- Non-container units stay at 1 → D4.
- Nothing is persisted about where a quantity came from; mismatch is derived → D5.
- Default ticks skip container cells the mix rules out → D6.
- A changed mix is surfaced, never auto-applied → D7.

## 2. User Journeys

**Journey 1 (changed): Sales prices a saved FCL quotation from the tariff**
Trigger: Sales → Quotations → open a saved quotation with 3×40HQ in **Containers**.
Steps:

1. User sees the **Containers** card (`$quotationId.tsx:2113`) → one row, **Container Type** `40hq`, **Qty** `3` (unchanged).
2. User presses **Reference Template** in **Fee Details** → the **Apply a Fee Template** dialog opens on step 1 (unchanged). The description line now reads _"… Quantities follow this quote's Containers (3×40HQ); you can still edit them afterwards."_
3. User picks **Tariff — Forwarding**, **Apply lines as** = Selling Price, presses **Next** → the picker opens. Because the sheet has no destinations and ≤12 cells, it pre-ticks the **40FT** and non-container cells (BL, SHIPMENT). It leaves **20FT** unticked because the quote has no 20-foot container. Each ticked container cell shows a small `×3` beside its amount.
4. User presses **Apply** → the server writes the lines (toast _Template lines applied_, unchanged). The grid refreshes: **Operational Cost Recovery Surcharge · 40FT · Qty 3 · 200 · Total 600**; **Forwarding Fee · 40FT · Qty 3**; BL / SHIPMENT lines · Qty 1.
5. User reads the footer **Estimated Profit** → it reflects the ×3 charges without retyping.
6. Flow ends: the guide's "Retype Qty on every applied line" step is gone.
   Where it lives: inline, in the existing dialog and fee grid.

Old journey, for contrast: steps 1–3 were the same, except step 3 pre-ticked **20FT** as well. At step 4 every line landed at Qty 1 (and an unwanted 20FT line appeared). Step 5 read a third of the real receivable until the operator retyped each Qty and deleted the 20FT line.

**Journey 2 (changed): Sales prices a NEW, unsaved quotation**
Trigger: Sales → Quotations → **Add**. Fill Containers with 2×20GP + 1×40HQ, without saving.
Steps:

1. User presses **Reference Template** → the dialog opens. It is not blocked, because an unsaved quote takes the client path (unchanged).
2. Picks **Tariff — Custom Clearance** → **Next** → EDI (SET), EDI Subsequent Set (SET), Custom Documentation (SHIPMENT), Custom Examination 20FT (`×2`) and 40FT (`×1`) arrive ticked.
3. Presses **Apply** → lines append to the form (toast unchanged): exam 20FT Qty 2 = 300, exam 40FT Qty 1 = 250, the rest Qty 1.
4. Presses **Save Quote** → stored as shown.
5. Flow ends: identical rows to what the server path would have written for the same containers.
   Where it lives: the same dialog; the client half of the apply.

**Journey 3 (new): The container mix changes after lines were applied**
Trigger: The customer adds two more boxes. Sales edits **Containers** 3×40HQ → 5×40HQ.
Steps:

1. User changes **Qty** to 5 → immediately, above the Fee Details grid, an inline notice appears: _"2 template lines don't match Containers (5×40HQ). Operational Cost Recovery Surcharge · 40FT is Qty 3, Containers say 5; Forwarding Fee · 40FT is Qty 3, Containers say 5."_ It has a **Match Qty to containers** button.
2. User presses **Match Qty to containers** → those rows' **Qty** becomes 5. **Total**, **Local Amt.** and **Taxes** recompute through the same `recalcLine` a typed edit uses. The notice disappears.
3. User presses **Save Quote** → toast _Quote saved_ (unchanged save).
4. Flow ends: quantities match the booking. A line the operator _deliberately_ kept at another Qty stays that way as long as they don't press the button.
   Where it lives: inline in the Fee Details card; no dialog.

Edge within the journey: removing the 40HQ row entirely → the notice lists each 40FT line as _"Containers have no 40FT"_. The button sets them to **Qty 0**, which by the floor rule charges 0, and the operator deletes them if they should go. The button never deletes a row.

**Journey 4 (unchanged, confirmed): Non-container charges**
A per-BL, per-shipment, per-set, per-person or per-m³ cell applies at Qty 1 whatever the Containers card says. It is never listed in the mismatch notice. The operator types the quantity as today.

## 3. Result (What Changes for the User)

**Before:** Every template line lands at Qty 1. A 3×40HQ quote undercharges container fees by two thirds until someone retypes each Qty. Default ticks also add container sizes the job does not have.
**After:** Container-unit lines land at the booked count, cells for absent sizes start unticked, and a later change to Containers is flagged with a one-press fix.
**Key differences:**

- Sales: applied **40FT / NT-40FT / 40HQ** lines arrive at the container count; SET / BL / SHIPMENT / PERSON / CBM stay at 1.
- Sales: the picker shows `×N` on container cells and no longer pre-ticks sizes the quote has none of.
- Sales: a **"template lines don't match Containers"** notice with **Match Qty to containers** in Fee Details.
- Approver (step 7): unchanged; the below-tariff check reads unit price, not quantity.

## 4. Technical Architecture

**Data flow.**

- **Saved quote:** dialog → `quotations.applyTemplate` → loads `quotation_container` rows for the quotation → for each picked cell, `containerQuantityFor(cell.unit, containers)` → `computeFeeLineAmounts({ quantity, unitPrice, minCharge, exchangeRate })`.
- **Unsaved quote:** the page passes form `containers` to the dialog → `toDraftLine` calls the same function.
- **Picker:** `defaultTickedKeys` gains the containers and drops container cells whose count is 0.
- **Editor:** a derived `containerMismatches(feeLines, containers)` drives the notice. The action writes quantities and calls `recalcLine`.

**Pure matcher: `packages/api/src/quotation/container-quantity.ts` [NEW]** (serves J1 step 4, J2 step 3, J3 steps 1–2, J4). It sits beside `money.ts` so web and server import one copy, the way `computeFeeLineAmounts` already is (`reference-template-dialog.tsx:1`).

```ts
export type ContainerRow = { containerType: string; quantity: number };

/** What a billing unit means against a container mix. */
export type UnitMatch =
  | { kind: "not_container" }                       // SET, BL, SHIPMENT, PERSON, CBM, … → qty stays 1
  | { kind: "container"; label: string; count: number }; // count may be 0

/**
 * 1. EXACT: norm(unit) === norm(containerType)          "40HQ" ↔ "40hq"
 * 2. SIZE:  unit matches /^(?:[a-z]+-)?(\d{2})ft$/i       "40FT", "NT-40FT", "SL-20FT"
 *           → Σ quantity of rows whose containerSize() === that size
 * 3. else if the unit itself parses as a container code (containerSize(unit) !== null)
 *           → { kind: "container", count: 0 }             "20GP" on a 40HQ-only quote
 * 4. else  → { kind: "not_container" }
 */
export function matchUnit(unit: string | null | undefined, containers: readonly ContainerRow[]): UnitMatch;

/**
 * Leading two digits of an equipment code, or null for a non-container code.
 * "40hq"→"40", "20GP"→"20", "45hc"→"45", "40ft-trailer"→"40".
 * Ton-truck codes ("20t", "10t", "1-5t"), "lcl", "ltl", "ftl", "truck", "bulk",
 * "c62", CJK/package slugs → null.
 * Rule: /^(\d{2})(?!t$)(?:[a-z]|-|$)/i after norm(); the fixtures pin the list.
 */
export function containerSize(code: string): string | null;

/** The quantity an applied line gets. No containers at all → "1" (today, D2). */
export function seededQuantity(unit: string | null | undefined, containers: readonly ContainerRow[]): string {
  if (containers.length === 0) return "1";
  const m = matchUnit(unit, containers);
  return m.kind === "container" && m.count > 0 ? String(m.count) : "1";
}
```

- A `count: 0` container cell still **applies at 1** when the operator ticks it explicitly (J1 step 3's edge). The operator's explicit tick outranks the rule, and 0 would print a free-looking line (the A12 reasoning in `lib/quotation.ts:350-357`) → D6.
- `norm` is imported from `tariff-check.ts:59` (same trim + lower-case rule), not re-implemented.
- The size rule is deliberately narrow: two leading digits, not a mapping table. Codes it mis-sizes are fixed by adding a fixture, not by widening the regex silently → D1.

**`quotations.applyTemplate` (serves J1 step 4).**

- One added read, after `targetQuotation` (`quotation.ts:3555-3567`): `select containerType, quantity from quotation_container where quotation_id = input.quotationId`. The row was already loaded under `quotationScope`, so this read inherits tenant isolation through the FK; no new scope call is needed (§8 item 8).
- In `newFeeLineRows` (`:3756-3764`): `computeFeeLineAmounts({ quantity: seededQuantity(chargeUnit, containers), unitPrice, minCharge, exchangeRate })`.
- Applies to **both** `pickCells` and `fanOut` (`:3735`); they share the builder. The fan-out oracle stays green because its fixture has no containers (D2).
- The `:3659-3662` comment is rewritten to name the HGJ `isBoxType` rule and this plan's D1, not deleted without trace.
- Audit `after` (`:3827-3832`) gains `quantitiesFromContainers: <number of lines whose seeded qty ≠ "1">`. This is additive; `writeAuditRaw` takes arbitrary JSON.
- **Return shape unchanged** (`{ feeLines }`). Input unchanged: no client-sent quantity, because the server reads its own containers (D5).

**Dialog (serves J1 steps 2–3, J2).**

- `ReferenceTemplateDialogProps` gains `containers?: readonly ContainerRow[]`.
- `toDraftLine(cell, rank, side, templateId, containers)` passes `quantity: seededQuantity(chargeUnit, containers)`.
- The step-1 description appends a containers summary when `containers.length > 0`.
- The seeding effect (`:472-481`) calls `defaultTickedKeys(grid.lines, grid.billingUnits, containers)`. It stays once-per-visit, so the `refetch-overwrites-typed-input` guard is untouched.
- `ReferenceTemplatePicker` gains `containers?` to render `×N` beside a container cell's amount. It is display only.

**Picker defaults (serves J1 step 3).** `defaultTickedKeys(lines, units, containers = [])`. When `containers.length > 0`, drop keys whose unit gives `matchUnit(...) = { kind: "container", count: 0 }`. With no containers, behaviour is identical to today, so `reference-template-picker.test.ts` keeps its cases.

**Mismatch notice (serves J3).** In `$quotationId.tsx`, inside the existing `form.Field name="feeLines"` render (`:2503+`), next to `tariffFloorCoverage`:

```ts
// derived, never stored (D5): a line is "from the container mix" iff it came from a
// template (listTemplateId != null) and its unit is a container unit with count > 0 OR 0.
const mismatches = containerMismatches(linesField.state.value, containers);
// → { index, costName, chargeUnit, label, have: string, want: string }[]
```

- `containerMismatches` lives in `container-quantity.ts`; it is pure and tested.
- `want` = `String(count)`, including `"0"` when the size vanished (J3 edge).
- It only considers lines with `listTemplateId` (hand-typed lines are never second-guessed), `ifAny` either way, and both sides.
- Containers are read with a `form.Subscribe` on `state.values.containers`, so the notice reacts before save.
- **Match Qty to containers:** for each mismatch, `form.setFieldValue(\`feeLines[${index}].quantity\`, want)` then `recalcLine(index)` (`:1191`). No request.

**Key decisions.** Size-class matching → D1. No containers means today's behaviour → D2. Qty N on one line → D3. Non-box units stay 1 → D4. Derived, not persisted → D5. Container-aware ticks → D6. Flag, don't rewrite → D7.

## 5. Phased Implementation

### Phase 1 — Applied lines land at the container count

**Delivers:** Journeys 1, 2 and 4 end-to-end.
**Dependencies:** D1 settled (blocking). No pending migrations.

- **Task 1.1** Write `containerSize`, `matchUnit`, `seededQuantity` and `containerMismatches` with a table-driven test.
  - Fixture codes: `40hq`, `40HQ`, `20GP`, `45hc`, `40ft-trailer`, `20t`, `10t`, `1-5t`, `lcl`, `truck`, `20` (the CJK wardrobe code), `che`.
  - Units: `40FT`, `NT-40FT`, `SL-20FT`, `40HQ`, `20GP`, `SET`, `SHIPMENT`, `BL`, `PERSON-HR`, `CBM`, `""`, `null`.
  - Mixes: none, 3×40HQ, 2×20GP+1×40HQ, 2×40GP+1×40HQ (→ 40FT = 3, 40HQ = 1).

  Files: `packages/api/src/quotation/container-quantity.ts` [NEW], `packages/api/src/quotation/container-quantity.test.ts` [NEW] · Owner: **Agent A (backend)**
- **Task 1.2** In `applyTemplate`, load the quotation's containers and seed `quantity` through `seededQuantity`. Rewrite the `:3659-3662` comment. Add `quantitiesFromContainers` to the audit `after`.
  Files: `packages/api/src/routers/quotation.ts` · Owner: **Agent A (backend)**
- **Task 1.3** API-boundary test, `quotation.apply-quantity.test.ts` [NEW], reusing `apply-picks.test.ts`'s PGlite harness shape. Cases:
  - (a) 3×40HQ + `40FT` pick → qty "3", total 3×price;
  - (b) same + `SHIPMENT` pick → qty "1";
  - (c) `minCharge` 300, price 45, 3×… on a size unit → total max(135, 300) = 300, and at 10× → 450;
  - (d) no containers → qty "1" (mirrors the oracle);
  - (e) the no-picks fan-out with containers → qty seeded per unit;
  - (f) `tariffCheck` on the applied lines returns `match`, identical to the qty-1 run;
  - (g) a quotation in another org → still NOT_FOUND.

  Run the untouched `quotation.rate-card.test.ts` and `quotation.apply-picks.test.ts`; both must pass unmodified.
  Files: `packages/api/src/routers/quotation.apply-quantity.test.ts` [NEW] · Owner: **Agent A (backend)**
- **Task 1.4** Dialog: `containers` prop; `toDraftLine` seeds quantity; description summary; `defaultTickedKeys` gains containers; the picker renders `×N`. Extend `reference-template-picker.test.ts` with container-aware default cases, keeping the existing ones.
  Files: `apps/web/src/components/reference-template-dialog.tsx`, `apps/web/src/components/reference-template-picker.tsx`, `apps/web/src/components/reference-template-picker.test.ts` · Owner: **Agent B (frontend)**
- **Task 1.5** The page passes `containers` into `ReferenceTemplateDialog`, adding `containers: state.values.containers` to the existing `form.Subscribe` selector at `:2415-2424`.
  Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx` · Owner: **Agent B (frontend)**

**Acceptance.**

- User can open a saved 3×40HQ quote, apply Forwarding 40FT cells, and see Qty 3 lines with tripled totals without typing.
- The same on an unsaved quote gives identical rows.
- The API tests pass, with `rate-card` and `apply-picks` unmodified.

### Phase 2 — A changed container mix is flagged and fixable

**Delivers:** Journey 3 end-to-end.
**Dependencies:** Phase 1 (imports `containerMismatches` from Task 1.1).

- **Task 2.1** Render the mismatch notice above the fee grid from `containerMismatches(linesField.state.value, containers)`, using the existing floor-gap banner's styling (`tariffFloorCoverage` block). Add **Match Qty to containers** (`setFieldValue` + `recalcLine`). The notice is advisory: it touches nothing that gates `canSubmit`.
  Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx` · Owner: **Agent B (frontend)**
- **Task 2.2** Update the step guide text for step 6: drop "Retype Qty on every applied line" and add the notice. This is a doc outside the repo: `C:\Project\ZYT-Task\customer-intake-sop.html` step-guide JSON island. Grep that file for "Retype Qty" and "quantity 1"; there are two instances (golden step 6 and pitfall 1).
  Files: `C:\Project\ZYT-Task\customer-intake-sop.html` · Owner: **Agent B (frontend)**

**Acceptance.** User changes 3×40HQ to 5×40HQ, sees the notice naming both 40FT lines, presses **Match Qty to containers**, sees Qty 5 and recomputed totals, saves, reloads, and the values persist with the notice gone.

## 6. Delegation & Parallelization Plan

**Phase 1 — Applied lines land at the container count**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1, 1.2, 1.3 | `packages/api/src/quotation/container-quantity.ts` [NEW], `packages/api/src/quotation/container-quantity.test.ts` [NEW], `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/quotation.apply-quantity.test.ts` [NEW] | `packages/api/src/quotation/money.ts`, `packages/api/src/quotation/tariff-check.ts`, `packages/db/src/schema/quotation.ts`, `packages/api/src/routers/quotation.apply-picks.test.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.4, 1.5 | `apps/web/src/components/reference-template-dialog.tsx`, `apps/web/src/components/reference-template-picker.tsx`, `apps/web/src/components/reference-template-picker.test.ts`, `apps/web/src/routes/_next/quotations/$quotationId.tsx` | `packages/api/src/quotation/container-quantity.ts` |

- Agent A is **opus**: it changes a money write on an org-scoped mutation and overturns a documented rule; a wrong size rule under-quotes silently.
- Run mode: **A → B** (sequential). B imports `seededQuantity` / `matchUnit` / `ContainerRow` from `container-quantity.ts`.
  - Contract, fixed now: the signatures in §4. A publishes Task 1.1 first; B may start once that file exists, while A continues with 1.2–1.3. B never edits `container-quantity.ts`, and A never edits `apps/web`.
- Serialization point: `bun run check-types`. Read the output for "failed", not the exit code (memory: vp-run exit code lies). Also run `bunx vp test run packages/api/src/routers/quotation.rate-card.test.ts packages/api/src/routers/quotation.apply-picks.test.ts packages/api/src/routers/quotation.apply-quantity.test.ts packages/api/src/quotation/container-quantity.test.ts apps/web/src/components/reference-template-picker.test.ts`.

**Phase 2 — A changed container mix is flagged and fixable**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent B (frontend) | frontend-engineer | sonnet | medium | 2.1, 2.2 | `apps/web/src/routes/_next/quotations/$quotationId.tsx`, `C:\Project\ZYT-Task\customer-intake-sop.html` | `packages/api/src/quotation/container-quantity.ts` |

Run mode: single agent. `$quotationId.tsx` stays with Agent B across both phases.

Smell test:

- [x] every task has one owner
- [x] no file is owned twice in a phase
- [x] the sequential dependency names its artifact (`container-quantity.ts`)
- [x] the one `opus` is justified
- [x] Phase 1 completes Journeys 1, 2 and 4

**Cross-step coordination (shared worktree, parallel step plans).** `$quotationId.tsx`, `reference-template-dialog.tsx` and `packages/api/src/routers/quotation.ts` are also likely touched by steps 5, 7 and 8. Follow `shared-worktree-commit-protocol`: one committer at a time; read every hunk before `git add`.

## 7. Impact & Breakage Analysis

- **`quotations.applyTemplate`.**
  - Callers: `reference-template-dialog.tsx:366`, the e2e specs `e2e/specs/quotation.tariff-check.spec.ts` and `quotation.tariff-deal.spec.ts` (through the picker), and `qa/runner.mjs` (`:8692`, `:12495`, `:16564`, `:27653`, `:29277`, `:29304`, `:29433`, among others).
  - Input and return shape are unchanged. **Behaviour change:** quantity/total/local on inserted rows, and `quotation.total_local_currency`.
  - QA runner cases that apply onto a quotation **with containers** and assert qty "1" or a total will flip. Grep `qa/runner.mjs` for `containers:` near each `applyTemplate` call before merge, and update the assertion rather than the rule.
- **`toDraftLine` / `TemplateDraftLine`.** The shape is unchanged (`quantity` already exists), so `onApplyLines` at `$quotationId.tsx:2474` spreads the same fields.
- **`defaultTickedKeys`.** It gains an optional third parameter. The only caller is `reference-template-dialog.tsx:480` plus its test, so there is no break.
- **Step 7 floor check** (`tariff-check.ts`, `assertNoLineBelowTariff`). It is keyed on `chargeUnit` and compares `unitPrice`; this plan changes neither field, so there is no interaction. Pinned by Task 1.3 (f).
- **Estimated Profit / `sumLocalWithTax` / `computeEstimatedProfit`.** They read `localAmount`, which grows with quantity. That is the intended fix; the if-any exclusions are unchanged.
- **Conversion (step 11+).** `bridge.ts` carries `totalPrice` only. The order receives the corrected gross amount, and the existing "quantity/unit price dropped" defect persists as-is. Steps 11+ must know that quantities > 1 now arrive routinely.
- **Nullable fields relied on.** `template_billing_unit.unit` is NOT NULL, but the legacy branch's `chargeUnit` can be null or `""` (`lib/quotation.ts:371`). The matcher treats those as `not_container` → qty 1, exactly today's legacy behaviour. `quotation_container.quantity` is NOT NULL, default 1.
- **Container-code drift.** The Containers select writes lower-case slugs, but `emptyContainer()` writes `"20GP"`, and older rows may be upper-case. `norm()` makes those equal. Codes outside the size rule fall to `not_container`, which is today's behaviour, never an error.
- **Deployment coupling.** The server change (1.2) can ship alone: saved quotes are fixed. The web change (1.4) without 1.2 fixes only unsaved quotes, and the two paths disagree until both ship. **Deploy Phase 1 together.** Phase 2 is independent afterwards.
- **Blocking prerequisites.** D1 (the matching rule). Also, knowing whether production charge units match `seed/tariff-data.ts` would sharpen D1 but does not block it. It needs a read of `charge_unit` / `template_billing_unit` on `br-round-sun`, which this plan was forbidden to touch.

## 8. Cross-Cutting Concerns

- **Errors.** No new failure modes. An unmatched unit falls back to qty 1, never a refusal. The notice is hidden while the quote query is loading.
- **Testing.**
  - Unit: `container-quantity.test.ts`.
  - API boundary: `quotation.apply-quantity.test.ts`, plus the untouched oracles.
  - Web unit: `reference-template-picker.test.ts`.
  - Browser: §10 via Chrome MCP.
- **Migration.** None under D5-B. D5-C would take `0070`.
- **Rollback.** Revert the commits. Lines already written keep their seeded quantities; they are ordinary editable values, and nothing else depends on them.

**Performance & Scalability**

1. **Pagination.** N/A: no list endpoint is added. The container read is bounded by one quotation's rows.
2. **SQL-side filtering.** The container read is `where quotation_id = $1` in SQL; matching happens in JS over a handful of rows.
3. **N+1.** None: one container read per apply, not per line.
4. **Index coverage.** `quotation_container_quotation_idx (quotation_id)` covers it (`schema/quotation.ts:410`).
5. **Write atomicity.** Unchanged: the containers are read before the existing transaction (`:3815`), and the insert + total + audit stay in it.
6. **Row locking.** A container edit racing an apply is guarded in the UI by the save-first rule. A concurrent save from another tab could land between read and insert; the Phase 2 notice surfaces the drift on next load. `FOR UPDATE` is not added; the consequence is a flagged, editable quantity.
7. **Resources.** No new connections or external calls.
8. **Tenant isolation.** The container read keys on `input.quotationId` only after `targetQuotation` was loaded under `quotationScope` and NOT_FOUND thrown otherwise. Test 1.3 (g) pins it.
9. **Payload size.** Unchanged.
10. **Hot path.** Operator-triggered apply, not on page load. The notice is a pure derivation over form state, with no request.

## 9. Decision Register, Open Questions & Risks

### Settled 2026-09-15 — was blocking

**D1: How does a template billing unit match the quotation's containers?** · Status: **Settled — B chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Exact code only (`norm(unit) === norm(containerType)`) | Simplest, with no guessing. But NCT's own tariff uses `20FT` / `40FT` / `NT-40FT` while Containers holds `40hq`, so nothing on the real sheets would ever match and the defect stays for NCT. |
| **B** | Exact code first, then **size class**: `(PREFIX-)?NNFT` sums every container whose code starts with the same two digits (ton-truck codes excluded) | Fixes NCT's six sheets and eyun-style `40HQ` columns alike, with no schema or data change. Costs a narrow parser whose edge codes are pinned by fixtures; `40FT` counts 40GP+40HQ+40RF together, which is how NCT's sheet prices them. |
| **C** | Data-driven: owners tick `isBoxType` on charge units and a new `container_size` column maps each unit (migration 0070) | Most explicit and tenant-editable, and uses the HGJ flag as designed. But it needs a migration, a /parameters form change and someone to maintain 12+ flags before any quote is fixed. The seeded units carry no flags today. |

- **Recommendation: B.** The HGJ rule ("box units multiply by container counts of that type") is already the repo's stated intent, and B is the only option that fixes NCT's real tariff codes on day one. C can layer on later: `isBoxType = false` would override the size match.
- **Chosen:** B (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, it blocks Task 1.1 and everything after.
- **Where it lands:** §4 matcher; Tasks 1.1–1.5, 2.1

### Settled 2026-09-15 — was non-blocking

**D3: Quantity N on one line, or N lines at quantity 1?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | One line, `quantity = N` | Matches the Qty column's purpose and the floor rule (`max(N × price, min)`). Step 7's key is unaffected, and the customer sheet reads "3 × 200". |
| **B** | N lines at quantity 1 (the picker comment's "two containers, two haulage lines") | One line per box can carry a per-box destination later. It bloats the sheet, triples the floor charge (floor applied per line), and makes step 7 see N identical keys. |
| **C** | Keep qty 1, only warn "Containers say 3" on applied lines | No money written by a rule. The operator still retypes every line, which is the defect, now with a caption. |

- **Recommendation: A.** `computeFeeLineAmounts` already models quantity × price with one floor. B double-applies `minCharge` (Man Power "min 2 persons" ×3 lines = 3 floors).
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15 · **Blocking?** No; the plan is written for A. B would change Task 1.2's builder into a flatMap. · **Where it lands:** §4 applyTemplate; Tasks 1.2, 1.4

**D4: What quantity do units with no container meaning get?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | 1 for all of them (SET, BL, SHIPMENT, PERSON, PERSON-HR, CBM, kg) | Today's behaviour. It is correct for per-BL and per-shipment on a one-BL quote, and wrong only where the header holds a measure. |
| **B** | 1, except `CBM` from `totalVolumeCbm` and kg/MT from `totalGrossWeightKg` when set | Fixes Loose Cargo too. Those header fields are optional, free-form strings, often blank at step 6, and change after pricing; the Phase 2 notice would have to track them as well. |
| **C** | 1, and add BL count from a future "number of BLs" field | Nothing to read today; this is really "defer". |

- **Recommendation: A.** The filed defect is containers. The CBM case has a floor (`minCharge`) that already protects the under-quote, so it is a separate, smaller fix.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15 · **Blocking?** No. · **Where it lands:** `matchUnit`'s `not_container` branch; Task 1.1

**D5: Is "this quantity came from the container mix" stored?** · Status: **Settled — B chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Store nothing and never re-derive | Simplest. But J3 is impossible: nobody is told when the mix changes. |
| **B** | Store nothing; **derive** the mismatch on the page from `listTemplateId` + unit + current containers | No migration, and J3 works. It cannot tell a deliberately different Qty from a stale one, so the notice may list a line the operator chose on purpose; the button is opt-in, so nothing is overwritten. |
| **C** | New `quotation_fee_line.quantity_source` (`'manual' \| 'containers'`), migration **0070**, cleared when Qty is typed | The notice lists only lines still following the mix, with no false positives. It costs a migration, the three migration gates, a form field that every hydration site (`seedFeeLine`) must carry, and patch-semantics care on update. |

- **Recommendation: B.** It is migration-free, and a false positive costs one ignored notice, while C's column must survive `seedFeeLine`, `duplicate` and `update`, which this repo has already mis-hydrated once (P0-11).
- **Chosen:** B (the recommendation) — Wilfred, 2026-09-15 · **Blocking?** No; it blocks only Task 2.1's filter. · **Where it lands:** §4 mismatch notice; Task 2.1; §8 migration

**D7: When Containers change after lines were applied, what happens?** · Status: **Settled — B chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Auto-update every template line's Qty as Containers change | Zero clicks. It silently rewrites money the operator may have set on purpose, and on a saved quote it writes on the next save without being asked. |
| **B** | Inline notice listing mismatched lines + **Match Qty to containers** button; saved on the normal **Save Quote** | Visible, one press, and never overwrites without consent. |
| **C** | Do nothing after apply; quantities are only seeded at apply time | Cheapest, but the 3→5 change re-opens the exact under-quote this fixes. |

- **Recommendation: B.** It mirrors the existing advisory floor banner (`tariffFloorCoverage`, which is "advisory, always") and the repo's rule that effects must not overwrite typed input.
- **Chosen:** B (the recommendation) — Wilfred, 2026-09-15 · **Blocking?** No; it blocks Phase 2 only. · **Where it lands:** Journey 3; Task 2.1

### Assumed

**D2: A quotation with no container rows** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Qty 1 on every line (today) | LCL, road and air quotes behave exactly as now, and the oracle tests stay green unmodified. |
| **B** | Container-unit lines at Qty 0 | "No containers" becomes "no charge", and lines print as free, the A12 defect. |
| **C** | Refuse the apply until Containers are filled | Blocks legitimate early pricing and every non-FCL quote using a mixed sheet. |

- **Recommendation: A.** An empty Containers card says "not filled in yet" more often than "zero boxes". · **Chosen:** A (assumed by the plan) · **Blocking?** No · **Where it lands:** `seededQuantity`; Task 1.3 (d)

**D6: A container cell whose size the quote does not have** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Not pre-ticked; if ticked explicitly, applies at Qty 1 with a hint | Default ticks stop adding 20FT to a 40HQ job, and the operator's explicit tick is respected. |
| **B** | Pre-ticked as today, applied at Qty 0 | A zero line prints on the customer sheet as a free charge. |
| **C** | Not tickable at all | Hides a price the operator may need (e.g. Containers not yet updated), and fights the picker's "warn, don't prevent" rule. |

- **Recommendation: A.** It is consistent with `defaultTickedKeys`' existing reasoning ("pre-ticking puts a charge on the quote for a place the cargo is not going"). · **Chosen:** A (assumed) · **Blocking?** No · **Where it lands:** `defaultTickedKeys`; Task 1.4

**D8: New session or append to `09-06_13-26_tariff-rate-cards`?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | New session `_plan/MM-DD_HH-MM_tariff-quantity-from-containers` | Clean audit trail; links back to 0060's plan in §9. |
| **B** | Append a phase to the rate-card session | Keeps the history in one place, but re-opens an executed plan. |
| **C** | Fold into the step 07 plan (save and price floor) | Fewer sessions, but it couples a money write to a separate refusal rule. |

- **Recommendation: A.** · **Chosen:** A (assumed) · **Blocking?** No · **Where it lands:** META

**D9: Conflict between the step guide and the code.** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Follow the guide's intent (seed from containers) and record that the handler documents qty 1 as deliberate (`quotation.ts:3659-3662`) | The rule is overturned knowingly, with the HGJ `isBoxType` rule as justification, and the comment is rewritten rather than left contradicting the code. |
| **B** | Follow the code's comment and close the defect as "by design" | The guide's 3× under-quote stands. |
| **C** | Ask for eyun capture evidence first | Blocks on evidence the handler says does not exist. |

- **Recommendation: A.** The guide's claim about behaviour is accurate at HEAD; only its framing ("the template never reads your container mix") omits the recorded reason. The citation `reference-template-dialog.tsx:190` is still correct. · **Chosen:** A (assumed) · **Blocking?** No · **Where it lands:** Task 1.2 comment

**Risks.**

- _The size parser mis-sizes an unusual code_ (e.g. `4hot`, `20` wardrobe). Likelihood is low, impact is a wrong qty on one line. **Mitigation:** fixtures for every 126-code shape that starts with digits, plus the fallback to `not_container` → qty 1 (today's answer).
- _QA runner cases assert qty 1 on quotes that carry containers._ Likelihood medium, impact is a red suite. **Mitigation:** grep before merge (§7) and update the assertions, not the rule.
- _Production tariff units differ from `seed/tariff-data.ts`._ Likelihood unknown, impact is that B matches less than expected. **Mitigation:** a read-only query of distinct `template_billing_unit.unit` on production before rollout. It was not run here (DB access was out of bounds).

## 10. Verification & Proof

**App URL:** http://localhost:3101/quotations
**Preconditions:**

- A seeded owner org (`e2e/fixtures/seed-cli.ts seed-parity <runId>`) with the NCT tariff (`seed/tariff.ts`): Forwarding and Custom Clearance templates approved.
- Quotation Q1 saved, **sea_import**, Containers 3×`40hq`, no fee lines.
- A new unsaved quote for Journey 2.
- Remember the shared session's active org (memory: shared-session-active-org): confirm the org switcher before each check.

**Migrations:** none. Confirm the journal still ends `0065` (or the step-01/02 migrations if they landed) before testing.

**Golden path — Journey 1:**

1. Navigate to `/quotations`, open Q1 → the Containers card shows `40hq` / Qty `3`.
2. In Fee Details press **Reference Template** → the dialog description mentions **3×40HQ**.
3. Select **Tariff — Forwarding**, Selling Price, **Next** → the 40FT cells are ticked with `×3`; the 20FT cells are unticked.
4. Press **Apply** → toast **Template lines applied**; the grid shows **Operational Cost Recovery Surcharge · 40FT · Qty 3 · 200 · Total 600** and **Forwarding Fee · 40FT · Qty 3**. BL / SHIPMENT lines show Qty 1.
5. The header tariff badge shows no below-tariff count; **Estimated Profit** receivable includes 600.

**Golden path — Journey 2:**

1. **Add** a quote; Containers 2×`20gp` + 1×`40hq`; do not save.
2. **Reference Template** → **Tariff — Custom Clearance** → **Next** → all 5 cells are ticked; 20FT shows `×2`, 40FT shows `×1`.
3. **Apply** → Custom Examination Fee 20FT Qty 2 Total 300; 40FT Qty 1 Total 250; EDI Qty 1.
4. **Save Quote**, reload → same rows.

**Golden path — Journey 3:**

1. On Q1 set the Containers Qty to `5` → the notice **"2 template lines don't match Containers"** appears, naming both 40FT lines.
2. Press **Match Qty to containers** → both Qty cells read 5, totals 1000 / 5×fee; the notice is gone.
3. **Save Quote**, reload → Qty 5 persists, with no notice.

**Edge case:** on Q1, delete the 40hq container row → the notice lists each 40FT line as "Containers have no 40FT". **Match** sets Qty 0 and Total 0; no row is deleted. Then a quote with **no** containers applying Forwarding 40FT → Qty 1 (unchanged behaviour).
**Regression check:**

- Try a unit price below tariff on a Qty-3 line → **Save Quote** is still refused with the step-7 message naming that line.
- `quotation.rate-card.test.ts` and `quotation.apply-picks.test.ts` pass unmodified.
- A destination sheet (Haulage Local) still arrives with nothing ticked.

**Mobile:** at 375px the picker's `×N` badges stay inside the grid's own scroll box, and the mismatch notice wraps inside the Fee Details card with no page-level horizontal scroll.

_2026-09-15: Wilfred chose the recommendation for every open decision in §9. The readiness points held back for pending decisions no longer apply._

**Readiness: 7/10.** The design is concrete and needs no migration, with every cite re-verified at HEAD. Three things hold back the remaining points: D1 (the matching rule) is a real business call that blocks Task 1.1; production's actual billing-unit codes were not read (DB was out of bounds); and the QA-runner cases that may assert qty 1 on container-bearing quotes were not enumerated one by one.
