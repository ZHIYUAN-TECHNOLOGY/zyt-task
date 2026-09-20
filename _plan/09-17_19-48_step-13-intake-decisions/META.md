---
title: Step 13: To Receive opens the order, and a rejection is undone only by a recorded reopen
goal: From To Receive, one click opens the order's record page, and receive/reject become legal only from unaccepted, with a separate reasoned reopen that has its own permission.
created_at: 2026-09-17 19:48
status: active
tier: standard
phases: 2
stack: Drizzle ORM (Postgres/Neon, PGlite tests) + oRPC routers (orgProcedure/requireNode/applyScope) + TanStack Router web; auth via org permission nodes (dotted-ancestor resolution)
linked_pr: 
---

# Step 13: To Receive opens the order, and a rejection is undone only by a recorded reopen

Phase 1 (web only) adds Open full page from the To Receive pane and row menu to the trade record page. Phase 2 makes receive refuse rejected orders, adds a reasoned collectiveOrder.reopen procedure and node, adds FOR UPDATE row locks, plain-language refusals, intake stamps in the pane, refusal-aware advance and permission-aware buttons; no migration under D3-A.

Canonical plan: `plans/step-13-intake-decisions.md` (runbooks and session prompts use that folder). `plan/plan.md` here is a copy taken 2026-09-17 for /audit and /done; re-copy after editing the canonical file. Cross-plan settlements: `plans/steps-12-15-crosscheck.md`.
