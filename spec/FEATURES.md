# Pawfect Match — Feature Documentation

> Pet adoption platform prototype. Peer-to-peer rehoming of **dogs and cats**: any user can list a pet, adopters reach out through per-pet chats, and the owner drives the adoption process to completion — all inside the pet's own page. No shelters, no fees, no distances. Frontend-only: all backend behavior (auth, storage, realtime) is simulated with realistic mock data.
>
> **Live:** https://proto-pet-adoption.vercel.app · **Branch:** `prototype/pet-adoption`

---

## 1. Authentication & User Management

- Sign in / create account screen (`?view=auth`). Any credentials work; email format is validated client-side.
- Editable own profile: display name, city, and bio, with a Save button that only enables on changes.
- Avatar upload with client-side validation (must be an image, max 2 MB). A default avatar (initials on a warm color) is generated when no photo is set. Avatar can be removed at any time.
- Sign out returns to the auth screen.

## 2. Browse & Advanced Search

- Home view listing every pet published on the platform, newest first — including pets other users just listed and your own (badged "your listing").
- Free-text search across name, breed, and traits.
- Filters: species (dogs / cats), size (small / medium / large), and city.
- City filter uses the platform's **fixed list of Polish cities** (Warszawa, Kraków, Łódź, Wrocław, Poznań, Gdańsk, Szczecin, Katowice, Lublin) — the same list used when publishing a pet, so filtering always matches.
- Pagination (6 pets per page) and a friendly empty state with a one-click "clear filters" action.
- Adopted pets remain visible with an "adopted 🎉" badge.

## 3. Rehome (Publish a Pet)

- "Your listings" table with a **Rehome a pet** button that opens the publish form in a modal.
- Full pet data form: name, species, breed, age, size, sex, city (fixed list), story, up to 4 traits, vaccinated / neutered toggles.
- Pet photo upload with validation (image type, max 5 MB) and live preview; a species emoji tile stands in when no photo is provided.
- Inline form validation with per-field error messages.
- Published pets appear instantly in Browse for everyone.
- Each listing row shows its inquiry count or adopted status, with quick actions to open the pet or remove the listing.

## 4. Pet Page & Adoption Chat

- Rich pet profile: photo/emoji portrait, city, breed, age, sex, size, story, traits, health badges (vaccinated / neutered), and the owner's card linking to their profile.
- **Start adoption** button (adopter side) opens the chat with the owner — the chat is not shown until the adopter decides to reach out, or a conversation already exists.
- Per-pet chat threads with **file attachments**: images and documents (PDF, TXT, MD, CSV, DOCX), client-side validated (type + 5 MB limit), staged with removable previews before sending, rendered as image previews or document chips inside message bubbles. Simulated auto-replies keep the conversation alive.
- **Owner inbox inside the pet page**: every person who wrote about the pet appears in a list; the owner reads each thread (attachments included) and replies right there.

## 5. Adoption Process (Stages)

- Each inquiry chat carries an **adoption stage**, set by the owner from the chat header **without sending a message**:
  1. `in conversation` (default)
  2. `visit scheduled`
  3. `final decision`
  4. `denied` — rejects that inquiry
  5. `adopted` — closes the adoption, recording **who** from the chats adopted the pet
- The adopter sees the current stage as a badge in the thread and in their Adoptions list, updating as the owner moves the process forward.
- Every stage change emits a notification.

## 6. Adoptions View

- Table of the pets **you reached out about** (someone else's listings), mirroring the Rehome table.
- Each row shows the pet, the latest message, the owner (with online status), and a status badge: current stage, "adopted by you 🎉", or "already adopted".
- Opening a row simply opens the pet page, where the conversation lives.

## 7. Friends & Profiles

- Friends list and a Discover tab to find other users; add / remove friends with one click.
- **Online status** on every avatar, drifting in simulated real time.
- Other users' profiles show their info, city, and the **pets they are rehoming** — the entry point to start an adoption chat about one of them.

## 8. Notification System

- Every create, update, and delete action notifies: listing published/removed, adoption inquiry received, stage changed, adoption completed, friend added/removed, profile updated, attachment/photo rejected, and more.
- Toast popups (auto-dismissing, stacked) plus a notification center with unread indicators, kind icons (Created / Updated / Deleted / Info), relative timestamps, mark-all-read and clear-all.
- Unread badge on the bell in the top bar.

## 9. Analytics Dashboard

- KPI stats (visits, applications, adoptions, messages) with period-over-period deltas.
- Interactive charts (Recharts): area chart of listing visits, grouped bar chart of applications vs. adoptions, pie chart of adoptions by species, line chart of community messages.
- **Live mode**: simulated real-time streaming that ticks the latest datapoint while enabled.
- Customizable date ranges (7 / 30 / 90 days).
- **Export**: CSV download of the visible dataset and print-to-PDF.

## 10. Design System (`?view=design`)

- 17 reusable components built for the app and showcased in a living style guide: Button, IconButton, Badge, Chip, Card, Avatar, Input, Textarea, Select, Tabs, Toggle, Progress, Pagination, EmptyState, Stat, Toast, Modal.
- Warm palette (terracotta / cream / sage / honey in OKLCH), Fraunces + Outfit type pairing, Lucide icon set, consistent radii and motion.

## 11. Platform / UX Foundations

- **Back button** on every view, backed by an in-app navigation history.
- **Deep links**: every view is addressable via `?view=` (`browse`, `pet&id=…`, `rehome`, `adoptions`, `friends`, `profile`, `notifications`, `analytics`, `design`, `auth`).
- Responsive layout: sidebar navigation on desktop, bottom navigation bar on mobile.
- Simulated realtime: presence changes, chat auto-replies, and live analytics.

---

## Out of Scope (mocked by design)

Server-side validation and storage, real authentication, persistence across reloads, and real-time transport are intentionally simulated — this is a frontend prototype meant to validate flows and UI.
