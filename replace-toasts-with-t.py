#!/usr/bin/env python3
import re
import json
from pathlib import Path

def generate_key(text):
    """Gera uma chave única para o texto"""
    key = text.lower()[:50].replace(' ', '_').replace('!', '').replace('?', '').replace('.', '').replace(',', '')
    key = ''.join(c for c in key if c.isalnum() or c == '_')[:40]
    return key

def replace_toasts_in_file(filepath):
    """Substitui toasts hardcoded por t()"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return False
    
    original_content = content
    
    # Padrão 1: toast.success('...')
    def replace_success(match):
        text = match.group(1)
        key = generate_key(text)
        return f"toast.success(t('toast_success.{key}'))"
    
    content = re.sub(r"toast\.success\(['\"]([^'\"]+)['\"]\)", replace_success, content)
    
    # Padrão 2: toast.error('...')
    def replace_error(match):
        text = match.group(1)
        key = generate_key(text)
        return f"toast.error(t('toast_error.{key}'))"
    
    content = re.sub(r"toast\.error\(['\"]([^'\"]+)['\"]\)", replace_error, content)
    
    # Padrão 3: toast.info('...')
    def replace_info(match):
        text = match.group(1)
        key = generate_key(text)
        return f"toast.info(t('toast_info.{key}'))"
    
    content = re.sub(r"toast\.info\(['\"]([^'\"]+)['\"]\)", replace_info, content)
    
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    pages_dir = Path('/home/ubuntu/cobrapro/client/src/pages')
    modified = 0
    
    for tsx_file in pages_dir.glob('*.tsx'):
        if replace_toasts_in_file(tsx_file):
            print(f"✅ {tsx_file.name}")
            modified += 1
        else:
            print(f"⏭️  {tsx_file.name}")
    
    print(f"\n✅ {modified} arquivos modificados")

if __name__ == '__main__':
    main()
