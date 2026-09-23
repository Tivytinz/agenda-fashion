const mockPersistirCusto =
  jest.fn();
const mockPersistirCobertura =
  jest.fn();

jest.mock(
  "../src/repositories/contributionEconomicsRepository",
  () => ({
    persistirCusto:
      mockPersistirCusto,
    persistirCobertura:
      mockPersistirCobertura,
  })
);

const service = require(
  "../src/services/contributionEconomicsService"
);

describe(
  "Wave 29 - economia de contribuicao",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "aceita replay idempotente do mesmo custo",
      async () => {
        mockPersistirCusto
          .mockResolvedValue({
            fonteAusente: false,
            criado: false,
            registro: {
              id: 1,
              negocio_id: 7,
              chave_origem: "evt_1",
              tipo: "DEBITO",
              valor: "12.50",
              ocorrido_em:
                "2026-09-23T12:00:00.000Z",
              custo_referenciado_id:
                null,
            },
          });

        await expect(
          service
            .registrarCustoObservado({
              fonteCodigo:
                "provedor_variavel",
              negocioId: 7,
              chaveOrigem: "evt_1",
              tipo: "debito",
              valor: 12.5,
              ocorridoEm:
                "2026-09-23T12:00:00Z",
            })
        ).resolves.toMatchObject({
          id: 1,
          replay: true,
        });
      }
    );

    test(
      "recusa replay com valor diferente",
      async () => {
        mockPersistirCusto
          .mockResolvedValue({
            fonteAusente: false,
            criado: false,
            registro: {
              id: 1,
              negocio_id: 7,
              chave_origem: "evt_1",
              tipo: "DEBITO",
              valor: "10.00",
              ocorrido_em:
                "2026-09-23T12:00:00.000Z",
              custo_referenciado_id:
                null,
            },
          });

        await expect(
          service
            .registrarCustoObservado({
              fonteCodigo:
                "provedor_variavel",
              negocioId: 7,
              chaveOrigem: "evt_1",
              tipo: "DEBITO",
              valor: 12.5,
              ocorridoEm:
                "2026-09-23T12:00:00Z",
            })
        ).rejects.toThrow(
          "replay conflitante"
        );
      }
    );

    test(
      "nao aceita fonte inexistente como custo zero",
      async () => {
        mockPersistirCusto
          .mockResolvedValue({
            fonteAusente: true,
            criado: false,
            registro: null,
          });

        await expect(
          service
            .registrarCustoObservado({
              fonteCodigo:
                "fonte_ausente",
              negocioId: 7,
              chaveOrigem: "evt_2",
              tipo: "DEBITO",
              valor: 0,
              ocorridoEm:
                "2026-09-23T12:00:00Z",
            })
        ).rejects.toThrow(
          "fonte de contribuicao"
        );
      }
    );

    test(
      "recusa credito referenciando custo de outra fonte ou negocio",
      async () => {
        mockPersistirCusto
          .mockResolvedValue({
            fonteAusente: false,
            referenciaInvalida: true,
            criado: false,
            registro: null,
          });

        await expect(
          service
            .registrarCustoObservado({
              fonteCodigo:
                "provedor_variavel",
              negocioId: 7,
              chaveOrigem:
                "evt_credito_invalido",
              tipo: "CREDITO",
              valor: 2.5,
              ocorridoEm:
                "2026-09-23T12:00:00Z",
              custoReferenciadoId: 99,
            })
        ).rejects.toThrow(
          "referencia de custo invalida"
        );
      }
    );

    test(
      "recusa data de cobertura inexistente no calendario",
      async () => {
        await expect(
          service
            .registrarCoberturaFonte({
              fonteCodigo:
                "provedor_variavel",
              inicioCobertura:
                "2026-02-31",
              cobertoAte:
                "2026-03-01",
              status: "COMPLETA",
            })
        ).rejects.toThrow(
          "inicioCobertura invalido"
        );

        expect(
          mockPersistirCobertura
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "recusa cobertura regressiva",
      async () => {
        mockPersistirCobertura
          .mockResolvedValue({
            fonteAusente: false,
            registro: null,
          });

        await expect(
          service
            .registrarCoberturaFonte({
              fonteCodigo:
                "provedor_variavel",
              inicioCobertura:
                "2026-09-23",
              cobertoAte:
                "2026-09-30",
              status: "COMPLETA",
            })
        ).rejects.toThrow(
          "cobertura regressiva"
        );
      }
    );

    test(
      "valida intervalo antes do repository",
      async () => {
        await expect(
          service
            .registrarCoberturaFonte({
              fonteCodigo:
                "provedor_variavel",
              inicioCobertura:
                "2026-09-23",
              cobertoAte:
                "2026-09-22",
              status: "COMPLETA",
            })
        ).rejects.toThrow(
          "intervalo de cobertura invalido"
        );

        expect(
          mockPersistirCobertura
        ).not.toHaveBeenCalled();
      }
    );
  }
);
