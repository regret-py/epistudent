import { LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@studybuddy/ui";
import { getDictionary } from "@/lib/i18n/server";
import { BottomNav } from "./bottom-nav";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader() {
  const dict = getDictionary();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="container flex h-14 items-center gap-4">
        <Link href="/dashboard" className="shrink-0">
          <Logo className="text-sm" />
        </Link>
        <div className="hidden flex-1 md:block">
          <BottomNav />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="icon" type="submit" aria-label={dict.common.signOut}>
              <LogOut />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
