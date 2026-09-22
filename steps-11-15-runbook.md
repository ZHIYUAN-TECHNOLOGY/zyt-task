# Steps 11–15 Runbook: from plan to merged code

**For:** whoever implements SOP steps 11–15 (convert a Won quotation → job number → intake decisions → job shape → order approval integrity)
**Written:** 2026-09-18 · **Base branch:** `feat/new-layout`, evidence HEAD `6bb3a1bf` · **Repo:** `nct-layout`
**Plan owner:** Wilfred. He merges the PRs, deploys, and runs anything that touches production.

This is how to turn the five /planpro plans for steps 11–15 into merged code. It covers **Waves 5 to 11**, which continue the numbering of `steps-4-10-runbook.md`. Waves 1–4 are that runbook's, and two phases of this track already live there (§1).

Each wave runs in its own git worktree, one Claude Code session per worktree, and no two sessions edit the same code at the same time.

---

## 0. What you are building

| Step | Plan file | What it fixes | Phases | Migration | Readiness |
|---|---|---|---|---|---|
| 11 | [`step-11-convert-won-quote.md`](/nct/step-11-plan/) | A Lost quotation becomes a job; a converted job arrives with no number and lump-sum lines | 3 | none (D3-A) | 7/10 |
| 12 | [`step-12-job-number.md`](/nct/step-12-plan/) | **Assign number** can be pressed twice, and the job's lines keep the old reference | 3 | none (D3-A) | 9/10 |
| 13 | [`step-13-intake-decisions.md`](/nct/step-13-plan/) | To Receive is a dead end, and a rejection is silently undone by re-receiving | 2 | none (D3-A) | 9/10 (crosscheck says 8, see §12) |
| 14 | [`step-14-job-shape.md`](/nct/step-14-plan/) | An empty order goes for review; order status is free text | 3 | none | 8/10 (crosscheck says 7, see §12) |
| 15 | [`step-15-order-approval-integrity.md`](/nct/step-15-plan/) | An order is edited under review, approved by its own submitter, and a B/L is raised on an unapproved order | 3 | none | 8/10 (crosscheck says 7, see §12) |

Every plan is also a page on this site — the file names above link to them.

<a class="rb-dl" href="/nct/downloads/all-plans.zip" download>⤓ Download all plans <small>every plan and crosscheck for steps 01–15, plus the three runbooks</small></a>

The smaller [steps-11-15-plans.zip](/nct/downloads/steps-11-15-plans.zip) in *Get the files* holds only what this runbook needs.

**Every decision across steps 11–15 is settled.** Wilfred settled step 11 on 2026-09-16 (D1-B, D2–D9 A) and steps 12–15 plus the cross-plan items X6–X16 on **2026-09-17**, taking the recommended option in every case with no exception. Each plan's §9 says which option is **Chosen** / **Decided**. Sessions implement that option and do not re-open it.

Under the settled options **no wave in this runbook migrates**. Conditional migrations exist in the plans but none of their options was chosen.

Also read **[`steps-12-15-crosscheck.md`](/nct/steps-12-15-crosscheck/)**. It records how the five plans depend on each other and the eleven cross-plan settlements X6–X16, and it is the source of the wave order in §3.

### Get the files

**Download everything this runbook needs:** [steps-11-15-plans.zip](/nct/downloads/steps-11-15-plans.zip) — this page's markdown plus the five step plans (11-15) and `steps-12-15-crosscheck.md`. Unzip it to `C:/nct-plans/`; the prompts below use that path, so change them if yours differs. The zip is rebuilt on every site deploy, so re-download it if the pages have changed since.

The plans are **not in git**, so the zip (or the folder `C:\Project\ZYT-Task\plans\` from Wilfred) is the only way to get them.

The code repo `C:/Project/NCT/nct-layout` is the only place code changes, and only inside a worktree of it.

---

## 1. Where step 11 Phase 1 and step 13 Phase 1 live

Two phases of this track do **not** run in Waves 5–11. They belong to the steps 4–10 waves, and `steps-4-10-runbook.md` already carries them (crosscheck X15):

| Phase | Wave | Why it is there | Merge position |
|---|---|---|---|
| **Step 11 Phase 1** (refuse converting a quotation that is not Won) | Wave 1, worktree `wt-step11` | It closes a live money defect four waves early and touches only the head of `convertToOrder`, one JSX condition and one test file | After step 05. It is rebased over step 08 Phase 3, which deletes the legacy `quotationsRouter.review` sitting directly above `convertToOrder` (step 11 D4-A) |
| **Step 13 Phase 1** (To Receive opens the order) | any wave, earliest Wave 1, worktree `wt-step13-p1` | Web only, and it collides with no plan (13 D10-A) | After step 11 Phase 1 in the Wave 1 order |

Keep `wt-step11` when Phase 1 merges: Wave 5 reuses it.

Everything else in steps 11–15 starts only after **Wave 4** (step 10) is merged.

---

## 2. Why the waves are in this order

Five plans write the same three or four files. `routers/collective-order.ts` is touched by all five, `modules/audit/resources.ts` by three, and `seed/operations.ts` by three. Collisions are handled by **ordering**, never by resolving a merge by hand. The binding edges, from the crosscheck §1 and each plan's §7:

| Shared code | Writers | Handled by |
|---|---|---|
| The allocator region of `routers/collective-order.ts` | 11 Task 2.1 moves it to `modules/collective-order/insert-order.ts` [NEW] | Everyone after 11 P2 re-locates by symbol (about 130 lines shift) |
| `collectiveOrderRouter.assignNumber` | 11 Task 2.4 (re-stamp), 12 Tasks 1.1–1.2 (row lock, widened predicate), 15 Phase 1 (`assertNotUnderReview`) | 11 P2 → 12 P1 → 15 P1. **Step 12 Task 1.1 owns the `.for("update")` lock (X7)**; 14 and 15 grep for it and do not add a second |
| `collectiveOrder.update`, `updateBatch` | 12 P3 (normalise `jobNumber`), 15 P1 (freeze + lock), 14 P3 (status validation) | 12 → 15 → 14 P3, each in a different part of the handler |
| `REVIEWABLE_RESOURCES.collective_order` in `modules/audit/resources.ts` | 08 (`separationOfDuties: false`), 15 Task 1.3 (`exists` lock), 15 Task 2.2 (flag true), 14 Task 1.2 (readiness) | 08 → 15 P1 → 15 P2 → 14 P1 |
| `ReviewableResource` / `modules/audit/submit.ts` | 07 (`assertPublishable?`), 08, 10 (`onPassed?`), 14 | 07 → 08 → 10 → 14. **X9: step 14 implements 07's `assertPublishable` and adds no new member and no `submit.ts` edit** |
| `collective-order.concurrency.test.ts` [NEW] | 15 Task 1.4 creates it; 14 Task 1.2 adds a `describe` | X8. Steps 12 and 13 keep their own concurrency files |
| `seed/operations.ts` | 13 Task 2.6 (comment), 14 Task 1.3 (order values + raw insert), 15 Task 3.7 (`ensureLadings`) | X12: **14 P1 merges before 15 P3** |
| `apps/web/src/components/order-form.tsx` | 15 Task 1.5 (under-review notice, Save disabled), 14 Task 2.2 (readiness panel), 14 Task 3.3 (status select) | 15 P1 → 14 P2 → 14 P3. Put the under-review notice above the Before-review panel |
| `packages/api/src/architecture.test.ts` allow-list | 11, 12, 13 Task 2.2, 15 P1 and Task 2.1 | Entries are line-independent, comments collide. 13's new entry neighbours 15's removal, so the second to merge rebases. Each key change is committed with its code, or the stale-entry rule fails |
| `modules/collective-order/permissions.ts` | 13 Task 2.2 (`reopen` node), 15 Task 2.1 (`isEndpoint` on `review`) | Neighbouring blocks; the second to merge rebases, and both run `permissions/registry.sync.test.ts` |
| `collective-order.guards.test.ts` | 13 Task 2.3, 14 Task 3.2, 15 Task 2.3 | Different `describe` blocks. X6 moved step 15's freeze cases into `collective-order.under-review.test.ts` [NEW] to take one writer off this file |

The single circular dependency in the drafts (steps 14 and 15 each naming the other as the owner of the order under-review freeze) is settled by **X6: step 15 owns it.** Step 14 takes D5-C, step 15 takes D17-B, and **15 Phase 1 merges before 14 Phase 1**. Nobody re-opens this.

---

## 3. The waves at a glance

```
              Wave 5        Wave 6            Wave 7    Wave 8    Wave 9    Wave 10        Wave 11
wt-step11     11 P2 → P3
wt-step12                   12 P1 (+P3)
wt-step13-p2                13 P2
(ZYT-Task)                  12 P2 (SOP text, after the Wave 5 DEPLOY)
wt-step15                                     15 P1     15 P2               15 P3
wt-step14                                                         14 P1     14 P2          14 P3
```

| Wave | Starts when | Runs in parallel | Merge order in the wave | Probes Wilfred runs first | Deploy notes |
|---|---|---|---|---|---|
| **5** | all of Wave 4 (step 10) merged | `wt-step11`: step 11 Phase 2 then Phase 3, one session | 11 P2 → 11 P3 | 11-P1, 11-P2, 11-P3, 11-P5; **12-P3 in place of 11-P4**; 12-P10 | Server before web (the conversion toast reads `jobNumber`) |
| **6** | Wave 5 merged | `wt-step12`: step 12 Phase 1 and Phase 3 · `wt-step13-p2`: step 13 Phase 2 · **step 12 Phase 2** (SOP text, in the ZYT-Task repo, only after Wave 5 is **deployed**) | 12 P1 → 13 P2 (13 rebases and re-locates by symbol) | 12-P5/P5b, 12-P6, 12-P7, 12-P9, 12-P2; **13-P8 before the 13 P2 deploy**; 13-P3, 13-P4, 13-P7 | 13 P2: server before web. The owner-run `permission_node` INSERT for `collectiveOrder.reopen` on dev **before** the Phase 2 proof, on production after the deploy and before any P8 grant. Wilfred republishes the SOP site |
| **7** | Wave 6 merged | `wt-step15`: step 15 Phase 1 (order under-review freeze + `FOR UPDATE` in `collective_order.exists`, X6) | 15 P1 | **15-P13, 15-P6, 15-P10 before Task 1.2**; 15-P2, 15-P7 | API before web (`get.underReview`). Announce "withdraw before editing" |
| **8** | Wave 7 merged | step 15 Phase 2, same worktree (delete the legacy review verbs, separation of duties) | 15 P2 | **15-P4 before Task 2.1**; **15-P1 and 15-P12 before Task 2.2** | API only. `/rpc/collectiveOrder/review` returns 404 afterwards |
| **9** | Wave 8 merged | `wt-step14`: step 14 Phase 1 (readiness at submit, through step 07's `assertPublishable` hook, X9) | 14 P1 | **14-P3, 14-P4, 14-P5 before Task 1.1** (see §12 on P5) | Server and e2e fixtures together. The operations seeder must print `collective_order submitted 6` and exit 0 |
| **10** | Wave 9 merged | step 15 Phase 3 (`wt-step15`) · step 14 Phase 2 (`wt-step14`), in parallel | 15 P3 → 14 P2 | **15-P1 before Task 3.4**; 15-P2, 15-P5, 15-P11 before the Phase 3 release note | 15 P3's rollback is a partial revert, not a plain one (§7). 14 P2 is web only |
| **11** | Wave 10 merged | step 14 Phase 3 (order status list) | 14 P3 | **14-P1 before Task 3.1** | One release for server and web, with `apps/web` built before deploy |

Wave 10's two phases have disjoint files: 15 P3 writes `lading.ts`, `cost-lines.ts`, `modules/audit/seed.ts`, `audit-review.test.ts`, `seed/*` and e2e specs; 14 P2 writes `order-form.tsx` and `order-readiness.tsx` [NEW].

**Step 12 Phase 2 is text, not code.** It edits `customer-intake-sop/sop.json` and `tracker/seed/flow-nct.json` in `C:/Project/ZYT-Task`, and it must wait until step 11 Phase 2 is **deployed**, because it describes the live app. It does not block any code wave.

**Step 12 Phase 3 is optional in scheduling, not in content.** D3-A is Decided, so it is taken; it rides with Phase 1 in the same worktree and the same PR because it edits the same two files. If Wave 6 has to be cut short, Phase 3 is the part that can slip to a later wave without breaking anything.

---

## 4. One-time setup

In your main `nct-layout` checkout, before a wave starts:

```bash
git fetch origin
git switch feat/new-layout
git pull --ff-only
```

Create a wave's worktrees **when that wave starts**, so each branches from the latest base.

```bash
# from the nct-layout folder

# Wave 5 reuses the worktree step 11 Phase 1 already used; create it only if it was removed
git worktree add ../wt-step11    -b feat/step11-convert-won-quote  origin/feat/new-layout

# Wave 6
git worktree add ../wt-step12    -b feat/step12-job-number         origin/feat/new-layout
git worktree add ../wt-step13-p2 -b feat/step13-intake-decisions   origin/feat/new-layout

# Wave 7 (kept through Waves 8 and 10)
git worktree add ../wt-step15    -b feat/step15-order-approval     origin/feat/new-layout

# Wave 9 (kept through Waves 10 and 11)
git worktree add ../wt-step14    -b feat/step14-job-shape          origin/feat/new-layout
```

Then run `bun install` inside **each** new worktree, and start `claude` there in its own terminal.

> A worktree is an extra folder on its own branch that shares one git history. Each Claude session gets its own folder, so no session can overwrite another's edits or sweep them into its commit.

`wt-step15` carries Phases 1, 2 and 3 across Waves 7, 8 and 10, and `wt-step14` carries Phases 1, 2 and 3 across Waves 9, 10 and 11. Each phase is its own branch commit range and its own PR; rebase between them (§6). Only one session commits in a worktree at a time: confirm the index is empty before `git add`.

**Before Wave 6 (X16).** The main `nct-layout` checkout has uncommitted edits under `e2e/` — `e2e/fixtures/seed-cli.ts`, `e2e/fixtures/types.ts`, `e2e/playwright.config.ts`, `e2e/qa-manifest.ts`, plus untracked `e2e/specs/intake.golden-path.spec.ts` and `e2e/reporters/step-events.ts`. **Wilfred commits or sets them aside himself.** No session stashes, resets or checks out anything, in any worktree, for any reason. Worktrees branch from committed history, so until he does, those edits are invisible to every session, and every §10 walk re-reads `ACTORS` in `e2e/fixtures/seed-cli.ts` by symbol at its own base commit rather than by line.

---

## 5. The prompt for each session

Paste one of these into the session in the matching worktree. They follow one template: read the plan and the crosscheck, name the phases, state that the decisions are settled, re-locate by symbol, prove it, and stop.

### Wave 5 — `wt-step11`

```text
Read C:/nct-plans/step-11-convert-won-quote.md in full, and C:/nct-plans/steps-12-15-crosscheck.md.
Phase 1 is already merged (it ran in Wave 1). Implement PHASE 2 then PHASE 3, in that order, in this worktree.
Decisions are settled (Wilfred, 2026-09-16: D1-B, D2-D9 A) — implement the Chosen option and do not re-open it.
Steps 04-10 are all merged, so every line number in the plan has moved: re-locate convertToOrder, the allocator
region, assignNumber and the architecture allow-list entries BY SYMBOL at HEAD, never by line.
Task 2.4 carries the widened re-stamp predicate from crosscheck X11 and step 12 D2-A: unbilled lines where
order_no = quotation_no OR order_no IS NULL, NULL-only when the order has no quotation_no, with locked-but-unbilled
lines included (D8-A). Write the three widened test cases the plan lists. Do not defer this to step 12.
Any conditional migration is named 00NN_<name> and takes the next free number at merge (X14) — under D3-A there is none.
Prove it with the plan's §10 before telling me it is done: the Phase 2 and Phase 3 test list, then the golden path
and edge cases 3 and 5 in the browser at localhost:3101. Never run git stash, git reset or git checkout.
```

### Wave 6 — `wt-step12`

```text
Read C:/nct-plans/step-12-job-number.md in full, and C:/nct-plans/steps-12-15-crosscheck.md.
Step 11 Phase 2 is merged. Implement PHASE 1 and PHASE 3. Do NOT do Phase 2: it is SOP text in the ZYT-Task repo.
Decisions are settled (Wilfred, 2026-09-17) — implement the Chosen option and do not re-open it.
Task 1.1 owns the .for("update") row lock on assignNumber (crosscheck X7). Steps 14 and 15 must find it already
there, so add it once and say so in the allow-list comment.
Task 1.2 is the FALLBACK ONLY: first confirm by symbol that step 11 Task 2.4 already carries the widened predicate
(X11). If it does, skip 1.2 and say so in the commit message.
Re-locate assignNumber, update and the allow-list entries BY SYMBOL at HEAD — step 11 moved about 130 lines in
collective-order.ts.
Task 1.4 creates collective-order.numbering.concurrency.test.ts. CI has no DATABASE_URL_TEST, so run it against the
dev Neon branch and paste BOTH outputs into the PR: the failing run on the pre-change code and the passing run after.
"Skipped" is not a pass. Never point anything at production.
Prove it with §10. Never run git stash, git reset or git checkout.
```

### Wave 6 — `wt-step13-p2`

```text
Read C:/nct-plans/step-13-intake-decisions.md in full, and C:/nct-plans/steps-12-15-crosscheck.md.
Phase 1 is already merged. Implement PHASE 2 ONLY: the intake guard, the new reopen verb and its permission node,
the dialog, the To Receive pane and row changes, and the e2e spec.
Decisions are settled (Wilfred, 2026-09-17: D1-A through D12-A) — implement the Chosen option and do not re-open it.
This branch merges AFTER step 12 Phase 1 in the same wave, so rebase on it and re-locate receive, reject and the
architecture allow-list entries BY SYMBOL at HEAD. Your new allow-list entry neighbours the one step 15 later removes.
modules/collective-order/permissions.ts is also written by step 15 Task 2.1; run permissions/registry.sync.test.ts
after every rebase.
The collectiveOrder.reopen permission_node row is an owner-run INSERT, not a migration and not seed code. Ask me to
run it on dev BEFORE the §10 Phase 2 proof, and do not run it yourself without my yes.
Task 2.3's collective-order.intake.concurrency.test.ts is step 13's own file — do not touch
collective-order.concurrency.test.ts, which belongs to step 15 (X8). Paste the pre-change failing run and the passing
run into the PR; CI skips it.
Prove it with §10. Never run git stash, git reset or git checkout.
```

### Wave 6 — SOP text (session in `C:/Project/ZYT-Task`, not the code repo)

```text
Read C:/nct-plans/step-12-job-number.md in full. Implement PHASE 2 ONLY (Tasks 2.1-2.3): the SOP text for step 12,
the step 11 result line, the break entry, the unnumbered finding, the two factual corrections in step 15's fixes[0],
and the tracker seed title/summary. Files: C:/Project/ZYT-Task/customer-intake-sop/sop.json and
C:/Project/ZYT-Task/tracker/seed/flow-nct.json. Touch no other file and no code repo.
D6-A is settled: step 12 becomes "Check the job number", not a required press.
Step 11 Phase 2 is deployed, so re-locate every `src` reference by symbol in the merged code before quoting a line.
SOP text for steps 14 and 15 is an accepted unowned gap (X13) — do not take it on here.
Confirm sop.json still parses. Hand me the rebuild and deploy step; the site is public and you do not deploy it.
```

### Wave 7 — `wt-step15`

```text
Read C:/nct-plans/step-15-order-approval-integrity.md in full, and C:/nct-plans/steps-12-15-crosscheck.md.
Implement PHASE 1 ONLY. Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-17: D17-B, D1-A, D2-B, D3-A, D10-A, D12-A, D16-B and the rest) — implement
the Chosen option and do not re-open it.
Crosscheck X6: STEP 15 OWNS the order under-review freeze and the submit lock. §4.1 "Operative spec (D17-B)" governs
Tasks 1.2-1.4: the full seven-writer freeze from day one, saveChildren conditional on content arrays (D2-B leaves the
fee grid alone), updateBatch loaded in id order, and .for("update") on REVIEWABLE_RESOURCES.collective_order.exists
unconditionally. Step 14 adds no guard and no lock there.
Crosscheck X7: step 12 Task 1.1 already added .for("update") to assignNumber. Grep the handler and do NOT add a
second lock; add only assertNotUnderReview, after the has-number CONFLICT and before assertPostApprovalEditable.
Task 1.4 CREATES packages/api/src/routers/collective-order.under-review.test.ts and
packages/api/src/routers/collective-order.concurrency.test.ts (X8). Step 14 will later add a describe to each.
Do not write the freeze cases into collective-order.guards.test.ts.
Steps 08, 10 Task 1.2, 11 Phase 2 and 12 Phase 1 are merged: re-locate every anchor in collective-order.ts,
resources.ts, gates.ts, post-approval.ts, submit.ts, seed.ts, architecture.test.ts and collective-order.guards.test.ts
BY SYMBOL at HEAD. Every line number in the plan has moved.
CI has no DATABASE_URL_TEST: run the concurrency test against the dev Neon branch, paste the failing pre-lock run and
the passing run into the PR, and never point it at production.
Prove it with §10 (Journey 1 in the browser, plus edge cases 2, 3 and 4). Never run git stash, git reset or git checkout.
```

### Wave 8 — `wt-step15` (rebase first, see §6)

```text
Read C:/nct-plans/step-15-order-approval-integrity.md. Phase 1 is merged.
Implement PHASE 2 ONLY: delete collectiveOrder.review and reviewBatch with their allow-list entries and imports,
drop isEndpoint on COLLECTIVE_ORDER.review with the D9-A comment, set separationOfDuties: true on the
collective_order resource, rewrite the tests the deletion breaks, and add the drift report script (Task 2.4).
Decisions are settled (D4-A, D8-A, D9-A, D13-A) — implement the Chosen option and do not re-open it.
Step 08 Task 3.3 is the precedent for dropping isEndpoint (crosscheck X10); follow it, do not redesign it.
Re-locate the procedures, the allow-list entries and the permissions block BY SYMBOL at HEAD; step 13 Phase 2 added a
neighbouring allow-list entry and a reopen node in the same permissions file.
Run the drift report read-only on the dev branch and paste its counts into the PR. Production needs my override; do
not run it there.
Prove it with §10 Journey 2, including the /rpc/collectiveOrder/review 404 and the self-decision refusal.
Never run git stash, git reset or git checkout.
```

### Wave 9 — `wt-step14`

```text
Read C:/nct-plans/step-14-job-shape.md in full, and C:/nct-plans/steps-12-15-crosscheck.md.
Implement PHASE 1 ONLY. Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-17: D1-A through D15-A) — implement the Chosen option and do not re-open it.
Crosscheck X9 / D10-A: implement step 07's existing ReviewableResource.assertPublishable hook on the collective_order
entry, throwing CONFLICT with readinessMessage(...). Add NO new interface member and NO submit.ts change. Before you
start, grep the base commit for assertPublishable; if it is not there, stop and tell me.
Crosscheck X6 / D5-C: step 15 Phase 1 already owns the under-review freeze and the .for("update") on
collective_order.exists. Grep for assertNotUnderReview in collective-order.ts, for the lock inside the exists entry,
and for collective-order.concurrency.test.ts; if any is missing, stop — the prerequisite has not landed. Add no guard
and no lock of your own. Your readiness reads are plain org-keyed reads.
Crosscheck X8 / D11-A: collective-order.concurrency.test.ts already exists. ADD a "submit vs clear vessel" describe to
it and drop any [NEW] tag; do not create the file.
Task 1.3 edits seed/operations.ts. Step 14 Phase 1 merges before step 15 Phase 3 for that reason (X12).
Re-locate collective-order.ts, submit.ts and resources.ts BY SYMBOL at HEAD; six plans have moved every line.
CI has no DATABASE_URL_TEST: run the concurrency test on the dev Neon branch and paste the output into the PR; a
skipped run is not a pass.
Prove it with §10 Phase 1: the test list, the operations seeder printing "collective_order submitted 6" and exiting 0,
the three e2e specs, and the golden path plus edge cases 1 and 3 in the browser.
Never run git stash, git reset or git checkout.
```

### Wave 10 — `wt-step15` (rebase first; merges before 14 P2)

```text
Read C:/nct-plans/step-15-order-approval-integrity.md. Phases 1 and 2 are merged, and step 14 Phase 1 is merged.
Implement PHASE 3 ONLY: the create_lading gate, the lading.create/lading.update gate calls, the costLines.create
expense_entry call, the four seeded order gates, the tests, the e2e fixes and the operations seeder change.
Decisions are settled (D5-A, D6-A, D7-A) — implement the Chosen option and do not re-open it.
Step 14 Phase 1 already changed seed/operations.ts (X12): your Task 3.7 acceptance run uses the post-14 seeder, which
submits six complete orders, and it must run against an org CREATED AFTER this phase, on the dev branch only.
Fix any e2e spec that links a B/L to an unapproved order by approving the order in its setup — never by unticking the
gate.
Re-locate every anchor BY SYMBOL at HEAD.
A rollback of this phase is a PARTIAL revert (§8 of the plan), because the audit_flow_gate rows it writes would make
the Order review flow unsaveable. Do not plan a plain revert, and tell me before any rollback.
Prove it with §10 Journey 3 and Journey 4 plus edge case 1. Never run git stash, git reset or git checkout.
```

### Wave 10 — `wt-step14` (rebase first; merges after 15 P3)

```text
Read C:/nct-plans/step-14-job-shape.md. Phase 1 is merged.
Implement PHASE 2 ONLY: order-readiness.tsx [NEW] with its test, the panel wired into order-form.tsx above the rail,
the rail dot, and the containers label fix. onSave is unchanged — saving an incomplete order must still succeed.
Decisions are settled (D9-A) — implement the Chosen option and do not re-open it.
Step 15 Phase 1 put an under-review notice in the same file. Keep that notice ABOVE your Before-review panel, and
re-locate both by symbol at HEAD.
This phase is web only. Prove it with §10 Phase 2: the test list, plus the golden path and edge case in the browser.
Never run git stash, git reset or git checkout.
```

### Wave 11 — `wt-step14` (rebase first)

```text
Read C:/nct-plans/step-14-job-shape.md. Phases 1 and 2 are merged.
Implement PHASE 3 ONLY: order-status.ts [NEW] with its tests, handler validation on create/update/updateBatch, the
eq/ilike split in buildOrderConditions, the web select, and the nine ledger configs.
Decisions are settled (D3-A, D4-A, D13-A, D14-A, D15-A) — implement the Chosen option and do not re-open it. A stored
legacy value stays valid and is shown as "<text> (old value)"; it is never rewritten.
Re-locate the handlers, buildOrderConditions, the orderFields.status comment and every config filter BY SYMBOL at
HEAD. The nine line numbers in Task 3.4 were read at 6bb3a1bf and will all have moved.
Server and web ship in one release (D15-A), with apps/web built before deploy.
Prove it with §10 Phase 3: the test list including the nine order-ledger-parity tests, then the golden path and both
edge cases in the browser. Never run git stash, git reset or git checkout.
```

> If the session has the `/execute` skill, `/execute C:/nct-plans/step-1N-….md` works too. Tell it the phases in the same words, and repeat the "decisions are settled" and "re-locate by symbol" lines.

---

## 6. Keeping a branch up to date

Before a branch's PR is merged, bring it up to date with whatever merged ahead of it. Do this inside its worktree:

```bash
git fetch origin
git rebase origin/feat/new-layout
bun install
bun run check-types
git push --force-with-lease
```

Do the same **between phases in a shared worktree** (`wt-step15` at Waves 7 → 8 → 10, `wt-step14` at Waves 9 → 10 → 11): rebase onto the base that now contains the merged earlier phase, and start the next phase's session only after `bun run check-types` is clean.

**If the rebase stops on a conflict:** resolve it by hand, `git add <file>`, then `git rebase --continue`. If you're unsure which side is right, `git rebase --abort` puts the branch back exactly as it was. Then ask.

**Never use `git stash`, `git reset` or `git checkout -- <path>`**, in any session, for any reason. The stash stack is shared by every worktree and every session on the machine, and the main checkout has uncommitted `e2e/` work of Wilfred's (§4).

After every rebase, re-run `packages/api/src/architecture.test.ts`: allow-list comments collide even when the entries do not, and the stale-entry rule fails in both directions.

---

## 7. Migrations: numbers are assigned at merge

**Under the settled options, no phase in Waves 5–11 adds a migration.** The plans still carry conditional ones, and none of their options was chosen:

| Plan | Conditional migration | State |
|---|---|---|
| 11 | `0075_collective_order_quotation_uq` under D3-B/C | Dead; D3-A was chosen |
| 12 | job-number trim index under D3-B | Dead; D3-A was chosen |
| 13 | `00NN_collective_order_intake_actor` under D3-B/C | Dead; D3-A was chosen |
| 14 | status CHECK (D3-B), fleet columns (D6-C), `audit_flow.require_complete` (D8-B) | Dead; A options were chosen |
| 15 | `00NN_audit_submission_content_hash` under D11-B | Dead; D11-A was chosen |

**Rule (X14): if a migration is ever revived, it is written `00NN_<name>` and takes the next free number at the moment its branch is rebased for merge**, exactly as `steps-4-10-runbook.md` §6 describes. It never keeps a number a plan wrote down. A step that picks a migrating option becomes the only migrating step in its wave.

Two owner-run database writes in this track are **not** migrations, and no session runs either without Wilfred's explicit yes:

- **Step 13 Phase 2** needs a `permission_node` row for `collectiveOrder.reopen`. `db:seed-nodes` is in no pipeline and cannot run under bun, so the row goes in by the reviewed `INSERT … SELECT … FROM permission_node WHERE key = 'collectiveOrder.receive' ON CONFLICT DO NOTHING` in the plan's §7 — on dev before the Phase 2 proof, on production after the deploy and before any grant found by probe 13-P8. Root holders reach the node through their ancestor grant with or without the row; the row is only needed to **grant** it to a custom role or member. Confirm afterwards with the read-only `SELECT key, parent_key, is_endpoint …` check.
- **Step 15 Phase 3** writes `audit_flow_gate` rows with `create_lading`. A full revert of that phase leaves those orgs' Order review flow unsaveable. Use the plan's §8 partial revert or its owner-run delete.

Before each phase, confirm the journal still ends where the merged steps left it, by reading `packages/db/src/migrations/meta/_journal.json` **and** the migrations table — never by a command's exit code.

---

## 8. Stop gates: owner only

Every probe is a read-only `SELECT` against production, and **Wilfred runs all of them with the owner's override.** No session connects to production, ever. The full SQL lives in each plan's §7 (step 15's is §7.7).

**Run the probes for a wave before the code is written, not before the merge.** Several of them gate a specific task, and a probe that contradicts its decision stops that task for a re-plan rather than being argued away.

| Wave | Probe | Question | Gates |
|---|---|---|---|
| 5 | 11-P1 | Orders already minted from Lost quotations | D9-A report; sizes the damage already done |
| 5 | 11-P2 | Conversions grouped by the status they started from | D1 sizing |
| 5 | 11-P3 | Quotations with more than one order | D3; every hit must be explained by a `duplicate` audit row |
| 5 | 11-P5 | Fee lines whose quantity × unit price ≠ total | D8 sizing (Phase 3) |
| 5 | **12-P3** | Cost lines whose `order_no` disagrees with their numbered order | **Replaces 11-P4** (X11). Also feeds 12 D2 |
| 5 | 12-P10 | Locked-but-unbilled lines on blank orders | 12 D8 / step 11 Task 2.4's predicate (X11) |
| 6 | 12-P2 | Untrimmed or whitespace-only `job_number` | Before 12 Task 3.1 (D3) |
| 6 | 12-P5, 12-P5b | More than one `assignNumber` row per order; an assigned value the order no longer holds | 12 D1; sizes the live double-press race |
| 6 | 12-P6, 12-P7 | Job numbers cleared or changed through `update`; ladings whose `order_no` resolves to no order | Before 12 Task 2.1 (D4) |
| 6 | 12-P9 | `job` sequence configuration per org | Before 12 Task 2.1 (D7); also feeds 14 D2 |
| 6 | **13-P8** | Custom roles and member overrides holding receive/reject as leaves | **Run before the 13 Phase 2 deploy**, then grant `reopen`. Needs the `permission_node` row first (§7) |
| 6 | 13-P3, 13-P4 | Rejected orders carrying cost lines; unaccepted orders carrying cost lines | Size the X13 accepted gap; feed the release note |
| 6 | 13-P7 | Share of rejections with no reason | 13 D8 |
| 6 | 13-chk | The `collectiveOrder.reopen` `permission_node` row exists | Read-only check after the owner-run INSERT |
| 7 | **15-P13** | Child saves after approval under a locked flow | **Before 15 Task 1.2** (D3-A) |
| 7 | **15-P6** | Fees and billed lines on unapproved orders | **Before 15 Task 1.2** (D2-B) |
| 7 | **15-P10** | Approved orders with no job number under a locked flow | **Before 15 Task 1.2** (D16-B). Related to 12-P1 |
| 7 | 15-P2 | Live orders by latest submission | The under-review count frozen on the 15 P1 deploy |
| 7 | 15-P7 | Edits landed during an open submission | Finding A exposure. Same question as 14-P7, which also covers delete and batch |
| 8 | **15-P4** | Legacy verb use, and self-approval through it | **Before 15 Task 2.1** (D4-A). Same as 14-P11's first query |
| 8 | **15-P1** | Order flow per org: enabled, post-approval, gates, reviewers | **Before 15 Task 2.2** (D8-A) |
| 8 | **15-P12** | Who submits orders, by role | **Before 15 Task 2.2** (D8-A) |
| 9 | **14-P3** | Share of live orders missing each proposed required field, per trade | **Before 14 Task 1.1** (D2-A). Also sizes X9 |
| 9 | **14-P4** | Orders with no container or cargo lines | **Before 14 Task 1.1** (D2-A) |
| 9 | **14-P5** | Review cache state × missing client or job number | **Before 14 Task 1.2** per the plan; the crosscheck says Task 1.1 (§12) |
| 9 | 14-P6 | Latest submission vs `order_audit_status` | 14 D5 / X9. Same as 15-P2 + 15-P3 |
| 10 | **15-P1** | Ticked gates per org | **Before 15 Task 3.4** (D5-A). Second run of the Wave 8 probe |
| 10 | 15-P2, 15-P5, 15-P11 | Live orders by submission; B/Ls linked to unapproved orders; orders locked, ended or shut out without approval | **Before the Phase 3 release note** (D6-A). Not code gates |
| 11 | **14-P1** | Distinct free-text `status` values per trade | **Before 14 Task 3.1** (D3-A, D4-A). Blocks Phase 3 |
| 11 | 14-P8 | Has `updateBatch` ever run, and did it write status | 14 Task 3.2 |
| any | 15-rb | `audit_flow_gate` rows with `create_lading`, per org | Only on a 15 P3 rollback (§7) |

**Duplicates — run once, report under both ids.** 12-P3 replaces 11-P4. 12-P8 is a subset of 15-P7. 14-P6 equals 15-P2 plus 15-P3. 14-P7 equals 15-P7 (15's version also covers delete and batch actions). 14-P11's first query equals 15-P4. 15-P10 is related to 12-P1. Do not ask Wilfred for the same reading twice in one wave.

**Sizing probes that gate nothing** (11-P2, 12-P1, 12-P4, 13-P1, 13-P2, 13-P5, 13-P6, 14-P2, 14-P9, 14-P10, 15-P3, 15-P8, 15-P9) can be run at any point in their wave. They belong in the PR description and the release note, not in front of the code.

Message template, one per wave:

```text
Wave <N> (<step and phases>) is ready to start. Before any code, can you run these read-only production
probes with the owner's override and send me the counts?

  <id> — <one-line question> — from <plan file> §7
  <id> — <one-line question> — from <plan file> §7

<id> gates <task>: if it contradicts <decision>, I stop and we re-plan rather than work around it.
Nothing here writes; they are SELECTs only. I will not run anything against production myself.
```

**Deploying is separate from merging, and is Wilfred's call.** The per-wave deploy notes are in §3: server before web in Waves 5, 6 and 7; API only in Wave 8; server and e2e fixtures together in Wave 9; one release with `apps/web` built first in Wave 11.

---

## 9. Checklist before each PR

Run inside the worktree once its session says it is done:

- [ ] `bun run check-types`: **read the output.** It can exit 0 while printing "failed". Confirm `apps/web` and `seed` actually ran.
- [ ] `bun run test`, and the phase's own test command from the plan's §10: read each output for `failed`, not the exit code.
- [ ] If the phase touched `packages/api`: `packages/api/src/architecture.test.ts` passes. A green from the **web** architecture test is a different gate. Re-run it after every rebase.
- [ ] If the phase touched permissions: `permissions/registry.sync.test.ts` and `permissions/reachability.test.ts` pass.
- [ ] **Real-Postgres concurrency tests: paste the output into the PR (X8).** CI has no `DATABASE_URL_TEST`, so these never run there and a `skipped` line is **not** a pass. Each PR that owns one shows two pasted runs against the **dev Neon branch**: the failing run on the pre-change code, and the passing run after. This applies to `collective-order.numbering.concurrency.test.ts` (step 12), `collective-order.intake.concurrency.test.ts` (step 13), and `collective-order.concurrency.test.ts` (created by step 15, extended by step 14).
- [ ] Migrations: none is expected in this track (§7). If one was revived, it is named `00NN_<name>`, took the next free number at rebase, and `bunx vp test run packages/db/src/migrations.test.ts` passes.
- [ ] The plan's §10 walked in the browser at `localhost:3101`, **one worktree's dev servers at a time** (§10).
- [ ] Every hunk read in `git diff origin/feat/new-layout...HEAD`, not just the file list.
- [ ] Commit, push, open the PR:

```bash
git add -A
git commit -m "fix(order): <what> (SOP step 1N phase N)"
git push -u origin <branch>
gh pr create --base feat/new-layout --fill
```

Then ask Wilfred to merge, **in the order in §3**.

**Close the loop.** After each merge, tick the fixed defects on the SOP page (*When a Customer Comes In*) under the step's *What to fix first*, and paste the PR link as a comment.

---

## 10. Traps in this repo

| What you see | Why | Do this |
|---|---|---|
| The browser shows another step's changes | Every worktree's app wants `:3101` (web) and `:3000` (API) | Stop every dev server, then start only the worktree you're checking |
| An API change "doesn't work" but returns 200 | `bun --hot` doesn't reload `packages/api` changes | Restart the API server before any browser check |
| Type-check "passed" but the log says failed | `vp run` exit codes lie | Grep the output for `failed` and `error TS` |
| A concurrency test reports `skipped` and the PR calls it green | `DATABASE_URL_TEST` is set in no workflow, so CI always skips these | Run it locally against the dev Neon branch and paste both runs (X8) |
| A PGlite lock test passes on the old code too | PGlite is one connection: any second query waits on an open transaction whether or not `FOR UPDATE` was taken | Don't write that test. Prove locks on real Postgres, or mark it `it.skip` with the reason |
| A concurrency test judged by `submitted_at` vs `created_at` | Both are `defaultNow()`, i.e. transaction start, so a correctly serialised write can carry the earlier stamp | Judge by the HTTP result and the final row state, never by timestamps |
| The e2e fixtures look different from the plan | The main checkout has uncommitted `e2e/` edits (X16) | Wilfred commits or sets them aside before Wave 6. Never stash, reset or checkout. Re-read `ACTORS` by symbol at your base commit |
| Every line number in the plan is wrong | Six plans rewrite the same router; step 11 Phase 2 alone moves ~130 lines | Re-locate by symbol at HEAD. The plans' line numbers were read at `6bb3a1bf` and are historical |
| The architecture test fails right after a correct change | The stale-entry rule fires in both directions | Commit the allow-list key change in the same commit as its code, and re-run after every rebase |
| Two plans both add a row lock to `assignNumber` | Steps 12, 14 and 15 all planned one | Step 12 Task 1.1 owns it (X7). Grep the handler; add only what is missing |
| Two plans both want `collective-order.concurrency.test.ts` | Steps 14 and 15 both named it [NEW] | Step 15 creates it; step 14 adds a `describe` (X8) |
| A parity e2e spec suddenly counts the wrong number of rows | The parity suite runs serially on one shared org with exactly five seeded unaccepted orders | Step 13 Phase 2's new spec creates and deletes its own order per test; never decide a seeded row |
| The operations seeder starts failing after a merge | Step 14 Phase 1 adds required fields, and step 15 Phase 3 adds the B/L gate | 14 P1 merges before 15 P3 (X12), and 15 Task 3.7's acceptance run uses an org created after Phase 3 |
| A rejected order still edits in its trade ledger | Accepted unowned gap (X13) | Say so plainly in step 13 Phase 2's release note: "Rejected" is an intake record, not a freeze |
| The session can't find the plan | Plans aren't in git | Give it the absolute path to your downloaded copy under `C:/nct-plans/` |

**Accepted gaps, stated plainly (X13).** Wilfred accepted these as unowned; no plan in steps 11–15 closes them, and no session should invent a fix:

- **Submit-time order state.** Nothing refuses a submission of an archived, not-yet-received or rejected order. Step 14 Phase 1 does **not** add accept-status checks; whether it later becomes a follow-up task or a readiness row on the X9 hook is Wilfred's call, out of scope here.
- **Rejection is advisory in the ledgers.** A rejected order still shows and edits in its trade ledger (13 D4-A). Step 13 Phase 2's release note must say so.
- **SOP text for steps 14 and 15.** Step 14 says its card "should gain a line" and step 15 rewrites nothing, and neither has a task. Step 12 Phase 2 corrects only step 15's two factual errors and does not take the rest on.

---

## 11. Clean up

Only once a branch is merged **and** `git status` in its worktree is clean:

```bash
# from the nct-layout folder
git worktree remove ../wt-step13-p2
git branch -d feat/step13-intake-decisions
```

Keep, until their last phase has merged:

- **`wt-step11`** — through Wave 5 (Phases 2 and 3).
- **`wt-step12`** — through Wave 6. Phase 2 is text in the ZYT-Task repo and needs no worktree.
- **`wt-step15`** — through Wave 10 (Phase 3). Do not remove it after Wave 7 or Wave 8.
- **`wt-step14`** — through Wave 11 (Phase 3). Do not remove it after Wave 9 or Wave 10.

`wt-step13-p1` can go as soon as step 13 Phase 1 has merged; Phase 2 uses its own worktree.

---

## 12. Where the plans and the crosscheck disagree

These are the places where `steps-12-15-crosscheck.md` and a plan do not say the same thing. None of them changes a settled decision. Where a wave depends on one, the runbook has said which reading it used; the rest are recorded so nobody silently picks.

| Subject | Crosscheck says | The plan says | Reading used here |
|---|---|---|---|
| Readiness scores | 11: 7 · 12: 9 · 13: 8 · 14: 7 · 15: 7 | 11: 7/10 · 12: 9/10 · **13: 9/10** · **14: 8/10** · **15: 8/10** | The plans'. The crosscheck's table is explicitly "the state as of 2026-09-17 morning", before the decisions were settled; the plans were re-scored afterwards. §0 shows both |
| Open decisions per step | A column of blocking decisions per step (12: D1/D2/D6, 13: eight, 14: nine, 15: D1–D10) | Every decision Decided or Chosen | The plans'. The crosscheck itself says that column is a morning snapshot kept for the record, and that Wilfred settled all of them the same day. The "Before starting" column of its §6 wave table carries the same stale decision ids; treat those entries as **probe re-checks only** |
| Step 15's label for the freeze-ownership decision | "step 15's own 'X1' label takes option B and is **renamed X6**" | The plan uses **D17-B** throughout (§4.7, §5, §7.6, §9) | **D17-B.** The rename to X6 was never applied; the crosscheck's X6 is the cross-plan item, D17 is step 15's own register entry. They are the same decision under two labels |
| The X6 text fixes "owed" in steps 12, 13, 14, 15 | Lists them as still owed (Wilfred's edits, not made in the crosscheck) | 12 §7 and D5-A, 13 §5 and §7, 14 D5-C and 15 D17-B all already carry the settlement | Already carried. Sessions should still read what is in front of them and stop if a plan contradicts X6 |
| X12's correction to step 14 §7 | "step 14's §7 'no other plan edits it' row is corrected to name 13 Task 2.6 and 15 Task 3.7 — that correction is owed" | Step 14 §7's `seed/operations.ts` row already names 13 Task 2.6 and 15 Task 3.7 and cites X12 | Already carried |
| Which task probe **14-P5** gates | "Blocks Task 14.1.1" | §5 blocking prerequisites: "P3 and P4 plus operations input before Task 1.1 (D2), **P5 before Task 1.2** (D8)" | Run all three (14-P3, 14-P4, 14-P5) before Task 1.1. That satisfies both readings and costs one reading |
| X9's placement line in the step 07 prompt | X9 requires the steps 4–10 runbook's Wave 3 `wt-step07` prompt to gain a line: call `assertPublishable` **after** the open-attempt check and before the stage lookup | `steps-4-10-runbook.md` §4's Wave 3 prompt does **not** contain that line | **Unresolved — tell Wilfred.** X15's edits were applied to that runbook; X9's and X10's were not. If step 07 has already merged without the placement, step 14 Wave 9 must check where the hook is called before writing Task 1.2 |
| X10's `isEndpoint` line in the step 08 prompt | X10 requires the Wave 2 `wt-step08` prompt to say that Task 3.3 drops `isEndpoint: true` on `QUOTATION.review` and `QUOTATION.feeTemplateReview` | The step 08 **plan** already carries the edit (added 2026-09-17 under Task 3.3 and §9); the Wave 2 **prompt** in `steps-4-10-runbook.md` does not mention it | **Low risk, but tell Wilfred.** The plan carries it, so a session reading the plan will do it; the prompt is the weaker path. Step 15 Wave 8 follows this precedent and must not redefine it |
| Step 13 §7 on `modules/collective-order/permissions.ts` | "13 §7 says ' 13 only', which is wrong" — step 15 Task 2.1 also writes it | Step 13 §7's collision table now names both 13 Task 2.2 and 15 Task 2.1 and says the earlier "13 only" was wrong | Already corrected in the plan |

---

## 13. Not covered here

- **Steps 01–10.** `steps-1-3-runbook.md` and `steps-4-10-runbook.md`. Step 11 Phase 1 and step 13 Phase 1 live in the latter's Wave 1 (§1 above).
- **Step 12 Phase 2's deployment.** The SOP site is public; Wilfred rebuilds and deploys it from `hosting/`. A session hands him the step and does not run it.
- **The three accepted unowned gaps (X13)**, listed at the end of §10: submit-time order state, rejection staying advisory in the ledgers, and SOP text for steps 14 and 15. None is assigned to a wave here.
- **Steps 16–19** (bill of lading through the demurrage clock) are [`steps-16-19-runbook.md`](/nct/steps-16-19-runbook/), Waves 12–16, planned 2026-09-21. Step 15 Phase 3 adds gate calls in `routers/lading.ts` that those plans keep. Step 14's haulage probes 14-P9 and 14-P10 land in step 19; nothing in Waves 5–11 uses them.
- **Steps 20–27** (fees through month close) are [`steps-20-26-runbook.md`](/nct/steps-20-26-runbook/) (Waves 17–21) and [`step-27-runbook.md`](/nct/step-27-runbook/) (Waves 22–23).
- **Production access of any kind.** Every probe, every grant and every deploy is Wilfred's. Sessions work against the dev Neon branch, and never against `br-round-sun`.
