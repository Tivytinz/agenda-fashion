jest.mock(
  "../scripts/migrate",
  () => ({
    main:
      jest.fn(),
  })
);

const {
  main,
} = require(
  "../scripts/migrate"
);

const {
  executarDeploy,
} = require(
  "../scripts/migrate-deploy"
);

describe(
  "Migration automática da Railway",
  () => {
    const ambienteOriginal =
      process.env
        .RAILWAY_ENVIRONMENT_NAME;

    afterAll(() => {
      if (
        ambienteOriginal ===
        undefined
      ) {
        delete process.env
          .RAILWAY_ENVIRONMENT_NAME;
      } else {
        process.env
          .RAILWAY_ENVIRONMENT_NAME =
          ambienteOriginal;
      }
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "bloqueia execução fora de production",
      async () => {
        process.env
          .RAILWAY_ENVIRONMENT_NAME =
          "staging";

        await expect(
          executarDeploy()
        ).rejects.toThrow(
          "bloqueada"
        );

        expect(
          main
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "executa somente migrations pendentes em production",
      async () => {
        process.env
          .RAILWAY_ENVIRONMENT_NAME =
          "production";

        main.mockResolvedValue();

        await executarDeploy();

        expect(
          process.env
            .MIGRATION_PRODUCTION_CONFIRMATION
        ).toBe(
          "agenda-fashion-production"
        );

        expect(
          main
        ).toHaveBeenCalledWith([
          "up",
          "--env",
          "production",
        ]);
      }
    );
  }
);
