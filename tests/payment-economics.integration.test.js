const crypto = require("crypto");
const db = require("../src/db/db");
const repository = require(
  "../src/repositories/paymentEconomicsRepository"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "Wave 28 - economia líquida do gateway",
  () => {
    const negocios = [];

    afterEach(async () => {
      for (
        const negocioId
        of negocios.splice(0)
      ) {
        await db.query(
          `
          DELETE FROM pagamento_estornos
          WHERE pagamento_id IN (
            SELECT pg.id
            FROM pagamentos pg
            INNER JOIN assinaturas a
              ON a.id = pg.assinatura_id
            WHERE a.negocio_id = $1
          )
          `,
          [negocioId]
        );
        await db.query(
          `
          DELETE FROM pagamento_economia
          WHERE pagamento_id IN (
            SELECT pg.id
            FROM pagamentos pg
            INNER JOIN assinaturas a
              ON a.id = pg.assinatura_id
            WHERE a.negocio_id = $1
          )
          `,
          [negocioId]
        );
        await db.query(
          `
          DELETE FROM pagamentos
          WHERE assinatura_id IN (
            SELECT id
            FROM assinaturas
            WHERE negocio_id = $1
          )
          `,
          [negocioId]
        );
        await db.query(
          "DELETE FROM assinaturas WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          "DELETE FROM negocios WHERE id = $1",
          [negocioId]
        );
      }
    });

    afterAll(() => db.end());

    async function criarPagamento() {
      const plano = await db.query(
        `
        SELECT id, valor
        FROM planos
        WHERE slug = 'autonoma'
        LIMIT 1
        `
      );
      const id = suffix();
      const negocio = await db.query(
        `
        INSERT INTO negocios (
          nome,
          slug,
          setor,
          whatsapp,
          cidade,
          estado,
          publicado,
          plano_id
        )
        VALUES (
          $1,
          $2,
          'unhas',
          '62999999999',
          'Goiânia',
          'GO',
          TRUE,
          $3
        )
        RETURNING id
        `,
        [
          `Economia ${id}`,
          `wave-28-${id}`,
          plano.rows[0].id,
        ]
      );
      const negocioId =
        Number(negocio.rows[0].id);
      negocios.push(negocioId);

      const assinatura = await db.query(
        `
        INSERT INTO assinaturas (
          negocio_id,
          plano_id,
          status,
          forma_pagamento,
          periodicidade,
          valor,
          ativo
        )
        VALUES (
          $1,
          $2,
          'ACTIVE',
          'pix',
          'MONTHLY',
          $3,
          TRUE
        )
        RETURNING id
        `,
        [
          negocioId,
          plano.rows[0].id,
          plano.rows[0].valor,
        ]
      );

      const pagamento = await db.query(
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
          100,
          'pix',
          'PARTIALLY_REFUNDED',
          CURRENT_DATE,
          CURRENT_DATE
        )
        RETURNING id
        `,
        [
          assinatura.rows[0].id,
          `pay_wave28_${suffix()}`,
        ]
      );

      await db.query(
        `
        UPDATE pagamentos
        SET
          asaas_ultimo_evento_em =
            '2026-09-23 15:00:00',
          asaas_ultimo_evento_id =
            'evt_wave28_1'
        WHERE id = $1
        `,
        [pagamento.rows[0].id]
      );

      return Number(
        pagamento.rows[0].id
      );
    }

    test("persiste netValue e múltiplos refunds sem duplicar replay", async () => {
      const pagamentoId =
        await criarPagamento();

      const dados = {
        pagamentoId,
        eventoEsperadoEm:
          "2026-09-23 15:00:00",
        eventoEsperadoId:
          "evt_wave28_1",
        economia: {
          valorBruto: 100,
          valorLiquidoGateway: 98,
          dataCredito:
            "2026-09-23",
          statusPagamento:
            "PARTIALLY_REFUNDED",
          statusReconciliacao:
            "COMPLETO",
          proximaReconciliacaoEm:
            null,
        },
        estornos: [
          {
            chaveProvedor: "refund-a",
            valor: 10,
            status: "DONE",
            ocorridoEm:
              "2026-09-23 15:10:00",
          },
          {
            chaveProvedor: "refund-b",
            valor: 15,
            status: "DONE",
            ocorridoEm:
              "2026-09-23 15:20:00",
          },
        ],
      };

      await repository
        .persistirReconciliacao(
          dados
        );
      await repository
        .persistirReconciliacao(
          dados
        );

      const economia = await db.query(
        `
        SELECT
          valor_bruto,
          valor_liquido_gateway,
          data_credito,
          status_reconciliacao
        FROM pagamento_economia
        WHERE pagamento_id = $1
        `,
        [pagamentoId]
      );
      const estornos = await db.query(
        `
        SELECT
          COUNT(*)::INT AS total,
          SUM(valor)::NUMERIC(12,2)
            AS valor
        FROM pagamento_estornos
        WHERE pagamento_id = $1
          AND status_provedor = 'DONE'
        `,
        [pagamentoId]
      );

      expect(economia.rows[0])
        .toMatchObject({
          valor_bruto: "100.00",
          valor_liquido_gateway:
            "98.00",
          data_credito:
            "2026-09-23",
          status_reconciliacao:
            "COMPLETO",
        });
      expect(estornos.rows[0])
        .toMatchObject({
          total: 2,
          valor: "25.00",
        });
    });

    test("descarta resposta externa quando webhook mais novo alterou o fence", async () => {
      const pagamentoId =
        await criarPagamento();

      await db.query(
        `
        UPDATE pagamentos
        SET
          asaas_ultimo_evento_em =
            '2026-09-23 16:00:00',
          asaas_ultimo_evento_id =
            'evt_wave28_2'
        WHERE id = $1
        `,
        [pagamentoId]
      );

      const resultado =
        await repository
          .persistirReconciliacao({
            pagamentoId,
            eventoEsperadoEm:
              "2026-09-23 15:00:00",
            eventoEsperadoId:
              "evt_wave28_1",
            economia: {
              valorBruto: 100,
              valorLiquidoGateway: 98,
              dataCredito: null,
              statusPagamento:
                "RECEIVED",
              statusReconciliacao:
                "COMPLETO",
              proximaReconciliacaoEm:
                null,
            },
            estornos: [],
          });

      expect(resultado)
        .toMatchObject({
          obsoleto: true,
          pagamento_id: pagamentoId,
        });

      const persistido = await db.query(
        `
        SELECT COUNT(*)::INT AS total
        FROM pagamento_economia
        WHERE pagamento_id = $1
        `,
        [pagamentoId]
      );
      expect(
        persistido.rows[0].total
      ).toBe(0);
    });
  }
);
