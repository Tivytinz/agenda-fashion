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

const notificationService = require(
  "./notificationService"
);

const planoService = require(
  "./planoService"
);

const ANTECEDENCIA_CANCELAMENTO_PADRAO = 24;

function criarErro(
  mensagem,
  statusCode
) {
  const erro =
    new Error(mensagem);

  erro.status =
    statusCode;

  erro.statusCode =
    statusCode;

  return erro;
}

function normalizarId(
  valor
) {
  const id =
    Number(valor);

  return (
    Number.isInteger(id) &&
    id > 0
  )
    ? id
    : null;
}

function normalizarTexto(
  valor,
  limite = 255
) {
  const texto =
    String(valor ?? "")
      .trim()
      .replace(/\s+/g, " ");

  return texto.slice(
    0,
    limite
  );
}

function normalizarWhatsapp(
  valor
) {
  let numeros =
    String(valor ?? "")
      .replace(/\D/g, "");

  if (
    (
      numeros.length === 12 ||
      numeros.length === 13
    ) &&
    numeros.startsWith("55")
  ) {
    numeros =
      numeros.slice(2);
  }

  return numeros;
}

function normalizarHorario(
  horario
) {
  const valor =
    String(horario ?? "")
      .trim();

  const correspondencia =
    valor.match(
      /^(\d{1,2}):(\d{2})/
    );

  if (!correspondencia) {
    return null;
  }

  const hora =
    Number(
      correspondencia[1]
    );

  const minuto =
    Number(
      correspondencia[2]
    );

  if (
    !Number.isInteger(hora) ||
    !Number.isInteger(minuto) ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59
  ) {
    return null;
  }

  return (
    `${String(hora).padStart(
      2,
      "0"
    )}:` +
    String(minuto).padStart(
      2,
      "0"
    )
  );
}

function dataValida(
  data
) {
  const valor =
    String(data ?? "")
      .trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      valor
    )
  ) {
    return false;
  }

  const [
    ano,
    mes,
    dia,
  ] =
    valor
      .split("-")
      .map(Number);

  const dataUtc =
    new Date(
      Date.UTC(
        ano,
        mes - 1,
        dia
      )
    );

  return (
    dataUtc.getUTCFullYear() ===
      ano &&
    dataUtc.getUTCMonth() ===
      mes - 1 &&
    dataUtc.getUTCDate() ===
      dia
  );
}

function validarClienteAutenticado({
  clienteId,
}) {
  const id =
    normalizarId(
      clienteId
    );

  if (!id) {
    throw criarErro(
      "Usuário não autenticado.",
      401
    );
  }

  return id;
}

function validarIdentificacaoVisitante({
  clienteNome,
  clienteWhatsapp,
}) {
  const nome =
    normalizarTexto(
      clienteNome,
      120
    );

  const whatsapp =
    normalizarWhatsapp(
      clienteWhatsapp
    );

  if (nome.length < 2) {
    throw criarErro(
      "Informe o nome do cliente.",
      400
    );
  }

  if (
    ![10, 11].includes(
      whatsapp.length
    )
  ) {
    throw criarErro(
      "Informe um WhatsApp válido com DDD.",
      400
    );
  }

  return {
    clienteNome:
      nome,

    clienteWhatsapp:
      whatsapp,
  };
}

function obterDataHoraBrasil() {
  const partes =
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        timeZone:
          "America/Sao_Paulo",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      }
    ).formatToParts(
      new Date()
    );

  const obterParte =
    (tipo) =>
      partes.find(
        (parte) =>
          parte.type === tipo
      )?.value;

  return {
    data:
      `${obterParte("year")}-` +
      `${obterParte("month")}-` +
      obterParte("day"),

    hora:
      `${obterParte("hour")}:` +
      obterParte("minute"),
  };
}

function converterDataHoraParaTimestamp({
  data,
  horario,
}) {
  const horarioNormalizado =
    normalizarHorario(
      horario
    );

  if (
    !dataValida(data) ||
    !horarioNormalizado
  ) {
    return null;
  }

  /*
   * Data e hora brasileiras são
   * comparadas como valores nominais.
   */
  const timestamp =
    Date.parse(
      `${data}T` +
      `${horarioNormalizado}:00Z`
    );

  return Number.isNaN(
    timestamp
  )
    ? null
    : timestamp;
}

function normalizarAntecedenciaCancelamento(
  valor
) {
  const numero =
    Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero < 0
  ) {
    return (
      ANTECEDENCIA_CANCELAMENTO_PADRAO
    );
  }

  return Math.floor(
    numero
  );
}

function formatarQuantidadeHoras(
  quantidade
) {
  return quantidade === 1
    ? "1 hora"
    : `${quantidade} horas`;
}

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
  const profissionalIdNormalizado =
    normalizarId(
      profissionalId
    );

  if (
    !profissionalIdNormalizado
  ) {
    throw criarErro(
      "Profissional é obrigatório.",
      400
    );
  }

  return (
    agendaDisponibilidadeService
      .buscarDisponibilidade({
        profissionalId:
          profissionalIdNormalizado,

        duracaoServico,

        quantidadeDias:
          7,
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

async function validarHorarioDisponivel({
  profissionalId,
  data,
  horario,
  duracaoServico,
}) {
  const profissionalIdNormalizado =
    normalizarId(
      profissionalId
    );

  const horarioNormalizado =
    normalizarHorario(
      horario
    );

  if (
    !profissionalIdNormalizado ||
    !dataValida(data) ||
    !horarioNormalizado
  ) {
    throw criarErro(
      "Profissional, data e horário são obrigatórios.",
      400
    );
  }

  const estaDisponivel =
    await agendaDisponibilidadeService
      .horarioEstaDisponivel({
        profissionalId:
          profissionalIdNormalizado,

        duracaoServico,

        data,

        horario:
          horarioNormalizado,
      });

  if (!estaDisponivel) {
    throw criarErro(
      "Esse horário não está mais disponível. Escolha outro horário.",
      409
    );
  }

  return true;
}

function notificacoesExternasAtivas() {
  /*
   * Testes nunca devem realizar chamadas
   * reais para a API da Meta.
   */
  if (
    process.env.NODE_ENV ===
    "test"
  ) {
    return false;
  }

  const configuracao =
    String(
      process.env
        .WHATSAPP_NOTIFICATIONS_ENABLED ??
      "true"
    )
      .trim()
      .toLowerCase();

  return [
    "1",
    "true",
    "sim",
    "yes",
  ].includes(
    configuracao
  );
}

function registrarFalhaNotificacao(
  erro
) {
  /*
   * Não imprime o erro completo do Axios,
   * pois ele contém o header Authorization.
   */
  const status =
    erro?.response?.status ||
    erro?.status ||
    null;

  const codigo =
    erro?.response
      ?.data
      ?.error
      ?.code ||
    erro?.code ||
    null;

  const mensagem =
    erro?.response
      ?.data
      ?.error
      ?.message ||
    erro?.message ||
    "Erro desconhecido.";

  console.error(
    "Falha ao enviar notificação de novo agendamento:",
    {
      status,
      codigo,
      mensagem,
    }
  );
}

function notificarNovoAgendamento({
  clienteNome,
  clienteId,
  servicoNome,
  servicoId,
  profissionalNome,
  profissionalId,
  whatsappProfissional,
  whatsappNegocio,
  data,
  horario,
  negocioId,
  agendamentoId,
}) {
  if (
    !notificacoesExternasAtivas()
  ) {
    return;
  }

  const whatsapp =
    normalizarWhatsapp(
      whatsappProfissional ||
      whatsappNegocio
    );

  if (
    ![10, 11].includes(
      whatsapp.length
    )
  ) {
    return;
  }

  Promise.resolve(
    notificationService
      .novoAgendamento({
        cliente:
          normalizarTexto(
            clienteNome,
            120
          ) ||
          (
            `Cliente #` +
            `${clienteId || "visitante"}`
          ),

        servico:
          normalizarTexto(
            servicoNome,
            120
          ) ||
          `Serviço #${servicoId}`,

        profissional:
          normalizarTexto(
            profissionalNome,
            120
          ) ||
          (
            `Profissional #` +
            profissionalId
          ),

        whatsapp,

        data,

        horario,

        negocioId,

        agendamentoId,
      })
  ).catch(
    registrarFalhaNotificacao
  );
}

async function criarAgendamento({
  data,
  horario,
  profissionalId,

  clienteId = null,
  clienteNome = null,
  clienteWhatsapp = null,

  servicoId,
  negocioId,
  duracaoServico,

  servicoNome,
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
         * para o mesmo horário.
         */
        await agendaPublicaRepository
          .bloquearAgendaProfissional(
            client,
            profissionalIdNormalizado,
            data
          );

        /*
         * Recalcula a disponibilidade
         * depois de adquirir o bloqueio.
         */
        const disponivel =
          await agendaDisponibilidadeService
            .horarioEstaDisponivel({
              profissionalId:
                profissionalIdNormalizado,

              duracaoServico:
                duracaoMinutos,

              data,

              horario:
                horarioNormalizado,
            });

        if (!disponivel) {
          throw criarErro(
            "Esse horário não está mais disponível. Escolha outro horário.",
            409
          );
        }

        return (
          agendaPublicaRepository
            .criarAgendamento(
              {
                data,

                horario:
                  horarioNormalizado,

                profissionalId:
                  profissionalIdNormalizado,

                clienteId:
                  clienteIdNormalizado,

                clienteNome:
                  nomeNormalizado,

                clienteWhatsapp:
                  whatsappNormalizado,

                servicoId:
                  servicoIdNormalizado,

                negocioId:
                  negocioIdNormalizado,
              },
              client
            )
        );
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

  /*
   * Notificação externa somente depois
   * do COMMIT da transação.
   */
  notificarNovoAgendamento({
    clienteNome:
      nomeNormalizado,

    clienteId:
      clienteIdNormalizado,

    servicoNome,

    servicoId:
      servicoIdNormalizado,

    profissionalNome,

    profissionalId:
      profissionalIdNormalizado,

    whatsappProfissional,

    whatsappNegocio,

    data,

    horario:
      horarioNormalizado,

    negocioId:
      negocioIdNormalizado,

    agendamentoId:
      agendamento.id,
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

async function listarMeusAgendamentos({
  clienteId,
}) {
  const id =
    validarClienteAutenticado({
      clienteId,
    });

  const agendamentos =
    await agendaPublicaRepository
      .listarMeusAgendamentos(
        id
      );

  return {
    agendamentos:
      Array.isArray(
        agendamentos
      )
        ? agendamentos
        : [],
  };
}

function validarAgendamentoCancelavel({
  agendamento,
  antecedenciaCancelamento,
}) {
  if (
    agendamento.status ===
    "cancelado"
  ) {
    throw criarErro(
      "Esse agendamento já está cancelado.",
      400
    );
  }

  const agoraBrasil =
    obterDataHoraBrasil();

  const timestampAtual =
    converterDataHoraParaTimestamp({
      data:
        agoraBrasil.data,

      horario:
        agoraBrasil.hora,
    });

  const timestampAgendamento =
    converterDataHoraParaTimestamp({
      data:
        agendamento.data,

      horario:
        agendamento.horario,
    });

  if (
    timestampAtual === null ||
    timestampAgendamento === null
  ) {
    throw criarErro(
      "Não foi possível validar a data e o horário do agendamento.",
      500
    );
  }

  if (
    timestampAgendamento <=
    timestampAtual
  ) {
    throw criarErro(
      "Não é possível cancelar um agendamento já realizado.",
      400
    );
  }

  const antecedenciaHoras =
    normalizarAntecedenciaCancelamento(
      antecedenciaCancelamento
    );

  if (
    antecedenciaHoras === 0
  ) {
    return true;
  }

  const limiteCancelamento =
    timestampAgendamento -
    antecedenciaHoras *
      60 *
      60 *
      1000;

  if (
    timestampAtual >
    limiteCancelamento
  ) {
    throw criarErro(
      `O prazo para cancelamento encerrou. ` +
      `Este agendamento só pode ser cancelado com pelo menos ` +
      `${formatarQuantidadeHoras(
        antecedenciaHoras
      )} de antecedência.`,
      409
    );
  }

  return true;
}

async function cancelarMeuAgendamento({
  clienteId,
  agendamentoId,
}) {
  const id =
    validarClienteAutenticado({
      clienteId,
    });

  const agendamentoIdNormalizado =
    normalizarId(
      agendamentoId
    );

  if (
    !agendamentoIdNormalizado
  ) {
    throw criarErro(
      "Agendamento inválido.",
      400
    );
  }

  const agendamento =
    await agendaPublicaRepository
      .buscarAgendamentoCliente(
        agendamentoIdNormalizado,
        id
      );

  if (!agendamento) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  if (
    !agendamento.profissional_id
  ) {
    throw criarErro(
      "Profissional do agendamento não encontrado.",
      500
    );
  }

  const configuracao =
    await agendaConfiguracaoRepository
      .buscarConfiguracao(
        agendamento.profissional_id
      );

  const antecedenciaCancelamento =
    configuracao
      ?.antecedencia_cancelamento ??
    ANTECEDENCIA_CANCELAMENTO_PADRAO;

  validarAgendamentoCancelavel({
    agendamento,
    antecedenciaCancelamento,
  });

  const cancelado =
    await agendaPublicaRepository
      .cancelarAgendamento(
        agendamentoIdNormalizado,
        id
      );

  if (!cancelado) {
    throw criarErro(
      "Não foi possível cancelar o agendamento.",
      409
    );
  }

  return {
    mensagem:
      "Agendamento cancelado com sucesso.",
  };
}

function validarAvaliacao(
  nota
) {
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
    agendamento.status ===
    "cancelado"
  ) {
    throw criarErro(
      "Agendamento cancelado não pode ser avaliado.",
      400
    );
  }

  const agoraBrasil =
    obterDataHoraBrasil();

  const timestampAtual =
    converterDataHoraParaTimestamp({
      data:
        agoraBrasil.data,

      horario:
        agoraBrasil.hora,
    });

  const timestampAgendamento =
    converterDataHoraParaTimestamp({
      data:
        agendamento.data,

      horario:
        agendamento.horario,
    });

  if (
    timestampAtual === null ||
    timestampAgendamento === null
  ) {
    throw criarErro(
      "Não foi possível validar a data e o horário do agendamento.",
      500
    );
  }

  if (
    timestampAgendamento >=
    timestampAtual
  ) {
    throw criarErro(
      "Só é possível avaliar serviços já realizados.",
      400
    );
  }

  if (
    agendamento.avaliacao
  ) {
    throw criarErro(
      "Esse agendamento já foi avaliado.",
      400
    );
  }
}

async function avaliarAgendamento({
  clienteId,
  agendamentoId,
  avaliacao,
}) {
  const id =
    validarClienteAutenticado({
      clienteId,
    });

  const agendamentoIdNormalizado =
    normalizarId(
      agendamentoId
    );

  if (
    !agendamentoIdNormalizado
  ) {
    throw criarErro(
      "Agendamento inválido.",
      400
    );
  }

  const nota =
    Number(
      avaliacao
    );

  validarAvaliacao(
    nota
  );

  const agendamento =
    await agendaPublicaRepository
      .buscarAgendamentoCliente(
        agendamentoIdNormalizado,
        id
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

  const atualizado =
    await agendaPublicaRepository
      .avaliarAgendamento(
        agendamentoIdNormalizado,
        id,
        nota
      );

  if (!atualizado) {
    throw criarErro(
      "Não foi possível salvar a avaliação.",
      409
    );
  }

  return {
    mensagem:
      "Avaliação salva com sucesso.",

    avaliacao:
      nota,
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
