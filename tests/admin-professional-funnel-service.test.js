jest.mock(
  "../src/repositories/adminProfessionalFunnelRepository",
  () => ({
    periodoSeguro:
      jest.fn((value) => value || "30"),
    listarPorCampanha:
      jest.fn(),
  })
);

const repository = require(
  "../src/repositories/adminProfessionalFunnelRepository"
);

const service = require(
  "../src/services/adminProfessionalFunnelService"
);

describe(
  "funil profissional administrativo",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "calcula conversões, custo por cadastro e CAC",
      async () => {
        repository.listarPorCampanha
          .mockResolvedValue([
            {
              origem: "meta",
              midia: "cpc",
              campanha: "profissionais_goiania",
              cadastros: "20",
              negocios_criados: "12",
              servicos_criados: "10",
              agendas_configuradas: "8",
              negocios_publicados: "7",
              checkouts_iniciados: "5",
              assinaturas_ativadas: "4",
              investimento_centavos: "40000",
            },
          ]);

        const resultado =
          await service.buscarFunil({
            periodo: "30",
          });

        expect(
          resultado.campanhas[0]
        ).toMatchObject({
          cadastros: 20,
          negociosCriados: 12,
          assinaturasAtivadas: 4,
          taxaNegocio: 60,
          taxaAssinatura: 20,
          custoCadastroCentavos: 2000,
          cacAssinanteCentavos: 10000,
        });

        expect(
          resultado.resumo
        ).toMatchObject({
          cadastros: 20,
          assinaturasAtivadas: 4,
          investimentoCentavos: 40000,
          custoCadastroCentavos: 2000,
          cacAssinanteCentavos: 10000,
        });
      }
    );

    test(
      "não chama gasto zero de CAC zero",
      async () => {
        repository.listarPorCampanha
          .mockResolvedValue([
            {
              origem: "organico",
              midia: "none",
              campanha: "organico",
              cadastros: 3,
              negocios_criados: 2,
              servicos_criados: 1,
              agendas_configuradas: 1,
              negocios_publicados: 1,
              checkouts_iniciados: 0,
              assinaturas_ativadas: 0,
              investimento_centavos: 0,
            },
          ]);

        const resultado =
          await service.buscarFunil({
            periodo: "all",
          });

        expect(
          resultado.campanhas[0]
            .custoCadastroCentavos
        ).toBeNull();

        expect(
          resultado.campanhas[0]
            .cacAssinanteCentavos
        ).toBeNull();
      }
    );
  }
);
