# Plan — role view ("show me my flow") for SOP pages, starting with NCT

Date 2026-09-16 · Decisions (user, via recommendations): shared template, not an NCT-only patch · others' steps faded, not hidden · permission strings hidden in the role view · NCT roles: Sales, Sales admin, Reviewer, Operations, Documentation, Accounting, Cashier (confirmed from mapping proposal) · NCT moves onto the template build.

## User journeys
| | Old | New |
|---|---|---|
| J1 Staff member opens the NCT SOP | Sees the whole 27-step chain; must read every step's role text to find their part | Picks their role in a left rail (phone: dropdown). Their steps light up on the chain map, others fade; side panel lists "My flow" in order with handoff cards (← from Sales at 12 / → to Documentation at 16); shared steps show their part (submits / approves). `?role=operations` link opens straight into the lens; last pick remembered per browser |
| J2 Manager sends a link | Sends page URL | Sends `…/nct/customer-intake-sop/?role=accounting` |
| J3 New page via /zyt-setup | No roles | Setup proposes a role list + step mapping from guide role text; user confirms once |
| J4 Code changes role guards | Page role text drifts | /zyt-update re-proposes the mapping for changed steps (confirm tier) |
| J5 NCT deploy | deploy-site.ps1 copies hand-written customer-intake-sop.html | deploy-site.ps1 builds NCT from `C:\Project\ZYT-Task\customer-intake-sop\sop.json` with the template (ledger kept, as today); hand-written file kept as backup |

## Data contract (sop.json)
- `roles: [{ id, name, color? }]` — optional. id = lowercase slug.
- `steps[].actors: [{ role: <roles[].id>, part: "does" | "approves" | "watches" }]` — optional per step; a step with no actors belongs to no role (shown under "All" only).
- Handoffs are computed, never stored: walking the chain order, an edge where the set of `does` roles changes → handoff out of the previous role(s) into the next.
- validate(): unknown role id, duplicate role id, bad `part`, empty actors array → errors; roles defined but a step without actors → warning.

## Files / owners
- **Agent R1 (template + build):** `zyt-setup\assets\sop-template.html` (role rail left of chain map, phone dropdown, lit/faded steps, My-flow list + handoff cards in the side panel, `?role=` + localStorage `sop.<slug>.role`, "All" default), `zyt-setup\scripts\build-page.mjs` (validate), `zyt-setup\references\sop-json-schema.md`, fixtures + `regress-v2.mjs` role checks. NCT regress must stay ALL PASS for data without roles.
- **Agent R2 (proposer + docs):** `zyt-update\scripts\roles.mjs` (`propose --page|--data --out` deterministic map from guide/step role text; `apply --data|--page --candidates --accept`, writes through sop-patch with a new source `roles` or via rules-like path), sop-patch op kinds for `/roles` and `/steps/*/actors`, `zyt-setup\SKILL.md` (setup step), `zyt-update\SKILL.md` (`--roles` mode), c1/c2 tests.
- **Lead (after R1/R2):** NCT data move (`C:\Project\ZYT-Task\customer-intake-sop\sop.json` from the regress fixture), roles proposal → apply for NCT and JWA, `hosting\deploy-site.ps1` NCT block builds from data (ledger kept), local preview both pages + hub, then ask before deploy.

## Risks
- NCT identity: template rebuild of NCT currently equals the hand-written page (regress ALL PASS). Adding roles must not change anything else: build NCT with roles stripped and byte-compare to the current built page.
- Hub layout (owned by the ZYT Main session): `hosting\hub\sop-layout.js/css` hook only `.cp-num`, `.sm-backdrop` and meta; rail must fit the one-window whole-chain layout. Check desktop + phone in preview; no edits to hub files unless required (then minimal, reported).
- Role mapping errors mislead staff → user-visible names confirmed from proposal; permission strings not shown.
- Deploy republishes admin.zhiyuantech.ai → ask first.

## Verification
- regress.mjs ALL PASS; regress-v2 + new role checks (lit/faded counts per role, handoff cards correct for a fixture, `?role=` deep link, phone dropdown, no overflow 400px); validate-neg role cases; c1/c2 pass.
- NCT: stripped-roles build byte-equal to the current build; with roles, preview each of 7 roles on desktop + 400px, 0 console errors; JWA same.
- Hub: company switcher/page list unaffected.
