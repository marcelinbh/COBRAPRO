import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, MessageCircle, CheckCircle, Clock, AlertTriangle, Filter
} from "lucide-react";
import { formatarMoeda, formatarData, calcularJurosMora } from "../../../shared/finance";

// Templates padrão (mesmos do Cobra Fácil)
const TEMPLATE_ATRASO = `⚠️ *Atenção {CLIENTE}* ━━━━━━━━━━━━━━━━
🚨 *PARCELA EM ATRASO*
💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA}
⏰ *Dias em Atraso:* {DIAS_ATRASO}
💸 *Multa:* {MULTA}
💸 *Juros:* {JUROS}
💰 *Total a Pagar:* {TOTAL}
{PIX}
{FECHAMENTO}
{ASSINATURA}`;

const TEMPLATE_VENCE_HOJE = `🟡 *Olá {CLIENTE}!* ━━━━━━━━━━━━━━━━
📅 *SUA PARCELA VENCE HOJE!*
💵 *Valor:* {VALOR}
📊 *{PARCELA}*
⏰ *Vencimento:* {DATA}
{PIX}
{FECHAMENTO}
{ASSINATURA}`;

const TEMPLATE_ANTECIPADA = `🟢 *Olá {CLIENTE}!* ━━━━━━━━━━━━━━━━
📋 *LEMBRETE DE PARCELA*
💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA}
⏳ *Faltam:* {DIAS_PARA_VENCER} dias
{PIX}
{FECHAMENTO}
{ASSINATURA}`;

function gerarMensagemCobranca(
  nome: string,
  numeroParcela: number,
  numeroParcelas: number,
  valorOriginal: string,
  dataVencimento: Date,
  diasAtraso: number,
  juros: number,
  multa: number,
  total: number,
  chavePix: string | null,
  assinatura = '',
  fechamento = 'Regularize hoje e evite mais juros!'
): string {
  const hoje = new Date();
  const diasParaVencer = Math.max(0, Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
  let template = TEMPLATE_ANTECIPADA;
  if (diasAtraso > 0) template = TEMPLATE_ATRASO;
  else if (diasAtraso === 0) template = TEMPLATE_VENCE_HOJE;
  const pixMsg = chavePix ? `🔑 *PIX:* \`${chavePix}\`` : '';
  return template
    .replace(/{CLIENTE}/g, nome)
    .replace(/{VALOR}/g, formatarMoeda(valorOriginal))
    .replace(/{PARCELA}/g, `Parcela ${numeroParcela}/${numeroParcelas}`)
    .replace(/{DATA}/g, formatarData(dataVencimento))
    .replace(/{DIAS_ATRASO}/g, String(diasAtraso))
    .replace(/{DIAS_PARA_VENCER}/g, String(diasParaVencer))
    .replace(/{MULTA}/g, formatarMoeda(multa))
    .replace(/{JUROS}/g, formatarMoeda(juros))
    .replace(/{JUROS_MULTA}/g, formatarMoeda(juros + multa))
    .replace(/{TOTAL}/g, formatarMoeda(total))
    .replace(/{JUROS_CONTRATO}/g, '')
    .replace(/{PROGRESSO}/g, '')
    .replace(/{PARCELAS_STATUS}/g, '')
    .replace(/{PIX}/g, pixMsg)
    .replace(/{ASSINATURA}/g, assinatura ? `💼 *${assinatura}*` : '')
    .replace(/{FECHAMENTO}/g, fechamento ? `✅ ${fechamento}` : '')
    .trim();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    paga: { label: "Paga", className: "bg-success/15 text-success border-success/30", icon: CheckCircle },
    pendente: { label: "Pendente", className: "bg-muted text-muted-foreground border-border", icon: Clock },
    atrasada: { label: "Atrasada", className: "bg-primary/15 text-primary border-primary/30", icon: AlertTriangle },
    vencendo_hoje: { label: "Vence Hoje", className: "bg-warning/15 text-warning border-warning/30", icon: Clock },
    parcial: { label: "Parcial", className: "bg-warning/15 text-warning border-warning/30", icon: Clock },
  };
  const s = map[status] ?? map.pendente;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.className}`}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

type ParcelaRow = {
  id: number;
  contratoId: number;
  clienteId: number;
  clienteNome: string;
  clienteWhatsapp: string | null;
  clienteChavePix: string | null;
  numeroParcela: number;
  valorOriginal: string;
  valorPago: string | null;
  valorJuros: string | null;
  valorMulta: string | null;
  dataVencimento: Date;
  dataPagamento: Date | null;
  status: string;
  modalidade: string;
  numeroParcelas: number;
  taxaJuros?: string | null;
  tipoTaxa?: string | null;
  valorPrincipalContrato?: string | null;
};

function PagamentoDialog({
  parcela,
  contas,
  onSuccess,
}: {
  parcela: ParcelaRow;
  contas: { id: number; nome: string; saldoAtual: number }[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [valorPago, setValorPago] = useState("");
  const [contaCaixaId, setContaCaixaId] = useState("");
  const [desconto, setDesconto] = useState("0");

  const { juros, multa, total, diasAtraso } = calcularJurosMora(
    parseFloat(parcela.valorOriginal),
    new Date(parcela.dataVencimento),
    new Date()
  );

  // Calcular valor dos juros do período (taxa do contrato)
  const valorOriginal = parseFloat(parcela.valorOriginal);
  // Para juros simples: juros = principal * (taxa/100)
  // valorParcela = principal/n + principal * taxa/100
  // Então: jurosParcela = valorParcela - principal/n
  const principalContrato = parcela.valorPrincipalContrato ? parseFloat(parcela.valorPrincipalContrato) : 0;
  const nParcelas = parcela.numeroParcelas || 1;
  const amortizacao = principalContrato > 0 ? principalContrato / nParcelas : 0;
  const jurosParcela = principalContrato > 0 ? Math.max(0, valorOriginal - amortizacao) : valorOriginal * 0.5;
  // taxa real do contrato
  const taxaContrato = parcela.taxaJuros ? parseFloat(parcela.taxaJuros) : 0;

  const utils = trpc.useUtils();
  const pagarMutation = trpc.parcelas.registrarPagamento.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso!");
      setOpen(false);
      onSuccess();
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return (
    <>
      <Button
        size="sm"
        className="gap-1 h-7 text-xs"
        onClick={(e) => { e.stopPropagation(); setValorPago(total.toFixed(2)); setOpen(true); }}
      >
        <CheckCircle className="h-3 w-3" />
        Pagar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-wide">REGISTRAR PAGAMENTO</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-4 rounded-lg bg-muted border border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="text-foreground font-medium">{parcela.clienteNome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Parcela</span>
                <span className="text-foreground">{parcela.numeroParcela}/{parcela.numeroParcelas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Original</span>
                <span className="text-foreground">{formatarMoeda(parcela.valorOriginal)}</span>
              </div>
              {diasAtraso > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Multa ({diasAtraso} dias)</span>
                    <span className="text-warning">{formatarMoeda(multa)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Juros Mora</span>
                    <span className="text-warning">{formatarMoeda(juros)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                    <span className="text-foreground">Total Atualizado</span>
                    <span className="text-primary">{formatarMoeda(total)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Botões rápidos */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Atalhos de pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => setValorPago(total.toFixed(2))}
                >
                  ✅ Pagar Total ({formatarMoeda(total)})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => setValorPago(jurosParcela.toFixed(2))}
                >
                  💰 Só Juros ({formatarMoeda(jurosParcela)})
                </Button>
              </div>
            </div>

            <div>
              <Label>Valor Recebido (R$) *</Label>
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={valorPago}
                onChange={e => setValorPago(e.target.value)}
              />
            </div>

            <div>
              <Label>Desconto (R$)</Label>
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={desconto}
                onChange={e => setDesconto(e.target.value)}
              />
            </div>

            <div>
              <Label>Conta de Caixa *</Label>
              <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome} — {formatarMoeda(c.saldoAtual)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                className="flex-1"
                disabled={!valorPago || !contaCaixaId || pagarMutation.isPending}
                onClick={() => pagarMutation.mutate({
                  parcelaId: parcela.id,
                  valorPago: parseFloat(valorPago),
                  contaCaixaId: parseInt(contaCaixaId),
                  desconto: parseFloat(desconto),
                })}
              >
                {pagarMutation.isPending ? "Salvando..." : "Confirmar Pagamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Parcelas() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const { data: parcelas, isLoading, refetch } = trpc.parcelas.list.useQuery({
    status: filtroStatus !== "todos" ? filtroStatus : undefined,
  });
  const { data: contas } = trpc.caixa.contas.useQuery();
  const { data: configData } = trpc.configuracoes.get.useQuery();

  const filtradas = parcelas?.filter(p =>
    !busca || p.clienteNome.toLowerCase().includes(busca.toLowerCase())
  );

  const statusCount = {
    atrasada: parcelas?.filter(p => p.status === 'atrasada').length ?? 0,
    vencendo_hoje: parcelas?.filter(p => p.status === 'vencendo_hoje').length ?? 0,
    pendente: parcelas?.filter(p => p.status === 'pendente').length ?? 0,
    paga: parcelas?.filter(p => p.status === 'paga').length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">PARCELAS</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtradas?.length ?? 0} parcelas</p>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "atrasada", label: "Atrasadas", color: "border-primary/30 bg-primary/5", textColor: "text-primary" },
          { key: "vencendo_hoje", label: "Vence Hoje", color: "border-warning/30 bg-warning/5", textColor: "text-warning" },
          { key: "pendente", label: "Pendentes", color: "border-border bg-muted/30", textColor: "text-foreground" },
          { key: "paga", label: "Pagas", color: "border-success/30 bg-success/5", textColor: "text-success" },
        ].map(s => (
          <button
            key={s.key}
            className={`p-3 rounded-lg border ${s.color} text-left transition-all hover:opacity-80 ${filtroStatus === s.key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFiltroStatus(filtroStatus === s.key ? "todos" : s.key)}
          >
            <div className={`font-display text-2xl ${s.textColor}`}>{statusCount[s.key as keyof typeof statusCount]}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="atrasada">Atrasadas</SelectItem>
            <SelectItem value="vencendo_hoje">Vence Hoje</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="paga">Pagas</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="border-border animate-pulse">
              <CardContent className="p-4 h-16" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filtradas?.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma parcela encontrada</p>
        </div>
      )}

      <div className="space-y-2">
        {filtradas?.map(parcela => {
          const { total: totalAtualizado, diasAtraso } = calcularJurosMora(
            parseFloat(parcela.valorOriginal),
            new Date(parcela.dataVencimento),
            new Date()
          );
          const { juros: jurosCalc, multa: multaCalc } = calcularJurosMora(
            parseFloat(parcela.valorOriginal),
            new Date(parcela.dataVencimento),
            new Date()
          );
          const mensagem = gerarMensagemCobranca(
            parcela.clienteNome,
            parcela.numeroParcela,
            parcela.numeroParcelas,
            parcela.valorOriginal,
            new Date(parcela.dataVencimento),
            diasAtraso,
            jurosCalc,
            multaCalc,
            totalAtualizado,
            parcela.clienteChavePix,
            configData?.assinaturaWhatsapp ?? '',
            configData?.fechamentoWhatsapp ?? 'Regularize hoje e evite mais juros!'
          );
          const whatsappUrl = parcela.clienteWhatsapp
            ? `https://wa.me/55${parcela.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`
            : null;

          return (
            <Card
              key={parcela.id}
              className={`border transition-all ${
                parcela.status === 'atrasada' ? 'border-primary/20 bg-primary/3' :
                parcela.status === 'vencendo_hoje' ? 'border-warning/20 bg-warning/3' :
                parcela.status === 'paga' ? 'border-success/10 opacity-60' :
                'border-border'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm">{parcela.clienteNome}</span>
                        <StatusBadge status={parcela.status} />
                        {diasAtraso > 0 && (
                          <span className="text-xs text-primary">+{diasAtraso} dias</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Parcela {parcela.numeroParcela}/{parcela.numeroParcelas} · Vence: {formatarData(parcela.dataVencimento)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className={`font-semibold text-sm ${diasAtraso > 0 ? 'text-primary' : 'text-foreground'}`}>
                        {diasAtraso > 0 ? formatarMoeda(totalAtualizado) : formatarMoeda(parcela.valorOriginal)}
                      </div>
                      {diasAtraso > 0 && (
                        <div className="text-xs text-muted-foreground line-through">{formatarMoeda(parcela.valorOriginal)}</div>
                      )}
                    </div>

                    {parcela.status !== 'paga' && (
                      <div className="flex gap-2">
                        {whatsappUrl && (
                          <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs border-success/30 text-success hover:bg-success/10">
                              <MessageCircle className="h-3 w-3" />
                              <span className="hidden sm:inline">Cobrar</span>
                            </Button>
                          </a>
                        )}
                        <PagamentoDialog
                          parcela={parcela as any}
                          contas={contas ?? []}
                          onSuccess={() => refetch()}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
