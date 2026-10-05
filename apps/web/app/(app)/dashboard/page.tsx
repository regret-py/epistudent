"use client";

import Link from "next/link";
import { cn } from "@studybuddy/ui";
import { Loading, Section } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { formatDateTime, formatRelative, urgencyOf } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/types";
import { supabase } from "@/lib/supabase";
import { unwrap, useAsync } from "@/lib/use-async";

const TILES = [
  { key: "deadlines", href: "/deadlines/", tone: "red" },
  { key: "groups", href: "/groups/", tone: "ink" },
  { key: "rooms", href: "/rooms/", tone: "paper" },
  { key: "moulinette", href: "/moulinette/", tone: "paper" },
  { key: "swaps", href: "/swaps/", tone: "red" },
  { key: "bocal", href: "/bocal/", tone: "ink" },
] as const;

const TONES = {
  red: "bg-primary text-white",
  ink: "bg-ink text-paper",
  paper: "bg-background text-foreground",
};

export default function DashboardPage() {
  const { profile } = useSession();
  const { dict, locale } = useI18n();
  const t = dict.dashboard;

  const { data, loading } = useAsync(async () => {
    const db = supabase();
    const now = new Date().toISOString();
    const [deadlines, groups, rooms, moulinette, swaps, bocal] = await Promise.all([
      db.from("deadlines").select("id, status, projects!inner(name, module_code, deadline)").neq("status", "done").gte("projects.deadline", now).order("deadline", { referencedTable: "projects" }),
      db.from("groups").select("id", { count: "exact", head: true }),
      db.from("room_reports").select("id", { count: "exact", head: true }).eq("campus", profile.city ?? ""),
      db.rpc("moulinette_overview"),
      db.from("defense_swaps").select("id", { count: "exact", head: true }).eq("status", "open"),
      db.from("assistants_status").select("id", { count: "exact", head: true }).eq("available", true),
    ]);
    const upcoming = unwrap(deadlines)
      .map((d) => ({ id: d.id, ...d.projects }))
      .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
    return {
      upcoming,
      counts: {
        deadlines: upcoming.length,
        groups: groups.count ?? 0,
        rooms: rooms.count ?? 0,
        moulinette: unwrap(moulinette).length,
        swaps: swaps.count ?? 0,
        bocal: bocal.count ?? 0,
      },
    };
  }, [profile.city]);

  const name = profile.display_name?.split(" ")[0] ?? profile.email.split(/[.@]/)[0] ?? "";
  const campus = profile.city && profile.city in dict.campuses ? dict.campuses[profile.city as keyof typeof dict.campuses] : profile.city;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black italic sm:text-6xl" data-testid="dashboard-greeting">
            {format(t.greeting, { name: name.toLowerCase() })}
          </h1>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-widest">
            {profile.promo?.replace("tek", "tek ")} / {campus}
          </p>
        </div>
        <div className="border border-foreground px-3 py-2 text-right">
          <div className="text-[10px] font-bold uppercase tracking-widest">{t.karma}</div>
          <div className="font-display text-3xl font-black italic leading-none tabular-nums" data-testid="karma">
            {profile.karma}
          </div>
        </div>
      </div>

      <ul className="mb-12 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5">
        {TILES.map(({ key, href, tone }) => (
          <li key={key}>
            <Link href={href} className="group block">
              <div
                className={cn(
                  "flex aspect-square items-center justify-center border border-foreground transition-transform group-hover:-translate-y-1",
                  TONES[tone],
                )}
              >
                <span className="font-display text-2xl font-black italic lowercase sm:text-4xl">{dict.nav[key]}</span>
              </div>
              <div className="mt-2 text-[12px] font-bold lowercase group-hover:underline">{dict.nav[key]}</div>
              <div className="text-[12px] text-muted-foreground">
                {loading || !data ? "—" : format(t.tiles[key], { n: data.counts[key] })}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Section title={t.nextUp}>
        {loading ? (
          <Loading label={dict.common.loading} />
        ) : !data?.upcoming.length ? (
          <p className="text-muted-foreground">{t.noDeadline}</p>
        ) : (
          <ul className="divide-y border-b">
            {data.upcoming.slice(0, 5).map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  <span className="mr-2 text-[11px] text-muted-foreground">{d.module_code}</span>
                  <span className="font-bold">{d.name}</span>
                </span>
                <span className={cn("shrink-0 text-right text-[12px]", urgencyOf(d.deadline) !== "later" && "font-bold text-primary")}>
                  {d.deadline ? `${formatDateTime(d.deadline, locale)} · ${formatRelative(d.deadline, locale)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
