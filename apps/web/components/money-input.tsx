"use client";

import { useState } from "react";
import { cn } from "@studybuddy/ui";
import { checkAmount } from "@/lib/plan";

const MESSAGES = {
  invalid: "Montant invalide (ex. 850 ou 1 200,50).",
  max: "Maximum 1 000 000 €.",
} as const;

/** Big euro field. Errors show once the user leaves the field, so "100," mid-typing never flashes. */
export function MoneyInput({ id, label, hint, value, onChange, placeholder }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [focused, setFocused] = useState(false);
  const { error } = checkAmount(value);
  const showError = error !== null && !focused;
  return (
    <div className="flex min-w-0 flex-col bg-background p-4 sm:p-5">
      <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[0.2em]">
        {label}
      </label>
      <div className="mt-2 flex items-baseline gap-2 border-b-2 border-ink focus-within:border-b-[5px] focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-ink">
        <input
          id={id}
          name={id}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          maxLength={16}
          placeholder={placeholder}
          value={value}
          aria-invalid={showError}
          aria-describedby={showError ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "display tabular w-full min-w-0 bg-transparent pb-1 text-[34px] outline-none placeholder:text-muted-foreground sm:text-[44px]",
            showError && "underline decoration-wavy decoration-2 underline-offset-8",
          )}
        />
        <span className="display text-[26px] sm:text-[32px]" aria-hidden>
          €
        </span>
      </div>
      {showError ? (
        <p id={`${id}-error`} className="mt-2 text-[11px] font-bold">
          {MESSAGES[error]}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-2 text-[11px] text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
