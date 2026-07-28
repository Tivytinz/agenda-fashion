describe(
  "Configuração segura do Asaas",
  () => {
    const ambienteOriginal = {
      nodeEnv:
        process.env.NODE_ENV,
      url:
        process.env.ASAAS_API_URL,
      chave:
        process.env.ASAAS_API_KEY,
      timeout:
        process.env
          .ASAAS_HTTP_TIMEOUT_MS
    };

    afterEach(() => {
      jest.resetModules();

      const restaurar = (
        nome,
        valor
      ) => {
        if (valor === undefined) {
          delete process.env[nome];
        } else {
          process.env[nome] =
            valor;
        }
      };

      restaurar(
        "NODE_ENV",
        ambienteOriginal.nodeEnv
      );
      restaurar(
        "ASAAS_API_URL",
        ambienteOriginal.url
      );
      restaurar(
        "ASAAS_API_KEY",
        ambienteOriginal.chave
      );
      restaurar(
        "ASAAS_HTTP_TIMEOUT_MS",
        ambienteOriginal.timeout
      );
    });

    test(
      "recusa chave de Sandbox na URL de produção",
      () => {
        process.env.NODE_ENV =
          "production";
        process.env.ASAAS_API_URL =
          "https://api.asaas.com/v3";
        process.env.ASAAS_API_KEY =
          "$aact_hmlg_teste";

        const {
          validarConfigAsaas
        } = require(
          "../src/services/asaasService"
        );

        expect(
          () => validarConfigAsaas()
        ).toThrow(
          "a URL de produção exige uma chave de produção"
        );
      }
    );

    test(
      "aceita chave e URL de produção compatíveis",
      () => {
        process.env.NODE_ENV =
          "production";
        process.env.ASAAS_API_URL =
          "https://api.asaas.com/v3";
        process.env.ASAAS_API_KEY =
          "$aact_prod_teste";

        const {
          validarConfigAsaas
        } = require(
          "../src/services/asaasService"
        );

        expect(
          validarConfigAsaas()
        ).toMatchObject({
          ambiente: "producao"
        });
      }
    );

    test(
      "recusa domínio não oficial em produção",
      () => {
        process.env.NODE_ENV =
          "production";
        process.env.ASAAS_API_URL =
          "https://exemplo.com/api.asaas.com/v3";
        process.env.ASAAS_API_KEY =
          "$aact_prod_teste";

        const {
          validarConfigAsaas
        } = require(
          "../src/services/asaasService"
        );

        expect(
          () => validarConfigAsaas()
        ).toThrow(
          "use um endpoint oficial"
        );
      }
    );

    test(
      "limita o timeout configurável a uma faixa segura",
      () => {
        process.env.ASAAS_API_URL =
          "https://api-sandbox.asaas.com/v3";
        process.env.ASAAS_API_KEY =
          "$aact_hmlg_teste";
        process.env
          .ASAAS_HTTP_TIMEOUT_MS =
          "15000";

        const {
          obterTimeoutAsaas
        } = require(
          "../src/services/asaasService"
        );

        expect(
          obterTimeoutAsaas()
        ).toBe(15000);

        process.env
          .ASAAS_HTTP_TIMEOUT_MS =
          "60000";

        expect(
          obterTimeoutAsaas()
        ).toBe(10000);
      }
    );
  }
);
