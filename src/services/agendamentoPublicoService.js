const db = require("../db/db");

const agendaPublicaRepository = require(
  "../repositories/agendaPublicaRepository"
);

const agendaDisponibilidadeService = require(
  "./agendaDisponibilidadeService"
);

const notificationService = require(
  "./notificationService"
);

function criarErro(mensagem, statusCode) {
  const erro = new Error(mensagem);

  erro.status = statusCode;
  erro.statusCode = statusCode;

  return erro;
}

function validarClienteAutenticado({
  clienteId,
  tipoUsuario,
}) {
  if (!clienteId) {
    throw criarErro(
      "Cliente não autenticado.",
      401
    );
  }

  if (tipoUsuario !== "cliente") {
    throw criarErro(
      "Apenas clientes podem acessar este recurso.",
      403
    );
  }
}

async function buscarDadosBaseAgenda({
  slug,
  servicoId,
  profissionalId,
}) {
  if (
    !slug ||
    !servicoId ||
    !profissionalId
  ) {
    throw criarErro(
      "Negócio, serviço e profissional são obrigatórios.",
      400
    );
  }

  const negocio =
    await agendaPublicaRepository.buscarNegocioPorSlug(
      slug
    );

  if (!negocio) {
    throw criarErro(
      "Negócio não encontrado.",
      404
    );
  }

  const servico =
    await agendaPublicaRepository.buscarServicoDoNegocio(
      servicoId,
      negocio.id
    );

  if (!servico) {
    throw criarErro(
      "Serviço não encontrado nesse negócio.",
      404
    );
  }

  const profissional =
    await agendaPublicaRepository.buscarProfissionalDoNegocio(
      profissionalId,
      negocio.id
    );

  if (!profissional) {
    throw criarErro(
      "Profissional não pertence a esse negócio.",
      404
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
  duracaoServico,
}) {
  if (!profissionalId) {
    throw criarErro(
      "Profissional é obrigatório.",
      400
    );
  }

  return agendaDisponibilidadeService.buscarDisponibilidade({
    profissionalId,
    duracaoServico,
    quantidadeDias: 7,
  });
}

async function obterOuCriarCliente({
  clienteId,
  clienteNome,
  clienteWhatsapp,
}) {
  if (clienteId) {
    return clienteId;
  }

  const nomeNormalizado = String(
    clienteNome || ""
  ).trim();

  const whatsappNormalizado = String(
    clienteWhatsapp || ""
  ).trim();

  if (
    !nomeNormalizado ||
    !whatsappNormalizado
  ) {
    throw criarErro(
      "Nome e WhatsApp do cliente são obrigatórios.",
      400
    );
  }

  const clienteExistente =
    await agendaPublicaRepository.buscarClientePorWhatsapp(
      whatsappNormalizado
    );

  if (clienteExistente) {
    return clienteExistente.id;
  }

  const novoCliente =
    await agendaPublicaRepository.criarCliente(
      nomeNormalizado,
      whatsappNormalizado
    );

  return novoCliente.id;
}

async function validarHorarioDisponivel({
  profissionalId,
  data,
  horario,
  duracaoServico,
}) {
  if (
    !profissionalId ||
    !data ||
    !horario
  ) {
    throw criarErro(
      "Profissional, data e horário são obrigatórios.",
      400
    );
  }

  const disponivel =
    await agendaDisponibilidadeService.horarioEstaDisponivel({
      profissionalId,
      duracaoServico,
      data,
      horario,
      quantidadeDias: 7,
    });

  if (!disponivel) {
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
  clienteId,
  servicoId,
  negocioId,
  duracaoServico,
  clienteNome,
  servicoNome,
  profissionalNome,
  whatsappProfissional,
  whatsappNegocio,
}) {
  if (
    !data ||
    !horario ||
    !profissionalId ||
    !clienteId ||
    !servicoId ||
    !negocioId
  ) {
    throw criarErro(
      "Dados do agendamento incompletos.",
      400
    );
  }

  /*
   * Toda tentativa de gravar um agendamento
   * passa por uma transação exclusiva.
   *
   * Duas requisições para o mesmo profissional
   * e para a mesma data não conseguem validar
   * e inserir ao mesmo tempo.
   */
  const agendamento =
    await db.executarTransacao(
      async (client) => {
        /*
         * Aguarda qualquer outra transação que
         * esteja alterando a agenda desse
         * profissional nessa data.
         */
        await agendaPublicaRepository.bloquearAgendaProfissional(
          client,
          profissionalId,
          data
        );

        /*
         * A disponibilidade precisa ser recalculada
         * depois que o bloqueio for adquirido.
         *
         * Assim, caso outra requisição tenha acabado
         * de ocupar o horário, ela já aparecerá aqui.
         */
        const disponivel =
          await agendaDisponibilidadeService.horarioEstaDisponivel({
            profissionalId,
            duracaoServico,
            data,
            horario,
            quantidadeDias: 7,
          });

        if (!disponivel) {
          throw criarErro(
            "Esse horário não está mais disponível. Escolha outro horário.",
            409
          );
        }

        /*
         * O INSERT utiliza a mesma conexão que
         * abriu a transação e adquiriu o bloqueio.
         */
        return agendaPublicaRepository.criarAgendamento(
          {
            data,
            horario,
            profissionalId,
            clienteId,
            servicoId,
            negocioId,
          },
          client
        );
      }
    );

  /*
   * Notificações externas só começam depois
   * que a transação foi confirmada com COMMIT.
   */
  notificationService
    .novoAgendamento({
      cliente:
        clienteNome ||
        `Cliente #${clienteId}`,

      servico:
        servicoNome ||
        `Serviço #${servicoId}`,

      profissional:
        profissionalNome ||
        `Profissional #${profissionalId}`,

      whatsapp:
        whatsappProfissional ||
        whatsappNegocio,

      data,
      horario,
      negocioId,
      agendamentoId:
        agendamento.id,
    })
    .catch((erro) => {
      console.error(
        "Erro ao enviar notificação de novo agendamento:",
        erro
      );
    });

  return agendamento;
}

async function criarNotificacaoAgendamento({
  usuarioId,
  negocioId,
  agendamentoId,
  titulo,
  mensagem,
}) {
  return agendaPublicaRepository.criarNotificacaoAgendamento({
    usuarioId,
    negocioId,
    agendamentoId,
    titulo,
    mensagem,
  });
}

async function listarMeusAgendamentos({
  clienteId,
  tipoUsuario,
}) {
  validarClienteAutenticado({
    clienteId,
    tipoUsuario,
  });

  const agendamentos =
    await agendaPublicaRepository.listarMeusAgendamentos(
      clienteId
    );

  return {
    agendamentos,
  };
}

function validarAgendamentoCancelavel(
  agendamento
) {
  if (
    agendamento.status === "cancelado"
  ) {
    throw criarErro(
      "Esse agendamento já está cancelado.",
      400
    );
  }

  const dataAgendamento = new Date(
    `${agendamento.data}T00:00:00`
  );

  const hoje = new Date();

  hoje.setHours(
    hoje.getHours() - 3
  );

  hoje.setHours(
    0,
    0,
    0,
    0
  );

  if (dataAgendamento < hoje) {
    throw criarErro(
      "Não é possível cancelar um agendamento já realizado.",
      400
    );
  }
}

async function cancelarMeuAgendamento({
  clienteId,
  tipoUsuario,
  agendamentoId,
}) {
  validarClienteAutenticado({
    clienteId,
    tipoUsuario,
  });

  const agendamento =
    await agendaPublicaRepository.buscarAgendamentoCliente(
      agendamentoId,
      clienteId
    );

  if (!agendamento) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  validarAgendamentoCancelavel(
    agendamento
  );

  await agendaPublicaRepository.cancelarAgendamento(
    agendamentoId,
    clienteId
  );

  return {
    mensagem:
      "Agendamento cancelado com sucesso.",
  };
}

function validarAvaliacao(nota) {
  if (
    !Number.isInteger(nota) ||
    nota < 1 ||
    nota > 5
  ) {
    throw criarErro(
      "A avaliação deve ser de 1 a 5 estrelas.",
      400
    );
  }
}

function validarAgendamentoAvaliavel(
  agendamento
) {
  if (
    agendamento.status === "cancelado"
  ) {
    throw criarErro(
      "Agendamento cancelado não pode ser avaliado.",
      400
    );
  }

  const dataAgendamento = new Date(
    `${agendamento.data}T00:00:00`
  );

  const hoje = new Date();

  hoje.setHours(
    hoje.getHours() - 3
  );

  hoje.setHours(
    0,
    0,
    0,
    0
  );

  if (dataAgendamento >= hoje) {
    throw criarErro(
      "Só é possível avaliar serviços já realizados.",
      400
    );
  }

  if (agendamento.avaliacao) {
    throw criarErro(
      "Esse agendamento já foi avaliado.",
      400
    );
  }
}

async function avaliarAgendamento({
  clienteId,
  tipoUsuario,
  agendamentoId,
  avaliacao,
}) {
  validarClienteAutenticado({
    clienteId,
    tipoUsuario,
  });

  const nota = Number(
    avaliacao
  );

  validarAvaliacao(
    nota
  );

  const agendamento =
    await agendaPublicaRepository.buscarAgendamentoCliente(
      agendamentoId,
      clienteId
    );

  if (!agendamento) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  validarAgendamentoAvaliavel(
    agendamento
  );

  await agendaPublicaRepository.avaliarAgendamento(
    agendamentoId,
    clienteId,
    nota
  );

  return {
    mensagem:
      "Avaliação salva com sucesso.",
    avaliacao: nota,
  };
}

module.exports = {
  buscarDadosBaseAgenda,
  buscarDisponibilidade,
  obterOuCriarCliente,
  validarHorarioDisponivel,
  criarAgendamento,
  criarNotificacaoAgendamento,
  listarMeusAgendamentos,
  cancelarMeuAgendamento,
  avaliarAgendamento,
};