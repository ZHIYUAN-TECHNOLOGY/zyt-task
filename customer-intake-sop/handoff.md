# Handoff: staff SOP synced to W5, and the s02/s03 audit (2026-09-30 → 10-01)

Session: SOP.NCT. Page: `ZYT-Task/customer-intake-sop` → https://admin.zhiyuantech.ai/nct/customer-intake-sop/
Before changing this page, read `C:/Project/ZYT-Task/hosting/SITE.md`.

## Where things stand

| Item | State (checked) |
|---|---|
| ZYT-Task `origin/main` | `1d970f6`, matching local and confirmed with `git ls-remote`. Nothing from this session is left uncommitted |
| Live site | Wilfred deployed after `1d970f6`. Dashboard Findings and the SOP page were checked read-only (below) |
| Prod Convex | `seed:nct --prod` run by Wilfred, so every finding id has a row (the deploy's preflight passed) |
| Dev Convex | `seed:nct` inserted the op-002 row (154 in total) |
| Code root | `C:/Project/NCT/wt-release-r1`. The SOP sync read `23a2220c`. The tree has since moved to `18dd7506` (PR #141), which the audit read. Whether production runs `18dd7506` was not checked |
| Demo data | Throwaway org `sop0930w5` torn down: 0 org, 0 user and 0 company rows (dev DB `ep-super-math`) |
| Servers | `sop-server(-email)` and `sop-web` stopped; :3050, :3151 and the runner on :4318 are free |

## Commits (ZYT-Task main)

| sha | What |
|---|---|
| `7601295` | SOP steps 1–3 for the W5 new customer page: 26 ops, 5 screenshots, report `update-2026-09-30-w5.md` |
| `6aa30cf` | Golden path `nct-intake-steps-1-3` re-recorded (14/14 passed, new step titles). The other recordings only got a new `publishedAt` |
| `430d9ae` | Live check of the W5 sync written into the report |
| `9b67e58`, `5db52ad` | **Main.NCT's**, not this session's: its scoped audit (steps 2, 3, 18, 19), two new findings under `nct-c04`, and the "Partly fixed (audit)" label on the dashboard |
| `45f6d5e` | s02 repair text reworded, fix id kept |
| `1d970f6` | Audit op-002 added as finding `au-applying-a-foreign-currency-tariff-with-` (money), covered by `nct-c03-quote-pricing` |

## What the page now says (W5)

- **Step 2:**
  - Add opens `/companies/new`, the New customer page: role cards; Who; Main contact, saved as Primary and used as the quote's Attention; How they pay (MYR, Sales owner = you); More details.
  - Save lands on the record page.
  - **Save & new quote** (Customer only) opens a new quote with Client and Attention filled when the customer may be quoted. Otherwise it lands on the record page under the awaiting-approval banner.
  - Labels: "Registration no. (SSM / USCC)", "Sales owner".
  - Pitfall: the approval check is advisory, because `quotation.create` does not enforce `customer_reference`.
- **Step 3:** the main contact is already Primary, so this step is for further contacts. It also describes the "Nobody is marked primary" warning.
- **Inbox (guide[0]) and the "Inbox → Customer" chain break:** production email automation is paused. Once it is on, **Create company from sender** fills the company title with the sender's name (or email domain), fills the contact name and email, and links the thread.
- **Walk-in arrival:** points at the New customer page.

## Audit of s02 / s03 (2026-10-01, light, 4 agents, refuter-checked)

- **s02 stays open.** The unique index is on the raw name (`packages/db/src/schema/company.ts:138`, "Case-sensitive on purpose for v1" at `:135`). Its repair now says only the case-insensitive refusal at Save is missing.
- **s03 stays partly-fixed.** The create path inserts the main contact as Primary (`company.ts:847`). A contact added later is never promoted (`company-contact.ts:181`), and the ageing query still requires `isPrimary = true` (`report.ts:1117`).
- **New findings:**
  - op-001: Post to cost ledger skips `convert_order`. Applied by Main.NCT.
  - op-002: applying a rate card with no exchange rate stores rate 1 and skips the unrated-fee switch. Applied by this session.
- Report: `customer-intake-sop/.zyt/audit-2026-10-01.md`, changeset `audit-2026-10-01.json`. Main.NCT's own ops are in `audit-2026-10-01-scoped.json`.

## Live checks done (read-only, in the browser pane, signed in)

- `/nct/customer-intake-sop/#step-2`:
  - New wording present; "Add company dialog", "create-company dialog", "Unified social credit" and "Create and continue" are gone.
  - All 5 shots are served at the committed sizes.
- `/golden-paths/nct-intake-steps-1-3.json`: passed, with the new step titles.
- Dashboard (`?company=nct&view=findings`): new s02 repair text, op-002, both of Main.NCT's findings, and "Partly fixed (audit)".

## Open items

1. **Fix the two money findings in the app** (NCT code lane, not the SOP):
   - `costLines.importFromQuote` should check `convert_order` and the audit status.
   - `quotations.applyTemplate` should pass `rateMissing` to `assertUnratedFeeAllowed` and return the warning.
2. **s02:** a case-insensitive unique index (`lower(name)`) needs a migration and duplicate cleanup first. That is Wilfred's decision.
3. **s03:** promote the first contact when nobody is Primary, or give the ageing query a fallback contact.
4. **Release tree moved to `18dd7506`:** PR #141 touched `company-form-payload.ts` (stale edit tab) and document review. If it ships, run `/zyt-update` for step 2's edit path and the document-review steps.
5. **When email automation is switched back on in production:** re-check step 1. The inbox guide and the chain break both say "paused today".
6. **Not walked in a browser:** the inbox's Create company from sender click. The web build has `VITE_EMAIL_AUTOMATION_ENABLED` off, so it was proven by the e2e spec (`intake.new-customer.spec.ts`), not by a click.

## Traps hit this session

- **Sharing `.zyt/audit-<date>.json` with another session.** Two sessions audited the same page on the same day. My run overwrote the other session's changeset, and that session then applied mine. Before running `/zyt-audit`, check `ListAgents` and `.zyt/` for a same-day audit.
- **The intake recording needs the email-on API.** Run it on `sop-server-email`, not `sop-server`. With email off, the inbox-thread test fails (`thread.get` 503), and `publish-recordings` skips the whole run.
- **`publish-recordings.mjs` publishes every passed save** in `hosting/runner/runs/`, not just the job you re-ran.
- **The browser pane and Chrome both hit Cloudflare Access sign-in.** An agent never signs in. Ask Wilfred to sign in, then check read-only.
- **A peer message to a session in another permission mode** waits for its user's approval. Give Wilfred the text to paste instead of waiting.
