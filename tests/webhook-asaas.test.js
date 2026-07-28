jest.mock(
  "../src/repositories/webhookEventoRepository"
);

jest.mock(
  "../src/services/assinaturaService",
  () => ({
    ativarAssinaturaPorPagamento:
      jest.fn(),
  })
);

const webhookEventoRepository = require(
  "../src/repositories/webhookEventoRepository"
);

const {
  ativarAssinaturaPorPagamento,
} = require(
  "../src/services/assinaturaService"
);

const {
  processarWebhookAsaas,
} = require(
  "../src/services/webhookService"
);

describe(
  "Webhook Asaas idempotente",
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
      "processa uma confirmação nova e conclui o evento",
      async () => {
        webhookEventoRepository
          .registrarRecebimento
          .mockResolvedValue({
            processar: true,
            novo: true,
            evento: {
              id: 10,
              status:
                "PROCESSING",
              tentativas: 1,
            },
          });

        ativarAssinaturaPorPagamento
          .mockResolvedValue({
            id: 20,
            status: "ACTIVE",
          });

        const resultado =
          await processarWebhookAsaas({
            eventoId:
              "evt_confirmado_1",
            tipoEvento:
              "PAYMENT_CONFIRMED",
            pagamento: {
              id: "pay_1",
              status:
                "CONFIRMED",
            },
          });

        expect(
          ativarAssinaturaPorPagamento
        ).toHaveBeenCalledWith(
          "pay_1",
          "CONFIRMED"
        );

        expect(
          webhookEventoRepository
            .marcarConcluido
        ).toHaveBeenCalledWith(
          10,
          "PROCESSED"
        );

        expect(resultado).toEqual(
          expect.objectContaining({
            duplicado: false,
            status: "PROCESSED",
          })
        );
      }
    );

    test(
      "não processa novamente um evento concluído",
      async () => {
        webhookEventoRepository
          .registrarRecebimento
          .mockResolvedValue({
            processar: false,
            novo: false,
            evento: {
              id: 10,
              status:
                "PROCESSED",
              tentativas: 2,
            },
          });

        const resultado =
          await processarWebhookAsaas({
            eventoId:
              "evt_duplicado",
            tipoEvento:
              "PAYMENT_RECEIVED",
            pagamento: {
              id: "pay_1",
            },
          });

        expect(
          ativarAssinaturaPorPagamento
        ).not.toHaveBeenCalled();

        expect(resultado).toEqual(
          expect.objectContaining({
            duplicado: true,
            em_processamento:
              false,
            status: "PROCESSED",
          })
        );
      }
    );

    test(
      "solicita nova tentativa quando a duplicata ainda está processando",
      async () => {
        webhookEventoRepository
          .registrarRecebimento
          .mockResolvedValue({
            processar: false,
            novo: false,
            evento: {
              id: 10,
              status:
                "PROCESSING",
              tentativas: 2,
            },
          });

        const resultado =
          await processarWebhookAsaas({
            eventoId:
              "evt_processando",
            tipoEvento:
              "PAYMENT_CONFIRMED",
            pagamento: {
              id: "pay_1",
            },
          });

        expect(
          resultado
            .em_processamento
        ).toBe(true);
      }
    );

    test(
      "registra como ignorado um tipo de evento não monitorado",
      async () => {
        webhookEventoRepository
          .registrarRecebimento
          .mockResolvedValue({
            processar: true,
            novo: true,
            evento: {
              id: 11,
              status:
                "PROCESSING",
              tentativas: 1,
            },
          });

        const resultado =
          await processarWebhookAsaas({
            eventoId:
              "evt_ignorado",
            tipoEvento:
              "PAYMENT_CREATED",
            pagamento: {
              id: "pay_2",
            },
          });

        expect(
          webhookEventoRepository
            .marcarConcluido
        ).toHaveBeenCalledWith(
          11,
          "IGNORED"
        );

        expect(
          ativarAssinaturaPorPagamento
        ).not.toHaveBeenCalled();

        expect(resultado.ignorado)
          .toBe(true);
      }
    );

    test(
      "registra falha e propaga erro quando o pagamento ainda não existe",
      async () => {
        webhookEventoRepository
          .registrarRecebimento
          .mockResolvedValue({
            processar: true,
            novo: true,
            evento: {
              id: 12,
              status:
                "PROCESSING",
              tentativas: 1,
            },
          });

        ativarAssinaturaPorPagamento
          .mockResolvedValue(null);

        await expect(
          processarWebhookAsaas({
            eventoId:
              "evt_sem_pagamento",
            tipoEvento:
              "PAYMENT_CONFIRMED",
            pagamento: {
              id: "pay_inexistente",
            },
          })
        ).rejects.toThrow(
          "Pagamento do webhook não encontrado."
        );

        expect(
          webhookEventoRepository
            .marcarFalha
        ).toHaveBeenCalledWith(
          12,
          "Pagamento do webhook não encontrado."
        );
      }
    );
  }
);
