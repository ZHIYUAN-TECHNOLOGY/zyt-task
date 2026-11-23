# Handoff: golden paths and the hosted SOP pages

Updated 2026-09-24. This covers the golden-path recordings and the hosted SOP page layout on
admin.zhiyuantech.ai. The site's general contract is `hosting/SITE.md`, so read that first.

## Where things stand

- **Live:** version `e2340e9c` of `zyt-admin`, built from ZYT-Task main `eae18f6`, which is pushed and level with origin.
- **Sign-in:** the site is behind Cloudflare Access (see SITE.md). Check it live in your own signed-in Chrome.
- **Golden paths:** 11 journeys, 24 clips, all passing, all published under `/golden-paths/`.

| SOP | Steps → journey | Repo / branch |
|---|---|---|
| NCT | 1–3 intake · 4–7 quote-build · 8–10 quote-decide · 11–15 order-open · 16–19 lading-run · 20–23 bill-build · 24–27 invoice-close | `C:/Project/NCT/nct-layout`, `feat/intake-golden-path-e2e` (pushed) |
| JWA | 1–4 jwa-setup · 5–8 jwa-raise · 9–10 jwa-buy · 11–14 jwa-receive | `C:/Project/JWASystemv2/jwa-golden`, `feat/jwa-golden-paths` (pushed, `5f49155`; recorded on JWA main `3ad5b1a`) |

## Pieces and where they live (all in ZYT-Task unless noted)

- `hosting/hub/sop-layout.js` / `.css` build the hosted SOP page for NCT, JWA and Harper:
  - role tabs and the App URL in one bar;
  - a vertical step list on the left and the page's step guide on the right, shown on the page instead of a modal;
  - Watch out, Chain break, What to fix and Prompt removed from the guide;
  - `?embed=1` for the dashboard's Overview iframe;
  - `storage` theme sync.
  The chart and the long-form document are hidden from the `<head>` CSS, so the page's own `#step-N` scroll can't move a parent frame.
- `hosting/hub/golden-path.js` builds the panel:
  - `BY_STEP` is keyed by SOP (`nct`, `jwa`), taken from the page's first path segment;
  - `ROLE_LABELS` covers both repos' roles.
- `hosting/runner/server.mjs` is the local runner on 127.0.0.1:4317.
  - `nctJob` runs `npx` from nct-layout.
  - `jwaJob` runs `bunx` from `jwa-golden/apps/web` with the web server on **:3700**, reading clips from `_e2e/golden-out/<project>/`.
  - JWA clips arrive in story order (`meta.json` `storyOrder: true`); NCT's are reversed.
- `hosting/runner/publish-recordings.mjs` copies passed runs from `hosting/runner/runs/` into the tracked `hosting/recordings/`.
- In the JWA repo, all under `_e2e/`:
  - `golden.config.ts`, which includes the localhost guard and its own sign-in on :3700 into `.auth-golden/`;
  - `reporters/step-events.ts`;
  - `web/golden/`: the four specs, plus `_golden.ts` (clips and meta.json), `_world.ts` (preconditions and cleanup), `_backend.ts` (`convex run --identity`) and `_nav.ts`.

## How to re-record and ship a journey

1. Check that no other JWA or NCT Playwright run is live. JWA shares the dev Convex `ceaseless-spaniel-882`, and other suites' `sweepE2eDeepResidue` deletes E2E-DEEP data mid-run:
   `Get-CimInstance Win32_Process | ? { $_.CommandLine -match 'playwright test' }`
2. Start the runner as a **background Bash process**, not through the preview pane, which the desktop app can stop mid-run:
   `RUNNER_EXTRA_ORIGINS=http://localhost:8791 node hosting/runner/server.mjs`
3. Start a job:
   `curl -X POST -H "Origin: https://admin.zhiyuantech.ai" -H "Content-Type: application/json" -d '{"job":"jwa-setup-steps-1-4"}' http://127.0.0.1:4317/run`
   Poll `/health` until `run.status` is no longer `running`; `/last/<job>` holds the saved result. The Regenerate button on the site does the same job.
4. Run `node hosting/runner/publish-recordings.mjs`, then `git checkout -- hosting/recordings/nct-*.json` if you didn't re-record NCT. Publishing bumps every JSON's `publishedAt`.
5. Build with `hosting/deploy-site.ps1 -DryRun` and check through `hub-preview` (:8791), with the runner stopped so the page uses the published files. Then commit `hosting/recordings/`, deploy with `hosting/deploy-site.ps1`, and check live in Chrome with the tab in front (Chrome won't load video in a hidden tab).
6. Tree-kill the runner and the :3700 server, and confirm both ports are free.

## Open items, each waiting on something

| Item | Waiting on | Then |
|---|---|---|
| JWA step 11 (Mark Delivered) uses **Administrator**; the Warehouse is refused (`srfPurchasing.ts:605`) | JWA Worker's op-018 receiving fix, a narrow warehouse "mark delivered" action | Switch `receive.golden-path.spec.ts` step 11 to `warehouse`, re-record, ship |
| JWA step 14 (Direct Receipt) uses the **Inventory Manager**; the page crashes for Warehouse (`stock/receive/index.tsx:66` → `stockMovements.ts:308`) | Same op-018 work: a cost-free "today's receipts" query | Optionally switch to `warehouse`, re-record, ship |
| E2E-DEEP leftovers on JWA dev: about 29 POs and 29 deactivated projects, orphaned BQ rows, 118 stock movements and 28 stock rows | JWA PR #33 (`e2eCleanup:purgeE2eDeepProject`) merged and pushed to dev | Purge per project, only when no other JWA run is live. Stock rows stay (Wilfred: leave them) |
| JWA SOP text for steps 1–2 still describes the old Create Project flow | JWA Main's SOP PR, after the fork's salvage merge | Nothing here; the recordings already show the new form |

JWA Main tracks all three JWA bugs; they are confirmed. Bug 3, orphaned BQ rows on `deleteProject`, is fixed in #33, where a project with a budget becomes deactivate-only.

## Rules that bit us

- Never run `convex dev` or deploy from any JWA checkout; dev is shared. `convex run` is fine.
- Never use :3300 (another worktree's server) or touch `jwa-system` / `jwa-sig` checkouts. The JWA SOP page now builds from the `C:/Project/JWASystemv2/jwa-sop` worktree (main).
- `e2eCleanup:purgeE2eDeepSrfs` removes every session's submitted E2E-DEEP SRFs. Run it only when no other JWA Playwright run is live; the golden global teardown already checks.
- Deploys publish whatever is on disk and the deploy script holds a lock. Tell the other ZYT session before deploying if one is active; find it with ListAgents, since addresses go stale.
- NCT golden paths never press Send and never Upload/Reprocess/OCR. Recordings show only throwaway E2E orgs and rows.
- Don't `git stash` or `git reset`; tree-kill processes and confirm the port is gone.

## Session log

`zsession/session-2026-09-24-0319.md` (untracked) has the full list of what was done this session.
