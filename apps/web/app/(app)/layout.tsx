import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { getCurrentProfile } from "@/lib/profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentProfile();
  if (!profile.onboarded_at) redirect("/onboarding");

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      {/* bottom padding keeps content clear of the fixed mobile nav */}
      <main className="container flex-1 py-6 pb-28 md:pb-10">{children}</main>
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
