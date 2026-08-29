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
  "contrato de recorrencia por campanha oficial",
  () => {
    test(
      "expoe somente campanhas oficiais e reaplica maturidade por campanha",
      async () => {
        repository
          .listarRecorrencia
          .mockResolvedValue({
            periodo: "all",
            linhas: [
              {
                usuario_id: 1,
                negocio_id: 11,
                classificacao_atribuicao: "oficial",
                campanha_oficial_id: "10",
                origem: "google",
                midia: "cpc",
                campanha: "google_ads_profissionais",
                metodo_resolucao: "utm_exata",
                total_agendamentos: 3,
                primeiro_agendamento_em:
                  "2026-08-01T00:00:00.000Z",
                segundo_agendamento_em:
                  "2026-08-04T00:00:00.000Z",
                terceiro_agendamento_em:
                  "2026-08-06T00:00:00.000Z",
              },
              {
                usuario_id: 2,
                negocio_id: 12,
                classificacao_atribuicao: "oficial",
                campanha_oficial_id: "10",
                origem: "google",
                midia: "cpc",
                campanha: "google_ads_profissionais",
                metodo_resolucao: "vinculo_plataforma",
                total_agendamentos: 1,
                primeiro_agendamento_em:
                  "2026-08-02T00:00:00.000Z",
                segundo_agendamento_em: null,
                terceiro_agendamento_em: null,
              },
              {
                usuario_id: 3,
                negocio_id: 13,
                classificacao_atribuicao: "oficial",
                campanha_oficial_id: "20",
                origem: "meta",
                midia: "paid_social",
                campanha: "meta_profissionais",
                metodo_resolucao: "vinculo_unico",
                total_agendamentos: 2,
                primeiro_agendamento_em:
                  "2026-08-25T00:00:00.000Z",
                segundo_agendamento_em:
                  "2026-08-26T00:00:00.000Z",
                terceiro_agendamento_em: null,
              },
              {
                usuario_id: 4,
                negocio_id: 14,
                classificacao_atribuicao:
                  "identidade_nao_oficial",
                campanha_oficial_id: null,
                origem: "google",
                midia: "cpc",
                campanha: "google_ads_profissionais",
                metodo_resolucao: null,
                total_agendamentos: 3,
                primeiro_agendamento_em:
                  "2026-08-01T00:00:00.000Z",
                segundo_agendamento_em:
                  "2026-08-02T00:00:00.000Z",
                terceiro_agendamento_em:
                  "2026-08-03T00:00:00.000Z",
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
          resultado.qualidadeCampanhasOficiais
        ).toHaveLength(2);

        expect(
          resultado.qualidadeCampanhasOficiais[0]
        ).toMatchObject({
          campanhaOficialId: "10",
          origem: "google",
          midia: "cpc",
          campanha: "google_ads_profissionais",
          metodosResolucao: [
            "utm_exata",
            "vinculo_plataforma",
          ],
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
          ],
        });

        expect(
          resultado.qualidadeCampanhasOficiais[1]
        ).toMatchObject({
          campanhaOficialId: "20",
          origem: "meta",
          profissionais: 1,
          comPrimeiroAgendamento: 1,
          janelasCandidatas: [
            {
              janelaDias: 7,
              elegiveis: 0,
              comSegundoNaJanela: 0,
              comTerceiroNaJanela: 0,
            },
          ],
        });

        expect(
          resultado.metodologia.campanhas
        ).toMatch(
          /somente campanhas com atribuição oficial/i
        );
      }
    );
  }
);
