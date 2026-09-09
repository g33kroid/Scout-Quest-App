# Scout Quest

An open-world quest platform for scout programs — built for a scout group in
Dubai, and free for any other group to use.

Scouts get a quest board, a permanent journal, and points. Leaders get attendance,
scoring, and the analytics that used to live in a spreadsheet. Everything happens
in real life; the app just keeps score.

## Status

In development. Wave 1 targets weekly classes; camps come later.

## Features

**Wave 1** — units and patrols, leader scoring, QR check-in, attendance with
excused absences, quest board with prerequisites, permanent journal, English and
Arabic throughout, works offline.

**Wave 2** — three-layer leaderboards, badges and streaks, scout notebook,
equipment inventory, post-event reviews, leader meetings.

**Wave 3** — camp designer, mixed-age camp teams, conflicting activity blocks,
specialisations, photo galleries.

## Stack

Next.js (App Router) · self-hosted Supabase (Docker, Postgres/Auth/Storage/
Realtime) behind a Cloudflare Tunnel · PWA, no app stores.

## Running locally

See `docs/runbook.md`.

## Contributing

This is a volunteer project for a youth organisation. Please read `CLAUDE.md` and
`docs/spec.md` before opening a PR.

**Never commit real data.** No real names, phone numbers, or join codes — not in
seeds, fixtures, tests, or issues.

## Licence

MIT.
