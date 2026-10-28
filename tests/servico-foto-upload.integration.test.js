jest.setTimeout(30000);
jest.mock("../src/middlewares/auth", () => (req, _res, next) => {
  req.user = { id: Number(req.get("X-Test-Usuario")) }; next();
});
jest.mock("../src/utils/uploadCloudinary", () => {
  const upload = jest.fn(); upload.remover = jest.fn().mockResolvedValue(); return upload;
});
const express = require("express");
const request = require("supertest");
const db = require("../src/db/db");
const upload = require("../src/utils/uploadCloudinary");
const attempts = require("../src/repositories/servicoFotoUploadRepository");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const app = express(); app.use(express.json()); app.use("/servicos", require("../src/routes/servicosRoutes"));
app.use(require("../src/middlewares/errorHandler"));
const IMAGE = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const KEY = "foto-idempotente-tentativa-0001";
let a; let b; let serial;
beforeEach(async () => {
  jest.clearAllMocks(); serial = 0;
  upload.mockImplementation(async () => ({ secure_url: `https://images.example.test/${++serial}.jpg`, public_id: `foto-${serial}` }));
  a = await criarCenarioAgendamento(db, { prefixo: "photo-retry" });
  b = await criarCenarioAgendamento(db, { prefixo: "photo-other" });
});
afterEach(async () => { jest.restoreAllMocks(); await removerCenarioAgendamento(db, a); await removerCenarioAgendamento(db, b); });
afterAll(() => db.end());
function send({ key = KEY, image = IMAGE, usuarioId = a.profissional.id, id = a.servico.id } = {}) {
  return request(app).post(`/servicos/${id}/fotos`).set("X-Test-Usuario", String(usuarioId))
    .set("Idempotency-Key", key).attach("foto", image, { filename: "foto.jpg", contentType: "image/jpeg" });
}
function recover({ usuarioId = a.profissional.id, id = a.servico.id, key = KEY } = {}) {
  return request(app).get(`/servicos/${id}/fotos/tentativa`).set("X-Test-Usuario", String(usuarioId)).set("Idempotency-Key", key);
}
async function count(table) {
  const sql = table === "photos" ? "SELECT COUNT(*)::int AS total FROM fotos_servico WHERE servico_id=$1"
    : "SELECT COUNT(*)::int AS total FROM servico_foto_upload_tentativas WHERE servico_id=$1";
  return (await db.query(sql, [a.servico.id])).rows[0].total;
}
test("resposta perdida recupera uma única foto sem outro upload", async () => {
  expect((await recover()).body).toEqual({ estado: "nao_encontrada" });
  const first = await send(); const replay = await send(); const read = await recover();
  expect([first.status, replay.status, read.status]).toEqual([201, 201, 200]);
  expect(replay.body.foto.id).toBe(first.body.foto.id);
  expect(read.body.foto.id).toBe(first.body.foto.id);
  expect(read.headers["cache-control"]).toContain("no-store");
  expect(upload).toHaveBeenCalledTimes(1);
  expect(await count("photos")).toBe(1); expect(await count("attempts")).toBe(1);
});
test("envios concorrentes confirmam uma única foto e limpam o asset excedente", async () => {
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  let started = 0;
  upload.mockImplementation(async () => {
    const id = ++started; if (id === 2) release(); await barrier;
    return { secure_url: `https://images.example.test/${id}.jpg`, public_id: `foto-${id}` };
  });
  const results = await Promise.all([send(), send()]);
  expect(results.map(r => r.status)).toEqual([201, 201]);
  expect(results[0].body.foto.id).toBe(results[1].body.foto.id);
  expect(await count("photos")).toBe(1); expect(await count("attempts")).toBe(1);
  expect(upload.remover).toHaveBeenCalledTimes(1);
  expect(upload.remover).not.toHaveBeenCalledWith(results[0].body.foto.foto_public_id);
});
test("reutilizar chave com outro arquivo não altera nem envia outra imagem", async () => {
  await send();
  const otherFile = await send({ image: Buffer.from([0xff, 0xd8, 0xff, 0x01]) });
  expect(otherFile.status).toBe(409);
  expect(otherFile.body.codigo).toBe("FOTO_TENTATIVA_DIVERGENTE");
  expect(upload).toHaveBeenCalledTimes(1); expect(await count("photos")).toBe(1);
});
test("foto removida conserva recibo sem ser recriada", async () => {
  const first = await send();
  const removed = await request(app).delete(`/servicos/fotos/${first.body.foto.id}`).set("X-Test-Usuario", String(a.profissional.id));
  expect(removed.status).toBe(200);
  expect((await recover()).status).toBe(410); expect((await send()).status).toBe(410);
  expect(await count("photos")).toBe(0); expect(await count("attempts")).toBe(1);
  expect(upload).toHaveBeenCalledTimes(1);
});
test("referência de outro negócio não dá acesso ao envio nem à consulta", async () => {
  await send();
  expect((await recover({ usuarioId: b.profissional.id })).status).toBe(404);
  expect((await send({ usuarioId: b.profissional.id })).status).toBe(404);
  expect(upload).toHaveBeenCalledTimes(1);
});
test("falha transacional desfaz foto e recibo antes de nova tentativa", async () => {
  jest.spyOn(attempts, "concluir").mockRejectedValueOnce(new Error("Falha antes do commit"));
  expect((await send()).status).toBe(500);
  expect(await count("photos")).toBe(0); expect(await count("attempts")).toBe(0);
  expect(upload.remover).toHaveBeenCalledWith("foto-1");
  expect((await send()).status).toBe(201); expect(await count("photos")).toBe(1);
});
test("incerteza depois do commit não remove a imagem já confirmada", async () => {
  const original = db.executarTransacao;
  let calls = 0;
  jest.spyOn(db, "executarTransacao").mockImplementation(async cb => {
    const value = await original(cb);
    if (++calls === 2) throw new Error("Confirmação do commit perdida");
    return value;
  });
  const response = await send();
  expect(response.status).toBe(201);
  expect(await count("photos")).toBe(1); expect(await count("attempts")).toBe(1);
  expect(upload.remover).not.toHaveBeenCalled();
});
test("commit incerto com consulta indisponível preserva a foto para recuperação posterior", async () => {
  const original = db.executarTransacao;
  let calls = 0;
  jest.spyOn(db, "executarTransacao").mockImplementation(async cb => {
    const call = ++calls;
    if (call === 3) throw new Error("Consulta temporariamente indisponível");
    const value = await original(cb);
    if (call === 2) throw new Error("Confirmação do commit perdida");
    return value;
  });
  expect((await send()).status).toBe(500);
  expect(await count("photos")).toBe(1);
  expect(upload.remover).not.toHaveBeenCalled();
  expect((await send()).status).toBe(201);
  expect(upload).toHaveBeenCalledTimes(1);
});
test("arquivamento durante o upload impede a gravação e limpa o asset não utilizado", async () => {
  upload.mockImplementationOnce(async () => {
    await require("../src/services/encerramentoService").encerrarNegocio({ usuarioId: a.profissional.id, negocioId: a.negocioId });
    return { secure_url: "https://images.example.test/unused.jpg", public_id: "unused" };
  });
  expect((await send()).status).toBe(403);
  expect(await count("photos")).toBe(0); expect(await count("attempts")).toBe(0);
  expect(upload.remover).toHaveBeenCalledWith("unused");
});
test.each(["curta", "chave com espaço"])("identificação inválida %s não envia imagem", async key => {
  expect((await send({ key })).status).toBe(400); expect(upload).not.toHaveBeenCalled();
});
