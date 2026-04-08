import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, Download, Check } from "lucide-react";

export default function Install() {
  const [dispositivo, setDispositivo] = useState<"ios" | "android" | "xiaomi" | "samsung">("android");

  const instrucoes = {
    ios: {
      titulo: "iPhone/iPad",
      passos: [
        {
          numero: 1,
          titulo: "Abra o menu do navegador",
          descricao: "Toque nos três pontos verticais no canto superior direito do Safari.",
          icone: "⋮",
        },
        {
          numero: 2,
          titulo: "Toque em 'Adicionar à Tela Inicial'",
          descricao: "No menu, procure a opção 'Adicionar à Tela Inicial' ou 'Add to Home Screen'.",
          icone: "📱",
        },
        {
          numero: 3,
          titulo: "Confirme a instalação",
          descricao: "Uma janela de confirmação aparecerá. Toque em 'Adicionar' para finalizar.",
          icone: "✓",
        },
      ],
      dica: "Use o navegador Safari para a melhor experiência no iOS.",
    },
    android: {
      titulo: "Android",
      passos: [
        {
          numero: 1,
          titulo: "Abra o menu do navegador",
          descricao: "Toque nos três pontos verticais no canto superior direito do Chrome.",
          icone: "⋮",
        },
        {
          numero: 2,
          titulo: "Toque em 'Instalar aplicativo'",
          descricao: "No menu, procure a opção 'Instalar aplicativo' ou 'Adicionar à tela inicial'.",
          icone: "📥",
        },
        {
          numero: 3,
          titulo: "Confirme a instalação",
          descricao: "Uma janela de confirmação aparecerá. Toque em 'Instalar' para finalizar.",
          icone: "✓",
        },
      ],
      dica: "Use o navegador Chrome para a melhor experiência no Android.",
    },
    xiaomi: {
      titulo: "Xiaomi/Redmi",
      passos: [
        {
          numero: 1,
          titulo: "Abra o menu do navegador",
          descricao: "Toque nos três pontos verticais no canto superior direito do navegador.",
          icone: "⋮",
        },
        {
          numero: 2,
          titulo: "Toque em 'Adicionar à tela inicial'",
          descricao: "No menu, procure a opção 'Adicionar à tela inicial' ou 'Add to Home Screen'.",
          icone: "📱",
        },
        {
          numero: 3,
          titulo: "Confirme a instalação",
          descricao: "Uma janela de confirmação aparecerá. Toque em 'Adicionar' para finalizar.",
          icone: "✓",
        },
      ],
      dica: "Xiaomi e Redmi funcionam melhor com o navegador Chrome.",
    },
    samsung: {
      titulo: "Samsung",
      passos: [
        {
          numero: 1,
          titulo: "Abra o menu do navegador",
          descricao: "Toque nos três pontos verticais no canto superior direito do Samsung Internet.",
          icone: "⋮",
        },
        {
          numero: 2,
          titulo: "Toque em 'Adicionar página à tela inicial'",
          descricao: "No menu, procure a opção 'Adicionar página à tela inicial'.",
          icone: "📱",
        },
        {
          numero: 3,
          titulo: "Confirme a instalação",
          descricao: "Uma janela de confirmação aparecerá. Toque em 'Adicionar' para finalizar.",
          icone: "✓",
        },
      ],
      dica: "Samsung Internet oferece a melhor experiência em dispositivos Samsung.",
    },
  };

  const info = instrucoes[dispositivo];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50">
      {/* Header */}
      <div className="text-center py-12 px-4">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
            <Smartphone className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-3">Instale o CobraPro</h1>
        <p className="text-lg text-muted-foreground">
          Tenha acesso rápido ao app direto da tela inicial do seu celular
        </p>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-2xl mx-auto px-4 pb-12">
        {/* Seleção de Dispositivo */}
        <Card className="mb-8 border-border/50">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">Como instalar no celular</h2>
            <p className="text-sm text-muted-foreground mb-4">Selecione seu dispositivo e siga as instruções</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(["ios", "android", "xiaomi", "samsung"] as const).map((dev) => (
                <Button
                  key={dev}
                  variant={dispositivo === dev ? "default" : "outline"}
                  className="h-auto py-3 flex flex-col items-center gap-2"
                  onClick={() => setDispositivo(dev)}
                >
                  <span className="text-xl">
                    {dev === "ios" && "🍎"}
                    {dev === "android" && "🤖"}
                    {dev === "xiaomi" && "📱"}
                    {dev === "samsung" && "🔷"}
                  </span>
                  <span className="text-xs text-center">
                    {dev === "ios" && "iPhone/iPad"}
                    {dev === "android" && "Android"}
                    {dev === "xiaomi" && "Xiaomi/Redmi"}
                    {dev === "samsung" && "Samsung"}
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dica */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-8">
          <p className="text-sm">
            <strong>💡 Dica:</strong> {info.dica}
          </p>
        </div>

        {/* Instruções Passo a Passo */}
        <div className="space-y-4">
          {info.passos.map((passo) => (
            <Card key={passo.numero} className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="flex gap-4 p-6">
                  {/* Número do Passo */}
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                      {passo.numero}
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-1">{passo.titulo}</h3>
                    <p className="text-sm text-muted-foreground">{passo.descricao}</p>
                  </div>

                  {/* Ícone */}
                  <div className="flex-shrink-0 text-3xl">{passo.icone}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Confirmação */}
        <Card className="mt-8 border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex gap-3 items-start">
              <Check className="h-6 w-6 text-success flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Pronto!</h3>
                <p className="text-sm text-muted-foreground">
                  Após instalar, você terá acesso rápido ao CobraPro diretamente da sua tela inicial, sem precisar abrir o navegador.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão de Ação */}
        <div className="mt-8 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => window.history.back()}>
            Voltar
          </Button>
          <Button className="flex-1 gap-2" onClick={() => {
            // Trigger install prompt if available
            const event = (window as any).deferredPrompt;
            if (event) {
              event.prompt();
            } else {
              alert("Siga as instruções acima para instalar o app no seu dispositivo.");
            }
          }}>
            <Download className="h-4 w-4" />
            Como instalar
          </Button>
        </div>
      </div>
    </div>
  );
}
