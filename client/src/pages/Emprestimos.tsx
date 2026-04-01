import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, Plus, MessageCircle, CheckCircle, Clock, AlertTriangle,
  TrendingUp, DollarSign, Filter, RefreshCw, FileText, ChevronDown, ChevronUp
} from "lucide-react";
import { formatarMoeda, formatarData } from "../../../shared/finance";
import { useLocation } from "wouter";

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type EmprestimoCard = {
  id: number;
  clienteId: number;
  clienteNome: string;
  clienteWhatsapp: string | null;
  clienteChavePix: string | null;
  modalidade: string;
  status: string;
  valorPrincipal: string;
  valorParcela: string;
  numeroParcelas: number;
  taxaJuros: string;
  tipoTaxa: string;
  dataInicio: string;
  totalReceber: number;
  totalPago: number;
  lucroPrevisto: number;
  lucroRealizado: number;
  valorJurosParcela: number;
  parcelasAbertas: number;
  parcelasAtrasadas: number;
  parcelasPagas: number;
  proximaParcela: {
    id: number;
    numero_parcela: number;
    valor_original: string;
    data_vencimento: string;
    status: string;
  } | null;
  parcelasComAtraso: {
    id: number;
    numero_parcela: number;
    valor_original: string;
    data_vencimento: string;
    status: string;
    diasAtraso: number;
    jurosAtraso: number;
    totalComAtraso: number;
  }[];
  todasParcelas: any[];
};

// ─── MODAL DE PAGAMENTO ───────────────────────────────────────────────────────
function PagamentoModal({
  emprestimo,
  contas,
  onSuccess,
  modoInicial = 'total',
  triggerLabel,
  triggerClassName,
  triggerIcon,
}: {
  emprestimo: EmprestimoCard;
  contas: { id: number; nome: string; saldoAtual: number }[];
  onSuccess: () => void;
  modoInicial?: 'total' | 'juros';
  triggerLabel?: string;
  triggerClassName?: string;
  triggerIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<'total' | 'juros'>(modoInicial);
  const [contaCaixaId, setContaCaixaId] = useState(contas[0]?.id ? String(contas[0].id) : "");
  const [valorCustom, setValorCustom] = useState("");

  const parcela = emprestimo.proximaParcela ?? emprestimo.parcelasComAtraso[0];
  if (!parcela) return null;

  const valorOriginal = parseFloat(String(parcela.valor_original ?? '0'));
  const valorJuros = emprestimo.valorJurosParcela;
  const principal = parseFloat(emprestimo.valorPrincipal);

  // Para bullet loan: total = principal + juros
  const valorTotal = valorOriginal; // valorParcela já inclui principal + juros
  const valorSoJuros = valorJuros > 0 ? valorJuros : valorOriginal * 0.5;

  // Juros por atraso
  const parcelaComAtraso = emprestimo.parcelasComAtraso.find(p => p.id === parcela.id);
  const diasAtraso = parcelaComAtraso?.diasAtraso ?? 0;
  const jurosAtraso = parcelaComAtraso?.jurosAtraso ?? 0;
  const totalComAtraso = parcelaComAtraso?.totalComAtraso ?? valorTotal;

  const utils = trpc.useUtils();

  const pagarTotalMutation = trpc.parcelas.registrarPagamento.useMutation({
    onSuccess: () => {
      toast.success("Pagamento total registrado! Empréstimo quitado.");
      setOpen(false);
      onSuccess();
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const pagarJurosMutation = trpc.parcelas.pagarJuros.useMutation({
    onSuccess: (data) => {
      toast.success(`Juros pagos! Empréstimo renovado até ${formatarData(data.novaDataVencimento)}`);
      setOpen(false);
      onSuccess();
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const isPending = pagarTotalMutation.isPending || pagarJurosMutation.isPending;

  const handleConfirmar = () => {
    if (!contaCaixaId) { toast.error("Selecione uma conta de caixa"); return; }
    const contaId = parseInt(contaCaixaId);

    if (tipo === 'total') {
      const valor = valorCustom ? parseFloat(valorCustom) : (diasAtraso > 0 ? totalComAtraso : valorTotal);
      pagarTotalMutation.mutate({
        parcelaId: parcela.id,
        valorPago: valor,
        contaCaixaId: contaId,
      });
    } else {
      const valor = valorCustom ? parseFloat(valorCustom) : valorSoJuros;
      pagarJurosMutation.mutate({
        parcelaId: parcela.id,
        valorJurosPago: valor,
        contaCaixaId: contaId,
      });
    }
  };

  // Reset tipo when modal opens
  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTipo(modoInicial);
    setValorCustom("");
    setOpen(true);
  };

  return (
    <>
      <Button
        size="sm"
        className={triggerClassName ?? "h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"}
        onClick={handleOpen}
      >
        {triggerIcon ?? <CheckCircle className="h-3.5 w-3.5" />}
        {triggerLabel ?? "Pagar"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-wide">REGISTRAR PAGAMENTO</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {emprestimo.clienteNome} — Empréstimo #{emprestimo.id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Resumo */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capital emprestado</span>
                <span className="font-medium">{formatarMoeda(emprestimo.valorPrincipal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Juros do período</span>
                <span className="font-medium text-amber-400">{formatarMoeda(valorSoJuros)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total (capital + juros)</span>
                <span className="text-emerald-400">{formatarMoeda(valorTotal)}</span>
              </div>
              {diasAtraso > 0 && (
                <div className="flex justify-between text-xs text-red-400">
                  <span>+ Juros atraso ({diasAtraso} dias)</span>
                  <span>+{formatarMoeda(jurosAtraso)}</span>
                </div>
              )}
              {diasAtraso > 0 && (
                <div className="flex justify-between font-bold text-red-400 border-t border-red-400/30 pt-2">
                  <span>Total com atraso</span>
                  <span>{formatarMoeda(totalComAtraso)}</span>
                </div>
              )}
            </div>

            {/* Tipo de pagamento */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tipo de pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    tipo === 'total'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-emerald-500/50'
                  }`}
                  onClick={() => { setTipo('total'); setValorCustom(""); }}
                >
                  <div className="text-lg font-bold">{formatarMoeda(diasAtraso > 0 ? totalComAtraso : valorTotal)}</div>
                  <div className="text-xs mt-0.5">✅ Pagar Total</div>
                  <div className="text-xs opacity-70">Capital + Juros</div>
                </button>
                <button
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                    tipo === 'juros'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-amber-500/50'
                  }`}
                  onClick={() => { setTipo('juros'); setValorCustom(""); }}
                >
                  <div className="text-lg font-bold">{formatarMoeda(valorSoJuros)}</div>
                  <div className="text-xs mt-0.5">💰 Só Juros</div>
                  <div className="text-xs opacity-70">Renova +{emprestimo.tipoTaxa === 'quinzenal' ? '15' : emprestimo.tipoTaxa === 'semanal' ? '7' : emprestimo.tipoTaxa === 'diario' ? '1' : '30'} dias</div>
                </button>
              </div>
            </div>

            {tipo === 'juros' && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                <strong>Renovação automática:</strong> O capital permanece emprestado e uma nova parcela será gerada com vencimento em +{emprestimo.tipoTaxa === 'quinzenal' ? '15' : emprestimo.tipoTaxa === 'semanal' ? '7' : '30'} dias.
              </div>
            )}

            {/* Valor customizado */}
            <div>
              <Label className="text-xs text-muted-foreground">Valor recebido (opcional — sobrescreve o padrão)</Label>
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                placeholder={tipo === 'total' ? (diasAtraso > 0 ? totalComAtraso : valorTotal).toFixed(2) : valorSoJuros.toFixed(2)}
                value={valorCustom}
                onChange={e => setValorCustom(e.target.value)}
              />
            </div>

            {/* Conta de caixa */}
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
                className={`flex-1 ${tipo === 'juros' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white`}
                disabled={!contaCaixaId || isPending}
                onClick={handleConfirmar}
              >
                {isPending ? "Processando..." : tipo === 'total' ? "Confirmar Pagamento" : "Pagar Juros e Renovar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── CARD DE EMPRÉSTIMO ───────────────────────────────────────────────────────
function EmprestimoCardComponent({
  emp,
  contas,
  onRefresh,
}: {
  emp: EmprestimoCard;
  contas: { id: number; nome: string; saldoAtual: number }[];
  onRefresh: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [, setLocation] = useLocation();

  const principal = parseFloat(emp.valorPrincipal);
  const valorJuros = emp.valorJurosParcela;
  const totalReceber = emp.totalReceber;
  const totalPago = emp.totalPago;
  const lucroPrevisto = emp.lucroPrevisto;
  const lucroRealizado = emp.lucroRealizado;
  const percentualLucro = lucroPrevisto > 0 ? Math.round((lucroRealizado / lucroPrevisto) * 100) : 0;

  // Status badge
  const isAtrasado = emp.parcelasAtrasadas > 0;
  const isQuitado = emp.status === 'quitado';
  const modalidadeLabel = {
    quinzenal: 'QUINZENAL',
    mensal: 'MENSAL',
    diario: 'DIÁRIO',
    semanal: 'SEMANAL',
    tabela_price: 'PRICE',
    reparcelamento: 'REPARCEL.',
  }[emp.modalidade] ?? emp.modalidade.toUpperCase();

  // Iniciais do cliente
  const iniciais = emp.clienteNome
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  // Cor do card baseada no status
  const cardBorderColor = isQuitado
    ? 'border-emerald-500/30 bg-emerald-500/5'
    : isAtrasado
    ? 'border-red-500/40 bg-red-500/5'
    : 'border-border bg-card';

  const utils = trpc.useUtils();
  const whatsappMsg = emp.clienteWhatsapp
    ? (() => {
        const parcela = emp.parcelasComAtraso[0] ?? emp.proximaParcela;
        if (!parcela) return null;
        const diasAtraso = (parcela as any).diasAtraso ?? 0;
        const totalComAtraso = (parcela as any).totalComAtraso ?? parseFloat(String(parcela.valor_original));
        const msg = diasAtraso > 0
          ? `⚠️ *Atenção ${emp.clienteNome}*\n🚨 *PARCELA EM ATRASO*\n💵 *Valor:* ${formatarMoeda(String(parcela.valor_original))}\n⏰ *Dias em Atraso:* ${diasAtraso}\n💰 *Total a Pagar:* ${formatarMoeda(totalComAtraso)}\n${emp.clienteChavePix ? `🔑 *PIX:* \`${emp.clienteChavePix}\`` : ''}\n✅ Regularize hoje e evite mais juros!`
          : `🟡 *Olá ${emp.clienteNome}!*\n📅 *SUA PARCELA VENCE HOJE!*\n💵 *Valor:* ${formatarMoeda(String(parcela.valor_original))}\n${emp.clienteChavePix ? `🔑 *PIX:* \`${emp.clienteChavePix}\`` : ''}`;
        return `https://wa.me/55${emp.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
      })()
    : null;

  return (
    <div className={`rounded-xl border ${cardBorderColor} overflow-hidden transition-all`}>
      {/* Header do card */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Avatar + Nome */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              isQuitado ? 'bg-emerald-500/20 text-emerald-400' :
              isAtrasado ? 'bg-red-500/20 text-red-400' :
              'bg-primary/20 text-primary'
            }`}>
              {iniciais}
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm leading-tight">{emp.clienteNome}</div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  isQuitado ? 'bg-emerald-500/20 text-emerald-400' :
                  isAtrasado ? 'bg-red-500/20 text-red-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {isQuitado ? 'QUITADO' : isAtrasado ? 'ATRASADO' : 'EM DIA'}
                </span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {modalidadeLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Valor principal */}
          <div className="text-right">
            <div className={`text-xl font-bold ${
              isQuitado ? 'text-emerald-400' :
              isAtrasado ? 'text-red-400' :
              'text-foreground'
            }`}>
              {formatarMoeda(totalReceber > 0 ? totalReceber : parseFloat(emp.valorParcela))}
            </div>
            <div className="text-xs text-muted-foreground">restante a receber</div>
            {emp.parcelasComAtraso.length > 0 && emp.parcelasComAtraso[0].jurosAtraso > 0 && (
              <div className="text-xs text-red-400">
                contém {formatarMoeda(emp.parcelasComAtraso[0].jurosAtraso)} de juros por atraso
              </div>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div>
            <span className="text-muted-foreground">Emprestado</span>
            <div className="font-semibold text-foreground">{formatarMoeda(emp.valorPrincipal)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Total a Receber</span>
            <div className="font-semibold text-foreground">{formatarMoeda(parseFloat(emp.valorParcela))}</div>
          </div>
          <div>
            <span className="text-muted-foreground">💰 Lucro Previsto</span>
            <div className="font-semibold text-amber-400">{formatarMoeda(valorJuros)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">✅ Lucro Realizado</span>
            <div className="font-semibold text-emerald-400">
              {formatarMoeda(lucroRealizado)} <span className="text-muted-foreground">{percentualLucro}%</span>
            </div>
          </div>
        </div>

        {/* Vencimento e Pago */}
        {emp.proximaParcela && (
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>📅 Venc: {formatarData(emp.proximaParcela.data_vencimento)}</span>
            <span>💵 Pago: {formatarMoeda(totalPago)}</span>
          </div>
        )}

        {/* Só Juros */}
        <div className="mt-2 text-xs">
          <span className="text-muted-foreground">Só Juros (por parcela):</span>
          <span className="font-semibold text-amber-400 ml-1">{formatarMoeda(valorJuros)}</span>
        </div>
      </div>

      {/* Parcelas em atraso */}
      {emp.parcelasComAtraso.length > 0 && (
        <div className="border-t border-red-500/20 bg-red-500/5 p-4 space-y-3">
          {emp.parcelasComAtraso.map(p => (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-red-400">
                  Parcela {p.numero_parcela}/{emp.numeroParcelas} em atraso
                </span>
                <span className="font-bold text-red-400">{p.diasAtraso} dias</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Vencimento:</span>
                  <span className="ml-1 text-foreground">{formatarData(p.data_vencimento)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="ml-1 text-foreground">{formatarMoeda(p.valor_original)}</span>
                </div>
              </div>
              {p.jurosAtraso > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">% Juros (R$ 100,00/dia)</span>
                  <span className="text-red-400 font-medium">+{formatarMoeda(p.jurosAtraso)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-red-500/20 pt-1.5">
                <span className="text-foreground">Total com Atraso:</span>
                <span className="text-red-400">{formatarMoeda(p.totalComAtraso)}</span>
              </div>
            </div>
          ))}

          <div className="text-xs text-muted-foreground italic">
            Pague a parcela em atraso para regularizar o empréstimo
          </div>
        </div>
      )}

      {/* Barra de ações */}
      <div className="border-t border-border p-3 flex items-center gap-2 flex-wrap">
        {!isQuitado && (
          <PagamentoModal
            emprestimo={emp}
            contas={contas}
            onSuccess={onRefresh}
          />
        )}

        {!isQuitado && (
          <PagamentoModal
            emprestimo={emp}
            contas={contas}
            onSuccess={onRefresh}
            modoInicial="juros"
            triggerLabel="Pagar Juros"
            triggerClassName="h-8 text-xs border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1 inline-flex items-center justify-center rounded-md px-3 font-medium transition-colors"
            triggerIcon={<RefreshCw className="h-3.5 w-3.5" />}
          />
        )}

        {whatsappUrl(emp) && (
          <a href={whatsappUrl(emp)!} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </Button>
          </a>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={(e) => { e.stopPropagation(); setExpandido(!expandido); }}
        >
          <FileText className="h-3.5 w-3.5" />
          Histórico
          {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={(e) => { e.stopPropagation(); setLocation(`/contratos/novo?clienteId=${emp.clienteId}`); }}
        >
          <Plus className="h-3.5 w-3.5" />
          Novo
        </Button>
      </div>

      {/* Histórico expandido */}
      {expandido && (
        <div className="border-t border-border p-4">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">HISTÓRICO DE PARCELAS</h4>
          <div className="space-y-1.5">
            {emp.todasParcelas.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Parcela {p.numero_parcela} — {formatarData(p.data_vencimento)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{formatarMoeda(p.valor_original)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    p.status === 'paga' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.status === 'atrasada' ? 'bg-red-500/20 text-red-400' :
                    p.status === 'vencendo_hoje' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {p.status === 'paga' ? 'Paga' :
                     p.status === 'atrasada' ? 'Atrasada' :
                     p.status === 'vencendo_hoje' ? 'Vence Hoje' : 'Pendente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper para URL do WhatsApp
function whatsappUrl(emp: EmprestimoCard): string | null {
  if (!emp.clienteWhatsapp) return null;
  const parcela = emp.parcelasComAtraso[0] ?? emp.proximaParcela;
  if (!parcela) return null;
  const diasAtraso = (parcela as any).diasAtraso ?? 0;
  const totalComAtraso = (parcela as any).totalComAtraso ?? parseFloat(String(parcela.valor_original));
  const msg = diasAtraso > 0
    ? `⚠️ *Atenção ${emp.clienteNome}*\n🚨 *PARCELA EM ATRASO*\n💵 *Valor:* ${formatarMoeda(String(parcela.valor_original))}\n⏰ *Dias em Atraso:* ${diasAtraso}\n💰 *Total a Pagar:* ${formatarMoeda(totalComAtraso)}\n${emp.clienteChavePix ? `🔑 *PIX:* \`${emp.clienteChavePix}\`` : ''}\n✅ Regularize hoje e evite mais juros!`
    : `🟡 *Olá ${emp.clienteNome}!*\n📅 *SUA PARCELA VENCE HOJE!*\n💵 *Valor:* ${formatarMoeda(String(parcela.valor_original))}\n${emp.clienteChavePix ? `🔑 *PIX:* \`${emp.clienteChavePix}\`` : ''}`;
  return `https://wa.me/55${emp.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function Emprestimos() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [, setLocation] = useLocation();

  const { data: emprestimos, isLoading, refetch } = trpc.contratos.listComParcelas.useQuery({
    status: filtroStatus !== 'todos' ? filtroStatus : undefined,
    busca: busca || undefined,
  });

  const { data: contas } = trpc.caixa.contas.useQuery();

  const contasFormatadas = (contas ?? []).map(c => ({
    id: c.id,
    nome: c.nome,
    saldoAtual: typeof c.saldoAtual === 'number' ? c.saldoAtual : parseFloat(String(c.saldoAtual ?? '0')),
  }));

  // Estatísticas
  const stats = useMemo(() => {
    if (!emprestimos) return { total: 0, atrasados: 0, emDia: 0, quitados: 0, capitalRua: 0, totalReceber: 0 };
    return {
      total: emprestimos.length,
      atrasados: emprestimos.filter(e => e.parcelasAtrasadas > 0 && e.status !== 'quitado').length,
      emDia: emprestimos.filter(e => e.parcelasAtrasadas === 0 && e.status === 'ativo').length,
      quitados: emprestimos.filter(e => e.status === 'quitado').length,
      capitalRua: emprestimos.filter(e => e.status === 'ativo').reduce((s, e) => s + parseFloat(e.valorPrincipal), 0),
      totalReceber: emprestimos.filter(e => e.status === 'ativo').reduce((s, e) => s + e.totalReceber, 0),
    };
  }, [emprestimos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">EMPRÉSTIMOS</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} empréstimos · {stats.atrasados} atrasados
          </p>
        </div>
        <Button
          className="gap-2 bg-primary hover:bg-primary/90"
          onClick={() => setLocation('/contratos/novo')}
        >
          <Plus className="h-4 w-4" />
          Novo Empréstimo
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          className={`p-3 rounded-lg border text-left transition-all hover:opacity-80 ${
            filtroStatus === 'atrasado' ? 'ring-2 ring-red-500' : ''
          } border-red-500/30 bg-red-500/5`}
          onClick={() => setFiltroStatus(filtroStatus === 'atrasado' ? 'todos' : 'atrasado')}
        >
          <div className="text-2xl font-bold text-red-400">{stats.atrasados}</div>
          <div className="text-xs text-muted-foreground">Atrasados</div>
        </button>
        <button
          className={`p-3 rounded-lg border text-left transition-all hover:opacity-80 ${
            filtroStatus === 'ativo' ? 'ring-2 ring-blue-500' : ''
          } border-blue-500/30 bg-blue-500/5`}
          onClick={() => setFiltroStatus(filtroStatus === 'ativo' ? 'todos' : 'ativo')}
        >
          <div className="text-2xl font-bold text-blue-400">{stats.emDia}</div>
          <div className="text-xs text-muted-foreground">Em Dia</div>
        </button>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-lg font-bold text-foreground">{formatarMoeda(stats.capitalRua)}</div>
          <div className="text-xs text-muted-foreground">Capital na Rua</div>
        </div>
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
          <div className="text-lg font-bold text-emerald-400">{formatarMoeda(stats.totalReceber)}</div>
          <div className="text-xs text-muted-foreground">Total a Receber</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="quitado">Quitados</SelectItem>
            <SelectItem value="inadimplente">Inadimplentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card animate-pulse h-64" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!emprestimos || emprestimos.length === 0) && (
        <div className="text-center py-16">
          <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">Nenhum empréstimo encontrado</p>
          <Button className="mt-4 gap-2" onClick={() => setLocation('/contratos/novo')}>
            <Plus className="h-4 w-4" />
            Criar primeiro empréstimo
          </Button>
        </div>
      )}

      {/* Grid de cards com agrupamento por cliente */}
      {!isLoading && emprestimos && emprestimos.length > 0 && (() => {
        // Agrupar empréstimos por cliente
        const agrupadosPorCliente = emprestimos.reduce((acc: Record<number, any[]>, emp: any) => {
          if (!acc[emp.clienteId]) acc[emp.clienteId] = [];
          acc[emp.clienteId].push(emp);
          return acc;
        }, {});
        
        return (
          <div className="space-y-4">
            {Object.entries(agrupadosPorCliente).map(([clienteId, emps]) => {
              const cliente = (emps[0] as any).clienteNome;
              const totalCapital = emps.reduce((s: number, e: any) => s + parseFloat(e.valorPrincipal), 0);
              const totalReceber = emps.reduce((s: number, e: any) => s + e.totalReceber, 0);
              const totalAtrasado = emps.filter((e: any) => e.parcelasComAtraso.length > 0).length;
              
              return (
                <div key={clienteId} className="space-y-2">
                  {/* Card da Pasta do Cliente */}
                  <div className="p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{cliente}</h3>
                        <div className="grid grid-cols-3 gap-4 mt-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Capital:</span>
                            <div className="font-bold text-foreground">{formatarMoeda(totalCapital)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">A Receber:</span>
                            <div className="font-bold text-emerald-400">{formatarMoeda(totalReceber)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Empréstimos:</span>
                            <div className="font-bold text-foreground">{emps.length}</div>
                          </div>
                        </div>
                      </div>
                      {totalAtrasado > 0 && (
                        <div className="text-right">
                          <Badge variant="destructive">{totalAtrasado} Atrasado</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Cards dos empréstimos do cliente */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-2">
                    {emps.map((emp: any) => (
                      <EmprestimoCardComponent
                        key={emp.id}
                        emp={emp as EmprestimoCard}
                        contas={contasFormatadas}
                        onRefresh={refetch}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
