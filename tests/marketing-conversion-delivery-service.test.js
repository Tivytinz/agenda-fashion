jest.mock(
  "../src/repositories/marketingConversionDeliveryRepository",
  () => ({
    enfileirar: jest.fn(),
    reservarProximo: jest.fn(),
    marcarEnviado: jest.fn(),
    marcarIgnorado: jest.fn(),
    marcarFalha: jest.fn(),
    marcarFalhaTerminal: jest.fn(),
    marcarProcessamentosEsgotados: jest.fn()
  })
);

jest.mock(
  "../src/repositories/marketingConversaoRepository",
  () => ({
    buscarPagamentoConfirmado: jest.fn()
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
const marketingConversaoRepository = require(
  "../src/repositories/marketingConversaoRepository"
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
const registrador = require(
  "../src/utils/registrador"
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
  jest.clearAllMocks();

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
  deliveryRepository
    .marcarFalhaTerminal
    .mockResolvedValue({ id: 1 });
  marketingConversaoRepository
    .buscarPagamentoConfirmado
    .mockResolvedValue({
      id: 30,
      assinatura_id: 11,
      asaas_payment_id: "pay_123",
      valor: "59.90"
    });
});

test(
  "Meta usa event_id estável e o valor real do pagamento confirmado",
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
          eventId: "subscribe:11",
          ocorridoEm: undefined,
          customData:
            expect.objectContaining({
              value: 59.9
            })
        })
      );
    expect(
      deliveryRepository.marcarEnviado
    ).toHaveBeenCalledWith(1, 1);
  }
);

test(
  "Google usa transaction_id estável e o valor real do pagamento confirmado",
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
        ocorridoEm: undefined,
        params: expect.objectContaining({
          transaction_id:
            "af-subscription-11",
          value: 59.9
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
  "identificador inválido vira falha terminal em vez de conversão ignorada",
  async () => {
    deliveryRepository
      .reservarProximo
      .mockResolvedValueOnce({
        id: 4,
        provedor: "meta",
        payload,
        lease_tentativa: 2
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
      .mockResolvedValue({
        enviado: false,
        motivo: "event_id_invalido"
      });

    await service
      .processarFilaConversoes(1);

    expect(
      deliveryRepository.marcarFalhaTerminal
    ).toHaveBeenCalledWith(
      4,
      2,
      "event_id_invalido"
    );
    expect(
      deliveryRepository.marcarIgnorado
    ).not.toHaveBeenCalled();
  }
);

test(
  "falta de consentimento permanece como ignorado por regra de privacidade",
  async () => {
    deliveryRepository
      .reservarProximo
      .mockResolvedValueOnce({
        id: 5,
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
        meta_consentido_em: null
      });

    await service
      .processarFilaConversoes(1);

    expect(
      deliveryRepository.marcarIgnorado
    ).toHaveBeenCalledWith(
      5,
      1,
      "sem_consentimento"
    );
    expect(
      deliveryRepository.marcarFalhaTerminal
    ).not.toHaveBeenCalled();
  }
);

test(
  "processamento esgotado gera observabilidade sem expor payload",
  async () => {
    deliveryRepository
      .marcarProcessamentosEsgotados
      .mockResolvedValueOnce([
        {
          id: 9,
          provedor: "google",
          tentativas: 5,
          ultimo_erro: "timeout"
        }
      ]);
    deliveryRepository
      .reservarProximo
      .mockResolvedValueOnce(null);

    await service
      .processarFilaConversoes(1);

    expect(registrador.aviso)
      .toHaveBeenCalledWith(
        "Conversão de assinatura: tentativas esgotadas.",
        {
          entrega_id: 9,
          provedor: "google",
          tentativa: 5,
          erro: "timeout"
        }
      );
  }
);

test(
  "ticks concorrentes compartilham a mesma execução da fila",
  async () => {
    let liberar;
    const bloqueio = new Promise(
      (resolve) => {
        liberar = resolve;
      }
    );

    deliveryRepository
      .marcarProcessamentosEsgotados
      .mockImplementationOnce(
        () => bloqueio
      );
    deliveryRepository
      .reservarProximo
      .mockResolvedValue(null);

    const primeira =
      service.processarFilaConversoes(1);
    const segunda =
      service.processarFilaConversoes(1);

    expect(segunda).toBe(primeira);
    expect(
      deliveryRepository
        .marcarProcessamentosEsgotados
    ).toHaveBeenCalledTimes(1);

    liberar([]);

    await Promise.all([
      primeira,
      segunda
    ]);

    expect(
      deliveryRepository.reservarProximo
    ).toHaveBeenCalledTimes(1);
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
