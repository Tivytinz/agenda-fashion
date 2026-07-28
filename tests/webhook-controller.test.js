jest.mock(
  "../src/services/webhookService",
  () => ({
    processarWebhookAsaas:
      jest.fn(),
  })
);

const {
  processarWebhookAsaas,
} = require(
  "../src/services/webhookService"
);

const {
  receberWebhookAsaas,
} = require(
  "../src/controllers/webhookController"
);

function criarResposta() {
  return {
    set: jest.fn()
      .mockReturnThis(),
    status: jest.fn()
      .mockReturnThis(),
    json: jest.fn()
      .mockReturnThis(),
  };
}

describe(
  "Controller do webhook Asaas",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "rejeita payload sem identificador do evento",
      async () => {
        const req = {
          body: {
            event:
              "PAYMENT_CONFIRMED",
            payment: {
              id: "pay_1",
            },
          },
        };

        const res =
          criarResposta();

        const next =
          jest.fn();

        await receberWebhookAsaas(
          req,
          res,
          next
        );

        expect(res.status)
          .toHaveBeenCalledWith(
            400
          );

        expect(
          processarWebhookAsaas
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "confirma evento concluído",
      async () => {
        processarWebhookAsaas
          .mockResolvedValue({
            duplicado: false,
            ignorado: false,
            em_processamento:
              false,
          });

        const req = {
          body: {
            id: "evt_1",
            event:
              "PAYMENT_CONFIRMED",
            payment: {
              id: "pay_1",
            },
          },
        };

        const res =
          criarResposta();

        const next =
          jest.fn();

        await receberWebhookAsaas(
          req,
          res,
          next
        );

        expect(res.json)
          .toHaveBeenCalledWith({
            recebido: true,
            duplicado: false,
            ignorado: false,
          });

        expect(next)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "solicita reenvio para duplicata ainda em processamento",
      async () => {
        processarWebhookAsaas
          .mockResolvedValue({
            duplicado: true,
            ignorado: false,
            em_processamento:
              true,
          });

        const req = {
          body: {
            id: "evt_1",
            event:
              "PAYMENT_CONFIRMED",
            payment: {
              id: "pay_1",
            },
          },
        };

        const res =
          criarResposta();

        const next =
          jest.fn();

        await receberWebhookAsaas(
          req,
          res,
          next
        );

        expect(res.set)
          .toHaveBeenCalledWith(
            "Retry-After",
            "5"
          );

        expect(res.status)
          .toHaveBeenCalledWith(
            503
          );
      }
    );
  }
);
