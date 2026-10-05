"use client";

import { useEffect, useState } from "react";
import { CAMPUSES, type Campus } from "@studybuddy/db";
import { Button, cn } from "@studybuddy/ui";
import { ErrorText, Field, Loading, Muted, PageTitle, Section } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { formatRelative } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/types";
import { supabase } from "@/lib/supabase";
import { unwrap, useAsync } from "@/lib/use-async";

type Report = {
  id: string;
  room: string;
  seats_free: number;
  reported_by: string;
  created_at: string;
  expires_at: string;
  room_confirmations: { user_id: string }[];
};

export default function RoomsPage() {
  const { profile, refreshProfile } = useSession();
  const { dict, locale } = useI18n();
  const t = dict.rooms;
  const [campus, setCampus] = useState<Campus>(((CAMPUSES as readonly string[]).includes(profile.city ?? "") ? profile.city : "paris") as Campus);
  const [selected, setSelected] = useState<string | null>(null);

  const reports = useAsync(async () => {
    const res = await supabase()
      .from("room_reports")
      .select("id, room, seats_free, reported_by, created_at, expires_at, room_confirmations(user_id)")
      .eq("campus", campus)
      .order("created_at", { ascending: false });
    // keep only the latest report per room
    const latest = new Map<string, Report>();
    for (const r of unwrap(res) as Report[]) if (!latest.has(r.room.toLowerCase())) latest.set(r.room.toLowerCase(), r);
    return [...latest.values()].sort((a, b) => b.seats_free - a.seats_free);
  }, [campus]);

  useEffect(() => {
    const client = supabase();
    const channel = client
      .channel(`rooms:${campus}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_reports", filter: `campus=eq.${campus}` }, () => void reports.reload())
      .subscribe();
    // expired reports vanish without any event
    const timer = setInterval(() => void reports.reload(), 60_000);
    return () => {
      clearInterval(timer);
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus]);

  const list = reports.data ?? [];

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

      <div className="grid gap-x-10 lg:grid-cols-[3fr_2fr]">
        <Section title={`${t.map} — ${dict.campuses[campus]}`}>
          <RoomMap reports={list} selected={selected} onSelect={setSelected} campusLabel={dict.campuses[campus]} />
          <p className="mt-2 text-[11px] text-muted-foreground">{t.legend}</p>
        </Section>

        <Section title={`${t.live} · ${list.length}`}>
          {reports.loading && !reports.data ? (
            <Loading label={dict.common.loading} />
          ) : !list.length ? (
            <Muted>{t.empty}</Muted>
          ) : (
            <ul className="divide-y border-b" data-testid="room-list">
              {list.map((r) => {
                const confirmed = r.room_confirmations.some((c) => c.user_id === profile.id);
                const own = r.reported_by === profile.id;
                return (
                  <li
                    key={r.id}
                    onMouseEnter={() => setSelected(r.id)}
                    className={cn("flex items-center justify-between gap-3 py-2 pl-2", selected === r.id && "bg-primary/10")}
                  >
                    <div>
                      <div className="font-bold">{r.room}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {format(t.reportedAgo, { when: formatRelative(r.created_at, locale) })} · {format(t.expires, { when: formatRelative(r.expires_at, locale) })}
                        {r.room_confirmations.length > 0 && ` · ✓${r.room_confirmations.length}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap bg-ink px-1.5 py-0.5 text-[11px] font-bold text-paper">{format(t.seats, { n: r.seats_free })}</span>
                      {!own && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={confirmed}
                          onClick={async () => {
                            await supabase().from("room_confirmations").insert({ report_id: r.id });
                            await reports.reload();
                          }}
                        >
                          {confirmed ? t.confirmed : t.confirm}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <ReportForm
        campus={campus}
        onReported={async () => {
          await Promise.all([reports.reload(), refreshProfile()]);
        }}
      />
    </div>
  );
}

/** Schematic campus plan: one block per reported room, area ∝ free seats. */
function RoomMap({ reports, selected, onSelect, campusLabel }: { reports: Report[]; selected: string | null; onSelect: (id: string) => void; campusLabel: string }) {
  const cols = 4;
  const cell = { w: 140, h: 90, gap: 10 };
  const rows = Math.max(2, Math.ceil(reports.length / cols));
  const width = cols * (cell.w + cell.gap) + cell.gap;
  const height = rows * (cell.h + cell.gap) + cell.gap + 24;
  const maxSeats = Math.max(10, ...reports.map((r) => r.seats_free));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full border border-foreground bg-background" role="img" aria-label={campusLabel}>
      <text x={cell.gap} y={16} className="fill-foreground text-[11px] font-bold uppercase">
        {campusLabel}
      </text>
      {Array.from({ length: rows * cols }, (_, i) => {
        const x = cell.gap + (i % cols) * (cell.w + cell.gap);
        const y = 24 + cell.gap + Math.floor(i / cols) * (cell.h + cell.gap);
        const report = reports[i];
        if (!report) {
          return <rect key={i} x={x} y={y} width={cell.w} height={cell.h} className="fill-muted stroke-border" strokeDasharray="4 4" />;
        }
        const ratio = Math.min(1, report.seats_free / maxSeats);
        const inner = { w: cell.w * (0.35 + 0.65 * ratio), h: cell.h * (0.35 + 0.65 * ratio) };
        const active = selected === report.id;
        return (
          <g key={report.id} onClick={() => onSelect(report.id)} className="cursor-pointer">
            <title>{`${report.room} — ${report.seats_free}`}</title>
            <rect x={x} y={y} width={cell.w} height={cell.h} className={cn("fill-background stroke-foreground", active && "stroke-primary")} strokeWidth={active ? 3 : 1} />
            <rect x={x + (cell.w - inner.w) / 2} y={y + (cell.h - inner.h) / 2} width={inner.w} height={inner.h} className="fill-primary" opacity={0.35 + 0.65 * ratio} />
            <text x={x + 6} y={y + 16} className="fill-foreground text-[12px] font-bold">
              {report.room.slice(0, 18)}
            </text>
            <text x={x + cell.w - 6} y={y + cell.h - 8} textAnchor="end" className="fill-foreground text-[18px] font-black italic">
              {report.seats_free}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ReportForm({ campus, onReported }: { campus: Campus; onReported: () => Promise<void> }) {
  const { dict } = useI18n();
  const t = dict.rooms;
  const [room, setRoom] = useState("");
  const [seats, setSeats] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!room.trim()) return;
    setPending(true);
    setError(null);
    const { error: err } = await supabase().from("room_reports").insert({ campus, room: room.trim(), seats_free: seats });
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setRoom("");
    await onReported();
  }

  return (
    <Section title={t.report}>
      <form onSubmit={submit} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
        <Field label={t.room} htmlFor="room">
          <input id="room" className="field" placeholder="Midlab, Hub, 3.04…" value={room} maxLength={64} onChange={(e) => setRoom(e.target.value)} required />
        </Field>
        <Field label={t.seatsFree} htmlFor="seats">
          <input id="seats" type="number" min={0} max={500} className="field" value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
        </Field>
        <Button type="submit" variant="red" disabled={pending}>
          {t.reportButton}
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
      <p className="mt-2 text-[11px] text-muted-foreground">{t.karmaHint}</p>
    </Section>
  );
}
