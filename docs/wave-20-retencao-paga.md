# Wave 20 — Retenção paga e recuperação da assinatura

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline P0 + P1 continua congelada em **67/67 (100%)**. Regras duráveis de
> plano, billing, recorrência e webhook permanecem nos documentos canônicos e
> especializados do domínio financeiro.

## Objetivo

Proteger a fase pós-conversão da assinatura:

```text
assinatura ACTIVE
  → cobrança recorrente
  → pagamento recebido
      ou atraso
      ou reversão/disputa
      ou cancelamento voluntário
  → recuperação financeira ou fim do período pago
```

A Wave evita tratar estes fatos como equivalentes:

```text
cobrança atrasada != churn definitivo
cancelamento da renovação != perda imediata de acesso
fatura aberta != pagamento confirmado
estorno/disputa != simples atraso recuperável
```

## Causa observada

Antes da Wave 20, o backend já conseguia suspender uma assinatura em
`OVERDUE`, retornar temporariamente o negócio ao plano Grátis e reativar a
assinatura quando um pagamento posterior fosse confirmado.

A API da conta, porém, listava pagamentos apenas da assinatura ativa ou
pendente. Depois da suspensão, `ultimaAssinatura` ainda identificava a
assinatura que falhou, mas seus pagamentos deixavam de aparecer na resposta.

Além disso:

- `pagamentos.invoice_url` já existia no schema, mas o runtime não persistia a
  `invoiceUrl` retornada pelo Asaas;
- atraso, estorno e chargeback eram apresentados pela mesma mensagem genérica de
  falha;
- uma assinatura `CANCELED + ativo = TRUE` mostrava a data do fim do período
  como `Próxima cobrança`, apesar de a renovação já estar cancelada.

## Implementação

### Fatura recorrente

Sem migration nova, o runtime passa a reutilizar `pagamentos.invoice_url`.

A URL é capturada:

- na cobrança PIX inicial quando o Asaas a devolve;
- no payload seguro de webhook;
- na criação de um pagamento recorrente local;
- em sincronizações posteriores da mesma cobrança.

A API da conta aceita a fatura como recuperável somente quando:

1. o estado agregado continua `FALHA_DE_PAGAMENTO`;
2. `tipo_falha = COBRANCA_ATRASADA`;
3. o pagamento possui estado recuperável;
4. a URL usa HTTPS;
5. o hostname é `asaas.com` ou subdomínio oficial.

A resposta expõe `pagamento_recuperavel` somente nessas condições.

### Semântica de falha

O código público `FALHA_DE_PAGAMENTO` é preservado por compatibilidade e ganha
`tipo_falha`:

- `COBRANCA_ATRASADA`: atraso/falha recuperável;
- `REVERSAO_OU_DISPUTA`: refund, desfazimento de recebimento ou chargeback.

Somente a primeira categoria pode exibir o CTA `Regularizar pagamento`. A interface não precisa expor a marca do provedor no rótulo da ação; abaixo do CTA, informa apenas que a proprietária será direcionada para um ambiente seguro de pagamento.

### Cancelamento

`CANCELED/CANCELLED + ativo = TRUE` continua significando que o período pago
ainda está vigente.

A tela passa a exibir:

```text
Renovação cancelada
Acesso até DD/MM/AAAA
```

e não `Próxima cobrança`.

### Recuperação

Abrir a fatura não reativa o plano. A reativação continua pertencendo ao
processamento financeiro do backend após evento válido do Asaas.

O ciclo esperado é:

```text
OVERDUE
  → plano Grátis temporário
  → proprietária abre fatura oficial
  → pagamento é confirmado no Asaas
  → webhook idempotente
  → assinatura ACTIVE
  → plano pago restaurado
```

## Segurança

A Wave não confia em URL enviada pelo frontend.

A `invoiceUrl` nasce da integração autenticada, é persistida no backend e ainda
é validada antes de aparecer na API da conta. URLs HTTP ou fora do domínio
oficial do Asaas não são oferecidas como recuperação.

Nenhum clique, redirect ou retorno da página hospedada confirma pagamento.

## Banco e integrações

Nenhuma migration é necessária porque `pagamentos.invoice_url` já existe desde
a criação da tabela financeira.

Não há mudança de preço, catálogo, limite, segredo, autenticação de webhook ou
regra de entitlement.

## Testes

A Wave adiciona ou reforça:

- serviço da conta listando pagamentos da última assinatura suspensa;
- separação entre atraso recuperável e reversão/disputa;
- rejeição de URL de recuperação fora do Asaas;
- persistência de `invoiceUrl` em cobrança recorrente;
- payload seguro do webhook;
- UX de `Acesso até` após cancelamento;
- Playwright mobile de cancelamento com período pago;
- Playwright mobile de atraso → fatura segura → recuperação → plano ativo.

Todos os testes de navegador usam mocks e não executam cobrança real.

## Critério de encerramento

A Wave 20 pode ser encerrada quando:

1. Backend CI estiver verde no head final;
2. Playwright mobile passar na matriz suportada;
3. cobrança atrasada recuperar o histórico financeiro da assinatura correta;
4. somente URL HTTPS oficial do Asaas puder ser exposta;
5. estorno/disputa não exibir CTA de simples regularização;
6. cancelamento com período pago mostrar `Acesso até`;
7. reativação continuar dependente de webhook financeiro válido;
8. não houver migration ou mudança financeira fora do escopo;
9. o PR for mergeado com autorização explícita.

## Estado atual

A Wave está **em andamento** na branch `feat/product-ux-wave-20`.
