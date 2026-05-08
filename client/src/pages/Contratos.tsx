import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Plus, Search, FileText, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { formatarMoeda, formatarData, MODALIDADE_LABELS, STATUS_CONTRATO_LABELS } from "../../../shared/finance";
import { gerarPdfContrato } from "@/lib/gerarPdfContrato";

function BotaoPDF({ contratoId }: { contratoId: number }) {
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();

  async function handleGerarPDF(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      // Buscar dados completos do contrato
      const contrato = await utils.contratos.byId.fetch({ id: contratoId });
      if (!contrato) { toast.error("Contrato não encontrado"); return; }
      // Buscar parcelas do contrato
      const parcelasData = await utils.parcelas.list.fetch({ contratoId });
      // Montar objeto para o PDF
      const c = contrato.contrato;
      gerarPdfContrato({
        id: c.id,
        clienteNome: contrato.clienteNome,
        clienteCpfCnpj: null,
        clienteTelefone: null,
        clienteEndereco: null,
        modalidade: c.modalidade,
        valorPrincipal: c.valorPrincipal,
        taxaJuros: c.taxaJuros,
        tipoTaxa: c.tipoTaxa,
        numeroParcelas: c.numeroParcelas,
        valorParcela: c.valorParcela,
        totalPagar: parcelasData.reduce((s, p) => s + parseFloat(String(p.valorOriginal)), 0),
        dataInicio: c.dataInicio,
        dataVencimentoPrimeira: c.dataVencimentoPrimeira,
        status: c.status,
        descricao: c.descricao,
        observacoes: c.observacoes,
        multaAtraso: c.multaAtraso,
        jurosMoraDiario: c.jurosMoraDiario,
        parcelas: parcelasData.map(p => ({
          numero: p.numeroParcela,
          dataVencimento: p.dataVencimento,
          valorParcela: p.valorOriginal,
          status: p.status,
          valorPago: p.valorPago,
          dataPagamento: p.dataPagamento,
        })),
      });
      toast.success("PDF gerado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar PDF: " + (err?.message ?? "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 shrink-0 h-8 px-2.5"
      onClick={handleGerarPDF}
      disabled={loading}
      title="Baixar Contrato em PDF"
    >
      {loading
        ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        : <Download className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline text-xs">PDF</span>
    </Button>
  );
}

export default function Contratos() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroModalidade, setFiltroModalidade] = useState("todas");

  const { data: contratos, isLoading } = trpc.contratos.list.useQuery({
    status: filtroStatus !== "todos" ? filtroStatus : undefined,
    modalidade: filtroModalidade !== "todas" ? filtroModalidade : undefined,
  });

  const filtrados = contratos?.filter(c =>
    !busca || c.clienteNome.toLowerCase().includes(busca.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    ativo: "bg-success/15 text-success border-success/30",
    quitado: "bg-muted text-muted-foreground border-border",
    inadimplente: "bg-primary/15 text-primary border-primary/30",
    cancelado: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">CONTRATOS</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtrados?.length ?? 0} contratos</p>
        </div>
        <Button className="gap-2" onClick={() => setLocation('/contratos/novo')}>
          <Plus className="h-4 w-4" />Novo Contrato
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="quitado">Quitado</SelectItem>
            <SelectItem value="inadimplente">Inadimplente</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Modalidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as modalidades</SelectItem>
            <SelectItem value="emprestimo_padrao">Empréstimo Padrão</SelectItem>
            <SelectItem value="emprestimo_diario">Empréstimo Diário</SelectItem>
            <SelectItem value="tabela_price">Parcela Fixa</SelectItem>
            <SelectItem value="venda_produto">Venda de Produto</SelectItem>
            <SelectItem value="desconto_cheque">Desconto de Cheque</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="border-border animate-pulse">
              <CardContent className="p-5 h-20" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filtrados?.length === 0 && (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum contrato encontrado</p>
        </div>
      )}

      <div className="space-y-3">
        {filtrados?.map(contrato => (
          <Card
            key={contrato.id}
            className="border-border hover:border-primary/30 transition-all cursor-pointer"
            onClick={() => setLocation(`/parcelas?contratoId=${contrato.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-foreground">{contrato.clienteNome}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[contrato.status] ?? ''}`}>
                        {STATUS_CONTRATO_LABELS[contrato.status] ?? contrato.status}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-border bg-muted text-muted-foreground">
                        {MODALIDADE_LABELS[contrato.modalidade] ?? contrato.modalidade}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {contrato.numeroParcelas}x de {formatarMoeda(contrato.valorParcela)} · {contrato.taxaJuros}% {contrato.tipoTaxa} · Início: {formatarData(contrato.dataInicio)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <div className="text-right hidden sm:block">
                    <div className="font-display text-lg text-foreground">{formatarMoeda(contrato.valorPrincipal)}</div>
                    <div className="text-xs text-muted-foreground">Principal</div>
                  </div>
                  <BotaoPDF contratoId={contrato.id} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
