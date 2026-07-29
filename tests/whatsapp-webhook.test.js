const crypto = require("crypto");

jest.mock(
  "../src/repositories/whatsappMensagemRepository",
  () => ({
    registrarStatusEntrega:
      jest.fn(),
  })
);

const autenticarWebhookWhatsapp = require(
  "../src/middlewares/autenticarWebhookWhatsapp"
);

const whatsappMensagemRepository = require(
  "../src/repositories/whatsappMensagemRepository"
);

const {
  processarStatusWhatsapp,
} = require(
  "../src/services/whatsappWebhookService"
);

const whatsappWebhookController = require(
  "../src/controllers/whatsappWebhookController"
);

function criarResposta() {
  return {
    status: jest.fn()
      .mockReturnThis(),
    json: jest.fn()
      .mockReturnThis(),
    type: jest.fn()
      .mockReturnThis(),
    send: jest.fn()
      .mockReturnThis(),
    sendStatus: jest.fn()
      .mockReturnThis(),
  };
}

describe(
  "Webhook de status do WhatsApp",
  () => {
    const ambienteOriginal = {
      ...process.env,
    };

    beforeEach(() => {
      jest.clearAllMocks();

      process.env
        .WHATSAPP_APP_SECRET =
        "segredo-teste";

      process.env
        .WHATSAPP_WEBHOOK_VERIFY_TOKEN =
        "token-verificacao";
    });

    afterAll(() => {
      process.env = {
        ...ambienteOriginal,
      };
    });

    test(
      "responde ao desafio de verificação da Meta",
      () => {
        const req = {
          query: {
            "hub.mode":
              "subscribe",
            "hub.verify_token":
              "token-verificacao",
            "hub.challenge":
              "desafio-123",
          },
        };

        const res =
          criarResposta();

        whatsappWebhookController
          .verificarWebhook(
            req,
            res
          );

        expect(res.status)
          .toHaveBeenCalledWith(
            200
          );

        expect(res.send)
          .toHaveBeenCalledWith(
            "desafio-123"
          );
      }
    );

    test(
      "aceita assinatura HMAC válida",
      () => {
        const rawBody =
          Buffer.from(
            '{"object":"whatsapp_business_account"}'
          );

        const assinatura =
          `sha256=${
            crypto
              .createHmac(
                "sha256",
                "segredo-teste"
              )
              .update(rawBody)
              .digest("hex")
          }`;

        const req = {
          rawBody,
          get: jest.fn()
            .mockReturnValue(
              assinatura
            ),
        };

        const res =
          criarResposta();

        const next =
          jest.fn();

        autenticarWebhookWhatsapp(
          req,
          res,
          next
        );

        expect(next)
          .toHaveBeenCalledTimes(1);

        expect(res.status)
          .not
          .toHaveBeenCalled();
      }
    );

    test(
      "recusa assinatura HMAC inválida",
      () => {
        const req = {
          rawBody:
            Buffer.from("{}"),
          get: jest.fn()
            .mockReturnValue(
              "sha256=invalida"
            ),
        };

        const res =
          criarResposta();

        autenticarWebhookWhatsapp(
          req,
          res,
          jest.fn()
        );

        expect(res.status)
          .toHaveBeenCalledWith(
            401
          );
      }
    );

    test(
      "persiste os estados de entrega e falha",
      async () => {
        whatsappMensagemRepository
          .registrarStatusEntrega
          .mockResolvedValue({
            id: 10,
          });

        const resultado =
          await processarStatusWhatsapp({
            entry: [
              {
                changes: [
                  {
                    field:
                      "messages",
                    value: {
                      statuses: [
                        {
                          id:
                            "wamid.ok",
                          status:
                            "delivered",
                          timestamp:
                            "1785337200",
                        },
                        {
                          id:
                            "wamid.falha",
                          status:
                            "failed",
                          timestamp:
                            "1785337260",
                          errors: [
                            {
                              code:
                                131026,
                              title:
                                "Mensagem não entregue",
                              error_data: {
                                details:
                                  "Número indisponível",
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          });

        expect(resultado)
          .toEqual({
            eventos: 2,
            atualizados: 2,
          });

        expect(
          whatsappMensagemRepository
            .registrarStatusEntrega
        ).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            metaMessageId:
              "wamid.falha",
            status:
              "failed",
            codigoErro:
              131026,
            tituloErro:
              "Mensagem não entregue - Número indisponível",
          })
        );
      }
    );
  }
);
