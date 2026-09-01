# 002 — Mandatory Requirements

Everything listed here is required regardless of which modules the team chooses. These are not optional. Violating any of the hard rules below results in immediate project rejection.

---

## Hard requirements

### Credentials and secrets

- All API keys, credentials, and environment variables must be stored in a local `.env` file
- `.env` must be listed in `.gitignore` — never committed
- An `.env.example` file must be present in the repository (shows required keys without values)
- If any credentials are found in the repository, the project fails immediately

### Deployment

- The project must run with a single command: `docker-compose up --build`
- `docker-compose.yml` must be at the root of the repository
- Containerisation is required

### HTTPS

- Every connection from the browser to the backend must use HTTPS
- Internal connections (backend to database, containers within the same network) do not require HTTPS

### Browser compatibility

- The application must be fully compatible with the latest stable version of Google Chrome
- No warnings or errors in the browser console at any point during use

### Multi-user support

- The application must support multiple simultaneous users
- Multiple users can be logged in and active at the same time
- Concurrent actions must be handled without data corruption or race conditions
- Real-time updates must be reflected across connected users where applicable

### Privacy Policy and Terms of Service

- Both pages must exist and be accessible from the application (typically via footer links)
- Content must be relevant and appropriate — not placeholder or empty text

### Git discipline

- All team members must have commits in the repository
- Commit messages must be clear and meaningful
- The repository must show proper work distribution across the team

---

## Additional requirements

- No memory leaks (applies to any long-running server processes)
- No unexpected crashes during use
- The project must run without any manual file edits beyond the `.env` setup
