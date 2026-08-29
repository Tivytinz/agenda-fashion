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
  "adminProfessionalRecurrenceService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "calcula repeticao, tempo entre marcos e maturidade observada",
      async () => {
        repository
          .listarRecorrencia
          .mockResolvedValue({
            periodo: "30",
            linhas: [
              {
                usuario_id: 1,
                negocio_id: 11,
                total_agendamentos: 3,
                primeiro_agendamento_em:
                  "2026-08-01T00:00:00.000Z",
                segundo_agendamento_em:
                  "2026-08-04T00:00:00.000Z",
                terceiro_agendamento_em:
                  "2026-08-09T00:00:00.000Z",
              },
              {
                usuario_id: 2,
                negocio_id: 22,
                total_agendamentos: 2,
                primeiro_agendamento_em:
                  "2026-08-10T00:00:00.000Z",
                segundo_agendamento_em:
                  "2026-08-12T00:00:00.000Z",
                terceiro_agendamento_em: null,
              },
              {
                usuario_id: 3,
                negocio_id: 33,
                total_agendamentos: 1,
                primeiro_agendamento_em:
                  "2026-08-20T00:00:00.000Z",
                segundo_agendamento_em: null,
                terceiro_agendamento_em: null,
              },
              {
                usuario_id: 4,
                negocio_id: 44,
                total_agendamentos: 0,
                primeiro_agendamento_em: null,
                segundo_agendamento_em: null,
                terceiro_agendamento_em: null,
              },
              {
                usuario_id: 5,
                negocio_id: null,
                total_agendamentos: 0,
                primeiro_agendamento_em: null,
                segundo_agendamento_em: null,
                terceiro_agendamento_em: null,
              },
            ],
          });

        const resultado =
          await service
            .buscarRecorrencia({
              periodo: "30",
              agora:
                new Date(
                  "2026-08-29T00:00:00.000Z"
                ),
            });

        expect(resultado).toMatchObject({
          periodo: "30",
          resumo: {
            profissionaisCohorte: 5,
            negociosCriados: 4,
            comPrimeiroAgendamento: 3,
            comSegundoAgendamento: 2,
            comTerceiroAgendamento: 1,
            taxaPrimeiroSobreNegocio: 75,
            taxaSegundoSobrePrimeiro: 66.67,
            taxaTerceiroSobreSegundo: 50,
            taxaTerceiroSobrePrimeiro: 33.33,
          },
          tempos: {
            primeiroParaSegundo: {
              amostra: 2,
              medianaDias: 2.5,
              p75Dias: 2.75,
              minimoDias: 2,
              maximoDias: 3,
            },
            segundoParaTerceiro: {
              amostra: 1,
              medianaDias: 5,
              p75Dias: 5,
              minimoDias: 5,
              maximoDias: 5,
            },
            maturidadeDesdePrimeiro: {
              amostra: 3,
              medianaDias: 19,
              p75Dias: 23.5,
              minimoDias: 9,
              maximoDias: 28,
            },
          },
          metodologia: {
            unidade: "profissional",
            criterio: expect.stringMatching(
              /não cancelados/i
            ),
            tempo: expect.stringMatching(
              /created_at/i
            ),
          },
        });
      }
    );

    test(
      "mantem taxas em zero quando ainda nao existe base",
      () => {
        expect(
          service.criarResumo([])
        ).toEqual({
          profissionaisCohorte: 0,
          negociosCriados: 0,
          comPrimeiroAgendamento: 0,
          comSegundoAgendamento: 0,
          comTerceiroAgendamento: 0,
          taxaPrimeiroSobreNegocio: 0,
          taxaSegundoSobrePrimeiro: 0,
          taxaTerceiroSobreSegundo: 0,
          taxaTerceiroSobrePrimeiro: 0,
        });
      }
    );

    test(
      "nao inventa tempo quando a coorte ainda nao repetiu o valor",
      () => {
        expect(
          service.criarAnaliseTemporal(
            [],
            new Date(
              "2026-08-29T00:00:00.000Z"
            )
          )
        ).toEqual({
          primeiroParaSegundo: {
            amostra: 0,
            medianaDias: null,
            p75Dias: null,
            minimoDias: null,
            maximoDias: null,
          },
          segundoParaTerceiro: {
            amostra: 0,
            medianaDias: null,
            p75Dias: null,
            minimoDias: null,
            maximoDias: null,
          },
          maturidadeDesdePrimeiro: {
            amostra: 0,
            medianaDias: null,
            p75Dias: null,
            minimoDias: null,
            maximoDias: null,
          },
        });
      }
    );
  }
);
