const mockQuery = jest.fn();

jest.mock(
  "../src/db/db",
  () => ({
    query: mockQuery,
  })
);

const repository = require(
  "../src/repositories/marketingUserAttributionRepository"
);

describe(
  "persistência da atribuição do usuário",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockQuery.mockResolvedValue({
        rows: [{ usuario_id: 7 }],
      });
    });

    test(
      "persiste first e last touch com todos os sinais aceitos pelo frontend",
      async () => {
        await repository.registrarConta({
          usuarioId: 7,
          intencao: "profissional",
          sessaoId: "sessao_12345678",
          utmSource: "pinterest",
          utmMedium: "cpc",
          utmCampaign: "profissionais",
          utmContent: "pin-1",
          utmTerm: "agenda",
          gclid: null,
          gbraid: "gbraid-1",
          wbraid: null,
          fbclid: null,
          msclkid: null,
          ttclid: null,
          epik: "epik-1",
          afSource: "catalogo",
          afMedium: "link",
          afContent: "card",
          landingPage: "/cadastro",
          lastUtmSource: "google",
          lastUtmMedium: "cpc",
          lastUtmCampaign: "remarketing",
          lastUtmContent: "search",
          lastUtmTerm: "software agenda",
          lastGclid: "gclid-last",
          lastGbraid: null,
          lastWbraid: null,
          lastFbclid: null,
          lastMsclkid: null,
          lastTtclid: null,
          lastEpik: null,
          lastAfSource: "landing",
          lastAfMedium: "cta",
          lastAfContent: "hero",
          lastLandingPage: "/planos",
        });

        const [sql, parametros] =
          mockQuery.mock.calls[0];

        expect(sql).toContain("gbraid");
        expect(sql).toContain("last_wbraid");
        expect(sql).toContain("msclkid");
        expect(sql).toContain("ttclid");
        expect(sql).toContain("epik");
        expect(sql).toContain("af_source");
        expect(sql).toContain("$35");
        expect(parametros).toHaveLength(35);
        expect(parametros[9]).toBe("gbraid-1");
        expect(parametros[14]).toBe("epik-1");
        expect(parametros[24]).toBe("gclid-last");
        expect(parametros[34]).toBe("/planos");
      }
    );

    test(
      "enriquece registro parcial existente sem apagar evidência anterior",
      async () => {
        await repository.registrarConta({
          usuarioId: 7,
          intencao: "profissional",
          sessaoId: "sessao_12345678",
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: null,
          gclid: "gclid-123",
        });

        const [sql] =
          mockQuery.mock.calls[0];

        expect(sql).toContain(
          "ON CONFLICT (usuario_id)"
        );
        expect(sql).toContain(
          "DO UPDATE SET"
        );
        expect(sql).not.toContain(
          "DO NOTHING"
        );
        expect(sql).toContain(
          "marketing_usuario_atribuicoes.utm_source"
        );
        expect(sql).toContain(
          "marketing_usuario_atribuicoes.gclid"
        );
        expect(sql).toContain(
          "EXCLUDED.gclid"
        );
        expect(sql).toContain(
          "OR EXCLUDED.intencao = 'profissional'"
        );
      }
    );
  }
);
