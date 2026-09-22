# Steps 16–19 Runbook: from plan to merged code

**For:** whoever implements SOP steps 16–19 (raise the bill of lading → move it through its states → approve the carrier's MBL/HBL → watch the demurrage clock)
**Written:** 2026-09-21 · **Base branch:** `feat/new-layout`, evidence HEAD `6bb3a1bf` · **Repo:** `nct-layout`
**Plan owner:** Wilfred. He merges the PRs, deploys, and runs anything that touches production.
**Readiness:** 16: 7/10 · 17: 7/10 · 18: 7/10 · 19: 7/10 (the plans' own scores). Every decision settled 2026-09-21.

This is how to turn the four /planpro plans for steps 16–19 into merged code. It covers **Waves 12 to 16**, which continue the numbering of `steps-11-15-runbook.md` (Waves 5–11) and `steps-4-10-runbook.md` (Waves 1–4).

Each wave runs in its own git worktree, one Claude Code session per worktree, and no two sessions edit the same code at the same time.

**Every decision across steps 16–19 is settled.** On **2026-09-21** Wilfred settled the four plans' decisions and the cross-plan items X17–X27, taking the recommended option in every case with no exception. Where a settled X-item overrides a plan's own recommendation, the X-item wins: **step 17 D2 is B (per X17)** and **step 17 D8 is superseded by step 16 D1 (per X18)**. Each plan's §9 says which option is **Chosen** / **Decided**, and §1 records them. Sessions implement that option and do not re-open it.

---

## 0. What you are building

| Step | Plan file | What it fixes | Phases | Migration | Readiness |
|---|---|---|---|---|---|
| 16 | [`step-16-lading-create.md`](/nct/step-16-plan/) | A B/L's status and review badge can be typed (Released / On-hold / Approved); saving a held bill corrupts its base status; it stays editable under review; a typed job number links it to another branch's money; the job has no route to its bill; OCR hides its own validation errors | 3 | none (D2-C alone would add `00NN_lading_state_repair`; not recommended) | 7/10 |
| 17 | [`step-17-lading-states-and-review.md`](/nct/step-17-plan/) | No screen can send a bill for review, so Shipment review is empty and a ticked lading gate freezes that verb for ever; a state move can apply twice; two uploads can lose a scan; a held bill can be checked out; Hold never records a reason | 2 | none | 7/10 |
| 18 | [`step-18-bl-document-approval.md`](/nct/step-18-plan/) | The web link control sends only `quote` and there is no unlink, so B/Ls cannot be filed against orders or ladings; a mis-typed B/L cannot be re-typed at review and silently starts no tracking; validation errors are never explained; the B/L intake is non-atomic and can race into duplicate tracking jobs; a thrown hook reads as success | 3 | none (conditional `00NN_bl_job_open_bl_number_uidx` under D7-B, `00NN_document_link_created_by_set_null` under D11-B) | 7/10 |
| 19 | [`step-19-demurrage-clock-reach.md`](/nct/step-19-plan/) | Missing MYCIEDS/SBCP logins make the board silently dead (no berth, no deadline, no alert); the order's Documents card never renders and its payload has no deadline or job id; a tracking job has no path back to its order and fees | 3 | none (conditional `00NN_bl_number_normalise` under D4-C, `00NN_bl_job_order_link` under D6-C) | 7/10 |

Every plan is also a page on this site — the file names above link to them.

<a class="rb-dl" href="/nct/downloads/all-plans.zip" download>⤓ Download all plans <small>every plan and crosscheck in the plans folder, plus the runbooks</small></a>

The smaller [steps-16-19-plans.zip](/nct/downloads/steps-16-19-plans.zip) in *Get the files* holds only what this runbook needs.

Under the settled options **no wave in this runbook migrates**. The conditional migrations are listed in §7; none of their options was chosen.

Also read **[`steps-16-19-crosscheck.md`](/nct/steps-16-19-crosscheck/)**. It records how the four plans depend on each other and on steps 04–15, the eleven cross-plan items X17–X27 (all **Settled** 2026-09-21), and it is the source of the wave order in §3.

### Get the files

**Download everything this runbook needs:** [steps-16-19-plans.zip](/nct/downloads/steps-16-19-plans.zip) — this page's markdown plus the four step plans (16-19) and `steps-16-19-crosscheck.md`. Unzip it to `C:/nct-plans/`; the prompts below use that path, so change them if yours differs. The zip is rebuilt on every site deploy, so re-download it if the pages have changed since — in particular if you took it before the decisions were settled on 2026-09-21, because the prompts rely on the **Chosen** option in each plan's §9.

The plans are **not in git**, so the zip (or the folder `C:\Project\ZYT-Task\plans\` from Wilfred) is the only way to get them.

The code repo `C:/Project/NCT/nct-layout` is the only place code changes, and only inside a worktree of it.

---

## 1. Before any wave starts: settle these decisions

**Settled 2026-09-21. This section is now the record of what was settled; the heading is kept because it is a page anchor.** Wilfred accepted the recommended option of every decision in the four plans and the recommended reading of every cross-plan item X17–X27, with no exception. Where a settled X-item and a plan's own recommendation disagreed, the X-item won (two places, both in step 17: D2 and D8). Each plan's §9 marks the option **Chosen** / **Decided**; each X-item in the crosscheck carries a **Settled** line. Every text fix the settlements needed has been applied in the plans. Sessions implement the Chosen option and do not re-open it.

The X17–X22 group was the only blocker in this track: steps 16 and 17 were written in parallel and both rebuilt `lading.update`. It is settled as proposed: step 16 owns the handler, and all of step 16 merges before step 17.

The "Needed by" columns are kept for the record: they now say which wave implements each choice. The probes in §8 still re-check several of them.

### Cross-plan items (crosscheck §4)

| Item | Question | Settled (2026-09-21) | Needed by |
|---|---|---|---|
| **X17** | Who owns the `lading.update` under-review freeze, the `FOR UPDATE` load, the in-transaction guards, and the `lading.exists` lock (16 Task 1.2 vs 17 Task 1.1–1.2)? | **Step 16 Phase 1** owns it; step 17 takes D2-B and adds none | Wave 12 (16 P1) |
| **X18** | Which statuses may be typed (16 D1: draft/confirmed/cancelled vs 17 D8: everything but on-hold/amended), and must an unchanged status be ignored? | **16 D1-A governs**; 17 D8 superseded; the echo rule is mandatory | Wave 12 (16 P1) |
| **X19** | Who removes the Audit Status field (16 D3 in Phase 1, 17 D4 in Phase 2)? | **Step 16 Phase 1**; 17 D4 settled the same way (A) and its part dropped | Wave 12 |
| **X20** | Who creates `lading.concurrency.test.ts` (both said [NEW]) and where do the under-review cases live? | **16 P1 creates it and `lading.under-review.test.ts`**; 17 adds `describe`s to both | Wave 12 |
| **X21** | Attachments under review: 16 D4-A "stay writable" vs 17 D3-B "freeze delete" | **17 D3-B governs attachments**; 16 D4 covers `lading.update` only | Wave 15 |
| **X22** | Refusal order on `lading.update` (status before or after the review guards)? | **Step 16's order** (§4.9 of its plan) | Wave 12 |
| **X23** | Who reshapes the order `documents` payload (18 D3 = 19 D1)? | **A in both: step 19 Task 2.2**; 18 P1 merges and deploys before 19 P2 | Wave 12 (18 P1), Wave 13 (19 P2) |
| **X24** | Intake dedupe compares raw BL numbers; step 19 compares normalised | **Accepted known gap**, not assigned; any follow-up is outside these plans | Wave 13 |
| **X25** | Two drift scripts with one duplicated query | **Keep both; 17's drops 17-P3** (= 16-P3) | Wave 16 |
| **X26** | Conditional migration placeholders | **`00NN_<name>`, numbered at merge** (the X14 rule); no migrating option was chosen | any wave that revives one |
| **X27** | Nobody owns the SOP text for steps 16–19 | **Accepted unowned gap** on the X13 terms; a `/zyt-update` pass stays Wilfred's option, not scheduled | after deploys |

### Step 16 (`step-16-lading-create.md` §9)

| Dn | Question | Chosen | Needed by |
|---|---|---|---|
| D1 | Which statuses may a person set by hand? | A: `draft`, `confirmed`, `cancelled`; workflow-owned states refused naming the verb; an echo of the current status ignored | Wave 12 (16 P1) — see X18 |
| D2 | What happens to rows already wrong (status, cache, out-of-scope links)? | A: read-only report only | Wave 12 (Task 1.5 only) |
| D3 | `auditStatus` on the create/update inputs and forms | A: remove it; only the engine writes the cache | Wave 12 — see X19 |
| D4 | What the under-review freeze covers | A: all of `lading.update`, containers included (attachments: X21) | Wave 12 |
| D5 | Serialising save vs submit | A: guards, order resolution and step 15's gate inside the transaction; `FOR UPDATE` in `update` and `lading.exists` | Wave 12 — see X17 |
| D6 | An order link outside the clerk's data scope | A: writers resolve through the `collectiveOrder` scope; out-of-scope reads `unmatched` / `stale_id`, silently | Wave 13 (16 P2) |
| D7 | `owningBranchId` on update | A: validate a *changed* branch with `resolveOwningBranchId`; echoes not checked | Wave 12 |
| D8 | Hand-off from order to bill | A: **Bills of lading (n)** and **Raise bill of lading** on the order record page | Wave 13 |
| D9 | What the create picker lists | A: received and not archived orders | Wave 13 |
| D10 | Carrying the order's details to the B/L | A: fill blank fields only, marked "from order" | Wave 13 |
| D11 | OCR errors and Apply | A: show per field; errors need an **Apply anyway** tick | Wave 14 (16 P3) |
| D12 | Where OCR issues map to form fields | A: server adds `formField` from `OCR_FIELD_MAP` | Wave 14 |

### Step 17 (`step-17-lading-states-and-review.md` §9)

| Dn | Question | Chosen | Needed by |
|---|---|---|---|
| D1 | Where does a bill get sent for review? | A: **Review** menu in the bill page toolbar | Wave 15 (17 P1) |
| D2 | Which plan adds the freeze and row lock to `lading.update`? | **B: step 16 (per X17)**, overriding the plan's own recommendation (A) | **Wave 12** (it decided what 16 P1 does) |
| D3 | Are attachments frozen under review and after approval? | B: freeze delete only; uploads stay open | Wave 15 — see X21 |
| D4 | What happens to the Audit Status form field? | A: drop from inputs and both forms; the record page shows it read-only. Done by step 16 (X19) | Wave 12 (via 16 P1); Wave 16 greps |
| D5 | How does a state move serialise? | A: load, precondition, gate and write in one transaction with `FOR UPDATE` (same for the attachment list) | Wave 16 (17 P2) |
| D6 | May a bill on Hold be checked out? | A: refuse — "On hold — release the hold before checking out" (re-check 17-P4 against how the desk uses eyun) | Wave 16 |
| D7 | Does Hold ask for a reason? | A: optional reason dialog on the bill page and the row menu | Wave 16 |
| D8 | Can On-hold / Amended be typed as a status? | **Superseded by step 16 D1-A (per X18)**, overriding the plan's own recommendation (A) | Wave 12 (via X18) |
| D9 | May Checked-In / Out Remarks be edited after approval? | A: accept the post-approval freeze; the SOP says so (re-check 17-P10; re-plan toward B only if it shows frequent edits) | Wave 16 (no code under A) |
| D10 | How does the bill page say it is under review? | B: engine-driven `underReview` on `lading.get`; notice and Save disabled | Wave 15 |
| D11 | Hand-written `audit_status` residue | A: report only (drift script) | Wave 16 (Task 2.6) |
| D12 | Should lading submit respect the submitter's data scope? | A: defer with step 15 D14 (X13 known gap) | blocks nothing |

### Step 18 (`step-18-bl-document-approval.md` §9)

| Dn | Question | Chosen | Needed by |
|---|---|---|---|
| D1 | How is a document filed against its order / B/L? | A: order and B/L picker on the document screen (search prefilled with the extracted BL number); no quote option | Wave 12 (18 P1) |
| D2 | Can a link be removed? | A: `document.unlink` under `document.update`, audited | Wave 12 |
| D3 | Who reshapes the order `documents` payload? | A: step 19 Task 2.2 (= 19 D1-A); step 18 writes no payload code | Wave 12 — see X23 |
| D4 | Only under D3-B: include `countdownDeadline` in `customs.job`? | A, moot: D3-A was chosen, so Tasks 1.2 and 1.4 are not done | nothing |
| D5 | How is a mis-typed document re-typed at review? | A: type Select on every `needs_review` document, through `correct`'s existing `docTypeOverride` (web only) | Wave 13 (18 P2) |
| D6 | Error-severity validation issues at approval | A: show the messages under their fields; no server refusal | Wave 13 |
| D7 | Serialising two approvals of one BL | A: transaction + per-org `pg_advisory_xact_lock` in `blIntakeHook`; no migration | Wave 14 (18 P3) |
| D8 | What a thrown hook tells the reviewer | A: `approval_hook_failed` notice; recovery via amend | Wave 14 |
| D9 | K1/K2 customs declaration type | A: its own feature plan | blocks nothing |
| D10 | Re-typing an already approved document | A: known gap, sized by 18-P3 | blocks nothing |
| D11 | Member delete cascades into documents and `bl_job`s (system-wide) | A: flag to a separate plan | blocks nothing |

### Step 19 (`step-19-demurrage-clock-reach.md` §9)

| Dn | Question | Chosen | Needed by |
|---|---|---|---|
| D1 | Who reshapes the order `documents` payload, step 18 or 19? | A: step 19 owns the whole reshape; step 18 owns the `document_link` writer and merges first | Wave 13 (19 P2) — see X23 |
| D2 | Which job an order shows when several share its BL number | A: open job wins, else newest finished; two open = ambiguous | Wave 13 |
| D3 | Which permission shows the customs line on an order | B: `document.read` AND `bl-job.read`; no `bl-job` data scope | Wave 13 |
| D4 | How BL numbers are compared | B: trim + upper-case both sides at read time (no migration); drop Task 2.1 if 19-P3 shows no difference | Wave 13 |
| D5 | How server and web payload shapes stay in step | A: web test fixture typed from the router output | Wave 13 |
| D6 | How a tracking job reaches its order | A: `blJob.get` returns order-scoped matching orders by BL number | Wave 14 (19 P3) |
| D7 | How a missing portal login is surfaced | B: org-level `blJob.sourceStatus` read plus one notice on the board, record page and gate-out card | Wave 12 (19 P1) |

Step 19's Q1 (overdue alerts), Q2 (haulage link) and Q3 (a static role for `bl-job.void`) are open questions, not planned work (§13).

---

## 2. Why the waves are in this order

Two pairs of plans write the same code, and they overlap in very different ways.

**Steps 16 and 17 both rebuild `lading.update`.** Each was written believing the other had no plan. They claim the same under-review freeze, the same `FOR UPDATE`, the same `lading.exists` lock and the same new test file, they both remove the Audit Status field, and they refuse typed statuses with two different vocabularies. Collisions are handled by **ordering and a single owner**, never by resolving a merge by hand, so X17–X22 give each line one owner and put **all of step 16 before step 17**.

**Steps 18 and 19 already agree.** Both recommend that step 19 reshapes the order `documents` payload and that step 18's link writer lands first (X23). The only binding edge is **18 P1 → 19 P2**.

The binding edges, from the crosscheck §1–§2 and each plan's §7.6:

| Shared code | Writers | Handled by |
|---|---|---|
| `routers/lading.ts` `update` | 15 Task 3.2 (`create_lading` gate call); 16 Tasks 1.1–1.2 (status rule, branch check, freeze, `FOR UPDATE`, guards inside the transaction), 16 Task 2.1 (write-side order resolver); 17 Task 1.1 (the same freeze), 17 Task 2.3 (status refusal) | 15 P3 (Wave 10) → 16 P1 → 16 P2 → 17. **X17: step 16 owns the freeze and the lock**; 17 greps and adds none |
| `REVIEWABLE_RESOURCES.lading.exists` in `modules/audit/resources.ts` | 08 Task 2.1 (neighbouring `separationOfDuties`); 16 Task 1.2 and 17 Task 1.2 (the same `.for("update")`) | 08 → 16 P1. X17 |
| Status vocabulary on `lading.create` / `update` and both forms | 16 Tasks 1.1, 1.4 (D1); 17 Tasks 2.3, 2.5 (D8) | **X18: 16 D1 governs**, and the edit form's echo of the current status is dropped on the server first (§10) |
| `auditStatus` input and the Audit Status select | 16 Tasks 1.1, 1.4 (D3); 17 Tasks 2.3, 2.5 (D4) | X19: 16 P1; 17 drops that part |
| `lading.concurrency.test.ts` [NEW] and the under-review cases | 16 Task 1.3 and 17 Task 1.3 both create the file; 16 puts under-review cases in `lading.test.ts`, 17 in `lading.under-review.test.ts` [NEW] | X20: 16 P1 creates both files; 17 adds `describe`s |
| `lading.test.ts` pin at `:716-725` (writes `released` through `update` on a held bill) | 16 Task 1.3 changes it to `confirmed`; 17 Task 2.4 still relies on it | X18: 16's version |
| `apps/web/src/routes/_next/lading/create.tsx` | 16 Tasks 1.4, 2.4, 3.2; 17 Task 2.5 | 16 P1 → 16 P2 → 16 P3 → 17 P2 |
| `apps/web/src/routes/_next/lading/$id/edit.tsx` | 16 Task 1.4; 17 Tasks 1.4, 2.5 | 16 P1 → 17 P1 → 17 P2 |
| `apps/web/src/routes/_next/lading/index.tsx` | 16 Task 2.4 (`orderId` search key); 17 Task 2.5 (Hold reason on the row menu) | 16 P2 → 17 P2 |
| `components/order-ledger/order-record-page.tsx` `actions` | 15 Task 1.5 (under-review notice); 16 Task 2.4 (two B/L links) | 15 P1 (Wave 7) → 16 P2. Put the links before **Expenses** and keep 15's notice |
| `routers/collective-order.ts` `enrichOrderRows` documents half and the rollup `describe` in `collective-order.numbering.test.ts` | 19 Tasks 2.2–2.3 (18 Task 1.2 only under D3-B). 11, 12 edit other `describe`s; 11–15, 20 and 21 edit other functions | **X23: 18 P1 → 19 P2**; 11 P2 and 12 P1 are long merged by Wave 13 |
| `apps/web/src/routes/_next/lading/$id/index.tsx` | 17 Tasks 1.4, 2.5 (toolbar). 18 and 19 edit nothing there but need the card mount (`readOrderDocumentRollup(orderQuery.data)`, `<OrderDocumentsCard>`) kept | 17 keeps the mount |
| `packages/api/src/architecture.test.ts` | 18 Task 3.1 adds one `ALLOWED_EXECUTE_SITES` entry; 16 and 17 only re-run it (their allow-list keys do not change) | Line-independent entries; the later merge rebases and re-runs it |
| `modules/document/register-hooks.test.ts` | 18 Task 2.3, then 18 Task 3.3 | 18 P2 → 18 P3 in one worktree |
| `routers/bl-job.ts`, `bl-job-record.tsx` | 19 Phase 1, then 19 Phase 3 | 19 P1 → 19 P2 → 19 P3 in one worktree |

**Why three parallel lanes.** In Waves 12–14 the step 16, step 18 and step 19 phases have disjoint write sets (checked against each plan's §6): 16 writes the lading side, 18 the document side, 19 the `bl-job` side plus one function of `collective-order.ts` that no other 16–18 task writes. Step 17 follows once step 16 is completely merged, because it edits every lading file 16 leaves behind.

---

## 3. The waves at a glance

```
              Wave 12    Wave 13    Wave 14    Wave 15    Wave 16
wt-step16     16 P1      16 P2      16 P3
wt-step18     18 P1      18 P2      18 P3
wt-step19     19 P1      19 P2      19 P3
wt-step17                                      17 P1      17 P2
```

| Wave | Starts when | Runs in parallel | Merge order in the wave | Decisions this wave implements (all settled 2026-09-21) | Probes Wilfred runs first | Deploy notes |
|---|---|---|---|---|---|---|
| **12** | all of Wave 11 (step 14 P3) merged, so steps 08, 14 and 15 are complete | `wt-step16`: 16 Phase 1 · `wt-step18`: 18 Phase 1 · `wt-step19`: 19 Phase 1 | 18 P1 → 19 P1 → 16 P1 (disjoint files; any order works) | **X17–X20, X22**; 16 D1, D3, D4, D5, D7 (D2 for Task 1.5); 17 D2-B, D8 superseded (through X17, X18); 18 D1, D2, D3 (X23); 19 D7 | **16-P1, 16-P2, 16-P3 before 16 Task 1.1; 16-P4, 16-P6 before 16 Task 1.2**; 18-P4 before the 18 P1 release note; 19-P1 | 16 P1: either order; announce **"retract before editing"** (bills already submitted over RPC or by the seeder freeze). 18 P1: either order. 19 P1: server first. Build `apps/web` before every deploy |
| **13** | Wave 12 merged | `wt-step16`: 16 Phase 2 · `wt-step18`: 18 Phase 2 · `wt-step19`: 19 Phase 2 | 16 P2 → 18 P2 → 19 P2 | 16 D6, D8, D9, D10; 18 D5, D6; 19 D1–D5; X23, X24 | **16-P5 before 16 Task 2.1; 16-P7 before 16 Task 2.4; 19-P2, 19-P3, 19-P6 before 19 Task 2.1**; 18-P5, 18-P6 | 16 P2: server before web (the count link needs the `orderId` filter). 18 P2: web only. **19 P2: only after 18 P1 is deployed** — otherwise every order shows three "Missing" chips (X23); server first |
| **14** | Wave 13 merged | `wt-step16`: 16 Phase 3 · `wt-step18`: 18 Phase 3 · `wt-step19`: 19 Phase 3 | 18 P3 → 16 P3 → 19 P3 | 16 D11, D12; 18 D7, D8; 19 D6 | **18-P1 and 18-P2 before 18 Task 3.1** | 16 P3: either order. 18 P3: API only. 19 P3: server first |
| **15** | Wave 14 merged (all of step 16 is in) | `wt-step17`: 17 Phase 1 (Review menu, `get.underReview`, `deleteAttachment` freeze) | 17 P1 | 17 D1, D2-B (= X17), D3 (X21), D10 | **17-P1 and 17-P2 before 17 Task 1.3**; 17-P8 | **API before web.** The lading flow is seeded enabled in every org, so submissions start the day the web deploys |
| **16** | Wave 15 merged | `wt-step17`: 17 Phase 2 (one locked transaction per state move, attachment list lock, Hold reason, the D6 precondition, drift report) | 17 P2 | 17 D4 (done by 16, X19), D5, D6, D7, D8 (superseded by 16 D1, X18), D9, D11; X25 | **17-P4 before 17 Task 2.1; 17-P6 before 17 Task 2.3**; 17-P10 before the D9 remark guidance (re-check) | API first is cleanest; web can follow |

**Faster alternatives, Wilfred's call only.** 18 P1 and 19 P1 depend on no step 04–15 phase and no 04–15 plan writes their files, so they could run beside Waves 5–11. 16 P1 needs only Wave 10 (15 P3) and says it has no file in common with Wave 11 (crosscheck §6). This runbook holds all three to Wave 12 to keep one start line; a session does not move itself earlier.

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

# Wave 12 (each kept through Wave 14)
git worktree add ../wt-step16 -b feat/step16-lading-create         origin/feat/new-layout
git worktree add ../wt-step18 -b feat/step18-bl-document-approval  origin/feat/new-layout
git worktree add ../wt-step19 -b feat/step19-demurrage-clock-reach origin/feat/new-layout

# Wave 15 (kept through Wave 16)
git worktree add ../wt-step17 -b feat/step17-lading-states-review  origin/feat/new-layout
```

Then run `bun install` inside **each** new worktree, and start `claude` there in its own terminal.

> A worktree is an extra folder on its own branch that shares one git history. Each Claude session gets its own folder, so no session can overwrite another's edits or sweep them into its commit.

`wt-step16`, `wt-step18` and `wt-step19` each carry Phases 1, 2 and 3 across Waves 12, 13 and 14; `wt-step17` carries Phases 1 and 2 across Waves 15 and 16. Each phase is its own commit range and its own PR; rebase between them (§6). Only one session commits in a worktree at a time: confirm the index is empty before `git add`.

**The main checkout is not on the base branch.** At the time of writing `C:/Project/NCT/nct-layout` sits on `feat/intake-golden-path-e2e` at `ea1560e7`, four e2e-only commits past `6bb3a1bf`. Worktrees branch from `origin/feat/new-layout`, so those specs are invisible to every session unless they have merged. Wilfred decides what happens to them; **no session stashes, resets or checks out anything, in any worktree, for any reason.** Every §10 walk re-reads `ACTORS` in `e2e/fixtures/seed-cli.ts` by symbol at its own base commit.

---

## 5. The prompt for each session

Paste one of these into the session in the matching worktree. They follow one template: read the plan and the crosscheck, name the phases, state that the decisions are settled, re-locate by symbol, prove it with §10, and stop.

### Wave 12 — `wt-step16`

```text
Read C:/nct-plans/step-16-lading-create.md in full, and C:/nct-plans/steps-16-19-crosscheck.md.
Implement PHASE 1 ONLY (Tasks 1.1-1.5). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-A, D2-A, D3-A, D4-A, D5-A, D7-A; crosscheck X17-X22 as
recommended) — implement the Chosen option and do not re-open it.
Under X17, THIS phase owns the lading.update under-review freeze, the FOR UPDATE load inside the
transaction, and .for("update") on REVIEWABLE_RESOURCES.lading.exists. Step 17 will add none of them.
Under X18, the status rule drops an unchanged status before checking it: the edit form resends the loaded
status on every save ($id/edit.tsx handleSubmit, NON_CLEARABLE), so without the echo rule every save of a
held bill would be refused.
Under X20, create packages/api/src/routers/lading.concurrency.test.ts AND put your under-review cases in
packages/api/src/routers/lading.under-review.test.ts [NEW], not in lading.test.ts. Step 17 extends both.
Before you start: grep routers/lading.ts for the literal "create_lading". If it is absent, step 15 Phase 3 has
not merged; stop and tell me. Keep both assertGateCleared(..., "create_lading") calls as literals
(modules/audit/gates.test.ts scans for them); only their first argument changes to tx. Confirm
packages/db/scripts/ exists (step 08 Task 3.5); if not, stop and ask.
The plan was read at 6bb3a1bf and steps 08, 14 and 15 have moved every line: re-locate update, create,
statusAfter, resources.ts lading.exists, both forms and the allow-list block BY SYMBOL at HEAD.
CI has no DATABASE_URL_TEST: run the concurrency test against the dev Neon branch, paste the failing run on the
pre-lock code and the passing run into the PR. "Skipped" is not a pass. Run the drift script read-only on the
dev branch only. Never point anything at production.
Prove it with the plan's §10: the Phase 1 test list, then Journey 1 steps 3-4, Journey 3 and edge cases 1, 2,
2b and 3 in the browser at localhost:3101. Never run git stash, git reset or git checkout.
```

### Wave 12 — `wt-step18`

```text
Read C:/nct-plans/step-18-bl-document-approval.md in full, and C:/nct-plans/steps-16-19-crosscheck.md.
Implement PHASE 1 ONLY. Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-A, D2-A, D3-A, so D4 is moot; crosscheck X23) — implement the
Chosen option and do not re-open it.
Under D3-A / X23, Phase 1 is Tasks 1.1, 1.3 and 1.5 only. Do NOT edit collective-order.ts, rollup.ts or
rollup.test.ts: step 19 Task 2.2 owns the payload. Do not do Tasks 1.2 and 1.4 (D3-B was not chosen).
document.unlink reuses DOCUMENT.update; add no permission node. Run permissions/registry.sync.test.ts.
Task 1.3: grep the worktree for "Linked quotes", "Linked to quote", "Select a quote" and LinkQuoteForm
afterwards; only docs/prd/document-ai-plan.md may still match. Guard the BL-number prefill so a refetch never
overwrites what the user typed.
Task 1.5's seed writes by direct INSERT on the dev branch only, never production. The preview pane stays blank
for seeded rows (no R2 object); that is expected.
The plan was read at 6bb3a1bf: re-locate link, the review screen's LinkQuoteForm and seed/cli.ts BY SYMBOL at
HEAD.
Prove it with the plan's §10: the Phase 1 test list, then Journey 1 steps 1-4 and 7 plus edge cases 1 and 4 in
the browser at localhost:3101. Steps 5-6 are proven after step 19 Phase 2 merges; say so in the PR.
Never run git stash, git reset or git checkout.
```

### Wave 12 — `wt-step19`

```text
Read C:/nct-plans/step-19-demurrage-clock-reach.md in full, and C:/nct-plans/steps-16-19-crosscheck.md.
Implement PHASE 1 ONLY (Tasks 1.1-1.4). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D7-B) — implement the Chosen option and do not re-open it.
blJob.sourceStatus selects the tracking_source_config.source column ONLY — never login_id, agent_code or
encrypted_password — and Task 1.2 asserts no credential key leaves the server.
The notice sentence lives in source-notice.ts only; grep afterwards that the board, the record page and the
gate-out card import it and no second copy exists.
Do not touch packages/infra/alchemy.run.ts (the prod cron list lives on an unmerged branch). Never type real or
dummy credentials into Settings, and never remove logins from a shared org: use a fresh seed-parity org for
Journey 1, as §10 says.
The plan was read at 6bb3a1bf: re-locate blJob.get, the board, exceptions() and the gate-out card BY SYMBOL at
HEAD.
Prove it with the plan's §10: the Phase 1 test list, then Journey 1 and edge case 1a at localhost:3101.
Never run git stash, git reset or git checkout. Never touch production.
```

### Wave 13 — `wt-step16` (rebase first, see §6)

```text
Read C:/nct-plans/step-16-lading-create.md. Phase 1 is merged.
Implement PHASE 2 ONLY (Tasks 2.1-2.4). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D6-A, D8-A, D9-A, D10-A) — implement the Chosen option and do not
re-open it.
resolveLadingOrderForWrite is for the two writers only; get and listLadings stay on the org-wide resolvers. It
spells the collectiveOrder scope columns inline and must not import routers/collective-order.ts.
order-record-page.tsx: step 15 Phase 1 put an under-review notice in the same actions block. Keep it, and put
Bills of lading (n) and Raise bill of lading before Expenses, gated on lading:read / lading:create.
The create form preselects from ?orderId= once and never re-picks on refetch; the prefill writes a field only
while it is empty (the memory note on refetch overwriting typed input applies).
Re-locate create, update, listLadings, the picker query and the order record page BY SYMBOL at HEAD.
Server before web: the count link needs Task 2.2's orderId filter from its first render.
Prove it with the plan's §10: the Phase 2 test list, then Journey 1 steps 1-2 and 5 and edge case 5 in the
browser (if a second branch cannot be set up, say so and rely on Task 2.3). Never run git stash, git reset or
git checkout. Never touch production.
```

### Wave 13 — `wt-step18` (rebase first)

```text
Read C:/nct-plans/step-18-bl-document-approval.md. Phase 1 is merged.
Implement PHASE 2 ONLY (Tasks 2.1-2.3). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D5-A, D6-A) — implement the Chosen option and do not re-open it.
Task 2.3 is a server pin with no server code change. register-hooks.test.ts is handed to Phase 3 afterwards;
add your cases and nothing else to it.
Hide the pencil on "Not in schema" rows; an untyped needs_review document must still refuse to submit until a
type is chosen (edge case 5).
Re-locate the review screen's type badge, submit() and the payload type BY SYMBOL at HEAD.
This phase is web only for deploy purposes.
Prove it with the plan's §10: the Phase 2 test list, then Journey 2 (D-PL and D-BAD) and edge case 5 in the
browser. Never run git stash, git reset or git checkout. Never touch production.
```

### Wave 13 — `wt-step19` (rebase first)

```text
Read C:/nct-plans/step-19-demurrage-clock-reach.md in full, and C:/nct-plans/steps-16-19-crosscheck.md.
Phase 1 is merged. Implement PHASE 2 ONLY (Tasks 2.1-2.4). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-A, D2-A, D3-B, D4-B, D5-A; crosscheck X23, X24) — implement the
Chosen option and do not re-open it.
Before you start: confirm step 18 Phase 1 has merged (grep routers/document.ts for "unlink:" and
documents.$documentId.tsx for LinkRecordForm). If not, stop: the card would show "Missing" on every order.
Edit only the documents half of enrichOrderRows and only the rollup describe of
collective-order.numbering.test.ts; eleven other plans edit other parts of both files. Keep the single grouped
document query (the "exactly ONE document query" test must still pass). Export the payload type for D5's
fixture.
Re-locate OrderDocumentState, OrderCustomsState, emptyDocumentState, the customs select and the
"First one wins by number" fold BY SYMBOL at HEAD; steps 11-15 moved the file.
Seeded orders never match seeded jobs: set O1's MB/L to SEED-BL-006 by hand, as §10 says.
Deploy note for Wilfred: this phase's server must deploy only after step 18 Phase 1 is deployed.
Prove it with the plan's §10: the Phase 2 test list, then Journey 2 and edge cases 2a-2c in the browser.
Never run git stash, git reset or git checkout. Never touch production.
```

### Wave 14 — `wt-step16` (rebase first)

```text
Read C:/nct-plans/step-16-lading-create.md. Phases 1 and 2 are merged.
Implement PHASE 3 ONLY (Tasks 3.1-3.2). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D11-A, D12-A) — implement the Chosen option and do not re-open it.
The Apply-anyway tick resets on every new upload; Apply must never empty typed container rows when the scan
has none.
Re-locate ocrExtractionForForm, OCR_FIELD_MAP, applyOcrResult and the ocrResult state type BY SYMBOL at HEAD.
The browser proof of Journey 2 needs a dev server with the AI gateway configured. If it is not, uploadOcr
answers SERVICE_UNAVAILABLE; rely on the unit tests and say which in the PR.
Prove it with the plan's §10: the Phase 3 test list, Journey 2 and edge case 4. Never run git stash, git reset
or git checkout. Never touch production.
```

### Wave 14 — `wt-step18` (rebase first)

```text
Read C:/nct-plans/step-18-bl-document-approval.md. Phases 1 and 2 are merged.
Implement PHASE 3 ONLY (Tasks 3.1-3.3). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D7-A, D8-A) — implement the Chosen option and do not re-open it.
D7-A means no migration: do not write the partial unique index.
Add "modules/document/register-hooks.ts :: blIntakeHook" to ALLOWED_EXECUTE_SITES in
packages/api/src/architecture.test.ts in the SAME commit as the advisory lock, or the stale-entry rule fails.
Non-B/L approvals take no transaction and no lock.
Write no PGlite lock test (PGlite has one connection and passes on the old code). Run
register-hooks.concurrency.test.ts against the dev Neon branch; paste the run that creates two jobs without the
lock and the passing run after. "Skipped" is not a pass.
Existing duplicate jobs (probe 18-P1) are not repaired by code. Put the count in the release note; the owner
voids extras with bl-job.void.
Re-locate blIntakeHook, runApprovalHooks and ALLOWED_EXECUTE_SITES BY SYMBOL at HEAD.
Prove it with the plan's §10: the Phase 3 test list and Journey 3 steps 1-2. Never run git stash, git reset or
git checkout. Never touch production.
```

### Wave 14 — `wt-step19` (rebase first)

```text
Read C:/nct-plans/step-19-demurrage-clock-reach.md. Phases 1 and 2 are merged.
Implement PHASE 3 ONLY (Tasks 3.1-3.3). Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D6-A, and D4-B for the compare) — implement the Chosen option and
do not re-open it.
blJob.get.orders is null without collectiveOrder.read, applies the order data scope and fails closed
(?? sql`false`, as search.ts does), excludes archived orders, and returns at most six.
The Fees link targets /order/$orderId/expenses (step 20's page); show it only when exactly one order matched.
Re-locate blJob.get, orderScopeCols, TRADE_SEGMENT and the record page's Record group BY SYMBOL at HEAD.
Prove it with the plan's §10: the Phase 3 test list, then Journey 3 and edge case 3a in the browser.
Never run git stash, git reset or git checkout. Never touch production.
```

### Wave 15 — `wt-step17`

```text
Read C:/nct-plans/step-17-lading-states-and-review.md in full, and C:/nct-plans/steps-16-19-crosscheck.md.
All of step 16 is merged. Implement PHASE 1 ONLY. Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D1-A, D2-B per X17, D3-B, D10-B; crosscheck X17, X20, X21) —
implement the Chosen option and do not re-open it.
Under X17 (your D2-B), step 16 Phase 1 already made lading.update one locked transaction with
assertNotUnderReview, and added .for("update") to REVIEWABLE_RESOURCES.lading.exists. Before you start, grep
for all three, and for lading.concurrency.test.ts and lading.under-review.test.ts. If any is missing, stop: the
prerequisite has not landed. Add no second guard and no second lock.
What this phase adds: the Review menu on the bill page (engineReview bound at module scope, NOT iconOnly),
lading.get.underReview from the engine with the notice and Save disabled, the deleteAttachment freeze (D3),
and the gates.ts docblock. Add your under-review cases (deleteAttachment, get.underReview, verbs not frozen,
the create_lading regression) to the existing lading.under-review.test.ts; the plan already drops the [NEW]
tags. Do not write a submit-vs-update concurrency test: step 16's file has it. Re-run it on the dev branch.
Keep the OrderDocumentsCard mount and readOrderDocumentRollup(orderQuery.data) on the bill page; steps 18 and 19
depend on it.
Re-locate everything BY SYMBOL at HEAD; the plan was read at 6bb3a1bf, before steps 15 and 16 rewrote lading.ts.
API before web. Prove it with the plan's §10: the Phase 1 test list (both architecture tests), then Journeys 1-2
and edge cases 1 and 2 in the browser at localhost:3101. Never run git stash, git reset or git checkout.
Never touch production.
```

### Wave 16 — `wt-step17` (rebase first)

```text
Read C:/nct-plans/step-17-lading-states-and-review.md and C:/nct-plans/steps-16-19-crosscheck.md. Phase 1 is
merged. Implement PHASE 2 ONLY. Stop at its acceptance criteria.
Decisions are settled (Wilfred, 2026-09-21: D4-A done by step 16, D5-A, D6-A, D7-A, D8 superseded by step 16
D1-A per X18, D9-A, D11-A; crosscheck X18, X19, X25) — implement the Chosen option and do not re-open it.
Under X18 and X19, step 16 Phase 1 already removed auditStatus from both inputs and both forms and
refuses workflow-owned statuses with its echo rule. Grep for assertSettableStatus and for auditStatus in the
two inputs and the forms. If they are in place, skip that half of Tasks 2.3 and 2.5 and say so in the commit
message. Do not re-add "released" to the forms. Your Task 2.4 case that writes "released" through update on a
held bill uses "confirmed" now (step 16 changed that pin).
Task 2.1: applyWorkflow in one transaction with loadScoped({ tx, forUpdate: true }); keep the eight
assertGateCleared literals (gates.test.ts scans for them); circulate keeps one transaction per row.
Task 2.4: ADD your three describes (double check-in, hold vs amend, two uploads) to the existing
lading.concurrency.test.ts. Each must be seen failing on the pre-change code; run on the dev Neon branch, paste
both runs. "Skipped" is not a pass.
Task 2.6: your drift script omits 17-P3, which is 16-P3 in step 16's script (X25). Run it read-only on dev only.
Re-locate applyWorkflow, WORKFLOW, uploadAttachment and the row menu BY SYMBOL at HEAD.
Prove it with the plan's §10: the Phase 2 test list, then Journeys 3-4 and edge cases 3 and 4.
Never run git stash, git reset or git checkout. Never touch production.
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

Do the same **between phases in a shared worktree** (`wt-step16`, `wt-step18`, `wt-step19` at Waves 12 → 13 → 14; `wt-step17` at Waves 15 → 16): rebase onto the base that now contains the merged earlier phase, and start the next phase's session only after `bun run check-types` is clean.

**If the rebase stops on a conflict:** resolve it by hand, `git add <file>`, then `git rebase --continue`. If you're unsure which side is right, `git rebase --abort` puts the branch back exactly as it was. Then ask.

**Never use `git stash`, `git reset` or `git checkout -- <path>`**, in any session, for any reason. The stash stack is shared by every worktree and every session on the machine.

After every rebase, re-run `packages/api/src/architecture.test.ts` and `apps/web/src/architecture.test.ts`: allow-list comments collide even when the entries do not, and the stale-entry rule fails in both directions.

---

## 7. Migrations: numbers are assigned at merge

**Under the settled options, no phase in Waves 12–16 adds a migration.** The plans carry conditional ones, and none of their options was chosen:

| Plan | Conditional migration | State |
|---|---|---|
| 16 | `00NN_lading_state_repair` under D2-C | Not chosen (D2-A reports only) |
| 18 | `00NN_bl_job_open_bl_number_uidx` under D7-B | Not chosen (D7-A); it would fail to build while 18-P1 finds open duplicates |
| 18 | `00NN_document_link_created_by_set_null` under D11-B | Not chosen (D11-A); the cascade needs its own plan |
| 19 | `00NN_bl_number_normalise` under D4-C | Not chosen (D4-B) |
| 19 | `00NN_bl_job_order_link` under D6-C | Not chosen (D6-A) |
| 17 | none | No option in D1–D12 needs one |

**Rule (X26, as X14): if a migrating option is Chosen, the migration is written `00NN_<name>` and takes the next free number at the moment its branch is rebased for merge**, exactly as `steps-4-10-runbook.md` §6 describes. A step that picks a migrating option becomes the only migrating step in its wave, and its migration must pass all three gates: tags equal files, contiguous idx, and the PGlite chain replay (`bunx vp test run packages/db/src/migrations.test.ts`).

**No owner-run database write** is needed in this track under the settled options: `document.unlink` reuses `DOCUMENT.update` and `blJob.sourceStatus` reuses `BL_JOB.read`, so no `permission_node` row is added. Step 18 Task 1.5's seed writes to the dev branch only.

Before each phase, confirm the journal still ends where the merged steps left it (at HEAD `6bb3a1bf` it ends at idx 64, `0065_quotation_send_decision`, before steps 01–10's reservations), by reading `packages/db/src/migrations/meta/_journal.json` **and** the migrations table — never by a command's exit code.

---

## 8. Stop gates: owner only

Every probe is a read-only `SELECT` against production, and **Wilfred runs all of them with the owner's override.** No session connects to production, ever. The full SQL lives in each plan's §7.7.

**Run the probes for a wave before the code is written, not before the merge.** Several of them gate a specific task, and a probe that contradicts its decision stops that task for a re-plan rather than being argued away. The decisions they feed were settled on 2026-09-21, so each probe is now a **re-check**: the choice stands, and a result that contradicts it stops the task for a re-plan.

| Wave | Probe | Question | Gates |
|---|---|---|---|
| 12 | **16-P1** | Status against the stamps that should have set it (released never checked out, on-hold without a hold, base overwritten by the edit-form echo) | **Before 16 Task 1.1** (D1, D2) |
| 12 | **16-P2** | Status values outside every vocabulary | **Before 16 Task 1.1** (D1) |
| 12 | **16-P3** | Review cache disagreeing with the latest submission (typed by hand) | **Before 16 Task 1.1** (D3). Same as 17-P3 |
| 12 | **16-P4** | Bills by latest submission; `lading.update` rows during open submissions | **Before 16 Task 1.2** (D4, D5); the "retract before editing" notice. First query = 17-P2 |
| 12 | **16-P6** | Bills whose branch is another org's team | **Before 16 Task 1.2** (D7) |
| 12 | 18-P4 | `document_link` counts by entity type | 18 Phase 1 release note (X23). Same as 19-P4 |
| 12 | 19-P1 | Orgs with open jobs; each portal login saved; last `check_observed` | 19 Phase 1 urgency (D7) |
| 13 | **16-P5** | Bills linked to an order in another branch; role data scopes for `lading` / `collectiveOrder` | **Before 16 Task 2.1** (D6) |
| 13 | **16-P7** | Orders the create picker lists today vs under D9-A, per org | **Before 16 Task 2.4** (D9) |
| 13 | **19-P2** | BL numbers with more than one non-voided job, open vs finished | **Before 19 Task 2.1** (D2). Related to 18-P1 |
| 13 | **19-P3** | Orders matching a job exactly vs only after trim/upper | **Before 19 Task 2.1** (D4; drop Task 2.1 if equal) |
| 13 | **19-P6** | Roles with `document.read` but not `bl-job.read` | **Before 19 Task 2.1** (D3) |
| 13 | 18-P5, 18-P6 | Reject-then-reprocess workaround use; approved documents still carrying error-severity issues | 18 D5 urgency, D6 (C if common) |
| 14 | **18-P1** | Open duplicate `bl_job`s per (org, BL number) today | **Before 18 Task 3.1** (D7); the release note |
| 14 | **18-P2** | Approved `mbl_hbl` documents with no job, and whether another job holds the BL | **Before 18 Task 3.1** (D8: B if failed intakes exist) |
| 15 | **17-P1** | Lading flow per org: enabled, post-approval-editable, withdrawal mode, ticked gates, reviewer rows | **Before 17 Task 1.3** (D1, D2, D9; the no-director risk) |
| 15 | **17-P2** | Bills by latest submission | **Before 17 Task 1.3**; the Phase 1 deploy notice. A later re-run of 16-P4's first query |
| 15 | 17-P8 | `lading.update` / attachment deletes that landed during review | Finding B sizing |
| 16 | **17-P4** | Bills held and released now; released without check-in; check-outs recorded while held | **Before 17 Task 2.1** (D6): if the desk routinely checks out held bills, stop and re-plan |
| 16 | **17-P6** | Workflow statuses disagreeing with the stamps | **Before 17 Task 2.3** (D8, now 16 D1 under X18) |
| 16 | 17-P10 | Remark edits through `lading.update` | Before the D9 remark guidance goes to the SOP (D9-A re-check) |
| 16 | 17-P5, 17-P7, 17-P9 | Moves recorded twice within 5 s; lost scans; hold reasons ever recorded | D5 urgency, Finding E, D7 |

**Duplicates — run once, report under both ids.** 16-P3 = 17-P3. 16-P4's first query = 17-P2 (re-run at Wave 15 as a fresh count, not a new question). 16-P4's second query ⊂ 17-P8 (17 also counts attachment deletes). 16-P1's hold/amend columns ⊂ 17-P6. 18-P4 = 19-P4. 18-P1 (raw open duplicates) is related to 19-P2 (normalised, open vs finished); the difference between them sizes X24. Do not ask Wilfred for the same reading twice in one wave.

**Sizing probes that gate nothing** (16-P8, 16-P9, 16-P10, 18-P3, 18-P7, 18-P8, 19-P5, 19-P7) can be run at any point. They belong in the PR description and the release note, or size settled known gaps and open questions (18 D10, D11; 19 Q1, Q3), not in front of the code.

Message template, one per wave:

```text
Wave <N> (<step and phases>) is ready to start. Before any code, can you run these read-only production
probes with the owner's override and send me the counts?

  <id> — <one-line question> — from <plan file> §7.7
  <id> — <one-line question> — from <plan file> §7.7

<id> gates <task>: if it contradicts <decision>, I stop and we re-plan rather than work around it.
The decisions are settled (2026-09-21); a result that contradicts <plan Dn / crosscheck Xnn> stops the task.
Nothing here writes; they are SELECTs only. I will not run anything against production myself.
```

**Deploying is separate from merging, and is Wilfred's call.** The per-wave deploy notes are in §3: server before web for 16 P2, 19 P1–P3 and 17 P1; API only for 18 P3; web only for 18 P2; and **19 P2's server only after 18 P1 is deployed**. Build `apps/web` before every deploy so a failed deploy does not split the stage.

---

## 9. Checklist before each PR

Run inside the worktree once its session says it is done:

- [ ] Every decision the phase implemented is marked **Chosen** in its plan's §9, and every X-item it relied on reads **Settled** in the crosscheck. If not, the PR waits.
- [ ] `bun run check-types`: **read the output.** It can exit 0 while printing "failed". Confirm `apps/web` and `seed` actually ran.
- [ ] `bun run test`, and the phase's own test command from the plan's §10: read each output for `failed`, not the exit code.
- [ ] If the phase touched `packages/api`: `packages/api/src/architecture.test.ts` passes. A green from `apps/web/src/architecture.test.ts` is a different gate; run both. Re-run them after every rebase.
- [ ] If the phase touched a router's procedures (18 P1 `document.unlink`, 19 P1 `sourceStatus`): `permissions/registry.sync.test.ts` and `permissions/reachability.test.ts` pass.
- [ ] **Real-Postgres concurrency tests: paste the output into the PR.** CI has no `DATABASE_URL_TEST`, so these never run there and a `skipped` line is **not** a pass. Each PR that owns or extends one shows two pasted runs against the **dev Neon branch**: the failing run on the pre-change code, and the passing run after. This applies to `lading.concurrency.test.ts` (created by step 16 Phase 1, extended by step 17 Phase 2) and `register-hooks.concurrency.test.ts` (step 18 Phase 3).
- [ ] Drift scripts (16 Task 1.5, 17 Task 2.6): run read-only on the dev branch and paste the counts; production is Wilfred's.
- [ ] Migrations: none is expected in this track (§7). If one was revived, it is named `00NN_<name>`, took the next free number at rebase, and `bunx vp test run packages/db/src/migrations.test.ts` passes.
- [ ] The plan's §10 walked in the browser at `localhost:3101`, **one worktree's dev servers at a time** (§10).
- [ ] Every hunk read in `git diff origin/feat/new-layout...HEAD`, not just the file list.
- [ ] Commit, push, open the PR:

```bash
git add -A
git commit -m "fix(lading): <what> (SOP step 1N phase N)"   # fix(document) for 18, fix(customs) for 19
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
| An API change "doesn't work" but returns 200 | `bun --hot` doesn't reload `packages/api` changes | Restart the API server before any browser check, and check its start time |
| Type-check "passed" but the log says failed | `vp run` exit codes lie | Grep the output for `failed` and `error TS` |
| Every edit of a held bill is refused after a status change | The edit form resends the loaded status on every save (`handleSubmit` spreads the form; `status` is in `NON_CLEARABLE`), so a held bill always sends `on-hold` | The server drops an unchanged status before checking it (16 §4.1, X18). Never refuse a value the form can echo without that rule |
| Cancel Hold leaves a bill "on hold" | Today the same echo overwrites `statusBefore` with `on-hold` | That is 16 Phase 1's edge case 2b; it must end on the real base status |
| Two plans both add a lock or a guard to `lading.update` | Steps 16 and 17 both planned them | X17: step 16 owns them. Step 17 greps and adds none |
| Two plans both want `lading.concurrency.test.ts` | Steps 16 and 17 both named it [NEW] | X20: step 16 creates it; step 17 adds `describe`s |
| `gates.test.ts` fails after moving a gate call | It scans for literal `assertGateCleared(…, "<key>")` calls | Keep the keys as literals when moving `create_lading` or the eight lading gates onto `tx` |
| A concurrency test reports `skipped` and the PR calls it green | `DATABASE_URL_TEST` is set in no workflow | Run it on the dev Neon branch and paste both runs |
| A PGlite lock test passes on the old code too | PGlite is one connection: any second query waits on an open transaction whether or not a lock was taken | Don't write that test. Prove locks on real Postgres |
| A concurrency test judged by `submitted_at` or `created_at` | Both default to transaction start | Judge by the HTTP result and the final row state |
| The architecture test fails right after adding the advisory lock | `ALLOWED_EXECUTE_SITES` lists every raw `.execute()` in `packages/api/src`, and the stale-entry rule fires both ways | Add the `blIntakeHook` entry in the same commit as the code |
| The web architecture test fails on the new Review menu | `apps/web/src/architecture.test.ts` requires `engineReview(...)` bound at module scope | Bind `const reviewLading = engineReview("lading")` at module scope; do not use `iconOnly` (its label says "order") |
| The order's Documents card shows "Missing" on every line | No `document_link` row targets an order until step 18 Phase 1 ships | 18 P1 merges and deploys before 19 P2 (X23); say so in 19 P2's release note |
| Seeded orders never show a customs line | Seeded orders carry `SEED-MBL-…`, seeded jobs `SEED-BL-…` | Set one order's MB/L to a seeded job's number by hand (19 §10) |
| The document preview is blank in the browser proof | Seeded documents have no R2 object | Expected; assert on the DOM and the API, not the preview |
| The OCR walk fails with SERVICE_UNAVAILABLE | The AI gateway is not configured locally | Rely on 16's unit tests and say so in the PR |
| Checks "off" notice in an org you expected to be live | Portal logins are per org; seed-parity orgs have none | Correct and expected there. Never type credentials into Settings and never remove logins from a shared org to test it |
| The BL crons never fire locally | Crons exist only on the prod stage | Proofs use seeded rows. Do not touch `packages/infra/alchemy.run.ts` |
| The browser checks another org's data | One login is shared across sessions, and whoever switches org last redirects everyone | Confirm the actor with `fetch('/api/auth/get-session')` and the active org before each step |
| A pane screenshot is solid white | Screenshots of the pane can return blank while the DOM is fine | Assert on the DOM (`read_page`, `get_page_text`), not the screenshot |
| Every line number in the plan is wrong | Steps 08, 14 and 15 rewrote `lading.ts`, `resources.ts` and `collective-order.ts` after the plans were read, and 16 rewrites `lading.ts` before 17 | Re-locate by symbol at HEAD. The plans' line numbers were read at `6bb3a1bf` and are historical |
| The e2e fixtures look different from the plan | The main checkout carries e2e-only commits past `6bb3a1bf` on another branch | Never stash, reset or checkout. Re-read `ACTORS` by symbol at your base commit |
| The session can't find the plan | Plans aren't in git | Give it the absolute path to your downloaded copy under `C:/nct-plans/` |

**Accepted gaps, stated plainly (settled 2026-09-21: X24, X27, and 17 D12-A under X13).** No plan in 16–19 closes these, and no session should invent a fix:

- **Raw BL numbers at intake (X24).** Two spellings of one BL still make two open tracking jobs after 18 P3; step 19's order card then reads **Match not certain**.
- **SOP text for steps 16–19 (X27).** Each plan lists what is wrong in its §9 "SOP text vs code" and edits nothing.
- **Submit-time data scope for ladings** (17 D12-A), deferred with step 15 D14 under X13.

---

## 11. Clean up

Only once a branch is merged **and** `git status` in its worktree is clean:

```bash
# from the nct-layout folder
git worktree remove ../wt-step19
git branch -d feat/step19-demurrage-clock-reach
```

Keep, until their last phase has merged:

- **`wt-step16`** — through Wave 14 (Phase 3). Do not remove it after Wave 12 or Wave 13.
- **`wt-step18`** — through Wave 14 (Phase 3).
- **`wt-step19`** — through Wave 14 (Phase 3).
- **`wt-step17`** — through Wave 16 (Phase 2). Do not remove it after Wave 15.

---

## 12. Where the plans and the crosscheck disagree

These are the places where `steps-16-19-crosscheck.md` and a plan did not say the same thing, or where a plan was out of date about another plan. On 2026-09-21 Wilfred settled every X-item as recommended, and the text fixes those settlements needed were applied in the plans the same day, so most rows below are now **resolved** and kept for the record. The last column says what the plans now say, or which reading this runbook uses where a small gap remains. None of them re-opens a settled decision.

| Subject | Crosscheck says | The plan said (as drafted) | Now |
|---|---|---|---|
| Owner of the `lading.update` freeze and the `lading.exists` lock | X17 (Settled): step 16 Phase 1 | **16:** takes it (header, §4.3, Task 1.2). **17 D2-A:** step 17 Phase 1, "Step 16 adds no freeze" | **Resolved.** 17 D2 is Chosen **B (per X17)**; 17's header, §4.2, Tasks 1.1–1.3, §7.6 and Risks now say step 16 owns it and 17 greps |
| Which statuses may be typed | X18 (Settled): 16 D1 governs; 17 D8 superseded | **16 D1-A:** draft / confirmed / cancelled. **17 D8-A and Journey 4:** Status "offers Draft, Confirmed, Released, Cancelled" | **Resolved.** 17 D8 reads "Superseded by step 16 D1 (per X18)"; 17 Journey 4 and §4.5 now list Draft, Confirmed, Cancelled |
| Whether the edit form's echo matters | X18: the echo rule is mandatory under any option | **17 §4.5** noted the Select must render a stored `on-hold`, but its server rule refused `on-hold` with no echo exception | **Resolved.** 17 §4.5 now defers to 16 §4.1's echo rule, which lives in 16 Task 1.1 |
| The `lading.test.ts:716-725` pin | X18: 16's change | **16 Task 1.3** changes `:719`/`:724` from `released` to `confirmed`. **17 Task 2.4** named "the existing `:721` case" with `released` | **Resolved.** 17 Task 2.4 now says the case writes `confirmed` |
| Audit Status removal | X19 (Settled): 16 Phase 1 | **16 D3-A** (Phase 1) and **17 D4-A** (Phase 2) both did it | **Resolved.** 17 D4-A stands, marked "done by step 16"; Tasks 2.3 and 2.5 grep and skip |
| `lading.concurrency.test.ts` and the under-review cases | X20 (Settled): 16 creates both files; 17 extends | **16:** created the concurrency file; under-review cases in `lading.test.ts`. **17:** created the concurrency file and `lading.under-review.test.ts` | **Resolved.** 16 Task 1.3 creates both; 17 Tasks 1.3 and 2.4 extend them with no [NEW] tag |
| Attachments under review | X21 (Settled): 17 D3 governs | **16 D4-A:** "attachments … stay writable". **17 D3-B:** freeze delete | **Resolved.** 16 §4.3 and D4 now say its freeze covers `lading.update` only |
| Refusal order on `lading.update` | X22 (Settled): 16's | **16 §4.9:** status and branch before the review guards. **17 §4.8:** review guards before status | **Resolved.** 17 §4.8 now uses 16's order. No test in either plan asserts the relative order |
| Step 17's prerequisite on step 16 | All of step 16 before 17 P1 | **17 §5:** "Step 16 merged if its plan edits `lading.ts` `update` or `create.tsx`" | **Resolved.** 17 §5 and §7.8 now require all of step 16 merged (and 16 P1 deployed before 17 P1 deploys) |
| Step 16 knows step 17 | 17 has a plan | **16** header, §7.6 row 17, readiness: "Step 17 (no plan yet)" | **Resolved** in the header, §7.6 and readiness. 16 Phase 0 and Journey 3 still say "once step 17 adds a submit button", which stays true |
| Step 17 knows step 16 | 16 has a plan | **17** §5, §7.6 row 16, Risks, readiness: 16's plan "was not read" | **Resolved.** All four now name step 16's plan and X17–X22 |
| Step 18 knows steps 16, 17 and 19 | All have plans; 19 D1 = 18 D3 | **18** §7.6 row "16–17 (no plans yet)" and readiness "steps 16, 17 and 19 have no plans yet" | **Resolved.** 18 §7.6, Risks and readiness now name the plans and X23 |
| Step 19 knows steps 16–18 | All have plans | **19** §7.6 "plans being drafted in this run"; Risks "Step 18's plan also reshapes `documents`. Likely" | **Resolved.** 19 §5, §7.6, §7.8 and Risks now name step 18's plan and X23 |
| Payload reshape owner | X23 (Settled): A in both | 18 D3-A and 19 D1-A agree | Both Decided A. 18's §4.2 fallback, Tasks 1.2, 1.4 and D4 are marked not done (D3-B rejected) |
| When 18 Phases 2 and 3 run | Waves 13 and 14, one worktree | **18 §6:** Phase 3 may run in parallel with Phase 2 once Task 2.3 has merged | Sequential in one worktree; one session per worktree |
| When 19 Phase 1 runs | Wave 12 | **19:** "Phase 1 any time" | Wave 12, with a faster alternative in §3 that only Wilfred can take |
| When 16 runs | Wave 12, after Wave 11 | **16 §7.6:** "a wave after Wave 10 … may run beside Wave 11" | After Wave 11, with the alternative noted in §3 |
| The create picker's `limit: 200` | 16 Task 2.4 owns it | **18** adjacent defect 6 calls it "step 16/17 territory" | 16 Task 2.4 (D9-A) |
| 16-P3 vs 17-P3 | Same question; run once | 16 uses `is distinct from`, 17 `coalesce(…,'') <>` with `else ''` | Equivalent for every submission status the engine writes; run 16's once (X25: 17's script drops 17-P3) |
| Readiness | The crosscheck's table repeats the plans' scores at writing | Each plan: 7/10, re-worded after settlement but not re-scored | The plans' 7/10. All four are now limited by merge dependencies and unrun probes, not by open decisions |

---

## 13. Not covered here

- **Steps 01–15.** `steps-1-3-runbook.md`, `steps-4-10-runbook.md` (Waves 1–4) and `steps-11-15-runbook.md` (Waves 5–11). This runbook's Wave 12 starts only after Wave 11.
- **Steps 20–27.** Plans for steps 20–25 exist in `plans/`; they are sequenced in a separate runbook, not here. Step 19 Phase 3's **Fees** link targets step 20's `/order/$orderId/expenses`; step 20 edits that page but not its path. Steps 20 and 21 write `saveChildren` in `collective-order.ts`, a different function from step 19's `enrichOrderRows`.
- **Decisions not planned as work.** 18 D9 (K1/K2 declaration type, its own feature plan), 18 D10 (re-typing an approved document), 18 D11 (member delete cascades into documents and `bl_job`s, system-wide, its own plan and migration), 19 Q1 (alerts after the deadline), 19 Q2 (the haulage link, ledger item `haulage`), 19 Q3 (a static role for `bl-job.void`).
- **Adjacent defects each plan flags and does not plan** (16: party and member ids unchecked, duplicate bill numbers, footer double count; 18: auto-approve drops notices, link-target data scope, per-leaf review permissions).
- **SOP text for steps 16–19** (X27) and the SOP site itself. The site is public; Wilfred rebuilds and deploys it from `hosting/`, including the `steps-16-19-plans.zip` bundle and the plan and crosscheck pages this runbook links to.
- **Production access of any kind.** Every probe and every deploy is Wilfred's. Sessions work against the dev Neon branch, and never against `br-round-sun`.
