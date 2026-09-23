const crypto = require("crypto");
const db = require("../src/db/db");
const repository = require(
  "../src/repositories/adminContributionEconomicsRepository"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "Wave 29 - LTV de contribuição observado",
  () => {
    const negocios = [];
    const fontes = [];
    const marcosOriginais = new Map();

    beforeAll(async () => {
      const marcos = await db.query(
        `
        SELECT chave, ocorrido_em
        FROM financeiro_marcos
        WHERE chave IN (
          'ltv_v1_inicio',
          'economia_liquida_v1_inicio',
          'margem_contribuicao_v1_inicio'
        )
        `
      );

      for (const linha of marcos.rows) {
        marcosOriginais.set(
          linha.chave,
          linha.ocorrido_em
        );
      }

      await db.query(
        `
        UPDATE financeiro_marcos
        SET ocorrido_em =
          NOW() - INTERVAL '120 days'
        WHERE chave IN (
          'ltv_v1_inicio',
          'economia_liquida_v1_inicio',
          'margem_contribuicao_v1_inicio'
        )
        `
      );
    });

    afterEach(async () => {
      for (
        const fonteId
        of fontes.splice(0)
      ) {
        await db.query(
          `
          DELETE FROM contribuicao_cobertura
          WHERE fonte_id = $1
          `,
          [fonteId]
        );
        await db.query(
          `
          DELETE FROM contribuicao_custos
          WHERE fonte_id = $1
          `,
          [fonteId]
        );
        await db.query(
          `
          DELETE FROM contribuicao_fontes
          WHERE id = $1
          `,
          [fonteId]
        );
      }

      for (
        const negocioId
        of negocios.splice(0)
      ) {
        await db.query(
          `
          DELETE FROM assinatura_eventos
          WHERE negocio_id = $1
          `,
          [negocioId]
        );
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
          `
          DELETE FROM assinaturas
          WHERE negocio_id = $1
          `,
          [negocioId]
        );
        await db.query(
          `
          DELETE FROM negocios
          WHERE id = $1
          `,
          [negocioId]
        );
      }
    });

    afterAll(async () => {
      for (
        const [chave, ocorridoEm]
        of marcosOriginais.entries()
      ) {
        await db.query(
          `
          UPDATE financeiro_marcos
          SET ocorrido_em = $2
          WHERE chave = $1
          `,
          [chave, ocorridoEm]
        );
      }

      await db.end();
    });

    test(
      "calcula contribuição D30 somente com gateway e custos integralmente cobertos",
      async () => {
        const plano = await db.query(
          `
          SELECT id
          FROM planos
          WHERE slug = 'autonoma'
          LIMIT 1
          `
        );
        const planoId = Number(
          plano.rows[0].id
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
            `LTV Contribuicao ${id}`,
            `ltv-contrib-${id}`,
            planoId,
          ]
        );
        const negocioId = Number(
          negocio.rows[0].id
        );
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
            100,
            TRUE
          )
          RETURNING id
          `,
          [negocioId, planoId]
        );
        const assinaturaId = Number(
          assinatura.rows[0].id
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
            'RECEIVED',
            CURRENT_DATE - 40,
            CURRENT_DATE - 40
          )
          RETURNING id
          `,
          [
            assinaturaId,
            `pay_ltv_contrib_${id}`,
          ]
        );
        const pagamentoId = Number(
          pagamento.rows[0].id
        );

        await db.query(
          `
          INSERT INTO assinatura_eventos (
            negocio_id,
            assinatura_id,
            pagamento_id,
            tipo,
            plano_anterior_id,
            plano_novo_id,
            origem,
            detalhes,
            ocorrido_em,
            chave_idempotencia
          )
          VALUES (
            $1,
            $2,
            $3,
            'CONVERSAO_INICIAL',
            $4,
            $4,
            'sistema',
            '{}'::jsonb,
            NOW() - INTERVAL '40 days',
            $5
          )
          `,
          [
            negocioId,
            assinaturaId,
            pagamentoId,
            planoId,
            `test:ltv-contrib:${id}`,
          ]
        );

        await db.query(
          `
          INSERT INTO pagamento_economia (
            pagamento_id,
            asaas_payment_id,
            valor_bruto,
            valor_liquido_gateway,
            data_credito,
            status_pagamento_snapshot,
            status_reconciliacao
          )
          VALUES (
            $1,
            $2,
            100,
            100,
            CURRENT_DATE - 40,
            'RECEIVED',
            'COMPLETO'
          )
          `,
          [
            pagamentoId,
            `pay_ltv_contrib_${id}`,
          ]
        );

        const fonte = await db.query(
          `
          INSERT INTO contribuicao_fontes (
            codigo,
            nome,
            categoria,
            obrigatoria_para_margem
          )
          VALUES (
            $1,
            'Fonte factual teste',
            'variavel_atribuivel',
            TRUE
          )
          RETURNING id
          `,
          [`ltv_contrib_${id}`]
        );
        const fonteId = Number(
          fonte.rows[0].id
        );
        fontes.push(fonteId);

        await db.query(
          `
          INSERT INTO contribuicao_cobertura (
            fonte_id,
            inicio_cobertura,
            coberto_ate,
            status
          )
          VALUES (
            $1,
            CURRENT_DATE - 50,
            CURRENT_DATE,
            'COMPLETA'
          )
          `,
          [fonteId]
        );

        await db.query(
          `
          INSERT INTO contribuicao_custos (
            fonte_id,
            negocio_id,
            chave_origem,
            tipo,
            valor,
            ocorrido_em
          )
          VALUES (
            $1,
            $2,
            $3,
            'DEBITO',
            20,
            NOW() - INTERVAL '35 days'
          )
          `,
          [
            fonteId,
            negocioId,
            `custo_ltv_${id}`,
          ]
        );

        const resultado =
          await repository
            .buscarLtvContribuicaoObservado();

        const coorte =
          resultado.coortes.find(
            (item) =>
              Number(
                item.maduros_elegiveis_d30
              ) > 0 &&
              Number(
                item.contribuicao_d30
              ) >= 80
          );

        expect(
          resultado.fontes_obrigatorias
        ).toBe(1);
        expect(coorte).toBeDefined();
        expect(
          Number(
            coorte
              .negocios_incompletos_d30
          )
        ).toBe(0);
        expect(
          Number(
            coorte
              .maduros_cobertos_d30
          )
        ).toBeGreaterThanOrEqual(1);
        expect(
          Number(
            coorte.contribuicao_d30
          )
        ).toBeGreaterThanOrEqual(80);
      }
    );
  }
);
