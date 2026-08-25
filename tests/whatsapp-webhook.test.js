const crypto = require("crypto");

jest.mock(
  "../src/repositories/whatsappMensagemRepository",
  () => ({
    registrarStatusEntrega:
      jest.fn(),
    cancelarMarketingPorWhatsapp:
      jest.fn(),
    cancelarTodasComunicacoesPorWhatsapp:
      jest.fn(),
    registrarInteracaoRecebida:
      jest.fn(),
    marcarInteracaoRespondida:
      jest.fn(),
    marcarInteracaoFalha:
      jest.fn(),
  })
);

jest.mock(
  "../src/providers/whatsappProvider",
  () => ({
    enviarMensagem:
      jest.fn()
        .mockResolvedValue({}),
  })
);

const autenticarWebhookWhatsapp = require(
  "../src/middlewares/autenticarWebhookWhatsapp"
);

const whatsappMensagemRepository = require(
  "../src/repositories/whatsappMensagemRepository"
);

const {
  obterEscopoDescadastro,
  processarStatusWhatsapp,
  processarWebhookWhatsapp,
} = require(
  "../src/services/whatsappWebhookService"
);

const whatsappWebhookController = require(
  "../src/controllers/whatsappWebhookController"
);

const whatsappProvider = require(
  "../src/providers/whatsappProvider"
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

      process.env
        .WHATSAPP_PHONE_NUMBER_ID =
        "phone-number-af";

      process.env
        .WHATSAPP_CONVERSATION_AUTOREPLIES_ENABLED =
        "true";

      whatsappMensagemRepository
        .registrarInteracaoRecebida
        .mockResolvedValue({
          id: 100,
        });

      whatsappMensagemRepository
        .marcarInteracaoRespondida
        .mockResolvedValue({});

      whatsappMensagemRepository
        .marcarInteracaoFalha
        .mockResolvedValue({});

      whatsappProvider
        .enviarMensagem
        .mockResolvedValue({
          messages: [
            {
              id:
                "wamid.resposta",
            },
          ],
        });
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

    test(
      "cancela todas as mensagens quando o destinatário responde SAIR",
      async () => {
        whatsappMensagemRepository
          .cancelarTodasComunicacoesPorWhatsapp
          .mockResolvedValue({
            usuarios: 1,
            mensagensCanceladas: 2,
          });

        const resultado =
          await processarWebhookWhatsapp({
            entry: [
              {
                changes: [
                  {
                    field: "messages",
                    value: {
                      metadata: {
                        phone_number_id:
                          "phone-number-af",
                      },
                      messages: [
                        {
                          id:
                            "wamid.sair",
                          from:
                            "5562999998888",
                          timestamp:
                            "1785337200",
                          type: "text",
                          text: {
                            body: "SAIR",
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          });

        expect(
          whatsappMensagemRepository
            .cancelarTodasComunicacoesPorWhatsapp
        ).toHaveBeenCalledWith(
          "5562999998888"
        );

        expect(
          whatsappMensagemRepository
            .cancelarMarketingPorWhatsapp
        ).not.toHaveBeenCalled();

        expect(
          whatsappMensagemRepository
            .registrarInteracaoRecebida
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            intencao:
              "GLOBAL_OPTOUT",
          })
        );

        expect(
          whatsappProvider.enviarMensagem
        ).toHaveBeenCalledWith(
          "5562999998888",
          expect.stringContaining(
            "Todas as mensagens"
          )
        );

        expect(resultado).toMatchObject({
          mensagensRecebidas: 1,
          descadastros: 1,
          respostasQuebraGelo: 0,
        });
      }
    );

    test.each([
      ["SAIR", "GLOBAL"],
      ["parar", "GLOBAL"],
      ["STOP", "GLOBAL"],
      [
        "PARAR MARKETING",
        "MARKETING",
      ],
      [
        "Não quero receber marketing",
        "MARKETING",
      ],
    ])(
      "classifica o descadastro %s como %s",
      (texto, escopo) => {
        expect(
          obterEscopoDescadastro(
            texto
          )
        ).toBe(escopo);
      }
    );

    test(
      "cancela somente marketing quando o pedido especifica a categoria",
      async () => {
        whatsappMensagemRepository
          .cancelarMarketingPorWhatsapp
          .mockResolvedValue({
            usuarios: 1,
            mensagensCanceladas: 1,
          });

        await processarWebhookWhatsapp({
          entry: [
            {
              changes: [
                {
                  field: "messages",
                  value: {
                    metadata: {
                      phone_number_id:
                        "phone-number-af",
                    },
                    messages: [
                      {
                        id:
                          "wamid.parar-marketing",
                        from:
                          "5562999998888",
                        timestamp:
                          "1785337200",
                        type: "text",
                        text: {
                          body:
                            "PARAR MARKETING",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });

        expect(
          whatsappMensagemRepository
            .cancelarMarketingPorWhatsapp
        ).toHaveBeenCalledWith(
          "5562999998888"
        );

        expect(
          whatsappMensagemRepository
            .cancelarTodasComunicacoesPorWhatsapp
        ).not.toHaveBeenCalled();

        expect(
          whatsappMensagemRepository
            .registrarInteracaoRecebida
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            intencao:
              "MARKETING_OPTOUT",
          })
        );

        expect(
          whatsappProvider.enviarMensagem
        ).toHaveBeenCalledWith(
          "5562999998888",
          expect.stringContaining(
            "marketing"
          )
        );
      }
    );

    test.each([
      [
        "Como funciona o Agenda Fashion?",
        "COMO_FUNCIONA",
        "ajuda profissionais de beleza",
      ],
      [
        "Quero criar minha agenda online",
        "CRIAR_AGENDA",
        "/cadastro?tipo=profissional",
      ],
      [
        "Quais são os planos disponíveis?",
        "PLANOS",
        "Grátis",
      ],
      [
        "Preciso de ajuda",
        "AJUDA",
        "contato@agendafashion.com.br",
      ],
    ])(
      "responde ao quebra-gelo %s",
      async (
        texto,
        intencao,
        trechoResposta
      ) => {
        const resultado =
          await processarWebhookWhatsapp({
            entry: [
              {
                changes: [
                  {
                    field:
                      "messages",
                    value: {
                      metadata: {
                        phone_number_id:
                          "phone-number-af",
                      },
                      messages: [
                        {
                          id:
                            `wamid.${intencao}`,
                          from:
                            "5562999998888",
                          timestamp:
                            "1785337200",
                          type:
                            "text",
                          text: {
                            body: texto,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          });

        expect(
          whatsappMensagemRepository
            .registrarInteracaoRecebida
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            metaMessageId:
              `wamid.${intencao}`,
            telefone:
              "5562999998888",
            intencao,
          })
        );

        expect(
          whatsappProvider
            .enviarMensagem
        ).toHaveBeenCalledWith(
          "5562999998888",
          expect.stringContaining(
            trechoResposta
          )
        );

        await new Promise(
          (resolve) =>
            setImmediate(resolve)
        );

        expect(
          whatsappMensagemRepository
            .marcarInteracaoRespondida
        ).toHaveBeenCalledWith(
          100,
          "wamid.resposta"
        );

        expect(resultado)
          .toMatchObject({
            mensagensRecebidas: 1,
            respostasQuebraGelo: 1,
          });
      }
    );

    test(
      "mantém os quebra-gelos desligados pela flag operacional",
      async () => {
        process.env
          .WHATSAPP_CONVERSATION_AUTOREPLIES_ENABLED =
          "false";

        await processarWebhookWhatsapp({
          entry: [
            {
              changes: [
                {
                  field:
                    "messages",
                  value: {
                    metadata: {
                      phone_number_id:
                        "phone-number-af",
                    },
                    messages: [
                      {
                        id:
                          "wamid.desativada",
                        from:
                          "5562999998888",
                        type: "text",
                        text: {
                          body:
                            "Preciso de ajuda",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });

        expect(
          whatsappMensagemRepository
            .registrarInteracaoRecebida
        ).not.toHaveBeenCalled();

        expect(
          whatsappProvider
            .enviarMensagem
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "não responde duas vezes ao mesmo wamid",
      async () => {
        whatsappMensagemRepository
          .registrarInteracaoRecebida
          .mockResolvedValue(null);

        await processarWebhookWhatsapp({
          entry: [
            {
              changes: [
                {
                  field:
                    "messages",
                  value: {
                    metadata: {
                      phone_number_id:
                        "phone-number-af",
                    },
                    messages: [
                      {
                        id:
                          "wamid.repetida",
                        from:
                          "5562999998888",
                        type: "text",
                        text: {
                          body:
                            "Preciso de ajuda",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });

        expect(
          whatsappProvider
            .enviarMensagem
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "ignora mensagens entregues a outro número da conta",
      async () => {
        await processarWebhookWhatsapp({
          entry: [
            {
              changes: [
                {
                  field:
                    "messages",
                  value: {
                    metadata: {
                      phone_number_id:
                        "outro-numero",
                    },
                    messages: [
                      {
                        id:
                          "wamid.outro",
                        from:
                          "5562999998888",
                        type: "text",
                        text: {
                          body:
                            "Como funciona o Agenda Fashion?",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });

        expect(
          whatsappMensagemRepository
            .registrarInteracaoRecebida
        ).not.toHaveBeenCalled();

        expect(
          whatsappProvider
            .enviarMensagem
        ).not.toHaveBeenCalled();
      }
    );
  }
);
