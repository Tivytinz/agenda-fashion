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
      "separa sessões pagas, orgânicas, diretas e rastreadas não pagas",
      async () => {
        adminMarketingRepository
          .buscarResumo
          .mockResolvedValue({
            total_sessoes: "50",
            sessoes: "30",
            sessoes_organicas: "10",
            sessoes_diretas: "7",
            sessoes_rastreadas_nao_pagas: "3",
            campanhas: "3",
            perfis_visualizados: "24",
            agendamentos_iniciados: "10",
            sessoes_convertidas: "4",
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
            sessoes: 30,
            sessoesPagas: 30,
            sessoesOrganicas: 10,
            sessoesDiretas: 7,
            sessoesAutonomas: 7,
            sessoesRastreadasNaoPagas: 3,
            sessoesRastreamentoIncompleto: 3,
            sessoesSemAtribuicao: 7,
            coberturaAtribuicao: 86,
            campanhas: 3,
            perfisVisualizados: 24,
            agendamentosIniciados: 10,
            agendamentosConcluidos: 5,
            sessoesConvertidas: 4,
            taxaConversao: 13.33,
            modeloAtribuicao: {
              codigo: "first_touch_30d",
              janelaDias: 30,
            },
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
            sessoes_organicas: 0,
            sessoes_diretas: 0,
            sessoes_rastreadas_nao_pagas: 0,
            sessoes_convertidas: 0,
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
      "normaliza campanha e calcula conversão por sessões convertidas",
      async () => {
        adminMarketingRepository
          .listarCampanhas
          .mockResolvedValue([
            {
              origem: "google",
              midia: "cpc",
              campanha:
                "google_ads_profissionais",
              campanha_oficial_id: "12",
              campanha_oficial_objetivo:
                "profissional",
              campanha_oficial_ativa: false,
              classificacao_atribuicao:
                "oficial",
              sessoes: "8",
              sessoes_resolvidas_gclid: "0",
              sessoes_resolvidas_google_click: "0",
              perfis_visualizados: "6",
              agendamentos_iniciados: "3",
              sessoes_convertidas: "2",
              agendamentos_concluidos: "3",
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
        ).toMatchObject({
          campanha:
            "google_ads_profissionais",
          campanhaOficialId: 12,
          objetivo: "profissional",
          oficial: true,
          campanhaAtiva: false,
          classificacaoAtribuicao:
            "oficial",
          sessoes: 8,
          sessoesResolvidasPorGclid: 0,
          sessoesResolvidasPorGoogle: 0,
          sessoesConvertidas: 2,
          agendamentosConcluidos: 3,
          taxaConversao: 25,
        });

        expect(
          resultado.periodo
        ).toBe("today");
      }
    );

    test(
      "conversão administrativa não inclui PII e informa resolução Google",
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
              origem: "google",
              midia: "cpc",
              campanha:
                "google_ads_profissionais",
              campanha_oficial_id: 12,
              campanha_oficial_objetivo:
                "profissional",
              campanha_oficial_ativa: true,
              classificacao_atribuicao:
                "oficial",
              gclid_resolvido: false,
              google_click_resolvido: false,
              conteudo: "search_01",
              landing_page:
                "/negocio/studio-bella",
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
        ).toMatchObject({
          agendamentoId: 22,
          resolvidoPorGclid: false,
          resolvidoPorGoogle: false,
          campanha:
            "google_ads_profissionais",
          campanhaOficialId: 12,
          objetivo: "profissional",
          oficial: true,
          campanhaAtiva: true,
          classificacaoAtribuicao:
            "oficial",
        });
      }
    );
  }
);
