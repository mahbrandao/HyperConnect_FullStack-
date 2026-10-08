"use client";

import { createContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Team, User } from "@/interfaces/user";

const TEAM_LABELS: Record<Team, string> = {
  gerente: "Gerência",
  admin: "Administração",
  vendas: "Vendas",
  instalacao: "Instalação",
};

export interface UserContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function loadProfile(userId: string) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, name, team, team_label, avatar, email")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      console.error("Erro ao carregar perfil:", error);
      setUser(null);
      setLoading(false);
      return;
    }

    setUser({
      id: profile.id,
      name: profile.name,
      team: profile.team as Team | null,
      teamLabel: profile.team ? profile.team_label ?? TEAM_LABELS[profile.team as Team] : null,
      avatar: profile.avatar ?? profile.name.charAt(0).toUpperCase(),
    });
    setLoading(false);
  }

  async function refresh() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setLoading(true);
      await loadProfile(session.user.id);
    }
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session) loadProfile(session.user.id);
      else { setUser(null); setLoading(false); }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { setLoading(true); loadProfile(session.user.id); }
      else { setUser(null); setLoading(false); }
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  }

  return (
    <UserContext.Provider value={{ user, loading, signOut, refresh }}>
      {children}
    </UserContext.Provider>
  );
}
