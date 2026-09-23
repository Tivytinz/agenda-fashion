const db = require("../db/db");
const assinaturaRepository = require(
  "../repositories/assinaturaRepository"
);
const { removerAssinaturaAsaas } = require("./asaasService");
const { buscarUsoPlano } = require("./planoService");
const {
  calcularProximaCobranca,
  criarErro,
  dataValida,
} = require("./assinaturaCalculos");

const FALHAS_RECUPERAVEIS = new Set([
  "OVERDUE",
  "PAST_DUE",
  "PAYMENT_FAILED",
  "CREDIT_CARD_CAPTURE_REFUSED",
]);

const REVERSOES_OU_DISPUTAS = new Set([
  "REFUNDED",
  "RECEIVED_IN_CASH_UNDONE",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
]);

function statusNormalizado(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase();
}

function tipoFalhaPagamento(status) {
  if (FALHAS_RECUPERAVEIS.has(status)) {
    return "COBRANCA_ATRASADA";
  }

  if (REVERSOES_OU_DISPUTAS.has(status)) {
    return "REVERSAO_OU_DISPUTA";
  }

  return null;
}

function normalizarInvoiceUrlAsaas(valor) {
  const texto = String(valor || "").trim();

  if (!texto) {
    return null;
  }

  try {
    const url = new URL(texto);
    const hostname = url.hostname.toLowerCase();

    if (
      url.protocol !== "https:" ||
      !(
        hostname === "asaas.com" ||
        hostname.endsWith(".asaas.com")
      )
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function pagamentoRecuperavel(pagamentos, estado) {
  if (
    estado?.codigo !== "FALHA_DE_PAGAMENTO" ||
    estado?.tipo_falha !== "COBRANCA_ATRASADA"
  ) {
    return null;
  }

  const pagamento = (pagamentos || []).find((item) => {
    const status = statusNormalizado(item?.status);
    return (
      FALHAS_RECUPERAVEIS.has(status) &&
      normalizarInvoiceUrlAsaas(item?.invoice_url)
    );
  });

  if (!pagamento) {
    return null;
  }

  return {
    id: pagamento.id,
    status: statusNormalizado(pagamento.status),
    data_vencimento: pagamento.data_vencimento || null,
    invoice_url: normalizarInvoiceUrlAsaas(
      pagamento.invoice_url
    ),
  };
}

function estadoAssinatura({
  assinatura,
  assinaturaPendente,
  ultimaAssinatura,
}) {
  if (assinatura) {
    const status = statusNormalizado(
      assinatura.status
    );

    return {
      codigo: ["CANCELED", "CANCELLED"].includes(status)
        ? "CANCELAMENTO_AGENDADO"
        : "ATIVA",
      status_provedor: status || null,
      assinatura_id: assinatura.id,
      plano_id: assinatura.plano_id,
    };
  }

  if (assinaturaPendente) {
    return {
      codigo: "PENDENTE",
      status_provedor:
        statusNormalizado(
          assinaturaPendente.status
        ) || null,
      assinatura_id: assinaturaPendente.id,
      plano_id: assinaturaPendente.plano_id,
    };
  }

  if (!ultimaAssinatura) {
    return {
      codigo: "GRATUITA",
      status_provedor: null,
      assinatura_id: null,
      plano_id: null,
    };
  }

  const status = statusNormalizado(
    ultimaAssinatura.status
  );
  const checkoutInicial =
    !ultimaAssinatura.asaas_subscription_id;

  if (
    checkoutInicial &&
    [
      "EXPIRED",
      "DELETED",
      "CANCELED",
      "CANCELLED",
      "OVERDUE",
      "PAST_DUE",
    ].includes(status)
  ) {
    return {
      codigo: "CHECKOUT_EXPIRADO",
      status_provedor: status,
      assinatura_id: ultimaAssinatura.id,
      plano_id: ultimaAssinatura.plano_id,
    };
  }

  const tipoFalha = tipoFalhaPagamento(status);

  if (tipoFalha) {
    return {
      codigo: "FALHA_DE_PAGAMENTO",
      tipo_falha: tipoFalha,
      status_provedor: status,
      assinatura_id: ultimaAssinatura.id,
      plano_id: ultimaAssinatura.plano_id,
    };
  }

  return {
    codigo: "INATIVA",
    status_provedor: status || null,
    assinatura_id: ultimaAssinatura.id,
    plano_id: ultimaAssinatura.plano_id,
  };
}

async function buscarMinhaAssinatura({ usuarioId }) {
  if (!usuarioId) {
    throw new Error("Usuário não autenticado.");
  }

  const negocio = await assinaturaRepository
    .buscarNegocioDono(usuarioId);

  if (!negocio) {
    throw new Error("Negócio não encontrado.");
  }

  await assinaturaRepository
    .expirarCheckoutsPendentes(negocio.id);

  const uso = await buscarUsoPlano(negocio.id);
  const negocioAtualizado = await assinaturaRepository
    .buscarNegocioDono(usuarioId);
  const [
    assinatura,
    assinaturaPendente,
    ultimaAssinatura,
  ] = await Promise.all([
    assinaturaRepository
      .buscarAssinaturaAtivaPorNegocio(negocio.id),
    assinaturaRepository
      .buscarAssinaturaPendentePorNegocio(negocio.id),
    assinaturaRepository
      .buscarUltimaAssinaturaPorNegocio(negocio.id),
  ]);
  const plano = await assinaturaRepository.buscarPlano(
    negocioAtualizado?.plano_id || negocio.plano_id
  );
  const planoPendente = assinaturaPendente
    ? await assinaturaRepository.buscarPlano(
        assinaturaPendente.plano_id
      )
    : null;
  const pagamentoPendente = assinaturaPendente
    ? await assinaturaRepository
        .buscarUltimoPagamentoPendente(
          assinaturaPendente.id
        )
    : null;
  const assinaturaPagamentos =
    assinatura || assinaturaPendente || ultimaAssinatura;
  const pagamentos = await assinaturaRepository
    .listarPagamentos(assinaturaPagamentos?.id || 0);
  const estado = estadoAssinatura({
    assinatura,
    assinaturaPendente,
    ultimaAssinatura,
  });

  return {
    plano,
    assinatura,
    estado_assinatura: estado,
    pagamento_recuperavel:
      pagamentoRecuperavel(pagamentos, estado),
    upgrade_pendente:
      assinaturaPendente && planoPendente
        ? {
            assinatura: assinaturaPendente,
            plano: planoPendente,
            pagamento: pagamentoPendente,
          }
        : null,
    uso: {
      plano_id: uso?.plano_id ?? plano?.id ?? null,
      plano_nome: uso?.plano_nome || plano?.nome || null,
      plano_slug: uso?.plano_slug || plano?.slug || null,
      utilizados: uso?.utilizados || 0,
      limite: uso?.capacidade_agendamentos ?? null,
      restantes: uso?.restantes ?? null,
      percentual: uso?.percentual ?? null,
      profissionais_utilizados:
        uso?.profissionais_utilizados || 0,
      limite_profissionais:
        uso?.limite_profissionais ?? null,
      servicos_utilizados: uso?.servicos_utilizados || 0,
      limite_servicos: uso?.limite_servicos ?? null,
    },
    pagamentos,
  };
}

async function calcularFimDoPeriodoPago(assinatura) {
  const pagamentosLocais = await assinaturaRepository
    .listarPagamentos(assinatura.id);
  const pagamentoRecebido = pagamentosLocais.find(
    (pagamento) => [
      "CONFIRMED",
      "RECEIVED",
      "RECEIVED_IN_CASH",
    ].includes(
      String(pagamento?.status || "").trim().toUpperCase()
    )
  );
  const pagamentoComData = pagamentoRecebido ||
    pagamentosLocais.find(
      (pagamento) =>
        dataValida(pagamento?.data_pagamento) ||
        dataValida(pagamento?.data_vencimento)
    );

  if (pagamentoComData) {
    return calcularProximaCobranca(
      pagamentoComData.data_pagamento ||
      pagamentoComData.data_vencimento
    );
  }

  const dataLocal = dataValida(
    assinatura.data_proxima_cobranca
  );

  if (dataLocal) {
    return dataLocal;
  }

  throw criarErro(
    "Não foi possível identificar até quando o plano já está pago.",
    409
  );
}

async function cancelarMinhaAssinatura({ usuarioId }) {
  if (!usuarioId) {
    throw criarErro("Usuário não autenticado.", 401);
  }

  const negocio = await assinaturaRepository
    .buscarNegocioDono(usuarioId);

  if (!negocio) {
    throw criarErro("Negócio não encontrado.", 404);
  }

  const assinatura = await assinaturaRepository
    .buscarAssinaturaAtivaPorNegocio(negocio.id);

  if (!assinatura) {
    throw criarErro(
      "Nenhuma assinatura ativa foi encontrada.",
      404
    );
  }

  const status = String(assinatura.status || "")
    .trim()
    .toUpperCase();

  if (["CANCELED", "CANCELLED"].includes(status)) {
    return {
      mensagem: "A renovação desta assinatura já está cancelada.",
      assinatura,
      acesso_ate: assinatura.data_proxima_cobranca,
    };
  }

  if (status !== "ACTIVE") {
    throw criarErro(
      "Somente uma assinatura ativa pode ter a renovação cancelada.",
      409
    );
  }

  if (!assinatura.asaas_subscription_id) {
    throw criarErro(
      "A assinatura não possui uma recorrência vinculada no Asaas.",
      409
    );
  }

  const acessoAte = await calcularFimDoPeriodoPago(assinatura);
  await removerAssinaturaAsaas(
    assinatura.asaas_subscription_id
  );

  const observacoes =
    "Renovação cancelada pelo titular. " +
    `Acesso mantido até ${acessoAte}.`;
  const assinaturaCancelada = await db.executarTransacao(
    (client) => assinaturaRepository.registrarCancelamento(
      client,
      {
        assinaturaId: assinatura.id,
        negocioId: negocio.id,
        acessoAte,
        observacoes,
      }
    )
  );

  if (!assinaturaCancelada) {
    throw criarErro(
      "A recorrência foi encerrada, mas não foi possível atualizar a assinatura local. Tente novamente para sincronizar.",
      409
    );
  }

  return {
    mensagem:
      "Renovação cancelada com sucesso. " +
      "O plano continuará disponível até o fim do período já pago.",
    assinatura: assinaturaCancelada,
    acesso_ate: assinaturaCancelada.data_proxima_cobranca,
  };
}

module.exports = {
  buscarMinhaAssinatura,
  cancelarMinhaAssinatura,
};
