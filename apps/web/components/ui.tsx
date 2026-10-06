import { cn } from "@studybuddy/ui";

export function Section({ title, aside, children, className, id }: { title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("mb-16", className)}>
      <h2 id={id ? `${id}-title` : undefined} className="section-title">
        <span>{title}</span>
        {aside && <span className="text-[10px] font-normal normal-case tracking-normal">{aside}</span>}
      </h2>
      {children}
    </section>
  );
}
