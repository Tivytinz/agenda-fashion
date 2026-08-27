const crypto = require(
  "crypto"
);

const db = require(
  "../src/db/db"
);

const adminMarketingCostRepository =
  require(
    "../src/repositories/adminMarketingCostRepository"
  );

function idCurto() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "adminMarketingCostRepository integrado",
  () => {
    let campanhaId;
    let utmCampaign;
    let sessionA;
    let sessionB;
    let sessionCanonical;
    let sessionGoogle;
    let extraCampaignIds;
    let extraSyncIds;

    beforeEach(async () => {
      const suffix = idCurto();

      utmCampaign =
        `custo_${suffix}`;
      sessionA =
        `csta_${suffix}`;
      sessionB =
        `cstb_${suffix}`;
      sessionCanonical =
        `cstc_${suffix}`;
      sessionGoogle =
        `cstg_${suffix}`;
      extraCampaignIds = [];
      extraSyncIds = [];

      const campanha =
        await db.query(
          `
          INSERT INTO marketing_campanhas (
            nome,
            canal,
            utm_source,
            utm_medium,
            utm_campaign,
            destino_path,
            ativo
          )
          VALUES (
            $1,
            'meta',
            'meta',
            'cpc',
            $2,
            '/',
            TRUE
          )
          RETURNING id
          `,
          [
            `Campanha custo ${suffix}`,
            utmCampaign,
          ]
        );

      campanhaId =
        Number(
          campanha.rows[0].id
        );

      const props = {
        utm_source: "meta",
        utm_medium: "cpc",
        utm_campaign: utmCampaign,
        landing_page: "/",
      };

      await db.query(
        `
        INSERT INTO eventos_produto (
          nome,
          pagina,
          sessao_id,
          propriedades
        )
        VALUES
          (
            'perfil_visualizado',
            'explorar',
            $1,
            $3::JSONB
          ),
          (
            'agendamento_concluido',
            'finalizar_agendamento',
            $1,
            $4::JSONB
          ),
          (
            'agendamento_concluido',
            'finalizar_agendamento',
            $1,
            $5::JSONB
          ),
          (
            'perfil_visualizado',
            'explorar',
            $2,
            $3::JSONB
          )
        `,
        [
          sessionA,
          sessionB,
          JSON.stringify(props),
          JSON.stringify({
            ...props,
            agendamento_id: 55001,
          }),
          JSON.stringify({
            ...props,
            agendamento_id: 55002,
          }),
        ]
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
          (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
          5000,
          'BRL',
          'manual'
        )
        `,
        [campanhaId]
      );
    });

    afterEach(async () => {
      const campaignIds = [
        campanhaId,
        ...extraCampaignIds,
      ].filter(Number.isFinite);

      await db.query(
        `
        DELETE FROM marketing_campanha_gastos
        WHERE campanha_id = ANY($1::bigint[])
        `,
        [campaignIds]
      );

      await db.query(
        `
        DELETE FROM eventos_produto
        WHERE sessao_id = ANY($1::TEXT[])
        `,
        [[
          sessionA,
          sessionB,
          sessionCanonical,
          sessionGoogle,
        ]]
      );

      if (extraSyncIds.length > 0) {
        await db.query(
          `
          DELETE FROM marketing_custo_sincronizacoes
          WHERE id = ANY($1::bigint[])
          `,
          [extraSyncIds]
        );
      }

      await db.query(
        `
        DELETE FROM marketing_campanhas
        WHERE id = ANY($1::bigint[])
        `,
        [campaignIds]
      );
    });

    test(
      "relaciona investimento com sessões e agendamentos distintos pela identidade UTM",
      async () => {
        const linhas =
          await adminMarketingCostRepository
            .listarDesempenho("all");

        const encontrada =
          linhas.find(
            (item) =>
              Number(item.id) ===
              campanhaId
          );

        expect(encontrada)
          .toMatchObject({
            utm_source: "meta",
            utm_medium: "cpc",
            utm_campaign: utmCampaign,
            sessoes: 2,
            sessoes_com_custo: 2,
            agendamentos_concluidos: 2,
            agendamentos_concluidos_com_custo: 2,
            investimento_centavos: "5000",
          });
      }
    );

    test(
      "usa o investimento agregado do período em todas as sessões atribuídas da campanha",
      async () => {
        await db.query(
          `
          INSERT INTO eventos_produto (
            nome,
            pagina,
            sessao_id,
            propriedades,
            created_at
          )
          VALUES (
            'agendamento_concluido',
            'finalizar_agendamento',
            $1,
            $2::JSONB,
            NOW() - INTERVAL '1 day'
          )
          `,
          [
            sessionCanonical,
            JSON.stringify({
              utm_source: "meta",
              utm_medium: "cpc",
              utm_campaign: utmCampaign,
              agendamento_id: 55003,
            }),
          ]
        );

        const linhas =
          await adminMarketingCostRepository
            .listarDesempenho("all");
        const encontrada = linhas.find(
          (item) =>
            Number(item.id) === campanhaId
        );

        expect(encontrada)
          .toMatchObject({
            sessoes: 3,
            sessoes_com_custo: 3,
            agendamentos_concluidos: 3,
            agendamentos_concluidos_com_custo: 3,
            investimento_centavos: "5000",
          });
      }
    );

    test(
      "corrige gasto manual do mesmo dia sem duplicar valor",
      async () => {
        const dataHoje =
          await db.query(
            `SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date::text AS hoje`
          );

        const hoje =
          dataHoje.rows[0].hoje;

        await adminMarketingCostRepository
          .salvarGastoManual({
            campanhaId,
            dataGasto: hoje,
            valorCentavos: 7000,
            observacao:
              "Valor corrigido",
            usuarioId: null,
          });

        const resultado =
          await db.query(
            `
            SELECT
              COUNT(*)::INT AS total,
              MAX(valor_centavos)::BIGINT
                AS valor_centavos,
              MAX(observacao)
                AS observacao
            FROM marketing_campanha_gastos
            WHERE campanha_id = $1
              AND data_gasto = $2::date
              AND fonte = 'manual'
            `,
            [campanhaId, hoje]
          );

        expect(resultado.rows[0])
          .toMatchObject({
            total: 1,
            valor_centavos: "7000",
            observacao:
              "Valor corrigido",
          });
      }
    );

    test(
      "normaliza origem histórica da Meta sem duplicar a sessão",
      async () => {
        await db.query(
          `
          INSERT INTO eventos_produto (
            nome,
            pagina,
            sessao_id,
            propriedades
          )
          VALUES (
            'perfil_visualizado',
            'perfil_negocio',
            $1,
            $2::JSONB
          )
          `,
          [
            sessionCanonical,
            JSON.stringify({
              utm_source: "facebook",
              utm_medium: "cpc",
              utm_campaign: utmCampaign,
            }),
          ]
        );

        const linhas =
          await adminMarketingCostRepository
            .listarDesempenho("all");
        const encontrada = linhas.find(
          (item) =>
            Number(item.id) === campanhaId
        );

        expect(encontrada.sessoes).toBe(3);
      }
    );

    test(
      "vincula clique Google moderno quando a campanha UTM está presente",
      async () => {
        const suffix = idCurto();
        const campanhaGoogle =
          `google_${suffix}`;
        const criada = await db.query(
          `
          INSERT INTO marketing_campanhas (
            nome,
            canal,
            utm_source,
            utm_medium,
            utm_campaign,
            destino_path,
            ativo
          )
          VALUES (
            $1,
            'google',
            'google',
            'cpc',
            $2,
            '/',
            TRUE
          )
          RETURNING id
          `,
          [
            `Google custo ${suffix}`,
            campanhaGoogle,
          ]
        );
        const campanhaGoogleId =
          Number(criada.rows[0].id);
        extraCampaignIds.push(
          campanhaGoogleId
        );

        await db.query(
          `
          INSERT INTO eventos_produto (
            nome,
            pagina,
            sessao_id,
            propriedades
          )
          VALUES (
            'perfil_visualizado',
            'perfil_negocio',
            $1,
            $2::JSONB
          )
          `,
          [
            sessionGoogle,
            JSON.stringify({
              gbraid: "google-modern-click",
              utm_campaign: campanhaGoogle,
            }),
          ]
        );

        const linhas =
          await adminMarketingCostRepository
            .listarDesempenho("all");
        const encontrada = linhas.find(
          (item) =>
            Number(item.id) ===
              campanhaGoogleId
        );

        expect(encontrada).toMatchObject({
          sessoes: 1,
          agendamentos_concluidos: 0,
        });
      }
    );

    test(
      "mantém clique pago sem UTM fora do custo da campanha oficial",
      async () => {
        await db.query(
          `
          INSERT INTO eventos_produto (
            nome,
            pagina,
            sessao_id,
            propriedades
          )
          VALUES (
            'perfil_visualizado',
            'perfil_negocio',
            $1,
            $2::JSONB
          )
          `,
          [
            sessionGoogle,
            JSON.stringify({
              gclid:
                "google-click-sem-campanha",
            }),
          ]
        );

        const diagnostico =
          await adminMarketingCostRepository
            .buscarDiagnosticoAtribuicao(
              "all"
            );

        expect(
          Number(
            diagnostico
              .sessoes_sem_campanha
          )
        ).toBeGreaterThanOrEqual(1);

        const linhas =
          await adminMarketingCostRepository
            .listarDesempenho("all");
        const encontrada = linhas.find(
          (item) =>
            Number(item.id) ===
            campanhaId
        );

        expect(encontrada.sessoes)
          .toBe(2);
      }
    );

    test(
      "cobre clique pago sem UTM com o único vínculo validado do canal",
      async () => {
        const suffix = idCurto();
        const campanhaGoogle =
          `google_coberta_${suffix}`;
        const criada = await db.query(
          `
          INSERT INTO marketing_campanhas (
            nome,
            canal,
            objetivo,
            utm_source,
            utm_medium,
            utm_campaign,
            destino_path,
            ativo
          )
          VALUES (
            $1,
            'google',
            'profissional',
            'google',
            'cpc',
            $2,
            '/',
            TRUE
          )
          RETURNING id
          `,
          [
            `Google coberta ${suffix}`,
            campanhaGoogle,
          ]
        );
        const campanhaGoogleId =
          Number(criada.rows[0].id);
        extraCampaignIds.push(
          campanhaGoogleId
        );

        await db.query(
          `
          INSERT INTO marketing_campanha_vinculos (
            campanha_id,
            provedor,
            conta_externa_id,
            campanha_externa_id,
            campanha_externa_nome
          )
          VALUES ($1, 'google_ads', $2, $3, $4)
          `,
          [
            campanhaGoogleId,
            `conta${suffix}`,
            `campanha${suffix}`,
            `Campanha Google ${suffix}`,
          ]
        );

        const sincronizacao = await db.query(
          `
          INSERT INTO marketing_custo_sincronizacoes (
            provedor,
            status,
            data_inicio,
            data_fim,
            campanhas_nao_vinculadas,
            reconciliacao_campanhas_completa,
            finished_at
          )
          VALUES (
            'google_ads',
            'sucesso',
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 29,
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
            0,
            TRUE,
            NOW()
          )
          RETURNING id
          `
        );
        extraSyncIds.push(
          Number(sincronizacao.rows[0].id)
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
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
            2500,
            'BRL',
            'google_ads'
          )
          `,
          [campanhaGoogleId]
        );

        await db.query(
          `
          INSERT INTO eventos_produto (
            nome,
            pagina,
            sessao_id,
            propriedades
          )
          VALUES (
            'perfil_visualizado',
            'perfil_negocio',
            $1,
            $2::JSONB
          )
          `,
          [
            sessionGoogle,
            JSON.stringify({
              gclid:
                "google-click-vinculado",
            }),
          ]
        );

        const diagnostico =
          await adminMarketingCostRepository
            .buscarDiagnosticoAtribuicao(
              "all"
            );
        const linhas =
          await adminMarketingCostRepository
            .listarDesempenho("all");
        const encontrada = linhas.find(
          (item) =>
            Number(item.id) ===
              campanhaGoogleId
        );

        expect(diagnostico).toMatchObject({
          sessoes_atribuicao_assistida: 1,
          sessoes_sem_campanha: 0,
        });
        expect(encontrada).toMatchObject({
          sessoes: 1,
          sessoes_atribuicao_assistida: 1,
          sessoes_com_custo: 1,
          investimento_centavos: "2500",
        });
      }
    );
  }
);
