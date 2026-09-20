# JWA full-chain SOP — the 8 rules (for approval)

**Applied 2026-09-16** to the real page `jwa-system/jwa-full-chain`: page migrated to v2 (original backed up at `C:\Users\user\.claude\zyt\pending\jwa-full-chain\sop.pre-v2.28aa118d.json`), all 8 rules decided, baseline snapshot taken, drift check clean. In the real code R10 is at `srfPurchasing.ts:834` and R12 at `:852` (the table below shows the test copy's lines, 6 higher). Applied rules file: `C:\Users\user\.claude\zyt\pending\jwa-full-chain\rules-real.json`. To change a rule later, use `/zyt-update --rules`.

Once a rule is applied, `/zyt-update` never rewrites its text, and `/zyt-audit` checks the code against it on every code path.

| Id | Rule (business intent) | Kind | Steps | Enforced by (code) | Status today |
|---|---|---|---|---|---|
| R3 | Only the CFO (or an admin) approves a project's BQ budget | role | 4 | `packages/backend/convex/projectBudgets.ts:718` | enforced |
| R5 | Only members of the project can raise an SRF on it | permission | 2, 5 | `packages/backend/convex/srfForms.ts:130` | enforced |
| R6 | The Construction Manager decides every line before the PM | gate | 6 | `packages/backend/convex/srfApprovals.ts:523` | enforced |
| R7 | Nobody approves an SRF they raised themselves | permission | 6, 7 | `packages/backend/convex/srfApprovals.ts:40` | enforced on single approve; admins exempt — tracked as ledger `admin-self-approval` |
| R10 | A supplier line cannot be ticked Done until its price comparison is approved | gate | 12 | `packages/backend/convex/srfPurchasing.ts:840` | enforced (screens to approve comparisons aren't mounted — ledger `approval-queues-unmounted`) |
| R11 | Only the CFO (or an admin) approves a price comparison | role | 10 | `packages/backend/convex/priceComparisons.ts:212` | enforced (same unmounted-screen ledger item) |
| R12 | A line above the big-amount threshold needs Director approval before Done | threshold | 12 | `packages/backend/convex/srfPurchasing.ts:858` | enforced — but the test audit reports Director sign-off survives a later amount increase |
| R13 | SRF lines are not approved beyond the approved BQ budget | threshold | 4, 7 | none (`srfApprovals.ts:555` is where the check is missing) | **not enforced** — ledger `budget-not-enforced` |

Where each rule sits in the page text (these strings are locked once applied):

| Id | Anchors in sop.json | Must contain |
|---|---|---|
| R3 | `/steps/3/what`, `/guide/3/role` | "CFO" |
| R5 | `/steps/1/what`, `/guide/4/role`, `/guide/4/before/0` | "member" |
| R6 | `/steps/5/what`, `/guide/5/role` | "Construction Manager" |
| R7 | `/guide/5/before/1`, `/guide/6/before/1` | "did not raise" |
| R10 | `/steps/11/what`, `/guide/11/before/1`, `/guide/11/golden/1/action` | "price comparison", "approved" |
| R11 | `/steps/9/what`, `/guide/9/role` | "CFO" |
| R12 | `/steps/11/what`, `/guide/11/before/2`, `/guide/11/golden/2/action` | "Director" |
| R13 | `/guide/3/pitfalls/0`, `/guide/6/pitfalls/0` | "budget" |

## Decide

Strike out any rule the business does **not** actually require (tick only intent, not "whatever the code happens to do"), and add any rule you expect that isn't here.

Raw machine proposal for the real page (47 candidates, untrimmed): `C:\Users\user\.claude\zyt\pending\jwa-full-chain\rules-proposed.json`.
Source of this table: `C:\Users\user\.claude\skills\zyt-update-workspace\tests\e2e\rules-ticked.json`.

## To apply on the real page (separate, user-approved step — writes under C:\Project\JWASystemv2)

1. `node C:\Users\user\.claude\skills\zyt-update\scripts\migrate-tracker.mjs --data C:\Project\JWASystemv2\jwa-system\sop\jwa-full-chain\sop.json --dry` → note the sha, then rerun with `--expect-sha <sha>` (writes a backup; `--revert` undoes it).
2. `node C:\Users\user\.claude\skills\zyt-update\scripts\rules.mjs apply --page jwa-system/jwa-full-chain --candidates C:\Users\user\.claude\skills\zyt-update-workspace\tests\e2e\rules-ticked.json --accept <your ids> --allow-project`
3. `node C:\Users\user\.claude\skills\zyt-update\scripts\snapshot.mjs --page jwa-system/jwa-full-chain`
