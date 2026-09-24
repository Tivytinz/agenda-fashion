# Admin Wave 1 — RF40 Administração operacional v1

> Baseline exclusiva do contexto administrativo.
>
> Esta Wave não altera a baseline funcional geral P0 + P1, que permanece
> congelada em **67/67 (100%)**.

## Fonte normativa

A Especificação de Requisitos v1.17 define:

- **RF40 — Administração operacional**: disponibilizar funções administrativas
  autorizadas para consulta e gestão operacional de usuários, negócios,
  agendamentos e estados relevantes;
- **RN25 — Autorização administrativa**: ações sensíveis só podem ser executadas
  por perfis autorizados e respeitando o nível de permissão atribuído.

O documento canônico do Admin também estabelece que a operação administrativa
prioriza leitura e diagnóstico; ações destrutivas ou de alto impacto exigem
justificativa própria, autorização e proteções proporcionais.

## Problema identificado

Antes desta Wave, `/admin/operacao` já possuía:

- consulta paginada de negócios;
- consulta paginada de agendamentos;
- busca server-side;
- filtro parcial por status de agendamento;
- sinais do marketplace.

Porém faltavam elementos necessários para uma leitura operacional coerente de
RF40:

1. usuários não possuíam consulta operacional dedicada, paginada e filtrável;
2. estado de negócio era reduzido a `ativo/inativo`, ocultando publicação,
   despublicação manual e arquivamento;
3. o filtro de agendamento no frontend não refletia o vocabulário real do banco
   (`agendado`, `confirmado`, `cancelado`, `realizado`, `falta`);
4. metadados relevantes do lifecycle não apareciam no recorte administrativo.

## Objetivo

Completar a camada de **consulta e diagnóstico operacional v1** de RF40 sem
introduzir mutações genéricas que possam contornar regras de domínio.

Fluxo:

```text
Admin autenticado
→ Operação
→ Usuários / Negócios / Agendamentos
→ busca + filtro + paginação server-side
→ estado operacional canônico
→ diagnóstico
```

## Backend

### Usuários

Novo endpoint:

`GET /admin/usuarios?busca=&status=&pagina=1&limite=25`

Estados aceitos:

- `ativo`;
- `desativado`;
- `encerrado`.

A resposta administrativa inclui apenas dados úteis ao diagnóstico:

- id;
- nome;
- e-mail;
- estado operacional;
- papel administrativo quando houver;
- papéis ativos em negócios;
- quantidade de negócios ativos;
- ativação do perfil profissional;
- verificação de e-mail;
- último login;
- timestamps de desativação/encerramento.

Não retorna:

- senha;
- hash;
- WhatsApp;
- credenciais;
- tokens.

### Negócios

`GET /admin/negocios` passa a aceitar `status`.

Estados canônicos:

- `publicado`;
- `despublicado`;
- `rascunho`;
- `inativo`;
- `arquivado`.

O diagnóstico passa a incluir:

- proprietária identificada;
- plano atual;
- publicação;
- despublicação manual;
- arquivamento e motivo;
- contagens operacionais já existentes.

### Agendamentos

O filtro administrativo passa a refletir os estados reais do ciclo vigente:

- `agendado`;
- `confirmado`;
- `realizado`;
- `falta`;
- `cancelado`.

Compatibilidade no service converte aliases legados de leitura, como
`concluido`, para `realizado`.

O recorte operacional também expõe, quando aplicável:

- início previsto;
- duração congelada;
- antecedência de cancelamento congelada;
- momento/ator da conclusão ou falta;
- origem/motivo do cancelamento.

O WhatsApp do cliente final continua fora da resposta administrativa de
operação.

## Frontend

A página `/admin/operacao` passa a ter quatro abas:

1. Usuários;
2. Negócios;
3. Agendamentos;
4. Marketplace.

Cada uma preserva query string de busca, estado e página quando aplicável.

No mobile, a composição continua usando os mesmos cards operacionais e deve
permanecer sem overflow horizontal.

## Segurança

- todas as rotas continuam usando `auth` + `authAdmin`;
- filtros são normalizados no service;
- SQL usa parâmetros;
- senha, WhatsApp e segredos não entram na resposta de usuários;
- contato do cliente final continua minimizado nos agendamentos;
- nenhuma nova mutação administrativa é criada nesta Wave;
- nenhuma regra de negócio é validada apenas no frontend.

## Por que não há mutação genérica nesta Wave

RF40 não deve ser interpretado como autorização para um administrador editar
livremente qualquer entidade.

Ações como:

- desativar conta de terceiro;
- arquivar negócio de terceiro;
- forçar publicação;
- corrigir estado terminal de agendamento;

podem afetar privacidade, agenda, billing, analytics e retenção histórica.

Essas ações exigem contrato explícito, autorização proporcional e trilha de
auditoria. A próxima frente formal é **RF41 — Auditoria de ações críticas**.

## Critérios de aceitação suplementares

### CA-ADM-01 — Consultar usuários operacionalmente

Dado um administrador autenticado
quando acessa a operação de usuários
então deve poder buscar e paginar a base no backend
e filtrar por ativo, desativado ou encerrado
sem receber senha, WhatsApp ou credenciais.

### CA-ADM-02 — Diagnosticar estado do negócio

Dado um negócio em qualquer estado operacional
quando o Admin consulta a operação
então publicado, despublicado manualmente, rascunho, inativo e arquivado devem
permanecer distinguíveis
e proprietária e plano devem poder ser identificados quando existirem.

### CA-ADM-03 — Usar estados canônicos de agendamento

Dado um agendamento existente
quando o Admin consulta ou filtra seu estado
então a interface deve usar o vocabulário canônico vigente do backend
e `falta` não deve ser confundida com cancelamento.

### CA-ADM-04 — Preservar privacidade e escala

Dado uma base administrativa crescente
quando usuários, negócios ou agendamentos são consultados
então busca e paginação devem ocorrer no servidor
e dados de contato desnecessários não devem ser enviados ao navegador.

## Testes

A Wave adiciona/atualiza:

- `tests/admin-operation-service.test.js`;
- `tests/admin-operation-repository.test.js`;
- `tests/admin-operation-routes.test.js`;
- `tests/admin-operation.integration.test.js`;
- `frontend/src/pages/AdminOperationPage.test.jsx`;
- `frontend/e2e/admin-operational-mobile.spec.js`.

## Impacto na matriz do Admin

A revisão formal revelou que a matriz v1.0 não enumerava toda a superfície de
RF40/RF41.

A v1.1 adiciona:

- `ADM-041` — operação de usuários;
- `ADM-042` — estados operacionais canônicos;
- `ADM-043` — auditoria administrativa transversal.

Após a Admin Wave 1:

```text
RF40: coberto na camada operacional v1
RF41: ainda não coberto transversalmente

Admin v1.1:
41/43 = 95,3%
```

As lacunas permanecem:

- `ADM-030` — adaptador factual real de custo variável;
- `ADM-043` — auditoria administrativa transversal.

## Banco de dados

A Wave não exige migration nova.

Os estados usados já existem nas migrations atuais:

- desativação/encerramento de usuário;
- despublicação manual/arquivamento de negócio;
- lifecycle e snapshots de agendamento.

A mudança é de consulta, normalização, API, UX e testes.

## Fora do escopo

- mutação genérica de usuários;
- reativação administrativa de conta;
- arquivamento administrativo de negócio;
- publicação forçada;
- correção excepcional de estado terminal;
- ledger transversal de auditoria;
- alteração de billing;
- alteração de planos;
- alteração da baseline geral 67/67.

## Critério de encerramento

A Wave está pronta para merge quando:

1. usuários são pesquisáveis/paginados server-side;
2. filtros de usuário aceitam somente estados conhecidos;
3. negócio diferencia publicado/despublicado/rascunho/inativo/arquivado;
4. agendamento usa os estados canônicos vigentes;
5. contato desnecessário do cliente não aparece;
6. queries permanecem parametrizadas;
7. testes unitários de service/repository ficam verdes;
8. Supertest da rota administrativa fica verde;
9. teste PostgreSQL valida o schema real;
10. React cobre abas/filtros/privacidade;
11. Playwright mobile permanece sem overflow;
12. CI completo fica verde;
13. diff final é revisado antes do merge.
