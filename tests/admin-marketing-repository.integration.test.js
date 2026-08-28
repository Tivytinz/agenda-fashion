const crypto = require(
  "crypto"
);

const db = require(
  "../src/db/db"
);

const adminMarketingRepository =
  require(
    "../src/repositories/adminMarketingRepository"
  );

const INTEGRATION_TEST_TIMEOUT_MS =
  15_000;

function idCurto() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "adminMarketingRepository integrado",
  () => {
    let sessionA;
    let sessionB;
    let sessionGoogleSemCampanha;
    let campaign;
    let managedCampaignId;
    let managedSyncId;

    beforeEach(async () => {
      const suffix = idCurto();

      sessionA =
        `mkta_${suffix}`;
      sessionB =
        `mktb_${suffix}`;
      sessionGoogleSemCampanha =
        `mktg_${suffix}`;
      campaign =
        `campanha_${suffix}`;
      managedCampaignId = null;
      managedSyncId = null;

      const attribution = {
        utm_source: "facebook",
        utm_medium: "cpc",
        utm_campaign: campaign,
        utm_content: "video_01",
        landing_page: "/negocio/studio-teste"
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
              'perfil_negocio',
              $1,
              $3::JSONB
            ),
            (
              'agendamento_iniciado',
              'perfil_negocio',
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
              'perfil_negocio',
              $2,
              $3::JSONB
            )
        `,
        [
          sessionA,
          sessionB,
          JSON.stringify(attribution),
          JSON.stringify({
            ...attribution,
            agendamento_id: 987654,
            servico_id: 123456,
            status: "sucesso"
          }),
          JSON.stringify({
            ...attribution,
            agendamento_id: 987655,
            servico_id: 123456,
            status: "sucesso"
          })
        ]
      );
    });

    afterEach(async () => {
      await db.query(
        `
          DELETE FROM eventos_produto
          WHERE sessao_id = ANY($1::TEXT[])
        `,
        [[
          sessionA,
          sessionB,
          sessionGoogleSemCampanha,
        ]]
      );

      if (managedCampaignId) {
        await db.query(
          `
          DELETE FROM marketing_campanhas
          WHERE id = $1
          `,
          [managedCampaignId]
        );
      }

      if (managedSyncId) {
        await db.query(
          `
          DELETE FROM marketing_custo_sincronizacoes
          WHERE id = $1
          `,
          [managedSyncId]
        );
      }
    });

    test(
      "conta agendamentos distintos mesmo dentro da mesma sessão",
      async () => {
        const campanhas =
          await adminMarketingRepository
            .listarCampanhas("all");

        const encontrada =
          campanhas.find(
            (item) =>
              item.campanha ===
              campaign
          );

        expect(encontrada)
          .toMatchObject({
            origem: "facebook",
            midia: "cpc",
            campanha: campaign,
            sessoes: 2,
            perfis_visualizados: 2,
            agendamentos_iniciados: 1,
            sessoes_convertidas: 1,
            agendamentos_concluidos: 2,
          });
      }
    );

    test(
      "retorna a conversão atribuída sem consultar dados pessoais do cliente",
      async () => {
        const conversoes =
          await adminMarketingRepository
            .listarConversoes("all");

        const encontrada =
          conversoes.find(
            (item) =>
              item.campanha ===
              campaign &&
              item.agendamento_id ===
              "987654"
          );

        expect(encontrada)
          .toMatchObject({
            sessao_id: sessionA,
            agendamento_id: "987654",
            servico_id: "123456",
            origem: "facebook",
            midia: "cpc",
            campanha: campaign,
            conteudo: "video_01",
            landing_page:
              "/negocio/studio-teste",
          });

        expect(encontrada)
          .not.toHaveProperty(
            "cliente_nome"
          );

        expect(encontrada)
          .not.toHaveProperty(
            "cliente_whatsapp"
          );
      }
    );

    test(
      "não reescreve clique Google sem UTM usando a campanha ativa atual",
      async () => {
        const suffix = idCurto();
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
            `Google ativa ${suffix}`,
            `google_ativa_${suffix}`,
          ]
        );
        managedCampaignId =
          Number(criada.rows[0].id);

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
            sessionGoogleSemCampanha,
            JSON.stringify({
              gclid: "click-sem-utm-campaign",
            }),
          ]
        );

        const campanhas =
          await adminMarketingRepository
            .listarCampanhas("all");
        const encontrada = campanhas.find(
          (item) =>
            item.origem === "google" &&
            item.campanha === "(sem campanha)" &&
            Number(item.sessoes) === 1
        );

        expect(encontrada).toMatchObject({
          midia: "cpc",
          sessoes_resolvidas_gclid: 0,
          sessoes_resolvidas_google_click: 0,
        });
      }
    );

    test(
      "atribui clique Google sem UTM quando existe um único vínculo verificado",
      async () => {
        const suffix = idCurto();
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
            `Google vinculada ${suffix}`,
            `google_vinculada_${suffix}`,
          ]
        );
        managedCampaignId =
          Number(criada.rows[0].id);

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
            managedCampaignId,
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
        managedSyncId = Number(
          sincronizacao.rows[0].id
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
            sessionGoogleSemCampanha,
            JSON.stringify({
              gclid: "click-resolvido-por-vinculo",
            }),
          ]
        );

        const campanhas =
          await adminMarketingRepository
            .listarCampanhas("all");
        const encontrada = campanhas.find(
          (item) =>
            Number(item.campanha_oficial_id) ===
              managedCampaignId
        );

        expect(encontrada).toMatchObject({
          campanha:
            `google_vinculada_${suffix}`,
          classificacao_atribuicao:
            "oficial",
          sessoes: 1,
          sessoes_atribuicao_direta: 0,
          sessoes_atribuicao_assistida: 1,
        });

        await db.query(
          `
          UPDATE marketing_custo_sincronizacoes
          SET
            status = 'parcial',
            campanhas_nao_vinculadas = 1
          WHERE id = $1
          `,
          [managedSyncId]
        );

        const comReconciliacaoParcial =
          await adminMarketingRepository
            .listarCampanhas("all");

        expect(
          comReconciliacaoParcial.some(
            (item) =>
              Number(item.campanha_oficial_id) ===
                managedCampaignId
          )
        ).toBe(false);

        await db.query(
          `
          UPDATE marketing_custo_sincronizacoes
          SET
            status = 'sucesso',
            campanhas_nao_vinculadas = 0,
            data_inicio =
              (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 60,
            data_fim =
              (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 31
          WHERE id = $1
          `,
          [managedSyncId]
        );

        const foraDaJanelaComprovada =
          await adminMarketingRepository
            .listarCampanhas("all");

        expect(
          foraDaJanelaComprovada.some(
            (item) =>
              Number(item.campanha_oficial_id) ===
                managedCampaignId
          )
        ).toBe(false);

        await db.query(
          `
          UPDATE marketing_custo_sincronizacoes
          SET
            data_inicio =
              (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 29,
            data_fim =
              (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
            reconciliacao_campanhas_completa = FALSE
          WHERE id = $1
          `,
          [managedSyncId]
        );

        const semEvidenciaDaVersaoAtual =
          await adminMarketingRepository
            .listarCampanhas("all");

        expect(
          semEvidenciaDaVersaoAtual.some(
            (item) =>
              Number(item.campanha_oficial_id) ===
                managedCampaignId
          )
        ).toBe(false);
      },
      INTEGRATION_TEST_TIMEOUT_MS
    );
  }
);
