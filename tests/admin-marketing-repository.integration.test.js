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
  "adminMarketingRepository integrado",
  () => {
    let sessionA;
    let sessionB;
    let campaign;

    beforeEach(async () => {
      const suffix = idCurto();

      sessionA =
        `mkta_${suffix}`;
      sessionB =
        `mktb_${suffix}`;
      campaign =
        `campanha_${suffix}`;

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
        [[sessionA, sessionB]]
      );
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
  }
);
