# Clerk auth for admin.zhiyuantech.ai: plan

Session: `_plan/09-23_clerk-auth` · Date: 2026-09-23 · Repo: `C:/Project/ZYT-Task` (site code under `hosting/`) · Revision 2 (after three reviews; see "Review disposition" at the end)

Today the whole site is public (`hosting/SITE.md:242-243`, decision 2026-09-18), and a tick records a first name the visitor types (`hosting/convex-app/convex/findings.ts:33-54`, `hosting/hub/index.html:2440-2461`). This plan puts every page, download, recording and Convex call behind Clerk Organizations, and records the signed-in user on each tick.

---

## 1. Summary, decisions, non-goals

### Decisions (fixed by the user: Clerk with Organizations)

| # | Decision | Reason |
|---|---|---|
| D1 | There are four Clerk orgs, with slugs matching the path keys: `zyt`, `nct`, `jwa`, `harper` (`hosting/hub/projects.json:3,123,143,169`). | The Worker and Convex can then compare a slug with a path segment or `projectKey` directly, with no lookup table to drift. |
| D2 | Every user belongs to exactly one org. ZYT staff are in `zyt` only, and `zyt` may open everything. | The v2 session token carries only the active org (`o.slg`). With one org per user, the active org is always the right one, and staff can't lose global access by switching to a client org in another tab. |
| D3 | The Cloudflare Worker `zyt-admin` enforces the gate at the edge, with `run_worker_first: true`. Any path it doesn't know needs `zyt`. The Worker classifies a **canonical, decoded** path and hands that same path to ASSETS. | The pages are static assets (`hosting/site/wrangler.jsonc:13-22`), so a client-side check can be bypassed. A path nobody mapped ends up staff-only instead of public. Classifying and serving the same canonical path closes encoded-traversal tricks (`%2F`, `%5C`). |
| D4 | The dashboard at `/` is built once per org at `/_hub/<co>/index.html`. The Worker rewrites `/` to the signed-in user's variant. The build fails if a client variant contains another company's key or path. | Today `/` inlines every company's seed (`hosting/deploy-site.ps1:423-429`, `hosting/hub/index.html:735`), so gating the path alone leaks NCT, JWA and Harper content to any signed-in client. With per-org variants, `SEED.projects` already holds only the user's company, so the switcher, `subscribe()` and My tasks are scoped without any change to their logic. |
| D5 | A request for another company's path gets the 404 page with status 404, not a 403. The Worker produces it by asking ASSETS for a path that is guaranteed missing (`/__denied__`), so `not_found_handling: 404-page` answers with `404.html` and status 404. | This doesn't confirm to one client that another client exists. Fetching `/404.html` directly would not work: `html_handling: auto-trailing-slash` answers `/404.html` with a 307 to `/404`. |
| D6 | Convex trusts Clerk through `convex/auth.config.ts`. One helper, `requireCompany(ctx, projectKey)`, is the only access check. The server takes the tick's author from the identity. | This replaces the typed name (`findings.ts:36-40`) and closes the anonymous `board` (`findings.ts:8-31`). |
| D7 | Convex enforcement sits behind the Convex env var `AUTH_ENFORCE`. While it is unset, anonymous calls behave as they do today. | The prod cutover then needs no downtime, and rollback is a single env change (see section 6). |
| D8 | The service worker precaches only the public shell. Gated pages are network-only and never cached. Sign-out purges all caches. | The current `addAll` would fail on 302s and 401s (`hosting/pwa/sw.js:13-15`), and the cache isn't keyed per user (`sw.js:31-42`). Offline access to gated content is dropped (see non-goals). |
| D9 | Sign-in uses Clerk-hosted UI loaded from the Frontend API (FAPI) with a script tag: `@clerk/clerk-js@6` plus `@clerk/ui@1`, mounted on a new public `/sign-in/` page. Every page that mounts a Clerk component (sign-in, hub, SOP pages) loads the same clerk-js + `@clerk/ui` pair. | The hub is plain HTML with no React (`hosting/hub/index.html:737`). Under clerk-js v6 the prebuilt components ship in `@clerk/ui`. |
| D10 | The Clerk production instance runs as a Secondary application at `clerk.admin.zhiyuantech.ai`. The Clerk dev instance (`pk_test_…`, `*.accounts.dev`) is used for every phase before cutover. | Secondary keeps Clerk cookies scoped to the admin site and leaves the root domain free. The dev instance needs no DNS, so Phases 1-3 can go ahead while DNS waits (it can take up to 48 h). |
| D11 | The old `DOWNLOADS_PASSPHRASE` Basic-auth gate (`hosting/site/worker.js:1-67`) is removed. `/nct/downloads/*` falls under the `nct` org gate. | That gate is superseded. The fail-closed, no-store and `wrangler secret` patterns it used carry over, and its constant-time compare is reused for break-glass (D16). |
| D12 | `/golden-paths/<job>.*` stays where it is. The Worker maps a job to a company by its filename prefix (`nct-`, `jwa-`), and an unknown prefix needs `zyt`. | Every job under `hosting/recordings/` is already prefixed. Moving them would change `golden-path.js:180-190` and the runner for no benefit. |
| D13 | The golden-path Run panel is hidden by default and shown only after `Clerk.load()` resolves with org `zyt`. Published recordings are visible to their own company. | The runner is Wilfred's localhost tool (`hosting/runner/server.mjs:10-17`). Hidden-by-default avoids a flash for client users. |
| D14 | **Branch policy.** Phases 1-3 are built on branch `feat/clerk-auth` in worktree `C:/Project/ZYT-Task-clerk`, with `main` merged in at least daily. The branch merges to `main` only in Phase 4, in the same sitting as the cutover deploy. `deploy-site.ps1` also refuses a real deploy without prod Clerk keys (belt and braces). | `main` is deployed to prod many times a day (26 commits on 2026-09-23; SITE.md:57,62,69 prescribe a redeploy after every SOP, runbook and recording change). Landing the gate on `main` early would ship a Worker with no prod keys, which fails closed and takes the site down. |
| D15 | **Canary before cutover.** The branch is first deployed as a second Worker, `zyt-admin-canary`, on `canary.admin.zhiyuantech.ai` (wrangler env `canary`), with the full gate and the prod Clerk instance. The live site is untouched until the canary passes the full `check-gate.mjs` matrix. | A `pk_live` key only works on the production domain and its subdomains, so prod Clerk (FAPI DNS, handshake, custom claims, Convex issuer and `aud`) can't be tested on localhost. The canary exercises all of it before anyone is gated. |
| D16 | **Failure modes.** The gate fails closed. For incidents there are two switches that take effect immediately as `wrangler secret`s: `MAINTENANCE=1` serves a static maintenance page (503, no-store) on every gated path, and `BREAKGLASS_PASSPHRASE`, set only during an incident, lets Basic auth with that passphrase through as `zyt`. Rolling back to the public site needs Wilfred's explicit go. | A Clerk or FAPI outage would otherwise lock Wilfred out too, and the only remedy would be making every client's content public again. |

### Non-goals
- Convex ticking for jwa, harper and zyt. Only `seed:nct` exists (`hosting/convex-app/convex/seed.ts:12-18`), and those seeds are empty.
- Offline or PWA access to gated pages. The installed app still launches, but it needs a network.
- Rewriting or backfilling historical `updatedBy` and `events.author` names (see section 6).
- MFA, custom roles, or the Clerk Pro or B2B plans. The Hobby plan is accepted if its caps fit (P0 records them; see Q12).
- In-app invite UI. Invites are sent from the Clerk Dashboard.
- Changes to the legacy redirect Worker (`hosting/legacy-redirect/src/index.ts:19-47`). Its target now leads to sign-in, and `redirect_url` is preserved.
- Changes to which team-only fields the SOP pages show (SITE.md:248). See Q10.

---

## 2. User journeys, old vs new

| Journey | Old (today) | New |
|---|---|---|
| **J1. ZYT staff sign in and switch company** | Open `/`. The switcher lists every client (`index.html:~940-1031`). No identity. | Open `/`. The Worker sends a signed-out user to `/sign-in/?redirect_url=/`, where they sign in with Clerk (org `zyt`). They land on `/`, and the Worker serves `/_hub/zyt/` (all companies, as today). The switcher, Resources tab and Run panel work as before, and the header shows a user button. |
| **J2. A client (NCT) user is invited, signs in and sees only NCT** | Someone sends them the link. They see every company. | Wilfred invites them to org `nct` (J7). The email link opens the Account Portal. They sign up and are sent to `https://admin.zhiyuantech.ai/`. The Worker serves `/_hub/nct/`: no switcher entries for other companies, no Resources tab, no Run panel. NCT pages, the Overview iframe, downloads and `nct-*` recordings all load. |
| **J3. A client opens another company's URL, download or data** | Everything loads. | Pages, downloads and recordings (Phase 1): a JWA user opening `/nct/steps-1-3-runbook/`, `/nct/downloads/all-plans.zip`, `/golden-paths/nct-intake-steps-1-3.json`, `/zyt/commands/`, `/_hub/nct/` or an encoded variant such as `/jwa/..%2Fnct/…` gets the 404 page (status 404, `Cache-Control: private, no-store`). `/?company=nct` falls back to their own company (`setCompany` falls back to `CLIENTS[0]`, which is now `jwa`). Dashboard data (Phase 2): a JWA token calling Convex `board` or `setState` for `nct` gets "No access to this project." |
| **J4. Ticking a step** | The user types a name in "Who's ticking?". It is stored in localStorage `zyt.author` and sent as `author` (`index.html:2428`). The server stores `updatedBy=name`. | No name prompt. The hub calls `client.setAuth(...)` with the Clerk token, and `setState` takes `{projectKey, key, state}`. The server writes `updatedBy` (Clerk display name), `updatedByUserId` (Clerk `sub`) and `events.author` / `authorUserId`. The row shows "✓ First Last", and My tasks matches on the user's `assignee` claim. |
| **J5. Signed-out visitor, or a session that has gone stale** | Sees everything. | Any gated navigation with no session returns a 302 to `/sign-in/?redirect_url=<path>`. A navigation whose token expired while `__client_uat` is set gets Clerk's handshake (307 to the FAPI and back). A gated iframe (`?embed=1` or `Sec-Fetch-Dest: iframe`) never handshakes: the Worker strips `Sec-Fetch-Dest` before `authenticateRequest`, so a stale frame gets a small 401 page ("Session ended, reload the dashboard"). A gated fetch, video or zip request gets a 401. Public paths still work: `/sign-in/`, `/404`, icons, manifest, `sw.js`. A direct call to Convex `board` or `setState` throws "Sign in required" once `AUTH_ENFORCE=1`. |
| **J6. Sign-out on a shared device (PWA)** | There is no sign-out. The SW cache holds every page, including `/` with all companies' seed, and serves it offline to anyone. | The user signs out from the user button. The page posts `{type:'purge'}` to the SW, which deletes every `zyt-admin-*` cache, then `Clerk.signOut({redirectUrl:'/sign-in/'})` runs. The next user gets nothing from cache: gated pages were never cached, and the new build's `activate` deletes the old all-company caches. Offline, a gated navigation shows the browser's offline error, not stale content. An old `__session` copied before sign-out stops working at the Worker and at Convex within about 60 s. |
| **J7. Wilfred invites or removes a user** | Nothing to do. Anyone with the link has access. | **Invite:** Clerk Dashboard, Organizations, `<co>`, Invite (role Member), with `public_metadata.assignee` set at invite time (for example `"Wilfred"`). **Remove:** Dashboard, remove the membership, then revoke the user's sessions. The next gated request has no `o` claim, which sends the user to `/sign-in/`. There, org creation is disabled, so the user has no route back in. Without revoking sessions, access lasts at most about 60 s (the token lifetime). |

---

## 3. Architecture

### 3.1 Route to company map (pure module `hosting/site/access-map.ts`)

`canonicalPath(rawPathname) → string | null` and `companyFor(canonicalPath) → 'public' | 'any' | 'nct' | 'jwa' | 'harper' | 'zyt'`

`canonicalPath` runs `decodeURIComponent` on the pathname. It returns `null` (the Worker answers 400, no-store) if decoding throws, or if the decoded path contains `\`, a `..` or `.` segment, `//`, or a control character. The Worker classifies the canonical path and passes **that** path (plus the original search) to ASSETS, so what is checked is exactly what is served.

| Path (canonical) | Result |
|---|---|
| `/sign-in/*`, `/404`, `/404.html`, `/favicon.ico`, `/favicon.svg`, `/brand/*`, `/icons/*`, `/manifest.webmanifest`, `/sw.js` | `public` (passed through, no auth) |
| `/`, `/index.html` | `any` signed-in member. The Worker rewrites to `/_hub/<orgSlug>/`. |
| `/_hub/<co>` or `/_hub/<co>/*` | `<co>` |
| `/nct` or `/nct/*` (including `/nct/downloads/*.zip` and `/nct/customer-intake-sop/shots/*`) | `nct` |
| `/jwa`, `/jwa/*` | `jwa` |
| `/harper`, `/harper/*` | `harper` |
| `/zyt`, `/zyt/*` | `zyt` |
| `/golden-paths/<p>-<rest>` where `<rest>` has no `/` | `<p>` if it is in {nct, jwa, harper}, otherwise `zyt` |
| anything else (including `/NCT/`, `/nctx/`, `/_auth/whoami`) | `zyt` (default deny) |

The request is allowed when `orgSlug === 'zyt' || orgSlug === company || company === 'any'`. Any other signed-in user gets the 404 page. `/_auth/whoami` is a Worker-handled route (zyt only) that returns the `toAuth()` claims as JSON, used by the canary and by `check-gate.mjs`.

### 3.2 Worker flow (`hosting/site/worker.ts`, replacing `worker.js`)

```
fetch(req, env):
  p = canonicalPath(url.pathname); if p === null → 400 no-store
  c = companyFor(p); if c === 'public' → env.ASSETS.fetch(reqFor(p))
  if env.MAINTENANCE === '1' → 503 inline maintenance page, no-store
  if !env.CLERK_SECRET_KEY || !env.CLERK_PUBLISHABLE_KEY → 503 no-store          (fail closed, as worker.js did)
  if keyEnv(sk) !== keyEnv(pk) (sk_test/pk_test vs sk_live/pk_live) → 503 no-store  (mixed keys)
  if env.BREAKGLASS_PASSPHRASE && basicAuthMatches(req) → orgSlug = 'zyt', skip Clerk   (constant-time compare from worker.js)
  kind = isIframe(req) ? 'frame' : isDocumentNav(req) ? 'nav' : 'sub'    // Sec-Fetch-Dest/Mode, ?embed=1
  authReq = kind === 'frame' ? clone(req) without sec-fetch-dest, with accept: application/json : req
  rs = createClerkClient({secretKey, publishableKey}).authenticateRequest(authReq,
         { authorizedParties: env.AUTHORIZED_PARTIES.split(','), jwtKey: env.CLERK_JWT_KEY })
  if rs.headers.get('location') → 307 with rs.headers                            (handshake: nav only in practice)
  if rs.status === 'handshake' → 500 no-store
  if !rs.isAuthenticated or no orgSlug:
      nav   → 302 /sign-in/?redirect_url=<p+search>  (built from the canonical path, so always same-origin)
      frame → 401 small inline HTML "Session ended — reload the dashboard"
      sub   → 401 text
  if p === '/_auth/whoami' and orgSlug === 'zyt' → 200 JSON of toAuth() claims, no-store
  if !(orgSlug==='zyt' || orgSlug===c || c==='any') → ASSETS('/__denied__') → re-wrap body+404 with no-store
  target = c==='any' ? reqFor(`/_hub/${orgSlug}/`) : reqFor(p)
  res = env.ASSETS.fetch(target)   (Range headers pass through for mp4)
  copy rs.headers (Set-Cookie); set Cache-Control: private, no-store; Vary: Cookie; X-Robots-Tag: noindex
```

- `wrangler.jsonc` sets `"main": "./worker.ts"`, `assets.binding: "ASSETS"` and `assets.run_worker_first: true`. `not_found_handling` and `html_handling` are kept. Add `compatibility_flags: ["nodejs_compat"]` only if the P0 spike shows `@clerk/backend` needs it. An `env.canary` block gives `name: "zyt-admin-canary"`, route `canary.admin.zhiyuantech.ai` (custom domain) and its own `AUTHORIZED_PARTIES`.
- **Handshakes.** `@clerk/backend` treats both `Sec-Fetch-Dest: document` and `iframe` as eligible for a handshake. The iframe case is deliberately removed by stripping the header (above): a handshake inside the Overview iframe would bounce to a cross-site FAPI where third-party cookies may be blocked, and could fail or loop. The frame shows the 401 "reload" page instead. Script fetches, `<video>` range requests and zips get no handshake. They still work in practice because every gated page loads clerk-js, which refreshes `__session` every 50 s. When the hub's runbook fetch gets a 401, it calls `await Clerk.session.getToken()` and retries once.

### 3.3 Convex

- `convex/auth.config.ts`: `{ providers: [{ domain: process.env.CLERK_FRONTEND_API_URL!, applicationID: "convex" }] }`. Wilfred turns on Clerk Dashboard, Integrations, Convex, which sets `aud=convex` in the session token.
- Custom session claims (Clerk Dashboard, Sessions, Customize session token), kept flat and well under 1.2 KB: `{"org_slug":"{{org.slug}}","assignee":"{{user.public_metadata.assignee}}","name":"{{user.full_name}}"}`. The P0 spike confirms the shortcodes resolve, that Convex's `getUserIdentity()` exposes them as `identity.org_slug` and so on, and what `name` renders as for a user with no last name. The fallback is a `convex` JWT template with the same claims plus `getToken({template:'convex'})`.
- `convex/access.ts`:
  ```ts
  export async function requireCompany(ctx, projectKey): Promise<Actor | null>
  // identity = await ctx.auth.getUserIdentity()
  // if (!identity) { if (process.env.AUTH_ENFORCE === "1") throw new ConvexError("Sign in required."); return null; }  // legacy
  // slug = identity.org_slug; if (slug !== "zyt" && slug !== projectKey) throw new ConvexError("No access to this project.");
  // name = (identity.name || "").trim() || (identity.assignee || "").trim() || "Unnamed user"   // never the email
  // return { userId: identity.subject, name }
  ```
  Every user gets a full name set when invited (P0, P4 step 1b), so the fallbacks are rare.
- `findings:board` calls `requireCompany` first and also returns `updatedByUserId` and `authorUserId`.
- `findings:setState` has args `{projectKey, key, state, author: v.optional(v.string())}`. With an actor, it writes the name and userId from the identity and ignores `author`. Without one (legacy, only while `AUTH_ENFORCE` is unset), it keeps the existing 1-40 character name rule. This keeps today's public hub working against the new functions.
- New public `findings:missingKeys({projectKey, keys: string[]}) → string[]` (maximum 1000 keys, no auth). It takes the key list the caller already has and returns the missing ones, which is all the preflight needs. It replaces the anonymous `board` call in `hosting/deploy-site.ps1:389-421`, so the deploy script needs no Convex credentials. If a deployment answers "Could not find public function" for `missingKeys` (functions not yet deployed there), the preflight falls back to the anonymous `board` call, which works while `AUTH_ENFORCE` is unset.

### 3.4 Service worker (`hosting/pwa/sw.js`)

- `PRECACHE` becomes the public shell only: `/manifest.webmanifest`, `/icons/icon-192.png`, `/icons/icon-512.png`, `/brand/logo-light-72.png`, `/brand/logo-dark-72.png`, `/favicon.svg`, `/404` (not `/404.html`, which 307s). `PAGES` and `__SHOTS__` are removed.
- **Build guard kept and changed:** `deploy-site.ps1` (replacing the PAGES check at lines 463-472) asserts that every `PRECACHE` path exists under `public/` and that `companyFor(path) === 'public'`, by calling `node hosting/site/access-map-cli.mjs <paths…>`. A gated or missing entry would fail `addAll`, and a failed install leaves visitors on the old all-company cache. `access-map.test.ts` asserts the same for the PRECACHE list it reads from `sw.js`.
- Navigations are network-only, with no `cache.put`, and no offline fallback to a cached `/`. `/sign-in/` is never cached.
- Same-origin stale-while-revalidate is limited to the public-shell prefixes. Anything under `/nct/`, `/jwa/`, `/harper/`, `/zyt/`, `/_hub/` or `/golden-paths/` is passed straight to the network. Fonts and the jsDelivr Convex bundle keep stale-while-revalidate. The Clerk FAPI is cross-origin and already ignored.
- A `message` of `{type:'purge'}` deletes every `zyt-admin-*` cache. A new `__BUILD__` makes `activate` delete the old caches that hold all-company HTML (`sw.js:18-24`).

### 3.5 Config and secrets per environment

| Item | Dev (Clerk dev instance, Convex `small-snail-912`) | Prod (Clerk prod instance, Convex `impartial-sockeye-436`) | Where it lives |
|---|---|---|---|
| Publishable key and FAPI host | `pk_test_…`, `<x>.clerk.accounts.dev` | `pk_live_…`, `clerk.admin.zhiyuantech.ai` | `hosting/site/clerk.json` `{dev:{…},prod:{…}}` (not secret, checked in; `prod` stays empty until P4). The build injects them into pages as `{{CLERK_PUBLISHABLE_KEY}}` / `{{CLERK_FAPI}}`. The Worker gets the prod key from `deploy-site.ps1` as `wrangler deploy --var CLERK_PUBLISHABLE_KEY:<pk>`, so it is never kept in two places. |
| Worker `CLERK_PUBLISHABLE_KEY` under `wrangler dev` | `pk_test_…` in `hosting/site/.dev.vars` | (from `clerk.json` via `--var`) | `.dev.vars` is already gitignored (`.gitignore:23`) |
| `CLERK_SECRET_KEY` (and optionally `CLERK_JWT_KEY`) | `hosting/site/.dev.vars` | `npx wrangler secret put` in account `a9c786e2…`, once for the main Worker and once with `--env canary` (**Wilfred**) | Never in the repo |
| `AUTHORIZED_PARTIES` | `http://localhost:8787,http://127.0.0.1:8787` (`.dev.vars`) | `https://admin.zhiyuantech.ai`; canary: `https://canary.admin.zhiyuantech.ai` (wrangler `vars`) | |
| `MAINTENANCE`, `BREAKGLASS_PASSPHRASE` | unset | unset; set only during an incident (**Wilfred**) | `wrangler secret` |
| Convex `CLERK_FRONTEND_API_URL` | `npx convex env set` (agent, dev) | `npx convex env set --prod` (**Wilfred**) | Convex env |
| Convex `AUTH_ENFORCE` | `1` only while P2 gate commands run, then removed until the branch merges | unset at deploy, set to `1` in the cutover sitting (**Wilfred**) | Convex env |

`deploy-site.ps1` changes (all in Phase 1 unless noted):
- New `-ClerkEnv dev|prod`. `-DryRun` implies `dev`. `-ClerkEnv dev` without `-DryRun` throws.
- `-DryRun` (or `-ClerkEnv dev`) defaults `$ConvexUrl` to `deployment.json` **`devUrl`**; a real deploy keeps defaulting to `prodUrl` (`deploy-site.ps1:75-79`). After the build, a DryRun asserts that no file under `public/` contains `impartial-sockeye`.
- New `-StrictPreflight`: preflight problems throw even under `-DryRun` (today they only warn, lines 404-418).
- **Prod guard:** a non-DryRun deploy throws before `wrangler deploy` unless `clerk.json` `prod.publishableKey` starts with `pk_live_` **and** `npx wrangler secret list` (for the target env) lists `CLERK_SECRET_KEY`. The message says why.
- New `-Canary`: builds with prod Clerk and prod Convex, deploys with `--env canary`, and runs the post-deploy check against the canary host.
- **Post-deploy assertion:** after `wrangler deploy`, an anonymous `GET /nct/customer-intake-sop/` and `GET /nct/downloads/all-plans.zip` must return 302 and 401. Anything else throws loudly ("SITE IS PUBLIC"). After cutover it also calls anonymous `findings:board` on prod Convex and warns if it succeeds ("AUTH_ENFORCE is off").
- **Leak check** in the per-org hub loop: each client variant (`nct`, `jwa`, `harper`) must not match `"key":"<k>"` or `"/<k>/` for any other key including `zyt`; `_hub/zyt/index.html` must match all four keys. A failure throws, so every future deploy repeats the check.

---

## 4. Phases

Phases 1-3 run on branch `feat/clerk-auth` (worktree `C:/Project/ZYT-Task-clerk`, D14) against the Clerk **dev** instance, the local `wrangler dev` and Convex **dev** (`small-snail-912`). Nothing reaches prod until Phase 4. Every local server command is `npx --yes wrangler@4.131.2 dev --local --port 8787` from `hosting/site` (the same pinned version the deploy uses). Every local build is `powershell -File hosting/deploy-site.ps1 -DryRun -StrictPreflight` (dev Convex by default after the Phase 1 change; until that change lands, pass `-ConvexUrl https://small-snail-912.eu-west-1.convex.cloud`).

Signing in means entering credentials, which the agent never does. **Wilfred signs in each test user once in the in-app browser**; after that, `check-gate.mjs` mints fresh tokens from those sessions through the Clerk Backend API (P0 settles the method), so the HTTP-boundary checks are scripted and repeatable. The agent drives browser checks inside sessions Wilfred has opened.

**`hosting/site/check-gate.mjs <baseUrl> [--convex <url>] [--save-jar f | --use-jar f]`** (built in Phase 1, extended in 2-3) is the main gate. It reads `CLERK_SECRET_KEY` and `CHECK_GATE_USERS=nct:user_…,jwa:user_…,zyt:user_…` from the environment, finds each user's active session (`GET /v1/sessions?user_id=…&status=active`), mints a token (`POST /v1/sessions/{id}/tokens`), checks the decoded `o.slg` matches the expected org, and sends `Cookie: __session=<jwt>; __client_uat=<now>`. It runs a table of user (anon, nct, jwa, zyt, expired) × path, each with the right `Sec-Fetch-*` headers, and asserts status, `Location`, `Cache-Control: private, no-store` and `Vary: Cookie` on gated responses. For `/` it asserts the body contains only the user's `"key":"<org>"` (zyt: all four). It exits non-zero on any mismatch and prints the table. Paths: every row of 3.1, `/nct/downloads/all-plans.zip`, one `/nct/customer-intake-sop/shots/*.jpg`, `/golden-paths/nct-intake-steps-1-3-0.mp4` with `Range: bytes=0-1` (206 when allowed), `/_hub/<other>/`, `/index.html`, `/?company=nct`, `/foo`, `/nctx/`, `/NCT/`, `/nct` (no slash), `/jwa/..%2Fnct/customer-intake-sop/`, `/golden-paths/nct-x%2F..%2F..%2Fjwa%2Ffull-chain-sop%2F`, `/%5Cnct/`, `//nct/`, `/404`, and `/golden-paths/nct-intake-steps-1-3.json` as jwa (404 with the 404 body, never 307). The **expired** column uses a token minted with a short `expires_in_seconds` (or waits 70 s if the API refuses): nav → 307 to the FAPI or 302 to sign-in; frame (`Sec-Fetch-Dest: iframe`, `?embed=1`) → 401 with the inline page; fetch, zip, mp4 → 401 no-store. With `--convex`, it also calls `findings:board` over HTTP with each bearer token (own project → success, other project → "No access to this project.", anonymous → "Sign in required." when enforcing).

### Phase 0: Clerk setup and spike (explicit exception: Phase 1 entry criteria, no user-facing journey)

This phase only exists so Phase 1 can be tested at all; it is kept separate because it is mostly Wilfred's Dashboard work.

**Wilfred does:**
1. Create the Clerk app (dev instance). Organizations: on, *Membership required*, "allow users to create orgs" off, member limit raised to 20. Create the orgs `zyt`, `nct`, `jwa` and `harper` (slug equals key).
2. Turn on Integrations, Convex. Add the custom session claims from section 3.3.
3. Create test users with full names (and one with no last name): `staff+clerk_test@…` in `zyt`, `nct+clerk_test@…` in `nct` (with `public_metadata.assignee` set to a real seed assignee) and `jwa+clerk_test@…` in `jwa`. Put `sk_test` and `pk_test` in `hosting/site/.dev.vars` and send the agent the `pk_test`, FAPI host and the three user IDs. Sign in once as each test user in the in-app browser.
4. **Start DNS now** (it has lead time). Ask Ngchwanlii, who owns the `zhiyuantech.ai` zone (`wrangler.jsonc:2-3`, SITE.md:157-159), to add the records shown on the Clerk prod Domains page, each set to DNS only (grey cloud). Also check that no CAA record blocks LetsEncrypt or Google Trust Services.
5. Read the Hobby plan limits on the Clerk pricing page: members per org, monthly active orgs, and whether *Membership required* and session tasks are available on Hobby. Give the agent the headcount per org you expect to invite.

**Agent does (spike, throwaway, in the scratchpad):** a minimal Worker using `@clerk/backend@3` under the pinned `wrangler dev --local` that returns `toAuth()` as JSON. One `findings:whoami` dev-only query that returns `ctx.auth.getUserIdentity()`, removed after the spike. A draft of the token-minting part of `check-gate.mjs`.

**Gate (recorded in `_plan/09-23_clerk-auth/plan/spike.md`):**
- A script mints `__session` for each test user from its active session, and `curl -b <jar> http://localhost:8787/` on the spike Worker shows `orgSlug` matching the user (nct, jwa, zyt). Record whether an API-minted token carries `o.slg`, and whether `expires_in_seconds` is honoured.
- Whether `nodejs_compat` is needed.
- `whoami` (through the hub's real token) shows `org_slug`, `assignee` and `name` as flat fields; what `name` is for the no-last-name user.
- `npx convex run findings:whoami --identity '{"subject":"x","org_slug":"nct"}'` echoes `org_slug`. If it does not, the Phase 2 `--identity` checks are replaced by the `check-gate.mjs --convex` bearer checks.
- Whether the `ui: {ClerkUI: window.__internal_ClerkUICtor}` load option is required, and whether a single-org user is auto-activated after sign-in or sees the choose-organization task.
- Hobby caps next to the planned headcount. If a cap is too low, Wilfred decides on Pro before P4 (Q12).

### Phase 1: edge gate and per-org dashboard (J1, J2 view-only, J3 for pages, downloads and recordings, J5)

Dashboard **data** is still readable anonymously through Convex in this phase; that part of J3 closes in Phase 2.

Build: `access-map.ts` (with `canonicalPath`) and tests, `access-map-cli.mjs`, `worker.ts` (including 400, 503 mixed-key, maintenance, break-glass, `/_auth/whoami`, iframe header strip, `/__denied__` 404), `wrangler.jsonc` (with `env.canary`), `@clerk/backend` in `hosting/package.json`, the `/sign-in/` page with `hosting/hub/safe-redirect.js` and its test, `clerk.json` (dev values), per-org hub variants (`build-seed.mjs --only <co>`; zyt keeps the full seed) with the leak check, `public/index.html` no longer written, clerk-js in `$pwaHead` / `Get-SopHtml`, Resources tab hidden when `SEED.projects` has no `zyt`, the service worker policy (section 3.4, without purge) with its build guard, all `deploy-site.ps1` changes in 3.5 except the `missingKeys` preflight, and `check-gate.mjs`. Ticking still uses the typed name, because Convex is unchanged in this phase.

**Gate:**
1. `node --experimental-strip-types --test hosting/site/access-map.test.ts` passes. It covers every row of 3.1, `/golden-paths/nct-intake-steps-1-3-0.mp4 → nct`, `/golden-paths/foo.json → zyt`, `/_hub/jwa/ → jwa`, `/404 → public`, `/nctx/ → zyt`, `/NCT/ → zyt`, `/nct → nct`, and `canonicalPath` → `null` for `/jwa/..%2Fnct/`, `/%2e%2e%2fnct/`, `/%5Cnct/`, `//nct/`, `/golden-paths/nct-x%2F..%2F..%2Fjwa%2F`, `/%E0%A4%A`. It also asserts every sw.js PRECACHE entry is `public`.
2. `node --test hosting/hub/safe-redirect.test.mjs` passes: `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)` and `` (empty) all become `/`; `/nct/customer-intake-sop/?embed=1` is kept.
3. `powershell -File hosting/deploy-site.ps1 -DryRun -StrictPreflight` succeeds (the leak check and SW guard run inside it). Then: `Test-Path hosting/site/public/index.html` is `False`; `Select-String -Path hosting/site/public -Pattern impartial-sockeye -Recurse` (via `Get-ChildItem -Recurse | Select-String`) returns nothing.
4. **Deploy guard:** `powershell -File hosting/deploy-site.ps1` (no DryRun) throws "no prod Clerk key" **before** `wrangler deploy`, and `-ClerkEnv dev` without `-DryRun` throws.
5. With the pinned `wrangler dev` running: `node hosting/site/check-gate.mjs http://localhost:8787` exits 0 (all columns, including expired). Then, with `CLERK_SECRET_KEY` removed from `.dev.vars`, gated paths return 503; with `CLERK_PUBLISHABLE_KEY` set to a `pk_live_x` value, gated paths return 503 (mixed keys); with `MAINTENANCE=1` in `.dev.vars`, gated paths return the maintenance page.
6. **SW upgrade from today's SW:** in the main worktree build and serve today's site on port 8787 (`-DryRun -ConvexUrl <devUrl>`), visit `/` so the old SW caches everything; stop it. Build and serve the branch on 8787 and reload, signed out. In DevTools: the new SW reaches *activated*; `await caches.keys()` holds only the new `zyt-admin-<build>`; its entries are only shell URLs; `/` is in no cache; offline navigation to `/` does not return the old all-company HTML.
7. Browser (Wilfred signs in; runner started with `RUNNER_EXTRA_ORIGINS=http://localhost:8787 node hosting/runner/server.mjs`):
   - As the jwa user: `/` shows JWA only. `/nct/steps-1-3-runbook/` shows the 404 page. The Overview iframe renders and follows the theme.
   - As staff: all companies, the switcher, Resources, Overview, a runbook task view, the Run panel, and an `nct-*` video with seeking (Range requests) all work.
   - Signed out, opening `/nct/customer-intake-sop/` leads to sign-in and back to the same page. `/sign-in/?redirect_url=https://example.com` leads to `/` after sign-in.
   - Stale iframe: open the Overview, block the FAPI host in DevTools request blocking, wait more than 60 s, reload only the iframe: it shows the "reload" page, not a sign-in form or a loop.

### Phase 2: ticks record the real user, dashboard data gated (J4, J2 complete, J3 for data)

Build: `auth.config.ts`, `access.ts`, schema fields, `board`, `setState`, `missingKeys`. In the hub: `Clerk.load()` then `setAuth`, removal of the name dialog (`index.html:722-732`), `#who` and `zyt.author`, My tasks by `assignee` claim, updatedBy/userId matching, the old-ticks import running under the Clerk user (nct org only), a 401 retry on runbook fetches, and the preflight switched to `missingKeys` with the `board` fallback. `check-gate.mjs --convex`.

Note: `npx convex dev --once` from the branch pushes to the shared dev deployment. The new functions are backward compatible with `main`'s hub (optional `author`, anonymous `board` while `AUTH_ENFORCE` is unset), so other sessions' previews keep working. If another session pushes `main`'s functions over them, re-run it before the gate.

**Gate:**
1. `cd hosting/convex-app; npx convex env set CLERK_FRONTEND_API_URL https://<dev-fapi>; npx convex dev --once` passes (dev deployment only). `npm run typecheck` passes.
2. `--identity` checks (valid only if P0 confirmed custom fields pass through):
   - `npx convex run findings:setState '{"projectKey":"nct","key":"<k>","state":"done"}' --identity '{"subject":"u_jwa","org_slug":"jwa","name":"J"}'` fails with "No access to this project."
   - `npx convex run findings:board '{"projectKey":"nct"}' --identity '{"subject":"u_jwa","org_slug":"jwa","name":"J"}'` fails with "No access to this project."
   - The `setState` with `"org_slug":"nct"` succeeds, and `board` with the nct identity shows `updatedBy:"<name>"` and `updatedByUserId:"u_nct"`. Untick it again.
3. `npx convex env set AUTH_ENFORCE 1`, then: anonymous `npx convex run findings:board '{"projectKey":"nct"}'` throws "Sign in required."; `node hosting/site/check-gate.mjs http://localhost:8787 --convex https://small-snail-912.eu-west-1.convex.cloud` exits 0 (real Clerk tokens against `auth.config.ts`: nct → success, jwa → "No access", anonymous → "Sign in required").
4. `powershell -File hosting/deploy-site.ps1 -DryRun -StrictPreflight 3>&1 | Tee-Object -Variable out`; `$out | Select-String 'seed rows: nct all \d+ keys present on https://small-snail-912'` matches and `$out | Select-String 'WARNING'` does not.
5. Browser as the nct user: tick a step. There is no name prompt, the row shows "✓ <Clerk name>", and it persists after a reload. My tasks lists the steps assigned to that user. Untick works. Edge case, as the jwa user in the console: `const c=new convex.ConvexClient('https://small-snail-912.eu-west-1.convex.cloud'); c.setAuth(()=>Clerk.session.getToken()); await c.mutation(convex.anyApi.findings.setState,{projectKey:'nct',key:'<k>',state:'done'})` rejects with ConvexError "No access to this project."
6. `npx convex env remove AUTH_ENFORCE` (dev stays non-enforcing until the branch merges, so `main`'s previews keep ticking).

### Phase 3: sign-out, shared device and user admin (J6, J7)

Build: a user button (`Clerk.mountUserButton`, clerk-js + `@clerk/ui` loaded on the hub and every SOP page) in the hub header next to `#theme-btn` (`index.html:617-640`) and in `$backBar` (`deploy-site.ps1:131-142`, hidden in `.zyt-embed`). The sign-out path posts `{type:'purge'}` to the SW, then calls `Clerk.signOut`. The SW `message` handler purges. The golden-path Run panel is hidden by default and revealed only after `Clerk.load()` resolves with org `zyt`.

**Gate:**
1. **J6 server side:** `node check-gate.mjs http://localhost:8787 --save-jar jar.json` (as staff). Wilfred signs out in the browser. Wait 70 s. `node check-gate.mjs http://localhost:8787 --use-jar jar.json` shows a page nav → 302 or 307, the zip → 401, and the Convex bearer `board` → "Sign in required" or an auth error (with `AUTH_ENFORCE 1` set on dev for this check only, then removed).
2. **J6 browser:** after sign-out, DevTools, Application, Cache Storage: no `zyt-admin-*` cache has entries other than the shell. With DevTools Offline, a reload of `/nct/customer-intake-sop/` shows the browser offline page, not content. Back online, it goes to sign-in.
3. Installed PWA (in the in-app browser, Application, Manifest, Install): it launches at `/`, which leads to sign-in and then the dashboard.
4. **J7:** save a jar as the nct user. Wilfred removes the nct test user from `nct` and revokes their sessions. Wait 70 s. The saved jar gets 302/401 at the Worker and "No access"/"Sign in required" at Convex; the next browser navigation goes to `/sign-in/`, and the choose-organization step offers no "create". Re-invite the user and confirm the invite email lands on the Account Portal, then on the dashboard.
5. As the jwa user, the Run panel never appears (not even briefly on load), and recordings of `jwa-*` jobs still play.
6. `node check-gate.mjs http://localhost:8787` still exits 0 (regression).

### Phase 4: production cutover (all journeys on admin.zhiyuantech.ai)

Order matters. Every step marked **Wilfred does** is his alone. Agents never run a prod Convex deploy, a prod env change or a prod seed. Steps 5-8 happen in one sitting at an announced time.

1. **Wilfred does:** create the Clerk production instance (Secondary, `admin.zhiyuantech.ai`), recreate the orgs, org settings, custom claims and Convex integration, and confirm the DNS from P0 verifies. Set the Account Portal's after-sign-in and after-sign-up URL to `https://admin.zhiyuantech.ai/`, and allow FAPI origins `https://admin.zhiyuantech.ai` and `https://canary.admin.zhiyuantech.ai`. Invite the staff. Give the agent `pk_live` and the FAPI host; the agent commits them to `clerk.json` `prod` on the branch.
   - **1b. Clients (Wilfred does):** in the prod Convex dashboard, list the distinct `events.author` per `projectKey`; map each person to an email; invite them to their org with a full name and `public_metadata.assignee` set at invite time; tell each client the cutover time. Also invite one ZYT-controlled mailbox (not `+clerk_test`; test mode is off in prod) into `nct` and `jwa` for the checks, and sign in as each once.
   - **Gate 1:** every client org with live users shows at least one accepted member in the Dashboard, and every typed name in use is accounted for.
2. **Wilfred does:** from the branch worktree, `npx convex env set --prod CLERK_FRONTEND_API_URL https://clerk.admin.zhiyuantech.ai`, then `npx convex deploy -y`. Leave `AUTH_ENFORCE` unset: the live public site keeps working in legacy mode (optional `author`, anonymous `board`). Until the merge, prod Convex deploys are made only from the branch.
3. **Wilfred does:** in `hosting/site`, `npx wrangler secret put CLERK_SECRET_KEY` and `npx wrangler secret put CLERK_SECRET_KEY --env canary` (and `CLERK_JWT_KEY` for both). Also `npx wrangler secret delete DOWNLOADS_PASSPHRASE` if it exists.
4. **Canary (agent, with Wilfred's go):** `powershell -File hosting/deploy-site.ps1 -Canary` from the branch. Then Wilfred, with `CLERK_SECRET_KEY=sk_live…` and `CHECK_GATE_USERS` (prod IDs) in his own shell, runs `node hosting/site/check-gate.mjs https://canary.admin.zhiyuantech.ai --convex https://impartial-sockeye-436.eu-west-1.convex.cloud` (Convex column: own project success, other project "No access"; the anonymous column is skipped while not enforcing). Wilfred also opens `https://canary.admin.zhiyuantech.ai/_auth/whoami` (shows `orgSlug: zyt`) and makes one tick and untick as staff on the canary hub; `board` shows his Clerk name and userId.
   - **Gate 4:** the matrix exits 0 on the canary. If `pk_live` is refused on the canary subdomain (settled here, not testable earlier), skip the canary and make step 5 the test, with the step 7 rollback ready.
5. Record the live version: `npx wrangler deployments list` in `hosting/site`; note the current version ID in `spike.md` as the rollback point.
6. Agent: merge `main` into the branch, re-run the Phase 1 local gate, then merge the branch into `main`. Before this, rebase or retire every other worktree and branch that touches `hosting/` (today: `C:/Project/ZYT-Task-rbtasks` on `feat/rbtasks-phase-4`, and `feat/header-projects`, `feat/rbtasks-phase-1..3`), so none can deploy the old public site later.
7. Agent or Wilfred: `powershell -File hosting/deploy-site.ps1` (prod). The post-deploy assertion must pass. Wilfred runs `node hosting/site/check-gate.mjs https://admin.zhiyuantech.ai --convex https://impartial-sockeye-436.eu-west-1.convex.cloud`: exit 0.
8. **Wilfred does, immediately after 7:** `npx convex env set --prod AUTH_ENFORCE 1`. Then re-run the step 7 `check-gate.mjs` (the anonymous Convex column now expects "Sign in required") and the closing check `curl -s https://impartial-sockeye-436.eu-west-1.convex.cloud/api/query -H 'content-type: application/json' -d '{"path":"findings:board","args":{"projectKey":"nct"},"format":"json"}'` → the "Sign in required" error.
9. Agent: SITE.md, README and runner header edits (section 8), committed on `main`.
10. **Wilfred does (cleanup):** remove the check mailbox's memberships from client orgs (or delete that user) and confirm every org lists only real members; delete the canary Worker (`npx wrangler delete --env canary`) and its custom domain; approve the hourly gate check (a scheduled task that runs the anonymous half of `check-gate.mjs` against prod and alerts Wilfred on failure).

**Gate (numbered, expected result per line), run by Wilfred on prod after step 8:**
1. Signed out, `/` → sign-in page; sign in as staff → `/` shows all four companies, Resources and Run panel. (J1)
2. As a real NCT member: `/` shows only NCT; the Overview iframe, a download and an `nct-*` video play. (J2)
3. As the NCT member, `/jwa/full-chain-sop/` and `/nct/../zyt/commands/` → the 404 page. (J3; also covered by `check-gate.mjs`)
4. As the NCT member, tick and untick a step: no name prompt, the row shows their Clerk name. (J4)
5. `check-gate.mjs` against prod exits 0, including the expired column. (J5)
6. Sign out on a device with the installed PWA: Cache Storage holds only the shell; offline reload of an NCT page shows the offline error. (J6)
7. Remove and re-invite the check mailbox in `jwa`: after 70 s its saved jar is refused; the invite lands on the dashboard. (J7)
8. The legacy link `nct-customer-intake-sop.wilfred-c3a.workers.dev` goes to sign-in and back to `/nct/customer-intake-sop/`.

---

## 5. Files to change

| Path | Change | Phase |
|---|---|---|
| `hosting/site/access-map.ts` (new) | `canonicalPath` and `companyFor` holding the section 3.1 table | 1 |
| `hosting/site/access-map.test.ts` (new) | `node:test` table tests, including encoded-path and PRECACHE cases | 1 |
| `hosting/site/access-map-cli.mjs` (new) | Classifies paths for the deploy script's SW guard | 1 |
| `hosting/site/worker.ts` (new), `hosting/site/worker.js` (delete) | The Clerk gate from section 3.2, replacing the passphrase gate (`worker.js:1-67`) | 1 |
| `hosting/site/wrangler.jsonc` | `main`, `assets.binding`, `run_worker_first: true`, `vars.AUTHORIZED_PARTIES`, `env.canary`, maybe `nodejs_compat`. Rewrite the "whole site is public" comment (lines 13-22) | 1 |
| `hosting/site/.dev.vars` (new, already gitignored at `.gitignore:23`) | Dev secret, `pk_test`, dev parties | 1 |
| `hosting/site/clerk.json` (new) | Per-environment publishable key and FAPI host | 1 (prod values in 4) |
| `hosting/site/check-gate.mjs` (new) | The HTTP-boundary matrix (section 4) | 1 (`--convex` in 2, jars in 3) |
| `hosting/package.json` | `@clerk/backend@^3` | 1 |
| `hosting/hub/sign-in.html` (new), `hosting/hub/safe-redirect.js` + `safe-redirect.test.mjs` (new) | Loads clerk-js and ui from the FAPI and calls `mountSignIn` with `forceRedirectUrl` from the validated `redirect_url` | 1 |
| `hosting/hub/build-seed.mjs` | `--only <co>` filter (zyt means all) | 1 |
| `hosting/deploy-site.ps1` | `-ClerkEnv`, DryRun → dev Convex, `-StrictPreflight`, prod guard, `-Canary`, `--var CLERK_PUBLISHABLE_KEY`, post-deploy assertion, `{{CLERK_*}}` replacement; clerk-js in `$pwaHead` / `Get-SopHtml` (lines 135-175); per-org hub loop with leak check writing `public/_hub/<co>/index.html` instead of `public/index.html` (lines 423-429); `sign-in/index.html`; the SW shell and its new build guard (lines 455-473); header comment "PUBLIC: anyone…" | 1 |
| `hosting/deploy-site.ps1` | Preflight uses `findings:missingKeys` with the `board` fallback (lines 389-421); post-deploy anonymous-`board` warning | 2 |
| `hosting/deploy-site.ps1` | User button slot in `$backBar` (lines 131-142); clerk-js + `@clerk/ui` on SOP pages | 3 |
| `hosting/hub/index.html` | `<meta name="clerk-publishable-key">`, clerk-js keep-alive, Resources tab hidden when there is no `zyt` project (lines 617-640, 831-833) | 1 |
| `hosting/hub/index.html` | `Clerk.load()` before `new ConvexClient` / `setAuth` (lines 2525-2528); `setState` without `author` (lines 1743, 2428); remove `#name-dialog` (lines 722-732), `#who` (646, 2502), `askName` (2440-2461), `zyt.author` (866); `me` from the `assignee` claim (1086, 1108, 1961-1968); import banner under the Clerk user, nct only (1709-1786); 401 retry on runbook fetch | 2 |
| `hosting/hub/index.html` | User button and purge on sign-out (header lines 617-640) | 3 |
| `hosting/hub/sop-layout.js`, `hosting/hub/sop-layout.css` | Mount the user button, hide it in embed | 3 |
| `hosting/hub/golden-path.js` | Run controls hidden by default, revealed after `Clerk.load()` for `zyt` (recordings still shown) | 3 |
| `hosting/pwa/sw.js` | Shell-only precache (with `/404`), network-only for gated paths, no cached `/` fallback (lines 10-80) | 1 |
| `hosting/pwa/sw.js` | `message` purge handler | 3 |
| `hosting/convex-app/convex/auth.config.ts` (new) | Clerk provider | 2 |
| `hosting/convex-app/convex/access.ts` (new) | `requireCompany`, `AUTH_ENFORCE`, name fallback | 2 |
| `hosting/convex-app/convex/schema.ts` | `findings.updatedByUserId?`, `events.authorUserId?` (lines 10-30, additive) | 2 |
| `hosting/convex-app/convex/findings.ts` | `board` and `setState` through `requireCompany`, plus `missingKeys` (lines 8-54) | 2 |
| `hosting/SITE.md`, `README.md:19`, `hosting/runner/server.mjs` (header lines 10-17, comment at 251), `hosting/runner/publish-recordings.mjs` (header line 7) | See section 8 | 4 |

---

## 6. Data migration and rollback

### Migration (non-destructive, no backfill)
- The schema change only adds optional fields (`updatedByUserId`, `authorUserId`). Existing rows stay valid. `events.author` stays a required display name, and new rows fill it from the Clerk name.
- Historical typed names are shown as they are. The UI already renders `updatedBy` as text (`index.html:1251, 1635, 2109-2110`). Rows that have a userId are "real". Rows without one are legacy and get no extra label.
- The "done by me" match in My tasks accepts `updatedByUserId === Clerk.user.id` **or** the normalised `updatedBy === me` (the legacy first name). A user whose `assignee` equals their old typed name keeps their history.
- Old SW caches with all-company HTML are deleted by the new build's `activate` (checked by the Phase 1 upgrade test). The legacy localStorage tick import still works, now under the Clerk user.
- The Convex dev deploy is the agent's job. The prod deploy is Wilfred's. No migration script runs anywhere.

### Rollback per phase
| Phase | Rollback |
|---|---|
| 0 | Delete the spike folder and the `whoami` query. |
| 1-3 | On the branch only; nothing is live. Revert the branch commit. If dev Convex misbehaves, `npx convex env remove AUTH_ENFORCE`; the additive schema needs no rollback. |
| 4, before step 7 | Canary only: delete the canary Worker. Prod Convex: the new functions are backward compatible; leave them or have **Wilfred** redeploy `main`'s functions. |
| 4, after step 7 | **First choice, gate broken but Clerk fine:** `npx wrangler rollback <version>` to the previous gated version if one exists, else set `MAINTENANCE=1` (`npx wrangler secret put MAINTENANCE`) while the fix is made. **Clerk or FAPI outage:** **Wilfred** sets `BREAKGLASS_PASSPHRASE` for staff access, and `MAINTENANCE=1` if clients need a clear message. **Back to the public site** (`npx wrangler rollback <pre-cutover version from step 5>`, instant): this re-publishes every client's content and restores the old all-company SW, so it needs **Wilfred's explicit go**; he also sets `npx convex env set --prod AUTH_ENFORCE 0`. After any rollback, the next routine deploy from `main` re-ships the gate, so add a one-line "deploys paused" note at the top of SITE.md, and revert the merge commit if the fix takes more than an hour. The Clerk instance and DNS stay in place; they are harmless. |
| Convex only | **Wilfred:** `npx convex env set --prod AUTH_ENFORCE 0` lets anonymous ticks through again straight away. While it is 0, prod Convex is open to anyone who has the URL, so it is a short-lived measure; the post-deploy warning flags it on every deploy. |

---

## 7. Risks and open questions (each with a recommended answer)

1. **DNS is in Ngchwanlii's Cloudflare account (`wrangler.jsonc:2-3`), which blocks P4.** *Recommend:* Wilfred asks in P0 for the Clerk records, or for DNS-edit access, so the up-to-48 h wait overlaps P1-P3. The canary custom domain needs no request, because the Worker already lives in the zone's account.
2. **Primary or Secondary application?** *Recommend:* Secondary (`clerk.admin.zhiyuantech.ai`), which scopes cookies to the admin site. Read the exact records from the Dashboard.
3. **Staff in client orgs ("view as client")?** *Recommend:* no. One org per user (D2). If this is ever needed, add a `staff` claim from `public_metadata` and check that instead of `org_slug === 'zyt'`.
4. **Shape of the Convex identity claims is unverified.** *Recommend:* flat custom session claims, proved in the P0 spike. The fallback is a `convex` JWT template.
5. **`@clerk/backend` in workerd (does it need `nodejs_compat`?).** *Recommend:* settle it in the P0 spike. Enable the flag only if the spike needs it.
6. **Stale 60 s token on non-navigation requests (fetch, video, iframe).** *Recommend:* clerk-js loaded on every gated page keeps `__session` fresh; retry a hub fetch once after `getToken()`; iframes never handshake (header stripped, 3.2) and show the "reload" 401. Proved by the expired column and the Phase 1 stale-iframe browser step.
7. **`/zyt/commands/` and Resources for clients?** *Recommend:* zyt-only. Hidden for clients, and a 404 on direct access.
8. **Golden-path recordings: move under `/<co>/`?** *Recommend:* no. Map by filename prefix (D12), with unknown prefixes defaulting to zyt. Keep the "e2e orgs only" content rule in SITE.md anyway.
9. **Offline PWA for signed-in clients?** *Recommend:* no (D8). If it's wanted later, add caches keyed per user, purged on sign-out.
10. **Team-only fields (repairs, code locations, fix ledgers) on JWA and Harper SOP pages are visible to that client's users (SITE.md:248).** *Recommend:* keep the current decision for this plan and have Wilfred confirm per client. Hiding them is a separate change to how the pages are built.
11. **Deploy preflight once `board` needs auth.** *Recommend:* the public `missingKeys` (section 3.3), with the `board` fallback for deployments that don't have it yet.
12. **Hobby plan limits (members per org, active orgs, Membership required, 7-day re-login, no MFA, Clerk branding).** *Recommend:* accept Hobby if the P0 caps fit the headcount; otherwise move to Pro (about $20-25/mo) before P4.
13. **Invites land on the Account Portal, not the hub.** *Recommend:* set the Account Portal's after-sign-in and after-sign-up redirect to `https://admin.zhiyuantech.ai/`. The `accounts.` CNAME is part of the DNS set.
14. **Removed user keeps access until the token expires.** *Recommend:* revoke sessions as part of J7. Org creation is off, so the choose-organization task gives them no way back in.
15. **Copies outside the gate: the NCT SOP HTML is also a claude.ai artifact on another account (SITE.md:46-47).** *Recommend:* Wilfred decides whether to unshare or delete that artifact. This plan does not touch it.
16. **The legacy redirect Worker keeps its target.** *Recommend:* no change needed. Verified in the P4 gate, line 8.
17. **Harper bot-answers source path mismatch.** *Recommend:* out of scope. Fix it separately.
18. **Single-org users may still see the choose-organization task.** *Recommend:* settle it in the P0 spike. If they do, the `/sign-in/` page handles it, because the `taskUrls` default is fine.
19. **`main` moves fast while the branch lives (D14).** *Recommend:* merge `main` into `feat/clerk-auth` at least daily and before every gate; the hub (`index.html`) and `deploy-site.ps1` are the likely conflict files.
20. **Does `pk_live` work on `canary.admin.zhiyuantech.ai`?** *Recommend:* expect yes (subdomain of the production domain); settled at P4 step 4. If not, the cutover itself is the test, with rollback ready.
21. **Break-glass passphrase: preset or incident-only?** *Recommend:* incident-only. Wilfred sets `BREAKGLASS_PASSPHRASE` when Clerk is down and deletes it after, so no standing backdoor exists.
22. **Hourly prod gate check (scheduled task).** *Recommend:* yes, created in P4 step 10 with Wilfred's approval. It catches a stale worktree redeploying the public site.
23. **Staff tick shown to clients by name.** *Recommend:* acceptable (the Clerk full name, never the email).

---

## 8. SITE.md and header edits required (Phase 4)

| Line(s) | Edit |
|---|---|
| 29 | Downloads row: replace "Public, like every other page (2026-09-18 decision)" with "Members of org `nct` and ZYT staff (Clerk gate, 2026-09-23)". |
| 31-32 | Live tick state: "who" is the signed-in Clerk user (name and userId). Older rows keep typed names. |
| 65, 264 | My tasks and `?page=mine`: match on the user's Clerk `assignee` (`public_metadata.assignee`), no longer `zyt.author`. Remove the "1-40 characters" rule. |
| 69 | Add a Company or page checklist: add "create the Clerk org (slug = key) in dev and prod", "add the prefix to `hosting/site/access-map.ts`", "hub variant built automatically". Update the sw.js PAGES step (PAGES is gone). |
| 147 | DryRun recipe: `-DryRun` now defaults to the dev Convex URL and dev Clerk; add the pinned `wrangler@4.131.2 dev`, `.dev.vars` contents, and `node hosting/site/check-gate.mjs http://localhost:8787`. |
| 157-159 | Cloudflare: the Worker now has `main: worker.ts`, `run_worker_first: true`, the secrets `CLERK_SECRET_KEY` (and `CLERK_JWT_KEY`), the vars, and the incident switches `MAINTENANCE` / `BREAKGLASS_PASSPHRASE`. Clerk DNS records live in the same zone, owned by Ngchwanlii's account. |
| 196-197 | Videos: gated by the job prefix's company. Keep "show only the throwaway e2e orgs" as a content rule. |
| 232 | Local Network Access: reword "a public page" to "an https page". Runner from localhost needs `RUNNER_EXTRA_ORIGINS=http://localhost:8787`. |
| 242-248 | Replace the "The site is public…" and "bundles are public…" paragraphs and the passphrase instructions with a new **Access** section: Clerk orgs; the section 3.1 route map; 404 for other companies; sign-in at `/sign-in/`; SW caches only the public shell; how to invite and remove (J7); `AUTH_ENFORCE`; the deploy guard and post-deploy assertion; "deploy only from an up-to-date `main`; old worktrees would re-publish the public site"; rollback and incident switches (section 6). |
| 290 | Decisions and history: add "2026-09-23 Clerk auth replaces open ticking and the public site. See `_plan/09-23_clerk-auth/plan/plan.md`." |
| README.md:19 | Replace "public: anyone with the link can…" with "sign-in required (Clerk). Each client sees only their own company." |
| `hosting/runner/server.mjs:14`, `:251` | "is public" → "is behind a sign-in; only ZYT staff see the Run panel". |
| `hosting/runner/publish-recordings.mjs:7` | "The site is PUBLIC" → "Recordings are visible to that company's signed-in users and ZYT staff"; keep the e2e-orgs-only rule. |

---

## 9. Review disposition

Verified against the code before deciding: `deploy-site.ps1:75-79` (prod Convex default), `:404-418` (DryRun only warns), `:463-472` (PAGES guard), `:479-481` (pinned wrangler deploy); `wrangler.jsonc:17` (`auto-trailing-slash`); `.gitignore:23` (`.dev.vars`); `index.html:722-732` (name dialog), `:2525-2528` (client inside the IIFE); `runner/server.mjs:33-36` (ALLOWED_ORIGINS); `publish-recordings.mjs:7` ("PUBLIC"); `sw.js:10-42`; git log (26 commits on 2026-09-23, worktree `ZYT-Task-rbtasks`). The Clerk handshake and Cloudflare 307 claims are taken from the cited library and docs, and the spike or check-gate matrix proves them.

| # | Lens | Severity | Problem (one line) | Disposition |
|---|---|---|---|---|
| 1 | correctness | major | Worker 404 via `/404.html` gets a 307 to `/404`, which is gated; SW `addAll` of `/404.html` fails | Fixed: D5 `/__denied__`, `/404` public in 3.1, PRECACHE `/404`, check-gate asserts 404 not 307, SW upgrade test checks *activated* |
| 2 | correctness | major | `wrangler dev` pairs prod `pk_live` from `vars` with `sk_test`; no prod key exists before P4 | Fixed: `pk_test` in `.dev.vars`; Worker key comes from `clerk.json` via `--var` only on deploy; mixed-key 503 plus a gate check |
| 3 | correctness | major | Phase 1-2 merges to main would ship a keyless gate (503) and a preflight calling missing `missingKeys` | Fixed: D14 branch policy, prod guard in deploy-site.ps1, `missingKeys` → `board` fallback |
| 4 | correctness | major | `-DryRun` builds point the hub at prod Convex; Phase 2 preflight gate cannot fail | Fixed: DryRun defaults to devUrl, `impartial-sockeye` grep, `-StrictPreflight`, output asserted in P2 gate 4 |
| 5 | correctness | major | Iframe requests are handshake-eligible; plan's "no handshake" claim wrong | Fixed: claim corrected; option (a) strip `Sec-Fetch-Dest` for frames; expired column plus browser stale-iframe step |
| 6 | correctness | major | Encoded `%2F`/`%5C` paths could be classified as one company and served as another | Fixed: `canonicalPath` (decode, reject traversal, 400), same path passed to ASSETS, tests for every listed case |
| 7 | correctness | minor | Console `setState` step can't run (client in closure) | Fixed: P2 gate 5 uses a new `ConvexClient` with `setAuth` |
| 8 | correctness | minor | `name ?? email` misses empty strings; no email claim | Fixed: `||` chain name → assignee → "Unnamed user"; P0 checks a no-last-name user |
| 9 | correctness | minor | Prebuilt components need `@clerk/ui` on every page; Run panel flashes | Fixed: D9, D13, Phase 3 build and gate 5 |
| 10 | correctness | minor | `.gitignore` already ignores `.dev.vars`; unpinned wrangler; name-dialog lines off by one | Fixed: removed `.gitignore`, pinned `wrangler@4.131.2` everywhere, lines 722-732 |
| 11 | safety | blocker | Routine deploys from main would ship the keyless gate and lock everyone out | Fixed: D14 branch + worktree, prod guard, P1 gate 4 proves the guard throws before `wrangler deploy` |
| 12 | safety | major | A stale worktree deploy after cutover silently makes the site public again | Fixed: post-deploy assertion, hourly check (P4 step 10, needs Wilfred's approval), P4 step 6 retires old worktrees and branches, SITE.md Access note |
| 13 | safety | major | Existing client users are not invited before the gate | Fixed: P4 step 1b (list authors, invite with assignee, announce time) and its gate |
| 14 | safety | major | Prod Clerk is first exercised at the big-bang cutover | Fixed differently: D15 canary Worker on `canary.admin.zhiyuantech.ai` running the full gate and `check-gate.mjs` before cutover, plus `/_auth/whoami`. Chosen over a `GATE_MODE=staff` flag because staff mode would need the public all-company hub and the typed-name flow to survive in the new build |
| 15 | safety | major | Rollback is slow, re-exposes client data, and there is no break-glass | Fixed: deployments list + `wrangler rollback`, public rollback only on Wilfred's go, `MAINTENANCE` and `BREAKGLASS_PASSPHRASE` (D16). Changed: break-glass is set only during an incident, not preset (Q21) |
| 16 | safety | major | PAGES guard removed with nothing in its place; failed install leaves the old all-company cache | Fixed: new SW build guard (exists + `public`), test assertion, P1 gate 6 upgrade-from-today's-SW test |
| 17 | safety | major | Keys can be mixed; `-ClerkEnv dev` on a real deploy ships `pk_test` to prod | Fixed: `.dev.vars` `pk_test`, `-ClerkEnv dev` without `-DryRun` throws, single source via `--var` |
| 18 | safety | minor | `AUTH_ENFORCE=1` on shared dev breaks other sessions' previews | Fixed: set only during gate commands, removed after (P2 gate 6, P3 gate 1) |
| 19 | safety | minor | Anonymous prod Convex window between site gate and enforcement | Fixed: steps 7 and 8 in one sitting, closing curl, post-deploy warning |
| 20 | safety | minor | `+clerk_test` doesn't work in prod; test accounts left in client orgs | Fixed: ZYT-controlled check mailbox (step 1b), removal in step 10 |
| 21 | safety | minor | Email fallback exposes staff emails to clients | Fixed: never the email (3.3), full names set at invite |
| 22 | safety | minor | Hobby caps unchecked | Fixed: P0 step 5 and spike record; Q12 |
| 23 | safety | minor | Runner needs `RUNNER_EXTRA_ORIGINS` locally; runner headers still say PUBLIC | Fixed: P1 gate 7 and section 8 rows |
| 24 | verifiability | blocker | DryRun gates hit prod Convex; preflight gate cannot fail | Fixed: same as #4 (devUrl default, grep assertion, `-StrictPreflight`, output match) |
| 25 | verifiability | blocker | No HTTP-boundary proof of wrong-org 404, zip/mp4 gating, `/` body | Fixed: `check-gate.mjs` matrix with token minting from Wilfred-opened sessions; Phase 1 gate 5, P2 gate 3, P3, canary and P4 |
| 26 | verifiability | major | Expired or stale session never tested; iframe contradicts J5 | Fixed: expired column in check-gate, iframe header strip, browser stale-iframe step |
| 27 | verifiability | major | Leak check covers only nct and misses zyt and paths | Fixed: build-time leak check over all client variants plus the zyt completeness check |
| 28 | verifiability | major | Phase 1 claims J3 while Convex data is still open; no wrong-org `board` test; `--identity` skips JWT checks | Fixed: J3 split by phase, wrong-org `board` check, real-token `--convex` checks, P0 confirms `--identity` custom fields |
| 29 | verifiability | major | Sign-out and removal verified only in the UI; SW upgrade from today's cache untested | Fixed: saved-jar checks after 70 s at Worker and Convex (P3 gates 1 and 4); SW upgrade test in P1 gate 6 |
| 30 | verifiability | major | Prod gate is not a runnable check | Fixed: canary and prod `check-gate.mjs` runs by Wilfred with `sk_live`, Convex bearer checks, steps 7-8 in one sitting, numbered prod checklist |
| 31 | verifiability | minor | Open-redirect validation untested | Fixed: `safe-redirect.js` unit test and browser step |
| 32 | verifiability | minor | Phase 0 delivers no journey; no scripted session minting | Fixed: kept as an explicit exception (Phase 1 entry criteria); gate adds scripted minting with `orgSlug` check |
