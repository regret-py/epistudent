import { NextResponse, type NextRequest } from "next/server";
import { isEpitechEmail } from "@studybuddy/db";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (searchParams.get("error")) {
    // The DB trigger rejects non-Epitech sign-ups; Supabase reports it as a server_error.
    const description = searchParams.get("error_description") ?? "";
    const reason = /epitech/i.test(description) || /database error saving new user/i.test(description) ? "domain" : "oauth";
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }
  if (!code) return NextResponse.redirect(`${origin}/login?error=oauth`);

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=oauth`);

  if (!isEpitechEmail(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", data.user.id).single();
  const destination = profile?.onboarded_at ? next : `/onboarding?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(`${origin}${destination}`);
}
