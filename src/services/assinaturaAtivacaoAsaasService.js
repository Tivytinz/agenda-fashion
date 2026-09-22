const db = require("../db/db");
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
} = require("./assinaturaServiceCore");
const {
  reconciliarLimiteProfissionais
} = require("./equipePlanoService");

function calcularProximaCobranca(
  dataBase = new Date()
) {
  const data = new Date(dataBase);

  if (Number.isNaN(data.getTime())) {
    throw new Error(
      "Não foi possível calcular a próxima cobrança da assinatura."
    );
  }

  const ano = data.getUTCFullYear();
  const mesSeguinte =
    data.getUTCMonth() + 1;
  const diaAtual = data.getUTCDate();
  const ultimoDiaDoMesSeguinte =
    new Date(
      Date.UTC(
        ano,
        mesSeguinte + 1,
        0
      )
    ).getUTCDate();

  return new Date(
    Date.UTC(
      ano,
      mesSeguinte,
      Math.min(
        diaAtual,
        ultimoDiaDoMesSeguinte
      )
    )
  )
    .toISOString()
    .slice(0, 10);
}

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
      dadosPagamento.paymentDate ||
      dadosPagamento.confirmedDate ||
      new Date(),
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

function assinaturaCancelada(assinatura) {
  return [
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
      dadosPagamento.paymentDate ||
      dadosPagamento.confirmedDate ||
      dadosPagamento.dueDate
    )
  ) {
    return calcularProximaCobranca(
      dadosPagamento.paymentDate ||
      dadosPagamento.confirmedDate ||
      dadosPagamento.dueDate
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

      if (assinaturaCancelada(assinatura)) {
        return {
          ...assinatura,
          ativacao_ignorada: true
        };
      }

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
      assinatura.data_pagamento ||
      assinatura.data_vencimento ||
      new Date()
    );

  const recorrencia =
    await criarAssinaturaAsaas({
      customerId:
        assinatura.asaas_customer_id,
      valor: assinatura.valor,
      descricao:
        "Agenda Fashion - Assinatura mensal",
      formaPagamento: "pix",
      externalReference:
        referenciaRecorrencia(assinatura),
      proximaCobranca,
      reutilizarPorExternalReference: true
    });

  if (!recorrencia?.id) {
    throw new Error(
      "O Asaas não retornou o identificador da assinatura."
    );
  }

  return {
    asaasSubscriptionId:
      recorrencia.id,
    dataProximaCobranca:
      recorrencia.nextDueDate ||
      proximaCobranca,
    criadaAgora: true
  };
}

async function finalizarAtivacao({
  paymentId,
  statusPagamento,
  dadosPagamento,
  recorrencia
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

      const pagamentoAtualizado =
        await pagamentoRepository
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

      if (assinaturaCancelada(assinatura)) {
        return null;
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
                recorrencia
                  .dataProximaCobranca,
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
    await removerAssinaturaAsaas(
      recorrencia.asaasSubscriptionId
    );
  }
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

async function cancelarRecorrenciasSubstituidas(
  recorrencias,
  recorrenciaAtual
) {
  const ids = new Set(
    (recorrencias || [])
      .map(
        (id) => String(id || "").trim()
      )
      .filter(
        (id) =>
          id &&
          id !== recorrenciaAtual
      )
  );

  for (const recorrenciaId of ids) {
    await removerAssinaturaAsaas(
      recorrenciaId
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
    return null;
  }

  if (preparada.ativacao_ignorada) {
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

  await cancelarRecorrenciasSubstituidas(
    finalizacao.recorrenciasParaCancelar,
    finalizacao.assinatura
      .asaas_subscription_id
  );

  return finalizacao.assinatura;
}

module.exports = {
  ativarAssinaturaPorPagamento
};
