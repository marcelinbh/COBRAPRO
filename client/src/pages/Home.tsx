import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, Zap, TrendingUp, Users, Star, CheckCircle2, Plus, Minus, Smartphone, FileText, MessageCircle, BarChart3 } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// ── Dados dos planos ────────────────────────────────────────────────────────
const PLANOS = {
  mensal: {
    label: "Mensal",
    titulo: "MENSAL",
    preco: "R$ 65,00",
    periodo: "/mês",
    parcelas: null,
    link: "https://pay.kiwify.com.br/6CcDjtJ",
    botao: "⚡ ASSINAR MENSAL AGORA",
    badge: null,
    economia: null,
    features: [
      "Acesso por 30 dias",
      "Todas as funcionalidades",
      "📱 Venda de iPhone inclusa",
      "Alertas de vencimento",
      "Cobranças para clientes",
      "Suporte via WhatsApp",
      "Comprovantes em PDF",
      "Atualizações gratuitas",
    ],
  },
  trimestral: {
    label: "Trimestral",
    titulo: "TRIMESTRAL",
    preco: "R$ 185,00",
    periodo: "/trimestre",
    parcelas: "ou 3x de R$ 61,67",
    link: "https://pay.kiwify.com.br/Z4bG2vK",
    botao: "⚡ ASSINAR TRIMESTRAL AGORA",
    badge: null,
    economia: "Economia de R$ 10/trimestre",
    features: [
      "Acesso por 3 meses",
      "Todas as funcionalidades",
      "📱 Venda de iPhone inclusa",
      "Alertas de vencimento",
      "Cobranças para clientes",
      "Suporte prioritário",
      "Comprovantes em PDF",
      "Atualizações gratuitas",
    ],
  },
  anual: {
    label: "Anual",
    titulo: "ANUAL",
    preco: "R$ 517,00",
    periodo: "/ano",
    parcelas: "ou 12x de R$ 43,08",
    link: "https://pay.kiwify.com.br/muLvvtO",
    botao: "⚡ ASSINAR ANUAL AGORA",
    badge: "🔥 MAIS VENDIDO",
    economia: "Economia de R$ 263/ano",
    features: [
      "Acesso por 12 meses",
      "Todas as funcionalidades",
      "📱 Venda de iPhone inclusa",
      "Alertas de vencimento",
      "Cobranças para clientes",
      "Suporte prioritário",
      "Comprovantes em PDF",
      "Atualizações gratuitas",
      "Economia de R$ 263/ano",
    ],
  },
} as const;

type PlanoKey = keyof typeof PLANOS;

// ── FAQ ─────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "Como funciona o cálculo de juros?",
    a: "O CobraPro calcula juros simples, compostos ou diários automaticamente. Você define a taxa e o sistema aplica multa e juros por atraso sem precisar calcular na mão.",
  },
  {
    q: "Preciso instalar algum aplicativo?",
    a: "Não. O CobraPro é 100% online. Funciona em qualquer dispositivo com navegador — celular, tablet ou computador. Sem instalação, sem complicação.",
  },
  {
    q: "Meus dados ficam protegidos?",
    a: "Sim. Criptografia de ponta a ponta e servidores seguros. Seus dados de clientes e cobranças ficam protegidos 24h por dia.",
  },
  {
    q: "Posso usar em mais de um dispositivo?",
    a: "Sim. Você pode acessar de qualquer dispositivo com internet. Seus dados ficam sincronizados em tempo real.",
  },
  {
    q: "Consigo enviar cobrança direto para o cliente?",
    a: "Sim. O CobraPro gera mensagens de cobrança automáticas com nome, valor, data e chave PIX. Você envia direto pelo WhatsApp com um clique.",
  },
  {
    q: "Como recebo o acesso após a compra?",
    a: "Imediatamente após a confirmação do pagamento, você recebe um email com os dados de acesso. Em menos de 5 minutos você já está usando o sistema.",
  },
  {
    q: "Consigo parcelar qualquer modelo de iPhone?",
    a: "Sim. O módulo de venda de iPhone permite cadastrar qualquer modelo, definir entrada, parcelas, juros e gerar contrato automático.",
  },
  {
    q: "O contrato gerado pelo CobraPro é válido juridicamente?",
    a: "O contrato gerado serve como documento de controle interno. Para validade jurídica plena, recomendamos assinatura digital ou reconhecimento em cartório.",
  },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [planoAtivo, setPlanoAtivo] = useState<PlanoKey>("anual");
  const [faqAberto, setFaqAberto] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [loading, isAuthenticated, setLocation]);

  const goToLogin = () => setLocation("/login");

  const plano = PLANOS[planoAtivo];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663380431118/BkqW4WQ4ndZHJQHLtTMfxv/cobrapro-logo_ca1f0d34.webp"
            alt="CobraPro"
            className="h-12 w-auto object-contain"
          />
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Button
              onClick={goToLogin}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-lg text-sm uppercase tracking-wide"
            >
              Acessar Sistema
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
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

          <p className="text-lg md:text-xl text-white/60 mb-6 max-w-2xl mx-auto leading-relaxed">
            Cliente que esquece. Juros que você esqueceu de cobrar. Vencimento que passou sem você ver.{" "}
            <strong className="text-white">Cada dia sem o CobraPro é dinheiro que sai do seu bolso.</strong>
          </p>

          {/* Badges de uso */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {[
              { icon: "🏦", label: "Empréstimos" },
              { icon: "🏠", label: "Aluguéis" },
              { icon: "🔧", label: "Serviços" },
            ].map((b) => (
              <span key={b.label} className="flex items-center gap-1.5 border border-white/10 bg-white/5 text-white/70 text-sm font-medium px-4 py-2 rounded-full">
                {b.icon} {b.label}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button
              onClick={() => {
                const el = document.getElementById("precos");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-black text-base uppercase tracking-wide px-10 py-6 rounded-xl shadow-2xl shadow-red-900/40 transition-all hover:scale-105 w-full sm:w-auto"
            >
              🔥 QUERO PARAR DE PERDER DINHEIRO AGORA
            </Button>
            <Button
              onClick={goToLogin}
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 font-semibold px-8 py-6 rounded-xl w-full sm:w-auto"
            >
              💬 Tirar Dúvidas
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/50">
            {["✓ Acesso Imediato", "✓ Sem Mensalidade", "✓ Garantia de 7 Dias", "✓ Suporte Incluso"].map((b) => (
              <span key={b} className="text-white/50">{b}</span>
            ))}
          </div>
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
              ENQUANTO VOCÊ USA CADERNINHO,{" "}
              <span className="text-red-500">SEU CONCORRENTE USA COBRAPRO</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <TrendingUp className="w-6 h-6" />, title: "Painel de Controle", desc: "Visão completa em tempo real: saldo, capital em circulação, inadimplência e vencimentos do dia.", color: "red" },
              { icon: <Zap className="w-6 h-6" />, title: "Juros Automáticos", desc: "Simples ou composto. Cálculo automático de multas e juros por atraso, sem precisar calcular na mão.", color: "green" },
              { icon: <Users className="w-6 h-6" />, title: "Gestão de Clientes", desc: "Cadastro completo com CPF, PIX, score de crédito interno e histórico unificado de contratos.", color: "red" },
              { icon: <Shield className="w-6 h-6" />, title: "Múltiplas Modalidades", desc: "Empréstimos padrão, diários, Parcela Fixa, venda de produtos e desconto de cheques.", color: "green" },
              { icon: <Star className="w-6 h-6" />, title: "Cobrança via WhatsApp", desc: "Envie cobranças com templates dinâmicos: nome, valor, data e chave PIX automáticos.", color: "red" },
              { icon: <CheckCircle2 className="w-6 h-6" />, title: "Relatórios Completos", desc: "Fluxo de caixa, inadimplência, performance por cobrador e fechamento diário em PDF.", color: "green" },
            ].map((f) => (
              <div key={f.title} className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color === "red" ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
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
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-3">Nova Funcionalidade — Exclusiva</p>
            <h2 className="text-3xl md:text-5xl font-black uppercase leading-tight mb-4">
              VENDE IPHONE PARCELADO?{" "}
              <span className="text-green-400">AGORA VOCÊ CONTROLA TUDO.</span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Chega de anotar no papel, de esquecer parcela, de não saber quanto ainda vai receber.{" "}
              <strong className="text-white">O CobraPro agora gerencia cada venda de iPhone do início ao fim — com contrato, simulação e cobrança automática.</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-10">
            {[
              { icon: <Smartphone className="w-6 h-6" />, title: "Simule na Hora", desc: "Calcule parcelas, juros e lucro em tempo real antes de fechar o negócio. Sem surpresa, sem prejuízo." },
              { icon: <FileText className="w-6 h-6" />, title: "Contrato Automático", desc: "Gere o contrato completo com 1 clique. Dados do comprador, parcelas, cláusulas — tudo pronto para assinar." },
              { icon: <MessageCircle className="w-6 h-6" />, title: "Cobra pelo WhatsApp", desc: "Parcela venceu? Manda a cobrança direto no WhatsApp do comprador com um toque. Sem constrangimento, sem desculpa." },
              { icon: <BarChart3 className="w-6 h-6" />, title: "Visão Total da Carteira", desc: "Veja todas as vendas: ativas, atrasadas e quitadas. Saiba exatamente quanto ainda vai entrar no seu bolso." },
            ].map((f) => (
              <div key={f.title} className="bg-white/[0.03] border border-green-500/10 rounded-2xl p-5 hover:border-green-500/20 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center mb-3">{f.icon}</div>
                <h3 className="font-bold text-white mb-2 text-sm">{f.title}</h3>
                <p className="text-white/50 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-green-900/20 to-green-900/5 border border-green-500/20 rounded-3xl p-8 md:p-12 text-center">
            <div className="text-4xl mb-4">📱 💰</div>
            <h3 className="text-2xl md:text-4xl font-black uppercase leading-tight mb-4">
              CADA IPHONE VENDIDO SEM CONTROLE{" "}
              <span className="text-green-400">É DINHEIRO QUE VOCÊ NÃO VAI VER.</span>
            </h3>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Você confia na palavra do comprador? Ele lembra da parcela? Você lembra de cobrar?{" "}
              <strong className="text-white">Com o CobraPro, o sistema lembra por você — e cobra por você.</strong>
            </p>
            <Button
              onClick={goToLogin}
              className="bg-green-500 hover:bg-green-400 text-black font-black text-base uppercase tracking-wide px-8 py-5 rounded-xl"
            >
              ⚡ QUERO CONTROLAR MINHAS VENDAS
            </Button>
            <p className="text-white/30 text-xs mt-3">Incluso no plano — sem custo extra</p>
          </div>
        </div>
      </section>

      {/* ── PREÇOS ─────────────────────────────────────────────────────────── */}
      <section id="precos" className="py-24 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-red-500 text-xs font-bold uppercase tracking-widest mb-3">Investimento</p>
            <h2 className="text-3xl md:text-5xl font-black uppercase leading-tight mb-4">
              QUANTO VOCÊ ESTÁ PERDENDO{" "}
              <span className="text-red-500">POR NÃO TER O COBRAPRO?</span>
            </h2>
            <p className="text-white/50 text-base">Quanto maior o período, maior a economia!</p>
          </div>

          {/* Abas */}
          <div className="flex justify-center mb-8">
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
              {(["mensal", "trimestral", "anual"] as PlanoKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setPlanoAtivo(key)}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
                    planoAtivo === key
                      ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {PLANOS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Card do plano */}
          <div className="relative">
            {plano.badge && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                <span className="bg-red-600 text-white text-xs font-black uppercase tracking-widest px-5 py-2 rounded-full shadow-lg shadow-red-900/50">
                  {plano.badge}
                </span>
              </div>
            )}
            <div className={`bg-[#141414] border rounded-3xl p-8 md:p-10 ${plano.badge ? "border-red-500/40" : "border-white/10"}`}>
              <h3 className="text-xl font-black uppercase tracking-wide text-white mb-4">{plano.titulo}</h3>
              <div className="mb-2">
                <span className="text-5xl font-black text-red-500">{plano.preco}</span>
                <span className="text-white/40 text-base ml-2">{plano.periodo}</span>
              </div>
              {plano.parcelas && (
                <p className="text-white/30 text-sm mb-6">{plano.parcelas}</p>
              )}
              {!plano.parcelas && <div className="mb-6" />}

              <ul className="space-y-3 mb-8">
                {plano.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-white/80 text-sm">
                    <span className="text-red-500 font-bold flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plano.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-red-600 hover:bg-red-700 text-white font-black text-base uppercase tracking-wide py-5 rounded-xl text-center transition-all hover:scale-[1.02] shadow-xl shadow-red-900/40"
              >
                {plano.botao}
              </a>
              <p className="text-white/20 text-xs text-center mt-3">
                {plano.parcelas ? "Pague parcelado • " : ""}Garantia de 7 dias
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── GARANTIA ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 md:p-12 text-center">
            <div className="text-5xl mb-4">🛡️</div>
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

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black uppercase leading-tight">
              PERGUNTAS{" "}
              <span className="text-red-500">FREQUENTES</span>
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="font-semibold text-white/90 text-sm md:text-base">{item.q}</span>
                  <span className="text-red-500 flex-shrink-0 ml-4">
                    {faqAberto === i ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </span>
                </button>
                {faqAberto === i && (
                  <div className="px-6 pb-5">
                    <p className="text-white/50 text-sm leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
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
          <a
            href={PLANOS.anual.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-xl uppercase tracking-wide px-12 py-7 rounded-2xl shadow-2xl shadow-red-900/50 transition-all hover:scale-105"
          >
            🔥 SIM, QUERO PARAR DE PERDER DINHEIRO
          </a>
          <p className="text-white/20 text-xs mt-4">
            Acesso imediato • Dados seguros • Suporte incluso
          </p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-4 text-center text-white/20 text-sm">
        <span className="text-red-500/60">cobrapro.online</span> — © 2026 CobraPro. Todos os direitos reservados.
      </footer>


    </div>
  );
}
