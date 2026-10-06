import { cn } from "@studybuddy/ui";

/** Ink box, paper heavy oblique — the brand mark. */
export function BoxLogo({ className, children = "epistudent" }: { className?: string; children?: React.ReactNode }) {
  return <span className={cn("box-logo text-[22px]", className)}>{children}</span>;
}
