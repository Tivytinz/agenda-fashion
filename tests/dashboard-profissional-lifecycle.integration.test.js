const db = require("../src/db/db");
const dashboardRepository = require(
  "../src/repositories/dashboardRepository"
);
const {
  criarCenarioAgendamento,
  removerCenarioAgendamento,
} = require("./helpers/cenarioAgendamento");

describe("resumo profissional com lifecycle persistido", () => {
  let cenario;

  beforeAll(async () => {
    cenario = await criarCenarioAgendamento(db, {
      prefixo: "dashboard-lifecycle",
    });

    await db.query(
      `
        INSERT INTO agendamentos (
          negocio_id,
          servico_id,
          profissional_id,
          cliente_id,
          data,
          horario,
          status,
          valor_servico,
          duracao_minutos
        )
        VALUES
          ($1, $2, $3, $3, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date, '08:00', 'realizado', 50, 60),
          ($1, $2, $3, $3, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date, '09:00', 'falta', 50, 60),
          ($1, $2, $3, $3, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date, '10:00', 'agendado', 50, 60),
          ($1, $2, $3, $3, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date, '11:00', 'confirmado', 50, 60)
      `,
      [
        cenario.negocioId,
        cenario.servico.id,
        cenario.profissional.id,
      ]
    );
  });

  afterAll(async () => {
    try {
      await removerCenarioAgendamento(db, cenario);
    } finally {
      await db.end();
    }
  });

  test("conta realizado somente pelo estado persistido e mantém falta fora dos pendentes", async () => {
    const resumo = await dashboardRepository.buscarResumoProfissional(
      cenario.negocioId,
      cenario.profissional.id
    );

    expect(resumo).toMatchObject({
      agendamentos_hoje: 4,
      realizados_hoje: 1,
      pendentes_hoje: 2,
    });
  });
});
