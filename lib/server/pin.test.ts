import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "./pin";

describe("hashPin / verifyPin", () => {
  it("verifies a PIN against its own hash", async () => {
    const hash = await hashPin("482913");
    expect(await verifyPin(hash, "482913")).toBe(true);
  });

  it("rejects the wrong PIN", async () => {
    const hash = await hashPin("482913");
    expect(await verifyPin(hash, "000000")).toBe(false);
  });

  it("produces an argon2id hash", async () => {
    const hash = await hashPin("482913");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("never stores the raw PIN in the hash output", async () => {
    const hash = await hashPin("482913");
    expect(hash).not.toContain("482913");
  });
});
