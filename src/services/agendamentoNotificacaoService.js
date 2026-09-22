const agendaPublicaRepository = require(
  "../repositories/agendaPublicaRepository"
);
const registrador = require("../utils/registrador");

async function notificarEquipeInternamente({
  agendamentoId,
  titulo,
  mensagem,
}) {
  try {
    const contexto =
      await agendaPublicaRepository
        .buscarContextoNotificacaoAgendamento(
          agendamentoId
        );

    if (!contexto) {
      return {
        enviados: 0,
        falhas: 0,
      };
    }

    const destinatarios = [
      contexto.profissional_id,
      contexto.dono_id,
    ]
      .map(Number)
      .filter(
        (id) =>
          Number.isInteger(id) &&
          id > 0
      );

    const unicos = [
      ...new Set(destinatarios),
    ];

    const resultados =
      await Promise.allSettled(
        unicos.map((usuarioId) =>
          agendaPublicaRepository
            .criarNotificacaoAgendamento({
              usuarioId,
              negocioId:
                contexto.negocio_id,
              agendamentoId:
                contexto.agendamento_id,
              titulo,
              mensagem,
            })
        )
      );

    const falhas =
      resultados.filter(
        (item) =>
          item.status === "rejected"
      );

    if (falhas.length > 0) {
      registrador.erro(
        "Falha parcial ao registrar notificações internas do agendamento.",
        {
          agendamentoId:
            Number(agendamentoId),
          falhas:
            falhas.length,
        }
      );
    }

    return {
      enviados:
        resultados.length -
        falhas.length,
      falhas:
        falhas.length,
    };
  } catch (erro) {
    registrador.erro(
      "Erro ao registrar notificações internas do agendamento.",
      {
        agendamentoId:
          Number(agendamentoId) ||
          null,
        mensagem:
          erro?.message ||
          "Erro desconhecido.",
      }
    );

    return {
      enviados: 0,
      falhas: 1,
    };
  }
}

module.exports = {
  notificarEquipeInternamente,
};
