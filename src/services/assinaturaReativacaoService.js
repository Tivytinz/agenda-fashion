const db = require("../db/db");
const assinaturaRepository = require(
  "../repositories/assinaturaRepository"
);
const {
  criarAssinaturaAsaas,
  buscarAssinaturaPorReferencia
} = require("./asaasService");
const {
  criarErro,
  dataValida
} = require("./assinaturaCalculos");
const registrador = require(
  "../utils/registrador"
);

function referenciaReativacao(
  assinatura,
  proximaCobranca
) {
  const tentativa =
    Number(
      assinatura?.reativacao_tentativa
    );

  if (
    !Number.isInteger(tentativa) ||
    tentativa < 1
  ) {
    throw new Error(
      "Tentativa de reativação inválida."
    );
  }

  return (
    `assinatura-reativada:${assinatura.id};` +
    `tentativa:${tentativa};` +
    `inicio:${proximaCobranca}`
  );
}

async function finalizarReativacaoLocal({
  assinatura,
  negocioId,
  recorrencia,
  proximaCobranca,
  observacoes
}) {
  return db.executarTransacao(
    (client) =>
      assinaturaRepository.registrarReativacao(
        client,
        {
          assinaturaId: assinatura.id,
          negocioId,
          asaasSubscriptionId:
            recorrencia.id,
          dataProximaCobranca:
            recorrencia.nextDueDate ||
            proximaCobranca,
          observacoes
        }
      )
  );
}

async function reconciliarReativacaoAbandonada(
  negocioId
) {
  const assinatura =
    await assinaturaRepository
      .buscarReativacaoAbandonada(
        negocioId
      );

  if (!assinatura) {
    return null;
  }

  const proximaCobranca =
    dataValida(
      assinatura.data_proxima_cobranca
    );

  if (
    !proximaCobranca ||
    !assinatura.asaas_customer_id
  ) {
    return db.executarTransacao(
      (client) =>
        assinaturaRepository
          .restaurarCancelamentoReativacao(
            client,
            {
              assinaturaId:
                assinatura.id,
              negocioId
            }
          )
    );
  }

  const referencia =
    referenciaReativacao(
      assinatura,
      proximaCobranca
    );

  let recorrencia;

  try {
    recorrencia =
      await buscarAssinaturaPorReferencia({
        externalReference:
          referencia,
        customerId:
          assinatura.asaas_customer_id
      });
  } catch (erro) {
    registrador.aviso(
      "Assinatura: não foi possível reconciliar reativação pendente no Asaas.",
      {
        assinatura_id:
          assinatura.id,
        negocio_id:
          negocioId,
        status_asaas:
          erro?.response?.status ||
          null,
        codigo:
          erro?.code ||
          null
      }
    );

    return null;
  }

  if (!recorrencia?.id) {
    return db.executarTransacao(
      (client) =>
        assinaturaRepository
          .restaurarCancelamentoReativacao(
            client,
            {
              assinaturaId:
                assinatura.id,
              negocioId
            }
          )
    );
  }

  const reativada =
    await finalizarReativacaoLocal({
      assinatura,
      negocioId,
      recorrencia,
      proximaCobranca,
      observacoes:
        "Renovação reconciliada após interrupção da reativação."
    });

  return reativada || null;
}

async function reativarMinhaAssinatura({
  usuarioId
}) {
  if (!usuarioId) {
    throw criarErro(
      "Usuário não autenticado.",
      401
    );
  }

  const negocio =
    await assinaturaRepository
      .buscarNegocioDono(
        usuarioId
      );

  if (!negocio) {
    throw criarErro(
      "Negócio não encontrado.",
      404
    );
  }

  await reconciliarReativacaoAbandonada(
    negocio.id
  );

  await assinaturaRepository
    .expirarCancelamentoSeNecessario(
      negocio.id
    );

  const assinatura =
    await assinaturaRepository
      .buscarAssinaturaAtivaPorNegocio(
        negocio.id
      );

  if (!assinatura) {
    throw criarErro(
      "O período pago já terminou. Escolha um plano para contratar novamente.",
      409
    );
  }

  const status = String(
    assinatura.status || ""
  )
    .trim()
    .toUpperCase();

  if (status === "ACTIVE") {
    return {
      mensagem:
        "A renovação desta assinatura já está ativa.",
      assinatura
    };
  }

  if (status === "REACTIVATING") {
    throw criarErro(
      "A reativação da renovação já está sendo processada. Tente novamente em alguns instantes.",
      409
    );
  }

  if (
    ![
      "CANCELED",
      "CANCELLED"
    ].includes(status)
  ) {
    throw criarErro(
      "Esta assinatura não pode ter a renovação reativada.",
      409
    );
  }

  if (
    String(
      assinatura.forma_pagamento || ""
    )
      .trim()
      .toLowerCase() !== "pix" ||
    !assinatura.asaas_customer_id
  ) {
    throw criarErro(
      "Não foi possível reativar a renovação desta assinatura automaticamente.",
      409
    );
  }

  const proximaCobranca =
    dataValida(
      assinatura.data_proxima_cobranca
    );

  if (!proximaCobranca) {
    throw criarErro(
      "Não foi possível identificar a próxima data de renovação.",
      409
    );
  }

  const plano =
    await assinaturaRepository
      .buscarPlano(
        assinatura.plano_id
      );

  const reservada =
    await db.executarTransacao(
      (client) =>
        assinaturaRepository
          .reservarReativacao(
            client,
            {
              assinaturaId:
                assinatura.id,
              negocioId:
                negocio.id
            }
          )
    );

  if (!reservada) {
    throw criarErro(
      "A reativação da renovação já está sendo processada. Tente novamente em alguns instantes.",
      409
    );
  }

  const referencia =
    referenciaReativacao(
      reservada,
      proximaCobranca
    );

  const recorrencia =
    await criarAssinaturaAsaas({
      customerId:
        reservada.asaas_customer_id,
      valor:
        reservada.valor,
      descricao:
        `Agenda Fashion - Renovação ${plano?.nome || "mensal"}`,
      formaPagamento:
        "pix",
      externalReference:
        referencia,
      proximaCobranca,
      reutilizarPorExternalReference:
        true
    });

  if (!recorrencia?.id) {
    throw new Error(
      "O Asaas não retornou o identificador da renovação."
    );
  }

  const reativada =
    await finalizarReativacaoLocal({
      assinatura: reservada,
      negocioId:
        negocio.id,
      recorrencia,
      proximaCobranca,
      observacoes:
        "Renovação reativada pelo titular."
    });

  if (!reativada) {
    throw criarErro(
      "A renovação foi preparada, mas ainda precisa ser reconciliada. Tente novamente em alguns instantes.",
      409
    );
  }

  return {
    mensagem:
      "Renovação reativada com sucesso. Nenhuma nova cobrança foi feita agora.",
    assinatura:
      reativada
  };
}

module.exports = {
  reconciliarReativacaoAbandonada,
  reativarMinhaAssinatura
};
