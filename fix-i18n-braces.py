#!/usr/bin/env python3
"""
Corrige o problema de } sobrando após substituição de {t('key')} por t('key').
Padrão problemático: t('key')}, color: -> t('key'), color:
"""

import os
import re

pages_dir = "/home/ubuntu/cobrapro/client/src/pages"

def fix_orphan_braces(content):
    """
    Corrige padrões como: t('key')}, next_key:
    que deveriam ser: t('key'), next_key:
    """
    # Padrão: t('....')}, seguido de espaço e chave de objeto
    # Isso acontece quando {t('...')} estava dentro de um objeto e o } foi removido mas sobrou
    content = re.sub(r"t\('([^']+)'\)\},\s+(\w+):", r"t('\1'), \2:", content)
    
    # Padrão: t('....')}, seguido de icon:
    content = re.sub(r"t\('([^']+)'\)\},\s+icon:", r"t('\1'), icon:", content)
    
    # Padrão: t('....')}, seguido de color:
    content = re.sub(r"t\('([^']+)'\)\},\s+color:", r"t('\1'), color:", content)
    
    # Padrão mais geral: t('....')}, seguido de qualquer propriedade
    content = re.sub(r"t\('([^']+)'\)\},", r"t('\1'),", content)
    
    return content

def fix_ternary_with_t(content):
    """
    Corrige padrões ternários com {t()} em JSX:
    {isEdit ? {t('key1')} : {t('key2')}} -> {isEdit ? t('key1') : t('key2')}
    """
    # Padrão: ? {t('key')} : -> ? t('key') :
    content = re.sub(r'\?\s*\{t\(\'([^\']+)\'\)\}\s*:', r"? t('\1') :", content)
    # Padrão: : {t('key')} -> : t('key')
    content = re.sub(r':\s*\{t\(\'([^\']+)\'\)\}([^}])', r": t('\1')\2", content)
    return content

def fix_button_with_t(content):
    """
    Corrige padrões de botões com {t()} em ternários:
    {isPending ? "Alterando..." : {t('key')}} -> {isPending ? "Alterando..." : t('key')}
    """
    # Padrão: "text" : {t('key')}} -> "text" : t('key')}
    content = re.sub(r'"([^"]+)"\s*:\s*\{t\(\'([^\']+)\'\)\}\}', r'"\1" : t(\'\2\')}', content)
    return content

def fix_array_with_t(content):
    """
    Corrige padrões de arrays com {t()} em contextos não-JSX:
    [{t('key')}, value] -> [t('key'), value]
    """
    # Padrão: [{t('key')}, -> [t('key'),
    content = re.sub(r'\[\{t\(\'([^\']+)\'\)\},', r"[t('\1'),", content)
    return content

def fix_object_label_with_t(content):
    """
    Corrige padrões de objetos com label: {t('key')}:
    { label: {t('key')}, -> { label: t('key'),
    """
    # Padrão: label: {t('key')}, -> label: t('key'),
    content = re.sub(r'label:\s*\{t\(\'([^\']+)\'\)\},', r"label: t('\1'),", content)
    return content

def fix_doc_text_with_t(content):
    """
    Corrige padrões de doc.text com {t()}:
    doc.text({t('key')}, -> doc.text(t('key'),
    """
    content = re.sub(r'doc\.text\(\{t\(\'([^\']+)\'\)\},', r"doc.text(t('\1'),", content)
    return content

def fix_function_arg_with_t(content):
    """
    Corrige padrões de argumentos de função com {t()}:
    someFunc({t('key')}, -> someFunc(t('key'),
    """
    content = re.sub(r'\(\{t\(\'([^\']+)\'\)\},', r"(t('\1'),", content)
    return content

def fix_ternary_result_with_t(content):
    """
    Corrige padrões de resultado ternário com {t()}:
    ? "text" : {t('key')} -> ? "text" : t('key')
    """
    content = re.sub(r'\?\s*"([^"]+)"\s*:\s*\{t\(\'([^\']+)\'\)\}', r'? "\1" : t(\'\2\')', content)
    return content

def fix_object_key_with_t(content):
    """
    Corrige padrões de chaves de objeto com {t()}:
    emprestimo_semanal: {t('key')}, -> emprestimo_semanal: t('key'),
    """
    content = re.sub(r'(\w+):\s*\{t\(\'([^\']+)\'\)\},', r"\1: t('\2'),", content)
    return content

# Aplicar todas as correções em todos os arquivos com erros
files_to_fix = [
    'Cheques.tsx',
    'Clientes.tsx',
    'Cobradores.tsx',
    'ContasPagar.tsx',
    'MeuPerfil.tsx',
    'Parcelas.tsx',
    'Simulador.tsx',
    'Usuarios.tsx',
    'VendasTelefone.tsx',
    'Emprestimos.tsx',
    'Contratos.tsx',
    'Vendas.tsx',
    'Dashboard.tsx',
    'Backup.tsx',
]

for filename in files_to_fix:
    filepath = os.path.join(pages_dir, filename)
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Aplicar todas as correções
    content = fix_orphan_braces(content)
    content = fix_ternary_with_t(content)
    content = fix_button_with_t(content)
    content = fix_array_with_t(content)
    content = fix_object_label_with_t(content)
    content = fix_doc_text_with_t(content)
    content = fix_function_arg_with_t(content)
    content = fix_ternary_result_with_t(content)
    content = fix_object_key_with_t(content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed: {filename}")
    else:
        print(f"No change: {filename}")

print("\nCorreções de chaves aplicadas!")
