const crypto = require("crypto");
const db = require("../src/db/db");
const {
  buscarReceita,
} = require(
  "../src/repositories/adminAnalyticsV2Repository"
);

function idCurto() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "Admin Analytics V2 - retenção financeira integrada",
  () => {
    let negocioId;
    const webhookIds = [];

    afterEach(async () => {
      if (webhookIds.length) {
        await db.query(
          `DELETE FROM webhook_eventos
           WHERE evento_id = ANY($1::varchar[])`,
          [webhookIds]
        );
      }

      if (negocioId) {
        await db.query(
          "DELETE FROM pagamentos WHERE assinatura_id IN (SELECT id FROM assinaturas WHERE negocio_id = $1)",
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

      negocioId = null;
      webhookIds.length = 0;
    });

    test(
      "classifica receita recorrente e recuperação sem confundir mudança de plano",
      async () => {
        const antes =
          await buscarReceita("all");
        const resumoAntes =
          antes.resumo;
        const suffix = idCurto();
        const negocio = await db.query(
          `
          INSERT INTO negocios (
            nome,
            slug,
            setor,
            whatsapp,
            cidade,
            estado,
            publicado
          )
          VALUES (
            $1,
            $2,
            'unhas',
            '62999999999',
            'Goiânia',
            'GO',
            TRUE
          )
          RETURNING id
          `,
          [
            `Wave 21 ${suffix}`,
            `wave-21-${suffix}`,
          ]
        );
        negocioId = Number(negocio.rows[0].id);

        const planos = await db.query(
          `
          SELECT id, slug, valor
          FROM planos
          WHERE slug IN ('autonoma', 'studio')
          `
        );
        const autonoma = planos.rows.find(
          (item) => item.slug === "autonoma"
        );
        const studio = planos.rows.find(
          (item) => item.slug === "studio"
        );

        const inicial = await db.query(
          `
          INSERT INTO assinaturas (
            negocio_id,
            plano_id,
            status,
            forma_pagamento,
            periodicidade,
            valor,
            ativo,
            observacoes
          )
          VALUES (
            $1,
            $2,
            'CANCELED',
            'pix',
            'MONTHLY',
            $3,
            FALSE,
            'Recorrência substituída por uma nova assinatura.'
          )
          RETURNING id
          `,
          [negocioId, autonoma.id, autonoma.valor]
        );
        const assinaturaInicialId = Number(
          inicial.rows[0].id
        );

        const mudanca = await db.query(
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
          [negocioId, studio.id, studio.valor]
        );
        const assinaturaMudancaId = Number(
          mudanca.rows[0].id
        );

        const inserirPagamento = async ({
          assinaturaId,
          prefixo,
          valor,
          status,
          vencimento,
          pagamento,
        }) => {
          const asaasId =
            `pay_${prefixo}_${suffix}`;

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
              $3,
              'pix',
              $4,
              CURRENT_DATE + $5::int,
              CASE
                WHEN $6::int IS NULL THEN NULL
                ELSE CURRENT_DATE + $6::int
              END
            )
            `,
            [
              assinaturaId,
              asaasId,
              valor,
              status,
              vencimento,
              pagamento,
            ]
          );

          return asaasId;
        };

        await inserirPagamento({
          assinaturaId: assinaturaInicialId,
          prefixo: "inicial",
          valor: 49.9,
          status: "CONFIRMED",
          vencimento: -60,
          pagamento: -60,
        });
        await inserirPagamento({
          assinaturaId: assinaturaInicialId,
          prefixo: "renovacao",
          valor: 49.9,
          status: "RECEIVED",
          vencimento: -30,
          pagamento: -30,
        });
        const recuperadoId = await inserirPagamento({
          assinaturaId: assinaturaInicialId,
          prefixo: "recuperado",
          valor: 49.9,
          status: "RECEIVED",
          vencimento: -2,
          pagamento: -1,
        });
        await inserirPagamento({
          assinaturaId: assinaturaInicialId,
          prefixo: "overdue",
          valor: 49.9,
          status: "OVERDUE",
          vencimento: 0,
          pagamento: null,
        });
        await inserirPagamento({
          assinaturaId: assinaturaMudancaId,
          prefixo: "mudanca",
          valor: 99.9,
          status: "RECEIVED",
          vencimento: -1,
          pagamento: -1,
        });

        const overdueEvento =
          `evt_overdue_${suffix}`;
        const receivedEvento =
          `evt_received_${suffix}`;
        webhookIds.push(
          overdueEvento,
          receivedEvento
        );

        await db.query(
          `
          INSERT INTO webhook_eventos (
            provedor,
            evento_id,
            tipo_evento,
            recurso_id,
            status,
            tentativas,
            evento_criado_em,
            processado_em
          )
          VALUES
            (
              'asaas',
              $1,
              'PAYMENT_OVERDUE',
              $3,
              'PROCESSED',
              1,
              NOW() - INTERVAL '2 days',
              NOW() - INTERVAL '2 days'
            ),
            (
              'asaas',
              $2,
              'PAYMENT_RECEIVED',
              $3,
              'PROCESSED',
              1,
              NOW() - INTERVAL '1 day',
              NOW() - INTERVAL '1 day'
            )
          `,
          [
            overdueEvento,
            receivedEvento,
            recuperadoId,
          ]
        );

        const resultado =
          await buscarReceita("all");
        const resumo = resultado.resumo;

        const deltaNumero = (campo) =>
          Number(resumo[campo] || 0) -
          Number(resumoAntes[campo] || 0);

        expect(deltaNumero(
          "novos_negocios_pagantes"
        )).toBe(1);
        expect(deltaNumero(
          "receita_primeira_conversao"
        )).toBeCloseTo(49.9, 2);
        expect(deltaNumero(
          "pagamentos_renovacao"
        )).toBe(2);
        expect(deltaNumero(
          "negocios_com_renovacao"
        )).toBe(1);
        expect(deltaNumero(
          "receita_renovacao"
        )).toBeCloseTo(99.8, 2);
        expect(deltaNumero(
          "pagamentos_mudanca_plano"
        )).toBe(1);
        expect(deltaNumero(
          "negocios_com_mudanca_plano"
        )).toBe(1);
        expect(deltaNumero(
          "receita_mudanca_plano"
        )).toBeCloseTo(99.9, 2);
        expect(deltaNumero(
          "renovacoes_previstas"
        )).toBe(3);
        expect(deltaNumero(
          "renovacoes_confirmadas"
        )).toBe(2);
        expect(deltaNumero(
          "renovacoes_com_atraso"
        )).toBe(2);
        expect(deltaNumero(
          "renovacoes_recuperadas"
        )).toBe(1);

        expect(deltaNumero("receita_total"))
          .toBeCloseTo(
            deltaNumero(
              "receita_primeira_conversao"
            ) +
            deltaNumero("receita_renovacao") +
            deltaNumero("receita_mudanca_plano"),
            2
          );
      }
    );
  }
);
