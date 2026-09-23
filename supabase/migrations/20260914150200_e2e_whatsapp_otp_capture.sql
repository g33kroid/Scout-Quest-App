-- E2E-only. Next.js bundles Server Actions and Route Handlers separately
-- even within one `next start` process — an in-memory module singleton in
-- lib/server/whatsapp-sender.ts is NOT reliably shared between the action
-- that "sends" a WhatsApp OTP and the app/api/test-support route Playwright
-- reads it back from (confirmed empirically: the in-memory version worked
-- inconsistently). Postgres is the one thing both sides reliably share.
--
-- No RLS policies at all (default deny) — this table is only ever touched
-- by the admin (service-role) client, from code gated behind
-- E2E_TEST_MODE=true, never in a real deploy.
create table public.e2e_whatsapp_otp_capture (
  recipient text primary key,
  message text not null,
  updated_at timestamptz not null default now()
);

alter table public.e2e_whatsapp_otp_capture enable row level security;
