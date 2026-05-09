#!/usr/bin/env python3
import re
import json
import os
from pathlib import Path
from collections import defaultdict

# Padrões para extrair textos
patterns = [
    # toast.success('...')
    (r"toast\.success\(['\"]([^'\"]+)['\"]\)", 'toast_success'),
    # toast.error('...')
    (r"toast\.error\(['\"]([^'\"]+)['\"]\)", 'toast_error'),
    # toast.info('...')
    (r"toast\.info\(['\"]([^'\"]+)['\"]\)", 'toast_info'),
    # placeholder="..."
    (r'placeholder=["\']([^"\']+)["\']', 'placeholder'),
    # label>...< (dentro de <label>)
    (r'<label[^>]*>([^<]+)</label>', 'label'),
    # Button text
    (r'<Button[^>]*>([^<]+)</Button>', 'button'),
    # aria-label="..."
    (r'aria-label=["\']([^"\']+)["\']', 'aria_label'),
    # title="..."
    (r'title=["\']([^"\']+)["\']', 'title'),
    # Alert text
    (r'<Alert[^>]*>([^<]+)</Alert>', 'alert'),
    # Validação: toast.error('...')
    (r"toast\.error\(['\"]([^'\"]+)['\"]\)", 'validation'),
]

# Textos a ignorar (muito genéricos ou já traduzidos)
ignore_texts = {
    'Editar', 'Deletar', 'Salvar', 'Cancelar', 'Fechar', 'Abrir',
    'Sim', 'Não', 'OK', 'Erro', 'Sucesso', 'Aviso',
    'Carregando...', 'Nenhum dado encontrado',
    't(', '{', '}', '(', ')', '[', ']',
}

def extract_texts_from_file(filepath):
    """Extrai todos os textos de um arquivo TSX"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return {}
    
    texts = defaultdict(list)
    
    # Extrair toasts
    for match in re.finditer(r"toast\.(success|error|info)\(['\"]([^'\"]+)['\"]\)", content):
        text = match.group(2).strip()
        if text and text not in ignore_texts and len(text) > 2:
            key = f"toast_{match.group(1)}"
            texts[key].append(text)
    
    # Extrair placeholders
    for match in re.finditer(r'placeholder=["\']([^"\']+)["\']', content):
        text = match.group(1).strip()
        if text and text not in ignore_texts and len(text) > 2:
            texts['placeholder'].append(text)
    
    # Extrair labels
    for match in re.finditer(r'<label[^>]*>([^<]+)</label>', content):
        text = match.group(1).strip()
        if text and text not in ignore_texts and len(text) > 2 and 'className' not in text:
            texts['label'].append(text)
    
    # Extrair aria-labels
    for match in re.finditer(r'aria-label=["\']([^"\']+)["\']', content):
        text = match.group(1).strip()
        if text and text not in ignore_texts and len(text) > 2:
            texts['aria_label'].append(text)
    
    # Extrair titles
    for match in re.finditer(r'title=["\']([^"\']+)["\']', content):
        text = match.group(1).strip()
        if text and text not in ignore_texts and len(text) > 2:
            texts['title'].append(text)
    
    return texts

def main():
    pages_dir = Path('/home/ubuntu/cobrapro/client/src/pages')
    all_texts = defaultdict(list)
    
    # Extrair de todas as páginas
    for tsx_file in pages_dir.glob('*.tsx'):
        print(f"Processando {tsx_file.name}...")
        texts = extract_texts_from_file(tsx_file)
        for key, values in texts.items():
            all_texts[key].extend(values)
    
    # Remover duplicatas
    for key in all_texts:
        all_texts[key] = list(set(all_texts[key]))
    
    # Exibir resumo
    print("\n" + "="*60)
    print("RESUMO DE TEXTOS ENCONTRADOS:")
    print("="*60)
    total = 0
    for key, values in sorted(all_texts.items()):
        print(f"\n{key}: {len(values)} textos únicos")
        for text in sorted(values)[:5]:  # Mostrar primeiros 5
            print(f"  - {text[:60]}")
        if len(values) > 5:
            print(f"  ... e mais {len(values) - 5}")
        total += len(values)
    
    print(f"\nTOTAL: {total} textos únicos para traduzir")
    
    # Salvar em arquivo JSON para revisão
    output_file = '/home/ubuntu/cobrapro/textos-para-traduzir.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(dict(all_texts), f, ensure_ascii=False, indent=2)
    print(f"\nArquivo salvo em: {output_file}")

if __name__ == '__main__':
    main()
