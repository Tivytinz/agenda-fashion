jest.mock(
  "../src/services/webhookService",
  () => ({
    enfileirarWebhookAsaas:
      jest.fn(),
    agendarProcessamentoWebhook:
      jest.fn()
  })
);

const {
  enfileirarWebhookAsaas,
  agendarProcessamentoWebhook
} = require(
  "../src/services/webhookService"
);

const {
  receberWebhookAsaas
} = require(
  "../src/controllers/webhookController"
);

function criarResposta() {
  return {
    status: jest.fn()
      .mockReturnThis(),
    json: jest.fn()
      .mockReturnThis()
  };
}

describe(
  "Controller assíncrono do webhook Asaas",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "rejeita payload sem identificador do evento",
      async () => {
        const req = {
          body: {
            event: "PAYMENT_CONFIRMED",
            payment: {
              id: "pay_1"
            }
          }
        };
        const res = criarResposta();
        const next = jest.fn();

        await receberWebhookAsaas(
          req,
          res,
          next
        );

        expect(res.status)
          .toHaveBeenCalledWith(400);
        expect(
          enfileirarWebhookAsaas
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "responde imediatamente após persistir o evento",
      async () => {
        enfileirarWebhookAsaas
          .mockResolvedValue({
            duplicado: false,
            evento: {
              id: 10
            }
          });

        const req = {
          body: {
            id: "evt_1",
            event: "PAYMENT_CONFIRMED",
            payment: {
              id: "pay_1"
            }
          }
        };
        const res = criarResposta();
        const next = jest.fn();

        await receberWebhookAsaas(
          req,
          res,
          next
        );

        expect(
          agendarProcessamentoWebhook
        ).toHaveBeenCalledWith(10);
        expect(res.json)
          .toHaveBeenCalledWith({
            recebido: true,
            duplicado: false,
            enfileirado: true
          });
        expect(next)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "confirma também uma entrega duplicada",
      async () => {
        enfileirarWebhookAsaas
          .mockResolvedValue({
            duplicado: true,
            evento: {
              id: 10,
              status: "PROCESSED"
            }
          });

        const req = {
          body: {
            id: "evt_1",
            event: "PAYMENT_RECEIVED",
            payment: {
              id: "pay_1"
            }
          }
        };
        const res = criarResposta();

        await receberWebhookAsaas(
          req,
          res,
          jest.fn()
        );

        expect(res.json)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              recebido: true,
              duplicado: true
            })
          );
      }
    );

    test(
      "encaminha o payload de assinatura para a fila",
      async () => {
        enfileirarWebhookAsaas
          .mockResolvedValue({
            duplicado: false,
            evento: {
              id: 11
            }
          });

        const req = {
          body: {
            id: "evt_subscription_1",
            event:
              "SUBSCRIPTION_CREATED",
            subscription: {
              id: "sub_1",
              status: "ACTIVE",
              externalReference:
                "assinatura:20;negocio:7;plano:3"
            }
          }
        };
        const res = criarResposta();

        await receberWebhookAsaas(
          req,
          res,
          jest.fn()
        );

        expect(
          enfileirarWebhookAsaas
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            eventoId:
              "evt_subscription_1",
            tipoEvento:
              "SUBSCRIPTION_CREATED",
            pagamento: null,
            assinatura:
              expect.objectContaining({
                id: "sub_1"
              })
          })
        );
      }
    );
  }
);
