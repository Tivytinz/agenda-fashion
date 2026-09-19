jest.setTimeout(60000);

const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/server");
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
        valor_servico,
        duracao_minutos,
        servico_nome
      )
      VALUES (
        $1,
        $2,
        $3,
        'Cliente Gate 1',
        '62999999999',
        $4,
        $5,
        'confirmado',
        50,
        60,
        'Serviço Teste CI'
      )
      RETURNING
        id,
        duracao_minutos,
        valor_servico,
        servico_nome
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
      SET
        nome = 'Serviço Teste CI',
        valor = 50,
        duracao_minutos = 60,
        ativo = TRUE
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
    "CA-AG-05: preserva o snapshot comercial após editar e desativar o serviço",
    async () => {
      const agendamento =
        await criarAgendamentoTeste();

      expect(
        Number(agendamento.duracao_minutos)
      ).toBe(60);

      expect(
        Number(agendamento.valor_servico)
      ).toBe(50);

      expect(agendamento.servico_nome)
        .toBe("Serviço Teste CI");

      await db.query(
        `
          UPDATE servicos_negocio
          SET
            nome = 'Serviço Editado',
            valor = 90,
            duracao_minutos = 30,
            ativo = FALSE
          WHERE id = $1
        `,
        [cenario.servico.id]
      );

      const registro = await db.query(
        `
          SELECT
            servico_nome,
            valor_servico,
            duracao_minutos
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

      expect(
        Number(
          registro.rows[0]?.valor_servico
        )
      ).toBe(50);

      expect(
        registro.rows[0]?.servico_nome
      ).toBe("Serviço Teste CI");

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
    "CA-AG-22: rejeita bloqueio manual sobre reserva futura confirmada",
    async () => {
      const agendamento =
        await criarAgendamentoTeste();

      expect(agendamento.id).toBeTruthy();

      const token = jwt.sign(
        { id: cenario.profissional.id },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );

      const resposta = await request(app)
        .post("/bloqueios-horario")
        .set("Authorization", `Bearer ${token}`)
        .send({
          data: dataTeste,
          hora: "14:30",
        });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.body.erro).toMatch(
        /horário já está agendado/i
      );

      const bloqueios = await db.query(
        `
          SELECT COUNT(*)::INT AS total
          FROM bloqueios_horarios
          WHERE profissional_id = $1
            AND data_bloqueio = $2
            AND hora_bloqueio = '14:30'
        `,
        [
          cenario.profissional.id,
          dataTeste,
        ]
      );

      expect(bloqueios.rows[0].total).toBe(0);
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
