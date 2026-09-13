jest.setTimeout(60000);

const db = require("../src/db/db");
const agendaRepository = require(
  "../src/repositories/agendaRepository"
);
const agendaPublicaRepository = require(
  "../src/repositories/agendaPublicaRepository"
);
const agendaDisponibilidadeService = require(
  "../src/services/agendaDisponibilidadeService"
);

const {
  criarCenarioAgendamento,
  removerCenarioAgendamento,
} = require("./helpers/cenarioAgendamento");

let cenario;
let dataTeste;

async function criarAgendamentoTeste({
  horario = "14:00",
} = {}) {
  const result = await db.query(
    `
      INSERT INTO agendamentos (
        negocio_id,
        servico_id,
        profissional_id,
        cliente_nome,
        cliente_whatsapp,
        data,
        horario,
        status,
        valor_servico
      )
      VALUES (
        $1,
        $2,
        $3,
        'Cliente Gate 1',
        '62999999999',
        $4,
        $5,
        'agendado',
        50
      )
      RETURNING
        id,
        duracao_minutos
    `,
    [
      cenario.negocioId,
      cenario.servico.id,
      cenario.profissional.id,
      dataTeste,
      horario,
    ]
  );

  return result.rows[0];
}

async function limparAgendaTeste() {
  await db.query(
    `
      DELETE FROM bloqueios_horarios
      WHERE profissional_id = $1
        AND data_bloqueio = $2
    `,
    [
      cenario.profissional.id,
      dataTeste,
    ]
  );

  await db.query(
    `
      DELETE FROM agendamentos
      WHERE negocio_id = $1
        AND data = $2
    `,
    [
      cenario.negocioId,
      dataTeste,
    ]
  );

  await db.query(
    `
      UPDATE servicos_negocio
      SET duracao_minutos = 60
      WHERE id = $1
    `,
    [cenario.servico.id]
  );
}

describe("Gate 1 - integridade crítica de agendamentos", () => {
  beforeAll(async () => {
    cenario = await criarCenarioAgendamento(db, {
      prefixo: "gate1-integridade",
    });

    dataTeste =
      agendaDisponibilidadeService
        .gerarDiasProximos(3)[2];
  });

  afterEach(async () => {
    await limparAgendaTeste();
  });

  afterAll(async () => {
    try {
      await limparAgendaTeste();
      await removerCenarioAgendamento(db, cenario);
    } finally {
      if (typeof db.end === "function") {
        await db.end();
      }
    }
  });

  test(
    "congela a duração histórica e não reabre parte do horário após editar o serviço",
    async () => {
      const agendamento =
        await criarAgendamentoTeste();

      expect(
        Number(agendamento.duracao_minutos)
      ).toBe(60);

      await db.query(
        `
          UPDATE servicos_negocio
          SET duracao_minutos = 30
          WHERE id = $1
        `,
        [cenario.servico.id]
      );

      const registro = await db.query(
        `
          SELECT duracao_minutos
          FROM agendamentos
          WHERE id = $1
        `,
        [agendamento.id]
      );

      expect(
        Number(
          registro.rows[0]?.duracao_minutos
        )
      ).toBe(60);

      const disponivel =
        await agendaDisponibilidadeService
          .horarioEstaDisponivel({
            profissionalId:
              cenario.profissional.id,
            duracaoServico: 30,
            data: dataTeste,
            horario: "14:30",
          });

      expect(disponivel).toBe(false);
    }
  );

  test(
    "detecta bloqueio dentro do intervalo de um agendamento ativo",
    async () => {
      const agendamento =
        await criarAgendamentoTeste();

      const conflito =
        await agendaRepository
          .buscarAgendamentoAtivo(
            cenario.profissional.id,
            dataTeste,
            "14:30"
          );

      expect(Number(conflito?.id)).toBe(
        Number(agendamento.id)
      );

      const limiteFinal =
        await agendaRepository
          .buscarAgendamentoAtivo(
            cenario.profissional.id,
            dataTeste,
            "15:00"
          );

      expect(limiteFinal).toBeNull();
    }
  );

  test(
    "reserva e bloqueio manual disputam a mesma trava por profissional e data",
    async () => {
      const reserva = await db.connect();
      const bloqueio = await db.connect();

      try {
        await reserva.query("BEGIN");
        await bloqueio.query("BEGIN");

        await agendaPublicaRepository
          .bloquearAgendaProfissional(
            reserva,
            cenario.profissional.id,
            dataTeste
          );

        await bloqueio.query(
          "SET LOCAL lock_timeout = '250ms'"
        );

        await expect(
          agendaRepository
            .bloquearAlteracaoHorario(
              cenario.profissional.id,
              dataTeste,
              "14:30",
              bloqueio
            )
        ).rejects.toMatchObject({
          code: "55P03",
        });
      } finally {
        await Promise.allSettled([
          reserva.query("ROLLBACK"),
          bloqueio.query("ROLLBACK"),
        ]);

        reserva.release();
        bloqueio.release();
      }
    }
  );
});
