jest.setTimeout(30000);
jest.mock("../src/services/asaasService", () => ({
  criarAssinaturaAsaas: jest.fn(), buscarAssinaturaPorReferencia: jest.fn(), removerAssinaturaAsaas: jest.fn(),
}));
const express = require("express");
const request = require("supertest");
const db = require("../src/db/db");
const asaas = require("../src/services/asaasService");
const controller = require("../src/controllers/assinaturaController");
const errorHandler = require("../src/middlewares/errorHandler");
const repository = require("../src/repositories/assinaturaRepository");
const { cancelarMinhaAssinatura, buscarMinhaAssinatura } = require("../src/services/assinaturaContaService");
const { reativarMinhaAssinatura } = require("../src/services/assinaturaReativacaoService");
const { sincronizarAssinaturaPorWebhook } = require("../src/services/assinaturaWebhookService");
const dateContract = require("./fixtures/assinatura-conta-datas.json");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
let studio, sub, app, paidPlan;
beforeEach(async () => {
  for (const fn of Object.values(asaas)) fn.mockReset();
  asaas.buscarAssinaturaPorReferencia.mockResolvedValue(null);
  asaas.removerAssinaturaAsaas.mockResolvedValue({ removida: true });
  asaas.criarAssinaturaAsaas.mockResolvedValue({ id: "sub_new_active", nextDueDate: "2099-12-01" });
  studio = await criarCenarioAgendamento(db, { prefixo: "owner-fifth-fix" });
  paidPlan = (await db.query("SELECT id FROM planos WHERE slug='autonoma' AND ativo=TRUE")).rows[0];
  await db.query("UPDATE negocios SET plano_id=$1 WHERE id=$2", [paidPlan.id, studio.negocioId]);
  sub = (await db.query(`INSERT INTO assinaturas(negocio_id,plano_id,asaas_customer_id,asaas_subscription_id,status,
    forma_pagamento,valor,data_proxima_cobranca,ativo) VALUES($1,$2,'cus_audit','sub_original','ACTIVE','pix',10,'2099-12-01',TRUE) RETURNING *`,
  [studio.negocioId, paidPlan.id])).rows[0];
  app = express();
  // Identidade de fixture: o objetivo aqui é o contrato controller/SQL/JSON;
  // autenticação e autorização de rotas possuem suas próprias integrações.
  app.use((req, _res, next) => { req.user = { id: studio.profissional.id }; next(); });
  app.get("/minha-assinatura", controller.buscarMinhaAssinatura);
  app.delete("/minha-assinatura", controller.cancelarMinhaAssinatura);
  app.post("/minha-assinatura/reativar", controller.reativarMinhaAssinatura);
  app.use(errorHandler);
});
afterEach(async () => {
  jest.restoreAllMocks();
  if (studio) await removerCenarioAgendamento(db, studio);
  studio = null;
});
afterAll(async () => { await db.end(); });
const state = async () => (await db.query(`SELECT status,ativo,asaas_subscription_id,reativacao_tentativa,
  TO_CHAR(data_proxima_cobranca,'YYYY-MM-DD') AS acesso_ate FROM assinaturas WHERE id=$1`, [sub.id])).rows[0];
const facts = async () => (await db.query(`SELECT tipo,chave_idempotencia,origem,motivo,detalhes FROM assinatura_eventos
  WHERE assinatura_id=$1 AND tipo='RENOVACAO_CANCELADA' ORDER BY id`, [sub.id])).rows;

test("QN-01: GET HTTP preserva DATE e mantém o contrato compartilhado com a UI", async () => {
  await db.query(`INSERT INTO pagamentos(assinatura_id,status,valor,data_vencimento,data_pagamento)
    VALUES($1,'RECEIVED',10,'2099-11-01','2099-11-01'),($1,'RECEIVED',10,NULL,NULL)`, [sub.id]);
  const pending = (await db.query(`INSERT INTO assinaturas(negocio_id,plano_id,status,valor,data_proxima_cobranca,ativo)
    VALUES($1,$2,'PENDING',20,'2099-12-02',FALSE) RETURNING id`, [studio.negocioId, paidPlan.id])).rows[0];
  await db.query(`INSERT INTO pagamentos(assinatura_id,status,valor,data_vencimento,data_pagamento)
    VALUES($1,'PENDING',20,'2099-11-02',NULL)`, [pending.id]);
  const response = await request(app).get("/minha-assinatura").expect(200);
  const onlyPaymentDates = (payment) => ({ data_vencimento: payment.data_vencimento, data_pagamento: payment.data_pagamento });
  expect({
    assinatura: { data_proxima_cobranca: response.body.assinatura.data_proxima_cobranca },
    pagamentos: response.body.pagamentos.map(onlyPaymentDates),
    upgrade_pendente: {
      assinatura: { data_proxima_cobranca: response.body.upgrade_pendente.assinatura.data_proxima_cobranca },
      pagamento: onlyPaymentDates(response.body.upgrade_pendente.pagamento),
    },
  }).toEqual(dateContract);
  expect(response.body.assinatura.created_at).toMatch(/T.*Z$/);
  expect(response.body.pagamentos[0].created_at).toMatch(/T.*Z$/);
});

test("QN-01: DELETE e POST, incluindo repetições idempotentes, devolvem dias civis", async () => {
  for (let i = 0; i < 2; i += 1) {
    const canceled = await request(app).delete("/minha-assinatura").expect(200);
    expect(canceled.body.assinatura.data_proxima_cobranca).toBe("2099-12-01");
    expect(canceled.body.acesso_ate).toBe("2099-12-01");
  }
  expect(asaas.removerAssinaturaAsaas).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 2; i += 1) {
    const active = await request(app).post("/minha-assinatura/reativar").expect(200);
    expect(active.body.assinatura.data_proxima_cobranca).toBe("2099-12-01");
    expect(active.body.assinatura.status).toBe("ACTIVE");
  }
  expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledTimes(1);
});

test.each(["REACTIVATING", "ACTIVE"])("QN-02: cancelamento antigo não sobrescreve geração nova em %s", async (newStatus) => {
  const deletion = deferred(), deletionStarted = deferred(), creation = deferred(), creationStarted = deferred();
  asaas.removerAssinaturaAsaas.mockImplementationOnce(() => { deletionStarted.resolve(); return deletion.promise; });
  asaas.criarAssinaturaAsaas.mockImplementationOnce(() => { creationStarted.resolve(); return creation.promise; });
  const cancel = request(app).delete("/minha-assinatura").then((response) => response);
  await deletionStarted.promise;
  let current;
  try {
    await sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original" });
    current = reativarMinhaAssinatura({ usuarioId: studio.profissional.id });
    await creationStarted.promise;
    if (newStatus === "ACTIVE") {
      creation.resolve({ id: "sub_new_active", nextDueDate: "2099-12-01" });
      await current;
    }
    const before = await state(), eventsBefore = await facts();
    expect(before.status).toBe(newStatus);
    deletion.resolve({ removida: true });
    const response = await cancel;
    expect(response.status).toBe(409);
    expect(response.body.codigo).toBe("ASSINATURA_ALTERADA");
    expect(await state()).toEqual(before);
    expect(await facts()).toEqual(eventsBefore);
    // Cancelamento original e confirmação de remoção antes de reativar. A
    // continuação obsoleta não pode remover a recorrência nova.
    expect(asaas.removerAssinaturaAsaas.mock.calls.map(([id]) => id)).toEqual(["sub_original", "sub_original"]);
  } finally {
    deletion.resolve({ removida: true });
    creation.resolve({ id: "sub_new_active", nextDueDate: "2099-12-01" });
    await Promise.all([cancel, current].filter(Boolean));
  }
  expect(await state()).toMatchObject({ status: "ACTIVE", asaas_subscription_id: "sub_new_active", reativacao_tentativa: 1 });
  expect(await sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original" })).toBeNull();
  expect((await state()).status).toBe("ACTIVE");
});

test.each([
  { asaasSubscriptionId: "sub_other", reativacaoTentativa: 0 },
  { asaasSubscriptionId: "sub_original", reativacaoTentativa: 1 },
])("QN-02: UPDATE confere recorrência e tentativa independentemente: %j", async (expected) => {
  const result = await db.executarTransacao((client) => repository.registrarCancelamento(client, {
    assinaturaId: sub.id, negocioId: studio.negocioId, acessoAte: "2099-12-01", observacoes: "teste", ...expected,
  }));
  expect(result).toBeNull();
  expect((await state()).status).toBe("ACTIVE");
});

test("QN-03: recebido sem datas não encurta nem estende o período persistido", async () => {
  await db.query("INSERT INTO pagamentos(assinatura_id,status,valor,data_pagamento,data_vencimento) VALUES($1,'RECEIVED',10,NULL,NULL)", [sub.id]);
  await cancelarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(await state()).toMatchObject({ status: "CANCELED", ativo: true, acesso_ate: "2099-12-01" });
  expect((await buscarMinhaAssinatura({ usuarioId: studio.profissional.id })).uso.plano_slug).toBe("autonoma");
});

test("QN-03: recebido válido é escolhido mesmo após registro recebido sem datas", async () => {
  await db.query(`INSERT INTO pagamentos(assinatura_id,status,valor,data_pagamento,data_vencimento)
    VALUES($1,'RECEIVED',10,'2099-11-01',NULL),($1,'RECEIVED',10,NULL,NULL)`, [sub.id]);
  await cancelarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect((await state()).acesso_ate).toBe("2099-12-01");
});

test("QN-03: nenhuma evidência de período recusa antes do DELETE externo", async () => {
  await db.query("UPDATE assinaturas SET data_proxima_cobranca=NULL WHERE id=$1", [sub.id]);
  await db.query("INSERT INTO pagamentos(assinatura_id,status,valor) VALUES($1,'RECEIVED',10)", [sub.id]);
  await request(app).delete("/minha-assinatura").expect(409);
  expect(asaas.removerAssinaturaAsaas).not.toHaveBeenCalled();
  expect(await state()).toMatchObject({ status: "ACTIVE", acesso_ate: null });
  expect(await facts()).toEqual([]);
});

test.each(["conta", "webhook"])("QN-04: %s primeiro e confirmações repetidas resultam em um fato", async (first) => {
  if (first === "webhook") {
    const deletion = deferred(), started = deferred();
    asaas.removerAssinaturaAsaas.mockImplementationOnce(() => { started.resolve(); return deletion.promise; });
    const cancel = cancelarMinhaAssinatura({ usuarioId: studio.profissional.id });
    await started.promise;
    try {
      await sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original" });
    } finally {
      deletion.resolve({ removida: true });
      await cancel;
    }
  } else await cancelarMinhaAssinatura({ usuarioId: studio.profissional.id });
  await sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original" });
  await cancelarMinhaAssinatura({ usuarioId: studio.profissional.id });
  const events = await facts();
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ chave_idempotencia: `assinatura:${sub.id}:RENOVACAO_CANCELADA:geracao:0:recorrencia:sub_original`,
    origem: first, motivo: first === "conta" ? "CANCELAMENTO_VOLUNTARIO" : "CANCELAMENTO_PROVEDOR",
    detalhes: { acesso_ate: "2099-12-01" } });
  expect(asaas.removerAssinaturaAsaas).toHaveBeenCalledTimes(1);
});
