const crypto = require(
  "crypto"
);

const db = require(
  "../src/db/db"
);

const adminCampaignRepository =
  require(
    "../src/repositories/adminCampaignRepository"
  );

function idCurto() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "adminCampaignRepository integrado",
  () => {
    let campaignId;
    let utmCampaign;

    beforeEach(() => {
      campaignId = null;
      utmCampaign =
        `teste_ci_${idCurto()}`;
    });

    afterEach(async () => {
      if (campaignId) {
        await db.query(
          `
          DELETE FROM marketing_campanhas
          WHERE id = $1
          `,
          [campaignId]
        );
      }
    });

    test(
      "cria, lista e arquiva campanha real",
      async () => {
        const criada =
          await adminCampaignRepository
            .criar({
              nome:
                "Campanha CI",
              canal: "google",
              utmSource: "google",
              utmMedium: "cpc",
              utmCampaign,
              utmContent:
                "criativo_01",
              utmTerm: null,
              destinoPath:
                "/?categoria=unhas",
              ativo: true,
              criadoPorUsuarioId: null,
            });

        campaignId =
          Number(criada.id);

        expect(criada)
          .toMatchObject({
            canal: "google",
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign:
              utmCampaign,
            destino_path:
              "/?categoria=unhas",
            ativo: true,
          });

        const identidade =
          await adminCampaignRepository
            .buscarPorIdentidade({
              utmSource: "google",
              utmMedium: "cpc",
              utmCampaign,
            });

        expect(
          Number(identidade.id)
        ).toBe(campaignId);

        const listadas =
          await adminCampaignRepository
            .listar();

        expect(
          listadas.some(
            (item) =>
              Number(item.id) ===
              campaignId
          )
        ).toBe(true);

        const atualizada =
          await adminCampaignRepository
            .atualizar(
              campaignId,
              {
                nome:
                  "Campanha CI arquivada",
                utmContent:
                  "criativo_02",
                utmTerm: null,
                destinoPath:
                  "/?categoria=cilios",
                ativo: false,
              }
            );

        expect(atualizada)
          .toMatchObject({
            nome:
              "Campanha CI arquivada",
            utm_campaign:
              utmCampaign,
            utm_content:
              "criativo_02",
            destino_path:
              "/?categoria=cilios",
            ativo: false,
          });
      }
    );
  }
);
