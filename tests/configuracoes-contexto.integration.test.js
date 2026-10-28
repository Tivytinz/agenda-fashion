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
const repo = require("../src/repositories/configuracoesRepository");
const encerrar = require("../src/services/encerramentoService");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const app = express(); app.use(express.json());
app.use(require("../src/routes/configuracoesRoutes")); app.use(require("../src/middlewares/errorHandler"));
const IMAGE = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
let a; let other; let replacement;
beforeEach(async () => {
  jest.clearAllMocks();
  upload.mockResolvedValue({ secure_url: "https://images.example.test/new.jpg", public_id: "new-photo" });
  a = await criarCenarioAgendamento(db, { prefixo: "config-target" });
  other = await criarCenarioAgendamento(db, { prefixo: "config-other" });
  await db.query(`UPDATE negocios SET cidade='São Paulo', estado='SP', bairro='Centro', endereco='Rua antiga',
    numero='10', cep='01001000', localizacao_url='https://maps.google.com/' WHERE id=$1`, [a.negocioId]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  if (replacement) await db.query("DELETE FROM negocios WHERE id=$1", [replacement.id]);
  replacement = null;
  if (a) await removerCenarioAgendamento(db, a);
  if (other) await removerCenarioAgendamento(db, other);
});
afterAll(() => db.end());
function send(action, target = a.negocioId, usuario = a.profissional.id) {
  const req = request(app)[action === "perfil" ? "put" : action === "publicacao" ? "patch" : "post"](
    action === "perfil" ? "/configuracoes" : `/configuracoes/${action === "foto" ? "foto" : "publicacao"}`
  ).set("X-Test-Usuario", String(usuario));
  if (target !== null) req.set("X-AF-Negocio", String(target));
  return action === "foto" ? req.attach("foto", IMAGE, { filename: "foto.jpg", contentType: "image/jpeg" })
    : req.send(action === "perfil" ? { nome: "Rascunho da aba antiga", endereco: "Rua antiga" } : { publicado: false });
}
async function state(id) {
  return (await db.query("SELECT nome,endereco,publicado,foto_url,ativo,arquivado_em FROM negocios WHERE id=$1", [id])).rows[0];
}
async function replaceBusiness() {
  await encerrar.encerrarNegocio({ usuarioId: a.profissional.id, negocioId: a.negocioId });
  const result = await require("../src/services/negocioCriacaoService").criar({
    usuarioId: a.profissional.id, nome: `Studio novo ${a.negocioId}`, areas: ["Unhas"], whatsapp: "11999999999",
    cidade: "São Paulo", estado: "SP", bairro: "Centro", endereco: "Rua nova", numero: "200", cep: "01001000",
    localizacao_url: "https://maps.google.com/", fuso_horario: "America/Sao_Paulo",
  });
  replacement = result.negocio;
}
test.each(["perfil", "publicacao", "foto"])("aba antiga não altera o novo negócio por %s", async action => {
  await replaceBusiness();
  const before = await state(replacement.id);
  const result = await send(action);
  expect(result.status).toBe(409);
  expect(result.body.codigo).toBe("NEGOCIO_CONTEXTO_ALTERADO");
  expect(await state(replacement.id)).toEqual(before);
  expect(upload).not.toHaveBeenCalled();
});
test.each(["perfil", "publicacao", "foto"])("pedido de %s sem alvo não escolhe o negócio atual", async action => {
  const before = await state(a.negocioId);
  const result = await send(action, null);
  expect(result.status).toBe(400);
  expect(result.body.codigo).toBe("NEGOCIO_ALVO_OBRIGATORIO");
  expect(await state(a.negocioId)).toEqual(before);
});
test.each(["perfil", "publicacao", "foto"])("o ID de outro negócio não concede autorização para %s", async action => {
  const before = await state(other.negocioId);
  expect((await send(action, other.negocioId)).status).toBe(409);
  expect(await state(other.negocioId)).toEqual(before);
  expect(upload).not.toHaveBeenCalled();
});
test.each(["perfil", "publicacao", "foto"])("arquivar entre leitura e gravação de %s invalida a escrita", async action => {
  const archive = () => encerrar.encerrarNegocio({ usuarioId: a.profissional.id, negocioId: a.negocioId });
  if (action === "foto") upload.mockImplementationOnce(async () => {
    await archive(); return { secure_url: "https://images.example.test/new.jpg", public_id: "new-photo" };
  });
  else {
    const method = action === "perfil" ? "atualizarNegocio" : "atualizarPublicacao";
    const original = repo[method];
    jest.spyOn(repo, method).mockImplementationOnce(async (...args) => { await archive(); return original(...args); });
  }
  const result = await send(action);
  expect(result.status).toBe(409);
  const persisted = await state(a.negocioId);
  expect(persisted).toMatchObject({ ativo: false, publicado: false, foto_url: null });
  expect(persisted.nome).not.toBe("Rascunho da aba antiga");
  expect(persisted.arquivado_em).toBeTruthy();
  if (action === "foto") expect(upload.remover).toHaveBeenCalledWith("new-photo");
});
test("a compatibilidade do perfil usa seu ID explícito e preserva o alvo", async () => {
  const response = await request(app).put("/configuracoes").set("X-Test-Usuario", String(a.profissional.id))
    .send({ id: a.negocioId, nome: `Nome válido ${a.negocioId}` });
  expect(response.status).toBe(200);
  expect(Number(response.body.negocio.id)).toBe(a.negocioId);
});
