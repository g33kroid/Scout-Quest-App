-- Split from the migration that actually uses this value: Postgres refuses
-- to use a new enum value inside the same transaction that added it, and
-- this project's migration runner applies each file as one transaction.
alter type public.rate_limit_scope add value if not exists 'leader_otp_verify';
