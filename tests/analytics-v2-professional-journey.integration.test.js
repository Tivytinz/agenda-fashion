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

function numerosWhatsapp() {
  return "629" + String(Date.now()).slice(-8);
}

async function registrarVisita(agent, metodo) {
  const visitorUuid = randomUUID();
  const sessionUuid = randomUUID();
  const viewUuid = randomUUID();
  visitantes.push(visitorUuid);
  const occurredAt = new Date().toISOString();
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

async function identificarSessao(agent, tracking, usuarioId) {
  const ocorrido = new Date().toISOString();
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
    "SELECT usuario_id FROM analytics_sessoes WHERE session_uuid = $1::UUID",
    [tracking.sessionUuid]
  );
  expect(Number(consulta.rows[0]?.usuario_id)).toBe(usuarioId);
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

  test("email: visita → tentativa → conta persistida → sessão autenticada → negócio", async () => {
    const baseline = await buscarJornada("today");
    const agent = request.agent(app);
    const tracking = await registrarVisita(agent, "email");
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

    await identificarSessao(agent, tracking, id);
    await criarNegocioReal(agent, suffix, id);

    const atual = await buscarJornada("today");
    for (const key of ["contas_novas_vinculadas", "contas_com_negocio_vinculadas"]) {
      expect(Number(atual.cadastroProfissional[key]) - Number(baseline.cadastroProfissional[key])).toBe(1);
    }
    expect(Number(atual.cadastroProfissional.contas_com_agendamento_vinculadas) -
      Number(baseline.cadastroProfissional.contas_com_agendamento_vinculadas)).toBe(0);
  });

  test("Google: credencial simulada, conta e negócio reais; login repetido não cria outra conta", async () => {
    const baseline = await buscarJornada("today");
    const agent = request.agent(app);
    const tracking = await registrarVisita(agent, "google");
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
    await identificarSessao(agent, tracking, id);
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
