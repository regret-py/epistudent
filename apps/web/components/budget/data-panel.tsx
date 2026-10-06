"use client";

import { useRef, useState } from "react";
import { Button, cn } from "@studybuddy/ui";
import { ConfirmDialog, ErrorText, Field } from "@/components/ui";
import { LIMITS, monthKey, type BudgetState } from "@/lib/budget";
import { readImport } from "@/lib/use-budget";
import { MIN_PASSPHRASE, WrongPassphraseError, passphraseStrength } from "@/lib/vault";

type Props = {
  encrypted: boolean;
  entriesCount: number;
  onEnableLock: (passphrase: string) => Promise<void>;
  onDisableLock: () => void;
  onLock: () => void;
  onExport: () => Promise<string>;
  onReplace: (state: BudgetState) => void;
  onWipe: () => void;
};

export function DataPanel({ encrypted, entriesCount, onEnableLock, onDisableLock, onLock, onExport, onReplace, onWipe }: Props) {
  const [mode, setMode] = useState<"idle" | "set">("idle");
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<BudgetState | null>(null);
  const [importFile, setImportFile] = useState<string | null>(null);
  const [importPass, setImportPass] = useState("");
  const [dialog, setDialog] = useState<"none" | "unlock-off" | "wipe">("none");
  const [wipeText, setWipeText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const strength = pass ? passphraseStrength(pass) : null;

  async function saveCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pass.length < MIN_PASSPHRASE) return setError(`Au moins ${MIN_PASSPHRASE} caractères.`);
    if (pass !== confirmPass) return setError("Les deux codes ne correspondent pas.");
    setBusy(true);
    try {
      await onEnableLock(pass);
      setMode("idle");
      setPass("");
      setConfirmPass("");
      setNotice("Budget chiffré. Garde ton code : sans lui, les données sont irrécupérables.");
    } catch {
      setError("Chiffrement impossible sur ce navigateur.");
    } finally {
      setBusy(false);
    }
  }

  async function exportFile() {
    const text = await onExport();
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-epistudent-${monthKey(new Date())}${encrypted ? "-chiffre" : ""}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(encrypted ? "Export chiffré : il faudra ton code pour le réimporter." : "Export en clair : garde ce fichier en lieu sûr.");
  }

  async function handleImport(text: string, passphrase?: string) {
    setError(null);
    try {
      const result = await readImport(text, passphrase);
      if (result === "needs-passphrase") {
        setImportFile(text);
        return;
      }
      setImportFile(null);
      setImportPass("");
      setPending(result);
    } catch (err) {
      if (err instanceof WrongPassphraseError) setError("Code incorrect pour ce fichier.");
      else if (err instanceof Error && err.message === "Fichier trop gros.") setError(err.message);
      else setError("Fichier illisible : ce n'est pas un export epistudent.");
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* protection */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className={cn("border-2 border-ink px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em]", encrypted && "bg-ink text-paper")} data-testid="lock-status">
            {encrypted ? "chiffré · aes-256" : "non protégé"}
          </span>
        </div>
        <p className="mb-4 text-muted-foreground">
          {encrypted
            ? "Tes données sont chiffrées dans ce navigateur avec ton code. Verrouillage automatique après 5 minutes d'inactivité."
            : "Ajoute un code pour chiffrer ton budget sur cet appareil (utile sur un ordinateur partagé)."}
        </p>

        {mode === "set" ? (
          <form onSubmit={saveCode} className="space-y-3" noValidate>
            <Field label="Nouveau code" htmlFor="new-pass" hint={strength && <>Solidité : <strong data-testid="strength">{strength}</strong> — une phrase de quelques mots est le plus sûr.</>}>
              <input id="new-pass" type="password" autoComplete="new-password" className="field" value={pass} onChange={(e) => setPass(e.target.value)} maxLength={256} />
            </Field>
            <Field label="Confirme le code" htmlFor="confirm-pass">
              <input id="confirm-pass" type="password" autoComplete="new-password" className="field" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} maxLength={256} />
            </Field>
            <ErrorText>{error}</ErrorText>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "chiffrement…" : encrypted ? "changer le code" : "chiffrer"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setMode("idle")}>
                annuler
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setMode("set")}>
              {encrypted ? "changer le code" : "protéger par un code"}
            </Button>
            {encrypted && (
              <>
                <Button size="sm" variant="outline" onClick={onLock}>
                  verrouiller
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDialog("unlock-off")}>
                  retirer le code
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* files */}
      <div>
        <p className="mb-4 text-muted-foreground">
          Rien ne quitte ton appareil : pas de compte, pas de serveur, aucune requête réseau. Exporte un fichier pour sauvegarder ou changer d&apos;appareil.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void exportFile()} disabled={entriesCount === 0}>
            exporter
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
            importer
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog("wipe")}>
            tout effacer
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > LIMITS.importBytes) return setError("Fichier trop gros.");
              void f.text().then((t) => handleImport(t));
            }}
          />
        </div>
        {importFile && (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleImport(importFile, importPass);
            }}
          >
            <Field label="Code de ce fichier chiffré" htmlFor="import-pass">
              <input id="import-pass" type="password" autoComplete="current-password" className="field" value={importPass} onChange={(e) => setImportPass(e.target.value)} />
            </Field>
            <Button size="sm" type="submit">
              déchiffrer
            </Button>
          </form>
        )}
        {mode !== "set" && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}
        {notice && (
          <p className="mt-3 border-l-4 border-ink px-3 py-2 text-[12px]" role="status">
            {notice}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="importer"
        confirmLabel="remplacer"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) onReplace(pending);
          setPending(null);
          setNotice(`Import terminé : ${pending?.entries.length ?? 0} lignes.`);
        }}
      >
        <p>
          Remplacer ton budget actuel ({entriesCount} lignes) par ce fichier ({pending?.entries.length ?? 0} lignes) ?
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "unlock-off"}
        title="retirer le code"
        confirmLabel="retirer"
        onCancel={() => setDialog("none")}
        onConfirm={() => {
          onDisableLock();
          setDialog("none");
          setNotice("Code retiré : le budget est stocké en clair sur cet appareil.");
        }}
      >
        <p>Ton budget sera de nouveau stocké en clair dans ce navigateur.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "wipe"}
        title="tout effacer"
        confirmLabel="effacer"
        confirmDisabled={wipeText.trim().toLowerCase() !== "effacer"}
        onCancel={() => {
          setDialog("none");
          setWipeText("");
        }}
        onConfirm={() => {
          onWipe();
          setDialog("none");
          setWipeText("");
          setNotice("Tout a été effacé de cet appareil.");
        }}
      >
        <p>Toutes les lignes, l&apos;objectif, les plafonds et le code seront supprimés de cet appareil. C&apos;est définitif.</p>
        <Field label='Tape "effacer" pour confirmer' htmlFor="wipe-text">
          <input id="wipe-text" className="field" value={wipeText} onChange={(e) => setWipeText(e.target.value)} autoComplete="off" />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
