import { useTranslation } from 'react-i18next';
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, List, LayoutGrid, X, MessageCircle, CheckCircle } from "lucide-react";
import { formatarMoeda } from "../../../shared/finance";
import { useLocation } from "wouter";
import { toast } from "sonner";

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Parcela = any;

export default function Calendario() {
  const { t } = useTranslation();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [modo, setModo] = useState<"mensal" | "semanal" | "lista">("mensal");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [filtroKoletor, setFiltroKoletor] = useState<string>("todos");
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);
  const [, navigate] = useLocation();

  const { data: parcelasRaw } = trpc.parcelas.list.useQuery({});
  const { data: koletores } = (trpc as any).koletores?.list?.useQuery?.() ?? { data: [] };
  const pagarMutation = (trpc.parcelas as any).pagar?.useMutation ? (trpc.parcelas as any).pagar.useMutation({
    onSuccess: () => { toast.success("Parcela paga com sucesso!"); },
    onError: () => toast.error("Erro ao pagar parcela"),
  }) : { mutate: () => {}, isPending: false };

  // Filtrar por cobrador
  const parcelas = useMemo(() => {
    if (!parcelasRaw) return [];
    if (filtroKoletor === "todos") return parcelasRaw;
    const koletorId = parseInt(filtroKoletor);
    return parcelasRaw.filter((p: Parcela) => p.koletorId === koletorId);
  }, [parcelasRaw, filtroKoletor]);

  // Agrupar parcelas por dia
  const parcelasPorDia = useMemo(() => {
    const map = new Map<string, Parcela[]>();
    parcelas.forEach((p: Parcela) => {
      const d = new Date(p.dataVencimento);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return map;
  }, [parcelas]);

  // Gerar dias do mês
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const dias: (number | null)[] = [...Array(primeiroDia).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)];
  while (dias.length % 7 !== 0) dias.push(null);

  // Semana atual
  const inicioSemana = useMemo(() => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - d.getDay() + semanaOffset * 7);
    return d;
  }, [semanaOffset]);

  const diasSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicioSemana);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [inicioSemana]);

  const navMes = (delta: number) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    if (novoMes > 11) { novoMes = 0; novoAno++; }
    setMes(novoMes);
    setAno(novoAno);
  };

  const getDiaInfo = (diaNum: number, mesNum = mes, anoNum = ano) => {
    const key = `${anoNum}-${mesNum}-${diaNum}`;
    const ps = parcelasPorDia.get(key) ?? [];
    const atrasadas = ps.filter(p => p.status === 'atrasada').length;
    const vencendo = ps.filter(p => p.status === 'vencendo_hoje').length;
    const pendentes = ps.filter(p => p.status === 'pendente').length;
    const pagas = ps.filter(p => p.status === 'paga').length;
    const total = ps.reduce((sum, p) => sum + parseFloat(p.valorOriginal), 0);
    return { ps, atrasadas, vencendo, pendentes, pagas, total };
  };

  const getDiaInfoFromDate = (date: Date) => getDiaInfo(date.getDate(), date.getMonth(), date.getFullYear());

  const isHoje = (dia: number, mesNum = mes, anoNum = ano) =>
    dia === hoje.getDate() && mesNum === hoje.getMonth() && anoNum === hoje.getFullYear();

  // Resumo do mês
  const parcelasMes = parcelas.filter((p: Parcela) => {
    const d = new Date(p.dataVencimento);
    return d.getMonth() === mes && d.getFullYear() === ano;
  });
  const totalMes = parcelasMes.reduce((sum: number, p: Parcela) => sum + parseFloat(p.valorOriginal), 0);
  const recebidoMes = parcelasMes.filter((p: Parcela) => p.status === 'paga').reduce((sum: number, p: Parcela) => sum + parseFloat(p.valorPago ?? p.valorOriginal), 0);

  // Parcelas do dia selecionado
  const parcelasDiaSelecionado = diaSelecionado
    ? (parcelasPorDia.get(`${ano}-${mes}-${diaSelecionado}`) ?? [])
    : [];

  const statusBadge = (status: string) => {
    if (status === 'paga') return <Badge className="bg-success/20 text-success border-success/30 text-[10px]">Paga</Badge>;
    if (status === 'atrasada') return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Atrasada</Badge>;
    if (status === 'vencendo_hoje') return <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">Hoje</Badge>;
    return <Badge className="bg-muted text-muted-foreground text-[10px]">Pendente</Badge>;
  };

  const abrirWhatsApp = (parcela: Parcela) => {
    const msg = `Olá ${parcela.clienteNome || 'cliente'}, sua parcela ${parcela.numeroParcela}/${parcela.totalParcelas} de ${formatarMoeda(parseFloat(parcela.valorOriginal))} vence hoje. Por favor, efetue o pagamento.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">CALENDÁRIO</h1>
          <p className="text-sm text-muted-foreground mt-1">Vencimentos e cobranças</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro por cobrador */}
          {koletores && koletores.length > 0 && (
            <Select value={filtroKoletor} onValueChange={setFiltroKoletor}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Todos cobradores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {koletores.map((k: any) => (
                  <SelectItem key={k.id} value={String(k.id)}>{k.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Alternância de modo */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <Button
              variant={modo === "mensal" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-8 px-3 text-xs gap-1"
              onClick={() => setModo("mensal")}
            >
              <LayoutGrid className="h-3 w-3" /> Mensal
            </Button>
            <Button
              variant={modo === "semanal" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-8 px-3 text-xs gap-1 border-x border-border"
              onClick={() => setModo("semanal")}
            >
              <Calendar className="h-3 w-3" /> Semanal
            </Button>
            <Button
              variant={modo === "lista" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-8 px-3 text-xs gap-1"
              onClick={() => setModo("lista")}
            >
              <List className="h-3 w-3" /> Lista
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs do mês */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">A Receber no Mês</div>
            <div className="font-display text-xl text-foreground">{formatarMoeda(totalMes)}</div>
            <div className="text-xs text-muted-foreground mt-1">{parcelasMes.length} parcelas</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Já Recebido</div>
            <div className="font-display text-xl text-success">{formatarMoeda(recebidoMes)}</div>
            <div className="text-xs text-muted-foreground mt-1">{parcelasMes.filter((p: Parcela) => p.status === 'paga').length} pagas</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pendente</div>
            <div className="font-display text-xl text-warning">{formatarMoeda(totalMes - recebidoMes)}</div>
            <div className="text-xs text-muted-foreground mt-1">{parcelasMes.filter((p: Parcela) => p.status !== 'paga').length} pendentes</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        {/* Calendário principal */}
        <div className="flex-1">
          {/* MODO MENSAL */}
          {modo === "mensal" && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => navMes(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="font-display text-xl tracking-wide">
                    {MESES[mes]} {ano}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => navMes(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-7 mb-2">
                  {DIAS_SEMANA.map(d => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {dias.map((dia, i) => {
                    if (!dia) return <div key={i} />;
                    const { ps, atrasadas, vencendo, pendentes, pagas, total } = getDiaInfo(dia);
                    const temParcelas = ps.length > 0;
                    const isSelecionado = diaSelecionado === dia;
                    const corDia = atrasadas > 0 ? 'border-destructive/40 bg-destructive/5' :
                      vencendo > 0 ? 'border-warning/40 bg-warning/5' :
                      pendentes > 0 ? 'border-border bg-muted/20' :
                      pagas > 0 ? 'border-success/20 bg-success/5' :
                      'border-transparent';

                    return (
                      <div
                        key={i}
                        onClick={() => { if (temParcelas) setDiaSelecionado(isSelecionado ? null : dia); }}
                        className={`min-h-[72px] p-1.5 rounded-lg border transition-all cursor-pointer hover:border-primary/30 ${corDia} ${isHoje(dia) ? 'ring-2 ring-primary' : ''} ${isSelecionado ? 'ring-2 ring-primary/60 bg-primary/10' : ''}`}
                      >
                        <div className={`text-xs font-medium mb-1 ${isHoje(dia) ? 'text-primary' : 'text-foreground'}`}>
                          {dia}
                        </div>
                        {temParcelas && (
                          <div className="space-y-0.5">
                            {atrasadas > 0 && (
                              <div className="text-[10px] px-1 py-0.5 rounded bg-destructive/15 text-destructive font-medium">
                                {atrasadas} atr.
                              </div>
                            )}
                            {vencendo > 0 && (
                              <div className="text-[10px] px-1 py-0.5 rounded bg-warning/15 text-warning font-medium">
                                {vencendo} hoje
                              </div>
                            )}
                            {pendentes > 0 && (
                              <div className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                                {pendentes} pend.
                              </div>
                            )}
                            {total > 0 && (
                              <div className="text-[10px] text-muted-foreground truncate">
                                {formatarMoeda(total)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                  {[
                    { color: 'bg-destructive/20', label: 'Atrasada' },
                    { color: 'bg-warning/20', label: 'Vence Hoje' },
                    { color: 'bg-muted', label: 'Pendente' },
                    { color: 'bg-success/20', label: 'Paga' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className={`h-3 w-3 rounded ${l.color}`} />
                      <span className="text-xs text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* MODO SEMANAL */}
          {modo === "semanal" && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => setSemanaOffset(s => s - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <CardTitle className="font-display text-lg tracking-wide">
                      {diasSemana[0].getDate()}/{diasSemana[0].getMonth() + 1} — {diasSemana[6].getDate()}/{diasSemana[6].getMonth() + 1}/{diasSemana[6].getFullYear()}
                    </CardTitle>
                    {semanaOffset !== 0 && (
                      <Button variant="link" size="sm" className="text-xs h-5 p-0" onClick={() => setSemanaOffset(0)}>
                        Voltar para hoje
                      </Button>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSemanaOffset(s => s + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-7 gap-2">
                  {diasSemana.map((date, i) => {
                    const { ps, atrasadas, vencendo, pendentes, pagas, total } = getDiaInfoFromDate(date);
                    const temParcelas = ps.length > 0;
                    const isHojeDate = date.toDateString() === hoje.toDateString();
                    const corDia = atrasadas > 0 ? 'border-destructive/40 bg-destructive/5' :
                      vencendo > 0 ? 'border-warning/40 bg-warning/5' :
                      pendentes > 0 ? 'border-border bg-muted/20' :
                      pagas > 0 ? 'border-success/20 bg-success/5' :
                      'border-transparent';

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (temParcelas) {
                            setMes(date.getMonth());
                            setAno(date.getFullYear());
                            setDiaSelecionado(date.getDate());
                          }
                        }}
                        className={`min-h-[120px] p-2 rounded-lg border transition-all cursor-pointer hover:border-primary/30 ${corDia} ${isHojeDate ? 'ring-2 ring-primary' : ''}`}
                      >
                        <div className={`text-xs font-medium mb-1 ${isHojeDate ? 'text-primary' : 'text-foreground'}`}>
                          <div>{DIAS_SEMANA[i]}</div>
                          <div className="text-base">{date.getDate()}</div>
                        </div>
                        {temParcelas && (
                          <div className="space-y-1 mt-2">
                            {ps.slice(0, 3).map((p: Parcela) => (
                              <div key={p.id} className="text-[10px] px-1 py-0.5 rounded bg-background/50 border border-border truncate">
                                {p.clienteNome || `Parcela ${p.numeroParcela}`}
                              </div>
                            ))}
                            {ps.length > 3 && (
                              <div className="text-[10px] text-muted-foreground">+{ps.length - 3} mais</div>
                            )}
                            {total > 0 && (
                              <div className="text-[10px] font-medium text-foreground mt-1">{formatarMoeda(total)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* MODO LISTA */}
          {modo === "lista" && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => navMes(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="font-display text-xl tracking-wide">
                    {MESES[mes]} {ano}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => navMes(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {Array.from({ length: diasNoMes }, (_, i) => i + 1).map(dia => {
                  const { ps, total } = getDiaInfo(dia);
                  if (ps.length === 0) return null;
                  return (
                    <div key={dia} className="border-b border-border last:border-0">
                      <div
                        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-muted/30"
                        onClick={() => setDiaSelecionado(diaSelecionado === dia ? null : dia)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isHoje(dia) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                            {dia}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{DIAS_SEMANA[new Date(ano, mes, dia).getDay()]}, {dia} de {MESES[mes]}</div>
                            <div className="text-xs text-muted-foreground">{ps.length} parcela{ps.length > 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className="text-sm font-display">{formatarMoeda(total)}</div>
                      </div>
                      {diaSelecionado === dia && ps.map((p: Parcela) => (
                        <div key={p.id} className="flex items-center justify-between px-4 py-2 bg-muted/20 border-t border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold">
                              {p.numeroParcela}
                            </div>
                            <div>
                              <div className="text-xs font-medium">{p.clienteNome || `Parcela ${p.numeroParcela}/${p.totalParcelas}`}</div>
                              <div className="text-[10px] text-muted-foreground">{formatarMoeda(parseFloat(p.valorOriginal))}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {statusBadge(p.status)}
                            {p.status !== 'paga' && (
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => abrirWhatsApp(p)}>
                                <MessageCircle className="h-3 w-3 text-success" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Painel lateral de detalhes do dia */}
        {diaSelecionado && parcelasDiaSelecionado.length > 0 && (
          <div className="w-72 shrink-0">
            <Card className="border-border sticky top-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {DIAS_SEMANA[new Date(ano, mes, diaSelecionado).getDay()]}, {diaSelecionado} de {MESES[mes]}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDiaSelecionado(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {parcelasDiaSelecionado.length} parcela{parcelasDiaSelecionado.length > 1 ? 's' : ''} • {formatarMoeda(parcelasDiaSelecionado.reduce((s: number, p: Parcela) => s + parseFloat(p.valorOriginal), 0))}
                </div>
              </CardHeader>
              <CardContent className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                {/* Envio em massa */}
                {parcelasDiaSelecionado.filter((p: Parcela) => p.status !== 'paga').length > 1 && (
                  <button
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-green-600/15 border border-green-600/30 text-green-500 text-xs font-medium hover:bg-green-600/25 transition-colors"
                    onClick={() => {
                      const pendentes = parcelasDiaSelecionado.filter((p: Parcela) => p.status !== 'paga');
                      pendentes.forEach((p: Parcela, idx: number) => {
                        setTimeout(() => {
                          const msg = `Olá ${p.clienteNome || 'cliente'}, sua parcela ${p.numeroParcela}/${p.totalParcelas} de ${formatarMoeda(parseFloat(p.valorOriginal))} vence hoje. Por favor, efetue o pagamento. Obrigado!`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                        }, idx * 500);
                      });
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Enviar WhatsApp para todos ({parcelasDiaSelecionado.filter((p: Parcela) => p.status !== 'paga').length} pendentes)
                  </button>
                )}
                {parcelasDiaSelecionado.map((p: Parcela) => (
                  <div key={p.id} className="p-2 rounded-lg border border-border bg-muted/10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium truncate flex-1">{p.clienteNome || `Contrato #${p.contratoId}`}</div>
                      {statusBadge(p.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Parcela {p.numeroParcela}/{p.totalParcelas}</span>
                      <span className="font-medium text-foreground">{formatarMoeda(parseFloat(p.valorOriginal))}</span>
                    </div>
                    {p.status !== 'paga' && (
                      <div className="flex gap-1 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-6 text-[10px] gap-1"
                          onClick={() => abrirWhatsApp(p)}
                        >
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-6 text-[10px] gap-1 bg-success hover:bg-success/90"
                          onClick={() => pagarMutation.mutate({ id: p.id, valorPago: parseFloat(p.valorOriginal) })}
                          disabled={pagarMutation.isPending}
                        >
                          <CheckCircle className="h-3 w-3" /> Pagar
                        </Button>
                      </div>
                    )}
                    {p.contratoId && (
                      <Button
                        size="sm"
                        variant="link"
                        className="h-5 p-0 text-[10px] text-muted-foreground"
                        onClick={() => navigate(`/emprestimos?contrato=${p.contratoId}`)}
                      >
                        Ver contrato →
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
