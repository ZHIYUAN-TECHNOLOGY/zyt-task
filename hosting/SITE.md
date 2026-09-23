# admin.zhiyuantech.ai — site contract

For a Claude session (or a person) working in **another repo** that needs to know what this site
shows, where each part comes from, what can change and how to ship it.

Stable facts only. Layout, copy, colours and step wording are not described here — the source
files are the spec for those. If something below stops being true, fix this file in the same change.

## Pages and their source

| URL | Source of truth | Managed by |
|---|---|---|
| `/` dashboard (companies · Overview · Tasks · Findings; a task view with its runbook's text, checklist and attachments) | `hosting/hub/index.html`; companies and their pages in `hosting/hub/projects.json`; tasks, stages and steps in `tracker/seed/runbook-<key>.json` (optional, `seed.runbook`); finding content in `tracker/seed/{tasks,client-tasks,flow}-<key>.json`; the runbook text's styles in `hosting/hub/runbook-body.css` (shared with the pages) | Hand edits in this repo |
| `/nct/customer-intake-sop/` | `C:/Project/ZYT-Task/customer-intake-sop/sop.json` + `shots/*.jpg` beside it, built with zyt-setup's `build-page.mjs`. Falls back to the hand-written `customer-intake-sop.html` only if `sop.json` is missing | zyt pipeline since 2026-09-16. Registry id `ZYT-Task/customer-intake-sop` (live, code root `C:/Project/NCT/nct-layout`); 7-role "Show my flow" view. Built with `--no-ledger` since Phase 4 (2026-09-23): the page carries no fix list, no step fixes and no browser ticks; "What to fix first" lives in the dashboard's **Findings** (Group by Rank), generated from the same `sop.json`. Browser ticks from the old page (`sop.customer-intake-sop.fixDone`, `sop.fixDone`) can be imported once from the Findings banner and are then kept as `….imported`; the page's comment box is retired, and the claude.ai artifact copy's ticks and comments are abandoned (D12) |
| `/nct/steps-1-3-runbook/` | `C:/Project/ZYT-Task/steps-1-3-runbook.md`, same renderer | Hand edits. Built, hidden from the list (`nav: hidden`) since Phase 3 (2026-09-23): the dashboard's task "Steps 1–3" shows its text. The same holds for every NCT runbook and crosscheck below |
| `/nct/steps-4-10-runbook/` | `C:/Project/ZYT-Task/steps-4-10-runbook.md`, rendered by `hosting/hub/build-runbook.mjs` (marked; the article's rules are in `hub/runbook-body.css`) | Hand edits. Built, hidden from the list (`nav: hidden`) |
| `/nct/steps-11-15-runbook/` | `C:/Project/ZYT-Task/steps-11-15-runbook.md`, same renderer | Hand edits. Built, hidden from the list (`nav: hidden`) |
| `/nct/step-01-plan/` … `/nct/step-10-plan/`, `/nct/steps-4-10-crosscheck/` | `C:/Project/ZYT-Task/plans/step-0N-*.md`, `step-10-*.md`, `steps-4-10-crosscheck.md`, same renderer (kind "Plan" / "Crosscheck"). Built from the `$nctPages0110` table in `deploy-site.ps1` since 2026-09-23 | Hand edits. Published but unlisted: the plans are in `unlisted`, the crosscheck is a `pages` entry with `"nav": "hidden"` (Overview's page cards skip it). Their download buttons point at `steps-1-3-plans.zip` / `steps-4-10-plans.zip` |
| `/nct/step-11-plan/` … `/nct/step-15-plan/` | `C:/Project/ZYT-Task/plans/step-1N-*.md`, same renderer (kind "Plan") | Hand edits; decisions in each §9, all settled 2026-09-17. **Built and live, but deliberately not in `projects.json`** (2026-09-18): the page list would be 12 entries long, so the plans are reached from the steps 11–15 runbook's §0 table instead. A page can be published without being listed; only the listing is dropped |
| `/nct/steps-12-15-crosscheck/` | `C:/Project/ZYT-Task/plans/steps-12-15-crosscheck.md`, same renderer (kind "Crosscheck") | Hand edits. Built, hidden from the list (`nav: hidden`); an attachment of the task "Steps 11–15" |
| `/nct/steps-16-19-runbook/`, `/nct/steps-20-26-runbook/`, `/nct/step-27-runbook/` | `C:/Project/ZYT-Task/steps-16-19-runbook.md`, `steps-20-26-runbook.md`, `step-27-runbook.md`, same renderer | Hand edits. Written 2026-09-21; every decision settled the same day (recommended options, cross-plan X-items taking precedence); Waves 12–23. Built from the `$nctPages1627` table in `deploy-site.ps1`. Dashboard tasks "Steps 16–19", "Steps 20–26", "Step 27" since 2026-09-23 (56 steps, one per wave heading plus setup, gates and clean-up). Built, hidden from the list (`nav: hidden`) |
| `/nct/step-16-plan/` … `/nct/step-27-plan/` | `C:/Project/ZYT-Task/plans/step-{16..27}-*.md`, same renderer (kind "Plan") | Hand edits; decisions in each §9 settled 2026-09-21. Published but unlisted, like steps 11–15 |
| `/nct/steps-16-19-crosscheck/`, `/nct/steps-20-26-crosscheck/` | `C:/Project/ZYT-Task/plans/steps-16-19-crosscheck.md`, `steps-20-26-crosscheck.md` (kind "Crosscheck"). X17–X40 settled 2026-09-21 | Hand edits. Built, hidden from the list (`nav: hidden`); attachments of their tasks. Step 27's collision check is inside its runbook §2 |
| `/jwa/full-chain-sop/` | `C:/Project/JWASystemv2/jwa-system/sop/jwa-full-chain/sop.json` + `shots/` beside it | zyt pipeline. Registry id `jwa-system/jwa-full-chain` (draft); built with zyt-setup's `build-page.mjs` without `--no-ledger` since 2026-09-16, so its fix list is public (NCT's moved to the dashboard's Findings in Phase 4) |
| `/harper/guest-concierge-sop/` | `C:/Project/OpenWA/sop/guest-concierge/sop.json` (no screenshots), built with zyt-setup's `build-page.mjs` | zyt pipeline since 2026-09-21. Company `harper` ("Harper Suite", Harper Boutique Hotel at Sutera Avenue). Documents the live Kapso workflow `harper-concierge` + `harper-ops` + `harper-watch` in `OpenWA/kapso/`; Step 03 lists every question the bot answers. (A first version built from the unrelated `C:/Project/Kapso` prototype was replaced the same day.) Fix list public; empty `tracker/seed/*-harper.json` |
| `/harper/bot-answers/` | Generated at build time by `hosting/hub/build-bot-answers.mjs` from `C:/Project/OpenWA/kapso/prompt/kb.md` (the bot's knowledge base, one table per question in English, Malay and Chinese) plus `C:/Project/OpenWA/sop/guest-concierge/other-flows.md` (non-question messages), then rendered by `build-runbook.mjs` (kind "Reference") | Edit `kb.md` in OpenWA (that changes the bot too) or `other-flows.md`, then redeploy. A malformed `kb.md` entry fails the build |
| `/zyt/commands/` (ZYT commands) | `C:/Project/ZYT-Task/docs/zyt-commands.md`, same renderer (kind "Commands", company `zyt` in `projects.json`, empty `tracker/seed/*-zyt.json`) | Hand edits (h2 = table-of-contents entry); verify commands against the zyt skills' scripts |

| `/nct/downloads/*.zip` | Built by `deploy-site.ps1` from the runbook markdown plus the plans its prompts name (`steps-1-3-plans.zip`, `steps-4-10-plans.zip`, `steps-11-15-plans.zip`, `steps-16-19-plans.zip`, `steps-20-26-plans.zip`, `step-27-plans.zip`, `all-plans.zip`). The plans are also in git (`plans/`); the zip is the one-click copy. Public, like every other page (2026-09-18 decision) | Bundle lists live in `deploy-site.ps1`; a missing file fails the build |

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
| NCT step wording, routes, watch notes, chain breaks | `customer-intake-sop/sop.json` | Redeploy |
| NCT defects (the ranked `ledger.items` and each step's `guide[].fixes`) — what the dashboard's Findings list | `customer-intake-sop/sop.json`; keep each fix's `"id"` when rewording it (the ids are pinned so a reword never changes a Convex key; a fix added without one gets `s<nn>-<slug of title>`) | In this order: (1) edit `sop.json`; (2) `node tracker/build-seed.mjs` (rewrites `tracker/seed/tasks-nct.json` and `flow-nct.json` with the page's own id rules, `tracker/sop-findings.mjs`); (3) put each new id in a workstream's `covers` in `tracker/seed/client-tasks-nct.json`; (4) dev: `npx convex dev --once && npx convex run seed:nct` in `hosting/convex-app`; (5) **Wilfred:** `npx convex deploy -y && npx convex run --prod seed:nct`; (6) site deploy. **Agents never run step 5.** `hosting/hub/build-seed.mjs` fails the build while `tasks-nct.json` has other ids than `sop.json` gives: `tasks-nct.json is stale against customer-intake-sop/sop.json: missing […] extra […]`, or, for a reworded fix that lost its id, `fix "…" on step <n> changed id <old> → <new>. Pin the old id …` (`--sop <path>` checks a scratch copy) |
| NCT runbook text | `steps-4-10-runbook.md` (h2 = table-of-contents entry) | Redeploy |
| NCT screenshots | `customer-intake-sop/shots/` (names referenced by `sop.json`) | Redeploy |
| JWA SOP content | `sop.json` via `/zyt-update` in the JWA repo | Redeploy with `deploy-site.ps1` — the zyt skills' own publish step targets a separate Worker (`hosting/<worker-name>/`), not this site |
| Look or behaviour of every SOP page | `hosting/hub/sop-theme.css`, `sop-layout.css`, `sop-layout.js` | Redeploy |
| Dashboard UI | `hosting/hub/index.html` | Redeploy |
| Which pages a company's **Overview** shows as cards, and in what order | `hosting/hub/projects.json` — the company's `pages`, its SOP first, then the rest in file order; `"nav": "hidden"` leaves a page off. The internal company `zyt` is not in the switcher: its pages (ZYT commands) are the cards on the **Resources** header tab (`?page=zyt`). The header's three tabs (Projects · My tasks · Resources) are fixed in `index.html`, not read from `projects.json` (the old `"nav": "header"` flag is gone) | Redeploy |
| Task titles, detail, repair, source locations, workstreams | `tracker/seed/*-<key>.json` (NCT's `tasks-nct.json` and `flow-nct.json` are generated from `sop.json`, see NCT defects above; its workstreams stay hand-edited) | Redeploy; new task ids also need Convex rows (below) |
| Runbook stages and steps (what's next, owner, waits-for, link to a runbook section) | `tracker/seed/runbook-<key>.json` | Redeploy; new step ids need Convex rows — run `seed:nct` (dev and `--prod`) **before** the site deploy, or ticking them fails with "That task does not exist." A real deploy now refuses to ship while any key has no row (the seed-row preflight in `deploy-site.ps1`); a DryRun only warns |
| A wave heading in a task's runbook (`### Wave 12 — …`, `4. Wave 1: …`) | `tracker/seed/runbook-<key>.json` gets a step, in any task, whose `link` or `prompts` points at it | The build fails with `<source> wave heading #<id> has no step` until one does — a runbook cannot gain a wave without a checklist step. Every `Runbook` page with an `.md` source must be some task's `runbook` (`runbook page <href> is in no task`), so no runbook escapes this rule |
| The Tasks list: which tasks, their order, runbook, attachments, zip, SOP steps, settled date, migrations | `tasks[]` in `tracker/seed/runbook-<key>.json`. A task groups whole stages in order; each stage is in exactly one task. Task ids (`task-nct-…`) are not Convex keys but must not clash with a step or finding id. `runbook` is a `pages` href with an `.md` source, every `attach[].href` a listed or unlisted page, `download` a `/nct/downloads/<name>.zip` that the bundles build | Redeploy; no Convex rows needed. The build fails with the exact reason (`stage … is in no task`, `… is in two tasks (…)`, `task … attachment … is not a page in projects.json`, `download … is missing from …`) |
| Who a step is for ("My tasks") | `"assignee": "<first name>"` on the step (1–40 characters after trimming, the same rule as a tick's name). My tasks lists a task when a step is assigned to the viewer's name, or the viewer ticked one of its steps (case and spaces ignored) | Redeploy |
| Step numbers | None to edit: steps are numbered 1…N per task, in stage order, when the page loads. A wait on a step in another task reads "<task short> · <n>" (e.g. "Steps 11–15 · 18"). `waitsFor` holds step ids and may cross tasks | Reordering or inserting a step renumbers the rest of its task; ids and ticks are unaffected |
| A task's status | None to edit: derived from live ticks — Done (every step ticked), Waiting on Wilfred (every ready step is Wilfred's), In progress, Not started. A step is ready when it is open and everything it waits for is ticked | — |
| Look of runbook, plan and crosscheck text (page and dashboard) | `hosting/hub/runbook-body.css` — inlined into every page by `build-runbook.mjs` and into the dashboard by `deploy-site.ps1` (the `RUNBOOK_CSS` placeholder). Page-only rules (table of contents, kicker, source line) stay in `build-runbook.mjs` | Redeploy |
| Add a company or a page | `projects.json` + seed files + a build block in `deploy-site.ps1` + the path in `PAGES` in `hosting/pwa/sw.js` + a seed mutation in `convex-app/convex/seed.ts` | Redeploy; run its seed |
| Brand (logo, palette, fonts) | `hosting/hub/brand/BRAND.md`, files beside it, `hosting/pwa/make-icons.ps1` | Redeploy |
| A runbook step's **Run golden path** button | `"run": "<job id>"` on the step in `tracker/seed/runbook-<key>.json`; job ids and what they run live in `JOBS` in `hosting/runner/server.mjs` | Redeploy (the job itself needs no deploy — restart the runner) |
| Tick state | Never by hand — through the dashboard | — |

## What gets a page, and what gets listed (2026-09-18)

Every plan and runbook lives on this site; a markdown file left only in `plans/` is not done.
But **being published and being listed (as a card on the company's Overview) are two different things**:

| | Page built | Listed on Overview (`projects.json`) | Why |
|---|---|---|---|
| SOPs, ZYT commands, other companies' pages | yes | yes | People browse to them, read them on a phone, and link to a section |
| NCT runbooks and crosschecks (since Phase 3, 2026-09-23) | yes | **no** — `pages` entries with `"nav": "hidden"` | The dashboard's Tasks view shows each runbook's text in its task and each crosscheck as an attachment. They stay `pages` entries (with `source`) so steps can take snippets from them and the build can check anchors; Overview filters `hidden` out. Their URLs still work |
| Step plans (`/nct/step-01-plan/` … `step-27-plan/`) | yes | **no** — listed in the company's `unlisted` array | 700–1000 lines each; five more rows would bury the runbooks. They are reached from the steps 11–15 runbook's §0 table and from dashboard steps that deep-link a section (six stage D steps point into the step 11 plan) |

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
   only); anything else gets an entry in `pages`: `type` (SOP · Runbook ·
   Plan · Crosscheck · Commands, shown as the chip), `title`, `href` (`/nct/<slug>/`) and `source`
   (repo-relative path; the build reads its mtime for "last edited" and fails if it is missing).
   An NCT **runbook** is a `pages` entry with `"nav": "hidden"` **plus** a `tasks[]` entry in
   `tracker/seed/runbook-nct.json` (`runbook` = its href, its stages, its plans and crosscheck in
   `attach`, its zip in `download`) — the Tasks view is where people read it. A crosscheck is a
   hidden `pages` entry and an `attach` item of its task.
   `build-seed.mjs` accepts a dashboard-step link to any listed **or** unlisted path, and rejects
   anything else, so a typo in a link still fails the build.
3. **`hosting/deploy-site.ps1`** — copy an existing block: run `hub/build-runbook.mjs <src> <body>
   [kind]`, then `Write-Utf8 … (Get-SopHtml … 'nct' 'NCT')`. Use forward slashes in `Join-Path`
   arguments.
4. **`hosting/pwa/sw.js`** — add the path to `PAGES`, or the page is missing offline. The build
   throws `sw.js PAGES lists <path>, which was not built` if a `PAGES` path has no page, because one
   missing page makes the service worker's install fail silently.
5. **Deploy**: `-DryRun` first, then the real run (below).

A runbook whose prompts name plan files also needs a **download bundle**, so a colleague gets the
plans as files in one click: add it to `$bundles` in `deploy-site.ps1` (the runbook markdown plus every plan its prompts
name) and link it from the runbook's "Get the files" section as `/nct/downloads/<name>.zip`. The
build fails if a listed file is missing, so a renamed plan is caught at deploy time.

**Prompts and commands on dashboard steps.** A runbook step's panel offers a "Show and copy"
dialog with the code blocks (session prompts, bash, SQL) of the section its `link` points at.
`build-seed.mjs` reads them from the page's markdown source at build time, so they always match the
page — never paste prompt text into the seed. When one step needs other or several sections, give
it `prompts`: a list of full links (`/nct/<page>/#<heading-id>`); the build fails if an id does not
exist, so a renamed heading is caught. Heading ids follow `build-runbook.mjs`'s slug rules, and a
block's label is the short line or `###` heading just above it. A step that points into a markdown
page must yield at least one block; if its section has none by design (a decisions or
disagreements section), give it `"snippets": false`, or the build fails with
`takes no snippets from … (set "snippets": false if that is by design)`.
`node hosting/hub/build-seed.mjs --report-snippets` lists the steps that would fail, and
`--runbook <path>` builds from a scratch copy of the seed, so negative tests never edit tracked files.

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

**Published recordings.** `node hosting/runner/publish-recordings.mjs` copies the runner's passed saves
into `hosting/recordings/` (TRACKED — a deploy from another worktree must not wipe them), and
`deploy-site.ps1` publishes them at `/golden-paths/<job>.json` + `<job>-<n>.mp4`. A journey with several
people has one clip per person (one browser context each); the JSON names each clip's role, and the
panel offers a "whose screen" switcher (Salesperson · Branch manager · Accountant…). Every panel loads its journey's
published recording first, with no runner needed, on any machine; a newer local save replaces it
on screen, and Regenerate still needs the runner. The service worker leaves `/golden-paths/` alone
(video is fetched in Range requests, which a cached whole response answers wrongly). The site is
public, so these videos are too: they may only ever show the throwaway e2e orgs.

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
- JWA jobs, each a project in `_e2e/golden.config.ts` of the JWA worktree `JWA_DIR` (default
  `C:/Project/JWASystemv2/jwa-golden`, branch `feat/jwa-golden-paths`), run with `bunx` from
  `apps/web` against a web server of their own on **:3700** (a trusted auth origin; :3300 is another
  worktree's) and the shared dev Convex, writing only `E2E-DEEP-` rows they delete afterwards:
  `jwa-setup-steps-1-4`, `jwa-raise-steps-5-8`, `jwa-buy-steps-9-10`, `jwa-receive-steps-11-14`
  → `_e2e/golden-out/<project>/`, clips already in story order (`meta.json` `storyOrder: true`).
- The SOP step → job map is `BY_STEP` in `hub/golden-path.js`, keyed by SOP (the page's first path
  segment: `nct`, `jwa`), so one SOP's recordings never show on another's steps.
- NCT reads `DATABASE_URL` and `BETTER_AUTH_SECRET` from `nct-layout/apps/server/.env`; the suite
  seeds its own organization, refuses the production database and tears the org down.
- Accepts requests only from `https://admin.zhiyuantech.ai` (plus `RUNNER_EXTRA_ORIGINS`, e.g.
  `http://localhost:8791` for a `-DryRun` preview — `.claude/launch.json` has `hub-preview` and
  `golden-path-runner`). One run at a time. Env: `NCT_DIR`, `JWA_DIR`, `RUNNER_PORT`, `RUNNER_SLOWMO` (ms, 600).
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
  `#fixes`, `.fixbrowser`, `#document`, `#doc-body`, `#doc-toggle`, `window.SOP.showStep`, `window.chainFocus`,
  `.sm-backdrop`. The page's own chart scripts also key on `.cn[data-step]` and `.cb[data-brk]`.
  `#fixes` and `.fixbrowser` exist only on JWA and Harper now (NCT is built with `--no-ledger`).
  **Embed mode:** the dashboard's Overview frames an SOP page at `<page>?embed=1`, which adds
  `html.zyt-embed` (the ZYT top bar hidden, no top offset); `#step-N` in the frame's hash opens that step.
  Renaming any of them in the source breaks the hosted layout.
- **`#step-N` anchors** are linked from the dashboard's task panel (`/nct/customer-intake-sop/#step-N`).
- **Task ids and runbook step ids in `tracker/seed` are Convex keys** (one key space, rows in `findings`). Renaming one orphans its tick history. NCT's finding ids come from `sop.json` (`nct-` + the ledger item's `id` or the fix's pinned `id`), so never change an `"id"` there either. Runbook `link` anchors are the renderer's heading slugs, so renaming a runbook heading breaks the link.
- **Dashboard URLs** (query parameters only; shared links depend on them):

  | URL | Opens |
  |---|---|
  | `/?company=nct` | **Tasks** when the company has a runbook, otherwise Overview when it has pages, otherwise Findings (header tab **Projects**) |
  | `?page=mine` | **My tasks** (header tab): every company's runbook steps assigned to the viewer's name (`zyt.author`), or owned by Wilfred when the name is Wilfred, grouped by company and task |
  | `?page=zyt` | **Resources** (header tab): the internal company's own pages. A bare `?company=zyt` (the ZYT pages' crumb) lands here too |
  | `?view=tasks` / `?view=overview` / `?view=findings` | that view |
  | `?view=runbook` (legacy) | Tasks |
  | `?task=task-nct-steps-4-10` | the task view |
  | `?task=rb-nct-b3-merge-wave-1` (a **step** id; `docs/zyt-commands.md` links these) | the owning task, with that step expanded, scrolled into view and outlined |
  | `?task=nct-identity` (a **finding** id) | Findings, with its panel open |
  | `?view=findings&step=8` | Findings filtered to SOP step 8 |
  | `?view=overview&step=5` | Overview, the embedded SOP opened at step 5 (sets the frame's `#step-5`, no reload) |
- **Step ids stay Convex keys; display numbers are per task.** Never renumber or rename an id to
  match a display number — the number is computed, the id holds the tick history.
- **The task view reads `article.rb-body` and `nav.rb-toc` from the served page** (it fetches the
  runbook or plan URL and parses it), so `build-runbook.mjs` must keep emitting both, and the page's
  `.rb-body` rules must stay in `runbook-body.css`, not in the page-only CSS.
- **Old SOP ticks after a rollback.** The Findings import renames each browser key it applied to
  `<key>.imported` rather than deleting it. To undo that on one browser, run in the site's console:
  `['sop.customer-intake-sop.fixDone','sop.fixDone'].forEach(function(k){var v=localStorage.getItem(k+'.imported');if(v!==null){localStorage.setItem(k,v);localStorage.removeItem(k+'.imported');}});localStorage.removeItem('zyt.sopTicksDismissed');`
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
