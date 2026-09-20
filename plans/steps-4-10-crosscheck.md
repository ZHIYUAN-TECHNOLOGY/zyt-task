# Steps 04–10: cross-plan check (2026-09-15)

> **Decisions settled 2026-09-15.** Wilfred chose the recommendation for all 33 open decisions and for the five gaps between plans (X1–X5). Each plan's §9 now records the choices. X1–X4 were written into the plans, under "Settlements that span plans" in steps 04, 08 and 10. **X5 is still open** and moves to the step 11 plan: `convertToOrder` does not check for Won.

The seven /planpro plans were written in parallel at nct-layout HEAD `6bb3a1bf`, reading only (no git, servers or database). This note records where they depend on each other.

| Step | Plan | Readiness | Migration | Blocking decisions |
|---|---|---|---|---|
| 04 | step-04-rate-card-gate.md | 7/10 | yes (0068) | D1, D5 |
| 05 | step-05-quotation-date-and-staff.md | 8/10 | no (0069 only if D3-C) | D1, D2, D3 |
| 06 | step-06-tariff-quantity-from-containers.md | 7/10 | no (0070 only if D5-C) | D1 |
| 07 | step-07-ambiguous-tariff-floor.md | 7/10 | no (0071 only if D1-C) | D1, D2, D3 |
| 08 | step-08-quotation-approval-integrity.md | 7/10 | no (0072 only if D1-C / D5-B) | D1, D2, D3 |
| 09 | step-09-send-outbox.md | 7/10 | yes (0073) | D1 |
| 10 | step-10-decision-correction.md | 6/10 | yes (0074) | D1, D2, D4 |

## Migration numbers
The journal head is 0065. Steps 01 and 02 hold 0066 and 0067, but neither is on disk yet. The migration gate requires contiguous numbers, so a reserved number that goes unused leaves a gap. **Assign final numbers in merge order**; the reservations only avoid clashes while planning.

## Merge order
1. **04** first. Step 07 Phase 3 and step 06's `reference-template-dialog.tsx` edits sit on top of it.
2. **08** before **09** and **10**. Step 09 relies on 08 moving the export gate into `send` (08 D7). Step 10 relies on 08's rule that nobody decides their own submission, and edits the same `decide.ts`, `submit.ts` and `resources.ts` after it.
3. **05, 06, 07** after 04, one at a time. All three edit `quotation.ts` and `$quotationId.tsx`.
4. `packages/api/src/routers/quotation.ts` is touched by every plan, so build these steps one after another, not side by side.

## Gaps between plans (fix these in the plans before executing)
- **Self-decision switch vs step 10.** Step 08 D1 recommends a per-type switch, "on for quotations only". Step 10 adds a new review type, "decision correction", and needs that switch **on for its type too**. Neither plan says so.
- **Fee-template self-approval has no owner.** Step 08 §1 assigns it to step 04. Step 04 does not cover it.
- **Legacy `feeTemplates.review` has no owner.** Step 04 files it as a follow-up (harmless under D3-B). Step 08 assigns it to step 04. Decide who removes it, including the `architecture.test.ts` allow-list entry.
- **`decide` while under review.** Step 08 declares it out of scope and assigns it to step 10. Step 10's plan does not freeze `decide` under review.
- **Header-only floor bypass (step 07 D5).** Confirmed at `quotation.ts:3285`: the floor runs only `if (feeLineRows)`. The editor always sends `feeLines` (`$quotationId.tsx` submit payload), so re-dating from the UI is re-checked. The bypass is reachable only through a direct API call. Step 05 does not widen it.
- **New defect, no owner:** `convertToOrder` never checks for Won, so a Lost quotation converts (found by step 10). This belongs to step 11+.

## Production read-only probes still to run
- Step 04 D5: live unapproved rate cards in use (queries in §7).
- Step 05: any role policy that denies `quotationDate` or `quotationStaff`.
- Step 07 D4: existing same-start-date clashes.
- Step 08 D5: quotations whose cached status disagrees with their review.
