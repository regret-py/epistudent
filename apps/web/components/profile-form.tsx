"use client";

import { useState } from "react";
import {
  AVAILABILITY_SLOTS,
  CAMPUSES,
  LANGUAGES,
  PROMOS,
  onboardingSchema,
  type AvailabilitySlot,
  type Campus,
  type Language,
  type ProfileRow,
} from "@studybuddy/db";
import { Button, cn } from "@studybuddy/ui";
import { useI18n } from "@/lib/i18n/client";
import { supabase } from "@/lib/supabase";
import { Chip, ErrorText, Field } from "./ui";

export const LANGUAGE_LABELS: Record<Language, string> = {
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

function asLanguages(value: unknown): Partial<Record<Language, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([k, v]) => (LANGUAGES as readonly string[]).includes(k) && typeof v === "number"),
  );
}

function asSlots(value: unknown): AvailabilitySlot[] {
  return Array.isArray(value) ? value.filter((v): v is AvailabilitySlot => (AVAILABILITY_SLOTS as readonly string[]).includes(v)) : [];
}

/** Used by onboarding (first time) and the profile page (edit). */
export function ProfileForm({ profile, submitLabel, onSaved }: { profile: ProfileRow; submitLabel: string; onSaved: () => void | Promise<void> }) {
  const { dict } = useI18n();
  const t = dict.onboarding;

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [promo, setPromo] = useState<(typeof PROMOS)[number]>(profile.promo ?? "tek1");
  const [city, setCity] = useState<Campus>(((CAMPUSES as readonly string[]).includes(profile.city ?? "") ? profile.city : "paris") as Campus);
  const [languages, setLanguages] = useState(asLanguages(profile.languages));
  const [availability, setAvailability] = useState(asSlots(profile.availability));
  const [optIn, setOptIn] = useState(profile.matchmaking_opt_in);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function rate(lang: Language, level: number) {
    setLanguages((prev) => {
      const next = { ...prev };
      if (next[lang] === level) delete next[lang];
      else next[lang] = level;
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = onboardingSchema.safeParse({ promo, city, languages, availability, matchmakingOptIn: optIn });
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.message as keyof typeof t.errors;
      setError(t.errors[key] ?? t.errors.generic);
      return;
    }
    setPending(true);
    const { error: dbError } = await supabase()
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        promo: parsed.data.promo,
        city: parsed.data.city,
        languages: parsed.data.languages,
        availability: parsed.data.availability,
        matchmaking_opt_in: parsed.data.matchmakingOptIn,
        onboarded_at: profile.onboarded_at ?? new Date().toISOString(),
      })
      .eq("id", profile.id);
    setPending(false);
    if (dbError) {
      setError(t.errors.generic);
      return;
    }
    await onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t.displayName} htmlFor="display_name">
          <input id="display_name" className="field" value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label={t.promo} htmlFor="promo">
          <select id="promo" className="field" value={promo} onChange={(e) => setPromo(e.target.value as typeof promo)}>
            {PROMOS.map((p) => (
              <option key={p} value={p}>
                {p.replace("tek", "Tek")}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.city} htmlFor="city">
          <select id="city" className="field" value={city} onChange={(e) => setCity(e.target.value as Campus)}>
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {dict.campuses[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="label">{t.languages}</legend>
        <p className="mb-2 text-[11px] text-muted-foreground">{t.languagesHint}</p>
        <div className="grid border-t border-foreground sm:grid-cols-2 sm:gap-x-8">
          {LANGUAGES.map((lang) => (
            <div key={lang} className="flex items-center justify-between border-b py-2">
              <span className="font-bold">{LANGUAGE_LABELS[lang]}</span>
              <div role="radiogroup" aria-label={LANGUAGE_LABELS[lang]} className="flex">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={languages[lang] === level}
                    aria-label={`${LANGUAGE_LABELS[lang]} ${level}/5`}
                    onClick={() => rate(lang, level)}
                    className={cn(
                      "-ml-px size-8 border border-foreground text-[11px] font-bold transition-colors",
                      (languages[lang] ?? 0) >= level ? "bg-primary text-white" : "hover:bg-ink hover:text-paper",
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">{t.availability}</legend>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_SLOTS.map((slot) => (
            <Chip
              key={slot}
              active={availability.includes(slot)}
              onClick={() => setAvailability((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]))}
            >
              {t.slots[slot]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 border border-foreground p-4">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 size-4 accent-[hsl(var(--primary))]" />
        <span>
          <span className="block font-bold">{t.optIn}</span>
          <span className="block text-[11px] text-muted-foreground">{t.optInHint}</span>
        </span>
      </label>

      <ErrorText>{error}</ErrorText>

      <Button type="submit" variant="red" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? dict.common.saving : submitLabel}
      </Button>
    </form>
  );
}
