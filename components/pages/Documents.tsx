"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Download, FileText, Plus, X, Upload, CloudUpload, Trash2, Pencil, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { safeFileName } from "@/lib/storage";
import { useUser } from "@/hooks/useUser";
import { useProjects } from "@/hooks/useProjects";

// Documentos obrigatórios de todo projeto. Para mudar, é só editar esta lista.
const requiredTypes = ["Contrato", "RG", "Conta de água"];
const docTypes = [...requiredTypes, "Projeto", "Técnico", "Orçamento", "Fiscal", "Manual", "Termo", "Outros"];
const MAX_SIZE = 20 * 1024 * 1024;

const typeColor: Record<string, string> = {
  Contrato: "bg-blue-500/15 text-blue-400",
  RG: "bg-pink-500/15 text-pink-400",
  "Conta de água": "bg-cyan-500/15 text-cyan-400",
  Projeto: "bg-purple-500/15 text-purple-400",
  Técnico: "bg-[#f5c518]/15 text-[#f5c518]",
  Orçamento: "bg-orange-500/15 text-orange-400",
  Fiscal: "bg-red-500/15 text-red-400",
  Manual: "bg-teal-500/15 text-teal-400",
  Termo: "bg-green-500/15 text-green-400",
  Outros: "bg-gray-500/15 text-gray-400",
};

type DocRow = {
  id: string;
  name: string;
  doc_type: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
  project_id: string | null;
  uploaded_by: string | null;
  project: { title: string; client: string } | null;
  uploader: { name: string } | null;
};

const emptyForm = { name: "", projectId: "", type: docTypes[0] };

// Garante que o nome salvo tenha a extensão do arquivo (.pdf, .jpg...)
function withExt(name: string, f: File | null) {
  if (!f) return name;
  const ext = f.name.includes(".") ? f.name.slice(f.name.lastIndexOf(".")) : "";
  return ext && !name.toLowerCase().endsWith(ext.toLowerCase()) ? name + ext : name;
}

export default function Documents() {
  const { user } = useUser();
  const { projects } = useProjects();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("todos");
  const [view, setView] = useState<"projetos" | "todos">("projetos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<DocRow | null>(null);

  async function loadDocs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select(
        "id, name, doc_type, file_path, file_size, created_at, project_id, uploaded_by, project:projects!documents_project_id_fkey(title, client), uploader:profiles!documents_uploaded_by_fkey(name)"
      )
      .order("created_at", { ascending: false });
    if (error) setLoadError(error.message);
    else { setLoadError(null); setDocs(data as unknown as DocRow[]); }
    setLoading(false);
  }

  useEffect(() => { loadDocs(); }, []);

  // Se veio de uma notificação (/documents?project=ID), já abre aquele projeto
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("project");
    if (id) { setFilterProject(id); setView("projetos"); }
  }, []);

  if (!user) return null;

  const canManage = user.team === "gerente" || user.team === "admin";
  const q = search.toLowerCase();

  const filtered = docs.filter((d) => {
    const matchSearch =
      !q ||
      d.name.toLowerCase().includes(q) ||
      (d.project?.title ?? "").toLowerCase().includes(q) ||
      (d.project?.client ?? "").toLowerCase().includes(q);
    const matchProject = filterProject === "todos" || d.project_id === filterProject;
    return matchSearch && matchProject;
  });

  const visibleProjects = projects.filter(
    (p) =>
      (filterProject === "todos" || p.id === filterProject) &&
      (!q || p.title.toLowerCase().includes(q) || (p.client ?? "").toLowerCase().includes(q))
  );

  function missingFor(projectId: string) {
    return requiredTypes.filter((t) => !docs.some((d) => d.project_id === projectId && d.doc_type === t));
  }

  const pendingProjects = projects.filter((p) => missingFor(p.id).length > 0).length;

  function pickFile(f: File) {
    setFile(f);
    if (!form.name) setForm((prev) => ({ ...prev, name: f.name }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Informe o nome do documento.";
    if (!file && !editing) e.file = "Selecione um arquivo para enviar.";
    else if (file && file.size > MAX_SIZE) e.file = "O arquivo passa de 20 MB.";
    return e;
  }

  function openNew(projectId = "", type = docTypes[0], name = "") {
    setEditing(null);
    setForm({ name, projectId, type });
    setFile(null);
    setErrors({});
    setOpen(true);
  }

  function openEdit(d: DocRow) {
    setEditing(d);
    setForm({ name: d.name, projectId: d.project_id ?? "", type: d.doc_type });
    setFile(null);
    setErrors({});
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setFile(null);
    setErrors({});
  }

  async function handleEdit() {
    if (!editing) return;
    setSubmitting(true);
    const update: Record<string, unknown> = {
      name: withExt(form.name.trim(), file),
      project_id: form.projectId || null,
      doc_type: form.type,
    };
    let newPath: string | null = null;
    if (file) {
      newPath = `${form.projectId || "sem-projeto"}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(newPath, file);
      if (upErr) {
        setSubmitting(false);
        setErrors({ file: `Erro ao enviar o arquivo: ${upErr.message}` });
        return;
      }
      update.file_path = newPath;
      update.file_size = file.size;
    }
    const { data, error } = await supabase.from("documents").update(update).eq("id", editing.id).select("id");
    if (error || !data || data.length === 0) {
      if (newPath) await supabase.storage.from("documents").remove([newPath]);
      setSubmitting(false);
      setErrors({ name: error ? `Erro ao salvar: ${error.message}` : "Sem permissão para editar este documento." });
      return;
    }
    if (newPath) await supabase.storage.from("documents").remove([editing.file_path]);
    setSubmitting(false);
    closeModal();
    await loadDocs();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (editing) { await handleEdit(); return; }
    if (!file) return;

    setSubmitting(true);
    const path = `${form.projectId || "sem-projeto"}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) {
      setSubmitting(false);
      setErrors({ file: `Erro ao enviar o arquivo: ${uploadError.message}` });
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      name: withExt(form.name.trim(), file),
      project_id: form.projectId || null,
      doc_type: form.type,
      file_path: path,
      file_size: file.size,
      uploaded_by: user?.id ?? null,
    });
    if (insertError) {
      await supabase.storage.from("documents").remove([path]);
      setSubmitting(false);
      setErrors({ name: `Erro ao salvar: ${insertError.message}` });
      return;
    }

    setSubmitting(false);
    closeModal();
    await loadDocs();
  }

  async function handleDownload(d: DocRow) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 60, { download: d.name });
    if (error || !data) { alert(`Erro ao baixar: ${error?.message}`); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function handleDelete(d: DocRow) {
    if (!confirm(`Excluir "${d.name}"? Essa ação não pode ser desfeita.`)) return;
    const { data, error } = await supabase.from("documents").delete().eq("id", d.id).select("id");
    if (error) { alert(`Erro ao excluir: ${error.message}`); return; }
    if (!data || data.length === 0) { alert("Sem permissão para excluir este documento."); return; }
    await supabase.storage.from("documents").remove([d.file_path]);
    setDocs((prev) => prev.filter((x) => x.id !== d.id));
  }

  function actions(d: DocRow) {
    const canEdit = canManage || d.uploaded_by === user?.id;
    return (
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          title="Baixar"
          onClick={() => handleDownload(d)}
          className="p-1.5 rounded-lg hover:bg-[#222] text-[#888] hover:text-white transition-colors"
        >
          <Download size={14} />
        </button>
        {canEdit && (
          <button
            title="Editar"
            onClick={() => openEdit(d)}
            className="p-1.5 rounded-lg text-[#555] hover:text-[#f5c518] hover:bg-[#f5c518]/10 transition-colors"
          >
            <Pencil size={14} />
          </button>
        )}
        {canEdit && (
          <button
            title="Excluir"
            onClick={() => handleDelete(d)}
            className="p-1.5 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  }

  const inputCls =
    "w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#f5c518]/50 transition-colors";

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active ? "bg-[#f5c518] text-black" : "text-[#888] hover:text-white hover:bg-[#1a1a1a]"
    }`;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Documentos</h1>
          <p className="text-[#888] text-sm">
            {pendingProjects > 0
              ? `${pendingProjects} projeto${pendingProjects > 1 ? "s" : ""} com documentos pendentes.`
              : "Todos os projetos estão com a documentação completa."}
          </p>
        </div>
        <button
          onClick={() => openNew(filterProject !== "todos" ? filterProject : "")}
          className="bg-[#f5c518] text-black font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[#e6b800] transition-colors"
        >
          <Plus size={16} />
          Novo documento
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1 bg-[#151515] border border-[#222] rounded-lg p-1">
          <button className={tabCls(view === "projetos")} onClick={() => setView("projetos")}>Por projeto</button>
          <button className={tabCls(view === "todos")} onClick={() => setView("todos")}>Todos os documentos</button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={view === "projetos" ? "Buscar projeto ou cliente" : "Buscar documento"}
            className="w-full bg-[#1a1a1a] border border-[#222] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#333]"
          />
        </div>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="bg-[#1a1a1a] border border-[#222] rounded-lg px-3 py-2 text-sm text-[#888] outline-none focus:border-[#333]"
        >
          <option value="todos">Todos os projetos</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title} — {p.client}</option>)}
        </select>
      </div>

      {loading && <div className="text-center py-12 text-[#555] text-sm">Carregando...</div>}
      {!loading && loadError && <div className="text-center py-12 text-red-400 text-sm">Erro ao carregar: {loadError}</div>}

      {/* ===== Por projeto ===== */}
      {!loading && !loadError && view === "projetos" && (
        <div className="space-y-4">
          {visibleProjects.length === 0 && (
            <div className="text-center py-12 text-[#555] text-sm">Nenhum projeto encontrado.</div>
          )}
          {visibleProjects.map((p) => {
            const projectDocs = docs.filter((d) => d.project_id === p.id);
            const missing = missingFor(p.id);
            const extras = projectDocs.filter((d) => !requiredTypes.includes(d.doc_type));
            return (
              <div key={p.id} className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e]">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{p.title}</div>
                    <div className="text-xs text-[#555] truncate">{p.client}</div>
                  </div>
                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                      missing.length === 0 ? "bg-green-500/15 text-green-400" : "bg-[#f5c518]/15 text-[#f5c518]"
                    }`}
                  >
                    {missing.length === 0
                      ? "Documentação completa"
                      : `${missing.length} pendente${missing.length > 1 ? "s" : ""}`}
                  </span>
                </div>

                <div className="divide-y divide-[#1e1e1e]">
                  {requiredTypes.map((t) => {
                    const d = projectDocs.find((x) => x.doc_type === t);
                    return (
                      <div key={t} className="flex items-center gap-3 px-4 py-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            d ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {d ? <Check size={13} /> : <X size={13} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white">{t}</div>
                          <div className="text-[11px] text-[#555] truncate">
                            {d
                              ? `${d.name} · enviado em ${new Date(d.created_at).toLocaleDateString("pt-BR")}`
                              : "Ainda não enviado"}
                          </div>
                        </div>
                        {d ? (
                          actions(d)
                        ) : (
                          <button
                            onClick={() => openNew(p.id, t, `${t} - ${p.title}`)}
                            className="bg-[#f5c518] text-black font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 hover:bg-[#e6b800] transition-colors flex-shrink-0"
                          >
                            <Upload size={12} />
                            Enviar
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {extras.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-[#222] text-[#888]">
                        <FileText size={12} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">{d.name}</div>
                        <div className="text-[11px] text-[#555]">
                          <span className={`px-1.5 py-0.5 rounded-full mr-1.5 ${typeColor[d.doc_type] || "bg-gray-500/15 text-gray-400"}`}>
                            {d.doc_type}
                          </span>
                          {new Date(d.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      {actions(d)}
                    </div>
                  ))}

                  <div className="px-4 py-2.5">
                    <button
                      onClick={() => openNew(p.id, "Outros")}
                      className="text-xs text-[#888] hover:text-[#f5c518] inline-flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} />
                      Adicionar outro documento
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Todos os documentos ===== */}
      {!loading && !loadError && view === "todos" && (
        <div className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#222]">
                {["Documento", "Projeto", "Enviado por", "Data", "Tipo", "Ações"].map((col) => (
                  <th key={col} className="text-left py-3 px-4 text-xs font-medium text-[#555] uppercase tracking-wider">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-[#555] text-sm">Nenhum documento encontrado.</td></tr>
              )}
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-[#1a1a1a] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText size={14} className="text-red-400" />
                      </div>
                      <div>
                        <span className="text-sm text-white font-medium">{d.name}</span>
                        {d.file_size ? <div className="text-[11px] text-[#555]">{(d.file_size / 1024).toFixed(1)} KB</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-sm text-[#888]">
                    {d.project ? (<><div className="text-[#ccc]">{d.project.title}</div><div className="text-xs text-[#555]">{d.project.client}</div></>) : "—"}
                  </td>
                  <td className="py-3.5 px-4 text-sm text-[#888]">{d.uploader?.name ?? "—"}</td>
                  <td className="py-3.5 px-4 text-sm text-[#888]">{new Date(d.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="py-3.5 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[d.doc_type] || "bg-gray-500/15 text-gray-400"}`}>
                      {d.doc_type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{actions(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Modal enviar / editar ===== */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-[#111] border border-[#222] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e1e1e]">
              <div>
                <h2 className="text-base font-bold text-white">{editing ? "Editar documento" : "Enviar documento"}</h2>
                <p className="text-xs text-[#555] mt-0.5">{editing ? "Altere os dados ou troque o arquivo." : "Envie um arquivo e vincule a um projeto."}</p>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-[#1e1e1e] text-[#555] hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5">{editing ? "Trocar arquivo (opcional)" : "Arquivo"}</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files[0];
                    if (f) pickFile(f);
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    dragging ? "border-[#f5c518]/60 bg-[#f5c518]/5" : file ? "border-[#f5c518]/30 bg-[#f5c518]/5" : "border-[#2a2a2a] hover:border-[#333]"
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-8 h-8 bg-red-500/15 rounded-lg flex items-center justify-center">
                        <FileText size={14} className="text-red-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm text-white font-medium truncate max-w-[220px]">{file.name}</p>
                        <p className="text-xs text-[#555]">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="ml-auto p-1 rounded hover:bg-[#222] text-[#555] hover:text-white transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {editing && <p className="text-xs text-[#888] mb-2">Arquivo atual: <span className="text-white">{editing.name}</span></p>}
                      <CloudUpload size={24} className="mx-auto text-[#444] mb-2" />
                      <p className="text-sm text-[#666]">Arraste um arquivo ou <span className="text-[#f5c518]">clique para selecionar</span></p>
                      <p className="text-xs text-[#444] mt-1">PDF, DOCX, XLSX, PNG, JPG — máx. 20 MB</p>
                    </>
                  )}
                </div>
                {errors.file && <p className="text-red-400 text-xs mt-1">{errors.file}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5">Nome do documento</label>
                <input
                  className={inputCls}
                  placeholder="Ex: Contrato - Residência Oliveira"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Projeto</label>
                  <select className={inputCls} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                    <option value="">Sem projeto vinculado</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.title} — {p.client}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Tipo</label>
                  <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {docTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-lg border border-[#222] text-sm text-[#888] hover:text-white hover:border-[#333] transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-[#f5c518] text-black text-sm font-bold hover:bg-[#e6b800] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Upload size={14} />
                  {submitting ? (editing ? "Salvando..." : "Enviando...") : editing ? "Salvar alterações" : "Enviar documento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}