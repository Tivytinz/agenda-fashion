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
    removerAssinaturaAsaas: jest.fn()
  })
);

jest.mock(
  "../src/services/planoService",
  () => ({
    buscarUsoPlano: jest.fn()
  })
);

const assinaturaRepository = require(
  "../src/repositories/assinaturaRepository"
);
const { buscarUsoPlano } = require(
  "../src/services/planoService"
);
const {
  buscarMinhaAssinatura,
  reativarMinhaAssinatura
} = require(
  "../src/services/assinaturaContaService"
);
const {
  criarAssinaturaAsaas
} = require(
  "../src/services/asaasService"
);

describe(
  "Conta de assinatura",
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
        .expirarCancelamentoSeNecessario
        .mockResolvedValue(null);
      assinaturaRepository
        .buscarPlano
        .mockImplementation(async (id) => (
          Number(id) === 3
            ? {
                id: 3,
                nome: "Studio",
                slug: "studio",
                valor: 99.9
              }
            : {
                id: 2,
                nome: "Autônoma",
                slug: "autonoma",
                valor: 49.9
              }
        ));
      assinaturaRepository
        .buscarUltimoPagamentoPendente
        .mockResolvedValue({
          id: 60,
          status: "PENDING",
          pix_copia_cola: "000201PIX",
          pix_qrcode: "imagem"
        });
      assinaturaRepository
        .listarPagamentos
        .mockResolvedValue([
          {
            id: 50,
            assinatura_id: 20,
            status: "RECEIVED"
          }
        ]);
      buscarUsoPlano.mockResolvedValue({
        plano_id: 2,
        plano_nome: "Autônoma",
        plano_slug: "autonoma",
        utilizados: 3,
        capacidade_agendamentos: 20,
        limite_profissionais: 1,
        limite_servicos: 4
      });
    });

    test(
      "mantém a assinatura ativa separada de um upgrade pendente",
      async () => {
        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue({
            id: 20,
            negocio_id: 7,
            plano_id: 2,
            status: "ACTIVE",
            ativo: true
          });
        assinaturaRepository
          .buscarAssinaturaPendentePorNegocio
          .mockResolvedValue({
            id: 21,
            negocio_id: 7,
            plano_id: 3,
            status: "PENDING",
            ativo: false
          });

        const resultado =
          await buscarMinhaAssinatura({
            usuarioId: 10
          });

        expect(resultado.plano)
          .toMatchObject({
            id: 2,
            slug: "autonoma"
          });
        expect(resultado.assinatura)
          .toMatchObject({
            id: 20,
            status: "ACTIVE",
            ativo: true
          });
        expect(resultado.upgrade_pendente)
          .toMatchObject({
            assinatura: {
              id: 21,
              status: "PENDING"
            },
            plano: {
              id: 3,
              slug: "studio"
            },
            pagamento: {
              id: 60,
              status: "PENDING",
              pix_copia_cola: "000201PIX"
            }
          });
        expect(
          assinaturaRepository
            .buscarUltimoPagamentoPendente
        ).toHaveBeenCalledWith(21);
        expect(
          assinaturaRepository
            .listarPagamentos
        ).toHaveBeenCalledWith(20);
        expect(resultado.uso.plano_nome)
          .toBe("Autônoma");
      }
    );

    test(
      "mantém pagamento confirmado visível como ativação que requer atenção",
      async () => {
        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue(null);
        assinaturaRepository
          .buscarAssinaturaPendentePorNegocio
          .mockResolvedValue({
            id: 21,
            negocio_id: 7,
            plano_id: 3,
            status: "PENDING",
            ativo: false
          });
        assinaturaRepository
          .buscarUltimoPagamentoPendente
          .mockResolvedValue({
            id: 61,
            status: "CONFIRMED",
            ativacao_requer_atencao: true
          });

        const resultado =
          await buscarMinhaAssinatura({
            usuarioId: 10
          });

        expect(
          resultado.upgrade_pendente
            .pagamento.estado_ativacao
        ).toBe("ATIVACAO_REQUER_ATENCAO");
      }
    );

    test(
      "reativa renovação na data já paga sem cobrança imediata",
      async () => {
        const cancelada = {
          id: 20,
          negocio_id: 7,
          plano_id: 2,
          status: "CANCELED",
          ativo: true,
          forma_pagamento: "pix",
          asaas_customer_id: "cus_1",
          asaas_subscription_id: "sub_antiga",
          valor: "49.90",
          data_proxima_cobranca:
            "2026-10-18"
        };

        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue(cancelada);
        assinaturaRepository
          .reservarReativacao
          .mockResolvedValue({
            ...cancelada,
            status: "REACTIVATING"
          });
        assinaturaRepository
          .restaurarCancelamentoReativacao
          .mockResolvedValue(cancelada);
        criarAssinaturaAsaas
          .mockResolvedValue({
            id: "sub_nova",
            nextDueDate: "2026-10-18"
          });
        assinaturaRepository
          .registrarReativacao
          .mockResolvedValue({
            ...cancelada,
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
        expect(criarAssinaturaAsaas)
          .toHaveBeenCalledWith(
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
              "sub_nova",
            dataProximaCobranca:
              "2026-10-18"
          })
        );
        expect(resultado.assinatura.status)
          .toBe("ACTIVE");
      }
    );

    test(
      "usa a assinatura pendente apenas para listar o PIX quando não há assinatura ativa",
      async () => {
        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue(null);
        assinaturaRepository
          .buscarAssinaturaPendentePorNegocio
          .mockResolvedValue({
            id: 21,
            negocio_id: 7,
            plano_id: 3,
            status: "PENDING",
            ativo: false
          });

        await buscarMinhaAssinatura({
          usuarioId: 10
        });

        expect(
          assinaturaRepository
            .listarPagamentos
        ).toHaveBeenCalledWith(21);
      }
    );
  }
);
