#!/usr/bin/env bash
# docs/tasks/04-ledger.md "Done when": the idempotency guarantee survives 50
# concurrent duplicate award_points() calls with the same idempotency_key.
# pgTAP runs single-threaded, so this is a real multi-connection demo,
# separate from the pgTAP suite. Run manually against DATABASE_URL:
#   DATABASE_URL=postgresql://localhost:5432/scout_quest_dev bash scripts/demo-concurrent-award.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL not set}"

UNIT_ID="a1000000-0000-0000-0000-000000000001"
LEADER_ID="a1000000-0000-0000-0000-000000000201"
SCOUT_ID="a1000000-0000-0000-0000-000000000101"
KEY="concurrent-demo-$(date +%s)"

cleanup() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null <<SQL
delete from ledger where person_id = '$SCOUT_ID';
delete from unit_enrollments where person_id = '$SCOUT_ID';
delete from leaders where person_id = '$LEADER_ID';
delete from people where id in ('$SCOUT_ID', '$LEADER_ID');
delete from units where id = '$UNIT_ID';
SQL
}
trap cleanup EXIT

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into units (id, name_en, name_ar, grade_low, grade_high)
  values ('$UNIT_ID', 'Concurrency Demo Unit', 'وحدة تجريبية', 5, 6);
insert into people (id, display_name) values
  ('$SCOUT_ID', 'Concurrency Demo Scout'),
  ('$LEADER_ID', 'Concurrency Demo Leader');
insert into unit_enrollments (person_id, unit_id) values ('$SCOUT_ID', '$UNIT_ID');
insert into leaders (person_id, role, unit_id) values ('$LEADER_ID', 'leader', '$UNIT_ID');
SQL

echo "firing 50 concurrent award_points() calls, same idempotency_key..."
for i in $(seq 1 50); do
  (
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL >/dev/null
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '$LEADER_ID')::text, false);
select public.award_points(array['$SCOUT_ID']::uuid[], 'minor', 'award', null, null, '$KEY');
SQL
  ) &
done
wait

ROWS=$(psql "$DATABASE_URL" -t -A -c "select count(*) from ledger where idempotency_key = '$KEY:$SCOUT_ID'")

echo "rows written for that idempotency key: $ROWS"
if [ "$ROWS" -eq 1 ]; then
  echo "PASS: 50 concurrent duplicate calls produced exactly one row."
  exit 0
else
  echo "FAIL: expected exactly 1 row, got $ROWS"
  exit 1
fi
