"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  AVAILABILITY_SLOTS,
  CAMPUSES,
  LANGUAGES,
  PROMOS,
  type AvailabilitySlot,
  type Campus,
  type Language,
} from "@studybuddy/db";
import { Button, Card, CardContent, Label, cn } from "@studybuddy/ui";
import { useI18n } from "@/lib/i18n/client";
import { saveOnboarding } from "./actions";

const LANGUAGE_LABELS: Record<Language, string> = {
  c: "C",
  cpp: "C++",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  haskell: "Haskell",
  rust: "Rust",
  java: "Java",
  go: "Go",
  csharp: "C#",
  asm: "Assembly",
  sql: "SQL",
};

const LEVELS = [1, 2, 3, 4, 5] as const;

const chip =
  "rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const chipOn = "border-primary bg-primary text-primary-foreground";
const chipOff = "bg-background hover:bg-accent";

export function OnboardingForm({ next }: { next: string }) {
  const { dict } = useI18n();
  const t = dict.onboarding;

  const [promo, setPromo] = useState<(typeof PROMOS)[number]>("tek1");
  const [city, setCity] = useState<Campus>("paris");
  const [languages, setLanguages] = useState<Partial<Record<Language, number>>>({});
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function rate(lang: Language, level: number) {
    setLanguages((prev) => {
      const nextLangs = { ...prev };
      // tapping the current level again clears it
      if (nextLangs[lang] === level) delete nextLangs[lang];
      else nextLangs[lang] = level;
      return nextLangs;
    });
  }

  function toggleSlot(slot: AvailabilitySlot) {
    setAvailability((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveOnboarding(
        { promo, city, languages: languages as Record<Language, number>, availability, matchmakingOptIn: optIn },
        next,
      );
      if (result?.error) setError(result.error);
    });
  }

  const errorMessage = error ? (t.errors[error as keyof typeof t.errors] ?? t.errors.generic) : null;

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <Card>
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="promo">{t.promo}</Label>
            <select
              id="promo"
              value={promo}
              onChange={(e) => setPromo(e.target.value as typeof promo)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PROMOS.map((p) => (
                <option key={p} value={p}>
                  {p.replace("tek", "Tek")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">{t.city}</Label>
            <select
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value as Campus)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CAMPUSES.map((c) => (
                <option key={c} value={c}>
                  {dict.campuses[c]}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t.languages}</legend>
        <p className="text-xs text-muted-foreground">{t.languagesHint}</p>
        <Card>
          <CardContent className="divide-y p-0">
            {LANGUAGES.map((lang) => (
              <div key={lang} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm">{LANGUAGE_LABELS[lang]}</span>
                <div role="radiogroup" aria-label={LANGUAGE_LABELS[lang]} className="flex gap-1">
                  {LEVELS.map((level) => {
                    const selected = (languages[lang] ?? 0) >= level;
                    return (
                      <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={languages[lang] === level}
                        aria-label={`${LANGUAGE_LABELS[lang]} ${level}/5`}
                        onClick={() => rate(lang, level)}
                        className={cn(
                          "size-8 rounded-md border text-xs font-medium transition-colors",
                          selected ? chipOn : chipOff,
                        )}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t.availability}</legend>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              aria-pressed={availability.includes(slot)}
              onClick={() => toggleSlot(slot)}
              className={cn(chip, availability.includes(slot) ? chipOn : chipOff)}
            >
              {t.slots[slot]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
        <input
          type="checkbox"
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
          className="mt-1 size-4 accent-[hsl(var(--primary))]"
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium">{t.optIn}</span>
          <span className="block text-xs text-muted-foreground">{t.optInHint}</span>
        </span>
      </label>

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? t.saving : t.submit}
      </Button>
    </form>
  );
}
