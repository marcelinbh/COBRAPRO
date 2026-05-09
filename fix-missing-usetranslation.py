#!/usr/bin/env python3
import re
from pathlib import Path

def add_usetranslation_to_functions(filepath):
    """Adiciona useTranslation em funções que usam t()"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return False
    
    original_content = content
    
    # Encontrar funções que usam t() mas não têm useTranslation
    # Padrão: function nome() { ... t( ... }
    
    # Encontrar todas as funções
    function_pattern = r'(function\s+\w+\s*\([^)]*\)\s*\{)'
    
    for match in re.finditer(function_pattern, content):
        func_start = match.start()
        func_body_start = match.end()
        
        # Encontrar o fim da função (próxima função ou fim do arquivo)
        next_func = re.search(r'\nfunction\s+\w+\s*\(', content[func_body_start:])
        if next_func:
            func_end = func_body_start + next_func.start()
        else:
            func_end = len(content)
        
        func_body = content[func_body_start:func_end]
        
        # Verificar se usa t()
        if 't(' in func_body and 'const { t } = useTranslation()' not in func_body:
            # Adicionar useTranslation no início da função
            indent = '  '  # 2 espaços
            insertion_point = func_body_start
            content = content[:insertion_point] + f"\n{indent}const {{ t }} = useTranslation();" + content[insertion_point:]
    
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    files_to_fix = [
        '/home/ubuntu/cobrapro/client/src/pages/Contratos.tsx',
        '/home/ubuntu/cobrapro/client/src/pages/Emprestimos.tsx',
        '/home/ubuntu/cobrapro/client/src/pages/Parcelas.tsx',
    ]
    
    for filepath in files_to_fix:
        if Path(filepath).exists():
            if add_usetranslation_to_functions(filepath):
                print(f"✅ {Path(filepath).name}")
            else:
                print(f"⏭️  {Path(filepath).name}")

if __name__ == '__main__':
    main()
