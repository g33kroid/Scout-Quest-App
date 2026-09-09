# Scout Quest — Two High-Level Designs

Option A: build everything.
Option B: assemble from pre-built components and add on top.

Scope for both is the reduced Wave 1: units, patrols, roster attendance, roster
scoring, quest board with prerequisites, journal, bilingual content.

---

## The part that is identical in both

This matters more than the comparison itself. **The backend does not change between
the two options.** There is no pre-built package for units, patrols, camps, blocks,
stations, or a scout points ledger, because that model is specific to how this
program runs.

Identical in A and B:

- Postgres schema: `people`, `units`, `unit_enrollments`, `patrols`,
  `patrol_memberships`, `leaders`, `quests`, `quest_translations`,
  `quest_prerequisites`, `ledger`, `attendance`, `audit_log`
- Append-only ledger; totals are always a `SUM`, never a stored column
- Row-level security as the only real authorisation boundary
- `SECURITY DEFINER` functions for all ledger writes
- Auth model: join code + nickname + 6-digit PIN for scouts, email + TOTP for
  leaders
- Supabase (Postgres, auth, storage) + Next.js + Vercel
- Bilingual content model with author-time LLM translation

**So the real decision is only about the presentation layer.** That is roughly 60%
of Wave 1 hours, and it is where the entire difference lies.

---

## Option A — Build everything

### Architecture

```
Next.js App Router (PWA)
├── Hand-rolled UI primitives (buttons, sheets, lists, dialogs)
├── Hand-rolled avatar builder (SVG layer compositor + picker UI)
├── Hand-rolled note editor (contenteditable + markdown serialiser)
├── Hand-rolled i18n (locale context, message loader, RTL handling)
├── Hand-rolled service worker (cache strategies, offline queue)
├── Hand-rolled pan/zoom quest board
└── Supabase client → Postgres + RLS
```

### What you actually write

| Piece                                             | Effort   |
| ------------------------------------------------- | -------- |
| Schema, RLS, pgTAP tests                          | 8h       |
| Auth flows (scout + leader)                       | 6h       |
| UI primitives from scratch                        | 12h      |
| Avatar builder (asset sourcing, layering, picker) | 14h      |
| i18n + RTL from scratch                           | 8h       |
| Quest board + pan/zoom                            | 8h       |
| Journal                                           | 5h       |
| Leader scoring flow                               | 10h      |
| Attendance                                        | 4h       |
| Service worker + caching                          | 6h       |
| Bilingual authoring + translate call              | 6h       |
| **Total**                                         | **~87h** |

### Honest assessment

**In favour:** no third-party licences to audit, no dependency drift, no library
abandonment risk, a smaller bundle, and total control over every pixel. For a
security engineer maintaining something alone for years, a small dependency tree
has real long-term value.

**Against:** the avatar builder alone is two weeks of evenings and will be worse
than react-nice-avatar. The RTL and i18n work is fiddly and thoroughly solved
elsewhere. You will rebuild bugs that other people already fixed. At 8h/week this
lands mid-November, which misses the October pilot — and the pilot is the thing
that de-risks the entire project.

---

## Option B — Assemble and add on top

### Architecture

```
Next.js App Router (PWA)
├── shadcn/ui              → UI primitives (copied in, you own the code)
├── react-avatar-studio    → avatar builder UI
│   └── react-nice-avatar  → avatar rendering
│   └── DiceBear           → fallback / default avatars
├── next-intl              → i18n + RTL
├── Serwist                → service worker / PWA
├── react-zoom-pan-pinch   → quest board
├── Dexie.js               → offline queue (Wave 3)
├── BlockNote              → notebook editor (Wave 2)
├── Excalidraw             → sketch canvas (Wave 2)
├── Recharts               → analytics (Wave 2)
└── Supabase client → Postgres + RLS
```

### What you actually write

| Piece                                    | Effort   |
| ---------------------------------------- | -------- |
| Schema, RLS, pgTAP tests                 | 8h       |
| Auth flows (scout + leader)              | 6h       |
| UI assembly with shadcn                  | 4h       |
| Avatar screen (wire up + persist config) | 3h       |
| i18n + RTL config and message files      | 3h       |
| Quest board (lib + your layout)          | 5h       |
| Journal                                  | 5h       |
| **Leader scoring flow (hand-built)**     | 10h      |
| Attendance                               | 4h       |
| Serwist config                           | 2h       |
| Bilingual authoring + translate call     | 6h       |
| **Total**                                | **~56h** |

### Honest assessment

**In favour:** ~30 hours saved, which at 8h/week is nearly four weeks — the
difference between hitting the October pilot and missing it. The avatar builder in
particular goes from 14h to 3h and comes out better. shadcn is copied into your
repo rather than installed, so it is not really a dependency at all.

**Against:** eleven third-party packages to keep patched. Each one is a supply-chain
surface — a compromised npm package with a public Supabase anon key in the bundle
is a real scenario worth thinking about. BlockNote and Excalidraw are heavy;
Excalidraw in particular will noticeably grow the bundle for a feature only some
scouts use. If a library is abandoned, you inherit it.

---

## Comparison

|                       | A: Build everything | B: Assemble          |
| --------------------- | ------------------- | -------------------- |
| Wave 1 hours          | ~87h                | ~56h                 |
| Calendar at 8h/week   | ~11 weeks           | ~7 weeks             |
| Hits October pilot    | No                  | Yes                  |
| Dependencies          | ~3                  | ~11                  |
| Supply-chain surface  | Minimal             | Moderate             |
| Bundle size           | Smaller             | Larger               |
| Avatar quality        | Worse               | Better               |
| Long-term maintenance | Your bugs only      | Your bugs + upgrades |
| Bus factor            | Same (one)          | Same (one)           |

---

## Recommendation — B, with one deliberate exception

Take Option B, but **hand-build the leader scoring flow.** No library helps there,
and it is the one screen that decides whether this project survives past March. It
needs to be exactly the interaction your leaders need, tuned against a stopwatch,
with nothing generic in the way. Budget the full 10 hours and expect to rebuild it
once after the pilot.

Practical guardrails for taking the dependencies:

- **Lockfile committed, `npm ci` in CI, Dependabot on.** Non-negotiable with eleven
  packages.
- **Defer the heavy ones.** BlockNote and Excalidraw are Wave 2. Do not install
  them during Wave 1 just because they are on the list.
- **Prefer copied-in over installed** where the option exists — shadcn's model means
  that code is yours and cannot be pulled out from under you.
- **Check licence before install, not after.** Excalidraw over tldraw for exactly
  this reason.
- **A build-time gate that fails CI if the service-role key appears in the client
  bundle.** More important with a large dependency tree, not less.

The 30 hours saved are not really about effort. They are about reaching a real
October pilot with real leaders and real scouts, while there is still time to act
on what it teaches you.

---

# Option C — Chosen: build everything except the avatar

The decision is to hand-build the application and take only the avatar builder
off the shelf.

### Architecture

```
Next.js App Router (PWA)
├── react-avatar-studio    → avatar builder UI      [pre-built]
│   └── react-nice-avatar  → avatar rendering       [pre-built]
├── Hand-rolled UI primitives
├── Hand-rolled i18n + RTL
├── Hand-rolled service worker
├── Hand-rolled pan/zoom quest board
├── Hand-rolled journal, board, scoring, attendance
└── Supabase client → Postgres + RLS
```

### Effort

| Piece                                    | Effort   |
| ---------------------------------------- | -------- |
| Schema, RLS, pgTAP tests                 | 8h       |
| Auth flows (scout + leader)              | 6h       |
| UI primitives from scratch               | 12h      |
| **Avatar builder (pre-built, wired up)** | **3h**   |
| i18n + RTL from scratch                  | 8h       |
| Quest board + pan/zoom                   | 8h       |
| Journal                                  | 5h       |
| Leader scoring flow                      | 10h      |
| Attendance                               | 4h       |
| Service worker + caching                 | 6h       |
| Bilingual authoring + translate call     | 6h       |
| **Total**                                | **~76h** |

At 8h/week that is roughly **9–10 weeks**, landing early-to-mid November. The
October pilot slips by a few weeks unless the weekly hours go up.

### Avatar integration notes

- Store the `AvatarFullConfig` object as JSONB on the person record, not a rendered
  image. No uploads, no image storage, no moderation surface — which is exactly
  what you want for a system holding children's records.
- `genConfig` seeded from the scout's join token gives every kid a sensible default
  before they customise anything.
- Render server-side for leader rosters so 30 avatars in a list stay cheap.
- Pin the version. Vendor the package into the repo if you want zero drift.

### Three worth reconsidering later

These are not product surfaces, and hand-rolling them costs hours without making
the app any more yours:

- **next-intl** (~6h saved). RTL plus bidi handling for mixed Arabic and Latin
  strings is fiddly, and getting it subtly wrong is very visible to Arabic-reading
  scouts.
- **Serwist** (~4h saved). Service worker cache invalidation is a classic source of
  bugs where users get a stale app and no clear way to recover.
- **shadcn/ui** (~8h saved). Not actually a dependency — the components are copied
  into the repo and become your code, so taking it does not conflict with building
  everything yourself.

Taking those three alongside the avatar would bring the total to roughly **58h**
without giving up ownership of anything that matters. The board, journal, ledger,
scoring flow, and camp model stay hand-built either way.
