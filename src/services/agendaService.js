const agendaRepository = require("../repositories/agendaRepository");
const agendaConfiguracaoRepository = require(
  "../repositories/agendaConfiguracaoRepository"
);

const {
  exigirUsuario,
  exigirCampo,
  exigirRecurso,
  exigirPermissao
} = require("../validators/commonValidator");

const ValidationError = require("../errors/ValidationError");

function gerarDatasAgenda(quantidadeDias = 7) {
  const datas = [];

  for (let i = 0; i < quantidadeDias; i++) {
    const data = new Date();

    data.setHours(12, 0, 0, 0);
    data.setDate(data.getDate() + i);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    datas.push(`${ano}-${mes}-${dia}`);
  }

  return datas;
}

function gerarHorariosAgenda(horaInicio = 8, horaFim = 18) {
  const horarios = [];

  for (let hora = horaInicio; hora <= horaFim; hora++) {
    horarios.push(`${String(hora).padStart(2, "0")}:00`);
  }

  return horarios;
}

function criarChaveAgenda(data, hora) {
  return `${data}_${hora}`;
}

async function buscarAgendaPublica({ slugNegocio, slugProfissional }) {
  exigirCampo(slugNegocio, "Slug do negócio não informado.");
  exigirCampo(slugProfissional, "Slug do profissional não informado.");

  const profissional =
    await agendaRepository.buscarProfissionalPorSlug(
      slugNegocio,
      slugProfissional
    );

  exigirRecurso(profissional, "Profissional não encontrado.");

  const datas = gerarDatasAgenda(7);
  const horas = gerarHorariosAgenda(8, 18);

  const dataInicio = datas[0];
  const dataFim = datas[datas.length - 1];

  const bloqueios =
    await agendaRepository.buscarBloqueiosPorPeriodo(
      profissional.id,
      dataInicio,
      dataFim
    );

  const agendamentos =
    await agendaRepository.buscarAgendamentosPorPeriodo(
      profissional.id,
      dataInicio,
      dataFim
    );

  const mapaBloqueios = new Map(
    bloqueios.map((item) => [
      criarChaveAgenda(item.data, item.hora),
      item
    ])
  );

  const mapaAgendamentos = new Map(
    agendamentos.map((item) => [
      criarChaveAgenda(item.data, item.hora),
      item
    ])
  );

  const agenda = datas.map((data) => ({
    data,
    horarios: horas.map((hora) => {
      const chave = criarChaveAgenda(data, hora);

      let status = "livre";

      if (mapaBloqueios.has(chave)) {
        status = "bloqueado";
      }

      if (mapaAgendamentos.has(chave)) {
        status = "agendado";
      }

      return {
        hora,
        status
      };
    })
  }));

  return {
    profissional,
    agenda
  };
}

function normalizarHorario(
  horario
) {
  if (!horario) {
    return null;
  }

  return String(
    horario
  )
    .trim()
    .slice(0, 5);
}

function horarioParaMinutos(
  horario
) {
  const horarioNormalizado =
    normalizarHorario(
      horario
    );

  if (!horarioNormalizado) {
    return null;
  }

  const [
    hora,
    minuto,
  ] = horarioNormalizado
    .split(":")
    .map(Number);

  if (
    !Number.isInteger(hora) ||
    !Number.isInteger(minuto)
  ) {
    return null;
  }

  return (
    hora * 60 +
    minuto
  );
}

function minutosParaHorario(
  minutosTotais
) {
  const hora =
    Math.floor(
      minutosTotais / 60
    );

  const minuto =
    minutosTotais % 60;

  return (
    `${String(hora).padStart(
      2,
      "0"
    )}:` +
    `${String(minuto).padStart(
      2,
      "0"
    )}`
  );
}

function intervalosSeSobrepoem({
  inicioA,
  fimA,
  inicioB,
  fimB,
}) {
  return (
    inicioA < fimB &&
    fimA > inicioB
  );
}

function gerarHorariosConfigurados({
  horaInicio,
  horaFim,
  intervaloInicio,
  intervaloFim,
  duracaoMinutos,
  intervaloMinutos,
}) {
  const horarios = [];

  const inicioExpediente =
    horarioParaMinutos(
      horaInicio
    );

  const fimExpediente =
    horarioParaMinutos(
      horaFim
    );

  const inicioPausa =
    horarioParaMinutos(
      intervaloInicio
    );

  const fimPausa =
    horarioParaMinutos(
      intervaloFim
    );

  if (
    inicioExpediente === null ||
    fimExpediente === null ||
    inicioExpediente >=
      fimExpediente
  ) {
    return horarios;
  }

  const passo =
    duracaoMinutos +
    intervaloMinutos;

  if (passo <= 0) {
    return horarios;
  }

  for (
    let inicio =
      inicioExpediente;

    inicio +
      duracaoMinutos <=
    fimExpediente;

    inicio += passo
  ) {
    const fim =
      inicio +
      duracaoMinutos;

    const atravessaIntervalo =
      inicioPausa !== null &&
      fimPausa !== null &&
      intervalosSeSobrepoem({
        inicioA: inicio,
        fimA: fim,
        inicioB:
          inicioPausa,
        fimB:
          fimPausa,
      });

    if (
      !atravessaIntervalo
    ) {
      horarios.push(
        minutosParaHorario(
          inicio
        )
      );
    }
  }

  return horarios;
}

function obterDataHoraBrasil() {
  const partes =
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        timeZone:
          "America/Sao_Paulo",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
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
      `${obterParte(
        "year"
      )}-` +
      `${obterParte(
        "month"
      )}-` +
      `${obterParte(
        "day"
      )}`,

    hora:
      `${obterParte(
        "hour"
      )}:` +
      `${obterParte(
        "minute"
      )}`,
  };
}

function obterDiaSemana(
  data
) {
  const [
    ano,
    mes,
    dia,
  ] = String(data)
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(
      ano,
      mes - 1,
      dia,
      12
    )
  ).getUTCDay();
}

function horarioJaPassou({
  data,
  hora,
  agoraBrasil,
}) {
  if (
    data <
    agoraBrasil.data
  ) {
    return true;
  }

  if (
    data >
    agoraBrasil.data
  ) {
    return false;
  }

  return (
    hora <=
    agoraBrasil.hora
  );
}

async function listarAgendaProfissional({
  profissionalId,
}) {
  exigirUsuario(
    profissionalId
  );

  const datas =
    gerarDatasAgenda(7);

  const dataInicio =
    datas[0];

  const dataFim =
    datas[
      datas.length - 1
    ];

  const [
    configuracao,
    horariosConfigurados,
    bloqueios,
    agendamentos,
  ] = await Promise.all([
    agendaConfiguracaoRepository
      .buscarConfiguracao(
        profissionalId
      ),

    agendaConfiguracaoRepository
      .listarHorarios(
        profissionalId
      ),

    agendaRepository
      .buscarBloqueiosPorPeriodo(
        profissionalId,
        dataInicio,
        dataFim
      ),

    agendaRepository
      .buscarAgendamentosPorPeriodo(
        profissionalId,
        dataInicio,
        dataFim
      ),
  ]);

  const duracaoConfigurada =
    Number(
      configuracao
        ?.duracao_padrao
    );

  const intervaloConfigurado =
    Number(
      configuracao
        ?.intervalo_minutos
    );

  const duracaoPadrao =
    Number.isInteger(
      duracaoConfigurada
    ) &&
    duracaoConfigurada > 0
      ? duracaoConfigurada
      : 60;

  const intervaloMinutos =
    Number.isInteger(
      intervaloConfigurado
    ) &&
    intervaloConfigurado >= 0
      ? intervaloConfigurado
      : 0;

  const mapaBloqueios =
    new Map(
      bloqueios.map(
        (item) => [
          criarChaveAgenda(
            item.data,
            normalizarHorario(
              item.hora
            )
          ),
          item,
        ]
      )
    );

  const mapaAgendamentos =
    new Map(
      agendamentos.map(
        (item) => [
          criarChaveAgenda(
            item.data,
            normalizarHorario(
              item.hora
            )
          ),
          item,
        ]
      )
    );

  const agoraBrasil =
    obterDataHoraBrasil();

  const agenda =
    datas.map(
      (data) => {
        const diaSemana =
          obterDiaSemana(
            data
          );

        const horarioConfigurado =
          horariosConfigurados.find(
            (item) =>
              Number(
                item.dia_semana
              ) ===
              Number(
                diaSemana
              )
          );

        if (
          horarioConfigurado &&
          !horarioConfigurado
            .trabalha
        ) {
          return {
            data,
            trabalha: false,
            horarios: [],
          };
        }

        const horaInicio =
          horarioConfigurado
            ?.hora_inicio ||
          "08:00";

        const horaFim =
          horarioConfigurado
            ?.hora_fim ||
          "18:00";

        const intervaloInicio =
          horarioConfigurado
            ?.intervalo_inicio ||
          null;

        const intervaloFim =
          horarioConfigurado
            ?.intervalo_fim ||
          null;

        const horariosBase =
          gerarHorariosConfigurados({
            horaInicio,
            horaFim,
            intervaloInicio,
            intervaloFim,
            duracaoMinutos:
              duracaoPadrao,
            intervaloMinutos,
          });

        const horarios =
          horariosBase.map(
            (hora) => {
              const chave =
                criarChaveAgenda(
                  data,
                  hora
                );

              const bloqueio =
                mapaBloqueios.get(
                  chave
                );

              const agendamento =
                mapaAgendamentos.get(
                  chave
                );

              let status =
                "livre";

              if (bloqueio) {
                status =
                  "bloqueado";
              }

              if (agendamento) {
                status =
                  agendamento.status ===
                    "confirmado"
                    ? "confirmado"
                    : "agendado";
              }

              const horarioPassado =
                horarioJaPassou({
                  data,
                  hora,
                  agoraBrasil,
                });

              if (
                horarioPassado &&
                agendamento
              ) {
                status =
                  "realizado";
              } else if (
                horarioPassado &&
                !agendamento &&
                !bloqueio
              ) {
                status =
                  "passado";
              }

              return {
                data,
                hora,
                status,

                agendamento_id:
                  agendamento
                    ?.agendamento_id ||
                  null,

                cliente_id:
                  agendamento
                    ?.cliente_id ||
                  null,

                cliente:
                  agendamento
                    ?.cliente ||
                  null,

                cliente_whatsapp:
                  agendamento
                    ?.cliente_whatsapp ||
                  null,

                servico_id:
                  agendamento
                    ?.servico_id ||
                  null,

                servico:
                  agendamento
                    ?.servico ||
                  null,

                valor:
                  agendamento
                    ?.valor ||
                  null,

                duracao_minutos:
                  agendamento
                    ?.duracao_minutos ||
                  duracaoPadrao,
              };
            }
          );

        return {
          data,
          trabalha: true,

          configuracao: {
            hora_inicio:
              normalizarHorario(
                horaInicio
              ),

            hora_fim:
              normalizarHorario(
                horaFim
              ),

            intervalo_inicio:
              normalizarHorario(
                intervaloInicio
              ),

            intervalo_fim:
              normalizarHorario(
                intervaloFim
              ),

            duracao_padrao:
              duracaoPadrao,

            intervalo_minutos:
              intervaloMinutos,
          },

          horarios,
        };
      }
    );

  return {
    configuracao: {
      duracao_padrao:
        duracaoPadrao,

      intervalo_minutos:
        intervaloMinutos,
    },

    agenda,
  };
}

async function alternarBloqueioHorario({
  usuarioId,
  data,
  hora,
  profissionalIdSolicitado
}) {
  exigirUsuario(usuarioId);
  exigirCampo(data, "Data é obrigatória.");
  exigirCampo(hora, "Hora é obrigatória.");

  let profissionalId = usuarioId;

  if (profissionalIdSolicitado) {
    const dono = await agendaRepository.buscarNegocioDono(usuarioId);

    exigirPermissao(
      dono,
      "Apenas o dono pode bloquear horários de outros profissionais."
    );

    const profissionalPertence =
      await agendaRepository.verificarProfissionalNoNegocio(
        profissionalIdSolicitado,
        dono.negocio_id
      );

    exigirPermissao(
      profissionalPertence,
      "Este profissional não pertence ao seu negócio."
    );

    profissionalId = profissionalIdSolicitado;
  }

  const agendamento =
    await agendaRepository.buscarAgendamentoAtivo(
      profissionalId,
      data,
      hora
    );

  if (agendamento) {
    throw new ValidationError("Horário já está agendado.");
  }

  const bloqueio =
    await agendaRepository.buscarBloqueioHorarioNovo(
      profissionalId,
      data,
      hora
    );

  if (bloqueio) {
    await agendaRepository.removerBloqueioHorario(bloqueio.id);

    return {
      sucesso: true,
      status: "livre",
      mensagem: "Horário liberado com sucesso."
    };
  }

  await agendaRepository.criarBloqueioHorario(
    profissionalId,
    data,
    hora
  );

  return {
    sucesso: true,
    status: "bloqueado",
    mensagem: "Horário bloqueado com sucesso."
  };
}

async function buscarAgendaGeral({ usuarioId }) {
  exigirUsuario(usuarioId);

  const negocio =
    await agendaRepository.buscarNegocioDoUsuario(usuarioId);

  exigirRecurso(negocio, "Negócio não encontrado.");

  const profissionais =
    await agendaRepository.buscarProfissionaisDoNegocio(
      negocio.id
    );

  const datas = gerarDatasAgenda(7);
  const horas = gerarHorariosAgenda(8, 18);

  const dataInicio = datas[0];
  const dataFim = datas[datas.length - 1];

  const profissionalIds =
    profissionais.map((profissional) => profissional.id);

  if (profissionalIds.length === 0) {
    return { agenda: [] };
  }

  const bloqueios =
    await agendaRepository.buscarBloqueiosProfissionaisPorPeriodo(
      profissionalIds,
      dataInicio,
      dataFim
    );

  const agendamentos =
    await agendaRepository.buscarAgendamentosProfissionaisPorPeriodo(
      profissionalIds,
      dataInicio,
      dataFim
    );

  const mapaBloqueios = new Map(
    bloqueios.map((item) => [
      `${item.profissional_id}_${criarChaveAgenda(item.data, item.hora)}`,
      item
    ])
  );

  const mapaAgendamentos = new Map(
    agendamentos.map((item) => [
      `${item.profissional_id}_${criarChaveAgenda(item.data, item.hora)}`,
      item
    ])
  );

  const agenda = datas.map((data) => ({
    data,
    profissionais: profissionais.map((profissional) => ({
      id: profissional.id,
      nome: profissional.nome,
      foto_url: profissional.foto_url,
      horarios: horas.map((hora) => {
        const chave =
          `${profissional.id}_${criarChaveAgenda(data, hora)}`;

        const agendamento = mapaAgendamentos.get(chave);

        let status = "livre";

        if (mapaBloqueios.has(chave)) {
          status = "bloqueado";
        }

        if (agendamento) {
          status = "agendado";
        }

        return {
          hora,
          status,
          cliente: agendamento?.cliente || null,
          servico: agendamento?.servico || null
        };
      })
    }))
  }));

  return { agenda };
}

async function buscarNotificacoesAgenda({ usuarioId }) {
  exigirUsuario(usuarioId);

  const vinculo =
    await agendaRepository.buscarVinculoUsuarioNegocio(usuarioId);

  if (!vinculo) {
    return { total: 0 };
  }

  let total = 0;

  if (vinculo.papel === "dono") {
    total =
      await agendaRepository.contarNotificacoesAgendaDono(
        vinculo.negocio_id
      );
  } else {
    total =
      await agendaRepository.contarNotificacoesAgendaProfissional(
        usuarioId
      );
  }

  return { total };
}

module.exports = {
  buscarAgendaPublica,
  listarAgendaProfissional,
  alternarBloqueioHorario,
  buscarAgendaGeral,
  buscarNotificacoesAgenda
};