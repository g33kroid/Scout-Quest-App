import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetOutboxForTests,
  enqueueMutation,
  listFailed,
  listPending,
  markFailed,
  queueDepth,
  retryFailed,
  scheduleRetry,
} from "./outbox";

beforeEach(async () => {
  await _resetOutboxForTests();
});
afterEach(async () => {
  await _resetOutboxForTests();
});

describe("outbox", () => {
  it("writes the idempotency key at enqueue time — every retry keeps the same id", async () => {
    const mutation = await enqueueMutation("award", { foo: "bar" });
    expect(mutation.id).toBeTruthy();
    const [pending] = await listPending();
    expect(pending.id).toBe(mutation.id);
  });

  it("queue depth matches the actual outbox length", async () => {
    await enqueueMutation("award", {});
    await enqueueMutation("attendance", {});
    expect(await queueDepth()).toBe(2);
    const [first] = await listPending();
    await markFailed(first.id, "boom");
    // A failed mutation is no longer pending, but it never disappears.
    expect(await queueDepth()).toBe(1);
  });

  it("lists pending mutations oldest first", async () => {
    const a = await enqueueMutation("award", { n: 1 }, "id-a");
    await new Promise((r) => setTimeout(r, 2));
    const b = await enqueueMutation("award", { n: 2 }, "id-b");
    const pending = await listPending();
    expect(pending.map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it("a mutation under backoff is excluded from listPending until its window elapses", async () => {
    const mutation = await enqueueMutation("award", {});
    const now = mutation.createdAt;
    await scheduleRetry(mutation.id, 1, "server error");

    expect(await listPending(now + 500)).toHaveLength(0); // backoff not elapsed yet
    expect(await listPending(now + 5000)).toHaveLength(1); // 2s backoff (attempt 1) has elapsed
  });

  it("markFailed moves a mutation out of pending and into failed — it never disappears", async () => {
    const mutation = await enqueueMutation("award", {});
    await markFailed(mutation.id, "403 not authorized");

    expect(await listPending()).toHaveLength(0);
    const failed = await listFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].lastError).toBe("403 not authorized");
  });

  it("retryFailed moves a failed mutation back to pending", async () => {
    const mutation = await enqueueMutation("award", {});
    await markFailed(mutation.id, "403");
    await retryFailed(mutation.id);

    expect(await listFailed()).toHaveLength(0);
    expect(await listPending()).toHaveLength(1);
  });
});
