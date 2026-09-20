---
title: Step 12: Assign job number becomes a one-time repair that also updates the order's lines
goal: Assign number fills a blank job number once, even with two presses at once, re-stamps all unbilled blank or quotation-number lines, and SOP step 12 becomes a check.
created_at: 2026-09-17 19:46
status: active
tier: standard
phases: 3
stack: Drizzle ORM on Postgres (PGlite in tests), oRPC routers (orgProcedure/requireNode/applyScope) with a TanStack Router web app, org-scoped role and permission-node auth
linked_pr: 
---

# Step 12: Assign job number becomes a one-time repair that also updates the order's lines

Phase 1 adds a FOR UPDATE row lock and a widened NULL/quotation-number re-stamp to collectiveOrder.assignNumber, with PGlite tests and a real-Postgres concurrency proof. Phase 2 rewrites SOP step 12 and the tracker text as a check, and optional Phase 3 normalises the Job Number in collectiveOrder.update.

Canonical plan: `plans/step-12-job-number.md` (runbooks and session prompts use that folder). `plan/plan.md` here is a copy taken 2026-09-17 for /audit and /done; re-copy after editing the canonical file. Cross-plan settlements: `plans/steps-12-15-crosscheck.md`.
