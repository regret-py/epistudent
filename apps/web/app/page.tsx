"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@studybuddy/ui";
import { BoxLogo } from "@/components/box-logo";
import { Categories } from "@/components/budget/categories";
import { DataPanel } from "@/components/budget/data-panel";
import { EntryForm } from "@/components/budget/entry-form";
import { EntryList } from "@/components/budget/entry-list";
import { Goal } from "@/components/budget/goal";
import { History } from "@/components/budget/history";
import { LockScreen } from "@/components/budget/lock-screen";
import { Stats } from "@/components/budget/stats";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConfirmDialog, Section } from "@/components/ui";
import { entriesForMonth, formatEuro, history, monthKey, monthLabel, shiftMonth, summarize, type Entry } from "@/lib/budget";
import { useBudget } from "@/lib/use-budget";

type Undo = { entries: Entry[]; message: string };

export default function BudgetPage() {
  const budget = useBudget();
  const { state } = budget;
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [editing, setEditing] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);

  const summary = useMemo(() => summarize(state, month), [state, month]);
  const list = useMemo(() => entriesForMonth(state.entries, month), [state.entries, month]);
  const points = useMemo(() => history(state.entries, month), [state.entries, month]);

  // ←/→ to change month, unless typing or in a dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || !t || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.closest("dialog")) return;
      if (e.key === "ArrowLeft") setMonth((m) => shiftMonth(m, -1));
      if (e.key === "ArrowRight") setMonth((m) => shiftMonth(m, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  // leaving the month (or locking) cancels a pending edit
  useEffect(() => setEditing(null), [month, budget.status]);

  const removeWithUndo = useCallback(
    (apply: () => void, message: string) => {
      setUndo({ entries: state.entries, message });
      apply();
      if (editing && deleting && editing.id === deleting.id) setEditing(null);
      setDeleting(null);
    },
    [state.entries, editing, deleting],
  );

  if (budget.status === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <BoxLogo className="text-5xl opacity-90" />
      </div>
    );
  }

  if (budget.status === "locked") {
    return <LockScreen onUnlock={budget.unlock} onWipe={budget.wipe} />;
  }

  const current = monthKey(new Date());

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b-2 border-ink">
        <div className="container flex items-center justify-between gap-4 py-4">
          <a href="/" aria-label="epistudent, accueil">
            <BoxLogo className="text-[26px] sm:text-[32px]" />
          </a>
          <nav className="flex items-center gap-4 text-[11px] lowercase" aria-label="raccourcis">
            <a className="link hidden sm:inline" href="#ajouter">
              ajouter
            </a>
            <a className="link hidden sm:inline" href="#donnees">
              données
            </a>
            {budget.encrypted && (
              <button type="button" className="link" onClick={budget.lock} data-testid="lock-now">
                verrouiller
              </button>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="container flex-1 pt-8">
        {/* month */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em]">budget du mois</p>
            <h1 className="display mt-1 text-[13vw] first-letter:uppercase sm:text-7xl" data-testid="month" aria-live="polite">
              {monthLabel(month)}
            </h1>
          </div>
          <div className="flex" role="group" aria-label="changer de mois">
            <Button size="sm" variant="outline" aria-label="mois précédent" onClick={() => setMonth(shiftMonth(month, -1))}>
              ←
            </Button>
            <Button size="sm" variant={month === current ? "default" : "outline"} className="-ml-px" onClick={() => setMonth(current)}>
              aujourd&apos;hui
            </Button>
            <Button size="sm" variant="outline" className="-ml-px" aria-label="mois suivant" onClick={() => setMonth(shiftMonth(month, 1))}>
              →
            </Button>
          </div>
        </div>

        <Stats summary={summary} />
        {summary.balance < 0 ? (
          <p className="mt-px border-2 border-t-0 border-ink bg-ink px-4 py-2 font-bold text-paper" role="status">
            Dans le rouge de {formatEuro(-summary.balance)} ce mois-ci.
          </p>
        ) : (
          summary.byCategory.some((c) => c.over) && (
            <p className="border-2 border-t-0 border-ink px-4 py-2 font-bold" role="status">
              Plafond dépassé : {summary.byCategory.filter((c) => c.over).map((c) => c.category).join(", ")}.
            </p>
          )
        )}

        <div className="mt-14 grid gap-x-12 lg:grid-cols-[1.1fr_1fr]">
          <Section title={editing ? "modifier" : "ajouter"} id="ajouter" aside={editing?.recurring ? "modifie tous les mois de cette ligne" : undefined}>
            <EntryForm
              month={month}
              editing={editing}
              onCancelEdit={() => setEditing(null)}
              onSubmit={(entry) => {
                if (editing) {
                  budget.updateEntry(editing.id, entry);
                  setEditing(null);
                } else budget.add(entry);
              }}
            />
          </Section>

          <div>
            <Section title="où part l'argent" id="categories">
              <Categories lines={summary.byCategory} limits={state.limits} onSetLimit={budget.setLimit} />
            </Section>
            <Section title="épargne" id="epargne">
              <Goal summary={summary} goal={state.goal} onChange={budget.setGoal} />
            </Section>
          </div>
        </div>

        <Section title="lignes du mois" id="lignes" aside={`${list.length}`}>
          <EntryList entries={list} month={month} editingId={editing?.id ?? null} onEdit={setEditing} onDelete={setDeleting} />
        </Section>

        <Section title="six derniers mois" id="historique">
          <History points={points} current={month} onSelect={setMonth} />
        </Section>

        <Section title="sécurité & données" id="donnees">
          <DataPanel
            encrypted={budget.encrypted}
            entriesCount={state.entries.length}
            onEnableLock={budget.enableLock}
            onDisableLock={budget.disableLock}
            onLock={budget.lock}
            onExport={budget.exportData}
            onReplace={budget.replace}
            onWipe={budget.wipe}
          />
        </Section>
      </main>

      <footer className="border-t-2 border-ink">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[11px] lowercase">
          <span>
            <strong className="font-display font-black italic">epistudent</strong> — fait par des étudiants, pour les étudiants.
          </span>
          <span className="text-muted-foreground">aucun compte · aucun serveur · aucun traceur</span>
        </div>
      </footer>

      {undo && (
        <div role="status" className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center justify-between gap-4 border-2 border-ink bg-ink px-4 py-3 text-paper sm:inset-x-auto sm:right-6">
          <span className="text-[12px]">{undo.message}</span>
          <button
            type="button"
            className="text-[11px] font-bold uppercase tracking-[0.15em] underline underline-offset-4"
            onClick={() => {
              budget.restore(undo.entries);
              setUndo(null);
            }}
          >
            annuler
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.recurring ? "ligne mensuelle" : "supprimer"}
        confirmLabel={deleting?.recurring && deleting.month < month ? "à partir de ce mois" : "supprimer"}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          if (deleting.recurring && deleting.month < month) {
            removeWithUndo(() => budget.stopFrom(deleting.id, month), `« ${deleting.label} » arrêté à partir de ${monthLabel(month)}.`);
          } else {
            removeWithUndo(() => budget.remove(deleting.id), `« ${deleting.label} » supprimé.`);
          }
        }}
      >
        {deleting?.recurring && deleting.month < month ? (
          <>
            <p>
              « {deleting.label} » revient chaque mois depuis {monthLabel(deleting.month)}. L&apos;arrêter à partir de {monthLabel(month)} garde l&apos;historique des mois passés.
            </p>
            <button
              type="button"
              className="link text-[12px] font-bold"
              onClick={() => removeWithUndo(() => budget.remove(deleting.id), `« ${deleting.label} » supprimé de tous les mois.`)}
            >
              ou le supprimer de tous les mois
            </button>
          </>
        ) : (
          <p>Supprimer « {deleting?.label} » ?</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
