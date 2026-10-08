"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ElementType, ReactNode } from "react";
import { useEffect } from "react";
import Logo from "@/components/ui/Logo";
import NotificationBell from "@/components/ui/NotificationBell";
import { useUser } from "@/hooks/useUser";
import type { Team } from "@/interfaces/user";
import { LayoutDashboard, FolderKanban, CalendarDays, FileText, Users, LogOut, CreditCard, Clock3 } from "lucide-react";

type NavItem = { href: string; label: string; icon: ElementType; exact?: boolean };

const navByTeam: Record<Team, NavItem[]> = {
  gerente: [
    { href: "/app", label: "Visão Geral", icon: LayoutDashboard, exact: true },
    { href: "/app/projects", label: "Projetos", icon: FolderKanban },
    { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/app/documents", label: "Documentos", icon: FileText },
    { href: "/app/employees", label: "Funcionários", icon: Users },
    { href: "/app/approvals", label: "Aprovações", icon: Clock3 },
  ],
  admin: [
    { href: "/app", label: "Visão Geral", icon: LayoutDashboard, exact: true },
    { href: "/app/documents", label: "Documentos", icon: FileText },
    { href: "/app/projects", label: "Projetos", icon: FolderKanban },
    { href: "/app/payments", label: "Pagamentos", icon: CreditCard },
    { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
  ],
  vendas: [
    { href: "/app", label: "Visão Geral", icon: LayoutDashboard, exact: true },
    { href: "/app/projects", label: "Projetos", icon: FolderKanban },
    { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/app/payments", label: "Pagamentos", icon: CreditCard },
  ],
  instalacao: [
    { href: "/app", label: "Visão Geral", icon: LayoutDashboard, exact: true },
    { href: "/app/projects", label: "Projetos", icon: FolderKanban },
    { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
  ],
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0c0c0c] text-[#888] text-sm">
        Carregando...
      </div>
    );
  }

  if (!user.team) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-[#222] bg-[#111] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5c518]/10 text-[#f5c518] border border-[#f5c518]/20">
            <Clock3 size={30} />
          </div>
          <h1 className="text-2xl font-bold text-white">Aguardando aprovação</h1>
          <p className="mt-3 text-sm leading-6 text-[#888]">
            Sua conta foi criada com sucesso. Assim que um gerente definir seu departamento, você terá acesso ao sistema.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-lg bg-[#f5c518] px-4 py-3 text-sm font-bold text-black hover:bg-[#e6b800] transition-colors"
            >
              Verificar novamente
            </button>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.push("/");
              }}
              className="w-full rounded-lg border border-[#222] px-4 py-3 text-sm font-medium text-[#ddd] hover:bg-[#1a1a1a] transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems = navByTeam[user.team];

  return <div className="flex h-screen w-full overflow-hidden bg-[#0c0c0c]">
    <aside className="w-52 flex-shrink-0 bg-[#111] border-r border-[#222] flex flex-col">
      <div className="p-5 border-b border-[#222]"><Logo size="sm" /></div>
      <div className="px-4 py-2.5 border-b border-[#1a1a1a]"><span className="text-[10px] font-semibold text-[#f5c518] uppercase tracking-widest">{user.teamLabel}</span></div>
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-[#f5c518] text-black" : "text-[#888] hover:text-white hover:bg-[#1a1a1a]"}`}><Icon size={16} />{label}</Link>;
        })}
      </nav>
      <div className="p-3 border-t border-[#222]"><button onClick={() => { signOut(); router.push("/"); }} className="w-full flex items-center gap-2 px-3 py-2 text-[#555] hover:text-white text-sm transition-colors rounded-lg hover:bg-[#1a1a1a]"><LogOut size={15} />Sair</button></div>
    </aside>
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-14 border-b border-[#222] flex items-center justify-end px-6 gap-4 bg-[#0c0c0c]">
        <NotificationBell />
       <Link href="/app/profile" title="Editar perfil" className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] transition-colors">
          <div className="w-6 h-6 rounded-full bg-[#f5c518] flex items-center justify-center text-black text-xs font-bold">{user.avatar}</div>
          <div className="text-left"><div className="text-xs font-semibold text-white leading-none">{user.name}</div><div className="text-[10px] text-[#888] leading-none mt-0.5">{user.teamLabel}</div></div>
        </Link>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  </div>;
}