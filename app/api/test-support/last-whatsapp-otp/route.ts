import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase-admin";

// E2E-only: Playwright can't read WhatsApp, so with E2E_TEST_MODE set this
// is how it learns what code was "sent" (see lib/server/whatsapp-sender.ts
// — the capture lives in Postgres, not in-memory, since Next.js doesn't
// reliably share module state between a Server Action and a Route Handler).
// 404s unconditionally otherwise — this route does not exist in a real
// deploy.
export async function GET(request: Request) {
  if (process.env.E2E_TEST_MODE !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  const to = new URL(request.url).searchParams.get("to");
  if (!to) {
    return NextResponse.json({ error: "missing ?to=" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("e2e_whatsapp_otp_capture")
    .select("message")
    .eq("recipient", to)
    .maybeSingle();

  const code = data?.message?.match(/\d{6}/)?.[0] ?? null;
  return NextResponse.json({ code });
}
