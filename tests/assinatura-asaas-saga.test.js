let emTransacao = false;

jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao: jest.fn(
      async (callback) => {
        emTransacao = true;
        try {
          return await callback({
            query: jest.fn()
          });
        } finally {
          emTransacao = false;
        }
      }
    )
  })
);

jest.mock(
  "../src/repositories/pagamentoRepository",
  () => ({
    atualizarStatusPagamento: jest.fn()
  })
);

jest.mock(
  "../src/repositories/assinaturaAtivacaoRepository",
  () => ({
    buscarContextoPagamento: jest.fn(),
    bloquearNegocio: jest.fn(),
    buscarAssinaturaAtivaMaisNova: jest.fn(),
    vincularRecorrenciaAsaas: jest.fn(),
    desativarAssinaturasConcorrentes: jest.fn(),
    ativarAssinatura: jest.fn(),
    atualizarPlanoNegocio: jest.fn(),
    listarRecorrenciasSubstituidas: jest.fn(),
    existeVinculoRecorrenciaAsaas: jest.fn()
  })
);

jest.mock(
  "../src/services/asaasService",
  () => ({
    criarAssinaturaAsaas: jest.fn(),
    buscarAssinaturaPorReferencia:
      jest.fn(),
    removerAssinaturaAsaas: jest.fn()
  })
);

jest.mock(
  "../src/services/assinaturaServiceCore",
  () => ({
    sincronizarPagamentoPorWebhook: jest.fn()
  })
);

jest.mock(
  "../src/services/equipePlanoService",
  () => ({
    reconciliarLimiteProfissionais:
      jest.fn().mockResolvedValue([])
  })
);

const pagamentoRepository = require(
  "../src/repositories/pagamentoRepository"
);
const assinaturaAtivacaoRepository = require(
  "../src/repositories/assinaturaAtivacaoRepository"
);
const {
  criarAssinaturaAsaas,
  removerAssinaturaAsaas
} = require("../src/services/asaasService");
const {
  sincronizarPagamentoPorWebhook
} = require(
  "../src/services/assinaturaServiceCore"
);
const {
  ativarAssinaturaPorPagamento
} = require(
  "../src/services/assinaturaAtivacaoAsaasService"
);

function contexto(overrides = {}) {
  return {
    pagamento_id: 31,
    id: 20,
    negocio_id: 7,
    plano_id: 3,
    asaas_customer_id: "cus_1",
    asaas_subscription_id: null,
    forma_pagamento: "pix",
    valor: 99.9,
    status: "PENDING",
    ativo: false,
    data_pagamento: "2026-09-13",
    data_vencimento: "2026-09-13",
    data_proxima_cobranca: null,
    observacoes: null,
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  emTransacao = false;

  sincronizarPagamentoPorWebhook
    .mockResolvedValue({
      id: 31,
      status: "CONFIRMED"
    });

  assinaturaAtivacaoRepository
    .buscarContextoPagamento
    .mockResolvedValue(contexto());
  assinaturaAtivacaoRepository
    .bloquearNegocio
    .mockResolvedValue({ id: 7 });
  assinaturaAtivacaoRepository
    .buscarAssinaturaAtivaMaisNova
    .mockResolvedValue(null);
  assinaturaAtivacaoRepository
    .vincularRecorrenciaAsaas
    .mockResolvedValue({
      asaas_subscription_id: "sub_new"
    });
  assinaturaAtivacaoRepository
    .desativarAssinaturasConcorrentes
    .mockResolvedValue({ rowCount: 1 });
  assinaturaAtivacaoRepository
    .ativarAssinatura
    .mockResolvedValue({
      ...contexto(),
      status: "ACTIVE",
      ativo: true,
      asaas_subscription_id: "sub_new"
    });
  assinaturaAtivacaoRepository
    .atualizarPlanoNegocio
    .mockResolvedValue({
      id: 7,
      plano_id: 3
    });
  assinaturaAtivacaoRepository
    .listarRecorrenciasSubstituidas
    .mockResolvedValue(["sub_old"]);
  assinaturaAtivacaoRepository
    .existeVinculoRecorrenciaAsaas
    .mockResolvedValue(false);

  pagamentoRepository
    .atualizarStatusPagamento
    .mockResolvedValue({
      id: 31,
      status: "CONFIRMED"
    });

  criarAssinaturaAsaas
    .mockImplementation(async () => {
      expect(emTransacao).toBe(false);
      return {
        id: "sub_new",
        nextDueDate: "2026-10-13"
      };
    });

  removerAssinaturaAsaas
    .mockImplementation(async () => {
      expect(emTransacao).toBe(false);
      return true;
    });
});

test(
  "cria e remove recorrências Asaas fora das transações do banco",
  async () => {
    const resultado =
      await ativarAssinaturaPorPagamento(
        "pay_1",
        "CONFIRMED",
        {
          webhookEventoId: "evt_1",
          webhookEventoCriadoEm:
            "2026-09-13 20:00:00"
        }
      );

    expect(criarAssinaturaAsaas)
      .toHaveBeenCalledTimes(1);
    expect(removerAssinaturaAsaas)
      .toHaveBeenCalledWith("sub_old");
    expect(
      assinaturaAtivacaoRepository
        .buscarAssinaturaAtivaMaisNova
    ).toHaveBeenCalledWith(
      expect.anything(),
      7,
      20
    );
    expect(resultado)
      .toEqual(
        expect.objectContaining({
          id: 20,
          status: "ACTIVE",
          asaas_subscription_id:
            "sub_new"
        })
      );
  }
);

test(
  "renovação reutiliza a recorrência existente e não cria outra no Asaas",
  async () => {
    assinaturaAtivacaoRepository
      .buscarContextoPagamento
      .mockResolvedValue(
        contexto({
          status: "ACTIVE",
          ativo: true,
          asaas_subscription_id:
            "sub_existing",
          data_proxima_cobranca:
            "2026-10-13"
        })
      );
    assinaturaAtivacaoRepository
      .ativarAssinatura
      .mockResolvedValue({
        ...contexto(),
        status: "ACTIVE",
        ativo: true,
        asaas_subscription_id:
          "sub_existing"
      });
    assinaturaAtivacaoRepository
      .listarRecorrenciasSubstituidas
      .mockResolvedValue([]);

    await ativarAssinaturaPorPagamento(
      "pay_renewal",
      "RECEIVED",
      {
        confirmedDate: "2026-09-13",
        webhookEventoId: "evt_renewal",
        webhookEventoCriadoEm:
          "2026-09-13 21:00:00"
      }
    );

    expect(criarAssinaturaAsaas)
      .not.toHaveBeenCalled();
    expect(
      assinaturaAtivacaoRepository
        .vincularRecorrenciaAsaas
    ).not.toHaveBeenCalled();
  }
);

test(
  "compensa a recorrência criada quando um evento mais novo vence a finalização",
  async () => {
    pagamentoRepository
      .atualizarStatusPagamento
      .mockResolvedValue(null);

    const resultado =
      await ativarAssinaturaPorPagamento(
        "pay_stale",
        "CONFIRMED",
        {
          webhookEventoId: "evt_old",
          webhookEventoCriadoEm:
            "2026-09-13 19:00:00"
        }
      );

    expect(resultado).toBeNull();
    expect(
      assinaturaAtivacaoRepository
        .existeVinculoRecorrenciaAsaas
    ).toHaveBeenCalledWith(
      "sub_new"
    );
    expect(removerAssinaturaAsaas)
      .toHaveBeenCalledWith("sub_new");
    expect(
      assinaturaAtivacaoRepository
        .ativarAssinatura
    ).not.toHaveBeenCalled();
  }
);

test(
  "não chama o Asaas quando o pagamento não pertence mais a uma ativação aplicável",
  async () => {
    sincronizarPagamentoPorWebhook
      .mockResolvedValue(null);

    const resultado =
      await ativarAssinaturaPorPagamento(
        "pay_sem_vinculo",
        "CONFIRMED",
        {
          webhookEventoId: "evt_sem_vinculo"
        }
      );

    expect(resultado).toBeNull();
    expect(criarAssinaturaAsaas)
      .not.toHaveBeenCalled();
    expect(removerAssinaturaAsaas)
      .not.toHaveBeenCalled();
  }
);
