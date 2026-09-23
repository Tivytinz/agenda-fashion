const crypto = require("crypto");
const db = require("../src/db/db");
const repository = require(
  "../src/repositories/adminAcquisitionFinancialRepository"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "Wave 27 - retorno bruto por aquisição",
  () => {
    const negocios = [];
    const campanhas = [];
    let marcoOriginal = null;

    beforeAll(async () => {
      const marco = await db.query(
        `
        SELECT ocorrido_em
        FROM financeiro_marcos
        WHERE chave =
          'aquisicao_financeira_v1_inicio'
        `
      );

      expect(marco.rows)
        .toHaveLength(1);
      marcoOriginal =
        marco.rows[0].ocorrido_em;

      await db.query(
        `
        UPDATE financeiro_marcos
        SET ocorrido_em =
          NOW() - INTERVAL '120 days'
        WHERE chave =
          'aquisicao_financeira_v1_inicio'
        `
      );
    });

    afterEach(async () => {
      for (
        const negocioId of
        negocios.splice(0)
      ) {
        await db.query(
          "DELETE FROM marketing_negocio_aquisicoes WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          "DELETE FROM assinatura_eventos WHERE negocio_id = $1",
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

      for (
        const campanhaId of
        campanhas.splice(0)
      ) {
        await db.query(
          "DELETE FROM marketing_campanha_gastos WHERE campanha_id = $1",
          [campanhaId]
        );
        await db.query(
          "DELETE FROM marketing_campanhas WHERE id = $1",
          [campanhaId]
        );
      }
    });

    afterAll(async () => {
      if (marcoOriginal) {
        await db.query(
          `
          UPDATE financeiro_marcos
          SET ocorrido_em = $1
          WHERE chave =
            'aquisicao_financeira_v1_inicio'
          `,
          [marcoOriginal]
        );
      }

      await db.end();
    });

    test(
      "reutiliza fonte única diária e não duplica custo ao substituir a origem",
      async () => {
        const planos = await db.query(
          `
          SELECT id, slug, valor
          FROM planos
          WHERE slug IN (
            'inicial',
            'autonoma'
          )
          `
        );
        const gratis = planos.rows.find(
          (item) =>
            item.slug === "inicial"
        );
        const pago = planos.rows.find(
          (item) =>
            item.slug === "autonoma"
        );

        const campanha = await db.query(
          `
          INSERT INTO marketing_campanhas (
            nome,
            canal,
            utm_source,
            utm_medium,
            utm_campaign,
            destino_path,
            objetivo
          )
          VALUES (
            'Wave 27 retorno',
            'google',
            'google',
            'cpc',
            $1,
            '/profissionais',
            'profissional'
          )
          RETURNING id
          `,
          [`wave27_return_${suffix()}`]
        );
        const campanhaId = Number(
          campanha.rows[0].id
        );
        campanhas.push(campanhaId);

        const token = suffix();
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
            `Wave 27 retorno ${token}`,
            `wave-27-return-${token}`,
            gratis.id,
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
            $3,
            TRUE
          )
          RETURNING id
          `,
          [
            negocioId,
            pago.id,
            pago.valor,
          ]
        );

        const primeiro = await db.query(
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
            CURRENT_DATE - 95,
            CURRENT_DATE - 95
          )
          RETURNING id
          `,
          [
            assinatura.rows[0].id,
            `pay_wave27_first_${suffix()}`,
            pago.valor,
          ]
        );

        for (const dias of [65, 35]) {
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
              'RECEIVED',
              CURRENT_DATE - $4::INT,
              CURRENT_DATE - $4::INT
            )
            `,
            [
              assinatura.rows[0].id,
              `pay_wave27_${dias}_${suffix()}`,
              pago.valor,
              dias,
            ]
          );
        }

        await db.query(
          `
          INSERT INTO marketing_negocio_aquisicoes (
            negocio_id,
            campanha_oficial_id,
            primeiro_pagamento_id,
            plano_entrada_id,
            classificacao_atribuicao,
            metodo_resolucao,
            origem,
            midia,
            campanha,
            atribuicao_em,
            primeira_conversao_em
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'oficial',
            'utm_exata',
            'google',
            'cpc',
            'wave27_return',
            NOW() - INTERVAL '100 days',
            NOW() - INTERVAL '95 days'
          )
          `,
          [
            negocioId,
            campanhaId,
            primeiro.rows[0].id,
            pago.id,
          ]
        );

        const dataAquisicao =
          await db.query(
            `
            SELECT (
              atribuicao_em
              AT TIME ZONE
                'America/Sao_Paulo'
            )::date AS data
            FROM marketing_negocio_aquisicoes
            WHERE negocio_id = $1
            `,
            [negocioId]
          );

        await db.query(
          `
          INSERT INTO marketing_campanha_gastos (
            campanha_id,
            data_gasto,
            valor_centavos,
            moeda,
            fonte
          )
          VALUES
            ($1, $2, 15000, 'BRL', 'manual'),
            ($1, $2, 9000, 'BRL', 'google_ads'),
            ($1, $2::date + 10, 3000, 'BRL', 'google_ads')
          `,
          [
            campanhaId,
            dataAquisicao.rows[0].data,
          ]
        );

        const base =
          await repository
            .buscarRetornoAquisicao({
              diasMaturacaoMonetizacao:
                21,
            });

        const linha =
          base.campanhas.find(
            (item) =>
              Number(item.campanha_id) ===
              campanhaId
          );

        expect(linha).toMatchObject({
          investimento_d30_centavos:
            "12000",
          investimento_d60_centavos:
            "12000",
          investimento_d90_centavos:
            "0",
          negocios_pagos_d30: 1,
          negocios_pagos_d60: 1,
          negocios_pagos_d90: 0,
          receita_d30_centavos:
            "9980",
          receita_d60_centavos:
            "14970",
        });

        const fonteDepoisGoogle =
          await db.query(
            `
            SELECT fonte, valor_centavos
            FROM marketing_campanha_gastos
            WHERE campanha_id = $1
              AND data_gasto = $2
            `,
            [
              campanhaId,
              dataAquisicao.rows[0].data,
            ]
          );

        expect(fonteDepoisGoogle.rows)
          .toEqual([
            expect.objectContaining({
              fonte: "google_ads",
              valor_centavos: "9000",
            }),
          ]);

        await db.query(
          `
          INSERT INTO marketing_campanha_gastos (
            campanha_id,
            data_gasto,
            valor_centavos,
            moeda,
            fonte
          )
          VALUES (
            $1,
            $2,
            5000,
            'BRL',
            'meta_ads'
          )
          `,
          [
            campanhaId,
            dataAquisicao.rows[0].data,
          ]
        );

        const fonteSubstituida =
          await db.query(
            `
            SELECT fonte, valor_centavos
            FROM marketing_campanha_gastos
            WHERE campanha_id = $1
              AND data_gasto = $2
            `,
            [
              campanhaId,
              dataAquisicao.rows[0].data,
            ]
          );

        expect(fonteSubstituida.rows)
          .toEqual([
            expect.objectContaining({
              fonte: "meta_ads",
              valor_centavos: "5000",
            }),
          ]);

        const atualizado =
          await repository
            .buscarRetornoAquisicao({
              diasMaturacaoMonetizacao:
                21,
            });
        const linhaAtualizada =
          atualizado.campanhas.find(
            (item) =>
              Number(item.campanha_id) ===
              campanhaId
          );

        expect(linhaAtualizada)
          .toMatchObject({
            investimento_d30_centavos:
              "8000",
            negocios_pagos_d30: 1,
            pagantes_sem_custo_d30: 0,
          });
      }
    );
  }
);
