"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@studybuddy/ui";
import { BoxLogo } from "@/components/box-logo";
import { ConfirmDialog, ErrorText, Field } from "@/components/ui";
import { WrongPassphraseError } from "@/lib/vault";

/** Shown while an encrypted budget is locked. Failed attempts slow down exponentially. */
export function LockScreen({ onUnlock, onWipe }: { onUnlock: (passphrase: string) => Promise<void>; onWipe: () => void }) {
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (waitUntil <= now) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [waitUntil, now]);

  const waiting = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || waiting > 0 || !pass) return;
    setBusy(true);
    setError(null);
    try {
      await onUnlock(pass);
    } catch (err) {
      const n = failures + 1;
      setFailures(n);
      setPass("");
      if (n >= 3) {
        const t = Date.now();
        setNow(t);
        setWaitUntil(t + Math.min(30_000, 1000 * 2 ** (n - 2)));
      }
      setError(err instanceof WrongPassphraseError ? "Code incorrect." : "Impossible de déchiffrer ce budget.");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <BoxLogo className="text-[44px]" />
        <h1 className="display mt-8 text-4xl">verrouillé.</h1>
        <p className="mt-2 text-muted-foreground">Ton budget est chiffré sur cet appareil. Entre ton code pour l&apos;ouvrir.</p>
        <form onSubmit={submit} className="mt-6 space-y-3" noValidate>
          <Field label="Code" htmlFor="unlock-pass">
            <input
              id="unlock-pass"
              ref={input}
              type="password"
              autoComplete="current-password"
              className="field"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              disabled={waiting > 0}
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          {waiting > 0 && (
            <p className="text-[12px]" role="status">
              Trop d&apos;essais. Réessaie dans {waiting} s.
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy || waiting > 0 || !pass}>
            {busy ? "déchiffrement…" : "ouvrir"}
          </Button>
        </form>
        <button type="button" className="link mt-8 text-[11px] text-muted-foreground" onClick={() => setWipeOpen(true)}>
          code oublié ? tout effacer et repartir de zéro
        </button>
      </div>
      <ConfirmDialog
        open={wipeOpen}
        title="tout effacer"
        confirmLabel="effacer"
        confirmDisabled={wipeText.trim().toLowerCase() !== "effacer"}
        onCancel={() => {
          setWipeOpen(false);
          setWipeText("");
        }}
        onConfirm={() => {
          setWipeOpen(false);
          onWipe();
        }}
      >
        <p>Sans le code, les données chiffrées sont irrécupérables. Elles seront supprimées de cet appareil.</p>
        <Field label='Tape "effacer" pour confirmer' htmlFor="lock-wipe-text">
          <input id="lock-wipe-text" className="field" value={wipeText} onChange={(e) => setWipeText(e.target.value)} autoComplete="off" />
        </Field>
      </ConfirmDialog>
    </main>
  );
}
