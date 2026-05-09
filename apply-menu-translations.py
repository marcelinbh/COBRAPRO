#!/usr/bin/env python3
import re

# Mapeamento de labels para chaves de tradução
MENU_KEYS = {
    "Dashboard": "dashboard",
    "Meu Perfil": "my_profile",
    "Clientes": "clients",
    "Empréstimos": "loans",
    "Score de Clientes": "client_score",
    "Veículos": "vehicles",
    "Venda de Telefone": "phone_sales",
    "Backup": "backup",
    "Análise de Risco": "risk_analysis",
    "Contratos": "contracts",
    "Parcelas": "installments",
    "Reparcelamento": "rescheduling",
    "Simulador": "simulator",
    "Contas a Pagar": "accounts_payable",
    "Vendas": "sales",
    "Cheques": "checks",
    "Caixa": "cash",
    "Calendário": "calendar",
    "Relatórios": "reports",
    "Cobradores": "collectors",
    "Configurações": "settings",
    "Assinaturas": "subscriptions",
    "WhatsApp QR": "whatsapp_qr",
    "Relatório Diário": "daily_report",
    "Inadimplência": "default",
    "Mensagens Auto": "auto_messages",
    "Instalar App": "install_app",
}

def main():
    filepath = '/home/ubuntu/cobrapro/client/src/components/DashboardLayout.tsx'
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Substituir cada label por t('menu.key')
    for label, key in MENU_KEYS.items():
        # Padrão: { icon: ..., label: "Dashboard", path: ...}
        pattern = f'{{ icon: ([^,]+), label: "{label}", path:'
        replacement = f'{{ icon: \\1, label: t("menu.{key}"), path:'
        content = re.sub(pattern, replacement, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ Traduções do menu aplicadas ao DashboardLayout!")

if __name__ == '__main__':
    main()
