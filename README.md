# ZYT-Task — NCT enquiry-to-invoice work

Everything for the NCT "When a Customer Comes In" chain: the SOP page, the three
implementation plans, and the runbook for whoever executes them.

Code lives in `C:/Project/NCT/nct-layout` (branch `feat/new-layout`). Nothing in
this folder is inside that repo.

## Published pages

| Page | Link | Source here |
|---|---|---|
| **When a Customer Comes In** — the 27-step SOP, per-step operator guide, screenshots, 48 defects, handover prompts | _(artifact link held outside the repo — ask Wilfred)_ | `customer-intake-sop.html` + `customer-intake-sop/shots/` |
| **Steps 1–3 Rollout** — the runbook for the implementer | _(artifact link held outside the repo — ask Wilfred)_ | `steps-1-3-runbook.html` |

**Contract for other repos:** `hosting/SITE.md` — what each page is built from, what can change and
how, deploy, invariants. Keep it true when any of those change.

**ZYT client-projects site:** https://admin.zhiyuantech.ai — **sign-in by Cloudflare Access**
(email PIN): ZYT staff see everything, each client only their own company. It shows team-only
detail (repairs, code locations) to that company's users. Rules: `hosting/SITE.md` → Invariants.

| Path | Page | Source |
|---|---|---|
| `/` | Dashboard — company and its pages (left) · **Runbook** (default: ordered, tickable steps owned by Wilfred or a session) or **Findings** (workstreams → tasks) (middle) · detail panel (right). Links: `/?company=<key>&task=<id>` (a runbook step or a finding), `&view=findings` (old `?project=` links still work) | `hosting/hub/index.html`; runbook steps `tracker/seed/runbook-nct.json` |
| `/nct/customer-intake-sop/` | NCT "When a Customer Comes In" + 32 screenshots | `customer-intake-sop/sop.json` (falls back to `customer-intake-sop.html`) |
| `/nct/steps-1-3-runbook/` | NCT steps 1–3 runbook | `steps-1-3-runbook.md` |
| `/nct/steps-4-10-runbook/` | NCT steps 4–10 runbook | `steps-4-10-runbook.md` |
| `/jwa/full-chain-sop/` | JWA SRF full chain | `../JWASystemv2/jwa-system/sop/jwa-full-chain/sop.json` |

Contract for other repos (sources, layers, invariants): `hosting/SITE.md`.

- **Hosting:** Worker `zyt-admin` in **Ngchwanlii@zhiyuantech.ai's** Cloudflare account, which
  owns the `zhiyuantech.ai` zone (a custom domain only attaches in that account). Config:
  `hosting/site/wrangler.jsonc`.
- **Task content** (titles, detail, repair, src, workstreams, steps) comes from `tracker/seed/`
  via `hosting/hub/projects.json` and is embedded at build. Change it there and redeploy.
- **Ticks are shared and live** through Convex project `zyt-admin` (team `wilfred-foo`) —
  `hosting/convex-app/`. Tables `findings` (state per task) and `events` (who ticked what,
  when); names follow the ZYT Delivery v0 plan. URLs in `hosting/convex-app/deployment.json`.
  Anyone may tick; each tick records a typed name. If Convex is unreachable the page is read-only.
- **Backend changes:** in `hosting/convex-app`, `npx convex dev --once` (dev), `npx convex deploy -y`
  (prod). **New tasks in the seed:** `npx convex run --prod seed:nct` adds missing rows and never
  resets existing ticks.
- **Redeploy the site** after editing any source: `powershell -File hosting/deploy-site.ps1`
  (run `npm install` in `hosting/` once; a lock file stops two builds/deploys running at once;
  `-DryRun` builds into `hosting/site/public/`; add `-ConvexUrl <devUrl>` to test against dev).
- **Add a client:** add an entry to `hosting/hub/projects.json` (seed files + pages), a seed
  mutation in `convex-app/convex/seed.ts`, the page build in `deploy-site.ps1`, and the page path
  to `PAGES` in `hosting/pwa/sw.js`. Only name a client once it has something to show.
- **Brand:** logo, favicons, palette and type from zhiyuantech.ai — `hosting/hub/brand/BRAND.md`;
  `hosting/pwa/make-icons.ps1` prepares the icons and both web-sized logos. The dashboard is
  **dark by default** — the site's dark homepage palette taken darker (ground `#04061a`,
  columns `#080c24`, cards `#0d1333`; text and accents unchanged) with the white logo; the sun/moon button in the
  top bar switches to light and each browser remembers the choice. The SOP page on this site
  is recoloured at build time by `hosting/hub/sop-theme.css` (ZYT palette; amber → indigo, teal →
  green, chain breaks → red; fonts unchanged) and follows the dashboard's theme choice.
  `customer-intake-sop.html` itself — also the claude.ai artifact — keeps its original colours.
- **SOP hosted layout** (`hosting/hub/sop-layout.js` + `sop-layout.css`, applied at build, source
  untouched): the dashboard's top bar (logo → site root, Client projects / NCT, theme button); the
  title block, phase tiles and How they arrive show in the chain pane while Step 01 is selected;
  the whole chain opens full screen from "The whole chain" tab on the right edge and fits one
  window on desktop (chart scaled to fit on the left; App URL and × above the step pane on the
  right; no intro paragraph or legend) — so the page itself starts at What to fix first, whose
  step list and defects are one window tall with inner scroll; The document comes last.
  Plan and decisions: `_plan/09-15_zyt-admin-dashboard/sop-layout.md`.
- **Web app:** installable on Windows and Mac — Chrome/Edge **Install** in the address bar,
  Safari **File → Add to Dock**. Online it loads the latest deploy; offline it shows the last
  copy, screenshots included. Wiring in `hosting/pwa/` (manifest, service worker, icons from
  `make-icons.ps1`).
- **Outside claude.ai** the SOP has no shared database: ticks are saved per browser; comments,
  uploads and saved step prompts don't work.
- **Old URL:** `nct-customer-intake-sop.wilfred-c3a.workers.dev` (Wilfred's account) now runs
  `hosting/legacy-redirect/`, which forwards to the new SOP address and retires the old
  installed web app.

The claude.ai pages below are private until shared from each page's Share menu. When sharing the SOP
page, check **Shared version** points at the newest version — it was pinned to
Version 1 and will keep serving that until changed.

**Two dead links.** `ffc6cc8b-…` (an SOP copy) and `8dde54d5-…` (the first runbook)
were published while this machine was signed into a second Claude account. They are
unreachable from the account that owns the two pages above — use the table, not those.

## ZYT Delivery v0 — the delivery tracker (planned, not built)

An agency-wide delivery board: the ZYT team runs each client's delivery on one live board,
client users sign in and read it with team-only fields removed on the server, and Claude
sessions work findings through a project-scoped API. NCT is the first sample client —
nothing may be hard-coded to NCT except its data bundle.

The plan is written and staff-reviewed. No `app/` folder, git repo or deployment exists yet.

| Path | What it is |
|---|---|
| `_plan/09-14_21-11_zyt-delivery-v0/plan/plan.md` | **The plan** — 5 phases, file ownership, contracts, decisions D1–D15. Wins over any other file here |
| `_plan/09-14_21-11_zyt-delivery-v0/plan/review.md` | Staff review (2026-09-15): four blocking defects, all fixed in the plan |
| `_plan/09-14_21-11_zyt-delivery-v0/prompts/handoff.md` | Paste-ready handoff for the session or colleague who builds Phase 1 |
| `tracker/SCHEMA.md` | The model: one board, per-field visibility, reports, declared progress |
| `tracker/STACK.md` | The stack: TanStack Start on Cloudflare Workers, Convex, Better Auth for sign-in only, own org/API-key tables, R2. Revised 2026-09-15 to match the plan |
| `tracker/seed/` | The real NCT flow (27 steps), 48 findings, and 10 workstreams grouping them |
| `mocks/board.html` | The unified board with a **Team / Client** toggle — layout reference only; colours come from plan.md §4 *Design tokens*. Also published as a Claude artifact _(artifact link held outside the repo — ask Wilfred)_ |
| `mocks/superseded/` | The earlier two-page mocks, kept for reference only |

Two layout changes are planned but **not done**: the app goes in `app/`, and the git root
becomes this folder with the NCT SOP material moved to `samples/nct/` (D10). Update the
paths in this README when that happens.

Two earlier mock pages are still published and superseded — delete them from `/artifacts`
(select, press **d**): `f12d446f-…` (client weekly) and `b424c65c-…` (internal board).

## Republishing

Publish the file from this folder **and pass the artifact's `url`**, so it updates in
place. A publish without the URL makes a new artifact with an empty database: the
ticks, comments, uploads and saved prompts live with the artifact, not with the file.

Before republishing, run an artifact list. If a page shows as `(shared)` rather than
`(mine)`, this machine is signed into the other account and the publish will fail —
switch accounts rather than publishing a copy.

The SOP page needs its capabilities restated when they change:
`{db: {}, assets: {}, downloads: true}`.

## Contents

| Path | What it is |
|---|---|
| `customer-intake-sop.html` | Source of the SOP page. Screenshots load from `customer-intake-sop/shots/` (32 files); they are already published, so a page-only republish keeps them. |
| `steps-1-3-runbook.md` | The implementer's runbook for steps 01–03: three worktrees, three waves, merge order, the production collision gate. Published at `/nct/steps-1-3-runbook/`. `steps-1-3-runbook.html` is the older artifact version. |
| `steps-1-3-rollout.md` | The same rollout decision in note form — file overlaps, why the waves are shaped this way. |
| `plans/step-01-enquiry-channel.md` | /planpro plan: record the channel an enquiry arrived by; create a customer from an email sender. Migration `0066`. Readiness 9/10. |
| `plans/step-02-credit-and-duplicates.md` | /planpro plan: credit limit as an audited decision at invoicing; no case-variant duplicate companies. Migration `0067`. Readiness 8/10. Phase 3 waits on production data. |
| `plans/step-03-contact-nomination.md` | /planpro plan: show when a company has contacts but nobody nominated primary. No migration. Readiness 9/10. |
| `plans/step-04…step-10-*.md` | /planpro plans for steps 04–10 (rate card gate → decision correction). Every decision was settled on 2026-09-15 with the recommended option. |
| `plans/steps-4-10-crosscheck.md` | How the seven plans depend on each other, plus the cross-plan settlements X1–X5. |
| `steps-4-10-runbook.md` | The implementer's runbook for steps 04–10: four waves of worktrees, a session prompt for each, merge order, migration numbering, owner-only production gates. |

The same three plans are saved inside the SOP page at `prompts/step-01..03`, so the
implementer can copy or download them from each step's **Prompt** box without this folder.

## Two things that stayed in the repo

- **`nct-layout/e2e/out/_walk/probe-step2.ts`** — the read-only production probe the
  step 2 plan's gate calls for. It imports `@nct-ai/db`, so it only resolves inside the
  workspace. Run it from `nct-layout`, never from here.
- **Screenshot and verification scripts** under `nct-layout/e2e/out/_walk/` — throwaway
  drivers for capturing the SOP screenshots and checking the page. `e2e/out` is gitignored.

## State as of 2026-09-15

**NCT steps 01–10 (code in `nct-layout`)**
- All ten plans' decisions are settled — each plan's section 9 records three approaches,
  the recommendation, and what was chosen. Steps 04–10's 33 decisions and the cross-plan
  settlements X1–X4 were all settled on the recommended option on 2026-09-15.
- Evidence was read at commit `6c31a20e` (steps 01–03) and `6bb3a1bf` (steps 04–10).
  Re-locate code by symbol, not line number.
- Nothing has been implemented. Next actions: step 1 of `steps-1-3-runbook.html`, and
  Wave 1 of `steps-4-10-runbook.md` (04 · 08 Phases 1+4 · 05). The two can run alongside
  each other; they share only the migration journal.
- The plans are in git (`plans/`) and published: every step plan has an unlisted page at
  `/nct/step-NN-plan/`, and each runbook's plans download as one zip from `/nct/downloads/`.
- The steps 04–10 runbook is published at `/nct/steps-4-10-runbook/`.
- Open gates, owner only:
  - **Production's company-name collision count** (step 02 Phase 3). The dev branch reads
    0; production is unmeasured — `dev-db-guard` blocks it unless the owner overrides.
  - The read-only production checks and step 10's re-seed script — `steps-4-10-runbook.md` §7.
- Unowned: **X5** — `convertToOrder` does not check for Won, so a Lost quote can become an
  order. Belongs to a step 11 plan, which does not exist yet.

**ZYT Delivery v0**
- Plan written and reviewed; nothing built.
- Before Phase 1: a Google OAuth client (the owner puts its ID and secret in
  `app/.env.local`), the team's Google addresses for the NCT members seed, and a Convex
  project. Phase 3 adds a Microsoft Entra app; Phase 4 an R2 bucket, token and CORS policy.
- Open, not blocking: **D4** (email provider — v0 sends no email) and **D15** (how a
  Microsoft client's invite activates; planned as a pending claim a team member approves).
