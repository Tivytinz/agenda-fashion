const agendaService = require("./agendaService");
const agendaRepository = require("../repositories/agendaRepository");
const agendaContextoRepository = require(
  "../repositories/agendaContextoRepository"
);
const agendamentoLifecycleRepository = require(
  "../repositories/agendamentoLifecycleRepository"
);

const STATUS_ATIVOS = new Set([
  "agendado",
  "confirmado",
]);

function normalizarHorario(horario) {
  if (!horario) return null;
  return String(horario).trim().slice(0, 5);
}

function ordenarHorarios(horarios) {
  return [...horarios].sort((a, b) =>
    String(a?.hora || "").localeCompare(String(b?.hora || ""))
  );
}

function slotBaseRepresentaCompromisso(slot) {
  const status = String(slot?.status || "").trim().toLowerCase();
  const statusDeCompromisso = new Set([
    "agendado",
    "confirmado",
    "realizado",
    "falta",
  ]);

  return Boolean(
    statusDeCompromisso.has(status) ||
    slot?.agendamento_id ||
    slot?.cliente_id ||
    slot?.cliente ||
    slot?.servico_id ||
    slot?.servico
  );
}

function criarSlotsBaseConfiaveis(horarios) {
  return new Map(
    (horarios || [])
      .filter((slot) => !slotBaseRepresentaCompromisso(slot))
      .map((slot) => [
        normalizarHorario(slot.hora),
        { ...slot, hora: normalizarHorario(slot.hora) },
      ])
  );
}

// Somente reservas ativas ocupam a grade. O fim projetado pelo PostgreSQL usa
// o instante e a duração congelados, no fuso da agenda que está sendo consultada.
function ocuparIntervalos(slots, data, agendamentos) {
  for (const agendamento of agendamentos || []) {
    if (!STATUS_ATIVOS.has(agendamento.status)) continue;
    const inicio = Date.parse(`${agendamento.data}T${normalizarHorario(agendamento.hora)}:00Z`);
    const fim = agendamento.ocupacao_fim_local
      ? Date.parse(`${agendamento.ocupacao_fim_local}Z`)
      : inicio + Number(agendamento.duracao_minutos || 0) * 60000;
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) continue;

    for (const [hora] of slots) {
      const instante = Date.parse(`${data}T${hora}:00Z`);
      if (instante >= inicio && instante < fim) {
        slots.set(hora, { hora, status: "ocupado" });
      }
    }
  }
}

function projetarAgendamentoNoDia(agendamento, data) {
  const hora = normalizarHorario(agendamento?.hora);
  if (!agendamento?.data || !hora) return null;
  if (String(agendamento.data) === data) return { ...agendamento, hora };
  if (!agendamento.agendamento_id || !STATUS_ATIVOS.has(agendamento.status)
    || String(agendamento.data) >= data) return null;
  const inicio = Date.parse(`${agendamento.data}T${hora}:00Z`);
  const fim = agendamento.ocupacao_fim_local
    ? Date.parse(`${agendamento.ocupacao_fim_local}Z`)
    : inicio + Number(agendamento.duracao_minutos || 0) * 60000;
  if (!(fim > Date.parse(`${data}T00:00:00Z`))) return null;
  return {
    ...agendamento,
    data,
    hora: "00:00",
    continuacao: true,
    data_agendamento: agendamento.data,
    hora_agendamento: hora,
  };
}

function dadosContinuidade(agendamento) {
  return agendamento.continuacao ? {
    continuacao: true,
    data_agendamento: agendamento.data_agendamento,
    hora_agendamento: agendamento.hora_agendamento,
  } : {};
}

function podeCancelarAgendamentoOperacional(agendamento) {
  const status = String(
    agendamento?.status || ""
  ).trim().toLowerCase();

  return Boolean(
    agendamento?.agendamento_id &&
    STATUS_ATIVOS.has(status)
  );
}

function criarSlotDeAgendamento(agendamento) {
  return {
    data: agendamento.data,
    hora: normalizarHorario(agendamento.hora),
    status: agendamento.status || "agendado",
    agendamento_id: agendamento.agendamento_id || null,
    profissional_id: agendamento.profissional_id || null,
    cliente_id: agendamento.cliente_id || null,
    cliente: agendamento.cliente || null,
    cliente_whatsapp: agendamento.cliente_whatsapp || null,
    servico_id: agendamento.servico_id || null,
    servico: agendamento.servico || null,
    valor: agendamento.valor ?? null,
    duracao_minutos: agendamento.duracao_minutos || null,
    ...dadosContinuidade(agendamento),
    pode_cancelar: podeCancelarAgendamentoOperacional(agendamento),
    pode_reagendar: Boolean(agendamento.pode_reagendar),
    pode_iniciar_atendimento: Boolean(agendamento.pode_iniciar_atendimento),
    pode_marcar_falta: Boolean(agendamento.pode_marcar_falta),
    pode_marcar_realizado: Boolean(agendamento.pode_marcar_realizado),
  };
}

function materializarAgendaProfissional(agenda, agendamentos) {
  return (agenda || []).map((dia) => {
    const slots = criarSlotsBaseConfiaveis(dia.horarios);
    ocuparIntervalos(slots, dia.data, agendamentos);

    for (const item of agendamentos || []) {
      const agendamento = projetarAgendamentoNoDia(item, dia.data);
      if (!agendamento) continue;
      const slotExistente = slots.get(agendamento.hora) || {};
      slots.set(agendamento.hora, {
        ...slotExistente,
        ...criarSlotDeAgendamento(agendamento),
      });
    }

    return {
      ...dia,
      horarios: ordenarHorarios(
        Array.from(slots.values()).filter((slot) => slot.hora)
      ),
    };
  });
}

function criarChaveProfissionalData(profissionalId, data) {
  return `${profissionalId}_${data}`;
}

function materializarAgendaGeral(agenda, agendamentos, bloqueios) {
  const agendamentosPorProfissional = new Map();
  const bloqueiosPorProfissionalData = new Map();

  for (const agendamento of agendamentos || []) {
    const hora = normalizarHorario(agendamento?.hora);
    if (!agendamento?.profissional_id || !agendamento?.data || !hora) continue;

    const chave = String(agendamento.profissional_id);
    const itens = agendamentosPorProfissional.get(chave) || [];
    itens.push({ ...agendamento, hora });
    agendamentosPorProfissional.set(chave, itens);
  }

  for (const bloqueio of bloqueios || []) {
    const hora = normalizarHorario(bloqueio?.hora);
    if (!bloqueio?.profissional_id || !bloqueio?.data || !hora) continue;

    const chave = criarChaveProfissionalData(
      bloqueio.profissional_id,
      bloqueio.data
    );
    const itens = bloqueiosPorProfissionalData.get(chave) || [];
    itens.push({ ...bloqueio, hora });
    bloqueiosPorProfissionalData.set(chave, itens);
  }

  return (agenda || []).map((dia) => ({
    ...dia,
    profissionais: (dia.profissionais || []).map((profissional) => {
      const chave = criarChaveProfissionalData(profissional.id, dia.data);
      const slots = criarSlotsBaseConfiaveis(profissional.ativo === false ? [] : profissional.horarios);

      for (const bloqueio of profissional.ativo === false ? [] : bloqueiosPorProfissionalData.get(chave) || []) {
        if (!slots.has(bloqueio.hora)) {
          slots.set(bloqueio.hora, {
            hora: bloqueio.hora,
            status: "bloqueado",
            cliente: null,
            servico: null,
          });
        }
      }

      const reservas = agendamentosPorProfissional.get(String(profissional.id)) || [];
      ocuparIntervalos(slots, dia.data, reservas);

      for (const item of reservas) {
        const agendamento = projetarAgendamentoNoDia(item, dia.data);
        if (!agendamento) continue;
        if (profissional.ativo === false && !agendamento.agendamento_id) continue;
        const slotExistente = slots.get(agendamento.hora) || {};
        slots.set(agendamento.hora, {
          ...slotExistente,
          hora: agendamento.hora,
          status: agendamento.status || "agendado",
          agendamento_id: agendamento.agendamento_id || null,
          profissional_id: agendamento.profissional_id || null,
          cliente: agendamento.cliente || null,
          servico_id: agendamento.servico_id || null,
          servico: agendamento.servico || null,
          duracao_minutos: agendamento.duracao_minutos ?? null,
          ...dadosContinuidade(agendamento),
          pode_cancelar: podeCancelarAgendamentoOperacional(agendamento),
          pode_reagendar: Boolean(agendamento.pode_reagendar),
          pode_iniciar_atendimento: Boolean(agendamento.pode_iniciar_atendimento),
          pode_marcar_falta: Boolean(agendamento.pode_marcar_falta),
          pode_marcar_realizado: Boolean(agendamento.pode_marcar_realizado),
        });
      }

      return {
        ...profissional,
        horarios: ordenarHorarios(
          Array.from(slots.values()).filter((slot) => slot.hora)
        ),
      };
    }),
  }));
}

function obterPeriodoAgenda(agenda) {
  const datas = (agenda || [])
    .map((dia) => dia?.data)
    .filter(Boolean)
    .sort();

  if (datas.length === 0) return null;

  return {
    dataInicio: datas[0],
    dataFim: datas[datas.length - 1],
  };
}

async function listarAgendaProfissional({
  profissionalId,
  negocioId,
  fusoHorario,
}) {
  const resultado =
    await agendaService
      .listarAgendaProfissional({
        profissionalId,
        negocioId,
        fusoHorario,
      });
  const periodo = obterPeriodoAgenda(resultado?.agenda);

  if (!periodo) return resultado;

  const agendamentos =
    await agendaContextoRepository
      .listarAgendamentosProfissionalPorPeriodo({
        profissionalId,
        negocioId,
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
      });

  return {
    ...resultado,
    agenda: materializarAgendaProfissional(resultado.agenda, agendamentos),
  };
}

async function buscarAgendaGeral({ usuarioId, dataInicio }) {
  const resultado = await agendaService.buscarAgendaGeral({
    usuarioId,
    ...(dataInicio !== undefined ? { dataInicio } : {}),
  });
  const periodo = obterPeriodoAgenda(resultado?.agenda);

  if (!periodo) return resultado;

  const vinculoDono = await agendaRepository.buscarNegocioDono(usuarioId);
  const profissionalIds = Array.from(new Set(
    (resultado.agenda || []).flatMap((dia) =>
      (dia.profissionais || []).map((profissional) => Number(profissional.id))
    ).filter((id) => Number.isInteger(id) && id > 0)
  ));

  if (!vinculoDono?.negocio_id || profissionalIds.length === 0) {
    return resultado;
  }

  const [agendamentos, bloqueios] = await Promise.all([
    agendamentoLifecycleRepository
      .listarAgendamentosProfissionaisDoNegocioPorPeriodo({
        negocioId: vinculoDono.negocio_id,
        profissionalIds,
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
      }),
    agendaRepository.buscarBloqueiosProfissionaisPorPeriodo(
      vinculoDono.negocio_id,
      profissionalIds,
      periodo.dataInicio,
      periodo.dataFim
    ),
  ]);

  return {
    ...resultado,
    agenda: materializarAgendaGeral(
      resultado.agenda,
      agendamentos,
      bloqueios
    ),
  };
}

module.exports = {
  listarAgendaProfissional,
  buscarAgendaGeral,
  materializarAgendaProfissional,
  materializarAgendaGeral,
};
