"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, Plus, ChevronRight, X, Calendar, Star, Trash2, FolderKanban } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useProjects } from "@/hooks/useProjects";
import InstallerPicker from "@/components/ui/InstallerPicker";
import { supabase } from "@/lib/supabase";
import { safeFileName } from "@/lib/storage";
import { STAGES, stageColor, fmt, progressForProject, progressForStage } from "@/lib/projectUtils";
import type { Project, Stage } from "@/interfaces/project";

const serviceTypes = [
  "Instalação fotovoltaica",
  "Limpeza",
  "Configuração de inversor",
  "Carregador de carro elétrico",
  "Automação de painel de comando",
];

const tabs = ["Todos", "Orçamento", "Aprovado", "Em Instalação", "Manutenção", "Concluído"];

const emptyForm = {
  title: "", client: "", type: serviceTypes[0],
  stage: "Orçamento" as Stage, start: "", end: "",
  progress: 0, isPriority: false,
  value: "", valorSistema: "", valorMO: "", entrada: "",
  paymentMethod: "" as "" | Project["paymentMethod"],
  vendedorId: "", instaladorIds: [] as string[],
};

function ProjectCard({ p, onDelete, showValue = true }: { p: Project; mine?: boolean; onDelete?: (p: Project) => void; showValue?: boolean }) {
  const prog = progressForProject(p);
  return (
    <div className="bg-[#151515] border border-[#222] rounded-xl p-5 flex items-center gap-5 hover:border-[#333] transition-colors">
      <div className="w-14 h-14 rounded-xl bg-[#1a1a1a] border border-[#222] flex items-center justify-center flex-shrink-0">
        <FolderKanban size={22} className="text-[#f5c518]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-white">{p.title}</h3>
            <p className="text-xs text-[#888]">{p.client} · {p.type}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {p.isPriority && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/15 text-red-400">
                <Star size={11} className="fill-current" /> Prioritário
              </span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stageColor[p.stage]}`}>{p.stage}</span>
            {onDelete && (
              <button
                type="button"
                title="Excluir projeto"
                onClick={() => { if (confirm(`Excluir "${p.title}"? Essa ação não pode ser desfeita.`)) onDelete(p); }}
                className="p-1.5 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        <div className={`grid ${showValue ? "grid-cols-5" : "grid-cols-4"} gap-3 text-xs text-[#888] mb-3`}>
          <div><span className="text-[#555]">Vendedor</span><br /><span className="text-[#ccc]">{p.vendedor || "—"}</span></div>
          <div><span className="text-[#555]">Equipe de instalação</span><br /><span className="text-[#ccc]">{p.instalador || "—"}</span></div>
          <div><span className="text-[#555]">Início</span><br /><span className="text-[#ccc]">{p.start}</span></div>
          <div><span className="text-[#555]">Conclusão</span><br /><span className="text-[#ccc]">{p.end}</span></div>
          {showValue && <div><span className="text-[#555]">Valor</span><br /><span className="text-[#ccc]">{fmt(p.value)}</span></div>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-[#222] rounded-full h-1.5">
            <div className="bg-[#f5c518] h-1.5 rounded-full transition-all" style={{ width: `${prog}%` }} />
          </div>
          <span className="text-xs font-medium text-[#f5c518] w-8">{prog}%</span>
          <Link href={`/app/projects/${p.id}`} className="text-xs text-[#f5c518] hover:underline flex items-center gap-1 ml-2">
            Ver detalhes <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const { user } = useUser();
  const [tab, setTab] = useState("Todos");
  const [search, setSearch] = useState("");
  const { projects, loading, error: loadError, reload: loadProjects } = useProjects();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [vendedores, setVendedores] = useState<{ id: string; name: string }[]>([]);
  const [instaladores, setInstaladores] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("id, name, team").in("team", ["vendas", "instalacao"]).then(({ data }) => {
      if (!data) return;
      setVendedores(data.filter((p) => p.team === "vendas").map((p) => ({ id: p.id, name: p.name })));
      setInstaladores(data.filter((p) => p.team === "instalacao").map((p) => ({ id: p.id, name: p.name })));
    });
  }, []);

  if (!user) return null;

  const myProjects = projects.filter(p =>
    user.team === "vendas"     ? p.vendedorId === user.id :
    user.team === "instalacao" ? p.instaladores.some(i => i.id === user.id) :
    false
  );

  const filtered = projects.filter(p => {
    const matchTab = tab === "Todos" || p.stage === tab;
    const matchSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Informe o título.";
    if (!form.client.trim()) e.client = "Informe o cliente.";
    if (!form.start) e.start = "Informe a data de início.";
    if (!form.end) e.end = "Informe a previsão de conclusão.";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const valorSistema = parseFloat(form.valorSistema) || 0;
    const valorMO = parseFloat(form.valorMO) || 0;
    const total = valorSistema + valorMO || parseFloat(form.value) || 0;
    const entrada = Math.min(parseFloat(form.entrada) || 0, total);
    const aReceber = Math.max(total - entrada, 0);

    setSubmitting(true);

    const { data: inserted, error } = await supabase
      .from("projects")
      .insert({
        title: form.title.trim(),
        client: form.client.trim(),
        type: form.type,
        stage: form.stage,
        progress: progressForStage(form.stage),
        vendedor_id: user?.team === "vendas" ? user.id : (form.vendedorId || null),
        start_date: form.start || null,
        end_date: form.end || null,
        img: null,
        is_priority: form.isPriority,
        value: total,
        valor_sistema: valorSistema || null,
        valor_mo: valorMO || null,
        valor_a_receber: aReceber,
        data_pgto: entrada > 0 && aReceber === 0 ? new Date().toISOString().slice(0, 10) : null,
        payment_method: form.paymentMethod || null,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      setSubmitting(false);
      setErrors({ title: `Erro ao salvar: ${error?.message}` });
      return;
    }

    if (entrada > 0) {
      const { error: payError } = await supabase.from("project_payments").insert({
        project_id: inserted.id,
        amount: entrada,
        paid_at: new Date().toISOString().slice(0, 10),
        method: form.paymentMethod || null,
        note: "Entrada",
        created_by: user?.id ?? null,
      });
     if (payError) console.error("Erro ao registrar entrada:", payError.message);
    }

    if (form.instaladorIds.length > 0) {
      const { error: teamError } = await supabase
        .from("project_installers")
        .insert(form.instaladorIds.map((profile_id) => ({ project_id: inserted.id, profile_id })));
      if (teamError) alert(`Projeto criado, mas não foi possível definir a equipe de instalação: ${teamError.message}`);
    }

    if (photoFiles.length > 0) {
      for (const file of photoFiles) {
        const path = `${inserted.id}/${Date.now()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("project-photos").upload(path, file);
        if (!uploadError) {
          await supabase.from("project_photos").insert({ project_id: inserted.id, file_path: path });
        }
      }
    }

    setSubmitting(false);
    await loadProjects();
    setOpen(false);
    setForm(emptyForm);
    setPhotoFiles([]);
    setErrors({});
  }

  async function handleDelete(p: Project) {
    const { data, error } = await supabase.from("projects").delete().eq("id", p.id).select("id");
    if (error) { alert(`Erro ao excluir: ${error.message}`); return; }
    if (!data || data.length === 0) { alert("Sem permissão para excluir este projeto (só o responsável, gerente ou admin)."); return; }
    await loadProjects();
  }

  const inputCls = "w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#f5c518]/50 transition-colors";
  const showMine = user.team === "vendas" || user.team === "instalacao";

  return (
    <div className="p-6 space-y-6">
      {/* Minha Responsabilidade */}
      {showMine && myProjects.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star size={15} className="text-[#f5c518]" />
            <h2 className="font-semibold text-white text-sm">Minha responsabilidade</h2>
            <span className="text-xs text-[#555] ml-1">({myProjects.length} {myProjects.length === 1 ? "projeto" : "projetos"})</span>
          </div>
          <div className="space-y-3">
            {myProjects.map(p => <ProjectCard key={`mine-${p.id}`} p={p} mine onDelete={handleDelete} showValue={user.team !== "instalacao"} />)}
          </div>
          <div className="border-t border-[#1e1e1e] my-6" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            {showMine ? "Todos os projetos" : "Meus projetos"}
          </h1>
          <p className="text-[#888] text-sm">Acompanhe todos os projetos com a Hyper Connect.</p>
        </div>
        {user.team !== "instalacao" && (
          <button
            onClick={() => {
              setOpen(true);
              setErrors({});
              setForm({
                ...emptyForm,
                vendedorId: user.team === "vendas" ? user.id : "",
                instaladorIds: [],
              });
            }}
            className="bg-[#f5c518] text-black font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[#e6b800] transition-colors"
          >
            <Plus size={16} />
            Novo projeto
          </button>
        )}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1 flex-wrap">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t ? "bg-[#f5c518] text-black" : "text-[#888] hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar projeto"
            className="bg-[#1a1a1a] border border-[#222] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#333] w-48"
          />
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading && <div className="text-center py-16 text-[#555] text-sm">Carregando projetos...</div>}
        {!loading && loadError && (
          <div className="text-center py-16 text-red-400 text-sm">Erro ao carregar projetos: {loadError}</div>
        )}
        {!loading && !loadError && filtered.length === 0 && (
          <div className="text-center py-16 text-[#555] text-sm">Nenhum projeto encontrado.</div>
        )}
        {!loading && !loadError && filtered.map(p => <ProjectCard key={p.id} p={p} onDelete={handleDelete} showValue={user.team !== "instalacao"} />)}
      </div>

      {/* Modal Novo Projeto */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-[#111] border border-[#222] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e1e1e] sticky top-0 bg-[#111] z-10">
              <div>
                <h2 className="text-base font-bold text-white">Novo projeto</h2>
                <p className="text-xs text-[#555] mt-0.5">Preencha os dados para criar o projeto.</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-[#1e1e1e] text-[#555] hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Seção: dados gerais */}
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f5c518]">Dados gerais</p>
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Título do projeto</label>
                  <input className={inputCls} placeholder="Ex: Instalação Fotovoltaica Industrial" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                  {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Cliente</label>
                  <input className={inputCls} placeholder="Nome da empresa ou pessoa" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} />
                  {errors.client && <p className="text-red-400 text-xs mt-1">{errors.client}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Tipo de serviço</label>
                    <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      {serviceTypes.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Etapa inicial</label>
                    <select className={inputCls} value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as Stage })}>
                      {STAGES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-[#ddd] cursor-pointer select-none w-fit">
                  <input
                    type="checkbox"
                    checked={form.isPriority}
                    onChange={e => setForm({ ...form, isPriority: e.target.checked })}
                    className="h-4 w-4 rounded border-[#333] bg-[#111] accent-[#f5c518]"
                  />
                  Projeto prioritário
                </label>
              </div>

              <div className="border-t border-[#1e1e1e]" />

              {/* Seção: responsáveis */}
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f5c518]">Responsáveis</p>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Vendedor responsável</label>
                    {user.team === "vendas" ? (
                      <div className={`${inputCls} opacity-70`}>{user.name} (você)</div>
                    ) : (
                      <select className={inputCls} value={form.vendedorId} onChange={e => setForm({ ...form, vendedorId: e.target.value })}>
                        <option value="">Sem vendedor definido</option>
                        {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">
                    Equipe de instalação <span className="text-[#555]">({form.instaladorIds.length} selecionado(s))</span>
                  </label>
                  <InstallerPicker
                    options={instaladores}
                    selected={form.instaladorIds}
                    onChange={(ids) => setForm({ ...form, instaladorIds: ids })}
                  />
                </div>
                {user.team !== "vendas" && vendedores.length === 0 && (
                  <p className="text-xs text-[#555]">Nenhum vendedor com acesso ao sistema ainda (cadastre em Funcionários).</p>
                )}
              </div>

              <div className="border-t border-[#1e1e1e]" />

              {/* Seção: prazo */}
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f5c518]">Prazo</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Data de início</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                      <input type="date" className={`${inputCls} pl-9`} value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />
                    </div>
                    {errors.start && <p className="text-red-400 text-xs mt-1">{errors.start}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Previsão de conclusão</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                      <input type="date" className={`${inputCls} pl-9`} value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} />
                    </div>
                    {errors.end && <p className="text-red-400 text-xs mt-1">{errors.end}</p>}
                  </div>
                </div>
                <p className="text-xs text-[#555]">
                  Progresso inicial (calculado pela etapa): <span className="text-[#f5c518]">{progressForStage(form.stage)}%</span>
                </p>
              </div>

              <div className="border-t border-[#1e1e1e]" />

              {user.team !== "instalacao" && (
              <>
              {/* Seção: valores e pagamento */}
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f5c518]">Valores e pagamento</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Valor do sistema (R$)</label>
                    <input type="number" className={inputCls} placeholder="0,00" value={form.valorSistema} onChange={e => setForm({ ...form, valorSistema: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Valor da mão de obra (R$)</label>
                    <input type="number" className={inputCls} placeholder="0,00" value={form.valorMO} onChange={e => setForm({ ...form, valorMO: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Forma de pagamento</label>
                    <select className={inputCls} value={form.paymentMethod ?? ""} onChange={e => setForm({ ...form, paymentMethod: e.target.value as Project["paymentMethod"] })}>
                      <option value="">Selecione...</option>
                      <option value="Pix">Pix</option>
                      <option value="Boleto">Boleto</option>
                      <option value="Cartão">Cartão</option>
                      <option value="Após instalação">Após instalação</option>
                      <option value="Financiamento">Financiamento</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Entrada já recebida (R$)</label>
                    <input type="number" className={inputCls} placeholder="0,00 (opcional)" value={form.entrada} onChange={e => setForm({ ...form, entrada: e.target.value })} />
                  </div>
                </div>
                {(parseFloat(form.valorSistema) > 0 || parseFloat(form.valorMO) > 0) && (
                  <p className="text-xs text-[#555]">
                    Total: <span className="text-white font-medium">{fmt((parseFloat(form.valorSistema) || 0) + (parseFloat(form.valorMO) || 0))}</span>
                    {" · "}A receber após entrada:{" "}
                    <span className="text-[#f5c518] font-medium">
                      {fmt(Math.max((parseFloat(form.valorSistema) || 0) + (parseFloat(form.valorMO) || 0) - (parseFloat(form.entrada) || 0), 0))}
                    </span>
                  </p>
                )}
              </div>

              <div className="border-t border-[#1e1e1e]" />
              </>
              )}

              {/* Seção: fotos */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f5c518]">Fotos (opcional)</p>
                <label className="flex items-center justify-center gap-2 border border-dashed border-[#333] rounded-lg py-4 text-sm text-[#888] cursor-pointer hover:border-[#f5c518]/40 hover:text-[#f5c518] transition-colors">
                  + Selecionar fotos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => setPhotoFiles(e.target.files ? Array.from(e.target.files) : [])}
                  />
                </label>
                {photoFiles.length > 0 && (
                  <p className="text-xs text-[#555]">{photoFiles.length} foto(s) selecionada(s) — aparecem só nos detalhes do projeto.</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-lg border border-[#222] text-sm text-[#888] hover:text-white hover:border-[#333] transition-colors font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-[#f5c518] text-black text-sm font-bold hover:bg-[#e6b800] transition-colors disabled:opacity-60">
                  {submitting ? "Criando..." : "Criar projeto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}