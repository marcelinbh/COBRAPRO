import { useTranslation } from 'react-i18next';
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Phone, MessageCircle, CreditCard, MapPin, FileText, Plus,
  Edit, Star, AlertTriangle, CheckCircle, Clock, User,
  Instagram, Facebook, Briefcase, Mail, Calendar, Download,
  ExternalLink, Eye, Hash, Heart
} from "lucide-react";
import { formatarMoeda, formatarData, MODALIDADE_LABELS, STATUS_CONTRATO_LABELS } from "../../../shared/finance";

// ─── helpers ─────────────────────────────────────────────────────────────────
function getInitials(nome: string) {
  return nome.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

function getScoreBadge(score: number) {
  if (score >= 150) return { label: "Excelente", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (score >= 100) return { label: "Bom", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
  if (score >= 60)  return { label: "Regular", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" };
  return { label: "Baixo", color: "bg-red-500/15 text-red-400 border-red-500/30" };
}

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    ativo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    quitado: "bg-muted text-muted-foreground border-border",
    inadimplente: "bg-red-500/15 text-red-400 border-red-500/30",
    cancelado: "bg-muted text-muted-foreground border-border",
    paga: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    pendente: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    atrasada: "bg-red-500/15 text-red-400 border-red-500/30",
    vencendo_hoje: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  };
  return map[status] ?? "bg-muted text-muted-foreground border-border";
}

const STATUS_PARCELA_LABELS: Record<string, string> = {
  pendente: "Pendente",
  paga: "Paga",
  atrasada: "Atrasada",
  vencendo_hoje: "Vence Hoje",
  parcial: "Parcial",
};

// ─── component ───────────────────────────────────────────────────────────────
export default function ClienteDetalhe() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const clienteId = parseInt(params.id ?? "0");
  const [abaAtiva, setAbaAtiva] = useState("resumo");

  const { data: cliente, isLoading } = trpc.clientes.byId.useQuery({ id: clienteId });
  const { data: contratos } = trpc.clientes.contratosByCliente.useQuery({ clienteId });
  const { data: parcelas } = trpc.parcelas.list.useQuery({ clienteId });

  // Métricas calculadas
  const metricas = useMemo(() => {
    if (!parcelas) return { totalPago: 0, totalPendente: 0, totalAtrasado: 0, qtdPagas: 0, qtdAtrasadas: 0, qtdPendentes: 0, taxaAdimplencia: 0 };
    const pagas = parcelas.filter(p => p.status === "paga");
    const atrasadas = parcelas.filter(p => p.status === "atrasada");
    const pendentes = parcelas.filter(p => ["pendente", "vencendo_hoje", "parcial"].includes(p.status));
    const totalPago = pagas.reduce((s, p) => s + parseFloat(String(p.valorOriginal ?? 0)), 0);
    const totalPendente = pendentes.reduce((s, p) => s + parseFloat(String(p.valorOriginal ?? 0)), 0);
    const totalAtrasado = atrasadas.reduce((s, p) => s + parseFloat(String(p.valorOriginal ?? 0)), 0);
    const total = parcelas.length;
    const taxaAdimplencia = total > 0 ? Math.round((pagas.length / total) * 100) : 0;
    return { totalPago, totalPendente, totalAtrasado, qtdPagas: pagas.length, qtdAtrasadas: atrasadas.length, qtdPendentes: pendentes.length, taxaAdimplencia };
  }, [parcelas]);

  // Documentos
  const documentos = useMemo(() => {
    if (!(cliente as any)?.documentosUrls) return [];
    try { return JSON.parse((cliente as any).documentosUrls as string); } catch { return []; }
  }, [cliente]);

  // Score
  const score = (cliente as any)?.score ?? 0;
  const scoreBadge = getScoreBadge(score);

  // ─── loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-48 bg-card border border-border rounded-xl" />
        <div className="h-64 bg-card border border-border rounded-xl" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t('common.clientNotFound')}</p>
        <Button variant="ghost" className="mt-4" onClick={() => setLocation("/clientes")}>
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  const whatsappNum = (cliente.whatsapp ?? cliente.telefone ?? "").replace(/\D/g, "");

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/clientes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-foreground tracking-wide truncate">{cliente.nome.toUpperCase()}</h1>
          <p className="text-xs text-muted-foreground">{(cliente as any).cpfCnpj ?? "CPF não informado"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {whatsappNum && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => window.open(`https://wa.me/55${whatsappNum}`, "_blank")}
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setLocation("/clientes")}
          >
            <Edit className="h-4 w-4" /> Editar
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setLocation("/contratos/novo")}
          >
            <Plus className="h-4 w-4" /> Novo Contrato
          </Button>
        </div>
      </div>

      {/* Hero Card */}
      <Card className="border-border overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {(cliente as any).fotoUrl ? (
                <img
                  src={(cliente as any).fotoUrl}
                  alt={cliente.nome}
                  className="w-20 h-20 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center">
                  <span className="font-display text-2xl text-primary">{getInitials(cliente.nome)}</span>
                </div>
              )}
            </div>

            {/* Info principal */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="outline" className={scoreBadge.color}>
                  <Star className="h-3 w-3 mr-1" /> Score {score} — {scoreBadge.label}
                </Badge>
                {(cliente as any).tipoCliente && (
                  <Badge variant="outline" className="border-border text-muted-foreground capitalize">
                    {(cliente as any).tipoCliente}
                  </Badge>
                )}
                {(cliente as any).isReferral && (
                  <Badge variant="outline" className="border-pink-500/30 text-pink-400">
                    <Heart className="h-3 w-3 mr-1" /> Indicação
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="font-display text-lg text-emerald-400">{formatarMoeda(metricas.totalPago)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Pago</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="font-display text-lg text-blue-400">{formatarMoeda(metricas.totalPendente)}</div>
                  <div className="text-xs text-muted-foreground mt-1">A Receber</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className={`font-display text-lg ${metricas.totalAtrasado > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                    {formatarMoeda(metricas.totalAtrasado)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Em Atraso</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className={`font-display text-lg ${metricas.taxaAdimplencia >= 80 ? "text-emerald-400" : metricas.taxaAdimplencia >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {metricas.taxaAdimplencia}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{t('common.adimplencia')}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="resumo" className="gap-1.5 text-xs"><User className="h-3.5 w-3.5" /> Dados</TabsTrigger>
          <TabsTrigger value="contratos" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Contratos ({contratos?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="parcelas" className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Parcelas ({parcelas?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Docs ({documentos.length})</TabsTrigger>
        </TabsList>

        {/* ── ABA: DADOS ── */}
        <TabsContent value="resumo" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contato */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: <Phone className="h-4 w-4 text-muted-foreground" />, label: "Telefone", value: cliente.telefone },
                  { icon: <MessageCircle className="h-4 w-4 text-emerald-400" />, label: "WhatsApp", value: cliente.whatsapp, link: whatsappNum ? `https://wa.me/55${whatsappNum}` : undefined },
                  { icon: <Mail className="h-4 w-4 text-blue-400" />, label: "E-mail", value: (cliente as any).email },
                  { icon: <Instagram className="h-4 w-4 text-pink-400" />, label: "Instagram", value: (cliente as any).instagram },
                  { icon: <Facebook className="h-4 w-4 text-blue-500" />, label: "Facebook", value: (cliente as any).facebook },
                  { icon: <Briefcase className="h-4 w-4 text-muted-foreground" />, label: "Profissão", value: (cliente as any).profissao },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">{f.icon}</div>
                    <div>
                      <div className="text-xs text-muted-foreground">{f.label}</div>
                      {f.link ? (
                        <a href={f.link} target="_blank" rel="noreferrer" className="text-sm text-emerald-400 hover:underline">{f.value}</a>
                      ) : (
                        <div className="text-sm text-foreground">{f.value}</div>
                      )}
                    </div>
                  </div>
                ))}
                {!(cliente.telefone || cliente.whatsapp || (cliente as any).email) && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato cadastrado</p>
                )}
              </CardContent>
            </Card>

            {/* Identificação */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Identificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "CPF", value: (cliente as any).cpfCnpj },
                  { label: "CNPJ", value: (cliente as any).cnpj },
                  { label: "RG", value: (cliente as any).rg },
                  { label: "Data de Nascimento", value: (cliente as any).dataNascimento ? formatarData((cliente as any).dataNascimento) : null },
                  { label: "Sexo", value: (cliente as any).sexo },
                  { label: "Estado Civil", value: (cliente as any).estadoCivil },
                  { label: "Nome da Mãe", value: (cliente as any).nomeMae },
                  { label: "Nome do Pai", value: (cliente as any).nomePai },
                  { label: "Chave PIX", value: (cliente as any).chavePix ? `${(cliente as any).chavePix} (${(cliente as any).tipoChavePix ?? ""})` : null },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground">{f.label}</span>
                    <span className="text-sm text-foreground font-medium">{f.value}</span>
                  </div>
                ))}
                {!((cliente as any).cpfCnpj || (cliente as any).rg) && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento cadastrado</p>
                )}
              </CardContent>
            </Card>

            {/* Endereço */}
            {((cliente as any).cep || cliente.cidade || cliente.endereco) && (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "CEP", value: (cliente as any).cep },
                    { label: "Logradouro", value: [cliente.endereco, (cliente as any).numero].filter(Boolean).join(", ") },
                    { label: "Complemento", value: (cliente as any).complemento },
                    { label: "Bairro", value: (cliente as any).bairro },
                    { label: "Cidade / UF", value: [cliente.cidade, cliente.estado].filter(Boolean).join(" — ") },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-xs text-muted-foreground">{f.label}</span>
                      <span className="text-sm text-foreground">{f.value}</span>
                    </div>
                  ))}
                  {cliente.cidade && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent([cliente.endereco, (cliente as any).numero, (cliente as any).bairro, cliente.cidade, cliente.estado].filter(Boolean).join(", "))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                    >
                      <ExternalLink className="h-3 w-3" /> Ver no Google Maps
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Observações */}
            {cliente.observacoes && (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('checks.observations')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{cliente.observacoes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── ABA: CONTRATOS ── */}
        <TabsContent value="contratos" className="mt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Contratos ({contratos?.length ?? 0})
                </CardTitle>
                <Button size="sm" className="gap-1" onClick={() => setLocation("/contratos/novo")}>
                  <Plus className="h-3 w-3" /> Novo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!contratos?.length && (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum contrato para este cliente</p>
                  <Button size="sm" className="mt-4 gap-1" onClick={() => setLocation("/contratos/novo")}>
                    <Plus className="h-3 w-3" /> Criar primeiro contrato
                  </Button>
                </div>
              )}
              {contratos?.map(contrato => (
                <div
                  key={contrato.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/emprestimos/${contrato.id}`)}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {MODALIDADE_LABELS[(contrato as any).modalidade] ?? (contrato as any).modalidade}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor((contrato as any).status)}`}>
                        {STATUS_CONTRATO_LABELS[(contrato as any).status] ?? (contrato as any).status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(contrato as any).numeroParcelas}x de {formatarMoeda((contrato as any).valorParcela)} · Início: {formatarData((contrato as any).dataInicio)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg text-foreground">{formatarMoeda((contrato as any).valorPrincipal)}</div>
                    <div className="text-xs text-muted-foreground">Principal</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA: PARCELAS ── */}
        <TabsContent value="parcelas" className="mt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Histórico de Parcelas
                </CardTitle>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-400" /> {metricas.qtdPagas} pagas</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-blue-400" /> {metricas.qtdPendentes} pendentes</span>
                  {metricas.qtdAtrasadas > 0 && (
                    <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-400" /> {metricas.qtdAtrasadas} atrasadas</span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!parcelas?.length && (
                <div className="text-center py-12">
                  <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma parcela encontrada</p>
                </div>
              )}
              <div className="space-y-2">
                {parcelas?.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        p.status === "paga" ? "bg-emerald-400" :
                        p.status === "atrasada" ? "bg-red-400" :
                        p.status === "vencendo_hoje" ? "bg-yellow-400" : "bg-blue-400"
                      }`} />
                      <div>
                        <div className="text-sm text-foreground">
                          Parcela {p.numeroParcela}/{(p as any).numeroParcelas}
                          <span className="text-xs text-muted-foreground ml-2">{MODALIDADE_LABELS[(p as any).modalidade] ?? (p as any).modalidade}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Vence: {formatarData(p.dataVencimento)}
                          {p.dataPagamento && <span className="ml-2 text-emerald-400">· Pago: {formatarData(p.dataPagamento)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(p.status)}`}>
                        {STATUS_PARCELA_LABELS[p.status] ?? p.status}
                      </span>
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">{formatarMoeda(parseFloat(String(p.valorOriginal)))}</div>
                        {p.valorPago && parseFloat(String(p.valorPago)) > 0 && (
                          <div className="text-xs text-emerald-400">Pago: {formatarMoeda(parseFloat(String(p.valorPago)))}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA: DOCUMENTOS ── */}
        <TabsContent value="documentos" className="mt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documentos Salvos ({documentos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentos.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum documento salvo</p>
                  <p className="text-xs text-muted-foreground mt-1">Edite o cliente para adicionar documentos na aba Documentos</p>
                  <Button size="sm" variant="outline" className="mt-4 gap-1" onClick={() => setLocation("/clientes")}>
                    <Edit className="h-3 w-3" /> Editar Cliente
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {documentos.map((doc: any, i: number) => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.url ?? "");
                  const ext = (doc.url ?? "").split(".").pop()?.toUpperCase() ?? "FILE";
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {isImage ? (
                          <img src={doc.url} alt={doc.descricao} className="w-10 h-10 object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">{ext}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">{doc.descricao || doc.nome || "Documento"}</div>
                        <div className="text-xs text-muted-foreground">
                          {doc.tamanho ? `${(doc.tamanho / 1024).toFixed(0)} KB` : ""}
                          {doc.data ? ` · ${formatarData(doc.data)}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(doc.url, "_blank")}
                          title="Visualizar"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = doc.url;
                            a.download = doc.nome || "documento";
                            a.click();
                          }}
                          title="Baixar"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
