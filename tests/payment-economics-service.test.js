const mockBuscarPagamentoAsaas =
  jest.fn();
const mockListarEstornos =
  jest.fn();
const mockPersistir =
  jest.fn();

jest.mock(
  "../src/services/asaasService",
  () => ({
    buscarPagamentoAsaas:
      mockBuscarPagamentoAsaas,
    listarEstornosPagamentoAsaas:
      mockListarEstornos,
  })
);

jest.mock(
  "../src/repositories/paymentEconomicsRepository",
  () => ({
    persistirReconciliacao:
      mockPersistir,
  })
);

const service = require(
  "../src/services/paymentEconomicsService"
);

describe("paymentEconomicsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPersistir.mockResolvedValue({
      pagamento_id: 7,
    });
  });

  test("não converte netValue ausente em taxa zero", () => {
    expect(
      service.classificarEconomia({
        pagamento: {
          status: "RECEIVED",
          value: 99.9,
          netValue: null,
        },
        estornos: [],
      })
    ).toMatchObject({
      valorBruto: 99.9,
      valorLiquidoGateway: null,
      statusReconciliacao:
        "DADOS_GATEWAY_INCOMPLETOS",
    });
  });

  test("distingue confirmação de liquidação e preserva creditDate", () => {
    expect(
      service.classificarEconomia({
        pagamento: {
          status: "CONFIRMED",
          value: 99.9,
          netValue: 98,
          creditDate: "2026-09-25",
        },
        estornos: [],
      })
    ).toMatchObject({
      dataCredito: "2026-09-25",
      statusReconciliacao:
        "AGUARDANDO_LIQUIDACAO",
    });

    expect(
      service.classificarEconomia({
        pagamento: {
          status: "RECEIVED",
          value: 99.9,
          netValue: 98,
          creditDate: "2026-09-25",
        },
        estornos: [],
      })
    ).toMatchObject({
      valorLiquidoGateway: 98,
      dataCredito: "2026-09-25",
      statusReconciliacao:
        "COMPLETO",
    });
  });

  test("refund pendente e chargeback permanecem não terminais", () => {
    expect(
      service.classificarEconomia({
        pagamento: {
          status: "PARTIALLY_REFUNDED",
          value: 100,
          netValue: 98,
        },
        estornos: [{
          status: "PENDING",
          valor: 20,
        }],
      }).statusReconciliacao
    ).toBe("REFUND_EM_PROCESSAMENTO");

    expect(
      service.classificarEconomia({
        pagamento: {
          status: "CHARGEBACK_DISPUTE",
          value: 100,
          netValue: 98,
        },
        estornos: [],
      }).statusReconciliacao
    ).toBe("CHARGEBACK_EM_DISPUTA");
  });

  test("não marca refund como completo sem ledger factual", () => {
    expect(
      service.classificarEconomia({
        pagamento: {
          status: "REFUNDED",
          value: 100,
          netValue: 98,
        },
        estornos: [],
      }).statusReconciliacao
    ).toBe("REVERSAO_NAO_RECONCILIADA");

    expect(
      service.classificarEconomia({
        pagamento: {
          status: "PARTIALLY_REFUNDED",
          value: 100,
          netValue: 98,
        },
        estornos: [{
          status: "DONE",
          valor: 20,
        }],
      }).statusReconciliacao
    ).toBe("COMPLETO");
  });

  test("normaliza múltiplos refunds com chaves estáveis mesmo se a ordem mudar", () => {
    const refundA = {
      dateCreated: "2026-09-23 10:00:00",
      value: 10,
      description: "parcial A",
      status: "DONE",
    };
    const refundB = {
      dateCreated: "2026-09-23 11:00:00",
      value: 15,
      description: "parcial B",
      status: "DONE",
    };

    const original =
      service.normalizarEstornos([
        refundA,
        refundB,
      ]);
    const invertido =
      service.normalizarEstornos([
        refundB,
        refundA,
      ]);

    expect(
      new Set(
        original.map(
          (item) => item.chaveProvedor
        )
      )
    ).toEqual(
      new Set(
        invertido.map(
          (item) => item.chaveProvedor
        )
      )
    );
    expect(
      original.reduce(
        (total, item) =>
          total + item.valor,
        0
      )
    ).toBe(25);
  });

  test("usa o identificador do provedor quando disponível", () => {
    const [normalizado] =
      service.normalizarEstornos([{
        id: "ref_123",
        dateCreated: "2026-09-23 10:00:00",
        value: 10,
        description: "parcial",
        status: "DONE",
      }]);

    const [mesmo] =
      service.normalizarEstornos([{
        id: "ref_123",
        dateCreated: "2026-09-24 10:00:00",
        value: 15,
        description: "texto alterado",
        status: "DONE",
      }]);

    expect(normalizado.chaveProvedor)
      .toBe(mesmo.chaveProvedor);
  });

  test("consulta sempre o endpoint canônico de refunds em cobrança estornada", async () => {
    mockBuscarPagamentoAsaas
      .mockResolvedValue({
        id: "pay_1",
        status: "PARTIALLY_REFUNDED",
        value: 100,
        netValue: 98,
        refunds: [{
          id: "embedded_stale",
          value: 5,
          status: "DONE",
        }],
      });
    mockListarEstornos.mockResolvedValue([
      {
        dateCreated:
          "2026-09-23 10:00:00",
        value: 20,
        status: "DONE",
      },
    ]);

    await service.reconciliarPagamento({
      pagamento_id: 7,
      asaas_payment_id: "pay_1",
      asaas_ultimo_evento_em:
        "2026-09-23 12:00:00",
      asaas_ultimo_evento_id:
        "evt_1",
    });

    expect(mockListarEstornos)
      .toHaveBeenCalledWith("pay_1");
    expect(mockPersistir)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          pagamentoId: 7,
          estornos: [
            expect.objectContaining({
              valor: 20,
              status: "DONE",
            }),
          ],
          economia:
            expect.objectContaining({
              statusReconciliacao:
                "COMPLETO",
            }),
        })
      );
  });
});
