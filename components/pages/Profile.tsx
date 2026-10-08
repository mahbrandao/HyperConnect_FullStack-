"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

const input = "w-full bg-[#0c0c0c] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#f5c518]";
const btn = "rounded-lg bg-[#f5c518] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#e6b800] disabled:opacity-50";

type Msg = { ok: boolean; text: string } | null;

export default function Profile() {
  const { user, refresh } = useUser();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState("");
  const [msgData, setMsgData] = useState<Msg>(null);
  const [msgEmail, setMsgEmail] = useState<Msg>(null);
  const [msgPass, setMsgPass] = useState<Msg>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    supabase.from("profiles").select("phone, email").eq("id", user.id).single().then(({ data }) => {
      setPhone(data?.phone ?? "");
      setEmail(data?.email ?? "");
    });
    supabase.auth.getUser().then(({ data }) => { if (data.user?.email) setEmail(data.user.email); });
  }, [user]);

  async function saveData() {
    if (!user) return;
    if (!name.trim()) return setMsgData({ ok: false, text: "Informe o nome." });
    setBusy("data");
    const { error } = await supabase.from("profiles").update({ name: name.trim(), phone: phone.trim() || null }).eq("id", user.id);
    setBusy("");
    if (error) return setMsgData({ ok: false, text: error.message });
    await refresh();
    setMsgData({ ok: true, text: "Dados salvos." });
  }

  async function saveEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!e.includes("@")) return setMsgEmail({ ok: false, text: "E-mail inválido." });
    setBusy("email");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/profile/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ email: e }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setMsgEmail({ ok: false, text: json.error || "Não foi possível alterar o e-mail." });
    await supabase.auth.refreshSession();
    setEmail(e);
    setNewEmail("");
    setMsgEmail({ ok: true, text: "E-mail alterado. Use o novo e-mail no próximo login." });
  }

  async function savePass() {
    if (pass.length < 6) return setMsgPass({ ok: false, text: "A senha precisa ter pelo menos 6 caracteres." });
    if (pass !== pass2) return setMsgPass({ ok: false, text: "As senhas não são iguais." });
    setBusy("pass");
    const { error } = await supabase.auth.updateUser({ password: pass });
    setBusy("");
    if (error) return setMsgPass({ ok: false, text: error.message });
    setPass(""); setPass2("");
    setMsgPass({ ok: true, text: "Senha alterada." });
  }

  const Note = ({ m }: { m: Msg }) => m ? <p className={`text-xs mt-3 ${m.ok ? "text-green-400" : "text-red-400"}`}>{m.text}</p> : null;
  const card = "rounded-2xl border border-[#222] bg-[#111] p-6";

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-white">Meu perfil</h1>

      <section className={card}>
        <h2 className="text-sm font-semibold text-white mb-4">Dados pessoais</h2>
        <div className="flex flex-col gap-3">
          <div><label className="text-xs text-[#888]">Nome</label><input className={input} value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label className="text-xs text-[#888]">Telefone</label><input className={input} value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><button className={btn} disabled={busy === "data"} onClick={saveData}>Salvar</button></div>
        </div>
        <Note m={msgData} />
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-white mb-1">E-mail de acesso</h2>
        <p className="text-xs text-[#888] mb-4">Atual: <span className="text-white">{email || "—"}</span></p>
        <div className="flex flex-col gap-3">
          <input className={input} type="email" placeholder="Novo e-mail" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          <div><button className={btn} disabled={busy === "email"} onClick={saveEmail}>Alterar e-mail</button></div>
        </div>
        <Note m={msgEmail} />
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-white mb-4">Alterar senha</h2>
        <div className="flex flex-col gap-3">
          <input className={input} type="password" placeholder="Nova senha" value={pass} onChange={e => setPass(e.target.value)} />
          <input className={input} type="password" placeholder="Repita a nova senha" value={pass2} onChange={e => setPass2(e.target.value)} />
          <div><button className={btn} disabled={busy === "pass"} onClick={savePass}>Alterar senha</button></div>
        </div>
        <Note m={msgPass} />
      </section>
    </div>
  );
}