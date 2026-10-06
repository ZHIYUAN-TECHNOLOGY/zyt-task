# zyt-update GATE 1: ZYT-Task/customer-intake-sop, Wave 1 (2026-10-06)

This is a draft only. Nothing has been applied, rebuilt or deployed.

- **Changeset:** `customer-intake-sop/.zyt/pending-2026-10-06-wave1.json` (source `session`, 41 ops)
- **Code root:** `C:/Project/NCT/.deploy-prod`, release `b6647798`, the code prod runs. The registry codeRoot `wt-release-r1` is at `114b7437`, before Wave 1. The registry was not changed. Staleness and reanchor were run against a scratch copy of the registry that points at `.deploy-prod`.
- **Tiers:** 15 auto (re-anchors), 17 confirm (text edits), 9 needs-human (3 screenshots, 4 proposed new content, 2 follow-ups).
- **evidence-verify:** 41 kept, 0 rejected, 0 lines rewritten.
- **sop-patch `--dry --check-old --accept all`:** 32 would apply (15 auto + 17 confirm), 9 skipped (needs-human), 0 refused. Validation is ok, with 0 errors and 0 warnings. Nothing was written.

**Dependency.** `/steps/13/what` already carries another session's uncommitted edit from 2026-10-04 (the Attachments sentence, `pending-2026-10-04.json`, `update-2026-10-04.md`). The `old` of op w1-001 includes that edit. If that edit is reverted before this changeset is applied, w1-001 fails `--check-old`.

## Rule conflicts → proposed ledger items

None. The page has no `rules[]` (`rules.mjs list` → "no rules"), and staleness raised no `rule-at-risk` flag.

## Guide text edits (confirm)

| Op | Step | Path | Before → after |
|---|---|---|---|
| w1-001 | 14 | /steps/13/what | Before: "shipping space (vessel, voyage, ETD, ETA, ETB, cut-off)". After: "shipping space (ETD, ETA, cut-off; on sea import, sea export and LCL a **Vessel** group with vessel, voyage, Customs vessel ID, SCN, ETB, ATB, ETA, ATA and Discharged)" |
| w1-002 | 14 | /guide/13/golden/2/action | Same schedule list, plus "on sea export, sea import and LCL the vessel has its own **Vessel** group" |
| w1-003 | 14 | /guide/13/golden/2/detail | Before: trade-specific fields only. After: the Vessel group fields; actuals cannot be in the future (exact refusal text); only an ATB completes **ETB / ATB**, and a past ETB alone reads **Expected <date> · not confirmed**; the remaining trade fields |
| w1-004 | 14 | /guide/13/fields/2/label | Before: "ETD / ETA / ATD / ATA / Cut-off time / Closing time". After: adds "ATB / Discharged" |
| w1-005 | 14 | /guide/13/fields/2/note | Before: "Dates". After: "Dates. ATB, ATA and Discharged are actuals and cannot be in the future" |
| w1-006 | 18 | /guide/17/writes/0 | Before: "…on approval — a BL tracking job". After: adds ", linked to its order when exactly one order matches" |
| w1-007 | 19 | /steps/18/what | Before: "the 72-hour countdown starts itself at berth". After: "the provisional 72-hour gate-out clock (berth + 72h) starts itself at berth" |
| w1-008 | 19 | /steps/18/watch/html | Before: "Tracking jobs still store no order… by B/L number". After: approval links the job to its order when exactly one order matches; otherwise the job is **Not linked to an order** and falls back to the B/L match until someone presses **Link order**. The "Match not certain" and checks-off text is kept |
| w1-009 | 19 | /guide/18/role | Adds **Keep container records and link jobs to orders** (Owner, Admin, Branch manager, Ops by default) |
| w1-010 | 19 | /guide/18/golden/0/detail | Column "72h Countdown" → "Provisional · berth + 72h". This also clears the staleness `label-missing` flag |
| w1-011 | 19 | /guide/18/golden/2/action | "Read the **72h Countdown**" → "Read the **Provisional · berth + 72h** clock" |
| w1-012 | 19 | /guide/18/golden/2/detail | Adds: the clock is provisional. Each container's own **Last free day** (typed from the line's notice, or from a confirmed rule, else **Pending confirmation**) is on the **Containers** card |
| w1-013 | 19 | /guide/18/golden/4/detail | Before: "Order (found by B/L number)". After: a Containers card (type, seal, port status, gate-out, last free day, return); the Order in the header, linked by id or **Not linked to an order**, with **Link order** and the **Orders with this B/L number** hint; Fees for the linked order |
| w1-014 | 19 | /guide/18/golden/6/detail | Appends: Today's **Empty return due** card and **Overview → Empty return** (most urgent first, with a reason); **Do these first** adds empty returns that are overdue or due today |
| w1-015 | 19 | /guide/18/writes/0 | Adds the order link, container records with last free day and return status; "countdown" → "provisional clock" |
| w1-016 | 19 | /guide/18/pitfalls/0 | "no 72-hour clock can start" → "no provisional 72-hour clock can start" |
| w1-017 | 19 | /guide/18/pitfalls/1 | Adds the order's full record page to where the Documents & customs card shows; "provisional 72-hour gate-out clock"; **Port tracking says berthed …** with **Use this time**; Match not certain only when no job is linked |

Each op carries file, line and exact-quote evidence from `.deploy-prod`, for example:

- `order-form.tsx:326` VESSEL_GROUP_MODES
- `collective-order.ts:442` "An actual can't be in the future — use ETA/ETB for a planned time"
- `sea-export.tsx:2888` the ETB / ATB milestone
- `record-page.tsx:271/279` "Expected …" and "· not confirmed"
- `customs-tracking.tsx:225` the column header
- `bl-job-record.tsx:174/345/347/769–772/932`
- `order-documents-card.tsx:193/261/307/323`
- `order-record-page.tsx:184`
- `register-hooks.ts:61`
- `source-notice.ts:52`
- `permissions.ts:43`
- `overview-empty-return.tsx:85/317`, `overview-menu.tsx:57`, `overview-today.tsx:85`
- `free-time.ts:96`

## Screenshots to replace (needs-human, capture needed)

| Op | Shot | Why |
|---|---|---|
| w1-018 | /guide/13/shots/0 `shots/step-14.jpg` (/order/new) | The order form now has a Vessel group on sea trades. The same file is used by /guide/11/shots/0, so one capture fixes both |
| w1-019 | /guide/18/shots/0 `shots/step-19.jpg` (/customs-tracking) | The column header now reads Provisional · berth + 72h |
| w1-020 | /guide/18/shots/1 `shots/step-19-overview-today.jpg` (/overview) | Today has the new Empty return due card, and Do these first has return rows |

Staleness also flagged `step-22.jpg` and `step-27.jpg` because `nav.ts` changed. I judged them unaffected: the only nav changes are a Settings (admin) entry, "Free-time rules", and a rail-search action. Neither is visible on /expenses/cost-lines or /report/financial. No recapture is proposed.

Capturing against production needs Wilfred's yes first.

## Auto: re-anchored citations (applied without asking)

| Op | Path | Old → new |
|---|---|---|
| w1-re-001 | /guide/11/golden/0/src | order-form.tsx:360 → 386 |
| w1-re-002 | /guide/11/golden/1/src | order-form.tsx:2789 → 2835 |
| w1-re-003 | /guide/12/fixes/0/src | collective-order.ts:3336 → 3555 |
| w1-re-004 | /guide/13/golden/0/src | order-form.tsx:1605 → 1651 |
| w1-re-005 | /guide/13/golden/1/src | order-form.tsx:360 → 386 |
| w1-re-006 | /guide/13/golden/3/src | order-form.tsx:330 → 356 |
| w1-re-007 | /guide/13/golden/5/src | order-form.tsx:3004 → 3059 |
| w1-re-008 | /guide/13/golden/6/src | order-form.tsx:3112 → 3167 |
| w1-re-009 | /guide/13/golden/7/src | order-form.tsx:2486 → 2532 |
| w1-re-010 | /guide/14/fixes/0/src | collective-order.ts:3112 → 3311 |
| w1-re-011 | /guide/14/fixes/2/src | collective-order.ts:3381 → 3601 |
| w1-re-012 | /guide/15/fixes/1/src | lading.ts:1554 → 1556 |
| w1-re-013 | /guide/17/golden/5/src | register-hooks.ts:66 → 92 |
| w1-re-014 | /guide/18/golden/4/src | bl-job-record.tsx:342 → 392 |
| w1-re-015 | /guide/19/golden/0/src | order-record-page.tsx:156 → 158 |

## Needs-human, including proposed new content

None of these are applied, whatever `--accept` says. To take one, re-tier it to `confirm`, or re-draft it as an insert, after Wilfred decides.

**Where should empty return go?** Three options:

- **A (recommended): a guide row in step 19.** Add a golden row, w1-021, plus field rows. No renumbering, and every `#step-N` link keeps working.
- **B: a new step 20 "Return the empty containers" (phase D).** This is a structural change (chain:true). It renumbers steps 20–27, which breaks the dashboard's `#step-N` links and the Convex keys tied to step numbers (SITE.md invariant). Not recommended.
- **C: a new "after gate-out" chain break or aside node.** Visible on the chain map without renumbering, but it needs chain-block edits and the template's support.

### w1-021: empty return as a golden row in step 19

Inserted at /guide/18/golden/7, after "Book haulier".

> When a container goes back, open it from the job's **Containers** card (or **Overview → Empty return**) and move its **Return** status. NCT's ten statuses are Pending delivery, Pending unstuffing, Pending return instruction, Ready for return, Return arranged, Returned, Rejected, Depot full / change depot, Damaged / on hold and N/A. **Returned** needs the actual return date and stops the clock. Rejected, depot full, damaged/on hold, N/A and any reopen need a reason. **Attach EIR** keeps the depot's receipt on the container as an attachment; it is never read or sent to Needs review.

Evidence:

- `status.ts:44/99`
- `attachment.ts:24`
- `container-sheet.tsx:1053`

### w1-022: free-time rules note in step 19

Inserted as a pitfall at /guide/18/pitfalls/2, with a route row `/settings/free-time`, "Free-time rules".

> A container's last free day comes from a typed date (from the line's notice, which wins) or from a confirmed rule in **Settings → Free-time rules**. A rule starts as a draft and counts once you press **Confirm rule**. Editing a confirmed rule makes version n+1, and **Retire** needs a reason. With neither, the last free day reads **Pending confirmation**, not zero days. Managing rules needs **Set free-time rules** (Owner, Admin, Branch manager).

Evidence:

- `nav.ts:274`
- `permissions.ts:48`
- `free-time.ts:96`

### w1-023: My tracking shipment card

Inserted as a pitfall at /guide/18/pitfalls/3. The SOP does not mention My tracking anywhere today. Leaving it out is also reasonable.

> In **My tracking**, a customer's shipment is now a card showing:
>
> - job, customer, consignee and PIC
> - billing party (TBA until set)
> - the next step, e.g. "Return 2 empties"
> - milestones, including "MYCIEDS complete"
> - container rows
> - "Empty return progress n / m"

Evidence:

- `shipment-card-model.ts:30/117`

### w1-024: order Duplicate in step 14

Inserted as a pitfall at /guide/13/pitfalls/2.

> **Duplicate** on an order keeps the estimates and vessel/voyage, and clears ATD, ATA, ATB, Discharged, Customs vessel ID, SCN and HBL.

Evidence:

- `collective-order.ts:2859–2862`

### Other needs-human items

- **w1-025: run /zyt-audit.**
  - Ledger item 10 says the countdown is never visible from the order's full record page. That looks fixed: `order-record-page.tsx:184` now mounts `OrderDocumentsCard`.
  - Item 10 and item 21 still describe matching by B/L number only. `bl_job.order_id` (`modules/bl-tracking/order-link.ts`) replaces that.
  - A session may not edit ledger text.
- **w1-026: break 1 "Documents → the job" (chain text, older drift, not caused by Wave 1).**
  - It says the per-order Documents card never renders.
  - /guide/18/pitfalls/1, and now `order-record-page.tsx:184`, say it does.
  - Review it here or in /zyt-audit.
- **Roles:**
  - No change to step actors is proposed. Containers are kept by Operations, which the step already names.
  - Free-time rules belong to Owner/Admin/Branch manager, which are not among the page's role-lens roles. If Wilfred wants them in the lens, run `/zyt-update --roles`.
- **Code defect found while reading (outside the SOP, for the NCT app):**
  - `apps/web/src/components/customs-tracking/bl-job-record.tsx:563` still tests `chip.label.startsWith("OVERDUE")`.
  - Since Wave 1, `countdownChip` returns `"Overdue · …"` (`countdown.ts`, `URGENCY_LABEL.overdue = "Overdue"`).
  - As a result, the job page's red "Provisional · berth + 72h — free port-storage window has expired… Demurrage is accruing" exception never shows.

## After GATE 1 (not done in this run)

1. Apply: `sop-patch.mjs --data sop.json --changeset .zyt/pending-2026-10-06-wave1.json --source session --code-root C:/Project/NCT/.deploy-prod --accept auto,<approved ids> --check-old`.
2. Record the sync: `registry.mjs record --id ZYT-Task/customer-intake-sop --synced-at <ISO> --synced-scope 12,13,14,15,16,18,19,20`.
3. Rebuild with `--no-ledger`, check, and capture the 3 shots.
4. Run `deploy-site.ps1 -DryRun`, then GATE 2. That publishes every session's uncommitted ZYT-Task edits, so commit the 2026-10-04 edit first.
5. Separately, consider pointing the registry codeRoot at `.deploy-prod`. That needs Wilfred's yes.
