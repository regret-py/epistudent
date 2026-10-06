import { cn } from "@studybuddy/ui";
import { formatEuro, type Summary } from "@/lib/budget";

function Tile({ label, value, sub, tone = "paper", hatch, testId }: { label: string; value: string; sub?: string; tone?: "paper" | "ink"; hatch?: boolean; testId: string }) {
  return (
    <div className={cn("relative flex min-h-[7.5rem] flex-col justify-between p-4 sm:min-h-[9rem]", tone === "ink" ? "bg-ink text-paper" : "bg-background")}>
      {hatch && <div aria-hidden className={cn("absolute inset-0", tone === "ink" ? "hatch-paper" : "hatch opacity-25")} />}
      <div className="relative text-[10px] font-bold uppercase tracking-[0.2em]">{label}</div>
      <div className="relative">
        <div className="display tabular break-all text-[26px] sm:text-[40px]" data-testid={testId}>
          {value}
        </div>
        {sub && <div className="mt-1 text-[11px] opacity-70">{sub}</div>}
      </div>
    </div>
  );
}

export function Stats({ summary }: { summary: Summary }) {
  const negative = summary.balance < 0;
  return (
    <div className="grid grid-cols-2 gap-px border-2 border-ink bg-ink lg:grid-cols-4">
      <Tile label="revenus" value={formatEuro(summary.income)} testId="income" />
      <Tile label="dépenses" value={formatEuro(summary.expenses)} testId="expenses" />
      <Tile
        label={negative ? "à découvert" : "reste"}
        value={formatEuro(summary.balance)}
        tone="ink"
        hatch={negative}
        sub={summary.goal !== null ? `dont ${formatEuro(Math.max(0, Math.min(summary.balance, summary.goal)))} d'épargne` : undefined}
        testId="balance"
      />
      <Tile
        label={summary.perDayLeft === null ? "mois terminé" : "par jour"}
        value={summary.perDayLeft === null ? "—" : formatEuro(summary.perDayLeft)}
        sub={summary.perDayLeft === null ? undefined : `${summary.daysLeft} jour${summary.daysLeft > 1 ? "s" : ""} restant${summary.daysLeft > 1 ? "s" : ""}${summary.goal ? ", épargne déduite" : ""}`}
        testId="per-day"
      />
    </div>
  );
}
