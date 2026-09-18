const mockClient = {
  query: jest.fn()
};

jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao: jest.fn(
      async (callback) =>
        callback(mockClient)
    )
  })
);

jest.mock(
  "../src/repositories/pagamentoRepository",
  () => ({
    criarPagamento: jest.fn(),
    atualizarStatusPagamento: jest.fn()
  })
);

jest.mock(
  "../src/repositories/assinaturaWebhookRepository",
  () => ({
    buscarPorPagamentoParaAtualizar: jest.fn(),
    buscarPorSubscriptionParaAtualizar: jest.fn(),
    buscarPlanoGratis: jest.fn(),
    suspenderAssinatura: jest.fn(),
    atualizarPlanoNegocioSeSemOutraAssinatura: jest.fn(),
    confirmarPagamento: jest.fn(),
    buscarAssinaturaVigenteMaisNova: jest.fn(),
    listarAtivasAnteriores: jest.fn(),
    cancelarAtivasSubstituidas: jest.fn(),
    desativarOutras: jest.fn(),
    ativarAssinatura: jest.fn(),
    atualizarPlanoNegocio: jest.fn()
  })
);

jest.mock(
  "../src/services/asaasService",
  () => ({
    criarAssinaturaAsaas: jest.fn(),
    removerAssinaturaAsaas: jest.fn()
  })
);

const pagamentoRepository = require(
  "../src/repositories/pagamentoRepository"
);
const assinaturaWebhookRepository = require(
  "../src/repositories/assinaturaWebhookRepository"
);
const {
  sincronizarPagamentoPorWebhook,
  suspenderAssinaturaPorPagamento
} = require(
  "../src/services/assinaturaPagamentoService"
);

const assinatura = {
  id: 20,
  pagamento_id: 31,
  negocio_id: 7,
  plano_id: 3,
  status: "ACTIVE",
  ativo: true,
  valor: 99.9
};

beforeEach(() => {
  jest.clearAllMocks();

  assinaturaWebhookRepository
    .buscarPorPagamentoParaAtualizar
    .mockResolvedValue(assinatura);
  pagamentoRepository
    .atualizarStatusPagamento
    .mockResolvedValue({
      id: 31
    });
  assinaturaWebhookRepository
    .buscarPlanoGratis
    .mockResolvedValue({
      id: 1
    });
  assinaturaWebhookRepository
    .suspenderAssinatura
    .mockResolvedValue({
      ...assinatura,
      ativo: false
    });
  assinaturaWebhookRepository
    .atualizarPlanoNegocioSeSemOutraAssinatura
    .mockResolvedValue();
});

test(
  "persiste valor conhecido de reembolso parcial",
  async () => {
    await sincronizarPagamentoPorWebhook({
      id: "pay_1",
      status: "PARTIALLY_REFUNDED",
      refundedValue: 40,
      webhookTipoEvento:
        "PAYMENT_PARTIALLY_REFUNDED",
      webhookEventoCriadoEm:
        "2026-09-17 18:30:00",
      webhookEventoId: "evt_partial"
    });

    expect(
      pagamentoRepository
        .atualizarStatusPagamento
    ).toHaveBeenCalledWith(
      mockClient,
      "pay_1",
      expect.objectContaining({
        reversao_tipo:
          "PARTIALLY_REFUNDED",
        valor_revertido: 40,
        reversao_valor_conhecido: true,
        reversao_em:
          "2026-09-17 18:30:00"
      })
    );
  }
);

test(
  "marca reembolso parcial como incompleto quando o provedor não informa valor",
  async () => {
    await sincronizarPagamentoPorWebhook({
      id: "pay_2",
      status: "PARTIALLY_REFUNDED",
      webhookTipoEvento:
        "PAYMENT_PARTIALLY_REFUNDED",
      webhookEventoCriadoEm:
        "2026-09-17 19:00:00",
      webhookEventoId: "evt_partial_unknown"
    });

    expect(
      pagamentoRepository
        .atualizarStatusPagamento
    ).toHaveBeenCalledWith(
      mockClient,
      "pay_2",
      expect.objectContaining({
        reversao_tipo:
          "PARTIALLY_REFUNDED",
        valor_revertido: null,
        reversao_valor_conhecido: false
      })
    );
  }
);

test(
  "tipo do webhook de reversão prevalece sobre status ainda recebido no payload",
  async () => {
    await suspenderAssinaturaPorPagamento({
      id: "pay_evento_refund",
      status: "RECEIVED",
      webhookTipoEvento:
        "PAYMENT_REFUNDED",
      webhookEventoCriadoEm:
        "2026-09-17 19:30:00",
      webhookEventoId:
        "evt_refund_status_stale"
    });

    expect(
      pagamentoRepository
        .atualizarStatusPagamento
    ).toHaveBeenCalledWith(
      mockClient,
      "pay_evento_refund",
      expect.objectContaining({
        reversao_tipo: "REFUNDED",
        reversao_valor_conhecido: true
      })
    );
  }
);

test(
  "reembolso total usa o valor local como fallback confiável",
  async () => {
    await suspenderAssinaturaPorPagamento({
      id: "pay_3",
      status: "REFUNDED",
      webhookTipoEvento:
        "PAYMENT_REFUNDED",
      webhookEventoCriadoEm:
        "2026-09-17 20:00:00",
      webhookEventoId: "evt_refund"
    });

    expect(
      pagamentoRepository
        .atualizarStatusPagamento
    ).toHaveBeenCalledWith(
      mockClient,
      "pay_3",
      expect.objectContaining({
        reversao_tipo: "REFUNDED",
        valor_revertido: null,
        reversao_valor_conhecido: true
      })
    );
  }
);

test(
  "confirmação posterior limpa uma reversão obsoleta",
  async () => {
    await sincronizarPagamentoPorWebhook({
      id: "pay_4",
      status: "RECEIVED",
      paymentDate: "2026-09-17",
      webhookTipoEvento:
        "PAYMENT_RECEIVED",
      webhookEventoCriadoEm:
        "2026-09-17 21:00:00",
      webhookEventoId: "evt_received"
    });

    expect(
      pagamentoRepository
        .atualizarStatusPagamento
    ).toHaveBeenCalledWith(
      mockClient,
      "pay_4",
      expect.objectContaining({
        limpar_reversao: true
      })
    );
  }
);
