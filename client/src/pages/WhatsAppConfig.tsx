import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Smartphone, Wifi, WifiOff, RefreshCw, QrCode, Settings, Trash2, LogOut, CheckCircle2, AlertCircle, Info } from "lucide-react";

export default function WhatsAppConfig() {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("cobrapro");
  const [showApiKey, setShowApiKey] = useState(false);
  const [qrRefreshKey, setQrRefreshKey] = useState(0);

  const { data: config, refetch: refetchConfig } = trpc.whatsappEvolution.getConfig.useQuery();
  const { data: status, refetch: refetchStatus } = trpc.whatsappEvolution.getStatus.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5 seconds
  });
  const { data: qrData, refetch: refetchQR, isLoading: qrLoading } = trpc.whatsappEvolution.getQRCode.useQuery(undefined, {
    enabled: !!config?.url && !status?.connected,
    refetchInterval: status?.connected ? false : 8000, // Refresh QR every 8 seconds if not connected
  });

  const saveConfig = trpc.whatsappEvolution.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      refetchConfig();
      refetchStatus();
    },
    onError: (e) => toast.error(e.message),
  });

  const createInstance = trpc.whatsappEvolution.createInstance.useMutation({
    onSuccess: () => {
      toast.success("Instância criada! Aguarde o QR Code...");
      setTimeout(() => { refetchQR(); refetchStatus(); }, 2000);
    },
    onError: (e) => toast.error("Erro ao criar instância: " + e.message),
  });

  const disconnect = trpc.whatsappEvolution.disconnect.useMutation({
    onSuccess: () => {
      toast.success("WhatsApp desconectado");
      refetchStatus();
      refetchQR();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteInstance = trpc.whatsappEvolution.deleteInstance.useMutation({
    onSuccess: () => {
      toast.success("Instância deletada");
      refetchStatus();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (config) {
      setUrl(config.url || "");
      setApiKey(config.apiKey || "");
      setInstanceName(config.instanceName || "cobrapro");
    }
  }, [config]);

  const handleSave = () => {
    if (!url || !apiKey || !instanceName) {
      toast.error("Preencha todos os campos");
      return;
    }
    saveConfig.mutate({ url, apiKey, instanceName });
  };

  const handleRefreshQR = () => {
    setQrRefreshKey(k => k + 1);
    refetchQR();
  };

  const isConnected = status?.connected;
  const isConfigured = status?.configured;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-500/10">
          <Smartphone className="w-6 h-6 text-green-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">WhatsApp</h1>
          <p className="text-muted-foreground text-sm">Conecte seu WhatsApp para envio automático de cobranças</p>
        </div>
        <div className="ml-auto">
          {isConnected ? (
            <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Conectado
            </Badge>
          ) : isConfigured ? (
            <Badge variant="destructive" className="gap-1">
              <WifiOff className="w-3 h-3" /> Desconectado
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <AlertCircle className="w-3 h-3" /> Não configurado
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4" />
              Configurações da Evolution API
            </CardTitle>
            <CardDescription>
              Configure sua instância da Evolution API para envio automático de mensagens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL da Evolution API</Label>
              <Input
                placeholder="https://sua-evolution-api.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Ex: https://evolution.seudominio.com</p>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="sua-api-key-aqui"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input
                placeholder="cobrapro"
                value={instanceName}
                onChange={e => setInstanceName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Identificador único da sua instância</p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saveConfig.isPending}
              className="w-full"
            >
              {saveConfig.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>

            {isConfigured && (
              <>
                <Separator />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createInstance.mutate()}
                    disabled={createInstance.isPending}
                    className="flex-1"
                  >
                    <QrCode className="w-4 h-4 mr-1" />
                    {createInstance.isPending ? "Criando..." : "Criar Instância"}
                  </Button>
                  {isConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnect.mutate()}
                      disabled={disconnect.isPending}
                      className="flex-1 text-orange-500 border-orange-500/30"
                    >
                      <LogOut className="w-4 h-4 mr-1" />
                      Desconectar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteInstance.mutate()}
                    disabled={deleteInstance.isPending}
                    className="text-red-500 border-red-500/30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* QR Code / Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="w-4 h-4" />
              {isConnected ? "Status da Conexão" : "Conectar WhatsApp"}
            </CardTitle>
            <CardDescription>
              {isConnected
                ? "Seu WhatsApp está conectado e pronto para enviar mensagens"
                : "Escaneie o QR Code com seu WhatsApp para conectar"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-green-500">WhatsApp Conectado!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Instância: <span className="font-mono">{status?.instanceName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    As cobranças serão enviadas automaticamente via WhatsApp
                  </p>
                </div>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchStatus()}
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Verificar Status
                  </Button>
                </div>
              </div>
            ) : !isConfigured ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <Smartphone className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Configure a Evolution API ao lado para conectar seu WhatsApp
                </p>
              </div>
            ) : qrLoading ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground">Carregando QR Code...</p>
              </div>
            ) : qrData?.qrcode ? (
              <div className="flex flex-col items-center gap-4">
                <div className="p-2 bg-white rounded-lg">
                  <img
                    src={qrData.qrcode.startsWith('data:') ? qrData.qrcode : `data:image/png;base64,${qrData.qrcode}`}
                    alt="QR Code WhatsApp"
                    className="w-48 h-48"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Escaneie com seu WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    Abra o WhatsApp → Dispositivos Conectados → Conectar Dispositivo
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefreshQR} className="w-full">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Atualizar QR Code
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <WifiOff className="w-10 h-10 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Instância desconectada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Clique em "Criar Instância" para gerar o QR Code
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => createInstance.mutate()}
                  disabled={createInstance.isPending}
                  className="w-full"
                >
                  <QrCode className="w-4 h-4 mr-1" />
                  {createInstance.isPending ? "Criando..." : "Gerar QR Code"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instruções */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-blue-400">
            <Info className="w-4 h-4" />
            Como configurar a Evolution API
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>A <strong className="text-foreground">Evolution API</strong> é uma solução open source gratuita para integração com WhatsApp. Para usar:</p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Instale a Evolution API em um servidor (VPS, Railway, Render, etc.)</li>
            <li>Anote a URL e a API Key gerada durante a instalação</li>
            <li>Preencha as configurações ao lado e clique em <strong className="text-foreground">Salvar</strong></li>
            <li>Clique em <strong className="text-foreground">Criar Instância</strong> para gerar o QR Code</li>
            <li>Escaneie o QR Code com seu WhatsApp</li>
            <li>Pronto! As cobranças serão enviadas automaticamente</li>
          </ol>
          <div className="mt-3 p-3 bg-muted rounded-lg">
            <p className="text-xs font-medium text-foreground mb-1">Links úteis:</p>
            <div className="flex flex-wrap gap-2">
              <a href="https://github.com/EvolutionAPI/evolution-api" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                → GitHub Evolution API
              </a>
              <a href="https://railway.com/deploy/evolution-api-4" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                → Deploy no Railway (grátis)
              </a>
              <a href="https://doc.evolution-api.com" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                → Documentação oficial
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
