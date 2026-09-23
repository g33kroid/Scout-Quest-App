// Postgres wraps trigger/check violations in its own message; both of ours
// (cycle rejection, publish-requires-both-locales — see
// supabase/migrations/20260914120000_task09_quests_board.sql and
// 20260909120000_wave1_schema.sql) are `raise exception` text we wrote
// ourselves, so a substring match is enough to translate them without
// parsing SQLSTATE codes for messages only this codebase produces. Kept in
// its own module (no "use server", no supabase import) so it's testable
// without a DB round trip.
export function friendlyDbError(message: string | undefined): string {
  if (!message) return "Could not save that. Try again.";
  if (message.includes("would create a cycle")) {
    return "That prerequisite would create a circular chain — choose a different quest.";
  }
  if (message.includes("cannot be published without both")) {
    return "Add both English and Arabic content before publishing.";
  }
  return "Could not save that. Try again.";
}
