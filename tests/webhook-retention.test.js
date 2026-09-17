jest.mock(
  "../src/repositories/webhookRetentionRepository",
  () => ({
    redigirEventosFinalizadosAntigos:
      jest.fn(),
  })
);

const webhookRetentionRepository =
  require(
    "../src/repositories/webhookRetentionRepository"
  );
const webhookRetentionService =
  require(
    "../src/services/webhookRetentionService"
  );

describe(
  "Retenção de payloads de webhook",
  () => {
    const valorOriginal =
      process.env
        .WEBHOOK_RETENTION_DAYS;

    beforeEach(() => {
      jest.clearAllMocks();
      delete process.env
        .WEBHOOK_RETENTION_DAYS;

      webhookRetentionRepository
        .redigirEventosFinalizadosAntigos
        .mockResolvedValue(3);
    });

    afterAll(() => {
      if (
        valorOriginal === undefined
      ) {
        delete process.env
          .WEBHOOK_RETENTION_DAYS;
      } else {
        process.env
          .WEBHOOK_RETENTION_DAYS =
          valorOriginal;
      }
    });

    test(
      "usa 180 dias por padrão",
      async () => {
        const resultado =
          await webhookRetentionService
            .executarSeNecessario({
              forcar: true,
              agora:
                Date.UTC(
                  2026,
                  8,
                  17
                ),
            });

        expect(
          webhookRetentionRepository
            .redigirEventosFinalizadosAntigos
        ).toHaveBeenCalledWith(180);
        expect(resultado).toEqual({
          executada: true,
          redigidos: 3,
          diasRetencao: 180,
        });
      }
    );

    test(
      "aceita período configurado dentro dos limites",
      async () => {
        process.env
          .WEBHOOK_RETENTION_DAYS =
          "365";

        await webhookRetentionService
          .executarSeNecessario({
            forcar: true,
          });

        expect(
          webhookRetentionRepository
            .redigirEventosFinalizadosAntigos
        ).toHaveBeenCalledWith(365);
      }
    );

    test(
      "ignora configuração fora do intervalo seguro",
      () => {
        process.env
          .WEBHOOK_RETENTION_DAYS =
          "10";

        expect(
          webhookRetentionService
            .obterDiasRetencaoWebhooks()
        ).toBe(180);
      }
    );

    test(
      "executa no máximo uma vez por dia sem forçar",
      () => {
        const agora =
          Date.UTC(
            2026,
            8,
            17
          );

        expect(
          webhookRetentionService
            .deveExecutarRetencao({
              agora,
              ultimaTentativa:
                agora -
                60 * 60 * 1000,
            })
        ).toBe(false);

        expect(
          webhookRetentionService
            .deveExecutarRetencao({
              agora,
              ultimaTentativa:
                agora -
                24 * 60 * 60 * 1000,
            })
        ).toBe(true);
      }
    );

    test(
      "propaga falha de banco para o worker decidir como registrar",
      async () => {
        webhookRetentionRepository
          .redigirEventosFinalizadosAntigos
          .mockRejectedValueOnce(
            new Error(
              "Banco indisponível"
            )
          );

        await expect(
          webhookRetentionService
            .executarSeNecessario({
              forcar: true,
            })
        ).rejects.toThrow(
          "Banco indisponível"
        );
      }
    );
  }
);
