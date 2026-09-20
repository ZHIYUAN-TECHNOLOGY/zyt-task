# NCT SOP page — hosted layout on admin.zhiyuantech.ai

**Date:** 2026-09-15 · **Page:** `/nct/customer-intake-sop/` · **Status:** deployed 2026-09-15;
verification list below run locally and on the live site. One bug found during testing and fixed:
following an in-page `#arrivals` link while another step was showing didn't scroll (the pane was
emptied and the block re-inserted a microtask too late) — `placeIntro()` now runs before the scroll.

Solo plan (small, one page, build-time only). No staff-engineer review workflow was run.

## Revision (Wilfred, 2026-09-15, later)

- **The whole chain becomes a full-screen view** opened by the right-edge tab (renamed "The whole
  chain"). The chart intro, legend and App URL move into that view; the separate guide sheet is gone.
  The page itself now starts at What to fix first.
- **The fix browser** (step list + defects) is exactly one window tall under the top bar, each side
  scrolling; the section heading and intro scroll above it.
- Behaviour kept: step guide opens on top of the view (Esc closes the guide first, then the view);
  "Repairs · Step N" chips open the view on that step; "Open step N in the document" closes it;
  `#arrivals` / `#map` open it.

## Revision 2 (Wilfred, 2026-09-15)

- The view's header (title + intro paragraph) and the legend are removed.
- App URL moves to the right column, above the step pane (outside the pane, which is rebuilt on
  hover); × sits beside it.
- Fit one window on desktop (>64rem): the chart SVG scales to its cell, only the step pane scrolls.
  Tablet/phone keep a scrolling view with a sideways-scrolling chart and × pinned top-right —
  a fit-to-screen chart there would put node titles around 3 px.

## Decisions (Wilfred, 2026-09-15)

| | Decision |
|---|---|
| Logo | Both top bars' logo goes to the site root (admin.zhiyuantech.ai) |
| Header | SOP page gets the dashboard's top bar: logo · Client projects / NCT · theme toggle (replaces the back bar) |
| Top block | Eyebrow, title, Read first, phase tiles and How they arrive fold into **Step 01's pane** |
| Side sheet | Chart intro paragraph + legend + App URL move into a sheet opened by a tab stuck to the right edge |
| Order | "The document" moves below "What to fix first" |
| Ledger | "What to fix first" is one window tall (under the top bar) and scrolls inside |
| Where | Hosted copy only — `customer-intake-sop.html` (the claude.ai artifact) is unchanged |

## Journeys

| Before | After |
|---|---|
| Land on page → back bar, big title block, phase tiles, How they arrive, then the chart | Land → ZYT top bar, "The whole chain" chart first; Step 01 pane shows the title block, Read first, phase tiles and How they arrive |
| Hover step 12 → pane shows step 12 | Same; the title block leaves the pane until Step 01 is shown again |
| Legend and App URL sit above the chart | Right-edge tab "Chart guide · App URL" → sheet with intro, legend, App URL (Apply still works) → Esc / × / backdrop closes |
| Scroll: chart → The document → What to fix first | Chart → What to fix first (window-tall, inner scroll) → The document |
| Logo → www.zhiyuantech.ai | Logo → admin.zhiyuantech.ai |

## Files

| File | Change |
|---|---|
| `hosting/hub/sop-layout.js` | NEW — DOM moves after the page's own scripts; theme toggle |
| `hosting/hub/sop-layout.css` | NEW — top bar, pane intro, guide tab + sheet, window-tall ledger, sticky offsets |
| `hosting/deploy-site.ps1` | Top bar replaces the back bar; append layout CSS + JS after `sop-theme.css` |
| `hosting/hub/index.html` | Logo href → `/` |

## Risks

- Page listeners are bound by id before the moves — moving (not cloning) nodes keeps them. The pane is rebuilt with `innerHTML = ""` on every hover, which detaches the intro; a MutationObserver puts it back whenever Step 01 is shown.
- Sticky top bar vs the page's sticky chain pane (≥1680px) and `#step-N` anchors → offsets via `--zyt-top` and `scroll-padding-top`.
- Window-tall ledger on phones would nest two scroll areas → single inner scroll under 52rem.
- The step-guide modal (`.sm-backdrop`, z-index 50) must stay above the top bar (40) and the tab (45).

## Verification

Local (dev build) and live, headless Edge: top bar present, logo href `/`, theme toggle persists; top block absent from page flow and present in pane only for Step 01 (and returns after hovering another step); `#arrivals` link works; tab opens sheet, Apply still updates links, Esc closes and focus returns; order chart → ledger → document; ledger height = window − top bar with inner scroll on desktop and phone; step modal still opens above everything; no horizontal overflow at 1920/1440/1280/1024/800/400; no console errors; screenshots dark + light.
