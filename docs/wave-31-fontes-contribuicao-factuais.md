# Wave 31 — Fontes factuais de custos de contribuição v1

> Workstream financeiro pós-baseline.
>
> A baseline funcional P0 + P1 permanece congelada em **67/67 (100%)**.

## Premissa

As Waves 29 e 30 já possuem o motor econômico para:

- margem de contribuição observada;
- LTV de contribuição D30/D60/D90;
- retorno de contribuição sobre CAC de mídia;
- recuperação observada em D30/D60/D90.

Essas leituras permanecem indisponíveis quando não existe fonte obrigatória
factual de custo variável com cobertura verificável.

A Wave 31 não inventa um custo para desbloquear as métricas. Ela cria o fluxo
operacional seguro para cadastrar uma fonte **somente quando existir evidência
real**, registrar seus custos e declarar a cobertura que foi efetivamente
conciliada.

## Objetivo

Permitir que o AF opere custos variáveis de contribuição de forma:

- factual;
- auditável;
- idempotente;
- append-only;
- restrita no backend;
- reconciliável com negócio, fonte e período.

A pergunta respondida por esta Wave é:

> Quais fontes reais de custo variável estão sendo observadas e até que ponto
> seus dados estão completos?

Ela não redefine margem, LTV ou retorno; apenas fornece fatos confiáveis para as
camadas econômicas existentes.

## Cutover

A migration 102 cria o marco:

`fontes_contribuicao_v1_inicio`

O marco registra que:

- a unidade econômica continua sendo negócio;
- escrita financeira administrativa exige superadmin;
- nenhum histórico anterior é inferido;
- nenhuma fonte é criada automaticamente;
- correção usa crédito append-only;
- cobertura é monotônica;
- lucro e CAC total continuam indisponíveis.

## Fonte factual

Uma fonte só deve ser cadastrada quando existir evidência verificável da regra
de custo.

Exemplos potenciais, **somente quando houver dado real disponível**:

- custo variável de mensageria por negócio;
- taxa variável de uma integração;
- imposto diretamente atribuível e observável;
- custo operacional variável com regra objetiva de atribuição.

Não são fontes válidas apenas por estimativa:

- rateio arbitrário de salário;
- pró-labore;
- infraestrutura fixa dividida por clientes;
- agência sem regra de atribuição;
- overhead;
- “custo médio” não reconciliável com documento ou provedor.

A migration 102 continua com **zero fontes seed**.

## Permissões

Leitura do painel:

- administrador autenticado.

Escritas:

- somente `superadmin`, validado no backend a cada requisição.

O frontend não decide permissão financeira. O backend usa `req.admin`
resolvido por `authAdmin`, que consulta a permissão atual no banco.

Operações restritas:

- criar fonte;
- registrar débito;
- registrar crédito;
- avançar cobertura.

## Fonte imutável na v1

O código da fonte é imutável depois da criação.

A Wave 31 não implementa exclusão, arquivamento ou alteração da obrigatoriedade
de uma fonte já usada em fatos econômicos. Fazer isso sem temporalidade própria
poderia reescrever a interpretação do histórico.

Mudança futura de taxonomia deve ganhar regra temporal explícita em outra
migration.

## Ledger de custos

A Wave 31 reutiliza `contribuicao_custos`.

Um lançamento contém:

- fonte;
- negócio;
- chave externa/idempotente;
- tipo `DEBITO` ou `CREDITO`;
- valor;
- instante factual;
- referência ao débito, quando for crédito;
- detalhes operacionais.

### Débito

Aumenta o custo variável atribuído ao negócio.

### Crédito

Corrige ou devolve um débito sem apagar o fato original.

No fluxo administrativo da Wave 31, crédito:

- exige `custoReferenciadoId`;
- precisa apontar para débito da mesma fonte e negócio;
- não pode superar o saldo ainda não creditado daquele débito;
- é validado sob lock dentro da mesma transação.

## Idempotência

A chave canônica continua:

`(fonte_id, chave_origem)`

Replay do mesmo fato:

- retorna o lançamento existente;
- não cria novo custo;
- não cria nova linha de auditoria.

Replay com payload financeiro diferente:

- é rejeitado como conflito.

Isso evita duplicar custos em reenvio de integração, retry HTTP ou ação
administrativa repetida.

## Cobertura

A Wave 31 reutiliza `contribuicao_cobertura`.

Por fonte, o sistema registra:

- `inicio_cobertura`;
- `coberto_ate`;
- `COMPLETA` ou `INCOMPLETA`.

O início da cobertura não pode mudar depois de definido e o watermark
`coberto_ate` não pode regredir.

A regra econômica permanece:

> ausência de lançamento só pode significar custo zero dentro de cobertura
> completa declarada para a fonte.

Sem cobertura completa, ausência de linha significa **desconhecido**.

## Auditoria append-only

A migration 102 cria `contribuicao_operacoes_admin`.

Cada operação administrativa nova registra:

- usuário autenticado;
- fonte;
- negócio, quando aplicável;
- custo, quando aplicável;
- ação;
- motivo obrigatório;
- detalhes;
- timestamp.

Ações v1:

- `CRIAR_FONTE`;
- `REGISTRAR_CUSTO`;
- `REGISTRAR_CREDITO`;
- `ATUALIZAR_COBERTURA`.

A tabela possui trigger que bloqueia `UPDATE` e `DELETE`.

A auditoria não substitui o ledger financeiro. Ela registra **quem e por que**
executou a operação administrativa.

## Motivo obrigatório

Toda escrita da Wave 31 exige justificativa humana entre 4 e 240 caracteres.

Exemplos adequados:

- “Fatura de setembro conciliada com provedor X”;
- “Estorno parcial confirmado no documento Y”;
- “Cobertura fechada após conciliação diária”.

“ajuste”, “teste” ou texto sem evidência não tornam um custo factual por si só.
A operação continua dependendo da responsabilidade do superadmin e da fonte
real subjacente.

## API administrativa

Endpoints protegidos por `auth` + `authAdmin`:

- `GET /admin/financeiro/contribuicao`;
- `POST /admin/financeiro/contribuicao/fontes`;
- `POST /admin/financeiro/contribuicao/custos`;
- `POST /admin/financeiro/contribuicao/cobertura`.

A leitura retorna:

- fontes e cobertura;
- quantidade de lançamentos;
- custo líquido observado;
- últimos custos;
- últimas operações de auditoria;
- se o usuário atual pode editar.

## Admin / UX

A tela de Receita recebe o painel **Fontes factuais de contribuição**.

Estados tratados:

- carregando;
- erro;
- nenhuma fonte;
- leitura sem permissão de escrita;
- sucesso de operação;
- fonte com/sem cobertura;
- histórico recente.

Superadmin pode:

- cadastrar fonte;
- registrar débito/crédito;
- atualizar cobertura.

Admin comum recebe leitura, mas os formulários de escrita não são exibidos.

A restrição visual é apenas UX; a autorização real continua no backend.

## Segurança e integridade

- IDs, valor, ator e permissão são validados no backend;
- `usuarioId` do payload é ignorado;
- ator vem de `req.admin.usuarioId`;
- escrita financeira exige superadmin;
- fonte não pode ser criada por seed;
- custo não é atualizado ou apagado;
- crédito administrativo exige débito referenciado;
- soma de créditos não pode superar o débito;
- coverage watermark não regride;
- auditoria e fato financeiro são persistidos na mesma transação administrativa;
- replay não duplica auditoria;
- frontend não define margem, preço, permissão ou cobertura válida;
- falha desta camada não altera billing ou entitlement.

## Impacto nas Waves 29 e 30

A Wave 31 não força disponibilidade.

Ela torna possível que uma fonte real seja operada quando o AF possuir o dado.
Depois disso:

- Wave 29 pode liberar margem/LTV apenas na cobertura realmente completa;
- Wave 30 pode liberar retorno de contribuição apenas para a mesma base
  economicamente coberta.

Se nenhuma fonte real for cadastrada, o comportamento correto continua sendo
**Indisponível**.

## Fora do escopo

- criar uma fonte real sem dado factual disponível;
- importação automática de um provedor específico;
- rateio de custos fixos;
- CAC total/fully loaded;
- lucro líquido;
- DRE;
- folha e pró-labore;
- payback econômico definitivo;
- alteração histórica de obrigatoriedade de fonte;
- exclusão de ledger financeiro;
- decisão automática de orçamento.

## Critérios de encerramento

1. migration 102 aplicar no banco de teste;
2. nenhum seed de fonte ser criado;
3. escrita exigir superadmin no backend;
4. leitura continuar disponível para admin;
5. código da fonte ser validado e único;
6. motivo ser obrigatório em toda escrita;
7. débito ser append-only e idempotente;
8. replay idêntico não duplicar auditoria;
9. replay conflitante ser rejeitado;
10. crédito exigir débito da mesma fonte/negócio;
11. crédito não superar saldo do débito;
12. cobertura não regredir;
13. auditoria bloquear UPDATE/DELETE;
14. ator vir da sessão administrativa;
15. fonte sem cobertura continuar desconhecida;
16. ausência de fonte não ser tratada como custo zero;
17. UI tratar loading/error/empty/success/read-only;
18. testes unitários cobrirem permissão e regras financeiras;
19. Supertest cobrir identidade e rotas;
20. PostgreSQL validar ledger, crédito, cobertura e auditoria;
21. frontend possuir testes do painel;
22. CI completo ficar verde;
23. diff final ser revisado antes de merge.

## Estado atual

A Wave 31 está **implementada na branch de trabalho** com:

- migration 102 e cutover próprio;
- auditoria append-only;
- repository operacional;
- service administrativo com superadmin;
- transações para fato + auditoria;
- registro de fonte sem seed;
- débito/crédito idempotente;
- limite de crédito por saldo do débito;
- cobertura monotônica;
- endpoints administrativos;
- painel na Receita;
- testes unitários, de rota, PostgreSQL e frontend.

Nenhuma fonte factual foi inventada ou cadastrada automaticamente. A
disponibilidade econômica em produção continua dependendo de uma fonte real e
de cobertura comprovável.
