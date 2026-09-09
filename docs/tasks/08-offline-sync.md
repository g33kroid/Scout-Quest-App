# Task 08 — Offline queue and sync

## Scope

Everything a leader does in the field must work with no signal and reconcile
exactly once on reconnect.

## Architecture

- Service worker (Serwist or hand-rolled per HLD choice) caches the app shell,
  the leader's roster, and quest metadata.
- **Dexie.js (IndexedDB)** holds an outbox of pending mutations: awards,
  check-ins, attendance, excuses.
- Each queued mutation carries a client-generated **idempotency key** (uuidv7)
  written at creation time, not at send time.
- Flush on: app foreground, network regain, and a periodic timer while open.
- **The Background Sync API does not exist on iOS** — never architect around it.
  Flush on foreground via a fetch handler.
- Conflict policy: server is authoritative for reads; the outbox is authoritative
  for unsent writes. Never silently drop a queued mutation.

## Rules

- A queued mutation must survive app close, phone restart, and PWA relaunch.
- Storage eviction can wipe IndexedDB — flush promptly and never treat the device
  as the only copy.
- Surface queue depth in the leader UI. A leader must be able to see "12 pending"
  and never wonder whether their work was lost.
- A permanently failing mutation surfaces for manual retry, never disappears.

## Test cases

- [ ] award while offline, reconnect → exactly one ledger row set
- [ ] award offline, force-quit app, reopen, reconnect → still exactly once
- [ ] 50 queued mutations flush in order without duplication
- [ ] replaying the whole outbox twice produces no duplicate rows
- [ ] a 500 from the server retries with backoff, does not drop
- [ ] a 403 (leader lost station assignment) surfaces to the user, does not retry forever
- [ ] queue depth indicator matches actual outbox length
- [ ] app shell loads with no network after first visit
- [ ] roster is readable offline
- [ ] simulated storage eviction shows a clear "reconnect to sync" state, no crash
- [ ] no code path uses `navigator.sync` / Background Sync

## Done when

All tests pass, and a manual field test — airplane mode, 20 awards, restart,
reconnect — produces exactly 20 awards.
