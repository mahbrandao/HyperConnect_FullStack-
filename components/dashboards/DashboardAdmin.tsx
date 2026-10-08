"use client";

import { useEffect, useState } from "react";
import { FileText, FolderOpen, Users, Clock, PencilLine } from "lucide-react";
import Link from "next/link";
import { stageColor, fmt } from "@/lib/projectUtils";
import ProjectEditorModal from "@/components/ui/ProjectEditorModal";
import type { Project } from "@/interfaces/project";
import { useUser } from "@/hooks/useUser";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/lib/supabase";

export default function DashboardAdmin() {
  const { user } = useUser();
  const { projects, loading, error, reload } = useProjects();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [contractProjectIds, setContractProjectIds] = useState<Set<string>>(new Set());
  const [docsLoaded, setDocsLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("documents")
      .select("project_id")
      .eq("doc_type", "Contrato")
      .then(({ data }) => {
        setContractProjectIds(new Set((data ?? []).map((d) => d.project_id).filter(Boolean) as string[]));
        setDocsLoaded(true);
      });
  }, []);

  if (!user) return null;

  // Projetos aprovados / em instalação precisam do contrato anexado
  const needContract = projects.filter((p) => p.stage === "Aprovado" || p.stage === "Em Instalação");
  const docStatus = needContract.map((p) => ({ project: p, ok: contractProjectIds.has(p.id) }));
  const okDocs = docStatus.filter((d) => d.ok).length;
  const pendingDocs = docStatus.filter((d) => !d.ok).length;

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
        <p className="text-[#888] text-sm">Visão administrativa — processos, clientes e documentos.</p>
      </div>

      {loading && <div className="text-center py-10 text-[#555] text-sm">Carregando...</div>}
      {!loading && error && <div className="text-center py-10 text-red-400 text-sm">Erro ao carregar: {error}</div>}

      {!loading && !error && (
      <>
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Projetos ativos", value: String(projects.filter((p) => p.stage !== "Concluído").length), icon: FolderOpen, color: "text-[#f5c518]" },
          { label: "Documentos em ordem", value: String(okDocs), icon: FileText, color: "text-green-400" },
          { label: "Docs. pendentes", value: String(pendingDocs), icon: Clock, color: "text-red-400" },
          { label: "Clientes ativos", value: String(new Set(projects.map((p) => p.client)).size), icon: Users, color: "text-blue-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#151515] border border-[#222] rounded-xl p-4">
            <Icon size={18} className={`${color} mb-3`} />
            <div className="text-xl font-bold text-white mb-0.5">{value}</div>
            <div className="text-xs text-[#888]">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
          <h2 className="font-semibold text-white text-sm">Clientes e seus projetos</h2>
          <Link href="/app/projects" className="text-xs text-[#f5c518] hover:underline">Ver todos os projetos</Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e1e1e]">
              {["Cliente", "Projeto", "Responsável Vendas", "Equipe de instalação", "Etapa", "Valor", "Ação"].map((col) => (
                <th key={col} className="text-left py-3 px-4 text-xs font-medium text-[#555] uppercase tracking-wider">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e1e]">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-[#1a1a1a] transition-colors">
                <td className="py-3 px-4">
                  <div className="w-7 h-7 rounded-full bg-[#222] flex items-center justify-center text-xs font-bold text-[#888] mb-0.5">
                    {p.client[0]}
                  </div>
                  <div className="text-xs text-[#888] leading-none">{p.client}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-sm font-medium text-white">{p.title}</div>
                  <div className="text-xs text-[#555]">{p.type}</div>
                </td>
                <td className="py-3 px-4 text-xs text-[#888]">{p.vendedor || "—"}</td>
                <td className="py-3 px-4 text-xs text-[#888]">{p.instalador || "—"}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColor[p.stage]}`}>{p.stage}</span>
                </td>
                <td className="py-3 px-4 text-xs text-white font-medium">{fmt(p.value)}</td>
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

      <div className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
          <h2 className="font-semibold text-white text-sm">Status de documentos</h2>
          <Link href="/app/documents" className="text-xs text-[#f5c518] hover:underline">Gerenciar</Link>
        </div>
        <div className="divide-y divide-[#1e1e1e]">
          {!docsLoaded && <div className="text-center py-8 text-[#555] text-sm">Carregando...</div>}
          {docsLoaded && docStatus.length === 0 && (
            <div className="text-center py-8 text-[#555] text-sm">Nenhum projeto aprovado ou em instalação exigindo documentos.</div>
          )}
          {docsLoaded && docStatus.map(({ project, ok }) => (
            <div key={project.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#1a1a1a] transition-colors">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? "bg-green-400" : "bg-red-400"}`} />
              <div className="w-8 h-8 bg-red-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate">Contrato — {project.title}</div>
                <div className="text-xs text-[#555] truncate">{project.client}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ok ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                {ok ? "Em ordem" : "Pendente"}
              </span>
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
