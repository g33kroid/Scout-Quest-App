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
};
