# 008 — First Meeting Agenda

Agenda for the initial kickstart meeting. Goal: leave with enough decisions made that everyone can start working immediately after.

---

## Agenda

### 1. Introductions and skills mapping (15 min)

For each person, establish:
- Comfort with frontend (HTML/CSS, JS, frameworks)
- Comfort with backend (REST APIs, databases, frameworks)
- Prior experience with Docker / containerisation
- Prior experience with WebSockets / real-time systems
- Any strong interest or aversion toward a technology or project type

Goal: understand the team's skill distribution before making any tech or project decisions.

---

### 2. Role assignments (10 min)

Assign the four required roles:

| Role | Assigned to | Notes |
|------|-------------|-------|
| Product Owner (PO) | | |
| Project Manager (PM) | | |
| Technical Lead | | |
| Developers | (everyone) | |

Goal: named assignments agreed and written down.

---

### 3. Project direction (30–45 min)

This is the most important decision of the meeting.

1. Go around and discuss project type preferences (game, social platform, productivity tool, etc.)
2. Evaluate the top 2–3 options: is it interesting enough, can we reach 14 pts, does it fit the team's skills?
3. Pick one direction

Goal: one project direction decided by end of this item.

---

### 4. Module selection (20–30 min)

1. List the obvious modules that fit the chosen project
2. Verify dependencies are satisfied for each module
3. Count points — target 16–18 pts (buffer above the 14 minimum)
4. Mark modules as definite vs. stretch goal
5. Assign rough ownership per module

Goal: a draft module list with point count and rough ownership.

---

### 5. Tech stack decisions (20 min)

Decisions to make:
- Which frontend framework? (React, Vue, Angular, Svelte, etc.)
- Which backend framework?
- Database?
- ORM?
- CSS solution?

Goal: frontend and backend framework decided, database confirmed, CSS approach agreed.

---

### 6. Deployment and network access (15 min)

The project must use HTTPS and support multiple simultaneous users on the school network. Evaluators connect from separate machines — this is how multi-user features are tested.

A self-signed certificate causes browser warnings, which violates the "no warnings" requirement.

| Approach | Tradeoff |
|----------|----------|
| `mkcert` | Local trusted CA; requires install on every evaluator machine |
| Real domain + Let's Encrypt | Works in any browser; requires a domain |
| Campus convention | May or may not exist — ask peers who have passed |

Goal: a plan for HTTPS and network access agreed before development begins.

---

### 7. Project management setup (15 min)

- Git repository: who creates it, access for all members
- Branching strategy: protected main, feature branches, PR review required
- Issue tracking: tool choice
- Communication channel
- Meeting cadence
- Definition of done

Goal: everyone has access to the repo and communication channel before leaving the meeting.

---

### 8. Immediate next steps (10 min)

Close with concrete tasks assigned to specific people, with a target date.

| Task | Owner | By when |
|------|-------|---------|
| Create and configure git repository | | |
| Set up project management tool | | |
| Draft initial README structure | | |
| Set up docker-compose skeleton | | |
| Set up `.env.example` | | |
| Start scaffolding (frontend + backend) | | |
| Schedule first sprint planning session | | |

---

## Decisions that must come out of this meeting

1. What are we building?
2. Which modules are we targeting?
3. Which tech stack (frontend, backend, database)?
4. Who owns which role?
5. Where is the git repo?
6. Where do we communicate?
7. How will HTTPS work at evaluation?

## Decisions that can wait

- Exact database schema
- UI design and visual direction
- Detailed feature specifications
- CI/CD pipeline setup
- Bonus module strategy
