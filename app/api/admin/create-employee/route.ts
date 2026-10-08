import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "crypto";

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let pass = "";
  for (let i = 0; i < 12; i++) pass += chars[randomInt(chars.length)];
  return pass;
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return NextResponse.json({ error: "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente)." }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: callerProfile } = await callerClient
    .from("profiles")
    .select("team")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["gerente", "admin"].includes(callerProfile.team)) {
    return NextResponse.json({ error: "Apenas gerente ou admin podem criar acessos." }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, team, phone } = body as { name: string; email: string; team: string; phone?: string };

  if (!name || !email || !team) {
    return NextResponse.json({ error: "Nome, e-mail e departamento são obrigatórios." }, { status: 400 });
  }
  if (!["gerente", "admin", "vendas", "instalacao"].includes(team)) {
    return NextResponse.json({ error: "Departamento inválido." }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password = generatePassword();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone },
    app_metadata: { team }, // só o servidor consegue gravar isso; o usuário não pode forjar
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  return NextResponse.json({ userId: created.user?.id, password });
}