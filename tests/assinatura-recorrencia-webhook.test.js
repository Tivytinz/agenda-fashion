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

function sqlContem(sql, trecho) {
  return String(sql)
    .replace(/\s+/g, " ")
    .includes(trecho);
}

function pagamentoComAssinatura({
  assinaturaId = 20,
  negocioId = 7,
  planoId = 3,
  pagamentoId = 50,
  status = "ACTIVE",
  ativo = true,
  formaPagamento = "pix",
  subscriptionId = "sub_1",
  valor = "99.90",
  dataPagamento = "2026-08-28",
  dataVencimento = "2026-08-28"
} = {}) {
  return {
    id: assinaturaId,
    negocio_id: negocioId,
    plano_id: planoId,
    pagamento_id: pagamentoId,
    valor,
    forma_pagamento: formaPagamento,
    status,
    ativo,
    asaas_customer_id: "cus_1",
    asaas_subscription_id: subscriptionId,
    data_pagamento: dataPagamento,
    data_vencimento: dataVencimento,
    data_proxima_cobranca: dataVencimento
  };
}

describe(
  "Recorrências recebidas pelo webhook",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockClient.query
        .mockReset();

      pagamentoRepository
        .criarPagamento
        .mockResolvedValue({
          id: 50
        });

      pagamentoRepository
        .atualizarStatusPagamento
        .mockResolvedValue({
          id: 50,
          status: "PENDING"
        });
    });

    test(
      "cria o pagamento recorrente local e renova a assinatura",
      async () => {
        let buscasPagamento = 0;

        mockClient.query
          .mockImplementation(
            async (sql) => {
              if (
                sqlContem(
                  sql,
                  "FROM pagamentos p"
                )
              ) {
                buscasPagamento += 1;

                if (buscasPagamento < 3) {
                  return {
                    rows: []
                  };
                }

                return {
                  rows: [
                    pagamentoComAssinatura()
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "WHERE asaas_subscription_id = $1"
                ) &&
                sqlContem(
                  sql,
                  "FOR UPDATE"
                )
              ) {
                return {
                  rows: [
                    pagamentoComAssinatura({
                      pagamentoId: undefined
                    })
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "UPDATE pagamentos"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 50
                    }
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "assinatura_vigente_id"
                )
              ) {
                return {
                  rows: [
                    {
                      assinatura_vigente_id:
                        null
                    }
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "data_proxima_cobranca = $2"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 20,
                      status: "ACTIVE",
                      ativo: true,
                      data_proxima_cobranca:
                        "2026-09-28"
                    }
                  ]
                };
              }

              return {
                rows: []
              };
            }
          );

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
          .mockImplementation(
            async () => ({
              rows: []
            })
          );

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
          .mockImplementation(
            async (sql) => {
              if (
                sqlContem(
                  sql,
                  "WHERE asaas_subscription_id = $1"
                )
              ) {
                return {
                  rows: []
                };
              }

              if (
                sqlContem(
                  sql,
                  "WHERE id = $1"
                ) &&
                sqlContem(
                  sql,
                  "asaas_subscription_id IS NULL"
                )
              ) {
                return {
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
                };
              }

              if (
                sqlContem(
                  sql,
                  "UPDATE assinaturas"
                ) &&
                sqlContem(
                  sql,
                  "asaas_ultimo_evento_em"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 20,
                      status: "PENDING",
                      ativo: false,
                      asaas_subscription_id:
                        "sub_1"
                    }
                  ]
                };
              }

              return {
                rows: []
              };
            }
          );

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

        expect(assinatura)
          .toMatchObject({
            status: "PENDING",
            ativo: false,
            asaas_subscription_id:
              "sub_1"
          });

        expect(
          mockClient.query
        ).toHaveBeenCalledWith(
          expect.stringContaining(
            "asaas_ultimo_evento_em"
          ),
          expect.arrayContaining([
            "sub_1",
            "cus_1",
            "PENDING",
            false,
            20
          ])
        );
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
          .mockImplementation(
            async (sql) => {
              if (
                sqlContem(
                  sql,
                  "WHERE asaas_subscription_id = $1"
                )
              ) {
                return {
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
                        null
                    }
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "asaas_ultimo_evento_em"
                ) &&
                sqlContem(
                  sql,
                  "UPDATE assinaturas"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 20,
                      status:
                        statusEsperado,
                      ativo: false
                    }
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "FROM planos"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 1
                    }
                  ]
                };
              }

              return {
                rows: []
              };
            }
          );

        const assinatura =
          await sincronizarAssinaturaPorWebhook(
            tipoEvento,
            {
              id: "sub_1",
              status: "ACTIVE"
            }
          );

        expect(assinatura)
          .toMatchObject({
            status: statusEsperado,
            ativo: false
          });

        expect(
          mockClient.query
        ).toHaveBeenCalledWith(
          expect.stringContaining(
            "UPDATE negocios"
          ),
          [1, 7, 3, 20]
        );
      }
    );

    test(
      "encerra a recorrência anterior ao ativar um novo plano",
      async () => {
        mockClient.query
          .mockImplementation(
            async (sql) => {
              if (
                sqlContem(
                  sql,
                  "FROM pagamentos p"
                )
              ) {
                return {
                  rows: [
                    pagamentoComAssinatura({
                      assinaturaId: 30,
                      planoId: 4,
                      pagamentoId: 60,
                      status: "PENDING",
                      ativo: false,
                      subscriptionId: null,
                      valor: "149.90",
                      dataPagamento:
                        "2026-07-29",
                      dataVencimento:
                        "2026-07-29"
                    })
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "UPDATE pagamentos"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 60
                    }
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "assinatura_vigente_id"
                )
              ) {
                return {
                  rows: [
                    {
                      assinatura_vigente_id:
                        null
                    }
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "SELECT id,"
                ) &&
                sqlContem(
                  sql,
                  "asaas_subscription_id"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 20,
                      asaas_subscription_id:
                        "sub_antiga"
                    }
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "data_proxima_cobranca = $2"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 30,
                      ativo: true,
                      status: "ACTIVE"
                    }
                  ]
                };
              }

              return {
                rows: []
              };
            }
          );

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
        ).toHaveBeenCalledWith(
          "sub_antiga"
        );

        expect(
          mockClient.query
        ).toHaveBeenCalledWith(
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
      "confirma pagamento antigo sem substituir a assinatura vigente",
      async () => {
        mockClient.query
          .mockImplementation(
            async (sql) => {
              if (
                sqlContem(
                  sql,
                  "FROM pagamentos p"
                )
              ) {
                return {
                  rows: [
                    pagamentoComAssinatura({
                      status: "PENDING",
                      ativo: false,
                      subscriptionId: null
                    })
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "UPDATE pagamentos"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 50
                    }
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "assinatura_vigente_id"
                )
              ) {
                return {
                  rows: [
                    {
                      assinatura_vigente_id:
                        30
                    }
                  ]
                };
              }

              return {
                rows: []
              };
            }
          );

        const assinatura =
          await ativarAssinaturaPorPagamento(
            "pay_antigo",
            "CONFIRMED",
            {
              status: "CONFIRMED"
            }
          );

        expect(assinatura)
          .toMatchObject({
            id: 20,
            ativacao_ignorada: true,
            assinatura_vigente_id: 30
          });
        expect(criarAssinaturaAsaas)
          .not.toHaveBeenCalled();
        expect(removerAssinaturaAsaas)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "mantém acesso já pago após excluir renovação",
      async () => {
        mockClient.query
          .mockImplementation(
            async (sql) => {
              if (
                sqlContem(
                  sql,
                  "WHERE asaas_subscription_id = $1"
                )
              ) {
                return {
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
                };
              }

              if (
                sqlContem(
                  sql,
                  "asaas_ultimo_evento_em"
                ) &&
                sqlContem(
                  sql,
                  "UPDATE assinaturas"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 20,
                      status: "CANCELED",
                      ativo: true
                    }
                  ]
                };
              }

              return {
                rows: []
              };
            }
          );

        const assinatura =
          await sincronizarAssinaturaPorWebhook(
            "SUBSCRIPTION_DELETED",
            {
              id: "sub_1",
              status: "INACTIVE",
              deleted: true
            }
          );

        expect(assinatura)
          .toMatchObject({
            status: "CANCELED",
            ativo: true
          });

        expect(
          mockClient.query.mock.calls
            .some(
              ([sql]) =>
                sqlContem(
                  sql,
                  "FROM planos"
                )
            )
        ).toBe(false);
      }
    );

    test(
      "suspende assinatura vencida e retorna o negócio ao plano gratuito",
      async () => {
        mockClient.query
          .mockImplementation(
            async (sql) => {
              if (
                sqlContem(
                  sql,
                  "FROM pagamentos p"
                )
              ) {
                return {
                  rows: [
                    pagamentoComAssinatura()
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "FROM planos"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 1
                    }
                  ]
                };
              }

              if (
                sqlContem(
                  sql,
                  "UPDATE assinaturas"
                ) &&
                sqlContem(
                  sql,
                  "ativo = FALSE"
                )
              ) {
                return {
                  rows: [
                    {
                      id: 20,
                      status: "OVERDUE",
                      ativo: false
                    }
                  ]
                };
              }

              return {
                rows: []
              };
            }
          );

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
            data_pagamento: null,
            evento_criado_em: null,
            evento_id: null
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
          .mockImplementation(
            async (sql) => {
              if (
                sqlContem(
                  sql,
                  "FROM pagamentos p"
                )
              ) {
                return {
                  rows: [
                    pagamentoComAssinatura({
                      status: "ACTIVE",
                      ativo: true,
                      subscriptionId:
                        "sub_antiga"
                    })
                  ]
                };
              }

              return {
                rows: []
              };
            }
          );

        pagamentoRepository
          .atualizarStatusPagamento
          .mockResolvedValue(null);

        const resultado =
          await suspenderAssinaturaPorPagamento({
            id: "pay_antigo",
            status: "OVERDUE",
            subscription:
              "sub_antiga",
            webhookEventoCriadoEm:
              "2026-09-13 18:00:00",
            webhookEventoId:
              "evt_antigo"
          });

        expect(resultado)
          .toBeNull();

        expect(
          pagamentoRepository
            .atualizarStatusPagamento
        ).toHaveBeenCalledWith(
          mockClient,
          "pay_antigo",
          expect.objectContaining({
            evento_criado_em:
              "2026-09-13 18:00:00",
            evento_id:
              "evt_antigo"
          })
        );

        expect(
          mockClient.query.mock.calls
            .some(
              ([sql]) =>
                sqlContem(
                  sql,
                  "FROM planos"
                ) ||
                sqlContem(
                  sql,
                  "UPDATE negocios"
                )
            )
        ).toBe(false);
      }
    );
  }
);
