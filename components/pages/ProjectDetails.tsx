"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, PencilLine, TrendingUp, Users, Wallet, Image as ImageIcon, CreditCard, X, HardHat } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fmt, progressForProject, stageColor } from "@/lib/projectUtils";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import { PROJECT_SELECT, mapProjectRow, type ProjectRow } from "@/hooks/useProjects";
import { safeFileName } from "@/lib/storage";
import ProjectEditorModal from "@/components/ui/ProjectEditorModal";
import type { Project } from "@/interfaces/project";

type Photo = { id: string; url: string };

export default function ProjectDetails() {
  const { user } = useUser();
  const params = useParams<{ id?: string }>();
  const projectId = params?.id ?? "";
  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [uploading, setUploading] = useState(false);
  const [allInstallers, setAllInstallers] = useState<{ id: string; name: string }[]>([]);
  const [addInstaller, setAddInstaller] = useState("");

  async function loadProject() {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select(PROJECT_SELECT)
      .eq("id", projectId)
      .maybeSingle();

    if (error || !data) { setNotFound(true); setProject(null); setLoading(false); return; }
    setNotFound(false);
    setProject(mapProjectRow(data as unknown as ProjectRow));
    await loadPhotos();
    setLoading(false);
  }

  async function loadPhotos() {
    const { data, error } = await supabase
      .from("project_photos")
      .select("id, file_path")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) { setPhotos([]); return; }

    const paths = data.map((d) => d.file_path);
    const { data: signed } = await supabase.storage.from("project-photos").createSignedUrls(paths, 3600);
    const urls = signed ?? [];
    setPhotos(data.map((d, i) => ({ id: d.id, url: urls[i]?.signedUrl ?? "" })).filter((p) => p.url));
  }

  useEffect(() => { if (projectId) loadProject(); }, [projectId]);

  useEffect(() => {
    supabase.from("profiles").select("id, name").eq("team", "instalacao").order("name").then(({ data }) => {
      setAllInstallers(data ?? []);
    });
  }, []);

  async function addToTeam() {
    if (!project || !addInstaller) return;
    const { error } = await supabase.from("project_installers").insert({ project_id: project.id, profile_id: addInstaller });
    if (error) { alert(`Erro ao adicionar: ${error.message}`); return; }
    setAddInstaller("");
    await loadProject();
  }

  async function removeFromTeam(profileId: string) {
    if (!project) return;
    const { data, error } = await supabase
      .from("project_installers")
      .delete()
      .eq("project_id", project.id)
      .eq("profile_id", profileId)
      .select("profile_id");
    if (error) { alert(`Erro ao remover: ${error.message}`); return; }
    if (!data || data.length === 0) { alert("Sem permissão para alterar a equipe (apenas gerente, admin, o vendedor ou instaladores da equipe do projeto)."); return; }
    await loadProject();
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0 || !project) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${project.id}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("project-photos").upload(path, file);
      if (uploadError) { alert(`Erro ao enviar ${file.name}: ${uploadError.message}`); continue; }
      await supabase.from("project_photos").insert({ project_id: project.id, file_path: path });
    }
    setUploading(false);
    await loadPhotos();
  }

  async function handleSave(updatedProject: Project & { startDateISO?: string; endDateISO?: string; instaladorIds?: string[] }) {
    const { error } = await supabase
      .from("projects")
      .update({
        title: updatedProject.title,
        client: updatedProject.client,
        type: updatedProject.type,
        stage: updatedProject.stage,
        is_priority: updatedProject.isPriority,
        ...(user?.team !== "instalacao"
          ? { value: updatedProject.value, valor_sistema: updatedProject.valorSistema ?? null, valor_mo: updatedProject.valorMO ?? null }
          : {}),
        progress: updatedProject.progress,
        notes: updatedProject.notes ?? null,
        start_date: updatedProject.startDateISO || null,
        end_date: updatedProject.endDateISO || null,
      })
      .eq("id", updatedProject.id);

    if (error) { alert(`Erro ao salvar: ${error.message}`); return; }

    if (updatedProject.instaladorIds && canManageTeamNow()) {
      const atuais = project?.instaladores.map((i) => i.id) ?? [];
      const novos = updatedProject.instaladorIds;
      const adicionar = novos.filter((id) => !atuais.includes(id));
      const remover = atuais.filter((id) => !novos.includes(id));
      if (adicionar.length > 0) {
        const { error: e1 } = await supabase.from("project_installers").insert(adicionar.map((profile_id) => ({ project_id: updatedProject.id, profile_id })));
        if (e1) alert(`Erro ao adicionar instaladores: ${e1.message}`);
      }
      if (remover.length > 0) {
        const { error: e2 } = await supabase.from("project_installers").delete().eq("project_id", updatedProject.id).in("profile_id", remover);
        if (e2) alert(`Erro ao remover instaladores: ${e2.message}`);
      }
    }
    await loadProject();
  }

  function canManageTeamNow() {
    if (!project) return false;
    return user?.team === "gerente" || user?.team === "admin" || project.vendedorId === user?.id
      || (user?.team === "instalacao" && project.instaladores.some((i) => i.id === user?.id));
  }

  if (loading) {
    return <div className="p-6 text-center text-[#555] text-sm">Carregando projeto...</div>;
  }

  if (notFound || !project) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-[#222] bg-[#151515] p-8 text-center">
          <h1 className="text-xl font-bold text-white">Projeto não encontrado</h1>
          <p className="mt-2 text-sm text-[#888]">Não foi possível localizar o projeto solicitado.</p>
          <Link
            href="/app/projects"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#f5c518] px-4 py-2 text-sm font-bold text-black hover:bg-[#e6b800]"
          >
            <ArrowLeft size={15} />
            Voltar para projetos
          </Link>
        </div>
      </div>
    );
  }

  const isInstalacao = user?.team === "instalacao";
  const souDaEquipe = isInstalacao && project.instaladores.some((i) => i.id === user?.id);
  const canManageTeam = user?.team === "gerente" || user?.team === "admin" || project.vendedorId === user?.id || souDaEquipe;
  const progress = progressForProject(project);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#f5c518]">Projeto</p>
          <h1 className="mt-2 text-2xl font-bold text-white">{project.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditingProject(project)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#f5c518]/40 bg-[#f5c518]/10 px-3 py-2 text-sm font-medium text-[#f5c518] hover:bg-[#f5c518]/15"
          >
            <PencilLine size={15} />
            Editar projeto
          </button>
          <Link
            href="/app/projects"
            className="inline-flex items-center gap-2 rounded-lg border border-[#222] bg-[#111] px-3 py-2 text-sm text-[#ddd] hover:bg-[#1a1a1a]"
          >
            <ArrowLeft size={15} />
            Voltar
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-2xl border border-[#222] bg-[#151515] p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[#888]">Cliente</p>
              <p className="text-lg font-semibold text-white">{project.client}</p>
            </div>
            <div className="flex items-center gap-2">
              {project.isPriority && (
                <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-red-500/15 text-red-400">Prioritário</span>
              )}
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stageColor[project.stage]}`}>
                {project.stage}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <div className="flex items-center gap-2 text-[#888]">
                <FileText size={14} />
                <span className="text-xs uppercase tracking-wider">Tipo</span>
              </div>
              <p className="mt-2 text-sm font-medium text-white">{project.type}</p>
            </div>

            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <div className="flex items-center gap-2 text-[#888]">
                <Users size={14} />
                <span className="text-xs uppercase tracking-wider">Responsáveis</span>
              </div>
              <p className="mt-2 text-sm text-white">Vendedor: {project.vendedor || "—"}</p>
            </div>

            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <div className="flex items-center gap-2 text-[#888]">
                <CalendarDays size={14} />
                <span className="text-xs uppercase tracking-wider">Período</span>
              </div>
              <p className="mt-2 text-sm text-white">{project.start} até {project.end}</p>
            </div>

            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 sm:col-span-2">
              <div className="flex items-center gap-2 text-[#888]">
                <HardHat size={14} />
                <span className="text-xs uppercase tracking-wider">Equipe de instalação ({project.instaladores.length})</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {project.instaladores.length === 0 && <span className="text-xs text-[#555]">Nenhum instalador definido.</span>}
                {project.instaladores.map((i) => (
                  <span key={i.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#2a2a2a] bg-[#1a1a1a] pl-3 pr-2 py-1 text-xs text-white">
                    {i.name}
                    {canManageTeam && (
                      <button type="button" title="Remover da equipe" onClick={() => removeFromTeam(i.id)} className="text-[#666] hover:text-red-400">
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {canManageTeam && (
                <div className="mt-3 flex gap-2">
                  <select
                    value={addInstaller}
                    onChange={(e) => setAddInstaller(e.target.value)}
                    className="flex-1 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-xs text-white outline-none focus:border-[#f5c518]/50"
                  >
                    <option value="">Adicionar instalador…</option>
                    {allInstallers.filter((i) => !project.instaladores.some((x) => x.id === i.id)).map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addToTeam}
                    disabled={!addInstaller}
                    className="rounded-lg bg-[#f5c518] px-3 py-2 text-xs font-bold text-black hover:bg-[#e6b800] disabled:opacity-40"
                  >
                    Adicionar
                  </button>
                </div>
              )}
            </div>

            {!isInstalacao && (
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <div className="flex items-center gap-2 text-[#888]">
                <Wallet size={14} />
                <span className="text-xs uppercase tracking-wider">Valor</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{fmt(project.value)}</p>
            </div>
            )}
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#888]">
                <TrendingUp size={14} />
                <span className="text-xs uppercase tracking-wider">Progresso</span>
              </div>
              <span className="text-sm font-semibold text-[#f5c518]">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#222]">
              <div className="h-2 rounded-full bg-[#f5c518]" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Galeria de fotos */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#888]">
                <ImageIcon size={14} />
                <span className="text-xs uppercase tracking-wider">Fotos do projeto</span>
              </div>
              <label className="cursor-pointer text-xs text-[#f5c518] hover:underline">
                {uploading ? "Enviando..." : "+ Adicionar fotos"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => handlePhotoUpload(e.target.files)}
                />
              </label>
            </div>
            {photos.length === 0 ? (
              <p className="text-xs text-[#555]">Nenhuma foto adicionada ainda.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {photos.map((photo) => (
                  <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                    <img src={photo.url} alt="Foto do projeto" className="h-20 w-full rounded-lg object-cover hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          {!isInstalacao && (
          <div className="rounded-2xl border border-[#222] bg-[#151515] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f5c518]">Resumo financeiro</h2>
            <div className="mt-4 space-y-3 text-sm text-[#ddd]">
              <div className="flex justify-between gap-3 border-b border-[#1e1e1e] pb-2">
                <span className="text-[#888]">Sistema</span>
                <span>{fmt(project.valorSistema ?? project.value)}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-[#1e1e1e] pb-2">
                <span className="text-[#888]">Mão de obra</span>
                <span>{fmt(project.valorMO ?? 0)}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-[#1e1e1e] pb-2">
                <span className="text-[#888]">A receber</span>
                <span>{fmt(project.valorAReceber ?? project.value)}</span>
              </div>
              {project.paymentMethod && (
                <div className="flex justify-between gap-3 items-center">
                  <span className="text-[#888] flex items-center gap-1.5"><CreditCard size={13} /> Forma de pagamento</span>
                  <span>{project.paymentMethod}</span>
                </div>
              )}
            </div>
            <Link
              href="/app/payments"
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#f5c518] hover:underline"
            >
              Ver em Pagamentos →
            </Link>
          </div>
          )}

          <div className="rounded-2xl border border-[#222] bg-[#151515] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f5c518]">Observações</h2>
            <p className="mt-3 text-sm leading-6 text-[#bbb]">
              {project.notes || "Nenhuma observação adicional cadastrada para este projeto."}
            </p>
          </div>
        </aside>
      </div>

      <ProjectEditorModal
        project={editingProject}
        open={Boolean(editingProject)}
        onClose={() => setEditingProject(null)}
        onSave={handleSave}
        canEditTeam={canManageTeam}
      />
    </div>
  );
}