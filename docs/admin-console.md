# Console administrativo do Agenda Fashion

## Objetivo

A administração do AF é um centro de comando operacional. Ela deve responder, em ordem:

1. o sistema está pronto para operar;
2. onde profissionais estão travando na ativação;
3. como negócios, agendamentos e marketplace estão se comportando;
4. qual aquisição gera ativação, primeiro agendamento, recorrência e receita;
5. se WhatsApp e automações estão saudáveis.

Cadastros, cliques e sessões não são tratados como equivalentes a ativação, agendamento ou receita.

## Arquitetura de informação

- `/admin` — **Visão geral / Centro de comando**.
- `/admin/saude` — **Ativação profissional**. A rota histórica é preservada por compatibilidade, mas a interface não usa mais “Saúde do SaaS” para este fluxo.
- `/admin/operacao` — **Operação da plataforma**, com negócios, agendamentos e sinais do marketplace.
- `/admin/trafego-pago` — **Marketing**, incluindo aquisição, funil, custos e retorno.
- `/admin/whatsapp` — **WhatsApp e automações**.
- `/conta` — **Minha conta**.

No mobile, os quatro primeiros destinos aparecem na navegação primária. WhatsApp e Minha conta ficam em “Mais”.

## Estado atual x período

A Visão geral separa explicitamente duas naturezas de informação:

- **Situação atual**: readiness e fila de ativação representam o estado corrente da plataforma e não mudam de significado quando o administrador escolhe um período.
- **Desempenho no período**: profissionais vinculados, negócios criados, clientes observados em agendamentos, agendamentos e funil usam o período selecionado.

Os rótulos devem indicar essa diferença. “Clientes que agendaram”, por exemplo, não deve ser apresentado como sinônimo de total de contas de clientes cadastradas.

Períodos administrativos navegáveis são persistidos em `?periodo=` quando a página suporta essa dimensão. Durante troca de período, os últimos dados válidos permanecem visíveis enquanto a nova leitura é carregada; o primeiro carregamento continua usando o estado de loading completo.

Quando a URL ou um filtro já representa um novo contexto, mas a leitura desse contexto ainda não terminou, a interface deve distinguir o **contexto solicitado** do **contexto efetivamente carregado**. Dados anteriores podem permanecer visíveis para evitar saltos e telas vazias, mas devem ser identificados como pertencentes ao recorte anterior. Se a atualização falhar, essa identificação continua obrigatória. Ausência de uma fonte ou falha de leitura não pode ser convertida em zero: `0` significa valor confirmado igual a zero; indisponibilidade deve aparecer como `—`, “não verificado” ou estado equivalente.

As subpáginas de Marketing compartilham o mesmo `?periodo=`. Navegar entre Visão geral, Funil completo e Custos e retorno deve preservar o período selecionado.

## Funil profissional

O funil operacional deve preservar a sequência canônica:

**Cadastro → Negócio criado → Serviço criado → Agenda configurada → Negócio publicado → Primeiro agendamento → Checkout iniciado → Assinatura ativada.**

`Agenda configurada` não pode ser omitida dos resumos de Marketing porque a confirmação da agenda é requisito de publicação no fluxo novo.

A Visão geral pode destacar a maior perda observada entre etapas como prioridade operacional. Esse diagnóstico descreve a transição observada e não deve ser apresentado como causalidade estatística.

## Fontes de dados

A administração reutiliza as APIs protegidas existentes e mantém a separação entre operação, produto e marketing:

- `GET /health/ready` — prontidão da aplicação e do banco. Não representa saúde de workers ou integrações externas.
- `GET /admin/dashboard` — indicadores, comportamento, qualidade e sinais gerais da plataforma.
- `GET /admin/saude/perfis-incompletos` — ativação e próxima ação por profissional.
- `GET /admin/negocios` — negócios cadastrados, com busca e paginação server-side.
- `GET /admin/agendamentos` — agendamentos da plataforma, com busca, filtro de status e paginação server-side.
- `GET /admin/marketing` — rankings e cidades do marketplace.
- `GET /admin/marketing/funil-profissionais` — funil profissional.
- `GET /admin/whatsapp/templates` — templates, automações e métricas de envio.

Os endpoints administrativos permanecem protegidos por autenticação e autorização administrativa e não devem ser cacheados por navegador, proxy ou CDN.

## Operação paginada

`/admin/operacao` não deve pesquisar somente uma amostra previamente carregada no navegador. Negócios e agendamentos usam paginação no backend, com parâmetros normalizados e busca parametrizada no PostgreSQL.

Contratos:

- `GET /admin/negocios?busca=&pagina=1&limite=25`
- `GET /admin/agendamentos?busca=&status=&pagina=1&limite=25`

O limite padrão é 25 e o backend limita a página a no máximo 100 registros. A resposta inclui `paginacao` com `pagina`, `limite`, `total` e `totalPaginas`.

A listagem administrativa de agendamentos não precisa devolver o WhatsApp do cliente final para cumprir sua finalidade operacional.

A interface de Operação mantém `aba`, `busca`, `status` e `pagina` na query string quando aplicáveis. Isso permite reload, histórico do navegador e compartilhamento do mesmo recorte sem transformar uma aba ainda não carregada em um falso estado vazio.

## Deep links de ativação

A fila de ativação aceita estado navegável por query string:

- `?pendencia=agenda`
- `?pendencia=servico`
- `?pendencia=publicacao`
- `?pendencia=sem_negocio`
- `?busca=<termo>`

Cards de prioridade e profissionais destacados no Centro de comando devem apontar diretamente para o contexto correspondente, evitando exigir que o administrador repita o filtro depois do clique.

## Semântica de métricas

A cobertura de atribuição paga exibida no Marketing usa como denominador o **tráfego pago identificado pelo AF**. Por isso a interface deve explicitar “X% do tráfego pago identificado”, evitando interpretar a métrica como cobertura de todas as sessões do site.

GA4 explica navegação e comportamento. Banco e eventos canônicos do AF continuam sendo a fonte para ativação, agendamento, assinatura e receita.

Status de agendamento usam cor apenas como reforço semântico; o texto do status permanece obrigatório. Cancelado, pendente, confirmado/agendado e concluído devem ser distinguíveis visualmente sem depender somente da cor.

## Privacidade e operação

A primeira versão de `/admin/operacao` é somente leitura. Ela não adiciona ações destrutivas.

Na visão de agendamentos, dados de contato do cliente final não são exibidos e a listagem paginada não os devolve ao frontend. O objetivo é acompanhar a operação, não expor dados pessoais sem necessidade.

Na Ativação, contatos de profissionais continuam condicionados às regras existentes: WhatsApp só é oferecido quando autorizado e ações internas do sistema não geram contato manual.

## UX

- loading, erro e dados parciais devem ser tratados por bloco;
- falha de uma fonte não deve apagar dados válidos das demais;
- troca de período deve manter os dados anteriores visíveis até a nova leitura terminar;
- quando dados anteriores permanecem visíveis, a interface deve deixar claro a qual período, filtro, busca, aba ou página eles pertencem;
- ausência ou falha de leitura não deve ser exibida como valor `0` sem evidência de que o valor real é zero;
- navegação precisa funcionar em mobile e WebKit;
- tabelas operacionais podem permanecer tabulares no desktop, mas no mobile devem se reorganizar como cartões sem exigir rolagem horizontal;
- a operação usa busca e paginação no servidor para continuar correta conforme a base cresce;
- o Admin preserva superfícies neutras e usa cores apenas com significado operacional;
- cards de prioridade devem abrir o filtro correspondente quando houver um destino operacional claro.
