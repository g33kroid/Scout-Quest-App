import { describe, expect, it } from "vitest";
import { formatNumber } from "./format";

// D15 (docs/open-decisions.md, resolved 2026-09-26): Western digits
// everywhere — the `ar` locale's default numbering system is Arabic-Indic,
// so this only passes if `-u-nu-latn` is actually pinned.
describe("formatNumber", () => {
  it("renders Western digits for the English locale", () => {
    expect(formatNumber(1234, "en")).toBe("1,234");
  });

  it("renders Western digits for the Arabic locale too", () => {
    const result = formatNumber(1234, "ar");
    expect(result).toMatch(/^[0-9,]+$/);
    expect(result).not.toMatch(/[٠-٩]/); // no Arabic-Indic digits
  });
});
