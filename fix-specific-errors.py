#!/usr/bin/env python3
"""
Corrige casos específicos de erros de i18n que precisam de tratamento manual.
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
    return content != original

# Simulador.tsx - linha 38: objeto com t() em contexto JS
# emprestimo_semanal: {t('simulator.weekly'), emprestimo_quinzenal: {t('simulator.biweekly'),
# deve ser: emprestimo_semanal: t('simulator.weekly'), emprestimo_quinzenal: t('simulator.biweekly'),
fix_file(
    os.path.join(pages_dir, 'Simulador.tsx'),
    [
        (
            "emprestimo_semanal: {t('simulator.weekly'), emprestimo_quinzenal: {t('simulator.biweekly'), tabela_price:",
            "emprestimo_semanal: t('simulator.weekly'),\n  emprestimo_quinzenal: t('simulator.biweekly'),\n  tabela_price:"
        ),
        # Corrigir linha 267: [{t('simulator.modality')}, -> [t('simulator.modality'),
        ("[{t('simulator.modality')},", "[t('simulator.modality'),"),
        ("[{t('simulator.interestRate')},", "[t('simulator.interestRate'),"),
        # Corrigir doc.text com {t()}
        ("doc.text({t('simulator.result')},", "doc.text(t('simulator.result'),"),
        ("[{t('simulator.installmentValue')},", "[t('simulator.installmentValue'),"),
        ("[{t('simulator.totalInterest')},", "[t('simulator.totalInterest'),"),
        # head com {t()}
        ("head: [[{t('simulator.modality')},", "head: [[t('simulator.modality'),"),
    ]
)

# Clientes.tsx - linha 342: {isEdit ? t('...') : {t('...')}}
# deve ser: {isEdit ? t('...') : t('...')}
fix_file(
    os.path.join(pages_dir, 'Clientes.tsx'),
    [
        (
            "{isEdit ? t('clients.editClient') : {t('clients.newClient')}}",
            "{isEdit ? t('clients.editClient') : t('clients.newClient')}"
        ),
        # linha 356: ternário com {t()}
        (
            "a === \"dados\" ? \"Dados Pessoais\" : a === \"endereco\" ? t('clients.address') : \"Documentos\"",
            "a === \"dados\" ? \"Dados Pessoais\" : a === \"endereco\" ? t('clients.address') : \"Documentos\""
        ),
        # Corrigir qualquer {t()} restante em contexto não-JSX
        ("{t('clients.editClient')}", "t('clients.editClient')"),
        ("{t('clients.newClient')}", "t('clients.newClient')"),
    ]
)

# Cobradores.tsx - linhas 165 e 268
fix_file(
    os.path.join(pages_dir, 'Cobradores.tsx'),
    [
        ("{t('collectors.editCollector')}", "t('collectors.editCollector')"),
        ("{t('collectors.newCollector')}", "t('collectors.newCollector')"),
        ("{t('collectors.deleteCollector')}", "t('collectors.deleteCollector')"),
        ("{t('collectors.addCollector')}", "t('collectors.addCollector')"),
    ]
)

# MeuPerfil.tsx - linha 825: {isPending ? "Alterando..." : {t('profile.changePassword')}}
fix_file(
    os.path.join(pages_dir, 'MeuPerfil.tsx'),
    [
        (
            "{alterarSenha.isPending ? \"Alterando...\" : {t('profile.changePassword')}}",
            "{alterarSenha.isPending ? \"Alterando...\" : t('profile.changePassword')}"
        ),
        # Outros padrões similares
        ("{t('profile.changePassword')}", "t('profile.changePassword')"),
        ("{t('profile.save')}", "t('profile.save')"),
    ]
)

# Verificar erros restantes
print("\nVerificando erros TypeScript restantes...")
import subprocess
result = subprocess.run(
    ['npx', 'tsc', '--noEmit'],
    capture_output=True, text=True, cwd='/home/ubuntu/cobrapro'
)
errors = [line for line in result.stderr.split('\n') if 'error TS' in line]
print(f"Erros restantes: {len(errors)}")
for e in errors[:20]:
    print(f"  {e}")
