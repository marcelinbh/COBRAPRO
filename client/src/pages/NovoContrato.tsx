import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Calculator, CheckCircle } from "lucide-react";
import { formatarMoeda, calcularParcelaPadrao, calcularParcelasPrice, MODALIDADE_LABELS } from "../../../shared/finance";

export default function NovoContrato() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Ler parâmetros da URL (vindos do Simulador ou Vendas)
  const urlParams = new URLSearchParams(window.location.search);

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
  });

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
  }, [form.valorPrincipal, form.taxaJuros, form.numeroParcelas, form.modalidade]);

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
    if (form.dataInicio) {
      const d = new Date(form.dataInicio + 'T00:00:00');
      if (form.modalidade === 'diario') d.setDate(d.getDate() + 1);
      else if (form.modalidade === 'semanal') d.setDate(d.getDate() + 7);
      else if (form.modalidade === 'quinzenal') d.setDate(d.getDate() + 15);
      else d.setDate(d.getDate() + 30);
      setForm(f => ({ ...f, dataVencimentoPrimeira: d.toISOString().split('T')[0] }));
    }
  }, [form.dataInicio, form.modalidade]);

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
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createMutation.mutate({
      clienteId: parseInt(form.clienteId),
      modalidade: form.modalidade as any,
      valorPrincipal: parseFloat(form.valorPrincipal),
      taxaJuros: parseFloat(form.taxaJuros),
      tipoTaxa: form.tipoTaxa as any,
      numeroParcelas: parseInt(form.numeroParcelas),
      dataInicio: form.dataInicio,
      dataVencimentoPrimeira: form.dataVencimentoPrimeira,
      contaCaixaId: form.contaCaixaId ? parseInt(form.contaCaixaId) : undefined,
      descricao: form.descricao || undefined,
      observacoes: form.observacoes || undefined,
      multaAtraso: form.multaAtraso !== "" ? parseFloat(form.multaAtraso) : undefined,
      jurosMoraDiario: form.jurosMoraDiario !== "" ? parseFloat(form.jurosMoraDiario) : undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/contratos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">NOVO CONTRATO</h1>
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
                <Label>Taxa de Juros (%)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5"
                    value={form.taxaJuros}
                    onChange={e => setForm(f => ({ ...f, taxaJuros: e.target.value }))}
                  />
                  <Select value={form.tipoTaxa} onValueChange={v => setForm(f => ({ ...f, tipoTaxa: v }))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diaria">Diária</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Multa por Atraso (%) <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 2"
                  value={form.multaAtraso}
                  onChange={e => setForm(f => ({ ...f, multaAtraso: e.target.value }))}
                />
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
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Principal</span>
                      <span className="text-foreground">{formatarMoeda(parseFloat(form.valorPrincipal))}</span>
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
