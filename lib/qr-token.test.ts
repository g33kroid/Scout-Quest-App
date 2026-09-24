import { describe, expect, it } from "vitest";
import { currentCounter, generateQrPayload, verifyQrPayload } from "./qr-token";

const SECRET = crypto.getRandomValues(new Uint8Array(32));
const OPAQUE_ID = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
const WINDOW_MS = 30_000;

function lookupOnly(opaqueId: string, secret: Uint8Array) {
  return (id: string) => (id === opaqueId ? secret : undefined);
}

describe("generateQrPayload / verifyQrPayload", () => {
  it("round-trips: a freshly generated token verifies", async () => {
    const now = Date.now();
    const payload = await generateQrPayload(SECRET, OPAQUE_ID, now);
    const result = await verifyQrPayload(payload, lookupOnly(OPAQUE_ID, SECRET), now);
    expect(result).toEqual({ ok: true, opaqueId: OPAQUE_ID });
  });

  it("token changes every 30s", async () => {
    const t0 = 0;
    const t1 = WINDOW_MS;
    const p0 = await generateQrPayload(SECRET, OPAQUE_ID, t0);
    const p1 = await generateQrPayload(SECRET, OPAQUE_ID, t1);
    expect(p0).not.toBe(p1);
  });

  it("a token captured 2 minutes ago is rejected", async () => {
    const generatedAt = 10 * WINDOW_MS;
    const scannedAt = generatedAt + 4 * WINDOW_MS; // 2 minutes later
    const payload = await generateQrPayload(SECRET, OPAQUE_ID, generatedAt);
    const result = await verifyQrPayload(
      payload,
      lookupOnly(OPAQUE_ID, SECRET),
      scannedAt,
    );
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("a token from ±1 window is accepted (clock skew)", async () => {
    const generatedAt = 10 * WINDOW_MS;
    const oneWindowLater = generatedAt + WINDOW_MS;
    const payload = await generateQrPayload(SECRET, OPAQUE_ID, generatedAt);
    const result = await verifyQrPayload(
      payload,
      lookupOnly(OPAQUE_ID, SECRET),
      oneWindowLater,
    );
    expect(result).toEqual({ ok: true, opaqueId: OPAQUE_ID });
  });

  it("a token for a scout outside the leader's unit is rejected", async () => {
    const now = Date.now();
    const payload = await generateQrPayload(SECRET, OPAQUE_ID, now);
    // The leader's cached roster simply has no entry for this opaqueId —
    // exactly what "outside the leader's unit" looks like on-device.
    const result = await verifyQrPayload(payload, () => undefined, now);
    expect(result).toEqual({ ok: false, reason: "unknown_scout" });
  });

  it("a tampered HMAC is rejected", async () => {
    const now = Date.now();
    const payload = await generateQrPayload(SECRET, OPAQUE_ID, now);
    const [opaqueId, counter, mac] = payload.split(".");
    const flippedLastChar = mac.slice(0, -1) + (mac.at(-1) === "0" ? "1" : "0");
    const tampered = `${opaqueId}.${counter}.${flippedLastChar}`;
    const result = await verifyQrPayload(tampered, lookupOnly(OPAQUE_ID, SECRET), now);
    expect(result).toEqual({ ok: false, reason: "tampered" });
  });

  it("a malformed payload is rejected without throwing", async () => {
    const result = await verifyQrPayload("not-a-real-payload", () => SECRET, Date.now());
    expect(result).toEqual({ ok: false, reason: "malformed" });
  });

  it("QR payload contains no UUID, name, or unit — only opaqueId, counter, mac", async () => {
    const payload = await generateQrPayload(SECRET, OPAQUE_ID, Date.now());
    const parts = payload.split(".");
    expect(parts).toHaveLength(3);
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    expect(uuidPattern.test(payload)).toBe(false);
    expect(payload).not.toMatch(/scout|leader|unit/i);
  });

  it("currentCounter advances exactly once per 30s window", () => {
    expect(currentCounter(0)).toBe(0);
    expect(currentCounter(WINDOW_MS - 1)).toBe(0);
    expect(currentCounter(WINDOW_MS)).toBe(1);
  });
});
