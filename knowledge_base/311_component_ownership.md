# 311 — Design System: Component Ownership

Who builds what, and where each component stands. Kept here rather than in
chat, because chat is where the previous split got lost.

Update the status column when a PR opens or merges.

| Component  | Owner    | PR  | Status               |
|------------|----------|-----|----------------------|
| Button     | oostapen | #6  | merged               |
| IconButton | oostapen | #6  | merged               |
| Card       | oostapen | #6  | merged               |
| Badge      | oostapen | #6  | merged               |
| Select     | iskaraag | #5  | merged               |
| Toggle     | iskaraag | #7  | merged               |
| Chip       | iskaraag | #8  | merged               |
| Avatar     | iskaraag | #9  | merged               |
| EmptyState | iskaraag | #10 | merged               |
| Progress   | oostapen | #13 | merged               |
| Stat       | oostapen | —   | next                 |
| Input      | iskaraag | #28 | merged               |
| Textarea   | iskaraag | #65 | in review            |
| Tabs       | oostapen | #52 | in review            |
| Modal      | iskaraag | #53 | merged               |
| Toast      | iskaraag | #64 | in review            |
| Pagination | oostapen | #31 | merged               |

"merged, not wired up" — the file is in `ds/` but has no export line in
`ds/index.ts` and no block in the design-kit view, so it cannot be used or
reviewed from the app yet.

Target is 17 components — the Custom design system module asks for a
minimum of 10.

## Shared files

`frontend/src/ds/index.ts` — append only. Two people adding an export line
is a trivial conflict; two people restructuring the file is not.

`frontend/src/index.css` and `frontend/src/palettes/` — coordinate before
editing. A palette change is a team decision, not an individual one, and
goes on its own `feature/palette-*` branch with before/after screenshots.

## Before starting a component

Check this table. If it is taken, say so in Slack rather than building it
— we have already duplicated work once.

## Conventions

See 310 — Design System Conventions.