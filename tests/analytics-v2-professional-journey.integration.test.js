jest.setTimeout(90000);

const { randomUUID } = require("crypto");
const request = require("supertest");
jest.mock("../src/services/googleIdentityService", () => ({
  ...jest.requireActual("../src/services/googleIdentityService"),
  verificarCredencial: jest.fn(),
}));

const app = require("../src/server");
const db = require("../src/db/db");
const googleIdentityService = require("../src/services/googleIdentityService");
const { buscarJornada } = require("../src/repositories/adminAnalyticsV2Repository");

const usuarios = [];
const negocios = [];
const visitantes = [];
const agendamentos = [];
const clientes = [];

function numerosWhatsapp() {
  return "629" + String(Date.now()).slice(-8);
}

async function registrarVisita(agent, metodo, { deslocamentoMs = 0 } = {}) {
  const visitorUuid = randomUUID();
  const sessionUuid = randomUUID();
  const viewUuid = randomUUID();
  visitantes.push(visitorUuid);
  // Deslocamento simula relógio de celular incorreto, não altera o PostgreSQL.
  const occurredAt = new Date(Date.now() + deslocamentoMs).toISOString();
  const inicio = metodo === "google"
    ? { method: "google", trigger: "google_credential" }
    : { method: "email", trigger: "form_input" };
  const resposta = await agent.post("/analytics/collect").send({
    visitorUuid,
    sessionUuid,
    acquisition: {},
    items: [
      {
        type: "page_view", viewUuid, sequence: 1,
        pageKey: "professional_register", routeTemplate: "/cadastro", occurredAt
      },
      {
        type: "event", eventUuid: randomUUID(), viewUuid, schemaVersion: 1,
        name: "professional_signup_started", properties: inicio, occurredAt
      },
      {
        type: "event", eventUuid: randomUUID(), viewUuid, schemaVersion: 1,
        name: "professional_signup_submitted", properties: { method: metodo }, occurredAt
      }
    ]
  });
  expect(resposta.status).toBe(202);
  expect(resposta.body.gravados).toBe(3);
  return { visitorUuid, sessionUuid };
}

async function identificarSessao(agent, tracking, usuarioId, { deslocamentoMs = 0 } = {}) {
  const ocorrido = new Date(Date.now() + deslocamentoMs).toISOString();
  const resposta = await agent.post("/analytics/collect").send({
    visitorUuid: tracking.visitorUuid,
    sessionUuid: tracking.sessionUuid,
    acquisition: {},
    items: [{
      type: "page_view",
      viewUuid: randomUUID(),
      sequence: 2,
      pageKey: "create_business",
      routeTemplate: "/criar-negocio",
      occurredAt: ocorrido
    }]
  });
  expect(resposta.status).toBe(202);
  const consulta = await db.query(
    "SELECT usuario_id, identificado_em, NOW() AS servidor_agora FROM analytics_sessoes WHERE session_uuid = $1::UUID",
    [tracking.sessionUuid]
  );
  expect(Number(consulta.rows[0]?.usuario_id)).toBe(usuarioId);
  // Identificação é marcada pelo relógio do PostgreSQL, mesmo com celular adiantado/atrasado.
  expect(Math.abs(
    new Date(consulta.rows[0].identificado_em).getTime() -
    new Date(consulta.rows[0].servidor_agora).getTime()
  )).toBeLessThan(30000);
}

async function criarNegocioReal(agent, suffix, usuarioId) {
  const resposta = await agent.post("/criar-negocio").send({
    nome: "Studio Analytics " + suffix,
    descricao: "Negócio criado para teste de integração.",
    especialidades: ["Unhas"],
    whatsapp: "62999999999",
    cidade: "Goiânia",
    estado: "GO",
    bairro: "Centro",
    endereco: "Rua Teste",
    numero: "10",
    cep: "74000123",
    localizacao_url: "https://maps.google.com/?q=goiania"
  });
  if (resposta.body?.negocio?.id) negocios.push(Number(resposta.body.negocio.id));
  expect(resposta.status).toBe(201);
  const negocioId = Number(resposta.body.negocio.id);
  const vinculo = await db.query(
    "SELECT papel FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2",
    [usuarioId, negocioId]
  );
  expect(vinculo.rows[0]?.papel).toBe("dono");
  return negocioId;
}


async function criarAgendamentoPersistido(negocioId, usuarioId, suffix) {
  const servico = await db.query(
    `
    INSERT INTO servicos_negocio (negocio_id, nome, descricao, valor, duracao_minutos)
    VALUES ($1, $2, 'Serviço isolado de teste da jornada.', 50, 60)
    RETURNING id
    `,
    [negocioId, "Serviço Jornada " + suffix]
  );
  const servicoId = Number(servico.rows[0].id);
  // Agendamento real persistido no banco. Não testa a disponibilidade da API pública.
  const dia = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const agendamento = await db.query(
    `
    INSERT INTO agendamentos (
      data, horario, profissional_id, cliente_nome, cliente_whatsapp,
      servico_id, valor_servico, negocio_id, status, confirmado_em
    ) VALUES ($1, '10:00', $2, $3, $4, $5, 50, $6, 'confirmado', NOW())
    RETURNING id, client_id
    `,
    [
      dia, usuarioId, "Cliente Jornada " + suffix,
      "629" + String(Date.now()).slice(-8), servicoId, negocioId
    ]
  );
  const bookingId = Number(agendamento.rows[0].id);
  agendamentos.push(bookingId);
  if (agendamento.rows[0].client_id) clientes.push(Number(agendamento.rows[0].client_id));
  return bookingId;
}

describe("Cadastro real vinculado ao analytics e ao primeiro negócio", () => {
  afterEach(() => jest.clearAllMocks());

  afterAll(async () => {
    try {
      if (visitantes.length) {
        // Eventos de analytics fazem FK SET NULL: apagar explicitamente os testes.
        await db.query(
          "DELETE FROM analytics_eventos WHERE sessao_id IN (" +
          "SELECT s.id FROM analytics_sessoes s JOIN analytics_visitantes v ON v.id = s.visitante_id " +
          "WHERE v.visitor_uuid = ANY($1::UUID[]))",
          [visitantes]
        );
        await db.query(
          "DELETE FROM analytics_visitantes WHERE visitor_uuid = ANY($1::UUID[])",
          [visitantes]
        );
      }
      if (agendamentos.length) {
        await db.query("DELETE FROM agendamentos WHERE id = ANY($1::BIGINT[])", [agendamentos]);
      }
      if (clientes.length) {
        await db.query("DELETE FROM clientes WHERE id = ANY($1::BIGINT[])", [clientes]);
      }
      if (negocios.length) {
        await db.query("DELETE FROM negocios WHERE id = ANY($1::BIGINT[])", [negocios]);
      }
      if (usuarios.length) {
        await db.query("DELETE FROM usuarios WHERE id = ANY($1::BIGINT[])", [usuarios]);
      }
    } finally {
      await db.end();
    }
  });

  test("email: relógio 2 min adiantado → conta → negócio → agendamento confirmado/cancelado", async () => {
    const baseline = await buscarJornada("today");
    const agent = request.agent(app);
    const tracking = await registrarVisita(agent, "email", { deslocamentoMs: 2 * 60 * 1000 });
    const suffix = randomUUID().slice(0, 12);
    const email = "af-reconciliacao-email-" + suffix + "@teste.local";

    const cadastro = await agent.post("/cadastro").send({
      nome: "Profissional Integração",
      email,
      whatsapp: numerosWhatsapp(),
      senha: "senha-mais-de-oito-123",
      perfil_profissional: true
    });
    if (cadastro.body?.usuario?.id) usuarios.push(Number(cadastro.body.usuario.id));
    expect(cadastro.status).toBe(201);
    expect(cadastro.body.contaCriada).toBe(true);
    expect(cadastro.body.usuario.perfil_profissional_ativo).toBe(true);
    const id = Number(cadastro.body.usuario.id);

    const contaPersistida = await db.query(
      "SELECT id FROM usuarios WHERE email = $1 AND perfil_profissional_ativado_em IS NOT NULL",
      [email]
    );
    expect(contaPersistida.rows).toHaveLength(1);
    expect(Number(contaPersistida.rows[0].id)).toBe(id);

    await identificarSessao(agent, tracking, id, { deslocamentoMs: 2 * 60 * 1000 });
    const negocioId = await criarNegocioReal(agent, suffix, id);
    const bookingId = await criarAgendamentoPersistido(negocioId, id, suffix);

    const atual = await buscarJornada("today");
    for (const key of [
      "contas_novas_vinculadas", "contas_com_negocio_vinculadas",
      "contas_com_agendamento_vinculadas"
    ]) {
      expect(Number(atual.cadastroProfissional[key]) - Number(baseline.cadastroProfissional[key])).toBe(1);
    }

    // Cancelamento não é primeiro agendamento válido no funil oficial.
    await db.query("UPDATE agendamentos SET status = 'cancelado', cancelado_em = NOW() WHERE id = $1", [bookingId]);
    const cancelado = await buscarJornada("today");
    expect(Number(cancelado.cadastroProfissional.contas_com_agendamento_vinculadas) -
      Number(baseline.cadastroProfissional.contas_com_agendamento_vinculadas)).toBe(0);
  });

  test("Google: relógio 2 min atrasado, conta real; login repetido não cria outra", async () => {
    const baseline = await buscarJornada("today");
    const agent = request.agent(app);
    const tracking = await registrarVisita(agent, "google", { deslocamentoMs: -2 * 60 * 1000 });
    const suffix = randomUUID().slice(0, 12);
    const email = "af-reconciliacao-google-" + suffix + "@teste.local";
    const googleSub = "simulado-" + randomUUID();
    googleIdentityService.verificarCredencial.mockResolvedValue({
      googleSub, email, nome: "Profissional Google Teste", emailAutoritativo: true
    });
    const cadastro = await agent.post("/auth/google").send({
      credential: "credencial-simulada-apenas-ci",
      perfil_profissional: true
    });
    if (cadastro.body?.usuario?.id) usuarios.push(Number(cadastro.body.usuario.id));
    expect(cadastro.status).toBe(200);
    expect(cadastro.body.contaCriada).toBe(true);
    const id = Number(cadastro.body.usuario.id);
    expect(cadastro.body.usuario.perfil_profissional_ativo).toBe(true);
    await identificarSessao(agent, tracking, id, { deslocamentoMs: -2 * 60 * 1000 });
    await criarNegocioReal(agent, suffix, id);

    const loginRepetido = await agent.post("/auth/google").send({
      credential: "credencial-simulada-apenas-ci", perfil_profissional: true
    });
    expect(loginRepetido.status).toBe(200);
    expect(loginRepetido.body.contaCriada).toBe(false);
    expect(Number(loginRepetido.body.usuario.id)).toBe(id);
    const persistido = await db.query(
      "SELECT COUNT(*)::INT AS total FROM usuarios WHERE email = $1",
      [email]
    );
    expect(persistido.rows[0].total).toBe(1);

    const atual = await buscarJornada("today");
    for (const key of ["contas_novas_vinculadas", "contas_com_negocio_vinculadas"]) {
      expect(Number(atual.cadastroProfissional[key]) - Number(baseline.cadastroProfissional[key])).toBe(1);
    }
  });


  test("rejeita correspondência quando a conta já existia antes da visita", async () => {
    const agent = request.agent(app);
    const suffix = randomUUID().slice(0, 12);
    const email = "af-reconciliacao-existente-" + suffix + "@teste.local";
    const conta = await agent.post("/cadastro").send({
      nome: "Profissional Existente", email,
      whatsapp: numerosWhatsapp(), senha: "senha-mais-de-oito-123",
      perfil_profissional: true
    });
    if (conta.body?.usuario?.id) usuarios.push(Number(conta.body.usuario.id));
    expect(conta.status).toBe(201);
    // Mesmo autenticada, uma conta anterior não é novo cadastro da visita posterior.
    const baseline = await buscarJornada("today");
    await registrarVisita(agent, "email");
    const atual = await buscarJornada("today");
    expect(Number(atual.cadastroProfissional.contas_novas_vinculadas) -
      Number(baseline.cadastroProfissional.contas_novas_vinculadas)).toBe(0);
  });

  test("relógio 15 minutos atrasado permanece fora da reconciliação conservadora", async () => {
    const agent = request.agent(app);
    const baseline = await buscarJornada("today");
    const tracking = await registrarVisita(agent, "email", {
      deslocamentoMs: -15 * 60 * 1000
    });
    const suffix = randomUUID().slice(0, 12);
    const email = "af-reconciliacao-atrasado-" + suffix + "@teste.local";
    const cadastro = await agent.post("/cadastro").send({
      nome: "Profissional Atrasada", email,
      whatsapp: numerosWhatsapp(), senha: "senha-mais-de-oito-123",
      perfil_profissional: true
    });
    if (cadastro.body?.usuario?.id) usuarios.push(Number(cadastro.body.usuario.id));
    expect(cadastro.status).toBe(201);
    await identificarSessao(agent, tracking, Number(cadastro.body.usuario.id));
    const atual = await buscarJornada("today");
    expect(Number(atual.cadastroProfissional.contas_novas_vinculadas) -
      Number(baseline.cadastroProfissional.contas_novas_vinculadas)).toBe(0);
  });


  test("consulta de jornada possui plano SQL executável no banco de teste", async () => {
    // Smoke de EXPLAIN ANALYZE sobre dados sintéticos; não é benchmark de produção.
    const spy = jest.spyOn(db, "query");
    let query;
    try {
      await buscarJornada("30");
      query = spy.mock.calls.find(([sql]) => typeof sql === "string" &&
        sql.includes("WITH visitas AS"))?.[0];
    } finally {
      spy.mockRestore();
    }
    expect(query).toBeTruthy();
    const plan = await db.query("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query);
    expect(plan.rows[0]["QUERY PLAN"][0].Plan["Node Type"]).toBeTruthy();
  });

  test("sessão anônima sem conta não vira conversão atribuída", async () => {
    const baseline = await buscarJornada("today");
    const agent = request.agent(app);
    await registrarVisita(agent, "email");
    const atual = await buscarJornada("today");
    expect(Number(atual.cadastroProfissional.sessoes_visita)).toBeGreaterThanOrEqual(
      Number(baseline.cadastroProfissional.sessoes_visita) + 1
    );
    expect(Number(atual.cadastroProfissional.contas_novas_vinculadas)).toBe(
      Number(baseline.cadastroProfissional.contas_novas_vinculadas)
    );
  });
});
