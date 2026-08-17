# 004 — Module System

## How modules work

Modules are optional additions to the mandatory baseline. Each module earns points toward the required total.

| Module type | Points |
|-------------|--------|
| Major module | 2 |
| Minor module | 1 |
| **Minimum to pass** | **14** |

---

## Categories

- Web
- Accessibility and Internationalisation
- User Management
- Artificial Intelligence
- Cybersecurity
- Gaming and user experience
- Devops
- Data and Analytics
- Blockchain
- Modules of choice (custom)

Multiple modules can be chosen from the same category.

---

## The key rule: incomplete = 0

A module that is partially implemented or non-functional earns zero points.

- It is better to fully implement fewer modules than to partially implement more
- All claimed modules will be demonstrated live at evaluation
- Only fully functional modules count toward the final score

---

## Module dependencies

Many modules have prerequisites. Key dependency chains:

- All gaming add-ons (AI opponent, tournament, customisation, spectator, multiplayer 3+, second game) require at least one game to be implemented first
- Game statistics require a game
- Advanced chat features require the basic chat from the user interaction module
- SSR (minor, Web category) is incompatible with the ICP blockchain backend
- Custom modules require justification in the README

---

## Choosing modules

The subject recommends choosing modules after the project idea is clear. Module choices made before the application concept is defined often create incoherent combinations or unnecessary work.

Before committing to a module list:
1. What application are we building?
2. Which modules make sense for that application?
3. Do the chosen modules have their dependencies satisfied?
4. Can all team members contribute to the chosen modules?
5. Is 14 points realistically achievable in the project timeline?

---

## Bonus system

Modules beyond the 14-point minimum can be validated as bonus points.

| Extra module | Bonus pts |
|--------------|-----------|
| Major | 2 |
| Minor | 1 |
| **Maximum bonus** | **5** |

Bonus modules must be fully functional and properly justified in the README to count.

### Strategy: aim above 14

Target 16–18 points of modules during development rather than the exact 14 minimum. This provides:
- A safety buffer if 1–2 modules are partially rejected at evaluation
- Potential bonus points from any extra validated modules
- Flexibility to de-prioritise a struggling module late in development

Good buffer module candidates are ones that:
- Are self-contained (failing them does not break other modules)
- Build naturally on what is already being implemented
- Do not introduce large new infrastructure dependencies

### Avoid over-scoping

Implementing 22 points worth of modules and finishing none cleanly is worse than implementing 16 points and finishing all of them. The incomplete = 0 rule means width without depth is penalised.
