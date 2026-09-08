jest.mock(
  "../src/repositories/webhookEventoRepository",
  () => ({
    registrarRecebimento: jest.fn(),
    reservarPorId: jest.fn(),
    reservarProximo: jest.fn(),
    marcarConcluido: jest.fn(),
    marcarFalha: jest.fn(),
    marcarProcessamentosEsgotados: jest.fn()
  })
);

jest.mock(
  "../src/services/assinaturaService",
  () => ({
    ativarAssinaturaPorPagamento: jest.fn(),
    sincronizarAssinaturaPorWebhook: jest.fn(),
    sincronizarPagamentoPorWebhook: jest.fn(),
    suspenderAssinaturaPorPagamento: jest.fn()
  })
);

jest.mock(
  "../src/services/marketingConversionDeliveryService",
  () => ({
    enfileirarAssinaturaAtivadaSeguro: jest.fn(),
    processarFilaConversoes: jest.fn()
      .mockResolvedValue(0)
  })
);

jest.mock(
  "../src/utils/registrador",
  () => ({
    informacao: jest.fn(),
    aviso: jest.fn(),
    erro: jest.fn()
  })
);

const webhookEventoRepository = require(
  "../src/repositories/webhookEventoRepository"
);
const webhookService = require(
  "../src/services/webhookService"
);

beforeEach(() => {
  jest.clearAllMocks();
});

test(
  "não declara o webhook processado quando o lease foi perdido",
  async () => {
    webhookEventoRepository
      .reservarPorId
      .mockResolvedValueOnce({
        id: 41,
        evento_id: "evt_lease",
        tipo_evento: "EVENTO_DESCONHECIDO",
        recurso_id: null,
        payload: {},
        tentativas: 3,
        lease_tentativa: 3
      });

    webhookEventoRepository
      .marcarConcluido
      .mockResolvedValueOnce(null);

    await expect(
      webhookService
        .processarEventoWebhook(41)
    ).rejects.toMatchObject({
      code: "WEBHOOK_LEASE_LOST"
    });

    expect(
      webhookEventoRepository
        .marcarFalha
    ).not.toHaveBeenCalled();
  }
);
