import { NextResponse, type NextRequest } from "next/server";
import { createProxySupabaseClient } from "@/lib/server/supabase-proxy";
import {
  OTP_VERIFIED_COOKIE_NAME,
  isOtpVerifiedCookieValid,
} from "@/lib/server/otp-session";

// Route guard: the single place that decides who can reach /leader/* and
// /scout/*. docs/tasks/03-auth.md non-negotiables this enforces:
// - a leader must never authenticate through the scout path, and a scout
//   session must never satisfy a leader route guard (403, not a redirect
//   loop — a scout IS authenticated, just not authorised for this route)
// - a leader without a WhatsApp-verified OTP this session cannot reach any
//   leader route (redirected to finish that step, not locked out with no
//   path forward) — the second factor is a WhatsApp-delivered OTP, not
//   authenticator-app TOTP (see the PR that introduced this comment for why).
// Leader pages that are themselves the escape valve for an incomplete
// setup/verify state — each already guards/redirects itself at the Server
// Component level (see lib/server/leader-auth.ts's getLeaderSessionState()).
// Guarding them here too would redirect /leader/setup-whatsapp to itself
// when the leader has no number on file yet — an infinite loop, not a guard.
const LEADER_AUTH_FLOW_PATHS = [
  "/leader/login",
  "/leader/setup-whatsapp",
  "/leader/verify-otp",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/leader") && !LEADER_AUTH_FLOW_PATHS.includes(pathname)) {
    return guardLeaderRoute(request);
  }
  if (pathname.startsWith("/scout") && !pathname.startsWith("/scout/login")) {
    return guardScoutRoute(request);
  }

  return NextResponse.next();
}

async function guardLeaderRoute(request: NextRequest) {
  const { supabase, getResponse } = createProxySupabaseClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/leader/login", request.url));
  }

  const { data: leaderRow } = await supabase
    .from("leaders")
    .select("person_id")
    .eq("person_id", user.id)
    .maybeSingle();
  if (!leaderRow) {
    // Authenticated, but not a leader/admin — e.g. a scout session. 403,
    // not a redirect: redirecting to /leader/login would just bounce them
    // straight back here once "signed in" (they already are), looping.
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { data: whatsappNumber } = await supabase.rpc("leader_get_own_whatsapp_number");
  if (!whatsappNumber) {
    return NextResponse.redirect(new URL("/leader/setup-whatsapp", request.url));
  }

  const otpCookie = request.cookies.get(OTP_VERIFIED_COOKIE_NAME)?.value;
  if (!(await isOtpVerifiedCookieValid(otpCookie, user.id))) {
    return NextResponse.redirect(new URL("/leader/verify-otp", request.url));
  }

  return getResponse();
}

async function guardScoutRoute(request: NextRequest) {
  const { supabase, getResponse } = createProxySupabaseClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/scout/login", request.url));
  }

  const { data: leaderRow } = await supabase
    .from("leaders")
    .select("person_id")
    .eq("person_id", user.id)
    .maybeSingle();
  if (leaderRow) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return getResponse();
}

export const config = {
  matcher: ["/leader/:path*", "/scout/:path*"],
};
