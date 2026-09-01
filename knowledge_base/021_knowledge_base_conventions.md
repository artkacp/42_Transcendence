# 021 — Knowledge Base Conventions

Rules for maintaining the shared knowledge base. Everyone contributing a note should follow these.

---

## What belongs here

The knowledge base is the team's shared reference. It covers:
- Project decisions (what we chose and why)
- Technical rules and traps that affect the whole team
- Workflows and conventions everyone must follow
- Setup guides and references needed to work on the project

**Do not add:**
- Personal scratch notes or work-in-progress thinking
- Loose observations that have not been discussed with the team
- Content that is only relevant to one person's task

Personal notes belong in each person's own gitignored folder.

---

## File naming

Format: `NNN_short_descriptive_name.md`

- `NNN` is a three-digit number (`000`, `001`, `002`, ...)
- Round hundreds (`000`, `100`, `200`, ...) are always section index notes — one per section
- Round tens within a section (`010`, `020`, `030`, ...) start a sub-topic
- Sequential notes within a sub-topic use `011`, `012`, etc.
- Use lowercase and underscores, no spaces
- Keep names short but specific

Numbers are assigned sequentially. If inserting between two existing notes, use the next available number at the end of the section rather than renaming existing files.

---

## Section structure

| Range | Section |
|-------|---------|
| 000–099 | Preparations and initial decisions |
| 100–199 | Architecture and development environment |
| 200–299 | Features and domain |
| 300–399 | Frontend |
| 400–499 | Backend |
| 500–599 | Database |
| 600–699 | Deployment and operations |
| 700–799 | Testing |
| 800–899 | Evaluation preparation |
| 900–999 | Others |

Each hundred opens with a `X00_index.md` listing the notes in that section.

---

## File structure

Every note should start with a heading matching the filename topic. Beyond that, use whatever structure makes the content clearest — no rigid template required.

---

## Language

All knowledge base notes are written in **English**.

---

## Proposing a new note

Before adding a note:
1. Check that the topic is not already covered in an existing note
2. If it extends an existing note, edit that note instead of creating a new one
3. If it is genuinely new, create the file and add it via the standard PR process — knowledge base changes go through review like any other content

---

## Keeping notes current

Notes can become outdated as the project evolves. When a decision changes:
- Update the existing note rather than adding a new one
- If the change is significant, note briefly what changed and when (a one-line entry at the bottom is enough)
- Do not leave contradictory information across multiple notes

---

## What this is not

This is not documentation for end users. It is internal team reference. Write for a teammate who joins mid-project, not for an evaluator or external reader.
