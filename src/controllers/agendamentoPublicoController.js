//const { verificarCapacidadePlano } = require("../services/planoService");
const agendaPublicaService = require("../services/agendamentoPublicoService");

function statusErro(err) {
  return err.statusCode || err.status || 500;
}

function mensagemErro(err, fallback) {
  return err.message || fallback;
}

async function buscarAgendaPublica(req, res) {
  try {
    const { slug, servicoId, profissionalId } = req.query;

    if (!slug || !servicoId || !profissionalId) {
      return res.status(400).json({
        erro: "Slug, serviço e profissional são obrigatórios."
      });
    }

    const { negocio, servico, profissional } =
      await agendaPublicaService.buscarDadosBaseAgenda({
        slug,
        servicoId,
        profissionalId
      });

    const disponibilidade =
      await agendaPublicaService.buscarDisponibilidade({
        profissionalId: profissional.id,
      });

    return res.json({
      negocio,
      servico,
      profissional,
      disponibilidade
    });

  } catch (err) {
    return res.status(statusErro(err)).json({
      erro: mensagemErro(err, "Erro ao carregar agenda pública.")
    });
  }
}

async function criarAgendamentoPublico(req, res) {
  try {
    let clienteId = req.user?.id || null;
    const tipoUsuario = req.user?.tipo || null;

    const {
      slug,
      servico_id,
      profissional_id,
      data,
      horario,
      cliente_nome,
      cliente_whatsapp
    } = req.body;

    if (clienteId && tipoUsuario !== "cliente") {
      return res.status(403).json({
        erro: "Apenas clientes podem agendar."
      });
    }

    if (!slug || !servico_id || !profissional_id || !data || !horario) {
      return res.status(400).json({
        erro: "Dados do agendamento incompletos."
      });
    }

    clienteId = await agendaPublicaService.obterOuCriarCliente({
      clienteId,
      clienteNome: cliente_nome,
      clienteWhatsapp: cliente_whatsapp,
    });

    const { negocio, servico, profissional } =
      await agendaPublicaService.buscarDadosBaseAgenda({
        slug,
        servicoId: servico_id,
        profissionalId: profissional_id,
      });

    await agendaPublicaService.validarHorarioDisponivel({
      profissionalId: profissional.id,
      data,
      horario,
    });

    // Validação do plano desabilitada temporariamente para testes.

    const agendamento = await agendaPublicaService.criarAgendamento({
      data,
      horario,
      profissionalId: profissional.id,
      clienteId,
      servicoId: servico_id,
      negocioId: negocio.id,
      clienteNome: cliente_nome,
      servicoNome: servico.nome,
      profissionalNome: profissional.nome,
      whatsappProfissional: profissional.whatsapp,
      whatsappNegocio: negocio.whatsapp_negocio,
    });

    await agendaPublicaService.criarNotificacaoAgendamento({
      usuarioId: profissional.id,
      negocioId: negocio.id,
      agendamentoId: agendamento.id,
      titulo: "Novo agendamento",
      mensagem: `Novo agendamento: ${servico.nome} em ${data} às ${horario}.`,
    });

    return res.status(201).json({
      mensagem: "Agendamento criado com sucesso.",
      agendamento
    });

  } catch (err) {
    return res.status(statusErro(err)).json({
      erro: mensagemErro(err, "Erro ao criar agendamento.")
    });
  }
}

async function listarMeusAgendamentos(req, res) {
  try {
    const resultado =
      await agendaPublicaService.listarMeusAgendamentos({
        clienteId: req.user?.id,
        tipoUsuario: req.user?.tipo,
      });

    return res.json(resultado);

  } catch (err) {
    return res.status(statusErro(err)).json({
      erro: mensagemErro(err, "Erro ao carregar agendamentos.")
    });
  }
}

async function cancelarMeuAgendamento(req, res) {
  try {
    const resultado =
      await agendaPublicaService.cancelarMeuAgendamento({
        clienteId: req.user?.id,
        tipoUsuario: req.user?.tipo,
        agendamentoId: req.params.id,
      });

    return res.json(resultado);

  } catch (err) {
    return res.status(statusErro(err)).json({
      erro: mensagemErro(err, "Erro ao cancelar agendamento.")
    });
  }
}

async function avaliarAgendamento(req, res) {
  try {
    const resultado =
      await agendaPublicaService.avaliarAgendamento({
        clienteId: req.user?.id,
        tipoUsuario: req.user?.tipo,
        agendamentoId: req.params.id,
        avaliacao: req.body.avaliacao,
      });

    return res.json(resultado);

  } catch (err) {
    return res.status(statusErro(err)).json({
      erro: mensagemErro(err, "Erro ao avaliar agendamento.")
    });
  }
}

module.exports = {
  buscarAgendaPublica,
  criarAgendamentoPublico,
  listarMeusAgendamentos,
  cancelarMeuAgendamento,
  avaliarAgendamento
};