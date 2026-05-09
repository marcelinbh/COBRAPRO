import re

with open('/home/ubuntu/cobrapro/client/src/pages/VendasTelefone.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Mapeamento de texto hardcoded -> chave i18n
replacements = [
    # Header
    ('>Venda de Telefone<', ">{t('vendaTelefone.title')}<"),
    ('>Gerencie contratos de venda parcelada<', ">{t('vendaTelefone.subtitle')}<"),
    ('>Nova Venda<', ">{t('vendaTelefone.newSale')}<"),
    # Filtros
    ('>Todos os status<', ">{t('common.allStatus')}<"),
    ('>Ativo<', ">{t('common.active')}<"),
    ('>Quitado<', ">{t('common.settled')}<"),
    ('>Inadimplente<', ">{t('common.defaulter')}<"),
    ('>Cancelado<', ">{t('common.cancelled')}<"),
    # Empty states
    ('>Nenhuma venda registrada<', ">{t('vendaTelefone.noSales')}<"),
    ('>Nenhum resultado encontrado<', ">{t('common.noResults')}<"),
    ('>Tente ajustar os filtros ou limpar a busca.<', ">{t('common.adjustFilters')}<"),
    # Card fields
    ('>Preço de Venda<', ">{t('vendaTelefone.salePrice')}<"),
    ('>Parcelas<', ">{t('common.installments')}<"),
    ('>Lucro Bruto<', ">{t('vendaTelefone.grossProfit')}<"),
    ('>Paga<', ">{t('common.paid')}<"),
    # Simulador
    ('>Simulador de Venda<', ">{t('vendaTelefone.simulator')}<"),
    ('>Configure os parâmetros e veja o retorno em tempo real<', ">{t('vendaTelefone.simulatorSubtitle')}<"),
    ('>Custo do Aparelho<', ">{t('vendaTelefone.deviceCost')}<"),
    ('>Preço de Venda<', ">{t('vendaTelefone.salePrice')}<"),
    ('>Entrada<', ">{t('common.downPayment')}<"),
    ('>Parcela<', ">{t('common.installment')}<"),
    ('>Total<', ">{t('common.total')}<"),
    # Gráfico legenda
    ('>Investido<', ">{t('vendaTelefone.invested')}<"),
    ('>Payback<', ">{t('vendaTelefone.payback')}<"),
    ('>Lucro<', ">{t('vendaTelefone.profit')}<"),
    # Dados do comprador
    ('>Dados do Comprador<', ">{t('vendaTelefone.buyerData')}<"),
    ('>Resumo da Operação<', ">{t('vendaTelefone.operationSummary')}<"),
    # Labels do formulário
    ('>Marca *<', ">{t('vendaTelefone.brand')} *<"),
    ('>Modelo *<', ">{t('vendaTelefone.model')} *<"),
    ('>Armazenamento<', ">{t('vendaTelefone.storage')}<"),
    ('>Cor<', ">{t('vendaTelefone.color')}<"),
    ('>Data 1ª Parcela<', ">{t('vendaTelefone.firstInstallmentDate')}<"),
    ('>Nome Completo *<', ">{t('common.fullName')} *<"),
    ('>Estado Civil<', ">{t('vendaTelefone.maritalStatus')}<"),
    ('>Solteiro(a)<', ">{t('vendaTelefone.single')}<"),
    ('>Casado(a)<', ">{t('vendaTelefone.married')}<"),
    ('>Divorciado(a)<', ">{t('vendaTelefone.divorced')}<"),
    ('>Viúvo(a)<', ">{t('vendaTelefone.widowed')}<"),
    ('>Outro<', ">{t('common.other')}<"),
    ('>Profissão<', ">{t('vendaTelefone.profession')}<"),
    ('>Cidade<', ">{t('common.city')}<"),
    ('>Estado<', ">{t('common.state')}<"),
    ('>Rua, número, complemento<', ">{t('vendaTelefone.address')}<"),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  Substituído: {old[:50]}")

with open('/home/ubuntu/cobrapro/client/src/pages/VendasTelefone.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal: {count} substituições realizadas")
