# 311 — Design System: Component Ownership

Who builds what, and where each component stands. Kept here rather than in
chat, because chat is where the previous split got lost.

Update the status column when a PR opens or merges.

| Component  | Owner    | PR  | Status   |
|------------|----------|-----|----------|
| Button     | oostapen | #6  | merged   |
| IconButton | oostapen | #6  | merged   |
| Card       | oostapen | #6  | merged   |
| Badge      | oostapen | #6  | merged   |
| Select     | iskaraag | #5  | merged   |
| Toggle     | iskaraag | #7  | open     |
| Chip       | iskaraag | #8  | open     |
| Avatar     | iskaraag | #9  | open     |
| EmptyState | iskaraag | #10 | approved |
| Progress   | oostapen | —   | next     |
| Stat       | oostapen | —   | next     |
| Input      | iskaraag | —   | —        |
| Textarea   | iskaraag | —   | —        |
| Tabs       | iskaraag | —   | —        |
| Modal      | iskaraag | —   | —        |
| Toast      | iskaraag | —   | —        |
| Pagination | oostapen | —   | —        |

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
