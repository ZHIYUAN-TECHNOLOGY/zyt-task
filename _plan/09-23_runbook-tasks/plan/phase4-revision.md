# Phase 4, revised 2026-09-23 (supersedes plan.md §5 Phase 4, §4.8 SOP-page parts, §4.9, §10 Phase 4 Overview items)

## Why the revision
After plan.md was written, the golden-path session rebuilt the NCT SOP page (commits 81b84f5 … e0fc8b0, all in
`hosting/hub/sop-layout.js/.css`). The page is now **one window-tall section**: role tabs beside the App URL, a vertical
27-step flow down the left, and the step guide inline on the right. The masthead, index, How they arrive, **What to fix
first (`#fixes`)**, the chain chart, the edge tab + modal (`.zyt-chain-tab`) and The document are gone from the hosted page
(removed in the DOM by sop-layout.js:79; still present in the built data). `#step-N` already opens a step (sop-layout.js:272).
The header work after Phase 3 also changed Overview: it is now a view of **page cards** (Wilfred's choice, kept).

Broken assumptions in the old Phase 4: 4.3's "open #doc-body via #doc-toggle", 4.4's "Open the whole chain → clicks
`.zyt-chain-tab`", the acceptance line "Overview shows the chain and the expanded document", and "The NCT SOP page has no
`#fixes`" (already true visually). Everything about the findings data (old 4.1, 4.2, 4.5) still holds.

## Journeys (unchanged intent)
- **J4 Overview:** Projects → NCT → Overview shows the SOP section embedded (no second top bar), with role tabs working
  inside it, plus the company's other pages as cards. A "Where in the SOP" link lands on that step. Theme toggle restyles it.
- **J5 Findings:** Findings → Group by SOP step → filter step 8 → open a finding → tick it. Rank grouping lists
  `nct-identity` first. Old SOP-page browser ticks can be imported once.

## Tasks
| Task | What | Files | Owner |
|---|---|---|---|
| 4.1 | As plan.md 4.1: `tracker/sop-findings.mjs` [NEW] (`findingsFromSop`, `flowFromSop`, the page's fold and id rules); `tracker/build-seed.mjs` reads only `customer-intake-sop/sop.json`, gains `--sop`/`--out-dir`; regenerate `tasks-nct.json` + `flow-nct.json` proving the same 48 ids in the same order (diffs saved to `_plan/09-23_runbook-tasks/verify/`); pin the fix ids into `sop.json` (additive `"id"` fields only); regeneration byte-identical; `status/fixedAt/origin/ruleId` pass-through test on a scratch copy | `tracker/sop-findings.mjs`, `tracker/build-seed.mjs`, `tracker/seed/tasks-nct.json`, `tracker/seed/flow-nct.json`, `customer-intake-sop/sop.json` (ids only), `tracker/SCHEMA.md` | Agent A |
| 4.2 | As plan.md 4.2: drift check in `hosting/hub/build-seed.mjs` with the verbatim rename/stale messages and `--sop`; `projects.json` NCT SOP `source` → `customer-intake-sop/sop.json`. **`--no-ledger` for NCT** at the build-page call (deploy-site.ps1 ~:109): the hosted page already hides `#fixes`; this also drops the ledger data and its localStorage tick writes. Only after the golden-path session confirms sop-layout.js does not read the ledger | `hosting/hub/build-seed.mjs`, `hosting/hub/projects.json`, `hosting/deploy-site.ps1` (NCT build-page line) | Agent A |
| 4.3 | **Embed mode — by the golden-path session (owner of sop-layout.js/.css)**, to this contract: `?embed=1` adds `html.zyt-embed`; `.zyt-top` hidden and the section fills `100vh` with no top offset; `hashchange` to `#step-N` opens that step without a reload; a click on an `a[href^="/"]` whose pathname differs leaves the frame (`window.top.location`), same-path links (`?role=`) stay; a `storage` listener on `zyt.theme` re-applies the theme on every SOP page. JWA/Harper pages keep working | `hosting/hub/sop-layout.js`, `hosting/hub/sop-layout.css` | golden-path session |
| 4.4 | Overview view: when the company has an SOP, a header bar (SOP title, "Open full page ↗") and an `<iframe title="SOP: <title>" src="<sop>?embed=1[#step-N]">` at `height: calc(100vh - var(--top) - 9rem); min-height: 32rem`; cached per company in `OVERVIEW_FRAMES`, re-parented, never recreated by `renderAll`; `?view=overview&step=N` sets the frame's `location.hash` (no reload). Below it, the company's **other** visible pages as the existing cards (a company with no SOP keeps cards only). The frame's `load` also stamps the dashboard's theme; the theme toggle writes `zyt.theme` (storage event reaches the frame) | `hosting/hub/index.html` | Agent D |
| 4.5 | As plan.md 4.5: Findings "Group by" (Workstream default / Rank / SOP step), Step filter with open counts, `?step=`, the `isNew` field, "Fixed (audit)" and "Rule" chips (audit-fixed = closed), "Where in the SOP" → `?view=overview&step=N`, the old-ticks import banner (both localStorage keys, reopened ids skipped, `setStateP`, keys renamed to `….imported`), empty state for companies with no findings → Overview | `hosting/hub/index.html` | Agent D |
| 4.6 | SITE.md as plan.md 4.6, rewritten for the new page: NCT SOP built with `--no-ledger`, "What to fix first" lives in the dashboard Findings, hooks list gains `.zyt-embed`/`?embed=1`, the full defect order (sop.json → `node tracker/build-seed.mjs` → workstream in `client-tasks-nct.json` → dev seed → **Wilfred** prod seed → site deploy), the restore-`….imported` console snippet | `hosting/SITE.md` | Agent A |

## Hand-offs
- **H6 (before 4.2's `--no-ledger` and before 4.4 verification):** golden-path session implements 4.3 and confirms
  sop-layout.js does not need the ledger data. It commits on main; the worktree branch merges main before the DryRun.
- Convex: 4.1 must produce **0 id changes** (48 ids). If it does not, stop: new ids need the full seed order and Wilfred.

## Verification
- `node tracker/build-seed.mjs --out-dir <scratch>` → the 48 ids, same order; diffs of both files reviewed; after pinning, byte-identical.
- Drift negative tests on scratch `sop.json` copies via `--sop`: a reworded fix without a pinned id → the rename message; an added fix → the stale message.
- DryRun (dev) ends with `seed rows: nct all 147 keys present`.
- Browser (8794): Overview for NCT shows the embedded section with no second top bar; a role tab works inside; theme toggle restyles the frame; `?view=overview&step=8` opens step 8; a Convex tick elsewhere does not reload the frame (same frame node, no new document load); Harper Overview shows its SOP frame plus the "What the bot answers" card. Findings: Group by Rank → `nct-identity` first; Group by SOP step + Step 8 filter; tick/untick a finding on dev; import banner with seeded `sop.customer-intake-sop.fixDone` and `sop.fixDone` keys (one id reopened in events → skipped), keys renamed to `.imported`. 375 px: no horizontal scroll. JWA and Harper SOP pages unchanged.
