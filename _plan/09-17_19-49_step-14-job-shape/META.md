---
title: Step 14: complete orders before review, no edits under review, status from a fixed milestone list
goal: Refuse review submission of orders missing basic shipment details, show what is missing on the form, and make order status a per-trade milestone list.
created_at: 2026-09-17 19:49
status: active
tier: standard
phases: 3
stack: Drizzle ORM (Postgres, PGlite tests) · oRPC routers (orgProcedure/requireNode/applyScope) with TanStack Router web · org-scoped permission nodes with field masking plus audit engine
linked_pr: 
---

# Step 14: complete orders before review, no edits under review, status from a fixed milestone list

A readiness check on the stored order at submit for review (shared pure rule module, seed and e2e fixture fixes), a Before review panel on the order form, and order status as a code-owned milestone list per trade, checked in three writers and used by nine ledger filters. The under-review freeze and row lock belong to step 15 Phase 1 (D5-C, crosscheck X6), and no migration is needed under the recommended options.

Canonical plan: `plans/step-14-job-shape.md` (runbooks and session prompts use that folder). `plan/plan.md` here is a copy taken 2026-09-17 for /audit and /done; re-copy after editing the canonical file. Cross-plan settlements: `plans/steps-12-15-crosscheck.md`.
