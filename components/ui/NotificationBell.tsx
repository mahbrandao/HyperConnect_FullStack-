"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

type Item = {
  id: string;
  read: boolean;
  title: string;
  message: string | null;
  severity: "urgente" | "atencao" | "informativa" | "sucesso";
  link: string | null;
  created_at: string;
};

type Row = {
  read: boolean;
  notification: {
    id: string;
    title: string;
    message: string | null;
    severity: Item["severity"];
    link: string | null;
    created_at: string;
  } | null;
};

const dot: Record<Item["severity"], string> = {
  urgente: "bg-red-400",
  atencao: "bg-[#f5c518]",
  informativa: "bg-blue-400",
  sucesso: "bg-green-400",
};

// Os links gravados no banco não têm o prefixo /app e alguns apontam pra um id.
function routeFor(link: string | null) {
  if (!link) return null;
  if (link.startsWith("/payments")) return "/app/payments";
  if (link.startsWith("/app")) return link;
  return `/app${link}`;
}

export default function NotificationBell() {
  const { user } = useUser();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notification_recipients")
      .select("read, notification:notifications!notification_recipients_notification_id_fkey(id, title, message, severity, link, created_at)")
      .eq("profile_id", user.id)
      .limit(50);
    const rows = (data ?? []) as unknown as Row[];
    setItems(
      rows
        .filter((r) => r.notification)
        .map((r) => ({ ...r.notification!, read: r.read }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 20)
    );
  }, [user]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((i) => !i.read).length;

  async function markRead(ids: string[]) {
    if (!user || ids.length === 0) return;
    await supabase
      .from("notification_recipients")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("profile_id", user.id)
      .in("notification_id", ids);
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, read: true } : i)));
  }

  async function handleClick(item: Item) {
    await markRead([item.id]);
    const route = routeFor(item.link);
    setOpen(false);
    if (route) router.push(route);
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative text-[#888] hover:text-white transition-colors"
        title="Notificações"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-[#f5c518] text-black text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 bg-[#111] border border-[#222] rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e]">
              <span className="text-sm font-semibold text-white">Notificações</span>
              {unread > 0 && (
                <button
                  onClick={() => markRead(items.filter((i) => !i.read).map((i) => i.id))}
                  className="text-[11px] text-[#f5c518] hover:underline inline-flex items-center gap-1"
                >
                  <CheckCheck size={12} /> Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-[#1a1a1a]">
              {items.length === 0 && (
                <div className="px-4 py-10 text-center text-xs text-[#555]">Nenhuma notificação por enquanto.</div>
              )}
              {items.map((i) => (
                <button
                  key={i.id}
                  onClick={() => handleClick(i)}
                  className={`w-full text-left px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex gap-3 ${i.read ? "opacity-60" : ""}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dot[i.severity]}`} />
                  <span className="min-w-0">
                    <span className="block text-xs text-white leading-snug">{i.title}</span>
                    <span className="block text-[10px] text-[#555] mt-1">
                      {new Date(i.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
