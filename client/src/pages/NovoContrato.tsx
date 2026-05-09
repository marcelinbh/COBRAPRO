'use client';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Calculator, CheckCircle, Info } from "lucide-react";
import { formatarMoeda, calcularParcelaPadrao, calcularParcelasPrice, MODALIDADE_LABELS } from "../../../shared/finance";

export default function NovoContrato() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Ler parâmetros da URL (vindos do Simulador ou Vendas)
  const urlParams = new URLSearchParams(window.location.search);

  // Modo de cálculo da parcela: 'auto' (calculado) ou 'fixo' (valor digitado pelo usuário)
  const [modoParcelaFixa, setModoParcelaFixa] = useState(false);
  // Modo de data: 'auto' (calculado pela modalidade) ou 'manual' (usuário digita cada data)
  const [modoDataManual, setModoDataManual] = useState(false);
  // Tipo de multa: 'percentual' ou 'fixo'
  const [tipoMulta, setTipoMulta] = useState<'percentual' | 'fixo'>('percentual');

  const [form, setForm] = useState({
    clienteId: "",
    modalidade: urlParams.get('modalidade') || "mensal",
    valorPrincipal: urlParams.get('valorPrincipal') || "",
    taxaJuros: urlParams.get('taxaJuros') || "5",
    tipoTaxa: urlParams.get('tipoTaxa') || "mensal",
    numeroParcelas: urlParams.get('numeroParcelas') || "12",
    dataInicio: urlParams.get('dataInicio') || new Date().toISOString().split('T')[0],
    dataVencimentoPrimeira: "",
    contaCaixaId: "",
    descricao: urlParams.get('descricao') || "",
    observacoes: urlParams.get('observacoes') || "",
    multaAtraso: "",
    jurosMoraDiario: "",
    // Parcela fixa
    valorParcelaFixo: "",
  });

  // Datas manuais para cada parcela (quando modoDataManual = true)
  const [datasManual, setDatasManual] = useState<string[]>([]);

  const [preview, setPreview] = useState<{
    valorParcela: number;
    totalPagar: number;
    totalJuros: number;
  } | null>(null);

  const { data: clientesData } = trpc.clientes.list.useQuery({});
  const clientes = clientesData?.clientes ?? [];
  const { data: contas } = trpc.caixa.contas.useQuery();

  // Calcular preview automaticamente
  useEffect(() => {
    const valor = parseFloat(form.valorPrincipal);
    const taxa = parseFloat(form.taxaJuros);
    const parcelas = parseInt(form.numeroParcelas);

    if (modoParcelaFixa && form.valorParcelaFixo) {
      const vp = parseFloat(form.valorParcelaFixo);
      if (vp > 0 && parcelas > 0) {
        const totalPagar = vp * parcelas;
        setPreview({ valorParcela: vp, totalPagar, totalJuros: totalPagar - (valor || 0) });
      } else {
        setPreview(null);
      }
      return;
    }

    if (valor > 0 && taxa >= 0 && parcelas > 0) {
      let valorParcela: number;
      if (form.modalidade === 'tabela_price') {
        valorParcela = calcularParcelasPrice(valor, taxa, parcelas);
      } else {
        valorParcela = calcularParcelaPadrao(valor, taxa, parcelas);
      }
      const totalPagar = valorParcela * parcelas;
      setPreview({
        valorParcela,
        totalPagar,
        totalJuros: totalPagar - valor,
      });
    } else {
      setPreview(null);
    }
  }, [form.valorPrincipal, form.taxaJuros, form.numeroParcelas, form.modalidade, modoParcelaFixa, form.valorParcelaFixo]);

  // Sincronizar tipoTaxa com modalidade selecionada
  useEffect(() => {
    const modalidadeParaTipoTaxa: Record<string, string> = {
      diario: 'diaria',
      semanal: 'semanal',
      quinzenal: 'quinzenal',
      mensal: 'mensal',
      tabela_price: 'mensal',
      reparcelamento: 'mensal',
      venda: 'mensal',
      cheque: 'mensal',
    };
    const novoTipoTaxa = modalidadeParaTipoTaxa[form.modalidade] || 'mensal';
    setForm(f => ({ ...f, tipoTaxa: novoTipoTaxa }));
  }, [form.modalidade]);

  // Auto-preencher data do primeiro vencimento de acordo com a modalidade
  useEffect(() => {
    if (form.dataInicio && !modoDataManual) {
      const d = new Date(form.dataInicio + 'T00:00:00');
      if (form.modalidade === 'diario') d.setDate(d.getDate() + 1);
      else if (form.modalidade === 'semanal') d.setDate(d.getDate() + 7);
      else if (form.modalidade === 'quinzenal') d.setDate(d.getDate() + 15);
      else d.setDate(d.getDate() + 30);
      setForm(f => ({ ...f, dataVencimentoPrimeira: d.toISOString().split('T')[0] }));
    }
  }, [form.dataInicio, form.modalidade, modoDataManual]);

  // Gerar datas manuais iniciais quando modo manual é ativado
  useEffect(() => {
    if (modoDataManual) {
      const n = parseInt(form.numeroParcelas) || 1;
      const primeiraData = form.dataVencimentoPrimeira || new Date().toISOString().split('T')[0];
      const datas: string[] = [];
      for (let i = 0; i < n; i++) {
        const d = new Date(primeiraData + 'T00:00:00');
        if (form.modalidade === 'diario') d.setDate(d.getDate() + i);
        else if (form.modalidade === 'semanal') d.setDate(d.getDate() + i * 7);
        else if (form.modalidade === 'quinzenal') d.setDate(d.getDate() + i * 15);
        else d.setMonth(d.getMonth() + i);
        datas.push(d.toISOString().split('T')[0]);
      }
      setDatasManual(datas);
    }
  }, [modoDataManual, form.numeroParcelas, form.dataVencimentoPrimeira, form.modalidade]);

  const createMutation = trpc.contratos.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Contrato criado! ${form.numeroParcelas}x de ${formatarMoeda(data.valorParcela)}`);
      utils.contratos.list.invalidate();
      utils.dashboard.kpis.invalidate();
      setLocation('/contratos');
    },
    onError: (e) => toast.error("Erro ao criar contrato: " + e.message),
  });

  const handleSubmit = () => {
    if (!form.clienteId || !form.valorPrincipal || !form.dataVencimentoPrimeira) {
      toast.error(t('toast_error.preencha_todos_os_campos_obrigatórios'));
      return;
    }
    if (modoDataManual && datasManual.some(d => !d)) {
      toast.error(t('toast_error.preencha_todas_as_datas_de_vencimento'));
      return;
    }

    // Calcular multa: se tipo fixo, converter para percentual equivalente
    let multaAtrasoFinal: number | undefined;
    if (form.multaAtraso !== "") {
      if (tipoMulta === 'fixo') {
        const valorPrincipal = parseFloat(form.valorPrincipal);
        multaAtrasoFinal = valorPrincipal > 0 ? (parseFloat(form.multaAtraso) / valorPrincipal) * 100 : parseFloat(form.multaAtraso);
      } else {
        multaAtrasoFinal = parseFloat(form.multaAtraso);
      }
    }

    // Calcular valor da parcela: se modo fixo, usar o valor digitado como taxa 0 e ajustar
    let taxaJuros = parseFloat(form.taxaJuros);
    let valorPrincipal = parseFloat(form.valorPrincipal);

    // Se parcela fixa, ajustar taxa para que o cálculo resulte no valor desejado
    if (modoParcelaFixa && form.valorParcelaFixo) {
      const vp = parseFloat(form.valorParcelaFixo);
      const n = parseInt(form.numeroParcelas);
      // Calcular taxa implícita: total = vp * n; juros = total - principal; taxa = juros / principal / n * 100
      const totalImplicito = vp * n;
      const jurosTotal = totalImplicito - valorPrincipal;
      taxaJuros = valorPrincipal > 0 ? (jurosTotal / valorPrincipal / n) * 100 : 0;
    }

    createMutation.mutate({
      clienteId: parseInt(form.clienteId),
      modalidade: form.modalidade as any,
      valorPrincipal,
      taxaJuros: Math.max(0, taxaJuros),
      tipoTaxa: form.tipoTaxa as any,
      numeroParcelas: parseInt(form.numeroParcelas),
      dataInicio: form.dataInicio,
      dataVencimentoPrimeira: modoDataManual && datasManual[0] ? datasManual[0] : form.dataVencimentoPrimeira,
      contaCaixaId: form.contaCaixaId ? parseInt(form.contaCaixaId) : undefined,
      descricao: form.descricao || undefined,
      observacoes: form.observacoes || undefined,
      multaAtraso: multaAtrasoFinal,
      jurosMoraDiario: form.jurosMoraDiario !== "" ? parseFloat(form.jurosMoraDiario) : undefined,
    });
  };

  const numParcelas = parseInt(form.numeroParcelas) || 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/contratos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">{t('novoContrato.title').toUpperCase()}</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados do contrato</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Formulário */}
        <Card className="md:col-span-2 border-border">
          <CardContent className="p-6 space-y-5">
            {/* Cliente */}
            <div>
              <Label>Cliente *</Label>
              <Select value={form.clienteId} onValueChange={v => setForm(f => ({ ...f, clienteId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modalidade */}
            <div>
              <Label>Modalidade *</Label>
              <Select value={form.modalidade} onValueChange={v => setForm(f => ({ ...f, modalidade: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MODALIDADE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor e Taxa */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor Principal (R$) *</Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.valorPrincipal}
                  onChange={e => setForm(f => ({ ...f, valorPrincipal: e.target.value }))}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Taxa de Juros (%)</Label>
                  {modoParcelaFixa && (
                    <Badge variant="secondary" className="text-xs">Calculado automaticamente</Badge>
                  )}
                </div>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5"
                    value={form.taxaJuros}
                    onChange={e => setForm(f => ({ ...f, taxaJuros: e.target.value }))}
                    disabled={modoParcelaFixa}
                    className={modoParcelaFixa ? 'opacity-50' : ''}
                  />
                  <Select value={form.tipoTaxa} onValueChange={v => setForm(f => ({ ...f, tipoTaxa: v }))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diaria">Diária</SelectItem>
                      <SelectItem value="semanal">{t('novoContrato.weekly')}</SelectItem>
                      <SelectItem value="quinzenal">{t('novoContrato.biweekly')}</SelectItem>
                      <SelectItem value="mensal">{t('novoContrato.monthly')}</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Parcelas */}
            <div>
              <Label>Número de Parcelas *</Label>
              <Input
                className="mt-1"
                type="number"
                min="1"
                max="360"
                placeholder="12"
                value={form.numeroParcelas}
                onChange={e => setForm(f => ({ ...f, numeroParcelas: e.target.value }))}
              />
            </div>

            {/* ── OPÇÃO: PARCELA COM VALOR FIXO ── */}
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="cursor-pointer" htmlFor="toggle-parcela-fixa">Parcela com Valor Fixo</Label>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <button
                  id="toggle-parcela-fixa"
                  type="button"
                  onClick={() => setModoParcelaFixa(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${modoParcelaFixa ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modoParcelaFixa ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {modoParcelaFixa && (
                <div>
                  <Label className="text-xs">Valor da Parcela (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 150.00"
                    value={form.valorParcelaFixo}
                    onChange={e => setForm(f => ({ ...f, valorParcelaFixo: e.target.value }))}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    A taxa de juros será calculada automaticamente com base no valor da parcela.
                  </p>
                </div>
              )}
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início *</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={form.dataInicio}
                  onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))}
                />
              </div>
              <div>
                <Label>1º Vencimento *</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={form.dataVencimentoPrimeira}
                  onChange={e => setForm(f => ({ ...f, dataVencimentoPrimeira: e.target.value }))}
                />
              </div>
            </div>

            {/* ── OPÇÃO: DATAS MANUAIS ── */}
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="cursor-pointer" htmlFor="toggle-data-manual">Definir Datas de Vencimento Manualmente</Label>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <button
                  id="toggle-data-manual"
                  type="button"
                  onClick={() => setModoDataManual(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${modoDataManual ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modoDataManual ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {modoDataManual && numParcelas > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <p className="text-xs text-muted-foreground">Defina a data de vencimento de cada parcela:</p>
                  {Array.from({ length: numParcelas }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">Parcela {i + 1}</span>
                      <Input
                        type="date"
                        value={datasManual[i] || ''}
                        onChange={e => {
                          const novas = [...datasManual];
                          novas[i] = e.target.value;
                          setDatasManual(novas);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conta de Caixa */}
            <div>
              <Label>Conta de Caixa</Label>
              <Select value={form.contaCaixaId} onValueChange={v => setForm(f => ({ ...f, contaCaixaId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a conta (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {contas?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome} — {formatarMoeda(c.saldoAtual)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Multa e Juros Mora */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Multa por Atraso <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setTipoMulta('percentual')}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${tipoMulta === 'percentual' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                      % Percentual
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoMulta('fixo')}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${tipoMulta === 'fixo' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                      R$ Valor Fixo
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={tipoMulta === 'percentual' ? "Ex: 2" : "Ex: 50.00"}
                    value={form.multaAtraso}
                    onChange={e => setForm(f => ({ ...f, multaAtraso: e.target.value }))}
                  />
                  <span className="flex items-center text-sm text-muted-foreground px-2 bg-muted rounded-md border border-input">
                    {tipoMulta === 'percentual' ? '%' : 'R$'}
                  </span>
                </div>
              </div>
              <div>
                <Label>Juros Mora Diário (%) <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Ex: 0.033"
                  value={form.jurosMoraDiario}
                  onChange={e => setForm(f => ({ ...f, jurosMoraDiario: e.target.value }))}
                />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <Label>Descrição / Observações</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={2}
                placeholder="Ex: iPhone 15 Pro Max 256GB..."
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Simulação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!preview ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Preencha os valores para ver a simulação
                </p>
              ) : (
                <>
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-xs text-muted-foreground">Valor da Parcela</div>
                    <div className="font-display text-2xl text-primary">{formatarMoeda(preview.valorParcela)}</div>
                    {modoParcelaFixa && (
                      <div className="text-xs text-muted-foreground mt-1">Valor fixo definido manualmente</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Principal</span>
                      <span className="text-foreground">{formatarMoeda(parseFloat(form.valorPrincipal) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Juros</span>
                      <span className="text-warning">{formatarMoeda(preview.totalJuros)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t border-border pt-2">
                      <span className="text-foreground">Total a Pagar</span>
                      <span className="text-foreground">{formatarMoeda(preview.totalPagar)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    {form.numeroParcelas}x de {formatarMoeda(preview.valorParcela)}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Resumo das opções ativas */}
          {(modoParcelaFixa || modoDataManual || tipoMulta === 'fixo') && (
            <Card className="border-border">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opções Ativas</p>
                {modoParcelaFixa && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span>Parcela com valor fixo</span>
                  </div>
                )}
                {modoDataManual && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span>Datas de vencimento manuais</span>
                  </div>
                )}
                {tipoMulta === 'fixo' && form.multaAtraso && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span>Multa em valor fixo: {formatarMoeda(parseFloat(form.multaAtraso))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full gap-2"
            size="lg"
            disabled={!form.clienteId || !form.valorPrincipal || !form.dataVencimentoPrimeira || createMutation.isPending}
            onClick={handleSubmit}
          >
            <CheckCircle className="h-4 w-4" />
            {createMutation.isPending ? "Criando..." : "Criar Contrato"}
          </Button>
        </div>
      </div>
    </div>
  );
}
