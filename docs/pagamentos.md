# Pagamentos do Agenda Fashion

> Visao de dominio revisada contra a `main` em 26 de agosto de 2026.

Este documento organiza as regras duraveis de pagamentos. Os detalhes tecnicos de idempotencia e webhook permanecem nos documentos especificos para evitar duplicacao.

## Oferta

O plano Grátis nao gera cobranca nem exige cartao. Os planos pagos usam PIX por meio do Asaas.

O catalogo comercial e os limites oficiais ficam em `docs/planos.md`.

## Regra principal

**Retorno do navegador, checkout iniciado, cobranca criada ou assinatura criada no provedor nao equivalem a pagamento confirmado.**

O acesso a plano pago so deve ser ativado quando o fluxo confiavel do backend confirmar o pagamento segundo as regras implementadas.

## Checkout atual

O endpoint `POST /checkout` usa chave de idempotencia por tentativa. A implementacao registra tentativas no banco, impede processamento simultaneo da mesma chave e pode devolver resposta previamente armazenada quando a tentativa ja foi concluida.

A mesma chave nao pode ser reutilizada para outro plano ou outra forma de pagamento.

Detalhes: `docs/checkout-idempotente.md`.

## Asaas e webhook

O webhook do Asaas usa token proprio de webhook, separado da chave de API. Eventos recebidos sao persistidos com deduplicacao por provedor/evento e processados de forma assincrona.

Eventos de criacao ou atualizacao de assinatura sincronizam estado do provedor, mas nao liberam acesso por si mesmos. A liberacao depende do evento/estado financeiro de pagamento aceito pelo fluxo atual.

Detalhes: `docs/webhook-asaas.md`.

## Idempotencia e recuperacao

A arquitetura atual procura evitar cobranca duplicada e permite reconciliar recursos do Asaas usando `externalReference` quando uma operacao foi criada no provedor mas o processo local foi interrompido antes da persistencia completa.

Operacoes financeiras novas devem preservar:

- idempotencia;
- autenticacao de webhook;
- transacoes quando houver mais de uma alteracao critica local;
- conciliacao entre identificador local e identificador do provedor;
- logs de diagnostico sem segredos ou payloads desnecessariamente sensiveis;
- testes de repeticao, concorrencia e falha parcial.

## Cancelamento e retorno ao gratuito

As regras comerciais atuais preservam o periodo pago ja quitado quando aplicavel. Ao encerrar o acesso pago, o negocio retorna ao plano gratuito sem apagar seus dados existentes. Novas criacoes ficam sujeitas aos limites do plano ativo.

## O que nunca deve ser inferido pelo frontend

O backend deve ser a autoridade para:

- plano ativo;
- preco e valor esperado;
- limites de capacidade;
- estado de pagamento;
- autorizacao para ativacao de plano;
- vinculo entre pagamento, assinatura e negocio.

Parametros do navegador nao sao prova financeira.

## Referencias tecnicas

- regras comerciais e limites: `docs/planos.md`;
- checkout: `src/services/checkoutService.js` e `docs/checkout-idempotente.md`;
- assinatura: `src/services/assinaturaService.js`;
- integracao Asaas: `src/services/asaasService.js`;
- processamento de webhook: `src/services/webhookService.js` e `docs/webhook-asaas.md`;
- migrations principais: `014_assinaturas_pagamentos.sql`, `016_negocios_asaas_customer.sql`, `017_pagamentos_pix.sql`, `018_webhook_eventos.sql`, `019_checkout_idempotente_webhook_assincrono.sql` e `020_corrigir_tentativas_webhook.sql`.