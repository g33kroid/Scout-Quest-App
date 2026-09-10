import { NextResponse, type NextRequest } from "next/server";
import { createProxySupabaseClient } from "@/lib/server/supabase-proxy";

// Route guard: the single place that decides who can reach /leader/* and
// /scout/*. docs/tasks/03-auth.md non-negotiables this enforces:
// - a leader must never authenticate through the scout path, and a scout
//   session must never satisfy a leader route guard (403, not a redirect
//   loop — a scout IS authenticated, just not authorised for this route)
// - a leader without TOTP enrolled/challenged this session cannot reach
//   any leader route (redirected to finish that step, not locked out with
//   no path forward)
// Leader pages that are themselves the escape valve for an incomplete TOTP
// state — each already guards/redirects itself at the Server Component
// level (see lib/server/leader-auth.ts's getLeaderSessionState()). Guarding
// them here too would redirect /leader/enroll-totp to /leader/enroll-totp
// when the leader has no TOTP factor yet — an infinite loop, not a guard.
const LEADER_AUTH_FLOW_PATHS = [
  "/leader/login",
  "/leader/enroll-totp",
  "/leader/verify-totp",
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

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factorsData?.totp?.find((f) => f.status === "verified");
  if (!verifiedTotp) {
    return NextResponse.redirect(new URL("/leader/enroll-totp", request.url));
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel !== "aal2") {
    return NextResponse.redirect(new URL("/leader/verify-totp", request.url));
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
