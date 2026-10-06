"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { cleanSaved, type Saved } from "./use-saved";

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";

const isEmpty = (s: Saved) =>
  !s.budget && !s.savings && !s.rent && !s.goal.target && !Object.keys(s.shares).length && !Object.keys(s.tracker.spent).length;

/**
 * Microsoft account + sync of the whole budget to the `budgets` table (RLS: own row only).
 * First sign-in uploads what's on the device; afterwards the account copy wins and every
 * change is saved after a short pause. Last write wins across devices.
 */
export function useAccount({ saved, setSaved, loaded, forget }: { saved: Saved; setSaved: (s: Saved) => void; loaded: boolean; forget: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const synced = useRef<string | null>(null); // user id whose remote copy has been reconciled
  const skipUpload = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    const client = supabase();
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error_description") ?? params.get("error");
    if (oauthError) setNotice("La connexion Microsoft a échoué. Réessaie.");
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
      // drop ?code=… / ?error=… left by the OAuth redirect
      if (params.has("code") || params.has("error")) history.replaceState(null, "", window.location.pathname + window.location.hash);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // reconcile once per signed-in user
  useEffect(() => {
    const uid = session?.user.id;
    if (!loaded || !uid || synced.current === uid) return;
    synced.current = uid;
    setStatus("loading");
    void (async () => {
      const { data, error } = await supabase().from("budgets").select("data").eq("user_id", uid).maybeSingle();
      if (error) {
        setStatus("error");
        return;
      }
      if (data) {
        skipUpload.current = true;
        setSaved(cleanSaved(data.data));
        setNotice("Budget récupéré depuis ton compte.");
        setStatus("saved");
      } else {
        const local = savedRef.current;
        const { error: e } = await supabase().from("budgets").insert({ user_id: uid, data: local });
        setStatus(e ? "error" : "saved");
        if (!e && !isEmpty(local)) setNotice("Ton budget est maintenant sauvegardé dans ton compte.");
      }
    })();
  }, [session, loaded, setSaved]);

  // upload changes after a short pause
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid || synced.current !== uid || status === "loading") return;
    if (skipUpload.current) {
      skipUpload.current = false;
      return;
    }
    setStatus("saving");
    const t = setTimeout(async () => {
      pending.current = null;
      const { error } = await supabase().from("budgets").upsert({ user_id: uid, data: savedRef.current });
      setStatus(error ? "error" : "saved");
    }, 900);
    pending.current = t;
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, session]);

  const signIn = useCallback(async () => {
    setNotice(null);
    // Supabase calls the Microsoft provider "azure"
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo: `${window.location.origin}/`, scopes: "openid email profile", queryParams: { prompt: "select_account" } },
    });
    if (error) setNotice("La connexion Microsoft a échoué. Réessaie.");
  }, []);

  const signOut = useCallback(async () => {
    // don't lose an edit made just before signing out
    const uid = session?.user.id;
    if (pending.current && uid) {
      clearTimeout(pending.current);
      pending.current = null;
      await supabase().from("budgets").upsert({ user_id: uid, data: savedRef.current });
    }
    await supabase().auth.signOut();
    synced.current = null;
    setStatus("idle");
    forget();
    setNotice("Déconnecté. Ton budget a été retiré de cet appareil (il reste dans ton compte).");
  }, [forget, session]);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase().rpc("delete_my_account");
    if (error) {
      setNotice("Suppression impossible pour le moment. Réessaie.");
      return;
    }
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    // the user no longer exists server-side: just drop the local session
    await supabase().auth.signOut({ scope: "local" });
    synced.current = null;
    setStatus("idle");
    forget();
    setNotice("Compte et données supprimés.");
  }, [forget]);

  return { session, ready, status, notice, setNotice, signIn, signOut, deleteAccount };
}
