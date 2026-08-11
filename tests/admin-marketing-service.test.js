jest.mock(
  "../src/repositories/adminMarketingRepository",
  () => ({
    buscarResumo:
      jest.fn(),
    listarCampanhas:
      jest.fn(),
    listarConversoes:
      jest.fn(),
  })
);

const adminMarketingRepository =
  require(
    "../src/repositories/adminMarketingRepository"
  );

const adminMarketingService =
  require(
    "../src/services/adminMarketingService"
  );

describe(
  "serviço de marketing administrativo",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "calcula conversão e cobertura sobre sessões atribuídas",
      async () => {
        adminMarketingRepository
          .buscarResumo
          .mockResolvedValue({
            total_sessoes: "50",
            sessoes: "40",
            campanhas: "3",
            perfis_visualizados: "24",
            agendamentos_iniciados: "10",
            agendamentos_concluidos: "5",
          });

        const resultado =
          await adminMarketingService
            .buscarResumo({
              periodo: "30dias",
            });

        expect(
          adminMarketingRepository
            .buscarResumo
        ).toHaveBeenCalledWith(
          "30"
        );

        expect(resultado)
          .toMatchObject({
            periodo: "30",
            totalSessoes: 50,
            sessoes: 40,
            sessoesSemAtribuicao: 10,
            coberturaAtribuicao: 80,
            campanhas: 3,
            perfisVisualizados: 24,
            agendamentosIniciados: 10,
            agendamentosConcluidos: 5,
            taxaConversao: 12.5,
          });
      }
    );

    test(
      "mantém taxas em zero sem sessões",
      async () => {
        adminMarketingRepository
          .buscarResumo
          .mockResolvedValue({
            total_sessoes: 0,
            sessoes: 0,
            agendamentos_concluidos: 0,
          });

        const resultado =
          await adminMarketingService
            .buscarResumo();

        expect(
          resultado.taxaConversao
        ).toBe(0);
        expect(
          resultado.coberturaAtribuicao
        ).toBe(0);
      }
    );

    test(
      "normaliza campanha e calcula taxa individual",
      async () => {
        adminMarketingRepository
          .listarCampanhas
          .mockResolvedValue([
            {
              origem: "google",
              midia: "cpc",
              campanha: "unhas_goiania",
              sessoes: "8",
              perfis_visualizados: "6",
              agendamentos_iniciados: "3",
              agendamentos_concluidos: "2",
              primeira_interacao:
                "2026-08-10T10:00:00.000Z",
              ultima_interacao:
                "2026-08-10T11:00:00.000Z",
            },
          ]);

        const resultado =
          await adminMarketingService
            .listarCampanhas({
              periodo: "hoje",
            });

        expect(
          resultado.campanhas[0]
            .taxaConversao
        ).toBe(25);

        expect(
          resultado.periodo
        ).toBe("today");
      }
    );

    test(
      "conversão administrativa não inclui PII",
      async () => {
        adminMarketingRepository
          .listarConversoes
          .mockResolvedValue([
            {
              id: 31,
              sessao_id: "sessao_12345678",
              negocio_id: 4,
              negocio_nome: "Studio Bella",
              negocio_slug: "studio-bella",
              agendamento_id: "22",
              servico_id: "9",
              origem: "facebook",
              midia: "cpc",
              campanha: "cilios",
              conteudo: "video_01",
              landing_page: "/negocio/studio-bella",
              created_at:
                "2026-08-10T12:00:00.000Z",
              cliente_nome: "Não deve sair",
              cliente_whatsapp: "62999999999",
            },
          ]);

        const resultado =
          await adminMarketingService
            .listarConversoes();

        expect(
          resultado.conversoes[0]
        ).not.toHaveProperty(
          "clienteNome"
        );

        expect(
          resultado.conversoes[0]
        ).not.toHaveProperty(
          "clienteWhatsapp"
        );

        expect(
          resultado.conversoes[0]
            .agendamentoId
        ).toBe(22);
      }
    );
  }
);
