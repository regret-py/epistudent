"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isEpitechEmail, type ProfileRow } from "@studybuddy/db";
import { supabase } from "./supabase";

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  /** set when a non-Epitech account tried to sign in */
  domainRejected: boolean;
  refreshProfile: () => Promise<ProfileRow | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string) {
  const { data, error } = await supabase().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [domainRejected, setDomainRejected] = useState(false);

  const apply = useCallback(async (next: Session | null) => {
    if (next && !isEpitechEmail(next.user.email)) {
      setDomainRejected(true);
      await supabase().auth.signOut();
      next = null;
    }
    setSession(next);
    if (!next) {
      setProfile(null);
      setStatus("signedOut");
      return;
    }
    try {
      setProfile(await fetchProfile(next.user.id));
    } catch {
      setProfile(null);
    }
    setStatus("signedIn");
  }, []);

  useEffect(() => {
    const client = supabase();
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (active) void apply(data.session);
    });
    const { data: sub } = client.auth.onAuthStateChange((event, next) => {
      // token refreshes don't change who is signed in
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void apply(next);
      else if (next) setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [apply]);

  const refreshProfile = useCallback(async () => {
    if (!session) return null;
    const next = await fetchProfile(session.user.id);
    setProfile(next);
    return next;
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ status, session, user: session?.user ?? null, profile, domainRejected, refreshProfile, signOut }),
    [status, session, profile, domainRejected, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For pages behind the guard: user and profile are guaranteed. */
export function useSession() {
  const { user, profile, ...rest } = useAuth();
  if (!user || !profile) throw new Error("useSession used outside a protected page");
  return { user, profile, ...rest };
}
