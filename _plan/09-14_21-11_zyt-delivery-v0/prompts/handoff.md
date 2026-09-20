# Handoff — ZYT Delivery v0

Paste this into a fresh Claude Code session (or hand it to a colleague) to pick the work up cold.

---

## What this is

ZYT Delivery is an **agency-wide client delivery board**: the ZYT team runs each client's delivery on one live board, and the client's own users sign in to read the same board with team-only fields removed **on the server**. Claude sessions can move work through a scoped HTTP API.

v0 ships the whole app with **one client loaded: NCT**. NCT is a *sample* — its operations were mapped to design the tracker. Nothing may be hard-coded to NCT except its data bundle. `C:/Project/ZYT-Task` is ZYT's own workspace, not a client repo, and no code here imports anything from `C:/Project/NCT`.

**Nothing is built yet.** The plan is written and reviewed; no app folder, no git repo, no deployment.

## Where everything lives

| Path | What it is |
|---|---|
| `C:/Project/ZYT-Task/_plan/09-14_21-11_zyt-delivery-v0/plan/plan.md` | **The plan.** 10 sections, 5 phases, every file path and contract. Read it in full before writing code. |
| `…/plan/review.md` | Staff review of the plan (2026-09-15) and the four fixes already applied |
| `…/META.md` | Session descriptor (tier, phases, stack) |
| `C:/Project/ZYT-Task/tracker/SCHEMA.md` | The model and the per-field visibility rules — the product's source of truth |
| `C:/Project/ZYT-Task/tracker/STACK.md` | The stack decision, revised 2026-09-15 to match the plan (own org/API-key tables, no cron, checks mapped to phases). If it ever disagrees with plan.md, the plan wins. |
| `C:/Project/ZYT-Task/tracker/seed/*.json` | NCT's real data: 27 steps, 48 findings, 10 workstreams |
| `C:/Project/ZYT-Task/mocks/board.html` | The board mock with a Team/Client toggle — the layout reference (its palette is superseded, see below) |
| `C:/Project/ZYT-Task/app/` | Where the code goes. Does not exist yet. |

## The stack

TanStack Start on Cloudflare Workers · Convex (data, functions, HTTP actions) · Better Auth through the Convex Better Auth component, **sign-in only** · Cloudflare R2 via `@convex-dev/r2` · Bun.

Our own Convex tables hold organizations, memberships and API keys, because the Convex integration does not list Better Auth's organization or apiKey plugins as supported.

## Decisions already made — do not relitigate

| | Decision |
|---|---|
| D1 | Own org/membership/API-key tables; Better Auth for sign-in only |
| D2 | Code in `ZYT-Task/app` |
| D3 | Team **and** client users in v0 |
| D5 | Google and Microsoft sign-in. **Magic link deferred**, no email anywhere in v0 |
| D6 | URLs are `/p/$projectKey` — no org segment, no subdomain, no active-org on the session |
| D7 | Clients get an **allowlist** of fields per table; anything unlisted is hidden |
| D8 | Reports are drafted on demand by a **New report** button. No cron |
| D9 | R2 reads: a mutation checks the role, then signs a link (900 s default) |
| D10 | Git root is `ZYT-Task/`; NCT's SOP material moves to `samples/nct/` |
| D11 | A general client importer reading a bundle folder; NCT is bundle one |
| D12 | API keys scoped to one project, hashed, optional expiry |
| D13 | API keys write internal-only; no publish, no Won't fix |
| D14 | The stack above |

**Open (neither blocks v0):**
- **D4** — which email provider, once email is added. v0 sends nothing.
- **D15** — how a Microsoft client's invite activates. The plan is written for: a pending claim a team member approves once. Lands in Phase 3.

## Design tokens

Colours, fonts, radius and the logo come from ZYT's site, https://www.zhiyuantech.ai/ — its homepage palette, recorded in `C:/Project/ZYT-Task/hosting/hub/brand/BRAND.md` (logo and icon files sit next to it) and listed in plan.md §4 *Design tokens*. Use those, not the mock's palette, and not the site's older base tokens (`#fafaf8`, `#2b66fb`). Light: pale-blue ground `#fbfcff → #f1f4fb`, navy headings and primary buttons `#101A4F`, ink `#1c2547`, indigo accent `#4159C9`, border `#e2e8f5`. Dark (the site's dark palette taken darker, decided 2026-09-15): ground `#04061a → #060920`, cards and columns `#080c24`, inputs and chips `#0d1333`, border `rgba(139,154,232,.13)`, white headings, body `#cdd6f5`, accent `#8B9AE8`, buttons `#4159C9`. Space Grotesk headings, Geist body, JetBrains Mono for keys and numbers. The live dashboard at admin.zhiyuantech.ai (`hosting/hub/index.html`) is a working reference.

## Before Phase 1 can run

1. **A Google OAuth client** (Google Cloud Console → Credentials → OAuth client ID → Web application):
   - Authorised origin `http://localhost:3000`
   - Redirect URI `http://localhost:3000/api/auth/callback/google` (confirm the exact path during Task 1.3; the deployed URL is added after the first deploy)
   - The client ID and secret go in `app/.env.local` **by the owner**, never pasted into chat
2. **The team's Google addresses** for `app/convex/seed-data/nct/members.json`
3. A Convex project (`bunx convex dev` will create one) and the Cloudflare account — Wrangler is already logged in as `wilfred@zhiyuantech.ai`

Phase 3 also needs a Microsoft (Entra) app registration. Phase 4 needs an R2 bucket, an API token, and a CORS policy allowing GET and PUT from the app's origins.

## How to run it

Follow plan.md §5 phase by phase and §6 for who owns which file. `/execute` consumes §6 directly.

- **Phase 1** — scaffold, schema, `access.ts`, Google sign-in, the NCT importer, `board.get`, the board page, the field-classification test, deploy.
- **Phase 2** — state changes with required notes, history, reports (draft, publish, correction).
- **Phase 3** — Microsoft sign-in, client invites, the client board.
- **Phase 4** — R2 attachments.
- **Phase 5** — project API keys and `/api/v1/*`.

Run mode in every phase is backend first, then frontend and tests in parallel. Between phases: `bunx convex dev --once`, then read the **output** of `bun run typecheck` (not its exit code), then the `convex-test` suite.

## The three things that must not slip

1. **Visibility is enforced on the server.** Client responses carry only allowlisted fields. Never hide a field in CSS or in the UI layer. Task 1.7's test fails if a new schema field is neither client-visible nor team-only — keep it passing rather than editing it away.
2. **Every state change carries a note**, with an internal toggle, written as an event. Nothing is overwritten, and a published report is never edited — a mistake is a correction report.
3. **An invite belongs to one email address.** Activation happens once, in `memberships.claim`, only on a provider-verified address. `trustedProviders` is never set.

## House rules (from the owner's CLAUDE.md)

- **Never run `git stash` or `git reset`, any variant.**
- Plan before touching more than two files; if implementation goes sideways, stop and re-plan rather than pushing on.
- Type-check and report the result after any multi-file change. Exit codes lie here — read the output.
- Verify UI work in a real browser (Chrome MCP), golden path plus one edge case, not just tests.
- Kill processes with a tree kill and verify they're gone.
- Don't re-read a file straight after editing it; don't over-explore once two searches agree.

## First message to send a fresh session

> Read `C:/Project/ZYT-Task/_plan/09-14_21-11_zyt-delivery-v0/plan/plan.md` and `plan/review.md` in full, plus `tracker/SCHEMA.md`. Then execute Phase 1 per §5 and §6. Stop at the Phase 1 acceptance criteria and show me the board in a browser.
