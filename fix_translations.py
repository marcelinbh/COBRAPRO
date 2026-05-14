import json

# Adicionar chaves faltando nos arquivos de tradução
with open('client/src/i18n/locales/pt-BR.json') as f:
    pt = json.load(f)
with open('client/src/i18n/locales/es.json') as f:
    es = json.load(f)

# Adicionar chaves faltando em loans
pt_loans_additions = {
    'label': 'Etiqueta',
    'details': 'Detalhes',
    'preventiveCollection': 'Cobrança preventiva',
    'collectWhatsApp': 'Cobrar via WhatsApp',
    'generatingPDF': 'Gerando PDF...',
    'generateReceiptPDF': 'Gerar Comprovante em PDF',
}
es_loans_additions = {
    'label': 'Etiqueta',
    'details': 'Detalles',
    'preventiveCollection': 'Cobro preventivo',
    'collectWhatsApp': 'Cobrar por WhatsApp',
    'generatingPDF': 'Generando PDF...',
    'generateReceiptPDF': 'Generar Comprobante en PDF',
}

pt['loans'].update(pt_loans_additions)
es['loans'].update(es_loans_additions)

with open('client/src/i18n/locales/pt-BR.json', 'w') as f:
    json.dump(pt, f, ensure_ascii=False, indent=2)
with open('client/src/i18n/locales/es.json', 'w') as f:
    json.dump(es, f, ensure_ascii=False, indent=2)

print('Chaves de tradução adicionadas com sucesso!')
