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
const otherStudios = [];
beforeEach(async () => {
  for (const fn of Object.values(asaas)) fn.mockReset();
  asaas.buscarAssinaturaPorReferencia.mockResolvedValue(null);
  asaas.removerAssinaturaAsaas.mockResolvedValue({ removida: true });
  asaas.criarAssinaturaAsaas.mockResolvedValue({ id: "sub_reactivated", nextDueDate: "2099-12-01" });
  studio = await criarCenarioAgendamento(db, { prefixo: "owner-ninth-fix" });
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
  const other = await criarCenarioAgendamento(db, { prefixo: "owner-ninth-member" });
  otherStudios.push(other);
  await db.query("INSERT INTO usuarios_negocios(usuario_id,negocio_id,papel,ativo) VALUES($1,$2,'profissional',TRUE)", [other.profissional.id, studio.negocioId]);
  return other.profissional.id;
}
const memberState = async id => (await db.query("SELECT ativo,motivo_inatividade FROM usuarios_negocios WHERE negocio_id=$1 AND usuario_id=$2", [studio.negocioId,id])).rows[0];
const page = async () => serializarRespostaAssinatura(await service.buscarMinhaAssinatura({ usuarioId: studio.profissional.id }));
const flags = async () => (await db.query("SELECT renovacao_cancelada,acesso_pago_reconciliado FROM assinaturas WHERE id=$1",[sub.id])).rows[0];
const today = async () => (await db.query("SELECT TO_CHAR(CURRENT_DATE,'YYYY-MM-DD') AS day")).rows[0].day;


const webhook=require("../src/services/webhookService");
const send=(id,type,date,payment)=>webhook.processarWebhookAsaas({eventoId:id,tipoEvento:type,eventoCriadoEm:date,pagamento:payment});
beforeEach(()=>{jest.spyOn(require("../src/services/marketingConversionDeliveryService"),"enfileirarAssinaturaAtivadaSeguro").mockResolvedValue(null);});
async function initial(){
  await db.query("UPDATE assinaturas SET ativo=FALSE,status='CANCELED',renovacao_cancelada=TRUE,acesso_pago_ate=CURRENT_DATE-1 WHERE id=$1",[sub.id]);
  provider.get("sub_original").status="DELETED";
  await db.query("UPDATE pagamentos SET data_pagamento=(CURRENT_DATE-1)-INTERVAL '1 month',data_vencimento=(CURRENT_DATE-1)-INTERVAL '1 month' WHERE assinatura_id=$1",[sub.id]);
  await db.query("UPDATE negocios SET plano_id=(SELECT id FROM planos WHERE slug='inicial' AND ativo=TRUE LIMIT 1) WHERE id=$1",[studio.negocioId]);
  const paid=(await db.query("SELECT id FROM planos WHERE slug='autonoma' AND ativo=TRUE LIMIT 1")).rows[0].id;
  sub=await db.executarTransacao(client=>repository.criarAssinatura(client,{negocio_id:studio.negocioId,plano_id:paid,asaas_customer_id:"cus_audit",forma_pagamento:"pix",valor:10}));
  originalPayment=`pay_initial_${sub.id}`;
  await db.query("INSERT INTO pagamentos(assinatura_id,asaas_payment_id,status,valor,forma_pagamento,data_vencimento) VALUES($1,$2,'PENDING',10,'pix',CURRENT_DATE)",[sub.id,originalPayment]);
  return {id:originalPayment,status:"RECEIVED",value:10,billingType:"PIX",paymentDate:await today(),dueDate:await today()};
}
async function retryEvent(eventoId){
  const row=(await db.query("UPDATE webhook_eventos SET proxima_tentativa_em=NOW()-INTERVAL '1 second' WHERE evento_id=$1 RETURNING id",[eventoId])).rows[0];
  return webhook.processarEventoWebhook(row.id);
}

test("NV-01a: criação incerta seguida de estorno remove a recorrência sem restaurar o pagamento",async()=>{
  const payment=await initial(),day=await today(),eventId=`evt_initial_${sub.id}`;
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args=>{createExternal(args);throw new Error("Resposta perdida após POST aplicado");});
  await expect(send(eventId,"PAYMENT_RECEIVED",`${day} 09:00:00`,payment)).rejects.toThrow("perdida");
  await send(`evt_refund_${sub.id}`,"PAYMENT_REFUNDED",`${day} 10:00:00`,{...payment,status:"REFUNDED"});
  const retry=await retryEvent(eventId);
  const account=await page(),result=await worker();
  const stored=(await db.query("SELECT status,erro FROM webhook_eventos WHERE evento_id=$1",[eventId])).rows[0];
  expect(retry.status).toBe("IGNORED");
  expect(await state()).toMatchObject({status:"REFUNDED",ativo:false,asaas_subscription_id:null});
  expect(activeProvider()).toHaveLength(0);
  expect(asaas.buscarAssinaturaPorReferencia).toHaveBeenCalled();
  expect(asaas.removerAssinaturaAsaas).toHaveBeenCalledWith("sub_new_1");
  expect(account.renovacao_pendente).toBe(false);
});

test("controle NV-01: sem estorno, retry da criação inicial incerta consegue adotar a mesma recorrência",async()=>{
  const payment=await initial(),day=await today(),eventId=`evt_initial_control_${sub.id}`;
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args=>{createExternal(args);throw new Error("Resposta perdida");})
    .mockImplementation(async args=>activeProvider().find(item=>item.externalReference===args.externalReference)||createExternal(args));
  await expect(send(eventId,"PAYMENT_RECEIVED",`${day} 09:00:00`,payment)).rejects.toThrow("perdida");
  expect((await retryEvent(eventId)).status).toBe("PROCESSED");
  expect(await state()).toMatchObject({status:"ACTIVE",ativo:true,asaas_subscription_id:"sub_new_1"});
  expect(activeProvider()).toHaveLength(1);
});

test.each(["replay","worker"])("NV-01b: estorno preserva remoção pendente recuperada por %s",async mode=>{
  const oldId=sub.id,oldPayment=originalPayment,day=await today();
  await db.query("UPDATE pagamentos SET data_pagamento=CURRENT_DATE,data_vencimento=CURRENT_DATE WHERE assinatura_id=$1",[oldId]);
  await db.query("UPDATE assinaturas SET acesso_pago_ate=CURRENT_DATE+INTERVAL '1 month',data_proxima_cobranca=CURRENT_DATE+INTERVAL '1 month' WHERE id=$1",[oldId]);
  provider.get("sub_original").nextDueDate=(await state()).acesso_ate;
  const paid=(await db.query("SELECT id FROM planos WHERE slug='studio' AND ativo=TRUE LIMIT 1")).rows[0].id;
  const next=await db.executarTransacao(client=>repository.criarAssinatura(client,{negocio_id:studio.negocioId,plano_id:paid,asaas_customer_id:"cus_audit",forma_pagamento:"pix",valor:20}));
  const payNew=`pay_upgrade_${next.id}`,eventId=`evt_upgrade_${next.id}`;
  await db.query("INSERT INTO pagamentos(assinatura_id,asaas_payment_id,status,valor,forma_pagamento,data_vencimento) VALUES($1,$2,'PENDING',20,'pix',CURRENT_DATE)",[next.id,payNew]);
  asaas.removerAssinaturaAsaas.mockRejectedValueOnce(new Error("DELETE indisponível"));
  await expect(send(eventId,"PAYMENT_RECEIVED",`${day} 09:00:00`,{id:payNew,status:"RECEIVED",value:20,billingType:"PIX",paymentDate:day,dueDate:day})).rejects.toThrow("indisponível");
  const afterFailure=await state();
  await send(`evt_old_refund_${oldId}`,"PAYMENT_REFUNDED",`${day} 10:00:00`,{id:oldPayment,subscription:"sub_original",status:"REFUNDED",value:10,billingType:"PIX"});
  let retry;
  if(mode==="replay")retry=await retryEvent(eventId);
  else {await db.query("UPDATE assinatura_checkout_operacoes SET lease_ate=NULL,proxima_tentativa_em=NULL WHERE assinatura_id=$1",[oldId]);expect(await worker()).toMatchObject({checkoutsReconciliados:1,falhas:0});}
  const account=await page();
  if(retry)expect(retry.status).toBe("PROCESSED");
  expect(await state()).toMatchObject({status:"REFUNDED",ativo:false});
  expect(activeProvider()).toHaveLength(1);
  expect(asaas.removerAssinaturaAsaas.mock.calls).toEqual([["sub_original"],["sub_original"]]);
  expect(account.renovacao_pendente).toBe(false);
});

test.each(["presentes","omitidas","nulas"])("NV-02: atualização com datas %s preserva o dia factual e o acesso",async datesMode=>{
  const dates=(await db.query(`SELECT TO_CHAR((CURRENT_DATE+3)-INTERVAL '1 month','YYYY-MM-DD') AS paid,
    TO_CHAR(CURRENT_DATE+3,'YYYY-MM-DD') AS end,TO_CHAR(CURRENT_DATE,'YYYY-MM-DD') AS today,
    TO_CHAR(CURRENT_DATE+INTERVAL '1 month','YYYY-MM-DD') AS rewritten_end`)).rows[0];
  await db.query("UPDATE assinaturas SET acesso_pago_reconciliado=TRUE,acesso_pago_ate=CURRENT_DATE+3,data_proxima_cobranca=CURRENT_DATE+3 WHERE id=$1",[sub.id]);
  await db.query("UPDATE pagamentos SET data_pagamento=$2,data_vencimento=$2 WHERE assinatura_id=$1",[sub.id,dates.paid]);
  provider.get("sub_original").nextDueDate=dates.end;
  const before=await state();
  const payment={id:originalPayment,subscription:"sub_original",status:"RECEIVED",value:10,billingType:"PIX",dueDate:dates.paid,
    ...(datesMode==="presentes"?{paymentDate:dates.paid,confirmedDate:dates.paid}:datesMode==="nulas"?{paymentDate:null,confirmedDate:null}:{})};
  const result=await send(`evt_update_${sub.id}`,"PAYMENT_UPDATED",`${dates.today} 12:00:00`,payment);
  await send(`evt_update_again_${sub.id}`,"PAYMENT_UPDATED",`${dates.today} 13:00:00`,payment);
  const financial=(await db.query("SELECT status,TO_CHAR(data_pagamento,'YYYY-MM-DD') AS paid FROM pagamentos WHERE asaas_payment_id=$1",[originalPayment])).rows[0];
  expect(result.status).toBe("PROCESSED");
  expect(financial.paid).toBe(dates.paid);
  expect((await state()).acesso_ate).toBe(dates.end);
});

test("NV-03: lote cheio de falhas dá oportunidade ao negócio seguinte",async()=>{
  const originalBatch=process.env.BILLING_RECONCILIATION_BATCH_SIZE;
  process.env.BILLING_RECONCILIATION_BATCH_SIZE="1";
  try{
    await db.query(`UPDATE assinaturas SET status='REACTIVATING',reativacao_tentativa=1,asaas_customer_id=NULL,
      reativacao_inicio_cobranca='2099-12-01',acesso_pago_ate='2099-12-01',updated_at=NOW()-INTERVAL '10 minutes' WHERE id=$1`,[sub.id]);
    const other=await criarCenarioAgendamento(db,{prefixo:"owner-ninth-fairness"});otherStudios.push(other);
    const plan=(await db.query("SELECT plano_id FROM assinaturas WHERE id=$1",[sub.id])).rows[0].plano_id;
    await db.query("UPDATE negocios SET plano_id=$2 WHERE id=$1",[other.negocioId,plan]);
    const good=(await db.query(`INSERT INTO assinaturas(negocio_id,plano_id,asaas_customer_id,asaas_subscription_id,status,
      forma_pagamento,valor,data_proxima_cobranca,acesso_pago_ate,ativo,reativacao_tentativa,reativacao_inicio_cobranca,updated_at)
      VALUES($1,$2,'cus_good','sub_good_old','REACTIVATING','pix',10,'2099-12-01','2099-12-01',TRUE,1,'2099-12-01',NOW()-INTERVAL '10 minutes') RETURNING id`,[other.negocioId,plan])).rows[0];
    createExternal({customerId:"cus_good",externalReference:`assinatura-reativada:${good.id};tentativa:1;inicio:2099-12-01`,proximaCobranca:"2099-12-01"});
    const cycles=[];
    for(let i=0;i<3;i++){
      // O intervalo padrão de cinco minutos vence a concessão de dois minutos.
      await db.query("UPDATE assinatura_renovacao_operacoes SET lease_ate=NOW()-INTERVAL '1 second',proxima_tentativa_em=NOW()-INTERVAL '1 second' WHERE assinatura_id=$1",[sub.id]);
      cycles.push({eligible:await renovacaoRepository.listarNegociosPendentes(2),result:await worker()});
    }
    const waiting=(await db.query("SELECT status,asaas_subscription_id FROM assinaturas WHERE id=$1",[good.id])).rows[0];
    const lookupsBefore=asaas.buscarAssinaturaPorReferencia.mock.calls.length;
    await service.buscarMinhaAssinatura({usuarioId:other.profissional.id});
    const afterRead=(await db.query("SELECT status,asaas_subscription_id FROM assinaturas WHERE id=$1",[good.id])).rows[0];
    expect(cycles[0].result).toMatchObject({candidatos:1,renovacoesReconciliadas:0,falhas:1});
    expect(cycles[1].result).toMatchObject({candidatos:1,renovacoesReconciliadas:1,falhas:0});
    expect(waiting).toMatchObject({status:"ACTIVE",asaas_subscription_id:"sub_new_1"});
    expect(lookupsBefore).toBe(1);
    expect(afterRead).toMatchObject({status:"ACTIVE",asaas_subscription_id:"sub_new_1"});
  }finally{
    if(originalBatch===undefined)delete process.env.BILLING_RECONCILIATION_BATCH_SIZE;
    else process.env.BILLING_RECONCILIATION_BATCH_SIZE=originalBatch;
  }
});

const checkoutOperacoes = require("../src/repositories/assinaturaCheckoutRepository");
const ageCheckout = () => db.query(`UPDATE assinatura_checkout_operacoes
  SET lease_ate=NOW()-INTERVAL '1 second', proxima_tentativa_em=NOW()-INTERVAL '1 second'
  WHERE assinatura_id=$1`, [sub.id]);
const checkoutState = async () => (await db.query(`SELECT * FROM assinatura_checkout_operacoes
  WHERE assinatura_id=$1 ORDER BY id`, [sub.id])).rows;

test.each(["GET", "worker"])("NV-01: %s recupera criação incerta estornada sem replay da confirmação", async mode => {
  const payment = await initial(), day = await today();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args => {
    createExternal(args); throw new Error("POST aplicado, resposta perdida");
  });
  await expect(send(`evt_create_${sub.id}`, "PAYMENT_RECEIVED", `${day} 09:00:00`, payment)).rejects.toThrow("perdida");
  await send(`evt_refund_${sub.id}`, "PAYMENT_REFUNDED", `${day} 10:00:00`, { ...payment, status: "REFUNDED" });
  expect(await renovacaoRepository.possuiPendente(studio.negocioId)).toBe(true);
  await ageCheckout();
  if (mode === "GET") await page();
  else expect(await worker()).toMatchObject({checkoutsReconciliados: 1, falhas: 0});
  expect(activeProvider()).toHaveLength(0);
  expect(await state()).toMatchObject({status:"REFUNDED",ativo:false,asaas_subscription_id:null});
  expect(await checkoutState()).toEqual([expect.objectContaining({estado:"CANCELED",asaas_subscription_id:"sub_new_1"})]);
  expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledTimes(1);
});

test.each([false, true])("NV-01: DELETE incerto, aplicado=%s, mantém a remoção até confirmação", async applied => {
  const payment = await initial(), day = await today(), event = `evt_create_${sub.id}`;
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args => {createExternal(args);throw new Error("POST incerto");});
  await expect(send(event,"PAYMENT_RECEIVED",`${day} 09:00:00`,payment)).rejects.toThrow("incerto");
  await send(`evt_refund_${sub.id}`,"PAYMENT_REFUNDED",`${day} 10:00:00`,{...payment,status:"REFUNDED"});
  asaas.removerAssinaturaAsaas.mockImplementationOnce(async id => {
    if(applied)provider.get(id).status="DELETED";
    throw new Error("DELETE incerto");
  });
  await ageCheckout();
  expect(await worker()).toMatchObject({falhas:1});
  expect(await checkoutState()).toEqual([expect.objectContaining({estado:"REMOVING",ultimo_erro_codigo:"REMOCAO_ASAAS_FALHOU"})]);
  expect(await renovacaoRepository.possuiPendente(studio.negocioId)).toBe(true);
  const fila=(await require("../src/repositories/operationalMetricsRepository").buscarFilas()).find(item=>item.fila==="checkouts_assinatura");
  expect(fila).toMatchObject({pendentes:1,falhas:1});
  expect(fila.mais_antigo_em).toBeTruthy();
  await ageCheckout();
  expect(await worker()).toMatchObject({checkoutsReconciliados:1,falhas:0});
  expect(activeProvider()).toHaveLength(0);
  expect(asaas.removerAssinaturaAsaas.mock.calls).toEqual([["sub_new_1"],["sub_new_1"]]);
});

test("NV-01: worker adota a criação válida após timeout sem criar outra recorrência",async()=>{
  const payment=await initial(),day=await today();
  asaas.criarAssinaturaAsaas.mockImplementationOnce(async args=>{createExternal(args);throw new Error("POST incerto");});
  await expect(send(`evt_create_${sub.id}`,"PAYMENT_RECEIVED",`${day} 09:00:00`,payment)).rejects.toThrow("incerto");
  await ageCheckout();
  expect(await worker()).toMatchObject({checkoutsReconciliados:1,falhas:0});
  expect(await state()).toMatchObject({status:"ACTIVE",ativo:true,asaas_subscription_id:"sub_new_1"});
  expect((await page()).uso.plano_slug).toBe("autonoma");
  expect(activeProvider()).toHaveLength(1);
  expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledTimes(1);
  expect((await checkoutState())[0].estado).toBe("COMPLETED");
});

test("NV-01: consulta vazia com pagamento válido mantém replay recuperável sem POST pelo worker",async()=>{
  const payment=await initial(),day=await today(),event=`evt_create_${sub.id}`;
  asaas.criarAssinaturaAsaas.mockRejectedValueOnce(new Error("POST não aplicado"));
  await expect(send(event,"PAYMENT_RECEIVED",`${day} 09:00:00`,payment)).rejects.toThrow("não aplicado");
  await ageCheckout(); await worker();
  expect((await checkoutState())[0].estado).toBe("PENDING");
  expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledTimes(1);
  expect((await retryEvent(event)).status).toBe("PROCESSED");
  expect(activeProvider()).toHaveLength(1);
  expect((await checkoutState())[0].estado).toBe("COMPLETED");
});

test("NV-01: criação tardia após estorno e consulta de ausência reabre obrigação sem ativar acesso",async()=>{
  const payment=await initial(),day=await today();
  asaas.criarAssinaturaAsaas.mockRejectedValueOnce(new Error("POST incerto"));
  await expect(send(`evt_create_${sub.id}`,"PAYMENT_RECEIVED",`${day} 09:00:00`,payment)).rejects.toThrow("incerto");
  const args=asaas.criarAssinaturaAsaas.mock.calls[0][0];
  await send(`evt_refund_${sub.id}`,"PAYMENT_REFUNDED",`${day} 10:00:00`,{...payment,status:"REFUNDED"});
  await ageCheckout(); await worker();
  expect((await checkoutState())[0].estado).toBe("CANCELED");
  const late=createExternal(args);
  await service.sincronizarAssinaturaPorWebhook("SUBSCRIPTION_CREATED",late);
  expect((await checkoutState())[0].estado).toBe("REMOVING");
  expect(await state()).toMatchObject({status:"REFUNDED",ativo:false,asaas_subscription_id:null});
  await worker();
  expect(activeProvider()).toHaveLength(0);
});

test("NV-01: versão antiga não conclui nem remove a execução mais recente",async()=>{
  const payment=await initial(),day=await today();
  asaas.criarAssinaturaAsaas.mockRejectedValueOnce(new Error("POST incerto"));
  await expect(send(`evt_create_${sub.id}`,"PAYMENT_RECEIVED",`${day} 09:00:00`,payment)).rejects.toThrow("incerto");
  const old=(await checkoutState())[0];
  await ageCheckout();const current=await checkoutOperacoes.reservar(old.id);
  expect(await checkoutOperacoes.mudarEstado(db,old,"CANCELED")).toBeNull();
  await checkoutOperacoes.registrarFalha(old,"CONSULTA_ASAAS_FALHOU");
  expect((await checkoutState())[0]).toMatchObject({execucao_versao:current.execucao_versao,estado:"PENDING",ultimo_erro_codigo:"CRIACAO_ASAAS_FALHOU"});
});

(global.__ownerAuditDb ? test.skip : test)("NV-01 nativo: dois executores disputam a mesma operação de checkout",async()=>{
  const payment=await initial(),day=await today();
  asaas.criarAssinaturaAsaas.mockRejectedValueOnce(new Error("POST incerto"));
  await expect(send(`evt_create_${sub.id}`,"PAYMENT_RECEIVED",`${day} 09:00:00`,payment)).rejects.toThrow("incerto");
  await ageCheckout();const op=(await checkoutState())[0];
  const claims=await Promise.all([db.executarTransacao(c=>checkoutOperacoes.reservar(op.id,{},c)),db.executarTransacao(c=>checkoutOperacoes.reservar(op.id,{},c))]);
  expect(claims.filter(Boolean)).toHaveLength(1);
});
