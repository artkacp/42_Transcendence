# Frontend — Pawfect Match

Vite + React 19 + TypeScript + Tailwind CSS v4.

**Never touched frontend before? Start here. Four commands, three minutes.**

---

## Quick start

On a 42 machine, from the repo root:

```bash
cd frontend
mkdir -p ~/goinfre/node_modules && ln -s ~/goinfre/node_modules node_modules
npm install
npm run dev
```

Open http://localhost:5173 — you should see a terracotta heading on a
cream background.

That's it. You now have a working frontend.

> **Do not skip the symlink line.** See [Why goinfre](#why-goinfre) if
> you want to know what it does. If you already ran `npm install`
> without it: `rm -rf node_modules` and start over.

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
work only. In production nginx serves the static `dist/` folder, and
the dev server is not involved at all.

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
starting, re-run `npm install`. Nothing is lost.

Same principle as Inception: heavy, frequently-written data does not
belong in the layer that cannot handle it.

---

## Where to put your code

```
src/
├── main.tsx        mounts React — you will not touch this
├── App.tsx         picks which page to show
├── index.css       design tokens  ← ask before editing
│
├── data/           TypeScript interfaces, mock data
├── ds/             design system — Button, Card, Input...
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
(a button, a badge), in `components/` if it is specific to this app
(the sidebar, the chat panel).

---

## Styling — read this before writing any CSS

Tailwind v4 **has no config file**. `tailwind.config.js` does not
exist. All theme configuration lives in `src/index.css`:

```css
@theme {
  --color-terra-500: oklch(0.63 0.14 38);
  --font-display: 'Fraunces', ui-serif, serif;
}
```

Every token automatically becomes utility classes:

```
--color-terra-500  →  text-terra-500   bg-terra-500   border-terra-500
--font-display     →  font-display
```

So in a component you write:

```tsx
<h1 className="font-display text-4xl text-terra-500">Pawfect Match</h1>
```

**Never hardcode a colour.** No `#c96442`, no `style={{ color: ... }}`.
If you need a colour that does not exist yet, add one line to `@theme`
and it is available everywhere.

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

Branch naming: `feat/`, `fix/`, `docs/`, `infra/` + short description.
Never commit to `main`.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `ENOENT: package.json` | wrong directory — run `pwd`, you need to be in `frontend/` |
| `Stale file handle` | node_modules on NFS — the symlink is missing |
| quota exceeded | same |
| Tailwind classes do nothing | `tailwindcss()` missing from `vite.config.ts` |
| a custom colour does nothing | token not declared in `@theme` |
| lint error about hooks | a hook is called conditionally or inside a loop |
| build fails but dev works | TypeScript error — `dev` skips typecheck |
| port 5173 already in use | another dev server is running — `pkill -f vite` |

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
| Linter | Oxlint | type-aware rules enabled |
