"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, cn } from "@studybuddy/ui";
import { PrefsLinks } from "@/components/prefs-links";
import { ProfileForm } from "@/components/profile-form";
import { Loading, Muted, PageTitle, Section } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { supabase } from "@/lib/supabase";
import { unwrap, useAsync } from "@/lib/use-async";

const LINKS: Record<string, (payload: Record<string, string>) => string> = {
  group_joined: (p) => `/groups/chat/?id=${p.group_id}`,
  swap_matched: () => "/swaps/",
  bocal_turn: () => "/bocal/",
};

export default function ProfilePage() {
  const { profile, refreshProfile, signOut } = useSession();
  const { dict, locale } = useI18n();
  const t = dict.profile;
  const [saved, setSaved] = useState(false);

  const notifications = useAsync(async () => {
    return unwrap(await supabase().from("notifications").select("*").order("created_at", { ascending: false }).limit(50));
  }, []);

  const unread = (notifications.data ?? []).filter((n) => !n.read_at);

  return (
    <div>
      <PageTitle aside={<span className="text-[12px] text-muted-foreground">{profile.email}</span>}>{t.title}</PageTitle>

      <Section title={`${t.notifications}${unread.length ? ` (${unread.length})` : ""}`} id="notifications">
        {notifications.loading && !notifications.data ? (
          <Loading label={dict.common.loading} />
        ) : !notifications.data?.length ? (
          <Muted>{t.noNotifications}</Muted>
        ) : (
          <>
            <ul className="divide-y border-b" data-testid="notifications">
              {notifications.data.map((n) => (
                <li key={n.id} className={cn("flex items-center justify-between gap-3 py-2", !n.read_at && "font-bold")}>
                  <Link href={LINKS[n.kind]?.((n.payload ?? {}) as Record<string, string>) ?? "/dashboard/"} className="link">
                    {!n.read_at && <span className="mr-2 inline-block size-2 bg-primary" />}
                    {t.kinds[n.kind as keyof typeof t.kinds] ?? n.kind}
                  </Link>
                  <span className="shrink-0 text-[11px] font-normal text-muted-foreground">{formatDateTime(n.created_at, locale)}</span>
                </li>
              ))}
            </ul>
            {unread.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={async () => {
                  await supabase().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
                  await notifications.reload();
                }}
              >
                {t.markRead}
              </Button>
            )}
          </>
        )}
      </Section>

      <Section title={t.edit}>
        <ProfileForm
          profile={profile}
          submitLabel={dict.common.save}
          onSaved={async () => {
            await refreshProfile();
            setSaved(true);
          }}
        />
        {saved && <p className="mt-3 font-bold text-primary">{t.saved}</p>}
      </Section>

      <Section title={t.preferences}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PrefsLinks />
          <Button variant="outline" onClick={() => void signOut()}>
            {dict.common.signOut}
          </Button>
        </div>
      </Section>
    </div>
  );
}
