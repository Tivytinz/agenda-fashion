const db = require("../db/db");
const renovacaoRepository = require("../repositories/assinaturaRenovacaoRepository");
const checkoutRepository = require("../repositories/assinaturaCheckoutRepository");
const registrador = require("../utils/registrador");
const pagamentoRepository = require(
  "../repositories/pagamentoRepository"
);
const assinaturaAtivacaoRepository = require(
  "../repositories/assinaturaAtivacaoRepository"
);
const {
  criarAssinaturaAsaas,
  buscarAssinaturaPorReferencia,
  removerAssinaturaAsaas
} = require("./asaasService");
const {
  sincronizarPagamentoPorWebhook
} = require("./assinaturaPagamentoService");
const {
  reconciliarLimiteProfissionais
} = require("./equipePlanoService");
const assinaturaLifecycleService = require(
  "./assinaturaLifecycleService"
);
const { calcularProximaCobranca, dataValida, valoresMonetariosIguais } = require("./assinaturaCalculos");
const { calcularFimDoPeriodoPago } = require("./assinaturaPeriodoPagoService");

function dadosEvento(
  dadosPagamento,
  statusPagamento
) {
  return {
    status:
      statusPagamento ||
      dadosPagamento.status ||
      "CONFIRMED",
    data_pagamento:
      dataValida(dadosPagamento.paymentDate) ||
      dataValida(dadosPagamento.confirmedDate) ||
      null,
    confirmacao_observada_em:
      dadosPagamento.webhookRecebidoEm ||
      null,
    evento_criado_em:
      dadosPagamento
        .webhookEventoCriadoEm ||
      null,
    evento_id:
      dadosPagamento
        .webhookEventoId ||
      null
  };
}

function validarValorCheckoutPendente(assinatura, dadosPagamento = {}) {
  // Renovações com recorrência já vinculada podem ter histórico de preço;
  // a conferência bloqueia somente a primeira concessão do checkout PIX.
  if (assinatura.ativo === true || assinatura.asaas_subscription_id) return;

  const divergenciaLocal = !valoresMonetariosIguais(
    assinatura.pagamento_valor, assinatura.valor
  );
  const valorObservado = dadosPagamento.value;
  const divergenciaProvedor = valorObservado !== undefined &&
    valorObservado !== null &&
    !valoresMonetariosIguais(valorObservado, assinatura.valor);

  if (divergenciaLocal || divergenciaProvedor) {
    const erro = new Error(
      "Pagamento com valor diferente do contrato; ativação suspensa para reconciliação."
    );
    erro.code = "PAGAMENTO_VALOR_DIVERGENTE";
    throw erro;
  }
}

function assinaturaCancelada(assinatura) {
  return assinatura?.renovacao_cancelada === true || [
    "CANCELED",
    "CANCELLED"
  ].includes(
    String(
      assinatura?.status || ""
    )
      .trim()
      .toUpperCase()
  );
}

function referenciaRecorrencia(assinatura) {
  return (
    `assinatura:${assinatura.id};` +
    `negocio:${assinatura.negocio_id};` +
    `plano:${assinatura.plano_id}`
  );
}

function proximaCobrancaExistente(
  assinatura,
  dadosPagamento
) {
  if (
    assinatura.asaas_subscription_id &&
    (
      dataValida(dadosPagamento.paymentDate) ||
      dataValida(dadosPagamento.confirmedDate) ||
      dataValida(dadosPagamento.dueDate)
    )
  ) {
    return calcularProximaCobranca(
      dataValida(dadosPagamento.paymentDate) ||
      dataValida(dadosPagamento.confirmedDate) ||
      dataValida(dadosPagamento.dueDate)
    );
  }

  return assinatura
    .data_proxima_cobranca ||
    null;
}

async function prepararAtivacao(
  paymentId,
  statusPagamento,
  dadosPagamento
) {
  const pagamento =
    await sincronizarPagamentoPorWebhook({
      ...dadosPagamento,
      id: paymentId,
      status:
        statusPagamento ||
        dadosPagamento.status ||
        "CONFIRMED"
    });

  if (!pagamento) {
    return null;
  }

  return db.executarTransacao(
    async (client) => {
      const assinatura =
        await assinaturaAtivacaoRepository
          .buscarContextoPagamento(
            client,
            paymentId
          );

      if (!assinatura) {
        return null;
      }

      const maisNova =
        await assinaturaAtivacaoRepository
          .buscarAssinaturaAtivaMaisNova(
            client,
            assinatura.negocio_id,
            assinatura.id
          );

      if (maisNova) {
        return {
          ...assinatura,
          ativacao_ignorada: true,
          assinatura_vigente_id:
            maisNova.id
        };
      }

      if (assinaturaCancelada(assinatura) && !assinatura.asaas_subscription_id &&
        assinatura.status !== "REACTIVATING" && !assinatura.renovacao_em_resolucao) {
        return {
          ...assinatura,
          ativacao_ignorada: true
        };
      }

      if (assinatura.acesso_pago_reconciliado === true) {
        const fimPago = await calcularFimDoPeriodoPago(assinatura, client, { permitirAusente: true });
        if (!fimPago || !await assinaturaAtivacaoRepository.periodoPagoVigente(client, fimPago)) {
          return { ...assinatura, ativacao_ignorada: true };
        }
      }

      validarValorCheckoutPendente(assinatura, dadosPagamento);
      return assinatura;
    }
  );
}

async function criarOuReutilizarRecorrencia(
  assinatura,
  dadosPagamento
) {
  if (
    assinatura.forma_pagamento !== "pix" ||
    assinaturaCancelada(assinatura) ||
    assinatura.asaas_subscription_id
  ) {
    return {
      asaasSubscriptionId:
        assinatura.asaas_subscription_id ||
        null,
      dataProximaCobranca:
        proximaCobrancaExistente(
          assinatura,
          dadosPagamento
        ),
      criadaAgora: false
    };
  }

  const proximaCobranca =
    calcularProximaCobranca(
      dataValida(assinatura.data_pagamento) ||
      dataValida(assinatura.data_vencimento) ||
      new Date().toISOString().slice(0, 10)
    );

  const registrada = await db.executarTransacao(async client => {
    await assinaturaAtivacaoRepository.bloquearNegocio(client, assinatura.negocio_id);
    return checkoutRepository.garantirCriacao(client, assinatura, proximaCobranca);
  });
  const operacao = await checkoutRepository.reservar(registrada.id);
  if (!operacao || operacao.estado !== "PENDING") {
    const erro = new Error("A recorrência do checkout precisa ser conferida antes de outra tentativa.");
    erro.codigo = "CHECKOUT_RECURRENCIA_PENDENTE";
    throw erro;
  }
  let recorrencia;
  try {
    recorrencia = await criarAssinaturaAsaas({
      customerId:
        operacao.asaas_customer_id,
      valor: assinatura.valor,
      descricao:
        "Agenda Fashion - Assinatura mensal",
      formaPagamento: "pix",
      externalReference:
        operacao.referencia_externa,
      proximaCobranca: dataValida(operacao.inicio_cobranca),
      reutilizarPorExternalReference: true
    });

    if (!recorrencia?.id) {
      throw new Error("O Asaas não retornou o identificador da assinatura.");
    }
    const conhecida = await checkoutRepository.registrarRecorrencia(operacao, recorrencia.id);
    if (!conhecida) throw new Error("A identidade da recorrência mudou durante a criação do checkout.");
  } catch (erro) {
    await checkoutRepository.registrarFalha(operacao, "CRIACAO_ASAAS_FALHOU").catch(() => {});
    throw erro;
  }

  return {
    asaasSubscriptionId:
      recorrencia.id,
    dataProximaCobranca:
      recorrencia.nextDueDate ||
      proximaCobranca,
    criadaAgora: true,
    operacao,
  };
}

async function finalizarAtivacao({
  paymentId,
  statusPagamento,
  dadosPagamento,
  recorrencia,
  recuperacao = false,
}) {
  return db.executarTransacao(
    async (client) => {
      const contextoInicial =
        await assinaturaAtivacaoRepository
          .buscarContextoPagamento(
            client,
            paymentId
          );

      if (!contextoInicial) {
        return null;
      }

      /*
       * Esta consulta também bloqueia a linha do negócio.
       * Ela é a fronteira comum entre ativações concorrentes
       * e termina antes de qualquer nova chamada HTTP ao Asaas.
       */
      const maisNova =
        await assinaturaAtivacaoRepository
          .buscarAssinaturaAtivaMaisNova(
            client,
            contextoInicial.negocio_id,
            contextoInicial.id
          );

      if (maisNova) {
        return null;
      }

      const assinatura =
        await assinaturaAtivacaoRepository
          .buscarContextoPagamento(
            client,
            paymentId,
            {
              bloquear: true
            }
          );

      if (!assinatura) {
        return null;
      }

      if (recorrencia.operacao) {
        const operacao = await checkoutRepository.bloquear(client, recorrencia.operacao);
        if (!operacao || operacao.estado !== "PENDING" ||
          operacao.asaas_subscription_id !== recorrencia.asaasSubscriptionId) return null;
      }

      const pagamentoAtualizado =
        recuperacao ? (["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(assinatura.pagamento_status)
          ? assinatura : null) : await pagamentoRepository
          .atualizarStatusPagamento(
            client,
            paymentId,
            dadosEvento(
              dadosPagamento,
              statusPagamento
            )
          );

      if (!pagamentoAtualizado) {
        return null;
      }

      if (assinaturaCancelada(assinatura) && !assinatura.asaas_subscription_id &&
        assinatura.status !== "REACTIVATING" && !assinatura.renovacao_em_resolucao) {
        return null;
      }

      validarValorCheckoutPendente(assinatura, dadosPagamento);
      const fimPago = await calcularFimDoPeriodoPago(assinatura, client);
      if (assinatura.acesso_pago_reconciliado === true &&
        !await assinaturaAtivacaoRepository.periodoPagoVigente(client, fimPago)) return null;

      await assinaturaLifecycleService
        .registrarConfirmacaoPagamento({
          client,
          assinatura,
          pagamentoId: assinatura.pagamento_id,
          asaasPaymentId: paymentId,
          ocorridoEm:
            pagamentoAtualizado
              .confirmacao_observada_em ||
            pagamentoAtualizado
              .data_pagamento ||
            assinatura.data_pagamento ||
            null
        });

      const pagamentoAnterior = dadosPagamento.subscription &&
        dadosPagamento.subscription !== assinatura.asaas_subscription_id;
      const realinhamento = assinatura.status === "ACTIVE" && pagamentoAnterior &&
        fimPago > dataValida(assinatura.data_proxima_cobranca) &&
        await renovacaoRepository.reabrirRemocao(client, assinatura);

      if (assinaturaCancelada(assinatura) || realinhamento ||
        String(assinatura.status).toUpperCase() === "REACTIVATING" || assinatura.renovacao_em_resolucao) {
        const preservada = await assinaturaAtivacaoRepository.atualizarPeriodoPagoSemRenovar(client, {
          assinaturaId: assinatura.id, dataProximaCobranca: fimPago,
        });
        if (preservada?.ativo) {
          await assinaturaAtivacaoRepository.atualizarPlanoNegocio(client, assinatura.negocio_id, assinatura.plano_id);
          await reconciliarLimiteProfissionais(assinatura.negocio_id, client);
        }
        return preservada ? { assinatura: preservada, recorrenciasParaCancelar: [] } : null;
      }

      const asaasSubscriptionId =
        assinatura.asaas_subscription_id ||
        recorrencia.asaasSubscriptionId ||
        null;

      await assinaturaAtivacaoRepository
        .desativarAssinaturasConcorrentes(
          client,
          assinatura.negocio_id,
          assinatura.id
        );

      const ativada =
        await assinaturaAtivacaoRepository
          .ativarAssinatura(
            client,
            {
              assinaturaId:
                assinatura.id,
              asaasSubscriptionId,
              dataProximaCobranca:
                dataValida(assinatura.asaas_subscription_id
                  ? assinatura.data_proxima_cobranca : recorrencia.dataProximaCobranca),
              acessoPagoAte: fimPago,
              observacoes:
                asaasSubscriptionId
                  ? "Assinatura mensal ativa no Asaas."
                  : assinatura.observacoes
            }
          );

      if (!ativada) {
        return null;
      }

      await assinaturaAtivacaoRepository
        .atualizarPlanoNegocio(
          client,
          assinatura.negocio_id,
          assinatura.plano_id
        );

      await reconciliarLimiteProfissionais(
        assinatura.negocio_id,
        client
      );

      const recorrenciasParaCancelar =
        await assinaturaAtivacaoRepository
          .listarRecorrenciasSubstituidas(
            client,
            assinatura.negocio_id,
            assinatura.id
          );

      // A obrigação de remover existe no mesmo commit que substitui o plano.
      await checkoutRepository.garantirRemocoes(client, assinatura.negocio_id, assinatura.id);
      if (recorrencia.operacao) {
        await checkoutRepository.mudarEstado(client, recorrencia.operacao, "COMPLETED");
      }

      return {
        assinatura: ativada,
        recorrenciasParaCancelar
      };
    }
  );
}

async function compensarRecorrenciaSeOrfa(
  recorrencia
) {
  if (
    !recorrencia.criadaAgora ||
    !recorrencia.asaasSubscriptionId
  ) {
    return;
  }

  const vinculada =
    await assinaturaAtivacaoRepository
      .existeVinculoRecorrenciaAsaas(
        recorrencia.asaasSubscriptionId
      );

  if (!vinculada) {
    if (recorrencia.operacao) {
      const removendo = await checkoutRepository.mudarEstado(db, recorrencia.operacao, "REMOVING");
      if (removendo) await removerOperacaoCheckout(removendo);
    } else await removerAssinaturaAsaas(recorrencia.asaasSubscriptionId);
  }
}

async function removerOperacaoCheckout(operacao) {
  try {
    await removerAssinaturaAsaas(operacao.asaas_subscription_id);
    return await checkoutRepository.mudarEstado(db, operacao, "CANCELED");
  } catch (erro) {
    erro.checkoutErroCodigo = "REMOCAO_ASAAS_FALHOU";
    await checkoutRepository.registrarFalha(operacao, "REMOCAO_ASAAS_FALHOU").catch(() => {});
    throw erro;
  }
}

async function reconciliarCheckoutsPendentes(negocioId, { propagarFalha = false, respeitarBackoff = false } = {}) {
  let resolvidas = 0;
  for (const pendente of await checkoutRepository.listarPendentes(negocioId, { respeitarBackoff })) {
    const operacao = await checkoutRepository.reservar(pendente.id, { respeitarBackoff });
    if (!operacao) continue;
    let codigo = "PERSISTENCIA_FALHOU";
    try {
      if (operacao.estado === "REMOVING" && operacao.asaas_subscription_id) {
        await removerOperacaoCheckout(operacao);
        resolvidas += 1;
        continue;
      }
      if (!operacao.asaas_customer_id) {
        codigo = "CONTEXTO_INDISPONIVEL";
        throw new Error("Checkout sem contexto para consultar o provedor.");
      }
      codigo = "CONSULTA_ASAAS_FALHOU";
      const externa = await buscarAssinaturaPorReferencia({
        externalReference: operacao.referencia_externa, customerId: operacao.asaas_customer_id,
      });
      codigo = "PERSISTENCIA_FALHOU";
      if (externa?.id) await checkoutRepository.registrarRecorrencia(operacao, externa.id);
      const atual = await checkoutRepository.bloquear(db, operacao);
      if (!atual || !["PENDING", "REMOVING"].includes(atual.estado)) continue;
      if (!externa?.id && !atual.asaas_subscription_id) {
        const contexto = pendente.asaas_payment_id &&
          await assinaturaAtivacaoRepository.buscarContextoPagamento(null, pendente.asaas_payment_id);
        if (contexto && ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(contexto.pagamento_status) &&
          !assinaturaCancelada(contexto)) {
          // Consulta vazia não autoriza criar pelo worker nem inutiliza o replay
          // da confirmação válida. A referência reservada permanece a mesma.
          await checkoutRepository.adiarConsulta(operacao);
          continue;
        }
        await checkoutRepository.mudarEstado(db, operacao, "CANCELED");
        resolvidas += 1;
        continue;
      }
      const recorrencia = { asaasSubscriptionId: atual.asaas_subscription_id,
        dataProximaCobranca: externa?.nextDueDate || dataValida(atual.inicio_cobranca), operacao };
      const finalizacao = atual.estado === "PENDING" && externa?.id &&
        (!externa.status || externa.status === "ACTIVE") && pendente.asaas_payment_id
        ? await finalizarAtivacao({ paymentId: pendente.asaas_payment_id, dadosPagamento: {}, recorrencia, recuperacao: true }) : null;
      if (!finalizacao) {
        // Pode ser a resposta antiga de um checkout já finalizado. Uma recorrência
        // vinculada não é órfã; a remoção de substituídas tem operação própria.
        if (await assinaturaAtivacaoRepository.existeVinculoRecorrenciaAsaas(atual.asaas_subscription_id)) {
          await checkoutRepository.mudarEstado(db, operacao, "COMPLETED");
        } else {
          const removendo = await checkoutRepository.mudarEstado(db, operacao, "REMOVING");
          if (removendo) await removerOperacaoCheckout({ ...removendo, asaas_subscription_id: atual.asaas_subscription_id });
        }
      }
      resolvidas += 1;
    } catch (erro) {
      const falha = erro.checkoutErroCodigo || codigo;
      await checkoutRepository.registrarFalha(operacao, falha).catch(() => {});
      registrador.aviso("Billing: não foi possível conciliar recorrência de checkout.", {
        negocio_id: negocioId, operacao_id: operacao.id, codigo: falha,
      });
      if (propagarFalha) throw erro;
    }
  }
  return resolvidas;
}

async function reconciliarRecorrenciaOrfaIgnorada(
  assinatura
) {
  if (
    assinatura.forma_pagamento !== "pix" ||
    assinatura.asaas_subscription_id ||
    typeof buscarAssinaturaPorReferencia !==
      "function"
  ) {
    return;
  }

  const existente =
    await buscarAssinaturaPorReferencia({
      externalReference:
        referenciaRecorrencia(assinatura),
      customerId:
        assinatura.asaas_customer_id
    });

  const asaasSubscriptionId =
    String(existente?.id || "").trim();

  if (!asaasSubscriptionId) {
    return;
  }

  const vinculada =
    await assinaturaAtivacaoRepository
      .existeVinculoRecorrenciaAsaas(
        asaasSubscriptionId
      );

  if (!vinculada) {
    await removerAssinaturaAsaas(
      asaasSubscriptionId
    );
  }
}

async function ativarAssinaturaPorPagamento(
  paymentId,
  statusPagamento = "CONFIRMED",
  dadosPagamento = {}
) {
  const pagamentoId =
    String(paymentId || "").trim();

  if (!pagamentoId) {
    throw new Error(
      "Pagamento não informado."
    );
  }

  const preparada =
    await prepararAtivacao(
      pagamentoId,
      statusPagamento,
      dadosPagamento
    );

  if (!preparada) {
    const contexto = await assinaturaAtivacaoRepository.buscarContextoPagamento(null, pagamentoId);
    if (contexto) await reconciliarCheckoutsPendentes(contexto.negocio_id, { propagarFalha: true });
    return null;
  }

  if (preparada.ativacao_ignorada) {
    await reconciliarCheckoutsPendentes(preparada.negocio_id, { propagarFalha: true });
    /*
     * O worker financeiro usa webhookEventoId. Para esse fluxo,
     * uma confirmação obsoleta deve ser IGNORED (null) e não uma
     * conversão. Antes de encerrar, reconciliamos apenas por GET
     * uma eventual recorrência órfã deixada por tentativa anterior.
     * Chamadas legadas sem metadado de webhook preservam o retorno
     * histórico com ativacao_ignorada.
     */
    if (dadosPagamento.webhookEventoId) {
      await reconciliarRecorrenciaOrfaIgnorada(
        preparada
      );

      return null;
    }

    return preparada;
  }

  const recorrencia =
    await criarOuReutilizarRecorrencia(
      preparada,
      dadosPagamento
    );

  let finalizacao;

  try {
    finalizacao =
      await finalizarAtivacao({
        paymentId: pagamentoId,
        statusPagamento,
        dadosPagamento,
        recorrencia
      });
  } catch (erro) {
    await compensarRecorrenciaSeOrfa(
      recorrencia
    ).catch(() => {});

    throw erro;
  }

  if (!finalizacao) {
    await compensarRecorrenciaSeOrfa(
      recorrencia
    );

    return null;
  }

  await reconciliarCheckoutsPendentes(preparada.negocio_id, { propagarFalha: true });

  return finalizacao.assinatura;
}

module.exports = {
  ativarAssinaturaPorPagamento,
  reconciliarCheckoutsPendentes,
};
