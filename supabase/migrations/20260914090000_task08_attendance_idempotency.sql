-- Task 08 — offline outbox needs every mutation kind to be safely replayable,
-- not just awards. `ledger` already has this (idempotency_key, Task 04);
-- `attendance` never got one because Task 06 only ever wrote it online,
-- once, per tap. A queued-then-flushed mutation can be resent (app crash
-- mid-flush, a retry after a timeout whose response never arrived) — without
-- a key to dedupe on, that becomes a duplicate append-only row instead of a
-- no-op. See docs/tasks/08-offline-sync.md: "replaying the whole outbox
-- twice produces no duplicate rows".
--
-- Nullable: Task 06's own direct taps don't need one (never replayed), but
-- every outbox-originated insert always supplies one.
alter table public.attendance
  add column idempotency_key text unique;
