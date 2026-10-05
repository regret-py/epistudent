import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@studybuddy/ui";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getDictionary } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginButton } from "./login-button";

const ERROR_KEYS = ["domain", "oauth", "generic"] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

export const metadata = { title: "Login" };

export default function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  const dict = getDictionary();
  const error = searchParams.error
    ? (ERROR_KEYS as readonly string[]).includes(searchParams.error)
      ? (searchParams.error as ErrorKey)
      : "generic"
    : null;

  return (
    <main className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]"
      />
      <div className="container flex items-center justify-between py-4">
        <Logo className="text-sm" />
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <div className="container flex flex-1 items-center justify-center pb-16">
        <Card className="w-full max-w-sm border-border/60 bg-card/80 backdrop-blur">
          <CardHeader className="space-y-3 text-center">
            <CardTitle className="text-2xl">{dict.login.title}</CardTitle>
            <CardDescription>{dict.login.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {dict.login.errors[error]}
              </p>
            )}
            <LoginButton next={safeNextPath(searchParams.next)} label={dict.login.microsoft} />
            <p className="text-center text-xs text-muted-foreground">{dict.login.domainHint}</p>
            <p className="flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              {dict.login.privacy}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
