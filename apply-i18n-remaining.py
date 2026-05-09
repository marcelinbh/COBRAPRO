#!/usr/bin/env python3
"""
Script para aplicar traduções i18n nas páginas restantes do CobraPro.
Foca em substituições de textos inline (>Texto< e >Texto\n).
"""

import os
import re

pages_dir = "/home/ubuntu/cobrapro/client/src/pages"

def apply_inline_replacements(content, replacements):
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Caixa.tsx - textos inline
caixa_replacements = [
    ('>Nova Conta<', '>{t(\'cashbox.newTransaction\')}<'),
    ('>NOVA CONTA<', '>{t(\'cashbox.title\').toUpperCase()}<'),
    ('>Nome da Conta *<', '>{t(\'cashbox.account\')} *<'),
    ('>Tipo<', '>{t(\'cashbox.type\')}<'),
    ('>Caixa Físico<', '>{t(\'cashbox.other\')}<'),
    ('>Banco<', '>{t(\'cashbox.account\')}<'),
    ('>Conta Digital<', '>{t(\'cashbox.account\')}<'),
    ('>Saldo Inicial (R$)<', '>{t(\'cashbox.balance\')} (R$)<'),
    ('>Nova Transação<', '>{t(\'cashbox.newTransaction\')}<'),
    ('>NOVA TRANSAÇÃO<', '>{t(\'cashbox.newTransaction\').toUpperCase()}<'),
    ('>Conta *<', '>{t(\'cashbox.account\')} *<'),
    ('>Categoria<', '>{t(\'cashbox.type\')}<'),
    ('>Pagamento de Parcela<', '>{t(\'cashbox.paymentReceived\')}<'),
    ('>Empréstimo Liberado<', '>{t(\'cashbox.loanDisbursement\')}<'),
    ('>Despesa Operacional<', '>{t(\'cashbox.operationalExpense\')}<'),
    ('>Transferência entre Contas<', '>{t(\'cashbox.other\')}<'),
    ('>Ajuste Manual<', '>{t(\'cashbox.other\')}<'),
    ('>Outros<', '>{t(\'cashbox.other\')}<'),
    ('>Valor (R$) *<', '>{t(\'cashbox.amount\')} (R$) *<'),
    ('>Descrição<', '>{t(\'cashbox.description\')}<'),
    ('>Descrição (opcional)<', '>{t(\'cashbox.description\')} ({t(\'common.optional\')})<'),
    ('>Cancelar<', '>{t(\'common.cancel\')}<'),
    ('>CAIXA<', '>{t(\'cashbox.title\').toUpperCase()}<'),
    ('>Gestão de contas e transações<', '>{t(\'cashbox.transactions\')}<'),
    ('>Saldo Total em Todas as Contas<', '>{t(\'cashbox.totalIncome\')}<'),
    ('>Contas<', '>{t(\'cashbox.account\')}<'),
    ('>Saldo negativo<', '>{t(\'cashbox.balance\')}<'),
    ('>Nenhuma conta cadastrada<', '>{t(\'common.noData\')}<'),
    ('>Nenhuma transação registrada<', '>{t(\'common.noData\')}<'),
]

# Veiculos.tsx - textos inline
veiculos_replacements = [
    ('>Veículos<', '>{t(\'vehicles.title\')}<'),
    ('>VEÍCULOS<', '>{t(\'vehicles.title\').toUpperCase()}<'),
    ('>Novo Veículo<', '>{t(\'vehicles.newVehicle\')}<'),
    ('>NOVO VEÍCULO<', '>{t(\'vehicles.newVehicle\').toUpperCase()}<'),
    ('>Pesquisar veículo...<', '>{t(\'vehicles.searchVehicle\')}<'),
    ('>Placa<', '>{t(\'vehicles.plate\')}<'),
    ('>Modelo<', '>{t(\'vehicles.model\')}<'),
    ('>Marca<', '>{t(\'vehicles.brand\')}<'),
    ('>Ano<', '>{t(\'vehicles.year\')}<'),
    ('>Cor<', '>{t(\'vehicles.color\')}<'),
    ('>Status<', '>{t(\'vehicles.status\')}<'),
    ('>Disponível<', '>{t(\'vehicles.active\')}<'),
    ('>Vendido<', '>{t(\'vehicles.sold\')}<'),
    ('>Reservado<', '>{t(\'vehicles.reserved\')}<'),
    ('>Em Manutenção<', '>{t(\'vehicles.maintenance\')}<'),
    ('>Ações<', '>{t(\'vehicles.actions\')}<'),
    ('>Nenhum veículo encontrado<', '>{t(\'vehicles.noVehicles\')}<'),
    ('>Adicionar Veículo<', '>{t(\'vehicles.addVehicle\')}<'),
    ('>Editar Veículo<', '>{t(\'vehicles.editVehicle\')}<'),
    ('>Excluir Veículo<', '>{t(\'vehicles.deleteVehicle\')}<'),
    ('>Total de Veículos<', '>{t(\'vehicles.totalVehicles\')}<'),
    ('>Veículos Disponíveis<', '>{t(\'vehicles.availableVehicles\')}<'),
    ('>Veículos Vendidos<', '>{t(\'vehicles.soldVehicles\')}<'),
    ('>Exportar Veículos<', '>{t(\'vehicles.exportVehicles\')}<'),
    ('>Preço de Compra<', '>{t(\'vehicles.purchasePrice\')}<'),
    ('>Preço de Venda<', '>{t(\'vehicles.salePrice\')}<'),
    ('>Quilometragem<', '>{t(\'vehicles.mileage\')}<'),
    ('>Combustível<', '>{t(\'vehicles.fuel\')}<'),
    ('>Câmbio<', '>{t(\'vehicles.transmission\')}<'),
    ('>Manual<', '>{t(\'vehicles.manual\')}<'),
    ('>Automático<', '>{t(\'vehicles.automatic\')}<'),
    ('>Gasolina<', '>{t(\'vehicles.gasoline\')}<'),
    ('>Etanol<', '>{t(\'vehicles.ethanol\')}<'),
    ('>Diesel<', '>{t(\'vehicles.diesel\')}<'),
    ('>Elétrico<', '>{t(\'vehicles.electric\')}<'),
    ('>Híbrido<', '>{t(\'vehicles.hybrid\')}<'),
    ('>Flex<', '>{t(\'vehicles.flex\')}<'),
    ('>Chassi<', '>{t(\'vehicles.chassis\')}<'),
    ('>RENAVAM<', '>{t(\'vehicles.renavam\')}<'),
    ('>Data de Venda<', '>{t(\'vehicles.saleDate\')}<'),
    ('>Valor de Entrada<', '>{t(\'vehicles.entryValue\')}<'),
    ('>Valor Financiado<', '>{t(\'vehicles.financedValue\')}<'),
    ('>Parcelas<', '>{t(\'vehicles.installments\')}<'),
    ('>Observações<', '>{t(\'vehicles.notes\')}<'),
    ('>Fotos<', '>{t(\'vehicles.photos\')}<'),
    ('>Documentos<', '>{t(\'vehicles.documents\')}<'),
]

# Scores.tsx - textos inline
scores_replacements = [
    ('>Score de Clientes<', '>{t(\'scores.title\')}<'),
    ('>SCORE DE CLIENTES<', '>{t(\'scores.title\').toUpperCase()}<'),
    ('>Análise de crédito e risco<', '>{t(\'scores.subtitle\')}<'),
    ('>Score do Cliente<', '>{t(\'scores.clientScore\')}<'),
    ('>Score do Negócio<', '>{t(\'scores.businessScore\')}<'),
    ('>Nível de Risco<', '>{t(\'scores.riskLevel\')}<'),
    ('>Baixo<', '>{t(\'scores.low\')}<'),
    ('>Médio<', '>{t(\'scores.medium\')}<'),
    ('>Alto<', '>{t(\'scores.high\')}<'),
    ('>Muito Alto<', '>{t(\'scores.veryHigh\')}<'),
    ('>Excelente<', '>{t(\'scores.excellent\')}<'),
    ('>Bom<', '>{t(\'scores.good\')}<'),
    ('>Regular<', '>{t(\'scores.regular\')}<'),
    ('>Ruim<', '>{t(\'scores.poor\')}<'),
    ('>Histórico de Pagamentos<', '>{t(\'scores.paymentHistory\')}<'),
    ('>Recomendações<', '>{t(\'scores.recommendations\')}<'),
    ('>Aprovar<', '>{t(\'scores.approve\')}<'),
    ('>Rejeitar<', '>{t(\'scores.reject\')}<'),
    ('>Revisar<', '>{t(\'scores.review\')}<'),
]

# Relatorios.tsx - textos inline
relatorios_replacements = [
    ('>Relatórios<', '>{t(\'reports.title\')}<'),
    ('>RELATÓRIOS<', '>{t(\'reports.title\').toUpperCase()}<'),
    ('>Relatório de Empréstimos<', '>{t(\'reports.loans\')}<'),
    ('>Relatório de Inadimplência<', '>{t(\'reports.delinquency\')}<'),
    ('>Relatório de Fluxo de Caixa<', '>{t(\'reports.cashFlow\')}<'),
    ('>Performance do Cobrador<', '>{t(\'reports.collectorPerformance\')}<'),
    ('>Mês<', '>{t(\'reports.month\')}<'),
    ('>Ano<', '>{t(\'reports.year\')}<'),
    ('>Gerar Relatório<', '>{t(\'reports.generate\')}<'),
    ('>Exportar Relatório<', '>{t(\'reports.export\')}<'),
    ('>Relatório Diário<', '>{t(\'reports.dailyReport\')}<'),
    ('>Relatório Mensal<', '>{t(\'reports.monthlyReport\')}<'),
    ('>Relatório Anual<', '>{t(\'reports.yearlyReport\')}<'),
    ('>Período<', '>{t(\'reports.period\')}<'),
    ('>Imprimir<', '>{t(\'reports.print\')}<'),
    ('>Baixar<', '>{t(\'reports.download\')}<'),
    ('>Total de Empréstimos<', '>{t(\'reports.totalLoans\')}<'),
    ('>Total de Clientes<', '>{t(\'reports.totalClients\')}<'),
    ('>Receita Total<', '>{t(\'reports.totalRevenue\')}<'),
    ('>Total de Despesas<', '>{t(\'reports.totalExpenses\')}<'),
    ('>Lucro Líquido<', '>{t(\'reports.netProfit\')}<'),
    ('>Taxa de Inadimplência<', '>{t(\'reports.delinquencyRate\')}<'),
    ('>Taxa de Cobrança<', '>{t(\'reports.collectionRate\')}<'),
    ('>Empréstimo Médio<', '>{t(\'reports.averageLoan\')}<'),
    ('>Juros Médio<', '>{t(\'reports.averageInterest\')}<'),
]

# AnaliseRisco.tsx - textos inline
analise_risco_replacements = [
    ('>Análise de Risco<', '>{t(\'riskAnalysis.title\')}<'),
    ('>ANÁLISE DE RISCO<', '>{t(\'riskAnalysis.title\').toUpperCase()}<'),
    ('>Análise detalhada de risco da carteira<', '>{t(\'riskAnalysis.subtitle\')}<'),
    ('>Risco da Carteira<', '>{t(\'riskAnalysis.portfolioRisk\')}<'),
    ('>Risco do Cliente<', '>{t(\'riskAnalysis.clientRisk\')}<'),
    ('>Risco do Empréstimo<', '>{t(\'riskAnalysis.loanRisk\')}<'),
    ('>Nível de Risco<', '>{t(\'riskAnalysis.riskLevel\')}<'),
    ('>Taxa de Inadimplência<', '>{t(\'riskAnalysis.delinquencyRate\')}<'),
    ('>Recomendações<', '>{t(\'riskAnalysis.recommendations\')}<'),
    ('>Alertas<', '>{t(\'riskAnalysis.alerts\')}<'),
    ('>Exportar Relatório<', '>{t(\'riskAnalysis.exportReport\')}<'),
    ('>Baixo<', '>{t(\'riskAnalysis.low\')}<'),
    ('>Médio<', '>{t(\'riskAnalysis.medium\')}<'),
    ('>Alto<', '>{t(\'riskAnalysis.high\')}<'),
    ('>Muito Alto<', '>{t(\'riskAnalysis.veryHigh\')}<'),
]

# Reparcelamento.tsx - textos inline
reparcelamento_replacements = [
    ('>Reparcelamento<', '>{t(\'reparcelamento.title\')}<'),
    ('>REPARCELAMENTO<', '>{t(\'reparcelamento.title\').toUpperCase()}<'),
    ('>Novo Reparcelamento<', '>{t(\'reparcelamento.newReparcelamento\')}<'),
    ('>Cliente<', '>{t(\'reparcelamento.client\')}<'),
    ('>Valor Original<', '>{t(\'reparcelamento.originalValue\')}<'),
    ('>Novo Valor<', '>{t(\'reparcelamento.newValue\')}<'),
    ('>Parcelas<', '>{t(\'reparcelamento.installments\')}<'),
    ('>Vencimento<', '>{t(\'reparcelamento.dueDate\')}<'),
    ('>Status<', '>{t(\'reparcelamento.status\')}<'),
    ('>Ações<', '>{t(\'reparcelamento.actions\')}<'),
    ('>Nenhum reparcelamento encontrado<', '>{t(\'reparcelamento.noReparcelamentos\')}<'),
]

# Inadimplencia.tsx - textos inline
inadimplencia_replacements = [
    ('>Inadimplência<', '>{t(\'inadimplencia.title\')}<'),
    ('>INADIMPLÊNCIA<', '>{t(\'inadimplencia.title\').toUpperCase()}<'),
    ('>Clientes com pagamentos em atraso<', '>{t(\'inadimplencia.subtitle\')}<'),
    ('>Total Inadimplente<', '>{t(\'inadimplencia.totalDelinquent\')}<'),
    ('>Taxa de Inadimplência<', '>{t(\'inadimplencia.delinquencyRate\')}<'),
    ('>Média de Dias em Atraso<', '>{t(\'inadimplencia.averageDaysOverdue\')}<'),
    ('>Total em Atraso<', '>{t(\'inadimplencia.totalOverdueAmount\')}<'),
    ('>Dias em Atraso<', '>{t(\'inadimplencia.daysOverdue\')}<'),
    ('>Valor em Atraso<', '>{t(\'inadimplencia.overdueAmount\')}<'),
    ('>Último Contato<', '>{t(\'inadimplencia.lastContact\')}<'),
    ('>Contatar<', '>{t(\'inadimplencia.contact\')}<'),
    ('>Ver Detalhes<', '>{t(\'inadimplencia.viewDetails\')}<'),
    ('>Enviar Notificação<', '>{t(\'inadimplencia.sendNotification\')}<'),
    ('>Marcar como Contatado<', '>{t(\'inadimplencia.markAsContacted\')}<'),
    ('>Exportar Relatório<', '>{t(\'inadimplencia.exportReport\')}<'),
]

# RelatorioDiario.tsx - textos inline
relatorio_diario_replacements = [
    ('>Relatório Diário<', '>{t(\'relatorioDiario.title\')}<'),
    ('>RELATÓRIO DIÁRIO<', '>{t(\'relatorioDiario.title\').toUpperCase()}<'),
    ('>Resumo das operações do dia<', '>{t(\'relatorioDiario.subtitle\')}<'),
    ('>Total Recebido<', '>{t(\'relatorioDiario.totalReceived\')}<'),
    ('>Total Desembolsado<', '>{t(\'relatorioDiario.totalDisbursed\')}<'),
    ('>Novos Empréstimos<', '>{t(\'relatorioDiario.newLoans\')}<'),
    ('>Empréstimos Pagos<', '>{t(\'relatorioDiario.paidLoans\')}<'),
    ('>Empréstimos Atrasados<', '>{t(\'relatorioDiario.overdueLoans\')}<'),
    ('>Novos Clientes<', '>{t(\'relatorioDiario.newClients\')}<'),
    ('>Pagamentos Recebidos<', '>{t(\'relatorioDiario.paymentsReceived\')}<'),
    ('>Pagamentos a Receber<', '>{t(\'relatorioDiario.paymentsDue\')}<'),
    ('>Saldo em Caixa<', '>{t(\'relatorioDiario.cashBalance\')}<'),
]

# Configuracoes.tsx - textos inline
configuracoes_replacements = [
    ('>Configuração<', '>{t(\'configuration.title\')}<'),
    ('>CONFIGURAÇÃO<', '>{t(\'configuration.title\').toUpperCase()}<'),
    ('>Geral<', '>{t(\'configuration.general\')}<'),
    ('>Segurança<', '>{t(\'configuration.security\')}<'),
    ('>Notificações<', '>{t(\'configuration.notifications\')}<'),
    ('>WhatsApp<', '>{t(\'configuration.whatsapp\')}<'),
    ('>Backup<', '>{t(\'configuration.backup\')}<'),
    ('>Salvar Configurações<', '>{t(\'configuration.save\')}<'),
    ('>Nome da Empresa<', '>{t(\'configuration.companyName\')}<'),
    ('>Telefone da Empresa<', '>{t(\'configuration.companyPhone\')}<'),
    ('>E-mail da Empresa<', '>{t(\'configuration.companyEmail\')}<'),
    ('>Endereço da Empresa<', '>{t(\'configuration.companyAddress\')}<'),
    ('>CNPJ da Empresa<', '>{t(\'configuration.companyCnpj\')}<'),
    ('>Moeda<', '>{t(\'configuration.currency\')}<'),
    ('>Fuso Horário<', '>{t(\'configuration.timezone\')}<'),
    ('>Idioma<', '>{t(\'configuration.language\')}<'),
    ('>Tema<', '>{t(\'configuration.theme\')}<'),
]

# NovoContrato.tsx - textos inline
novo_contrato_replacements = [
    ('>Novo Contrato<', '>{t(\'novoContrato.title\')}<'),
    ('>NOVO CONTRATO<', '>{t(\'novoContrato.title\').toUpperCase()}<'),
    ('>Selecionar Cliente<', '>{t(\'novoContrato.selectClient\')}<'),
    ('>Taxa de Juros<', '>{t(\'novoContrato.interestRate\')}<'),
    ('>Número de Parcelas<', '>{t(\'novoContrato.installments\')}<'),
    ('>Modalidade<', '>{t(\'novoContrato.modality\')}<'),
    ('>Diário<', '>{t(\'novoContrato.daily\')}<'),
    ('>Semanal<', '>{t(\'novoContrato.weekly\')}<'),
    ('>Quinzenal<', '>{t(\'novoContrato.biweekly\')}<'),
    ('>Mensal<', '>{t(\'novoContrato.monthly\')}<'),
    ('>Data de Início<', '>{t(\'novoContrato.startDate\')}<'),
    ('>Primeiro Vencimento<', '>{t(\'novoContrato.firstDueDate\')}<'),
    ('>Observações<', '>{t(\'novoContrato.notes\')}<'),
    ('>Salvar<', '>{t(\'novoContrato.save\')}<'),
    ('>Cancelar<', '>{t(\'novoContrato.cancel\')}<'),
    ('>Gerar Contrato<', '>{t(\'novoContrato.generate\')}<'),
    ('>Imprimir<', '>{t(\'novoContrato.print\')}<'),
    ('>Enviar<', '>{t(\'novoContrato.send\')}<'),
    ('>Baixar<', '>{t(\'novoContrato.download\')}<'),
]

FILE_TRANSLATORS = {
    'Caixa.tsx': caixa_replacements,
    'Veiculos.tsx': veiculos_replacements,
    'Scores.tsx': scores_replacements,
    'Relatorios.tsx': relatorios_replacements,
    'AnaliseRisco.tsx': analise_risco_replacements,
    'Reparcelamento.tsx': reparcelamento_replacements,
    'Inadimplencia.tsx': inadimplencia_replacements,
    'RelatorioDiario.tsx': relatorio_diario_replacements,
    'Configuracoes.tsx': configuracoes_replacements,
    'NovoContrato.tsx': novo_contrato_replacements,
}

total_modified = 0
for filename, replacements in FILE_TRANSLATORS.items():
    filepath = os.path.join(pages_dir, filename)
    if not os.path.exists(filepath):
        print(f"SKIP (not found): {filename}")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = apply_inline_replacements(content, replacements)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"MODIFIED: {filename}")
        total_modified += 1
    else:
        print(f"NO CHANGE: {filename}")

print(f"\nTotal de arquivos modificados: {total_modified}")
print("Traduções inline aplicadas com sucesso!")
