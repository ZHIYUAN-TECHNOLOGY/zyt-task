# Step 16 — a bill of lading carries only the states the workflow set, links only to an order its clerk can see, and starts from its job

**SOP step:** 16 "Raise the bill of lading" · left rail **Shipment** → **Add** → `/lading/create` · the B/L is then edited at `/lading/$id/edit`
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-21, the commit steps 04–15 were planned at. The `nct-layout` working tree sits at `ea1560e7`, four e2e-only commits later (`d52cd72d..ea1560e7`, golden-path specs for SOP steps 01–10). `git diff --stat 6bb3a1bf -- packages apps` is empty, so every code citation below matches `6bb3a1bf`. Every `file:line` was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Standard. Changes the input contract of `lading.create` / `lading.update` (status vocabulary, review cache, branch), adds the under-review freeze and a row lock to `lading.update`, re-scopes how a B/L resolves its order on write, adds an order-to-B/L hand-off on the order record page, and surfaces OCR validation on the create form. **No migration** under the recommended options.
**Status of decisions:** every decision in §9 is **Decided (2026-09-21)**. Wilfred took the Recommended option of each (D1–D12 all A) and accepted every cross-plan settlement in `steps-16-19-crosscheck.md` (X17–X27). The tasks are worded for the Chosen option. See "Decisions settled (2026-09-21)" at the end.
**Cross-plan items owned:** step 15 §9 Risks hands "`lading.update` checks the gate on `context.db` outside its write transaction" to steps 16/17, and step 15 Phase 0 adjacent defect 8 hands over "`lading.update` has no `assertNotUnderReview`". This plan takes both (Phase 1). Under crosscheck X17 (settled 2026-09-21) this plan is the **only** owner of the `lading.update` freeze, its `FOR UPDATE` load, the in-transaction guards and the `lading.exists` lock; step 17 (`step-17-lading-states-and-review.md`) takes its D2-B and adds none of them. Under X18–X20 this plan also owns the status vocabulary (D1), the Audit Status removal (D3), and creates both `lading.concurrency.test.ts` and `lading.under-review.test.ts`, which step 17 extends. Step 17 owns the missing lading submit path (`nct-dead-queues`, `{k:"s", n:17}`) and the attachment writers (X21); this plan adds neither.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope` at `procedures/org.ts:429`, `resolveOwningBranchId` at `:369`). Drizzle schema in `packages/db/src/schema`. TanStack Router file routes in `apps/web/src/routes/_next`. zod on both sides; zod objects strip unknown keys. vitest on PGlite. Dev: web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Form.** `/lading/create` (`apps/web/src/routes/_next/lading/create.tsx`, route `:29`, no `validateSearch`). Tabs in this order: **Basic**, **Route & Parties**, **Cargo & Terms**, **Administration**, **Containers**, **OCR** (`:533-547`). Submit parses `createSchema` and calls `lading.create` (`:414-437`, mutation `:352-372`, success toast _"Bill of Lading created"_ `:355`, then `navigate("/lading/$id")`).
  - **Server.** `ladingRouter.create` (`packages/api/src/routers/lading.ts:1030`) needs `LADING.create` (`:1031`), resolves the branch with `resolveOwningBranchId` (`:1038`), then in one transaction resolves the order (`resolveLadingOrder`, `:1048`), inserts the row (`:1049-1133`) and containers (`:1140-1155`), and writes `lading.create` to the audit log (`:1157-1177`).
  - **Order link.** `resolveLadingOrder` (`modules/lading/resolve-order.ts:142`): an explicit `orderId` wins and is checked against the **organisation only** (`:147-156`); otherwise `orderNo` is trimmed and matched against `collective_order.job_number` in the **organisation**, two rows fetched to detect ambiguity (`:162-179`). No data-scope predicate on either path.
  - **Money on the B/L.** Every lading money figure is "that order's cost lines": `ladingReceivableExpr` (`lading.ts:91-96`) and `get`'s per-currency `feeRows` (`:1403-1415`) read `cost_line where order_id = lading.order_id`. The lading's own data scope (`applyScope(…, "lading", …)`, `:1364`) is what guards them.
  - **Roles.** No "documentation" role exists. `lading.create` (flat statement `lading: [...fullCrud]`) is held by owner, admin, branch-manager and ops (`packages/auth/src/permissions.ts:105, 132, 154, 176`); accounting holds `lading.read` + `lading.review` (`packages/api/src/roles.ts:218-219`), director holds `lading.review`. OCR needs `lading.detail.ocr-import` (`modules/lading/permissions.ts:27, 60`), reached through the `lading.detail` subtree grant of admin, branch-manager and ops (`roles.ts:92, 106, 166`).
  - **Review.** The seeded "Bill of lading review" flow (`modules/audit/seed.ts:153-165`): one `director` stage, `withdrawalMode: "direct"`, `gates: []`. No screen submits a lading (step 17's defect), but the RPC does, and the e2e suite and the operations seeder use it: `e2e/specs/audit.review-queue.spec.ts:131-134`, `audit.withdraw.spec.ts:127-136`, `seed/run-operations.ts:7` (order `… -> ladings -> submit`).

- **Finding A (status is free-set, so the gated verbs can be skipped): confirmed, and wider than filed.**
  - `ladingFields.status` is `z.string().optional()` (`lading.ts:265`) and create writes `input.status ?? "draft"` (`:1059`). `ladingUpdateInput.status` is `z.string().optional()` (`:359`) and update copies it into `values` (`:1556-1569`). **Any string is accepted**, not only the five the forms offer.
  - Both forms offer the workflow-owned states: `STATUS_OPTIONS = ["draft", "confirmed", "released", "cancelled", "on-hold"]` (`create.tsx:140`, `$id/edit.tsx:165`).
  - The workflow verbs carry the gates: `applyWorkflow` (`lading.ts:601`) calls `assertGateCleared(…, "release")` for check-out (`:633`) and `"detention"` for hold (`:637`), after the scoped load.
  - **`released` has no workflow writer at all.** Check-out patches only `checkedOutAt` (`:554-559`), and `statusAfter` (`:526-539`) leaves `status` as it was when no hold or amendment is on. So the only way a bill reads **released** is the free dropdown. The SOP repair ("the only way into them is checkOut / hold / amend") is wrong for `released`.
  - **On-hold by hand is stuck.** `heldAt` stays null, so **Cancel Hold** refuses _"Not on hold"_ (`:590`, not `:585` as filed; `:585` is the hold patch). Recovery is another free status edit.
  - An edit to `status` while a hold or amendment is on already lands underneath (`:1604-1607`); that behaviour stays.
  - **New, and the most frequent path: the edit form corrupts a held bill on every save.** The form seeds `status: d.status` (`$id/edit.tsx:348`) and `handleSubmit` sends the whole form (`payload = { ...form }`, `:667`; `status` is in `NON_CLEARABLE`, `:690`, so it is always sent). On a held bill that value is the badge `on-hold`, so `update` writes `statusBefore = "on-hold"` (`lading.ts:1604-1606`). **Cancel Hold** then restores `statusBefore` (`statusAfter`, `:538`) and the bill stays **on-hold** with no hold on it — the exact failure `statusAfter`'s own comment (`:520-525`) says it exists to prevent. Amended bills behave the same way. The form also resends `owningBranchId` on every save (same `NON_CLEARABLE` set).
  - Test pin: `lading.test.ts:716-725` writes `status: "released"` through `update` on a held bill and expects `released` after the hold is lifted. It must switch to a settable status.

- **Finding B (the review cache is free-set) — not in the SOP.**
  - `auditStatus` is writable on create (`lading.ts:330`, written `:1128`) and update (`:424`, copied into `values`). Both forms render an **Audit Status** select offering None / Pending / **Approved** / Rejected (`create.tsx:1292-1307`, `$id/edit.tsx:1558-1570`, sent as a normal field, section list `:600`).
  - The engine owns that column: `REVIEWABLE_RESOURCES.lading.repaintCache` writes it (`modules/audit/resources.ts:245-275`), and the registry note says the cache is "WRITTEN through here and read nowhere" (`resources.ts:21-31`).
  - Consequence: a clerk can create a bill already reading **Approved** with no submission. The ledger's review column reads it (`-lading.columns.tsx:760`). The review queue's "not yet submitted" view filters `audit_status IS NULL` (`lading.ts:743-747`), so a forged bill drops out of it. Gates read `audit_submission`, not the cache (`gates.ts:64-92`), so no gate is bypassed; the harm is a bill that says it was approved.
  - Precedent: quotations already refuse this (`step-08` Phase 0: "`quotationHeaderInput` has no `auditStatus`").

- **Finding C (editable under review): confirmed.**
  - `lading.update` runs `assertPostApprovalEditable` only (`:1554`), which is inert until a submission passes. `assertNotUnderReview` is imported (`:34`) and used by `delete` (`:1474`) and `bulkDelete` (`:1513`), not by `update`.
  - The load (`:1545-1548`), the post-approval check (`:1554`) and the order resolution (`:1587-1596`) all run on `context.db` **before** the transaction opens (`:1609`), and nothing locks the row. `REVIEWABLE_RESOURCES.lading.exists` (`resources.ts:248-254`) takes no lock either. So a save can interleave with a submit (the same race step 15 D10 closes for orders).
  - Step 15 Phase 3 Task 3.2 puts its `create_lading` gate for re-links on `context.db` in the same pre-transaction region (step 15 §4.4). Moving the region into the transaction closes that race too (step 15 Risks).
  - Reachable today by RPC (the specs and seeder above submit ladings); reachable from the UI once step 17 adds a submit button.

- **Finding D (a B/L can link to an order its clerk cannot see) — not in the SOP.**
  - The create form's **Linked order** picker lists only orders in the caller's scope (`collectiveOrder.list`, `collective-order.ts:2435` applies `applyScope(…, "collectiveOrder", …)`). The **Order No** box beside it (`create.tsx:1273-1280`; edit `:1542`) is free text resolved org-wide (`resolve-order.ts:162-172`). The default data scope is `branch` (`procedures/org.ts:440`).
  - So a branch-scoped clerk in branch A can type branch B's job number, and the new bill (their branch, their scope) links to B's order. From then on the lading ledger and record page show B's receivables, verified amounts and per-currency fees (`lading.ts:91-103, 1403-1415`) to someone the order router would refuse. Over RPC the same holds for an explicit `orderId` (`resolve-order.ts:147-156`).
  - `get` and `list` must keep resolving org-wide (they report the link state of rows already stored). Only the two writers need the scope.

- **Finding E (the job does not hand off to its bill): confirmed; the SOP break text is wrong about the size.**
  - No order screen links to a B/L: `order-record-page.tsx:98-126` has **Assign number**, **Expenses**, **Edit order** only; no `lading` reference in `components/order-ledger/*` beyond column configs. `/lading/create` has no search params, so nothing can open it pre-pointed at an order.
  - The picker is `collectiveOrder.list({ limit: 200 })` (`create.tsx:175-181`). **`orderListInput` has no `limit` key** (`collective-order.ts:669-874`), so zod strips it and the list handler, which has no `.limit()` (`:2458-2462`), returns **every order in scope**, newest first, each enriched with cost roll-ups (`enrichOrderRows`). It includes archived and intake-rejected orders (no default filter; `archived` and `acceptStatus` apply only when sent, `:1242, 1260`). The guide ("no row limit") is right; the break ("a flat 200-row dropdown") is wrong.
  - The reverse path is broken too: `lading.list` accepts `orderId` (`listInput`, `lading.ts:462`) but `listLadings` never applies it (only `orderNo`, as an `ilike` substring, `:802-803`). The ledger's own search schema has `orderNo` only (`lading/index.tsx:71-83`).

- **Finding F (OCR issues are thrown away): confirmed, plus one data-loss path.**
  - `uploadOcr` (`lading.ts:1911`) returns `ocrExtractionForForm(result)` (`:1965`), whose `issues: ValidationIssue[]` (`:2418`) carry `code`, `severity: "error" | "warning"`, `message` and `field` (`packages/document-ai/src/registry/types.ts:31-44`). Only the count reaches the audit log (`:1981`).
  - The client's `ocrResult` type has no `issues` (`create.tsx:293-298`); nothing renders them; **Apply to Form** (`:1533`) is enabled at any confidence.
  - `issue.field` is the **extraction schema key** (`totalGrossWeightKg`, `containers`, …), not the form key; the mapping is `OCR_FIELD_MAP` (`lading.ts:2336-2350`). Rendering against the form needs that translation.
  - **New:** `applyOcrResult` sets `containers: ocrResult.containers?.map(…) || prev.containers` (`create.tsx:334-342`). The server returns `[]` when it read no containers (`lading.ts:2390`), and `[]` is truthy, so Apply **wipes every container row the clerk typed**. It also drops `packageQty` / `packageType` from the rows it writes.

- **Finding G (linking copies only the job number): confirmed.** Picking an order sets `orderId` and copies `jobNumber` into **Order No** (`create.tsx:1244-1252`). The order already holds `vesselName`, `voyage`, `portOfShipment`, `portOfDestination`, `transitPort`, `etd`, `eta`, `atd`, `mbl`, `hbl`, `soNo`, `entrustUnit`, `tradeTerms`, `shipCompany`, `shipper`, `consignee` (`packages/db/src/schema/collective-order.ts:153-245`); the lading has a column for each (`schema/lading.ts:45-135`). `collectiveOrder.get` returns them.

- **Finding H (branch on update is not validated) — not in the SOP.** `ladingUpdateInput.owningBranchId` (`:428`) is copied straight into `values`. `create` resolves it through `resolveOwningBranchId` and its own comment (`:1035-1037`) names the defect: "a caller could name a branch in another organization and produce a row they could not then read". `update` reopens it (RPC; the edit form only offers readable branches). `lading.owning_branch_id` references `team.id` with no org predicate (`schema/lading.ts:35-37`).

- **Adjacent defects on the same paths (flagged, not planned).**
  1. Party and member ids are not checked against the organisation: `shipperId`, `consigneeId`, `notifyPartyId` (FK to `company.id`, `schema/lading.ts:77-83`) and the seven desk-role ids (FK to `member.id`, `:126-132`) are written as sent (`lading.ts:1069-1117`). RPC only; the UI pickers list the caller's org. Probe 16-P10.
  2. Nothing stops two B/Ls in one org with the same **Bill No** (`lading_billNo_idx` is not unique, `schema/lading.ts:245`). Probe 16-P9.
  3. Two B/Ls on one order each show the order's whole receivable, so the ledger footer (`lading.ts:913-920`) counts it twice. A design question for the ledger's owner. Probe 16-P8.
  4. The printed **Order No** may differ from the linked order: an explicit id wins and the typed text is stored as typed (`:1125-1126`; comment `create.tsx:1246-1248`). By design; recorded so no one "fixes" it by accident.
  5. **Customer ID** (`create.tsx:1123-1129`) is a free-text box that writes a raw id into `lading.customer_id` (no FK). Harmless but meaningless to a clerk.
  6. Container numbers typed by hand get no check-digit test; only OCR runs one.

- **Precedent this plan follows.**
  - Freeze placement: after the scoped load, inside the transaction, before any write (`lading.ts:1474`; step 15 §4.1). Order: other refusals → `assertNotUnderReview` → `assertPostApprovalEditable`.
  - Row lock: `.for("update")` on the router load and in the resource's `exists` (step 08 Task 1.2, step 15 Task 1.3). Proven only on real Postgres, never PGlite (step 15 Task 1.4 note: PGlite serialises every transaction on one connection).
  - Only the engine writes the review cache (step 08 Phase 0, step 15 finding C).
  - Residue is reported read-only, never repaired automatically (step 08 D5-A, step 15 D13-A). Script folder `packages/db/scripts/` is created by step 08 Task 3.5.

- **Migration state.** The journal ends at `0065_quotation_send_decision` (idx 64) at `6bb3a1bf`; nothing pending. Reservations: 0066/0067 (01/02), 0068 (04), 0069–0072 conditional (05–08), 0073 (09), 0074 (10); conditional `00NN_` names in 11–15. **This plan needs no migration** under any Recommended option. D1-C alone would want a data backfill (§9), which this plan does not recommend.

---

## 1. Overview

**Problem.** A clerk raising a B/L can type its state and its review badge: pick **Released** or **On-hold** without the release or detention verb (and so without any gate the tenant ticked), or pick **Approved** with no review. Merely saving the edit form on a held bill overwrites what the hold sits on, so lifting the hold leaves it on hold. A bill already submitted for review can still be rewritten over RPC, and from the UI once step 17 ships its submit button. Typing a job number links the bill to any order in the organisation, including one in a branch the clerk cannot see, whose money then shows on the clerk's bill. The job itself does not hand off: there is no way from an order to its bills, the picker is every order in scope with no search, and nothing the order already knows is carried across. OCR finds bad container numbers and weights, then hides the finding.

**Goals.**
- **Phase 1 (findings A, B, C, H):** a bill's workflow state and review badge come only from the workflow verbs and the review engine. A bill under review cannot be rewritten. A bill cannot be moved to a branch its editor cannot read.
- **Phase 2 (findings D, E, G):** an order hands off to its bills and to a new one; the new bill starts pointed at the order with its shipment details filled; a typed job number links only to an order the clerk can see.
- **Phase 3 (finding F):** OCR's own checks are shown against the fields they concern, and an error-level finding needs an explicit "apply anyway".

**Success criteria.**
- `lading.create` / `lading.update` with `status` `released`, `on-hold` or `amended` → BAD_REQUEST naming the verb to use; with an unknown string → BAD_REQUEST listing the settable values. `draft`, `confirmed`, `cancelled` succeed as today (D1-A). On `update`, a `status` equal to the bill's current one is an echo and is ignored, so saving the edit form on a held bill no longer overwrites what the hold sits on, and **Cancel Hold** returns it to its real base status.
- `auditStatus` sent to either writer is ignored; `lading.audit_status` is written only by `repaintCache` (D3-A). Neither form shows **Audit Status**.
- `lading.update` on a bill whose latest attempt is `under_review` or `withdrawal_under_review` → CONFLICT _"This record is under review and cannot be edited. Retract the submission first."_, and nothing is written, containers included (D4-A). A save and a submit serialise on the lading row (D5-A).
- `lading.update` moving a bill to an `owningBranchId` the caller cannot read → FORBIDDEN _"Branch not accessible"_; resending the current branch is not checked (D7-A).
- A typed **Order No** that matches only an out-of-scope order leaves the bill unlinked (`orderLink: "unmatched"` in the trail); an explicit out-of-scope `orderId` is treated as stale (D6-A).
- The order record page shows **Bills of lading (n)** and **Raise bill of lading**; the second opens `/lading/create?orderId=<id>` with the order picked and its empty shipment fields filled (D8-A, D10-A). The picker lists received, unarchived orders (D9-A).
- An OCR result with an error-level issue shows it beside its field and keeps **Apply to Form** disabled until **Apply anyway** is ticked; Apply never empties typed containers (D11-A, D12-A).

**In scope.** Status rule on both writers and both forms; review-cache removal from inputs and forms; the under-review freeze, row lock and transaction boundary in `lading.update` (keeping step 15's gate calls); `exists` lock for `lading`; branch validation on update; scope-aware order resolution for the two writers; the `orderId` list filter; the order-to-B/L hand-off and prefill; OCR issue display; a read-only residue report; read-only production probes.

**Out of scope.**
- A lading submit path and the Shipment review queue (step 17, `nct-dead-queues`).
- Moving a bill through check-in / check-out / amend / hold (step 17; unchanged except that `status` can no longer fake them).
- The `create_lading` gate itself (step 15 Phase 3); this plan only moves its update-side call inside the transaction.
- Adjacent defects 1–6 above (flagged with probes, no owner assigned here).
- Repairing rows whose status, cache or link is already wrong (D2-A reports only).
- The edit form's **Linked order** picker contents (it must keep showing a bill's current order; step 17 area).
- SOP text for step 16 (`customer-intake-sop/sop.json`); §9 "SOP text vs code" lists the corrections for whoever runs `/zyt-update`.

**SOP findings (`customer-intake-sop/sop.json`, step 16 `fixes`, the `after: 15` break, ledger):**

| Finding | Planned? | Where |
|---|---|---|
| "A bill of lading can be set to Released or On-hold from a dropdown…" (money) | Yes, with a different repair for `released` (no verb writes it) | Phase 1, D1 |
| "A bill of lading under review stays fully editable…" (data) | Yes, plus the row lock and the transaction boundary | Phase 1, D4, D5 |
| "OCR validation issues are computed, returned, and thrown away…" (data) | Yes, plus the container-wipe path | Phase 3, D11, D12 |
| "Linking the approved order carries only its job number…" (friction) | Yes | Phase 2, D10 |
| Break "Order → Bill of lading" (no route from the job to its B/L) | Yes | Phase 2, D8, D9 |
| Ledger `dead-queues` (`{k:"s", n:17}`) | No — step 17 | – |
| Not filed: edit-form echo corrupts a held bill (A "New"), review cache free-set (B), out-of-scope link (D), branch on update (H), `orderId` list filter ignored (E) | Yes | Phases 1–2 |

**Decisions (all Decided 2026-09-21; Chosen option in brackets):**
- Which statuses a person may set by hand → D1 [A: draft, confirmed, cancelled]
- What happens to rows already wrong → D2 [A: report only]
- The review cache on the writers → D3 [A: drop it from both inputs and forms]
- What the under-review freeze covers → D4 [A: all of `lading.update`; attachments stay open]
- Serialising save against submit → D5 [A: guards inside the transaction, `FOR UPDATE` on both sides]
- An order link outside the clerk's scope → D6 [A: treated as no match, silently]
- Branch on update → D7 [A: validate with `resolveOwningBranchId`]
- The hand-off from order to bill → D8 [A: count link plus **Raise bill of lading**]
- What the picker lists → D9 [A: received and not archived]
- Carrying the order's details → D10 [A: fill blanks only, marked "from order"]
- OCR errors and Apply → D11 [A: show per field; errors need "Apply anyway"]
- Where OCR issues are mapped to form fields → D12 [A: on the server]

## 2. User Journeys

**Journey 1 (changed): Documentation raises a B/L from the job**
Trigger: the order is received (step 13) and, in a gated org, approved (step 15).
Steps:
1. Documentation opens the order's record page (`/order/sea-export/<id>` or any trade's record route) → beside **Expenses** and **Edit order** there is **Bills of lading (0)** and **Raise bill of lading** (D8-A). **Raise bill of lading** is shown only with `lading:create`.
2. Presses **Raise bill of lading** → `/lading/create?orderId=<id>`. On **Administration**, **Linked order** already shows the order and **Order No** its job number. On **Basic** and **Route & Parties**, Vessel, Voyage, POL, POD, Transhipment Port, MBL No, HBL No, Booking No, Shipping Company, Shipper and Consignee (free text), and on **Administration** ETD / ETA / ATD, Entrust Unit and Trade Term, are filled where the order had a value, each with a small "from order" note (D10-A). A field the clerk had typed is never overwritten.
3. On **Basic**, **Status** offers Draft, Confirmed, Cancelled only (D1-A). There is no **Audit Status** field (D3-A).
4. Fills **Bill No**, containers, desk roles; presses **Create Bill of Lading** → toast _"Bill of Lading created"_; lands on `/lading/<new id>`.
5. Back on the order's record page → **Bills of lading (1)**; pressing it opens `/lading?orderId=<id>` listing that bill (Task 2.2 wires the filter the list already accepts).
Where it lives: the existing order record page (two links), the existing create form (search param, prefill, trimmed options), the existing ledger (one filter).

Old journey, for contrast: documentation noted the order number, opened **Shipment → Add**, scrolled a dropdown of every order in scope (archived and rejected ones included), picked it, then retyped the vessel, ports, dates and numbers the order already held. Status could be set to Released; Audit Status to Approved. Nothing on the order said a bill existed.

**Journey 2 (changed): Documentation uses OCR on the carrier's scan**
1. On **OCR**, uploads the PDF → toast _"OCR extraction complete"_; **Extracted Fields** shows confidence and, new, a list of findings: errors in red, warnings in amber, each naming the field (for example _"Container No: check digit does not match"_) (D11-A, D12-A).
2. With any error present, **Apply to Form** is disabled and an **Apply anyway** checkbox reads _"I have checked the flagged values against the scan"_. Ticking it enables Apply.
3. Apply → toast _"Extracted fields applied to form"_. If the scan had no container table, the container rows already typed stay (Finding F).
Old journey: one "Confidence: N%" line, no findings, Apply always enabled, typed containers wiped when the scan had none.

**Journey 3 (changed): Someone edits a bill that is waiting for a reviewer**
Trigger: a bill has an open submission (today by RPC or the seeder; from step 17 on, by a button).
1. Ops open `/lading/<id>/edit`, change **Vessel**, press Save → the form's existing error toast shows _"This record is under review and cannot be edited. Retract the submission first."_ Nothing is written (D4-A).
2. The submitter retracts (`auditReview.retractByResource`; the seeded lading flow is `withdrawalMode: "direct"`, so the attempt is `withdrawn` at once) → Save succeeds.
Old journey: the save succeeded, and the director approved content they had not read.

**Journey 4 (new refusal): Someone types a job number from another branch**
1. A branch-scoped clerk in branch A types branch B's job number into **Order No** and creates the bill → created, **unlinked**; the record page shows no money for it (D6-A). The audit trail records `orderLink: "unmatched"`.
Old journey: the bill linked to B's order and showed B's receivables to the clerk.

## 3. Result (What Changes for the User)

**Before:** a B/L is typed from scratch after hunting for its order in an unbounded list; its state and review badge are whatever the clerk picks; a submitted bill can still be rewritten; a typed job number can link it to another branch's money; OCR looks verified when it is not.
**After:** a B/L starts from its order with the order's details filled; state comes from the workflow, the badge from the review engine; a bill under review is frozen; a link reaches only orders the clerk can see; OCR says what it doubts.
**Key differences:**
- Documentation: **Raise bill of lading** on the order; fewer fields to type; no **Released** / **On-hold** / **Audit Status** choices; OCR findings shown.
- Ops editing a bill: refused while it is under review, with the reason.
- Directors (reviewers): what they approve is what was submitted.
- Admins: nothing to configure.

## 4. Technical Architecture

### 4.1 Status set by hand (Journey 1 step 3; Phase 1) → D1

New `packages/api/src/modules/lading/status.ts` [NEW]:

```ts
export const SETTABLE_LADING_STATUSES = ["draft", "confirmed", "cancelled"] as const;
/** States the workflow owns, and the verb that owns each (null: no verb writes it). */
const WORKFLOW_OWNED: Record<string, string | null> = {
  "on-hold": "Hold",
  amended: "Amend",
  released: null, // check-out stamps checkedOutAt and leaves status alone (lading.ts:554-559, 526-539)
};
export function assertSettableStatus(status: string | undefined): void; // BAD_REQUEST, see below
```

Messages: `on-hold` / `amended` → _"\"On hold\" is set by the Hold action on the bill's page, not by editing."_ (Amend likewise); `released` → _"\"Released\" cannot be set by hand. Check the bill out from its page; the check-out time is its release record."_; anything else not settable → _"Status must be one of: draft, confirmed, cancelled."_

Called in `create` before the transaction (after `resolveOwningBranchId`). In `update` it runs after the scoped load, and **a `status` equal to the row's current `status` is dropped from `values` first** (an echo, not a change). Only a *change* is checked. This is what stops the edit form's echo of `on-hold` / `amended` from overwriting `statusBefore` (Phase 0, Finding A "New"), and what lets a legacy `released` bill still be edited. The zod field stays `z.string().optional()` so the refusal carries the sentence rather than a zod enum error. `update`'s held/amended re-route (`:1604-1607`) stays for a real change: a settable status sent while held still lands in `statusBefore`.

Web: both `STATUS_OPTIONS` become `["draft", "confirmed", "cancelled"]`. On the edit form, when the loaded status is not settable (`released`, `on-hold`, `amended`, or a legacy string), the **Status** control renders the current value as read-only text with _"Set by the bill's workflow"_ in place of the select. `handleSubmit` (`$id/edit.tsx:665-713`) sends the whole form today; it gains one rule: omit `status` and `owningBranchId` when they equal the loaded record. The server rule above makes the web rule a courtesy, not the guard.

### 4.2 Review cache (Journey 1 step 3; Phase 1) → D3

Delete `auditStatus` from `ladingFields` (`:330`) and `ladingUpdateInput` (`:424`), and `auditStatus: input.auditStatus ?? null` from create's insert (`:1128`; the column default is null). A stale client that still sends it is stripped by zod, so it gets 200 and the cache is untouched. `listInput.auditStatus` (`:442`, the queue filter) stays. Web: remove the **Audit Status** select, its schema key and initial value from both forms (`create.tsx:117, 248, 1292-1307`; `$id/edit.tsx:127, 302, 401, 600, 1558-1570`).

### 4.3 Under-review freeze, lock and transaction boundary in `lading.update` (Journey 3; Phase 1) → D4, D5

Target shape of the handler (line numbers are today's):

```ts
update: … .handler(async ({ context, input }) => {
  const { organizationId } = context.org;
  const { ladingId, containers, ...rest } = input;
  const scope = await applyScope(context.db, context.org, "lading", ladingScopeCols);   // outer read, as today
  await context.db.transaction(async (tx) => {
    const [row] = await tx.select().from(lading)
      .where(and(eq(lading.id, ladingId), scope)).for("update");                      // D5
    if (!row) throw new ORPCError("NOT_FOUND");
    const statusChange = rest.status !== undefined && rest.status !== row.status ? rest.status : undefined;
    if (statusChange !== undefined) assertSettableStatus(statusChange);               // §4.1 (echo dropped)
    const branchChange = rest.owningBranchId !== undefined && rest.owningBranchId !== row.owningBranchId
      ? await resolveOwningBranchId(tx, context.org, rest.owningBranchId)             // §4.4 (D7), changes only
      : undefined;
    await assertNotUnderReview(tx, organizationId, "lading", ladingId);               // D4 (new)
    await assertPostApprovalEditable(tx, organizationId, "lading", ladingId);         // moved from :1554
    // values bag as :1556-1569, with `status` / `owningBranchId` taken from
    // statusChange / branchChange (absent when they are echoes)
    // order resolution as :1587-1602, on tx, through the write-side resolver (§4.5)
    // step 15 Task 3.2's create_lading gate, on tx, unchanged in meaning
    // held/amended re-route as :1604-1607
    // update / container replace / writeAuditRaw as :1610-1646
  });
  return { success: true };
}),
```

`REVIEWABLE_RESOURCES.lading.exists` (`resources.ts:248-254`) gains `.for("update")`, so `submitForReview` takes the same row lock before it inserts the submission. Delete and bulk delete keep their `assertNotUnderReview`; adding their lock is not needed for this plan's finding and is left alone.

**Kept from step 15 Phase 3 (Task 3.2):** the literal `assertGateCleared(…, "collective_order", <id>, "create_lading")` calls in `create` and `update`. `gates.test.ts:67` scans for the literal, so the call must stay a literal; only its first argument changes from `context.db` to `tx`.

This plan's freeze (D4-A) covers `lading.update` only, and this plan writes no attachment code. The attachment writers are governed by step 17 D3-B (crosscheck X21): step 17 Phase 1 freezes `deleteAttachment` under review and after approval, and `uploadAttachment` stays open, so this plan's "`uploadAttachment` under review → 200" test holds.

### 4.4 Branch on update (Phase 1) → D7

`resolveOwningBranchId(tx, context.org, rest.owningBranchId)` inside the transaction, **only when the sent branch differs from the row's** (shape above; `DbExecutor` accepts a transaction). The edit form resends the branch on every save, so validating an unchanged value would refuse every edit by someone whose readable set does not include the bill's current branch (an `own`-scoped member, say). The resolved id replaces the raw one in `values`. `create` is unchanged.

### 4.5 Order resolution for writers (Journey 4; Phase 2) → D6

`modules/lading/resolve-order.ts` gains:

```ts
/** For WRITERS only: the same rules, but an order outside the caller's collectiveOrder data scope
 *  does not exist. `get`/`list` keep resolveLadingOrder / resolveLadingOrders (org-wide). */
export async function resolveLadingOrderForWrite(
  db: DbExecutor,
  org: OrgContext,
  input: { orderId?: string | null; orderNo?: string | null },
): Promise<LadingOrderMatch>;
```

It computes `applyScope(db, org, "collectiveOrder", { organizationId: collectiveOrder.organizationId, owningBranchId: collectiveOrder.owningBranchId, createdBy: collectiveOrder.createdBy })` (the columns are spelled inline; the module must not import `routers/collective-order.ts`) and adds it to both queries. Out-of-scope explicit id → `stale_id` (link null); out-of-scope number → `unmatched`. The ambiguity rule still counts only in-scope rows, so an out-of-scope duplicate cannot reveal itself as `ambiguous`. `create` (`:1048`) and `update` (`:1589, 1593`) switch to it; `get` (`:1395`) and `listLadings` stay on the org-wide resolvers.

### 4.6 Hand-off from order to bill (Journey 1; Phase 2) → D8, D9, D10

- **Server.** `listLadings` applies `if (i.orderId) filters.push(eq(lading.orderId, i.orderId))` beside the `orderNo` filter (`:802`). No other server change.
- **Order record page** (`components/order-ledger/order-record-page.tsx`, actions `:98-126`): a `lading.list({ orderId, limit: 1 })` query (enabled with `lading:read`) gives `total`; render `<Link to="/lading" search={{ orderId }}>` **Bills of lading (n)** and, with `lading:create`, `<Link to="/lading/create" search={{ orderId }}>` **Raise bill of lading**, before **Expenses**. Step 15 Task 1.5 adds an under-review notice beside **Edit order** in the same `actions`; keep it.
- **Ledger** (`routes/_next/lading/index.tsx`): `ladingSearchSchema` (`:71`) gains `orderId: z.string().optional()`, passed to `lading.list`.
- **Create form** (`create.tsx`): `validateSearch: z.object({ orderId: z.string().optional() })` on the route (`:29`). The picker query becomes `collectiveOrder.list({ acceptStatus: "received", archived: false })` (drop the ignored `limit`) (D9-A). If `search.orderId` is set, fetch `collectiveOrder.get({ orderId })`, add it to the options if the list lacks it, pick it once (guarded like the branch auto-select at `:450-457`, so a refetch never re-picks), and prefill. Picking in the select runs the same prefill.
- **Prefill** (D10-A): a pure `prefillFromOrder(form, order): { next, filled: Set<keyof FormState> }` in `routes/_next/lading/-prefill-from-order.ts` [NEW] (the `-` prefix keeps it out of the route tree, as `-lading.columns.tsx` does). Map: `vesselName→vessel`, `voyage→voyage`, `portOfShipment→pol`, `portOfDestination→pod`, `transitPort→transhipmentPort`, `mbl→mblNo`, `hbl→hblNo`, `soNo→bookingNo`, `shipCompany→shippingCompany`, `entrustUnit→entrustUnit`, `tradeTerms→tradeTerm`, `shipper→shipper`, `consignee→consignee`, `etd/eta/atd` (formatted as the form's date inputs expect), `jobNumber→orderNo`. A key is written only when the form value is empty. `filled` drives a "from order" hint under each field; the hint clears when the clerk edits that field. Company pickers (`shipperId`, `consigneeId`) are not prefilled: the order carries names, not directory ids.

### 4.7 OCR findings (Journey 2; Phase 3) → D11, D12

- **Server** (`ocrExtractionForForm`, `lading.ts:2365`): each issue gains `formField?: string` = `OCR_FIELD_MAP[issue.field]`, or `"containers"` when `issue.field === "containers"`. Additive; the return type widens.
- **Web**: `ocrResult` state type (`create.tsx:293-298`) gains `issues: Array<{ code: string; severity: "error" | "warning"; message: string; field?: string; formField?: string }>`. A pure helper `routes/_next/lading/-ocr-issues.ts` [NEW] exports `ocrIssueState(issues) → { errors, warnings, byField: Map<string, Issue[]> , blocksApply: boolean }`. The Extracted Fields grid shows each field's issues under it and unanchored ones in a list; **Apply to Form** is disabled while `blocksApply && !acknowledged`; the **Apply anyway** checkbox resets on every new upload.
- **Container wipe**: `containers: ocrResult.containers?.length ? ocrResult.containers.map(…) : prev.containers`, and the mapped rows keep `packageQty` / `packageType` as empty values.

### 4.8 Data model

**No schema change.** No migration under any Recommended option.

### 4.9 API contracts

| Procedure | Change | New refusals / behaviour |
|---|---|---|
| `lading.create` | `status` checked (§4.1); `auditStatus` removed from input; order resolved through `resolveLadingOrderForWrite` | BAD_REQUEST on a workflow-owned or unknown status; out-of-scope order → unlinked |
| `lading.update` | `status` checked; `auditStatus` removed; `owningBranchId` resolved; load, guards, order resolution and step 15's gate move inside the transaction with `FOR UPDATE`; under-review freeze | BAD_REQUEST (status); FORBIDDEN _"Branch not accessible"_; CONFLICT under review; out-of-scope order → link cleared as today's `stale_id`/`unmatched` |
| `lading.list` / `exportList` | `orderId` filter now applied | – |
| `lading.uploadOcr` | each issue gains `formField?` | – |
| `auditReview.submit` for `lading` | `exists` takes the row lock | – |

Refusal order on `lading.update`: NOT_FOUND → BAD_REQUEST status (a change only) → FORBIDDEN branch (a change only) → CONFLICT under review → CONFLICT approved-and-locked → step 15's `create_lading` CONFLICT. Status and branch are compared with the loaded row, so they run after the scoped load and a foreign id always reads NOT_FOUND first.

### 4.10 Key decisions (all Open; §9 has the three approaches of each)
All twelve were Decided on 2026-09-21, each on option A (§9); the heading is kept as written.
- D1 settable statuses · D2 residue · D3 review cache · D4 freeze coverage · D5 lock and boundary · D6 out-of-scope link · D7 branch on update · D8 hand-off · D9 picker contents · D10 prefill · D11 OCR errors · D12 issue mapping.

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- Step 15 **Phase 3** merged (Wave 10 of `steps-11-15-runbook.md`): its Task 3.2 writes the `create_lading` gate calls into `lading.create` and `lading.update`, which Task 1.2 moves. Step 15 **Phase 1** merged (Wave 7) for `order-record-page.tsx` (Phase 2 only). Step 08 **Task 2.1** merged for the `separationOfDuties` line in the `lading` entry of `resources.ts` (Task 1.2 edits `exists` beside it).
- D1, D3, D4, D5, D7 are Decided (2026-09-21, all A; §9). Read probes 16-P1, 16-P2, 16-P3, 16-P4, 16-P6 before Task 1.1; a probe that contradicts the chosen option stops the task for a re-plan.
- Re-locate every anchor in `lading.ts`, `resources.ts`, `create.tsx`, `$id/edit.tsx` **by symbol** at the base commit.

### Phase 1 — A bill's state and badge come from the workflow and the engine, and a bill under review is frozen (findings A, B, C, H)

**Delivers:** Journey 1 steps 3–4 and Journey 3 end to end.
**Dependencies:** as above. D1, D3, D4, D5, D7.

- **1.1** `modules/lading/status.ts` [NEW] with `SETTABLE_LADING_STATUSES` and `assertSettableStatus` (§4.1); call it in `create` and `update`. Remove `auditStatus` from `ladingFields`, `ladingUpdateInput` and create's insert (§4.2). Files: `packages/api/src/modules/lading/status.ts` [NEW], `packages/api/src/routers/lading.ts`. · **Agent A (backend)**
- **1.2** Rebuild `lading.update` to §4.3: `resolveOwningBranchId` for a sent branch (§4.4); the scoped load `FOR UPDATE` inside the transaction; `assertNotUnderReview` then `assertPostApprovalEditable` on `tx`; order resolution and step 15's `create_lading` literal call on `tx`. Grep the handler first so no guard is added twice. Add `.for("update")` to `REVIEWABLE_RESOURCES.lading.exists`. Allow-list keys in `architecture.test.ts:320-329` do not change (the writes stay in `ladingRouter.update`); confirm by running it. Files: `packages/api/src/routers/lading.ts`, `packages/api/src/modules/audit/resources.ts`. · **Agent A (backend)**
- **1.3** Tests.
  - `lading.test.ts`, new `describe("status is the workflow's")`: create with `released` / `on-hold` / `amended` / `"shipped"` → BAD_REQUEST with the §4.1 sentences and no row; `draft` / `confirmed` / `cancelled` succeed; update likewise; update with `status: "confirmed"` on a held bill → still `on-hold`, `statusBefore = "confirmed"`, and Cancel Hold lands on `confirmed`. **Echo cases:** hold a `confirmed` bill, then `update({ ladingId, status: "on-hold", vessel: "X" })` (what the edit form sends) → 200, vessel saved, `statusBefore` still `confirmed`, and Cancel Hold lands on `confirmed` (fails at `6bb3a1bf`: lands on `on-hold`); a raw-inserted `released` bill updated with `status: "released", remarks: "r"` → 200, status unchanged. Change `:719` and `:724` from `released` to `confirmed` (the test's point, "an edit while held sets what the hold sits on", is unchanged).
  - `describe("the review cache is the engine's")`: create and update with `auditStatus: "approved"` → 200 and `audit_status` null; after `submitForReview` then `decide` passes, `audit_status = "approved"`.
  - `describe("under review")`, in **`packages/api/src/routers/lading.under-review.test.ts` [NEW]**, not `lading.test.ts` (crosscheck X20, following X6's `collective-order.under-review.test.ts` precedent; step 17 Phase 1 later adds its deleteAttachment, `get.underReview`, verbs-not-frozen and `create_lading`-regression cases to this file): seed a submission by raw insert as `audit-review.test.ts:1078-1110` does. `under_review` → `update` (a header field; containers only) CONFLICT, and a re-read of the row, its containers and `audit_log` proves nothing was written; `withdrawal_under_review` → CONFLICT; `rejected`, `withdrawn`, never submitted → 200; `passed` with `postApprovalEditable: false` → CONFLICT with the approved message; foreign-scope id → NOT_FOUND before CONFLICT; `uploadAttachment` under review → 200 (D4-A).
  - `describe("branch on update")`: a branch the member cannot read → FORBIDDEN and the row unchanged; a readable one → moved; the bill's own current branch resent unchanged by a member who cannot read it (`own` scope) → 200 (echo, not validated).
  - Re-run the step 15 Phase 3 cases in `audit-review.test.ts` ("the Order trigger's newest gates": `lading.update` re-link refused under `create_lading`) unchanged.
  - **Real-Postgres concurrency test:** `packages/api/src/routers/lading.concurrency.test.ts` [NEW], modelled on `routers/expense.concurrency.test.ts` (`describe.skipIf(!TEST_URL)`, `createDbClient(TEST_URL)`, per-run org ids) and on step 15's `collective-order.concurrency.test.ts`. Connection A opens a transaction and calls the lading `exists` (now `FOR UPDATE`), then inserts the submission as `submitForReview` does; connection B starts `call(ladingRouter.update, …)` without awaiting; A commits; B → CONFLICT, row unchanged. Run once against the handler without the lock and record that it fails. `DATABASE_URL_TEST` on the dev Neon branch, never production. This plan creates the file (X20); step 17 Phase 2 adds its double check-in, hold-vs-amend and two-uploads `describe`s to it.
  Files: `packages/api/src/routers/lading.test.ts`, `packages/api/src/routers/lading.under-review.test.ts` [NEW], `packages/api/src/routers/lading.concurrency.test.ts` [NEW]. · **Agent A (backend)**
- **1.4** Web. Both `STATUS_OPTIONS` → `["draft", "confirmed", "cancelled"]`. Edit form: a non-settable loaded status renders read-only (§4.1); `handleSubmit` omits `status` and `owningBranchId` when they equal the loaded record (today it sends the whole form, `$id/edit.tsx:667`). Remove **Audit Status** from both forms (§4.2). Grep `apps/web` for `STATUS_OPTIONS`, `auditStatus` in `lading/` and the label "Audit Status" so no third copy survives (the ledger column at `-lading.columns.tsx:760` reads the cache and stays). Files: `apps/web/src/routes/_next/lading/create.tsx`, `apps/web/src/routes/_next/lading/$id/edit.tsx`. · **Agent B (frontend)**
- **1.5** Residue report (D2-A): `packages/db/scripts/audit-lading-state-drift-2026-09.sql` [NEW] with probes 16-P1, 16-P2, 16-P3 as counts plus row lists. Run read-only on the dev branch; paste counts in the PR. Files: that script. · **Agent A (backend)**

**Acceptance.**
- In the browser (§10 Journey 1 steps 3–4, Journey 3): no Released / On-hold / Audit Status on either form; a bill under review refuses Save with the sentence, and saves after retraction.
- `lading.test.ts`, `lading.under-review.test.ts`, `audit-review.test.ts`, `modules/audit/gates.test.ts`, `architecture.test.ts` pass, judged by reading the output for `failed`. `lading.concurrency.test.ts` passes on the dev branch with its tests listed (not skipped) and was seen failing without the lock.
- `e2e/specs/lading.golden-path.spec.ts`, `audit.review-queue.spec.ts`, `audit.withdraw.spec.ts` pass (none sends `status` or `auditStatus`; checked at `6bb3a1bf`).

### Phase 2 — The job hands off to its bill, and a bill links only to an order its clerk can see (findings D, E, G)

**Delivers:** Journey 1 steps 1–2 and 5, Journey 4.
**Dependencies:** Phase 1 merged (hands off `lading.ts`, `create.tsx`). Step 15 Phase 1 merged (`order-record-page.tsx`). D6, D8, D9, D10. Read 16-P5 before Task 2.1 and 16-P7 before Task 2.4.

- **2.1** `resolveLadingOrderForWrite` (§4.5) and its use in `create` and `update`. Files: `packages/api/src/modules/lading/resolve-order.ts`, `packages/api/src/routers/lading.ts`. · **Agent C (backend)**
- **2.2** `listLadings` applies `orderId` (§4.6). Files: `packages/api/src/routers/lading.ts`. · **Agent C (backend)**
- **2.3** Tests. `resolve-order.test.ts`: two branches, a branch-scoped member of A; by number, an order only in B → `unmatched`; by id → `stale_id`; an order in A → `matched` / `explicit`; a duplicate number with one copy in each branch → `matched` to A's (not `ambiguous`); an owner (org scope) still sees `ambiguous`. `lading.test.ts`: `create` as that member typing B's number → created with `order_id` null and trail `orderLink: "unmatched"`; `get` on a bill already linked to B's order still reports `explicit` (read path unchanged); `list({ orderId })` returns only that order's bills. Files: `packages/api/src/modules/lading/resolve-order.test.ts`, `packages/api/src/routers/lading.test.ts`. · **Agent C (backend)**
- **2.4** Web hand-off (§4.6): order record page links; ledger `orderId` search key; create form `validateSearch`, picker input `{ acceptStatus: "received", archived: false }`, preselect from the search param, prefill through `-prefill-from-order.ts` [NEW] with "from order" hints, and a unit test `-prefill-from-order.test.ts` [NEW] (blank-only rule; dates; hint set). The existing copy of `jobNumber` into **Order No** becomes part of the prefill (still written only when **Order No** is empty — today it overwrites; §9 D10 notes this). Files: `apps/web/src/components/order-ledger/order-record-page.tsx`, `apps/web/src/routes/_next/lading/index.tsx`, `apps/web/src/routes/_next/lading/create.tsx`, `apps/web/src/routes/_next/lading/-prefill-from-order.ts` [NEW], `apps/web/src/routes/_next/lading/-prefill-from-order.test.ts` [NEW]. · **Agent D (frontend)**

**Acceptance.**
- §10 Journey 1 steps 1–2 and 5 in the browser; the picker lists no archived or rejected order.
- `resolve-order.test.ts`, `lading.test.ts`, `-prefill-from-order.test.ts` pass; `bun run check-types` passes (read the output).

### Phase 3 — OCR says what it doubts (finding F)

**Delivers:** Journey 2.
**Dependencies:** Phase 2 merged (hands off `create.tsx`, `lading.ts`). D11, D12.

- **3.1** `formField` on each issue (§4.7). `lading.test.ts` `uploadOcr` (`:970+`, its stubbed `documents` port): an issue on `totalGrossWeightKg` carries `formField: "grossWeight"`; one on `containers` carries `"containers"`; one on an unmapped key carries none. Files: `packages/api/src/routers/lading.ts`, `packages/api/src/routers/lading.test.ts`. · **Agent E (full stack)**
- **3.2** Web (§4.7): `issues` in the state type; `-ocr-issues.ts` [NEW] and `-ocr-issues.test.ts` [NEW]; per-field rendering; Apply disabled until acknowledged; container rows kept when the scan has none. Files: `apps/web/src/routes/_next/lading/create.tsx`, `apps/web/src/routes/_next/lading/-ocr-issues.ts` [NEW], `apps/web/src/routes/_next/lading/-ocr-issues.test.ts` [NEW]. · **Agent E (full stack)**

**Acceptance.**
- `-ocr-issues.test.ts`: one error → `blocksApply`; warnings only → not; issues grouped by `formField`.
- Browser: Journey 2 on a server with the AI gateway configured (dev only). Where it is not configured, `uploadOcr` answers SERVICE_UNAVAILABLE (`lading.ts:1933-1938`) and the browser proof is limited to the container-wipe edge case being unreachable; the unit tests carry the rest. Say which in the PR.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1, 1.2, 1.3, 1.5 | `packages/api/src/modules/lading/status.ts` [NEW], `packages/api/src/routers/lading.ts`, `packages/api/src/modules/audit/resources.ts`, `packages/api/src/routers/lading.test.ts`, `packages/api/src/routers/lading.under-review.test.ts` [NEW], `packages/api/src/routers/lading.concurrency.test.ts` [NEW], `packages/db/scripts/audit-lading-state-drift-2026-09.sql` [NEW] | `packages/api/src/modules/audit/gates.ts`, `post-approval.ts`, `submit.ts`, `packages/api/src/routers/audit-review.test.ts`, `packages/api/src/routers/expense.concurrency.test.ts`, `packages/api/src/procedures/org.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.4 | `apps/web/src/routes/_next/lading/create.tsx`, `apps/web/src/routes/_next/lading/$id/edit.tsx` | `apps/web/src/routes/_next/lading/-lading.columns.tsx` |

opus for A: a lock and a transaction boundary moved on a 2,427-line router whose `create`/`update` step 15 also writes, plus a shared engine registry entry.
Run mode: A ∥ B. Contract: the server refuses workflow-owned statuses and ignores `auditStatus`; B's changes are safe whether or not A has landed (the old server accepts the narrower forms).
Serialization point: `bun run check-types` (grep for `error TS` and `failed`), then the Phase 1 suites; restart `:3000` before the browser check (`bun --hot` does not reload `packages/api`).

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | opus | medium | 2.1–2.3 | `packages/api/src/modules/lading/resolve-order.ts`, `packages/api/src/modules/lading/resolve-order.test.ts`, `packages/api/src/routers/lading.ts`, `packages/api/src/routers/lading.test.ts` | `packages/api/src/procedures/org.ts`, `packages/api/src/routers/collective-order.ts` |
| Agent D (frontend) | frontend-engineer | sonnet | medium | 2.4 | `apps/web/src/components/order-ledger/order-record-page.tsx`, `apps/web/src/routes/_next/lading/index.tsx`, `apps/web/src/routes/_next/lading/create.tsx`, `-prefill-from-order.ts` [NEW], `-prefill-from-order.test.ts` [NEW] | `apps/web/src/lib/order-label.ts`, `apps/web/src/components/order-ledger/types.ts` |

opus for C: a data-scope rule on a money-bearing link; the resolver's comments record two past wrong-row bugs.
Run mode: C ∥ D. Contract: `lading.list` input already accepts `orderId`; D's count link shows every bill until C's filter lands, so D's browser check runs after C merges.

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent E (full stack) | general-purpose | sonnet | medium | 3.1, 3.2 | `packages/api/src/routers/lading.ts`, `packages/api/src/routers/lading.test.ts`, `apps/web/src/routes/_next/lading/create.tsx`, `-ocr-issues.ts` [NEW], `-ocr-issues.test.ts` [NEW] | `packages/document-ai/src/registry/types.ts` |

**Schedule:** Phase 1 → Phase 2 → Phase 3, sequential (`lading.ts`, `lading.test.ts`, `create.tsx` pass between phases).
**Handoffs:** `lading.ts` / `lading.test.ts`: A → C → E. `create.tsx`: B → D → E.
**Commits:** the worktree may be shared. One committer at a time; confirm the index is empty before `git add`, and read every hunk.

**Smell test.**
- [x] Every task has exactly one owner.
- [x] No file is owned twice within a phase.
- [x] A ∥ B and C ∥ D have disjoint files and a named contract.
- [x] Every opus is justified; no haiku.
- [x] Each phase completes a journey (3; 1 and 4; 2).

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at `6bb3a1bf`, 2026-09-21)

- **`lading.create`.** Web `create.tsx:353`. RPC: `seed/operations.ts:449` (`ensureLadings`; sends `orderId`/`orderNo` on even rows, no `status`, no `auditStatus`), `e2e/specs/audit.review-queue.spec.ts:121`, `audit.withdraw.spec.ts:127, 234` (owner, `billNo`, `businessType`, branch only). Tests: `lading.test.ts` `create` describe, `audit-review.test.ts` (step 15 Phase 3 cases). None sends a workflow-owned status or `auditStatus`.
- **`lading.update`.** Web `$id/edit.tsx:429` only. Tests `lading.test.ts:453+`, `:716-725` (changes in Task 1.3). No e2e or seed caller.
- **`status` writers elsewhere.** Raw inserts with `status: "released"` in `lading.test.ts:1406-1432, 1852` bypass the router and stay valid fixtures. `lading-presets.test.ts` / `:1693-1715` store `status` as a *filter* value, unaffected.
- **`auditStatus`.** Readers: `listInput` filter (`:442`, `:743-747`), ledger column (`-lading.columns.tsx:760`), `repaintCache` (writer). After Phase 1 the router inputs no longer name it.
- **`REVIEWABLE_RESOURCES.lading.exists`.** Only caller `modules/audit/submit.ts:39`. The lock changes no return shape.
- **`resolveLadingOrder` / `resolveLadingOrders`.** `lading.ts:1048, 1395, 1589, 1593` and the list path; `modules/lading/resolve-order.test.ts`. Phase 2 moves only the two writer calls to the new function.
- **`collectiveOrder.list` from the picker.** Only `create.tsx:175-181` passes `limit` (grep `apps/web` for `collectiveOrder.list.queryOptions({ input: { limit`); the edit form's picker is left as it is.
- **`lading.list` `orderId`.** No current caller sends it (grep `apps/web`, `e2e`, `seed`), so wiring the filter changes no existing result.
- **`uploadOcr`.** Web `create.tsx:302`; test `lading.test.ts:970+`. The widened issue type is additive.
- **`order-record-page.tsx`.** Mounted by every trade record route (`routes/_next/order.*_.$orderId.tsx`). Step 15 Task 1.5 edits its `actions`.

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| Create with Status = Released | 200, reads released | 400 with the check-out sentence; option gone | Web first: option gone, server still accepts over RPC. API first: an old form's Released choice 400s with the sentence. Both safe. |
| Save the edit form on a held bill, then Cancel Hold | 200, then the bill stays **on-hold** | 200, then the bill returns to its base status | API only (the server drops the echo); the web's omit rule is a courtesy. |
| Create/edit with Audit Status = Approved | 200, badge Approved | field gone; RPC value ignored | Either order safe. |
| Edit a bill under review | 200 | 409 | API only. |
| Submit while a save is in flight | interleaves | serialised | API only. |
| Type another branch's job number | linked, money visible | unlinked | API only. |
| Order → its bills | no path | two links | Web needs the Phase 2 API for a correct count. |
| OCR with a failed check digit | silent | shown; Apply needs acknowledgement | Web first: `issues` present but `formField` absent, so findings list unanchored. Safe. |

### 7.3 Behaviour change for existing orgs

- Bills already reading `released`, `on-hold` without a hold, `amended`, or a stray string keep that value; the edit form shows it read-only and does not send it. 16-P1/P2 size them.
- Bills whose `audit_status` was typed keep it until the engine next repaints. 16-P3 sizes them.
- Bills currently under review (16-P4) become read-only on deploy; tell ops "retract before editing".
- Links already made to out-of-scope orders stay (the read path is org-wide). 16-P5 sizes them.
- New create forms list fewer orders (received, not archived). 16-P7 gives the before/after count per org.

### 7.4 Nullable assumptions

- `lading.order_id` nullable (`schema/lading.ts:162`); an unlinked bill is not gated and shows no money.
- `lading.audit_status` nullable with no default (`:190`); removing the create-time write leaves null, which the queue reads as "unsubmitted".
- `lading.status` NOT NULL default `'draft'` (`:46`).
- `collective_order.job_number` nullable; the prefill writes **Order No** only when present.
- `ValidationIssue.field` optional; issues without it render in the unanchored list.

### 7.5 Deployment coupling

Each phase deploys on its own. Phases 1 and 3: either order of server and web is safe (§7.2). Phase 2: server before web, so the count link filters by order from its first render. Build `apps/web` before deploy (memory `alchemy-partial-deploy-splits-the-stage`).

### 7.6 Merge order against steps 04–27

| Plan / task | Shared code | Why step 16 goes after (or before) |
|---|---|---|
| **15 Phase 3 Task 3.2** | `lading.ts` `create` (gate after `resolveLadingOrder`), `update` (gate after `values.orderId`) | Task 1.2 moves the update call into the transaction and Task 2.1 changes the resolver both calls follow. **Must merge first.** Keep both literal `assertGateCleared(…, "create_lading")` calls (`gates.test.ts:67`). |
| **15 Phase 1 Task 1.5** | `order-record-page.tsx` `actions` (under-review notice) | Task 2.4 adds two links in the same block. **Must merge first.** |
| **15 Phase 1 Task 1.3** | `resources.ts` `collective_order.exists` lock | Pattern Task 1.2 copies for `lading.exists`. Must merge first. |
| **08 Task 2.1** | `resources.ts` every entry (`separationOfDuties: false` on `lading`) | Neighbouring line in the entry Task 1.2 edits. Must merge first. |
| 07 Task 3.3, 10 Task 1.2, 14 Task 1.2 | `resources.ts` type and other entries (`assertPublishable?`, `onPassed?`, `readinessProblem?`) | Different entries; rebase by symbol. |
| 08 Task 3.5 | creates `packages/db/scripts/` | Task 1.5 adds a sibling script. |
| 12 | reads `resolve-order.ts` (`usableOrderNo` mirrors `normaliseJobNumber`) | No edit in 12; if 12 changes `normaliseJobNumber`, Task 2.1 keeps the two in step. |
| 02 Task 3.0 | SQL repoint of `lading.shipper_id/consignee_id/notify_party_id` | Data script, no shared code. |
| 13, 14 Phases 2–3 | `order-form.tsx`, `collective-order.ts`, `order.to-receive.tsx` | No file in common. 16 may run beside Wave 11 (14 P3). |
| **17** (`step-17-lading-states-and-review.md`) | `lading.ts` (`update`, a submit path, the state verbs, attachments), `resources.ts` `lading` entry, `create.tsx`, `$id/edit.tsx`, `lading/index.tsx`, `lading.test.ts`, `lading.concurrency.test.ts`, `lading.under-review.test.ts` | **All of 16 before 17 P1** (crosscheck X17, settled 2026-09-21). This plan owns the `update` freeze, `FOR UPDATE` load, in-transaction guards and the `exists` lock; step 17 takes D2-B, greps for them and adds none. Step 17 D8 is superseded by this plan's D1 (X18), its D4 matches D3 (X19), and it extends both new test files (X20). Its submit button is what makes Journey 3 reachable from the UI. |
| 18 (`step-18-bl-document-approval.md`) | document links to ladings | No shared code found at `6bb3a1bf`. |
| 19–27 | fees, bills, invoices, month close read lading money through `cost_line` | Phase 2 changes which order a *new* bill links to; no read path changes. |

**Required order:** 08 → 15 P1 → 15 P3 (as `steps-11-15-runbook.md`) → **16 P1 → 16 P2 → 16 P3** → 17. Suggested as a wave after Wave 10; it has no file in common with Wave 11 (14 P3) and may run beside it.

### 7.7 Read-only production probes (SELECT only; Wilfred runs them with the owner's override; none blocks writing code)

```sql
-- 16-P1 Status against the stamps that should have set it (D1, D2)
select organization_id, status, count(*) as ladings,
       count(*) filter (where status = 'released' and checked_out_at is null) as released_never_checked_out,
       count(*) filter (where status = 'on-hold' and held_at is null)        as on_hold_without_hold,
       count(*) filter (where status = 'amended' and amended_at is null)     as amended_without_amend,
       count(*) filter (where held_at is not null and status <> 'on-hold')   as hold_label_lost,
       count(*) filter (where status_before in ('on-hold', 'amended'))      as base_overwritten_by_echo
from lading
group by 1, 2 order by 1, 2;

-- 16-P2 Status values outside every vocabulary (D1)
select organization_id, status, count(*)
from lading
where status not in ('draft', 'confirmed', 'released', 'cancelled', 'on-hold', 'amended')
group by 1, 2 order by 1, 2;

-- 16-P3 Review cache that disagrees with the latest submission, i.e. typed by hand (D2, D3)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'lading'
  order by resource_id, submitted_at desc, created_at desc)
select l.organization_id, l.audit_status, coalesce(s.status, 'none') as latest, count(*)
from lading l left join latest s on s.resource_id = l.id
where l.audit_status is distinct from case s.status
        when 'under_review' then 'pending' when 'passed' then 'approved'
        when 'rejected' then 'rejected' when 'withdrawal_under_review' then 'withdraw_pending'
        when 'withdrawn' then 'withdrawn' end
group by 1, 2, 3 order by 1, 2, 3;

-- 16-P4 Bills by latest submission, and edits made while a submission was open (D4, D5)
with latest as (
  select distinct on (resource_id) resource_id, status
  from audit_submission where resource_type = 'lading'
  order by resource_id, submitted_at desc, created_at desc)
select l.organization_id, coalesce(s.status, 'never_submitted') as latest, count(*)
from lading l left join latest s on s.resource_id = l.id
group by 1, 2 order by 1, 2;

select s.organization_id, count(distinct s.id) as submissions_edited, count(*) as edits
from audit_submission s
join audit_log a on a.target_type = 'lading' and a.target_id = s.resource_id
                and a.action = 'lading.update'
                and a.created_at > s.submitted_at
                and a.created_at < coalesce(s.resolved_at, now())
where s.resource_type = 'lading'
group by 1 order by 1;

-- 16-P5 Bills linked to an order in a different branch, and who could have typed them (D6)
select l.organization_id, count(*) as cross_branch_links
from lading l join collective_order co on co.id = l.order_id
where co.owning_branch_id <> l.owning_branch_id
group by 1 order by 1;

select r.name as role, ds.resource, ds.scope_code, count(*)
from data_scope ds join role r on r.id = ds.role_id
where ds.resource in ('lading', 'collectiveOrder')
group by 1, 2, 3 order by 1, 2, 3;

-- 16-P6 Bills whose branch is not a branch of their own organisation (D7)
select l.organization_id, count(*)
from lading l join team t on t.id = l.owning_branch_id
where t.organization_id <> l.organization_id
group by 1;

-- 16-P7 What the create picker lists today vs under D9-A, per org
select organization_id,
       count(*) as listed_today,
       count(*) filter (where accept_status = 'received' and archived = false) as listed_under_d9a
from collective_order
group by 1 order by 1;

-- 16-P8 Orders carrying more than one bill (adjacent 3: footer double count)
select organization_id, count(*) as orders_with_many_bills, max(n) as most_bills
from (select organization_id, order_id, count(*) as n
      from lading where order_id is not null group by 1, 2 having count(*) > 1) x
group by 1;

-- 16-P9 Duplicate bill numbers per org (adjacent 2)
select organization_id, bill_no, count(*)
from lading group by 1, 2 having count(*) > 1 order by 3 desc limit 50;

-- 16-P10 Party and desk-role ids pointing outside the bill's organisation (adjacent 1)
select l.organization_id, count(*) as cross_org_parties
from lading l
join company c on c.id in (l.shipper_id, l.consignee_id, l.notify_party_id)
where c.organization_id <> l.organization_id
group by 1;

select l.organization_id, count(*) as cross_org_members
from lading l
join member m on m.id in (l.sales_id, l.operator_id, l.service_personnel_id, l.associated_personnel_id,
                          l.document_person_id, l.commercial_person_id, l.related_second_person_id)
where m.organization_id <> l.organization_id
group by 1;
```

Column names were read from the Drizzle schema at `6bb3a1bf` (`schema/lading.ts`, `audit.ts:348-415`, `audit-log.ts:10-31`, `permissions.ts:55-67`); `company.organization_id`, `team.organization_id` and `role.name` are assumed from their use in step 15's probes and better-auth's tables, and are re-read before running.

### 7.8 Blocking prerequisites

- Step 15 Phases 1 and 3 and step 08 Task 2.1 merged — blocks all tasks.
- Decisions: all settled 2026-09-21 (D1–D12 A), so none blocks a phase any more. For the record, D1, D3, D4, D5, D7 released Phase 1; D6, D8, D9, D10 Phase 2; D11, D12 Phase 3; D2 only Task 1.5.
- Probe re-checks (the chosen option stands; a contradiction stops the task for a re-plan): 16-P1, P2 before Task 1.1 (D1); 16-P3 before Task 1.1 (D3); 16-P4 before Task 1.2 (D4, and the ops notice); 16-P6 before Task 1.2 (D7); 16-P5 before Task 2.1 (D6); 16-P7 before Task 2.4 (D9).
- `DATABASE_URL_TEST` for a dev Neon branch — blocks Phase 1 acceptance (concurrency test).

## 8. Cross-Cutting Concerns

- **Errors.** Input refusals are `ORPCError("BAD_REQUEST")` with a sentence that names the action to use; state refusals are CONFLICT with the engine's existing sentences; the branch refusal is `resolveOwningBranchId`'s FORBIDDEN. Both forms already toast `err.message` (`create.tsx:370`, `$id/edit.tsx:451`).
- **Testing.** PGlite router and module suites at the API boundary (the under-review cases in `lading.under-review.test.ts` [NEW], X20); pure web helpers (`-prefill-from-order`, `-ocr-issues`) under vitest; the row lock only on real Postgres (`lading.concurrency.test.ts`); e2e `lading.golden-path.spec.ts`, `audit.review-queue.spec.ts`, `audit.withdraw.spec.ts`; browser proof in §10.
- **Migration.** None.
- **Rollback.** Every phase is a plain revert: no phase writes data, and no new stored value depends on the code (D1 and D3 only narrow inputs; the lock and freeze are code). Task 1.5's script is read-only.
- **Audit trail.** Refusals write nothing. `lading.update`'s trail row still records `orderLink`; under D6-A an out-of-scope match reads `unmatched`, which is what the clerk may know.
- **Permissions.** No node added or removed. The order record page links are gated on `lading:read` / `lading:create` from `org.members.me` as the create form already does (`create.tsx:146-151`).

**Performance & Scalability**
1. **Pagination.** The create picker drops from "every order in scope" to "received, not archived" (still unpaginated; 16-P7 says whether that is enough — if not, D9-B/C or a search picker is a follow-up).
2. **SQL-side filtering.** The new `orderId` filter uses `lading_orderId_idx` (`schema/lading.ts:250`). The scope predicate in `resolveLadingOrderForWrite` adds an `owning_branch_id IN (…)` to a lookup by id or by `job_number` (partial unique index from migration 0061).
3. **N+1.** None. The record page adds one `lading.list({ orderId, limit: 1 })`; the create form adds one `collectiveOrder.get` when an order is picked.
4. **Index coverage.** Latest-submission reads use the existing `auditSubmission_resource_idx` (`audit.ts:413`).
5. **Write atomicity.** `lading.update`'s guards, order resolution and gate move inside its transaction.
6. **Row locking.** `FOR UPDATE` on the lading row in `update` and in `exists` at submit; one save, sub-second.
7. **Connections.** None new.
8. **Tenant isolation.** Branch on update now checked (D7); order links scoped (D6). Every added query filters `organization_id`.
9. **Payload size.** `uploadOcr` issues gain one short string each.
10. **Hot path.** `lading.update` gains one indexed latest-submission read and a row lock; `lading.create` unchanged in cost.

## 9. Decision Register, Open Questions & Risks

**Statuses.** On 2026-09-21 Wilfred accepted the Recommended option of **every** decision below, and every cross-plan settlement in `steps-16-19-crosscheck.md` (X17–X27), so all twelve are **Decided**, each on A. No X-item overrides a recommendation here; X21 narrows D4 to `lading.update` (step 17 D3 governs the attachment writers). Each entry keeps its three approaches and its consequence table, so any of them can be re-opened by reading what was rejected; the "If not A" lines are kept as history. Where a decision leans on a production probe, the **Re-check** line names it: the choice stands, but the check is still required before the task that depends on it, and a contradiction stops the work for a re-plan.

**D1: Which statuses may a person set by hand?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Tasks 1.1, 1.3, 1.4

| | Approach | Consequence |
|---|---|---|
| **A** | `draft`, `confirmed`, `cancelled` only; `on-hold` / `amended` refused naming Hold / Amend; `released` refused pointing at Check Out; unknown strings refused (Recommended) (Chosen) | The gated verbs are the only way into gated states. **Released** is no longer a status anyone can reach; a released bill is one with `checkedOutAt`, which the record page already shows. Existing `released` rows keep the label (read-only on edit). |
| **B** | As A, but check-out also writes `status = "released"` (through `statusAfter`) and cancel-check-out restores the base | "Released" stays a visible state with a real writer. Changes `applyWorkflow`/`statusAfter`, which step 17 owns, and the ordering rules between hold, amend and release documented at `lading.ts:515-539`. Larger, and belongs in step 17's plan. |
| **C** | Keep free text; refuse only `on-hold` and `amended` | Smallest change; `released` stays a free label that fakes a release the tenant may have gated; arbitrary strings still land. |

- **Recommendation: A.** It closes the filed hole without touching the workflow; B can follow in step 17 if Wilfred wants a Released label.
- **If not A:** B moves Task 1.1's `released` rule into step 17 and adds a `statusAfter` change and tests; C drops the unknown-string refusal and the `released` rule.
- **Re-check:** 16-P1, 16-P2.

**D2: What happens to rows that are already wrong (status, review cache, out-of-scope links)?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.5

| | Approach | Consequence |
|---|---|---|
| **A** | Report only: a read-only script with counts and row lists (Recommended) (Chosen) | Nothing is changed without a person looking; matches step 08 D5-A and step 15 D13-A. |
| **B** | Report, then an owner-run reviewed repair script (status back to `statusBefore`/`draft`, cache repainted from the latest submission, links cleared) | Faster cleanup; each repair changes what a bill shows, including money for cleared links. Needs its own review. |
| **C** | Repair in a migration `00NN_lading_state_repair` | Runs everywhere automatically, including rows someone set deliberately; hardest to undo. |

- **Recommendation: A.**

**D3: What happens to the review cache on the writers?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Tasks 1.1, 1.4

| | Approach | Consequence |
|---|---|---|
| **A** | Remove `auditStatus` from both inputs and both forms; a stale client's value is stripped silently (Recommended) (Chosen) | Only the engine writes the cache, as for quotations. A forged value cannot arrive. |
| **B** | Keep the key; refuse any non-empty value with BAD_REQUEST | Loud for a stale client; one more input to maintain. |
| **C** | Keep the key and the field, read-only on the form | Display duplicates the ledger's review column; the RPC hole stays. |

- **Recommendation: A.** No current caller sends it (§7.1).

**D4: What does the under-review freeze cover?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Tasks 1.2, 1.3

| | Approach | Consequence |
|---|---|---|
| **A** | All of `lading.update`, containers included; attachments (`uploadAttachment` / `deleteAttachment`) stay writable (Recommended) (Chosen) | Matches delete and the engine's rule. Paperwork can still be added while the director reads, the same carve-out step 15 D2-B makes for fees. |
| **B** | As A plus attachments | Strictest; a carrier's corrected scan cannot be filed until the review ends. |
| **C** | Wait for step 17 to add a submit path, and freeze then | Leaves the RPC and seeder path open meanwhile; step 17 inherits the work. |

- **Recommendation: A.**
- **Settled reading (X21):** A covers `lading.update` only. The attachment half of the row above is superseded by step 17 D3-B: `deleteAttachment` freezes under review and after approval (step 17 Phase 1), `uploadAttachment` stays open. This plan writes no attachment code either way.
- **Re-check:** 16-P4 (how often bills are edited mid-review today).

**D5: How are a save and a submit kept apart?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.2

| | Approach | Consequence |
|---|---|---|
| **A** | Load, guards, order resolution and step 15's gate inside the transaction, with `FOR UPDATE` on the lading row in `update` and in `lading.exists` (Recommended) (Chosen) | Submit and save serialise, as orders do after step 15 D10-A; step 15's read-then-write risk on re-link closes too. Proven only on real Postgres. |
| **B** | Move everything inside the transaction, no lock | Narrows the window but does not close it under READ COMMITTED. |
| **C** | Leave the boundary as it is | The freeze can be raced; step 15's risk stays open. |

- **Recommendation: A.**

**D6: What happens when a B/L names an order outside the clerk's scope?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Tasks 2.1, 2.3

| | Approach | Consequence |
|---|---|---|
| **A** | The writers resolve through the caller's order scope; an out-of-scope number reads `unmatched`, an out-of-scope id `stale_id`; the bill is created unlinked (Recommended) (Chosen) | No money crosses the scope; nothing tells the clerk the order exists. Same no-error behaviour as a number typed before its order exists. |
| **B** | Refuse with BAD_REQUEST "No order you can see carries job number X" | Clearer to the clerk; the refusal is also what an unmatched number would get, so either every unmatched number refuses (breaks "typed early" bills and the seeder's odd rows) or the message leaks existence. |
| **C** | Leave org-wide | The leak stays for every branch-scoped role. |

- **Recommendation: A.**
- **Re-check:** 16-P5.

**D7: Can `lading.update` move a bill to any branch?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 1.2

| | Approach | Consequence |
|---|---|---|
| **A** | Validate a *changed* `owningBranchId` with `resolveOwningBranchId`, as create does; an unchanged echo is not checked (Recommended) (Chosen) | Same rule on both writers; FORBIDDEN for moving to an unreadable branch; ordinary saves unaffected even though the form resends the branch. |
| **B** | Remove `owningBranchId` from the update input (branch fixed at create) | Simplest; stops legitimate moves between the clerk's own branches, and the edit form's branch field would need removing. |
| **C** | Leave it | Another org's branch id can be written over RPC. |

- **Recommendation: A.**
- **Re-check:** 16-P6.

**D8: How does the order hand off to its bills?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 2.4

| | Approach | Consequence |
|---|---|---|
| **A** | On the order record page, **Bills of lading (n)** → `/lading?orderId=` and **Raise bill of lading** → `/lading/create?orderId=` (Recommended) (Chosen) | Both directions in two links; the existing ledger and form do the rest. Needs Task 2.2's filter. |
| **B** | Only **Raise bill of lading** | Half the break: a clerk still cannot see whether the job already has a bill, which is how duplicates start (16-P9). |
| **C** | A "Bills of lading" section inside the order edit form | Puts document work inside the order's form (step 14's screen), which it does not own; more code. |

- **Recommendation: A.**

**D9: What does the create form's order picker list?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 2.4

| | Approach | Consequence |
|---|---|---|
| **A** | Received and not archived (`acceptStatus: "received", archived: false`) (Recommended) (Chosen) | Drops the trash and intake-rejected orders the SOP says a B/L follows; the step 15 gate still decides approval in gated orgs. |
| **B** | Every order in scope, as today | Unbounded and includes dead orders. |
| **C** | Approved orders only | Matches step 15's gate in gated orgs but hides every order in ungated orgs until someone submits it, which step 15 does not require. |

- **Recommendation: A.**
- **Re-check:** 16-P7.

**D10: How are the order's details carried to the B/L?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 2.4

| | Approach | Consequence |
|---|---|---|
| **A** | Fill only empty fields, each marked "from order"; **Order No** likewise (today the pick overwrites it) (Recommended) (Chosen) | Nothing the clerk typed (or OCR applied) is lost; the marks say where a value came from. |
| **B** | Overwrite every mapped field on pick | Simple and consistent with the order, but silently replaces OCR values taken from the carrier's scan, which is the document of record. |
| **C** | No prefill; show the order's values beside each field with a copy button | Most control, most clicks; more UI. |

- **Recommendation: A.**

**D11: What does an OCR error do to Apply?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Task 3.2

| | Approach | Consequence |
|---|---|---|
| **A** | Show every finding against its field; with any error, Apply needs an **Apply anyway** tick (Recommended) (Chosen) | The clerk sees the doubt and must say they checked; warnings never block. |
| **B** | Show findings only | Visible but skippable at speed. |
| **C** | Block Apply outright while any error exists | A misread check digit on one container blocks every other good field; the clerk retypes everything. |

- **Recommendation: A.**

**D12: Where are OCR findings mapped to form fields?** · Status: **Decided 2026-09-21 — Chosen: A** · Blocks: Tasks 3.1, 3.2

| | Approach | Consequence |
|---|---|---|
| **A** | On the server: each issue gains `formField` from `OCR_FIELD_MAP` (Recommended) (Chosen) | One map, beside the code that already uses it. |
| **B** | Export `OCR_FIELD_MAP` and map in the web | Web imports a router constant; two places to keep in step. |
| **C** | Do not map; list findings unanchored | Simplest; the clerk has to work out which field each concerns. |

- **Recommendation: A.**

### Risks

- **Bills under review become read-only on the Phase 1 deploy.** Likely wherever the seeder or e2e ran; low in production until step 17. → **16-P4 gives the count; announce "retract before editing".**
- **A `released` label disappears from the choices while old rows keep it.** Certain. → **Edit form shows it read-only; D1-B is the route back to a real Released state.**
- **Line numbers drift under steps 08 and 15.** Certain. → **Every task locates by symbol; Task 1.2 greps for step 15's gate literal before moving it.**
- **PGlite cannot prove the lock.** Certain. → **`lading.concurrency.test.ts` on the dev branch, seen failing without the lock.**
- **The narrower picker hides an order a clerk legitimately needs** (for example one received after the form loaded). Low. → **The form's query refetches on focus; D9-B is the fallback.**
- **The prefill writes a date in the wrong zone.** Medium. → **`-prefill-from-order.test.ts` pins the conversion to the form's own date format; the browser check compares against the order's page.**
- **OCR proof in the browser needs the AI gateway.** Likely absent locally. → **Unit tests carry Phase 3; the PR states whether the browser run used a configured dev server.**
- **A stale `:3000` server passes browser checks on old code.** High. → **Restart after every `packages/api` change.**

### SOP text vs code (Phase 0 wins)

| # | SOP / finding claims | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| 1 | Guide: tabs are Basic, Route & Parties, Cargo & Terms, **Containers, Administration**, OCR | Order is Administration **before** Containers (`create.tsx:533-547`) | Code |
| 2 | Break `after: 15`: "a flat **200-row** dropdown" | `limit: 200` is stripped (no `limit` in `orderListInput`); the list is unbounded and includes archived and rejected orders | Code (D9); the guide's "no row limit" is right |
| 3 | Guide: Order No "matched as an exact string" | Trimmed first; matched org-wide, not in the clerk's scope; ignored when **Linked order** is picked (explicit id wins) | Code (D6) |
| 4 | Guide role "Documentation · needs lading:read plus create rights" | No documentation role; `lading.create` is held by owner, admin, branch-manager, ops; OCR also needs `lading.detail.ocr-import` | Code |
| 5 | Guide: "the member pickers link real members" | True in the UI; the server does not check the ids belong to the org | Code (adjacent 1) |
| 6 | Guide cites `create.tsx:669` for Route & Parties | `:669` is on **Basic**; Route & Parties starts `:707` (POL label `:710`) | Code |
| 7 | Fix 1: Cancel Hold refuses at `lading.ts:585` | The refusal is `:590`; `:585` is the hold patch | Code |
| 8 | Fix 1 repair: "the only way into them is checkOut / hold / amend" | Check-out never writes `released` (`:554-559`, `statusAfter` `:526-539`) | Code (D1) |
| 9 | Fix 1: status options are the five in the dropdown | The server accepts **any** string (`z.string()`, `:265, 359`) | Code (D1) |
| 9b | Fix 1 repair: "narrow the create/update zod field to `z.enum([…])`" | The edit form resends the current status on every save (`$id/edit.tsx:348, 667, 690`), so a plain enum would refuse every edit of a held, amended or released bill; and the echo already corrupts `statusBefore` today | Code (§4.1 echo rule) |
| 10 | Fix 2: under-review editing "stays fully editable" | True, and reachable today only by RPC (no submit screen; specs and seeder submit) | Code (D4) |
| 11 | Fix 3: render issues "against their fields" | `issue.field` is the extraction key, not the form key; needs `OCR_FIELD_MAP` | Code (D12) |
| 12 | Fix 3 (not mentioned) | Apply wipes typed containers when the scan has none (`create.tsx:334-342`) | Code (Phase 3) |
| 13 | Fix 4: "Linking the **approved** order" | Nothing requires the order to be approved until step 15 Phase 3's gate, and only where ticked | Code |
| 14 | Guide "Before": the order is received | Nothing checks it; the picker lists unreceived, rejected and archived orders | Code (D9) |
| 15 | Not in the SOP | **Audit Status** is a free field on both forms (Finding B) | Code (D3) |

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000. One worktree's servers at a time.
**Preconditions:**
- A freshly seeded audit e2e org: `bun --preload ./apps/server/cf-shim.mjs e2e/fixtures/seed-cli.ts seed <runId>`. At `6bb3a1bf` `ACTORS` are owner, directorA, directorB, accountant, salesperson, managerA, managerB, viewer, in **one** branch (`seed-cli.ts:67-68, 78-99`). Re-read at the base commit (the file has later e2e commits).
  - **B/L clerk: `managerB`** (branch-manager: `lading` full CRUD, `lading.detail` subtree incl. OCR).
  - **Submitter: `managerA`**; **reviewer: `directorA`** (the seeded lading stage role).
- An order **O1** created and received as `managerA`, with job number, vessel, voyage, POL, POD, ETD, MBL and shipper set; an archived order **O2** and an intake-rejected order **O3**.
- Confirm the actor with `fetch('/api/auth/get-session')` before each actor's steps. Restart `:3000` after the last `packages/api` edit.

**Migrations:** none. Confirm the journal is where the merged steps left it (check `_journal.json` and the database, not an exit code).

**Test commands** (read the output for `failed` and the `Test Files` line; `bun run check-types` can exit 0 while printing "failed"):
- Phase 1: `bunx vp test run packages/api/src/routers/lading.test.ts packages/api/src/routers/lading.under-review.test.ts packages/api/src/routers/audit-review.test.ts packages/api/src/modules/audit/gates.test.ts packages/api/src/architecture.test.ts`, then `DATABASE_URL_TEST=<dev branch URL> bunx vp test run packages/api/src/routers/lading.concurrency.test.ts` (tests listed as passed, not skipped).
- Phase 2: `bunx vp test run packages/api/src/modules/lading/resolve-order.test.ts packages/api/src/routers/lading.test.ts apps/web/src/routes/_next/lading/-prefill-from-order.test.ts`
- Phase 3: `bunx vp test run packages/api/src/routers/lading.test.ts apps/web/src/routes/_next/lading/-ocr-issues.test.ts`
- Every phase: `bun run check-types`; e2e `lading.golden-path.spec.ts`, `audit.review-queue.spec.ts`, `audit.withdraw.spec.ts`.

**Golden path — Journey 1 (Phases 1–2; `managerB`)**
1. Open O1's record page (from `/order/sea-export`, **Open full page**) → **Bills of lading (0)** and **Raise bill of lading** are visible.
2. Press **Raise bill of lading** → URL is `/lading/create?orderId=<O1>`. **Administration → Linked order** shows O1; **Order No** shows its job number. **Basic → Vessel / Voyage** and **Route & Parties → POL / POD** show O1's values with "from order"; MBL No shows O1's MBL.
3. Open **Linked order** → O2 (archived) and O3 (rejected) are not listed.
4. **Basic → Status** lists Draft, Confirmed, Cancelled only. **Administration** has no Audit Status field.
5. Type Bill No `BL-S16-1`, add container `CMAU1234565`, press **Create Bill of Lading** → toast _"Bill of Lading created"_; URL `/lading/<id>`.
6. Back on O1's record page → **Bills of lading (1)**; press it → `/lading?orderId=<O1>` lists `BL-S16-1` only.

**Golden path — Journey 3 (Phase 1)**
1. As `managerA`, in the console POST `/rpc/auditReview/submit` `{ resourceType: "lading", resourceId: <BL-S16-1 id> }` → 200.
2. As `managerA`, open `/lading/<id>/edit`, change **Vessel** to `S16 CHANGED`, Save → error toast _"This record is under review and cannot be edited. Retract the submission first."_ Reload → Vessel unchanged.
3. POST `/rpc/auditReview/retractByResource` for the bill → 200 (seeded lading flow is `direct`; if the org's flow asks for withdrawal approval, `directorA` approves it in `/approve/lading`). Save again → success; the new vessel persists on reload.

**Golden path — Journey 2 (Phase 3; dev server with the AI gateway configured)**
1. `/lading/create` → **OCR**, upload a B/L PDF with a known bad container check digit → **Extracted Fields** shows the finding under Container No in red; **Apply to Form** is disabled.
2. Tick **Apply anyway** → Apply enabled; press it → _"Extracted fields applied to form"_.

**Edge case 1: workflow-owned status over RPC.** In the console, POST `/rpc/lading/create` with `status: "released"` → 400 with the check-out sentence; with `status: "on-hold"` → 400 naming Hold; `/lading` has neither bill.
**Edge case 2: forged review cache.** POST `/rpc/lading/create` with `auditStatus: "approved"` → 200; the ledger's review column for it is empty, and it appears under the queue's "not yet submitted" filter.
**Edge case 2b: saving a held bill (Phase 1).** As `managerB`, on `BL-S16-1` (retracted, Draft) press **Hold** on `/lading/<id>`; open the edit form → Status shows **On hold — set by the bill's workflow**; change Remarks, Save → success. Back on `/lading/<id>`, **Cancel Hold** → status reads **Draft**, not On hold. (At `6bb3a1bf` this ends on On hold.)
**Edge case 3: a legacy released bill.** On the dev branch only, pick a bill with `status = 'released'` (16-P1) or, in the seeded org, set one by raw SQL. Its edit form shows **Released — set by the bill's workflow** read-only; change Remarks and Save → success, status still `released`.
**Edge case 4: OCR with no containers.** Type two container rows, upload a scan with no container table, Apply → both rows remain (browser where the gateway is configured; otherwise `-ocr-issues.test.ts` / a pure test of the containers merge).
**Edge case 5: another branch's job number (Phase 2).** Needs a second branch: as `owner`, create branch B and an order there with job number J-B; as `managerB` (branch A only), create a bill typing J-B in **Order No** → created; its record page shows no receivable and `lading/get` reports `orderLink: "unmatched"`. If a second branch cannot be set up, this is proven by Task 2.3 only; say so in the PR.
**Edge case 6: submit/save race.** Real Postgres only (`lading.concurrency.test.ts`), judged by final state, never by timestamps (`submitted_at` and `audit_log.created_at` are transaction-start times).

**Regression checks.**
1. `e2e/specs/lading.golden-path.spec.ts` (create across all tabs, read, edit, read) passes.
2. Check In / Check Out / Hold / Cancel Hold on `/lading/<id>` behave as before, and a hold still sits on the status an edit sets.
3. `/approve/lading` lists and decides a submitted bill (`audit.review-queue.spec.ts`, `audit.withdraw.spec.ts`).
4. With step 15's `create_lading` ticked, linking an unapproved order on create or edit is still refused with its sentence.
5. `/lading` filters by Order No text as before.

**Mobile:** at 400px the order record page's action links wrap without horizontal scroll; the create form's "from order" hints and the OCR findings list wrap under their fields.

**Readiness: 7/10 — the defects are verified at the code and the phases are small; every decision is settled (2026-09-21), but two plans must merge first and the probes are unrun.** Every guard, caller, schema column, role grant and test pin cited was read at `6bb3a1bf`. Outstanding:
- Decisions: none open. D1–D12 Decided A; X17–X27 Settled (the ownership with step 17 is fixed by X17–X22).
- Hard dependency on step 15 Phases 1 and 3 and step 08 Task 2.1, which rewrite neighbouring code; anchors must be re-located after they land.
- Live impact is unmeasured until 16-P1 to 16-P7 run; three probe tables' `organization_id` / `name` columns are assumed and must be re-read.
- The lock proof needs a dev Neon branch; the OCR browser proof needs a configured AI gateway; the scope edge case needs a second branch. Journey 3 is reachable from the UI only once step 17 Phase 1 ships its Review menu (Wave 15).

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and every recommended settlement in `steps-16-19-crosscheck.md` (X17–X27). Each §9 entry keeps all three approaches; only the status, the Chosen marks and the text that described a decision as open were changed.

**Chosen:** D1-A · D2-A · D3-A · D4-A · D5-A · D6-A · D7-A · D8-A · D9-A · D10-A · D11-A · D12-A.

**Crosscheck settlements, as they land in this plan.** X17 → this plan alone owns the `lading.update` freeze, `FOR UPDATE` load, in-transaction guards, step 15's moved gate call and the `lading.exists` lock (header, §7.6 row 17); step 17 takes D2-B. X18 → D1 governs the status vocabulary for both plans and the echo rule stays in Task 1.1; step 17 D8 is superseded by it. X19 → D3 removes Audit Status; step 17 D4 is settled the same way and drops its part. X20 → Task 1.3 creates `lading.concurrency.test.ts` and puts the under-review cases in `lading.under-review.test.ts` [NEW] instead of `lading.test.ts` (§5, §6, §8, §10). X21 → D4 covers `lading.update` only; step 17 D3-B governs the attachment writers (§4.3, D4). X22 → §4.9's refusal order is the one both plans use. X25 → Task 1.5's script keeps 16-P3; step 17's drops 17-P3. X26 → any revived conditional migration (D2-C only) is `00NN_<name>`, numbered at merge. X24, X27 → accepted gaps; the SOP corrections in §9 stay unowned. **No X-item overrode a recommendation in this plan.**
