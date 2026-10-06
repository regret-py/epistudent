"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, cn } from "@studybuddy/ui";
import { BoxLogo } from "@/components/box-logo";
import { MoneyInput } from "@/components/money-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Section } from "@/components/ui";
import {
  DAYS_PER_MONTH,
  MEAL_PRICE,
  PROFILES,
  WEEKS_PER_MONTH,
  buildPlan,
  checkAmount,
  clampShare,
  daysLeftInMonth,
  encodeShare,
  euro,
  goalDate,
  matchProfile,
  mealsPerWeek,
  monthsToGoal,
  planToText,
  withShares,
  type PlanLine,
} from "@/lib/plan";
import { useAccount } from "@/lib/use-account";
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
    q: "Comment suivre mes dépenses dans le mois ?",
    a: "Clique sur « suivre mes dépenses » et note chaque achat dans son poste. Le site te dit ce qu'il te reste, et combien tu peux dépenser par jour jusqu'à la fin du mois. Le suivi repart à zéro au début de chaque mois.",
  },
  {
    q: "Mes chiffres sont-ils envoyés quelque part ?",
    a: "Sans compte, non : le calcul se fait dans ton navigateur et tes montants restent sur ton appareil. Si tu te connectes avec Microsoft, ton budget est sauvegardé dans ton compte (et seulement lisible par toi) pour le retrouver sur ton téléphone et ton ordi. Tu peux supprimer ton compte et tes données à tout moment.",
  },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function PlanPage() {
  const { saved, setSaved, loaded, reset, forget, fromLink } = useSaved();
  const account = useAccount({ saved, setSaved, loaded, forget });
  const [trackingOpen, setTrackingOpen] = useState<boolean | null>(null);
  const [linkState, setLinkState] = useState<"ok" | "error" | null>(null);
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
  const hasSpent = Object.keys(saved.tracker.spent).length > 0;
  const tracking = trackingOpen ?? hasSpent;
  const hasInput = Boolean(saved.budget || saved.savings || saved.rent || customized || hasSpent || saved.goal.target);
  const profile = matchProfile(saved.shares);

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
  const spend = (key: string, amount: number) =>
    setSaved((s) => {
      const next = Math.round(((s.tracker.spent[key] ?? 0) + amount) * 100) / 100;
      const spent = { ...s.tracker.spent };
      if (next > 0) spent[key] = next;
      else delete spent[key];
      return { ...s, tracker: { ...s.tracker, spent } };
    });
  const clearSpent = () => {
    setTrackingOpen(true); // stay in tracking mode after clearing
    setSaved((s) => ({ ...s, tracker: { ...s.tracker, spent: {} } }));
  };

  async function shareLink() {
    const url = `${window.location.origin}/#${encodeShare(saved)}`;
    try {
      if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "Mon budget étudiant", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setLinkState("ok");
      setAnnounce("Lien copié.");
    } catch (err) {
      // closing the share sheet is not an error
      if (!(err instanceof DOMException && err.name === "AbortError")) setLinkState("error");
    }
    setTimeout(() => setLinkState(null), 2500);
  }

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
          <span className="no-print flex items-center gap-1">
            <AccountButton account={account} />
            <ThemeToggle />
          </span>
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

        {loaded && editable && (
          <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-2 border-2 border-t-0 border-ink px-4 py-3" role="group" aria-label="ta situation">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">ta situation</span>
            {PROFILES.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={profile === p.key}
                title={p.hint}
                onClick={() => setSaved((s) => ({ ...s, shares: { ...p.shares } }))}
                className={cn("min-h-9 border border-ink px-3 text-[11px] font-bold lowercase", profile === p.key ? "bg-ink text-paper" : "invert-hover")}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {account.notice && (
          <p className="no-print mt-4 flex items-start justify-between gap-3 border-2 border-ink px-4 py-2 text-[12px]" role="status" data-testid="account-notice">
            <span>{account.notice}</span>
            <button type="button" className="link shrink-0" aria-label="fermer le message" onClick={() => account.setNotice(null)}>
              ✕
            </button>
          </p>
        )}

        {fromLink && (
          <p className="no-print border-2 border-t-0 border-ink px-4 py-2 text-[12px]" data-testid="from-link">
            Budget chargé depuis un lien partagé. Modifie-le librement : il est maintenant enregistré sur ton appareil.
          </p>
        )}

        <p className="sr-only" role="status" aria-atomic="true">
          {announce}
        </p>

        <div className="mt-px">
          {!loaded ? null : invalid.length > 0 ? (
            <Notice testId="invalid">Corrige {invalid.length > 1 ? "les montants" : "le montant"} : {invalid.map((f) => f.label).join(", ")}.</Notice>
          ) : showPlan && plan.ok ? (
            <Result
              lines={plan.lines}
              spendable={plan.spendable}
              savings={input.savings}
              savingsRate={plan.savingsRate}
              rent={input.rent}
              tracking={tracking}
              spent={saved.tracker.spent}
              onSpend={spend}
            />
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
          <div className="no-print mt-6 flex flex-wrap items-center gap-2">
            {showPlan && (
              <Button size="sm" onClick={() => void copy()} data-testid="copy">
                {copied === "ok" ? "copié ✓" : copied === "error" ? "copie impossible" : "copier mon budget"}
              </Button>
            )}
            {showPlan && (
              <Button size="sm" variant={tracking ? "default" : "outline"} aria-pressed={tracking} onClick={() => setTrackingOpen(!tracking)} data-testid="toggle-tracking">
                {tracking ? "masquer le suivi" : "suivre mes dépenses"}
              </Button>
            )}
            {showPlan && (
              <Button size="sm" variant="outline" onClick={() => void shareLink()} data-testid="share-link">
                {linkState === "ok" ? "lien copié ✓" : linkState === "error" ? "partage impossible" : "lien de partage"}
              </Button>
            )}
            {showPlan && (
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                imprimer
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

        {showPlan && tracking && hasSpent && (
          <p className="no-print mt-3 text-[11px] text-muted-foreground">
            Le suivi repart à zéro chaque mois.{" "}
            <button type="button" className="link underline" onClick={clearSpent}>
              remettre les dépenses à zéro maintenant
            </button>
          </p>
        )}

        {loaded && (
          <Section title="objectif d'épargne" id="objectif" className="mt-16">
            <Goal goal={saved.goal} perMonth={invalid.length ? 0 : input.savings} onChange={(goal) => setSaved((s) => ({ ...s, goal }))} />
          </Section>
        )}

        <Section title="ton compte" id="compte" className="no-print mt-16">
          <AccountPanel account={account} />
        </Section>

        <Section title="questions" id="faq" className="no-print mt-20">
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

      <footer className="no-print border-t-2 border-ink">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[11px] lowercase">
          <span>
            <strong className="font-display font-black italic">epistudent</strong> — fait par des étudiants, pour les étudiants.
          </span>
          <span className="text-muted-foreground">compte optionnel · aucune pub · aucun traceur</span>
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

type ResultProps = {
  lines: PlanLine[];
  spendable: number;
  savings: number;
  savingsRate: number;
  rent: number;
  tracking: boolean;
  spent: Record<string, number>;
  onSpend: (key: string, amount: number) => void;
};

function Result({ lines, spendable, savings, savingsRate, rent, tracking, spent, onSpend }: ResultProps) {
  const totalSpent = Math.round(Object.values(spent).reduce((a, b) => a + b, 0) * 100) / 100;
  const left = Math.round((spendable - totalSpent) * 100) / 100;
  const days = daysLeftInMonth();
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

      {tracking && (
        <div className="grid grid-cols-2 gap-px border-t-2 border-ink bg-ink lg:grid-cols-3" data-testid="tracker-summary">
          <div className="cell min-w-0 bg-background p-4 sm:p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em]">dépensé ce mois</div>
            <div className="amount-lg mt-2">
              <Amount value={totalSpent} testId="spent-total" />
            </div>
          </div>
          <div className={cn("cell relative min-w-0 overflow-hidden p-4 sm:p-5", left < 0 ? "bg-ink text-paper" : "bg-background")}>
            {left < 0 && <div aria-hidden className="hatch-paper absolute inset-0" />}
            <div className="relative text-[10px] font-bold uppercase tracking-[0.2em]">{left < 0 ? "dépassé de" : "il reste"}</div>
            <div className="amount-lg relative mt-2">
              <Amount value={Math.abs(left)} testId="left-total" />
            </div>
          </div>
          <div className="cell col-span-2 min-w-0 bg-background p-4 sm:p-5 lg:col-span-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em]">par jour jusqu&apos;à la fin du mois</div>
            <div className="amount-lg mt-2">
              <Amount value={Math.max(0, Math.round((left / days) * 100) / 100)} testId="left-per-day" />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {days} jour{days > 1 ? "s" : ""} restant{days > 1 ? "s" : ""}, aujourd&apos;hui compris
            </div>
          </div>
        </div>
      )}

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
              {l.key === "bouffe" && l.week >= MEAL_PRICE && (
                <div className="mt-1 text-[11px] opacity-80" data-testid="meals">
                  ≈ {mealsPerWeek(l.week)} repas à {euro(MEAL_PRICE)} par semaine
                </div>
              )}
              {tracking ? <Spending line={l} spent={spent[l.key] ?? 0} onSpend={(v) => onSpend(l.key, v)} /> : <ShareBar percent={l.percent} />}
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

/** Per-category spending: how much is gone, what's left, and a quick "+ €" field. */
function Spending({ line, spent, onSpend }: { line: PlanLine; spent: number; onSpend: (v: number) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const left = Math.round((line.month - spent) * 100) / 100;
  const ratio = line.month > 0 ? Math.min(1, spent / line.month) : spent > 0 ? 1 : 0;
  const id = `spend-${line.key}`;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const { value, error: err } = checkAmount(text);
    if (err || !value) {
      setError(true);
      return;
    }
    setError(false);
    setText("");
    onSpend(value);
  }
  return (
    <div className="mt-2" data-testid={`spending-${line.key}`}>
      <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="h-1.5 w-full border border-current" aria-hidden>
        <rect x="0" y="0" width={ratio * 100} height="4" className="fill-current" />
      </svg>
      <div className="tabular mt-1 flex flex-wrap justify-between gap-x-2 text-[11px]">
        <span>dépensé {euro(spent)}</span>
        <strong data-testid={`left-${line.key}`}>{left < 0 ? `dépassé de ${euro(-left)}` : `reste ${euro(left)}`}</strong>
      </div>
      <form onSubmit={submit} className="no-print mt-2 flex" noValidate>
        <label htmlFor={id} className="sr-only">
          dépense en {line.label}
        </label>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="+ €"
          maxLength={12}
          value={text}
          aria-invalid={error}
          onChange={(e) => {
            setText(e.target.value);
            setError(false);
          }}
          className={cn("tabular h-9 w-full min-w-0 border border-current bg-transparent px-2 text-[13px] outline-none placeholder:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-current", error && "border-2")}
        />
        <button type="submit" aria-label={`ajouter la dépense en ${line.label}`} className="-ml-px h-9 shrink-0 border border-current px-3 text-[11px] font-bold uppercase">
          ok
        </button>
      </form>
      {error && <p className="mt-1 text-[11px] font-bold">montant invalide</p>}
    </div>
  );
}

/** "I want 600 € for a laptop": how many months at the current savings rate. */
function Goal({ goal, perMonth, onChange }: { goal: { label: string; target: string }; perMonth: number; onChange: (g: { label: string; target: string }) => void }) {
  const { value: target, error } = checkAmount(goal.target);
  const months = target ? monthsToGoal(target, perMonth) : null;
  return (
    <div className="grid gap-px border-2 border-ink bg-ink sm:grid-cols-[1.4fr_1fr_1.4fr]">
      <div className="bg-background p-4 sm:p-5">
        <label htmlFor="goal-label" className="text-[10px] font-bold uppercase tracking-[0.2em]">
          pour quoi ?
        </label>
        <input
          id="goal-label"
          className="display mt-2 w-full min-w-0 border-b-2 border-ink bg-transparent pb-1 text-[24px] outline-none placeholder:text-muted-foreground focus-visible:border-b-[5px]"
          placeholder="un ordi, un voyage…"
          maxLength={40}
          autoComplete="off"
          value={goal.label}
          onChange={(e) => onChange({ ...goal, label: e.target.value })}
        />
      </div>
      <div className="bg-background p-4 sm:p-5">
        <label htmlFor="goal-target" className="text-[10px] font-bold uppercase tracking-[0.2em]">
          combien ?
        </label>
        <div className="mt-2 flex items-baseline gap-2 border-b-2 border-ink focus-within:border-b-[5px]">
          <input
            id="goal-target"
            className="display tabular w-full min-w-0 bg-transparent pb-1 text-[24px] outline-none placeholder:text-muted-foreground"
            inputMode="decimal"
            placeholder="600"
            maxLength={16}
            autoComplete="off"
            value={goal.target}
            aria-invalid={error !== null}
            onChange={(e) => onChange({ ...goal, target: e.target.value })}
          />
          <span className="display text-[20px]" aria-hidden>
            €
          </span>
        </div>
      </div>
      <div className="cell flex flex-col justify-center bg-ink p-4 text-paper sm:p-5" data-testid="goal-result">
        {error ? (
          <p className="font-bold">Montant invalide.</p>
        ) : !target ? (
          <p className="text-[12px] opacity-80">Entre un montant pour savoir en combien de temps tu l&apos;atteins avec ton épargne.</p>
        ) : months === null ? (
          <p className="text-[12px]">Ajoute une épargne mensuelle plus haut pour voir quand tu y arrives.</p>
        ) : (
          <>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em]">{goal.label.trim() || "objectif"}</div>
            <div className="display mt-2 text-[34px] leading-none" data-testid="goal-months">
              {months} mois
            </div>
            <div className="mt-1 text-[11px] opacity-80">
              en mettant {euro(perMonth)} de côté par mois · prêt en {goalDate(months)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type Account = ReturnType<typeof useAccount>;

const SYNC_LABEL: Record<string, string> = {
  idle: "",
  loading: "synchronisation…",
  saving: "sauvegarde…",
  saved: "sauvegardé ✓",
  error: "hors ligne, réessai à la prochaine modif",
};

function AccountButton({ account }: { account: Account }) {
  if (!account.ready) return null;
  if (!account.session) {
    return (
      <button type="button" className="link min-h-11 px-2 text-[12px] lowercase" onClick={() => void account.signIn()} data-testid="sign-in">
        se connecter
      </button>
    );
  }
  const email = account.session.user.email ?? "";
  return (
    <a href="#compte" className="link flex min-h-11 items-center gap-2 px-2 text-[12px] lowercase" data-testid="account-chip" title={email}>
      <span aria-hidden className="grid size-6 place-items-center bg-ink text-[11px] font-bold uppercase text-paper">
        {email.slice(0, 1) || "?"}
      </span>
      <span className="hidden sm:inline">mon compte</span>
    </a>
  );
}

function AccountPanel({ account }: { account: Account }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!account.ready) return null;
  if (!account.session) {
    return (
      <div className="grid gap-px border-2 border-ink bg-ink sm:grid-cols-[1.5fr_1fr]">
        <div className="bg-background p-4 sm:p-5">
          <p className="display text-[24px] leading-tight">retrouve ton budget partout.</p>
          <p className="mt-2 text-muted-foreground">
            Connecte-toi avec ton compte Microsoft (Outlook, Hotmail ou école) pour sauvegarder ton budget, ton suivi et ton objectif, et les retrouver sur ton téléphone comme sur ton ordi. Facultatif : sans compte, tout marche quand même sur cet appareil.
          </p>
        </div>
        <div className="flex items-center bg-background p-4 sm:p-5">
          <Button size="lg" className="w-full" onClick={() => void account.signIn()} data-testid="microsoft-sign-in">
            <MicrosoftMark /> continuer avec microsoft
          </Button>
        </div>
      </div>
    );
  }
  const user = account.session.user;
  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";
  return (
    <div className="grid gap-px border-2 border-ink bg-ink sm:grid-cols-[1.5fr_1fr]">
      <div className="bg-background p-4 sm:p-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em]">connecté</div>
        <p className="display mt-2 break-all text-[22px] leading-tight" data-testid="account-name">
          {name}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">{user.email}</p>
        <p className="mt-3 text-[12px] font-bold" data-testid="sync-status" aria-live="off">
          {SYNC_LABEL[account.status]}
        </p>
      </div>
      <div className="flex flex-col justify-center gap-2 bg-background p-4 sm:p-5">
        <Button variant="outline" onClick={() => void account.signOut()} data-testid="sign-out">
          se déconnecter
        </Button>
        <Button
          variant={confirmDelete ? "default" : "outline"}
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 5000);
              return;
            }
            void account.deleteAccount();
          }}
          data-testid="delete-account"
        >
          {confirmDelete ? "sûr ? tout supprimer" : "supprimer mon compte"}
        </Button>
      </div>
    </div>
  );
}

function MicrosoftMark() {
  // the four squares, in shades of the current colour (the site stays black & white)
  return (
    <svg viewBox="0 0 21 21" aria-hidden className="size-4">
      <rect x="1" y="1" width="9" height="9" className="fill-current" />
      <rect x="11" y="1" width="9" height="9" className="fill-current" opacity="0.75" />
      <rect x="1" y="11" width="9" height="9" className="fill-current" opacity="0.55" />
      <rect x="11" y="11" width="9" height="9" className="fill-current" opacity="0.85" />
    </svg>
  );
}
