"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@studybuddy/ui";
import { MicrosoftIcon } from "@/components/microsoft-icon";
import { createClient } from "@/lib/supabase/client";

export function LoginButton({ next, label }: { next: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signIn() {
    setLoading(true);
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    // Supabase calls the Microsoft provider "azure".
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: redirectTo.toString(),
        scopes: "openid email profile offline_access",
        queryParams: { domain_hint: "epitech.eu", prompt: "select_account" },
      },
    });
    if (error) {
      setLoading(false);
      router.replace("/login?error=oauth");
    }
  }

  return (
    <Button size="lg" variant="outline" className="w-full" onClick={signIn} disabled={loading} data-testid="login-microsoft">
      {loading ? <Loader2 className="animate-spin" /> : <MicrosoftIcon className="size-4" />}
      {label}
    </Button>
  );
}
