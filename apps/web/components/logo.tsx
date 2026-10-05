import { GraduationCap } from "lucide-react";
import { cn } from "@studybuddy/ui";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <GraduationCap className="size-5" />
      </span>
      <span>
        StudyBuddy <span className="text-muted-foreground">Epitech</span>
      </span>
    </span>
  );
}
