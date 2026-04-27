import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Smartphone, Wifi, WifiOff, RefreshCw, QrCode, CheckCircle2,
  MessageSquare, Edit2, Save, X, AlertCircle, Clock, Info,
} from "lucide-react";

const TEMPLATE_LABELS: Record<string, { label: string; desc: string; emoji: string }> = {
  cobranca_geral:        { label: "Cobrança Geral",           desc: "Enviada ao cobrar manualmente um cliente",  emoji: "💰" },
  cobranca_vencida:      { label: "Parcela Vencida",          desc: "Enviada para parcelas em atraso",           emoji: "🚨" },
  lembrete_vencimento:   { label: "Lembrete de Vencimento",   desc: "Enviada antes do vencimento da parcela",    emoji: "⏰" },
  confirmacao_pagamento: { label: "Confirmação de Pagamento", desc: "Enviada ao confirmar um pagamento",         emoji: "✅" },
  boas_vindas:           { label: "Boas-vindas",              desc: "Enviada ao cadastrar um novo cliente",      emoji: "👋" },
  pix_transferencia:     { label: "PIX / Transferência",      desc: "Enviada com os dados de pagamento PIX",     emoji: "💳" },
  personalizado:         { label: "Personalizado",            desc: "Template personalizado para uso manual",    emoji: "✏️" },
};

const VARIAVEIS = [
  ["{CLIENTE}", "Nome do cliente"],
  ["{VALOR}", "Valor da parcela"],
  ["{DATA}", "Data de vencimento"],
  ["{PARCELA}", "Número da parcela"],
  ["{DIAS_ATRASO}", "Dias em atraso"],
  ["{DIAS_PARA_VENCER}", "Dias para vencer"],
  ["{PIX}", "Chave PIX"],
  ["{LINK}", "Link de pagamento"],
  ["{ASSINATURA}", "Assinatura"],
  ["{FECHAMENTO}", "Texto de fechamento"],
  ["{PROGRESSO}", "Progresso das parcelas"],
  ["{MULTA}", "Valor da multa"],
  ["{JUROS}", "Valor dos juros"],
  ["{TOTAL}", "Total com juros e multa"],
];

function QRCodeModal({ open, onClose, qrCode, loading, onRefresh, onDisconnect, connected }: {
  open: boolean; onClose: () => void; qrCode?: string | null;
  loading: boolean; onRefresh: () => void; onDisconnect: () => void; connected: boolean;
}) {
  const [seconds, setSeconds] = useState(40);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    setSeconds(40);
    timerRef.current = setInterval(() => {
      setSeconds((s) => { if (s <= 1) { clearInterval(timerRef.current!); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [open, qrCode]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base">Conectar WhatsApp</DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Conecte seu WhatsApp para enviar mensagens aos clientes</p>
        </DialogHeader>
        <div className="p-4 space-y-4">
          {connected ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-green-600 dark:text-green-400">WhatsApp Conectado!</p>
                <p className="text-xs text-muted-foreground mt-1">As mensagens serão enviadas automaticamente</p>
              </div>
              <Button variant="outline" size="sm" onClick={onDisconnect} className="w-full gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10">
                <WifiOff className="h-4 w-4" /> Desconectar WhatsApp
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-primary">
                  <Clock className="h-3.5 w-3.5" /><span>{seconds > 0 ? `${seconds}s restantes` : 'Atualizando QR...'}</span>
                </div>
                <span className="text-muted-foreground">Escaneie com calma</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: `${(seconds / 40) * 100}%` }} />
              </div>
              <div className="flex justify-center">
                {loading ? (
                  <div className="w-48 h-48 bg-muted rounded-xl flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
                  </div>
                ) : qrCode ? (
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-48 h-48" />
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-muted rounded-xl flex flex-col items-center justify-center gap-2">
                    <QrCode className="h-10 w-10 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground text-center px-4">Gerando QR Code...</p>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Importante:</strong> Feche outras sessões do WhatsApp Web antes de escanear.
                </p>
              </div>
              {[
                ["📱", "1. Abra o WhatsApp", "No seu celular"],
                ["🔗", "2. Aparelhos conectados", "Menu ⋮ → Aparelhos conectados"],
                ["🔑", "3. Conectar um aparelho", "Toque em \"Conectar um aparelho\""],
              ].map(([icon, title, desc], i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40">
                  <span className="text-base">{icon}</span>
                  <div><p className="text-xs font-semibold">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                </div>
              ))}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Aguardando conexão...
                </div>
                <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-1.5 text-xs h-8">
                  <RefreshCw className="h-3.5 w-3.5" /> Atualizar QR Code
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ template, onSave }: { template: any; onSave: (id: number, mensagem: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [mensagem, setMensagem] = useState(template.mensagem);
  const info = TEMPLATE_LABELS[template.tipo] ?? { label: template.nome, desc: "", emoji: "💬" };
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{info.emoji}</span>
            <div>
              <CardTitle className="text-sm font-semibold">{info.label}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{info.desc}</CardDescription>
            </div>
          </div>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-8 w-8 p-0 shrink-0">
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {editing ? (
          <>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="min-h-[140px] text-xs font-mono resize-none" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { onSave(template.id, mensagem); setEditing(false); }} className="gap-1.5 flex-1">
                <Save className="h-3.5 w-3.5" /> Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setMensagem(template.mensagem); setEditing(false); }} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
            </div>
          </>
        ) : (
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{template.mensagem}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WhatsAppConfig() {
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const { data: status, refetch: refetchStatus } = trpc.whatsappEvolution.getStatus.useQuery(undefined, { refetchInterval: 5000 });
  const { data: qrData, refetch: refetchQR, isLoading: qrLoading } = trpc.whatsappEvolution.getQRCode.useQuery(undefined, {
    enabled: qrModalOpen && !status?.connected,
    refetchInterval: qrModalOpen && !status?.connected ? 35000 : false,
    staleTime: 0,
    gcTime: 0,
  });
  const { data: templates, refetch: refetchTemplates } = trpc.configuracoes.templates.useQuery();
  const connectWpp = trpc.whatsappEvolution.createInstance.useMutation({
    onSuccess: () => { setTimeout(() => { refetchQR(); refetchStatus(); }, 1500); },
    onError: (e) => toast.error("Erro ao conectar: " + e.message),
  });
  const disconnect = trpc.whatsappEvolution.disconnect.useMutation({
    onSuccess: () => { toast.success("WhatsApp desconectado"); refetchStatus(); setQrModalOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateTemplate = trpc.configuracoes.updateTemplate.useMutation({
    onSuccess: () => { toast.success("Template salvo!"); refetchTemplates(); },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });
  const connected = status?.connected ?? false;
  const handleAbrirQRModal = () => { setQrModalOpen(true); if (!connected) { connectWpp.mutate(); setTimeout(() => refetchQR(), 2000); } };
  const handleRefreshQR = () => { connectWpp.mutate(); setTimeout(() => refetchQR(), 1500); };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Conecte seu WhatsApp para envio automático de cobranças</p>
          </div>
        </div>
        <Badge variant="outline" className={connected ? "border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/10" : "border-muted-foreground/30 text-muted-foreground"}>
          {connected ? <><Wifi className="h-3 w-3 mr-1" />Conectado</> : <><WifiOff className="h-3 w-3 mr-1" />Não Conectado</>}
        </Badge>
      </div>

      <Card className="border-border">
        <CardContent className="p-6">
          {connected ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-lg text-green-600 dark:text-green-400">WhatsApp Conectado!</p>
                <p className="text-sm text-muted-foreground mt-1">As cobranças serão enviadas automaticamente via WhatsApp</p>
              </div>
              <div className="flex gap-3 w-full max-w-xs">
                <Button variant="outline" size="sm" onClick={() => refetchStatus()} className="flex-1 gap-2">
                  <RefreshCw className="h-4 w-4" /> Verificar Status
                </Button>
                <Button variant="outline" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="flex-1 gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10">
                  <WifiOff className="h-4 w-4" /> Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-base">Conecte seu WhatsApp</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Escaneie um QR Code para conectar seu WhatsApp e enviar mensagens diretamente aos seus clientes.
                </p>
              </div>
              <Button onClick={handleAbrirQRModal} disabled={connectWpp.isPending} className="gap-2 px-8">
                <QrCode className="h-4 w-4" />
                {connectWpp.isPending ? "Gerando QR Code..." : "Conectar WhatsApp"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Com o WhatsApp conectado, você poderá enviar notificações de cobrança e comprovantes diretamente para os telefones dos seus clientes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Templates de Mensagens</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Personalize as mensagens enviadas automaticamente para seus clientes. Use as variáveis disponíveis para tornar as mensagens dinâmicas.
        </p>
        <Card className="border-border mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Variáveis disponíveis</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {VARIAVEIS.map(([v, desc]) => (
                <div key={v} className="flex items-center gap-2 text-xs">
                  <code className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs">{v}</code>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {templates && templates.length > 0 ? (
          <div className="space-y-4">
            {templates.map((template: any) => (
              <TemplateCard key={template.id} template={template} onSave={(id, msg) => updateTemplate.mutate({ id, mensagem: msg })} />
            ))}
          </div>
        ) : (
          <Card className="border-border">
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum template encontrado. Os templates serão criados automaticamente.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <QRCodeModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        qrCode={qrData?.qrcode}
        loading={qrLoading || connectWpp.isPending}
        onRefresh={handleRefreshQR}
        onDisconnect={() => disconnect.mutate()}
        connected={connected}
      />
    </div>
  );
}
