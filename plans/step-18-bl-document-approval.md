# Step 18 — an approved B/L document is filed against its job, a mis-typed B/L can still start tracking, and one bill of lading makes one tracking job

**SOP step:** 18 "Approve the carrier's MBL/HBL" · top nav **Documents** (`/documents`) → one document (`/documents/$documentId`) → **Approve (⌘⏎)**
**Evidence read at:** HEAD `6bb3a1bf6c4ba63a0c421f83e5a69093a93fb4dc` on `feat/new-layout`, 2026-09-21. The `nct-layout` worktree is checked out on `feat/intake-golden-path-e2e` at `ea1560e7`, and `git diff --stat 6bb3a1bf -- packages apps` is empty, so every `packages/` and `apps/` citation below matches the base commit. Every `file:line` was located by symbol in this pass. Paths are relative to `C:/Project/NCT/nct-layout`. `[NEW]` marks a file that does not exist yet.
**Tier:** Standard, small. Three phases, each one journey. Server changes are additive (one new procedure, two new output fields, one transaction around an existing hook). No migration under the recommended options. No existing input shape changes.
**Cross-plan items owned:** the "Documents → the job" break and the ledger item `paperwork` (SOP `repairs` `{b,18}` and `{s,18}`). The ledger item `island` names step 18 and step 19. The order `documents` payload reshape that makes the card render is claimed by `step-19-demurrage-clock-reach.md` (its D1, recommended "step 19, whole object", Task 2.2). This plan chose the same owner (D3-A, settled with step 19 D1-A under X23) and keeps an additive fallback spec (§4.2) only as the record of the rejected D3-B. What this plan must deliver for the card to be true is the link writing (Phase 1), which step 19 asks to merge before its Phase 2.
**Status of decisions:** every decision below is **Decided (2026-09-21)**. Wilfred took the recommended option of each (D1–D11 all A) and accepted every cross-plan settlement in `steps-16-19-crosscheck.md` (X17–X27). Under X23 (D3-A with step 19 D1-A), step 19 Task 2.2 owns the payload reshape, so Tasks 1.2 and 1.4, the §4.2 fallback spec and D4 are **not done** and stay in the plan only as the record of the rejected D3-B. See "Decisions settled (2026-09-21)" at the end.

---

## Phase 0 findings (read before the plan)

- **Stack.** oRPC routers in `packages/api/src/routers` (`orgProcedure`, `requireNode`, `applyScope`, `loadScoped` from `procedures/org.ts`). Drizzle schema in `packages/db/src/schema`. TanStack Router file routes in `apps/web/src/routes/_next`. Document extraction registry in `packages/document-ai/src/registry`. Port tracking in `packages/port-tracking/src`. The document pipeline is a Cloudflare Workflow in `apps/server/src/document/workflow.ts`. vitest on PGlite. Dev: web `:3101`, server `:3000`.

- **The step today, end to end.**
  - **Upload.** `/documents` mounts `<DocumentUploadDialog>` (`routes/_next/documents.index.tsx:337`; button `components/document-upload.tsx:97`). It calls `document.requestUpload` with filename, MIME type, size and branch only (`document-upload.tsx:65-70`). **It never sends `link`**, although the server accepts one (`routers/document.ts:443`, written at `:492-501`).
  - **Pipeline.** Classify → extract (Haiku, escalate to Sonnet) → validate → autonomy gate (`apps/server/src/document/workflow.ts:173-190`). The org default is `review_all` (`modules/document/autonomy.ts:21`), so a document is parked as `needs_review` with a draft extraction. Under `auto_approve` a clean document is finalised by the workflow, which runs the approval hooks itself (`workflow.ts:191-212`) and **drops any notice they return**.
  - **Review screen** (`routes/_next/documents.$documentId.tsx`). The original sits left (iframe for PDFs, `<img>` for images, a **Download original** card only for types the browser cannot paint, `:555-588`). Fields sit right, flagged first. `canReview = hasPerm(…, "document", "review")` (`:121`), `canLink = hasPerm(…, "document", "update")` (`:122`).
  - **Approve.** `submit()` (`:342`) calls `document.review.approve` when nothing was edited (`:363`) and `document.review.correct` when something was (`:376`); both finalise the document. The server's `approve` (`routers/document.ts:553`) refuses an unknown type (`:558`) and missing required fields (`:568`), finalises through `persistFinal` (`:574`; status guard `modules/document/persist.ts:186-191`) and then runs `runApprovalHooks` (`:593`).
  - **The hand-off.** The only registered hook is `blIntakeHook` (`modules/document/register-hooks.ts:8-34`, registered at `apps/server/src/index.ts:44`). It calls `ingestApprovedDocument` (`packages/port-tracking/src/intake.ts:52`), which returns nothing unless `docType === "mbl_hbl"` (`:56`) and `blNumber` is non-empty (`:79-82`), re-syncs when this document already has a job (`:60-70`), reports a duplicate when an unfinished job holds the same BL number (`:117-136`), and otherwise inserts `bl_job`, `bl_container` rows and a `job_created` event (`:141-182`). `bl_job` has no create endpoint (`routers/bl-job.ts`: `list`, `get`, `blocked`, `urgentSummary`, `void`), so **this hook is the only writer of tracking jobs** (confirmed by grep: `insert(blJob)` occurs only at `intake.ts:142` outside tests; `seed/customs.ts` writes by raw INSERT).
  - **Roles.** No "documentation" role exists. `document: review` is held by owner, admin, branch-manager, ops (`packages/auth/src/permissions.ts:104, 131, 153, 175`) and accounting (`:220`, read + review, no update). Sales hold create/read/update but not review (`:195`); viewer holds read (`:271`).

- **Finding A — paperwork cannot be filed against the job (ledger `paperwork`): confirmed; the server half was already repaired, the web half was not.**
  - `documentLinkEntityTypeEnum` is `["quote", "collective_order", "lading"]` (`routers/document.ts:109`), with an exhaustive tenancy check `assertLinkTargetInOrg` (`:126-159`). Tests at `document.test.ts:1638` ("the entity types beyond quote") pass today.
  - The only web caller is `LinkQuoteForm` (`documents.$documentId.tsx:870-913`): its picker is fed by `orpc.quote.list` (`:872`, the retired quote module) and it sends the literal `entityType: "quote"` (`:878`). The section heading reads **Linked quotes** (`:815`) and links render as `entityType · id-prefix` badges (`:818-824`). So no screen can write a `collective_order` or `lading` link.
  - **There is no unlink.** The router has `link` (`:382`) and nothing that deletes a `document_link`. A wrong link is permanent.
  - **The per-order Documents card never renders.** The server attaches `documents: { documentCount, documentsByType, documentsByStatus, documentsNeedingReview, documentsApproved, customsStatus, customsClearedAt, blStage }` to every order row (`routers/collective-order.ts:1844-1889`, attached at `:2258`). The web reader `readOrderDocumentRollup` returns `null` unless `documents.counts` is an array (`apps/web/src/features/order-documents/rollup.ts:114-118`), and the card renders nothing on `null` (`order-documents-card.tsx:75`). Both mounts are dead: the order reading pane (`components/order-ledger/order-ledger-page.tsx:865-869, 1201`) and the B/L record page (`routes/_next/lading/$id/index.tsx:138, 451`).
  - **The reader cannot be taught the server's shape.** The card's checklist needs the joint count per (type, status) (`rollup.ts:40-46`); the server sends two marginal maps (by type, by status), from which the joint count cannot be rebuilt. The server already computes the joint count — its query groups by `(entityId, docType, status)` (`collective-order.ts` in `enrichOrderRows`, the `groupBy` beside `eq(documentLink.entityType, "collective_order")`) — and then folds it away (`:2201-2216`). See D3.
  - **Fixing the card alone would lie.** Until links can be written, every order has zero linked documents, so a rendered card would show three **Missing** chips on orders whose B/L is approved. Linking and the card ship together (Phase 1).
  - The customs half: the server attaches `customsStatus`, `customsClearedAt`, `blStage` of the first non-voided `bl_job` matching the order's `mbl` or `hbl` (`:2150-2168`, `:2189-2199`, `:2220-2228`); the reader wants `customs: { match, candidates, job: { id, blNumber, stage, customsStatus, countdownDeadline, … } }` (`rollup.ts:56-74, 144-181`). `countdownDeadline` is a real column (`packages/db/src/schema/bl-tracking.ts:40`) that the server does not select. See D4.

- **Finding B — a mis-typed B/L cannot be re-typed at review, so it approves without tracking: new (not in the SOP), confirmed.**
  - The type Select is rendered only when the document has no type (`documents.$documentId.tsx:448`, `isUnknownType` `:333`). A document the classifier typed as `packing_list` or `commercial_invoice` shows a read-only badge (`:469-471`).
  - The server already supports re-typing: `correct` accepts `docTypeOverride` on any `needs_review` document (`routers/document.ts:613, 618`) and `persistFinal` writes it (`persist.ts:181`).
  - Approving it as the wrong type finalises it and runs the hook, which returns at `intake.ts:56`. **No tracking job, and no notice**: the toast reads "Extraction approved" (`:269`).
  - The only escape in the UI is **Not freight** (`:487-495`) → `discarded` with `failureReason: "rejected_by_reviewer"` (`routers/document.ts:698`) → **This is a freight document — reprocess** (`:611-621`), which re-runs the same classifier. `reprocess` does not accept a `needs_review` document (status set `routers/document.ts:890`). So the workaround records a false rejection and may land on the same wrong type.
  - After approval the type is frozen: `amend` passes no `docType` (`routers/document.ts:763-777`), although `persistAmendment` supports one (`persist.ts:136`). See D10.

- **Finding C — two copies of one B/L can make two tracking jobs: new, confirmed by reading.**
  - The duplicate check is a SELECT of unfinished jobs with the same `(organization_id, bl_number)` (`intake.ts:117-126`) followed by an INSERT (`:141-154`), with no lock. The only unique index on `bl_job` is `source_document_id` (`bl-tracking.ts:64`); `(organization_id, bl_number)` is a plain index (`:65`).
  - Two approvals of two documents for the same BL (a rescan and the carrier's email copy; a manual approval racing a workflow auto-approval) both see "not tracked" and both insert. The code's own comment names the consequence: "two pollers against the portals, and two countdowns able to raise their own demurrage alert for one container" (`intake.ts:97-102`).
  - **The intake is not atomic.** `ingestApprovedDocument` runs its INSERTs as separate statements on the plain `db` handle (`intake.ts:141-200`); `runApprovalHooks` passes `db`, not a transaction (`hooks.ts:43-77`). A failure after the job INSERT leaves a job without its containers or its `job_created` event.

- **Finding D — a failed hook is silent: new, confirmed.**
  - `runApprovalHooks` catches every hook error, logs it and returns no notice (`modules/document/hooks.ts:72-74`); `hooks.test.ts:114` pins that it resolves to `[]`. The reviewer sees "Extraction approved" while no tracking job exists.
  - Recovery exists but is hidden: an `amend` re-runs the hooks (`routers/document.ts:788`), and with no job for this document the intake takes the create path again. Nothing tells the reviewer to do that.

- **Finding E — validation errors are highlighted but never explained: new, confirmed.**
  - `decideReview` flags a field for every error-severity validation issue (`packages/document-ai/src/confidence.ts:39-43`), for example a container number that fails the ISO 6346 check digit (`registry/mbl-hbl.ts:45-63`).
  - The review screen reads `flaggedFieldsJson` (`documents.$documentId.tsx:225-229`) and never reads `issuesJson`, although `document.get` returns the whole extraction row (`routers/document.ts:365-370`). The reviewer sees an amber row and a confidence badge, not the sentence "Container number … fails the ISO 6346 check digit".
  - `approve` and `correct` do not look at error issues (`routers/document.ts:567-573`, `:634-639`). An approved misread container number is tracked as written, and the port poll never sees its gate-out.

- **Finding F — no K1/K2 customs declaration type: confirmed, a feature gap rather than a defect in this step.** `documentDocTypeEnum` is `mbl_hbl | commercial_invoice | packing_list | unknown` (`routers/document.ts:79-84`); the registry has three types (`modules/document/autonomy.ts:28`). Adding one is a registry change (schema, prompt hints, validators) in `packages/document-ai`. See D9.

- **Adjacent defects in the same paths (flagged, not planned here).**
  1. **Removing a member deletes their documents and tracking jobs.** `document.created_by` references `member.id` ON DELETE CASCADE (`packages/db/src/schema/document.ts:26-28`), `bl_job.source_document_id` cascades from `document` (`bl-tracking.ts` `sourceDocumentId`), and `org.members.remove` / `org.leave` hard-delete the member row (`routers/org.ts:606, 790`). Every table's `created_by` in this schema cascades the same way (12 schema files, including `collective-order.ts`, `expense.ts`, `lading.ts`). This is system-wide and needs its own plan and a migration; probe 18-P8 sizes how often members are removed.
  2. The workflow's auto-approve path discards hook notices (`workflow.ts:211`), so a duplicate or a failed start under `auto_approve` reaches nobody. Probe 18-P7 shows whether any org auto-approves B/Ls.
  3. BL numbers are compared as stored, with no trim or case fold (`intake.ts:123`, `collective-order.ts` `inArray(blJob.blNumber, …)`). `MSKU1234567` and `msku1234567 ` are two BLs to the dedupe and to the order match.
  4. `document.link` checks the target exists in the org (`routers/document.ts:126-159`) but not that the caller may read it (no `applyScope` on the target). A branch-scoped member can file a document against another branch's order. Low: ids are UUIDs, and the link reveals nothing back.
  5. The review screen checks the statement-level `document:review` (`:121`) while the server gates four separate leaves (`modules/document/permissions.ts:38-64`). A custom role holding only `document.review.approve` sees Save/Amend controls that answer FORBIDDEN.
  6. `lading/create.tsx:176` sends `{ limit: 200 }` to `collectiveOrder.list`, whose input has no `limit` (`collective-order.ts:669-700`); zod strips it. Step 16/17 territory.

- **Precedent this plan follows.**
  - Additive output fields on order rows: `enrichOrderRows` already returns `documents: null` for a caller without `document.read` and a zeroed rollup otherwise (`collective-order.ts:2040-2053, 2258`); the new fields follow the same rule.
  - Advisory lock: `routers/org-param.ts:714` (`pg_advisory_xact_lock(hashtextextended(key, 0))` inside a transaction), listed in `ALLOWED_EXECUTE_SITES` (`packages/api/src/architecture.test.ts:1302`).
  - Real-Postgres concurrency test: `routers/expense.concurrency.test.ts` (`DATABASE_URL_TEST`, `describe.skipIf`), as in step 15 Task 1.4.
  - Notices on the approve/correct/amend response and warning toasts (`documents.$documentId.tsx:234-243, 312-321`).
  - Direct-INSERT seeding where no RPC path exists: `seed/customs.ts:1-17`.

- **Migration state.** The journal ends at `0065_quotation_send_decision` (idx 64). **This plan needs no migration** under the recommended options. D7-B would add `00NN_bl_job_open_bl_number_uidx`; D11-B would add `00NN_document_link_created_by_set_null`. Both are named `00NN_<name>` and numbered at merge (runbook §6).

---

## 1. Overview

**Problem.** A reviewer approves the carrier's B/L and tracking starts — but the approved paperwork cannot be attached to the order or bill of lading it belongs to, because the only link control on screen offers the retired quote module. The order's **Documents & customs** card, which would show the paperwork and customs stage, never appears because server and web disagree on its shape. A B/L the classifier typed as a packing list cannot be re-typed at review, so approving it silently starts no tracking. Two copies of one B/L approved at the same time can start two tracking jobs. A tracking start that fails is invisible, and a flagged container number is highlighted without saying why.

**Goals.**
- **Phase 1 (finding A):** an approved B/L can be filed against its order and its bill of lading from the document screen, and removed again, so that once step 19 Phase 2 reshapes the payload (D3-A) the order reading pane and the B/L record page show the Documents & customs card with true counts.
- **Phase 2 (findings B, E):** a reviewer can change the type of any document awaiting review and sees the reason each field is flagged. A mis-typed B/L approved as `mbl_hbl` starts tracking.
- **Phase 3 (findings C, D):** one bill of lading makes at most one unfinished tracking job, the job is written all-or-nothing, and a failed start reaches the reviewer as a warning.

**Success criteria.**
- On `/documents/<id>`, a user holding `document:update` can pick an order (search prefilled with the extracted BL number) or a bill of lading and press **Link**; the section lists the link by job number or B/L number with a link to the record, and **Unlink** removes it. `document.link` with `entityType: "collective_order"` is sent; no screen sends `"quote"`.
- After step 19 Task 2.2 (D3-A) — or this plan's Task 1.2 under D3-B — `collectiveOrder.list` and `get` rows carry `documents.counts` and `documents.customs`, and the card on a linked order shows **MBL / HBL: Approved**, not Missing.
- A `needs_review` document typed `packing_list` can be switched to **Bill of Lading (MBL/HBL)**, filled and approved; a `bl_job` exists for it afterwards.
- Every error-severity validation message is printed under its field on the review screen.
- Two concurrent approvals of two documents carrying the same BL number leave one unfinished `bl_job`; the second approval's response carries the `bl_job_already_tracked` notice. Proven on real Postgres.
- A hook that throws returns a notice, and the screen shows it as a warning instead of "Extraction approved".

**In scope.** Web link control and unlink; `document.unlink`; the order payload reshape only if D3-B is chosen; web type change for any `needs_review` document; issue messages on the review screen; one transaction and a per-org advisory lock around the B/L intake hook; a notice for a thrown hook; a local seed command for review documents; read-only probes.

**Out of scope.**
- K1/K2 declaration type (D9, recommended: its own feature plan).
- Changing the type of an already approved document (D10, recommended: known gap sized by 18-P3).
- The member-delete cascade (adjacent defect 1; system-wide, needs its own plan and migration).
- BL number normalisation (adjacent defect 3), link target data scope (4), per-leaf UI permission checks (5).
- The meaning of the 72-hour countdown, the customs board and alerting (step 19).
- Uploading from the order page (D1-B, not recommended now).
- Auto-linking a document to an order by BL number (D1-C).
- Delivering notices from the workflow's auto-approve path (adjacent defect 2).

**SOP findings (`customer-intake-sop/sop.json`, step 18):**

| Finding | Planned? | Where |
|---|---|---|
| `fixes[0]` "There is no customs declaration type" (sev `blocked`) | No — D9-A (Decided): its own feature plan | §9 D9 |
| `breaks[after 18]` "Documents → the job" | Yes | Phase 1 |
| ledger `paperwork` (repairs b18, s18) | Yes, except the K1/K2 clause (D9) | Phase 1 |
| ledger `island` (repairs s19, s18) | No under D3-A (step 19 Task 2.2 reshapes the payload); this plan supplies the links the card counts | Phase 1; Task 1.2 only under D3-B |
| guide pitfall "the only screen that links anything sends `quote`" | Yes | Phase 1 Task 1.3 |

**Input Gate.** Not held. Every decision in §9 was settled by Wilfred on 2026-09-21 (all A). Tasks name the decision they implement.

**Decisions (all Decided 2026-09-21; Chosen option in brackets):**
- How a document is filed against its job → D1 [A: order and B/L picker on the document screen]
- Can a link be removed → D2 [A: `document.unlink`]
- Who reshapes the order `documents` payload so the card renders → D3 [A: step 19 Task 2.2, matching step 19's D1-A]
- Only under D3-B: does step 18's additive payload carry `countdownDeadline` → D4 [A: yes, one column; moot, since D3-A was chosen]
- How a mis-typed document is re-typed at review → D5 [A: type Select for every `needs_review` document, through `correct`]
- What happens to error-severity validation issues → D6 [A: show them; no server refusal]
- How two approvals of one BL are serialised → D7 [A: transaction plus per-org advisory lock, no migration]
- What a thrown hook tells the reviewer → D8 [A: a notice; recovery through amend]
- K1/K2 declaration type → D9 [A: own feature plan]
- Re-typing an approved document → D10 [A: known gap, sized by 18-P3]
- Member-delete cascade → D11 [A: flag to a separate plan]

## 2. User Journeys

**Journey 1 (changed): Documentation files the approved B/L against its order and bill of lading**
Trigger: SOP step 18 golden path is done; the MBL document reads **approved**.
Steps:
1. On `/documents/<id>`, the section under the fields is headed **Linked records**. It lists nothing yet ("Not linked yet.").
2. The control offers **Order** or **Bill of lading**. With **Order** chosen, the search box is prefilled with the extracted `blNumber`; the list shows matching orders by job number and MBL/HBL (`collectiveOrder.list` `q` matches `job_number`, `mbl`, `hbl`, `collective-order.ts:1291-1298`). Pick the order, press **Link** → toast _"Linked to order J…"_; the section lists **Order · J…** as a link to `/order/<id>/edit`.
3. Choose **Bill of lading**; the search (`lading.list` `search` matches `billNo`, `mblNo`, `hblNo`, `orderNo` and more, `lading.ts:750-768`) finds the B/L raised at step 16/17. Pick it, **Link** → _"Linked to bill of lading …"_.
4. A wrong link: press **Unlink** beside it → toast _"Link removed"_; it leaves the list.
5. (Once the payload reshape has merged: step 19 Task 2.2 under D3-A, or Task 1.2 under D3-B.) Open the order in its trade ledger (for example `/order/sea-export`) and open its reading pane → the **Documents & customs** group shows **MBL / HBL: Approved**, the other two types as Missing, and the customs stage of the tracking job whose BL number matches the order's MBL.
6. Open the linked B/L at `/lading/<id>` → the same card.
7. Flow ends: the order and the B/L both show that the carrier's B/L is filed and approved.
Where it lives: the existing document screen (one section replaced), the existing reading pane and B/L record page (no web change here: the card starts rendering once the payload matches, which is step 19's change under D3-A).

Old journey, for contrast: step 2 offered only quotes from the retired module; the order and B/L pages showed no documents card at all.

**Journey 2 (changed): The reviewer fixes a mis-typed B/L and sees why a field is flagged**
Trigger: a document the classifier typed as **Packing list** is awaiting review, and the scan is plainly a bill of lading.
Steps:
1. Open `/documents/<id>` → header shows **Needs review** and a **Document type** Select set to **Packing list** (today a read-only badge).
2. Choose **Bill of Lading (MBL/HBL)** → the field list redraws with the B/L fields; required ones with no value are marked **Required**; any values the classifier read for the old type stay visible, marked **Not in schema**.
3. A container row is amber; under it the reason reads _"Container number ABCU1234560 fails the ISO 6346 check digit"_. Correct it against the scan.
4. Fill the required fields. The primary button reads **Save & approve** → toast _"Corrections saved and approved"_ (`:292`), or a warning if a notice came back.
5. Open `/customs-tracking` → a job for that BL number is listed.
6. Flow ends: the B/L is approved as a B/L and tracked.
Where it lives: the existing review screen; no server change (the server already accepts `docTypeOverride` on `correct`).

Old journey, for contrast: at step 1 the type was fixed; approving as a packing list started no tracking and said nothing; the only escape was **Not freight** → reprocess.

**Journey 3 (changed): Two copies of one B/L, and a tracking start that fails**
Trigger: the carrier's B/L arrived twice (an upload and an email attachment), both awaiting review.
Steps:
1. Reviewer A approves copy 1 while reviewer B approves copy 2 at the same moment.
2. One of them sees _"Extraction approved"_; the other sees the warning _"<BL> is already being tracked from an earlier document, so no second tracking job was created. The existing job continues."_ (`register-hooks.ts:28`). `/customs-tracking` lists one job for that BL.
3. On another document, the intake fails (for example a database error) → the reviewer sees the warning _"Approved, but tracking could not be started. Correct any field and save the amendment to retry, or tell an admin."_ instead of the success toast.
4. Flow ends: one BL, one job; a failed start is visible to the person who caused it.
Where it lives: server only; the screen's existing notice handling (`:234-243`) shows the warnings.

## 3. Result (What Changes for the User)

**Before:** an approved B/L cannot be attached to its order or B/L, the order and B/L pages never show a documents card, a B/L typed as the wrong kind of document cannot be corrected before approval and silently starts no tracking, two copies approved together can start two tracking jobs, and a failed start looks like success.
**After:** the document screen files the B/L against its order and bill of lading, and the order and B/L pages show its state. Any document awaiting review can be re-typed, and flagged fields say why. One BL makes one job, written in one step, and a failed start says so.
**Key differences:**
- Documentation: a **Linked records** section with order and B/L pickers and **Unlink**; the quote picker is gone.
- Reviewers: a type Select on every document awaiting review; validation messages under flagged fields; warnings when tracking did not start.
- Ops and accounting: the order reading pane and B/L record page show **Documents & customs**.
- Nobody: approval rules, required fields and permissions are unchanged.

## 4. Technical Architecture

### 4.1 Filing a document against its job (Journey 1; Phase 1) → D1, D2

**`document.unlink` [NEW procedure]** in `packages/api/src/routers/document.ts`, beside `link` (`:382`):

```ts
unlink: orgProcedure
  .use(requireNode(DOCUMENT.update))   // same node as link; already isEndpoint
  .input(z.object({
    documentId: z.string(),
    entityType: documentLinkEntityTypeEnum,
    entityId: z.string(),
  }))
  .handler(async ({ context, input }) => {
    // 1. scoped document load exactly as `link` does (:393-400) → NOT_FOUND
    // 2. in one transaction: DELETE from document_link
    //    where document_id, entity_type, entity_id and organization_id match, RETURNING
    //    zero rows → NOT_FOUND "Not linked"
    // 3. writeAuditRaw action "document.unlink", before: { entityType, entityId }
  }),
```

No target check is needed on unlink: the row carries `organization_id` and is matched on it. Deleting a link row is not a money write; Task 1.1 runs `packages/api/src/architecture.test.ts` to confirm no allow-list names `document_link`.

**Web: `LinkRecordForm`** replaces `LinkQuoteForm` in `apps/web/src/routes/_next/documents.$documentId.tsx` (`:815-829`, `:870-913`):
- Kind Select: **Order** (`collective_order`) or **Bill of lading** (`lading`). No quote option (D1-A); stored quote links still list, read-only.
- Search input, prefilled once from the extraction's `blNumber` value when the document is `mbl_hbl`. Guard the prefill so a refetch never overwrites typing (memory `refetch-overwrites-typed-input`): set it only while the input is untouched.
- Results: `orpc.collectiveOrder.list({ q })` (enabled when `q.length >= 2`) showing `jobNumber · mbl`; `orpc.lading.list({ search, limit: 20 })` showing `billNo · mblNo`.
- **Link** → `client.document.link({ documentId, entityType, entityId })`; toast _"Linked to order <job number>"_ / _"Linked to bill of lading <bill no>"_.
- Listed links: label resolved per link with `orpc.collectiveOrder.get` / `orpc.lading.get` (`retry: false`, `suppressErrorToast`); a link the viewer cannot read shows the short id, as today. Each links to `/order/<id>/edit` or `/lading/<id>`. **Unlink** (shown with `canLink`) → `client.document.unlink(…)`; toast _"Link removed"_.
- Heading **Linked records**. Copy grep (Task 1.3): "Linked quotes", "Linked to quote", "Select a quote…" occur only in this file and in `docs/prd/document-ai-plan.md:7609-7652` (historical plan text, not edited).

### 4.2 The order's documents payload (Journey 1 steps 5–6) → D3, D4

**Under D3-A (recommended) this plan writes no payload code.** Step 19 Task 2.2 replaces the flat rollup with `{ counts, customs }`, normalises BL numbers and gates the customs half on `bl-job.read` (see `step-19-demurrage-clock-reach.md` §4.2). Step 18's only obligation is that Phase 1 (link writing) merges before step 19 Phase 2, so the card's checklist half counts real links rather than showing Missing on every order.

**Fallback spec, only under D3-B** (rejected 2026-09-21 under X23; kept for the record, not built) (step 18 carries the reshape, additively, and step 19 then builds on it). In `enrichOrderRows` (`packages/api/src/routers/collective-order.ts:1891`), additive only:

```ts
interface OrderDocumentState extends OrderCustomsState {
  // existing fields unchanged …
  /** One entry per (docType, status) — the joint count the web checklist reads. */
  counts: Array<{ docType: string | null; status: string; count: number }>;
  /** The bl_job matched by the order's MBL (then HBL), as rollup.ts CustomsMatch reads it. */
  customs: {
    match: "none" | "exact" | "ambiguous";
    candidates: number;
    job: null | {
      id: string; blNumber: string; stage: string; customsStatus: string;
      countdownDeadline: Date | null;     // D4-A
      voidedAt: null;
    };
  };
}
```

- `emptyDocumentState()` (`:1876`) returns `counts: []` and `customs: { match: "none", candidates: 0, job: null }`.
- The document fold (`:2201-2216`) also pushes `{ docType: row.docType, status: row.status, count: n }` into `counts` (the query already groups by `(entityId, docType, status)`, so each row is one joint bucket).
- The `bl_job` query (`:2150-2168`) also selects `id` and `countdownDeadline`. The customs fold keeps, per BL number, the list of non-voided jobs (not first-wins). Per order: take the MBL's jobs if any, else the HBL's; `candidates = jobs.length`; `match = 0 → "none", 1 → "exact", >1 → "ambiguous"`; `job` is the single job for `exact`, else `null`. The existing flat `customsStatus`/`customsClearedAt`/`blStage` keep their first-wins value, so current readers and `collective-order.numbering.test.ts:545-760` (`toMatchObject`) are unaffected.
- The null rule is unchanged: a caller without `document.read` still gets `documents: null` (`:2258`).
- No web change is expected in `rollup.ts` or the card: they already accept exactly this shape. Task 1.4 pins it with a fixture test (D3-B only; under D3-A step 19 Task 2.4 owns `rollup.test.ts`).

### 4.3 Re-typing and explaining at review (Journey 2; Phase 2) → D5, D6

In `apps/web/src/routes/_next/documents.$documentId.tsx`:
- Render the type Select whenever `needsReview && canEdit` (`:448`), with the current type as its value; keep the read-only badge otherwise. `docTypeOverride` state (`:164`) holds a chosen type only when it differs from the stored one.
- `effectiveDocType` (`:205`) already prefers the override, so the schema query and `mergeReviewFields` redraw for the new type with no further change.
- `submit()` (`:342`): generalise the `isUnknownType` branch to `typeChanged = isUnknownType || (docTypeOverride !== "" && docTypeOverride !== payload.document.docType)`. When `typeChanged`, send `correct({ corrections, docTypeOverride })` even with no field edits. The button label for that branch stays **Save & approve**.
- Issues: parse `payload.extraction.issuesJson` (add it to the local payload type `:176-180`; `document.get` already returns it). Print each issue whose `field` matches a row under that row in muted destructive text; print issues with no field (or `"*document*"`) above the list. Issues are shown for `needs_review` and `approved`. After a correction the server recomputes issues (`applyCorrections`, `packages/document-ai/src/pipeline/steps.ts:74`), and the refetch shows the new set.
- Editing a **Not in schema** row would fail server-side (`steps.ts:60-62`, "Unknown field"). The pencil is hidden for `unknownToSchema` rows (`:757`).

### 4.4 One BL, one job, all or nothing (Journey 3; Phase 3) → D7, D8

**`modules/document/register-hooks.ts` `blIntakeHook`:**

```ts
const blIntakeHook: ApprovalHook = async (db, ctx) => {
  if (ctx.document.docType !== "mbl_hbl") return [];      // no transaction for other types
  const outcome = await db.transaction(async (tx) => {
    // Serialises B/L intake per organisation: the duplicate check and the insert
    // cannot interleave with another approval in the same org.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`bl_intake:${ctx.document.organizationId}`}, 0))`,
    );
    return ingestApprovedDocument(tx, ctx);
  });
  // … notices exactly as today (:14-33)
};
```

- Per-org key, not per-BL: the BL number is parsed inside the intake, and approvals are rare enough that serialising them per org costs nothing measurable.
- A throw inside rolls the whole intake back (job, containers, events), which removes the partial-write case in finding C.
- Add `"modules/document/register-hooks.ts :: blIntakeHook"` to `ALLOWED_EXECUTE_SITES` (`packages/api/src/architecture.test.ts:1299`) with a comment in the `lockRateSeries` style.
- `ingestApprovedDocument` is unchanged; it already takes a structural `AnyDb` (`intake.ts:22`), so a transaction handle works.

**`modules/document/hooks.ts` `runApprovalHooks` catch (`:72-74`):** keep the log, and push
`{ kind: "approval_hook_failed", message: "Approved, but tracking could not be started. Correct any field and save the amendment to retry, or tell an admin." }`.
The document stays approved (unchanged discipline). `hooks.test.ts:114` changes from `toEqual([])` to one notice of that kind. The review screen already toasts notices as warnings (`documents.$documentId.tsx:234-243`, `:312-321`).

### 4.5 Data model

**No schema change under the recommended options.**
- D7-B would add a partial unique index `bl_job (organization_id, bl_number) WHERE stage NOT IN ('gated_out','voided') AND voided_at IS NULL`, migration `00NN_bl_job_open_bl_number_uidx`; it fails to build if 18-P1 finds open duplicates.
- D11-B would change `document_link.created_by` (and, in its own plan, every `created_by`) to ON DELETE SET NULL with a nullable column, migration `00NN_document_link_created_by_set_null`.

### 4.6 API contracts (all input shapes unchanged)

Journey steps served: `document.link`/`unlink` → Journey 1 steps 2–4; `collectiveOrder.list`/`get` → Journey 1 steps 5–6; `document.review.correct` → Journey 2 step 4; `document.review.*` via the hook → Journey 3.

| Procedure | Change | New refusals |
|---|---|---|
| `document.unlink` | **new**; `document.update`; deletes one link row; audit `document.unlink` | NOT_FOUND (document out of scope, or not linked) |
| `document.link` | none; first web caller for `collective_order` and `lading` | – |
| `collectiveOrder.list`, `collectiveOrder.get` | none under D3-A (step 19 reshapes); under D3-B output `documents` gains `counts` and `customs`, old fields unchanged | – |
| `document.review.correct` | none; first web caller that sends `docTypeOverride` for a typed document (D5-A) | – |
| `document.review.approve` / `correct` / `amend` | response `notices` may include `approval_hook_failed` (D8-A); `bl_job_already_tracked` is now race-free (D7-A) | – |

## 5. Phased Implementation

**Blocking prerequisites (before Task 1.1):**
- Only under D3-B (Task 1.2): step 15 Phase 1 merged (it adds `get.underReview` in `collective-order.ts`; see §7.6), and steps 11 Phase 2, 12 Phase 1, 13 Phase 2, 14 Phase 1 for the same file's line shifts; re-locate `enrichOrderRows`, `OrderDocumentState`, `emptyDocumentState` and the two folds **by symbol**. Under D3-A no task in this plan edits `collective-order.ts`.
- D1, D2, D3 (D3-A, so D4 is moot) are Decided for Phase 1; D5, D6 for Phase 2; D7, D8 for Phase 3 (all 2026-09-21, all A).
- Re-check before Phase 1's release note: 18-P4 (links by type). Before Task 3.1: 18-P1 (open duplicates today) and 18-P2 (approved B/Ls with no job).

### Phase 1 — The approved B/L is filed against its order and bill of lading (finding A)

**Delivers:** Journey 1 end to end.
**Dependencies:** D1, D2, D3 (Decided A; D4 moot). The prerequisites above. **D3-A is Decided (X23), so Tasks 1.2 and 1.4 are not done here**; Phase 1 is Tasks 1.1, 1.3 and 1.5, and Journey 1 steps 5–6 are proven after step 19 Phase 2 merges.

- **1.1** `document.unlink` (§4.1). Tests in `packages/api/src/routers/document.test.ts`, new `describe("document.unlink")`: link then unlink → row gone, audit row `document.unlink`; unlink of a link that does not exist → NOT_FOUND; a scope-excluded document → NOT_FOUND before any delete; a member without `document.update` → FORBIDDEN; a link in another org with the same ids → untouched. Re-run `permissions/registry.sync.test.ts` and `packages/api/src/architecture.test.ts`. Files: `packages/api/src/routers/document.ts`, `packages/api/src/routers/document.test.ts`. · **Agent A (backend)**
- **1.2** (D3-B only; **not done**, D3-A Decided) `counts` and `customs` on order rows (§4.2 fallback spec). Tests in `packages/api/src/routers/collective-order.documents.test.ts` [NEW] (a new file, so the numbering suite that steps 11 and 12 edit is untouched): joint counts for four documents across two types and three statuses; archived documents excluded; `documents: null` without `document.read`; zeroed `counts: []` and `customs.match: "none"`; one non-voided job on the MBL → `exact` with `countdownDeadline`; a voided job ignored; two non-voided jobs on the MBL → `ambiguous`, `job: null`, `candidates: 2`; MBL job missing and HBL job present → `exact` on the HBL. Copy fixtures from `collective-order.numbering.test.ts:545-760` (`rawOrder`, `fileDocument`). Re-run `collective-order.numbering.test.ts` unchanged. Files: `packages/api/src/routers/collective-order.ts`, `packages/api/src/routers/collective-order.documents.test.ts` [NEW]. · **Agent A (backend)**
- **1.3** `LinkRecordForm`, the **Linked records** list and **Unlink** (§4.1). Grep the worktree for "Linked quotes", "Linked to quote", "Select a quote" and `LinkQuoteForm` and confirm only `docs/prd/document-ai-plan.md` remains. Files: `apps/web/src/routes/_next/documents.$documentId.tsx`. · **Agent B (frontend)**
- **1.4** (D3-B only; **not done**, D3-A Decided) Contract pin: in `apps/web/src/features/order-documents/rollup.test.ts`, add a case whose input is a literal copy of one row's `documents` from Task 1.2's test output (all old fields plus `counts` and `customs`) and assert `readOrderDocumentRollup` returns the counts and an `exact` job with its deadline. Change `rollup.ts` only if that case fails, and only to read the server's field names. Files: `apps/web/src/features/order-documents/rollup.test.ts` (and `rollup.ts` only if needed). · **Agent B (frontend)**
- **1.5** Local seed for browser proof: `seed/review-documents.ts` [NEW], registered as a `review-documents` command in `seed/cli.ts`. It inserts, by direct INSERT (the `seed/customs.ts` precedent, whose header explains why no RPC path exists), for the configured org: **D-MBL** (`mbl_hbl`, `needs_review`, a draft extraction with every required field and two valid container numbers, BL `SEED18-BL-1`); **D-PL** (`packing_list`, `needs_review`, extraction of packing-list fields, its scan being a B/L in the story); **D-BAD** (`mbl_hbl`, `needs_review`, one container `ABCU1234560` with the check-digit issue in `issues_json` and `containers` in `flagged_fields_json`); **D-DUP1/D-DUP2** (`mbl_hbl`, `needs_review`, same BL `SEED18-BL-2`). Idempotent by fixed ids; prints the ids. No R2 object is written, so the preview pane stays blank (the screen suppresses the download error). Dev branch only, never production. Files: `seed/review-documents.ts` [NEW], `seed/cli.ts`. · **Agent C (test)**

**Acceptance.**
- §10 Journey 1 steps 1–4 and 7 pass in the browser at `:3101`; steps 5–6 pass once the payload reshape has merged (step 19 Phase 2 under D3-A, Task 1.2 under D3-B).
- `document.test.ts`, `registry.sync.test.ts` and both architecture tests pass (plus `collective-order.documents.test.ts`, `collective-order.numbering.test.ts` and `rollup.test.ts` under D3-B), judged by reading the output for `failed`.
- `bun run check-types` shows no `error TS` and ran `apps/web` and `seed`.

### Phase 2 — The reviewer can re-type a document and sees why a field is flagged (findings B, E)

**Delivers:** Journey 2 end to end.
**Dependencies:** D5, D6. Phase 1 merged (same web file; Agent B owns both). Independent of Phase 3.

- **2.1** Type Select for every `needs_review` document and the generalised `submit()` branch (§4.3). Files: `apps/web/src/routes/_next/documents.$documentId.tsx`. · **Agent B (frontend)**
- **2.2** Issue messages under their fields and document-level issues above the list; hide the pencil on **Not in schema** rows (§4.3). Files: `apps/web/src/routes/_next/documents.$documentId.tsx`. · **Agent B (frontend)**
- **2.3** Server pin (no server code change): in `packages/api/src/modules/document/register-hooks.test.ts`, new case "a packing list corrected to mbl_hbl at review starts tracking": seed a `needs_review` document typed `packing_list` with a draft extraction, `registerApprovalHooks()`, call `documentRouter.review.correct` with `docTypeOverride: "mbl_hbl"` and the required B/L fields → document `approved`, `doc_type = 'mbl_hbl'`, one `bl_job` with that BL number. Second case: the same document approved as `packing_list` → no `bl_job` (documents today's silent path). Files: `packages/api/src/modules/document/register-hooks.test.ts`. · **Agent A (backend)**

**Acceptance.**
- §10 Journey 2 passes in the browser (D-PL and D-BAD).
- `register-hooks.test.ts`, `document.test.ts` (the review describes at `:631`, `:749`, `:867`) and `apps/web/src/routes/_next/-documents.reject-shortcut.test.ts` pass.

### Phase 3 — One B/L, one job, and a failed start is said out loud (findings C, D)

**Delivers:** Journey 3 end to end.
**Dependencies:** D7, D8. Independent of Phase 2 (server only). Re-check before Task 3.1: 18-P1 and 18-P2; if 18-P1 shows open duplicates, the release note tells ops to void the extra jobs (the `bl-job.void` endpoint, `routers/bl-job.ts:419`); the code does not repair them.

- **3.1** Transaction and advisory lock in `blIntakeHook`, skipped for non-B/L types; allow-list entry (§4.4). Files: `packages/api/src/modules/document/register-hooks.ts`, `packages/api/src/architecture.test.ts`. · **Agent D (backend)**
- **3.2** `approval_hook_failed` notice in `runApprovalHooks`; update `hooks.test.ts:114` and add a case that a throwing hook still leaves the document approved and returns exactly one notice. Files: `packages/api/src/modules/document/hooks.ts`, `packages/api/src/modules/document/hooks.test.ts`. · **Agent D (backend)**
- **3.3** Tests.
  - PGlite, `register-hooks.test.ts`: rollback case. Pass `blIntakeHook` a db handle whose transaction handle throws on the first `insert(blContainer)` (a thin wrapper around the test's PGlite drizzle handle; `intake.ts:22` types the handle structurally, so no production seam is needed) → no `bl_job` row remains, and `runApprovalHooks` returns `approval_hook_failed`. Sequential approvals of two documents with one BL → one job and one `bl_job_already_tracked` notice (already covered by `intake.test.ts:175-190`; re-run).
  - **No PGlite lock test**: PGlite has one connection and serialises every transaction (step 15 §Risks), so a lock test there passes on the old code.
  - Real Postgres, `packages/api/src/modules/document/register-hooks.concurrency.test.ts` [NEW], modelled on `routers/expense.concurrency.test.ts` (`DATABASE_URL_TEST`, `describe.skipIf`, per-run org ids). Deterministic interleave: connection A opens a transaction and takes the same advisory lock; start `blIntakeHook` for document 2 on connection B without awaiting; on A run `ingestApprovedDocument` for document 1 and commit; await B → B returns the `bl_job_already_tracked` notice and the org has exactly one unfinished job for the BL. Run once against the hook without the lock and record that it creates two jobs. Dev branch only.
  - Re-run `packages/port-tracking/src/intake.test.ts`, `hooks.test.ts`, `document.test.ts`, both architecture tests.
  Files: `packages/api/src/modules/document/register-hooks.test.ts`, `packages/api/src/modules/document/register-hooks.concurrency.test.ts` [NEW]. · **Agent D (backend)**

**Acceptance.**
- §10 Journey 3 steps 1–2 pass in the browser with D-DUP1/D-DUP2 (sequential; the race itself is proven only by the concurrency test).
- The concurrency test passes on the dev branch with its tests listed as passed, not skipped, and was seen failing without the lock.
- `hooks.test.ts`, `register-hooks.test.ts`, `intake.test.ts` and `packages/api/src/architecture.test.ts` pass.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1 (and 1.2 under D3-B) | `packages/api/src/routers/document.ts`, `packages/api/src/routers/document.test.ts`; under D3-B also `packages/api/src/routers/collective-order.ts` (the `enrichOrderRows` documents half only), `packages/api/src/routers/collective-order.documents.test.ts` [NEW] | `packages/api/src/routers/collective-order.numbering.test.ts`, `packages/db/src/schema/document.ts`, `packages/db/src/schema/bl-tracking.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.3 (and 1.4 under D3-B) | `apps/web/src/routes/_next/documents.$documentId.tsx`, `apps/web/src/features/order-documents/rollup.test.ts`, `apps/web/src/features/order-documents/rollup.ts` (only if 1.4 fails) | `apps/web/src/features/order-documents/order-documents-card.tsx`, `apps/web/src/utils/orpc.ts` |
| Agent C (test) | test-engineer | sonnet | medium | 1.5 | `seed/review-documents.ts` [NEW], `seed/cli.ts` | `seed/customs.ts`, `packages/document-ai/src/registry/*.ts` |

opus / high for A: a new mutation on a scoped, audited router; under D3-B also a 4,800-line router that plans 11–15 edit. Under D3-A, sonnet / medium is enough.
Run mode: **A (Task 1.1 type-checked) → B's Unlink**, otherwise A ∥ B ∥ C. Contract: `document.unlink` input `{ documentId, entityType, entityId }`; under D3-B, `documents.counts` and `documents.customs` as §4.2, and B's Task 1.4 fixture waits on A's Task 1.2 test output.
Serialization point: `bun run check-types` (read the output), then the Phase 1 suites.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent B (frontend) | frontend-engineer | sonnet | medium | 2.1, 2.2 | `apps/web/src/routes/_next/documents.$documentId.tsx` | `apps/web/src/lib/documents/review-fields.ts`, `apps/web/src/lib/documents/corrections.ts`, `packages/document-ai/src/pipeline/steps.ts` |
| Agent A (backend) | backend-engineer | sonnet | medium | 2.3 | `packages/api/src/modules/document/register-hooks.test.ts` | `packages/api/src/routers/document.ts`, `packages/port-tracking/src/intake.ts` |

Run mode: A ∥ B (disjoint files). Handoff: `register-hooks.test.ts` Agent A (Phase 2) → Agent D (Phase 3).

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent D (backend) | backend-engineer | opus | high | 3.1–3.3 | `packages/api/src/modules/document/register-hooks.ts`, `packages/api/src/modules/document/hooks.ts`, `packages/api/src/modules/document/hooks.test.ts`, `packages/api/src/modules/document/register-hooks.test.ts`, `packages/api/src/modules/document/register-hooks.concurrency.test.ts` [NEW], `packages/api/src/architecture.test.ts` | `packages/port-tracking/src/intake.ts`, `packages/api/src/routers/org-param.ts`, `packages/api/src/routers/expense.concurrency.test.ts`, `apps/server/src/document/workflow.ts` |

opus for D: a lock and transaction on the only writer of tracking jobs, proven on real Postgres.
Run mode: single agent. Phase 3 may run in parallel with Phase 2 once Phase 2's Task 2.3 has merged (shared `register-hooks.test.ts`), or before Phase 2 if Task 2.3 rebases.

**Schedule:** Phase 1 → (Phase 2 ∥ Phase 3), with `register-hooks.test.ts` handed from A to D.
**Serialization points:** after each phase, `bun run check-types` and grep its output for `error TS` and `failed` (the command can exit 0 while printing "failed"). Run both architecture tests. Restart `:3000` before any browser check (`bun --hot` does not reload `packages/api`).
**Commits:** the worktree may be shared. One committer at a time; confirm the index is empty before `git add`, and read every hunk.

**Smell test.**
- [x] Every task has exactly one owner.
- [x] No file is owned twice within a phase.
- [x] The A → B contracts are named (`document.unlink` input, `documents.counts`/`customs`).
- [x] Every opus is justified; no haiku.
- [x] Each phase completes a journey (1, 2, 3).

## 7. Impact & Breakage Analysis

### 7.1 Callers traced (grep at HEAD `6bb3a1bf`, 2026-09-21)

- **`document.link`.** Web: `documents.$documentId.tsx:878` only (replaced in Task 1.3). Tests: `document.test.ts:436`, `:1638`. No other `client.document.link` / `orpc.document.link` in `apps/`.
- **`document.unlink`.** New; no callers besides Task 1.3.
- **`document_link` readers.** `document.list` `linkedTo` (`routers/document.ts:301-317`, no web caller), `document.get` (`:371-374`), `enrichOrderRows` (`collective-order.ts`, `entityType = 'collective_order'`), the workflow's `loadRelatedExtractions` (`workflow.ts:168-170`, cross-foot against linked documents). A deleted link removes a document from the order's counts and from the cross-foot of later validations; that is the intent.
- **`documents` on order rows.** Server: `enrichOrderRows` from `collectiveOrder.list` and `get`. Web: `readOrderDocumentRollup` at `order-ledger-page.tsx:868` and `lading/$id/index.tsx:138`, both through `rollup.ts`. No other web reader of `documentCount`, `documentsByType`, `documentsNeedingReview`, `documentsApproved` or `blStage` (grep). Test: `collective-order.numbering.test.ts:545-760` (`toMatchObject`; step 19 Task 2.3 rewrites this block under D3-A; under D3-B the additive fields leave it passing, and its one-query assertion compares SQL text of page and single calls, which stay equal to each other).
- **`document.review.correct` with `docTypeOverride`.** Web: `documents.$documentId.tsx:282-286` (today only for unknown types). Server behaviour unchanged.
- **`runApprovalHooks`.** Router `approve` `:593`, `correct` `:663`, `amend` `:788`; workflow `workflow.ts:211` (return value ignored). Tests `hooks.test.ts:78-160`, `register-hooks.test.ts:47-90`.
- **`blIntakeHook` / `ingestApprovedDocument`.** Registered once (`apps/server/src/index.ts:44`). `ingestApprovedDocument` callers: the hook, `intake.test.ts`. The `qa/runner.mjs` comments at `:22586`, `:24853` describe the chain and stay true.
- **`ALLOWED_EXECUTE_SITES`.** `packages/api/src/architecture.test.ts:1299-1323`; the scan covers `packages/api/src` only, so the new site in `register-hooks.ts` must be listed.

### 7.2 Flows before and after

| Flow | Before | After | Out-of-sync deploy |
|---|---|---|---|
| File a document against an order | impossible from the web | picker + **Link** | Web first: `unlink` 404 until API lands; linking works (server already accepts it) |
| Remove a wrong link | impossible | **Unlink** | API first: harmless |
| Order reading pane / B/L page card | never renders | renders once the payload reshape lands (step 19 P2 under D3-A); counts real links from this plan's Phase 1 | If the reshape deploys before Phase 1, every order shows Missing for all three types (step 19 §7.3) |
| Review a mis-typed document | type fixed | type Select | Web-only |
| Flagged field | amber, no reason | amber plus message | Web-only |
| Two copies approved together | two jobs possible | one job + notice | API-only |
| Hook throws | "Extraction approved" | warning notice | API-only; web already shows notices |

### 7.3 Behaviour change for existing orgs and live data

- **The card appears on every order** once the payload reshape deploys (step 19 Phase 2 under D3-A). Because no `collective_order` link exists today (18-P4 confirms), it shows **Missing** for all three types on every order until documents are linked through this plan's Phase 1, which is why Phase 1 merges first. The card's footnote says it is advisory; the release note says linking starts now. The customs half shows immediately for orders whose MBL/HBL matches a job.
- **Existing duplicate jobs** (18-P1) are not merged or voided by this plan; after Phase 3 no new ones are made.
- **Approved B/Ls with no job** (18-P2) stay as they are; the reviewer can amend any field to re-run the intake, which creates the job if none exists for that document.
- **Mis-typed approved documents** (18-P3) stay untracked (D10-A).
- No change to permissions, approval rules, autonomy settings or the pipeline.

### 7.4 Nullable assumptions

- `document.doc_type` is nullable (`schema/document.ts:42`); `counts[].docType` keeps `null`, which the reader folds as "unclassified" (`rollup.ts:126`).
- `bl_job.countdown_deadline` is nullable (`bl-tracking.ts:40`; set at berth + 72 h, `transitions.ts:11`); `customs.job.countdownDeadline` is `null` until berth, and the card shows no clock then (`order-documents-card.tsx:209`).
- `collective_order.mbl` / `hbl` may be null; such an order gets `customs.match: "none"`.
- The extraction's `blNumber` may be missing for a non-B/L document; the picker's prefill is then empty.
- `document_link.created_by` is NOT NULL and cascades on member delete (adjacent defect 1).

### 7.5 Deployment coupling

- Phase 1: API and web each deploy on their own (table above). Build `apps/web` before deploying so a partial deploy does not split server and web (memory `alchemy-partial-deploy-splits-the-stage`); no phase breaks under that split.
- Phase 2: web only. Phase 3: API only.
- The seed command (`seed/`) is not deployed.

### 7.6 Merge order against steps 04–27

| Plan / task | Shared code | Relation to step 18 |
|---|---|---|
| **11 Task 2.1** | `collective-order.ts` allocator region `:2288-2418` moves out; `architecture.test.ts:488` re-keyed | D3-B only: lines after `enrichOrderRows` move; merge 11 P2 first and re-locate by symbol. Under D3-A no overlap. |
| **12 Phase 1**, **13 Phase 2**, **14 Phases 1–3** | `collective-order.ts` (`assignNumber`, `update`, `receive`/`reject`/`reopen`, `create`, `buildOrderConditions`), `architecture.test.ts` | D3-B only: different functions from `enrichOrderRows`; merge first, rebase. Under D3-A no overlap. |
| **15 Phase 1** | `collective-order.ts` `get` (`underReview` field), order writers; `architecture.test.ts` comments | D3-B only: `get` returns `enrichOrderRows` output plus 15's field; different lines; merge 15 P1 first. Under D3-A no overlap. |
| **15 Phase 3** | `routers/lading.ts` `create`/`update` gate calls; `cost-lines.ts` | Step 18 edits neither file. Nothing to keep beyond not touching them. |
| 08, 10, 11, 12, 13, 15 | `packages/api/src/architecture.test.ts` | Step 18 adds one `ALLOWED_EXECUTE_SITES` entry (Task 3.1); neighbouring edits elsewhere in the file; the later merge rebases. |
| 04–10 | `quotation.ts`, audit engine | No overlap. |
| **16–17** (`step-16-lading-create.md`, `step-17-lading-states-and-review.md`) | `routes/_next/lading/$id/index.tsx` mounts the card; `lading.ts` `list` search | Step 18 edits neither; the card on `/lading/<id>` starts rendering once step 19 Phase 2's payload lands (X23). Neither plan re-plans the card's payload; step 17 keeps `readOrderDocumentRollup(orderQuery.data)` and `<OrderDocumentsCard>` on the bill page. |
| **19** (`step-19-demurrage-clock-reach.md`) | `enrichOrderRows` documents half (its Task 2.2), `collective-order.numbering.test.ts` rollup block (2.3), `order-documents-card.tsx` and `rollup.test.ts` (2.4); it names intake's dedupe race and `document.amend` as step 18's | **Step 18 Phase 1 merges before step 19 Phase 2**, as step 19 asks (its §7.6, §7.3). Under D3-A step 19 owns the whole payload and step 18 writes none of it; under D3-B step 18 Task 1.2 lands first and step 19 Task 2.2 replaces it. Both plans record the same answer: 18 D3-A = 19 D1-A (X23, settled 2026-09-21). Step 19 does not edit `register-hooks.ts`, `hooks.ts` or `intake.ts`, so Phase 3 is step 18's alone. |
| 20–27 | fees, bill, invoice, payment, month close | No shared code found; `document` and `bl_job` are not read by the billing routers (grep of `routers/expense/*.ts` for `blJob`/`document`: none). |

**Required order:** **18 P1** → 19 P2; 18 P2 and 18 P3 any time after 18 P1. Under D3-A step 18 does not touch `collective-order.ts`, so it has no ordering against 11–15. Under D3-B: 11 P2 → 12 P1 → 13 P2 → 14 P1 → 15 P1 → 18 P1 (Task 1.2) → 19 P2.

### 7.7 Read-only production probes (SELECT only; Wilfred runs them with the owner's override; none blocks writing code)

```sql
-- 18-P1 Open duplicate tracking jobs per BL number today (D7; sizes the race's past damage)
select organization_id, bl_number, count(*) as open_jobs,
       min(received_at) as first_received, max(received_at) as last_received
from bl_job
where stage not in ('gated_out', 'voided') and voided_at is null
group by 1, 2 having count(*) > 1
order by open_jobs desc, organization_id;

-- 18-P2 Approved B/L documents with no job of their own, and whether another job holds the BL
-- (a "true" in tracked_elsewhere is a correct dedupe; a "false" is a failed or skipped intake: D8)
with latest as (
  select distinct on (document_id) document_id, fields_json
  from document_extraction where status = 'final'
  order by document_id, version desc)
select d.organization_id, d.id as document_id, d.created_at,
       (l.fields_json::jsonb -> 'blNumber' ->> 'value') as bl_number,
       exists (select 1 from bl_job j2
               where j2.organization_id = d.organization_id
                 and j2.bl_number = (l.fields_json::jsonb -> 'blNumber' ->> 'value')) as tracked_elsewhere
from document d
join latest l on l.document_id = d.id
left join bl_job j on j.source_document_id = d.id
where d.doc_type = 'mbl_hbl' and d.status = 'approved' and j.id is null
order by d.created_at desc
limit 200;

-- 18-P3 Approved non-B/L documents whose file name looks like a B/L (D10 sizing; a heuristic)
select organization_id, doc_type, id, filename, doc_type_confidence, created_at
from document
where status = 'approved' and doc_type in ('commercial_invoice', 'packing_list')
  and (filename ilike '%lading%' or filename ilike '%mbl%' or filename ilike '%hbl%'
       or filename ilike '%b/l%' or filename ilike '%bl\_%' or filename ilike '%bl-%')
order by created_at desc
limit 200;

-- 18-P4 Document links by target type (confirms nothing links to orders or ladings: D1, §7.3)
select organization_id, entity_type, count(*) as links
from document_link
group by 1, 2 order by 1, 2;

-- 18-P5 The reject-then-reprocess workaround in use (D5 urgency)
select r.organization_id, count(distinct r.target_id) as documents
from audit_log r
where r.action = 'document.review.reject'
  and exists (select 1 from audit_log p
              where p.action = 'document.reprocess' and p.target_id = r.target_id
                and p.created_at > r.created_at)
group by 1 order by 1;

-- 18-P6 Approved documents whose final extraction still carries an error-severity issue (D6)
with latest as (
  select distinct on (document_id) document_id, issues_json
  from document_extraction where status = 'final'
  order by document_id, version desc)
select d.organization_id, d.doc_type, count(*) as approved_with_errors
from document d join latest l on l.document_id = d.id
where d.status = 'approved' and l.issues_json like '%"severity":"error"%'
group by 1, 2 order by 1, 2;

-- 18-P7 Autonomy settings per org (does any org auto-approve B/Ls, whose notices are dropped?)
select organization_id, doc_type, mode, updated_at
from document_type_setting
order by organization_id, doc_type;

-- 18-P8 How often members are removed or leave (adjacent defect 1, D11)
select organization_id, action, count(*) as events, max(created_at) as last_at
from audit_log
where action in ('member.remove', 'member.leave')
group by 1, 2 order by 1, 2;
```

**What each probe decides.** 18-P1 → D7 (B needs zero open duplicates before its index can build) and the Phase 3 release note. 18-P2 → D8 (B if `tracked_elsewhere = false` rows exist). 18-P3 → D10. 18-P4 → §7.3 wording. 18-P5 → D5 urgency. 18-P6 → D6. 18-P7 → adjacent defect 2 priority. 18-P8 → D11 priority.

### 7.8 Blocking prerequisites

- Under D3-B only: steps 11 P2, 12 P1, 13 P2, 14 P1 and 15 P1 merged before Task 1.2 (same file). Tasks 1.1, 1.3 and 1.5 do not wait on them.
- Decisions: all settled 2026-09-21 (D1–D11 A; D4 moot under D3-A), so none blocks a phase any more. For the record, D1–D3 released Phase 1, D5–D6 Phase 2, D7–D8 Phase 3.
- `DATABASE_URL_TEST` for a dev Neon branch available to Agent D — blocks Phase 3 acceptance.
- Probe re-checks (a result that contradicts the chosen option stops the task for a re-plan): 18-P4 before the Phase 1 release note; 18-P1 and 18-P2 before Task 3.1.

## 8. Cross-Cutting Concerns

- **Errors.** `unlink` answers NOT_FOUND for an out-of-scope document or a missing link, never confirming a foreign id (the router's house rule, `routers/document.ts:355-356`). Hook notices are warnings, not errors: the document stays approved.
- **Testing.** PGlite router and module suites at the API boundary (1.1, 2.3, 3.2, 3.3; 1.2 under D3-B); a web contract fixture (1.4, D3-B only); the lock only on real Postgres (3.3), never PGlite; browser proof in §10 against seeded rows (1.5).
- **Migration.** None under the recommended options (§4.5).
- **Rollback.** Every phase is a plain revert. `document.unlink` writes audit rows only for deletions already made; reverting it leaves those links deleted. The additive payload fields revert cleanly (the web reader returns to `null`, the card hides). The advisory lock reverts cleanly.
- **Audit trail.** `document.unlink` writes one `audit_log` row with the removed target. `document.link` already writes one (`:418-425`). Intake events (`bl_event`) are unchanged.
- **Copy.** New strings: "Linked records", "Linked to order …", "Linked to bill of lading …", "Link removed", "Unlink", the `approval_hook_failed` sentence. Removed: "Linked quotes", "Linked to quote", "Select a quote…" (grep in Task 1.3).

**Performance & Scalability**
1. **Pagination.** Unchanged. The picker queries are bounded by `q` (orders; the list has no `limit` input, so the picker waits for two characters) and `limit: 20` (ladings).
2. **SQL-side filtering.** Unchanged; `counts` reuses the existing grouped query.
3. **N+1.** None on the server. The document screen resolves one label per link (links per document are few, typically one to three).
4. **Index coverage.** `bl_job` lookup by `(organization_id, bl_number)` uses `blJob_organizationId_blNumber_idx` (`bl-tracking.ts:65`). `document_link` delete matches `documentLink_documentId_entity_uidx` (`schema/document.ts:167-171`).
5. **Write atomicity.** The B/L intake becomes one transaction (Phase 3). `unlink` is one statement plus its audit row in one transaction.
6. **Row locking.** A transaction-scoped advisory lock per org, held for one intake (milliseconds). Non-B/L approvals take no lock.
7. **Connections/resources.** None new.
8. **Tenant isolation.** `unlink` matches `organization_id`; payload queries keep their org predicates; the advisory key includes the org id.
9. **Payload size.** Each order row gains a few `counts` entries and one small `customs` object.
10. **Hot path.** `collectiveOrder.list` runs on every ledger load; the added work is in-memory folding of rows it already fetches plus two selected columns.

## 9. Decision Register, Open Questions & Risks

**Statuses.** No Input Gate was held. On 2026-09-21 Wilfred accepted the recommended option of **every** decision below, and every cross-plan settlement in `steps-16-19-crosscheck.md` (X17–X27), so all eleven are **Decided**, each on A. No X-item overrides a recommendation here; X23 settles D3-A together with step 19 D1-A, which makes D4 moot. Each entry keeps its three approaches and its consequence table, so any of them can be re-opened by reading what was rejected. Where a decision leans on a production probe, the **Re-check** line stands: the choice holds, but the check is still required before the task it names, and a contradiction stops the work for a re-plan. Each names the task it releases.

**D1: How is a document filed against its order and bill of lading?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Order and B/L picker on the document screen, search prefilled with the extracted BL number; quotes no longer offered (Recommended) (Chosen) | Web-only (the server already accepts both types). Works for uploaded and emailed documents alike. One manual step per document. |
| **B** | Upload from the order and B/L pages, passing `requestUpload`'s existing `link` | Files at birth, no second step. Needs an upload mount on nine order trade pages and the B/L page; emailed documents still need A. |
| **C** | Link automatically at approval by matching the extracted BL number to `collective_order.mbl/hbl` and `lading.mbl_no/hbl_no` | No clicks. Repeats the exact-string matching that has picked the wrong row before (SOP break after 15), with no normalisation (adjacent defect 3); a wrong automatic link is invisible. |

- **Recommendation: A.** Smallest change that closes the break, keeps a person's judgement on which shipment a paper belongs to, and needs no server work.
- **Releases:** Task 1.3.

**D2: Can a link be removed?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Add `document.unlink` under `document.update`, audited (Recommended) (Chosen) | A mis-click is correctable; the audit row keeps who removed what. |
| **B** | No unlink; links are permanent | No new endpoint. A wrong link inflates another order's counts forever, and the cross-foot validation reads the wrong counterpart. |
| **C** | Remove by archiving the document | Archiving hides the document everywhere, including from its correct order. |

- **Recommendation: A.**
- **Releases:** Tasks 1.1, 1.3.

**D3: Who reshapes the order `documents` payload so the card renders?** · Status: **Decided 2026-09-21 — Chosen: A** (the same question as step 19 D1, settled to the same answer under X23)

| | Approach | Consequence |
|---|---|---|
| **A** | Step 19 Task 2.2 replaces the flat rollup with `{ counts, customs }`, with BL normalisation and the `bl-job.read` gate; step 18 writes no payload code and merges Phase 1 first (Recommended) (Chosen) | One owner for one function, matching step 19's recommendation. The card renders only when step 19 Phase 2 lands. Step 18 stays out of `collective-order.ts`, so it has no ordering against steps 11–15. |
| **B** | Step 18 Task 1.2 adds `counts` and `customs` additively (§4.2 fallback), keeping the old fields; step 19 builds on it | The card could render with step 18 Phase 1. Two plans then edit the same function in sequence, and step 18 inherits the 11–15 ordering on a 4,800-line file. |
| **C** | Web reader reads the server's current fields | Not possible for the checklist: per-type status needs the joint count, which the marginal maps lose. Listed to name why the server must change. |

- **Recommendation: A.** Settle together with step 19 D1; the two answers must agree. **Settled:** both A (X23, 2026-09-21).
- **Releases:** under B, Tasks 1.2 and 1.4. Under A, nothing here.

**D4: Only under D3-B — does step 18's additive `customs.job` carry `countdownDeadline`?** · Status: **Decided 2026-09-21 — Chosen: A (moot: D3-A was chosen, and step 19 selects `countdownDeadline`, X23)**

| | Approach | Consequence |
|---|---|---|
| **A** | Yes: select `countdown_deadline` and `id` in the existing `bl_job` query (Recommended) (Chosen) | One column; the card's clock (`order-documents-card.tsx:209`) works the day the card renders. |
| **B** | No: `countdownDeadline: null` until step 19 | The card's customs half never shows a clock until step 19 edits the same function again. |
| **C** | Ship the documents half only; `customs` always `"none"` until step 19 | Hides a true stage the server already knows. |

- **Recommendation: A** (if D3-B).
- **Releases:** Task 1.2 (D3-B only).

**D5: How is a mis-typed document re-typed at review?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Type Select on every `needs_review` document; the change travels as `correct`'s existing `docTypeOverride` (Recommended) (Chosen) | Web-only. The reviewer types the new type's required fields by hand (no re-extraction); old-type values stay visible as **Not in schema**. |
| **B** | Let `reprocess` accept a `needs_review` document with a forced type, re-extracting for that type | Better data, no manual typing. Touches the workflow's classify step and the reprocess claim guard (`routers/document.ts:880-910`); larger and harder to test locally. |
| **C** | No change; the SOP tells reviewers to use **Not freight** and reprocess | Records a false rejection and may re-classify the same way (18-P5 sizes use). |

- **Recommendation: A.** Re-check 18-P5: frequent use makes B worth a later plan.
- **Releases:** Tasks 2.1, 2.3.

**D6: What happens to error-severity validation issues at approval?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Show each message under its field; the server does not refuse (Recommended) (Chosen) | The reviewer knows why a row is amber and can correct it. Matches the registry's stance that a reviewer who read the scan outranks the model (`confidence.ts:53-56`). A reviewer can still approve a failing check digit. |
| **B** | Server refuses `approve`/`correct` while an error-severity issue remains | A misread container can never be tracked. A real printed number that fails the check (a carrier's typo) blocks approval with no override. |
| **C** | Show, and require an "I checked this against the scan" tick for each error before approving | Keeps a human override with a record. More UI and a new input on two procedures. |

- **Recommendation: A.** Re-check 18-P6: if approvals with errors are common, C.
- **Releases:** Task 2.2.

**D7: How are two approvals of one BL serialised?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | One transaction around the B/L intake with a per-org `pg_advisory_xact_lock` (Recommended) (Chosen) | No migration; also makes the intake all-or-nothing. One allow-listed raw `execute`. Proven only on real Postgres. |
| **B** | Partial unique index on open jobs `(organization_id, bl_number)`, migration `00NN_bl_job_open_bl_number_uidx`, and catch the unique violation as "already tracked" | The database enforces it for every writer, including future ones. Fails to build while 18-P1 finds duplicates; needs a data clean-up first and the migration's three gates. |
| **C** | Accept the race; ops void extra jobs by hand | No code. Two pollers and two demurrage alerts until someone notices. |

- **Recommendation: A.** Re-check 18-P1 before Task 3.1.
- **Releases:** Tasks 3.1, 3.3.

**D8: What does a hook that throws tell the reviewer?** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | `runApprovalHooks` returns an `approval_hook_failed` notice; recovery is an amendment, which re-runs the intake (Recommended) (Chosen) | Small; the existing warning toast shows it. The recovery (change a field and save the amendment) is clumsy but exists today. |
| **B** | A plus a **Start tracking** action (`document.review.retrack`) that re-runs hooks on an approved document | Clean recovery. A new endpoint and permission question. |
| **C** | Log only (today) | The reviewer believes tracking started. |

- **Recommendation: A.** Re-check 18-P2: if `tracked_elsewhere = false` rows exist, choose B.
- **Releases:** Task 3.2.

**D9: K1/K2 customs declaration type (SOP `fixes[0]`, sev `blocked`).** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Its own feature plan: registry type, extraction prompt, validators, checklist entry (Recommended) (Chosen) | Keeps this plan to defects. The Sepangar declaration stays outside the system until then; the SOP pitfall stays. |
| **B** | Add K1/K2 here | Grows this plan by a registry type, prompt tuning against real declarations (none in the repo) and the card's checklist (`rollup.ts:24`). |
| **C** | A generic "customs declaration" type with no extraction (file and link only) | Files the paper against the job with Phase 1's link; no fields, no validation. Quick, but a type the classifier never assigns needs a manual type choice (D5-A would provide it). |

- **Recommendation: A**, with C as a cheap interim if operations want the declaration filed soon.
- **Releases:** nothing here.

**D10: Re-typing an already approved document.** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Known gap; sized by 18-P3 (Recommended) (Chosen) | Approved mis-typed B/Ls stay untracked until someone uploads the file again. |
| **B** | Let `amend` take `docTypeOverride` into `mbl_hbl` only (`persistAmendment` already accepts `docType`, `persist.ts:136`) | The hook then creates the job. Needs the amendment permission story for type changes and a test that a job already derived from another type cannot exist. |
| **C** | Let reviewers reject an approved document back to review | Re-opens a one-way door the module deliberately closed (`autonomy.ts:10-15`). |

- **Recommendation: A**, unless 18-P3 finds real cases; then B.
- **Releases:** nothing here.

**D11: Member deletion cascades into documents and tracking jobs (adjacent defect 1).** · Status: **Decided 2026-09-21 — Chosen: A**

| | Approach | Consequence |
|---|---|---|
| **A** | Flag to a separate system-wide plan (Recommended) (Chosen) | Nothing changes here; the risk is recorded. |
| **B** | Fix `document_link.created_by` here (`00NN_document_link_created_by_set_null`) | Fixes one table of twelve; the document row itself still cascades. |
| **C** | Refuse `org.members.remove` while the member created documents | Stops the data loss for this module only, and blocks legitimate removals. |

- **Recommendation: A.** 18-P8 sizes it.
- **Releases:** nothing here.

### Risks

- **The card shows Missing on every order at first.** Certain after Phase 1, because no order links exist yet (18-P4). → **Release note: link B/Ls from the document screen; the card is advisory.**
- **Steps 18 and 19 both describe the payload reshape.** Resolved: X23 settled both on 2026-09-21 — this plan's D3-A and step 19 D1-A, step 19 Task 2.2 owns it.
- **The payload reshape ships before link writing.** Medium. → **§7.6 orders 18 P1 before 19 P2; the release note for 19 P2 says linking is available.**
- **`collective-order.ts` line drift.** Certain (plans 11–15 edit it). → **Locate by symbol; merge after 15 P1.**
- **PGlite cannot prove the advisory lock.** Certain. → **Real-Postgres test on the dev branch, seen failing without the lock.**
- **The picker's order search returns many rows for a short query.** Low. → **Wait for two characters; prefill with the BL number.**
- **Re-typing keeps old-type values as Not in schema rows**, which the intake ignores but a reader may find confusing. Low. → **Pencil hidden on those rows (§4.3).**
- **Browser checks run on seeded rows, not a real upload.** Certain locally (no R2 credentials, no model calls). → **Upload and pipeline behaviour are unchanged by this plan; the seeded rows exercise every changed path.**
- **A stale `:3000` makes browser checks pass on old code.** High. → **Restart after every `packages/api` change and check the process start time.**

### SOP text vs code (Phase 0 wins)

| # | SOP claims (step 18 `steps`/`guide`) | Code at `6bb3a1bf` | Plan follows |
|---|---|---|---|
| 1 | Role "Documentation · needs document:read plus review rights" | No documentation role; review held by owner, admin, branch-manager, ops and accounting (`packages/auth/src/permissions.ts:104, 131, 153, 175, 220`); accounting can approve but cannot link (no `update`) | Code |
| 2 | "Press Upload document" cites `documents.index.tsx:102` | `:102` is the table's File column; the button is `components/document-upload.tsx:97`, mounted at `documents.index.tsx:337` | Code |
| 3 | "Use **Download original** to read the source file" | Only for types the browser cannot display (`documents.$documentId.tsx:555-588`); a PDF shows in an iframe with no download control | Code |
| 4 | "Correct any wrong value in place, then save the amendment. Toast: Amendment saved" | Before approval a correction **approves in the same click**: **Save corrections & approve**, toast "Corrections saved and approved" (`:524`, `:292`). **Save amendment** / "Amendment saved" exist only after approval (`:519`, `:320`) | Code |
| 5 | "Press Approve … nothing else starts tracking" | True for review; also the workflow auto-approves under `auto_approve` and runs the same hook (`workflow.ts:191-212`). A job is made only for `mbl_hbl` with a BL number (`intake.ts:56, 79-82`) | Code |
| 6 | "If that B/L is already tracked … it says so" | True (`register-hooks.ts:24-31`) for an unfinished job; a gated-out or voided job does not count (`intake.ts:117-126`); two simultaneous approvals can both miss it (finding C) | Code (Phase 3) |
| 7 | "Misclassified? Press **Reclassify** … Toast: Sent back through classification" | No Reclassify button. The toast belongs to **This is a freight document — reprocess**, shown only on a discarded document (`:611-621`, `:249`). A document awaiting review cannot be reprocessed (`routers/document.ts:890`) or re-typed unless untyped (`:448`) | Code (Phase 2) |
| 8 | "Not freight at all? Press **Reject**" | The button reads **Not freight** (`:493`); the dialog is **Reject this document** (`:839`); toast as stated (`:260`) | Code |
| 9 | Result: "Approval starts the tracking clock" | Approval creates the job; the 72-hour clock runs from vessel berth (`transitions.ts:11`), and the job's `received_at` is the document's upload time (`intake.ts:139`) | Code |
| 10 | Pitfall: "the only screen that links anything sends the type `quote`, so the per-order Documents card never renders" | Both true, for two separate reasons: the link control sends `quote` (`:878`), **and** the card's reader rejects the server's payload shape (`rollup.ts:118` vs `collective-order.ts:1859-1868`). Fixing only the link would still leave the card dead | Code (Phase 1) |
| 11 | Break text: "the server accepts orders and ladings as link targets" | True (`routers/document.ts:109`); there is no unlink | Code (D2) |
| 12 | Fields: "Extracted fields — editable before approval; each edit is recorded as a correction" | Also editable after approval through **amend** (`document.review.amend`, a separate permission `modules/document/permissions.ts:52-57`) | Code |

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web). API: http://localhost:3000. One worktree's servers at a time.
**Preconditions:**
- A dev org with the operations seed (orders with job numbers and at least one lading), then `bun --preload ./apps/server/cf-shim.mjs seed/cli.ts review-documents --write` (Task 1.5) → prints the ids of D-MBL, D-PL, D-BAD, D-DUP1, D-DUP2. Set one sea-export order **O1**'s MBL to `SEED18-BL-1` on its edit form first.
- Actors: a member holding `document:review` and `document:update` (branch-manager or ops); an accountant (review, no update) for the edge case.
- Confirm the actor with `fetch('/api/auth/get-session')`. Confirm the active org (memory `shared-session-active-org`). Restart `:3000` after the last `packages/api` edit.
- The preview pane stays blank for seeded rows (no R2 object); that is expected.

**Migrations:** none. Confirm the journal still ends where merged steps left it, in `_journal.json` and in the database, not by a command's exit code.

**Test commands** (read each output for `failed` and the `Test Files` line):
- Phase 1: `bunx vp test run packages/api/src/routers/document.test.ts packages/api/src/permissions/registry.sync.test.ts packages/api/src/architecture.test.ts apps/web/src/architecture.test.ts` (under D3-B add `packages/api/src/routers/collective-order.documents.test.ts packages/api/src/routers/collective-order.numbering.test.ts apps/web/src/features/order-documents/rollup.test.ts`)
- Phase 2: `bunx vp test run packages/api/src/modules/document/register-hooks.test.ts packages/api/src/routers/document.test.ts "apps/web/src/routes/_next/-documents.reject-shortcut.test.ts"`
- Phase 3: `bunx vp test run packages/api/src/modules/document/hooks.test.ts packages/api/src/modules/document/register-hooks.test.ts packages/port-tracking/src/intake.test.ts packages/api/src/architecture.test.ts`, then `DATABASE_URL_TEST=<dev branch URL> bunx vp test run packages/api/src/modules/document/register-hooks.concurrency.test.ts` (confirm its tests are listed as passed, not skipped).
- Every phase: `bun run check-types` (confirm `apps/web` and `seed` ran).

**Golden path — Journey 1 (Phase 1)**
1. Open `/documents`, filter status **Needs review**, open D-MBL → press **Approve (⌘⏎)** → toast "Extraction approved"; badge reads approved.
2. Under the fields, **Linked records** reads "Not linked yet." Choose **Order** → the search box reads `SEED18-BL-1`; O1 is listed → pick it, press **Link** → toast "Linked to order <O1 job number>"; the list shows it as a link to `/order/<O1>/edit`.
3. In the console, `document/get` for D-MBL → `links` has one row with `entityType: "collective_order"`.
4. Choose **Bill of lading**, search the seeded lading's bill number, **Link** → toast; two links listed.
5. (After the payload reshape has merged, §4.2.) Open `/order/sea-export`, open O1's reading pane → the **Documents & customs** group renders: **MBL / HBL** chip Approved, the other two Missing; the customs line shows the tracking job's stage for `SEED18-BL-1`.
6. Open `/lading/<id>` for the linked lading → the same card.
7. Back on D-MBL, press **Unlink** on the lading link → toast "Link removed"; reload → one link remains.

**Golden path — Journey 2 (Phase 2)**
1. Open D-PL → header shows a **Document type** Select set to **Packing list**.
2. Choose **Bill of Lading (MBL/HBL)** → B/L fields appear with **Required** badges; packing-list values show **Not in schema** with no pencil.
3. Fill `blNumber` `SEED18-BL-3`, shipper, consignee, both ports and one container `MSCU1234565` → **Save & approve** → toast "Corrections saved and approved".
4. `document/get` → `docType: "mbl_hbl"`, status approved. Open `/customs-tracking` → a job for `SEED18-BL-3`.
5. Open D-BAD → the containers row is amber and shows "Container number ABCU1234560 fails the ISO 6346 check digit". Correct it to a valid number, **Save corrections & approve** → approved; reload → the message is gone.

**Golden path — Journey 3 (Phase 3)**
1. Approve D-DUP1 → "Extraction approved".
2. Approve D-DUP2 → warning "SEED18-BL-2 is already being tracked from an earlier document, so no second tracking job was created. The existing job continues."; `/customs-tracking` lists one job for `SEED18-BL-2`.
3. The simultaneous case and the failure notice are proven by `register-hooks.concurrency.test.ts` and `hooks.test.ts`, not in the browser.

**Edge case 1: permission split.** As the accountant (review, no update): D-MBL shows the fields and the approval controls but no link control and no **Unlink**; a console `document/unlink` returns 403.
**Edge case 2: no document read.** As a member without `document:read`, O1's reading pane shows no Documents group (payload `documents: null`), not three Missing chips.
**Edge case 3: ambiguous customs.** On the dev branch, seed a second non-voided job for `SEED18-BL-1` (direct INSERT) → O1's card says the match is ambiguous and shows no single stage.
**Edge case 4: unlink of something not linked.** Console `document/unlink` with a random `entityId` → 404; `audit_log` has no `document.unlink` row for it.
**Edge case 5: type change without field edits on an untyped document.** An untyped needs-review document still refuses to submit until a type is chosen (unchanged behaviour, `:346-351`).

**Regression checks.**
1. `/documents` list, search and status filter behave as before; **Not freight** and the reject dialog still work, and ⌘⏎ inside the dialog does not approve (`:383-387`).
2. A discarded document still offers **This is a freight document — reprocess**.
3. Amending an approved B/L's vessel name still re-syncs the job or returns the refusal notice (`register-hooks.ts:14-20`).
4. `/order/sea-export` loads with the same row count and speed; `collective-order.numbering.test.ts` one-query assertion passes.
5. `/customs-tracking` lists the seeded customs jobs as before.

**Mobile:** at 400px the **Linked records** control stacks (kind, search, results, Link) without horizontal scroll; the type Select fits the header or wraps below the filename; issue messages wrap under their fields.

**Readiness: 7/10 — every defect is verified in code and each phase is small; every decision is settled (2026-09-21) and the payload ownership is fixed with step 19 (X23), but the lock proof needs a dev database and the probes are unrun.** Outstanding:
- Decisions: none open. D1–D11 Decided A (D4 moot under D3-A).
- Payload ownership: settled as step 19's (18 D3-A = 19 D1-A, X23). Journey 1 steps 5–6 are proven only after step 19 Phase 2 merges, and step 19 Phase 2's server deploys only after this plan's Phase 1 is deployed.
- Probes 18-P1, 18-P2, 18-P4 before their tasks; the others size decisions whose choice stands (18-P3 for D10, 18-P5 for D5, 18-P6 for D6, 18-P8 for D11).
- The concurrency proof exists only on a dev Neon branch (`DATABASE_URL_TEST`); CI has none, so the Phase 3 PR pastes the real-Postgres output.

### Decisions settled (2026-09-21)

Wilfred accepted the recommended option of every decision in §9, and every recommended settlement in `steps-16-19-crosscheck.md` (X17–X27). Each §9 entry keeps all three approaches; only the status, the Chosen marks and the text that described a decision as open were changed.

**Chosen:** D1-A · D2-A · D3-A · D4-A (moot under D3-A) · D5-A · D6-A · D7-A · D8-A · D9-A · D10-A · D11-A.

**Crosscheck settlements, as they land in this plan.** X23 → D3-A with step 19 D1-A: step 19 Task 2.2 owns the whole `documents` reshape; this plan writes no payload code, so Tasks 1.2 and 1.4, the §4.2 fallback spec and D4 are not done; Phase 1 (link writer) merges and deploys before step 19 Phase 2. X24 → the raw BL compare at intake (adjacent defect 3) is an accepted known gap, not assigned. X26 → the conditional `00NN_bl_job_open_bl_number_uidx` (D7-B) and `00NN_document_link_created_by_set_null` (D11-B) were not chosen; if ever revived they take the next free number at merge. X27 → the SOP corrections in §9 stay unowned. **No X-item overrode a recommendation in this plan.**
