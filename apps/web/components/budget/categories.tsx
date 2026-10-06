"use client";

import { useState } from "react";
import { cn } from "@studybuddy/ui";
import { EXPENSE_CATEGORIES, formatEuro, parseAmount, type CategoryLine, type ExpenseCategory } from "@/lib/budget";

/** Where the money goes, with optional monthly caps per category. */
export function Categories({
  lines,
  limits,
  onSetLimit,
}: {
  lines: CategoryLine[];
  limits: Partial<Record<ExpenseCategory, number>>;
  onSetLimit: (category: ExpenseCategory, value: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const max = Math.max(1, ...lines.map((l) => Math.max(l.amount, l.limit ?? 0)));

  return (
    <div>
      {lines.length === 0 ? (
        <p className="text-muted-foreground">Aucune dépense ce mois-ci.</p>
      ) : (
        <ul className="space-y-3" data-testid="categories">
          {lines.map((l, i) => (
            <li key={l.category}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                <span className="font-bold uppercase tracking-wider">{l.category}</span>
                <span className="tabular">
                  {formatEuro(l.amount)}
                  {l.limit !== null && <span className="text-muted-foreground"> / {formatEuro(l.limit)}</span>}
                  {l.over && (
                    <span className="ml-2 bg-ink px-1 text-[10px] font-bold uppercase text-paper" data-testid={`over-${l.category}`}>
                      dépassé
                    </span>
                  )}
                </span>
              </div>
              <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-3 w-full border border-ink" aria-hidden>
                <defs>
                  <pattern id={`cat-hatch-${i}`} width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="0.8" height="2" className="fill-foreground" />
                  </pattern>
                </defs>
                <rect x="0" y="0" height="10" width={Math.min(100, (l.amount / max) * 100)} className={cn(!l.over && "fill-foreground")} fill={l.over ? `url(#cat-hatch-${i})` : undefined} />
                {l.limit !== null && <line x1={(l.limit / max) * 100} x2={(l.limit / max) * 100} y1="0" y2="10" className="stroke-foreground" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
              </svg>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="link mt-4 text-[11px] lowercase" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
        {editing ? "fermer les plafonds" : "fixer des plafonds par catégorie"}
      </button>
      {editing && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4" data-testid="limits">
          {EXPENSE_CATEGORIES.map((c) => (
            <LimitInput key={c} category={c} value={limits[c] ?? null} onChange={(v) => onSetLimit(c, v)} />
          ))}
        </div>
      )}
    </div>
  );
}

function LimitInput({ category, value, onChange }: { category: ExpenseCategory; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : String(value).replace(".", ","));
  const [invalid, setInvalid] = useState(false);
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
  return (
    <label className="block">
      <span className="label">{category}</span>
      <input
        className={cn("field h-9", invalid && "border-2")}
        inputMode="decimal"
        placeholder="aucun"
        value={text}
        aria-invalid={invalid}
        aria-label={`plafond ${category}`}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </label>
  );
}
