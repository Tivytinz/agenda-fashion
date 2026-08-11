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

    beforeEach(async () => {
      const suffix = idCurto();

      utmCampaign =
        `custo_${suffix}`;
      sessionA =
        `csta_${suffix}`;
      sessionB =
        `cstb_${suffix}`;

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
            $3::JSONB
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
          '2026-08-10',
          5000,
          'BRL',
          'manual'
        )
        `,
        [campanhaId]
      );
    });

    afterEach(async () => {
      await db.query(
        `
        DELETE FROM marketing_campanha_gastos
        WHERE campanha_id = $1
        `,
        [campanhaId]
      );

      await db.query(
        `
        DELETE FROM eventos_produto
        WHERE sessao_id = ANY($1::TEXT[])
        `,
        [[sessionA, sessionB]]
      );

      await db.query(
        `
        DELETE FROM marketing_campanhas
        WHERE id = $1
        `,
        [campanhaId]
      );
    });

    test(
      "relaciona investimento com sessões e conversões pela identidade UTM",
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
            agendamentos_concluidos: 1,
            investimento_centavos: "5000",
          });
      }
    );

    test(
      "corrige gasto manual do mesmo dia sem duplicar valor",
      async () => {
        await adminMarketingCostRepository
          .salvarGastoManual({
            campanhaId,
            dataGasto: "2026-08-10",
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
              AND data_gasto = '2026-08-10'
              AND fonte = 'manual'
            `,
            [campanhaId]
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
  }
);
