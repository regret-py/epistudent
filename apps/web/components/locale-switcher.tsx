"use client";

import { useTransition } from "react";
import { Button } from "@studybuddy/ui";
import { setLocale } from "@/lib/i18n/actions";
import { useI18n } from "@/lib/i18n/client";

export function LocaleSwitcher() {
  const { locale, dict } = useI18n();
  const [pending, startTransition] = useTransition();
  const next = locale === "fr" ? "en" : "fr";
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-10 font-mono uppercase"
      disabled={pending}
      aria-label={`${dict.common.language}: ${next.toUpperCase()}`}
      data-testid="locale-switcher"
      onClick={() => startTransition(() => setLocale(next))}
    >
      {next}
    </Button>
  );
}
