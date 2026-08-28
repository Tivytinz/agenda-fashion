jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao:
      jest.fn(),
  })
);

jest.mock(
  "../src/repositories/marketingCanonicalCleanupRepository",
  () => ({
    CAMPANHAS_LEGADAS: [
      "aquisicao_profissionais",
      "search_aquisicao_profissionais",
      "profissionais_google_ads",
    ],
    garantirCampanhaGoogleProfissionais:
      jest.fn(),
  })
);

jest.mock(
  "../src/repositories/marketingAttributionRecoveryRepository",
  () => ({
    recuperarGoogleProfissionaisPorEventos:
      jest.fn(),
  })
);

const db = require(
  "../src/db/db"
);
const cleanupRepository = require(
  "../src/repositories/marketingCanonicalCleanupRepository"
);
const recoveryRepository = require(
  "../src/repositories/marketingAttributionRecoveryRepository"
);
const service = require(
  "../src/services/marketingCanonicalCleanupService"
);

describe(
  "limpeza canônica de marketing",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "mantém evidência bruta intacta e limita a rotina a metadados e recuperação conservadora",
      async () => {
        const client = {
          query: jest.fn(),
        };

        db.executarTransacao
          .mockImplementation(
            (callback) => callback(client)
          );

        cleanupRepository
          .garantirCampanhaGoogleProfissionais
          .mockResolvedValue({
            rows: [{ id: 42 }],
            rowCount: 1,
          });

        recoveryRepository
          .recuperarGoogleProfissionaisPorEventos
          .mockResolvedValue({
            rows: [],
            rowCount: 3,
          });

        const resultado =
          await service
            .executarLimpezaGoogleProfissionais();

        expect(
          cleanupRepository
            .garantirCampanhaGoogleProfissionais
        ).toHaveBeenCalledWith({
          client,
          campanhaOficial:
            "google_ads_profissionais",
        });

        expect(
          recoveryRepository
            .recuperarGoogleProfissionaisPorEventos
        ).toHaveBeenCalledWith({
          client,
          campanhaOficial:
            "google_ads_profissionais",
          campanhasAceitas: [
            "google_ads_profissionais",
            "aquisicao_profissionais",
            "search_aquisicao_profissionais",
            "profissionais_google_ads",
          ],
        });

        expect(client.query)
          .not.toHaveBeenCalled();

        expect(resultado).toEqual({
          campanhaOficialId: 42,
          campanhasApagadas: 0,
          gastosRemovidos: 0,
          vinculosRemovidos: 0,
          atribuicoesComGclidPreservadas: 0,
          atribuicoesLimpas: 0,
          atribuicoesRecuperadasDeEventos: 3,
          eventosComGclidPreservados: 0,
          eventosComSinalGooglePreservados: 0,
          eventosLimpos: 0,
        });
      }
    );
  }
);
