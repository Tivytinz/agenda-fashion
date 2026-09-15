const agendaService = require("./agendaService");
const agendaRepository = require("../repositories/agendaRepository");
const agendamentoLifecycleRepository = require(
  "../repositories/agendamentoLifecycleRepository"
);

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

function criarSlotDeAgendamento(agendamento) {
  return {
    data: agendamento.data,
    hora: normalizarHorario(agendamento.hora),
    status: agendamento.status || "agendado",
    agendamento_id: agendamento.agendamento_id || null,
    cliente_id: agendamento.cliente_id || null,
    cliente: agendamento.cliente || null,
    cliente_whatsapp: agendamento.cliente_whatsapp || null,
    servico_id: agendamento.servico_id || null,
    servico: agendamento.servico || null,
    valor: agendamento.valor ?? null,
    duracao_minutos: agendamento.duracao_minutos || null,
    pode_marcar_falta: Boolean(agendamento.pode_marcar_falta),
    pode_marcar_realizado: Boolean(agendamento.pode_marcar_realizado),
  };
}

function materializarAgendaProfissional(agenda, agendamentos) {
  const agendamentosPorData = new Map();

  for (const agendamento of agendamentos || []) {
    const data = String(agendamento?.data || "");
    const hora = normalizarHorario(agendamento?.hora);
    if (!data || !hora) continue;

    const itens = agendamentosPorData.get(data) || [];
    itens.push({ ...agendamento, hora });
    agendamentosPorData.set(data, itens);
  }

  return (agenda || []).map((dia) => {
    const slots = criarSlotsBaseConfiaveis(dia.horarios);

    for (const agendamento of agendamentosPorData.get(dia.data) || []) {
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
  const agendamentosPorProfissionalData = new Map();
  const bloqueiosPorProfissionalData = new Map();

  for (const agendamento of agendamentos || []) {
    const hora = normalizarHorario(agendamento?.hora);
    if (!agendamento?.profissional_id || !agendamento?.data || !hora) continue;

    const chave = criarChaveProfissionalData(
      agendamento.profissional_id,
      agendamento.data
    );
    const itens = agendamentosPorProfissionalData.get(chave) || [];
    itens.push({ ...agendamento, hora });
    agendamentosPorProfissionalData.set(chave, itens);
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
      const slots = criarSlotsBaseConfiaveis(profissional.horarios);

      for (const bloqueio of bloqueiosPorProfissionalData.get(chave) || []) {
        if (!slots.has(bloqueio.hora)) {
          slots.set(bloqueio.hora, {
            hora: bloqueio.hora,
            status: "bloqueado",
            cliente: null,
            servico: null,
          });
        }
      }

      for (const agendamento of agendamentosPorProfissionalData.get(chave) || []) {
        const slotExistente = slots.get(agendamento.hora) || {};
        slots.set(agendamento.hora, {
          ...slotExistente,
          hora: agendamento.hora,
          status: agendamento.status || "agendado",
          agendamento_id: agendamento.agendamento_id || null,
          cliente: agendamento.cliente || null,
          servico: agendamento.servico || null,
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

async function listarAgendaProfissional({ profissionalId }) {
  const resultado = await agendaService.listarAgendaProfissional({ profissionalId });
  const periodo = obterPeriodoAgenda(resultado?.agenda);

  if (!periodo) return resultado;

  const agendamentos =
    await agendamentoLifecycleRepository
      .listarAgendamentosProfissionalPorPeriodo({
        profissionalId,
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
      });

  return {
    ...resultado,
    agenda: materializarAgendaProfissional(resultado.agenda, agendamentos),
  };
}

async function buscarAgendaGeral({ usuarioId }) {
  const resultado = await agendaService.buscarAgendaGeral({ usuarioId });
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
