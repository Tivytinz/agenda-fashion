const db = require("../db/db");
const encerramentoRepository = require(
  "../repositories/encerramentoRepository"
);
const agendamentoCancelamentoRepository = require(
  "../repositories/agendamentoCancelamentoRepository"
);
const {
  validarAgendamentoCancelavel,
} = require("./agendamentoCancelamentoService");
const whatsappMensagemService = require(
  "./whatsappMensagemService"
);
const {
  gerarAcessoClienteDesativado,
  validarAcessoClienteDesativado,
} = require("../utils/acessoClienteDesativado");

function normalizarId(valor) {
  const id = Number(valor);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function criarErro(
  mensagem,
  statusCode,
  codigo = null,
  pendencias = null
) {
  const erro = new Error(mensagem);
  erro.status = statusCode;
  erro.statusCode = statusCode;
  erro.codigo = codigo;

  if (Array.isArray(pendencias)) {
    erro.pendencias = pendencias;
  }

  return erro;
}

function normalizarBooleano(valor) {
  return valor === true || valor === "true";
}

function montarPendenciasNegocio(estado = {}) {
  const pendencias = [];
  const agendamentos = Number(
    estado.agendamentos_confirmados || 0
  );

  if (agendamentos > 0) {
    pendencias.push({
      codigo: "AGENDAMENTOS_CONFIRMADOS",
      quantidade: agendamentos,
      mensagem:
        agendamentos === 1
          ? "Resolva o agendamento confirmado antes de encerrar o negócio."
          : `Resolva os ${agendamentos} agendamentos confirmados antes de encerrar o negócio.`,
    });
  }

  if (normalizarBooleano(estado.acesso_pago_ativo)) {
    pendencias.push({
      codigo: "ACESSO_PAGO_ATIVO",
      mensagem:
        "Cancele a renovação e aguarde o fim do período pago antes de encerrar o negócio.",
    });
  }

  if (
    normalizarBooleano(estado.checkout_pendente) ||
    normalizarBooleano(estado.checkout_processando)
  ) {
    pendencias.push({
      codigo: "CHECKOUT_PENDENTE",
      mensagem:
        "Finalize ou aguarde o encerramento do checkout pendente antes de encerrar o negócio.",
    });
  }

  if (
    normalizarBooleano(
      estado.operacao_financeira_pendente
    )
  ) {
    pendencias.push({
      codigo: "OPERACAO_FINANCEIRA_PENDENTE",
      mensagem:
        "Existe uma operação financeira pendente. Aguarde a resolução antes de encerrar o negócio.",
    });
  }

  return pendencias;
}

async function validarNegocioPodeArquivar(
  negocioId,
  executor
) {
  const estado =
    await encerramentoRepository.buscarPendenciasNegocio(
      negocioId,
      executor
    );
  const pendencias = montarPendenciasNegocio(estado);

  if (pendencias.length > 0) {
    throw criarErro(
      "Antes de encerrar o negócio, resolva as pendências indicadas.",
      409,
      "ENCERRAMENTO_COM_PENDENCIAS",
      pendencias
    );
  }

  return true;
}

async function arquivarNegocioNaTransacao({
  negocio,
  usuarioId,
  motivo,
  executor,
}) {
  await validarNegocioPodeArquivar(
    negocio.id,
    executor
  );

  const arquivado =
    await encerramentoRepository.arquivarNegocio({
      negocioId: negocio.id,
      usuarioId,
      motivo,
      executor,
    });

  if (!arquivado) {
    throw criarErro(
      "O negócio não pôde ser arquivado. Atualize a página e tente novamente.",
      409,
      "NEGOCIO_NAO_ARQUIVADO"
    );
  }

  await encerramentoRepository.desativarVinculosDoNegocio(
    negocio.id,
    executor
  );

  await encerramentoRepository.cancelarConvitesPendentes(
    negocio.id,
    executor
  );

  return arquivado;
}

async function encerrarNegocio({ usuarioId }) {
  const usuario = normalizarId(usuarioId);

  if (!usuario) {
    throw criarErro(
      "Usuário não autenticado.",
      401,
      "NAO_AUTENTICADO"
    );
  }

  return db.executarTransacao(async (client) => {
    await encerramentoRepository.bloquearUsuario(
      usuario,
      client
    );

    const negocio =
      await encerramentoRepository.buscarNegocioOperacionalDoDono(
        usuario,
        client,
        { bloquear: true }
      );

    if (!negocio) {
      throw criarErro(
        "Negócio operacional não encontrado.",
        404,
        "NEGOCIO_NAO_ENCONTRADO"
      );
    }

    const arquivado =
      await arquivarNegocioNaTransacao({
        negocio,
        usuarioId: usuario,
        motivo: "encerramento_voluntario",
        executor: client,
      });

    return {
      mensagem:
        "Negócio encerrado e arquivado com segurança. Sua conta continua ativa.",
      negocio: arquivado,
    };
  });
}

async function desativarConta({ usuarioId }) {
  const usuario = normalizarId(usuarioId);

  if (!usuario) {
    throw criarErro(
      "Usuário não autenticado.",
      401,
      "NAO_AUTENTICADO"
    );
  }

  const resultado = await db.executarTransacao(
    async (client) => {
      const conta =
        await encerramentoRepository.bloquearUsuario(
          usuario,
          client
        );

      if (!conta || conta.ativo !== true) {
        throw criarErro(
          "Esta conta já está desativada.",
          409,
          "CONTA_JA_DESATIVADA"
        );
      }

      const negocio =
        await encerramentoRepository.buscarNegocioOperacionalDoDono(
          usuario,
          client,
          { bloquear: true }
        );

      if (negocio) {
        throw criarErro(
          "Encerre primeiro o negócio operacional em Meu negócio. A desativação da conta não pode deixar um negócio sem proprietária ativa.",
          409,
          "NEGOCIO_OPERACIONAL_ATIVO"
        );
      }

      const reservasProfissional =
        await encerramentoRepository.contarReservasAtivasProfissional(
          usuario,
          client
        );

      if (reservasProfissional > 0) {
        throw criarErro(
          "Resolva seus agendamentos confirmados como profissional antes de desativar a conta.",
          409,
          "PROFISSIONAL_COM_AGENDAMENTOS"
        );
      }

      const reservas =
        await encerramentoRepository.listarReservasAtivasCliente(
          usuario,
          client
        );

      await encerramentoRepository.desativarVinculosDoUsuario(
        usuario,
        client
      );

      const contaDesativada =
        await encerramentoRepository.desativarUsuario(
          usuario,
          client
        );

      if (!contaDesativada) {
        throw criarErro(
          "Não foi possível desativar a conta.",
          409,
          "CONTA_NAO_DESATIVADA"
        );
      }

      return {
        conta: contaDesativada,
        reservas,
      };
    }
  );

  const reservasAcesso = resultado.reservas.map(
    (reserva) => {
      const acesso = gerarAcessoClienteDesativado({
        agendamentoId: reserva.id,
        usuarioId: usuario,
        desativadoEm: resultado.conta.desativado_em,
      });

      return {
        ...reserva,
        acesso,
        caminho:
          `/agendamento-acesso/${reserva.id}?token=${encodeURIComponent(acesso)}`,
      };
    }
  );

  return {
    mensagem:
      reservasAcesso.length > 0
        ? "Conta desativada. Seus agendamentos continuam válidos; guarde os acessos abaixo para consultar ou cancelar quando permitido."
        : "Conta desativada com sucesso.",
    conta: {
      id: resultado.conta.id,
      ativo: false,
      desativado_em:
        resultado.conta.desativado_em,
    },
    reservas_acesso: reservasAcesso,
  };
}

async function excluirContaDefinitivamente({
  usuarioId,
}) {
  const usuario = normalizarId(usuarioId);

  if (!usuario) {
    throw criarErro(
      "Usuário não autenticado.",
      401,
      "NAO_AUTENTICADO"
    );
  }

  return db.executarTransacao(async (client) => {
    const conta =
      await encerramentoRepository.bloquearUsuario(
        usuario,
        client
      );

    if (!conta) {
      throw criarErro(
        "Conta não encontrada.",
        404,
        "CONTA_NAO_ENCONTRADA"
      );
    }

    if (conta.encerrado_definitivo_em) {
      throw criarErro(
        "Esta conta já foi encerrada definitivamente.",
        409,
        "CONTA_JA_ENCERRADA"
      );
    }

    const negocio =
      await encerramentoRepository.buscarNegocioOperacionalDoDono(
        usuario,
        client,
        { bloquear: true }
      );

    let negocioArquivado = null;

    if (negocio) {
      negocioArquivado =
        await arquivarNegocioNaTransacao({
          negocio,
          usuarioId: usuario,
          motivo: "exclusao_proprietaria",
          executor: client,
        });
    }

    const reservasProfissional =
      await encerramentoRepository.contarReservasAtivasProfissional(
        usuario,
        client
      );

    if (reservasProfissional > 0) {
      throw criarErro(
        "Resolva todos os agendamentos confirmados atribuídos a você antes do encerramento definitivo.",
        409,
        "PROFISSIONAL_COM_AGENDAMENTOS"
      );
    }

    const reservasCliente =
      await encerramentoRepository.listarReservasAtivasCliente(
        usuario,
        client
      );

    if (reservasCliente.length > 0) {
      throw criarErro(
        "Você possui agendamentos confirmados como cliente. Desative a conta para preservar o acesso seguro às reservas ou resolva os agendamentos antes do encerramento definitivo.",
        409,
        "CLIENTE_COM_AGENDAMENTOS"
      );
    }

    await encerramentoRepository.desativarVinculosDoUsuario(
      usuario,
      client
    );

    const encerrada =
      await encerramentoRepository.encerrarUsuarioDefinitivamente(
        usuario,
        client
      );

    if (!encerrada) {
      throw criarErro(
        "Não foi possível encerrar a conta.",
        409,
        "CONTA_NAO_ENCERRADA"
      );
    }

    return {
      mensagem:
        "Conta encerrada definitivamente. Registros necessários para histórico, segurança, auditoria e retenção permanecem preservados.",
      conta: {
        id: encerrada.id,
        ativo: false,
        encerrado_definitivo_em:
          encerrada.encerrado_definitivo_em,
      },
      negocio_arquivado: negocioArquivado,
    };
  });
}

async function resolverReservaDesativada({
  agendamentoId,
  acesso,
  bloquear = false,
  executor = db,
}) {
  const id = normalizarId(agendamentoId);

  if (!id) {
    throw criarErro(
      "Acesso do agendamento inválido.",
      403,
      "ACESSO_INVALIDO"
    );
  }

  const reserva =
    await encerramentoRepository.buscarReservaClienteDesativado(
      id,
      executor,
      { bloquear }
    );

  if (
    !reserva ||
    !validarAcessoClienteDesativado({
      agendamentoId: id,
      usuarioId: reserva.cliente_id,
      desativadoEm: reserva.desativado_em,
      acesso,
    })
  ) {
    throw criarErro(
      "Acesso do agendamento inválido.",
      403,
      "ACESSO_INVALIDO"
    );
  }

  return reserva;
}

async function consultarReservaClienteDesativado({
  agendamentoId,
  acesso,
}) {
  const reserva = await resolverReservaDesativada({
    agendamentoId,
    acesso,
  });

  return {
    agendamento: {
      id: reserva.id,
      status: reserva.status,
      data: reserva.data,
      horario: reserva.horario,
      servico_nome: reserva.servico_nome,
      profissional_nome: reserva.profissional_nome,
      negocio_nome: reserva.negocio_nome,
      antecedencia_cancelamento_horas:
        reserva.antecedencia_cancelamento_horas,
      fuso_horario: reserva.fuso_horario,
    },
  };
}

async function cancelarReservaClienteDesativado({
  agendamentoId,
  acesso,
}) {
  const id = normalizarId(agendamentoId);

  return db.executarTransacao(async (client) => {
    const reserva = await resolverReservaDesativada({
      agendamentoId: id,
      acesso,
      bloquear: true,
      executor: client,
    });

    validarAgendamentoCancelavel(reserva);

    const cancelado =
      await agendamentoCancelamentoRepository.cancelarAgendamentoCliente({
        agendamentoId: id,
        clienteId: reserva.cliente_id,
        executor: client,
      });

    if (!cancelado) {
      throw criarErro(
        "Não foi possível cancelar o agendamento.",
        409,
        "AGENDAMENTO_NAO_CANCELADO"
      );
    }

    await whatsappMensagemService.enfileirarCancelamento({
      executor: client,
      agendamentoId: id,
    });

    return {
      mensagem:
        "Agendamento cancelado com sucesso.",
      agendamento: cancelado,
    };
  });
}

module.exports = {
  montarPendenciasNegocio,
  encerrarNegocio,
  desativarConta,
  excluirContaDefinitivamente,
  consultarReservaClienteDesativado,
  cancelarReservaClienteDesativado,
};
