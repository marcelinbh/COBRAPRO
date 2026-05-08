#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.join(__dirname, 'client/src/pages');

// Mapa de strings em português para chaves de tradução
const stringMap = {
  // Status e Badges
  '"Excelente"': 'common.excellent',
  '"Ruim"': 'common.poor',
  '"Regular"': 'common.regular',
  '"Bom"': 'common.good',
  '"✓ Ativo"': 'common.activeStatus',
  '"Inativo"': 'common.inactiveStatus',
  '"Ativo"': 'common.active',
  
  // Ações comuns
  '"Novo Cliente"': 'clients.newClient',
  '"Novo Empréstimo"': 'loans.newLoan',
  '"Novo Contrato"': 'common.newContract',
  '"Novo Usuário"': 'users.newUser',
  '"Novo Veículo"': 'vehicles.newVehicle',
  '"Novo Cobrador"': 'collectors.newCollector',
  '"Nova Transação"': 'cashbox.newTransaction',
  
  // Campos comuns
  '"Nome"': 'clients.name',
  '"CPF"': 'clients.cpf',
  '"CNPJ"': 'clients.cnpj',
  '"Telefone"': 'clients.phone',
  '"E-mail"': 'clients.email',
  '"Endereço"': 'clients.address',
  '"Cidade"': 'clients.city',
  '"Estado"': 'clients.state',
  '"CEP"': 'clients.zipCode',
  '"Data"': 'cashbox.date',
  '"Descrição"': 'cashbox.description',
  '"Valor"': 'cashbox.amount',
  '"Status"': 'parcels.status',
  
  // Títulos de página
  '"Clientes"': 'clients.title',
  '"Empréstimos"': 'loans.title',
  '"Parcelas"': 'parcels.title',
  '"Caixa"': 'cashbox.title',
  '"Relatórios"': 'reports.title',
  '"Configuração"': 'configuration.title',
  '"Meu Perfil"': 'profile.title',
  '"Usuários"': 'users.title',
  '"Veículos"': 'vehicles.title',
  '"Cobradores"': 'collectors.title',
  
  // Botões
  '"Salvar"': 'common.save',
  '"Cancelar"': 'common.cancel',
  '"Deletar"': 'common.delete',
  '"Editar"': 'common.edit',
  '"Fechar"': 'common.close',
  '"Voltar"': 'common.back',
  '"Próximo"': 'common.next',
  '"Anterior"': 'common.previous',
  '"Pesquisar"': 'common.search',
  '"Filtrar"': 'common.filter',
  '"Exportar"': 'common.export',
  '"Importar"': 'common.import',
  '"Baixar"': 'common.download',
  '"Enviar"': 'common.upload',
  '"Confirmar"': 'common.confirm',
  
  // Status de empréstimos
  '"Pendente"': 'loans.pending',
  '"Paga"': 'loans.paid',
  '"Atrasada"': 'loans.overdue',
  '"Vence Hoje"': 'loans.dueToday',
  '"Parcial"': 'loans.partial',
  
  // Modalidades
  '"Diário"': 'loans.daily',
  '"Semanal"': 'loans.weekly',
  '"Quinzenal"': 'loans.biweekly',
  '"Mensal"': 'loans.monthly',
};

// Páginas que não precisam de tradução
const skipPages = ['Install.tsx', 'InstalarApp.tsx', 'ComponentShowcase.tsx', 'NotFound.tsx'];

// Ler todas as páginas
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

let totalReplacements = 0;

files.forEach(file => {
  if (skipPages.includes(file)) {
    console.log(`⏭️  Pulando ${file}`);
    return;
  }

  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let replacements = 0;

  // Substituir cada string mapeada
  for (const [portuguese, key] of Object.entries(stringMap)) {
    // Contar quantas vezes a string aparece
    const matches = (content.match(new RegExp(portuguese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    
    if (matches > 0) {
      // Substituir com tratamento de JSX
      // Se estiver em um atributo JSX (ex: placeholder="..."), adicionar {}
      const regex = new RegExp(`(\\w+)=${portuguese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      const hasJSXAttribute = regex.test(content);
      
      if (hasJSXAttribute) {
        // Substituir em atributos JSX com {}
        content = content.replace(
          new RegExp(`(\\w+)=${portuguese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
          `$1={t('${key}')}`
        );
      } else {
        // Substituir em contexto normal (strings diretas)
        content = content.replace(
          new RegExp(portuguese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          `{t('${key}')}`
        );
      }
      
      replacements += matches;
      totalReplacements += matches;
    }
  }

  if (replacements > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✨ ${file}: ${replacements} substituições`);
  } else {
    console.log(`ℹ️  ${file}: nenhuma substituição`);
  }
});

console.log(`\n✅ Total de substituições: ${totalReplacements}`);
