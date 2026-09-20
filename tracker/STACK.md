# ZYT Delivery — stack

**Decided 2026-09-14.** Option B, with file storage moved to R2.
**Revised 2026-09-15** against the live docs, during planning. Where this file and
`_plan/09-14_21-11_zyt-delivery-v0/plan/plan.md` disagree, the plan wins.

| Layer | Choice |
|---|---|
| Frontend | **TanStack Start**, deployed on **Cloudflare Workers** |
| Database, backend functions, live queries | **Convex** (no ORM) |
| Scheduled work | **None in v0.** Reports are drafted on demand by a **New report** button (D8). Convex crons stay available if a schedule is added later |
| API for Claude sessions (MCP / CLI) | **Convex HTTP actions** under `/api/v1/*` |
| Sign-in | **Better Auth**, through the Convex Better Auth component — **sign-in only**. Google and Microsoft; magic link deferred, no email anywhere in v0 (D5) |
| Organizations, memberships, roles, API keys | **Our own Convex tables** (`organizations`, `memberships`, `apiKeys`), not Better Auth plugins (D1) |
| File uploads — screenshots, evidence, attachments | **Cloudflare R2**, private bucket, through `@convex-dev/r2` |
| Package manager / runtime | **Bun** |

## Why this, and not the alternatives

| | Stack | Why not |
|---|---|---|
| A | Mirror NCT: TanStack Start + oRPC + Drizzle/Neon + Better Auth + Cloudflare | Live sync, scheduled jobs and the Claude API would all be hand-built |
| **B** | **TanStack Start + Convex + Better Auth, R2 for files** | **Chosen** |
| C | Next.js + Convex + Clerk on Vercel | Per-user auth pricing grows with every client onboarded; team already writes TanStack |

Files go to R2 rather than Convex storage so evidence and screenshots sit on the same
Cloudflare account as the frontend, under a bucket ZYT controls.

### Why our own org and API-key tables (D1)

The first version of this file assumed Better Auth's **organization** and **API key**
plugins. Convex's Better Auth integration does not list either as supported (its list:
Anonymous, Email OTP, Generic OAuth, JWT, Magic Link, One Tap, Phone Number, Two Factor,
Username), and schema-changing plugins would need a Local Install of the component. So
Better Auth only signs people in; organizations, memberships and project API keys are
plain Convex tables, and the permission model lives in `app/convex/access.ts`.

## Non-negotiables this stack must satisfy

1. **Visibility is enforced on the server.** Every Convex query reads the caller's role and
   returns only the fields that role may see. Clients get an **allowlist** of fields per
   table; anything unlisted is hidden (D7, and `SCHEMA.md`, "What the client does not
   see"). The CSS toggle in `mocks/board.html` is a demo, never the mechanism.
2. **R2 objects are never public.** The bucket is private. A file is reached only through a
   short-lived signed URL issued *after* the same role check. `@convex-dev/r2` has no
   read-authorization callback, so a **mutation** (`attachments.requestSignedUrl`) checks
   the role and then calls `r2.getUrl` (900 s default) — not an action, which cannot call
   it, and not a query, which could be served from cache (D9).
3. **Uploads go straight to R2.** The browser uploads with a signed PUT URL
   (`generateUploadUrl` → PUT → `syncMetadata`); Convex stores the object key, size, type
   and `internal` flag, not the bytes. The bucket needs a CORS policy allowing GET and PUT.
4. **The project lives in the URL**, not the session: `/p/$projectKey`, no org segment, no
   subdomain, no active organization on the session (D6) — avoiding the NCT trap where one
   tab switching org silently redirected every other tab.
5. **Claude sessions authenticate with API keys scoped to one project** — hashed
   (SHA-256), shown once, optional expiry (D12). Keys write internal-only and can never
   publish a report or mark anything Won't fix (D13; `SCHEMA.md`, "What Claude sessions
   may do").
6. **An invite belongs to one email address.** Activation happens once, in
   `memberships.claim`, on a provider-verified address. Better Auth's `trustedProviders`
   is never set. Microsoft emails are not verified, so a Microsoft sign-in creates a
   pending claim a team member approves, and later sign-ins match on `oid`/`tid` (D15,
   still open).

## Prove as we build — folded into the phases

The half-day spike is no longer a separate step. Each check is proven in the plan phase
that first needs it.

| # | Prove | Pass when | Phase |
|---|---|---|---|
| 1 | Google sign-in through the Convex Better Auth component | A team member signs in, `memberships.claim` activates their invited row, and an uninvited user sees "isn't invited" | 1 |
| 2 | Role-based projection | One query returns `repair` and `owner` to a team session and omits them for a client session — checked in the network response, not the page | 1 (team), 3 (client) |
| 3 | TanStack Start deploys to Cloudflare Workers with Convex | The deployed app loads live data from the Convex deployment | 1 |
| 4 | Microsoft sign-in and client invites | A client user signs in with Microsoft, a team member approves the pending claim, and the client board loads | 3 |
| 5 | R2 signed upload | Browser PUTs a file to R2 through a signed URL; Convex records the key | 4 |
| 6 | R2 signed read respects `internal` | A client session is refused a signed URL for an internal attachment | 4 |
| 7 | Project-scoped API key | A key calls one Convex HTTP action and is refused on a second project | 5 |

**If 1 fails** (social providers don't work through the Convex component): swap Better
Auth for Clerk + Convex's Clerk integration. Orgs and API keys are already our own tables,
so nothing else moves.
**If 5 or 6 fails:** use a Cloudflare Worker with an R2 binding as the signing proxy, called
from a Convex mutation or action.

## Check the current versions, don't assume them

Before each phase, read the live docs for: Convex's Better Auth integration (supported
plugins, and whether `socialProviders` and the TanStack Start callback path work as
expected), `@convex-dev/r2`, and TanStack Start's Cloudflare deployment target. These are
young integrations and move fast; this document records the decision, not the API.
