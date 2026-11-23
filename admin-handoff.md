# Handoff: client sign-in on admin.zhiyuantech.ai

Updated 2026-10-02. This covers who can sign in to admin.zhiyuantech.ai and how to add people.
The site's general contract is `hosting/SITE.md`; the Access part is its "Invariants" section.

## Where things stand

- **JWA client access added (2026-09-25):** `mrkt.jwa@gmail.com` and `magdalene.yong@jwadesignbuild.com`
  are in JWA's `"access"` list in `hosting/hub/projects.json` (committed in `90e8b0a`, 2026-09-30).
- **Cloudflare Access is synced:** `node hosting/access/sync-access.mjs --dry-run` shows no pending changes
  (checked 2026-10-02).
- **Current access lists** (`hosting/hub/projects.json`):

  | Company | Emails | Pages |
  |---|---|---|
  | NCT | `norman@nct.com.my` | `/nct/*`, `/golden-paths/nct-*` |
  | JWA | `mrkt.jwa@gmail.com`, `magdalene.yong@jwadesignbuild.com` | `/jwa/*`, `/golden-paths/jwa-*` |
  | Harper | none | `/harper/*` (staff only) |
  | ZYT staff | `wilfred@`, `bryan@`, `edwin@`, `ngchwanlii@zhiyuantech.ai` | everything |

## Login links to give clients

Sign-in is a one-time PIN emailed by Cloudflare. There's no per-person link; send the page URL.

- NCT: https://admin.zhiyuantech.ai/nct/customer-intake-sop/
- JWA: https://admin.zhiyuantech.ai/jwa/full-chain-sop/
- Dashboard: https://admin.zhiyuantech.ai. A client sees only their own company there.

**Don't send `/nct` or `/jwa` on their own.** Those are only the paths the Access rules cover, and
nothing is served there, so they return the site's 404 ("That page isn't here").

## How to add or remove a client email

1. Edit the company's `"access"` array in `hosting/hub/projects.json`. It takes an email or an `@domain`.
2. Run `node hosting/access/sync-access.mjs --dry-run`. It should list only `update policy` lines for
   `zyt-admin · site` and that company. The token is in the git-ignored `hosting/access/.env`.
3. Run `node hosting/access/sync-access.mjs`. This changes the live Access rules, and the person can
   sign in straight away.
4. Re-run the dry run and confirm there are no `update`, `create` or `delete` lines.
5. Redeploy with `hosting/deploy-site.ps1` so the dashboard lists the company for them. Until then
   they can still open the page's direct link.
   - The deploy publishes everything on disk. Check `git status` first and tell any other active ZYT
     session (find it with ListAgents).
6. Commit `projects.json`.

Never edit the `zyt-admin · …` apps or policies by hand in the Cloudflare dashboard; the next sync
overwrites them. Keep `projects.json` and the Access rules in step. The rules lock the pages; the
list only tidies the dashboard view.

## Open items

- **Live JWA sign-in not checked:** nobody has confirmed that a JWA user actually received a PIN
  and landed on the page. Ask one of them, or check Cloudflare Zero Trust → Logs → Access.
- **Untracked files in the repo:** `customer-intake-sop/.zyt/audit-*`, `shots-2026-09-24/`,
  `customer-intake-sop/handoff.md`, `handoff.md` and `zsession/`. They come from other sessions,
  so leave them unless their owner says otherwise.
