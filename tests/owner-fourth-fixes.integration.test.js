jest.setTimeout(30000);
jest.mock("../src/services/asaasService", () => ({
  criarAssinaturaAsaas: jest.fn(),
  buscarAssinaturaPorReferencia: jest.fn(),
  removerAssinaturaAsaas: jest.fn(),
}));
const db = require("../src/db/db");
const asaas = require("../src/services/asaasService");
const repository = require("../src/repositories/assinaturaRepository");
const teamRepository = require("../src/repositories/profissionaisRepository");
const teamService = require("../src/services/profissionaisService");
const { reativarMinhaAssinatura, reconciliarReativacaoAbandonada } = require("../src/services/assinaturaReativacaoService");
const { sincronizarAssinaturaPorWebhook } = require("../src/services/assinaturaWebhookService");
const { cancelarMinhaAssinatura } = require("../src/services/assinaturaContaService");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
let studio, paidPlan;
const others = [];
beforeEach(async () => {
  for (const fn of Object.values(asaas)) fn.mockReset();
  asaas.buscarAssinaturaPorReferencia.mockResolvedValue(null);
  asaas.removerAssinaturaAsaas.mockResolvedValue({ removida: true });
  studio = await criarCenarioAgendamento(db, { prefixo: "owner-fourth-fix" });
  paidPlan = (await db.query("SELECT id FROM planos WHERE slug='autonoma' AND ativo=TRUE")).rows[0];
  await db.query("UPDATE negocios SET plano_id=$1 WHERE id=$2", [paidPlan.id, studio.negocioId]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  if (studio) {
    await db.query("DELETE FROM analytics_eventos WHERE target_business_id=$1", [studio.negocioId]);
    await removerCenarioAgendamento(db, studio);
  }
  for (const other of others.splice(0)) await removerCenarioAgendamento(db, other);
  studio = null;
});
afterAll(async () => { await db.end(); });

async function subscription(status = "CANCELED", date = "2099-12-01") {
  return (await db.query(`INSERT INTO assinaturas(negocio_id,plano_id,asaas_customer_id,asaas_subscription_id,status,
    forma_pagamento,valor,data_proxima_cobranca,ativo,reativacao_tentativa,updated_at)
    VALUES($1,$2,'cus_audit','sub_original',$3,'pix',10,$4,TRUE,1,NOW()-INTERVAL '3 minutes') RETURNING *`,
  [studio.negocioId, paidPlan.id, status, date])).rows[0];
}
async function member(active = true) {
  const other = await criarCenarioAgendamento(db, { prefixo: "owner-fourth-member" });
  others.push(other);
  await db.query(`INSERT INTO usuarios_negocios(usuario_id,negocio_id,papel,ativo,motivo_inatividade)
    VALUES($1,$2,'profissional',$3,$4)`,
  [other.profissional.id, studio.negocioId, active, active ? null : "inativado_pela_dona"]);
  return other.profissional.id;
}
async function state(id) {
  return (await db.query("SELECT status,ativo,reativacao_tentativa,asaas_subscription_id FROM assinaturas WHERE id=$1", [id])).rows[0];
}

test("QD-01: reativação aceita DATE do banco sem deslocar o dia ou cobrar imediatamente", async () => {
  const sub = await subscription();
  asaas.criarAssinaturaAsaas.mockResolvedValue({ id: "sub_reactivated", nextDueDate: "2099-12-01" });
  const result = await reativarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(result.assinatura).toMatchObject({ status: "ACTIVE", ativo: true, reativacao_tentativa: 2 });
  expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledWith(expect.objectContaining({
    proximaCobranca: "2099-12-01", externalReference: `assinatura-reativada:${sub.id};tentativa:2;inicio:2099-12-01`,
    reutilizarPorExternalReference: true,
  }));
});

test("QD-01: DELETE do provedor preserva período pago e integrantes ativas", async () => {
  const sub = await subscription("ACTIVE");
  const person = await member();
  await sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original" });
  expect(await state(sub.id)).toMatchObject({ status: "CANCELED", ativo: true });
  expect((await db.query("SELECT plano_id FROM negocios WHERE id=$1", [studio.negocioId])).rows[0].plano_id).toBe(paidPlan.id);
  expect((await db.query("SELECT ativo FROM usuarios_negocios WHERE negocio_id=$1 AND usuario_id=$2", [studio.negocioId, person])).rows[0].ativo).toBe(true);
  expect((await db.query("SELECT id FROM analytics_eventos WHERE target_business_id=$1 AND nome='business_professional_deactivated'", [studio.negocioId])).rows).toHaveLength(0);
});

test("QD-01: período realmente vencido continua retornando ao grátis e aplicando capacidade", async () => {
  const sub = await subscription("ACTIVE", "2000-01-01");
  const person = await member();
  await sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original" });
  expect(await state(sub.id)).toMatchObject({ status: "DELETED", ativo: false });
  expect((await db.query("SELECT p.slug FROM negocios n JOIN planos p ON p.id=n.plano_id WHERE n.id=$1", [studio.negocioId])).rows[0].slug).toBe("inicial");
  expect((await db.query("SELECT ativo,motivo_inatividade FROM usuarios_negocios WHERE negocio_id=$1 AND usuario_id=$2", [studio.negocioId, person])).rows[0])
    .toMatchObject({ ativo: false, motivo_inatividade: "excedente_limite_plano" });
});

test("QD-01: cancelamento sem pagamentos locais preserva a data DATE da assinatura", async () => {
  const sub = await subscription("ACTIVE");
  await cancelarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(await state(sub.id)).toMatchObject({ status: "CANCELED", ativo: true });
  expect((await db.query("SELECT TO_CHAR(data_proxima_cobranca,'YYYY-MM-DD') AS data FROM assinaturas WHERE id=$1", [sub.id])).rows[0].data).toBe("2099-12-01");
  expect(asaas.removerAssinaturaAsaas).toHaveBeenCalledWith("sub_original");
});

test("QD-01: reconciliação de DATE consulta o provedor e recupera a recorrência existente", async () => {
  const sub = await subscription("REACTIVATING");
  asaas.buscarAssinaturaPorReferencia.mockResolvedValue({ id: "sub_recovered", nextDueDate: "2099-12-01" });
  await reconciliarReativacaoAbandonada(studio.negocioId);
  expect(await state(sub.id)).toMatchObject({ status: "ACTIVE", asaas_subscription_id: "sub_recovered" });
  expect(asaas.buscarAssinaturaPorReferencia).toHaveBeenCalledWith({
    externalReference: `assinatura-reativada:${sub.id};tentativa:1;inicio:2099-12-01`, customerId: "cus_audit",
  });
  expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
});

test.each(["absent", "found"])("QD-02: resposta antiga %s não cancela nem finaliza a tentativa nova", async (outcome) => {
  const sub = await subscription("REACTIVATING");
  const oldRead = deferred(), oldReadStarted = deferred();
  const create = deferred(), createStarted = deferred();
  asaas.buscarAssinaturaPorReferencia.mockImplementationOnce(() => { oldReadStarted.resolve(); return oldRead.promise; })
    .mockResolvedValue(null);
  asaas.criarAssinaturaAsaas.mockImplementationOnce(() => { createStarted.resolve(); return create.promise; });
  const stale = reconciliarReativacaoAbandonada(studio.negocioId);
  await oldReadStarted.promise;
  // A segunda execução só pode assumir após vencer a concessão da primeira.
  await db.query("UPDATE assinatura_renovacao_operacoes SET lease_ate=NOW()-INTERVAL '1 second' WHERE assinatura_id=$1", [sub.id]);
  await reconciliarReativacaoAbandonada(studio.negocioId);
  expect((await state(sub.id)).status).toBe("CANCELED");
  const current = reativarMinhaAssinatura({ usuarioId: studio.profissional.id });
  await createStarted.promise;
  expect(await state(sub.id)).toMatchObject({ status: "REACTIVATING", reativacao_tentativa: 2 });
  oldRead.resolve(outcome === "found" ? { id: "sub_stale", nextDueDate: "2099-12-01" } : null);
  await expect(stale).resolves.toBeNull();
  expect(await state(sub.id)).toMatchObject({ status: "REACTIVATING", reativacao_tentativa: 2, asaas_subscription_id: "sub_original" });
  create.resolve({ id: "sub_current", nextDueDate: "2099-12-01" });
  await expect(current).resolves.toHaveProperty("assinatura.status", "ACTIVE");
  await reativarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledTimes(1);
  expect(await state(sub.id)).toMatchObject({ status: "ACTIVE", reativacao_tentativa: 2, asaas_subscription_id: "sub_current" });
});

test.each(["restaurarCancelamentoReativacao", "registrarReativacao"])("QD-02: %s recusa escrita sem identidade válida da tentativa", async (method) => {
  const sub = await subscription("REACTIVATING");
  await expect(db.executarTransacao((client) => repository[method](client, {
    assinaturaId: sub.id, negocioId: studio.negocioId, asaasSubscriptionId: "sub_bad",
    dataProximaCobranca: "2099-12-01", observacoes: "test",
  }))).rejects.toThrow("Tentativa de reativação inválida.");
  expect(await state(sub.id)).toMatchObject({ status: "REACTIVATING", reativacao_tentativa: 1 });
});

// O harness de auditoria usa uma conexão embarcada. O CI padrão executa este
// cenário com duas conexões nativas e não define __ownerAuditDb.
const testNative = global.__ownerAuditDb ? test.skip : test;
testNative.each(["ativação", "convite"])("QD-03: %s e inativação em duas conexões concluem sem deadlock ou evento parcial", async (operation) => {
  await subscription("ACTIVE");
  const ana = await member(false), bia = await member(true);
  if (operation === "convite") {
    await db.query("DELETE FROM usuarios_negocios WHERE negocio_id=$1 AND usuario_id=$2", [studio.negocioId, ana]);
  }
  const capacityReady = deferred(), release = deferred(), inactivationStarted = deferred();
  const originalCapacity = teamRepository.bloquearCadastroProfissional;
  const originalOwner = teamRepository.bloquearContaDonaAtiva;
  let activationClient;
  jest.spyOn(teamRepository, "bloquearCadastroProfissional").mockImplementation(async (client, id) => {
    await originalCapacity(client, id);
    if (!activationClient) {
      activationClient = client;
      capacityReady.resolve();
      await release.promise;
    }
  });
  jest.spyOn(teamRepository, "bloquearContaDonaAtiva").mockImplementation(async (id, client) => {
    if (!activationClient || client === activationClient) return originalOwner(id, client);
    const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const pending = originalOwner(id, client);
    inactivationStarted.resolve(pid);
    return pending;
  });
  const observe = (promise) => promise.then((value) => ({ status: "fulfilled", value }), (reason) => ({ status: "rejected", reason }));
  const activation = observe(operation === "ativação"
    ? teamService.ativarProfissional({ usuarioId: studio.profissional.id, profissionalId: ana })
    : teamService.criarConviteProfissional({ usuarioDonoId: studio.profissional.id, emailOuWhatsapp: others[0].profissional.email }));
  let inactivation;
  try {
    await capacityReady.promise;
    inactivation = observe(teamService.inativarProfissional({ usuarioId: studio.profissional.id, profissionalId: bia }));
    const pid = await inactivationStarted.promise;
    const deadline = Date.now() + 3000;
    let blocked = false;
    while (Date.now() < deadline) {
      blocked = (await db.query("SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked", [pid])).rows[0].blocked;
      if (blocked) break;
      await new Promise((done) => setTimeout(done, 10));
    }
    expect(blocked).toBe(true);
    release.resolve();
    const results = await Promise.all([activation, inactivation]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    const members = (await db.query("SELECT usuario_id,ativo FROM usuarios_negocios WHERE negocio_id=$1 AND usuario_id=ANY($2::int[]) ORDER BY usuario_id", [studio.negocioId, [ana, bia]])).rows;
    expect(members).toEqual(operation === "ativação"
      ? [{ usuario_id: ana, ativo: true }, { usuario_id: bia, ativo: false }]
      : [{ usuario_id: bia, ativo: false }]);
    if (operation === "convite") {
      expect((await db.query("SELECT status FROM convites_profissionais WHERE negocio_id=$1 AND usuario_convidado_id=$2", [studio.negocioId, ana])).rows)
        .toEqual([{ status: "pendente" }]);
    }
    const events = (await db.query("SELECT nome,actor_user_id FROM analytics_eventos WHERE target_business_id=$1 AND nome LIKE 'business_professional_%' ORDER BY id", [studio.negocioId])).rows;
    expect(events).toEqual([
      ...(operation === "ativação" ? [{ nome: "business_professional_reactivated", actor_user_id: String(studio.profissional.id) }] : []),
      { nome: "business_professional_deactivated", actor_user_id: String(studio.profissional.id) },
    ]);
  } finally {
    release.resolve();
    await Promise.all([activation, inactivation].filter(Boolean));
  }
});
