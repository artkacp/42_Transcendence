# 005 — Subject Reference Example

The subject provides this Pong project as a worked example of a valid 14-point combination. It is useful as a scope reference — a concrete illustration of what a passing module set looks like, not a template to follow.

---

## Pong (14 pts) — subject example

| Module | Category | Type | Pts |
|--------|----------|------|-----|
| Web-based game | Gaming | Major | 2 |
| Remote players | Gaming | Major | 2 |
| Tournament system | Gaming | Minor | 1 |
| Game customisation | Gaming | Minor | 1 |
| Standard user management | User Management | Major | 2 |
| OAuth 2.0 | User Management | Minor | 1 |
| Frameworks (frontend + backend) | Web | Major | 2 |
| ORM | Web | Minor | 1 |
| AI Opponent | AI | Major | 2 |
| **Total** | | | **14** |

---

## What this example demonstrates

- A coherent module set: all gaming add-ons sit on top of the base game module
- A mix of Major and Minor modules to reach exactly the minimum
- The dependency chain is satisfied: remote players, tournament, AI opponent, and customisation all require the base game
- User management and frameworks are natural companions to any web project
- Targeting exactly 14 with no buffer — a riskier strategy than aiming for 16–18
