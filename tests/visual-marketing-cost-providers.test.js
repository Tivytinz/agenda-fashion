const providers = require("../src/services/visualMarketingCostProviders");

const ENV_KEYS = [
  "PINTEREST_ADS_COSTS_ENABLED",
  "PINTEREST_AD_ACCOUNT_ID",
  "PINTEREST_ADS_ACCESS_TOKEN",
  "PINTEREST_API_VERSION",
  "TIKTOK_ADS_COSTS_ENABLED",
  "TIKTOK_ADVERTISER_ID",
  "TIKTOK_ADS_ACCESS_TOKEN",
  "TIKTOK_API_VERSION"
];

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);
const originalFetch = global.fetch;

function response(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(payload)
  };
}

function configurar() {
  process.env.PINTEREST_ADS_COSTS_ENABLED = "true";
  process.env.PINTEREST_AD_ACCOUNT_ID = "549768356618";
  process.env.PINTEREST_ADS_ACCESS_TOKEN = "pinterest-token";
  process.env.PINTEREST_API_VERSION = "v5";
  process.env.TIKTOK_ADS_COSTS_ENABLED = "true";
  process.env.TIKTOK_ADVERTISER_ID = "7488990011223344556";
  process.env.TIKTOK_ADS_ACCESS_TOKEN = "tiktok-token";
  process.env.TIKTOK_API_VERSION = "v1.3";
}

beforeEach(() => {
  jest.clearAllMocks();
  configurar();
  global.fetch = jest.fn();
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  global.fetch = originalFetch;
});

describe("Pinterest Ads", () => {
  test("testa conexão sem expor token", async () => {
    global.fetch.mockResolvedValueOnce(response({
      id: "549768356618",
      name: "Agenda Fashion Pinterest",
      currency: "BRL",
      timezone: "America/Sao_Paulo"
    }));

    const result = await providers.testarConexao("pinterest_ads");

    expect(result).toEqual({
      provedor: "pinterest_ads",
      conectado: true,
      contaExternaId: "549768356618",
      nomeConta: "Agenda Fashion Pinterest",
      moeda: "BRL",
      fusoHorario: "America/Sao_Paulo",
      apiVersion: "v5"
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.pinterest.com/v5/ad_accounts/549768356618");
    expect(options.headers.Authorization).toBe("Bearer pinterest-token");
    expect(url).not.toContain("pinterest-token");
  });

  test("lista campanhas com paginação e ignora arquivadas", async () => {
    global.fetch
      .mockResolvedValueOnce(response({
        items: [
          {
            id: "101",
            ad_account_id: "549768356618",
            name: "Pinterest Agenda",
            status: "ACTIVE",
            objective_type: "TRAFFIC"
          }
        ],
        bookmark: "proxima"
      }))
      .mockResolvedValueOnce(response({
        items: [
          {
            id: "102",
            ad_account_id: "549768356618",
            name: "Antiga",
            status: "ARCHIVED",
            objective_type: "AWARENESS"
          }
        ]
      }));

    await expect(providers.listarCampanhas("pinterest_ads")).resolves.toEqual([
      {
        contaExternaId: "549768356618",
        campanhaExternaId: "101",
        campanhaExternaNome: "Pinterest Agenda",
        status: "ACTIVE",
        tipo: "TRAFFIC"
      }
    ]);
    expect(global.fetch.mock.calls[1][0]).toContain("bookmark=proxima");
  });

  test("converte micro moeda do Pinterest para centavos", async () => {
    global.fetch
      .mockResolvedValueOnce(response({
        items: [
          {
            id: "101",
            ad_account_id: "549768356618",
            name: "Pinterest Agenda",
            status: "ACTIVE",
            objective_type: "TRAFFIC"
          }
        ]
      }))
      .mockResolvedValueOnce(response([
        {
          CAMPAIGN_ID: "101",
          DATE: "2026-08-10",
          SPEND_IN_MICRO_DOLLAR: 1250000
        }
      ]));

    const result = await providers.listarCustos("pinterest_ads", {
      dataInicio: "2026-08-01",
      dataFim: "2026-08-10"
    });

    expect(result[0]).toMatchObject({
      campanhaExternaId: "101",
      dataGasto: "2026-08-10",
      valorCentavos: 125
    });
    const analyticsUrl = global.fetch.mock.calls[1][0];
    expect(analyticsUrl).toContain("campaigns/analytics");
    expect(analyticsUrl).toContain("granularity=DAY");
    expect(analyticsUrl).toContain("SPEND_IN_MICRO_DOLLAR");
  });
});

describe("TikTok Ads", () => {
  test("testa conexão pelo advertiser e usa Access-Token", async () => {
    global.fetch.mockResolvedValueOnce(response({
      code: 0,
      message: "OK",
      data: {
        list: [
          {
            advertiser_id: "7488990011223344556",
            advertiser_name: "Agenda Fashion TikTok",
            currency: "BRL",
            timezone: "America/Sao_Paulo"
          }
        ]
      }
    }));

    const result = await providers.testarConexao("tiktok_ads");

    expect(result).toEqual({
      provedor: "tiktok_ads",
      conectado: true,
      contaExternaId: "7488990011223344556",
      nomeConta: "Agenda Fashion TikTok",
      moeda: "BRL",
      fusoHorario: "America/Sao_Paulo",
      apiVersion: "v1.3"
    });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("/open_api/v1.3/advertiser/info/");
    expect(options.headers["Access-Token"]).toBe("tiktok-token");
    expect(url).not.toContain("tiktok-token");
  });

  test("lista campanha real e converte spend para centavos", async () => {
    global.fetch
      .mockResolvedValueOnce(response({
        code: 0,
        message: "OK",
        data: {
          list: [
            {
              campaign_id: "2001",
              campaign_name: "TikTok Profissionais",
              operation_status: "ENABLE",
              objective_type: "TRAFFIC"
            }
          ],
          page_info: { total_page: 1 }
        }
      }))
      .mockResolvedValueOnce(response({
        code: 0,
        message: "OK",
        data: {
          list: [
            {
              dimensions: {
                campaign_id: "2001",
                stat_time_day: "2026-08-10 00:00:00"
              },
              metrics: { spend: "12.34" }
            }
          ],
          page_info: { total_page: 1 }
        }
      }));

    const result = await providers.listarCustos("tiktok_ads", {
      dataInicio: "2026-08-01",
      dataFim: "2026-08-10"
    });

    expect(result).toEqual([
      {
        contaExternaId: "7488990011223344556",
        campanhaExternaId: "2001",
        campanhaExternaNome: "TikTok Profissionais",
        dataGasto: "2026-08-10",
        valorCentavos: 1234
      }
    ]);
    expect(global.fetch.mock.calls[1][0]).toContain("/report/integrated/get/");
    expect(global.fetch.mock.calls[1][0]).toContain("AUCTION_CAMPAIGN");
  });

  test("trata erro da API mesmo com HTTP 200", async () => {
    global.fetch.mockResolvedValueOnce(response({
      code: 40001,
      message: "Access token is invalid"
    }));

    await expect(
      providers.testarConexao("tiktok_ads")
    ).rejects.toThrow("Access token is invalid");
  });
});
