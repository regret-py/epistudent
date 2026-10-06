"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@studybuddy/ui";
import { Chip, ErrorText, Field } from "@/components/ui";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, LIMITS, parseAmount, type Entry, type Kind } from "@/lib/budget";

const QUICK = [
  { kind: "income", label: "Bourse CROUS", category: "bourse", recurring: true },
  { kind: "income", label: "APL", category: "apl", recurring: true },
  { kind: "income", label: "Job étudiant", category: "job", recurring: true },
  { kind: "expense", label: "Loyer", category: "loyer", recurring: true },
  { kind: "expense", label: "Transports", category: "transport", recurring: true },
  { kind: "expense", label: "Forfait téléphone", category: "abonnements", recurring: true },
  { kind: "expense", label: "Courses", category: "courses", recurring: false },
  { kind: "expense", label: "Sortie", category: "sorties", recurring: false },
] as const;

const defaultCategory = (kind: Kind) => (kind === "income" ? "bourse" : "courses");

export function EntryForm({
  month,
  editing,
  onSubmit,
  onCancelEdit,
}: {
  month: string;
  editing: Entry | null;
  onSubmit: (entry: Omit<Entry, "id">) => void;
  onCancelEdit: () => void;
}) {
  const [kind, setKind] = useState<Kind>("expense");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("courses");
  const [recurring, setRecurring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);

  // load the entry being edited
  useEffect(() => {
    if (!editing) return;
    setKind(editing.kind);
    setLabel(editing.label);
    setAmount(String(editing.amount).replace(".", ","));
    setCategory(editing.category);
    setRecurring(editing.recurring);
    setError(null);
    labelInput.current?.focus();
  }, [editing]);

  function reset(nextKind: Kind = kind) {
    setLabel("");
    setAmount("");
    setRecurring(false);
    setCategory(defaultCategory(nextKind));
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = label.replace(/\s+/g, " ").trim();
    const value = parseAmount(amount);
    if (!name) return setError("Donne un nom à la ligne.");
    if (value === null) return setError(`Montant invalide (entre 0,01 € et ${LIMITS.amount.toLocaleString("fr-FR")} €, deux décimales max).`);
    onSubmit({
      kind,
      label: name.slice(0, LIMITS.label),
      amount: value,
      category,
      // editing keeps the original start month so a recurring line doesn't jump
      month: editing ? editing.month : month,
      recurring,
      ...(editing?.endMonth && recurring ? { endMonth: editing.endMonth } : {}),
    });
    reset();
    labelInput.current?.focus();
  }

  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div>
      {!editing && (
        <div className="mb-5 flex flex-wrap gap-1.5" aria-label="ajouts rapides">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                setKind(q.kind);
                setLabel(q.label);
                setCategory(q.category);
                setRecurring(q.recurring);
                setError(null);
                amountInput.current?.focus();
              }}
              className="border border-dashed border-ink px-2.5 py-1 text-[11px] lowercase invert-hover"
            >
              + {q.label.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate aria-label={editing ? "modifier la ligne" : "ajouter une ligne"}>
        <div className="flex" role="group" aria-label="type">
          <Chip
            active={kind === "expense"}
            className="flex-1"
            onClick={() => {
              setKind("expense");
              setCategory(defaultCategory("expense"));
            }}
          >
            dépense
          </Chip>
          <Chip
            active={kind === "income"}
            className="-ml-px flex-1"
            onClick={() => {
              setKind("income");
              setCategory(defaultCategory("income"));
            }}
          >
            revenu
          </Chip>
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field label="Nom" htmlFor="label">
            <input
              id="label"
              ref={labelInput}
              className="field"
              value={label}
              maxLength={LIMITS.label}
              autoComplete="off"
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Kebab du jeudi"
            />
          </Field>
          <Field label="Montant (€)" htmlFor="amount">
            <input id="amount" ref={amountInput} className="field tabular" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="8,50" />
          </Field>
        </div>
        <Field label="Catégorie" htmlFor="category">
          <select id="category" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="size-4 accent-[hsl(var(--ink))]" />
          <span>
            Tous les mois <span className="text-muted-foreground">(loyer, bourse, abonnements…)</span>
          </span>
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1 sm:flex-none">
            {editing ? "enregistrer" : "ajouter"}
          </Button>
          {editing && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => {
                reset();
                onCancelEdit();
              }}
            >
              annuler
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
