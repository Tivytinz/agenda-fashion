jest.mock(
  "../src/repositories/webhookEventoRepository"
);

jest.mock(
  "../src/services/assinaturaService",
  () => ({
    ativarAssinaturaPorPagamento:
      jest.fn(),
    sincronizarAssinaturaPorWebhook:
      jest.fn(),
    sincronizarPagamentoPorWebhook:
      jest.fn(),
    suspenderAssinaturaPorPagamento:
      jest.fn()
  })
);

jest.mock(
  "../src/services/marketingConversionDeliveryService",
  () => ({
    enfileirarAssinaturaAtivadaSeguro:
      jest.fn(),
    processarFilaConversoes:
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

const marketingConversionDeliveryService = require(
  "../src/services/marketingConversionDeliveryService"
);

const {
  enfileirarWebhookAsaas,
  processarEventoWebhook
} = require(
  "../src/services/webhookService"
);

describe(
  "Ordenação financeira dos webhooks Asaas",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      webhookEventoRepository
        .marcarObsoletoSeNecessario
        .mockResolvedValue(null);

      webhookEventoRepository
        .marcarConcluido
        .mockResolvedValue({
          id: 1,
          status: "PROCESSED"
        });

      marketingConversionDeliveryService
        .enfileirarAssinaturaAtivadaSeguro
        .mockResolvedValue([]);
    });

    test(
      "persiste dateCreated normalizado junto ao evento",
      async () => {
        webhookEventoRepository
          .registrarRecebimento
          .mockResolvedValue({
            novo: true,
            evento: {
              id: 1,
              status: "PENDING"
            }
          });

        await enfileirarWebhookAsaas({
          eventoId: "evt_1",
          tipoEvento: "PAYMENT_RECEIVED",
          eventoCriadoEm:
            "2026-09-13T20:10:11",
          pagamento: {
            id: "pay_1",
            status: "RECEIVED"
          }
        });

        expect(
          webhookEventoRepository
            .registrarRecebimento
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            provedor: "asaas",
            eventoId: "evt_1",
            recursoId: "pay_1",
            eventoCriadoEm:
              "2026-09-13 20:10:11",
            payload:
              expect.objectContaining({
                dateCreated:
                  "2026-09-13 20:10:11"
              })
          })
        );
      }
    );

    test(
      "ignora evento antigo quando já existe estado mais recente do recurso",
      async () => {
        webhookEventoRepository
          .marcarObsoletoSeNecessario
          .mockResolvedValue({
            id: 10,
            evento_id: "evt_overdue_antigo",
            tipo_evento: "PAYMENT_OVERDUE",
            recurso_id: "pay_1",
            status: "IGNORED"
          });

        const resultado =
          await processarEventoWebhook(10);

        expect(resultado)
          .toEqual({
            processado: false,
            ignorado: true,
            obsoleto: true,
            status: "IGNORED"
          });

        expect(
          webhookEventoRepository
            .reservarPorId
        ).not.toHaveBeenCalled();
        expect(
          ativarAssinaturaPorPagamento
        ).not.toHaveBeenCalled();
        expect(
          suspenderAssinaturaPorPagamento
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "reconcilia PAYMENT_UPDATED com estado RECEIVED como pagamento confirmado",
      async () => {
        webhookEventoRepository
          .reservarPorId
          .mockResolvedValue({
            id: 11,
            evento_id: "evt_updated_received",
            tipo_evento: "PAYMENT_UPDATED",
            recurso_id: "pay_1",
            tentativas: 1,
            lease_tentativa: 1,
            payload: {
              payment: {
                id: "pay_1",
                status: "RECEIVED"
              }
            }
          });

        ativarAssinaturaPorPagamento
          .mockResolvedValue({
            id: 20,
            negocio_id: 7,
            valor: 99.9
          });

        const resultado =
          await processarEventoWebhook(11);

        expect(
          ativarAssinaturaPorPagamento
        ).toHaveBeenCalledWith(
          "pay_1",
          "RECEIVED",
          expect.objectContaining({
            id: "pay_1",
            status: "RECEIVED"
          })
        );

        expect(
          sincronizarPagamentoPorWebhook
        ).not.toHaveBeenCalled();
        expect(
          suspenderAssinaturaPorPagamento
        ).not.toHaveBeenCalled();
        expect(resultado.status)
          .toBe("PROCESSED");
      }
    );

    test.each([
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
    ])(
      "mantém acesso suspenso durante %s",
      async (tipoEvento) => {
        webhookEventoRepository
          .reservarPorId
          .mockResolvedValue({
            id: 12,
            evento_id:
              `evt_${tipoEvento}`,
            tipo_evento: tipoEvento,
            recurso_id: "pay_2",
            tentativas: 1,
            lease_tentativa: 1,
            payload: {
              payment: {
                id: "pay_2",
                status: tipoEvento
                  .replace("PAYMENT_", "")
              }
            }
          });

        suspenderAssinaturaPorPagamento
          .mockResolvedValue({
            id: 21,
            negocio_id: 8,
            status: "INACTIVE"
          });

        const resultado =
          await processarEventoWebhook(12);

        expect(
          suspenderAssinaturaPorPagamento
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "pay_2"
          })
        );
        expect(
          ativarAssinaturaPorPagamento
        ).not.toHaveBeenCalled();
        expect(resultado.status)
          .toBe("PROCESSED");
      }
    );
  }
);
