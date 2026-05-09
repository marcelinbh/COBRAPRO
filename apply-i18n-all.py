#!/usr/bin/env python3
"""
Script para aplicar traduções i18n em todas as páginas do CobraPro.
Abordagem: substituição direta de strings de texto por chamadas t().
"""

import os
import re

pages_dir = "/home/ubuntu/cobrapro/client/src/pages"

# Mapeamento de textos para chaves de tradução
# Formato: (padrão_regex, substituição)
# Usamos substituições específicas para cada contexto

def apply_translations_to_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Garantir que useTranslation está importado
    if "useTranslation" not in content:
        content = re.sub(
            r"(import \{[^}]*\} from 'react';|import React[^;]*;)",
            r"\1\nimport { useTranslation } from 'react-i18next';",
            content, count=1
        )
    
    # Garantir que const { t } = useTranslation() está no componente principal
    if "const { t }" not in content and "const {t}" not in content:
        # Tentar encontrar o componente principal exportado
        match = re.search(r"(export (?:default )?function \w+[^{]*\{)", content)
        if match:
            pos = match.end()
            content = content[:pos] + "\n  const { t } = useTranslation();" + content[pos:]
    
    return content, content != original

# Processar Dashboard.tsx - substituições específicas
def translate_dashboard(content):
    replacements = [
        # Títulos e labels em KPICard
        ('title="Saldo em Contas"', 'title={t(\'dashboard.balance\')}'),
        ('subtitle="Todas as contas"', 'subtitle={t(\'dashboard.allAccounts\')}'),
        ('title="Capital em Circulação"', 'title={t(\'dashboard.capital\')}'),
        ('title="Total a Receber"', 'title={t(\'dashboard.toReceive2\')}'),
        ('subtitle="Parcelas pendentes"', 'subtitle={t(\'dashboard.pendingInstallments\')}'),
        ('title="Inadimplência"', 'title={t(\'dashboard.delinquency\')}'),
        ('title="Juros Pendentes"', 'title={t(\'dashboard.interest\')}'),
        ('subtitle="Acumulados"', 'subtitle={t(\'dashboard.accumulated\')}'),
        ('title="Vence Hoje"', 'title={t(\'dashboard.dueToday\')}'),
        # Textos inline
        ('>Score do Negócio<', '>{t(\'dashboard.businessScore\')}<'),
        ('>DASHBOARD<', '>{t(\'dashboard.title\')}<'),
        ('>Novo Contrato<', '>{t(\'common.newContract\')}<'),
        ('>Saúde da Carteira<', '>{t(\'dashboard.portfolioHealth\')}<'),
        ('>Taxa de inadimplência:<', '>{t(\'dashboard.delinquencyRate\')}:<'),
        ('>Taxa de recebimento<', '>{t(\'dashboard.received\')}<'),
        ('>Inadimplência<', '>{t(\'dashboard.delinquency\')}<'),
        ('>Total recebido<', '>{t(\'dashboard.received\')}<'),
        ('>Vence esta semana<', '>{t(\'dashboard.dueThisWeek\')}<'),
        ('>Inadimplentes +30 dias<', '>{t(\'dashboard.overdueMore30Days\')}<'),
        ('>Recebido Hoje<', '>{t(\'dashboard.received\')}<'),
        ('>Vence Hoje<', '>{t(\'dashboard.dueToday\')}<'),
        ('>Contratos Ativos<', '>{t(\'dashboard.activeContracts2\')}<'),
        ('>Nenhuma parcela vence hoje<', '>{t(\'common.noData\')}<'),
        ('>Nenhuma parcela em atraso<', '>{t(\'common.noData\')}<'),
        # Botões
        ('<span className="hidden sm:inline">Novo Contrato</span>', '<span className="hidden sm:inline">{t(\'common.newContract\')}</span>'),
        ('<span className="sm:hidden">Novo</span>', '<span className="sm:hidden">{t(\'common.new\')}</span>'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Backup.tsx
def translate_backup(content):
    replacements = [
        ('>Backup de Dados<', '>{t(\'backup.title\')}<'),
        ('>Exporte seus dados em CSV ou JSON para backup seguro<', '>{t(\'backup.subtitle\')}<'),
        ('"Formato de Exportação"', '{t(\'backup.exportFormat\')}'),
        ('"CSV (Planilha)"', '{t(\'backup.csv\')}'),
        ('"JSON (Estruturado)"', '{t(\'backup.json\')}'),
        ('"Filtros (para Parcelas e Transações)"', '{t(\'backup.filters\')}'),
        ('"Data Início"', '{t(\'backup.startDate\')}'),
        ('"Data Fim"', '{t(\'backup.endDate\')}'),
        ('"Status Parcelas"', '{t(\'backup.parcelStatus\')}'),
        ('"Todos os Status"', '{t(\'backup.allStatus\')}'),
        ('"Exportar por Módulo"', '{t(\'backup.exportByModule\')}'),
        ('"Clientes"', '{t(\'backup.clients\')}'),
        ('"Todos os Contratos"', '{t(\'backup.allContracts\')}'),
        ('"Empréstimos Diários"', '{t(\'backup.dailyLoans\')}'),
        ('"Somente modalidade Diário"', '{t(\'backup.dailyLoansSubtitle\')}'),
        ('"Parcelas"', '{t(\'backup.parcels\')}'),
        ('"Com filtros de data e status"', '{t(\'backup.parcelsSubtitle\')}'),
        ('"Vendas (Produtos + Veículos)"', '{t(\'backup.sales\')}'),
        ('"Transações de Caixa"', '{t(\'backup.transactions\')}'),
        ('"Com filtro de período"', '{t(\'backup.transactionsSubtitle\')}'),
        ('"Backup Completo"', '{t(\'backup.fullBackup\')}'),
        ('"Exporta todos os dados em um único arquivo JSON"', '{t(\'backup.fullBackupSubtitle\')}'),
        ('"Backup Completo (JSON)"', '{t(\'backup.fullBackupButton\')}'),
        ('"Dados Sensíveis"', '{t(\'backup.sensitiveData\')}'),
        ('"Exportar"', '{t(\'backup.export\')}'),
        ('"Exportando..."', '{t(\'backup.exporting\')}'),
        ('"registros"', '{t(\'backup.records\')}'),
        ('"exportados!"', '{t(\'backup.exportSuccess\')}'),
        ('"Erro ao exportar"', '{t(\'backup.exportError\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Vendas.tsx
def translate_vendas(content):
    replacements = [
        ('>Vendas<', '>{t(\'sales.title\')}<'),
        ('>Todas as Vendas<', '>{t(\'sales.allSales\')}<'),
        ('>Vendas de Produtos<', '>{t(\'sales.productSales\')}<'),
        ('>Vendas de Veículos<', '>{t(\'sales.vehicleSales\')}<'),
        ('>Vendas de Telefones<', '>{t(\'sales.phoneSales\')}<'),
        ('"Nova Venda"', '{t(\'sales.newSale\')}'),
        ('"Buscar venda..."', '{t(\'sales.searchSale\')}'),
        ('"Produto"', '{t(\'sales.product\')}'),
        ('"Cliente"', '{t(\'sales.client\')}'),
        ('"Valor"', '{t(\'sales.value\')}'),
        ('"Quantidade"', '{t(\'sales.quantity\')}'),
        ('"Data"', '{t(\'sales.date\')}'),
        ('"Status"', '{t(\'sales.status\')}'),
        ('"Ações"', '{t(\'sales.actions\')}'),
        ('"Nenhuma venda encontrada"', '{t(\'sales.noSales\')}'),
        ('"Total de Vendas"', '{t(\'sales.totalSales\')}'),
        ('"Receita Total"', '{t(\'sales.totalRevenue\')}'),
        ('"Total Pendente"', '{t(\'sales.totalPending\')}'),
        ('"Exportar Vendas"', '{t(\'sales.exportSales\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Clientes.tsx
def translate_clientes(content):
    replacements = [
        ('"Novo Cliente"', '{t(\'clients.newClient\')}'),
        ('"Pesquisar cliente..."', '{t(\'clients.searchClient\')}'),
        ('"Nome"', '{t(\'clients.name\')}'),
        ('"Telefone"', '{t(\'clients.phone\')}'),
        ('"CPF"', '{t(\'clients.cpf\')}'),
        ('"E-mail"', '{t(\'clients.email\')}'),
        ('"Endereço"', '{t(\'clients.address\')}'),
        ('"Cidade"', '{t(\'clients.city\')}'),
        ('"Status"', '{t(\'clients.status\')}'),
        ('"Ativo"', '{t(\'clients.active\')}'),
        ('"Inativo"', '{t(\'clients.inactive\')}'),
        ('"Ações"', '{t(\'clients.actions\')}'),
        ('"Editar"', '{t(\'clients.edit\')}'),
        ('"Excluir"', '{t(\'clients.delete\')}'),
        ('"Visualizar"', '{t(\'clients.view\')}'),
        ('"Nenhum cliente encontrado"', '{t(\'clients.noClients\')}'),
        ('"Adicionar Cliente"', '{t(\'clients.addClient\')}'),
        ('"Editar Cliente"', '{t(\'clients.editClient\')}'),
        ('"Excluir Cliente"', '{t(\'clients.deleteClient\')}'),
        ('"Total de Clientes"', '{t(\'clients.totalClients\')}'),
        ('"Clientes Ativos"', '{t(\'clients.activeClients\')}'),
        ('"Clientes Inativos"', '{t(\'clients.inactiveClients\')}'),
        ('"Exportar Clientes"', '{t(\'clients.exportClients\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Emprestimos.tsx
def translate_emprestimos(content):
    replacements = [
        ('"Novo Empréstimo"', '{t(\'loans.newLoan\')}'),
        ('"Pesquisar Empréstimo"', '{t(\'loans.searchLoan\')}'),
        ('"Cliente"', '{t(\'loans.client\')}'),
        ('"Valor"', '{t(\'loans.value\')}'),
        ('"Taxa"', '{t(\'loans.rate\')}'),
        ('"Modalidade"', '{t(\'loans.modality\')}'),
        ('"Diário"', '{t(\'loans.daily\')}'),
        ('"Semanal"', '{t(\'loans.weekly\')}'),
        ('"Quinzenal"', '{t(\'loans.biweekly\')}'),
        ('"Mensal"', '{t(\'loans.monthly\')}'),
        ('"Status"', '{t(\'loans.status\')}'),
        ('"Ativo"', '{t(\'loans.active\')}'),
        ('"Cancelado"', '{t(\'loans.cancelled\')}'),
        ('"Ações"', '{t(\'loans.actions\')}'),
        ('"Nenhum empréstimo encontrado"', '{t(\'loans.noLoans\')}'),
        ('"Total de Empréstimos"', '{t(\'loans.totalLoans\')}'),
        ('"Empréstimos Ativos"', '{t(\'loans.activeLoans\')}'),
        ('"Empréstimos Pagos"', '{t(\'loans.paidLoans\')}'),
        ('"Empréstimos Atrasados"', '{t(\'loans.overdueLoans\')}'),
        ('"Exportar Empréstimos"', '{t(\'loans.exportLoans\')}'),
        ('"Renovar Empréstimo"', '{t(\'loans.renewLoan\')}'),
        ('"Cancelar Empréstimo"', '{t(\'loans.cancelLoan\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Contratos.tsx
def translate_contratos(content):
    replacements = [
        ('"Novo Contrato"', '{t(\'contracts.newContract\')}'),
        ('"Pesquisar contrato..."', '{t(\'contracts.searchContract\')}'),
        ('"Cliente"', '{t(\'contracts.client\')}'),
        ('"Valor"', '{t(\'contracts.value\')}'),
        ('"Juros"', '{t(\'contracts.interest\')}'),
        ('"Parcelas"', '{t(\'contracts.installments\')}'),
        ('"Vencimento"', '{t(\'contracts.dueDate\')}'),
        ('"Status"', '{t(\'contracts.status\')}'),
        ('"Ativo"', '{t(\'contracts.active\')}'),
        ('"Pago"', '{t(\'contracts.paid\')}'),
        ('"Atrasado"', '{t(\'contracts.overdue\')}'),
        ('"Cancelado"', '{t(\'contracts.cancelled\')}'),
        ('"Ações"', '{t(\'contracts.actions\')}'),
        ('"Nenhum contrato encontrado"', '{t(\'contracts.noContracts\')}'),
        ('"Gerar Contrato"', '{t(\'contracts.generate\')}'),
        ('"Imprimir Contrato"', '{t(\'contracts.print\')}'),
        ('"Enviar Contrato"', '{t(\'contracts.send\')}'),
        ('"Baixar Contrato"', '{t(\'contracts.download\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Parcelas.tsx
def translate_parcelas(content):
    replacements = [
        ('"Número"', '{t(\'parcels.number\')}'),
        ('"Valor"', '{t(\'parcels.value\')}'),
        ('"Juros"', '{t(\'parcels.interest\')}'),
        ('"Data de Vencimento"', '{t(\'parcels.dueDate\')}'),
        ('"Data de Pagamento"', '{t(\'parcels.paymentDate\')}'),
        ('"Status"', '{t(\'parcels.status\')}'),
        ('"Ações"', '{t(\'parcels.actions\')}'),
        ('"Pagar"', '{t(\'parcels.pay\')}'),
        ('"Detalhes"', '{t(\'parcels.details\')}'),
        ('"Pago"', '{t(\'parcels.paid\')}'),
        ('"Pendente"', '{t(\'parcels.pending\')}'),
        ('"Atrasado"', '{t(\'parcels.overdue\')}'),
        ('"Nenhuma parcela encontrada"', '{t(\'parcels.noParcels\')}'),
        ('"Total de Parcelas"', '{t(\'parcels.totalParcels\')}'),
        ('"Parcelas Pagas"', '{t(\'parcels.paidParcels\')}'),
        ('"Parcelas Pendentes"', '{t(\'parcels.pendingParcels\')}'),
        ('"Parcelas Atrasadas"', '{t(\'parcels.overdueParcels\')}'),
        ('"Exportar Parcelas"', '{t(\'parcels.exportParcels\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Caixa.tsx
def translate_caixa(content):
    replacements = [
        ('"Nova Transação"', '{t(\'cashbox.newTransaction\')}'),
        ('"Descrição"', '{t(\'cashbox.description\')}'),
        ('"Valor"', '{t(\'cashbox.amount\')}'),
        ('"Tipo"', '{t(\'cashbox.type\')}'),
        ('"Entrada"', '{t(\'cashbox.income2\')}'),
        ('"Saída"', '{t(\'cashbox.expense2\')}'),
        ('"Saldo do Dia"', '{t(\'cashbox.dailyBalance\')}'),
        ('"Total de Entradas"', '{t(\'cashbox.totalIncome\')}'),
        ('"Total de Saídas"', '{t(\'cashbox.totalExpense\')}'),
        ('"Saldo Líquido"', '{t(\'cashbox.netBalance\')}'),
        ('"Nenhuma transação encontrada"', '{t(\'cashbox.noTransactions\')}'),
        ('"Exportar Caixa"', '{t(\'cashbox.exportCashbox\')}'),
        ('"Imprimir Relatório"', '{t(\'cashbox.printReport\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Veiculos.tsx
def translate_veiculos(content):
    replacements = [
        ('"Novo Veículo"', '{t(\'vehicles.newVehicle\')}'),
        ('"Pesquisar veículo..."', '{t(\'vehicles.searchVehicle\')}'),
        ('"Placa"', '{t(\'vehicles.plate\')}'),
        ('"Modelo"', '{t(\'vehicles.model\')}'),
        ('"Marca"', '{t(\'vehicles.brand\')}'),
        ('"Ano"', '{t(\'vehicles.year\')}'),
        ('"Cor"', '{t(\'vehicles.color\')}'),
        ('"Status"', '{t(\'vehicles.status\')}'),
        ('"Disponível"', '{t(\'vehicles.active\')}'),
        ('"Vendido"', '{t(\'vehicles.sold\')}'),
        ('"Reservado"', '{t(\'vehicles.reserved\')}'),
        ('"Em Manutenção"', '{t(\'vehicles.maintenance\')}'),
        ('"Ações"', '{t(\'vehicles.actions\')}'),
        ('"Nenhum veículo encontrado"', '{t(\'vehicles.noVehicles\')}'),
        ('"Adicionar Veículo"', '{t(\'vehicles.addVehicle\')}'),
        ('"Editar Veículo"', '{t(\'vehicles.editVehicle\')}'),
        ('"Excluir Veículo"', '{t(\'vehicles.deleteVehicle\')}'),
        ('"Total de Veículos"', '{t(\'vehicles.totalVehicles\')}'),
        ('"Veículos Disponíveis"', '{t(\'vehicles.availableVehicles\')}'),
        ('"Veículos Vendidos"', '{t(\'vehicles.soldVehicles\')}'),
        ('"Exportar Veículos"', '{t(\'vehicles.exportVehicles\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar VendasTelefone.tsx
def translate_vendas_telefone(content):
    replacements = [
        ('"Nova Venda"', '{t(\'phoneSales.newSale\')}'),
        ('"Pesquisar venda..."', '{t(\'phoneSales.searchSale\')}'),
        ('"Marca"', '{t(\'phoneSales.brand\')}'),
        ('"Modelo"', '{t(\'phoneSales.model\')}'),
        ('"IMEI"', '{t(\'phoneSales.imei\')}'),
        ('"Comprador"', '{t(\'phoneSales.buyer\')}'),
        ('"Valor"', '{t(\'phoneSales.value\')}'),
        ('"Status"', '{t(\'phoneSales.status\')}'),
        ('"Ações"', '{t(\'phoneSales.actions\')}'),
        ('"Nenhuma venda encontrada"', '{t(\'phoneSales.noSales\')}'),
        ('"Total de Vendas"', '{t(\'phoneSales.totalSales\')}'),
        ('"Vendas Ativas"', '{t(\'phoneSales.activeSales\')}'),
        ('"Vendas Pagas"', '{t(\'phoneSales.paidSales\')}'),
        ('"Vendas Atrasadas"', '{t(\'phoneSales.overdueSales\')}'),
        ('"Total a Receber"', '{t(\'phoneSales.totalToReceive\')}'),
        ('"Total Recebido"', '{t(\'phoneSales.totalReceived\')}'),
        ('"Exportar Vendas"', '{t(\'phoneSales.exportSales\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Cobradores.tsx
def translate_cobradores(content):
    replacements = [
        ('"Novo Cobrador"', '{t(\'collectors.newCollector\')}'),
        ('"Pesquisar cobrador..."', '{t(\'collectors.searchCollector\')}'),
        ('"Nome"', '{t(\'collectors.name\')}'),
        ('"E-mail"', '{t(\'collectors.email\')}'),
        ('"Telefone"', '{t(\'collectors.phone\')}'),
        ('"Performance"', '{t(\'collectors.performance\')}'),
        ('"Status"', '{t(\'collectors.status\')}'),
        ('"Ativo"', '{t(\'collectors.active\')}'),
        ('"Inativo"', '{t(\'collectors.inactive\')}'),
        ('"Ações"', '{t(\'collectors.actions\')}'),
        ('"Nenhum cobrador encontrado"', '{t(\'collectors.noCollectors\')}'),
        ('"Adicionar Cobrador"', '{t(\'collectors.addCollector\')}'),
        ('"Editar Cobrador"', '{t(\'collectors.editCollector\')}'),
        ('"Excluir Cobrador"', '{t(\'collectors.deleteCollector\')}'),
        ('"Exportar Cobradores"', '{t(\'collectors.exportCollectors\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Cheques.tsx
def translate_cheques(content):
    replacements = [
        ('"Novo Cheque"', '{t(\'checks.newCheck\')}'),
        ('"Pesquisar cheque..."', '{t(\'checks.searchCheck\')}'),
        ('"Número"', '{t(\'checks.number\')}'),
        ('"Banco"', '{t(\'checks.bank\')}'),
        ('"Agência"', '{t(\'checks.agency\')}'),
        ('"Conta"', '{t(\'checks.account\')}'),
        ('"Valor"', '{t(\'checks.value\')}'),
        ('"Vencimento"', '{t(\'checks.dueDate\')}'),
        ('"Status"', '{t(\'checks.status\')}'),
        ('"Pendente"', '{t(\'checks.pending\')}'),
        ('"Depositado"', '{t(\'checks.deposited\')}'),
        ('"Devolvido"', '{t(\'checks.returned\')}'),
        ('"Cancelado"', '{t(\'checks.cancelled\')}'),
        ('"Ações"', '{t(\'checks.actions\')}'),
        ('"Nenhum cheque encontrado"', '{t(\'checks.noChecks\')}'),
        ('"Total de Cheques"', '{t(\'checks.totalChecks\')}'),
        ('"Cheques Pendentes"', '{t(\'checks.pendingChecks\')}'),
        ('"Cheques Depositados"', '{t(\'checks.depositedChecks\')}'),
        ('"Cheques Devolvidos"', '{t(\'checks.returnedChecks\')}'),
        ('"Exportar Cheques"', '{t(\'checks.exportChecks\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar ContasPagar.tsx
def translate_contas_pagar(content):
    replacements = [
        ('"Nova Conta"', '{t(\'accountsPayable.newAccount\')}'),
        ('"Pesquisar conta..."', '{t(\'accountsPayable.searchAccount\')}'),
        ('"Descrição"', '{t(\'accountsPayable.description\')}'),
        ('"Valor"', '{t(\'accountsPayable.value\')}'),
        ('"Vencimento"', '{t(\'accountsPayable.dueDate\')}'),
        ('"Status"', '{t(\'accountsPayable.status\')}'),
        ('"Pendente"', '{t(\'accountsPayable.pending\')}'),
        ('"Pago"', '{t(\'accountsPayable.paid\')}'),
        ('"Atrasado"', '{t(\'accountsPayable.overdue\')}'),
        ('"Cancelado"', '{t(\'accountsPayable.cancelled\')}'),
        ('"Ações"', '{t(\'accountsPayable.actions\')}'),
        ('"Nenhuma conta encontrada"', '{t(\'accountsPayable.noAccounts\')}'),
        ('"Adicionar Conta"', '{t(\'accountsPayable.addAccount\')}'),
        ('"Editar Conta"', '{t(\'accountsPayable.editAccount\')}'),
        ('"Excluir Conta"', '{t(\'accountsPayable.deleteAccount\')}'),
        ('"Total de Contas"', '{t(\'accountsPayable.totalAccounts\')}'),
        ('"Contas Pendentes"', '{t(\'accountsPayable.pendingAccounts\')}'),
        ('"Contas Pagas"', '{t(\'accountsPayable.paidAccounts\')}'),
        ('"Contas Atrasadas"', '{t(\'accountsPayable.overdueAccounts\')}'),
        ('"Total Pendente"', '{t(\'accountsPayable.totalPending\')}'),
        ('"Total Pago"', '{t(\'accountsPayable.totalPaid\')}'),
        ('"Total Atrasado"', '{t(\'accountsPayable.totalOverdue\')}'),
        ('"Pagar Conta"', '{t(\'accountsPayable.payAccount\')}'),
        ('"Marcar como Pago"', '{t(\'accountsPayable.markAsPaid\')}'),
        ('"Exportar Contas"', '{t(\'accountsPayable.exportAccounts\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Scores.tsx
def translate_scores(content):
    replacements = [
        ('"Score de Clientes"', '{t(\'scores.title\')}'),
        ('"Análise de crédito e risco"', '{t(\'scores.subtitle\')}'),
        ('"Score do Cliente"', '{t(\'scores.clientScore\')}'),
        ('"Score do Negócio"', '{t(\'scores.businessScore\')}'),
        ('"Nível de Risco"', '{t(\'scores.riskLevel\')}'),
        ('"Baixo"', '{t(\'scores.low\')}'),
        ('"Médio"', '{t(\'scores.medium\')}'),
        ('"Alto"', '{t(\'scores.high\')}'),
        ('"Muito Alto"', '{t(\'scores.veryHigh\')}'),
        ('"Excelente"', '{t(\'scores.excellent\')}'),
        ('"Bom"', '{t(\'scores.good\')}'),
        ('"Regular"', '{t(\'scores.regular\')}'),
        ('"Ruim"', '{t(\'scores.poor\')}'),
        ('"Pesquisar cliente..."', '{t(\'scores.searchClient\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Simulador.tsx
def translate_simulador(content):
    replacements = [
        ('"Simulador"', '{t(\'simulator.title\')}'),
        ('"Simule empréstimos e financiamentos"', '{t(\'simulator.subtitle\')}'),
        ('"Valor do Empréstimo"', '{t(\'simulator.loanAmount\')}'),
        ('"Taxa de Juros"', '{t(\'simulator.interestRate\')}'),
        ('"Número de Parcelas"', '{t(\'simulator.installments\')}'),
        ('"Modalidade"', '{t(\'simulator.modality\')}'),
        ('"Diário"', '{t(\'simulator.daily\')}'),
        ('"Semanal"', '{t(\'simulator.weekly\')}'),
        ('"Quinzenal"', '{t(\'simulator.biweekly\')}'),
        ('"Mensal"', '{t(\'simulator.monthly\')}'),
        ('"Simular"', '{t(\'simulator.simulate\')}'),
        ('"Resultado"', '{t(\'simulator.result\')}'),
        ('"Valor Total"', '{t(\'simulator.totalAmount\')}'),
        ('"Total de Juros"', '{t(\'simulator.totalInterest\')}'),
        ('"Valor da Parcela"', '{t(\'simulator.installmentValue\')}'),
        ('"Primeiro Vencimento"', '{t(\'simulator.firstDueDate\')}'),
        ('"Cronograma"', '{t(\'simulator.schedule\')}'),
        ('"Criar Empréstimo"', '{t(\'simulator.createLoan\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Relatorios.tsx
def translate_relatorios(content):
    replacements = [
        ('"Relatórios"', '{t(\'reports.title\')}'),
        ('"Relatório de Empréstimos"', '{t(\'reports.loans\')}'),
        ('"Relatório de Inadimplência"', '{t(\'reports.delinquency\')}'),
        ('"Relatório de Fluxo de Caixa"', '{t(\'reports.cashFlow\')}'),
        ('"Performance do Cobrador"', '{t(\'reports.collectorPerformance\')}'),
        ('"Mês"', '{t(\'reports.month\')}'),
        ('"Ano"', '{t(\'reports.year\')}'),
        ('"Gerar Relatório"', '{t(\'reports.generate\')}'),
        ('"Exportar Relatório"', '{t(\'reports.export\')}'),
        ('"Relatório Diário"', '{t(\'reports.dailyReport\')}'),
        ('"Relatório Mensal"', '{t(\'reports.monthlyReport\')}'),
        ('"Relatório Anual"', '{t(\'reports.yearlyReport\')}'),
        ('"Período"', '{t(\'reports.period\')}'),
        ('"Imprimir"', '{t(\'reports.print\')}'),
        ('"Baixar"', '{t(\'reports.download\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar AnaliseRisco.tsx
def translate_analise_risco(content):
    replacements = [
        ('"Análise de Risco"', '{t(\'riskAnalysis.title\')}'),
        ('"Análise detalhada de risco da carteira"', '{t(\'riskAnalysis.subtitle\')}'),
        ('"Risco da Carteira"', '{t(\'riskAnalysis.portfolioRisk\')}'),
        ('"Risco do Cliente"', '{t(\'riskAnalysis.clientRisk\')}'),
        ('"Risco do Empréstimo"', '{t(\'riskAnalysis.loanRisk\')}'),
        ('"Nível de Risco"', '{t(\'riskAnalysis.riskLevel\')}'),
        ('"Taxa de Inadimplência"', '{t(\'riskAnalysis.delinquencyRate\')}'),
        ('"Recomendações"', '{t(\'riskAnalysis.recommendations\')}'),
        ('"Alertas"', '{t(\'riskAnalysis.alerts\')}'),
        ('"Exportar Relatório"', '{t(\'riskAnalysis.exportReport\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Reparcelamento.tsx
def translate_reparcelamento(content):
    replacements = [
        ('"Reparcelamento"', '{t(\'reparcelamento.title\')}'),
        ('"Novo Reparcelamento"', '{t(\'reparcelamento.newReparcelamento\')}'),
        ('"Cliente"', '{t(\'reparcelamento.client\')}'),
        ('"Valor Original"', '{t(\'reparcelamento.originalValue\')}'),
        ('"Novo Valor"', '{t(\'reparcelamento.newValue\')}'),
        ('"Parcelas"', '{t(\'reparcelamento.installments\')}'),
        ('"Vencimento"', '{t(\'reparcelamento.dueDate\')}'),
        ('"Status"', '{t(\'reparcelamento.status\')}'),
        ('"Ações"', '{t(\'reparcelamento.actions\')}'),
        ('"Nenhum reparcelamento encontrado"', '{t(\'reparcelamento.noReparcelamentos\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Inadimplencia.tsx
def translate_inadimplencia(content):
    replacements = [
        ('"Inadimplência"', '{t(\'inadimplencia.title\')}'),
        ('"Clientes com pagamentos em atraso"', '{t(\'inadimplencia.subtitle\')}'),
        ('"Total Inadimplente"', '{t(\'inadimplencia.totalDelinquent\')}'),
        ('"Taxa de Inadimplência"', '{t(\'inadimplencia.delinquencyRate\')}'),
        ('"Média de Dias em Atraso"', '{t(\'inadimplencia.averageDaysOverdue\')}'),
        ('"Total em Atraso"', '{t(\'inadimplencia.totalOverdueAmount\')}'),
        ('"Dias em Atraso"', '{t(\'inadimplencia.daysOverdue\')}'),
        ('"Valor em Atraso"', '{t(\'inadimplencia.overdueAmount\')}'),
        ('"Último Contato"', '{t(\'inadimplencia.lastContact\')}'),
        ('"Contatar"', '{t(\'inadimplencia.contact\')}'),
        ('"Ver Detalhes"', '{t(\'inadimplencia.viewDetails\')}'),
        ('"Enviar Notificação"', '{t(\'inadimplencia.sendNotification\')}'),
        ('"Marcar como Contatado"', '{t(\'inadimplencia.markAsContacted\')}'),
        ('"Exportar Relatório"', '{t(\'inadimplencia.exportReport\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar RelatorioDiario.tsx
def translate_relatorio_diario(content):
    replacements = [
        ('"Relatório Diário"', '{t(\'relatorioDiario.title\')}'),
        ('"Resumo das operações do dia"', '{t(\'relatorioDiario.subtitle\')}'),
        ('"Total Recebido"', '{t(\'relatorioDiario.totalReceived\')}'),
        ('"Total Desembolsado"', '{t(\'relatorioDiario.totalDisbursed\')}'),
        ('"Novos Empréstimos"', '{t(\'relatorioDiario.newLoans\')}'),
        ('"Empréstimos Pagos"', '{t(\'relatorioDiario.paidLoans\')}'),
        ('"Empréstimos Atrasados"', '{t(\'relatorioDiario.overdueLoans\')}'),
        ('"Novos Clientes"', '{t(\'relatorioDiario.newClients\')}'),
        ('"Pagamentos Recebidos"', '{t(\'relatorioDiario.paymentsReceived\')}'),
        ('"Pagamentos a Receber"', '{t(\'relatorioDiario.paymentsDue\')}'),
        ('"Saldo em Caixa"', '{t(\'relatorioDiario.cashBalance\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Configuracoes.tsx
def translate_configuracoes(content):
    replacements = [
        ('"Configuração"', '{t(\'configuration.title\')}'),
        ('"Geral"', '{t(\'configuration.general\')}'),
        ('"Segurança"', '{t(\'configuration.security\')}'),
        ('"Notificações"', '{t(\'configuration.notifications\')}'),
        ('"WhatsApp"', '{t(\'configuration.whatsapp\')}'),
        ('"Backup"', '{t(\'configuration.backup\')}'),
        ('"Salvar Configurações"', '{t(\'configuration.save\')}'),
        ('"Nome da Empresa"', '{t(\'configuration.companyName\')}'),
        ('"Telefone da Empresa"', '{t(\'configuration.companyPhone\')}'),
        ('"E-mail da Empresa"', '{t(\'configuration.companyEmail\')}'),
        ('"Endereço da Empresa"', '{t(\'configuration.companyAddress\')}'),
        ('"CNPJ da Empresa"', '{t(\'configuration.companyCnpj\')}'),
        ('"Moeda"', '{t(\'configuration.currency\')}'),
        ('"Fuso Horário"', '{t(\'configuration.timezone\')}'),
        ('"Idioma"', '{t(\'configuration.language\')}'),
        ('"Tema"', '{t(\'configuration.theme\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar MeuPerfil.tsx
def translate_meu_perfil(content):
    replacements = [
        ('"Meu Perfil"', '{t(\'profile.title\')}'),
        ('"Dados Pessoais"', '{t(\'profile.personalData\')}'),
        ('"Alterar Senha"', '{t(\'profile.changePassword\')}'),
        ('"Senha Atual"', '{t(\'profile.currentPassword\')}'),
        ('"Nova Senha"', '{t(\'profile.newPassword\')}'),
        ('"Confirmar Senha"', '{t(\'profile.confirmPassword\')}'),
        ('"Salvar Alterações"', '{t(\'profile.save\')}'),
        ('"Nome"', '{t(\'profile.name\')}'),
        ('"E-mail"', '{t(\'profile.email\')}'),
        ('"Telefone"', '{t(\'profile.phone\')}'),
        ('"CPF"', '{t(\'profile.cpf\')}'),
        ('"Data de Nascimento"', '{t(\'profile.birthDate\')}'),
        ('"Endereço"', '{t(\'profile.address\')}'),
        ('"Foto"', '{t(\'profile.photo\')}'),
        ('"Alterar Foto"', '{t(\'profile.changePhoto\')}'),
        ('"Função"', '{t(\'profile.role\')}'),
        ('"Administrador"', '{t(\'profile.admin\')}'),
        ('"Usuário"', '{t(\'profile.user\')}'),
        ('"Cobrador"', '{t(\'profile.collector\')}'),
        ('"Cadastrado em"', '{t(\'profile.createdAt\')}'),
        ('"Último acesso"', '{t(\'profile.lastLogin\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar Usuarios.tsx
def translate_usuarios(content):
    replacements = [
        ('"Novo Usuário"', '{t(\'users.newUser\')}'),
        ('"Pesquisar usuário..."', '{t(\'users.searchUser\')}'),
        ('"Nome"', '{t(\'users.name\')}'),
        ('"E-mail"', '{t(\'users.email\')}'),
        ('"Função"', '{t(\'users.role\')}'),
        ('"Status"', '{t(\'users.status\')}'),
        ('"Ativo"', '{t(\'users.active\')}'),
        ('"Inativo"', '{t(\'users.inactive\')}'),
        ('"Ações"', '{t(\'users.actions\')}'),
        ('"Nenhum usuário encontrado"', '{t(\'users.noUsers\')}'),
        ('"Adicionar Usuário"', '{t(\'users.addUser\')}'),
        ('"Editar Usuário"', '{t(\'users.editUser\')}'),
        ('"Excluir Usuário"', '{t(\'users.deleteUser\')}'),
        ('"Administrador"', '{t(\'users.admin\')}'),
        ('"Total de Usuários"', '{t(\'users.totalUsers\')}'),
        ('"Usuários Ativos"', '{t(\'users.activeUsers\')}'),
        ('"Usuários Inativos"', '{t(\'users.inactiveUsers\')}'),
        ('"Exportar Usuários"', '{t(\'users.exportUsers\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Processar NovoContrato.tsx
def translate_novo_contrato(content):
    replacements = [
        ('"Novo Contrato"', '{t(\'novoContrato.title\')}'),
        ('"Selecionar Cliente"', '{t(\'novoContrato.selectClient\')}'),
        ('"Valor"', '{t(\'novoContrato.value\')}'),
        ('"Taxa de Juros"', '{t(\'novoContrato.interestRate\')}'),
        ('"Número de Parcelas"', '{t(\'novoContrato.installments\')}'),
        ('"Modalidade"', '{t(\'novoContrato.modality\')}'),
        ('"Diário"', '{t(\'novoContrato.daily\')}'),
        ('"Semanal"', '{t(\'novoContrato.weekly\')}'),
        ('"Quinzenal"', '{t(\'novoContrato.biweekly\')}'),
        ('"Mensal"', '{t(\'novoContrato.monthly\')}'),
        ('"Data de Início"', '{t(\'novoContrato.startDate\')}'),
        ('"Primeiro Vencimento"', '{t(\'novoContrato.firstDueDate\')}'),
        ('"Observações"', '{t(\'novoContrato.notes\')}'),
        ('"Salvar"', '{t(\'novoContrato.save\')}'),
        ('"Cancelar"', '{t(\'novoContrato.cancel\')}'),
        ('"Gerar Contrato"', '{t(\'novoContrato.generate\')}'),
        ('"Imprimir"', '{t(\'novoContrato.print\')}'),
        ('"Enviar"', '{t(\'novoContrato.send\')}'),
        ('"Baixar"', '{t(\'novoContrato.download\')}'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Mapeamento de arquivos para funções de tradução
FILE_TRANSLATORS = {
    'Dashboard.tsx': translate_dashboard,
    'Backup.tsx': translate_backup,
    'Vendas.tsx': translate_vendas,
    'Clientes.tsx': translate_clientes,
    'Emprestimos.tsx': translate_emprestimos,
    'Contratos.tsx': translate_contratos,
    'Parcelas.tsx': translate_parcelas,
    'Caixa.tsx': translate_caixa,
    'Veiculos.tsx': translate_veiculos,
    'VendasTelefone.tsx': translate_vendas_telefone,
    'Cobradores.tsx': translate_cobradores,
    'Cheques.tsx': translate_cheques,
    'ContasPagar.tsx': translate_contas_pagar,
    'Scores.tsx': translate_scores,
    'Simulador.tsx': translate_simulador,
    'Relatorios.tsx': translate_relatorios,
    'AnaliseRisco.tsx': translate_analise_risco,
    'Reparcelamento.tsx': translate_reparcelamento,
    'Inadimplencia.tsx': translate_inadimplencia,
    'RelatorioDiario.tsx': translate_relatorio_diario,
    'Configuracoes.tsx': translate_configuracoes,
    'MeuPerfil.tsx': translate_meu_perfil,
    'Usuarios.tsx': translate_usuarios,
    'NovoContrato.tsx': translate_novo_contrato,
}

# Aplicar traduções
total_modified = 0
for filename, translator in FILE_TRANSLATORS.items():
    filepath = os.path.join(pages_dir, filename)
    if not os.path.exists(filepath):
        print(f"SKIP (not found): {filename}")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Aplicar traduções específicas
    new_content = translator(content)
    
    # Garantir useTranslation
    if "useTranslation" not in new_content:
        # Adicionar import
        new_content = re.sub(
            r"(import \{[^}]*\} from 'react';|import React[^;]*;)",
            r"\1\nimport { useTranslation } from 'react-i18next';",
            new_content, count=1
        )
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"MODIFIED: {filename}")
        total_modified += 1
    else:
        print(f"NO CHANGE: {filename}")

print(f"\nTotal de arquivos modificados: {total_modified}")
print("Traduções aplicadas com sucesso!")
