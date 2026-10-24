jest.setTimeout(30000);
jest.mock("../src/middlewares/auth", () => (req, _res, next) => {
  req.user = { id: Number(req.get("X-Test-Usuario")) };
  next();
});
const express = require("express");
const request = require("supertest");
const db = require("../src/db/db");
const analyticsRepository = require("../src/repositories/analyticsV2Repository");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const app = express();
app.use(express.json(), require("../src/routes/agendaRoutes"), require("../src/routes/profissionaisRoutes"));
app.use((error, _req, res, _next) => res.status(error.statusCode || error.status || 500).json({ erro: error.message, codigo: error.codigo }));
let studio, other, plan, owner, professional;
const post = (action) => request(app).post(`/profissionais/${professional}/${action}`).set("X-Test-Usuario", String(owner));
const link = async () => (await db.query("SELECT id, ativo, motivo_inatividade, created_at FROM usuarios_negocios WHERE negocio_id=$1 AND usuario_id=$2", [studio.negocioId, professional])).rows[0];
const events = async () => (await db.query("SELECT nome, origem, actor_user_id, propriedades FROM analytics_eventos WHERE target_business_id=$1 AND nome LIKE 'business_professional_%' ORDER BY id", [studio.negocioId])).rows;
beforeEach(async () => {
  studio = await criarCenarioAgendamento(db, { prefixo: "owner-third-fix" });
  other = await criarCenarioAgendamento(db, { prefixo: "owner-third-fix-pro" });
  owner = Number(studio.profissional.id); professional = Number(other.profissional.id);
  plan = (await db.query("INSERT INTO planos(nome, slug, valor, capacidade_agendamentos, limite_profissionais, limite_servicos) VALUES ('Plano teste correções',$1,0,100,3,10) RETURNING id", [`owner-third-${process.pid}-${Date.now()}`])).rows[0];
  await db.query("UPDATE negocios SET plano_id=$1 WHERE id=$2", [plan.id, studio.negocioId]);
  await db.query("INSERT INTO usuarios_negocios(usuario_id, negocio_id, papel) VALUES($1,$2,'profissional')", [professional, studio.negocioId]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  if (studio) {
    await db.query("DELETE FROM agendamento_reagendamentos WHERE negocio_id=$1", [studio.negocioId]);
    await db.query("DELETE FROM analytics_eventos WHERE target_business_id=$1", [studio.negocioId]);
    await removerCenarioAgendamento(db, studio);
  }
  if (other) await removerCenarioAgendamento(db, other);
  if (plan) await db.query("DELETE FROM planos WHERE id=$1", [plan.id]);
  studio = other = plan = null;
});
afterAll(async () => { await db.end(); });
async function booking(person, hora = "23:30", duration = 120) {
  return (await db.query(`INSERT INTO agendamentos(negocio_id, profissional_id, servico_id, cliente_nome, cliente_whatsapp, data, horario, status, duracao_minutos, valor_servico, servico_nome)
    VALUES($1,$2,$3,'Cliente teste','62999990002',(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date+4,$4,'confirmado',$5,75,'Nome original')
    RETURNING id, TO_CHAR(data,'YYYY-MM-DD') AS data, inicio_previsto_em`, [studio.negocioId, person, studio.servico.id, hora, duration])).rows[0];
}

test.each(["inativado_pela_dona", "excedente_limite_plano"])("TD-02: vínculo %s usa ativação explícita, sem criar outro convite", async (reason) => {
  await db.query("UPDATE usuarios_negocios SET ativo=FALSE, motivo_inatividade=$3 WHERE usuario_id=$1 AND negocio_id=$2", [professional, studio.negocioId, reason]);
  const before = await link();
  const response = await request(app).post("/profissionais/convites").set("X-Test-Usuario", String(owner)).send({ emailOuWhatsapp: other.profissional.email });
  expect(response.status).toBe(409);
  expect(response.body).toMatchObject({ codigo: "VINCULO_PROFISSIONAL_INATIVO" });
  expect(response.body.erro).toContain("Use Ativar profissional");
  expect((await db.query("SELECT id FROM convites_profissionais WHERE negocio_id=$1 AND usuario_convidado_id=$2", [studio.negocioId, professional])).rows).toHaveLength(0);
  expect(await link()).toEqual(before);
  expect((await post("ativar")).status).toBe(200);
  expect((await link()).ativo).toBe(true);
});

test.each([true, false])("TD-03: reserva atravessa o período com profissional ativa=%s, conservando ações e início real", async (active) => {
  const record = await booking(professional);
  const next = (await db.query("SELECT TO_CHAR($1::date+1,'YYYY-MM-DD') AS data", [record.data])).rows[0].data;
  if (!active) expect((await post("inativar")).status).toBe(200);
  const response = await request(app).get("/agenda-geral").query({ data_inicio: next }).set("X-Test-Usuario", String(owner));
  expect(response.status).toBe(200);
  const person = response.body.agenda[0].profissionais.find((p) => Number(p.id) === professional);
  expect(person).toBeDefined();
  const continued = person.horarios.find((s) => String(s.agendamento_id) === String(record.id));
  expect(continued).toMatchObject({ hora: "00:00", status: "confirmado", continuacao: true,
    data_agendamento: record.data, hora_agendamento: "23:30", pode_cancelar: true, pode_reagendar: true });
  if (!active) expect(person.horarios).toEqual([continued]);
  const original = await request(app).get("/agenda-geral").query({ data_inicio: record.data }).set("X-Test-Usuario", String(owner));
  const originalCard = original.body.agenda[0].profissionais.find((p) => Number(p.id) === professional).horarios.find((s) => String(s.agendamento_id) === String(record.id));
  expect(originalCard.hora).toBe("23:30");
  expect(originalCard.continuacao).toBeUndefined();
  expect((await db.query("SELECT inicio_previsto_em FROM agendamentos WHERE id=$1", [record.id])).rows[0].inicio_previsto_em).toEqual(record.inicio_previsto_em);
});

test("TD-03: inativa não volta à lista quando o fim é exatamente o início do período", async () => {
  const record = await booking(professional, "23:00", 60);
  expect((await post("inativar")).status).toBe(200);
  const next = (await db.query("SELECT TO_CHAR($1::date+1,'YYYY-MM-DD') AS data", [record.data])).rows[0].data;
  const response = await request(app).get("/agenda-geral").query({ data_inicio: next }).set("X-Test-Usuario", String(owner));
  expect(response.body.agenda[0].profissionais.some((p) => Number(p.id) === professional)).toBe(false);
});

test("TD-04: fatos da dona são atômicos, identificam o ator real e não se repetem em pedidos idempotentes", async () => {
  const before = await link();
  for (let i=0; i<2; i++) expect((await post("inativar").send({ actor_type: "SYSTEM", actor_id: professional })).status).toBe(200);
  for (let i=0; i<2; i++) expect((await post("ativar")).status).toBe(200);
  const facts = await events();
  expect(facts).toHaveLength(2);
  expect(facts[0]).toMatchObject({ nome: "business_professional_deactivated", origem: "backend",
    actor_user_id: String(owner), propriedades: { business_id: studio.negocioId, professional_id: professional,
      actor_type: "OWNER", actor_id: owner, reason: "inativado_pela_dona" } });
  expect(facts[1]).toMatchObject({ nome: "business_professional_reactivated", propriedades: { actor_type: "OWNER", actor_id: owner } });
  expect(await link()).toMatchObject({ id: before.id, created_at: before.created_at, ativo: true });
});

test("TD-04: downgrade registra SYSTEM, preserva reservas e não repete os fatos", async () => {
  const record = await booking(professional);
  await db.query("UPDATE planos SET limite_profissionais=1 WHERE id=$1", [plan.id]);
  const { reconciliarLimiteProfissionais } = require("../src/services/equipePlanoService");
  expect(await db.executarTransacao((client) => reconciliarLimiteProfissionais(studio.negocioId, client))).toHaveLength(1);
  expect(await db.executarTransacao((client) => reconciliarLimiteProfissionais(studio.negocioId, client))).toHaveLength(0);
  expect(await events()).toEqual([expect.objectContaining({ nome: "business_professional_deactivated", actor_user_id: null,
    propriedades: expect.objectContaining({ actor_type: "SYSTEM", actor_id: null, professional_id: professional, reason: "excedente_limite_plano" }) })]);
  expect((await db.query("SELECT status FROM agendamentos WHERE id=$1", [record.id])).rows[0].status).toBe("confirmado");
});

test.each(["inativar", "ativar"])("TD-04: erro ao persistir evento desfaz a transição %s", async (action) => {
  if (action === "ativar") await db.query("UPDATE usuarios_negocios SET ativo=FALSE, motivo_inatividade='inativado_pela_dona' WHERE usuario_id=$1 AND negocio_id=$2", [professional, studio.negocioId]);
  const before = await link();
  jest.spyOn(analyticsRepository, "registrarEvento").mockRejectedValueOnce(new Error("Persistência de evento indisponível"));
  expect((await post(action)).status).toBe(500);
  expect(await link()).toEqual(before);
  expect(await events()).toHaveLength(0);
});

test("TD-05: compara instantes após correção de fuso e conserva os snapshots", async () => {
  const record = await booking(owner, "09:00", 60);
  await db.query("UPDATE negocios SET fuso_horario='America/Manaus' WHERE id=$1", [studio.negocioId]);
  const args = { usuarioId: owner, negocioId: studio.negocioId, agendamentoId: record.id, data: record.data, profissionalId: owner };
  const { reagendarOperacional } = require("../src/services/agendamentoReagendamentoService");
  // 08h em Manaus é o mesmo instante das antigas 09h de São Paulo.
  await expect(reagendarOperacional({ ...args, horario: "08:00" })).rejects.toMatchObject({ statusCode: 400 });
  await expect(reagendarOperacional({ ...args, horario: "09:00" })).resolves.toHaveProperty("agendamento");
  const changed = (await db.query("SELECT inicio_previsto_em, valor_servico, duracao_minutos, servico_nome FROM agendamentos WHERE id=$1", [record.id])).rows[0];
  expect(new Date(changed.inicio_previsto_em).getTime() - new Date(record.inicio_previsto_em).getTime()).toBe(3600000);
  expect(changed).toMatchObject({ valor_servico: "75.00", duracao_minutos: 60, servico_nome: "Nome original" });
  expect((await db.query("SELECT id FROM agendamento_reagendamentos WHERE agendamento_id=$1", [record.id])).rows).toHaveLength(1);
});

test("TD-04: aceite que reativa vínculo legado registra a própria profissional como ator", async () => {
  await db.query("UPDATE usuarios_negocios SET ativo=FALSE WHERE usuario_id=$1 AND negocio_id=$2", [professional, studio.negocioId]);
  const invite = (await db.query(`INSERT INTO convites_profissionais(negocio_id, usuario_convidado_id, convidado_por_usuario_id, expira_em)
    VALUES($1,$2,$3,NOW()+INTERVAL '7 days') RETURNING id`, [studio.negocioId, professional, owner])).rows[0];
  const response = await request(app).post(`/profissionais/convites/${invite.id}/aceitar`).set("X-Test-Usuario", String(professional));
  expect(response.status).toBe(200);
  expect((await link()).ativo).toBe(true);
  expect(await events()).toEqual([expect.objectContaining({ nome: "business_professional_reactivated", actor_user_id: String(professional),
    propriedades: expect.objectContaining({ actor_type: "PROFESSIONAL", actor_id: professional }) })]);
});
