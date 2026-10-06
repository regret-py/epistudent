"use client";

import { useMemo, useState } from "react";
import { Button, cn } from "@studybuddy/ui";
import { BoxLogo } from "@/components/box-logo";
import { MoneyInput } from "@/components/money-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Section } from "@/components/ui";
import { MAX_SHARE, buildPlan, euro, parseEuros, planToText, withShares, type PlanLine } from "@/lib/plan";
import { useSaved } from "@/lib/use-saved";

const FAQ = [
  {
    q: "Comment est calculé mon budget bouffe ?",
    a: "On enlève de ton budget du mois ce que tu veux épargner et tes dépenses fixes (loyer, charges). Ce qui reste est réparti par poste : 40 % pour la bouffe, 15 % pour les sorties, 12 % pour le transport, etc. Tu peux changer chaque pourcentage.",
  },
  {
    q: "Combien mettre de côté chaque mois quand on est étudiant ?",
    a: "Une règle simple : viser 10 % de ce qui rentre. Même 20 ou 30 € par mois font un matelas pour les imprévus. Si c'est trop serré, commence petit et augmente quand tu peux.",
  },
  {
    q: "Pourquoi un montant par semaine et par jour ?",
    a: "Un budget mensuel est difficile à suivre. Savoir que tu as 37 € par semaine pour manger, c'est beaucoup plus concret quand tu fais tes courses.",
  },
  {
    q: "Mes chiffres sont-ils envoyés quelque part ?",
    a: "Non. Il n'y a ni compte ni serveur : le calcul se fait dans ton navigateur et tes montants restent sur ton appareil.",
  },
];

export default function PlanPage() {
  const { saved, setSaved, loaded, reset } = useSaved();
  const [customizing, setCustomizing] = useState(false);
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);

  const input = useMemo(
    () => ({ budget: parseEuros(saved.budget) ?? 0, savings: parseEuros(saved.savings) ?? 0, rent: parseEuros(saved.rent) ?? 0 }),
    [saved.budget, saved.savings, saved.rent],
  );
  const categories = useMemo(() => withShares(saved.shares), [saved.shares]);
  const plan = useMemo(() => buildPlan(input, categories), [input, categories]);
  const customized = Object.keys(saved.shares).length > 0;

  const set = (field: "budget" | "savings" | "rent") => (v: string) => setSaved((s) => ({ ...s, [field]: v }));

  async function copy() {
    if (!plan.ok) return;
    try {
      await navigator.clipboard.writeText(planToText(input, plan));
      setCopied("ok");
    } catch {
      setCopied("error");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b-2 border-ink">
        <div className="container flex items-center justify-between gap-4 py-4">
          <a href="/" aria-label="epistudent, accueil">
            <BoxLogo className="text-[26px] sm:text-[32px]" />
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="container flex-1 pt-10">
        <h1 className="display text-[15vw] sm:text-[88px]">
          ton budget
          <br />
          du mois.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed">
          Mets ton budget et ce que tu veux mettre de côté. On te dit combien tu peux dépenser pour la bouffe, les sorties, le transport… par mois, par semaine et par jour.
        </p>

        <div className="mt-10 grid gap-px border-2 border-ink bg-ink sm:grid-cols-3" aria-label="tes montants">
          <MoneyInput id="budget" label="budget du mois" hint="tout ce qui rentre : bourse, APL, job, parents" placeholder="900" value={saved.budget} onChange={set("budget")} />
          <MoneyInput id="savings" label="épargne voulue" hint="ce que tu veux mettre de côté" placeholder="100" value={saved.savings} onChange={set("savings")} />
          <MoneyInput id="rent" label="loyer & fixes" hint="optionnel : loyer, charges, assurance" placeholder="0" value={saved.rent} onChange={set("rent")} />
        </div>

        <div className="mt-px" aria-live="polite">
          {!loaded ? null : plan.ok ? (
            <Result lines={plan.lines} spendable={plan.spendable} savings={input.savings} savingsRate={plan.savingsRate} rent={input.rent} />
          ) : plan.reason === "too-much" ? (
            <p className="border-2 border-t-0 border-ink bg-ink px-4 py-3 font-bold text-paper" role="status" data-testid="too-much">
              Ton épargne et tes dépenses fixes dépassent ton budget de {euro(plan.missing)}. Baisse l&apos;épargne ou vérifie tes montants.
            </p>
          ) : plan.reason === "no-share" ? (
            <p className="border-2 border-t-0 border-ink px-4 py-3 font-bold" role="status">
              Tous les pourcentages sont à 0 : remets au moins un poste.
            </p>
          ) : (
            <p className="border-2 border-t-0 border-dashed border-ink px-4 py-3 text-muted-foreground">Entre ton budget du mois pour voir la répartition.</p>
          )}
        </div>

        {plan.ok && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void copy()} data-testid="copy">
              {copied === "ok" ? "copié ✓" : copied === "error" ? "copie impossible" : "copier mon budget"}
            </Button>
            <Button size="sm" variant="outline" aria-expanded={customizing} onClick={() => setCustomizing((v) => !v)}>
              {customizing ? "fermer" : "changer la répartition"}
            </Button>
            <Button size="sm" variant="outline" onClick={reset}>
              tout effacer
            </Button>
          </div>
        )}

        {plan.ok && customizing && (
          <Section title="répartition" aside={customized ? "personnalisée" : "par défaut"} className="mt-8">
            <p className="mb-4 text-muted-foreground">Le poids de chaque poste, en %. Le total n&apos;a pas besoin de faire 100 : on recalcule les proportions.</p>
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2" data-testid="shares">
              {categories.map((c) => (
                <ShareInput
                  key={c.key}
                  label={c.label}
                  value={c.share}
                  onChange={(v) => setSaved((s) => ({ ...s, shares: { ...s.shares, [c.key]: v } }))}
                />
              ))}
            </div>
            {customized && (
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setSaved((s) => ({ ...s, shares: {} }))}>
                revenir à la répartition conseillée
              </Button>
            )}
          </Section>
        )}

        <Section title="questions" id="faq" className="mt-20">
          <dl className="divide-y divide-border border-b border-border">
            {FAQ.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="font-bold">{f.q}</dt>
                <dd className="mt-1 max-w-2xl text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
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
    </div>
  );
}

function Result({ lines, spendable, savings, savingsRate, rent }: { lines: PlanLine[]; spendable: number; savings: number; savingsRate: number; rent: number }) {
  return (
    <div className="border-2 border-t-0 border-ink">
      <div className="grid grid-cols-2 gap-px bg-ink sm:grid-cols-3">
        <div className="col-span-2 bg-ink p-4 text-paper sm:col-span-1 sm:p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]">à dépenser</div>
          <div className="display tabular mt-2 text-[40px] sm:text-[52px]" data-testid="spendable">
            {euro(spendable)}
          </div>
          <div className="mt-1 text-[11px] opacity-70">par mois, une fois l&apos;épargne{rent ? " et les fixes" : ""} mis de côté</div>
        </div>
        <div className="bg-background p-4 sm:p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]">épargne</div>
          <div className="display tabular mt-2 text-[28px] sm:text-[36px]" data-testid="savings">
            {euro(savings)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{savingsRate.toLocaleString("fr-FR")} % du budget{savings > 0 && savingsRate < 10 ? " · vise 10 % si tu peux" : ""}</div>
        </div>
        <div className="bg-background p-4 sm:p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]">par semaine</div>
          <div className="display tabular mt-2 text-[28px] sm:text-[36px]" data-testid="per-week">
            {euro(Math.round((spendable / (52 / 12)) * 100) / 100)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{euro(Math.round((spendable / (365 / 12)) * 100) / 100)} par jour, tout compris</div>
        </div>
      </div>

      <SplitBar lines={lines} />

      <ul className="grid grid-cols-2 gap-px bg-ink lg:grid-cols-4" data-testid="lines">
        {lines.map((l, i) => (
          <li key={l.key} className={cn("flex min-h-[10rem] flex-col justify-between p-4 sm:p-5", i === 0 ? "bg-ink text-paper" : "bg-background")} data-testid={`line-${l.key}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="display min-w-0 text-[18px] sm:text-[24px]">{l.label}</span>
              <span className="tabular shrink-0 pt-1 text-[11px] opacity-70">{l.percent.toLocaleString("fr-FR")} %</span>
            </div>
            <div>
              <div className="display tabular text-[30px] sm:text-[38px]" data-testid={`month-${l.key}`}>
                {euro(l.month)}
              </div>
              <div className="tabular mt-1 text-[12px]">
                <span className="font-bold" data-testid={`week-${l.key}`}>
                  {euro(l.week)}
                </span>{" "}
                / semaine · {euro(l.day)} / jour
              </div>
              <div className="mt-2 text-[11px] opacity-60">{l.hint}</div>
            </div>
          </li>
        ))}
        <li className="relative flex min-h-[10rem] flex-col justify-between overflow-hidden bg-background p-4 sm:p-5" data-testid="total">
          <div aria-hidden className="hatch absolute inset-0 opacity-[0.07]" />
          <span className="relative text-[10px] font-bold uppercase tracking-[0.2em]">total</span>
          <div className="relative">
            <div className="display tabular text-[30px] sm:text-[38px]">= {euro(spendable)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">la somme des {lines.length} postes, au centime près</div>
          </div>
        </li>
      </ul>
    </div>
  );
}

/** One horizontal bar showing the split, alternating ink / hatching / paper. */
function SplitBar({ lines }: { lines: PlanLine[] }) {
  let x = 0;
  const visible = lines.filter((l) => l.percent > 0);
  return (
    <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="block h-6 w-full border-y-2 border-ink" role="img" aria-label={visible.map((l) => `${l.label} ${l.percent} %`).join(", ")}>
      <defs>
        <pattern id="split-hatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="0.45" height="1.2" className="fill-foreground" />
        </pattern>
      </defs>
      {visible.map((l, i) => {
        const w = l.percent;
        const rect = (
          <g key={l.key}>
            <rect x={x} y="0" width={w} height="6" className={i % 3 === 0 ? "fill-foreground" : i % 3 === 2 ? "fill-background" : undefined} fill={i % 3 === 1 ? "url(#split-hatch)" : undefined} />
            <line x1={x + w} x2={x + w} y1="0" y2="6" className="stroke-foreground" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </g>
        );
        x += w;
        return rect;
      })}
    </svg>
  );
}

function ShareInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(MAX_SHARE, Math.max(0, Math.round(v)));
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-1.5">
      <span className="font-bold">{label}</span>
      <div className="flex items-center">
        <button type="button" aria-label={`moins de ${label}`} className="size-9 border border-ink text-[16px] invert-hover" onClick={() => onChange(clamp(value - 1))}>
          −
        </button>
        <input
          aria-label={`part ${label} en pourcentage`}
          inputMode="numeric"
          className="tabular -mx-px h-9 w-14 border border-ink bg-background text-center font-bold outline-none focus:bg-muted"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, "") || 0);
            onChange(clamp(n));
          }}
        />
        <button type="button" aria-label={`plus de ${label}`} className="size-9 border border-ink text-[16px] invert-hover" onClick={() => onChange(clamp(value + 1))}>
          +
        </button>
      </div>
    </div>
  );
}
