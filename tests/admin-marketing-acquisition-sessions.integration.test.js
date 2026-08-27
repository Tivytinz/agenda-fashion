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

function idCurto() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "adminMarketingRepository aquisição",
  () => {
    let sessaoInterna;
    let sessaoPublica;
    let campanha;

    beforeEach(async () => {
      const suffix = idCurto();

      sessaoInterna =
        `mkt_internal_${suffix}`;
      sessaoPublica =
        `mkt_public_${suffix}`;
      campanha =
        `campanha_aquisicao_${suffix}`;

      const atribuicao = {
        utm_source: "facebook",
        utm_medium: "cpc",
        utm_campaign: campanha,
        landing_page: "/negocio/studio-teste",
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
              'tela_visualizada',
              'dashboard_dono',
              $1,
              $3::JSONB
            ),
            (
              'perfil_visualizado',
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
              'perfil_visualizado',
              'perfil_negocio',
              $2,
              $3::JSONB
            ),
            (
              'agendamento_concluido',
              'finalizar_agendamento',
              $2,
              $5::JSONB
            )
        `,
        [
          sessaoInterna,
          sessaoPublica,
          JSON.stringify(atribuicao),
          JSON.stringify({
            ...atribuicao,
            agendamento_id: `interno_${suffix}`,
            status: "sucesso",
          }),
          JSON.stringify({
            ...atribuicao,
            agendamento_id: `publico_${suffix}`,
            status: "sucesso",
          }),
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
          sessaoInterna,
          sessaoPublica,
        ]]
      );
    });

    test(
      "não conta como aquisição uma sessão iniciada dentro do SaaS",
      async () => {
        const campanhas =
          await adminMarketingRepository
            .listarCampanhas("all");

        const encontrada =
          campanhas.find(
            (item) =>
              item.campanha === campanha
          );

        expect(encontrada)
          .toMatchObject({
            origem: "facebook",
            midia: "cpc",
            campanha,
            sessoes: 1,
            perfis_visualizados: 1,
            sessoes_convertidas: 1,
            agendamentos_concluidos: 1,
          });

        const conversoes =
          await adminMarketingRepository
            .listarConversoes("all");

        const nossasConversoes =
          conversoes.filter(
            (item) =>
              item.campanha === campanha
          );

        expect(nossasConversoes)
          .toHaveLength(1);
        expect(nossasConversoes[0])
          .toMatchObject({
            sessao_id: sessaoPublica,
            campanha,
          });
      }
    );
  }
);
