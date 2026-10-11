
## Font check (2026-10-11, school Ubuntu)

Every glyph renders, but from five different fonts → uneven width, risky on other machines.

| glyph | code | found in |
|---|---|---|
| `︶` | U+FE36 | Droid Sans Fallback only (CJK) ← risk |
| `ᴥ` | U+1D25 | FreeSerif, DejaVu Serif (no mono) |
| `ᐢ` | U+1422 | DejaVu Sans |
| `₍` | U+208D | DejaVu Sans Mono, FreeSerif |
| `◕` | U+25D5 | DejaVu Sans Mono, FreeSerif |

Next: test `‿` (U+203F), `◡` (U+25E1), `⌣` (U+2323) as a replacement for `︶`.
Check: `fc-list ":charset=203f" family`
