jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao: jest.fn(
      async (callback) =>
        callback({
          query: jest.fn()
        })
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
    buscarAssinaturaAtivaMaisNova: jest.fn(),
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
    sincronizarPagamentoPorWebhook:
      jest.fn()
  })
);

const assinaturaAtivacaoRepository = require(
  "../src/repositories/assinaturaAtivacaoRepository"
);
const {
  criarAssinaturaAsaas,
  buscarAssinaturaPorReferencia,
  removerAssinaturaAsaas
} = require(
  "../src/services/asaasService"
);
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

describe(
  "Preflight de ativação financeira obsoleta",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      sincronizarPagamentoPorWebhook
        .mockResolvedValue({
          id: 31,
          status: "CONFIRMED"
        });

      assinaturaAtivacaoRepository
        .buscarContextoPagamento
        .mockResolvedValue({
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
          data_vencimento: "2026-09-13"
        });

      assinaturaAtivacaoRepository
        .buscarAssinaturaAtivaMaisNova
        .mockResolvedValue({
          id: 30
        });

      assinaturaAtivacaoRepository
        .existeVinculoRecorrenciaAsaas
        .mockResolvedValue(false);

      buscarAssinaturaPorReferencia
        .mockResolvedValue({
          id: "sub_orfa"
        });

      removerAssinaturaAsaas
        .mockResolvedValue({
          removida: true
        });
    });

    test(
      "não cria recorrência e remove somente uma recorrência órfã já existente",
      async () => {
        const resultado =
          await ativarAssinaturaPorPagamento(
            "pay_antigo",
            "CONFIRMED",
            {
              status: "CONFIRMED",
              webhookEventoId: "evt_antigo",
              webhookEventoCriadoEm:
                "2026-09-13 18:00:00"
            }
          );

        expect(resultado).toBeNull();
        expect(criarAssinaturaAsaas)
          .not.toHaveBeenCalled();
        expect(buscarAssinaturaPorReferencia)
          .toHaveBeenCalledWith({
            externalReference:
              "assinatura:20;negocio:7;plano:3",
            customerId: "cus_1"
          });
        expect(
          assinaturaAtivacaoRepository
            .existeVinculoRecorrenciaAsaas
        ).toHaveBeenCalledWith(
          "sub_orfa"
        );
        expect(removerAssinaturaAsaas)
          .toHaveBeenCalledWith(
            "sub_orfa"
          );
      }
    );
  }
);
