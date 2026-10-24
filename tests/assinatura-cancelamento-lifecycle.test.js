jest.mock("../src/repositories/assinaturaCheckoutRepository");
beforeEach(() => {
  require("../src/repositories/assinaturaCheckoutRepository").listarPendentes.mockResolvedValue([]);
  require("../src/repositories/assinaturaCheckoutRepository").listarNegociosPendentes.mockResolvedValue([]);
});
const mockClient = {
  query: jest.fn(),
};

jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao: jest.fn(
      async (callback) => callback(mockClient)
    ),
  })
);

jest.mock(
  "../src/repositories/assinaturaRepository"
);

jest.mock(
  "../src/services/asaasService",
  () => ({
    removerAssinaturaAsaas:
      jest.fn().mockResolvedValue({
        removida: true,
      }),
  })
);

jest.mock(
  "../src/services/planoService",
  () => ({
    buscarUsoPlano: jest.fn(),
  })
);

jest.mock(
  "../src/services/assinaturaLifecycleService",
  () => ({
    registrarCancelamentoRenovacao:
      jest.fn().mockResolvedValue(null),
  })
);

const assinaturaRepository = require(
  "../src/repositories/assinaturaRepository"
);
const lifecycle = require(
  "../src/services/assinaturaLifecycleService"
);
const asaas = require("../src/services/asaasService");
const {
  cancelarMinhaAssinatura,
} = require(
  "../src/services/assinaturaContaService"
);

describe("cancelamento de assinatura - lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    assinaturaRepository.buscarNegocioDono
      .mockResolvedValue({
        id: 7,
        plano_id: 2,
      });
    assinaturaRepository
      .buscarAssinaturaAtivaPorNegocio
      .mockResolvedValue({
        id: 20,
        negocio_id: 7,
        plano_id: 2,
        status: "ACTIVE",
        ativo: true,
        asaas_subscription_id: "sub_20",
        data_proxima_cobranca: "2026-10-23",
      });
    assinaturaRepository.buscarAssinaturaParaCancelar.mockImplementation(
      () => assinaturaRepository.buscarAssinaturaAtivaPorNegocio()
    );
    assinaturaRepository.listarPagamentos
      .mockResolvedValue([
        {
          id: 50,
          status: "RECEIVED",
          data_pagamento: "2026-09-23",
        },
      ]);
    assinaturaRepository.registrarCancelamento
      .mockResolvedValue({
        id: 20,
        negocio_id: 7,
        plano_id: 2,
        status: "CANCELED",
        ativo: true,
        data_proxima_cobranca: "2026-10-23",
      });
  });

  test("registra renovação cancelada na mesma transação local", async () => {
    const resultado =
      await cancelarMinhaAssinatura({
        usuarioId: 10,
      });

    expect(lifecycle.registrarCancelamentoRenovacao)
      .toHaveBeenCalledWith({
        client: mockClient,
        assinatura: expect.objectContaining({
          id: 20,
          status: "CANCELED",
        }),
        acessoAte: "2026-10-23",
        origem: "conta",
        motivo: "CANCELAMENTO_VOLUNTARIO",
      });

    expect(resultado.acesso_ate)
      .toBe("2026-10-23");
  });

  test("sem pagamentos locais usa a data civil DATE da assinatura", async () => {
    const { types } = require("pg");
    assinaturaRepository.buscarAssinaturaAtivaPorNegocio.mockResolvedValue({
      id: 20, negocio_id: 7, plano_id: 2, status: "ACTIVE", ativo: true,
      asaas_subscription_id: "sub_20", data_proxima_cobranca: types.getTypeParser(1082)("2099-12-01"),
    });
    assinaturaRepository.listarPagamentos.mockResolvedValue([]);
    await cancelarMinhaAssinatura({ usuarioId: 10 });
    expect(assinaturaRepository.registrarCancelamento).toHaveBeenCalledWith(mockClient,
      expect.objectContaining({ acessoAte: "2099-12-01" }));
  });

  test("pagamento sem data paga calcula o período a partir do vencimento civil DATE", async () => {
    const { types } = require("pg");
    assinaturaRepository.listarPagamentos.mockResolvedValue([
      { status: "RECEIVED", data_pagamento: null, data_vencimento: types.getTypeParser(1082)("2099-12-01") },
    ]);
    await cancelarMinhaAssinatura({ usuarioId: 10 });
    expect(assinaturaRepository.registrarCancelamento).toHaveBeenCalledWith(mockClient,
      expect.objectContaining({ acessoAte: "2100-01-01" }));
  });

  test("pagamento recebido sem datas preserva o período conhecido", async () => {
    assinaturaRepository.listarPagamentos.mockResolvedValue([
      { status: "RECEIVED", data_pagamento: null, data_vencimento: null },
    ]);
    await cancelarMinhaAssinatura({ usuarioId: 10 });
    expect(assinaturaRepository.registrarCancelamento).toHaveBeenCalledWith(mockClient,
      expect.objectContaining({ acessoAte: "2026-10-23", asaasSubscriptionId: "sub_20", reativacaoTentativa: 0 }));
  });

  test("ignora recebido sem data e escolhe outro recebido com calendário válido", async () => {
    assinaturaRepository.listarPagamentos.mockResolvedValue([
      { status: "RECEIVED", data_pagamento: null, data_vencimento: null },
      { status: "CONFIRMED", data_pagamento: "2099-11-30", data_vencimento: null },
    ]);
    await cancelarMinhaAssinatura({ usuarioId: 10 });
    expect(assinaturaRepository.registrarCancelamento).toHaveBeenCalledWith(mockClient,
      expect.objectContaining({ acessoAte: "2099-12-30" }));
  });

  test("sem qualquer data confiável recusa antes de remover a recorrência", async () => {
    assinaturaRepository.buscarAssinaturaAtivaPorNegocio.mockResolvedValue({
      id: 20, negocio_id: 7, status: "ACTIVE", ativo: true, asaas_subscription_id: "sub_20",
      data_proxima_cobranca: null,
    });
    assinaturaRepository.listarPagamentos.mockResolvedValue([
      { status: "RECEIVED", data_pagamento: null, data_vencimento: null },
      { status: "PENDING", data_vencimento: "2099-12-01" },
    ]);
    await expect(cancelarMinhaAssinatura({ usuarioId: 10 })).rejects.toMatchObject({ status: 409 });
    expect(asaas.removerAssinaturaAsaas).not.toHaveBeenCalled();
    expect(assinaturaRepository.registrarCancelamento).not.toHaveBeenCalled();
  });

  test("cobrança pendente não comprova extensão do período conhecido", async () => {
    assinaturaRepository.listarPagamentos.mockResolvedValue([
      { status: "RECEIVED", data_pagamento: null, data_vencimento: null },
      { status: "PENDING", data_vencimento: "2099-12-01" },
    ]);
    await cancelarMinhaAssinatura({ usuarioId: 10 });
    expect(assinaturaRepository.registrarCancelamento).toHaveBeenCalledWith(mockClient,
      expect.objectContaining({ acessoAte: "2026-10-23" }));
  });

  test("cancelamento obsoleto exige atualização e não gera evento", async () => {
    assinaturaRepository.registrarCancelamento.mockResolvedValue(null);
    await expect(cancelarMinhaAssinatura({ usuarioId: 10 })).rejects.toMatchObject({
      status: 409, codigo: "ASSINATURA_ALTERADA",
    });
    expect(lifecycle.registrarCancelamentoRenovacao).not.toHaveBeenCalled();
  });
});
