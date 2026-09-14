// docs/tasks/08-offline-sync.md: Dexie.js (IndexedDB) holds the outbox of
// pending mutations — awards, check-ins, attendance, excuses. Runs entirely
// client-side (leader's device); nothing here talks to the network. That's
// sync.ts's job, kept separate so the queue itself stays trivially testable.

import Dexie, { type Table } from "dexie";

export type MutationKind = "award" | "checkin" | "attendance" | "excuse";
export type MutationStatus = "pending" | "failed";

export interface QueuedMutation {
  // Dexie's own auto-increment primary key — used purely for stable flush
  // ordering. `Date.now()` alone ties whenever two mutations enqueue in the
  // same millisecond (easily happens: a leader batch-recording several
  // scouts), and Dexie's sortBy is not guaranteed stable across ties.
  seq?: number;
  // The idempotency key itself (uuidv7-shaped, but any unique client-generated
  // string works) — written once at enqueue time, per docs/tasks/08-offline-sync.md:
  // "carries a client-generated idempotency key written at creation time, not
  // at send time." Every retry of this mutation reuses this same id.
  id: string;
  kind: MutationKind;
  payload: unknown;
  status: MutationStatus;
  attempts: number;
  createdAt: number;
  // Backoff gate: a mutation is only eligible to (re)send once now() reaches
  // this. Set to createdAt on first enqueue, pushed forward on each retry.
  nextAttemptAt: number;
  lastError?: string;
}

class OutboxDB extends Dexie {
  mutations!: Table<QueuedMutation, number>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      // seq (auto-increment) is the real primary key and sort order; id is
      // a unique secondary index — every lookup/update/delete by mutation
      // id goes through it, never through seq directly.
      mutations: "++seq, &id, status, createdAt",
    });
  }
}

const DB_NAME = "scout-quest-outbox";
let db: OutboxDB | null = null;

function getDb(): OutboxDB {
  if (!db) db = new OutboxDB(DB_NAME);
  return db;
}

export async function enqueueMutation(
  kind: MutationKind,
  payload: unknown,
  id: string = crypto.randomUUID(),
): Promise<QueuedMutation> {
  const now = Date.now();
  const mutation: QueuedMutation = {
    id,
    kind,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: now,
    nextAttemptAt: now,
  };
  await getDb().mutations.add(mutation);
  return mutation;
}

// Oldest first (by seq, the auto-increment insert order — see the schema
// comment on why not createdAt) — flush order must match enqueue order
// (docs: "50 queued mutations flush in order"). `now` is a parameter, not
// `Date.now()` read inline, so backoff timing is deterministically testable.
export async function listPending(now: number = Date.now()): Promise<QueuedMutation[]> {
  const all = await getDb().mutations.where("status").equals("pending").sortBy("seq");
  return all.filter((m) => m.nextAttemptAt <= now);
}

export async function listFailed(): Promise<QueuedMutation[]> {
  return getDb().mutations.where("status").equals("failed").sortBy("seq");
}

// The number a leader sees as "N pending" — always the true outbox length
// (every still-queued mutation, backoff-delayed or not), never a
// separately maintained counter that can drift from it.
export async function queueDepth(): Promise<number> {
  return getDb().mutations.where("status").equals("pending").count();
}

export async function removeMutation(id: string): Promise<void> {
  await getDb().mutations.where("id").equals(id).delete();
}

// Capped exponential backoff: 1s, 2s, 4s, 8s, 16s, then holds at 30s. A
// permanently offline leader still gets a fast retry once signal returns —
// this only throttles bursts against a server that's actually erroring.
export function backoffMs(attempts: number): number {
  return Math.min(30_000, 1000 * 2 ** attempts);
}

export async function scheduleRetry(
  id: string,
  attempts: number,
  error: string,
): Promise<void> {
  await getDb()
    .mutations.where("id")
    .equals(id)
    .modify({
      attempts,
      nextAttemptAt: Date.now() + backoffMs(attempts),
      lastError: error,
    });
}

// A 403 (station reassigned, session ended) is never going to succeed by
// retrying — stop, but never delete. The mutation stays visible via
// listFailed() until a human resolves it (docs: "surfaces for manual
// retry, never disappears").
export async function markFailed(id: string, error: string): Promise<void> {
  await getDb()
    .mutations.where("id")
    .equals(id)
    .modify({ status: "failed", lastError: error });
}

export async function retryFailed(id: string): Promise<void> {
  await getDb().mutations.where("id").equals(id).modify({
    status: "pending",
    attempts: 0,
    nextAttemptAt: Date.now(),
    lastError: undefined,
  });
}

// Test-only: a fresh Dexie instance backed by a freshly deleted IndexedDB
// database, so tests don't leak mutations into each other.
export async function _resetOutboxForTests(): Promise<void> {
  if (db) {
    db.close();
    await db.delete();
  }
  db = null;
}
