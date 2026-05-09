#!/usr/bin/env python3
"""Adiciona chaves de tradução faltantes nos arquivos pt-BR.json e es.json"""
import json

# Novas chaves a adicionar
NEW_KEYS = {
    "pt-BR": {
        "common": {
            "test": "Testar",
            "saving": "Salvando...",
            "sending": "Enviando...",
        },
        "inadimplencia": {
            "subtitle": "Clientes com parcelas em atraso",
            "totalOwed": "Total Devido",
            "longestDelay": "Maior Atraso",
            "sortByDays": "Ordenar por dias de atraso",
            "sortByValue": "Ordenar por valor devido",
            "sortByName": "Ordenar por nome",
            "noDelinquents": "Nenhum inadimplente",
            "allClientsOnTime": "Todos os clientes estão em dia com seus pagamentos!",
            "delay": "atraso",
            "overdueInstallments": "Parcelas em atraso",
        },
        "scores": {
            "subtitle": "Ranking de confiabilidade e desempenho",
            "sortByScore": "Ordenar por Score",
            "sortByProfit": "Ordenar por Lucro",
            "sortByName": "Ordenar por Nome",
            "totalClients": "Total de Clientes",
            "excellent": "Excelentes (100+)",
            "good": "Bons (70-99)",
            "poor": "Ruim (<40)",
            "noCpf": "Sem CPF",
            "points": "pontos",
            "paid": "Quitadas",
            "onTime": "Em Dia",
            "late": "Atrasadas",
            "profit": "Lucro",
            "compliance": "Adimpl.",
            "recovery": "Recup.",
        },
        "notifications": {
            "title": "Mensagens Automáticas",
            "subtitle": "Configure mensagens automáticas de WhatsApp para seus clientes",
            "fireNow": "Disparar Agora",
            "globalActive": "Mensagens automáticas ATIVAS",
            "globalInactive": "Mensagens automáticas DESATIVADAS",
            "globalActiveDesc": "O sistema enviará mensagens automaticamente todos os dias",
            "globalInactiveDesc": "Nenhuma mensagem automática será enviada",
            "rules": "Regras de Envio",
            "history": "Histórico",
            "availableVars": "Variáveis disponíveis nas mensagens",
            "sendHistory": "Histórico de Envios",
            "historyDesc": "Últimas 50 mensagens enviadas automaticamente",
            "noMessages": "Nenhuma mensagem enviada ainda",
            "editMessage": "Editar Mensagem",
            "clickToInsert": "Clique para inserir variável na mensagem",
            "message": "Mensagem",
            "messagePlaceholder": "Digite a mensagem...",
            "boldHint": "Use *texto* para negrito no WhatsApp",
            "preview": "Preview (com dados de exemplo)",
        },
    },
    "es": {
        "common": {
            "test": "Probar",
            "saving": "Guardando...",
            "sending": "Enviando...",
        },
        "inadimplencia": {
            "subtitle": "Clientes con cuotas vencidas",
            "totalOwed": "Total Adeudado",
            "longestDelay": "Mayor Atraso",
            "sortByDays": "Ordenar por días de atraso",
            "sortByValue": "Ordenar por valor adeudado",
            "sortByName": "Ordenar por nombre",
            "noDelinquents": "Ningún moroso",
            "allClientsOnTime": "¡Todos los clientes están al día con sus pagos!",
            "delay": "atraso",
            "overdueInstallments": "Cuotas vencidas",
        },
        "scores": {
            "subtitle": "Ranking de confiabilidad y rendimiento",
            "sortByScore": "Ordenar por Score",
            "sortByProfit": "Ordenar por Ganancia",
            "sortByName": "Ordenar por Nombre",
            "totalClients": "Total de Clientes",
            "excellent": "Excelentes (100+)",
            "good": "Buenos (70-99)",
            "poor": "Malo (<40)",
            "noCpf": "Sin CPF",
            "points": "puntos",
            "paid": "Pagadas",
            "onTime": "Al Día",
            "late": "Atrasadas",
            "profit": "Ganancia",
            "compliance": "Cumpl.",
            "recovery": "Recup.",
        },
        "notifications": {
            "title": "Mensajes Automáticos",
            "subtitle": "Configure mensajes automáticos de WhatsApp para sus clientes",
            "fireNow": "Disparar Ahora",
            "globalActive": "Mensajes automáticos ACTIVOS",
            "globalInactive": "Mensajes automáticos DESACTIVADOS",
            "globalActiveDesc": "El sistema enviará mensajes automáticamente todos los días",
            "globalInactiveDesc": "No se enviará ningún mensaje automático",
            "rules": "Reglas de Envío",
            "history": "Historial",
            "availableVars": "Variables disponibles en los mensajes",
            "sendHistory": "Historial de Envíos",
            "historyDesc": "Últimos 50 mensajes enviados automáticamente",
            "noMessages": "Ningún mensaje enviado aún",
            "editMessage": "Editar Mensaje",
            "clickToInsert": "Haga clic para insertar variable en el mensaje",
            "message": "Mensaje",
            "messagePlaceholder": "Escriba el mensaje...",
            "boldHint": "Use *texto* para negrita en WhatsApp",
            "preview": "Vista previa (con datos de ejemplo)",
        },
    },
}

LOCALE_FILES = {
    "pt-BR": "/home/ubuntu/cobrapro/client/src/i18n/locales/pt-BR.json",
    "es": "/home/ubuntu/cobrapro/client/src/i18n/locales/es.json",
}

for lang, keys_to_add in NEW_KEYS.items():
    path = LOCALE_FILES[lang]
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    added = 0
    for section, keys in keys_to_add.items():
        if section not in data:
            data[section] = {}
        for key, value in keys.items():
            if key not in data[section]:
                data[section][key] = value
                added += 1
                print(f"[{lang}] Added {section}.{key}")
            else:
                print(f"[{lang}] Skipped (exists) {section}.{key} = {data[section][key]!r}")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n[{lang}] Done. {added} keys added.\n")
