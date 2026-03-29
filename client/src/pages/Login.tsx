import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, Infinity, Clock, Zap, BarChart3 } from "lucide-react";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [loading, isAuthenticated, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Email ou senha incorretos");
        return;
      }

      toast.success("Bem-vindo de volta!");
      window.location.href = "/dashboard";
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0A0A0A]">

      {/* ── LADO ESQUERDO ─────────────────────────────────────────────────── */}
      <div
        className="hidden md:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{
          background: "radial-gradient(ellipse at 20% 50%, #0d2b1a 0%, #050f0a 60%, #000 100%)",
        }}
      >
        {/* Logo */}
        <div>
          <a href="/" className="inline-block">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663380431118/BkqW4WQ4ndZHJQHLtTMfxv/cobrapro-logo_ca1f0d34.webp"
              alt="CobraPro"
              className="h-10 w-auto object-contain"
            />
          </a>
        </div>

        {/* Conteúdo central */}
        <div>
          <h1 className="text-4xl font-black text-white leading-tight mb-3">
            Gestão de cobranças<br />
            <span className="text-green-400">simplificada</span>
          </h1>
          <p className="text-white/50 text-base mb-10">
            Controle assinaturas, empréstimos, aluguéis e muito mais em uma única plataforma profissional.
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <Infinity className="w-5 h-5 text-green-400" />, value: "∞", label: "Clientes ativos" },
              { icon: <BarChart3 className="w-5 h-5 text-green-400" />, value: "12+", label: "Módulos disponíveis" },
              { icon: <Clock className="w-5 h-5 text-green-400" />, title: "Tempo real", label: "Relatórios" },
              { icon: <Zap className="w-5 h-5 text-green-400" />, title: "Automático", label: "Cron jobs" },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 hover:border-green-500/20 transition-colors"
              >
                {item.value ? (
                  <>
                    <div className="text-green-400 font-black text-xl mb-0.5">{item.value}</div>
                    <div className="text-white/40 text-xs">{item.label}</div>
                  </>
                ) : (
                  <>
                    <div className="text-green-400 font-black text-base mb-0.5">{item.title}</div>
                    <div className="text-white/40 text-xs">{item.label}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-white/20 text-xs">
          © 2026 CobraPro — cobrapro.online. Todos os direitos reservados.
        </div>

        {/* Decoração de fundo */}
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-10 w-40 h-40 bg-green-500/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* ── LADO DIREITO ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0f0f0f]">
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="md:hidden mb-8 text-center">
            <a href="/">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663380431118/BkqW4WQ4ndZHJQHLtTMfxv/cobrapro-logo_ca1f0d34.webp"
                alt="CobraPro"
                className="h-10 w-auto object-contain mx-auto"
              />
            </a>
          </div>

          <div className="bg-[#161616] border border-white/8 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-1">Entrar na plataforma</h2>
            <p className="text-white/40 text-sm mb-7">
              Use as credenciais enviadas para o seu e-mail após a compra
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <Label className="text-white/60 text-sm mb-1.5 block">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-green-500/50 pl-10 h-12"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-white/60 text-sm">Senha</Label>
                  <a
                    href="/recuperar-senha"
                    className="text-green-400 text-xs hover:text-green-300 transition-colors"
                  >
                    Esqueceu a senha?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-green-500/50 pl-10 pr-10 h-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Botão */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-bold text-base h-12 rounded-xl mt-2 transition-all hover:scale-[1.01]"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            {/* Info box */}
            <div className="mt-5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
              <p className="text-white/30 text-xs leading-relaxed">
                Suas credenciais foram enviadas por e-mail após a confirmação da compra.
                Verifique também a caixa de spam.
              </p>
            </div>

            {/* Voltar */}
            <div className="mt-5 text-center">
              <a href="/" className="text-white/20 hover:text-white/50 text-sm transition-colors">
                ← Voltar para a página inicial
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
