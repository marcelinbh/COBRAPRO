#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.join(__dirname, 'client/src/pages');

// Páginas que não precisam de tradução
const skipPages = ['Install.tsx', 'InstalarApp.tsx', 'ComponentShowcase.tsx', 'NotFound.tsx'];

// Ler todas as páginas
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  if (skipPages.includes(file)) {
    console.log(`⏭️  Pulando ${file}`);
    return;
  }

  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Verificar se já tem useTranslation
  if (content.includes('useTranslation')) {
    console.log(`✅ ${file} já tem useTranslation`);
    return;
  }

  // Verificar se tem import do react
  const hasReactImport = content.includes("import React") || content.includes("import { ");

  // Adicionar import do useTranslation se não tiver
  if (!content.includes("import { useTranslation }")) {
    // Encontrar o primeiro import
    const importMatch = content.match(/^import\s+/m);
    if (importMatch) {
      const importIndex = content.indexOf(importMatch[0]);
      // Encontrar o final da linha de import
      const lineEndIndex = content.indexOf('\n', importIndex);
      
      // Adicionar import do useTranslation após os imports
      const firstImportEnd = content.indexOf('\n', importIndex) + 1;
      const nextImportMatch = content.substring(firstImportEnd).match(/^import\s+/);
      
      if (nextImportMatch) {
        const insertIndex = firstImportEnd + nextImportMatch.index + nextImportMatch[0].length;
        // Encontrar o fim dessa linha
        const insertLineEnd = content.indexOf('\n', insertIndex);
        
        // Adicionar import antes do primeiro import
        content = content.substring(0, importIndex) + 
                  "import { useTranslation } from 'react-i18next';\n" +
                  content.substring(importIndex);
      }
    }
  }

  // Adicionar useTranslation() na função do componente
  // Encontrar a função principal (export default function ou export const)
  const functionMatch = content.match(/export\s+(default\s+)?function\s+\w+\s*\(|export\s+const\s+\w+\s*=\s*\(/);
  
  if (functionMatch) {
    const functionStart = content.indexOf(functionMatch[0]) + functionMatch[0].length;
    // Encontrar o primeiro { após a função
    const bodyStart = content.indexOf('{', functionStart);
    
    // Verificar se já tem useTranslation
    const functionBody = content.substring(bodyStart, bodyStart + 500);
    if (!functionBody.includes('const { t }')) {
      // Adicionar useTranslation() logo após o {
      const insertIndex = bodyStart + 1;
      content = content.substring(0, insertIndex) + 
                "\n  const { t } = useTranslation();" +
                content.substring(insertIndex);
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`✨ Atualizado ${file}`);
});

console.log('\n✅ Script concluído!');
