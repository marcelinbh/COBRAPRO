import json

# Novas chaves para vehicles em pt-BR
vehicles_ptbr = {
    "subtitle": "Gestão de vendas de veículos com alienação fiduciária",
    "registerNew": "Registrar Novo Veículo",
    "vehicleData": "Dados do Veículo",
    "buyer": "Comprador",
    "financial": "Financeiro",
    "chassisPlaceholder": "Número do chassi",
    "buyerName": "Nome do Comprador",
    "fullName": "Nome completo",
    "totalValue": "Valor Total (R$)",
    "downPayment": "Entrada (R$)",
    "firstDueDate": "Primeiro Vencimento",
    "registerVehicle": "Registrar Veículo",
    "settled": "Quitados",
    "received": "Recebido (R$)",
    "totalProfit": "Lucro Total (R$)",
    "searchPlaceholder": "Buscar por marca, modelo ou comprador...",
    "inProgress": "Em Andamento",
}

# Novas chaves para vehicles em es
vehicles_es = {
    "subtitle": "Gestión de ventas de vehículos con alienación fiduciaria",
    "registerNew": "Registrar Nuevo Vehículo",
    "vehicleData": "Datos del Vehículo",
    "buyer": "Comprador",
    "financial": "Financiero",
    "chassisPlaceholder": "Número de chasis",
    "buyerName": "Nombre del Comprador",
    "fullName": "Nombre completo",
    "totalValue": "Valor Total (R$)",
    "downPayment": "Entrada (R$)",
    "firstDueDate": "Primer Vencimiento",
    "registerVehicle": "Registrar Vehículo",
    "settled": "Liquidados",
    "received": "Recibido (R$)",
    "totalProfit": "Ganancia Total (R$)",
    "searchPlaceholder": "Buscar por marca, modelo o comprador...",
    "inProgress": "En Curso",
}

# Actualizar pt-BR.json
with open('/home/ubuntu/cobrapro/client/src/i18n/locales/pt-BR.json', 'r', encoding='utf-8') as f:
    ptbr = json.load(f)

for k, v in vehicles_ptbr.items():
    if k not in ptbr.get('vehicles', {}):
        ptbr.setdefault('vehicles', {})[k] = v

with open('/home/ubuntu/cobrapro/client/src/i18n/locales/pt-BR.json', 'w', encoding='utf-8') as f:
    json.dump(ptbr, f, ensure_ascii=False, indent=2)
print("pt-BR.json atualizado")

# Actualizar es.json
with open('/home/ubuntu/cobrapro/client/src/i18n/locales/es.json', 'r', encoding='utf-8') as f:
    es = json.load(f)

for k, v in vehicles_es.items():
    if k not in es.get('vehicles', {}):
        es.setdefault('vehicles', {})[k] = v

with open('/home/ubuntu/cobrapro/client/src/i18n/locales/es.json', 'w', encoding='utf-8') as f:
    json.dump(es, f, ensure_ascii=False, indent=2)
print("es.json atualizado")
