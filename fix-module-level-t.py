#!/usr/bin/env python3
"""
Corrige o uso de t() em constantes de nível de módulo (fora de componentes React).
Estratégia: reverter para strings hardcoded em português onde t() não pode ser usado.
"""

import os

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
        return True
    else:
        print(f"No change: {os.path.basename(filepath)}")
        return False

# Cheques.tsx - STATUS_CONFIG é nível de módulo, reverter para strings hardcoded
# Mas manter a tradução no JSX onde t() está disponível
fix_file(
    os.path.join(pages_dir, 'Cheques.tsx'),
    [
        # Reverter t() em constante de módulo
        ("devolvido: { label: t('checks.returned'),", "devolvido: { label: \"Devolvido\","),
        ("cancelado: { label: t('checks.cancelled'),", "cancelado: { label: \"Cancelado\","),
    ]
)

# Simulador.tsx - MODALIDADE_LABELS é nível de módulo
fix_file(
    os.path.join(pages_dir, 'Simulador.tsx'),
    [
        ("emprestimo_semanal: t('simulator.weekly'),", "emprestimo_semanal: \"Semanal\","),
        ("emprestimo_quinzenal: t('simulator.biweekly'),", "emprestimo_quinzenal: \"Quinzenal\","),
    ]
)

# Clientes.tsx - verificar onde t() está sendo usado fora do componente
# Linha 342 e 356 - dentro do componente ClienteModal
# Linha 526 - verificar
import subprocess
result = subprocess.run(['sed', '-n', '338,360p', os.path.join(pages_dir, 'Clientes.tsx')], capture_output=True, text=True)
print("\nClientes.tsx linhas 338-360:")
print(result.stdout)

result = subprocess.run(['sed', '-n', '520,530p', os.path.join(pages_dir, 'Clientes.tsx')], capture_output=True, text=True)
print("\nClientes.tsx linhas 520-530:")
print(result.stdout)

# ContasPagar.tsx - linha 44
result = subprocess.run(['sed', '-n', '40,50p', os.path.join(pages_dir, 'ContasPagar.tsx')], capture_output=True, text=True)
print("\nContasPagar.tsx linhas 40-50:")
print(result.stdout)

# Dashboard.tsx - linha 109
result = subprocess.run(['sed', '-n', '105,115p', os.path.join(pages_dir, 'Dashboard.tsx')], capture_output=True, text=True)
print("\nDashboard.tsx linhas 105-115:")
print(result.stdout)

# Parcelas.tsx - linha 98
result = subprocess.run(['sed', '-n', '94,105p', os.path.join(pages_dir, 'Parcelas.tsx')], capture_output=True, text=True)
print("\nParcelas.tsx linhas 94-105:")
print(result.stdout)

# VendasTelefone.tsx - linhas 69-73, 127, 150-151, 208
result = subprocess.run(['sed', '-n', '65,130p', os.path.join(pages_dir, 'VendasTelefone.tsx')], capture_output=True, text=True)
print("\nVendasTelefone.tsx linhas 65-130:")
print(result.stdout[:2000])
