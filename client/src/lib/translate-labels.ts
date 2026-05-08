import i18n from '@/i18n/i18n';

// Mapa de strings em português para chaves de tradução
export const labelMap: Record<string, string> = {
  // Status e Badges
  "Excelente": "common.excellent",
  "Ruim": "common.poor",
  "Regular": "common.regular",
  "Bom": "common.good",
  "✓ Ativo": "common.activeStatus",
  "Inativo": "common.inactiveStatus",
  "Ativo": "common.active",
  
  // Ações comuns
  "Novo Cliente": "clients.newClient",
  "Novo Empréstimo": "loans.newLoan",
  "Novo Contrato": "common.newContract",
  "Novo Usuário": "users.newUser",
  "Novo Veículo": "vehicles.newVehicle",
  "Novo Cobrador": "collectors.newCollector",
  "Nova Transação": "cashbox.newTransaction",
  
  // Campos comuns
  "Nome": "clients.name",
  "CPF": "clients.cpf",
  "CNPJ": "clients.cnpj",
  "Telefone": "clients.phone",
  "E-mail": "clients.email",
  "Cidade": "clients.city",
  "Estado": "clients.state",
  "CEP": "clients.zipCode",
  "Data": "cashbox.date",
  "Descrição": "cashbox.description",
  "Valor": "cashbox.amount",
  "Status": "parcels.status",
  
  // Títulos de página
  "Clientes": "clients.title",
  "Empréstimos": "loans.title",
  "Parcelas": "parcels.title",
  "Caixa": "cashbox.title",
  "Relatórios": "reports.title",
  "Configuração": "configuration.title",
  "Meu Perfil": "profile.title",
  "Usuários": "users.title",
  "Veículos": "vehicles.title",
  "Cobradores": "collectors.title",
  
  // Botões
  "Salvar": "common.save",
  "Cancelar": "common.cancel",
  "Deletar": "common.delete",
  "Editar": "common.edit",
  "Fechar": "common.close",
  "Voltar": "common.back",
  "Próximo": "common.next",
  "Anterior": "common.previous",
  "Pesquisar": "common.search",
  "Filtrar": "common.filter",
  "Exportar": "common.export",
  "Importar": "common.import",
  "Baixar": "common.download",
  "Enviar": "common.upload",
  "Confirmar": "common.confirm",
  
  // Status de empréstimos
  "Pendente": "loans.pending",
  "Paga": "loans.paid",
  "Atrasada": "loans.overdue",
  "Vence Hoje": "loans.dueToday",
  "Parcial": "loans.partial",
  
  // Modalidades
  "Diário": "loans.daily",
  "Semanal": "loans.weekly",
  "Quinzenal": "loans.biweekly",
  "Mensal": "loans.monthly",
  
  // Mais labels
  "Upload falhou": "errors.uploadFailed",
  "Dados Pessoais": "clients.personalData",
  "Documentos": "clients.documents",
  "Foto": "clients.photo",
  "RG": "clients.rg",
  "Profissão": "clients.profession",
  "Instagram": "clients.instagram",
  "Facebook": "clients.facebook",
  "Observações": "forms.observations",
  "Referral": "clients.referral",
  "Tipo de Cliente": "clients.typeOfClient",
  "Empréstimo": "loans.title",
  "Compra": "clients.purchase",
  "Todos os status": "common.allStatus",
  "Nenhum cliente encontrado": "clients.noClientsFound",
  "Adicionar Cliente": "clients.addClient",
  "Editar Cliente": "clients.editClient",
  "Deletar Cliente": "clients.deleteClient",
};

/**
 * Traduz um label em português para o idioma atual
 * @param label - O texto em português
 * @returns O texto traduzido ou o label original se não encontrado
 */
export function translateLabel(label: string): string {
  const key = labelMap[label];
  if (!key) return label;
  return i18n.t(key);
}

/**
 * Obtém a chave de tradução para um label
 * @param label - O texto em português
 * @returns A chave de tradução ou undefined
 */
export function getLabelKey(label: string): string | undefined {
  return labelMap[label];
}
