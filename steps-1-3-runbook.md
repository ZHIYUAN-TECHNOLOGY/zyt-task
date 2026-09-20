# Steps 1–3 Runbook: from plan to merged code

**For:** whoever implements SOP steps 01–03 (enquiry record → credit and duplicate companies → contact nomination)
**Written:** 2026-09-14 · **Base branch:** `feat/new-layout` at `6c31a20e` · **Repo:** `nct-layout`
**Plan owner:** Wilfred. He merges the PRs and runs anything that touches production.

How to take the three /planpro plans to merged code without two Claude sessions fighting over the same files. Three worktrees, three waves, and one place where you stop and ask the plan owner.

---

## 0. What you are building

| Step | Plan file | What it fixes | Phases | Migration |
|---|---|---|---|---|
| 01 | `step-01-enquiry-channel.md` | Only email leaves an enquiry record | 2 | `0066` (nullable column) |
| 02 | `step-02-credit-and-duplicates.md` | Credit is never checked; duplicate companies enter through case | 3 | `0067` (Phase 3 only) |
| 03 | `step-03-contact-nomination.md` | A contact nobody ticked as Primary never reaches the collections call list | 2 | no |

**Every decision is already settled** (2026-09-14). Sessions implement the chosen option and do not re-open it.

### Get the files

**Download everything this runbook needs:** [steps-1-3-plans.zip](/nct/downloads/steps-1-3-plans.zip) — this page's markdown plus the three step plans (01-03). Unzip it to `C:/nct-plans/`; the prompts below use that path, so change them if yours differs. The zip is rebuilt on every site deploy, so re-download it if the pages have changed since.

The plans are **not in git**, so the zip (or the folder `C:\Project\ZYT-Task\plans\` from Wilfred) is the only way to get them.

---

## 1. Why this shape

The three plans' file lists, intersected:

| Pair | Files both plans write | What it means |
|---|---|---|
| Step 1 ∩ Step 3 | none | Fully parallel |
| Step 2 ∩ Step 3 | `packages/api/src/routers/report.ts` | Different regions: step 2 moves `verifiedAmountExpr` (top of file), step 3 edits `computeAgeing`. Git merges these cleanly |
| Step 1 ∩ Step 2 | `apps/web/src/routes/_next/companies.tsx`, `packages/db/src/migrations/meta/_journal.json` | **Real conflict.** Both change the *Add company* dialog, and step 2's `0067` needs step 1's `0066` first. So step 2's later phases wait |

---

## 2. The waves at a glance

```
             Wave 1 (parallel)                 Wave 2 (after step 1 merges)   Wave 3 (after the gate)
wt-step3     Step 03 all phases                —                              —
wt-step2     Step 02 Phase 1 (credit check)    Step 02 Phase 2 (duplicates)   Step 02 Phase 3 (index 0067)
wt-step1     Step 01 all phases (0066)         —                              —
```

| Wave | Starts when | Runs | Migrates |
|---|---|---|---|
| **1** | now | 03 (all) · 02 Phase 1 · 01 (all) | 01 only |
| **2** | step 01 merged | 02 Phase 2 | none |
| **3** | production collision count is 0 | 02 Phase 3 | 02 only |

These waves can run alongside the Steps 4–10 waves. They share only the migration journal: see *Steps 4–10 Runbook* §6 (a migration takes the next free number when its branch is rebased for merge).

---

## 3. One-time setup

In your main `nct-layout` checkout:

```bash
git fetch origin
git switch feat/new-layout
git pull --ff-only
```

Create the three worktrees:

```bash
# from the nct-layout folder
git worktree add ../wt-step1 -b feat/step1-enquiry-channel     origin/feat/new-layout
git worktree add ../wt-step2 -b feat/step2-credit              origin/feat/new-layout
git worktree add ../wt-step3 -b feat/step3-contact-nomination  origin/feat/new-layout
```

Then run `bun install` inside **each** new worktree, and start `claude` there in its own terminal.

> A worktree is an extra folder on its own branch that shares one git history. Each Claude session gets its own folder, so no session can overwrite another's edits.

---

## 4. Wave 1: start three sessions

**`wt-step3`**
```text
Read C:/nct-plans/step-03-contact-nomination.md and implement it end to end, all phases.
Follow its section 10 to prove it works before telling me it is done.
```

**`wt-step2`**
```text
Read C:/nct-plans/step-02-credit-and-duplicates.md and implement PHASE 1 ONLY (the credit check).
Stop after Phase 1's acceptance criteria. Do not start Phase 2 or Phase 3.
```

**`wt-step1`**
```text
Read C:/nct-plans/step-01-enquiry-channel.md and implement it end to end, all phases,
including migration 0066 and the seed-inbox fixture in Task 2.5.
Follow its section 10 to prove it works before telling me it is done.
```

`/execute C:/nct-plans/<plan>.md` works too, if the session has that skill.

### While they run

- **Browser checks one worktree at a time.** Every worktree's app wants `:3101` (web) and `:3000` (API), and the seeds assume `3101`. Stop one worktree's dev servers before another session starts its browser check, or it silently tests the wrong app.
- **All three share the dev database** in `apps/server/.env`. That is safe in Wave 1: only step 1 migrates, and `0066` just adds a nullable column. Run `bun run db:migrate` in **wt-step1 only**.
- **Restart the API after editing `packages/api`.** `bun --hot` ignores workspace dependencies: it keeps serving the old code and still answers 200.
- **Never use `git stash` or `git reset`**, in any session, for any reason. If something is tangled, stop and ask.

---

## 5. Checklist before each PR

Run in the worktree once its session says it is done:

- [ ] `bun run check-types`: **read the output**. It can exit 0 while printing "1 failed"
- [ ] `bun run test` passes
- [ ] The plan's section 10 golden path walked in the browser at `localhost:3101`, one worktree at a time
- [ ] Step 1 only: `0066` is in `meta/_journal.json`, its tag matches the file, `idx` is contiguous, and it is applied (check the migrations table, not the exit code)
- [ ] Every changed hunk read in `git diff origin/feat/new-layout`, not just the file list

Then push and open the PR (example: step 3):

```bash
git add -A
git commit -m "fix(contacts): show when nobody is nominated primary (SOP step 3)"
git push -u origin feat/step3-contact-nomination
gh pr create --base feat/new-layout --fill
```

---

## 6. Merge in this order

Wilfred merges each PR into `feat/new-layout` in this sequence. Before a branch is merged, bring it up to date with what merged ahead of it.

1. **Step 03** first.
2. **Step 02 Phase 1** second. Rebase first; `report.ts` merges cleanly.
3. **Step 01** third. Rebase first. Migration `0066` lands.

Bring a branch up to date, inside its worktree:

```bash
git fetch origin
git rebase origin/feat/new-layout
bun install
bun run check-types
git push --force-with-lease
```

**If the rebase stops on a conflict:** resolve it by hand, `git add <file>`, then `git rebase --continue`. If you're unsure which side is right, `git rebase --abort` puts the branch back exactly as it was. Then ask.

---

## 7. Wave 2: step 02 Phase 2

Only after step 01 is merged. This phase touches the same *Add company* dialog as step 01; rebasing first puts step 01's change underneath, so there is nothing left to conflict on.

```bash
# in wt-step2
git fetch origin
git rebase origin/feat/new-layout
bun install
```

New Claude session in `wt-step2`:

```text
Read C:/nct-plans/step-02-credit-and-duplicates.md. Phase 1 is already merged.
Implement PHASE 2 ONLY (the duplicate-company refusal, the near-match list
and the Name collisions filter). Stop after Phase 2's acceptance criteria.
```

Run the §5 checklist again, open the PR, and have it merged.

---

## 8. Stop gate: production collision count (owner only)

**Do not run anything against production yourself.** Phase 3 adds a case-insensitive unique index on company names. Migration `0067` fails partway through the deploy if production already holds two companies whose names differ only by case or spacing. The repo blocks production connections on purpose; Wilfred takes this reading.

Message to Wilfred:

```text
Step 2 Phases 1–2 are merged. Before Phase 3, can you run the read-only
production collision probe from the step 2 plan and tell me the
"collision groups" and "collided companies referenced" counts?
```

What Wilfred runs (read-only, two `SELECT`s, counts only):

```bash
I_KNOW_THIS_IS_PRODUCTION=1 bun --env-file=apps/server/.env --env-file=packages/infra/.env.prod \
  --preload ./apps/server/cf-shim.mjs e2e/out/_walk/probe-step2.ts
```

The dev branch read **0 groups** on 2026-09-14. Production has not been checked.

---

## 9. Wave 3: step 02 Phase 3

| Wilfred reports | What you do |
|---|---|
| **0 collision groups** | Rebase `wt-step2`, then give the session the prompt below. Task 3.0 (the merge script) has nothing to do |
| **More than 0** | Stop. The duplicates must be resolved first: renamed or deleted in the app, or merged by Task 3.0's script, which **Wilfred reviews before it runs**. Come back when the count is 0 |

New Claude session in `wt-step2`, only when the count is 0:

```text
Read C:/nct-plans/step-02-credit-and-duplicates.md. Phases 1 and 2 are merged, and the
production collision count is confirmed 0, so Task 3.0 is a no-op.
Implement PHASE 3 ONLY: migration 0067 and the case-insensitive index.
```

Check that `0067` sits after `0066` in the journal with no gap (or takes the next free number, per *Steps 4–10 Runbook* §6), run the §5 checklist, and open the last PR.

---

## 10. Close the loop and clean up

After each merge, tick the matching finding on the dashboard (`nct-channels`, `nct-s02-duplicate-companies-enter-through-case`, `nct-credit`, `nct-s03-a-contact-nobody-ticked-as-primary-never-reaches`) and the runbook step.

Only once a branch is merged **and** `git status` in its worktree is clean:

```bash
# from the nct-layout folder
git worktree remove ../wt-step3
git worktree remove ../wt-step1
git worktree remove ../wt-step2
```

---

## 11. When something looks wrong

| What you see | Why | Do this |
|---|---|---|
| The browser shows another step's changes | Two worktrees' dev servers on the same port | Stop every dev server, start only the worktree you are checking |
| An API change "doesn't work" but the request returns 200 | Hot reload kept the old `packages/api` code | Restart the API server |
| 500 or 401 errors right after pulling | A migration is written but not applied | Check `meta/_journal.json`, run `bun run db:migrate`, confirm in the migrations table |
| The session can't find the plan | Plan files aren't in git | Point it at the absolute path of the file in `C:/nct-plans/` |
| Step 1's inbox proof has no thread to open | The `seed-inbox` fixture (Task 2.5) wasn't built | Ask the step 1 session to finish Task 2.5 before section 10 |
| Type-check "passed" but the log says failed | The command's exit code lies | Search the output for "failed"; fix, re-run |
| `git push` while committing leaves `HEAD` detached | Known `nct-layout` quirk | Repair with a fast-forward, never a reset |
