# Checkout idempotente

> **Papel documental:** contrato técnico especializado do `POST /checkout`. Oferta, limites e entitlement permanecem canônicos em [`planos.md`](./planos.md); ativação após pagamento pertence a [`asaas-ativacao-recorrencia.md`](./asaas-ativacao-recorrencia.md).

O endpoint `POST /checkout` exige o header:

```text
Idempotency-Key: <identificador único da tentativa>
```

O frontend gera uma chave por tentativa e reutiliza a mesma chave
quando a resposta falha ou demora. Antes de criar `checkout_tentativas` ou
chamar o Asaas, o backend valida o vínculo ativo de proprietária, o negócio
ativo e `negocios.publicado = TRUE`. Negócio ainda não publicado recebe
HTTP 409 e não cria tentativa nem cobrança externa.

Depois dessa elegibilidade, o backend registra a tentativa em
`checkout_tentativas`, com unicidade por negócio.

Comportamentos:

- uma tentativa concluída devolve a resposta já armazenada;
- uma tentativa simultânea devolve HTTP 409;
- uma tentativa com falha pode ser retomada;
- cada retomada incrementa `lease_tentativa`; somente a execução que possui o
  lease corrente pode marcar a tentativa como `COMPLETED` ou `FAILED`;
- uma chave usada com outro plano ou forma de pagamento é rejeitada;
- um negócio não pode abrir outra cobrança PIX enquanto existir uma cobrança
  pendente vigente, mesmo que o novo checkout escolha outro plano;
- o painel de assinatura expõe novamente QR Code/copia-e-cola do upgrade
  pendente quando disponíveis, para que recarregar a página não force uma nova
  cobrança;
- o lease também protege o vínculo intermediário entre tentativa e assinatura;
  uma execução que perdeu o lease não pode mais anexar uma assinatura à
  tentativa;
- cobranças PIX são conciliadas no Asaas pela `externalReference`;
- a assinatura atual só é desativada quando o novo pagamento é
  confirmado.

## Cobrança externa divergente

Se o Asaas responder com cobrança de valor, cliente, referência ou forma
incompatíveis com o contrato, o AF **não exibe nem libera o PIX**. A identidade
externa e os valores conhecidos ficam registrados na própria
`checkout_tentativas.resposta`, com estado `CONCILIACAO_NECESSARIA`,
status `FAILED` e lease da execução conferido.

Quando o retorno possui valor numérico válido e identidade externa coerente,
o `pagamentos.valor` registra **o valor efetivamente informado pelo Asaas**,
não o preço esperado. A divergência com `assinaturas.valor` impede a primeira
ativação paga mesmo que o webhook confirme recebimento. Para retornos sem valor
numérico válido ou com referência/cliente/forma inconsistentes, não se cria
uma associação financeira incorreta; o identificador externo permanece na
tentativa para pesquisa operacional.

O bloqueio se aplica a **qualquer chave nova do negócio** enquanto existir
conciliação aberta. Reutilizar a chave original também não gera outro PIX.
A resolução deve conferir o pagamento no Asaas, adotar a providência financeira
adequada e preservar evidência do resultado. Apenas depois dessa verificação
um procedimento operacional controlado pode marcar a tentativa como
`CONCILIACAO_RESOLVIDA`; essa chave continua terminal e novas contratações
exigem uma nova tentativa. A alteração de estado **não equivale** a confirmar
pagamento, conceder acesso nem estornar dinheiro.

A assinatura e a tentativa são mantidas para auditoria; não exclua registros
para liberar checkout. Nenhum dado bruto de cartão, documento ou retorno
completo do provedor deve ser salvo nessa anomalia.

A confirmação financeira não mantém locks do PostgreSQL enquanto cria ou remove
recorrências no Asaas. A transição para o plano pago usa preparação local,
efeito externo idempotente, revalidação/finalização local e limpeza externa. Uma
renovação que já possui `asaas_subscription_id` reutiliza a recorrência
existente em vez de criar outra assinatura mensal.

Detalhes: `docs/asaas-ativacao-recorrencia.md` e
`docs/webhook-processing.md`.

Histórico de schema: a idempotência assíncrona foi introduzida pela migration
`019_checkout_idempotente_webhook_assincrono.sql`, a faixa de tentativas de
webhook foi corrigida em `020_corrigir_tentativas_webhook.sql` e o fencing de
retomadas do checkout foi adicionado em
`076_checkout_tentativa_fencing.sql`.

Essas migrations fazem parte da sequência normal de deploy e não devem ser
executadas manualmente fora de ordem nem reescritas depois de aplicadas.
