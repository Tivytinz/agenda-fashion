jest.mock(
  "../src/repositories/dashboardRepository",
  () => ({
    buscarNegocioDoUsuario: jest.fn(),

    buscarResumoProfissional: jest.fn(),

    buscarProximoAtendimentoProfissional:
      jest.fn(),

    listarProximosAtendimentosProfissional:
      jest.fn(),

    buscarServicosMaisVendidosProfissional:
      jest.fn(),

    buscarResumoDono: jest.fn(),

    buscarClientesRecorrentes: jest.fn(),

    buscarPerformanceNegocio: jest.fn(),

    buscarFavoritosRecebidos: jest.fn(),

    buscarResumoDias: jest.fn(),

    buscarRankingProfissionais: jest.fn(),

    buscarRankingServicos: jest.fn(),

    buscarRankingClientes: jest.fn(),
  })
);

const dashboardRepository = require(
  "../src/repositories/dashboardRepository"
);

const dashboardService = require(
  "../src/services/dashboardService"
);

describe(
  "Dashboard Service",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "retorna dashboard completo da profissional",
      async () => {
        dashboardRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue({
            negocio_id: "11",
            papel: "profissional",
            nome: "Studio Fashion",
            slug: "studio-fashion"
          });

        dashboardRepository
          .buscarResumoProfissional
          .mockResolvedValue({
            total_agendados: "20",
            agendados_hoje: "4",
            agendamentos_hoje: "4",
            cancelamentos_hoje: "1",
            realizados_hoje: "2",
            pendentes_hoje: "2",
            clientes_unicos: "12",
            faturamento_estimado: "1500.50",
            faturamento_previsto_hoje:
              "320.00"
          });

        dashboardRepository
          .buscarProximoAtendimentoProfissional
          .mockResolvedValue({
            id: "90",
            data: "2026-07-15",
            horario: "14:00",
            status: "agendado",
            cliente_id: "30",
            cliente_nome: "Maria Souza",
            cliente_whatsapp:
              "5562999999999",
            servico_id: "5",
            servico_nome:
              "Alongamento em gel",
            valor: "120.00",
            duracao_minutos: "90"
          });

        dashboardRepository
          .listarProximosAtendimentosProfissional
          .mockResolvedValue([
            {
              id: "90",
              data: "2026-07-15",
              horario: "14:00",
              status: "agendado",
              hoje: true,
              cliente_id: "30",
              cliente_nome:
                "Maria Souza",
              cliente_whatsapp:
                "5562999999999",
              servico_id: "5",
              servico_nome:
                "Alongamento em gel",
              valor: "120.00",
              duracao_minutos: "90"
            },
            {
              id: "91",
              data: "2026-07-16",
              horario: "10:00",
              status: "confirmado",
              hoje: false,
              cliente_id: "31",
              cliente_nome:
                "Ana Santos",
              cliente_whatsapp:
                "5562888888888",
              servico_id: "6",
              servico_nome:
                "Manutenção",
              valor: "80.00",
              duracao_minutos: "60"
            }
          ]);

        dashboardRepository
          .buscarServicosMaisVendidosProfissional
          .mockResolvedValue([
            {
              id: "5",
              nome:
                "Alongamento em gel",
              total: "10",
              faturamento:
                "1200.00"
            }
          ]);

        const resultado =
          await dashboardService
            .buscarDashboardProfissional({
              usuarioId: 7
            });

        expect(
          dashboardRepository
            .buscarNegocioDoUsuario
        ).toHaveBeenCalledWith(7);

        expect(
          dashboardRepository
            .buscarResumoProfissional
        ).toHaveBeenCalledWith(
          11,
          7
        );

        expect(
          dashboardRepository
            .listarProximosAtendimentosProfissional
        ).toHaveBeenCalledWith(
          11,
          7,
          5
        );

        expect(resultado).toEqual({
          negocio: {
            negocio_id: 11,
            papel: "profissional",
            nome: "Studio Fashion",
            slug: "studio-fashion"
          },

          resumo: {
            total_agendados: 20,
            agendados_hoje: 4,
            agendamentos_hoje: 4,
            cancelamentos_hoje: 1,
            realizados_hoje: 2,
            pendentes_hoje: 2,
            clientes_unicos: 12,
            faturamento_estimado:
              1500.5,
            faturamento_previsto_hoje:
              320
          },

          proximo_atendimento: {
            id: 90,
            data: "2026-07-15",
            horario: "14:00",
            status: "agendado",
            hoje: false,

            cliente: {
              id: 30,
              nome: "Maria Souza",
              whatsapp:
                "5562999999999"
            },

            servico: {
              id: 5,
              nome:
                "Alongamento em gel",
              valor: 120,
              duracao_minutos: 90
            }
          },

          proximos_atendimentos: [
            {
              id: 90,
              data: "2026-07-15",
              horario: "14:00",
              status: "agendado",
              hoje: true,

              cliente: {
                id: 30,
                nome: "Maria Souza",
                whatsapp:
                  "5562999999999"
              },

              servico: {
                id: 5,
                nome:
                  "Alongamento em gel",
                valor: 120,
                duracao_minutos: 90
              }
            },
            {
              id: 91,
              data: "2026-07-16",
              horario: "10:00",
              status: "confirmado",
              hoje: false,

              cliente: {
                id: 31,
                nome: "Ana Santos",
                whatsapp:
                  "5562888888888"
              },

              servico: {
                id: 6,
                nome: "Manutenção",
                valor: 80,
                duracao_minutos: 60
              }
            }
          ],

          servicos_mais_vendidos: [
            {
              id: 5,
              nome:
                "Alongamento em gel",
              total: 10,
              faturamento: 1200
            }
          ]
        });
      }
    );

    test(
      "retorna dashboard completo do dono",
      async () => {
        dashboardRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue({
            negocio_id: "11",
            papel: "dono",
            nome: "Studio Fashion",
            slug: "studio-fashion"
          });

        dashboardRepository
          .buscarResumoDono
          .mockResolvedValue({
            agendamentos_hoje: "3",
            agendamentos_periodo: "5",
            faturamento_hoje: "300",
            faturamento_periodo: "500",
            clientes_novos: "4",
            servicos_vendidos: "5"
          });

        dashboardRepository
          .buscarClientesRecorrentes
          .mockResolvedValue("2");

        dashboardRepository
          .buscarPerformanceNegocio
          .mockResolvedValue({
            visitas_perfil: "20",
            cliques_whatsapp: "8",
            cliques_maps: "3",
            agendamentos_concluidos: "5"
          });

        dashboardRepository
          .buscarFavoritosRecebidos
          .mockResolvedValue("6");

        dashboardRepository
          .buscarResumoDias
          .mockResolvedValue([
            {
              data: "14/07",
              agendamentos: 3,
              faturamento: "300"
            }
          ]);

        dashboardRepository
          .buscarRankingProfissionais
          .mockResolvedValue([
            {
              id: 7,
              nome: "Juliana",
              total: 5,
              faturamento: "500"
            }
          ]);

        dashboardRepository
          .buscarRankingServicos
          .mockResolvedValue([
            {
              id: 5,
              nome:
                "Alongamento em gel",
              total: 4,
              faturamento: "480"
            }
          ]);

        dashboardRepository
          .buscarRankingClientes
          .mockResolvedValue([
            {
              id: 30,
              nome: "Maria",
              total: 3,
              faturamento: "360"
            }
          ]);

        const resultado =
          await dashboardService
            .buscarDashboardDono({
              usuarioId: 7,
              periodo: "7dias"
            });

        expect(
          dashboardRepository
            .buscarResumoDono
        ).toHaveBeenCalledWith(
          11,
          expect.stringContaining(
            "INTERVAL '6 days'"
          )
        );

        expect(resultado.periodo).toBe(
          "7dias"
        );

        expect(resultado.negocio).toEqual({
          negocio_id: 11,
          papel: "dono",
          nome: "Studio Fashion",
          slug: "studio-fashion"
        });

        expect(resultado.resumo).toEqual({
          agendamentos_hoje: 3,
          agendamentos_periodo: 5,
          faturamento_hoje: 300,
          faturamento_periodo: 500,
          clientes_novos: 4,
          clientes_recorrentes: 2,
          servicos_vendidos: 5,
          ticket_medio: 100
        });

        expect(
          resultado.performance
        ).toEqual({
          visitas_perfil: 20,
          cliques_whatsapp: 8,
          cliques_maps: 3,
          favoritos_recebidos: 6,
          agendamentos_concluidos: 5,
          taxa_conversao: 25
        });

        expect(
          resultado.resumo_dias
        ).toHaveLength(1);

        expect(
          resultado
            .ranking_profissionais
        ).toHaveLength(1);

        expect(
          resultado.ranking_servicos
        ).toHaveLength(1);

        expect(
          resultado.ranking_clientes
        ).toHaveLength(1);
      }
    );

    test(
      "recusa dashboard sem usuário autenticado",
      async () => {
        await expect(
          dashboardService
            .buscarDashboardProfissional({
              usuarioId: null
            })
        ).rejects.toMatchObject({
          message:
            "Usuário não autenticado.",
          statusCode: 401
        });

        expect(
          dashboardRepository
            .buscarNegocioDoUsuario
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "impede profissional de acessar dashboard do dono",
      async () => {
        dashboardRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue({
            negocio_id: 11,
            papel: "profissional",
            nome: "Studio Fashion",
            slug: "studio-fashion"
          });

        await expect(
          dashboardService
            .buscarDashboardDono({
              usuarioId: 7,
              periodo: "7dias"
            })
        ).rejects.toMatchObject({
          message:
            "Apenas o dono pode acessar este dashboard.",
          statusCode: 403
        });

        expect(
          dashboardRepository
            .buscarResumoDono
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna erro quando usuário não possui negócio",
      async () => {
        dashboardRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(null);

        await expect(
          dashboardService
            .buscarDashboardProfissional({
              usuarioId: 7
            })
        ).rejects.toMatchObject({
          message:
            "Usuário não está vinculado a nenhum negócio.",
          statusCode: 404
        });
      }
    );
  }
);
