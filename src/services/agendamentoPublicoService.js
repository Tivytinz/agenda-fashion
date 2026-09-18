const db = require("../db/db");
const agendaPublicaRepository = require(
  "../repositories/agendaPublicaRepository"
);
const agendaConfiguracaoRepository = require(
  "../repositories/agendaConfiguracaoRepository"
);
const agendaDisponibilidadeService = require(
  "./agendaDisponibilidadeService"
);
const whatsappMensagemService = require(
  "./whatsappMensagemService"
);
const planoService = require("./planoService");
const {
  criarErro,
  normalizarId,
  normalizarTexto,
  normalizarWhatsapp,
  normalizarHorario,
  dataValida,
  validarIdentificacaoVisitante,
} = require("./agendamentoPublicoValidacoes");
const {
  listarMeusAgendamentos,
  cancelarMeuAgendamento,
  avaliarAgendamento,
} = require("./agendamentoClienteService");

async function buscarDadosBaseAgenda({
  slug,
  servicoId,
  profissionalId,
}) {
  const slugNormalizado =
    normalizarTexto(
      slug,
      180
    ).toLowerCase();

  const servicoIdNormalizado =
    normalizarId(
      servicoId
    );

  const profissionalIdNormalizado =
    normalizarId(
      profissionalId
    );

  if (
    !slugNormalizado ||
    !servicoIdNormalizado ||
    !profissionalIdNormalizado
  ) {
    throw criarErro(
      "Negócio, serviço e profissional são obrigatórios.",
      400
    );
  }

  const negocio =
    await agendaPublicaRepository
      .buscarNegocioPorSlug(
        slugNormalizado
      );

  if (!negocio) {
    throw criarErro(
      "Negócio não encontrado.",
      404
    );
  }

  const servico =
    await agendaPublicaRepository
      .buscarServicoDoNegocio(
        servicoIdNormalizado,
        negocio.id
      );

  if (!servico) {
    throw criarErro(
      "Serviço não encontrado nesse negócio.",
      404
    );
  }

  const profissional =
    await agendaPublicaRepository
      .buscarProfissionalDoNegocio(
        profissionalIdNormalizado,
        negocio.id,
        servico.id
      );

  if (!profissional) {
    throw criarErro(
      "Profissional não está habilitada para este serviço.",
      409
    );
  }

  return {
    negocio,
    servico,
    profissional,
  };
}

async function buscarDisponibilidade({
  profissionalId,
  negocioId,
  duracaoServico,
  fusoHorario,
}) {
  const profissionalIdNormalizado =
    normalizarId(
      profissionalId
    );

  const negocioIdNormalizado =
    normalizarId(
      negocioId
    );

  if (
    !profissionalIdNormalizado ||
    !negocioIdNormalizado
  ) {
    throw criarErro(
      "Profissional e negócio são obrigatórios.",
      400
    );
  }

  return (
    agendaDisponibilidadeService
      .buscarDisponibilidade({
        profissionalId:
          profissionalIdNormalizado,

        negocioId:
          negocioIdNormalizado,

        duracaoServico,

        quantidadeDias:
          7,

        fusoHorario,
      })
  );
}

/*
 * O nome foi mantido para não quebrar
 * o controller durante a refatoração.
 *
 * Visitantes não são mais cadastrados
 * na tabela usuarios.
 *
 * Para visitante, valida os dados e
 * retorna null como clienteId.
 */
async function obterOuCriarCliente({
  clienteId,
  clienteNome,
  clienteWhatsapp,
}) {
  const id =
    normalizarId(
      clienteId
    );

  if (id) {
    return id;
  }

  validarIdentificacaoVisitante({
    clienteNome,
    clienteWhatsapp,
  });

  return null;
}

async function resolverConsentimentoWhatsapp({
  clienteId,
  clienteWhatsapp,
  consentimentoVisitante = false,
}) {
  const id = normalizarId(
    clienteId
  );

  if (!id) {
    return consentimentoVisitante === true;
  }

  const preferencia =
    await agendaPublicaRepository
      .buscarPreferenciaNotificacoesWhatsapp(
        id
      );

  if (!preferencia) {
    throw criarErro(
      "Usuário não autenticado.",
      401
    );
  }

  const whatsappConta =
    normalizarWhatsapp(
      preferencia.whatsapp
    );
  const whatsappAgendamento =
    normalizarWhatsapp(
      clienteWhatsapp
    );

  return (
    preferencia
      .aceita_notificacoes_whatsapp ===
      true &&
    [10, 11].includes(
      whatsappConta.length
    ) &&
    whatsappConta ===
      whatsappAgendamento
  );
}

async function validarHorarioDisponivel({
  profissionalId,
  negocioId,
  data,
  horario,
  duracaoServico,
  fusoHorario,
}) {
  const profissionalIdNormalizado =
    normalizarId(
      profissionalId
    );

  const negocioIdNormalizado =
    normalizarId(
      negocioId
    );

  const horarioNormalizado =
    normalizarHorario(
      horario
    );

  if (
    !profissionalIdNormalizado ||
    !negocioIdNormalizado ||
    !dataValida(data) ||
    !horarioNormalizado
  ) {
    throw criarErro(
      "Profissional, negócio, data e horário são obrigatórios.",
      400
    );
  }

  const estaDisponivel =
    await agendaDisponibilidadeService
      .horarioEstaDisponivel({
        profissionalId:
          profissionalIdNormalizado,

        negocioId:
          negocioIdNormalizado,

        duracaoServico,

        data,

        horario:
          horarioNormalizado,

        fusoHorario,
      });

  if (!estaDisponivel) {
    throw criarErro(
      "Esse horário não está mais disponível. Escolha outro horário.",
      409
    );
  }

  return true;
}

async function criarAgendamento({
  data,
  horario,
  profissionalId,

  clienteId = null,
  clienteNome = null,
  clienteWhatsapp = null,
  whatsappConsentido = false,

  servicoId,
  negocioId,
  duracaoServico,
  fusoHorario,

  servicoNome,
  servicoValor,
  profissionalNome,
  whatsappProfissional,
  whatsappNegocio,
}) {
  const profissionalIdNormalizado =
    normalizarId(
      profissionalId
    );

  const clienteIdNormalizado =
    normalizarId(
      clienteId
    );

  const servicoIdNormalizado =
    normalizarId(
      servicoId
    );

  const negocioIdNormalizado =
    normalizarId(
      negocioId
    );

  const horarioNormalizado =
    normalizarHorario(
      horario
    );

  if (
    !dataValida(data) ||
    !horarioNormalizado ||
    !profissionalIdNormalizado ||
    !servicoIdNormalizado ||
    !negocioIdNormalizado
  ) {
    throw criarErro(
      "Dados do agendamento incompletos.",
      400
    );
  }

  let nomeNormalizado =
    normalizarTexto(
      clienteNome,
      120
    ) || null;

  let whatsappNormalizado =
    normalizarWhatsapp(
      clienteWhatsapp
    ) || null;

  /*
   * Somente visitante precisa fornecer
   * nome e WhatsApp obrigatoriamente.
   */
  if (
    !clienteIdNormalizado
  ) {
    const visitante =
      validarIdentificacaoVisitante({
        clienteNome:
          nomeNormalizado,

        clienteWhatsapp:
          whatsappNormalizado,
      });

    nomeNormalizado =
      visitante.clienteNome;

    whatsappNormalizado =
      visitante.clienteWhatsapp;
  }

  const duracaoRecebida =
    Number(
      duracaoServico
    );

  const duracaoMinutos =
    Number.isInteger(
      duracaoRecebida
    ) &&
    duracaoRecebida > 0
      ? duracaoRecebida
      : 60;

  const valorServico =
    Number(
      servicoValor
    );

  if (
    !Number.isFinite(
      valorServico
    ) ||
    valorServico < 0
  ) {
    throw criarErro(
      "Valor do serviço inválido.",
      400
    );
  }

  const agendamento =
    await db.executarTransacao(
      async (client) => {
        /*
         * Serializa o consumo mensal do negócio e valida
         * o limite na mesma transação do INSERT.
         */
        await planoService
          .verificarCapacidadePlano(
            negocioIdNormalizado,
            client,
            {
              bloquear: true,
              dataReferencia:
                data,
            }
          );

        /*
         * Bloqueio por profissional e data.
         * Evita duas reservas simultâneas
         * para o mesmo horário, inclusive entre negócios.
         */
        await agendaPublicaRepository
          .bloquearAgendaProfissional(
            client,
            profissionalIdNormalizado,
            data
          );

        /*
         * Recalcula a disponibilidade do negócio
         * depois de adquirir o bloqueio global da pessoa.
         */
        const disponivel =
          await agendaDisponibilidadeService
            .horarioEstaDisponivel({
              profissionalId:
                profissionalIdNormalizado,

              negocioId:
                negocioIdNormalizado,

              duracaoServico:
                duracaoMinutos,

              data,

              horario:
                horarioNormalizado,

              fusoHorario,
            });

        if (!disponivel) {
          throw criarErro(
            "Esse horário não está mais disponível. Escolha outro horário.",
            409
          );
        }

        const clienteInterno =
          await agendaPublicaRepository
            .resolverClienteInterno(
              {
                usuarioId:
                  clienteIdNormalizado,

                nome:
                  nomeNormalizado,

                whatsapp:
                  whatsappNormalizado,
              },
              client
            );

        if (!clienteInterno?.id) {
          throw criarErro(
            "Não foi possível associar o cliente ao agendamento.",
            500
          );
        }

        const criado =
          await agendaPublicaRepository
            .criarAgendamento(
              {
                data,

                horario:
                  horarioNormalizado,

                profissionalId:
                  profissionalIdNormalizado,

                clienteId:
                  clienteIdNormalizado,

                clientId:
                  clienteInterno.id,

                clienteNome:
                  clienteInterno.nome,

                clienteWhatsapp:
                  clienteInterno.whatsapp,

                whatsappConsentido:
                  whatsappConsentido ===
                  true,

                servicoId:
                  servicoIdNormalizado,

                valorServico,

                negocioId:
                  negocioIdNormalizado,
              },
              client
            );

        if (
          !criado?.id
        ) {
          throw criarErro(
            "Não foi possível confirmar o agendamento.",
            500
          );
        }

        if (
          whatsappConsentido === true
        ) {
          await agendaPublicaRepository
            .registrarConsentimentoWhatsappAgendamento(
              {
                agendamentoId:
                  criado.id,
                clienteId:
                  clienteIdNormalizado,
                telefone:
                  whatsappNormalizado,
              },
              client
            );
        }

        /*
         * O agendamento e suas mensagens entram no banco
         * juntos. Se qualquer INSERT falhar, nada é
         * confirmado pela metade.
         */
        await whatsappMensagemService
          .enfileirarNovoAgendamento({
            executor:
              client,

            agendamentoId:
              criado.id,
          });

        return criado;
      }
    );

  if (
    !agendamento?.id
  ) {
    throw criarErro(
      "Não foi possível confirmar o agendamento.",
      500
    );
  }

  return agendamento;
}

async function criarNotificacaoAgendamento({
  usuarioId,
  negocioId,
  agendamentoId,
  titulo,
  mensagem,
}) {
  const usuarioIdNormalizado =
    normalizarId(
      usuarioId
    );

  const negocioIdNormalizado =
    normalizarId(
      negocioId
    );

  const agendamentoIdNormalizado =
    normalizarId(
      agendamentoId
    );

  if (
    !usuarioIdNormalizado ||
    !negocioIdNormalizado ||
    !agendamentoIdNormalizado
  ) {
    throw criarErro(
      "Dados da notificação incompletos.",
      400
    );
  }

  return (
    agendaPublicaRepository
      .criarNotificacaoAgendamento({
        usuarioId:
          usuarioIdNormalizado,

        negocioId:
          negocioIdNormalizado,

        agendamentoId:
          agendamentoIdNormalizado,

        titulo:
          normalizarTexto(
            titulo,
            160
          ),

        mensagem:
          normalizarTexto(
            mensagem,
            2000
          ),
      })
  );
}

module.exports = {
  buscarDadosBaseAgenda,
  buscarDisponibilidade,
  obterOuCriarCliente,
  resolverConsentimentoWhatsapp,
  validarHorarioDisponivel,
  criarAgendamento,
  criarNotificacaoAgendamento,
  listarMeusAgendamentos,
  cancelarMeuAgendamento,
  avaliarAgendamento,
};
