#!/usr/bin/env node
// Seeds one scout + one leader for Playwright E2E against the real
// `supabase start` stack. Plain JS (not TS) — a standalone dev/CI script,
// not part of the Next.js app bundle, so no TS runner needed to run it.
import { createClient } from "@supabase/supabase-js";
import { hash } from "@node-rs/argon2";
import pg from "pg";
import { FIXTURES } from "../e2e/fixtures/e2e-fixtures.mjs";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const pool = new pg.Pool({ connectionString: databaseUrl });

  // GoTrue owns auth.users — create both people through the admin API so
  // their auth.users row exists, matching people.id (docs/schema.md's
  // "people.id IS auth.users.id" assumption).
  const { data: scoutUser, error: scoutUserError } = await admin.auth.admin.createUser({
    id: FIXTURES.scoutId,
    email: `scout-${FIXTURES.scoutId}@scouts.invalid`,
    email_confirm: true,
  });
  if (
    scoutUserError &&
    !`${scoutUserError.message}`.includes("already been registered")
  ) {
    throw scoutUserError;
  }

  const { data: leaderUser, error: leaderUserError } = await admin.auth.admin.createUser({
    id: FIXTURES.leaderId,
    email: FIXTURES.leaderEmail,
    password: FIXTURES.leaderPassword,
    email_confirm: true,
  });
  if (
    leaderUserError &&
    !`${leaderUserError.message}`.includes("already been registered")
  ) {
    throw leaderUserError;
  }

  const pinHash = await hash(FIXTURES.scoutPin, { algorithm: 2 });

  await pool.query("begin");
  try {
    await pool.query(
      `insert into units (id, name_en, name_ar, grade_low, grade_high)
       values ($1, 'E2E Demo Unit', 'وحدة تجريبية', 5, 6)
       on conflict (id) do nothing`,
      [FIXTURES.unitId],
    );
    await pool.query(
      `insert into people (id, display_name) values ($1, $2)
       on conflict (id) do update set display_name = excluded.display_name`,
      [FIXTURES.scoutId, FIXTURES.scoutNickname],
    );
    await pool.query(
      `insert into people (id, display_name) values ($1, 'E2E Demo Leader')
       on conflict (id) do nothing`,
      [FIXTURES.leaderId],
    );
    await pool.query(
      `insert into unit_enrollments (person_id, unit_id) values ($1, $2)
       on conflict do nothing`,
      [FIXTURES.scoutId, FIXTURES.unitId],
    );
    await pool.query(
      `insert into leaders (person_id, role, unit_id) values ($1, 'leader', $2)
       on conflict (person_id) do nothing`,
      [FIXTURES.leaderId, FIXTURES.unitId],
    );
    await pool.query(
      `insert into scout_credentials (person_id, pin_hash) values ($1, $2)
       on conflict (person_id) do update set pin_hash = excluded.pin_hash,
         failed_attempts = 0, lockout_count = 0, locked_until = null`,
      [FIXTURES.scoutId, pinHash],
    );
    await pool.query(
      `insert into join_codes (unit_id, code, expires_at, created_by)
       values ($1, $2, now() + interval '30 days', $3)
       on conflict (code) do update set expires_at = excluded.expires_at`,
      [FIXTURES.unitId, FIXTURES.joinCode, FIXTURES.leaderId],
    );
    await pool.query("commit");
  } catch (err) {
    await pool.query("rollback");
    throw err;
  } finally {
    await pool.end();
  }

  console.log("E2E fixtures seeded:", {
    scoutUserId: scoutUser?.user?.id ?? FIXTURES.scoutId,
    leaderUserId: leaderUser?.user?.id ?? FIXTURES.leaderId,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
