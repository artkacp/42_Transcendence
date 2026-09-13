# 310 — Design System Conventions

Rules for writing components in `frontend/src/ds/`. Applies to everyone
adding a component.

## Semantic tokens, never palette names

Components reference roles. Roles map to the palette. The palette lives in
one file.

```
   component            theme (index.css)        palette file
   ──────────────       ──────────────────       ────────────────────
   bg-primary      ──▶  --color-primary     ──▶  --color-terra-500
   text-on-primary ──▶  --color-on-primary  ──▶  --color-cream-50
   border-border   ──▶  --color-border      ──▶  --color-cream-200

   never changes        maps roles               swap this file
                        to the palette           in one @import
```

Swapping a palette touches one line and no component files. Writing
`bg-terra-500` in a component breaks that — the family name leaks into
fifteen files and a rename becomes a refactor.

Available roles are defined in `frontend/src/index.css`. If a component
needs a role that does not exist yet, add the role — do not reach into the
palette.

## Component rules

- One component per file, filename matches the export.
- Variants via `Record<Variant, string>`, not if/else chains.
- Extend the native element's attributes and spread `...rest`.
- Defaults in the destructuring: `variant = 'primary'`.
- `type="button"` by default on buttons — otherwise they submit forms.
- `focus-visible:ring-*` on anything interactive.
- `className` is appended, never replaced, so callers can extend.
- Icon-only buttons need `aria-label`.
- Decorative icons and emoji need `aria-hidden="true"` — a chevron next to
  a `<select>` or an emoji next to a heading carries no information a
  screen reader needs.
- React 19: `ref` is a normal prop. No `forwardRef`, no `displayName`.

## Every component goes in the design-kit view

`?view=design` (`frontend/src/views/DesignSystem.tsx`) shows every
component in its main states. This is UI-11.1 and it is what evaluators
will open.

A component that is not in the style guide cannot be reviewed without
reading the source, and does not count toward the module.

## Branch from main

Components branched off an older base cannot use roles that do not exist
there yet, and end up hardcoding palette names. Branch from `main` and
target `main`.

## Before opening a PR

```bash
npm run lint && npm run build
```

Plus a clean Chrome console on the production preview:

```bash
npm run build && npx vite preview
```

Dev mode prints a React DevTools notice — that one is expected and does
not appear in production.
