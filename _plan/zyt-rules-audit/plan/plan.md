# Plan: rules, ledger tracker and the zyt-update / zyt-audit split (revised)

Revision 2, 2026-09-15. It addresses the three staff-engineer reviews (correctness, safety, verifiability). The last section records what was done with each blocker and major. The facts it depends on were re-checked against the files on 2026-09-15; §0 lists them.

## 0. Verified facts this plan relies on

Checked in `COPY` (defined below) and in the skills on 2026-09-15:

- **Array indexes vs step numbers.** `sop.json` arrays are 0-based and step `n` is 1-based: `steps[i].n == i+1` and `guide[i].n == i+1`. The CFO price-comparison step is n=10, which is `/steps/9` and `/guide/9`. "Tick each line Done" is n=12, which is `/steps/11` and `/guide/11`.
- **R10 wording in the page.** `/steps/9/what` reads "…Submit to CFO. The line cannot be closed until the CFO approves." `/guide/9/golden/2` is an object whose `action` is "Click **Submit to CFO**". `/guide/11/before/1` reads "The price comparison is approved." `/guide/11/golden/1/action` reads "If refused with **An approved price comparison is required**, go back to step 10".
- **R10 in code.** In `packages/backend/convex/srfPurchasing.ts`, the comparison lookup is at 836-839. The throw block is lines 840-844 (`if (approvedComparisonPrice == null) {` … `}`), inside `markLineItemCompleted` (starts at 807). The Director gate throw is at 858-862. `updatePurchasingDetail` has its guard at 494: `["purchasing", "warehouse", "admin"]`. `unmarkLineItemCompleted` has its guard at 984.
- **Other guards.** `srfApprovals.ts`: `assertNotSelfApproval` runs 33-45, with the admin early return at 38 and the refusal at 40-44. It is called at 267 (single-item approve) and at 1073 (inside `decideLineItemsBulk`, which starts at 978). The CM gate is at 523. `priceComparisons.ts:212` has `approveComparison` guarded by `["admin","cfo"]`. `projectBudgets.ts:717` has `approveBudgetBatch` guarded by `APPROVE_ROLES = ["admin","cfo"]` (defined at :33). `srfForms.ts:130` and `:187` throw "You are not assigned to this project".
- **Ledger state.** Ledger item `receive-role-mismatch` has a body that begins "Partly fixed:". The code still refuses `inventory_manager` at 494. Ledger item `approval-queues-unmounted` cites `srfPurchasing.ts:840`. The copy's `sop.json` contains no "unmark" text.
- **Leftovers from the earlier test.** The copy's `.zyt\` holds `history.jsonl`, `manifest.json` and `pending-2026-09-15.json` (source `session`, 17 ops).
- **Registry.** Every page in `~/.claude/zyt/pages.json` has `noLedger: true`. `publish-page.ps1:77` strips the ledger unless `noLedger` is false, and `:66` refuses legacy pages. `sop-patch.mjs` has no legacy check.
- **sop-patch behaviour.**
  - `:342` refuses tier `auto` on anything that is not `reanchor`.
  - `:328` means `--accept all` accepts both auto and confirm ops.
  - `:150-161` shows `resolve-fix` writing `resolved`/`resolvedAt`, and `new:"remove"` deleting the item.
  - `:401-403` appends `<sopDir>\.zyt\history.jsonl`.
- **Cite collection.** `lib/cites.mjs:57` treats any `/src` pointer as a cite. `kindOf` returns `ledger` for any `/ledger/` pointer.
- **`zyt-sync-all.js`.** It has no `import` or `require`. Its labels are `extract <key> <slug>`, `map <slug> <L>`, `ledger <slug>`, `sweep <slug> rN`, `refute …` and `attack <slug> step N`. `tests\d\run-stub.mjs:20` kills `extract perms ultra-page`.
- **Test output.** Hook fixtures are in `tests\c2` (`hook-in.json`, `hook-out.json`, `hook-stop.json`). `regress.mjs` prints `ALL PASS` with no count. C1 and C2 print `N passed, M failed`.
- **Not a git repo.** `C:\Project\JWASystemv2` is not a git repository. `git -C … status --porcelain` exits 128 with empty stdout, so it cannot be used as a write guard.

## 1. Goal and non-goals

**Goal.** Each SOP page carries three kinds of claim, and each has its own source of truth:

- **Descriptive claims** (routes, UI labels, citations, roles as implemented) keep syncing page ← code.
- **Process rules** (`rules[]`) are never rewritten by an update or an audit. If code disagrees with a rule, the result is a proposed `rule-violation` ledger item with evidence. A rule's baseline moves only when the user decides it.
- **The ledger** becomes a tracker with a stable id, a status, dates, evidence and history. Only zyt-audit re-verifies it and changes its status.

**Deliverables:**

- A new `/zyt-audit` skill that takes over the audit half of `zyt-sync-all.js`. `/zyt-update --all` becomes sync-only.
- A trust line on the page.

**Non-goals:**

- No real deploys, and no `publish*.ps1` or `deploy-site.ps1` invocations.
- No writes under `C:\Project\`. The only exception is this plan file.
- No writes to the Convex dev DB. No app or dev server is started.
- No automatic e2e-deep or audit-prove runs.
- No `settings.json` changes.
- No in-place migration of the NCT regression fixture or of the real JWA `sop.json`.
- No severity-list refactor in the template (dropped from the draft; it was not requested).

**Abbreviations:**

| Short | Path |
|---|---|
| `S` | `C:\Users\user\.claude\skills` |
| `U` | `S\zyt-update` |
| `A` | `S\zyt-audit` |
| `W` | `S\zyt-update-workspace` |
| `SW` | `S\zyt-setup-workspace` |
| `COPY` | `W\tests\e2e\jwa-system` |
| `CSOP` | `COPY\sop\jwa-full-chain` |
| `RUN` | `W\tests\e2e\run\rules-audit-<date>` |

## 2. User journeys: old vs new

| # | OLD | NEW |
|---|---|---|
| J1: session sync after an intended change | Staleness produces ops. GATE 1 groups them (chain, text, fixes, shots). sop-patch applies them. | Same for descriptive paths. sop-patch computes each op's tier and source rights (§3.6). **Rule-anchored strings:** any change from session, --all or audit is hard-refused and shown under "Rule conflicts" as needs-human with the rule id. The strings change only through `/zyt-update --rules` (a `rule-set` decision). **Structural ops** (insert, remove, move) remap `rules[].anchors` and `rules[].steps` by object identity, so anchors follow their strings. A session writes no verification stamp into `sop.json`. It updates only the registry's `lastSyncedAt` and `lastSyncedScope`. |
| J2: session sync after an accidental rule regression | A deleted CFO/price-comparison gate becomes a `confirm` text edit, and the page "agrees" with the bug. | Staleness raises `rule-at-risk R10` by comparing the code window against the rule's **decided** hash, which only a rule decision moves. GATE 1 shows a **Rule conflicts** group. The only op allowed is `rule-violation`: a new ledger item with `origin: rule-violation`, `ruleId` and verified evidence. Anchored text stays byte-equal. If the user declines, the flag persists on every later run and re-snapshots do not clear it. It is cleared only by a tracked item, an explicit user dismissal recorded in `history.jsonl`, the code being restored, or a rule re-decision. Update detects regressions only at the cited code window; zyt-audit is the backstop for gates removed elsewhere. |
| J3: periodic audit | The attackers and ledger checker in `zyt-sync-all.js` turn findings into page-edit ops (`resolve-fix`, `set`). | `/zyt-audit --page <id>` runs ultracode by default. GATE 0 prints a preflight cost plan and asks before fan-out. The audit checks code against `rules[]`, hunts five defect patterns and re-verifies every ledger item. It emits only `rule-violation`, `ledger-add` and `ledger-status`. Transitions to partly-fixed or fixed, and reopens, are `decision` tier: accepted only by explicit id, with an evidence quote and a refuter "holds". The audit offers runtime-proof commands and never runs them. Legacy pages get a report only. `/zyt-update --all` is sync-only. |
| J4: marking rules on an existing page | Not possible: rules are prose. | `/zyt-update --rules`: `rules.mjs propose` produces candidates, and an agent adds code `src`, `enforcement` and `ledgerId`. The user ticks lists of at most 15 at a time. `rules.mjs apply` emits a `rule-set` changeset and applies it through sop-patch with `--source rules --accept <ids>`. Decided hashes go into the manifest. |
| J5: new page via zyt-setup | Steps and guides only. | zyt-setup SKILL.md gains a step after the guide draft: propose rules, user ticks them, `rules.mjs apply`, then build. |
| J6a: staff read the published page (`--no-ledger`, the default for every registered page) | No freshness signal. | A trust line reads "N% of claims cited to code · verified against code <date>". It appears only when the registry has `verifiedAt` from a full-page run. A Rules appendix lists the rules without ledger links. The ledger, history and rule-violation items are stripped, and the cited share is computed on what remains. |
| J6b: internal ledger build (`noLedger: false` or `-IncludeLedger`) | Resolved items render as open. | Everything in J6a, plus: a status tag outside the title `<b>`, "Found / Fixed" dates and a `<details>` history. Fixed items render ticked, locked, dimmed and out of the open count (rail and modal agree). Rule-violation items carry "Rule R10 broken". The appendix links each rule to its `ledgerId`. |

## 3. Data contract changes

`S\zyt-setup\references\sop-json-schema.md` is canonical. `W\contracts.md` mirrors it, and the lead owns that file.

### 3.1 Rules: new top-level `rules[]`

**Grammar:**

- `steps[]` holds step **`n`** values (1-based).
- `anchors[]` are RFC 6901 pointers with a leading slash and 0-based array indexes, the same form as manifest `jsonPath` and sop-patch `path`.
- Every anchor must resolve to a **string**. Object leaves are not allowed; name the leaf, e.g. `/guide/9/golden/2/action`.
- Every anchor must contain every one of the rule's `literals`, case-insensitive. This is a validate() error.
- `src` entries are repo-relative `path:line`.

**Example: R10, reworded to what the code enforces** (the correctness minor on R10 is adopted):

```json
{ "id": "R10",
  "text": "A supplier line cannot be ticked Done until its price comparison is approved",
  "kind": "gate", "steps": [12],
  "anchors": ["/steps/11/what", "/guide/11/before/1", "/guide/11/golden/1/action"],
  "literals": ["price comparison", "approved"],
  "src": ["packages/backend/convex/srfPurchasing.ts:840"],
  "enforcement": "code",
  "decidedBy": "user", "decidedAt": "2026-09-15" }
```

**Enums:** `kind` is `gate|role|threshold|permission|sequence`. `enforcement` is `code|config|none`.

**Rules for `ledgerId` and `enforcement`:**

- `ledgerId` is required when `enforcement` is `none`, and optional otherwise, for example to link a known partial gap.
- `config` is for gates that apply only when an org flow is enabled (NCT).
- validate() warns when a `none` rule's `ledgerId` item has status `fixed`. zyt-audit proposes a `rule-set` enforcement change for the user to decide.

**Where proposals and decided state live:**

- No back-references on `steps[]` or `guide[]`. Anchors are the single link, and sop-patch keeps them current (§3.6).
- Proposals never live in `sop.json`. They go to `<sopDir>\.zyt\rules-proposed-<date>.json`, or to `~/.claude/zyt/pending/<slug>/` when the sop dir is under `C:\Project`.
- Decided code state lives in the manifest (§3.3a), not in `sop.json`.

### 3.2 Ledger tracker (schema v2)

```json
{ "id": "rv-r10", "status": "open|partly-fixed|fixed", "origin": "defect|rule-violation",
  "ruleId": "R10", "pattern": "unenforced-approval|role-mismatch|handoff-drop|unreachable-screen|fake-default",
  "firstFound": "2026-09-15", "lastVerified": "2026-09-15", "fixedAt": "2026-09-15",
  "evidence": [{ "at": "packages/backend/convex/srfPurchasing.ts:836", "quote": "...", "absent": "...", "note": "...", "commit": "abc1234|null", "fingerprint": "<manifest code fingerprint>", "date": "2026-09-15" }],
  "history": [{ "date": "2026-09-15", "from": null, "to": "open", "by": "zyt-update|zyt-audit|user|migrate", "note": "..." }] }
```

**Field names.** Evidence and history deliberately use no `src` key (`at` and `date` instead), so `collectCites` never indexes them. `kindOf` and `collectCites` also skip any pointer containing `/evidence/` or `/history/` as a second guard. `evidence[].at` must be repo-relative.

**Changeset evidence → ledger evidence** is written by sop-patch:

| Changeset field | Ledger field |
|---|---|
| `{file, line, quote}` | `{at: "file:line", quote}` |
| `{file, absent}` | `{at: file, absent}` |
| (added) | `commit` (git short sha, or null when the code root is not git), `fingerprint` (manifest), `date` |

**`absent` evidence.** `evidence-verify.mjs` gains `absent`: the op is verified only if the text is **not** present in the file. This is how a deleted throw is evidenced, alongside a `quote` of surviving neighbouring code.

**Legacy fields and defaults:**

- All v2 fields are optional. A missing `status` is treated as `open`.
- `resolved` and `resolvedAt` are still accepted and are read as `fixed` and `fixedAt`. New writes never produce them.
- `isNew` is kept for NCT. The template derives "new" from `firstFound` when that exists.

**Fix ids.** `guide[].fixes[]` gains the same tracker fields plus `id`.

- Migration assigns `id` only to fixes that do not fold into a ledger item (no `sameAs` and no title match, per the template logic at `sop-template.html:2290-2300`).
- The id is the one the template derives today (`s<nn>-slug`). Collisions get `-2`, `-3`.
- The template prefers `f.id` when present.
- Duplicate fix ids are a validate() **error** on native v2 data. On data with `meta.migratedFrom: 1` they are a **warning**.

### 3.3 Trust fields and verification stamps

Nothing is written into `sop.json` on a routine sync (safety and correctness majors).

**Registry (`pages.json`) per page:**

| Field | Written by | When |
|---|---|---|
| `lastSyncedAt` (exists), `lastSyncedScope` (new: list of step n) | session mode | every run |
| `verifiedAt`, `verifiedCommit` (nullable), `verifiedBy` (`all-light`, `all-ultracode` or `audit`) | a full-page run | only when the run covered every step of the page |
| `auditedAt` | zyt-audit | Phase 4 |

**Build.** `build-page.mjs` gains `--verified-at <iso> [--verified-commit <sha>]`, and `publish-page.ps1` passes these from the registry.

- The stamp and the computed share go into a separate `<script id="sop-trust" type="application/json">`, **not** into the embedded SOP JSON. The `sop-build` hash (sha256 of the embedded JSON, which regress.mjs checks) is therefore unchanged.
- Trust stamps do not trigger live-drift. They change only on full-page runs, which lead to a redeploy anyway.

**Cited share.** Computed after any `--no-ledger` strip, over the claims present in the embedded data: golden actions, rules, ledger items and fixes.

- Numerator: items with a non-empty `src`.
- Denominator: all of them.
- `guide[].role` and `fields[]` are excluded (§8 Q3).

**Rendering.** The trust line renders only when `#sop-trust` exists. NCT builds never get it, so NCT output is unchanged.

### 3.3a Manifest `rules` index (snapshot.mjs)

```json
"rules": [{ "id": "R10", "steps": [12], "anchors": ["/steps/11/what", "..."],
  "cites": [{ "file": "...srfPurchasing.ts", "line": 840, "decidedWindowHash": "sha256", "decidedAt": "2026-09-15", "currentLine": 840 }] }]
```

**`decidedWindowHash`** is computed over the cited line ±3 lines. Before hashing, whitespace is normalised and **comment-only lines are removed**. The effect is that commenting out a throw, or wrapping it in `if (false)`, changes the hash.

**Who moves it.** It is set only by `rules.mjs apply`: a `rule-set` decision, or an explicit user dismissal that re-decides. `snapshot.mjs`, including the re-snapshot inside `publish-page.ps1`, copies it forward unchanged. A re-baseline can therefore never absorb a regression (safety blocker 2).

**Moved code.** If the identical window content is found at another line, snapshot updates `currentLine` and staleness emits an auto `reanchor` for `/rules/N/src`. The decided hash is unchanged.

### 3.4 Migration: `U\scripts\migrate-tracker.mjs --data <sop.json> [--out <path>] [--dry] [--revert <backup>]`

**What it writes:**

- `meta.schema = 2`, `meta.migratedFrom = 1`, `meta.migratedSourceSha = <sha256 of input>`.
- For each ledger item:
  - `status`: `partly-fixed` if the body or title matches `/^\s*partly fixed/i` (so `receive-role-mismatch` becomes partly-fixed), otherwise `open`.
  - `resolved: true` becomes `fixed` with `fixedAt = resolvedAt`.
  - `origin: defect`.
  - `firstFound` = today.
  - `evidence` = one `{at}` per `src` entry.
  - `history = [{from:null, to:<status>, by:"migrate", note:"migrated; first found before tracker"}]`.
- Fix ids per §3.2.

**Safety:**

- **(a) Backup.** Writes `sop.pre-v2.<sha8>.json` next to the output before writing.
- **(b) Hash check.** Applies only if the current input hash equals the hash computed at `--dry` time (passed with `--expect-sha`). Otherwise it refuses.
- **(c) Shared write path.** Writes through `U\scripts\lib\sop-write.mjs` (atomic write, format-preserving serialize, validate(), history append with `{kind:"migrate"}`).
- **(d) Revert.** `--revert` restores the backup, appends history, and prints the snapshot command to run.

**Where it runs:**

| Target | Behaviour |
|---|---|
| JWA copy | Migrated in place, after the Phase 0 archive. |
| Real JWA | `--out ~/.claude/zyt/pending/jwa-full-chain/sop.migrated.json`, with the source sha recorded. Applying it later is a separate user-approved step (§8 Q1). It re-checks the source sha, and re-snapshots immediately after. |
| NCT | `fixtures\nct\sop.json` untouched. Migrated copy at `SW\fixtures\nct-v2\sop.json` for render tests. |

### 3.5 validate() additions (`build-page.mjs`)

**Errors:**

- **Rules:** unique ids matching `^[A-Z]{1,3}\d+$`; `kind` and `enforcement` in their enums; each `steps[]` n exists; each anchor resolves to a string; each anchor contains every literal; `literals` is non-empty; a `none` rule has a `ledgerId`, and that id exists when a ledger is present.
- **Ledger:** `status` and `origin` in their enums; ISO dates; `fixed` requires `fixedAt`; `rule-violation` requires an existing `ruleId`; `pattern` in its enum; `history[].to` in the status enum; `evidence[].at` is a string and not an absolute path.
- **Fixes:** fix id uniqueness, except as noted in §3.2.

**Warnings (via `duplicateFixes()` warnings):** a fixed item with no `lastVerified`; a rule with no `src`; a `none` rule whose ledger item is fixed; a duplicate fix id on migrated data.

**`--no-ledger`** strips the ledger, step fixes, and any `ledgerId` from the embedded rules copy. `rules[]` stays. Cited share is computed after the strip.

### 3.6 Changeset ops, sources and tiers (`U\references\changeset-schema.md`)

**Source.** The changeset `source` enum becomes `session|all-light|all-ultracode|audit|rules`. `cs.source` is authoritative. An optional CLI `--source` must equal it, otherwise sop-patch refuses.

**Tier.** sop-patch **computes** each op's tier from kind and transition. A declared tier is honoured only if it is stricter than the computed one. New tier `decision` is accepted only by explicit op id. `--accept all` and `--accept auto` never accept it.

**New ops:**

| Op | Effect | Computed tier | Allowed sources |
|---|---|---|---|
| `rule-violation` | Adds a ledger item `{id, title, body, sev, origin:"rule-violation", ruleId, status:"open", firstFound, evidence, history}`. If an open item with the same `ruleId` exists, it appends evidence and history instead. Anchors are never touched. Evidence must pass evidence-verify. | confirm | session, all-*, audit |
| `ledger-add` | Adds a defect item with `pattern` and verified evidence. | confirm | audit |
| `ledger-status` (lastVerified only) | Sets `lastVerified` and appends evidence. Requires a verified evidence quote. | auto | audit |
| `ledger-status` (transition) | open→partly-fixed, open or partly-fixed→fixed (sets `fixedAt`), or reopen. Appends history. Requires a verified evidence quote that shows the fix or break, `refute: "holds"`, and `commit` or `fingerprint`. | decision | audit |
| `resolve-fix` | Re-implemented as an alias of `ledger-status → fixed`. `new:"remove"` is refused. | decision | audit |
| `rule-set` | Adds, edits or retires a rule. It may carry paired `set` ops on that rule's anchors (the user re-deciding wording). It updates `decidedWindowHash` via rules.mjs. | decision | rules |
| `rule-dismiss` | Records a user dismissal of a `rule-at-risk` flag in `history.jsonl` (no `sop.json` change). | decision | rules |

Removed: `meta-verified`. Stamps are registry-only (§3.3).

**Auto allow-list (replaces the check at sop-patch `:342`).**

- Allowed as auto: `reanchor` (including `/rules/N/src` and ledger or fix `src`), and `ledger-status` that touches only `lastVerified`.
- Any other kind marked or computed auto is refused.
- The existing C2 case "tier auto on a set refused" is kept.

**Source refusals (hard, so nothing is written for those ops; they are reported as needs-human):**

- **session and all-\*:**
  - `add-fix`, `resolve-fix`, `ledger-add`, `ledger-status`, `rule-set` and `rule-dismiss` are refused.
  - `insert`, `remove`, `move` and `set` under `/ledger/items/**` or `/guide/*/fixes/**` are refused. The one exception is `reanchor` of a `src`.
  - Any op under `/rules/**` other than `reanchor` of `src` is refused.
  - Session no longer rewrites ledger title or body. A stale ledger cite produces a needs-human "run /zyt-audit" row.
- **audit:** everything except the ledger ops in the table above is refused.
- **rules:** only `rule-set`, `rule-dismiss` and paired anchor `set`s are allowed.

**Rule guard (safety blocker 1).** Two lint layers:

1. **Anchored paths.** Any `set`, `insert`, `remove` or `move` whose path equals, or is an ancestor of, a rule anchor is **hard-refused** for every source except `rules`, whatever the literals say. Removing an ancestor of an anchor is refused for all sources.
2. **Unanchored strings.** Any op whose old value contains **all** literals of some rule, but whose path is not anchored, is escalated to `confirm` with a lint line under "Rule conflicts". The escalation triggers when the new value drops a literal, or when it adds or removes a negation or modality token: `not`, `no longer`, `never`, `cannot`, `can't`, `optional`, `only`, `must`.

**Anchor remap (correctness major).** Before applying, sop-patch records for each rule anchor the parent container object and key (object identity in the working clone), and for each `rules[].steps` value the step object. After applying, it recomputes the pointers and step n values from the same objects and writes them into `rules[]`. The remap is listed in the `history.jsonl` row as `anchorRemap`. An op that would orphan an anchor is refused.

**Legacy and fixture guard (safety major).** sop-patch resolves the page from the registry by `sopJson` path and refuses to write when any of these hold:

- the page `status` is `legacy`;
- the data path lies under `SW\fixtures\` (override `--allow-fixture`, used only by C2's own temp copies, which live under `tests\c2\work`, not `SW\fixtures`);
- `ZYT_ALLOW_PAGES` is set and the page id does not match it (comma-separated globs).

**Writers.** sop-patch stays the only writer of page content. `rules.mjs apply` writes through sop-patch. `migrate-tracker.mjs` is a document transform that uses the shared `lib/sop-write.mjs`, which is extracted from sop-patch and reused by both. The contract names these two writers explicitly.

## 4. Phases

### Phase 0: harness, contracts and the ticked rules (lead + Agent K). No journey; it is a precondition.

**Lead** writes `W\contracts.md` with the §3 shapes, the source/tier table and the anchor grammar before any fan-out. The lead owns that file in every phase.

**Agent K (test harness)** owns the new files under `W\tests\e2e\`:

1. **`project-guard.mjs snapshot|compare --out RUN\project-guard.json`.** Records sha256 of every file under `C:\Project\JWASystemv2\jwa-system\sop\`, plus `C:\Project\ZYT-Task\customer-intake-sop.html` and `C:\Project\ZYT-Task\hosting\`. Records path, size and mtime of every file under `C:\Project\JWASystemv2\jwa-system` and `C:\Project\NCT\nct-layout`, excluding `node_modules`, `.git`, `dist`, `.turbo`, `.output` and `C:\Project\ZYT-Task\_plan`. `compare` exits 1 on any diff and prints them. The script never relies on git.
2. **`archive-copy.mjs` and `restore-copy.mjs`.** Copy `COPY\packages\backend\convex\` and `CSOP\` (including `.zyt\`), plus the `jwa-copy/jwa-full-chain` registry entry, to `RUN\pre\`. Restore copies them back and verifies hashes against `RUN\pre\hashes.json`. Each e2e script first checks that its start state matches a recorded hash (`RUN\baseline.json`) and exits 2 otherwise.
3. **Move the prior pending set.** Moves `CSOP\.zyt\pending-2026-09-15.json` and any `update-2026-09-15.md` into `RUN\prior\`. This is a move within the workspace, not a delete, so later runs cannot merge into stale op ids.
4. **`rules-ticked.json`**, written in full below and checked by `precheck-rules.mjs`. For every rule, the precheck asserts that each anchor resolves to a string, that each anchor contains every literal (case-insensitive), and that each `src` line exists and contains the expected quote (the `srcQuote` field, used only by the harness). It fails loudly on any mismatch.

```json
[
 {"id":"R3","text":"Only the CFO (or an admin) approves a project's BQ budget","kind":"role","steps":[4],
  "anchors":["/steps/3/what","/guide/3/role"],"literals":["CFO"],
  "src":["packages/backend/convex/projectBudgets.ts:717"],"srcQuote":"requireAnyRole(ctx, [...APPROVE_ROLES])","enforcement":"code"},
 {"id":"R5","text":"Only members of the project can raise an SRF on it","kind":"permission","steps":[2,5],
  "anchors":["/steps/1/what","/guide/4/role","/guide/4/before/0"],"literals":["member"],
  "src":["packages/backend/convex/srfForms.ts:130"],"srcQuote":"You are not assigned to this project","enforcement":"code"},
 {"id":"R6","text":"The Construction Manager decides every line before the PM","kind":"gate","steps":[6],
  "anchors":["/steps/5/what","/guide/5/role"],"literals":["Construction Manager"],
  "src":["packages/backend/convex/srfApprovals.ts:523"],"srcQuote":"requireAnyRole(ctx, [...CM_GATE_ROLES])","enforcement":"code"},
 {"id":"R7","text":"Nobody approves an SRF they raised themselves","kind":"permission","steps":[6,7],
  "anchors":["/guide/5/before/1","/guide/6/before/1"],"literals":["did not raise"],
  "src":["packages/backend/convex/srfApprovals.ts:40"],"srcQuote":"if (srf && srf.requestorId === approverAuthUserId) {","enforcement":"code","ledgerId":"admin-self-approval"},
 {"id":"R10","text":"A supplier line cannot be ticked Done until its price comparison is approved","kind":"gate","steps":[12],
  "anchors":["/steps/11/what","/guide/11/before/1","/guide/11/golden/1/action"],"literals":["price comparison","approved"],
  "src":["packages/backend/convex/srfPurchasing.ts:840"],"srcQuote":"if (approvedComparisonPrice == null) {","enforcement":"code"},
 {"id":"R11","text":"Only the CFO (or an admin) approves a price comparison","kind":"role","steps":[10],
  "anchors":["/steps/9/what","/guide/9/role"],"literals":["CFO"],
  "src":["packages/backend/convex/priceComparisons.ts:212"],"srcQuote":"requireAnyRole(ctx, [\"admin\", \"cfo\"])","enforcement":"code","ledgerId":"approval-queues-unmounted"},
 {"id":"R12","text":"A line above the big-amount threshold needs Director approval before Done","kind":"threshold","steps":[12],
  "anchors":["/steps/11/what","/guide/11/before/2","/guide/11/golden/2/action"],"literals":["Director"],
  "src":["packages/backend/convex/srfPurchasing.ts:858"],"srcQuote":"if (requiresDirector && !detail.directorApprovedBy) {","enforcement":"code"},
 {"id":"R13","text":"SRF lines are not approved beyond the approved BQ budget","kind":"threshold","steps":[4,7],
  "anchors":["/guide/3/pitfalls/0","/guide/6/pitfalls/0"],"literals":["budget"],
  "src":["packages/backend/convex/srfApprovals.ts:555"],"srcQuote":"","enforcement":"none","ledgerId":"budget-not-enforced"}
]
```

Two notes on the rules:

- **Line numbers.** Where an `srcQuote` does not match the line at run time, K corrects the line number, never the quote, and records the correction in `RUN\phase0.md`. Lines 717 (R3) and 858 (R12) were derived from the grep, and K confirms them.
- **R13** has an empty `srcQuote`, because `none` rules cite where the check is missing.

**Gate (Phase 0):**

- `node W\tests\e2e\precheck-rules.mjs --data CSOP\sop.json --rules W\tests\e2e\rules-ticked.json` exits 0.
- `project-guard.mjs snapshot` has written `RUN\project-guard.json`.
- `RUN\pre\hashes.json` exists, and `restore-copy.mjs --verify-only` exits 0.
- `CSOP\.zyt\` contains no `pending-*.json`, and `RUN\prior\pending-2026-09-15.json` exists.
- The copy's `sop.json` has no `/unmark|decideLineItemsBulk|Approve remaining/i` match inside any `src`. This is the precondition for the planted defect being invisible to update.

### Phase 1: J2 plus J1 hardening (rule regression flagged, page text preserved)

**Owners:**

- **Agent A (schema and validation)** owns `S\zyt-setup\scripts\build-page.mjs` (validate only, §3.5), `S\zyt-setup\references\sop-json-schema.md`, and the new `SW\fixtures\validate-neg\` with `SW\fixtures\validate-neg.mjs`.
- **Agent B (patching)** owns:
  - `U\scripts\sop-patch.mjs`: computed tiers, the decision tier, the source table, the rule guard, the anchor remap, the legacy, fixture and ZYT_ALLOW_PAGES guard, the new ops, and `resolve-fix` re-implemented.
  - the new `U\scripts\lib\sop-write.mjs`
  - `U\references\changeset-schema.md`
  - `W\tests\c2\run-all.mjs`
- **Agent C (staleness and evidence)** owns:
  - `U\scripts\snapshot.mjs`: the rules index with decided hashes carried forward.
  - `U\scripts\lib\cites.mjs`: `kindOf → 'rule'` for `/rules/`, `stepOf` from `rules[].steps`, and skipping `/evidence/` and `/history/`.
  - `U\scripts\lib\staleness-core.mjs`: `rule-at-risk` against `decidedWindowHash`, window missing or file missing; the state is `tracked` when an open rule-violation item for the rule exists, or `dismissed` when history has a `rule-dismiss`; not added to the ultracode escalation reasons.
  - `U\scripts\evidence-verify.mjs`: `absent` support.
  - `U\references\manifest.md`
  - `W\tests\c1\run-all.mjs`
- **Agent D (CLIs and session mode)** owns:
  - `U\scripts\rules.mjs`: `apply --page --candidates --accept <ids>` emits a rule-set changeset and runs sop-patch with `--source rules`, then writes decided hashes through snapshot's exported function. Also `dismiss --page --rule --note` and `list --page`.
  - `U\scripts\migrate-tracker.mjs`
  - `U\scripts\registry.mjs`: `ZYT_ALLOW_PAGES` filtering in the page-listing helper, and `record --synced-scope`.
  - `U\SKILL.md` session-mode edits:
    - the drift example at `:8`
    - `:37`: rule anchors feed Rule conflicts, not ops
    - `:38`: session no longer rewrites ledger text; stale ledger cites become "run /zyt-audit" rows
    - `:43`: GATE 1 group "Rule conflicts → proposed ledger items", with accept, decline or dismiss
    - a line saying update never adds defects other than rule violations
    - a line saying update detects regressions only at cited windows and audit is the backstop
  - `U\references\registry.md` and the `W\contracts.md` §1 registry fields. D sends the text to the lead, who edits `contracts.md`.

**Contract between agents:** B exports `computeTier(op, doc)` and `SOURCE_RULES` from sop-patch. C exports `windowHash(file, line)` from snapshot. D imports both. No agent edits another's file.

**Steps on the copy (lead, after the agents finish):**

1. `migrate-tracker.mjs --data CSOP\sop.json --dry` records the sha. Then run it with `--expect-sha <sha>` (in place).
2. `rules.mjs apply --page jwa-copy/jwa-full-chain --candidates W\tests\e2e\rules-ticked.json --accept R3,R5,R6,R7,R10,R11,R12,R13`.
3. `snapshot.mjs --page jwa-copy/jwa-full-chain`. Then copy `CSOP\sop.json` to `RUN\baseline.sop.json`, and write `RUN\baseline.json` with the sop sha, the manifest sha and the `history.jsonl` line count.

**C2 additions (B), at least 14:**

- a rule-anchored `set` keeping all literals but adding "no longer" is refused;
- a rule-anchored `set` from session with an identical-literal label rename is refused and reported with the rule id;
- a `rules`-source paired rule-set plus anchor `set` is accepted by explicit id;
- an unanchored string with all R10 literals plus a negation is escalated to confirm with a lint line;
- `insert` of a step before `/steps/11` shifts the R10 and R12 anchors to `/steps/12/...` and `steps` to `[13]`, with an `anchorRemap` history row;
- `remove` of `/steps/11` is refused (it orphans anchors);
- `rule-violation` applies with anchors byte-equal and evidence mapped to `{at, quote, date}`;
- `ledger-add` from source session is refused;
- `ledger-status` transition to fixed with `--accept all` is not accepted, while by explicit id it is accepted when it has `refute:"holds"` and a verified quote, and refused without them;
- `resolve-fix new:"remove"` is refused;
- `add-fix` from session is refused;
- `ledger-status` lastVerified-only with `--accept auto` is accepted;
- `set` with auto tier is still refused;
- `--source audit` on a `cs.source: session` changeset is refused;
- writing to a registry `legacy` page, or to a path under `SW\fixtures\`, exits non-zero and the fixture sha256 is unchanged;
- `ZYT_ALLOW_PAGES=jwa-copy/*` refuses a write to a `jwa-system/*` data path (tested with a temp registry under `tests\c2\zyt`).

**C1 additions (C, D), at least 8:**

- the manifest cite count is unchanged after migration: evidence and history are not cites;
- rule cites carry `kind: rule` and `step` from `rules[].steps`;
- deleting the R10 window gives `rule-at-risk R10`;
- commenting out the R10 throw gives `rule-at-risk R10`;
- moving the unchanged window by +5 lines gives a reanchor, not rule-at-risk;
- re-snapshot after a plant keeps `decidedWindowHash`, and staleness still reports R10;
- after `rules.mjs dismiss`, staleness reports R10 as `dismissed`, not at-risk;
- `rule-at-risk` is not in the escalation reasons;
- migrate maps "Partly fixed:" to `partly-fixed`; `--revert` restores a byte-identical file.

**Validate negatives (A).** One fixture per §3.5 error, each asserting its named error:

- duplicate rule id
- a none rule without ledgerId
- a dangling anchor
- an anchor resolving to an object
- an anchor missing a literal
- fixed without fixedAt
- rule-violation with an unknown ruleId
- a duplicate fix id on native v2
- a bad `history.to`
- absolute `evidence.at`

Plus one warnings fixture: a fixed item with no `lastVerified`.

**`W\tests\e2e\run-rule-regression.mjs` (K; scripted, works on a temp clone of the copy in the scratchpad):**

1. Plant by exact text: delete the block `if (approvedComparisonPrice == null) {\n      throw new ConvexError(\n        "An approved price comparison is required before completing this item"\n      );\n    }`.
2. Staleness asserts `rule-at-risk R10`, and asserts that the manifest's decided hash differs from the current window hash.
3. A naive session `set` on `/steps/11/what` that drops "an approved price comparison" is refused.
4. A `rule-violation` op is fed through evidence-verify and then sop-patch. Its evidence is `quote: "const approvedComparisonPrice = await lookupApprovedComparisonPrice("` at `srfPurchasing.ts:836`, plus `absent: "An approved price comparison is required before completing this item"`.
5. The three R10 anchors are byte-equal to `baseline.sop.json`. Exactly one item exists with `origin: rule-violation`, `ruleId: R10`, `status: open`, and evidence `at` matching `/srfPurchasing\.ts:83\d/`.
6. Re-snapshot, then staleness reports R10 as `tracked`.
7. Variant: on a fresh clone, comment out the throw instead, decline the op, re-snapshot, and assert that staleness **still** reports `rule-at-risk R10`.

**Live mini-J2 (the Phase 1 journey proof).** A fresh subagent runs `/zyt-update` session mode on the copy with `ZYT_ALLOW_PAGES=jwa-copy/*`.

- **Plant.** It applies the same R10 plant with the Edit tool in that session.
- **GATE 1 answer policy.** Accept every `rule-violation` id and every auto op; decline everything else.
- **Assertions.** `W\tests\e2e\assert-update.mjs --phase1` checks the subset of §6 step 3.
- **Afterwards.** `restore-copy.mjs`, then re-run Phase 1 steps 1-3 so the baseline is restored.

**Gate (Phase 1):**

- `node SW\fixtures\regress.mjs`: exit 0 and prints `ALL PASS`.
- `node W\tests\c1\run-all.mjs`: prints `N passed, 0 failed` with N ≥ 67.
- `node W\tests\c2\run-all.mjs`: prints `N passed, 0 failed` with N ≥ 34.
- `node SW\fixtures\validate-neg.mjs`: exit 0.
- `node S\zyt-setup\scripts\build-page.mjs --data CSOP\sop.json --out <scratch>\copy.html`: exit 0, with no validation errors.
- `run-rule-regression.mjs`: exit 0.
- The live mini-J2 `assert-update.mjs --phase1`: exit 0.
- `Select-String U\SKILL.md -Pattern "Rule conflicts","rule-at-risk","zyt-audit"`: all three found.
- `project-guard.mjs compare`: exit 0.

### Phase 2: J6a/J6b plus the trust stamp (staff see trust; the internal build shows status and history)

**Owners:**

- **Agent E (template)** owns `S\zyt-setup\assets\sop-template.html`:
  - **Trust line.** Rendered after `#colophon`, only when `#sop-trust` exists.
  - **Ledger and modal model.** `ITEMS` status, `fixedAt`, `firstFound` and `history` are read from `window.SOP_DATA.ledger.items` (and fixes) **by id**, not scraped from the DOM.
  - **Status tag.** Rendered as a sibling **outside** `.txt > b`. Its class `status-tag` is added to both strip lists (`:2255`, `:3014`).
  - **Modal.** The `<details>` history appears in the ledger `li` and the fix modal, only when the fields exist.
  - **Fixed items.** Rendered ticked, locked (the tick is not toggleable) and dimmed. They are excluded from `gap-count` **and** `gap-total`; `paintProgress` uses open plus partly-fixed ITEMS.
  - **Rule-violation items.** A "Rule Rn broken" tag.
  - **Rules appendix.** Rendered only when `rules[]` exists. `ledgerId` links render only when the ledger is present.
  - Every new render path is conditional on its field. No severity-list refactor.
- **Agent A** owns `build-page.mjs`: the `--verified-at` and `--verified-commit` flags, the `#sop-trust` script tag, cited share after strip, `ledgerId` stripped in `--no-ledger`, and a CLI summary of rule count plus open, partly-fixed and fixed counts.
- **Agent F (render checks)** owns:
  - `S\zyt-setup\scripts\check-page.mjs`: asserts the trust line text, `li.fixed[aria-disabled]` lock and `.status-tag` when the data has them; in `--no-ledger` builds, asserts no `.status-tag` and no `details.history`.
  - the new `SW\fixtures\nct-v2\` and `SW\fixtures\regress-v2.mjs`
- **Agent D** owns `U\scripts\publish-page.ps1` (passes registry `verifiedAt` and `verifiedCommit` to the build; no other change) and `U\SKILL.md` (session writes `lastSyncedScope` only; full-page runs write `verifiedAt`).

**`regress-v2.mjs` (F):**

1. Build `nct-v2` with the ledger. Set one open item to `fixed` in a temp copy. Rail open count and modal open count both drop by exactly 1, and they stay equal.
2. With `.status-tag` present, the modal card title equals the ledger `<b>` title text for every item.
3. Build with `--verified-at 2026-09-15`. The test computes the expected share from the embedded JSON with the §3.3 formula, independently of build-page, and asserts the exact string `/\b(\d+)% of claims cited to code\b/` equals it.
4. Build with `--no-ledger --verified-at …`. The embedded JSON has no `ledger`, `history`, `evidence` or `ledgerId`. The trust percentage equals the formula on the stripped data.
5. On the copy (JWA, migrated), tick keys (`fixes/<id>`) before and after migration are equal. This is computed from the `RUN\pre` build and the migrated build.

**Gate (Phase 2):**

- `regress.mjs`: exit 0 and `ALL PASS`. This includes the NCT mast, colophon and gapsText identity, the rail equals modal count, and a **new** check that NCT's embedded JSON is exactly `JSON.stringify` of the source (after the existing strip) with no `#sop-trust` tag. F adds it to regress.mjs; the lead approves the one-line addition, which is the only regress.mjs edit.
- `node SW\fixtures\regress-v2.mjs`: exit 0.
- Two copy builds:
  - (a) `build-page.mjs --data CSOP\sop.json --no-ledger --verified-at 2026-09-15 --out <scratch>\pub.html`, then `check-page.mjs --guides --screenshots`. Pass: the trust line is present, the Rules appendix has 8 rules, and there are zero `.status-tag` elements.
  - (b) `build-page.mjs --data CSOP\sop.json --verified-at 2026-09-15 --out RUN\internal.html`, then `check-page.mjs --guides --screenshots`. Pass: `receive-role-mismatch` has `.status-tag` text "Partly fixed", and gap-count equals the modal open count. Screenshots are saved to `RUN\shots\`.
- `project-guard.mjs compare`: exit 0.

### Phase 3: J4 and J5 (proposing and ticking rules)

**Owners:**

- **Agent D:**
  - `U\scripts\rules.mjs propose --page <id> [--out]`. A deterministic scan of `steps[].what`, `steps[].watch.text`, `guide[].role`, `before[]`, `pitfalls[]` and `breaks[].body` for role names (from the page's `guide[].role` backend lists), approve/approves, only, must, cannot, not … until, amounts or thresholds, and status literals. It emits candidates `{candidateId, text, kind, steps, anchors, literals}`. It never writes `sop.json`, and for sop dirs under `C:\Project` its default `--out` is `~/.claude/zyt/pending/<slug>/`.
  - `U\SKILL.md` `--rules` mode: an agent adds `src`, `enforcement` and `ledgerId`; tick lists of at most 15; `apply` by explicit ids; `dismiss` flow.
- **Agent G** owns `S\zyt-setup\SKILL.md`: a "Propose rules" step after the guide draft, using the same `rules.mjs`.

**Coverage definition.** Candidate C covers ticked rule R if `C.anchors ∩ R.anchors ≠ ∅` **and** at least one of R.literals appears in some C.literals. Match is by anchor pointer, not by id.

**C1 additions (D):**

- `propose` on `RUN\baseline.sop.json` covers every one of R3, R5, R6, R7, R10, R11, R12 (R13 is prose about a missing check and is not required).
- `propose` on NCT (`fixtures\nct\sop.json`, read-only) covers at least 3 candidates with anchors on the N1-N3 approval steps: the test fixes their pointers after K reads the NCT fixture. The fixture sha256 is unchanged, and nothing is written under `SW\fixtures\nct\`.

**Gate (Phase 3):**

- `node W\tests\c1\run-all.mjs`: `N passed, 0 failed`.
- **Real JWA dry proposal:** `ZYT_ALLOW_PAGES=jwa-system/jwa-full-chain node U\scripts\rules.mjs propose --page jwa-system/jwa-full-chain --out %USERPROFILE%\.claude\zyt\pending\jwa-full-chain\rules-proposed.json`. Pass: the output exists, it covers the R-rules equivalents by the same anchor pointers (the real page's anchors are compared after a read-only precheck), and `project-guard.mjs compare` exits 0.
- **Setup flow on a scratch page:** copy `SW\fixtures\jwa\sop.json` to `<scratch>\setup-rules\sop.json`, run the documented setup rules step (`rules.mjs propose --data <that> --out <scratch>\setup-rules\cand.json`, then `rules.mjs apply --data <that> --candidates <cand> --accept <first 3 ids>`), then `build-page.mjs`. Pass: `rules[]` has 3 entries and validation passes. If `SW\fixtures\jwa\` does not exist, use `RUN\pre\sop\jwa-full-chain\sop.json`.

### Phase 4: J3 (zyt-audit, and --all becomes sync-only)

**Pre-step (lead).** Load the `workflow-authoring` skill and confirm whether Workflow scripts may `import` modules. The existing script imports nothing (§0), so the default assumption is **no imports**. Workflows hold inline constants (script paths, the op-kind→tier table), and a D-suite test asserts that each inline table deep-equals sop-patch's exported `SOURCE_RULES` and tier table. Composers still run `sop-patch --dry` through agents as they do today.

**Owners:**

- **Agent H (new audit skill):**
  - `A\SKILL.md`:
    - Triggers and cadence.
    - Default is ultracode. Flags: `--light`, `--page` (**required** unless `--all-pages`), `--budget <agents>` (default 25).
    - **GATE 0.** `A\scripts\audit-plan.mjs --page` prints the planned agent count per role and an estimated token range, and the skill asks before fan-out.
    - Legacy pages are report-only.
    - The "Runtime proof offered" section. Never run it.
  - `A\workflows\zyt-audit.js`:
    - **Moved from sync-all:** the attackers (`MONEY_RE`, `isMoneyStep`), the ledger checker (now emitting `ledger-status`), and a defect sweep.
    - **Extractors:** its own copies of the perms and data-flow extractor prompts. Sync-all keeps perms (below).
    - **New agents:**
      - Rule checkers batched at most 5 rules per agent, by step group. Each compares every rule's `src` **and** every other code path that performs the same action (e.g. R7 on both the single and bulk approve paths) against the rule text.
      - Pattern hunters for the five patterns in `defect-patterns.md`.
      - Refuters run only on proposed `ledger-add`, `rule-violation`, transitions and reopens.
      - A composer that emits only §3.6 audit ops and writes `<sopDir>\.zyt\audit-<date>.json` and `audit-<date>.md`.
    - **Budget.** The workflow throws before its first `agent()` call if the planned count exceeds `--budget`.
  - `A\references\defect-patterns.md`. `role-mismatch` means the UI shows an action to a role the backend guard refuses, **or** the backend guard admits a role the page's role claim for that action does not. `unenforced-approval` means an approval rule enforced on one code path but not on another path that performs the same state change.
  - `A\references\audit-report.md`
  - `A\scripts\audit-apply.ps1`. It resolves the page from the registry and refuses `legacy`, refuses `--accept all`, allows `auto` plus explicit ids, and calls `U\scripts\sop-patch.mjs` (whose `cs.source` must be `audit`).
- **Agent I (sync-only workflow):**
  - `U\workflows\zyt-sync-all.js`:
    - **Removed:** the attackers (`attack …`) and the ledger checker (`ledger …`).
    - **Kept:** the perms extractor, which feeds descriptive role claims.
    - **Descriptive-only:** the sweep, with prompt text "descriptive drift only".
    - **Mapper and sweep gate lines** (`:452`, `:491`): a gate or role finding that matches a rule anchor or rule src emits `rule-violation`, otherwise needs-human.
    - Removed `add-fix` and `resolve-fix` from `OP_RULES` and the kind enum.
    - `tierFor` uses the inline copy of sop-patch's table.
    - `verifiedAt` is recorded only when every step was checked.
  - `U\references\all-mode.md` and the `U\SKILL.md` `--all` section.
  - `W\tests\d\run-stub.mjs`. `killLabels` stays `extract perms ultra-page`. It asserts that no agent label starts with `ledger ` or `attack `, and that composer ops are only descriptive kinds or `rule-violation`. It also asserts the inline tier table equals the sop-patch export.
- **Agent J (audit stub and bookkeeping):**
  - The new `W\tests\d\run-audit-stub.mjs`. It asserts:
    - every op kind is in {`rule-violation`, `ledger-add`, `ledger-status`};
    - prompts contain READ-ONLY and EVIDENCE RULE;
    - a legacy page yields zero applicable ops, and `audit-apply.ps1` on `ZYT-Task/customer-intake-sop` exits non-zero with the fixture sha unchanged;
    - the report has a "Runtime proof offered" section;
    - no Bash call string matches `/e2e|playwright|convex (dev|deploy|run)|npm run dev|pnpm dev/`;
    - the GATE 0 preflight log line precedes the first agent call;
    - the agent count is at most the budget, and the run throws when the plan exceeds it;
    - a stub composer that proposes `fixed` without a quote or refuter is refused by sop-patch.
  - `U\scripts\registry.mjs`: `record --audited-at`. It also updates `U\references\registry.md` and sends `contracts.md` §1 text to the lead **in this phase**.
  - `U\hooks\zyt-remind.mjs`. The audit nudge lives only inside the existing touched-rows branch: touched rows map to a non-legacy page whose `auditedAt` is missing or more than 30 days old. It is merged into the same single `systemMessage` and flag. It adds no extra file reads beyond the registry already read.
  - `W\tests\c2\run-all.mjs` hook cases, coordinated with B's ownership: J sends the cases to B, who adds them:
    - no touches gives no output;
    - touched non-legacy with `auditedAt` 31 days ago includes the nudge;
    - 29 days ago gives no nudge;
    - a legacy page gives no nudge;
    - malformed `pages.json` exits 0;
    - `record --audited-at` writes an ISO date.

**Gate (Phase 4):**

- `node W\tests\d\run-stub.mjs` and `node W\tests\d\run-audit-stub.mjs`: exit 0.
- C1 and C2: `N passed, 0 failed`.
- `regress.mjs`: `ALL PASS`.
- `project-guard.mjs compare`: exit 0.

### Phase 5: full end-to-end and docs

**Owners:** the lead, with K's `W\tests\e2e\` scripts (`assert-update.mjs`, `assert-audit.mjs`). **Docs:** the final `W\contracts.md`. **Gate:** §6.

## 5. Risks

| Risk | Mitigation |
|---|---|
| NCT regression identity breaks | Every new render path is field-conditional. Trust data is in a separate script tag, never in the embedded JSON. A new regress check asserts NCT's embedded JSON equals the source. The severity refactor is dropped. `fixtures\nct\sop.json` is never migrated. regress runs at every gate. |
| A rule is silently reworded by a sync | Hard refusal on anchored paths for all non-`rules` sources. The negation and literal lint escalates unanchored rule prose. C2 negation cases. |
| A re-baseline absorbs a regression | Decided window hashes are moved only by `rules.mjs`. snapshot and publish copy them forward. The declined-op variant is in `run-rule-regression.mjs`. |
| Gates removed away from the cited window (commented out, wrapped, caller bypassed) | Comment-stripped window hash catches comment-out and wrap. Bypass elsewhere is a documented update limitation. Audit rule checkers inspect every path performing the action, and the e2e plants exactly such a case (§6 P2). |
| A hallucinated "fixed" hides a real bug | sop-patch computes tiers. Transitions are `decision` tier: explicit id only, with a verified quote, a refuter "holds" and a commit or fingerprint. `audit-apply.ps1` refuses `all`. C2 and the audit stub cover it. |
| Trust signal overstates verification | Session writes only `lastSyncedAt` and scope. `verifiedAt` comes only from full-page runs. `lastVerified` is audit-only with evidence. |
| Anchors drift after structural ops | Identity-based remap in sop-patch. Orphaning ops are refused. C2 insert and remove cases. |
| False rule violations (refactors, config gates) | `rule-at-risk` is a flag. `rule-violation` needs verified evidence. Refuters run in audit. `config` rules report "config-dependent". rule-violation is always at least confirm. The user can dismiss, and the dismissal is recorded. |
| Legacy NCT page or fixtures get written | sop-patch refuses legacy pages and `SW\fixtures\` paths. `audit-apply.ps1` refuses legacy. C2 and the stub assert the fixture sha is unchanged. |
| Writes under `C:\Project` go unnoticed (no git; ignored `.zyt\`) | `project-guard.mjs` hash and mtime manifest at every gate. `ZYT_ALLOW_PAGES` enforced by registry listing and sop-patch. zyt-audit requires `--page`. Real-JWA outputs go to `~/.claude/zyt/pending`. |
| Migration loses edits or cannot be undone | Backup plus source-sha pin plus `--revert`. Real JWA apply is a separate user step that re-checks the sha and re-snapshots. |
| Stale pending file contaminates J2 | Moved to `RUN\prior\` in Phase 0. The assert scripts read only the new changeset path, and check `baseline.json` before starting. |
| Workflow runtime cannot import modules | Inline tables plus an equality test (Phase 4 pre-step). |
| Token cost of ultracode audit | GATE 0 preflight and ask. Default `--budget 25`, enforced in the workflow. Rule checkers batched at most 5 per agent. Refuters only on risky ops. Nudge at 30 days only on touched pages. |
| Installed hooks | `zyt-touch.mjs` untouched. `zyt-remind.mjs` nudge is additive and inside the existing branch. C2 hook cases. No `settings.json` edits. |
| Viewer ticks vs data status | Fixed locks the tick. A viewer tick never changes `status`. Tick keys stay stable across migration (regress-v2 case 5). |
| Descriptive sync blocked by rule-anchored strings | Surfaced as needs-human "Rule conflicts" with the rule id. The user resolves it with `/zyt-update --rules` (paired rule-set plus set). This friction is accepted by design. |

## 6. Verification (end to end, on the JWA copy)

All steps run with `ZYT_ALLOW_PAGES=jwa-copy/*`. Every artifact goes under `RUN\`.

**0. Start state.** `restore-copy.mjs --verify-only` against `RUN\pre\`, then Phase 1 steps 1-3 (migrate, rules apply, snapshot, which writes `RUN\baseline.json` and `RUN\baseline.sop.json`). `staleness.mjs --page jwa-copy/jwa-full-chain` exits 0 with no `rule-at-risk`. `precheck-rules.mjs` exits 0. The copy's `sop.json` has no `unmark` and no `decideLineItemsBulk` text: the planted defect P2 is invisible to update **by design**.

**1. Plants.** Each is made by exact text with the Edit tool, inside the J2 session.

- **P1 (rule regression, R10).** In `srfPurchasing.ts` `markLineItemCompleted`, delete the 5-line block `if (approvedComparisonPrice == null) { throw new ConvexError("An approved price comparison is required before completing this item"); }`.
- **P2 (defect for audit).** In `srfApprovals.ts` `decideLineItemsBulk`, delete the single line `await assertNotSelfApproval(ctx, authUserId, args.srfId);` (currently :1073). R7 cites only `srfApprovals.ts:40`, whose decided window (lines 37-43) is unaffected by P2. Update therefore cannot see P2 by design: the rule is still enforced at the cited site and bypassed on a second path. The audit's R7 rule checker and the `unenforced-approval` hunter must find it.

**2. J2 (live session update).** A fresh subagent runs `/zyt-update` in session mode on `jwa-copy/jwa-full-chain`, in the same session where P1 and P2 were applied. Session scope must list both files; the check is on `sop-scope.json`.

- **GATE 1 policy:** accept every `rule-violation` id and every auto op; decline everything else.
- **Artifacts:** `CSOP\.zyt\pending-<date>.json` and `CSOP\.zyt\update-<date>.md`, copied to `RUN\j2\`.

`node W\tests\e2e\assert-update.mjs` asserts:

- the report has a "Rule conflicts" section naming R10;
- the changeset contains a `rule-violation` op with `ruleId: R10`, evidence `absent` of the throw message, and a quote at `/srfPurchasing\.ts:83\d/`;
- after apply, all three R10 anchors and all other `/rules/**` anchors are byte-equal to `baseline.sop.json`;
- exactly one new ledger item with `origin: rule-violation`, `ruleId: R10`, `status: open`;
- no op path or text references `decideLineItemsBulk`, `assertNotSelfApproval` or `admin-self-approval`;
- no op is `ledger-add` or `ledger-status`, and no op writes ledger title or body;
- **tolerated:** auto `reanchor` ops for cites on `srfPurchasing.ts` after line 844 (-5) and on `srfApprovals.ts` after line 1073 (-1), including `/rules/*/src` for R12, and a needs-human row for `approval-queues-unmounted` (its `:840` cite changed), which says "run /zyt-audit";
- `history.jsonl` gained exactly one apply row whose accepted ids include the R10 rule-violation op id;
- re-run staleness gives R10 `tracked`.

**3. P3 (real fix for audit to find).** After J2 assertions pass, edit `srfPurchasing.ts` `updatePurchasingDetail` guard to `["purchasing", "warehouse", "inventory_manager", "admin"]` by exact text.

**4. J3 (audit).** A fresh subagent runs `/zyt-audit --page jwa-copy/jwa-full-chain` (ultracode, default budget). It answers GATE 0 with "proceed" and records the preflight output to `RUN\j3\preflight.txt`. Artifacts are `CSOP\.zyt\audit-<date>.json` and `.md`, copied to `RUN\j3\run1\`.

- **Apply:** `audit-apply.ps1 -Page jwa-copy/jwa-full-chain -Accept auto,<ids of every ledger-add and rule-violation>,<id of the receive-role-mismatch transition>`.
- **Flake rule:** at most one rerun (`run2\`) if an assertion about *finding* fails. Safety assertions never get a rerun. Both runs are recorded.

`node W\tests\e2e\assert-audit.mjs` asserts:

- every op kind is in {rule-violation, ledger-add, ledger-status};
- zero ops on `/steps/**`, `/guide/**` (except `/guide/*/fixes/*` status fields), `/rules/**`, `/chain/**`, `/breaks/**`, `/phases/**`;
- **P2 found:** a `ledger-add` with `pattern ∈ {unenforced-approval, role-mismatch}` **or** a `rule-violation` with `ruleId: R7`, whose evidence `at` matches `/srfApprovals\.ts:(9[89]\d|10\d\d)/` (inside `decideLineItemsBulk`);
- **P3 found:** a `ledger-status` for `receive-role-mismatch` from `partly-fixed` to `fixed`, tier `decision`, evidence quote containing `inventory_manager`, `refute: "holds"`; after apply, `status: fixed`, `fixedAt` = today, and a history row `by: zyt-audit`;
- **no false fixes:** no other item transitions to `fixed`; `approval-queues-unmounted` stays `open`; the R10 rule-violation item stays `open` with `lastVerified` = today;
- the report has a "Runtime proof offered" section listing `/e2e-deep --deep <route>` or `/audit-prove-a` lines;
- the run log shows the preflight before the first agent, and the agent count is at most 25;
- no Bash launch commands appear in the run transcript;
- registry `auditedAt` = today.

**5. J6.** Two builds of the copy:

- **(a) `--no-ledger --verified-at <registry verifiedAt>`.** `check-page.mjs --guides --screenshots`: the trust line is present with the formula-computed percentage, the Rules appendix has 8 rules, and there are zero `.status-tag`, `details.history` or rule-violation nodes.
- **(b) Ledger build to `RUN\internal.html`.** `check-page.mjs --guides --screenshots`:
  - `li[data-id="receive-role-mismatch"].fixed` has the locked tick;
  - `li[data-id="rv-r10"] .status-tag` reads "Open", with "Rule R10 broken";
  - gap-count equals the modal open count, which equals the count of items with status in {open, partly-fixed}.

Screenshots go to `RUN\shots\`. Because `verifiedAt` requires a full-page run, step 4 (audit covers every step) writes it, and the build reads it from the registry.

**6. Suites.**

- `regress.mjs`: `ALL PASS`.
- C1 and C2: `N passed, 0 failed` (N ≥ 67 and N ≥ 34 respectively, higher after Phases 3-4).
- `run-stub.mjs` and `run-audit-stub.mjs`: exit 0.
- `regress-v2.mjs` and `validate-neg.mjs`: exit 0.

**7. Safety.**

- `project-guard.mjs compare`: exit 0.
- A search of `RUN\` transcripts and logs for `publish-page.ps1|publish.ps1|deploy-site.ps1|wrangler` finds nothing.
- No Convex, dev-server or Playwright-against-app command appears in any transcript (`check-page.mjs` renders only the static built HTML).
- `SW\fixtures\nct\sop.json` sha256 equals its Phase 0 value.

**8. Reset.** `restore-copy.mjs` returns the copy to `RUN\pre\`, leaving the e2e repeatable. The run's migrated and ruled state is kept in `RUN\final\` first.

**"Done" means** steps 0-7 pass and the artifacts are saved under `RUN\`.

## 7. Phase gate summary

| Phase | Journey | Gate (all must pass) |
|---|---|---|
| 0 | harness | precheck-rules exit 0; project-guard snapshot; archive verified; prior pending moved; unmark/bulk precondition |
| 1 | J2 + J1 hardening | regress ALL PASS; C1 ≥67/0; C2 ≥34/0; validate-neg; copy validates; run-rule-regression (incl. declined + re-snapshot variant); live mini-J2 assert; SKILL grep; guard |
| 2 | J6a/J6b | regress ALL PASS + NCT embedded-JSON identity; regress-v2 (counts, title equality, exact %, no-ledger strip, tick keys); two copy builds checked; guard |
| 3 | J4/J5 | C1 coverage by anchor for R3-R12; NCT fixture unchanged; real-JWA dry propose to pending + guard; scratch setup build validates |
| 4 | J3 | run-stub (no `ledger `/`attack ` labels, table equality); run-audit-stub (op kinds, legacy refusal, no launches, preflight, budget, fixed-needs-evidence); C1/C2; regress; guard |
| 5 | all | §6 steps 0-7 |

## 8. Open questions

1. **Real JWA migration and rule ticking.** Applying `sop.migrated.json` and ticking rules on the real page writes under `C:\Project\JWASystemv2`. Should that be a separate user-approved step after this project (recommended), or stay pending?
2. **NCT evidence.** NCT ledger items have no `src`, so audit cannot verify their status. Should backfilling citations be in scope? It would change `fixtures\nct\sop.json` and require re-baselining `regress.mjs`. The recommendation is no, with a separate `nct-v2` backfill later.
3. **Cited-share denominator.** Should it include `guide[].role` and `fields[]`? They carry no `src` today. Excluded for now.
4. **Public builds and rule violations.** Should `--no-ledger` builds show a neutral "not currently enforced" note on a rule with an open rule-violation item? The plan hides it, consistent with the existing no-ledger choice.
5. **Pending location.** Should zyt-update permanently route `.zyt\pending-*` for sop dirs under `C:\Project` to `~/.claude/zyt/pending`? That is a behaviour change to an existing skill. It is out of scope here; the plan relies on the env allowlist plus the guard.

## 9. Review disposition

Facts were re-checked on 2026-09-15 (§0). Where a reviewer was partly wrong, that is stated.

### Correctness

- **[correctness/blocker] §6 expected `receive-role-mismatch` → fixed while the code is only partly fixed** → Accepted. Migration maps "Partly fixed:" bodies to `partly-fixed`. The e2e adds plant P3 (inventory_manager added at :494) so the audit has a real fix to find, and asserts that no other item goes to `fixed` and that `approval-queues-unmounted` and R10 stay open.
- **[correctness/blocker] R10 coordinates wrong (throw at 840-844, mixed n/index, object anchor)** → Accepted. The throw is 840-844 (verified). Plants are by exact text. The anchor grammar is stated: `steps` = n, anchors = RFC 6901 with 0-based indexes, string leaves only. R10 anchors are `/steps/11/what`, `/guide/11/before/1` and `/guide/11/golden/1/action`, and precheck-rules asserts they resolve and contain the literals.
- **[correctness/major] Index anchors go stale after structural ops** → Accepted. sop-patch remaps anchors and `rules[].steps` by object identity, refuses orphaning ops, and C2 has insert and remove cases. Back-references were dropped so anchors are the single link.
- **[correctness/major] Auto tier is reanchor-only in sop-patch** → Accepted. The allow-list is now reanchor plus lastVerified-only `ledger-status`. `meta-verified` was removed (stamps moved to the registry). C2 keeps "set auto refused" and adds positive cases. The workflow tier table equality is tested.
- **[correctness/major] resolve-fix, add-fix and ledger edits still open to session and --all** → Accepted. `resolve-fix` is an alias of the decision-tier transition and `new:"remove"` is refused. `add-fix` and ledger or fix structure and text are refused for session and all-*, except `src` reanchor. SKILL.md:38 is changed. OP_RULES and the enum are cleaned in sync-all.
- **[correctness/major] Workflow scripts don't import** → Accepted (the "no import" state was verified). Phase 4 pre-step checks the workflow-authoring skill. Inline tables plus a D-suite equality test.
- **[correctness/major] Removing the perms extractor breaks descriptive role checks; wrong stub labels** → Accepted. Perms stays in sync-all. The stub keeps `killLabels` and asserts against the real prefixes `ledger ` and `attack `. The sweep stays in sync-all, descriptive only.
- **[correctness/major] Evidence `src` would be indexed as cites; shape mapping undefined** → Accepted. Evidence uses `at` and history uses `date`. cites.mjs skips `/evidence/` and `/history/`. Repo-relative paths are required. The changeset → ledger mapping is defined. C1 checks that the cite count is unchanged after migration.
- **[correctness/major] Template model is DOM-scraped; status tag would leak into titles** → Accepted. ITEMS status and history come from `SOP_DATA` by id. The tag sits outside `<b>` and is in both strip lists. Fixed items are excluded from count and total. regress-v2 checks title equality and rail = modal.
- **[correctness/major] Every page is noLedger, so J6 is invisible on public builds** → Accepted (verified in pages.json). J6 is split into J6a (public) and J6b (internal). Share is computed after the strip. `ledgerId` links are hidden without a ledger. Public violation display is open question 4. Two e2e builds.
- **[correctness/major] Stale `pending-2026-09-15.json` collides** → Accepted (verified: 17 ops, source session). Moved to `RUN\prior\` in Phase 0. Assert scripts read only the new changeset and check the baseline hash.
- **[correctness/major] meta-verified on every sync churns sop.json and live-drift** → Accepted. Stamps live in the registry and are injected at build into a separate script tag outside the hashed JSON. Session writes only `lastSyncedAt` and scope.

### Safety

- **[safety/blocker] Literal-substring lint lets a rule be negated** → Accepted. Anchored paths are hard-refused for all non-`rules` sources. Unanchored strings containing all of a rule's literals are escalated when a literal drops or a negation or modality token changes. C2 negation cases.
- **[safety/blocker] Re-snapshot absorbs the regression after a decline** → Accepted. `decidedWindowHash` in the manifest is moved only by `rules.mjs`, and snapshot and publish copy it forward. Staleness states: at-risk, tracked, dismissed. A declined plus re-snapshot variant is in `run-rule-regression.mjs`.
- **[safety/major] Bulk accept can mark real bugs fixed** → Accepted. sop-patch computes tiers. Transitions and reopens are `decision` tier (explicit id only) and require a verified quote, refuter "holds" and a commit or fingerprint. `audit-apply.ps1` refuses `all`. C2 and the audit stub cases.
- **[safety/major] Trust signal overstates (session writes verifiedAt and lastVerified)** → Accepted. `verifiedAt` only from full-page runs. `lastVerified` only from audit with evidence. `ledger-status` removed from update's sources.
- **[safety/major] Commented-out or bypassed gates escape detection** → Accepted. The window hash strips comment-only lines (so comment-out and wrap are caught, with a C1 case and a scripted variant). The update limitation is documented in SKILL.md and all-mode.md. Audit rule checkers inspect all paths performing the action, and plant P2 is exactly a bypass on a second path.
- **[safety/major] No legacy guard in sop-patch; audit-apply could write the NCT fixture** → Accepted (the missing check was verified). sop-patch refuses legacy and `SW\fixtures\` paths. `audit-apply.ps1` refuses legacy. C2 and the audit stub assert the fixture sha is unchanged.
- **[safety/major] git status can't see ignored writes under C:\Project** → Accepted, and stronger than stated: the repo is not git at all. `project-guard.mjs` hash and mtime manifest at every gate. `ZYT_ALLOW_PAGES` enforced by registry listing and sop-patch. zyt-audit requires `--page`.
- **[safety/major] Migration irreversible and unpinned** → Accepted. Backup, source-sha pin (`--expect-sha`), history row, `--revert`. Real JWA apply is a separate user step with a sha re-check and re-snapshot.
- **[safety/major] Trust data in embedded JSON breaks NCT identity; unrequested severity refactor** → Accepted. Trust sits in a separate script tag and only when the flag is given. A new regress check asserts NCT's embedded JSON equals the source. The severity refactor is dropped.
- **[safety/major] Ultracode audit cost has no preflight or default budget** → Accepted. GATE 0 `audit-plan.mjs` and ask. Default `--budget 25`, enforced in the workflow. Rule checkers batched at most 5 per agent. Refuters only on risky ops. The stub asserts preflight order and budget.

### Verifiability

- **[verifiability/blocker] R10 anchors point at unrelated text or an object** → Accepted with a correction: `/steps/9/what` (index 9 = n10) *does* contain "CFO", so the reviewer's reading assumed n=9. The real defect was the ambiguous grammar and the wrong guide paths. Anchors were re-derived by grep (§0). precheck-rules asserts resolve plus contains-literals and fails loudly.
- **[verifiability/blocker] §6 rewards a false "fixed"** → Accepted. Same resolution as the correctness blocker: P3 makes a real fix, plus negative "no other fixed" assertions.
- **[verifiability/blocker] `rules-ticked.json` unspecified; "covers" undefined** → Accepted. The full JSON is in Phase 0, with a precheck. Coverage is defined as anchor intersection plus literal overlap, asserted per rule in C1.
- **[verifiability/blocker] git safety gate vacuous (not a repo)** → Accepted (verified: exit 128, empty stdout). Replaced by `project-guard.mjs`, with no git dependency.
- **[verifiability/major] Copy mutated in place with no archive or restore** → Accepted. `archive-copy` and `restore-copy` to `RUN\pre\`, `baseline.json` and `baseline.sop.json`, and start-state hash checks in every e2e script.
- **[verifiability/major] Live J2 run under-specified** → Accepted. Plants by Edit in the same session, scope checked in `sop-scope.json`, GATE 1 answer policy, artifact paths, exact history-row assertion, and a "Rule conflicts" report check.
- **[verifiability/major] J6 can't pass on the noLedger build** → Accepted. Two builds with named selectors and count equalities (§6 step 5).
- **[verifiability/major] Phase 1 gate doesn't exercise SKILL.md or the live path** → Accepted. A live mini-J2 is added to the Phase 1 gate (with restore afterwards), plus a SKILL.md grep.
- **[verifiability/major] No negative validate fixtures** → Accepted. `validate-neg.mjs` has one fixture per error plus a warnings fixture.
- **[verifiability/major] Unmark assertion rests on an unstated precondition** → Accepted, and the plant was changed. The `viewer`-on-unmark plant is replaced by P2 (self-approval check removed from `decideLineItemsBulk`), which matches the defined `unenforced-approval` pattern. The precondition (no `src` references it) is asserted in Phase 0 and §6 step 0. The note explains that update is blind to it by design.
- **[verifiability/major] Audit non-determinism: no artifact path, apply policy or flake rule** → Accepted. Fixed artifact paths, an explicit `audit-apply` accept list, regex match rules for evidence, at most one rerun for finding assertions (none for safety assertions), and both runs recorded.
- **[verifiability/major] R10 plant by line number; evidence for a deleted line undefined** → Accepted. Exact-text plant. `evidence-verify` gains `absent`. The expected evidence is a quote of the surviving lookup call plus `absent` of the throw message. The decided and current hash difference is asserted.

### Minors, adopted briefly

- **sop-write writers.** `rules.mjs` goes through sop-patch; migrate uses the shared `lib/sop-write.mjs`, and the contract names both writers.
- **`--source` vs `cs.source`.** `cs.source` is authoritative and a mismatch is refused.
- **Literal check undefined in staleness.** Removed; staleness uses decided window hashes, `stepOf` comes from `rules[].steps`, and rule-at-risk does not escalate `--all`.
- **Role plant ambiguous.** Replaced by P2.
- **Hook tests.** They go in C2; registry docs are updated in Phase 4; propose coverage is matched by anchor, not id.
- **R10 overlaps `approval-queues-unmounted`.** R10 is reworded to what code enforces, R11 covers CFO-only approval with `ledgerId approval-queues-unmounted`, and assert-update tolerates the needs-human row on that item.
- **Remind hook noise.** The nudge sits inside the touched branch and is merged into one message.
- **Fix ids on folded or duplicate items.** Ids are assigned to non-folded fixes only, with `-2` dedupe and a warning on migrated data; tick-key equality is tested.
- **`rules.mjs` bypasses sop-patch and a `none` rule contradicts a fixed item.** Fixed via the sop-patch path plus a validate warning, and audit proposes a `rule-set`.
- **Unchecked percentage, candidate count and scratch page.** Replaced by an exact formula, anchor coverage and a named scratch fixture.
- **Nudge untested.** C2 cases for 29 and 31 days, legacy, and malformed registry.
- **"96/96" not observable.** Gates check `ALL PASS` and `N passed, 0 failed`.
