import { describe, expect, it } from "vitest";
import { pickNextUnlock, type JournalQuest } from "./journal-helpers";

function quest(overrides: Partial<JournalQuest>): JournalQuest {
  return {
    questId: "q1",
    title: "Quest",
    flavour: null,
    tier: "minor",
    kind: "solo",
    unmetPrereqTitles: [],
    completedAt: null,
    pointsEarned: null,
    teammateCount: null,
    ...overrides,
  };
}

describe("pickNextUnlock", () => {
  it("returns null when nothing is locked", () => {
    expect(pickNextUnlock([])).toBeNull();
  });

  it("picks the locked quest with the fewest unmet prerequisites", () => {
    const closest = quest({ questId: "close", unmetPrereqTitles: ["A"] });
    const farther = quest({ questId: "far", unmetPrereqTitles: ["A", "B", "C"] });
    expect(pickNextUnlock([farther, closest])).toBe(closest);
  });

  it("does not mutate the input array's order", () => {
    const locked = [
      quest({ questId: "far", unmetPrereqTitles: ["A", "B"] }),
      quest({ questId: "close", unmetPrereqTitles: ["A"] }),
    ];
    const originalOrder = locked.map((q) => q.questId);
    pickNextUnlock(locked);
    expect(locked.map((q) => q.questId)).toEqual(originalOrder);
  });
});
