import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Info,
  Share2,
  Plus,
  Download,
  ExternalLink,
  AlignJustify,
} from "lucide-react";

export default function Install() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-2 text-green-400 font-bold text-lg hover:text-green-300 transition-colors"
        >
          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-green-400" />
          </div>
          CobraPro
        </button>
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors border border-white/20 rounded-lg px-3 py-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Dashboard
        </button>
      </header>

      {/* Main */}
      <main className="max-w-lg mx-auto px-4 py-10">
        {/* Hero */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mb-5">
            <Smartphone className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Instale o CobraPro</h1>
          <p className="text-gray-400 text-base">
            Tenha acesso rápido ao app direto da tela inicial do seu celular
          </p>
        </div>

        {/* Install card */}
        <div className="bg-[#1c1c1c] rounded-2xl p-5 mb-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-1">Como instalar no celular</h2>
          <p className="text-sm text-gray-400 mb-4">Selecione seu dispositivo e siga as instruções</p>

          <Tabs defaultValue="android">
            <TabsList className="w-full grid grid-cols-4 bg-[#252525] rounded-xl mb-5 h-auto p-1 gap-1">
              <TabsTrigger
                value="ios"
                className="text-xs py-2 rounded-lg data-[state=active]:bg-[#333] data-[state=active]:text-white text-gray-400"
              >
                📱 iPhone
              </TabsTrigger>
              <TabsTrigger
                value="android"
                className="text-xs py-2 rounded-lg data-[state=active]:bg-[#333] data-[state=active]:text-white text-gray-400"
              >
                🤖 Android
              </TabsTrigger>
              <TabsTrigger
                value="xiaomi"
                className="text-xs py-2 rounded-lg data-[state=active]:bg-[#333] data-[state=active]:text-white text-gray-400"
              >
                📲 Xiaomi
              </TabsTrigger>
              <TabsTrigger
                value="samsung"
                className="text-xs py-2 rounded-lg data-[state=active]:bg-[#333] data-[state=active]:text-white text-gray-400"
              >
                📲 Samsung
              </TabsTrigger>
            </TabsList>

            {/* ── iPhone/iPad ── */}
            <TabsContent value="ios" className="space-y-4">
              <AlertBox variant="info">
                <strong>Importante:</strong> Use o navegador <strong>Safari</strong> para instalar no iPhone/iPad.
              </AlertBox>

              <StepCard number={1} title="Toque no botão Compartilhar" description="Na barra inferior do Safari, procure o ícone de compartilhar (um quadrado com uma seta para cima).">
                <IconPreview icon={<Share2 className="w-5 h-5 text-green-400" />} label="Compartilhar" />
              </StepCard>

              <StepCard number={2} title='Selecione "Adicionar à Tela de Início"' description='Role as opções para baixo até encontrar "Adicionar à Tela de Início" com o ícone de +.'>
                <MenuRow icon={<Plus className="w-4 h-4 text-gray-300" />} label="Adicionar à Tela de Início" />
              </StepCard>

              <StepCard number={3} title='Confirme tocando em "Adicionar"' description='Uma tela de confirmação aparecerá. Toque em "Adicionar" no canto superior direito.'>
                <ConfirmRow cancelLabel="Cancelar" confirmLabel="Adicionar" />
              </StepCard>

              <SuccessCard text="O ícone do CobraPro aparecerá na sua tela inicial. Toque nele para abrir o app!" />
            </TabsContent>

            {/* ── Android ── */}
            <TabsContent value="android" className="space-y-4">
              <AlertBox variant="success">
                <strong>Dica:</strong> Use o navegador <strong>Chrome</strong> para a melhor experiência no Android.
              </AlertBox>

              <StepCard number={1} title="Abra o menu do navegador" description="Toque nos três pontos verticais no canto superior direito do Chrome.">
                <IconPreview icon={<span className="text-green-400 text-xl font-bold leading-none">⋮</span>} label="Menu" />
              </StepCard>

              <StepCard number={2} title='Toque em "Instalar aplicativo"' description='No menu, procure a opção "Instalar aplicativo" ou "Adicionar à tela inicial".'>
                <MenuRow icon={<Download className="w-4 h-4 text-gray-300" />} label="Instalar aplicativo" />
              </StepCard>

              <StepCard number={3} title="Confirme a instalação" description='Uma janela de confirmação aparecerá. Toque em "Instalar" para finalizar.'>
                <ConfirmRow cancelLabel="Cancelar" confirmLabel="Instalar" />
              </StepCard>

              <SuccessCard text="O ícone do CobraPro aparecerá na sua tela inicial e na gaveta de apps!" />
            </TabsContent>

            {/* ── Xiaomi/Redmi ── */}
            <TabsContent value="xiaomi" className="space-y-4">
              <AlertBox variant="warning">
                <strong>Atenção: Xiaomi/MIUI requer passos especiais</strong>
                <br />
                O navegador Mi Browser não suporta instalação de apps. Use o <strong>Chrome</strong> para instalar.
              </AlertBox>

              <StepCard number={0} title="Abra este site no Chrome" description='Se você está no Mi Browser, toque nos três pontos ⋮ e selecione "Abrir no Chrome" ou "Abrir em outro app".'>
                <MenuRow icon={<ExternalLink className="w-4 h-4 text-gray-300" />} label="Abrir no Chrome" />
              </StepCard>

              <StepCard number={1} title="No Chrome, abra o menu" description="Toque nos três pontos ⋮ no canto superior direito.">
                <IconPreview icon={<span className="text-green-400 text-xl font-bold leading-none">⋮</span>} label="Menu Chrome" />
              </StepCard>

              <StepCard number={2} title='Procure "Instalar" ou "Adicionar à tela inicial"' description="Role o menu e procure uma destas opções:">
                <div className="space-y-2">
                  <MenuRow icon={<Download className="w-4 h-4 text-gray-300" />} label="Instalar aplicativo" />
                  <MenuRow icon={<Plus className="w-4 h-4 text-gray-300" />} label="Adicionar à tela inicial" />
                </div>
              </StepCard>

              <div className="bg-[#2a2a2a] rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-xs text-white font-bold">?</div>
                  <span className="text-sm font-semibold text-white">Opção não aparece?</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">Em alguns modelos Xiaomi, a opção pode estar oculta. Tente:</p>
                <ul className="text-xs text-gray-300 space-y-1">
                  <li>• Menu ⋮ → <strong>"Adicionar ao..."</strong> → <strong>"Tela inicial"</strong></li>
                  <li>• Ou menu ⋮ → <strong>"Criar atalho"</strong> → Marque <strong>"Abrir como janela"</strong></li>
                  <li>• Feche o Chrome e abra novamente para tentar de novo</li>
                </ul>
              </div>

              <SuccessCard text="O ícone do CobraPro aparecerá na sua tela inicial!" />
            </TabsContent>

            {/* ── Samsung ── */}
            <TabsContent value="samsung" className="space-y-4">
              <AlertBox variant="info">
                <strong>Samsung Internet:</strong> Siga os passos abaixo para instalar pelo Samsung Browser. Você também pode usar o <strong>Chrome</strong> se preferir.
              </AlertBox>

              <StepCard number={1} title="Abra o menu do navegador" description="No Samsung Internet, toque no ícone de menu ≡ na parte inferior da tela (3 linhas horizontais).">
                <IconPreview icon={<AlignJustify className="w-5 h-5 text-green-400" />} label="Menu Samsung" />
              </StepCard>

              <StepCard number={2} title='Toque em "Adicionar página a"' description='No menu, procure a opção "Adicionar página a" ou "Instalar".'>
                <MenuRow icon={<Plus className="w-4 h-4 text-gray-300" />} label="Adicionar página a..." />
              </StepCard>

              <StepCard number={3} title='Selecione "Tela inicial"' description='Escolha a opção "Tela inicial" para adicionar o atalho.'>
                <MenuRow icon={<Smartphone className="w-4 h-4 text-gray-300" />} label="Tela inicial" />
              </StepCard>

              <StepCard number={4} title="Confirme adicionando o atalho" description='Uma janela de confirmação aparecerá. Toque em "Adicionar" para finalizar.'>
                <ConfirmRow cancelLabel="Cancelar" confirmLabel="Adicionar" />
              </StepCard>

              <SuccessCard text="O ícone do CobraPro aparecerá na sua tela inicial!" />
            </TabsContent>
          </Tabs>
        </div>

        {/* Vantagens */}
        <div className="bg-[#1c1c1c] rounded-2xl p-5 mb-8 border border-white/10">
          <h3 className="text-base font-semibold text-white mb-4">Vantagens do App Instalado</h3>
          <div className="space-y-3">
            {[
              "Acesso rápido direto da tela inicial",
              "Funciona mesmo com internet instável",
              "Experiência em tela cheia como app nativo",
              "Receba lembretes de cobranças",
              "Sem precisar baixar da loja de apps",
            ].map((v) => (
              <div key={v} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                <span className="text-sm text-gray-200">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom button */}
        <div className="flex justify-center">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors border border-white/20 rounded-xl px-5 py-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function AlertBox({
  variant,
  children,
}: {
  variant: "info" | "success" | "warning";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    success: "bg-green-500/10 border-green-500/30 text-green-300",
    warning: "bg-orange-500/10 border-orange-500/30 text-orange-200",
  };
  const icons = {
    info: <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />,
    success: <Info className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />,
  };
  return (
    <div className={`flex items-start gap-2 border rounded-xl p-3 text-sm ${styles[variant]}`}>
      {icons[variant]}
      <p>{children}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
          number === 0 ? "bg-orange-500 text-white" : "bg-green-500 text-white"
        }`}
      >
        {number}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        {children && (
          <div className="mt-2 bg-[#252525] rounded-xl p-3 border border-white/5">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function IconPreview({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="w-10 h-10 bg-[#2a2a2a] rounded-lg flex items-center justify-center">
        {icon}
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

function MenuRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-lg px-3 py-2">
      {icon}
      <span className="text-sm text-gray-200">{label}</span>
    </div>
  );
}

function ConfirmRow({ cancelLabel, confirmLabel }: { cancelLabel: string; confirmLabel: string }) {
  return (
    <div className="flex justify-end gap-3 bg-[#2a2a2a] rounded-lg px-3 py-2">
      <span className="text-sm text-gray-400">{cancelLabel}</span>
      <span className="text-sm text-green-400 font-semibold">{confirmLabel}</span>
    </div>
  );
}

function SuccessCard({ text }: { text: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0 mt-0.5">
        <CheckCircle className="w-4 h-4 text-green-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-green-400">Pronto! App instalado</p>
        <p className="text-xs text-gray-400 mt-0.5">{text}</p>
      </div>
    </div>
  );
}
