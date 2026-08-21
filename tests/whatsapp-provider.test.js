jest.mock(
  "axios",
  () => ({
    get: jest.fn(),
    post: jest.fn(),
  })
);

const axios = require(
  "axios"
);

const whatsappProvider = require(
  "../src/providers/whatsappProvider"
);

describe(
  "Provider oficial do WhatsApp",
  () => {
    const ambienteOriginal = {
      ...process.env,
    };

    beforeEach(() => {
      jest.clearAllMocks();

      delete process.env
        .WHATSAPP_TEST_RECIPIENT;

      process.env
        .WHATSAPP_ACCESS_TOKEN =
        "token-teste";

      process.env
        .WHATSAPP_PHONE_NUMBER_ID =
        "123456";

      process.env
        .WHATSAPP_API_VERSION =
        "v23.0";

      process.env
        .WHATSAPP_BUSINESS_ACCOUNT_ID =
        "waba-123";
    });

    afterAll(() => {
      process.env = {
        ...ambienteOriginal,
      };
    });

    test.each([
      [
        "(62) 99999-9999",
        "5562999999999",
      ],
      [
        "5562999999999",
        "5562999999999",
      ],
    ])(
      "normaliza %s para o padrão internacional",
      (
        recebido,
        esperado
      ) => {
        expect(
          whatsappProvider
            .obterDestinatario(
              recebido
            )
        ).toBe(
          esperado
        );
      }
    );

    test(
      "não redireciona a fila pelo destinatário de teste",
      () => {
        process.env
          .WHATSAPP_TEST_RECIPIENT =
          "11988887777";

        expect(
          whatsappProvider
            .obterDestinatario(
              "62999999999"
            )
        ).toBe(
          "5562999999999"
        );
      }
    );

    test(
      "consulta todos os templates da conta sem expor o token na URL",
      async () => {
        axios.get
          .mockResolvedValueOnce({
            data: {
              data: [{
                id: "1",
                name: "novo_agendamento",
                status: "APPROVED",
              }],
              paging: {
                cursors: {
                  after: "pagina-2",
                },
              },
            },
          })
          .mockResolvedValueOnce({
            data: {
              data: [{
                id: "2",
                name: "confirmacao_agendamento_cliente",
                status: "APPROVED",
              }],
            },
          });

        const templates =
          await whatsappProvider
            .listarTemplates();

        expect(templates)
          .toHaveLength(2);
        expect(axios.get)
          .toHaveBeenNthCalledWith(
            1,
            "https://graph.facebook.com/v23.0/waba-123/message_templates",
            expect.objectContaining({
              headers: {
                Authorization:
                  "Bearer token-teste",
              },
              params:
                expect.objectContaining({
                  limit: 100,
                }),
            })
          );
        expect(axios.get)
          .toHaveBeenNthCalledWith(
            2,
            "https://graph.facebook.com/v23.0/waba-123/message_templates",
            expect.objectContaining({
              params:
                expect.objectContaining({
                  after: "pagina-2",
                }),
            })
          );
      }
    );

    test(
      "exige o identificador da conta do WhatsApp para consultar templates",
      async () => {
        delete process.env
          .WHATSAPP_BUSINESS_ACCOUNT_ID;

        await expect(
          whatsappProvider
            .listarTemplates()
        ).rejects.toMatchObject({
          code:
            "WHATSAPP_CONFIGURATION_ERROR",
        });
        expect(axios.get)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "envia template com parâmetros na ordem aprovada",
      async () => {
        axios.post
          .mockResolvedValue({
            data: {
              messages: [
                {
                  id:
                    "wamid.teste",
                },
              ],
            },
          });

        await whatsappProvider
          .enviarTemplate({
            numero:
              "62999999999",
            nomeTemplate:
              "lembrete_agendamento",
            codigoIdioma:
              "pt_BR",
            parametrosCorpo: [
              "Ana",
              "Studio",
            ],
          });

        expect(
          axios.post
        ).toHaveBeenCalledWith(
          "https://graph.facebook.com/v23.0/123456/messages",
          {
            messaging_product:
              "whatsapp",
            recipient_type:
              "individual",
            to:
              "5562999999999",
            type:
              "template",
            template: {
              name:
                "lembrete_agendamento",
              language: {
                code:
                  "pt_BR",
              },
              components: [
                {
                  type:
                    "body",
                  parameters: [
                    {
                      type:
                        "text",
                      text:
                        "Ana",
                    },
                    {
                      type:
                        "text",
                      text:
                        "Studio",
                    },
                  ],
                },
              ],
            },
          },
          expect.objectContaining({
            headers:
              expect.objectContaining({
                Authorization:
                  "Bearer token-teste",
              }),
            timeout: 15000,
          })
        );
      }
    );

    test(
      "recusa número sem DDD válido",
      () => {
        expect(
          () =>
            whatsappProvider
              .obterDestinatario(
                "9999"
              )
        ).toThrow(
          "Destinatário do WhatsApp inválido"
        );
      }
    );
  }
);
