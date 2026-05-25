import { useTranslation } from 'react-i18next';
import { useState, useEffect } from "react";
import { trackPageView, trackLead, trackMetaEvent } from "@/lib/metaEvents";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, Zap, TrendingUp, Star, CheckCircle2, Plus, Minus, Smartphone, FileText, MessageCircle, BarChart3 } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// ── Links dos planos (não mudam com idioma) ─────────────────────────────────
const PLANO_LINKS = {
  mensal: "https://pay.kiwify.com.br/6CcDjtJ",
  trimestral: "https://pay.kiwify.com.br/Z4bG2vK",
  anual: "https://pay.kiwify.com.br/muLvvtO",
} as const;

const PLANO_PRECOS = {
  mensal: { preco: "R$ 65,00", periodoKey: "landing.planPeriodMonth", parcelas: null, botaoKey: "landing.planBtnMonthly", economiaKey: null },
  trimestral: { preco: "R$ 185,00", periodoKey: "landing.planPeriodQuarter", parcelas: "ou 3x de R$ 61,67", botaoKey: "landing.planBtnQuarterly", economiaKey: "landing.planSavingsQuarter" },
  anual: { preco: "R$ 517,00", periodoKey: "landing.planPeriodYear", parcelas: "ou 12x de R$ 43,08", botaoKey: "landing.planBtnAnnual", economiaKey: "landing.planSavingsAnnual" },
} as const;

type PlanoKey = keyof typeof PLANO_LINKS;

export default function Home() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [planoAtivo, setPlanoAtivo] = useState<PlanoKey>("anual");
  const [faqAberto, setFaqAberto] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [loading, isAuthenticated, setLocation]);

  useEffect(() => {
    trackPageView();
  }, []);

  const goToLogin = () => setLocation("/login");

  const planoPrecos = PLANO_PRECOS[planoAtivo];
  const planoLink = PLANO_LINKS[planoAtivo];

  // Features do plano traduzidas
  const planoFeatures: Record<PlanoKey, string[]> = {
    mensal: [
      t('landing.planAccessDays'),
      t('landing.planAllFeatures'),
      t('landing.planIphone'),
      t('landing.planAlerts'),
      t('landing.planCharges'),
      t('landing.planSupport'),
      t('landing.planPdf'),
      t('landing.planUpdates'),
    ],
    trimestral: [
      t('landing.planAccessMonths'),
      t('landing.planAllFeatures'),
      t('landing.planIphone'),
      t('landing.planAlerts'),
      t('landing.planCharges'),
      t('landing.planPrioritySupport'),
      t('landing.planPdf'),
      t('landing.planUpdates'),
    ],
    anual: [
      t('landing.planAccessYear'),
      t('landing.planAllFeatures'),
      t('landing.planIphone'),
      t('landing.planAlerts'),
      t('landing.planCharges'),
      t('landing.planPrioritySupport'),
      t('landing.planPdf'),
      t('landing.planUpdates'),
      planoPrecos.economiaKey ? `${t('landing.savings')} ${t(planoPrecos.economiaKey)}` : '',
    ],
  };

  // FAQ traduzido
  const faqItems = [
    { q: t('landing.faq1q'), a: t('landing.faq1a') },
    { q: t('landing.faq2q'), a: t('landing.faq2a') },
    { q: t('landing.faq3q'), a: t('landing.faq3a') },
    { q: t('landing.faq4q'), a: t('landing.faq4a') },
    { q: t('landing.faq5q'), a: t('landing.faq5a') },
    { q: t('landing.faq6q'), a: t('landing.faq6a') },
    { q: t('landing.faq7q'), a: t('landing.faq7a') },
  ];

  // Labels dos planos traduzidos
  const planoLabels: Record<PlanoKey, string> = {
    mensal: t('landing.planMonthly'),
    trimestral: t('landing.planQuarterly'),
    anual: t('landing.planAnnual'),
  };

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
              {t('landing.accessSystem')}
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 border border-green-500/40 bg-green-500/10 text-green-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {t('landing.systemActive')}
          </div>

          <h1 className="text-4xl md:text-6xl font-black uppercase leading-tight mb-6">
            {t('landing.heroTitle1')}{" "}
            <span className="text-white/40">{t('landing.heroTitle2')}</span>
            {t('landing.heroTitle3')}{" "}
            <br className="hidden md:block" />
            <span className="text-red-500">COBRAPRO</span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 mb-6 max-w-2xl mx-auto leading-relaxed">
            {t('landing.heroSubtitle')}{" "}
            <strong className="text-white">{t('landing.heroSubtitleBold')}</strong>
          </p>

          {/* Badges de uso */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {[
              { icon: "🏦", key: "badgeLoans" },
              { icon: "🏠", key: "badgeRentals" },
              { icon: "🔧", key: "badgeServices" },
            ].map((b) => (
              <span key={b.key} className="flex items-center gap-1.5 border border-white/10 bg-white/5 text-white/70 text-sm font-medium px-4 py-2 rounded-full">
                {b.icon} {t(`landing.${b.key}`)}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button
              onClick={() => {
                trackLead();
                const el = document.getElementById("precos");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-black text-base uppercase tracking-wide px-10 py-6 rounded-xl shadow-2xl shadow-red-900/40 transition-all hover:scale-105 w-full sm:w-auto"
            >
              {t('landing.ctaMain')}
            </Button>
            <Button
              onClick={goToLogin}
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 font-semibold px-8 py-6 rounded-xl w-full sm:w-auto"
            >
              {t('landing.ctaLogin')}
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/50">
            {[t('landing.badgeInstantAccess'), t('landing.badgeNoMonthly'), t('landing.badge7Days'), t('landing.badgeSupportIncluded')].map((b) => (
              <span key={b} className="text-white/50">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "50+", label: t('landing.statsUsers') },
            { value: "1X", label: t('landing.statsSinglePayment') },
            { value: "4.9/5", label: t('landing.statsRating') },
            { value: "98.9%", label: t('landing.statsSatisfaction') },
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
            <p className="text-red-500 text-xs font-bold uppercase tracking-widest mb-3">{t('landing.arsenalBadge')}</p>
            <h2 className="text-3xl md:text-5xl font-black uppercase leading-tight">
              {t('landing.featuresTitle')}{" "}
              <span className="text-red-500">{t('landing.featuresTitle2')}</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <TrendingUp className="w-6 h-6" />, titleKey: "feature1Title", descKey: "feature1Desc", color: "red" },
              { icon: <Zap className="w-6 h-6" />, titleKey: "feature2Title", descKey: "feature2Desc", color: "green" },
              { icon: <Shield className="w-6 h-6" />, titleKey: "feature3Title", descKey: "feature3Desc", color: "red" },
              { icon: <Star className="w-6 h-6" />, titleKey: "feature4Title", descKey: "feature4Desc", color: "green" },
              { icon: <CheckCircle2 className="w-6 h-6" />, titleKey: "feature5Title", descKey: "feature5Desc", color: "red" },
              { icon: <BarChart3 className="w-6 h-6" />, titleKey: "feature6Title", descKey: "feature6Desc", color: "green" },
            ].map((f) => (
              <div key={f.titleKey} className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color === "red" ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-white mb-2 uppercase tracking-wide text-sm">{t(`landing.${f.titleKey}`)}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{t(`landing.${f.descKey}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IPHONE FEATURE ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-3">{t('landing.iphoneBadge')}</p>
            <h2 className="text-3xl md:text-5xl font-black uppercase leading-tight mb-4">
              {t('landing.iphoneTitle1')}{" "}
              <span className="text-green-400">{t('landing.iphoneTitle2')}</span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              {t('landing.iphoneDesc1')}{" "}
              <strong className="text-white">{t('landing.iphoneDesc2')}</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-10">
            {[
              { icon: <Smartphone className="w-6 h-6" />, title: t('landing.iphoneF1Title'), desc: t('landing.iphoneF1Desc') },
              { icon: <FileText className="w-6 h-6" />, title: t('landing.iphoneF2Title'), desc: t('landing.iphoneF2Desc') },
              { icon: <MessageCircle className="w-6 h-6" />, title: t('landing.iphoneF3Title'), desc: t('landing.iphoneF3Desc') },
              { icon: <BarChart3 className="w-6 h-6" />, title: t('landing.iphoneF4Title'), desc: t('landing.iphoneF4Desc') },
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
              {t('landing.iphoneCta1')}{" "}
              <span className="text-green-400">{t('landing.iphoneCta2')}</span>
            </h3>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              {t('landing.iphoneCtaDesc1')}{" "}
              <strong className="text-white">{t('landing.iphoneCtaDesc2')}</strong>
            </p>
            <Button
              onClick={goToLogin}
              className="bg-green-500 hover:bg-green-400 text-black font-black text-base uppercase tracking-wide px-8 py-5 rounded-xl"
            >
              {t('landing.iphoneCtaBtn')}
            </Button>
            <p className="text-white/30 text-xs mt-3">{t('landing.iphoneCtaNote')}</p>
          </div>
        </div>
      </section>

      {/* ── PREÇOS ─────────────────────────────────────────────────────────── */}
      <section id="precos" className="py-24 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-red-500 text-xs font-bold uppercase tracking-widest mb-3">{t('landing.investmentBadge')}</p>
            <h2 className="text-3xl md:text-5xl font-black uppercase leading-tight mb-4">
              {t('landing.plansTitle')}{" "}
              <span className="text-red-500">{t('landing.plansTitle2')}</span>
            </h2>
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
                  {planoLabels[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Card do plano */}
          <div className="relative">
            {planoAtivo === "anual" && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                <span className="bg-red-600 text-white text-xs font-black uppercase tracking-widest px-5 py-2 rounded-full shadow-lg shadow-red-900/50">
                  {t('landing.mostSold')}
                </span>
              </div>
            )}
            <div className={`bg-[#141414] border rounded-3xl p-8 md:p-10 ${planoAtivo === "anual" ? "border-red-500/40" : "border-white/10"}`}>
              <h3 className="text-xl font-black uppercase tracking-wide text-white mb-4">{planoLabels[planoAtivo].toUpperCase()}</h3>
              <div className="mb-2">
                <span className="text-5xl font-black text-red-500">{planoPrecos.preco}</span>
                <span className="text-white/40 text-base ml-2">{t(planoPrecos.periodoKey)}</span>
              </div>
              {planoPrecos.parcelas && (
                <p className="text-white/30 text-sm mb-6">{planoPrecos.parcelas}</p>
              )}
              {!planoPrecos.parcelas && <div className="mb-6" />}

              <ul className="space-y-3 mb-8">
                {planoFeatures[planoAtivo].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-white/80 text-sm">
                    <span className="text-red-500 font-bold flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={planoLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackMetaEvent("InitiateCheckout", { customData: { content_name: planoAtivo } })}
                className="block w-full bg-red-600 hover:bg-red-700 text-white font-black text-base uppercase tracking-wide py-5 rounded-xl text-center transition-all hover:scale-[1.02] shadow-xl shadow-red-900/40"
              >
                {t(planoPrecos.botaoKey)}
              </a>
              <p className="text-white/20 text-xs text-center mt-3">
                {planoPrecos.parcelas ? `${t('landing.planInstallments')}` : ""}{t('landing.planGuarantee')}
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
              {t('landing.guaranteeTitle')}{" "}
              <span className="text-white/40">{t('landing.guaranteeTitle2')}</span>
            </h2>
            <p className="text-white/60 text-base mb-8 leading-relaxed">
              {t('landing.guaranteeDesc')}{" "}
              <strong className="text-white">{t('landing.guaranteeDescBold')}</strong>
              {t('landing.guaranteeDescEnd')}
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              {[
                t('landing.guaranteeRefund'),
                t('landing.guaranteeNoBureaucracy'),
                t('landing.guaranteeNoQuestion'),
              ].map((g) => (
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
              {t('landing.faqTitle')}{" "}
              <span className="text-red-500">{t('landing.faqTitle2')}</span>
            </h2>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
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
            {t('landing.ctaFinalTitle')}{" "}
            <span className="text-red-500">{t('landing.ctaFinalTitle2')}</span>
          </h2>
          <p className="text-white/50 text-lg mb-4">
            {t('landing.ctaFinalDesc')}
          </p>
          <p className="text-white/30 text-sm mb-10">
            {t('landing.ctaFinalSocial')}
          </p>
          <a
            href={PLANO_LINKS.anual}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-xl uppercase tracking-wide px-12 py-7 rounded-2xl shadow-2xl shadow-red-900/50 transition-all hover:scale-105"
          >
            {t('landing.ctaFinalBtn')}
          </a>
          <p className="text-white/20 text-xs mt-4">
            {t('landing.ctaFinalMeta')}
          </p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-4 text-center text-white/20 text-sm">
        <span className="text-red-500/60">cobrapro.online</span> — © 2026 CobraPro. {t('landing.footerRights')}
      </footer>

    </div>
  );
}
