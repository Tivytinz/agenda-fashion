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
      "calcula repeticao do primeiro ao terceiro agendamento",
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
              },
              {
                usuario_id: 2,
                negocio_id: 22,
                total_agendamentos: 2,
              },
              {
                usuario_id: 3,
                negocio_id: 33,
                total_agendamentos: 1,
              },
              {
                usuario_id: 4,
                negocio_id: 44,
                total_agendamentos: 0,
              },
              {
                usuario_id: 5,
                negocio_id: null,
                total_agendamentos: 0,
              },
            ],
          });

        const resultado =
          await service
            .buscarRecorrencia({
              periodo: "30",
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
          metodologia: {
            unidade: "profissional",
            criterio: expect.stringMatching(
              /não cancelados/i
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
  }
);
