# ZYT Delivery — tracker model

One board that both the team and the client look at. The client sees the same rows;
a handful of fields are hidden from them.

## Decisions this model is built on (2026-09-14)

| | Decision | What it forces |
|---|---|---|
| 1 | **The weekly report is a snapshot you approve; everything under it is live.** | `report` rows are immutable; a workstream shows live state and says when it differs from the last report |
| 2 | **Progress is declared, not derived.** | Every state change carries an author, a time and a note; evidence is optional but shown when present |
| 3 | **Clients read, they do not reply.** | No client-side comments; replies happen in email |
| 4 | **Workstreams group findings; a regression is a new finding.** | `workstream.covers[]` is many-to-one; `reopened_from` / `supersedes` keep the chain |
| 5 | **Clients see what the team sees, except the prompting.** | Visibility is per **field**, not per row — no client-facing rewrite of titles, no separate client list |

## Tables

```
project        id, client_org, name, flow_id, state
flow           id, name, phases[{key,label}], steps[{n,key,title,phase,role,routes[],summary}]

finding        id, project, kind(chain|step), title, detail, severity, rank?,
               steps[{kind(step|break-after), n}],
               repair ⓣ, src[] ⓣ, owner ⓣ,
               state(open|in_progress|blocked|fixed|wont_fix),
               opened_at, closed_at?, reopened_from?
workstream     id, project, title, blurb, covers[finding_id],
               state(planned|in_progress|blocked|done), owner ⓣ,
               prompt ⓣ, opened_at, closed_at?, supersedes?
event          id, subject(finding|workstream), to, note*, internal, author ⓣ, at
report         id, project, week_of, summary, next_line, published_at, published_by
report_item    report, workstream, state_at_publish
attachment     id, subject, kind(pr|qa_run|screenshot|link), url, label, internal, at
```

`ⓣ` team-only field · `*` required on every event

## What the client does not see

Visibility is decided per field, so there is one set of rows and one renderer with a role flag.

| Hidden from the client | Why |
|---|---|
| `workstream.prompt` — handover prompts and `/planpro` plans | Instructions for our tooling, not status |
| `event` rows with `internal: true` | So the team can write the real thing — "worse than filed" — without editing it for an audience |
| `owner`, `event.author` | The client deals with ZYT, not with a person they can chase directly |
| `finding.repair`, `finding.src` | Implementation detail the client cannot judge |
| `attachment` rows with `internal: true` | Draft evidence, screenshots of a broken state |
| The findings count in the page header, and per-step counts on the flow | A raw count reads as a failing project; the findings themselves stay visible one level down |

Everything else — the flow, every workstream and its history, every finding's title,
severity and step, the weekly report — the client sees exactly as the team does.

## Rules

**Titles are written once, for both audiences.** There is no client rewrite, so a finding
is titled plainly enough to be read by the client from the start.

**Notes default to shared; one keystroke makes one internal.** If every note were visible,
the log would go bland. If the toggle were effort, nobody would use it.

**Two clocks.** `report_item` freezes `state_at_publish`. A workstream whose live state has
moved says so in one line: *"Reported on 14 Sep as In progress · now Blocked."*

**Corrections, not edits.** A published report is never rewritten; a mistake is a new report
marked as a correction.

**Regression.** A finding that comes back is a **new** finding with `reopened_from`; its
workstream `supersedes` the one reported done. A reopened thing is a new promise with its
history attached.

**Declared grouping.** A workstream's state is declared, not computed from its findings —
twelve of thirteen fixed is not done until someone says it is.

**Staleness is team-only.** A finding with no event for N days is marked on the team view;
the client reads "In progress since 2 Sep".

## What Claude sessions may do

| Allowed | Not allowed |
|---|---|
| Read the flow, findings, workstreams | Publish a report |
| Claim a finding, change its state with a note | Mark a note or attachment shared |
| Attach a PR, QA run or screenshot (internal by default) | Close a workstream |
| Open a finding, including a regression | Edit a workstream's title or blurb |

Automation moves work and records evidence; a person decides what the client reads.

## Files

| File | What it is |
|---|---|
| `seed/flow-nct.json` | 5 phases, 27 steps |
| `seed/tasks-nct.json` | 48 findings — 18 ranked chain defects, 30 step-local |
| `seed/client-tasks-nct.json` | 10 workstreams covering all 48 (the file name predates decision 5) |
| `build-seed.mjs` | Regenerates the flow and findings from `../customer-intake-sop.html` |
| `build-board.mjs` | Renders `../mocks/board.html`, the unified board with the Team/Client toggle |

Run both from `C:/Project/ZYT-Task`.

## Open, deliberately

- **Notifications** — only the weekly publish emails the client.
- **Multi-project** — the tables carry `project`; the first build can hard-code one.
- **Search, roles beyond team/client, sprints** — not modelled. Sync findings out to Plane if you want them.
