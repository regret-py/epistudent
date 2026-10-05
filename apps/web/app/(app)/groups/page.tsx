"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AVAILABILITY_SLOTS,
  rankCandidates,
  type Ambition,
  type AvailabilitySlot,
  type Language,
  type LocationPreference,
  type MatchProfile,
  type ProfileRow,
} from "@studybuddy/db";
import { Button } from "@studybuddy/ui";
import { LANGUAGE_LABELS } from "@/components/profile-form";
import { Chip, ErrorText, Field, Loading, Muted, PageTitle, Section } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/types";
import { supabase } from "@/lib/supabase";
import { unwrap, useAsync } from "@/lib/use-async";

const LOCATIONS: LocationPreference[] = ["any", "onsite", "remote"];
const AMBITIONS: Ambition[] = ["validation", "bonus"];

type Criteria = { location?: LocationPreference; ambition?: Ambition };

function readCriteria(value: unknown): Required<Criteria> {
  const c = (value && typeof value === "object" ? value : {}) as Criteria;
  return {
    location: LOCATIONS.includes(c.location as LocationPreference) ? (c.location as LocationPreference) : "any",
    ambition: AMBITIONS.includes(c.ambition as Ambition) ? (c.ambition as Ambition) : "validation",
  };
}

function toMatchProfile(
  id: string,
  p: { city: string | null; languages: unknown; availability: unknown },
  criteria: unknown,
): MatchProfile {
  const c = readCriteria(criteria);
  return {
    id,
    city: p.city ?? "",
    languages: (p.languages ?? {}) as MatchProfile["languages"],
    availability: (Array.isArray(p.availability) ? p.availability : []).filter((s): s is AvailabilitySlot =>
      (AVAILABILITY_SLOTS as readonly string[]).includes(s),
    ),
    location: c.location,
    ambition: c.ambition,
  };
}

function topLanguages(languages: unknown) {
  return Object.entries((languages ?? {}) as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${LANGUAGE_LABELS[k as Language] ?? k} ${v}`)
    .join(" · ");
}

export default function GroupsPage() {
  const { profile, refreshProfile } = useSession();
  const { dict } = useI18n();
  const t = dict.groups;
  const router = useRouter();
  const [projectId, setProjectId] = useState("");

  const base = useAsync(async () => {
    const db = supabase();
    const [projects, groups, requests] = await Promise.all([
      db.from("projects").select("id, name, module_code").order("module_code").order("name"),
      db.from("groups").select("id, members, project:projects(name, module_code)").order("created_at", { ascending: false }),
      db.from("group_requests").select("id, size, status, criteria, project:projects(name, module_code)").eq("creator_id", profile.id).order("created_at", { ascending: false }),
    ]);
    return { projects: unwrap(projects), groups: unwrap(groups), requests: unwrap(requests) };
  }, [profile.id]);

  const candidates = useAsync(async () => {
    if (!projectId) return [];
    return unwrap(await supabase().rpc("matchmaking_candidates", { p_project: projectId }));
  }, [projectId]);

  return (
    <div>
      <PageTitle>{t.title}</PageTitle>
      {base.error && <ErrorText>{base.error.message}</ErrorText>}

      <div className="grid gap-x-10 lg:grid-cols-2">
        <Section title={t.mine}>
          {base.loading && !base.data ? (
            <Loading label={dict.common.loading} />
          ) : !base.data?.groups.length ? (
            <Muted>{t.noGroup}</Muted>
          ) : (
            <ul className="divide-y border-b" data-testid="my-groups">
              {base.data.groups.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="mr-2 text-[11px] text-muted-foreground">{g.project?.module_code}</span>
                    <span className="font-bold">{g.project?.name}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">{format(t.members, { n: g.members.length })}</span>
                  </span>
                  <Link href={`/groups/chat/?id=${g.id}`} className="link text-[11px] font-bold lowercase">
                    {t.open} →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t.myRequests}>
          {!base.data?.requests.length ? (
            <Muted>{t.noRequest}</Muted>
          ) : (
            <ul className="divide-y border-b">
              {base.data.requests.map((r) => {
                const c = readCriteria(r.criteria);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-bold">{r.project?.name}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {r.size}p · {t.locations[c.location]} · {t.ambitions[c.ambition]}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 text-[11px]">
                      <span className={r.status === "open" ? "bg-primary px-1 font-bold uppercase text-white" : "uppercase"}>
                        {t.requestStatus[r.status]}
                      </span>
                      {r.status === "open" && (
                        <button
                          type="button"
                          className="link lowercase"
                          onClick={async () => {
                            await supabase().from("group_requests").update({ status: "closed" }).eq("id", r.id);
                            await base.reload();
                          }}
                        >
                          {t.closeRequest}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <Section title={t.find}>
        <Field label={t.project} htmlFor="find-project">
          <select id="find-project" className="field max-w-md" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t.pick}</option>
            {base.data?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.module_code} — {p.name}
              </option>
            ))}
          </select>
        </Field>
        {projectId && (
          <Candidates
            me={profile}
            rows={candidates.data ?? []}
            loading={candidates.loading}
            onJoin={async (requestId) => {
              const groupId = unwrap(await supabase().rpc("join_group_request", { p_request: requestId }));
              router.push(`/groups/chat/?id=${groupId}`);
            }}
          />
        )}
      </Section>

      <CreateRequest
        projects={base.data?.projects ?? []}
        optedIn={profile.matchmaking_opt_in}
        defaultProject={projectId}
        onOptIn={async () => {
          await supabase().from("profiles").update({ matchmaking_opt_in: true }).eq("id", profile.id);
          await refreshProfile();
        }}
        onCreated={base.reload}
      />
    </div>
  );
}

type CandidateRow = {
  request_id: string;
  user_id: string;
  display_name: string | null;
  promo: string | null;
  city: string | null;
  languages: unknown;
  availability: unknown;
  size: number;
  criteria: unknown;
  members: number;
};

function Candidates({ me, rows, loading, onJoin }: { me: ProfileRow; rows: CandidateRow[]; loading: boolean; onJoin: (requestId: string) => Promise<void> }) {
  const { dict } = useI18n();
  const t = dict.groups;
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const ranked = useMemo(() => {
    const byRequest = new Map(rows.map((r) => [r.request_id, r]));
    const seeker = toMatchProfile("me", me, {});
    // the seeker adopts each request's own criteria so location/ambition compare like for like
    return rankCandidates(
      seeker,
      rows.map((r) => toMatchProfile(r.request_id, r, r.criteria)),
    ).map((res) => ({ ...res, row: byRequest.get(res.profile.id)! }));
  }, [rows, me]);

  if (loading) return <Loading label={dict.common.loading} />;
  if (!ranked.length) return <Muted className="mt-4">{t.noCandidates}</Muted>;

  return (
    <>
      <ErrorText>{error}</ErrorText>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="candidates">
        {ranked.map(({ row, score, breakdown }) => {
          const c = readCriteria(row.criteria);
          return (
            <li key={row.request_id} className="border border-foreground">
              <div className="flex items-center justify-between bg-ink px-3 py-2 text-paper">
                <span className="font-display text-lg font-black italic">{row.display_name ?? "—"}</span>
                <span className="bg-primary px-1.5 text-[11px] font-bold text-white">{format(t.match, { score: Math.round(score * 100) })}</span>
              </div>
              <div className="space-y-1 p-3 text-[12px]">
                <div className="font-bold uppercase">
                  {row.promo?.replace("tek", "tek ")} / {dict.campuses[row.city as keyof typeof dict.campuses] ?? row.city}
                </div>
                <div>{topLanguages(row.languages)}</div>
                <div className="text-muted-foreground">
                  {t.locations[c.location]} · {t.ambitions[c.ambition]} · {row.members}/{row.size}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {format(t.breakdown, {
                    schedule: Math.round(breakdown.schedule * 100),
                    level: Math.round(breakdown.level * 100),
                    location: Math.round(breakdown.location * 100),
                  })}
                </div>
                <Button
                  size="sm"
                  variant="red"
                  className="mt-2 w-full"
                  disabled={joining === row.request_id}
                  onClick={async () => {
                    setError(null);
                    setJoining(row.request_id);
                    try {
                      await onJoin(row.request_id);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                      setJoining(null);
                    }
                  }}
                >
                  {t.join}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function CreateRequest({
  projects,
  optedIn,
  defaultProject,
  onOptIn,
  onCreated,
}: {
  projects: { id: string; name: string; module_code: string }[];
  optedIn: boolean;
  defaultProject: string;
  onOptIn: () => Promise<void>;
  onCreated: () => Promise<void>;
}) {
  const { dict } = useI18n();
  const t = dict.groups;
  const [projectId, setProjectId] = useState("");
  const [size, setSize] = useState(3);
  const [location, setLocation] = useState<LocationPreference>("any");
  const [ambition, setAmbition] = useState<Ambition>("validation");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const selected = projectId || defaultProject;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setPending(true);
    setError(null);
    const { error: err } = await supabase().from("group_requests").insert({ project_id: selected, size, criteria: { location, ambition } });
    setPending(false);
    if (err) setError(err.message);
    else await onCreated();
  }

  return (
    <Section title={t.create}>
      {!optedIn && (
        <div className="mb-4 flex flex-wrap items-center gap-3 border-l-4 border-primary bg-primary/10 px-3 py-2 text-[12px]">
          {t.optInWarning}
          <Button size="sm" onClick={() => void onOptIn()}>
            {t.optInButton}
          </Button>
        </div>
      )}
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t.project} htmlFor="req-project">
          <select id="req-project" className="field" value={selected} onChange={(e) => setProjectId(e.target.value)} required>
            <option value="">{t.pick}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.module_code} — {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.size} htmlFor="req-size">
          <input id="req-size" type="number" min={2} max={6} className="field" value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </Field>
        <div>
          <span className="label">{t.location}</span>
          <div className="flex flex-wrap gap-2">
            {LOCATIONS.map((l) => (
              <Chip key={l} active={location === l} onClick={() => setLocation(l)}>
                {t.locations[l]}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <span className="label">{t.ambition}</span>
          <div className="flex flex-wrap gap-2">
            {AMBITIONS.map((a) => (
              <Chip key={a} active={ambition === a} onClick={() => setAmbition(a)}>
                {t.ambitions[a]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="red" disabled={pending || !selected}>
            {pending ? dict.common.saving : t.createButton}
          </Button>
        </div>
      </form>
    </Section>
  );
}
