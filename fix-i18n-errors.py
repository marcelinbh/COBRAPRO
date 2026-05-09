#!/usr/bin/env python3
"""
Script para corrigir erros de {t()} em contextos não-JSX.
Em contextos JS puro (arrays, funções, objetos), {t('key')} deve ser t('key').
"""

import os
import re

pages_dir = "/home/ubuntu/cobrapro/client/src/pages"

def fix_t_in_js_context(content):
    """
    Corrige {t('key')} para t('key') em contextos não-JSX.
    Contextos não-JSX: dentro de arrays [], chamadas de função (), objetos {}.
    Contextos JSX: dentro de tags <> ou como atributos.
    """
    # Padrão: {t('...')} dentro de arrays ou chamadas de função (não JSX)
    # Detectar quando {t()} está dentro de [] ou como argumento de função
    
    # Substituir {t('key')} por t('key') quando está dentro de arrays ou como argumento
    # Padrão: [, ou (, seguido de {t('
    content = re.sub(r'(\[)(\{t\()', r'\1t(', content)
    content = re.sub(r'(,\s*)(\{t\()', lambda m: m.group(1) + 't(', content)
    
    # Corrigir o fechamento correspondente: )} para )
    # Isso é mais complexo - precisamos fazer manualmente por arquivo
    
    return content

# Corrigir VendasTelefone.tsx manualmente
def fix_vendas_telefone():
    filepath = os.path.join(pages_dir, 'VendasTelefone.tsx')
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Corrigir arrays com {t()}
    replacements = [
        # Linhas 69-73: arrays com {t()}
        ('[{t(\'phoneSales.brand\')},', '[t(\'phoneSales.brand\'),'),
        ('[{t(\'phoneSales.model\')},', '[t(\'phoneSales.model\'),'),
        ('[{t(\'phoneSales.imei\')},', '[t(\'phoneSales.imei\'),'),
        ('[{t(\'phoneSales.totalToReceive\')},', '[t(\'phoneSales.totalToReceive\'),'),
        # Linha 150-151: argumentos de função
        ('line({t(\'phoneSales.value\')},', 'line(t(\'phoneSales.value\'),'),
        ('line({t(\'phoneSales.status\')},', 'line(t(\'phoneSales.status\'),'),
        # Linha 208: argumento de função
        ('venda.comprador_nome ?? {t(\'phoneSales.buyer\')}', 'venda.comprador_nome ?? t(\'phoneSales.buyer\')'),
        # Linhas 516-517: objetos em arrays
        ('{ label: {t(\'phoneSales.totalSales\')},', '{ label: t(\'phoneSales.totalSales\'),'),
        ('{ label: {t(\'phoneSales.activeSales\')},', '{ label: t(\'phoneSales.activeSales\'),'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Fixed: VendasTelefone.tsx")

# Corrigir Cheques.tsx
def fix_cheques():
    filepath = os.path.join(pages_dir, 'Cheques.tsx')
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Ver as linhas com erro
    lines = content.split('\n')
    for i, line in enumerate(lines[18:28], start=19):
        if '{t(' in line:
            print(f"  Line {i}: {line.strip()}")
    
    # Corrigir arrays com {t()}
    replacements = [
        ('[{t(\'checks.number\')},', '[t(\'checks.number\'),'),
        ('[{t(\'checks.bank\')},', '[t(\'checks.bank\'),'),
        ('[{t(\'checks.agency\')},', '[t(\'checks.agency\'),'),
        ('[{t(\'checks.account\')},', '[t(\'checks.account\'),'),
        ('[{t(\'checks.value\')},', '[t(\'checks.value\'),'),
        ('[{t(\'checks.dueDate\')},', '[t(\'checks.dueDate\'),'),
        ('[{t(\'checks.status\')},', '[t(\'checks.status\'),'),
        ('[{t(\'checks.actions\')},', '[t(\'checks.actions\'),'),
        ('{ label: {t(\'checks.', '{ label: t(\'checks.'),
        (', {t(\'checks.', ', t(\'checks.'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Fixed: Cheques.tsx")

# Corrigir Clientes.tsx
def fix_clientes():
    filepath = os.path.join(pages_dir, 'Clientes.tsx')
    with open(filepath, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    for i in [341, 342, 355, 356]:
        if i < len(lines):
            print(f"  Line {i+1}: {lines[i].strip()}")
    
    # Corrigir padrões comuns em contextos não-JSX
    replacements = [
        ('{ label: {t(\'clients.', '{ label: t(\'clients.'),
        (', {t(\'clients.', ', t(\'clients.'),
        ('[{t(\'clients.', '[t(\'clients.'),
        ('?? {t(\'clients.', '?? t(\'clients.'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Fixed: Clientes.tsx")

# Corrigir Cobradores.tsx
def fix_cobradores():
    filepath = os.path.join(pages_dir, 'Cobradores.tsx')
    with open(filepath, 'r') as f:
        content = f.read()
    
    replacements = [
        ('{ label: {t(\'collectors.', '{ label: t(\'collectors.'),
        (', {t(\'collectors.', ', t(\'collectors.'),
        ('[{t(\'collectors.', '[t(\'collectors.'),
        ('?? {t(\'collectors.', '?? t(\'collectors.'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Fixed: Cobradores.tsx")

# Corrigir ContasPagar.tsx
def fix_contas_pagar():
    filepath = os.path.join(pages_dir, 'ContasPagar.tsx')
    with open(filepath, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    print(f"  Line 44: {lines[43].strip()}")
    
    replacements = [
        ('{ label: {t(\'accountsPayable.', '{ label: t(\'accountsPayable.'),
        (', {t(\'accountsPayable.', ', t(\'accountsPayable.'),
        ('[{t(\'accountsPayable.', '[t(\'accountsPayable.'),
        ('?? {t(\'accountsPayable.', '?? t(\'accountsPayable.'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Fixed: ContasPagar.tsx")

# Corrigir MeuPerfil.tsx
def fix_meu_perfil():
    filepath = os.path.join(pages_dir, 'MeuPerfil.tsx')
    with open(filepath, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    print(f"  Line 825: {lines[824].strip()}")
    
    replacements = [
        ('{ label: {t(\'profile.', '{ label: t(\'profile.'),
        (', {t(\'profile.', ', t(\'profile.'),
        ('[{t(\'profile.', '[t(\'profile.'),
        ('?? {t(\'profile.', '?? t(\'profile.'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Fixed: MeuPerfil.tsx")

# Corrigir Parcelas.tsx
def fix_parcelas():
    filepath = os.path.join(pages_dir, 'Parcelas.tsx')
    with open(filepath, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    print(f"  Line 98: {lines[97].strip()}")
    
    replacements = [
        ('{ label: {t(\'parcels.', '{ label: t(\'parcels.'),
        (', {t(\'parcels.', ', t(\'parcels.'),
        ('[{t(\'parcels.', '[t(\'parcels.'),
        ('?? {t(\'parcels.', '?? t(\'parcels.'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Fixed: Parcelas.tsx")

# Corrigir Simulador.tsx
def fix_simulador():
    filepath = os.path.join(pages_dir, 'Simulador.tsx')
    with open(filepath, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    for i in [37, 38, 266, 268, 280, 285, 287, 339]:
        if i < len(lines):
            print(f"  Line {i+1}: {lines[i].strip()}")
    
    replacements = [
        ('{ label: {t(\'simulator.', '{ label: t(\'simulator.'),
        (', {t(\'simulator.', ', t(\'simulator.'),
        ('[{t(\'simulator.', '[t(\'simulator.'),
        ('?? {t(\'simulator.', '?? t(\'simulator.'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Fixed: Simulador.tsx")

# Corrigir Usuarios.tsx
def fix_usuarios():
    filepath = os.path.join(pages_dir, 'Usuarios.tsx')
    with open(filepath, 'r') as f:
        content = f.read()
    
    replacements = [
        ('{ label: {t(\'users.', '{ label: t(\'users.'),
        (', {t(\'users.', ', t(\'users.'),
        ('[{t(\'users.', '[t(\'users.'),
        ('?? {t(\'users.', '?? t(\'users.'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Fixed: Usuarios.tsx")

# Executar todas as correções
print("Corrigindo erros de {t()} em contextos não-JSX...")
fix_vendas_telefone()
fix_cheques()
fix_clientes()
fix_cobradores()
fix_contas_pagar()
fix_meu_perfil()
fix_parcelas()
fix_simulador()
fix_usuarios()
print("\nCorreções aplicadas!")
