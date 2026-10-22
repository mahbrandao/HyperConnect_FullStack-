"use client";

import { useEffect, useState } from "react";
import { Plus, Search, X, User, Mail, Phone, Briefcase, Calendar, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

type Status = "Ativo" | "Inativo" | "Férias";

type Employee = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  since: string;
  status: Status;
};

type AccessInvite = {
  email: string;
  team: "gerente" | "admin" | "vendas" | "instalacao";
};

function toBR(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const departments = ["Instalações", "Projetos", "Automação", "Comercial", "Administrativo", "TI"];
const roles = ["Técnico de Campo", "Engenheiro Elétrico", "Analista de Automação", "Gerente de Projetos", "Vendedor", "Assistente Administrativo"];
const statusOptions: Status[] = ["Ativo", "Inativo", "Férias"];

const statusStyle: Record<Status, string> = {
  Ativo: "bg-green-500/15 text-green-400",
  Inativo: "bg-red-500/15 text-red-400",
  Férias: "bg-blue-500/15 text-blue-400",
};

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: roles[0],
  department: departments[0],
  since: "",
  status: "Ativo" as Status,
  giveAccess: false,
  accessEmail: "",
  accessTeam: "vendas" as AccessInvite["team"],
};

function toISO(br: string) {
  if (!br) return "";
  const [d, m, y] = br.split("/");
  return `${y}-${m}-${d}`;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const avatarColors = [
  "bg-[#f5c518] text-black",
  "bg-blue-500 text-white",
  "bg-purple-500 text-white",
  "bg-green-500 text-black",
  "bg-orange-500 text-white",
];

export default function Employees() {
  const { user } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [invites, setInvites] = useState<AccessInvite[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [access, setAccess] = useState<{ id: string; team: AccessInvite["team"] } | null>(null);
  const [accessTeam, setAccessTeam] = useState<AccessInvite["team"]>("vendas");

  async function loadEmployees() {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, email, phone, role, department, since, status")
      .order("created_at", { ascending: false });
    if (error) setLoadError(error.message);
    else {
      setLoadError(null);
      setEmployees((data ?? []).map(e => ({ ...e, since: toBR(e.since) })));
    }
    setLoading(false);
  }

  useEffect(() => { loadEmployees(); }, []);

  const filtered = employees.filter(
    e =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase())
  );

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Informe o nome completo.";
    if (!form.email.trim()) e.email = "Informe o e-mail.";
    if (!form.since) e.since = "Informe a data de admissão.";
    return e;
  }

  async function openEdit(emp: Employee) {
    setEditingId(emp.id);
    setErrors({});
    setAccess(null);
    setForm({
      ...emptyForm,
      name: emp.name,
      email: emp.email,
      phone: emp.phone ?? "",
      role: emp.role,
      department: emp.department,
      since: toISO(emp.since),
      status: emp.status,
    });
    setOpen(true);
    const { data } = await supabase.from("profiles").select("id, team").ilike("email", emp.email).maybeSingle();
    if (data?.team) {
      setAccess({ id: data.id, team: data.team as AccessInvite["team"] });
      setAccessTeam(data.team as AccessInvite["team"]);
    }
  }

  function closeModal() {
    setOpen(false);
    setEditingId(null);
    setAccess(null);
    setForm(emptyForm);
    setErrors({});
  }

  async function handleEditSubmit() {
    setSaving(true);
    const { error: upError } = await supabase.from("employees").update({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      department: form.department,
      since: form.since,
      status: form.status,
    }).eq("id", editingId!);
    if (upError) {
      setSaving(false);
      setErrors({ name: `Erro ao salvar: ${upError.message}` });
      return;
    }
    if (access) {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/update-access", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ userId: access.id, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), team: accessTeam }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaving(false);
        setErrors({ name: `Cadastro salvo, mas o acesso não atualizou: ${result.error ?? "erro"}` });
        await loadEmployees();
        return;
      }
    }
    setSaving(false);
    closeModal();
    await loadEmployees();
  }

   async function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault();
    if (saving) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (editingId) { await handleEditSubmit(); return; }

    setSaving(true);

    const { data: existing } = await supabase
      .from("employees")
      .select("id")
      .ilike("email", form.email.trim())
      .limit(1);
    if (existing && existing.length > 0) {
      setSaving(false);
      setErrors({ email: "Já existe um funcionário cadastrado com esse e-mail." });
      return;
    }

    const { error: empError } = await supabase.from("employees").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      department: form.department,
      since: form.since,
      status: form.status,
    });

    if (empError) {
      setSaving(false);
      setErrors({ name: `Erro ao salvar funcionário: ${empError.message}` });
      return;
    }

    if (form.giveAccess && form.accessEmail.trim()) {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/create-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.accessEmail.trim(),
          team: form.accessTeam,
          phone: form.phone.trim(),
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        setSaving(false);
        setErrors({ name: `Funcionário salvo, mas o acesso falhou: ${result.error}` });
        await loadEmployees();
        return;
      }

      setInvites(prev => [...prev, { email: form.accessEmail.trim(), team: form.accessTeam }]);
      alert(
        `Acesso criado!\n\nE-mail: ${form.accessEmail.trim()}\nSenha provisória: ${result.password}\n\nCompartilhe essa senha com o funcionário (ele(a) já pode trocar depois de entrar).`
      );
    }

    setSaving(false);
    setOpen(false);
    setForm(emptyForm);
    setErrors({});
    await loadEmployees();
  }

  async function handleDelete(id: string) {
    const { data, error } = await supabase.from("employees").delete().eq("id", id).select("id");
    if (error) { alert(`Erro ao excluir: ${error.message}`); return; }
    if (!data || data.length === 0) { alert("Sem permissão para excluir este funcionário (apenas gerente/admin)."); return; }
    setEmployees(prev => prev.filter(e => e.id !== id));
  }

  const inputCls = "w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#f5c518]/50 transition-colors";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Funcionários</h1>
          <p className="text-[#888] text-sm">Gerencie a equipe da Hyper Connect.</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setAccess(null); setForm(emptyForm); setOpen(true); setErrors({}); }}
          className="bg-[#f5c518] text-black font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[#e6b800] transition-colors"
        >
          <Plus size={16} />
          Novo funcionário
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total", value: employees.length, color: "text-white" },
          { label: "Ativos", value: employees.filter(e => e.status === "Ativo").length, color: "text-green-400" },
          { label: "Em férias", value: employees.filter(e => e.status === "Férias").length, color: "text-blue-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#151515] border border-[#222] rounded-xl p-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-[#888] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar funcionário"
          className="w-full bg-[#1a1a1a] border border-[#222] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#333]"
        />
      </div>

      {/* Table */}
      <div className="bg-[#151515] border border-[#222] rounded-xl overflow-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#222]">
              {["Funcionário", "Cargo", "Departamento", "Admissão", "Status", ""].map(col => (
                <th key={col} className="text-left py-3 px-4 text-xs font-medium text-[#555] uppercase tracking-wider">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e1e]">
            {loading && (
              <tr><td colSpan={6} className="text-center py-12 text-[#555] text-sm">Carregando...</td></tr>
            )}
            {!loading && loadError && (
              <tr><td colSpan={6} className="text-center py-12 text-red-400 text-sm">Erro ao carregar: {loadError}</td></tr>
            )}
            {!loading && !loadError && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#555] text-sm">Nenhum funcionário encontrado.</td>
              </tr>
            )}
            {!loading && !loadError && filtered.map((emp, idx) => (
              <tr key={emp.id} className="hover:bg-[#1a1a1a] transition-colors group">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColors[idx % avatarColors.length]}`}>
                      {initials(emp.name)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{emp.name}</div>
                      <div className="text-xs text-[#555]">{emp.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-sm text-[#888]">{emp.role}</td>
                <td className="py-3.5 px-4 text-sm text-[#888]">{emp.department}</td>
                <td className="py-3.5 px-4 text-sm text-[#888]">{emp.since}</td>
                <td className="py-3.5 px-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyle[emp.status]}`}>
                    {emp.status}
                  </span>
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <button
                    type="button"
                    title="Editar funcionário"
                    onClick={() => openEdit(emp)}
                    className="p-1.5 rounded-lg text-[#555] hover:text-[#f5c518] hover:bg-[#f5c518]/10 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    title="Excluir funcionário"
                    onClick={() => { if (confirm(`Excluir ${emp.name}? Essa ação não pode ser desfeita.`)) handleDelete(emp.id); }}
                    className="p-1.5 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-[#111] border border-[#222] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e1e1e] sticky top-0 bg-[#111] z-10">
              <div>
                <h2 className="text-base font-bold text-white">{editingId ? "Editar funcionário" : "Novo funcionário"}</h2>
                <p className="text-xs text-[#555] mt-0.5">{editingId ? "Altere os dados e salve." : "Preencha os dados para cadastrar."}</p>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-[#1e1e1e] text-[#555] hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5">
                  <span className="flex items-center gap-1.5"><User size={12} /> Nome completo</span>
                </label>
                <input className={inputCls} placeholder="Ex: Maria Silva" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5">
                  <span className="flex items-center gap-1.5"><Mail size={12} /> E-mail corporativo</span>
                </label>
                <input type="email" className={inputCls} placeholder="nome@gmail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5">
                  <span className="flex items-center gap-1.5"><Phone size={12} /> Telefone</span>
                </label>
                <input className={inputCls} placeholder="(11) 99999-9999" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>

              {editingId && access && (
                <div className="rounded-lg border border-[#2a2a2a] bg-[#161616] p-3 space-y-2">
                  <p className="text-[11px] text-[#888] leading-5">
                    Este funcionário tem acesso ao sistema. Nome, e-mail e telefone acima também atualizam o login dele(a).
                  </p>
                  <label className="block text-xs font-medium text-[#888]">Departamento de acesso</label>
                  <select
                    className={inputCls}
                    value={accessTeam}
                    onChange={e => setAccessTeam(e.target.value as AccessInvite["team"])}
                  >
                    <option value="gerente">Gerência</option>
                    <option value="admin">Administração</option>
                    <option value="vendas">Vendas</option>
                    <option value="instalacao">Instalação</option>
                  </select>
                  <p className="text-[11px] text-[#555]">Só o gerente pode mudar o departamento.</p>
                </div>
              )}

              {!editingId && <div className="rounded-lg border border-[#2a2a2a] bg-[#161616] p-3">
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.giveAccess}
                    onChange={e => setForm({ ...form, giveAccess: e.target.checked })}
                    className="accent-[#f5c518]"
                  />
                  Dar acesso ao sistema
                </label>
                <p className="mt-2 text-[11px] text-[#888] leading-5">
                  A conta de acesso já é criada aprovada, com uma senha provisória gerada automaticamente (mostrada na tela depois de salvar, pra você repassar ao funcionário).
                </p>
              </div>}

              {!editingId && form.giveAccess && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">E-mail de acesso</label>
                    <input
                      type="email"
                      className={inputCls}
                      placeholder="funcionario@gmail.com"
                      value={form.accessEmail}
                      onChange={e => setForm({ ...form, accessEmail: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Departamento de acesso</label>
                    <select
                      className={inputCls}
                      value={form.accessTeam}
                      onChange={e => setForm({ ...form, accessTeam: e.target.value as AccessInvite["team"] })}
                    >
                      <option value="gerente">Gerência</option>
                      <option value="admin">Administração</option>
                      <option value="vendas">Vendas</option>
                      <option value="instalacao">Instalação</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">
                    <span className="flex items-center gap-1.5"><Briefcase size={12} /> Cargo</span>
                  </label>
                  <select className={inputCls} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    {roles.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Departamento</label>
                  <select className={inputCls} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                    {departments.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">
                    <span className="flex items-center gap-1.5"><Calendar size={12} /> Data de admissão</span>
                  </label>
                  <input type="date" className={inputCls} value={form.since} onChange={e => setForm({ ...form, since: e.target.value })} />
                  {errors.since && <p className="text-red-400 text-xs mt-1">{errors.since}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Status</label>
                  <select className={inputCls} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}>
                    {statusOptions.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-lg border border-[#222] text-sm text-[#888] hover:text-white hover:border-[#333] transition-colors font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-[#f5c518] text-black text-sm font-bold hover:bg-[#e6b800] transition-colors disabled:opacity-60">
                  {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar funcionário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}