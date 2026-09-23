---
title: Runbooks as tasks
goal: Each NCT runbook becomes one task (checklist, full text, attachments) under a left menu of Overview · Tasks · Findings, with one findings list ticked in Convex
created_at: 2026-09-23 13:52
status: active
tier: standard
phases: 4
stack: Static site (vanilla JS index.html, Node build scripts with marked, deploy-site.ps1), Convex 1.45 findings/events (no schema change), Cloudflare assets Worker + PWA service worker; no auth (viewer name in localStorage)
linked_pr:
---

# Runbooks as tasks

This is for Wilfred, the implementers running NCT waves, and colleagues reading plans on admin.zhiyuantech.ai. The work ships in four independently deployable phases:

1. Checklists for steps 16–27, a build rule that every wave heading has a step, and opaque top bars.
2. Pages for plans 01–10 and the steps 4–10 crosscheck.
3. A Tasks list and a Linear-style task view with a plan slide-over. The runbook pages stay built but are hidden from the list.
4. Overview (the SOP embedded) and a single Findings list. The NCT SOP is built `--no-ledger`, and a browser's old ticks can be imported once.
