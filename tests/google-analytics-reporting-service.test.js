const mockGetAccessToken = jest.fn();
const mockGetClient = jest.fn();
const mockGoogleAuth = jest.fn();

jest.mock("google-auth-library", () => ({
  GoogleAuth: mockGoogleAuth
}));

jest.mock("../src/utils/registrador", () => ({
  aviso: jest.fn()
}));

const service = require(
  "../src/services/googleAnalyticsReportingService"
);

const originalFetch = global.fetch;

function env(overrides = {}) {
  return {
    GA4_DATA_API_ENABLED: "true",
    GA4_PROPERTY_ID: "123456789",
    GA4_SERVICE_ACCOUNT_EMAIL:
      "ga4-reader@agenda-fashion.iam.gserviceaccount.com",
    GA4_SERVICE_ACCOUNT_PRIVATE_KEY:
      "-----BEGIN PRIVATE KEY-----\\nTEST_ONLY_NOT_A_REAL_KEY\\n-----END PRIVATE KEY-----\\n",
    GA4_DATA_API_TIMEOUT_MS: "5000",
    ...overrides
  };
}

function report({ dimensions = [], metrics = [], rows = [], metadata = {} }) {
  return {
    dimensionHeaders: dimensions.map((name) => ({ name })),
    metricHeaders: metrics.map((name) => ({ name })),
    rows: rows.map(({ d = [], m = [] }) => ({
      dimensionValues: d.map((value) => ({ value: String(value) })),
      metricValues: m.map((value) => ({ value: String(value) }))
    })),
    metadata
  };
}

describe("googleAnalyticsReportingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockGetAccessToken.mockResolvedValue({ token: "token-ga4" });
    mockGetClient.mockResolvedValue({
      getAccessToken: mockGetAccessToken
    });
    mockGoogleAuth.mockImplementation(() => ({
      getClient: mockGetClient
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("fica inerte quando a leitura administrativa está desligada", async () => {
    const result = await service.buscarPainel({
      periodo: "30",
      agora: new Date("2026-08-28T15:00:00Z"),
      env: env({ GA4_DATA_API_ENABLED: "false" })
    });

    expect(result).toMatchObject({
      habilitado: false,
      configurado: false,
      motivo: "desabilitado"
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("não consulta a API com credenciais incompletas", async () => {
    const result = await service.buscarPainel({
      periodo: "7",
      agora: new Date("2026-08-28T15:00:00Z"),
      env: env({ GA4_PROPERTY_ID: "G-ABC123" })
    });

    expect(result).toMatchObject({
      habilitado: true,
      configurado: false,
      motivo: "configuracao_incompleta"
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("normaliza período pelo fuso do relatório", () => {
    expect(service.normalizarPeriodo(
      "7",
      new Date("2026-08-29T01:30:00Z"),
      env()
    )).toEqual({
      periodo: "7",
      dataInicio: "2026-08-22",
      dataFim: "2026-08-28"
    });
  });

  test("usa landingPage sem query string no lote de relatórios", () => {
    const requests = service.montarRequests({
      dataInicio: "2026-08-01",
      dataFim: "2026-08-28"
    });
    const dimensions = requests.flatMap((item) =>
      (item.dimensions || []).map((itemDimension) => itemDimension.name)
    );

    expect(dimensions).toContain("landingPage");
    expect(dimensions).not.toContain("landingPagePlusQueryString");
    expect(dimensions).toContain("sessionCampaignId");
    expect(dimensions).toContain("sessionDefaultChannelGroup");
    expect(requests).toHaveLength(5);

    const location = service.montarLocationRequest({
      dataInicio: "2026-08-01",
      dataFim: "2026-08-28"
    });
    expect(location.dimensions.map((item) => item.name)).toEqual([
      "country",
      "region",
      "city"
    ]);
  });

  test("consulta a Data API e devolve DTO seguro para o admin", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reports: [
            report({
              metrics: [
                "sessions",
                "totalUsers",
                "newUsers",
                "engagedSessions",
                "engagementRate",
                "screenPageViews"
              ],
              rows: [{ m: [100, 80, 40, 60, 0.6, 250] }],
              metadata: {
                currencyCode: "BRL",
                timeZone: "America/Sao_Paulo"
              }
            }),
            report({
              dimensions: [
                "sessionDefaultChannelGroup",
                "sessionSource",
                "sessionMedium"
              ],
              metrics: [
                "sessions",
                "totalUsers",
                "newUsers",
                "engagedSessions"
              ],
              rows: [{ d: ["Paid Search", "google", "cpc"], m: [55, 44, 20, 35] }]
            }),
            report({
              dimensions: [
                "sessionCampaignId",
                "sessionCampaignName",
                "sessionSource",
                "sessionMedium"
              ],
              metrics: [
                "sessions",
                "totalUsers",
                "newUsers",
                "engagedSessions"
              ],
              rows: [{ d: ["987", "Profissionais", "google", "cpc"], m: [50, 40, 18, 32] }]
            }),
            report({
              dimensions: ["landingPage"],
              metrics: ["sessions", "totalUsers", "engagedSessions"],
              rows: [{ d: ["/para-profissionais"], m: [70, 58, 45] }]
            }),
            report({
              dimensions: ["deviceCategory"],
              metrics: ["sessions", "totalUsers"],
              rows: [{ d: ["mobile"], m: [75, 60] }]
            })
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => report({
          dimensions: ["country", "region", "city"],
          metrics: ["sessions", "totalUsers"],
          rows: [{ d: ["Brazil", "Goiás", "Goiânia"], m: [42, 35] }]
        })
      });

    const result = await service.buscarPainel({
      periodo: "30",
      agora: new Date("2026-08-28T15:00:00Z"),
      env: env()
    });

    expect(mockGoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: expect.objectContaining({
          client_email:
            "ga4-reader@agenda-fashion.iam.gserviceaccount.com",
          private_key: expect.stringContaining("\nTEST_ONLY_NOT_A_REAL_KEY\n")
        }),
        scopes: [
          "https://www.googleapis.com/auth/analytics.readonly"
        ]
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "https://analyticsdata.googleapis.com/v1beta/properties/123456789:batchRunReports",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-ga4"
        })
      })
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport",
      expect.objectContaining({ method: "POST" })
    );
    expect(result).toMatchObject({
      configurado: true,
      resumo: {
        sessoes: 100,
        usuarios: 80,
        novosUsuarios: 40,
        sessoesEngajadas: 60,
        taxaEngajamentoPercentual: 60,
        visualizacoes: 250
      },
      canais: [
        expect.objectContaining({
          canal: "Paid Search",
          origem: "google",
          midia: "cpc",
          sessoes: 55
        })
      ],
      campanhas: [
        expect.objectContaining({
          id: "987",
          nome: "Profissionais"
        })
      ],
      landingPages: [
        expect.objectContaining({
          pagina: "/para-profissionais"
        })
      ],
      dispositivos: [
        expect.objectContaining({
          categoria: "mobile"
        })
      ],
      localidades: [
        expect.objectContaining({
          pais: "Brazil",
          regiao: "Goiás",
          cidade: "Goiânia",
          sessoes: 42
        })
      ]
    });
  });

  test("não vaza segredo quando a Data API falha", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403 });

    await expect(service.buscarPainel({
      periodo: "30",
      env: env({
        GA4_SERVICE_ACCOUNT_PRIVATE_KEY:
          "-----BEGIN PRIVATE KEY-----\\nTEST_SECRET_MUST_NOT_LEAK\\n-----END PRIVATE KEY-----"
      })
    })).rejects.toThrow(
      "Não foi possível consultar o Google Analytics agora."
    );
  });
});
