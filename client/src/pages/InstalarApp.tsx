import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Share,
  Plus,
  Chrome,
  CheckCircle,
  Download,
  Apple,
  Monitor,
  Wifi,
  Bell,
  Zap,
  Shield,
} from "lucide-react";

// Detectar plataforma
function detectPlatform() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isMac = /Macintosh/.test(ua);
  const isWindows = /Windows/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as any).standalone === true;
  return { isIOS, isAndroid, isMac, isWindows, isSafari, isChrome, isStandalone };
}

export default function InstalarApp() {
  const [platform, setPlatform] = useState(() => detectPlatform());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (platform.isStandalone || installed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-success/20 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-success" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">App Instalado!</h1>
          <p className="text-muted-foreground mt-2">
            O CobraPro está instalado no seu dispositivo. Você pode acessá-lo pela tela inicial.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          {[
            { icon: Wifi, label: "Funciona offline" },
            { icon: Bell, label: "Notificações" },
            { icon: Zap, label: "Mais rápido" },
            { icon: Shield, label: "Seguro" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Smartphone className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Instalar CobraPro</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Instale o app no seu celular para acesso rápido, sem precisar abrir o navegador.
        </p>
      </div>

      {/* Benefícios */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Zap, label: "Acesso rápido", desc: "Ícone na tela inicial" },
          { icon: Monitor, label: "Tela cheia", desc: "Sem barra do navegador" },
          { icon: Bell, label: "Notificações", desc: "Alertas de vencimento" },
          { icon: Shield, label: "Seguro", desc: "Dados criptografados" },
        ].map(({ icon: Icon, label, desc }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-3 flex items-start gap-2">
              <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instruções por plataforma */}
      {platform.isIOS && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Apple className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">iPhone / iPad (iOS)</h2>
              <Badge variant="outline" className="text-xs ml-auto">Safari</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              No iOS, a instalação é feita pelo <strong>Safari</strong>. Siga os passos:
            </p>
            <ol className="space-y-3">
              {[
                { icon: Chrome, text: "Abra este site no Safari (não no Chrome ou Firefox)" },
                { icon: Share, text: 'Toque no ícone de Compartilhar (quadrado com seta ↑) na barra inferior' },
                { icon: Plus, text: 'Role para baixo e toque em "Adicionar à Tela de Início"' },
                { icon: CheckCircle, text: 'Confirme o nome "CobraPro" e toque em Adicionar' },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ol>
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              💡 <strong>Dica:</strong> Se você está usando o Chrome no iPhone, copie o link e cole no Safari para instalar.
            </div>
          </CardContent>
        </Card>
      )}

      {platform.isAndroid && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Android</h2>
              <Badge variant="outline" className="text-xs ml-auto">Chrome</Badge>
            </div>
            {deferredPrompt ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Seu navegador suporta instalação automática. Clique no botão abaixo:
                </p>
                <Button
                  onClick={handleInstallAndroid}
                  className="w-full gap-2 bg-primary hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" />
                  Instalar CobraPro
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Instale pelo menu do Chrome:
                </p>
                <ol className="space-y-3">
                  {[
                    { text: 'Toque no menu ⋮ (três pontos) no canto superior direito do Chrome' },
                    { text: '"Adicionar à tela inicial" ou "Instalar aplicativo"' },
                    { text: 'Confirme tocando em "Instalar"' },
                  ].map(({ text }, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">{i + 1}</span>
                      </div>
                      <span className="text-sm">{text}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {!platform.isIOS && !platform.isAndroid && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Desktop (Windows / Mac)</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              No Chrome ou Edge, você pode instalar o CobraPro como um app de desktop:
            </p>
            <ol className="space-y-3">
              {[
                { text: 'Procure o ícone de instalação (⊕) na barra de endereço do Chrome/Edge' },
                { text: 'Clique em "Instalar CobraPro"' },
                { text: 'O app abrirá em uma janela separada, sem a barra do navegador' },
              ].map(({ text }, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ol>
            {deferredPrompt && (
              <Button
                onClick={handleInstallAndroid}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                Instalar CobraPro no Desktop
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* URL do app */}
      <Card className="border-border">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">URL do aplicativo:</p>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
            <code className="text-xs flex-1 truncate text-foreground">
              {window.location.origin}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin);
              }}
            >
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
