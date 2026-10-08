"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { STAGES } from "@/lib/projectUtils";
import type { Project } from "@/interfaces/project";
import { useUser } from "@/hooks/useUser";
import { supabase } from "@/lib/supabase";
import InstallerPicker from "@/components/ui/InstallerPicker";

type ProjectEditorModalProps = {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onSave: (project: Project & { startDateISO?: string; endDateISO?: string; instaladorIds?: string[] }) => void | Promise<void>;
  canEditTeam?: boolean;
};

function brToIso(br: string) {
  if (!br || !br.includes("/")) return "";
  const [d, m, y] = br.split("/");
  return `${y}-${m}-${d}`;
}

function isoToBr(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const serviceTypes = [
  "Instalação fotovoltaica",
  "Limpeza",
  "Configuração de inversor",
  "Carregador de carro elétrico",
  "Automação de painel de comando",
  "Manutenção",
];

export default function ProjectEditorModal({ project, open, onClose, onSave, canEditTeam = false }: ProjectEditorModalProps) {
  const { user } = useUser();
  const [form, setForm] = useState<Project | null>(project);
  const [instaladorIds, setInstaladorIds] = useState<string[]>([]);
  const [installerOptions, setInstallerOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open || !canEditTeam) return;
    supabase.from("profiles").select("id, name").eq("team", "instalacao").order("name").then(({ data }) => {
      setInstallerOptions(data ?? []);
    });
  }, [open, canEditTeam]);

  useEffect(() => {
    if (project) {
      setForm({
        ...project,
        value: Number(project.value) || 0,
        start: brToIso(project.start),
        end: brToIso(project.end),
      });
      setInstaladorIds(project.instaladores.map((i) => i.id));
    }
  }, [project, open]);

  if (!open || !project || !form) return null;
  const current: Project = form;

  function updateField<K extends keyof Project>(field: K, value: Project[K]) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const startDateISO = current.start;
    const endDateISO = current.end;
    const nextProject = {
      ...current,
      value: Number(current.value) || 0,
      valorSistema: Number(current.valorSistema) || 0,
      valorMO: Number(current.valorMO) || 0,
      instaladorIds,
      progress: Number(current.progress) || 0,
      start: isoToBr(current.start),
      end: isoToBr(current.end),
      startDateISO,
      endDateISO,
    };
    onSave(nextProject);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-[#222] bg-[#111] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1e1e1e] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Editar projeto</h2>
            <p className="text-xs text-[#555]">Atualize as informações do projeto.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#555] hover:bg-[#1e1e1e] hover:text-white">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Título</label>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Cliente</label>
              <input
                value={form.client}
                onChange={(e) => updateField("client", e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => updateField("type", e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              >
                {serviceTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Etapa</label>
              <select
                value={form.stage}
                onChange={(e) => updateField("stage", e.target.value as Project["stage"])}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              >
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Prioritário?</label>
              <select
                value={form.isPriority ? "sim" : "nao"}
                onChange={(e) => updateField("isPriority", e.target.value === "sim")}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              >
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </div>

            {user?.team !== "instalacao" && (
            <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Valor do sistema (R$)</label>
              <input
                type="number"
                value={form.valorSistema ?? 0}
                onChange={(e) => updateField("valorSistema", Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Mão de obra (R$)</label>
              <input
                type="number"
                value={form.valorMO ?? 0}
                onChange={(e) => updateField("valorMO", Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Valor total (R$)</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => updateField("value", Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              />
            </div>
            </>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Início</label>
              <input
                type="date"
                value={form.start}
                onChange={(e) => updateField("start", e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Conclusão</label>
              <input
                type="date"
                value={form.end}
                onChange={(e) => updateField("end", e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              />
            </div>

            {canEditTeam && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-[#888]">
                  Equipe de instalação <span className="text-[#555]">(opcional · {instaladorIds.length} selecionado(s))</span>
                </label>
                <InstallerPicker options={installerOptions} selected={instaladorIds} onChange={setInstaladorIds} />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#888]">Observações</label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#1e1e1e] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#222] px-4 py-2 text-sm text-[#ddd] hover:bg-[#1a1a1a]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#f5c518] px-4 py-2 text-sm font-bold text-black hover:bg-[#e6b800]"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}