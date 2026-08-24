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
      "mantém somente contexto de marketing permitido com first e last touch",
      async () => {
        repository.registrarConta
          .mockResolvedValue({
            usuario_id: 7,
          });

        await service.registrarContaCriada({
          usuarioId: 7,
          marketing: {
            intencao: "cliente",
            sessao_id: "sessao_12345678",
            utm_source: "meta",
            utm_medium: "cpc",
            utm_campaign: "clientes_goiania",
            utm_content: "video_01",
            fbclid: "fbclid-123",
            landing_page: "/cadastro",
            last_utm_source: "google",
            last_utm_medium: "cpc",
            last_utm_campaign: "retargeting",
            last_utm_content: "search_01",
            last_gclid: "gclid-last-456",
            last_landing_page: "/planos",
            email: "nao@salvar.com",
            whatsapp: "62999999999",
            nome: "Não salvar",
          },
        });

        expect(
          repository.registrarConta
        ).toHaveBeenCalledWith({
          usuarioId: 7,
          intencao: "cliente",
          sessaoId: "sessao_12345678",
          utmSource: "meta",
          utmMedium: "cpc",
          utmCampaign: "clientes_goiania",
          utmContent: "video_01",
          utmTerm: null,
          gclid: null,
          gbraid: null,
          wbraid: null,
          fbclid: "fbclid-123",
          msclkid: null,
          ttclid: null,
          epik: null,
          afSource: null,
          afMedium: null,
          afContent: null,
          landingPage: "/cadastro",
          lastUtmSource: "google",
          lastUtmMedium: "cpc",
          lastUtmCampaign: "retargeting",
          lastUtmContent: "search_01",
          lastUtmTerm: null,
          lastGclid: "gclid-last-456",
          lastGbraid: null,
          lastWbraid: null,
          lastFbclid: null,
          lastMsclkid: null,
          lastTtclid: null,
          lastEpik: null,
          lastAfSource: null,
          lastAfMedium: null,
          lastAfContent: null,
          lastLandingPage: "/planos",
        });
      }
    );

    test(
      "preserva GCLID profissional sem campanha e normaliza como Google CPC",
      () => {
        const resultado =
          service.normalizarMarketing({
            intencao: "profissional",
            utm_source: "meta",
            utm_medium: "paid_social",
            utm_campaign: "campanha_nao_oficial",
            utm_content: "criativo_01",
            gclid: "gclid-profissional-123",
            fbclid: "fbclid-conflitante",
            landing_page: "/cadastro",
          });

        expect(resultado).toMatchObject({
          intencao: "profissional",
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: null,
          utmContent: "criativo_01",
          gclid: "gclid-profissional-123",
          fbclid: null,
          landingPage: "/cadastro",
        });
      }
    );

    test(
      "trata GBRAID e WBRAID como sinais de clique Google",
      () => {
        const primeiro = service.normalizarMarketing({
          intencao: "profissional",
          gbraid: "gbraid-profissional-123",
          utm_campaign: "campanha_nao_oficial",
        });
        const ultimo = service.normalizarMarketing({
          intencao: "profissional",
          last_wbraid: "wbraid-profissional-456",
        });

        expect(primeiro).toMatchObject({
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: null,
          gclid: null,
          gbraid: "gbraid-profissional-123",
        });
        expect(ultimo).toMatchObject({
          lastUtmSource: "google",
          lastUtmMedium: "cpc",
          lastGclid: null,
          lastWbraid: "wbraid-profissional-456",
        });
      }
    );

    test(
      "preserva os identificadores modernos enviados pelo frontend",
      () => {
        const resultado =
          service.normalizarMarketing({
            intencao: "cliente",
            msclkid: "microsoft-click",
            ttclid: "tiktok-click",
            epik: "pinterest-click",
            af_source: "compartilhamento",
            af_medium: "link",
            af_content: "perfil",
            last_msclkid: "microsoft-last",
            last_af_source: "catalogo",
          });

        expect(resultado).toMatchObject({
          msclkid: "microsoft-click",
          ttclid: "tiktok-click",
          epik: "pinterest-click",
          afSource: "compartilhamento",
          afMedium: "link",
          afContent: "perfil",
          lastMsclkid: "microsoft-last",
          lastAfSource: "catalogo",
        });
      }
    );

    test(
      "mantém a campanha Google oficial quando GCLID também está presente",
      () => {
        const resultado =
          service.normalizarMarketing({
            intencao: "profissional",
            utm_source: "qualquer_origem",
            utm_medium: "qualquer_midia",
            utm_campaign: "google_ads_profissionais",
            gclid: "gclid-oficial-456",
          });

        expect(resultado).toMatchObject({
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign:
            "google_ads_profissionais",
          gclid: "gclid-oficial-456",
        });
      }
    );

    test(
      "descarta Google manual não oficial quando não existe sinal Google",
      () => {
        const resultado =
          service.normalizarMarketing({
            intencao: "profissional",
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign:
              "search_aquisicao_profissionais",
            landing_page: "/cadastro",
          });

        expect(resultado).toMatchObject({
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          gclid: null,
          landingPage: null,
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
            last_landing_page:
              "//externo.test/oferta",
          },
        });

        expect(
          repository.registrarConta
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            intencao: "indefinida",
            sessaoId: null,
            landingPage: null,
            lastLandingPage: null,
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
