import { describe, test, expect } from "vitest";
import {
  parseAvatarConfig,
  defaultAvatarConfig,
  resolveAvatarConfig,
} from "@/lib/avatar";

describe("defaultAvatarConfig", () => {
  test("is deterministic for a given seed", () => {
    const seed = "a0000000-0000-0000-0000-000000000101";
    expect(defaultAvatarConfig(seed)).toEqual(defaultAvatarConfig(seed));
  });

  test("different seeds generally differ", () => {
    const a = defaultAvatarConfig("scout-one");
    const b = defaultAvatarConfig("scout-two");
    expect(a).not.toEqual(b);
  });
});

describe("parseAvatarConfig", () => {
  test("accepts a valid config and strips unknown keys", () => {
    const parsed = parseAvatarConfig({
      sex: "man",
      bgColor: "#ff0000",
      // not a real avatar field — must be dropped, never persisted
      injected: "<script>",
    });
    expect(parsed).toEqual({ sex: "man", bgColor: "#ff0000" });
  });

  test("rejects a bad hex colour", () => {
    expect(parseAvatarConfig({ faceColor: "red" })).toBeNull();
  });

  test("rejects a non-object", () => {
    expect(parseAvatarConfig("nope")).toBeNull();
    expect(parseAvatarConfig(["a", "b"])).toBeNull();
    expect(parseAvatarConfig(null)).toBeNull();
  });

  test("caps an overlong style token (no row bloat)", () => {
    expect(parseAvatarConfig({ hairStyle: "x".repeat(100) })).toBeNull();
  });
});

describe("resolveAvatarConfig", () => {
  test("falls back to the seeded default for an empty saved config", () => {
    const seed = "seed-x";
    expect(resolveAvatarConfig(seed, {})).toEqual(defaultAvatarConfig(seed));
  });

  test("falls back to the seeded default for an invalid saved config", () => {
    const seed = "seed-y";
    expect(resolveAvatarConfig(seed, { faceColor: "not-hex" })).toEqual(
      defaultAvatarConfig(seed),
    );
  });

  test("uses a valid saved config over the default", () => {
    const saved = { sex: "woman" as const, bgColor: "#00ff00" };
    expect(resolveAvatarConfig("seed-z", saved)).toEqual(saved);
  });
});
