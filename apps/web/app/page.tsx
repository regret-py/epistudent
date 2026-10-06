"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, cn } from "@studybuddy/ui";
import { BoxLogo } from "@/components/box-logo";
import { MoneyInput } from "@/components/money-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Section } from "@/components/ui";
import { DAYS_PER_MONTH, WEEKS_PER_MONTH, buildPlan, checkAmount, clampShare, euro, planToText, withShares, type PlanLine } from "@/lib/plan";
import { useSaved } from "@/lib/use-saved";

const FIELDS = [
  { key: "budget", label: "budget du mois" },
  { key: "savings", label: "épargne voulue" },
  { key: "rent", label: "loyer & fixes" },
] as const;

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

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function PlanPage() {
  const { saved, setSaved, loaded, reset } = useSaved();
  const [customizing, setCustomizing] = useState(false);
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [announce, setAnnounce] = useState("");

  const checks = useMemo(
    () => ({ budget: checkAmount(saved.budget), savings: checkAmount(saved.savings), rent: checkAmount(saved.rent) }),
    [saved.budget, saved.savings, saved.rent],
  );
  const invalid = FIELDS.filter((f) => checks[f.key].error !== null);
  const input = { budget: checks.budget.value ?? 0, savings: checks.savings.value ?? 0, rent: checks.rent.value ?? 0 };
  const categories = useMemo(() => withShares(saved.shares), [saved.shares]);
  const plan = useMemo(() => buildPlan(input, categories), [input.budget, input.savings, input.rent, categories]); // eslint-disable-line react-hooks/exhaustive-deps
  const customized = Object.keys(saved.shares).length > 0;
  const noShare = !plan.ok && plan.reason === "no-share";
  // a wrong field must never be silently counted as 0
  const showPlan = plan.ok && invalid.length === 0;
  const editable = invalid.length === 0 && (plan.ok || noShare);
  const hasInput = Boolean(saved.budget || saved.savings || saved.rent || customized);

  // one short, debounced announcement instead of a live region over the whole result
  useEffect(() => {
    const text = !loaded
      ? ""
      : invalid.length
        ? `Montant à corriger : ${invalid.map((f) => f.label).join(", ")}.`
        : showPlan && plan.ok
          ? `À dépenser : ${euro(plan.spendable)} par mois. Bouffe : ${euro(plan.lines[0]!.month)} par mois, soit ${euro(plan.lines[0]!.week)} par semaine.`
          : !plan.ok && plan.reason === "too-much"
            ? `Ton épargne et tes fixes dépassent ton budget de ${euro(plan.missing)}.`
            : "";
    const t = setTimeout(() => setAnnounce(text), 700);
    return () => clearTimeout(t);
  }, [loaded, invalid.length, showPlan, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 4000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  const set = (field: "budget" | "savings" | "rent") => (v: string) => setSaved((s) => ({ ...s, [field]: v }));
  const setShare = (key: string, v: number) => setSaved((s) => ({ ...s, shares: { ...s.shares, [key]: clampShare(v) } }));
  const resetShares = () => setSaved((s) => ({ ...s, shares: {} }));

  async function copy() {
    if (!plan.ok) return;
    try {
      await navigator.clipboard.writeText(planToText(input, plan));
      setCopied("ok");
      setAnnounce("Budget copié.");
    } catch {
      setCopied("error");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  function doReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setCustomizing(false);
    reset();
    document.getElementById("budget")?.focus();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b-2 border-ink">
        <div className="container flex items-center justify-between gap-4 py-3">
          <a href="/" aria-label="epistudent, accueil" className="py-1">
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

        <div className="mt-10 grid gap-px border-2 border-ink bg-ink sm:grid-cols-3">
          <MoneyInput id="budget" label="budget du mois" hint="tout ce qui rentre : bourse, APL, job, parents" placeholder="900" value={saved.budget} onChange={set("budget")} />
          <MoneyInput id="savings" label="épargne voulue" hint="ce que tu veux mettre de côté" placeholder="100" value={saved.savings} onChange={set("savings")} />
          <MoneyInput id="rent" label="loyer & fixes" hint="optionnel : loyer, charges, assurance" placeholder="0" value={saved.rent} onChange={set("rent")} />
        </div>

        <p className="sr-only" role="status" aria-atomic="true">
          {announce}
        </p>

        <div className="mt-px">
          {!loaded ? null : invalid.length > 0 ? (
            <Notice testId="invalid">Corrige {invalid.length > 1 ? "les montants" : "le montant"} : {invalid.map((f) => f.label).join(", ")}.</Notice>
          ) : showPlan && plan.ok ? (
            <Result lines={plan.lines} spendable={plan.spendable} savings={input.savings} savingsRate={plan.savingsRate} rent={input.rent} />
          ) : !plan.ok && plan.reason === "too-much" ? (
            <Notice testId="too-much" ink>
              Ton épargne et tes dépenses fixes dépassent ton budget de {euro(plan.missing)}. Baisse l&apos;épargne ou vérifie tes montants.
            </Notice>
          ) : !plan.ok && plan.reason === "nothing-left" ? (
            <Notice testId="nothing-left" ink>
              Il ne te reste rien à dépenser une fois l&apos;épargne{input.rent ? " et les fixes" : ""} mis{input.rent ? "" : "e"} de côté. Baisse un peu l&apos;épargne pour pouvoir manger.
            </Notice>
          ) : noShare ? (
            <Notice testId="no-share">
              Tous les pourcentages sont à 0.{" "}
              <button type="button" className="link font-bold underline" onClick={resetShares}>
                revenir à la répartition conseillée
              </button>
            </Notice>
          ) : (
            <p className="border-2 border-t-0 border-dashed border-ink px-4 py-3 text-muted-foreground">Entre ton budget du mois pour voir la répartition.</p>
          )}
        </div>

        {loaded && (editable || hasInput) && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {showPlan && (
              <Button size="sm" onClick={() => void copy()} data-testid="copy">
                {copied === "ok" ? "copié ✓" : copied === "error" ? "copie impossible" : "copier mon budget"}
              </Button>
            )}
            {editable && !noShare && (
              <Button size="sm" variant="outline" aria-expanded={customizing} aria-controls="repartition" onClick={() => setCustomizing((v) => !v)}>
                {customizing ? "fermer la répartition" : "changer la répartition"}
              </Button>
            )}
            {hasInput && (
              <Button size="sm" variant={confirmReset ? "default" : "outline"} onClick={doReset} data-testid="reset">
                {confirmReset ? "sûr ? tout effacer" : "tout effacer"}
              </Button>
            )}
          </div>
        )}

        {editable && (customizing || noShare) && (
          <Section title="répartition" id="repartition" aside={customized ? "personnalisée" : "conseillée"} className="mt-8">
            <p className="mb-4 text-muted-foreground">Le poids de chaque poste, en %. Le total n&apos;a pas besoin de faire 100 : on recalcule les proportions.</p>
            <div className="grid gap-x-8 sm:grid-cols-2" data-testid="shares">
              {categories.map((c) => (
                <ShareInput
                  key={c.key}
                  label={c.label}
                  value={c.share}
                  amount={plan.ok ? plan.lines.find((l) => l.key === c.key)?.month ?? 0 : 0}
                  onChange={(v) => setShare(c.key, v)}
                />
              ))}
            </div>
            {customized && (
              <Button size="sm" variant="outline" className="mt-4" onClick={resetShares}>
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

function Notice({ children, ink, testId }: { children: React.ReactNode; ink?: boolean; testId: string }) {
  return (
    <p className={cn("border-2 border-t-0 border-ink px-4 py-3 font-bold", ink && "bg-ink text-paper")} data-testid={testId}>
      {children}
    </p>
  );
}

/** Amount sized from its own cell width (container units) and its length, so it never overflows. */
function Amount({ value, testId, prefix = "" }: { value: number; testId?: string; prefix?: string }) {
  const text = `${prefix}${euro(value)}`;
  const fit = text.length <= 5 ? "fit-5" : text.length <= 7 ? "fit-7" : text.length <= 9 ? "fit-9" : text.length <= 11 ? "fit-11" : text.length <= 13 ? "fit-13" : "fit-99";
  return (
    <div className={cn("display tabular fitted whitespace-nowrap", fit)} data-testid={testId}>
      {text}
    </div>
  );
}

function Result({ lines, spendable, savings, savingsRate, rent }: { lines: PlanLine[]; spendable: number; savings: number; savingsRate: number; rent: number }) {
  return (
    <div className="border-2 border-t-0 border-ink">
      <div className="grid grid-cols-2 gap-px bg-ink lg:grid-cols-3">
        <div className="cell col-span-2 bg-ink p-4 text-paper sm:p-5 lg:col-span-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]">à dépenser</div>
          <div className="amount-xl mt-2">
            <Amount value={spendable} testId="spendable" />
          </div>
          <div className="mt-1 text-[11px] opacity-70">par mois, une fois l&apos;épargne{rent ? " et les fixes mis" : " mise"} de côté</div>
        </div>
        <div className="cell min-w-0 bg-background p-4 sm:p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]">épargne</div>
          <div className="amount-lg mt-2">
            <Amount value={savings} testId="savings" />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {savingsRate.toLocaleString("fr-FR")} % du budget{savings > 0 && savingsRate < 10 ? " · vise 10 % si tu peux" : ""}
          </div>
        </div>
        <div className="cell min-w-0 bg-background p-4 sm:p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]">par semaine</div>
          <div className="amount-lg mt-2">
            <Amount value={r2(spendable / WEEKS_PER_MONTH)} testId="per-week" />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{euro(r2(spendable / DAYS_PER_MONTH))} par jour, tout compris</div>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-px border-t-2 border-ink bg-ink lg:grid-cols-4" data-testid="lines">
        {lines.map((l, i) => (
          <li key={l.key} className={cn("cell flex min-h-[11rem] min-w-0 flex-col justify-between gap-3 p-4 sm:p-5", i === 0 ? "bg-ink text-paper" : "bg-background")} data-testid={`line-${l.key}`}>
            <div className="title-fluid display break-words">{l.label}</div>
            <div>
              <div className="amount-md">
                <Amount value={l.month} testId={`month-${l.key}`} />
              </div>
              <div className="tabular mt-1 text-[12px] leading-tight">
                <span className="whitespace-nowrap">
                  <strong data-testid={`week-${l.key}`}>{euro(l.week)}</strong> / semaine
                </span>{" "}
                · <span className="whitespace-nowrap">{euro(l.day)} / jour</span>
              </div>
              <ShareBar percent={l.percent} />
              <div className="mt-1.5 text-[11px] opacity-60">{l.hint}</div>
            </div>
          </li>
        ))}
        <li className="cell relative flex min-h-[11rem] min-w-0 flex-col justify-between overflow-hidden bg-background p-4 sm:p-5" data-testid="total">
          <div aria-hidden className="hatch absolute inset-0 opacity-[0.07]" />
          <span className="relative text-[10px] font-bold uppercase tracking-[0.2em]">total</span>
          <div className="relative">
            <div className="amount-md">
              <Amount value={spendable} prefix="= " />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">la somme des {lines.length} postes, au centime près</div>
          </div>
        </li>
      </ul>
    </div>
  );
}

/** Thin bar with the category's share of the spendable money. */
function ShareBar({ percent }: { percent: number }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="h-1.5 w-full border border-current" aria-hidden>
        <rect x="0" y="0" width={Math.min(100, percent)} height="4" className="fill-current" />
      </svg>
      <span className="tabular shrink-0 text-[11px]">{percent.toLocaleString("fr-FR")} %</span>
    </div>
  );
}

function ShareInput({ label, value, amount, onChange }: { label: string; value: number; amount: number; onChange: (v: number) => void }) {
  // local draft so "7," or "" can exist while typing; decimals are rounded, never concatenated
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const commit = (text: string) => {
    const n = Number.parseFloat(text.replace(",", "."));
    if (Number.isFinite(n)) onChange(clampShare(n));
  };
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2">
      <div className="min-w-0">
        <div className="font-bold">{label}</div>
        <div className="tabular text-[11px] text-muted-foreground">{euro(amount)} / mois</div>
      </div>
      <div className="flex items-center">
        <button type="button" aria-label={`réduire la part « ${label} »`} className="size-10 border border-ink text-[18px] invert-hover" onClick={() => onChange(clampShare(value - 1))}>
          −
        </button>
        <input
          ref={ref}
          aria-label={`part « ${label} » en pourcentage`}
          inputMode="decimal"
          className="tabular -mx-px h-10 w-16 border border-ink bg-background text-center text-[15px] font-bold outline-none focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          value={draft ?? String(value)}
          onChange={(e) => {
            const text = e.target.value.slice(0, 6);
            if (!/^\d*([.,]\d*)?$/.test(text)) return;
            setDraft(text);
            if (text !== "" && !/[.,]$/.test(text)) commit(text);
          }}
          onBlur={() => {
            if (draft !== null && draft !== "") commit(draft);
            setDraft(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && ref.current?.blur()}
        />
        <button type="button" aria-label={`augmenter la part « ${label} »`} className="size-10 border border-ink text-[18px] invert-hover" onClick={() => onChange(clampShare(value + 1))}>
          +
        </button>
        <span className="ml-1.5 text-[12px]" aria-hidden>
          %
        </span>
      </div>
    </div>
  );
}
