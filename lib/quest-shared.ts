// Quest constants/types shared between server data-fetching
// (lib/server/quest-authoring.ts) and client components
// (app/leader/quests/quest-form.tsx). Kept out of the server-only module so
// a "use client" component can import TIER_POINTS/QuestTier without pulling
// in "server-only" (which fails the build from a Client Component).

export type QuestTier = "minor" | "standard" | "major" | "epic";
export type QuestKind = "solo" | "group";

// Fixed tiers (rule 2) — the DB's own ledger check is the real enforcement;
// this is only ever used to label a radio button, never sent as a raw number.
export const TIER_POINTS: Record<QuestTier, number> = {
  minor: 10,
  standard: 25,
  major: 50,
  epic: 100,
};

export interface QuestOption {
  id: string;
  title: string;
}

// Message-file keys (messages/en.json, messages/ar.json) for each enum
// value — the label itself is locale-dependent, this mapping isn't.
export const TIER_MESSAGE_KEY: Record<QuestTier, string> = {
  minor: "leaderQuests.tierMinor",
  standard: "leaderQuests.tierStandard",
  major: "leaderQuests.tierMajor",
  epic: "leaderQuests.tierEpic",
};

export const KIND_MESSAGE_KEY: Record<QuestKind, string> = {
  solo: "leaderQuests.solo",
  group: "leaderQuests.group",
};
