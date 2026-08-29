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
  "qualidade da aquisicao na recorrencia",
  () => {
    test(
      "separa origem oficial, organica e sem evidencia sem contaminar janelas maduras",
      async () => {
        repository
          .listarRecorrencia
          .mockResolvedValue({
            periodo: "all",
            linhas: [
              {
                usuario_id: 1,
                classificacao_atribuicao: "oficial",
                origem: "google",
                negocio_id: 11,
                total_agendamentos: 3,
                primeiro_agendamento_em:
                  "2026-08-01T00:00:00.000Z",
                segundo_agendamento_em:
                  "2026-08-04T00:00:00.000Z",
                terceiro_agendamento_em:
                  "2026-08-08T00:00:00.000Z",
              },
              {
                usuario_id: 2,
                classificacao_atribuicao: "oficial",
                origem: "google",
                negocio_id: 22,
                total_agendamentos: 1,
                primeiro_agendamento_em:
                  "2026-08-10T00:00:00.000Z",
                segundo_agendamento_em: null,
                terceiro_agendamento_em: null,
              },
              {
                usuario_id: 3,
                classificacao_atribuicao: "organico",
                origem: "instagram",
                negocio_id: 33,
                total_agendamentos: 2,
                primeiro_agendamento_em:
                  "2026-08-20T00:00:00.000Z",
                segundo_agendamento_em:
                  "2026-08-22T00:00:00.000Z",
                terceiro_agendamento_em: null,
              },
              {
                usuario_id: 4,
                classificacao_atribuicao: "sem_evidencia",
                origem: "google",
                negocio_id: null,
                total_agendamentos: 0,
                primeiro_agendamento_em: null,
                segundo_agendamento_em: null,
                terceiro_agendamento_em: null,
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
          resultado.qualidadeAquisicao
        ).toEqual([
          {
            chave: "oficial:google",
            classificacaoAtribuicao: "oficial",
            origem: "google",
            profissionais: 2,
            comPrimeiroAgendamento: 2,
            taxaPrimeiroSobreProfissionais: 100,
            comSegundoAgendamento: 1,
            taxaSegundoSobrePrimeiro: 50,
            comTerceiroAgendamento: 1,
            taxaTerceiroSobrePrimeiro: 50,
            janelasCandidatas: [
              {
                janelaDias: 7,
                elegiveis: 2,
                comSegundoNaJanela: 1,
                taxaSegundoNaJanela: 50,
                comTerceiroNaJanela: 1,
                taxaTerceiroNaJanela: 50,
              },
              {
                janelaDias: 14,
                elegiveis: 2,
                comSegundoNaJanela: 1,
                taxaSegundoNaJanela: 50,
                comTerceiroNaJanela: 1,
                taxaTerceiroNaJanela: 50,
              },
              {
                janelaDias: 30,
                elegiveis: 0,
                comSegundoNaJanela: 0,
                taxaSegundoNaJanela: 0,
                comTerceiroNaJanela: 0,
                taxaTerceiroNaJanela: 0,
              },
            ],
          },
          {
            chave: "organico:instagram",
            classificacaoAtribuicao: "organico",
            origem: "instagram",
            profissionais: 1,
            comPrimeiroAgendamento: 1,
            taxaPrimeiroSobreProfissionais: 100,
            comSegundoAgendamento: 1,
            taxaSegundoSobrePrimeiro: 100,
            comTerceiroAgendamento: 0,
            taxaTerceiroSobrePrimeiro: 0,
            janelasCandidatas: [
              {
                janelaDias: 7,
                elegiveis: 1,
                comSegundoNaJanela: 1,
                taxaSegundoNaJanela: 100,
                comTerceiroNaJanela: 0,
                taxaTerceiroNaJanela: 0,
              },
              {
                janelaDias: 14,
                elegiveis: 0,
                comSegundoNaJanela: 0,
                taxaSegundoNaJanela: 0,
                comTerceiroNaJanela: 0,
                taxaTerceiroNaJanela: 0,
              },
              {
                janelaDias: 30,
                elegiveis: 0,
                comSegundoNaJanela: 0,
                taxaSegundoNaJanela: 0,
                comTerceiroNaJanela: 0,
                taxaTerceiroNaJanela: 0,
              },
            ],
          },
          {
            chave: "sem_evidencia:sem_evidencia",
            classificacaoAtribuicao: "sem_evidencia",
            origem: "sem_evidencia",
            profissionais: 1,
            comPrimeiroAgendamento: 0,
            taxaPrimeiroSobreProfissionais: 0,
            comSegundoAgendamento: 0,
            taxaSegundoSobrePrimeiro: 0,
            comTerceiroAgendamento: 0,
            taxaTerceiroSobrePrimeiro: 0,
            janelasCandidatas: [
              {
                janelaDias: 7,
                elegiveis: 0,
                comSegundoNaJanela: 0,
                taxaSegundoNaJanela: 0,
                comTerceiroNaJanela: 0,
                taxaTerceiroNaJanela: 0,
              },
              {
                janelaDias: 14,
                elegiveis: 0,
                comSegundoNaJanela: 0,
                taxaSegundoNaJanela: 0,
                comTerceiroNaJanela: 0,
                taxaTerceiroNaJanela: 0,
              },
              {
                janelaDias: 30,
                elegiveis: 0,
                comSegundoNaJanela: 0,
                taxaSegundoNaJanela: 0,
                comTerceiroNaJanela: 0,
                taxaTerceiroNaJanela: 0,
              },
            ],
          },
        ]);

        expect(
          resultado.metodologia.aquisicao
        ).toMatch(
          /classificação oficial de atribuição/i
        );
      }
    );
  }
);
