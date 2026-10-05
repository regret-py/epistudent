"use client";

import { useState } from "react";
import { Button, cn } from "@studybuddy/ui";
import { ErrorText, Field, Loading, Muted, PageTitle, Section } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { supabase } from "@/lib/supabase";
import { unwrap, useAsync } from "@/lib/use-async";

export default function MoulinettePage() {
  const { dict } = useI18n();
  const t = dict.moulinette;
  const [selected, setSelected] = useState<string | null>(null);

  const overview = useAsync(async () => {
    const db = supabase();
    const [stats, projects] = await Promise.all([db.rpc("moulinette_overview"), db.from("projects").select("name").order("name")]);
    return { stats: unwrap(stats) ?? [], projectNames: [...new Set((unwrap(projects) ?? []).map((p) => p.name.toLowerCase()))] };
  }, []);

  const current = selected ?? overview.data?.stats[0]?.project ?? null;

  return (
    <div>
      <PageTitle>{t.title}</PageTitle>
      {overview.error && <ErrorText>{overview.error.message}</ErrorText>}

      <div className="grid gap-x-10 lg:grid-cols-2">
        <Section title={t.overview}>
          {overview.loading && !overview.data ? (
            <Loading label={dict.common.loading} />
          ) : !overview.data?.stats.length ? (
            <Muted>{t.empty}</Muted>
          ) : (
            <table className="w-full text-left text-[12px]" data-testid="moulinette-table">
              <thead>
                <tr className="border-b border-foreground text-[10px] uppercase tracking-wider">
                  <th className="py-1">{t.project}</th>
                  <th className="text-right">{t.reports}</th>
                  <th className="text-right">{t.avgScore}</th>
                  <th className="text-right">{t.passRate}</th>
                  <th className="text-right">{t.avgHours}</th>
                </tr>
              </thead>
              <tbody>
                {overview.data.stats.map((s) => (
                  <tr
                    key={s.project}
                    onClick={() => setSelected(s.project)}
                    className={cn("cursor-pointer border-b hover:bg-muted", current === s.project && "bg-ink text-paper hover:bg-ink")}
                  >
                    <td className="py-2 font-bold">{s.project}</td>
                    <td className="text-right tabular-nums">{s.reports}</td>
                    <td className="text-right tabular-nums">{s.avg_score} %</td>
                    <td className="text-right tabular-nums">{s.pass_rate} %</td>
                    <td className="text-right tabular-nums">{s.avg_hours ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {current && <ProjectDetail project={current} />}
      </div>

      <SubmitForm
        projectNames={[...new Set([...(overview.data?.projectNames ?? []), ...(overview.data?.stats.map((s) => s.project) ?? [])])]}
        onSubmitted={async (project) => {
          await overview.reload();
          setSelected(project);
        }}
      />
    </div>
  );
}

function ProjectDetail({ project }: { project: string }) {
  const { dict, locale } = useI18n();
  const t = dict.moulinette;
  const detail = useAsync(async () => {
    const db = supabase();
    const [pitfalls, comments] = await Promise.all([
      db.rpc("moulinette_pitfalls", { p_project: project }),
      db.from("moulinette_reports").select("id, score, comment, created_at").eq("project_label", project).not("comment", "is", null).order("created_at", { ascending: false }).limit(10),
    ]);
    return { pitfalls: unwrap(pitfalls) ?? [], comments: unwrap(comments) ?? [] };
  }, [project]);

  const max = Math.max(1, ...(detail.data?.pitfalls.map((p) => p.occurrences) ?? []));

  return (
    <div>
      <Section title={`${t.pitfalls} — ${project}`}>
        {!detail.data ? (
          <Loading label={dict.common.loading} />
        ) : !detail.data.pitfalls.length ? (
          <Muted>{t.noPitfall}</Muted>
        ) : (
          <ul className="space-y-1.5" data-testid="pitfalls">
            {detail.data.pitfalls.map((p) => (
              <li key={p.pitfall} className="grid grid-cols-[1fr_auto] items-center gap-2 text-[12px]">
                <div className="relative h-6 border border-foreground">
                  <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${(p.occurrences / max) * 100}%` }} />
                  <span className="relative px-2 font-bold leading-6 mix-blend-difference text-white">{p.pitfall}</span>
                </div>
                <span className="tabular-nums">×{p.occurrences}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {!!detail.data?.comments.length && (
        <Section title={t.comments}>
          <ul className="divide-y border-b">
            {detail.data.comments.map((c) => (
              <li key={c.id} className="py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.score} % · {formatDate(c.created_at, locale)}
                </div>
                <p className="whitespace-pre-wrap">{c.comment}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function SubmitForm({ projectNames, onSubmitted }: { projectNames: string[]; onSubmitted: (project: string) => Promise<void> }) {
  const { dict } = useI18n();
  const t = dict.moulinette;
  const [project, setProject] = useState("");
  const [score, setScore] = useState(50);
  const [hours, setHours] = useState<string>("");
  const [pitfalls, setPitfalls] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setDone(false);
    const { error: err } = await supabase().rpc("submit_moulinette_report", {
      p_project: project,
      p_score: score,
      p_pitfalls: pitfalls.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 20),
      p_comment: comment || undefined,
      p_hours: hours === "" ? undefined : Number(hours),
    });
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setPitfalls("");
    setComment("");
    await onSubmitted(project.trim().toLowerCase().replace(/\s+/g, " "));
  }

  return (
    <Section title={t.submit}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <Field label={t.project} htmlFor="m-project">
          <input id="m-project" list="m-projects" className="field" value={project} onChange={(e) => setProject(e.target.value)} required minLength={2} maxLength={80} />
          <datalist id="m-projects">
            {projectNames.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label={t.score} htmlFor="m-score">
          <input id="m-score" type="number" min={0} max={100} step="0.01" className="field" value={score} onChange={(e) => setScore(Number(e.target.value))} required />
        </Field>
        <Field label={t.hours} htmlFor="m-hours">
          <input id="m-hours" type="number" min={0} max={1000} className="field" value={hours} onChange={(e) => setHours(e.target.value)} placeholder={dict.common.optional} />
        </Field>
        <div className="sm:col-span-3">
          <Field label={t.pitfallsField} htmlFor="m-pitfalls">
            <input id="m-pitfalls" className="field" value={pitfalls} onChange={(e) => setPitfalls(e.target.value)} placeholder="malloc non protégé, coding style, -l flag…" />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label={t.comment} htmlFor="m-comment">
            <textarea id="m-comment" className="field h-24 py-2" maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={dict.common.optional} />
          </Field>
        </div>
        <div className="space-y-2 sm:col-span-3">
          <p className="text-[11px] text-muted-foreground">{t.anonymity}</p>
          <ErrorText>{error}</ErrorText>
          {done && <p className="font-bold text-primary">{t.thanks}</p>}
          <Button type="submit" variant="red" disabled={pending}>
            {pending ? dict.common.saving : t.submitButton}
          </Button>
        </div>
      </form>
    </Section>
  );
}
