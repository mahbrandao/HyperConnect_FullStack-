"use client";

import { useState } from "react";
import { TrendingUp, FolderOpen, FileCheck, Clock, ChevronRight, ArrowRight, PencilLine } from "lucide-react";
import Link from "next/link";
import { STAGES, stageColor, stageDot, fmt, progressForProject } from "@/lib/projectUtils";
import type { Project, Stage } from "@/interfaces/project";
import ProjectEditorModal from "@/components/ui/ProjectEditorModal";
import { useUser } from "@/hooks/useUser";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/lib/supabase";

export default function DashboardVendas() {
  const { user } = useUser();
  const { projects, loading, error, reload } = useProjects();
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  if (!user) return null;

  const myProjects = projects.filter((p) => p.vendedorId === user.id);
  const totalMyValue = myProjects.reduce((s, p) => s + p.value, 0);
  const quoteCount = myProjects.filter((p) => p.stage === "Orçamento").length;
  const approvedCount = myProjects.filter((p) => p.stage === "Aprovado" || p.stage === "Em Instalação").length;

  const stageCounts = STAGES.reduce<Record<Stage, number>>((acc, s) => {
    acc[s] = myProjects.filter((p) => p.stage === s).length;
    return acc;
  }, {} as Record<Stage, number>);

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
        <h1 className="text-xl font-bold text-white">Olá, {user.name.split(" ")[0]}!</h1>
        <p className="text-[#888] text-sm">Seus projetos e pipeline de vendas.</p>
      </div>

      {loading && <div className="text-center py-10 text-[#555] text-sm">Carregando...</div>}
      {!loading && error && <div className="text-center py-10 text-red-400 text-sm">Erro ao carregar: {error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Meus projetos", value: String(myProjects.length), icon: FolderOpen, color: "text-[#f5c518]" },
              { label: "Orçamentos abertos", value: String(quoteCount), icon: Clock, color: "text-orange-400" },
              { label: "Aprovados / Instalando", value: String(approvedCount), icon: FileCheck, color: "text-blue-400" },
              { label: "Receita potencial", value: fmt(totalMyValue), icon: TrendingUp, color: "text-green-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-[#151515] border border-[#222] rounded-xl p-4">
                <Icon size={18} className={`${color} mb-3`} />
                <div className="text-xl font-bold text-white mb-0.5 truncate">{value}</div>
                <div className="text-xs text-[#888]">{label}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#151515] border border-[#222] rounded-xl p-5">
            <h2 className="font-semibold text-white text-sm mb-4">Meu pipeline</h2>
            <div className="flex items-stretch gap-0">
              {STAGES.map((stage, i) => {
                const count = stageCounts[stage];
                return (
                  <div key={stage} className="flex items-center flex-1 min-w-0">
                    <div className={`flex-1 min-w-0 rounded-xl p-3 text-center ${count > 0 ? "bg-[#1a1a1a]" : "bg-[#111]"}`}>
                      <div className={`inline-flex w-6 h-6 rounded-full ${count > 0 ? stageDot[stage] : "bg-[#222]"} items-center justify-center text-xs font-bold ${count > 0 ? "text-black" : "text-[#444]"} mb-1.5`}>
                        {count}
                      </div>
                      <div className={`text-xs font-medium truncate ${count > 0 ? "text-white" : "text-[#444]"}`}>{stage}</div>
                    </div>
                    {i < STAGES.length - 1 && <ArrowRight size={13} className="text-[#2a2a2a] flex-shrink-0 mx-1" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
              <h2 className="font-semibold text-white text-sm">Meus projetos</h2>
              <Link href="/app/projects" className="text-xs text-[#f5c518] hover:underline flex items-center gap-1">
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-[#1e1e1e]">
              {myProjects.length === 0 && (
                <div className="text-center py-10 text-[#555] text-sm">Você ainda não tem projetos.</div>
              )}
              {myProjects.map((p) => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#1a1a1a] transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#222] flex items-center justify-center flex-shrink-0"><FolderOpen size={18} className="text-[#f5c518]" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <div className="text-sm font-semibold text-white">{p.title}</div>
                        <div className="text-xs text-[#555]">{p.client}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {p.isPriority && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-500/15 text-red-400">Prioritário</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stageColor[p.stage]}`}>{p.stage}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-[#222] rounded-full h-1">
                        <div className="bg-[#f5c518] h-1 rounded-full" style={{ width: `${progressForProject(p)}%` }} />
                      </div>
                      <span className="text-xs text-[#f5c518] font-medium w-7">{progressForProject(p)}%</span>
                      <span className="text-xs text-white font-medium">{fmt(p.value)}</span>
                    </div>
                    {p.notes && <p className="text-xs text-[#555] mt-1 truncate">{p.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProject(p)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#111] px-2.5 py-1.5 text-[11px] text-[#f5c518] hover:bg-[#1a1a1a]"
                  >
                    <PencilLine size={12} />
                    Editar
                  </button>
                </div>
              ))}
            </div>
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
