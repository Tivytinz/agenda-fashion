# Wave 32 — Ingestão e reconciliação automática de custos factuais v1

> Workstream financeiro pós-baseline.
>
> A baseline funcional P0 + P1 permanece congelada em **67/67 (100%)**.

## Premissa

A Wave 31 tornou possível operar manualmente fontes factuais de custo variável,
com débito/crédito append-only, cobertura monotônica, trilha de auditoria e
autorização de superadmin.

O próximo gargalo não é fórmula econômica. É reduzir dependência de lançamento
manual sem criar custo por estimativa.

A Wave 32 adiciona uma camada de sincronização automática **somente para fontes
que possuam um adaptador factual implementado**. Nenhum provedor é presumido e
nenhuma fonte é cadastrada automaticamente.

## Objetivo

Transformar este fluxo:

```text
evidência externa
→ lançamento manual
→ cobertura manual
→ margem/LTV/retorno
```

em:

```text
provedor factual
→ adaptador interno
→ normalização
→ idempotência
→ ledger da Wave 29
→ cobertura reconciliada
→ margem/LTV/retorno
```

sem alterar billing, planos, entitlement ou a unidade econômica por negócio.

## Cutover

A migration 103 cria o marco:

`sync_contribuicao_v1_inicio`

O marco declara:

- nenhuma fonte seed;
- nenhum adaptador seed;
- nenhuma credencial financeira persistida no banco;
- histórico anterior não inferido;
- cobertura só avança após reconciliação concluída;
- lucro e CAC total continuam indisponíveis.

## Estruturas novas

### `contribuicao_integracoes_sync`

Vincula uma fonte já existente da Wave 31 a um adaptador interno.

Armazena apenas metadados operacionais:

- fonte;
- código do adaptador;
- ativo/inativo;
- intervalo;
- cursor opaco;
- última tentativa;
- último sucesso;
- última falha;
- erro seguro.

A tabela não guarda token, senha, secret ou credencial de provedor.

Cada fonte pode possuir no máximo uma integração automática na v1.

### `contribuicao_sincronizacoes`

Registra cada tentativa de sincronização:

- integração;
- status;
- cursor de entrada/saída;
- itens recebidos;
- itens importados;
- replays;
- cobertura declarada;
- erro seguro;
- início/fim.

O ledger econômico continua sendo `contribuicao_custos`. A tabela de
sincronização não duplica fatos financeiros.

## Contrato de adaptador

O registry interno aceita apenas adaptadores implementados no backend.

Um adaptador precisa expor:

```js
async coletar({
  integracaoId,
  fonte,
  cursor,
  agora
})
```

e devolver, no máximo, uma estrutura equivalente a:

```js
{
  itens: [
    {
      chaveOrigem,
      negocioId,
      tipo,
      valor,
      ocorridoEm,
      referenciaChaveOrigem?,
      detalhes?
    }
  ],
  cobertura: {
    inicioCobertura,
    cobertoAte,
    status
  } | null,
  proximoCursor: {}
}
```

A Wave 32 não oferece adaptador HTTP genérico configurável pelo usuário, para
evitar SSRF, ingestão arbitrária e exposição de segredos.

## Estado dos adaptadores nesta Wave

O registry de produção é criado **vazio**.

Isso é intencional.

A infraestrutura pode ser mergeada e testada sem fingir que WhatsApp, Resend,
Railway, imposto ou outra plataforma já oferecem um custo variável atribuível
por negócio.

Um adaptador real deve ser adicionado somente quando:

1. existir API/fonte factual verificável;
2. existir regra objetiva de associação ao negócio;
3. débito/crédito puderem ser reconciliados;
4. o provedor permitir determinar até onde a cobertura está completa.

## Idempotência

O ledger continua usando a chave:

`(fonte_id, chave_origem)`

Quando o adaptador devolve novamente o mesmo fato:

- o custo existente é reutilizado;
- o item conta como replay;
- não é criado novo custo.

Se o mesmo identificador externo reaparecer com valor, negócio, tipo, instante
ou referência incompatível, a sincronização falha como conflito.

O cursor só avança na mesma transação que persiste o lote reconciliado.

## Créditos e reversões

Um item `CREDITO` precisa informar `referenciaChaveOrigem`.

O backend resolve o débito pelo identificador externo, exige:

- mesma fonte;
- mesmo negócio;
- débito existente;
- saldo suficiente.

O débito é travado durante a validação de saldo. Crédito automático não pode
ultrapassar o valor ainda não revertido.

## Cobertura

A cobertura só é atualizada depois que todos os fatos do lote foram validados e
persistidos.

O adaptador não pode:

- declarar data futura;
- declarar `COMPLETA` sem `cobertoAte`;
- regredir o watermark existente;
- alterar o início histórico de cobertura.

Falha em qualquer item impede avanço de cursor e cobertura.

## Concorrência

Cada integração usa advisory lock próprio.

Duas execuções simultâneas da mesma integração não são permitidas.

Isso protege:

- cursor;
- cobertura;
- créditos;
- status operacional;
- chamadas duplicadas do worker.

Ao adquirir o lock para uma nova execução, qualquer tentativa antiga ainda
marcada como `EXECUTANDO` é encerrada como `execucao_abandonada`. Isso evita
estado operacional preso depois de restart ou crash do processo.

A idempotência do ledger continua sendo a segunda linha de defesa.

## Worker

O worker `contribution_cost_sync`:

- é desligado por padrão;
- exige `CONTRIBUTION_COST_SYNC_SCHEDULE_ENABLED=true`;
- usa polling global configurável entre 5 e 60 minutos, enquanto cada integração mantém seu próprio intervalo mínimo de 15 minutos;
- executa apenas integrações ativas e vencidas;
- registra saúde em `operationalMetricsService`;
- aguarda execuções em andamento durante shutdown.

Configuração:

- `CONTRIBUTION_COST_SYNC_SCHEDULE_ENABLED`;
- `CONTRIBUTION_COST_SYNC_POLL_INTERVAL_MINUTES`.

Nenhuma flag habilita um adaptador inexistente.

## API administrativa

Leitura:

- `GET /admin/financeiro/contribuicao/sync`.

Superadmin:

- `POST /admin/financeiro/contribuicao/sync/integracoes`;
- `PATCH /admin/financeiro/contribuicao/sync/integracoes/:id`;
- `POST /admin/financeiro/contribuicao/sync/integracoes/:id/executar`.

O PATCH permite pausar/reativar a integração e ajustar o intervalo por fonte. A
reativação exige fonte ativa e adaptador ainda disponível; pausar continua
permitido mesmo se o adaptador tiver sido removido do código.

A criação de integração só aceita adaptador registrado no backend e fonte ativa
já existente.

## Admin / UX

A tela de Receita recebe o painel **Sincronização automática de custos
factuais**.

Estados explícitos:

- loading;
- erro;
- nenhum adaptador;
- nenhuma integração;
- integração ativa/inativa;
- adaptador disponível/ausente;
- último sucesso;
- último erro;
- histórico recente;
- sincronização manual para superadmin quando aplicável;
- pausa/retomada operacional da integração.

Quando nenhum adaptador existe, a interface informa que nada é inferido de
WhatsApp, e-mail, infraestrutura ou imposto.

## Segurança

- nenhuma credencial é persistida nas tabelas da Wave 32;
- não existe endpoint para fornecer URL arbitrária de ingestão;
- fonte precisa existir antes da integração;
- configuração e execução manual exigem superadmin;
- valores críticos são validados no backend;
- timestamp futuro é rejeitado;
- cobertura futura é rejeitada;
- lote máximo: 1000 itens por execução;
- cursor/detalhes possuem limite de tamanho;
- falha não altera billing ou entitlement;
- erro exposto ao Admin é truncado e não deve conter segredo.

## Impacto econômico

A Wave 32 não cria uma nova fórmula financeira.

Ela alimenta o mesmo fluxo:

```text
receita líquida de gateway
→ custos variáveis observados
→ contribuição
→ LTV de contribuição
→ retorno de contribuição sobre CAC de mídia
```

Se nenhuma fonte real/adaptador existir, Waves 29 e 30 permanecem
**indisponíveis**.

## Fora do escopo

- inventar a primeira fonte factual;
- criar adaptador para provedor sem evidência de custo atribuível;
- rateio de infraestrutura fixa;
- folha/pró-labore;
- CAC total;
- DRE;
- lucro líquido;
- payback econômico definitivo;
- ingestão por URL arbitrária;
- credenciais em banco;
- decisão automática de orçamento.

## Critérios de encerramento

1. migration 103 aplicar em PostgreSQL de teste;
2. nenhum seed de fonte ou adaptador existir;
3. integration table não armazenar credenciais;
4. adaptador desconhecido ser rejeitado;
5. fonte inativa ser rejeitada;
6. integração duplicada por fonte ser rejeitada;
7. execução concorrente da mesma integração ser bloqueada;
8. lote ser validado antes de avançar cobertura/cursor;
9. débito ser idempotente;
10. replay contar separadamente sem duplicar ledger;
11. replay conflitante falhar;
12. crédito resolver débito pela chave externa;
13. crédito não ultrapassar saldo disponível;
14. timestamp futuro ser rejeitado;
15. cobertura futura ser rejeitada;
16. falha não avançar cursor;
17. falha não avançar cobertura;
18. sucesso persistir fatos + cobertura + cursor atomicamente;
19. worker ficar desligado sem flag explícita;
20. shutdown aguardar execução em andamento;
21. Admin mostrar estado vazio sem criar custo artificial;
22. testes unitários, Supertest, PostgreSQL e frontend cobrirem invariantes;
23. integração poder ser pausada sem depender do adaptador continuar disponível;
24. reativação exigir fonte ativa e adaptador disponível;
25. execução abandonada após crash ser encerrada antes da próxima tentativa;
26. CI completo ficar verde;
27. diff final ser revisado antes do merge.

## Estado atual

A Wave 32 está **implementada na branch de trabalho** como infraestrutura
provider-agnostic:

- migration 103;
- registry de adaptadores vazio em produção;
- repository de integrações e execuções;
- orquestrador transacional;
- idempotência/replay;
- crédito/reversão com validação de saldo;
- cobertura + cursor atômicos;
- advisory lock por integração;
- worker com feature flag;
- endpoints administrativos;
- painel de saúde no Admin;
- testes backend, worker, PostgreSQL e frontend.

A Wave não declara nenhuma integração factual ativa em produção. O próximo
passo para produzir custos reais é escolher e implementar um provedor cuja API e
regra de atribuição ao negócio sejam comprováveis.
