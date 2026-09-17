const agendaConfiguracaoRepository = require(
  "../repositories/agendaConfiguracaoRepository"
);

function criarErro(mensagem, statusCode) {
  const err = new Error(mensagem);
  err.status = statusCode;
  err.statusCode = statusCode;
  return err;
}

function exigirUsuario(usuarioId) {
  if (!usuarioId) {
    throw criarErro("Usuário não autenticado.", 401);
  }
}

function normalizarNegocioId(negocioId) {
  const id = Number(negocioId);

  if (!Number.isInteger(id) || id <= 0) {
    throw criarErro("Negócio inválido.", 400);
  }

  return id;
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
  negocioId,
  executor
) {
  const profissional =
    await agendaConfiguracaoRepository
      .buscarProfissionalAtivo(
        profissionalId,
        negocioId,
        executor
      );

  if (!profissional) {
    throw criarErro(
      "Conta sem vínculo ativo com este negócio.",
      403
    );
  }

  return profissional;
}

async function buscarMinhaConfiguracao({
  usuarioId,
  negocioId,
}) {
  exigirUsuario(usuarioId);
  const negocioIdNormalizado =
    normalizarNegocioId(negocioId);

  return agendaConfiguracaoRepository
    .executarTransacao(
      async (client) => {
        await exigirProfissionalAtivo(
          usuarioId,
          negocioIdNormalizado,
          client
        );

        const estado =
          await agendaConfiguracaoRepository
            .garantirDisponibilidadePadrao({
              profissionalId:
                usuarioId,
              negocioId:
                negocioIdNormalizado,
            }, client);

        return {
          configuracao:
            estado.configuracao,
          horarios:
            estado.horarios.map(
              formatarHorarioBanco
            ),
        };
      }
    );
}

async function buscarStatusConfiguracao({
  usuarioId,
  negocioId,
}) {
  exigirUsuario(usuarioId);
  const negocioIdNormalizado =
    normalizarNegocioId(negocioId);

  await exigirProfissionalAtivo(
    usuarioId,
    negocioIdNormalizado
  );

  const configuracao =
    await agendaConfiguracaoRepository
      .buscarConfiguracao(
        usuarioId,
        negocioIdNormalizado
      );

  return {
    configurada: Boolean(configuracao),
    configurado_em:
      configuracao?.configurado_em ||
      null,
    origem_horarios:
      configuracao?.origem_horarios ||
      "padrao_af",
    personalizada:
      configuracao?.origem_horarios ===
      "personalizado",
  };
}

async function salvarMinhaConfiguracao({
  usuarioId,
  negocioId,
  duracaoPadrao,
  intervaloMinutos,
  antecedenciaAgendamento,
  antecedenciaCancelamento,
  horarios,
}) {
  exigirUsuario(usuarioId);
  const negocioIdNormalizado =
    normalizarNegocioId(negocioId);

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
          negocioIdNormalizado,
          client
        );

        const configuracaoExistente =
          await agendaConfiguracaoRepository
            .buscarConfiguracao(
              usuarioId,
              negocioIdNormalizado,
              client
            );

        const primeiraPersonalizacao =
          configuracaoExistente
            ?.origem_horarios !==
          "personalizado";

        let configuracao;

        const dadosConfiguracao = {
          profissionalId:
            usuarioId,
          negocioId:
            negocioIdNormalizado,
          duracaoPadrao:
            duracao,
          intervaloMinutos:
            intervalo,
          antecedenciaAgendamento:
            antecedenciaAgendamentoValidada,
          antecedenciaCancelamento:
            antecedenciaCancelamentoValidada,
        };

        if (configuracaoExistente) {
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

        const horariosSalvos = [];

        for (const horario of horariosValidados) {
          const horarioSalvo =
            await agendaConfiguracaoRepository
              .salvarHorario({
                profissionalId:
                  usuarioId,
                negocioId:
                  negocioIdNormalizado,
                ...horario,
              }, client);

          horariosSalvos.push(horarioSalvo);
        }

        const configuracaoMarcada =
          await agendaConfiguracaoRepository
            .marcarConfigurada(
              usuarioId,
              negocioIdNormalizado,
              client
            );

        configuracao =
          configuracaoMarcada ||
          configuracao;

        return {
          mensagem:
            primeiraPersonalizacao
              ? "Horários personalizados com sucesso."
              : "Horários atualizados com sucesso.",
          configuracao,
          horarios:
            horariosSalvos.map(
              formatarHorarioBanco
            ),
          publicacao: null,
        };
      }
    );
}

module.exports = {
  buscarMinhaConfiguracao,
  buscarStatusConfiguracao,
  salvarMinhaConfiguracao,
};
