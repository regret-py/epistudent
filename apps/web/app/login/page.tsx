"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@studybuddy/ui";
import { BoxLogo } from "@/components/box-logo";
import { MicrosoftIcon } from "@/components/microsoft-icon";
import { PrefsLinks } from "@/components/prefs-links";
import { ErrorText } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { isConfigured } from "@/lib/env";
import { useI18n } from "@/lib/i18n/client";
import { safeNextPath } from "@/lib/safe-redirect";
import { supabase } from "@/lib/supabase";

const ERROR_KEYS = ["domain", "oauth", "generic"] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

function LoginInner() {
  const { dict } = useI18n();
  const { status, domainRejected } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [loading, setLoading] = useState(false);
  const [oauthError, setOauthError] = useState(false);

  useEffect(() => {
    if (status === "signedIn") router.replace(next);
  }, [status, next, router]);

  const raw = domainRejected ? "domain" : oauthError ? "oauth" : params.get("error");
  const error: ErrorKey | null = raw ? ((ERROR_KEYS as readonly string[]).includes(raw) ? (raw as ErrorKey) : "generic") : null;

  async function signIn() {
    setLoading(true);
    const redirectTo = new URL("/auth/callback/", window.location.origin);
    redirectTo.searchParams.set("next", next);
    // Supabase calls the Microsoft provider "azure".
    const { error: err } = await supabase().auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: redirectTo.toString(),
        scopes: "openid email profile offline_access",
        queryParams: { domain_hint: "epitech.eu", prompt: "select_account" },
      },
    });
    if (err) {
      setLoading(false);
      setOauthError(true);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="container flex justify-end pt-5">
        <PrefsLinks />
      </div>
      <div className="container flex flex-1 flex-col justify-center py-10">
        <BoxLogo className="self-start text-[18vw] sm:text-[110px]" />
        <h1 className="mt-6 font-display text-2xl font-black italic sm:text-3xl">{dict.login.tagline}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">{dict.login.lead}</p>

        <div className="mt-8 w-full max-w-sm space-y-3">
          {!isConfigured && <ErrorText>{dict.common.notConfigured}</ErrorText>}
          {error && <ErrorText>{dict.login.errors[error]}</ErrorText>}
          <Button size="lg" className="w-full" onClick={signIn} disabled={loading} data-testid="login-microsoft">
            <MicrosoftIcon className="size-4" />
            {loading ? dict.login.signingIn : dict.login.microsoft}
          </Button>
          <p className="text-[11px] lowercase text-muted-foreground">{dict.login.domainHint}</p>
        </div>

        <ul className="mt-12 grid max-w-2xl grid-cols-2 gap-px border border-foreground bg-foreground sm:grid-cols-3">
          {(["deadlines", "groups", "rooms", "moulinette", "swaps", "bocal"] as const).map((key, i) => (
            <li
              key={key}
              className={
                "flex aspect-[4/3] items-end p-3 font-display text-lg font-black italic lowercase " +
                (i % 3 === 0 ? "bg-primary text-white" : "bg-background")
              }
            >
              {dict.nav[key]}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-md text-[11px] text-muted-foreground">{dict.login.privacy}</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
