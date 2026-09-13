# 320 — Tailwind v4: `@theme` Pruning

A silent failure that cost a session to find. Anyone touching
`frontend/src/palettes/` needs to know it.

## What happens

Tailwind v4 removes `@theme` variables it cannot statically prove are
used. Proof means a literal string in the source: either a generated
utility class (`bg-terra-50`) or the text `var(--color-terra-50)`.

Our palette is enumerated at runtime — the design-kit view and PaletteLab
build the name from a variable:

```
style={{ backgroundColor: `var(--color-${name})` }}
```

The scanner never sees the literal, so there is no proof, so the variable
is dropped from the compiled `:root` block. When this was found the
palette had 21 tokens:

```
  spaniel_in_dunes.css              compiled CSS
  ┌──────────────────────┐          ┌──────────────────────┐
  │ 21 tokens declared   │  ──────▶ │ 14 tokens emitted    │
  └──────────────────────┘          └──────────────────────┘
                                      7 gone, no error
```

Missing: `cream-300`, `ink-700`, `terra-50`, `terra-100`, `terra-400`,
`sage-50`, `honey-400`.

## Why it is dangerous

```
tsc            passes
vite build     passes
console        clean
the page       swatches render blank
```

Nothing reports it. `var(--color-terra-50)` resolves to nothing and the
element gets no background. On a light palette a blank tile on a light
page is invisible — the bug hides itself.

## Fix

Palette files use `@theme static`, not `@theme`:

```
@theme static {
  --color-cream-50: oklch(0.965 0.035 85);
  ...
}
```

`static` emits every variable in the block regardless of what the scanner
can prove. This is the right call for a file whose whole purpose is to be
enumerated.

## Verify after any palette change

```bash
npm run build
grep -o -- '--color-[a-z]*-[0-9]\+' dist/assets/*.css | sed 's/.*://' | sort -u | wc -l
```

Must equal the number of tokens in the palette — 28 at the time of
writing. Fewer means something was pruned.

Note `[0-9]\+`, not `[0-9]*`. The loose pattern also matches truncated
semantic-role names (`--color-text-`, `--color-on-`) and reports 35
instead of 28.

## The general rule

Tailwind v4 cannot generate anything from a computed name. Any
`` `bg-${x}` `` or `` `var(--color-${x})` `` is invisible to it. Options:

1. `@theme static` on the defining block — simplest for palette files.
2. Reference every token literally somewhere the scanner walks.
3. Only address tokens through real utility class names.

For swatch grids and token showcases, option 1. Also give every swatch a
visible border, so an unstyled tile cannot hide against the background.

## Related

- 310 — Design System Conventions