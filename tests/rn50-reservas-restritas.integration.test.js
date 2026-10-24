jest.setTimeout(60000);
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const db = require("../src/db/db");
const sessaoService = require("../src/services/sessaoService");
const routes = require("../src/routes/agendaRoutes");
const errorHandler = require("../src/middlewares/errorHandler");

const app = express();
app.use(express.json(), routes, errorHandler);
let negocioId, servicoId, profissional, outra, cliente, dona;
const usuarios = [];
const bookings = {};
const chave = `rn50-${process.pid}-${Date.now()}`;
const bearer = (id = profissional) => ({ Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}` });
const patch = (id, status, usuario = profissional) => request(app).patch(`/agendamentos/${id}/atendimento`).set(bearer(usuario)).send({ status });
const listar = () => request(app).get("/reservas-profissionais-existentes").set(bearer());

async function inativar(motivo = null) {
  await db.query("UPDATE usuarios_negocios SET ativo = FALSE, motivo_inatividade = $2 WHERE usuario_id = $1 AND negocio_id = $3", [profissional, motivo, negocioId]);
}

beforeAll(async () => {
  for (const nome of ["Dona", "Profissional", "Outra", "Cliente"]) {
    const result = await db.query("INSERT INTO usuarios (nome, email, senha, whatsapp) VALUES ($1, $2, 'hash-teste', $3) RETURNING id", [nome, `${nome}-${chave}@teste.local`.toLowerCase(), `629${String(Date.now() + usuarios.length).slice(-8)}`]);
    usuarios.push(result.rows[0].id);
  }
  [dona, profissional, outra, cliente] = usuarios;
  const result = await db.query("INSERT INTO negocios (nome, slug, plano_id, fuso_horario) VALUES ('Studio RN50', $1, (SELECT id FROM planos WHERE slug = 'inicial' LIMIT 1), 'UTC') RETURNING id", [chave]);
  negocioId = result.rows[0].id;
  await db.query("INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel) VALUES ($1, $4, 'dono'), ($2, $4, 'profissional'), ($3, $4, 'profissional')", [dona, profissional, outra, negocioId]);
  const servico = await db.query("INSERT INTO servicos_negocio (negocio_id, nome, valor, duracao_minutos, ativo) VALUES ($1, 'Manicure RN50', 70, 60, TRUE) RETURNING id", [negocioId]);
  servicoId = servico.rows[0].id;
  for (const [nome, pessoa, dias, hora] of [
    ["realizado", profissional, -2, "10:00"], ["falta", profissional, -2, "12:00"],
    ["futuro", profissional, 2, "10:00"], ["outra", outra, -2, "14:00"],
  ]) {
    const r = await db.query(`INSERT INTO agendamentos (negocio_id, servico_id, profissional_id, cliente_id, data, horario, status, valor_servico, duracao_minutos)
      VALUES ($1, $2, $3, $4, CURRENT_DATE + $5::int, $6::time, 'confirmado', 70, 60) RETURNING id`, [negocioId, servicoId, pessoa, cliente, dias, hora]);
    bookings[nome] = r.rows[0].id;
  }
  await inativar();
});

afterAll(async () => {
  try {
    if (negocioId) {
      await db.query("DELETE FROM analytics_eventos WHERE target_business_id = $1", [negocioId]);
      await db.query("DELETE FROM agendamentos WHERE negocio_id = $1", [negocioId]);
      await db.query("DELETE FROM servicos_negocio WHERE negocio_id = $1", [negocioId]);
      await db.query("DELETE FROM usuarios_negocios WHERE negocio_id = $1", [negocioId]);
      await db.query("DELETE FROM negocios WHERE id = $1", [negocioId]);
    }
    if (usuarios.length) await db.query("DELETE FROM usuarios WHERE id = ANY($1::bigint[])", [usuarios]);
  } finally { await db.end(); }
});

test.each([null, "excedente_limite_plano", "aguardando_vaga_plano", "inativado_pela_dona"])("consulta própria com motivo %s sem conceder workspace", async (motivo) => {
  await inativar(motivo);
  const result = await listar();
  expect(result.status).toBe(200);
  expect(result.body.agendamentos.map((a) => a.id).sort()).toEqual([bookings.realizado, bookings.falta, bookings.futuro].sort());
  const sessao = await sessaoService.obterMinhaSessao(profissional);
  expect(sessao.temNegocio).toBe(false);
  expect(sessao.temReservasProfissionaisRestritas).toBe(true);
  expect(sessao.vinculos).toEqual([]);
  expect((await request(app).get("/agenda-profissional").set(bearer())).status).toBe(403);
  expect((await request(app).post("/bloqueios-horario").set(bearer()).send({ data: "2030-01-01", hora: "10:00" })).status).toBe(403);
});

test("consulta e mutações recusam reserva de outra profissional e ações além da RN50", async () => {
  expect((await patch(bookings.outra, "falta")).status).toBe(404);
  expect((await patch(bookings.futuro, "realizado")).status).toBe(409);
  expect((await patch(bookings.futuro, "falta")).status).toBe(409);
  expect((await patch(bookings.futuro, "iniciado")).status).toBe(404);
  for (const action of ["cancelar-operacional", "reagendar-operacional"]) {
    expect((await request(app).patch(`/agendamentos/${bookings.futuro}/${action}`).set(bearer()).send({ motivo: "outro" })).status).toBe(404);
  }
});

test.each(["realizado", "falta"])("registra %s uma única vez, preservando auditoria e evento", async (status) => {
  const id = bookings[status];
  expect((await patch(id, status)).status).toBe(200);
  expect((await patch(id, status)).status).toBe(200);
  const result = await db.query("SELECT status, status_atendimento_por FROM agendamentos WHERE id = $1", [id]);
  expect(result.rows[0]).toMatchObject({ status, status_atendimento_por: profissional });
  const evento = await db.query("SELECT COUNT(*)::int AS total FROM analytics_eventos WHERE agendamento_id = $1 AND nome = $2 AND origem = 'backend'", [id, status === "realizado" ? "booking_completed" : "booking_no_show"]);
  expect(evento.rows[0].total).toBe(1);
  expect((await patch(id, status === "falta" ? "realizado" : "falta")).status).toBe(409);
});

test("conta desativada e negócio arquivado revogam consulta e escrita", async () => {
  for (const [table, id, changes, restore] of [
    ["usuarios", profissional, "ativo = FALSE", "ativo = TRUE"],
    ["negocios", negocioId, "ativo = FALSE, arquivado_em = NOW()", "ativo = TRUE, arquivado_em = NULL"],
  ]) {
    try {
      await db.query(`UPDATE ${table} SET ${changes} WHERE id = $1`, [id]);
      expect((await listar()).body.agendamentos).toEqual([]);
      expect((await patch(bookings.futuro, "realizado")).status).toBe(404);
    } finally { await db.query(`UPDATE ${table} SET ${restore} WHERE id = $1`, [id]); }
  }
});

test("vínculo removido ou recriado não recupera reservas do vínculo anterior", async () => {
  const link = await db.query("SELECT created_at FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2", [profissional, negocioId]);
  try {
    // Mesmo par pessoa/negócio recriado depois dos bookings não recupera acesso.
    await db.query("UPDATE usuarios_negocios SET created_at = NOW() + INTERVAL '1 minute' WHERE usuario_id = $1 AND negocio_id = $2", [profissional, negocioId]);
    expect((await listar()).body.agendamentos).toEqual([]);
    expect((await patch(bookings.futuro, "realizado")).status).toBe(404);
    await db.query("DELETE FROM usuarios_negocios WHERE usuario_id = $1 AND negocio_id = $2", [profissional, negocioId]);
    expect((await listar()).body.agendamentos).toEqual([]);
    expect((await patch(bookings.futuro, "realizado")).status).toBe(404);
  } finally {
    await db.query("INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel, ativo, created_at) VALUES ($1, $2, 'profissional', FALSE, $3) ON CONFLICT (usuario_id, negocio_id) DO UPDATE SET created_at = EXCLUDED.created_at", [profissional, negocioId, link.rows[0].created_at]);
  }
});

test("reativação devolve a agenda normal e retira o acesso restrito", async () => {
  await db.query("UPDATE usuarios_negocios SET ativo = TRUE, motivo_inatividade = NULL WHERE usuario_id = $1 AND negocio_id = $2", [profissional, negocioId]);
  expect((await listar()).body.agendamentos).toEqual([]);
  expect((await sessaoService.obterMinhaSessao(profissional)).temReservasProfissionaisRestritas).toBe(false);
  expect((await request(app).get("/agenda-profissional").set(bearer())).status).toBe(200);
});

test("outro contexto ativo não substitui nem amplia o acesso às reservas antigas", async () => {
  await inativar("excedente_limite_plano");
  let outroNegocio;
  try {
    const r = await db.query("INSERT INTO negocios (nome, slug, plano_id) VALUES ('Outro contexto', $1, (SELECT id FROM planos WHERE slug = 'inicial' LIMIT 1)) RETURNING id", [`outro-${chave}`]);
    outroNegocio = r.rows[0].id;
    await db.query("INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel) VALUES ($1, $2, 'dono')", [profissional, outroNegocio]);
    const sessao = await sessaoService.obterMinhaSessao(profissional);
    expect(sessao.negocio.id).toBe(outroNegocio);
    expect(sessao.temReservasProfissionaisRestritas).toBe(true);
    const result = await request(app).get(`/reservas-profissionais-existentes?negocioId=${outroNegocio}&usuarioId=${outra}`).set(bearer());
    expect(result.status).toBe(200);
    expect(result.body.agendamentos.length).toBe(3);
    expect(result.body.agendamentos.every((a) => a.negocio_id === negocioId)).toBe(true);
    expect((await patch(bookings.outra, "realizado")).status).toBe(404);
  } finally {
    if (outroNegocio) {
      await db.query("DELETE FROM usuarios_negocios WHERE negocio_id = $1", [outroNegocio]);
      await db.query("DELETE FROM negocios WHERE id = $1", [outroNegocio]);
    }
  }
});
