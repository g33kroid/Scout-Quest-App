// docs/tasks/08-offline-sync.md: flush the outbox on app foreground, network
// regain, and a periodic timer while open — never the Background Sync API
// ("does not exist on iOS — never architect around it"). This module is the
// flush itself; callers wire up *when* to call flushOutbox (foreground/online
// event listeners, an interval) — none of that lives here so the flush logic
// stays testable without a real browser.

import {
  listPending,
  markFailed,
  queueDepth,
  removeMutation,
  scheduleRetry,
  type MutationKind,
  type QueuedMutation,
} from "./outbox";

export type SendResult = { ok: true } | { ok: false; status: number; error?: string };

// One sender per mutation kind — each just calls the matching server action
// (awardPointsAction, recordAttendanceAction, the future check-in action)
// and translates its result into { ok, status }. Kept as a map the caller
// supplies, rather than importing server actions directly here, so this
// module has zero dependency on Next.js server-action plumbing and can be
// unit-tested with plain mock functions.
export type Senders = Partial<
  Record<MutationKind, (payload: unknown) => Promise<SendResult>>
>;

export interface FlushSummary {
  sent: number;
  failed: number;
  remaining: number;
}

// Sequential, not Promise.all — flush order must match enqueue order, and
// a mutation later in the queue may depend on an earlier one having landed
// (docs: "50 queued mutations flush in order without duplication").
export async function flushOutbox(
  senders: Senders,
  now: number = Date.now(),
): Promise<FlushSummary> {
  const pending = await listPending(now);
  let sent = 0;
  let failed = 0;

  for (const mutation of pending) {
    const send = senders[mutation.kind];
    if (!send) {
      // No sender registered for this kind — leave it queued rather than
      // guessing; never silently drop a mutation.
      continue;
    }

    const result = await sendOne(send, mutation);
    if (result.ok) {
      await removeMutation(mutation.id);
      sent++;
    } else if (result.status === 403) {
      await markFailed(mutation.id, result.error ?? "Not authorized");
      failed++;
    } else {
      // 5xx, network error, timeout — retry with backoff, never drop
      // (docs: "a 500 from the server retries with backoff, does not drop").
      await scheduleRetry(
        mutation.id,
        mutation.attempts + 1,
        result.error ?? `HTTP ${result.status}`,
      );
    }
  }

  // Total still-queued pending mutations — including ones currently under
  // backoff, which listPending(now) would (correctly, for send purposes)
  // exclude. "Remaining" means "still in the outbox", not "eligible right now".
  return { sent, failed, remaining: await queueDepth() };
}

async function sendOne(
  send: (payload: unknown) => Promise<SendResult>,
  mutation: QueuedMutation,
): Promise<SendResult> {
  try {
    return await send(mutation.payload);
  } catch (err) {
    // A thrown network error (offline, timeout) is not a 4xx — treat it
    // exactly like a 5xx: retry, never drop.
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
