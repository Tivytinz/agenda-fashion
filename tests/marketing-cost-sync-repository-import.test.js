const mockDb = {
  query: jest.fn(),
  connect: jest.fn(),
  executarTransacao: jest.fn()
};

jest.mock(
  "../src/db/db",
  () => mockDb
);

const repository = require(
  "../src/repositories/marketingCostSyncRepository"
);

describe("marketingCostSyncRepository importação transacional", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("cria campanha e vínculo dentro da mesma transação", async () => {
    const client = {
      query: jest.fn()
    };

    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 22,
            nome: "Profissionais Goiás",
            canal: "google",
            objetivo: "indefinido",
            ativo: true,
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign: "999"
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 31,
            campanha_id: 22,
            provedor: "google_ads",
            conta_externa_id: "6770207927",
            campanha_externa_id: "999",
            campanha_externa_nome: "Profissionais Goiás"
          }
        ]
      });

    mockDb.executarTransacao.mockImplementation(
      async (callback) => callback(client)
    );

    const result =
      await repository.garantirCampanhaImportadaComVinculo({
        nome: "Profissionais Goiás",
        canal: "google",
        objetivo: "indefinido",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "999",
        utmContent: null,
        utmTerm: null,
        destinoPath: "/",
        ativo: true,
        criadoPorUsuarioId: 9,
        provedor: "google_ads",
        contaExternaId: "6770207927",
        campanhaExternaId: "999",
        campanhaExternaNome: "Profissionais Goiás"
      });

    expect(mockDb.executarTransacao).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      campanhaCriada: true,
      vinculoCriado: true,
      campanha: {
        id: 22,
        objetivo: "indefinido"
      },
      vinculo: {
        campanha_id: 22,
        campanha_externa_id: "999"
      }
    });

    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO marketing_campanhas")
      )
    ).toBe(true);
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO marketing_campanha_vinculos")
      )
    ).toBe(true);
  });

  test("não reativa nem religa automaticamente campanha arquivada", async () => {
    const client = {
      query: jest.fn()
    };

    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 22,
            nome: "Campanha arquivada",
            canal: "google",
            objetivo: "profissional",
            ativo: false,
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign: "999"
          }
        ]
      });

    mockDb.executarTransacao.mockImplementation(
      async (callback) => callback(client)
    );

    const result =
      await repository.garantirCampanhaImportadaComVinculo({
        nome: "Campanha ativa na plataforma",
        canal: "google",
        objetivo: "indefinido",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "999",
        utmContent: null,
        utmTerm: null,
        destinoPath: "/",
        ativo: true,
        criadoPorUsuarioId: 9,
        provedor: "google_ads",
        contaExternaId: "6770207927",
        campanhaExternaId: "999",
        campanhaExternaNome: "Campanha ativa na plataforma"
      });

    expect(result).toMatchObject({
      conflito: true,
      motivo: "campanha_interna_arquivada",
      vinculo: null
    });

    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO marketing_campanha_vinculos")
      )
    ).toBe(false);
  });
});
