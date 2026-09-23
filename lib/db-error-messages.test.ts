import { describe, expect, it } from "vitest";
import { friendlyDbError } from "./db-error-messages";

describe("friendlyDbError", () => {
  it("translates the no-cycle trigger's message", () => {
    expect(friendlyDbError("prerequisite a -> b would create a cycle")).toBe(
      "That prerequisite would create a circular chain — choose a different quest.",
    );
  });

  it("translates the publish-requires-both-locales message", () => {
    expect(
      friendlyDbError("quest x cannot be published without both en and ar translations"),
    ).toBe("Add both English and Arabic content before publishing.");
  });

  it("falls back to a generic message for anything else", () => {
    expect(friendlyDbError("duplicate key value violates unique constraint")).toBe(
      "Could not save that. Try again.",
    );
  });

  it("falls back to a generic message when there is no message at all", () => {
    expect(friendlyDbError(undefined)).toBe("Could not save that. Try again.");
  });
});
