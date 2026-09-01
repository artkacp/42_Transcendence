# 024 — GitHub Issues and Projects

> **This note is an exploration.** The team has not yet decided on a project management tool — Notion and GitHub Issues are both under consideration. See note 010. This note covers how GitHub Issues and Projects work, as a reference for that decision.

How GitHub Issues and GitHub Projects work for task tracking. Both are free and built into any GitHub repository.

---

## GitHub Issues

An Issue is a tracked unit of work — a task, feature, bug report, or question. Every issue gets a number (`#1`, `#2`, etc.) that can be referenced from commits and pull requests.

### Creating an issue

Go to the repository → **Issues** tab → **New issue**.

A useful issue includes:
- **Title**: short, specific ("Add login form validation" not "Fix stuff")
- **Description**: what needs to be done and why; acceptance criteria if applicable
- **Assignee**: who is responsible for it
- **Label**: what type of work it is (see below)
- **Milestone**: which sprint or phase it belongs to

### Labels

Labels categorise issues. GitHub creates some defaults; you can add your own. Recommended set:

| Label | Use for |
|-------|---------|
| `feature` | New functionality |
| `bug` | Something broken |
| `infra` | Docker, CI, nginx, deployment |
| `frontend` | UI work |
| `backend` | API, business logic |
| `database` | Schema, migrations, queries |
| `documentation` | README, notes, comments |
| `blocked` | Cannot proceed — waiting on something |

### Milestones

A milestone groups issues into a goal with a due date. Useful for sprint planning:
- **Milestone: Sprint 1** — auth system + docker scaffold
- **Milestone: Sprint 2** — core features + basic UI
- etc.

The milestone view shows progress (X of Y issues closed).

### Referencing issues in commits

If you include `#123` in a commit message, GitHub links the commit to issue 123 automatically. If you write `Closes #123` or `Fixes #123`, GitHub closes the issue automatically when the commit lands on the default branch.

```bash
git commit -m "Add JWT validation middleware — closes #12"
```

### Referencing issues in pull requests

Same syntax in the PR description. `Closes #45` in a PR body closes issue 45 when the PR is merged.

---

## GitHub Projects

GitHub Projects is a Kanban board that sits on top of Issues. Issues become cards; you drag them between columns. Built into GitHub — no separate tool needed.

### Setting up a board

1. Go to the repository → **Projects** tab → **New project**
2. Choose **Board** view
3. Create columns:

| Column | Meaning |
|--------|---------|
| **Backlog** | Known work not yet started |
| **Ready** | Defined and ready to be picked up |
| **In Progress** | Someone is actively working on it |
| **In Review** | PR open, waiting for review |
| **Done** | Merged and closed |

4. Add your repository to the project (Project settings → Repositories)

### Adding issues to the board

- From the Project board: click **+ Add item** → type `#` to search issues
- From an Issue: in the right sidebar → **Projects** → assign it to your board

### Automation

GitHub Projects has built-in automation rules (Project settings → Workflows):
- **Item added to project** → set status to Backlog
- **Item closed** → set status to Done
- **Pull request merged** → set linked items to Done

Enable these from day one — they reduce the overhead of manually moving cards.

### Views

- **Board** — Kanban columns (best for daily progress)
- **Table** — spreadsheet view (good for planning and filtering)
- **Roadmap** — timeline view (good for milestone planning)

---

## Practical workflow

### Starting a task
1. Find (or create) an Issue for the work
2. Assign it to yourself
3. Move the card to **In Progress**
4. Create a branch: `feature/12-login-validation`

### During work
- Commit regularly with meaningful messages referencing the issue number
- If blocked, add the `blocked` label and leave a comment explaining why

### Finishing a task
1. Open a Pull Request
2. Write `Closes #12` in the PR description
3. Move the card to **In Review**
4. Request review from at least 2 teammates
5. After approval and merge: issue closes automatically, card moves to Done

### Sprint planning
1. Create a new Milestone for the sprint
2. Assign relevant issues to it
3. Use the Milestone view to track completion percentage

---

## Tips

- **Keep issues small**: one issue = one focused piece of work. "Add password hashing to registration endpoint" is right-sized. "Build the entire auth system" is too large.
- **Close stale issues**: if something will never be done, close it with a comment. A backlog of 80 open issues is noise.
- **The board is only useful if everyone uses it**: agree that opening a branch means creating or claiming an issue. This makes the board the true source of truth.
