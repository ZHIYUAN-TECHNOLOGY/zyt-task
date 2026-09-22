# Step 19 — the demurrage clock says when it cannot run, shows on the order it belongs to, and leads back to that order's fees

**SOP step:** 19 "Watch the demurrage clock" · Operations → **Customs Tracking** (`/customs-tracking`) → a job's record page (`/customs-tracking/$jobId`) · **Overview** (`/overview`) gate-out and blocked cards
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-21. The worktree `C:/Project/NCT/nct-layout` is checked out at `ea1560e7` (`feat/intake-golden-path-e2e`), and `git diff --stat 6bb3a1bf HEAD -- packages apps` is empty, so every code citation below matches `6bb3a1bf`. Every `file:line` was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Small to standard. The automation itself (schedulers, portal checks, transition core, alerts, void) is sound and well defended; this plan does not touch it. It fixes three places where the clock's facts do not reach the people who act on them: an org with no portal logins gets a board that never moves and says nothing (Phase 1), the order's own Documents card never renders and its payload has no deadline (Phase 2), and a tracking job has no way back to its order and fees, which is where step 20 starts (Phase 3). No migration under the recommended options.
**Cross-plan items owned:** the "island" ledger item (`sop.json` `ledger.items[id=island]`, repairs step 19 and step 18). The server payload reshape it needs is also named in the step 18 break ("Documents → the job"), so ownership of that reshape is **D1**, Decided A (step 19 owns it; settled with step 18 D3-A under crosscheck X23).
**Decisions:** every decision below is **Decided (2026-09-21)**. Wilfred took the Recommended option of each (D1-A, D2-A, D3-B, D4-B, D5-A, D6-A, D7-B) and accepted every cross-plan settlement in `steps-16-19-crosscheck.md` (X17–X27). Q1–Q3 stay open questions, not planned work. See "Decisions settled (2026-09-21)" at the end.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`, `permittedNode` at `procedures/org.ts:287`). Drizzle schema in `packages/db/src/schema`. TanStack Router file routes in `apps/web/src/routes/_next`. zod both sides. vitest on PGlite. Dev: web `:3101`, server `:3000`. The BL automation lives in three places: `packages/port-tracking` (pure transition core, portal adapters, intake), `packages/api/src/modules/bl-tracking` (sweep, queue consumer, runner, pipeline, thresholds) and `apps/server/src/bl-tracking-worker.ts` (cron and queue glue, email rendering).

- **The step today, end to end.**
  - **Birth.** The only writer of `bl_job` is the document approval hook `ingestApprovedDocument` (`packages/port-tracking/src/intake.ts:52`, registered in `modules/document/register-hooks.ts:8-41`, called at boot from `apps/server/src/index.ts:44`). It fires for `docType === "mbl_hbl"` with a non-empty extracted `blNumber` (`intake.ts:56-82`). A second document for a BL number that already has an **open** job returns that job as `duplicateOf` and creates nothing (`:108-135`); a finished (gated out or voided) job does not block a new one. A job with no extracted containers gets a `containers_missing` event (`:184-203`). Step 18 owns this path.
  - **Schema.** `bl_job` (`packages/db/src/schema/bl-tracking.ts:11-67`) carries `sourceDocumentId` (unique, `:64`), `blNumber`, `vesselName`, `receivedAt`, `customsStatus`, `customsClearedAt`, `vesselBerthedAt`, `countdownDeadline`, `stage`, `voidedAt/By/Reason`. **There is no column linking a job to `collective_order` or `lading`.** Index `(organization_id, bl_number)` at `:65`. `bl_container` and the append-only `bl_event` follow (`:69-125`).
  - **Schedulers.** `scheduled()` in `apps/server/src/index.ts:316-336` dispatches `"0 1,4,7 * * *"` to `runBlCheckSweep("customs")` (`:324-326`) and `"0 * * * *"` to `runBlCheckSweep("port")` (`:327-332`). The crons exist **only on the prod stage** (`packages/infra/alchemy.run.ts:224`, `crons: app.stage === "prod" ? [...] : []`). `runBlCheckSweep` (`bl-tracking-worker.ts:67-80`) enqueues one message per due job (`sweep.ts:13-32`: customs phase takes `awaiting_customs`; port phase takes `awaiting_customs`, `awaiting_vessel`, `at_port`) and, on the port phase only, runs the countdown alerts.
  - **Checks.** `runJobChecks` (`modules/bl-tracking/runner.ts:167-283`) makes exactly one portal call per message: MYCIEDS clearance while `awaiting_customs` (`:188-203`); SBCP berth while `vesselBerthedAt` is null (`:207-254`), which writes a once-per-job `vessel_missing` event when no vessel name was extracted (`:212-244`); SBCP gate-out per pending container once `at_port` (`:256-276`). A transient failure throws so the queue retries (`:105-111`); a structural one is emailed once per check type per job, then recorded (`:113-164`).
  - **Transitions.** `applyObservation` (`packages/port-tracking/src/transitions.ts:95-207`). Berth sets `vesselBerthedAt` and `countdownDeadline = berthedAt + 72h` (`:156-176`, window `:11`), and moves the stage to `at_port` only if customs is already done (`:169`). A terminal job absorbs every late observation (`:105-107`). `applyAndPersist` re-checks the terminal stage inside the write (`modules/bl-tracking/pipeline.ts:60-88`).
  - **Alerts.** `runThresholdAlerts` / `detectAndRecordThresholds` (`modules/bl-tracking/thresholds.ts:185-214`, `:78-179`) fire the most urgent unfired threshold of **24h and 8h** (`:17`, `nextThreshold` `:23-31`), deliver before recording, and re-fire a threshold whose delivery-log rows all failed (`:111-140`). Recipients are the owning branch's members, falling back to the org's owners and admins, and an empty list throws (`modules/notification/recipients.ts:98-104`, `:132-142`).
  - **Board.** `/customs-tracking` (`apps/web/src/routes/_next/customs-tracking.tsx`) reads `blJob.list` (`packages/api/src/routers/bl-job.ts:103-141`, unbounded, `receivedAt DESC`) every 30 s, sorts on the client with `sortJobsByUrgency` (`customs-tracking.tsx:106`; `features/customs-tracking/countdown.ts`), columns at `:193-201`, Void dialog and toast at `:108-121`, `:332-371`. The BL number links to the record page (`:243-249`), which reads `blJob.get` (`bl-job.ts:165-217`) and offers `VoidJobAction` (`components/customs-tracking/bl-job-record.tsx:797`).
  - **Overview.** The gate-out card reads `blJob.urgentSummary` (`bl-job.ts:338-407`; `components/shell-next/card-gateout.tsx:225`); the blocked card and pool strip read `blJob.blocked` (`bl-job.ts:242-296`; `pool-strip.tsx:167`), whose reasons are `vessel_missing`, `containers_missing`, `check_failed` (`bl-job.ts:52`).
  - **Void.** `blJob.void` (`bl-job.ts:419-481`) needs `bl-job.void`, re-checks the terminal stage in a guarded UPDATE, and writes `job_voided` with the reason and the previous stage. No static role holds `bl-job.void` (`modules/bl-tracking/permissions.ts:3-9`; `packages/auth/src/permissions.ts` gives every role `"bl-job": ["read"]`), so by default only the owner can void.
  - **The order side.** `enrichOrderRows` (`packages/api/src/routers/collective-order.ts:1891`) feeds both `collectiveOrder.list` (`:2463`) and `collectiveOrder.get` (`:2494`). When the caller holds `document.read` (`:2053`) it gathers the rows' MBL/HBL numbers (`:2057-2064`), selects matching non-voided jobs (`:2152-2168`) and attaches `customsStatus`, `customsClearedAt`, `blStage` to a flat `documents` object (`OrderCustomsState` `:1843-1850`, `OrderDocumentState` `:1859-1868`, fold `:2188-2227`, output `:2258`).
  - **The card that should show it.** `<OrderDocumentsCard>` (`apps/web/src/features/order-documents/order-documents-card.tsx:49`) is mounted in the ledger reading pane (`components/order-ledger/order-ledger-page.tsx:865-869`, `:1196-1201`) and on the B/L record page (`routes/_next/lading/$id/index.tsx:132-138`, `:451`). It reads the row through `readOrderDocumentRollup` (`features/order-documents/rollup.ts:114-133`), which expects `documents.counts[]` and `documents.customs = { match, candidates, job: { id, blNumber, stage, customsStatus, countdownDeadline, … } }` (`:56-83`).

- **Finding F1 (rank 1: silent total failure). An org with no saved portal logins gets a board that never moves and says nothing.**
  - `createTrackingSourceResolver` returns `null` when `tracking_source_config` has no row for (org, source) (`modules/bl-tracking/source-resolver.ts:26-30`; `modules/tracking-source/credentials.ts:101-118`). `runJobChecks` then only increments `result.skipped` (`runner.ts:194-198`, `:245-249`, `:257-261`). `handleBlCheckBatch` ignores the result and acks (`modules/bl-tracking/consumer.ts:27-50`). No event, no email, no blocked row.
  - What the board shows for such an org: every job "Pending" in the Customs column and "—" in the countdown column for ever (`countdown.ts:175-178`). That reads exactly like "the ship has not arrived", while in fact nothing is being checked, the berth is never observed, the 72h deadline is never set, and **no 24h or 8h alert can ever fire** (`thresholds.ts:94`, `:198` need `countdownDeadline`).
  - The logins are managed in Settings by `TrackingSourcesCard` (`apps/web/src/routes/_next/settings.tsx:142`, `:824-832`), gated `tracking-source.manage` (`routers/tracking-source.ts:20`), so an operator holding only `bl-job.read` cannot even see whether they are set.
  - SOP step 19 "before" names only the approved B/L; the logins are an unstated precondition. Production size: probe **19-P1**.

- **Finding F2 (rank 2: the clock is invisible from its order). The order's Documents card never renders, and the server payload has no deadline or job id.**
  - The server sends `documents` as the flat `OrderDocumentState` (`collective-order.ts:1859-1868`: `documentCount`, `documentsByType`, `documentsByStatus`, `documentsNeedingReview`, `documentsApproved`, `customsStatus`, `customsClearedAt`, `blStage`). The web reader returns `null` at `rollup.ts:118` because `counts` is not an array, and a null rollup renders nothing (`order-ledger-page.tsx:861-869`; `lading/$id/index.tsx:120-138`). **So both mounts of the card are blank today — the document checklist as well as the customs line.**
  - The customs select (`collective-order.ts:2153-2159`) takes only `blNumber`, `customsStatus`, `customsClearedAt`, `stage`: **no `id`** (so the card cannot link to the job) and **no `countdownDeadline`** (so `countdownChip` would read "—" even if the card rendered).
  - Grep of `apps/web/src` for `blStage`, `documentsNeedingReview`, `documentCount`: **no reader.** The only reader of the flat shape is the server test block "the document rollup on an order row" (`collective-order.numbering.test.ts:546-760`). The web side is unit-tested against the shape the server never sends (`rollup.test.ts`, 13 cases).
  - Root cause: `readOrderDocumentRollup(row: unknown)` is typed `unknown` on purpose, so the compiler never compared the two shapes.

- **Finding F3 (rank 3, lands with F2). When one BL number has several jobs, the order shows an arbitrary one.**
  - Intake deliberately allows a new open job for a BL number whose earlier job has finished (`intake.ts:98-126`). The order-side select excludes only voided jobs (`collective-order.ts:2165`) and has **no ORDER BY**, and the fold keeps the first row per number (`:2193-2200`, "First one wins by number"). So an order can show last season's `gated_out` job while this shipment's clock runs, depending on the row order Postgres returns.
  - The web contract already has the answer the server does not give: `match: "none" | "exact" | "ambiguous"` and `candidates` (`rollup.ts:56-63`), with the card refusing to show a stage or clock for an ambiguous match (`customsView` `:301-312`; `order-documents-card.tsx:173-190`).
  - The match is an exact string compare (`inArray(blJob.blNumber, …)` `:2164`). The order's MB/L is typed by hand (`order-form.tsx:380`); the job's number comes from extraction. A trailing space or case difference silently misses. Size: probe **19-P3**.
  - Two open jobs for one BL are possible only through a race in intake (check at `intake.ts:117-126`, insert at `:139`, no unique index on open jobs). Size: probe **19-P2**. The race itself is step 18's.

- **Finding F4 (rank 4: severed hand-off to step 20). A tracking job has no way back to its order or its fees.**
  - `blJob.get` returns the job, containers and events only (`bl-job.ts:210-216`). The record page's Record group links to the source document and thread (`bl-job-record.tsx:302-336`) and nothing else. The board has no order column. The SOP's own words: "the board cannot reach that job's fees" (step 19 `watch`), and step 20 starts at `/order/$orderId/expenses` (`routes/_next/order.$orderId.expenses.tsx`).
  - The same scoped reverse lookup already exists for search: `search.records` finds orders by MBL/HBL under `COLLECTIVE_ORDER.read` and the order scope (`routers/search.ts:148-180`), and the web builds the record URL with `TRADE_SEGMENT` (`components/shell-next/record-routes.ts:22-32`, `recordTo` `:63-95`).

- **Finding F5 (rank 5, small, lands with F2). The customs half of the order payload is gated on the wrong node.** It is attached when the caller holds `document.read` (`collective-order.ts:2053`) and never checks `bl-job.read`. Every static role holds both (`packages/auth/src/permissions.ts:104-278`), so this matters only for custom roles or member overrides. Size: probe **19-P6**.

- **Verified sound (no plan).** Terminal handling in one list (`transitions.ts:32`) used by the sweep, runner, pipeline, thresholds, blocked, urgentSummary and void. Void race (`bl-job.ts:449-463`). Deliver-before-record on both alerts. Delivery-failure re-fire. Once-per-type structural alerts. `fetch` binding (`bl-tracking-worker.ts:192-200`). Board and record page time zone pinned to MYT (`countdown.ts:255`). Out-of-scope reads answer NOT_FOUND.

- **Considered, not planned (not a verified defect, or another step's).**
  - **No alert after the deadline passes.** The 8h email is the last one (`thresholds.ts:17`); an overdue job stays red at the top of the board and on the record page (`bl-job-record.tsx:421-431`) but nobody is emailed while demurrage accrues. That is a product choice, not a bug — Open question Q1, probe **19-P5**.
  - **Gate-out time is the observation time** (`transitions.ts:198`), up to an hour late on the hourly poll, so "Done · … spare" can be up to 1h pessimistic. Cosmetic.
  - **Berthed while customs pending**: gate-out is not polled until customs clears (`runner.ts:278-282`), so a 24h/8h alert can fire for containers that already left. Customs is re-polled three times a day and the job catches up; not planned.
  - **Intake dedupe race** and **"add the containers on the source document"** (via `document.amend`, `routers/document.ts:722-788`) are step 18's.
  - **`blJob.list` is unbounded** (`bl-job.ts:117-121`). A cost, not a defect, at today's volumes.
  - **Haulage island** (ledger item `haulage`, repairs steps 14 and 19): linking trucks to jobs needs a new driver/dispatch/leg entity. That is a redesign, not a repair — out of scope.
  - **Void has no static role**: deliberate (`modules/bl-tracking/permissions.ts:3-9`). Open question Q3.

**Step 19 is mostly sound.** The plan is small: three short phases, one per finding group, each delivering a whole journey. None changes the automation.

## 1. Overview

**Problem.** The demurrage automation works, but its facts do not reach the people who act on them. An org that never saved its MYCIEDS/SBCP logins sees a board that looks patient and is in fact dead: no berth is ever seen, no deadline is ever set, no alert can ever fire. An operator working from the order sees no clock at all, because the order's Documents card has never rendered (the server and client disagree on the payload's shape, and the server leaves out the deadline). And an operator who starts from the board cannot get from the job to the order and its fees, which is where step 20 begins.

**Goals.**
- **Phase 1 (F1):** when a portal login is missing, the board, the job's record page and the Overview gate-out card say so in words, name the check that is off, and point at Settings.
- **Phase 2 (F2, F3, F5):** the order's Documents card renders in the ledger pane and on the B/L record page, and its customs line shows the right job's stage and 72h countdown, or says the match is uncertain. The BL number on the card opens the job's record page.
- **Phase 3 (F4):** the job's record page names the order(s) carrying its BL number, links to each order's record page and to its fees page (step 20).

**Success criteria.**
- `blJob.sourceStatus` returns `{ mycieds: false, sbcp: false }` for an org with no `tracking_source_config` rows, `true` for each saved source, and never returns a login id or password. With an open job in scope and a source missing, `/customs-tracking` shows the notice naming that source; with both saved, no notice.
- `collectiveOrder.get` for an order whose MB/L equals an open job's BL number returns `documents.counts` (array) and `documents.customs = { match: "exact", candidates: 1, job: { id, blNumber, stage, customsStatus, countdownDeadline, … } }`; `readOrderDocumentRollup` of that row is not null; the ledger pane shows the countdown chip.
- An old `gated_out` job and a new open job sharing the BL number → the open one is shown (D2). Two open jobs → `match: "ambiguous"`, `candidates: 2`, and the card shows no stage and no clock.
- `blJob.get` returns `orders: [{ id, jobNumber, businessType }]` for orders in the caller's order scope whose MB/L or HB/L matches; `null` when the caller lacks `collectiveOrder.read`. The record page links to `/order/<segment>/<id>` and `/order/<id>/expenses`.

**In scope.** A read-only `blJob.sourceStatus` procedure and a `sourcesConfigured` field on `blJob.get`; one notice on the board, the record page and the gate-out card; the `documents` payload reshape in `enrichOrderRows` (under D1); the customs match rule (D2), permission (D3) and normalisation (D4); a typed contract test between the two sides (D5); the reverse lookup on `blJob.get` and the Order field on the record page (D6).

**Out of scope.**
- Anything in the automation: sweep, runner, transitions, thresholds, void, email copy.
- Writing `document_link` rows for orders (the step 18 break). Until step 18 lands, the Documents card's checklist half will render with "Missing" lines — see D1 and §7.3.
- A `bl_job.order_id` column or any link written at intake (D6-C only, rejected under the recommendation).
- An overdue alert (Q1), a default role for void (Q3), the haulage link, the intake dedupe race.
- SOP text for step 19 (the §9 SOP table lists what is wrong; editing `sop.json` belongs to the SOP update after deploy).

**SOP findings (`customer-intake-sop/sop.json`, step 19 `watch`, `pitfalls`, ledger `island`):**

| Finding | Planned? | Where |
|---|---|---|
| "Tracking jobs are anchored to the document only … the board cannot reach that job's fees" | Yes, by lookup, not by a new column (D6) | Phase 3 |
| "Leaves the deadline out of that payload, and the card meant to show it never renders" | Yes; the card is blank for a wider reason than filed (F2) | Phase 2 |
| Ledger `island` (repairs 19 and 18) | Yes for step 19's half; the document-link half stays with step 18 | Phases 2–3, D1 |
| Ledger `haulage` (repairs 14 and 19) | No — a new entity, not a repair | – |
| Not filed: missing portal logins fail silently (F1) | Yes | Phase 1 |

**Input Gate.** Not held. Every decision in §9 was settled by Wilfred on 2026-09-21 on its Recommended option; tasks are worded for that Chosen option, and each decision names the tasks it changes.

**Decisions (all Decided 2026-09-21; Chosen option in brackets):**
- Who reshapes the order `documents` payload, step 18 or step 19 → D1 [A: step 19, whole object]
- Which job an order shows when several share its BL number → D2 [A: the open one; newest finished if none open; two open is ambiguous]
- Which permission shows the customs line → D3 [B: `document.read` and `bl-job.read`]
- How BL numbers are compared → D4 [B: trimmed and upper-cased on both sides, at read time]
- How the two sides of the payload stay in step → D5 [A: a web test typed from the router's output]
- How a job reaches its order → D6 [A: `blJob.get` returns the matching orders]
- How a missing login is surfaced → D7 [B: one org-level read and a notice]

## 2. User Journeys

**Journey 1 (changed): Operations open the board in an org whose portal logins were never saved**
Trigger: an approved B/L created a job (step 18); nobody has saved MYCIEDS or SBCP in Settings.
Steps:
1. Ops open **Operations → Customs Tracking** → above the table a notice reads _"Customs and port checks are off: no MYCIEDS or SBCP login is saved, so no job on this board is being checked and no 72-hour clock can start. An admin adds them in Settings → Tracking sources."_ (one source missing names only that one).
2. Ops open a job → the record page's exception card carries the same sentence tagged **Checks off**.
3. Ops open **Overview** → the gate-out card shows one muted line _"Checks off — portal logins missing"_ linking to `/customs-tracking`.
4. An admin saves the logins in `/settings` → on the next refetch (30 s) the notice is gone; the next port sweep (hourly, prod) starts observing.
5. Flow ends: nobody reads a dead board as a quiet one.
Where it lives: the existing board header area, the existing record-page exception card, the existing Overview card.

Old journey, for contrast: at step 1 every row said "Pending" and "—" for ever, and no alert could fire.

**Journey 2 (changed): Operations see the clock from the order**
Trigger: an order's **MB/L NO.** equals an open job's BL number.
Steps:
1. Ops open `/order/sea-export` and select the order → the reading pane shows the **Documents** card: the checklist lines and a **Customs** line with the stage chip (e.g. "At port") and the countdown chip (e.g. "23h 10m", amber under 24h, red under 8h), and _"72h gate-out clock running"_.
2. Ops press the BL number on that line → `/customs-tracking/<jobId>` opens.
3. The same card appears on the B/L record page `/lading/<id>` for a lading linked to that order.
4. If two open jobs share the number, the line reads **Match not certain** with the count and a link to the board, and shows no clock.
5. Flow ends: the deadline is visible from the job it belongs to.
Where it lives: the existing `<OrderDocumentsCard>` in its two existing mounts; the server change is what makes it render.

Old journey, for contrast: the card never rendered, and the payload had no deadline to show.

**Journey 3 (new link): Operations go from the job to its order and fees (hand-off to step 20)**
Trigger: ops are on the board or the Overview gate-out card, looking at a job whose clock is running.
Steps:
1. Ops open the job's record page → the **Record** group shows **Order**: the order's job number as a link, and **Fees** → _"Open the order's fees"_.
2. **Order** opens `/order/<segment>/<orderId>`; **Fees** opens `/order/<orderId>/expenses` (step 20).
3. No order carries the number → **Order** reads _"No order carries this B/L number"_. Several do → one link per order (at most five, then _"and N more — search the BL number"_).
4. A caller without `collectiveOrder.read` sees no Order field at all.
5. Flow ends: the board reaches the job's fees.
Where it lives: the existing record page's Record group (`bl-job-record.tsx:302`).

## 3. Result (What Changes for the User)

**Before:** a missing portal login looked like a patient board; the order never showed its customs state or clock; the job had no link to its order.
**After:** the board says when checks are off and why; the order's Documents card shows the right job's stage and countdown, or admits it is unsure; the job's record page links to its order and its fees.
**Key differences:**
- Operations: a notice on three screens when logins are missing; a working Documents card on the order pane and the B/L page; Order and Fees links on the job.
- Admins: nothing new to do beyond saving logins, which they already could.
- Nobody: no email, alert timing or check schedule changes.

## 4. Technical Architecture

### 4.1 Portal logins missing (Journey 1; Phase 1) → D7

- **`blJob.sourceStatus`** [new procedure in `packages/api/src/routers/bl-job.ts`]: `orgProcedure.use(requireNode(BL_JOB.read))`, input `z.object({}).default({})`. One query: `select source from tracking_source_config where organization_id = $org`. Returns `{ mycieds: boolean, sbcp: boolean }`. It selects the `source` column only, never `login_id`, `agent_code` or `encrypted_password`. It needs no data scope (the answer is org-level).
- **`blJob.get`** gains `sourcesConfigured: { mycieds, sbcp }` from the same helper, so the record page's `exceptions(job)` (`bl-job-record.tsx:397`) can use it without a second query. The helper is one exported function in `bl-job.ts` (`loadSourceStatus(db, organizationId)`), called by both.
- **Web.** A pure `sourceNotice(status, openJobs)` in `apps/web/src/features/customs-tracking/source-notice.ts` [NEW] returns `null` or `{ missing: ("MYCIEDS" | "SBCP")[], text }`. The text names what stops: MYCIEDS missing → customs clearance is not checked; SBCP missing → berth and gate-out are not checked and the 72h clock cannot start. `openJobs` is the count of non-terminal jobs; zero → no notice (a fresh org with no jobs is not warned). The board renders it above the table; the record page pushes a `RecordException` (`tag: "Checks off"`, `tone: "warn"`, `source: "tracking_source_config"`) when the job is open; the gate-out card shows one line when `sourceStatus` has a false and `urgentSummary.rows` is non-empty.
- **Unchanged:** the runner still skips silently. Under D7-B the fact is surfaced where people look, not recorded per job.

### 4.2 The order's Documents payload (Journey 2; Phase 2) → D1, D2, D3, D4, D5

- **Output shape** (replaces `OrderDocumentState` at `collective-order.ts:1859-1868` and `OrderCustomsState` at `:1843-1850`):

```ts
interface OrderDocumentsPayload {
  /** One entry per (docType, status) bucket, straight from the grouped query. */
  counts: { docType: string | null; status: string; count: number }[];
  customs: {
    match: "none" | "exact" | "ambiguous";
    candidates: number;
    job: {
      id: string; blNumber: string; stage: string; customsStatus: string;
      countdownDeadline: Date | null; voidedAt: Date | null;
      containers?: never; // not loaded; the card never needs it for an open job
    } | null;
  };
}
```

  `documents` stays `null` when the Function axis withholds `document.read` (`:2256-2258`, unchanged rule). Exported from `collective-order.ts` so D5's test can name it.
- **Counts.** `documentRows` (`:2123-2150`) already are `{orderId, docType, status, count}`; the fold (`:2201-2216`) pushes them into `counts` instead of summing. The single grouped query and its `group by` stay, so the "exactly ONE document query" test (`collective-order.numbering.test.ts:716`) keeps passing.
- **Customs select** (`:2152-2168`) adds `id`, `countdownDeadline`, `voidedAt` and `receivedAt`; keeps `isNull(voidedAt)`; compares normalised numbers (D4-B): `inArray(sql\`upper(btrim(${blJob.blNumber}))\`, [...normalised])`, with the order side normalised in JS by `normaliseBlNumber` (`packages/api/src/modules/bl-tracking/bl-number.ts` [NEW], `s.trim().toUpperCase()`).
- **Match rule (D2-A).** For each order: candidates are the jobs matching its MB/L; if none, those matching its HB/L (the master bill first, as today, `:2190-2192`). Among candidates: open jobs (stage not in `TERMINAL_STAGES`) win; one open → `exact`; two or more open → `ambiguous` with `job: null`; no open → the newest finished by `receivedAt` → `exact`; no candidates → `none`. `candidates` is the count of the set that decided (open set, or finished set).
- **Permission (D3-B).** The customs half is computed only when the caller also holds `BL_JOB.read`; otherwise `customs = { match: "none", candidates: 0, job: null }`. No `bl-job` data scope is applied, matching the document half's "reached through the parent order" rule (`:2043-2051`).
- **Web.** `order-documents-card.tsx` `MatchedCustoms` (`:203-238`) wraps the BL number (`:224`) in a `<Link to="/customs-tracking/$jobId">`. `rollup.ts` is unchanged apart from a type import for D5's test.

### 4.3 From the job to its order (Journey 3; Phase 3) → D6, D4

- **`blJob.get`** gains `orders: { id: string; jobNumber: string | null; businessType: string }[] | null`. `null` when `!permittedNode(org, COLLECTIVE_ORDER.read)`. Otherwise one query copying `search.ts:148-180`: `collective_order` where `organization_id = org`, `applyScope(…, "collectiveOrder", orderScopeCols) ?? sql\`false\``, `archived = false`, and `upper(btrim(mbl)) = $n or upper(btrim(hbl)) = $n` with `$n = normaliseBlNumber(job.blNumber)`, `order by created_at desc limit 6` (five shown, the sixth only proves "more").
- **Web.** `bl-job-record.tsx` Record group (`:302`) gains two fields after "Source thread": **Order** (links built with `TRADE_SEGMENT`, `record-routes.ts:22`; a business type with no segment renders the job number as text) and **Fees** (`/order/$orderId/expenses`, shown only when exactly one order matched). `orders === null` → neither field.

### 4.4 Data model

No change under the recommended options. D4-C would need `00NN_bl_number_normalise` (a backfill of `bl_job.bl_number` and `collective_order.mbl/hbl`); D6-C would need `00NN_bl_job_order_link` (`bl_job.order_id`, nullable, FK set null). Both are rejected under the recommendations.

### 4.5 API contracts (all inputs unchanged)

| Procedure | Change | Readers |
|---|---|---|
| `blJob.sourceStatus` [new] | `{} → { mycieds: boolean; sbcp: boolean }`, node `bl-job.read` | board, gate-out card |
| `blJob.get` | output gains `sourcesConfigured` (Phase 1) and `orders` (Phase 3) | `customs-tracking_.$jobId.tsx:70` only; `BlJobRecord` is inferred from the router (`bl-job-record.tsx:65`) |
| `collectiveOrder.list` / `get` | `documents` changes from the flat rollup to `{ counts, customs }` | `readOrderDocumentRollup` (ledger pane, B/L record page); the server test block. No other reader (grep of `apps/web/src`, `e2e`) |

### 4.6 Key decisions (all Open; §9 has the three approaches of each)

D1-A, D2-A, D3-B, D4-B, D5-A, D6-A, D7-B, as listed in §1. All seven were Decided on 2026-09-21; the heading is kept as written.

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- None for Phase 1: it touches only BL files no earlier plan edits.
- Phase 2: D1 settled against the step 18 plan (Decided A with step 18 D3-A, crosscheck X23), and step 18 Phase 1 (link writer) merged; step 11 Phase 2 and step 12 merged if they have not been (both edit `collective-order.numbering.test.ts`, §7.6). Probes 19-P2, 19-P3, 19-P6 read before Task 2.1 (D2, D4, D3).
- Phase 3: Phase 2 merged (it creates `bl-number.ts`).
- Re-locate every anchor by symbol at the base commit.

### Phase 1 — The board says when its checks are off (F1)

**Delivers:** Journey 1 end to end.
**Dependencies:** none.

- **1.1** Add `loadSourceStatus(db, organizationId)` and `blJob.sourceStatus` to `routers/bl-job.ts` (§4.1); add `sourcesConfigured` to `blJob.get`'s return (`:210-216`). Select only `trackingSourceConfig.source`. Files: `packages/api/src/routers/bl-job.ts`. · **Agent A (backend)**
- **1.2** Router tests in the existing suite: a new `describe("blJob.sourceStatus")` beside `:176` — no rows → both false; one `mycieds` row → `{ mycieds: true, sbcp: false }`; another org's rows do not count; the JSON of the result contains no `loginId`/`password` key; a member without `bl-job.read` → FORBIDDEN. In `describe("blJob.get")` (`:225`): `sourcesConfigured` present and correct. Files: `packages/api/src/routers/bl-job.test.ts`. · **Agent A**
- **1.3** `source-notice.ts` [NEW] with `sourceNotice(status, openJobs)` and its unit test (both missing, one missing, none missing, zero open jobs → null). Files: `apps/web/src/features/customs-tracking/source-notice.ts` [NEW], `apps/web/src/features/customs-tracking/source-notice.test.ts` [NEW]. · **Agent B (frontend)**
- **1.4** Render it: board (`customs-tracking.tsx`, a `useQuery(orpc.blJob.sourceStatus…)` with the same `enabled`, `retry: false`, `suppressErrorToast` as the list query `:86-94`; the notice above `<Table>` at `:190`; `openJobs` from `jobs.filter(j => canVoid(j.stage)).length`); record page (`bl-job-record.tsx` `exceptions()` `:397`, only while `!isFinished(stage)`); gate-out card (`card-gateout.tsx` near `:267`). Grep the three strings afterwards so the wording is identical (project rule on shared copy). Files: `apps/web/src/routes/_next/customs-tracking.tsx`, `apps/web/src/components/customs-tracking/bl-job-record.tsx`, `apps/web/src/components/shell-next/card-gateout.tsx`. · **Agent B**

**Acceptance.**
- `bl-job.test.ts` and `source-notice.test.ts` pass (read the output for `failed`).
- In a fresh org with seeded jobs and no logins, the board, one record page and the Overview card show the notice (§10 Journey 1); an org-wide grep finds the sentence in exactly one module (`source-notice.ts`).

### Phase 2 — The order shows its clock (F2, F3, F5)

**Delivers:** Journey 2 end to end.
**Dependencies:** D1 settled; step 11 Phase 2 and step 12 Phase 1 merged (`collective-order.numbering.test.ts`); probes 19-P2, 19-P3, 19-P6 read.

- **2.1** `packages/api/src/modules/bl-tracking/bl-number.ts` [NEW]: `normaliseBlNumber(s: string): string` (trim, upper-case) and a unit test. Files: that file and `bl-number.test.ts` [NEW]. · **Agent C (backend)**
- **2.2** Reshape `enrichOrderRows`' documents half as §4.2: replace `OrderCustomsState`/`OrderDocumentState`/`emptyDocumentState` with `OrderDocumentsPayload` and an empty-payload function; fold `documentRows` into `counts`; widen the customs select (`id`, `countdownDeadline`, `voidedAt`, `receivedAt`), normalise the compare (D4-B), gate it on `BL_JOB.read` as well (D3-B), and apply the D2-A rule per order. Import `BL_JOB` from `modules/bl-tracking/permissions`. Keep every existing comment that still holds (the masked-row rule at `:2054-2056`, the voided rule at `:2146-2150`); rewrite the "First one wins by number" comment (`:2190-2192`) to state the D2 rule. Export the payload type. Files: `packages/api/src/routers/collective-order.ts`. · **Agent C**
- **2.3** Rewrite the server test block "the document rollup on an order row" (`collective-order.numbering.test.ts:546-760`) to the new shape: update the `Rollup` type (`:547-556`); the zeroed case (`:586`) becomes `{ counts: [], customs: { match: "none", candidates: 0, job: null } }`; the null case (`:603`) unchanged; the counting cases (`:611`, `:630`, `:643`, `:716`) assert `counts` buckets; the MBL case (`:657`) asserts `match: "exact"` with `job.id`, `job.countdownDeadline`; the voided case (`:683`) asserts `match: "none"`. New cases: finished + open same number → the open job; two open → `ambiguous`, `candidates: 2`, `job: null`; two finished → the newest by `receivedAt`; MB/L `" seed-bl-1 "` against job `SEED-BL-1` → matches; MB/L matches nothing but HB/L does → the HB/L job; a member holding `document.read` without `bl-job.read` → `customs.match: "none"` while `counts` still answers; `collectiveOrder.get` returns the same `documents` as the `list` row. Files: `packages/api/src/routers/collective-order.numbering.test.ts`. · **Agent C**
- **2.4** Web: link the BL number in `MatchedCustoms` to `/customs-tracking/$jobId` (`order-documents-card.tsx:224`). Contract test (D5-A): in `rollup.test.ts`, a fixture typed `NonNullable<Awaited<ReturnType<AppRouterClient["collectiveOrder"]["get"]>>["documents"]>` (a `satisfies` on a literal) fed to `readOrderDocumentRollup({ documents: fixture })` must be non-null and `customsView` must return `matched`. If the server shape drifts, the fixture stops compiling. Files: `apps/web/src/features/order-documents/order-documents-card.tsx`, `apps/web/src/features/order-documents/rollup.test.ts`. · **Agent D (frontend)**

**Acceptance.**
- The Phase 2 suites pass; `bun run check-types` shows no `error TS` in `apps/web` or `packages/api` (read the output).
- In the browser, the ledger pane and the B/L record page show the card with the countdown chip for an order whose MB/L is an open job's BL number (§10 Journey 2), and the BL number opens the job.

### Phase 3 — From the job to its order and fees (F4)

**Delivers:** Journey 3 end to end.
**Dependencies:** Phase 2 (`bl-number.ts`) and Phase 1 (`bl-job.ts`) merged.

- **3.1** `blJob.get` gains `orders` (§4.3), importing `collectiveOrder`, `orderScopeCols` (`collective-order.ts:74`) and `COLLECTIVE_ORDER`. Files: `packages/api/src/routers/bl-job.ts`. · **Agent E (backend)**
- **3.2** Tests in `describe("blJob.get")`: order with matching MB/L → one entry; matching HB/L → one entry; archived order → excluded; order outside the caller's order scope (branch-scoped member) → excluded; caller without `collectiveOrder.read` → `orders: null`; seven matching orders → six returned; another org's order with the same number → excluded. Files: `packages/api/src/routers/bl-job.test.ts`. · **Agent E**
- **3.3** Record page Order and Fees fields (§4.3). Files: `apps/web/src/components/customs-tracking/bl-job-record.tsx`. · **Agent F (frontend)**

**Acceptance.**
- `bl-job.test.ts` passes; `check-types` clean.
- From `/customs-tracking` → a job → **Order** opens the order record page; **Fees** opens `/order/<id>/expenses` (§10 Journey 3).

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | sonnet | medium | 1.1, 1.2 | `packages/api/src/routers/bl-job.ts`, `packages/api/src/routers/bl-job.test.ts` | `packages/db/src/schema/tracking-source.ts`, `packages/api/src/modules/tracking-source/credentials.ts`, `packages/api/src/modules/bl-tracking/permissions.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.3, 1.4 | `apps/web/src/features/customs-tracking/source-notice.ts` [NEW], `…/source-notice.test.ts` [NEW], `apps/web/src/routes/_next/customs-tracking.tsx`, `apps/web/src/components/customs-tracking/bl-job-record.tsx`, `apps/web/src/components/shell-next/card-gateout.tsx` | `apps/web/src/features/customs-tracking/countdown.ts`, `apps/web/src/components/record-page/exceptions.ts` |

Run mode: A (1.1) → B, then A's 1.2 ∥ B. Contract: `blJob.sourceStatus` output `{ mycieds: boolean; sbcp: boolean }` and `blJob.get.sourcesConfigured` of the same shape; B starts once `check-types` sees them.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (backend) | backend-engineer | opus | high | 2.1–2.3 | `packages/api/src/modules/bl-tracking/bl-number.ts` [NEW], `…/bl-number.test.ts` [NEW], `packages/api/src/routers/collective-order.ts` (the `enrichOrderRows` documents half only), `packages/api/src/routers/collective-order.numbering.test.ts` (the rollup `describe` only) | `packages/port-tracking/src/transitions.ts`, `packages/api/src/modules/bl-tracking/permissions.ts`, `packages/api/src/procedures/org.ts` |
| Agent D (frontend) | frontend-engineer | sonnet | medium | 2.4 | `apps/web/src/features/order-documents/order-documents-card.tsx`, `apps/web/src/features/order-documents/rollup.test.ts` | `apps/web/src/features/order-documents/rollup.ts`, `apps/web/src/utils/orpc.ts` |

opus for C: a shared enrichment helper on a 4,800-line router that steps 11, 12, 13, 14 and 15 also edit, feeding both `list` and `get`, with a query-count test to keep.
Run mode: C → D (D's contract test needs the exported type).

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent E (backend) | backend-engineer | sonnet | medium | 3.1, 3.2 | `packages/api/src/routers/bl-job.ts`, `packages/api/src/routers/bl-job.test.ts` | `packages/api/src/routers/search.ts`, `packages/api/src/routers/collective-order.ts` |
| Agent F (frontend) | frontend-engineer | sonnet | low | 3.3 | `apps/web/src/components/customs-tracking/bl-job-record.tsx` | `apps/web/src/components/shell-next/record-routes.ts` |

Run mode: E → F.

**Schedule:** Phase 1 ∥ Phase 2 is possible (disjoint files); Phase 3 after both (it edits `bl-job.ts` after Phase 1 and imports Phase 2's helper).
**Serialization points:** after each phase, `bun run check-types` and grep the output for `error TS` and `failed` (it can exit 0 while printing "failed"); run both architecture tests (`packages/api/src/architecture.test.ts`, `apps/web/src/architecture.test.ts`); restart `:3000` before any browser check (`bun --hot` does not reload `packages/api`).
**Commits:** one committer at a time in a shared worktree; confirm the index is empty before `git add`; read every hunk of `collective-order.ts` (other plans' work lands in the same file).

**Smell test.**
- [x] Every task has exactly one owner.
- [x] No file is owned twice within a phase; `bl-job.ts` and `bl-job-record.tsx` pass Phase 1 → Phase 3 in order.
- [x] Each A → B contract is named.
- [x] One opus, justified.
- [x] Each phase completes a journey (1, 2, 3).

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`, 2026-09-21)

- **`enrichOrderRows`**: `collectiveOrder.list` (`collective-order.ts:2463`) and `get` (`:2494`). No other caller.
- **`documents` output field**: web `readOrderDocumentRollup` in `order-ledger-page.tsx:868` and `lading/$id/index.tsx:138`. No web reader of `documentCount`, `documentsByType`, `documentsByStatus`, `documentsNeedingReview`, `documentsApproved`, `customsStatus` (on orders) or `blStage`. Server test `collective-order.numbering.test.ts:546-760`. No e2e reference (grep of `e2e/` for "No customs job", "Match not certain", "72h gate-out clock").
- **`collectiveOrder.get` other readers** (`order-form.tsx:716`, `order-ledger/order-record-page.tsx:34`, `order.$orderId.expenses.tsx:460`, per step 15 §7.1): none reads `documents`.
- **`blJob.get`**: web `customs-tracking_.$jobId.tsx:70`; `BlJobRecord` is inferred from the router, so the new fields reach the page's types without a cast. Tests `bl-job.test.ts:225-388`.
- **`bl-job.ts` exports** `blJobScopeCols`, `blJobTextMatch`, `blJobQuery`: used by `search.ts:20`. Unchanged.
- **`tracking_source_config`** readers: `credentials.ts` (`loadSourceCredentials`, `list`) and `routers/tracking-source.ts`. The new read selects one column and changes no writer.
- **Seed**: `seed/customs.ts` writes `SEED-BL-001…015` directly; `seed/operations.ts:216` gives orders `SEED-MBL-…`, so no seeded order matches a seeded job today (§10 sets one by hand).

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| Board, no logins, open jobs | rows "Pending" / "—" for ever, no sign | notice naming the missing source | API first: web ignores the new procedure. Web first: `sourceStatus` 404s, `retry: false` + suppressed toast → no notice (today's state) |
| Order pane / B/L page Documents card | renders nothing | renders checklist + customs line + countdown | API first: the **old** web already expects `{counts, customs}`, so the card starts rendering at once (the web change only adds the BL link). Web first: the reader gets the flat shape → null → blank (today's state) |
| Several jobs share a BL | arbitrary job in a payload nobody read | open job, or "Match not certain" | – |
| Job record → order | no link | Order and Fees links | API first: fields ignored. Web first: `orders` undefined → treat as `null` (no field) |

### 7.3 Behaviour change for existing orgs

- **The Documents card appears on every order for every org** with `document.read` once Phase 2's server deploys. Its checklist half reads `document_link` rows with `entity_type = 'collective_order'`, which no screen writes today (the step 18 break). So **every order will show "MBL / HBL — Missing", "Commercial invoice — Missing", "Packing list — Missing"**, even orders whose BL is being tracked. Probe **19-P4** confirms the count. The card calls itself advisory (`order-documents-card.tsx:29-35`), but three red "Missing" lines under a running customs clock is a contradiction ops will notice. This is why D1 exists: the recommended merge order puts step 18's link-writing fix before Phase 2 (§7.6).
- **Orgs without logins** see the Phase 1 notice as soon as the web deploys (probe 19-P1 says which).
- **No data is written or changed** by any phase. No alert, check or schedule changes.

### 7.4 Nullable assumptions

- `collective_order.mbl` / `hbl` are nullable text (`schema/collective-order.ts:204-205`); null or blank-after-trim never matches (`normaliseBlNumber` of `""` is skipped).
- `bl_job.countdown_deadline` is null until berth; the card shows the stage chip and no clock (`order-documents-card.tsx:209`).
- `bl_job.vessel_name` nullable; unaffected.
- `collective_order.job_number` nullable; the Order link then reads _"Order without a job number"_ and still links by id.
- `collective_order.business_type` is NOT NULL; a value missing from `TRADE_SEGMENT` renders text, never a wrong link (`record-routes.ts:88-93` precedent).

### 7.5 Deployment coupling

- Each phase deploys on its own; server first is safe in every row of §7.2. Build `apps/web` first so a partial deploy does not split the stage (memory `alchemy-partial-deploy-splits-the-stage`).
- **Do not touch `packages/infra/alchemy.run.ts`.** The prod cron list was changed on the unmerged branch `chore/prod-neon-compute-burn` (`a085b4da` in `.deploy-prod`, 2026-09-20: mailbox sweep removed, fleet poll disabled by env). The two BL crons stay on prod; none of this plan's phases needs the schedulers to change.
- The schedulers run on prod only (`alchemy.run.ts:224`), so nothing in §10 depends on a cron firing; local proof uses seeded rows.

### 7.6 Merge order against steps 04–27

| Plan / task | Shared code | Relation to step 19 |
|---|---|---|
| 04–10 | none (quotation side) | No overlap. |
| **11 Task 2.1** | `collective-order.ts:2288-2418` moves out | Below `enrichOrderRows` (`:1891-2260`); step 19's region does not shift. Re-locate by symbol anyway. |
| **11 Tasks 2.3/2.4, 12 Tasks 1.3/3.2** | `collective-order.numbering.test.ts` (numbering `describe`s) | Step 19 Task 2.3 edits only the rollup `describe` (`:546-760`). **11 → 12 → 19 P2**; the second to merge rebases. |
| 13 | `order-ledger-page.tsx` pane actions (`:1229-1236`, `:1576-1590`) | Step 19 does not edit `order-ledger-page.tsx`. None. |
| 14 | `collective-order.ts` `create`, `update`, `status` | Different functions. Either order. |
| **15 P1** | `collectiveOrder.get` (`:2471`) gains `underReview` after the `enrichOrderRows` call | Step 19 edits `enrichOrderRows`, not `get`. Adjacent, no shared lines. Either order. |
| **15 P3** | gate calls in `routers/lading.ts` and `costLines.create` | **Step 19 touches neither file and keeps both calls.** |
| **16–17** (`step-16-lading-create.md`, `step-17-lading-states-and-review.md`) | `routers/lading.ts`, `lading/$id/index.tsx` (the second mount of the card) | Step 19 edits neither. If 16/17 change how the B/L page loads its order (`lading/$id/index.tsx:132-138`), they keep `readOrderDocumentRollup(orderQuery.data)`. |
| **18** (`step-18-bl-document-approval.md`) | document intake hook (`intake.ts`), `document_link` writer, and — per its SOP break — the `documents` payload shape in `enrichOrderRows` | **D1, Decided A (X23, settled 2026-09-21):** step 19 owns the whole `documents` reshape; step 18 owns the `document_link` writer and intake and writes no payload code (its D3-A). **18's link-writer phase (18 Phase 1) → 19 Phase 2**, merged and deployed first, so the checklist half is true when the card first renders (§7.3). |
| 20 (`/order/$orderId/expenses`) | the Fees link target | If step 20 moves or renames the route, it updates `bl-job-record.tsx`'s Fees link. |
| 21–27 | none found | No overlap known at writing; later plans that change `blJob.get` or the Documents card keep the §4.5 contracts. |

**Required order:** Phase 1 any time. 11 P2 → 12 → **18 (link writer) → 19 Phase 2 → 19 Phase 3**.

### 7.7 Read-only production probes (SELECT only; Wilfred runs them; none blocks Phase 1 code)

All `bl_job` timestamps are `timestamp without time zone` written from JS `Date` (UTC). Compare with `(now() at time zone 'utc')` and check one row against the board before trusting a result.

```sql
-- 19-P1 Orgs with open jobs, whether each portal login is saved, and when a check last landed (Phase 1 urgency, D7)
select j.organization_id,
       count(*) as open_jobs,
       exists (select 1 from tracking_source_config t
               where t.organization_id = j.organization_id and t.source = 'mycieds') as mycieds_saved,
       exists (select 1 from tracking_source_config t
               where t.organization_id = j.organization_id and t.source = 'sbcp') as sbcp_saved,
       (select max(e.occurred_at) from bl_event e
         where e.organization_id = j.organization_id and e.type = 'check_observed') as last_check_observed,
       count(*) filter (where j.countdown_deadline is not null) as clocks_running
from bl_job j
where j.stage not in ('gated_out', 'voided')
group by j.organization_id
order by open_jobs desc;

-- 19-P2 BL numbers with more than one non-voided job, split open vs finished (D2)
select organization_id, upper(btrim(bl_number)) as bl,
       count(*) filter (where stage not in ('gated_out', 'voided')) as open_jobs,
       count(*) filter (where stage = 'gated_out') as finished_jobs,
       min(received_at), max(received_at)
from bl_job
where stage <> 'voided'
group by 1, 2
having count(*) > 1
order by open_jobs desc, finished_jobs desc;

-- 19-P3 Orders that match a job exactly vs only after trim/upper (D4)
with jobs as (
  select organization_id, bl_number, upper(btrim(bl_number)) as n
  from bl_job where stage <> 'voided')
select co.organization_id,
       count(*) filter (where exists (select 1 from jobs j where j.organization_id = co.organization_id
                                        and j.bl_number in (co.mbl, co.hbl))) as exact_match,
       count(*) filter (where exists (select 1 from jobs j where j.organization_id = co.organization_id
                                        and j.n in (upper(btrim(co.mbl)), upper(btrim(co.hbl)))))
         as normalised_match
from collective_order co
where co.archived = false
group by co.organization_id
order by 1;

-- 19-P4 What the Documents checklist will read once it renders: document links by target type (D1, §7.3)
select organization_id, entity_type, count(*) as links
from document_link
group by 1, 2
order by 1, 2;

-- 19-P5 Open jobs past their deadline with boxes still in the yard, and their last alert (Q1)
select j.organization_id, j.id, j.bl_number, j.stage, j.countdown_deadline,
       (now() at time zone 'utc') - j.countdown_deadline as overdue_by,
       (select count(*) from bl_container c where c.bl_job_id = j.id and c.port_status <> 'gate_out') as in_yard,
       (select count(*) from bl_container c where c.bl_job_id = j.id) as containers,
       (select max(e.occurred_at) from bl_event e where e.bl_job_id = j.id and e.type = 'threshold_crossed') as last_alert
from bl_job j
where j.stage not in ('gated_out', 'voided')
  and j.countdown_deadline < (now() at time zone 'utc')
order by j.countdown_deadline;

-- 19-P6 Roles that can read documents but not BL jobs (D3); re-read role_node_grant columns at the base commit
select r.organization_id, r.name,
       bool_or(g.node_key in ('document', 'document.read')) as document_read,
       coalesce(bool_or(g.node_key in ('bl-job', 'bl-job.read')), false) as bl_job_read
from role r
left join role_node_grant g on g.role_id = r.id
group by r.organization_id, r.name
having bool_or(g.node_key in ('document', 'document.read'))
   and not coalesce(bool_or(g.node_key in ('bl-job', 'bl-job.read')), false)
order by 1, 2;

-- 19-P7 Who can void today: roles and member overrides granting bl-job.void, plus owners (Q3)
select r.organization_id, 'role' as via, r.name as who
from role r join role_node_grant g on g.role_id = r.id
where g.node_key in ('bl-job', 'bl-job.void')
union all
select o.organization_id, 'override:' || o.effect, o.member_id
from member_override o where o.node_key in ('bl-job', 'bl-job.void')
union all
select m.organization_id, 'owner', m.id from member m where m.role = 'owner'
order by 1, 2;
```

### 7.8 Blocking prerequisites

- Phase 1: none.
- Phase 2: D1 settled with step 18's plan (Decided A, crosscheck X23); step 11 Phase 2 and step 12 Phase 1 merged; step 18's `document_link` writer merged under D1-A; probes 19-P2 (D2), 19-P3 (D4), 19-P6 (D3) read. A probe that contradicts its recommendation stops the task for a re-plan.
- Phase 3: Phases 1 and 2 merged.
- No probe blocks writing Phase 1 code.

## 8. Cross-Cutting Concerns

- **Errors.** No new refusals. The new read is FORBIDDEN without `bl-job.read`, like the rest of the router. Web queries use `retry: false` and suppressed toasts, so a missing permission or an old server shows today's screen, never a red toast.
- **Security.** `sourceStatus` selects the `source` column only; Task 1.2 asserts no credential key leaves the server. The order lookup in `blJob.get` applies the order Data scope and fails closed (`?? sql\`false\``, the `search.ts` rule).
- **Testing.** PGlite router suites at the API boundary (`bl-job.test.ts`, `collective-order.numbering.test.ts`); pure unit tests (`bl-number.test.ts`, `source-notice.test.ts`, `rollup.test.ts`); the typed contract fixture (D5-A); browser proof in §10. No concurrency is added, so no real-Postgres test is needed.
- **Migration.** None under the recommendations (D4-C, D6-C would add `00NN_bl_number_normalise`, `00NN_bl_job_order_link`, numbered at merge).
- **Rollback.** Every phase is a plain revert: no data is written, no schema changes. Reverting Phase 2 returns the card to blank.
- **Audit trail.** Reads only; nothing to audit.
- **Copy.** The Phase 1 sentence lives in `source-notice.ts` only; the three screens import it. The card's existing strings are unchanged.

**Performance & Scalability**
1. **Pagination.** `list` is still unbounded (unchanged). The order lookup is `limit 6`.
2. **SQL-side filtering.** The customs match filters in SQL by org and normalised number; the D2 choice is made per order over the few rows returned.
3. **N+1.** None. `enrichOrderRows` keeps one customs query per page and one document query per page (the test at `:716` still holds). `sourceStatus` is one query; `blJob.get` gains two single queries.
4. **Index coverage.** `upper(btrim(bl_number))` cannot use `blJob_organizationId_blNumber_idx` (`schema/bl-tracking.ts:65`) as an expression, but `organization_id` narrows first (`blJob_organizationId_idx` `:61`); per org the job count is small. The order lookup uses `collective_order_organizationId_idx` (`schema/collective-order.ts:350`); there is no index on `mbl`/`hbl`, same as `search.ts` today. An expression index is a later option if 19-P1 shows thousands of jobs per org.
5. **Write atomicity.** No writes.
6. **Row locking.** None.
7. **Connections.** None new.
8. **Tenant isolation.** Every new read filters `organization_id`; the order lookup adds the order scope.
9. **Payload size.** Order rows gain a `counts` array (bounded by doc types × statuses, at most 24 entries) and a small `customs` object; `blJob.get` gains at most six order stubs.
10. **Hot path.** `collectiveOrder.list` runs on every ledger view: its customs query gains three columns and an expression compare. The board and Overview gain one tiny query each (30 s refetch).

## 9. Decision Register, Open Questions & Risks

**Statuses.** On 2026-09-21 Wilfred accepted the Recommended option of **every** decision below, and every cross-plan settlement in `steps-16-19-crosscheck.md` (X17–X27), so all seven are **Decided**. No X-item overrides a recommendation here; X23 settles D1-A together with step 18 D3-A. Tasks are worded for the Chosen option; each decision keeps its three approaches and its "Changes if not …" line as history. Where a decision leans on a production probe, the probe stands as a re-check: the choice holds, but a contradicting result stops the task for a re-plan (D4 names its own fallback: drop Task 2.1 if 19-P3 shows no difference). The grouping headings below ("Open — blocking", "Open — non-blocking") are kept as written because headings are page anchors; they now say only which phase each decision released. The open questions Q1–Q3 are unchanged: they are not decisions and are not planned.

### Open — blocking

**D1: Who reshapes the order `documents` payload — step 18 or step 19?** · Status: **Decided 2026-09-21 — Chosen: A** (the step 18 break and the `island` ledger item both name this code)

| | Approach | Consequence |
|---|---|---|
| **A** | **Step 19 owns the whole `documents` reshape** (counts and customs) in `enrichOrderRows`; step 18 owns the `document_link` writer and intake; step 18's link writer merges before step 19 Phase 2 (Recommended) (Chosen) | One owner for one function and one test block. The customs half is the harder part (match rule, ambiguity, permission). The card first renders with a true checklist. Step 19 Phase 2 waits on step 18. |
| **B** | Step 18 reshapes the counts half; step 19 later adds the customs half | Two plans edit the same fold and the same test block in sequence; the card renders after step 18 with a customs line that still has no deadline until step 19. |
| **C** | Step 19 ships Phase 2 without waiting for step 18 | The card renders at once, with "Missing" on every checklist line of every order until step 18 lands (§7.3). |

- **Recommendation: A.** The shape fix is one change to one function; splitting it gives two half-working cards.
- **Changes if not A:** B moves Task 2.2's counts half and Task 2.3's counting cases to step 18; C drops the step 18 prerequisite from §5 and §7.8 and adds a release note.

**D2: Which job does an order show when several share its BL number?** · Status: **Decided 2026-09-21 — Chosen: A** · probe 19-P2

| | Approach | Consequence |
|---|---|---|
| **A** | Open job wins; none open → newest finished by `receivedAt`; two or more open → `ambiguous` (Recommended) (Chosen) | Matches intake's own rule that only an open job is "already tracked" (`intake.ts:108-126`). A re-used BL number from last season never hides this season's clock. Ambiguity appears only after an intake race. |
| **B** | Any two non-voided candidates → `ambiguous` | Safest against a wrong clock, but every order whose BL was ever tracked twice (a cancelled first shipment that gated out) loses its clock for good. |
| **C** | Newest by `receivedAt`, never ambiguous | Simple; a newer job that is a duplicate from a race silently wins; the web's ambiguity state is never used. |

- **Recommendation: A.**
- **Changes if not A:** Task 2.2's rule and Task 2.3's three multi-job cases.

**D3: Which permission shows the customs line on the order?** · Status: **Decided 2026-09-21 — Chosen: B** · probe 19-P6

| | Approach | Consequence |
|---|---|---|
| **A** | `document.read` only (today) | A custom role without `bl-job.read` sees a BL job's stage and clock on the order, and a link to a page that refuses it. |
| **B** | `document.read` **and** `bl-job.read`; no `bl-job` data scope (Recommended) (Chosen) | The Function axis matches the board's. The Data axis follows the parent-order rule the document half already states (`collective-order.ts:2043-2051`). Every static role holds both, so no seeded role changes. |
| **C** | `bl-job.read` plus the `bl-job` data scope | A branch-scoped member sees "No customs job" on an order whose BL was uploaded in another branch — a false "none", which the reader cannot tell from a real one. |

- **Recommendation: B.**
- **Changes if not B:** one condition in Task 2.2 and one case in Task 2.3.

**D4: How are BL numbers compared?** · Status: **Decided 2026-09-21 — Chosen: B** · probe 19-P3

| | Approach | Consequence |
|---|---|---|
| **A** | Exact string (today) | No false matches; a trailing space or a lower-case letter typed on the order hides the clock. |
| **B** | Trim and upper-case both sides at read time (Recommended) (Chosen) | Catches the typing differences; BL numbers are case-insensitive in practice. Cannot use the `(org, bl_number)` index; org narrows first (§8 item 4). No data change. |
| **C** | Normalise on write and backfill (`00NN_bl_number_normalise`) | Index-friendly and exact thereafter; a migration and a backfill of two tables for a lookup that is small per org. |

- **Recommendation: B**, unless 19-P3 shows `exact_match = normalised_match` everywhere, in which case A is enough and Task 2.1 is dropped.
- **Changes if not B:** Task 2.1 and the compare in Tasks 2.2 and 3.1.

### Open — non-blocking

**D5: How do the two sides of the payload stay in step?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | A web test with a fixture typed from `AppRouterClient["collectiveOrder"]["get"]`'s `documents`, fed to the untyped reader (Recommended) (Chosen) | A server shape change stops `check-types`; the reader stays runtime-validated for old cached rows. One test file. |
| **B** | Server test asserts the exact keys only | Catches server drift, not a client that drifts from the server. |
| **C** | A shared zod schema in a package both import | Strongest; a new shared module for one payload, and the reader's deliberate leniency (`rollup.ts:97-113`) has to be rebuilt on top. |

- **Recommendation: A.** Changes if not A: Task 2.4's test.

**D6: How does a tracking job reach its order?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | `blJob.get` returns the matching orders by BL number, order-scoped (Recommended) (Chosen) | No migration; the same lookup `search.ts` already does; always current when an order's MB/L is edited. Several orders can match and are listed. |
| **B** | A separate `blJob.orders` procedure | Same data, a second round trip and a second loading state on the record page. |
| **C** | `bl_job.order_id` written at intake (`00NN_bl_job_order_link`) | A real link, but intake has no order to link at approval time (the document is not linked to one — the step 18 break), so it would still need this lookup to fill it, plus a backfill. |

- **Recommendation: A.** Changes if not A: Tasks 3.1–3.3.

**D7: How is a missing portal login surfaced?** · Status: **Decided 2026-09-21 — Chosen: B** · probe 19-P1

| | Approach | Consequence |
|---|---|---|
| **A** | The runner writes a once-per-job `source_unconfigured` event and it joins `BLOCKED_REASONS` (`bl-job.ts:52`) | Shows on the Overview blocked card per job; one row per job for a per-org cause; touches the runner and the event vocabulary; stale events remain after logins are saved unless the blocked read also checks config. |
| **B** | One org-level read (`blJob.sourceStatus`, plus `get.sourcesConfigured`) and one notice on the board, record page and gate-out card (Recommended) (Chosen) | Says the cause where it is (the org); disappears the moment logins are saved; no automation change. Nothing is emailed. |
| **C** | Email owners and admins when a sweep skips for missing logins | Reaches someone who can fix it, but needs a dedup ledger per org and changes the automation; an email nobody reads is the failure mode this avoids. |

- **Recommendation: B.** Changes if not B: all of Phase 1.

### Open questions (not planned; Wilfred to answer)

- **Q1: Should an overdue job keep alerting?** Today the 8h email is the last (`thresholds.ts:17`). Probe 19-P5 shows how many jobs sit past deadline with boxes in the yard and when they were last alerted. If yes, it is a new threshold (e.g. 0h, then daily), a change to the alert rule — a separate small plan.
- **Q2: Is the haulage link (trucks to jobs) wanted?** Needs a new entity; not a repair.
- **Q3: Should a static role hold `bl-job.void`?** Today only the owner can void unless an admin grants it (`modules/bl-tracking/permissions.ts:3-9`); probe 19-P7. The SOP says "needs bl-job:void" without saying nobody has it by default.

### Risks

- **The Documents card renders with "Missing" on every order** if Phase 2 lands before step 18's link writer. Certain under D1-C; → **D1-A merge order; 19-P4 sizes it; release note if the order cannot be kept.**
- **Step 18's plan also reshapes `documents`.** Resolved: step 18 recommended the same owner, and X23 settled both (18 D3-A, 19 D1-A) on 2026-09-21; step 18 writes no payload code.
- **`collective-order.ts` line drift.** Certain (steps 11–15 edit it). → **Locate by symbol; read every hunk before committing.**
- **The notice fires in an org that deliberately has no logins** (a demo or QA org). Low impact → it is true there too; it says checks are off.
- **A stale `:3000` makes browser checks pass on old code.** High → **restart after every `packages/api` change; check the process start time.**
- **Seeded orders never match seeded jobs** (`SEED-MBL-…` vs `SEED-BL-…`). Certain → **§10 sets one order's MB/L by hand.**

### SOP text vs code (Phase 0 wins)

| # | SOP claims (step 19) | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| 1 | Pitfall 2: the order's documents card "renders without its countdown chip" | The card renders **nothing**: the server sends a flat object with no `counts`, so `readOrderDocumentRollup` returns null (`rollup.ts:118`). Both the checklist and the customs line are missing, on the ledger pane and the B/L page | Code (F2, Phase 2) |
| 2 | "The server does match jobs to orders by B/L number" | True (`collective-order.ts:2152-2168`), but on exact strings, excluding only voided jobs, with no ORDER BY, keeping the first row per number — it can show an old finished job | Code (F3, D2, D4) |
| 3 | Before: "A document carrying the B/L was approved at step 18. Nothing else starts a tracking job." | True, and only for `mbl_hbl` with an extracted BL number; a second document for a BL with an open job starts nothing (`intake.ts:56-135`). **Omits the portal logins**, without which nothing is checked and no clock can start (`runner.ts:194-198`, `:245-261`) | Code (F1, Phase 1) |
| 4 | "Two schedulers poll MYCIEDS and SBCP — customs three times a day, the port hourly" | True on the prod stage only (`alchemy.run.ts:224`); at 09:00, 12:00, 15:00 MYT (`index.ts:323`) | Code |
| 5 | "The 72-hour countdown starts itself at berth" | True; it starts even while customs is pending (`transitions.ts:169-171`), when the stage stays "awaiting customs" and gate-out is not polled until customs clears (`runner.ts:278-282`) | Code |
| 6 | "Every member of the job's owning branch is emailed on a countdown threshold" | At 24h and 8h only, the most urgent unfired one (`thresholds.ts:17-31`); an unstaffed branch falls back to the org's owners and admins (`recipients.ts:98-104`); nothing is sent after the deadline passes | Code (Q1) |
| 7 | "and on a structural failure" | Once per check type per job (`runner.ts:115-154`); transient failures are retried by the queue, not emailed | Code |
| 8 | Role: "needs bl-job:void to void a job" | True; no static role holds it, so by default only the owner can void (`modules/bl-tracking/permissions.ts:3-9`) | Code (Q3) |
| 9 | "The board sorts by urgency" | On the client (`sortJobsByUrgency`, `customs-tracking.tsx:106`); the server returns every job, newest received first, unbounded (`bl-job.ts:117-121`) | Code |
| 10 | Routes: "/tracking — Live Tracking, the map you leave open" | The fleet map; it has no link to `bl_job` (ledger item `haulage`). Per the 2026-09-20 ops note the prod fleet poll is switched off by env, so the map is dark on prod until re-enabled | Not planned |
| 11 | Golden-path citations (`customs-tracking.tsx:193`, `:119`; `bl-tracking-worker.ts:59`, `:98`; `transitions.ts:171`) | All five located at the cited lines | – |

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000. One worktree's servers at a time.
**Preconditions:**
- A dev org with seeded BL jobs and orders. Either (a) the `seed/` CLI against the dev org: `seed customs --write` (writes `SEED-BL-001…015`, all five stages, `seed/customs.ts:37-56`) and `seed operations --write` (orders with `SEED-MBL-…`); re-read `seed/cli.ts` for the exact invocation at the base commit; or (b) a fresh `seed-parity` org (`e2e/fixtures/seed-cli.ts seed-parity <runId>`, owner cookie; memory `browser-verification-via-seed-parity`) with `runCustoms` pointed at its org id. Option (b) has **no** `tracking_source_config` rows, which Journey 1 needs; do not remove logins from a shared org to get that state.
- Useful seeded jobs: `SEED-BL-006` at port, about 66h left; `SEED-BL-007` under 24h; `SEED-BL-011` gated out; `SEED-BL-014` voided; `SEED-BL-003` awaiting customs with no order. Seeded jobs carry no containers, so the board shows the "Missing" container prompt — expected.
- Pick one sea-export order **O1**. On `/order/<O1>/edit` set **MB/L NO.** to `SEED-BL-006` and save (seeded orders never match seeded jobs otherwise).
- Confirm the actor with `fetch('/api/auth/get-session')`. Restart `:3000` after the last `packages/api` edit. Do not switch the active org in a shared session (memory `shared-session-active-org`).

**Migrations:** none. The journal is unchanged by this plan; check `_journal.json` against the database, not a command's exit code.

**Test commands** (read the output for `failed` and the `Test Files` line; `bun run check-types` can exit 0 while printing "failed"):
- Phase 1: `bunx vp test run packages/api/src/routers/bl-job.test.ts apps/web/src/features/customs-tracking/source-notice.test.ts apps/web/src/features/customs-tracking/countdown.test.ts packages/api/src/architecture.test.ts apps/web/src/architecture.test.ts`
- Phase 2: `bunx vp test run packages/api/src/modules/bl-tracking/bl-number.test.ts packages/api/src/routers/collective-order.numbering.test.ts apps/web/src/features/order-documents/rollup.test.ts packages/api/src/routers/search.test.ts packages/api/src/architecture.test.ts apps/web/src/architecture.test.ts`
- Phase 3: `bunx vp test run packages/api/src/routers/bl-job.test.ts apps/web/src/components/shell-next/record-routes.test.ts`
- Every phase: `bun run check-types` (confirm `apps/web` ran).

**Golden path — Journey 1 (Phase 1; owner of a seed-parity org with no logins)**
1. Navigate to `/customs-tracking` → the notice above the table names MYCIEDS and SBCP and says no 72-hour clock can start; the header count still reads "15 bills of lading".
2. Click `SEED-BL-001` → `/customs-tracking/<id>`; the exception card carries the **Checks off** line.
3. Click `SEED-BL-014` (voided) → no **Checks off** line (a closed job is not being checked anyway).
4. Navigate to `/overview` → the gate-out card shows the one-line _"Checks off — portal logins missing"_ link; clicking it opens `/customs-tracking`.
5. In the console, `await fetch('/rpc/blJob/sourceStatus', {method:'POST', headers:{'content-type':'application/json'}, body:'{"json":{}}'}).then(r=>r.json())` → `{ mycieds: false, sbcp: false }` and no other keys (re-read the oRPC wire format at the base commit).

**Edge case 1a: logins saved.** Proven at the API boundary by Task 1.2 (a `tracking_source_config` row inserted in the test). In an org that already has both logins saved, `/customs-tracking` shows no notice. Do not type real or dummy credentials into Settings for this check.

**Golden path — Journey 2 (Phase 2; same org)**
1. Navigate to `/order/sea-export`, select **O1** → the reading pane shows the Documents card: three checklist lines (they read "Missing" until step 18 links documents, §7.3) and a **Customs** line with **At port** and a countdown chip near 66h, plus _"72h gate-out clock running"_.
2. Click `SEED-BL-006` on that line → `/customs-tracking/<id>` for that job.
3. In the console, call `collectiveOrder/get` for O1 → `documents.customs.match === "exact"`, `documents.customs.job.countdownDeadline` set, `documents.counts` an array.
4. Open a lading linked to O1 (`/lading/<id>`; link one in its edit page if none) → the same card.

**Edge case 2a: normalised match.** Set O1's MB/L to `" seed-bl-007 "` and save (if the form trims, set it through `collectiveOrder/update` in the console) → the card shows the under-24h amber chip.
**Edge case 2b: voided.** Set O1's MB/L to `SEED-BL-014` → _"No customs job is tracking this shipment."_
**Edge case 2c: finished.** `SEED-BL-011` → **Gated out** chip and no clock.
**Edge case 2d: ambiguous and open-beats-finished.** Proven by Task 2.3 (two jobs with one number need a raw insert); not repeated in the browser.

**Golden path — Journey 3 (Phase 3)**
1. With O1's MB/L back at `SEED-BL-006`, open `/customs-tracking` → click `SEED-BL-006` → the Record group shows **Order** with O1's job number and **Fees**.
2. Click **Order** → `/order/sea-export/<O1>` (the trade's record page).
3. Back, click **Fees** → `/order/<O1>/expenses` (step 20's page) loads O1's fee grid.
4. Open `SEED-BL-003` → **Order** reads _"No order carries this B/L number"_ and there is no **Fees** field.

**Edge case 3a: no order permission.** As the seeded `viewer` of an e2e org (or a member without `collectiveOrder.read`), open a job → no Order field; `blJob/get` returns `orders: null`.

**Regression checks.**
1. `/customs-tracking` sort, Void dialog and toast _"Job voided — it will stop being checked and alerted on"_ unchanged; void one open seed job.
2. `/overview` gate-out and blocked cards unchanged apart from the Phase 1 line.
3. `/order/sea-export` ledger loads with no new console error and the same row count; `collective-order.numbering.test.ts` "exactly ONE document query" passes.
4. Global search for `SEED-BL-006` still finds the customs job and O1 (`search.test.ts`).
5. `/lading/<id>` still renders when its order is unlinked (the card renders nothing).

**Mobile:** at 400px the board notice wraps without horizontal scroll; the record page's Order and Fees fields wrap inside the group; the order pane's Documents card keeps its chips on one line or wraps without overflow.

**Readiness: 7/10 — the defects are verified and the fixes are small reads with no migration; every decision is settled (2026-09-21) and the ownership with step 18 is fixed by X23, so what holds it back is unrun probes, the merge order behind step 18, and seed data that needs one hand edit.**
- Decisions: none open. D1-A, D2-A, D3-B, D4-B, D5-A, D6-A, D7-B Decided; Q1–Q3 remain open questions, not planned.
- Phase 2 waits on step 18's `document_link` writer (18 Phase 1, merged and deployed first; D1-A, X23) and on steps 11 P2 and 12 for the shared test file.
- Probes 19-P1 (how many orgs are affected by F1), 19-P2, 19-P3, 19-P6 are unrun; each is a re-check that can stop the task it gates for a re-plan (19-P3 can drop Task 2.1 under D4's own rule).
- Phase 1 is independent and can ship first.

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and every recommended settlement in `steps-16-19-crosscheck.md` (X17–X27). Each §9 entry keeps all three approaches; only the status, the Chosen marks and the text that described a decision as open were changed.

**Chosen:** D1-A · D2-A · D3-B · D4-B · D5-A · D6-A · D7-B.

**Crosscheck settlements, as they land in this plan.** X23 → D1-A with step 18 D3-A: step 19 Task 2.2 owns the whole `documents` reshape (`counts` and `customs`, the D2 match rule, D3 permission, D4 normalisation); step 18 writes no payload code; 18 Phase 1 merges and deploys before this plan's Phase 2 (§5, §7.6, §7.8). X24 → the raw BL compare at step 18's intake is an accepted known gap; this plan's order card reports two such jobs as **Match not certain** (D2-A), and no task folds `normaliseBlNumber` into the intake. X26 → the conditional `00NN_bl_number_normalise` (D4-C) and `00NN_bl_job_order_link` (D6-C) were not chosen; if ever revived they take the next free number at merge. X27 → the SOP corrections in §9 stay unowned. **No X-item overrode a recommendation in this plan.**
