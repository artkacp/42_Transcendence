# Planned change: animated ASCII logo

Status: **parked** on `feature/logo-ascii-anim` — no PR until F1 (Auth view) is merged.

```
 main ──●──────────────●── F1 merged
         \             ▲
          feature/logo-ascii-anim ── waits here, then AsciiLogo.tsx
```

## Goal

Add a lightweight, dependency-free animated ASCII logo to the project.

The logo cycles through three frames, every 500 ms, forever:

1. `(︶ᴥ₍ᐢ◔ ◔ᐢ₎)`
2. `(︶ᴥ₍ᐢ◕ ◕ᐢ₎)`
3. `(︶ᴥ₍ᐢ◑ ◑ᐢ₎)`

## Current standalone prototype

`frontend/prototypes/logo/logo.html` — open it directly in Chrome for a quick visual check.
It is outside `src/`, so it is never part of the build.

It uses:

- plain HTML, CSS and vanilla JavaScript;
- `document.getElementById('logo')` to reach the element;
- `setInterval()` to switch `textContent` between frames;
- `white-space: pre` to keep spaces inside the ASCII art;
- `role="img"` + `aria-label` so screen readers announce one logo, not raw characters.

## Target integration

Move the prototype into React as a reusable design-system primitive:

- `src/ds/AsciiLogo.tsx`

Not in `src/views/` — `src/ds/` must not import from `src/views/`.

Where it will be used:

1. Auth page header (F1) — first screen everyone sees.
2. Optional: Shell logo on hover.

## React implementation

Functional component `AsciiLogo`.

- React 19 conventions: `ref` is a normal prop; no `forwardRef`, no `displayName`.
- No new dependencies (no `clsx`, no `tailwind-merge`); plain template strings for conditional classes.
- Tailwind v4 utilities only; there is no Tailwind config file.
- Colors from existing tokens: `terra`, `cream`, `ink`, `sage`, `honey`, `danger`.
- Font: **`font-mono`**. The glyphs `ᴥ ᐢ ₍ ₎ ︶` are likely missing in Fraunces (`font-display`); a fallback font would change the width between frames.

## Accessibility

- Root element: `role="img"` with a meaningful `aria-label`, e.g. `aria-label="Animated ASCII logo"`.
- Every frame: `aria-hidden="true"`.
- Respect `prefers-reduced-motion: reduce` → show one static frame (`◕`) and do not start the timer.

## Technical requirements

- Frames in a constant array, outside the component.
- Timer in `useEffect`; **always** clear it in the cleanup function.
- `setInterval` is the right tool here: 3 discrete frames at 500 ms. `requestAnimationFrame` is only needed for smooth per-frame motion.
- No layout shift: render all frames in the same grid cell and toggle visibility, or reserve a stable size.
- Keep whitespace with `whitespace-pre`.
- Zero errors and zero warnings in the latest stable Chrome console.

```
  grid cell ┌──────────────────┐
            │ frame 1  visible │
            │ frame 2  hidden  │  ← same cell, same size
            │ frame 3  hidden  │
            └──────────────────┘
  timer ──◕ 500 ms ──◕ next index ──◕ … ──◕ unmount → clearInterval
```

## Acceptance criteria

- [ ] Cycles through all three frames in order and returns to the first.
- [ ] No layout shift while animating.
- [ ] Screen readers announce one logo name, not every frame.
- [ ] Reduced-motion users see a static logo.
- [ ] Latest stable Chrome console: no errors, no warnings.
- [ ] No timer left running after the component unmounts (StrictMode mounts twice in dev — check it).

## Out of scope

- Color animation, hover effects, sound.
- Using the logo anywhere before F1 is merged.
