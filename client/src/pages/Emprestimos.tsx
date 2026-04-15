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
  TrendingUp, DollarSign, Filter, RefreshCw, FileText, ChevronDown, ChevronUp,
  Edit, Trash2, Send, Phone, Eye, List, Zap
} from "lucide-react";
import { formatarMoeda, formatarData } from "../../../shared/finance";
import { useLocation } from "wouter";

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

// ─── MODAL DE EDIÇÃO DE EMPRÉSTIMO ─────────────────────────────────────────
function EditarEmprestimoModal({
  emprestimo,
  onClose,
  onSuccess,
}: {
  emprestimo: EmprestimoCard;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [valor, setValor] = useState(parseFloat(emprestimo.valorPrincipal));
  const [juros, setJuros] = useState(parseFloat(emprestimo.taxaJuros));
  const [tipo, setTipo] = useState(emprestimo.tipoTaxa);
  const [parcelas, setParcelas] = useState(emprestimo.numeroParcelas);
  const [jurosAplicado, setJurosAplicado] = useState("total");
  const [dataContrato, setDataContrato] = useState(formatarData(emprestimo.dataInicio));
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(
    emprestimo.proximaParcela ? formatarData(emprestimo.proximaParcela.data_vencimento) : ""
  );

  const jurosTotal = valor * (juros / 100);
  const valorParcela = (valor + jurosTotal) / parcelas;
  const totalReceber = valor + jurosTotal;

  const handleSalvar = () => {
    toast.success("Empréstimo atualizado com sucesso!");
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Empréstimo</DialogTitle>
          <DialogDescription>{emprestimo.clienteNome}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cliente */}
          <div>
            <Label className="text-sm font-semibold">Cliente *</Label>
            <div className="mt-2 p-3 rounded-lg border border-border bg-muted/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                {emprestimo.clienteNome.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div className="font-semibold text-sm">{emprestimo.clienteNome}</div>
                <div className="text-xs text-muted-foreground">{emprestimo.clienteWhatsapp}</div>
              </div>
            </div>
          </div>

          {/* Valor e Juros */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={valor}
                onChange={e => setValor(parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Juros (%) *</Label>
              <Input
                type="number"
                step="0.01"
                value={juros}
                onChange={e => setJuros(parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Tipo e Parcelas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Pagamento</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parcelas</Label>
              <Input
                type="number"
                value={parcelas}
                onChange={e => setParcelas(parseInt(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Juros Aplicado */}
          <div>
            <Label>Juros Aplicado</Label>
            <Select value={jurosAplicado} onValueChange={setJurosAplicado}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Sobre o Total</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cálculos */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
            <div>
              <div className="text-xs text-muted-foreground">Juros Total (R$)</div>
              <div className="text-lg font-bold text-emerald-400">{formatarMoeda(jurosTotal)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Valor da Parcela (R$)</div>
              <div className="text-lg font-bold text-emerald-400">{formatarMoeda(valorParcela)}</div>
            </div>
          </div>

          {/* Total a Receber */}
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="text-xs text-muted-foreground">Total a Receber</div>
            <div className="text-2xl font-bold text-emerald-400">{formatarMoeda(totalReceber)}</div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data do Contrato</Label>
              <Input
                type="date"
                value={dataContrato.split('/').reverse().join('-')}
                onChange={e => setDataContrato(e.target.value)}
                className="mt-1"
              />
              <div className="text-xs text-muted-foreground mt-1">Quando foi fechado</div>
            </div>
            <div>
              <Label>1ª Parcela *</Label>
              <Input
                type="date"
                value={dataPrimeiraParcela.split('/').reverse().join('-')}
                onChange={e => setDataPrimeiraParcela(e.target.value)}
                className="mt-1"
              />
              <div className="text-xs text-muted-foreground mt-1">Quando começa a pagar</div>
            </div>
          </div>

          {/* Datas das Parcelas */}
          <div>
            <Label className="text-sm font-semibold">Datas das Parcelas</Label>
            <div className="space-y-2 mt-2">
              {Array.from({ length: parcelas }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground min-w-fit">Parcela {i + 1}:</span>
                  <Input
                    type="date"
                    defaultValue={dataPrimeiraParcela}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSalvar}
            >
              Salvar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const valorTotal = valorOriginal;
  const valorSoJuros = valorJuros > 0 ? valorJuros : valorOriginal * 0.5;

  const parcelaComAtraso = emprestimo.parcelasComAtraso.find(p => p.id === parcela.id);
  const diasAtraso = parcelaComAtraso?.diasAtraso ?? 0;
  const jurosAtraso = parcelaComAtraso?.jurosAtraso ?? 0;
  const totalComAtraso = parcelaComAtraso?.totalComAtraso ?? valorTotal;

  const utils = trpc.useUtils();

  const pagarTotalMutation = trpc.parcelas.registrarPagamento.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado!");
      setOpen(false);
      setTimeout(() => {
        onSuccess();
        utils.contratos.listComParcelas.invalidate();
        utils.dashboard.kpis.invalidate();
      }, 300);
    },
    onError: (e) => {
      toast.error("Erro ao registrar pagamento: " + e.message);
      setOpen(false);
    },
  });

  const pagarJurosMutation = trpc.parcelas.pagarJuros.useMutation({
    onSuccess: () => {
      toast.success("Juros pagos! Empréstimo renovado.");
      setOpen(false);
      setTimeout(() => {
        onSuccess();
        utils.contratos.listComParcelas.invalidate();
        utils.dashboard.kpis.invalidate();
      }, 300);
    },
    onError: (e) => {
      toast.error("Erro ao pagar juros: " + e.message);
      setOpen(false);
    },
  });

  const isPending = pagarTotalMutation.isPending || pagarJurosMutation.isPending;

  const handleConfirmar = () => {
    if (!contaCaixaId) { toast.error("Selecione uma conta"); return; }
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
            <DialogTitle>REGISTRAR PAGAMENTO</DialogTitle>
            <DialogDescription>{emprestimo.clienteNome}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Capital</span>
                <span>{formatarMoeda(emprestimo.valorPrincipal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Juros</span>
                <span className="text-amber-400">{formatarMoeda(valorSoJuros)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span>
                <span className="text-emerald-400">{formatarMoeda(valorTotal)}</span>
              </div>
            </div>

            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as 'total' | 'juros')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Pagar Total</SelectItem>
                  <SelectItem value="juros">Só Juros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Conta de Caixa</Label>
              <Select value={contaCaixaId} onValueChange={setContaCaixaId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={!contaCaixaId || isPending}
                onClick={handleConfirmar}
              >
                {isPending ? "Processando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── CARD DE EMPRÉSTIMO (COBRA FÁCIL STYLE) ────────────────────────────────────
function EmprestimoCardCobra({
  emp,
  contas,
  onRefresh,
}: {
  emp: EmprestimoCard;
  contas: { id: number; nome: string; saldoAtual: number }[];
  onRefresh: () => void;
}) {
  const [, setLocation] = useLocation();
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [showEditarJurosModal, setShowEditarJurosModal] = useState<number | null>(null);
  const [showAplicarMultaModal, setShowAplicarMultaModal] = useState<number | null>(null);
  const [novasTaxaJuros, setNovasTaxaJuros] = useState<string>("");
  const [valorMulta, setValorMulta] = useState<string>("");
  const [motivoMulta, setMotivoMulta] = useState<string>("");
  const utils = trpc.useUtils();

  const editarJurosMutation = trpc.contratos.editarJuros.useMutation({
    onSuccess: () => {
      toast.success("Taxa de juros atualizada!");
      setShowEditarJurosModal(null);
      setNovasTaxaJuros("");
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const aplicarMultaMutation = trpc.contratos.aplicarMulta.useMutation({
    onSuccess: () => {
      toast.success("Multa aplicada com sucesso!");
      setShowAplicarMultaModal(null);
      setValorMulta("");
      setMotivoMulta("");
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deletarMutation = trpc.contratos.deletar.useMutation({
    onSuccess: () => {
      toast.success("Empréstimo deletado");
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const parcela = emp.proximaParcela ?? emp.parcelasComAtraso[0];
  const parcelaComAtraso = emp.parcelasComAtraso.length > 0 ? emp.parcelasComAtraso[0] : null;
  const diasAtraso = parcelaComAtraso?.diasAtraso ?? 0;
  const jurosAtraso = parcelaComAtraso?.jurosAtraso ?? 0;
  const totalComAtraso = parcelaComAtraso?.totalComAtraso ?? 0;

  const initials = emp.clienteNome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'];
  const bgColor = colors[emp.clienteId % colors.length];

  const handleWhatsApp = () => {
    if (!emp.clienteWhatsapp) {
      toast.error("Telefone WhatsApp não cadastrado");
      return;
    }
    const msg = `Olá ${emp.clienteNome}, você tem uma parcela em atraso de ${formatarMoeda(totalComAtraso)}. Favor regularizar.`;
    const url = `https://wa.me/${emp.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <>
      <div className="relative rounded-lg border border-border overflow-hidden bg-gradient-to-br from-red-900/20 via-slate-900 to-cyan-900/20 shadow-lg hover:shadow-xl transition-all">
        {/* Header com nome e status */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-sm`}>
                {initials}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{emp.clienteNome.toUpperCase()}</h3>
                <p className="text-xs text-muted-foreground">{diasAtraso > 0 ? '🔴 Atrasado' : '🟢 Em Dia'}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Badge className={`text-xs ${diasAtraso > 0 ? 'bg-red-600 text-white' : 'bg-cyan-600 text-white'}`}>
                {emp.tipoTaxa?.toUpperCase() || 'MENSAL'}
              </Badge>
            </div>
          </div>

          {/* Valor principal em destaque */}
          <div className="text-center mb-2">
            <div className="text-2xl font-bold text-emerald-400">{formatarMoeda(emp.totalReceber)}</div>
            <div className="text-xs text-muted-foreground">restante a receber</div>
            {diasAtraso > 0 && (
              <div className="text-xs text-red-400 mt-1">contém {formatarMoeda(jurosAtraso)} de juros por atraso</div>
            )}
          </div>
        </div>

        {/* Informações principais */}
        <div className="p-4 space-y-3 border-b border-border/50">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">Emprestado</div>
              <div className="font-semibold text-white">{formatarMoeda(emp.valorPrincipal)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total a Receber</div>
              <div className="font-semibold text-white">{formatarMoeda(emp.totalReceber)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">💰 Lucro Previsto</div>
              <div className="font-semibold text-emerald-400">{formatarMoeda(emp.lucroPrevisto)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">✅ Lucro Realizado</div>
              <div className="font-semibold text-emerald-400">{formatarMoeda(emp.lucroRealizado)} {emp.lucroPrevisto > 0 ? `${Math.round((emp.lucroRealizado / emp.lucroPrevisto) * 100)}%` : '0%'}</div>
            </div>
          </div>

          {/* Vencimento e Pagamento */}
          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-border/30">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Venc:</span>
              <span className="font-semibold">{parcela ? formatarData(parcela.data_vencimento) : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Pago:</span>
              <span className="font-semibold">{formatarMoeda(emp.totalPago)}</span>
            </div>
          </div>

          {/* Só Juros */}
          <div className="p-2 rounded bg-purple-900/30 border border-purple-500/30 text-xs">
            <div className="text-muted-foreground">Só Juros (por parcela):</div>
            <div className="font-semibold text-purple-300">{formatarMoeda(emp.valorJurosParcela)}</div>
          </div>
        </div>

        {/* Informação de atraso (se houver) */}
        {diasAtraso > 0 && parcelaComAtraso && (
          <div className="p-4 bg-red-900/30 border-t border-red-500/30 border-b border-red-500/30 space-y-2">
            <div className="text-sm font-bold text-red-400">Parcela {parcelaComAtraso.numero_parcela}/1 em atraso</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-red-400 font-bold">{diasAtraso} dias</div>
                <div className="text-muted-foreground">Vencimento: {formatarData(parcelaComAtraso.data_vencimento)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Valor: {formatarMoeda(parcelaComAtraso.valor_original)}</div>
              </div>
            </div>
            <div className="text-xs text-red-300 pt-2">
              <div>% Juros (R$ {(jurosAtraso / diasAtraso).toFixed(2)}/dia)</div>
              <div className="font-bold">+{formatarMoeda(jurosAtraso)}</div>
            </div>
            <div className="text-sm font-bold text-red-400 pt-2 border-t border-red-500/30">
              Total com Atraso: {formatarMoeda(totalComAtraso)}
            </div>
          </div>
        )}

        {/* Mensagem de atraso */}
        {diasAtraso > 0 && (
          <div className="p-2 bg-red-900/20 border-t border-red-500/30 text-xs text-red-300 text-center">
            Pague a parcela em atraso para regularizar o empréstimo
          </div>
        )}

        {/* Botões de ação principais */}
        <div className="p-4 space-y-2 border-t border-border/50">
          {diasAtraso > 0 && (
            <>
              <Button
                size="sm"
                className="w-full h-9 text-xs bg-red-700 hover:bg-red-800 text-white gap-1"
                onClick={handleWhatsApp}
              >
                <Send className="h-3.5 w-3.5" />
                Cobrar Atraso (WhatsApp)
              </Button>

              <Button
                size="sm"
                className="w-full h-9 text-xs bg-red-600 hover:bg-red-700 text-white gap-1"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Enviar Cobrança
              </Button>
            </>
          )}

          <PagamentoModal
            emprestimo={emp}
            contas={contas}
            onSuccess={onRefresh}
            triggerClassName="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            triggerLabel="Pagar"
            triggerIcon={<CheckCircle className="h-3.5 w-3.5" />}
          />

          <PagamentoModal
            emprestimo={emp}
            contas={contas}
            onSuccess={onRefresh}
            modoInicial="juros"
            triggerClassName="w-full h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            triggerLabel="Pagar Juros"
            triggerIcon={<DollarSign className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Botões de ação secundários */}
        <div className="p-4 border-t border-border/50 grid grid-cols-6 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title="Editar Juros"
            onClick={() => setShowEditarJurosModal(emp.id)}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title="Aplicar Multa"
            onClick={() => setShowAplicarMultaModal(emp.id)}
          >
            <Zap className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title="Deletar"
            onClick={() => {
              if (confirm('Tem certeza?')) {
                deletarMutation.mutate({ id: emp.id });
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title="Histórico"
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title="Detalhes"
            onClick={() => setLocation(`/emprestimos/${emp.id}`)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            title="Editar"
            onClick={() => setShowEditarModal(true)}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {showEditarModal && (
        <EditarEmprestimoModal
          emprestimo={emp}
          onClose={() => setShowEditarModal(false)}
          onSuccess={onRefresh}
        />
      )}

      {showEditarJurosModal === emp.id && (
        <Dialog open={true} onOpenChange={() => setShowEditarJurosModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Taxa de Juros</DialogTitle>
              <DialogDescription>{emp.clienteNome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Taxa de Juros Atual (%)</Label>
                <Input 
                  type="number" 
                  defaultValue={emp.taxaJuros} 
                  placeholder="Ex: 5"
                  onChange={(e) => setNovasTaxaJuros(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditarJurosModal(null)}>Cancelar</Button>
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700" 
                  onClick={() => {
                    if (!novasTaxaJuros.trim()) {
                      toast.error("Digite a nova taxa de juros");
                      return;
                    }
                    editarJurosMutation.mutate({
                      id: emp.id,
                      novaTaxa: novasTaxaJuros,
                    });
                  }}
                  disabled={editarJurosMutation.isPending}
                >
                  {editarJurosMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showAplicarMultaModal === emp.id && (
        <Dialog open={true} onOpenChange={() => setShowAplicarMultaModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aplicar Multa por Atraso</DialogTitle>
              <DialogDescription>{emp.clienteNome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Valor da Multa (R$)</Label>
                <Input 
                  type="number" 
                  placeholder="Ex: 100.00"
                  value={valorMulta}
                  onChange={(e) => setValorMulta(e.target.value)}
                />
              </div>
              <div>
                <Label>Motivo</Label>
                <Input 
                  type="text" 
                  placeholder="Ex: Atraso de 30 dias"
                  value={motivoMulta}
                  onChange={(e) => setMotivoMulta(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAplicarMultaModal(null)}>Cancelar</Button>
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700" 
                  onClick={() => {
                    if (!valorMulta.trim()) {
                      toast.error("Digite o valor da multa");
                      return;
                    }
                    aplicarMultaMutation.mutate({
                      id: emp.id,
                      multa: valorMulta,
                    });
                  }}
                  disabled={aplicarMultaMutation.isPending}
                >
                  {aplicarMultaMutation.isPending ? "Aplicando..." : "Aplicar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function Emprestimos() {
  const [busca, setBusca] = useState("");
  const [abaSelecionada, setAbaSelecionada] = useState("emprestimos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [, setLocation] = useLocation();

  const { data: emprestimos, isLoading, refetch } = trpc.contratos.listComParcelas.useQuery();
  const { data: contas } = trpc.caixa.contas.useQuery();

  const emprestimosFiltrados = useMemo(() => {
    if (!emprestimos) return [];
    let resultado = emprestimos;

    if (busca) {
      resultado = resultado.filter(e =>
        e.clienteNome.toLowerCase().includes(busca.toLowerCase())
      );
    }

    if (filtroStatus !== 'todos') {
      resultado = resultado.filter(e => {
        const temAtraso = e.parcelasComAtraso.length > 0;
        return filtroStatus === 'atrasados' ? temAtraso : !temAtraso;
      });
    }

    return resultado;
  }, [emprestimos, busca, filtroStatus]);

  const atrasados = emprestimos?.filter(e => e.parcelasComAtraso.length > 0).length ?? 0;
  const emDia = (emprestimos?.length ?? 0) - atrasados;
  const capitalNaRua = emprestimos?.reduce((s, e) => s + parseFloat(e.valorPrincipal), 0) ?? 0;
  const totalReceber = emprestimos?.reduce((s, e) => s + e.totalReceber, 0) ?? 0;

  if (isLoading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Empréstimos</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus empréstimos</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1">
            <Eye className="h-4 w-4" />
            Tutorial
          </Button>
          <Button size="sm" variant="outline" className="gap-1">
            <FileText className="h-4 w-4" />
            Baixar Relatório
          </Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-4 border-b border-border">
        {[
          { id: 'emprestimos', label: 'Empréstimos', count: emprestimos?.length ?? 0 },
          { id: 'diario', label: 'Diário', count: 0 },
          { id: 'price', label: 'Tabela Price', count: 0 },
          { id: 'recebimentos', label: 'Recebimentos', count: 0 },
        ].map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaSelecionada(aba.id)}
            className={`pb-3 px-2 text-sm font-medium transition-all border-b-2 ${
              abaSelecionada === aba.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {aba.label} ({aba.count})
          </button>
        ))}
      </div>

      {/* Filtros e Busca */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="h-4 w-4" />
          Novo Diário
        </Button>

        <Button 
          onClick={() => setLocation('/contratos/novo')}
          className="gap-1 bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Novo Empréstimo
        </Button>

        <Button size="sm" variant="outline" className="gap-1">
          <Filter className="h-4 w-4" />
          Filtros
        </Button>

        <Button size="sm" variant="outline">
          Etiqueta
        </Button>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {emprestimosFiltrados.map(emp => (
          <EmprestimoCardCobra
            key={emp.id}
            emp={emp}
            contas={contas ?? []}
            onRefresh={() => refetch()}
          />
        ))}
      </div>

      {emprestimosFiltrados.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          Nenhum empréstimo encontrado
        </div>
      )}


    </div>
  );
}
