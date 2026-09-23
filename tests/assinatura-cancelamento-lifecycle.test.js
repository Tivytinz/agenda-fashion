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
});
