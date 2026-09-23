# Wave 19 — Monetização e ativação de assinatura paga

> Documento de evidência/workstream do hardening pós-baseline.
>
> A baseline P0 + P1 continua congelada em **67/67 (100%)**. Regras duráveis de
> planos e billing permanecem em `docs/planos.md`,
> `docs/checkout-idempotente.md` e documentos financeiros especializados.

## Objetivo

Proteger de ponta a ponta a passagem entre intenção comercial e benefício pago:

```text
negócio publicado
  → escolha de plano pago
  → checkout elegível
  → uma cobrança PIX
  → pagamento confirmado
  → ativação financeira concluída
  → plano pago efetivamente em uso
```

A distinção central é:

```text
clique em plano
  != checkout iniciado
  != PIX gerado
  != pagamento confirmado
  != assinatura ativa
  != receita
```

## Causa e risco observados

Antes da Wave 19, a UI já evitava encaminhar uma proprietária de negócio ainda
não publicado para o checkout. O `POST /checkout`, porém, validava vínculo de
dona, plano, forma de pagamento e idempotência sem revalidar
`negocios.publicado`.

Isso deixava uma divergência entre navegação e autoridade do backend: uma
requisição direta poderia iniciar a operação financeira antes da condição usada
pela primeira jornada.

Além disso, checkout, assinatura e estados financeiros possuíam cobertura
unitária forte, mas não havia uma regressão de navegador dedicada à sequência
PIX pendente → pagamento confirmado → assinatura `ACTIVE`.

## Primeiro recorte

### Elegibilidade no backend

`checkoutRepository.buscarNegocioDono` passa a carregar
`negocios.publicado`.

`checkoutService.criarCheckout` rejeita negócio não publicado com HTTP 409
antes de:

- consultar/criar tentativa de checkout;
- registrar assinatura pendente;
- criar cliente/cobrança no Asaas;
- produzir qualquer benefício pago.

O frontend continua orientando a jornada, mas não é autoridade financeira.

### Jornada mobile de monetização

O Playwright cobre APIs financeiras mockadas, sem criar cobrança real:

1. dona autenticada e negócio publicado usam o plano Grátis;
2. escolhe o plano Autônoma;
3. abre o checkout;
4. informa CPF/CNPJ;
5. gera um único PIX;
6. mantém a tela no checkout quando o pagamento já foi confirmado mas a
   assinatura ainda está `PENDING`;
7. navega para Plano e assinatura somente depois de
   `pagamento confirmado + assinatura ACTIVE + ativo = true`;
8. confirma o plano pago como plano em uso;
9. confirma pagamento na visão da assinatura;
10. preserva responsividade mobile.

Um segundo cenário abre uma assinatura com upgrade PIX pendente, recarrega a
página e confirma que o QR/copia-e-cola persistido continua recuperável sem novo
`POST /checkout`.

## Segurança financeira

O recorte não altera preço, limites, catálogo, webhook, segredo ou assinatura
Asaas.

Nenhum dado enviado pelo navegador passa a decidir preço, plano vigente ou
ativação. O backend continua usando plano persistido, vínculo de proprietária e
confirmação financeira autenticada.

## Banco e integrações

Nenhuma migration é necessária.

A Wave não altera o contrato de webhook nem executa pagamento real nos testes de
browser. As integrações financeiras externas permanecem cobertas pelos testes
de saga, idempotência e webhook existentes.

## Observabilidade

O Admin continua distinguindo:

- tentativa técnica de checkout;
- negócio que iniciou checkout;
- pagamento confirmado;
- nova assinatura paga;
- assinatura paga ativa;
- receita atualmente válida;
- cobranças em reversão/disputa.

Eventos do navegador não substituem `checkout_tentativas`, `pagamentos` ou
`assinaturas` como fontes canônicas do resultado financeiro.

## Testes esperados

A Wave deve proteger pelo menos:

- serviço: negócio não publicado não inicia checkout nem cobrança;
- browser mobile: plano → checkout → PIX → confirmação → assinatura ativa;
- estado intermediário: pagamento confirmado não anuncia plano ativo antes da
  assinatura;
- reentrada: upgrade pendente reaparece após recarga sem novo checkout;
- regressões financeiras já existentes de idempotência, saga e webhook;
- ausência de overflow horizontal na matriz mobile.

## Critério de encerramento

A Wave 19 pode ser encerrada quando:

1. Backend CI estiver verde no head final;
2. Playwright mobile passar na matriz suportada;
3. negócio não publicado não conseguir iniciar checkout pelo backend;
4. nenhum teste gerar chamada financeira real;
5. pagamento confirmado sem assinatura ativa continuar tratado como estado
   intermediário;
6. o diff final não introduzir migration ou mudança de preço/plano sem
   necessidade;
7. documentação canônica estiver reconciliada;
8. o PR for mergeado com autorização explícita.

## Estado atual

A Wave está **em preparação** na branch `feat/product-ux-wave-19`.
