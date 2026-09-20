---
title: ZYT Delivery v0 — delivery board as a real app (NCT as the first client)
goal: ZYT runs each client's delivery on one live board; client users sign in and see it with team-only fields removed on the server; Claude sessions work findings through a scoped API
created_at: 2026-09-14 21:11
status: active
tier: standard
phases: 5
stack: TanStack Start on Cloudflare Workers, Convex (no ORM), Better Auth via Convex (Google, Microsoft; magic link deferred; own org tables), Cloudflare R2
linked_pr:
---

# ZYT Delivery v0

Builds the unified delivery board from `tracker/SCHEMA.md` as an agency-wide app, loaded with one sample client (NCT): Google and Microsoft sign-in, `/p/$projectKey` boards, state changes with notes, reports drafted on demand, R2 evidence, and a project-scoped HTTP API for Claude sessions. No email in v0 (D4 open, not blocking). Revised 2026-09-15.
