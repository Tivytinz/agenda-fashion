const assinaturaEventoRepository = require(
  "../repositories/assinaturaEventoRepository"
);

function chavePagamento(pagamentoId, tipo) {
  return `pagamento:${pagamentoId}:${tipo}`;
}

function chaveAssinatura(assinaturaId, tipo) {
  return `assinatura:${assinaturaId}:${tipo}`;
}

async function registrarAtraso({
  client,
  assinatura,
  pagamentoId,
  status,
  ocorridoEm = null,
}) {
  if (
    !assinatura?.negocio_id ||
    !assinatura?.id ||
    !pagamentoId
  ) {
    return null;
  }

  return assinaturaEventoRepository.registrar(
    client,
    {
      negocioId: assinatura.negocio_id,
      assinaturaId: assinatura.id,
      pagamentoId,
      tipo: "PAGAMENTO_ATRASADO",
      motivo: "INADIMPLENCIA",
      planoAnteriorId: assinatura.plano_id || null,
      planoNovoId: assinatura.plano_id || null,
      origem: "webhook",
      detalhes: {
        status_provedor: status || null,
      },
      ocorridoEm,
      chaveIdempotencia:
        chavePagamento(
          pagamentoId,
          "PAGAMENTO_ATRASADO"
        ),
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
        ocorridoEm,
        chaveIdempotencia:
          chavePagamento(pagamentoId, tipo),
      }
    );

  if (principal) {
    eventos.push(principal);
  }

  const teveAtraso =
    await assinaturaEventoRepository
      .teveAtrasoProcessado(
        client,
        asaasPaymentId
      );

  if (teveAtraso) {
    const recuperacao =
      await assinaturaEventoRepository.registrar(
        client,
        {
          negocioId: assinatura.negocio_id,
          assinaturaId: assinatura.id,
          pagamentoId,
          tipo: "PAGAMENTO_RECUPERADO",
          motivo: "INADIMPLENCIA",
          planoAnteriorId: assinatura.plano_id || null,
          planoNovoId: assinatura.plano_id || null,
          origem: "webhook",
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
      ocorridoEm,
      chaveIdempotencia:
        chaveAssinatura(
          assinatura.id,
          "RENOVACAO_CANCELADA"
        ),
    }
  );
}

async function registrarEncerramentoAcesso({
  client,
  assinatura,
  motivo = null,
  origem = "sistema",
  ocorridoEm = null,
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
      tipo: "ACESSO_PAGO_ENCERRADO",
      motivo: motivoFinal,
      planoAnteriorId: assinatura.plano_id || null,
      planoNovoId: null,
      origem,
      detalhes: {
        acesso_ate:
          assinatura.data_proxima_cobranca || null,
      },
      ocorridoEm,
      chaveIdempotencia:
        chaveAssinatura(
          assinatura.id,
          "ACESSO_PAGO_ENCERRADO"
        ),
    }
  );
}

module.exports = {
  registrarAtraso,
  registrarConfirmacaoPagamento,
  registrarCancelamentoRenovacao,
  registrarEncerramentoAcesso,
};
