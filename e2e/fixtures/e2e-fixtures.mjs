// Shared E2E fixture constants — imported by both
// scripts/seed-e2e-fixtures.mjs (seeds them into the DB) and the Playwright
// specs (drive the UI with them). Pure data, no side effects on import.
// Invented names/ids only (docs/CLAUDE.md — no real data in this repo).
export const FIXTURES = {
  unitId: "9e000000-0000-0000-0000-000000000001",
  scoutId: "9e000000-0000-0000-0000-000000000101",
  leaderId: "9e000000-0000-0000-0000-000000000201",
  joinCode: "E2EDEMO",
  scoutNickname: "E2E Demo Scout",
  scoutPin: "482913",
  leaderEmail: "e2e-leader@scouts.invalid",
  leaderPassword: "correct-horse-battery-staple-2026",
  // Task 05: a "today" session plus a roster of 12 scouts, enough to cover
  // "selecting 12 scouts and awarding writes exactly 12 ledger rows". Its
  // own leader identity (same unit — a unit legitimately has several
  // leaders) rather than reusing `leaderId`: leader-login.spec.ts and
  // leader-scoring.spec.ts both need to observe a leader's *first-ever*
  // TOTP enrollment (that's the only time GoTrue returns the secret), and
  // sharing one leader meant whichever spec ran second saw an
  // already-enrolled leader and had no secret to compute a code from.
  sessionId: "9e000000-0000-0000-0000-000000000601",
  rosterScoutIds: Array.from(
    { length: 12 },
    (_, i) => `9e000000-0000-0000-0000-${(700 + i).toString().padStart(12, "0")}`,
  ),
  scoringLeaderId: "9e000000-0000-0000-0000-000000000202",
  scoringLeaderEmail: "e2e-scoring-leader@scouts.invalid",
  scoringLeaderPassword: "another-correct-horse-battery-2026",
  // Second factor is a WhatsApp-delivered OTP (replaced authenticator-app
  // TOTP after Task 03 shipped) — distinct per leader so the capture table
  // (lib/server/whatsapp-sender.ts) never mixes them up when both specs
  // run in the same worker. 555-0100 is the reserved fictional US number
  // range — not just invented, structurally guaranteed non-real, unlike a
  // made-up UAE-shaped number (scripts/check-no-real-data.sh bans those
  // outright, real or not, since they're indistinguishable from real ones).
  leaderWhatsAppNumber: "+15550100001",
  scoringLeaderWhatsAppNumber: "+15550100002",
  // Task 09/10: a published, available quest the scout can see on their
  // journal, plus a locked one gated on a prerequisite the scout hasn't
  // completed — enough to exercise both "available" and "locked" rendering
  // without seeding a full board.
  availableQuestId: "9e000000-0000-0000-0000-000000000801",
  availableQuestTitle: "E2E Available Quest",
  prereqQuestId: "9e000000-0000-0000-0000-000000000802",
  prereqQuestTitle: "E2E Prerequisite Quest",
  lockedQuestId: "9e000000-0000-0000-0000-000000000803",
  lockedQuestTitle: "E2E Locked Quest",
  // Its own leader identity (same reasoning as scoringLeaderId above) — a
  // fresh WhatsApp-setup flow can only happen once per leader per DB, and
  // this spec needs that first-setup leg same as leader-login.spec.ts does
  // for `leaderId`.
  questAuthoringLeaderId: "9e000000-0000-0000-0000-000000000203",
  questAuthoringLeaderEmail: "e2e-quest-leader@scouts.invalid",
  questAuthoringLeaderPassword: "yet-another-correct-horse-2026",
  questAuthoringLeaderWhatsAppNumber: "+15550100003",
};
