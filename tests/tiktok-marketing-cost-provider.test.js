const mockOAuth = {
  obterAccessToken: jest.fn(),
  statusAutorizacao: jest.fn()
};

jest.mock(
  "../src/services/tiktokMarketingOAuthService",
  () => mockOAuth
);

const provider = require(
  "../src/services/tiktokMarketingCostProvider"
);

function envValido() {
  process.env.TIKTOK_ADS_COSTS_ENABLED = "true";
  process.env.TIKTOK_ADVERTISER_ID = "777888999";
  process.env.TIKTOK_API_VERSION = "v1.3";
  process.env.MARKETING_COST_SYNC_TIMEOUT_MS = "5000";
}

function resposta(data) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      code: 0,
      message: "OK",
      data
    })
  };
}

describe("tiktokMarketingCostProvider", () => {
  const envOriginal = process.env;
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envOriginal };
    envValido();
    mockOAuth.obterAccessToken.mockResolvedValue("access-token-secreto");
    mockOAuth.statusAutorizacao.mockResolvedValue({
      disponivel: true,
      autorizado: true,
      advertiserId: "777888999"
    });
  });

  afterEach(() => {
    process.env = envOriginal;
    global.fetch = fetchOriginal;
  });

  test("status só considera configurado quando OAuth está autorizado", async () => {
    await expect(provider.status()).resolves.toMatchObject({
      provedor: "tiktok_ads",
      habilitado: true,
      configurado: true,
      contaExternaId: "777888999"
    });

    mockOAuth.statusAutorizacao.mockResolvedValue({
      disponivel: true,
      autorizado: false
    });
    await expect(provider.status()).resolves.toMatchObject({
      configurado: false,
      requerAutorizacao: true
    });
  });

  test("testa conta usando Access-Token somente no header", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      resposta({
        list: [{
          advertiser_id: "777888999",
          name: "Agenda Fashion",
          currency: "BRL",
          timezone: "America/Sao_Paulo",
          status: "STATUS_ENABLE"
        }]
      })
    );

    const resultado = await provider.testarConexao();

    expect(resultado).toMatchObject({
      conectado: true,
      contaExternaId: "777888999",
      nomeConta: "Agenda Fashion",
      moeda: "BRL"
    });
    const [url, options] = global.fetch.mock.calls[0];
    expect(String(url)).not.toContain("access-token-secreto");
    expect(options.headers["Access-Token"]).toBe("access-token-secreto");
  });

  test("lista campanhas reais e normaliza IDs e status", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      resposta({
        page_info: {
          page: 1,
          total_page: 1,
          total_number: 1,
          page_size: 100
        },
        list: [{
          campaign_id: "99887766",
          campaign_name: "Aquisição Profissionais AF",
          operation_status: "ENABLE",
          objective_type: "TRAFFIC"
        }]
      })
    );

    await expect(provider.listarCampanhas()).resolves.toEqual([
      {
        contaExternaId: "777888999",
        campanhaExternaId: "99887766",
        campanhaExternaNome: "Aquisição Profissionais AF",
        status: "ENABLE",
        tipo: "TRAFFIC"
      }
    ]);
  });

  test("converte spend diário para centavos sem misturar granularidade", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      resposta({
        page_info: {
          page: 1,
          total_page: 1,
          total_number: 1,
          page_size: 100
        },
        list: [{
          dimensions: {
            campaign_id: "99887766",
            stat_time_day: "2026-09-07 00:00:00"
          },
          metrics: {
            campaign_name: "Aquisição Profissionais AF",
            spend: "12.34"
          }
        }]
      })
    );

    await expect(provider.listarCustos({
      dataInicio: "2026-09-01",
      dataFim: "2026-09-07"
    })).resolves.toEqual([
      {
        contaExternaId: "777888999",
        campanhaExternaId: "99887766",
        campanhaExternaNome: "Aquisição Profissionais AF",
        dataGasto: "2026-09-07",
        valorCentavos: 1234
      }
    ]);

    const url = new URL(String(global.fetch.mock.calls[0][0]));
    expect(url.pathname).toContain("/v1.3/report/integrated/get/");
    expect(JSON.parse(url.searchParams.get("dimensions"))).toEqual([
      "campaign_id",
      "stat_time_day"
    ]);
    expect(JSON.parse(url.searchParams.get("metrics"))).toContain("spend");
  });

  test("transforma erro semântico HTTP 200 em falha segura", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 40100,
        message: "Access token invalid",
        data: {}
      })
    });

    await expect(provider.listarCampanhas()).rejects.toMatchObject({
      statusCode: 502
    });
  });
});
