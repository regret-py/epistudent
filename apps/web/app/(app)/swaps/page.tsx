"use client";

import { useEffect, useState } from "react";
import { Button } from "@studybuddy/ui";
import { ErrorText, Field, Loading, Muted, PageTitle, Section } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { formatDateTime, localInputToIso } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/types";
import { supabase } from "@/lib/supabase";
import { unwrap, useAsync } from "@/lib/use-async";

type Swap = {
  id: string;
  user_id: string;
  offered_slot: string;
  wanted_slot: string;
  status: "open" | "matched" | "cancelled";
  project: { name: string; module_code: string } | null;
  project_id: string | null;
};

export default function SwapsPage() {
  const { profile } = useSession();
  const { dict, locale } = useI18n();
  const t = dict.swaps;
  const [flash, setFlash] = useState<string | null>(null);

  const data = useAsync(async () => {
    const db = supabase();
    const [swaps, projects] = await Promise.all([
      db.from("defense_swaps").select("id, user_id, offered_slot, wanted_slot, status, project_id, project:projects(name, module_code)").order("offered_slot"),
      db.from("projects").select("id, name, module_code").order("module_code").order("name"),
    ]);
    const all = unwrap(swaps) as Swap[];
    const mine = all.filter((s) => s.user_id === profile.id);
    const partners = await Promise.all(
      mine.filter((s) => s.status === "matched").map(async (s) => [s.id, unwrap(await db.rpc("swap_partner", { p_swap: s.id }))?.[0] ?? null] as const),
    );
    return {
      mine,
      market: all.filter((s) => s.user_id !== profile.id && s.status === "open"),
      partners: new Map(partners),
      projects: unwrap(projects),
    };
  }, [profile.id]);

  // a match created by someone else's insert updates our rows
  useEffect(() => {
    const client = supabase();
    const channel = client
      .channel(`swaps:${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "defense_swaps" }, () => void data.reload())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  async function post(values: { project_id: string | null; offered_slot: string; wanted_slot: string }) {
    const { data: inserted, error } = await supabase().from("defense_swaps").insert(values).select("id").single();
    if (error) throw new Error(error.message);
    // the matching trigger runs on insert, so re-read the status
    const { data: row } = await supabase().from("defense_swaps").select("status").eq("id", inserted.id).single();
    setFlash(row?.status === "matched" ? t.matchedNow : null);
    await data.reload();
  }

  const label = (s: Swap) => (s.project ? `${s.project.module_code} — ${s.project.name}` : "—");

  return (
    <div>
      <PageTitle>{t.title}</PageTitle>
      {flash && <p className="mb-6 bg-primary px-3 py-2 font-bold text-white" data-testid="swap-flash">{flash}</p>}
      {data.error && <ErrorText>{data.error.message}</ErrorText>}

      <div className="grid gap-x-10 lg:grid-cols-2">
        <Section title={t.mine}>
          {data.loading && !data.data ? (
            <Loading label={dict.common.loading} />
          ) : !data.data?.mine.length ? (
            <Muted>{t.noMine}</Muted>
          ) : (
            <ul className="divide-y border-b" data-testid="my-swaps">
              {data.data.mine.map((s) => {
                const partner = data.data?.partners.get(s.id);
                return (
                  <li key={s.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">{label(s)}</span>
                      <span className={s.status === "matched" ? "bg-primary px-1 text-[10px] font-bold uppercase text-white" : "text-[10px] font-bold uppercase"}>
                        {t.status[s.status]}
                      </span>
                    </div>
                    <div className="font-bold">
                      {formatDateTime(s.offered_slot, locale)} {t.arrow} {formatDateTime(s.wanted_slot, locale)}
                    </div>
                    {partner && <div className="text-[12px]">{format(t.partner, { name: partner.display_name ?? "", email: partner.email })}</div>}
                    {s.status === "open" && (
                      <button
                        type="button"
                        className="link text-[11px] lowercase"
                        onClick={async () => {
                          await supabase().from("defense_swaps").update({ status: "cancelled" }).eq("id", s.id);
                          await data.reload();
                        }}
                      >
                        {dict.common.cancel}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title={t.market}>
          {!data.data?.market.length ? (
            <Muted>{t.empty}</Muted>
          ) : (
            <ul className="divide-y border-b" data-testid="swap-market">
              {data.data.market.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="text-[11px] text-muted-foreground">{label(s)}</div>
                    <div className="font-bold">
                      {formatDateTime(s.offered_slot, locale)} {t.arrow} {formatDateTime(s.wanted_slot, locale)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="red"
                    onClick={() =>
                      // taking = posting the mirror offer, which the DB matches instantly
                      void post({ project_id: s.project_id, offered_slot: s.wanted_slot, wanted_slot: s.offered_slot }).catch((e: Error) => setFlash(e.message))
                    }
                  >
                    {t.take}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <PostForm projects={data.data?.projects ?? []} onPost={post} />
    </div>
  );
}

function PostForm({
  projects,
  onPost,
}: {
  projects: { id: string; name: string; module_code: string }[];
  onPost: (v: { project_id: string | null; offered_slot: string; wanted_slot: string }) => Promise<void>;
}) {
  const { dict } = useI18n();
  const t = dict.swaps;
  const [projectId, setProjectId] = useState("");
  const [offered, setOffered] = useState("");
  const [wanted, setWanted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await onPost({ project_id: projectId || null, offered_slot: localInputToIso(offered), wanted_slot: localInputToIso(wanted) });
      setOffered("");
      setWanted("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Section title={t.post}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <Field label={t.project} htmlFor="s-project">
          <select id="s-project" className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t.any}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.module_code} — {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.offered} htmlFor="s-offered">
          <input id="s-offered" type="datetime-local" className="field" value={offered} onChange={(e) => setOffered(e.target.value)} required />
        </Field>
        <Field label={t.wanted} htmlFor="s-wanted">
          <input id="s-wanted" type="datetime-local" className="field" value={wanted} onChange={(e) => setWanted(e.target.value)} required />
        </Field>
        <div className="space-y-2 sm:col-span-3">
          <p className="text-[11px] text-muted-foreground">{t.consent}</p>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="red" disabled={pending}>
            {pending ? dict.common.saving : t.postButton}
          </Button>
        </div>
      </form>
    </Section>
  );
}
