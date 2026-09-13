const {
  randomUUID
} = require("node:crypto");

const db = require(
  "../src/db/db"
);
const pagamentoRepository = require(
  "../src/repositories/pagamentoRepository"
);
const {
  suspenderAssinaturaPorPagamento,
  ativarAssinaturaPorPagamento,
  sincronizarAssinaturaPorWebhook
} = require(
  "../src/services/assinaturaService"
);
const {
  criarCenarioAgendamento,
  removerCenarioAgendamento
} = require(
  "./helpers/cenarioAgendamento"
);

describe(
  "Ordenação durável dos webhooks financeiros",
  () => {
    let cenario = null;
    const eventosCriados =
      new Set();

    async function criarAssinaturaPagamento() {
      cenario =
        await criarCenarioAgendamento(
          db,
          {
            prefixo:
              "webhook-ordering"
          }
        );

      const negocio =
        await db.query(
          `
          SELECT plano_id
          FROM negocios
          WHERE id = $1
          `,
          [cenario.negocioId]
        );

      const assinaturaId = Number(
        (
          await db.query(
            `
            INSERT INTO assinaturas (
              negocio_id,
              plano_id,
              asaas_customer_id,
              asaas_subscription_id,
              status,
              forma_pagamento,
              periodicidade,
              valor,
              data_proxima_cobranca,
              ativo
            )
            VALUES (
              $1,
              $2,
              'cus_ordering',
              $3,
              'ACTIVE',
              'pix',
              'MONTHLY',
              99.90,
              '2099-10-13',
              TRUE
            )
            RETURNING id
            `,
            [
              cenario.negocioId,
              negocio.rows[0].plano_id,
              `sub_${randomUUID()}`
            ]
          )
        ).rows[0].id
      );

      const paymentId =
        `pay_${randomUUID()}`;

      await db.query(
        `
        INSERT INTO pagamentos (
          assinatura_id,
          asaas_payment_id,
          valor,
          forma_pagamento,
          status,
          data_vencimento,
          data_pagamento
        )
        VALUES (
          $1,
          $2,
          99.90,
          'pix',
          'PENDING',
          '2099-09-13',
          NULL
        )
        `,
        [
          assinaturaId,
          paymentId
        ]
      );

      return {
        assinaturaId,
        paymentId
      };
    }

    afterEach(async () => {
      const ids =
        Array.from(eventosCriados);

      if (ids.length > 0) {
        await db.query(
          `
          DELETE FROM webhook_eventos
          WHERE provedor = 'asaas'
            AND evento_id = ANY($1::varchar[])
          `,
          [ids]
        );
      }

      eventosCriados.clear();

      if (cenario) {
        await removerCenarioAgendamento(
          db,
          cenario
        );
        cenario = null;
      }
    });

    test(
      "persiste evento_criado_em sem depender do fuso do banco",
      async () => {
        const eventoId =
          `test_order_${randomUUID()}`;
        eventosCriados.add(eventoId);

        const resultado =
          await db.query(
            `
            INSERT INTO webhook_eventos (
              provedor,
              evento_id,
              tipo_evento,
              recurso_id,
              evento_criado_em,
              status,
              tentativas,
              payload
            )
            VALUES (
              'asaas',
              $1,
              'PAYMENT_RECEIVED',
              'pay_ordering_schema',
              '2026-09-13 20:10:11'::timestamp,
              'PENDING',
              0,
              '{}'::jsonb
            )
            RETURNING
              TO_CHAR(
                evento_criado_em,
                'YYYY-MM-DD HH24:MI:SS'
              ) AS evento_criado_em
            `,
            [eventoId]
          );

        expect(resultado.rows[0])
          .toEqual({
            evento_criado_em:
              "2026-09-13 20:10:11"
          });
      }
    );

    test(
      "OVERDUE antigo não suspende pagamento já recebido por evento mais novo",
      async () => {
        const {
          assinaturaId,
          paymentId
        } =
          await criarAssinaturaPagamento();

        const recebido =
          await pagamentoRepository
            .atualizarStatusPagamento(
              null,
              paymentId,
              {
                status: "RECEIVED",
                data_pagamento:
                  "2099-09-13",
                evento_criado_em:
                  "2026-09-13 20:05:00",
                evento_id:
                  "evt_received_new"
              }
            );

        expect(recebido.status)
          .toBe("RECEIVED");

        const suspensao =
          await suspenderAssinaturaPorPagamento({
            id: paymentId,
            status: "OVERDUE",
            webhookEventoCriadoEm:
              "2026-09-13 20:00:00",
            webhookEventoId:
              "evt_overdue_old"
          });

        expect(suspensao)
          .toBeNull();

        const estado =
          await db.query(
            `
            SELECT
              p.status AS pagamento_status,
              p.asaas_ultimo_evento_id,
              a.status AS assinatura_status,
              a.ativo AS assinatura_ativa
            FROM pagamentos p
            INNER JOIN assinaturas a
              ON a.id = p.assinatura_id
            WHERE p.asaas_payment_id = $1
              AND a.id = $2
            `,
            [
              paymentId,
              assinaturaId
            ]
          );

        expect(estado.rows[0])
          .toMatchObject({
            pagamento_status:
              "RECEIVED",
            asaas_ultimo_evento_id:
              "evt_received_new",
            assinatura_status:
              "ACTIVE",
            assinatura_ativa:
              true
          });
      }
    );

    test(
      "confirmação antiga não reativa pagamento após evento financeiro mais novo",
      async () => {
        const {
          assinaturaId,
          paymentId
        } =
          await criarAssinaturaPagamento();

        const maisNovo =
          await pagamentoRepository
            .atualizarStatusPagamento(
              null,
              paymentId,
              {
                status: "REFUNDED",
                data_pagamento: null,
                evento_criado_em:
                  "2026-09-13 20:10:00",
                evento_id:
                  "evt_refund_new"
              }
            );

        expect(maisNovo.status)
          .toBe("REFUNDED");

        const ativacao =
          await ativarAssinaturaPorPagamento(
            paymentId,
            "RECEIVED",
            {
              status: "RECEIVED",
              webhookEventoCriadoEm:
                "2026-09-13 20:05:00",
              webhookEventoId:
                "evt_received_old"
            }
          );

        expect(ativacao)
          .toBeNull();

        const estado =
          await db.query(
            `
            SELECT
              p.status AS pagamento_status,
              p.asaas_ultimo_evento_id,
              a.status AS assinatura_status,
              a.ativo AS assinatura_ativa
            FROM pagamentos p
            INNER JOIN assinaturas a
              ON a.id = p.assinatura_id
            WHERE p.asaas_payment_id = $1
              AND a.id = $2
            `,
            [
              paymentId,
              assinaturaId
            ]
          );

        expect(estado.rows[0])
          .toMatchObject({
            pagamento_status:
              "REFUNDED",
            asaas_ultimo_evento_id:
              "evt_refund_new",
            assinatura_status:
              "ACTIVE",
            assinatura_ativa:
              true
          });
      }
    );

    test(
      "encerramento antigo da assinatura não supera atualização mais nova",
      async () => {
        const {
          assinaturaId
        } =
          await criarAssinaturaPagamento();

        const assinatura =
          await db.query(
            `
            SELECT asaas_subscription_id
            FROM assinaturas
            WHERE id = $1
            `,
            [assinaturaId]
          );

        const subscriptionId =
          assinatura.rows[0]
            .asaas_subscription_id;

        const atualizacao =
          await sincronizarAssinaturaPorWebhook(
            "SUBSCRIPTION_UPDATED",
            {
              id: subscriptionId,
              status: "ACTIVE",
              webhookEventoCriadoEm:
                "2026-09-13 20:10:00",
              webhookEventoId:
                "evt_subscription_new"
            }
          );

        expect(atualizacao)
          .toBeTruthy();

        const encerramento =
          await sincronizarAssinaturaPorWebhook(
            "SUBSCRIPTION_INACTIVATED",
            {
              id: subscriptionId,
              status: "INACTIVE",
              webhookEventoCriadoEm:
                "2026-09-13 20:05:00",
              webhookEventoId:
                "evt_subscription_old"
            }
          );

        expect(encerramento)
          .toBeNull();

        const estado =
          await db.query(
            `
            SELECT
              status,
              ativo,
              asaas_ultimo_evento_id
            FROM assinaturas
            WHERE id = $1
            `,
            [assinaturaId]
          );

        expect(estado.rows[0])
          .toMatchObject({
            status: "ACTIVE",
            ativo: true,
            asaas_ultimo_evento_id:
              "evt_subscription_new"
          });
      }
    );
  }
);
