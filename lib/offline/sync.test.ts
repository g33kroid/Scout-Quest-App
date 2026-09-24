import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetOutboxForTests,
  enqueueMutation,
  listFailed,
  listPending,
  queueDepth,
} from "./outbox";
import { flushOutbox, type SendResult } from "./sync";

beforeEach(async () => {
  await _resetOutboxForTests();
});
afterEach(async () => {
  await _resetOutboxForTests();
});

const ok = async (): Promise<SendResult> => ({ ok: true });

describe("flushOutbox", () => {
  it("sends every pending mutation and empties the queue on success", async () => {
    await enqueueMutation("award", { n: 1 });
    await enqueueMutation("attendance", { n: 2 });

    const summary = await flushOutbox({ award: ok, attendance: ok });

    expect(summary).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(await queueDepth()).toBe(0);
  });

  it("50 queued mutations flush in order without duplication", async () => {
    for (let i = 0; i < 50; i++) {
      await enqueueMutation("award", { i });
    }

    const seenOrder: number[] = [];
    const summary = await flushOutbox({
      award: async (payload) => {
        seenOrder.push((payload as { i: number }).i);
        return { ok: true };
      },
    });

    expect(summary.sent).toBe(50);
    expect(seenOrder).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(new Set(seenOrder).size).toBe(50); // no duplicates
    expect(await queueDepth()).toBe(0);
  });

  it("replaying the whole outbox twice produces no duplicate server-side effects", async () => {
    // A fake server that dedupes by idempotency key, same as the real
    // ledger/attendance upsert-with-ignoreDuplicates path — this is what
    // makes a resent-but-already-applied mutation a no-op rather than a
    // duplicate row.
    const appliedKeys = new Set<string>();
    const effects: unknown[] = [];
    const idempotentSender = async (payload: unknown): Promise<SendResult> => {
      const key = (payload as { key: string }).key;
      if (!appliedKeys.has(key)) {
        appliedKeys.add(key);
        effects.push(payload);
      }
      return { ok: true };
    };

    const mutation = await enqueueMutation("award", { key: "batch-1:scout-1" });
    await flushOutbox({ award: idempotentSender });
    expect(await queueDepth()).toBe(0);

    // Simulate the outbox never having recorded the successful send (app
    // crashed before removeMutation committed) by re-enqueueing the exact
    // same mutation id and replaying.
    await enqueueMutation("award", { key: "batch-1:scout-1" }, mutation.id);
    await flushOutbox({ award: idempotentSender });

    expect(effects).toHaveLength(1);
  });

  it("a 500 retries with backoff and does not drop the mutation", async () => {
    await enqueueMutation("award", {});
    const failing = async (): Promise<SendResult> => ({ ok: false, status: 500 });

    const first = await flushOutbox({ award: failing });
    expect(first).toEqual({ sent: 0, failed: 0, remaining: 1 });

    // Immediately re-flushing does not resend — still inside the backoff
    // window.
    let sendCount = 0;
    const counting = async (): Promise<SendResult> => {
      sendCount++;
      return { ok: true };
    };
    await flushOutbox({ award: counting });
    expect(sendCount).toBe(0);

    // Once the backoff window has elapsed, the mutation is eligible again.
    const pending = await listPending(Date.now() + 5000);
    expect(pending).toHaveLength(1);
  });

  it("a 403 surfaces for manual retry and does not retry forever", async () => {
    await enqueueMutation("award", {});
    const forbidden = async (): Promise<SendResult> => ({
      ok: false,
      status: 403,
      error: "leader lost station assignment",
    });

    const summary = await flushOutbox({ award: forbidden });
    expect(summary).toEqual({ sent: 0, failed: 1, remaining: 0 });

    // It never disappears — it surfaces as failed, not silently gone.
    const failed = await listFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].lastError).toBe("leader lost station assignment");

    // And a later flush never picks it back up on its own.
    let sendCount = 0;
    await flushOutbox({
      award: async () => {
        sendCount++;
        return { ok: true };
      },
    });
    expect(sendCount).toBe(0);
  });

  it("a thrown network error is treated like a 5xx — retried, not dropped", async () => {
    await enqueueMutation("award", {});
    const offline = async (): Promise<SendResult> => {
      throw new Error("Failed to fetch");
    };

    const summary = await flushOutbox({ award: offline });
    expect(summary).toEqual({ sent: 0, failed: 0, remaining: 1 });
  });

  it("a mutation with no registered sender is left queued, never dropped", async () => {
    await enqueueMutation("checkin", {});
    const summary = await flushOutbox({});
    expect(summary).toEqual({ sent: 0, failed: 0, remaining: 1 });
  });
});
