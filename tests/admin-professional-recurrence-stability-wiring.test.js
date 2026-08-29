jest.mock(
  "../src/repositories/adminProfessionalRecurrenceRepository",
  () => ({
    listarRecorrencia: jest.fn(),
  })
);

const repository = require(
  "../src/repositories/adminProfessionalRecurrenceRepository"
);
const service = require(
  "../src/services/adminProfessionalRecurrenceService"
);

describe(
  "contrato de estabilidade da recorrencia",
  () => {
    test(
      "expoe comparacao das coortes semanais no endpoint de service",
      async () => {
        repository
          .listarRecorrencia
          .mockResolvedValue({
            periodo: "all",
            linhas: [
              {
                semana_cadastro: "2026-08-11",
                negocio_id: 11,
                total_agendamentos: 2,
                primeiro_agendamento_em:
                  "2026-08-11T00:00:00.000Z",
                segundo_agendamento_em:
                  "2026-08-14T00:00:00.000Z",
                terceiro_agendamento_em: null,
              },
              {
                semana_cadastro: "2026-08-04",
                negocio_id: 12,
                total_agendamentos: 3,
                primeiro_agendamento_em:
                  "2026-08-04T00:00:00.000Z",
                segundo_agendamento_em:
                  "2026-08-06T00:00:00.000Z",
                terceiro_agendamento_em:
                  "2026-08-10T00:00:00.000Z",
              },
            ],
          });

        const resultado =
          await service.buscarRecorrencia({
            periodo: "all",
            agora: new Date(
              "2026-08-29T00:00:00.000Z"
            ),
          });

        expect(
          resultado.estabilidadeCoortes[0]
        ).toMatchObject({
          janelaDias: 7,
          estado: "comparacao_disponivel",
          coortesComBase: 2,
          elegiveisTotal: 2,
          faixaTaxaSegundo: {
            minimo: 100,
            maximo: 100,
            amplitudePp: 0,
          },
          faixaTaxaTerceiro: {
            minimo: 0,
            maximo: 100,
            amplitudePp: 100,
          },
          variacaoRecenteSegundoPp: 0,
          variacaoRecenteTerceiroPp: -100,
          semanaMaisRecenteComBase:
            "2026-08-11",
          semanaAnteriorComBase:
            "2026-08-04",
        });
        expect(
          resultado.metodologia.estabilidade
        ).toMatch(
          /sem inferir tendência estatística/i
        );
      }
    );
  }
);
