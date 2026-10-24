jest.setTimeout(30000);
jest.mock("../src/middlewares/auth", () => (req, _res, next) => {
  req.user = { id: Number(req.get("X-Test-Usuario")) };
  next();
});

const express = require("express");
const request = require("supertest");
const db = require("../src/db/db");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const app = express();
app.use(express.json());
app.use(require("../src/routes/agendaRoutes"));
app.use(require("../src/routes/profissionaisRoutes"));
app.use((error, _req, res, _next) => res.status(error.statusCode || error.status || 500).json({ erro: error.message }));

let studio;
let other;
let owner;
let professional;

beforeEach(async () => {
  studio = await criarCenarioAgendamento(db, { prefixo: "owner-recovery" });
  other = await criarCenarioAgendamento(db, { prefixo: "owner-recovery-other" });
  owner = Number(studio.profissional.id);
  professional = Number(other.profissional.id);
  await db.query("INSERT INTO usuarios_negocios(usuario_id, negocio_id, papel, ativo) VALUES($1, $2, 'profissional', TRUE)", [professional, studio.negocioId]);
});

afterEach(async () => {
  // Apaga primeiro os compromissos de A, antes da identidade que também é dona de B.
  if (studio) {
    await db.query("DELETE FROM agendamento_reagendamentos WHERE agendamento_id IN (SELECT id FROM agendamentos WHERE negocio_id = $1)", [studio.negocioId]);
    await removerCenarioAgendamento(db, studio);
  }
  if (other) await removerCenarioAgendamento(db, other);
  studio = other = null;
});
afterAll(async () => { await db.end(); });

async function booking(scenario, professionalId, days, status = "confirmado", hora = "10:00") {
  const result = await db.query(`
    INSERT INTO agendamentos (
      negocio_id, profissional_id, servico_id, cliente_nome, cliente_whatsapp,
      data, horario, status, valor_servico, duracao_minutos, servico_nome
    ) VALUES ($1, $2, $3, 'Cliente recuperação', '62999990002',
      (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date + $4::int,
      $6, $5, 50, 60, 'Serviço recuperação')
    RETURNING id, TO_CHAR(data, 'YYYY-MM-DD') AS data
  `, [scenario.negocioId, professionalId, scenario.servico.id, days, status, hora]);
  return result.rows[0];
}

function slots(response) {
  return response.body.agenda.flatMap((day) => day.profissionais.flatMap((person) => person.horarios));
}

test("a dona encontra reservas de ontem e distantes em janelas de sete dias, sem expor reservas de outro negócio", async () => {
  const past = await booking(studio, professional, -1);
  const distant = await booking(studio, professional, 12);
  const external = await booking(other, professional, -1, "confirmado", "09:00");
  for (const item of [past, distant]) {
    const response = await request(app).get("/agenda-geral").query({ data_inicio: item.data }).set("X-Test-Usuario", String(owner));
    expect(response.status).toBe(200);
    expect(response.body.agenda).toHaveLength(7);
    expect(response.body.agenda[0].data).toBe(item.data);
    expect(slots(response)).toEqual(expect.arrayContaining([expect.objectContaining({ agendamento_id: item.id })]));
    expect(slots(response).some((slot) => String(slot.agendamento_id) === String(external.id))).toBe(false);
  }
  const invalid = await request(app).get("/agenda-geral?data_inicio=2026-02-30").set("X-Test-Usuario", String(owner));
  expect(invalid.status).toBe(400);
  // Após perder o vínculo de dona, o seletor de data continua sem conceder acesso.
  await db.query("UPDATE usuarios_negocios SET ativo = FALSE WHERE negocio_id = $1 AND usuario_id = $2", [other.negocioId, professional]);
  const forbidden = await request(app).get("/agenda-geral").query({ data_inicio: past.data }).set("X-Test-Usuario", String(professional));
  expect(forbidden.status).toBe(403);
});

test("pedidos explícitos repetidos mantêm o bloqueio e a liberação; clientes sem o campo mantêm compatibilidade", async () => {
  const { data } = (await db.query("SELECT TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date + 1, 'YYYY-MM-DD') AS data")).rows[0];
  const args = { data, hora: "16:00", profissional_id: professional };
  for (const bloqueado of [true, true, false, false]) {
    const response = await request(app).post("/bloqueios-horario").set("X-Test-Usuario", String(owner)).set("X-AF-Contexto", "dono").send({ ...args, bloqueado });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe(bloqueado ? "bloqueado" : "livre");
    const persisted = await db.query("SELECT id FROM bloqueios_horarios WHERE negocio_id = $1 AND profissional_id = $2 AND data_bloqueio = $3 AND hora_bloqueio = $4", [studio.negocioId, professional, data, "16:00"]);
    expect(persisted.rows).toHaveLength(bloqueado ? 1 : 0);
  }
  for (const expected of ["bloqueado", "livre"]) {
    const response = await request(app).post("/bloqueios-horario").set("X-Test-Usuario", String(owner)).set("X-AF-Contexto", "dono").send(args);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe(expected);
  }
});

test.each([true, false])("RN45: reserva antiga confirmada impede remover profissional com vínculo ativo=%s", async (active) => {
  const past = await booking(studio, professional, -1);
  await db.query("UPDATE usuarios_negocios SET ativo = $3 WHERE negocio_id = $1 AND usuario_id = $2", [studio.negocioId, professional, active]);
  if (!active) {
    await booking(other, professional, -1, "confirmado", "08:00");
    await db.query("INSERT INTO bloqueios_horarios(profissional_id, negocio_id, data_bloqueio, hora_bloqueio) VALUES($1, $2, $3, '15:00')", [professional, studio.negocioId, past.data]);
    const today = await request(app).get("/agenda-geral").set("X-Test-Usuario", String(owner));
    expect(today.body.agenda.flatMap((day) => day.profissionais).some((item) => Number(item.id) === professional)).toBe(false);
  }
  const agenda = await request(app).get("/agenda-geral").query({ data_inicio: past.data }).set("X-Test-Usuario", String(owner));
  expect(agenda.status).toBe(200);
  const person = agenda.body.agenda[0].profissionais.find((item) => Number(item.id) === professional);
  expect(person).toBeDefined();
  expect(person.horarios).toEqual(expect.arrayContaining([expect.objectContaining({ agendamento_id: past.id, pode_cancelar: true, pode_reagendar: true })]));
  if (!active) expect(person.horarios.every((slot) => slot.agendamento_id)).toBe(true);
  const response = await request(app).delete(`/profissionais/${professional}`).set("X-Test-Usuario", String(owner));
  expect(response.status).toBe(409);
  expect(response.body.erro).toContain("1 agendamento pendente");
  const link = await db.query("SELECT ativo FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2", [professional, studio.negocioId]);
  expect(link.rows).toEqual([{ ativo: active }]);
  expect((await db.query("SELECT status FROM agendamentos WHERE id = $1", [past.id])).rows[0].status).toBe("confirmado");
});

test.each(["cancelado", "realizado", "falta"])("RN45: desfecho %s libera a remoção preservando o histórico e outro negócio", async (status) => {
  const past = await booking(studio, professional, -1);
  await booking(other, professional, 2);
  await db.query("UPDATE agendamentos SET status = $2 WHERE id = $1", [past.id, status]);
  const response = await request(app).delete(`/profissionais/${professional}`).set("X-Test-Usuario", String(owner));
  expect(response.status).toBe(200);
  const persisted = await db.query("SELECT status FROM agendamentos WHERE id = $1", [past.id]);
  expect(persisted.rows[0].status).toBe(status);
  const ownBusiness = await db.query("SELECT id FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2 AND papel = 'dono'", [professional, other.negocioId]);
  expect(ownBusiness.rows).toHaveLength(1);
});

test("RD-01: serviço desativado continua reagendável pela dona com os snapshots originais", async () => {
  const item = await booking(studio, owner, 2, "confirmado", "09:30");
  await db.query("UPDATE agendamentos SET duracao_minutos = 90, valor_servico = 75, servico_nome = 'Serviço original' WHERE id = $1", [item.id]);
  await db.query("UPDATE servicos_negocio SET ativo = FALSE, valor = 200, duracao_minutos = 30 WHERE id = $1", [studio.servico.id]);
  const response = await request(app).get("/agenda-geral").query({ data_inicio: item.data }).set("X-Test-Usuario", String(owner));
  const person = response.body.agenda[0].profissionais.find((p) => Number(p.id) === owner);
  expect(person.servico_ids).toEqual([]);
  expect(person.horarios.find((s) => String(s.agendamento_id) === String(item.id))).toMatchObject({ pode_reagendar: true, duracao_minutos: 90 });
  const next = (await db.query("SELECT TO_CHAR($1::date + 1, 'YYYY-MM-DD') AS data", [item.data])).rows[0].data;
  const result = await require("../src/services/agendamentoReagendamentoService").reagendarOperacional({
    usuarioId: owner, negocioId: studio.negocioId, agendamentoId: item.id,
    data: next, horario: "11:00", profissionalId: owner,
  });
  expect(result.mensagem).toContain("reagendado");
  expect((await db.query("SELECT servico_nome, valor_servico, duracao_minutos, TO_CHAR(data, 'YYYY-MM-DD') AS data FROM agendamentos WHERE id = $1", [item.id])).rows[0])
    .toMatchObject({ servico_nome: "Serviço original", valor_servico: "75.00", duracao_minutos: 90, data: next });
});

test("RD-02: a agenda usa a duração congelada para ocupar a grade e mantém o fim livre", async () => {
  const item = await booking(studio, owner, 2, "confirmado", "09:30");
  await db.query("UPDATE agendamentos SET duracao_minutos = 90 WHERE id = $1", [item.id]);
  await db.query("UPDATE servicos_negocio SET duracao_minutos = 30 WHERE id = $1", [studio.servico.id]);
  const response = await request(app).get("/agenda-geral").query({ data_inicio: item.data }).set("X-Test-Usuario", String(owner));
  const grid = response.body.agenda[0].profissionais.find((p) => Number(p.id) === owner).horarios;
  expect(grid.find((s) => s.hora === "10:00")).toEqual({ hora: "10:00", status: "ocupado" });
  expect(grid.find((s) => s.hora === "11:00").status).toBe("livre");
  expect(grid.filter((s) => s.agendamento_id)).toHaveLength(1);
  const blocked = await request(app).post("/bloqueios-horario").set("X-Test-Usuario", String(owner)).set("X-AF-Contexto", "dono")
    .send({ data: item.data, hora: "10:00", profissional_id: owner, bloqueado: true });
  expect(blocked.status).toBe(400);
});

test("RD-02: ocupação externa atravessa a janela e respeita o fuso da agenda sem expor a reserva", async () => {
  // 23:30 em Manaus corresponde a 00:30 do dia seguinte em São Paulo.
  await db.query("UPDATE negocios SET fuso_horario = 'America/Manaus' WHERE id = $1", [other.negocioId]);
  const item = await booking(other, professional, 2, "confirmado", "23:30");
  await db.query("UPDATE agendamentos SET duracao_minutos = 120 WHERE id = $1", [item.id]);
  await db.query(`INSERT INTO agenda_configuracoes(profissional_id, negocio_id, duracao_padrao, intervalo_minutos, antecedencia_agendamento)
    VALUES ($1, $2, 60, 0, 0) ON CONFLICT (profissional_id, negocio_id) DO NOTHING`, [professional, studio.negocioId]);
  await db.query(`INSERT INTO agenda_horarios(profissional_id, negocio_id, dia_semana, trabalha, hora_inicio, hora_fim)
    SELECT $1, $2, dia, TRUE, '00:00'::time, '20:00'::time FROM generate_series(0,6) dia
    ON CONFLICT (profissional_id, negocio_id, dia_semana) DO UPDATE SET trabalha = TRUE, hora_inicio = '00:00', hora_fim = '20:00'`, [professional, studio.negocioId]);
  const next = (await db.query("SELECT TO_CHAR($1::date + 1, 'YYYY-MM-DD') AS data", [item.data])).rows[0].data;
  // Início na data consultada, fim no fuso de destino; ambas as consultas devem usar o mesmo intervalo.
  for (const repoResult of [
    await require("../src/repositories/agendamentoLifecycleRepository").listarAgendamentosProfissionaisDoNegocioPorPeriodo({ negocioId: studio.negocioId, profissionalIds: [professional], dataInicio: next, dataFim: next }),
    await require("../src/repositories/agendaContextoRepository").listarAgendamentosProfissionalPorPeriodo({ negocioId: studio.negocioId, profissionalId: professional, dataInicio: next, dataFim: next }),
  ]) {
    expect(repoResult).toEqual([expect.objectContaining({ data: next, hora: "00:30", ocupacao_fim_local: `${next}T02:30:00`, agendamento_id: null, cliente: null, servico: null })]);
  }
  const response = await request(app).get("/agenda-geral").query({ data_inicio: next }).set("X-Test-Usuario", String(owner));
  const grid = response.body.agenda[0].profissionais.find((p) => Number(p.id) === professional).horarios;
  expect(grid.find((s) => s.hora === "01:00")).toEqual({ hora: "01:00", status: "ocupado" });
  expect(grid.find((s) => s.hora === "02:00")).toEqual({ hora: "02:00", status: "ocupado" });
  expect(grid.find((s) => s.hora === "03:00").status).toBe("livre");
  expect(JSON.stringify(grid)).not.toContain("Cliente recuperação");
  expect(grid.some((s) => s.agendamento_id || s.servico_id)).toBe(false);

  // Agora o início fica no dia anterior à janela, mas a ocupação continua nela.
  await db.query("UPDATE negocios SET fuso_horario = 'America/Sao_Paulo' WHERE id = $1", [other.negocioId]);
  await db.query("DELETE FROM agendamentos WHERE id = $1", [item.id]);
  const previousDay = await booking(other, professional, 2, "confirmado", "23:30");
  await db.query("UPDATE agendamentos SET duracao_minutos = 120 WHERE id = $1", [previousDay.id]);
  const crossing = await request(app).get("/agenda-geral").query({ data_inicio: next }).set("X-Test-Usuario", String(owner));
  const afterMidnight = crossing.body.agenda[0].profissionais.find((p) => Number(p.id) === professional).horarios;
  expect(afterMidnight.find((s) => s.hora === "00:00").status).toBe("ocupado");
  expect(afterMidnight.find((s) => s.hora === "01:00").status).toBe("ocupado");
  expect(afterMidnight.find((s) => s.hora === "02:00").status).toBe("livre");
});

test("RD-04/RN50: inativar preserva o vínculo, serviços e reservas, libera capacidade e mantém apenas acesso restrito", async () => {
  const item = await booking(studio, professional, -2);
  await db.query("INSERT INTO profissional_servicos(negocio_id, profissional_id, servico_id, habilitado_por_usuario_id) VALUES ($1,$2,$3,$4)", [studio.negocioId, professional, studio.servico.id, owner]);
  const before = (await db.query("SELECT id, created_at, ativado_em FROM usuarios_negocios WHERE negocio_id = $1 AND usuario_id = $2", [studio.negocioId, professional])).rows[0];
  for (let i = 0; i < 2; i++) {
    const result = await request(app).post(`/profissionais/${professional}/inativar`).set("X-Test-Usuario", String(owner));
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ profissional_id: professional, ativo: false, motivo_inatividade: "inativado_pela_dona" });
  }
  const persisted = (await db.query("SELECT id, created_at, ativado_em, ativo, motivo_inatividade FROM usuarios_negocios WHERE negocio_id = $1 AND usuario_id = $2", [studio.negocioId, professional])).rows[0];
  expect(persisted).toMatchObject({ ...before, ativo: false, motivo_inatividade: "inativado_pela_dona" });
  expect((await db.query("SELECT status FROM agendamentos WHERE id = $1", [item.id])).rows[0].status).toBe("confirmado");
  expect((await db.query("SELECT servico_id FROM profissional_servicos WHERE negocio_id = $1 AND profissional_id = $2", [studio.negocioId, professional])).rows).toHaveLength(1);
  expect((await require("../src/repositories/profissionaisRepository").contarProfissionaisAtivos(studio.negocioId))).toBe(1);
  expect((await request(app).get("/profissionais").set("X-Test-Usuario", String(owner))).body.profissionais)
    .toEqual(expect.arrayContaining([expect.objectContaining({ id: String(professional), ativo: false, motivo_inatividade: "inativado_pela_dona" })]));
  await expect(booking(studio, professional, 3)).rejects.toThrow();
  const restricted = await request(app).get("/reservas-profissionais-existentes").set("X-Test-Usuario", String(professional));
  expect(restricted.status).toBe(200);
  expect(restricted.body.agendamentos.map((a) => String(a.id))).toContain(String(item.id));
  const denied = await request(app).patch(`/agendamentos/${item.id}/cancelar-operacional`).set("X-Test-Usuario", String(professional)).send({ motivo: "outro" });
  expect(denied.status).toBe(404);
  const agenda = await request(app).get("/agenda-geral").query({ data_inicio: item.data }).set("X-Test-Usuario", String(owner));
  expect(slots(agenda).find((s) => String(s.agendamento_id) === String(item.id))).toMatchObject({ pode_cancelar: true, pode_reagendar: true });
});

test("RD-04: não permite auto-inativação, atuação em outro negócio nem profissional sem vínculo de dona", async () => {
  expect((await request(app).post(`/profissionais/${owner}/inativar`).set("X-Test-Usuario", String(owner))).status).toBe(403);
  expect((await request(app).post(`/profissionais/${owner}/inativar`).set("X-Test-Usuario", String(professional))).status).toBe(404);
  await db.query("UPDATE usuarios_negocios SET ativo = FALSE WHERE usuario_id = $1 AND negocio_id = $2", [professional, other.negocioId]);
  expect((await request(app).post(`/profissionais/${owner}/inativar`).set("X-Test-Usuario", String(professional))).status).toBe(403);
  expect((await request(app).post("/profissionais/invalido/inativar").set("X-Test-Usuario", String(owner))).status).toBe(400);
  expect((await db.query("SELECT ativo FROM usuarios_negocios WHERE negocio_id = $1 AND usuario_id = $2", [studio.negocioId, professional])).rows[0].ativo).toBe(true);
});

test("RD-04: convite pendente antigo não contorna a inativação manual", async () => {
  await request(app).post(`/profissionais/${professional}/inativar`).set("X-Test-Usuario", String(owner));
  const invite = (await db.query(`INSERT INTO convites_profissionais(negocio_id, usuario_convidado_id, convidado_por_usuario_id, expira_em)
    VALUES ($1,$2,$3,NOW() + INTERVAL '7 days') RETURNING id`, [studio.negocioId, professional, owner])).rows[0];
  const accepted = await request(app).post(`/profissionais/convites/${invite.id}/aceitar`).set("X-Test-Usuario", String(professional));
  expect(accepted.status).toBe(409);
  expect(accepted.body.erro).toContain("reativação deve ser feita por ela");
  expect((await db.query("SELECT ativo, motivo_inatividade FROM usuarios_negocios WHERE negocio_id = $1 AND usuario_id = $2", [studio.negocioId, professional])).rows[0])
    .toMatchObject({ ativo: false, motivo_inatividade: "inativado_pela_dona" });
  expect((await db.query("SELECT status FROM convites_profissionais WHERE id = $1", [invite.id])).rows[0].status).toBe("pendente");
});

test("RD-04: reativação manual respeita capacidade e vínculo ativo em outro negócio", async () => {
  await request(app).post(`/profissionais/${professional}/inativar`).set("X-Test-Usuario", String(owner));
  const activate = () => request(app).post(`/profissionais/${professional}/ativar`).set("X-Test-Usuario", String(owner));
  const full = await activate();
  expect(full.status).toBe(409);
  expect(full.body.erro).toContain("limite");
  const plan = (await db.query(`INSERT INTO planos(nome, slug, valor, capacidade_agendamentos, limite_profissionais, limite_servicos, ativo)
    VALUES ('Teste inativação', $1, 0, 100, 3, 10, TRUE) RETURNING id`, [`inativacao-${process.pid}-${Date.now()}`])).rows[0];
  try {
    await db.query("UPDATE negocios SET plano_id = $1 WHERE id = $2", [plan.id, studio.negocioId]);
    await db.query("UPDATE usuarios_negocios SET papel = 'profissional' WHERE usuario_id = $1 AND negocio_id = $2", [professional, other.negocioId]);
    expect((await activate()).status).toBe(409);
    await db.query("UPDATE usuarios_negocios SET papel = 'dono' WHERE usuario_id = $1 AND negocio_id = $2", [professional, other.negocioId]);
    const result = await activate();
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ profissional_id: professional, ativo: true });
    expect((await db.query("SELECT ativo, motivo_inatividade FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2", [professional, studio.negocioId])).rows[0])
      .toEqual({ ativo: true, motivo_inatividade: null });
  } finally {
    await db.query("UPDATE negocios SET plano_id = (SELECT id FROM planos WHERE slug = 'inicial') WHERE id = $1", [studio.negocioId]);
    await db.query("DELETE FROM planos WHERE id = $1", [plan.id]);
  }
});
