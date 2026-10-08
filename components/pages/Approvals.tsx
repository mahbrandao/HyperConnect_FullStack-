"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import type { Team } from "@/interfaces/user";

type PendingAccount = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

const teamOptions: { value: Team; label: string }[] = [
  { value: "gerente", label: "Gerência" },
  { value: "admin", label: "Administração" },
  { value: "vendas", label: "Vendas" },
  { value: "instalacao", label: "Instalação" },
];

export default function Approvals() {
  const { user } = useUser();
  const router = useRouter();
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, Team>>({});
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.team !== "gerente") router.replace("/app");
  }, [user, router]);

  async function loadPending() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, created_at")
      .is("team", null)
      .order("created_at", { ascending: true });

    if (error) setLoadError(error.message);
    else { setLoadError(null); setAccounts(data ?? []); }
    setLoading(false);
  }

  useEffect(() => { loadPending(); }, []);

  async function handleApprove(id: string) {
    const team = selected[id] ?? "vendas";
    setApproving(id);
    const { error } = await supabase
      .from("profiles")
      .update({ team, team_label: teamOptions.find(t => t.value === team)?.label })
      .eq("id", id);
    setApproving(null);
    if (error) { alert(`Erro ao aprovar: ${error.message}`); return; }
    setAccounts(prev => prev.filter(a => a.id !== id));
  }

  if (user && user.team !== "gerente") return null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Aprovações pendentes</h1>
        <p className="text-[#888] text-sm mt-1">Defina o departamento das contas ainda sem acesso ao sistema.</p>
      </div>

      {loading && <div className="text-center py-16 text-[#555] text-sm">Carregando...</div>}
      {!loading && loadError && (
        <div className="text-center py-16 text-red-400 text-sm">Erro ao carregar: {loadError}</div>
      )}

      {!loading && !loadError && accounts.length === 0 ? (
        <div className="rounded-2xl border border-[#222] bg-[#151515] p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5c518]/10 text-[#f5c518] border border-[#f5c518]/20">
            <Clock3 size={24} />
          </div>
          <p className="text-white font-medium">Nenhuma conta aguardando aprovação no momento.</p>
        </div>
      ) : !loading && !loadError ? (
        <div className="overflow-hidden rounded-2xl border border-[#222] bg-[#151515]">
          <table className="w-full text-left">
            <thead className="border-b border-[#222] bg-[#111]">
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-[#555]">Nome</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-[#555]">E-mail</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-[#555]">Cadastro</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-[#555]">Departamento</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-[#555]">Ação</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-[#1a1a1a] last:border-b-0">
                  <td className="px-4 py-4 text-sm text-white">{account.name}</td>
                  <td className="px-4 py-4 text-sm text-[#bbb]">{account.email}</td>
                  <td className="px-4 py-4 text-sm text-[#777]">{new Date(account.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-4">
                    <select
                      value={selected[account.id] ?? "vendas"}
                      onChange={(e) => setSelected(prev => ({ ...prev, [account.id]: e.target.value as Team }))}
                      className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
                    >
                      {teamOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      disabled={approving === account.id}
                      onClick={() => handleApprove(account.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#f5c518] px-3 py-2 text-sm font-bold text-black hover:bg-[#e6b800] transition-colors disabled:opacity-60"
                    >
                      <ShieldCheck size={14} />
                      {approving === account.id ? "Aprovando..." : "Aprovar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
