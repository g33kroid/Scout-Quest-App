import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/server/env";

// service-role client — bypasses RLS entirely. Only ever import this from
// /lib/server code that genuinely needs elevated privilege (minting a scout
// session via the GoTrue admin API). Never expose this client or its key to
// the browser.
export function createAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
