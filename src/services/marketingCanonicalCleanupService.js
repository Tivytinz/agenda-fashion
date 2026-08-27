const db = require(
  "../db/db"
);

const marketingAttributionRecoveryRepository =
  require(
    "../repositories/marketingAttributionRecoveryRepository"
  );

const CAMPANHA_OFICIAL =
  "google_ads_profissionais";

const CAMPANHAS_LEGADAS = [
  "aquisicao_profissionais",
  "search_aquisicao_profissionais",
  "profissionais_google_ads",
];

async function executarLimpezaGoogleProfissionais() {
  return db.executarTransacao(
    async (client) => {
      const oficial =
        await client.query(
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
            'Google Ads · Aquisição de profissionais',
            'google',
            'profissional',
            'google',
            'cpc',
            $1,
            '/cadastro?tipo=profissional',
            TRUE
          )
          ON CONFLICT (
            utm_source,
            utm_medium,
            utm_campaign
          )
          DO UPDATE SET
            nome = EXCLUDED.nome,
            canal = EXCLUDED.canal,
            objetivo = EXCLUDED.objetivo,
            ativo = TRUE,
            updated_at = NOW()
          RETURNING id
          `,
          [CAMPANHA_OFICIAL]
        );

      const campanhaOficialId =
        Number(
          oficial.rows[0]?.id
        );

      const campanhasRemovidas =
        await client.query(
          `
          SELECT id
          FROM marketing_campanhas
          WHERE id <> $1
            AND (
              (
                canal = 'google'
                AND objetivo = 'profissional'
              )
              OR utm_campaign = ANY($2::TEXT[])
            )
          `,
          [
            campanhaOficialId,
            CAMPANHAS_LEGADAS,
          ]
        );

      const idsRemover =
        campanhasRemovidas.rows
          .map((item) => Number(item.id))
          .filter(Number.isInteger);

      let gastosRemovidos = 0;
      let vinculosRemovidos = 0;
      let campanhasApagadas = 0;

      if (idsRemover.length) {
        const gastos =
          await client.query(
            `
            DELETE FROM marketing_campanha_gastos
            WHERE campanha_id = ANY($1::BIGINT[])
            `,
            [idsRemover]
          );

        gastosRemovidos =
          gastos.rowCount || 0;

        const vinculos =
          await client.query(
            `
            DELETE FROM marketing_campanha_vinculos
            WHERE campanha_id = ANY($1::BIGINT[])
            `,
            [idsRemover]
          );

        vinculosRemovidos =
          vinculos.rowCount || 0;

        const campanhas =
          await client.query(
            `
            DELETE FROM marketing_campanhas
            WHERE id = ANY($1::BIGINT[])
            `,
            [idsRemover]
          );

        campanhasApagadas =
          campanhas.rowCount || 0;
      }

      const primeiroToqueComGclid =
        await client.query(
          `
          UPDATE marketing_usuario_atribuicoes
          SET
            utm_source = 'google',
            utm_medium = 'cpc',
            utm_campaign = CASE
              WHEN LOWER(COALESCE(utm_campaign, '')) = $1
                THEN $1
              ELSE NULL
            END,
            fbclid = NULL,
            updated_at = NOW()
          WHERE intencao = 'profissional'
            AND COALESCE(
              NULLIF(BTRIM(gclid), ''),
              NULLIF(BTRIM(gbraid), ''),
              NULLIF(BTRIM(wbraid), '')
            ) IS NOT NULL
            AND (
              LOWER(COALESCE(utm_source, '')) <> 'google'
              OR LOWER(COALESCE(utm_medium, '')) <> 'cpc'
              OR (
                NULLIF(BTRIM(utm_campaign), '') IS NOT NULL
                AND LOWER(utm_campaign) <> $1
              )
              OR NULLIF(BTRIM(fbclid), '') IS NOT NULL
            )
          `,
          [CAMPANHA_OFICIAL]
        );

      const ultimoToqueComGclid =
        await client.query(
          `
          UPDATE marketing_usuario_atribuicoes
          SET
            last_utm_source = 'google',
            last_utm_medium = 'cpc',
            last_utm_campaign = CASE
              WHEN LOWER(COALESCE(last_utm_campaign, '')) = $1
                THEN $1
              ELSE NULL
            END,
            last_fbclid = NULL,
            updated_at = NOW()
          WHERE intencao = 'profissional'
            AND COALESCE(
              NULLIF(BTRIM(last_gclid), ''),
              NULLIF(BTRIM(last_gbraid), ''),
              NULLIF(BTRIM(last_wbraid), '')
            ) IS NOT NULL
            AND (
              LOWER(COALESCE(last_utm_source, '')) <> 'google'
              OR LOWER(COALESCE(last_utm_medium, '')) <> 'cpc'
              OR (
                NULLIF(BTRIM(last_utm_campaign), '') IS NOT NULL
                AND LOWER(last_utm_campaign) <> $1
              )
              OR NULLIF(BTRIM(last_fbclid), '') IS NOT NULL
            )
          `,
          [CAMPANHA_OFICIAL]
        );

      const atribuicoesPrimeiroToque =
        await client.query(
          `
          UPDATE marketing_usuario_atribuicoes
          SET
            utm_source = NULL,
            utm_medium = NULL,
            utm_campaign = NULL,
            utm_content = NULL,
            utm_term = NULL,
            fbclid = NULL,
            landing_page = NULL,
            updated_at = NOW()
          WHERE intencao = 'profissional'
            AND COALESCE(
              NULLIF(BTRIM(gclid), ''),
              NULLIF(BTRIM(gbraid), ''),
              NULLIF(BTRIM(wbraid), '')
            ) IS NULL
            AND LOWER(COALESCE(utm_source, '')) = 'google'
            AND LOWER(COALESCE(utm_campaign, '')) <> $1
          `,
          [CAMPANHA_OFICIAL]
        );

      const atribuicoesUltimoToque =
        await client.query(
          `
          UPDATE marketing_usuario_atribuicoes
          SET
            last_utm_source = NULL,
            last_utm_medium = NULL,
            last_utm_campaign = NULL,
            last_utm_content = NULL,
            last_utm_term = NULL,
            last_fbclid = NULL,
            last_landing_page = NULL,
            updated_at = NOW()
          WHERE intencao = 'profissional'
            AND COALESCE(
              NULLIF(BTRIM(last_gclid), ''),
              NULLIF(BTRIM(last_gbraid), ''),
              NULLIF(BTRIM(last_wbraid), '')
            ) IS NULL
            AND LOWER(COALESCE(last_utm_source, '')) = 'google'
            AND LOWER(COALESCE(last_utm_campaign, '')) <> $1
          `,
          [CAMPANHA_OFICIAL]
        );

      const eventosLegadosComSinalGoogle =
        await client.query(
          `
          UPDATE eventos_produto
          SET propriedades =
            jsonb_set(
              jsonb_set(
                propriedades
                  - 'utm_campaign'
                  - 'fbclid',
                '{utm_source}',
                '"google"'::jsonb,
                TRUE
              ),
              '{utm_medium}',
              '"cpc"'::jsonb,
              TRUE
            )
          WHERE LOWER(
            COALESCE(
              propriedades ->> 'utm_campaign',
              ''
            )
          ) = ANY($1::TEXT[])
            AND COALESCE(
              NULLIF(BTRIM(propriedades ->> 'gclid'), ''),
              NULLIF(BTRIM(propriedades ->> 'gbraid'), ''),
              NULLIF(BTRIM(propriedades ->> 'wbraid'), '')
            ) IS NOT NULL
          `,
          [CAMPANHAS_LEGADAS]
        );

      const eventosLegadosSemSinalGoogle =
        await client.query(
          `
          UPDATE eventos_produto
          SET propriedades = propriedades
            - 'utm_source'
            - 'utm_medium'
            - 'utm_campaign'
            - 'utm_content'
            - 'utm_term'
            - 'fbclid'
            - 'landing_page'
          WHERE LOWER(
            COALESCE(
              propriedades ->> 'utm_campaign',
              ''
            )
          ) = ANY($1::TEXT[])
            AND COALESCE(
              NULLIF(BTRIM(propriedades ->> 'gclid'), ''),
              NULLIF(BTRIM(propriedades ->> 'gbraid'), ''),
              NULLIF(BTRIM(propriedades ->> 'wbraid'), '')
            ) IS NULL
          `,
          [CAMPANHAS_LEGADAS]
        );

      /*
       * Se a gravação da atribuição no cadastro falhou, uma navegação
       * autenticada logo depois ainda pode conter a evidência do clique.
       * A recuperação é conservadora: só preenche first touch vazio e deixa
       * a resolução final da campanha para as regras oficiais já existentes.
       */
      const atribuicoesRecuperadas =
        await marketingAttributionRecoveryRepository
          .recuperarGoogleProfissionaisPorEventos({
            client,
            campanhaOficial:
              CAMPANHA_OFICIAL,
          });

      const eventosComSinalGooglePreservados =
        eventosLegadosComSinalGoogle.rowCount || 0;

      return {
        campanhaOficialId,
        campanhasApagadas,
        gastosRemovidos,
        vinculosRemovidos,
        atribuicoesComGclidPreservadas:
          (primeiroToqueComGclid.rowCount || 0) +
          (ultimoToqueComGclid.rowCount || 0),
        atribuicoesLimpas:
          (atribuicoesPrimeiroToque.rowCount || 0) +
          (atribuicoesUltimoToque.rowCount || 0),
        atribuicoesRecuperadasDeEventos:
          atribuicoesRecuperadas.rowCount || 0,
        eventosComGclidPreservados:
          eventosComSinalGooglePreservados,
        eventosComSinalGooglePreservados,
        eventosLimpos:
          eventosLegadosSemSinalGoogle.rowCount || 0,
      };
    }
  );
}

module.exports = {
  CAMPANHA_OFICIAL,
  CAMPANHAS_LEGADAS,
  executarLimpezaGoogleProfissionais,
};
