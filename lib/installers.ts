import { supabase } from "@/lib/supabase";

export type InstallerOption = { id: string; name: string };

// Lista quem pode ser colocado na equipe de instalação.
// Base: contas de login (profiles) com acesso "instalacao" — só elas podem
// entrar em project_installers. Mas o login não é atualizado quando o RH muda
// o cadastro, então cruzamos com a tabela employees (pelo e-mail) e tiramos
// quem está "Inativo" ou não está mais no departamento "Instalações".
export async function fetchInstallers(): Promise<InstallerOption[]> {
  const [{ data: profiles }, { data: employees }] = await Promise.all([
    supabase.from("profiles").select("id, name, email").eq("team", "instalacao").order("name"),
    supabase.from("employees").select("email, status, department"),
  ]);

  const rh = new Map((employees ?? []).map((e) => [String(e.email ?? "").trim().toLowerCase(), e]));

  return (profiles ?? [])
    .filter((p) => {
      const emp = rh.get(String(p.email ?? "").trim().toLowerCase());
      if (!emp) return true; // conta sem cadastro no RH: mantém
      return emp.status !== "Inativo" && emp.department === "Instalações";
    })
    .map((p) => ({ id: p.id, name: p.name }));
}
