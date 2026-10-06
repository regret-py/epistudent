"use client";

import { useEffect, useState } from "react";
import { formatEuro, parseAmount, type Summary } from "@/lib/budget";

/** Monthly savings target: how much of the balance to keep aside. */
export function Goal({ summary, goal, onChange }: { summary: Summary; goal: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(goal === null ? "" : String(goal).replace(".", ","));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setText(goal === null ? "" : String(goal).replace(".", ",")), [goal]);

  const commit = () => {
    if (!text.trim()) {
      setInvalid(false);
      onChange(null);
      return;
    }
    const v = parseAmount(text);
    setInvalid(v === null);
    if (v !== null) onChange(v);
  };

  const ratio = summary.goal ? Math.max(0, Math.min(1, summary.balance / summary.goal)) : 0;

  return (
    <div>
      <label className="label" htmlFor="goal">
        épargne visée chaque mois (€)
      </label>
      <div className="flex gap-2">
        <input
          id="goal"
          className="field"
          inputMode="decimal"
          placeholder="ex. 50"
          value={text}
          aria-invalid={invalid}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
      </div>
      {invalid && <p className="mt-1 text-[11px] font-bold">Montant invalide.</p>}
      {summary.goal !== null && (
        <div className="mt-4">
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-4 w-full border border-ink" aria-hidden>
            <rect x="0" y="0" height="10" width={ratio * 100} className="fill-foreground" />
          </svg>
          <p className="mt-2 text-[12px]" data-testid="goal-status">
            {summary.goalReached ? (
              <strong>Objectif tenu : {formatEuro(summary.goal)} mis de côté.</strong>
            ) : summary.balance > 0 ? (
              <>
                {formatEuro(summary.balance)} sur {formatEuro(summary.goal)} — il manque <strong>{formatEuro(summary.goal - summary.balance)}</strong>.
              </>
            ) : (
              <>Objectif hors de portée ce mois-ci.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
