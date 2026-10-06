import { cn } from "@studybuddy/ui";
import { formatEuro, monthLabel, type HistoryPoint } from "@/lib/budget";

/** Six months, income vs expenses, as paired bars. Click a month to open it. */
export function History({ points, current, onSelect }: { points: HistoryPoint[]; current: string; onSelect: (month: string) => void }) {
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expenses]));
  const H = 120;
  const colW = 100 / points.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${H + 2}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="revenus et dépenses des six derniers mois">
        <defs>
          <pattern id="hist-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="1" height="3" className="fill-foreground" />
          </pattern>
        </defs>
        <line x1="0" x2="100" y1={H} y2={H} className="stroke-foreground" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          const x = i * colW;
          const bw = colW * 0.3;
          const hi = (p.income / max) * (H - 4);
          const he = (p.expenses / max) * (H - 4);
          return (
            <g key={p.month}>
              <rect x={x + colW * 0.17} y={H - hi} width={bw} height={hi} className="fill-foreground" />
              <rect x={x + colW * 0.17 + bw + colW * 0.06} y={H - he} width={bw} height={he} fill="url(#hist-hatch)" className="stroke-foreground" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
      <ol className="grid grid-cols-6" data-testid="history">
          {points.map((p) => (
            <li key={p.month}>
              <button
                type="button"
                onClick={() => onSelect(p.month)}
                aria-current={p.month === current ? "date" : undefined}
                aria-label={`${monthLabel(p.month)} : revenus ${formatEuro(p.income)}, dépenses ${formatEuro(p.expenses)}, solde ${formatEuro(p.balance)}`}
                className={cn("w-full py-1.5 text-center text-[10px] font-bold uppercase tracking-wider invert-hover", p.month === current && "bg-ink text-paper")}
              >
                {monthLabel(p.month, "short").replace(".", "")}
                <span className={cn("block font-normal normal-case tracking-normal tabular", p.balance < 0 && "underline decoration-2")}>
                  {p.balance >= 0 ? "+" : "−"}
                  {Math.abs(Math.round(p.balance))}
                </span>
              </button>
            </li>
          ))}
      </ol>
      <p className="mt-2 flex gap-4 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 bg-ink" /> revenus
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="hatch inline-block size-2.5 border border-ink" /> dépenses
        </span>
      </p>
    </div>
  );
}
