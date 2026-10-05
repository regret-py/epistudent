import Link from "next/link";
import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { Button } from "@studybuddy/ui";
import { SECTION_KEYS, type NavKey } from "@/components/nav-items";
import { getDictionary } from "@/lib/i18n/server";

function isSection(value: string): value is Exclude<NavKey, "dashboard"> {
  return (SECTION_KEYS as readonly string[]).includes(value);
}

export default function SectionPage({ params }: { params: { section: string } }) {
  if (!isSection(params.section)) notFound();
  const dict = getDictionary();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Construction className="size-7" />
      </span>
      <h1 className="text-2xl font-bold">{dict.nav[params.section]}</h1>
      <p className="text-muted-foreground">{dict.section.comingSoon}</p>
      <Button asChild variant="outline">
        <Link href="/dashboard">{dict.section.back}</Link>
      </Button>
    </div>
  );
}
