const mockOAuth = {
  obterAccessToken: jest.fn(),
  statusAutorizacao: jest.fn()
};

jest.mock(
  "../src/services/pinterestMarketingOAuthService",
  () => mockOAuth
);

const provider = require(
  "../src/services/pinterestMarketingCostProvider"
);

function envValido() {
  process.env.PINTEREST_ADS_COSTS_ENABLED = "true";
  process.env.PINTEREST_AD_ACCOUNT_ID = "777888999";
  process.env.PINTEREST_API_VERSION = "v5";
  process.env.MARKETING_COST_SYNC_TIMEOUT_MS = "5000";
}

function resposta(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  };
}

describe("pinterestMarketingCostProvider", () => {
  const envOriginal = process.env;
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envOriginal };
    envValido();
    mockOAuth.obterAccessToken.mockResolvedValue("pina_access_secreto");
    mockOAuth.statusAutorizacao.mockResolvedValue({
      disponivel: true,
      autorizado: true,
      adAccountId: "777888999"
    });
  });

  afterEach(() => {
    process.env = envOriginal;
    global.fetch = fetchOriginal;
  });

  test("status exige autorização OAuth", async () => {
    await expect(provider.status()).resolves.toMatchObject({
      provedor: "pinterest_ads",
      habilitado: true,
      configurado: true,
      contaExternaId: "777888999",
      requerAutorizacao: true
    });

    mockOAuth.statusAutorizacao.mockResolvedValue({
      disponivel: true,
      autorizado: false
    });
    await expect(provider.status()).resolves.toMatchObject({
      configurado: false
    });
  });

  test("testa conta usando Bearer somente no header", async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta({
      id: "777888999",
      name: "Agenda Fashion",
      currency: "BRL",
      timezone: "America/Sao_Paulo"
    }));

    await expect(provider.testarConexao()).resolves.toMatchObject({
      conectado: true,
      contaExternaId: "777888999",
      nomeConta: "Agenda Fashion",
      moeda: "BRL"
    });
    const [url, options] = global.fetch.mock.calls[0];
    expect(String(url)).not.toContain("pina_access_secreto");
    expect(options.headers.Authorization).toBe("Bearer pina_access_secreto");
  });

  test("lista campanhas reais com paginação por bookmark", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(resposta({
        items: [{
          id: "99887766",
          name: "Aquisição Profissionais AF",
          status: "ACTIVE",
          objective_type: "CONSIDERATION"
        }],
        bookmark: "next-page"
      }))
      .mockResolvedValueOnce(resposta({
        items: [{
          id: "11223344",
          name: "Retargeting AF",
          status: "PAUSED",
          objective_type: "WEB_CONVERSION"
        }]
      }));

    const campanhas = await provider.listarCampanhas();
    expect(campanhas).toHaveLength(2);
    expect(campanhas).toEqual(expect.arrayContaining([
      expect.objectContaining({
        campanhaExternaId: "99887766",
        status: "ACTIVE"
      }),
      expect.objectContaining({
        campanhaExternaId: "11223344",
        status: "PAUSED"
      })
    ]));
    const secondUrl = new URL(String(global.fetch.mock.calls[1][0]));
    expect(secondUrl.searchParams.get("bookmark")).toBe("next-page");
  });

  test("converte SPEND_IN_MICRO_DOLLAR diário para centavos", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(resposta({
        items: [{
          id: "99887766",
          name: "Aquisição Profissionais AF",
          status: "ACTIVE",
          objective_type: "CONSIDERATION"
        }]
      }))
      .mockResolvedValueOnce(resposta([{
        CAMPAIGN_ID: "99887766",
        DATE: "2026-09-07",
        SPEND_IN_MICRO_DOLLAR: 12340000
      }]));

    await expect(provider.listarCustos({
      dataInicio: "2026-09-01",
      dataFim: "2026-09-07"
    })).resolves.toEqual([{
      contaExternaId: "777888999",
      campanhaExternaId: "99887766",
      campanhaExternaNome: "Aquisição Profissionais AF",
      dataGasto: "2026-09-07",
      valorCentavos: 1234
    }]);

    const analyticsUrl = new URL(String(global.fetch.mock.calls[1][0]));
    expect(analyticsUrl.pathname).toBe(
      "/v5/ad_accounts/777888999/campaigns/analytics"
    );
    expect(analyticsUrl.searchParams.get("columns"))
      .toBe("SPEND_IN_MICRO_DOLLAR");
    expect(analyticsUrl.searchParams.get("granularity")).toBe("DAY");
  });

  test("recusa analytics em formato inesperado", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(resposta({
        items: [{ id: "99887766", name: "AF", status: "ACTIVE" }]
      }))
      .mockResolvedValueOnce(resposta({ items: [] }));

    await expect(provider.listarCustos({
      dataInicio: "2026-09-01",
      dataFim: "2026-09-07"
    })).rejects.toMatchObject({ statusCode: 502 });
  });
});
