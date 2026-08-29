const agendaConfiguracaoRepository = require(
  "../repositories/agendaConfiguracaoRepository"
);

function criarErro(mensagem, statusCode) {
  const err = new Error(mensagem);
  err.status = statusCode;
  err.statusCode = statusCode;
  return err;
}

const HORARIOS_PADRAO = [
  {
    diaSemana: 0,
    trabalha: false,
    horaInicio: null,
    horaFim: null,
    intervaloInicio: null,
    intervaloFim: null,
  },
  {
    diaSemana: 1,
    trabalha: true,
    horaInicio: "08:00",
    horaFim: "18:00",
    intervaloInicio: "12:00",
    intervaloFim: "13:00",
  },
  {
    diaSemana: 2,
    trabalha: true,
    horaInicio: "08:00",
    horaFim: "18:00",
    intervaloInicio: "12:00",
    intervaloFim: "13:00",
  },
  {
    diaSemana: 3,
    trabalha: true,
    horaInicio: "08:00",
    horaFim: "18:00",
    intervaloInicio: "12:00",
    intervaloFim: "13:00",
  },
  {
    diaSemana: 4,
    trabalha: true,
    horaInicio: "08:00",
    horaFim: "18:00",
    intervaloInicio: "12:00",
    intervaloFim: "13:00",
  },
  {
    diaSemana: 5,
    trabalha: true,
    horaInicio: "08:00",
    horaFim: "18:00",
    intervaloInicio: "12:00",
    intervaloFim: "13:00",
  },
  {
    diaSemana: 6,
    trabalha: true,
    horaInicio: "08:00",
    horaFim: "13:00",
    intervaloInicio: null,
    intervaloFim: null,
  },
];

function exigirUsuario(usuarioId) {
  if (!usuarioId) {
    throw criarErro("Usuário não autenticado.", 401);
  }
}

function normalizarHorario(horario) {
  if (!horario) {
    return null;
  }

  return String(horario).slice(0, 5);
}

function converterHorarioEmMinutos(horario) {
  const horarioNormalizado = normalizarHorario(horario);

  if (!horarioNormalizado) {
    return null;
  }

  const partes = horarioNormalizado.split(":");

  if (partes.length !== 2) {
    return null;
  }

  const hora = Number(partes[0]);
  const minuto = Number(partes[1]);

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

  return hora * 60 + minuto;
}

function validarNumeroInteiro({
  valor,
  campo,
  minimo,
  maximo,
}) {
  const numero = Number(valor);

  if (
    !Number.isInteger(numero) ||
    numero < minimo ||
    numero > maximo
  ) {
    throw criarErro(
      `${campo} deve estar entre ${minimo} e ${maximo}.`,
      400
    );
  }

  return numero;
}

function validarHorarioDoDia(horario) {
  const diaSemana = Number(horario.diaSemana);
  const trabalha = Boolean(horario.trabalha);

  if (
    !Number.isInteger(diaSemana) ||
    diaSemana < 0 ||
    diaSemana > 6
  ) {
    throw criarErro("Dia da semana inválido.", 400);
  }

  if (!trabalha) {
    return {
      diaSemana,
      trabalha: false,
      horaInicio: null,
      horaFim: null,
      intervaloInicio: null,
      intervaloFim: null,
    };
  }

  const horaInicio = normalizarHorario(horario.horaInicio);
  const horaFim = normalizarHorario(horario.horaFim);
  const intervaloInicio = normalizarHorario(
    horario.intervaloInicio
  );
  const intervaloFim = normalizarHorario(
    horario.intervaloFim
  );

  const inicioMinutos = converterHorarioEmMinutos(horaInicio);
  const fimMinutos = converterHorarioEmMinutos(horaFim);

  if (inicioMinutos === null || fimMinutos === null) {
    throw criarErro(
      "Informe os horários de início e fim do atendimento.",
      400
    );
  }

  if (inicioMinutos >= fimMinutos) {
    throw criarErro(
      "O horário de início deve ser anterior ao horário de fim.",
      400
    );
  }

  const informouApenasUmIntervalo =
    Boolean(intervaloInicio) !== Boolean(intervaloFim);

  if (informouApenasUmIntervalo) {
    throw criarErro(
      "Informe o início e o fim do intervalo.",
      400
    );
  }

  if (intervaloInicio && intervaloFim) {
    const intervaloInicioMinutos =
      converterHorarioEmMinutos(intervaloInicio);

    const intervaloFimMinutos =
      converterHorarioEmMinutos(intervaloFim);

    if (
      intervaloInicioMinutos === null ||
      intervaloFimMinutos === null
    ) {
      throw criarErro("Horário de intervalo inválido.", 400);
    }

    if (intervaloInicioMinutos >= intervaloFimMinutos) {
      throw criarErro(
        "O início do intervalo deve ser anterior ao fim.",
        400
      );
    }

    if (
      intervaloInicioMinutos <= inicioMinutos ||
      intervaloFimMinutos >= fimMinutos
    ) {
      throw criarErro(
        "O intervalo deve estar dentro do horário de atendimento.",
        400
      );
    }
  }

  return {
    diaSemana,
    trabalha: true,
    horaInicio,
    horaFim,
    intervaloInicio,
    intervaloFim,
  };
}

function formatarHorarioBanco(horario) {
  return {
    id: horario.id,
    dia_semana: Number(horario.dia_semana),
    trabalha: Boolean(horario.trabalha),
    hora_inicio: normalizarHorario(horario.hora_inicio),
    hora_fim: normalizarHorario(horario.hora_fim),
    intervalo_inicio: normalizarHorario(
      horario.intervalo_inicio
    ),
    intervalo_fim: normalizarHorario(
      horario.intervalo_fim
    ),
  };
}

async function exigirProfissionalAtivo(
  profissionalId,
  executor
) {
  const profissional =
    await agendaConfiguracaoRepository
      .buscarProfissionalAtivo(
        profissionalId,
        executor
      );

  if (!profissional) {
    throw criarErro(
      "Conta sem vínculo ativo com um negócio.",
      403
    );
  }

  return profissional;
}

async function criarConfiguracaoPadrao(
  profissionalId,
  executor
) {
  const configuracao =
    await agendaConfiguracaoRepository.criarConfiguracao({
      profissionalId,
      duracaoPadrao: 60,
      intervaloMinutos: 0,
      antecedenciaAgendamento: 0,
      antecedenciaCancelamento: 24,
    }, executor);

  const horarios = [];

  for (const horario of HORARIOS_PADRAO) {
    const horarioSalvo =
      await agendaConfiguracaoRepository.salvarHorario({
        profissionalId,
        ...horario,
      }, executor);

    horarios.push(horarioSalvo);
  }

  return {
    configuracao,
    horarios,
  };
}

async function buscarMinhaConfiguracao({ usuarioId }) {
  exigirUsuario(usuarioId);

  return agendaConfiguracaoRepository
    .executarTransacao(
      async (client) => {
        await exigirProfissionalAtivo(
          usuarioId,
          client
        );

        let configuracao =
          await agendaConfiguracaoRepository
            .buscarConfiguracao(
              usuarioId,
              client
            );

        let horarios =
          await agendaConfiguracaoRepository
            .listarHorarios(
              usuarioId,
              client
            );

        if (!configuracao) {
          const padrao =
            await criarConfiguracaoPadrao(
              usuarioId,
              client
            );

          configuracao =
            padrao.configuracao;
          horarios =
            padrao.horarios;
        } else if (
          horarios.length === 0
        ) {
          for (
            const horario
            of HORARIOS_PADRAO
          ) {
            await agendaConfiguracaoRepository
              .salvarHorario({
                profissionalId:
                  usuarioId,
                ...horario,
              }, client);
          }

          horarios =
            await agendaConfiguracaoRepository
              .listarHorarios(
                usuarioId,
                client
              );
        }

        return {
          configuracao,
          horarios:
            horarios.map(
              formatarHorarioBanco
            ),
        };
      }
    );
}

async function buscarStatusConfiguracao({ usuarioId }) {
  exigirUsuario(usuarioId);

  await exigirProfissionalAtivo(
    usuarioId
  );

  const configuracao =
    await agendaConfiguracaoRepository
      .buscarConfiguracao(
        usuarioId
      );

  return {
    configurada:
      Boolean(
        configuracao?.configurado_em
      ),
    configurado_em:
      configuracao?.configurado_em ||
      null,
  };
}

async function salvarMinhaConfiguracao({
  usuarioId,
  duracaoPadrao,
  intervaloMinutos,
  antecedenciaAgendamento,
  antecedenciaCancelamento,
  horarios,
}) {
  exigirUsuario(usuarioId);

  const duracao = validarNumeroInteiro({
    valor: duracaoPadrao,
    campo: "A duração padrão",
    minimo: 5,
    maximo: 480,
  });

  const intervalo = validarNumeroInteiro({
    valor: intervaloMinutos,
    campo: "O intervalo entre clientes",
    minimo: 0,
    maximo: 180,
  });

  const antecedenciaAgendamentoValidada =
    validarNumeroInteiro({
      valor: antecedenciaAgendamento ?? 0,
      campo: "A antecedência para agendamento",
      minimo: 0,
      maximo: 720,
    });

  const antecedenciaCancelamentoValidada =
    validarNumeroInteiro({
      valor: antecedenciaCancelamento ?? 24,
      campo: "A antecedência para cancelamento",
      minimo: 0,
      maximo: 720,
    });

  if (!Array.isArray(horarios) || horarios.length !== 7) {
    throw criarErro(
      "Envie a configuração dos sete dias da semana.",
      400
    );
  }

  const diasRecebidos = new Set(
    horarios.map((horario) => Number(horario.diaSemana))
  );

  if (diasRecebidos.size !== 7) {
    throw criarErro(
      "Cada dia da semana deve aparecer uma única vez.",
      400
    );
  }

  const horariosValidados = horarios.map(
    validarHorarioDoDia
  );

  return agendaConfiguracaoRepository
    .executarTransacao(
      async (client) => {
        await exigirProfissionalAtivo(
          usuarioId,
          client
        );

        const configuracaoExistente =
          await agendaConfiguracaoRepository
            .buscarConfiguracao(
              usuarioId,
              client
            );

        const primeiraConfiguracao =
          !configuracaoExistente
            ?.configurado_em;

        let configuracao;

        const dadosConfiguracao = {
          profissionalId:
            usuarioId,
          duracaoPadrao:
            duracao,
          intervaloMinutos:
            intervalo,
          antecedenciaAgendamento:
            antecedenciaAgendamentoValidada,
          antecedenciaCancelamento:
            antecedenciaCancelamentoValidada,
        };

        if (
          configuracaoExistente
        ) {
          configuracao =
            await agendaConfiguracaoRepository
              .atualizarConfiguracao(
                dadosConfiguracao,
                client
              );
        } else {
          configuracao =
            await agendaConfiguracaoRepository
              .criarConfiguracao(
                dadosConfiguracao,
                client
              );
        }

        const horariosSalvos =
          [];

        for (
          const horario
          of horariosValidados
        ) {
          const horarioSalvo =
            await agendaConfiguracaoRepository
              .salvarHorario({
                profissionalId:
                  usuarioId,
                ...horario,
              }, client);

          horariosSalvos.push(
            horarioSalvo
          );
        }

        const configuracaoMarcada =
          await agendaConfiguracaoRepository
            .marcarConfigurada(
              usuarioId,
              client
            );

        configuracao =
          configuracaoMarcada ||
          configuracao;

        return {
          mensagem:
            primeiraConfiguracao
              ? "Sua agenda está pronta para receber clientes."
              : "Horários de atendimento atualizados com sucesso.",
          configuracao,
          horarios:
            horariosSalvos.map(
              formatarHorarioBanco
            ),
        };
      }
    );
}

module.exports = {
  buscarMinhaConfiguracao,
  buscarStatusConfiguracao,
  salvarMinhaConfiguracao,
};
