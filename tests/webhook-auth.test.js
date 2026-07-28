const autenticarWebhookAsaas = require(
  "../src/middlewares/autenticarWebhookAsaas"
);

function criarResposta() {
  return {
    status: jest.fn()
      .mockReturnThis(),
    json: jest.fn()
      .mockReturnThis(),
  };
}

describe(
  "Autenticação do webhook Asaas",
  () => {
    const tokenOriginal =
      process.env
        .ASAAS_WEBHOOK_TOKEN;

    afterEach(() => {
      if (
        tokenOriginal ===
        undefined
      ) {
        delete process.env
          .ASAAS_WEBHOOK_TOKEN;
      } else {
        process.env
          .ASAAS_WEBHOOK_TOKEN =
          tokenOriginal;
      }

      jest.restoreAllMocks();
    });

    test(
      "aceita o token correto",
      () => {
        process.env
          .ASAAS_WEBHOOK_TOKEN =
          "token-seguro-de-webhook-asaas-123";

        const req = {
          get: jest.fn()
            .mockReturnValue(
              "token-seguro-de-webhook-asaas-123"
            ),
        };

        const res =
          criarResposta();

        const next =
          jest.fn();

        autenticarWebhookAsaas(
          req,
          res,
          next
        );

        expect(next)
          .toHaveBeenCalledWith();

        expect(res.status)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "rejeita token incorreto",
      () => {
        process.env
          .ASAAS_WEBHOOK_TOKEN =
          "token-seguro-de-webhook-asaas-123";

        const req = {
          get: jest.fn()
            .mockReturnValue(
              "token-incorreto"
            ),
        };

        const res =
          criarResposta();

        const next =
          jest.fn();

        autenticarWebhookAsaas(
          req,
          res,
          next
        );

        expect(next)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              statusCode: 401,
            })
          );
      }
    );

    test(
      "retorna indisponível quando o token não foi configurado",
      () => {
        delete process.env
          .ASAAS_WEBHOOK_TOKEN;

        jest.spyOn(
          console,
          "error"
        ).mockImplementation();

        const req = {
          get: jest.fn(),
        };

        const res =
          criarResposta();

        const next =
          jest.fn();

        autenticarWebhookAsaas(
          req,
          res,
          next
        );

        expect(res.status)
          .toHaveBeenCalledWith(
            503
          );

        expect(next)
          .not.toHaveBeenCalled();
      }
    );
  }
);
