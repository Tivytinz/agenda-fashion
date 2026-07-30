const mockClient = {
  query: jest.fn()
};

jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao:
      jest.fn(
        async (callback) =>
          callback(mockClient)
      )
  })
);

jest.mock(
  "../src/repositories/assinaturaRepository"
);

jest.mock(
  "../src/repositories/pagamentoRepository",
  () => ({
    criarPagamento: jest.fn(),
    atualizarStatusPagamento:
      jest.fn()
  })
);

jest.mock(
  "../src/services/asaasService",
  () => ({
    criarAssinaturaAsaas:
      jest.fn(),
    removerAssinaturaAsaas:
      jest.fn()
  })
);

jest.mock(
  "../src/services/planoService",
  () => ({
    buscarUsoPlano: jest.fn()
  })
);

const pagamentoRepository = require(
  "../src/repositories/pagamentoRepository"
);

const {
  criarAssinaturaAsaas,
  removerAssinaturaAsaas
} = require(
  "../src/services/asaasService"
);

const {
  ativarAssinaturaPorPagamento,
  sincronizarAssinaturaPorWebhook,
  sincronizarPagamentoPorWebhook,
  suspenderAssinaturaPorPagamento
} = require(
  "../src/services/assinaturaService"
);

describe(
  "Recorrências recebidas pelo webhook",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "cria o pagamento recorrente local e renova a assinatura",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                negocio_id: 7,
                plano_id: 3,
                valor: "99.90",
                forma_pagamento:
                  "pix",
                status: "ACTIVE",
                ativo: true,
                asaas_subscription_id:
                  "sub_1",
                data_proxima_cobranca:
                  "2026-08-28"
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                negocio_id: 7,
                plano_id: 3,
                valor: "99.90",
                forma_pagamento:
                  "pix",
                status: "ACTIVE",
                ativo: true,
                asaas_subscription_id:
                  "sub_1",
                pagamento_id: 50,
                data_pagamento:
                  "2026-08-28",
                data_vencimento:
                  "2026-08-28"
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                status: "ACTIVE",
                ativo: true,
                data_proxima_cobranca:
                  "2026-09-28"
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          });

        pagamentoRepository
          .criarPagamento
          .mockResolvedValue({
            id: 50
          });

        const assinatura =
          await ativarAssinaturaPorPagamento(
            "pay_renovacao",
            "RECEIVED",
            {
              id: "pay_renovacao",
              status: "RECEIVED",
              subscription: "sub_1",
              value: 99.9,
              billingType: "PIX",
              dueDate: "2026-08-28",
              paymentDate: "2026-08-28"
            }
          );

        expect(
          pagamentoRepository
            .criarPagamento
        ).toHaveBeenCalledWith(
          mockClient,
          expect.objectContaining({
            assinatura_id: 20,
            asaas_payment_id:
              "pay_renovacao",
            valor: 99.9,
            forma_pagamento: "pix",
            status: "RECEIVED"
          })
        );

        expect(
          mockClient.query
        ).toHaveBeenCalledWith(
          expect.stringContaining(
            "data_proxima_cobranca = $2"
          ),
          [
            "sub_1",
            "2026-09-28",
            "Assinatura mensal ativa no Asaas.",
            20
          ]
        );

        expect(assinatura)
          .toMatchObject({
            id: 20,
            ativo: true
          });
      }
    );

    test(
      "ignora com segurança pagamento sem vínculo local",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: []
          });

        const pagamento =
          await sincronizarPagamentoPorWebhook({
            id: "pay_externo",
            status: "PENDING",
            subscription:
              "sub_desconhecida"
          });

        expect(pagamento)
          .toBeNull();
        expect(
          pagamentoRepository
            .criarPagamento
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "vincula assinatura criada sem ativar plano pendente",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                negocio_id: 7,
                plano_id: 3,
                status: "PENDING",
                ativo: false,
                asaas_subscription_id:
                  null
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                status: "PENDING",
                ativo: false,
                asaas_subscription_id:
                  "sub_1"
              }
            ]
          });

        const assinatura =
          await sincronizarAssinaturaPorWebhook(
            "SUBSCRIPTION_CREATED",
            {
              id: "sub_1",
              status: "ACTIVE",
              customer: "cus_1",
              value: 49.9,
              nextDueDate:
                "2026-09-28",
              cycle: "MONTHLY",
              billingType: "PIX",
              externalReference:
                "assinatura:20;negocio:7;plano:3"
            }
          );

        expect(mockClient.query)
          .toHaveBeenNthCalledWith(
            2,
            expect.stringContaining(
              "WHERE id = $1"
            ),
            [20, "sub_1"]
          );
        expect(mockClient.query)
          .toHaveBeenNthCalledWith(
            3,
            expect.stringContaining(
              "UPDATE assinaturas"
            ),
            [
              "sub_1",
              "cus_1",
              "PENDING",
              "pix",
              "MONTHLY",
              49.9,
              "2026-09-28",
              false,
              20
            ]
          );
        expect(assinatura)
          .toMatchObject({
            status: "PENDING",
            ativo: false
          });
      }
    );

    test.each([
      [
        "SUBSCRIPTION_INACTIVATED",
        "INACTIVE"
      ],
      [
        "SUBSCRIPTION_DELETED",
        "DELETED"
      ]
    ])(
      "encerra acesso no evento %s",
      async (tipoEvento, statusEsperado) => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                negocio_id: 7,
                plano_id: 3,
                status: "ACTIVE",
                ativo: true,
                asaas_subscription_id:
                  "sub_1"
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                status:
                  statusEsperado,
                ativo: false
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          });

        const assinatura =
          await sincronizarAssinaturaPorWebhook(
            tipoEvento,
            {
              id: "sub_1",
              status: "ACTIVE"
            }
          );

        expect(mockClient.query)
          .toHaveBeenNthCalledWith(
            2,
            expect.stringContaining(
              "UPDATE assinaturas"
            ),
            expect.arrayContaining([
              statusEsperado,
              false,
              20
            ])
          );
        expect(mockClient.query)
          .toHaveBeenNthCalledWith(
            4,
            expect.stringContaining(
              "UPDATE negocios"
            ),
            [1, 7, 3, 20]
          );
        expect(assinatura.ativo)
          .toBe(false);
      }
    );

    test(
      "encerra a recorrência anterior ao ativar um novo plano",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                id: 30,
                negocio_id: 7,
                plano_id: 4,
                pagamento_id: 60,
                valor: "149.90",
                forma_pagamento:
                  "pix",
                status: "PENDING",
                ativo: false,
                asaas_customer_id:
                  "cus_1",
                asaas_subscription_id:
                  null,
                data_pagamento:
                  "2026-07-29",
                data_vencimento:
                  "2026-07-29"
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                asaas_subscription_id:
                  "sub_antiga"
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 30,
                ativo: true,
                status: "ACTIVE"
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          });

        criarAssinaturaAsaas
          .mockResolvedValue({
            id: "sub_nova",
            nextDueDate:
              "2026-08-29"
          });

        removerAssinaturaAsaas
          .mockResolvedValue({
            removida: true
          });

        const assinatura =
          await ativarAssinaturaPorPagamento(
            "pay_novo_plano",
            "CONFIRMED",
            {
              status: "CONFIRMED"
            }
          );

        expect(
          removerAssinaturaAsaas
        ).toHaveBeenCalledTimes(1);

        expect(
          removerAssinaturaAsaas
        ).toHaveBeenCalledWith(
          "sub_antiga"
        );

        expect(mockClient.query)
          .toHaveBeenCalledWith(
            expect.stringContaining(
              "Recorrência substituída"
            ),
            [7, 30]
          );

        expect(assinatura)
          .toMatchObject({
            id: 30,
            ativo: true,
            status: "ACTIVE"
          });
      }
    );

    test(
      "mantém acesso já pago após excluir renovação",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                negocio_id: 7,
                plano_id: 3,
                status: "ACTIVE",
                ativo: true,
                asaas_subscription_id:
                  "sub_1",
                data_proxima_cobranca:
                  "2099-09-28"
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                status: "CANCELED",
                ativo: true
              }
            ]
          });

        const assinatura =
          await sincronizarAssinaturaPorWebhook(
            "SUBSCRIPTION_DELETED",
            {
              id: "sub_1",
              status: "INACTIVE",
              deleted: true
            }
          );

        expect(mockClient.query)
          .toHaveBeenCalledTimes(2);
        expect(assinatura)
          .toMatchObject({
            status: "CANCELED",
            ativo: true
          });
      }
    );

    test(
      "suspende assinatura vencida e retorna o negócio ao plano gratuito",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                negocio_id: 7,
                plano_id: 3,
                pagamento_id: 50,
                asaas_subscription_id:
                  "sub_1",
                status: "ACTIVE",
                ativo: true
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                status: "OVERDUE",
                ativo: false
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          });

        pagamentoRepository
          .atualizarStatusPagamento
          .mockResolvedValue({
            id: 50,
            status: "OVERDUE"
          });

        const assinatura =
          await suspenderAssinaturaPorPagamento({
            id: "pay_renovacao",
            status: "OVERDUE",
            subscription: "sub_1"
          });

        expect(
          pagamentoRepository
            .atualizarStatusPagamento
        ).toHaveBeenCalledWith(
          mockClient,
          "pay_renovacao",
          {
            status: "OVERDUE",
            data_pagamento: null
          }
        );

        expect(
          mockClient.query
        ).toHaveBeenCalledWith(
          expect.stringContaining(
            "UPDATE negocios"
          ),
          [1, 7, 3, 20]
        );

        expect(assinatura)
          .toMatchObject({
            status: "OVERDUE",
            ativo: false
          });
      }
    );

    test(
      "webhook financeiro antigo não rebaixa o plano vigente",
      async () => {
        mockClient.query
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                negocio_id: 7,
                plano_id: 3,
                pagamento_id: 50,
                asaas_subscription_id:
                  "sub_antiga",
                status:
                  "CANCELED",
                ativo:
                  false
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 20,
                status:
                  "OVERDUE",
                ativo:
                  false
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          });

        pagamentoRepository
          .atualizarStatusPagamento
          .mockResolvedValue({
            id: 50,
            status:
              "OVERDUE"
          });

        await suspenderAssinaturaPorPagamento({
          id:
            "pay_antigo",
          status:
            "OVERDUE",
          subscription:
            "sub_antiga"
        });

        expect(
          mockClient.query
        ).toHaveBeenCalledWith(
          expect.stringContaining(
            "NOT EXISTS"
          ),
          [
            1,
            7,
            3,
            20
          ]
        );
      }
    );
  }
);
