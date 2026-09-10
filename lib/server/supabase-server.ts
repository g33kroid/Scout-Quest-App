import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/server/env";

// anon-key client for Server Components / Server Actions / Route Handlers.
// Reads and writes the session via Next.js cookies — RLS applies exactly as
// it would through PostgREST, since this client carries the same JWT.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // A Server Component can't set cookies — this throws there. Callers
        // that only read the session (route guards) should expect that and
        // let middleware handle the actual refresh/write.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // no-op: called from a Server Component, not a Server Action/Route Handler
        }
      },
    },
  });
}
