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
              CURRENT_DATE + $5,
              CASE
                WHEN $6::int IS NULL THEN NULL
                ELSE CURRENT_DATE + $6
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

        expect(resumo).toMatchObject({
          novos_negocios_pagantes: 1,
          receita_primeira_conversao: "49.90",
          pagamentos_renovacao: 2,
          negocios_com_renovacao: 1,
          receita_renovacao: "99.80",
          pagamentos_mudanca_plano: 1,
          negocios_com_mudanca_plano: 1,
          receita_mudanca_plano: "99.90",
          renovacoes_previstas: 3,
          renovacoes_confirmadas: 2,
          renovacoes_com_atraso: 2,
          renovacoes_recuperadas: 1,
        });

        expect(Number(resumo.receita_total))
          .toBeCloseTo(
            Number(
              resumo.receita_primeira_conversao
            ) +
            Number(resumo.receita_renovacao) +
            Number(resumo.receita_mudanca_plano),
            2
          );
      }
    );
  }
);
