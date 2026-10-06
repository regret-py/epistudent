"use client";

import { useEffect, useRef } from "react";
import { Button, cn } from "@studybuddy/ui";

export function Section({
  title,
  aside,
  children,
  className,
  id,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("mb-14", className)}>
      <h2 id={id ? `${id}-title` : undefined} className="section-title">
        <span>{title}</span>
        {aside && <span className="text-[10px] font-normal normal-case tracking-normal">{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="border-l-4 border-ink px-3 py-2 text-[12px] font-bold">
      {children}
    </p>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
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

/** Toggle chip (filters, two-way switches). */
export function Chip({ active, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "h-9 border border-ink px-4 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors",
        active ? "bg-ink text-paper" : "bg-background hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

/** Accessible modal confirmation built on the native <dialog> element. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  confirmDisabled,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
  }, [open]);
  // only mounted while open: one dialog in the DOM at a time
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="w-[min(92vw,26rem)] border-2 border-ink bg-background p-0 text-foreground backdrop:bg-ink/60"
    >
      <div className="bg-ink px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-paper">{title}</div>
      <div className="space-y-3 p-4 text-[13px]">{children}</div>
      <div className="flex justify-end gap-2 border-t border-ink p-3">
        <Button variant="outline" size="sm" onClick={onCancel}>
          annuler
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={confirmDisabled} data-testid="confirm">
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
