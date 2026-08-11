const crypto = require("crypto");
const db = require("../src/db/db");
const dashboardRepository = require(
  "../src/repositories/dashboardRepository"
);
const {
  criarCenarioAgendamento,
  removerCenarioAgendamento,
} = require("./helpers/cenarioAgendamento");

function uniqueValue(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

describe("dashboardRepository integrado", () => {
  let cenario;
  let clientes = [];
  let sessoes = [];

  beforeEach(async () => {
    cenario = await criarCenarioAgendamento(db, {
      prefixo: "dashboard-metricas",
    });
  });

  afterEach(async () => {
    if (sessoes.length > 0) {
      await db.query(
        "DELETE FROM eventos_produto WHERE sessao_id = ANY($1::TEXT[])",
        [sessoes]
      );
    }

    await removerCenarioAgendamento(db, cenario);

    if (clientes.length > 0) {
      await db.query(
        "DELETE FROM usuarios WHERE id = ANY($1::BIGINT[])",
        [clientes]
      );
    }

    clientes = [];
    sessoes = [];
  });

  async function criarCliente(nome) {
    const token = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
    const resultado = await db.query(
      `
        INSERT INTO usuarios (nome, email, senha, whatsapp)
        VALUES ($1, $2, 'hash-teste', $3)
        RETURNING id
      `,
      [nome, `${token}@dashboard.test`, `629${token.slice(0, 8)}`]
    );
    const id = Number(resultado.rows[0].id);
    clientes.push(id);
    return id;
  }

  async function criarAgendamento(clienteId, deslocamentoDias) {
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
          (NOW() AT TIME ZONE 'America/Sao_Paulo')::date + $5::int,
          '10:00',
          'agendado'
        )
      `,
      [
        cenario.negocioId,
        cenario.servico.id,
        cenario.profissional.id,
        clienteId,
        deslocamentoDias,
      ]
    );
  }

  test("mantém preço histórico, exclui o futuro e conta somente a primeira visita do cliente", async () => {
    const clienteAntigo = await criarCliente("Cliente antigo");
    const clienteNovo = await criarCliente("Cliente novo");

    await criarAgendamento(clienteAntigo, -10);
    await criarAgendamento(clienteAntigo, 0);
    await criarAgendamento(clienteNovo, 0);
    await criarAgendamento(clienteNovo, 3);

    await db.query(
      "UPDATE servicos_negocio SET valor = 99 WHERE id = $1",
      [cenario.servico.id]
    );

    const filtro =
      "AND a.data BETWEEN " +
      "(NOW() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '6 days' " +
      "AND (NOW() AT TIME ZONE 'America/Sao_Paulo')::date";

    const resumo = await dashboardRepository.buscarResumoDono(
      cenario.negocioId,
      filtro
    );
    const ranking = await dashboardRepository.buscarRankingServicos(
      cenario.negocioId,
      filtro
    );

    expect(resumo).toMatchObject({
      agendamentos_periodo: 2,
      clientes_novos: 1,
    });
    expect(Number(resumo.faturamento_periodo)).toBe(100);
    expect(Number(ranking[0].faturamento)).toBe(100);
  });

  test("filtra visitas e conversões pela mesma janela de tempo", async () => {
    const sessaoAtual = uniqueValue("dash-current").replaceAll("-", "").slice(0, 32);
    const sessaoAntiga = uniqueValue("dash-old").replaceAll("-", "").slice(0, 32);
    sessoes.push(sessaoAtual, sessaoAntiga);

    await db.query(
      `
        INSERT INTO eventos_produto (
          nome,
          pagina,
          sessao_id,
          negocio_id,
          created_at
        )
        VALUES
          ('perfil_visualizado', 'perfil_negocio', $1, $3, NOW()),
          ('agendamento_concluido', 'finalizar_agendamento', $1, $3, NOW()),
          ('perfil_visualizado', 'perfil_negocio', $2, $3, NOW() - INTERVAL '20 days')
      `,
      [sessaoAtual, sessaoAntiga, cenario.negocioId]
    );

    const filtro =
      "AND (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN " +
      "(NOW() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '6 days' " +
      "AND (NOW() AT TIME ZONE 'America/Sao_Paulo')::date";
    const performance = await dashboardRepository.buscarPerformanceNegocio(
      cenario.negocioId,
      filtro
    );

    expect(performance).toMatchObject({
      visitas_perfil: 1,
      agendamentos_concluidos: 1,
    });
  });
});
