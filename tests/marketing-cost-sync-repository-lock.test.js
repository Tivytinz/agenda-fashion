const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock(
  "../src/db/db",
  () => ({
    connect: jest.fn(
      async () => mockClient
    ),
    query: jest.fn(),
    executarTransacao: jest.fn(),
  })
);

const repository = require(
  "../src/repositories/marketingCostSyncRepository"
);

describe(
  "lock distribuído da sincronização de custos",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "executa e libera o lock do provedor",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: [{ bloqueado: true }],
          })
          .mockResolvedValueOnce({
            rows: [{ pg_advisory_unlock: true }],
          });
        const callback = jest.fn(
          async () => "sincronizado"
        );

        await expect(
          repository
            .executarComLockSincronizacao(
              "google_ads",
              callback
            )
        ).resolves.toEqual({
          executado: true,
          resultado: "sincronizado",
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(mockClient.query)
          .toHaveBeenNthCalledWith(
            2,
            expect.stringContaining(
              "pg_advisory_unlock"
            ),
            [
              "agenda-fashion:marketing-cost-sync:google_ads",
            ]
          );
        expect(mockClient.release)
          .toHaveBeenCalledTimes(1);
      }
    );

    test(
      "não inicia a rotina quando outra instância possui o lock",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: [{ bloqueado: false }],
          });
        const callback = jest.fn();

        await expect(
          repository
            .executarComLockSincronizacao(
              "meta_ads",
              callback
            )
        ).resolves.toEqual({
          executado: false,
          resultado: null,
        });

        expect(callback).not.toHaveBeenCalled();
        expect(mockClient.query)
          .toHaveBeenCalledTimes(1);
        expect(mockClient.release)
          .toHaveBeenCalledTimes(1);
      }
    );
  }
);
