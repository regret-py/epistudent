import { cn } from "@studybuddy/ui";

export function PageTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-display text-4xl font-black italic leading-none tracking-tight sm:text-5xl">{children}</h1>
      {aside}
    </div>
  );
}

export function Section({ title, children, className, id }: { title: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("mb-10", className)}>
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

export function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-muted-foreground", className)}>{children}</p>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="border-l-4 border-primary bg-primary/10 px-3 py-2 text-[12px]">
      {children}
    </p>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Toggle chip used for filters and multi-selects. */
export function Chip({ active, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-foreground hover:bg-ink hover:text-paper",
        className,
      )}
      {...props}
    />
  );
}

export function Loading({ label }: { label: string }) {
  return <p className="animate-pulse py-6 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>;
}
