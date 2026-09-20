# ZYT admin dashboard — projects · to-do · task panel

**Date:** 2026-09-15 · **Live at:** https://admin.zhiyuantech.ai · **Status:** deployed 2026-09-15.
Verified locally against the Convex dev deployment (name prompt, tick, live sync to a second tab,
untick history, offline read-only, tablet/phone) and read-only on the live site against prod.
No test ticks were written to prod.

Replaces the hub page with a three-column dashboard modelled on GitHub's home:
projects on the left, the selected project's to-do list in the middle, the selected task
on the right. Ticks are shared through Convex.

## Decisions (Wilfred, 2026-09-15)

| | Decision |
|---|---|
| Layout | GitHub home: left projects · middle to-do · right task panel |
| To-do items | Workstreams (10) as groups → their tasks/findings (48) |
| Ticking | Shared via Convex, **anyone with the link** may tick; each tick records a typed name |
| Visibility | **Show everything**, team-only fields included (owner, repair, src) — on a public URL |
| Scope | Static site + small Convex backend now; table names follow ZYT Delivery v0 (`findings`, `events`) so v0 can absorb it |
| Brand | zhiyuantech.ai logo, favicons, homepage palette — `hosting/hub/brand/BRAND.md` |

## User journeys

1. **Open the dashboard** → NCT is selected in the left list; middle shows its 10 workstreams
   with done/total counts and a project progress bar; live state loads from Convex.
2. **Read a task** → click a task row → right panel shows title, state (and who ticked it,
   when), workstream, category, kind/rank, detail, affected SOP steps (each links to
   `/nct/customer-intake-sop/#step-N`), repair, source locations, owner, history.
3. **Tick a task** → checkbox (row or panel) → first time asks for a name (remembered in the
   browser) → Convex `findings.setState` → every open dashboard updates live.
4. **Untick** → same path, recorded as an event.
5. **Convex unreachable** → content still renders from the seed embedded at build; ticking is
   disabled with a notice.
6. **Phone** → columns stack: projects become a top selector, the task panel opens as a sheet.
7. **SOP page** → unchanged at `/nct/customer-intake-sop/`, back bar to the dashboard.

## Files

| File | Change |
|---|---|
| `hosting/convex-app/convex/schema.ts` | NEW — `findings` (state per task), `events` (tick history) |
| `hosting/convex-app/convex/findings.ts` | NEW — `board` query, `setState` mutation (validates key + name) |
| `hosting/convex-app/convex/seed.ts` | NEW — idempotent seed from `tracker/seed/*.json`; never overwrites live ticks |
| `hosting/convex-app/package.json`, `convex/tsconfig.json` | NEW |
| `hosting/hub/index.html` | REWRITE — dashboard; content from embedded seed, state from Convex |
| `hosting/deploy-site.ps1` | embed seed JSON + Convex URL; cache the Convex bundle |
| `hosting/pwa/sw.js` | cache the jsDelivr Convex bundle for offline |
| `README.md` | document backend, redeploy and seeding |

## Risks

- **Open writes on a public URL.** Anyone can tick/untick; names are self-declared. Mitigated
  only by validation (known task keys, 1–40 char name) and a full event history. Upgrade path:
  passcode or sign-in.
- **Team-only detail is public** by decision (repair plans, file paths).
- Content (titles, details) is static — editing it means changing the seed and redeploying;
  only state is live.

## Verification

- Convex: `tsc` on `convex/`, deploy to prod, run seed, query `board` → 48 findings.
- Browser (headless Edge over CDP, live URL): renders 10 workstreams / 48 tasks; panel opens
  with all fields; tick in tab A appears in tab B without reload; untick records an event;
  name prompt; Convex blocked → read-only notice; 400 px layout no overflow; SOP still loads.
