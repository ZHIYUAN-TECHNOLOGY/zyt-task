# ZYT Delivery v0 — the delivery board as a real app (NCT as the first client)

**Session:** `_plan/09-14_21-11_zyt-delivery-v0/` · **Tier:** Standard · **Phases:** 5
**Code lives in:** `C:/Project/ZYT-Task/app/` (D2) · **Revised:** 2026-09-15 (D5–D13 settled; staff review applied — see `review.md`)

---

## Phase 0 findings

**Greenfield, and ZYT's own.** `C:/Project/ZYT-Task` is ZYT's workspace, not part of any client repo. NCT is the **first sample client**: its operations were extracted to design the tracker, and its data seeds v0. The app is agency-wide from the first line — nothing may be hard-coded to NCT except the sample bundle. No `package.json` or app folder exists; every code path below is `[NEW]`.

**Context files read in full:** `tracker/SCHEMA.md` (model and visibility rules), `tracker/STACK.md` (stack and non-negotiables), `tracker/seed/flow-nct.json` (5 phases, 27 steps), `tracker/seed/tasks-nct.json` (48 findings), `tracker/seed/client-tasks-nct.json` (10 workstreams), `mocks/board.html` (the unified board with the Team/Client toggle — the UI reference).

**Stack (decided 2026-09-14, `STACK.md`):** TanStack Start on Cloudflare Workers, Convex, Better Auth through Convex, Cloudflare R2. Verified against live docs:

| Claim | What the docs say | Consequence |
|---|---|---|
| Better Auth runs inside Convex for TanStack Start | Confirmed — a listed framework guide (the guide walks email + password only; it sets `SITE_URL` and `VITE_CONVEX_SITE_URL`) | Proceed |
| Social sign-in (Google, Microsoft) | Social providers are **core Better Auth config, not plugins**. The Convex guide does not show them; the supported list includes Generic OAuth and One Tap, so OAuth flows run | **Prove Google sign-in in the Phase 1 spike** (D5) |
| Organization and API key plugins | Not in the supported list (Anonymous, Email OTP, Generic OAuth, JWT, Magic Link, One Tap, Phone Number, Two Factor, Username). Plugins that change the auth schema need a **Local Install** of the component; SSO is incompatible | **Conflict with `STACK.md`** → D1: own tables |
| Account linking | Better Auth links a social sign-in to an existing user only when the provider says the email is verified, or the provider is in `trustedProviders` | Keep the default; never add `trustedProviders` (D5) |
| R2 via `@convex-dev/r2` | `generateUploadUrl` → browser PUT → `syncMetadata`; `checkUpload`/`onUpload` callbacks; `r2.getUrl()` signs reads (default 15 min); env `R2_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`; bucket needs a CORS policy (GET, PUT); **no read-authorization callback** | Reads go through our own role check (D9) |
| TanStack Start deploys to Workers | Official guide uses `@cloudflare/vite-plugin` | Proceed |

**Patterns learned from NCT (not dependencies — nothing here imports or calls NCT):**
- NCT uses Better Auth's `organization` plugin with an active organization on the session; switching org in one tab silently switched every tab → this app keeps the project in the URL (D6).
- NCT's email service is a Cloudflare Worker binding, unreachable from Convex → D4 does not consider it.

**Migration state:** N/A — Convex has no migration journal; schema deploys with `convex/schema.ts`.

---

## 1. Overview

**Problem.** ZYT's client delivery lives in chat, spreadsheets and one-off pages. Clients have no login of their own to see how their project moves. The first client, NCT, has a static mock of the board and nothing behind it.

**Goal.** An agency-wide app where the ZYT team runs each client's delivery on one live board, and the client's own users sign in to read the same board with team-only fields removed on the server. v0 ships with one client loaded: NCT.

**Success criteria.**
- A team member signs in with Google, sees NCT's 27-step flow, 10 workstreams and 48 findings, changes a state with a note, and publishes a report built from current statuses.
- An NCT user signs in (Google or Microsoft) and sees the same board **without** repairs, code locations, owners, internal notes, prompts or internal attachments — verified in the **network response**.
- A Claude session with a project API key can list, claim and update findings, and is refused when it tries to publish or set Won't fix.
- A second client can be loaded with the same importer and a new bundle folder, with no code change.

**In scope.** Sign-in, orgs/memberships/roles, the board, state changes and notes, workstreams, reports (draft on demand, publish, correction), client invites, R2 attachments, project API keys and the Claude HTTP API, a general client importer, moving NCT's SOP material into `samples/nct/`.

**Out of scope.** Magic-link sign-in and all email (invite and publish notices) until D4 is decided, a flow editor, a report reminder, search, Plane/Linear sync, the MCP server itself (the HTTP API it will wrap *is* in scope), billing, SSO.

**Assumptions** — none left. Every judgment call is settled in §9; one decision (D4, email provider) is open and blocks nothing in v0.

---

## 2. User Journeys

**Journey 1 — A team member opens a client's board**
Trigger: visits the app.
1. Sees the sign-in page → **Continue with Google**.
2. Signs in → lands on `/`, a list of projects they are a member of → presses **NCT**.
3. Lands on `/p/nct`: the report card, the 27-step flow rail with open findings per step, and 10 workstreams with state chips — the team view of `mocks/board.html`.
4. Opens a workstream → inline, it expands to its findings (category, title, step, **repair**, **code location**), its status history (internal notes shaded), and the handover prompt.
5. Flow ends: everything is visible and updates live when another session changes it.
Where it lives: `/` (project list) and `/p/$projectKey` (board).

**Journey 2 — A team member moves a finding and writes the note**
Trigger: on the board, a finding row.
1. Presses the finding's state chip → inline menu: Open · In progress · Blocked · Fixed · Won't fix.
2. Picks **Blocked** → an inline note box appears, required, with an **Internal** toggle (off by default).
3. Types "Need NCT to confirm who may approve their own work", leaves Internal off, presses **Save** → the chip turns Blocked; the note tops the history for everyone watching.
4. Sets the workstream to **Blocked** with its own note.
5. Flow ends: each change is an `event` row with author and time; nothing was overwritten.
Where it lives: inline on the board.

**Journey 3 — A team member publishes a report**
Trigger: the report card → **New report**.
1. Presses **New report** → a drawer opens with a draft built at that moment: each workstream with its **current** state, and every **shared** note written since the last published report as bullet facts. Internal notes from the same period sit beside it, marked team-only, and are never inserted into the draft.
2. Rewrites the summary in client language, fills **Next week**, presses **Publish** → confirm dialog: "NCT users will see this report on their board."
3. System saves each workstream's state as it is at that moment into `reportItems` and stamps `publishedAt` → toast *Report published*. (No email until D4.)
4. Later, a workstream moves → its card shows *Reported on 14 Sep as In progress · now Blocked*.
5. A mistake? **Publish correction** creates a new report linked to the old one; the old one is never edited.
6. Closing the drawer without publishing keeps the draft; pressing **New report** again reopens it with states refreshed.
Where it lives: drawer from the report card.

**Journey 4 — A team member invites a client user**
Trigger: `/p/nct/members`.
1. Sees team and client members listed with roles and status.
2. Presses **Invite client user**, types `ops@nct.my` → **Send invite**.
3. System records an `invited` membership for that email in NCT's client org → a dialog shows a ready-to-send message: the app link and "Sign in with Google or Microsoft using ops@nct.my" → **Copy** → toast *Invite copied*. The team member sends it through their own email or chat.
4. Flow ends: the member shows as *Invited* until they first sign in.
Where it lives: `/p/$projectKey/members`.

**Journey 5 — A client user reads their project**
Trigger: receives the invite message from ZYT.
1. Opens the app link → presses **Continue with Google** or **Continue with Microsoft** with the invited address.
2. **Google:** the membership activates only if the signed-in email **exactly matches** the invite and Google marks it verified → lands directly on `/p/nct` (their only project). **Microsoft:** the claim is filed as *pending* — "Waiting for ZYT to confirm your access" — and a team member approves it on the members page, because Entra e-mail claims are not verified (D15).
3. Sees the report card, flow rail (no counts), workstreams and every finding's title, category and step — **no repair, code location, owner, prompt, internal note or internal attachment.**
4. Opens a workstream → shared notes only, and the *Reported as … · now …* line where live has moved.
5. Signs in with a Google account whose email differs from the invite → "This account isn't invited to any project. Sign in with the address you were invited with."
6. Opens `/p/nct/members` → "You don't have access to this page".
Where it lives: sign-in page, then `/p/$projectKey` in client projection.

**Journey 6 — A team member attaches evidence**
Trigger: a finding row → **Attach**.
1. Picks a screenshot → uploads directly to R2 with a progress bar; leaves **Internal** on.
2. The thumbnail appears on the finding for the team.
3. An NCT user viewing the board sees nothing for that finding. A second, shared screenshot shows for both.
4. Thumbnails ask for a signed link as they scroll into view; a link left open past 15 minutes is re-requested when the image fails. A client asking for the internal file gets no link.
Where it lives: inline on the finding.

**Journey 7 — A Claude session works a finding**
Trigger: a developer's Claude session with `ZYT_API_KEY` for project NCT.
1. `GET /api/v1/findings?mine=1` → JSON list of findings owned by the key's owner.
2. `POST /api/v1/findings/<key>/claim`, then `…/state` with `{ to: "in_progress", note: "Adding assertNotUnderReview" }` → the board shows the change live, the note internal.
3. `…/attachments` with `{ kind: "pr", url: "https://github.com/…/pull/123" }` → the PR link appears on the finding for the team only.
4. `…/state` with `{ to: "wont_fix" }` → **403** *API keys cannot set Won't fix.*
5. `POST /api/v1/reports/publish` → **403** *API keys cannot publish reports.*
6. Flow ends: work moved and evidence recorded; nothing reached the client, and no promise was dropped, without a person.
Where it lives: the HTTP API.

---

## 3. Result

**Team — before:** status lives in chat and a static mock. **After:** one live board per client where every change is a dated note, and a report is one button away from current statuses.
**Clients — before:** see only what ZYT sends. **After:** sign in with the account they already have and read the same board, internals removed.
**Claude sessions — before:** a human relays every status change. **After:** a project key lets a session claim work, update it and attach a PR.

**Key differences:**
- Team and client share one board; hidden fields never leave the server for a client, and new fields are hidden until approved.
- Every state change carries a note, with an internal toggle.
- Reports are drafted on demand from live status and frozen when published.
- Evidence sits in a private R2 bucket, reached only through short-lived signed links.
- Adding a client is a data bundle, not code.

---

## 4. Technical Architecture

### System

```
Browser ──TanStack Start (Cloudflare Worker)──▶ Convex React client (live queries)
                                                   │
                                   Convex: schema · queries · mutations · actions
                                   ├─ Better Auth component: Google, Microsoft              ← J1, J5
                                   ├─ access.ts: viewer() + client allowlists               ← every read
                                   ├─ reports.ts: draft on demand, freeze on publish        ← J3
                                   ├─ http.ts: /api/v1/* (API keys)                         ← J7
                                   └─ @convex-dev/r2 ──signed PUT/GET──▶ R2 (private)       ← J6
Email: none in v0 (D4 open; invites are copied by the team)
```

### Routes — `app/src/routes/` [NEW]

| URL | File | Journey |
|---|---|---|
| `/sign-in` | `sign-in.tsx` | J1 s1, J5 s1 |
| `/` | `index.tsx` — project list; a user with exactly one project is redirected to it | J1 s2, J5 s2 |
| `/p/$projectKey` | `p.$projectKey.index.tsx` | J1, J2, J3, J5, J6 |
| `/p/$projectKey/members` | `p.$projectKey.members.tsx` | J4 |
| `/p/$projectKey/keys` | `p.$projectKey.keys.tsx` | J7 setup |

There is no `p.$projectKey.tsx` layout file, so the three `p.$projectKey.*` routes are siblings; if a layout is added later, it must render an `<Outlet />` or the child pages render the board instead (TanStack flat-route nesting).

### Data model — `app/convex/schema.ts` [NEW]

```ts
organizations: defineTable({ name: v.string(), slug: v.string(), kind: v.union(v.literal("agency"), v.literal("client")) })
  .index("by_slug", ["slug"])

memberships: defineTable({
  orgId: v.id("organizations"), userId: v.optional(v.string()), email: v.string(),   // email stored lower-cased
  role: v.union(v.literal("team"), v.literal("client")),
  status: v.union(v.literal("invited"), v.literal("pending"), v.literal("active")),   // pending = claimed via Microsoft, awaiting team approval (D15)
  claimedUserId: v.optional(v.string()), claimedProvider: v.optional(v.string()),     // set on a pending claim
  providerAccountId: v.optional(v.string()),                                          // Microsoft `oid` — matched on later sign-ins instead of email
  invitedAt: v.number(), acceptedAt: v.optional(v.number()),
}).index("by_org", ["orgId"]).index("by_user", ["userId"]).index("by_email", ["email"])
  .index("by_provider_account", ["providerAccountId"])                                 // J4, J5

projects: defineTable({
  key: v.string(), name: v.string(), agencyOrgId: v.id("organizations"), clientOrgId: v.id("organizations"),
  flowId: v.id("flows"),
}).index("by_key", ["key"]).index("by_agency", ["agencyOrgId"]).index("by_client", ["clientOrgId"])  // J1 s2

flows: defineTable({ name: v.string(), phases: v.array(phase), steps: v.array(step) })            // J1 s3

findings: defineTable({
  projectId: v.id("projects"), key: v.string(), kind: v.union(v.literal("chain"), v.literal("step")),
  title: v.string(), detail: v.string(), rank: v.optional(v.number()),
  category: v.optional(v.union(v.literal("data"), v.literal("money"), v.literal("friction"), v.literal("blocked"))),  // seed's "severity" — a category, null on chain findings
  steps: v.array(v.object({ kind: v.union(v.literal("step"), v.literal("break-after")), n: v.number() })),
  repair: v.optional(v.string()), src: v.array(v.string()), ownerId: v.optional(v.id("memberships")),  // team-only
  state: findingState, openedAt: v.number(), closedAt: v.optional(v.number()),
  reopenedFrom: v.optional(v.id("findings")),
}).index("by_project", ["projectId"]).index("by_project_key", ["projectId", "key"])
  .index("by_project_owner", ["projectId", "ownerId"])                                  // J1, J2, J7

workstreams: defineTable({
  projectId: v.id("projects"), key: v.string(), title: v.string(), blurb: v.string(),
  covers: v.array(v.id("findings")), state: workstreamState,
  ownerId: v.optional(v.id("memberships")), prompt: v.optional(v.string()),         // team-only
  openedAt: v.number(), closedAt: v.optional(v.number()), supersedes: v.optional(v.id("workstreams")),
}).index("by_project", ["projectId"])                                                   // J1 s3, J2 s4

events: defineTable({
  projectId: v.id("projects"), subject: v.union(v.literal("finding"), v.literal("workstream")),
  subjectId: v.string(), to: v.string(), note: v.string(), internal: v.boolean(),
  authorId: v.optional(v.id("memberships")), apiKeyId: v.optional(v.id("apiKeys")), at: v.number(),
}).index("by_subject", ["subject", "subjectId", "at"]).index("by_project_at", ["projectId", "at"])  // J2, J3 s1

reports: defineTable({
  projectId: v.id("projects"), summary: v.string(), nextLine: v.string(),
  createdAt: v.number(), createdBy: v.id("memberships"),
  publishedAt: v.optional(v.number()), publishedBy: v.optional(v.id("memberships")),
  correctionOf: v.optional(v.id("reports")),
}).index("by_project_published", ["projectId", "publishedAt"])                          // J3

reportItems: defineTable({ reportId: v.id("reports"), workstreamId: v.id("workstreams"), stateAtPublish: workstreamState })
  .index("by_report", ["reportId"]).index("by_workstream", ["workstreamId"])            // J3 s3, J5 s4

attachments: defineTable({
  projectId: v.id("projects"), subject: v.union(v.literal("finding"), v.literal("workstream")), subjectId: v.string(),
  kind: v.union(v.literal("screenshot"), v.literal("pr"), v.literal("qa_run"), v.literal("link")),
  r2Key: v.optional(v.string()), url: v.optional(v.string()), label: v.string(), internal: v.boolean(),
  createdBy: v.optional(v.id("memberships")), apiKeyId: v.optional(v.id("apiKeys")), at: v.number(),
}).index("by_subject", ["subject", "subjectId"])                                        // J6, J7 s3

apiKeys: defineTable({
  projectId: v.id("projects"), name: v.string(), prefix: v.string(), hash: v.string(),
  ownerId: v.id("memberships"), createdAt: v.number(), expiresAt: v.optional(v.number()),
  lastUsedAt: v.optional(v.number()), revokedAt: v.optional(v.number()),
}).index("by_prefix", ["prefix"]).index("by_project", ["projectId"])                   // J7
```

A report has no stored "week"; a draft is any report with no `publishedAt`, and at most one draft exists per project. Better Auth's user, account and session tables live inside its Convex component; `memberships.userId` holds the Better Auth user id.

### Access — `app/convex/access.ts` [NEW] (every read and write goes through it)

```ts
type Viewer = { role: "team" | "client"; membershipId: Id<"memberships">; project: Doc<"projects"> };

// J1, J5 — resolves the signed-in user to an ACTIVE membership in the project's agency org (team)
// or client org (client); throws "no_access" otherwise. The URL names only the project, so it can never widen access (D6).
export async function viewer(ctx: QueryCtx | MutationCtx, projectKey: string): Promise<Viewer>
export async function requireTeam(ctx: MutationCtx, projectKey: string): Promise<Viewer>

// D7 — clients receive ONLY these fields. A field not listed is hidden from clients.
export const CLIENT_FIELDS = {
  findings:    ["_id", "key", "kind", "title", "detail", "category", "rank", "steps", "state", "openedAt", "closedAt", "reopenedFrom"],
  workstreams: ["_id", "key", "title", "blurb", "covers", "state", "openedAt", "closedAt", "supersedes"],
  events:      ["_id", "subject", "subjectId", "to", "note", "at"],          // and only rows with internal === false
  attachments: ["_id", "subject", "subjectId", "kind", "label", "at"],       // and only rows with internal === false; never r2Key or url
} as const;
// Fields deliberately withheld from clients — listed so the classification test can tell "withheld" from "forgotten".
export const TEAM_ONLY_FIELDS = {
  findings: ["repair", "src", "ownerId", "projectId", "_creationTime"],
  workstreams: ["ownerId", "prompt", "projectId", "_creationTime"],
  events: ["internal", "authorId", "apiKeyId", "projectId", "_creationTime"],
  attachments: ["internal", "r2Key", "url", "createdBy", "apiKeyId", "projectId", "_creationTime"],
} as const;

export function forRole<T extends keyof typeof CLIENT_FIELDS>(table: T, row: Doc<T>, role: Viewer["role"])
  // team → row unchanged; client → pick(row, CLIENT_FIELDS[table])
```

### API contracts

**Convex functions (web client):**

| Function | Args | Returns | Journey |
|---|---|---|---|
| `projects.listMine` (query) | — | `[{ key, name, role }]` | J1 s2, J5 s2 |
| `board.get` (query) | `{ projectKey }` | `{ viewer: { role }, flow, workstreams, findings, latestReport, openDraftId? (team) }` — every row through `forRole` | J1, J5 |
| `events.list` (query) | `{ projectKey, subject, subjectId, paginationOpts }` | paginated, client sees `internal === false` only | J1 s4, J5 s4 |
| `findings.setState` / `workstreams.setState` (mutation) | `{ projectKey, key, to, note, internal }` | `void` — rejects empty note | J2 |
| `reports.openDraft` (mutation) | `{ projectKey }` | `reportId` — returns the existing draft or creates one | J3 s1, s6 |
| `reports.getDraft` (query) | `{ projectKey, reportId }` | `{ summary, nextLine, workstreams: [{ key, title, liveState }], sharedNotesSinceLast: Event[], internalNotesSinceLast: Event[] }` | J3 s1 |
| `reports.updateDraft` / `reports.publish` / `reports.publishCorrection` (mutation) | — | `publish` freezes `reportItems` from live states in the same mutation | J3 |
| `members.list` / `members.inviteClient` | `{ projectKey, email }` | `inviteClient` returns `{ inviteText }` — app URL + which address to sign in with | J4 |
| `attachments.generateUploadUrl` / `attachments.record` (mutation) | — | team only | J6 |
| `attachments.requestSignedUrl` (**mutation**) | `{ projectKey, attachmentId }` | `string \| null` — `viewer()` + the client rule, then `r2.getUrl(key)` (component default 900 s) | J6 s4 |
| `memberships.claim` (mutation) | — | called once after sign-in: activates an `invited` row on a verified Google email, or files a pending claim for Microsoft (D15) | J5 s2 |
| `apiKeys.create` / `apiKeys.revoke` / `apiKeys.list` | `{ projectKey, name, expiresAt? }` | `create` returns the full token once | J7 setup |

`r2.getUrl` is callable from a query or a mutation, not an action (get-convex/r2 README). It is a **mutation** here so Convex never serves a cached, expired link from a live query (D9).

**HTTP API (`app/convex/http.ts`) — header `Authorization: Bearer zyt_<prefix>_<secret>`:**

| Method & path | Body | Response | Journey |
|---|---|---|---|
| `GET /api/v1/findings?mine=1&state=` | — | `{ findings: [{ key, title, category, state, steps, repair, src }] }` | J7 s1 |
| `POST /api/v1/findings/:key/claim` | — | `{ ok: true, ownerId }` | J7 s2 |
| `POST /api/v1/findings/:key/state` | `{ to, note }` | `{ ok: true }` — event written `internal: true`; `to: "wont_fix"` → 403 | J7 s2, s4 |
| `POST /api/v1/findings/:key/attachments` | `{ kind: "pr" \| "link" \| "qa_run", url, label? }` | `{ ok: true }` — `internal: true` | J7 s3 |
| `POST /api/v1/findings` | `{ title, detail, category, steps, reopenedFrom? }` | `{ key }` | J7 (regression) |
| `POST /api/v1/reports/*` | any | **403** `{ error: "API keys cannot publish reports" }` | J7 s5 |

Errors: `401` unknown, revoked or expired key · `403` action forbidden to keys · `404` finding not in the key's project · `422` missing note.

### Client importer — `app/convex/seed.ts` [NEW] (D11)

```ts
// bunx convex run seed:importClient '{"bundle":"nct"}'
export const importClient = internalMutation({ args: { bundle: v.string() }, handler })
// bundles registered in app/convex/seed-data/index.ts: { nct: { client, flow, findings, workstreams, members } }
```
Each bundle folder holds `client.json` (org name/slug, project key/name), `flow.json`, `findings.json`, `workstreams.json`, `members.json` (team and client emails with roles). The importer is idempotent by `project.key` + `finding.key` / `workstream.key`: re-running updates text fields and never touches state, events or reports.

### Design tokens — `app/src/styles/tokens.css` [NEW]

Source: ZYT's own site, https://www.zhiyuantech.ai/ (you, 2026-09-15; revised 2026-09-15 to match `hosting/hub/brand/BRAND.md`). Values read from its production stylesheet, not eyeballed — specifically the **homepage palette** (`.home-v2_page` and its `[data-theme=dark]` block), which is what visitors see. The site's older base tokens (`:root` / `.dark`: `#fafaf8` ground, `#2b66fb` blue) are still in its CSS but not rendered by the homepage, so the board does not use them. Light is the default; dark follows the viewer's system setting. **Dark is the homepage's dark block taken darker** (you, 2026-09-15 — same navy hue, ground and surfaces pushed toward black; text, accents and chips unchanged), matching the live dashboard at admin.zhiyuantech.ai, which uses exactly these values in both themes.

| Token | Light | Dark | Site variable | Used for |
|---|---|---|---|---|
| `--bg` | `linear-gradient(180deg, #fbfcff, #f1f4fb)` (solid `#fbfcff`) | `linear-gradient(180deg, #04061a, #060920)` with faint radial glows `rgba(139,154,232,.05)` / `.04` (solid `#04061a`) — site: `#0a1130 → #0d1638` | `--bg` | Page ground |
| `--surface` | `#ffffff` | `#080c24` — site: `#131c48` | `--surface` | Workstream cards, drawer, report card, side columns |
| `--surface-raised` | `#f1f4fb` | `#0d1333` | — | Inputs, segmented controls, code, chips' ground |
| `--heading` | `#101A4F` | `#ffffff` | `--heading` | Board title, workstream and report headings, brand navy |
| `--text` | `#1c2547` | `#cdd6f5` — site: `#ffffff` | `--ink` (dark: `--marquee-ink`) | Body |
| `--text-muted` | `#6b7280` | `#a7b0d1` | `--mutedC` | Step labels, timestamps, blurbs |
| `--text-faint` | `#94a3b8` | `#6b779e` | `--faint` | Placeholders, disabled |
| `--border` | `#e2e8f5` | `rgba(139,154,232,.13)` — site: `.18` | `--line` | Row dividers, inputs |
| `--accent` | `#4159C9` | `#8B9AE8` | `--kicker` | Links, eyebrows, focus ring, **In progress** |
| `--primary` | `#101A4F` | `#4159C9` | `--cta-bg` | Primary buttons (white text) |
| `--danger` | `#ef4444` | `#ef4444` | `--destructive` (base layer; the homepage has no red) | **Blocked**, destructive confirms |
| `--shadow-card` | `0 25px 60px rgba(30,60,120,.12)` | `0 25px 60px rgba(0,0,0,.6)` | `--shadow-card` | Drawer, raised cards |
| `--shadow-tile` | `0 18px 45px rgba(16,26,79,.10)` | `0 18px 45px rgba(0,0,0,.5)` | `--shadow-tile` | Report card, hover lift |

**Logo and icons:** the site's lockup (ZYT + ZHIYUAN TECHNOLOGY + 致源科技) — `logo-light.png` (navy) on light, `logo-dark.png` (white) on dark, shown 36 px tall in the header as on the site; favicons and app icons are the site's own. All in `hosting/hub/brand/`; copy them into `app/public/brand/` and don't redraw them.

**State colours the site doesn't have** (added for the board, kept muted beside the navy and indigo): `--ok` `#1f9d62` (dark `#3ccf8e`) for **Fixed / Done**, `--warn` `#c9820a` for the *money* category and `--text-muted` for *data*, *friction* and *blocked*; **Open / Planned** and **Won't fix** use `--text-muted`. Every state chip also carries its label, so colour is never the only signal.

**Type** (all on Google Fonts, each with a fallback stack):
- **Space Grotesk** — board title, workstream titles, report headline (the site's `--grotesk`), fallback `"Segoe UI", system-ui, sans-serif`.
- **Geist** — body and controls (the site's `--font-sans`), fallback `system-ui, sans-serif`.
- **JetBrains Mono** — finding keys, step numbers, code locations, dates in history (the site's `--monoV2`), fallback `Consolas, monospace`; `font-variant-numeric: tabular-nums` on counts.

**Shape and motion:** the site's radius is `18px` (tiles `16px`, small controls 10–12 px); the board uses `18px` for the drawer, `16px` for cards and `10px` for inputs and buttons so dense rows stay compact; chips are pills. Easing `cubic-bezier(.16,1,.3,1)` (the site's `--ease`), disabled under `prefers-reduced-motion`.

### Key technical decisions
Own org/membership/API-key tables → **D1** · code in `ZYT-Task/app` → **D2** · team and client users in v0 → **D3** · email provider → **D4 (open, not blocking)** · Google/Microsoft, magic link deferred → **D5** · `/p/$projectKey` → **D6** · client field allowlist → **D7** · report drafted on demand → **D8** · signed links via action, 15 min → **D9** · repo root with `samples/nct/` → **D10** · general client importer → **D11** · project-scoped hashed keys with expiry → **D12** · key writes internal, no Won't fix, no publish → **D13** · stack → **D14**

---

## 5. Phased Implementation

### Phase 1 — Spike and skeleton: a team member signs in with Google and sees NCT's board
**Delivers:** Journey 1. Proves `STACK.md` spike checks 3 (projection in the network response) and 6 (deploy), plus Google sign-in through Convex.
**Dependencies:** Convex account and project; Cloudflare account; a Google OAuth client with redirect URI `<SITE_URL>/api/auth/callback/google` for local and deployed origins (confirm the exact path in the spike).

- **1.1 Repo and scaffold.** `git init` at `ZYT-Task/` (D10). Move NCT's SOP material into `samples/nct/`: `customer-intake-sop.html`, `customer-intake-sop/`, `steps-1-3-runbook.html`, `steps-1-3-rollout.md`, `plans/`; update relative paths in `tracker/build-seed.mjs` (reads `../customer-intake-sop.html`) and in `README.md`. Then scaffold TanStack Start with Bun, `@cloudflare/vite-plugin`, Convex client, Tailwind; `.gitignore` excludes `.env*`, `.wrangler/`, `node_modules/`.
  Files: `.gitignore` [NEW], `README.md`, `tracker/build-seed.mjs`, `samples/nct/*` [MOVED], `app/package.json` [NEW], `app/vite.config.ts` [NEW], `app/wrangler.jsonc` [NEW], `app/tsconfig.json` [NEW], `app/src/router.tsx` [NEW], `app/src/routes/__root.tsx` [NEW] · **Agent A (backend)**
- **1.2 Schema + access.** Every table in §4 and `access.ts` with `viewer`, `requireTeam`, `CLIENT_FIELDS`, `TEAM_ONLY_FIELDS`, `forRole`.
  Files: `app/convex/schema.ts` [NEW], `app/convex/access.ts` [NEW] · **Agent A (backend)**
- **1.3 Better Auth with Google.** Convex Better Auth component, Google social provider, no `trustedProviders`, no email+password. After sign-in the app calls `memberships.claim`, which reads the user with `authComponent.getAuthUser(ctx)` and activates an `invited` row whose lower-cased email equals the verified account email; a user with no membership sees the "isn't invited" message. No dependency on an undocumented user-creation hook.
  Files (adds): `app/convex/memberships.ts` [NEW]
  Files: `app/convex/convex.config.ts` [NEW], `app/convex/auth.ts` [NEW], `app/convex/http.ts` [NEW], `app/src/lib/auth-client.ts` [NEW], `app/src/routes/sign-in.tsx` [NEW] · **Agent A (backend)**
- **1.4 Client importer + NCT bundle.** `seed:importClient` per §4; `seed-data/nct/` built from `tracker/seed/*.json` plus `client.json` and `members.json` (agency org `zyt`, client org `nct`, project `nct`, team members as `invited`). Mapping the seed needs: `id` → `key` on findings and workstreams; the seed's `severity` → `category` (`data` | `money` | `friction` | `blocked`, null on chain findings); `covers` ids resolved to finding ids; the workstreams' `visible: false` flag ignored (it predates "clients see everything").
  Files: `app/convex/seed.ts` [NEW], `app/convex/seed-data/index.ts` [NEW], `app/convex/seed-data/nct/*.json` [NEW] · **Agent A (backend)**
- **1.5 Queries.** `projects.listMine`, `board.get` through `forRole`.
  Files: `app/convex/projects.ts` [NEW], `app/convex/board.ts` [NEW] · **Agent A (backend)**
- **1.6 Project list and board page.** `/` lists projects (redirects when there is one); `/p/$projectKey` renders the report card, flow rail, workstreams and findings, ported from `mocks/board.html`'s layout, with colours, type and radius from §4 *Design tokens* (zhiyuantech.ai) — not the mock's palette. Team-only fields render only when present in the data — no CSS hiding.
  Files: `app/src/routes/index.tsx` [NEW], `app/src/routes/p.$projectKey.index.tsx` [NEW], `app/src/components/board/FlowRail.tsx` [NEW], `app/src/components/board/WorkstreamCard.tsx` [NEW], `app/src/components/board/FindingRow.tsx` [NEW], `app/src/components/board/ReportCard.tsx` [NEW], `app/src/components/NoAccess.tsx` [NEW], `app/src/styles/tokens.css` [NEW] · **Agent B (frontend)**
- **1.7 Classification test.** For each table in `CLIENT_FIELDS`, every schema field must appear in exactly one of `CLIENT_FIELDS` or `TEAM_ONLY_FIELDS`. Read the field names from `schema.tables.<t>.validator` if that is reachable; if it is not public API, keep an explicit `ALL_FIELDS` list per table and assert it matches a seeded document's keys. `board.get` as a client returns no key outside `CLIENT_FIELDS`.
  Files: `app/convex/access.test.ts` [NEW] · **Agent C (test)**
- **1.8 Deploy.** Convex prod deployment, Worker deploy; document env (`SITE_URL`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`).
  Files: `app/README.md` [NEW] · **Agent A (backend)**

**Acceptance.** A team member signs in with Google at the deployed URL and sees 27 steps, 10 workstreams and 48 findings with repairs. The classification test passes, and fails when a field is added to `findings` without classifying it.

### Phase 2 — Working the board: state changes, notes, reports
**Delivers:** Journeys 2 and 3.
**Dependencies:** Phase 1.

- **2.1** `findings.setState`, `workstreams.setState` — `requireTeam`, non-empty note, entity update + `events` row in one mutation. `events.list` paginated.
  Files: `app/convex/findings.ts` [NEW], `app/convex/workstreams.ts` [NEW], `app/convex/events.ts` [NEW] · **Agent A (backend)**
- **2.2** Reports: `openDraft` (one draft per project), `getDraft` (live workstream states; shared and internal notes since the last `publishedAt`, via `events.by_project_at`), `updateDraft`, `publish` (inserts `reportItems` from live states and stamps `publishedAt` in one mutation), `publishCorrection`. No cron, no email.
  Files: `app/convex/reports.ts` [NEW] · **Agent A (backend)**
- **2.3** UI: state menu, required note with Internal toggle, history with internal notes shaded, *Reported as … · now …* line, **New report** drawer with the team-only notes column, publish confirm.
  Files: `app/src/components/board/StateMenu.tsx` [NEW], `app/src/components/board/NoteBox.tsx` [NEW], `app/src/components/board/History.tsx` [NEW], `app/src/components/report/DraftDrawer.tsx` [NEW], `app/src/components/board/WorkstreamCard.tsx`, `app/src/components/board/ReportCard.tsx` · **Agent B (frontend)**
- **2.4** Tests: note required; client never receives an internal event; publish freezes live states; a correction never mutates the original; a second `openDraft` returns the same draft; internal notes never appear in a draft's summary.
  Files: `app/convex/findings.test.ts` [NEW], `app/convex/reports.test.ts` [NEW] · **Agent C (test)**

**Acceptance.** User blocks a finding with a note and sees it live in a second browser; presses **New report**, publishes, moves a workstream, and sees *Reported as … · now …*.

### Phase 3 — Clients: invite and read
**Delivers:** Journeys 4 and 5.
**Dependencies:** Phase 2; a Microsoft (Entra) app registration accepting work and personal accounts, redirect URI `<SITE_URL>/api/auth/callback/microsoft`.

- **3.1** Microsoft social provider (`tenantId: "common"`, redirect `<SITE_URL>/api/auth/callback/microsoft`, `mapProfileToUser` strips the base64 avatar Entra returns); `members.inviteClient` creates an `invited` membership (email lower-cased, duplicate refused) and returns the invite text; `memberships.claim` extended to file a pending claim for Microsoft and to match `providerAccountId` on later sign-ins; `members.approveClaim` (team only) activates a pending claim (D15).
  Files: `app/convex/auth.ts`, `app/convex/memberships.ts`, `app/convex/members.ts` [NEW] · **Agent A (backend)**
- **3.2** Members page (team only) with the copy-invite dialog and an **Approve** control on pending claims (showing the claimed provider and email), Microsoft button on sign-in, the email-mismatch and "waiting for ZYT" messages.
  Files: `app/src/routes/p.$projectKey.members.tsx` [NEW], `app/src/routes/sign-in.tsx` · **Agent B (frontend)**
- **3.3** Tests: a client cannot call any write mutation beyond `memberships.claim`; a client of another project gets `no_access`; a Google sign-in with a different email does not activate the invite; a Microsoft sign-in leaves the membership pending until a team member approves it (D15).
  Files: `app/convex/access.test.ts` · **Agent C (test)**

**Acceptance.** User invites a client address; that user signs in with Microsoft (and, on a second invite, with Google) and sees the client board; the `board.get` network response contains no key outside `CLIENT_FIELDS`.

### Phase 4 — Evidence in R2
**Delivers:** Journey 6.
**Dependencies:** Phase 3; R2 bucket, API token, **CORS policy (GET, PUT from app origins)**, five `R2_*` env vars on the Convex deployment.

- **4.1** `@convex-dev/r2` configured; `checkUpload` requires team; `attachments.record` after `syncMetadata`; `attachments.requestSignedUrl` mutation (role check, then `r2.getUrl`, default 900 s).
  Files: `app/convex/attachments.ts` [NEW], `app/convex/convex.config.ts` · **Agent A (backend)**
- **4.2** Attach button, upload progress; `useSignedUrl` requests a link when a thumbnail enters view, keeps it 12 minutes, and re-requests on image `error`.
  Files: `app/src/components/board/Attachments.tsx` [NEW], `app/src/lib/useSignedUrl.ts` [NEW], `app/src/components/board/FindingRow.tsx` · **Agent B (frontend)**
- **4.3** Tests: a client's `requestSignedUrl` for an internal attachment returns null; `checkUpload` refuses a client; client `board.get` never contains `r2Key`.
  Files: `app/convex/attachments.test.ts` [NEW] · **Agent C (test)**

**Acceptance.** User uploads an internal and a shared screenshot from the deployed origin; the client sees only the shared one; a page left open 20 minutes still shows its images after scrolling.

### Phase 5 — The Claude API
**Delivers:** Journey 7.
**Dependencies:** Phase 4.

- **5.1** `apiKeys.create/revoke/list` (team only); token `zyt_<prefix>_<secret>` shown once, stored as SHA-256 of the secret; optional `expiresAt`; `lastUsedAt` updated per call.
  Files: `app/convex/apiKeys.ts` [NEW] · **Agent A (backend)**
- **5.2** `/api/v1/*` per §4: key → project → owner membership; every event and attachment `internal: true`; `wont_fix` and `/reports/*` return 403.
  Files: `app/convex/http.ts`, `app/convex/api/findings.ts` [NEW], `app/convex/api/auth.ts` [NEW] · **Agent A (backend)**
- **5.3** API keys page: name, created, expires, last used, revoke.
  Files: `app/src/routes/p.$projectKey.keys.tsx` [NEW] · **Agent B (frontend)**
- **5.4** Tests: revoked and expired keys 401; key from another project 404; publish 403; `wont_fix` 403; a note written by a key is invisible to a client.
  Files: `app/convex/api.test.ts` [NEW] · **Agent C (test)**

**Acceptance.** A `curl` session with a key lists, claims and blocks a finding and attaches a PR; the team board shows it live; the client board shows neither the note nor the PR; publish and Won't fix return 403.

---

## 6. Delegation & Parallelization Plan

**Phase 1**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 1.1–1.5, 1.8 | `.gitignore`, `README.md`, `tracker/build-seed.mjs`, `samples/nct/*`, `app/package.json`, `app/vite.config.ts`, `app/wrangler.jsonc`, `app/tsconfig.json`, `app/src/router.tsx`, `app/src/routes/__root.tsx`, `app/convex/*` (except tests; includes `memberships.ts`), `app/src/lib/auth-client.ts`, `app/src/routes/sign-in.tsx`, `app/README.md` | `tracker/*` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 1.6 | `app/src/routes/index.tsx`, `app/src/routes/p.$projectKey.index.tsx`, `app/src/components/board/*`, `app/src/components/NoAccess.tsx`, `app/src/styles/tokens.css` | `app/convex/board.ts`, `app/convex/projects.ts`, `mocks/board.html` |
| Agent C (test) | test-engineer | opus | high | 1.7 | `app/convex/access.test.ts` | `app/convex/schema.ts`, `app/convex/access.ts` |

opus for A — schema, auth and the allowlist are the permission model; opus for C — the classification test is the guard on every future field. Run mode **A → (B ∥ C)**: both wait on `schema.ts`, `access.ts` and `board.get`'s return type.

**Phase 2**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 2.1, 2.2 | `app/convex/findings.ts`, `workstreams.ts`, `events.ts`, `reports.ts` | `app/convex/access.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 2.3 | `app/src/components/board/StateMenu.tsx`, `NoteBox.tsx`, `History.tsx`, `WorkstreamCard.tsx`, `ReportCard.tsx`, `app/src/components/report/DraftDrawer.tsx` | `app/convex/*` |
| Agent C (test) | test-engineer | sonnet | medium | 2.4 | `app/convex/findings.test.ts`, `app/convex/reports.test.ts` | `app/convex/*` |

opus for A — publish must freeze atomically and never mutate history. Run mode **A → (B ∥ C)**.

**Phase 3**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 3.1 | `app/convex/auth.ts`, `memberships.ts`, `members.ts` | `app/convex/access.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 3.2 | `app/src/routes/p.$projectKey.members.tsx`, `app/src/routes/sign-in.tsx` | `app/convex/members.ts` |
| Agent C (test) | test-engineer | opus | high | 3.3 | `app/convex/access.test.ts` | `app/convex/*` |

opus for C — invite matching and cross-project refusal are the tenant boundary. Run mode **A → (B ∥ C)**.

**Phase 4**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 4.1 | `app/convex/attachments.ts`, `app/convex/convex.config.ts` | `app/convex/access.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 4.2 | `app/src/components/board/Attachments.tsx`, `app/src/lib/useSignedUrl.ts`, `app/src/components/board/FindingRow.tsx` | `app/convex/attachments.ts` |
| Agent C (test) | test-engineer | sonnet | medium | 4.3 | `app/convex/attachments.test.ts` | `app/convex/*` |

opus for A — a signed URL is a bearer credential. Run mode **A → (B ∥ C)**.

**Phase 5**

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (backend) | backend-engineer | opus | high | 5.1, 5.2 | `app/convex/apiKeys.ts`, `app/convex/http.ts`, `app/convex/api/*` | `app/convex/access.ts` |
| Agent B (frontend) | frontend-engineer | sonnet | medium | 5.3 | `app/src/routes/p.$projectKey.keys.tsx` | `app/convex/apiKeys.ts` |
| Agent C (test) | test-engineer | sonnet | medium | 5.4 | `app/convex/api.test.ts` | `app/convex/*` |

opus for A — token hashing and project scoping. Run mode **A → (B ∥ C)**.

**Ownership handoffs:** `app/convex/http.ts`: A (1.3) → A (5.2). `app/convex/convex.config.ts`: A (1.3) → A (4.1). `app/convex/auth.ts`: A (1.3) → A (3.1). `app/convex/memberships.ts`: A (1.3) → A (3.1). `app/convex/access.test.ts`: C (1.7) → C (3.3). `app/src/components/board/FindingRow.tsx`: B (1.6) → B (4.2). `app/src/routes/sign-in.tsx`: A (1.3) → B (3.2).
**Serialization points:** end of each phase — `bunx convex dev --once` pushes cleanly, `bun run typecheck` **output** read (not its exit code), `convex-test` suite green.

---

## 7. Impact & Breakage Analysis

**Callers.** None in code — greenfield, and no client repo imports this app.

**Files that move (Task 1.1).** `customer-intake-sop.html`, `customer-intake-sop/`, `steps-1-3-runbook.html`, `steps-1-3-rollout.md`, `plans/` → `samples/nct/`. Known references: `tracker/build-seed.mjs` (reads `../customer-intake-sop.html`), `tracker/build-board.mjs` (writes `../mocks/board.html` — unaffected), `README.md` contents table. The published artifacts are unaffected by the move, but future republishes must use the new file paths **with each artifact's `url`**, or they create new artifacts with empty databases.

**Contracts other things will depend on:**
- **`/api/v1/*`** becomes the MCP server's contract. Versioned path; never change a response shape in place.
- **`CLIENT_FIELDS`** is the client-visible contract. Adding a field to it is a disclosure decision; the classification test makes an unclassified field fail CI rather than leak.

**Nullable fields relied on:** `memberships.userId` is null until a claim is activated — `viewer()` matches only `active` rows by `userId`, never by email; email matching happens once, inside `memberships.claim`, and only on a Google-verified address. `findings.ownerId`, `repair`, `category` are optional; the UI renders their absence.

**Deployment coupling:**
- Convex deploys before the Worker that calls new functions.
- OAuth redirect URIs must list every origin (localhost and deployed) or sign-in fails only on that origin.
- R2 CORS must be in place before the upload UI ships, or uploads fail only in the browser.

**Blocking prerequisites:**
- Before Phase 1: Convex project, Cloudflare account, Google OAuth client.
- Before Phase 3: a Microsoft app registration.
- Before Phase 4: R2 bucket, token, CORS policy, `R2_*` env vars.

---

## 8. Cross-Cutting Concerns

**Errors.** Mutations throw `ConvexError` with a sentence the UI shows verbatim ("A note is required to change state"). HTTP API returns `{ error }` with §4's status codes. `no_access` renders `NoAccess`, never a blank board.

**Testing.** `convex-test` for every visibility and permission rule; one Playwright walk per journey at the end of each phase.

**Migration.** None — schema deploys with code. Each client loads once per deployment: `bunx convex run seed:importClient '{"bundle":"nct"}'`.

**Rollback.** Worker: redeploy the previous version. Convex: redeploy the previous commit; rows with a new optional field survive.

### Performance & Scalability

1. **Pagination** — `events.list` uses `paginate`. `board.get` returns bounded sets per project (NCT: 48 findings, 10 workstreams, 27 steps); above ~500 findings, split into a paginated `findings.list`.
2. **Server-side filtering** — every query uses an index (`by_project`, `by_subject`, `by_project_owner`, `by_project_at`); no `filter()` over a whole table.
3. **N+1** — `board.get` loads workstreams and findings with one indexed query each and joins in memory; `reportItems` loaded once `by_report`. `projects.listMine` reads memberships `by_user`, then projects by `by_agency` / `by_client` per org (a user has few orgs).
4. **Index coverage** — listed on every table in §4; `events.by_project_at` serves the draft's "since last published" window.
5. **Write atomicity** — Convex mutations are transactional: state change + event in one mutation; publish inserts all `reportItems` and stamps `publishedAt` in one mutation.
6. **Row locking** — Convex's optimistic concurrency retries conflicting mutations; two simultaneous state changes both commit as ordered events. `openDraft` checks-and-inserts in one mutation, so two presses cannot create two drafts.
7. **Resources** — R2 signing runs in an action; signed links are requested per visible thumbnail, not per board load.
8. **Tenant isolation** — `viewer()` resolves an active membership in the project's agency or client org before any read; queries then scope by `projectId`.
9. **Payload** — client responses carry only allowlisted fields; attachments never carry keys or bytes.
10. **Hot path** — `board.get` is a live query recomputed on any change to the project's rows — cheap at one client's size; revisit past a few hundred findings per project.

---

## 9. Decision Register, Open Questions & Risks

Ordered Open-and-blocking → Decided.

### Open — not blocking

**D4: Which email provider sends invite and publish notices, once email is added?** · Status: Open

| | Approach | Consequence |
|---|---|---|
| **A** | Resend, through Convex's Resend component | Sends from a Convex action with queuing and retries built in; a new vendor and a verified sending domain |
| **B** | Another transactional provider (Postmark or Amazon SES) called with `fetch` from a Convex action | Any vendor ZYT prefers; retries and idempotency hand-built |
| **C** | No email in v0 — the team copies the invite message to the client; clients see reports on the board, with no notice | Nothing new to run; clients aren't told a report went out |

- **Recommendation: A** when email is added — the only option with delivery retries already built for Convex.
- **Chosen:** — (open). v0 runs as **C** until decided, because sign-in no longer needs email (D5).
- **Blocking?** No. Adding email later is one follow-up task: `app/convex/email.ts`, a send from `members.inviteClient`, and a scheduled send from `reports.publish`.
- **Where it lands:** a follow-up after Phase 5; magic-link sign-in (D5-B) would come with it.

**D15: Microsoft sign-in gives an unverified email — how does a client's invite activate?** · Status: Open, not blocking (plan written for A; raised by the 2026-09-15 review)

Entra "does not emit the `email` claim for managed users by default" and its email is "tenant-mutable and never verified" (better-auth.com/docs/authentication/microsoft), so matching an invite by email is only safe for Google.

| | Approach | Consequence |
|---|---|---|
| **A** | Microsoft sign-in files a **pending** claim that a team member approves once on the members page; the membership then stores the Microsoft `oid` and matches on it afterwards | Clients on Microsoft still get in; one press by ZYT per new person; no reliance on an unverified claim |
| **B** | Trust the Microsoft email like Google's | No extra step; a tenant admin could set an address that matches someone else's invite |
| **C** | Google only for clients in v0; Microsoft waits for magic link | Nothing to approve; Microsoft-only clients are locked out |

- **Recommendation: A** — it keeps Microsoft usable without trusting a claim Microsoft itself says isn't verified.
- **Chosen:** — (open; plan written for A)
- **Blocking?** No — Phase 1 and 2 are Google-only; this lands in Phase 3.
- **Where it lands:** `memberships.ts`, `members.approveClaim`, Tasks 3.1–3.3.

### Decided

**D1: How does v0 handle organizations, roles and API keys?** · Status: Decided

| | Approach | Consequence |
|---|---|---|
| **A** | Own `organizations`, `memberships`, `apiKeys` tables; Better Auth for sign-in only | No unlisted plugins; the permission model lives in `access.ts` |
| **B** | Better Auth organization + API key plugins through a Local Install of the Convex component | Less permission code; schema-changing plugins mean owning and upgrading a copy of the auth tables |
| **C** | Clerk with Convex's Clerk integration | Proven; per-active-user cost across every client; API keys still custom |

- **Recommendation: A** — v0 needs two roles and project-scoped keys, which don't justify running a local copy of the auth schema.
- **Chosen:** A (you, at the input gate — matched the recommendation)
- **Conflict with context file:** `STACK.md` assumed B. Live docs list neither plugin as supported; the plan follows A. `STACK.md` should be updated.
- **Where it lands:** §4 schema, `access.ts`, Tasks 1.2, 1.3, 3.1, 5.1.

**D2: Where does the v0 code live?** · Status: Decided

| | Approach | Consequence |
|---|---|---|
| **A** | A new repo, `C:/Project/ZYT-Delivery` | Clean separation of product code from design notes |
| **B** | `C:/Project/ZYT-Task/app` | Code beside its schema, seeds and mocks in ZYT's own workspace |
| **C** | Inside one client's repo | Reuses that client's tooling; ties an agency-wide product to one client |

- **Recommendation: A** — an agency-wide product outlives one sample's notes.
- **Chosen:** B (you, at the input gate — overrode the recommendation). ZYT-Task is ZYT's workspace, not a client repo; D10 keeps the root reading as the product.
- **Where it lands:** every path in §5.

**D3: Who logs into v0?** · Status: Decided

| | Approach | Consequence |
|---|---|---|
| **A** | Team and client users | Visibility proven from day one |
| **B** | Team only | Smaller; visibility unproven until v1 |
| **C** | Team, plus a read-only share link | No client accounts; no per-person access or revocation |

- **Recommendation: A** · **Chosen:** A (you, at the input gate)
- **Where it lands:** Phase 3.

**D5: How do people sign in?** · Status: Decided (2026-09-15)

| | Approach | Consequence |
|---|---|---|
| **A** | Google or Microsoft for everyone; **magic link deferred** | No passwords and no email dependency; a client with neither account can't sign in yet |
| **B** | Google or Microsoft, with magic link as a fallback | Every client gets in; sign-in depends on an email provider (D4) |
| **C** | Magic link only | No OAuth apps; every sign-in waits on an email |

- **Recommendation: B** — agency clients use mixed mail providers.
- **Chosen:** A (you, 2026-09-15 — overrode: skip magic link for now). Consequence handled: D4 no longer blocks, and a locked-out client can register a Google account on their work address until magic link is added.
- **Rule:** an invite belongs to an email address; activation requires a provider-verified, exactly matching email. `trustedProviders` is never set.
- **Where it lands:** Tasks 1.3 (Google), 3.1 (Microsoft), 3.3 tests.

**D6: How does the app know which project you're in?** · Status: Decided (2026-09-15)

| | Approach | Consequence |
|---|---|---|
| **A** | `/p/$projectKey`; role derived from membership in the project's agency or client org; `/` lists your projects and redirects when there is one | Two tabs show two clients; no org/project mismatch to check; the URL grants nothing |
| **B** | `/o/$orgSlug/p/$projectKey` | Readable; redundant org segment cross-checked on every call |
| **C** | Active organization on the session | The NCT failure — one tab switches every tab |

- **Recommendation: A** · **Chosen:** A (you, 2026-09-15; subdomains ruled out)
- **Where it lands:** `viewer(ctx, projectKey)`, §4 routes, every function's args.

**D7: Where is team/client visibility decided?** · Status: Decided (2026-09-15)

| | Approach | Consequence |
|---|---|---|
| **A** | One `forRole` function using a **client allowlist** per table, plus a test that every schema field is classified | A new field is hidden from clients until someone lists it |
| **B** | A per-table list of fields to remove for clients | Same single place; a forgotten field leaks |
| **C** | Return everything and hide in the UI | Every hidden field is in the network response |

- **Recommendation: A** · **Chosen:** A (you, 2026-09-15)
- **Where it lands:** `access.ts`, Task 1.7.

**D8: How is a report drafted?** · Status: Decided (2026-09-15)

| | Approach | Consequence |
|---|---|---|
| **A** | **New report** builds the draft on demand from current statuses and shared notes since the last published report; publish freezes states | No scheduled job; the draft is never stale; someone has to remember |
| **B** | A Friday cron builds the draft | Waiting for you, but stale if anything moves after it runs; per-project day and timezone |
| **C** | No draft; publish freezes states and the summary is written from scratch | Simplest; the week's notes are gathered by hand |

- **Recommendation: A** — it uses the live status the team already keeps. A reminder can be added later without building drafts.
- **Chosen:** A (you, 2026-09-15)
- **Where it lands:** `reports.ts`, Task 2.2. No `crons.ts` in v0.

**D9: How does a browser get a file from R2?** · Status: Decided (2026-09-15)

| | Approach | Consequence |
|---|---|---|
| **A** | A mutation checks the role, then signs a 15-minute link (the component default); the page requests it per visible thumbnail and re-requests on failure | Internal files never get a link; no expired links served from a cached query |
| **B** | Signed links embedded in the board's live query | Simple; links expire while the page stays open |
| **C** | Public bucket | Every link works forever — internal screenshots leak |

- **Recommendation: A** · **Chosen:** A (you, 2026-09-15)
- **Where it lands:** `attachments.ts`, `useSignedUrl.ts`, Tasks 4.1–4.2.

**D10: Where is the git root?** · Status: Decided (2026-09-15)

| | Approach | Consequence |
|---|---|---|
| **A** | `ZYT-Task/` is the repo; NCT's SOP material moves to `samples/nct/` | Design, seeds and code version together; the root reads as the product |
| **B** | `ZYT-Task/app/` is the repo | Clean code repo; design notes unversioned |
| **C** | No git until v0 works | No history for the riskiest phase |

- **Recommendation: A** · **Chosen:** A (you, 2026-09-15)
- **Where it lands:** Task 1.1.

**D11: How does a client's data get in?** · Status: Decided (2026-09-15)

| | Approach | Consequence |
|---|---|---|
| **A** | A general `seed:importClient` internal mutation reading a registered bundle folder; idempotent; NCT is the first bundle | A second client is data, not code; no public import surface |
| **B** | Import through the HTTP API | Exercises the API; needs a key before any project exists |
| **C** | An NCT-specific seed | Fast now; rewritten for every client |

- **Recommendation: A** · **Chosen:** A (you, 2026-09-15)
- **Where it lands:** `seed.ts`, `seed-data/`, Task 1.4.

**D12: What is an API key scoped to?** · Status: Decided (2026-09-15)

| | Approach | Consequence |
|---|---|---|
| **A** | One project, one owner, SHA-256 hash, optional expiry, last-used shown | A leak touches one project; writes attribute to a person; stale keys are visible |
| **B** | A user across all their projects | Fewer keys; a leak touches every client |
| **C** | Convex deploy keys | Full admin — never for a Claude session |

- **Recommendation: A** · **Chosen:** A (you, 2026-09-15)
- **Where it lands:** `apiKeys.ts`, Tasks 5.1, 5.3.

**D13: What may an API key write?** · Status: Decided (2026-09-15)

| | Approach | Consequence |
|---|---|---|
| **A** | Claim, state change (not Won't fix), attachment, new finding — all internal; no publish, no workstream close | A person decides what the client reads and which promises are dropped |
| **B** | The same, plus Won't fix and shared notes | Faster for trusted sessions; client-facing changes without review |
| **C** | Read-only API | Safest; a human relays every change |

- **Recommendation: A** · **Chosen:** A (you, 2026-09-15)
- **Where it lands:** Task 5.2.

**D14: Which stack?** · Status: Decided (2026-09-14)

| | Approach | Consequence |
|---|---|---|
| A | TanStack Start + oRPC + Drizzle/Neon + Better Auth on Cloudflare | Familiar; live sync, jobs and the API hand-built |
| **B** | TanStack Start on Cloudflare + Convex + Better Auth + R2 | Live queries and HTTP actions built in |
| C | Next.js + Convex + Clerk on Vercel | Fast; per-user auth cost across all clients |

- **Recommendation: A** (revised earlier) · **Chosen:** B with R2 (you — overrode)
- **Where it lands:** the whole plan; `STACK.md`.

### Risks

- **The Convex Better Auth component moves fast** (migration guides 0.8 → 0.12) → likely → pin exact versions; read the migration guide before upgrading.
- **Social sign-in isn't in the Convex guide** → medium → Google sign-in is Phase 1's first proof; if it fails, try the supported Generic OAuth plugin with Google's endpoints before anything else; the membership model doesn't change either way.
- **A client has neither a Google nor a Microsoft account** → medium across many clients → they register a Google account on their work address (no Gmail needed); if that is refused, add magic link with D4.
- **Invite hijack by a different address** → low with the rule → activation requires a verified, exactly matching email; covered by Task 3.3.
- **R2 CORS missing** → uploads fail only in the browser → Phase 4 acceptance uploads from the deployed origin.
- **Moving files breaks a republish** → medium → README states new paths and that republishes pass each artifact's `url`.

---

## 10. Verification & Proof

**App URL:** http://localhost:3000 (TanStack Start dev default; `bun run dev` in `app/` alongside `bunx convex dev`)
**Preconditions:** `bunx convex run seed:importClient '{"bundle":"nct"}'` run once; your Google account listed as a team member in `seed-data/nct/members.json`; for Journey 5, a client membership invited for a Microsoft account you control, and a second Google account with a different email.
**Migrations:** none.

**Golden path — Journeys 1 → 2 → 3 (team):**
1. Navigate to `/sign-in` → **Continue with Google** → back at the app.
2. `/` shows NCT (or redirects straight to `/p/nct`); the flow rail shows 5 phases and 27 steps with counts.
3. Expand **Approvals do not hold** → its findings, each with a repair and a code location.
4. DevTools → Network → `board.get` contains `repair` and `src`.
5. Set finding *A quotation stays fully editable while it is sitting in the reviewer's queue* to **Blocked**, note "Need NCT to confirm self-approval", Internal off → **Save** → chip reads Blocked; the note tops the history.
6. Add an internal note on another finding.
7. A second window signed in as another team member already shows both changes.
8. **New report** → the drawer lists live states, the shared note as a bullet, and the internal note only in the team-only column → **Publish** → toast *Report published*.
9. Set **Approvals do not hold** to Blocked → its card shows *Reported on … as In progress · now Blocked.*

**Golden path — Journey 5 (client):**
1. In a fresh browser profile, open the app link from the copied invite → **Continue with Microsoft** with the invited address → "Waiting for ZYT to confirm your access"; as the team member, press **Approve** on the members page; reload → lands on `/p/nct`. (A Google-invited client lands straight on the board with no approval.)
2. Expand **Approvals do not hold** → finding titles with category and step; **no repair, code location or owner.**
3. Network → `board.get` has no key outside `CLIENT_FIELDS` (no `repair`, `src`, `ownerId`, `prompt`, `internal`, `r2Key`).
4. The internal note from step 6 is absent; the shared note is present.
5. `/p/nct/members` → "You don't have access to this page".

**Edge cases:**
- Sign out; sign in with the second Google account (email not invited) → "This account isn't invited to any project…"; `/p/nct` → NoAccess with no board data in the network response.
- Leave the board open 20 minutes, scroll to an attachment → the image loads (link re-requested).

**Regression check:** after Phase 5, a note posted with `POST /api/v1/findings/:key/state` never appears in the client's `events.list` response, and the classification test still passes.

**Brand:** the board matches the zhiyuantech.ai homepage side by side — light: `#fbfcff → #f1f4fb` ground, `#101A4F` headings and primary buttons, `#4159C9` accent, navy logo lockup; dark: the darker product variant — `#04061a → #060920` ground, `#080c24` cards, white headings, `#8B9AE8` accent, white lockup, matching admin.zhiyuantech.ai side by side — with Space Grotesk headings in both (values in `hosting/hub/brand/BRAND.md`).

**Mobile:** at 400px the flow rail collapses above the workstreams; the state menu, note box and report drawer fit without horizontal scroll.

**Readiness: 8/10** — schema, contracts and the permission model are settled, and nothing in v0 waits on a decision; held back by Google sign-in through Convex not yet proven and the Google and Microsoft apps not yet registered.
