#!/usr/bin/env python3
"""
Corrige todos os casos de t() em contextos não-React (fora de componentes/hooks).
Estratégia: 
1. Em constantes de nível de módulo (STATUS_CONFIG, etc.) -> reverter para strings PT
2. Em funções auxiliares que geram PDF (VendasTelefone) -> passar t como parâmetro ou reverter
3. Em sub-componentes sem useTranslation -> adicionar useTranslation
"""

import os
import re

pages_dir = "/home/ubuntu/cobrapro/client/src/pages"

def fix_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed: {os.path.basename(filepath)}")
    else:
        print(f"No change: {os.path.basename(filepath)}")

# ContasPagar.tsx - STATUS_CONFIG é nível de módulo
fix_file(
    os.path.join(pages_dir, 'ContasPagar.tsx'),
    [
        ("pendente: { label: t('accountsPayable.pending'),", "pendente: { label: \"Pendente\","),
    ]
)

# Dashboard.tsx - ScoreRing sub-component sem useTranslation
# Linha 109: t('dashboard.businessScore') está em ScoreRing que não tem useTranslation
# Verificar
with open(os.path.join(pages_dir, 'Dashboard.tsx'), 'r') as f:
    dashboard_content = f.read()

# Encontrar o sub-componente que usa t() na linha 109
lines = dashboard_content.split('\n')
for i in range(100, 120):
    print(f"Dashboard L{i+1}: {lines[i]}")

# Verificar se ScoreRing tem useTranslation
print("\nScoreRing function:")
idx = dashboard_content.find('function ScoreRing')
if idx >= 0:
    print(dashboard_content[idx:idx+200])

# Parcelas.tsx - StatusBadge sub-component sem useTranslation
# Linha 98: t('parcels.pending') está em StatusBadge que não tem useTranslation
with open(os.path.join(pages_dir, 'Parcelas.tsx'), 'r') as f:
    parcelas_content = f.read()

# Adicionar useTranslation no StatusBadge
if "function StatusBadge" in parcelas_content and "const { t } = useTranslation();" not in parcelas_content[:parcelas_content.find("export default function")]:
    parcelas_content = parcelas_content.replace(
        "function StatusBadge({ status }: { status: string }) {\n  const map",
        "function StatusBadge({ status }: { status: string }) {\n  const { t } = useTranslation();\n  const map"
    )
    with open(os.path.join(pages_dir, 'Parcelas.tsx'), 'w') as f:
        f.write(parcelas_content)
    print("Fixed: Parcelas.tsx (StatusBadge)")

# Clientes.tsx - ClienteModal sub-component
# Verificar se ClienteModal tem useTranslation
with open(os.path.join(pages_dir, 'Clientes.tsx'), 'r') as f:
    clientes_content = f.read()

# Encontrar ClienteModal
idx = clientes_content.find('function ClienteModal')
if idx >= 0:
    func_start = clientes_content[idx:idx+300]
    print(f"\nClienteModal start: {func_start[:200]}")
    
    if "const { t } = useTranslation();" not in func_start:
        # Adicionar useTranslation no ClienteModal
        clientes_content = clientes_content.replace(
            "function ClienteModal(",
            "function ClienteModal("
        )
        # Encontrar o { de abertura da função
        match = re.search(r'function ClienteModal\([^)]*\)[^{]*\{', clientes_content)
        if match:
            pos = match.end()
            clientes_content = clientes_content[:pos] + "\n  const { t } = useTranslation();" + clientes_content[pos:]
            with open(os.path.join(pages_dir, 'Clientes.tsx'), 'w') as f:
                f.write(clientes_content)
            print("Fixed: Clientes.tsx (ClienteModal)")

# VendasTelefone.tsx - função gerarPDF que usa t()
# A função gerarPDF não é um componente React, então t() não funciona
# Solução: reverter t() para strings hardcoded na função gerarPDF
with open(os.path.join(pages_dir, 'VendasTelefone.tsx'), 'r') as f:
    vt_content = f.read()

# Verificar onde gerarPDF está
idx = vt_content.find('function gerarPDF')
if idx >= 0:
    print(f"\ngerarPDF found at position {idx}")
    # Reverter t() para strings hardcoded dentro de gerarPDF
    vt_content = vt_content.replace(
        "[t('phoneSales.brand'),", '["Marca",',
    )
    vt_content = vt_content.replace(
        "[t('phoneSales.model'),", '["Modelo",',
    )
    vt_content = vt_content.replace(
        "[t('phoneSales.imei'),", '["IMEI",',
    )
    vt_content = vt_content.replace(
        "[t('phoneSales.totalToReceive'),", '["Total a Receber",',
    )
    vt_content = vt_content.replace(
        "line(t('phoneSales.value'),", 'line("Valor",',
    )
    vt_content = vt_content.replace(
        "line(t('phoneSales.status'),", 'line("Status",',
    )
    vt_content = vt_content.replace(
        "venda.comprador_nome ?? t('phoneSales.buyer')", 'venda.comprador_nome ?? "Comprador"',
    )
    with open(os.path.join(pages_dir, 'VendasTelefone.tsx'), 'w') as f:
        f.write(vt_content)
    print("Fixed: VendasTelefone.tsx (gerarPDF)")

# Dashboard.tsx - ScoreRing sub-component
with open(os.path.join(pages_dir, 'Dashboard.tsx'), 'r') as f:
    dashboard_content = f.read()

# Verificar se ScoreRing tem useTranslation
if "function ScoreRing" in dashboard_content:
    # Encontrar o início da função ScoreRing
    match = re.search(r'function ScoreRing\([^)]*\)[^{]*\{', dashboard_content)
    if match:
        pos = match.end()
        # Verificar se já tem useTranslation
        next_100 = dashboard_content[pos:pos+100]
        if "const { t } = useTranslation();" not in next_100:
            dashboard_content = dashboard_content[:pos] + "\n  const { t } = useTranslation();" + dashboard_content[pos:]
            with open(os.path.join(pages_dir, 'Dashboard.tsx'), 'w') as f:
                f.write(dashboard_content)
            print("Fixed: Dashboard.tsx (ScoreRing)")

print("\nConcluído!")
