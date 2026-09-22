jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao: jest.fn()
  })
);

jest.mock(
  "../src/repositories/assinaturaRepository"
);

jest.mock(
  "../src/services/asaasService",
  () => ({
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
  buscarMinhaAssinatura
} = require(
  "../src/services/assinaturaContaService"
);

describe(
  "Conta de assinatura",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      assinaturaRepository
        .buscarNegocioDono
        .mockResolvedValue({
          id: 7,
          plano_id: 2
        });
      assinaturaRepository
        .expirarCheckoutsPendentes
        .mockResolvedValue([]);
      assinaturaRepository
        .buscarUltimaAssinaturaPorNegocio
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
      "CA-PLN-04: expõe falha de pagamento de assinatura antes ativa",
      async () => {
        assinaturaRepository
          .buscarNegocioDono
          .mockResolvedValue({
            id: 7,
            plano_id: 1
          });
        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue(null);
        assinaturaRepository
          .buscarAssinaturaPendentePorNegocio
          .mockResolvedValue(null);
        assinaturaRepository
          .buscarUltimaAssinaturaPorNegocio
          .mockResolvedValue({
            id: 20,
            negocio_id: 7,
            plano_id: 3,
            status: "OVERDUE",
            ativo: false,
            asaas_subscription_id: "sub_1"
          });
        assinaturaRepository
          .buscarPlano
          .mockResolvedValue({
            id: 1,
            nome: "Grátis",
            slug: "inicial",
            valor: 0
          });
        assinaturaRepository
          .listarPagamentos
          .mockResolvedValue([]);

        const resultado =
          await buscarMinhaAssinatura({
            usuarioId: 10
          });

        expect(resultado.estado_assinatura)
          .toEqual({
            codigo: "FALHA_DE_PAGAMENTO",
            status_provedor: "OVERDUE",
            assinatura_id: 20,
            plano_id: 3
          });
      }
    );

    test(
      "CA-PLN-05: materializa checkout expirado e mantém plano grátis",
      async () => {
        assinaturaRepository
          .buscarNegocioDono
          .mockResolvedValue({
            id: 7,
            plano_id: 1
          });
        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue(null);
        assinaturaRepository
          .buscarAssinaturaPendentePorNegocio
          .mockResolvedValue(null);
        assinaturaRepository
          .buscarUltimaAssinaturaPorNegocio
          .mockResolvedValue({
            id: 21,
            negocio_id: 7,
            plano_id: 3,
            status: "EXPIRED",
            ativo: false,
            asaas_subscription_id: null
          });
        assinaturaRepository
          .buscarPlano
          .mockResolvedValue({
            id: 1,
            nome: "Grátis",
            slug: "inicial",
            valor: 0
          });
        assinaturaRepository
          .listarPagamentos
          .mockResolvedValue([]);

        const resultado =
          await buscarMinhaAssinatura({
            usuarioId: 10
          });

        expect(
          assinaturaRepository.expirarCheckoutsPendentes
        ).toHaveBeenCalledWith(7);
        expect(resultado.plano.slug)
          .toBe("inicial");
        expect(resultado.estado_assinatura)
          .toMatchObject({
            codigo: "CHECKOUT_EXPIRADO",
            status_provedor: "EXPIRED"
          });
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
