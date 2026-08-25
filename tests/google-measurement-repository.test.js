jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn()
}));

jest.mock(
  "../src/repositories/marketingConversaoRepository",
  () => ({
    ehPrimeiroPagamentoAssinatura:
      jest.fn()
  })
);

const db = require("../src/db/db");
const repository = require(
  "../src/repositories/googleMeasurementRepository"
);

describe("Google Measurement repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("grava a escolha atual e o evento de auditoria na mesma transação", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            usuario_id: 7,
            google_consentimento_status: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
    };

    db.executarTransacao.mockImplementation(
      (callback) => callback(client)
    );

    const resultado = await repository
      .salvarConsentimentoUsuario({
        usuarioId: 7,
        consentido: false,
        clientId: "nao-deve-ser-salvo",
        origem: "NAVEGADOR",
        textoVersao: "2026-08-25"
      });

    expect(resultado).toMatchObject({
      usuario_id: 7,
      google_consentimento_status: false
    });
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[0][0])
      .toContain("google_revogado_em");
    expect(client.query.mock.calls[0][0])
      .toContain("last_gclid = CASE");
    expect(client.query.mock.calls[1][0])
      .toContain("marketing_google_consentimentos");
    expect(client.query.mock.calls[1][1])
      .toEqual([
        7,
        false,
        "NAVEGADOR",
        "2026-08-25"
      ]);
  });
});
