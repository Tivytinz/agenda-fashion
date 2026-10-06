const crypto = require("crypto");

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/marketingConversionDeliveryRepository"
);

describe(
  "Persistência das conversões de marketing",
  () => {
    let negocioId;
    let assinaturaEventoId;

    afterEach(async () => {
      if (assinaturaEventoId) {
        await db.query(
          `
          DELETE FROM marketing_conversoes_entregas
          WHERE assinatura_evento_id = $1
          `,
          [assinaturaEventoId]
        );
      }

      if (negocioId) {
        await db.query(
          "DELETE FROM negocios WHERE id = $1",
          [negocioId]
        );
      }

      negocioId = null;
      assinaturaEventoId = null;
    });

    afterAll(() => db.end());

    test(
      "a mesma CONVERSAO_INICIAL por provedor é enfileirada uma única vez",
      async () => {
        const suffix = crypto.randomUUID()
          .replaceAll("-", "")
          .slice(0, 12);

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
            `Marketing ${suffix}`,
            `marketing-${suffix}`
          ]
        );
        negocioId = Number(
          negocio.rows[0].id
        );

        const plano = await db.query(
          `
          SELECT id, valor
          FROM planos
          WHERE slug = 'autonoma'
          LIMIT 1
          `
        );

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
            plano.rows[0].valor
          ]
        );

        const asaasPaymentId =
          `pay_marketing_${suffix}`;
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
            $3,
            'pix',
            'RECEIVED',
            CURRENT_DATE,
            NOW()
          )
          RETURNING
            id,
            data_pagamento
          `,
          [
            assinatura.rows[0].id,
            asaasPaymentId,
            plano.rows[0].valor
          ]
        );

        const evento = await db.query(
          `
          INSERT INTO assinatura_eventos (
            negocio_id,
            assinatura_id,
            pagamento_id,
            tipo,
            origem,
            ocorrido_em,
            chave_idempotencia
          )
          VALUES (
            $1,
            $2,
            $3,
            'CONVERSAO_INICIAL',
            'webhook',
            $4,
            $5
          )
          RETURNING id
          `,
          [
            negocioId,
            assinatura.rows[0].id,
            pagamento.rows[0].id,
            pagamento.rows[0].data_pagamento,
            `marketing:${suffix}:conversao`
          ]
        );
        assinaturaEventoId = Number(
          evento.rows[0].id
        );

        const payload = {
          negocioId,
          assinaturaId:
            Number(assinatura.rows[0].id),
          pagamentoId:
            asaasPaymentId,
          pagamentoInternoId:
            Number(pagamento.rows[0].id),
          assinaturaEventoId,
          ocorridoEm:
            pagamento.rows[0]
              .data_pagamento
              .toISOString(),
          valor:
            Number(plano.rows[0].valor)
        };

        const dados = {
          provedor: "meta",
          tipoEvento:
            "SUBSCRIPTION_ACTIVATED",
          assinaturaEventoId,
          ocorridoEm:
            payload.ocorridoEm,
          payload
        };

        const primeira =
          await repository.enfileirar(
            dados
          );
        const segunda =
          await repository.enfileirar(
            dados
          );

        expect(primeira.novo)
          .toBe(true);
        expect(segunda.novo)
          .toBe(false);
        expect(segunda.rearmado)
          .toBe(false);
        expect(segunda.entrega.id)
          .toBe(primeira.entrega.id);
        expect(primeira.entrega)
          .toMatchObject({
            provedor: "meta",
            chave_evento:
              `assinatura-evento:${assinaturaEventoId}`,
            assinatura_evento_id:
              assinaturaEventoId,
            status: "PENDING",
            tentativas: 0
          });
      }
    );
  }
);
