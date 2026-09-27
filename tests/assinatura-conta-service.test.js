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
    buscarUsoPlano: jest.fn(),
    listarPlanos: jest.fn()
  })
);

const assinaturaRepository = require(
  "../src/repositories/assinaturaRepository"
);
const {
  buscarUsoPlano,
  listarPlanos
} = require(
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
                valor: 20
              }
            : {
                id: 2,
                nome: "Autônoma",
                slug: "autonoma",
                valor: 10
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
        limite_profissionais: 3,
        limite_servicos: 10,
        status: "normal"
      });
      listarPlanos.mockResolvedValue([
        {
          id: 1,
          nome: "Grátis",
          slug: "inicial",
          valor: 0,
          capacidade_agendamentos: 10,
          limite_profissionais: 1,
          limite_servicos: 5
        },
        {
          id: 2,
          nome: "Autônoma",
          slug: "autonoma",
          valor: 10,
          capacidade_agendamentos: 20,
          limite_profissionais: 3,
          limite_servicos: 10
        },
        {
          id: 3,
          nome: "Studio",
          slug: "studio",
          valor: 20,
          capacidade_agendamentos: 30,
          limite_profissionais: 6,
          limite_servicos: 15
        },
        {
          id: 4,
          nome: "Salão",
          slug: "salao",
          valor: 30,
          capacidade_agendamentos: null,
          limite_profissionais: 9,
          limite_servicos: null
        }
      ]);
    });

    test(
      "oferece o próximo plano sem reconstruir limites no frontend",
      async () => {
        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue({
            id: 20,
            negocio_id: 7,
            plano_id: 2,
            status: "ACTIVE",
            ativo: true,
            valor: 10
          });
        assinaturaRepository
          .buscarAssinaturaPendentePorNegocio
          .mockResolvedValue(null);

        const resultado =
          await buscarMinhaAssinatura({
            usuarioId: 10
          });

        expect(resultado.upgrade_contextual)
          .toMatchObject({
            negocio_id: 7,
            disponivel: true,
            bloqueio: null,
            valor_contratado_atual: 10,
            plano_atual: {
              slug: "autonoma",
              limite_profissionais: 3,
              limite_servicos: 10
            },
            plano_destino: {
              slug: "studio",
              valor: 20,
              capacidade_agendamentos: 30,
              limite_profissionais: 6,
              limite_servicos: 15
            }
          });
        expect(resultado.uso.status)
          .toBe("normal");
      }
    );

    test(
      "prioriza o plano pago já selecionado quando ainda não existe assinatura ativa",
      async () => {
        assinaturaRepository
          .buscarNegocioDono
          .mockResolvedValue({
            id: 7,
            plano_id: 3
          });
        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue(null);
        assinaturaRepository
          .buscarAssinaturaPendentePorNegocio
          .mockResolvedValue(null);
        assinaturaRepository
          .buscarUltimaAssinaturaPorNegocio
          .mockResolvedValue(null);
        buscarUsoPlano.mockResolvedValue({
          plano_id: 1,
          plano_nome: "Grátis",
          plano_slug: "inicial",
          valor: 0,
          plano_selecionado_id: 3,
          plano_selecionado_nome: "Studio",
          plano_selecionado_slug: "studio",
          plano_selecionado_valor: 20,
          utilizados: 3,
          capacidade_agendamentos: 10,
          limite_profissionais: 1,
          limite_servicos: 5,
          status: "normal"
        });

        const resultado =
          await buscarMinhaAssinatura({
            usuarioId: 10
          });

        expect(resultado.plano)
          .toMatchObject({
            id: 3,
            slug: "studio"
          });
        expect(resultado.estado_assinatura)
          .toMatchObject({
            codigo: "GRATUITA"
          });
        expect(resultado.upgrade_contextual)
          .toMatchObject({
            disponivel: true,
            plano_atual: {
              slug: "inicial"
            },
            plano_destino: {
              slug: "studio",
              valor: 20
            }
          });
      }
    );

    test(
      "não promove upgrade contextual que reduziria valor de contrato legado",
      async () => {
        assinaturaRepository
          .buscarAssinaturaAtivaPorNegocio
          .mockResolvedValue({
            id: 20,
            negocio_id: 7,
            plano_id: 2,
            status: "ACTIVE",
            ativo: true,
            valor: 49.9
          });
        assinaturaRepository
          .buscarAssinaturaPendentePorNegocio
          .mockResolvedValue(null);

        const resultado =
          await buscarMinhaAssinatura({
            usuarioId: 10
          });

        expect(resultado.upgrade_contextual)
          .toMatchObject({
            disponivel: false,
            bloqueio: "VALOR_CONTRATADO_SUPERIOR",
            valor_contratado_atual: 49.9,
            plano_atual: { slug: "autonoma" },
            plano_destino: { slug: "studio", valor: 20 }
          });
      }
    );

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
          .mockResolvedValue([
            {
              id: 51,
              assinatura_id: 20,
              status: "OVERDUE",
              data_vencimento: "2026-09-23",
              invoice_url:
                "https://www.asaas.com/i/fatura-wave20"
            }
          ]);

        const resultado =
          await buscarMinhaAssinatura({
            usuarioId: 10
          });

        expect(
          assinaturaRepository.listarPagamentos
        ).toHaveBeenCalledWith(20);
        expect(resultado.estado_assinatura)
          .toEqual({
            codigo: "FALHA_DE_PAGAMENTO",
            tipo_falha: "COBRANCA_ATRASADA",
            status_provedor: "OVERDUE",
            assinatura_id: 20,
            plano_id: 3
          });
        expect(resultado.pagamento_recuperavel)
          .toEqual({
            id: 51,
            status: "OVERDUE",
            data_vencimento: "2026-09-23",
            invoice_url:
              "https://www.asaas.com/i/fatura-wave20"
          });
      }
    );

    test(
      "não oferece recuperação por URL externa em estorno ou domínio não confiável",
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
            status: "REFUNDED",
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
          .mockResolvedValue([
            {
              id: 52,
              status: "REFUNDED",
              invoice_url:
                "https://exemplo-malicioso.com/pagar"
            }
          ]);

        const resultado =
          await buscarMinhaAssinatura({
            usuarioId: 10
          });

        expect(resultado.estado_assinatura)
          .toMatchObject({
            codigo: "FALHA_DE_PAGAMENTO",
            tipo_falha: "REVERSAO_OU_DISPUTA",
            status_provedor: "REFUNDED"
          });
        expect(resultado.pagamento_recuperavel)
          .toBeNull();
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
