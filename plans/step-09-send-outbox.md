# Step 09 — a failed stamp must not cost the customer a second email

**SOP step:** 09 "Send it to the customer" · `/quotations/$quotationId` → header **Send** / **Resend**
**Evidence read at:** `feat/new-layout` HEAD `6bb3a1bf` (JSON captured at `6c31a20e`), 2026-09-15
**Tier:** Standard (new table + migration, changes the only writer of `sent`, runs in the multi-tenant send path)

---

## Phase 0 findings (read before the plan)

- **Stack** — oRPC routers in `packages/api/src/routers`, Drizzle schema in `packages/db/src/schema`, TanStack Router file routes under `apps/web/src/routes/_next`, zod, vitest + PGlite. Server is one Cloudflare Worker (`packages/infra/alchemy.run.ts`, `compatibility: "node"`); DB driver is `drizzle-orm/neon-serverless` (a WebSocket `Pool`) on Neon, `node-postgres` locally (`packages/db/src/client.ts:141-151`). A new `Pool` is opened per request and ended in `waitUntil` after the response (`apps/server/src/index.ts:128-169`).
- **The send path today.** `quotationsRouter.send` (`packages/api/src/routers/quotation.ts:2598-2832`):
  1. scope + load (`:2618-2623`), refusal 3 for won/lost/converted (`:2631-2635`), render (`:2640-2643`), branded body (`:2648`). Everything that can refuse happens **before** the mail.
  2. `composeThread` (`:2655-2696` → `packages/api/src/modules/mailbox/reply.ts:482-627`). It checks the connection (`:490-504`), calls `port.sendAs` (`:506-519`), puts the attachment in R2 best-effort (`:528-533`), then commits `thread` + outbound `message` + audit in **its own** transaction (`:535-626`).
  3. A second transaction stamps `quotation` (status CASE, `sent_at/by/to/thread`), inserts the `thread_link` and writes the `quotation.send` audit row (`:2745-2824`).
- **The defect is real, but the code records the ordering as a deliberate, named gap.** The comment block at `quotation.ts:2566-2596` weighs stamp-first against send-first, picks send-first, and closes: _"THE GAP, NAMED: after such a failure, pressing Send again sends a SECOND copy … the smallest window available without an outbox table, which is a bigger machine than one endpoint should introduce."_ This plan overturns that judgement, so D1 is Wilfred's call.
- **The window is wider than filed.** The JSON and the router comment both assume that when the stamp fails, _"composeThread has already committed the thread, the outbound message and its own audit row"_. That only holds for a failure in step 3. If `composeThread`'s own transaction (`reply.ts:535`) fails after `sendAs` returned, **nothing** is written: no thread, no message, no audit, no stamp. The customer holds the quotation and the system has no trace of it. This is the silent case the comment says it avoids.
- **A duplicate is one click away.** The dialog closes only in `onSuccess`. On error it toasts and stays open with every field intact (`apps/web/src/components/quotation/send-quotation-dialog.tsx:168-194`), and the quotation is still `draft`, so the header still offers **Send** (`$quotationId.tsx:1362-1373`). A lost HTTP response after a fully successful send (a network blip, or a closed laptop lid) leads to the same second click.
- **Precedent: an intent row before dispatch.** The transactional mail pipeline inserts a `delivery_log` row as `queued` before dispatch (`packages/email/src/send.ts:183-205`). Its `processEmailJob` keeps **only** the provider call inside the `try`, and it will not rethrow a bookkeeping failure after a successful send _"that would re-deliver an email the recipient already received"_ (`send.ts:36-95`). This plan applies that shape to the mailbox send path.
- **Resume can reuse existing dedup keys.** `composeThread`'s inserts are already idempotent on `(connection_id, provider_thread_ref)` and `(connection_id, provider_ref)` (`reply.ts:553`, `:594`). `thread_link` is idempotent on its unique key (`quotation.ts:2787-2789`). Outbound attachment ids are positional so that _"a retried send … overwrit[es] in place"_ (`reply.ts:171-183`). Replaying the record half with a known `providerRef` is therefore safe **without** re-sending.
- **Custom headers reach both providers.** Gmail writes every non-reserved `input.headers` entry into the RFC 2822 message (`packages/email/src/gmail.ts:470-473`). Outlook forwards `x-*` headers as `internetMessageHeaders` (`packages/email/src/outlook.ts:474-489`). An `X-NCT-Send-Key` header can go out today with no port change, which makes later provider-side reconciliation possible (D6).
- **Runtime constraints** (why the other designs lose):
  - *A DB transaction around the mail call* does not close the window, because `COMMIT` can still fail after the provider accepted. It would also hold the `quotation` row lock through a 1–3 s provider round trip, capped only by the client-side `query_timeout` of 30 s. `client.ts:66-83` records that a timed-out drizzle transaction can return a connection with an open `BEGIN` to the pool.
  - *Cloudflare Queues* exist (`email-queue`, `mailbox-sync`, `bl-check`, `doc-ingest`). Delivery is at-least-once, so a consumer that dies after `sendAs` duplicates the mail the same way. Using a queue would also turn Send into an asynchronous "queued" UX, and `dev:local` has no queue emulation (`packages/email/src/worker.ts:52-56`).
  - *Workflows* exist (`DOC_PIPELINE`). A `step.do` that throws after the provider accepted is retried, and a crash between accept and step persistence has the same gap.
  - *Crons are prod-only* (`alchemy.run.ts`, `crons: app.stage === "prod" ? […] : []`). A background reconciler would never run on demo or dev, so the plan does not rely on one (D4).
- **Gating today** — `send` is `requireNode(QUOTATION.update)` + `applyScope` (`quotation.ts:2599`, `:2618`). The comment at `:2549-2564` explains why no `quotation.send` node was minted. The eyun **"Export quotation"** gate (`modules/quotation/gates.ts:8`) is asserted on **`retrieve`** (`quotation.ts:2353-2361`), **not** on `exportSheet` (`:2489-2490`, `QUOTATION.read`) and **not** on `send`. The Step 08 plan is rewiring that gate. **This plan does not touch permissions.** See D7 for the coupling.
- **Architecture gates** — `quotation` is a governed table. `"routers/quotation.ts :: quotationsRouter.send :: update(quotation)"` is on the allow-list at `packages/api/src/architecture.test.ts:533`, keyed by **enclosing scope**. Moving the stamp into a helper would change that key and break the gate, so resume lives inside `send` itself (D3). No raw `.execute()` is added. `sql\`case…\`` inside `.set()` is already there and is not an execute site.
- **Touch surface** — `packages/api/src/routers/quotation.ts` (send handler + one new read), `packages/api/src/modules/mailbox/reply.ts` (split `composeThread` into dispatch/record halves; behaviour for `thread.compose` unchanged), `packages/api/src/routers/quotation.send-decide.test.ts`, `packages/api/src/modules/mailbox/reply.test.ts`, `packages/db/src/schema/quotation-send.ts` [NEW], `packages/db/src/schema/index.ts`, migration `0073` [NEW] + journal + snapshot, `apps/web/src/components/quotation/send-quotation-dialog.tsx`, `apps/web/src/routes/_next/quotations/$quotationId.tsx` (one notice).
- **Migration state** — journal has 65 entries ending `0065_quotation_send_decision`, with 65 `.sql` files, contiguous, nothing pending. Step 01 claims `0066` and step 02 claims `0067`. This step is **reserved `0073`** (`idx` 72). Because gate 2 (`idx` contiguous) forbids a hole, **0073 cannot merge until 0066–0072 are all in HEAD** (see §7 blocking prerequisites).

---

## 1. Overview

**Problem.** Send mails the customer first and records it second. If recording fails after the provider has accepted, the operator sees a red toast on a quotation that still reads **Draft**, with the dialog still open and **Send** still enabled. The only way forward sends the customer a second copy. The worse sub-case is when `composeThread`'s own write fails: then the send leaves no trace in the system at all.

**Goal.** Record the send intent before dispatch and advance it after. A retry then **resumes the recording** instead of re-sending, and a send whose outcome is genuinely unknown is **shown** to the operator instead of silently repeated.

**Success criteria.**
- Stamp or thread write fails after the provider accepted → pressing **Send** again records the stamp, and the provider port is called **zero** more times (asserted in the test).
- A double-click, or two tabs, with the same dialog session produce exactly one `sendAs` call.
- A send whose outcome is unknown (crash between accept and the `dispatched` write) is never re-sent automatically. The operator sees it on the quotation and in the dialog, and must explicitly choose to send again.
- `thread.compose` (the inbox composer) behaves byte-identically.

**In scope.** The outbox/intent table, idempotency key, resume path, unknown-outcome surface, tests, dialog and record-page notice.
**Out of scope.** Permission/gate changes (Step 08 owns them, D7); provider-side reconciliation by header search (D6, deferred); a cron reconciler (D4); moving `send` onto a queue or workflow (D2); `replyToThread`; the transactional `delivery_log` pipeline.

**Inputs read.** `steps/step-09.json`, `steps/step-09-findings.json`; exemplar `plans/step-03-contact-nomination.md`; memory `readiness-signals-lie`, `two-architecture-tests`, `migration-has-three-gates`, `bun-hot-ignores-workspace-deps`, `alchemy-partial-deploy-splits-the-stage`. The JSON's one fix is planned in full. Its pitfall 2 (terminal statuses refused) is existing behaviour and is kept unchanged.

**Assumptions.**
- Overturning the documented send-first "named gap" is wanted → D1 (settled 2026-09-15: B)
- The intent table is quotation-specific, not a generic mailbox outbox → D5
- Resume happens through `send` with the same key, not a separate endpoint → D3
- No background reconciler in this change → D4
- `X-NCT-Send-Key` is stamped on the outgoing mail now, and header-search reconciliation is deferred → D6
- The idempotency key is minted per dialog session → D8

## 2. User Journeys

**Journey 1 (replaces the old failure journey): Sales retries a send whose recording failed**
Trigger: Sales presses **Send** in the **Send quotation NCT-Q-…** dialog. The provider accepts, and the stamp write fails (DB blip or pooler restart).
Steps:
1. System records a `pending` intent (keyed by the dialog's send key), mails the customer, and marks the intent `dispatched` with the provider ref. Then the thread/stamp write fails.
2. User sees the dialog **stay open** with an inline amber notice above the footer: _"The email to customer@acme.com went out, but saving the record failed. Press **Finish recording** — the customer will not receive another copy."_ The primary button now reads **Finish recording**. The toast says the same in one line.
3. User presses **Finish recording** → `quotations.send` is called again with the **same** send key. The server finds the `dispatched` intent, skips render and provider, and replays the thread record + stamp.
4. System succeeds → toast _Quotation NCT-Q-… sent_. The dialog closes, the badge reads **Sent**, and the Threads card lists the thread.
5. Flow ends: one email in the customer's inbox, one thread, one stamp, one `quotation.send` audit row.
Where it lives: inline in the existing Send dialog. No new screen.

_Old journey, for contrast:_ steps 1–2 end with a generic error toast, the dialog open, and the button reading **Send**. Pressing it renders again, mails again, and the customer gets two quotations.

**Journey 2 (new): Sales reopens a quotation whose earlier send was never recorded**
Trigger: after Journey 1 step 2 the user closed the dialog or tab instead, or a crash left the outcome unknown.
Steps:
1. User opens the quotation → an inline notice sits under the status badge in the header:
   - `dispatched`: _"A send to customer@acme.com at 14:02 went out but was not recorded."_ with a **Finish recording** button.
   - `pending` older than 2 minutes: _"A send to customer@acme.com at 14:02 may have gone out — check your Sent folder."_ with **It went out** / **It did not go out** buttons.
2a. **Finish recording** → calls `send` with the stored key and params → same result as Journey 1 steps 3–5, and the notice disappears.
2b. **It did not go out** → `quotations.abandonSend({ sendId })` marks the intent `abandoned`. The notice disappears and **Send** works normally.
2c. **It went out** → `quotations.abandonSend({ sendId, outcome: "sent_unrecorded" })` marks it `abandoned` with that note and writes an audit row. The quotation is **not** stamped: there is no provider ref, so no thread can be linked. The user is told to press **Decide** only after a real stamped send (existing rule, `$quotationId.tsx:1391-1403`).
3. While any `pending`/`dispatched` intent exists, pressing **Send/Resend** opens the dialog with the same notice at the top. **Send** is disabled until the intent is resolved. (Different recipients are still a legitimate resend once it is resolved.)
4. Flow ends: no intent is left unresolved, and the quotation's record matches the customer's inbox.
Where it lives: inline in the quotation header (`$quotationId.tsx`, beside the status badge) and at the top of the Send dialog.

**Journey 3 (unchanged, must not regress): the golden send**
Trigger: **Send** → fill the dialog → **Send** → toast _Quotation NCT-Q-… sent_ → **Sent** badge → Threads card populated. One extra INSERT and one extra UPDATE server-side. Nothing visible changes.

## 3. Result (What Changes for the User)

**Before:** When saving a sent quotation fails, the screen invites a second press of Send, and that press mails the customer a duplicate. If the thread write itself failed, nothing anywhere says a mail went out.
**After:** The screen says the mail went out and offers **Finish recording**, which saves the record without mailing again. A send whose fate is unknown is shown on the quotation until someone resolves it.
**Key differences:**
- Sales: a failed recording shows **Finish recording**, never a bare retry of **Send**.
- Sales: an unrecorded or uncertain send shows as a notice on the quotation header.
- Sales: double-clicking Send can no longer produce two emails.
- Customer: never receives a duplicate because of our bookkeeping.

## 4. Technical Architecture

**State machine** (one row per attempted send; needed by Journey 1 step 1 and Journey 2 step 1):

```
            insert (pre-send)                 sendAs ok                 record+stamp tx ok
 (none) ───────────────────────► pending ─────────────────► dispatched ─────────────────► recorded
                                   │  sendAs threw a CODED refusal         │
                                   ├──────────────────────────► failed     │ (retry same key → resume)
                                   │  sendAs threw uncoded / crash         │
                                   └── stays pending (outcome unknown) ◄───┘ never goes back
 pending|dispatched ── abandonSend ──► abandoned
```

- `failed` = the provider definitively refused (`E_AUTH_EXPIRED`, `E_RATE_LIMITED`, `MailboxOAuthConfigError`, `ORPCError` from the connection check). A retry with the same key flips `failed → pending` conditionally and re-dispatches. That is safe because nothing left.
- An **uncoded** throw from `sendAs` (network error or timeout) leaves the row `pending`, because the provider may have accepted. This is the one honest "unknown" state (D9).

**Schema — `packages/db/src/schema/quotation-send.ts` [NEW]** (Journeys 1–2). Separate file so it does not collide with step 01's edit of `schema/quotation.ts`:

```ts
export const quotationSendStatus = pgEnum("quotation_send_status",
  ["pending", "dispatched", "recorded", "failed", "abandoned"]);

export const quotationSend = pgTable("quotation_send", {
  id: text("id").primaryKey(),                       // also the X-NCT-Send-Key header value
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  quotationId: text("quotation_id").notNull().references(() => quotation.id, { onDelete: "cascade" }),
  sendKey: text("send_key").notNull(),               // client idempotency key (D8)
  status: quotationSendStatus("status").default("pending").notNull(),
  // Frozen request — what resume needs without re-rendering or re-reading the dialog.
  connectionId: text("connection_id").notNull(),     // no FK: a disconnected mailbox must not erase the evidence
  sentBy: text("sent_by").references(() => member.id, { onDelete: "set null" }),
  actorUserId: text("actor_user_id").notNull(),
  toAddress: text("to_address").notNull(),
  cc: jsonb("cc").$type<string[]>().default([]).notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),             // the rendered branded shell, as sent
  bodyText: text("body_text").notNull(),
  format: text("format").notNull(),
  language: text("language").notNull(),
  attachment: jsonb("attachment").$type<{ filename: string; mimeType: string; size: number; stagedKey: string | null }>().notNull(),
  // Outcome
  providerRef: text("provider_ref"),
  threadId: text("thread_id").references(() => thread.id, { onDelete: "set null" }),
  messageId: text("message_id"),
  lastError: text("last_error"),
  abandonNote: text("abandon_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  uniqueIndex("quotation_send_org_key_uq").on(t.organizationId, t.sendKey),
  index("quotation_send_open_idx").on(t.organizationId, t.quotationId)
    .where(sql`status in ('pending','dispatched')`),
]);
```

- No `owningBranchId` or `createdBy` columns on purpose. Those names give a table the "governed shape" in `architecture.test.ts`. Access is always through the quotation's own `applyScope` (§8 item 8).
- `bodyHtml` holds the output of `renderOutboundMessageEmail`. On resume the `message` row records what the customer actually saw.
- `attachment.stagedKey`: the rendered file is put into `EMAIL_ATTACHMENTS` **before** dispatch under `quotation-send/<org>/<sendId>/outbound-1`, best-effort exactly like today. The `message.attachments[0].r2Key` then points at it. Resume therefore never re-renders, so a quotation edited between send and resume cannot put the wrong bytes on record (D10).

**Migration `0073_quotation_send_outbox.sql` [NEW]:** `CREATE TYPE`, `CREATE TABLE`, the unique index, the partial index. No extension and no backfill, so it replays on PGlite (gate 3).

**`reply.ts` split** (serves Journey 1 steps 1 and 3; `thread.compose` unchanged):

```ts
export async function dispatchCompose(deps, input, opts?: { headers?: Record<string, string> })
  : Promise<{ connection: MailboxConnectionRow; providerRef: string }>;   // reply.ts:490-519 today

export async function recordComposedThread(deps, input, sent: { connection; providerRef },
  opts?: { preStoredAttachmentKeys?: (string | null)[]; sentAt?: Date })
  : Promise<ComposeThreadResult>;                                        // reply.ts:525-626 today

export async function composeThread(deps, input) {                      // unchanged contract
  return recordComposedThread(deps, input, await dispatchCompose(deps, input));
}
```

`preStoredAttachmentKeys` skips the post-send `put` and records the staged key. Omitted, it behaves as today. `recordComposedThread` must not re-check `connection.status`: a mailbox paused after the mail left must still get its record (it takes the row, not a fresh visibility read; the visibility check was done at dispatch).

**`quotations.send` contract** (Journeys 1–3). Input adds two fields; the output is unchanged plus `resumed`:

```ts
input:  { …existing…, sendKey: z.string().uuid(), confirmResendOverOpenIntent?: never }  // no override in v1 (Journey 2 step 3)
output: { threadId, messageId, sentAt, filename, resumed: boolean }
errors: CONFLICT  data { reason: "SEND_IN_FLIGHT" | "OPEN_INTENT", sendId, status, toAddress, createdAt }
        INTERNAL_SERVER_ERROR data { reason: "RECORD_FAILED_RESUMABLE", sendId, toAddress }
```

Handler order (all inside `quotationsRouter.send`, so the allow-list key at `architecture.test.ts:533` is unchanged):

1. Scope + load `header` → NOT_FOUND (unchanged).
2. **Key lookup**: `select … from quotation_send where organization_id = ? and send_key = ? and quotation_id = header.id`.
   - `recorded` → return the stored result, `resumed: true`, with no writes.
   - `dispatched` → go to step 7 using the frozen row. **Skip** refusal 3, render and provider.
   - `pending` → CONFLICT `SEND_IN_FLIGHT` (a double-click or unknown outcome; never re-dispatch).
   - `failed` → conditional `update … set status='pending' where id=? and status='failed'`; rowcount 0 → `SEND_IN_FLIGHT`. Then continue at step 3.
   - `abandoned` → CONFLICT (the key is spent; the dialog mints a new one).
3. **Other open intents** for this quotation (partial index): any `pending`/`dispatched` row with a different key → CONFLICT `OPEN_INTENT` (Journey 2 step 3).
4. Refusal 3, render, branded body (unchanged, `:2631-2648`).
5. **Intent insert** (a new row only): `insert … on conflict (organization_id, send_key) do nothing returning`. An empty return means a concurrent same-key request won, so re-read and apply step 2. Then stage the attachment bytes in R2 (best-effort; `stagedKey` updated in the same statement as `connection_id` resolution is not possible, so do one follow-up `update … set attachment` before dispatch).
   _Race note:_ step 3 + step 5 are check-then-insert. Two different keys racing on one quotation can both pass step 3. Accepted: that is two operators pressing two dialogs, and each gets its own mail as today. The unique key guarantees **one mail per key** (D8, §8 item 6).
6. **Dispatch**: `dispatchCompose(..., { headers: { "X-NCT-Send-Key": intent.id } })`.
   - Coded throw → `update set status='failed', last_error` → rethrow via the existing `toReplyORPCError` mapping.
   - Uncoded throw → leave `pending`, set `last_error` best-effort, rethrow as INTERNAL_SERVER_ERROR with the message _"The mailbox did not confirm the send. Check your Sent folder before trying again."_
   - Success → **`update set status='dispatched', provider_ref=? where id=? and status='pending'`** as its own statement, immediately. If this write throws, the row stays `pending` (unknown), which is correct: never auto-resend.
7. **Record** (in a try; this is the resume entry point): `recordComposedThread` with the frozen fields and `preStoredAttachmentKeys: [attachment.stagedKey]`. Then the **existing** stamp transaction (`:2745-2824`, unchanged except `sentTo/sentAt` come from the intent row), plus inside the same tx `update quotation_send set status='recorded', thread_id, message_id where id=? and status='dispatched'`.
   - Rowcount 0 on that last update → another request already recorded it. Roll back and return the recorded result.
   - Any throw in step 7 → INTERNAL_SERVER_ERROR `RECORD_FAILED_RESUMABLE` (row stays `dispatched`).
   - The stamp's refusal-3 CASE still protects a concurrent `decide`.
8. Audit: `quotation.send` in the stamp tx gains `after.sendId` and `after.resumed`.

**`quotations.openSends` [NEW]** (Journey 2 step 1): `orgProcedure.use(requireNode(QUOTATION.read))`, input `{ id }`. Applies quotation scope (NOT_FOUND otherwise), then returns up to 5 rows `status in ('pending','dispatched')` with `{ sendId, sendKey, status, toAddress, cc, subject, format, language, createdAt, connectionId }`. Bodies are excluded from the payload.

**`quotations.abandonSend` [NEW]** (Journey 2 steps 2b/2c): `requireNode(QUOTATION.update)`, input `{ sendId, outcome: "not_sent" | "sent_unrecorded" }`. Applies scope via the parent quotation, then `update … set status='abandoned', abandon_note where id=? and status in ('pending','dispatched')`, and writes the `quotation.send.abandon` audit row in one transaction. Abandoning a `dispatched` row is allowed but the UI does not offer it: the notice offers **Finish recording** there.

**Web** (Journeys 1–2):
- `send-quotation-dialog.tsx`: mint `sendKey = crypto.randomUUID()` in the existing open/re-seed effect (`:139-155`), so it is stable for the whole dialog session. Read `error.data.reason`: `RECORD_FAILED_RESUMABLE` → amber notice + button label **Finish recording** (same `mutate` payload, same key). `SEND_IN_FLIGHT`/`OPEN_INTENT` → notice from `data`. The mutation's `isPending` already disables the button (kept).
- `$quotationId.tsx`: under the status badge block (`:1347-1418`), query `quotations.openSends` (enabled when `!isNew`) and render the Journey 2 notice. Invalidate it in the dialog's `onSuccess` alongside the existing three invalidations (`:171-191`).

**Key decisions.**
- Intent row before dispatch, resume on retry, over send-first-and-hope → D1
- Synchronous in-request send over a queue or workflow → D2
- Resume through `send` with the same key, not a new endpoint → D3
- No cron reconciler in v1 → D4
- A quotation-specific table, not a generic outbox → D5
- Header stamped now, provider search deferred → D6
- Permission untouched, with coupling to Step 08 declared → D7
- Key per dialog session → D8
- An uncoded provider error is "unknown", not "failed" → D9
- Attachment staged before dispatch → D10

## 5. Phased Implementation

### Phase 0 — Prerequisite (not code)

- **Task 0.1** — Confirm `0066`–`0072` are all in HEAD (journal `idx` 0–71) before 0073 merges. If a sibling dropped its number, renumber this migration to the next contiguous tag and hand-fix `idx` (memory: migration-has-three-gates). · Owner: **Agent A (backend)**
- **Task 0.2** — Verify on Cloudflare docs whether a Worker request's pending work is cancelled on client disconnect. Record the answer in the PR. The design is correct either way (a cancel lands in `pending` or `dispatched`), but it sets how often Journey 2 will be seen. · Owner: **Agent A (backend)**

### Phase 1 — A failed recording resumes instead of re-sending

**Delivers:** Journey 1 end-to-end, Journey 3 unchanged.
**Dependencies:** Task 0.1 (for the migration number only; code and tests can be written first against PGlite).

- **Task 1.1** — Add `schema/quotation-send.ts`, export it from `schema/index.ts`, generate `0073_quotation_send_outbox.sql` + snapshot + journal entry. Run `bunx vp test run packages/db/src/migrations.test.ts` and read the output, not the exit code.
  Files: `packages/db/src/schema/quotation-send.ts` [NEW], `packages/db/src/schema/index.ts`, `packages/db/src/migrations/0073_quotation_send_outbox.sql` [NEW], `packages/db/src/migrations/meta/0073_snapshot.json` [NEW], `packages/db/src/migrations/meta/_journal.json` · Owner: **Agent A (backend)**
- **Task 1.2** — Split `composeThread` into `dispatchCompose` + `recordComposedThread` (+ `headers`, `preStoredAttachmentKeys` options). `composeThread` stays a two-line wrapper. Extend `reply.test.ts`: (a) the compose happy path is byte-identical; (b) `recordComposedThread` called twice with the same `providerRef` yields one thread, one message and two audit rows (documented), and never calls the port; (c) `headers` reach `MailboxSendAsInput.headers`.
  Files: `packages/api/src/modules/mailbox/reply.ts`, `packages/api/src/modules/mailbox/reply.test.ts` · Owner: **Agent A (backend)**
- **Task 1.3** — Rewrite `quotationsRouter.send` to the 8-step order in §4. Replace the comment block at `:2566-2596` with the new ordering rationale, keeping the stamp-first/send-first analysis and replacing "THE GAP, NAMED" with the state machine. Keep the CASE and stamps comments.
  Files: `packages/api/src/routers/quotation.ts` · Owner: **Agent A (backend)**
- **Task 1.4** — Tests in `quotation.send-decide.test.ts`, using a counting in-memory port (wrap `createInMemoryMailboxConnectionPort`):
  - happy path writes the intent `recorded`, and every existing assertion is kept;
  - **stamp failure then retry**: inject a failure in the stamp tx (e.g. delete the `q-draft` scope row condition via a one-shot `db` proxy that throws on `update(quotation)`) → 500 `RECORD_FAILED_RESUMABLE`, intent `dispatched`, port calls = 1; retry with the same key → 200 `resumed: true`, port calls **still 1**, one thread, one `thread_link`, stamp present;
  - **composeThread record failure then retry** (throw on `insert(thread)` once) → same as above;
  - same key twice concurrently (`Promise.all`) → one 200 + one CONFLICT `SEND_IN_FLIGHT`, port calls = 1;
  - coded provider refusal → intent `failed`, retry with the same key dispatches again (port calls = 2, 1 accepted);
  - uncoded throw → intent `pending`, retry with the same key → `SEND_IN_FLIGHT`, port calls = 1;
  - an open intent under another key → `OPEN_INTENT`;
  - the existing race-with-decide test still passes on the resume path.
  Files: `packages/api/src/routers/quotation.send-decide.test.ts` · Owner: **Agent C (tests)**
- **Task 1.5** — Dialog: `sendKey` per session, the three error reasons, **Finish recording** label and notice.
  Files: `apps/web/src/components/quotation/send-quotation-dialog.tsx` · Owner: **Agent B (frontend)**

**Acceptance.** With a forced stamp failure, the user presses Send, sees **Finish recording**, presses it, and the quotation reads **Sent** with one thread. The test asserts exactly one provider call. `architecture.test.ts` (api) and `migrations.test.ts` are green by their output.

### Phase 2 — An unrecorded send is visible on the quotation

**Delivers:** Journey 2 end-to-end.
**Dependencies:** Phase 1 (table + send contract).

- **Task 2.1** — `quotations.openSends` and `quotations.abandonSend` (scope-checked, audited). Tests: scope NOT_FOUND for an out-of-scope quotation, abandon of a `recorded` row → CONFLICT, abandon writes audit.
  Files: `packages/api/src/routers/quotation.ts`, `packages/api/src/routers/quotation.send-decide.test.ts` · Owner: **Agent A (backend)** (router), **Agent C (tests)** (test file)
- **Task 2.2** — Header notice on the record page (Journey 2 steps 1–2), invalidation from the dialog, and **Send** disabled while an intent is open, with the notice as its `title`.
  Files: `apps/web/src/routes/_next/quotations/$quotationId.tsx`, `apps/web/src/components/quotation/send-quotation-dialog.tsx` · Owner: **Agent B (frontend)**

**Acceptance.** User closes the dialog after a failed recording, reopens the quotation, sees the notice, presses **Finish recording**, and the notice clears with the badge reading **Sent**. A `pending` row offers **It did not go out**, which clears the notice and re-enables Send.

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 0.1, 0.2, 1.1, 1.2, 1.3 | `packages/db/src/schema/quotation-send.ts`, `packages/db/src/schema/index.ts`, `packages/db/src/migrations/0073_*`, `packages/db/src/migrations/meta/0073_snapshot.json`, `packages/db/src/migrations/meta/_journal.json`, `packages/api/src/modules/mailbox/reply.ts`, `packages/api/src/modules/mailbox/reply.test.ts`, `packages/api/src/routers/quotation.ts` | `packages/api/src/architecture.test.ts`, `packages/email/src/ports.ts` |
| Agent C (tests) | test-engineer | sonnet | medium | 1.4 | `packages/api/src/routers/quotation.send-decide.test.ts` | `packages/api/src/routers/quotation.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.5 | `apps/web/src/components/quotation/send-quotation-dialog.tsx` | `packages/api/src/routers/quotation.ts` |

opus for A: a migration, the multi-tenant send path, and a failure-ordering design where a wrong call mails customers twice.
Run mode: **A → (B ∥ C)**. B and C wait on the §4 send contract (input `sendKey`, error `data.reason`) landing in `quotation.ts`.
Serialization points: after A, run `migrations.test.ts` + `packages/api/src/architecture.test.ts`. After B ∥ C, run `bun run check-types` and grep for "failed" in its output (memory: vp-run-exit-code-lies).

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | sonnet | medium | 2.1 (router) | `packages/api/src/routers/quotation.ts` | `packages/db/src/schema/quotation-send.ts` |
| Agent C (tests) | test-engineer | sonnet | medium | 2.1 (tests) | `packages/api/src/routers/quotation.send-decide.test.ts` | `packages/api/src/routers/quotation.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 2.2 | `apps/web/src/routes/_next/quotations/$quotationId.tsx`, `apps/web/src/components/quotation/send-quotation-dialog.tsx` | `packages/api/src/routers/quotation.ts` |

Run mode: **A → (B ∥ C)**. Same serialization point.

Smell test: every task has one owner · no file owned twice in a phase · parallel groups disjoint · the opus is justified · sequential waits name the send contract · each phase completes a journey.

## 7. Impact & Breakage Analysis

- **`composeThread`** — callers (grepped): `routers/quotation.ts:2655` (send) and `routers/thread.ts` (`thread.compose`). The contract and return shape are unchanged, so `thread.compose` needs no edit. `reply.test.ts` guards it.
- **`quotations.send` input gains required `sendKey`** — callers (grepped): only `send-quotation-dialog.tsx:169`. It is **required**, so an old web bundle calling a new server gets a 400. **Deployment coupling:** web and server deploy together. Build `apps/web` first (memory: alchemy-partial-deploy-splits-the-stage). Alternative is `optional()` with a server-minted key, which removes duplicate protection for old clients. Rejected, because one deploy covers both workers.
- **Return shape** — additive `resumed`. The dialog's `onSuccess` ignores the payload.
- **Architecture allow-list** — `quotationsRouter.send :: update(quotation)` stays, because the write stays in `send`. New writes to `quotation_send` are not governed (no branch/creator columns). If the scanner still classifies it as governed, add allow-list entries under "NO GOVERNED SHAPE" with a comment. `abandonSend` does not write `quotation`.
- **Existing tests** — `quotation.send-decide.test.ts`'s `sendInput` lacks `sendKey` and will fail zod until updated (Task 1.4). `pushTestSchema` reads `schema/index.ts`, so the export in Task 1.1 is required for PGlite.
- **Nullable fields relied on** — `quotation_send.provider_ref` is null while `pending`, and resume requires it non-null (the `dispatched` status implies it; assert in code). `attachment.stagedKey` is null without R2 (dev), so the message row gets `r2Key: null`, the same named gap as `reply.ts:154-160`.
- **Step 01 overlap** — step 01 edits `packages/db/src/schema/quotation.ts`, `packages/api/src/routers/quotation.ts` and adds `0066`. This plan avoids `schema/quotation.ts` but shares `routers/quotation.ts` (different procedures) and `_journal.json`. Merge serially; each migration commit carries its own journal entry.
- **Step 08 overlap** — Step 08 rewires the "Export quotation" gate. If it gates `exportSheet`/`renderQuotationDocument`, `send` inherits it through the shared render call **only if the gate sits inside the renderer**. Resume skips the render, so a gate added only at the render step would not re-check on resume (acceptable: the mail already left). See D7.
- **Step 10 overlap** — step 10 (customer answers → Decide) reads `sentAt` and `decide` (`quotation.ts:2865-2960`). This plan leaves `decide` untouched, and the concurrent-decide CASE still applies on resume.
- **Blocking prerequisites** — D1 (settled 2026-09-15: B). Journal contiguity for 0073 (Task 0.1). No unapplied migrations today (65/65).

## 8. Cross-Cutting Concerns

- **Errors** — three typed outcomes (`RECORD_FAILED_RESUMABLE`, `SEND_IN_FLIGHT`, `OPEN_INTENT`) carried in `ORPCError.data.reason`, each with operator copy that says whether the customer has the mail. Provider errors keep the existing `toReplyORPCError` mapping.
- **Testing** — router-boundary PGlite tests with a call-counting port (Task 1.4 is the proof of "no second email"). `reply.test.ts` guards `thread.compose`. The browser pass is in §10. Nothing can test a real Gmail/Outlook accept-then-crash, so the counting port is the substitute and must be stated as such in the PR.
- **Migration** — `0073` is additive (new type + table + two indexes). No backfill, and replayable on PGlite. Apply to the Neon dev branch `br-wandering-mud` before the browser pass, and confirm by querying `drizzle.__drizzle_migrations`, not by the command's exit code (memory: neon-default-branch-is-stale, readiness-signals-lie).
- **Rollback** — revert the code. The table can stay: it is unreferenced by other tables and harmless. A down-migration is not needed. Rows left `pending`/`dispatched` at revert time are only visible through SQL. List them first with `select … where status in ('pending','dispatched')`.

**Performance & Scalability**
1. **Pagination** — `openSends` is capped at 5 rows. No other list.
2. **SQL-side filtering** — every lookup filters in SQL (`org + send_key`, `org + quotation + status`).
3. **N+1** — none. Send does a fixed number of statements (+1 SELECT, +1 INSERT, +2 UPDATE over today).
4. **Index coverage** — `quotation_send_org_key_uq (organization_id, send_key)` serves the key lookup and the insert conflict. The partial `quotation_send_open_idx (organization_id, quotation_id) where status in (pending, dispatched)` serves the open-intent check and `openSends`, and stays tiny.
5. **Write atomicity** — intent insert: single statement. `dispatched` mark: a single statement, deliberately **not** joined to the record, so it commits even if recording fails. Record: `composeThread`'s transaction (unchanged) + stamp transaction (stamp + link + audit + intent `recorded`). They are two transactions, and resume makes that safe by replaying idempotently. `abandonSend`: update + audit in one tx.
6. **Row locking** — the `failed→pending`, `pending→dispatched`, `dispatched→recorded` and `→abandoned` transitions are all conditional UPDATEs on current status (compare-and-set), so no read-then-write race. The open-intent check (step 3) is check-then-insert across different keys; the race is accepted and documented in §4.
7. **Connection / resource limits** — no new pools. One extra R2 `put` moved **before** dispatch (it was after). Provider call count unchanged; resume makes zero provider calls.
8. **Tenant isolation** — every `quotation_send` read and write carries `organization_id = context.org.organizationId`. `send`/`openSends`/`abandonSend` first pass the quotation through `applyScope(…, "quotation", quotationScopeCols)`, so a row on an out-of-scope quotation is NOT_FOUND. The unique key is per org, so one tenant's key cannot collide with another's.
9. **Payload size** — `openSends` omits `body_html`/`body_text`. The table stores one rendered body per send (a few KB); the attachment bytes live in R2, not the row.
10. **Hot path** — `openSends` runs once per quotation record page load. Use the default `staleTime` and invalidate on send/abandon. Expected rate is one request per page view, operator-triggered.

## 9. Decision Register, Open Questions & Risks

### Settled 2026-09-15 — was blocking

**D1: Overturn the documented "send first, accept the duplicate" gap with an intent/outbox row?** · Status: **Settled — B chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Keep send-first; only change the error copy to "the email went out — do not press Send again" | No migration. The customer still gets a duplicate whenever an operator retries anyway, and the `composeThread`-tx failure stays silent. |
| **B** | Intent row before dispatch + idempotency key + resume on retry (this plan) | One table and migration. A retry never re-mails, the silent case becomes a visible `pending`/`dispatched` row, and the synchronous UX is kept. |
| **C** | Defer: leave step 09 as is and log the named gap in the SOP pitfalls only | Zero cost now. The defect stays open, and staff rely on reading a pitfall. |

- **Recommendation: B** — the router comment's premise that "the evidence survives" is false for a `composeThread` transaction failure (`reply.ts:535`). The `delivery_log` pipeline (`packages/email/src/send.ts:183-205`) already establishes intent-before-dispatch as house practice, and the existing dedup keys make resume cheap.
- **Chosen:** B (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** Yes, blocks Task 1.1 onward.
- **Where it lands:** all of §4, Phases 1–2.

### Settled 2026-09-15

**D2: Where does the send execute?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | In-request, synchronously, with the intent row (this plan) | Toast and badge reflect reality immediately. Works identically on `dev:local`. Resume is operator-driven. |
| **B** | Enqueue on a new Cloudflare Queue; the consumer sends and stamps | Automatic retries, but at-least-once delivery still duplicates on a consumer crash after accept. The UX becomes "queued", and `dev:local` has no queue emulation. |
| **C** | A Cloudflare Workflow with `send` and `record` steps | Durable step results, but the accept-then-crash window is unchanged, and it adds a second workflow class to the worker entrypoint. |

- **Recommendation: A** — neither B nor C removes the one window that matters (provider accepted, nothing persisted). Both give up the immediate feedback the dialog is built on (`send-quotation-dialog.tsx:168-194`).
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No; the plan is written for A.
- **Where it lands:** §4 handler order; Task 1.3.

**D4: Should anything finish `dispatched` intents without an operator?** · Status: **Settled — B chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Add a sweep to the `*/15` cron branch in `apps/server/src/index.ts` | Self-healing on prod. It never runs on demo or dev (crons are prod-only), and it must re-derive actor and scope with no request context. |
| **B** | Manual only: **Finish recording** in the dialog and on the quotation header (this plan) | Visible and simple. A quotation stays unstamped until someone opens it. |
| **C** | Resume inside `waitUntil` right after a failed record, then fall back to B | One automatic retry at almost no cost. It reuses a request pool that `index.ts:155-168` ends in `waitUntil`, so it needs its own pool. |

- **Recommendation: B** — the notice on the record page is where Sales already looks. A prod-only sweep would make demo behave differently from prod, which is the class of divergence memory already records as costly. Revisit if Journey 2 notices are seen more than rarely.
- **Chosen:** B (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No.
- **Where it lands:** Phase 2; no server/index.ts change.

**D6: Reconcile `pending` (unknown) sends against the provider?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Stamp `X-NCT-Send-Key` now; the operator resolves `pending` by checking Sent (this plan) | No port change. The header makes B possible later. |
| **B** | Add `findSentByHeader` to `MailboxConnectionPort` (Gmail search, Graph `$filter` on internetMessageHeaders) and auto-resolve `pending` | Removes the human check. Two adapter implementations plus a Graph filter that needs verifying against real tenants. |
| **C** | No header at all | Simplest, but closes the door on B. |

- **Recommendation: A** — both adapters already carry the header (`gmail.ts:470-473`, `outlook.ts:474-489`), so it costs one line. The `pending` state should be rare enough that a port extension is not yet justified.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No.
- **Where it lands:** §4 step 6.

**D7: How does this plan relate to Step 08's "Export quotation" gate rewiring?** · Status: **Settled — A chosen (Wilfred, 2026-09-15)**

| | Approach | Consequence |
|---|---|---|
| **A** | Leave send's gating alone (`QUOTATION.update` + scope). Step 08 decides whether `send` also asserts the export gate, and places it before the intent insert | No overlap in code. Step 08 must know `send` now has a resume branch that skips render. |
| **B** | This plan adds `assertGateCleared(…, "export")` to `send` | Duplicates Step 08's call site. The two plans would edit the same lines. |
| **C** | Put the gate inside `renderQuotationDocument` so export and send share it | One check, but resume skips render, and a gate cleared-then-revoked mid-resume would not re-check. |

- **Recommendation: A** — the brief assigns the permission change to Step 08. Today the gate sits on `retrieve` (`quotation.ts:2353-2361`), not on `send` or `exportSheet`, so a direct API call can mail a gated quotation. Step 08 should close that with the gate asserted in `send` **before step 2 (key lookup)**, so it applies to resume too.
- **Chosen:** A (the recommendation) — Wilfred, 2026-09-15
- **Blocking?** No for this plan; yes for whichever of the two merges second (rebase on `send`).
- **Where it lands:** §7 Step 08 overlap.

### Assumed

**D3: How is a resume triggered?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Call `send` again with the same `sendKey` (this plan) | The stamp write stays inside `quotationsRouter.send`, so the allow-list key at `architecture.test.ts:533` is untouched. One contract. |
| **B** | A separate `quotations.resumeSend({ sendId })` | Clearer name, but it adds a second writer of `quotation` and a new allow-list entry on a list that "only ever shrinks". |
| **C** | Move stamping into a shared helper both call | Renames the allow-list key, and the gate's comment asks for justification on every entry. |

- **Recommendation: A** — the governed-write gate is keyed by enclosing scope, and A keeps exactly one writer of `sent`, as the send docblock (`quotation.ts:2541-2546`) insists. (`thread.compose` is the other `composeThread` caller, `routers/thread.ts:811`.)
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4 steps 2 and 7; Tasks 1.3, 2.2.

**D5: Quotation-specific intent table or a generic mailbox outbox?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | `quotation_send`, FK to quotation (this plan) | Precise scope and FKs. The inbox composer gets no protection. |
| **B** | Generic `outbound_send` keyed by `(entity_type, entity_id)` | Reusable by `thread.compose`, but loses the FK, and the composer has no stamp to lose, so no current consumer. |
| **C** | Extend `delivery_log` | Wrong table: it is the transactional (system-sender) log with no org column (`schema/delivery-log.ts`). |

- **Recommendation: A** — only `quotations.send` has a post-send write whose loss invites a duplicate. `thread.compose` has none.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Task 1.1.

**D8: What is the idempotency key's lifetime?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | One UUID per dialog open, re-minted on re-seed (this plan) | Retry inside the dialog resumes, and a fresh dialog is a fresh send, guarded by the open-intent check. |
| **B** | Derived server-side from `(quotation, to, subject, format, language)` | No client change, but a legitimate identical resend a week later collides. |
| **C** | Per click | Defeats the purpose: a double-click becomes two keys. |

- **Recommendation: A** — it matches the dialog's existing re-seed boundary (`send-quotation-dialog.tsx:139-155`).
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** Task 1.5.

**D9: How is an uncoded provider error classified?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Leave the row `pending` (unknown); only coded refusals become `failed` (this plan) | Never re-mails on a timeout that actually delivered. The operator sometimes has to check Sent. |
| **B** | Mark every throw `failed` | Smoother retries, and re-introduces the duplicate on a timeout after accept. |
| **C** | Retry the provider once in-request before deciding | Doubles the duplicate risk on exactly the ambiguous case. |

- **Recommendation: A** — the defect is duplicates, and an extra manual check on a rare timeout is the cheaper failure.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4 step 6.

**D10: Where do the attachment bytes for a resumed record come from?** · Status: Assumed

| | Approach | Consequence |
|---|---|---|
| **A** | Stage in `EMAIL_ATTACHMENTS` before dispatch and point `r2Key` at the staged key (this plan) | Resume records the exact bytes sent, and the R2 put leaves the post-accept window. |
| **B** | Re-render on resume | An edit between send and resume records a different file than the customer holds, which is exactly what `reply.ts:124-133` says must not happen. |
| **C** | Record metadata only on resume (`r2Key: null`) | Honest but lossy: the sent file can never be downloaded. |

- **Recommendation: A** — the code's own rule is that the exact PDF must be producible six months later.
- **Chosen:** A (assumed by the plan)
- **Blocking?** No.
- **Where it lands:** §4 schema `attachment.stagedKey`, `recordComposedThread` option.

### JSON vs codebase conflicts (Phase 0 wins)

1. **JSON:** the defect is an accident ("There is no outbox"). **Code:** a deliberate, documented trade-off (`quotation.ts:2566-2596`). **Followed:** the codebase fact, and the reversal is raised as D1.
2. **JSON:** the failure is "the stamp fails after the mail is away". **Code:** there are two post-accept failure points. The second (`composeThread` tx, `reply.ts:535`) leaves no thread at all, contrary to the router comment at `:2578-2583`. **Followed:** the plan covers both.
3. **JSON fix `src`:** `quotation.ts:2633`. **Code:** that line is refusal 3's message. The ordering lives at `:2566-2596` and the stamp tx at `:2745-2824`. Cited at the corrected lines.
4. **JSON golden path:** Export at `$quotationId.tsx:1431`. **Code:** "Quotation sheet PDF (English)" is now `:1451`. Send at `:1372` still matches. The dialog's submit is the footer button bound to `sendMutation.isPending`, and its handler is `handleSubmit` (`send-quotation-dialog.tsx:221-243`).
5. **JSON field note:** "server refuses an empty subject or message". **Confirmed:** `z.string().trim().min(1)` on `subject`, `min(1)` on `html`/`text` (`quotation.ts:2605-2609`).

**Risks.**
- _0073 lands before a sibling's 0068–0072_ → medium likelihood, high impact (branch unpushable for every session) → **Task 0.1 gates the merge; renumber rather than leave a hole.**
- _Step 01 and this plan both edit `routers/quotation.ts` in the shared worktree_ → high likelihood, medium impact → **serial merges; `git diff HEAD -- packages/api/src/routers/quotation.ts` read hunk by hunk before commit (memory: shared-index-sweeps-uncommitted-hunks).**
- _The dev server serves old `packages/api` code during the browser pass_ → high likelihood, high impact on false greens → **restart `apps/server` after every `packages/**` edit (memory: bun-hot-ignores-workspace-deps), and probe with a request that must return the new `SEND_IN_FLIGHT` code.**
- _The scanner classifies `quotation_send` as governed_ → low likelihood, low impact → **run the api `architecture.test.ts` (not the web one) and add justified entries if it does.**

## 10. Verification & Proof

**App URL:** http://localhost:3101 (web) → server http://localhost:3000
**Preconditions:** a seed-parity owner org (`e2e/fixtures/seed-cli.ts seed-parity <runId>`); a draft quotation with a company and primary contact; an active mailbox connection driven by the dev mailbox fake (`apps/server/src/dev-mailbox-fake.ts`), so **no real customer mail is sent**; migration `0073` applied to the dev Neon branch and confirmed in the migrations table; `apps/server` restarted after the last `packages/**` edit. A one-shot failure switch for the stamp write is needed: use the Task 1.4 test hook exposed only under the dev fake (e.g. `POST /dev/mailbox-fake/fail-next-stamp`). If Agent A finds no dev-fake seam, the browser pass covers Journeys 2–3 and Journey 1 is proven by Task 1.4 alone. Say so in the PR.
**Migrations:** `0073_quotation_send_outbox`.

**Golden path — Journey 3 (no regression):**
1. Navigate to `/quotations`, open the draft → the header shows **Draft** and **Send**.
2. Press **Send** → the **Send quotation NCT-Q-…** dialog opens, with To prefilled.
3. Press **Send** → toast _Quotation NCT-Q-… sent_, the dialog closes, the badge reads **Sent**, the Threads card lists one thread, and no notice appears.

**Golden path — Journey 1:**
1. Arm the fail-next-stamp switch. Open a second draft and press **Send** → **Send** in the dialog.
2. Expect: the dialog stays open, the amber notice reads _"The email to … went out, but saving the record failed"_, and the button reads **Finish recording**.
3. The dev mailbox fake's sent list shows **1** message.
4. Press **Finish recording** → toast _… sent_, badge **Sent**, one thread in the Threads card.
5. The dev fake's sent list still shows **1** message.

**Golden path — Journey 2:**
1. Arm the switch again on a third draft, press Send, see the amber notice, and **close** the dialog.
2. Reload the quotation page (new tab, memory: browser-console-buffer-survives-reload) → the header notice reads _"A send to … went out but was not recorded"_ with **Finish recording**, and **Send** is disabled.
3. Press **Finish recording** → the notice disappears and the badge reads **Sent**. The fake's sent list for this quotation shows **1**.

**Edge case:** double-click **Send** rapidly on a fresh draft → exactly one toast of success, the fake's sent list grows by **1**, and no error toast is shown (the second request's `SEND_IN_FLIGHT` is swallowed while `isPending`).
**Regression check:** `thread.compose` from the Inbox composer sends and appears in its thread (compose split, §7). Decide on a sent quotation still records Won (`decide` untouched). The api `architecture.test.ts` and `migrations.test.ts` outputs show no failures.
**Mobile:** at 400px the header notice wraps under the badge without horizontal overflow, and the dialog notice sits above the footer buttons.

_2026-09-15: Wilfred chose the recommendation for every open decision in §9. The readiness points held back for pending decisions no longer apply._

**Readiness: 7/10** — the design is grounded in existing dedup keys and the `delivery_log` precedent. Three things hold back the rest: D1 overturns a documented decision and needs Wilfred's call; 0073 depends on five sibling migrations landing first; and no dev-fake seam for a one-shot stamp failure exists yet, so Journey 1's browser proof may fall back to the router test.
