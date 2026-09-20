---
title: Step 15: order approval covers what the reviewer read, only the queue grants it, and no B/L without approval
goal: Freeze orders under review, make the audit engine the only approver (not the submitter), and gate B/L creation and linking on order approval.
created_at: 2026-09-17 19:53
status: active
tier: standard
phases: 3
stack: Drizzle ORM (Postgres/Neon, PGlite tests), oRPC routers + TanStack Router file routes, org-scoped permission-node auth (orgProcedure/requireNode) with the audit-review engine
linked_pr: 
---

# Step 15: order approval covers what the reviewer read, only the queue grants it, and no B/L without approval

Phase 1 adds the under-review freeze and row locks on order writers, plus an engine-driven notice on the order form. Phase 2 deletes the legacy collectiveOrder.review/reviewBatch verbs and turns on separation of duties. Phase 3 adds a create_lading gate (plus expense_entry in costLines.create) and seeds four order gates for new orgs. There is no migration under the recommended options.

Canonical plan: `plans/step-15-order-approval-integrity.md` (runbooks and session prompts use that folder). `plan/plan.md` here is a copy taken 2026-09-17 for /audit and /done; re-copy after editing the canonical file. Cross-plan settlements: `plans/steps-12-15-crosscheck.md`.
