jest.mock(
  "../src/repositories/agendaConfiguracaoRepository",
  () => ({
    buscarConfiguracao:
      jest.fn(),
    listarHorarios:
      jest.fn(),
    listarConfiguracoesHorariosNegocio:
      jest.fn(),
  })
);

jest.mock(
  "../src/repositories/agendaRepository",
  () => ({
    buscarBloqueiosPorPeriodo:
      jest.fn(),
    buscarNegocioDono:
      jest.fn(),
    buscarProfissionaisDoNegocio:
      jest.fn(),
    buscarBloqueiosProfissionaisPorPeriodo:
      jest.fn(),
  })
);

jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao:
      jest.fn(),
  })
);

const agendaConfiguracaoRepository = require(
  "../src/repositories/agendaConfiguracaoRepository"
);
const agendaRepository = require(
  "../src/repositories/agendaRepository"
);
const agendaService = require(
  "../src/services/agendaService"
);

describe(
  "agenda operacional usa disponibilidade contextual",
  () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(
        new Date(
          "2026-09-29T02:30:00.000Z"
        )
      );
      jest.clearAllMocks();

      agendaRepository
        .buscarBloqueiosPorPeriodo
        .mockResolvedValue([]);
      agendaRepository
        .buscarBloqueiosProfissionaisPorPeriodo
        .mockResolvedValue([]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test(
      "Minha agenda usa negocio_id, horários personalizados e fuso do vínculo",
      async () => {
        agendaConfiguracaoRepository
          .buscarConfiguracao
          .mockResolvedValue({
            duracao_padrao: 30,
            intervalo_minutos: 0,
          });

        agendaConfiguracaoRepository
          .listarHorarios
          .mockResolvedValue([
            {
              dia_semana: 2,
              trabalha: true,
              hora_inicio: "10:00",
              hora_fim: "11:00",
              intervalo_inicio: null,
              intervalo_fim: null,
            },
          ]);

        const resultado =
          await agendaService
            .listarAgendaProfissional({
              profissionalId: 7,
              negocioId: 55,
              fusoHorario:
                "America/Noronha",
            });

        expect(
          agendaConfiguracaoRepository
            .buscarConfiguracao
        ).toHaveBeenCalledWith(
          7,
          55
        );
        expect(
          agendaConfiguracaoRepository
            .listarHorarios
        ).toHaveBeenCalledWith(
          7,
          55
        );

        expect(
          resultado.fuso_horario
        ).toBe(
          "America/Noronha"
        );
        expect(
          resultado.agenda[0].data
        ).toBe(
          "2026-09-29"
        );
        expect(
          resultado.agenda[0]
            .horarios
            .map(
              (slot) =>
                slot.hora
            )
        ).toEqual([
          "10:00",
          "10:30",
        ]);
      }
    );

    test(
      "Agenda geral monta cada profissional a partir da própria configuração",
      async () => {
        agendaRepository
          .buscarNegocioDono
          .mockResolvedValue({
            negocio_id: 55,
            fuso_horario:
              "America/Noronha",
          });
        agendaRepository
          .buscarProfissionaisDoNegocio
          .mockResolvedValue([
            {
              id: 7,
              nome: "Ana",
              foto_url: null,
              servico_ids: [9],
            },
            {
              id: 8,
              nome: "Bia",
              foto_url: null,
              servico_ids: [10],
            },
          ]);

        agendaConfiguracaoRepository
          .listarConfiguracoesHorariosNegocio
          .mockResolvedValue([
            {
              profissional_id: 7,
              duracao_padrao: 30,
              intervalo_minutos: 0,
              dia_semana: 2,
              trabalha: true,
              hora_inicio: "10:00",
              hora_fim: "11:00",
              intervalo_inicio: null,
              intervalo_fim: null,
            },
            {
              profissional_id: 8,
              duracao_padrao: 60,
              intervalo_minutos: 0,
              dia_semana: 2,
              trabalha: true,
              hora_inicio: "14:00",
              hora_fim: "16:00",
              intervalo_inicio: null,
              intervalo_fim: null,
            },
          ]);

        const resultado =
          await agendaService
            .buscarAgendaGeral({
              usuarioId: 1,
            });

        expect(
          agendaConfiguracaoRepository
            .listarConfiguracoesHorariosNegocio
        ).toHaveBeenCalledWith({
          negocioId: 55,
          profissionalIds: [
            7,
            8,
          ],
        });

        expect(
          resultado.agenda[0].data
        ).toBe(
          "2026-09-29"
        );

        const [
          ana,
          bia,
        ] =
          resultado.agenda[0]
            .profissionais;

        expect(
          ana.horarios.map(
            (slot) => slot.hora
          )
        ).toEqual([
          "10:00",
          "10:30",
        ]);

        expect(
          bia.horarios.map(
            (slot) => slot.hora
          )
        ).toEqual([
          "14:00",
          "15:00",
        ]);
      }
    );
  }
);
