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
  Edit, Trash2, Send, Phone, Eye, List, Zap, Users, ExternalLink, Loader2, Tag, X, Check, FolderOpen, LayoutGrid, Download
} from "lucide-react";
import { formatarMoeda, formatarData } from "../../../shared/finance";
import { gerarComprovantePDF } from "@/lib/gerarComprovante";
import { useLocation } from "wouter";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { EmprestimoDetalhesModal } from "@/components/EmprestimoDetalhesModal";

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
  etiquetas?: string[];
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
  // Estado para criar nova parcela
  const [novaParcelaData, setNovaParcelaData] = useState("");
  const [novaParcelaValor, setNovaParcelaValor] = useState("");
  const [showNovaParcela, setShowNovaParcela] = useState(false);

  const jurosTotal = valor * (juros / 100);
  const valorParcela = (valor + jurosTotal) / parcelas;
  const totalReceber = valor + jurosTotal;

  const utils = trpc.useUtils();
  const editarMutation = trpc.contratos.editar.useMutation({
    onSuccess: () => {
      toast.success('Empréstimo atualizado com sucesso!');
      utils.contratos.list.invalidate();
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
      onSuccess();
      onClose();
    },
    onError: (err) => {
      toast.error('Erro ao atualizar: ' + err.message);
    },
  });

  const criarParcelaMutation = trpc.parcelas.criarParcela.useMutation({
    onSuccess: (data) => {
      toast.success(`Parcela #${data.numeroParcela} criada com sucesso!`);
      setNovaParcelaData("");
      setNovaParcelaValor("");
      setShowNovaParcela(false);
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
      onSuccess();
    },
    onError: (err) => {
      toast.error('Erro ao criar parcela: ' + err.message);
    },
  });

  const handleCriarParcela = () => {
    if (!novaParcelaData) { toast.error('Informe a data de vencimento'); return; }
    if (!novaParcelaValor || parseFloat(novaParcelaValor) <= 0) { toast.error('Informe o valor da parcela'); return; }
    criarParcelaMutation.mutate({
      contratoId: emprestimo.id,
      dataVencimento: novaParcelaData,
      valorOriginal: parseFloat(novaParcelaValor),
    });
  };

  const handleSalvar = () => {
    editarMutation.mutate({
      id: emprestimo.id,
      valorPrincipal: valor,
      taxaJuros: String(juros),
      tipoTaxa: tipo,
      numeroParcelas: parcelas,
      dataPrimeiraParcela: dataPrimeiraParcela || undefined,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle>Editar Empréstimo</DialogTitle>
            <DialogDescription>{emprestimo.clienteNome}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
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

          {/* Parcelas existentes + Criar nova parcela */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
              <Label className="text-sm font-semibold">Parcelas do Contrato</Label>
              <button
                type="button"
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                onClick={() => setShowNovaParcela(!showNovaParcela)}
              >
                <span className="text-base leading-none">+</span> Criar Parcela
              </button>
            </div>

            {/* Tabela de parcelas existentes */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-3 py-2 text-muted-foreground">#</th>
                    <th className="text-left px-3 py-2 text-muted-foreground">Vencimento</th>
                    <th className="text-right px-3 py-2 text-muted-foreground">Valor</th>
                    <th className="text-right px-3 py-2 text-muted-foreground">Multa</th>
                    <th className="text-center px-3 py-2 text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(emprestimo.todasParcelas ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhuma parcela</td></tr>
                  ) : (
                    (emprestimo.todasParcelas ?? []).map((p: any) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/10">
                        <td className="px-3 py-2 font-medium">{p.numero_parcela}</td>
                        <td className="px-3 py-2">{formatarData(p.data_vencimento)}</td>
                        <td className="px-3 py-2 text-right">{formatarMoeda(parseFloat(p.valor_original ?? '0'))}</td>
                        <td className="px-3 py-2 text-right text-amber-400">
                          {parseFloat(p.valor_multa ?? '0') > 0 ? formatarMoeda(parseFloat(p.valor_multa)) : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            p.status === 'paga' ? 'bg-emerald-500/20 text-emerald-400' :
                            p.status === 'atrasada' ? 'bg-red-500/20 text-red-400' :
                            p.status === 'vencendo_hoje' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {p.status === 'paga' ? 'Paga' : p.status === 'atrasada' ? 'Atrasada' : p.status === 'vencendo_hoje' ? 'Hoje' : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Formulário para criar nova parcela */}
            {showNovaParcela && (
              <div className="px-4 py-3 border-t border-border bg-emerald-500/5 space-y-3">
                <div className="text-xs font-semibold text-emerald-400">Nova Parcela</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Data de Vencimento *</Label>
                    <Input
                      type="date"
                      value={novaParcelaData}
                      onChange={e => setNovaParcelaData(e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={formatarMoeda(valorParcela)}
                      value={novaParcelaValor}
                      onChange={e => setNovaParcelaValor(e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    onClick={() => { setShowNovaParcela(false); setNovaParcelaData(""); setNovaParcelaValor(""); }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleCriarParcela}
                    disabled={criarParcelaMutation.isPending}
                  >
                    {criarParcelaMutation.isPending ? 'Criando...' : 'Confirmar Parcela'}
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>
        </div>
        {/* Botões fixos no rodapé */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSalvar}
            disabled={editarMutation.isPending}
          >
            {editarMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
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
  const [jurosCustom, setJurosCustom] = useState(""); // juros editável manualmente
  const [dataPagamentoCustom, setDataPagamentoCustom] = useState(""); // data manual
  const [pagamentoRealizado, setPagamentoRealizado] = useState<{ valorPago: number; parcelaNum: number } | null>(null);

  // TODOS os hooks devem vir ANTES de qualquer early return (Regra dos Hooks do React)
  const utils = trpc.useUtils();

  const pagarTotalMutation = trpc.parcelas.registrarPagamento.useMutation({
    onSuccess: (_data, variables) => {
      const valorPago = variables.valorPago;
      const parcelaNum = parcela?.numero_parcela ?? 1;
      setPagamentoRealizado({ valorPago, parcelaNum });
      toast.success("Pagamento registrado!");
      setTimeout(() => {
        onSuccess();
        utils.contratos.listComParcelas.invalidate();
        utils.dashboard.kpis.invalidate();
      }, 300);
    },
    onError: (e) => {
      toast.error("Erro ao registrar pagamento: " + e.message);
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

  // Early return APÓS todos os hooks (regra dos hooks do React)
  const parcela = emprestimo.proximaParcela ?? emprestimo.parcelasComAtraso[0];
  const valorOriginal = parcela ? parseFloat(String(parcela.valor_original ?? '0')) : 0;
  const valorJuros = emprestimo.valorJurosParcela;
  const valorTotal = valorOriginal;
  const valorSoJuros = valorJuros > 0 ? valorJuros : valorOriginal * 0.5;
  const parcelaComAtraso = parcela ? emprestimo.parcelasComAtraso.find(p => p.id === parcela.id) : undefined;
  const diasAtraso = parcelaComAtraso?.diasAtraso ?? 0;
  const jurosAtraso = parcelaComAtraso?.jurosAtraso ?? 0;
  const totalComAtraso = parcelaComAtraso?.totalComAtraso ?? valorTotal;

  if (!parcela) return null;

  const handleConfirmar = () => {
    if (!contaCaixaId) { toast.error("Selecione uma conta"); return; }
    const contaId = parseInt(contaCaixaId);
    const dataManual = dataPagamentoCustom || undefined;

    if (tipo === 'total') {
      const valor = valorCustom ? parseFloat(valorCustom) : (diasAtraso > 0 ? totalComAtraso : valorTotal);
      const jurosVal = jurosCustom ? parseFloat(jurosCustom) : undefined;
      pagarTotalMutation.mutate({
        parcelaId: parcela.id,
        valorPago: valor,
        contaCaixaId: contaId,
        valorJurosCustom: jurosVal,
        dataPagamento: dataManual,
      });
    } else {
      const valor = valorCustom ? parseFloat(valorCustom) : (jurosCustom ? parseFloat(jurosCustom) : valorSoJuros);
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
    setJurosCustom("");
    setDataPagamentoCustom("");
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

          {pagamentoRealizado ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-success">Pagamento Registrado!</div>
                  <div className="text-sm text-muted-foreground">{emprestimo.clienteNome}</div>
                  <div className="text-2xl font-bold text-foreground mt-1">{formatarMoeda(pagamentoRealizado.valorPago)}</div>
                  <div className="text-xs text-muted-foreground">Parcela {pagamentoRealizado.parcelaNum}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1.5" onClick={() => {
                  gerarComprovantePDF({
                    clienteNome: emprestimo.clienteNome,
                    contratoId: emprestimo.id,
                    parcelaNumero: pagamentoRealizado.parcelaNum,
                    valorOriginal: valorTotal,
                    juros: valorSoJuros,
                    valorPago: pagamentoRealizado.valorPago,
                    dataPagamento: new Date().toISOString(),
                    modalidade: emprestimo.modalidade,
                  });
                }}>
                  <Download className="h-3.5 w-3.5" /> Comprovante PDF
                </Button>
                <Button className="flex-1" onClick={() => { setPagamentoRealizado(null); setOpen(false); }}>Fechar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumo Capital / Juros / Total */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>Capital</span>
                  <span>{formatarMoeda(emprestimo.valorPrincipal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Juros</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">{formatarMoeda(jurosCustom ? parseFloat(jurosCustom) : valorSoJuros)}</span>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground underline hover:text-foreground"
                      onClick={() => setJurosCustom(jurosCustom ? "" : valorSoJuros.toFixed(2))}
                    >
                      {jurosCustom ? "usar padrão" : "editar"}
                    </button>
                  </div>
                </div>
                {jurosCustom !== "" && (
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Valor dos juros (R$)"
                      value={jurosCustom}
                      onChange={e => setJurosCustom(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Total</span>
                  <span className="text-emerald-400">
                    {formatarMoeda(valorCustom ? parseFloat(valorCustom) : (diasAtraso > 0 ? totalComAtraso : valorTotal))}
                  </span>
                </div>
              </div>

              {/* Tipo de pagamento */}
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

              {/* Valor personalizado */}
              <div>
                <Label className="text-xs">Valor a Pagar (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`Padrão: ${formatarMoeda(tipo === 'total' ? (diasAtraso > 0 ? totalComAtraso : valorTotal) : valorSoJuros)}`}
                  value={valorCustom}
                  onChange={e => setValorCustom(e.target.value)}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              {/* Data de pagamento manual */}
              <div>
                <Label className="text-xs">Data do Pagamento</Label>
                <Input
                  type="date"
                  value={dataPagamentoCustom}
                  onChange={e => setDataPagamentoCustom(e.target.value)}
                  className="mt-1 h-9 text-sm [color-scheme:dark]"
                  placeholder="Hoje (padrão)"
                />
                {!dataPagamentoCustom && (
                  <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para usar a data de hoje</p>
                )}
              </div>

              {/* Conta de Caixa */}
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
          )}
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
  const [showEtiquetasModal, setShowEtiquetasModal] = useState(false);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [showDetalhesCompleto, setShowDetalhesCompleto] = useState(false);
  const [showComprovanteModal, setShowComprovanteModal] = useState(false);
  const [novasTaxaJuros, setNovasTaxaJuros] = useState<string>("");
  const [valorMulta, setValorMulta] = useState<string>("");
  const [motivoMulta, setMotivoMulta] = useState<string>("");
  const [novaEtiquetaNome, setNovaEtiquetaNome] = useState("");
  const [novaEtiquetaCor, setNovaEtiquetaCor] = useState("#6366f1");
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const utils = trpc.useUtils();

  const { data: todasEtiquetas = [] } = trpc.etiquetas.listar.useQuery();
  const [etiquetasSelecionadas, setEtiquetasSelecionadas] = useState<string[]>(emp.etiquetas ?? []);

  const criarEtiquetaMutation = trpc.etiquetas.criar.useMutation({
    onSuccess: () => { toast.success("Etiqueta criada!"); setNovaEtiquetaNome(""); utils.etiquetas.listar.invalidate(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const removerEtiquetaMutation = trpc.etiquetas.remover.useMutation({
    onSuccess: () => { utils.etiquetas.listar.invalidate(); },
  });
  const aplicarEtiquetasMutation = trpc.etiquetas.aplicarContrato.useMutation({
    onSuccess: () => { toast.success("Etiquetas salvas!"); setShowEtiquetasModal(false); onRefresh(); utils.contratos.listComParcelas.invalidate(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const editarJurosMutation = trpc.contratos.editarJuros.useMutation({
    onSuccess: () => {
      toast.success("Taxa de juros atualizada!");
      setShowEditarJurosModal(null);
      setNovasTaxaJuros("");
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
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
      utils.dashboard.kpis.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deletarMutation = trpc.contratos.deletar.useMutation({
    onSuccess: () => {
      toast.success("Empréstimo deletado");
      onRefresh();
      utils.contratos.listComParcelas.invalidate();
      utils.dashboard.kpis.invalidate();
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

  const [loadingWpp, setLoadingWpp] = useState(false);

  const handleWhatsApp = async (tipo: 'atraso' | 'preventivo' = 'atraso') => {
    if (!emp.clienteWhatsapp) {
      toast.error("Telefone WhatsApp não cadastrado");
      return;
    }
    setLoadingWpp(true);
    try {
      const result = await utils.client.whatsapp.gerarMensagemContrato.query({
        contratoId: emp.id,
        tipo,
      });
      if (result.whatsappUrl) {
        window.open(result.whatsappUrl, '_blank');
      } else {
        toast.error("Não foi possível gerar o link do WhatsApp");
      }
    } catch {
      // Fallback para mensagem simples
      const msg = tipo === 'atraso'
        ? `⚠️ Olá ${emp.clienteNome}, você tem parcela(s) em atraso. Favor regularizar o quanto antes.`
        : `🟢 Olá ${emp.clienteNome}! Lembrete: você tem parcela vencendo em breve. Fique em dia!`;
      const url = `https://wa.me/55${emp.clienteWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    } finally {
      setLoadingWpp(false);
    }
  };

  const handleGerarComprovante = async () => {
    setGerandoPDF(true);
    try {
      const parcelaPaga = emp.todasParcelas?.find((p: any) => p.status === 'paga') || emp.todasParcelas?.[0];
      await gerarComprovantePDF({
        clienteNome: emp.clienteNome,
        contratoId: emp.id,
        parcelaNumero: parcelaPaga?.numero_parcela ?? 1,
        valorOriginal: parcelaPaga?.valor_original ?? emp.valorPrincipal,
        juros: parcelaPaga?.valor_juros ?? 0,
        valorPago: parcelaPaga?.valor_pago ?? parcelaPaga?.valor_original ?? emp.valorPrincipal,
        dataPagamento: parcelaPaga?.data_pagamento ?? new Date().toISOString(),
        modalidade: emp.modalidade,
      });
      toast.success('Comprovante gerado!');
    } catch {
      toast.error('Erro ao gerar comprovante');
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════
           CARD ESTILO COBRA FÁCIL
      ═══════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border/60 overflow-hidden bg-[#0f1923] shadow-xl hover:shadow-2xl transition-all">

        {/* ── HEADER: Nome + Status + Modalidade ── */}
        <div className="bg-[#0a1520] px-4 pt-4 pb-3 border-b border-border/40">
          {/* Nome centralizado */}
          <h3 
            className="text-center font-bold text-white text-base tracking-wide mb-2 cursor-pointer hover:text-emerald-400 transition-colors"
            onClick={() => setShowDetalhesCompleto(true)}
            title="Clique para ver detalhes"
          >
            {emp.clienteNome.toUpperCase()}
          </h3>

          {/* Avatar + badges + botões de ação */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                {initials}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className={`text-xs font-semibold ${diasAtraso > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {diasAtraso > 0 ? 'Atrasado' : 'Em Dia'}
                </span>
                <Badge className={`text-[10px] px-1.5 py-0 h-4 ${emp.modalidade === 'quinzenal' ? 'bg-cyan-700' : emp.modalidade === 'semanal' ? 'bg-purple-700' : emp.modalidade === 'diario' ? 'bg-orange-700' : 'bg-blue-700'} text-white border-0`}>
                  {emp.modalidade?.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Botões Etiqueta | Detalhes | Comprovante */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1 border-border/50 bg-transparent hover:bg-accent/20"
                onClick={() => setShowEtiquetasModal(true)}
              >
                <Tag className="w-3 h-3" /> Etiqueta
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1 border-border/50 bg-transparent hover:bg-accent/20"
                onClick={() => setLocation(`/emprestimos/${emp.id}`)}
              >
                <Eye className="w-3 h-3" /> Detalhes
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1 border-border/50 bg-transparent hover:bg-accent/20"
                onClick={handleGerarComprovante}
                disabled={gerandoPDF}
              >
                <FileText className="w-3 h-3" /> Comprovante
              </Button>
            </div>
          </div>

          {/* Etiquetas aplicadas */}
          {etiquetasSelecionadas.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {etiquetasSelecionadas.map((nome) => {
                const et = todasEtiquetas.find((e: any) => e.nome === nome);
                return (
                  <span key={nome} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: et?.cor ?? '#6366f1' }}>
                    <Tag className="w-2 h-2" />{nome}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── VALOR PRINCIPAL ── */}
        <div className="px-4 py-4 text-center border-b border-border/40">
          <div className="text-3xl font-bold text-emerald-400">{formatarMoeda(emp.totalReceber)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">restante a receber</div>
          {diasAtraso > 0 && (
            <div className="text-xs text-red-400 mt-1 font-medium">
              contém {formatarMoeda(jurosAtraso)} de juros por atraso
            </div>
          )}
        </div>

        {/* ── KPIs: Emprestado | Total a Receber | Lucro Previsto | Lucro Realizado ── */}
        <div className="px-4 py-3 border-b border-border/40">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <div className="text-muted-foreground">Emprestado</div>
              <div className="font-bold text-white">{formatarMoeda(emp.valorPrincipal)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total a Receber</div>
              <div className="font-bold text-white">{formatarMoeda(emp.totalReceber)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">💰 Lucro Previsto</div>
              <div className="font-bold text-emerald-400">{formatarMoeda(emp.lucroPrevisto)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">✅ Lucro Realizado</div>
              <div className="font-bold text-emerald-400">
                {formatarMoeda(emp.lucroRealizado)}{' '}
                <span className="text-muted-foreground font-normal">
                  {emp.lucroPrevisto > 0 ? `${Math.round((emp.lucroRealizado / emp.lucroPrevisto) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Venc + Pago */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Venc: <span className="text-foreground font-medium">{parcela ? formatarData(parcela.data_vencimento) : 'N/A'}</span></span>
              <button className="ml-1 text-muted-foreground hover:text-foreground">
                <Edit className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span>Pago: <span className="text-emerald-400 font-medium">{formatarMoeda(emp.totalPago)}</span></span>
            </div>
          </div>
        </div>

        {/* ── SÓ JUROS ── */}
        <div className="mx-4 my-3 px-4 py-2.5 rounded-lg bg-purple-900/30 border border-purple-500/30 flex items-center justify-between">
          <span className="text-sm text-purple-200">Só Juros (por parcela):</span>
          <span className="text-sm font-bold text-purple-300">{formatarMoeda(emp.valorJurosParcela)}</span>
        </div>

        {/* ── BLOCO DE ATRASO ── */}
        {diasAtraso > 0 && parcelaComAtraso && (
          <div className="mx-4 mb-3 rounded-lg bg-red-950/60 border border-red-500/40 overflow-hidden">
            {/* Cabeçalho do atraso */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-red-500/30">
              <span className="text-sm font-bold text-red-300">
                Parcela {parcelaComAtraso.numero_parcela}/{emp.numeroParcelas} em atraso
              </span>
              <span className="text-sm font-bold text-red-400">{diasAtraso} dias</span>
            </div>

            {/* Detalhes do atraso */}
            <div className="px-4 py-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vencimento: {formatarData(parcelaComAtraso.data_vencimento)}</span>
                <span className="text-white font-medium">Valor: {formatarMoeda(parcelaComAtraso.valor_original)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">% Juros (R$ {diasAtraso > 0 ? (jurosAtraso / diasAtraso).toFixed(2) : '0,00'}/dia)</span>
                <span className="text-orange-400 font-bold">+{formatarMoeda(jurosAtraso)}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-red-500/30">
                <span className="text-white font-semibold">Total com Atraso:</span>
                <span className="text-white font-bold">{formatarMoeda(totalComAtraso)}</span>
              </div>
            </div>

            {/* Botões Editar Juros e Aplicar Multa */}
            <div className="px-4 pb-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs gap-1 border-border/50 bg-transparent hover:bg-accent/20 text-purple-300 hover:text-purple-200"
                onClick={() => setShowEditarJurosModal(emp.id)}
              >
                <Edit className="w-3 h-3" /> Editar Juros
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs gap-1 border-border/50 bg-transparent hover:bg-accent/20 text-emerald-300 hover:text-emerald-200"
                onClick={() => setShowAplicarMultaModal(emp.id)}
              >
                <DollarSign className="w-3 h-3" /> Aplicar Multa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                onClick={() => { if (confirm('Deletar este empréstimo?')) deletarMutation.mutate({ id: emp.id }); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Mensagem de regularização */}
            <div className="px-4 pb-2 text-[10px] text-muted-foreground">
              Pague a parcela em atraso para regularizar o empréstimo
            </div>
          </div>
        )}

        {/* ── BARRA DE AÇÕES INFERIOR ── */}
        <div className="px-4 pb-4 flex items-center gap-2 border-t border-border/40 pt-3">
          {/* Pagar */}
          <PagamentoModal
            emprestimo={emp}
            contas={contas}
            onSuccess={onRefresh}
            triggerClassName="flex-1 h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
            triggerLabel="Pagar"
            triggerIcon={<CheckCircle className="h-3.5 w-3.5" />}
          />

          {/* Pagar Juros */}
          <PagamentoModal
            emprestimo={emp}
            contas={contas}
            onSuccess={onRefresh}
            modoInicial="juros"
            triggerClassName="flex-1 h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
            triggerLabel="Pagar Juros"
            triggerIcon={<DollarSign className="h-3.5 w-3.5" />}
          />

          {/* Ícones de ação */}
          <div className="flex gap-1">
            {/* Histórico */}
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 border-border/50 bg-transparent hover:bg-accent/20"
              title="Histórico de pagamentos"
              onClick={() => setLocation(`/emprestimos/${emp.id}`)}
            >
              <Clock className="h-4 w-4" />
            </Button>

            {/* Editar */}
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 border-border/50 bg-transparent hover:bg-accent/20"
              title="Editar empréstimo"
              onClick={() => setShowEditarModal(true)}
            >
              <Edit className="h-4 w-4" />
            </Button>

            {/* Renegociar / Cobrar WhatsApp */}
            <Button
              size="sm"
              variant="outline"
              className={`h-9 w-9 p-0 border-border/50 bg-transparent hover:bg-accent/20 ${diasAtraso > 0 ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
              title={diasAtraso > 0 ? 'Cobrar via WhatsApp' : 'Cobrança preventiva'}
              onClick={() => handleWhatsApp(diasAtraso > 0 ? 'atraso' : 'preventivo')}
              disabled={loadingWpp}
            >
              {loadingWpp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>

            {/* Deletar (vermelho) */}
            <Button
              size="sm"
              className="h-9 w-9 p-0 bg-red-700 hover:bg-red-800 text-white border-0"
              title="Deletar empréstimo"
              onClick={() => { if (confirm('Tem certeza que deseja deletar este empréstimo?')) deletarMutation.mutate({ id: emp.id }); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Botões de ação secundários - REMOVIDO (integrado na barra inferior) */}
        <div className="hidden">
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
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs col-span-3 sm:col-span-1"
            title="Etiquetas"
            onClick={() => setShowEtiquetasModal(true)}
          >
            <Tag className="h-3.5 w-3.5" />
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

      {/* Modal de Etiquetas */}
      {showDetalhesCompleto && (
        <EmprestimoDetalhesModal
          emprestimo={emp}
          open={showDetalhesCompleto}
          onOpenChange={setShowDetalhesCompleto}
          contas={contas}
          onRefresh={onRefresh}
        />
      )}
      {showEtiquetasModal && (
        <Dialog open={true} onOpenChange={() => setShowEtiquetasModal(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Tag className="w-4 h-4" /> Etiquetas</DialogTitle>
              <DialogDescription>{emp.clienteNome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Criar nova etiqueta */}
              <div className="flex gap-2">
                <Input placeholder="Nome da etiqueta" value={novaEtiquetaNome} onChange={(e) => setNovaEtiquetaNome(e.target.value)} className="flex-1" />
                <input type="color" value={novaEtiquetaCor} onChange={(e) => setNovaEtiquetaCor(e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" />
                <Button size="sm" onClick={() => { if (novaEtiquetaNome.trim()) criarEtiquetaMutation.mutate({ nome: novaEtiquetaNome.trim(), cor: novaEtiquetaCor }); }} disabled={criarEtiquetaMutation.isPending}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {/* Lista de etiquetas disponíveis */}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {todasEtiquetas.map((et: any) => {
                  const selecionada = etiquetasSelecionadas.includes(et.nome);
                  return (
                    <div key={et.id} className="flex items-center justify-between p-2 rounded border border-border hover:bg-accent/30">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEtiquetasSelecionadas(selecionada ? etiquetasSelecionadas.filter(n => n !== et.nome) : [...etiquetasSelecionadas, et.nome])} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border flex items-center justify-center" style={{ backgroundColor: selecionada ? et.cor : 'transparent', borderColor: et.cor }}>
                            {selecionada && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: et.cor }}>
                            <Tag className="w-2.5 h-2.5" />{et.nome}
                          </span>
                        </button>
                      </div>
                      <button onClick={() => removerEtiquetaMutation.mutate({ id: et.id })} className="text-muted-foreground hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                {todasEtiquetas.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma etiqueta criada ainda</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEtiquetasModal(false)}>Cancelar</Button>
                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => aplicarEtiquetasMutation.mutate({ contratoId: emp.id, etiquetas: etiquetasSelecionadas })} disabled={aplicarEtiquetasMutation.isPending}>
                  {aplicarEtiquetasMutation.isPending ? "Salvando..." : "Salvar Etiquetas"}
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
  const [filtroKoletor, setFiltroKoletor] = useState("todos");
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [loadingLote, setLoadingLote] = useState(false);
  const [periodoRecebimentos, setPeriodoRecebimentos] = useState<'hoje' | 'semana' | 'mes' | 'todos'>('mes');
  const [modoVisualizacao, setModoVisualizacao] = useState<'cards' | 'pasta'>('cards');
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: emprestimos, isLoading, refetch } = trpc.contratos.listComParcelas.useQuery();
  const { data: contas } = trpc.caixa.contas.useQuery();
  const { data: koletores } = trpc.cobradores.list.useQuery();
  const { data: recebimentosData, isLoading: loadingRecebimentos } = trpc.whatsapp.recebimentos.useQuery(
    { periodo: periodoRecebimentos },
    { enabled: abaSelecionada === 'recebimentos' }
  );

  const cobrarLoteMutation = trpc.whatsapp.cobrarLote.useMutation({
    onSuccess: (data) => {
      const urls = data.resultados.filter(r => r.whatsappUrl && r.sucesso);
      if (urls.length === 0) {
        toast.error('Nenhum cliente tem WhatsApp cadastrado');
        return;
      }
      toast.success(`Abrindo ${urls.length} cobranças...`);
      // Abrir uma por uma com delay para não bloquear popups
      urls.forEach((r, i) => {
        setTimeout(() => {
          if (r.whatsappUrl) window.open(r.whatsappUrl, '_blank');
        }, i * 800);
      });
      setSelecionados([]);
      setModoSelecao(false);
    },
    onError: (e) => toast.error('Erro na cobrança em lote: ' + e.message),
  });

  const toggleSelecao = (id: number) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selecionarTodosAtrasados = () => {
    const atrasadosIds = (emprestimos ?? []).filter(e => e.parcelasComAtraso.length > 0).map(e => e.id);
    setSelecionados(atrasadosIds);
  };

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

    if (filtroKoletor !== 'todos') {
      const koletorId = parseInt(filtroKoletor);
      resultado = resultado.filter(e => (e as any).koletorId === koletorId);
    }

    return resultado;
  }, [emprestimos, busca, filtroStatus, filtroKoletor]);

  // Agrupar empréstimos por cliente
  const emprestimosAgrupados = useMemo(() => {
    const grupos: Record<number, {
      clienteId: number;
      clienteNome: string;
      clienteWhatsapp: string | null;
      emprestimos: typeof emprestimosFiltrados;
      totalCapital: number;
      totalReceber: number;
      totalAtrasados: number;
      totalEmDia: number;
    }> = {};
    emprestimosFiltrados.forEach(e => {
      if (!grupos[e.clienteId]) {
        grupos[e.clienteId] = {
          clienteId: e.clienteId,
          clienteNome: e.clienteNome,
          clienteWhatsapp: e.clienteWhatsapp,
          emprestimos: [],
          totalCapital: 0,
          totalReceber: 0,
          totalAtrasados: 0,
          totalEmDia: 0,
        };
      }
      grupos[e.clienteId].emprestimos.push(e);
      grupos[e.clienteId].totalCapital += parseFloat(e.valorPrincipal);
      grupos[e.clienteId].totalReceber += e.totalReceber;
      if (e.parcelasComAtraso.length > 0) grupos[e.clienteId].totalAtrasados += 1;
      else grupos[e.clienteId].totalEmDia += 1;
    });
    return Object.values(grupos).sort((a, b) => a.clienteNome.localeCompare(b.clienteNome));
  }, [emprestimosFiltrados]);

  const atrasados = emprestimos?.filter(e => e.parcelasComAtraso.length > 0).length ?? 0;
  const emDia = (emprestimos?.length ?? 0) - atrasados;
  const capitalNaRua = emprestimos?.reduce((s, e) => s + parseFloat(e.valorPrincipal), 0) ?? 0;
  const totalReceber = emprestimos?.reduce((s, e) => s + e.totalReceber, 0) ?? 0;

  if (isLoading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Empréstimos</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">Gerencie seus empréstimos</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1 hidden sm:flex">
            <Eye className="h-4 w-4" />
            Tutorial
          </Button>
          <Button size="sm" variant="outline" className="gap-1 hidden sm:flex">
            <FileText className="h-4 w-4" />
            Baixar Relatório
          </Button>
          <Button
            size="sm"
            onClick={() => setLocation('/contratos/novo')}
            className="gap-1 bg-emerald-600 hover:bg-emerald-700 sm:hidden"
          >
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 sm:gap-4 border-b border-border overflow-x-auto">
        {[
          { id: 'emprestimos', label: 'Empréstimos', count: emprestimos?.length ?? 0 },
          { id: 'diario', label: 'Diário', count: 0 },
          { id: 'price', label: 'Parcela Fixa', count: 0 },
          { id: 'recebimentos', label: 'Recebimentos', count: recebimentosData?.total ?? 0 },
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

      {abaSelecionada === 'emprestimos' && (
        <>
          {/* Barra de Cobrança em Lote */}
          {modoSelecao && (
            <div className="flex items-center gap-3 p-3 bg-blue-900/30 border border-blue-500/40 rounded-lg">
              <span className="text-sm font-medium text-blue-300">
                {selecionados.length} selecionado(s)
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={selecionarTodosAtrasados}
              >
                Selecionar Atrasados
              </Button>
              <Button
                size="sm"
                className="gap-1 bg-red-700 hover:bg-red-800 text-white text-xs"
                disabled={selecionados.length === 0 || cobrarLoteMutation.isPending}
                onClick={() => cobrarLoteMutation.mutate({ contratoIds: selecionados, tipo: 'atraso' })}
              >
                {cobrarLoteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Cobrar Selecionados
              </Button>
              <Button
                size="sm"
                className="gap-1 bg-green-700 hover:bg-green-800 text-white text-xs"
                disabled={selecionados.length === 0 || cobrarLoteMutation.isPending}
                onClick={() => cobrarLoteMutation.mutate({ contratoIds: selecionados, tipo: 'preventivo' })}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Preventivo em Lote
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto text-xs"
                onClick={() => { setModoSelecao(false); setSelecionados([]); }}
              >
                Cancelar
              </Button>
            </div>
          )}

          {/* Filtros e Busca */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="atrasados">Atrasados</SelectItem>
                <SelectItem value="emdia">Em Dia</SelectItem>
              </SelectContent>
            </Select>
            {koletores && koletores.length > 0 && (
              <Select value={filtroKoletor} onValueChange={setFiltroKoletor}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Cobrador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Cobradores</SelectItem>
                  {koletores.map((k: any) => (
                    <SelectItem key={k.id} value={String(k.id)}>{k.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant={modoSelecao ? 'default' : 'outline'}
              className="gap-1"
              onClick={() => { setModoSelecao(!modoSelecao); setSelecionados([]); }}
            >
              <Users className="h-4 w-4" />
              Lote
            </Button>
            <Button
              size="sm"
              variant={modoVisualizacao === 'pasta' ? 'default' : 'outline'}
              className="gap-1"
              title={modoVisualizacao === 'pasta' ? 'Ver como cards' : 'Ver por cliente (pasta)'}
              onClick={() => setModoVisualizacao(v => v === 'cards' ? 'pasta' : 'cards')}
            >
              {modoVisualizacao === 'pasta' ? <LayoutGrid className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
              {modoVisualizacao === 'pasta' ? 'Cards' : 'Pasta'}
            </Button>
            <Button
              onClick={() => setLocation('/contratos/novo')}
              className="gap-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          </div>

          {/* Modo Cards (padrão) */}
          {modoVisualizacao === 'cards' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {emprestimosFiltrados.map(emp => (
                  <div key={emp.id} className="relative">
                    {modoSelecao && (
                      <div
                        className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 cursor-pointer flex items-center justify-center ${
                          selecionados.includes(emp.id)
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'bg-background border-border'
                        }`}
                        onClick={() => toggleSelecao(emp.id)}
                      >
                        {selecionados.includes(emp.id) && <CheckCircle className="h-4 w-4" />}
                      </div>
                    )}
                    <EmprestimoCardCobra
                      emp={emp}
                      contas={contas ?? []}
                      onRefresh={() => refetch()}
                    />
                  </div>
                ))}
              </div>
              {emprestimosFiltrados.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum empréstimo encontrado
                </div>
              )}
            </>
          )}

          {/* Modo Pasta (agrupado por cliente) */}
          {modoVisualizacao === 'pasta' && (
            <>
              {emprestimosAgrupados.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum empréstimo encontrado
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-3">
                  {emprestimosAgrupados.map(grupo => {
                    const iniciais = grupo.clienteNome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                    const temAtraso = grupo.totalAtrasados > 0;
                    return (
                      <AccordionItem
                        key={grupo.clienteId}
                        value={String(grupo.clienteId)}
                        className="border border-border rounded-xl overflow-hidden bg-card last:border-b"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/10">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                              temAtraso ? 'bg-red-600' : 'bg-emerald-600'
                            }`}>
                              {iniciais}
                            </div>
                            {/* Info do cliente */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate">{grupo.clienteNome.toUpperCase()}</span>
                                {temAtraso ? (
                                  <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full shrink-0">🔴 {grupo.totalAtrasados} atrasado{grupo.totalAtrasados > 1 ? 's' : ''}</span>
                                ) : (
                                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full shrink-0">🟢 Em Dia</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                <span>{grupo.emprestimos.length} contrato{grupo.emprestimos.length > 1 ? 's' : ''}</span>
                                <span>Capital: <span className="text-foreground font-medium">{formatarMoeda(grupo.totalCapital)}</span></span>
                                <span>A receber: <span className="text-warning font-medium">{formatarMoeda(grupo.totalReceber)}</span></span>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {grupo.emprestimos.map(emp => (
                              <div key={emp.id} className="relative">
                                {modoSelecao && (
                                  <div
                                    className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 cursor-pointer flex items-center justify-center ${
                                      selecionados.includes(emp.id)
                                        ? 'bg-blue-500 border-blue-500 text-white'
                                        : 'bg-background border-border'
                                    }`}
                                    onClick={() => toggleSelecao(emp.id)}
                                  >
                                    {selecionados.includes(emp.id) && <CheckCircle className="h-4 w-4" />}
                                  </div>
                                )}
                                <EmprestimoCardCobra
                                  emp={emp}
                                  contas={contas ?? []}
                                  onRefresh={() => refetch()}
                                />
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </>
          )}
        </>
      )}

      {/* Aba Recebimentos */}
      {abaSelecionada === 'recebimentos' && (
        <div className="space-y-4">
          {/* Filtro de período */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Período:</span>
            {(['hoje', 'semana', 'mes', 'todos'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodoRecebimentos(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  periodoRecebimentos === p
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'hoje' ? 'Hoje' : p === 'semana' ? '7 dias' : p === 'mes' ? 'Este Mês' : 'Todos'}
              </button>
            ))}
            {recebimentosData && (
              <span className="ml-auto text-sm font-bold text-emerald-400">
                Total: {recebimentosData.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
          </div>

          {/* Lista de recebimentos */}
          {loadingRecebimentos ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : recebimentosData?.recebimentos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum recebimento no período</div>
          ) : (
            <div className="space-y-2">
              {recebimentosData?.recebimentos.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{r.descricao}</div>
                      <div className="text-xs text-muted-foreground">{r.contaNome} · {new Date(r.dataTransacao).toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-400">
                    +{r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Abas placeholder */}
      {(abaSelecionada === 'diario' || abaSelecionada === 'price') && (
        <div className="p-8 text-center text-muted-foreground">
          Em breve: {abaSelecionada === 'diario' ? 'Empréstimos Diários' : 'Parcela Fixa'}
        </div>
      )}


    </div>
  );
}
