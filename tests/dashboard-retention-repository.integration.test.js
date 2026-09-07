const crypto = require("crypto");
const db = require("../src/db/db");
const dashboardRetentionRepository = require(
  "../src/repositories/dashboardRetentionRepository"
);
const {
  criarCenarioAgendamento,
  removerCenarioAgendamento,
} = require("./helpers/cenarioAgendamento");

describe("dashboardRetentionRepository integrado", () => {
  let cenario;
  let clientes = [];

  beforeEach(async () => {
    cenario = await criarCenarioAgendamento(db, {
      prefixo: "dashboard-retencao",
    });
  });

  afterEach(async () => {
    await removerCenarioAgendamento(db, cenario);

    if (clientes.length > 0) {
      await db.query(
        "DELETE FROM usuarios WHERE id = ANY($1::BIGINT[])",
        [clientes]
      );
    }

    clientes = [];
  });

  async function criarCliente(nome) {
    const token = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
    const whatsapp = `62${crypto.randomInt(
      100_000_000,
      1_000_000_000
    )}`;
    const resultado = await db.query(
      `
        INSERT INTO usuarios (nome, email, senha, whatsapp)
        VALUES ($1, $2, 'hash-teste', $3)
        RETURNING id
      `,
      [nome, `${token}@retencao.test`, whatsapp]
    );
    const id = Number(resultado.rows[0].id);
    clientes.push(id);
    return id;
  }

  async function criarAgendamento(
    clienteId,
    horario,
    status = "agendado"
  ) {
    await db.query(
      `
        INSERT INTO agendamentos (
          negocio_id,
          servico_id,
          profissional_id,
          cliente_id,
          data,
          horario,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          CURRENT_DATE + 1,
          $5,
          $6
        )
      `,
      [
        cenario.negocioId,
        cenario.servico.id,
        cenario.profissional.id,
        clienteId,
        horario,
        status,
      ]
    );
  }

  test("conta clientes únicos e recorrentes sem incluir cancelados", async () => {
    const clienteRecorrente = await criarCliente("Cliente recorrente");
    const clienteUnico = await criarCliente("Cliente único");
    const clienteCancelado = await criarCliente("Cliente cancelado");

    await criarAgendamento(clienteRecorrente, "10:00");
    await criarAgendamento(clienteRecorrente, "11:00", "realizado");
    await criarAgendamento(clienteUnico, "12:00");
    await criarAgendamento(clienteCancelado, "13:00", "cancelado");

    const resumo =
      await dashboardRetentionRepository
        .buscarResumoRetencao(
          cenario.negocioId
        );

    expect(resumo).toMatchObject({
      clientes_unicos: 2,
      clientes_recorrentes: 1,
    });
  });
});
