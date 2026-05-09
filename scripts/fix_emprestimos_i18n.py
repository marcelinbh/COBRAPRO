"""
Corrige textos hardcoded em Emprestimos.tsx
"""
import json

with open('/home/ubuntu/cobrapro/client/src/pages/Emprestimos.tsx', 'r') as f:
    content = f.read()

replacements = [
    # Modal unificado - abas
    ('"Editar"', "t('common.edit')"),
    ('"Detalhes"', "t('common.details')"),
    ('"Histórico"', "t('common.history')"),
    ('"Comprovante"', "t('common.receipt')"),
    # Tabela de parcelas
    ('>Todas as Parcelas<', ">{t('emprestimos.allInstallments')}<"),
    ('>Vencimento<', ">{t('common.dueDate')}<"),
    ('>Valor<', ">{t('common.value')}<"),
    ('>Status<', ">{t('common.status')}<"),
    ('>Editar<', ">{t('common.edit')}<"),
    # Nova parcela
    ('>Nova Parcela<', ">{t('emprestimos.newInstallment')}<"),
    ('Data de Vencimento *', "{t('emprestimos.dueDateRequired')}"),
    # Histórico
    ('>Nenhum histórico registrado ainda.<', ">{t('emprestimos.noHistory')}<"),
    ('>As ações futuras aparecerão aqui.<', ">{t('emprestimos.historyWillAppear')}<"),
    ('Histórico de Alterações (', "{t('emprestimos.changeHistory')} ("),
    # Antes/Depois
    ('>Antes: <', ">{t('common.before')}: <"),
    ('>Depois: <', ">{t('common.after')}: <"),
    # Comprovante
    ('Gera o comprovante de pagamento com os dados da empresa configurados em Configurações.', "{t('emprestimos.receiptInfo')}"),
    # Modal pagamento
    ('>Pagamento Registrado!<', ">{t('emprestimos.paymentRegistered')}<"),
    ('>Capital<', ">{t('common.capital')}<"),
    ('>Juros<', ">{t('common.interest')}<"),
    ('>Total<', ">{t('common.total')}<"),
    # Só juros
    ('Pagando apenas os juros, o contrato é renovado sem abater o principal.', "{t('emprestimos.interestOnlyInfo')}"),
    ('Opções do Próximo Vencimento (opcional)', "{t('emprestimos.nextDueDateOptions')}"),
    ('Data do Próximo Vencimento', "{t('emprestimos.nextDueDate')}"),
    ('Deixe em branco para calcular automaticamente', "{t('emprestimos.leaveBlankAutoCalc')}"),
    ('Valor do Próximo Vencimento (R$)', "{t('emprestimos.nextDueDateValue')}"),
    # Cancelar buttons
    ('>Cancelar<', ">{t('common.cancel')}<"),
    # Valor a pagar
    ('Valor a Pagar (R$)', "{t('emprestimos.valueToPay')}"),
    ('Data do Pagamento', "{t('emprestimos.paymentDate')}"),
    ('Conta de Caixa', "{t('emprestimos.cashAccount')}"),
    ('Deixe em branco para usar a data de hoje', "{t('emprestimos.leaveBlankToday')}"),
    # Total com atraso
    ('Total com Atraso (', "{t('emprestimos.totalWithDelay')} ("),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        count += 1

with open('/home/ubuntu/cobrapro/client/src/pages/Emprestimos.tsx', 'w') as f:
    f.write(content)

print(f'✅ Fixed {count}/{len(replacements)} replacements in Emprestimos.tsx')

# Add translation keys
new_ptbr = {
    'allInstallments': 'Todas as Parcelas',
    'newInstallment': 'Nova Parcela',
    'dueDateRequired': 'Data de Vencimento *',
    'noHistory': 'Nenhum histórico registrado ainda.',
    'historyWillAppear': 'As ações futuras aparecerão aqui.',
    'changeHistory': 'Histórico de Alterações',
    'receiptInfo': 'Gera o comprovante de pagamento com os dados da empresa configurados em Configurações.',
    'paymentRegistered': 'Pagamento Registrado!',
    'interestOnlyInfo': 'Pagando apenas os juros, o contrato é renovado sem abater o principal.',
    'nextDueDateOptions': 'Opções do Próximo Vencimento (opcional)',
    'nextDueDate': 'Data do Próximo Vencimento',
    'leaveBlankAutoCalc': 'Deixe em branco para calcular automaticamente',
    'nextDueDateValue': 'Valor do Próximo Vencimento (R$)',
    'valueToPay': 'Valor a Pagar (R$)',
    'paymentDate': 'Data do Pagamento',
    'cashAccount': 'Conta de Caixa',
    'leaveBlankToday': 'Deixe em branco para usar a data de hoje',
    'totalWithDelay': 'Total com Atraso',
}

new_es = {
    'allInstallments': 'Todas las Cuotas',
    'newInstallment': 'Nueva Cuota',
    'dueDateRequired': 'Fecha de Vencimiento *',
    'noHistory': 'No hay historial registrado aún.',
    'historyWillAppear': 'Las acciones futuras aparecerán aquí.',
    'changeHistory': 'Historial de Cambios',
    'receiptInfo': 'Genera el comprobante de pago con los datos de la empresa configurados en Configuraciones.',
    'paymentRegistered': '¡Pago Registrado!',
    'interestOnlyInfo': 'Pagando solo los intereses, el contrato se renueva sin reducir el capital.',
    'nextDueDateOptions': 'Opciones del Próximo Vencimiento (opcional)',
    'nextDueDate': 'Fecha del Próximo Vencimiento',
    'leaveBlankAutoCalc': 'Deje en blanco para calcular automáticamente',
    'nextDueDateValue': 'Valor del Próximo Vencimiento (R$)',
    'valueToPay': 'Valor a Pagar (R$)',
    'paymentDate': 'Fecha de Pago',
    'cashAccount': 'Cuenta de Caja',
    'leaveBlankToday': 'Deje en blanco para usar la fecha de hoy',
    'totalWithDelay': 'Total con Atraso',
}

for fname, new_keys in [('pt-BR', new_ptbr), ('es', new_es)]:
    path = f'/home/ubuntu/cobrapro/client/src/i18n/locales/{fname}.json'
    with open(path) as f:
        data = json.load(f)
    if 'emprestimos' not in data:
        data['emprestimos'] = {}
    data['emprestimos'].update(new_keys)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'✅ Added {len(new_keys)} emprestimos keys to {fname}.json')
