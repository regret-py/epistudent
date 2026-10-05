"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BoxLogo } from "@/components/box-logo";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/client";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Microsoft redirects here with ?code=… ; supabase-js exchanges it automatically
 * (detectSessionInUrl + PKCE). We then route to onboarding or the requested page.
 */
export default function AuthCallbackPage() {
  const { status, profile, domainRejected } = useAuth();
  const router = useRouter();
  const { dict } = useI18n();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = safeNextPath(params.get("next"));
    const providerError = params.get("error_description") ?? params.get("error");

    if (providerError) {
      // The DB trigger rejects non-Epitech sign-ups; GoTrue reports it as a database error.
      const domain = /epitech|database error saving new user/i.test(providerError);
      router.replace(`/login/?error=${domain ? "domain" : "oauth"}`);
      return;
    }
    if (status === "loading") return;
    if (status === "signedOut") {
      router.replace(`/login/?error=${domainRejected ? "domain" : "oauth"}`);
      return;
    }
    router.replace(profile?.onboarded_at ? next : `/onboarding/?next=${encodeURIComponent(next)}`);
  }, [status, profile, domainRejected, router]);

  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3">
        <BoxLogo className="animate-pulse text-4xl" />
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{dict.login.signingIn}</span>
      </div>
    </div>
  );
}
