# Frontend — Pawfect Match

Vite + React 19 + TypeScript + Tailwind CSS v4.

---

## Prerequisites

Node >= 22.12 (Vite 8). No sudo on 42 machines — install to your home:

```bash
cd /tmp
curl -fsSLO https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
FILE=$(grep 'linux-x64.tar.xz' SHASUMS256.txt | awk '{print $2}')
curl -fsSLO https://nodejs.org/dist/latest-v22.x/$FILE
grep " $FILE\$" SHASUMS256.txt | sha256sum -c -
mkdir -p ~/.local/node
tar -xJf $FILE -C ~/.local/node --strip-components=1
grep -qxF 'export PATH="$HOME/.local/node/bin:$PATH"' ~/.zshrc || \
  echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc && node -v && npm -v
```

`sha256sum` must print `OK` — otherwise stop. `node -v` must show `v22.12` or later.

---

## Quick start

**Never touched frontend before? Start here. Four commands, three minutes.**

On a 42 machine, from the repo root:

```bash
cd frontend
mkdir -p ~/goinfre/node_modules && ln -s ~/goinfre/node_modules node_modules
npm ci
npm run dev
```

Open http://localhost:5173 — you should see the Pawfect Match sign-in page.

That's it. You now have a working frontend.

> **Do not skip the symlink line.** See [Why goinfre](#why-goinfre) if
> you want to know what it does. If you already installed without it:
> `rm -rf node_modules` and start over.

`npm ci` installs exactly what `package-lock.json` says. Run it again
every time someone adds a library (for example `recharts` for the
analytics view), otherwise the build fails with `Cannot find module`.

---

## What you just installed

```
  ┌─────────────────────────────────────────────────┐
  │  npm run dev                                    │
  │      │                                          │
  │      ▼                                          │
  │  ┌────────┐  watches src/  ┌───────────────┐    │
  │  │  Vite  │ ──────────────▶│  browser      │    │
  │  │  :5173 │ ◀──────────────│  hot reload   │    │
  │  └────────┘   instant      └───────────────┘    │
  └─────────────────────────────────────────────────┘

  Save a file → browser updates in ~50ms. No refresh needed.
```

If you know Inception: Vite here plays the role nginx played there —
it serves the app. The difference is that `npm run dev` is for local
work only. In the Docker stack nginx serves the static `dist/` folder,
and the dev server is not involved at all.

---

## Running with Docker (full stack)

The frontend has no container of its own. `docker-compose.yml` builds
it **inside the nginx image** (`build: ./frontend`): a Node stage runs
`npm run build`, then nginx serves `dist/`.

```
frontend/src  ──npm run build──▶  dist/  ──COPY──▶  nginx  ──▶  https://localhost:8443
```

So after changing any `.tsx` / `.css` file, rebuild **only nginx**:

```bash
# from the repo root
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build nginx
```

Then hard-reload the browser (`Ctrl+Shift+R`). Backend `.py` changes
need nothing: the dev override runs Django with autoreload.

| You changed | Do |
|---|---|
| `.tsx`, `.ts`, `.css` | rebuild nginx (command above) |
| `package.json` | rebuild nginx (it runs `npm ci` inside) |
| `docker-compose*.yml`, a Dockerfile | rebuild everything: `... up -d --build` |
| backend `.py` | nothing, autoreload |

Pages open directly by URL: `https://localhost:8443/?view=browse`,
`?view=rehome`, `?view=adoptions`, `?view=friends`, `?view=notifications`,
`?view=profile`, `?view=analytics`.

---

## Commands

| Command | What it does | When you use it |
|---|---|---|
| `npm run dev` | dev server, hot reload | all day, every day |
| `npm run build` | typecheck + build → `dist/` | before every PR |
| `npm run preview` | serve `dist/` locally | to check the real build |
| `npm run lint` | oxlint | before every PR |

`npm run dev` does **not** check types. `npm run build` does. Code can
run fine in dev and still fail the build — always run `build` before
pushing.

---

## Why goinfre

Home is mounted over NFS with a ~5 GB quota. `node_modules` is roughly
250 MB spread across thousands of tiny files.

Installing it directly into your home directory causes:

- quota exceeded, mid-install
- `Stale file handle` errors — NFS cache cannot keep up
- slow installs, every time

The symlink puts the actual files on local disk (`goinfre`) while the
project still sees `node_modules` where it expects it.

```
frontend/node_modules  ──symlink──▶  ~/goinfre/node_modules
   (what npm sees)                      (where files live)
```

Verify it worked — you want an arrow, not a directory:

```bash
ls -la node_modules
# node_modules -> /nfs/homes/<login>/goinfre/node_modules
```

`goinfre` is wiped on logout on some machines. If the app stops
starting, re-run `npm ci`. Nothing is lost.

Same principle as Inception: heavy, frequently-written data does not
belong in the layer that cannot handle it.

---

## Where to put your code

```
src/
├── main.tsx        mounts React — you will not touch this
├── App.tsx         picks which page to show (?view=…)
├── index.css       design tokens + semantic roles  ← ask before editing
├── palettes/       colour palettes (mockup, spaniel_in_dunes…)
│
├── api/            client.ts: fetch wrapper, Bearer token, 401 refresh
├── data/           TypeScript interfaces, mock data
├── ds/             design system — Button, Card, Chip, EmptyState...
├── components/     composites built from ds/  (Shell, Chat)
└── views/          one file per page
```

Dependencies flow one way only:

```
data → index.css → ds/ → components/ → views/ → App
```

A `ds/` component never imports from `views/`. If you find yourself
wanting that, the component belongs in `components/` instead.

**Building a new UI piece?** It goes in `ds/` if it is generic
(a button, a badge, a progress bar), in `components/` if it is specific
to this app (the sidebar, the chat panel).

**Changing a `ds/` component?** Every page that uses it changes too.
Say so in the PR description.

---

## Styling — read this before writing any CSS

Tailwind v4 **has no config file**. `tailwind.config.js` does not
exist. Theme configuration lives in CSS: palette values in
`src/palettes/*.css`, semantic roles in `src/index.css`:

```css
/* palettes/mockup.css */
--color-terra-500: oklch(0.63 0.14 38);

/* index.css */
--color-primary: var(--color-terra-500);
```

Every token automatically becomes utility classes:

```
--color-terra-500  →  text-terra-500   bg-terra-500   border-terra-500
--color-primary    →  text-primary     bg-primary     border-primary
--font-display     →  font-display
```

**Prefer the role over the raw colour.** `text-primary` means "the brand
colour", whatever the palette is. `text-terra-500` means one exact
value, and that value changes between palettes (in `spaniel_in_dunes`
it is blue).

```tsx
<h1 className="font-display text-4xl text-primary">Pawfect Match</h1>
```

**Never hardcode a colour.** No `#c96442`, no `style={{ color: ... }}`.
If you need a colour that does not exist yet, add a token and it is
available everywhere.

### The palette

| Group | Use for |
|---|---|
| `cream-50…300` | backgrounds, surfaces |
| `ink-400…900` | text — 400 muted, 900 primary |
| `terra-50…600` | primary — buttons, links, accents |
| `sage-50…600` | secondary, success |
| `honey-100/400` | highlights |
| `danger-100/600` | errors, destructive actions |

Colours are in OKLCH, a perceptually uniform colour space: the steps
`400 → 500 → 600` look evenly spaced to the eye, which HSL does not
guarantee.

Type: **Fraunces** for display, **Outfit** for body. Loaded from
Google Fonts in `index.html`.

### Kaomoji instead of emoji

The UI uses monochrome kaomoji, not colour emoji: `U・ᴥ・U Dogs`,
`=^ ◗ ◗^= Cats`, `≧◒_◒≦` for errors. Kaomoji are text, so they follow
the palette; emoji cannot be recoloured.

- Display fonts often lack these glyphs (`№`, `･ﾟ`): the browser falls
  back to another font and the size changes. Check in the browser.
- Decorative marks get `aria-hidden="true"` so screen readers skip them
  (`EmptyState` already does this).
- Several spaces collapse to one in HTML; use non-breaking spaces for
  wide gaps.

---

## Before you open a PR

```bash
npm run lint     # must pass
npm run build    # must pass
```

Then open the app and check the browser console — **the subject
requires zero errors and zero warnings**. Keep DevTools open while
you work; catching warnings as they appear is far easier than hunting
them down the night before the defence.

Branch naming: `feature/`, `fix/`, `docs/`, `infra/` + short description
(see `knowledge_base/022_git_github_workflow.md`). Never commit to `main`.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `ENOENT: package.json` | wrong directory — run `pwd`, you need to be in `frontend/` |
| `Stale file handle` | node_modules on NFS — the symlink is missing |
| quota exceeded | same |
| `Cannot find module 'recharts'` (or any lib) | dependencies changed — run `npm ci` |
| Tailwind classes do nothing | `tailwindcss()` missing from `vite.config.ts` |
| a custom colour does nothing | token not declared in the palette / `index.css` |
| lint error about hooks | a hook is called conditionally or inside a loop |
| build fails but dev works | TypeScript error — `dev` skips typecheck |
| port 5173 already in use | another dev server is running — `pkill -f vite` |
| Docker shows the old UI | nginx not rebuilt, or browser cache — rebuild nginx, `Ctrl+Shift+R` |
| a symbol shows as `□` | the font has no such glyph — pick another symbol |

---

## Stack reference

| Layer | Choice | Notes |
|---|---|---|
| Build tool | Vite 8 | needs Node ^20.19 or >=22.12 |
| Framework | React 19 | |
| Language | TypeScript | strict mode |
| Styling | Tailwind CSS v4 | CSS-first config, no JS config file |
| Icons | Lucide React | |
| Charts | Recharts | analytics view |
| Real-time | WebSocket | chat, presence, live stage updates |
| Linter | Oxlint | type-aware rules enabled |
| Serving | nginx (Docker) | built in a multi-stage image from `frontend/` |