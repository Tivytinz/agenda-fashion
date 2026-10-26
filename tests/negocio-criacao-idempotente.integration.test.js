jest.setTimeout(30000);
jest.mock("../src/middlewares/auth", () => (req, _res, next) => {
  req.user = { id: Number(req.get("X-Test-Usuario")) }; next();
});
const express = require("express");
const request = require("supertest");
const db = require("../src/db/db");
const receipts = require("../src/repositories/negocioCriacaoTentativaRepository");
const { encerrarNegocio } = require("../src/services/encerramentoService");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const app = express(); app.use(express.json()); app.use(require("../src/routes/negocioRoutes"));
app.use(require("../src/middlewares/errorHandler"));
const KEY = "negocio-criacao-resposta-perdida-0001";
let a; let b;
beforeEach(async () => {
  a = await criarCenarioAgendamento(db, { prefixo: "business-receipt" });
  b = await criarCenarioAgendamento(db, { prefixo: "business-other" });
  await encerrarNegocio({ usuarioId: a.profissional.id, negocioId: a.negocioId });
});
afterEach(async () => {
  jest.restoreAllMocks();
  const owned = await db.query("SELECT negocio_id FROM usuarios_negocios WHERE usuario_id=$1 AND papel='dono'", [a.profissional.id]);
  for (const row of owned.rows) if (Number(row.negocio_id) !== Number(a.negocioId)) {
    await db.query("DELETE FROM negocios WHERE id=$1", [row.negocio_id]);
  }
  await removerCenarioAgendamento(db, a); await removerCenarioAgendamento(db, b);
});
afterAll(() => db.end());
function body(extra = {}) {
  return { nome: `Studio recuperável ${a.negocioId}`, areas: ["Unhas"], whatsapp: "11999999999", cidade: "São Paulo", estado: "SP",
    bairro: "Centro", endereco: "Rua local", numero: "20", cep: "01001000", localizacao_url: "https://maps.google.com/", ...extra };
}
async function send({ key = KEY, extra, usuarioId = a.profissional.id } = {}) {
  const req = request(app).post("/criar-negocio").set("X-Test-Usuario", String(usuarioId));
  if (key !== null) req.set("Idempotency-Key", key);
  const result = await req.send(body(extra));
  return result;
}
function read({ key = KEY, usuarioId = a.profissional.id } = {}) {
  return request(app).get("/criar-negocio/tentativa").set("X-Test-Usuario", String(usuarioId)).set("Idempotency-Key", key);
}
test("resposta perdida é recuperada por GET e replay sem criar outro negócio ou agenda", async () => {
  expect((await read()).body).toEqual({ estado: "nao_encontrada" });
  const first = await send(); const replay = await send(); const recovered = await read();
  expect([first.status, replay.status, recovered.status]).toEqual([201, 201, 200]);
  expect(replay.body.negocio.id).toBe(first.body.negocio.id);
  expect(recovered.body.negocio.id).toBe(first.body.negocio.id);
  expect(recovered.headers["cache-control"]).toContain("no-store");
  expect((await db.query("SELECT COUNT(*)::int AS n FROM negocio_criacao_tentativas WHERE usuario_id=$1", [a.profissional.id])).rows[0].n).toBe(1);
  expect((await db.query("SELECT COUNT(*)::int AS n FROM agenda_horarios WHERE negocio_id=$1", [first.body.negocio.id])).rows[0].n).toBe(7);
});
test("a mesma chave com outros dados é conflito e a consulta mantém o cadastro original", async () => {
  const first = await send(); const divergent = await send({ extra: { nome: "Outro nome" } });
  expect(divergent.status).toBe(409); expect(divergent.body.codigo).toBe("NEGOCIO_TENTATIVA_DIVERGENTE");
  expect((await read()).body.negocio.nome).toBe(first.body.negocio.nome);
});
test("replay recupera o estado atual sem desfazer edição nem ocultação posterior", async () => {
  const first = await send();
  await db.query("UPDATE negocios SET nome='Nome revisado', despublicado_manual_em=NOW(), publicado=FALSE WHERE id=$1", [first.body.negocio.id]);
  const replay = await send();
  expect(replay.status).toBe(201); expect(replay.body.negocio.nome).toBe("Nome revisado"); expect(replay.body.negocio.publicado).toBe(false);
});
test("a chave de outra conta não concede acesso ao negócio", async () => {
  await send();
  expect((await read({ usuarioId: b.profissional.id })).body).toEqual({ estado: "nao_encontrada" });
  expect((await send({ usuarioId: b.profissional.id })).status).toBe(409);
});
test("tentativa arquivada não cria outro negócio nem adota seu sucessor", async () => {
  const first = await send();
  await encerrarNegocio({ usuarioId: a.profissional.id, negocioId: first.body.negocio.id });
  const replacement = await send({ key: "negocio-sucessor-tentativa-0002", extra: { nome: "Negócio novo" } });
  expect(replacement.status).toBe(201);
  for (const result of [await read(), await send()]) {
    expect(result.status).toBe(410); expect(result.body.codigo).toBe("NEGOCIO_TENTATIVA_ENCERRADA");
  }
  expect((await db.query("SELECT ativo,nome FROM negocios WHERE id=$1", [replacement.body.negocio.id])).rows[0]).toEqual({ ativo: true, nome: "Negócio novo" });
});
test("recibo de negócio removido permanece terminal", async () => {
  const first = await send();
  await db.query("DELETE FROM negocios WHERE id=$1", [first.body.negocio.id]);
  expect((await read()).status).toBe(410); expect((await send()).status).toBe(410);
});
test("conta desativada não recupera nem repete criação", async () => {
  await send(); await db.query("UPDATE usuarios SET ativo=FALSE WHERE id=$1", [a.profissional.id]);
  expect((await read()).status).toBe(403); expect((await send()).status).toBe(403);
});
test.each(["curta", "chave com espaços"])("chave inválida %s falha antes da escrita", async key => {
  expect((await send({ key })).status).toBe(400);
  const result = await read({ key }); expect(result.status).toBe(400); expect(result.headers["cache-control"]).toContain("no-store");
});
test("falha no recibo desfaz negócio, vínculo e disponibilidade", async () => {
  jest.spyOn(receipts, "concluir").mockRejectedValueOnce(new Error("Falha antes de concluir recibo"));
  expect((await send()).status).toBe(500);
  expect((await read()).body.estado).toBe("nao_encontrada");
  expect((await db.query("SELECT COUNT(*)::int AS n FROM usuarios_negocios WHERE usuario_id=$1 AND ativo=TRUE AND papel='dono'", [a.profissional.id])).rows[0].n).toBe(0);
  expect((await send()).status).toBe(201);
});
test("confirmação perdida após commit é recuperável sem outro cadastro", async () => {
  const transaction = db.executarTransacao;
  jest.spyOn(db, "executarTransacao").mockImplementationOnce(async callback => {
    await transaction(callback); throw Object.assign(new Error("COMMIT confirmado, resposta perdida"), { code: "ECONNRESET" });
  });
  expect((await send()).status).toBe(500);
  const recovered = await read(); expect(recovered.status).toBe(200); expect(recovered.body.estado).toBe("concluida");
  expect((await send()).body.negocio.id).toBe(recovered.body.negocio.id);
});
test("envios simultâneos da mesma tentativa convergem para o mesmo negócio", async () => {
  const results = await Promise.all([send(), send()]);
  expect(results.map(r => r.status)).toEqual([201, 201]); expect(results[0].body.negocio.id).toBe(results[1].body.negocio.id);
});
test("cliente legado sem chave mantém o conflito de negócio existente", async () => {
  expect((await send({ key: null })).status).toBe(201); expect((await send({ key: null })).status).toBe(409);
});
