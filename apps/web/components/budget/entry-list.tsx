"use client";

import { cn } from "@studybuddy/ui";
import { formatEuro, monthLabel, type Entry } from "@/lib/budget";

export function EntryList({
  entries,
  month,
  editingId,
  onEdit,
  onDelete,
}: {
  entries: Entry[];
  month: string;
  editingId: string | null;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
}) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground">Rien pour ce mois. Commence par ta bourse et ton loyer avec les ajouts rapides.</p>;
  }
  const incomes = entries.filter((e) => e.kind === "income").sort((a, b) => b.amount - a.amount);
  const expenses = entries.filter((e) => e.kind === "expense").sort((a, b) => b.amount - a.amount);

  return (
    <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2" data-testid="entries">
      {[
        { title: "revenus", list: incomes },
        { title: "dépenses", list: expenses },
      ].map(({ title, list }) => (
        <div key={title}>
          <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {title} · {list.length}
          </h3>
          {list.length === 0 ? (
            <p className="border-t border-ink py-3 text-[12px] text-muted-foreground">—</p>
          ) : (
            <ul className="border-t border-ink">
              {list.map((e) => (
                <li key={e.id} className={cn("group flex items-center justify-between gap-3 border-b py-2.5", editingId === e.id && "bg-muted")}>
                  <div className="min-w-0">
                    <div className="truncate font-bold">{e.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {e.category}
                      {e.recurring && (
                        <>
                          {" · "}
                          <span className="border border-current px-1 text-[9px] font-bold uppercase tracking-wider">mensuel</span>
                          {e.endMonth && ` jusqu'en ${monthLabel(e.endMonth)}`}
                          {e.month !== month && ` depuis ${monthLabel(e.month)}`}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular font-bold">
                      {e.kind === "income" ? "+" : "−"}
                      {formatEuro(e.amount)}
                    </span>
                    <span className="flex gap-2 text-[11px]">
                      <button type="button" className="link" aria-label={`modifier ${e.label}`} onClick={() => onEdit(e)}>
                        modifier
                      </button>
                      <button type="button" className="link" aria-label={`supprimer ${e.label}`} onClick={() => onDelete(e)}>
                        suppr.
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
