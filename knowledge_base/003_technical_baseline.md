# 003 — Technical Baseline

The technical baseline defines the minimum technical shape of the application. These requirements apply regardless of which modules are chosen.

---

## Application architecture

Three components are required:
- **Frontend** — the browser-facing UI
- **Backend** — the server-side application
- **Database** — persistent data storage with a defined schema

---

## Frontend

- Must be clear, responsive, and accessible across all devices
- Must use a CSS framework or styling solution (Tailwind, Bootstrap, Material-UI, or equivalent)
- Must be built using a recognised frontend framework

What counts as a framework:
- React, Vue, Angular, Svelte, Next.js

What does not count as a framework:
- jQuery, Lodash, Axios — these are libraries/utilities

A framework must provide: a structured architecture and code organisation conventions, built-in features for common tasks (routing, state management), and a complete ecosystem of tools and libraries.

---

## Backend

- Must use a backend framework (Django, Flask, Express, Fastify, NestJS, Ruby on Rails, etc.)
- Full-stack frameworks (Next.js, Nuxt.js, SvelteKit) count as both frontend and backend if both capabilities are used

---

## Database

- Must have a clear schema with well-defined relations between tables
- Schema must be documented in the README

---

## User authentication

At minimum, the application must support:
- Email and password authentication
- Passwords must be hashed and salted — plaintext storage is an automatic failure
- Secure registration and login flow

Additional authentication methods (OAuth, 2FA) can be added via modules.

---

## Forms and user input

- All forms and user inputs must be validated on both frontend and backend
- Frontend validation is for UX; backend validation is for security — both are required
- Server-side sanitisation must be in place
