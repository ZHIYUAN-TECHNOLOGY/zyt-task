# Steps 4–10 Runbook: from plan to merged code

**For:** whoever implements SOP steps 04–10 (quote → approval → send → decision)
**Written:** 2026-09-15 · **Base branch:** `feat/new-layout` at `6bb3a1bf` · **Repo:** `nct-layout`
**Plan owner:** Wilfred. He merges the PRs and runs anything that touches production.

This is how to turn the seven /planpro plans into merged code. Several Claude Code sessions run in parallel, each in its own git worktree, and no two of them edit the same code at the same time.

---

## 0. What you are building

| Step | Plan file | What it fixes | Phases | Migration | Readiness |
|---|---|---|---|---|---|
| 04 | `step-04-rate-card-gate.md` | The server accepts a rate card nobody approved | 2 (+ follow-up F.1) | yes | 7/10 |
| 05 | `step-05-quotation-date-and-staff.md` | Nobody can set the quotation date or salesperson | 2 | no | 8/10 |
| 06 | `step-06-tariff-quantity-from-containers.md` | Lines applied from a rate card ignore the container count | 2 | no | 7/10 |
| 07 | `step-07-ambiguous-tariff-floor.md` | Conflicting rate cards silently drop the price floor | 3 | no | 7/10 |
| 08 | `step-08-quotation-approval-integrity.md` | 5 holes in quotation approval | 4 | no | 7/10 |
| 09 | `step-09-send-outbox.md` | A failed save after sending means a duplicate email | 2 (+ Phase 0 checks) | yes | 7/10 |
| 10 | `step-10-decision-correction.md` | A wrong Won/Lost cannot be corrected | 2 | yes | 6/10 |

**Every decision is already settled.** Wilfred picked the recommended option for all 33 decisions on 2026-09-15. Each plan's §9 says which option was **Chosen**. Sessions implement that option and do not re-open it.

Also read **`steps-4-10-crosscheck.md`**. It records how the plans depend on each other, and five settlements that span plans (X1–X5).

### Get the files

**Download everything this runbook needs:** [steps-4-10-plans.zip](/nct/downloads/steps-4-10-plans.zip) — this page's markdown plus the seven step plans (04-10) and `steps-4-10-crosscheck.md`. Unzip it to `C:/nct-plans/`; the prompts below use that path, so change them if yours differs. The zip is rebuilt on every site deploy, so re-download it if the pages have changed since.

The plans are **not in git**, so the zip (or the folder `C:\Project\ZYT-Task\plans\` from Wilfred) is the only way to get them.

---

## 1. Why not all seven at once

Every plan edits `packages/api/src/routers/quotation.ts`. Git merges that cleanly when the edits are in different functions, but not when two steps rewrite the same one. The real collisions:

| Shared code | Steps that write it | Handled by |
|---|---|---|
| `applyTemplate` + `reference-template-dialog.tsx` | 04, 06 | 06 waits for 04 |
| Audit engine (`modules/audit/gates.ts`, `shared.ts`, `submit.ts`, `decide.ts`, `resources.ts`, `seed.ts`) | 04, 07 (Phase 3), 08 (Phases 2–3), 10 | 04 → 08 → 07 → 10, one after another |
| `send` handler + `send-quotation-dialog.tsx` | 08 (Phase 4), 09 | 09 waits for 08 Phase 4 |
| An engine **hook** added to `submit.ts` / `decide.ts` | 07 (publish check), 10 (apply on approval) | 10 goes last and **reuses 07's hook shape** rather than adding a second one |
| `tariff-check.ts` | 05 (date helper), 07 | 07 waits for 05 |
| Migration journal `packages/db/src/migrations/meta/_journal.json` | 04, 09, 10 (and steps 01/02) | At most one migrating step per wave. Numbers are assigned at merge (§6) |
| `apps/web/src/routes/_next/quotations/$quotationId.tsx` | 05–10 | Different regions. Rebase before merging and resolve by hand |

**Decision: separate worktrees, in four waves.** Anything that doesn't collide runs in parallel. Collisions are avoided by order, so nobody resolves them by hand.

---

## 2. The waves at a glance

```
             Wave 1 (parallel)          Wave 2 (parallel)         Wave 3 (parallel)          Wave 4
wt-step04    Step 04 all phases ──┐                               Task F.1 (1 line) ──┐
wt-step08    Step 08 Ph 1 + 4 ────┼──►  Step 08 Ph 2 + 3 ──────┐                      │
wt-step05    Step 05 all phases ──┘                            │                      │
wt-step06                               Step 06 all phases ────┼─► 
wt-step07                                                      └─► Step 07 all phases ┼─►
wt-step09                                                          Step 09 all phases ┘
wt-step10                                                                                 Step 10 all phases
wt-step11    Step 11 Phase 1 ─────┘ (merges after 05)
```

| Wave | Starts when | Runs in parallel | Merge order in the wave | Migrates |
|---|---|---|---|---|
| **1** | now | 04 (all) · 08 Phases 1+4 · 05 (all) · **11 Phase 1** (added 2026-09-17, X15) | 04 → 08 P1+P4 → 05 → **11 P1** | 04 only |
| **2** | all of Wave 1 merged | 08 Phases 2+3 · 06 (all) | 08 P2+P3 → 06 | none |
| **3** | all of Wave 2 merged | 04 Task F.1 · 07 (all) · 09 (all) | F.1 → 07 → 09 | 09 only |
| **4** | all of Wave 3 merged | 10 (all) | 10 | 10 only |

**Step 11 Phase 1 in Wave 1 (added 2026-09-17, `steps-12-15-crosscheck.md` X15).** Step 11 Phase 1 refuses converting a quotation that is not Won. It runs in its own worktree `wt-step11` and **merges after step 05**, because it is rebased over step 08 Phase 3: Task 3.3 deletes the legacy `quotationsRouter.review` (`quotation.ts:3845`), which sits directly above `convertToOrder` (`:3887`) (step 11 D4-A). It does not migrate. **Do not start it until Wilfred gives the go-ahead** — steps 11–15 have their own plans and their own crosscheck, and he starts that track deliberately. Step 11 Phases 2–3 are not in these four waves; they are Wave 5 in the steps 11–15 wave plan.

**Where steps 01–03 fit:** these waves can run alongside the Steps 1–3 rollout. The only thing they share is the migration journal, and §6 covers that.

---

## 3. One-time setup

In your main `nct-layout` checkout:

```bash
git fetch origin
git switch feat/new-layout
git pull --ff-only
```

Create the worktrees for a wave **when that wave starts**, not all up front, so each one branches from the latest base. For Wave 1:

```bash
# from the nct-layout folder
git worktree add ../wt-step04 -b feat/step04-rate-card-gate      origin/feat/new-layout
git worktree add ../wt-step08 -b feat/step08-approval-integrity  origin/feat/new-layout
git worktree add ../wt-step05 -b feat/step05-date-and-staff      origin/feat/new-layout

# added 2026-09-17 (X15) — only once Wilfred has given the go-ahead for the steps 11-15 track
git worktree add ../wt-step11 -b feat/step11-convert-won-quote   origin/feat/new-layout
```

Then run `bun install` inside **each** new worktree, and start `claude` there in its own terminal.

> A worktree is an extra folder on its own branch that shares one git history. Each Claude session gets its own folder, so no session can overwrite another's edits or sweep them into its commit.

Keep `wt-step04` after step 04 merges. Wave 3 reuses it for Task F.1.

---

## 4. The prompt for each session

Paste one of these into the session in the matching worktree. They follow one template: read the plan, name the phases, respect the settled decisions, prove it works, and stop.

### Wave 1

**`wt-step04`**
```text
Read C:/nct-plans/step-04-rate-card-gate.md in full, and C:/nct-plans/steps-4-10-crosscheck.md.
Implement Phase 1 and Phase 2. Do NOT do follow-up Task F.1. It runs after step 08 merges.
Every decision in §9 is settled: implement the Chosen option and do not re-open it.
Do not apply migration 0068 to any database until I confirm the production count is done.
Prove it with the plan's §10 before telling me it is done. Never run git stash or git reset.
```

**`wt-step08`**
```text
Read C:/nct-plans/step-08-quotation-approval-integrity.md in full, and C:/nct-plans/steps-4-10-crosscheck.md.
Implement PHASE 1 and PHASE 4 ONLY (the under-review freeze, and the Export quotation gate moved
into exportSheet and send). Stop after their acceptance criteria. Do not start Phase 2 or 3.
Every decision in §9 is settled: implement the Chosen option.
Put the export gate in `send` where step 09 can call it before its idempotency lookup (see the cross-plan settlements in §9).
Prove it with §10 for those phases. Never run git stash or git reset.
```

**`wt-step05`**
```text
Read C:/nct-plans/step-05-quotation-date-and-staff.md in full, and C:/nct-plans/steps-4-10-crosscheck.md.
Implement Phase 1 and Phase 2. Every decision in §9 is settled: implement the Chosen option.
Prove it with §10 before telling me it is done. Never run git stash or git reset.
```

**`wt-step11`** (added 2026-09-17, X15 — start only after Wilfred's go-ahead; merge after step 05)
```text
Read C:/nct-plans/step-11-convert-won-quote.md in full, and C:/nct-plans/steps-12-15-crosscheck.md.
Implement PHASE 1 ONLY (refuse converting a quotation that is not Won). Stop at its acceptance criteria.
Do NOT start Phase 2 or Phase 3: they wait until step 10 is merged.
Every decision in §9 is settled (D1-B, D2-D9 A): implement the Chosen option and do not re-open it.
This branch merges after step 05, and it is rebased over step 08 Phase 3, which deletes the legacy
quotationsRouter.review directly above convertToOrder. Re-locate convertToOrder by symbol, never by line.
This phase adds no migration. Prove it with §10 for Phase 1. Never run git stash or git reset.
```

### Wave 2 (after all of Wave 1 is merged)

**`wt-step08`** (rebase first, see §5)
```text
Read C:/nct-plans/step-08-quotation-approval-integrity.md. Phases 1 and 4 are merged.
Implement PHASE 2 and PHASE 3 ONLY: the per-resource separationOfDuties switch (on for quotation),
the refusal to re-submit an approved locked record, and Task 3.3, which deletes BOTH quotations.review
and the legacy feeTemplates.review with their allow-list entries.
Task 3.3 also drops `isEndpoint: true` on the QUOTATION.review and QUOTATION.feeTemplateReview nodes in
modules/quotation/permissions.ts, in the same commit, or registry.sync.test.ts fails (plan header, X10).
Build the switch so another resource can opt in with one line. Steps 04 and 10 will.
Every decision in §9 is settled. Prove it with §10. Never run git stash or git reset.
```

**`wt-step06`** (new worktree)
```text
Read C:/nct-plans/step-06-tariff-quantity-from-containers.md in full, and C:/nct-plans/steps-4-10-crosscheck.md.
Step 04 is merged, so applyTemplate and reference-template-dialog.tsx already carry its gate. Build on top of that.
Implement Phase 1 and Phase 2. Every decision in §9 is settled: implement the Chosen option.
Prove it with §10. Never run git stash or git reset.
```

### Wave 3 (after all of Wave 2 is merged)

**`wt-step04`** (rebase first)
```text
Read C:/nct-plans/step-04-rate-card-gate.md, section "Settlements that span plans".
Step 08's separationOfDuties switch is merged. Implement follow-up Task F.1 ONLY: turn the switch on
for fee_template, with a router test showing the submitter of a fee-template review is refused on decide.
Never run git stash or git reset.
```

**`wt-step07`** (new worktree)
```text
Read C:/nct-plans/step-07-ambiguous-tariff-floor.md in full, and C:/nct-plans/steps-4-10-crosscheck.md.
Steps 04, 05, 06 and 08 are merged. Implement Phase 1, Phase 2 and Phase 3, including Task 1.5 (D5-A).
Phase 3's publish check hooks the audit engine. Keep the hook generic, because step 10 will reuse its shape.
Call the hook in submitForReview AFTER the open-attempt check and before the stage lookup: step 14 reuses this
same hook for orders and needs the call site to be the one its plan describes (steps-12-15-crosscheck.md X9).
Every decision in §9 is settled. Prove it with §10. Never run git stash or git reset.
```

**`wt-step09`** (new worktree)
```text
Read C:/nct-plans/step-09-send-outbox.md in full, and C:/nct-plans/steps-4-10-crosscheck.md.
Step 08 is merged, so `send` already asserts the Export quotation gate. Keep that call BEFORE your idempotency-key lookup.
Do Phase 0 (check the journal head and number the migration as the next free one), then Phase 1 and Phase 2.
Every decision in §9 is settled. Prove it with §10. Never run git stash or git reset.
```

### Wave 4 (after all of Wave 3 is merged)

**`wt-step10`** (new worktree)
```text
Read C:/nct-plans/step-10-decision-correction.md in full, and C:/nct-plans/steps-4-10-crosscheck.md.
Steps 04–09 are merged. Implement Phase 1 and Phase 2.
- Reuse the engine hook shape step 07 added to submit.ts/decide.ts. Do not add a parallel mechanism.
- Turn step 08's separationOfDuties switch on for quotation_decision (X1).
- Do not freeze decide while a quotation is under review (X4).
- Set `correctionPath: true` in the `assertConvertibleOutcome` call (added 2026-09-17, steps-12-15-crosscheck X15).
- Place your pending-correction refusal AFTER `assertConvertibleOutcome` in `convertToOrder`, so a
  non-Won quote is refused first and the correction message never masks it (step 11 §4 refusal order;
  added 2026-09-17, X15). Step 11 Phase 1 merged in Wave 1, so that guard is already there.
- Number the migration as the next free one in the journal.
Every decision in §9 is settled. Prove it with §10. Never run git stash or git reset.
```

> If you have the `/execute` skill, `/execute C:/nct-plans/step-0N-….md` works too. Tell it the phases in the same words.

---

## 5. Keeping a branch up to date

Before a branch's PR is merged, bring it up to date with whatever merged ahead of it. Do this inside its worktree:

```bash
git fetch origin
git rebase origin/feat/new-layout
bun install
bun run check-types
git push --force-with-lease
```

**If the rebase stops on a conflict:** resolve it by hand, `git add <file>`, then `git rebase --continue`. If you're unsure which side is right, `git rebase --abort` puts the branch back exactly as it was. Then ask.
**Never use `git stash` or `git reset`**, in any session, for any reason. The stash stack is shared by every worktree and every session on the machine.

---

## 6. Migrations: numbers are assigned at merge

The repo's migration test requires **contiguous** numbers with no gaps. Steps 01 and 02 hold `0066` and `0067`, but step 02's migration waits on production data and may land late. So the number a step reserved in its plan (0068/0073/0074) is only a placeholder.

**Rule: a migration takes the next free number at the moment its branch is rebased for merge.**

If a migration merged ahead of yours, inside your worktree after rebasing:

1. Delete your migration's `.sql`, its `meta/<n>_snapshot.json`, and its entry in `meta/_journal.json`.
2. Regenerate against the new head:
   - schema change: `cd packages/db && bunx drizzle-kit generate --name <same_name>`
   - data-only SQL (step 04's gate row): `cd packages/db && bunx drizzle-kit generate --custom --name <same_name>`, then paste your SQL back in
3. Run the three gates: `bunx vp test run packages/db/src/migrations.test.ts`. They check that tags equal files, that `idx` is contiguous, and that the chain replays on PGlite. PGlite has no `pg_trgm` or other extensions.
4. Commit the `.sql`, snapshot, journal and any `schema/*.ts` change **in one commit**.

**Shared dev database:** every worktree's `apps/server/.env` points at the same Neon **dev** branch. Run `bun run db:migrate` there **only from the branch that is next to merge**, and confirm by querying the migrations table, not by the exit code. The other worktrees rely on the PGlite gate until then. Never point anything at production (`br-round-sun`).

---

## 7. Stop gates: owner only

Do not run anything against production yourself. Send Wilfred the message and wait.

| Before | Wilfred runs (read-only) | If the result is bad |
|---|---|---|
| Merging **step 04** (its migration arms the gate) | `select audit_status, count(*) from fee_template group by 1` and the 30-day in-use count in step 04 §7 | Cards used in the last 30 days: announce the change and have them submitted for approval the day before the migration applies |
| Merging **step 05** Phase 2 | Any role policy denying `quotationDate` / `quotationStaff` (step 05 §7) | If one exists, Task 2.3 sends each key only when its value changed. Tell the session |
| Releasing **step 07** | The §8 probe for same-date rate-card clashes and unit-spelling variants | Hand the list to Pricing to supersede or clean. No data change (D4-A) |
| After **step 08** Phase 3 merges | The drift count script from Task 3.5 (quotes stamped approved without a review, or unlocked) | Decide row by row (D5-A). Code does not wait for it |
| Merging **step 10** | Deploy-time re-seed script for existing orgs (D6-A) | Must run before any browser check against an existing org |

Message template:
```text
Step 0N is ready to merge. Before it does, can you run the read-only production check from
step 0N §7 and tell me the counts?
```

**Deploying is separate from merging, and is Wilfred's call.** For any step with server and web changes, deploy the server first (step 04 §7).

---

## 8. Checklist before each PR

Run inside the worktree once its session says it is done:

- [ ] `bun run check-types`: **read the output.** It can exit 0 while printing "1 failed".
- [ ] `bun run test`: read the output the same way.
- [ ] If the step migrates: `bunx vp test run packages/db/src/migrations.test.ts` passes, and the number is the next free one (§6).
- [ ] If the step touched `packages/api`: `packages/api/src/architecture.test.ts` passes. A green from the **web** architecture test is a different gate.
- [ ] The plan's §10 walked in the browser at `localhost:3101`, **one worktree at a time** (§9).
- [ ] Every hunk read in `git diff origin/feat/new-layout...HEAD`, not just the file list.
- [ ] Commit, push, open the PR:

```bash
git add -A
git commit -m "fix(quotation): <what> (SOP step 0N)"
git push -u origin <branch>
gh pr create --base feat/new-layout --fill
```

Then ask Wilfred to merge, **in the order in §2**.

**Close the loop.** After each merge, tick the fixed defects on the SOP page (*When a Customer Comes In*), under the step's *What to fix first*, and paste the PR link as a comment.

---

## 9. Traps in this repo

| What you see | Why | Do this |
|---|---|---|
| The browser shows another step's changes | Every worktree's app wants `:3101` (web) and `:3000` (API) | Stop every dev server, then start only the worktree you're checking |
| An API change "doesn't work" but returns 200 | `bun --hot` doesn't reload `packages/api` changes | Restart the API server |
| Your browser suddenly shows a different org | One login is shared across sessions, and whoever switches org last moves everyone | Use `e2e/fixtures/seed-cli.ts seed-parity <runId>`: it creates a private org and owner cookie with no login |
| 500/401 right after a rebase | A migration was written but not applied to the dev DB | Check `meta/_journal.json` and the migrations table, not the exit code |
| An ad-hoc Playwright script hangs for 180 s | Chromium launch hangs under bun | Run walk scripts with `node` from `e2e/out/_walk/` |
| Type-check "passed" but the log says failed | `vp run` exit code lies | Grep the output for `failed` |
| The session can't find the plan | Plans aren't in git | Give it the absolute path to your downloaded copy |
| Two steps both want to add a hook to `decide.ts` | 07 and 10 both extend the audit engine | 10 reuses 07's hook (Wave 4 prompt) |

---

## 10. Clean up

Only once a branch is merged **and** `git status` in its worktree is clean:

```bash
# from the nct-layout folder
git worktree remove ../wt-step05
git branch -d feat/step05-date-and-staff
```

Remove `wt-step04` only after Task F.1 has merged too.

**Keep `wt-step11`** (added 2026-09-17, X15). Step 11 Phases 2 and 3 reuse it after step 10 merges, so do not remove that worktree or delete `feat/step11-convert-won-quote` when Phase 1 merges.

---

## 11. Not covered here

- **Lost quotes can be converted to orders.** `convertToOrder` never checks for Won (cross-plan item X5). This belongs to the step 11 plan. **Update 2026-09-17:** step 11 Phase 1 fixes it and now runs in Wave 1 above (X15).
- **Steps 11–15 now have their own plans** (added 2026-09-17): `step-11-convert-won-quote.md`, `step-12-job-number.md`, `step-13-intake-decisions.md`, `step-14-job-shape.md`, `step-15-order-approval-integrity.md`, plus `steps-12-15-crosscheck.md`, which settles the gaps between them (X6–X16) and proposes Waves 5–11 continuing the numbering of the four waves here. Only step 11 Phase 1 and step 13 Phase 1 can run alongside Waves 1–4; everything else in that track starts after Wave 4 is merged. This runbook still covers steps 04–10 only.
- Steps 01–03 have their own runbook: `steps-1-3-rollout.md` / the *Steps 1–3 Rollout* page.
