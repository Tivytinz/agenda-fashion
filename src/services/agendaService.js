const agendaRepository = require("../repositories/agendaRepository");
const db = require("../db/db");
const agendaConfiguracaoRepository = require(
  "../repositories/agendaConfiguracaoRepository"
);
const {
  obterDataHoraNoFuso,
  resolverFusoHorario,
} = require("../utils/fusoHorario");

const {
  exigirUsuario,
  exigirCampo,
  exigirRecurso,
  exigirPermissao,
  exigirInteiroPositivo
} = require("../validators/commonValidator");

const ValidationError = require("../errors/ValidationError");

function gerarDatasAgenda(
  quantidadeDias = 7,
  fusoHorario
) {
  const datas = [];
  const agoraLocal =
    obterDataHoraNoFuso(
      resolverFusoHorario(
        fusoHorario
      )
    );
  const dataBase = new Date(
    `${agoraLocal.data}T12:00:00Z`
  );

  for (
    let indice = 0;
    indice < quantidadeDias;
    indice += 1
  ) {
    const data = new Date(
      dataBase
    );

    data.setUTCDate(
      dataBase.getUTCDate() +
      indice
    );

    const ano =
      data.getUTCFullYear();
    const mes = String(
      data.getUTCMonth() + 1
    ).padStart(2, "0");
    const dia = String(
      data.getUTCDate()
    ).padStart(2, "0");

    datas.push(
      `${ano}-${mes}-${dia}`
    );
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
      profissional.negocio_id,
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
  agoraLocal,
}) {
  if (
    data <
    agoraLocal.data
  ) {
    return true;
  }

  if (
    data >
    agoraLocal.data
  ) {
    return false;
  }

  return (
    hora <=
    agoraLocal.hora
  );
}

async function listarAgendaProfissional({
  profissionalId,
  negocioId,
  fusoHorario,
}) {
  exigirUsuario(
    profissionalId
  );
  exigirCampo(
    negocioId,
    "Contexto do negócio é obrigatório."
  );

  const negocioIdNormalizado =
    Number(
      negocioId
    );
  const fusoResolvido =
    resolverFusoHorario(
      fusoHorario
    );
  const datas =
    gerarDatasAgenda(
      7,
      fusoResolvido
    );
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
  ] = await Promise.all([
    agendaConfiguracaoRepository
      .buscarConfiguracao(
        profissionalId,
        negocioIdNormalizado
      ),
    agendaConfiguracaoRepository
      .listarHorarios(
        profissionalId,
        negocioIdNormalizado
      ),
    agendaRepository
      .buscarBloqueiosPorPeriodo(
        profissionalId,
        negocioIdNormalizado,
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

  const agoraLocal =
    obterDataHoraNoFuso(
      fusoResolvido
    );

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

        const horarios =
          gerarHorariosConfigurados({
            horaInicio,
            horaFim,
            intervaloInicio,
            intervaloFim,
            duracaoMinutos:
              duracaoPadrao,
            intervaloMinutos,
          }).map(
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
              let status =
                bloqueio
                  ? "bloqueado"
                  : "livre";

              if (
                !bloqueio &&
                horarioJaPassou({
                  data,
                  hora,
                  agoraLocal,
                })
              ) {
                status =
                  "passado";
              }

              return {
                data,
                hora,
                status,
                agendamento_id:
                  null,
                cliente_id:
                  null,
                cliente:
                  null,
                cliente_whatsapp:
                  null,
                servico_id:
                  null,
                servico:
                  null,
                valor:
                  null,
                duracao_minutos:
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
    fuso_horario:
      fusoResolvido,
    agenda,
  };
}

async function alternarBloqueioHorario({
  usuarioId,
  data,
  hora,
  profissionalIdSolicitado,
  negocioIdContexto,
  papelContexto
}) {
  exigirUsuario(usuarioId);
  exigirCampo(data, "Data é obrigatória.");
  exigirCampo(hora, "Hora é obrigatória.");
  exigirCampo(
    negocioIdContexto,
    "Contexto do negócio é obrigatório."
  );

  const negocioId = Number(negocioIdContexto);
  let profissionalId = Number(usuarioId);

  if (profissionalIdSolicitado) {
    exigirPermissao(
      papelContexto === "dono",
      "Apenas o dono pode bloquear horários de outros profissionais."
    );

    const profissionalPertence =
      await agendaRepository.verificarProfissionalNoNegocio(
        profissionalIdSolicitado,
        negocioId
      );

    exigirPermissao(
      profissionalPertence,
      "Este profissional não pertence ao seu negócio."
    );

    profissionalId = Number(profissionalIdSolicitado);
  }

  return db.executarTransacao(async (client) => {
    await agendaRepository.bloquearAlteracaoHorario(
      profissionalId,
      data,
      hora,
      client
    );

    const agendamento =
      await agendaRepository.buscarAgendamentoAtivo(
        profissionalId,
        data,
        hora,
        negocioId,
        client
      );

    if (agendamento) {
      throw new ValidationError("Horário já está agendado.");
    }

    const bloqueio =
      await agendaRepository.buscarBloqueioHorarioNovo(
        profissionalId,
        negocioId,
        data,
        hora,
        client
      );

    if (bloqueio) {
      await agendaRepository.removerBloqueioHorario(
        bloqueio.id,
        negocioId,
        client
      );

      return {
        sucesso: true,
        status: "livre",
        mensagem: "Horário liberado com sucesso."
      };
    }

    const bloqueioGlobalLegado =
      await agendaRepository.buscarBloqueioGlobalLegado(
        profissionalId,
        data,
        hora,
        client
      );

    if (bloqueioGlobalLegado) {
      throw new ValidationError(
        "Este horário possui um bloqueio legado global e não pode ser alterado por este negócio."
      );
    }

    try {
      await agendaRepository.criarBloqueioHorario(
        profissionalId,
        negocioId,
        data,
        hora,
        client
      );
    } catch (erro) {
      if (erro?.code === "23505") {
        throw new ValidationError("Horário já está bloqueado.");
      }

      throw erro;
    }

    return {
      sucesso: true,
      status: "bloqueado",
      mensagem: "Horário bloqueado com sucesso."
    };
  });
}

async function buscarAgendaGeral({ usuarioId }) {
  exigirUsuario(usuarioId);

  const vinculoDono =
    await agendaRepository
      .buscarNegocioDono(
        usuarioId
      );

  exigirPermissao(
    vinculoDono,
    "Apenas o dono pode acessar a agenda geral."
  );

  const negocioId =
    Number(
      vinculoDono.negocio_id
    );
  const fusoResolvido =
    resolverFusoHorario(
      vinculoDono.fuso_horario
    );
  const profissionais =
    await agendaRepository
      .buscarProfissionaisDoNegocio(
        negocioId
      );
  const datas =
    gerarDatasAgenda(
      7,
      fusoResolvido
    );
  const dataInicio =
    datas[0];
  const dataFim =
    datas[
      datas.length - 1
    ];
  const profissionalIds =
    profissionais
      .map(
        (profissional) =>
          Number(
            profissional.id
          )
      )
      .filter(
        (id) =>
          Number.isInteger(id) &&
          id > 0
      );

  if (
    profissionalIds.length === 0
  ) {
    return {
      fuso_horario:
        fusoResolvido,
      agenda: [],
    };
  }

  const [
    configuracoesHorarios,
    bloqueios,
  ] = await Promise.all([
    agendaConfiguracaoRepository
      .listarConfiguracoesHorariosNegocio({
        negocioId,
        profissionalIds,
      }),
    agendaRepository
      .buscarBloqueiosProfissionaisPorPeriodo(
        negocioId,
        profissionalIds,
        dataInicio,
        dataFim
      ),
  ]);

  const configuracaoPorProfissional =
    new Map();
  const horariosPorProfissional =
    new Map();

  for (
    const item of
      configuracoesHorarios
  ) {
    const profissionalId =
      Number(
        item.profissional_id
      );

    if (
      !configuracaoPorProfissional
        .has(
          profissionalId
        )
    ) {
      configuracaoPorProfissional
        .set(
          profissionalId,
          {
            duracao_padrao:
              item.duracao_padrao,
            intervalo_minutos:
              item.intervalo_minutos,
          }
        );
    }

    if (
      item.dia_semana !==
        null &&
      item.dia_semana !==
        undefined
    ) {
      const horarios =
        horariosPorProfissional
          .get(
            profissionalId
          ) || [];
      horarios.push(
        item
      );
      horariosPorProfissional
        .set(
          profissionalId,
          horarios
        );
    }
  }

  const mapaBloqueios =
    new Map(
      bloqueios.map(
        (item) => [
          `${item.profissional_id}_${criarChaveAgenda(
            item.data,
            normalizarHorario(
              item.hora
            )
          )}`,
          item,
        ]
      )
    );

  const agoraLocal =
    obterDataHoraNoFuso(
      fusoResolvido
    );

  const agenda =
    datas.map(
      (data) => {
        const diaSemana =
          obterDiaSemana(
            data
          );

        return {
          data,
          profissionais:
            profissionais.map(
              (profissional) => {
                const profissionalId =
                  Number(
                    profissional.id
                  );
                const configuracao =
                  configuracaoPorProfissional
                    .get(
                      profissionalId
                    ) || {};
                const duracaoRecebida =
                  Number(
                    configuracao
                      .duracao_padrao
                  );
                const intervaloRecebido =
                  Number(
                    configuracao
                      .intervalo_minutos
                  );
                const duracaoPadrao =
                  Number.isInteger(
                    duracaoRecebida
                  ) &&
                  duracaoRecebida >
                    0
                    ? duracaoRecebida
                    : 60;
                const intervaloMinutos =
                  Number.isInteger(
                    intervaloRecebido
                  ) &&
                  intervaloRecebido >=
                    0
                    ? intervaloRecebido
                    : 0;
                const horarioConfigurado =
                  (
                    horariosPorProfissional
                      .get(
                        profissionalId
                      ) || []
                  ).find(
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
                    id:
                      profissional.id,
                    nome:
                      profissional.nome,
                    foto_url:
                      profissional
                        .foto_url,
                    servico_ids:
                      profissional
                        .servico_ids ||
                      [],
                    trabalha:
                      false,
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

                const horarios =
                  gerarHorariosConfigurados({
                    horaInicio,
                    horaFim,
                    intervaloInicio,
                    intervaloFim,
                    duracaoMinutos:
                      duracaoPadrao,
                    intervaloMinutos,
                  }).map(
                    (hora) => {
                      const chave =
                        `${profissionalId}_${criarChaveAgenda(
                          data,
                          hora
                        )}`;
                      const bloqueio =
                        mapaBloqueios
                          .get(
                            chave
                          );
                      let status =
                        bloqueio
                          ? "bloqueado"
                          : "livre";

                      if (
                        !bloqueio &&
                        horarioJaPassou({
                          data,
                          hora,
                          agoraLocal,
                        })
                      ) {
                        status =
                          "passado";
                      }

                      return {
                        hora,
                        status,
                        cliente:
                          null,
                        servico:
                          null,
                      };
                    }
                  );

                return {
                  id:
                    profissional.id,
                  nome:
                    profissional.nome,
                  foto_url:
                    profissional
                      .foto_url,
                  servico_ids:
                    profissional
                      .servico_ids ||
                    [],
                  trabalha: true,
                  horarios,
                };
              }
            ),
        };
      }
    );

  return {
    fuso_horario:
      fusoResolvido,
    agenda,
  };
}

async function buscarNotificacoesAgenda({
  usuarioId,
  negocioIdContexto,
  papelContexto
}) {
  exigirUsuario(usuarioId);
  exigirInteiroPositivo(
    negocioIdContexto,
    "Contexto do negócio é obrigatório."
  );
  exigirPermissao(
    papelContexto === "dono" ||
      papelContexto === "profissional",
    "Contexto da agenda inválido."
  );

  let total = 0;

  if (papelContexto === "dono") {
    total =
      await agendaRepository.contarNotificacoesAgendaDono(
        Number(negocioIdContexto)
      );
  } else {
    total =
      await agendaRepository.contarNotificacoesAgendaProfissional(
        usuarioId,
        Number(negocioIdContexto)
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
