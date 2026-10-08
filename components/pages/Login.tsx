"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Shield, Zap, Wrench } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) { setError("E-mail ou senha inválidos."); return; }
    router.push("/app");
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="w-80 flex-shrink-0 bg-[#0a0a0a] relative flex flex-col justify-between p-8 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&h=900&fit=crop&auto=format')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
        <div className="relative z-10">
          <Logo />
        </div>
        <div className="relative z-10 space-y-4">
          <p className="text-white/80 text-sm leading-relaxed">
            Energia solar e automação<br />para um futuro inteligente.
          </p>
          <div className="space-y-3">
            {[
              { icon: Shield, text: "Soluções completas em energia solar" },
              { icon: Zap,    text: "Automação de processos industriais" },
              { icon: Wrench, text: "Instalação e manutenção especializada" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-white/70 text-sm">
                <div className="w-7 h-7 rounded-lg bg-[#f5c518]/15 border border-[#f5c518]/20 flex items-center justify-center flex-shrink-0">
                  <Icon size={13} className="text-[#f5c518]" />
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-white flex items-center justify-center p-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-black mb-1">Bem-vindo de volta!</h1>
          <p className="text-[#666] text-sm mb-8">Faça login para acessar sua conta</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1.5">E-mail corporativo</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@gmail.com"
                className="w-full border border-[#ddd] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#f5c518] transition-colors text-black placeholder:text-[#bbb]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-[#ddd] rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:border-[#f5c518] transition-colors text-black"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="text-right mt-1.5">
                <Link href="/recover" className="text-xs text-[#f5c518] hover:underline font-medium">
                  Esqueceu sua senha?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#f5c518] text-black font-bold py-3 rounded-lg hover:bg-[#e6b800] transition-colors text-sm mt-2 disabled:opacity-60"
            >
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-4">{error}</p>
          )}

          <p className="text-center text-sm text-[#888] mt-6">
            Ainda não tem uma conta?{" "}
            <Link href="/register" className="text-[#f5c518] font-semibold hover:underline">
              Criar cadastro
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
