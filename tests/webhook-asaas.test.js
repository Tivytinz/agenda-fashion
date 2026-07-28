jest.mock(
  "../src/repositories/webhookEventoRepository"
);

jest.mock(
  "../src/services/assinaturaService",
  () => ({
    ativarAssinaturaPorPagamento:
      jest.fn(),
    sincronizarPagamentoPorWebhook:
      jest.fn(),
    suspenderAssinaturaPorPagamento:
      jest.fn()
  })
);

const webhookEventoRepository = require(
  "../src/repositories/webhookEventoRepository"
);

const {
  ativarAssinaturaPorPagamento,
  sincronizarPagamentoPorWebhook,
  suspenderAssinaturaPorPagamento
} = require(
  "../src/services/assinaturaService"
);

const {
  enfileirarWebhookAsaas,
  processarEventoWebhook,
  processarFilaWebhook
} = require(
  "../src/services/webhookService"
);

describe(
  "Fila idempotente do webhook Asaas",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      jest.spyOn(
        console,
        "info"
      ).mockImplementation();

      jest.spyOn(
        console,
        "error"
      ).mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test(
      "enfileira o payload sem executar a regra financeira",
      async () => {
        webhookEventoRepository
          .registrarRecebimento
          .mockResolvedValue({
            novo: true,
            evento: {
              id: 10,
              status: "PENDING"
            }
          });

        const resultado =
          await enfileirarWebhookAsaas({
            eventoId: "evt_1",
            tipoEvento:
              "PAYMENT_CONFIRMED",
            pagamento: {
              id: "pay_1"
            }
          });

        expect(resultado.duplicado)
          .toBe(false);
        expect(
          ativarAssinaturaPorPagamento
        ).not.toHaveBeenCalled();
        expect(
          webhookEventoRepository
            .registrarRecebimento
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            payload:
              expect.objectContaining({
                id: "evt_1"
              })
          })
        );
      }
    );

    test(
      "processa uma confirmação reservada pelo worker",
      async () => {
        webhookEventoRepository
          .reservarPorId
          .mockResolvedValue({
            id: 10,
            evento_id: "evt_1",
            tipo_evento:
              "PAYMENT_CONFIRMED",
            recurso_id: "pay_1",
            tentativas: 1,
            payload: {
              payment: {
                id: "pay_1",
                status: "CONFIRMED"
              }
            }
          });

        ativarAssinaturaPorPagamento
          .mockResolvedValue({
            id: 20,
            status: "ACTIVE"
          });

        const resultado =
          await processarEventoWebhook(10);

        expect(
          ativarAssinaturaPorPagamento
        ).toHaveBeenCalledWith(
          "pay_1",
          "CONFIRMED",
          expect.objectContaining({
            id: "pay_1"
          })
        );
        expect(
          webhookEventoRepository
            .marcarConcluido
        ).toHaveBeenCalledWith(
          10,
          "PROCESSED"
        );
        expect(resultado.status)
          .toBe("PROCESSED");
      }
    );

    test(
      "não processa um evento já reservado por outro worker",
      async () => {
        webhookEventoRepository
          .reservarPorId
          .mockResolvedValue(null);

        const resultado =
          await processarEventoWebhook(10);

        expect(resultado)
          .toEqual({
            processado: false,
            indisponivel: true
          });
        expect(
          ativarAssinaturaPorPagamento
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "marca evento não monitorado como ignorado",
      async () => {
        webhookEventoRepository
          .reservarPorId
          .mockResolvedValue({
            id: 11,
            evento_id: "evt_2",
            tipo_evento:
              "PAYMENT_CREATED",
            tentativas: 1,
            payload: {
              payment: {
                id: "pay_2"
              }
            }
          });

        const resultado =
          await processarEventoWebhook(11);

        expect(
          webhookEventoRepository
            .marcarConcluido
        ).toHaveBeenCalledWith(
          11,
          "IGNORED"
        );
        expect(resultado.ignorado)
          .toBe(true);
      }
    );

    test(
      "ignora pagamento que não pertence ao Agenda Fashion",
      async () => {
        webhookEventoRepository
          .reservarPorId
          .mockResolvedValue({
            id: 12,
            evento_id: "evt_3",
            tipo_evento:
              "PAYMENT_CONFIRMED",
            recurso_id:
              "pay_inexistente",
            tentativas: 1,
            payload: {
              payment: {
                id:
                  "pay_inexistente"
              }
            }
          });

        ativarAssinaturaPorPagamento
          .mockResolvedValue(null);

        const resultado =
          await processarEventoWebhook(12);

        expect(
          webhookEventoRepository
            .marcarConcluido
        ).toHaveBeenCalledWith(
          12,
          "IGNORED"
        );

        expect(resultado)
          .toEqual({
            ignorado: true,
            status: "IGNORED"
          });
      }
    );

    test(
      "sincroniza cobrança recorrente criada pelo Asaas",
      async () => {
        webhookEventoRepository
          .reservarPorId
          .mockResolvedValue({
            id: 14,
            evento_id: "evt_5",
            tipo_evento:
              "PAYMENT_CREATED",
            recurso_id: "pay_5",
            tentativas: 1,
            payload: {
              payment: {
                id: "pay_5",
                status: "PENDING",
                subscription: "sub_1",
                value: 99.9,
                billingType: "PIX",
                dueDate: "2026-08-28"
              }
            }
          });

        sincronizarPagamentoPorWebhook
          .mockResolvedValue({
            id: 50,
            status: "PENDING"
          });

        const resultado =
          await processarEventoWebhook(14);

        expect(
          sincronizarPagamentoPorWebhook
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "pay_5",
            subscription: "sub_1",
            value: 99.9
          })
        );
        expect(resultado.status)
          .toBe("PROCESSED");
      }
    );

    test(
      "suspende o plano quando a cobrança fica vencida",
      async () => {
        webhookEventoRepository
          .reservarPorId
          .mockResolvedValue({
            id: 15,
            evento_id: "evt_6",
            tipo_evento:
              "PAYMENT_OVERDUE",
            recurso_id: "pay_6",
            tentativas: 1,
            payload: {
              payment: {
                id: "pay_6",
                status: "OVERDUE",
                subscription: "sub_1"
              }
            }
          });

        suspenderAssinaturaPorPagamento
          .mockResolvedValue({
            id: 20,
            status: "OVERDUE",
            ativo: false
          });

        const resultado =
          await processarEventoWebhook(15);

        expect(
          suspenderAssinaturaPorPagamento
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "pay_6",
            status: "OVERDUE",
            subscription: "sub_1"
          })
        );
        expect(resultado.status)
          .toBe("PROCESSED");
      }
    );

    test(
      "worker drena eventos disponíveis até a fila ficar vazia",
      async () => {
        webhookEventoRepository
          .reservarProximo
          .mockResolvedValueOnce({
            id: 13,
            evento_id: "evt_4",
            tipo_evento:
              "PAYMENT_RECEIVED",
            recurso_id: "pay_4",
            tentativas: 1,
            payload: {
              payment: {
                id: "pay_4",
                status: "RECEIVED"
              }
            }
          })
          .mockResolvedValueOnce(null);

        ativarAssinaturaPorPagamento
          .mockResolvedValue({
            id: 21
          });

        const quantidade =
          await processarFilaWebhook();

        expect(quantidade).toBe(1);
        expect(
          webhookEventoRepository
            .reservarProximo
        ).toHaveBeenCalledTimes(2);
      }
    );
  }
);
