import { ArrowLeftRight, CalendarClock, DoorOpen, FlaskConical, Headset, Sparkles, Users } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@studybuddy/ui";
import { getCurrentProfile } from "@/lib/profile";
import { getDictionary } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/types";

export const metadata = { title: "Dashboard" };

const FEATURES = [
  { key: "groups", icon: Users },
  { key: "rooms", icon: DoorOpen },
  { key: "moulinette", icon: FlaskConical },
  { key: "swaps", icon: ArrowLeftRight },
  { key: "bocal", icon: Headset },
] as const;

export default async function DashboardPage() {
  const { profile } = await getCurrentProfile();
  const dict = getDictionary();
  const t = dict.dashboard;
  const firstName = profile.display_name?.split(" ")[0] ?? profile.email.split(/[.@]/)[0];
  const campus = profile.city && profile.city in dict.campuses ? dict.campuses[profile.city as keyof typeof dict.campuses] : profile.city;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="dashboard-greeting">
            {format(t.greeting, { name: firstName ?? "" })} 👋
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.promo && <Badge variant="secondary">{profile.promo.replace("tek", "Tek")}</Badge>}
            {campus && <Badge variant="outline">{campus}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm text-muted-foreground">{t.karma}</span>
          <span className="text-lg font-semibold tabular-nums">{profile.karma}</span>
        </div>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-primary" />
            {t.deadlines.title}
          </CardTitle>
          <Badge variant="outline">{dict.common.soon}</Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3" style={{ opacity: 0.6 - i * 0.18 }}>
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <p className="font-medium">{t.deadlines.empty}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{t.deadlines.emptyHint}</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ key, icon: Icon }) => (
          <Card key={key} className="group relative overflow-hidden transition-colors hover:border-primary/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <Badge variant="secondary">{dict.common.soon}</Badge>
              </div>
              <CardTitle className="pt-3 text-base">{t.features[key].title}</CardTitle>
              <CardDescription>{t.features[key].description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
