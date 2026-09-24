# Pawfect Match — Requirements Specification

> Peer-to-peer pet adoption platform (dogs & cats). This document specifies, interface by interface and feature by feature, what the product must contain and how it must behave. It reflects the validated prototype (https://proto-pet-adoption.vercel.app) and serves as the reference for the real implementation.

**Roles.** Every registered user can act in both roles at any time:
- **Owner** — publishes pets for adoption and manages their adoption processes.
- **Adopter** — browses pets, contacts owners, and follows their adoption processes.

---

## 1. Interfaces

### 1.1 Authentication (`?view=auth`)

| # | Requirement |
|---|-------------|
| UI-1.1 | Two modes in one screen, switchable via tabs: **Sign in** and **Create account**. |
| UI-1.2 | Sign in fields: email, password. Create account adds: full name. |
| UI-1.3 | Email must be validated client-side (format) with an inline error message under the field. |
| UI-1.4 | Successful authentication redirects to Browse and greets the user with an info notification. |
| UI-1.5 | Unauthenticated users cannot reach any other view; `?view=auth` always starts logged out. |

### 1.2 App Shell (persistent)

| # | Requirement |
|---|-------------|
| UI-2.1 | Desktop: fixed left sidebar with logo and navigation in this order: Browse, Adoptions, Rehome, Friends, Analytics, Design kit. Mobile: bottom navigation bar (first five items). |
| UI-2.2 | Top bar with notification bell showing the **unread count** badge. |
| UI-2.3 | Sidebar footer shows the current user (avatar with online dot, name, handle), links to own profile, and offers sign out. |
| UI-2.4 | Every view except Browse displays a **Back** button that returns to the previously visited view (in-app history), falling back to Browse. |
| UI-2.5 | Every view is deep-linkable via `?view=` query param (`browse`, `pet&id=…`, `rehome`, `adoptions`, `friends`, `profile`, `notifications`, `analytics`, `design`, `auth`). |

### 1.3 Browse (home, `?view=browse`)

| # | Requirement |
|---|-------------|
| UI-3.1 | Grid of pet cards, 6 per page, newest first. Includes all published pets: other users' and the current user's (badged "your listing"). |
| UI-3.2 | Card content: photo (or species emoji tile), name, city, breed, age, sex, up to 2 traits, publisher's first name. Adopted pets show an "adopted" badge. |
| UI-3.3 | Free-text search matching name, breed, and traits (case-insensitive, live). |
| UI-3.4 | Filters (collapsible): species chips (All / Dogs / Cats), size select (Any / Small / Medium / Large), city select from the fixed city list (see FN-3). No sort control — order is fixed (newest first). |
| UI-3.5 | Any filter change resets pagination to page 1. Result count is always visible. |
| UI-3.6 | Empty state when no results, with a one-click "clear filters" action. |
| UI-3.7 | Quick access button "Rehome a pet" leading to the Rehome view. |
| UI-3.8 | Clicking a card opens that pet's page. |

### 1.4 Pet Page (`?view=pet&id=…`)

**Common (all users)**

| # | Requirement |
|---|-------------|
| UI-4.1 | Portrait (uploaded photo or species emoji on a colored tile) with a city pill. |
| UI-4.2 | Data block: name, breed, age, sex, size, story, trait badges, health badges (vaccinated, neutered). |
| UI-4.3 | If the pet is adopted: an "adopted by {first name}" badge next to the title. |

**Adopter view (someone else's pet)**

| # | Requirement |
|---|-------------|
| UI-4.4 | Owner card (avatar with online status, name) linking to the owner's profile. |
| UI-4.5 | A **Start adoption** button opens the chat with the owner. The chat is hidden until pressed — unless a conversation about this pet already exists, in which case the thread shows directly. No button when the pet is already adopted. |
| UI-4.6 | The chat header shows the current **adoption stage** as a read-only badge (see FN-6). |

**Owner view (own pet)**

| # | Requirement |
|---|-------------|
| UI-4.7 | "Your listing" badge, listing date, and a **Remove listing** action (deletes the pet and its conversations, then returns to Rehome). |
| UI-4.8 | **Adoption inquiries** section: list of every person who wrote about this pet (avatar, online status, name, last message preview with 📎 marker when it has attachments). Selecting one opens their thread. Empty state when nobody has written yet. |
| UI-4.9 | The thread header contains the **stage selector**: four options — in conversation, visit scheduled, final decision, denied — plus **adopted**. Selecting one applies immediately, without sending any message (see FN-6). Once adopted, the selector collapses to a static "adopted by {name}" badge. |
| UI-4.10 | Reply composer with attachments, identical to the adopter's (see FN-5). |

### 1.5 Rehome (`?view=rehome`)

| # | Requirement |
|---|-------------|
| UI-5.1 | Header with title "Your listings" and a primary **Rehome a pet** button that opens the publish form in a **modal** (the form is never permanently open in the page). |
| UI-5.2 | Listings table: one row per own pet — photo/emoji, name, breed, listing date, inquiry-count badge (or "adopted" badge), and actions **View & reply** and **Remove**. Empty state invites publishing the first pet. |
| UI-5.3 | Publish modal fields: photo (optional), name*, species* (Dog/Cat), breed*, age (years)*, size*, sex*, city* (select from fixed list), story*, traits (comma separated, max 4), vaccinated toggle, neutered toggle. |
| UI-5.4 | Photo upload: image types only, max 5 MB, live preview, removable before submitting. Invalid files are rejected with a notification and never attached. |
| UI-5.5 | Validation on submit with inline per-field errors: name ≥ 2 chars, breed ≥ 2 chars, story ≥ 20 chars, age numeric 0–40. |
| UI-5.6 | On publish: the modal closes, the pet appears immediately in the listings table and in Browse for every user, a "created" notification fires, and the user lands on the new pet's page. |

### 1.6 Adoptions (`?view=adoptions`)

| # | Requirement |
|---|-------------|
| UI-6.1 | Table of pets the current user has started an adoption chat about (other users' pets only) — same layout language as the Rehome table. |
| UI-6.2 | Row content: pet photo/emoji, name, last message preview (with 📎 marker), owner (avatar + online status + name), status badge, and an **Open** action. |
| UI-6.3 | The status badge mirrors the stage the owner set: in conversation / visit scheduled / final decision / denied, or "adopted by you 🎉" / "already adopted". |
| UI-6.4 | Opening a row navigates to the pet's page (no separate chat interface). |
| UI-6.5 | Empty state pointing the user to Browse. |

### 1.7 Friends (`?view=friends`)

| # | Requirement |
|---|-------------|
| UI-7.1 | Two tabs with counters: **My friends** and **Discover** (users who are not friends yet). |
| UI-7.2 | User card: avatar with online status, name, handle, online/offline text, city, bio (max 2 lines), and actions: View profile + Remove (friends) or Add friend (discover). |
| UI-7.3 | Adding/removing a friend applies instantly and emits a create/delete notification. |
| UI-7.4 | Empty states for both tabs. |

### 1.8 Profile (`?view=profile`)

**Own profile**

| # | Requirement |
|---|-------------|
| UI-8.1 | Avatar with camera button to upload a new one (image only, max 2 MB, rejected with a notification otherwise) and a Remove avatar action; without a photo, a default initials avatar is shown. |
| UI-8.2 | Editable fields: display name, city, bio. Save is disabled until something changes and name has ≥ 2 chars. Saving emits an "updated" notification. |

**Another user's profile**

| # | Requirement |
|---|-------------|
| UI-8.3 | Read-only info: avatar with online status, name, handle, city badge, bio. Only data the profile actually has — no roles or job titles. |
| UI-8.4 | Friend action: Add friend / Remove friend depending on current state. |
| UI-8.5 | **Pets they are rehoming** section listing that user's active listings; each links to the pet page (the entry point to start an adoption chat). Hidden if they have none. |

### 1.9 Notifications (`?view=notifications`)

| # | Requirement |
|---|-------------|
| UI-9.1 | Chronological list (newest first). Each item: kind icon (Created / Updated / Deleted / Info) with its color, title, body, kind label, and relative timestamp. |
| UI-9.2 | Unread items are visually distinct (highlight + dot). Actions: **Mark all read** (visible only with unread items) and **Clear all**. |
| UI-9.3 | Empty state when there are no notifications. |

### 1.10 Analytics (`?view=analytics`)

| # | Requirement |
|---|-------------|
| UI-10.1 | KPI row: listing visits, applications, adoptions, messages — each with period-over-period delta. |
| UI-10.2 | Charts: area (listing visits over time), pie (adoptions by species: dogs/cats), grouped bars (applications vs adoptions), line (community messages). All with tooltips and legends. |
| UI-10.3 | Date-range selector: last 7 / 30 / 90 days; all KPIs and charts react to it. |
| UI-10.4 | **Live** toggle streaming updates into the latest datapoint while enabled, with a visible "streaming" indicator. |
| UI-10.5 | Export actions: **CSV** (downloads the visible dataset) and **PDF** (print dialog); controls are excluded from the printed output. |

### 1.11 Design Kit (`?view=design`)

| # | Requirement |
|---|-------------|
| UI-11.1 | Living style guide showing the color palette, typography pairing, and every reusable component in its main states. |

---

## 2. Functionalities

### FN-1 Authentication & Session
- FN-1.1 Users sign in or create an account; the session gates the entire app.
- FN-1.2 Sign out returns to the auth screen.

### FN-2 User Profiles
- FN-2.1 Users can update name, city, and bio.
- FN-2.2 Users can upload/remove an avatar (image, ≤ 2 MB); a default initials avatar applies otherwise.
- FN-2.3 Profiles expose only: avatar, name, handle, city, bio, online status, and active listings.

### FN-3 Pet Listings (Rehome)
- FN-3.1 Any user can publish a pet with the full dataset of UI-5.3 and one optional photo (≤ 5 MB).
- FN-3.2 Species is restricted to **dog** and **cat**.
- FN-3.3 Pet city comes from the platform's fixed city list: Warszawa, Kraków, Łódź, Wrocław, Poznań, Gdańsk, Szczecin, Katowice, Lublin. The same list powers the Browse city filter.
- FN-3.4 Published pets are immediately visible to all users in Browse.
- FN-3.5 The owner can delete a listing at any time; its conversations are removed with it.

### FN-4 Search & Discovery
- FN-4.1 Text search over name, breed, and traits, combinable with species, size, and city filters.
- FN-4.2 Results are paginated (6 per page) and ordered newest-first.

### FN-5 Adoption Chat & File Sharing
- FN-5.1 All adoption communication is **per pet**: one thread per (pet, interested user) pair, living inside the pet's page.
- FN-5.2 The adopter initiates the thread via Start adoption; the owner answers from the pet's inquiries inbox.
- FN-5.3 Messages support text and **attachments**: images (PNG, JPG, WebP, GIF) and documents (PDF, TXT, MD, CSV, DOCX).
- FN-5.4 Attachment validation (client + server in the real build): allowed type and ≤ 5 MB; rejected files produce an explanatory notification and are not sent.
- FN-5.5 Before sending, staged attachments are listed with preview/name and can be removed individually.
- FN-5.6 In the thread, image attachments render as previews (openable full size) and documents as name + size chips.
- FN-5.7 Message metadata: sender alignment/color, timestamp.

### FN-6 Adoption Process (Stages)
- FN-6.1 Each inquiry thread has exactly one stage: `in conversation` (default) → `visit scheduled` → `final decision`, plus `denied` and `adopted` as terminal outcomes. Free movement between non-terminal stages.
- FN-6.2 Only the **owner** sets stages, from the chat header, without sending a message.
- FN-6.3 `adopted` marks the pet as adopted **by the person of that thread**; the pet then shows its adopted state everywhere (Browse card, pet page title, Rehome row, Adoptions row) and further stage changes and new Start adoption actions are disabled.
- FN-6.4 `denied` closes that inquiry negatively; the adopter sees it in their Adoptions row and thread badge.
- FN-6.5 Every stage change notifies both the actor (toast) and the notification center, naming pet, person, and new stage.

### FN-7 Friends & Presence
- FN-7.1 Users can add and remove friends; the friends list and the discover list update instantly.
- FN-7.2 Every user has an online/offline status shown on avatars across the app (list rows, chat headers, profiles) and updated in real time.

### FN-8 Notification System
- FN-8.1 Every create, update, and delete action in the system produces a notification: listing published/removed, inquiry received, stage changed, adoption completed, friend added/removed, profile updated, file rejected.
- FN-8.2 Each notification surfaces twice: a transient toast (auto-dismiss ≈ 4 s, max 3 stacked, manually dismissable) and a persistent entry in the notification center with read/unread state.
- FN-8.3 The unread count is always visible on the top-bar bell.

### FN-9 Analytics
- FN-9.1 The platform aggregates daily metrics (visits, applications, adoptions, messages) and species distribution.
- FN-9.2 Users can inspect them per date range (7/30/90 days), watch them update live, and export them (CSV, PDF) per UI-10.

### FN-10 Design System
- FN-10.1 All UI is composed from a single component library (17 components: Button, IconButton, Badge, Chip, Card, Avatar, Input, Textarea, Select, Tabs, Toggle, Progress, Pagination, EmptyState, Stat, Toast, Modal) with a defined palette (terracotta/cream/sage/honey), type pairing (Fraunces + Outfit), and icon set (Lucide).
- FN-10.2 New UI must reuse these components and tokens; the Design Kit view documents them.

### FN-11 Navigation
- FN-11.1 In-app back history: Back always returns to the previously visited state (view + pet/user context).
- FN-11.2 Deep links per UI-2.5 must restore the target view directly on load.
- FN-11.3 Responsive: sidebar navigation ≥ desktop, bottom bar on mobile; no functionality may be desktop-only.

---

## 3. Non-Functional Notes (for the real implementation)

- All client-side validations listed above must be mirrored server-side (file type/size, field lengths, permissions: only owners mutate their listings and stages).
- Uploaded files require secure storage with access control (only the two chat parties and the owner can access a thread's attachments).
- Presence, chat delivery, and analytics live-mode require a realtime channel (e.g. WebSocket).
- The prototype simulates: persistence, auth, server validation, realtime transport, and auto-replies.
