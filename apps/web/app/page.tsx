"use client";

import { useMemo, useRef, useState } from "react";
import { Button, cn } from "@studybuddy/ui";
import { BoxLogo } from "@/components/box-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Chip, ErrorText, Field, Section } from "@/components/ui";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  entriesForMonth,
  formatEuro,
  monthKey,
  parseState,
  shiftMonth,
  summarize,
  type Kind,
} from "@/lib/budget";
import { useBudget } from "@/lib/use-budget";

const QUICK = [
  { kind: "income", label: "Bourse CROUS", category: "bourse", recurring: true },
  { kind: "income", label: "APL", category: "apl", recurring: true },
  { kind: "expense", label: "Loyer", category: "loyer", recurring: true },
  { kind: "expense", label: "Pass Navigo / transports", category: "transport", recurring: true },
  { kind: "expense", label: "Forfait téléphone", category: "abonnements", recurring: true },
  { kind: "expense", label: "Courses", category: "courses", recurring: false },
] as const;

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export default function BudgetPage() {
  const { state, loaded, add, remove, replace } = useBudget();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [kind, setKind] = useState<Kind>("expense");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("courses");
  const [recurring, setRecurring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => summarize(state.entries, month), [state.entries, month]);
  const list = useMemo(
    () => entriesForMonth(state.entries, month).sort((a, b) => (a.kind === b.kind ? b.amount - a.amount : a.kind === "income" ? -1 : 1)),
    [state.entries, month],
  );
  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!label.trim()) return setError("Donne un nom à la ligne.");
    if (!Number.isFinite(value) || value <= 0) return setError("Montant invalide.");
    setError(null);
    add({ kind, label: label.trim(), amount: Math.round(value * 100) / 100, category, month, recurring });
    // back to a plain one-off line so a quick-add (rent…) doesn't leak into the next entry
    setLabel("");
    setAmount("");
    setRecurring(false);
    setCategory(kind === "income" ? "bourse" : "courses");
  }

  function prefill(q: (typeof QUICK)[number]) {
    setKind(q.kind);
    setLabel(q.label);
    setCategory(q.category);
    setRecurring(q.recurring);
    amountInput.current?.focus();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-epistudent-${monthKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    try {
      const next = parseState(JSON.parse(await file.text()));
      if (window.confirm(`Remplacer ton budget actuel par ce fichier (${next.entries.length} lignes) ?`)) replace(next);
    } catch {
      setError("Fichier illisible.");
    }
  }

  const negative = summary.balance < 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container flex items-start justify-between gap-4 pb-3 pt-5">
        <BoxLogo className="text-[28px] sm:text-[34px]" />
        <ThemeToggle />
      </header>

      <main className="container flex-1 pt-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-foreground pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em]">budget du mois</p>
            <h1 className="font-display text-4xl font-black italic first-letter:uppercase sm:text-6xl" data-testid="month">
              {monthLabel(month)}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" aria-label="mois précédent" onClick={() => setMonth(shiftMonth(month, -1))}>
              ←
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMonth(monthKey(new Date()))}>
              ce mois
            </Button>
            <Button size="sm" variant="outline" aria-label="mois suivant" onClick={() => setMonth(shiftMonth(month, 1))}>
              →
            </Button>
          </div>
        </div>

        {/* the big numbers */}
        <div className="mb-10 grid grid-cols-2 gap-px border border-foreground bg-foreground lg:grid-cols-4">
          <Stat label="revenus" value={formatEuro(summary.income)} testId="income" />
          <Stat label="dépenses" value={formatEuro(summary.expenses)} testId="expenses" />
          <Stat label="reste" value={formatEuro(summary.balance)} tone={negative ? "red" : "ink"} testId="balance" />
          <Stat
            label={summary.perDayLeft === null ? "mois terminé" : `par jour · ${summary.daysLeft} j restants`}
            value={summary.perDayLeft === null ? "—" : formatEuro(summary.perDayLeft)}
            tone="red"
            testId="per-day"
          />
        </div>
        {negative && (
          <p className="-mt-6 mb-10 bg-primary px-3 py-2 font-bold text-white" role="status">
            Tu es dans le rouge de {formatEuro(-summary.balance)} ce mois-ci.
          </p>
        )}

        <div className="grid gap-x-10 lg:grid-cols-2">
          <Section title="ajouter">
            <div className="mb-4 flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button key={q.label} type="button" onClick={() => prefill(q)} className="border border-dashed border-foreground px-2 py-1 text-[11px] hover:bg-ink hover:text-paper">
                  + {q.label.toLowerCase()}
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="flex gap-2">
                <Chip active={kind === "expense"} onClick={() => { setKind("expense"); setCategory("courses"); }}>
                  dépense
                </Chip>
                <Chip active={kind === "income"} onClick={() => { setKind("income"); setCategory("bourse"); }}>
                  revenu
                </Chip>
              </div>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <Field label="Nom" htmlFor="label">
                  <input id="label" className="field" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="Kebab du jeudi" />
                </Field>
                <Field label="Montant (€)" htmlFor="amount">
                  <input id="amount" ref={amountInput} className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="8,50" />
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
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
                <span>Tous les mois <span className="text-muted-foreground">(loyer, bourse, abonnements…)</span></span>
              </label>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" variant="red" size="lg" className="w-full sm:w-auto">
                ajouter
              </Button>
            </form>
          </Section>

          <Section title="où part l'argent">
            {summary.byCategory.length === 0 ? (
              <p className="text-muted-foreground">Aucune dépense ce mois-ci.</p>
            ) : (
              <ul className="space-y-2" data-testid="categories">
                {summary.byCategory.map((c) => (
                  <li key={c.category} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-[12px]">
                    <span className="font-bold">{c.category}</span>
                    <div className="h-5 border border-foreground">
                      <div className="h-full bg-primary" style={{ width: `${Math.max(2, c.share * 100)}%` }} />
                    </div>
                    <span className="w-20 text-right tabular-nums">{formatEuro(c.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title={`lignes · ${list.length}`}>
          {!loaded ? null : list.length === 0 ? (
            <p className="text-muted-foreground">Rien pour ce mois. Commence par ta bourse et ton loyer avec les boutons rapides.</p>
          ) : (
            <ul className="divide-y border-b" data-testid="entries">
              {list.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <span className="font-bold">{e.label}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {e.category}
                      {e.recurring && " · tous les mois"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("tabular-nums font-bold", e.kind === "income" ? "" : "text-primary")}>
                      {e.kind === "income" ? "+" : "−"}
                      {formatEuro(e.amount)}
                    </span>
                    <button
                      type="button"
                      aria-label={`supprimer ${e.label}`}
                      className="link text-[11px]"
                      onClick={() => {
                        if (!e.recurring || window.confirm("Ligne mensuelle : la supprimer de tous les mois ?")) remove(e.id);
                      }}
                    >
                      supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="mes données">
          <p className="mb-3 text-muted-foreground">
            Pas de compte, pas de serveur : ton budget reste dans ce navigateur. Exporte-le pour le sauvegarder ou le passer sur un autre appareil.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportJson}>
              exporter
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              importer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm("Tout effacer ? C'est définitif.")) replace({ version: 1, entries: [] });
              }}
            >
              tout effacer
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = "";
              }}
            />
          </div>
        </Section>
      </main>

      <footer className="container mt-6 pb-[env(safe-area-inset-bottom)]">
        <div className="flex flex-wrap justify-between gap-3 border-t border-foreground py-4 text-[11px] lowercase text-muted-foreground">
          <span>© {new Date().getFullYear()} epistudent — fait par des étudiants, pour les étudiants.</span>
          <ThemeToggle />
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value, tone = "paper", testId }: { label: string; value: string; tone?: "paper" | "ink" | "red"; testId: string }) {
  return (
    <div className={cn("p-4", tone === "red" ? "bg-primary text-white" : tone === "ink" ? "bg-ink text-paper" : "bg-background")}>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</div>
      <div className="mt-1 font-display text-2xl font-black italic tabular-nums sm:text-4xl" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}
