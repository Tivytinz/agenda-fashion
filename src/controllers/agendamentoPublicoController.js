// const {
//   verificarCapacidadePlano,
// } = require("../services/planoService");

const agendaPublicaService = require(
  "../services/agendamentoPublicoService"
);

function statusErro(erro) {
  return erro.statusCode || erro.status || 500;
}

function mensagemErro(erro, mensagemPadrao) {
  const status = statusErro(erro);

  if (status >= 500) {
    return mensagemPadrao;
  }

  return erro.message || mensagemPadrao;
}

function registrarErroInterno(contexto, erro) {
  const status = statusErro(erro);

  /*
   * Erros 4xx são respostas esperadas:
   * validação, autenticação, recurso inexistente
   * ou conflito de horário.
   */
  if (status < 500) {
    return;
  }

  console.error(contexto, erro);
}

async function buscarAgendaPublica(req, res) {
  try {
    const {
      slug,
      servicoId,
      profissionalId,
    } = req.query;

    if (
      !slug ||
      !servicoId ||
      !profissionalId
    ) {
      return res.status(400).json({
        erro:
          "Slug, serviço e profissional são obrigatórios.",
      });
    }

    const {
      negocio,
      servico,
      profissional,
    } =
      await agendaPublicaService.buscarDadosBaseAgenda({
        slug,
        servicoId,
        profissionalId,
      });

    const disponibilidade =
      await agendaPublicaService.buscarDisponibilidade({
        profissionalId:
          profissional.id,

        duracaoServico:
          servico.duracao_minutos,
      });

    return res.json({
      negocio,
      servico,
      profissional,
      disponibilidade,
    });
  } catch (erro) {
    registrarErroInterno(
      "Erro ao carregar agenda pública:",
      erro
    );

    return res
      .status(statusErro(erro))
      .json({
        erro: mensagemErro(
          erro,
          "Erro ao carregar agenda pública."
        ),
      });
  }
}

async function criarAgendamentoPublico(req, res) {
  try {
    let clienteId =
      req.user?.id || null;

    const tipoUsuario =
      req.user?.tipo || null;

    const {
      slug,
      servico_id,
      profissional_id,
      data,
      horario,
      cliente_nome,
      cliente_whatsapp,
    } = req.body;

    if (
      clienteId &&
      tipoUsuario !== "cliente"
    ) {
      return res.status(403).json({
        erro:
          "Apenas clientes podem agendar.",
      });
    }

    if (
      !slug ||
      !servico_id ||
      !profissional_id ||
      !data ||
      !horario
    ) {
      return res.status(400).json({
        erro:
          "Dados do agendamento incompletos.",
      });
    }

    /*
     * Valida se negócio, serviço e profissional
     * existem e pertencem uns aos outros.
     */
    const {
      negocio,
      servico,
      profissional,
    } =
      await agendaPublicaService.buscarDadosBaseAgenda({
        slug,

        servicoId:
          servico_id,

        profissionalId:
          profissional_id,
      });

    /*
     * Primeira verificação da disponibilidade.
     *
     * Evita criar um usuário visitante quando
     * o horário já estiver inválido.
     */
    await agendaPublicaService.validarHorarioDisponivel({
      profissionalId:
        profissional.id,

      data,
      horario,

      duracaoServico:
        servico.duracao_minutos,
    });

    /*
     * O cliente só é localizado ou criado
     * depois da primeira validação do horário.
     */
    clienteId =
      await agendaPublicaService.obterOuCriarCliente({
        clienteId,

        clienteNome:
          cliente_nome,

        clienteWhatsapp:
          cliente_whatsapp,
      });

    // Validação do plano desabilitada
    // temporariamente para testes.
    //
    // await verificarCapacidadePlano(
    //   negocio.id
    // );

    /*
     * A criação abre uma transação,
     * bloqueia a agenda do profissional,
     * recalcula a disponibilidade
     * e só então executa o INSERT.
     */
    const agendamento =
      await agendaPublicaService.criarAgendamento({
        data,
        horario,

        profissionalId:
          profissional.id,

        clienteId,

        servicoId:
          servico.id,

        negocioId:
          negocio.id,

        duracaoServico:
          servico.duracao_minutos,

        clienteNome:
          cliente_nome,

        servicoNome:
          servico.nome,

        profissionalNome:
          profissional.nome,

        whatsappProfissional:
          profissional.whatsapp,

        whatsappNegocio:
          negocio.whatsapp_negocio,
      });

    await agendaPublicaService.criarNotificacaoAgendamento({
      usuarioId:
        profissional.id,

      negocioId:
        negocio.id,

      agendamentoId:
        agendamento.id,

      titulo:
        "Novo agendamento",

      mensagem:
        `Novo agendamento: ${servico.nome} ` +
        `em ${data} às ${horario}.`,
    });

    return res.status(201).json({
      mensagem:
        "Agendamento criado com sucesso.",

      agendamento,
    });
  } catch (erro) {
    registrarErroInterno(
      "Erro ao criar agendamento público:",
      erro
    );

    return res
      .status(statusErro(erro))
      .json({
        erro: mensagemErro(
          erro,
          "Erro ao criar agendamento."
        ),
      });
  }
}

async function listarMeusAgendamentos(req, res) {
  try {
    const resultado =
      await agendaPublicaService.listarMeusAgendamentos({
        clienteId:
          req.user?.id,

        tipoUsuario:
          req.user?.tipo,
      });

    return res.json(resultado);
  } catch (erro) {
    registrarErroInterno(
      "Erro ao carregar agendamentos:",
      erro
    );

    return res
      .status(statusErro(erro))
      .json({
        erro: mensagemErro(
          erro,
          "Erro ao carregar agendamentos."
        ),
      });
  }
}

async function cancelarMeuAgendamento(req, res) {
  try {
    const resultado =
      await agendaPublicaService.cancelarMeuAgendamento({
        clienteId:
          req.user?.id,

        tipoUsuario:
          req.user?.tipo,

        agendamentoId:
          req.params.id,
      });

    return res.json(resultado);
  } catch (erro) {
    registrarErroInterno(
      "Erro ao cancelar agendamento:",
      erro
    );

    return res
      .status(statusErro(erro))
      .json({
        erro: mensagemErro(
          erro,
          "Erro ao cancelar agendamento."
        ),
      });
  }
}

async function avaliarAgendamento(req, res) {
  try {
    const resultado =
      await agendaPublicaService.avaliarAgendamento({
        clienteId:
          req.user?.id,

        tipoUsuario:
          req.user?.tipo,

        agendamentoId:
          req.params.id,

        avaliacao:
          req.body.avaliacao,
      });

    return res.json(resultado);
  } catch (erro) {
    registrarErroInterno(
      "Erro ao avaliar agendamento:",
      erro
    );

    return res
      .status(statusErro(erro))
      .json({
        erro: mensagemErro(
          erro,
          "Erro ao avaliar agendamento."
        ),
      });
  }
}

module.exports = {
  buscarAgendaPublica,
  criarAgendamentoPublico,
  listarMeusAgendamentos,
  cancelarMeuAgendamento,
  avaliarAgendamento,
};