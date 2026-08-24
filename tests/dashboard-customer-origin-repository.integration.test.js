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

  test("separa Google pago, Google orgânico, Meta orgânico, autônomo e histórico incompleto", async () => {
    const clienteGoogle = await criarCliente("Cliente Google");
    const clienteAutonomo = await criarCliente("Cliente Autônomo");
    const clienteOrganico = await criarCliente("Cliente Orgânico");
    const clienteSocial = await criarCliente("Cliente Social");
    const clienteSemHistorico = await criarCliente("Cliente Sem Histórico");

    const googlePrimeiro = await criarAgendamento(clienteGoogle, 0, "09:00");
    await criarAgendamento(clienteGoogle, 0, "10:00");
    await criarEvento(googlePrimeiro, {
      gbraid: "gbraid-cliente-google",
    });

    const autonomo = await criarAgendamento(clienteAutonomo, 0, "11:00");
    await criarEvento(autonomo);

    const organicoPrimeiro = await criarAgendamento(clienteOrganico, -10, "12:00");
    await criarAgendamento(clienteOrganico, 0, "13:00");
    await criarEvento(organicoPrimeiro, {
      referrer_host: "www.google.com",
    });

    const social = await criarAgendamento(clienteSocial, 0, "13:30");
    await criarEvento(social, {
      fbclid: "facebook-click-id",
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
      (linha) => linha.origem_codigo === "google_organico"
    );
    const socialOrganico = linhas.find(
      (linha) => linha.origem_codigo === "meta_organico"
    );
    const desconhecido = linhas.find(
      (linha) => linha.origem_codigo === "nao_identificado"
    );
    const metaPago = linhas.find(
      (linha) => linha.origem_codigo === "meta_ads"
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

    expect(socialOrganico).toMatchObject({
      clientes: 1,
      clientes_novos: 1,
      agendamentos: 1,
    });
    expect(metaPago).toBeUndefined();

    expect(desconhecido).toMatchObject({
      clientes: 1,
      agendamentos: 1,
    });
  });

  test("identifica Meta Ads somente com sinal explícito de mídia paga", async () => {
    const clienteMeta = await criarCliente("Cliente Meta Ads");
    const primeiro = await criarAgendamento(clienteMeta, 0, "15:00");

    await criarEvento(primeiro, {
      utm_source: "instagram",
      utm_medium: "paid_social",
      utm_campaign: "campanha_meta_oficial",
      fbclid: "facebook-click-id",
    });

    const linhas = await repository.buscarOrigemClientes(
      cenario.negocioId,
      "7dias"
    );

    expect(
      linhas.find((linha) => linha.origem_codigo === "meta_ads")
    ).toMatchObject({
      clientes: 1,
      agendamentos: 1,
    });
  });

  test("separa Instagram orgânico de Instagram pago pelas UTMs", async () => {
    const clienteOrganico = await criarCliente("Instagram Orgânico");
    const clientePago = await criarCliente("Instagram Pago");
    const organico = await criarAgendamento(clienteOrganico, 0, "16:00");
    const pago = await criarAgendamento(clientePago, 0, "17:00");

    await criarEvento(organico, {
      utm_source: "instagram",
      utm_medium: "organic_social",
    });
    await criarEvento(pago, {
      utm_source: "instagram",
      utm_medium: "paid_social",
      utm_campaign: "campanha-instagram",
    });

    const linhas = await repository.buscarOrigemClientes(
      cenario.negocioId,
      "7dias"
    );

    expect(linhas.find(
      (linha) => linha.origem_codigo === "instagram_organico"
    )).toMatchObject({ clientes: 1 });
    expect(linhas.find(
      (linha) => linha.origem_codigo === "meta_ads"
    )).toMatchObject({ clientes: 1 });
  });

  test("identifica cliente vindo de link compartilhado pelo próprio AF", async () => {
    const cliente = await criarCliente("Cliente Compartilhamento AF");
    const primeiro = await criarAgendamento(cliente, 0, "18:00");

    await criarEvento(primeiro, {
      af_source: "agenda_fashion",
      af_medium: "share",
      af_content: "negocio",
    });

    const linhas = await repository.buscarOrigemClientes(
      cenario.negocioId,
      "7dias"
    );

    expect(linhas.find(
      (linha) => linha.origem_codigo === "af_compartilhamento"
    )).toMatchObject({
      clientes: 1,
      clientes_novos: 1,
      agendamentos: 1,
    });

    expect(linhas.find(
      (linha) => linha.origem_codigo === "autonomo"
    )).toBeUndefined();
  });

  test("prioriza sinal pago sobre etiqueta de compartilhamento do AF", async () => {
    const cliente = await criarCliente("Cliente AF depois Google Ads");
    const primeiro = await criarAgendamento(cliente, 0, "19:00");

    await criarEvento(primeiro, {
      af_source: "agenda_fashion",
      af_medium: "share",
      af_content: "negocio",
      gclid: "gclid-confirmado-prioridade",
    });

    const linhas = await repository.buscarOrigemClientes(
      cenario.negocioId,
      "7dias"
    );

    expect(linhas.find(
      (linha) => linha.origem_codigo === "google_ads"
    )).toMatchObject({
      clientes: 1,
      agendamentos: 1,
    });
    expect(linhas.find(
      (linha) => linha.origem_codigo === "af_compartilhamento"
    )).toBeUndefined();
  });

  test("normaliza período inválido para sete dias", () => {
    expect(repository.periodoSeguro("qualquer"))
      .toBe("7dias");
  });
});
