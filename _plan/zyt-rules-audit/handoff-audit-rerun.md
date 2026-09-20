# Handoff — rerun the `/zyt-audit` end-to-end check (J3) on the JWA test copy

**Goal:** rerun the Phase 5 audit (J3) to confirm the one open FINDING: the report's "Runtime proof offered" section must now list paste-ready command lines (`/e2e-deep --deep <route>` per step and `/audit-prove-a`). Everything else in J3 already passed (23/24). Cost: ~21 agents, ~1.35M–2.93M tokens (last run: 2.68M).

**Do not:** deploy or publish anything; run the app, Convex, seeds, migrations or git; write under `C:\Project\` (except this `_plan` folder); touch the real page `jwa-system/jwa-full-chain` or the NCT page. Run every zyt script with `ZYT_ALLOW_PAGES=jwa-copy/*`.

## Paths

| Name | Path |
|---|---|
| W | `C:\Users\user\.claude\skills\zyt-update-workspace` |
| E | `W\tests\e2e` |
| RUN | `E\run\rules-audit-2026-09-15` |
| COPY | `E\jwa-system` (test copy of the JWA repo) |
| CSOP | `COPY\sop\jwa-full-chain` |
| AUDIT | `C:\Users\user\.claude\skills\zyt-audit` |
| UPDATE | `C:\Users\user\.claude\skills\zyt-update` |
| Plan | `C:\Project\ZYT-Task\_plan\zyt-rules-audit\plan\plan.md` (§6 steps 3–4 = J3 spec) |

## State you start from

The copy is at its clean baseline (migrated, 8 rules, no plants). The previous run's inputs are saved:
- `RUN\j3\pre-apply.sop.json` — page data right before the audit (after the J2 update: R10 rule-violation item `rv-r10` open, `receive-role-mismatch` partly-fixed).
- `RUN\final\convex\srfPurchasing.ts`, `srfApprovals.ts` — code with all three plants (P1 R10 check removed, P2 bulk self-approval check removed, P3 inventory_manager added to the delivery guard).
- `RUN\final\sop-jwa-full-chain\.zyt\manifest.json` — the manifest at that point.
- `RUN\plants.json` — exact plant strings. `RUN\j3\run1\` — the previous audit changeset and report for comparison.

## Steps

1. **Recreate the pre-audit state**
   ```bash
   cp RUN/final/convex/srfPurchasing.ts RUN/final/convex/srfApprovals.ts COPY/packages/backend/convex/
   cp RUN/j3/pre-apply.sop.json CSOP/sop.json
   cp RUN/final/sop-jwa-full-chain/.zyt/manifest.json CSOP/.zyt/manifest.json
   ```
   Check: `srfPurchasing.ts` has no `approvedComparisonPrice == null` and contains `"inventory_manager"` in the guard near line 494; `srfApprovals.ts` `decideLineItemsBulk` has no `assertNotSelfApproval` line. `CSOP/sop.json` has 11 ledger items with `rv-r10` open.
2. **Guard baseline:** `node E/project-guard.mjs snapshot --out RUN/project-guard.json --force`
3. **GATE 0:** `node AUDIT/scripts/audit-plan.mjs --page jwa-copy/jwa-full-chain --today <today> > RUN/j3/run2/preflight.txt`, then `--json --out RUN/j3/run2/audit-args.json`. Expect 21 agents, fits budget 25.
4. **Run the workflow** from the main session (subagents may not have the Workflow tool): `Workflow({ scriptPath: "AUDIT/workflows/zyt-audit.js", args: <contents of audit-args.json> })`. Note the start time and the agent count from the completion notice.
5. **Save artifacts:** copy `CSOP/.zyt/audit-<today>.json`, `.md` (and `.verified.json`) to `RUN/j3/run2/`. Write `RUN/j3/run2/run-log.txt` with a `GATE 0 preflight` line (preflight.txt mtime) before the first `agent: extract (perms)` line (earliest `agent-*.meta.json` in the workflow transcript dir), plus `agent count: N`. Save `CSOP/sop.json` as `RUN/j3/run2/pre-apply.sop.json`.
6. **Apply (test policy):** accept `auto` + every **confirm**-tier `rule-violation` and `ledger-add` id + the `receive-role-mismatch` transition to fixed (decision tier). Never accept needs-human ids, never `all`.
   ```powershell
   $env:ZYT_ALLOW_PAGES='jwa-copy/*'; powershell -ExecutionPolicy Bypass -File AUDIT\scripts\audit-apply.ps1 -Page jwa-copy/jwa-full-chain -Accept "auto,<ids>" -Date <today>
   node UPDATE/scripts/registry.mjs record --id jwa-copy/jwa-full-chain --audited-at <ISO now>
   ```
7. **Assert:**
   ```bash
   node E/assert-audit.mjs --changeset RUN/j3/run2/audit-<today>.json --report RUN/j3/run2/audit-<today>.md --run-log RUN/j3/run2/run-log.txt --preflight RUN/j3/run2/preflight.txt --today <today> --pre RUN/j3/run2/pre-apply.sop.json --max-agents 25
   node E/safety-scan.mjs --transcript <workflow transcript dir>/agent-*.jsonl --nct-sha "$(cat RUN/nct-sha.txt)"
   ```
   Pass = all SAFETY and FINDING checks, in particular `F.report.runtime` (the fixed item), `P2 found` (R7 at `srfApprovals.ts` ~1072 or an unenforced-approval ledger-add), `P3 found` (receive-role-mismatch → fixed with `inventory_manager` quote and `refute: holds`), and no other item moved to fixed. Note `--today` must match the date the audit ran.
8. **Reset:** `node E/restore-copy.mjs`, then rebuild the baseline exactly as plan Phase 1 lead steps 1–3 (migrate-tracker `--dry` → `--expect-sha`; `rules.mjs apply` with `E/rules-ticked.json` and `R3,R5,R6,R7,R10,R11,R12,R13`; `snapshot.mjs`), rewrite `RUN/baseline.json` (`sopSha`, `manifestSha`, `historyLines`) and `RUN/baseline.sop.json`. Then run the suites: `W/tests/c1/run-all.mjs`, `W/tests/c2/run-all.mjs`, `W/tests/d/run-stub.mjs`, `W/tests/d/run-audit-stub.mjs`, and `C:/Users/user/.claude/skills/zyt-setup-workspace/fixtures/regress.mjs` + `regress-v2.mjs`.

## Known gotchas

- **Run the suites only after step 8.** Some tests seed from the live copy; with the plants in place they fail for that reason alone (c1 −8, c2 −11, regress-v2 case 5).
- A dev server in `C:\Project\JWASystemv2` rewrites `.alchemy`; the guard ignores it. Another session edits `C:\Project\ZYT-Task\hosting\` — guard diffs there aren't yours; check `~/.claude/zyt/touch-log.jsonl` before re-baselining.
- `restore-copy.mjs` also reverts the `jwa-copy` registry entry and moves extra `.zyt` files into `RUN\restore-extras-*`.
- If `F.report.runtime` still fails, the fix is in `AUDIT/workflows/zyt-audit.js` (runtime proof text, ~line 477) and `AUDIT/references/audit-report.md`.

## Report back

assert-audit pass/fail per group, the runtime-proof section text, new vs previous findings (diff op titles against `RUN\j3\run1\`), tokens used, and suite totals after reset.
