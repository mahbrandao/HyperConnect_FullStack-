"use client";

import { useState, type ReactElement } from "react";
import { Wrench, CheckCircle2, Clock, AlertTriangle, ChevronRight, PencilLine, FileText } from "lucide-react";
import Link from "next/link";
import { stageColor, progressForProject } from "@/lib/projectUtils";
import ProjectEditorModal from "@/components/ui/ProjectEditorModal";
import type { Project } from "@/interfaces/project";
import { useUser } from "@/hooks/useUser";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/lib/supabase";

const typeIcon: Record<string, ReactElement> = {
  "Instalação fotovoltaica": <FileText size={14} />,
  Limpeza: <FileText size={14} />,
  "Configuração de inversor": <FileText size={14} />,
  "Carregador de carro elétrico": <FileText size={14} />,
  "Automação de painel de comando": <FileText size={14} />,
  Manutenção: <FileText size={14} />,
};

export default function DashboardInstalacao() {
  const { user } = useUser();
  const { projects, loading, error, reload } = useProjects();
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  if (!user) return null;

  const myProjects = projects.filter((p) => p.instaladores.some((i) => i.id === user.id));
  const installing = myProjects.filter((p) => p.stage === "Em Instalação");
  const maintenance = myProjects.filter((p) => p.stage === "Manutenção");
  const done = myProjects.filter((p) => p.stage === "Concluído");
  const pending = myProjects.filter((p) => p.stage === "Aprovado");

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

  function ProjectCard({ p, onEdit }: { p: Project; onEdit: (project: Project) => void }) {
    return (
      <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#1a1a1a] transition-colors border-b border-[#1e1e1e] last:border-0">
        <div className="w-10 h-10 bg-[#222] rounded-xl flex items-center justify-center text-lg flex-shrink-0">
          {typeIcon[p.type] || <FileText size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="text-sm font-semibold text-white">{p.title}</div>
              <div className="text-xs text-[#555]">{p.client} · {p.type}</div>
              {p.instaladores.length > 1 && <div className="text-[10px] text-[#666] mt-0.5">Equipe: {p.instalador}</div>}
            </div>
            <div className="flex gap-2 flex-shrink-0 ml-3">
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
            <span className="text-xs text-[#555]">até {p.end}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onEdit(p)}
          className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#111] px-2.5 py-1.5 text-[11px] text-[#f5c518] hover:bg-[#1a1a1a]"
        >
          <PencilLine size={12} />
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Olá, {user.name.split(" ")[0]}!</h1>
        <p className="text-[#888] text-sm">Suas tarefas de instalação, manutenção e limpeza.</p>
      </div>

      {loading && <div className="text-center py-10 text-[#555] text-sm">Carregando...</div>}
      {!loading && error && <div className="text-center py-10 text-red-400 text-sm">Erro ao carregar: {error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Em instalação", value: String(installing.length), icon: Wrench, color: "text-[#f5c518]", sub: "projetos em campo" },
              { label: "Manutenções", value: String(maintenance.length), icon: AlertTriangle, color: "text-orange-400", sub: "agendadas" },
              { label: "Aguardando início", value: String(pending.length), icon: Clock, color: "text-blue-400", sub: "aprovados, fila" },
              { label: "Concluídos", value: String(done.length), icon: CheckCircle2, color: "text-green-400", sub: "este período" },
            ].map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className="bg-[#151515] border border-[#222] rounded-xl p-4">
                <Icon size={18} className={`${color} mb-3`} />
                <div className="text-xl font-bold text-white mb-0.5">{value}</div>
                <div className="text-xs text-white font-medium">{label}</div>
                <div className="text-xs text-[#555] mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {myProjects.length === 0 && (
            <div className="text-center py-10 text-[#555] text-sm">Nenhum projeto atribuído a você ainda.</div>
          )}

          {installing.length > 0 && (
            <div className="bg-[#151515] border border-[#f5c518]/20 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#f5c518]/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#f5c518]" />
                  <h2 className="font-semibold text-white text-sm">Em instalação agora</h2>
                </div>
                <Link href="/app/projects" className="text-xs text-[#f5c518] hover:underline flex items-center gap-1">
                  Ver todos <ChevronRight size={12} />
                </Link>
              </div>
              {installing.map((p) => <ProjectCard key={p.id} p={p} onEdit={setEditingProject} />)}
            </div>
          )}

          {maintenance.length > 0 && (
            <div className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[#222]">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <h2 className="font-semibold text-white text-sm">Manutenções agendadas</h2>
              </div>
              {maintenance.map((p) => <ProjectCard key={p.id} p={p} onEdit={setEditingProject} />)}
            </div>
          )}

          {pending.length > 0 && (
            <div className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[#222]">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <h2 className="font-semibold text-white text-sm">Aprovados — aguardando início</h2>
              </div>
              {pending.map((p) => <ProjectCard key={p.id} p={p} onEdit={setEditingProject} />)}
            </div>
          )}

          {done.length > 0 && (
            <div className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[#222]">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <h2 className="font-semibold text-white text-sm">Concluídos</h2>
              </div>
              {done.map((p) => <ProjectCard key={p.id} p={p} onEdit={setEditingProject} />)}
            </div>
          )}
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
