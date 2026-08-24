const crypto = require("crypto");
const db = require("../src/db/db");
const repository = require(
  "../src/repositories/dashboardCustomerOriginRepository"
);
const {
  criarCenarioAgendamento,
  removerCenarioAgendamento,
} = require("./helpers/cenarioAgendamento");

describe("origem de clientes integrada", () => {
  let cenario;
  let clientes = [];
  let sessoes = [];

  beforeEach(async () => {
    cenario = await criarCenarioAgendamento(db, {
      prefixo: "dashboard-origem",
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
    const whatsapp = `63${crypto.randomInt(100_000_000, 1_000_000_000)}`;
    const result = await db.query(
      `
        INSERT INTO usuarios (nome, email, senha, whatsapp)
        VALUES ($1, $2, 'hash-teste', $3)
        RETURNING id
      `,
      [nome, `${token}@origem.test`, whatsapp]
    );
    const id = Number(result.rows[0].id);
    clientes.push(id);
    return id;
  }

  async function criarAgendamento(clienteId, deslocamentoDias, horario) {
    const result = await db.query(
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
          $6,
          'agendado'
        )
        RETURNING id
      `,
      [
        cenario.negocioId,
        cenario.servico.id,
        cenario.profissional.id,
        clienteId,
        deslocamentoDias,
        horario,
      ]
    );

    return Number(result.rows[0].id);
  }

  async function criarEvento(agendamentoId, propriedades = {}) {
    const sessao = crypto.randomUUID().replaceAll("-", "").slice(0, 32);
    sessoes.push(sessao);

    await db.query(
      `
        INSERT INTO eventos_produto (
          nome,
          pagina,
          sessao_id,
          negocio_id,
          propriedades
        )
        VALUES (
          'agendamento_concluido',
          'finalizar_agendamento',
          $1,
          $2,
          $3::jsonb
        )
      `,
      [
        sessao,
        cenario.negocioId,
        JSON.stringify({
          agendamento_id: agendamentoId,
          ...propriedades,
        }),
      ]
    );
  }

  test("atribui cliente ao primeiro canal e mantém retorno na origem de aquisição", async () => {
    const clienteGoogle = await criarCliente("Cliente Google");
    const clienteAutonomo = await criarCliente("Cliente Autônomo");
    const clienteOrganico = await criarCliente("Cliente Orgânico");
    const clienteSemHistorico = await criarCliente("Cliente Sem Histórico");

    const googlePrimeiro = await criarAgendamento(clienteGoogle, 0, "09:00");
    await criarAgendamento(clienteGoogle, 0, "10:00");
    await criarEvento(googlePrimeiro, {
      gclid: "gclid-cliente-google",
    });

    const autonomo = await criarAgendamento(clienteAutonomo, 0, "11:00");
    await criarEvento(autonomo);

    const organicoPrimeiro = await criarAgendamento(clienteOrganico, -10, "12:00");
    await criarAgendamento(clienteOrganico, 0, "13:00");
    await criarEvento(organicoPrimeiro, {
      referrer_host: "www.google.com",
    });

    await criarAgendamento(clienteSemHistorico, 0, "14:00");

    const linhas = await repository.buscarOrigemClientes(
      cenario.negocioId,
      "7dias"
    );

    const google = linhas.find(
      (linha) => linha.origem_codigo === "google_ads"
    );
    const autonomoLinha = linhas.find(
      (linha) => linha.origem_codigo === "autonomo"
    );
    const organico = linhas.find(
      (linha) => linha.origem_codigo === "busca_organica"
    );
    const desconhecido = linhas.find(
      (linha) => linha.origem_codigo === "nao_identificado"
    );

    expect(google).toMatchObject({
      clientes: 1,
      clientes_novos: 1,
      clientes_recorrentes: 0,
      agendamentos: 2,
    });
    expect(Number(google.faturamento)).toBe(100);

    expect(autonomoLinha).toMatchObject({
      clientes: 1,
      clientes_novos: 1,
      agendamentos: 1,
    });

    expect(organico).toMatchObject({
      clientes: 1,
      clientes_novos: 0,
      clientes_recorrentes: 1,
      agendamentos: 1,
    });

    expect(desconhecido).toMatchObject({
      clientes: 1,
      agendamentos: 1,
    });
  });

  test("normaliza período inválido para sete dias", () => {
    expect(repository.periodoSeguro("qualquer"))
      .toBe("7dias");
  });
});
