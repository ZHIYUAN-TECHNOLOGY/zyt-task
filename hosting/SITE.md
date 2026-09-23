# admin.zhiyuantech.ai — site contract

For a Claude session (or a person) working in **another repo** that needs to know what this site
shows, where each part comes from, what can change and how to ship it.

Stable facts only. Layout, copy, colours and step wording are not described here — the source
files are the spec for those. If something below stops being true, fix this file in the same change.

## Pages and their source

| URL | Source of truth | Managed by |
|---|---|---|
| `/` dashboard (companies · Runbook / Findings · detail panel) | `hosting/hub/index.html`; companies and their pages in `hosting/hub/projects.json`; runbook steps in `tracker/seed/runbook-<key>.json` (optional, `seed.runbook`); finding content in `tracker/seed/{tasks,client-tasks,flow}-<key>.json` | Hand edits in this repo |
| `/nct/customer-intake-sop/` | `C:/Project/ZYT-Task/customer-intake-sop/sop.json` + `shots/*.jpg` beside it, built with zyt-setup's `build-page.mjs`. Falls back to the hand-written `customer-intake-sop.html` only if `sop.json` is missing | zyt pipeline since 2026-09-16. Registry id `ZYT-Task/customer-intake-sop` (live, code root `C:/Project/NCT/nct-layout`); 7-role "Show my flow" view; fix list kept public |
| `/nct/steps-1-3-runbook/` | `C:/Project/ZYT-Task/steps-1-3-runbook.md`, same renderer | Hand edits |
| `/nct/steps-4-10-runbook/` | `C:/Project/ZYT-Task/steps-4-10-runbook.md`, rendered by `hosting/hub/build-runbook.mjs` (marked) | Hand edits |
| `/nct/steps-11-15-runbook/` | `C:/Project/ZYT-Task/steps-11-15-runbook.md`, same renderer | Hand edits |
| `/nct/step-11-plan/` … `/nct/step-15-plan/` | `C:/Project/ZYT-Task/plans/step-1N-*.md`, same renderer (kind "Plan") | Hand edits; decisions in each §9, all settled 2026-09-17. **Built and live, but deliberately not in `projects.json`** (2026-09-18): the page list would be 12 entries long, so the plans are reached from the steps 11–15 runbook's §0 table instead. A page can be published without being listed; only the listing is dropped |
| `/nct/steps-12-15-crosscheck/` | `C:/Project/ZYT-Task/plans/steps-12-15-crosscheck.md`, same renderer (kind "Crosscheck") | Hand edits |
| `/nct/steps-16-19-runbook/`, `/nct/steps-20-26-runbook/`, `/nct/step-27-runbook/` | `C:/Project/ZYT-Task/steps-16-19-runbook.md`, `steps-20-26-runbook.md`, `step-27-runbook.md`, same renderer | Hand edits. Written 2026-09-21; every decision settled the same day (recommended options, cross-plan X-items taking precedence); Waves 12–23. Built from the `$nctPages1627` table in `deploy-site.ps1` |
| `/nct/step-16-plan/` … `/nct/step-27-plan/` | `C:/Project/ZYT-Task/plans/step-{16..27}-*.md`, same renderer (kind "Plan") | Hand edits; decisions in each §9 settled 2026-09-21. Published but unlisted, like steps 11–15 |
| `/nct/steps-16-19-crosscheck/`, `/nct/steps-20-26-crosscheck/` | `C:/Project/ZYT-Task/plans/steps-16-19-crosscheck.md`, `steps-20-26-crosscheck.md` (kind "Crosscheck"). X17–X40 settled 2026-09-21 | Hand edits. Step 27's collision check is inside its runbook §2 |
| `/jwa/full-chain-sop/` | `C:/Project/JWASystemv2/jwa-system/sop/jwa-full-chain/sop.json` + `shots/` beside it | zyt pipeline. Registry id `jwa-system/jwa-full-chain` (draft); built with zyt-setup's `build-page.mjs` without `--no-ledger` since 2026-09-16, so its fix list is public like NCT's |
| `/harper/guest-concierge-sop/` | `C:/Project/OpenWA/sop/guest-concierge/sop.json` (no screenshots), built with zyt-setup's `build-page.mjs` | zyt pipeline since 2026-09-21. Company `harper` ("Harper Suite", Harper Boutique Hotel at Sutera Avenue). Documents the live Kapso workflow `harper-concierge` + `harper-ops` + `harper-watch` in `OpenWA/kapso/`; Step 03 lists every question the bot answers. (A first version built from the unrelated `C:/Project/Kapso` prototype was replaced the same day.) Fix list public; empty `tracker/seed/*-harper.json` |
| `/harper/bot-answers/` | Generated at build time by `hosting/hub/build-bot-answers.mjs` from `C:/Project/OpenWA/kapso/prompt/kb.md` (the bot's knowledge base, one table per question in English, Malay and Chinese) plus `C:/Project/OpenWA/sop/guest-concierge/other-flows.md` (non-question messages), then rendered by `build-runbook.mjs` (kind "Reference") | Edit `kb.md` in OpenWA (that changes the bot too) or `other-flows.md`, then redeploy. A malformed `kb.md` entry fails the build |
| `/zyt/commands/` (ZYT commands) | `C:/Project/ZYT-Task/docs/zyt-commands.md`, same renderer (kind "Commands", company `zyt` in `projects.json`, empty `tracker/seed/*-zyt.json`) | Hand edits (h2 = table-of-contents entry); verify commands against the zyt skills' scripts |

| `/nct/downloads/*.zip` | Built by `deploy-site.ps1` from the runbook markdown plus the plans its prompts name (`steps-1-3-plans.zip`, `steps-4-10-plans.zip`, `steps-11-15-plans.zip`, `steps-16-19-plans.zip`, `steps-20-26-plans.zip`, `step-27-plans.zip`, `all-plans.zip`). The plans are not in git, so this is the only self-service copy. Public, like every other page (2026-09-18 decision) | Bundle lists live in `deploy-site.ps1`; a missing file fails the build |

Live tick state (done / open, who, when) is not in any file: it is in Convex, project
`wilfred-foo/zyt-admin`, tables `findings` and `events`.

## How a page is built

`hosting/deploy-site.ps1` assembles everything into `hosting/site/public/` — generated output,
**never edit it**. Each SOP page is its source wrapped in these layers, in order:

1. `Get-SopHtml` (in `deploy-site.ps1`) — document skeleton, ZYT top bar (logo → `/`,
   Client projects / company), web-app head, theme script (`zyt.theme`, dark by default).
2. `hosting/hub/sop-theme.css` — ZYT palette mapped onto the page's own colour tokens.
3. `hosting/hub/sop-layout.css` + `sop-layout.js` — hosted layout: title block inside Step 01's
   pane, the whole chain as a full-screen view behind the right-edge tab, window-tall fix browser,
   The document last.

The NCT source file is also a claude.ai artifact (on another Claude account), so **layout changes
belong in layers 1–3, not in the source**.

## What can change, and where

| Change | Edit | Then |
|---|---|---|
| NCT step wording, routes, watch notes, chain breaks, defects | `customer-intake-sop/sop.json` | Redeploy |
| NCT runbook text | `steps-4-10-runbook.md` (h2 = table-of-contents entry) | Redeploy |
| NCT screenshots | `customer-intake-sop/shots/` (names referenced by `sop.json`) | Redeploy |
| JWA SOP content | `sop.json` via `/zyt-update` in the JWA repo | Redeploy with `deploy-site.ps1` — the zyt skills' own publish step targets a separate Worker (`hosting/<worker-name>/`), not this site |
| Look or behaviour of every SOP page | `hosting/hub/sop-theme.css`, `sop-layout.css`, `sop-layout.js` | Redeploy |
| Dashboard UI | `hosting/hub/index.html` | Redeploy |
| Which pages the left column lists, and in what order | `hosting/hub/projects.json` — pages are grouped under their client, the selected client first. `"nav": "header"` on a page moves it to the top bar instead (pages about this site, not about a client's work) | Redeploy |
| Task titles, detail, repair, source locations, workstreams | `tracker/seed/*-<key>.json` | Redeploy; new task ids also need Convex rows (below) |
| Runbook stages and steps (what's next, owner, waits-for, link to a runbook section) | `tracker/seed/runbook-<key>.json` | Redeploy; new step ids need Convex rows — run `seed:nct` (dev and `--prod`) **before** the site deploy, or ticking them fails with "That task does not exist." |
| Add a company or a page | `projects.json` + seed files + a build block in `deploy-site.ps1` + the path in `PAGES` in `hosting/pwa/sw.js` + a seed mutation in `convex-app/convex/seed.ts` | Redeploy; run its seed |
| Brand (logo, palette, fonts) | `hosting/hub/brand/BRAND.md`, files beside it, `hosting/pwa/make-icons.ps1` | Redeploy |
| A runbook step's **Run golden path** button | `"run": "<job id>"` on the step in `tracker/seed/runbook-<key>.json`; job ids and what they run live in `JOBS` in `hosting/runner/server.mjs` | Redeploy (the job itself needs no deploy — restart the runner) |
| Tick state | Never by hand — through the dashboard | — |

## What gets a page, and what gets listed (2026-09-18)

Every plan and runbook lives on this site; a markdown file left only in `plans/` is not done.
But **being published and being listed in the page list are two different things**:

| | Page built | In the page list (`projects.json`) | Why |
|---|---|---|---|
| SOPs, runbooks, the steps 12–15 crosscheck, ZYT commands | yes | yes | People browse to them, read them on a phone, and link to a section |
| Step plans (`/nct/step-11-plan/` … `step-15-plan/`) | yes | **no** — listed in the company's `unlisted` array | 700–1000 lines each; five more rows would bury the runbooks. They are reached from the steps 11–15 runbook's §0 table and from dashboard steps that deep-link a section (six stage D steps point into the step 11 plan) |

So a new plan is **published but unlisted**, and added to the download bundles. Do not delete a
plan page to tidy the list: dashboard steps and runbook tables link into their headings, and a
deleted page is a 404 for every link already shared. Unlist it instead.

Whole plan sets are also downloadable as zips (`/nct/downloads/`), built by `deploy-site.ps1`:
one per runbook plus `all-plans.zip`. The bundles are how a colleague gets the plans as files —
the pages are for reading a section.

## Publishing a plan or a runbook (the recipe)

A page is four edits, then a deploy, in this order:

1. **Write the markdown** anywhere in this repo (`plans/*.md`, `*-runbook.md`). Each `##` heading
   becomes a table-of-contents entry, so headings are the page's navigation. Never rename a heading
   another page links to: the anchors are its slug.
2. **`hosting/hub/projects.json`** — a **plan** goes in the company's `unlisted` array (the path
   only); anything people browse to gets an entry in `pages`: `type` (SOP · Runbook ·
   Plan · Crosscheck · Commands, shown as the chip), `title`, `href` (`/nct/<slug>/`) and `source`
   (repo-relative path; the build reads its mtime for "last edited" and fails if it is missing).
   `build-seed.mjs` accepts a dashboard-step link to any listed **or** unlisted path, and rejects
   anything else, so a typo in a link still fails the build.
3. **`hosting/deploy-site.ps1`** — copy an existing block: run `hub/build-runbook.mjs <src> <body>
   [kind]`, then `Write-Utf8 … (Get-SopHtml … 'nct' 'NCT')`. Use forward slashes in `Join-Path`
   arguments.
4. **`hosting/pwa/sw.js`** — add the path to `PAGES`, or the page is missing offline.
5. **Deploy**: `-DryRun` first, then the real run (below).

A runbook whose prompts name plan files also needs a **download bundle**, because the plans are not
in git: add it to `$bundles` in `deploy-site.ps1` (the runbook markdown plus every plan its prompts
name) and link it from the runbook's "Get the files" section as `/nct/downloads/<name>.zip`. The
build fails if a listed file is missing, so a renamed plan is caught at deploy time.

**Prompts and commands on dashboard steps.** A runbook step's panel offers a "Show and copy"
dialog with the code blocks (session prompts, bash, SQL) of the section its `link` points at.
`build-seed.mjs` reads them from the page's markdown source at build time, so they always match the
page — never paste prompt text into the seed. When one step needs other or several sections, give
it `prompts`: a list of full links (`/nct/<page>/#<heading-id>`); the build fails if an id does not
exist, so a renamed heading is caught. Heading ids follow `build-runbook.mjs`'s slug rules, and a
block's label is the short line or `###` heading just above it.

If the work also becomes dashboard steps, add them to `tracker/seed/runbook-<key>.json` as a stage
(`waitsFor` holds step ids, `link` points at `<page>#<heading-slug>`, `owner` is `wilfred` or
`session`), then **seed Convex before the site deploys**:
`npx convex deploy -y` and `npx convex run --prod seed:nct` in `hosting/convex-app`. A step whose
row does not exist yet refuses ticks with "That task does not exist."

## Build, test, deploy

First time on a machine: `npm install` in `hosting/` (the runbook build needs `marked`).

```bash
powershell -File C:/Project/ZYT-Task/hosting/deploy-site.ps1 -DryRun -ConvexUrl https://small-snail-912.eu-west-1.convex.cloud
```
Build against the **dev** Convex deployment, then serve locally with
`npx wrangler dev --port <port> --local` from `hosting/site/` and test in a browser.

```bash
powershell -File C:/Project/ZYT-Task/hosting/deploy-site.ps1
```
Build with the **production** Convex URL (`hosting/convex-app/deployment.json`) and deploy.

- Cloudflare: Worker `zyt-admin`, custom domain `admin.zhiyuantech.ai`, in
  Ngchwanlii@zhiyuantech.ai's account (it owns the `zhiyuantech.ai` zone). Config:
  `hosting/site/wrangler.jsonc`.
- Convex backend changes: in `hosting/convex-app`, `npx convex dev --once` (dev),
  `npx convex deploy -y` (prod). New tasks or runbook steps: `npx convex run --prod seed:nct` — adds missing rows,
  never resets ticks.
- A deploy publishes the whole site from the files on disk, including every company's pages.
  Only one build or deploy runs at a time: `deploy-site.ps1` holds `hosting/site/.deploy.lock`
  and refuses to start while another live run holds it (a lock whose process is gone, or older
  than 45 minutes, is replaced with a warning). Two sessions deploying one after the other: the
  last one wins, with whatever is on disk.

## Golden-path runner (local only)

The panel lives in `hosting/hub/golden-path.js` + `.css`, shared by the dashboard and the SOP
pages and inlined into both by `deploy-site.ps1` (no separate URL, so nothing to add to the
service worker and no page can serve half a copy). It appears in two places:

- **A runbook step** with a `run` field, in the task drawer.
- **An SOP step guide**, under its own "Golden path" heading — `hub/sop-layout.js` watches the
  step modal and inserts it, and `jobForStep` in `golden-path.js` maps SOP steps 1–3, 4–7 and
  8–10 to the three jobs. Steps with no journey yet (11–15) show nothing rather than a dead
  button. Keep that map in step with `JOBS` in the runner.

**Recordings are kept.** When a run finishes, the runner saves its verdict, step list and video to
`hosting/runner/runs/<job>.json` + `.mp4` (gitignored). A panel opening with no run live loads
that saved run — "Recorded 23 Sep, 14:02 on this computer" — and its button becomes **↻ Regenerate**,
which records the journey again and replaces the saved copy. A Stopped run replaces nothing. The copy
exists because a terminal run of the suite clears `e2e/out/` before it writes. Recordings are local to
the machine that made them: the panel reaches them through the runner, so with the runner off, or on
another computer, there is nothing to show.

A runbook step with a `run` field shows a **Golden path** section. Its button asks
`hosting/runner/server.mjs` on **the viewer's own computer** (`http://127.0.0.1:4317`) to start a
headed, slowed Playwright run in the NCT repo, and streams each `test.step` into the panel, then
shows the recorded video. Nobody else's click can reach your machine.

```bash
node hosting/runner/server.mjs
```

- Jobs, each a Playwright project in `nct-layout` (its `JOBS` entry names the video path, and
  `/health` hands the dashboard each job's title, so a new job needs no site deploy):
  - `nct-intake-steps-1-3` → `e2e/specs/intake.golden-path.spec.ts` (project `intake`), SOP
    steps 01–03 → `e2e/out/email/intake-golden-path/`.
  - `nct-quote-build-steps-4-7` → `e2e/specs/quote-build.golden-path.spec.ts` (project
    `quote-build`), SOP steps 04–07 → `e2e/out/quotation/quote-build-golden-path/`.
  - `nct-quote-decide-steps-8-10` → `e2e/specs/quote-decide.golden-path.spec.ts` (project
    `quote-decide`), SOP steps 08–10 → `e2e/out/quotation/quote-decide-golden-path/`. It opens the
    send the customer would get and **cancels** — quotation sends go through a real connected
    mailbox, so no golden path may ever press Send.
  Adding one to a runbook step still needs a deploy, because the `run` field is built into the page.
- Reads `DATABASE_URL` and `BETTER_AUTH_SECRET` from `nct-layout/apps/server/.env`; the suite seeds
  its own organization, refuses the production database and tears the org down.
- Accepts requests only from `https://admin.zhiyuantech.ai` (plus `RUNNER_EXTRA_ORIGINS`, e.g.
  `http://localhost:8791` for a `-DryRun` preview — `.claude/launch.json` has `hub-preview` and
  `golden-path-runner`). One run at a time. Env: `NCT_DIR`, `RUNNER_PORT`, `RUNNER_SLOWMO` (ms, 600).
- **Chrome 142+ Local Network Access:** a public page may only reach `127.0.0.1` when the request
  opts in with `fetch(url, { targetAddressSpace: 'loopback' })`. Without it the fetch fails at once
  with a bare "Failed to fetch". `EventSource` and `<video src>` cannot opt in, so the dashboard
  streams progress with a **streamed fetch** and fetches the recording into a **blob**. Keep both
  that way, and keep every runner route behind the CORS check — including `/video`. Safari blocks
  loopback outright; the desktop app's own browser pane blocks it too (`ERR_BLOCKED_BY_CLIENT`),
  so test the button in Chrome or Edge, or against a local `-DryRun` copy of the site.

## Invariants — breaking these breaks something

- **The site is public.** Anyone with the link can read every page and tick tasks; `noindex` only
  hides it from search.
- **The bundles are public too** (2026-09-18 decision): anyone with the link can download every
  plan as files. `hosting/site/worker.js` can gate `/nct/downloads/` behind a passphrase again —
  set `"main": "./worker.js"` in `hosting/site/wrangler.jsonc` and
  `printf %s '<passphrase>' | npx wrangler secret put DOWNLOADS_PASSPHRASE` from `hosting/site/`.
  It fails closed, so set the secret before deploying with `main` on. Team-only fields (repairs, code locations) are shown by decision.
- **NCT page hooks the hosted layout depends on** (`sop-layout.js` / `.css`): `.chain`,
  `#chain-pane` with `.cp-num`, `.masthead`, `nav.index`, `#arrivals`, `#map`, `#baseurl`,
  `#fixes`, `.fixbrowser`, `#document`, `#doc-body`, `window.SOP.showStep`, `window.chainFocus`,
  `.sm-backdrop`. The page's own chart scripts also key on `.cn[data-step]` and `.cb[data-brk]`.
  Renaming any of them in the source breaks the hosted layout.
- **`#step-N` anchors** are linked from the dashboard's task panel (`/nct/customer-intake-sop/#step-N`).
- **Task ids and runbook step ids in `tracker/seed` are Convex keys** (one key space, rows in `findings`). Renaming one orphans its tick history. Runbook `link` anchors are the renderer's heading slugs, so renaming a runbook heading breaks the link.
- **The dashboard opens on the Runbook view**; `?view=findings` or a finding's `?task=` opens Findings.
- **Every task belongs to exactly one workstream**; `hosting/hub/build-seed.mjs` fails the build
  otherwise.
- **Every screenshot the page references must exist**; the build fails otherwise.
- **Non-ASCII in `deploy-site.ps1` string literals** must be HTML entities — Windows PowerShell
  reads the file as ANSI.

## Decisions and history

- `README.md` — overview of this repo, both published sites.
- `_plan/09-15_zyt-admin-dashboard/plan.md` — dashboard decisions (layout, Convex, open ticking).
- `_plan/09-15_zyt-admin-dashboard/sop-layout.md` — SOP hosted-layout decisions and revisions.
- `hosting/hub/brand/BRAND.md` — brand source and the darker product dark theme.

## Known gaps (2026-09-16)

- NCT's App URL box defaults to `http://localhost:3101/`, so its screen links point at the
  visitor's own machine until NCT's real app address is set.
- NCT is on the `sop.json` pipeline (2026-09-16): the registry entry points at
  `customer-intake-sop/sop.json` with code root `C:/Project/NCT/nct-layout`, so the zyt hooks flag NCT app
  changes and `/zyt-update` / `/zyt-audit` work on it. The migration plan under
  `_plan/09-16_nct-sop-json-migration/` was stopped unwritten; it is not needed. The hand-written
  `customer-intake-sop.html` is only a fallback (backup: `~/.claude/zyt/pending/customer-intake-sop/`).
- JWA has no tasks in `tracker/seed` and no Convex seed mutation yet.
