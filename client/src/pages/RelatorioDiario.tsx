import { useTranslation } from 'react-i18next';
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageSquare, Clock, Send, Eye, CheckCircle2, AlertCircle,
  BarChart3, Smartphone, RefreshCw
} from "lucide-react";

export default function RelatorioDiario() {
  const { t } = useTranslation();
  const [ativo, setAtivo] = useState(false);
  const [horario, setHorario] = useState("08:00");
  const [telefone, setTelefone] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const { data: config, isLoading: loadingConfig } = trpc.relatorioDiario.getConfig.useQuery();
  const { data: preview, isLoading: loadingPreview, refetch: refetchPreview } = trpc.relatorioDiario.preview.useQuery(
    undefined,
    { enabled: showPreview }
  );

  const saveConfig = trpc.relatorioDiario.saveConfig.useMutation({
    onSuccess: () => toast.success("Configurações salvas com sucesso!"),
    onError: (e) => toast.error(e.message),
  });

  const enviarAgora = trpc.relatorioDiario.enviarAgora.useMutation({
    onSuccess: () => toast.success("Relatório enviado com sucesso! Verifique seu WhatsApp."),
    onError: (e) => toast.error(e.message),
  });

  const { data: wppStatus } = trpc.whatsappEvolution.getStatus.useQuery();

  useEffect(() => {
    if (config) {
      setAtivo(config.ativo);
      setHorario(config.horario);
      setTelefone(config.telefone);
    }
  }, [config]);

  const handleSave = () => {
    saveConfig.mutate({ ativo, horario, telefone });
  };

  const handleEnviarAgora = () => {
    if (!telefone) {
      toast.error("Configure o número de telefone primeiro");
      return;
    }
    if (!wppStatus?.connected) {
      toast.error("WhatsApp não está conectado. Vá em Meu Perfil para conectar.");
      return;
    }
    enviarAgora.mutate({ telefone });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Relatório Diário
          </h1>
          <p className="text-muted-foreground mt-1">
            Receba um resumo diário das suas cobranças diretamente no WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-2">
          {wppStatus?.connected ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              WhatsApp Conectado
            </Badge>
          ) : (
            <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
              <AlertCircle className="w-3 h-3 mr-1" />
              WhatsApp Desconectado
            </Badge>
          )}
        </div>
      </div>

      {/* Aviso se WhatsApp não conectado */}
      {!wppStatus?.connected && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-300">WhatsApp não conectado</p>
                <p className="text-xs text-yellow-400/80 mt-0.5">
                  Para enviar relatórios automáticos, conecte seu WhatsApp em{" "}
                  <a href="/perfil" className="underline">Meu Perfil</a>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-primary" />
              Configurações do Relatório
            </CardTitle>
            <CardDescription>
              Defina quando e para qual número enviar o relatório diário
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Ativar/Desativar */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
              <div>
                <p className="text-sm font-medium">Relatório Automático</p>
                <p className="text-xs text-muted-foreground">Enviar relatório diariamente no horário configurado</p>
              </div>
              <Switch
                checked={ativo}
                onCheckedChange={setAtivo}
                disabled={loadingConfig}
              />
            </div>

            {/* Horário */}
            <div className="space-y-2">
              <Label htmlFor="horario" className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Horário de Envio
              </Label>
              <Input
                id="horario"
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                O relatório será enviado todos os dias neste horário
              </p>
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="telefone" className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                Número para Receber
              </Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Número que receberá o relatório diário (com DDD)
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={saveConfig.isPending}
                className="flex-1"
              >
                {saveConfig.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Salvar Configurações
              </Button>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Envio Manual</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setShowPreview(true); refetchPreview(); }}
                  className="flex-1"
                  disabled={loadingPreview}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Visualizar
                </Button>
                <Button
                  onClick={handleEnviarAgora}
                  disabled={enviarAgora.isPending || !wppStatus?.connected}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {enviarAgora.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Enviar Agora
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview da mensagem */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-green-400" />
              Preview da Mensagem
            </CardTitle>
            <CardDescription>
              Visualize como o relatório aparecerá no WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showPreview ? (
              <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Visualize o relatório</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Clique em "Visualizar" para ver como a mensagem ficará
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowPreview(true); refetchPreview(); }}
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Ver Preview
                </Button>
              </div>
            ) : loadingPreview ? (
              <div className="flex items-center justify-center h-48">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="relative">
                {/* Simulação de balão do WhatsApp */}
                <div className="bg-[#1a1a1a] rounded-xl p-1 border border-border">
                  <div className="bg-[#0d1117] rounded-lg p-3 max-h-96 overflow-y-auto">
                    <div className="bg-[#005c4b] rounded-lg rounded-tl-none p-3 max-w-[90%] ml-auto">
                      <pre className="text-xs text-white whitespace-pre-wrap font-sans leading-relaxed">
                        {preview?.mensagem || "Sem dados para exibir"}
                      </pre>
                      <div className="text-right mt-1">
                        <span className="text-[10px] text-green-300/60">
                          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full text-xs"
                  onClick={() => refetchPreview()}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Atualizar Preview
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info sobre o conteúdo */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">O que está incluído no relatório</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2">
                {[
                  "Parcelas vencendo hoje",
                  "Parcelas em atraso",
                  "Total a cobrar no dia",
                  "Clientes ativos",
                  "Empréstimos ativos",
                  "Capital na rua",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
