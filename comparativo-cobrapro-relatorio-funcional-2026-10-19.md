# Comparativo funcional — documento de referência × CobraPro

**Data da auditoria:** 19 de outubro de 2026  
**Base comparada:** documento `relatorio-funcional-completo.pdf` (39 páginas) × repositório `marcelinbh/COBRAPRO`, branch `main`, commit `dd4600c`  
**Escopo:** comparação funcional e técnica, sem alterar dados, configurações ou rotinas produtivas.

> **Nota de contexto:** o PDF descreve uma réplica financeira mais inicial, identificada como “Réplica MagoWeb”. O CobraPro não é essa réplica: ele já possui módulos adicionais próprios e integrações que não existiam naquele relatório. Portanto, esta análise separa o que o CobraPro já supera, o que atende parcialmente e o que ainda falta para atingir um nível operacional robusto.

---

## 1. Resumo executivo

O CobraPro está **bem mais avançado** do que a aplicação retratada no PDF em cadastros, contratos, cobrança, parcelamento, documentos de clientes, relatórios visuais, exportações, autenticação por e-mail/senha, portal do cliente, vendas, veículos, cheques, Blacklist compartilhada e integrações como Brevo, Kiwify, Evolution API, ViaCEP e Meta Pixel.

A principal diferença é que o PDF descreve uma fundação de crédito ainda sem autenticação própria, sem edição de clientes e sem WhatsApp real. O CobraPro já tem esses componentes em código e em interface. Entretanto, ele ainda possui lacunas importantes de **confiabilidade financeira e operacional**: não há livro de pagamentos independente, auditoria imutável e idempotência padronizada para todas as operações financeiras; a conciliação bancária não existe; o controle de permissões é básico; e a automação de WhatsApp ficou **tecnicamente implementada, mas operacionalmente bloqueada** após a suspensão da infraestrutura.

### Conclusão direta

- O CobraPro já entrega aproximadamente **70–75% do núcleo funcional** previsto no relatório, além de vários módulos que o documento não prevê.
- As pendências restantes não são principalmente “novas telas”; são controles de segurança, rastreabilidade e automação confiável.
- A prioridade correta é: **restaurar o WhatsApp por conta, corrigir a confiabilidade do núcleo financeiro, deixar os testes verdes e só então ampliar módulos como investidores, solicitações e conciliação bancária.**

---

## 2. O que o CobraPro já possui além do documento

O CobraPro supera o escopo da réplica descrita no PDF nos seguintes pontos:

- **Login próprio por e-mail e senha**, recuperação de senha, hash bcrypt, sessão e redirecionamento de acesso não autenticado.
- **Separação de dados por assinante (`user_id`)** nas rotinas principais. A exceção proposital é a Blacklist, que foi definida como recurso compartilhado entre assinantes.
- **Logs de acesso administrativos**, com IP, localização aproximada, dispositivo, navegador e sistema operacional.
- **Cadastro detalhado de clientes**: CPF, CNPJ, RG, e-mail, telefone, redes sociais, profissão, indicação, tipo de cliente, foto, documentos, endereço completo e busca automática de CEP.
- **Página de detalhe do cliente**, com contratos, parcelas, métricas, documentos e ações de contato.
- **Importação e exportação de clientes por CSV**.
- **Modalidades de operação adicionais**: empréstimo mensal, diário, semanal, quinzenal, Price, bullet/renovável, venda de produto e desconto de cheque.
- **Pagamento parcial com saldo residual**, pagamento de juros e renovação automática de parcela.
- **Reparcelamento**, com prévia e execução.
- **Edição de contratos e parcelas**, datas de vencimento manuais, etiqueta de contratos, histórico de alterações e comprovantes em PDF.
- **Contas a pagar com estorno**, cancelamento e sincronização de caixa.
- **Módulos próprios de negócio**: venda de telefones, veículos parcelados, cheques, assinaturas, score de clientes, análise de risco e PWA instalável.
- **Blacklist compartilhada** com busca por CPF/CNPJ/nome, fotos, endereço completo, cidade, estado, CEP, status e tipo de dívida.
- **Portal do cliente por Magic Link**, com parcelas e chave PIX.
- **Relatórios visuais, exportação de parcelas para PDF/Excel, extrato por cliente em PDF e backup em CSV/JSON.**
- **Integrações já conectadas em código**: Brevo, Kiwify, Evolution API, ViaCEP, armazenamento de arquivos e Meta Pixel/CAPI.

---

## 3. Matriz comparativa de funcionalidades

| Área do documento | Estado atual no CobraPro | Veredito | O que ainda falta ou precisa amadurecer |
|---|---|---|---|
| Navegação e painel | Sidebar responsiva, rotas numerosas, dashboard com KPIs, alertas, gráficos e atalhos | **Atende em grande parte** | Busca global real, breadcrumbs, atalhos, notificações internas e tratamento mais explícito de sessão expirada |
| Login, sessão e acesso | Login próprio, recuperação de senha, admin/user, redirecionamento de não autenticado, logs de login | **Supera o documento** | Papéis granulares por ação, 2FA, revogação de sessão, acesso real de gerente/cobrador e auditoria abrangente |
| Clientes | CRUD, busca, filtros, perfil detalhado, foto, documentos, endereço, ViaCEP, importação/exportação CSV | **Supera o documento** | Limite de crédito aplicado de fato, referências, histórico imutável do cliente e paginação/filtragem no servidor |
| Equipe e cobradores | CRUD de usuários internos/cobradores, perfis administrativos, comissões e relatório de performance | **Parcial** | Login individual da equipe, permissões por função, carteira atribuída, visitas/contatos, metas, aprovação por gerente e agenda operacional |
| Investidores | Não há módulo de investidor operacional no CobraPro atual | **Ausente** | Cadastro, aportes, saques, origem de capital, repasses, extrato, rendimento, fechamento e relatório por investidor |
| Produtos e categorias de crédito | Há produtos/estoque e etiquetas de contratos | **Parcial** | Produto de crédito com taxa, prazo, carência, tarifas, limites e preenchimento automático do simulador; categorias persistentes transversais |
| Solicitações de empréstimo | Não há este fluxo | **Ausente** | Pedido → análise → aprovação/recusa → conversão idempotente em contrato |
| Simulação e criação de empréstimos | Várias modalidades, cálculos, cronograma, datas manuais, caixa de origem, edição e reparcelamento | **Atende em grande parte** | Calendário financeiro por mês/feriados, carência, aprovação antes da emissão, CET, limites de crédito aplicados e descontos formais de quitação |
| Juros, multas e atraso | Multa percentual única e multa diária em valor; cálculo de mora; telas de configuração; correção de status e testes | **Parcial e sensível** | Política formal de carência, regras simples/compostas configuráveis, versionamento de regras, vigência e uso consistente de calendário de Brasília em todos os pontos |
| Parcelas e cobrança | Listagem, filtros de modalidade, parcial/total, saldo residual, pagamento de juros, renovação, edição, exclusão controlada, cobrança manual | **Atende em grande parte** | Promessa de pagamento, registro de contatos, cobrança agrupada por cliente, fila de cobrança e histórico imutável de cada alteração |
| Pagamentos | Baixa parcial/integral, método, data, conta, reflexo no caixa e comprovante | **Parcial** | Tabela/livro de pagamentos independente, filtros e paginação de recebimentos, estorno padronizado, comprovante anexado e trilha por operador |
| Caixa e contas | Contas, entradas/saídas, saldo, transações, contas a pagar, estorno de despesa e sincronização | **Atende em grande parte** | Transferência efetivamente em duas pontas, fechamento diário, saldo inicial auditável, conciliação bancária, importação OFX/CSV, comprovantes e bloqueio de saldo negativo por política |
| Receitas e despesas | Contas a pagar, pagamento, cancelamento, estorno e impacto no caixa | **Parcial** | Centro de custo, aprovação, recorrência mais completa, anexos e fechamento por período |
| Cheques, veículos, telefones e vendas | Módulos próprios com cadastro e acompanhamento | **Supera o documento** | Auditoria e relatórios consolidados desses módulos; fluxos de recebimento padronizados com o livro financeiro |
| Contratos e documentos | Contratos, promissórias, comprovantes e PDFs gerados no cliente; documentos do cliente em armazenamento | **Parcial** | Arquivo documental versionado, modelos configuráveis, assinatura eletrônica, testemunhas, avalista, envio rastreável e ligação de documento a cada pagamento |
| Relatórios e exportações | KPIs, inadimplência, fluxo, projeções, extrato de cliente, PDF/Excel/CSV em pontos específicos, backup CSV/JSON | **Atende em grande parte** | Relatórios server-side auditáveis, filtros consistentes de período, carteira por cobrador, retorno por investidor, fechamento contábil e exportações padronizadas em todos os módulos |
| Portal do cliente | Magic Link, consulta de parcelas e PIX | **Supera o documento** | Controle granular de expiração/revogação, histórico e documentos disponibilizados ao cliente |
| WhatsApp e comunicação | QR Code, templates, Evolution API, regras por assinante, logs, lembretes e relatório diário em código | **Implementado, mas não operacional após a suspensão** | Pareamento por usuário, recuperação de sessão, fila/outbox, tentativas, limites, opt-in/out, agrupamento e confirmação de entrega |
| Integrações | Brevo, Kiwify, Evolution, ViaCEP, upload, Meta Pixel/CAPI | **Supera o documento** | Banco/Open Finance, conciliação, gateway financeiro, assinatura eletrônica, backup externo cifrado e monitoramento centralizado |

---

## 4. Lacunas prioritárias encontradas

### P0 — confiabilidade antes de movimentar dinheiro em escala

1. **Livro de pagamentos separado das parcelas**
   - Hoje o valor pago e o status ficam principalmente na parcela, com reflexos no caixa.
   - Falta uma entidade de pagamento com ID, data/hora, método, usuário, parcela, conta, observação, comprovante e estorno.
   - Isso é indispensável para auditoria, reconciliação e correção de divergências sem apagar histórico.

2. **Idempotência financeira padronizada**
   - Há idempotência em pontos específicos, como webhook da Kiwify e rotina de despesas, mas não há uma chave idempotente uniforme para cada pagamento, baixa, ajuste, transferência e estorno.
   - Sem isso, uma repetição por dupla abertura, rede instável ou reenvio pode duplicar efeito financeiro.

3. **Auditoria financeira imutável**
   - Há `contrato_historico`, logs de login e estorno de contas a pagar, porém não uma trilha única e imutável para todas as mudanças sensíveis.
   - O sistema precisa registrar: evento, usuário, momento, origem, valor anterior, valor novo, motivo e vínculo financeiro.

4. **Integridade referencial e exclusões**
   - Há validações de exclusão em alguns fluxos, mas o schema ainda depende bastante de validação em aplicação e de convenções de `user_id`.
   - O ideal é consolidar FKs, regras de cancelamento/estorno e impedir exclusões que apaguem trilhas financeiras.

5. **Regras de data, juros e multa integralmente no fuso de Brasília**
   - A automação de mensagens usa `America/Sao_Paulo` corretamente.
   - Porém `shared/finance.ts` normaliza pelo relógio do servidor, e o endpoint de atualização de parcela usa `new Date().toISOString()` — referência UTC. Isso merece correção única e centralizada para evitar reclassificação de atraso ou encargos em horário indevido.
   - A suíte atual também tem um teste de juros/multa em desacordo com a implementação atual, o que precisa ser resolvido antes de considerar essa regra totalmente coberta.

### P1 — operação diária e gestão

6. **Conciliação bancária e transferência entre contas**
   - Não há importação de extrato, comparação de lançamentos nem transferência debitando origem e creditando destino de forma atômica.

7. **Calendário financeiro**
   - Existe calendário visual e datas manuais, mas não uma política financeira central de feriados, fins de semana e meses com quantidade variável de dias.

8. **Solicitações, aprovação e produtos de crédito**
   - O fluxo comercial de pedido e aprovação ainda não existe.
   - Produtos atuais são produtos de estoque; falta catálogo de produto financeiro com regras que preencham automaticamente o simulador.

9. **Investidores**
   - É a maior ausência funcional em relação ao PDF: não existe acompanhamento de aportes, capital disponível, retorno, distribuição de juros e prestação de contas por investidor.

10. **Gestão operacional da equipe**
    - A base de cobradores está presente, mas ainda falta transformar cadastro de equipe em operação: login, carteira, metas, produtividade, contatos e aprovações.

### P2 — documentos e integrações maduras

11. **Documentos com validade operacional**
    - Há PDFs e arquivos, mas não o ciclo completo de modelo, versão, assinatura, testemunhas, avalista, status e armazenamento documental auditável.

12. **Relatórios consolidados e exportações padronizadas**
    - O CobraPro já exporta em alguns módulos, mas precisa de um centro de relatórios com filtros de período, escopo por cobrador, fechamento e exportação uniforme.

13. **Backup e restauração comprovados**
    - A exportação local em CSV/JSON existe. Falta retenção, criptografia, restauração validada e rotina externa confiável.

---

## 5. Mensagens automáticas: onde paramos exatamente

### O que já está implementado no código

A automação de lembretes não está apenas planejada. Ela foi implementada e está no commit atual `dd4600c`, com estas capacidades:

- Ativação/desativação geral por assinante.
- Horário configurável por assinante no fuso **America/Sao_Paulo**.
- Regras independentes para **3 dias antes do vencimento** e **no dia do vencimento**.
- Mensagens editáveis com variáveis: nome, valor, vencimento, dias de atraso, empresa, parcela e total de parcelas.
- Registro em `notificacoes_log` de envio ou erro.
- Bloqueio de duplicidade por parcela, tipo de regra, usuário e dia de Brasília.
- Endpoint protegido `POST /api/scheduled/notificacoes`.
- GitHub Actions agendado a cada cinco minutos, autenticado por OIDC, que chama o endpoint produtivo.
- Relatório diário automático do gestor no horário configurado, também com marcador para impedir duplicidade.
- Testes unitários para horário de Brasília, cálculo da data-alvo, bloqueio de duplicidade, variáveis e normalização de telefone brasileiro.

### O que ocorreu com a suspensão da DigitalOcean

1. A suspensão derrubou o App Platform e o Droplet da Evolution API.
2. O App Platform e o site `https://cobrapro.online` foram reativados; a verificação posterior retornou **HTTP 200**.
3. A Evolution API voltou a responder **HTTP 200**, versão **1.8.6**.
4. As execuções do GitHub Actions entre 17 e 19 de outubro falharam porque o domínio retornava Cloudflare **530 / erro 1016** durante a indisponibilidade.
5. Após a retomada, **não há confirmação de uma execução bem-sucedida do agendador**. Portanto, o gatilho deve ser revalidado em `dry-run` antes de permitir disparos reais.
6. As sessões de WhatsApp pareadas não foram preservadas: o inventário da Evolution continha somente instâncias de teste em estado `connecting` e nenhuma instância produtiva `user-<id>` conectada.

### O bloqueio atual

O envio automático usa uma instância individual por assinante, no formato:

```text
user-<id-do-assinante>
```

Tanto o envio automático quanto o QR Code da área WhatsApp usam esse padrão. Por isso, uma instância genérica chamada `cobrapro` não é usada pelo disparador automático atual.

Na conta administrativa aberta durante a recuperação, a tela mostrou:

- lembrete de 3 dias: **Ativo**;
- lembrete no vencimento: **Ativo**;
- status da conexão: **Não Conectado**.

Isso significa que as regras estão ligadas, mas **nenhuma mensagem será enviada enquanto o WhatsApp daquela conta não estiver pareado**. A tentativa de criar/abrir o QR Code pela tela não gerou uma instância `user-<id>` visível na Evolution API; esse fluxo precisa ser ajustado e validado antes de ser usado em produção.

### Menor plano para fazer os lembretes voltarem a funcionar

1. Corrigir e validar a criação da instância individual `user-<id>` ao clicar em “Conectar WhatsApp”. O erro deve aparecer claramente na tela se a Evolution recusar a criação.
2. Exibir QR Code atualizado e escanear o código pelo WhatsApp do assinante.
3. Confirmar que o status retorna `open` para a instância daquele usuário.
4. Executar o GitHub Actions em **dry-run**, agora que o domínio voltou ao ar, e verificar a resposta do endpoint.
5. Realizar um único teste autorizado para o próprio WhatsApp do gestor.
6. Só então liberar o envio real das regras ativas.

### Melhorias recomendadas para a automação

Para tornar o recurso realmente confiável em escala, faltam:

- tabela de **outbox/fila** com status pendente, processando, enviado, falhou e cancelado;
- chave única de idempotência por usuário/parcela/regra/data;
- retentativas com atraso progressivo e limite máximo;
- limite diário e janela permitida de envio;
- opt-in/opt-out e lista de bloqueio por cliente;
- agrupamento de parcelas por cliente para evitar excesso de mensagens;
- painel de saúde por assinante: QR conectado, última mensagem, última falha e ações de reconexão;
- persistência segura das sessões da Evolution em volume/backup, para que reinícios de infraestrutura não apaguem o pareamento;
- monitoramento que avise o administrador se o cron falhar ou se a instância ficar desconectada.

---

## 6. Estado da qualidade técnica observado

Foi executada a suíte disponível sem alterar dados produtivos.

- **13 arquivos de teste passaram**;
- **6 arquivos falharam**;
- **152 testes passaram, 8 falharam e 7 foram ignorados**.

Os problemas observados incluem:

- divergência entre o teste legado e a implementação atual de juros/multa;
- teste end-to-end financeiro dependente de banco indisponível no ambiente local;
- testes de Supabase e backup usando chave local não registrada neste ambiente de auditoria;
- duas expectativas desatualizadas de tradução;
- teste de rejeição de token inválido da Kiwify com comportamento divergente do esperado.

Isso **não prova falha da produção**, pois a produção estava acessível e autenticou normalmente. Porém significa que o repositório não está com a suíte inteiramente verde. Antes de novas funções financeiras, recomenda-se limpar essas falhas e adicionar testes de integração contra um banco de homologação separado.

---

## 7. Plano priorizado recomendado

### Onda 0 — restabelecer a automação já construída

1. Corrigir o fluxo de criação de instância QR por assinante.
2. Parear o WhatsApp da conta administradora e de cada conta que utilizar automação.
3. Validar o GitHub Actions em `dry-run`.
4. Fazer um envio de teste autorizado para o próprio gestor.
5. Criar alerta quando a Evolution ou o cron falhar.

**Resultado esperado:** lembretes de 3 dias antes, no vencimento e relatório diário voltam a operar com evidência de envio e sem duplicidade.

### Onda 1 — blindar o núcleo financeiro

1. Criar livro de pagamentos e estornos financeiros.
2. Padronizar chave idempotente em toda operação que afeta saldo.
3. Unificar auditoria financeira e eliminar exclusões destrutivas de operações com histórico.
4. Consolidar FKs, validações e cancelamentos controlados.
5. Corrigir a política de data de Brasília em status, atraso, multa e endpoint agendado.
6. Deixar a suíte de testes totalmente verde em homologação.

**Resultado esperado:** caixa, recebimentos, atrasos e correções passam a ser rastreáveis e repetíveis sem divergência.

### Onda 2 — completar a operação de crédito

1. Produto de crédito e categorias persistentes.
2. Solicitação, análise, aprovação e conversão em contrato.
3. Calendário de feriados, carência e regras financeiras versionadas.
4. Carteira por cobrador, metas, contatos e promessa de pagamento.
5. Investidores, aportes e retorno — se esse for um modelo de negócio desejado.

### Onda 3 — gestão, documentos e integrações avançadas

1. Relatórios consolidados, fechamento e exportações padronizadas.
2. Conciliação bancária e importação de extratos.
3. Assinatura eletrônica e gestão documental versionada.
4. Backup externo cifrado com teste de restauração.
5. Banco/Open Finance, gateway e demais integrações com monitoramento e consentimento.

---

## 8. Recomendação final

O PDF é útil como checklist de maturidade, mas o CobraPro já ultrapassou boa parte dele. O maior ganho imediato não está em replicar as telas ausentes do documento: está em tornar confiável o que já existe.

**Próximo passo recomendado:** retomar e validar o módulo de mensagens automáticas por WhatsApp, começando pela correção da instância individual por assinante e pelo teste seguro do agendador. Em seguida, iniciar o pacote de integridade financeira: livro de pagamentos, idempotência, auditoria e regras de data no horário de Brasília.

---

## Evidências auditadas

- Documento enviado: `relatorio-funcional-completo.pdf`.
- Código atual: `client/src/App.tsx`, páginas em `client/src/pages/`, `server/routers.ts`, routers especializados, serviços de automação e `drizzle/schema.ts`.
- Automação: `server/services/notificacoesAutomaticas.ts`, `server/services/relatorioDiarioAutomatico.ts`, `server/_core/index.ts` e `.github/workflows/disparar-lembretes-whatsapp.yml`.
- Histórico de projeto: commits `b747a80` e `dd4600c` e arquivo `todo.md`.
- Observação operacional em 19/10/2026: site público em HTTP 200 após o deploy; Evolution API em HTTP 200; execuções anteriores do cron falharam durante a indisponibilidade do domínio.
