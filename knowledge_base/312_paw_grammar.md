# 312 — Design System: Paw Grammar (kaomoji instead of emoji)

The UI uses monochrome kaomoji instead of colored emoji. Kaomoji are plain text, so they follow the palette, take the page font and can be styled; emoji cannot be recolored. This note is the dictionary (Ctrl+F an emoji to find its replacement) and the rules for adding new marks. Owner: oostapen. Introduced in PR #100, extended in #101 and the publish-modal fix. Related: note 310 (design system conventions), note 311 (component ownership).

---

## Dictionary

One emoji per row. Search this file for the emoji you want to use.

| Emoji | Kaomoji | Meaning | Where |
|---|---|---|---|
| 🐶 | `U・ᴥ・U` | dogs | species chips (Browse, Analytics, design kit), publish modal |
| 🐕 | `U・ᴥ・U` | dog placeholder | pet cards and thumbnails without a photo |
| 🐱 | `=^ ◗ ◗^=` | cats | species chips, publish modal |
| 🐈 | `=^ ◗ ◗^=` | cat placeholder | pet cards and thumbnails without a photo |
| 💉 | `(ᐢᴥᐢ)✓` | vaccinated | filter chips |
| ✂️ | `✂` | neutered | filter chips (only the invisible FE0F removed) |
| 📭 | `◣◥ ･ﾟ` | empty, default | `EmptyState` default, Friends "No pending requests" |
| 🔒 | `(︶ᴥ ... ･ﾟ✧` | signed out / locked | empty states that need sign-in |
| 🔔 | `︶ᴥ︶ .｡O` | no notifications | Notifications |
| 😿 | `≧◒_◒≦` | something went wrong | error states |
| 🔍 | `⎇(◔ _◑)` | no match | filters / search with no result (bold, see Rules) |
| 🐾 | `ᴥ...` | no pets listed | Browse "No pals listed yet" |
| 🐾 | `ʕ •ᴥ• ....` | no friends | Friends "No friends yet" |
| 🐾 | `┐(︶▼︶)┌` | no adoptions | Adoptions "No adoptions yet" (bold, see Rules) |
| 🏡 | `︶ᴥ .. ･ﾟ✧` | no listings | Rehome, title "N° ･ﾟistings yet" |
| 🎉 | `(︶ᴥ₍^◒◒^₎･ﾟ✧)` | adopted | adopted badge (Browse card, Rehome) |
| 📎 | `╰●╮ ≡◕◕)` | has a file | Adoptions preview line |
| — | `(︶ᴥ .  .   .   .     ╰ᐢ◕ ◕ᐢ╮` | signed out, adoptions | Adoptions "Sign in to see your adoptions" |
| — | `︶ᴥ₍^◕◕^₎･ﾟ✧` | adopted by you | Adoptions badge "adopted … by You" |
| — | `︶ᴥ－－).｡O` | adopted by someone else | Adoptions badge |

Not converted yet (arrived from parallel branches, follow-up `style/paw-new-views`):

| Emoji | Proposed | Where |
|---|---|---|
| 🔒 | `(︶ᴥ ... ･ﾟ✧` | Activity, signed out |
| 😿 | `≧◒_◒≦` | Activity error, Friends Discover "Couldn't load people" |
| 🔍 | `⎇(◔ _◑)` | Friends Discover "No one matches that search" |
| 🐾 | `◖°.･◗` | Activity |
| 🌟 | `ʕ•ᴥ ･ﾟ✧ ＾＾` | Friends Discover "Nobody else here yet" |

---

## Rules

- **No colored emoji in `frontend/src`.** The only exception is ★ inside a code comment.
- **Decorative marks are hidden from screen readers.** `EmptyState` already sets `aria-hidden` on its mark. A mark next to a word goes in `<span aria-hidden="true">`, so the reader says only the word ("Dogs", "adopted").
- **A label and its mark are one unit.** They stay on one line (`whitespace-nowrap`). If they don't fit, the whole chip or badge moves to the next line. A mark is never split, never cropped, never hidden on mobile, and never reduced to the word only.
- **Size the mark to its box.** A mark that doesn't fit gets a smaller size, not a line break: publish modal `text-2xl`, Browse cards `text-5xl`, 48px thumbnails `text-[11px]`.
- **Bold marks** use `font-black` plus a stroke: `[-webkit-text-stroke:1.5px_currentColor]`. For an `EmptyState`, pass `className="[&>span]:font-black [&>span]:[-webkit-text-stroke:1.5px_currentColor]"`. Stroke is 1.5px everywhere.
- **Inline-flex eats spaces.** Inside `Chip` or `Badge`, use `ml-1` on the mark's span instead of a space.
- **Display fonts may lack a glyph** (`№`, `･ﾟ`): the browser falls back to another font and the size changes. Check in the browser; `N°` works where `№` doesn't.
- **Wide gaps need non-breaking spaces** (`\x{A0}`): HTML collapses normal spaces.
- **`EmptyState.emoji` accepts a ReactNode**, so a mark can have styled parts (different stroke per piece).

---

## Adding or replacing a mark

1. Pick the kaomoji from this dictionary, or add a new row here first.
2. One replacement per commit. The commit message keeps the original emoji with an arrow, for example `style(ui): adopted 🎉 → (︶ᴥ₍^◒◒^₎･ﾟ✧)`, so `git log --oneline --grep="→"` lists every replacement.
3. Check in the browser, including 360px width (DevTools device mode).

Writing symbols with `perl`: always use codes, never raw symbols (without `use utf8` raw symbols turn into broken bytes like `á´¥`).

```bash
perl -CSD -pi -e 's/\x{1F50D}/\x{2387}(\x{25D4} _\x{25D1})/g' path/to/file.tsx
```

| Glyph | Code | Glyph | Code | Glyph | Code |
|---|---|---|---|---|---|
| ᴥ | `\x{1D25}` | ・ | `\x{30FB}` | ◗ | `\x{25D7}` |
| ︶ | `\x{FE36}` | ･ | `\x{FF65}` | ﾟ | `\x{FF9F}` |
| ✧ | `\x{2727}` | ｡ | `\x{FF61}` | ✓ | `\x{2713}` |
| ≧ | `\x{2267}` | ◒ | `\x{25D2}` | ≦ | `\x{2266}` |
| ┐ | `\x{2510}` | ┌ | `\x{250C}` | ▼ | `\x{25BC}` |
| ⎇ | `\x{2387}` | ◔ | `\x{25D4}` | ◑ | `\x{25D1}` |
| ◕ | `\x{25D5}` | ʕ | `\x{0295}` | • | `\x{2022}` |
| ╰ | `\x{2570}` | ╮ | `\x{256E}` | ● | `\x{25CF}` |
| ᐢ | `\x{1422}` | ◣ | `\x{25E3}` | ◥ | `\x{25E5}` |
| ₍ | `\x{208D}` | ₎ | `\x{208E}` | ≡ | `\x{2261}` |
| ✂ | `\x{2702}` | ° | `\x{00B0}` | non-breaking space | `\x{A0}` |

---

## Check after every pull

New emoji can arrive from any branch. This lists every colored emoji left in the frontend (empty output = clean):

```bash
cd frontend
grep -rn -P '[\x{1F000}-\x{1FAFF}\x{2600}-\x{26FF}]' src/ | grep -v '★'
```

---

See also: note 310 (design system conventions), note 311 (component ownership), frontend/README.md (Kaomoji instead of emoji).
