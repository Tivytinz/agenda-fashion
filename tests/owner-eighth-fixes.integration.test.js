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
const { calcularProximaCobranca } = require("../src/services/assinaturaCalculos");
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let studio, sub, originalPayment;
const otherStudios = [];
beforeEach(async () => {
  for (const fn of Object.values(asaas)) fn.mockReset();
  asaas.buscarAssinaturaPorReferencia.mockResolvedValue(null);
  asaas.removerAssinaturaAsaas.mockResolvedValue({ removida: true });
  asaas.criarAssinaturaAsaas.mockResolvedValue({ id: "sub_reactivated", nextDueDate: "2099-12-01" });
  studio = await criarCenarioAgendamento(db, { prefixo: "owner-eighth-fix" });
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
  if (studio) {
    await db.query("DELETE FROM analytics_eventos WHERE target_business_id=$1", [studio.negocioId]);
    await removerCenarioAgendamento(db, studio);
  }
  for (const other of otherStudios.splice(0)) await removerCenarioAgendamento(db, other);
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


async function member() {
  const other = await criarCenarioAgendamento(db, { prefixo: "owner-eighth-member" });
  otherStudios.push(other);
  await db.query("INSERT INTO usuarios_negocios(usuario_id,negocio_id,papel,ativo) VALUES($1,$2,'profissional',TRUE)", [other.profissional.id, studio.negocioId]);
  return other.profissional.id;
}
const memberState = async id => (await db.query("SELECT ativo,motivo_inatividade FROM usuarios_negocios WHERE negocio_id=$1 AND usuario_id=$2", [studio.negocioId,id])).rows[0];
const page = async () => serializarRespostaAssinatura(await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id }));
const flags = async () => (await db.query("SELECT renovacao_cancelada,acesso_pago_reconciliado FROM assinaturas WHERE id=$1",[sub.id])).rows[0];
const today = async () => (await db.query("SELECT TO_CHAR(CURRENT_DATE,'YYYY-MM-DD') AS day")).rows[0].day;

test("OT-01: exclusão após expiração e recebimento tardio preservam renovação cancelada até ação explícita", async () => {
  await cancel();
  await db.query("UPDATE assinaturas SET acesso_pago_ate=CURRENT_DATE-1,data_proxima_cobranca=CURRENT_DATE-1 WHERE id=$1",[sub.id]);
  await db.query("UPDATE pagamentos SET data_pagamento=(CURRENT_DATE-1)-INTERVAL '1 month',data_vencimento=(CURRENT_DATE-1)-INTERVAL '1 month' WHERE assinatura_id=$1",[sub.id]);
  await worker();
  await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED", { id:"sub_original",status:"DELETED" });
  const paidLate=(await db.query("SELECT TO_CHAR(CURRENT_DATE-2,'YYYY-MM-DD') AS day")).rows[0].day;
  await service.ativarAssinaturaPorPagamento(`pay_late_${sub.id}`,"RECEIVED",{subscription:"sub_original",value:10,billingType:"PIX",paymentDate:paidLate,dueDate:paidLate});
  expect(await state()).toMatchObject({status:"CANCELED",ativo:true,asaas_subscription_id:"sub_original"});
  expect((await page()).estado_assinatura.codigo).toBe("CANCELAMENTO_AGENDADO");
  expect((await page()).assinatura).not.toHaveProperty("renovacao_cancelada");
  expect((await page()).assinatura).not.toHaveProperty("acesso_pago_reconciliado");
  expect((await flags()).renovacao_cancelada).toBe(true);
  expect(activeProvider()).toHaveLength(0);
  expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
  await reactivate();
  expect(activeProvider()).toEqual([expect.objectContaining({id:"sub_new_1",nextDueDate:(await state()).acesso_ate})]);
  expect((await flags()).renovacao_cancelada).toBe(false);
});

test.each(["REFUNDED","OVERDUE","CHARGEBACK_REQUESTED"])("OT-01: %s e recebimento posterior não apagam a intenção de cancelamento",async status=>{
  await cancel(); await suspend(status);
  expect(await state()).toMatchObject({status,ativo:false});
  expect((await flags()).renovacao_cancelada).toBe(true);
  await renewal();
  expect(await state()).toMatchObject({status:"CANCELED",ativo:true,acesso_ate:"2100-01-01"});
  expect((await page()).estado_assinatura.codigo).toBe("CANCELAMENTO_AGENDADO");
  expect(activeProvider()).toHaveLength(0);
  expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
});

test("OT-01: reconhecimento de exclusão preserva a suspensão financeira e sua intenção independente",async()=>{
  await cancel(); await suspend("REFUNDED");
  await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_DELETED",{id:"sub_original",nextDueDate:"2099-12-01"});
  expect(await state()).toMatchObject({status:"REFUNDED",ativo:false});
  expect((await flags()).renovacao_cancelada).toBe(true);
  expect((await page()).estado_assinatura.codigo).toBe("FALHA_DE_PAGAMENTO");
});

test.each(["SUBSCRIPTION_INACTIVATED","SUBSCRIPTION_UPDATED"])("OT-02: %s inativa só a renovação, preserva o acesso e remove a anterior antes da nova",async type=>{
  const person=await member();
  await db.query("UPDATE assinaturas SET acesso_pago_ate=data_proxima_cobranca WHERE id=$1",[sub.id]);
  provider.get("sub_original").status="INACTIVE";
  await service.sincronizarAssinaturaPorWebhook(type,{id:"sub_original",status:"INACTIVE",nextDueDate:"2099-12-01"});
  expect(await state()).toMatchObject({status:"CANCELED",ativo:true,acesso_ate:"2099-12-01"});
  expect((await page()).uso.plano_slug).toBe("autonoma");
  expect(await memberState(person)).toMatchObject({ativo:true});
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args=>{
    expect(provider.get("sub_original").status).toBe("DELETED"); return createExternal(args);
  });
  await reactivate();
  expect(activeProvider()).toEqual([expect.objectContaining({id:"sub_new_1",nextDueDate:"2099-12-01"})]);
  expect(await memberState(person)).toMatchObject({ativo:true});
  await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_INACTIVATED",{id:"sub_original",status:"INACTIVE"});
  expect(await state()).toMatchObject({status:"ACTIVE",asaas_subscription_id:"sub_new_1"});
});

test("OT-02: falha ao remover a recorrência inativa impede criação e permite nova tentativa após conferência",async()=>{
  provider.get("sub_original").status="INACTIVE";
  await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_INACTIVATED",{id:"sub_original",status:"INACTIVE"});
  asaas.removerAssinaturaAsaas.mockRejectedValueOnce(new Error("DELETE incerto"));
  await expect(reactivate()).rejects.toThrow("incerto");
  expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
  expect(await renovacaoRepository.possuiPendente(studio.negocioId)).toBe(true);
  await age(); await page();
  expect(await state()).toMatchObject({status:"CANCELED",ativo:true});
  await reactivate();
  expect(activeProvider()).toHaveLength(1);
  expect(provider.get("sub_original").status).toBe("DELETED");
});

test("recebimento de uma tentativa sem ID anterior preserva o fato sem criar recorrência pela confirmação",async()=>{
  provider.get("sub_original").status="DELETED";
  await db.query("UPDATE assinaturas SET status='CANCELED',renovacao_cancelada=TRUE,asaas_subscription_id=NULL,acesso_pago_ate=data_proxima_cobranca WHERE id=$1",[sub.id]);
  const started=deferred(),release=deferred();
  let external;
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args=>{
    external=createExternal(args);started.resolve();await release.promise;return external;
  });
  const pending=reactivate();
  await started.promise;
  try{
    await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_CREATED",external);
    await service.ativarAssinaturaPorPagamento(`pay_during_${sub.id}`,"RECEIVED",{
      subscription:external.id,billingType:"PIX",value:10,paymentDate:"2099-12-01",dueDate:"2099-12-01",
    });
    expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledTimes(1);
    expect(await state()).toMatchObject({status:"REACTIVATING",acesso_ate:"2100-01-01"});
  }finally{release.resolve();}
  await pending;
  expect(activeProvider()).toEqual([expect.objectContaining({id:"sub_new_2",nextDueDate:"2100-01-01"})]);
});

test("OT-03: webhook de ciclo vencido não restaura acesso estornado; recebimento novo restaura",async()=>{
  const dates=(await db.query(`SELECT TO_CHAR(CURRENT_DATE,'YYYY-MM-DD') AS today,
    TO_CHAR(CURRENT_DATE-INTERVAL '1 month','YYYY-MM-DD') AS old_paid,
    TO_CHAR(CURRENT_DATE+INTERVAL '1 month','YYYY-MM-DD') AS new_end`)).rows[0];
  // No fim do mês, SET/OUT 30→31 não é inversível: a cobertura
  // do pagamento antigo termina no dia realmente calculado pelo contrato.
  const oldCoverageEnd = calcularProximaCobranca(dates.old_paid);
  expect(oldCoverageEnd <= dates.today).toBe(true);
  await db.query("UPDATE assinaturas SET acesso_pago_ate=CURRENT_DATE,data_proxima_cobranca=CURRENT_DATE WHERE id=$1",[sub.id]);
  await db.query(`UPDATE pagamentos SET data_pagamento=CURRENT_DATE-INTERVAL '1 month',data_vencimento=CURRENT_DATE-INTERVAL '1 month',
    asaas_ultimo_evento_em=$2::timestamp,asaas_ultimo_evento_id=$3 WHERE assinatura_id=$1`,[sub.id,`${dates.old_paid} 09:00:00`,`evt_old_confirmed_${sub.id}`]);
  const webhook=require("../src/services/webhookService");
  jest.spyOn(require("../src/services/marketingConversionDeliveryService"),"enfileirarAssinaturaAtivadaSeguro").mockResolvedValue(null);
  const currentId=`pay_current_${sub.id}`;
  const payment={id:currentId,subscription:"sub_original",value:10,billingType:"PIX",dueDate:dates.today,paymentDate:dates.today};
  const send=(eventoId,tipoEvento,eventoCriadoEm,pagamento)=>webhook.processarWebhookAsaas({eventoId,tipoEvento,eventoCriadoEm,pagamento});
  await send(`evt_current_received_${sub.id}`,"PAYMENT_RECEIVED",`${dates.today} 09:00:00`,{...payment,status:"RECEIVED"});
  await send(`evt_current_refunded_${sub.id}`,"PAYMENT_REFUNDED",`${dates.today} 10:00:00`,{...payment,status:"REFUNDED"});
  expect(await state()).toMatchObject({status:"REFUNDED",ativo:false,acesso_ate:oldCoverageEnd});
  const replay=await send(`evt_old_received_${sub.id}`,"PAYMENT_RECEIVED",`${dates.old_paid} 09:01:00`,
    {...payment,id:originalPayment,status:"RECEIVED",dueDate:dates.old_paid,paymentDate:dates.old_paid});
  expect(replay.status).toBe("IGNORED");
  expect(await state()).toMatchObject({status:"REFUNDED",ativo:false,acesso_ate:oldCoverageEnd});
  expect((await page()).uso.plano_slug).toBe("inicial");
  await expect(cancel()).rejects.toMatchObject({status:404});
  expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
  expect((await db.query("SELECT status FROM pagamentos WHERE asaas_payment_id=$1",[currentId])).rows[0].status).toBe("REFUNDED");
  await send(`evt_new_received_${sub.id}`,"PAYMENT_RECEIVED",`${dates.today} 11:00:00`,{...payment,id:`pay_genuine_${sub.id}`,status:"RECEIVED"});
  expect(await state()).toMatchObject({status:"ACTIVE",ativo:true,acesso_ate:dates.new_end});
  expect((await page()).uso.plano_slug).toBe("autonoma");
});

test.each(["REFUNDED","RECEIVED_IN_CASH_UNDONE","CHARGEBACK_DISPUTE"])("OT-03: reversão %s sem outra cobertura não transforma programação futura em acesso",async status=>{
  await cancel(); await suspend(status);
  expect((await flags()).acesso_pago_reconciliado).toBe(true);
  const raw=(await db.query("SELECT acesso_pago_ate FROM assinaturas WHERE id=$1",[sub.id])).rows[0];
  expect(raw.acesso_pago_ate).toBeNull();
  expect((await page()).uso.plano_slug).toBe("inicial");
  await expect(reactivate()).rejects.toMatchObject({status:409});
  expect(activeProvider()).toHaveLength(0);
});

test("OT-03: estorno de cobrança antiga preserva outro recebimento vigente e a equipe",async()=>{
  const person=await member(); await renewal();
  await suspend("REFUNDED");
  expect(await state()).toMatchObject({status:"ACTIVE",ativo:true,acesso_ate:"2100-01-01"});
  expect((await page()).uso.plano_slug).toBe("autonoma");
  expect(await memberState(person)).toMatchObject({ativo:true});
  const events=(await db.query("SELECT tipo FROM assinatura_eventos WHERE assinatura_id=$1 AND tipo='REVERSAO_FINANCEIRA'",[sub.id])).rows;
  expect(events).toHaveLength(1);
  await suspend("REFUNDED");
  expect((await db.query("SELECT id FROM assinatura_eventos WHERE assinatura_id=$1 AND tipo='REVERSAO_FINANCEIRA'",[sub.id])).rows).toHaveLength(1);
});

test("OT-03: pagamentos no mesmo período preservam cobertura enquanto um deles continua válido",async()=>{
  await service.ativarAssinaturaPorPagamento(`pay_other_${sub.id}`,"RECEIVED",{subscription:"sub_original",value:10,billingType:"PIX",dueDate:"2099-11-01",paymentDate:"2099-11-01"});
  await suspend("REFUNDED");
  expect(await state()).toMatchObject({status:"ACTIVE",ativo:true,acesso_ate:"2099-12-01"});
});

test.each([false,true])("checkout novo só cria recorrência com período recebido vigente, vencido=%s",async vencido=>{
  const planoId=(await db.query("SELECT plano_id FROM assinaturas WHERE id=$1",[sub.id])).rows[0].plano_id;
  const initial=await db.executarTransacao(client=>repository.criarAssinatura(client,{
    negocio_id:studio.negocioId,plano_id:planoId,asaas_customer_id:"cus_audit",forma_pagamento:"pix",valor:10,
  }));
  const date=vencido ? (await db.query("SELECT TO_CHAR(CURRENT_DATE-INTERVAL '1 month','YYYY-MM-DD') AS day")).rows[0].day : "2099-11-01";
  const paymentId=`pay_initial_${initial.id}`;
  await db.query("INSERT INTO pagamentos(assinatura_id,asaas_payment_id,status,valor,forma_pagamento,data_vencimento) VALUES($1,$2,'PENDING',10,'pix',$3)",[initial.id,paymentId,date]);
  const result=await service.ativarAssinaturaPorPagamento(paymentId,"RECEIVED",{billingType:"PIX",value:10,dueDate:date,paymentDate:date,webhookEventoId:`evt_initial_${initial.id}`});
  if(vencido){
    expect(result).toBeNull();
    expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
    expect((await db.query("SELECT ativo FROM assinaturas WHERE id=$1",[initial.id])).rows[0].ativo).toBe(false);
  }else{
    expect(result).toMatchObject({status:"ACTIVE",ativo:true,acesso_pago_reconciliado:true});
    expect(activeProvider()).toEqual([expect.objectContaining({id:result.asaas_subscription_id,nextDueDate:"2099-12-01"})]);
  }
});

test("OT-04: falha de lookup permanece durável e aparece no worker e na saúde; recuperação posterior conclui",async()=>{
  await cancel();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args=>{createExternal(args);throw new Error("Resposta perdida");});
  await expect(reactivate()).rejects.toThrow("perdida");
  await age();
  await db.query("UPDATE assinatura_renovacao_operacoes SET criado_em=NOW()-INTERVAL '10 minutes' WHERE assinatura_id=$1",[sub.id]);
  asaas.buscarAssinaturaPorReferencia.mockRejectedValueOnce(new Error("Corpo privado do provedor"));
  const metrics=require("../src/services/operationalMetricsService"); metrics.limparMetricasParaTeste();
  expect(await worker()).toMatchObject({renovacoesReconciliadas:0,falhas:1});
  let health=await require("../src/services/operationalHealthService").obterSaudeOperacional();
  expect(health.workers.find(w=>w.nome==="billing_reconciliation")).toMatchObject({falhas:1,ultimoSucessoEm:null});
  expect(health.filas.find(f=>f.nome==="renovacoes_assinatura")).toMatchObject({pendentes:1,falhas:1});
  expect(health.filas.find(f=>f.nome==="renovacoes_assinatura").atrasoMaisAntigoSegundos).toBeGreaterThanOrEqual(599);
  expect(JSON.stringify(health)).not.toContain("Corpo privado");
  expect((await db.query("SELECT ultimo_erro_codigo FROM assinatura_renovacao_operacoes WHERE assinatura_id=$1",[sub.id])).rows[0].ultimo_erro_codigo).toBe("CONSULTA_ASAAS_FALHOU");
  await age(); expect(await worker()).toMatchObject({renovacoesReconciliadas:1,falhas:0});
  health=await require("../src/services/operationalHealthService").obterSaudeOperacional();
  expect(health.filas.find(f=>f.nome==="renovacoes_assinatura")).toMatchObject({pendentes:0,falhas:0});
  expect(health.workers.find(w=>w.nome==="billing_reconciliation").ultimoErro).toBeNull();
  expect((await state()).status).toBe("ACTIVE");
});

test("OT-04: falha de remoção é contabilizada e o retry remove o mesmo ID",async()=>{
  await cancel();
  const started=deferred(),release=deferred();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args=>{const item=createExternal(args);started.resolve();await release.promise;return item;});
  const pending=reactivate().then(value=>({value}),error=>({error}));
  await started.promise; await renewal();
  asaas.removerAssinaturaAsaas.mockRejectedValueOnce(new Error("DELETE falhou"));
  release.resolve(); expect((await pending).error).toBeDefined();
  await age(); asaas.removerAssinaturaAsaas.mockRejectedValueOnce(new Error("DELETE falhou novamente"));
  expect(await worker()).toMatchObject({falhas:1,renovacoesReconciliadas:0});
  expect((await db.query("SELECT estado,ultimo_erro_codigo FROM assinatura_renovacao_operacoes WHERE assinatura_id=$1",[sub.id])).rows[0])
    .toMatchObject({estado:"REMOVING",ultimo_erro_codigo:"REMOCAO_ASAAS_FALHOU"});
  await age(); expect(await worker()).toMatchObject({falhas:0,renovacoesReconciliadas:1});
  expect(activeProvider()).toHaveLength(0);
});

test("OT-04: erro de execução obsoleta não marca a geração assumida por outra execução",async()=>{
  await cancel();
  asaas.criarAssinaturaAsaas.mockRejectedValueOnce(new Error("Timeout"));
  await expect(reactivate()).rejects.toThrow("Timeout");
  await age();
  const old=(await db.query("SELECT * FROM assinatura_renovacao_operacoes WHERE assinatura_id=$1",[sub.id])).rows[0];
  await db.executarTransacao(client=>renovacaoRepository.reservarExecucao(client,sub.id,old.tentativa));
  expect(await renovacaoRepository.registrarFalha(old,"CONSULTA_ASAAS_FALHOU")).toBeNull();
  expect((await db.query("SELECT ultima_falha_em FROM assinatura_renovacao_operacoes WHERE assinatura_id=$1",[sub.id])).rows[0].ultima_falha_em).toBeNull();
});

test("OT-04: falta de cliente mantém a pendência e aparece como falha de contexto",async()=>{
  await cancel();
  asaas.criarAssinaturaAsaas.mockRejectedValueOnce(new Error("Timeout"));
  await expect(reactivate()).rejects.toThrow("Timeout");
  await db.query("UPDATE assinaturas SET asaas_customer_id=NULL WHERE id=$1",[sub.id]);
  await age();
  expect(await worker()).toMatchObject({falhas:1,renovacoesReconciliadas:0});
  expect(await renovacaoRepository.possuiPendente(studio.negocioId)).toBe(true);
  expect((await db.query("SELECT ultimo_erro_codigo FROM assinatura_renovacao_operacoes WHERE assinatura_id=$1",[sub.id])).rows[0].ultimo_erro_codigo)
    .toBe("CONTEXTO_INDISPONIVEL");
});
