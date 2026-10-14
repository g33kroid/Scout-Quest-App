# Scout Quest

A real-world quest platform for scout programs. Built for a Coptic Orthodox scout
program in Dubai, and free for any other church or group to run for themselves.

The kids are **not** playing on their phones. They play in real life — at weekly
classes and camps. The phone is just a HUD: it issues quests, shows points,
attendance, and standings. The activity itself is physical: show up, do the thing,
a leader awards the points from _their_ device. No scout ever has to hold a phone
mid-activity, and a scout with a dead or absent phone can still play everything and
see it all afterwards.

It replaces the attendance spreadsheets and the "who did what" guesswork with one
small app that keeps score. Zero budget, built to self-host, no app stores.

---

## Status

**Wave 1 — pilot.** The weekly-class experience is built and under test with real
leaders. Measured against one number: the share of scouts attending 8+ of 12
weekly classes versus last season. Everything is argued against that metric.

---

## What it does today (Wave 1)

**For scouts**

- A personal home screen — your streak, your points, your patrol's contribution.
  Progression first; leaderboards are one tap away, never the landing view.
- A quest board with prerequisite gating — finish one thing to unlock the next.
- A permanent journal of everything you've earned.
- A build-your-own avatar (no photos, just a customised character).
- Works offline. English and Arabic throughout, right-to-left included.

**For leaders**

- **Score a whole class in under 15 seconds** — cold open, no search, no
  navigation, works offline. This is the screen the whole project lives or dies on.
- Fixed point tiers (10 / 25 / 50 / 100) — no free-text scoring, no arguments.
- QR check-in and attendance, including excused absences.
- Quest authoring, published in both languages.
- Patrol and unit standings built from the ledger, not a spreadsheet.

**Under the hood**

- Every point is an **append-only ledger** entry — totals are always a live sum,
  never a column someone can edit. Nothing is silently deducted in front of a kid.
- **Row-level security is the authorisation boundary** — every table is
  default-deny; a scout can only ever see their own unit's content.
- Bilingual by construction: content is translated when it's written, never
  machine-translated at display time. You can't publish something in one language
  only.

---

## Coming soon

**Landing shortly (finishing Wave 1)**

- **Materials** — a leader attaches documents and links to a quest or session;
  scouts in that unit open them. Private storage, signed short-lived links, no
  public URLs.
- **Device binding + login lockout** — a second lock beyond the PIN, so a
  nickname can't be guessed into.
- **Seed template library + admin tools** — 30–40 ready-made bilingual activities
  to clone and adjust, plus season setup, join codes, PIN resets, and the ability
  to export or fully delete a scout's record on request.

**Wave 2** — three-layer leaderboards, badges and streaks, a scout notebook,
equipment inventory, post-event reviews, leader meetings.

**Wave 3** — a camp designer, mixed-age camp teams, conflicting activity blocks,
specialisations, and (once a safeguarding policy is in place) photo galleries.

---

## Tech stack

- **Next.js** (App Router, TypeScript) + **Tailwind** — installable PWA, no app
  stores.
- **Self-hosted Supabase** (Docker: Postgres, Auth, Storage, Realtime) on a cheap
  VPS, reached through a **Cloudflare Tunnel**. No managed-service bill.
- Everything hand-built except the avatar.

A church can run the whole thing on one small server for the cost of the VPS.

---

## Build it yourself

You need: **Node 20+**, **Docker** (Docker Desktop, or Colima on macOS), the
**Supabase CLI**, and **git**.

```bash
# 1. Clone
git clone https://github.com/g33kroid/Scout-Quest-App.git
cd Scout-Quest-App

# 2. Install dependencies
npm install

# 3. Start the local Supabase stack (Postgres + Auth + Storage + Realtime)
npx supabase start

# 4. Apply the database migrations
npm run db:migrate

# 5. (optional) seed demo fixtures for local testing
npm run seed:e2e

# 6. Run the app
npm run dev
```

Open http://localhost:3000.

**Common scripts**

| Command                              | What it does                  |
| ------------------------------------ | ----------------------------- |
| `npm run dev`                        | Run the app locally           |
| `npm run build` / `npm run start`    | Production build / serve      |
| `npm run test`                       | Unit tests (Vitest)           |
| `npm run test:e2e`                   | End-to-end tests (Playwright) |
| `npm run db:migrate`                 | Apply migrations              |
| `npm run db:reset`                   | Reset the local database      |
| `npm run db:test`                    | Database policy tests (pgTAP) |
| `npm run typecheck` / `npm run lint` | Type-check / lint             |

For production deployment, backups, and day-to-day operations, see
[`docs/runbook.md`](docs/runbook.md). The full specification is in
[`docs/spec.md`](docs/spec.md).

---

## Data & privacy — read before you run it for real

This app holds records of **minors** and their parents' contact details. If you
deploy it for your own group, you take on that responsibility.

- It is designed around **UAE PDPL**; check your own jurisdiction's rules.
- Parent contacts live in their own table with their own policy and an audit row
  on every read.
- Export-a-scout and delete-a-scout (a real, hard delete, including stored files)
  are obligations, not features — don't go live without them.
- No chat, no messaging, no scout-to-scout visibility. Ever.
- **Never commit real data.** This repository is public. No real names, phone
  numbers, or join codes — not in seeds, fixtures, tests, issues, or commits.

Before the first real scout record exists, work through the go-live checklist in
[`docs/START-HERE.md`](docs/START-HERE.md) (breach procedure, consent form,
backup restore actually performed, safeguarding lead named, a second maintainer).

---

## Contributing

A volunteer project for a youth organisation. Please read `CLAUDE.md` and
`docs/spec.md` before opening a PR. Branch per change, PR to `main`, tests ship
with the code.

If you're another church or group thinking of running this — you're welcome to.
Open an issue with questions.

## Licence

MIT.
