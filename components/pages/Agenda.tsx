"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Clock, Calendar, Trash2, Ban } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import { useProjects } from "@/hooks/useProjects";
import InstallerPicker from "@/components/ui/InstallerPicker";

type ViewMode = "Mês" | "Semana" | "Lista";

type AppEvent = {
  id: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:MM
  title: string;
  sub: string;
  type: string;
  color: string;
  status: string;
  projectId: string | null;
  projectTitle: string | null;
  createdBy: string | null;
  installerIds: string[];
};

type EventRow = {
  id: string;
  title: string;
  subtitle: string | null;
  event_type: string;
  event_date: string;
  event_time: string;
  color: string | null;
  status: string;
  project_id: string | null;
  created_by: string | null;
  installer_ids: string[] | null;
  project: { title: string } | null;
};

const COLOR_MAP: Record<string, { cell: string; dot: string; badge: string }> = {
  yellow: { cell: "bg-[#f5c518]/20 border-l-2 border-[#f5c518] text-[#f5c518]", dot: "bg-[#f5c518]", badge: "bg-[#f5c518]/15 text-[#f5c518]" },
  blue: { cell: "bg-blue-500/20 border-l-2 border-blue-400 text-blue-300", dot: "bg-blue-400", badge: "bg-blue-500/15 text-blue-400" },
  purple: { cell: "bg-purple-500/20 border-l-2 border-purple-400 text-purple-300", dot: "bg-purple-400", badge: "bg-purple-500/15 text-purple-400" },
  green: { cell: "bg-green-500/20 border-l-2 border-green-400 text-green-300", dot: "bg-green-400", badge: "bg-green-500/15 text-green-400" },
  orange: { cell: "bg-orange-500/20 border-l-2 border-orange-400 text-orange-300", dot: "bg-orange-400", badge: "bg-orange-500/15 text-orange-400" },
};

const eventTypes = ["Visita técnica", "Reunião", "Instalação", "Manutenção", "Outros"];
const typeColorMap: Record<string, string> = {
  "Visita técnica": "blue",
  "Reunião": "purple",
  "Instalação": "yellow",
  "Manutenção": "green",
  "Outros": "orange",
};

const DAYS_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const HOURS = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function monthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function weekDates(anchor: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - anchor.getDay() + i);
    return d;
  });
}

function mapRow(r: EventRow): AppEvent {
  return {
    id: r.id,
    date: r.event_date,
    time: r.event_time.slice(0, 5),
    title: r.title,
    sub: r.subtitle ?? "",
    type: r.event_type,
    color: r.color ?? typeColorMap[r.event_type] ?? "orange",
    status: r.status,
    projectId: r.project_id,
    projectTitle: r.project?.title ?? null,
    createdBy: r.created_by,
    installerIds: r.installer_ids ?? [],
  };
}

const emptyForm = { title: "", type: eventTypes[0], date: "", time: "", sub: "", projectId: "", instaladorIds: [] as string[] };

export default function Agenda() {
  const { user } = useUser();
  const { projects } = useProjects();
  const [view, setView] = useState<ViewMode>("Semana");
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<AppEvent | null>(null);
  const [instaladores, setInstaladores] = useState<{ id: string; name: string }[]>([]);

  const todayIso = isoOf(new Date());

  async function loadEvents() {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("events")
      .select("id, title, subtitle, event_type, event_date, event_time, color, status, project_id, created_by, installer_ids, project:projects!events_project_id_fkey(title)");
    if (user.team !== "gerente" && user.team !== "admin") {
      query = query.or(`created_by.eq.${user.id},installer_ids.cs.{${user.id}}`);
    }
    const { data, error } = await query.order("event_date", { ascending: true });
    if (error) setLoadError(error.message);
    else { setLoadError(null); setEvents((data as unknown as EventRow[]).map(mapRow)); }
    setLoading(false);
  }

  useEffect(() => { loadEvents(); }, [user?.id]);

  useEffect(() => {
    supabase.from("profiles").select("id, name").eq("team", "instalacao").then(({ data }) => {
      if (data) setInstaladores(data.map((p) => ({ id: p.id, name: p.name })));
    });
  }, []);

  if (!user) return null;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const wDates = weekDates(cursor);

  function prevMonth() { setCursor(new Date(year, month - 1, 1)); }
  function nextMonth() { setCursor(new Date(year, month + 1, 1)); }
  function shiftWeek(days: number) { const d = new Date(cursor); d.setDate(d.getDate() + days); setCursor(d); }

  function eventsOnDate(iso: string) {
    return events.filter((e) => e.date === iso).sort((a, b) => a.time.localeCompare(b.time));
  }

  function installerNames(ids: string[]) {
    return ids.map((id) => instaladores.find((i) => i.id === id)?.name).filter(Boolean).join(", ");
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Informe o título.";
    if (!form.date) e.date = "Selecione uma data.";
    if (!form.time) e.time = "Selecione o horário.";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    const { error } = await supabase.from("events").insert({
      title: form.title.trim(),
      subtitle: form.sub.trim() || null,
      event_type: form.type,
      event_date: form.date,
      event_time: form.time,
      color: typeColorMap[form.type] || "orange",
      project_id: form.projectId || null,
      created_by: user.id,
      installer_ids: form.instaladorIds,
    });
    setSaving(false);
    if (error) { setErrors({ title: `Erro ao salvar: ${error.message}` }); return; }
    setOpen(false);
    setForm(emptyForm);
    setErrors({});
    await loadEvents();
  }

  async function cancelEvent(ev: AppEvent) {
    if (!confirm(`Cancelar "${ev.title}"?`)) return;
    const { error } = await supabase.from("events").update({ status: "cancelado" }).eq("id", ev.id);
    if (error) { alert(`Erro ao cancelar: ${error.message}`); return; }
    setSelected(null);
    await loadEvents();
  }

  async function deleteEvent(ev: AppEvent) {
    if (!confirm(`Excluir "${ev.title}"? Essa ação não pode ser desfeita.`)) return;
    const { data, error } = await supabase.from("events").delete().eq("id", ev.id).select("id");
    if (error) { alert(`Erro ao excluir: ${error.message}`); return; }
    if (!data || data.length === 0) { alert("Sem permissão para excluir este compromisso."); return; }
    setSelected(null);
    await loadEvents();
  }

  const canEdit = (ev: AppEvent) =>
    user.team === "gerente" || user.team === "admin" || ev.createdBy === user.id || ev.installerIds.includes(user.id);

  const inputCls = "w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#444] outline-none focus:border-[#f5c518]/50 transition-colors";
  const sortedEvents = [...events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const evStyle = (ev: AppEvent) => (ev.status === "cancelado" ? "opacity-40 line-through" : "");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Agenda</h1>
          <p className="text-[#888] text-sm">Confira os compromissos e atividades programadas.</p>
        </div>
        <button
          onClick={() => { setOpen(true); setErrors({}); setForm(emptyForm); }}
          className="bg-[#f5c518] text-black font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[#e6b800] transition-colors"
        >
          <Plus size={16} />
          Novo compromisso
        </button>
      </div>

      {loadError && <div className="mb-4 text-center text-red-400 text-sm">Erro ao carregar agenda: {loadError}</div>}

      <div className="bg-[#151515] border border-[#222] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <button
              onClick={view === "Semana" ? () => shiftWeek(-7) : prevMonth}
              className="p-1.5 rounded-lg hover:bg-[#222] text-[#888] hover:text-white transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-semibold text-white">
              {view === "Semana"
                ? `${wDates[0].getDate()} ${MONTH_NAMES[wDates[0].getMonth()].slice(0, 3)} – ${wDates[6].getDate()} ${MONTH_NAMES[wDates[6].getMonth()].slice(0, 3)} ${wDates[6].getFullYear()}`
                : `${MONTH_NAMES[month]} ${year}`}
            </span>
            <button
              onClick={view === "Semana" ? () => shiftWeek(7) : nextMonth}
              className="p-1.5 rounded-lg hover:bg-[#222] text-[#888] hover:text-white transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCursor(new Date())}
              className="text-xs px-2.5 py-1 rounded-md border border-[#2a2a2a] text-[#888] hover:text-white transition-colors"
            >
              Hoje
            </button>
          </div>

          <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1">
            {(["Mês", "Semana", "Lista"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === v ? "bg-[#f5c518] text-black" : "text-[#888] hover:text-white"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="py-16 text-center text-[#555] text-sm">Carregando...</div>}

        {/* MÊS */}
        {!loading && view === "Mês" && (() => {
          const cells = monthGrid(year, month);
          return (
            <div>
              <div className="grid grid-cols-7 border-b border-[#222]">
                {DAYS_SHORT.map((d) => <div key={d} className="py-2 text-center text-xs font-medium text-[#555]">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                  const iso = day ? isoDate(year, month, day) : "";
                  const dayEvents = day ? eventsOnDate(iso) : [];
                  const isToday = iso === todayIso;
                  return (
                    <div
                      key={i}
                      className={`min-h-[90px] p-2 border-b border-r border-[#1e1e1e] ${i % 7 === 6 ? "border-r-0" : ""} ${!day ? "bg-[#111]" : "hover:bg-[#1a1a1a] transition-colors"}`}
                    >
                      {day && (
                        <>
                          <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold mb-1 ${isToday ? "bg-[#f5c518] text-black" : "text-[#888]"}`}>
                            {day}
                          </span>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 2).map((ev) => (
                              <button
                                key={ev.id}
                                onClick={() => setSelected(ev)}
                                className={`block w-full text-left text-[10px] px-1.5 py-0.5 rounded font-medium truncate ${COLOR_MAP[ev.color]?.cell || COLOR_MAP.orange.cell} ${evStyle(ev)}`}
                              >
                                {ev.time} {ev.title}
                              </button>
                            ))}
                            {dayEvents.length > 2 && <div className="text-[10px] text-[#555] px-1">+{dayEvents.length - 2} mais</div>}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* SEMANA */}
        {!loading && view === "Semana" && (
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            <div className="border-b border-[#222] py-3" />
            {wDates.map((d, i) => {
              const isToday = isoOf(d) === todayIso;
              return (
                <div key={i} className={`border-b border-[#222] border-l py-3 text-center ${isToday ? "bg-[#f5c518]/5" : ""}`}>
                  <div className="text-xs text-[#888] font-medium">{DAYS_SHORT[d.getDay()]}</div>
                  <div className={`text-lg font-bold mt-0.5 ${isToday ? "text-[#f5c518]" : "text-white"}`}>{d.getDate()}</div>
                </div>
              );
            })}

            {HOURS.map((hour) => (
              <Fragment key={hour}>
                <div className="border-b border-[#1e1e1e] py-3 pr-3 text-right">
                  <span className="text-xs text-[#555]">{hour}</span>
                </div>
                {wDates.map((d, colIdx) => {
                  const iso = isoOf(d);
                  const hourEvents = eventsOnDate(iso).filter((e) => e.time.slice(0, 2) === hour.slice(0, 2));
                  return (
                    <div key={`cell-${hour}-${colIdx}`} className="border-b border-[#1e1e1e] border-l border-[#1e1e1e] min-h-[48px] p-1 space-y-1">
                      {hourEvents.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => setSelected(ev)}
                          className={`block w-full text-left rounded p-2 text-xs ${COLOR_MAP[ev.color]?.cell || COLOR_MAP.orange.cell} ${evStyle(ev)}`}
                        >
                          <div className="font-semibold">{ev.time} {ev.title}</div>
                          {ev.sub && <div className="opacity-70 text-[10px]">{ev.sub}</div>}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        )}

        {/* LISTA */}
        {!loading && view === "Lista" && (
          <div className="divide-y divide-[#1e1e1e]">
            {sortedEvents.length === 0 && <div className="py-16 text-center text-[#555] text-sm">Nenhum compromisso cadastrado.</div>}
            {sortedEvents.map((ev) => {
              const [yr, mo, dy] = ev.date.split("-").map(Number);
              const label = `${String(dy).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${yr}`;
              const cms = COLOR_MAP[ev.color] || COLOR_MAP.orange;
              return (
                <button key={ev.id} onClick={() => setSelected(ev)} className="w-full text-left flex items-center gap-5 px-5 py-4 hover:bg-[#1a1a1a] transition-colors">
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className="text-2xl font-bold text-white leading-none">{String(dy).padStart(2, "0")}</div>
                    <div className="text-[10px] text-[#888] uppercase mt-0.5">{MONTH_NAMES[mo - 1].slice(0, 3)}</div>
                  </div>
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${cms.dot}`} />
                  <div className={`flex-1 min-w-0 ${evStyle(ev)}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cms.badge}`}>{ev.type}</span>
                      {ev.status === "cancelado" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 no-underline">Cancelado</span>}
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{ev.title}</p>
                    {(ev.sub || ev.projectTitle) && (
                      <p className="text-xs text-[#888] truncate">{[ev.projectTitle, ev.sub].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-[#666] justify-end"><Clock size={11} />{ev.time}</div>
                    <div className="flex items-center gap-1.5 text-xs text-[#666] justify-end"><Calendar size={11} />{label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalhe do compromisso */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-[#111] border border-[#222] rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${(COLOR_MAP[selected.color] || COLOR_MAP.orange).badge}`}>{selected.type}</span>
                <h2 className="text-base font-bold text-white mt-2">{selected.title}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-[#1e1e1e] text-[#555] hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-2 text-sm text-[#bbb]">
              <div className="flex items-center gap-2"><Calendar size={14} className="text-[#555]" />{selected.date.split("-").reverse().join("/")}</div>
              <div className="flex items-center gap-2"><Clock size={14} className="text-[#555]" />{selected.time}</div>
              {selected.projectTitle && <div className="text-xs text-[#888]">Projeto: <span className="text-[#ccc]">{selected.projectTitle}</span></div>}
              {selected.sub && <div className="text-xs text-[#888]">Local/descrição: <span className="text-[#ccc]">{selected.sub}</span></div>}
              {selected.installerIds.length > 0 && (
                <div className="text-xs text-[#888]">Equipe de instalação: <span className="text-[#ccc]">{installerNames(selected.installerIds) || "—"}</span></div>
              )}
              {selected.status === "cancelado" && <div className="text-xs text-red-400">Este compromisso foi cancelado.</div>}
            </div>
            {canEdit(selected) && (
              <div className="flex gap-2 mt-5">
                {selected.status !== "cancelado" && (
                  <button onClick={() => cancelEvent(selected)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-medium hover:bg-orange-500/15">
                    <Ban size={13} /> Cancelar
                  </button>
                )}
                <button onClick={() => deleteEvent(selected)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/15">
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Novo compromisso */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-[#111] border border-[#222] rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e1e1e]">
              <div>
                <h2 className="text-base font-bold text-white">Novo compromisso</h2>
                <p className="text-xs text-[#555] mt-0.5">Adicione um evento à agenda.</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-[#1e1e1e] text-[#555] hover:text-white transition-colors"><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5">Título</label>
                <input className={inputCls} placeholder="Ex: Visita técnica" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Tipo</label>
                  <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {eventTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Projeto <span className="text-[#555]">(opcional)</span></label>
                  <select className={inputCls} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                    <option value="">Sem projeto</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Data</label>
                  <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  {errors.date && <p className="text-red-400 text-xs mt-1">{errors.date}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#888] mb-1.5">Horário</label>
                  <input type="time" className={inputCls} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  {errors.time && <p className="text-red-400 text-xs mt-1">{errors.time}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5">Local / Descrição <span className="text-[#555]">(opcional)</span></label>
                <input className={inputCls} placeholder="Ex: Endereço do cliente, Online…" value={form.sub} onChange={(e) => setForm({ ...form, sub: e.target.value })} />
              </div>

              {user.team !== "instalacao" && (
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
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-lg border border-[#222] text-sm text-[#888] hover:text-white hover:border-[#333] transition-colors font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-[#f5c518] text-black text-sm font-bold hover:bg-[#e6b800] transition-colors disabled:opacity-60">
                  {saving ? "Salvando..." : "Salvar compromisso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}