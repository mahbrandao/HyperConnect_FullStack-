"use client";

import { useState } from "react";
import { TrendingUp, FolderOpen, Users, CheckCircle2, ChevronRight, ArrowRight, PencilLine, Wallet, Sparkles } from "lucide-react";
import Link from "next/link";
import { STAGES, stageColor, stageDot, fmt, progressForProject } from "@/lib/projectUtils";
import type { Project, Stage } from "@/interfaces/project";
import ProjectEditorModal from "@/components/ui/ProjectEditorModal";
import { useUser } from "@/hooks/useUser";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/lib/supabase";

export default function DashboardGerente() {
  const { user } = useUser();
  const { projects, loading, error, reload } = useProjects();
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  if (!user) return null;

  const stageCounts = STAGES.reduce<Record<Stage, number>>((acc, s) => {
    acc[s] = projects.filter((p) => p.stage === s).length;
    return acc;
  }, {} as Record<Stage, number>);

  const totalValue = projects.reduce((s, p) => s + p.value, 0);
  const totalReceived = projects.reduce((s, p) => s + (p.dataPgto ? p.value - (p.valorAReceber ?? 0) : 0), 0);
  const totalPending = projects.reduce((s, p) => s + (p.valorAReceber ?? 0), 0);
  const activeCount = projects.filter((p) => p.stage !== "Concluído").length;
  const doneCount = projects.filter((p) => p.stage === "Concluído").length;
  const quoteCount = projects.filter((p) => p.stage === "Orçamento").length;
  const receivedPct = totalValue > 0 ? Math.round((totalReceived / totalValue) * 100) : 0;

  async function handleSave(updatedProject: Project & { startDateISO?: string; endDateISO?: string }) {
    const { error } = await supabase
      .from("projects")
      .update({
        title: updatedProject.title,
        client: updatedProject.client,
        type: updatedProject.type,
        stage: updatedProject.stage,
        is_priority: updatedProject.isPriority,
        value: updatedProject.value,
        progress: updatedProject.progress,
        notes: updatedProject.notes ?? null,
        start_date: updatedProject.startDateISO || null,
        end_date: updatedProject.endDateISO || null,
      })
      .eq("id", updatedProject.id);
    if (error) { alert(`Erro ao salvar: ${error.message}`); return; }
    await reload();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Olá, {user.name.split(" ")[0]} — Painel Geral</h1>
        <p className="text-[#888] text-sm">Visão completa de todos os projetos e equipes.</p>
      </div>

      {loading && <div className="text-center py-10 text-[#555] text-sm">Carregando...</div>}
      {!loading && error && <div className="text-center py-10 text-red-400 text-sm">Erro ao carregar: {error}</div>}

      {!loading && !error && (
        <>
          {/* Destaque de receita */}
          <div className="relative overflow-hidden rounded-2xl border border-[#f5c518]/25 bg-gradient-to-br from-[#1c1808] via-[#151515] to-[#151515] p-6">
            <Sparkles size={100} className="absolute -right-4 -top-4 text-[#f5c518]/10" />
            <div className="flex items-center gap-2 text-[#f5c518] text-xs font-semibold uppercase tracking-[0.18em]">
              <Wallet size={14} />
              Receita total da carteira
            </div>
            <div className="mt-2 text-4xl font-bold text-white">{fmt(totalValue)}</div>
            <div className="mt-4 flex items-center gap-6 text-sm">
              <div>
                <div className="text-green-400 font-semibold">{fmt(totalReceived)}</div>
                <div className="text-[11px] text-[#888]">já recebido</div>
              </div>
              <div>
                <div className="text-[#f5c518] font-semibold">{fmt(totalPending)}</div>
                <div className="text-[11px] text-[#888]">a receber</div>
              </div>
              <div className="flex-1 max-w-xs">
                <div className="h-2 rounded-full bg-[#222] overflow-hidden">
                  <div className="h-2 rounded-full bg-gradient-to-r from-green-500 to-[#f5c518]" style={{ width: `${receivedPct}%` }} />
                </div>
                <div className="text-[11px] text-[#888] mt-1">{receivedPct}% já recebido</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Projetos ativos", value: String(activeCount), icon: FolderOpen, color: "text-[#f5c518]", sub: "em andamento" },
              { label: "Orçamentos abertos", value: String(quoteCount), icon: Users, color: "text-blue-400", sub: "aguardando aprovação" },
              { label: "Concluídos", value: String(doneCount), icon: CheckCircle2, color: "text-purple-400", sub: "este período" },
            ].map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className="bg-[#151515] border border-[#222] rounded-xl p-4">
                <Icon size={18} className={`${color} mb-3`} />
                <div className="text-xl font-bold text-white mb-0.5 truncate">{value}</div>
                <div className="text-xs text-white font-medium">{label}</div>
                <div className="text-xs text-[#555] mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#151515] border border-[#222] rounded-xl p-5">
            <h2 className="font-semibold text-white text-sm mb-4">Pipeline de Projetos</h2>
            <div className="flex items-stretch gap-0">
              {STAGES.map((stage, i) => {
                const count = stageCounts[stage];
                const pct = projects.length ? Math.round((count / projects.length) * 100) : 0;
                return (
                  <div key={stage} className="flex items-center flex-1 min-w-0">
                    <div className="flex-1 min-w-0 bg-[#1a1a1a] rounded-xl p-4 text-center">
                      <div className={`inline-flex w-6 h-6 rounded-full ${stageDot[stage]} items-center justify-center text-black text-xs font-bold mb-2`}>
                        {count}
                      </div>
                      <div className="text-xs font-medium text-white truncate">{stage}</div>
                      <div className="text-[10px] text-[#555] mt-0.5">{pct}%</div>
                    </div>
                    {i < STAGES.length - 1 && <ArrowRight size={14} className="text-[#333] flex-shrink-0 mx-1" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
              <h2 className="font-semibold text-white text-sm">Todos os projetos</h2>
              <Link href="/app/projects" className="text-xs text-[#f5c518] hover:underline flex items-center gap-1">
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e1e]">
                  {["Projeto / Cliente", "Tipo", "Vendedor", "Equipe de instalação", "Etapa", "Valor", "Prioridade", "Ação"].map((col) => (
                    <th key={col} className="text-left py-3 px-4 text-xs font-medium text-[#555] uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {projects.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-[#555] text-sm">Nenhum projeto cadastrado ainda.</td></tr>
                )}
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-white">{p.title}</div>
                      <div className="text-xs text-[#555]">{p.client}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#888]">{p.type}</td>
                    <td className="py-3 px-4 text-xs text-[#888]">{p.vendedor || "—"}</td>
                    <td className="py-3 px-4 text-xs text-[#888]">{p.instalador || "—"}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColor[p.stage]}`}>{p.stage}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-white font-medium">{fmt(p.value)}</td>
                    <td className="py-3 px-4">
                      {p.isPriority ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/15 text-red-400">Sim</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#222] text-[#777]">Não</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setEditingProject(p)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#111] px-2.5 py-1.5 text-[11px] text-[#f5c518] hover:bg-[#1a1a1a]"
                      >
                        <PencilLine size={12} />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Equipe Vendas", field: "vendedorId" as const, color: "text-blue-400", dot: "bg-blue-400" },
              { label: "Equipe Instalação", field: "instaladores" as const, color: "text-[#f5c518]", dot: "bg-[#f5c518]" },
            ].map(({ label, field, color, dot }) => {
              const assigned = projects.filter((p) => (field === "vendedorId" ? Boolean(p.vendedorId) : p.instaladores.length > 0));
              return (
                <div key={label} className="bg-[#151515] border border-[#222] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-2 h-2 rounded-full ${dot}`} />
                    <h2 className="font-semibold text-white text-sm">{label}</h2>
                    <span className={`ml-auto text-xs font-semibold ${color}`}>{assigned.length} projetos</span>
                  </div>
                  <div className="space-y-2.5">
                    {assigned.length === 0 && <p className="text-xs text-[#555]">Nenhum projeto atribuído ainda.</p>}
                    {assigned.slice(0, 4).map((p) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-white truncate">{p.title} · {field === "vendedorId" ? p.vendedor : p.instalador}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0 ${stageColor[p.stage]}`}>{p.stage}</span>
                          </div>
                          <div className="bg-[#222] rounded-full h-1">
                            <div className="bg-[#f5c518] h-1 rounded-full" style={{ width: `${progressForProject(p)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ProjectEditorModal
        project={editingProject}
        open={Boolean(editingProject)}
        onClose={() => setEditingProject(null)}
        onSave={handleSave}
      />
    </div>
  );
}
