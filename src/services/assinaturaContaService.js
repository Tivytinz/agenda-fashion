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

function estadoAtivacaoPendente(pagamento) {
  if (!pagamento) {
    return null;
  }

  const status = String(
    pagamento.status || ""
  )
    .trim()
    .toUpperCase();

  if (
    [
      "CONFIRMED",
      "RECEIVED",
      "RECEIVED_IN_CASH"
    ].includes(status)
  ) {
    return pagamento.ativacao_requer_atencao === true
      ? "ATIVACAO_REQUER_ATENCAO"
      : "PAGAMENTO_CONFIRMADO_ATIVANDO";
  }

  return "AGUARDANDO_PAGAMENTO";
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
    .expirarCancelamentoSeNecessario(negocio.id);

  const negocioAtualizado = await assinaturaRepository
    .buscarNegocioDono(usuarioId);
  const [assinatura, assinaturaPendente, uso] =
    await Promise.all([
      assinaturaRepository
        .buscarAssinaturaAtivaPorNegocio(negocio.id),
      assinaturaRepository
        .buscarAssinaturaPendentePorNegocio(negocio.id),
      buscarUsoPlano(negocio.id),
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
    assinatura || assinaturaPendente;
  const pagamentos = await assinaturaRepository
    .listarPagamentos(assinaturaPagamentos?.id || 0);

  return {
    plano,
    assinatura,
    upgrade_pendente:
      assinaturaPendente && planoPendente
        ? {
            assinatura: assinaturaPendente,
            plano: planoPendente,
            pagamento: pagamentoPendente
              ? {
                  ...pagamentoPendente,
                  estado_ativacao:
                    estadoAtivacaoPendente(
                      pagamentoPendente
                    )
                }
              : null,
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
