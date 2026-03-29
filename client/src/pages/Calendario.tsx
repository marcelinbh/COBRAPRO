import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { formatarMoeda } from "../../../shared/finance";

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Calendario() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const { data: parcelas } = trpc.parcelas.list.useQuery({});

  // Agrupar parcelas por dia
  const parcelasPorDia = new Map<string, typeof parcelas>();
  parcelas?.forEach(p => {
    const d = new Date(p.dataVencimento);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!parcelasPorDia.has(key)) parcelasPorDia.set(key, []);
    parcelasPorDia.get(key)!.push(p);
  });

  // Gerar dias do mês
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const dias: (number | null)[] = [...Array(primeiroDia).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)];
  // Completar até múltiplo de 7
  while (dias.length % 7 !== 0) dias.push(null);

  const navMes = (delta: number) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    if (novoMes > 11) { novoMes = 0; novoAno++; }
    setMes(novoMes);
    setAno(novoAno);
  };

  const getDiaInfo = (dia: number) => {
    const key = `${ano}-${mes}-${dia}`;
    const ps = parcelasPorDia.get(key) ?? [];
    const atrasadas = ps.filter(p => p.status === 'atrasada').length;
    const vencendo = ps.filter(p => p.status === 'vencendo_hoje').length;
    const pendentes = ps.filter(p => p.status === 'pendente').length;
    const pagas = ps.filter(p => p.status === 'paga').length;
    const total = ps.reduce((sum, p) => sum + parseFloat(p.valorOriginal), 0);
    return { ps, atrasadas, vencendo, pendentes, pagas, total };
  };

  const isHoje = (dia: number) => dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();

  // Resumo do mês
  const parcelasMes = parcelas?.filter(p => {
    const d = new Date(p.dataVencimento);
    return d.getMonth() === mes && d.getFullYear() === ano;
  }) ?? [];
  const totalMes = parcelasMes.reduce((sum, p) => sum + parseFloat(p.valorOriginal), 0);
  const recebidoMes = parcelasMes.filter(p => p.status === 'paga').reduce((sum, p) => sum + parseFloat(p.valorPago ?? p.valorOriginal), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">CALENDÁRIO</h1>
          <p className="text-sm text-muted-foreground mt-1">Vencimentos e cobranças</p>
        </div>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">A Receber no Mês</div>
            <div className="font-display text-xl text-foreground">{formatarMoeda(totalMes)}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Já Recebido</div>
            <div className="font-display text-xl text-success">{formatarMoeda(recebidoMes)}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pendente</div>
            <div className="font-display text-xl text-warning">{formatarMoeda(totalMes - recebidoMes)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Calendário */}
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
          {/* Cabeçalho dos dias */}
          <div className="grid grid-cols-7 mb-2">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-1">
            {dias.map((dia, i) => {
              if (!dia) return <div key={i} />;
              const { ps, atrasadas, vencendo, pendentes, pagas, total } = getDiaInfo(dia);
              const temParcelas = ps.length > 0;
              const corDia = atrasadas > 0 ? 'border-primary/40 bg-primary/5' :
                vencendo > 0 ? 'border-warning/40 bg-warning/5' :
                pendentes > 0 ? 'border-border bg-muted/20' :
                pagas > 0 ? 'border-success/20 bg-success/5' :
                'border-transparent';

              return (
                <div
                  key={i}
                  className={`min-h-[72px] p-1.5 rounded-lg border transition-all ${corDia} ${isHoje(dia) ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isHoje(dia) ? 'text-primary' : 'text-foreground'}`}>
                    {dia}
                  </div>
                  {temParcelas && (
                    <div className="space-y-0.5">
                      {atrasadas > 0 && (
                        <div className="text-[10px] px-1 py-0.5 rounded bg-primary/15 text-primary font-medium">
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

          {/* Legenda */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
            {[
              { color: 'bg-primary/20', label: 'Atrasada' },
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
    </div>
  );
}
