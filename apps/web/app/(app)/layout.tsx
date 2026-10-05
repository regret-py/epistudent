"use client";

import { Protected } from "@/components/protected";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Protected>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="container flex-1 pt-8">{children}</main>
        <SiteFooter />
      </div>
    </Protected>
  );
}
