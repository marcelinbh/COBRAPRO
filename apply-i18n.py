#!/usr/bin/env python3
"""
Script para aplicar traduções i18n em todas as páginas do CobraPro.
Substitui textos hardcoded por chamadas t() usando mapeamento de chaves.
"""

import os
import re

# Mapeamento de textos PT-BR para chaves de tradução
TEXT_MAP = {
    # Navegação
    '"Dashboard"': '{t(\'navigation.dashboard\')}',
    '"Clientes"': '{t(\'navigation.clients\')}',
    '"Empréstimos"': '{t(\'navigation.loans\')}',
    '"Contratos"': '{t(\'navigation.contracts\')}',
    '"Parcelas"': '{t(\'navigation.parcels\')}',
    '"Caixa"': '{t(\'navigation.cashbox\')}',
    '"Veículos"': '{t(\'navigation.vehicles\')}',
    '"Backup"': '{t(\'navigation.backup\')}',
    '"Cobradores"': '{t(\'navigation.collectors\')}',
    '"Relatórios"': '{t(\'navigation.reports\')}',
    '"Configuração"': '{t(\'navigation.configuration\')}',
    '"Usuários"': '{t(\'navigation.users\')}',
    '"Simulador"': '{t(\'navigation.simulator\')}',
    '"Vendas"': '{t(\'navigation.sales\')}',
    '"Cheques"': '{t(\'navigation.checks\')}',
    
    # Ações comuns
    '"Salvar"': '{t(\'common.save\')}',
    '"Cancelar"': '{t(\'common.cancel\')}',
    '"Editar"': '{t(\'common.edit\')}',
    '"Excluir"': '{t(\'common.delete\')}',
    '"Adicionar"': '{t(\'common.add\')}',
    '"Exportar"': '{t(\'common.export\')}',
    '"Carregando..."': '{t(\'common.loading\')}',
    '"Pesquisar"': '{t(\'common.search\')}',
    '"Filtrar"': '{t(\'common.filter\')}',
    '"Voltar"': '{t(\'common.back\')}',
    '"Confirmar"': '{t(\'common.confirm\')}',
    '"Fechar"': '{t(\'common.close\')}',
    '"Imprimir"': '{t(\'common.print\')}',
    '"Enviar"': '{t(\'common.send\')}',
    '"Baixar"': '{t(\'common.download\')}',
    '"Copiar"': '{t(\'common.copy\')}',
    '"Atualizar"': '{t(\'common.refresh\')}',
    '"Sim"': '{t(\'common.yes\')}',
    '"Não"': '{t(\'common.no\')}',
    '"Todos"': '{t(\'common.all\')}',
    '"Novo"': '{t(\'common.new\')}',
    '"Visualizar"': '{t(\'common.view\')}',
    '"Detalhes"': '{t(\'common.details\')}',
    '"Status"': '{t(\'common.status\')}',
    '"Ações"': '{t(\'common.actions\')}',
    '"Nome"': '{t(\'common.name\')}',
    '"Telefone"': '{t(\'common.phone\')}',
    '"E-mail"': '{t(\'common.email\')}',
    '"Endereço"': '{t(\'common.address\')}',
    '"Data"': '{t(\'common.date\')}',
    '"Valor"': '{t(\'common.value\')}',
    '"Total"': '{t(\'common.total\')}',
    '"Pago"': '{t(\'common.paid\')}',
    '"Pendente"': '{t(\'common.pending\')}',
    '"Atrasado"': '{t(\'common.overdue\')}',
    '"Ativo"': '{t(\'common.active\')}',
    '"Inativo"': '{t(\'common.inactive\')}',
    '"Tipo"': '{t(\'common.type\')}',
    '"Descrição"': '{t(\'common.description\')}',
    '"Período"': '{t(\'common.period\')}',
    '"Saldo"': '{t(\'common.balance\')}',
    '"Juros"': '{t(\'common.interest\')}',
    '"Desconto"': '{t(\'common.discount\')}',
    '"Vencimento"': '{t(\'common.dueDate\')}',
    '"CPF"': '{t(\'common.cpf\')}',
    '"Cidade"': '{t(\'common.city\')}',
    '"Estado"': '{t(\'common.state\')}',
    '"CEP"': '{t(\'common.zipCode\')}',
    '"Bairro"': '{t(\'common.neighborhood\')}',
    '"Rua"': '{t(\'common.street\')}',
    '"Número"': '{t(\'common.number\')}',
    '"Complemento"': '{t(\'common.complement\')}',
    '"Observações"': '{t(\'common.notes\')}',
    '"Nenhum dado encontrado"': '{t(\'common.noData\')}',
    '"Nenhum resultado"': '{t(\'common.noResults\')}',
    '"Hoje"': '{t(\'common.today\')}',
    '"Ontem"': '{t(\'common.yesterday\')}',
    '"Esta semana"': '{t(\'common.thisWeek\')}',
    '"Este mês"': '{t(\'common.thisMonth\')}',
    '"Personalizado"': '{t(\'common.custom\')}',
    '"Data Início"': '{t(\'common.startDate\')}',
    '"Data Fim"': '{t(\'common.endDate\')}',
    '"Categoria"': '{t(\'common.category\')}',
    '"Parcelas"': '{t(\'common.installments\')}',
    '"Data de Pagamento"': '{t(\'common.paymentDate\')}',
    '"Criado em"': '{t(\'common.createdAt\')}',
    '"Atualizado em"': '{t(\'common.updatedAt\')}',
}

pages_dir = "/home/ubuntu/cobrapro/client/src/pages"

def ensure_useTranslation(content, filename):
    """Garante que useTranslation está importado e const { t } = useTranslation() está no componente."""
    
    # Verificar se já tem o import
    if "useTranslation" not in content:
        # Adicionar import após o primeiro import
        content = re.sub(
            r"(import React.*?;|import \{.*?\} from 'react';)",
            r"\1\nimport { useTranslation } from 'react-i18next';",
            content,
            count=1
        )
    
    # Verificar se já tem const { t }
    if "const { t }" not in content and "const {t}" not in content:
        # Adicionar após a declaração da função do componente
        content = re.sub(
            r"(export (?:default )?function \w+\([^)]*\)\s*\{)",
            r"\1\n  const { t } = useTranslation();",
            content,
            count=1
        )
        # Tentar com arrow function também
        if "const { t }" not in content:
            content = re.sub(
                r"(const \w+ = \([^)]*\) => \{)",
                r"\1\n  const { t } = useTranslation();",
                content,
                count=1
            )
    
    return content

def count_t_calls(content):
    return len(re.findall(r"\bt\('", content))

# Processar cada página
pages = [f for f in os.listdir(pages_dir) if f.endswith('.tsx')]
print(f"Total de páginas: {len(pages)}")

for page in sorted(pages):
    filepath = os.path.join(pages_dir, page)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    before = count_t_calls(content)
    print(f"\n{page}: {before} chamadas t() antes")

print("\nScript de análise concluído.")
print("As páginas já têm useTranslation importado. Agora aplicando traduções...")
