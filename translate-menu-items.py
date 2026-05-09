#!/usr/bin/env python3
import json

# Mapeamento de labels do menu para chaves de tradução
MENU_TRANSLATIONS = {
    "Dashboard": ("dashboard.title", "Panel de Control"),
    "Meu Perfil": ("menu.my_profile", "Mi Perfil"),
    "Clientes": ("menu.clients", "Clientes"),
    "Empréstimos": ("menu.loans", "Préstamos"),
    "Score de Clientes": ("menu.client_score", "Puntuación de Clientes"),
    "Veículos": ("menu.vehicles", "Vehículos"),
    "Venda de Telefone": ("menu.phone_sales", "Venta de Teléfono"),
    "Backup": ("menu.backup", "Copia de Seguridad"),
    "Análise de Risco": ("menu.risk_analysis", "Análisis de Riesgo"),
    "Contratos": ("menu.contracts", "Contratos"),
    "Parcelas": ("menu.installments", "Cuotas"),
    "Reparcelamento": ("menu.rescheduling", "Reprogramación"),
    "Simulador": ("menu.simulator", "Simulador"),
    "Contas a Pagar": ("menu.accounts_payable", "Cuentas por Pagar"),
    "Vendas": ("menu.sales", "Ventas"),
    "Cheques": ("menu.checks", "Cheques"),
    "Caixa": ("menu.cash", "Caja"),
    "Calendário": ("menu.calendar", "Calendario"),
    "Relatórios": ("menu.reports", "Informes"),
    "Cobradores": ("menu.collectors", "Cobradores"),
    "Configurações": ("menu.settings", "Configuración"),
    "Assinaturas": ("menu.subscriptions", "Suscripciones"),
    "WhatsApp QR": ("menu.whatsapp_qr", "WhatsApp QR"),
    "Relatório Diário": ("menu.daily_report", "Informe Diario"),
    "Inadimplência": ("menu.default", "Morosidad"),
    "Mensagens Auto": ("menu.auto_messages", "Mensajes Automáticos"),
    "Instalar App": ("menu.install_app", "Instalar Aplicación"),
}

def main():
    # Carregar traduções existentes
    with open('/home/ubuntu/cobrapro/client/src/i18n/locales/pt-BR.json', 'r', encoding='utf-8') as f:
        pt_br = json.load(f)
    
    with open('/home/ubuntu/cobrapro/client/src/i18n/locales/es.json', 'r', encoding='utf-8') as f:
        es = json.load(f)
    
    # Adicionar menu translations
    if 'menu' not in pt_br:
        pt_br['menu'] = {}
    if 'menu' not in es:
        es['menu'] = {}
    
    for pt_label, (key, es_label) in MENU_TRANSLATIONS.items():
        key_short = key.split('.')[-1]
        pt_br['menu'][key_short] = pt_label
        es['menu'][key_short] = es_label
    
    # Salvar
    with open('/home/ubuntu/cobrapro/client/src/i18n/locales/pt-BR.json', 'w', encoding='utf-8') as f:
        json.dump(pt_br, f, ensure_ascii=False, indent=2)
    
    with open('/home/ubuntu/cobrapro/client/src/i18n/locales/es.json', 'w', encoding='utf-8') as f:
        json.dump(es, f, ensure_ascii=False, indent=2)
    
    print("✅ Traduções do menu adicionadas!")
    print(f"PT-BR: {len(pt_br['menu'])} itens de menu")
    print(f"ES: {len(es['menu'])} itens de menu")

if __name__ == '__main__':
    main()
