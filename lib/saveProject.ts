import { supabase } from "@/lib/supabase";
import type { Project } from "@/interfaces/project";

export type ProjectEditPayload = Project & { startDateISO?: string; endDateISO?: string; instaladorIds?: string[] };

/**
 * Salva as alterações de um projeto (usado por TODOS os dashboards e pela página do projeto),
 * para que qualquer edição apareça igual em qualquer tela.
 * Retorna uma mensagem de erro, ou null se deu tudo certo.
 */
export async function saveProject(
  updated: ProjectEditPayload,
  original: Project | null,
  opts: { team?: string | null; canEditTeam?: boolean }
): Promise<string | null> {
  const isInstalacao = opts.team === "instalacao";
  const progress = Math.max(0, Math.min(100, Math.round(Number(updated.progress) || 0)));

  const { data, error } = await supabase
    .from("projects")
    .update({
      title: updated.title,
      client: updated.client,
      type: updated.type,
      stage: updated.stage,
      is_priority: updated.isPriority,
      ...(!isInstalacao
        ? { value: updated.value, valor_sistema: updated.valorSistema ?? null, valor_mo: updated.valorMO ?? null }
        : {}),
      progress,
      notes: updated.notes ?? null,
      start_date: updated.startDateISO || null,
      end_date: updated.endDateISO || null,
    })
    .eq("id", updated.id)
    .select("id");

  if (error) return `Erro ao salvar: ${error.message}`;
  if (!data || data.length === 0) return "Sem permissão para editar este projeto.";

  if (opts.canEditTeam && updated.instaladorIds && original) {
    const atuais = original.instaladores.map((i) => i.id);
    const novos = updated.instaladorIds;
    const adicionar = novos.filter((id) => !atuais.includes(id));
    const remover = atuais.filter((id) => !novos.includes(id));
    if (adicionar.length > 0) {
      const { error: e1 } = await supabase
        .from("project_installers")
        .insert(adicionar.map((profile_id) => ({ project_id: updated.id, profile_id })));
      if (e1) return `Projeto salvo, mas houve erro ao adicionar instaladores: ${e1.message}`;
    }
    if (remover.length > 0) {
      const { error: e2 } = await supabase
        .from("project_installers")
        .delete()
        .eq("project_id", updated.id)
        .in("profile_id", remover);
      if (e2) return `Projeto salvo, mas houve erro ao remover instaladores: ${e2.message}`;
    }
  }
  return null;
}
