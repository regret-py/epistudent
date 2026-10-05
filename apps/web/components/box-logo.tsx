import { cn } from "@studybuddy/ui";

/** Red box logo, heavy oblique type. */
export function BoxLogo({ className, children = "epistudent" }: { className?: string; children?: React.ReactNode }) {
  return <span className={cn("box-logo text-[22px]", className)}>{children}</span>;
}
