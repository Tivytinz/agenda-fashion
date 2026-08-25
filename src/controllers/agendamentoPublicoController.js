const agendaPublicaService = require(
  "../services/agendamentoPublicoService"
);

const planoService = require(
  "../services/planoService"
);
const registrador = require(
  "../utils/registrador"
);

function encaminharErro(erro, next) {
  return next(erro);
}

async function buscarAgendaPublica(
  req,
  res,
  next
) {
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
      return res
        .status(400)
        .json({
          erro:
            "Slug, serviço e profissional são obrigatórios.",
        });
    }

    const {
      negocio,
      servico,
      profissional,
    } =
      await agendaPublicaService
        .buscarDadosBaseAgenda({
          slug,
          servicoId,
          profissionalId,
        });

    const disponibilidade =
      await agendaPublicaService
        .buscarDisponibilidade({
          profissionalId:
            profissional.id,

          duracaoServico:
            servico.duracao_minutos,
        });

    const usosPorMes =
      new Map();

    const disponibilidadeDoPlano = [];

    for (const dia of disponibilidade) {
      const chaveMes =
        String(dia?.data || "")
          .slice(0, 7);

      if (!usosPorMes.has(chaveMes)) {
        usosPorMes.set(
          chaveMes,
          await planoService
            .buscarUsoPlano(
              negocio.id,
              undefined,
              dia.data
            )
        );
      }

      const usoPlano =
        usosPorMes.get(chaveMes);

      const mesDisponivel =
        !usoPlano ||
        usoPlano.ilimitado ||
        usoPlano.utilizados <
          Number(
            usoPlano
              .capacidade_agendamentos ||
            0
          );

      if (mesDisponivel) {
        disponibilidadeDoPlano.push(
          dia
        );
      }
    }

    const agendaIndisponivel =
      disponibilidade.length > 0 &&
      disponibilidadeDoPlano.length === 0;

    return res.json({
      negocio,
      servico,
      profissional,
      disponibilidade:
        disponibilidadeDoPlano,
      agenda_indisponivel:
        agendaIndisponivel,
      mensagem:
        agendaIndisponivel
          ? "Novos horários em breve."
          : undefined,
    });
  } catch (erro) {
    return encaminharErro(erro, next);
  }
}

async function criarAgendamentoPublico(
  req,
  res,
  next
) {
  try {
    /*
     * O optionalAuth adiciona req.user
     * somente quando existe um JWT válido.
     *
     * Não existe mais usuario.tipo.
     */
    const clienteId =
      req.user?.id || null;

    const {
      slug,
      servico_id,
      profissional_id,
      data,
      horario,
      cliente_nome,
      cliente_whatsapp,
      aceita_mensagens_whatsapp,
    } = req.body || {};

    if (
      !slug ||
      !servico_id ||
      !profissional_id ||
      !data ||
      !horario
    ) {
      return res
        .status(400)
        .json({
          erro:
            "Dados do agendamento incompletos.",
        });
    }

    /*
     * Primeiro valida se o serviço e
     * profissional realmente pertencem
     * ao negócio informado.
     */
    const {
      negocio,
      servico,
      profissional,
    } =
      await agendaPublicaService
        .buscarDadosBaseAgenda({
          slug,

          servicoId:
            servico_id,

          profissionalId:
            profissional_id,
        });

    /*
     * Validação rápida antes de iniciar
     * a transação de criação.
     *
     * O horário será validado novamente
     * pelo service dentro da transação.
     */
    await agendaPublicaService
      .validarHorarioDisponivel({
        profissionalId:
          profissional.id,

        data,
        horario,

        duracaoServico:
          servico.duracao_minutos,
      });

    /*
     * Conta autenticada:
     * retorna o próprio usuario.id.
     *
     * Visitante:
     * valida nome e WhatsApp e retorna null.
     */
    const clienteIdValidado =
      await agendaPublicaService
        .obterOuCriarCliente({
          clienteId,

          clienteNome:
            cliente_nome,

          clienteWhatsapp:
            cliente_whatsapp,
        });

    const whatsappConsentido =
      await agendaPublicaService
        .resolverConsentimentoWhatsapp({
          clienteId:
            clienteIdValidado,
          clienteWhatsapp:
            cliente_whatsapp,
          consentimentoVisitante:
            aceita_mensagens_whatsapp ===
            true,
        });

    const agendamento =
      await agendaPublicaService
        .criarAgendamento({
          data,
          horario,

          profissionalId:
            profissional.id,

          clienteId:
            clienteIdValidado,

          clienteNome:
            cliente_nome,

          clienteWhatsapp:
            cliente_whatsapp,

          whatsappConsentido:
            whatsappConsentido,

          servicoId:
            servico.id,

          negocioId:
            negocio.id,

          duracaoServico:
            servico.duracao_minutos,

          servicoNome:
            servico.nome,

          servicoValor:
            servico.valor,

          profissionalNome:
            profissional.nome,

          whatsappProfissional:
            profissional.whatsapp,

          whatsappNegocio:
            negocio.whatsapp_negocio ||
            negocio.whatsapp,
        });

    /*
     * O agendamento já foi confirmado.
     * Uma falha ao registrar a notificação
     * interna não deve transformar a
     * resposta em erro 500.
     */
    try {
      await agendaPublicaService
        .criarNotificacaoAgendamento({
          usuarioId:
            profissional.id,

          negocioId:
            negocio.id,

          agendamentoId:
            agendamento.id,

          titulo:
            "Novo agendamento",

          mensagem:
            `Novo agendamento: ` +
            `${servico.nome} em ` +
            `${data} às ${horario}.`,
        });
    } catch (
      erroNotificacao
    ) {
      registrador.erro(
        "Erro ao registrar notificação interna do agendamento:",
        {
          mensagem:
            erroNotificacao
              ?.message ||
            "Erro desconhecido.",

          status:
            erroNotificacao
              ?.statusCode ||
            erroNotificacao
              ?.status ||
            null,

          codigo:
            erroNotificacao
              ?.code ||
            null,
        }
      );
    }

    return res
      .status(201)
      .json({
        mensagem:
          "Agendamento criado com sucesso.",

        agendamento,
      });
  } catch (erro) {
    return encaminharErro(erro, next);
  }
}

async function listarMeusAgendamentos(
  req,
  res,
  next
) {
  try {
    const resultado =
      await agendaPublicaService
        .listarMeusAgendamentos({
          clienteId:
            req.user?.id,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return encaminharErro(erro, next);
  }
}

async function cancelarMeuAgendamento(
  req,
  res,
  next
) {
  try {
    const resultado =
      await agendaPublicaService
        .cancelarMeuAgendamento({
          clienteId:
            req.user?.id,

          agendamentoId:
            req.params.id,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return encaminharErro(erro, next);
  }
}

async function avaliarAgendamento(
  req,
  res
) {
  try {
    const resultado =
      await agendaPublicaService
        .avaliarAgendamento({
          clienteId:
            req.user?.id,

          agendamentoId:
            req.params.id,

          avaliacao:
            req.body?.avaliacao,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return res
      .status(
        statusErro(erro)
      )
      .json({
        erro:
          mensagemErro(
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
