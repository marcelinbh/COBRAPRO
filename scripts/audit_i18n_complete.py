#!/usr/bin/env python3
"""
Auditoria completa de chaves i18n em todas as páginas do CobraPro.
Verifica quais chaves t() usadas no código estão faltando nos arquivos de tradução.
"""
import json
import re
import os
from pathlib import Path

PROJECT = Path('/home/ubuntu/cobrapro')
PAGES_DIR = PROJECT / 'client/src/pages'
COMPONENTS_DIR = PROJECT / 'client/src/components'
LOCALES_DIR = PROJECT / 'client/src/i18n/locales'

def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def get_nested(obj, key_path):
    parts = key_path.split('.')
    for p in parts:
        if isinstance(obj, dict) and p in obj:
            obj = obj[p]
        else:
            return None
    return obj

def extract_keys(file_path):
    with open(file_path, encoding='utf-8') as f:
        content = f.read()
    # Extrair t('key') e t("key")
    keys = set()
    for m in re.finditer(r"t\(['\"]([^'\"]+)['\"]\)", content):
        keys.add(m.group(1))
    return keys

# Carregar traduções
ptbr = load_json(LOCALES_DIR / 'pt-BR.json')
es = load_json(LOCALES_DIR / 'es.json')

# Coletar todos os arquivos TSX
tsx_files = list(PAGES_DIR.glob('*.tsx')) + list(COMPONENTS_DIR.glob('*.tsx'))

all_missing_ptbr = {}
all_missing_es = {}

for tsx_file in sorted(tsx_files):
    keys = extract_keys(tsx_file)
    if not keys:
        continue
    
    missing_ptbr = [k for k in keys if get_nested(ptbr, k) is None]
    missing_es = [k for k in keys if get_nested(es, k) is None]
    
    if missing_ptbr:
        all_missing_ptbr[tsx_file.name] = sorted(missing_ptbr)
    if missing_es:
        all_missing_es[tsx_file.name] = sorted(missing_es)

print("=" * 60)
print("CHAVES FALTANDO NO pt-BR.json:")
print("=" * 60)
total_ptbr = 0
for fname, keys in all_missing_ptbr.items():
    print(f"\n{fname} ({len(keys)} chaves):")
    for k in keys:
        print(f"  - {k}")
    total_ptbr += len(keys)
print(f"\nTotal pt-BR: {total_ptbr} chaves faltando")

print("\n" + "=" * 60)
print("CHAVES FALTANDO NO es.json:")
print("=" * 60)
total_es = 0
for fname, keys in all_missing_es.items():
    print(f"\n{fname} ({len(keys)} chaves):")
    for k in keys:
        print(f"  - {k}")
    total_es += len(keys)
print(f"\nTotal es: {total_es} chaves faltando")
