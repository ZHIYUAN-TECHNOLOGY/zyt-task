# Staff review — ZYT Delivery v0 plan

Reviewed 2026-09-15 against live docs and the seed files. The delegated review agent hit an API rate limit; this review was done in the main session, so it is a documentation and data check plus a consistency pass — it is **not** a second independent model's opinion.

## Verdict

**Ready with fixes.** The architecture, permission model and phasing hold up. Four defects would have bitten during Phase 3 or 4 — one security-relevant (Microsoft e-mail claims are not verified), one API-shape error (`r2.getUrl` cannot be called from an action), one missing mechanism (nothing actually activates an invited membership), and one data mismatch (the seed's `severity` values are categories, not severities). All four are fixed in `plan.md`; the Microsoft one also needs your decision (D15).

## Blocking findings

**B1 — Microsoft does not give a verified e-mail. §2 J5, D5, Task 3.1.**
Better Auth's Microsoft page warns that Entra "does not emit the `email` claim for managed users by default" and that e-mail there is "tenant-mutable and never verified"; it recommends `profile.oid` (+ `profile.tid`) as the identity anchor. The plan activates an invited membership by matching a provider-verified e-mail — which Google satisfies and Microsoft does not. Left as written, a Microsoft user could in principle present an e-mail their tenant admin set, and match someone else's invite.
*Fix applied:* a Microsoft sign-in never auto-activates. It creates a **pending** claim that a team member approves on the members page (one press), and the membership then stores the Microsoft `oid`/`tid` so later sign-ins match on that, not on e-mail. Google keeps auto-activation. Recorded as **D15** — your call between three options.
Source: https://www.better-auth.com/docs/authentication/microsoft

**B2 — `r2.getUrl` is not callable from an action. §4 contracts, D9, Task 4.1.**
The component's README lists `getUrl` as query-or-mutation; the plan made `attachments.signedUrl` an action specifically to dodge query caching.
*Fix applied:* it becomes a **mutation** (`attachments.requestSignedUrl`). Mutations run the auth check, are never served from a query cache, and can call `r2.getUrl`. Default expiry is already 900 s, so the plan's 15 minutes is the component default rather than an override.
Source: https://github.com/get-convex/r2 README

**B3 — Nothing activates an invited membership. §4, Tasks 1.3 / 3.1.**
The plan says activation happens "on sign-in" but names no mechanism, and the Convex Better Auth docs I could reach do not document a user-creation hook.
*Fix applied:* an explicit `memberships.claim` mutation the app calls once after sign-in — it reads the Better Auth user (`authComponent.getAuthUser`), lower-cases the verified e-mail, and activates a matching `invited` row (Google) or creates a pending claim (Microsoft, per B1). No dependency on an undocumented hook.
Source: https://labs.convex.dev/better-auth/authorization

**B4 — `severity` in the seed is a category, not a severity. §4 schema, §4 design tokens, Task 1.4.**
`tasks-nct.json` uses `data` (15), `money` (9), `friction` (4), `blocked` (2), and `null` on all 18 chain findings. The plan implied an ordinal severity and the token section coloured "severity *high*", which does not exist.
*Fix applied:* the field is renamed `category` with those four literals, optional; the tokens map one colour per category.

## Non-blocking findings

**N1 — Seed field names.** Findings and workstreams use `id` (e.g. `nct-identity`), not `key`; the importer maps `id` → `key`. Workstreams carry `visible: false` on all ten — a leftover from before "clients see everything"; the importer ignores it. Noted in Task 1.4.
**N2 — Seed integrity is good.** 48 findings, all `state: "open"`; 10 workstreams, all `planned`; every finding covered exactly once, no unknown ids in `covers`; 18 chain findings ranked 1–18; `repair` and `src` present on the 30 step-local findings only; `steps[].kind` is `step` or `break-after`; the flow has 5 phases and 27 steps. The schema matches.
**N3 — Schema introspection in Task 1.7 is unverified.** Reading `schema.tables.<t>.validator.fields` inside `convex-test` may not be public API. Fallback recorded in the task: an explicit `ALL_FIELDS` list per table, with the test asserting it equals the schema's own keys at runtime.
**N4 — Auth propagation through `ctx.runQuery` from an action** is not documented on the page I could read. B2 removes the plan's dependency on it.
**N5 — Convex Better Auth social providers.** Still not shown in the Convex guide (it walks e-mail + password). Google sign-in remains Phase 1's first proof, as the plan already says.

## Verified correct

- R2 env vars `R2_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`; CORS policy for GET and PUT; `generateUploadUrl` and `syncMetadata` are mutations; `checkUpload` / `onUpload` / `onSyncMetadata` callbacks exist; `getUrl` default expiry 900 s. (get-convex/r2 README)
- `authComponent.getAuthUser(ctx)` is the documented way to read the current user in a Convex function. (labs.convex.dev/better-auth/authorization)
- Better Auth links a social account to an existing user only when the provider reports the e-mail verified, unless the provider is in `trustedProviders` — the plan never sets it. (better-auth.com/docs/concepts/users-accounts)
- Microsoft redirect path `/api/auth/callback/microsoft`, `tenantId` defaults to `common`. (better-auth.com/docs/authentication/microsoft)
- Supported Convex plugin list excludes organization and apiKey; SSO incompatible — D1 stands. (labs.convex.dev/better-auth/supported-plugins)
- Seed ↔ schema mapping (N2).

## Could not verify

- Whether Convex's Better Auth component supports `socialProviders` and what the exact Google callback path is under TanStack Start — the docs pages reachable here cover e-mail + password only. Phase 1 Task 1.3 proves it; a wrong path is a one-line change in the Google console.
- `convex-test` schema introspection (N3).
- Auth identity propagation from an action's `ctx.runQuery` (N4) — no longer needed.
