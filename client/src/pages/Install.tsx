import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  Smartphone,
  CheckCircle,
  Download,
  Wifi,
  Bell,
  Zap,
  ArrowLeft,
  Globe,
  Share,
  Plus,
} from "lucide-react";

type DeviceTab = "iphone" | "android" | "xiaomi" | "samsung";

const DEVICE_TABS: { id: DeviceTab; label: string; emoji: string }[] = [
  { id: "iphone", label: "iPhone/iPad", emoji: "📱" },
  { id: "android", label: "Android", emoji: "🌐" },
  { id: "xiaomi", label: "Xiaomi/Redmi", emoji: "📲" },
  { id: "samsung", label: "Samsung", emoji: "📱" },
];

function detectDefaultTab(): DeviceTab {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "iphone";
  if (/Xiaomi|Redmi|MIUI/.test(ua)) return "xiaomi";
  if (/Samsung|SM-/.test(ua)) return "samsung";
  if (/Android/.test(ua)) return "android";
  return "android";
}

interface Step {
  title: string;
  description: string;
  visual: React.ReactNode;
}

function MenuVisual() {
  return (
    <div className="flex flex-col items-center justify-center py-3">
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-foreground/70" />
        <div className="w-1.5 h-1.5 rounded-full bg-foreground/70" />
        <div className="w-1.5 h-1.5 rounded-full bg-foreground/70" />
      </div>
      <span className="text-xs text-muted-foreground mt-2">Menu</span>
    </div>
  );
}

function InstallButtonVisual() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
      <Download className="h-5 w-5 text-primary" />
      <span className="text-sm font-medium">Instalar aplicativo</span>
    </div>
  );
}

function ConfirmVisual() {
  return (
    <div className="flex items-center justify-end gap-6 px-4 py-3 rounded-lg bg-muted/50">
      <span className="text-sm text-muted-foreground">Cancelar</span>
      <span className="text-sm font-semibold text-primary">Instalar</span>
    </div>
  );
}

function SuccessVisual() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
      <CheckCircle className="h-5 w-5 text-green-500" />
      <span className="text-sm font-medium text-green-600 dark:text-green-400">App instalado com sucesso!</span>
    </div>
  );
}

function getSteps(device: DeviceTab): Step[] {
  switch (device) {
    case "iphone":
      return [
        {
          title: "Abra no Safari",
          description: "Abra o CobraPro no navegador Safari do seu iPhone ou iPad.",
          visual: (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
              <Globe className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">Safari</span>
              <span className="ml-auto text-xs text-muted-foreground">Recomendado</span>
            </div>
          ),
        },
        {
          title: "Toque em Compartilhar",
          description: "Toque no ícone de compartilhar (quadrado com seta ↑) na barra inferior do Safari.",
          visual: (
            <div className="flex flex-col items-center gap-1 py-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Share className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Compartilhar</span>
            </div>
          ),
        },
        {
          title: "Adicionar à Tela de Início",
          description: "Role para baixo no menu e toque em \"Adicionar à Tela de Início\".",
          visual: (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
              <Plus className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Adicionar à Tela de Início</span>
            </div>
          ),
        },
        {
          title: "Pronto! App instalado",
          description: "O ícone do CobraPro aparecerá na sua tela inicial.",
          visual: <SuccessVisual />,
        },
      ];

    case "android":
      return [
        {
          title: "Abra o menu do navegador",
          description: "Toque nos três pontos verticais no canto superior direito do Chrome.",
          visual: <MenuVisual />,
        },
        {
          title: "Toque em \"Instalar aplicativo\"",
          description: "No menu, procure a opção \"Instalar aplicativo\" ou \"Adicionar à tela inicial\".",
          visual: <InstallButtonVisual />,
        },
        {
          title: "Confirme a instalação",
          description: "Uma janela de confirmação aparecerá. Toque em \"Instalar\" para finalizar.",
          visual: <ConfirmVisual />,
        },
        {
          title: "Pronto! App instalado",
          description: "O ícone do CobraPro aparecerá na sua tela inicial e na gaveta de apps!",
          visual: <SuccessVisual />,
        },
      ];

    case "xiaomi":
      return [
        {
          title: "Abra no Chrome",
          description: "Para melhor compatibilidade, use o Google Chrome no seu Xiaomi/Redmi.",
          visual: (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
              <Globe className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium">Google Chrome</span>
            </div>
          ),
        },
        {
          title: "Toque no menu (três pontos)",
          description: "Toque nos três pontos no canto superior direito do navegador.",
          visual: <MenuVisual />,
        },
        {
          title: "Selecione \"Adicionar à tela inicial\"",
          description: "Procure a opção \"Adicionar à tela inicial\" ou \"Instalar aplicativo\" no menu.",
          visual: <InstallButtonVisual />,
        },
        {
          title: "Confirme e instale",
          description: "Confirme o nome do atalho e toque em \"Adicionar\".",
          visual: <SuccessVisual />,
        },
      ];

    case "samsung":
      return [
        {
          title: "Abra no Samsung Internet ou Chrome",
          description: "Use o Samsung Internet Browser ou Google Chrome para acessar o CobraPro.",
          visual: (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
              <Globe className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium">Samsung Internet ou Chrome</span>
            </div>
          ),
        },
        {
          title: "Toque no menu do navegador",
          description: "No Samsung Internet, toque nas três linhas horizontais. No Chrome, toque nos três pontos.",
          visual: <MenuVisual />,
        },
        {
          title: "Adicionar à tela inicial",
          description: "Selecione \"Adicionar página à\" e depois \"Tela inicial\".",
          visual: <InstallButtonVisual />,
        },
        {
          title: "Pronto! App instalado",
          description: "O ícone do CobraPro aparecerá na sua tela inicial Samsung.",
          visual: <SuccessVisual />,
        },
      ];
  }
}

function getTip(device: DeviceTab): string {
  switch (device) {
    case "iphone": return "Use o navegador Safari para a melhor experiência no iPhone/iPad.";
    case "android": return "Use o navegador Chrome para a melhor experiência no Android.";
    case "xiaomi": return "Use o Google Chrome para garantir compatibilidade total no Xiaomi/Redmi.";
    case "samsung": return "Use o Samsung Internet Browser ou Chrome para instalar no Samsung.";
  }
}

export default function Install() {
  const [activeTab, setActiveTab] = useState<DeviceTab>(detectDefaultTab);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;
    setIsInstalled(standalone);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-green-500/20 flex items-center justify-center mb-6">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">App já instalado!</h1>
        <p className="text-muted-foreground mb-8 text-sm">
          O CobraPro está instalado no seu dispositivo. Acesse pela tela inicial.
        </p>
        <Button onClick={() => setLocation("/dashboard")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Ir para o Dashboard
        </Button>
      </div>
    );
  }

  const steps = getSteps(activeTab);
  const tip = getTip(activeTab);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => setLocation("/dashboard")}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-semibold text-base">Instalar App</h1>
            <p className="text-xs text-muted-foreground">CobraPro</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Instale o CobraPro</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Tenha acesso rápido ao app direto da tela inicial do seu celular
          </p>
        </div>

        {/* Quick install for Android */}
        {deferredPrompt && (
          <Button onClick={handleInstall} className="w-full gap-2 h-12 text-base font-semibold">
            <Download className="h-5 w-5" />
            Instalar CobraPro Agora
          </Button>
        )}

        {/* Device tabs + steps */}
        <Card className="border-border">
          <CardContent className="p-5 space-y-5">
            <div>
              <h3 className="font-semibold text-sm mb-0.5">Como instalar no celular</h3>
              <p className="text-xs text-muted-foreground">Selecione seu dispositivo e siga as instruções</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg overflow-x-auto">
              {DEVICE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center ${
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tip */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-primary text-xs font-semibold shrink-0">Dica:</span>
              <p className="text-xs text-muted-foreground">{tip}</p>
            </div>

            {/* Steps */}
            <div className="space-y-0">
              {steps.map((step, index) => {
                const isLast = index === steps.length - 1;
                return (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        isLast
                          ? "bg-green-500/20 text-green-600 dark:text-green-400"
                          : "bg-primary/20 text-primary"
                      }`}>
                        {isLast ? <CheckCircle className="h-4 w-4" /> : index + 1}
                      </div>
                      {!isLast && <div className="w-0.5 flex-1 bg-border mt-2 mb-0" />}
                    </div>
                    <div className="flex-1 pb-5">
                      <h4 className="font-semibold text-sm mb-1">{step.title}</h4>
                      <p className="text-xs text-muted-foreground mb-3">{step.description}</p>
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        {step.visual}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Vantagens */}
        <Card className="border-border">
          <CardContent className="p-5">
            <h3 className="font-semibold text-sm mb-4">Vantagens do App Instalado</h3>
            <div className="space-y-3">
              {[
                { icon: Zap, text: "Acesso rápido direto da tela inicial" },
                { icon: Wifi, text: "Funciona mesmo com internet instável" },
                { icon: Smartphone, text: "Experiência em tela cheia como app nativo" },
                { icon: Bell, text: "Receba lembretes de cobranças" },
                { icon: Download, text: "Sem precisar baixar da loja de apps" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* URL */}
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">URL do aplicativo:</p>
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              <code className="text-xs flex-1 truncate text-foreground">{window.location.origin}</code>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => navigator.clipboard.writeText(window.location.origin)}
              >
                Copiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Back */}
        <Button variant="outline" onClick={() => setLocation("/dashboard")} className="w-full gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Button>
      </div>
    </div>
  );
}
