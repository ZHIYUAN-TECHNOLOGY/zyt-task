# Runbooks as tasks: implementation plan

Session `_plan/09-23_runbook-tasks/` · written 2026-09-23 · revised 2026-09-23 after a three-lens review (see "Review disposition" at the end) · tier **Standard** · 4 phases.
Inputs: the brief relayed by the workflow (decisions already taken, the known issues, coordination rules);
`_plan/09-23_runbook-tasks/mockup.html`, read in full (its template, its script at lines 202-376 and its
embedded data: 8 tasks, 6 runbooks, 2 loose); `hosting/SITE.md` (the site contract); and four evidence
reports (dashboard, runbooks, findings, site). The codebase was re-checked in this pass, and where an
evidence line number was wrong the correct one is used below.

---

## Phase 0: findings

**Stack.** This is a static site with no framework and no bundler.
- `hosting/hub/index.html` (1098 lines) is the whole dashboard: vanilla JS and an `h()` DOM helper.
- The seed is built by `hosting/hub/build-seed.mjs` (Node ESM with `marked`, installed in `hosting/node_modules`).
- Pages are rendered by `hosting/hub/build-runbook.mjs` (`marked`) and assembled by `hosting/deploy-site.ps1` (Windows PowerShell 5.1).
- Live ticks are in Convex 1.45.0 (`hosting/convex-app/convex/{schema,findings,seed}.ts`), with dev `small-snail-912` and prod `impartial-sockeye-436`.
- Hosting is a Cloudflare assets-only Worker (`hosting/site/wrangler.jsonc`, `html_handling: auto-trailing-slash`), and there is a PWA service worker at `hosting/pwa/sw.js`.
- There is no auth. Viewer identity is the name in `localStorage['zyt.author']` (index.html:538).

**Precedent.**
- *Unlisted but published pages:* `projects.json` `unlisted` (lines 76-94), the step 11–27 plans.
- *A page flag that changes where a page is listed:* `nav: "header"` (projects.json:159), filtered at index.html:616 and :637.
- *Build-time content checks:* build-seed.mjs:76-82 (every finding in exactly one workstream) and :92-105 (stage has steps, unique ids, owner, waitsFor, links).
- *Section extraction from markdown:* `sectionsOf` / `snippetsFor`, build-seed.mjs:37-69.
- *Step panel:* `renderStepPanel`, index.html:831-876.
- *Golden-path panel cache:* `GP_PANELS` / `gpSection`, index.html:878-890.
- *Hosted-page layer hooks:* `hosting/hub/sop-layout.js` / `.css`.
- *Mockup behaviour we copy:* `status()`, `readySteps()` and the chip filters (mockup.html:212-239).

**Touch surface (all verified to exist unless tagged [NEW]).**
- Phase 1 content: `tracker/seed/runbook-nct.json` (486 lines).
- Dashboard: `hosting/hub/index.html`.
- Build: `hosting/hub/build-seed.mjs`, `hosting/hub/projects.json`, `hosting/deploy-site.ps1`, `hosting/pwa/sw.js`.
- Hosted-page layer: `hosting/hub/sop-layout.js`, `hosting/hub/sop-layout.css`.
- Findings source: `tracker/build-seed.mjs` and `tracker/seed/tasks-nct.json`.
- Docs: `hosting/SITE.md`, `README.md`, `tracker/SCHEMA.md`.
- Runbook sources (read only for the wave check): `steps-1-3-runbook.md`, `steps-4-10-runbook.md`, `steps-11-15-runbook.md`, `steps-16-19-runbook.md`, `steps-20-26-runbook.md`, `step-27-runbook.md`.
- Plan sources: `plans/step-01…10-*.md` and `plans/steps-4-10-crosscheck.md` (all tracked in git, 31 files under `plans/`).

**Migration state.** There is no SQL. The Convex schema is unchanged in every phase, and Convex has no migration journal. The only data prerequisite is the seed order for new step keys: bundle, then `seed:nct`, then the site deploy (SITE.md:60, 140-142).

**Verified this pass (and corrections to the evidence).**
- `findings.ts` is 54 lines: `HISTORY_LIMIT = 300` at :5, `board` at :9, `setState` at :35, the name check (1–40 characters) at :39, and "That task does not exist." at :46. One evidence report cited :36/:66/:70/:77, which is wrong.
- `seed.ts` is 49 lines. It reads `runbook.stages[].steps[].id` only (:8, :25-30), so a new top-level `tasks` array in runbook-nct.json does not affect it.
- Stage A has **3** steps (a1–a3), not 4.
- Stage order in the file is A, B, C, D, E, F. Stage D (7 steps) and F (12) together make the steps 11–15 runbook.
- The only uncommitted seed edit is `"run": "nct-order-open-steps-11-15"` on `rb-nct-f11-wave-11`, made by the golden-path session.
- Wave headings, recounted with the build's own lexer and slugger: steps 1–3 = 3 (h2), 4–10 = 4, 11–15 = 10, 16–19 = 11, 20–26 = 19, 27 = 3. All 17 in runbooks 1–15 are already the `link` or a `prompts` entry of some step. None of the 33 in runbooks 16–27 is.
- `projects.json` lists **3** crosschecks (12–15, 16–19, 20–26), not 4. The fourth, `plans/steps-4-10-crosscheck.md`, has no page. Phase 2 builds it.
- The SOP page's local ticks are stored as a JSON array of bare ledger ids under `localStorage['sop.customer-intake-sop.fixDone']`. The built page shows this at L2699, L2830 and L2835. It is **the same origin** as the dashboard, so the dashboard can read it (D22).
- The mockup's 16–19, 20–26 and 27 tasks attach `all-plans.zip`. `deploy-site.ps1:334-336` already builds `steps-16-19-plans.zip`, `steps-20-26-plans.zip` and `step-27-plans.zip`, so the tasks use those.
- The runner accepts a comma list in `RUNNER_EXTRA_ORIGINS` (parsed at server.mjs:34).
- `deploy-site.ps1` calls build-seed.mjs at **:358** (`if ($LASTEXITCODE -ne 0)` at :359). The deploy lock is `hosting/site/.deploy.lock` (:33); a lock whose pid is alive and younger than 45 minutes blocks every build (:48-53).
- `hosting/hub/build-seed.mjs` resolves every input from the repo root (:11, :15) and takes only the output path (argv[2]). A test cannot point it at a scratch copy today; Phase 1 adds `--runbook`, Phase 3 `--public`, Phase 4 `--sop` (§4.3).
- **Convex in a fresh worktree:** `hosting/convex-app/.env.local` (holds `CONVEX_DEPLOYMENT=dev:small-snail-912`) is ignored by `hosting/convex-app/.gitignore:2`, and `node_modules/` by `.gitignore:4`. `convex-app` has its own `package.json` (convex 1.45.0). `deployment.json` (tracked) names prod `impartial-sockeye-436`. §7.4 sets the worktree up.
- **Snippets today:** the decisions anchors (`#1-before-any-wave-starts-…`) and `#12-where-the-plans-and-the-crosscheck-disagree` of runbooks 16–19, 20–26 and 27 have **0** code blocks (counted with the build's lexer). `#4-one-time-setup` has 2, `#8-stop-gates-owner-only` 1, `#11-clean-up` 1. On HEAD, `rb-nct-f1-commit-e2e` and `rb-nct-f12-unowned-gaps` yield none.
- **Existing waits that shape the journeys:** `rb-nct-f2-wave-6` waits for d5 and f1; `rb-nct-f5-gate-15-probes` waits for f2; `rb-nct-f6-wave-7` waits for f5 **and** f3. Stage D's d1, d2, d7 and stage F's f1, f12 have no waits.
- **Findings source facts:** none of the 30 `guide[].fixes[]` in `customer-intake-sop/sop.json` carries an `id`, so all 30 keys come from the title (template: `f.id != null && f.id !== "" ? String(f.id) : "s" + pad(g.n) + "-" + slug(f.title)`, sop-template.html:2765). None of the 18 ledger items has a `status`, `fixedAt` or `origin` today, but `/zyt-audit` writes them. The hand-written `customer-intake-sop.html` used the older key `sop.fixDone` (:2729) with the same 48 ids. `tracker/build-seed.mjs` also writes `tracker/seed/flow-nct.json` (:95), with step 1's title scraped as "Read the enquiry Email only" (the badge appended); `sop.json` `steps[0].title` is "Read the enquiry".
- The SOP template has `#doc-toggle` / `#doc-body` (built page L1537, L1544).
- `SEED.projects[].tasks` already means *findings* in the client (index.html:509). Runbook tasks therefore need another name: `runbook.tasks` in the seed and `p.rbTasks` in the client.

**Tier.** Standard. The work changes a seed shape, the build rules and the site's URL contract, and touches more than 10 files.

**No Input Gate was held.** Every structural choice was already taken by Wilfred (D2–D10), taken by recommendation and recorded as overturnable (D11, D12), or assumed by this plan with its alternatives written out (D13–D35). One question is left Open (D1, the `run` placement on the new steps). It belongs to the golden-path session and blocks nothing.

---

## 1. Overview

### Problem
The dashboard's Runbook view is a single list of stages lettered A–F, and each runbook is a separate listed page. The two are hard to relate:
- The 11–15 runbook is split across stages D and F, and stage E ("Anytime") sits between them.
- Steps are numbered by stage letter ("F2 waits for D5").
- Runbooks 16–27 have pages but no checklist, so nothing on the dashboard says what is next for them.
- The plans for steps 01–10 have no pages.
- The sidebar carries 6 runbook and 3 crosscheck entries.
- "What to fix first" exists twice: on the SOP page (ticks in each browser's localStorage) and as the dashboard's Findings (ticks in Convex).

### Goal
Each runbook becomes one **task**, shown in a Linear-style task view:
- a checklist of its steps (with the existing ticks, the prompts dialog and golden-path buttons)
- the full runbook text with its own section nav
- a right rail of properties, attachments (the plans in a slide-over, plus the zip) and activity.

The left menu becomes **Overview · Tasks · Findings**:
- Overview is the SOP chain and document.
- Tasks is the list of runbook tasks plus the loose stages A and E.
- Findings is the single "What to fix first" list, with its ticks in Convex.

### Success criteria
- `/?company=nct` opens **Tasks**. It lists 8 tasks (6 runbooks and 2 loose), each with a derived status, progress, the next ready step, owners and an attachment count. The chips All · Open · Needs Wilfred · My tasks filter the list.
- Opening a task shows its checklist with per-task numbers. A cross-task wait reads "Waits for Steps 4–10 · 2" and links to that step. The body of the runbook appears below the checklist. Every heading id is the same as on the unlisted page.
- Every wave heading in all six runbooks has at least one step, and the build fails otherwise. Steps 16–27 have checklists: 33 wave steps plus their setup, gate and clean-up steps.
- Every plan (01–27) and all four crosschecks open as text in a slide-over. Each task's zip downloads.
- The runbook and crosscheck pages still build at their old URLs, and every old deep link resolves. That includes `?task=rb-nct-b3-merge-wave-1` (docs/zyt-commands.md:272) and `?view=findings`.
- The SOP page no longer shows "What to fix first". The dashboard's Findings has rank order and a per-step filter, and it is the only place those findings are ticked.
- The top bars are opaque, so scrolled pages no longer go blank in the embedded browser.

### Scope
**In:**
- the NCT tasks, task view and slide-over
- the menu
- Overview (iframe) and the merged Findings
- steps 16–27 content
- plan pages 01–10 and the steps 4–10 crosscheck
- the build rules
- the top-bar fix
- SITE.md and README updates.

**Out:**
- JWA and Harper runbooks. They have none. Their SOPs keep their own fix lists, because their tracker seeds are empty (0 findings) and they are not built with `--no-ledger`.
- Editing assignees from the page (D11).
- Comments on findings (D12).
- Any change to the zyt-setup skill template.
- Production deploys and prod Convex runs, which are Wilfred's.
- The golden-path panel internals (another session owns them).

### Assumptions
Each line points to its entry in §9.
- The runbooks are unlisted with `"nav": "hidden"` on their `pages` entry, which keeps `source` → D13
- A top-level `tasks` array groups the existing stages. Stage and step ids do not change → D14
- The task view parses the already-served page for the runbook and plan text. No new fragment URL → D15
- Steps are numbered per task. A cross-task wait is qualified by the task's short name → D16
- A step's detail expands inline in the checklist, not in a right-hand drawer → D17
- The slide-over renders plan text in a shadow root, which isolates its heading ids → D18
- Overview is an iframe of the SOP with a new `?embed=1` mode in sop-layout.js → D19
- The NCT SOP is built with `--no-ledger` → D20
- `tasks-nct.json` is regenerated from `sop.json`, and the build fails on drift → D21
- A one-time banner imports a browser's old SOP ticks → D22
- The work happens in a sibling git worktree. Only Wilfred deploys prod → D23
- The activity feed keeps the 300-event cap and says so when it is hit → D24
- The page list keeps the golden-path session's design minus the hidden pages → D25
- Tasks is the default view. Legacy URLs map as in §4.5 → D26
- New step ids use the pattern `rb-nct-<range>-<slot>` → D27
- A wave heading is detected with the lexer rule `^(\d+\.\s*)?Wave\s+\d+` → D28
- Both top bars become opaque. No `backdrop-filter` → D29
- Phase order is content first → D30
- Task properties and attachments are hand-written in the seed and checked by the build → D31
- `flow-nct.json` is regenerated from `sop.json` together with the findings, so no script reads `customer-intake-sop.html` any more → D32
- The 30 step-fix ids are pinned into `sop.json` once (`"id"` on each fix), so rewording a fix can never change its Convex key → D33
- `deploy-site.ps1` refuses a real deploy while any seed key has no Convex row on the target deployment → D34
- Negative build tests run through `--runbook`/`--sop`/`--public`/`--out-dir` overrides on scratch copies, never by editing tracked files → D35

---

## 2. User journeys

Each journey gives the old flow and the new one side by side. Step numbers are row numbers. "(same)" marks a step that does not change.

### J1: Wilfred ticks a stop gate (the steps 11–15 "Gate 15 probes" step)
Trigger: a session finishes Wave 6. Wilfred opens the dashboard on his laptop.

| # | OLD (today) | NEW |
|---|---|---|
| 1 | Opens `/?company=nct` → the **Runbook** view: stages A–F as one long list, with step numbers such as `F5` | Opens `/?company=nct` → the **Tasks** list: 8 rows, each with a status pill, progress bar, next ready step, owners and ⧉ attachment count |
| 2 | Scans stage F for "Ready" chips, or filters with All/Open/Done | Clicks the **Needs Wilfred** chip → only tasks with a ready Wilfred-owned step remain. "Steps 11–15" is listed, and its next ready step reads "12 Gate 15 probes" when that is its first ready step (per-task numbers: Step 11's d1–d7 are 1–7, stage F's f1–f12 are 8–19). If every ready step is Wilfred's, its status reads **Waiting on Wilfred** |
| 3 | Clicks `F5` → the right-hand drawer shows the facts, "Show and copy" and "How to do it", which links out to the runbook page | Clicks the row → the **task view** opens full width with no page load, and the URL becomes `?company=nct&task=task-nct-steps-11-15` (a history entry, so Back returns to the list). The checklist is on top, grouped "Step 11" / "Steps 12–15" |
| 4 | Clicks "How to do it" → navigates away to `/nct/steps-11-15-runbook/#8-stop-gates-owner-only` | Clicks step **12** → it expands inline: detail, "⧉ Show and copy", "Waits for 9 · Wave 6 ✓", and **How to do it**. That link scrolls the runbook body below to `#8-stop-gates-owner-only` inside the same view |
| 5 | Comes back and ticks `F5` (asks for a name the first time) | Ticks the circle on step 12 (the name dialog appears if no name is set). An optimistic tick, then Convex. On error a toast shows and the tick reverts (same) |
| 6 | Sees `F6` switch to Ready once F3 is also ticked | Step 13 "Wave 7" shows **Ready** once 10 (Gate 13 P8) is also ticked (f6 waits for f5 and f3). The status pill is recomputed (§4.6), e.g. **Waiting on Wilfred → In progress** when a session step becomes ready. Activity in the rail adds "Wilfred ticked 12 · just now" |
| End | Tick stored in `findings`, `rb-nct-f5-gate-15-probes` = done (same key) | Same row, same key. Nothing in Convex changes |

Where it lives: the middle column of `/` (Tasks list), then the full-width task view on the same page. The step detail expands inline.

### J2: An implementer runs a wave and copies its prompt (steps 16–19, Wave 12, `wt-step16`)

| # | OLD | NEW |
|---|---|---|
| 1 | Opens `/` → the Runbook view has **no steps for 16–27** | Opens `/` → Tasks → "Steps 16–19". Status **Not started**. Next ready step: "1 One-time setup" (steps 1–3 have no waits; the list shows the first ready step) |
| 2 | Opens the listed page `/nct/steps-16-19-runbook/` from the sidebar | The task view shows 20 checklist steps (Appendix A.1). The body below is the full runbook, with a section nav for its 14 h2 sections |
| 3 | Scrolls to "Wave 12 — wt-step16" and selects the code block by hand | Step 4, "Wave 12 · wt-step16", shows "Waits for 1 · One-time setup, 3 · Wave 12 probes, Steps 11–15 · 18 Wave 11". The cross-task wait is a link that opens the Steps 11–15 task and highlights its step 18 |
| 4 | Copies the prompt | Once all three are ticked, step 4 shows **Ready**. **⧉ Show and copy** opens the "Prompts and commands" dialog (the same dialog as today) with the `#wave-12-wt-step16` blocks → **Copy** → toast "Copied" |
| 5 | Nothing to tick. Progress lives in their head | When the PR merges, the implementer ticks step 4 (their name is set). The task becomes **In progress**, and **My tasks** now includes it for them |
| End | — | Key `rb-nct-1619-w12-step16` = done, `updatedBy` = the implementer |

Where it lives: task view (Tasks). Snippets use the existing `#snip-dialog`.

### J3: A colleague reads and downloads the plans

| # | OLD | NEW |
|---|---|---|
| 1 | Plans 11–27 are unlisted. The colleague reaches them from a runbook's §0 table. Plans 01–10 have **no page** | Opens Tasks → "Steps 4–10" → **Attachments**: Step 04 … Step 10 plans, "Crosscheck · Steps 4–10", "⤓ steps-4-10-plans.zip" |
| 2 | Opens the runbook page and clicks "Download the plans (zip)" | Clicks "Step 08 · quotation approval integrity" → a **slide-over** opens on the right (full width on a phone) with the plan **text only**: no top bar, no page nav. Its own section list sits at the top |
| 3 | Reads plan 11–27 pages. Plans 01–10 only by unzipping | Clicks a `#7-…` link inside the plan → the slide-over scrolls to that section. "Open page ↗" opens `/nct/step-08-plan/`, and "⤓ zip" downloads the bundle |
| 4 | — | Esc or Close → the slide-over closes and focus returns to the attachment button |
| End | File downloaded, or page read | Same zips (unchanged names). Every plan also has a page |

Where it lives: the task view's right rail, then the slide-over sheet (`<aside id="sheet">`) with a scrim.

### J4: Reading the SOP chain or the document

| # | OLD | NEW |
|---|---|---|
| 1 | Clicks "When a Customer Comes In" in the page list → navigates to `/nct/customer-intake-sop/` | Clicks **Overview** in the left menu → the SOP appears inside the dashboard, in an iframe of `/nct/customer-intake-sop/?embed=1`, with no second top bar |
| 2 | The page shows the chain pane, "What to fix first" and "The document" (collapsed) | The page shows the chain pane and **The document, already expanded**. There is no "What to fix first": it is now Findings |
| 3 | Clicks "The whole chain" on the right-edge tab → a full-screen sheet with the role rail | Clicks **Open the whole chain** in the Overview header, or the tab inside the frame → the same sheet, sized to the frame (the frame fills the viewport below the top bar) |
| 4 | Toggles the theme on the page | Toggles the theme in the dashboard → the frame restyles at once (a `storage` event in sop-layout.js) |
| 5 | — | "Open full page ↗" opens the page on its own. `?role=` and `#step-N` links still work there (same) |

Where it lives: the Overview view, in the middle column at full width.

### J5: Triaging findings

| # | OLD | NEW |
|---|---|---|
| 1 | SOP page → "What to fix first": 18 ranked plus 30 step fixes, a left rail by step, and ticks **in this browser only**. The comment box is disabled. *Or* the dashboard → Findings: 10 workstreams, ticks in Convex | Clicks **Findings** → one list of 48, ticks in Convex. **Group by: Workstream · Rank · SOP step**. A **Step** filter with open counts; "Chain #N" and "new" chips |
| 2 | Clicks a ledger item → the detail, and "repairs" chips that focus the chain. An item `/zyt-audit` marked fixed shows locked as done | Clicks a finding → the right-hand panel (same as today): rank, detail, planned repair, source, "Where in the SOP" (now opens **Overview** at `#step-N`), and history. An audit-fixed item shows a read-only **Fixed (audit)** chip with its date and counts as closed (§4.8) |
| 3 | Ticks it: localStorage (SOP), or Convex (dashboard). **Two different answers** | Ticks it → Convex. There is one answer, and the history shows who and when |
| 4 | — | The first time this browser opens Findings with old SOP ticks present (either old key, §4.8), a banner reads "This browser has 5 ticks from the old SOP list:" followed by their titles, then "Apply them as <name>? / Dismiss". Apply sets each `nct-<id>` to done under the viewer's name and today's time (the old ticks had neither), skips any a colleague has since reopened, and renames the key to `….imported` only when every write succeeded |
| End | — | `/?company=nct&view=findings&step=8` is shareable |

Where it lives: the Findings view (middle column plus the right-hand panel, as today).

### J6: Phone use (375 px)

| # | OLD | NEW |
|---|---|---|
| 1 | One column. `.switcher-row` and `#mobile-pages` show the page links | One column. The switcher row holds a three-way **Overview · Tasks · Findings** segmented control, and the hidden pages are gone from `#mobile-pages` |
| 2 | Runbook list, and the drawer slides over | The Tasks list collapses to status dot · title · progress. Chips wrap |
| 3 | Taps a step → the drawer | Taps a task → the checklist first, then a **"Sections" `<details>`** instead of a sticky nav, then the body. The rail (properties, attachments, activity) sits **below the checklist**, above the body |
| 4 | Scrolled pages sometimes blank (backdrop-filter) | The top bar is opaque and nothing blanks |
| 5 | — | Opens a plan → a full-width sheet with a sticky Close button |

---

## 3. Result

**Before:** a lettered A–F step list, six runbook and three crosscheck pages in the sidebar, no checklist for steps 16–27, no pages for plans 01–10, and two separate "what to fix" lists with different ticks.

**After:** the left menu is Overview · Tasks · Findings. Each runbook is one task holding its checklist, its whole text and its attachments. Steps 16–27 have checklists. Every plan opens in a slide-over. There is one findings list, ticked in Convex.

**Key differences:**
- **Wilfred:** "Needs Wilfred" lists the tasks with a ready gate. Status is derived from ticks, never set by hand.
- **Implementers:** a wave's prompt, its runbook section and its plans are all in the task. "My tasks" lists what they are assigned or have ticked.
- **Colleagues:** plans 01–27 and all four crosschecks read as text in a slide-over. The zips are unchanged.
- **Everyone:** the SOP's "What to fix first" now lives in Findings, and the old browser-only ticks can be imported once.
- **Links already shared** (runbook anchors, `?task=<step id>`, `?view=findings`) keep working.

---

## 4. Technical architecture

### 4.1 Data flow (all journeys; §10 golden paths of every phase)
```
tracker/seed/runbook-nct.json ──┐   (stages[] unchanged; + tasks[]; steps may carry assignee)
hosting/hub/projects.json ──────┤   (runbooks/crosschecks: nav "hidden", source kept)
*-runbook.md (read for checks) ─┤
                                ▼
            hosting/hub/build-seed.mjs  → hosting/site/seed.json → inlined into index.html (/*SEED_JSON*/)
                                             checks: wave coverage, task membership, attach hrefs, assignee
index.html (client)
  ├─ Tasks list / task view ← SEED.runbook.tasks + live ticks (Convex findings.board)
  ├─ runbook body + plan text ← fetch('/nct/<page>/') → DOMParser → article.rb-body + nav.rb-toc  (D15)
  ├─ Overview ← <iframe src="/nct/customer-intake-sop/?embed=1">  (D19)
  └─ Findings ← SEED tasks/workstreams + live ticks (unchanged store)
Convex: findings + events unchanged; seed:nct inserts rows for the new 16–27 step ids.
```

### 4.2 Seed shape: `tracker/seed/runbook-nct.json` (Journey J1 step 1, J2 step 1, J3 step 1)
Unchanged: `stages[]` and every existing stage and step id. `seed.ts` keeps reading `stages[].steps[]`.

Added:
```jsonc
{
  "tasks": [
    {
      "id": "task-nct-steps-11-15",            // not a Convex key; unique across step and finding ids
      "title": "Steps 11–15 · convert → job number → intake → job shape → order approval",
      "short": "Steps 11–15",                  // qualifier for cross-task references ("Steps 11–15 · 18")
      "runbook": "/nct/steps-11-15-runbook/",  // a pages[] href with a .md source (listed or nav:hidden)
      "stages": ["rb-nct-d-step-11", "rb-nct-f-steps-12-15"],  // ordered; each stage in exactly one task
      "sop": "11–15",
      "settled": "2026-09-17",                 // optional, shown as a property
      "migrations": "none under the settled options",  // optional
      "attach": [                              // plans and crosschecks, in reading order
        { "kind": "Plan", "title": "Step 11 · convert won quote", "href": "/nct/step-11-plan/" },
        { "kind": "Crosscheck", "title": "Steps 12–15", "href": "/nct/steps-12-15-crosscheck/" }
      ],
      "download": "/nct/downloads/steps-11-15-plans.zip"
    },
    { "id": "task-nct-before-deploy", "title": "Before anyone deploys the site again", "short": "Before deploy",
      "loose": true, "stages": ["rb-nct-a-before-deploy"], "attach": [] },
    { "id": "task-nct-anytime", "title": "Anytime · MCP access, NCT app URL, JWA tasks", "short": "Anytime",
      "loose": true, "stages": ["rb-nct-e-anytime"], "attach": [] }
  ],
  "stages": [ /* unchanged, plus rb-nct-steps-16-19, rb-nct-steps-20-26, rb-nct-step-27 (Phase 1) */ ]
}
```
There are 8 tasks, in list order:
1. Before deploy (loose A)
2. Steps 1–3 (B)
3. Steps 4–10 (C)
4. Steps 11–15 (D, F)
5. Steps 16–19 (new stage)
6. Steps 20–26 (new stage)
7. Step 27 (new stage)
8. Anytime (loose E)

The mockup's attachment lists are adopted, with the zip corrected per runbook (Phase 0).

Step additions (all optional):
```jsonc
{ "id": "...", "owner": "wilfred|session", "title": "...", "detail": "...", "waitsFor": ["<step id, any task>"],
  "link": "/nct/<page>/#<heading-id>", "prompts": ["..."], "run": "<job id>",
  "assignee": "Bryan" }   // NEW, D11: a person's first name as they tick under; 1–40 chars after trim/collapse
```
Rewording (content only, no id change):
- The F blurb "Wave 5 … is stage D." (runbook-nct.json:341) becomes "Wave 5 is the Step 11 group above."
- F2's detail "Needs Wave 5 (stage D) merged" (:354) becomes "Needs Wave 5 (Step 11 · 5) merged".

### 4.3 `build-seed.mjs` output and checks (every check traces to a §10 check)
Output: `projects[].runbook` gains `tasks[]`, enriched by the build:
```js
{ id, title, short, loose?, sop?, settled?, migrations?, stages: [ids], download?,
  runbook?: { href, title, updated },        // updated = source mtime (the same rule as pages)
  attach: [{ kind, title, href }] }
```
`pages[]` keeps the hidden entries, with a `nav: "hidden"` flag, so the client has their titles (index.html:505) and can filter them out of the page list.

New or changed checks (each throws, and the throw fails `deploy-site.ps1` at :358-359). Each error string below is exact (`<…>` are filled in); §10 tests each one:
1. **sourceByHref** is built from every `pages` entry with a `source`, hidden ones included (this replaces :87). The `unlisted` array stays bare hrefs, used for plans only.
2. **Every stage belongs to exactly one task, and every task's stages exist.** Errors: `nct: runbook stage <id> is in no task`, `nct: runbook stage <id> is in two tasks (<a>, <b>)`, `nct: task <id> lists unknown stage <id>`.
3. **Task ids** are unique and collide with no step or finding id. This keeps `?task=` unambiguous. Error: `nct: task id <id> is used twice (or by a step or finding)`.
4. **Task `runbook`** is a `pages` href whose source ends in `.md`. **Attachment hrefs** are in `allHrefs`. **`download`** matches `^/nct/downloads/[\w.-]+\.zip$`. When `--public <dir>` is passed (deploy-site.ps1 passes `hosting/site/public`), the zip must exist there; the bundles are built earlier, at :324-354. Errors: `nct: task <id> runbook <href> is not a page with an .md source`, `nct: task <id> attachment <href> is not a page in projects.json`, `nct: task <id> download <href> is not /nct/downloads/<name>.zip`, `nct: task <id> download <href> is missing from <dir>`.
5. **Wave coverage** (D2, D28). For every task with a `runbook` (Phase 1: every `pages` entry of `type: "Runbook"` with an `.md` source):
   - Lex its source with `sectionsOf`.
   - Take the headings whose raw text matches `/^(\d+\.\s*)?Wave\s+\d+/i` after removing backticks.
   - Each heading id must appear in some step's `link` anchor or `prompts` anchor on **that runbook's href**, in any task (the 11–15 Wave 5 heading is covered by d5/d6 `prompts`).
   - Error: `nct: <source> wave heading #<id> has no step`, e.g. `nct: steps-16-19-runbook.md wave heading #wave-12-wt-step16 has no step`.
6. **No silent empty snippets.** A step whose `link` or `prompts` points at a page with an `.md` source must yield at least one snippet, unless the step sets `"snippets": false`. That opt-out is for a step whose section has no code block by design. This closes the trap in which `snippetsFor` returns `[]` (:52). Plan pages in `unlisted` (steps `rb-nct-d1`…`d4` link the step 11 plan) and SOP sources (not `.md`) fall outside the rule, as today. Error: `nct: runbook step <id> takes no snippets from <link> (set "snippets": false if that is by design)`.

   **Implementation check:** Agent B first runs the rule in report-only mode (`--report-snippets`, prints the ids and exits 0) on HEAD and on Agent A's JSON, and hands the list to Agent A. Agent A — the only writer of `runbook-nct.json` — adds `"snippets": false` to exactly those steps: on HEAD `rb-nct-f1-commit-e2e` and `rb-nct-f12-unowned-gaps`; among the new steps the six decisions/disagreements rows marked in Appendix A. The seed output must equal today's apart from that flag.
7. **Assignee.** If present, a string of 1–40 characters after `trim().replace(/\s+/g,' ')` (the same rule as findings.ts:39 and index.html:1025). Error: `nct: runbook step <id> assignee must be 1–40 characters`.
8. **waitsFor** stays company-wide (:90, :97). Cross-task waits need no new rule. The existing error stays `nct: runbook step <id> waits for unknown steps [<ids>]`.

**Test overrides** (so negative tests never edit tracked files): `build-seed.mjs <out.json> [--runbook <path>] [--sop <path>] [--public <dir>] [--report-snippets]`. `--runbook` replaces `p.seed.runbook` for the one project that has a runbook (nct); `--sop` replaces `customer-intake-sop/sop.json` in the drift check (Phase 4). Scratch copies live in the session scratchpad, never in the tree. Before each phase merges, `git diff --stat main -- tracker/seed/runbook-nct.json customer-intake-sop/sop.json` must show only the phase's intended edits.

### 4.4 Loading runbook bodies and plan text (J2 step 2, J3 step 2)
The page itself is the fragment. `deploy-site.ps1` already builds every runbook, plan and crosscheck page at a stable URL. `sw.js` `PAGES` already precaches them, and `build-runbook.mjs:139-142` emits `nav.rb-toc` and `article.rb-body`.

```js
// index.html: one loader for task bodies and the slide-over
var DOCS = {};                                   // href -> Promise<{ toc:[{id,text}], html, title }>
function loadDoc(href) {
  if (!DOCS[href]) DOCS[href] = fetch(href, { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (txt) {
      var d = new DOMParser().parseFromString(txt, 'text/html');   // inert: no scripts, no font loads
      var art = d.querySelector('article.rb-body'); if (!art) throw new Error('no article');
      return { html: art.outerHTML /* keep <article class="rb-body">: every .rb-body rule needs it */, title: (d.querySelector('title') || {}).textContent || href,
        toc: [].map.call(d.querySelectorAll('nav.rb-toc a[href^="#"]'), function (a) {
          return { id: a.getAttribute('href').slice(1), text: a.textContent }; }) };
    });
  DOCS[href].catch(function () { delete DOCS[href]; });          // retry on next open
  return DOCS[href];
}
```
- **Offline:** a same-origin `fetch` goes through the service worker's stale-while-revalidate branch (sw.js:44-58), keyed by URL. The precached copy from `PAGES` is served, so the fetch works offline from the first visit. (It also means a fetch-failure test must bypass the worker; §10.)
- **Stale window:** stale-while-revalidate serves the cached copy and refreshes it in the background, so a body is at most one open behind. A just-added heading can therefore be missing on the first open after a deploy. `scrollToHeading(id)` falls back to the top of the body and shows "This section is not in the cached copy yet — open the page ↗". A `PAGES` path that was never built would make the whole worker install fail silently (`c.addAll` rejects), so Phase 2 adds a DryRun check that every `PAGES` path exists in `public/`.
- **Styling:** the `.rb-body` rules from build-runbook.mjs:81-123 move into `hosting/hub/runbook-body.css` [NEW], which is **self-contained**:
  - Its first rule declares the three font variables on the scope root — `.rb-body, :host { --rb-head: …; --rb-body: …; --rb-mono: … }` — because build-runbook.mjs:63-65 declares them on the page-only `.rb` wrapper. (`.rb` keeps its own copy for `.rb-toc` and `.rb-kicker`.)
  - The rules use five page tokens from `hub/sop-theme.css` that the dashboard does not define: `--ink`, `--ink-soft`, `--ink-faint`, `--rule`, `--surface-sunk`. index.html's two token blocks (light :23-41, dark :283-331) gain them with the exact `sop-theme.css` values, so the body renders as on the page: light `--surface-sunk:#f1f4fb; --ink:#101a4f; --ink-soft:#3d4668; --ink-faint:#6b7280; --rule:#e2e8f5` (sop-theme.css:11-15); dark `#0d1333; #ffffff; #c3cae3; #7f89ad; rgba(139,154,232,.13)` (:31-35). `--surface`, `--accent` and `--accent-soft` already exist in both blocks. Custom properties inherit across a shadow boundary, so the sheet's shadow root gets them from the dashboard's `:root`.
  - The container keeps the `<article class="rb-body">` element (loadDoc returns `outerHTML`), so every `.rb-body …` selector matches inside `.task-doc` and inside the shadow root.
  - build-runbook.mjs reads the file and inlines it into the page. Its page output changes only inside the `<style>` block (the moved declarations); the rendered result must be identical, proved by the computed-style check in §10 Phase 3. deploy-site.ps1 inlines the same file into index.html at a new `/*RUNBOOK_CSS*/` placeholder, and the sheet's shadow root gets its own `<style>` copy. The `.rb-toc` rules stay page-only.
- **Links inside a body** use one click handler on `.task-doc`:
  - `#id` scrolls within the view.
  - `/nct/step-NN-plan/…` and `…-crosscheck/…` open the slide-over at the anchor.
  - A link to another runbook's href switches to that task and scrolls to the anchor.
  - `/nct/downloads/*.zip` is left to the browser.
  - `.rb-dl` is hidden in the body, because the zip is in the rail.
- **Id collisions** (D18). Only one runbook body is in the document at a time. The slide-over renders into `sheet.attachShadow({mode:'open'})`, with its own copy of `runbook-body.css`, and in-plan anchors resolve with `shadowRoot.getElementById`.

### 4.5 Views and routes (J1 step 3, J4 step 1, J5 end; all old links)
`S.view ∈ {'tasks','task','overview','findings'}`. The URL uses query parameters only, through `history.replaceState` as today (index.html:941-947). The back/forward stack is **pushState** for task open and close and for a menu view change, so the phone back button returns to the list. Today the page parses the URL once at start-up (:1089-1093) and has no `popstate` listener, so Phase 3 adds one:
```js
function routeFromUrl(push) { /* parse company, view, task, step from location.search; set S; open the task/finding; renderAll(); never pushes */ }
window.addEventListener('popstate', function () { routeFromUrl(false); });
```
Start-up calls the same `routeFromUrl`, so a reload and Back land on the same state.

| URL | Opens |
|---|---|
| `/?company=nct` | **Tasks** when the company has a runbook, otherwise Overview when it has an SOP, otherwise Findings (D26) |
| `?view=tasks` / `?view=overview` / `?view=findings` | that view |
| `?view=runbook` (legacy) | Tasks |
| `?task=task-nct-steps-4-10` | the task view |
| `?task=rb-nct-b3-merge-wave-1` (a **step** id; docs/zyt-commands.md:272) | the owning task, with that step expanded, scrolled into view and outlined |
| `?task=nct-identity` (a **finding** id) | Findings, with its panel open (as today) |
| `?view=findings&step=8` | Findings filtered to SOP step 8 |
| `?view=overview&step=5` | Overview, with the frame at `…?embed=1#step-5` |

`selectTask` (index.html:948-955) splits into three functions:
- `openTask(taskId, stepKey?)`
- `selectFinding(key)` (the old findings path)
- `resolveKey(key)`, which returns `{kind:'task'|'step'|'finding'}` from `p.rbTaskById`, `p.byKey[x].rb` and the findings `byKey`.

Old `S.taskKey` is kept for the findings panel only.

### 4.6 Client model (J1 steps 1–6)
Built once per company in the seed index block (it replaces index.html:512-519):
- `p.rbTasks[]` holds each task with `steps[]`, the concatenation of its stages' steps in order. Each step gets:
  - `x.task` (its task) and `x.n` (1-based per task; D16)
  - `x.label = x.n`
  - `x.ref`, which is `x.n` inside its own task, or `task.short + ' · ' + x.n` from elsewhere
  - `x.stage` (for sub-headings when a task has more than one stage).
- `p.byKey` still holds steps and findings (the same key space).

Derived, never stored (mockup.html:212-229 semantics, extended by D11):
```js
function waiting(s) { return s.waitsFor.filter(k => !isDone(byKey[k])).map(k => byKey[k]); }
function ready(t)   { return t.steps.filter(s => !isDone(s) && !waiting(s).length); }
function status(t) {
  var done = t.steps.filter(isDone).length;
  if (!t.steps.length) return 'none';                // 'Not started'
  if (done === t.steps.length) return 'done';        // 'Done'
  var r = ready(t);
  if (r.length && r.every(s => s.owner === 'wilfred')) return 'waiting';  // 'Waiting on Wilfred'
  return done ? 'progress' : 'none';                 // 'In progress' | 'Not started'
}
var me = norm(author());                              // norm = trim, collapse spaces, lower-case
function mine(t) { return !!me && t.steps.some(s => norm(s.assignee) === me ||
                                               (isDone(s) && norm(liveOf(s).updatedBy) === me)); }
// chips: all | open (status !== 'done') | wilfred (ready(t).some(owner==='wilfred')) | mine
```
"My tasks" with no name set opens the existing name dialog (index.html:445-455), and the chip applies once a name is saved.

**Render contract (persistent nodes).** `renderAll()` (index.html:928-938) runs on every Convex board push (:981), twice per tick (:1000, :1002) and a panel refresh runs every 60 s (:1080); `renderPanel` starts with `body.textContent = ''` (:782). The task view must not follow that pattern for its heavy nodes. Three node kinds are created once and cached, like `GP_PANELS` (:883-890), and `renderAll` only re-parents them:
- `DOC_NODES[href]`: the `.task-doc` element (section nav plus `<article class="rb-body">`), filled once when `loadDoc` resolves.
- `SHEET`: the `<aside id="sheet">` with its shadow root. Its content is replaced only when a different attachment is opened.
- `OVERVIEW_FRAMES[companyKey]`: the Overview `<iframe>` (Phase 4). It is created on the first visit to Overview and hidden, not removed, when another view shows.

Only the Tasks list, the checklist rows and the rail are rebuilt. Checklist rows keep their `fk` focus keys, so focus survives a rebuild, and the checklist's height does not change on a tick (the row is replaced in place), so the window scroll inside the body is kept. The 60-second timer only refreshes relative times in the task view.

### 4.7 Convex (J1 end, J2 end)
- **Schema:** unchanged. **Functions:** unchanged. `board` already returns `updatedBy` per key (findings.ts:25), which is enough for "ticked by me" and for status.
- **Seed:** Phase 1 adds about 57 step ids (A.1 20 + A.2 about 28, depending on how many waves have bold probes + A.3 9); `inserted` must equal the exact count Agent A reports. `seed.ts` imports the seed JSON when it is bundled (:2-4), so new keys reach a deployment only after a bundle of the **worktree's** files: `npx convex dev --once`, then `npx convex run seed:nct` on dev, from the worktree's `hosting/convex-app` set up as in §7.4. For prod, `npx convex deploy -y` then `npx convex run --prod seed:nct` are **Wilfred's, before the site deploy**; no agent runs a `--prod` or `deploy` command. Phases 2–4 add no keys (Phase 4 adds some only if `sop.json` gained ledger items; §7.3).
- **Activity:** `S.events` (latest 300 per project) filtered to the task's step keys. When `S.events.length === 300` and the oldest event is newer than the task's oldest tick, the feed ends with "Older changes are not shown" (D24).

### 4.8 One findings list (D12, D20–D22; J5)
- **Content:** `tracker/build-seed.mjs` switches from scraping `customer-intake-sop.html` to reading `customer-intake-sop/sop.json`, for **both** of its outputs (D32):
  - `tasks-nct.json`: the ledger items (rank = array position; `isNew`) and `guide[].fixes[]` are read directly. The page's rules apply: a fix's id is `f.id` when set, otherwise `s<nn>-<slug(title)>` capped at 48 characters (the template's rule, sop-template.html:2765), and duplicates are folded by `sameAs` or normalised title. Output ids keep the `nct-` prefix. The title no longer carries " new"; `isNew: true` is a field. Each ledger item also carries the audit facts `status`, `fixedAt`, `origin` and `ruleId` when present (written by `/zyt-audit`; none today), so `--no-ledger` does not hide them.
  - `flow-nct.json`: `steps[].title` from `sop.json` `steps[].title` (the badge is no longer appended), `phase` from `steps[].phase`, `role`/`routes`/`summary` from `guide[]` as today, phases from `sop.json` `phases[]` (`letter`→`key`, `name`→`label`).
  - Proof: regenerating today produces the same 48 ids in the same order. The only differences allowed are the title suffix, the new `isNew`/`sev` fields, and in `flow-nct.json` the step titles that carried a badge (each listed and accepted in the PR description). The implementer diffs both files to prove it.
- **Pinned fix ids** (D33): once the proof passes, Task 4.1 writes each of the 30 derived ids (without `nct-`) into its fix as `"id": "s01-…"` in `sop.json`. The page and the dashboard then derive the same ids from the field, and rewording a fix can never change its key. A later fix added without an `id` still gets a derived one.
- **Drift check** in `hosting/hub/build-seed.mjs` (NCT only, when `sop.json` exists). It recomputes the id list from `sop.json` with a shared helper, `tracker/sop-findings.mjs` [NEW], imported by both scripts. When a step has both a missing and an extra id, it reports a **rename**, not a reseed. Messages (exact):
  - Rename: `tasks-nct.json: fix "<new title>" on step <n> changed id <old> → <new>. Pin the old id: add "id": "<old id>" to that fix in customer-intake-sop/sop.json, then run node tracker/build-seed.mjs.`
  - Stale: `tasks-nct.json is stale against customer-intake-sop/sop.json: missing [..] extra [..]. Run node tracker/build-seed.mjs; put each new id in a workstream in tracker/seed/client-tasks-nct.json (covers); on dev run npx convex dev --once && npx convex run seed:nct. Then ask Wilfred to run npx convex deploy -y && npx convex run --prod seed:nct before any site deploy. Agents must not run the --prod or deploy commands.`
- **Ticks:** Convex `findings`, unchanged. There are no new rows.
- **The SOP page:** `deploy-site.ps1:109` adds `--no-ledger` for NCT only. Without the ledger, `SOP_HAS_FIXES` is false, so the page drops `#fixes`, the step modal's "What to fix" and its Prompt section, and all localStorage tick writes. JWA (:290) and Harper (:309) are unchanged.
- **Old ticks** (D22). The Findings view reads **both** old keys inside try/catch: `localStorage['sop.customer-intake-sop.fixDone']` (the page built from `sop.json`, sop-template.html:2682) and `localStorage['sop.fixDone']` (the hand-written page served until 2026-09-16, customer-intake-sop.html:2729). Each is a JSON array of bare ids; the union is taken. It maps each id to `nct-<id>` and keeps those that exist, are open, and were **not reopened on purpose**: an id whose visible history in `S.events` has a `to: open` after a `to: done` is left out and listed as "reopened since, not applied". If any remain, the banner lists their titles. Apply:
  - requires a name (the existing dialog), then writes sequentially through a new `setStateP(key, state)` that returns the `client.mutation(findings.setState)` promise without toasting or re-rendering (`setDone` returns nothing and swallows its errors, :987-1008, so it cannot be awaited);
  - counts failures; on any failure it keeps both keys and toasts "<n> of <m> not saved — try again";
  - on success it **renames** each key that was read to `<key>.imported` (not deleted, so a rollback can restore it) and renders once.
  - The ticks are recorded under the viewer's name and the current time; the banner says so, because the old store kept neither.
  Dismiss writes `zyt.sopTicksDismissed=1`.
- **Findings UI** (index.html, Findings view): a "Group by" select with Workstream (default, as today), Rank (the 18 chain items by `rank`, then step fixes by step) and SOP step (grouped by `steps[0].n` from `flow-nct.json`). There is also a Step filter, `?step=N`. The `isNew` chip reads the field. An item with `status: "fixed"` shows a read-only "Fixed (audit) · <fixedAt>" chip, counts as closed in the Open filter and the counts (as the SOP page did, sop-template.html:2711), and its tick box stays usable; an `origin: "rule-violation"` item shows a "Rule <ruleId>" chip. The old title strip at :507-508 is kept as a fallback for one release.

### 4.9 SOP embed mode (D19; J4)
`hosting/hub/sop-layout.js` gains the following, at the top of the IIFE:
```js
var EMBED = /[?&]embed=1\b/.test(location.search);
if (EMBED) document.documentElement.classList.add('zyt-embed');
// ...after layout moves: if (EMBED) open #doc-body via #doc-toggle when it is hidden
window.addEventListener('storage', function (e) {                 // all pages
  if (e.key === 'zyt.theme') applyTheme(e.newValue === 'light' ? 'light' : 'dark'); // a removed key (null) means the default, dark
});
if (EMBED) document.addEventListener('click', function (e) {    // one delegated handler, capture phase
  var a = e.target.closest && e.target.closest('a[href^="/"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (a.pathname === location.pathname) return;                   // same page (?role=, #step-N): stay in the frame
  e.preventDefault(); window.top.location.href = a.href;        // leave the frame, e.g. to the dashboard or another page
}, true);
```
`sop-layout.css` adds `.zyt-embed .zyt-top { display:none }` and `.zyt-embed { --zyt-top: 0px; }`, so the chain sheet and the scroll-padding use no top offset. The click handler is delegated and decides at click time, because the SOP template rebuilds the chain pane and the step modal with `innerHTML` on hover and open (sop-layout.js:44-54), so links added after load are covered too. In-page `#…` links are not matched by `a[href^="/"]`, and same-path links (`?role=`) are let through by the pathname check. `#doc-toggle` is added to the invariant hooks list in SITE.md.

### 4.10 Layout and CSS (J1 step 3, J6)
- `.shell` gains `data-view`. `tasks`, `task` and `overview` use `17.5rem minmax(0,1fr)` with no 27rem panel. `findings` keeps three columns and the existing slide-over rules (index.html:255-261).
- The cached nodes of §4.6 (task body, sheet, Overview frame) are re-parented into the view's container on each render, never rebuilt.
- **Task view grid:** `minmax(0,1fr) 19rem`. The rail is sticky at `top: calc(var(--top) + 1rem)`. At 70rem or less the layout is one column and the rail sits after the checklist (J6). The body's section nav is a sticky `12rem` column, and a `<details>` at 48rem or less.
- **Top bars (D29):**
  - `index.html:53`: drop `backdrop-filter` and use `background: var(--canvas)`.
  - `:301`: use `background: #04061a`.
  - `sop-layout.css:11-12`: drop `backdrop-filter` and use `background: var(--surface)`.

---

## 5. Phased implementation

Each phase is a branch in the worktree (D23). It merges to `main` with a type-and-build gate, following the merge-and-deploy protocol H5 (§6.0). Every phase can be deployed on its own. The deploy order within a phase is in §7.3. Every local acceptance check runs on `http://localhost:8794` (the worktree's build, §7.4), never on 8791 (the main tree's).

### Phase 1: Checklists for steps 16–27, the wave rule, opaque top bars
**Journeys delivered:** J2 (in today's Runbook view: new stages appear lettered G/H/I until Phase 3); J1 for the 16–27 probe gates; J6 step 4 (no blank scroll).
**Depends on:** the golden-path session has committed its uncommitted edits (see §6, hand-off H1).

| Task | What | Files | Owner |
|---|---|---|---|
| 1.1 | Author the stage `rb-nct-steps-16-19` (20 steps) exactly as in **Appendix A.1**. Write each `detail` in the runbook's own words (1–3 sentences: what, the done-definition, and which probes gate it). `link` and `prompts` use the verified heading ids. `waitsFor` follows §3 "Starts when" of that runbook, including the cross-task wait `rb-nct-f11-wave-11` | `tracker/seed/runbook-nct.json` | Agent A (content) |
| 1.2 | Same for `rb-nct-steps-20-26` (~28 steps, **A.2**). Cross-task: every Wave 17 step waits for `rb-nct-1619-w16-step17`. The optional Wave 21 step says in its detail: tick when merged or when you decide to skip it | same | Agent A (content) |
| 1.3 | Same for `rb-nct-step-27` (~9 steps, **A.3**). Cross-task: Wave 22 waits for all three Wave 20 steps and `rb-nct-b3-merge-wave-1` (runbook §3: steps 1–3 Wave 1 merged) | same | Agent A (content) |
| 1.3b | `"snippets": false` on exactly the steps Agent B's report-only run lists: the six decisions/disagreements rows marked in Appendix A, plus `rb-nct-f1-commit-e2e` and `rb-nct-f12-unowned-gaps` on HEAD. No other field of an existing step changes | same | Agent A (content) |
| 1.4 | Build checks 4.3 #1 (sourceByHref from all `pages`), #5 (wave coverage, lexer rule D28) and #6 (no silent empty snippets), with the exact error strings of §4.3, plus the `--runbook <path>` and `--report-snippets` flags. Agent B runs `--report-snippets` on HEAD and on Agent A's JSON and **hands the list to Agent A**; B never writes `runbook-nct.json`. In Phase 1, #5 iterates every `pages` entry with `type: "Runbook"` and an `.md` source, and counts coverage from **every** step in the company. Coverage is anchor-based, so no task mapping is needed yet. Phase 3 switches the iteration to `tasks[].runbook` | `hosting/hub/build-seed.mjs` | Agent B (build+css) |
| 1.5 | Opaque top bars (4.10). **First reproduce:** on the current build at 8794, in the desktop browser pane, scroll `/nct/steps-20-26-runbook/` and record a screenshot of a blank frame (or record that it did not reproduce in N scrolls) | `hosting/hub/index.html` (lines 53, 301 only), `hosting/hub/sop-layout.css` (11-12) | Agent B (build+css) |
| 1.6 | SITE.md: the change table row ("the build fails when a runbook wave heading has no step"), the 16–27 runbook row (now also dashboard stages), the invariant "top bars are opaque, no backdrop-filter", and the stale lines :28, :53 and :232 ("Known gaps" date) — line numbers as of 2026-09-23 after the golden-path session's uncommitted +8 lines at :161 | `hosting/SITE.md` | Agent B (build+css) |
| 1.7 | Convex dev, from the worktree's `hosting/convex-app` set up per §7.4. **Pre-check:** `npx convex dev --once` must print that it targets `small-snail-912`; stop if it prompts or names anything else. Then `npx convex run seed:nct` → `{inserted: N}` with N equal to Agent A's count of new step ids. **Prod runs are listed for Wilfred in §7.3, not executed** | (none) | Agent B (build+css) |
| 1.8 | Seed-row preflight (D34): before the upload in a real (non-DryRun) deploy, deploy-site.ps1 POSTs `{path:"findings:board", args:{projectKey}}` to `<ConvexUrl>/api/query` for each project with a seed, and refuses to deploy while any seed key (finding or runbook step) has no row, naming up to 20 keys: `Convex <url> has no row for [<keys>]. Run seed:<project> on that deployment first (prod: Wilfred).` In a DryRun it prints the same list as a warning. A new block after the build-seed call (:358-359); not in the golden-path session's lines | `hosting/deploy-site.ps1` (new block after :359 only) | Agent B (build+css) |
| 1.9 | Snippet-count regression script `_plan/09-23_runbook-tasks/verify/snippet-counts.mjs [NEW]`: `node snippet-counts.mjs <base.json> <branch.json>` prints each pre-existing step id whose snippet count differs, and exits 1 if any does. The baseline is `node hosting/hub/build-seed.mjs <scratch>/head.json` run in `C:/Project/ZYT-Task` at the H1 commit (read-only there); the branch file comes from the worktree | `_plan/09-23_runbook-tasks/verify/snippet-counts.mjs` [NEW] | Agent B (build+css) |

**Acceptance:**
- DryRun passes against dev Convex (and its preflight warning list is empty after Task 1.7).
- Each Phase 1 negative test in §10 fails with its exact error string, run through `--runbook` on a scratch copy.
- `snippet-counts.mjs` reports no differences for pre-existing steps.
- On `localhost:8794`, stage G shows Wave 12 steps with "Show and copy" blocks from `#wave-12-wt-step16`.
- Ticking G4 on dev Convex succeeds.
- `grep -n backdrop-filter hosting/hub/index.html hosting/hub/sop-layout.css` returns nothing, and the scroll that was recorded blank in Task 1.5 now never blanks.
- **User can** copy the Wave 12 `wt-step16` prompt from the dashboard end to end.

### Phase 2: Pages for plans 01–10 and the steps 4–10 crosscheck
**Journeys delivered:** none reachable by clicking. This phase is **infrastructure for J3**: the pages exist at stable URLs (reachable by typing the URL or from a shared link) and become clickable in Phase 3's attachments and slide-over. It stays a separate phase because it is independently deployable, touches different files from Phase 1, and de-risks Phase 3.
**Depends on:** hand-off **H2a** (the golden-path session agrees the one-line `nav:"hidden"` filter in their page-list code, §6.0). It can merge before or after Phase 1.

| Task | What | Files | Owner |
|---|---|---|---|
| 2.1 | Add `$nctPages0110`, 11 rows in the style of the `$nctPages1627` table: `plans/step-01-enquiry-channel.md` → `step-01-plan` … `plans/step-10-decision-correction.md` → `step-10-plan`, zip `steps-1-3-plans.zip` for 01–03 and `steps-4-10-plans.zip` for 04–10, plus `plans/steps-4-10-crosscheck.md` → `steps-4-10-crosscheck` (kind Crosscheck). Loop over `$nctPages0110 + $nctPages1627`. Do **not** touch :148-152 or :364 (golden path) | `hosting/deploy-site.ps1` | Agent C (pages) |
| 2.2 | `projects.json`: `/nct/step-01-plan/` … `/nct/step-10-plan/` go into `unlisted`. `steps-4-10-crosscheck` becomes a `pages` entry `{type:"Crosscheck", title:"Steps 4–10", href, source, nav:"hidden"}`. The page list must filter `hidden` for this entry to stay out of the sidebar, so **that filter lands in this phase**: index.html:616 `pg.nav !== 'header'` becomes `pg.nav !== 'header' && pg.nav !== 'hidden'`. The header-nav loop at :637 already selects only `nav === 'header'`, so it needs no change | `hosting/hub/projects.json`, `hosting/hub/index.html` (line 616 only) | Agent C (pages) |
| 2.3 | `sw.js` `PAGES`: add the 11 paths. deploy-site.ps1 gains a check right after it writes `public/sw.js` (:385-386): every `PAGES` path must have `public/<path>index.html` (`/` → `public/index.html`), otherwise it throws `sw.js PAGES lists <path>, which was not built` — one missing page would fail the worker install silently | `hosting/pwa/sw.js`, `hosting/deploy-site.ps1` (new lines after :386 only) | Agent C (pages) |
| 2.4 | SITE.md: a pages-table row for plans 01–10 and the 4–10 crosscheck; the "What gets a page" table (crosschecks can be hidden); fix "plans are not in git" (:28 if not done in Phase 1, :101-103). README.md:161-163. The comment at deploy-site.ps1:326 | `hosting/SITE.md`, `README.md`, `hosting/deploy-site.ps1` (comment) | Agent C (pages) |

**Acceptance:**
- DryRun builds `public/nct/step-01-plan/index.html` … `step-10-plan/` and `steps-4-10-crosscheck/`.
- Their `#`-anchors render.
- The sidebar is unchanged apart from nothing new appearing.
- The `PAGES` check passes. Temporarily adding `'/nct/no-such-page/'` to `PAGES` in the worktree makes the DryRun throw `sw.js PAGES lists /nct/no-such-page/, which was not built`; the edit is then reverted and `git diff hosting/pwa/sw.js` shows only the 11 paths.
- On 8794, DevTools → Application → Service workers shows the new worker **activated**, and Cache Storage has a `zyt-admin-<build>` name different from before the DryRun.
- Offline reload of `/nct/step-04-plan/` works after one online visit.
- **User can** open `/nct/step-08-plan/` by URL and read it (the click path arrives in Phase 3).

### Phase 3: Tasks list, task view, slide-over, menu (the core)
**Journeys delivered:** J1, J2 and J3 in the new UI; J6 (Tasks part).
**Depends on:** Phases 1 and 2 merged (the task view needs the 16–27 steps and the 01–10 pages). Hand-off H2 with the golden-path session is agreed (§6).

| Task | What | Files | Owner |
|---|---|---|---|
| 3.1 | Seed: add `tasks[]` (8 tasks, 4.2), with attachments from the mockup and the zips corrected. Reword the F blurb and F2 detail. Set `"assignee": "Wilfred"` on `rb-nct-27-decisions` (a name already public as the owner; it gives the assignee branch of My tasks something to test) | `tracker/seed/runbook-nct.json` | Agent A (data+build) |
| 3.2 | `projects.json`: the six runbook and three listed crosscheck entries get `"nav": "hidden"` (order kept; `source` kept) | `hosting/hub/projects.json` | Agent A (data+build) |
| 3.3 | build-seed.mjs: checks 4.3 #2, #3, #4, #7 with their exact error strings. Emit `runbook.tasks` enriched (`runbook:{href,title,updated}`). Switch wave coverage #5 to iterate `tasks[].runbook`. Accept `--public <dir>` for the zip existence check. deploy-site.ps1 passes `--public $public` at the build-seed call (:358) and inlines `hub/runbook-body.css` at `/*RUNBOOK_CSS*/` | `hosting/hub/build-seed.mjs`, `hosting/deploy-site.ps1` (lines ~358-363 only) | Agent A (data+build) |
| 3.4 | Extract `.rb-body` CSS into a **self-contained** `hosting/hub/runbook-body.css` [NEW] (§4.4: font variables on `.rb-body, :host`). build-runbook.mjs reads and inlines it; its page diff is confined to the `<style>` block (diff one built page before and after and attach it). The five token aliases go into index.html in Task 3.8 (Agent D) | `hosting/hub/build-runbook.mjs`, `hosting/hub/runbook-body.css` [NEW] | Agent A (data+build) |
| 3.5 | index.html model and routing: 4.5, 4.6. `openTask`/`selectFinding`/`resolveKey`; per-task numbering (replaces 512-519); `waitingOn` keeps company-wide lookups; `S.view` values; push/replaceState; **`routeFromUrl` plus a `popstate` listener** (start-up uses it too); legacy `?view=runbook`; `?task=<step>` → task plus the expanded step. Replace every caller in §7.1's lists | `hosting/hub/index.html` | Agent D (dashboard) |
| 3.6 | index.html left menu: in `.company-side`, above `#page-list`, the nav `Overview · Tasks · Findings` with counts (open tasks, open findings). Overview is disabled with the hint "No SOP yet" when `p.sop` is null. The page list keeps the golden-path session's grouping and glyphs, filtered by `nav !== 'hidden'` (D25). The phone copy is a segmented control in `.switcher-row`. The Runbook/Findings toggle (397-400) is removed. **Overview in this phase is a link** to the SOP page; it becomes the embedded view in Phase 4 | `hosting/hub/index.html` | Agent D (dashboard) |
| 3.7 | Tasks list view: chips All/Open/Needs Wilfred/My tasks (replacing All/Open/Done at 406-410 in the tasks view; Findings keeps All/Open/Done plus category); rows as in mockup.html:245-256 (status dot `--p`, title, pill, progress `n / N`, next ready step `ref + title`, owner chips, ⧉ attachment count); keyboard (row is a `<button>` or `<a href="?task=">`, not a div); `#q` search over task titles and step titles/details (matching step count shown); empty state | `hosting/hub/index.html` | Agent D (dashboard) |
| 3.8 | Task view: header (← All tasks, kicker, h1, status pill); **Checklist** card grouped by stage when there is more than one; each row reuses `stepRow` with `x.n`, the owner chip, `Waits for <ref-links>`, Ready, ✓ by, a "⧉ n" snippet button and a "▶ Golden path" chip. Click the row title to expand inline (D17): detail, the "Show and copy" button (`openSnippets`, subtitle `ref · title`), `t.run ? gpSection(t.run) : null` (**reuse unchanged**, the node taken from the `GP_PANELS` cache), waits-for list (cross-task links call `openTask(otherTask, key)`), "How to do it" (scrolls in-view, or opens the slide-over for plan links), history (events for that key). **Rail:** Properties (Status, Progress, SOP steps, Owners, Assignees, Decisions settled, Migrations, Page ↗ to the unlisted page, Updated), Attachments (buttons open the sheet; ⤓ zip link with `download`), Activity (4.7). **Body:** `loadDoc(task.runbook.href)` into a cached `DOC_NODES[href]` `.task-doc` (render contract, §4.6) with a section nav from `toc`; a loading skeleton; an error state with "Open the page ↗". Add the five token aliases to both token blocks (§4.4) | `hosting/hub/index.html` | Agent D (dashboard) |
| 3.9 | Slide-over: `<aside id="sheet" role="dialog" aria-modal="true" aria-labelledby>` plus the scrim, created once and cached (§4.6); shadow-root render (D18) with the inlined `runbook-body.css`; header (title, section `<select>`, Open page ↗, ⤓ zip, Close); Esc and scrim close; focus trap and focus return; full width at 48rem or less. `?task=…&doc=/nct/step-08-plan/` is **not** added (the sheet is transient) | `hosting/hub/index.html` | Agent D (dashboard) |
| 3.10 | Search and chip state per view; `/` still focuses search; Esc closes the sheet, then the snippet dialog, then collapses the expanded step | `hosting/hub/index.html` | Agent D (dashboard) |
| 3.11 | SITE.md: the pages table (`/` is Overview · Tasks · Findings; runbooks and crosschecks "built, hidden from the list (`nav: hidden`)"); the recipe step 2 (a runbook is a `pages` entry with `nav: "hidden"` plus a `tasks[]` entry); the change table (assignee, per-task numbers, cross-task waits, status derived); invariants: replace the "dashboard opens on the Runbook view" line (:218 today) with the URL table from 4.5, and add "step ids stay Convex keys; display numbers are per task", "task view reads `article.rb-body` / `nav.rb-toc` from the served page, so build-runbook.mjs must keep both" | `hosting/SITE.md` | Agent A (data+build) |
| 3.12 | Status fixture script `_plan/09-23_runbook-tasks/verify/expected-status.mjs [NEW]`: reads the built `seed.json` and the dev board (`npx convex run findings:board '{"projectKey":"nct"}'` in the worktree's convex-app), applies the §4.6 functions, written from the §4.6 spec and **not** copied from index.html, so it checks the page independently, and prints per task: status, `done / N`, next ready step (`ref title`), Needs Wilfred yes/no, and My tasks yes/no for `--me <name>`. `--what-if <key>` prints the same row for the task after that key is ticked | `_plan/09-23_runbook-tasks/verify/expected-status.mjs` [NEW] | Agent A (data+build) |

**Acceptance:**
- The §10 Phase 3 golden path passes, with every status, next-step and chip expectation matching `expected-status.mjs` output taken just before the walk.
- Each Phase 3 build-check negative test (§10) fails with its exact error string.
- `snippet-counts.mjs` reports no differences between the H1 baseline and the branch.
- The computed-style check passes: `.task-doc h2` and the unlisted page's `.rb-body h2` have the same `font-size`, `font-weight`, `font-family` and `border-top` in light and in dark (§10).
- The render-contract regression passes (§10): a tick elsewhere does not reload the body or move the scroll.
- `?task=rb-nct-b3-merge-wave-1` opens Steps 1–3 with step 3 expanded. Back from a task returns to the list.
- **User can** go from Needs Wilfred to ticking a gate end to end (J1), and copy a Wave 12 prompt from the task view (J2).

### Phase 4: Overview and one Findings list
**Journeys delivered:** J4, J5; J6 (Overview and Findings).
**Depends on:** Phase 3 (the menu and view state).

| Task | What | Files | Owner |
|---|---|---|---|
| 4.1 | `tracker/sop-findings.mjs` [NEW]: `findingsFromSop(sopJson) → [{id,kind,rank,title,isNew,detail,severity,steps,repair,src,status?,fixedAt?,origin?,ruleId?}]` using the page's fold and id rules (`f.id` first) and `flowFromSop(sopJson)` (§4.8, D32). `tracker/build-seed.mjs` uses both and reads only `customer-intake-sop/sop.json`; it gains `--sop <path>` and `--out-dir <dir>` so tests write to the scratchpad, never to `tracker/seed/`. Regenerate `tracker/seed/tasks-nct.json` **and** `tracker/seed/flow-nct.json`; prove the same 48 ids in the same order and attach both diffs (each flow title change listed and accepted) to the PR description. Then pin the 30 fix ids into `sop.json` (D33) and show that regenerating gives a byte-identical `tasks-nct.json`. Add a check that a ledger item given `status:"fixed", fixedAt` in a scratch copy of `sop.json` comes through with both fields | `tracker/sop-findings.mjs` [NEW], `tracker/build-seed.mjs`, `tracker/seed/tasks-nct.json`, `tracker/seed/flow-nct.json`, `customer-intake-sop/sop.json` (the 30 `"id"` fields only), `tracker/SCHEMA.md` | Agent A (data+build) |
| 4.2 | The drift check in `hosting/hub/build-seed.mjs` (4.8), with the rename and stale messages verbatim and the `--sop <path>` override. `deploy-site.ps1:109`: add `--no-ledger` to the NCT build call. `projects.json` SOP `source` → `customer-intake-sop/sop.json` (a truthful "last edited") | `hosting/hub/build-seed.mjs`, `hosting/deploy-site.ps1` (line 109 only), `hosting/hub/projects.json` | Agent A (data+build) |
| 4.3 | sop-layout.js/.css embed mode, the delegated `_top` click handler and the normalised theme `storage` listener (4.9). Leave `runPanels`/`addRunPanel` (:196-220, including the golden-path session's `regenLabel` line) and the `#fixes` reorder (:253-254, still needed for JWA and Harper) untouched | `hosting/hub/sop-layout.js`, `hosting/hub/sop-layout.css` | Agent E (sop layer) |
| 4.4 | index.html Overview view: a header bar ("Open the whole chain", which clicks `.zyt-chain-tab` in `contentDocument`; "Open full page ↗"); `<iframe title="SOP: When a Customer Comes In" src="<p.sop>?embed=1[#step-N]">` at `height: calc(100vh - var(--top) - 5rem); min-height: 32rem`; `loading="lazy"`; cached per company in `OVERVIEW_FRAMES` and never recreated by `renderAll` (§4.6); a later `?step=N` sets the frame's `location.hash` instead of reloading; the menu item becomes the view | `hosting/hub/index.html` | Agent D (dashboard) |
| 4.5 | index.html Findings: Group by (Workstream/Rank/SOP step), the Step filter with open counts, `?step=`, the `isNew` field, the "Fixed (audit)" and "Rule" chips (audit-fixed items count as closed), "Where in the SOP" → `?view=overview&step=N`, and the old-ticks import banner with `setStateP` and both keys (4.8). The empty state for companies with no findings: "This company's findings are on its SOP page" → Overview | `hosting/hub/index.html` | Agent D (dashboard) |
| 4.6 | SITE.md: the SOP row (built with `--no-ledger`; "What to fix first" shown in the dashboard's Findings; old browser ticks importable once, kept as `….imported`; comment box retired; the claude.ai artifact copy's ticks and comments abandoned, D12); the hooks list gains `#doc-toggle`, `.zyt-embed`, `?embed=1`; the change table row for NCT defects with the **full order**: edit `sop.json` (keep each fix's `"id"`) → `node tracker/build-seed.mjs` → new ids into a workstream in `client-tasks-nct.json` → dev `npx convex dev --once && npx convex run seed:nct` → **Wilfred:** `npx convex deploy -y && npx convex run --prod seed:nct` → site deploy, with "agents never run the prod steps"; the "fix list kept public" wording for NCT; a one-line console snippet to restore `….imported` after a rollback | `hosting/SITE.md` | Agent A (data+build) |

**Acceptance:**
- The NCT SOP page has no `#fixes`.
- JWA and Harper still have theirs.
- Overview shows the chain and the expanded document with no second top bar.
- The theme toggle restyles the frame.
- Findings "Group by Rank" lists `nct-identity` first.
- `tasks-nct.json` and `flow-nct.json` diffs are attached and accepted; after pinning, regeneration is byte-identical.
- The Phase 4 drift negative tests (§10) fail with the exact stale and rename messages, through `--sop` on a scratch copy.
- The import banner applies seeded localStorage ticks (both keys) on dev, skips a reopened id, and leaves `….imported` behind.
- With the chain sheet open in Overview, a tick from another tab does not reload the frame.
- **User can** triage a finding by SOP step and tick it end to end (J5).

---

## 6. Delegation and parallelization

### 6.0 Coordination with the golden-path session (explicit hand-offs)
The other Claude session, "Golden path visualization button", owns:
- `hosting/hub/golden-path.js` / `.css` and `hosting/runner/server.mjs`
- in index.html, the `/*GOLDEN_PATH_CSS*/` (:218) and `<!--GOLDEN_PATH_JS-->` (:459) placeholders, and `GP_PANELS`/`gpSection` (:878-890)
- `sop-layout.js` `runPanels`/`addRunPanel` (:196-220)
- the `run` field semantics
- deploy-site.ps1:148-152 and :364
- the left page list design (index.html CSS :87-103, JS :569-649).

| Hand-off | When | What is agreed | Who |
|---|---|---|---|
| **H1** | Before Phase 1 starts | The golden-path session commits **all** its uncommitted work (git status 2026-09-23): `tracker/seed/runbook-nct.json` (F11 `run`), the four runbook .md "Before the PR" lines, `hosting/hub/golden-path.js`, `hosting/runner/server.mjs`, `hosting/hub/sop-layout.js` (the `regenLabel` line in `addRunPanel`), `.gitignore` (the `hosting/runner/runs/` block), `.claude/launch.json` and `hosting/SITE.md` (its "Recordings are kept" paragraph). In the same commit their `golden-path-runner` config's `RUNNER_EXTRA_ORIGINS` becomes `http://localhost:8791,http://localhost:8794`, so the one runner on :4317 serves both previews (a second runner would collide on the port). The worktree then branches from a HEAD that contains it. Wilfred relays this; this plan never commits their files | Wilfred → golden-path session |
| **H2a** | Before Phase 2 starts | Task 2.2's one-line filter at index.html:616 (`&& pg.nav !== 'hidden'`) sits in their page-list code (:569-649). They agree to it, or land it themselves and Agent C drops it from Task 2.2 | Wilfred ↔ golden-path session |
| **H2** | Before Phase 3 starts | (a) The page list stays their design; Phase 3 only adds the three-item nav above it. (b) `gpSection(job)` is called unchanged from the expanded checklist row, and panels are never recreated. (c) Their pending index.html edits, if any, are committed or listed so Agent D can rebase onto them. (d) D1 (`run` on the new steps) is answered | Wilfred ↔ golden-path session |
| **H3** | Every phase merge | Neither session deploys to production from a half-edited tree. The worktree has its own `hosting/site/.deploy.lock` (the lock does not span worktrees), so **only Wilfred** runs the production deploy, from `C:/Project/ZYT-Task` after the merge | Wilfred |
| **H4** | Phase 4 | sop-layout.js: Agent E edits only the new embed, click and storage blocks at the top and bottom of the IIFE, and not :196-220. The stale comment "steps with no journey yet (11–15)" (:197) and SITE.md:157-159 are left to the golden-path session | Agent E |
| **H5** | Every phase merge and every prod deploy | **Merge and deploy protocol** (the main tree is the golden-path session's working tree, and stash/reset are forbidden): (1) The golden-path session commits first. `git -C C:/Project/ZYT-Task status --porcelain` must list none of the files the phase touches (§6 "Owns" columns); if it does, stop and ask through Wilfred. Never stash. (2) Hold the deploy lock for the merge, in **one** PowerShell invocation (a lock whose pid has exited counts as stale, deploy-site.ps1:48-55): create `hosting/site/.deploy.lock` with `CreateNew` (as :38 does) holding `{pid: $PID, mode: "merge", startedAt: <now>}` — if it already exists, a build is running, so wait — then `git merge`, then delete the lock in a `finally`. After that, run the DryRun gate, which takes the lock itself. (3) Immediately before Wilfred's prod deploy, `git status --porcelain` is empty, or every dirty file is listed to Wilfred and he accepts shipping it (a deploy publishes the files on disk, SITE.md:143). (4) The golden-path session is told the merge landed, so its next deploy ships it knowingly | Wilfred (merge and deploy); whoever merges follows (1)–(2) |
| **Preview config** | §7.4 setup | The `hub-preview-rbtasks` entry (python http.server on **8794** over `C:/Project/ZYT-Task-rbtasks/hosting/site/public`) is added by the orchestrating session to the **worktree's** `.claude/launch.json` and is never committed or merged. The main tree's launch.json is not touched | Orchestrating session (not a phase agent) |

### 6.1 Phase 1: content, rule, top bars

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (content) | general-purpose | opus | high | 1.1, 1.2, 1.3, 1.3b | `tracker/seed/runbook-nct.json` (sole writer, including every `"snippets": false`) | `steps-16-19-runbook.md`, `steps-20-26-runbook.md`, `step-27-runbook.md`, `plans/steps-16-19-crosscheck.md`, `plans/steps-20-26-crosscheck.md`, Appendix A, B's `--report-snippets` list |
| Agent B (build+css) | backend-engineer | opus | high | 1.4, 1.5, 1.6, 1.7, 1.8, 1.9 | `hosting/hub/build-seed.mjs`, `hosting/hub/index.html` (53, 301), `hosting/hub/sop-layout.css`, `hosting/SITE.md`, `hosting/deploy-site.ps1` (the new preflight block after :359 only), `_plan/09-23_runbook-tasks/verify/snippet-counts.mjs` [NEW] | `tracker/seed/runbook-nct.json`, runbook .md files |

Justification: A is opus because the gates and waits encode deploy-order risk (§7), and a wrong `waitsFor` misleads implementers. B is opus because check #6 must not change today's snippet output.

Run mode: **A ∥ B**, then a serialization point: B runs `--report-snippets` against A's JSON and hands the list to A (Task 1.3b); B then runs the build against A's final JSON. The wave rule must pass with A's content, and each §10 negative test (through `--runbook` on a scratch copy) must fail with its exact string. Then the Convex dev seed.

### 6.2 Phase 2: pages

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent C (pages) | general-purpose | sonnet | medium | 2.1–2.4 | `hosting/deploy-site.ps1` (the new table and loop, the `PAGES` check after :386, plus the :326 comment), `hosting/hub/projects.json`, `hosting/hub/index.html` (line 616 only), `hosting/pwa/sw.js`, `hosting/SITE.md`, `README.md` | `plans/*.md` |

Run mode: a single agent. The work is mechanical and copies an existing table. **index.html has one owner in this phase: Agent C.**

### 6.3 Phase 3: tasks

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (data+build) | backend-engineer | opus | high | 3.1–3.4, 3.11, 3.12 | `tracker/seed/runbook-nct.json`, `hosting/hub/projects.json`, `hosting/hub/build-seed.mjs`, `hosting/hub/build-runbook.mjs`, `hosting/hub/runbook-body.css` [NEW], `hosting/deploy-site.ps1` (~358-363), `hosting/SITE.md`, `_plan/09-23_runbook-tasks/verify/expected-status.mjs` [NEW] | `hosting/hub/index.html` |
| Agent D (dashboard) | frontend-engineer | opus | high | 3.5–3.10 | `hosting/hub/index.html` (sole owner) | `hosting/hub/golden-path.js`, `seed.json` built by A, `mockup.html` |

Justification: D is opus because it rewires routing and the legacy-URL mapping (§7 breakage surface) inside a 1100-line file shared with another session.

Contract A→D, fixed before either starts: the §4.2 input shape and the §4.3 output shape, and the `/*RUNBOOK_CSS*/` placeholder name. D develops against a hand-built `seed.json` that follows the contract.

Run mode: **A ∥ D**, then a serialization point: a DryRun with A's real seed, and D's golden path in the browser.

### 6.4 Phase 4: Overview and Findings

| Agent | subagent_type | Model | Effort | Tasks | Owns (write) | Reads only |
|---|---|---|---|---|---|---|
| Agent A (data+build) | backend-engineer | opus | high | 4.1, 4.2, 4.6 | `tracker/sop-findings.mjs` [NEW], `tracker/build-seed.mjs`, `tracker/seed/tasks-nct.json`, `tracker/seed/flow-nct.json`, `customer-intake-sop/sop.json` (the 30 fix `"id"` fields only), `tracker/SCHEMA.md`, `hosting/hub/build-seed.mjs`, `hosting/deploy-site.ps1` (:109), `hosting/hub/projects.json`, `hosting/SITE.md` | `customer-intake-sop/sop.json`, built SOP page (fold and id rules) |
| Agent E (sop layer) | frontend-engineer | sonnet | medium | 4.3 | `hosting/hub/sop-layout.js`, `hosting/hub/sop-layout.css` | built SOP pages (NCT, JWA, Harper) |
| Agent D (dashboard) | frontend-engineer | sonnet | medium | 4.4, 4.5 | `hosting/hub/index.html` (sole owner) | `flow-nct.json`, `tasks-nct.json` |

Justification: A is opus because the id-rule reimplementation must reproduce 48 Convex keys exactly, and a mismatch orphans ticks.

Run mode: **A ∥ E ∥ D**, then a serialization point: a DryRun, then checking the NCT, JWA and Harper SOPs.

Ownership hand-offs across phases:
- `hosting/hub/index.html`: Agent B (P1, lines 53/301) → Agent C (P2, line 616) → Agent D (P3, P4)
- `hosting/SITE.md`: B (P1) → C (P2) → A (P3, P4)
- `hosting/hub/projects.json`: C (P2) → A (P3, P4)
- `hosting/deploy-site.ps1`: B (P1, the preflight block after :359) → C (P2, the new table, loop and `PAGES` check) → A (P3 ~358-363; P4 :109)
- `tracker/seed/runbook-nct.json`: Agent A (content, P1, sole writer) → Agent A (data+build, P3)
- `.claude/launch.json`: the golden-path session (main tree, H1); the orchestrating session adds the uncommitted 8794 entry to the worktree's copy only
- `_plan/09-23_runbook-tasks/verify/*.mjs`: B (P1, snippet-counts) → A (P3, expected-status)

### 6.5 Smell test
- [x] Each task has one owner.
- [x] No file has two owners in a phase. (Revised: `snippets:false` edits moved from B to A, so `runbook-nct.json` has only A in Phase 1; B's deploy-site.ps1 block in Phase 1 and C's in Phase 2 are in different phases.)
- [x] The parallel groups are disjoint.
- [x] Every opus assignment is justified, and there is no haiku.
- [x] The sequential points name their artifacts: B's `--report-snippets` list, `seed.json`, the DryRun output, `expected-status.mjs` output.
- [x] Phase 1 delivers J2 end to end (in today's Runbook view).
- [x] Every file the other session has uncommitted is in H1, and no phase writes one of them before H1 lands.

---

## 7. Impact and breakage

### 7.1 Callers of what changes (grep run this pass)
- **Runbook page URLs** (`steps-*-runbook`, `step-27-runbook`) are referenced by:
  - `docs/zyt-commands.md`
  - `hosting/deploy-site.ps1`
  - `hosting/hub/projects.json`
  - `hosting/pwa/sw.js`
  - `hosting/SITE.md`
  - `README.md`
  - `tracker/seed/runbook-nct.json`
  - the runbooks themselves
  - `plans/step-16-lading-create.md`, `plans/step-27-month-close-truth.md`, `plans/steps-{12-15,16-19,20-26}-crosscheck.md`
  - older `_plan/` docs

  **All keep working, because the pages keep building at the same paths (D6/D13).** Only the listing changes.
- **`selectTask`** (index.html:948) is called from `taskRow` (:676), `stepRow` (:697), the findings panel close (:797), the step panel close (:843), `renderStepPanel` waits-for (:862), the scrim (:1072), Esc (:1078) and start-up (:1093). Each is replaced: row and waits-for clicks by `openTask`/`selectFinding` through `resolveKey`, the closes, scrim and Esc by the view's own close, start-up by `routeFromUrl`.
- **`view: 'runbook'` / `S.view === 'runbook'`**: the initial state `S = { … view: 'runbook' … }` (:526 in HEAD's working copy; re-grep, since the golden-path session's edits can shift it), :708-709, :716-768, :943, :950, :1046-1052 and start-up (:1090) are replaced.
- **`t.no` / `st.letter` / `t.stage.letter`** at :658 (search haystack), :690, :696, :701, :709 (`st.letter`), :842, :852, :854, :863 and :915 become `x.n` / `x.ref` / the task's `short`.
- **`SEED.pageTitles`** (:505): hidden pages stay in `pages`, so titles survive. Plan titles come from attachments.
- **`sourceByHref`** (build-seed.mjs:87): D13 keeps runbooks in `pages`, which avoids the empty-snippets trap. Check #6 guards against it anyway.
- **`--no-ledger`** strips `meta.auditCommit` and `meta.promptDecisions` from the *embedded* data only (build-page.mjs:410-418). `sop.json` is untouched, so `/zyt-audit` and `/zyt-update` keep working. The per-step "/planpro Prompt" disappears from the NCT step modal. Accepted: its content is the same fix text, now in Findings.

### 7.2 Flows before and after, and deploy coupling
| Flow | Before | After | If out of sync |
|---|---|---|---|
| Tick a step | `findings.setState(key)` | Same call, same key | New step ids with no Convex row → "That task does not exist." toast. Prevented by §7.3 order and caught by the deploy preflight (Task 1.8, D34), which refuses a real deploy while any key lacks a row |
| Prompts dialog | Snippets from `link`/`prompts` | Same. Check #6 fails the build if a wave step's snippets come out empty | — |
| Old `?task=<step>` link | Runbook view plus drawer | Task view plus expanded step | Covered by `resolveKey` (§10 regression) |
| Zips | 7 bundles | Same names and contents. Phase 2 adds no bundle | A missing file still throws (:347) |
| Service worker | `PAGES` has every runbook, plan 11–27 and 3 crosschecks | Plus 11 pages (Phase 2). The loader reuses precached pages | Before the new worker activates, an old body may be served. Handled by the heading fallback |
| SOP ticks | localStorage per browser | Convex. A one-time import | Ticks dropped only if the user dismisses the banner |

### 7.3 Deploy order per phase (production steps are Wilfred's)
- **Phase 1 (Wilfred).** In the worktree's `hosting/convex-app` (set up per §7.4, so `.env.local` names the `zyt-admin` project), at the **exact commit that will be merged**: `npx convex deploy -y` — confirm the CLI names the prod deployment **`impartial-sockeye-436`** (deployment.json `prodUrl`) before it proceeds — then `npx convex run --prod seed:nct` (expect `inserted` = Agent A's count). `seed.ts` bundles the branch's `runbook-nct.json`; the functions themselves are unchanged. If `runbook-nct.json` changes on the branch after this, run both again. Then merge (H5), then run `deploy-site.ps1` from `C:/Project/ZYT-Task`; its preflight (Task 1.8) confirms every key has a prod row. **The Convex step must come first.** Once the merge lands, any deploy by the golden-path session ships the new steps, and the preflight protects it too.
- **Phase 2.** Merge (H5), then deploy the site. No Convex step.
- **Phase 3.** Merge (H5), then deploy the site. No Convex step. The seed shape and index.html ship in one build, so they cannot skew.
- **Phase 4.** Before merging, check that the regenerated `tasks-nct.json` has 0 id changes (Task 4.1 proves it). If a later `sop.json` edit adds ids, follow the full order (Task 4.6): regenerate, add the ids to a workstream in `client-tasks-nct.json`, dev `npx convex dev --once && npx convex run seed:nct`, then **Wilfred** runs `npx convex deploy -y && npx convex run --prod seed:nct` from the worktree at the merge commit. Then merge (H5) and deploy the site. No agent runs a `--prod` or `deploy` command.

### 7.4 Blocking prerequisites
1. **H1:** the golden-path session commits its edits. This blocks Phase 1, whose only seed file is one they have edited.
2. A worktree at `C:/Project/ZYT-Task-rbtasks` (a sibling, so `..\JWASystemv2` and `..\OpenWA` resolve; deploy-site.ps1:272, :306, :318), branched after H1. Setup, done once by the orchestrating session:
   - `npm install` in `hosting/` (marked, for the build scripts).
   - `npm ci` in `hosting/convex-app` (its own `package.json` and lock; pins convex 1.45.0, so `npx convex` never fetches another CLI).
   - Copy `hosting/convex-app/.env.local` from `C:/Project/ZYT-Task` into the worktree. It is gitignored (`hosting/convex-app/.gitignore:2`), so nothing is committed; it holds `CONVEX_DEPLOYMENT=dev:small-snail-912`. Without it the CLI prompts to configure a project (an agent hangs) or creates a stray one.
   - **Check:** `npx convex dev --once` in the worktree's convex-app prints `small-snail-912` and does not prompt. Stop if it prompts or names another deployment.
   - Add the `hub-preview-rbtasks` entry (8794) to the worktree's `.claude/launch.json` (uncommitted; §6.0 "Preview config").
   This blocks all phases.
3. **H2a:** blocks Phase 2. **H2:** blocks Phase 3.

### 7.5 The other session, and the public repo
- The other session may deploy from `C:/Project/ZYT-Task` at any time. Because this work lives in the worktree until merged, their deploys ship none of it half-done. After each merge, their next deploy ships the merged phase. That is intended, and it is why §7.3's Convex step must run **before the merge** for Phase 1.
- Wilfred runs the prod seed, then merges.
- **Public repo.** Step details are paraphrased from runbooks already published. Assignee values are first names people already tick under on the public site, with no emails and no surnames by default (D11). The mockup folder (2.9 MB, including a copy of the published SOP and its 32 shots) contains nothing new, but it duplicates published data. Recommendation: commit only `mockup.html`, `plan/` and `verify/`, and add `_plan/09-23_runbook-tasks/sop/` and `shots/` to `.gitignore`. `.gitignore` has the golden-path session's uncommitted block today, so this edit is made only after H1 lands, by whoever commits the plan folder. This is non-blocking.
- No secrets are touched. The runner remains 127.0.0.1-only with its allow-list.

---

## 8. Cross-cutting concerns

- **Accessibility:**
  - Tasks rows are links (`<a href="?company=nct&task=…">`), so middle-click and keyboard work. The status is text in a pill, not only colour.
  - The ticks keep their `aria-label` with `ref + title`.
  - The expanded step is `aria-expanded` on its title button. The slide-over is `role="dialog" aria-modal="true"` with a focus trap and focus return.
  - The Overview iframe has a `title`. The menu uses `aria-current="page"`. The chips are `aria-pressed`.
  - Reduced motion: no smooth scroll under `prefers-reduced-motion`.
- **Phone (at most 48rem):** as J6. The 16px side gutter stays. There is no horizontal scroll: tables inside bodies scroll in `.rb-table`. The sheet is full width with a sticky header. The mockup's column-hiding rules (mockup.html:169-170) are adopted.
- **Dark and light:** new rules use the existing tokens (`--canvas`, `--surface`, `--border`, `--accent`, `--ok`), plus a `--warn` pair and the five runbook-body aliases (`--ink`, `--ink-soft`, `--ink-faint`, `--rule`, `--surface-sunk`, §4.4) added to both token blocks at :23-41 and :283-331. Dark stays the default (`zyt.theme`). The frame follows through the `storage` event. The shadow-root sheet inherits those custom properties from the dashboard's `:root`, which now defines them; `runbook-body.css` declares its own font variables. §10 Phase 3 compares computed styles against the unlisted page in both themes.
- **Offline:**
  - The dashboard is network-first, and bodies come from the precached pages.
  - Ticks need a connection: `setConn('offline')` already makes the page read-only, and tick buttons are disabled with the existing title.
  - The Overview frame is a navigation, so it is network-first with a cached fallback.
  - `?embed=1` shares the path-keyed cache entry.
- **Error handling:**
  - `loadDoc` failure: an inline error with "Open the page ↗", and a retry on the next open.
  - A missing heading: a fallback note.
  - Import banner: partial failure keeps both keys and toasts the count ("<n> of <m> not saved — try again").
  - Build: every content defect throws with the id or heading named, using the exact strings of §4.3 and §4.8.
  - Deploy: the Convex-row preflight (D34) and the `PAGES` check refuse a deploy with the keys or paths named.
- **Testing:** there is no test suite in this repo. The build checks are the tests: each check (§4.3 #2–#7, the drift check, the preflight and the `PAGES` check) has a negative test in §10 with its exact expected string, run through the `--runbook`/`--sop` overrides on scratch copies so no tracked file is edited. Two scripts under `_plan/09-23_runbook-tasks/verify/` (snippet counts, expected status) give the browser walks fixed expectations. Browser verification follows §10.
- **Rollback:** each phase is one merge commit. Added Convex rows are inert. Pages are never deleted, so shared links survive a rollback.
  - Revert in **reverse phase order** (4, then 3, then 2, then 1): Phase 4 depends on Phase 3's views, and Phase 3 on Phases 1–2's content.
  - After each revert, run the DryRun gate on 8794 before any redeploy.
  - If a revert conflicts with the golden-path session's later commits in index.html, sop-layout.js or runbook-nct.json, **stop and ask**; do not resolve their hunks by hand.
  - Phase 4 rollback: remove `--no-ledger` and the SOP list returns. A browser that imported has its old ticks under `….imported` (§4.8); SITE.md carries a one-line console snippet that renames it back, so the restored SOP list and Findings agree again. Pinned fix ids in `sop.json` stay (they equal the derived ids, so the SOP page is unaffected).
- **Performance and scalability:** N/A. No Convex query, endpoint contract, migration or server path is added or changed; `board` and `setState` are unchanged. Client cost:
  - one runbook page fetch per task open, 23–126 KB raw and about 5–32 KB gzipped (the article), plus about 41 KB of wrapper, since the pages are served precached
  - the seed grows by about 12 KB for ~57 steps and 8 tasks
  - the iframe loads only when Overview is first opened (`loading="lazy"`), and is then cached per company and never reloaded by a re-render (§4.6)
  - the runbook body is parsed and inserted once per task open (cached in `DOC_NODES`), not on each tick.

---

## 9. Decision register

Order: Open, then Decided (Wilfred), then Decided-by-recommendation, then Assumed (taken by this plan, overturnable).

**D1: Which new 16–27 steps carry a `run` (golden path), and with which job?** · Status: **Open** (the golden-path session's call)

| | Approach | Consequence |
|---|---|---|
| **A** | `run` on the last wave step of each job's range: `rb-nct-1619-w16-step17` → `nct-bl-run-steps-16-19`; `rb-nct-2026-w19-step23` → `nct-bill-build-steps-20-23`; `rb-nct-2026-w20-step25` → `nct-invoice-close-steps-24-27`; `rb-nct-27-w23-step27-p2` → `nct-invoice-close-steps-24-27` | Matches F11's precedent (the last wave carries the journey). The prompts already tell every wave to run it |
| **B** | `run` on every wave step that touches the job's steps | Many identical panels, but still one runner per job (GP_PANELS caches per job) |
| **C** | No `run` on the new steps until the golden-path session adds them | Nothing to agree now. The buttons appear later |

- **Recommendation: A.** It follows the only existing precedent (F11) and the job ranges in `golden-path.js` BY_STEP.
- **Chosen:** — (open)
- **Blocking?** No. Phase 1 can ship with C and add `run` in any later seed edit.
- **Where it lands:** Tasks 1.1–1.3, H2(d)

**D2: How runbook work appears on the dashboard** · Status: **Decided (Wilfred)**

| | Approach | Consequence |
|---|---|---|
| **A** | One task per runbook, with its steps as the checklist | One place per runbook. Stages become sub-groups |
| **B** | One task per wave | ~50 tasks. The list becomes the old long list again |
| **C** | Keep the stage list and add runbook links | No change to the core problem |

- **Recommendation: A**
- **Chosen:** A (Wilfred)
- **Blocking?** —
- **Where it lands:** §4.2, Phase 3

**D3: Where steps come from** · Status: **Decided (Wilfred)**

| | Approach | Consequence |
|---|---|---|
| **A** | Hand-written in the seed. The build fails if a runbook wave heading has no step | Steps carry owner, gate and waits judgement. Drift is caught |
| **B** | Generated from the wave headings | No owners or gates. Brittle to heading edits |
| **C** | Hand-written, no check | Silent gaps, as in 16–27 today |

- **Recommendation: A**
- **Chosen:** A
- **Blocking?** —
- **Where it lands:** §4.3 #5, Tasks 1.1–1.4

**D4: When the runbook body loads** · Status: **Decided (Wilfred)**

| | Approach | Consequence |
|---|---|---|
| **A** | When the task opens | +0 seed size. One fetch per open |
| **B** | Embedded in the seed | +379 KB on every dashboard load |
| **C** | Link out to the page | Loses the "one place" goal |

- **Recommendation: A**
- **Chosen:** A
- **Blocking?** —
- **Where it lands:** §4.4

**D5: How plans open** · Status: **Decided (Wilfred)**

| | Approach | Consequence |
|---|---|---|
| **A** | Slide-over with the plan text | The task stays in view |
| **B** | Navigate to the plan page | Loses context |
| **C** | Inline accordion in the rail | A 19rem rail is too narrow for 100 KB plans |

- **Recommendation: A**
- **Chosen:** A
- **Blocking?** —
- **Where it lands:** Task 3.9

**D6: Task status** · Status: **Decided (Wilfred)**

| | Approach | Consequence |
|---|---|---|
| **A** | Derived from ticks, never set by hand | No second source of truth. No Convex change |
| **B** | A manual status field in Convex | Drifts from the ticks. Needs schema and mutation |
| **C** | Derived, with a manual override | Complexity for a rare case |

- **Recommendation: A**
- **Chosen:** A
- **Blocking?** —
- **Where it lands:** §4.6

**D7: What happens to the runbook pages** · Status: **Decided (Wilfred)**

| | Approach | Consequence |
|---|---|---|
| **A** | Kept built, unlisted, never deleted | Every shared anchor and the prompts dialog keep working |
| **B** | Deleted, with the text only in the dashboard | 404s for shared links. Snippet sources break |
| **C** | Kept listed | The sidebar clutter stays |

- **Recommendation: A**
- **Chosen:** A
- **Blocking?** —
- **Where it lands:** D13, Task 3.2

**D8: Filter chips on Tasks** · Status: **Decided (Wilfred)**

| | Approach | Consequence |
|---|---|---|
| **A** | All · Open · Needs Wilfred · My tasks | Matches the two real roles |
| **B** | All · Open · Done | Today's chips. No role view |
| **C** | Free filters (owner, status, stage) | More UI for 8 rows |

- **Recommendation: A**
- **Chosen:** A
- **Blocking?** —
- **Where it lands:** Task 3.7

**D9: Left menu** · Status: **Decided (Wilfred)**

| | Approach | Consequence |
|---|---|---|
| **A** | Overview · Tasks · Findings | Three nouns, matching the three views |
| **B** | Keep the page list only | The runbooks stay in the sidebar |
| **C** | Tabs in the middle column | The menu is empty on desktop |

- **Recommendation: A**
- **Chosen:** A
- **Blocking?** —
- **Where it lands:** Task 3.6

**D10: Where "What to fix first" lives** · Status: **Decided (Wilfred)**

| | Approach | Consequence |
|---|---|---|
| **A** | Moves to Findings | One list |
| **B** | Stays on the SOP, Findings too | Two lists, two tick stores |
| **C** | Only on the SOP | Loses Convex history and workstreams |

- **Recommendation: A**
- **Chosen:** A
- **Blocking?** —
- **Where it lands:** Phase 4

**D11: Who "My tasks" means (assignee)** · Status: **Decided-by-recommendation** (overturnable)

| | Approach | Consequence |
|---|---|---|
| **A** | Optional `assignee` (a person's name) on a step in the seed. My tasks = a step assigned to the viewer **or** ticked by the viewer. `owner` stays a role | No Convex change. Names are public in git (first names only) |
| **B** | Assignee stored in Convex and editable on the page | Needs a schema field, a mutation, events and a prod deploy |
| **C** | No assignee. My tasks = ticked by me, or the role's ready steps (the mockup) | "Session" is everyone, so My tasks is noisy |

- **Recommendation: A.** `board` already returns `updatedBy`, and seed edits are the existing way to change steps.
- **Chosen:** A (by recommendation)
- **Blocking?** No
- **Where it lands:** §4.2, §4.3 #7, §4.6

**D12: One findings list** · Status: **Decided-by-recommendation** (overturnable)

| | Approach | Consequence |
|---|---|---|
| **A** | One list in the dashboard's Findings, one set of ticks in Convex. The SOP's localStorage ticks and its dead comment box are retired (NCT built `--no-ledger`) | One answer. The 48 keys already exist, so no new rows are needed |
| **B** | Keep both lists and sync the SOP ticks into Convex | Needs template changes in the zyt-setup skill, which affects JWA and Harper |
| **C** | Keep both as they are | Two contradicting states |

- **Recommendation: A.** The 48 ids already map 1:1, and the comment box never worked on this site.
- **Chosen:** A (by recommendation)
- **Blocking?** No (Phase 4)
- **Where it lands:** §4.8, Phase 4
- **The claude.ai artifact copy** (SITE.md:45: the NCT source is also published as an artifact on another Claude account). With a shared store, that copy keeps ticks at `fixes/<id>` and comments in `comments/` (sop-template.html:2664-2666). This plan cannot read that account. Recorded choice: its ticks and comments are **abandoned on purpose**; they are not migrated. Before Phase 4 merges, Wilfred opens that artifact once; if it holds ticks he wants, he ticks the same items in Findings by hand (the ids are the same), and pastes any comment worth keeping into the finding's repair note in `sop.json`. SITE.md (Task 4.6) records this.

**D13: How the runbooks and crosschecks leave the sidebar** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | `"nav": "hidden"` on their `pages` entries | Keeps `source` (snippets, mtime, title). Follows the `nav:"header"` precedent |
| **B** | `unlisted` becomes `{href, source}` objects | A shape change across the build. Titles are lost |
| **C** | Move them to `unlisted` as bare hrefs | **Silently empties every "Show and copy"** (build-seed.mjs:52) |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** Tasks 2.2, 3.2, 3.6

**D14: Seed shape for tasks** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | A top-level `tasks[]` grouping the existing `stages[]` by id | seed.ts and every key are untouched |
| **B** | Reshape stages into tasks (D+F merged) | seed.ts and the client both change. Risky moves of ids |
| **C** | Derive tasks from each step's link href | Loose steps and D's plan links break the grouping |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** Yes, for Task 3.1 (settled)
- **Where it lands:** §4.2

**D15: Source of the runbook body and plan text** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Fetch the served page and parse `article.rb-body` / `nav.rb-toc` | No new URL. Offline through the existing precache. Ids identical by construction. About 41 KB of extra wrapper per open |
| **B** | A new `--frag` JSON output beside each page | Smaller payloads. New URLs must be added to `sw.js`, and more deploy-site edits |
| **C** | deploy-site regex-extracts the article into a file | Fragile regex, plus B's service-worker work |

- **Recommendation: A.** It needs the fewest edits in files the other session also touches, and it works offline today.
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §4.4, Task 3.8

**D16: Step numbering** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Per task 1…n. Cross-task refs are "Steps 4–10 · 2" | Readable. The ids do not change |
| **B** | Keep the stage letters | "D1/F1" inside one task confuses |
| **C** | Wave labels ("W12·16") | Gates and setup steps have no wave |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §4.6

**D17: Where a step's detail shows in the task view** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Expands inline under the checklist row | Full width is kept. Golden-path nodes are moved, not recreated |
| **B** | A right drawer over the rail | Two right-side layers (the drawer and the sheet) |
| **C** | A separate step page | Loses the checklist context |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** Task 3.8

**D18: Isolating slide-over ids and styles** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Shadow root | No id collisions with the task body. Scoped CSS |
| **B** | An iframe of the page plus `?embed=1` | The plan pages would need embed mode, and the mockup's iframe shows the chrome |
| **C** | Prefix ids at render time | Rewrites in-plan anchors, and fragile |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** Task 3.9

**D19: How Overview shows the SOP** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | An iframe with `?embed=1` handled in sop-layout.js | The page's scripts and chain sheet work unchanged |
| **B** | Fetch the page and inline it | 375 KB of scripts and global ids collide with the dashboard |
| **C** | Overview links out | Not "inside the dashboard" |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §4.9, Task 4.4

**D20: How the NCT SOP stops showing its fix list** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | `--no-ledger` on the NCT build | Nothing is rendered, and no localStorage writes. The step modal loses "What to fix" and the Prompt |
| **B** | Hide `#fixes` with CSS or JS in sop-layout, scoped to NCT | The widgets still run and write localStorage. Leak risk for JWA and Harper |
| **C** | Edit the zyt-setup template | Changes all three SOPs and the claude.ai artifact |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** Task 4.2

**D21: One content source for findings** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Regenerate `tasks-nct.json` from `sop.json`. The build fails on id drift | A `/zyt-update` or `/zyt-audit` ledger change is caught before ticks break |
| **B** | Freeze `tasks-nct.json` as hand-maintained | It silently goes stale against sop.json |
| **C** | Read sop.json at dashboard build only | Convex `seed.ts` still imports `tasks-nct.json`, so they diverge |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** Tasks 4.1, 4.2

**D22: The old browser-only SOP ticks** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | A one-time import banner in Findings (same origin, so both old keys are readable), which lists the items, skips reopened ones and keeps the key as `….imported` | No lost work. Needs a name; ticks are recorded under the importer's name and today's date |
| **B** | Drop them silently | Someone's local progress vanishes |
| **C** | Keep the SOP list read-only as an archive | A second list lingers |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** Task 4.5

**D23: Where the work happens next to the golden-path session** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | A sibling git worktree `C:/Project/ZYT-Task-rbtasks`, merged per phase under protocol H5. Only Wilfred deploys prod | Their deploys never ship half-done work. One-time setup: `npm install` in `hosting/`, `npm ci` in `hosting/convex-app`, a copy of the gitignored `.env.local` (§7.4) |
| **B** | The same tree, with a deploy freeze agreed by message | Relies on discipline. One slip ships a broken dashboard |
| **C** | Wait until they finish | An idle, unbounded wait |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** Yes, for Phase 1 (setup only)
- **Where it lands:** §6.0, §7.4

**D24: The activity feed under the 300-event cap** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Keep the cap, and say "Older changes are not shown" when it is hit | No backend change |
| **B** | Raise `HISTORY_LIMIT` | Larger subscription payload for every viewer, and a prod Convex deploy |
| **C** | A per-key history query when a task opens | New query and deploy. Exact history |

- **Recommendation: A.** Revisit with C if the note shows up in practice.
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §4.7

**D25: What happens to the golden-path session's page list** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Keep it, filtered by `nav:"hidden"`, under the new three-item nav | Minimal overlap with their design. Harper's "What the bot answers" stays reachable |
| **B** | Remove it entirely | Harper's reference page and cross-company SOP links vanish |
| **C** | Move the remaining pages to the top bar | Crowds the top bar on phones |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No (H2)
- **Where it lands:** Task 3.6

**D26: Default view and legacy URLs** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Tasks by default. `?view=runbook` → Tasks. A step id → its task. A finding id → Findings | Every old link lands somewhere sensible |
| **B** | Overview by default | The runbook work is one click further away for the main users |
| **C** | Remember the last view per browser | Shared links behave differently for each person |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §4.5

**D27: Ids for the new steps** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | `rb-nct-<range>-<slot>`, e.g. `rb-nct-1619-w12-step16` | Readable and stable, with no stage letter to go stale |
| **B** | Continue the letters, e.g. `rb-nct-g4-…` | Bakes in the numbering being retired |
| **C** | Opaque ids | Unreadable in the Convex dashboard and in URLs |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** Yes, for Task 1.1 (settled)
- **Where it lands:** Appendix A

**D28: What counts as a wave heading** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Lexer headings (any depth) whose text matches `^(\d+\.\s*)?Wave\s+\d+` | Verified: 3/4/10/11/19/3. Ignores the `# Wave` comments inside code blocks |
| **B** | An explicit list of wave ids per task in the seed | Hand-maintained, and can itself drift |
| **C** | A marker comment in the markdown | Edits six runbooks |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §4.3 #5

**D29: The blank-on-scroll top bars** · Status: **Dropped 2026-09-23** (Wilfred). Making the bars opaque did not fix the blank screenshots on the live runbook pages, so the cause is the browser pane's capture, not `backdrop-filter`; users never saw it. The frosted bars stay

| | Approach | Consequence |
|---|---|---|
| **A** | Opaque backgrounds, no `backdrop-filter`, on both bars | Fixes it everywhere. Purely visual |
| **B** | `@supports`-guard the filter | The embedded browser supports it and still blanks |
| **C** | Leave it | The bug stays |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** Task 1.5

**D30: Phase order** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Content and rule first (16–27 steps usable in today's UI), then pages, then tasks, then Overview and Findings | Each phase ships value on its own. The Phase 3 build rule is already green |
| **B** | Tasks UI first | 16–27 tasks show empty checklists, and the build rule cannot be on yet |
| **C** | Everything in one release | One big risky deploy |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §5

**D31: Where task properties and attachments come from** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Hand-written in `tasks[]`, checked by the build (hrefs known, zip exists) | Explicit. One place |
| **B** | Derived from `$bundles` in deploy-site.ps1 | The build parses PowerShell, which is fragile |
| **C** | Derived from `projects.json` by range matching | Implicit, and fails silently on odd names |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §4.2, §4.3 #4

**D32: Where `flow-nct.json` comes from after Phase 4** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Regenerate it from `sop.json` in the same script as the findings | One source; no script reads `customer-intake-sop.html`, which `/zyt-update` may overwrite. Step titles lose the appended badge (diff accepted in Task 4.1) |
| **B** | Keep scraping `customer-intake-sop.html` for the flow only | Half-HTML script. A `/zyt-update` rebuild of that file (registry `noLedger: true`) silently changes "Group by SOP step" |
| **C** | Freeze `flow-nct.json` as hand-maintained | Goes stale against `sop.json` step titles and routes |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §4.8, Task 4.1

**D33: Keeping step-fix keys stable when a fix is reworded** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Pin the 30 derived ids into `sop.json` once (`"id"` per fix, which the template already honours), and have the drift check report a rename with the "pin the old id" fix | Rewording never orphans a tick or its history. 30 small edits to `sop.json` |
| **B** | Rename detection only, no pinning | Every reword still trips the build until someone pins by hand |
| **C** | Keep title-derived ids, reseed on drift | A reword creates a new open row and orphans the old tick (breaks SITE.md:217) |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §4.8, Task 4.1

**D34: Guarding against a site deploy before its Convex seed** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | A preflight in deploy-site.ps1 that queries the public `findings:board` on the target URL and refuses a real deploy while any seed key has no row (DryRun warns) | Every deployer (this work, the golden-path session, `/zyt-update`) is protected. One HTTP call per project per deploy |
| **B** | Rely on the §7.3 order and SITE.md | One slip ships keys whose ticks fail with "That task does not exist." |
| **C** | Have deploy-site.ps1 run `seed:nct --prod` itself | Puts a prod mutation in a script other agents run; violates "production steps are Wilfred's" |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** Task 1.8, §7.3

**D35: How negative build tests get their bad input** · Status: **Assumed**

| | Approach | Consequence |
|---|---|---|
| **A** | Path overrides on the two build scripts (`--runbook`, `--sop`, `--public`, `--out-dir`) pointing at scratch copies | No tracked file is ever edited for a test, so no test edit can be committed to the public repo or seeded into prod. Four small flags |
| **B** | Run each test in a throwaway copy of the whole tree under the scratchpad | No script change, but a ~3 MB copy per test and relative paths (`..\JWASystemv2`) differ |
| **C** | Edit the tracked file in the worktree, run, revert | Simplest, and the risk the review flagged: a forgotten revert ships a deleted step |

- **Recommendation: A.**
- **Chosen:** A
- **Blocking?** No
- **Where it lands:** §4.3 "Test overrides", Tasks 1.4, 3.3, 4.1, 4.2, §10

### Risks
- **The golden-path session edits `runbook-nct.json` or `index.html` mid-phase.** Likelihood medium, impact is a merge conflict. **Mitigation:** H1 and H2 before the phase, work in the worktree, and rebase before merging.
- **The findings id rules are reimplemented wrong.** Likelihood low, impact is orphaned ticks. **Mitigation:** Task 4.1 must prove the same 48 ids in the same order before merging, and the drift check guards it afterwards.
- **An authored `waitsFor` contradicts a runbook's "Starts when".** Likelihood medium, impact is a misleading "Ready". **Mitigation:** Appendix A encodes §3 of each runbook, and the §10 Phase 1 review reads each wave's "Starts when" against the seed.
- **A prod site deploy lands before the prod seed.** Impact is tick errors on new steps. **Mitigation:** §7.3 order, with the Phase 1 merge gated on Wilfred's seed run.
- **The build rule blocks an urgent redeploy** (for example an SOP text fix while tasks-nct is stale). **Mitigation:** the error names the exact commands, and the prod steps in it are addressed to Wilfred. With ids pinned (D33), a reword no longer trips it.
- **A merge lands in the golden-path session's working tree while they have uncommitted edits or a build running.** Impact: a refused merge, or a deploy of a mixed tree. **Mitigation:** H5 (clean-status check, hand-held deploy lock during the merge, clean status before prod deploy).
- **The Convex CLI in the worktree targets the wrong deployment or prompts.** **Mitigation:** §7.4 setup and its `small-snail-912` check; Wilfred confirms `impartial-sockeye-436` before any prod command.

---

## 10. Verification and proof

**App URL:** `http://localhost:8794/?company=nct` for every local check. This is `hub-preview-rbtasks`: python http.server over `C:/Project/ZYT-Task-rbtasks/hosting/site/public`, the worktree's build (added to the worktree's own `.claude/launch.json`, §7.4). Port 8791 (`hub-preview`) serves the **main** tree's `public/`, which is the golden-path session's build; it is never used to accept this work. The golden-path runner is the one on :4317 that the other session runs, with `RUNNER_EXTRA_ORIGINS=http://localhost:8791,http://localhost:8794` (H1); no second runner is started.

**Preconditions:**
- The worktree is set up per §7.4, including the `small-snail-912` check.
- `powershell -File C:/Project/ZYT-Task-rbtasks/hosting/deploy-site.ps1 -DryRun -ConvexUrl https://small-snail-912.eu-west-1.convex.cloud` has passed. It takes the worktree's own lock and rewrites the worktree's `public/`.
- For Phase 1: in the worktree's `hosting/convex-app`, `npx convex dev --once` (prints `small-snail-912`), then `npx convex run seed:nct` → `{inserted: N}` with N = Agent A's count of new step ids (0 on a re-run).
- A name is set in "Ticking as".
- Golden-path buttons are tested in Chrome or Edge; the desktop pane blocks loopback.
- Negative tests use scratch copies under the session scratchpad and the `--runbook`/`--sop` overrides (§4.3). Tracked files are never edited for a test.

**Migrations:** none. Convex dev seed only (no migration journal exists; the seed's `inserted` count is the check).

### Phase 1
**Before (reproduce the top-bar bug):** on the current build at 8794, in the desktop browser pane, scroll `/nct/steps-20-26-runbook/` to the bottom and back several times; screenshot a blank frame. Record "reproduced" or "not reproduced in N scrolls".

**Golden path** (today's Runbook view):
1. Open `http://localhost:8794/?company=nct` → Runbook view. Stages A–F are followed by three new stages, "Steps 16–19", "Steps 20–26" and "Step 27" (lettered G/H/I for now).
2. Click the Wave 12 `wt-step16` step → the drawer shows "Waits for …" including F11, plus "Show and copy (n blocks)".
3. Click Show and copy → the dialog lists the `#wave-12-wt-step16` prompt. It ends with the "Before the PR: run the golden path…" line (proof that the golden-path session's edit is in).
4. Copy → toast "Copied".
5. Tick the Wave 12 probes step on dev → ✓ with your name. Reload → still ticked, and history shows it.

**Edge cases (build rules; each violates exactly one rule, run as `node hosting/hub/build-seed.mjs <scratch>/out.json --runbook <scratch>/runbook-nct.json` in the worktree, expecting a non-zero exit and this exact message):**
- **#5 wave coverage:** in the scratch copy, delete `rb-nct-1619-w12-step18` **and** remove it from the `waitsFor` of `rb-nct-1619-w13-step16`, `-w13-step18` and `-w13-step19` → `nct: steps-16-19-runbook.md wave heading #wave-12-wt-step18 has no step`. (Deleting it alone would fire the existing `waits for unknown steps [rb-nct-1619-w12-step18]` first.)
- **#6 empty snippets:** in the scratch copy, remove `"snippets": false` from `rb-nct-f12-unowned-gaps` (a non-wave step, so #5 cannot fire) → `nct: runbook step rb-nct-f12-unowned-gaps takes no snippets from <its link> (set "snippets": false if that is by design)`.
- **Preflight (D34):** run `deploy-site.ps1 -DryRun` against dev **before** Task 1.7's seed → the warning `Convex https://small-snail-912… has no row for [rb-nct-1619-setup, …]` lists the new step keys; after the seed it lists none.

**Regression check:** `node _plan/09-23_runbook-tasks/verify/snippet-counts.mjs <scratch>/head.json <worktree>/hosting/site/seed.json` → exit 0, no pre-existing step id listed. `head.json` is built in `C:/Project/ZYT-Task` at the H1 commit with `node hosting/hub/build-seed.mjs <scratch>/head.json` (writes only to the scratchpad).

**Top bar (after):** `grep -n backdrop-filter hosting/hub/index.html hosting/hub/sop-layout.css` → no output. Repeat the "Before" scroll on 8794 → never a blank frame; screenshot at the same position. The bar is opaque in both themes.

**Mobile (375):** the new stages render. There is no horizontal scroll.

### Phase 2
**Golden path:**
1. Open `http://localhost:8794/nct/step-04-plan/` → the page renders with kicker "Plan" and a TOC.
2. Open `/nct/steps-4-10-crosscheck/` → it renders.
3. Open `/nct/downloads/steps-4-10-plans.zip` → it downloads, with the same file count as before (9).

**Edge case:** DevTools → Application → Service workers shows the new worker **activated** and Cache Storage holds a `zyt-admin-<build>` name different from before this DryRun. Go offline and reload `/nct/step-09-plan/` → it renders from the cache.

**Edge case (PAGES check):** temporarily add `'/nct/no-such-page/'` to `PAGES` in the worktree → the DryRun throws `sw.js PAGES lists /nct/no-such-page/, which was not built`. Revert; `git diff hosting/pwa/sw.js` shows only the 11 new paths.

**Regression check:** the dashboard sidebar still lists the same pages as before. `steps-4-10-crosscheck` does not appear.

**Mobile:** the plan page has no horizontal scroll, and tables scroll inside `.rb-table`.

### Phase 3
**Fixture (before the walk).** Dev Convex is shared, so expectations come from its current state, not from memory:
- `node _plan/09-23_runbook-tasks/verify/expected-status.mjs --me "<your name>"` → table **T0**: per task, status, `done / N`, next ready step, Needs Wilfred, My tasks.
- Step 12 of Steps 11–15 (`rb-nct-f5-gate-15-probes`) must be **open and ready** (its wait, 9 `rb-nct-f2-wave-6`, done). If not, set that on dev (tick f2 and its waits, or untick f5), write down each change, and undo them after the walk. Then `expected-status.mjs --what-if rb-nct-f5-gate-15-probes` → row **W** (Steps 11–15 after ticking 12).
- Your name has no tick in Steps 11–15 before step 7 (T0's My tasks column says "no" for it; otherwise use another name for the walk).

**Golden path (J1 and J2):**
1. Open `http://localhost:8794/?company=nct` → the **Tasks** view is selected in the left menu. 8 rows. Every row's pill, `n / N` and next ready step equal T0 ("Steps 11–15" shows `n / 19`).
2. Click **Needs Wilfred** → exactly the tasks T0 marks "yes" remain, and each shows a Wilfred owner chip.
3. Click "Steps 11–15" → the URL has `task=task-nct-steps-11-15`. The checklist shows "Step 11" (1–7) and "Steps 12–15" (8–19). There are no letters.
4. Click the title of step 9 (Wave 6) → it expands: detail, "⧉ Show and copy", "Waits for 5, 8" (a wait inside the same task is the bare number, §4.6). Click "5" → it scrolls to and outlines step 5 in the same task.
5. Click step 3's "How to do it" (it links `/nct/step-11-plan/#phase-1-…`) → the slide-over opens with plan 11's text, scrolled to that heading. There is no ZYT top bar inside it. Esc → closed, and focus is back on the link.
6. Scroll the body → the runbook text with a section nav of 14 items. Click "8. Stop gates" → scrolls there.
7. Tick step 12 (Gate 15 probes) → optimistic ✓, and the Activity rail adds "<you> ticked 12". The status pill and next ready step now equal row **W** (for example "Waiting on Wilfred" → "In progress" if a session step becomes ready; W states which).
8. Back to **All tasks**, then **My tasks** → "Steps 11–15" is listed, because you ticked in it (T0 had it "no").
9. **Assignee branch:** set "Ticking as" to `  wILFRED ` (other case, extra spaces) → **My tasks** lists "Step 27" although that name has no tick in it (`rb-nct-27-decisions` has `assignee: "Wilfred"`; check T0 run with `--me Wilfred`). Set the name to `Verifier` → "Step 27" is gone. Restore your name.
10. Open "Steps 16–19", then step 4 (Wave 12 `wt-step16`) → "Waits for 1 · One-time setup, 3 · Wave 12 probes, Steps 11–15 · 18". Click the cross-task link → the Steps 11–15 task opens with step 18 expanded.
11. Open "Steps 4–10" → Attachments → "Step 08 · quotation approval integrity" → the sheet shows plan 08. "⤓ steps-4-10-plans.zip" downloads.
12. Open "Steps 11–15", step 18 (F11, which has `run`) → the Golden path section renders (in Chrome with the runner started: Run → progress streams). Collapse, re-expand, tick another step → the same panel node, and a playing video does not restart.
13. Undo the fixture's dev changes.

**Edge cases (UI):**
- `?company=nct&task=rb-nct-b3-merge-wave-1` → Steps 1–3 with step 3 expanded and outlined.
- `?view=runbook` → Tasks.
- `?company=nct&task=nct-identity` → Findings, with its panel.
- **Back button:** open a task from the list, press browser Back → the Tasks list shows and the URL has no `task=`; Forward → the task again.
- **Runbook fetch fails:** DevTools → Application → Service workers → tick "Bypass for network" (the worker would otherwise serve the precached copy, sw.js:44-58), then Network → block `/nct/steps-11-15-runbook/`, then open the task → the inline error with "Open the page ↗". The checklist still works. Untick both afterwards.
- **Missing heading fallback:** in the console, `scrollToHeading('no-such-id')` with a task open → the body scrolls to its top and the note "This section is not in the cached copy yet — open the page ↗" shows.
- My tasks with no name → the name dialog opens.

**Edge cases (build rules, via `--runbook <scratch copy>` and, for #4, `--public <scratch dir>`; each exits non-zero with exactly this message):**
- **#2:** add `rb-nct-b-steps-1-3` to the `stages` of `task-nct-steps-4-10` as well → `nct: runbook stage rb-nct-b-steps-1-3 is in two tasks (task-nct-steps-1-3, task-nct-steps-4-10)`.
- **#3:** set a task's `id` to `nct-identity` → `nct: task id nct-identity is used twice (or by a step or finding)`.
- **#4 (attachment):** give an attachment of Steps 4–10 the href `/nct/step-99-plan/` → `nct: task task-nct-steps-4-10 attachment /nct/step-99-plan/ is not a page in projects.json`.
- **#4 (zip):** run with `--public <scratch>/public-empty` (an empty folder) → `nct: task <first task with a download, in list order> download <its zip> is missing from <scratch>/public-empty`.
- **#7:** set `assignee` on `rb-nct-27-decisions` to a 41-character string → `nct: runbook step rb-nct-27-decisions assignee must be 1–40 characters`.

**Regression checks:**
- Findings view: the chips All/Open/Done and the category filter work, the panel opens, and ticking a finding works.
- `snippet-counts.mjs` against the H1 baseline → no pre-existing step listed.
- `http://localhost:8794/nct/steps-11-15-runbook/#wave-7-wt-step15` still loads the page at that heading.
- **Computed styles:** with the browser tool's JS, compare `getComputedStyle` of the first `h2` and first `pre` in `.task-doc .rb-body` against the same elements on `/nct/steps-11-15-runbook/`: `font-size`, `font-weight`, `font-family`, `border-top-width`, `border-top-color`, `background-color` are equal, in light and in dark. Repeat for an `h2` inside the sheet's shadow root.
- **Render contract:** open Steps 11–15, scroll the body to "8. Stop gates", and store `document.querySelector('.task-doc')` as `window.__doc` in the console. In a second tab, tick any step. Back in the first tab: `document.querySelector('.task-doc') === window.__doc` is `true`, the scroll position is unchanged, and the Network panel shows no second fetch of the runbook page.

**Mobile (375):**
- The Tasks rows show dot, title and progress. The segmented Overview/Tasks/Findings control sits in the switcher row.
- The task view shows checklist, then rail, then "Sections" `<details>`, then body.
- The sheet is full width with a sticky Close. No horizontal scroll at any point.
- Dark and light: toggle and check the pills, bars and sheet in both.

### Phase 4
**Golden path (J4 and J5):**
1. Click **Overview** → the iframe shows the SOP with no second top bar. "The document" is expanded. There is no "What to fix first".
2. Click **Open the whole chain** → the chain sheet opens with the role rail. Leave it open.
3. In a second tab, tick any finding. Back in the first tab → the chain sheet is still open and the frame did not reload (the frame's `performance.timeOrigin` is unchanged). Close the sheet.
4. Toggle the theme in the dashboard → the frame switches theme without a reload. Then `localStorage.removeItem('zyt.theme')` in the dashboard console → the frame shows dark, never `data-theme="null"`.
5. Inside the frame, open a step modal and click a link to another site page → the whole window navigates, not the frame.
6. Click **Findings** → 48 findings. Group by **Rank** → "identity" first with a "Chain #1" chip. The 6 `isNew` items show a "new" chip, and none has " new" in its title.
7. Step filter **8** → only step-8 findings (5), and the URL has `step=8`. Click one → the panel, "Where in the SOP" → Overview at `#step-8` (the chain focused on step 8).
8. Tick it → ✓, and the history shows your name.

**Edge cases:**
- **Import, both keys:** on dev, pick two open findings A and B, and a third C that you tick and then untick on dev (so its history has done → open). In DevTools set `localStorage['sop.customer-intake-sop.fixDone']='["<A>"]'` and `localStorage['sop.fixDone']='["<B>","<C>"]'` (bare ids, no `nct-`), reload Findings → the banner lists A and B, and lists C as "reopened since, not applied". Apply → A and B are done in Convex dev under your name; both keys are gone and their `….imported` copies exist. Reload → no banner.
- **Import failure:** set the keys again with two open ids, then set DevTools Network to Offline after the banner shows → Apply toasts "2 of 2 not saved — try again" and both keys remain.
- **Drift (stale):** `node hosting/hub/build-seed.mjs <scratch>/out.json --sop <scratch>/sop.json` with a fake ledger item appended to the scratch copy → the stale message verbatim, naming `nct-<fake id>` under `extra`, and saying the prod steps are Wilfred's.
- **Drift (rename):** in a scratch copy, reword one fix title **and** delete its pinned `"id"` → the rename message naming the old and new ids and "Pin the old id".
- **Audit status:** `node tracker/build-seed.mjs --sop <scratch>/sop.json --out-dir <scratch>/out`, where the scratch ledger item `identity` has `"status": "fixed", "fixedAt": "2026-09-20"` → `<scratch>/out/tasks-nct.json` has both fields on `nct-identity`. The chip is checked in the browser against Agent D's hand-built contract `seed.json` with the same fields: "Fixed (audit) · 20 Sep 2026" shows, and the Open filter and counts treat the item as closed.
- **Regeneration is stable:** `node tracker/build-seed.mjs` on the branch, then `git diff --exit-code tracker/seed/tasks-nct.json tracker/seed/flow-nct.json` → no changes.

**Regression checks:**
- `/jwa/full-chain-sop/` and `/harper/guest-concierge-sop/` still show their "What to fix first" and their top bar. The `#fixes` reorder still applies there.
- `/nct/customer-intake-sop/` opened directly (no `?embed`) shows its top bar.
- `?role=` links work, inside the frame and on the page.
- Golden path in the SOP step modal (steps 1–3) still renders, with the golden-path session's "↻ Regenerate" label.

**Mobile (375):** the Overview frame fills the width with no double scrollbars on the page body. The Findings group-by and step filter wrap.

### After Wilfred deploys (live check, each phase)
- Open `https://admin.zhiyuantech.ai/?company=nct` → the phase's golden path steps 1–3, read only (no ticks needed).
- Open one old shared link: `?company=nct&task=rb-nct-b3-merge-wave-1`.
- Open one runbook anchor URL.
- For Phase 1 only, tick and untick one new step (proves the prod seed ran); the deploy's preflight printed no missing keys.
- Check DevTools → Application → the Service Worker `CACHE` name changed.

**Readiness: 8/10.** The contracts, ids, error strings, overrides and fixtures are settled and verified against HEAD, and every build check now has a negative test that isolates it. What holds back the remaining points: H1, H2a and H2 depend on the other session; D1 is open; and the ~57 authored steps need Wilfred's read of the waits and gates before Phase 1 merges.

---

## Appendix A: steps 16–27 checklist content (Phase 1)

The rules for every new step:
- `owner` is `wilfred` for probes and decisions, and `session` for setup, waves and clean-up.
- A wave step is ticked when **its PR is merged**, so the next wave waits on all steps of the previous one.
- A probes step links `#8-stop-gates-owner-only` and names the **bold** (gating) probes for that wave from §8. Only waves with bold probes get one.
- Detail text is 1–3 sentences in the runbook's words, with no new facts.
- Every heading id below was computed with the build's own slug rules this pass.
- A step whose anchor section has no code block carries `"snippets": false` (§4.3 #6); in this appendix that is the six decisions/disagreements rows, marked below.

### A.1 `rb-nct-steps-16-19` (runbook `/nct/steps-16-19-runbook/`, 11 wave headings)
| # | id | owner | link / prompts anchor | waitsFor |
|---|---|---|---|---|
| 1 | `rb-nct-1619-setup` | session | `#4-one-time-setup` | — |
| 2 | `rb-nct-1619-decisions` | wilfred | `#1-before-any-wave-starts-settle-these-decisions` (settled 2026-09-21; tick to confirm). **`"snippets": false`** (0 code blocks) | — |
| 3 | `rb-nct-1619-w12-probes` | wilfred | `#8-stop-gates-owner-only`: 16-P1, P2, P3 (before 16 Task 1.1); 16-P4, P6 (before Task 1.2) | — |
| 4 | `rb-nct-1619-w12-step16` | session | `#wave-12-wt-step16` | 1, 3, `rb-nct-f11-wave-11` |
| 5 | `rb-nct-1619-w12-step18` | session | `#wave-12-wt-step18` | 1, `rb-nct-f11-wave-11` |
| 6 | `rb-nct-1619-w12-step19` | session | `#wave-12-wt-step19` | 1, `rb-nct-f11-wave-11` |
| 7 | `rb-nct-1619-w13-probes` | wilfred | `#8-…`: 16-P5 (before 16 Task 2.1), 16-P7 (before 2.4), 19-P2, P3, P6 (before 19 Task 2.1) | — |
| 8 | `rb-nct-1619-w13-step16` | session | `#wave-13-wt-step16-rebase-first-see-6` | 4, 5, 6, 7 |
| 9 | `rb-nct-1619-w13-step18` | session | `#wave-13-wt-step18-rebase-first` | 4, 5, 6 |
| 10 | `rb-nct-1619-w13-step19` | session | `#wave-13-wt-step19-rebase-first` (detail: deploy only after 18 P1 is deployed, X23) | 4, 5, 6, 7 |
| 11 | `rb-nct-1619-w14-probes` | wilfred | `#8-…`: 18-P1, 18-P2 (before 18 Task 3.1) | — |
| 12 | `rb-nct-1619-w14-step16` | session | `#wave-14-wt-step16-rebase-first` | 8, 9, 10 |
| 13 | `rb-nct-1619-w14-step18` | session | `#wave-14-wt-step18-rebase-first` | 8, 9, 10, 11 |
| 14 | `rb-nct-1619-w14-step19` | session | `#wave-14-wt-step19-rebase-first` | 8, 9, 10 |
| 15 | `rb-nct-1619-w15-probes` | wilfred | `#8-…`: 17-P1, 17-P2 (before 17 Task 1.3) | — |
| 16 | `rb-nct-1619-w15-step17` | session | `#wave-15-wt-step17` (API before web) | 12, 13, 14, 15 |
| 17 | `rb-nct-1619-w16-probes` | wilfred | `#8-…`: 17-P4 (before 17 Task 2.1), 17-P6 (before 2.3) | — |
| 18 | `rb-nct-1619-w16-step17` | session | `#wave-16-wt-step17-rebase-first` | 16, 17 |
| 19 | `rb-nct-1619-clean-up` | session | `#11-clean-up` | 18 |
| 20 | `rb-nct-1619-disagreements` | wilfred | `#12-where-the-plans-and-the-crosscheck-disagree` (like F12). **`"snippets": false`** | — |

"#" is the per-task display number. `waitsFor` lists display numbers for readability; the seed stores the ids.

### A.2 `rb-nct-steps-20-26` (runbook `/nct/steps-20-26-runbook/`, 19 wave headings)
The same frame: setup (`#4-one-time-setup`), decisions (`#1-before-any-wave-starts-the-settled-decisions`), one probes step per wave with bold probes in §8 (verify at :711ff; e.g. Wave 17: 22-P1, P4, P5, 26-P3, 25-P1; the 24-P6 gate before the 24 P3 deploy; the X37 owner-run INSERT check), then:

| id | anchor | waitsFor (ids of) |
|---|---|---|
| `rb-nct-2026-w17-step20` / `-w17-step22` / `-w17-step23` / `-w17-step25` / `-w17-step26` | `#wave-17-wt-step20`, `#wave-17-wt-step22`, `#wave-17-wt-step23`, `#wave-17-wt-step25`, `#wave-17-wt-step26` | setup, `rb-nct-1619-w16-step17` (all of Wave 16 merged), the w17 probes where gating |
| `rb-nct-2026-w18-step20` / `-w18-step21` / `-w18-step23` / `-w18-step24` / `-w18-step26` | `#wave-18-wt-step20-rebase-first-see-6`, `#wave-18-wt-step21`, `#wave-18-wt-step23-rebase-first`, `#wave-18-wt-step24`, `#wave-18-wt-step26-rebase-first` | all five w17 steps |
| `rb-nct-2026-w19-step21` / `-w19-step22` / `-w19-step23` / `-w19-step24` / `-w19-step26` | `#wave-19-wt-step21-rebase-first`, `#wave-19-wt-step22-rebase-first`, `#wave-19-wt-step23-rebase-first`, `#wave-19-wt-step24-rebase-first`, `#wave-19-wt-step26-rebase-first` | all five w18 steps |
| `rb-nct-2026-w20-step21` / `-w20-step24` / `-w20-step25` | `#wave-20-wt-step21-rebase-first`, `#wave-20-wt-step24-rebase-first-merges-before-25-p2`, `#wave-20-wt-step25-rebase-first-merges-after-24-p3` | all five w19 steps. `w20-step25` also waits for `w20-step24` (merge order) |
| `rb-nct-2026-w21-step26` (optional) | `#wave-21-wt-step26-optional-rebase-first` | all three w20 steps |

Then `rb-nct-2026-clean-up` (`#11-clean-up`) and `rb-nct-2026-disagreements` (`#12-…`). That is about 28 steps. `rb-nct-2026-decisions` and `rb-nct-2026-disagreements` carry **`"snippets": false`** (their sections have 0 code blocks).

### A.3 `rb-nct-step-27` (runbook `/nct/step-27-runbook/`, 3 wave headings)
| id | owner | anchor | waitsFor |
|---|---|---|---|
| `rb-nct-27-setup` | session | `#4-one-time-setup` | — |
| `rb-nct-27-decisions` | wilfred | `#1-before-any-wave-starts-settle-these-decisions`. **`"snippets": false`**. Phase 3 adds `"assignee": "Wilfred"` | — |
| `rb-nct-27-w22-probes` | wilfred | `#8-stop-gates-owner-only`: 27-P9, P12, P13 (before 27 Task 3.1) | — |
| `rb-nct-27-w22-step27-p1` | session | `#wave-22-wt-step27-phase-1` | setup, `rb-nct-2026-w20-step21`, `-w20-step24`, `-w20-step25`, `rb-nct-b3-merge-wave-1` |
| `rb-nct-27-w22-step27-close-p3` | session | `#wave-22-wt-step27-close-phase-3` | the same as above, plus w22-probes |
| `rb-nct-27-w23-probes` | wilfred | `#8-…`: 27-P5, P6 (before 27 Task 2.1) | — |
| `rb-nct-27-w23-step27-p2` | session | `#wave-23-wt-step27-phase-2-rebase-first` | `rb-nct-27-w22-step27-p1`, w23-probes |
| `rb-nct-27-clean-up` | session | `#11-clean-up` | w22-close-p3, w23-step27-p2 |
| `rb-nct-27-disagreements` | wilfred | `#12-where-the-plans-and-the-crosscheck-disagree`. **`"snippets": false`** | — |

**Coverage proof after authoring:** 11 + 19 + 3 = **33** wave headings, each hit by exactly the step listed. Build check #5 enforces this.

---

## Review disposition (2026-09-23)

Three reviewers (correctness vs current code, operational/data safety, verifiability of each phase gate) raised 37 findings: 16 major, 21 minor. Where two lenses raised the same issue, each is listed and points at the same fix. Each claim was re-checked against the code before fixing (`build-runbook.mjs:63-123`, `index.html` tokens and render calls, `hosting/convex-app/.gitignore`, `git status`/`git diff`, `sw.js`, `build-seed.mjs:11-112`, `tracker/build-seed.mjs`, the template id rule at sop-template.html:2765, `sop.json`, `customer-intake-sop.html:2729`, `deploy-site.ps1:30-60, :358, :385`, and the section code-block counts). **Fixed 37 · Rejected 0 · Deferred 0.**

**Correctness lens**
1. major · correctness · `runbook-body.css` depends on page tokens and font variables the dashboard never defines, and `innerHTML` drops the `.rb-body` wrapper → **Fixed** (§4.4 Styling: self-contained file, font variables on `.rb-body, :host`, five aliases with the exact sop-theme.css values in both token blocks, `outerHTML`; Tasks 3.4, 3.8; §8 Dark and light; §10 Phase 3 computed-style check, light and dark, task body and sheet).
2. major · correctness · `renderAll` would re-inject the body, sheet and iframe on every tick → **Fixed** (§4.6 render contract with `DOC_NODES`, `SHEET`, `OVERVIEW_FRAMES`; §4.10; Tasks 3.8, 3.9, 4.4; §8 Performance; §10 Phase 3 render-contract regression and Phase 4 golden path step 3).
3. major · correctness · a fresh worktree has no Convex config or CLI → **Fixed** (§7.4 setup: `npm ci` in convex-app, copy `.env.local`, `small-snail-912` check; Task 1.7 pre-check; §7.3 names `impartial-sockeye-436` for Wilfred to confirm).
4. minor · correctness · journeys number steps within their stage → **Fixed** (J1 now 12, 9, 13 and notes f6 also waits for f3; J2 next ready "1 One-time setup", 20 steps, full waits list; §10 Phase 3 step 4 reads "Waits for 5, 8").
5. minor · correctness · pushState with no popstate handler → **Fixed** (§4.5 `routeFromUrl` + `popstate`; Task 3.5; §10 Phase 3 Back-button edge case).
6. minor · correctness · H1 omits `sop-layout.js`, `.gitignore`, and no owner for the launch.json preview entry → **Fixed** (§6.0 H1 lists every uncommitted file from `git status`; "Preview config" row gives the entry to the orchestrating session in the worktree's copy only; §7.5 `.gitignore` edit waits for H1).
7. minor · correctness · Phase 2 edits index.html:616 in the golden-path session's code → **Fixed** (new hand-off H2a before Phase 2; Phase 2 "Depends on"; §7.4).
8. minor · correctness · Task 4.1 ignores `flow-nct.json` → **Fixed** (§4.8 Content, Task 4.1, D32: regenerated from `sop.json` with a diff proof; Agent A owns it in §6.4).
9. minor · correctness · `setDone` cannot be awaited; incomplete caller lists; two wrong line refs → **Fixed** (§4.8 `setStateP`; §7.1 complete `selectTask`, `view:'runbook'` and `t.no`/`st.letter` lists; §0 corrects zips to :334-336, `RUNNER_EXTRA_ORIGINS` to server.mjs:34, and build-seed call to :358). Note: the initial `view: 'runbook'` state is at :526 in the current working copy, not :532; the plan says to re-grep.
10. minor · correctness · `target="_top"` added once misses links built later; theme `null` → **Fixed** (§4.9 delegated capture-phase click handler with a same-path exception; normalised theme; Task 4.3; §10 Phase 4 steps 4–5).

**Operational / data-safety lens**
11. major · ops-safety · the drift fix leaves out `convex deploy` and tells any agent to run prod commands → **Fixed** (§4.8 stale message gives the full order and says agents must not run `--prod`/`deploy`; §4.7; Task 4.6 SITE.md row; §7.3 Phase 4).
12. major · ops-safety · rewording a fix orphans its tick; id rule ignores `f.id` → **Fixed** (§4.8 `f.id` first; rename detection with a "pin the old id" message; D33 pins the 30 ids into `sop.json` once; Tasks 4.1, 4.2; §10 Phase 4 rename test).
13. major · ops-safety · audit `status`/`fixedAt`/`origin` vanish under `--no-ledger` → **Fixed** (§4.8 fields carried and shown as "Fixed (audit)" / "Rule" chips, closed in counts; Tasks 4.1, 4.5; J5 row 2; §10 Phase 4 audit-status test). Verified: no ledger item has these fields today, so nothing is lost now; the fix protects future audits.
14. major · ops-safety · the worktree cannot run the Convex commands → **Fixed** (same as 3; also says Wilfred's prod commands run from that configured worktree at the merge commit).
15. major · ops-safety · no merge and deploy protocol for the shared main checkout → **Fixed** (§6.0 H5: clean-status check with no stash, the deploy lock held by hand in one PowerShell invocation during the merge, clean status before prod deploy, tell the other session; H1 adds `sop-layout.js` and `.gitignore`; Risks).
16. minor · ops-safety · the old `sop.fixDone` key is never imported → **Fixed** (§4.8 reads both keys and takes the union; §10 Phase 4 import test uses both).
17. minor · ops-safety · import cannot detect failures, re-ticks reopened items, records under the viewer → **Fixed** (§4.8 `setStateP` chain with failure count; reopened ids skipped and listed; banner lists items and says ticks are recorded under the importer's name and today; key renamed to `….imported`; J5 row 4; D22; §10 import and import-failure tests).
18. minor · ops-safety · rollback too thin → **Fixed** (§8 Rollback: reverse phase order, DryRun after each revert, stop and ask on conflicts with the other session, restore snippet for `….imported`).
19. minor · ops-safety · "scratch copy" tests would edit tracked files → **Fixed** (§4.3 Test overrides; D35; `git diff --stat` check before each merge; §10 Preconditions).
20. minor · ops-safety · Phase 1 acceptance tests on 8791 (the other session's build) → **Fixed** (§5 intro: 8794 for every local check; Phase 1 acceptance; §10 App URL; Preview config row).
21. minor · ops-safety · an unbuilt `PAGES` path fails the worker install silently → **Fixed** (Task 2.3 DryRun `PAGES` check; §4.4; §10 Phase 2 activation and negative test). Note: "old bodies with no end" is overstated: stale-while-revalidate refreshes the cached copy on each open, so a body is at most one open behind. The silent install failure is real, and the check is added.
22. minor · ops-safety · the flow half still scrapes `customer-intake-sop.html`, which `/zyt-update` can overwrite → **Fixed** (same as 8; D32 records why).
23. minor · ops-safety · nothing checks prod rows before a site deploy → **Fixed** (Task 1.8 preflight against the public `findings:board`, D34; §7.3 prod seed at the exact merge commit, re-run if `runbook-nct.json` changes; §7.2; §10 Phase 1 preflight test).
24. minor · ops-safety · the claude.ai artifact copy's ticks and comments are ignored → **Fixed** (D12 records them as abandoned on purpose, with a one-time check by Wilfred before Phase 4 merges; Task 4.6 puts it in SITE.md).

**Verifiability lens**
25. major · verifiability · check #6 fails on Agent A's new steps and only Agent B could fix it, in A's file → **Fixed** (Task 1.3b: Agent A adds every `snippets:false`; Task 1.4: Agent B only reports; Appendix A marks the six rows; §6.1 owners and the smell test corrected). Verified: the six sections have 0 code blocks.
26. major · verifiability · negative tests cannot be run, and deleting a wave step trips the `waitsFor` check first → **Fixed** (§4.3 exact error strings and overrides; §10 Phase 1 tests each violate one rule: delete the step and its three `waitsFor` references; #6 tested on `rb-nct-f12-unowned-gaps`).
27. major · verifiability · two servers, and nobody owns the launch.json change → **Fixed** (same as 20 and 6; the runner's second origin is part of H1, so no second runner starts on :4317).
28. major · verifiability · the worktree setup blocks the Phase 1 gate → **Fixed** (same as 3; §10 Preconditions require `{inserted: N}` with Agent A's exact count).
29. major · verifiability · the fetch-failure case would be served from the service-worker cache → **Fixed** (§10 Phase 3: "Bypass for network" before blocking; a separate missing-heading fallback case with the exact note).
30. major · verifiability · status and chip expectations depend on whatever ticks are on dev → **Fixed** (Task 3.12 `expected-status.mjs`, written from §4.6 and not copied from the page; §10 Phase 3 fixture T0 and what-if row W; steps 1, 2, 7 and 8 compare against them).
31. major · verifiability · checks #2, #3, #4, #7 have no negative tests → **Fixed** (§10 Phase 3 build-rule edge cases with exact strings, including the `--public` zip case).
32. major · verifiability · the assignee half of My tasks is untestable → **Fixed** (Task 3.1 sets `assignee: "Wilfred"` on `rb-nct-27-decisions`; §10 Phase 3 step 9 tests case and space folding, and the switch to another name).
33. minor · verifiability · `flow-nct.json` has no owner or gate → **Fixed** (§6.4 Agent A owns it; Task 4.1 diff proof; §10 Phase 4 regeneration-is-stable check).
34. minor · verifiability · journeys and gate disagree on numbers and labels → **Fixed** (same as 4).
35. minor · verifiability · Phase 2 delivers no reachable journey → **Fixed** by saying so: Phase 2 is declared infrastructure for J3, reachable by URL only, with the click path in Phase 3. It stays a separate phase because it is independently deployable and touches different files.
36. minor · verifiability · the top-bar fix has no before-reproduction → **Fixed** (Task 1.5 reproduces first; §10 Phase 1 "Before" and "After" screenshots at the same position plus a `backdrop-filter` grep).
37. minor · verifiability · the snippet-count script has no owner, path or baseline → **Fixed** (Task 1.9 `verify/snippet-counts.mjs` owned by Agent B; baseline built in the main tree at the H1 commit into the scratchpad; exact pass condition).

### Closing Self-Review Gate (planpro), re-run after the revision
- [x] Every §4 model names the journey step it serves (§4.1 now tagged "all journeys"; §4.3's checks trace to §10 negative tests).
- [x] Every §5 task lists real paths, verified this pass, or tagged [NEW] (`verify/*.mjs`, `runbook-body.css`, `sop-findings.mjs`). `tracker/seed/flow-nct.json` and `customer-intake-sop/sop.json` exist.
- [x] Every §5 task has exactly one owner from §6 (new 1.3b, 1.8, 1.9, 3.12 included).
- [x] No new dependency (Node built-ins, `marked` and the pinned convex 1.45.0 only).
- [x] Every §9 decision has three approaches, one recommendation, a status and blocking marked (D32–D35 added).
- [x] Every §1 assumption and §4 key decision points at a §9 id (D32–D35 added to §1). The render contract, `setStateP` and the preflight's HTTP call are implementations of findings, not choices with live alternatives, except the preflight, which is D34.
- [x] No Input Gate was held; nothing to carry over.
- [x] §7.1's caller list re-grepped this pass (`selectTask`, `view === 'runbook'`, `t.no`, `.letter`).
- [x] §10's URL and port: 8794 over the worktree's `public/` (set up in §7.4); 8791 is named as the main tree's preview and not used for acceptance. Failed before the revision (Phase 1 acceptance said 8791) and is fixed.
- [x] Migration numbers: none exist (Convex, no journal); the seed's `inserted` count is the check.
- [x] Tier in META.md (Standard, 4 phases) matches; no META change needed.
- [x] §1 Assumptions lists every judgement call with its §9 id.
- [x] Context file (the mockup) is named in the inputs; its requirements are planned, and conflicts with the code (the zip names, the missing plan pages, the iframe chrome) are resolved in §0/§9.
