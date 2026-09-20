# Waiting on Wilfred

Open items from the admin.zhiyuantech.ai / step 11 session, 2026-09-16. Tick them off or delete this file when done.

## Before anyone deploys again

- [ ] **Sync with the "ZYT Skill" session before its next deploy.** Its message address stopped working, so it doesn't know that:
  - Deploy `e8d30d52-98ad-41f8-8ed5-532a89a3c543` added `/nct/step-11-plan/`.
  - The files involved are `hosting/deploy-site.ps1`, `hosting/hub/build-runbook.mjs`, `hosting/hub/projects.json`, `hosting/pwa/sw.js` and `hosting/SITE.md`.

  It must deploy from the files on disk that include these changes. A deploy from an older copy would remove the page.
- [ ] **Click through the pages that session put live** (they went out with deploy `1e0c0d7c-9919-47d4-8fe3-d7144f6c9b7e`; nobody has checked them in a browser):
  - https://admin.zhiyuantech.ai/nct/customer-intake-sop/ — now built from `customer-intake-sop/sop.json`. Check "Show my flow", the `?role=<id>` links, the full-screen chain view with the role rail, and the fix list.
  - https://admin.zhiyuantech.ai/jwa/full-chain-sop/ — check the "verified against code" line and the role view.

## Step 11 — Convert won quote

Plan: `plans/step-11-convert-won-quote.md` (live at https://admin.zhiyuantech.ai/nct/step-11-plan/). All decisions are taken: D1 option B, and option A for D2–D9.

- [ ] **Run the five read-only production queries, P1–P5, in the plan's §7.** They measure the existing damage:
  - P1: orders made from Lost quotations. Hand this list to sales/operations under D9: report only, each order checked by hand.
  - P2: conversions made before any decision was recorded.
  - P4: orders whose lines carry two different numbers.
  - P5: fee lines with a minimum charge.
- [ ] **Start Phase 1 (X5) in its own worktree** when ready: Wave 1, merged after step 05. Implementation needs your go-ahead.
- [ ] **Prove the conversion lock on the dev database.** Two simultaneous Convert presses must create one order. The unit tests (PGlite) can't prove this.
- [ ] **Add one line to step 10's Wave 4 prompt:** when rebasing, add the "use Correct decision" hint to the X5 refusal message (`correctionPath: true`). This goes in the prompt you write, not in step 10's plan file.
- [ ] **Tell the step 12 and step 14 planners** that the job-number allocator moves to `modules/collective-order/insert-order.ts` (D5).
- [ ] **Fix the tracker seed typo:** `tracker/seed/flow-nct.json:155` reads `/order//edit` (missing order id). Also, the step 10 card's "Lost → the chain ends here" (`:143`) only becomes true once Phase 1 merges.

## Step 02 — duplicate company names

- [ ] **Run the duplicate count against production yourself.** Migration `0067_company_name_ci_unique` fails partway through the deploy unless `company.nameCollisionCount = 0`. The dev branch had 0 on 2026-09-14; production hasn't been checked.
  - Probe (read-only): `nct-layout/e2e/out/_walk/probe-step2.ts`.
  - Production needs `I_KNOW_THIS_IS_PRODUCTION=1` (the owner's override in `apps/server/dev-db-guard.ts`).
  - If the count isn't 0, clear the duplicates first (Task 3.0).

## Tools and access

- [ ] **Authorise the Cloudflare and Neon MCP servers** in your claude.ai connector settings, or with `/mcp` in an interactive `claude` session. They're unavailable to Claude until then.

## Known gaps (no deadline)

- [ ] **NCT's App URL box** defaults to `http://localhost:3101/`, so its screen links point at the visitor's own machine. Set the real NCT app address once there is one.
- [ ] **JWA has no to-do tasks** in `tracker/seed` and no Convex seed mutation, so its dashboard to-do is empty.
