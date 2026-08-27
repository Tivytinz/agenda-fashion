const crypto = require(
  "crypto"
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/adminProfessionalFunnelRepository"
);

function suffix() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "atribuição profissional por cobertura de sincronização",
  () => {
    let usuarioId = null;
    let campanhaId = null;
    const sincronizacaoIds = [];

    afterEach(async () => {
      if (sincronizacaoIds.length) {
        await db.query(
          `
          DELETE FROM marketing_custo_sincronizacoes
          WHERE id = ANY($1::BIGINT[])
          `,
          [sincronizacaoIds]
        );
        sincronizacaoIds.length = 0;
      }

      if (campanhaId) {
        await db.query(
          `DELETE FROM marketing_campanhas WHERE id = $1`,
          [campanhaId]
        );
        campanhaId = null;
      }

      if (usuarioId) {
        await db.query(
          `DELETE FROM usuarios WHERE id = $1`,
          [usuarioId]
        );
        usuarioId = null;
      }
    });

    test(
      "usa a sincronização mais recente que cobre a data do cadastro",
      async () => {
        const id = suffix();
        const utmCampaign = `google_sync_${id}`;

        const usuario = await db.query(
          `
          INSERT INTO usuarios (
            nome,
            email,
            senha,
            whatsapp
          )
          VALUES (
            $1,
            $2,
            'hash-teste',
            '62999999999'
          )
          RETURNING id
          `,
          [
            `Google Sync ${id}`,
            `google-sync-${id}@example.com`,
          ]
        );
        usuarioId = Number(usuario.rows[0].id);

        await db.query(
          `
          INSERT INTO marketing_usuario_atribuicoes (
            usuario_id,
            intencao,
            utm_source,
            utm_medium,
            gclid,
            atribuicao_em
          )
          VALUES (
            $1,
            'profissional',
            'google',
            'cpc',
            $2,
            NOW() - INTERVAL '10 days'
          )
          `,
          [usuarioId, `gclid-${id}`]
        );

        const campanha = await db.query(
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
            '/cadastro?tipo=profissional',
            TRUE
          )
          RETURNING id
          `,
          [`Google profissionais ${id}`, utmCampaign]
        );
        campanhaId = Number(campanha.rows[0].id);

        await db.query(
          `
          INSERT INTO marketing_campanha_vinculos (
            campanha_id,
            provedor,
            conta_externa_id,
            campanha_externa_id,
            campanha_externa_nome
          )
          VALUES (
            $1,
            'google_ads',
            $2,
            $3,
            'Search Aquisição Profissionais AF'
          )
          `,
          [
            campanhaId,
            `100${id.replace(/\D/g, "").padEnd(8, "1")}`,
            `200${id.replace(/\D/g, "").padEnd(8, "2")}`,
          ]
        );

        const abrangente = await db.query(
          `
          INSERT INTO marketing_custo_sincronizacoes (
            provedor,
            status,
            data_inicio,
            data_fim,
            registros_importados,
            campanhas_nao_vinculadas,
            reconciliacao_campanhas_completa,
            created_at,
            finished_at
          )
          VALUES (
            'google_ads',
            'sucesso',
            CURRENT_DATE - 29,
            CURRENT_DATE,
            1,
            0,
            TRUE,
            NOW() - INTERVAL '2 hours',
            NOW() - INTERVAL '2 hours'
          )
          RETURNING id
          `
        );
        sincronizacaoIds.push(
          Number(abrangente.rows[0].id)
        );

        const recenteCurta = await db.query(
          `
          INSERT INTO marketing_custo_sincronizacoes (
            provedor,
            status,
            data_inicio,
            data_fim,
            registros_importados,
            campanhas_nao_vinculadas,
            reconciliacao_campanhas_completa,
            created_at,
            finished_at
          )
          VALUES (
            'google_ads',
            'sucesso',
            CURRENT_DATE,
            CURRENT_DATE,
            1,
            0,
            TRUE,
            NOW() - INTERVAL '1 hour',
            NOW() - INTERVAL '1 hour'
          )
          RETURNING id
          `
        );
        sincronizacaoIds.push(
          Number(recenteCurta.rows[0].id)
        );

        const linhas = await repository
          .listarPorCampanha("all");

        const encontrada = linhas.find(
          (item) =>
            Number(item.campanha_oficial_id) ===
            campanhaId
        );

        expect(encontrada).toMatchObject({
          origem: "google",
          midia: "cpc",
          campanha: utmCampaign,
          classificacao_atribuicao: "oficial",
          cadastros: 1,
        });
      }
    );
  }
);
