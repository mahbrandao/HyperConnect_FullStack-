"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, HelpCircle } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { supabase } from "@/lib/supabase";

export default function RecoverPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
    });
    setStatus(error ? "error" : "sent");
  }
  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 bg-[#0a0a0a] relative flex flex-col justify-between p-8 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=600&h=900&fit=crop&auto=format')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />

        {/* Lock illustration */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 160 200" className="w-40 h-48 opacity-15">
            <circle cx="80" cy="100" r="55" fill="none" stroke="#f5c518" strokeWidth="2" />
            <rect x="55" y="95" width="50" height="45" rx="6" fill="none" stroke="#f5c518" strokeWidth="2" />
            <path d="M 65 95 Q 65 70 80 70 Q 95 70 95 95" fill="none" stroke="#f5c518" strokeWidth="2" />
            <circle cx="80" cy="115" r="5" fill="#f5c518" opacity="0.5" />
            <circle cx="40" cy="60" r="15" fill="none" stroke="#f5c518" strokeWidth="1.5" strokeDasharray="4" />
            <circle cx="120" cy="140" r="12" fill="none" stroke="#f5c518" strokeWidth="1.5" strokeDasharray="4" />
            <line x1="40" y1="60" x2="65" y2="85" stroke="#f5c518" strokeWidth="1" strokeDasharray="3" opacity="0.5" />
            <line x1="120" y1="140" x2="95" y2="125" stroke="#f5c518" strokeWidth="1" strokeDasharray="3" opacity="0.5" />
          </svg>
        </div>

        <div className="relative z-10">
          <Logo />
          <p className="text-[#888] text-xs mt-1">ENERGIA SOLAR E AUTOMAÇÃO</p>
        </div>

        <div className="relative z-10">
          <p className="text-white text-2xl font-bold leading-tight mb-2">
            Tecnologia que<br />move o <span className="text-[#f5c518]">futuro.</span>
          </p>
          <p className="text-[#888] text-sm leading-relaxed">
            Soluções completas em energia solar e automação para impulsionar o seu negócio.
          </p>
        </div>

        <div className="relative z-10 text-[#555] text-xs">
          © 2026 Hyper Connect. Todos os direitos reservados.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-white flex items-center justify-center p-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-black mb-1">Recuperar senha</h1>
          <p className="text-[#666] text-sm mb-8 leading-relaxed">
            Informe o e-mail da sua conta que enviaremos um link para redefinir sua senha.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1.5">E-mail corporativo</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@gmail.com"
                  className="w-full border border-[#ddd] rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:border-[#f5c518] transition-colors text-black placeholder:text-[#bbb]"
                />
                <Mail size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
              </div>
            </div>

            {status === "sent" && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                Se esse e-mail existir na nossa base, enviamos um link de recuperação.
              </p>
            )}
            {status === "error" && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                Não foi possível enviar o link agora. Tente novamente.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full bg-[#f5c518] text-black font-bold py-3 rounded-lg hover:bg-[#e6b800] transition-colors text-sm disabled:opacity-60"
            >
              {status === "sending" ? "Enviando..." : "Enviar link de recuperação"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#eee]" />
            <span className="text-xs text-[#bbb]">ou</span>
            <div className="flex-1 h-px bg-[#eee]" />
          </div>

          <Link
            href="/"
            className="w-full border border-[#ddd] rounded-lg py-3 text-sm font-medium text-black hover:bg-[#f9f9f9] transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight size={15} />
            Voltar para o login
          </Link>

        
        </div>
      </div>
    </div>
  );
}
