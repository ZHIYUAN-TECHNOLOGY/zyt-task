# Steps 1–3 rollout — worktrees in waves

**Written:** 2026-09-14 · **Base branch:** `feat/new-layout` at `6c31a20e`
**Plans this covers:**

| Step                                                       | Plan                                                           | Phases | Readiness |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ------ | --------- |
| 01 — every enquiry leaves a record                         | `_plan/09-14_15-40_step-01-enquiry-channel/plan/plan.md`       | 2      | 9/10      |
| 02 — credit as a recorded decision, no duplicate companies | `_plan/09-14_15-55_step-02-credit-and-duplicates/plan/plan.md` | 3      | 8/10      |
| 03 — make an un-nominated contact visible                  | `_plan/09-14_15-21_step-03-contact-nomination/plan/plan.md`    | 2      | 9/10      |

---

## Why not all at once

The three plans' file lists, intersected:

| Pair            | Files both plans write                                                                     | What it means                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1 ∩ Step 3 | **none**                                                                                   | Fully parallel                                                                                                                                                   |
| Step 2 ∩ Step 3 | `packages/api/src/routers/report.ts`                                                       | Different regions — step 2 moves `verifiedAmountExpr` (top of file), step 3 edits `computeAgeing`'s detail query and the ageing export. Git merges these cleanly |
| Step 1 ∩ Step 2 | `apps/web/src/routes/_next/companies.tsx`, `packages/db/src/migrations/meta/_journal.json` | **Real conflict.** Both change the Add company dialog, and step 2's `0067` migration needs step 1's `0066` already in the chain                                  |

## Decision

|       | Approach                            | Consequence                                                                                                                                     |
| ----- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | All sequential, inside `nct-layout` | No conflicts; slowest, and `nct-layout` is shared with other sessions (single committer at a time; a shared index sweeps other sessions' hunks) |
| B     | All parallel, inside `nct-layout`   | Fastest on paper; two agents writing `companies.tsx` and the migration journal at the same time                                                 |
| **C** | **Separate worktrees, in waves**    | **Most of the work runs in parallel, isolated from other sessions; the one real conflict is avoided by ordering, not resolved by hand**         |

**Recommendation: C.**

---

## The waves

### Wave 1 — in parallel

| Worktree      | Branch                          | Runs                                                        |
| ------------- | ------------------------------- | ----------------------------------------------------------- |
| `../wt-step1` | `feat/step1-enquiry-channel`    | Step 01, all phases (adds migration `0066`)                 |
| `../wt-step3` | `feat/step3-contact-nomination` | Step 03, all phases (no migration)                          |
| `../wt-step2` | `feat/step2-credit`             | Step 02, **Phase 1 only** — the credit check (no migration) |

Only step 1 migrates in this wave, and `0066` adds a nullable column, so all three worktrees can share the dev Neon branch in `apps/server/.env`.

### Wave 2 — after step 1 is merged

In `wt-step2`: rebase onto `feat/new-layout`, then run Step 02 **Phase 2** (the duplicate refusal, near-match list and collisions filter). Rebasing first puts step 1's `CompanyFormDialog` change underneath, so there's nothing left to conflict on.

### Wave 3 — after production's collision count is known

In `wt-step2`: Step 02 **Phase 3** — the `0067` case-insensitive unique index, plus Task 3.0's reviewed merge script if the count is not 0.

**Gate — owner only, read-only, counts only:**

```bash
I_KNOW_THIS_IS_PRODUCTION=1 bun --env-file=apps/server/.env --env-file=packages/infra/.env.prod \
  --preload ./apps/server/cf-shim.mjs e2e/out/_walk/probe-step2.ts
```

Two `SELECT`s; prints `collision groups` and `collided companies referenced`. Dev branch read **0 groups** on 2026-09-14.

---

## Setup

```bash
cd C:/Project/NCT/nct-layout
git worktree add ../wt-step1 -b feat/step1-enquiry-channel feat/new-layout
git worktree add ../wt-step3 -b feat/step3-contact-nomination feat/new-layout
git worktree add ../wt-step2 -b feat/step2-credit feat/new-layout
```

Then in **each** worktree:

```bash
bun install
```

and open a Claude Code session there. Run `/execute` with the plan's **absolute path** — the three plan folders are untracked, so a fresh worktree does not contain them:

```text
# wt-step1
/execute C:/Project/NCT/nct-layout/_plan/09-14_15-40_step-01-enquiry-channel/plan/plan.md

# wt-step3
/execute C:/Project/NCT/nct-layout/_plan/09-14_15-21_step-03-contact-nomination/plan/plan.md

# wt-step2 — tell it Phase 1 only
/execute C:/Project/NCT/nct-layout/_plan/09-14_15-55_step-02-credit-and-duplicates/plan/plan.md
```

## Merge order

1. **Step 03** → `feat/new-layout`
2. **Step 02 Phase 1** → rebase over step 03 (`report.ts` merges cleanly), then merge
3. **Step 01** → merge (`0066` lands)
4. `wt-step2`: rebase, run **Phase 2**, merge
5. After the production gate: `wt-step2`, run **Phase 3**, merge (`0067` lands)

Before every merge:

- [ ] Type-check passes — read the output of `bun run check-types`, not its exit code (it exits 0 while printing "1 failed")
- [ ] Migrations: the journal's tags equal the files, `idx` is contiguous, and the PGlite chain replay passes
- [ ] The plan's §10 browser proof has been walked, **one worktree at a time**
- [ ] The index is empty of other sessions' hunks — read every hunk, not just `--stat`

---

## Traps in this repo

- **Ports.** Every worktree's dev servers want `:3101` (web) and `:3000` (API). `launch.json` has `autoPort`, but the seeds and the plans' §10 assume `3101`, so a browser check can silently hit another worktree's app. Run browser proofs one worktree at a time.
- **`bun --hot` ignores workspace dependencies.** After editing `packages/api`, restart the server — a hot reload keeps serving the old code and still answers 200.
- **Never `git stash` or `git reset`** to get out of a conflict. Stop and resolve by hand.
- **Push detaches HEAD** in `nct-layout` if you commit during a push; the repair is a fast-forward, never a reset.
- **Removing a worktree** when a branch is merged: `git worktree remove ../wt-stepN` — only after its branch is merged and nothing uncommitted is left in it.
