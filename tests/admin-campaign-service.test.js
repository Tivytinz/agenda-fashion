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
    objetivo:
      campanha.objetivo,
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
      "normaliza campanha com objetivo e gera link interno rastreável",
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
                objetivo:
                  "cliente",
                destinoPath:
                  "/negocio/studio-bella?servico=8&utm_source=antiga&gbraid=antigo&ttclid=antigo",
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
            objetivo: "cliente",
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

        expect(
          resultado.campanha.objetivo
        ).toBe("cliente");

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

    test(
      "exige objetivo explícito em nova campanha",
      async () => {
        await expect(
          adminCampaignService
            .criarCampanha({
              usuarioId: 7,
              payload: {
                nome: "Sem objetivo",
                canal: "meta",
                destinoPath: "/",
              },
            })
        ).rejects.toMatchObject({
          statusCode: 400,
        });

        expect(
          adminCampaignRepository.criar
        ).not.toHaveBeenCalled();
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
                objetivo:
                  "profissional",
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
                objetivo: "cliente",
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
            objetivo: "cliente",
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
      "permite classificar campanha legada uma única vez",
      async () => {
        const atual = {
          id: 31,
          nome: "Campanha legada",
          canal: "google",
          objetivo: "indefinido",
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign: "legada",
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
            async (id, campanha) => ({
              ...atual,
              id,
              objetivo: campanha.objetivo,
              nome: campanha.nome,
              utm_content: campanha.utmContent,
              utm_term: campanha.utmTerm,
              destino_path: campanha.destinoPath,
              ativo: campanha.ativo,
            })
          );

        const resultado =
          await adminCampaignService
            .atualizarCampanha({
              id: 31,
              payload: {
                objetivo: "profissional",
              },
            });

        expect(
          resultado.campanha.objetivo
        ).toBe("profissional");
        expect(
          adminCampaignRepository.atualizar
        ).toHaveBeenCalledWith(
          31,
          expect.objectContaining({
            objetivo: "profissional",
          })
        );
      }
    );

    test(
      "bloqueia troca de objetivo depois da classificação",
      async () => {
        adminCampaignRepository
          .buscarPorId
          .mockResolvedValue({
            id: 31,
            nome: "Aquisição profissional",
            canal: "google",
            objetivo: "profissional",
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign: "profissional",
            utm_content: null,
            utm_term: null,
            destino_path: "/para-profissionais",
            ativo: true,
          });

        await expect(
          adminCampaignService
            .atualizarCampanha({
              id: 31,
              payload: {
                objetivo: "cliente",
              },
            })
        ).rejects.toMatchObject({
          statusCode: 400,
        });

        expect(
          adminCampaignRepository.atualizar
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "arquiva campanha sem alterar objetivo nem identidade",
      async () => {
        const atual = {
          id: 31,
          nome:
            "Cílios Goiânia",
          canal: "meta",
          objetivo: "cliente",
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
              objetivo:
                campanha.objetivo,
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
            objetivo: "cliente",
            ativo: false,
          })
        );

        expect(
          resultado.campanha.ativo
        ).toBe(false);
        expect(
          resultado.campanha.objetivo
        ).toBe("cliente");
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
