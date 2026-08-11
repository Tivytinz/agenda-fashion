jest.mock(
  "../src/repositories/adminCampaignRepository",
  () => ({
    listar:
      jest.fn(),
    buscarPorId:
      jest.fn(),
    buscarPorIdentidade:
      jest.fn(),
    criar:
      jest.fn(),
    atualizar:
      jest.fn(),
  })
);

const adminCampaignRepository =
  require(
    "../src/repositories/adminCampaignRepository"
  );

const adminCampaignService =
  require(
    "../src/services/adminCampaignService"
  );

function rowFromCampaign(
  campanha,
  extras = {}
) {
  return {
    id: 31,
    nome:
      campanha.nome,
    canal:
      campanha.canal,
    utm_source:
      campanha.utmSource,
    utm_medium:
      campanha.utmMedium,
    utm_campaign:
      campanha.utmCampaign,
    utm_content:
      campanha.utmContent,
    utm_term:
      campanha.utmTerm,
    destino_path:
      campanha.destinoPath,
    ativo:
      campanha.ativo,
    criado_por_usuario_id:
      campanha.criadoPorUsuarioId,
    created_at:
      "2026-08-11T01:00:00.000Z",
    updated_at:
      "2026-08-11T01:00:00.000Z",
    ...extras,
  };
}

describe(
  "gestão administrativa de campanhas",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      process.env.PUBLIC_APP_URL =
        "https://app.agendafashion.com.br";
    });

    test(
      "normaliza campanha e gera link interno rastreável",
      async () => {
        adminCampaignRepository
          .buscarPorIdentidade
          .mockResolvedValue(null);

        adminCampaignRepository
          .criar
          .mockImplementation(
            async (campanha) =>
              rowFromCampaign(
                campanha
              )
          );

        const resultado =
          await adminCampaignService
            .criarCampanha({
              usuarioId: 7,
              payload: {
                nome:
                  "Cílios Goiânia Agosto",
                canal:
                  "meta",
                destinoPath:
                  "/negocio/studio-bella?servico=8&utm_source=antiga",
                utmContent:
                  "Vídeo 01",
              },
            });

        expect(
          adminCampaignRepository
            .buscarPorIdentidade
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            utmSource: "meta",
            utmMedium: "cpc",
            utmCampaign:
              "cilios_goiania_agosto",
          })
        );

        expect(
          adminCampaignRepository
            .criar
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            nome:
              "Cílios Goiânia Agosto",
            canal: "meta",
            utmSource: "meta",
            utmMedium: "cpc",
            utmCampaign:
              "cilios_goiania_agosto",
            utmContent: "video_01",
            destinoPath:
              "/negocio/studio-bella?servico=8",
            criadoPorUsuarioId: 7,
          })
        );

        const link =
          new URL(
            resultado.campanha
              .linkRastreavel
          );

        expect(link.origin).toBe(
          "https://app.agendafashion.com.br"
        );
        expect(link.pathname).toBe(
          "/negocio/studio-bella"
        );
        expect(
          link.searchParams.get(
            "servico"
          )
        ).toBe("8");
        expect(
          link.searchParams.get(
            "utm_source"
          )
        ).toBe("meta");
        expect(
          link.searchParams.get(
            "utm_campaign"
          )
        ).toBe(
          "cilios_goiania_agosto"
        );
      }
    );

    test.each([
      "https://exemplo.com/oferta",
      "//exemplo.com/oferta",
      "/\\exemplo.com/oferta",
    ])(
      "bloqueia destino externo ou ambíguo: %s",
      async (destinoPath) => {
        await expect(
          adminCampaignService
            .criarCampanha({
              usuarioId: 7,
              payload: {
                nome:
                  "Campanha externa",
                canal:
                  "google",
                destinoPath,
              },
            })
        ).rejects.toMatchObject({
          statusCode: 400,
        });

        expect(
          adminCampaignRepository
            .criar
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "impede identidade UTM duplicada",
      async () => {
        adminCampaignRepository
          .buscarPorIdentidade
          .mockResolvedValue({
            id: 10,
          });

        await expect(
          adminCampaignService
            .criarCampanha({
              usuarioId: 7,
              payload: {
                nome:
                  "Cílios Goiânia",
                canal: "meta",
              },
            })
        ).rejects.toMatchObject({
          statusCode: 409,
        });

        expect(
          adminCampaignRepository
            .criar
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "preserva identidade UTM ao editar campanha",
      async () => {
        adminCampaignRepository
          .buscarPorId
          .mockResolvedValue({
            id: 31,
            nome: "Campanha",
            canal: "meta",
            utm_source: "meta",
            utm_medium: "cpc",
            utm_campaign:
              "campanha",
            destino_path: "/",
            ativo: true,
          });

        await expect(
          adminCampaignService
            .atualizarCampanha({
              id: 31,
              payload: {
                utmCampaign:
                  "novo_nome",
              },
            })
        ).rejects.toMatchObject({
          statusCode: 400,
        });

        expect(
          adminCampaignRepository
            .atualizar
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "arquiva campanha sem alterar a identidade",
      async () => {
        const atual = {
          id: 31,
          nome:
            "Cílios Goiânia",
          canal: "meta",
          utm_source: "meta",
          utm_medium: "cpc",
          utm_campaign:
            "cilios_goiania",
          utm_content: null,
          utm_term: null,
          destino_path: "/",
          ativo: true,
          criado_por_usuario_id: 7,
        };

        adminCampaignRepository
          .buscarPorId
          .mockResolvedValue(atual);

        adminCampaignRepository
          .atualizar
          .mockImplementation(
            async (
              id,
              campanha
            ) => ({
              ...atual,
              id,
              nome:
                campanha.nome,
              utm_content:
                campanha.utmContent,
              utm_term:
                campanha.utmTerm,
              destino_path:
                campanha.destinoPath,
              ativo:
                campanha.ativo,
            })
          );

        const resultado =
          await adminCampaignService
            .atualizarCampanha({
              id: 31,
              payload: {
                ativo: false,
              },
            });

        expect(
          adminCampaignRepository
            .atualizar
        ).toHaveBeenCalledWith(
          31,
          expect.objectContaining({
            ativo: false,
          })
        );

        expect(
          resultado.campanha.ativo
        ).toBe(false);
        expect(
          resultado.campanha
            .utmCampaign
        ).toBe(
          "cilios_goiania"
        );
      }
    );
  }
);
