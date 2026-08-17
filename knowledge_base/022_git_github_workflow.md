# 022 — Git & GitHub Workflow

How we use Git and GitHub on this project. Everyone on the team follows these rules.

---

## Core rules

- **Never commit directly to `main`** — all changes go through a branch and a pull request
- **No secrets, credentials, or `.env` files in the repository** — ever; score is 0 if found at evaluation
- **No personal notes, unfinished drafts, or private files** — keep those in your gitignored local folder
- **Commit messages must be clear and meaningful** — describe what changed and why, not just "fix" or "update"
- **All team members must have commits in the repo** — evaluators check the git history

---

## Merge strategy

- **Merge commit** or **rebase merge** — both are allowed
- **Squash merge is disabled** — we keep full git history
- Never force-push to `main`

---

## Branch workflow

### 1. Start from a task

Every piece of work begins as a tracked task in the team's project management tool (to be confirmed — see note 010). Before opening a branch, the task should exist and be assigned to you.

If using GitHub Issues, the task number (`#12`, etc.) can be referenced in commit messages and PR descriptions to link code to the task automatically (see below).

### 2. Create a branch from `main`

```bash
git checkout main
git pull origin main
git checkout -b <branch-name>
```

### 3. Branch naming convention

Format: `<type>/<short-description>`

| Type | Use for |
|------|---------|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `infra/` | Docker, CI, deployment, nginx |
| `docs/` | Knowledge base, README, documentation |
| `refactor/` | Code restructuring without behaviour change |

Examples:
```
feature/user-login
fix/avatar-upload-validation
infra/postgres-container-setup
docs/git-workflow
```

Keep descriptions short (2–4 words, hyphen-separated, lowercase).

### 4. Commit regularly with meaningful messages

```bash
git commit -m "Add password hashing to registration endpoint"
git commit -m "Fix file size validation on avatar upload"
```

Reference the issue number when relevant:
```bash
git commit -m "Add JWT middleware to protected routes — closes #12"
```

Writing `closes #12` or `fixes #12` in a commit message (or PR description) automatically closes that issue when merged to `main`.

### 5. Push and open a Pull Request

```bash
git push origin <branch-name>
```

Then open a PR on GitHub:
- **Title**: same level of clarity as a commit message
- **Description**: what this PR does, why, and any context needed for review; include `Closes #XX` to link the issue
- **Reviewers**: assign at least **2 reviewers** (target with 5 team members)
- **Labels**: add the appropriate label (feature, fix, infra, etc.)

### 6. Review and merge

- Reviewers leave comments, request changes, or approve
- Author addresses feedback with new commits on the same branch
- Once approved by 2 reviewers, the author merges (or a reviewer merges if the author is unavailable)
- Delete the branch after merging

---

## Keeping your branch up to date

If `main` has moved forward while you were working on your branch, rebase before opening the PR:

```bash
git fetch origin
git rebase origin/main
```

Resolve any conflicts, then push. Do not merge `main` into your feature branch — use rebase to keep history clean.

---

## Commit message guidelines

Good commit messages:
```
Add email validation to registration form
Fix broken avatar upload when file exceeds 2MB
Set up PostgreSQL container in docker-compose
Add EN/FR/ES translations for navigation labels
```

Bad commit messages:
```
fix
update stuff
wip
changes
```

If you cannot describe the commit in one line, the commit is probably too large. Break it into smaller, focused commits.

---

## `.gitignore` — what stays out of the repo

At minimum, the following must be gitignored:
- `.env` files (all of them)
- Personal notes folders
- Editor config and IDE files (`*.idea`, `.vscode/` unless shared settings are committed intentionally)
- Build artifacts and dependency folders (`node_modules/`, `__pycache__/`, `dist/`, etc.)
- OS files (`.DS_Store`, `Thumbs.db`)

Check `.gitignore` before the first push and before any PR that adds new file types.

---

## Quick reference

```
main              — protected; never commit directly
feature/xyz       — your working branch
PR                — required for every merge; 2 reviewers
Closes #N         — in PR description or commit to auto-close the issue
rebase            — to sync with main before opening PR (not merge)
squash merge      — disabled; use merge commit or rebase merge
```
