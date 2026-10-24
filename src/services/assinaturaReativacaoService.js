const db = require("../db/db");
const assinaturaRepository = require("../repositories/assinaturaRepository");
const renovacaoRepository = require("../repositories/assinaturaRenovacaoRepository");
const { criarAssinaturaAsaas, buscarAssinaturaPorReferencia, removerAssinaturaAsaas } = require("./asaasService");
const { criarErro, dataValida } = require("./assinaturaCalculos");
const { calcularFimDoPeriodoPago } = require("./assinaturaPeriodoPagoService");
const { expirarCancelamentoComReconciliacao } = require("./assinaturaExpiracaoService");
const registrador = require("../utils/registrador");

function erroPendente() {
  const erro = criarErro("A renovação precisa ser conferida. Atualize a assinatura antes de tentar novamente.", 409);
  erro.codigo = "RENOVACAO_PENDENTE";
  return erro;
}

function mesmaExecucao(operacao, esperada) {
  return operacao && operacao.execucao_versao === esperada.execucao_versao;
}

async function concluirSemRecorrencia(esperada, removidaId = null) {
  const decisao = await db.executarTransacao(async (client) => {
    const { assinatura, operacao } = await renovacaoRepository.bloquearContexto(
      client, esperada.assinatura_id, esperada.tentativa
    );
    if (!assinatura || !mesmaExecucao(operacao, esperada)) return null;
    // A criação original pode retornar enquanto a consulta de recuperação
    // ainda está em voo. Ausência observada antes desse retorno não apaga o ID.
    if (operacao.asaas_subscription_id && operacao.asaas_subscription_id !== removidaId) {
      return { remover: await renovacaoRepository.marcarRemocao(client, operacao) };
    }
    if (!await renovacaoRepository.concluir(client, operacao, "CANCELED")) return null;
    if (assinatura.reativacao_tentativa === operacao.tentativa &&
      String(assinatura.status).toUpperCase() === "REACTIVATING") {
      return { assinatura: await assinaturaRepository.restaurarCancelamentoReativacao(client, {
        assinaturaId: assinatura.id, negocioId: assinatura.negocio_id,
        reativacaoTentativa: operacao.tentativa,
      }) };
    }
    return { assinatura };
  });
  return decisao?.remover ? removerPreparada(decisao.remover) : decisao?.assinatura || null;
}

async function removerPreparada(operacao) {
  // REMOVING já foi persistido. Falha ou crash deixa o mesmo ID para o worker.
  try { await removerAssinaturaAsaas(operacao.asaas_subscription_id); }
  catch (erro) { erro.renovacaoErroCodigo = "REMOCAO_ASAAS_FALHOU"; throw erro; }
  return concluirSemRecorrencia(operacao, operacao.asaas_subscription_id);
}

async function resolverRecorrencia(esperada, recorrencia) {
  const registrada = await renovacaoRepository.registrarRecorrencia(
    esperada.assinatura_id, esperada.tentativa, recorrencia.id
  );
  if (!registrada) throw erroPendente();

  const decisao = await db.executarTransacao(async (client) => {
    const { assinatura, operacao } = await renovacaoRepository.bloquearContexto(
      client, esperada.assinatura_id, esperada.tentativa
    );
    if (!assinatura || !mesmaExecucao(operacao, esperada)) return null;
    if (operacao.estado === "COMPLETED") {
      return assinatura.status === "ACTIVE" && assinatura.asaas_subscription_id === recorrencia.id
        ? { reativada: assinatura } : null;
    }
    if (!["PENDING", "REMOVING"].includes(operacao.estado)) return null;

    const fimPago = assinatura.ativo && assinatura.periodo_pago_valido
      ? await calcularFimDoPeriodoPago(assinatura, client, { permitirAusente: true }) : null;
    const proxima = dataValida(recorrencia.nextDueDate);
    const compativel = operacao.estado === "PENDING" &&
      assinatura.reativacao_tentativa === operacao.tentativa &&
      assinatura.status === "REACTIVATING" && assinatura.ativo === true &&
      assinatura.periodo_pago_valido === true && !assinatura.possui_assinatura_mais_nova &&
      (!recorrencia.status || recorrencia.status === "ACTIVE") && proxima === fimPago;

    if (compativel) {
      const reativada = await assinaturaRepository.registrarReativacao(client, {
        assinaturaId: assinatura.id, negocioId: assinatura.negocio_id,
        reativacaoTentativa: operacao.tentativa, asaasSubscriptionId: recorrencia.id,
        dataProximaCobranca: proxima, observacoes: "Renovação conferida e reativada pelo titular.",
      });
      if (reativada) {
        await renovacaoRepository.concluir(client, operacao, "COMPLETED");
        return { reativada };
      }
    }
    return { remover: await renovacaoRepository.marcarRemocao(client, operacao) };
  });
  if (decisao?.reativada) return { assinatura: decisao.reativada, reativada: true };
  if (decisao?.remover) return { assinatura: await removerPreparada(decisao.remover), reativada: false };
  throw erroPendente();
}

async function reconciliarReativacaoAbandonada(negocioId, { propagarFalha = false } = {}) {
  await renovacaoRepository.garantirOperacaoLegada(negocioId);
  const pendente = await renovacaoRepository.buscarPendente(negocioId);
  if (!pendente) return null;
  const operacao = await db.executarTransacao((client) => renovacaoRepository.reservarExecucao(
    client, pendente.id, pendente.operacao_tentativa
  ));
  if (!operacao) return null;

  let codigoFalha = "PERSISTENCIA_FALHOU";
  try {
    if (operacao.estado === "REMOVING" && operacao.asaas_subscription_id) {
      return await removerPreparada(operacao);
    }
    if (!pendente.asaas_customer_id) {
      const erro = new Error("Renovação sem contexto para consultar o provedor.");
      erro.renovacaoErroCodigo = "CONTEXTO_INDISPONIVEL";
      throw erro;
    }
    codigoFalha = "CONSULTA_ASAAS_FALHOU";
    const recorrencia = await buscarAssinaturaPorReferencia({
      externalReference: operacao.referencia_externa, customerId: pendente.asaas_customer_id,
    });
    codigoFalha = "PERSISTENCIA_FALHOU";
    if (!recorrencia?.id) {
      if (operacao.asaas_subscription_id) {
        const remocao = await db.executarTransacao((client) => renovacaoRepository.marcarRemocao(client, operacao));
        return remocao ? await removerPreparada(remocao) : null;
      }
      return await concluirSemRecorrencia(operacao);
    }
    return (await resolverRecorrencia(operacao, recorrencia)).assinatura;
  } catch (erro) {
    if (erro?.codigo === "RENOVACAO_PENDENTE") return null;
    const codigo = erro?.renovacaoErroCodigo || codigoFalha;
    try { await renovacaoRepository.registrarFalha(operacao, codigo); } catch { /* O worker ainda contabiliza a falha original. */ }
    registrador.aviso("Assinatura: não foi possível reconciliar reativação pendente no Asaas.", {
      assinatura_id: pendente.id, negocio_id: negocioId,
      status_asaas: erro?.response?.status || null, codigo,
    });
    if (propagarFalha) throw erro;
    return null;
  }
}

async function reativarMinhaAssinatura({ usuarioId }) {
  if (!usuarioId) throw criarErro("Usuário não autenticado.", 401);
  const negocio = await assinaturaRepository.buscarNegocioDono(usuarioId);
  if (!negocio) throw criarErro("Negócio não encontrado.", 404);

  await expirarCancelamentoComReconciliacao(negocio.id);
  await reconciliarReativacaoAbandonada(negocio.id);
  if (await renovacaoRepository.possuiPendente(negocio.id)) throw erroPendente();

  // No máximo uma substituição automática se um recebimento ampliar o período
  // durante a criação. Cada criação tem geração/referência própria e durável.
  for (let repeticao = 0; repeticao < 2; repeticao += 1) {
    const assinatura = await assinaturaRepository.buscarAssinaturaAtivaPorNegocio(negocio.id);
    if (!assinatura) throw criarErro("O período pago já terminou. Escolha um plano para contratar novamente.", 409);
    if (assinatura.status === "ACTIVE" && assinatura.renovacao_cancelada !== true) {
      return { mensagem: "A renovação desta assinatura já está ativa.", assinatura };
    }
    if (assinatura.status === "REACTIVATING") throw erroPendente();
    if (!["CANCELED", "CANCELLED"].includes(assinatura.status) && assinatura.renovacao_cancelada !== true) {
      throw criarErro("Esta assinatura não pode ter a renovação reativada.", 409);
    }
    if (assinatura.forma_pagamento !== "pix" || !assinatura.asaas_customer_id) {
      throw criarErro("Não foi possível reativar a renovação desta assinatura automaticamente.", 409);
    }
    if (!dataValida(assinatura.acesso_pago_ate ?? assinatura.data_proxima_cobranca)) {
      throw criarErro("Não foi possível identificar a próxima data de renovação.", 409);
    }
    const plano = await assinaturaRepository.buscarPlano(assinatura.plano_id);
    const reservada = await db.executarTransacao((client) => assinaturaRepository.reservarReativacao(
      client, { assinaturaId: assinatura.id, negocioId: negocio.id }
    ));
    if (!reservada) throw erroPendente();
    const inicio = dataValida(reservada.reativacao_inicio_cobranca);
    const tentativa = reservada.reativacao_tentativa;
    const operacao = { assinatura_id: reservada.id, tentativa, execucao_versao: reservada.execucao_versao };
    // INACTIVE também preserva faturas existentes no provedor. Confirmar sua
    // remoção antes de criar a substituta, fora da transação e na geração reservada.
    if (reservada.asaas_subscription_id) await removerAssinaturaAsaas(reservada.asaas_subscription_id);
    const recorrencia = await criarAssinaturaAsaas({
      customerId: reservada.asaas_customer_id, valor: reservada.valor,
      descricao: `Agenda Fashion - Renovação ${plano?.nome || "mensal"}`, formaPagamento: "pix",
      externalReference: `assinatura-reativada:${reservada.id};tentativa:${tentativa};inicio:${inicio}`,
      proximaCobranca: inicio, reutilizarPorExternalReference: true,
    });
    if (!recorrencia?.id) throw new Error("O Asaas não retornou o identificador da renovação.");
    const resultado = await resolverRecorrencia(operacao, recorrencia);
    if (resultado.reativada) {
      return { mensagem: "Renovação reativada com sucesso. Nenhuma nova cobrança foi feita agora.",
        assinatura: resultado.assinatura };
    }
    if (resultado.assinatura?.status !== "CANCELED" || !resultado.assinatura.ativo) throw erroPendente();
  }
  throw erroPendente();
}

module.exports = { reconciliarReativacaoAbandonada, reativarMinhaAssinatura };
