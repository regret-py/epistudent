"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@studybuddy/ui";
import { useI18n } from "@/lib/i18n/client";
import { NAV_ITEMS } from "./nav-items";

/** Thumb-friendly navigation on phones; becomes a top tab bar on desktop. */
export function BottomNav() {
  const pathname = usePathname();
  const { dict } = useI18n();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:border-t-0 md:bg-transparent md:pb-0 md:backdrop-blur-none"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 md:flex md:max-w-none md:gap-1">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors md:flex-row md:gap-2 md:rounded-md md:px-3 md:text-sm",
                  active ? "text-primary md:bg-accent md:text-foreground" : "hover:text-foreground",
                )}
              >
                <Icon className="size-5 md:size-4" />
                {dict.nav[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
