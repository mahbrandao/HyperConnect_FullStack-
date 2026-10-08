import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TEAMS = ["gerente", "admin", "vendas", "instalacao"];

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !anon || !service) {
    return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
  }

  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: userErr } = await caller.auth.getUser(token);
  if (userErr || !user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const { data: me } = await caller.from("profiles").select("team").eq("id", user.id).single();
  if (!me || !["gerente", "admin"].includes(me.team)) {
    return NextResponse.json({ error: "Apenas gerente ou admin podem editar acessos." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const team = body.team ? String(body.team) : null;

  if (!userId || !name) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  if (team && !TEAMS.includes(team)) return NextResponse.json({ error: "Departamento inválido." }, { status: 400 });

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: target } = await admin.from("profiles").select("team").eq("id", userId).single();
  if (!target) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  const teamChanged = !!team && team !== target.team;
  if (teamChanged && me.team !== "gerente") {
    return NextResponse.json({ error: "Só o gerente pode mudar o departamento de acesso." }, { status: 403 });
  }

  const authUpdate: Record<string, unknown> = { email, email_confirm: true, user_metadata: { name, phone } };
  if (teamChanged) authUpdate.app_metadata = { team };
  const { error } = await admin.auth.admin.updateUserById(userId, authUpdate);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const profileUpdate: Record<string, unknown> = { name, phone: phone || null, email };
  if (teamChanged) { profileUpdate.team = team; profileUpdate.team_label = null; }
  await admin.from("profiles").update(profileUpdate).eq("id", userId);

  return NextResponse.json({ ok: true });
}