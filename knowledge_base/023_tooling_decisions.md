# 023 — Tooling Decisions

Summary of tools chosen, pending, or deferred for the project.

---

## Overview

| Tool | Decision | Status |
|------|----------|--------|
| Version control | Git | Done |
| Remote repository | GitHub | Done |
| Communication | Slack group chat | Done |
| Task tracking | TBD — Notion or GitHub Issues | Pending |
| .env sharing | Template committed, each person fills their own copy | Done |
| API testing | TBD — needs review | Pending |
| Database client | Flexible, VS Code extension acceptable | Flexible |
| Linter / formatter | TBD — low priority, not mandatory | Deferred |
| Branching strategy | Defined in note 022 | Done |
| Design / mockups | No fixed tool — whatever works | Flexible |
| GitHub Actions (CI) | Deferred — add when scaffold and tests exist | Later |

---

## Per-tool notes

### .env sharing

Each person gets `.env.example` from the repo and fills in their own values locally. The `.env` is gitignored for everyone — never committed. For sensitive shared secrets (API keys, OAuth credentials), agree on a one-time secure channel at the start (encrypted message, in person) — then each person stores their own copy locally.

### API testing tool

Used by backend developers to send HTTP requests and inspect responses while building the REST API, before the frontend exists.

Options:
- **Thunder Client** — VS Code extension, no separate app, collections shareable as JSON files in the repo
- **Postman** — standalone app, free tier, widely used, exportable collections
- **Insomnia** — standalone, similar to Postman

Since the team uses VS Code, Thunder Client is the lowest-friction starting point. Review when backend development starts.

### Database client

A VS Code extension (e.g., SQLTools + PostgreSQL driver) is sufficient for inspecting tables and running queries during development. pgAdmin is also available as a Docker container if a fuller GUI is needed without installing anything.

### Linter and formatter

Not required by the subject, but worth the investment in a team of 5:
- **ESLint** catches TypeScript mistakes the compiler misses
- **Prettier** handles code formatting — eliminates style debates in code reviews

A minimal setup (one config file each, two VS Code extensions) takes about 30 minutes once. Recommend setting it up when the repo scaffold is created rather than retroactively.

### Design and mockups

No fixed requirement. Excalidraw (browser-based, free, no account needed) is useful for quick sketches. Use whatever is fastest.

### GitHub Actions

GitHub's built-in CI/CD system. Runs automated checks (tests, lint) on every push or pull request.

Cost: free for public repositories. For private repositories: 2,000 free minutes/month on the free plan, which is more than enough for a project of this scale.

When to set it up: not day one. Once the project has a working scaffold and at least some tests exist, a basic workflow (run lint and tests on every PR) prevents broken code from being merged. Add it in the first or second sprint.
