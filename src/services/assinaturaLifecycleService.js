const assinaturaEventoRepository = require(
  "../repositories/assinaturaEventoRepository"
);

function chavePagamento(pagamentoId, tipo) {
  return `pagamento:${pagamentoId}:${tipo}`;
}

function chaveAssinatura(assinaturaId, tipo) {
  return `assinatura:${assinaturaId}:${tipo}`;
}

function periodicidadeSnapshot(assinatura = {}) {
  return String(
    assinatura.periodicidade || "MONTHLY"
  ).trim().toUpperCase() || "MONTHLY";
}

function snapshotMonetario(assinatura = {}) {
  const periodicidade =
    periodicidadeSnapshot(assinatura);
  const valor = Number(assinatura.valor);

  if (
    periodicidade !== "MONTHLY" ||
    !Number.isFinite(valor) ||
    valor < 0
  ) {
    return {
      valorMensal: null,
      periodicidade,
    };
  }

  return {
    valorMensal:
      Number(valor.toFixed(2)),
    periodicidade,
  };
}

const STATUS_ATRASO = new Set([
  "OVERDUE",
  "PAST_DUE",
  "PAYMENT_FAILED",
  "CREDIT_CARD_CAPTURE_REFUSED",
]);

const STATUS_REVERSAO = new Set([
  "REFUNDED",
  "RECEIVED_IN_CASH_UNDONE",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
]);

async function registrarSuspensaoFinanceira({
  client,
  assinatura,
  pagamentoId,
  status,
  planoNovoId = null,
  ocorridoEm = null,
}) {
  if (
    !assinatura?.negocio_id ||
    !assinatura?.id ||
    !pagamentoId
  ) {
    return null;
  }

  const statusNormalizado = String(
    status || ""
  ).trim().toUpperCase();

  let tipo;
  let motivo;

  if (STATUS_ATRASO.has(statusNormalizado)) {
    tipo = "PAGAMENTO_ATRASADO";
    motivo = "INADIMPLENCIA";
  } else if (STATUS_REVERSAO.has(statusNormalizado)) {
    tipo = "REVERSAO_FINANCEIRA";
    motivo = statusNormalizado;
  } else {
    return null;
  }

  return assinaturaEventoRepository.registrar(
    client,
    {
      negocioId: assinatura.negocio_id,
      assinaturaId: assinatura.id,
      pagamentoId,
      tipo,
      motivo,
      planoAnteriorId: assinatura.plano_id || null,
      planoNovoId: planoNovoId || null,
      origem: "webhook",
      detalhes: {
        status_provedor: statusNormalizado || null,
      },
      valorMensalAnterior:
        snapshotMonetario(assinatura).valorMensal,
      valorMensalNovo:
        snapshotMonetario(assinatura).valorMensal,
      periodicidadeSnapshot:
        snapshotMonetario(assinatura).periodicidade,
      ocorridoEm,
      chaveIdempotencia:
        chavePagamento(pagamentoId, tipo),
    }
  );
}

async function registrarConfirmacaoPagamento({
  client,
  assinatura,
  pagamentoId,
  asaasPaymentId,
  ocorridoEm = null,
}) {
  if (
    !assinatura?.negocio_id ||
    !assinatura?.id ||
    !pagamentoId
  ) {
    return [];
  }

  const contexto =
    await assinaturaEventoRepository
      .buscarContextoPagamento(
        client,
        {
          assinaturaId: assinatura.id,
          pagamentoId,
        }
      );

  if (!contexto) {
    return [];
  }

  const eventos = [];

  let tipo;
  let motivo = null;
  let planoAnteriorId = null;

  if (
    contexto.ultimo_evento_episodio_tipo ===
      "ACESSO_PAGO_ENCERRADO"
  ) {
    tipo = "REATIVACAO_PAGA";
    motivo = "RETORNO_APOS_SAIDA_PAGA";
    planoAnteriorId =
      contexto.ultimo_plano_pago_anterior_id ||
      assinatura.plano_id ||
      null;
  } else if (
    contexto
      .possui_pagamento_valido_mesma_assinatura
  ) {
    tipo = "RENOVACAO_CONFIRMADA";
  } else if (
    contexto.outra_assinatura_ativa_id
  ) {
    tipo = "PLANO_ALTERADO";
    motivo = "ASSINATURA_PAGA_VIGENTE";
    planoAnteriorId =
      contexto.plano_ativo_anterior_id || null;
  } else if (
    contexto.possui_historico_pago_anterior
  ) {
    tipo = "REATIVACAO_PAGA";
    motivo = "RETORNO_APOS_SAIDA_PAGA";
    planoAnteriorId =
      contexto.ultimo_plano_pago_anterior_id || null;
  } else {
    tipo = "CONVERSAO_INICIAL";
  }

  const monetarioAtual =
    snapshotMonetario(assinatura);
  const periodicidadeAnterior =
    contexto.periodicidade_ativa_anterior ||
    contexto.periodicidade_atual ||
    assinatura.periodicidade ||
    "MONTHLY";
  const monetarioAnterior =
    snapshotMonetario({
      valor:
        contexto.valor_recorrente_ativo_anterior,
      periodicidade: periodicidadeAnterior,
    });

  let valorMensalAnterior =
    monetarioAtual.valorMensal;
  let valorMensalNovo =
    monetarioAtual.valorMensal;

  if (
    tipo === "CONVERSAO_INICIAL" ||
    tipo === "REATIVACAO_PAGA"
  ) {
    valorMensalAnterior =
      monetarioAtual.valorMensal === null
        ? null
        : 0;
  } else if (tipo === "PLANO_ALTERADO") {
    valorMensalAnterior =
      monetarioAnterior.valorMensal;
  }

  const principal =
    await assinaturaEventoRepository.registrar(
      client,
      {
        negocioId: assinatura.negocio_id,
        assinaturaId: assinatura.id,
        pagamentoId,
        tipo,
        motivo,
        planoAnteriorId,
        planoNovoId: assinatura.plano_id || null,
        origem: "webhook",
        valorMensalAnterior,
        valorMensalNovo,
        periodicidadeSnapshot:
          monetarioAtual.periodicidade,
        ocorridoEm,
        chaveIdempotencia:
          chavePagamento(pagamentoId, tipo),
      }
    );

  if (principal) {
    eventos.push(principal);
  }

  const teveAtrasoCanonico =
    await assinaturaEventoRepository
      .teveEventoPagamento(
        client,
        pagamentoId,
        "PAGAMENTO_ATRASADO"
      );
  const teveAtrasoLegado =
    teveAtrasoCanonico
      ? false
      : await assinaturaEventoRepository
          .teveAtrasoProcessado(
            client,
            asaasPaymentId
          );

  if (teveAtrasoCanonico || teveAtrasoLegado) {
    const recuperacao =
      await assinaturaEventoRepository.registrar(
        client,
        {
          negocioId: assinatura.negocio_id,
          assinaturaId: assinatura.id,
          pagamentoId,
          tipo: "PAGAMENTO_RECUPERADO",
          motivo: "INADIMPLENCIA",
          planoAnteriorId:
            contexto.plano_negocio_atual_id || null,
          planoNovoId: assinatura.plano_id || null,
          origem: "webhook",
          valorMensalAnterior:
            monetarioAtual.valorMensal,
          valorMensalNovo:
            monetarioAtual.valorMensal,
          periodicidadeSnapshot:
            monetarioAtual.periodicidade,
          ocorridoEm,
          chaveIdempotencia:
            chavePagamento(
              pagamentoId,
              "PAGAMENTO_RECUPERADO"
            ),
        }
      );

    if (recuperacao) {
      eventos.push(recuperacao);
    }
  }

  return eventos;
}

async function registrarCancelamentoRenovacao({
  client,
  assinatura,
  acessoAte = null,
  origem = "conta",
  motivo = "CANCELAMENTO_VOLUNTARIO",
  ocorridoEm = null,
}) {
  if (!assinatura?.negocio_id || !assinatura?.id) {
    return null;
  }

  return assinaturaEventoRepository.registrar(
    client,
    {
      negocioId: assinatura.negocio_id,
      assinaturaId: assinatura.id,
      tipo: "RENOVACAO_CANCELADA",
      motivo,
      planoAnteriorId: assinatura.plano_id || null,
      planoNovoId: assinatura.plano_id || null,
      origem,
      detalhes: {
        acesso_ate: acessoAte || null,
      },
      valorMensalAnterior:
        snapshotMonetario(assinatura).valorMensal,
      valorMensalNovo:
        snapshotMonetario(assinatura).valorMensal,
      periodicidadeSnapshot:
        snapshotMonetario(assinatura).periodicidade,
      ocorridoEm,
      chaveIdempotencia:
        `${chaveAssinatura(
          assinatura.id,
          "RENOVACAO_CANCELADA"
        )}:${acessoAte || "sem-data"}`,
    }
  );
}

async function registrarEncerramentoAcesso({
  client,
  assinatura,
  pagamentoId = null,
  motivo = null,
  origem = "sistema",
  detalhes = {},
  ocorridoEm = null,
  referenciaIdempotencia = null,
}) {
  if (!assinatura?.negocio_id || !assinatura?.id) {
    return null;
  }

  let motivoFinal = motivo;

  if (!motivoFinal) {
    const cancelamento =
      await assinaturaEventoRepository
        .buscarUltimoPorAssinaturaETipo(
          client,
          assinatura.id,
          "RENOVACAO_CANCELADA"
        );

    motivoFinal =
      cancelamento?.motivo ||
      "ENCERRAMENTO_RECORRENCIA";
  }

  return assinaturaEventoRepository.registrar(
    client,
    {
      negocioId: assinatura.negocio_id,
      assinaturaId: assinatura.id,
      pagamentoId,
      tipo: "ACESSO_PAGO_ENCERRADO",
      motivo: motivoFinal,
      planoAnteriorId: assinatura.plano_id || null,
      planoNovoId: null,
      origem,
      detalhes: {
        ...detalhes,
        acesso_ate:
          assinatura.data_proxima_cobranca || null,
      },
      valorMensalAnterior:
        snapshotMonetario(assinatura).valorMensal,
      valorMensalNovo:
        snapshotMonetario(assinatura).valorMensal === null
          ? null
          : 0,
      periodicidadeSnapshot:
        snapshotMonetario(assinatura).periodicidade,
      ocorridoEm,
      chaveIdempotencia: pagamentoId
        ? chavePagamento(
            pagamentoId,
            "ACESSO_PAGO_ENCERRADO"
          )
        : `${chaveAssinatura(
            assinatura.id,
            "ACESSO_PAGO_ENCERRADO"
          )}:${
            referenciaIdempotencia ||
            assinatura.data_proxima_cobranca ||
            motivoFinal ||
            "sem-referencia"
          }`,
    }
  );
}

async function registrarAlteracaoValorRecorrente({
  client,
  assinaturaAnterior,
  assinaturaAtualizada,
  origem = "webhook",
  referenciaIdempotencia = null,
  ocorridoEm = null,
}) {
  if (
    !assinaturaAnterior?.negocio_id ||
    !assinaturaAnterior?.id ||
    !assinaturaAtualizada?.id ||
    Number(assinaturaAnterior.id) !==
      Number(assinaturaAtualizada.id)
  ) {
    return null;
  }

  const anterior =
    snapshotMonetario(assinaturaAnterior);
  const novo =
    snapshotMonetario(assinaturaAtualizada);

  if (
    anterior.valorMensal === null ||
    novo.valorMensal === null ||
    anterior.valorMensal === novo.valorMensal
  ) {
    return null;
  }

  const referencia =
    referenciaIdempotencia ||
    assinaturaAtualizada.asaas_ultimo_evento_id ||
    assinaturaAtualizada.asaas_ultimo_evento_em ||
    `${anterior.valorMensal}->${novo.valorMensal}`;

  return assinaturaEventoRepository.registrar(
    client,
    {
      negocioId:
        assinaturaAtualizada.negocio_id,
      assinaturaId:
        assinaturaAtualizada.id,
      tipo: "VALOR_RECORRENTE_ALTERADO",
      motivo: "ATUALIZACAO_PROVEDOR",
      planoAnteriorId:
        assinaturaAnterior.plano_id || null,
      planoNovoId:
        assinaturaAtualizada.plano_id || null,
      origem,
      detalhes: {
        regra: "mrr_v1",
      },
      valorMensalAnterior:
        anterior.valorMensal,
      valorMensalNovo:
        novo.valorMensal,
      periodicidadeSnapshot:
        novo.periodicidade,
      ocorridoEm,
      chaveIdempotencia:
        `${chaveAssinatura(
          assinaturaAtualizada.id,
          "VALOR_RECORRENTE_ALTERADO"
        )}:${referencia}`,
    }
  );
}

module.exports = {
  registrarSuspensaoFinanceira,
  registrarConfirmacaoPagamento,
  registrarCancelamentoRenovacao,
  registrarEncerramentoAcesso,
  registrarAlteracaoValorRecorrente,
};
