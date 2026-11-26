import { supabase } from "@/lib/supabase";

export type InstallerOption = { id: string; name: string };

// Lista quem pode ser colocado na equipe de instalação.
// Base: contas de login (profiles) com acesso "instalacao" — só elas podem
// entrar em project_installers. Mas o login não é atualizado quando o RH muda
// o cadastro, então cruzamos com a tabela employees (pelo e-mail): só entra
// quem está cadastrado em Funcionários, no departamento "Instalações" e não
// "Inativo". Quem foi excluído de Funcionários também sai da lista.
// "Instalações", "instalacoes", "Instalação "... tudo vira "instalacoes"/"instalacao"
function normalize(s: unknown) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export async function fetchInstallers(): Promise<InstallerOption[]> {
  const [{ data: profiles }, { data: employees }] = await Promise.all([
    supabase.from("profiles").select("id, name, email").eq("team", "instalacao").order("name"),
    supabase.from("employees").select("email, status, department"),
  ]);

  const rh = new Map((employees ?? []).map((e) => [String(e.email ?? "").trim().toLowerCase(), e]));

  return (profiles ?? [])
    .filter((p) => {
      const emp = rh.get(String(p.email ?? "").trim().toLowerCase());
      return !!emp && normalize(emp.status) !== "inativo" && normalize(emp.department).startsWith("instala");
    })
    .map((p) => ({ id: p.id, name: p.name }));
}
