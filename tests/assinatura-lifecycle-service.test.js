jest.mock(
  "../src/repositories/assinaturaEventoRepository",
  () => ({
    registrar: jest.fn(),
    buscarContextoPagamento: jest.fn(),
    teveAtrasoProcessado: jest.fn(),
    teveEventoPagamento: jest.fn(),
    buscarUltimoPorAssinaturaETipo: jest.fn(),
  })
);

const repository = require(
  "../src/repositories/assinaturaEventoRepository"
);
const service = require(
  "../src/services/assinaturaLifecycleService"
);

const client = {
  query: jest.fn(),
};

function assinatura() {
  return {
    id: 20,
    negocio_id: 7,
    plano_id: 3,
  };
}

describe("assinaturaLifecycleService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.registrar.mockImplementation(
      async (_client, dados) => dados
    );
    repository.teveAtrasoProcessado
      .mockResolvedValue(false);
    repository.teveEventoPagamento
      .mockResolvedValue(false);
    repository.buscarUltimoPorAssinaturaETipo
      .mockResolvedValue(null);
  });

  test("primeiro pagamento do negócio vira conversão inicial", async () => {
    repository.buscarContextoPagamento
      .mockResolvedValue({
        possui_pagamento_valido_mesma_assinatura: false,
        possui_historico_pago_anterior: false,
        outra_assinatura_ativa_id: null,
      });

    await service.registrarConfirmacaoPagamento({
      client,
      assinatura: assinatura(),
      pagamentoId: 50,
      asaasPaymentId: "pay_50",
    });

    expect(repository.registrar)
      .toHaveBeenCalledWith(
        client,
        expect.objectContaining({
          tipo: "CONVERSAO_INICIAL",
          negocioId: 7,
          assinaturaId: 20,
          pagamentoId: 50,
          planoNovoId: 3,
          chaveIdempotencia:
            "pagamento:50:CONVERSAO_INICIAL",
        })
      );
  });

  test("pagamento posterior da mesma assinatura vira renovação e recuperação quando houve atraso", async () => {
    repository.buscarContextoPagamento
      .mockResolvedValue({
        possui_pagamento_valido_mesma_assinatura: true,
        possui_historico_pago_anterior: true,
        outra_assinatura_ativa_id: null,
        plano_negocio_atual_id: 1,
      });
    repository.teveEventoPagamento
      .mockResolvedValue(true);

    const eventos =
      await service.registrarConfirmacaoPagamento({
        client,
        assinatura: assinatura(),
        pagamentoId: 51,
        asaasPaymentId: "pay_51",
      });

    expect(
      repository.registrar.mock.calls
        .map(([, dados]) => dados.tipo)
    ).toEqual([
      "RENOVACAO_CONFIRMADA",
      "PAGAMENTO_RECUPERADO",
    ]);
    expect(eventos).toHaveLength(2);
    expect(
      repository.registrar.mock.calls[1][1]
    ).toMatchObject({
      tipo: "PAGAMENTO_RECUPERADO",
      planoAnteriorId: 1,
      planoNovoId: 3,
    });
  });

  test("primeiro pagamento de nova assinatura com plano pago vigente vira mudança de plano", async () => {
    repository.buscarContextoPagamento
      .mockResolvedValue({
        possui_pagamento_valido_mesma_assinatura: false,
        possui_historico_pago_anterior: true,
        outra_assinatura_ativa_id: 19,
        plano_ativo_anterior_id: 2,
        ultimo_plano_pago_anterior_id: 2,
      });

    await service.registrarConfirmacaoPagamento({
      client,
      assinatura: assinatura(),
      pagamentoId: 52,
      asaasPaymentId: "pay_52",
    });

    expect(repository.registrar)
      .toHaveBeenCalledWith(
        client,
        expect.objectContaining({
          tipo: "PLANO_ALTERADO",
          motivo: "ASSINATURA_PAGA_VIGENTE",
          planoAnteriorId: 2,
          planoNovoId: 3,
        })
      );
  });

  test("nova assinatura depois de histórico pago sem plano vigente vira reativação", async () => {
    repository.buscarContextoPagamento
      .mockResolvedValue({
        possui_pagamento_valido_mesma_assinatura: false,
        possui_historico_pago_anterior: true,
        outra_assinatura_ativa_id: null,
        ultimo_plano_pago_anterior_id: 2,
      });

    await service.registrarConfirmacaoPagamento({
      client,
      assinatura: assinatura(),
      pagamentoId: 53,
      asaasPaymentId: "pay_53",
    });

    expect(repository.registrar)
      .toHaveBeenCalledWith(
        client,
        expect.objectContaining({
          tipo: "REATIVACAO_PAGA",
          motivo: "RETORNO_APOS_SAIDA_PAGA",
          planoAnteriorId: 2,
          planoNovoId: 3,
        })
      );
  });

  test("mesma assinatura depois de episódio encerrado vira reativação", async () => {
    repository.buscarContextoPagamento
      .mockResolvedValue({
        ultimo_evento_episodio_tipo:
          "ACESSO_PAGO_ENCERRADO",
        possui_pagamento_valido_mesma_assinatura: true,
        possui_historico_pago_anterior: true,
        outra_assinatura_ativa_id: null,
        ultimo_plano_pago_anterior_id: null,
        plano_negocio_atual_id: 1,
      });
    repository.teveEventoPagamento
      .mockResolvedValue(true);

    await service.registrarConfirmacaoPagamento({
      client,
      assinatura: assinatura(),
      pagamentoId: 55,
      asaasPaymentId: "pay_55",
    });

    expect(
      repository.registrar.mock.calls
        .map(([, dados]) => dados.tipo)
    ).toEqual([
      "REATIVACAO_PAGA",
      "PAGAMENTO_RECUPERADO",
    ]);
    expect(
      repository.registrar.mock.calls[0][1]
    ).toMatchObject({
      motivo: "RETORNO_APOS_SAIDA_PAGA",
      planoAnteriorId: 3,
    });
  });

  test("estorno e chargeback viram reversão financeira, não atraso", async () => {
    await service.registrarSuspensaoFinanceira({
      client,
      assinatura: assinatura(),
      pagamentoId: 54,
      status: "CHARGEBACK_DISPUTE",
      planoNovoId: 1,
    });

    expect(repository.registrar)
      .toHaveBeenCalledWith(
        client,
        expect.objectContaining({
          tipo: "REVERSAO_FINANCEIRA",
          motivo: "CHARGEBACK_DISPUTE",
          planoAnteriorId: 3,
          planoNovoId: 1,
        })
      );
    expect(
      repository.registrar.mock.calls[0][1].tipo
    ).not.toBe("PAGAMENTO_ATRASADO");
  });

  test("encerramento herda o motivo do cancelamento canônico", async () => {
    repository.buscarUltimoPorAssinaturaETipo
      .mockResolvedValue({
        motivo: "CANCELAMENTO_VOLUNTARIO",
      });

    await service.registrarEncerramentoAcesso({
      client,
      assinatura: {
        ...assinatura(),
        data_proxima_cobranca: "2026-10-23",
      },
    });

    expect(repository.registrar)
      .toHaveBeenCalledWith(
        client,
        expect.objectContaining({
          tipo: "ACESSO_PAGO_ENCERRADO",
          motivo: "CANCELAMENTO_VOLUNTARIO",
          chaveIdempotencia:
            "assinatura:20:ACESSO_PAGO_ENCERRADO:2026-10-23",
        })
      );
  });
});
