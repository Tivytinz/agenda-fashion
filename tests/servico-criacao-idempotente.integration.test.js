jest.setTimeout(30000);
jest.mock("../src/middlewares/auth", () => (req, _res, next) => {
  req.user = { id: Number(req.get("X-Test-Usuario")) };
  next();
});
const express = require("express");
const request = require("supertest");
const db = require("../src/db/db");
const profissionalServicos = require("../src/repositories/profissionalServicosRepository");
const servicosRepository = require("../src/repositories/servicosRepository");
const encerramentoService = require("../src/services/encerramentoService");
const configuracoesService = require("../src/services/configuracoesService");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const app = express();
app.use(express.json());
app.use("/servicos", require("../src/routes/servicosRoutes"));
app.use(require("../src/middlewares/errorHandler"));
const BODY = { nome: "Manicure recuperável", descricao: "Descrição", categoria: "unha", valor: 50, duracao_minutos: 30, ativo: true };
const KEY = "servico-tentativa-000001";
let studio;
let other;
beforeEach(async () => {
  studio = await criarCenarioAgendamento(db, { prefixo: "servico-retry" });
  other = await criarCenarioAgendamento(db, { prefixo: "servico-outro" });
  await db.query(`UPDATE negocios SET cidade = 'São Paulo', estado = 'SP', bairro = 'Centro',
    endereco = 'Rua de teste', numero = '10', cep = '01001000', localizacao_url = 'https://maps.google.com/'
    WHERE id = $1`, [studio.negocioId]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  if (studio) await removerCenarioAgendamento(db, studio);
  if (other) await removerCenarioAgendamento(db, other);
  studio = other = null;
});
afterAll(async () => { await db.end(); });
function create({ scenario = studio, key = KEY, body = BODY } = {}) {
  const req = request(app).post("/servicos").set("X-Test-Usuario", String(scenario.profissional.id));
  if (key !== null) req.set("Idempotency-Key", key);
  return req.send(key === null ? body : { negocio_id: scenario.negocioId, ...body });
}
function recover({ usuarioId = studio.profissional.id, negocioId = studio.negocioId, key = KEY } = {}) {
  return request(app).get("/servicos/tentativa").query({ negocio_id: negocioId })
    .set("X-Test-Usuario", String(usuarioId)).set("Idempotency-Key", key);
}
async function count(table, businessId = studio.negocioId) {
  const queries = {
    servicos: "SELECT COUNT(*)::int AS total FROM servicos_negocio WHERE negocio_id = $1 AND nome = $2",
    tentativas: "SELECT COUNT(*)::int AS total FROM servico_criacao_tentativas WHERE negocio_id = $1",
  };
  return (await db.query(queries[table], table === "servicos" ? [businessId, BODY.nome] : [businessId])).rows[0].total;
}

test("retry da confirmação perdida reutiliza cadastro, habilitação e publicação", async () => {
  const first = await create();
  const retry = await create();
  expect(first.status).toBe(201);
  expect(retry.status).toBe(201);
  expect(retry.body.servico.id).toBe(first.body.servico.id);
  expect(retry.body.publicacao.publicado).toBe(true);
  expect(await count("servicos")).toBe(1);
  expect(await count("tentativas")).toBe(1);
  const links = await db.query("SELECT COUNT(*)::int AS total FROM profissional_servicos WHERE servico_id = $1", [first.body.servico.id]);
  expect(links.rows[0].total).toBe(1);
});

test("duas requisições com a mesma identificação confirmam apenas um serviço", async () => {
  const [first, retry] = await Promise.all([create(), create()]);
  expect([first.status, retry.status]).toEqual([201, 201]);
  expect(first.body.servico.id).toBe(retry.body.servico.id);
  expect(await count("servicos")).toBe(1);
});

test("serviço inativo também é idempotente, sem depender da unicidade do nome ativo", async () => {
  const body = { ...BODY, ativo: false };
  const first = await create({ body });
  const retry = await create({ body });
  expect([first.status, retry.status]).toEqual([201, 201]);
  expect(retry.body.servico.id).toBe(first.body.servico.id);
  expect(retry.body.servico.ativo).toBe(false);
  expect(await count("servicos")).toBe(1);
});

test("replay continua possível no limite do plano e respeita a ocultação manual", async () => {
  const first = await create();
  await db.query(`INSERT INTO servicos_negocio(negocio_id, nome, valor, duracao_minutos)
    SELECT $1, 'Serviço extra ' || n, 10, 30 FROM generate_series(1,3) n`, [studio.negocioId]);
  await db.query("UPDATE negocios SET publicado = FALSE, despublicado_manual_em = NOW() WHERE id = $1", [studio.negocioId]);
  const retry = await create();
  expect(retry.status).toBe(201);
  expect(retry.body.servico.id).toBe(first.body.servico.id);
  expect(retry.body.publicacao.publicado).toBe(false);
  const extra = await create({ key: "servico-nova-tentativa", body: { ...BODY, nome: "Novo serviço" } });
  expect(extra.status).toBe(409);
  expect(extra.body.codigo).toBe("LIMITE_SERVICOS");
});

test("replay apresenta o serviço canônico sem desfazer uma edição posterior", async () => {
  const first = await create();
  await db.query("UPDATE servicos_negocio SET valor = 99, ativo = FALSE WHERE id = $1", [first.body.servico.id]);
  const retry = await create();
  expect(retry.status).toBe(201);
  expect(Number(retry.body.servico.valor)).toBe(99);
  expect(retry.body.servico.ativo).toBe(false);
});

test("reutilizar a chave com outro conteúdo é conflito e não altera o cadastro", async () => {
  const first = await create();
  const retry = await create({ body: { ...BODY, valor: 99 } });
  expect(first.status).toBe(201);
  expect(retry.status).toBe(409);
  expect(retry.body.codigo).toBe("SERVICO_TENTATIVA_DIVERGENTE");
  expect(await count("servicos")).toBe(1);
  const stored = await db.query("SELECT valor FROM servicos_negocio WHERE id = $1", [first.body.servico.id]);
  expect(Number(stored.rows[0].valor)).toBe(50);
});

test("GET recupera dados canônicos sem payload original e sem recriar ou republicar", async () => {
  const absent = await recover();
  expect(absent.status).toBe(200);
  expect(absent.body).toEqual({ estado: "nao_encontrada" });
  expect(absent.headers["cache-control"]).toContain("no-store");
  expect(await count("tentativas")).toBe(0);
  const first = await create();
  await db.query("UPDATE servicos_negocio SET valor = 99, ativo = FALSE WHERE id = $1", [first.body.servico.id]);
  await db.query("UPDATE negocios SET publicado = FALSE, despublicado_manual_em = NOW() WHERE id = $1", [studio.negocioId]);
  const result = await recover();
  expect(result.status).toBe(200);
  expect(result.body.estado).toBe("concluida");
  expect(result.body.servico.id).toBe(first.body.servico.id);
  expect(Number(result.body.servico.valor)).toBe(99);
  expect(result.body.servico.ativo).toBe(false);
  expect(result.body.publicacao.publicado).toBe(false);
  expect(await count("servicos")).toBe(1);
  expect(await count("tentativas")).toBe(1);
});

test("referência técnica não concede acesso a outra dona ou outro negócio", async () => {
  await create();
  expect((await recover({ usuarioId: other.profissional.id })).status).toBe(403);
  expect((await recover({ negocioId: other.negocioId })).status).toBe(403);
  const stolenTarget = await create({ body: { ...BODY, negocio_id: other.negocioId } });
  expect(stolenTarget.status).toBe(403);
  expect(await count("servicos", other.negocioId)).toBe(0);
});

test("criação com chave sem negócio explícito é recusada antes de gravar", async () => {
  const result = await request(app).post("/servicos")
    .set("X-Test-Usuario", String(studio.profissional.id)).set("Idempotency-Key", KEY).send(BODY);
  expect(result.status).toBe(400);
  expect(await count("servicos")).toBe(0);
  expect(await count("tentativas")).toBe(0);
});

test.each([true, false])("arquivamento entre leitura inicial e transação impede criar serviço ativo=%s", async (ativo) => {
  // A publicação incompleta também precisa ser protegida: ela não faria o
  // CHECK de publicação arquivada abortar a escrita por acaso.
  await configuracoesService.salvarConfiguracoes({ usuarioId: studio.profissional.id, negocioId: studio.negocioId, dados: { numero: "" } });
  const original = servicosRepository.buscarNegocioDono;
  jest.spyOn(servicosRepository, "buscarNegocioDono").mockImplementationOnce(async (...args) => {
    const snapshot = await original(...args);
    await encerramentoService.encerrarNegocio({ usuarioId: studio.profissional.id, negocioId: studio.negocioId });
    return snapshot;
  });
  const result = await create({ body: { ...BODY, ativo } });
  expect(result.status).toBe(403);
  expect(await count("servicos")).toBe(0);
  expect(await count("tentativas")).toBe(0);
  expect((await recover()).status).toBe(403);
  const persisted = await db.query("SELECT ativo, publicado, arquivado_em FROM negocios WHERE id = $1", [studio.negocioId]);
  expect(persisted.rows[0]).toMatchObject({ ativo: false, publicado: false });
  expect(persisted.rows[0].arquivado_em).toBeTruthy();
});

test("a mesma chave em outro negócio pertence a outra tentativa autorizada", async () => {
  const first = await create();
  const second = await create({ scenario: other });
  expect([first.status, second.status]).toEqual([201, 201]);
  expect(second.body.servico.id).not.toBe(first.body.servico.id);
  expect(Number(second.body.servico.negocio_id)).toBe(other.negocioId);
  expect(await count("tentativas", other.negocioId)).toBe(1);
});

test("conta sem vínculo de dona não recupera nem cria uma tentativa", async () => {
  await create();
  await db.query("UPDATE usuarios_negocios SET papel = 'profissional' WHERE usuario_id = $1 AND negocio_id = $2", [studio.profissional.id, studio.negocioId]);
  const retry = await create();
  expect(retry.status).toBe(403);
  expect((await recover()).status).toBe(403);
  expect(await count("tentativas")).toBe(1);
});

test("erro dentro da transação desfaz serviço e tentativa; retry pode confirmar", async () => {
  jest.spyOn(profissionalServicos, "habilitarServicoProfissional").mockRejectedValueOnce(new Error("Falha na habilitação"));
  expect((await create()).status).toBe(500);
  expect(await count("servicos")).toBe(0);
  expect(await count("tentativas")).toBe(0);
  expect((await create()).status).toBe(201);
  expect(await count("servicos")).toBe(1);
});

test("serviço removido mantém a tentativa encerrada e não é recriado por retry antigo", async () => {
  const first = await create();
  const removal = await request(app).delete(`/servicos/${first.body.servico.id}`).set("X-Test-Usuario", String(studio.profissional.id));
  expect(removal.status).toBe(200);
  const retry = await create();
  expect(retry.status).toBe(410);
  const recovered = await recover();
  expect(recovered.status).toBe(410);
  expect(recovered.body.codigo).toBe("SERVICO_TENTATIVA_REMOVIDA");
  expect(recovered.headers["cache-control"]).toContain("no-store");
  expect(await count("servicos")).toBe(0);
  const attempt = await db.query("SELECT servico_id, concluida_em FROM servico_criacao_tentativas WHERE negocio_id = $1", [studio.negocioId]);
  expect(attempt.rows[0].servico_id).toBeNull();
  expect(attempt.rows[0].concluida_em).not.toBeNull();
});

test("cliente legado sem chave continua criando e recebe conflito acionável por nome repetido", async () => {
  expect((await create({ key: null })).status).toBe(201);
  const duplicate = await create({ key: null });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.codigo).toBe("SERVICO_NOME_DUPLICADO");
  expect(await count("tentativas")).toBe(0);
});

test.each(["curta", "servico chave invalida"]) ("chave inválida %s não inicia tentativa", async (key) => {
  const response = await create({ key });
  expect(response.status).toBe(400);
  expect(await count("tentativas")).toBe(0);
  expect(await count("servicos")).toBe(0);
});
