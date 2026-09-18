const agendamentoCancelamentoService = require(
  "../services/agendamentoCancelamentoService"
);

async function buscarPoliticaPublica(req, res, next) {
  try {
    const politica =
      await agendamentoCancelamentoService.buscarPoliticaPublica({
        slug: req.query.slug,
        profissionalId:
          req.query.profissionalId ||
          req.query.profissional_id,
      });

    return res.json({
      politica_cancelamento: politica,
    });
  } catch (error) {
    return next(error);
  }
}

async function validarPoliticaExibida(req, res, next) {
  try {
    await agendamentoCancelamentoService.validarPoliticaEsperada({
      slug: req.body?.slug,
      profissionalId: req.body?.profissional_id,
      antecedenciaEsperada:
        req.body?.antecedencia_cancelamento_esperada,
    });

    return next();
  } catch (error) {
    return next(error);
  }
}

async function cancelarCliente(req, res, next) {
  try {
    const agendamento =
      await agendamentoCancelamentoService.cancelarAgendamentoCliente({
        agendamentoId: req.params.id,
        clienteId: req.user?.id,
      });

    return res.json({
      mensagem: "Agendamento cancelado com sucesso.",
      agendamento,
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelarVisitante(req, res, next) {
  try {
    const agendamento =
      await agendamentoCancelamentoService.cancelarAgendamentoVisitante({
        agendamentoId: req.params.id,
        acessoVisitante: req.body?.acesso_visitante,
      });

    return res.json({
      mensagem: "Agendamento cancelado com sucesso.",
      agendamento,
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelarOperacional(req, res, next) {
  try {
    const resultado =
      await agendamentoCancelamentoService.cancelarAgendamentoOperacional({
        agendamentoId: req.params.id,
        negocioId: req.agendaContexto?.negocioId,
        usuarioId: req.user?.id,
        motivoTipo: req.body?.motivo_tipo,
        motivo: req.body?.motivo,
      });

    return res.json({
      mensagem: resultado.ja_cancelado
        ? "Agendamento já estava cancelado."
        : "Agendamento cancelado pelo negócio com sucesso.",
      agendamento: resultado.agendamento,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  buscarPoliticaPublica,
  validarPoliticaExibida,
  cancelarCliente,
  cancelarVisitante,
  cancelarOperacional,
};
