# SOP update 2026-10-03: screenshot recapture

Page `ZYT-Task/customer-intake-sop`, code root `wt-release-r1` @ `114b7437` (production). Changeset
`.zyt/pending-2026-10-03-shots.json` (source session). evidence-verify kept all 23 ops; sop-patch dry run: 0 refused.

## Screenshots replaced (32 files)

Every file in `shots/` was recaptured at 1440×900 on the current production shell (grey mat, search in the top
nav) against a seeded demo org with realistic names ("NCT Freight Demo", branch Port Klang). The data is demo data, not
production. Capture log: `C:/Project/NCT/wt-new-layout/_plan/10-02_22-31_sop-shot-recapture/plan/capture-log.md`.

## Text edits (confirm)

| op | Where | Old | New | Evidence |
|---|---|---|---|---|
| op-022 | Step 14 guide, Cargo & fees line | …**Expense entry (fees)** and **Appendages (attachments)** | …**Expense entry (fees)** and the **Attachments** card, which uploads real files straight onto the job | `order-attachments-card.tsx:112` `<h3 …>Attachments</h3>`; `order-form.tsx:3049` "The old free-text Appendages editor is gone" (#142) |
| op-023 | Step 1 screenshot caption | Inbox: folders, thread list, reading pane | Inbox while email automation is paused, as production shows it today | `automation-gate.tsx:10` `<EmptyTitle>Email automation paused</EmptyTitle>`; the step text already says inbox is paused |

## Citations re-anchored (auto, 21)

Line shifts only: steps 5, 7, 8 (header-actions.tsx), 11 (Convert to order 445→469), 13, 15 and others. No anchor text changed.

## Not in this run

- `document-upload.tsx` changed since the baseline but every citation into it still anchors.
- Ledger: the 2026-10-02 audit (`3f2ddc1`, 2 fixed, 8 new) is already applied and ships with this deploy.
