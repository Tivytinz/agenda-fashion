const agendaPublicaRepository = require(
  "../repositories/agendaPublicaRepository"
);

const agendaConfiguracaoRepository = require(
  "../repositories/agendaConfiguracaoRepository"
);

const HORARIOS_PADRAO = {
  horaInicio: "08:00",
  horaFim: "20:00",
  duracaoPadrao: 60,
  intervaloMinutos: 0,
};

function normalizarHorario(horario) {
  if (!horario) {
    return null;
  }

  return String(horario).slice(0, 5);
}

function horarioParaMinutos(horario) {
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

function minutosParaHorario(totalMinutos) {
  const hora = Math.floor(totalMinutos / 60);
  const minuto = totalMinutos % 60;

  return `${String(hora).padStart(2, "0")}:${String(
    minuto
  ).padStart(2, "0")}`;
}

function obterDataHoraBrasil() {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const obterParte = (tipo) =>
    partes.find((parte) => parte.type === tipo)?.value;

  return {
    data: `${obterParte("year")}-${obterParte(
      "month"
    )}-${obterParte("day")}`,

    hora: `${obterParte("hour")}:${obterParte(
      "minute"
    )}`,
  };
}

function gerarDiasProximos(quantidade = 7) {
  const dias = [];
  const agoraBrasil = obterDataHoraBrasil();

  const dataBase = new Date(
    `${agoraBrasil.data}T12:00:00Z`
  );

  for (
    let indice = 0;
    indice < quantidade;
    indice += 1
  ) {
    const data = new Date(dataBase);

    data.setUTCDate(
      dataBase.getUTCDate() + indice
    );

    const ano = data.getUTCFullYear();

    const mes = String(
      data.getUTCMonth() + 1
    ).padStart(2, "0");

    const dia = String(
      data.getUTCDate()
    ).padStart(2, "0");

    dias.push(`${ano}-${mes}-${dia}`);
  }

  return dias;
}

function obterDiaSemana(data) {
  const dataNormalizada = new Date(
    `${data}T12:00:00Z`
  );

  return dataNormalizada.getUTCDay();
}

function obterNumeroPositivo(
  valor,
  valorPadrao
) {
  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero <= 0
  ) {
    return valorPadrao;
  }

  return Math.floor(numero);
}

function obterNumeroNaoNegativo(
  valor,
  valorPadrao = 0
) {
  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero < 0
  ) {
    return valorPadrao;
  }

  return Math.floor(numero);
}

function intervalosSeSobrepoem({
  inicioA,
  fimA,
  inicioB,
  fimB,
}) {
  return inicioA < fimB && fimA > inicioB;
}

function montarPeriodosDeTrabalho({
  horaInicio,
  horaFim,
  intervaloInicio,
  intervaloFim,
}) {
  const inicioExpediente =
    horarioParaMinutos(horaInicio);

  const fimExpediente =
    horarioParaMinutos(horaFim);

  if (
    inicioExpediente === null ||
    fimExpediente === null ||
    inicioExpediente >= fimExpediente
  ) {
    return [];
  }

  const inicioPausa =
    horarioParaMinutos(intervaloInicio);

  const fimPausa =
    horarioParaMinutos(intervaloFim);

  const pausaValida =
    inicioPausa !== null &&
    fimPausa !== null &&
    inicioPausa < fimPausa &&
    inicioPausa > inicioExpediente &&
    fimPausa < fimExpediente;

  if (!pausaValida) {
    return [
      {
        inicio: inicioExpediente,
        fim: fimExpediente,
      },
    ];
  }

  return [
    {
      inicio: inicioExpediente,
      fim: inicioPausa,
    },
    {
      inicio: fimPausa,
      fim: fimExpediente,
    },
  ];
}

function gerarHorariosDoDia({
  horaInicio,
  horaFim,
  intervaloInicio,
  intervaloFim,
  duracaoMinutos,
  intervaloMinutos,
}) {
  const horarios = [];

  const periodos = montarPeriodosDeTrabalho({
    horaInicio,
    horaFim,
    intervaloInicio,
    intervaloFim,
  });

  const passo =
    duracaoMinutos + intervaloMinutos;

  if (passo <= 0) {
    return horarios;
  }

  for (const periodo of periodos) {
    for (
      let inicio = periodo.inicio;
      inicio + duracaoMinutos <= periodo.fim;
      inicio += passo
    ) {
      horarios.push(
        minutosParaHorario(inicio)
      );
    }
  }

  return horarios;
}

function horarioRespeitaAntecedencia({
  data,
  horario,
  antecedenciaHoras,
  agoraBrasil,
}) {
  const horarioNormalizado =
    normalizarHorario(horario);

  if (!horarioNormalizado) {
    return false;
  }

  const dataHoraAgendamento = Date.parse(
    `${data}T${horarioNormalizado}:00Z`
  );

  const dataHoraAtual = Date.parse(
    `${agoraBrasil.data}T${agoraBrasil.hora}:00Z`
  );

  if (
    Number.isNaN(dataHoraAgendamento) ||
    Number.isNaN(dataHoraAtual)
  ) {
    return false;
  }

  const limite =
    dataHoraAtual +
    antecedenciaHoras * 60 * 60 * 1000;

  return dataHoraAgendamento >= limite;
}

function buscarHorarioConfigurado(
  horarios,
  diaSemana
) {
  return horarios.find(
    (horario) =>
      Number(horario.dia_semana) ===
      Number(diaSemana)
  );
}

function profissionalTrabalhaNoDia(
  horarioConfigurado
) {
  if (!horarioConfigurado) {
    return true;
  }

  return (
    horarioConfigurado.trabalha === true ||
    horarioConfigurado.trabalha === "true" ||
    horarioConfigurado.trabalha === 1
  );
}

function possuiConflitoComAgendamento({
  data,
  horario,
  duracaoMinutos,
  intervaloMinutos,
  agendamentos,
}) {
  const inicioNovo =
    horarioParaMinutos(horario);

  if (inicioNovo === null) {
    return true;
  }

  const fimNovo =
    inicioNovo +
    duracaoMinutos +
    intervaloMinutos;

  return agendamentos.some(
    (agendamento) => {
      if (
        String(agendamento.data) !==
        String(data)
      ) {
        return false;
      }

      const inicioExistente =
        horarioParaMinutos(
          agendamento.horario
        );

      if (inicioExistente === null) {
        return false;
      }

      const duracaoExistente =
        obterNumeroPositivo(
          agendamento.duracao_minutos,
          HORARIOS_PADRAO.duracaoPadrao
        );

      const fimExistente =
        inicioExistente +
        duracaoExistente +
        intervaloMinutos;

      return intervalosSeSobrepoem({
        inicioA: inicioNovo,
        fimA: fimNovo,
        inicioB: inicioExistente,
        fimB: fimExistente,
      });
    }
  );
}

function possuiConflitoComBloqueio({
  data,
  horario,
  duracaoMinutos,
  intervaloMinutos,
  bloqueios,
}) {
  const inicioNovo =
    horarioParaMinutos(horario);

  if (inicioNovo === null) {
    return true;
  }

  const fimNovo =
    inicioNovo +
    duracaoMinutos +
    intervaloMinutos;

  return bloqueios.some((bloqueio) => {
    if (
      String(bloqueio.data) !==
      String(data)
    ) {
      return false;
    }

    const inicioBloqueio =
      horarioParaMinutos(
        bloqueio.horario
      );

    if (inicioBloqueio === null) {
      return false;
    }

    const fimBloqueio =
      inicioBloqueio +
      duracaoMinutos +
      intervaloMinutos;

    return intervalosSeSobrepoem({
      inicioA: inicioNovo,
      fimA: fimNovo,
      inicioB: inicioBloqueio,
      fimB: fimBloqueio,
    });
  });
}

async function buscarDisponibilidade({
  profissionalId,
  duracaoServico,
  quantidadeDias = 7,
}) {
  if (!profissionalId) {
    throw new Error(
      "Profissional é obrigatório para buscar disponibilidade."
    );
  }

  const dias = gerarDiasProximos(
    quantidadeDias
  );

  const [
    configuracao,
    horariosConfigurados,
    agendamentos,
    bloqueios,
  ] = await Promise.all([
    agendaConfiguracaoRepository.buscarConfiguracao(
      profissionalId
    ),

    agendaConfiguracaoRepository.listarHorarios(
      profissionalId
    ),

    agendaPublicaRepository.listarAgendamentosOcupados(
      profissionalId,
      dias[0],
      dias[dias.length - 1]
    ),

    agendaPublicaRepository.listarBloqueios(
      profissionalId,
      dias[0],
      dias[dias.length - 1]
    ),
  ]);

  const duracaoMinutos =
    obterNumeroPositivo(
      duracaoServico ||
        configuracao?.duracao_padrao,
      HORARIOS_PADRAO.duracaoPadrao
    );

  const intervaloMinutos =
    obterNumeroNaoNegativo(
      configuracao?.intervalo_minutos,
      HORARIOS_PADRAO.intervaloMinutos
    );

  const antecedenciaHoras =
    obterNumeroNaoNegativo(
      configuracao?.antecedencia_agendamento,
      0
    );

  const agoraBrasil =
    obterDataHoraBrasil();

  return dias.map((data) => {
    const diaSemana =
      obterDiaSemana(data);

    const horarioConfigurado =
      buscarHorarioConfigurado(
        horariosConfigurados,
        diaSemana
      );

    if (
      !profissionalTrabalhaNoDia(
        horarioConfigurado
      )
    ) {
      return {
        data,
        horarios: [],
      };
    }

    const horaInicio =
      horarioConfigurado?.hora_inicio ||
      HORARIOS_PADRAO.horaInicio;

    const horaFim =
      horarioConfigurado?.hora_fim ||
      HORARIOS_PADRAO.horaFim;

    const intervaloInicio =
      horarioConfigurado?.intervalo_inicio ||
      null;

    const intervaloFim =
      horarioConfigurado?.intervalo_fim ||
      null;

    const horariosBase =
      gerarHorariosDoDia({
        horaInicio,
        horaFim,
        intervaloInicio,
        intervaloFim,
        duracaoMinutos,
        intervaloMinutos,
      });

    const horarios = horariosBase.filter(
      (horario) => {
        const respeitaAntecedencia =
          horarioRespeitaAntecedencia({
            data,
            horario,
            antecedenciaHoras,
            agoraBrasil,
          });

        if (!respeitaAntecedencia) {
          return false;
        }

        const conflitoAgendamento =
          possuiConflitoComAgendamento({
            data,
            horario,
            duracaoMinutos,
            intervaloMinutos,
            agendamentos,
          });

        if (conflitoAgendamento) {
          return false;
        }

        const conflitoBloqueio =
          possuiConflitoComBloqueio({
            data,
            horario,
            duracaoMinutos,
            intervaloMinutos,
            bloqueios,
          });

        return !conflitoBloqueio;
      }
    );

    return {
      data,
      horarios,
    };
  });
}

async function horarioEstaDisponivel({
  profissionalId,
  duracaoServico,
  data,
  horario,
  quantidadeDias = 7,
}) {
  if (
    !profissionalId ||
    !data ||
    !horario
  ) {
    return false;
  }

  const disponibilidade =
    await buscarDisponibilidade({
      profissionalId,
      duracaoServico,
      quantidadeDias,
    });

  const diaEncontrado =
    disponibilidade.find(
      (item) =>
        String(item.data) ===
        String(data)
    );

  if (!diaEncontrado) {
    return false;
  }

  const horarioNormalizado =
    normalizarHorario(horario);

  return diaEncontrado.horarios.includes(
    horarioNormalizado
  );
}

module.exports = {
  gerarDiasProximos,
  buscarDisponibilidade,
  horarioEstaDisponivel,
};