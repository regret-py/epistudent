"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_STATE, LIMITS, newId, parseState, shiftMonth, type BudgetState, type Entry, type ExpenseCategory } from "./budget";
import { deriveKey, isEnvelope, open, openWithKey, seal, type VaultKey } from "./vault";

export const STORAGE_KEY = "epistudent-budget";
/** Auto-lock an encrypted budget after this much inactivity. */
export const AUTO_LOCK_MS = 5 * 60_000;

export type Status = "loading" | "locked" | "ready";

function readRaw(): unknown {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRaw(value: unknown) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // quota or blocked storage: the budget keeps working in memory for this visit
  }
}

/**
 * The budget, persisted in this browser only. Plain JSON by default; when a code is set
 * it is stored as an AES-GCM envelope and the decrypted copy only exists in memory.
 */
export function useBudget() {
  const [status, setStatus] = useState<Status>("loading");
  const [state, setState] = useState<BudgetState>(EMPTY_STATE);
  const [encrypted, setEncrypted] = useState(false);
  const vault = useRef<VaultKey | null>(null);
  const skipSave = useRef(true);
  const writeSeq = useRef(0);

  // initial load
  useEffect(() => {
    const raw = readRaw();
    if (isEnvelope(raw)) {
      setEncrypted(true);
      setStatus("locked");
    } else {
      skipSave.current = true;
      setState(parseState(raw));
      setStatus("ready");
    }
  }, []);

  // persist every change made in this tab
  useEffect(() => {
    if (status !== "ready") return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const seq = ++writeSeq.current;
    const json = JSON.stringify(state);
    if (vault.current) {
      const key = vault.current;
      void seal(key, json).then((env) => {
        // a newer write (or a lock) may have happened meanwhile
        if (seq === writeSeq.current && vault.current === key) writeRaw(env);
      });
    } else {
      writeRaw(state);
    }
  }, [state, status]);

  // keep several tabs in sync without ping-pong writes
  useEffect(() => {
    const onStorage = async (ev: StorageEvent) => {
      if (ev.key !== STORAGE_KEY) return;
      let raw: unknown = null;
      try {
        raw = ev.newValue ? JSON.parse(ev.newValue) : null;
      } catch {
        return;
      }
      if (isEnvelope(raw)) {
        setEncrypted(true);
        if (!vault.current) {
          setStatus("locked");
          return;
        }
        try {
          const plain = await openWithKey(raw, vault.current);
          skipSave.current = true;
          setState(parseState(JSON.parse(plain)));
        } catch {
          // code changed elsewhere: lock this tab
          vault.current = null;
          setState(EMPTY_STATE);
          setStatus("locked");
        }
      } else {
        vault.current = null;
        setEncrypted(false);
        skipSave.current = true;
        setState(parseState(raw));
        setStatus("ready");
      }
    };
    const handler = (ev: StorageEvent) => void onStorage(ev);
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const lock = useCallback(() => {
    if (!vault.current) return;
    vault.current = null;
    writeSeq.current++;
    skipSave.current = true;
    setState(EMPTY_STATE);
    setStatus("locked");
  }, []);

  // auto-lock after inactivity
  useEffect(() => {
    if (!encrypted || status !== "ready") return;
    let timer = window.setTimeout(lock, AUTO_LOCK_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, AUTO_LOCK_MS);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [encrypted, status, lock]);

  const unlock = useCallback(async (passphrase: string) => {
    const raw = readRaw();
    if (!isEnvelope(raw)) {
      setEncrypted(false);
      skipSave.current = true;
      setState(parseState(raw));
      setStatus("ready");
      return;
    }
    const { vault: key, plaintext } = await open(raw, passphrase);
    vault.current = key;
    skipSave.current = true;
    setState(parseState(JSON.parse(plaintext)));
    setStatus("ready");
  }, []);

  const enableLock = useCallback(async (passphrase: string) => {
    const key = await deriveKey(passphrase);
    vault.current = key;
    writeSeq.current++;
    writeRaw(await seal(key, JSON.stringify(state)));
    setEncrypted(true);
  }, [state]);

  const disableLock = useCallback(() => {
    vault.current = null;
    writeSeq.current++;
    writeRaw(state);
    setEncrypted(false);
  }, [state]);

  const wipe = useCallback(() => {
    vault.current = null;
    writeSeq.current++;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing stored
    }
    skipSave.current = true;
    setEncrypted(false);
    setState(EMPTY_STATE);
    setStatus("ready");
  }, []);

  // ---- edits -------------------------------------------------------------
  const add = useCallback((entry: Omit<Entry, "id">) => {
    setState((s) => (s.entries.length >= LIMITS.entries ? s : { ...s, entries: [...s.entries, { ...entry, id: newId() }] }));
  }, []);

  const updateEntry = useCallback((id: string, patch: Omit<Entry, "id">) => {
    setState((s) => ({ ...s, entries: s.entries.map((e) => (e.id === id ? { ...patch, id } : e)) }));
  }, []);

  const remove = useCallback((id: string) => {
    setState((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }));
  }, []);

  /** Ends a recurring line before `month`; deletes it if it started that month. */
  const stopFrom = useCallback((id: string, month: string) => {
    setState((s) => ({
      ...s,
      entries: s.entries.flatMap((e) => {
        if (e.id !== id) return [e];
        if (e.month >= month) return [];
        return [{ ...e, endMonth: shiftMonth(month, -1) }];
      }),
    }));
  }, []);

  const restore = useCallback((entries: Entry[]) => {
    setState((s) => ({ ...s, entries }));
  }, []);

  const setGoal = useCallback((goal: number | null) => setState((s) => ({ ...s, goal })), []);

  const setLimit = useCallback((category: ExpenseCategory, value: number | null) => {
    setState((s) => {
      const limits = { ...s.limits };
      if (value === null) delete limits[category];
      else limits[category] = value;
      return { ...s, limits };
    });
  }, []);

  const replace = useCallback((next: BudgetState) => setState(parseState(next)), []);

  /** File contents for export: the encrypted envelope when a code is set. */
  const exportData = useCallback(async (): Promise<string> => {
    if (vault.current) return JSON.stringify(await seal(vault.current, JSON.stringify(state)));
    return JSON.stringify(state, null, 2);
  }, [state]);

  return {
    status,
    state,
    encrypted,
    unlock,
    lock,
    enableLock,
    disableLock,
    wipe,
    add,
    updateEntry,
    remove,
    stopFrom,
    restore,
    setGoal,
    setLimit,
    replace,
    exportData,
  };
}

/** Reads an imported file: plain budget JSON or an encrypted export (needs the code it was made with). */
export async function readImport(text: string, passphrase?: string): Promise<BudgetState | "needs-passphrase"> {
  if (text.length > LIMITS.importBytes) throw new Error("Fichier trop gros.");
  const raw: unknown = JSON.parse(text);
  if (isEnvelope(raw)) {
    if (!passphrase) return "needs-passphrase";
    const { plaintext } = await open(raw, passphrase);
    return parseState(JSON.parse(plaintext));
  }
  return parseState(raw);
}
