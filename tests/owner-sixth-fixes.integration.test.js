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
  studio = await criarCenarioAgendamento(db, { prefixo: "owner-sixth-fix" });
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
  TO_CHAR(COALESCE(acesso_pago_ate,data_proxima_cobranca),'YYYY-MM-DD') AS acesso_ate FROM assinaturas WHERE id=$1`, [sub.id])).rows[0];
const facts = async () => (await db.query(`SELECT id,tipo,chave_idempotencia,origem,detalhes FROM assinatura_eventos
  WHERE assinatura_id=$1 AND tipo='RENOVACAO_CANCELADA' ORDER BY id`, [sub.id])).rows;
const cancel = () => service.cancelarMinhaAssinatura({ usuarioId: studio.profissional.id });
const reactivate = () => service.reativarMinhaAssinatura({ usuarioId: studio.profissional.id });
const renewal = () => service.ativarAssinaturaPorPagamento(`pay_renewal_${sub.id}`, "RECEIVED", {
  subscription: "sub_original", value: 10, billingType: "PIX", paymentDate: "2099-12-01", dueDate: "2099-12-01",
  webhookEventoId: `evt_renewal_${sub.id}`, webhookEventoCriadoEm: "2099-12-01T12:00:00.000Z",
});

test("QS-01: pagamento enquanto DELETE espera mantém todo o período quitado", async () => {
  const deletion = deferred(), started = deferred();
  asaas.removerAssinaturaAsaas.mockImplementationOnce(() => { started.resolve(); return deletion.promise; });
  const pending = cancel();
  await started.promise;
  try {
    await renewal();
    expect((await state()).acesso_ate).toBe("2100-01-01");
  } finally { deletion.resolve({ removida: true }); }
  const result = await pending;
  expect(await state()).toMatchObject({ status: "CANCELED", ativo: true, acesso_ate: "2100-01-01" });
  expect(result.acesso_ate).toEqual(result.assinatura.acesso_pago_ate);
  expect((await facts())[0].detalhes.acesso_ate).toBe("2100-01-01");
});

test("QS-01: pagamento após cancelamento amplia acesso sem reativar a renovação", async () => {
  await cancel();
  await renewal();
  expect(await state()).toMatchObject({ status: "CANCELED", ativo: true, acesso_ate: "2100-01-01" });
  const page = await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(page.estado_assinatura.codigo).toBe("CANCELAMENTO_AGENDADO");
  expect(page.uso.plano_slug).toBe("autonoma");
  await cancel();
  expect(asaas.removerAssinaturaAsaas).toHaveBeenCalledTimes(1);
  expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
});

test("QS-01: recebimento antigo inserido depois não encurta o fim de acesso", async () => {
  await renewal();
  await db.query(`INSERT INTO pagamentos(assinatura_id,status,valor,data_pagamento,data_vencimento)
    VALUES($1,'RECEIVED',10,'2099-01-01','2099-01-01')`, [sub.id]);
  await cancel();
  expect((await state()).acesso_ate).toBe("2100-01-01");
});

test("QS-01: evidência financeira não fica limitada aos 12 pagamentos da tela", async () => {
  await db.query("UPDATE assinaturas SET data_proxima_cobranca=NULL WHERE id=$1", [sub.id]);
  for (let i = 0; i < 13; i += 1) {
    await db.query("INSERT INTO pagamentos(assinatura_id,status,valor) VALUES($1,'RECEIVED',10)", [sub.id]);
  }
  await cancel();
  expect((await state()).acesso_ate).toBe("2099-12-01");
});

test("QS-02: pagamento e reconhecimentos antigos preservam a reserva até vincular a nova recorrência", async () => {
  await cancel();
  const creation = deferred(), started = deferred();
  asaas.criarAssinaturaAsaas.mockResolvedValue({ id: "sub_reactivated_2", nextDueDate: "2100-01-01" });
  asaas.criarAssinaturaAsaas.mockImplementationOnce(() => { started.resolve(); return creation.promise; });
  const pending = reactivate();
  await started.promise;
  try {
    await renewal();
    expect(await state()).toMatchObject({ status: "REACTIVATING", acesso_ate: "2100-01-01", inicio_reservado: "2099-12-01" });
    for (const type of ["SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED"]) {
      await service.sincronizarAssinaturaPorWebhook(type, { id: "sub_original", status: "ACTIVE", nextDueDate: "2099-12-01" });
      expect(await state()).toMatchObject({ status: "REACTIVATING", acesso_ate: "2100-01-01", inicio_reservado: "2099-12-01" });
    }
  } finally { creation.resolve({ id: "sub_reactivated", nextDueDate: "2099-12-01" }); }
  await expect(pending).resolves.toHaveProperty("assinatura.asaas_subscription_id", "sub_reactivated_2");
  expect(await state()).toMatchObject({ status: "ACTIVE", asaas_subscription_id: "sub_reactivated_2", acesso_ate: "2100-01-01" });
  expect(asaas.removerAssinaturaAsaas).toHaveBeenCalledWith("sub_reactivated");
  await reactivate();
  expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledTimes(2);
});

test.each([false, true])("QS-02: retomada preserva referência após pagamento, reserva legada=%s", async (legacy) => {
  await cancel();
  asaas.criarAssinaturaAsaas.mockRejectedValueOnce(new Error("Resposta externa incerta"));
  await expect(reactivate()).rejects.toThrow("incerta");
  const reference = asaas.criarAssinaturaAsaas.mock.calls[0][0].externalReference;
  if (legacy) {
    await db.query("UPDATE assinaturas SET reativacao_inicio_cobranca=NULL,renovacao_chave_versao=0 WHERE id=$1", [sub.id]);
    await db.query("DELETE FROM assinatura_renovacao_operacoes WHERE assinatura_id=$1", [sub.id]);
  }
  await renewal();
  expect(await state()).toMatchObject({ status: "REACTIVATING", inicio_reservado: "2099-12-01", acesso_ate: "2100-01-01" });
  await db.query("UPDATE assinaturas SET updated_at=NOW()-INTERVAL '3 minutes' WHERE id=$1", [sub.id]);
  await db.query("UPDATE assinatura_renovacao_operacoes SET lease_ate=NOW()-INTERVAL '1 second' WHERE assinatura_id=$1", [sub.id]);
  asaas.buscarAssinaturaPorReferencia.mockResolvedValue({ id: "sub_recovered", nextDueDate: "2099-12-01" });
  await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(asaas.buscarAssinaturaPorReferencia).toHaveBeenCalledWith({ externalReference: reference, customerId: "cus_audit" });
  expect(await state()).toMatchObject({ status: "CANCELED", acesso_ate: "2100-01-01" });
  expect(asaas.removerAssinaturaAsaas).toHaveBeenCalledWith("sub_recovered");
  expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledTimes(1);
});

test("QS-02: ausência confirmada restaura cancelamento com o novo período e próxima tentativa usa a data nova", async () => {
  await cancel();
  asaas.criarAssinaturaAsaas.mockRejectedValueOnce(new Error("Resposta incerta"));
  await expect(reactivate()).rejects.toThrow("incerta");
  await renewal();
  await db.query("UPDATE assinaturas SET updated_at=NOW()-INTERVAL '3 minutes' WHERE id=$1", [sub.id]);
  await db.query("UPDATE assinatura_renovacao_operacoes SET lease_ate=NOW()-INTERVAL '1 second' WHERE assinatura_id=$1", [sub.id]);
  await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(await state()).toMatchObject({ status: "CANCELED", acesso_ate: "2100-01-01" });
  asaas.criarAssinaturaAsaas.mockResolvedValue({ id: "sub_attempt_2", nextDueDate: "2100-01-01" });
  await reactivate();
  expect(asaas.criarAssinaturaAsaas).toHaveBeenLastCalledWith(expect.objectContaining({
    proximaCobranca: "2100-01-01", externalReference: `assinatura-reativada:${sub.id};tentativa:2;inicio:2100-01-01`,
  }));
});

test("QS-02: recebimento antigo não torna a tentativa vencida invisível à recuperação", async () => {
  await db.query(`UPDATE assinaturas SET status='REACTIVATING',reativacao_tentativa=1,
    reativacao_inicio_cobranca='2000-02-01',data_proxima_cobranca='2000-02-01',
    updated_at=NOW()-INTERVAL '3 minutes' WHERE id=$1`, [sub.id]);
  await db.query("UPDATE pagamentos SET data_pagamento='2000-01-01',data_vencimento='2000-01-01' WHERE assinatura_id=$1", [sub.id]);
  await service.ativarAssinaturaPorPagamento(originalPayment, "RECEIVED", { paymentDate: "2000-01-01" });
  expect(await state()).toMatchObject({ status: "REACTIVATING", ativo: false });
  const page = await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id });
  expect(page.uso.plano_slug).toBe("inicial");
  expect(await state()).toMatchObject({ status: "CANCELED", ativo: false });
  expect(asaas.buscarAssinaturaPorReferencia).toHaveBeenCalled();
  expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
});

test.each(["conta", "webhook"])("QS-03: dois ciclos têm dois fatos e retries do mesmo ciclo têm um, primeiro=%s", async (first) => {
  if (first === "webhook") await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original" });
  await cancel();
  await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original" });
  await reactivate();
  if (first === "webhook") await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_reactivated" });
  await cancel();
  await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_reactivated" });
  await cancel();
  const events = await facts();
  expect(events).toHaveLength(2);
  expect(events.map((event) => event.chave_idempotencia)).toEqual([
    `assinatura:${sub.id}:RENOVACAO_CANCELADA:geracao:0:recorrencia:sub_original`,
    `assinatura:${sub.id}:RENOVACAO_CANCELADA:geracao:1:recorrencia:sub_reactivated`,
  ]);
  expect(events.map((event) => event.origem)).toEqual([first, first]);
});

test("QS-03: ciclo legado preserva seu fato e só a próxima reativação muda a identidade", async () => {
  await db.query("UPDATE assinaturas SET renovacao_chave_versao=0 WHERE id=$1", [sub.id]);
  await cancel();
  const old = (await facts())[0];
  expect(old.chave_idempotencia).toBe(`assinatura:${sub.id}:RENOVACAO_CANCELADA:2099-12-01`);
  await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original" });
  await reactivate();
  await cancel();
  const events = await facts();
  expect(events).toHaveLength(2);
  expect(events[0]).toEqual(old);
  expect(events[1].chave_idempotencia).toContain(":geracao:1:recorrencia:sub_reactivated");
});

test("QS-03: estender período após cancelamento não cria outro fato do mesmo ciclo", async () => {
  await cancel();
  await renewal();
  await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id: "sub_original" });
  expect(await facts()).toHaveLength(1);
});

test.each([
  ["2099-11-01", "2099-12-01"], ["2028-01-31", "2028-02-29"],
  ["2028-02-29", "2028-03-29"], ["2099-12-31", "2100-01-31"],
])("QS-04: primeira cobrança de DATE %s vira %s em qualquer TZ", async (paid, next) => {
  await db.query("UPDATE assinaturas SET status='PENDING',ativo=FALSE,asaas_subscription_id=NULL,data_proxima_cobranca=NULL WHERE id=$1", [sub.id]);
  await db.query("UPDATE pagamentos SET status='PENDING',data_pagamento=NULL,data_vencimento=$2 WHERE assinatura_id=$1", [sub.id, paid]);
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async (args) => ({ id: "sub_initial", nextDueDate: args.proximaCobranca }));
  await service.ativarAssinaturaPorPagamento(originalPayment, "RECEIVED", {
    paymentDate: paid, dueDate: paid, billingType: "PIX", value: 10,
    webhookEventoId: `evt_initial_${sub.id}`, webhookEventoCriadoEm: `${paid}T12:00:00.000Z`,
  });
  expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledWith(expect.objectContaining({ proximaCobranca: next }));
  expect((await state()).acesso_ate).toBe(next);
});

const testNative = global.__ownerAuditDb ? test.skip : test;
testNative("QS-01: confirmação e cancelamento serializam em duas conexões sem perder período ou intenção", async () => {
  const ready = deferred(), release = deferred(), paymentStarted = deferred();
  const originalCancel = repository.buscarAssinaturaParaCancelar;
  const originalFind = webhookRepository.buscarPorSubscriptionParaAtualizar;
  jest.spyOn(repository, "buscarAssinaturaParaCancelar").mockImplementation(async (...args) => {
    const current = await originalCancel(...args);
    ready.resolve();
    await release.promise;
    return current;
  });
  jest.spyOn(webhookRepository, "buscarPorSubscriptionParaAtualizar").mockImplementation(async (client, id) => {
    const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const pending = originalFind(client, id);
    paymentStarted.resolve(pid);
    return pending;
  });
  const observe = (promise) => promise.then((value) => ({ value }), (error) => ({ error }));
  const cancellation = observe(cancel());
  let payment;
  try {
    await ready.promise;
    payment = observe(renewal());
    const pid = await paymentStarted.promise;
    let blocked = false;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      blocked = (await db.query("SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked", [pid])).rows[0].blocked;
      if (blocked) break;
      await new Promise((done) => setTimeout(done, 10));
    }
    expect(blocked).toBe(true);
  } finally {
    release.resolve();
    await Promise.all([cancellation, payment].filter(Boolean));
  }
  const results = await Promise.all([cancellation, payment]);
  expect(results.every((result) => result && !result.error)).toBe(true);
  expect(await state()).toMatchObject({ status: "CANCELED", ativo: true, acesso_ate: "2100-01-01" });
  expect(await facts()).toHaveLength(1);
});
