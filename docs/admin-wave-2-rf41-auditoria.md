# Admin Wave 2 — RF41 Auditoria administrativa transversal

## Contrato

RF41 exige rastreabilidade de ações administrativas críticas. RN25 exige
autorização proporcional. A Wave 1 tornou usuários, negócios e agendamentos
consultáveis; ela não concedeu permissões genéricas para alterar esses dados.

A Wave 2 cobre as escritas administrativas existentes em campanhas, investimento
de mídia, vínculos/sincronização de custos, fontes/custos/cobertura de
contribuição e autorização OAuth de TikTok/Pinterest. Não introduz ações novas
sobre contas, negócios ou agendamentos. As auditorias financeiras específicas
permanecem como fonte do detalhe financeiro; a trilha transversal fornece uma
entrada comum para localizar a ação e seu ator.

## Modelo e semântica

A migration `104_admin_auditoria_transversal.sql` cria
`admin_auditoria_eventos`. Cada operação identificada recebe uma tentativa UUID:

1. `INICIADA` é persistida **antes** do controller ou da troca de credenciais
   OAuth; se não for possível gravá-la, a ação é bloqueada;
2. `RESULTADO` é inserido após a resposta HTTP ou a execução do callback;
3. ausência do segundo evento aparece como `PENDENTE` e precisa de investigação
   pelo `request_id` e pelas trilhas específicas. Uma conexão interrompida pode
   deixar a tentativa pendente mesmo quando o domínio mudou de estado;
4. `HTTP_OK`/`HTTP_ERRO` descrevem a resposta da requisição, **não** a conclusão
   de um job externo ou a ativação de uma fonte financeira;
5. registros são append-only. Não se inferem eventos de períodos anteriores à
   migration e não se usam IDs do navegador como fonte de autorização.

Campos: ator (ID e papel administrativo validado no backend), ação da allowlist,
tipo de alvo, ID de alvo quando conhecido, código de provedor quando aplicável,
hash SHA-256 do request ID, instante UTC e status HTTP. Não armazenar corpo, query string,
URL de callback, códigos OAuth, tokens, contato, snapshots pessoais ou mensagem
bruta de erro. O ID do ator permanece como snapshot histórico mesmo se a conta
for encerrada. Requisições só de leitura não criam evento.

`GET /admin/auditoria` exige `auth` e `authAdmin` e libera a consulta apenas ao
superadmin. A resposta é paginada (25 por padrão, máximo de 100) e filtrável por
ação, ator, alvo e resultado (`PENDENTE`, `HTTP_OK`, `HTTP_ERRO`); a interface fica em `/admin/auditoria`, acessível a partir da
Operação para superadmin. A lista não utiliza paginação no navegador nem devolve
detalhes de integração. Um resultado pendente é identificado de forma explícita.

## OAuth e autorização

O callback externo não possui cookie administrativo obrigatório. O `state` de
uso único identifica a conta que iniciou a autorização; antes da troca de código
por token, o backend revalida no banco que ela ainda é administradora ativa.
Uma permissão revogada impede a persistência de novas credenciais. O código e
o token nunca entram na trilha.

## Limites e fechamento

A gravação de `RESULTADO` acontece após o envio HTTP nas rotas comuns. Caso ela
falhe, `INICIADA` persiste e um alerta de log contém somente tentativa, ação e
código seguro de erro. Não há garantia de atomicidade entre o resultado de uma
integração externa e o evento transversal; consultar também a trilha própria do
domínio. O campo `PENDENTE` não deve ser rotulado como sucesso ou falha.

`ADM-043` permanece **não coberto** na matriz até que CI e PostgreSQL reais
validem migration, imutabilidade, autorização, callbacks e trilha das escritas,
e que se defina e teste a reconciliação operacional de tentativas pendentes.
A baseline da Wave 1, `41/43`, não sobe apenas porque a tela ou tabela existe.

RNF02 também se aplica: APIs críticas visam p95 ≤ 2 s sob carga operacional
normal. A auditoria adiciona uma escrita antes da ação e uma escrita de
resultado; a consulta tem limite e índices por data, ator, ação e alvo. Medir o
p95 com volume representativo antes de declarar a meta atendida. A meta LCP de
2,5 s documentada para páginas públicas não é uma meta específica do Admin.
O workflow `performance-qa.yml` mede APIs públicas; seu resultado não valida a
consulta ou as escritas administrativas desta Wave. Na validação operacional,
carregar a tabela com volume representativo, medir separadamente p95 de
`GET /admin/auditoria` (sem filtro, por ator e por pendência) e de escritas
administrativas em ambiente isolado, com carga normal e credenciais de teste.
Comparar com a versão anterior e bloquear regressão acima da meta RNF02.

## Aceitação suplementar

- **CA-ADM-05:** uma escrita administrativa da allowlist só executa após
  `INICIADA`; sem banco de auditoria responde 503 sem invocar a operação.
- **CA-ADM-06:** sucesso, falha e resposta pendente preservam ator, ação,
  alvo quando conhecido, instante e correlação, sem payload ou segredo.
- **CA-ADM-07:** administrador comum não lê o ledger; superadmin consulta
  resultado paginado, filtrado e com estados de erro/vazio.
- **CA-ADM-08:** callback OAuth de `state` válido revalida a permissão do ator
  antes da troca de credenciais; permissão revogada não salva token.
- **CA-ADM-09:** banco impede alteração ou exclusão da trilha e não aceita duas
  fases iguais para a mesma tentativa.

## Validação prevista

Jest cobre validação do service, allowlist, bloqueio anterior à ação, callback
revogado e apresentação segura. PostgreSQL testa a migration, consulta e trigger
append-only. Vitest cobre filtros, permissão e estado pendente da interface;
build, lint e Playwright mobile preservam a operação existente. A leitura de
performance exige uma execução representativa separada.
