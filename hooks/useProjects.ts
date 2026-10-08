"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Project, Stage } from "@/interfaces/project";

export type ProjectRow = {
  id: string;
  title: string;
  client: string;
  type: string;
  stage: Stage;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  img: string | null;
  is_priority: boolean;
  value: number;
  valor_sistema: number | null;
  valor_mo: number | null;
  valor_a_receber: number | null;
  data_pgto: string | null;
  payment_method: Project["paymentMethod"] | null;
  notes: string | null;
  vendedor_id: string | null;
  vendedor: { name: string } | null;
  installers: { profile_id: string; profile: { name: string } | null }[] | null;
};

export const PROJECT_SELECT =
  "id, title, client, type, stage, progress, start_date, end_date, img, is_priority, value, valor_sistema, valor_mo, valor_a_receber, data_pgto, payment_method, notes, vendedor_id, vendedor:profiles!projects_vendedor_id_fkey(name), installers:project_installers(profile_id, profile:profiles!project_installers_profile_id_fkey(name))";

function toBR(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function mapProjectRow(row: ProjectRow): Project {
  const instaladores = (row.installers ?? []).map((i) => ({ id: i.profile_id, name: i.profile?.name ?? "—" }));
  return {
    id: row.id,
    title: row.title,
    client: row.client,
    type: row.type,
    stage: row.stage,
    progress: row.progress,
    vendedor: row.vendedor?.name ?? "",
    instalador: instaladores.map((i) => i.name).join(", "),
    instaladores,
    vendedorId: row.vendedor_id,
    start: toBR(row.start_date),
    end: toBR(row.end_date),
    img: row.img ?? "",
    isPriority: row.is_priority,
    value: Number(row.value),
    valorSistema: row.valor_sistema ?? undefined,
    valorMO: row.valor_mo ?? undefined,
    valorAReceber: row.valor_a_receber ?? undefined,
    dataPgto: row.data_pgto,
    paymentMethod: row.payment_method ?? null,
    notes: row.notes ?? undefined,
  };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select(PROJECT_SELECT)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else { setError(null); setProjects((data as unknown as ProjectRow[]).map(mapProjectRow)); }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { projects, loading, error, reload };
}
