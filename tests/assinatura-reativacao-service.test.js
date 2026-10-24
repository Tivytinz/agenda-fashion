let mockEmTransacao = false;
const mockClient = { query: jest.fn() };
jest.mock("../src/db/db", () => ({ executarTransacao: jest.fn(async callback => {
  mockEmTransacao = true;
  try { return await callback(mockClient); } finally { mockEmTransacao = false; }
}) }));
jest.mock("../src/repositories/assinaturaRepository");
jest.mock("../src/repositories/assinaturaRenovacaoRepository");
jest.mock("../src/services/asaasService", () => ({
  criarAssinaturaAsaas: jest.fn(), buscarAssinaturaPorReferencia: jest.fn(), removerAssinaturaAsaas: jest.fn(),
}));
jest.mock("../src/utils/registrador", () => ({ aviso: jest.fn() }));
const repository = require("../src/repositories/assinaturaRepository");
const operacoes = require("../src/repositories/assinaturaRenovacaoRepository");
const asaas = require("../src/services/asaasService");
const { reativarMinhaAssinatura, reconciliarReativacaoAbandonada } = require("../src/services/assinaturaReativacaoService");
const cancelada = () => ({ id: 20, negocio_id: 7, plano_id: 2, status: "CANCELED", ativo: true,
  forma_pagamento: "pix", asaas_customer_id: "cus_1", asaas_subscription_id: "sub_antiga", valor: "10.00",
  data_proxima_cobranca: "2099-12-01", acesso_pago_ate: "2099-12-01", reativacao_tentativa: 0 });
const operacao = () => ({ assinatura_id: 20, tentativa: 1, execucao_versao: 1, estado: "PENDING",
  inicio_cobranca: "2099-12-01", referencia_externa: "assinatura-reativada:20;tentativa:1;inicio:2099-12-01" });
const reservada = () => ({ ...cancelada(), status: "REACTIVATING", reativacao_tentativa: 1,
  reativacao_inicio_cobranca: "2099-12-01", execucao_versao: 1 });
beforeEach(() => {
  jest.clearAllMocks();
  mockEmTransacao = false;
  repository.buscarNegocioDono.mockResolvedValue({ id: 7 });
  repository.expirarCancelamentoSeNecessario.mockResolvedValue(null);
  repository.buscarAssinaturaAtivaPorNegocio.mockResolvedValue(cancelada());
  repository.buscarPlano.mockResolvedValue({ nome: "Autônoma" });
  repository.reservarReativacao.mockResolvedValue(reservada());
  repository.listarPagamentos.mockResolvedValue([]);
  repository.registrarReativacao.mockResolvedValue({ ...cancelada(), status: "ACTIVE", asaas_subscription_id: "sub_nova" });
  repository.restaurarCancelamentoReativacao.mockResolvedValue(cancelada());
  operacoes.buscarPendente.mockResolvedValue(null);
  operacoes.possuiPendente.mockResolvedValue(false);
  operacoes.registrarRecorrencia.mockResolvedValue(operacao());
  operacoes.bloquearContexto.mockResolvedValue({ assinatura: { ...reservada(), periodo_pago_valido: true }, operacao: operacao() });
  operacoes.concluir.mockResolvedValue(operacao());
  asaas.criarAssinaturaAsaas.mockImplementation(async () => {
    expect(mockEmTransacao).toBe(false);
    return { id: "sub_nova", status: "ACTIVE", nextDueDate: "2099-12-01" };
  });
  asaas.buscarAssinaturaPorReferencia.mockImplementation(async () => {
    expect(mockEmTransacao).toBe(false);
    return { id: "sub_nova", status: "ACTIVE", nextDueDate: "2099-12-01" };
  });
  asaas.removerAssinaturaAsaas.mockImplementation(async () => {
    expect(mockEmTransacao).toBe(false); return { removida: true };
  });
});
function pendente() {
  operacoes.buscarPendente.mockResolvedValue({ ...reservada(), operacao_tentativa: 1 });
  operacoes.reservarExecucao.mockResolvedValue(operacao());
}

test("reativa na data paga e confirma a operação sem manter HTTP em transação", async () => {
  expect((await reativarMinhaAssinatura({ usuarioId: 10 })).assinatura.status).toBe("ACTIVE");
  expect(asaas.criarAssinaturaAsaas).toHaveBeenCalledWith(expect.objectContaining({
    proximaCobranca: "2099-12-01", externalReference: operacao().referencia_externa,
    reutilizarPorExternalReference: true,
  }));
  expect(operacoes.concluir).toHaveBeenCalledWith(mockClient, operacao(), "COMPLETED");
  expect(asaas.removerAssinaturaAsaas).toHaveBeenCalledWith("sub_antiga");
  expect(asaas.removerAssinaturaAsaas.mock.invocationCallOrder[0])
    .toBeLessThan(asaas.criarAssinaturaAsaas.mock.invocationCallOrder[0]);
});

test("recupera uma criação existente usando a referência congelada", async () => {
  pendente();
  expect((await reconciliarReativacaoAbandonada(7)).status).toBe("ACTIVE");
  expect(asaas.buscarAssinaturaPorReferencia).toHaveBeenCalledWith({ externalReference: operacao().referencia_externa, customerId: "cus_1" });
  expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
});

test("ausência confirmada restaura cancelamento e encerra a obrigação", async () => {
  pendente(); asaas.buscarAssinaturaPorReferencia.mockResolvedValue(null);
  expect((await reconciliarReativacaoAbandonada(7)).status).toBe("CANCELED");
  expect(operacoes.concluir).toHaveBeenCalledWith(mockClient, operacao(), "CANCELED");
  expect(repository.registrarReativacao).not.toHaveBeenCalled();
});

test("erro ambíguo de consulta mantém a operação recuperável", async () => {
  pendente(); asaas.buscarAssinaturaPorReferencia.mockRejectedValue(new Error("timeout"));
  await expect(reconciliarReativacaoAbandonada(7)).resolves.toBeNull();
  expect(operacoes.concluir).not.toHaveBeenCalled();
  expect(repository.restaurarCancelamentoReativacao).not.toHaveBeenCalled();
});

test("worker recebe a falha de consulta, registrada sem payload e na mesma versão", async () => {
  pendente(); asaas.buscarAssinaturaPorReferencia.mockRejectedValue(new Error("timeout"));
  await expect(reconciliarReativacaoAbandonada(7, {propagarFalha:true})).rejects.toThrow("timeout");
  expect(operacoes.registrarFalha).toHaveBeenCalledWith(operacao(), "CONSULTA_ASAAS_FALHOU");
  expect(operacoes.concluir).not.toHaveBeenCalled();
});

test("perda normal da concessão não vira falha no worker", async () => {
  pendente(); operacoes.reservarExecucao.mockResolvedValue(null);
  await expect(reconciliarReativacaoAbandonada(7, {propagarFalha:true})).resolves.toBeNull();
  expect(operacoes.registrarFalha).not.toHaveBeenCalled();
});

test("sem cliente não infere ausência externa", async () => {
  pendente(); operacoes.buscarPendente.mockResolvedValue({ ...reservada(), operacao_tentativa: 1, asaas_customer_id: null });
  await expect(reconciliarReativacaoAbandonada(7)).resolves.toBeNull();
  expect(asaas.buscarAssinaturaPorReferencia).not.toHaveBeenCalled();
  expect(operacoes.concluir).not.toHaveBeenCalled();
});

test("operação recente impede outra criação mesmo sem acesso ativo", async () => {
  operacoes.possuiPendente.mockResolvedValue(true);
  repository.buscarAssinaturaAtivaPorNegocio.mockResolvedValue(null);
  await expect(reativarMinhaAssinatura({ usuarioId: 10 })).rejects.toMatchObject({ statusCode: 409, codigo: "RENOVACAO_PENDENTE" });
  expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
});

test("erro de criação não descarta a operação reservada", async () => {
  asaas.criarAssinaturaAsaas.mockRejectedValue(new Error("Resposta incerta"));
  await expect(reativarMinhaAssinatura({ usuarioId: 10 })).rejects.toThrow("incerta");
  expect(operacoes.concluir).not.toHaveBeenCalled();
});

test("somente quem obtém a execução consulta o provedor", async () => {
  pendente(); operacoes.reservarExecucao.mockResolvedValue(null);
  await expect(reconciliarReativacaoAbandonada(7)).resolves.toBeNull();
  expect(asaas.buscarAssinaturaPorReferencia).not.toHaveBeenCalled();
});

test("remoção pendente faz HTTP fora da transação e preserva obrigação se o provedor falhar", async () => {
  pendente();
  const removing = { ...operacao(), estado: "REMOVING", asaas_subscription_id: "sub_nova" };
  operacoes.reservarExecucao.mockResolvedValue(removing);
  asaas.removerAssinaturaAsaas.mockImplementation(async () => {
    expect(mockEmTransacao).toBe(false); throw new Error("indisponível");
  });
  await expect(reconciliarReativacaoAbandonada(7)).resolves.toBeNull();
  expect(operacoes.concluir).not.toHaveBeenCalled();
  expect(asaas.buscarAssinaturaPorReferencia).not.toHaveBeenCalled();
});

test.each([undefined, null])("usuário ausente %s não lê o provedor", async usuarioId => {
  await expect(reativarMinhaAssinatura({ usuarioId })).rejects.toMatchObject({ status: 401 });
  expect(asaas.criarAssinaturaAsaas).not.toHaveBeenCalled();
});
