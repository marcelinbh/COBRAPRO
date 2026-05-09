"""
Corrige textos hardcoded em Clientes.tsx, Parcelas.tsx, EmprestimoDetalhes.tsx, Relatorios.tsx
"""
import json, re

def load_json(fname):
    path = f'/home/ubuntu/cobrapro/client/src/i18n/locales/{fname}.json'
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def save_json(fname, data):
    path = f'/home/ubuntu/cobrapro/client/src/i18n/locales/{fname}.json'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def fix_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    count = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            count += 1
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    import os
    print(f'✅ Fixed {count}/{len(replacements)} in {os.path.basename(filepath)}')

def add_keys(section, ptbr_keys, es_keys):
    for fname, keys in [('pt-BR', ptbr_keys), ('es', es_keys)]:
        data = load_json(fname)
        if section not in data:
            data[section] = {}
        data[section].update(keys)
        save_json(fname, data)
    print(f'✅ Added {len(ptbr_keys)} keys to section "{section}"')

# ─── Clientes.tsx ─────────────────────────────────────────────────────────────
clientes_replacements = [
    ('>Avatar gerado automaticamente<', ">{t('clientes.avatarAuto')}<"),
    ('>A foto será enviada ao salvar o cliente<', ">{t('clientes.photoWillBeSaved')}<"),
    ('>Nome Completo *<', ">{t('clientes.fullNameRequired')}<"),
    ('>E-mail<', ">{t('common.email')}<"),
    ('>Telefone (com DDD)<', ">{t('clientes.phoneWithDDD')}<"),
    ('>Inclua o DDD para envio via WhatsApp<', ">{t('clientes.includeDDD')}<"),
    ('>Instagram<', ">{t('clientes.instagram')}<"),
    ('>Facebook<', ">{t('clientes.facebook')}<"),
    ('>Profissão<', ">{t('clientes.profession')}<"),
    ('>Tipo de Cliente<', ">{t('clientes.clientType')}<"),
    ('>Empréstimo<', ">{t('clientes.typeEmprestimo')}<"),
    ('>Mensalidade<', ">{t('clientes.typeMensalidade')}<"),
    ('>Ambos<', ">{t('clientes.typeBoth')}<"),
    ('>Cheque<', ">{t('clientes.typeCheque')}<"),
    ('>Veículo<', ">{t('clientes.typeVeiculo')}<"),
    ('>Cliente veio por indicação<', ">{t('clientes.referral')}<"),
    ('>Marque se este cliente foi indicado por outro<', ">{t('clientes.referralDesc')}<"),
    ('>Cliente ativo<', ">{t('clientes.activeClient')}<"),
    ('>Clientes inativos não aparecem nas cobranças<', ">{t('clientes.inactiveDesc')}<"),
    ('>Observações<', ">{t('common.notes')}<"),
    ('>Buscando...<', ">{t('common.loading')}<"),
    ('>Rua / Logradouro<', ">{t('clientes.street')}<"),
    ('>Número<', ">{t('clientes.number')}<"),
    ('>Complemento<', ">{t('clientes.complement')}<"),
    ('>Bairro<', ">{t('clientes.neighborhood')}<"),
    ('>Cidade<', ">{t('common.address')}<"),
    ('>Estado<', ">{t('clientes.state')}<"),
    ('>Descrição do Documento (opcional)<', ">{t('clientes.docDescription')}<"),
    ('>Documentos Salvos (<', ">{t('clientes.savedDocs')} (<"),
    ('>Cancelar<', ">{t('common.cancel')}<"),
    ('>Clientes<', ">{t('clientes.title')}<"),
    ('>Gerencie seus clientes<', ">{t('clientes.subtitle')}<"),
    ('>Todos os tipos<', ">{t('clientes.allTypes')}<"),
    ('>Todos<', ">{t('common.all')}<"),
    ('>Indicados<', ">{t('clientes.referred')}<"),
    ('>Não indicados<', ">{t('clientes.notReferred')}<"),
    ('>Cliente<', ">{t('common.client')}<"),
]

fix_file('/home/ubuntu/cobrapro/client/src/pages/Clientes.tsx', clientes_replacements)

add_keys('clientes', {
    'avatarAuto': 'Avatar gerado automaticamente',
    'photoWillBeSaved': 'A foto será enviada ao salvar o cliente',
    'fullNameRequired': 'Nome Completo *',
    'phoneWithDDD': 'Telefone (com DDD)',
    'includeDDD': 'Inclua o DDD para envio via WhatsApp',
    'instagram': 'Instagram',
    'facebook': 'Facebook',
    'profession': 'Profissão',
    'clientType': 'Tipo de Cliente',
    'typeEmprestimo': 'Empréstimo',
    'typeMensalidade': 'Mensalidade',
    'typeBoth': 'Ambos',
    'typeCheque': 'Cheque',
    'typeVeiculo': 'Veículo',
    'referral': 'Cliente veio por indicação',
    'referralDesc': 'Marque se este cliente foi indicado por outro',
    'activeClient': 'Cliente ativo',
    'inactiveDesc': 'Clientes inativos não aparecem nas cobranças',
    'street': 'Rua / Logradouro',
    'number': 'Número',
    'complement': 'Complemento',
    'neighborhood': 'Bairro',
    'state': 'Estado',
    'docDescription': 'Descrição do Documento (opcional)',
    'savedDocs': 'Documentos Salvos',
    'allTypes': 'Todos os tipos',
    'referred': 'Indicados',
    'notReferred': 'Não indicados',
}, {
    'avatarAuto': 'Avatar generado automáticamente',
    'photoWillBeSaved': 'La foto se enviará al guardar el cliente',
    'fullNameRequired': 'Nombre Completo *',
    'phoneWithDDD': 'Teléfono (con código de área)',
    'includeDDD': 'Incluya el código de área para envío por WhatsApp',
    'instagram': 'Instagram',
    'facebook': 'Facebook',
    'profession': 'Profesión',
    'clientType': 'Tipo de Cliente',
    'typeEmprestimo': 'Préstamo',
    'typeMensalidade': 'Mensualidad',
    'typeBoth': 'Ambos',
    'typeCheque': 'Cheque',
    'typeVeiculo': 'Vehículo',
    'referral': 'Cliente vino por referencia',
    'referralDesc': 'Marque si este cliente fue referido por otro',
    'activeClient': 'Cliente activo',
    'inactiveDesc': 'Los clientes inactivos no aparecen en los cobros',
    'street': 'Calle / Dirección',
    'number': 'Número',
    'complement': 'Complemento',
    'neighborhood': 'Barrio',
    'state': 'Estado',
    'docDescription': 'Descripción del Documento (opcional)',
    'savedDocs': 'Documentos Guardados',
    'allTypes': 'Todos los tipos',
    'referred': 'Referidos',
    'notReferred': 'No referidos',
})

# ─── Parcelas.tsx ─────────────────────────────────────────────────────────────
parcelas_replacements = [
    ('>Parcelas<', ">{t('parcelas.title')}<"),
    ('>Todas as Parcelas<', ">{t('parcelas.allInstallments')}<"),
    ('>Pendentes<', ">{t('parcelas.pending')}<"),
    ('>Pagas<', ">{t('parcelas.paidPlural')}<"),
    ('>Atrasadas<', ">{t('parcelas.overduePlural')}<"),
    ('>Vencendo Hoje<', ">{t('parcelas.dueTodayLabel')}<"),
    ('>Buscar por cliente...<', ">{t('parcelas.searchPlaceholder')}<"),
    ('>Todos os Status<', ">{t('parcelas.allStatuses')}<"),
    ('>Pendente<', ">{t('common.pending')}<"),
    ('>Pago<', ">{t('common.paid')}<"),
    ('>Atrasado<', ">{t('common.overdue')}<"),
    ('>Parcial<', ">{t('common.partial')}<"),
    ('>Vencimento<', ">{t('common.dueDate')}<"),
    ('>Valor<', ">{t('common.value')}<"),
    ('>Status<', ">{t('common.status')}<"),
    ('>Ações<', ">{t('common.actions')}<"),
    ('>Nenhuma parcela encontrada<', ">{t('parcelas.noParcelas')}<"),
    ('>Registrar Pagamento<', ">{t('parcelas.payInstallment')}<"),
    ('>Cancelar<', ">{t('common.cancel')}<"),
    ('>Confirmar<', ">{t('common.confirm')}<"),
    ('>Salvar<', ">{t('common.save')}<"),
    ('>Fechar<', ">{t('common.close')}<"),
]

fix_file('/home/ubuntu/cobrapro/client/src/pages/Parcelas.tsx', parcelas_replacements)

add_keys('parcelas', {
    'allInstallments': 'Todas as Parcelas',
    'pending': 'Pendente',
    'paidPlural': 'Pagas',
    'overduePlural': 'Atrasadas',
    'dueTodayLabel': 'Vencendo Hoje',
    'allStatuses': 'Todos os Status',
}, {
    'allInstallments': 'Todas las Cuotas',
    'pending': 'Pendiente',
    'paidPlural': 'Pagadas',
    'overduePlural': 'Atrasadas',
    'dueTodayLabel': 'Venciendo Hoy',
    'allStatuses': 'Todos los Estados',
})

# ─── Relatorios.tsx ─────────────────────────────────────────────────────────────
relatorios_replacements = [
    ('>Relatórios<', ">{t('relatorios.title')}<"),
    ('>Fluxo de Caixa<', ">{t('relatorios.cashFlow')}<"),
    ('>Inadimplência<', ">{t('relatorios.defaulters')}<"),
    ('>Performance<', ">{t('relatorios.performance')}<"),
    ('>Resumo Geral<', ">{t('relatorios.generalSummary')}<"),
    ('>Total Recebido<', ">{t('relatorios.totalReceived')}<"),
    ('>Total em Atraso<', ">{t('relatorios.totalOverdue')}<"),
    ('>Capital em Circulação<', ">{t('relatorios.capitalCirculating')}<"),
    ('>Lucro do Período<', ">{t('relatorios.periodProfit')}<"),
    ('>Exportar PDF<', ">{t('relatorios.exportPDF')}<"),
    ('>Exportar CSV<', ">{t('relatorios.exportCSV')}<"),
    ('>Período<', ">{t('relatorios.period')}<"),
    ('>Cancelar<', ">{t('common.cancel')}<"),
    ('>Fechar<', ">{t('common.close')}<"),
    ('>Carregando...<', ">{t('common.loading')}<"),
]

fix_file('/home/ubuntu/cobrapro/client/src/pages/Relatorios.tsx', relatorios_replacements)

add_keys('relatorios', {
    'title': 'Relatórios',
    'cashFlow': 'Fluxo de Caixa',
    'defaulters': 'Inadimplência',
    'performance': 'Performance',
    'generalSummary': 'Resumo Geral',
    'totalReceived': 'Total Recebido',
    'totalOverdue': 'Total em Atraso',
    'capitalCirculating': 'Capital em Circulação',
    'periodProfit': 'Lucro do Período',
    'exportPDF': 'Exportar PDF',
    'exportCSV': 'Exportar CSV',
    'period': 'Período',
}, {
    'title': 'Reportes',
    'cashFlow': 'Flujo de Caja',
    'defaulters': 'Morosidad',
    'performance': 'Rendimiento',
    'generalSummary': 'Resumen General',
    'totalReceived': 'Total Recibido',
    'totalOverdue': 'Total en Atraso',
    'capitalCirculating': 'Capital en Circulación',
    'periodProfit': 'Ganancia del Período',
    'exportPDF': 'Exportar PDF',
    'exportCSV': 'Exportar CSV',
    'period': 'Período',
})

# ─── EmprestimoDetalhes.tsx ─────────────────────────────────────────────────────
empdetalhes_replacements = [
    ('>Detalhes do Empréstimo<', ">{t('emprestimos.loanDetails')}<"),
    ('>Voltar<', ">{t('common.back')}<"),
    ('>Informações do Contrato<', ">{t('emprestimos.contractInfo')}<"),
    ('>Capital<', ">{t('common.capital')}<"),
    ('>Juros<', ">{t('common.interest')}<"),
    ('>Total<', ">{t('common.total')}<"),
    ('>Modalidade<', ">{t('emprestimos.modality')}<"),
    ('>Taxa<', ">{t('emprestimos.rate')}<"),
    ('>Início<', ">{t('emprestimos.startDate')}<"),
    ('>Vencimento<', ">{t('common.dueDate')}<"),
    ('>Parcelas<', ">{t('common.installments')}<"),
    ('>Histórico<', ">{t('common.history')}<"),
    ('>Comprovante<', ">{t('common.receipt')}<"),
    ('>Etiquetas<', ">{t('emprestimos.labels')}<"),
    ('>Pagar<', ">{t('emprestimos.pay')}<"),
    ('>Pagar Juros<', ">{t('emprestimos.payInterest')}<"),
    ('>Editar Juros<', ">{t('emprestimos.editInterest')}<"),
    ('>Aplicar Multa<', ">{t('emprestimos.applyFine')}<"),
    ('>Excluir<', ">{t('common.delete')}<"),
    ('>Cancelar<', ">{t('common.cancel')}<"),
    ('>Confirmar<', ">{t('common.confirm')}<"),
    ('>Salvar<', ">{t('common.save')}<"),
    ('>Fechar<', ">{t('common.close')}<"),
    ('>Carregando...<', ">{t('common.loading')}<"),
    ('>Nenhum histórico registrado ainda.<', ">{t('emprestimos.noHistory')}<"),
    ('>As ações futuras aparecerão aqui.<', ">{t('emprestimos.historyWillAppear')}<"),
]

fix_file('/home/ubuntu/cobrapro/client/src/pages/EmprestimoDetalhes.tsx', empdetalhes_replacements)

add_keys('emprestimos', {
    'loanDetails': 'Detalhes do Empréstimo',
    'contractInfo': 'Informações do Contrato',
    'modality': 'Modalidade',
    'rate': 'Taxa',
    'startDate': 'Início',
    'labels': 'Etiquetas',
    'pay': 'Pagar',
    'payInterest': 'Pagar Juros',
    'editInterest': 'Editar Juros',
    'applyFine': 'Aplicar Multa',
}, {
    'loanDetails': 'Detalles del Préstamo',
    'contractInfo': 'Información del Contrato',
    'modality': 'Modalidad',
    'rate': 'Tasa',
    'startDate': 'Inicio',
    'labels': 'Etiquetas',
    'pay': 'Pagar',
    'payInterest': 'Pagar Intereses',
    'editInterest': 'Editar Intereses',
    'applyFine': 'Aplicar Multa',
})

print('\n✅ All 4 pages fixed successfully!')
