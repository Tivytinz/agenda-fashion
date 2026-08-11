jest.mock(
  "../src/repositories/marketingUserAttributionRepository",
  () => ({
    registrarConta:
      jest.fn(),
    marcarIntencaoProfissional:
      jest.fn(),
  })
);

const repository = require(
  "../src/repositories/marketingUserAttributionRepository"
);

const service = require(
  "../src/services/marketingUserAttributionService"
);

describe(
  "atribuição de aquisição do usuário",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "mantém somente contexto de marketing permitido",
      async () => {
        repository.registrarConta
          .mockResolvedValue({
            usuario_id: 7,
          });

        await service.registrarContaCriada({
          usuarioId: 7,
          marketing: {
            intencao: "profissional",
            sessao_id: "sessao_12345678",
            utm_source: "meta",
            utm_medium: "cpc",
            utm_campaign: "profissionais_goiania",
            utm_content: "video_01",
            gclid: "gclid-123",
            landing_page: "/cadastro",
            email: "nao@salvar.com",
            whatsapp: "62999999999",
            nome: "Não salvar",
          },
        });

        expect(
          repository.registrarConta
        ).toHaveBeenCalledWith({
          usuarioId: 7,
          intencao: "profissional",
          sessaoId: "sessao_12345678",
          utmSource: "meta",
          utmMedium: "cpc",
          utmCampaign: "profissionais_goiania",
          utmContent: "video_01",
          utmTerm: null,
          gclid: "gclid-123",
          fbclid: null,
          landingPage: "/cadastro",
        });
      }
    );

    test(
      "descarta landing externa e sessão inválida",
      async () => {
        repository.registrarConta
          .mockResolvedValue({});

        await service.registrarContaCriada({
          usuarioId: 8,
          marketing: {
            intencao: "qualquer-coisa",
            sessao_id: "x",
            landing_page:
              "https://externo.test/oferta",
          },
        });

        expect(
          repository.registrarConta
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            intencao: "indefinida",
            sessaoId: null,
            landingPage: null,
          })
        );
      }
    );

    test(
      "marca conta como profissional sem alterar atribuição no service",
      async () => {
        repository
          .marcarIntencaoProfissional
          .mockResolvedValue({
            usuario_id: 9,
            intencao: "profissional",
          });

        await service
          .marcarIntencaoProfissional(9);

        expect(
          repository
            .marcarIntencaoProfissional
        ).toHaveBeenCalledWith(9);
      }
    );
  }
);
