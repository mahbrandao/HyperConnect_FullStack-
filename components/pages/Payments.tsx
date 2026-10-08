"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Wallet, TrendingUp, CheckCircle2, Smartphone, FileText, CreditCard, Landmark, Hourglass,
  Plus, X, ChevronDown, ChevronUp, Trash2, History,
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useUser } from "@/hooks/useUser";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Project, PaymentMethod } from "@/interfaces/project";

const paymentMethodIcon: Record<string, ReactElement> = {
  "Pix": <Smartphone size={13} />,
  "Boleto": <FileText size={13} />,
  "Cartão": <CreditCard size={13} />,
  "Após instalação": <Hourglass size={13} />,
  "Financiamento": <Landmark size={13} />,
};

const METHODS: PaymentMethod[] = ["Pix", "Boleto", "Cartão", "Após instalação", "Financiamento"];

type Payment = {
  id: string;
  project_id: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod | null;
  note: string | null;
};

type Filter = "todos" | "pendentes" | "parciais" | "pagos";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (n: number) => brl.format(n);
const todayISO = () => new Date().toISOString().slice(0, 10);
const dateBR = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

function parseMoney(v: string) {
  let t = v.trim().replace(/[^\d.,]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return t === "" || !Number.isFinite(n) ? NaN : n;
}

function statusOf(p: Project): "pago" | "parcial" | "pendente" {
  const aReceber = p.valorAReceber ?? 0;
  if (aReceber <= 0) return "pago";
  if (aReceber < p.value) return "parcial";
  return "pendente";
}

export default function Payments() {
  const { user } = useUser();
  const router = useRouter();
  const { projects, loading, error, reload } = useProjects();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<Filter>("todos");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [adding, setAdding] = useState<Project | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [dateInput, setDateInput] = useState(todayISO());
  const [methodInput, setMethodInput] = useState<PaymentMethod | "">("");
  const [noteInput, setNoteInput] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.team === "instalacao") router.replace("/app");
  }, [user, router]);

  const loadPayments = useCallback(async () => {
    const { data } = await supabase
      .from("project_payments")
      .select("id, project_id, amount, paid_at, method, note")
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false });
    setPayments(((data ?? []) as Payment[]).map((p) => ({ ...p, amount: Number(p.amount) })));
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const byProject = useMemo(() => {
    const m: Record<string, Payment[]> = {};
    for (const p of payments) (m[p.project_id] ||= []).push(p);
    return m;
  }, [payments]);

  const totals = useMemo(() => {
    const totalContratado = projects.reduce((s, p) => s + p.value, 0);
    const totalAReceber = projects.reduce((s, p) => s + (p.valorAReceber ?? 0), 0);
    const totalRecebido = totalContratado - totalAReceber;
    const pct = totalContratado > 0 ? Math.round((totalRecebido / totalContratado) * 100) : 0;
    return { totalContratado, totalAReceber, totalRecebido, pct };
  }, [projects]);

  const filtered = projects.filter((p) => {
    const status = statusOf(p);
    if (filter === "pendentes") return status === "pendente";
    if (filter === "parciais") return status === "parcial";
    if (filter === "pagos") return status === "pago";
    return true;
  });

  const isManager = user?.team === "gerente" || user?.team === "admin";
  const canRegister = (p: Project) => isManager || (user?.team === "vendas" && p.vendedorId === user.id);

  function openAdd(p: Project) {
    setAdding(p);
    setAmountInput("");
    setDateInput(todayISO());
    setMethodInput(p.paymentMethod ?? "");
    setNoteInput("");
    setFormError("");
  }

  async function insertPayment(p: Project, amount: number, date: string, method: PaymentMethod | "", note: string) {
    const { error } = await supabase.from("project_payments").insert({
      project_id: p.id,
      amount,
      paid_at: date,
      method: method || null,
      note: note.trim() || null,
      created_by: user?.id ?? null,
    });
    return error;
  }

  async function submitPayment() {
    if (!adding) return;
    const amount = parseMoney(amountInput);
    const falta = adding.valorAReceber ?? 0;
    if (Number.isNaN(amount) || amount <= 0) { setFormError("Digite o valor que o cliente pagou."); return; }
    if (amount > falta + 0.005) { setFormError(`Esse valor passa do que falta receber (${money(falta)}).`); return; }
    if (!dateInput) { setFormError("Informe a data do pagamento."); return; }
    setFormError("");
    setSaving(true);
    const err = await insertPayment(adding, amount, dateInput, methodInput, noteInput);
    setSaving(false);
    if (err) { setFormError(`Erro ao registrar: ${err.message}`); return; }
    setAdding(null);
    setExpanded(adding.id);
    await Promise.all([reload(), loadPayments()]);
  }

  async function quitar(p: Project) {
    const falta = p.valorAReceber ?? 0;
    if (falta <= 0) return;
    if (!confirm(`Registrar o pagamento do saldo restante (${money(falta)}) como recebido hoje?`)) return;
    const err = await insertPayment(p, falta, todayISO(), p.paymentMethod ?? "", "Quitação do saldo");
    if (err) { alert(`Erro ao registrar: ${err.message}`); return; }
    setExpanded(p.id);
    await Promise.all([reload(), loadPayments()]);
  }

  async function removePayment(pay: Payment) {
    if (!confirm(`Apagar o pagamento de ${money(pay.amount)} (${dateBR(pay.paid_at)})? O valor volta a ficar como "a receber".`)) return;
    const { data, error } = await supabase.from("project_payments").delete().eq("id", pay.id).select("id");
    if (error) { alert(`Erro ao apagar: ${error.message}`); return; }
    if (!data || data.length === 0) { alert("Sem permissão para apagar (apenas gerente/admin)."); return; }
    await Promise.all([reload(), loadPayments()]);
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "pendentes", label: "Pendentes" },
    { key: "parciais", label: "Parciais" },
    { key: "pagos", label: "Pagos" },
  ];

  if (user?.team === "instalacao") return null;

  const field = "w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#f5c518]/50 transition-colors";

  function HistoryList({ project }: { project: Project }) {
    const list = byProject[project.id] ?? [];
    if (list.length === 0) {
      return <div className="text-xs text-[#555] py-3">Nenhum pagamento registrado ainda.</div>;
    }
    return (
      <div className="divide-y divide-[#1e1e1e]">
        {list.map((pay) => (
          <div key={pay.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-medium text-green-400">+ {money(pay.amount)}</div>
              <div className="text-[11px] text-[#888] truncate">
                {dateBR(pay.paid_at)}
                {pay.method ? ` · ${pay.method}` : ""}
                {pay.note ? ` · ${pay.note}` : ""}
              </div>
            </div>
            {isManager && (
              <button
                onClick={() => removePayment(pay)}
                title="Apagar este pagamento"
                className="p-1.5 rounded-lg text-[#555] hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Pagamentos</h1>
        <p className="text-[#888] text-sm">Registre cada pagamento do cliente. O sistema calcula o que já foi recebido e o que falta.</p>
      </div>

      {loading && <div className="text-center py-10 text-[#555] text-sm">Carregando...</div>}
      {!loading && error && <div className="text-center py-10 text-red-400 text-sm">Erro ao carregar: {error}</div>}

      {!loading && !error && (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-[#f5c518]/25 bg-gradient-to-br from-[#1c1808] via-[#151515] to-[#151515] p-6">
            <Wallet size={100} className="absolute -right-4 -top-4 text-[#f5c518]/10" />
            <div className="flex items-center gap-2 text-[#f5c518] text-xs font-semibold uppercase tracking-[0.18em]">
              <TrendingUp size={14} />
              Valor total contratado
            </div>
            <div className="mt-2 text-4xl font-bold text-white">{money(totals.totalContratado)}</div>
            <div className="mt-4 flex items-center gap-6 text-sm">
              <div>
                <div className="text-green-400 font-semibold">{money(totals.totalRecebido)}</div>
                <div className="text-[11px] text-[#888]">recebido</div>
              </div>
              <div>
                <div className="text-[#f5c518] font-semibold">{money(totals.totalAReceber)}</div>
                <div className="text-[11px] text-[#888]">a receber</div>
              </div>
              <div className="flex-1 max-w-xs">
                <div className="h-2 rounded-full bg-[#222] overflow-hidden">
                  <div className="h-2 rounded-full bg-gradient-to-r from-green-500 to-[#f5c518]" style={{ width: `${totals.pct}%` }} />
                </div>
                <div className="text-[11px] text-[#888] mt-1">{totals.pct}% recebido</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.key ? "bg-[#f5c518] text-black" : "bg-[#151515] border border-[#222] text-[#888] hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="text-center py-16 text-[#555] text-sm">Nenhum projeto nessa categoria.</div>
            )}
            {filtered.map((p) => {
              const status = statusOf(p);
              const falta = p.valorAReceber ?? 0;
              const recebido = Math.max(p.value - falta, 0);
              const pctExact = p.value > 0 ? (recebido / p.value) * 100 : 0;
              const pctLabel = (Number.isInteger(pctExact) ? String(pctExact) : (Math.floor(pctExact * 10) / 10).toFixed(1).replace(".", ",")) + "%";
              const list = byProject[p.id] ?? [];
              const isOpen = expanded === p.id;
              return (
                <div key={p.id} className="bg-[#151515] border border-[#222] rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-sm font-semibold text-white">{p.client}</div>
                      <div className="text-xs text-[#555]">{p.title} · {p.vendedor || "sem vendedor"}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.paymentMethod && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#ccc]">
                          {paymentMethodIcon[p.paymentMethod]} {p.paymentMethod}
                        </span>
                      )}
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full font-medium ${
                          status === "pago"
                            ? "bg-green-500/15 text-green-400"
                            : status === "parcial"
                            ? "bg-[#f5c518]/15 text-[#f5c518]"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {status === "pago" ? "Pago" : status === "parcial" ? "Parcial" : "Pendente"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-3">
                    <div>
                      <div className="text-[#555]">Valor total</div>
                      <div className="text-white font-semibold text-sm">{money(p.value)}</div>
                    </div>
                    <div>
                      <div className="text-[#555]">Já recebido</div>
                      <div className="text-green-400 font-semibold text-sm">{money(recebido)}</div>
                    </div>
                    <div>
                      <div className="text-[#555]">Falta receber</div>
                      <div className={`font-semibold text-sm ${falta <= 0 ? "text-green-400" : "text-[#f5c518]"}`}>{money(falta)}</div>
                    </div>
                    <div>
                      <div className="text-[#555]">Último pagamento</div>
                      <div className="text-white font-medium text-sm">{p.dataPgto ? dateBR(p.dataPgto) : "—"}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 bg-[#222] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-green-500 to-[#f5c518]" style={{ width: `${Math.min(pctExact, 100)}%` }} />
                    </div>
                    <span className="text-[11px] text-[#888] w-12 text-right">{pctLabel}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {falta > 0 && canRegister(p) && (
                      <button
                        onClick={() => openAdd(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#f5c518] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#e6b800] transition-colors"
                      >
                        <Plus size={13} /> Registrar pagamento
                      </button>
                    )}
                    {falta > 0 && canRegister(p) && (
                      <button
                        onClick={() => quitar(p)}
                        className="inline-flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 text-[11px] text-green-400 hover:bg-green-500/15"
                      >
                        <CheckCircle2 size={12} /> Quitar saldo
                      </button>
                    )}
                    <button
                      onClick={() => setExpanded(isOpen ? null : p.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#111] px-2.5 py-1.5 text-[11px] text-[#ccc] hover:bg-[#1a1a1a]"
                    >
                      <History size={12} /> Histórico ({list.length})
                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-3 rounded-lg border border-[#222] bg-[#111] px-4">
                      <HistoryList project={p} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {adding && (() => {
        const falta = adding.valorAReceber ?? 0;
        const recebido = Math.max(adding.value - falta, 0);
        const amount = parseMoney(amountInput);
        const amountOk = !Number.isNaN(amount) && amount > 0 && amount <= falta + 0.005;
        const faltaDepois = amountOk ? Math.max(falta - amount, 0) : falta;
        const recebidoDepois = amountOk ? recebido + amount : recebido;
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setAdding(null)}>
            <div className="bg-[#151515] border border-[#222] rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#1e1e1e]">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white">Registrar pagamento</h3>
                  <p className="text-xs text-[#888] mt-0.5 truncate">{adding.client} · {adding.title}</p>
                </div>
                <button onClick={() => setAdding(null)} className="text-[#888] hover:text-white"><X size={16} /></button>
              </div>

              <div className="p-6 space-y-5">
                <div className="rounded-xl border border-[#222] bg-[#111] p-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[11px] text-[#888]">Valor total</div>
                      <div className="text-sm font-bold text-white">{money(adding.value)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#888]">Já recebido</div>
                      <div className="text-sm font-bold text-green-400">{money(recebidoDepois)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#888]">Vai faltar</div>
                      <div className={`text-sm font-bold ${faltaDepois <= 0 ? "text-green-400" : "text-[#f5c518]"}`}>{money(faltaDepois)}</div>
                    </div>
                  </div>
                  {amountOk && (
                    <p className="mt-3 text-[11px] text-[#888]">
                      Depois deste pagamento: {faltaDepois <= 0 ? "o projeto fica totalmente pago." : `ainda faltam ${money(faltaDepois)}.`}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#ccc] mb-0.5">Quanto o cliente pagou agora? (R$)</label>
                  <p className="text-[11px] text-[#666] mb-2">Digite só este pagamento (a entrada, uma parcela...). Não precisa somar com os anteriores.</p>
                  <input
                    inputMode="decimal"
                    autoFocus
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0,00"
                    className={field}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setAmountInput(String(falta).replace(".", ","))}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/15"
                    >
                      Todo o saldo ({money(falta)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountInput((Math.round((falta / 2) * 100) / 100).toString().replace(".", ","))}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-[#2a2a2a] bg-[#111] text-[#888] hover:text-white"
                    >
                      Metade do saldo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#888] mb-1">Data do pagamento</label>
                    <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#888] mb-1">Forma de pagamento</label>
                    <select value={methodInput} onChange={(e) => setMethodInput(e.target.value as PaymentMethod | "")} className={field}>
                      <option value="">Não informada</option>
                      {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#888] mb-1">Observação (opcional)</label>
                  <input
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Ex: Entrada, Parcela 2 de 4, Pago em dinheiro"
                    className={field}
                  />
                </div>

                {formError && <p className="text-red-400 text-xs">{formError}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => setAdding(null)}
                    className="flex-1 py-2.5 rounded-lg border border-[#222] text-sm text-[#888] hover:text-white hover:border-[#333] transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={submitPayment}
                    disabled={saving}
                    className="flex-1 bg-[#f5c518] text-black font-bold py-2.5 rounded-lg hover:bg-[#e6b800] disabled:opacity-60"
                  >
                    {saving ? "Registrando..." : "Registrar"}
                  </button>
                </div>

                {(byProject[adding.id] ?? []).length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-[#888] mb-1">Pagamentos já registrados</div>
                    <div className="rounded-lg border border-[#222] bg-[#111] px-4 max-h-48 overflow-y-auto">
                      <HistoryList project={adding} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}