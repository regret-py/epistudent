"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { MessageRow } from "@studybuddy/db";
import { Button, cn } from "@studybuddy/ui";
import { ErrorText, Loading, PageTitle } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { supabase } from "@/lib/supabase";
import { unwrap, useAsync } from "@/lib/use-async";

function Chat() {
  const id = useSearchParams().get("id") ?? "";
  const { user } = useSession();
  const { dict, locale } = useI18n();
  const t = dict.chat;
  const router = useRouter();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const meta = useAsync(async () => {
    const db = supabase();
    const [group, members, history] = await Promise.all([
      db.from("groups").select("id, project:projects(name, module_code)").eq("id", id).maybeSingle(),
      db.rpc("group_members", { p_group: id }),
      db.from("messages").select("*").eq("group_id", id).order("created_at").limit(500),
    ]);
    setMessages(unwrap(history) ?? []);
    return { group: unwrap(group), members: unwrap(members) ?? [] };
  }, [id]);

  // live messages
  useEffect(() => {
    if (!id) return;
    const client = supabase();
    const channel = client
      .channel(`messages:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${id}` }, (payload) => {
        const msg = payload.new as MessageRow;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (meta.loading && !meta.data) return <Loading label={dict.common.loading} />;
  if (!meta.data?.group) {
    return (
      <div>
        <ErrorText>{t.notFound}</ErrorText>
        <Link href="/groups/" className="link mt-4 inline-block">
          {t.back}
        </Link>
      </div>
    );
  }

  const names = new Map(meta.data.members.map((m) => [m.user_id, m.display_name ?? m.email.split("@")[0]]));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setError(null);
    const { data, error: err } = await supabase().from("messages").insert({ group_id: id, content }).select().single();
    if (err) {
      setError(err.message);
      return;
    }
    setDraft("");
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
  }

  return (
    <div>
      <Link href="/groups/" className="link text-[11px] lowercase">
        {t.back}
      </Link>
      <PageTitle
        aside={
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!window.confirm(t.leaveConfirm)) return;
              await supabase().rpc("leave_group", { p_group: id });
              router.push("/groups/");
            }}
          >
            {t.leave}
          </Button>
        }
      >
        {meta.data.group.project?.name}
      </PageTitle>
      <p className="mb-4 text-[11px] uppercase tracking-wider text-muted-foreground">
        {meta.data.members.map((m) => (m.user_id === user.id ? t.you : names.get(m.user_id))).join(" / ")}
      </p>

      <div className="h-[55dvh] overflow-y-auto border border-foreground p-3" data-testid="chat-log">
        {messages.map((m) => {
          const mine = m.user_id === user.id;
          return (
            <div key={m.id} className={cn("mb-3 flex flex-col", mine ? "items-end" : "items-start")}>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {mine ? t.you : names.get(m.user_id) ?? "?"} · {formatDateTime(m.created_at, locale)}
              </span>
              <span className={cn("mt-0.5 max-w-[85%] whitespace-pre-wrap px-3 py-2", mine ? "bg-primary text-white" : "bg-ink text-paper")}>
                {m.content}
              </span>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2 pb-[env(safe-area-inset-bottom)]">
        <input className="field" placeholder={t.placeholder} value={draft} maxLength={4000} onChange={(e) => setDraft(e.target.value)} aria-label={t.placeholder} />
        <Button type="submit" variant="red">
          {dict.common.send}
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}
