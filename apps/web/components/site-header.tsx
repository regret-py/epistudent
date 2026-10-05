"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@studybuddy/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/client";
import { supabase } from "@/lib/supabase";
import { BoxLogo } from "./box-logo";
import { PrefsLinks } from "./prefs-links";

export const NAV = [
  { href: "/dashboard/", key: "dashboard" },
  { href: "/deadlines/", key: "deadlines" },
  { href: "/groups/", key: "groups" },
  { href: "/rooms/", key: "rooms" },
  { href: "/moulinette/", key: "moulinette" },
  { href: "/swaps/", key: "swaps" },
  { href: "/bocal/", key: "bocal" },
] as const;

function useUnreadCount(userId: string | undefined) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const client = supabase();
    const load = async () => {
      const { count: c } = await client
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      setCount(c ?? 0);
    };
    void load();
    const channel = client
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [userId]);
  return count;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { dict } = useI18n();
  const { user, signOut } = useAuth();
  const unread = useUnreadCount(user?.id);

  return (
    <header className="pt-[env(safe-area-inset-top)]">
      <div className="container flex items-start justify-between gap-4 pb-3 pt-5">
        <Link href="/dashboard/" aria-label="epistudent">
          <BoxLogo className="text-[28px] sm:text-[34px]" />
        </Link>
        <div className="flex flex-col items-end gap-1 text-[11px] lowercase">
          <div className="flex items-center gap-3">
            <Link href="/profile/" className={cn("link", pathname.startsWith("/profile") && "underline")} data-testid="nav-profile">
              {dict.nav.profile}
              {unread > 0 && (
                <span data-testid="unread-count" className="ml-1 bg-primary px-1 font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
            <button type="button" className="link lowercase" onClick={() => void signOut()}>
              {dict.common.signOut}
            </button>
          </div>
          <PrefsLinks />
        </div>
      </div>
      <nav aria-label="main" className="container">
        <ul className="-mx-1 flex gap-x-1 overflow-x-auto whitespace-nowrap border-y border-foreground py-2 text-[12px] font-bold lowercase [scrollbar-width:none] sm:gap-x-3">
          {NAV.map(({ href, key }) => {
            const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
            const active = path.startsWith(href);
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("px-1 py-0.5 hover:bg-primary hover:text-white", active && "bg-ink text-paper")}
                >
                  {dict.nav[key]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
