# CLAUDE.md

Loaded every session. Keep it short — the full spec lives in `docs/spec.md`.

## What this is

A real-world quest platform for a scout program in Dubai. ~180 scouts, ~20
leaders, all volunteers. Installed PWA on mixed Android/iOS. Zero budget.

**The kids do not play on their phones.** The phone is a HUD: it issues quests,
shows points, attendance, standings. The quest itself is physical — show up, do
the thing, a leader awards points from _their_ device. Never build a flow that
requires a scout to hold a phone mid-activity.

## Success metric

% of scouts attending 8+ of 12 weekly classes vs last season. Argue every feature
against that number.

## Before you write code

1. Read `docs/spec.md` — its NON-NEGOTIABLE DESIGN RULES override everything.
2. Read `docs/tasks/00b-cross-cutting-ui.md` for any task that renders UI.
3. Read the specific task file in `docs/tasks/`.
4. Check `docs/open-decisions.md` — do not invent an answer to anything listed
   there. Ask.

## Rules that are never negotiable

- **Append-only ledger.** No `total_points` column, ever. Totals are a `SUM`.
- **Ledger writes only through `SECURITY DEFINER` functions.** No direct table
  writes from any role.
- **Fixed point tiers** (10/25/50/100). No free-text point entry in any UI.
- **RLS is the authorisation boundary.** Every table default-deny. App-layer
  checks are convenience, never security.
- **Nothing is mandatory.** Prerequisite gating only. No `mandatory` flag exists.
- **No automatic visible point deduction** for a no-show. Log silently, surface to
  the leader after the second occurrence, never notify the scout.
- **Scout home screen is personal progression.** Leaderboards one tap away, never
  the landing view.
- **No chat, no messaging, no scout-to-scout visibility.** Ever.
- **Bilingual EN/AR.** Translate at author time, never at render time. Publishing
  requires both locales.
- **The 15-second rule.** A leader scores a full class in under 15 seconds from
  cold open, no navigation, no search, works offline. This is the screen that
  decides whether the project survives.
- **No real data in this repo.** It is public. Invented names and numbers only.
- **No scout, parent, or leader named in any issue, commit, or PR.**

## Workflow

- Branch per task, PR to `main`, never push to `main`.
- Every task ships with its tests. No passing tests, not done.
- Run `/ponytail-review` on the diff before requesting merge. It reviews the
  _solution_, never the requirements — it must not be used to argue away a rule
  above.
- Ambiguity goes in the PR description as an open question. Do not invent a
  decision.
- If you think a requirement is wrong, say so in the PR, then implement it as
  written unless told otherwise.

## Stack

Next.js App Router (TS, strict) + Tailwind + self-hosted Supabase (Postgres,
Auth, Storage, Realtime) on a VPS via Docker Compose, behind a Cloudflare
Tunnel. Local dev also runs the Supabase stack via Docker (`supabase start`).
Everything hand-built except the avatar (`react-avatar-studio` /
`react-nice-avatar`, stored as JSONB config, never an image).

## Data sensitivity

This holds records of minors plus parent contact details, under UAE PDPL.
Parent contacts live in their own table with their own policy and an audit row on
every read. There is no medical data column in Wave 1 — see open decisions.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
