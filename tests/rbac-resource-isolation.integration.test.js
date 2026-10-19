jest.setTimeout(60000);
jest.unmock("../src/repositories/authSessionRepository");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/server");
const db = require("../src/db/db");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");

describe("RBAC: dois negócios e uma identidade com múltiplos papéis", () => {
  let a, b, propria, alheia;
  const clients = [];
  const token = () => jwt.sign({ id: a.profissional.id, papel: "superadmin", negocio_id: b.negocioId }, process.env.JWT_SECRET);
  const call = (method, path) => request(app)[method](path).set("Authorization", `Bearer ${token()}`);

  async function booking(cenario, profissional, label, days) {
    const r = await db.query(`INSERT INTO agendamentos
      (negocio_id, servico_id, profissional_id, cliente_nome, cliente_whatsapp,
       data, horario, status, valor_servico, duracao_minutos, servico_nome, antecedencia_cancelamento_horas)
      VALUES ($1,$2,$3,$4,'62999998888',CURRENT_DATE + $5::int,'14:00','confirmado',50,60,'Serviço RBAC',2)
      RETURNING id, client_id`, [cenario.negocioId, cenario.servico.id, profissional, label, days]);
    clients.push(r.rows[0].client_id);
    return Number(r.rows[0].id);
  }

  beforeAll(async () => {
    a = await criarCenarioAgendamento(db, { prefixo: "rbac-a" });
    b = await criarCenarioAgendamento(db, { prefixo: "rbac-b" });
    await db.query(`INSERT INTO usuarios_negocios (usuario_id,negocio_id,papel,created_at)
      VALUES ($1,$2,'profissional',NOW() - INTERVAL '10 days')`, [a.profissional.id,b.negocioId]);
    propria = await booking(b, a.profissional.id, "Cliente própria B", -2);
    alheia = await booking(b, b.profissional.id, "Cliente alheia B", -3);
    await booking(a, a.profissional.id, "Cliente contexto A", -4);
  });
  afterAll(async () => {
    await removerCenarioAgendamento(db, b);
    await removerCenarioAgendamento(db, a);
    if (clients.length) await db.query("DELETE FROM clientes WHERE id = ANY($1::bigint[])", [clients]);
    await db.end();
  });

  test("papel de dona em A não autoriza editar serviço de B, mesmo forjando IDs", async () => {
    const r = await call("patch", `/servicos/${b.servico.id}/ativo`)
      .set("X-AF-Contexto", "dono")
      .send({ ativo: false, negocio_id: b.negocioId, usuarioId: b.profissional.id, papel: "dono" });
    expect(r.status).toBe(404);
    const row = await db.query("SELECT ativo FROM servicos_negocio WHERE id=$1", [b.servico.id]);
    expect(row.rows[0].ativo).toBe(true);
  });

  test("papel profissional em B não autoriza gerir sua equipe", async () => {
    const r = await call("put", `/profissionais/${b.profissional.id}`)
      .send({ nome: "Nome injetado", negocioId: b.negocioId, usuarioId: b.profissional.id });
    expect(r.status).toBe(404);
    const row = await db.query("SELECT nome_exibicao FROM usuarios_negocios WHERE negocio_id=$1 AND usuario_id=$2", [b.negocioId,b.profissional.id]);
    expect(row.rows[0].nome_exibicao).not.toBe("Nome injetado");
  });

  test.each(["atendimento", "cancelar-operacional"])("profissional ativa não opera reserva de outra responsável (%s)", async (action) => {
    const r = await call("patch", `/agendamentos/${alheia}/${action}`)
      .send({ status: "falta", motivo_tipo: "outro", motivo: "Tentativa de alteração", usuarioId: b.profissional.id });
    expect(r.status).toBe(403);
    const row = await db.query("SELECT status FROM agendamentos WHERE id=$1", [alheia]);
    expect(row.rows[0].status).toBe("confirmado");
  });

  describe("vínculo de B inativo preservado (RN50)", () => {
    beforeAll(async () => {
      await db.query("UPDATE usuarios_negocios SET ativo=FALSE WHERE usuario_id=$1 AND negocio_id=$2", [a.profissional.id,b.negocioId]);
    });

    test("lista somente as próprias reservas de B e ignora o negócio/usuário enviado", async () => {
      const r = await call("get", "/reservas-profissionais-existentes")
        .query({ usuarioId: b.profissional.id, negocioId: a.negocioId });
      expect(r.status).toBe(200);
      expect(r.body.agendamentos.map(x => Number(x.id))).toEqual([propria]);
      expect(JSON.stringify(r.body)).not.toContain("Cliente alheia B");
      expect(JSON.stringify(r.body)).not.toContain("Cliente contexto A");
    });

    test("conclui apenas a própria reserva após o término previsto", async () => {
      const r = await call("patch", `/agendamentos/${propria}/atendimento`).send({ status: "realizado" });
      expect(r.status).toBe(200);
      expect(r.body.agendamento.status).toBe("realizado");
    });

    test.each(["atendimento", "cancelar-operacional", "reagendar-operacional"])("não amplia acesso para reserva alheia (%s)", async (action) => {
      const r = await call("patch", `/agendamentos/${alheia}/${action}`)
        .send({ status: "realizado", permitirInativo: true, usuarioId: b.profissional.id });
      expect(r.status).toBe(404);
    });

    test.each(["cancelar-operacional", "reagendar-operacional"])("nem reserva própria libera %s com vínculo inativo", async (action) => {
      const r = await call("patch", `/agendamentos/${propria}/${action}`)
        .send({ permitirInativo: true, negocioId: b.negocioId });
      expect(r.status).toBe(404);
    });

    test("não substitui vínculo profissional inativo pelo vínculo de dona em A", async () => {
      const r = await call("get", "/agenda-profissional");
      expect(r.status).toBe(403);
    });

    test("remover e recriar o vínculo não recupera reservas anteriores", async () => {
      await db.query("DELETE FROM usuarios_negocios WHERE usuario_id=$1 AND negocio_id=$2", [a.profissional.id,b.negocioId]);
      expect((await call("get", "/reservas-profissionais-existentes")).body.agendamentos).toEqual([]);
      await db.query(`INSERT INTO usuarios_negocios (usuario_id,negocio_id,papel,ativo,created_at)
        VALUES ($1,$2,'profissional',FALSE,NOW() + INTERVAL '1 second')`, [a.profissional.id,b.negocioId]);
      expect((await call("get", "/reservas-profissionais-existentes")).body.agendamentos).toEqual([]);
      expect((await call("patch", `/agendamentos/${propria}/atendimento`).send({ status: "realizado" })).status).toBe(404);
    });
  });
});
