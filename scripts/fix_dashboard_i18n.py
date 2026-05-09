import re

with open('/home/ubuntu/cobrapro/client/src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

replacements = [
    # Botão Relatório Diário
    ("relatorioDiarioMutation.isPending ? 'Gerando...' : 'Relatório Diário'",
     "relatorioDiarioMutation.isPending ? t('common.generating') : t('dashboard.dailyReportButton')"),
    ("relatorioDiarioMutation.isPending ? '...' : 'Relatório'",
     "relatorioDiarioMutation.isPending ? '...' : t('dashboard.dailyReport')"),
    # Score do Negócio title
    ("<BarChart2 className=\"h-3.5 w-3.5\" /> Score do Negócio",
     "<BarChart2 className=\"h-3.5 w-3.5\" /> {t('dashboard.businessScore')}"),
    # Precisa de Atenção
    ("<ShieldAlert className=\"h-3.5 w-3.5\" /> Precisa de Atenção",
     "<ShieldAlert className=\"h-3.5 w-3.5\" /> {t('dashboard.needsAttention')}"),
    # parcelas nos próximos 7 dias
    ("{atencao?.venceSemana.qtd ?? 0} parcelas nos próximos 7 dias",
     "{atencao?.venceSemana.qtd ?? 0} {t('dashboard.installmentsNext7Days')}"),
    # clientes com atraso grave
    ("{atencao?.atrasados30.qtd ?? 0} clientes com atraso grave",
     "{atencao?.atrasados30.qtd ?? 0} {t('dashboard.clientsWithSeriousDelay')}"),
    # Atalhos rápidos
    ("<Zap className=\"h-3 w-3\" /> Empréstimos",
     "<Zap className=\"h-3 w-3\" /> {t('dashboard.loans')}"),
    ("<Users className=\"h-3 w-3\" /> Clientes",
     "<Users className=\"h-3 w-3\" /> {t('dashboard.clients2')}"),
    ("<Wallet className=\"h-3 w-3\" /> Caixa",
     "<Wallet className=\"h-3 w-3\" /> {t('dashboard.cashbox')}"),
    # Taxa de inadimplência
    ("Taxa de inadimplência: <span",
     "{t('dashboard.delinquencyRate')}: <span"),
    # Em dia / Inadimplente
    ("<div className=\"w-2 h-2 rounded-full bg-success\" /> Em dia: {formatarMoeda((kpis.capitalCirculacao - kpis.totalInadimplente))}",
     "<div className=\"w-2 h-2 rounded-full bg-success\" /> {t('dashboard.onTime')}: {formatarMoeda((kpis.capitalCirculacao - kpis.totalInadimplente))}"),
    ("<div className=\"w-2 h-2 rounded-full bg-primary\" /> Inadimplente: {formatarMoeda(kpis.totalInadimplente)}",
     "<div className=\"w-2 h-2 rounded-full bg-primary\" /> {t('dashboard.delinquent')}: {formatarMoeda(kpis.totalInadimplente)}"),
    # contratos ativos
    ("`${kpis?.contratosAtivos ?? 0} contratos ativos`",
     "`${kpis?.contratosAtivos ?? 0} ${t('dashboard.activeContracts')}`"),
    # Tendência de Recebimentos
    ("<BarChart2 className=\"h-3.5 w-3.5\" /> Tendência de Recebimentos - Últimos 6 Meses",
     "<BarChart2 className=\"h-3.5 w-3.5\" /> {t('dashboard.receivingTrend')}"),
    # Tooltip Recebido
    ("formatter={(v: number) => [formatarMoeda(v), 'Recebido']}",
     "formatter={(v: number) => [formatarMoeda(v), t('dashboard.received')]}"),
    # Vencendo Hoje
    ("Vencendo Hoje ({parcelasHoje?.length ?? 0})",
     "{t('dashboard.dueTodayTitle')} ({parcelasHoje?.length ?? 0})"),
    # Parcela X/Y
    ("<div className=\"text-xs text-muted-foreground\">Parcela {p.numeroParcela}/{p.totalParcelas}</div>",
     "<div className=\"text-xs text-muted-foreground\">{t('common.installment')} {p.numeroParcela}/{p.totalParcelas}</div>"),
    # Em Atraso
    ("Em Atraso ({atrasadas?.length ?? 0})",
     "{t('dashboard.overdueTitle')} ({atrasadas?.length ?? 0})"),
    # Ver todas
    (">Ver todas <ChevronRight",
     ">{t('dashboard.viewAll')} <ChevronRight"),
    # Fluxo de Recebimentos
    ("<BarChart2 className=\"h-3.5 w-3.5\" /> Fluxo de Recebimentos - Últimos 7 Dias",
     "<BarChart2 className=\"h-3.5 w-3.5\" /> {t('dashboard.cashFlowWeek')}"),
    # Resumo do Dia
    ("<CardTitle className=\"text-sm font-medium text-muted-foreground uppercase tracking-wide\">\n              Resumo do Dia\n            </CardTitle>",
     "<CardTitle className=\"text-sm font-medium text-muted-foreground uppercase tracking-wide\">\n              {t('dashboard.dailySummary')}\n            </CardTitle>"),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        print(f'✅ Replaced: {old[:60]}...')
    else:
        print(f'❌ Not found: {old[:60]}...')

with open('/home/ubuntu/cobrapro/client/src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)

print('\nDone!')
