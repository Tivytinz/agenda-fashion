const mockClient = {
  query: jest.fn()
};

jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao:
      jest.fn(
        async (callback) =>
          callback(mockClient)
      )
  })
);

jest.mock(
  "../src/repositories/assinaturaRepository"
);

jest.mock(
  "../src/services/asaasService",
  () => ({
    criarAssinaturaAsaas: jest.fn(),
    buscarAssinaturaPorReferencia:
      jest.fn()
  })
);

jest.mock(
  "../src/utils/registrador",
  () => ({
    aviso: jest.fn()
  })
);

const assinaturaRepository = require(
  "../src/repositories/assinaturaRepository"
);
const {
  criarAssinaturaAsaas,
  buscarAssinaturaPorReferencia
} = require(
  "../src/services/asaasService"
);
const registrador = require(
  "../src/utils/registrador"
);
const {
  reconciliarReativacaoAbandonada,
  reativarMinhaAssinatura
} = require(
  "../src/services/assinaturaReativacaoService"
);

function cancelada(
  overrides = {}
) {
  return {
    id: 20,
    negocio_id: 7,
    plano_id: 2,
    status: "CANCELED",
    ativo: true,
    forma_pagamento: "pix",
    asaas_customer_id: "cus_1",
    asaas_subscription_id:
      "sub_antiga",
    valor: "49.90",
    data_proxima_cobranca:
      "2026-10-18",
    ...overrides
  };
}

describe(
  "Reativação da renovação",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockClient.query.mockReset();

      assinaturaRepository
        .buscarNegocioDono
        .mockResolvedValue({
          id: 7,
          plano_id: 2
        });
      assinaturaRepository
        .buscarReativacaoAbandonada
        .mockResolvedValue(null);
      assinaturaRepository
        .expirarCancelamentoSeNecessario
        .mockResolvedValue(null);
      assinaturaRepository
        .buscarPlano
        .mockResolvedValue({
          id: 2,
          nome: "Autônoma",
          slug: "autonoma",
          valor: 49.9
        });
    });

    test(
      "reativa na data já paga sem cobrança imediata",
      async () => {
        const assinatura = cancelada();

        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue(
            assinatura
          );
        assinaturaRepository
          .reservarReativacao
          .mockResolvedValue({
            ...assinatura,
            status: "REACTIVATING"
          });
        criarAssinaturaAsaas
          .mockResolvedValue({
            id: "sub_nova",
            status: "ACTIVE",
            nextDueDate:
              "2026-10-18"
          });
        assinaturaRepository
          .registrarReativacao
          .mockResolvedValue({
            ...assinatura,
            status: "ACTIVE",
            asaas_subscription_id:
              "sub_nova"
          });

        const resultado =
          await reativarMinhaAssinatura({
            usuarioId: 10
          });

        expect(
          assinaturaRepository
            .reservarReativacao
        ).toHaveBeenCalledWith(
          mockClient,
          {
            assinaturaId: 20,
            negocioId: 7
          }
        );
        expect(
          criarAssinaturaAsaas
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            customerId: "cus_1",
            valor: "49.90",
            formaPagamento: "pix",
            proximaCobranca:
              "2026-10-18",
            externalReference:
              "assinatura-reativada:20;inicio:2026-10-18",
            reutilizarPorExternalReference:
              true
          })
        );
        expect(
          assinaturaRepository
            .registrarReativacao
        ).toHaveBeenCalledWith(
          mockClient,
          expect.objectContaining({
            assinaturaId: 20,
            negocioId: 7,
            asaasSubscriptionId:
              "sub_nova"
          })
        );
        expect(
          resultado.assinatura.status
        ).toBe("ACTIVE");
      }
    );

    test(
      "recupera crash quando a recorrência já existe no Asaas",
      async () => {
        const pendente = cancelada({
          status: "REACTIVATING"
        });

        assinaturaRepository
          .buscarReativacaoAbandonada
          .mockResolvedValue(
            pendente
          );
        buscarAssinaturaPorReferencia
          .mockResolvedValue({
            id: "sub_recuperada",
            status: "ACTIVE",
            nextDueDate:
              "2026-10-18"
          });
        assinaturaRepository
          .registrarReativacao
          .mockResolvedValue({
            ...pendente,
            status: "ACTIVE",
            asaas_subscription_id:
              "sub_recuperada"
          });

        const resultado =
          await reconciliarReativacaoAbandonada(
            7
          );

        expect(
          buscarAssinaturaPorReferencia
        ).toHaveBeenCalledWith({
          externalReference:
            "assinatura-reativada:20;inicio:2026-10-18",
          customerId:
            "cus_1"
        });
        expect(
          assinaturaRepository
            .registrarReativacao
        ).toHaveBeenCalledWith(
          mockClient,
          expect.objectContaining({
            assinaturaId: 20,
            negocioId: 7,
            asaasSubscriptionId:
              "sub_recuperada"
          })
        );
        expect(resultado.status)
          .toBe("ACTIVE");
      }
    );

    test(
      "restaura cancelamento quando a consulta confirma ausência de recorrência",
      async () => {
        const pendente = cancelada({
          status: "REACTIVATING"
        });

        assinaturaRepository
          .buscarReativacaoAbandonada
          .mockResolvedValue(
            pendente
          );
        buscarAssinaturaPorReferencia
          .mockResolvedValue(null);
        assinaturaRepository
          .restaurarCancelamentoReativacao
          .mockResolvedValue({
            ...pendente,
            status: "CANCELED"
          });

        const resultado =
          await reconciliarReativacaoAbandonada(
            7
          );

        expect(
          assinaturaRepository
            .restaurarCancelamentoReativacao
        ).toHaveBeenCalledWith(
          mockClient,
          {
            assinaturaId: 20,
            negocioId: 7
          }
        );
        expect(resultado.status)
          .toBe("CANCELED");
      }
    );

    test(
      "falha ao consultar o Asaas preserva REACTIVATING para nova reconciliação",
      async () => {
        const pendente = cancelada({
          status: "REACTIVATING"
        });

        assinaturaRepository
          .buscarReativacaoAbandonada
          .mockResolvedValue(
            pendente
          );
        buscarAssinaturaPorReferencia
          .mockRejectedValue(
            Object.assign(
              new Error("timeout"),
              {
                code: "ETIMEDOUT"
              }
            )
          );

        await expect(
          reconciliarReativacaoAbandonada(
            7
          )
        ).resolves.toBeNull();

        expect(
          assinaturaRepository
            .restaurarCancelamentoReativacao
        ).not.toHaveBeenCalled();
        expect(
          assinaturaRepository
            .registrarReativacao
        ).not.toHaveBeenCalled();
        expect(registrador.aviso)
          .toHaveBeenCalledWith(
            "Assinatura: não foi possível reconciliar reativação pendente no Asaas.",
            expect.objectContaining({
              assinatura_id: 20,
              negocio_id: 7,
              codigo: "ETIMEDOUT"
            })
          );
      }
    );

    test(
      "não cria outra recorrência enquanto uma reativação recente está em andamento",
      async () => {
        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue(
            cancelada({
              status:
                "REACTIVATING"
            })
          );

        await expect(
          reativarMinhaAssinatura({
            usuarioId: 10
          })
        ).rejects.toMatchObject({
          statusCode: 409,
          message:
            "A reativação da renovação já está sendo processada. Tente novamente em alguns instantes."
        });

        expect(
          criarAssinaturaAsaas
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "erro ambíguo após reservar não restaura cancelamento às cegas",
      async () => {
        const assinatura = cancelada();

        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue(
            assinatura
          );
        assinaturaRepository
          .reservarReativacao
          .mockResolvedValue({
            ...assinatura,
            status: "REACTIVATING"
          });
        criarAssinaturaAsaas
          .mockRejectedValue(
            new Error(
              "conexão interrompida"
            )
          );

        await expect(
          reativarMinhaAssinatura({
            usuarioId: 10
          })
        ).rejects.toThrow(
          "conexão interrompida"
        );

        expect(
          assinaturaRepository
            .restaurarCancelamentoReativacao
        ).not.toHaveBeenCalled();
      }
    );
  }
);
