import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Shield, Zap, TrendingUp, Users, Star, CheckCircle2, ArrowRight } from "lucide-react";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [showLogin, setShowLogin] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  // Redirecionar se já autenticado
  if (!loading && isAuthenticated) {
    setLocation("/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister
        ? { name: form.name, email: form.email, password: form.password }
        : { email: form.email, password: form.password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao autenticar");
        return;
      }

      toast.success(isRegister ? "Conta criada com sucesso!" : "Bem-vindo de volta!");
      window.location.href = "/dashboard";
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight">COBRAPRO</span>
          </div>
          <Button
            onClick={() => setShowLogin(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-lg text-sm uppercase tracking-wide"
          >
            Acessar Sistema
          </Button>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 border border-green-500/40 bg-green-500/10 text-green-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Sistema Ativo — Acesso Imediato
          </div>

          <h1 className="text-4xl md:text-6xl font-black uppercase leading-tight mb-6">
            ENQUANTO VOCÊ USA{" "}
            <span className="text-white/40">CADERNINHO</span>,{" "}
            <br className="hidden md:block" />
            SEU CONCORRENTE USA{" "}
            <span className="text-red-500">COBRAPRO</span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
            Tudo que um cobrador profissional precisa — num só lugar.
            Controle empréstimos, parcelas, cobranças e caixa em tempo real.
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-10 text-sm text-white/50">
            {["✓ Acesso Imediato", "✓ Dados 100% Seguros", "✓ Suporte Incluso", "✓ Mobile Friendly"].map((b) => (
              <span key={b} className="text-green-400 font-medium">{b}</span>
            ))}
          </div>

          <Button
            onClick={() => setShowLogin(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-black text-lg uppercase tracking-wide px-10 py-6 rounded-xl shadow-2xl shadow-red-900/40 transition-all hover:scale-105"
          >
            🔥 QUERO ACESSAR O SISTEMA
          </Button>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "50+", label: "Operadores Ativos" },
            { value: "1X", label: "Pagamento Único" },
            { value: "4.9/5", label: "Avaliação" },
            { value: "98.9%", label: "Satisfação" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl md:text-4xl font-black text-red-500 mb-1">{stat.value}</div>
              <div className="text-xs uppercase tracking-widest text-white/40">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-red-500 text-xs font-bold uppercase tracking-widest mb-3">Arsenal Completo</p>
            <h2 className="text-3xl md:text-5xl font-black uppercase leading-tight">
              TUDO QUE VOCÊ PRECISA{" "}
              <span className="text-red-500">NUM SÓ LUGAR</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: <TrendingUp className="w-6 h-6" />,
                title: "Painel de Controle",
                desc: "Visão completa em tempo real: saldo, capital em circulação, inadimplência e vencimentos do dia.",
                color: "red",
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: "Juros Automáticos",
                desc: "Simples ou composto. Cálculo automático de multas e juros por atraso, sem precisar calcular na mão.",
                color: "green",
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Gestão de Clientes",
                desc: "Cadastro completo com CPF, PIX, score de crédito interno e histórico unificado de contratos.",
                color: "red",
              },
              {
                icon: <Shield className="w-6 h-6" />,
                title: "Múltiplas Modalidades",
                desc: "Empréstimos padrão, diários, Tabela Price, venda de produtos e desconto de cheques.",
                color: "green",
              },
              {
                icon: <Star className="w-6 h-6" />,
                title: "Cobrança via WhatsApp",
                desc: "Envie cobranças com templates dinâmicos: nome, valor, data e chave PIX automáticos.",
                color: "red",
              },
              {
                icon: <CheckCircle2 className="w-6 h-6" />,
                title: "Relatórios Completos",
                desc: "Fluxo de caixa, inadimplência, performance por koletor e fechamento diário em PDF.",
                color: "green",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                    f.color === "red" ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                  }`}
                >
                  {f.icon}
                </div>
                <h3 className="font-bold text-white mb-2 uppercase tracking-wide text-sm">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IPHONE FEATURE ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-green-900/20 to-green-900/5 border border-green-500/20 rounded-3xl p-8 md:p-12 text-center">
            <div className="inline-flex items-center gap-2 border border-green-500/40 bg-green-500/10 text-green-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              <span className="text-xs">NEW</span>
              Nova Funcionalidade — Exclusiva
            </div>
            <h2 className="text-3xl md:text-5xl font-black uppercase leading-tight mb-4">
              VENDE IPHONE PARCELADO?{" "}
              <span className="text-green-400">AGORA VOCÊ CONTROLA TUDO.</span>
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-2xl mx-auto">
              Chega de anotar no papel, de esquecer parcela, de confiar na palavra do comprador.
              Com o CobraPro, o sistema lembra por você — e cobra por você.
            </p>
            <Button
              onClick={() => setShowLogin(true)}
              className="bg-green-500 hover:bg-green-400 text-black font-black text-base uppercase tracking-wide px-8 py-5 rounded-xl"
            >
              ⚡ QUERO CONTROLAR MINHAS VENDAS
            </Button>
            <p className="text-white/30 text-xs mt-3">Incluso no plano — sem custo extra</p>
          </div>
        </div>
      </section>

      {/* ── GARANTIA ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-black uppercase leading-tight mb-4">
              7 DIAS PARA PROVAR{" "}
              <span className="text-white/40">QUE VAI MUDAR SEU JOGO</span>
            </h2>
            <p className="text-white/60 text-base mb-8 leading-relaxed">
              Entra, usa, testa tudo. Se em 7 dias você não sentir que o CobraPro já pagou o
              investimento, <strong className="text-white">devolvemos 100% do seu dinheiro</strong>.
              Sem pergunta, sem enrolação, sem choro.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              {["✅ Reembolso na hora", "✅ Sem burocracia", "✅ Sem questionamento"].map((g) => (
                <span key={g} className="text-white/70 font-medium">{g}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-black uppercase leading-tight mb-6">
            CHEGA DE DESCULPA.{" "}
            <span className="text-red-500">SEU DINHEIRO NÃO PODE ESPERAR.</span>
          </h2>
          <p className="text-white/50 text-lg mb-4">
            Cada dia sem o CobraPro é mais um vencimento que passa, mais um juros que você deixa na mesa.
          </p>
          <p className="text-white/30 text-sm mb-10">
            Mais de 1.350 cobradores já pararam de perder dinheiro. Você vai ser o próximo?
          </p>
          <Button
            onClick={() => setShowLogin(true)}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-xl uppercase tracking-wide px-12 py-7 rounded-2xl shadow-2xl shadow-red-900/50 transition-all hover:scale-105 w-full md:w-auto"
          >
            🔥 SIM, QUERO PARAR DE PERDER DINHEIRO
          </Button>
          <p className="text-white/20 text-xs mt-4">
            Acesso imediato • Dados seguros • Suporte incluso
          </p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-4 text-center text-white/20 text-sm">
        <span className="text-red-500/60">cobrapro.online</span> — © 2026 CobraPro. Todos os direitos reservados.
      </footer>

      {/* ── MODAL DE LOGIN ─────────────────────────────────────────────────── */}
      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
        >
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-black tracking-tight">COBRAPRO</span>
            </div>

            <h2 className="text-2xl font-black uppercase mb-1">
              {isRegister ? "Criar Conta" : "Acessar Sistema"}
            </h2>
            <p className="text-white/40 text-sm mb-6">
              {isRegister
                ? "Crie sua conta para começar a usar o CobraPro"
                : "Entre com seu email e senha para acessar"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <Label className="text-white/60 text-xs uppercase tracking-wide mb-1 block">Nome</Label>
                  <Input
                    type="text"
                    placeholder="Seu nome completo"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-red-500/50"
                  />
                </div>
              )}

              <div>
                <Label className="text-white/60 text-xs uppercase tracking-wide mb-1 block">Email</Label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-red-500/50"
                />
              </div>

              <div>
                <Label className="text-white/60 text-xs uppercase tracking-wide mb-1 block">Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={isRegister ? "Mínimo 6 caracteres" : "Sua senha"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-red-500/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wide py-5 rounded-xl text-base mt-2"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Aguarde...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">
                    {isRegister ? "Criar Conta" : "Entrar no Sistema"}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setIsRegister((v) => !v)}
                className="text-white/30 hover:text-white/60 text-sm transition-colors"
              >
                {isRegister
                  ? "Já tem conta? Fazer login"
                  : "Não tem conta? Criar agora"}
              </button>
            </div>

            <button
              onClick={() => setShowLogin(false)}
              className="absolute top-4 right-4 text-white/20 hover:text-white/60 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
