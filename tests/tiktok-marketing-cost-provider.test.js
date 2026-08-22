const mockOAuth = {
  obterAccessTokenValido: jest.fn(),
  statusAutorizacao: jest.fn(),
  configuracaoOAuthDisponivel: jest.fn()
};

jest.mock(
  "../src/services/tiktokOAuthService",
  () => mockOAuth
);

const provider = require("../src/services/tiktokMarketingCostProvider");

const ENV_KEYS = [
  "TIKTOK_ADS_COSTS_ENABLED",
  "TIKTOK_ADVERTISER_ID",
  "TIKTOK_API_VERSION",
  "TIKTOK_ADS_ACCESS_TOKEN"
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

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TIKTOK_ADS_COSTS_ENABLED = "true";
  process.env.TIKTOK_ADVERTISER_ID = "7673281927140098056";
  process.env.TIKTOK_API_VERSION = "v1.3";
  delete process.env.TIKTOK_ADS_ACCESS_TOKEN;
  mockOAuth.obterAccessTokenValido.mockResolvedValue("oauth-access-token");
  mockOAuth.configuracaoOAuthDisponivel.mockReturnValue(true);
  mockOAuth.statusAutorizacao.mockResolvedValue({
    disponivel: true,
    autorizado: true,
    fonte: "oauth",
    accessTokenExpiresAt: new Date(Date.now() + 3600000),
    refreshTokenExpiresAt: new Date(Date.now() + 86400000)
  });
  global.fetch = jest.fn();
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  global.fetch = originalFetch;
});

test("testa a conta usando Access-Token no header e nunca na URL", async () => {
  global.fetch.mockResolvedValueOnce(response({
    code: 0,
    message: "OK",
    data: {
      list: [
        {
          advertiser_id: "7673281927140098056",
          advertiser_name: "Agenda Fashion",
          currency: "BRL",
          timezone: "America/Sao_Paulo"
        }
      ]
    }
  }));

  await expect(provider.testarConexao()).resolves.toMatchObject({
    provedor: "tiktok_ads",
    conectado: true,
    contaExternaId: "7673281927140098056",
    moeda: "BRL",
    apiVersion: "v1.3"
  });

  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain("/open_api/v1.3/advertiser/info/");
  expect(url).not.toContain("oauth-access-token");
  expect(options.headers["Access-Token"]).toBe("oauth-access-token");
});

test("lista campanhas reais da conta e normaliza status", async () => {
  global.fetch.mockResolvedValueOnce(response({
    code: 0,
    data: {
      list: [
        {
          campaign_id: "123456",
          campaign_name: "TikTok Profissionais",
          operation_status: "ENABLE",
          objective_type: "TRAFFIC"
        }
      ],
      page_info: { total_page: 1 }
    }
  }));

  await expect(provider.listarCampanhas()).resolves.toEqual([
    {
      contaExternaId: "7673281927140098056",
      campanhaExternaId: "123456",
      campanhaExternaNome: "TikTok Profissionais",
      status: "ENABLE",
      tipo: "TRAFFIC"
    }
  ]);
});

test("converte spend decimal para centavos por campanha e dia", async () => {
  global.fetch
    .mockResolvedValueOnce(response({
      code: 0,
      data: {
        list: [
          {
            campaign_id: "123456",
            campaign_name: "TikTok Profissionais",
            operation_status: "ENABLE"
          }
        ],
        page_info: { total_page: 1 }
      }
    }))
    .mockResolvedValueOnce(response({
      code: 0,
      data: {
        list: [
          {
            dimensions: {
              campaign_id: "123456",
              stat_time_day: "2026-08-12 00:00:00"
            },
            metrics: {
              spend: "12.345"
            }
          }
        ],
        page_info: { total_page: 1 }
      }
    }));

  await expect(provider.listarCustos({
    dataInicio: "2026-08-01",
    dataFim: "2026-08-12"
  })).resolves.toEqual([
    {
      contaExternaId: "7673281927140098056",
      campanhaExternaId: "123456",
      campanhaExternaNome: "TikTok Profissionais",
      dataGasto: "2026-08-12",
      valorCentavos: 1235
    }
  ]);
});

test("trata erro semântico do TikTok mesmo quando HTTP é 200", async () => {
  global.fetch.mockResolvedValueOnce(response({
    code: 40100,
    message: "Access token invalid"
  }));

  await expect(provider.testarConexao()).rejects.toThrow(
    "Access token invalid"
  );
});

test("status não consulta persistência OAuth quando TikTok não está configurado", async () => {
  process.env.TIKTOK_ADS_COSTS_ENABLED = "false";
  delete process.env.TIKTOK_ADVERTISER_ID;
  mockOAuth.configuracaoOAuthDisponivel.mockReturnValue(false);

  await expect(provider.status()).resolves.toMatchObject({
    provedor: "tiktok_ads",
    habilitado: false,
    configurado: false,
    autorizacao: {
      disponivel: false,
      autorizado: false
    }
  });

  expect(mockOAuth.statusAutorizacao).not.toHaveBeenCalled();
});
