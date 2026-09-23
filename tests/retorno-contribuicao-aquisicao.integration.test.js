const crypto = require("crypto");
const db = require("../src/db/db");
const repository = require(
  "../src/repositories/adminContributionReturnRepository"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "Wave 30 - retorno de contribuição por aquisição",
  () => {
    const negocios = [];
    const campanhas = [];
    const fontes = [];
    const marcosOriginais = new Map();

    beforeAll(async () => {
      const marcos = await db.query(
        `
        SELECT chave, ocorrido_em
        FROM financeiro_marcos
        WHERE chave IN (
          'economia_liquida_v1_inicio',
          'margem_contribuicao_v1_inicio',
          'retorno_contribuicao_v1_inicio'
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
          'economia_liquida_v1_inicio',
          'margem_contribuicao_v1_inicio',
          'retorno_contribuicao_v1_inicio'
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
          "DELETE FROM contribuicao_cobertura WHERE fonte_id = $1",
          [fonteId]
        );
        await db.query(
          "DELETE FROM contribuicao_custos WHERE fonte_id = $1",
          [fonteId]
        );
        await db.query(
          "DELETE FROM contribuicao_fontes WHERE id = $1",
          [fonteId]
        );
      }

      for (
        const negocioId
        of negocios.splice(0)
      ) {
        await db.query(
          "DELETE FROM marketing_negocio_aquisicoes WHERE negocio_id = $1",
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
          "DELETE FROM assinaturas WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          "DELETE FROM negocios WHERE id = $1",
          [negocioId]
        );
      }

      for (
        const campanhaId
        of campanhas.splice(0)
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
      "calcula D30 somente quando mídia, gateway e contribuição cobrem a mesma coorte",
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
        const token = suffix();

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
            'Wave 30 retorno',
            'google',
            'google',
            'cpc',
            $1,
            '/profissionais',
            'profissional'
          )
          RETURNING id
          `,
          [`wave30_${token}`]
        );
        const campanhaId = Number(
          campanha.rows[0].id
        );
        campanhas.push(campanhaId);

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
            `Wave 30 ${token}`,
            `wave-30-${token}`,
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
            CURRENT_DATE - 55,
            CURRENT_DATE - 55
          )
          RETURNING id
          `,
          [
            assinaturaId,
            `pay_wave30_${token}`,
          ]
        );
        const pagamentoId = Number(
          pagamento.rows[0].id
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
            CURRENT_DATE - 55,
            'RECEIVED',
            'COMPLETO'
          )
          `,
          [
            pagamentoId,
            `pay_wave30_${token}`,
          ]
        );

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
            primeira_conversao_em,
            primeira_conversao_data
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
            'wave30',
            NOW() - INTERVAL '60 days',
            NOW() - INTERVAL '55 days',
            CURRENT_DATE - 55
          )
          `,
          [
            negocioId,
            campanhaId,
            pagamentoId,
            planoId,
          ]
        );

        const dataAquisicao = await db.query(
          `
          SELECT (
            atribuicao_em
            AT TIME ZONE 'America/Sao_Paulo'
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
          VALUES (
            $1,
            $2,
            10000,
            'BRL',
            'google_ads'
          )
          `,
          [
            campanhaId,
            dataAquisicao.rows[0].data,
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
            'Fonte factual Wave 30',
            'variavel_atribuivel',
            TRUE
          )
          RETURNING id
          `,
          [`wave30_cost_${token}`]
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
            CURRENT_DATE - 60,
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
            NOW() - INTERVAL '50 days'
          )
          `,
          [
            fonteId,
            negocioId,
            `wave30_cost_evt_${token}`,
          ]
        );

        const retorno =
          await repository
            .buscarRetornoContribuicaoAquisicao({
              diasMaturacaoMonetizacao: 21,
            });

        const linha =
          retorno.campanhas.find(
            (item) =>
              Number(item.campanha_id) ===
              campanhaId
          );

        expect(linha).toBeDefined();
        expect(linha).toMatchObject({
          fontes_obrigatorias: 1,
          investimento_d30_centavos:
            "10000",
          negocios_d30: 1,
          negocios_cobertos_d30: 1,
          incompletos_d30: 0,
          pagantes_sem_custo_d30: 0,
          contribuicao_d30: "80.00",
        });
      }
    );
  }
);
