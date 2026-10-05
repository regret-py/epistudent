"use client";

import { useEffect, useState } from "react";
import { CAMPUSES, type AssistantStatusRow, type Campus } from "@studybuddy/db";
import { Button, cn } from "@studybuddy/ui";
import { ErrorText, Field, Loading, Muted, PageTitle, Section } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/types";
import { supabase } from "@/lib/supabase";
import { unwrap, useAsync } from "@/lib/use-async";

/** Average time an assistant spends per student, for the ETA. */
const MINUTES_PER_STUDENT = 8;

export default function BocalPage() {
  const { profile } = useSession();
  const { dict } = useI18n();
  const t = dict.bocal;
  const [campus, setCampus] = useState<Campus>(((CAMPUSES as readonly string[]).includes(profile.city ?? "") ? profile.city : "paris") as Campus);
  const [error, setError] = useState<string | null>(null);
  const isAssistant = profile.role === "assistant" || profile.role === "admin";

  const list = useAsync(async () => {
    return unwrap(await supabase().from("assistants_status").select("*").eq("campus", campus).order("available", { ascending: false }).order("display_name"));
  }, [campus]);

  useEffect(() => {
    const client = supabase();
    const channel = client
      .channel(`bocal:${campus}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assistants_status" }, () => void list.reload())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus]);

  const rows = list.data ?? [];
  const myTicket = rows.find((r) => r.queue.includes(profile.id));
  const position = myTicket ? myTicket.queue.indexOf(profile.id) + 1 : 0;

  async function call(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setError(null);
    const { error: err } = await fn();
    if (err) setError(err.message);
    await list.reload();
  }

  return (
    <div>
      <PageTitle
        aside={
          <select aria-label={t.campus} className="field h-9 w-auto" value={campus} onChange={(e) => setCampus(e.target.value as Campus)}>
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {dict.campuses[c]}
              </option>
            ))}
          </select>
        }
      >
        {t.title}
      </PageTitle>

      {myTicket && (
        <div className="mb-8 bg-primary p-4 text-white" data-testid="my-ticket">
          <div className="font-display text-5xl font-black italic leading-none">n°{position}</div>
          <div className="mt-1 font-bold">{format(t.position, { n: position, eta: (position - 1) * MINUTES_PER_STUDENT })}</div>
          <button type="button" className="mt-2 text-[11px] lowercase underline" onClick={() => void call(() => supabase().rpc("leave_bocal_queue", { p_status: myTicket.id }))}>
            {t.leave}
          </button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>

      <Section title={dict.campuses[campus]}>
        {list.loading && !list.data ? (
          <Loading label={dict.common.loading} />
        ) : !rows.length ? (
          <Muted>{t.empty}</Muted>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="assistants">
            {rows.map((a) => (
              <li key={a.id} className={cn("border border-foreground", !a.available && "opacity-50")}>
                <div className={cn("flex items-center justify-between px-3 py-2", a.available ? "bg-ink text-paper" : "bg-muted")}>
                  <span className="font-display text-lg font-black italic">{a.display_name ?? "assistant"}</span>
                  <span className={cn("px-1 text-[10px] font-bold uppercase", a.available ? "bg-primary text-white" : "")}>
                    {a.available ? t.available : t.away}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-[12px]">
                    {format(t.queue, { n: a.queue.length })} · {format(t.eta, { n: a.queue.length * MINUTES_PER_STUDENT })}
                  </span>
                  {a.available && !myTicket && a.assistant_id !== profile.id && (
                    <Button size="sm" variant="red" onClick={() => void call(() => supabase().rpc("join_bocal_queue", { p_status: a.id }))}>
                      {t.join}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {isAssistant ? (
        <AssistantPanel mine={rows.find((r) => r.assistant_id === profile.id) ?? null} campus={campus} onChange={list.reload} />
      ) : (
        <p className="text-[11px] text-muted-foreground">{t.assistantHint}</p>
      )}
    </div>
  );
}

function AssistantPanel({ mine, campus, onChange }: { mine: AssistantStatusRow | null; campus: Campus; onChange: () => Promise<void> }) {
  const { profile } = useSession();
  const { dict } = useI18n();
  const t = dict.bocal;
  const [name, setName] = useState(mine?.display_name ?? profile.display_name ?? "");
  const [available, setAvailable] = useState(mine?.available ?? false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mine) {
      setAvailable(mine.available);
      setName(mine.display_name ?? "");
    }
  }, [mine]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase()
      .from("assistants_status")
      .upsert({ assistant_id: profile.id, campus, available, display_name: name || null }, { onConflict: "assistant_id" });
    if (err) setError(err.message);
    await onChange();
  }

  return (
    <Section title={t.assistantPanel}>
      <form onSubmit={save} className="grid items-end gap-3 sm:grid-cols-[2fr_auto_auto]">
        <Field label={t.displayName} htmlFor="a-name">
          <input id="a-name" className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <label className="flex h-10 items-center gap-2 border border-foreground px-3 font-bold">
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="accent-[hsl(var(--primary))]" />
          {t.availableToggle}
        </label>
        <Button type="submit">{t.saveStatus}</Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {mine && (
        <div className="mt-4 flex items-center gap-4">
          <span className="font-display text-3xl font-black italic">{format(t.queue, { n: mine.queue.length })}</span>
          <Button
            variant="red"
            disabled={!mine.queue.length}
            onClick={async () => {
              await supabase().rpc("bocal_next", { p_status: mine.id });
              await onChange();
            }}
          >
            {t.next}
          </Button>
          {!mine.queue.length && <Muted>{t.queueEmpty}</Muted>}
        </div>
      )}
    </Section>
  );
}
