const providers = require("../src/services/marketingCostProviders");

const ENV_KEYS = [
  "GOOGLE_ADS_COSTS_ENABLED",
  "GOOGLE_ADS_CUSTOMER_ID",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
  "GOOGLE_ADS_API_VERSION",
  "META_ADS_COSTS_ENABLED",
  "META_AD_ACCOUNT_ID",
  "META_MARKETING_ACCESS_TOKEN",
  "META_GRAPH_API_VERSION"
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

function configurarGoogle() {
  process.env.GOOGLE_ADS_COSTS_ENABLED = "true";
  process.env.GOOGLE_ADS_CUSTOMER_ID = "677-020-7927";
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer-token";
  process.env.GOOGLE_ADS_CLIENT_ID = "client-id";
  process.env.GOOGLE_ADS_CLIENT_SECRET = "client-secret";
  process.env.GOOGLE_ADS_REFRESH_TOKEN = "refresh-token";
  process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = "123-456-7890";
  process.env.GOOGLE_ADS_API_VERSION = "v25";
}

function configurarMeta() {
  process.env.META_ADS_COSTS_ENABLED = "true";
  process.env.META_AD_ACCOUNT_ID = "act_1122334455";
  process.env.META_MARKETING_ACCESS_TOKEN = "marketing-token";
  process.env.META_GRAPH_API_VERSION = "v25.0";
}

beforeEach(() => {
  jest.clearAllMocks();
  configurarGoogle();
  configurarMeta();
  global.fetch = jest.fn();
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  global.fetch = originalFetch;
});

describe("marketingCostProviders Google Ads", () => {
  test("testa a conexão e identifica a conta sem expor credenciais", async () => {
    global.fetch
      .mockResolvedValueOnce(response({ access_token: "access-token" }))
      .mockResolvedValueOnce(response([
        {
          results: [
            {
              customer: {
                id: "6770207927",
                descriptiveName: "Agenda Fashion Ads",
                currencyCode: "BRL",
                timeZone: "America/Sao_Paulo"
              }
            }
          ]
        }
      ]));

    const result = await providers.testarConexao("google_ads");

    expect(result).toEqual({
      provedor: "google_ads",
      conectado: true,
      contaExternaId: "6770207927",
      nomeConta: "Agenda Fashion Ads",
      moeda: "BRL",
      fusoHorario: "America/Sao_Paulo",
      apiVersion: "v25"
    });

    const query = JSON.parse(global.fetch.mock.calls[1][1].body).query;
    expect(query).toContain("customer.descriptive_name");
    expect(query).toContain("customer.currency_code");
    expect(query).toContain("customer.time_zone");
    expect(JSON.stringify(result)).not.toContain("developer-token");
    expect(JSON.stringify(result)).not.toContain("refresh-token");
    expect(JSON.stringify(result)).not.toContain("client-secret");
  });

  test("lista campanhas reais sem expor credenciais no resultado", async () => {
    global.fetch
      .mockResolvedValueOnce(response({ access_token: "access-token" }))
      .mockResolvedValueOnce(response([
        {
          results: [
            {
              campaign: {
                id: "555",
                name: "Aquisição Goiânia",
                status: "ENABLED",
                advertisingChannelType: "SEARCH"
              }
            },
            {
              campaign: {
                id: "777",
                name: "Marca",
                status: "PAUSED",
                advertisingChannelType: "PERFORMANCE_MAX"
              }
            }
          ]
        }
      ]));

    const result = await providers.listarCampanhas("google_ads");

    expect(result).toEqual([
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "555",
        campanhaExternaNome: "Aquisição Goiânia",
        status: "ENABLED",
        tipo: "SEARCH"
      },
      {
        contaExternaId: "6770207927",
        campanhaExternaId: "777",
        campanhaExternaNome: "Marca",
        status: "PAUSED",
        tipo: "PERFORMANCE_MAX"
      }
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect(global.fetch.mock.calls[1][0]).toBe(
      "https://googleads.googleapis.com/v25/customers/6770207927/googleAds:searchStream"
    );

    const googleOptions = global.fetch.mock.calls[1][1];
    expect(googleOptions.headers).toMatchObject({
      Authorization: "Bearer access-token",
      "developer-token": "developer-token",
      "login-customer-id": "1234567890"
    });
    expect(JSON.parse(googleOptions.body).query).toContain(
      "campaign.advertising_channel_type"
    );
    expect(JSON.stringify(result)).not.toContain("developer-token");
    expect(JSON.stringify(result)).not.toContain("refresh-token");
  });

  test("busca uma campanha específica para validar o vínculo", async () => {
    global.fetch
      .mockResolvedValueOnce(response({ access_token: "access-token" }))
      .mockResolvedValueOnce(response([
        {
          results: [
            {
              campaign: {
                id: "555",
                name: "Aquisição real",
                status: "ENABLED",
                advertisingChannelType: "SEARCH"
              }
            }
          ]
        }
      ]));

    const result = await providers.buscarCampanha("google_ads", "5-5-5");

    expect(result).toMatchObject({
      contaExternaId: "6770207927",
      campanhaExternaId: "555",
      campanhaExternaNome: "Aquisição real",
      status: "ENABLED",
      tipo: "SEARCH"
    });

    const query = JSON.parse(global.fetch.mock.calls[1][1].body).query;
    expect(query).toContain("WHERE campaign.id = 555");
    expect(query).toContain("campaign.status != 'REMOVED'");
  });

  test("não consulta a API se a integração estiver incompleta", async () => {
    process.env.GOOGLE_ADS_REFRESH_TOKEN = "";

    await expect(
      providers.listarCampanhas("google_ads")
    ).rejects.toThrow("ainda não está configurada");

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("marketingCostProviders Meta Ads", () => {
  test("testa a conexão e identifica a conta sem expor o token", async () => {
    global.fetch.mockResolvedValueOnce(response({
      id: "act_1122334455",
      name: "Agenda Fashion Meta",
      currency: "BRL",
      timezone_name: "America/Sao_Paulo",
      account_status: 1
    }));

    const result = await providers.testarConexao("meta_ads");

    expect(result).toEqual({
      provedor: "meta_ads",
      conectado: true,
      contaExternaId: "1122334455",
      nomeConta: "Agenda Fashion Meta",
      moeda: "BRL",
      fusoHorario: "America/Sao_Paulo",
      apiVersion: "v25.0"
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("https://graph.facebook.com/v25.0/act_1122334455");
    expect(url).toContain("fields=id%2Cname%2Ccurrency%2Ctimezone_name%2Caccount_status");
    expect(options.headers).toEqual({ Authorization: "Bearer marketing-token" });
    expect(url).not.toContain("marketing-token");
    expect(JSON.stringify(result)).not.toContain("marketing-token");
  });

  test("lista campanhas reais com paginação e ignora campanhas excluídas", async () => {
    global.fetch
      .mockResolvedValueOnce(response({
        data: [
          {
            id: "901",
            name: "Profissionais Meta",
            account_id: "1122334455",
            status: "ACTIVE",
            effective_status: "ACTIVE",
            objective: "OUTCOME_TRAFFIC"
          },
          {
            id: "902",
            name: "Marca pausada",
            account_id: "1122334455",
            status: "PAUSED",
            effective_status: "PAUSED",
            objective: "OUTCOME_AWARENESS"
          }
        ],
        paging: {
          cursors: { after: "cursor-1" },
          next: "https://graph.facebook.com/next"
        }
      }))
      .mockResolvedValueOnce(response({
        data: [
          {
            id: "903",
            name: "Campanha excluída",
            account_id: "1122334455",
            status: "DELETED",
            effective_status: "DELETED",
            objective: "OUTCOME_TRAFFIC"
          }
        ],
        paging: {}
      }));

    const result = await providers.listarCampanhas("meta_ads");

    expect(result).toEqual([
      {
        contaExternaId: "1122334455",
        campanhaExternaId: "902",
        campanhaExternaNome: "Marca pausada",
        status: "PAUSED",
        tipo: "OUTCOME_AWARENESS"
      },
      {
        contaExternaId: "1122334455",
        campanhaExternaId: "901",
        campanhaExternaNome: "Profissionais Meta",
        status: "ACTIVE",
        tipo: "OUTCOME_TRAFFIC"
      }
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toContain("/v25.0/act_1122334455/campaigns?");
    expect(global.fetch.mock.calls[1][0]).toContain("after=cursor-1");
    for (const [, options] of global.fetch.mock.calls) {
      expect(options.headers).toEqual({ Authorization: "Bearer marketing-token" });
    }
  });

  test("busca campanha específica e confirma que pertence à conta configurada", async () => {
    global.fetch.mockResolvedValueOnce(response({
      id: "999",
      name: "Aquisição Meta",
      account_id: "1122334455",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      objective: "OUTCOME_TRAFFIC"
    }));

    const result = await providers.buscarCampanha("meta_ads", "9-9-9");

    expect(result).toEqual({
      contaExternaId: "1122334455",
      campanhaExternaId: "999",
      campanhaExternaNome: "Aquisição Meta",
      status: "ACTIVE",
      tipo: "OUTCOME_TRAFFIC"
    });
    expect(global.fetch.mock.calls[0][0]).toContain("/v25.0/999?");
  });

  test("recusa campanha de outra conta Meta", async () => {
    global.fetch.mockResolvedValueOnce(response({
      id: "999",
      name: "Outra conta",
      account_id: "9988776655",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      objective: "OUTCOME_TRAFFIC"
    }));

    await expect(
      providers.buscarCampanha("meta_ads", "999")
    ).rejects.toThrow("Campanha não encontrada na conta configurada");
  });

  test("não consulta a API Meta se a integração estiver incompleta", async () => {
    process.env.META_MARKETING_ACCESS_TOKEN = "";

    await expect(
      providers.testarConexao("meta_ads")
    ).rejects.toThrow("ainda não está configurada");

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
