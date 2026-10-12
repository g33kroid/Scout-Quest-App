import { describe, test, expect } from "vitest";
import { parseAvatarConfig } from "@/lib/avatar";

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

  test("treats an empty object as not-set (null, callers seed the default)", () => {
    expect(parseAvatarConfig({})).toBeNull();
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
