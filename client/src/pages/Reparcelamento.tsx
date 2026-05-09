import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RefreshCw, Search, AlertTriangle, CheckCircle, DollarSign, Calendar } from "lucide-react";
import { useLocation } from "wouter";

function formatMoeda(v: number | string | null | undefined) {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export default function Reparcelamento() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [contratoIdInput, setContratoIdInput] = useState("");
  const [contratoId, setContratoId] = useState<number | null>(null);
  const [numeroParcelas, setNumeroParcelas] = useState(6);
  const [taxaJuros, setTaxaJuros] = useState(5);
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split("T")[0]);
  const [incluirMultas, setIncluirMultas] = useState(true);
  const [observacoes, setObservacoes] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const { data: preview, isLoading: loadingPreview } = trpc.reparcelamento.preview.useQuery(
    { contratoId: contratoId!, numeroParcelas, taxaJuros, dataInicio, incluirMultas },
    { enabled: contratoId !== null }
  );

  const { data: contratos } = trpc.contratos.list.useQuery(
    { clienteId: undefined },
    { enabled: contratoId !== null }
  );
  const contrato = contratos?.find((c) => c.id === contratoId);

  const executarMutation = trpc.reparcelamento.executar.useMutation({
    onSuccess: (data) => {
      toast.success(`Reparcelamento realizado! Novo contrato #${data.novoContratoId}`);
      navigate(`/contratos`);
    },
    onError: (e) => toast.error(e.message),
  });

  function buscarContrato() {
    const id = parseInt(contratoIdInput);
    if (!id || isNaN(id)) return toast.error("Digite um número de contrato válido");
    setContratoId(id);
  }

  function confirmarReparcelamento() {
    if (!contratoId) return;
    executarMutation.mutate({
      contratoId,
      numeroParcelas,
      taxaJuros,
      dataInicio,
      incluirMultas,
      observacoes,
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <RefreshCw className="w-6 h-6 text-primary" />
          Reparcelamento
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Reagende dívidas em aberto com novas condições de pagamento
        </p>
      </div>

      {/* Busca de contrato */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Buscar Contrato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Número do contrato (ex: 42)"
              value={contratoIdInput}
              onChange={(e) => setContratoIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscarContrato()}
              className="bg-background border-border max-w-xs"
            />
            <Button onClick={buscarContrato} variant="outline">
              <Search className="w-4 h-4 mr-2" /> Buscar
            </Button>
          </div>
          {contrato && (
            <div className="mt-4 p-4 bg-background/50 rounded-lg border border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Contrato</p>
                  <p className="font-bold text-foreground">#{contrato.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('reparcelamento.client')}</p>
                  <p className="font-medium text-foreground">{contrato.clienteNome}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('reparcelamento.originalValue')}</p>
                  <p className="font-medium text-foreground">{formatMoeda(contrato.valorPrincipal)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('reparcelamento.status')}</p>
                  <Badge variant={contrato.status === "inadimplente" ? "destructive" : "secondary"}>
                    {contrato.status}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {contratoId && (
        <>
          {/* Configuração do reparcelamento */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">Condições do Reparcelamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Nº de Parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={numeroParcelas}
                    onChange={(e) => setNumeroParcelas(parseInt(e.target.value) || 1)}
                    className="bg-background border-border"
                  />
                </div>
                <div>
                  <Label>Taxa de Juros (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={taxaJuros}
                    onChange={(e) => setTaxaJuros(parseFloat(e.target.value) || 0)}
                    className="bg-background border-border"
                  />
                </div>
                <div>
                  <Label>Data 1ª Parcela</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="bg-background border-border"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={incluirMultas}
                      onChange={(e) => setIncluirMultas(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-foreground">Incluir multas e juros</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {loadingPreview && (
            <div className="text-center py-8 text-muted-foreground">Calculando...</div>
          )}

          {preview && (
            <Card className="border-primary/30 bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Simulação do Reparcelamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Parcelas em Aberto</p>
                    <p className="text-2xl font-bold text-yellow-400">{preview.qtdParcelasAbertas}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Saldo Devedor</p>
                    <p className="text-xl font-bold text-red-400">{formatMoeda(preview.saldoDevedor)}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Nova Parcela</p>
                    <p className="text-xl font-bold text-green-400">{formatMoeda(preview.valorNovaParcela)}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total Novo</p>
                    <p className="text-xl font-bold text-foreground">{formatMoeda(preview.totalNovo)}</p>
                  </div>
                </div>

                {/* Tabela de parcelas */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Novas Parcelas</p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-background/70 sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-muted-foreground font-medium">Nº</th>
                          <th className="text-left p-2 text-muted-foreground font-medium">{t('reparcelamento.dueDate')}</th>
                          <th className="text-right p-2 text-muted-foreground font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.parcelas.map((p) => (
                          <tr key={p.numero} className="border-t border-border/50">
                            <td className="p-2 text-foreground">{p.numero}</td>
                            <td className="p-2 text-foreground">
                              {new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                            </td>
                            <td className="p-2 text-right text-foreground font-medium">{formatMoeda(p.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Aviso */}
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-300">
                    Ao confirmar, as parcelas em aberto do contrato #{contratoId} serão encerradas e um novo contrato de reparcelamento será criado automaticamente.
                  </p>
                </div>

                {/* Observações */}
                <div>
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Motivo do reparcelamento, acordo, etc."
                    className="bg-background border-border"
                    rows={2}
                  />
                </div>

                {/* Botão confirmar */}
                {!confirmando ? (
                  <Button onClick={() => setConfirmando(true)} className="w-full bg-primary hover:bg-primary/90">
                    <RefreshCw className="w-4 h-4 mr-2" /> Confirmar Reparcelamento
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-center text-sm text-yellow-400 font-medium">
                      Tem certeza? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setConfirmando(false)} className="flex-1">
                        Cancelar
                      </Button>
                      <Button
                        onClick={confirmarReparcelamento}
                        disabled={executarMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {executarMutation.isPending ? "Processando..." : "Sim, Reparcelar"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
