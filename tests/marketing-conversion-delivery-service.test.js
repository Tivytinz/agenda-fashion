jest.mock(
  "../src/repositories/marketingConversionDeliveryRepository",
  () => ({
    enfileirar: jest.fn(),
    reservarProximo: jest.fn(),
    marcarEnviado: jest.fn(),
    marcarIgnorado: jest.fn(),
    marcarFalha: jest.fn(),
    marcarProcessamentosEsgotados: jest.fn()
  })
);

jest.mock(
  "../src/repositories/metaAdsRepository",
  () => ({
    ehPrimeiroPagamentoAssinatura: jest.fn(),
    buscarPerfilPorNegocio: jest.fn()
  })
);

jest.mock(
  "../src/repositories/googleMeasurementRepository",
  () => ({
    ehPrimeiroPagamentoAssinatura: jest.fn(),
    buscarPerfilPorNegocio: jest.fn()
  })
);

jest.mock(
  "../src/services/metaAdsService",
  () => ({
    sanitizarContextoCliente: jest.fn(
      (meta) => ({
        consentimento:
          meta?.consentimento === true,
        eventId:
          meta?.event_id || null,
        fbp:
          meta?.fbp || null,
        fbc:
          meta?.fbc || null,
        sourceUrl:
          "https://app.agendafashion.com.br/painel/assinatura"
      })
    ),
    enviarEvento: jest.fn()
  })
);

jest.mock(
  "../src/services/googleMeasurementService",
  () => ({
    enviarEventoMeasurementProtocol: jest.fn()
  })
);

jest.mock(
  "../src/utils/registrador",
  () => ({
    aviso: jest.fn()
  })
);

const deliveryRepository = require(
  "../src/repositories/marketingConversionDeliveryRepository"
);
const metaAdsRepository = require(
  "../src/repositories/metaAdsRepository"
);
const googleMeasurementRepository = require(
  "../src/repositories/googleMeasurementRepository"
);
const metaAdsService = require(
  "../src/services/metaAdsService"
);
const googleMeasurementService = require(
  "../src/services/googleMeasurementService"
);
const service = require(
  "../src/services/marketingConversionDeliveryService"
);

const payload = {
  negocioId: 7,
  assinaturaId: 11,
  pagamentoId: "pay_123",
  valor: 79.9
};

beforeEach(() => {
  deliveryRepository
    .enfileirar.mockReset();
  deliveryRepository
    .reservarProximo.mockReset();
  deliveryRepository
    .marcarEnviado.mockReset();
  deliveryRepository
    .marcarIgnorado.mockReset();
  deliveryRepository
    .marcarFalha.mockReset();
  deliveryRepository
    .marcarProcessamentosEsgotados
    .mockReset();

  metaAdsRepository
    .ehPrimeiroPagamentoAssinatura
    .mockReset();
  metaAdsRepository
    .buscarPerfilPorNegocio
    .mockReset();
  googleMeasurementRepository
    .ehPrimeiroPagamentoAssinatura
    .mockReset();
  googleMeasurementRepository
    .buscarPerfilPorNegocio
    .mockReset();
  metaAdsService
    .enviarEvento.mockReset();
  googleMeasurementService
    .enviarEventoMeasurementProtocol
    .mockReset();

  deliveryRepository
    .marcarProcessamentosEsgotados
    .mockResolvedValue([]);
  deliveryRepository
    .marcarEnviado
    .mockResolvedValue({ id: 1 });
  deliveryRepository
    .marcarIgnorado
    .mockResolvedValue({ id: 1 });
  deliveryRepository
    .marcarFalha
    .mockResolvedValue({ id: 1 });
});

test(
  "Meta usa event_id estável e marca a entrega como enviada",
  async () => {
    deliveryRepository
      .reservarProximo
      .mockResolvedValueOnce({
        id: 1,
        provedor: "meta",
        payload,
        lease_tentativa: 1
      });

    metaAdsRepository
      .ehPrimeiroPagamentoAssinatura
      .mockResolvedValue(true);
    metaAdsRepository
      .buscarPerfilPorNegocio
      .mockResolvedValue({
        usuario_id: 3,
        email: "teste@example.com",
        whatsapp: "62999999999",
        meta_consentido_em:
          new Date().toISOString(),
        meta_fbp: "fbp.1.test",
        meta_fbc: "fb.1.test"
      });
    metaAdsService
      .enviarEvento
      .mockResolvedValue({
        enviado: true
      });

    await service
      .processarFilaConversoes(1);

    expect(
      metaAdsService.sanitizarContextoCliente
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        consentimento: true,
        event_id: "subscribe:11",
        source_url:
          "/painel/assinatura"
      })
    );
    expect(metaAdsService.enviarEvento)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "Subscribe",
          eventId: "subscribe:11"
        })
      );
    expect(
      deliveryRepository.marcarEnviado
    ).toHaveBeenCalledWith(1, 1);
  }
);

test(
  "Google usa transaction_id estável e marca a entrega como enviada",
  async () => {
    deliveryRepository
      .reservarProximo
      .mockResolvedValueOnce({
        id: 2,
        provedor: "google",
        payload,
        lease_tentativa: 2
      });

    googleMeasurementRepository
      .ehPrimeiroPagamentoAssinatura
      .mockResolvedValue(true);
    googleMeasurementRepository
      .buscarPerfilPorNegocio
      .mockResolvedValue({
        usuario_id: 3,
        google_consentimento_status: true,
        google_consentido_em:
          new Date().toISOString(),
        google_revogado_em: null,
        google_client_id: "123.456"
      });
    googleMeasurementService
      .enviarEventoMeasurementProtocol
      .mockResolvedValue({
        enviado: true
      });

    await service
      .processarFilaConversoes(1);

    expect(
      googleMeasurementService
        .enviarEventoMeasurementProtocol
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "purchase",
        params: expect.objectContaining({
          transaction_id:
            "af-subscription-11"
        })
      })
    );
    expect(
      deliveryRepository.marcarEnviado
    ).toHaveBeenCalledWith(2, 2);
  }
);

test(
  "falha do provedor mantém a conversão para retry",
  async () => {
    deliveryRepository
      .reservarProximo
      .mockResolvedValueOnce({
        id: 3,
        provedor: "meta",
        payload,
        lease_tentativa: 1
      });

    metaAdsRepository
      .ehPrimeiroPagamentoAssinatura
      .mockResolvedValue(true);
    metaAdsRepository
      .buscarPerfilPorNegocio
      .mockResolvedValue({
        usuario_id: 3,
        meta_consentido_em:
          new Date().toISOString()
      });
    metaAdsService
      .enviarEvento
      .mockRejectedValue(
        new Error("timeout externo")
      );

    await service
      .processarFilaConversoes(1);

    expect(
      deliveryRepository.marcarFalha
    ).toHaveBeenCalledWith(
      3,
      1,
      "timeout externo"
    );
    expect(
      deliveryRepository.marcarEnviado
    ).not.toHaveBeenCalled();
  }
);

test(
  "falha ao persistir a outbox é propagada para permitir retry do webhook",
  async () => {
    deliveryRepository
      .enfileirar
      .mockRejectedValueOnce(
        new Error("banco indisponível")
      )
      .mockResolvedValueOnce({
        novo: true,
        entrega: { id: 2 }
      });

    await expect(
      service
        .enfileirarAssinaturaAtivadaSeguro(
          payload
        )
    ).rejects.toThrow(
      "banco indisponível"
    );
  }
);
