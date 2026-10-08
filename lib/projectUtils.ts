import type { Project, Stage } from "@/interfaces/project";

export const STAGES: Stage[] = ["Orçamento", "Aprovado", "Em Instalação", "Manutenção", "Concluído"];

export const stageColor: Record<Stage, string> = {
  "Orçamento":    "bg-gray-500/15 text-gray-400",
  "Aprovado":     "bg-blue-500/15 text-blue-400",
  "Em Instalação":"bg-[#f5c518]/15 text-[#f5c518]",
  "Manutenção":   "bg-orange-500/15 text-orange-400",
  "Concluído":    "bg-green-500/15 text-green-400",
};

export const stageDot: Record<Stage, string> = {
  "Orçamento":    "bg-gray-400",
  "Aprovado":     "bg-blue-400",
  "Em Instalação":"bg-[#f5c518]",
  "Manutenção":   "bg-orange-400",
  "Concluído":    "bg-green-400",
};

export function fmt(val: number) {
  return `R$ ${val.toLocaleString("pt-BR")}`;
}

export function progressForStage(stage: string | undefined | null) {
  if (!stage) return 0;
  const s = String(stage).toLowerCase();
  // custom mappings (user steps) and fallbacks for existing STAGES
  if (s.includes("aprova")) return 25;
  if (s.includes("entrada") || s.includes("cpfl") || s.includes("descri")) return 40;
  if (s.includes("instal")) return 70;
  if (s.includes("foto") || s.includes("envio")) return 90;
  if (s.includes("orçamento")) return 5;
  if (s.includes("aprovado")) return 25;
  if (s.includes("em instalação")) return 70;
  if (s.includes("manutenção")) return 50;
  if (s.includes("conclu")) return 100;
  return 0;
}

export function progressForProject(p: Project) {
  const computed = progressForStage(p.stage as string);
  // prefer computed value, but fallback to stored progress if present
  return computed || (typeof p.progress === "number" ? p.progress : 0);
}
