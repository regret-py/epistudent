"use client";

import { useMemo, useState } from "react";
import type { Enums } from "@studybuddy/db";
import { Button, cn } from "@studybuddy/ui";
import { Chip, ErrorText, Field, Loading, PageTitle, Section } from "@/components/ui";
import { formatDateTime, formatMonth, formatRelative, localInputToIso, urgencyOf } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { supabase } from "@/lib/supabase";
import { unwrap, useAsync } from "@/lib/use-async";

type Status = Enums<"deadline_status">;
type ProjectType = "project" | "defense" | "exam" | "other";
const STATUSES: Status[] = ["todo", "in_progress", "done", "missed"];
const TYPES: ProjectType[] = ["project", "defense", "exam", "other"];

type Item = {
  id: string;
  status: Status;
  project: { id: string; name: string; module_code: string; deadline: string | null; type: string };
};

export default function DeadlinesPage() {
  const { dict, locale } = useI18n();
  const t = dict.deadlines;
  const [view, setView] = useState<"list" | "calendar">("list");
  const [module, setModule] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const db = supabase();
    const [mine, catalogue] = await Promise.all([
      db.from("deadlines").select("id, status, project:projects!inner(id, name, module_code, deadline, type)"),
      db.from("projects").select("id, name, module_code, deadline").order("module_code").order("name"),
    ]);
    return { items: unwrap(mine) as Item[], catalogue: unwrap(catalogue) };
  }, []);

  const items = useMemo(() => {
    const list = (data?.items ?? []).filter((i) => !module || i.project.module_code === module);
    // urgency: not-done first, then by date; undated last
    return list.sort((a, b) => {
      const doneA = a.status === "done" ? 1 : 0;
      const doneB = b.status === "done" ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      return (a.project.deadline ?? "9999").localeCompare(b.project.deadline ?? "9999");
    });
  }, [data, module]);

  const modules = useMemo(() => [...new Set((data?.items ?? []).map((i) => i.project.module_code))].sort(), [data]);

  async function setStatus(id: string, status: Status) {
    await supabase().from("deadlines").update({ status }).eq("id", id);
    await reload();
  }

  async function remove(id: string) {
    await supabase().from("deadlines").delete().eq("id", id);
    await reload();
  }

  return (
    <div>
      <PageTitle
        aside={
          <div className="flex gap-2">
            <Chip active={view === "list"} onClick={() => setView("list")}>
              {t.list}
            </Chip>
            <Chip active={view === "calendar"} onClick={() => setView("calendar")}>
              {t.calendar}
            </Chip>
          </div>
        }
      >
        {t.title}
      </PageTitle>

      {modules.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2" aria-label={t.filter}>
          <Chip active={module === null} onClick={() => setModule(null)}>
            {dict.common.all}
          </Chip>
          {modules.map((m) => (
            <Chip key={m} active={module === m} onClick={() => setModule(m)}>
              {m}
            </Chip>
          ))}
        </div>
      )}

      {error && <ErrorText>{error.message}</ErrorText>}
      {loading && !data ? (
        <Loading label={dict.common.loading} />
      ) : view === "list" ? (
        <Section title={`${items.length} ${t.title}`}>
          {items.length === 0 ? (
            <p className="text-muted-foreground">{t.empty}</p>
          ) : (
            <ul className="divide-y border-b" data-testid="deadline-list">
              {items.map((item) => {
                const urgency = item.status === "done" ? "later" : urgencyOf(item.project.deadline);
                return (
                  <li key={item.id} className={cn("grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center", item.status === "done" && "opacity-50")}>
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.project.module_code} · {t.types[item.project.type as ProjectType] ?? item.project.type}
                      </div>
                      <div className={cn("font-bold", item.status === "done" && "line-through")}>{item.project.name}</div>
                      <div className="text-[12px]">
                        {item.project.deadline ? `${formatDateTime(item.project.deadline, locale)} · ${formatRelative(item.project.deadline, locale)}` : t.urgency.none}
                        {t.urgency[urgency] && urgency !== "none" && (
                          <span className="ml-2 bg-primary px-1 text-[10px] font-bold uppercase text-white">{t.urgency[urgency]}</span>
                        )}
                      </div>
                    </div>
                    <select
                      aria-label={`status ${item.project.name}`}
                      className="field h-8 w-auto text-[11px]"
                      value={item.status}
                      onChange={(e) => void setStatus(item.id, e.target.value as Status)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t.status[s]}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="link justify-self-start text-[11px] lowercase" onClick={() => void remove(item.id)}>
                      {t.remove}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      ) : (
        <Calendar items={items} />
      )}

      <AddDeadline
        catalogue={(data?.catalogue ?? []).filter((p) => !data?.items.some((i) => i.project.id === p.id))}
        onAdded={reload}
      />
      <p className="text-[11px] text-muted-foreground">{t.intraSoon}</p>
    </div>
  );
}

function Calendar({ items }: { items: Item[] }) {
  const { dict, locale } = useI18n();
  const t = dict.deadlines;
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const days = useMemo(() => {
    const first = new Date(cursor);
    const offset = (first.getDay() + 6) % 7; // monday first
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      if (!item.project.deadline) continue;
      const key = new Date(item.project.deadline).toDateString();
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  const today = new Date().toDateString();

  return (
    <Section title={formatMonth(cursor, locale)}>
      <div className="mb-3 flex gap-2">
        <Button size="sm" variant="outline" aria-label={t.prevMonth} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
          ←
        </Button>
        <Button size="sm" variant="outline" aria-label={t.nextMonth} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
          →
        </Button>
      </div>
      <div className="grid grid-cols-7 border-l border-t border-foreground text-[11px]" data-testid="calendar">
        {t.weekdays.map((d) => (
          <div key={d} className="border-b border-r border-foreground bg-ink px-1 py-1 font-bold uppercase text-paper">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const list = byDay.get(day.toDateString()) ?? [];
          const outside = day.getMonth() !== cursor.getMonth();
          return (
            <div key={day.toISOString()} className={cn("min-h-16 border-b border-r border-foreground p-1 sm:min-h-24", outside && "text-muted-foreground opacity-50")}>
              <div className={cn("mb-1 w-5 text-center font-bold", day.toDateString() === today && "bg-primary text-white")}>{day.getDate()}</div>
              {list.map((item) => (
                <div
                  key={item.id}
                  title={`${item.project.module_code} — ${item.project.name}`}
                  className={cn("mb-0.5 truncate px-0.5 text-[10px] font-bold", item.status === "done" ? "bg-muted line-through" : "bg-primary text-white")}
                >
                  {item.project.name}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function AddDeadline({ catalogue, onAdded }: { catalogue: { id: string; name: string; module_code: string; deadline: string | null }[]; onAdded: () => Promise<void> }) {
  const { dict } = useI18n();
  const t = dict.deadlines;
  const [projectId, setProjectId] = useState("");
  const [moduleCode, setModuleCode] = useState("");
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [type, setType] = useState<ProjectType>("project");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const db = supabase();
      let id = projectId;
      if (!id) {
        if (!moduleCode.trim() || !name.trim()) throw new Error(`${t.moduleCode} / ${t.name}`);
        const created = await db
          .from("projects")
          .insert({ module_code: moduleCode.trim().toUpperCase(), name: name.trim(), deadline: due ? localInputToIso(due) : null, type })
          .select("id")
          .single();
        id = unwrap(created).id;
      }
      unwrap(await db.from("deadlines").insert({ project_id: id }));
      setProjectId("");
      setModuleCode("");
      setName("");
      setDue("");
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Section title={t.add}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t.fromCatalogue} htmlFor="catalogue">
          <select id="catalogue" className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t.pick}</option>
            {catalogue.map((p) => (
              <option key={p.id} value={p.id}>
                {p.module_code} — {p.name}
              </option>
            ))}
          </select>
        </Field>
        {!projectId && (
          <fieldset className="grid gap-3 border border-dashed border-foreground p-3 sm:grid-cols-4">
            <legend className="px-1 text-[11px] text-muted-foreground">{t.orNew}</legend>
            <Field label={t.moduleCode} htmlFor="module_code">
              <input id="module_code" className="field" placeholder="B-CPE-110" value={moduleCode} onChange={(e) => setModuleCode(e.target.value)} />
            </Field>
            <Field label={t.name} htmlFor="project_name">
              <input id="project_name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t.due} htmlFor="due">
              <input id="due" type="datetime-local" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label={t.type} htmlFor="type">
              <select id="type" className="field" value={type} onChange={(e) => setType(e.target.value as ProjectType)}>
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t.types[ty]}
                  </option>
                ))}
              </select>
            </Field>
          </fieldset>
        )}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="red" disabled={pending}>
          {pending ? dict.common.saving : t.addButton}
        </Button>
      </form>
    </Section>
  );
}
