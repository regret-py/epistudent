"use client";

import { cn } from "@studybuddy/ui";
import { parseEuros } from "@/lib/plan";

/** Big euro field; shows its own error when the text isn't an amount. */
export function MoneyInput({ id, label, hint, value, onChange, placeholder, autoFocus }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  const invalid = value.trim() !== "" && parseEuros(value) === null;
  return (
    <div className="flex flex-col bg-background p-4 sm:p-5">
      <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[0.2em]">
        {label}
      </label>
      <div className="mt-2 flex items-baseline gap-2 border-b-2 border-ink">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          maxLength={14}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "display tabular w-full min-w-0 bg-transparent pb-1 text-[34px] outline-none placeholder:text-muted-foreground/40 sm:text-[44px]",
            invalid && "underline decoration-wavy decoration-2 underline-offset-8",
          )}
        />
        <span className="display text-[26px] sm:text-[32px]" aria-hidden>
          €
        </span>
      </div>
      {invalid ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[11px] font-bold">
          Montant invalide.
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
