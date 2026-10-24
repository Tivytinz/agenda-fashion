jest.setTimeout(30000);
jest.mock("../src/services/asaasService", () => ({
  criarAssinaturaAsaas: jest.fn(), buscarAssinaturaPorReferencia: jest.fn(), removerAssinaturaAsaas: jest.fn(),
}));
const db = require("../src/db/db");
const asaas = require("../src/services/asaasService");
const service = require("../src/services/assinaturaService");
const repository = require("../src/repositories/assinaturaRepository");
const webhookRepository = require("../src/repositories/assinaturaWebhookRepository");
const { criarCenarioAgendamento, removerCenarioAgendamento } = require("./helpers/cenarioAgendamento");
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let studio, sub, originalPayment;
beforeEach(async () => {
  for (const fn of Object.values(asaas)) fn.mockReset();
  asaas.buscarAssinaturaPorReferencia.mockResolvedValue(null);
  asaas.removerAssinaturaAsaas.mockResolvedValue({ removida: true });
  asaas.criarAssinaturaAsaas.mockResolvedValue({ id: "sub_reactivated", nextDueDate: "2099-12-01" });
  studio = await criarCenarioAgendamento(db, { prefixo: "owner-seventh-fix" });
  const paid = (await db.query("SELECT id FROM planos WHERE slug='autonoma' AND ativo=TRUE")).rows[0];
  await db.query("UPDATE negocios SET plano_id=$1 WHERE id=$2", [paid.id, studio.negocioId]);
  sub = (await db.query(`INSERT INTO assinaturas(negocio_id,plano_id,asaas_customer_id,asaas_subscription_id,status,
    forma_pagamento,valor,data_proxima_cobranca,ativo) VALUES($1,$2,'cus_audit','sub_original','ACTIVE','pix',10,'2099-12-01',TRUE) RETURNING id`,
  [studio.negocioId, paid.id])).rows[0];
  originalPayment = `pay_original_${sub.id}`;
  await db.query(`INSERT INTO pagamentos(assinatura_id,asaas_payment_id,status,valor,forma_pagamento,data_vencimento,data_pagamento)
    VALUES($1,$2,'RECEIVED',10,'pix','2099-11-01','2099-11-01')`, [sub.id, originalPayment]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  if (studio) await removerCenarioAgendamento(db, studio);
  studio = null;
});
afterAll(async () => { await db.end(); });
const state = async () => (await db.query(`SELECT status,ativo,asaas_subscription_id,reativacao_tentativa,
  renovacao_chave_versao,TO_CHAR(reativacao_inicio_cobranca,'YYYY-MM-DD') AS inicio_reservado,
  TO_CHAR(COALESCE(acesso_pago_ate,data_proxima_cobranca),'YYYY-MM-DD') AS acesso_ate,
  TO_CHAR(data_proxima_cobranca,'YYYY-MM-DD') AS proxima_cobranca FROM assinaturas WHERE id=$1`, [sub.id])).rows[0];
const facts = async () => (await db.query(`SELECT id,tipo,chave_idempotencia,origem,detalhes FROM assinatura_eventos
  WHERE assinatura_id=$1 AND tipo='RENOVACAO_CANCELADA' ORDER BY id`, [sub.id])).rows;
const cancel = () => service.cancelarMinhaAssinatura({ usuarioId: studio.profissional.id });
const reactivate = () => service.reativarMinhaAssinatura({ usuarioId: studio.profissional.id });
const renewal = () => service.ativarAssinaturaPorPagamento(`pay_renewal_${sub.id}`, "RECEIVED", {
  subscription: "sub_original", value: 10, billingType: "PIX", paymentDate: "2099-12-01", dueDate: "2099-12-01",
  webhookEventoId: `evt_renewal_${sub.id}`, webhookEventoCriadoEm: "2099-12-01T12:00:00.000Z",
});


const renovacaoRepository = require("../src/repositories/assinaturaRenovacaoRepository");
const { serializarRespostaAssinatura } = require("../src/services/assinaturaContaDto");
let provider, sequence;
const activeProvider = () => [...provider.values()].filter(item => item.status === "ACTIVE");
const createExternal = (args) => {
  const item = { id: `sub_new_${++sequence}`, customer: args.customerId,
    externalReference: args.externalReference, nextDueDate: args.proximaCobranca, status: "ACTIVE" };
  provider.set(item.id, item);
  return { ...item };
};
beforeEach(() => {
  sequence = 0;
  provider = new Map([["sub_original", { id: "sub_original", nextDueDate: "2099-12-01", status: "ACTIVE" }]]);
  asaas.criarAssinaturaAsaas.mockImplementation(async args => createExternal(args));
  asaas.buscarAssinaturaPorReferencia.mockImplementation(async ({ externalReference }) =>
    activeProvider().find(item => item.externalReference === externalReference) || null);
  asaas.removerAssinaturaAsaas.mockImplementation(async id => {
    if (provider.has(id)) provider.get(id).status = "DELETED";
    return { removida: true };
  });
});
const age = () => db.query(`UPDATE assinatura_renovacao_operacoes SET lease_ate=NOW()-INTERVAL '1 second',proxima_tentativa_em=NOW()-INTERVAL '1 second'
  WHERE assinatura_id=$1 AND estado IN ('PENDING','REMOVING')`, [sub.id]);
const operations = async () => (await db.query(`SELECT tentativa,estado,asaas_subscription_id,referencia_externa
  FROM assinatura_renovacao_operacoes WHERE assinatura_id=$1 ORDER BY tentativa`, [sub.id])).rows;
const suspend = status => service.suspenderAssinaturaPorPagamento({ id: originalPayment, subscription: "sub_original", status,
  webhookEventoId: `evt_${status}_${sub.id}`, webhookEventoCriadoEm: "2099-12-01T13:00:00.000Z" });
const worker = () => require("../src/services/billingReconciliationWorker").executarReconciliacao();

test("ST-01: recebimento durante criação remove a recorrência incompatível e só confirma a data correta", async () => {
  await cancel();
  const started = deferred(), release = deferred();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args => {
    const result = createExternal(args); started.resolve(); await release.promise; return result;
  });
  const pending = reactivate();
  await started.promise;
  try { await renewal(); } finally { release.resolve(); }
  const result = await pending;
  expect(await state()).toMatchObject({ status: "ACTIVE", acesso_ate: "2100-01-01", proxima_cobranca: "2100-01-01", asaas_subscription_id: "sub_new_2" });
  expect(activeProvider()).toEqual([expect.objectContaining({ id: "sub_new_2", nextDueDate: "2100-01-01" })]);
  expect(provider.get("sub_new_1").status).toBe("DELETED");
  expect(result.assinatura.asaas_subscription_id).toBe("sub_new_2");
  expect((await operations()).map(o => o.estado)).toEqual(["CANCELED", "COMPLETED"]);
  expect(asaas.removerAssinaturaAsaas.mock.calls.map(([id]) => id)).toEqual([
    "sub_original", "sub_original", "sub_new_1", "sub_original",
  ]);
});

test.each([false, true])("ST-01/03: remoção incerta persiste o ID e o worker resolve sem criar às cegas, DELETE aplicado=%s", async (applied) => {
  await cancel();
  const started = deferred(), release = deferred();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args => {
    const result = createExternal(args); started.resolve(); await release.promise; return result;
  });
  const pending = reactivate().then(value => ({ value }), error => ({ error }));
  await started.promise;
  await renewal();
  asaas.removerAssinaturaAsaas.mockImplementationOnce(async id => {
    if (applied) provider.get(id).status = "DELETED";
    throw new Error("Resposta do DELETE incerta");
  });
  release.resolve();
  expect((await pending).error).toBeDefined();
  expect((await operations())[0]).toMatchObject({ estado: "REMOVING", asaas_subscription_id: "sub_new_1" });
  expect(await renovacaoRepository.possuiPendente(studio.negocioId)).toBe(true);
  await age();
  expect(await worker()).toMatchObject({ renovacoesReconciliadas: 1, falhas: 0 });
  expect(activeProvider()).toEqual([]);
  expect(await state()).toMatchObject({ status: "CANCELED", acesso_ate: "2100-01-01" });
  expect(await renovacaoRepository.possuiPendente(studio.negocioId)).toBe(false);
  await reactivate();
  expect(activeProvider()).toEqual([expect.objectContaining({ id: "sub_new_2", nextDueDate: "2100-01-01" })]);
});

test.each(["SUBSCRIPTION_UPDATED", "SUBSCRIPTION_DELETED"])("ST-02: %s não reduz o período pago", async type => {
  await cancel(); await renewal();
  await service.sincronizarAssinaturaPorWebhook(type, { id: "sub_original", status: "ACTIVE", nextDueDate: "2099-12-01",
    webhookEventoId: `evt_ack_${sub.id}`, webhookEventoCriadoEm: "2099-12-01T13:00:00.000Z" });
  expect(await state()).toMatchObject({ status: "CANCELED", ativo: true, acesso_ate: "2100-01-01", proxima_cobranca: "2099-12-01" });
  const page = serializarRespostaAssinatura(await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id }));
  expect(page.assinatura.acesso_pago_ate).toBe("2100-01-01");
  expect(page.uso.plano_slug).toBe("autonoma");
  expect(serializarRespostaAssinatura(await cancel()).acesso_ate).toBe("2100-01-01");
  expect(await facts()).toHaveLength(1);
});

test("ST-02: data externa de hoje não expira um mês recebido e o worker preserva o acesso", async () => {
  await db.query("UPDATE assinaturas SET data_proxima_cobranca=CURRENT_DATE WHERE id=$1", [sub.id]);
  await db.query("UPDATE pagamentos SET data_pagamento=CURRENT_DATE,data_vencimento=CURRENT_DATE WHERE assinatura_id=$1", [sub.id]);
  const today = (await db.query("SELECT TO_CHAR(CURRENT_DATE,'YYYY-MM-DD') AS day")).rows[0].day;
  await cancel();
  const paid = (await state()).acesso_ate;
  await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original", nextDueDate: today });
  await worker();
  const page = await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(page.uso.plano_slug).toBe("autonoma");
  expect(await state()).toMatchObject({ ativo: true, acesso_ate: paid, proxima_cobranca: today });
});

test.each(["REFUNDED", "OVERDUE", "CHARGEBACK_REQUESTED"])("ST-03: %s durante criação mantém suspensão e remove o ID criado", async status => {
  await cancel();
  const started = deferred(), release = deferred();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args => {
    started.resolve(); await release.promise; return createExternal(args);
  });
  const pending = reactivate().then(value => ({ value }), error => ({ error }));
  await started.promise;
  try { await suspend(status); } finally { release.resolve(); }
  expect((await pending).error).toMatchObject({ status: 409 });
  expect(await state()).toMatchObject({ status, ativo: false });
  expect(activeProvider()).toEqual([]);
  expect((await operations())[0]).toMatchObject({ estado: "CANCELED", asaas_subscription_id: "sub_new_1" });
  const page = await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(page.uso.plano_slug).toBe("inicial");
  expect(page.renovacao_pendente).toBe(false);
});

test("ST-03: resposta perdida seguida de estorno é recuperada pelo worker mesmo com assinatura inativa", async () => {
  await cancel();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args => { createExternal(args); throw new Error("Resposta perdida"); });
  await expect(reactivate()).rejects.toThrow("perdida");
  const reference = asaas.criarAssinaturaAsaas.mock.calls[0][0].externalReference;
  await suspend("REFUNDED"); await age();
  expect(await worker()).toMatchObject({ renovacoesReconciliadas: 1, falhas: 0 });
  expect(asaas.buscarAssinaturaPorReferencia).toHaveBeenCalledWith({ externalReference: reference, customerId: "cus_audit" });
  expect(activeProvider()).toEqual([]);
  expect(await state()).toMatchObject({ status: "REFUNDED", ativo: false });
});

test("ST-03: confirmação válida após suspensão mantém intenção e só adota recorrência conferida", async () => {
  await cancel();
  const started = deferred(), release = deferred();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args => {
    const result = createExternal(args); started.resolve(); await release.promise; return result;
  });
  const pending = reactivate();
  await started.promise;
  try {
    await suspend("OVERDUE");
    await service.ativarAssinaturaPorPagamento(originalPayment, "RECEIVED", {
      paymentDate: "2099-11-01", webhookEventoId: `evt_recovery_${sub.id}`, webhookEventoCriadoEm: "2099-12-01T14:00:00.000Z",
    });
    expect(await state()).toMatchObject({ status: "REACTIVATING", ativo: true });
  } finally { release.resolve(); }
  await pending;
  expect(await state()).toMatchObject({ status: "ACTIVE", asaas_subscription_id: "sub_new_1" });
});

test("recebimento da nova recorrência antes da resposta de criação preserva o fato e realinha a data", async () => {
  await cancel();
  const started = deferred(), release = deferred();
  let external;
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args => {
    external = createExternal(args); started.resolve(); await release.promise; return external;
  });
  const pending = reactivate();
  await started.promise;
  try {
    await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_CREATED", external);
    await service.ativarAssinaturaPorPagamento(`pay_new_${sub.id}`, "RECEIVED", {
      subscription: external.id, billingType: "PIX", value: 10, paymentDate: "2099-12-01", dueDate: "2099-12-01",
    });
    expect((await state()).acesso_ate).toBe("2100-01-01");
  } finally { release.resolve(); }
  await pending;
  expect(activeProvider()).toEqual([expect.objectContaining({ nextDueDate: "2100-01-01" })]);
  expect((await db.query("SELECT status FROM pagamentos WHERE asaas_payment_id=$1", [`pay_new_${sub.id}`])).rows[0].status).toBe("RECEIVED");
});

test("pagamento da recorrência antiga após finalizar reabre conferência sem apagar o acesso pago", async () => {
  await cancel(); await reactivate();
  expect((await state()).status).toBe("ACTIVE");
  await renewal();
  expect(await state()).toMatchObject({ status: "REACTIVATING", ativo: true, acesso_ate: "2100-01-01" });
  expect((await operations())[0].estado).toBe("REMOVING");
  await worker();
  expect(activeProvider()).toEqual([]);
  expect(await state()).toMatchObject({ status: "CANCELED", acesso_ate: "2100-01-01" });
  await reactivate();
  expect(activeProvider()).toEqual([expect.objectContaining({ nextDueDate: "2100-01-01" })]);
});

async function expiredPending() {
  await db.query(`UPDATE assinaturas SET status='REACTIVATING',reativacao_tentativa=1,
    reativacao_inicio_cobranca=CURRENT_DATE-1,acesso_pago_ate=CURRENT_DATE-1,data_proxima_cobranca=CURRENT_DATE-1,
    updated_at=NOW()-INTERVAL '3 minutes' WHERE id=$1`, [sub.id]);
  await db.query(`UPDATE pagamentos SET data_pagamento=(CURRENT_DATE-1)-INTERVAL '1 month',
    data_vencimento=(CURRENT_DATE-1)-INTERVAL '1 month' WHERE assinatura_id=$1`, [sub.id]);
}

test("ST-04: worker expira tentativa vencida mesmo com consulta indisponível e mantém a obrigação recuperável", async () => {
  await expiredPending();
  asaas.buscarAssinaturaPorReferencia.mockRejectedValue(new Error("Provedor indisponível"));
  const result = await worker();
  expect(result).toMatchObject({ cancelamentosReconciliados: 1 });
  expect(await state()).toMatchObject({ status: "REACTIVATING", ativo: false });
  const page = await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(page.uso.plano_slug).toBe("inicial");
  expect(page.renovacao_pendente).toBe(true);
  expect(await operations()).toHaveLength(1);
  await expect(reactivate()).rejects.toMatchObject({ status: 409 });
  asaas.buscarAssinaturaPorReferencia.mockResolvedValue(null); await age();
  await worker();
  expect(await state()).toMatchObject({ status: "CANCELED", ativo: false });
  expect(await renovacaoRepository.possuiPendente(studio.negocioId)).toBe(false);
});

test("ST-04: recorrência encontrada depois do vencimento é removida sem reabrir benefício pago", async () => {
  await expiredPending();
  const external = createExternal({ customerId: "cus_audit", externalReference: "test_expired", proximaCobranca: "2099-12-01" });
  asaas.buscarAssinaturaPorReferencia.mockResolvedValue(external);
  await worker();
  expect(activeProvider().map(item => item.id)).not.toContain(external.id);
  expect(await state()).toMatchObject({ status: "CANCELED", ativo: false });
  expect((await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id })).uso.plano_slug).toBe("inicial");
});

test("resposta antiga após ausência confirmada e nova geração deixa remoção durável sem tocar a atual", async () => {
  await cancel();
  const started = deferred(), release = deferred();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args => {
    started.resolve(); await release.promise; return createExternal(args);
  });
  const old = reactivate().then(value => ({ value }), error => ({ error }));
  await started.promise;
  await age();
  await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect((await state()).status).toBe("CANCELED");
  await reactivate();
  const currentId = (await state()).asaas_subscription_id;
  release.resolve();
  expect((await old).error).toMatchObject({ status: 409 });
  expect((await operations())[0].estado).toBe("REMOVING");
  await worker();
  expect(activeProvider()).toEqual([expect.objectContaining({ id: currentId })]);
  expect(await state()).toMatchObject({ status: "ACTIVE", asaas_subscription_id: currentId });
});

test("retorno da criação durante consulta de ausência não apaga o ID que exige remoção", async () => {
  await cancel();
  const started = deferred(), release = deferred(), lookupStarted = deferred(), lookupRelease = deferred();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args => {
    started.resolve(); await release.promise; return createExternal(args);
  });
  const old = reactivate().then(value => ({ value }), error => ({ error }));
  await started.promise; await age();
  asaas.buscarAssinaturaPorReferencia.mockImplementationOnce(async () => { lookupStarted.resolve(); await lookupRelease.promise; return null; });
  const recovery = require("../src/services/assinaturaReativacaoService").reconciliarReativacaoAbandonada(studio.negocioId);
  await lookupStarted.promise;
  release.resolve();
  expect((await old).error).toMatchObject({ status: 409 });
  lookupRelease.resolve(); await recovery;
  expect(activeProvider()).toEqual([]);
  expect((await operations())[0].estado).toBe("CANCELED");
});

test("pendência externa bloqueia checkout e encerramento mesmo depois da suspensão", async () => {
  await cancel();
  asaas.criarAssinaturaAsaas.mockRejectedValueOnce(new Error("Resposta perdida"));
  await expect(reactivate()).rejects.toThrow("perdida");
  await suspend("REFUNDED");
  const pending = await require("../src/repositories/encerramentoRepository").buscarPendenciasNegocio(studio.negocioId);
  expect(pending.operacao_financeira_pendente).toBe(true);
  const plan = (await db.query("SELECT id FROM planos WHERE slug='studio'")).rows[0];
  await db.query("UPDATE negocios SET publicado=TRUE WHERE id=$1", [studio.negocioId]);
  await expect(require("../src/services/checkoutService").criarCheckout({
    usuarioId: studio.profissional.id, planoId: plan.id, formaPagamento: "pix", chaveIdempotencia: `blocked_renewal_${sub.id}`,
  })).rejects.toMatchObject({ statusCode: 409 });
});

const testNative = global.__ownerAuditDb ? test.skip : test;
testNative("duas conexões disputam uma tentativa vencida e somente uma obtém a execução", async () => {
  await cancel();
  asaas.criarAssinaturaAsaas.mockRejectedValueOnce(new Error("Resposta perdida"));
  await expect(reactivate()).rejects.toThrow("perdida"); await age();
  const results = await Promise.all([1, 2].map(() => db.executarTransacao(client =>
    renovacaoRepository.reservarExecucao(client, sub.id, 1))));
  expect(results.filter(Boolean)).toHaveLength(1);
});
