import { describe, expect, it } from "vitest";
import { isLocale, t } from "./messages";

describe("t", () => {
  it("resolves a dotted key path", () => {
    expect(t("en", "leaderQuests.title")).toBe("Quests");
    expect(t("ar", "leaderQuests.title")).toBe("المهام");
  });

  it("interpolates {var} placeholders", () => {
    expect(t("en", "leaderQuests.tierOption", { tier: "minor", points: 10 })).toBe(
      "minor · 10 pts",
    );
  });

  it("leaves an unmatched placeholder untouched", () => {
    expect(t("en", "leaderQuests.tierOption", { tier: "minor" })).toBe(
      "minor · {points} pts",
    );
  });

  it("falls back to the key itself when nothing matches", () => {
    expect(t("en", "does.not.exist")).toBe("does.not.exist");
  });
});

describe("isLocale", () => {
  it("accepts en and ar", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ar")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
